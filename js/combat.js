// 3-Class Combat Engine: True Heavy Shotguns (Magazine, Reload, Buckshot Falloff & Recoil),
// Direct Soul XP & Gold Economy (Zero Floor Clutter), 9-Archetype Villain AI & 5-Act Boss/Mini-Boss Ladder
import * as THREE from '../vendor/three.module.js';
import {
  ARENA_HALF_SIZE,
  CLASSES,
  WEAPONS,
  ENEMY_TYPES,
  LEVELS,
  getLevelDef,
  RUN_UPGRADES
} from './config.js?v=20261124z99';
import {
  TWO_PI,
  ARENA_PLAYER_LIMIT,
  ARENA_ENTITY_LIMIT,
  MAX_ACTIVE_ENEMIES,
  COS_75_DEG,
  clamp,
  normalizeAngle,
  lerpAngle,
  resolveArenaBiomeForLevel,
  createCombatBridge
} from './combat/bridge.js?v=20261124z99';
import {
  updateBossAI,
  updateSoulsBossAI,
  startSoulsBossOpeningRoar,
  startSoulsBossStaggerKneel,
  startSoulsBossRiposteVictim,
  cancelSoulsBossTelegraph,
  applySoulsBossParry,
  SOULS_BOSS_MULTI_PARRY
} from './combat/bossAi.js?v=20261124z99';
import {
  createPoiseController,
  STANCE_DAMAGE_TABLE,
  STANCE_REGEN_RATE,
  getStanceRegenDelay,
  getPlayerHitstunSpec,
  SOULS_GUARD_CFG,
  computeBlockedStaminaCost
} from './combat/poiseSystem.js?v=20261124z99';
import {
  SOULS_ROLL_CFG,
  getSoulsRollIframes,
  sampleSoulsRollStepDist,
  sampleAttackLungeStep,
  createAliveStanceSmoother
} from './souls/soulsLocomotion.js?v=20261124z99';
import {
  SOULS_STAMINA_CFG,
  createSoulsStaminaController,
  createSoulsActionBuffer
} from './souls/soulsStaminaBuffer.js?v=20261124z99';
import {
  SOULS_ATTACK_SPECS,
  getSoulsAttackSpec,
  computeSoulsDamage,
  testSweptBladeHits
} from './souls/soulsHitboxDamage.js?v=20261124z99';
import * as SOULS_MOB_AI from './souls/soulsMobAi.js?v=20261124z99';
import {
  initSoulsMobState,
  stepSoulsMobAi,
  onSoulsMobParried,
  onSoulsMobInterrupted,
  resetSoulsPackCoordinator,
  releaseSoulsAttackToken
} from './souls/soulsMobAi.js?v=20261124z99';
import {
  SOULS_CASTLE_CONSTANTS,
  SOULS_CASTLE_BONFIRE,
  SOULS_CASTLE_PLAYER_SPAWN,
  SOULS_CASTLE_THRONE_CONFIG,
  SOULS_CASTLE_PILLARS,
  SOULS_CASTLE_AMBUSHES,
  SOULS_CASTLE_ENCOUNTERS,
  SOULS_CASTLE_RELICS,
  checkCastleAmbushTrigger,
  isInBonfireSafeZone,
  canRestAtBonfire,
  getBonfireCheckpointSpawn,
  getCastleRoomAt,
  hasCastleWallLineOfSight,
  canInteractWithBossDoor,
  findInteractableRelic,
  clampCastlePosition
} from './souls/soulsCastleLayout.js?v=20261124z99';
import {
  createDissolveAshSystem
} from './souls/soulsDissolveVfx.js?v=20261124z99';
import {
  enhanceSoulsBossModel,
  updateSoulsBossVisuals,
  triggerSoulsBossHitFlash,
  disposeSoulsBossVisuals
} from './souls/soulsBossVisuals.js?v=20261124z99';
import {
  createSoulsGameFeel,
  getImpactSparkBurst
} from './souls/soulsGameFeel.js?v=20261124z99';
import {
  BOSS_DOOR_CUTSCENE_DURATION,
  BOSS_DOOR_CUTSCENE_ACTS
} from './souls/soulsCutsceneChoreography.js?v=20261124z99';
import {
  BOSS_ESCAPE_CUTSCENE_DURATION,
  BOSS_ESCAPE_ACTS
} from './souls/soulsEscapeCutscene.js?v=20261124z99';
import {
  resetActorPhysics,
  applyKnockbackImpulse,
  stepActorPhysicsBody
} from './souls/soulsPhysicsFeel.js?v=20261124z99';
import {
  createWeaponTrailSystem
} from './souls/soulsWeaponTrails.js?v=20261124z99';

export function createCombatController({
  world,
  models,
  progression,
  audio,
  ui = null,
  callbacks = {}
} = {}) {
  const poiseCtrl = createPoiseController();
  let lastFrameElapsedTime = 0;
  const {
    sharedMiniCrateGeo,
    getProjMaterial,
    emitParticles,
    emitSlashArc,
    emitShockwave,
    emitTelegraphZone,
    emitDangerZone,
    makeProjectileVisual,
    buildHeroModel,
    buildCompanionModel,
    buildEnemyModel,
    buildPickupModel,
    removeSceneObject,
    syncFollowTarget,
    animateEntityModel,
    triggerModelAttack,
    triggerModelHitFlash,
    setModelBlocking,
    resolveObstaclesAndBounds
  } = createCombatBridge({ world, models, progression });

  function syncHeroReloadModel(isReloading) {
    heroModel?.handle?.setReloading?.(isReloading);
    heroModel?.obj?.userData?.setReloading?.(isReloading);
  }

  function cancelPlayerTurn180(suppressCooldown = 0) {
    if (player?.turn180Active) {
      player.turn180Active = false;
      player.turn180Delta = 0;
      heroModel?.handle?.cancelTurn180?.();
      heroModel?.obj?.userData?.cancelTurn180?.();
    }
    if (suppressCooldown > 0 && player) {
      player.turn180Cooldown = Math.max(player.turn180Cooldown || 0, suppressCooldown);
    }
  }

  // === Live Run State ===
  let autoAim = true;
  let attackEnabled = true;
  let runActive = false;
  let runEnded = false;
  let victoryDelayTimer = 0;
  let pendingVictoryPayload = null;
  let playerDying = false;
  let deathModalDelay = 0;
  let pendingDefeatPayload = null;

  let currentClassId = 'warrior';
  let currentWeaponId = 'club';
  let currentLevelNumber = 1;
  let currentDifficulty = 'normal';
  let currentLevelDef = LEVELS[0];

  let runLevel = 1;
  let xp = 0;
  let xpFraction = 0;
  let xpNext = 125;
  let runXp = 0;
  let runXpNext = 55;
  let runPerkLevel = 1;
  let pendingLevelUps = 0;
  let awaitingLevelUpChoice = false;

  let weaponRunLevel = 1;
  let perks = Object.create(null);
  let stats = null;

  // Endless / Survival & Chapter 26 Elden Ring (Abandoned Knight Rift) mode state
  const isMobileDevice =
    typeof navigator !== 'undefined' &&
    (/iPhone|iPod|iPad|Android/i.test(navigator.userAgent || '') ||
      ((navigator.maxTouchPoints || 0) > 1 && Math.min(window.innerWidth || 1280, window.innerHeight || 720) <= 1024));
  let combatLowSpecMode = false;
  let isEndless = false;
  let isSoulslike = false;
  const soulsStaminaCtrl = createSoulsStaminaController(SOULS_STAMINA_CFG.MAX_STAMINA);
  const soulsActionBuffer = createSoulsActionBuffer();
  const aliveStanceSmoother = createAliveStanceSmoother();
  const soulsGameFeel = createSoulsGameFeel();
  let weaponTrails = null;
  let dissolveAsh = null;
  let heroTrailRecording = false;
  const _clashPosScratch = { x: 0, y: 0.95, z: 0 };
  const _clashNormScratch = { x: 0, y: 0.35, z: 1 };
  let soulsStaminaEmptyHintCd = 0;

  function ensureSoulsWeaponTrails() {
    if (!isSoulslike || !world?.scene) return null;
    if (!weaponTrails) {
      weaponTrails = createWeaponTrailSystem(world.scene, {
        isMobile: isMobileDevice,
        lowSpec: combatLowSpecMode
      });
    }
    return weaponTrails;
  }

  function disposeSoulsWeaponTrails() {
    heroTrailRecording = false;
    if (weaponTrails) {
      weaponTrails.clearAll();
      weaponTrails.dispose();
      weaponTrails = null;
    }
  }

  function ensureSoulsDissolveAsh() {
    if (!isSoulslike || !world?.scene) return null;
    if (!dissolveAsh) {
      dissolveAsh = createDissolveAshSystem(world.scene, {
        isMobile: isMobileDevice,
        lowSpec: combatLowSpecMode
      });
    }
    return dissolveAsh;
  }

  function disposeSoulsDissolveAsh() {
    if (dissolveAsh) {
      dissolveAsh.clearAll();
      dissolveAsh.dispose();
      dissolveAsh = null;
    }
  }

  function hasCastleLineOfSight(x1, z1, x2, z2) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const lenSq = dx * dx + dz * dz;
    if (lenSq < 1e-4) return true;
    const pillars = SOULS_CASTLE_PILLARS;
    for (let i = 0; i < pillars.length; i++) {
      const p = pillars[i];
      const pr = (p.radius || 0.72) + 0.12;
      const t = clamp(((p.x - x1) * dx + (p.z - z1) * dz) / lenSq, 0, 1);
      const cx = x1 + dx * t - p.x;
      const cz = z1 + dz * t - p.z;
      if (cx * cx + cz * cz < pr * pr) return false;
    }
    return true;
  }

  function getMobAudioDistNorm(e) {
    if (!e || !player) return 0;
    const d = Math.hypot((e.x || 0) - player.x, (e.z || 0) - player.z);
    return clamp(d / 16.0, 0, 1);
  }

  function isBossIgnoringThroneCollider(boss) {
    if (!boss || !boss.isSoulsBoss) return false;
    return Boolean(
      souls.doorCutsceneActive ||
      souls.escapeCutsceneActive ||
      world?.isBossDoorCutsceneActive?.() ||
      world?.isBossEscapeCutsceneActive?.() ||
      boss.soulsThronePhase === 'sitting' ||
      boss.soulsThronePhase === 'pause' ||
      boss.soulsThronePhase === 'standing' ||
      boss.soulsState === 'throne_sit' ||
      boss.soulsState === 'cutscene'
    );
  }

  function sampleSmoothGroundY(actor, x, z, stepDt = 0.016, snap = false) {
    const rawY = world?.getGroundHeight?.(x, z) ?? 0;
    if (!isSoulslike || snap || !actor || !Number.isFinite(actor.visualGroundY)) {
      if (actor) actor.visualGroundY = rawY;
      return rawY;
    }
    const alpha = 1 - Math.exp(-Math.max(stepDt || 0.016, 0.001) * 22);
    actor.visualGroundY += (rawY - actor.visualGroundY) * alpha;
    if (Math.abs(rawY - actor.visualGroundY) < 0.002) {
      actor.visualGroundY = rawY;
    }
    return actor.visualGroundY;
  }

  function clampPlayerCastlePos(x, z, r, out) {
    if (souls.zoneMode === 'exterior_shore' && typeof world?.clampSoulsPosition === 'function') {
      const res = world.clampSoulsPosition(x, z, r);
      if (out && typeof out === 'object') {
        out.x = res.x;
        out.z = res.z;
        out.hitWall = Math.hypot(res.x - x, res.z - z) > 1e-4;
        return out;
      }
      return res;
    }
    return clampCastlePosition(x, z, r, {
      bossDoorState: world?.getBossDoorState?.() || 'closed',
      allowBossHall: Boolean(souls.bossAwakened || z < SOULS_CASTLE_CONSTANTS.BOSS_DOOR_Z - 0.5),
      ignoreThrone: false,
      out
    });
  }

  function clampMobCastlePos(x, z, r, out) {
    return clampCastlePosition(x, z, r, {
      bossDoorState: 'closed',
      allowBossHall: false,
      ignoreThrone: false,
      out
    });
  }

  function clampBossCastlePos(x, z, r, out, ignoreThrone = false) {
    return clampCastlePosition(x, z, r, {
      bossDoorState: 'sealed',
      allowBossHall: true,
      ignoreThrone: Boolean(ignoreThrone),
      out
    });
  }

  function spawnSoulsClashSparks(x, y, z, nx, ny, nz, tier = 'block') {
    if (!weaponTrails) return;
    _clashPosScratch.x = x;
    _clashPosScratch.y = y;
    _clashPosScratch.z = z;
    _clashNormScratch.x = nx;
    _clashNormScratch.y = ny;
    _clashNormScratch.z = nz;
    weaponTrails.spawnClashSparks(_clashPosScratch, _clashNormScratch, tier);
  }

  function handleSoulsWallSlam(actor, stepRes, isEnemy) {
    if (!actor || !stepRes?.wallHit) return;
    emitSoulsSparkBurst('wall_slam', stepRes.wallHitX, stepRes.wallHitZ, stepRes.wallNormalX, stepRes.wallNormalZ);
    spawnSoulsClashSparks(
      stepRes.wallHitX,
      stepRes.wallHitY || 0.92,
      stepRes.wallHitZ,
      stepRes.wallNormalX,
      0.28,
      stepRes.wallNormalZ,
      'stone'
    );
    const kickAmt = Math.min(0.28, 0.09 + (stepRes.wallVfx?.cameraKick || 0) * 0.22);
    world?.addScreenShake?.(kickAmt, 0.14);
    actor.model?.handle?.applyRecoilImpulse?.({
      kind: 'wallSlam',
      dirX: stepRes.wallNormalX,
      dirZ: stepRes.wallNormalZ,
      intensity: Math.max(0.55, stepRes.wallImpactIntensity || 0.8),
      isHeavy: (stepRes.wallImpactIntensity || 0) >= 0.72
    });
    if (isEnemy && actor.hp > 0 && (stepRes.wallVfx?.bonusWallStagger || 0) > 0) {
      addBossStagger(actor, stepRes.wallVfx.bonusWallStagger);
      floatText('💥 ОБ СТЕНУ!', actor.x, actor.z - 0.85, '#cbd5e1');
    }
  }

  let mobileAutoFlaskEnabled = true;
  let mobileSmartLockEnabled = true;
  try {
    if (typeof localStorage !== 'undefined') {
      const savedFlask = localStorage.getItem('grimborne_mobile_auto_flask');
      if (savedFlask === '0') mobileAutoFlaskEnabled = false;
      const savedLock = localStorage.getItem('grimborne_mobile_smart_lock');
      if (savedLock === '0') mobileSmartLockEnabled = false;
    }
  } catch {}

  function setMobileAutoFlask(enabled) {
    mobileAutoFlaskEnabled = Boolean(enabled);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('grimborne_mobile_auto_flask', mobileAutoFlaskEnabled ? '1' : '0');
      }
    } catch {}
    return mobileAutoFlaskEnabled;
  }

  function toggleMobileAutoFlask() {
    return setMobileAutoFlask(!mobileAutoFlaskEnabled);
  }

  function setMobileSmartLock(enabled) {
    mobileSmartLockEnabled = Boolean(enabled);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('grimborne_mobile_smart_lock', mobileSmartLockEnabled ? '1' : '0');
      }
    } catch {}
    return mobileSmartLockEnabled;
  }

  function toggleMobileSmartLock() {
    return setMobileSmartLock(!mobileSmartLockEnabled);
  }

  function makeInitialSoulsState() {
    return {
      stamina: SOULS_STAMINA_CFG.MAX_STAMINA,
      maxStamina: SOULS_STAMINA_CFG.MAX_STAMINA,
      staminaMax: SOULS_STAMINA_CFG.MAX_STAMINA,
      staminaRegenDelay: 0,
      staminaExhausted: false,
      guardBreakTimer: 0,
      isBlocking: false,
      blockWasHeld: false,
      blockPressElapsed: 0,
      blockHoldSec: 0,
      blockParryTouch: false,
      blockParryConsumed: false,
      parryWindowTimer: 0,
      guardCounterTimer: 0,
      flasks: 4,
      flasksMax: 4,
      flaskDrinkTimer: 0,
      flaskHealTimer: 0,
      mobileAutoFlaskCd: 0,
      mobileAutoFlaskSafeSec: 0,
      mobileAutoFlaskTriggered: false,
      mobileManualUnlockTimer: 0,
      mobileRetreatSprintSec: 0,
      mobileThreatCheckCd: 0,
      bonfireHealCooldown: 0,
      bonfireRestTimer: 0,
      bossIntroPlayed: false,
      bossAwakened: false,
      bossDefeated: false,
      bossEscaped: false,
      escapedCastle: false,
      zoneMode: 'castle',
      shoreSwordPickedUp: false,
      shoreBonfireLit: false,
      shoreNoSwordHintCd: 0,
      zoneTitleRu: 'Зал Костра',
      activeAttack: null,
      justLandedTimer: 0,
      recoilVisual: 0,
      lastInputSource: 'mouse_kb',
      inCombat: false,
      claimedRelics: new Set(),
      triggeredAmbushes: new Set(),
      flameTrapHitCd: 0,
      canRiposte: false,
      riposteTarget: null,
      activeRiposte: null,
      doorCutsceneActive: false,
      doorCutsceneTimer: 0,
      escapeCutsceneActive: false,
      escapeCutsceneLastVoiceCue: 0,
      escapeCutsceneLastClashCue: 0,
      escapeCutsceneLastDisarmCue: 0,
      escapeCutsceneLastKnockdownCue: 0,
      escapeCutsceneLastScootCue: 0,
      escapeCutsceneLastBossStepCue: 0,
      escapeCutsceneLastBossArmorCue: 0,
      escapeCutsceneLastHeroRollCue: 0,
      escapeCutsceneLastSlowMoCue: 0,
      escapeCutsceneLastFloorSmashCue: 0,
      escapeCutsceneLastWaterSplashCue: 0,
      escapeCutsceneLastGrateBreakCue: 0,
      escapeCutsceneLastShoreWakeCue: 0,
      escapeChasmWindActive: false,
      cutsceneLastVoiceCue: 0,
      cutsceneLastArmorCue: 0,
      cutsceneLastHeroStep: 0,
      cutsceneLastBossStep: 0,
      cutsceneLastDustStage: 0,
      cutsceneDoorSlammed: false,
      cutsceneFogGateSealed: false,
      cutsceneIntroStandupStarted: false,
      cutsceneHeroWalkAnim: false,
      cutsceneSubtitleSpeaker: '',
      cutsceneSubtitleText: '',
      cutsceneShowBossTitleCard: false,
      cutsceneShowLocationCard: false,
      cutsceneLocationTitleRu: '',
      cutsceneLocationSubtitleRu: '',
      cutsceneFadeToBlack01: 0,
      cutsceneUnderwater01: 0,
      cutsceneImpactFlash01: 0,
      cutsceneSlowMoFactor: 1.0,
      escapeFinalCamYaw: 0,
      escapeFinalHeroFacing: Math.PI,
      cutsceneCanSkip: false,
      cutsceneBossTitleRu: BOSS_DOOR_CUTSCENE_ACTS.BOSS_TITLE_RU,
      cutsceneBossSubtitleRu: BOSS_DOOR_CUTSCENE_ACTS.BOSS_SUBTITLE_RU,
      cutsceneLetterbox01: 0,
      canOpenBossDoors: false,
      bossDoorExitingHall: false,
      canRestAtBonfire: false,
      canInteract: false,
      interactLabel: 'Открыть врата',
      interactPromptRu: 'Открыть врата',
      bonfireCheckpointLit: false,
      prevManualTrigger: false,
      prevHeavyTrigger: false,
      prevDashInput: false,
      prevFlaskInput: false,
      prevInteractInput: false
    };
  }

  let souls = makeInitialSoulsState();
  let droppedSwordProp = null;
  let shoreRealSwordAttached = false;

  function ensureShoreRealSwordAttached() {
    if (shoreRealSwordAttached) return true;
    const attachNow = () => {
      if (shoreRealSwordAttached) return true;
      // After the Boss Escape Cutscene, the Hero loses his old Oath Broadsword and discovers
      // the gnarled Elden Ring Great Club («Большая Дубина») lying on the coastal pebbles!
      const clone =
        typeof models?.createRealGreatClubClone === 'function'
          ? models.createRealGreatClubClone({ centerOrigin: false })
          : typeof models?.createRealOathSwordClone === 'function'
            ? models.createRealOathSwordClone({ centerOrigin: false })
            : null;
      if (!clone) return false;
      shoreRealSwordAttached = true;
      world?.attachShoreRealSwordModel?.(clone);
      return true;
    };
    if (attachNow()) return true;
    if (typeof models?.ensureModelKeysLoaded === 'function') {
      models.ensureModelKeysLoaded(['great_club_tripo', 'sword_tripo']).then(() => {
        attachNow();
      }).catch(() => {});
    }
    return false;
  }

  function equipHeroWeapon(weaponId = 'great_club') {
    const targetId = WEAPONS[weaponId] ? weaponId : 'club';
    currentWeaponId = targetId;
    recomputeStats();
    heroModel?.handle?.setWeapon?.(targetId);
    heroModel?.obj?.userData?.setWeapon?.(targetId);
    heroModel?.handle?.setWeaponDisarmed?.(false, false);
    if (isSoulslike && souls.zoneMode === 'exterior_shore' && targetId === 'great_club') {
      souls.shoreSwordPickedUp = true;
      world?.setShoreSwordPickedUp?.(true);
    }
    ui?.updateHud?.(getHudSnapshot());
    return currentWeaponId;
  }

  function ensureDroppedSwordProp() {
    if (!droppedSwordProp && typeof models?.createDroppedSwordMesh === 'function') {
      droppedSwordProp = models.createDroppedSwordMesh();
      if (droppedSwordProp?.obj && world?.scene) {
        world.scene.add(droppedSwordProp.obj);
      }
    }
    return droppedSwordProp;
  }

  function hideDroppedSwordProp() {
    if (droppedSwordProp?.obj) {
      droppedSwordProp.obj.visible = false;
    }
  }

  function disposeDroppedSwordProp() {
    if (droppedSwordProp) {
      droppedSwordProp.dispose?.();
      droppedSwordProp = null;
    }
  }

  function syncSoulsStaminaMirror() {
    souls.stamina = soulsStaminaCtrl.getDisplayStamina();
    souls.maxStamina = soulsStaminaCtrl.getMaxStamina();
    souls.staminaMax = souls.maxStamina;
    souls.staminaRegenDelay = soulsStaminaCtrl.getRegenDelay();
    souls.staminaExhausted = soulsStaminaCtrl.isExhausted();
  }

  function clearSoulsCutsceneUiMirror() {
    souls.doorCutsceneActive = false;
    souls.doorCutsceneTimer = 0;
    souls.escapeCutsceneActive = false;
    souls.escapeChasmWindActive = false;
    souls.cutsceneHeroWalkAnim = false;
    souls.cutsceneSubtitleSpeaker = '';
    souls.cutsceneSubtitleText = '';
    souls.cutsceneShowBossTitleCard = false;
    souls.cutsceneShowLocationCard = false;
    souls.cutsceneLocationTitleRu = '';
    souls.cutsceneLocationSubtitleRu = '';
    souls.cutsceneFadeToBlack01 = 0;
    souls.cutsceneUnderwater01 = 0;
    souls.cutsceneImpactFlash01 = 0;
    souls.cutsceneSlowMoFactor = 1.0;
    souls.cutsceneInstantSync = false;
    souls.cutsceneCanSkip = false;
    souls.cutsceneLetterbox01 = 0;
  }

  function syncEscapeCutsceneUiImmediate(escState, instant = false) {
    if (!ui) return;
    souls.cutsceneInstantSync = Boolean(instant);
    if (typeof ui.updateHud === 'function') {
      ui.updateHud(getHudSnapshot());
    }
    if (escState && typeof ui.setSoulsLetterbox === 'function') {
      ui.setSoulsLetterbox(true, {
        showBossTitleCard: false,
        showLocationCard: Boolean(escState.showLocationCard),
        locationTitleRu: escState.locationTitleRu || 'БЕРЕГ ПЕПЕЛЬНОГО СТОКА',
        locationSubtitleRu: escState.locationSubtitleRu || 'ЗА СТЕНАМИ ЗАМКА ПЕПЛА',
        canSkip: Boolean(escState.canSkip),
        subtitleSpeaker: escState.subtitleSpeaker || '',
        subtitleText: escState.subtitleText || '',
        letterbox01: Number(escState.letterbox01) || 0,
        fadeToBlack01: Number(escState.fadeToBlack01) || 0,
        underwater01: Number(escState.underwater01) || 0,
        impactFlash01: Number(escState.impactFlash01) || 0,
        slowMoFactor: Number.isFinite(Number(escState.slowMoFactor)) ? Number(escState.slowMoFactor) : 1.0,
        instant: Boolean(instant)
      });
    }
  }

  function resetSoulsControllers(resetAll = true) {
    soulsStaminaCtrl.reset(SOULS_STAMINA_CFG.MAX_STAMINA);
    soulsActionBuffer.clear();
    aliveStanceSmoother.reset();
    soulsGameFeel.reset();
    resetSoulsPackCoordinator();
    weaponTrails?.clearAll?.();
    dissolveAsh?.clearAll?.();
    heroTrailRecording = false;
    heroModel?.handle?.cancelFlaskDrinkAnim?.();
    heroModel?.handle?.setDoorPushMode?.(false);
    heroModel?.handle?.clearCutsceneClip?.(0);
    heroModel?.handle?.setWeaponDisarmed?.(false, false);
    hideDroppedSwordProp();
    soulsStaminaEmptyHintCd = 0;
    if (resetAll) {
      souls = makeInitialSoulsState();
    } else {
      souls.guardBreakTimer = 0;
      souls.isBlocking = false;
      souls.blockWasHeld = false;
      souls.blockPressElapsed = 0;
      souls.blockHoldSec = 0;
      souls.blockParryConsumed = false;
      souls.parryWindowTimer = 0;
      souls.guardCounterTimer = 0;
      souls.flaskDrinkTimer = 0;
      souls.flaskHealTimer = 0;
      souls.bonfireRestTimer = 0;
      souls.activeAttack = null;
      souls.justLandedTimer = 0;
      souls.recoilVisual = 0;
      souls.flameTrapHitCd = 0;
      souls.canRiposte = false;
      souls.riposteTarget = null;
      souls.activeRiposte = null;
      souls.cutsceneFogGateSealed = false;
      clearSoulsCutsceneUiMirror();
      souls.canOpenBossDoors = false;
      souls.bossDoorExitingHall = false;
      souls.prevManualTrigger = false;
      souls.prevHeavyTrigger = false;
      souls.prevDashInput = false;
      souls.prevFlaskInput = false;
      souls.prevInteractInput = false;
      if (!(souls.claimedRelics instanceof Set)) {
        souls.claimedRelics = new Set();
      }
      if (!(souls.triggeredAmbushes instanceof Set)) {
        souls.triggeredAmbushes = new Set();
      }
    }
    syncSoulsStaminaMirror();
  }

  function finishBossDoorCutsceneIntoCombat(skipped = false) {
    clearSoulsCutsceneUiMirror();
    souls.cutsceneFogGateSealed = true;
    souls.bossDoorExitingHall = false;
    soulsActionBuffer.clear();
    heroModel?.handle?.setDoorPushMode?.(false);
    heroModel?.handle?.cancelFlaskDrinkAnim?.();
    player.x = BOSS_DOOR_CUTSCENE_ACTS.HERO_FINAL_X;
    player.z = BOSS_DOOR_CUTSCENE_ACTS.HERO_FINAL_Z;
    player.facing = BOSS_DOOR_CUTSCENE_ACTS.HERO_FACING;
    player.moveVelX = 0;
    player.moveVelZ = 0;
    resetActorPhysics(player);
    if (heroModel?.obj) {
      const heroGroundY = sampleSmoothGroundY(player, player.x, player.z, 0, true);
      heroModel.obj.position.set(player.x, heroGroundY, player.z);
      heroModel.obj.rotation.y = player.facing;
    }

    if (world?.isBossDoorCutsceneActive?.()) {
      world.skipBossDoorCutscene(true, {
        x: BOSS_DOOR_CUTSCENE_ACTS.HERO_FINAL_X,
        z: BOSS_DOOR_CUTSCENE_ACTS.HERO_FINAL_Z
      });
    }
    world?.sealBossDoors?.();
    world?.sealBossFogGate?.();
    world?.setSoulsFogGate?.(true);
    world?.setBossAtmosphere?.(true);
    soulsGameFeel.setDoorRumble(0);
    weaponTrails?.clearAll?.();

    const soulsBoss = enemies.find((en) => en && en.isSoulsBoss && en.hp > 0);
    if (soulsBoss) {
      bossEntity = soulsBoss;
      soulsBoss.x = 0;
      soulsBoss.z = BOSS_DOOR_CUTSCENE_ACTS.BOSS_FINAL_Z;
      soulsBoss.facing = 0;
      soulsBoss.vx = 0;
      soulsBoss.vz = 0;
      resetActorPhysics(soulsBoss);
      soulsBoss.soulsThronePhase = 'done';
      soulsBoss.soulsAwake = true;
      soulsBoss.soulsState = 'stalk';
      soulsBoss.soulsGoal = 'circle_spacing';
      soulsBoss.soulsTimer = 0.65;
      soulsBoss.model?.handle?.setBossMouthOpen?.(0);
      soulsBoss.model?.handle?.clearCutsceneClip?.(skipped ? 0.05 : 0.22);
      soulsBoss.model?.handle?.setClipOverride?.(null);
      if (soulsBoss.model?.obj) {
        const bossGroundY = sampleSmoothGroundY(soulsBoss, 0, BOSS_DOOR_CUTSCENE_ACTS.BOSS_FINAL_Z, 0, true);
        soulsBoss.model.obj.visible = true;
        soulsBoss.model.obj.position.set(0, bossGroundY, BOSS_DOOR_CUTSCENE_ACTS.BOSS_FINAL_Z);
        soulsBoss.model.obj.rotation.y = 0;
      }
    }

    souls.bossIntroPlayed = true;
    souls.bossAwakened = true;
    souls.zoneTitleRu = 'Тронный Зал';
    audio?.setSoulsAmbientActive?.(true, { nearBonfire: false });
    audio?.setMusicMode?.('boss');

    if (skipped) {
      syncFollowTarget(player.x, player.z, heroModel?.obj, 0);
    }
  }

  function clearAllCastleEnemiesForShore() {
    clearTargetLock();
    bossHazards.length = 0;
    activeBurningZones.length = 0;
    bomberHazards.length = 0;
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (!e) continue;
      if (e.isSoulsBoss) {
        cancelSoulsBossTelegraph(e, elapsedRunTime);
        if (e.model?.obj) disposeSoulsBossVisuals(e.model.obj);
      }
      if (e.model?.obj) {
        removeSceneObject(e.model.obj, e.model.handle);
      }
    }
    enemies.length = 0;
    bossEntity = null;
  }

  function finishBossEscapeCutsceneToShore(skipped = false, opts = null) {
    const withSword = Boolean(opts?.withSword);
    const bonfireLit = Boolean(opts?.bonfireLit);
    const finalCamYaw = Number.isFinite(Number(souls.escapeFinalCamYaw)) ? Number(souls.escapeFinalCamYaw) : 0;
    const finalHeroFacing = Number.isFinite(Number(souls.escapeFinalHeroFacing)) ? Number(souls.escapeFinalHeroFacing) : Math.PI;

    clearSoulsCutsceneUiMirror();
    hideDroppedSwordProp();
    ensureShoreRealSwordAttached();
    soulsActionBuffer.clear();
    souls.activeAttack = null;
    souls.activeRiposte = null;
    souls.canRiposte = false;
    souls.riposteTarget = null;
    souls.isBlocking = false;
    souls.flaskDrinkTimer = 0;
    souls.flaskHealTimer = 0;
    souls.guardBreakTimer = 0;
    meleeStepLunge = null;
    pendingMeleeStrikes.length = 0;
    player.dashTimer = 0;
    player.hasHyperArmor = false;
    player.moveVelX = 0;
    player.moveVelZ = 0;
    resetActorPhysics(player);
    weaponTrails?.clearAll?.();
    soulsGameFeel.setDoorRumble(0);
    setModelBlocking(heroModel, false);
    heroModel?.handle?.cancelFlaskDrinkAnim?.();
    heroModel?.handle?.setDoorPushMode?.(false);
    heroModel?.handle?.clearCutsceneClip?.(skipped ? 0.05 : 0.25);
    ensureShoreRealSwordAttached();
    if (withSword) {
      equipHeroWeapon('great_club');
    } else {
      heroModel?.handle?.setWeaponDisarmed?.(true, false);
    }

    if (world?.isBossEscapeCutsceneActive?.()) {
      world.skipBossEscapeCutscene(true);
    }
    world?.setSoulsZoneMode?.('exterior_shore');
    world?.setShoreGrateBroken?.(true);
    world?.setShoreSwordPickedUp?.(withSword);
    world?.setShoreBonfireLit?.(bonfireLit);
    world?.resetShoreDestructibles?.();
    world?.setBossAtmosphere?.(false);
    world?.setSoulsFogGate?.(false);
    world?.setCombatOrbitYaw?.(finalCamYaw);

    clearAllCastleEnemiesForShore();

    const anchors = world?.getExteriorShoreAnchors?.() || {};
    const wakePos = anchors.wakePos || { x: 0, y: 0, z: 2.5 };
    player.x = Number.isFinite(wakePos.x) ? wakePos.x : 0;
    player.z = Number.isFinite(wakePos.z) ? wakePos.z : 2.5;
    player.facing = skipped ? Math.PI : finalHeroFacing;
    player.hp = player.maxHp;
    souls.flasks = souls.flasksMax;
    soulsStaminaCtrl.reset(SOULS_STAMINA_CFG.MAX_STAMINA);
    syncSoulsStaminaMirror();

    if (heroModel?.obj) {
      const shoreGroundY = sampleSmoothGroundY(player, player.x, player.z, 0, true);
      heroModel.obj.position.set(player.x, shoreGroundY, player.z);
      heroModel.obj.rotation.set(0, player.facing, 0);
    }

    souls.zoneMode = 'exterior_shore';
    souls.zoneTitleRu = 'Берег Пепельного Стока';
    souls.bossIntroPlayed = true;
    souls.bossAwakened = false;
    souls.bossDefeated = true;
    souls.bossEscaped = true;
    souls.escapedCastle = true;
    souls.shoreSwordPickedUp = withSword;
    souls.shoreBonfireLit = bonfireLit;

    audio?.stopEscapeVoice?.(0.08);
    audio?.playChasmWindFall?.(false);
    audio?.stopBossRoar?.(0.08);
    audio?.setSoulsAmbientActive?.(false, { nearBonfire: false });
    audio?.setExteriorShoreAmbient?.(true);
    audio?.setMusicMode?.('off');

    syncFollowTarget(player.x, player.z, heroModel?.obj, 0);
    ui?.setSoulsLetterbox?.(false);
    ui?.updateHud?.(getHudSnapshot());
    callbacks?.onEscapeCastleCompleted?.({
      escapedCastle: true,
      shoreSwordPickedUp: withSword,
      shoreBonfireLit: bonfireLit
    });
    if (!withSword) {
      floatText('БЕРЕГ ПЕПЕЛЬНОГО СТОКА • Найдите оружие на берегу!', player.x, player.z - 1.2, '#e2e8f0');
    }
  }

  function applyBossEscapeCutsceneState(escState, stepDt = 0.016, elapsed = 0, silentCues = false) {
    if (!escState) return;
    ensureShoreRealSwordAttached();
    souls.zoneMode = escState.stageMode || 'castle';
    souls.zoneTitleRu =
      souls.zoneMode === 'exterior_shore'
        ? 'Берег Пепельного Стока'
        : souls.zoneMode === 'shaft_river'
          ? 'Подземный Сток'
          : 'Тронный Зал';
    souls.cutsceneSubtitleSpeaker = escState.subtitleSpeaker || '';
    souls.cutsceneSubtitleText = escState.subtitleText || '';
    souls.cutsceneShowBossTitleCard = false;
    souls.cutsceneShowLocationCard = Boolean(escState.showLocationCard);
    souls.cutsceneLocationTitleRu = escState.locationTitleRu || 'БЕРЕГ ПЕПЕЛЬНОГО СТОКА';
    souls.cutsceneLocationSubtitleRu = escState.locationSubtitleRu || 'ЗА СТЕНАМИ ЗАМКА ПЕПЛА';
    souls.cutsceneCanSkip = Boolean(escState.canSkip);
    souls.cutsceneLetterbox01 = Number(escState.letterbox01) || 0;
    souls.cutsceneFadeToBlack01 = Number(escState.fadeToBlack01) || 0;
    souls.cutsceneUnderwater01 = Number(escState.underwater01) || 0;
    souls.cutsceneImpactFlash01 = Number(escState.impactFlash01) || 0;
    souls.cutsceneSlowMoFactor = Number.isFinite(Number(escState.slowMoFactor)) ? Number(escState.slowMoFactor) : 1.0;
    if (!silentCues) souls.cutsceneInstantSync = false;
    if (Number.isFinite(Number(escState.finalCamYaw))) {
      souls.escapeFinalCamYaw = Number(escState.finalCamYaw);
    }
    if (escState.stageMode === 'exterior_shore' && Number.isFinite(Number(escState.heroFacing))) {
      souls.escapeFinalHeroFacing = Number(escState.heroFacing);
    }

    // 1. Hero Pose, Position (including vertical chasm fall Y!), Clip & Disarm
    player.x = Number.isFinite(escState.heroX) ? escState.heroX : player.x;
    player.z = Number.isFinite(escState.heroZ) ? escState.heroZ : player.z;
    player.facing = Number.isFinite(escState.heroFacing) ? escState.heroFacing : player.facing;
    player.moveVelX = 0;
    player.moveVelZ = 0;
    const heroY = Number.isFinite(escState.heroY) ? escState.heroY : 0;
    player.visualGroundY = heroY;
    if (heroModel?.obj) {
      heroModel.obj.visible = true;
      heroModel.obj.position.set(player.x, heroY, player.z);
      heroModel.obj.rotation.set(0, player.facing, 0);
    }
    heroModel?.handle?.setWeaponDisarmed?.(Boolean(escState.swordDisarmed), Boolean(escState.shieldDisarmed));
    const clipBlend = silentCues ? 0 : 0.16;
    if (escState.heroAnimName) {
      heroModel?.handle?.setCutsceneClipNormalized?.(escState.heroAnimName, escState.heroAnimU ?? 0, clipBlend);
    }

    // 2. Boss Pose, 30-FPS Lip-Sync & Enraged Warhammer Fire
    const cutBoss = enemies.find((en) => en && en.isSoulsBoss);
    if (cutBoss) {
      bossEntity = cutBoss;
      cutBoss.x = Number.isFinite(escState.bossX) ? escState.bossX : cutBoss.x;
      cutBoss.z = Number.isFinite(escState.bossZ) ? escState.bossZ : cutBoss.z;
      cutBoss.facing = Number.isFinite(escState.bossFacing) ? escState.bossFacing : 0;
      cutBoss.vx = 0;
      cutBoss.vz = 0;
      const bossY = Number.isFinite(escState.bossY) ? escState.bossY : 0;
      if (cutBoss.model?.obj) {
        cutBoss.model.obj.visible = Boolean(escState.bossVisible);
        cutBoss.model.obj.position.set(cutBoss.x, bossY, cutBoss.z);
        cutBoss.model.obj.rotation.set(0, cutBoss.facing, 0);
      }
      cutBoss.model?.handle?.setBossMouthOpen?.(escState.bossMouthOpen01 || 0);
      if (escState.bossVisible && escState.bossAnimName) {
        cutBoss.model?.handle?.setCutsceneClipNormalized?.(escState.bossAnimName, escState.bossAnimU ?? 0, clipBlend);
      }
      if (cutBoss.model?.obj && escState.bossVisible) {
        updateSoulsBossVisuals(cutBoss.model.obj, silentCues ? 0.45 : stepDt, {
          phase2Enraged: Boolean(escState.bossEnragedFire),
          isWindup: false,
          isStaggered: false,
          mouthOpen01: escState.bossMouthOpen01 || 0,
          elapsed
        });
      }
    }

    // 3. Flying / Sliding / Falling 3D Oath Broadsword
    const ds = escState.droppedSword;
    if (ds && ds.visible) {
      const swordProp = ensureDroppedSwordProp();
      if (swordProp?.obj) {
        swordProp.obj.visible = true;
        swordProp.obj.position.set(ds.x || 0, ds.y || 0, ds.z || 0);
        swordProp.obj.rotation.set(ds.rx || 0, ds.ry || 0, ds.rz || 0);
      }
    } else {
      hideDroppedSwordProp();
    }

    if (silentCues) return;

    // 4. Synchronized Escape Audio & VFX Cues (monotonic edge triggers)
    const cues = escState.cues || {};
    const vCue = Number(cues.voiceCue ?? escState.voiceCueIndex) || 0;
    if (vCue > 0 && vCue !== souls.escapeCutsceneLastVoiceCue) {
      souls.escapeCutsceneLastVoiceCue = vCue;
      audio?.playEscapeVoiceLine?.(vCue);
    }

    const clCue = Number(cues.clashCue) || 0;
    if (clCue > souls.escapeCutsceneLastClashCue) {
      souls.escapeCutsceneLastClashCue = clCue;
      audio?.playSwordParryClash?.(clCue === 1 ? 1.0 : 1.18);
      world?.addScreenShake?.(clCue === 1 ? 0.34 : 0.42, 0.16);
      const midX = (player.x + (cutBoss?.x ?? 0)) * 0.5;
      const midZ = (player.z + (cutBoss?.z ?? player.z - 2)) * 0.5;
      world?.emitEscapeParrySparks?.(midX, 1.38, midZ, clCue === 1 ? 1.0 : 1.25);
      spawnSoulsClashSparks(midX, 1.38, midZ, 0, 0.55, 1, 'parry');
      emitParticles(midX, 1.38, midZ, 0xfde047, 18, 6.2, 0.14);
    }

    const disCue = Number(cues.disarmCue) || 0;
    if (disCue > souls.escapeCutsceneLastDisarmCue) {
      souls.escapeCutsceneLastDisarmCue = disCue;
      audio?.playSwordDisarmClatter?.();
      world?.addScreenShake?.(0.30, 0.16);
      world?.emitEscapeParrySparks?.(player.x + 0.35, 1.18, player.z - 0.3, 1.15);
      spawnSoulsClashSparks(player.x + 0.35, 1.18, player.z - 0.3, 0.65, 0.45, 0.4, 'parry');
      emitParticles(player.x + 0.35, 1.15, player.z - 0.3, 0xfef08a, 16, 5.4, 0.12);
    }

    const kdCue = Number(cues.knockdownCue) || 0;
    if (kdCue > souls.escapeCutsceneLastKnockdownCue) {
      souls.escapeCutsceneLastKnockdownCue = kdCue;
      audio?.playHeroKnockdownThud?.();
      world?.addScreenShake?.(0.38, 0.18);
      world?.emitEscapeDustImpact?.(player.x, 0.14, player.z, 1.15);
      emitParticles(player.x, 0.22, player.z, 0xd6d3d1, 12, 3.6, 0.12);
    }

    const scCue = Number(cues.scootCue) || 0;
    if (scCue > souls.escapeCutsceneLastScootCue) {
      souls.escapeCutsceneLastScootCue = scCue;
      audio?.playArmorScootScrape?.();
      world?.emitEscapeDustImpact?.(player.x, 0.08, player.z, 0.50);
    }

    const bsCue = Number(cues.bossStepCue) || 0;
    if (bsCue > souls.escapeCutsceneLastBossStepCue) {
      souls.escapeCutsceneLastBossStepCue = bsCue;
      audio?.playBossFootstep?.(0.15);
      world?.addScreenShake?.(0.12, 0.12);
      if (cutBoss) {
        emitParticles(cutBoss.x + (bsCue % 2 === 0 ? 0.35 : -0.35), 0.10, cutBoss.z + 0.25, 0xa8a29e, 7, 2.2, 0.10);
      }
    }

    const baCue = Number(cues.bossArmorCue) || 0;
    if (baCue > souls.escapeCutsceneLastBossArmorCue) {
      souls.escapeCutsceneLastBossArmorCue = baCue;
      audio?.playBossArmorShift?.(1.0);
    }

    const hrCue = Number(cues.heroRollCue) || 0;
    if (hrCue > souls.escapeCutsceneLastHeroRollCue) {
      souls.escapeCutsceneLastHeroRollCue = hrCue;
      audio?.playHeroRoll?.(false);
    }

    const smCue = Number(cues.slowMoCue) || 0;
    if (smCue > souls.escapeCutsceneLastSlowMoCue) {
      souls.escapeCutsceneLastSlowMoCue = smCue;
      audio?.playSlowMoPulse?.();
    }

    const fsCue = Number(cues.floorSmashCue) || 0;
    if (fsCue > souls.escapeCutsceneLastFloorSmashCue) {
      souls.escapeCutsceneLastFloorSmashCue = fsCue;
      audio?.playFloorCollapseSmash?.();
      world?.addScreenShake?.(1.10, 0.42);
      const hx = Number(escState.floorHoleX) || 0;
      const hz = Number(escState.floorHoleZ) ?? SOULS_CASTLE_CONSTANTS.BOSS_CENTER_Z;
      world?.emitEscapeFloorCollapseBurst?.(hx, 0.25, hz);
      emitParticles(hx, 0.32, hz, 0xf97316, 22, 6.8, 0.16);
      emitParticles(hx, 0.22, hz, 0x78716c, 22, 5.8, 0.15);
    }

    const wantWind =
      ((escState.stageMode === 'castle' && heroY < -1.5) ||
        (escState.stageMode === 'shaft_river' && (Number(cues.waterSplashCue) || 0) === 0));
    if (wantWind !== Boolean(souls.escapeChasmWindActive)) {
      souls.escapeChasmWindActive = wantWind;
      audio?.playChasmWindFall?.(wantWind);
    }

    const wsCue = Number(cues.waterSplashCue) || 0;
    if (wsCue > souls.escapeCutsceneLastWaterSplashCue) {
      souls.escapeCutsceneLastWaterSplashCue = wsCue;
      souls.escapeChasmWindActive = false;
      audio?.playChasmWindFall?.(false);
      audio?.playRiverSplashUnderwater?.();
      world?.emitEscapeWaterSplash?.(player.x, 0.15, player.z, 1.25);
      emitParticles(player.x, 0.35, player.z, 0xbae6fd, 22, 5.4, 0.14);
    }

    const gbCue = Number(cues.grateBreakCue) || 0;
    if (gbCue > souls.escapeCutsceneLastGrateBreakCue) {
      souls.escapeCutsceneLastGrateBreakCue = gbCue;
      audio?.playIronGrateBreak?.();
      world?.addScreenShake?.(0.55, 0.25);
      world?.emitEscapeGrateBreakBurst?.(player.x, 0.55, player.z + 0.8);
      emitParticles(player.x, 0.65, player.z + 0.8, 0xfef08a, 20, 6.2, 0.14);
      emitParticles(player.x, 0.45, player.z + 0.8, 0xbae6fd, 22, 5.8, 0.15);
    }

    const swCue = Number(cues.shoreWakeCue) || 0;
    if (swCue > souls.escapeCutsceneLastShoreWakeCue) {
      souls.escapeCutsceneLastShoreWakeCue = swCue;
      audio?.setSoulsAmbientActive?.(false, { nearBonfire: false });
      audio?.setExteriorShoreAmbient?.(true);
    }
  }

  function startBossEscapeCutscene(bossOverride = null) {
    if (!isSoulslike || !runActive || runEnded || playerDying) return false;
    if (souls.escapeCutsceneActive) return true;

    let cutBoss = bossOverride || enemies.find((en) => en && en.isSoulsBoss);
    if (!cutBoss) {
      // Allow replaying the escape cutscene cleanly even from the Exterior Shore!
      world?.setSoulsZoneMode?.('castle');
      world?.sealBossDoors?.();
      world?.setSoulsFogGate?.(true);
      cutBoss = spawnEnemy('boss_warden', 0, SOULS_CASTLE_CONSTANTS.BOSS_CENTER_Z - 2.0, null, {
        nameRu: 'Рыцарь Пепла — Судия Руин',
        hp: 1175,
        damage: 38,
        speed: 2.95,
        xp: 220,
        gold: 250,
        scale: 4.0,
        radius: 1.75,
        noEmerge: true,
        ignoreSpawnObstacles: true,
        isFinaleTarget: true,
        isSoulsUnit: true,
        isSoulsBoss: true,
        soulsThronePhase: 'done',
        staggerMax: SOULS_BOSS_MULTI_PARRY.staggerMax,
        flatDef: 22,
        physNegation: 0.10,
        aggroRange: 0
      });
      if (cutBoss?.model?.obj) {
        enhanceSoulsBossModel(cutBoss.model.obj);
      }
    }

    if (cutBoss) {
      cutBoss.hp = Math.max(1, cutBoss.hp);
      cutBoss._deadHandled = false;
      cutBoss.soulsThronePhase = 'done';
      cutBoss.soulsAwake = true;
      cutBoss.soulsState = 'cutscene';
      cutBoss.soulsActiveAttack = null;
      cutBoss._soulsActiveSwing = null;
      cutBoss.currentAttackMeta = null;
      cutBoss.staggeredTimer = 0;
      cutBoss.parriedRiposteTimer = 0;
      cancelSoulsBossTelegraph(cutBoss, elapsedRunTime);
      // Immediately clear any lingering hit-react/override & white hit-flash material so Boss renders in full dark Gothic iron PBR!
      cutBoss.model?.handle?.cancelHitReact?.();
      cutBoss.model?.handle?.setClipOverride?.(null);
      cutBoss.model?.handle?.update?.(0.30, false, 0, elapsedRunTime);
      if (cutBoss.model?.obj) {
        updateSoulsBossVisuals(cutBoss.model.obj, 0.50, {
          phase2Enraged: false,
          isWindup: false,
          isStaggered: false,
          mouthOpen01: 0,
          elapsed: elapsedRunTime
        });
      }
      bossEntity = cutBoss;
    }

    clearTargetLock();
    bossHazards.length = 0;
    activeBurningZones.length = 0;
    bomberHazards.length = 0;
    pendingMeleeStrikes.length = 0;
    meleeStepLunge = null;
    souls.activeAttack = null;
    souls.activeRiposte = null;
    souls.canRiposte = false;
    souls.riposteTarget = null;
    souls.isBlocking = false;
    souls.flaskDrinkTimer = 0;
    souls.flaskHealTimer = 0;
    souls.guardBreakTimer = 0;
    souls.doorCutsceneActive = false;
    souls.bossEscaped = false;
    souls.bossDefeated = false;
    souls.escapeCutsceneActive = true;
    souls.escapeCutsceneLastVoiceCue = 0;
    souls.escapeCutsceneLastClashCue = 0;
    souls.escapeCutsceneLastDisarmCue = 0;
    souls.escapeCutsceneLastKnockdownCue = 0;
    souls.escapeCutsceneLastScootCue = 0;
    souls.escapeCutsceneLastBossStepCue = 0;
    souls.escapeCutsceneLastBossArmorCue = 0;
    souls.escapeCutsceneLastHeroRollCue = 0;
    souls.escapeCutsceneLastSlowMoCue = 0;
    souls.escapeCutsceneLastFloorSmashCue = 0;
    souls.escapeCutsceneLastWaterSplashCue = 0;
    souls.escapeCutsceneLastGrateBreakCue = 0;
    souls.escapeCutsceneLastShoreWakeCue = 0;
    souls.escapeChasmWindActive = false;
    souls.canInteract = false;
    souls.canOpenBossDoors = false;
    soulsActionBuffer.clear();

    player.dashTimer = 0;
    player.hasHyperArmor = false;
    player.moveVelX = 0;
    player.moveVelZ = 0;
    resetActorPhysics(player);
    cancelPlayerTurn180(0.5);
    setModelBlocking(heroModel, false);
    heroModel?.handle?.cancelFlaskDrinkAnim?.();
    heroModel?.handle?.setDoorPushMode?.(false);
    heroModel?.handle?.setWeaponDisarmed?.(false, false);
    weaponTrails?.clearAll?.();
    hitStopTimer = 0;

    // Hide any remaining corridor mobs during escape sequence
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e && !e.isSoulsBoss && e.model?.obj) {
        e.model.obj.visible = false;
      }
    }

    audio?.stopBossRoar?.(0.08);
    audio?.stopBossIntroVoice?.(0.08);
    audio?.stopEscapeAudio?.(0.08);
    audio?.setExteriorShoreAmbient?.(false);
    audio?.setSoulsAmbientActive?.(true, { nearBonfire: false });
    audio?.setMusicMode?.('combat');

    const anchorX = Number.isFinite(cutBoss?.x) ? cutBoss.x : 0;
    const anchorZ = Number.isFinite(cutBoss?.z) ? cutBoss.z : SOULS_CASTLE_CONSTANTS.BOSS_CENTER_Z;
    ensureShoreRealSwordAttached();
    const initState = world?.startBossEscapeCutscene?.(anchorX, anchorZ);
    if (initState) {
      applyBossEscapeCutsceneState(initState, 0.016, elapsedRunTime, true);
      syncEscapeCutsceneUiImmediate(initState, true);
    }
    return Boolean(initState);
  }

  function skipBossEscapeCutscene(force = false) {
    if (!isSoulslike || !runActive || runEnded || playerDying) return false;
    if (!souls.escapeCutsceneActive && !world?.isBossEscapeCutsceneActive?.()) return false;
    const skipRes = world?.skipBossEscapeCutscene?.(force);
    if (!skipRes && !force && !souls.cutsceneCanSkip) {
      return false;
    }
    audio?.stopEscapeVoice?.(0.08);
    audio?.playChasmWindFall?.(false);
    finishBossEscapeCutsceneToShore(true);
    return true;
  }

  function seekBossEscapeCutscene(tSec = 0) {
    if (!souls.escapeCutsceneActive && !world?.isBossEscapeCutsceneActive?.()) {
      startBossEscapeCutscene();
    }
    const st = world?.seekBossEscapeCutscene?.(tSec);
    if (st) {
      applyBossEscapeCutsceneState(st, 0.016, elapsedRunTime, true);
      syncEscapeCutsceneUiImmediate(st, true);
    }
    return st;
  }

  function teleportToExteriorShore(opts = {}) {
    if (!isSoulslike || !runActive) return false;
    finishBossEscapeCutsceneToShore(true, opts);
    return true;
  }

  function skipBossDoorCutscene(force = false) {
    if (!isSoulslike || !runActive || runEnded || playerDying) return false;
    if (souls.escapeCutsceneActive || world?.isBossEscapeCutsceneActive?.()) {
      return skipBossEscapeCutscene(force);
    }
    if (!souls.doorCutsceneActive && !world?.isBossDoorCutsceneActive?.()) return false;
    const skipRes = world?.skipBossDoorCutscene?.(force, {
      x: 0,
      z: SOULS_CASTLE_CONSTANTS.BOSS_HERO_ENTRY_Z
    });
    if (!skipRes && !force && !souls.cutsceneCanSkip) {
      return false;
    }
    audio?.stopCinematicBossDoorSequence?.(0.08);
    audio?.stopBossIntroVoice?.(0.08);
    finishBossDoorCutsceneIntoCombat(true);
    return true;
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('grimborne-skip-cutscene', () => {
      if (isSoulslike && runActive && !runEnded && !playerDying) {
        if (souls.escapeCutsceneActive || world?.isBossEscapeCutsceneActive?.()) {
          skipBossEscapeCutscene(false);
        } else if (souls.doorCutsceneActive || world?.isBossDoorCutsceneActive?.()) {
          skipBossDoorCutscene(false);
        }
      }
    });
  }
  let endlessWave = 1;
  let endlessBossTimer = 45.0;
  let endlessBossCycleIdx = 0;
  let barrelRespawnTimer = 22.0;
  let cursedChestSpawnedThisStage = false;
  let cursedChestTimer = 24.0;
  const ENDLESS_BOSS_ROTATION = ['boss_troll', 'boss_butcher', 'boss_archlich', 'boss_cthulhu', 'boss_warden', 'boss_ashlord'];

  // Chapter 26 Boss Throne Seating & Entry Cutscene Trajectory (derived dynamically from soulsCastleLayout.js)
  const SOULS_THRONE_SIT_Z = SOULS_CASTLE_THRONE_CONFIG.sitZ;
  const SOULS_THRONE_RISE_Z = SOULS_CASTLE_THRONE_CONFIG.riseZ;
  const SOULS_THRONE_STAND_Z = SOULS_CASTLE_THRONE_CONFIG.standZ;
  const SOULS_THRONE_PAUSE_SEC = 1.5;
  const SOULS_THRONE_STANDUP_FALLBACK_SEC = 2.0;

  function getSoulsBossStandUpZ(u) {
    const t = Math.max(0, Math.min(1, u));
    const smooth = (v) => {
      const c = Math.max(0, Math.min(1, v));
      return c * c * (3 - 2 * c);
    };
    if (t <= 0.22) return SOULS_THRONE_SIT_Z;
    if (t <= 0.54) {
      const s = smooth((t - 0.22) / 0.32);
      return SOULS_THRONE_SIT_Z + (SOULS_THRONE_RISE_Z - SOULS_THRONE_SIT_Z) * s;
    }
    const s = smooth((t - 0.54) / 0.46);
    return SOULS_THRONE_RISE_Z + (SOULS_THRONE_STAND_Z - SOULS_THRONE_RISE_Z) * s;
  }

  function notifyDailyProgress(kind, delta = 1) {
    const completed = progression.recordDailyProgress?.(kind, delta);
    if (Array.isArray(completed) && completed.length > 0) {
      for (let i = 0; i < completed.length; i++) {
        const q = completed[i];
        callbacks?.onToast?.(`📜 Задание выполнено: ${q.titleRu} (+${q.rewardGold} 💰 в Хабе)`);
      }
    }
  }

  function computeRunXpNext(levelNum) {
    const n = Math.max(1, Number(levelNum) || 1);
    return Math.round(55 + (n - 1) * 42 + Math.pow(n - 1, 1.32) * 18);
  }

  // Debug/free-roam inspection: no enemies, no player damage.
  let freeRoamMode = false;

  let timeLeft = 65;
  let elapsedRunTime = 0;
  let spawnTimer = 0.45;
  let waveCount = 0;
  let lastWaveSector = 0;
  let relicCrateSpawned = false;
  let midMiniBossSpawned = false;
  let finaleStarted = false;
  let unlockedWeaponThisRun = null;

  let goldRun = 0;
  let kills = 0;
  let regularMobsSpawned = 0;
  let targetKills = 30;
  let levelSpawnQueue = [];
  let bossSpawnCountdown = 0;
  let nextEntityUid = 1;
  let critFloaterCooldown = 0;
  let shieldSparkCooldown = 0;
  let hitSoundCooldown = 0;
  let manaEmptyHintCooldown = 0;

  const DASH_DURATION = 0.20;
  const DASH_INVULN = 0.26;
  const DASH_COOLDOWN_MAX = 2.4;
  const DASH_SPEED_MULT = 3.1;
  const COMBO_RESET_TIME = 1.35;

  function getDashCooldownMax() {
    return +(DASH_COOLDOWN_MAX * (stats?.dashCooldownMult ?? 1.0)).toFixed(2);
  }

  let hitStopTimer = 0;
  let hitStopCooldown = 0;

  function triggerHitStop(duration = 0.036, force = false) {
    if (isSoulslike) {
      soulsGameFeel.triggerHitstop(duration, { force });
      return;
    }
    if (force) {
      hitStopTimer = Math.max(hitStopTimer, duration);
      hitStopCooldown = 0.09;
      return;
    }
    if (hitStopCooldown <= 0) {
      hitStopTimer = Math.max(hitStopTimer, duration);
      hitStopCooldown = 0.11;
    }
  }

  function emitSoulsSparkBurst(kind, x, z, dirX = 0, dirZ = 1) {
    const burst = getImpactSparkBurst(kind, { dirX, dirZ });
    if (!burst) return null;
    const fwdOff = burst.directional?.forwardOffset || 0;
    const dLen = Math.hypot(dirX, dirZ);
    const nx = dLen > 1e-4 ? dirX / dLen : 0;
    const nz = dLen > 1e-4 ? dirZ / dLen : 1;
    const px = x + nx * fwdOff;
    const pz = z + nz * fwdOff;
    if (burst.primary) {
      emitParticles(px, burst.primary.yOffset, pz, burst.primary.color, burst.primary.count, burst.primary.speed, burst.primary.size);
    }
    if (burst.secondary) {
      emitParticles(px, burst.secondary.yOffset, pz, burst.secondary.color, burst.secondary.count, burst.secondary.speed, burst.secondary.size);
    }
    if (burst.shockwave) {
      emitShockwave(x, z, burst.shockwave.radius, burst.shockwave.color, burst.shockwave.duration);
    }
    if (burst.kickIntensity > 0) {
      soulsGameFeel.triggerKick(nx, nz, burst.kickIntensity);
    }
    return burst;
  }

  let player = {
    x: 0,
    z: 0,
    facing: 0,
    hp: 145,
    maxHp: 145,
    radius: 0.58,
    recoilVx: 0,
    recoilVz: 0,
    ammo: 0,
    maxAmmo: 0,
    mana: 0,
    maxMana: 0,
    reloadTimer: 0,
    reloadDuration: 0,
    reloadShellAccum: 0,
    isReloading: false,
    reloadMidShellPlayed: false,
    standStillTimer: 0,
    invulnTimer: 0,
    dashTimer: 0,
    dashCooldown: 0,
    dashInvulnTimer: 0,
    dashDirX: 0,
    dashDirZ: 1,
    dashTrailAccum: 0,
    dashFireTrailAccum: 0,
    comboStep: 0,
    comboTimer: 0,
    attackCooldown: 0,
    attackAnimTimer: 0,
    seals: 0,
    beastReady: false,
    beastTimeLeft: 0,
    overdriveAmmo: 0,
    overdriveMax: 5,
    vampiricKills: 0,
    vampiricHarvestKills: 0,
    soulNovaTimer: 9.0,
    relicBumpTimer: 0,
    microStunTimer: 0,
    microStunDuration: 0,
    microStunElapsed: 0,
    microStunCancelableAfter: 0.16,
    microStunMoveMult: 1.0,
    flinchCooldown: 0
  };

  let heroModel = null;
  let overdriveCrateVisual = null;
  let companion = null;
  let enemies = [];
  let projectiles = [];
  let pickups = [];
  let bossHazards = [];
  let activeBurningZones = [];
  let bomberHazards = [];
  let fireTrailPatches = [];
  let bossEntity = null;
  let lockedEnemy = null;
  const LOCK_ON_ACQUIRE_RADIUS = 22.0;
  const LOCK_ON_BREAK_RADIUS = 26.0;
  let dyingCorpses = [];
  let activeWaterPrisons = [];
  let pendingMeteors = [];
  let pendingMeleeStrikes = [];
  let meleeStepLunge = null;
  let shrapnelMines = [];
  let orbitBladesGroup = null;
  let orbitBladeMeshes = [];

  function computeRunStats() {
    const computed = progression.computeCombatStats(currentClassId, currentWeaponId, {
      weaponRunLevel,
      perks
    });
    if (!isSoulslike) return computed;
    const clsDef = CLASSES[currentClassId] || CLASSES.warrior;
    const wpnDef = WEAPONS[currentWeaponId] || WEAPONS[clsDef.starterWeapon] || WEAPONS.club;
    // Balanced Souls Attack Rating (AR) for the 5-piece Elden Ring ATK/FlatDEF curve:
    //   baseDamage=15 ('club' Oath Broadsword) -> baseAR=62 -> ~5-6 R1s Hollow Guard, ~3-4 Footman, ~23 R1s Boss (faster w/ R2/Riposte/Counter)
    const soulsBaseAR = Math.max(42, Math.round((wpnDef.baseDamage || wpnDef.damage || 15) * 4.15));
    return {
      ...computed,
      maxHp: clsDef.baseHp || 150,
      moveSpeed: Math.max(4.1, Math.min(4.85, (clsDef.moveSpeed || 4.4) * (wpnDef.moveSpeedMult || 1.0) * 1.05)),
      damageBlock: 0,
      blockChance: 0,
      dodgeChance: 0,
      damage: soulsBaseAR,
      cooldown: wpnDef.cooldown || 0.67,
      range: wpnDef.range || 1.25,
      arcAngle: wpnDef.arcAngle || Math.PI * 0.6,
      armorPierce: wpnDef.armorPierce || 0,
      knockback: wpnDef.knockback || 3.5,
      critChance: 0.08,
      critMult: 1.65,
      goldMult: 1.0,
      warOrbitStacks: 0,
      warWhirlwindStacks: 0,
      warBloodStacks: 0,
      warBannerStacks: 0,
      warThornsStacks: 0,
      warSeismicStacks: 0,
      mageMeteorStacks: 0,
      mageWardStacks: 0,
      mageTwinStacks: 0,
      mageCatalystStacks: 0,
      gunMineStacks: 0,
      gunReloadStacks: 0,
      gunRicochetStacks: 0,
      gunExplosiveStacks: 0,
      dashFireTrailStacks: 0,
      shieldThornsStacks: 0,
      critChainStacks: 0,
      vampiricHarvestStacks: 0
    };
  }

  function recomputeStats() {
    stats = computeRunStats();
    player.maxHp = stats.maxHp;
    if (player.hp > player.maxHp) {
      player.hp = player.maxHp;
    }

    const prevMaxMana = player.maxMana || 0;
    player.maxMana = stats.usesMana ? (stats.maxMana || 120) : 0;
    if (player.maxMana <= 0) {
      player.mana = 0;
    } else {
      const manaGain = Math.max(0, player.maxMana - prevMaxMana);
      player.mana = Math.min(player.maxMana, (player.mana || 0) + manaGain);
    }

    player.maxAmmo = stats.magSize || 0;
    player.reloadDuration = stats.reloadTime || 0;
    if (player.maxAmmo <= 0) {
      player.ammo = 0;
      if (player.isReloading) {
        player.isReloading = false;
        player.reloadTimer = 0;
        syncHeroReloadModel(false);
      }
    } else if (player.ammo > player.maxAmmo) {
      player.ammo = player.maxAmmo;
    }
  }

  function floatText(text, x, z, color = '#ffffff') {
    callbacks?.onFloatingText?.(text, x, z, color);
  }

  // === Manual [R] & Automatic Magazine Reload ===
  function triggerReload() {
    if (isSoulslike) return false;
    if (!runActive || runEnded || playerDying || awaitingLevelUpChoice) return false;
    if (!stats || !(stats.magSize > 0)) return false;
    if (player.isReloading) return false;
    if (player.ammo >= player.maxAmmo) return false;
    if (player.overdriveAmmo > 0 || player.beastTimeLeft > 0) return false;

    const wpn = WEAPONS[currentWeaponId] || WEAPONS.club;
    player.isReloading = true;
    const perShell = stats.reloadPerShellTime || 0;
    if (perShell > 0) {
      const missingShells = Math.max(1, player.maxAmmo - player.ammo);
      player.reloadDuration = Math.max(perShell, +(missingShells * perShell).toFixed(3));
    } else {
      player.reloadDuration = Math.max(0.25, stats.reloadTime || wpn.reloadTime || 1.2);
    }
    player.reloadTimer = player.reloadDuration;
    player.reloadShellAccum = 0;
    player.reloadMidShellPlayed = false;

    audio?.playReloadShell?.();
    syncHeroReloadModel(true);

    // Пороховой Рывок (gun_tactical_reload): blast nearby enemies away & grant +35% sprint!
    const tacReloadStacks = stats.gunReloadStacks || 0;
    if (tacReloadStacks > 0) {
      player.sprintTimer = 1.6;
      const blastDmg = Math.round(stats.damage * (0.85 + tacReloadStacks * 0.45));
      emitShockwave(player.x, player.z, 3.6, 0x34d399, 0.30);
      emitParticles(player.x, 0.7, player.z, 0xfbbf24, 12, 6.0, 0.14);
      damageEnemiesInRadius(player.x, player.z, 3.6, blastDmg, 13.5, null, false);
    }
    return true;
  }

  // === Cleanup ===
  function disposeRun() {
    runActive = false;
    runEnded = false;
    victoryDelayTimer = 0;
    pendingVictoryPayload = null;
    playerDying = false;
    deathModalDelay = 0;
    pendingDefeatPayload = null;
    hitStopTimer = 0;
    hitStopCooldown = 0;

    if (heroModel) {
      syncHeroReloadModel(false);
      removeSceneObject(heroModel.obj, heroModel.handle);
      heroModel = null;
    }
    if (player) player.mesh = null;
    if (overdriveCrateVisual) {
      removeSceneObject(overdriveCrateVisual, overdriveCrateVisual);
      overdriveCrateVisual = null;
    }
    if (companion) {
      removeSceneObject(companion.model.obj, companion.model.handle);
      companion = null;
    }
    for (let i = 0; i < enemies.length; i++) {
      if (enemies[i]?.isSoulsBoss) {
        cancelSoulsBossTelegraph(enemies[i], elapsedRunTime);
        if (enemies[i].model?.obj) {
          disposeSoulsBossVisuals(enemies[i].model.obj);
        }
        Object.assign(enemies[i], {
          soulsPunishWindow: null,
          soulsPunishTimer: 0,
          soulsPunishDmgMult: 1.0,
          soulsPunishStaggerMult: 1.0,
          soulsPunishTagShown: false,
          soulsChainCount: 0,
          soulsLastHitAt: -99
        });
      }
      removeSceneObject(enemies[i].model.obj, enemies[i].model.handle);
    }
    enemies = [];
    lastFrameElapsedTime = 0;

    for (let i = 0; i < projectiles.length; i++) {
      removeSceneObject(projectiles[i].vis.obj, projectiles[i].vis.handle);
    }
    projectiles = [];

    for (let i = 0; i < pickups.length; i++) {
      disposePickupClonedMaterials(pickups[i]);
      removeSceneObject(pickups[i].model.obj, pickups[i].model.handle);
    }
    pickups = [];

    bossHazards = [];
    activeBurningZones = [];
    bomberHazards = [];
    fireTrailPatches = [];
    bossEntity = null;
    lockedEnemy = null;
    world?.setLockOnTarget?.(null);
    activeWaterPrisons = [];
    pendingMeteors = [];
    pendingMeleeStrikes = [];
    meleeStepLunge = null;
    resetSoulsControllers(false);
    resetActorPhysics(player);
    disposeSoulsWeaponTrails();
    disposeSoulsDissolveAsh();
    if (bossEntity?.model?.handle?.setBossMouthOpen) {
      bossEntity.model.handle.setBossMouthOpen(0);
    }
    audio?.stopBossRoar?.(0.08);
    audio?.stopCinematicBossDoorSequence?.(0.08);
    audio?.stopBossIntroVoice?.(0.08);
    audio?.stopEscapeAudio?.(0.08);
    audio?.updateSoulsSpatial?.(0, 0, 0, false, false, 0);
    audio?.setSoulsAmbientActive?.(false, { nearBonfire: false });
    disposeDroppedSwordProp();
    world?.setSoulsZoneMode?.('castle');
    isEndless = false;
    endlessWave = 1;
    endlessBossTimer = 45.0;
    endlessBossCycleIdx = 0;
    barrelRespawnTimer = 22.0;
    cursedChestSpawnedThisStage = false;
    cursedChestTimer = 24.0;
    runXp = 0;
    runXpNext = computeRunXpNext(1);
    runPerkLevel = 1;

    for (let i = 0; i < dyingCorpses.length; i++) {
      if (dyingCorpses[i]?.isSoulsBoss && dyingCorpses[i].model?.obj) {
        disposeSoulsBossVisuals(dyingCorpses[i].model.obj);
      }
      removeSceneObject(dyingCorpses[i].model.obj, dyingCorpses[i].model.handle);
    }
    dyingCorpses = [];

    for (let i = 0; i < shrapnelMines.length; i++) {
      if (shrapnelMines[i].mesh?.parent) shrapnelMines[i].mesh.parent.remove(shrapnelMines[i].mesh);
    }
    shrapnelMines = [];

    if (orbitBladesGroup) {
      if (orbitBladesGroup.parent) orbitBladesGroup.parent.remove(orbitBladesGroup);
      orbitBladesGroup = null;
      orbitBladeMeshes = [];
    }
  }

  // === Start Run ===
  function startRun({
    classId,
    levelNumber,
    difficultyMode,
    endless = false,
    startAtBossArena = false,
    startAtExteriorShore = false,
    restoreShoreSword = false,
    restoreShoreBonfire = false,
    resetCheckpoint = false,
    restoreBonfireCheckpoint = false
  } = {}) {
    disposeRun();

    world?.resetVfx?.();
    world?.setBossAtmosphere?.(false);
    lockedEnemy = null;
    world?.setLockOnTarget?.(null);

    currentClassId = CLASSES[classId] ? classId : progression.getState().selectedClass || 'warrior';
    currentDifficulty = difficultyMode === 'hard' ? 'hard' : 'normal';
    isEndless = Boolean(endless);
    endlessWave = 1;
    endlessBossTimer = 45.0;
    endlessBossCycleIdx = 0;
    barrelRespawnTimer = 22.0;
    cursedChestSpawnedThisStage = false;
    cursedChestTimer = isEndless ? 65.0 : 24.0;

    if (isEndless) {
      const fullPool = (LEVELS.find((l) => l.level === 25) || LEVELS[LEVELS.length - 1])?.enemyPool || ['plague_zombie', 'toxic_slime', 'corrupted_treant', 'ember_skeleton', 'dark_cultist'];
      isSoulslike = false;
      currentLevelDef = {
        level: 0,
        act: 1,
        nameRu: 'Бесконечная Орда',
        shortTitleRu: 'Бесконечная Орда',
        durationSec: 999999,
        spawnInterval: 0.9,
        hpScale: 1.0,
        dmgScale: 1.0,
        enemyPool: fullPool,
        miniBossPool: fullPool,
        finaleMiniBossType: null,
        hasBoss: false,
        hasEliteFinale: false,
        targetKills: 999999,
        enemyQuotas: null,
        unlockWeaponTier: null
      };
      currentLevelNumber = 0;
      world?.setArenaBiome?.(resolveArenaBiomeForLevel(Number(levelNumber) || 1), Number(levelNumber) || 1);
    } else {
      const reqLvl = Number(levelNumber) || 1;
      currentLevelDef = getLevelDef(reqLvl);
      currentLevelNumber = currentLevelDef.level;
      isSoulslike = Boolean(currentLevelDef?.isSoulslike);
      world?.setArenaBiome?.(resolveArenaBiomeForLevel(currentLevelNumber), currentLevelNumber);
    }
    resetSoulsControllers(true);
    if (isSoulslike) {
      attackEnabled = false;
    }

    // Abandoned Knight Rift uses the class's base starter weapon (Warrior: 'club' Oath Broadsword + Shield)
    // and clean base HP/damage stats, completely isolated from PvE Arsenal & Workshop upgrades.
    const starterWeaponId = CLASSES[currentClassId]?.starterWeapon || 'club';
    currentWeaponId = isSoulslike ? starterWeaponId : progression.getEquippedWeaponId(currentClassId);
    const progInit = progression.getState();
    runLevel = progInit.heroLevel || 1;
    xp = progInit.heroXp || 0;
    xpFraction = 0;
    xpNext = progInit.heroXpNext || 95;
    runXp = 0;
    runPerkLevel = 1;
    runXpNext = computeRunXpNext(1);
    pendingLevelUps = 0;
    awaitingLevelUpChoice = false;

    weaponRunLevel = 1;
    perks = Object.create(null);
    stats = computeRunStats();

    const startSpot = resolveObstaclesAndBounds(0, 0, 0.75, ARENA_PLAYER_LIMIT);
    const initialMag = stats.magSize || 0;
    const initialMana = stats.usesMana ? (stats.maxMana || 120) : 0;
    targetKills = isEndless ? 999999 : (currentLevelDef.targetKills || (26 + currentLevelNumber * 4));
    bossSpawnCountdown = !isEndless && currentLevelDef.hasBoss ? (currentLevelDef.bossSpawnTimerSec || 45) : 0;
    levelSpawnQueue = [];
    if (!isEndless && currentLevelDef.enemyQuotas) {
      for (const [eType, qty] of Object.entries(currentLevelDef.enemyQuotas)) {
        for (let q = 0; q < (qty || 0); q++) {
          levelSpawnQueue.push(eType);
        }
      }
      for (let i = levelSpawnQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = levelSpawnQueue[i];
        levelSpawnQueue[i] = levelSpawnQueue[j];
        levelSpawnQueue[j] = tmp;
      }
    }
    player = {
      x: startSpot.x,
      z: startSpot.z,
      facing: 0,
      hp: stats.maxHp,
      maxHp: stats.maxHp,
      radius: 0.58,
      recoilVx: 0,
      recoilVz: 0,
      ammo: initialMag,
      maxAmmo: initialMag,
      mana: initialMana,
      maxMana: initialMana,
      reloadTimer: 0,
      reloadDuration: stats.reloadTime || 0,
      reloadShellAccum: 0,
      isReloading: false,
      reloadMidShellPlayed: false,
      standStillTimer: 0,
      invulnTimer: 1.0,
      dashTimer: 0,
      dashCooldown: 0,
      dashInvulnTimer: 0,
      dashDirX: 0,
      dashDirZ: 1,
      dashTrailAccum: 0,
      dashFireTrailAccum: 0,
      comboStep: 0,
      comboTimer: 0,
      attackCooldown: 0,
      attackAnimTimer: 0,
      seals: 0,
      beastReady: false,
      beastTimeLeft: 0,
      overdriveAmmo: 0,
      overdriveMax: 5,
      vampiricKills: 0,
      vampiricHarvestKills: 0,
      soulNovaTimer: 9.0,
      relicBumpTimer: 0,
      sprintTimer: 0,
      meleeSwingCount: 0,
      gunShotCount: 0,
      mageCastCount: 0,
      whirlwindTimer: 4.5,
      meteorTimer: 3.2,
      mineTimer: 4.2,
      arcaneWardReady: false,
      arcaneWardTimer: 2.0,
      orbitHitTimers: new Map(),
      prevMoveDirX: 0,
      prevMoveDirZ: 0,
      runMomentumTime: 0,
      turn180Cooldown: 0,
      turn180Active: false,
      turn180StartFacing: 0,
      turn180Delta: 0,
      turn180TargetFacing: 0,
      microStunTimer: 0,
      microStunDuration: 0,
      microStunElapsed: 0,
      microStunCancelableAfter: 0.16,
      microStunMoveMult: 1.0,
      flinchCooldown: 0,
      _groundBurnTickCd: 0
    };
    poiseCtrl.resetEntityPoise(player, { isPlayer: true });

    heroModel = buildHeroModel(currentClassId, currentWeaponId);
    heroModel?.handle?.setDeadState?.(false);
    player.mesh = heroModel.obj;
    const initHeroGroundY = sampleSmoothGroundY(player, player.x, player.z, 0, true);
    heroModel.obj.position.set(player.x, initHeroGroundY, player.z);
    heroModel.obj.rotation.y = player.facing;
    syncFollowTarget(player.x, player.z, heroModel.obj);

    timeLeft = currentLevelDef.durationSec;
    elapsedRunTime = 0;
    spawnTimer = 0.35;
    waveCount = 0;
    lastWaveSector = Math.floor(Math.random() * 4);
    relicCrateSpawned = false;
    midMiniBossSpawned = false;
    finaleStarted = false;
    unlockedWeaponThisRun = null;
    goldRun = 0;
    kills = 0;
    regularMobsSpawned = 0;
    critFloaterCooldown = 0;
    shieldSparkCooldown = 0;
    runEnded = false;
    runActive = true;

    // Spawn 3 interactive explosive powder barrels around the arena
    if (isSoulslike) {
      ensureSoulsWeaponTrails();
      ensureSoulsDissolveAsh();
      weaponTrails?.clearAll?.();
      dissolveAsh?.clearAll?.();
      resetSoulsPackCoordinator();
      resetActorPhysics(player);
      const bossRematch = Boolean(startAtBossArena);
      if (startAtExteriorShore) {
        resetSoulsControllers(true);
        player.hp = player.maxHp;
        souls.flasks = souls.flasksMax;
        playerDying = false;
        deathModalDelay = 0;
        pendingDefeatPayload = null;
        poiseCtrl.resetEntityPoise(player, { isPlayer: true });
        heroModel?.handle?.setDeadState?.(false);
        heroModel?.obj?.userData?.setDeadState?.(false);
        finishBossEscapeCutsceneToShore(true, {
          withSword: Boolean(restoreShoreSword),
          bonfireLit: Boolean(restoreShoreBonfire)
        });
      } else if (bossRematch) {
        // Stake of Marika — Instant 1v1 Boss Arena Rematch (skip corridor mobs & Intro Cutscene!)
        player.x = 0;
        player.z = SOULS_CASTLE_CONSTANTS.BOSS_HERO_ENTRY_Z;
        player.facing = Math.PI;
        player.hp = player.maxHp;
        player.hasHyperArmor = false;
        resetSoulsControllers(false);
        souls.flasks = souls.flasksMax;
        souls.bossIntroPlayed = true;
        souls.bossAwakened = true;
        souls.zoneTitleRu = 'Тронный Зал';
        playerDying = false;
        deathModalDelay = 0;
        pendingDefeatPayload = null;
        poiseCtrl.resetEntityPoise(player, { isPlayer: true });
        heroModel?.handle?.setDeadState?.(false);
        heroModel?.obj?.userData?.setDeadState?.(false);
        if (heroModel?.obj) {
          const rematchGroundY = sampleSmoothGroundY(player, player.x, player.z, 0, true);
          heroModel.obj.position.set(player.x, rematchGroundY, player.z);
          heroModel.obj.rotation.y = player.facing;
        }
        syncFollowTarget(player.x, player.z, heroModel?.obj);
        world?.sealBossDoors?.();
        world?.resetCandles?.();
        world?.setSoulsFogGate?.(true);
        world?.setBossAtmosphere?.(true);
        audio?.setSoulsAmbientActive?.(true, { nearBonfire: false });
        audio?.setMusicMode?.('boss');

        const soulsBossSpawn = spawnEnemy('boss_warden', 0, SOULS_THRONE_SIT_Z, null, {
          nameRu: 'Рыцарь Пепла — Судия Руин',
          hp: 1175,
          damage: 38,
          speed: 2.95,
          xp: 220,
          gold: 250,
          scale: 4.0,
          radius: 1.75,
          noEmerge: true,
          ignoreSpawnObstacles: true,
          isFinaleTarget: true,
          isSoulsUnit: true,
          isSoulsBoss: true,
          soulsThronePhase: 'pause',
          staggerMax: SOULS_BOSS_MULTI_PARRY.staggerMax,
          flatDef: 22,
          physNegation: 0.10,
          aggroRange: 0
        });
        if (soulsBossSpawn) {
          soulsBossSpawn.x = 0;
          soulsBossSpawn.z = SOULS_THRONE_SIT_Z;
          soulsBossSpawn.facing = 0;
          soulsBossSpawn.stagger = 0;
          soulsBossSpawn.staggeredTimer = 0;
          soulsBossSpawn.staggerImmunityTimer = 0;
          soulsBossSpawn.soulsThronePhase = 'pause';
          soulsBossSpawn.soulsThroneTimer = SOULS_THRONE_PAUSE_SEC;
          soulsBossSpawn.soulsThroneElapsed = 0;
          soulsBossSpawn.soulsAwake = false;
          soulsBossSpawn.soulsPunishWindow = null;
          soulsBossSpawn.soulsPunishTimer = 0;
          soulsBossSpawn.soulsPunishDmgMult = 1.0;
          soulsBossSpawn.soulsPunishStaggerMult = 1.0;
          soulsBossSpawn.soulsPunishTagShown = false;
          soulsBossSpawn.soulsChainCount = 0;
          soulsBossSpawn.soulsLastHitAt = -99;
          poiseCtrl.resetEntityPoise(soulsBossSpawn);
          if (soulsBossSpawn.model?.obj) {
            soulsBossSpawn.model.obj.position.set(0, 0, SOULS_THRONE_SIT_Z);
            soulsBossSpawn.model.obj.rotation.y = 0;
            enhanceSoulsBossModel(soulsBossSpawn.model.obj);
          }
          soulsBossSpawn.model?.handle?.setClipOverride?.('Throne_Sit', 1.0, true);
          bossEntity = soulsBossSpawn;
          emitShockwave(soulsBossSpawn.x, soulsBossSpawn.z, 7.5, 0xf59e0b, 0.55);
          emitParticles(soulsBossSpawn.x, 1.4, soulsBossSpawn.z, 0xfbbf24, 24, 6.8, 0.16);
        }
        floatText('РЕВАНШ НА АРЕНЕ • СУДИЯ РУИН ПРОБУЖДАЕТСЯ!', player.x, player.z - 1.2, '#e2b768');
      } else {
        // Chapter 26 Dark Souls / Elden Ring: spawn in Awakening Hall (Zone 1) or at lit Pre-Boss Bonfire Checkpoint (Zone 5)!
        const keepCheckpoint = resetCheckpoint
          ? false
          : Boolean(restoreBonfireCheckpoint || souls.bonfireCheckpointLit);
        resetSoulsControllers(true);
        souls.bonfireCheckpointLit = keepCheckpoint;
        const spawnAnchor = keepCheckpoint ? getBonfireCheckpointSpawn() : SOULS_CASTLE_PLAYER_SPAWN;
        player.x = spawnAnchor.x;
        player.z = spawnAnchor.z;
        player.facing = Number.isFinite(spawnAnchor.facing) ? spawnAnchor.facing : Math.PI;
        if (heroModel?.obj) {
          const rematchGroundY = sampleSmoothGroundY(player, player.x, player.z, 0, true);
          heroModel.obj.position.set(player.x, rematchGroundY, player.z);
          heroModel.obj.rotation.y = player.facing;
        }
        syncFollowTarget(player.x, player.z, heroModel?.obj);
        world?.resetBossDoors?.(false);
        world?.resetCandles?.();
        world?.setSoulsFogGate?.(false);
        for (let ri = 0; ri < SOULS_CASTLE_RELICS.length; ri++) {
          world?.setShrineClaimed?.(SOULS_CASTLE_RELICS[ri].id, false);
        }

        // Handcrafted compact-castle Souls encounters (Courtyard, Corridor, East Alcove Armory & Archer)
        for (let ei = 0; ei < SOULS_CASTLE_ENCOUNTERS.length; ei++) {
          const enc = SOULS_CASTLE_ENCOUNTERS[ei];
          const mob = spawnEnemy(enc.type, enc.x, enc.z, null, {
            nameRu: enc.nameRu,
            hp: enc.hp,
            damage: enc.damage,
            speed: enc.speed,
            xp: enc.xp,
            gold: enc.gold,
            scale: enc.scale,
            noEmerge: true,
            isSoulsUnit: true,
            soulsRole: enc.soulsRole,
            staggerMax: enc.staggerMax,
            flatDef: enc.flatDef,
            physNegation: enc.physNegation,
            aggroRange: enc.aggroRange
          });
          if (mob) {
            mob.soulsEncounterId = enc.id;
            mob.soulsRoomId = enc.roomId;
            mob.isOptionalSoulsMob = Boolean(enc.isOptional);
            mob.isAmbushGuard = Boolean(enc.isAmbushGuard);
            mob.ambushId = enc.ambushId || null;
            mob.ambushTriggerBounds = enc.ambushTriggerBounds || null;
            mob.aggroBounds = enc.aggroBounds || null;
            initSoulsMobState(mob, {
              isAmbushGuard: Boolean(enc.isAmbushGuard),
              patrolHomeX: enc.x,
              patrolHomeZ: enc.z
            });
            mob.facing = Number.isFinite(enc.facing) ? enc.facing : 0;
            if (mob.model?.obj) {
              mob.model.obj.rotation.y = mob.facing;
            }
          }
        }

        const soulsBossSpawn = spawnEnemy('boss_warden', 0, SOULS_THRONE_SIT_Z, null, {
          nameRu: 'Рыцарь Пепла — Судия Руин',
          hp: 1175,
          damage: 38,
          speed: 2.95,
          xp: 220,
          gold: 250,
          scale: 4.0,
          radius: 1.75,
          noEmerge: true,
          ignoreSpawnObstacles: true,
          isFinaleTarget: true,
          isSoulsUnit: true,
          isSoulsBoss: true,
          soulsThronePhase: 'sitting',
          staggerMax: SOULS_BOSS_MULTI_PARRY.staggerMax,
          flatDef: 22,
          physNegation: 0.10,
          aggroRange: 0
        });
        if (soulsBossSpawn) {
          soulsBossSpawn.x = 0;
          soulsBossSpawn.z = SOULS_THRONE_SIT_Z;
          soulsBossSpawn.facing = 0;
          if (soulsBossSpawn.model?.obj) {
            soulsBossSpawn.model.obj.position.set(0, 0, SOULS_THRONE_SIT_Z);
            soulsBossSpawn.model.obj.rotation.y = 0;
            enhanceSoulsBossModel(soulsBossSpawn.model.obj);
          }
          soulsBossSpawn.model?.handle?.setClipOverride?.('Throne_Sit', 1.0, true);
        }
        audio?.setSoulsAmbientActive?.(true, { nearBonfire: true });
        audio?.setMusicMode?.('combat');
        const isCompactMobile =
          typeof window !== 'undefined' &&
          (window.innerWidth <= 960 || window.matchMedia?.('(pointer: coarse)')?.matches);
        floatText(
          isCompactMobile
            ? `🔥 ${keepCheckpoint ? 'СВЯТИЛИЩЕ КОСТРА' : 'ЗАЛ ПРОБУЖДЕНИЯ'} • Иди на север`
            : `🔥 ${keepCheckpoint ? 'СВЯТИЛИЩЕ КОСТРА (ЧЕКПОИНТ)' : 'ЗАЛ ПРОБУЖДЕНИЯ'} • [ЛКМ] Удар • [F] Выпад • [Space] Перекат • [M4/ПКМ] Парир. • [R] Фляга • [E] Взаимодействие`,
          player.x,
          player.z - 1.2,
          '#fbbf24'
        );
      }
    } else if (!freeRoamMode) {
      const baseAng = Math.random() * TWO_PI;
      for (let b = 0; b < 3; b++) {
        spawnExplosiveBarrel(baseAng + (b / 3) * TWO_PI);
      }
    } else {
      // Free-roam mode: spawn 1 stationary immortal training dummy in front of the hero
      // so the player can freely test weapons, combos, crits and hit reactions without mob waves.
      spawnEnemy('ember_skeleton', 0, -3.5, null, {
        nameRu: 'Тренировочная мишень',
        hp: 99999,
        damage: 0,
        speed: 0,
        xp: 0,
        gold: 0,
        scale: 1.15,
        noEmerge: true,
        isTrainingDummy: true
      });
    }
  }

  // === Tactical Ground Pickups & Crates ONLY (ZERO floor coins & ZERO floor XP orbs!) ===
  function spawnPickup(type, x, z, extra = {}) {
    // Strictly block any floor XP or Gold pickups — XP & Gold are awarded directly!
    if (type === 'xp' || type === 'gold') return null;

    const pos = resolveObstaclesAndBounds(x, z, 0.55, ARENA_ENTITY_LIMIT);
    const model = buildPickupModel(type, {
      weaponId: extra.targetWeaponId || null,
      classId: currentClassId,
      tier: currentLevelDef.unlockWeaponTier || 2
    });
    model.obj.position.set(pos.x, 0, pos.z);

    const isBarrel = type === 'explosive_barrel';
    const isCursedChest = type === 'cursed_chest';
    const isCrate = type.includes('crate');
    const entity = {
      uid: nextEntityUid++,
      type,
      x: pos.x,
      z: pos.z,
      radius: isBarrel ? 0.82 : isCursedChest ? 0.92 : type === 'relic_weapon_crate' ? 1.05 : isCrate ? 0.85 : 0.45,
      hp: isBarrel || isCursedChest ? 1 : isCrate ? 3 : 1,
      maxHp: isBarrel || isCursedChest ? 1 : isCrate ? 3 : 1,
      value: extra.value ?? 1,
      targetWeaponId: extra.targetWeaponId || null,
      age: 0,
      hitWobble: 0,
      model
    };
    pickups.push(entity);
    return entity;
  }

  function spawnExplosiveBarrel(preferredAngle = null) {
    let activeBarrels = 0;
    for (let i = 0; i < pickups.length; i++) {
      if (pickups[i]?.type === 'explosive_barrel' && pickups[i].hp > 0) activeBarrels += 1;
    }
    if (activeBarrels >= 4) return null;

    const lim = Math.max(8, ARENA_ENTITY_LIMIT - 2.4);
    let chosenSpot = null;
    for (let attempt = 0; attempt < 14; attempt++) {
      const ang =
        preferredAngle !== null && attempt === 0
          ? preferredAngle
          : Math.random() * TWO_PI;
      const dist = 6.2 + Math.random() * 7.2;
      const rx = clamp(player.x + Math.sin(ang) * dist, -lim, lim);
      const rz = clamp(player.z + Math.cos(ang) * dist, -lim, lim);
      const spot = resolveObstaclesAndBounds(rx, rz, 1.05, lim);
      if (Math.hypot(spot.x - player.x, spot.z - player.z) < 4.2) continue;
      let tooClose = false;
      for (let i = 0; i < pickups.length; i++) {
        const other = pickups[i];
        if (!other || other.hp <= 0) continue;
        if (Math.hypot(other.x - spot.x, other.z - spot.z) < 3.4) {
          tooClose = true;
          break;
        }
      }
      if (!tooClose) {
        chosenSpot = spot;
        break;
      }
    }
    if (!chosenSpot) return null;
    return spawnPickup('explosive_barrel', chosenSpot.x, chosenSpot.z);
  }

  function spawnCursedChest() {
    if (isSoulslike) return null;
    for (let i = 0; i < pickups.length; i++) {
      if (pickups[i]?.type === 'cursed_chest' && pickups[i].hp > 0) return null;
    }
    const lim = Math.max(8, ARENA_ENTITY_LIMIT - 2.6);
    let chosenSpot = null;
    for (let attempt = 0; attempt < 16; attempt++) {
      const ang = Math.random() * TWO_PI;
      const dist = 6.8 + Math.random() * 5.7;
      const rx = clamp(player.x + Math.sin(ang) * dist, -lim, lim);
      const rz = clamp(player.z + Math.cos(ang) * dist, -lim, lim);
      const spot = resolveObstaclesAndBounds(rx, rz, 1.15, lim);
      if (Math.hypot(spot.x - player.x, spot.z - player.z) < 4.8) continue;
      let tooClose = false;
      for (let i = 0; i < pickups.length; i++) {
        const other = pickups[i];
        if (!other || other.hp <= 0) continue;
        if (Math.hypot(other.x - spot.x, other.z - spot.z) < 3.0) {
          tooClose = true;
          break;
        }
      }
      if (!tooClose) {
        chosenSpot = spot;
        break;
      }
    }
    if (!chosenSpot) {
      chosenSpot = resolveObstaclesAndBounds(player.x + 7.2, player.z, 1.15, lim);
    }
    const chest = spawnPickup('cursed_chest', chosenSpot.x, chosenSpot.z);
    if (chest) {
      emitShockwave(chest.x, chest.z, 4.4, 0xc084fc, 0.48);
      emitParticles(chest.x, 0.75, chest.z, 0xc084fc, 18, 5.4, 0.16);
      audio?.playPickup?.('companion');
      floatText('☠️ ПРОКЛЯТЫЙ СУНДУК!', chest.x, chest.z, '#e879f9');
    }
    return chest;
  }

  function findClassWeaponByTier(classId, tier) {
    const classWeapons = CLASSES[classId]?.weapons || [];
    for (let i = 0; i < classWeapons.length; i++) {
      const wId = classWeapons[i];
      if (WEAPONS[wId]?.tier === tier) return wId;
    }
    for (const w of Object.values(WEAPONS)) {
      if (w.classId === classId && w.tier === tier) return w.id;
    }
    return null;
  }

  function spawnRelicWeaponEvent() {
    if (currentClassId === 'warrior' || currentClassId === 'gunslinger') return;
    const tier = currentLevelDef.unlockWeaponTier;
    if (!tier) return;
    const targetWeaponId = findClassWeaponByTier(currentClassId, tier);
    if (!targetWeaponId) return;

    let bestSpot = { x: 0, z: -14 };
    for (let attempt = 0; attempt < 16; attempt++) {
      const angle = Math.random() * TWO_PI;
      const dist = 14 + Math.random() * 4;
      const rx = clamp(player.x + Math.sin(angle) * dist, -ARENA_HALF_SIZE + 4.5, ARENA_HALF_SIZE - 4.5);
      const rz = clamp(player.z + Math.cos(angle) * dist, -ARENA_HALF_SIZE + 4.5, ARENA_HALF_SIZE - 4.5);
      const dPlayer = Math.hypot(rx - player.x, rz - player.z);
      if (dPlayer >= 11.5) {
        bestSpot = resolveObstaclesAndBounds(rx, rz, 1.2, ARENA_HALF_SIZE - 4.2);
        break;
      }
      bestSpot = resolveObstaclesAndBounds(rx, rz, 1.2, ARENA_HALF_SIZE - 4.2);
    }

    spawnPickup('relic_weapon_crate', bestSpot.x, bestSpot.z, { targetWeaponId });
    emitShockwave(bestSpot.x, bestSpot.z, 5.0, 0xfde047, 0.55);
    emitParticles(bestSpot.x, 0.9, bestSpot.z, 0xfde047, 22, 6.5, 0.2);

    // Guarding Elite Champion beside the Relic Crate
    const guardType = currentLevelNumber >= 7 ? 'iron_knight' : 'cursed_footman';
    spawnEnemy(guardType, bestSpot.x + 1.8, bestSpot.z + 1.2, 'purple');
    floatText('✨ РУННЫЙ ЯЩИК ОРУЖИЯ!', player.x, player.z - 1.2, '#fde047');
  }

  // === Enemy & Boss Spawning ===
  function spawnEnemy(typeId, x, z, forcedElite = null, customOverrides = null) {
    const def = ENEMY_TYPES[typeId] || ENEMY_TYPES.cursed_footman;

    // Abandoned Knight Rift: zero PvE colored elite rolls or arcade glowing rings/auras!
    let eliteType = isSoulslike ? null : forcedElite;
    if (
      !isSoulslike &&
      eliteType === null &&
      !def.isBoss &&
      !customOverrides?.isWarden &&
      !customOverrides?.isMiniBoss &&
      !customOverrides?.isSummoned &&
      !customOverrides?.isTrainingDummy
    ) {
      const roll = Math.random();
      if (roll < 0.065) eliteType = 'purple';
      else if (roll < 0.135) eliteType = 'blue';
    }

    const progress = clamp(elapsedRunTime / Math.max(1, currentLevelDef.durationSec), 0, 1);
    const waveRamp = 1 + progress * 0.22;
    const diffHpMult = currentDifficulty === 'hard' ? 1.45 : 1.0;
    const diffDmgMult = currentDifficulty === 'hard' ? 1.25 : 1.0;
    const endlessHpMult = isEndless
      ? 1 + (endlessWave - 1) * 0.22 + Math.pow(Math.max(0, endlessWave - 1), 1.22) * 0.04
      : 1.0;
    const endlessDmgMult = isEndless ? 1 + (endlessWave - 1) * 0.10 : 1.0;
    const endlessSpdMult = isEndless ? Math.min(1.40, 1 + (endlessWave - 1) * 0.03) : 1.0;
    const baseHpScale = (currentLevelDef.hpScale || 1) * (def.isBoss ? 0.85 : waveRamp) * diffHpMult * endlessHpMult;
    const baseDmgScale = (currentLevelDef.dmgScale || 1) * diffDmgMult * endlessDmgMult;

    const eliteHpMult =
      eliteType === 'purple' ? 1.65 : eliteType === 'blue' ? 1.55 : 1.0;
    const eliteDmgMult = eliteType ? 1.15 : 1.0;

    const maxHp = Math.max(
      1,
      Math.round(customOverrides?.hp ?? def.hp * baseHpScale * eliteHpMult)
    );
    const damage = Math.max(
      1,
      Math.round(customOverrides?.damage ?? def.damage * baseDmgScale * eliteDmgMult)
    );
    const scale =
      (customOverrides?.scale ?? def.scale ?? 1.0) *
      (customOverrides?.scale ? 1.0 : eliteType === 'purple' ? 1.15 : eliteType === 'blue' ? 1.12 : 1.0);

    const visualTag = isSoulslike
      ? null
      : customOverrides?.isWarden || customOverrides?.isFinaleTarget
        ? 'warden'
        : eliteType;
    const model = buildEnemyModel(typeId, visualTag);

    const isBossUnit = Boolean(def.isBoss || customOverrides?.isMiniBoss);
    const isMiniBoss = Boolean(customOverrides?.isMiniBoss);

    const baseRadius = Number.isFinite(customOverrides?.radius)
      ? customOverrides.radius
      : isMiniBoss
        ? 0.96
        : def.isBoss
          ? 1.28
          : customOverrides?.isWarden
            ? 0.95
            : 0.52 * scale;

    const spot = customOverrides?.ignoreSpawnObstacles
      ? { x, z }
      : resolveObstaclesAndBounds(x, z, baseRadius * 0.85, ARENA_ENTITY_LIMIT);
    const emergeDuration = isBossUnit || customOverrides?.noEmerge ? 0 : 0.85;
    model.obj.position.set(spot.x, emergeDuration > 0 ? -1.9 : 0, spot.z);
    if (emergeDuration > 0) {
      const ringCol = typeId === 'corrupted_treant' ? 0xf97316 : 0x65a30d;
      world?.spawnShockwaveRing?.({ x: spot.x, y: 0.045, z: spot.z, radius: 1.25, color: ringCol, duration: 0.65 });
      world?.spawnShockwaveRing?.({ x: spot.x, y: 0.055, z: spot.z, radius: 0.72, color: 0xfef08a, duration: 0.50 });
      emitParticles(spot.x, 0.18, spot.z, ringCol, 8, 3.6, 0.13);
      emitParticles(spot.x, 0.10, spot.z, 0x57534e, 6, 2.8, 0.11);
    }
    if (customOverrides?.scale) {
      model.obj.scale.multiplyScalar(customOverrides.scale / (def.scale || 1));
    } else if (eliteType === 'purple' || eliteType === 'blue') {
      model.obj.scale.multiplyScalar(1.12);
    }

    const enemy = {
      uid: nextEntityUid++,
      type: typeId,
      nameRu: customOverrides?.nameRu || def.nameRu,
      isBoss: isBossUnit,
      isMiniBoss,
      isWarden: Boolean(customOverrides?.isWarden),
      isFinaleTarget: Boolean(customOverrides?.isFinaleTarget),
      isSummoned: Boolean(customOverrides?.isSummoned),
      isTrainingDummy: Boolean(customOverrides?.isTrainingDummy),
      isSoulsUnit: Boolean(customOverrides?.isSoulsUnit),
      isSoulsBoss: Boolean(customOverrides?.isSoulsBoss),
      soulsThronePhase: customOverrides?.soulsThronePhase || null,
      soulsThroneTimer: 0,
      soulsThroneDur: SOULS_THRONE_STANDUP_FALLBACK_SEC,
      soulsThroneElapsed: 0,
      soulsThroneStep1Sfx: false,
      soulsThroneStep2Sfx: false,
      soulsRole: customOverrides?.soulsRole || null,
      soulsAggroRange: customOverrides?.aggroRange ?? 9.5,
      soulsAwake: Boolean(customOverrides?.isSoulsUnit && !customOverrides?.isSoulsBoss && false),
      soulsState: 'idle',
      soulsTimer: 0.6,
      soulsComboLeft: 0,
      soulsMoveType: 'slash',
      soulsStrikeDirX: 0,
      soulsStrikeDirZ: 1,
      soulsTelegraphX: spot.x,
      soulsTelegraphZ: spot.z,
      parriedRiposteTimer: 0,
      soulsPunishWindow: null,
      soulsPunishTimer: 0,
      soulsPunishDmgMult: 1.0,
      soulsPunishStaggerMult: 1.0,
      soulsPunishTagShown: false,
      soulsChainCount: 0,
      soulsLastHitAt: -99,
      eliteType,
      x: spot.x,
      z: spot.z,
      vx: 0,
      vz: 0,
      facing: 0,
      hp: maxHp,
      maxHp,
      stagger: 0,
      staggerMax: customOverrides?.staggerMax !== undefined
        ? customOverrides.staggerMax
        : isBossUnit
          ? Math.round((isMiniBoss ? 80 : 120) * (isEndless ? 1 + (endlessWave - 1) * 0.08 : 1))
          : 0,
      flatDef: customOverrides?.flatDef ?? 0,
      physNegation: customOverrides?.physNegation ?? 0,
      currentAttackMeta: null,
      staggeredTimer: 0,
      staggerImmunityTimer: 0,
      lastStaggerHitAge: 0,
      speed: (customOverrides?.speed ?? def.speed) * endlessSpdMult,
      damage,
      ranged: Boolean(def.ranged),
      canDash: Boolean(def.canDash),
      dashMult: def.dashMult || 1.65,
      canCharge: Boolean(def.canCharge),
      summoner: Boolean(def.summoner),
      canSummonBats: Boolean(def.canSummonBats || typeId === 'vampire_lord'),
      cloakMelee: Boolean(def.cloakMelee || typeId === 'vampire_lord'),
      batSummonCooldown: 2.0 + Math.random() * 1.4,
      castPauseTimer: 0,
      cloakAttackTimer: 0,
      keepDistance: def.keepDistance || 10.2,
      projColor: def.projColor || 0xa855f7,
      hazardColor: def.hazardColor || 0x22c55e,
      armor: def.armor || 0,
      frontArmor: def.frontArmor || 0,
      explodesOnDeath: Boolean(def.explodesOnDeath),
      bomberTriggered: false,
      xp: customOverrides?.xp ?? def.xp,
      gold: customOverrides?.gold ?? def.gold,
      radius: baseRadius,
      color: def.color,
      // Specialist AI timers
      shootCooldown: 1.1 + Math.random() * 1.1,
      windupTimer: 0,
      aimDirX: 0,
      aimDirZ: 1,
      specialCooldown:
        def.summoner
          ? 2.8 + Math.random() * 1.6
          : def.canCharge
            ? 2.2 + Math.random() * 1.4
            : 1.4 + Math.random() * 1.2,
      lungeTimer: 0,
      lungeDirX: 0,
      lungeDirZ: 1,
      chargeState: 'walk',
      chargeTimer: 0,
      chargeDirX: 0,
      chargeDirZ: 1,
      // Elemental & status effects
      frostTimer: 0,
      frostFactor: 1.0,
      burnTimer: 0,
      burnDps: 0,
      burnTickTimer: 0,
      fireVfxTick: 0,
      damageStage: 0,
      waterLiftTimer: 0,
      contactCooldown: 0,
      trampleCooldown: 0,
      stunTimer: 0,
      disarmTimer: 0,
      emergeTimer: emergeDuration,
      emergeDuration,
      hopCycle: Math.random(),
      _hopLandedDust: false,
      // Boss state machine
      bossPhase: 0,
      bossSubState: 'stalk',
      bossStateTimer: 1.8,
      bossStepCount: 0,
      dashStartX: spot.x,
      dashStartZ: spot.z,
      dashTargetX: spot.x,
      dashTargetZ: spot.z,
      mesh: model.obj,
      model
    };

    poiseCtrl.resetEntityPoise(enemy);
    enemies.push(enemy);
    return enemy;
  }

  function spawnWavePack() {
    const quotaRemaining = isEndless ? 99 : Math.max(0, targetKills - regularMobsSpawned);
    if (!isEndless && (kills >= targetKills || quotaRemaining <= 0)) return;

    const lvl = isEndless ? Math.min(25, 2 + endlessWave * 2) : (currentLevelDef?.level || 1);
    const maxConcurrentForLvl = isEndless
      ? Math.min(MAX_ACTIVE_ENEMIES, 7 + endlessWave * 2)
      : lvl === 1 ? 4 : lvl === 2 ? 5 : lvl === 3 ? 6 : Math.min(MAX_ACTIVE_ENEMIES, 5 + Math.min(lvl, 12) * 2);
    if (enemies.length >= maxConcurrentForLvl) return;
    waveCount += 1;

    const fullPool = currentLevelDef.enemyPool || ['plague_zombie'];
    const pool = isEndless
      ? fullPool.slice(0, Math.min(fullPool.length, 3 + endlessWave * 2))
      : fullPool;
    const meleePool = pool.filter((id) => !ENEMY_TYPES[id]?.ranged);
    const rangedPool = pool.filter((id) => Boolean(ENEMY_TYPES[id]?.ranged));
    const safeMeleePool = meleePool.length > 0 ? meleePool : ['plague_zombie'];

    let aliveRanged = 0;
    for (let i = 0; i < enemies.length; i++) {
      if (enemies[i]?.hp > 0 && enemies[i].ranged) {
        aliveRanged += 1;
      }
    }

    const timePressure = clamp(elapsedRunTime / 55, 0, 1.35);
    const basePack = isEndless
      ? Math.min(8, 3 + Math.floor((endlessWave - 1) * 0.65))
      : lvl === 1 ? 2 : lvl === 2 ? 3 : lvl === 3 ? 3 : Math.min(5, 2 + Math.floor((lvl - 1) * 0.45));
    let totalWaveSize = isEndless
      ? Math.min(10, basePack + Math.min(3, Math.floor(endlessWave / 3)))
      : finaleStarted
        ? Math.min(4, basePack + 1)
        : Math.min(
            lvl <= 3 ? 4 : 9,
            Math.round(basePack + timePressure * (lvl === 1 ? 0.9 : 1.2 + Math.min(2.4, (lvl - 1) * 0.2)))
          );
    if (!isEndless && !finaleStarted && currentLevelDef.enemyQuotas && levelSpawnQueue.length > 0) {
      totalWaveSize = Math.min(totalWaveSize, levelSpawnQueue.length);
    }
    totalWaveSize = Math.min(totalWaveSize, quotaRemaining);

    // Pick a distinct courtyard flank direction (rotates 90°/135° from previous wave so waves emerge visibly from gates!)
    lastWaveSector = (lastWaveSector + 1 + (Math.random() < 0.45 ? 1 : 0)) % 4;
    const primarySectorAngle = lastWaveSector * (Math.PI * 0.5) + (Math.random() - 0.5) * 0.34;
    const usePincer = !finaleStarted && lvl >= 2 && waveCount >= 4 && timePressure > 0.55 && Math.random() < 0.35;
    const secondarySectorAngle = primarySectorAngle + Math.PI * (0.72 + Math.random() * 0.35);

    let spawnedRangedInWave = false;

    for (let n = 0; n < totalWaveSize; n++) {
      if (enemies.length >= maxConcurrentForLvl) break;
      if (!isEndless && (kills >= targetKills || regularMobsSpawned >= targetKills)) {
        break;
      }

      const inSecondSquad = usePincer && n >= Math.ceil(totalWaveSize * 0.62);
      const baseAngle = inSecondSquad ? secondarySectorAngle : primarySectorAngle;
      const localIdx = inSecondSquad ? n - Math.ceil(totalWaveSize * 0.62) : n;

      let isRangedUnit = false;
      let chosen;
      if (levelSpawnQueue.length > 0 && !finaleStarted) {
        chosen = levelSpawnQueue.pop();
        isRangedUnit = Boolean(ENEMY_TYPES[chosen]?.ranged);
      } else if (
        !spawnedRangedInWave &&
        rangedPool.length > 0 &&
        aliveRanged < 2 &&
        n === totalWaveSize - 1 &&
        waveCount >= 1 &&
        Math.random() < 0.85
      ) {
        chosen = rangedPool[Math.floor(Math.random() * rangedPool.length)];
        aliveRanged += 1;
        spawnedRangedInWave = true;
        isRangedUnit = true;
      } else {
        chosen = safeMeleePool[(waveCount + n) % safeMeleePool.length];
      }

      const row = Math.floor(localIdx / 3);
      const col = (localIdx % 3) - 1;
      const fwdX = Math.sin(baseAngle);
      const fwdZ = Math.cos(baseAngle);
      const sideX = fwdZ;
      const sideZ = -fwdX;

      // Keep spawn distance in [10.8m .. 14.5m] so underground rise portals are clearly visible near the hero without ambushing!
      const baseDist = (isRangedUnit ? 14.5 : 10.8) + row * 1.85 + Math.random() * 0.8;
      const lateralSpread = col * 1.9 + (Math.random() - 0.5) * 0.6;

      const sx = clamp(
        player.x + fwdX * baseDist + sideX * lateralSpread,
        -ARENA_ENTITY_LIMIT,
        ARENA_ENTITY_LIMIT
      );
      const sz = clamp(
        player.z + fwdZ * baseDist + sideZ * lateralSpread,
        -ARENA_ENTITY_LIMIT,
        ARENA_ENTITY_LIMIT
      );

      const spawned = spawnEnemy(chosen, sx, sz);
      if (spawned) {
        regularMobsSpawned += 1;
        if (localIdx === 0) {
          emitParticles(spawned.x, 0.35, spawned.z, 0xa855f7, 8, 3.6, 0.14);
        }
      }
    }

    // Field Chests (genuine 3D supply_crate & stealth 3D mimic_disguise that shares exact mesh!)
    if (!finaleStarted && (waveCount === 1 || waveCount % 2 === 1)) {
      let activeCrates = 0;
      for (let i = 0; i < pickups.length; i++) {
        const pt = pickups[i]?.type;
        if (pt === 'supply_crate' || pt === 'mimic_disguise') activeCrates += 1;
      }
      if (activeCrates < 2) {
        const crateAng = primarySectorAngle + Math.PI * (0.45 + Math.random() * 0.4);
        const crateDist = 7.4 + Math.random() * 3.6;
        const cx = clamp(player.x + Math.sin(crateAng) * crateDist, -ARENA_ENTITY_LIMIT + 1.5, ARENA_ENTITY_LIMIT - 1.5);
        const cz = clamp(player.z + Math.cos(crateAng) * crateDist, -ARENA_ENTITY_LIMIT + 1.5, ARENA_ENTITY_LIMIT - 1.5);
        const hasMimicPool = lvl >= 2 || (currentLevelDef.enemyPool || []).includes('mimic_chest');
        const kind = waveCount === 1 ? (hasMimicPool ? 'mimic_disguise' : 'supply_crate') : (hasMimicPool && Math.random() < 0.5 ? 'mimic_disguise' : 'supply_crate');
        spawnPickup(kind, cx, cz);
      }
    }
  }

  // Spawn previous-Act Boss as a Field or Finale Mini-Boss (Acts II–V non-boss chapters!)
  function spawnMiniBossFromPool(isFinale = false) {
    const pool = currentLevelDef.miniBossPool || [];
    const bossTypeId = currentLevelDef.finaleMiniBossType || (isFinale ? pool[pool.length - 1] : pool[Math.floor(Math.random() * pool.length)]);
    if (!bossTypeId) return null;
    const bossDef = ENEMY_TYPES[bossTypeId] || ENEMY_TYPES.iron_knight || ENEMY_TYPES.cursed_footman;

    const hpScale = currentLevelDef.hpScale || 1;
    const dmgScale = currentLevelDef.dmgScale || 1;
    const miniHp = Math.max(
      115,
      Math.round((bossDef.hp || 90) * hpScale * (isFinale ? 2.25 : 1.75))
    );
    const miniDmg = Math.max(12, Math.round((bossDef.damage || 14) * dmgScale * 1.15));
    const miniScale = +((bossDef.scale || 1.0) * 1.42).toFixed(2);

    const angle = Math.random() * TWO_PI;
    const dist = 15.5;
    const mx = clamp(player.x + Math.sin(angle) * dist, -ARENA_HALF_SIZE + 4.5, ARENA_HALF_SIZE - 4.5);
    const mz = clamp(player.z + Math.cos(angle) * dist, -ARENA_HALF_SIZE + 4.5, ARENA_HALF_SIZE - 4.5);

    const mini = spawnEnemy(bossTypeId, mx, mz, null, {
      isMiniBoss: true,
      isWarden: Boolean(isFinale),
      isFinaleTarget: Boolean(isFinale),
      nameRu: isFinale ? `Страж: ${bossDef.nameRu}` : `Мини-босс: ${bossDef.nameRu}`,
      hp: miniHp,
      damage: miniDmg,
      scale: miniScale,
      speed: bossDef.speed * 0.96,
      xp: Math.round(bossDef.xp * 0.52),
      gold: Math.round(bossDef.gold * 0.50)
    });

    if (isFinale || !bossEntity || bossEntity.hp <= 0) {
      bossEntity = mini;
    }

    audio?.playBossSpawn?.();
    world?.addScreenShake?.(isFinale ? 0.58 : 0.42, 0.32);
    emitShockwave(mini.x, mini.z, 6.2, bossDef.color || 0xef4444, 0.48);
    emitParticles(mini.x, 1.0, mini.z, bossDef.color || 0xef4444, 24, 6.8, 0.20);
    floatText(
      isFinale ? `⚔️ ФИНАЛ: ${bossDef.nameRu.toUpperCase()}!` : `⚠️ МИНИ-БОСС: ${bossDef.nameRu.toUpperCase()}!`,
      player.x,
      player.z - 1.2,
      '#f87171'
    );
    return mini;
  }

  function spawnEndlessBoss() {
    const isActBoss = endlessBossCycleIdx % 2 === 1;
    const cycleNum = Math.floor(endlessBossCycleIdx / 2);
    endlessBossCycleIdx += 1;

    if (!isActBoss) {
      const fullPool = currentLevelDef.enemyPool || ['corrupted_treant', 'iron_knight', 'vampire_lord'];
      const activePool = fullPool.slice(0, Math.min(fullPool.length, 4 + endlessWave * 2));
      const miniType = activePool[Math.floor(Math.random() * activePool.length)] || 'corrupted_treant';
      const def = ENEMY_TYPES[miniType] || ENEMY_TYPES.iron_knight || ENEMY_TYPES.cursed_footman;
      const angle = Math.random() * TWO_PI;
      const dist = 15.0;
      const mx = clamp(player.x + Math.sin(angle) * dist, -ARENA_HALF_SIZE + 4.5, ARENA_HALF_SIZE - 4.5);
      const mz = clamp(player.z + Math.cos(angle) * dist, -ARENA_HALF_SIZE + 4.5, ARENA_HALF_SIZE - 4.5);
      const hpMult = 1 + (endlessWave - 1) * 0.25;
      const dmgMult = 1 + (endlessWave - 1) * 0.12;
      const mini = spawnEnemy(miniType, mx, mz, null, {
        isMiniBoss: true,
        isWarden: false,
        isFinaleTarget: false,
        nameRu: `Мини-босс (Волна ${endlessWave}): ${def.nameRu}`,
        hp: Math.max(180, Math.round((def.hp || 95) * hpMult * 2.1)),
        damage: Math.max(14, Math.round((def.damage || 16) * dmgMult * 1.15)),
        scale: +((def.scale || 1.0) * 1.42).toFixed(2),
        speed: def.speed * 0.98,
        xp: Math.round((def.xp || 20) * 1.8),
        gold: Math.round((def.gold || 10) * 2.0)
      });
      if (!bossEntity || bossEntity.hp <= 0) bossEntity = mini;
      audio?.playBossSpawn?.();
      world?.addScreenShake?.(0.45, 0.30);
      emitShockwave(mini.x, mini.z, 6.2, def.color || 0xef4444, 0.48);
      emitParticles(mini.x, 1.0, mini.z, def.color || 0xef4444, 24, 6.8, 0.20);
      floatText(`⚠️ МИНИ-БОСС: ${def.nameRu.toUpperCase()}!`, player.x, player.z - 1.2, '#f87171');
      return mini;
    }

    const bossId = ENDLESS_BOSS_ROTATION[cycleNum % ENDLESS_BOSS_ROTATION.length] || 'boss_warden';
    const bDef = ENEMY_TYPES[bossId] || ENEMY_TYPES.boss_warden;
    const ang = Math.random() * TWO_PI;
    const bx = clamp(player.x + Math.sin(ang) * 15.5, -ARENA_HALF_SIZE + 5, ARENA_HALF_SIZE - 5);
    const bz = clamp(player.z + Math.cos(ang) * 15.5, -ARENA_HALF_SIZE + 5, ARENA_HALF_SIZE - 5);
    const spawnedBoss = spawnEnemy(bossId, bx, bz, null, {
      isFinaleTarget: false,
      nameRu: `${bDef.nameRu} (Волна ${endlessWave})`
    });
    bossEntity = spawnedBoss;
    world?.setBossAtmosphere?.(true);
    audio?.playBossSpawn?.();
    world?.addScreenShake?.(0.76, 0.45);
    emitShockwave(spawnedBoss.x, spawnedBoss.z, 8.2, bDef.color || 0xdc2626, 0.56);
    emitParticles(spawnedBoss.x, 1.2, spawnedBoss.z, bDef.color || 0xdc2626, 32, 7.8, 0.22);
    floatText(`💀 БОСС ВОЛНЫ ${endlessWave}: ${bDef.nameRu.toUpperCase()}!`, player.x, player.z - 1.2, '#ef4444');
    return spawnedBoss;
  }

  // === Toxic Slime / Bomber Acid Hazard Pool ===
  function spawnBomberHazard(x, z, hzColor = 0x22c55e) {
    const hpScale = currentLevelDef.hpScale || 1;
    const dmgScale = currentLevelDef.dmgScale || 1;
    emitTelegraphZone(x, z, 3.1, 0.80, hzColor);
    emitParticles(x, 0.55, z, hzColor, 12, 4.4, 0.15);
    bomberHazards.push({
      x,
      z,
      radius: 3.1,
      timer: 0.80,
      color: hzColor,
      playerDamage: Math.max(12, Math.round(24 * dmgScale)),
      enemyDamage: Math.max(45, Math.round(85 * hpScale))
    });
  }

  function disposePickupClonedMaterials(pickup) {
    if (!pickup) return;
    if (Array.isArray(pickup._clonedMaterials)) {
      for (let i = 0; i < pickup._clonedMaterials.length; i++) {
        try {
          pickup._clonedMaterials[i]?.dispose?.();
        } catch {
          // Ignore material dispose errors
        }
      }
      pickup._clonedMaterials.length = 0;
    }
    pickup.model?.obj?.traverse?.((child) => {
      if (child.isMesh && child.userData?._origMat) {
        child.material = child.userData._origMat;
        delete child.userData._origMat;
      }
    });
  }

  function removePickup(pickup, hintIdx = -1) {
    if (!pickup) return false;
    const curIdx = hintIdx >= 0 && pickups[hintIdx] === pickup ? hintIdx : pickups.indexOf(pickup);
    if (curIdx < 0) return false;
    disposePickupClonedMaterials(pickup);
    if (pickup.model) {
      removeSceneObject(pickup.model.obj, pickup.model.handle);
    }
    pickups.splice(curIdx, 1);
    return true;
  }

  // === Crate Destruction, Mimic Ambush & Unlocks ===
  function awakenMimicDisguise(crate, idx = -1) {
    if (!crate) return;
    crate.hp = 0;
    const mx = crate.x;
    const mz = crate.z;
    removePickup(crate, idx);
    world?.spawnShockwaveRing?.({ x: mx, y: 0.05, z: mz, radius: 1.9, color: 0xc084fc, duration: 0.42 });
    emitParticles(mx, 0.55, mz, 0xc084fc, 16, 5.4, 0.15);
    floatText('👹 МИМИК!', mx, mz, '#e879f9');
    audio?.playHit?.();
    spawnEnemy('mimic_chest', mx, mz, null, { noEmerge: true });
  }

  function detonateExplosiveBarrel(barrel, chainDepth = 0) {
    if (!barrel || barrel._detonated) return;
    barrel._detonated = true;
    barrel.hp = 0;
    const bx = barrel.x;
    const bz = barrel.z;
    const blastRadius = 4.2;
    removePickup(barrel);
    notifyDailyProgress('barrels_chests', 1);

    if (typeof world?.spawnBarrelExplosion === 'function') {
      world.spawnBarrelExplosion({ x: bx, z: bz, radius: blastRadius });
    } else {
      emitShockwave(bx, bz, blastRadius, 0xf97316, 0.42);
      emitParticles(bx, 0.75, bz, 0xf97316, 28, 9.0, 0.22);
      world?.addScreenShake?.(0.35, 0.22);
    }
    audio?.playExplosion?.();
    floatText(chainDepth > 0 ? '💥 ЦЕПНОЙ ВЗРЫВ!' : '💥 ВЗРЫВ БОЧКИ!', bx, bz, '#fb923c');

    const lvlScale = isEndless
      ? 1 + (endlessWave - 1) * 0.22
      : (currentLevelDef?.hpScale || 1);
    const blastDmg = Math.max(95, Math.round((stats?.damage || 28) * 3.4 + 45 * lvlScale));
    damageEnemiesInRadius(bx, bz, blastRadius, blastDmg, 13.5, null, false, null, { isBarrelBlast: true });

    // Chain detonation of neighboring explosive barrels within blast radius!
    if (chainDepth < 5) {
      const neighbors = [];
      for (let i = 0; i < pickups.length; i++) {
        const other = pickups[i];
        if (!other || other._detonated || other.hp <= 0 || other.type !== 'explosive_barrel') continue;
        if (Math.hypot(other.x - bx, other.z - bz) <= blastRadius + (other.radius || 0.82)) {
          neighbors.push(other);
        }
      }
      for (let i = 0; i < neighbors.length; i++) {
        detonateExplosiveBarrel(neighbors[i], chainDepth + 1);
      }
    }
  }

  function openCursedChest(chest) {
    if (!chest || chest._opened) return;
    chest._opened = true;
    chest.hp = 0;
    const cx = chest.x;
    const cz = chest.z;
    removePickup(chest);
    notifyDailyProgress('barrels_chests', 1);

    const baseChestGold = isEndless
      ? 36 + endlessWave * 9
      : 26 + Math.max(1, currentLevelNumber) * 6;
    const jackpotGold = Math.max(30, Math.round(baseChestGold * 3 * (stats?.goldMult || 1)));
    progression.addGold(jackpotGold);
    goldRun += jackpotGold;

    audio?.playWeaponUnlock?.();
    audio?.playPickup?.('gold');
    world?.addScreenShake?.(0.52, 0.28);
    emitShockwave(cx, cz, 5.2, 0xc084fc, 0.46);
    emitShockwave(cx, cz, 3.6, 0xfde047, 0.34);
    emitParticles(cx, 0.9, cz, 0xfde047, 30, 8.4, 0.20);
    emitParticles(cx, 1.15, cz, 0xfbbf24, 22, 6.4, 0.16);
    emitParticles(cx, 0.7, cz, 0xc084fc, 16, 5.8, 0.15);

    floatText(`☠️ ПРОКЛЯТЫЙ СУНДУК: ×3 ЗОЛОТА (+${jackpotGold})! ЗАСАДА!`, cx, cz, '#fde047');
    callbacks?.onToast?.(`☠️ Проклятый сундук: ×3 золота (+${jackpotGold})! Засада!`);

    // Ambush ring: 3–4 aggressive shadows/skeletons around the opened cursed chest!
    const ambushPool = ['shadow_wisp', 'ember_skeleton', 'dark_spider'];
    const ambushCount = isEndless || currentLevelNumber >= 8 ? 4 : 3;
    const baseAngle = Math.random() * TWO_PI;
    for (let i = 0; i < ambushCount; i++) {
      if (enemies.length >= MAX_ACTIVE_ENEMIES + 4) break;
      const ang = baseAngle + (i / ambushCount) * TWO_PI;
      const rad = 2.75 + Math.random() * 0.75;
      const sx = clamp(cx + Math.sin(ang) * rad, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
      const sz = clamp(cz + Math.cos(ang) * rad, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
      const eType = ambushPool[i % ambushPool.length];
      emitTelegraphZone(sx, sz, 1.05, 0.65, 0xc084fc);
      emitParticles(sx, 0.55, sz, 0xc084fc, 10, 4.4, 0.14);
      const baseDef = ENEMY_TYPES[eType];
      spawnEnemy(eType, sx, sz, null, {
        isSummoned: true,
        speed: baseDef ? +(baseDef.speed * 1.10).toFixed(2) : undefined,
        xp: baseDef ? Math.max(8, Math.round(baseDef.xp * 0.85)) : 8,
        gold: baseDef ? Math.max(4, Math.round(baseDef.gold * 0.9)) : 4
      });
    }
  }

  function hitCrate(crate) {
    if (!crate || crate.hp <= 0) return;
    if (crate.type === 'explosive_barrel') {
      detonateExplosiveBarrel(crate, 0);
      return;
    }
    if (crate.type === 'cursed_chest') {
      openCursedChest(crate);
      return;
    }
    if (crate.type === 'mimic_disguise') {
      awakenMimicDisguise(crate);
      return;
    }
    crate.hp -= 1;
    crate.hitWobble = 0.28;
    audio?.playHit?.();

    if (crate.type === 'supply_crate') {
      emitParticles(crate.x, 0.5, crate.z, 0xf97316, 8, 4.5, 0.14);
      if (crate.hp > 0) {
        if (typeof crate.model?.handle?.setDamageGlow === 'function') {
          crate.model.handle.setDamageGlow((3 - crate.hp) / 2);
        } else {
          if (!crate._clonedMaterials) crate._clonedMaterials = [];
          crate.model.obj.traverse?.((child) => {
            if (!child.isMesh || !child.material) return;
            if (!child.userData._origMat) {
              child.userData._origMat = child.material;
              if (Array.isArray(child.material)) {
                child.material = child.material.map((mat) => {
                  const cloned = typeof mat?.clone === 'function' ? mat.clone() : mat;
                  if (cloned && cloned !== mat) crate._clonedMaterials.push(cloned);
                  return cloned;
                });
              } else if (typeof child.material.clone === 'function') {
                const cloned = child.material.clone();
                child.material = cloned;
                crate._clonedMaterials.push(cloned);
              }
            }
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            for (let m = 0; m < mats.length; m++) {
              const mat = mats[m];
              if (!mat) continue;
              mat.color?.setHex(crate.hp === 1 ? 0xff1e1e : 0xf97316);
              if (mat.emissive) {
                mat.emissive.setHex(crate.hp === 1 ? 0xdc2626 : 0x9a3412);
              }
            }
          });
        }
        floatText(crate.hp === 1 ? '🔥 1!' : '2!', crate.x, crate.z, '#fb923c');
      } else {
        detonateSupplyCrate(crate);
      }
      return;
    }

    if (crate.type === 'relic_weapon_crate') {
      emitParticles(crate.x, 0.7, crate.z, 0xfde047, 12, 5.2, 0.16);
      if (crate.hp > 0) {
        floatText(`ПЕЧАТЬ ${crate.hp}/3`, crate.x, crate.z, '#fde047');
      } else {
        openRelicWeaponCrate(crate);
      }
      return;
    }

    if (crate.type === 'companion_crate' && crate.hp <= 0) {
      activateCompanion(crate.x, crate.z);
    }
  }

  function maybeDropSpearBlueprint(x, z) {
    if (currentLevelNumber < 3) return;
    if (progression.isWeaponUnlocked('spear') || progression.isBlueprintUnlocked?.('spear')) return;
    if (Math.random() < 0.20) {
      progression.unlockBlueprint?.('spear');
      audio?.playWeaponUnlock?.();
      world?.addScreenShake?.(0.42, 0.25);
      emitShockwave(x, z, 5.2, 0x38bdf8, 0.45);
      emitParticles(x, 0.85, z, 0x38bdf8, 26, 7.2, 0.20);
      floatText('📜 ЧЕРТЁЖ: БОЕВОЕ КОПЬЁ! (в Магазине)', player.x, player.z - 0.8, '#38bdf8');
      callbacks?.onBlueprintUnlocked?.('spear');
    }
  }

  function detonateSupplyCrate(crate) {
    notifyDailyProgress('barrels_chests', 1);
    maybeDropSpearBlueprint(crate.x, crate.z);
    audio?.playExplosion?.();
    world?.addScreenShake?.(0.68, 0.36);
    emitShockwave(crate.x, crate.z, 6.2, 0xef4444, 0.42);
    emitParticles(crate.x, 0.6, crate.z, 0xf97316, 28, 9.0, 0.22);
    floatText('💥 ВЗРЫВ ЯЩИКА!', crate.x, crate.z, '#f97316');

    const blastDmg = Math.max(110, Math.round(stats.damage * 3.0));
    damageEnemiesInRadius(crate.x, crate.z, 6.2, blastDmg, 11.5, null);

    const bulletDmg = Math.max(52, Math.round(stats.damage * 1.65));
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * TWO_PI;
      spawnProjectile({
        x: crate.x,
        z: crate.z,
        vx: Math.sin(ang) * 25,
        vz: Math.cos(ang) * 25,
        damage: bulletDmg,
        maxDist: 18,
        pierce: 3,
        splashRadius: 0.9,
        knockback: 6.5,
        kind: 'bullet',
        visualType: 'buckshot',
        color: 0xf97316,
        isEnemy: false,
        ignoreCrateUid: crate.uid
      });
    }
  }

  function unlockTierWeaponIfNeeded(targetWeaponId, sourceX, sourceZ, silentIfAlreadyOwned = false) {
    if (!targetWeaponId || !WEAPONS[targetWeaponId]) return;
    const weaponDef = WEAPONS[targetWeaponId];
    const alreadyUnlocked = progression.isWeaponUnlocked(targetWeaponId);

    if (!alreadyUnlocked) {
      progression.unlockWeapon(targetWeaponId);
      currentWeaponId = targetWeaponId;
      recomputeStats();
      player.ammo = player.maxAmmo;
      player.isReloading = false;
      player.reloadTimer = 0;
      syncHeroReloadModel(false);

      heroModel?.handle?.setWeapon?.(targetWeaponId);
      heroModel?.obj?.userData?.setWeapon?.(targetWeaponId);

      unlockedWeaponThisRun = weaponDef;
      audio?.playWeaponUnlock?.();
      world?.addScreenShake?.(0.6, 0.36);
      emitShockwave(sourceX, sourceZ, 6.8, 0xfde047, 0.52);
      emitParticles(sourceX, 0.9, sourceZ, 0xfde047, 34, 8.2, 0.22);
      floatText(`✨ ОТКРЫТО: ${weaponDef.nameRu.toUpperCase()}!`, sourceX, sourceZ, '#fde047');
      callbacks?.onWeaponUnlocked?.(weaponDef);
    } else if (!silentIfAlreadyOwned) {
      weaponRunLevel = Math.min(5, weaponRunLevel + 1);
      recomputeStats();
      player.ammo = player.maxAmmo;
      player.isReloading = false;
      player.reloadTimer = 0;
      syncHeroReloadModel(false);

      const bonusGold = Math.round(55 * (stats.goldMult || 1));
      progression.addGold(bonusGold);
      goldRun += bonusGold;
      audio?.playWeaponUnlock?.();
      emitShockwave(sourceX, sourceZ, 5.5, 0xfbbf24, 0.45);
      emitParticles(sourceX, 0.8, sourceZ, 0xfbbf24, 26, 7.0, 0.2);
      floatText(`⚡ +1 РАНГ И +${bonusGold} ЗОЛОТА!`, sourceX, sourceZ, '#fde047');
    }
  }

  function openRelicWeaponCrate(crate) {
    notifyDailyProgress('barrels_chests', 1);
    const targetWeaponId =
      crate.targetWeaponId ||
      findClassWeaponByTier(currentClassId, currentLevelDef.unlockWeaponTier || 2);
    unlockTierWeaponIfNeeded(targetWeaponId, crate.x, crate.z, false);
  }

  function activateCompanion(x, z) {
    if (isSoulslike) return;
    audio?.playPickup?.('companion');
    emitShockwave(x, z, 4.2, 0xa855f7, 0.38);
    emitParticles(x, 0.6, z, 0xc084fc, 18, 5.5, 0.18);

    if (!companion) {
      const model = buildCompanionModel(currentClassId);
      model.obj.position.set(player.x - 1.6, 0, player.z - 1.2);
      companion = {
        x: player.x - 1.6,
        z: player.z - 1.2,
        facing: 0,
        shootCooldown: 0.25,
        boostTimer: 0,
        orbitAngle: 0,
        model
      };
      floatText('🦉 БОЕВОЙ НАПАРНИК!', x, z, '#c084fc');
    } else {
      companion.boostTimer = 15.0;
      floatText('⚡ НАПАРНИК УСИЛЕН!', x, z, '#c084fc');
    }
  }

  function activateOverdrive(x, z) {
    player.overdriveAmmo = 5;
    player.overdriveMax = 5;
    if (player.maxAmmo > 0) {
      player.ammo = player.maxAmmo;
      if (player.isReloading) {
        player.isReloading = false;
        player.reloadTimer = 0;
        syncHeroReloadModel(false);
      }
    }
    audio?.playPickup?.('crate');
    emitShockwave(x, z, 4.0, 0xfbbf24, 0.32);
    emitParticles(x, 0.6, z, 0xfbbf24, 18, 5.5, 0.16);
    floatText('🔥 СУПЕР-ЗАРЯД (5)!', player.x, player.z, '#fbbf24');
  }

  function activateBeastMode() {
    if (isSoulslike) return;
    player.seals = 0;
    player.beastReady = false;
    player.beastTimeLeft = 10.0;
    pendingMeleeStrikes = [];
    meleeStepLunge = null;
    if (player.maxAmmo > 0) {
      player.ammo = player.maxAmmo;
    }
    if (player.maxMana > 0) {
      player.mana = player.maxMana;
    }
    if (player.isReloading) {
      player.isReloading = false;
      player.reloadTimer = 0;
      syncHeroReloadModel(false);
    }

    const cls = CLASSES[currentClassId] || CLASSES.warrior;
    heroModel?.handle?.setBeastMode?.(true, currentClassId);
    heroModel?.obj?.userData?.setBeastMode?.(true, currentClassId);

    audio?.playBeastRoar?.();
    world?.addScreenShake?.(0.72, 0.42);
    emitShockwave(player.x, player.z, 7.8, cls.beastColor || 0xd9480f, 0.48);
    emitParticles(player.x, 0.9, player.z, cls.beastColor || 0xd9480f, 32, 8.5, 0.22);
    floatText(`🐺 ${cls.beastNameRu.toUpperCase()}!`, player.x, player.z, '#fb923c');

    damageEnemiesInRadius(player.x, player.z, 5.5, Math.round(stats.damage * 1.8), 11.0, null);
  }

  // === Persistent Hero XP + In-Run Roguelike Synergistic Perk Level-Ups ===
  function grantXp(amount, suppressModal = false) {
    if (runEnded || pendingVictoryPayload || playerDying) return;
    const rawXp = Math.max(0, Number(amount) || 0);
    if (rawXp <= 0) return;

    // 1. Persistent Meta Hero XP (Menu Talent Points)
    const scaled = rawXp * 0.1 + xpFraction;
    const gain = Math.floor(scaled);
    xpFraction = scaled - gain;
    if (gain > 0) {
      const res = progression.addHeroXp?.(gain);
      xp = res ? res.heroXp : xp + gain;
      xpNext = res ? res.heroXpNext : xpNext;
      runLevel = res ? res.newLevel : runLevel;

      if (res?.leveledUp) {
        audio?.playLevelUp?.();
        emitShockwave(player.x, player.z, 4.6, 0xfde047, 0.36);
        emitParticles(player.x, 0.9, player.z, 0xfde047, 18, 5.5, 0.16);
        floatText(`⭐ УРОВЕНЬ ${res.newLevel}! +1 Очко таланта`, player.x, player.z, '#fde047');
        callbacks?.onHeroLevelUp?.(res);
      }
    }

    // 2. In-Run Soul Blessings disabled — progression focuses cleanly on Hero Level Talent Points & Arsenal upgrades!
  }

  function triggerNextLevelUpIfReady() {
    if (runEnded || pendingVictoryPayload || playerDying || awaitingLevelUpChoice || pendingLevelUps <= 0) return;
    if (typeof callbacks?.onLevelUpReady !== 'function') {
      pendingLevelUps = 0;
      awaitingLevelUpChoice = false;
      return;
    }
    const choices = progression.rollLevelUpChoices?.(currentClassId, perks, runPerkLevel) || [];
    if (!choices.length) {
      pendingLevelUps = 0;
      awaitingLevelUpChoice = false;
      return;
    }
    pendingLevelUps -= 1;
    awaitingLevelUpChoice = true;
    audio?.playLevelUp?.();
    callbacks.onLevelUpReady(choices);
  }

  function applyLevelUpChoice(choiceId) {
    const prevMaxHp = stats ? stats.maxHp : player.maxHp;

    if (choiceId === 'weapon_level_up') {
      weaponRunLevel += 1;
      const wpnDef = WEAPONS[currentWeaponId] || WEAPONS.club;
      floatText(`${wpnDef.nameRu} РАНГ ${weaponRunLevel}!`, player.x, player.z, '#fde047');
    } else if (choiceId) {
      const wasFirstSoulNova = choiceId === 'soul_nova' && !perks.soul_nova;
      perks[choiceId] = (perks[choiceId] || 0) + 1;
      if (wasFirstSoulNova) {
        player.soulNovaTimer = 0.5;
      }
      const perkDef = RUN_UPGRADES.find((u) => u.id === choiceId);
      if (perkDef) {
        floatText(`${perkDef.icon} ${perkDef.nameRu}!`, player.x, player.z, '#fde047');
      }
    }

    recomputeStats();

    // Choosing ammo_pouch immediately tops up magazine (or surges Mana!) and cancels reload!
    if (choiceId === 'ammo_pouch') {
      if (player.maxAmmo > 0) {
        player.ammo = player.maxAmmo;
        if (player.isReloading) {
          player.isReloading = false;
          player.reloadTimer = 0;
          syncHeroReloadModel(false);
        }
        audio?.playReloadReady?.();
      } else if (player.maxMana > 0) {
        player.mana = player.maxMana;
      }
    }

    const hpGainFromMax = Math.max(0, stats.maxHp - prevMaxHp);
    const bonusHeal = choiceId === 'vampiric_harvest' ? 15 : choiceId === 'war_iron_banner' ? 24 : 8;
    player.hp = Math.min(stats.maxHp, player.hp + hpGainFromMax + bonusHeal);
    if (choiceId === 'rapid_cadence' && player.dashCooldown > getDashCooldownMax()) {
      player.dashCooldown = getDashCooldownMax();
    }
    if (choiceId === 'mage_arcane_ward') {
      player.arcaneWardReady = true;
    } else if (choiceId === 'mage_meteor_shower') {
      player.meteorTimer = 0.6;
    } else if (choiceId === 'war_whirlwind') {
      player.whirlwindTimer = 0.7;
    }

    emitShockwave(player.x, player.z, 3.8, 0xfde047, 0.34);
    emitParticles(player.x, 0.85, player.z, 0xfde047, 16, 5.2, 0.15);

    awaitingLevelUpChoice = false;
    triggerNextLevelUpIfReady();
  }

  // === Revive (Yandex Rewarded Video) ===
  function revivePlayer() {
    if (!stats) recomputeStats();
    playerDying = false;
    deathModalDelay = 0;
    pendingDefeatPayload = null;
    pendingMeleeStrikes = [];
    meleeStepLunge = null;
    player.hp = stats.maxHp;
    player.invulnTimer = 2.5;
    player.dashTimer = 0;
    player.dashCooldown = 0;
    player.dashInvulnTimer = 0;
    player.moveVelX = 0;
    player.moveVelZ = 0;
    player.recoilVx = 0;
    player.recoilVz = 0;
    player.attackAnimTimer = 0;
    player.attackFaceHoldTimer = 0;
    cancelPlayerTurn180(0.45);
    poiseCtrl.resetEntityPoise(player, { isPlayer: true });
    heroModel?.handle?.cancelHitReact?.();
    player.prevMoveDirX = 0;
    player.prevMoveDirZ = 0;
    player.runMomentumTime = 0;
    hitStopTimer = 0;
    hitStopCooldown = 0;
    if (isSoulslike) {
      player.hasHyperArmor = false;
      resetSoulsControllers(false);
      resetActorPhysics(player);
    }
    setModelBlocking(heroModel, false);
    if (player.maxAmmo > 0) {
      player.ammo = player.maxAmmo;
    }
    if (player.maxMana > 0) {
      player.mana = player.maxMana;
    }
    if (player.isReloading) {
      player.isReloading = false;
      player.reloadTimer = 0;
      syncHeroReloadModel(false);
    }
    const setDeadFn =
      heroModel?.handle?.setDeadState || heroModel?.obj?.userData?.setDeadState;
    if (typeof setDeadFn === 'function') {
      setDeadFn(false);
    } else {
      heroModel?.handle?.resetDeath?.();
      heroModel?.obj?.userData?.resetDeath?.();
    }
    runEnded = false;
    runActive = true;

    audio?.playLevelUp?.();
    world?.addScreenShake?.(0.68, 0.38);
    emitShockwave(player.x, player.z, 9.5, 0xfde047, 0.55);
    emitParticles(player.x, 0.9, player.z, 0xfde047, 32, 8.5, 0.22);
    floatText('✨ ВОСКРЕШЕНИЕ!', player.x, player.z, '#fde047');

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.hp <= 0) continue;
      const dx = e.x - player.x;
      const dz = e.z - player.z;
      const dist = Math.hypot(dx, dz) || 0.001;
      if (dist < 10.5) {
        const pushForce = e.isBoss ? 7.5 : 16.5;
        e.vx += (dx / dist) * pushForce;
        e.vz += (dz / dist) * pushForce;
        e.stunTimer = Math.max(e.stunTimer, e.isBoss ? 0.3 : 0.75);
      }
    }
    for (let i = projectiles.length - 1; i >= 0; i--) {
      if (projectiles[i].isEnemy) {
        removeSceneObject(projectiles[i].vis.obj, projectiles[i].vis.handle);
        projectiles.splice(i, 1);
      }
    }
  }

  function addBossStagger(enemy, amount) {
    if (!enemy || enemy.hp <= 0 || !(enemy.staggerMax > 0)) return;
    if ((enemy.staggeredTimer || 0) > 0 || (enemy.staggerImmunityTimer || 0) > 0) return;
    if (
      enemy.soulsRiposteInvuln ||
      enemy.soulsState === 'stagger_kneel' ||
      enemy.soulsState === 'stagger_recover' ||
      enemy.soulsState === 'riposte_victim' ||
      enemy.soulsState === 'riposte_recover' ||
      (enemy.isSoulsBoss &&
        (enemy.soulsThronePhase === 'sitting' ||
          enemy.soulsThronePhase === 'pause' ||
          enemy.soulsThronePhase === 'standing'))
    ) {
      return;
    }
    const baseGain = Math.max(0, Number(amount) || 0);
    // Open Souls Boss punish window: stagger gain ×1.45 (heavy) / ×1.25 (light)
    const punishStaggerMult =
      enemy.isSoulsBoss && enemy.soulsPunishWindow ? Math.max(1, Number(enemy.soulsPunishStaggerMult) || 1) : 1;
    const gain = baseGain * punishStaggerMult;
    if (gain <= 0) return;
    enemy.lastStaggerHitAge = 0;
    enemy.stagger = Math.min(enemy.staggerMax, (enemy.stagger || 0) + gain);
    if (enemy.stagger >= enemy.staggerMax) {
      if (enemy.isSoulsBoss) {
        enemy.model?.handle?.cancelHitReact?.();
        audio?.playStanceBreak?.();
        emitSoulsSparkBurst('stance_break', enemy.x, enemy.z, enemy.x - player.x, enemy.z - player.z);
        triggerHitStop(soulsGameFeel.HITSTOP_PRESETS.stance_break, true);
        startSoulsBossStaggerKneel(enemy, elapsedRunTime, bossAiCtx);
        callbacks?.onSoulsCue?.('СЛОМ СТОЙКИ!', 'stance_break');
        return;
      }
      if (enemy.isSoulsUnit) {
        releaseSoulsAttackToken(enemy);
        enemy.soulsAwake = true;
        enemy.isAmbushGuard = false;
        enemy.stagger = enemy.staggerMax;
        enemy.staggeredTimer = 2.8;
        enemy.parriedRiposteTimer = 2.8;
        enemy.stunTimer = 2.8;
        enemy.soulsRiposteUsed = false;
        enemy.soulsRiposteInvuln = false;
        enemy._soulsParryCount = 0;
        enemy.soulsState = 'stagger_kneel';
        enemy.aiState = 'stagger_kneel';
        enemy.soulsTimer = 2.8;
        enemy._soulsSlideTimer = 0;
        enemy._mobActiveSwing = null;
        enemy.currentAttackMeta = null;
        poiseCtrl.resetEntityPoise(enemy, { grantImmunity: true });
        enemy.model?.handle?.cancelHitReact?.();
        enemy.model?.handle?.cancelAttackAnim?.();
        enemy.model?.handle?.playClampedClip?.('Stagger_Kneel', 1.0, 0.14);
        triggerHitStop(soulsGameFeel.HITSTOP_PRESETS.stance_break, true);
        audio?.playStanceBreak?.();
        world?.addScreenShake?.(0.32, 0.18);
        emitSoulsSparkBurst('stance_break', enemy.x, enemy.z, enemy.x - player.x, enemy.z - player.z);
        floatText('СЛОМ СТОЙКИ!', enemy.x, enemy.z - 0.8, '#fde047');
        callbacks?.onSoulsCue?.('СЛОМ СТОЙКИ!', 'stance_break');
        return;
      }
      enemy.stagger = enemy.staggerMax;
      enemy.staggeredTimer = 1.5;
      enemy.staggerImmunityTimer = 0;
      // Interrupt any active boss attack, leap, dash, whirlwind, or telegraph!
      enemy.bossPhase = 0;
      enemy.bossSubState = 'stalk';
      enemy.bossStateTimer = Math.max(enemy.bossStateTimer || 0, 1.85);
      enemy.chargeState = 'walk';
      enemy.chargeTimer = 0;
      enemy.lungeWindupTimer = 0;
      enemy.lungeTimer = 0;
      enemy.windupTimer = 0;
      poiseCtrl.resetEntityPoise(enemy, { grantImmunity: true });
      enemy.model?.handle?.cancelHitReact?.();
      enemy.model?.handle?.setClipOverride?.(null);
      if (enemy.model?.obj && enemy.model.obj.position.y > 0) {
        enemy.model.obj.position.y = isSoulslike ? sampleSmoothGroundY(enemy, enemy.x, enemy.z, 0, true) : 0;
      }
      triggerHitStop(0.042, true);
      audio?.playArmorBreak?.('shield');
      audio?.playShieldBlock?.();
      world?.addScreenShake?.(0.45, 0.24);
      emitShockwave(enemy.x, enemy.z, 4.6, 0xfbbf24, 0.42);
      emitParticles(enemy.x, 1.35, enemy.z, 0xfde047, 24, 7.5, 0.18);
      floatText('💫 ОГЛУШЁН!', enemy.x, enemy.z, '#fde047');
    }
  }

  // === Damage, Crits, Shieldbearer Armor, Elemental Statuses & Death ===
  function applyDamageToEnemy(enemy, amount, knockX = 0, knockZ = 0, allowChain = true, hitMeta = null) {
    if (!enemy || enemy.hp <= 0) return;
    // Full i-frame protection while enemy is undergoing paired Critical Riposte / knockdown fall
    if (enemy.soulsRiposteInvuln || enemy.soulsState === 'riposte_victim') {
      return;
    }
    if (
      enemy.isSoulsBoss &&
      (enemy.soulsThronePhase === 'sitting' || enemy.soulsThronePhase === 'pause' || enemy.soulsThronePhase === 'standing')
    ) {
      return;
    }

    const isDoT = Boolean(hitMeta?.isDoT);
    const isProjectile = Boolean(hitMeta?.isProjectile);
    const isCrit = Boolean(hitMeta?.isCrit);
    const isWaterSlam = Boolean(hitMeta?.isWaterSlam);
    const isSplash = Boolean(hitMeta?.isSplash);
    const isComboFinisher = Boolean(hitMeta?.isComboFinisher);
    const isBarrelBlast = Boolean(hitMeta?.isBarrelBlast);
    const hitElem = hitMeta?.mageElement || null;
    let finalAmount = amount;
    let kx = knockX;
    let kz = knockZ;

    // Boss / Mob Stagger vulnerability:
    //   - Regular hits against a kneeling enemy deal +35% bonus damage; paired Critical Riposte is launched cleanly via startSoulsCriticalRiposte (strictly once per stance break!).
    const isKneelRiposte = false;
    let isKneelCrit = false;
    if (!isDoT && enemy.soulsState === 'stagger_kneel') {
      isKneelCrit = true;
      if (!hitMeta?.soulsPipeline) finalAmount *= 1.35;
    } else if (!isDoT && (enemy.staggeredTimer || 0) > 0 && !hitMeta?.soulsPipeline) {
      finalAmount *= 1.35;
    }

    // 🎯 Souls Boss Punish Window (DS3 / Elden Ring): hits during an open recover window deal ×1.25 (heavy) / ×1.15 (light)
    let punishTier = null;
    if (!isDoT && (enemy.isSoulsBoss || enemy.isSoulsUnit)) {
      enemy.soulsLastHitAt = lastFrameElapsedTime;
      if (enemy.soulsPunishWindow && enemy.soulsState !== 'stagger_kneel') {
        punishTier = enemy.soulsPunishWindow;
        if (!hitMeta?.soulsPipeline) {
          finalAmount *= Math.max(1, Number(enemy.soulsPunishDmgMult) || 1);
        }
      }
    }

    const wasParryRiposte = !isKneelRiposte && (enemy.parriedRiposteTimer || 0) > 0;
    let isSoulsPierceCounter = false;
    let hitEnemyFrontShield = false;
    let dmg = 1;

    const hasPhysicalFrontShield = Boolean(
      enemy.frontArmor > 0 &&
      !enemy.isSoulsBoss &&
      (!enemy.isSoulsUnit ||
        enemy.soulsRole === 'guard' ||
        enemy.type === 'cursed_footman' ||
        enemy.type === 'ember_skeleton')
    );
    const isEnemyShieldRaised = Boolean(
      hasPhysicalFrontShield &&
      !isKneelRiposte &&
      !wasParryRiposte &&
      !isKneelCrit &&
      (enemy.stunTimer || 0) <= 0 &&
      (enemy.staggeredTimer || 0) <= 0 &&
      (enemy.poiseMicroStunTimer || 0) <= 0 &&
      enemy.soulsState !== 'stagger_kneel' &&
      enemy.soulsState !== 'stagger_recover' &&
      enemy.soulsState !== 'riposte_victim' &&
      enemy.soulsState !== 'riposte_recover' &&
      enemy.aiState !== 'windup' &&
      enemy.aiState !== 'recover' &&
      (!enemy.aiState || enemy.aiState !== 'active' || enemy.currentAttackMeta?.moveType === 'shield_bash')
    );

    if (isSoulslike && hitMeta?.soulsPipeline && !isDoT) {
      // Full Elden Ring 5-piece ATK/FlatDEF + Multiplicative Negation + Pierce Counter (1.30x) + Riposte FlatDEF Bypass
      const targetInAttackWindow = Boolean(
        enemy.currentAttackMeta ||
        enemy.soulsActiveAttack ||
        enemy.soulsState === 'windup' ||
        enemy.soulsState === 'active' ||
        enemy.soulsState === 'overhead_cleave' ||
        enemy.soulsState === 'sweep_combo' ||
        enemy.soulsState === 'aaa_combo' ||
        enemy.soulsState === 'delayed_crush' ||
        enemy.soulsState === 'leap_slam' ||
        enemy.soulsState === 'whirl_spin' ||
        enemy.soulsState === 'rising_upcut' ||
        enemy.soulsState === 'ram_thrust_hook'
      );
      const bypassFlatDef = isKneelRiposte || wasParryRiposte;
      const punishMult =
        (punishTier ? Math.max(1, Number(enemy.soulsPunishDmgMult) || 1) : 1.0) *
        (isKneelCrit ? 1.5 : 1.0);
      const riposteMult = isKneelRiposte ? 2.4 : wasParryRiposte ? 2.2 : 1.0;
      const dmgRes = computeSoulsDamage({
        baseAR: hitMeta.baseAR ?? stats?.damage ?? 62,
        motionValue: hitMeta.motionValue ?? 1.0,
        flatDef: enemy.flatDef ?? (enemy.isSoulsBoss ? 22 : 16),
        negations: [enemy.physNegation ?? enemy.armor ?? 0],
        isPierce: Boolean(hitMeta.isPierce),
        targetInAttackWindow,
        punishMult,
        critMult: riposteMult,
        bypassFlatDef
      });
      dmg = dmgRes.finalDamage;
      isSoulsPierceCounter = Boolean(dmgRes.isPierceCounter);

      // Spearman / Shieldbearer Frontal Steel Shield (±75° dot-product check on Hero melee strikes!)
      if (!isProjectile && isEnemyShieldRaised) {
        const fx = Math.sin(enemy.facing);
        const fz = Math.cos(enemy.facing);
        const toHeroDx = player.x - enemy.x;
        const toHeroDz = player.z - enemy.z;
        const toHeroLen = Math.hypot(toHeroDx, toHeroDz) || 1;
        const dot = fx * (toHeroDx / toHeroLen) + fz * (toHeroDz / toHeroLen);
        if (dot >= COS_75_DEG) {
          hitEnemyFrontShield = true;
          const pierce = clamp(hitMeta?.armorPierceOverride ?? stats?.armorPierce ?? 0, 0, 1);
          const shieldMit = clamp(enemy.frontArmor * (1 - pierce * 0.55) * 0.65, 0, 0.55);
          dmg = Math.max(1, Math.round(dmg * (1 - shieldMit)));
          kx *= 0.45;
          kz *= 0.45;
          if (shieldSparkCooldown <= 0) {
            shieldSparkCooldown = 0.035;
            if (typeof audio?.playEnemyShieldHit === 'function') {
              audio.playEnemyShieldHit({ heavy: Boolean(hitMeta?.isHeavy || isComboFinisher) });
            } else {
              audio?.playBlock?.();
            }
            emitParticles(enemy.x + fx * 0.45, 0.94, enemy.z + fz * 0.45, 0x93c5fd, 6, 5.2, 0.11);
            emitParticles(enemy.x + fx * 0.45, 0.94, enemy.z + fz * 0.45, 0xffffff, 4, 4.2, 0.09);
          }
        }
      }
    } else {
      // 🩸 Казнь Кровопийцы (war_blood_cleave): +50% execution damage against wounded enemies (<45% HP)!
      if (!isDoT && (stats?.warBloodStacks || 0) > 0 && enemy.hp < enemy.maxHp * 0.45) {
        finalAmount *= 1 + stats.warBloodStacks * 0.50;
      }

      // ⚔️ Удар Палача (executioner_cleave): +25% execution damage against wounded enemies (<40% HP)!
      if (!isDoT && (stats?.executionerStacks || 0) > 0 && enemy.hp < enemy.maxHp * 0.40) {
        finalAmount *= 1 + stats.executionerStacks * 0.25;
      }

      // 🔥 Fire Element (Batrider Napalm): existing Napalm stacks amplify incoming damage by +12% per stack!
      if (!isDoT && hitElem === 'fire' && (enemy.napalmStacks || 0) > 0 && (enemy.napalmTimer || 0) > 0) {
        finalAmount *= 1 + enemy.napalmStacks * 0.12;
      }

      // General Mob Armor vs Hero Weapon Armor Penetration (armorPierce)
      const pierce = clamp(hitMeta?.armorPierceOverride ?? stats?.armorPierce ?? 0, 0, 1);
      if (!isDoT && enemy.armor > 0) {
        const effArmor = Math.max(0, enemy.armor * (1 - pierce));
        finalAmount *= 1 - effArmor;
      }

      // Shieldbearer Frontal Steel Shield (±75° dot-product check!)
      if (!isDoT && !isCrit && isEnemyShieldRaised) {
        const fx = Math.sin(enemy.facing);
        const fz = Math.cos(enemy.facing);
        let toSourceX = 0;
        let toSourceZ = 0;
        if (isProjectile) {
          toSourceX = -(hitMeta?.dirX || 0);
          toSourceZ = -(hitMeta?.dirZ || 0);
        } else {
          const dxP = player.x - enemy.x;
          const dzP = player.z - enemy.z;
          const lenP = Math.hypot(dxP, dzP) || 1;
          toSourceX = dxP / lenP;
          toSourceZ = dzP / lenP;
        }
        const dot = fx * toSourceX + fz * toSourceZ;

        if (dot >= COS_75_DEG) {
          hitEnemyFrontShield = true;
          // Point-blank < 3.2m shotgun blasts bypass half the shield, plus armorPierce penetrates shields!
          const isPointBlankBuckshot = Boolean(hitMeta?.isShotgunPellet && (hitMeta?.traveled || 0) < 3.2);
          const baseFront = isPointBlankBuckshot ? enemy.frontArmor * 0.5 : enemy.frontArmor;
          const armorMult = baseFront * (1 - pierce * 0.55);
          finalAmount *= 1 - armorMult;
          kx *= isPointBlankBuckshot ? 0.65 : 0.35;
          kz *= isPointBlankBuckshot ? 0.65 : 0.35;

          if (shieldSparkCooldown <= 0) {
            shieldSparkCooldown = 0.04;
            if (typeof audio?.playEnemyShieldHit === 'function') {
              audio.playEnemyShieldHit({ heavy: Boolean(hitMeta?.isHeavy || isComboFinisher) });
            } else {
              audio?.playBlock?.();
            }
            emitParticles(enemy.x + fx * 0.45, 0.88, enemy.z + fz * 0.45, 0x93c5fd, 5, 5.2, 0.12);
            emitParticles(enemy.x + fx * 0.45, 0.88, enemy.z + fz * 0.45, 0xffffff, 3, 4.0, 0.09);
          }
        }
      }

      dmg = Math.max(1, Math.round(finalAmount * (wasParryRiposte ? 2.2 : 1.0)));
    }

    if (isKneelRiposte) {
      enemy.parriedRiposteTimer = 0;
      enemy.staggeredTimer = Math.min(enemy.staggeredTimer || 0, 0.65);
      // Elden Ring Critical Riposte: 100% i-frames (1.05s) + resonant impact!
      player.invulnTimer = Math.max(player.invulnTimer || 0, SOULS_GUARD_CFG.riposteInvulnSec);
      triggerHitStop(soulsGameFeel.HITSTOP_PRESETS.riposte, true);
      audio?.playRiposteImpact?.();
      audio?.playArmorBreak?.('shield');
      world?.addScreenShake?.(0.42, 0.22);
      emitSoulsSparkBurst('stance_break', enemy.x, enemy.z, enemy.x - player.x, enemy.z - player.z);
      floatText(`⚡ РИПОСТ! -${dmg}`, enemy.x, enemy.z - 0.9, '#fde047');
    } else if (wasParryRiposte) {
      enemy.parriedRiposteTimer = 0;
      if (isSoulslike) {
        player.invulnTimer = Math.max(player.invulnTimer || 0, 0.85);
      }
      triggerHitStop(soulsGameFeel.HITSTOP_PRESETS.riposte, true);
      audio?.playRiposteImpact?.();
      emitSoulsSparkBurst('stance_break', enemy.x, enemy.z, enemy.x - player.x, enemy.z - player.z);
      floatText(`⚔️ РИПОСТ -${dmg}!`, enemy.x, enemy.z - 0.6, '#fde047');
    } else if (isKneelCrit) {
      emitParticles(enemy.x, 1.4, enemy.z, 0xfde047, 10, 5.8, 0.13);
    } else if (isSoulsPierceCounter) {
      emitParticles(enemy.x, 1.05, enemy.z, 0x38bdf8, 10, 5.6, 0.12);
      floatText(`⚡ КОНТР-УКОЛ ×1.3 (-${dmg})`, enemy.x, enemy.z - 0.85, '#38bdf8');
    }
    if (punishTier) {
      emitParticles(enemy.x, 1.3, enemy.z, 0xfde047, punishTier === 'heavy' ? 12 : 8, 6.2, 0.13);
      if (!enemy.soulsPunishTagShown && !wasParryRiposte && !isKneelRiposte) {
        enemy.soulsPunishTagShown = true;
        const multTxt = (Math.max(1, Number(enemy.soulsPunishDmgMult) || 1)).toFixed(2);
        triggerHitStop(0.045, true);
        emitShockwave(enemy.x, enemy.z, 2.6, 0xfde047, 0.26);
        floatText(`🎯 НАКАЗАНИЕ ×${multTxt}!`, enemy.x, enemy.z - 0.9, '#fde047');
      }
    }
    if (enemy.isSoulsUnit && !enemy.soulsAwake) {
      enemy.soulsAwake = true;
      if (
        enemy.soulsState !== 'stagger_kneel' &&
        enemy.soulsState !== 'riposte_victim' &&
        enemy.soulsState !== 'riposte_recover'
      ) {
        enemy.soulsState = 'stalk';
        enemy.soulsTimer = 0.45;
      }
    }
    enemy.hp -= dmg;

    const resistMult = enemy.isTrainingDummy
      ? 0
      : enemy.isMiniBoss
      ? 0.28
      : enemy.isBoss
        ? 0.14
        : enemy.isWarden
          ? 0.32
          : enemy.canCharge
            ? 0.52
            : 1.0;
    if (isSoulslike && !isDoT && enemy.isSoulsUnit) {
      const kMag = Math.hypot(kx, kz);
      const isHeavyHit = Boolean(hitMeta?.isHeavy || isComboFinisher || isKneelRiposte || wasParryRiposte || hitMeta?.attackKey === 'guard_counter');
      if (kMag > 0.01 && !enemy.isTrainingDummy && enemy.soulsState !== 'riposte_recover') {
        const impulseMag = Math.max(isHeavyHit ? 4.4 : 2.6, kMag * (isHeavyHit ? 1.05 : 0.72));
        applyKnockbackImpulse(enemy, kx, kz, impulseMag, { isHeavy: isHeavyHit });
      }
      if (!isProjectile) {
        if (enemy.isSoulsBoss) {
          // Spawn sparks & impact ring right on the Boss's front armor plate facing the Hero (not buried inside enemy.x/z!)
          const dxP = player.x - enemy.x;
          const dzP = player.z - enemy.z;
          const dP = Math.hypot(dxP, dzP) || 1;
          const nxP = dxP / dP;
          const nzP = dzP / dP;
          const surfDist = Math.min(dP * 0.72, 1.38);
          const hitX = enemy.x + nxP * surfDist;
          const hitZ = enemy.z + nzP * surfDist;
          const hitY = 1.26;
          const bossSparkTier = isKneelRiposte || wasParryRiposte || hitMeta?.attackKey === 'guard_counter' || isHeavyHit
            ? 'parry'
            : 'heavy';
          spawnSoulsClashSparks(hitX, hitY, hitZ, nxP, 0.36, nzP, bossSparkTier);
          emitParticles(hitX, hitY, hitZ, 0xe7e5e4, isHeavyHit ? 9 : 6, 4.6, 0.09);
          world?.spawnShockwaveRing?.({
            x: hitX,
            y: hitY,
            z: hitZ,
            radius: isHeavyHit ? 0.92 : 0.64,
            color: 0xfef3c7,
            duration: 0.14
          });
        } else if (!hitEnemyFrontShield) {
          const pullC = Math.min(enemy.isBoss ? 1.15 : 0.32, (enemy.radius || 0.45) * 0.65);
          const hLen = kMag > 0.01 ? kMag : 1;
          const cNx = -kx / hLen;
          const cNz = -kz / hLen;
          const sparkTier = isKneelRiposte || wasParryRiposte || hitMeta?.attackKey === 'guard_counter'
            ? 'parry'
            : isHeavyHit || isSoulsPierceCounter
              ? 'heavy'
              : 'light';
          spawnSoulsClashSparks(enemy.x + cNx * pullC, 0.96, enemy.z + cNz * pullC, cNx, 0.32, cNz, sparkTier);
        }
      }
      // Souls units use stepActorPhysicsBody (physVx/physVz); never accumulate into legacy e.vx/e.vz!
      enemy.vx = 0;
      enemy.vz = 0;
    } else {
      enemy.vx += kx * resistMult;
      enemy.vz += kz * resistMult;
    }

    const willTriggerBossEscape = Boolean(
      isSoulslike && enemy.isSoulsBoss && enemy.hp <= 0 && !souls.escapeCutsceneActive && !souls.bossEscaped
    );
    if (!isDoT && !willTriggerBossEscape) {
      triggerModelHitFlash(enemy.model);
      if (enemy.isSoulsBoss && enemy.model?.obj) {
        triggerSoulsBossHitFlash(enemy.model.obj, Boolean(hitMeta?.isHeavy || isComboFinisher) ? 1.15 : 0.86);
      }
      if (!enemy.isSoulsBoss && !hitEnemyFrontShield && enemy.hp > 0 && elapsedRunTime - (enemy._lastMobHurtSfxAt || -9) >= 0.14) {
        enemy._lastMobHurtSfxAt = elapsedRunTime;
        audio?.playMobHurt?.(enemy.type, getMobAudioDistNorm(enemy));
      }
      if (enemy.hp > 0) {
        if (enemy.isSoulsUnit && !enemy.isSoulsBoss && !enemy.soulsAwake) {
          enemy.soulsAwake = true;
          enemy.isAmbushGuard = false;
        }
        if (isSoulslike || enemy.isSoulsUnit) {
          const evalPoiseFn = poiseCtrl.evaluateEnemyPoiseHit || poiseCtrl.evaluateEnemyHitReact;
          const isHeavyStrike = Boolean(
            hitMeta?.isHeavy ||
              isComboFinisher ||
              hitMeta?.attackKey === 'guard_counter' ||
              hitMeta?.attackKey === 'charged_r2' ||
              hitMeta?.attackKey === 'r2'
          );
          const atkKeyRaw = hitMeta?.attackKey || null;
          const swingDir =
            atkKeyRaw === 'r1_2'
              ? 'left_to_right'
              : atkKeyRaw === 'r1_3' ||
                  atkKeyRaw === 'r2' ||
                  atkKeyRaw === 'charged_r2' ||
                  atkKeyRaw === 'guard_counter'
                ? 'center'
                : atkKeyRaw === 'r1_1' || atkKeyRaw === 'rolling_r1'
                  ? 'right_to_left'
                  : (player.comboStep || 0) === 2
                    ? 'left_to_right'
                    : (player.comboStep || 0) === 3 || isHeavyStrike
                      ? 'center'
                      : 'right_to_left';

          const poiseRes = evalPoiseFn.call(poiseCtrl, enemy, {
            damage: dmg,
            weaponId: hitMeta?.weaponId || (!isProjectile ? currentWeaponId : null),
            isHeavy: isHeavyStrike,
            attackKey: atkKeyRaw,
            swingDir,
            motionValue: hitMeta?.motionValue || null,
            stanceDmg: hitMeta?.stanceDmg || null,
            isGuardCounter: Boolean(atkKeyRaw === 'guard_counter'),
            isChargedHeavy: Boolean(atkKeyRaw === 'charged_r2'),
            isCounter: Boolean(atkKeyRaw === 'guard_counter' || isSoulsPierceCounter),
            isPierceCounter: Boolean(isSoulsPierceCounter),
            isCrit,
            isComboFinisher,
            isProjectile,
            isShotgunPellet: Boolean(hitMeta?.isShotgunPellet),
            isSplash,
            isBarrelBlast,
            isWaterSlam,
            isParryRiposte: wasParryRiposte,
            isDoT,
            isSoulslike: true
          });
          const poiseTriggered = Boolean(poiseRes.shouldStun || poiseRes.shouldReact);
          const interruptsBossAtk = Boolean(poiseRes.interruptsActiveAttack || poiseRes.interruptsAttack);
          if (enemy.isSoulsBoss) {
            const bossKneelOrRiposte =
              enemy.soulsState === 'stagger_kneel' ||
              enemy.soulsState === 'stagger_recover' ||
              enemy.soulsState === 'riposte_victim';
            const bossInNeutral =
              enemy.soulsState === 'stalk' ||
              enemy.soulsState === 'idle' ||
              enemy.soulsState === 'recover' ||
              enemy.soulsState === 'hit_react';
            const bossDirClip =
              poiseRes.clipName ||
              poiseRes.flinchAnim ||
              (swingDir === 'left_to_right'
                ? 'Hit_React_Left'
                : swingDir === 'center'
                  ? 'Hit_React_Gut'
                  : 'Hit_React');
            const bossClipSpeed = poiseRes.clipSpeed || 1.35;
            const subtleOverlayOnly = Boolean(poiseRes.playSubtleOverlayOnly);

            if (bossKneelOrRiposte) {
              enemy.model?.handle?.triggerHitReact?.({
                playClip: false,
                interruptAttack: false,
                dirX: kx,
                dirZ: kz,
                isHeavy: Boolean(hitMeta?.isHeavy || isComboFinisher),
                joltScale: 0.18
              });
            } else if (interruptsBossAtk) {
              cancelSoulsBossTelegraph(enemy, elapsedRunTime);
              enemy._soulsActiveSwing = null;
              enemy.soulsActiveAttack = null;
              enemy.soulsMoveType = null;
              enemy.currentAttackMeta = null;
              enemy.soulsPosturePhase = 'recover';
              enemy.soulsPosturePhase01 = 0;
              enemy._soulsDelayHoldArmed = false;
              enemy._soulsDelayHoldRem = 0;
              enemy._soulsDelaySnapped = false;
              enemy.soulsState = 'hit_react';
              enemy.soulsTimer = poiseRes.microStunSec || 0.36;
              if (enemy._trailRecording) {
                weaponTrails?.endSwing?.(enemy.uid);
                enemy._trailRecording = false;
              }
              enemy.model?.handle?.setClipOverride?.(null);
              enemy.model?.handle?.clearClampedClip?.(false, 0.08);
              enemy.model?.handle?.setActiveAttackTimeScale?.(1.0);
              audio?.stopBossRoar?.(0.10);
              enemy.model?.handle?.setBossMouthOpen?.(0);
              enemy.model?.handle?.triggerHitReact?.({
                playClip: true,
                clipName: bossDirClip,
                speed: bossClipSpeed,
                interruptAttack: true,
                forceRestart: true,
                blendInSec: 0.06,
                blendOutSec: 0.14,
                dirX: kx,
                dirZ: kz,
                isHeavy: Boolean(hitMeta?.isHeavy || isComboFinisher),
                joltScale: 0.32
              });
            } else if (subtleOverlayOnly || !bossInNeutral) {
              // Boss is in Hyper-Armor or >2 consecutive hits: NEVER cancel Boss's attack,
              // apply restrained directional upper-torso recoil impulse so every hit visibly registers!
              enemy.model?.handle?.triggerHitReact?.({
                playClip: false,
                interruptAttack: false,
                dirX: kx,
                dirZ: kz,
                isHeavy: Boolean(hitMeta?.isHeavy || isComboFinisher),
                joltScale: Math.min(0.34, poiseRes.joltScale || 0.24)
              });
            } else {
              // Neutral (stalk / idle / recover) when !playSubtleOverlayOnly: play subtle directional Hit_React
              audio?.stopBossRoar?.(0.10);
              enemy.model?.handle?.setBossMouthOpen?.(0);
              enemy.model?.handle?.triggerHitReact?.({
                playClip: true,
                clipName: bossDirClip,
                speed: bossClipSpeed,
                interruptAttack: true,
                forceRestart: true,
                blendInSec: 0.05,
                blendOutSec: 0.13,
                dirX: kx,
                dirZ: kz,
                isHeavy: Boolean(hitMeta?.isHeavy || isComboFinisher),
                joltScale: 0.30
              });
              if (enemy.soulsState === 'stalk' || enemy.soulsState === 'idle' || enemy.soulsState === 'recover') {
                enemy.soulsState = 'hit_react';
                enemy.soulsTimer = Math.max(0.24, poiseRes.microStunSec || 0.32);
              }
            }
          } else if (enemy.soulsState === 'riposte_recover') {
            // Keep natural 2.30s Riposte_Stand_Up playing without snapping upright into standing Hit_React!
            enemy.model?.handle?.triggerHitReact?.({
              playClip: false,
              interruptAttack: false,
              dirX: kx,
              dirZ: kz,
              isHeavy: Boolean(hitMeta?.isHeavy || isComboFinisher),
              joltScale: 0.30
            });
          } else if (poiseTriggered && !hitEnemyFrontShield) {
            const reactClip = poiseRes.flinchAnim || poiseRes.clipName;
            const reactSpeed = poiseRes.clipSpeed;
            // Dark Souls Hit-Interrupt on regular Souls mobs:
            // Any poise-breaking hit cancels active/windup attack, wipes _mobActiveSwing, and locks attack until Hit_React ends!
            if (enemy.isSoulsUnit && !enemy.isSoulsBoss) {
              enemy._mobActiveSwing = null;
              if (enemy._trailRecording) {
                weaponTrails?.endSwing?.(enemy.uid);
                enemy._trailRecording = false;
              }
              onSoulsMobInterrupted(enemy, Math.max(0.56, (poiseRes.microStunSec || 0.54) + 0.14));
              enemy.model?.handle?.cancelAttackAnim?.();
            }
            enemy.model?.handle?.triggerHitReact?.({
              playClip: true,
              clipName: reactClip,
              speed: reactSpeed,
              interruptAttack: true,
              forceRestart: true,
              blendInSec: 0.035,
              blendOutSec: 0.10,
              dirX: kx,
              dirZ: kz,
              isHeavy: Boolean(hitMeta?.isHeavy || isComboFinisher),
              joltScale: Math.max(0.90, poiseRes.joltScale || 0.90)
            });
          } else if (poiseRes.joltScale > 0 || hitEnemyFrontShield) {
            enemy.model?.handle?.triggerHitReact?.({
              playClip: false,
              dirX: kx,
              dirZ: kz,
              isHeavy: Boolean(hitMeta?.isHeavy || isComboFinisher),
              joltScale: hitEnemyFrontShield
                ? (Boolean(hitMeta?.isHeavy || isComboFinisher) ? 0.58 : 0.42)
                : Math.max(Boolean(hitMeta?.isHeavy || isComboFinisher) ? 0.92 : 0.72, poiseRes.joltScale || 0)
            });
          }
        } else {
          // Classic responsive PvE hit flinch (single recoil impulse — zero double-snap!)
          enemy.model?.handle?.triggerHitReact?.({
            playClip: false,
            dirX: kx,
            dirZ: kz,
            joltScale: isCrit || isComboFinisher ? 0.92 : 0.68
          });
        }
      }
      // Bone-splinter chip particles when hitting skeletons!
      if (!hitEnemyFrontShield) {
        emitParticles(enemy.x, 0.78, enemy.z, 0xe7e0d0, 2, 3.6, 0.09);
      }

      if (!hitEnemyFrontShield && (enemy.isSoulsBoss || hitSoundCooldown <= 0)) {
        hitSoundCooldown = isSoulslike && !isProjectile ? 0.025 : 0.045;
        if (isSoulslike && !isProjectile) {
          if ((hitMeta?.weaponId || currentWeaponId) === 'great_club' && typeof audio?.playBossHammerHit === 'function') {
            audio.playBossHammerHit(hitMeta?.isHeavy || isComboFinisher ? 0.86 : 0.64);
          }
          if (typeof audio?.playSwordHit === 'function') {
            const targetKind = enemy.isSoulsBoss
              ? 'boss_flesh'
              : (enemy.type === 'bone_archer' || (enemy.flatDef || 0) < 15)
                ? 'unarmored'
                : 'armored_knight';
            audio.playSwordHit({
              targetKind,
              armored: targetKind === 'armored_knight',
              isHeavy: Boolean(hitMeta?.isHeavy || isComboFinisher),
              isCounter: Boolean(hitMeta?.attackKey === 'guard_counter' || isSoulsPierceCounter)
            });
          } else {
            audio?.playHit?.(hitMeta?.weaponId || currentWeaponId);
          }
        } else if (hitElem) {
          audio?.playElementImpact?.(hitElem);
        } else {
          audio?.playHit?.(hitMeta?.weaponId || (!isProjectile ? currentWeaponId : null));
        }
      }

      // 🛡️🪖 3-Stage Progressive Shield (≤67% HP) & Helmet (≤34% HP) Break-Off!
      if (!enemy.isBoss && enemy.hp > 0) {
        const hitDirAng = Math.atan2(kx || 0.1, kz || 0.1);
        if (enemy.hp <= enemy.maxHp * 0.67 && (enemy.damageStage || 0) < 1) {
          enemy.damageStage = 1;
          const brokenPart = enemy.model?.handle?.setDamageStage?.(1);
          if (brokenPart) {
            enemy.frontArmor = 0;
            world?.spawnArmorBreakPiece?.('shield', enemy.x, enemy.z, hitDirAng);
            audio?.playArmorBreak?.('shield');
            if (critFloaterCooldown <= 0) {
              critFloaterCooldown = 0.08;
              floatText('🛡️ ЩИТ СБИТ!', enemy.x, enemy.z, '#93c5fd');
            }
          }
        }
        if (enemy.hp <= enemy.maxHp * 0.34 && (enemy.damageStage || 0) < 2) {
          enemy.damageStage = 2;
          const brokenHelm = enemy.model?.handle?.setDamageStage?.(2);
          if (brokenHelm) {
            world?.spawnArmorBreakPiece?.('helmet', enemy.x, enemy.z, hitDirAng);
            audio?.playArmorBreak?.('helmet');
            if (critFloaterCooldown <= 0) {
              critFloaterCooldown = 0.08;
              floatText('🪖 КАСКА СЛЕТЕЛА!', enemy.x, enemy.z, '#cbd5e1');
            }
          }
        }
      }

      if (isCrit) {
        triggerHitStop(0.036);
        const hitLen = Math.hypot(kx, kz) || 1;
        const cDirX = kx ? kx / hitLen : 0;
        const cDirZ = kz ? kz / hitLen : 1;
        world?.spawnCritBloodBurst?.({ x: enemy.x, z: enemy.z, dirX: cDirX, dirZ: cDirZ });
        audio?.playCritStrike?.();
        world?.addScreenShake?.(0.20, 0.12);
        if (critFloaterCooldown <= 0) {
          critFloaterCooldown = 0.09;
          floatText(`🩸 КРИТ ${dmg}!`, enemy.x, enemy.z, '#fca5a5');
        }
        // 💀 Жнец Черепов (crit_fang): crit triggers crimson blood-shrapnel burst on nearby enemies (ZERO flat red circle)!
        const critBlastStacks = stats?.critExplosionStacks || 0;
        if (critBlastStacks > 0 && allowChain) {
          emitParticles(enemy.x, 0.85, enemy.z, 0xdc2626, 12, 6.8, 0.16);
          damageEnemiesInRadius(enemy.x, enemy.z, 2.2, Math.max(2, Math.round(dmg * 0.35 * critBlastStacks)), 4.5, enemy, false);
        }
        // ⚡ Цепь Молний (crit_chain_lightning): crit arcs lightning into 2+ nearest enemies!
        const critChainStacks = stats?.critChainStacks || 0;
        if (critChainStacks > 0 && allowChain) {
          const bounceCount = 1 + critChainStacks; // 2 targets at rank 1, 3 at rank 2, 4 at rank 3
          const chainDmg = Math.max(4, Math.round(dmg * (0.48 + critChainStacks * 0.12)));
          triggerChainLightning(enemy, chainDmg, bounceCount, 0x38bdf8);
          audio?.playElementImpact?.('lightning');
        }
      } else {
        emitParticles(
          enemy.x,
          0.65,
          enemy.z,
          enemy.eliteType === 'purple' ? 0xc084fc : 0xfef08a,
          4,
          4.0,
          0.12
        );
      }

      // ❄️ Ледяной Раскол (frost_shatter): hits/projectiles chill enemies so they shatter on death!
      const frostShatterStacks = stats?.frostShatterStacks || 0;
      if (frostShatterStacks > 0 && !isSplash) {
        enemy.frostTimer = Math.max(enemy.frostTimer || 0, 2.4 + frostShatterStacks * 0.5);
        enemy.frostFactor = Math.min(enemy.frostFactor || 1.0, Math.max(0.42, 0.68 - frostShatterStacks * 0.08));
        emitParticles(enemy.x, 0.70, enemy.z, 0x7dd3fc, 3, 2.8, 0.10);
      }

      // 🔫 Рикошет Свинца (gun_ricochet): buckshot pellets bounce to a nearby enemy!
      const ricochetStacks = stats?.gunRicochetStacks || 0;
      if (allowChain && hitMeta?.isShotgunPellet && ricochetStacks > 0) {
        const ricChance = Math.min(1.0, 0.25 + ricochetStacks * 0.25);
        if (Math.random() < ricChance) {
          triggerChainLightning(enemy, Math.max(2, Math.round(dmg * 0.65)), 1, 0xfbbf24);
        }
      }

      // === 4 MAGE ELEMENTAL EFFECTS ===
      const catStacks = stats?.mageCatalystStacks || 0;
      if (hitElem === 'fire') {
        const addStacks = 1 + (catStacks > 0 ? 1 : 0);
        const maxNapalm = 8 + catStacks * 2;
        enemy.napalmStacks = Math.min(maxNapalm, ((enemy.napalmTimer || 0) > 0 ? (enemy.napalmStacks || 0) : 0) + addStacks);
        enemy.napalmTimer = 4.2;
        enemy.burnTimer = Math.max(enemy.burnTimer || 0, 3.0);
        enemy.burnDps = Math.max(enemy.burnDps || 0, Math.max(4, Math.round((stats?.damage || 24) * (0.14 + enemy.napalmStacks * 0.08))));
        emitParticles(enemy.x, 0.72, enemy.z, 0xff5722, 5, 3.8, 0.13);
        if (enemy.napalmStacks >= 2 && enemy.napalmStacks % 2 === 0 && critFloaterCooldown <= 0) {
          critFloaterCooldown = 0.14;
          floatText(`🔥×${enemy.napalmStacks}`, enemy.x, enemy.z, '#fb923c');
        }
      } else if (hitElem === 'water') {
        enemy.soakedTimer = 3.0;
        enemy.frostTimer = Math.max(enemy.frostTimer || 0, 2.6);
        enemy.frostFactor = Math.min(enemy.frostFactor || 1.0, 0.58);
        emitParticles(enemy.x, 0.68, enemy.z, 0x38bdf8, 5, 3.4, 0.12);

        // 💧 STRICTLY FOR MAGE + WATER ELEMENT: 7% chance (+5% per Резонанс Стихии stack) to spawn Avatar-style levitating Water Sphere!
        // Lifts enemies in small radius into the air for 1.1s, then slams them down for 3x normal attack damage!
        if (
          currentClassId === 'mage' &&
          !isWaterSlam &&
          !isSplash &&
          (enemy.waterLiftTimer || 0) <= 0 &&
          activeWaterPrisons.length < 4
        ) {
          const waterSphereChance = 0.07 + catStacks * 0.05;
          if (Math.random() < waterSphereChance) {
            const sphereRad = 2.65;
            const sphereDur = 1.1;
            const captured = [];
            for (let ci = 0; ci < enemies.length; ci++) {
              const ce = enemies[ci];
              if (!ce || ce.hp <= 0) continue;
              if (Math.hypot(ce.x - enemy.x, ce.z - enemy.z) <= sphereRad + ce.radius * 0.5) {
                ce.waterLiftTimer = sphereDur;
                ce.stunTimer = Math.max(ce.stunTimer || 0, sphereDur + 0.15);
                ce.vx = 0;
                ce.vz = 0;
                captured.push(ce);
              }
            }
            if (captured.length > 0) {
              const normalAttackDmg = stats?.damage || 28;
              world?.spawnWaterPrisonSphere?.({ x: enemy.x, z: enemy.z, radius: sphereRad, duration: sphereDur });
              audio?.playElementImpact?.('water_prison_open');
              floatText('🌊 ВОДЯНОЙ ШАР!', enemy.x, enemy.z, '#38bdf8');
              activeWaterPrisons.push({
                x: enemy.x,
                z: enemy.z,
                radius: sphereRad,
                timer: sphereDur,
                duration: sphereDur,
                slamDamage: Math.max(3, Math.round(normalAttackDmg * 3.0)),
                targets: captured
              });
            }
          }
        }
      } else if (hitElem === 'lightning' && allowChain) {
        const bounceTargets = 1 + catStacks;
        const arcDmg = Math.max(2, Math.round(dmg * (0.58 + catStacks * 0.12)));
        triggerChainLightning(enemy, arcDmg, bounceTargets, 0x38bdf8);
      } else if (hitElem === 'air') {
        enemy.stunTimer = Math.max(enemy.stunTimer || 0, enemy.isBoss ? 0.06 : 0.24);
        emitParticles(enemy.x, 0.72, enemy.z, 0x5eead4, 5, 4.4, 0.12);
      }
      // 💫 Boss / Souls Mob Stance buildup:
      //   - Abandoned Knight Rift (isSoulslike / isSoulsUnit): 100% deterministic STANCE_DAMAGE_TABLE (ZERO RNG crits!)
      //   - PvE (Chapters 1-25 / Endless): classic stagger buildup untouched
      if (enemy.hp > 0 && enemy.staggerMax > 0) {
        if (isSoulslike || enemy.isSoulsUnit) {
          const detStance = Number(hitMeta?.stanceDmg);
          const stanceGain =
            Number.isFinite(detStance) && detStance > 0
              ? detStance
              : isComboFinisher
                ? STANCE_DAMAGE_TABLE.r1Finisher
                : STANCE_DAMAGE_TABLE.r1;
          addBossStagger(enemy, stanceGain);
        } else {
          let staggerGain = 0;
          if (isBarrelBlast) staggerGain += 48;
          if (isComboFinisher) staggerGain += 26;
          if (isCrit) staggerGain += 20;
          if (isWaterSlam) staggerGain += 22;
          const wId = hitMeta?.weaponId;
          if (wId === 'boss_hammer' || wId === 'zweihander' || wId === 'axe') {
            staggerGain += 12;
          } else if (wId === 'spear' || (hitMeta?.isShotgunPellet && dmg >= 8)) {
            staggerGain += 6;
          }
          if (staggerGain === 0) {
            staggerGain = dmg >= enemy.maxHp * 0.04 ? 12 : 4;
          }
          addBossStagger(enemy, staggerGain);
        }
      }
    }

    if (enemy.isTrainingDummy) {
      if (enemy.hp < enemy.maxHp * 0.25) enemy.hp = enemy.maxHp;
    } else if (enemy.hp <= 0) {
      if (isSoulslike && enemy.isSoulsBoss && !souls.escapeCutsceneActive && !souls.bossEscaped) {
        enemy.hp = 1;
        enemy._deadHandled = false;
        startBossEscapeCutscene(enemy);
        return;
      }
      handleEnemyDeath(enemy);
    }
  }

  function triggerChainLightning(originEnemy, chainDamage, maxBounces = 1, boltColor = 0x38bdf8) {
    if (isSoulslike) return;
    let bounced = 0;
    let bestCandidates = [];
    for (let i = 0; i < enemies.length; i++) {
      const candidate = enemies[i];
      if (candidate === originEnemy || candidate.hp <= 0) continue;
      const dist = Math.hypot(candidate.x - originEnemy.x, candidate.z - originEnemy.z);
      if (dist <= 6.8) {
        bestCandidates.push({ candidate, dist });
      }
    }
    bestCandidates.sort((a, b) => a.dist - b.dist);
    for (let i = 0; i < bestCandidates.length && bounced < maxBounces; i++) {
      const { candidate } = bestCandidates[i];
      bounced += 1;
      world?.spawnLightningArc?.({
        x1: originEnemy.x,
        z1: originEnemy.z,
        x2: candidate.x,
        z2: candidate.z,
        color: boltColor
      });
      candidate.stunTimer = Math.max(candidate.stunTimer || 0, candidate.isBoss ? 0.05 : 0.16);
      emitParticles(candidate.x, 0.78, candidate.z, boltColor, 6, 4.2, 0.14);
      applyDamageToEnemy(candidate, chainDamage, 0, 0, false);
    }
  }

  function damageEnemiesInRadius(cx, cz, radius, damage, knockbackForce, excludeEnemy = null, canCrit = false, mageElement = null, extraHitMeta = null) {
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (!e || e === excludeEnemy || e.hp <= 0) continue;
      const dx = e.x - cx;
      const dz = e.z - cz;
      const dist = Math.hypot(dx, dz);
      if (dist <= radius + e.radius) {
        const nx = dist > 0.001 ? dx / dist : 0;
        const nz = dist > 0.001 ? dz / dist : 1;
        const isCrit = canCrit && Math.random() < (stats?.critChance || 0.04);
        const hitDmg = isCrit ? Math.round(damage * (stats?.critMult || 1.75)) : damage;
        applyDamageToEnemy(e, hitDmg, nx * knockbackForce, nz * knockbackForce, false, {
          isCrit,
          isSplash: true,
          mageElement,
          ...(extraHitMeta || {})
        });
      }
    }
  }

  function handleEnemyDeath(enemy) {
    if (isSoulslike && enemy?.isSoulsBoss && !souls.escapeCutsceneActive && !souls.bossEscaped) {
      enemy.hp = 1;
      enemy._deadHandled = false;
      startBossEscapeCutscene(enemy);
      return;
    }
    if (enemy._deadHandled) return;
    enemy._deadHandled = true;

    if (enemy.isSoulsBoss) {
      cancelSoulsBossTelegraph(enemy, elapsedRunTime);
    }
    if (enemy.isSoulsUnit) {
      releaseSoulsAttackToken(enemy);
      weaponTrails?.clearActor?.(enemy.uid);
    }
    audio?.playMobDeath?.(enemy.type, getMobAudioDistNorm(enemy));
    if (enemy.isBoss || enemy.isMiniBoss || enemy.isWarden || enemy.isFinaleTarget || enemy.eliteType) {
      triggerHitStop(0.036, true);
    }

    // 💧 Water Element Mana Siphon: slaying drenched enemies restores +3 Mana!
    if ((enemy.soakedTimer || 0) > 0 && stats?.usesMana && player.maxMana > 0) {
      player.mana = Math.min(player.maxMana, player.mana + 3);
      emitParticles(enemy.x, 0.7, enemy.z, 0x38bdf8, 4, 3.2, 0.12);
    }
    kills += 1;
    notifyDailyProgress('kills', 1);
    if (enemy.isBoss || enemy.isMiniBoss) {
      notifyDailyProgress('bosses_waves', 1);
    }

    emitParticles(
      enemy.x,
      0.65,
      enemy.z,
      enemy.eliteType === 'purple'
        ? 0xa855f7
        : enemy.eliteType === 'blue'
          ? 0x38bdf8
          : enemy.color || 0xd6d3d1,
      enemy.isBoss && !enemy.isMiniBoss ? 42 : enemy.isMiniBoss ? 24 : 11,
      enemy.isBoss ? 8.8 : 5.4,
      enemy.isBoss ? 0.22 : 0.15
    );

    // 💀 3D Physics Bone-Shatter + Authentic Rigged Skeleton Death Collapse!
    world?.spawnBoneShatter?.(enemy.x, enemy.z, Boolean(enemy.isBoss || enemy.isMiniBoss));
    audio?.playArmorBreak?.('bones');
    if (enemy.model && !enemy._corpseTransferred) {
      enemy._corpseTransferred = true;
      enemy.model.obj.position.y = isSoulslike ? (world?.getGroundHeight?.(enemy.x, enemy.z) ?? 0) : 0;
      enemy.model.obj.rotation.z = 0;
      enemy.model.handle?.playDeathCollapse?.();
      const maxDyingCorpses =
        typeof navigator !== 'undefined' && /iPhone|iPod|iPad|Android/i.test(navigator.userAgent || '')
          ? 6
          : 9;
      if (dyingCorpses.length >= maxDyingCorpses) {
        const oldest = dyingCorpses.shift();
        if (oldest?.isSoulsBoss && oldest.model?.obj) {
          disposeSoulsBossVisuals(oldest.model.obj);
        }
        removeSceneObject(oldest.model.obj, oldest.model.handle);
      }
      dyingCorpses.push(
        isSoulslike
          ? {
              model: enemy.model,
              isSoulsBoss: Boolean(enemy.isSoulsBoss),
              isSoulslikeCorpse: true,
              x: enemy.x,
              z: enemy.z,
              radius: enemy.radius || 0.75,
              ashAccum: 0,
              age: 0,
              collapseDur: enemy.isSoulsBoss ? 2.10 : 1.75,
              duration: enemy.isSoulsBoss ? 3.60 : 3.20
            }
          : { model: enemy.model, isSoulsBoss: Boolean(enemy.isSoulsBoss), age: 0, duration: 0.66 }
      );
    }

    // Toxic Slime / Bomber spawns 0.80s acid/explosive hazard pool on death!
    if (enemy.explodesOnDeath && !enemy.bomberTriggered) {
      enemy.bomberTriggered = true;
      spawnBomberHazard(enemy.x, enemy.z, enemy.hazardColor || 0x22c55e);
    }

    // ❄️ Ледяной Раскол (frost_shatter): chilled enemies shatter into damaging ice shards on death!
    const frostShatterStacks = stats?.frostShatterStacks || 0;
    if (frostShatterStacks > 0 && (enemy.frostTimer || 0) > 0) {
      const shatterRad = 2.8 + frostShatterStacks * 0.45;
      const shatterDmg = Math.max(10, Math.round((stats?.damage || 24) * (0.70 + frostShatterStacks * 0.35)));
      emitShockwave(enemy.x, enemy.z, shatterRad, 0x38bdf8, 0.34);
      emitParticles(enemy.x, 0.65, enemy.z, 0xbae6fd, 16, 6.8, 0.16);
      damageEnemiesInRadius(enemy.x, enemy.z, shatterRad, shatterDmg, 8.5, enemy, false);
      if (critFloaterCooldown <= 0) {
        critFloaterCooldown = 0.12;
        floatText('❄️ РАСКОЛ!', enemy.x, enemy.z, '#7dd3fc');
      }
    }

    // 🩸 Казнь Кровопийцы (war_blood_cleave): heal +12 HP per stack every 9 kills! (PvE only)
    const bloodCleaveStacks = isSoulslike ? 0 : (stats?.warBloodStacks || 0);
    if (bloodCleaveStacks > 0) {
      player.vampiricKills += 1;
      if (player.vampiricKills >= 9) {
        player.vampiricKills = 0;
        const heal = 12 * bloodCleaveStacks;
        player.hp = Math.min(stats.maxHp, player.hp + heal);
        floatText(`+${heal} HP`, player.x, player.z, '#f87171');
      }
    }

    // 🩸 Кровавая Жатва (vampiric_harvest): finishing blows restore HP! (PvE only)
    const vampHarvestStacks = isSoulslike ? 0 : (stats?.vampiricHarvestStacks || 0);
    if (vampHarvestStacks > 0 && player.hp > 0) {
      player.vampiricHarvestKills = (player.vampiricHarvestKills || 0) + 1;
      const isMajorKill = Boolean(enemy.isBoss || enemy.isMiniBoss || enemy.eliteType);
      if (isMajorKill || player.vampiricHarvestKills >= 3) {
        if (!isMajorKill) player.vampiricHarvestKills = 0;
        const heal = isMajorKill
          ? (enemy.isBoss ? 16 : 9) * vampHarvestStacks
          : 6 * vampHarvestStacks;
        if (player.hp < stats.maxHp) {
          player.hp = Math.min(stats.maxHp, player.hp + heal);
          emitParticles(player.x, 0.78, player.z, 0xf87171, 6, 3.4, 0.12);
          floatText(`+${heal} HP`, player.x, player.z, '#f87171');
        }
      }
    }

    // Direct & immediate Gold (PvE -> PvE wallet; Abandoned Knight Rift -> isolated Rift Gold wallet, quiet!)
    const earnedGold = Math.max(1, Math.round((enemy.gold || 1) * (stats?.goldMult || 1)));
    if (isSoulslike) {
      progression.addRiftGold?.(earnedGold);
      goldRun += earnedGold;
    } else {
      progression.addGold(earnedGold);
      goldRun += earnedGold;
      if (!enemy.isSummoned && earnedGold > 0) {
        audio?.playPickup?.('gold');
      }
    }

    // Endless Mode Boss Kill Reward (never ends the run — drops tactical loot + gold!)
    if (isEndless && enemy.isBoss && !enemy.isMiniBoss) {
      const bossGoldBonus = Math.round((30 + endlessWave * 8) * (stats?.goldMult || 1));
      progression.addGold(bossGoldBonus);
      goldRun += bossGoldBonus;
      world?.setBossAtmosphere?.(false);
      spawnPickup('heart', enemy.x - 0.65, enemy.z, { value: Math.round(stats.maxHp * 0.35) });
      spawnPickup('clover', enemy.x + 0.65, enemy.z);
      floatText(`💀 БОСС ПОВЕРЖЕН! +${bossGoldBonus} 💰`, enemy.x, enemy.z, '#fde047');
    }

    // Hammer Boss 10% Exclusive Boss Hammer Drop (first clear of milestone PvE Stages 5, 10, 15, 20, 25 ONLY!)
    if (
      !isEndless &&
      !isSoulslike &&
      (enemy.type === 'boss_troll' || enemy.type === 'boss_warden' || (enemy.isBoss && enemy.isFinaleTarget)) &&
      [5, 10, 15, 20, 25].includes(currentLevelNumber)
    ) {
      if (!progression.hasAttemptedBossHammerStage?.(currentLevelNumber)) {
        progression.markBossHammerAttempted?.(currentLevelNumber);
        if (!progression.isWeaponUnlocked('boss_hammer') && Math.random() < 0.10) {
          progression.unlockWeapon('boss_hammer');
          unlockedWeaponThisRun = WEAPONS.boss_hammer || unlockedWeaponThisRun;
          audio?.playWeaponUnlock?.();
          world?.addScreenShake?.(0.68, 0.40);
          emitShockwave(enemy.x, enemy.z, 7.5, 0xfde047, 0.58);
          emitParticles(enemy.x, 1.0, enemy.z, 0xfde047, 36, 9.0, 0.24);
          floatText('🔨 ВЫБИТ ТРОФЕЙ: МОЛОТ КОСТОЛОМА!', player.x, player.z - 1.1, '#fde047');
          if (WEAPONS.boss_hammer) callbacks?.onWeaponUnlocked?.(WEAPONS.boss_hammer);
        }
      }
    }

    // Check if this enemy is a Finale Target (Milestone Boss, Finale Mini-Boss, or Elite Finale Champion)
    let triggersChapterVictory = false;
    if (!isEndless && enemy.isFinaleTarget) {
      let remainingFinaleTargets = 0;
      let nextAliveFinaleTarget = null;
      for (let i = 0; i < enemies.length; i++) {
        const other = enemies[i];
        if (other && other !== enemy && other.isFinaleTarget && other.hp > 0) {
          remainingFinaleTargets += 1;
          if (!nextAliveFinaleTarget) nextAliveFinaleTarget = other;
        }
      }
      if (remainingFinaleTargets === 0) {
        triggersChapterVictory = true;
      } else {
        bossEntity = nextAliveFinaleTarget;
        floatText(`⚔️ ЕЩЁ ${remainingFinaleTargets} ЧЕМПИОН!`, enemy.x, enemy.z, '#fbbf24');
      }
    }

    if (!isSoulslike) {
      grantXp(enemy.xp || 0, triggersChapterVictory);
    }

    if (triggersChapterVictory) {
      triggerFinaleVictory(enemy);
      return;
    }

    // Abandoned Knight Rift: no arcade drops (healing via Estus Flask [R] and Bonfire only!)
    if (isSoulslike) return;

    // Mid-run Mini-Boss loot cache!
    if (enemy.isMiniBoss && !enemy.isFinaleTarget) {
      const crateKind = !companion && Math.random() < 0.45 ? 'companion_crate' : 'supply_crate';
      spawnPickup(crateKind, enemy.x, enemy.z);
      spawnPickup('heart', enemy.x - 0.75, enemy.z, { value: Math.round(stats.maxHp * 0.30) });
      spawnPickup('clover', enemy.x + 0.75, enemy.z);
      floatText(`+${earnedGold} 💰`, enemy.x, enemy.z, '#fbbf24');
      return;
    }

    // Rare tactical drops ONLY (Supply Crate, Companion Crate, Heart, Clover)
    const beastNow = player.beastTimeLeft > 0;
    if (enemy.eliteType === 'purple') {
      const dropCompanion = !companion && Math.random() < 0.48 ? 'companion_crate' : 'supply_crate';
      spawnPickup(dropCompanion, enemy.x, enemy.z);
    } else if (enemy.eliteType === 'blue') {
      spawnPickup('heart', enemy.x - 0.45, enemy.z, { value: Math.round(stats.maxHp * 0.25) });
      if (!beastNow && Math.random() < 0.32) {
        spawnPickup('clover', enemy.x + 0.45, enemy.z);
      }
    } else if (!enemy.isSummoned) {
      if (player.hp < stats.maxHp * 0.66 && Math.random() < 0.042) {
        spawnPickup('heart', enemy.x, enemy.z, { value: Math.round(stats.maxHp * 0.22) });
      } else if (!beastNow && Math.random() < 0.007) {
        spawnPickup('clover', enemy.x, enemy.z);
      }
    }
  }

  function triggerFinaleVictory(defeatedBoss) {
    if (runEnded || pendingVictoryPayload || playerDying) return;
    if (isSoulslike && souls.bossDefeated) return;

    if (isSoulslike) {
      // Abandoned Knight Rift clean standalone boss victory:
      // No PvE gold/stars/unlocks; let the boss finish collapsing (~1.2s), show banner,
      // and keep the player walking freely around the cleared cathedral & throne!
      souls.bossDefeated = true;
      clearTargetLock();
      world?.setBossAtmosphere?.(false);
      world?.resetBossDoors?.(true);
      world?.setSoulsFogGate?.(false);
      audio?.setSoulsAmbientActive?.(true, { nearBonfire: false });
      audio?.setMusicMode?.('combat');
      audio?.stopBossRoar?.(0.10);
      audio?.playExplosion?.();
      audio?.playWeaponUnlock?.();
      world?.addScreenShake?.(0.65, 0.40);
      emitShockwave(defeatedBoss.x, defeatedBoss.z, 10.5, 0xfde047, 0.65);
      emitParticles(defeatedBoss.x, 0.9, defeatedBoss.z, 0xfbbf24, 34, 8.8, 0.20);
      emitParticles(defeatedBoss.x, 1.1, defeatedBoss.z, 0xfde047, 22, 6.5, 0.16);
      bossHazards.length = 0;
      activeBurningZones.length = 0;
      bomberHazards.length = 0;

      const hpRatio = player.maxHp > 0 ? clamp(player.hp / player.maxHp, 0, 1) : 1;
      pendingVictoryPayload = {
        victory: true,
        level: currentLevelNumber,
        isSoulslike: true,
        keepPlayingInWorld: true,
        bossNameRu: defeatedBoss?.nameRu || 'Судия Руин',
        goldEarned: 0,
        kills,
        hpRatio: +hpRatio.toFixed(2),
        elapsedSec: Math.round(elapsedRunTime),
        stars: 0,
        difficulty: currentDifficulty,
        unlockedWeapon: null
      };
      victoryDelayTimer = 1.2;
      return;
    }

    const greedMult = 1 + (perks.greed_contract || 0) * 0.30;
    const rawChapterBonus = currentLevelDef.hasBoss
      ? 90 + currentLevelNumber * 6
      : 38 + currentLevelNumber * 4;
    const bonusGold = Math.round(rawChapterBonus * greedMult);
    progression.addGold(bonusGold);
    goldRun += bonusGold;

    // Golden celebration burst (zero floor coins!)
    emitParticles(defeatedBoss.x, 0.9, defeatedBoss.z, 0xfbbf24, 34, 8.8, 0.20);
    emitParticles(defeatedBoss.x, 1.1, defeatedBoss.z, 0xfde047, 22, 6.5, 0.16);

    // Reward chapter tier weapon ONLY for classes without Shop weapon purchases
    if (currentLevelDef.unlockWeaponTier && currentClassId !== 'warrior' && currentClassId !== 'gunslinger') {
      const tierWeapon = findClassWeaponByTier(currentClassId, currentLevelDef.unlockWeaponTier);
      if (tierWeapon && !progression.isWeaponUnlocked(tierWeapon)) {
        unlockTierWeaponIfNeeded(tierWeapon, defeatedBoss.x, defeatedBoss.z, true);
      }
    }

    progression.unlockNextLevel(currentLevelNumber);
    if (!defeatedBoss?.isBoss && !defeatedBoss?.isMiniBoss) {
      notifyDailyProgress('bosses_waves', 1);
    }
    world?.setBossAtmosphere?.(false);
    audio?.playExplosion?.();
    audio?.playWeaponUnlock?.();
    world?.addScreenShake?.(0.85, 0.52);
    emitShockwave(defeatedBoss.x, defeatedBoss.z, 11.0, 0xfde047, 0.65);
    floatText(`🏆 ПОБЕДА! +${bonusGold} 💰`, player.x, player.z, '#fde047');

    // Wipe remaining minor undead in victory shockwave
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (e !== defeatedBoss && e.hp > 0) {
        emitParticles(e.x, 0.5, e.z, 0xfde047, 5, 4.5, 0.13);
        e.hp = 0;
      }
    }
    bossHazards.length = 0;
    activeBurningZones.length = 0;
    bomberHazards.length = 0;

    const hpRatio = player.maxHp > 0 ? clamp(player.hp / player.maxHp, 0, 1) : 1;
    const elapsedSec = Math.round(elapsedRunTime);
    const star2 = hpRatio >= 0.55;
    const star3 = elapsedSec <= 95;
    const stars = 1 + (star2 ? 1 : 0) + (star3 ? 1 : 0);
    progression.recordLevelStars?.(currentLevelNumber, stars);

    pendingVictoryPayload = {
      victory: true,
      level: currentLevelNumber,
      goldEarned: goldRun,
      kills,
      hpRatio: +hpRatio.toFixed(2),
      elapsedSec,
      stars,
      starDetails: { win: true, highHp: star2, fastClear: star3 },
      difficulty: currentDifficulty,
      unlockedWeapon: unlockedWeaponThisRun
    };
    victoryDelayTimer = 0.8;
  }

  function applyDamageToPlayer(rawDamage, attackerEnemy = null, attackMeta = null) {
    if (freeRoamMode) return;
    if (runEnded || pendingVictoryPayload || playerDying) return;
    if (isSoulslike && souls.activeRiposte) return;
    const effAttackMeta = attackMeta || attackerEnemy?.currentAttackMeta || null;
    const isBurnDoT = Boolean(effAttackMeta?.isBurnDoT || effAttackMeta?.damageLevel === 'burn_dot');
    if (player.dashInvulnTimer > 0 || player.beastTimeLeft > 0) return;
    if (!isBurnDoT && player.invulnTimer > 0) return;

    // Persistent ground-fire burn tick: fair HP burn + fire sizzle VFX without shield-block or knockdown loop!
    if (isBurnDoT) {
      const burnDmg = Math.max(1, Math.round(rawDamage));
      player.hp = Math.max(0, player.hp - burnDmg);
      triggerModelHitFlash(heroModel);
      audio?.playElementImpact?.('fire');
      emitParticles(player.x, 0.58, player.z, 0xf97316, 10, 4.2, 0.13);
      emitParticles(player.x, 0.26, player.z, 0xfde047, 5, 2.8, 0.10);
      floatText(`🔥 -${burnDmg}`, player.x, player.z - 0.55, '#fb923c');
      if (player.hp > 0) {
        return;
      }
      // Lethal ground-fire tick falls through cleanly to standard Death_A handler below!
    }

    // Chapter 26 Elden Ring Shield Block (GuardBoost 55, 0% phys chip), Guard Counter,
    // Timed Parry (55ms startup, 190/240ms active) & Partial Parry (±65ms)
    let wasGuardBroken = false;
    let skipDirectDamageApply = isBurnDoT;
    const isTouchInput = souls.lastInputSource === 'touch';
    const incomingParryable =
      !isBurnDoT &&
      effAttackMeta?.canParry !== false &&
      effAttackMeta?.parryable !== false;
    const incomingBlockable =
      !isBurnDoT &&
      effAttackMeta?.canBlock !== false &&
      !effAttackMeta?.unblockable;

    if (isSoulslike && incomingBlockable && souls.isBlocking && souls.guardBreakTimer <= 0) {
      const isMobileTouchBlock = Boolean(isTouchInput || souls.blockParryTouch);
      const parryStartup = isMobileTouchBlock
        ? (SOULS_GUARD_CFG.parryStartupTouch ?? 0.0)
        : SOULS_GUARD_CFG.parryStartupSec;
      const parryActiveDur = isMobileTouchBlock ? SOULS_GUARD_CFG.parryActiveTouch : SOULS_GUARD_CFG.parryActivePc;
      const parryEnd = parryStartup + parryActiveDur;
      const partialTol = SOULS_GUARD_CFG.partialParryTolerance;
      const elapsedBlk = souls.blockPressElapsed || 0;

      const inPerfectParry =
        !souls.blockParryConsumed &&
        incomingParryable &&
        elapsedBlk >= parryStartup &&
        elapsedBlk <= parryEnd;
      const inPartialParry =
        !isMobileTouchBlock &&
        !souls.blockParryConsumed &&
        incomingParryable &&
        !inPerfectParry &&
        (elapsedBlk < parryStartup || (elapsedBlk > parryEnd && elapsedBlk <= parryEnd + partialTol));

      if (inPerfectParry) {
        // PERFECT TIMED PARRY: 0 damage, 0 stamina cost, multi-parry on boss (2 parries -> Stagger_Kneel), 1 parry on mobs!
        souls.blockParryConsumed = true;
        souls.parryWindowTimer = 0;
        souls.recoilVisual = 0.65;
        player.invulnTimer = 0.36;
        if (typeof audio?.playParrySuccess === 'function') {
          audio.playParrySuccess();
        } else {
          audio?.playShieldBlock?.();
        }
        triggerHitStop(soulsGameFeel.HITSTOP_PRESETS.parry, true);
        world?.addScreenShake?.(0.30, 0.16);
        const parryDirX = attackerEnemy ? attackerEnemy.x - player.x : Math.sin(player.facing || 0);
        const parryDirZ = attackerEnemy ? attackerEnemy.z - player.z : Math.cos(player.facing || 0);
        emitSoulsSparkBurst('parry', player.x, player.z, parryDirX, parryDirZ);
        spawnSoulsClashSparks(player.x + parryDirX * 0.25, 1.02, player.z + parryDirZ * 0.25, -parryDirX, 0.42, -parryDirZ, 'parry');
        applyKnockbackImpulse(player, -parryDirX, -parryDirZ, 2.2, { isHeavy: false });
        attackerEnemy?.model?.handle?.applyRecoilImpulse?.({
          kind: 'parry',
          dirX: parryDirX,
          dirZ: parryDirZ,
          intensity: 1.45,
          isHeavy: true
        });
        floatText('ПАРИРОВАНИЕ!', player.x, player.z - 0.5, '#fde047');

        if (attackerEnemy && attackerEnemy.hp > 0) {
          if (attackerEnemy.isSoulsBoss) {
            const pRes = applySoulsBossParry(attackerEnemy, elapsedRunTime, bossAiCtx);
            if (pRes?.staggered) {
              audio?.playStanceBreak?.();
              callbacks?.onSoulsCue?.('СЛОМ СТОЙКИ!', 'stance_break');
            }
          } else if (attackerEnemy.isSoulsUnit) {
            attackerEnemy._mobActiveSwing = null;
            const mRes = onSoulsMobParried(attackerEnemy, { stunSec: 2.6, riposteSec: 2.8 });
            attackerEnemy.model?.handle?.cancelAttackAnim?.();
            if (mRes?.staggered) {
              attackerEnemy.model?.handle?.playClampedClip?.('Stagger_Kneel', 1.0, 0.14);
              audio?.playStanceBreak?.();
              callbacks?.onSoulsCue?.('СЛОМ СТОЙКИ!', 'stance_break');
            } else {
              attackerEnemy.model?.handle?.triggerHitReact?.({
                playClip: true,
                clipName: 'Hit_React',
                speed: 1.2,
                interruptAttack: true,
                blendInSec: 0.08,
                blendOutSec: 0.14
              });
              floatText(
                `ПАРИРОВАНИЕ (${mRes?.parryCount || 1}/${mRes?.parriesNeeded || 2})`,
                attackerEnemy.x,
                attackerEnemy.z - 0.85,
                '#fde047'
              );
            }
          } else {
            attackerEnemy.stunTimer = Math.max(attackerEnemy.stunTimer || 0, 2.2);
            attackerEnemy.parriedRiposteTimer = 2.6;
          }
        }
        return;
      }

      if (inPartialParry) {
        // PARTIAL PARRY (±65ms / early startup): 35% HP damage + stamina cost, NO hitstun combo!
        souls.blockParryConsumed = true;
        souls.parryWindowTimer = 0;
        souls.recoilVisual = 0.85;
        const baseStamDmg = Number(effAttackMeta?.staminaDamage) || Math.max(20, Math.round(rawDamage * 0.85));
        const partialStamCost = computeBlockedStaminaCost(baseStamDmg, SOULS_GUARD_CFG.guardBoost);
        soulsStaminaCtrl.spend(partialStamCost, { allowDebt: true, force: true });
        syncSoulsStaminaMirror();

        const partialDmg = Math.max(1, Math.round(rawDamage * SOULS_GUARD_CFG.partialParryHpMult));
        player.hp = Math.max(0, player.hp - partialDmg);
        player.invulnTimer = 0.30;
        const isBossBlk = Boolean(attackerEnemy?.isSoulsBoss);
        const isHeavyBlk = effAttackMeta?.damageLevel === 'heavy' || effAttackMeta?.damageLevel === 'knockdown' || rawDamage >= 38;
        audio?.playShieldBlock?.({ isBoss: isBossBlk, heavy: isHeavyBlk });
        audio?.playPartialParry?.();
        const ppDx = attackerEnemy ? player.x - attackerEnemy.x : -Math.sin(player.facing || 0);
        const ppDz = attackerEnemy ? player.z - attackerEnemy.z : -Math.cos(player.facing || 0);
        const ppLen = Math.hypot(ppDx, ppDz) || 1;
        const blkFaceX = -ppDx / ppLen;
        const blkFaceZ = -ppDz / ppLen;
        applyKnockbackImpulse(player, ppDx, ppDz, 4.2, { isHeavy: isHeavyBlk });
        world?.spawnWoodShieldSplinters?.(player.x + blkFaceX * 0.42, 0.96, player.z + blkFaceZ * 0.42, ppDx, ppDz, isHeavyBlk);
        emitParticles(player.x + blkFaceX * 0.38, 0.92, player.z + blkFaceZ * 0.38, 0xc28e52, 8, 4.6, 0.11);
        heroModel?.handle?.addShieldScrapeDecal?.({ isBoss: isBossBlk, isHeavy: isHeavyBlk });
        world?.addScreenShake?.(0.18, 0.12);
        floatText(`🛡️ ЧАСТИЧНОЕ ПАРИР. -${partialDmg}`, player.x, player.z - 0.5, '#fbbf24');
        callbacks?.onSoulsCue?.('🛡️ ЧАСТИЧНОЕ ПАРИР.', 'partial_parry');

        if (soulsStaminaCtrl.getRawStamina() <= 0) {
          souls.guardBreakTimer = SOULS_GUARD_CFG.guardBreakDuration;
          souls.isBlocking = false;
          souls.guardCounterTimer = 0;
          setModelBlocking(heroModel, false);
          soulsActionBuffer.clearOnHitstun();
          audio?.playGuardBreak?.();
          floatText('💥 ПРОБИТ БЛОК!', player.x, player.z - 0.85, '#ef4444');
        }
        if (player.hp > 0) {
          return;
        }
        skipDirectDamageApply = true;
      } else {
        // REGULAR SHIELD BLOCK: GuardBoost 55 stamina absorption + 0% physical HP chip + Guard Counter window!
        const baseStamDmg = Number(effAttackMeta?.staminaDamage) || Math.max(20, Math.round(rawDamage * 0.85));
        const blockStamCost = computeBlockedStaminaCost(baseStamDmg, SOULS_GUARD_CFG.guardBoost);
        soulsStaminaCtrl.spend(blockStamCost, { allowDebt: true, force: true });
        syncSoulsStaminaMirror();
        souls.recoilVisual = 0.72;
        const isBossBlk = Boolean(attackerEnemy?.isSoulsBoss);
        const blkDx = attackerEnemy ? player.x - attackerEnemy.x : -Math.sin(player.facing || 0);
        const blkDz = attackerEnemy ? player.z - attackerEnemy.z : -Math.cos(player.facing || 0);
        const blkLen = Math.hypot(blkDx, blkDz) || 1;
        const blkFaceX = -blkDx / blkLen;
        const blkFaceZ = -blkDz / blkLen;
        const isHeavyBlk = effAttackMeta?.damageLevel === 'heavy' || effAttackMeta?.damageLevel === 'knockdown' || rawDamage >= 38;
        audio?.playShieldBlock?.({ isBoss: isBossBlk, heavy: isHeavyBlk });
        applyKnockbackImpulse(player, blkDx, blkDz, isHeavyBlk ? 5.2 : 3.2, { isHeavy: isHeavyBlk });
        world?.spawnWoodShieldSplinters?.(player.x + blkFaceX * 0.42, 0.96, player.z + blkFaceZ * 0.42, blkDx, blkDz, isHeavyBlk);
        emitParticles(player.x + blkFaceX * 0.38, 0.92, player.z + blkFaceZ * 0.38, 0xc28e52, 7, 4.4, 0.11);
        heroModel?.handle?.addShieldScrapeDecal?.({ isBoss: isBossBlk, isHeavy: isHeavyBlk });

        if (soulsStaminaCtrl.getRawStamina() <= 0) {
          wasGuardBroken = true;
          souls.guardBreakTimer = SOULS_GUARD_CFG.guardBreakDuration;
          souls.isBlocking = false;
          souls.guardCounterTimer = 0;
          setModelBlocking(heroModel, false);
          soulsActionBuffer.clearOnHitstun();
          audio?.playGuardBreak?.();
          floatText('💥 ПРОБИТ БЛОК!', player.x, player.z - 0.5, '#ef4444');
          rawDamage *= 0.45;
        } else if (isMobileTouchBlock) {
          // Mobile Smart Shield Block (when held too early or outside parry window):
          // Drains stamina + blocks 85% of damage (15% mitigated chip) + opens Guard Counter window!
          const mobileChipDmg = Math.max(1, Math.round(rawDamage * (SOULS_GUARD_CFG.mobileBlockChipMult ?? 0.15)));
          player.hp = Math.max(0, player.hp - mobileChipDmg);
          souls.guardCounterTimer = SOULS_GUARD_CFG.guardCounterWindowTouch;
          player.invulnTimer = 0.24;
          floatText(`🛡️ БЛОК -${mobileChipDmg}`, player.x, player.z, '#fbbf24');
          if (player.hp > 0) {
            return;
          }
          skipDirectDamageApply = true;
        } else {
          // 0% physical chip damage on PC! Open Guard Counter window (0.48s PC / 0.56s Touch)
          souls.guardCounterTimer = isTouchInput
            ? SOULS_GUARD_CFG.guardCounterWindowTouch
            : SOULS_GUARD_CFG.guardCounterWindowPc;
          player.invulnTimer = 0.24;
          floatText('🛡️ БЛОК', player.x, player.z, '#fbbf24');
          return;
        }
      }
    }

    // Swift Boots spectral dodge!
    if (!skipDirectDamageApply && Math.random() < (stats?.dodgeChance || 0)) {
      player.invulnTimer = 0.28;
      emitParticles(player.x, 0.82, player.z, 0x34d399, 10, 5.0, 0.14);
      floatText('УКЛОНЕНИЕ!', player.x, player.z, '#34d399');
      return;
    }

    let dmg = skipDirectDamageApply ? 0 : rawDamage * (1 - (stats?.damageBlock || 0));

    // 🛡️ Сфера Отражения (mage_arcane_ward): absorbs 65% damage & blasts attackers away! (PvE only)
    if (!skipDirectDamageApply && !isSoulslike && (stats?.mageWardStacks || 0) > 0 && player.arcaneWardReady) {
      player.arcaneWardReady = false;
      player.arcaneWardTimer = Math.max(4.5, 8.5 - stats.mageWardStacks * 1.2);
      dmg *= 0.35;
      const wardColor = stats.mageElementColor || 0xc084fc;
      audio?.playMagicCast?.(stats.mageElement || 'void_orb');
      emitShockwave(player.x, player.z, 4.4, wardColor, 0.36);
      emitParticles(player.x, 0.85, player.z, wardColor, 16, 6.5, 0.16);
      damageEnemiesInRadius(player.x, player.z, 4.4, Math.round(stats.damage * (0.9 + stats.mageWardStacks * 0.45)), 15.0, null, false, stats.mageElement);
      floatText('🔮 ЩИТ ЧАР!', player.x, player.z, '#c084fc');
    }

    // Class Shield Block Passive! (PvE only — in Souls mode shield block requires active guard!)
    let blockedHit = false;
    if (!isSoulslike && !skipDirectDamageApply && Math.random() < (stats?.blockChance || 0)) {
      blockedHit = true;
      dmg *= 0.5;
      const isBossBlk = Boolean(attackerEnemy?.isSoulsBoss);
      const isHeavyBlk = effAttackMeta?.damageLevel === 'heavy' || effAttackMeta?.damageLevel === 'knockdown' || rawDamage >= 38;
      const blkDx = attackerEnemy ? player.x - attackerEnemy.x : -Math.sin(player.facing || 0);
      const blkDz = attackerEnemy ? player.z - attackerEnemy.z : -Math.cos(player.facing || 0);
      const blkLen = Math.hypot(blkDx, blkDz) || 1;
      const blkFaceX = -blkDx / blkLen;
      const blkFaceZ = -blkDz / blkLen;
      audio?.playShieldBlock?.({ isBoss: isBossBlk, heavy: isHeavyBlk });
      world?.spawnWoodShieldSplinters?.(player.x + blkFaceX * 0.42, 0.96, player.z + blkFaceZ * 0.42, blkDx, blkDz, isHeavyBlk);
      emitParticles(player.x + blkFaceX * 0.38, 0.88, player.z + blkFaceZ * 0.38, 0xc28e52, 7, 4.4, 0.11);
      heroModel?.handle?.addShieldScrapeDecal?.({ isBoss: isBossBlk, isHeavy: isHeavyBlk });
      floatText('БЛОК!', player.x, player.z, '#fbbf24');
    }

    // 🛡️ Шипованная Волна (shield_thorns_wave): block or taking damage unleashes steel thorns shockwave! (PvE only)
    const thornsStacks = stats?.shieldThornsStacks || 0;
    if (!isSoulslike && !skipDirectDamageApply && thornsStacks > 0) {
      const waveRad = 3.8 + thornsStacks * 0.5;
      const waveDmg = Math.max(12, Math.round((stats?.damage || 24) * (0.85 + thornsStacks * 0.45) * (blockedHit ? 1.25 : 1.0)));
      if (!blockedHit) audio?.playShieldBlock?.({ isBoss: Boolean(attackerEnemy?.isSoulsBoss), heavy: false });
      emitShockwave(player.x, player.z, waveRad, 0xfbbf24, 0.34);
      emitParticles(player.x, 0.82, player.z, 0xfef08a, 16, 7.2, 0.15);
      damageEnemiesInRadius(player.x, player.z, waveRad, waveDmg, 14.0, null, false);
      floatText('🛡️ ВОЛНА ШИПОВ!', player.x, player.z - 0.5, '#fbbf24');
    }

    const finalDmg = skipDirectDamageApply ? 0 : Math.max(1, Math.round(dmg));
    if (!skipDirectDamageApply) {
      player.hp = Math.max(0, player.hp - finalDmg);
    }

    if (attackerEnemy) {
      attackerEnemy._lastSwingConnected = true;
    }

    // Bidirectional Dark Souls Player Microstun / Buckle / Knockdown — STRICTLY Chapter XXVI Dark Souls (`isSoulslike === true`) ONLY!
    // In PvE (Chapters 1–25, Endless, Training Grounds), mob hits NEVER stun player or interrupt attacks/combos.
    if (isSoulslike && player.hp > 0) {
      const dmgLevel = wasGuardBroken
        ? 'heavy'
        : (effAttackMeta?.damageLevel || (rawDamage >= 48 ? 'knockdown' : rawDamage >= 34 ? 'heavy' : 'light'));
      const hitSpec = getPlayerHitstunSpec(dmgLevel);
      const pStun = poiseCtrl.evaluatePlayerMicroStun(
        player,
        {
          damage: finalDmg,
          damageLevel: dmgLevel,
          attacker: attackerEnemy,
          isBlocked: blockedHit,
          isParried: false,
          isGuardBreak: wasGuardBroken,
          isDodged: false,
          inIFrames: false,
          isFatal: false,
          classId: currentClassId,
          playerHasHyperArmor: Boolean(player.hasHyperArmor) && dmgLevel !== 'knockdown',
          isSoulslike: true
        },
        { ignoreInvulnTimer: true, isSoulslike: true }
      );
      if (pStun.shouldStun || wasGuardBroken || dmgLevel === 'knockdown') {
        // Hard anti-panic-roll rule: flush any stale pre-hit buffered action immediately on hitstun!
        soulsActionBuffer.clearOnHitstun();
        souls.recoilVisual = 1.0;
        if (pStun.cancelsTurn180 || wasGuardBroken || dmgLevel === 'knockdown') {
          cancelPlayerTurn180(0.35);
          player.runMomentumTime = 0;
        }
        if (pStun.cancelsAttackWindup || wasGuardBroken || dmgLevel === 'knockdown') {
          pendingMeleeStrikes = [];
          souls.activeAttack = null;
          souls.flaskDrinkTimer = 0;
          souls.flaskHealTimer = 0;
          heroModel?.handle?.cancelFlaskDrinkAnim?.();
          player.hasHyperArmor = false;
          meleeStepLunge = null;
          player.attackAnimTimer = 0;
        }
        if ((wasGuardBroken || dmgLevel === 'knockdown') && !pStun.shouldStun) {
          player.microStunDuration = hitSpec.duration;
          player.microStunTimer = hitSpec.duration;
          player.microStunElapsed = 0;
          player.microStunCancelableAfter = hitSpec.rollCancelAfter;
          player.microStunMoveMult = hitSpec.moveSpeedMult ?? 0.12;
        }
        player.recoilVx = (player.recoilVx || 0) + (pStun.impulseX || 0);
        player.recoilVz = (player.recoilVz || 0) + (pStun.impulseZ || 0);
        const hitDx = attackerEnemy ? player.x - attackerEnemy.x : -Math.sin(player.facing || 0);
        const hitDz = attackerEnemy ? player.z - attackerEnemy.z : -Math.cos(player.facing || 0);
        const kbStrength = dmgLevel === 'knockdown' ? 8.6 : (dmgLevel === 'heavy' || wasGuardBroken ? 6.6 : 4.2);
        applyKnockbackImpulse(player, hitDx, hitDz, kbStrength, {
          isHeavy: dmgLevel !== 'light' || wasGuardBroken
        });
        heroModel?.handle?.triggerHitReact?.(pStun.clipSpeed || 1.5, pStun.clipName || 'Impact', {
          interruptAttack: true,
          blockGuard: true,
          damageLevel: dmgLevel,
          blendInSec: pStun.blendInSec ?? 0.026,
          blendOutSec: pStun.blendOutSec ?? (dmgLevel === 'knockdown' ? 0.18 : 0.12)
        });
        if (dmgLevel === 'knockdown') {
          emitShockwave(player.x, player.z, 2.2, 0xd6d3d1, 0.28);
          emitParticles(player.x, 0.22, player.z, 0xd6d3d1, 14, 5.2, 0.14);
        }
      }
    }

    if (!isBurnDoT && !skipDirectDamageApply) {
      player.invulnTimer = 0.46;

      triggerModelHitFlash(heroModel);
      if (isSoulslike && typeof audio?.playPlayerHitByEnemy === 'function') {
        audio.playPlayerHitByEnemy(effAttackMeta?.damageLevel || 'light', {
          isBoss: Boolean(attackerEnemy?.isSoulsBoss)
        });
      } else {
        audio?.playHit?.();
      }
      const shakeAmp = isSoulslike && effAttackMeta?.damageLevel === 'knockdown'
        ? 0.58
        : isSoulslike && effAttackMeta?.damageLevel === 'heavy'
          ? 0.44
          : 0.34;
      world?.addScreenShake?.(shakeAmp, shakeAmp > 0.45 ? 0.26 : 0.18);
      emitParticles(player.x, 0.78, player.z, 0xef4444, isSoulslike ? 13 : 9, 5.4, 0.15);
    }

    if (player.hp <= 0) {
      player.hp = 0;
      playerDying = true;
      bossHazards.length = 0;
      activeBurningZones.length = 0;
      audio?.stopBossRoar?.(0.10);
      lockedEnemy = null;
      world?.setLockOnTarget?.(null);
      poiseCtrl.resetEntityPoise(player, { isPlayer: true });
      pendingMeleeStrikes = [];
      meleeStepLunge = null;
      hitStopTimer = 0;
      hitStopCooldown = 0;
      player.dashTimer = 0;
      player.dashInvulnTimer = 0;
      player.moveVelX = 0;
      player.moveVelZ = 0;
      player.recoilVx = 0;
      player.recoilVz = 0;
      player.attackAnimTimer = 0;
      player.attackFaceHoldTimer = 0;
      cancelPlayerTurn180(0.5);
      player.runMomentumTime = 0;
      if (player.isReloading) {
        player.isReloading = false;
        player.reloadTimer = 0;
        syncHeroReloadModel(false);
      }
      if (isSoulslike) {
        player.hasHyperArmor = false;
        resetSoulsControllers(false);
        resetActorPhysics(player);
        audio?.stopCinematicBossDoorSequence?.(0.08);
        audio?.stopBossIntroVoice?.(0.08);
        audio?.updateSoulsSpatial?.(0, 0, 0, false, false, 0);
        audio?.setSoulsAmbientActive?.(false, { nearBonfire: false });
      }
      setModelBlocking(heroModel, false);
      if (player.beastTimeLeft > 0) {
        player.beastTimeLeft = 0;
        heroModel?.handle?.setBeastMode?.(false, currentClassId);
        heroModel?.obj?.userData?.setBeastMode?.(false, currentClassId);
      }

      // Play full Death_A animation (clamped on final frame) + 1.0s dramatic pause before defeat modal
      const playDeathFn =
        heroModel?.handle?.playDeathAnim || heroModel?.obj?.userData?.playDeathAnim;
      const rawDeathDur = typeof playDeathFn === 'function' ? Number(playDeathFn(1.25)) : 0;
      const deathClipDuration =
        Number.isFinite(rawDeathDur) && rawDeathDur > 0.2 ? rawDeathDur : 1.4;
      deathModalDelay = deathClipDuration + 1.0;

      const survivalSec = Math.round(elapsedRunTime);
      pendingDefeatPayload = {
        victory: false,
        level: currentLevelNumber,
        isEndless,
        endlessWave,
        goldEarned: goldRun,
        kills,
        elapsedSec: survivalSec,
        elapsedTime: survivalSec,
        difficulty: currentDifficulty,
        unlockedWeapon: unlockedWeaponThisRun,
        soulsBossReached: Boolean(isSoulslike && souls.bossAwakened)
      };
      world?.addScreenShake?.(0.45, 0.28);
    }
  }

  // === Projectiles & Class Attacks ===
  function spawnProjectile({
    x,
    z,
    vx,
    vz,
    damage,
    maxDist,
    pierce = 1,
    pierceDecay = null,
    splashRadius = 0,
    knockback = 3.0,
    kind = 'ranged',
    visualType = null,
    isShotgunPellet = false,
    isCrit = false,
    color = 0xfbbf24,
    isEnemy = false,
    ignoreCrateUid = 0,
    mageElement = null,
    attackMeta = null
  }) {
    const scale =
      kind === 'magic' ? 1.28 : isEnemy ? 0.84 : isShotgunPellet ? 0.66 : 0.74;
    const vis = makeProjectileVisual(visualType || kind, color, scale);
    vis.obj.position.set(x, 0.78, z);
    vis.obj.rotation.y = Math.atan2(vx, vz);

    projectiles.push({
      x,
      z,
      vx,
      vz,
      damage,
      traveled: 0,
      maxDist,
      pierceLeft: pierce,
      pierceDecay,
      hitsLanded: 0,
      splashRadius,
      knockback,
      kind,
      isShotgunPellet,
      isCrit,
      color,
      isEnemy,
      ignoreCrateUid,
      mageElement,
      attackMeta,
      hitUids: new Set(),
      trailTick: 0,
      vis
    });
  }

  // Hard physical cylinder separation between the hero and all living enemies/bosses/training dummy.
  // Runs twice per frame (after player movement/roll/lunge AND after enemy AI movement) with 2 solver
  // iterations so neither the player nor charging enemies/bosses can ever pass through each other.
  function resolvePlayerEnemyBodyCollisions(syncVisuals = false) {
    if (!player || player.hp <= 0 || playerDying) return;
    if (!isSoulslike && player.beastTimeLeft > 0) return;
    if (!enemies.length) return;

    let playerMoved = false;
    const modeSepMult = isSoulslike || freeRoamMode ? 1.0 : 0.90;

    for (let iter = 0; iter < 2; iter++) {
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (!e || e.hp <= 0) continue;
        if ((e.emergeTimer || 0) > 0) continue;
        if (isSoulslike && e.isSoulsBoss && !souls.bossAwakened) continue;
        if (isSoulslike && (e.soulsState === 'riposte_victim' || (souls.activeRiposte && souls.activeRiposte.target === e))) continue;

        let eSolidR = e.isSoulsBoss
          ? (e.radius || 1.75) * 0.90
          : Math.max(0.42, (e.radius || 0.55) * 0.88);
        if (e.isSoulsBoss && e.soulsState === 'leap_slam') {
          const flightStart = e.soulsFlightStartAt ?? e.soulsTakeoffAt ?? 0;
          const landEnd = e.soulsLandMoveEndAt ?? 0;
          const tAtk = e.soulsAttackElapsed ?? 0;
          if (tAtk >= flightStart && tAtk <= landEnd) {
            eSolidR = (e.radius || 1.75) * 0.55;
          }
        }

        const minSep = ((player.radius || 0.58) + eSolidR) * modeSepMult;
        const dx = player.x - e.x;
        const dz = player.z - e.z;
        const dist = Math.hypot(dx, dz);
        if (dist >= minSep) continue;

        let nx = 0;
        let nz = 1;
        if (dist > 1e-4) {
          nx = dx / dist;
          nz = dz / dist;
        } else {
          nx = -Math.sin(player.facing || 0);
          nz = -Math.cos(player.facing || 0);
        }

        const overlap = minSep - dist;
        const isImmovable = Boolean(e.isBoss || e.isTrainingDummy);
        if (isImmovable) {
          player.x += nx * overlap;
          player.z += nz * overlap;
          const clampedP = resolveObstaclesAndBounds(player.x, player.z, player.radius, ARENA_PLAYER_LIMIT);
          player.x = clampedP.x;
          player.z = clampedP.z;
          playerMoved = true;
        } else {
          player.x += nx * overlap * 0.80;
          player.z += nz * overlap * 0.80;
          e.x -= nx * overlap * 0.20;
          e.z -= nz * overlap * 0.20;
          const clampedP = resolveObstaclesAndBounds(player.x, player.z, player.radius, ARENA_PLAYER_LIMIT);
          player.x = clampedP.x;
          player.z = clampedP.z;
          const clampedE = resolveObstaclesAndBounds(e.x, e.z, e.radius || 0.55, ARENA_ENTITY_LIMIT);
          e.x = clampedE.x;
          e.z = clampedE.z;
          if (syncVisuals && e.model?.obj) {
            e.model.obj.position.x = e.x;
            e.model.obj.position.z = e.z;
          }
          playerMoved = true;
        }
      }
    }

    if (syncVisuals && playerMoved && heroModel?.obj) {
      const heroGroundY = isSoulslike && Number.isFinite(player.visualGroundY)
        ? player.visualGroundY
        : (world?.getGroundHeight?.(player.x, player.z) ?? 0);
      heroModel.obj.position.x = player.x;
      heroModel.obj.position.y = heroGroundY;
      heroModel.obj.position.z = player.z;
    }
  }

  // === Dark Souls / Elden Ring Target Lock-On ([Q] / MMB / HUD + [Tab] cycle) ===
  let lockOnWallBlockedSec = 0;
  function hasSoulsTargetWallLos(e) {
    if (!isSoulslike || !e) return true;
    const dState = world?.getBossDoorState?.() || (souls.bossAwakened ? 'sealed' : 'closed');
    return hasCastleWallLineOfSight(player.x, player.z, e.x, e.z, { bossDoorState: dState });
  }

  function isEnemyLockable(e, maxDist = LOCK_ON_ACQUIRE_RADIUS) {
    if (!e || e.hp <= 0) return false;
    if (isSoulslike && e.isSoulsBoss && !souls.bossAwakened) return false;
    const dist = Math.hypot(e.x - player.x, e.z - player.z);
    if (dist > maxDist) return false;
    if (isSoulslike && !hasSoulsTargetWallLos(e)) return false;
    return true;
  }

  function buildLockOnWorldPayload(e) {
    if (!e) return null;
    return {
      x: e.x,
      y: e.isSoulsBoss ? 1.55 : e.isBoss ? 1.45 : 1.15,
      z: e.z,
      radius: e.radius || 0.7,
      isBoss: Boolean(e.isBoss || e.isSoulsBoss)
    };
  }

  function syncWorldLockOn() {
    world?.setLockOnTarget?.(buildLockOnWorldPayload(lockedEnemy));
  }

  function findBestLockOnCandidate(excludeEnemy = null) {
    const faceSin = Math.sin(player.facing || 0);
    const faceCos = Math.cos(player.facing || 0);
    let bestBoss = null;
    let bestBossScore = Infinity;
    let bestMob = null;
    let bestMobScore = Infinity;

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e === excludeEnemy || !isEnemyLockable(e, LOCK_ON_ACQUIRE_RADIUS)) continue;
      const dx = e.x - player.x;
      const dz = e.z - player.z;
      const dist = Math.hypot(dx, dz);
      const alignDot = dist > 0.01 ? (dx * faceSin + dz * faceCos) / dist : 1;
      const score = dist - alignDot * 2.4;
      if (e.isBoss || e.isSoulsBoss) {
        if (score < bestBossScore) {
          bestBossScore = score;
          bestBoss = e;
        }
      } else if (score < bestMobScore) {
        bestMobScore = score;
        bestMob = e;
      }
    }
    return bestBoss || bestMob;
  }

  function validateLockedEnemy(allowAutoSwitchOnDeath = true) {
    if (!isSoulslike) {
      if (lockedEnemy) {
        lockedEnemy = null;
        world?.setLockOnTarget?.(null);
      }
      return null;
    }
    if (!lockedEnemy) {
      syncWorldLockOn();
      return null;
    }
    const stillInList = enemies.includes(lockedEnemy);
    const stillAlive = stillInList && lockedEnemy.hp > 0;
    if (!stillAlive) {
      const deadTarget = lockedEnemy;
      lockedEnemy = allowAutoSwitchOnDeath ? findBestLockOnCandidate(deadTarget) : null;
      syncWorldLockOn();
      return lockedEnemy;
    }
    const dist = Math.hypot(lockedEnemy.x - player.x, lockedEnemy.z - player.z);
    if (dist > LOCK_ON_BREAK_RADIUS || (isSoulslike && lockedEnemy.isSoulsBoss && !souls.bossAwakened)) {
      lockedEnemy = null;
      lockOnWallBlockedSec = 0;
      syncWorldLockOn();
      return null;
    }
    if (isSoulslike && !hasSoulsTargetWallLos(lockedEnemy)) {
      lockOnWallBlockedSec += 0.016;
      if (lockOnWallBlockedSec >= 0.45) {
        lockedEnemy = null;
        lockOnWallBlockedSec = 0;
        syncWorldLockOn();
        return null;
      }
    } else {
      lockOnWallBlockedSec = 0;
    }
    syncWorldLockOn();
    return lockedEnemy;
  }

  function clearTargetLock() {
    const wasLocked = Boolean(lockedEnemy);
    lockedEnemy = null;
    world?.setLockOnTarget?.(null);
    return { locked: false, wasLocked, target: null };
  }

  function getLockedTarget() {
    if (!isSoulslike) return null;
    if (!lockedEnemy || lockedEnemy.hp <= 0 || !enemies.includes(lockedEnemy)) {
      return null;
    }
    if (Math.hypot(lockedEnemy.x - player.x, lockedEnemy.z - player.z) > LOCK_ON_BREAK_RADIUS) {
      return null;
    }
    return lockedEnemy;
  }

  function toggleTargetLock() {
    if (!isSoulslike) {
      return { locked: false, target: null, unsupported: true };
    }
    if (!runActive || runEnded || playerDying) {
      return { locked: false, wasLocked: false, target: null };
    }
    const current = getLockedTarget();
    if (current) {
      lockedEnemy = null;
      world?.setLockOnTarget?.(null);
      return { locked: false, wasLocked: true, target: null };
    }
    lockedEnemy = null;
    const best = findBestLockOnCandidate(null);
    if (best) {
      lockedEnemy = best;
      cancelPlayerTurn180(0.25);
      syncWorldLockOn();
      audio?.playUiClick?.();
      return { locked: true, wasLocked: false, target: best };
    }
    world?.setLockOnTarget?.(null);
    return { locked: false, wasLocked: false, target: null };
  }

  function cycleTargetLock(dir = 1) {
    if (!isSoulslike) {
      return { locked: false, target: null, unsupported: true };
    }
    if (!runActive || runEnded || playerDying) {
      return { locked: false, target: null, switched: false };
    }
    const candidates = [];
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (isEnemyLockable(e, LOCK_ON_ACQUIRE_RADIUS)) {
        candidates.push(e);
      }
    }
    if (!candidates.length) {
      lockedEnemy = null;
      world?.setLockOnTarget?.(null);
      return { locked: false, target: null, switched: false };
    }
    const current = getLockedTarget();
    if (!current || !candidates.includes(current)) {
      const best = findBestLockOnCandidate(null) || candidates[0];
      lockedEnemy = best;
      cancelPlayerTurn180(0.25);
      syncWorldLockOn();
      audio?.playUiClick?.();
      return { locked: true, target: best, switched: true };
    }
    if (candidates.length < 2) {
      syncWorldLockOn();
      return { locked: true, target: current, switched: false };
    }
    candidates.sort(
      (a, b) =>
        Math.atan2(a.x - player.x, a.z - player.z) - Math.atan2(b.x - player.x, b.z - player.z)
    );
    const curIdx = candidates.indexOf(current);
    const step = dir < 0 ? -1 : 1;
    const nextIdx = (curIdx + step + candidates.length) % candidates.length;
    lockedEnemy = candidates[nextIdx];
    cancelPlayerTurn180(0.20);
    syncWorldLockOn();
    audio?.playUiClick?.();
    return { locked: true, target: lockedEnemy, switched: true };
  }

  // === Mobile-Only Smart Target Lock & Tactical Auto-Flask Helpers ===
  function findBestMobileSmartTarget(excludeEnemy = null) {
    if (!isSoulslike) return null;
    const faceSin = Math.sin(player.facing || 0);
    const faceCos = Math.cos(player.facing || 0);
    let bestBoss = null;
    let bestBossScore = Infinity;
    let bestMob = null;
    let bestMobScore = Infinity;

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e || e === excludeEnemy || e.hp <= 0 || e.isTrainingDummy || (e.emergeTimer || 0) > 0) continue;
      const isBossTarget = Boolean(e.isBoss || e.isSoulsBoss);
      if (isBossTarget && !souls.bossAwakened) continue;
      const dx = e.x - player.x;
      const dz = e.z - player.z;
      const dist = Math.hypot(dx, dz);
      const maxAcquire = isBossTarget ? 24.0 : 14.5;
      if (dist > maxAcquire) continue;
      // Only auto-lock onto awakened/aggroed enemies or close immediate threats!
      if (!isBossTarget && !e.soulsAwake && dist > 9.0) continue;
      if (!hasSoulsTargetWallLos(e)) continue;

      const alignDot = dist > 0.01 ? (dx * faceSin + dz * faceCos) / dist : 1;
      const meleeUrgency = !isBossTarget && dist <= 4.0 ? -3.4 : 0;
      const swingUrgency = Boolean(e._mobActiveSwing || e.aiState === 'attack' || e.aiState === 'windup') ? -2.2 : 0;
      const score = dist - alignDot * 1.4 + meleeUrgency + swingUrgency;

      if (isBossTarget) {
        if (score < bestBossScore) {
          bestBossScore = score;
          bestBoss = e;
        }
      } else if (score < bestMobScore) {
        bestMobScore = score;
        bestMob = e;
      }
    }
    return bestBoss || bestMob;
  }

  function handleMobileSmartLockTap() {
    if (!isSoulslike || !runActive || runEnded || playerDying) {
      return { locked: false, target: null };
    }
    const lockableNow = [];
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (isEnemyLockable(e, LOCK_ON_ACQUIRE_RADIUS)) {
        lockableNow.push(e);
      }
    }
    const current = getLockedTarget();
    if (current && lockableNow.length >= 2) {
      souls.mobileManualUnlockTimer = 0;
      return cycleTargetLock(1);
    }
    if (current) {
      lockedEnemy = null;
      souls.mobileManualUnlockTimer = 6.5;
      syncWorldLockOn();
      audio?.playUiClick?.();
      return { locked: false, wasLocked: true, target: null };
    }
    souls.mobileManualUnlockTimer = 0;
    const best = findBestMobileSmartTarget(null) || findBestLockOnCandidate(null);
    if (best) {
      lockedEnemy = best;
      cancelPlayerTurn180(0.25);
      syncWorldLockOn();
      audio?.playUiClick?.();
      return { locked: true, wasLocked: false, target: best };
    }
    return { locked: false, wasLocked: false, target: null };
  }

  function isImminentDangerForAutoFlask(emergencyOnly = false) {
    if (world?.isPointInFlameTrap?.(player.x, player.z, 1.0, player.radius + 0.35)) {
      return true;
    }
    for (let bi = 0; bi < activeBurningZones.length; bi++) {
      const bz = activeBurningZones[bi];
      if (!bz || bz.life <= 0) continue;
      if (bz.shape === 'line') {
        const ldx = bz.x2 - bz.x1;
        const ldz = bz.z2 - bz.z1;
        const lenSq = Math.max(0.0001, ldx * ldx + ldz * ldz);
        const t = clamp(((player.x - bz.x1) * ldx + (player.z - bz.z1) * ldz) / lenSq, 0, 1);
        const cx = bz.x1 + ldx * t;
        const cz = bz.z1 + ldz * t;
        if (Math.hypot(player.x - cx, player.z - cz) <= (bz.halfWidth || 1.2) + player.radius + 0.25) {
          return true;
        }
      } else if (Math.hypot(player.x - bz.x, player.z - bz.z) <= (bz.radius || 2.2) + player.radius + 0.25) {
        return true;
      }
    }
    for (let pi = 0; pi < projectiles.length; pi++) {
      const pr = projectiles[pi];
      if (!pr || pr.fromPlayer) continue;
      if (Math.hypot(pr.x - player.x, pr.z - player.z) <= (emergencyOnly ? 2.8 : 4.6)) {
        return true;
      }
    }
    const mobDangerDist = emergencyOnly ? 3.0 : 4.5;
    const bossDangerDist = emergencyOnly ? 4.8 : 6.8;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e || e.hp <= 0 || (e.emergeTimer || 0) > 0) continue;
      const d = Math.hypot(e.x - player.x, e.z - player.z);
      if (e.isSoulsBoss) {
        if (!souls.bossAwakened || d > bossDangerDist) continue;
        const st = String(e.soulsState || '');
        const safeBossStates =
          st === 'stalk' ||
          st === 'idle' ||
          st === 'recover' ||
          st === 'cooldown' ||
          st === 'stagger_kneel' ||
          st === 'staggered' ||
          st === 'stagger_recover';
        if (!safeBossStates || d <= 2.9) return true;
      } else {
        if (d > mobDangerDist) continue;
        if (
          e._mobActiveSwing ||
          e.aiState === 'attack' ||
          e.aiState === 'windup' ||
          e.aiState === 'lunge' ||
          (!emergencyOnly && d <= 2.35 && (e.stunTimer || 0) <= 0 && (e.parriedRiposteTimer || 0) <= 0)
        ) {
          return true;
        }
      }
    }
    return false;
  }

  function findAutoAimTarget(maxRange) {
    // When Dark Souls Target Lock-On is active and target is within weapon reach, always prioritize locked target!
    const activeLocked = getLockedTarget();
    if (activeLocked) {
      const ldx = activeLocked.x - player.x;
      const ldz = activeLocked.z - player.z;
      const lockedEdgeDist = Math.max(0, Math.hypot(ldx, ldz) - (activeLocked.radius || 0));
      if (lockedEdgeDist <= maxRange) {
        return activeLocked;
      }
    }

    let bestTarget = null;
    let bestScore = maxRange;
    const arenaCap = ARENA_HALF_SIZE - 0.35;

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.hp <= 0) continue;
      if (Math.abs(e.x) > arenaCap || Math.abs(e.z) > arenaCap) continue;
      if (!stats?.clampToArenaBounds && world?.isWorldPointVisible && !world.isWorldPointVisible(e.x, e.z, 0.85, 0.93)) continue;
      const dx = e.x - player.x;
      const dz = e.z - player.z;
      const edgeDist = Math.max(0, Math.hypot(dx, dz) - (e.radius || 0));
      if (edgeDist <= bestScore) {
        bestScore = edgeDist;
        bestTarget = e;
      }
    }

    if (bestTarget) return bestTarget;

    // Auto-target Relic Weapon Crate when nearby AND visible on screen
    for (let i = 0; i < pickups.length; i++) {
      const p = pickups[i];
      if (p.type === 'relic_weapon_crate' && p.hp > 0) {
        if (world?.isWorldPointVisible && !world.isWorldPointVisible(p.x, p.z, 0.75, 0.93)) continue;
        const dx = p.x - player.x;
        const dz = p.z - player.z;
        const edgeDist = Math.max(0, Math.hypot(dx, dz) - (p.radius || 0));
        if (edgeDist <= maxRange) {
          return p;
        }
      }
    }
    return null;
  }

  // Warrior 3-hit combo clip timing (Warrior_Run.glb — all 3 clips shifted to ~1.000s):
  //   Step 1: 1H_Melee_Attack_Slice_Horizontal -> peak sword velocity across front at t_clip = 0.42s
  //   Step 2: Slash v4 (60 FPS lunge + Top-Left -> Bottom-Right diagonal cut) -> peak impact at t_clip = 0.433s (f27)
  //   Step 3: Attack                           -> heavy overhead slam finisher at t_clip = 0.50s
  // Matches computeSyncedClipSpeed() in js/models.js so damage, slash VFX, and hitmarkers fire on impact.
  const WARRIOR_MELEE_CLIP_DURATION = 1.000;
  const WARRIOR_COMBO_IMPACT_TIMES = { 1: 0.42, 2: 0.433, 3: 0.50 };

  function computeMeleeImpactDelay(wpnId, attackDuration, comboStep = 1) {
    const isHeavyWpn = wpnId === 'axe' || wpnId === 'boss_hammer';
    const baseClipSpd =
      comboStep === 3
        ? (isHeavyWpn ? 0.86 : 0.98)
        : comboStep === 2
          ? (isHeavyWpn ? 1.18 : 1.42)
          : (isHeavyWpn ? 1.25 : 1.55);
    const minNeededSpeed =
      attackDuration > 0
        ? WARRIOR_MELEE_CLIP_DURATION / Math.max(0.22, attackDuration * 0.96)
        : baseClipSpd;
    const clipSpeed = Math.min(3.5, Math.max(baseClipSpd, minNeededSpeed));
    const impactClipTime = WARRIOR_COMBO_IMPACT_TIMES[comboStep] || 0.42;
    const rawDelay = impactClipTime / clipSpeed;
    const maxSafeDelay = attackDuration > 0 ? Math.max(0.08, attackDuration * 0.80) : 0.62;
    return clamp(rawDelay, 0.08, maxSafeDelay);
  }

  function resolvePendingMeleeStrike(strike) {
    if (!strike || !runActive || runEnded || playerDying || player.hp <= 0 || player.beastTimeLeft > 0) return;

    const {
      wpnId,
      wpnColor,
      wpnMaxTargets,
      wpnStunChance,
      wpnStunDuration,
      wpnDisarmChance,
      wpnDisarmDuration,
      isCritSwing,
      isOverdrive,
      comboStep = 1,
      isComboFinisher = false,
      comboKbMult = 1.0,
      effRange,
      effArc,
      baseMeleeDmg,
      critMult,
      knockback
    } = strike;

    if (!strike.whooshPlayed) {
      strike.whooshPlayed = true;
      audio?.playMeleeSwing?.(wpnId, isCritSwing);
    }

    // Use live Warrior facing at the exact moment the sword blade sweeps across the front strike zone
    const swingAim = Number.isFinite(player.facing) ? player.facing : (strike.strikeAngle ?? strike.aimAngle);
    const fwdX = Math.sin(swingAim);
    const fwdZ = Math.cos(swingAim);
    // Hero faces +Z; local -X is Right (sword side), local +X is Left (shield side).
    const rightX = -Math.cos(swingAim);
    const rightZ = Math.sin(swingAim);

    const isSpear = wpnId === 'spear';
    const isAxe = wpnId === 'axe';
    const isZwei = wpnId === 'zweihander';
    const isHammer = wpnId === 'boss_hammer';
    const isCleaveMelee = isAxe || isZwei || isHammer;
    const isOneHandSword = !isSpear && !isCleaveMelee;

    const halfArc = effArc * 0.5;
    const rightHalfArc = isOneHandSword ? halfArc + 0.14 : halfArc + 0.08;
    const leftHalfArc = isOneHandSword ? halfArc : halfArc + 0.08;

    // Strict frontal sword-sweep check: rejects enemies touching the left-hand shield side or behind the Warrior!
    const isInSwordArc = (dx, dz, dist) => {
      if (dist <= 0.45) return true;
      const localForward = dx * fwdX + dz * fwdZ;
      if (localForward < -0.05) return false;
      const relAng = normalizeAngle(Math.atan2(dx, dz) - swingAim);
      // relAng < 0 = Warrior's right (sword) side; relAng > 0 = Warrior's left (shield) side
      return relAng >= -rightHalfArc && relAng <= leftHalfArc;
    };

    // Pick the single best aligned enemy inside the sword's live frontal strike arc
    let bestTarget = null;
    let bestScore = Infinity;
    let bestDx = fwdX;
    let bestDz = fwdZ;
    let bestDist = effRange * 0.8;
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (!e || e.hp <= 0) continue;
      const dx = e.x - player.x;
      const dz = e.z - player.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= effRange + e.radius && isInSwordArc(dx, dz, dist)) {
        const angDiff = Math.abs(normalizeAngle(Math.atan2(dx, dz) - swingAim));
        const score = dist + angDiff * 1.35 - (e === lockedEnemy ? 2.5 : 0);
        if (score < bestScore) {
          bestScore = score;
          bestTarget = e;
          bestDx = dx;
          bestDz = dz;
          bestDist = dist;
        }
      }
    }

    const swingColor = isCritSwing ? 0xdc2626 : isComboFinisher ? 0xfbbf24 : isOverdrive ? 0xf97316 : wpnColor;
    // Keep the slash arc anchored along the Warrior's forward sword sweep (never twisting sideways to the shield)
    const rawTargetDelta = bestTarget ? normalizeAngle(Math.atan2(bestDx, bestDz) - swingAim) : 0;
    const strikeAng = swingAim + clamp(rawTargetDelta, -0.26, 0.26);
    const strikeVisualArc = isCleaveMelee
      ? effArc
      : isSpear
        ? Math.min(Math.PI * 0.28, effArc * (isComboFinisher ? 0.68 : 0.55))
        : Math.min(Math.PI * 0.62, effArc * (isComboFinisher ? 0.82 : 0.68));
    const strikeVisualRange = isSpear
      ? Math.max(1.85, effRange)
      : bestTarget
        ? Math.min(effRange, Math.max(1.15, bestDist + 0.35))
        : effRange * 0.94;

    // Anchor slash VFX at the right-hand sword pivot so the crescent visibly sweeps from the sword, not the shield
    const swordSideOff = isOneHandSword ? 0.16 : isSpear ? 0.14 : 0.10;
    const swordFwdOff = isSpear ? 0.18 : 0.14;
    const slashX = player.x + rightX * swordSideOff + fwdX * swordFwdOff;
    const slashZ = player.z + rightZ * swordSideOff + fwdZ * swordFwdOff;
    const baseSweep = isSpear ? 0 : isCleaveMelee ? 0.48 : 0.44;
    const slashOpts = {
      y: comboStep === 2 ? 1.04 : comboStep === 3 ? 0.98 : 0.92,
      duration: isComboFinisher ? 0.23 : 0.18,
      sweepRad: comboStep === 2 ? -baseSweep * 1.15 : comboStep === 3 ? baseSweep * 1.25 : baseSweep
    };
    emitSlashArc(
      slashX,
      slashZ,
      strikeAng,
      isCleaveMelee ? Math.max(1.4, effRange) : strikeVisualRange,
      strikeVisualArc,
      swingColor,
      slashOpts
    );
    if (isCritSwing || isComboFinisher) {
      emitSlashArc(
        slashX,
        slashZ,
        strikeAng,
        (isCleaveMelee ? Math.max(1.4, effRange) : strikeVisualRange) * 0.95,
        strikeVisualArc * 0.86,
        0xfde047,
        slashOpts
      );
      if (isComboFinisher) {
        emitShockwave(slashX + fwdX * 1.1, slashZ + fwdZ * 1.1, Math.min(2.6, effRange * 0.72), 0xfbbf24, 0.28);
        emitParticles(slashX + fwdX * 0.72, 0.92, slashZ + fwdZ * 0.72, 0xfde047, 10, 6.2, 0.14);
        world?.addScreenShake?.(0.15, 0.10);
      }
    }

    const hitDmg = isCritSwing ? Math.round(baseMeleeDmg * critMult) : baseMeleeDmg;
    const kbMult = (isCritSwing ? 1.32 : 1.0) * comboKbMult;

    const emitSwordContactSpark = (target, nx, nz) => {
      if (!target) return;
      const pull = Math.min(target.isBoss ? 1.15 : 0.32, (target.radius || 0.45) * 0.65);
      const cx = target.x - nx * pull;
      const cz = target.z - nz * pull;
      emitParticles(cx, 0.92, cz, isCritSwing || isComboFinisher ? 0xfde047 : 0xfffbeb, isComboFinisher ? 8 : 5, isComboFinisher ? 5.8 : 4.8, 0.10);
    };

    const findInlineBehindTarget = (ux, uz, primary, primaryDist, maxProjReach) => {
      let found = null;
      let bestInlineScore = Infinity;
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (!e || e.hp <= 0 || e === primary) continue;
        const ex = e.x - player.x;
        const ez = e.z - player.z;
        const projAlong = ex * ux + ez * uz;
        const lateralDist = Math.abs(ex * (-uz) + ez * ux);
        const cap = Math.max(maxProjReach + (e.radius || 0.45), primaryDist + (e.radius || 0.45) * 2.1 + 0.45);
        if (
          projAlong > primaryDist + 0.15 &&
          projAlong <= cap &&
          lateralDist <= Math.min(0.72, (e.radius || 0.45) + 0.24)
        ) {
          const inlineScore = projAlong + lateralDist * 2.0;
          if (inlineScore < bestInlineScore) {
            bestInlineScore = inlineScore;
            found = e;
          }
        }
      }
      return found;
    };

    const collectFrontalTargets = (maxCount) => {
      const extras = [];
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (!e || e.hp <= 0 || e === bestTarget) continue;
        const dx = e.x - player.x;
        const dz = e.z - player.z;
        const dist = Math.hypot(dx, dz);
        if (dist <= effRange + e.radius && isInSwordArc(dx, dz, dist)) {
          const angDiffFromStrike = Math.abs(normalizeAngle(Math.atan2(dx, dz) - strikeAng));
          if (angDiffFromStrike <= halfArc + 0.08) {
            extras.push({ enemy: e, dx, dz, dist, score: angDiffFromStrike * 1.35 + dist });
          }
        }
      }
      extras.sort((a, b) => a.score - b.score);
      const list = [];
      if (bestTarget) {
        list.push({ enemy: bestTarget, dx: bestDx, dz: bestDz, dist: bestDist });
      }
      const slots = Math.max(0, maxCount - list.length);
      for (let i = 0; i < Math.min(slots, extras.length); i++) {
        list.push(extras[i]);
      }
      return list;
    };

    if (isSpear) {
      const ux = Math.sin(strikeAng);
      const uz = Math.cos(strikeAng);
      if (bestTarget) {
        const nx = bestDist > 0.001 ? bestDx / bestDist : ux;
        const nz = bestDist > 0.001 ? bestDz / bestDist : uz;
        const inlineSecond = findInlineBehindTarget(ux, uz, bestTarget, bestDist, effRange + 0.25);
        emitSwordContactSpark(bestTarget, nx, nz);
        applyDamageToEnemy(bestTarget, hitDmg, nx * knockback * kbMult, nz * knockback * kbMult, true, { isCrit: isCritSwing, isComboFinisher, weaponId: wpnId });
        if (inlineSecond && inlineSecond.hp > 0) {
          const secDmg = Math.max(1, Math.round(hitDmg * 0.5));
          applyDamageToEnemy(inlineSecond, secDmg, ux * knockback * 0.72 * kbMult, uz * knockback * 0.72 * kbMult, true, { isCrit: isCritSwing, isComboFinisher, armorPierceOverride: 0.15, weaponId: wpnId });
          emitParticles(inlineSecond.x, 0.75, inlineSecond.z, wpnColor || 0x38bdf8, 8, 4.5, 0.18);
        }
      }
      // Bold forward spear-lunge piercing streak VFX along thrust line from right hand
      for (let step = 1; step <= 4; step++) {
        const d = 0.55 + (step / 4) * Math.max(1.5, effRange);
        emitParticles(slashX + ux * d, 0.92, slashZ + uz * d, wpnColor || 0x38bdf8, 3, 2.8, 0.14);
      }
    } else if (isCleaveMelee) {
      const targetsToHit = collectFrontalTargets(Math.max(1, wpnMaxTargets || (isZwei ? 2 : 3)));
      if (isHammer && bestTarget) {
        const ux = Math.sin(strikeAng);
        const uz = Math.cos(strikeAng);
        const inlineSecond = findInlineBehindTarget(ux, uz, bestTarget, bestDist, effRange + 0.45);
        if (inlineSecond && !targetsToHit.some((t) => t.enemy === inlineSecond)) {
          const idx = inlineSecond.x - player.x;
          const idz = inlineSecond.z - player.z;
          targetsToHit.push({ enemy: inlineSecond, dx: idx, dz: idz, dist: Math.hypot(idx, idz) });
        }
      }
      for (const t of targetsToHit) {
        if (!t.enemy || t.enemy.hp <= 0) continue;
        const nx = t.dist > 0.001 ? t.dx / t.dist : Math.sin(strikeAng);
        const nz = t.dist > 0.001 ? t.dz / t.dist : Math.cos(strikeAng);
        emitSwordContactSpark(t.enemy, nx, nz);
        applyDamageToEnemy(t.enemy, hitDmg, nx * knockback * kbMult, nz * knockback * kbMult, true, { isCrit: isCritSwing, isComboFinisher, weaponId: wpnId });
        if (isHammer && t.enemy.hp > 0 && wpnStunChance > 0 && Math.random() < wpnStunChance) {
          t.enemy.stunTimer = Math.max(t.enemy.stunTimer || 0, wpnStunDuration || 0.5);
          emitParticles(t.enemy.x, 1.38, t.enemy.z, 0xfacc15, 7, 3.6, 0.14);
          world?.spawnShockwaveRing?.({ x: t.enemy.x, y: 0.08, z: t.enemy.z, radius: 0.95, color: 0xfacc15, duration: 0.28 });
        }
        if (isZwei && t.enemy.hp > 0 && wpnDisarmChance > 0 && Math.random() < wpnDisarmChance) {
          t.enemy.disarmTimer = Math.max(t.enemy.disarmTimer || 0, wpnDisarmDuration || 2.0);
          emitParticles(t.enemy.x, 1.32, t.enemy.z, 0x93c5fd, 7, 3.6, 0.14);
          floatText('🗡️ ОБЕЗОРУЖЕН!', t.enemy.x, t.enemy.z, '#93c5fd');
        }
      }
      const cleaveX = bestTarget ? bestTarget.x : slashX + fwdX * Math.min(1.8, effRange * 0.75);
      const cleaveZ = bestTarget ? bestTarget.z : slashZ + fwdZ * Math.min(1.8, effRange * 0.75);
      emitParticles(cleaveX, 0.62, cleaveZ, wpnColor || 0xef4444, isHammer ? 14 : 11, 6.0, 0.15);
      world?.addScreenShake?.(isHammer ? 0.24 : 0.14, 0.12);
    } else {
      // Starter Sword ('club'): strict 1-target precision hit along the sword blade sweep
      if (bestTarget) {
        const nx = bestDist > 0.001 ? bestDx / bestDist : fwdX;
        const nz = bestDist > 0.001 ? bestDz / bestDist : fwdZ;
        emitSwordContactSpark(bestTarget, nx, nz);
        applyDamageToEnemy(bestTarget, hitDmg, nx * knockback * kbMult, nz * knockback * kbMult, true, { isCrit: isCritSwing, isComboFinisher, weaponId: wpnId });
      }
    }

    // Explosive barrels inside the sword sweep always detonate even when slashing enemies beside them!
    for (let i = pickups.length - 1; i >= 0; i--) {
      const b = pickups[i];
      if (!b || b.hp <= 0 || b.type !== 'explosive_barrel') continue;
      const dx = b.x - player.x;
      const dz = b.z - player.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= effRange + b.radius && isInSwordArc(dx, dz, dist)) {
        hitCrate(b);
      }
    }

    if (!bestTarget) {
      let bestCrate = null;
      let bestCrateIdx = -1;
      let bestCrateDist = Infinity;
      for (let i = pickups.length - 1; i >= 0; i--) {
        const p = pickups[i];
        if (!p || p.hp <= 0) continue;
        if (
          p.type !== 'relic_weapon_crate' &&
          p.type !== 'supply_crate' &&
          p.type !== 'mimic_disguise' &&
          p.type !== 'cursed_chest'
        ) continue;
        const dx = p.x - player.x;
        const dz = p.z - player.z;
        const dist = Math.hypot(dx, dz);
        if (p.type === 'supply_crate' && dist < 1.65) continue;
        if (dist <= effRange + p.radius && isInSwordArc(dx, dz, dist) && dist < bestCrateDist) {
          bestCrateDist = dist;
          bestCrate = p;
          bestCrateIdx = i;
        }
      }
      if (bestCrate) {
        hitCrate(bestCrate);
        if (bestCrate.hp <= 0) {
          removePickup(bestCrate, bestCrateIdx);
        }
      }
    }
  }

  function performHeroAttack(aimAngle, isManualTrigger = false, attackOpts = null) {
    const wpn = WEAPONS[currentWeaponId] || WEAPONS.club;
    const isOverdrive = player.overdriveAmmo > 0;
    const isBeastFree = player.beastTimeLeft > 0;
    const usesMag = (stats.magSize || 0) > 0;
    const usesMana = Boolean(stats.usesMana && player.maxMana > 0);

    // Chapter 26 Elden Ring TAE Attack Pipeline (strictly `isSoulslike === true` & melee!)
    if (isSoulslike && wpn.type === 'melee') {
      if (souls.zoneMode === 'exterior_shore' && !souls.shoreSwordPickedUp) {
        if ((souls.shoreNoSwordHintCd || 0) <= 0) {
          souls.shoreNoSwordHintCd = 1.25;
          floatText('Подберите Большую Дубину!', player.x, player.z - 0.7, '#fde68a');
          callbacks?.onToast?.('Сначала подберите Большую Дубину на берегу!');
        }
        return false;
      }
      if (souls.guardBreakTimer > 0 || souls.flaskDrinkTimer > 0) return false;

      let attackKey = attackOpts?.attackKey || null;
      if (!attackKey) {
        if (souls.guardCounterTimer > 0) {
          attackKey = 'guard_counter';
        } else {
          const nextStep = (player.comboTimer || 0) > 0 ? ((player.comboStep || 0) % 3) + 1 : 1;
          attackKey = nextStep === 3 ? 'r1_3' : nextStep === 2 ? 'r1_2' : 'r1_1';
        }
      } else if (attackKey === 'r2' && souls.guardCounterTimer > 0) {
        attackKey = 'guard_counter';
      }

      const spec = getSoulsAttackSpec(attackKey, wpn.id);
      if (!soulsStaminaCtrl.canSpend()) {
        if (soulsStaminaEmptyHintCd <= 0) {
          soulsStaminaEmptyHintCd = 0.55;
          floatText('Нет выносливости!', player.x, player.z - 0.5, '#fca5a5');
        }
        return false;
      }

      soulsStaminaCtrl.spend(spec.stamina, { allowDebt: true });
      syncSoulsStaminaMirror();
      souls.isBlocking = false;
      souls.blockParryConsumed = false;
      souls.parryWindowTimer = 0;
      setModelBlocking(heroModel, false);

      cancelPlayerTurn180(0.40);
      player.runMomentumTime = 0;

      const isGuardCounter = attackKey === 'guard_counter';
      const isHeavyMove =
        attackKey === 'r2' ||
        attackKey === 'charged_r2' ||
        attackKey === 'guard_counter' ||
        attackKey === 'r1_3';

      if (isGuardCounter) {
        souls.guardCounterTimer = 0;
        audio?.playGuardCounterCue?.();
      }

      player.meleeSwingCount = (player.meleeSwingCount || 0) + 1;
      let animComboStep = 1;
      if (attackKey === 'r1_1') {
        player.comboStep = 1;
        animComboStep = 1;
      } else if (attackKey === 'r1_2') {
        player.comboStep = 2;
        animComboStep = 2;
      } else if (attackKey === 'r1_3') {
        player.comboStep = 3;
        animComboStep = 3;
      } else if (attackKey === 'rolling_r1') {
        player.comboStep = 1; // rolling_r1 chains naturally into r1_2!
        animComboStep = 1;
      } else {
        player.comboStep = 0;
        animComboStep = 3;
      }
      player.comboTimer = Math.max(COMBO_RESET_TIME, 2.35);

      const totalDur = spec.startup + spec.active + spec.recovery;
      const isHeavyThrustMove = attackKey === 'r2' || attackKey === 'charged_r2';
      player.attackAimAngle = aimAngle;
      player.attackCooldown = totalDur;
      player.attackFaceHoldTimer = Math.max(player.attackFaceHoldTimer || 0, spec.startup + spec.active + 0.14);
      player.attackAnimTimer = Math.max(player.attackAnimTimer || 0, spec.startup + spec.active + 0.10);
      if (isHeavyThrustMove) {
        const thrustSpeedScale = clamp(0.90 / Math.max(0.45, totalDur), 0.72, 1.55);
        const playedThrust = Boolean(
          heroModel?.handle?.playHeavyThrustAnim?.(thrustSpeedScale, totalDur) ||
            heroModel?.obj?.userData?.playHeavyThrustAnim?.(thrustSpeedScale, totalDur)
        );
        if (!playedThrust) {
          triggerModelAttack(heroModel, wpn.type, totalDur, 4);
        }
      } else {
        triggerModelAttack(heroModel, wpn.type, totalDur, animComboStep);
      }

      const lungeDist = Math.max(0, Number(spec.lungeDist) || 0);
      if (lungeDist > 0.02) {
        meleeStepLunge = {
          elapsed: 0,
          duration: Math.max(0.22, spec.startup + spec.active * 0.88),
          totalDist: lungeDist,
          comboStep: animComboStep,
          dirX: Math.sin(aimAngle),
          dirZ: Math.cos(aimAngle),
          useSoulsCurve: true,
          plantDustFired: false
        };
      } else {
        meleeStepLunge = null;
      }

      const effRange = Math.max(1.85, (stats.range || 1.25) + (isHeavyMove ? 0.85 : 0.70));
      const coneHalfRad = Math.min(Math.PI * 0.62, (stats.arcAngle || Math.PI * 0.56) * (isHeavyMove ? 0.72 : 0.62));
      souls.activeAttack = {
        key: attackKey,
        spec,
        elapsed: 0,
        comboStep: animComboStep,
        isHeavy: isHeavyMove,
        isFinisher: attackKey === 'r1_3' || attackKey === 'charged_r2' || attackKey === 'guard_counter',
        upgradedToCharged: attackKey === 'charged_r2',
        chargeHoldTime: 0,
        chargeSparkAccum: 0,
        strikeAngle: aimAngle,
        aimAngle,
        range: effRange,
        coneHalfRad,
        wpnId: wpn.id,
        wpnColor: wpn.color,
        hitUids: new Set(),
        prevSeg: null,
        vfxPlayed: false,
        whooshPlayed: false
      };
      pendingMeleeStrikes.length = 0;
      player.hasHyperArmor = Boolean(spec.hyperarmor);
      return true;
    }

    if (!isOverdrive && !isBeastFree && usesMana) {
      const mCost = stats.manaCost || 8;
      if (player.mana < mCost) {
        if (isManualTrigger && manaEmptyHintCooldown <= 0) {
          manaEmptyHintCooldown = 0.85;
          floatText('💧 Мало маны!', player.x, player.z, '#60a5fa');
        }
        return;
      }
      player.mana = Math.max(0, player.mana - mCost);
    }

    let ammoBeforeShot = player.ammo;
    if (!isOverdrive && usesMag) {
      if (player.isReloading) {
        // Interruptible shell-by-shell partial reload: firing with loaded shell(s) cancels reload!
        if ((stats?.reloadPerShellTime || 0) > 0 && player.ammo > 0) {
          player.isReloading = false;
          player.reloadTimer = 0;
          player.reloadShellAccum = 0;
          syncHeroReloadModel(false);
        } else {
          return;
        }
      }
      if (player.ammo <= 0) {
        triggerReload();
        return;
      }
      ammoBeforeShot = player.ammo;
      player.ammo = Math.max(0, player.ammo - 1);
    }

    if (isOverdrive) {
      player.overdriveAmmo = Math.max(0, player.overdriveAmmo - 1);
      if (player.overdriveAmmo === 0 && overdriveCrateVisual) {
        removeSceneObject(overdriveCrateVisual, overdriveCrateVisual);
        overdriveCrateVisual = null;
      }
    }

    // 🔥 Гнев Несокрушимого (war_iron_banner): missing HP boosts Warrior attack speed & damage up to +45% per stack!
    const missingHpRatio = wpn.type === 'melee' && (stats.warBannerStacks || 0) > 0
      ? clamp(1 - player.hp / Math.max(1, stats.maxHp), 0, 0.85)
      : 0;
    const berserkBoost = 1 + missingHpRatio * (stats.warBannerStacks || 0) * 0.52;

    // Non-melee fallback guard for Souls mode (if Mage/Gunslinger ever enters Rift)
    if (isSoulslike) {
      if (souls.guardBreakTimer > 0 || souls.flaskDrinkTimer > 0) return;
      if (!soulsStaminaCtrl.canSpend()) {
        if (soulsStaminaEmptyHintCd <= 0) {
          soulsStaminaEmptyHintCd = 0.55;
          floatText('Нет выносливости!', player.x, player.z - 0.5, '#fca5a5');
        }
        return;
      }
      soulsStaminaCtrl.spend(14, { allowDebt: true });
      syncSoulsStaminaMirror();
      souls.isBlocking = false;
      setModelBlocking(heroModel, false);
    }

    // Strict rule: any attack immediately cancels & suppresses Turn_180 (hero turns/strikes right away!)
    cancelPlayerTurn180(0.40);
    player.runMomentumTime = 0;

    player.attackAimAngle = aimAngle;
    player.attackFaceHoldTimer = Math.max(player.attackFaceHoldTimer || 0, 0.36);
    player.attackAnimTimer = 0.22;
    let baseCooldown = (isOverdrive ? stats.cooldown / 1.55 : stats.cooldown) / berserkBoost;

    let meleeComboStep = 1;
    if (wpn.type === 'melee') {
      player.meleeSwingCount = (player.meleeSwingCount || 0) + 1;
      meleeComboStep = (player.comboTimer || 0) > 0
        ? ((player.comboStep || 0) % 3) + 1
        : 1;
      player.comboStep = meleeComboStep;
      player.comboTimer = Math.max(COMBO_RESET_TIME, 2.35);
      // Snappy 2nd combo cut (Slash v4 @ 1.42x) and heavy 3rd overhead finisher (Attack)
      const stepDurMult = meleeComboStep === 3 ? 1.48 : meleeComboStep === 2 ? 1.14 : 1.0;
      baseCooldown = Math.max(baseCooldown * stepDurMult, meleeComboStep === 3 ? 0.88 : meleeComboStep === 2 ? 0.64 : 0.52);
    }
    player.attackCooldown = baseCooldown;
    triggerModelAttack(heroModel, wpn.type, player.attackCooldown, meleeComboStep);

    const dirX = Math.sin(aimAngle);
    const dirZ = Math.cos(aimAngle);
    const muzzleX = player.x + dirX * 0.80;
    const muzzleZ = player.z + dirZ * 0.80;

    // Physical recoil kickback for ranged & magic weapons (strongest on heavy shotguns!)
    if (wpn.recoilKick > 0) {
      const kickScale = isOverdrive ? 0.65 : 1.0;
      player.recoilVx -= dirX * wpn.recoilKick * kickScale;
      player.recoilVz -= dirZ * wpn.recoilKick * kickScale;
    }

    // 1. WARRIOR MELEE:
    //   Schedule impact (damage, slash arc VFX, hitmarkers, sparks) at the exact sword-sweep frame
    //   of the active combo clip (1: Slice Horizontal, 2: Slash, 3: Attack) instead of t=0.
    if (wpn.type === 'melee') {
      const nextComboStep = meleeComboStep;
      const comboDmgMult = nextComboStep === 3 ? 1.45 : nextComboStep === 2 ? 1.12 : 1.0;
      const comboArcMult = nextComboStep === 3 ? 1.32 : 1.0;
      const comboKbMult = nextComboStep === 3 ? 1.35 : 1.0;
      const isComboFinisher = nextComboStep === 3;

      const effCritChance = Math.max(0.14, stats.critChance || 0.14);
      const isCritSwing = Math.random() < effCritChance;
      const effRange = (isCritSwing ? stats.range * 1.12 : stats.range) * (isComboFinisher ? 1.08 : 1.0);
      const effArc = Math.min(Math.PI * 1.65, stats.arcAngle * comboArcMult);
      const baseMeleeDmg = Math.round((isOverdrive ? stats.damage * 1.25 : stats.damage) * berserkBoost * comboDmgMult);
      const impactDelay = computeMeleeImpactDelay(wpn.id, player.attackCooldown, nextComboStep);

      // Keep Warrior facing the target through windup, sword impact, and short follow-through
      player.attackFaceHoldTimer = Math.max(player.attackFaceHoldTimer || 0, impactDelay + 0.14);
      player.attackAnimTimer = Math.max(player.attackAnimTimer || 0, impactDelay + 0.10);

      // Combat forward step-in lunge synced with Warrior combo footwork:
      //   comboStep === 2 (Slash v4): explosive ~0.85m forward lunge landing right on the f27 impact (~0.31s @ 1.42x)
      //   comboStep === 3 (Attack): subtle ~0.25m micro-step into heavy overhead slam
      if (currentClassId === 'warrior' && (nextComboStep === 2 || nextComboStep === 3)) {
        meleeStepLunge = {
          elapsed: 0,
          duration: nextComboStep === 2 ? 0.31 : 0.30,
          totalDist: nextComboStep === 2 ? 0.85 : 0.25,
          comboStep: nextComboStep,
          dirX: Math.sin(aimAngle),
          dirZ: Math.cos(aimAngle)
        };
      } else {
        meleeStepLunge = null;
      }

      pendingMeleeStrikes.push({
        timer: impactDelay,
        impactDelay,
        elapsed: 0,
        whooshTimer: Math.max(0, impactDelay - 0.055),
        whooshPlayed: false,
        aimAngle,
        strikeAngle: aimAngle,
        wpnId: wpn.id,
        wpnColor: wpn.color,
        wpnMaxTargets: wpn.maxTargets,
        wpnStunChance: wpn.stunChance || 0,
        wpnStunDuration: wpn.stunDuration || 0.5,
        wpnDisarmChance: wpn.disarmChance || 0,
        wpnDisarmDuration: wpn.disarmDuration || 2.0,
        isCritSwing,
        isOverdrive,
        comboStep: nextComboStep,
        isComboFinisher,
        comboKbMult,
        effRange,
        effArc,
        baseMeleeDmg,
        critMult: stats.critMult || 1.85,
        knockback: stats.knockback
      });
      return;
    }

    // 2. GUNSLINGER HEAVY SHOTGUNS (Buckshot Cloud, Distance Falloff, Recoil & Auto-Reload!)
    if (wpn.type === 'ranged') {
      audio?.playGunshot?.(wpn.id);
      const flashColor = isOverdrive ? 0xf97316 : 0xff9f1c;
      const gunMuzzleX = player.x + dirX * 0.90;
      const gunMuzzleZ = player.z + dirZ * 0.90;
      world?.spawnMuzzleFlash?.({
        x: gunMuzzleX,
        y: 0.86,
        z: gunMuzzleZ,
        angle: aimAngle,
        color: flashColor,
        scale: wpn.id === 'blunderbuss' ? 1.56 : 1.28,
        smoke: true
      });
      if (wpn.isShotgun) {
        world?.addScreenShake?.(wpn.id === 'blunderbuss' ? 0.36 : 0.22, 0.16);
      }

      // Crisp gunpowder sparks + ejecting 3D spinning brass shell casing (ZERO plasma!)
      emitParticles(gunMuzzleX, 0.86, gunMuzzleZ, flashColor, wpn.id === 'blunderbuss' ? 10 : 5, 8.5, 0.065);
      const rightX = Math.cos(aimAngle);
      const rightZ = -Math.sin(aimAngle);
      world?.spawnShellCasing?.({
        x: player.x + rightX * 0.30 + dirX * 0.32,
        y: 0.86,
        z: player.z + rightZ * 0.30 + dirZ * 0.32,
        angle: aimAngle
      });

      player.gunShotCount = (player.gunShotCount || 0) + 1;
      const isLastShell = usesMag && !isOverdrive && ammoBeforeShot === 1 && (stats.ammoPouchStacks || 0) > 0;
      const expSlugStacks = stats.gunExplosiveStacks || 0;
      const isExplosiveShot = expSlugStacks > 0 && player.gunShotCount % (expSlugStacks >= 3 ? 2 : 3) === 0;

      const count = wpn.isShotgun ? stats.pellets + (isOverdrive ? 2 : 0) : stats.pellets;
      const moveSp = stats.moveSpread ?? stats.spread ?? 0;
      const focusSp = stats.focusSpread ?? moveSp;
      const focusT = stats.focusTime || 0;
      const focusRatio = focusT > 0 ? clamp((player.standStillTimer || 0) / focusT, 0, 1) : 1;
      const activeSpreadPct = moveSp + (focusSp - moveSp) * focusRatio;
      const totalSpread =
        (wpn.isShotgun ? activeSpreadPct * 0.95 : activeSpreadPct * 0.90) + (isOverdrive ? 0.06 : 0);
      const projSplash = isExplosiveShot
        ? 2.25
        : isOverdrive
          ? Math.max(0.95, stats.splashRadius)
          : stats.splashRadius;
      const shotCrit = isLastShell || Math.random() < (stats.critChance || 0.04);
      const pelletDmg = Math.round(
        stats.damage *
          (isLastShell ? 2.0 / (stats.critMult || 1.8) : 1.0) *
          (isExplosiveShot ? 1 + expSlugStacks * 0.25 : 1.0)
      );
      if (isLastShell) {
        floatText('🎯 КОЗЫРЬ ×2!', player.x, player.z, '#fde047');
      }

      for (let i = 0; i < count; i++) {
        const frac = count > 1 ? i / (count - 1) - 0.5 : 0;
        const jitter = (Math.random() - 0.5) * (count > 1 ? totalSpread * 0.30 : totalSpread);
        const shotAngle = aimAngle + frac * totalSpread + jitter;
        const pelletSpeed = wpn.isShotgun
          ? stats.projectileSpeed * (0.90 + Math.random() * 0.20)
          : stats.projectileSpeed;
        const pelletMaxDist = wpn.isShotgun
          ? stats.range * (0.92 + Math.random() * 0.14)
          : stats.range;

        spawnProjectile({
          x: muzzleX,
          z: muzzleZ,
          vx: Math.sin(shotAngle) * pelletSpeed,
          vz: Math.cos(shotAngle) * pelletSpeed,
          damage: pelletDmg,
          maxDist: pelletMaxDist,
          pierce: stats.pierce + (isOverdrive ? 1 : 0),
          pierceDecay: stats.pierceDecay || null,
          splashRadius: projSplash,
          knockback: stats.knockback,
          kind: 'ranged',
          visualType: wpn.isShotgun ? 'buckshot' : wpn.id,
          isShotgunPellet: Boolean(wpn.isShotgun),
          isCrit: shotCrit,
          color: isExplosiveShot || isOverdrive ? 0xf97316 : shotCrit ? 0xfef08a : wpn.color,
          isEnemy: false
        });
      }

      if (!isOverdrive && usesMag && player.ammo <= 0) {
        triggerReload();
      }
      return;
    }

    // 3. MAGE ELEMENTAL STAVES (Fire = Burn DoT, Water = Charged Swirling Sphere + 7% Water Prison, Lightning = Chain, Air = Wind Gust!)
    const mageElem = stats.mageElement || 'fire';
    player.mageCastCount = (player.mageCastCount || 0) + 1;
    audio?.playMagicCast?.(mageElem);
    const castColor = isOverdrive ? 0xf43f5e : (stats.mageElementColor || wpn.color);
    const staffTipX = player.x + dirX * 1.04;
    const staffTipZ = player.z + dirZ * 1.04;
    world?.spawnMuzzleFlash?.({ x: staffTipX, y: 0.92, z: staffTipZ, angle: aimAngle, color: castColor, scale: mageElem === 'water' ? 1.42 : 1.24 });
    world?.addScreenShake?.(wpn.id === 'void_orb' ? 0.16 : 0.08, 0.10);
    emitParticles(staffTipX, 0.92, staffTipZ, castColor, mageElem === 'water' ? 12 : 8, 6.2, 0.14);
    if (mageElem === 'water') {
      emitParticles(staffTipX, 0.92, staffTipZ, 0xe0faff, 6, 4.8, 0.10);
    }

    // 💧 Астральный Колодец (mage_mana_font): every 6th cast restores +16 Mana & pulses arcane wave!
    if ((stats.mageManaFontStacks || 0) > 0 && player.mageCastCount % 6 === 0) {
      player.mana = Math.min(player.maxMana, player.mana + 16);
      emitParticles(player.x, 0.85, player.z, 0x38bdf8, 14, 5.8, 0.15);
      damageEnemiesInRadius(player.x, player.z, 3.6, Math.round(stats.damage * 0.85), 8.5, null, false, mageElem);
      floatText('💧 +16 МАНЫ!', player.x, player.z, '#38bdf8');
    }

    // ✨ Раздвоение Кометы (mage_twin_cast): 40% / 75% / 100% chance for a free twin projectile!
    const twinStacks = stats.mageTwinStacks || 0;
    const bonusTwin = twinStacks > 0 && Math.random() < Math.min(1.0, 0.05 + twinStacks * 0.35) ? 1 : 0;
    const orbCount = stats.pellets + (isOverdrive ? 1 : 0) + bonusTwin;
    const orbSpread = stats.spread + (orbCount > 1 ? 0.16 : 0);
    const spellCrit = Math.random() < (stats.critChance || 0.05);

    for (let i = 0; i < orbCount; i++) {
      const frac = orbCount > 1 ? i / (orbCount - 1) - 0.5 : 0;
      const shotAngle = aimAngle + frac * orbSpread + (Math.random() - 0.5) * 0.025;
      spawnProjectile({
        x: staffTipX,
        z: staffTipZ,
        vx: Math.sin(shotAngle) * stats.projectileSpeed,
        vz: Math.cos(shotAngle) * stats.projectileSpeed,
        damage: stats.damage,
        maxDist: stats.range,
        pierce: stats.pierce + (mageElem === 'air' ? 1 : 0),
        splashRadius: 0, // NO ugly flat ground splash circles on basic magic shots!
        knockback: stats.knockback,
        kind: 'magic',
        mageElement: mageElem,
        visualType: `magic_${mageElem}`,
        isCrit: spellCrit,
        color: castColor,
        isEnemy: false
      });
    }

    if (!isOverdrive && usesMag && player.ammo <= 0) {
      triggerReload();
    }
  }

  // === 25-Chapter Finale Spawning: Act Bosses (5,10,15,20,25), Mini-Bosses (Acts II-V), Elite Packs (1-4) ===
  function startWaveFinale() {
    finaleStarted = true;

    // 1. Milestone Act Boss Chapters (Levels 5, 10, 15, 20, 25 — including paired/squad Bosses!)
    if (currentLevelDef.hasBoss && (currentLevelDef.finaleBosses?.length > 0 || currentLevelDef.bossId)) {
      const bossIds =
        currentLevelDef.finaleBosses?.length > 0
          ? currentLevelDef.finaleBosses
          : [currentLevelDef.bossId, ...(currentLevelDef.coBossId ? [currentLevelDef.coBossId] : [])];

      world?.setBossAtmosphere?.(true);
      audio?.playBossSpawn?.();
      world?.addScreenShake?.(0.82, 0.5);

      const baseAngle = Math.random() * TWO_PI;
      const spawnedNames = [];
      for (let bi = 0; bi < bossIds.length; bi++) {
        const bId = bossIds[bi];
        const bDef = ENEMY_TYPES[bId] || ENEMY_TYPES.boss_warden;
        const ang = baseAngle + (bi / Math.max(1, bossIds.length)) * TWO_PI;
        const bx = clamp(player.x + Math.sin(ang) * 16, -ARENA_HALF_SIZE + 5, ARENA_HALF_SIZE - 5);
        const bz = clamp(player.z + Math.cos(ang) * 16, -ARENA_HALF_SIZE + 5, ARENA_HALF_SIZE - 5);
        const spawnedBoss = spawnEnemy(bId, bx, bz, null, { isFinaleTarget: true });
        if (bi === 0) bossEntity = spawnedBoss;
        emitShockwave(spawnedBoss.x, spawnedBoss.z, 8.5, bDef.color || 0xdc2626, 0.58);
        emitParticles(spawnedBoss.x, 1.2, spawnedBoss.z, bDef.color || 0xdc2626, 34, 8.0, 0.22);
        spawnedNames.push(bDef.nameRu);
      }
      const uniqueSummary = spawnedNames.length > 1
        ? `💀 БОССЫ (${spawnedNames.length}): ${spawnedNames[0].toUpperCase()}...`
        : `💀 ${(spawnedNames[0] || 'БОСС').toUpperCase()}!`;
      floatText(uniqueSummary, player.x, player.z - 1.2, '#ef4444');
      return;
    }

    // 2. Non-Boss Chapters (Stage 1: Slime, Stage 2: Treant, Stage 3: Mimic, etc.): Finale Mini-Boss!
    if (currentLevelDef.finaleMiniBossType || (currentLevelDef.miniBossPool && currentLevelDef.miniBossPool.length > 0)) {
      spawnMiniBossFromPool(true);
      return;
    }

    // 3. Levels 1–4 (Act I Non-Boss Chapters): NO Bosses! Spawn 2 tough Elite Finale Champions!
    audio?.playBossSpawn?.();
    world?.addScreenShake?.(0.45, 0.30);

    const pool = currentLevelDef.enemyPool || ['ember_skeleton', 'goblin'];
    const champTypes = [
      pool[pool.length - 1] || 'goblin',
      pool[Math.max(0, pool.length - 2)] || 'ember_skeleton'
    ];
    const hpScale = currentLevelDef.hpScale || 1;
    const dmgScale = currentLevelDef.dmgScale || 1;

    let leadChamp = null;
    for (let c = 0; c < 2; c++) {
      const cType = champTypes[c];
      const cDef = ENEMY_TYPES[cType] || ENEMY_TYPES.cursed_footman;
      const angle = (c === 0 ? 0.35 : Math.PI + 0.35) + Math.random() * 0.5;
      const cx = clamp(player.x + Math.sin(angle) * 14.5, -ARENA_HALF_SIZE + 4, ARENA_HALF_SIZE - 4);
      const cz = clamp(player.z + Math.cos(angle) * 14.5, -ARENA_HALF_SIZE + 4, ARENA_HALF_SIZE - 4);

      const champ = spawnEnemy(cType, cx, cz, c === 0 ? 'purple' : 'blue', {
        isWarden: true,
        isFinaleTarget: true,
        nameRu: `Чемпион: ${cDef.nameRu}`,
        hp: Math.round((130 + cDef.hp * 2.1) * hpScale),
        damage: Math.round(cDef.damage * dmgScale * 1.2),
        scale: (cDef.scale || 0.95) * 1.32,
        xp: 42,
        gold: 28
      });
      emitShockwave(champ.x, champ.z, 4.8, c === 0 ? 0xa855f7 : 0x38bdf8, 0.42);
      if (!leadChamp) leadChamp = champ;
    }

    bossEntity = leadChamp;
    floatText('⚔️ ЭЛИТНЫЙ ДОЗОР ПОГОСТА!', player.x, player.z - 1.2, '#fbbf24');
  }

  // === Corridor Souls Mob Physical Step Helper (Lunge, Follow-Through Slide, Strafe & Archer Backstep) ===
  function advanceSoulsMobStep(e, dirX, dirZ, stepDist, allowCloserThanMin = false) {
    if (!e || stepDist <= 1e-5) return false;
    const len = Math.hypot(dirX, dirZ);
    if (len < 1e-4) return false;
    const ux = dirX / len;
    const uz = dirZ / len;
    const prevX = e.x;
    const prevZ = e.z;
    let nx = prevX + ux * stepDist;
    let nz = prevZ + uz * stepDist;

    if (!allowCloserThanMin) {
      const minStop = (player.radius || 0.58) + (e.radius || 0.55) * 0.92;
      const prevDx = prevX - player.x;
      const prevDz = prevZ - player.z;
      const prevDist = Math.hypot(prevDx, prevDz);
      const stopDist = Math.min(prevDist, minStop);
      const candDx = nx - player.x;
      const candDz = nz - player.z;
      const candDist = Math.hypot(candDx, candDz);
      if (candDist < stopDist) {
        if (candDist > 1e-4 && candDx * prevDx + candDz * prevDz > 0) {
          nx = player.x + (candDx / candDist) * stopDist;
          nz = player.z + (candDz / candDist) * stopDist;
        } else if (prevDist > 1e-4) {
          nx = player.x + (prevDx / prevDist) * stopDist;
          nz = player.z + (prevDz / prevDist) * stopDist;
        } else {
          nx = prevX;
          nz = prevZ;
        }
      }
    }

    const clamped = resolveObstaclesAndBounds(nx, nz, e.radius, ARENA_ENTITY_LIMIT);
    e.x = clamped.x;
    e.z = clamped.z;
    return Math.hypot(e.x - prevX, e.z - prevZ) > 0.0005;
  }

  // === Expressive Regular Souls Mob Post-Riposte Stand-Up (2.30s) & Stagger Recover (0.85s) ===
  function triggerSoulsMobRiposteStandUp(mob, standUpSec = 2.30) {
    if (!mob || mob.isSoulsBoss || mob.hp <= 0) return false;
    mob.soulsAwake = true;
    mob.isAmbushGuard = false;
    mob._soulsRiposteHasClip = false;
    if (typeof SOULS_MOB_AI.startSoulsMobRiposteStandUp === 'function') {
      SOULS_MOB_AI.startSoulsMobRiposteStandUp(mob, standUpSec);
    } else {
      releaseSoulsAttackToken(mob);
      mob._mobActiveSwing = null;
      mob.soulsRiposteInvuln = false;
      mob.soulsRiposteUsed = false;
      mob.soulsRiposteTimer = 0;
      mob.stagger = 0;
      mob._soulsParryCount = 0;
      mob.staggeredTimer = 0;
      mob.parriedRiposteTimer = 0;
      mob.stunTimer = 0;
      mob.staggerImmunityTimer = Math.max(mob.staggerImmunityTimer || 0, standUpSec + 2.5);
      mob.soulsState = 'riposte_recover';
      mob.aiState = 'riposte_recover';
      mob.vx = 0;
      mob.vz = 0;
      const standRes = mob.model?.handle?.playClampedClip?.('Riposte_Stand_Up', 1.0, 0.14);
      mob.soulsRecoverTimer = standRes?.ok && standRes.duration > 0.6 ? standRes.duration : standUpSec;
      mob.soulsTimer = mob.soulsRecoverTimer;
    }
    poiseCtrl.resetEntityPoise(mob, { grantImmunity: true });
    return true;
  }

  function triggerSoulsMobStaggerRecover(mob, recoverSec = 0.85) {
    if (!mob || mob.isSoulsBoss || mob.hp <= 0) return false;
    mob.soulsAwake = true;
    mob.isAmbushGuard = false;
    if (typeof SOULS_MOB_AI.startSoulsMobStaggerRecover === 'function') {
      SOULS_MOB_AI.startSoulsMobStaggerRecover(mob, recoverSec);
    } else {
      releaseSoulsAttackToken(mob);
      mob._mobActiveSwing = null;
      mob.stagger = 0;
      mob._soulsParryCount = 0;
      mob.parriedRiposteTimer = 0;
      mob.stunTimer = 0;
      mob.soulsRiposteUsed = false;
      mob.soulsRiposteInvuln = false;
      mob.staggerImmunityTimer = Math.max(mob.staggerImmunityTimer || 0, 4.0);
      mob.soulsState = 'stagger_recover';
      mob.aiState = 'stagger_recover';
      mob.soulsRecoverTimer = recoverSec;
      mob.soulsTimer = recoverSec;
      mob.vx = 0;
      mob.vz = 0;
      mob.model?.handle?.clearClampedClip?.(true, 0.78);
    }
    poiseCtrl.resetEntityPoise(mob, { grantImmunity: true });
    return true;
  }

  // === Shared live context for extracted Boss AI state machines (./combat/bossAi.js) ===
  const bossAiCtx = {
    get player() { return player; },
    get enemies() { return enemies; },
    get bossHazards() { return bossHazards; },
    get activeBurningZones() { return activeBurningZones; },
    get souls() { return souls; },
    get playerHealing() { return Boolean(isSoulslike && souls.flaskDrinkTimer > 0); },
    get obstacles() { return world?.obstacles || null; },
    world,
    audio,
    emitParticles,
    emitSlashArc,
    emitShockwave,
    emitTelegraphZone,
    triggerModelAttack,
    triggerHitStop,
    floatText,
    applyDamageToPlayer,
    spawnProjectile,
    spawnEnemy,
    resolveObstaclesAndBounds,
    onPhase2ArenaFireWave: (bx, bz) => {
      world?.triggerPhase2ArenaFireWave?.(bx, bz);
    },
    onBossHammerWrench: (boss, pullIdx) => {
      const wx = boss?._leapCraterX ?? boss?.hx ?? boss?.x ?? 0;
      const wz = boss?._leapCraterZ ?? boss?.hz ?? boss?.z ?? 0;
      world?.spawnBossHammerWrenchDust?.(wx, wz, pullIdx);
    },
    resetEntityPoise: (ent, opts) => poiseCtrl.resetEntityPoise(ent, opts),
    poiseCtrl
  };

  // === Main Frame Update ===
  function update(rawDt, input = {}, elapsedTime = 0) {
    if (!runActive || runEnded || awaitingLevelUpChoice) return;
    const frameDt = clamp(Number(rawDt) || 0, 0, 0.05);
    if (frameDt <= 0) return;
    // Same global clock that updateSoulsBossAI receives (boss._aiClock) -> soulsLastHitAt stays on one time scale.
    lastFrameElapsedTime = Number(elapsedTime) || 0;

    // Handle post-boss victory celebration beat
    if (pendingVictoryPayload && isSoulslike) {
      // Abandoned Knight Rift: let the boss collapse and player roam freely during the ~1.2s beat,
      // then trigger the atmospheric victory banner WITHOUT freezing or ending the live session!
      victoryDelayTimer -= frameDt;
      if (victoryDelayTimer <= 0) {
        const payload = pendingVictoryPayload;
        pendingVictoryPayload = null;
        souls.bossDefeated = true;
        world?.setBossAtmosphere?.(false);
        world?.resetBossDoors?.(true);
        world?.setSoulsFogGate?.(false);
        audio?.setSoulsAmbientActive?.(true, { nearBonfire: false });
        audio?.setMusicMode?.('combat');
        clearTargetLock();
        callbacks?.onRunEnd?.({ ...payload, keepPlayingInWorld: true, isSoulslike: true });
      }
    } else if (pendingVictoryPayload) {
      pendingMeleeStrikes = [];
      meleeStepLunge = null;
      if (lockedEnemy) {
        lockedEnemy = null;
        world?.setLockOnTarget?.(null);
      }
      hitStopTimer = 0;
      victoryDelayTimer -= frameDt;
      updatePickups(frameDt, elapsedTime);
      if (victoryDelayTimer <= 0) {
        const payload = pendingVictoryPayload;
        pendingVictoryPayload = null;
        runEnded = true;
        runActive = false;
        callbacks?.onRunEnd?.(payload);
      }
      return;
    }

    // Handle cinematic hero death sequence: play full Death_A (clamped on last frame) + 1.0s pause before defeat modal
    if (playerDying) {
      pendingMeleeStrikes.length = 0;
      meleeStepLunge = null;
      hitStopTimer = 0;
      deathModalDelay = Math.max(0, deathModalDelay - frameDt);

      if (heroModel?.obj) {
        const heroGroundY = sampleSmoothGroundY(player, player.x, player.z, frameDt, false);
        heroModel.obj.position.x = player.x;
        heroModel.obj.position.y = heroGroundY;
        heroModel.obj.position.z = player.z;
        heroModel.obj.rotation.y = player.facing;
        heroModel.obj.rotation.x = 0;
        heroModel.obj.rotation.z = 0;
        animateEntityModel(heroModel, frameDt, false, 0, false, false, elapsedTime, 0, 1, false);
      }
      syncFollowTarget(player.x, player.z, heroModel?.obj, frameDt);

      for (let ci = dyingCorpses.length - 1; ci >= 0; ci--) {
        const dc = dyingCorpses[ci];
        dc.age += frameDt;
        if (dc.age >= dc.duration) {
          if (dc.isSoulsBoss && dc.model?.obj) {
            disposeSoulsBossVisuals(dc.model.obj);
          }
          removeSceneObject(dc.model.obj, dc.model.handle);
          dyingCorpses.splice(ci, 1);
          continue;
        }
        if (dc.isSoulslikeCorpse) {
          if (dc.age < 1.75) {
            dc.model.handle?.updateDying?.(frameDt, 0, 0);
          } else {
            const dissolve01 = clamp((dc.age - 1.75) / 1.45, 0, 1);
            dc.model.handle?.updateDying?.(frameDt, 0, dissolve01);
            dc.ashAccum = (dc.ashAccum || 0) + frameDt;
            if (dc.ashAccum >= 0.055) {
              dc.ashAccum = 0;
              dissolveAsh?.emitCorpseAsh?.(dc.x, 0.25, dc.z, (dc.radius || 0.75) * 1.15, 1.5);
            }
          }
        } else {
          const sink = dc.age > dc.duration * 0.72 ? (dc.age - dc.duration * 0.72) / (dc.duration * 0.28) : 0;
          dc.model.handle?.updateDying?.(frameDt, sink);
        }
      }
      if (isSoulslike && dissolveAsh) {
        dissolveAsh.update(frameDt);
      }
      for (let ei = 0; ei < enemies.length; ei++) {
        const e = enemies[ei];
        if (!e || e.hp <= 0 || !e.model?.obj) continue;
        const onThroneIntro =
          e.isSoulsBoss &&
          (e.soulsThronePhase === 'sitting' || e.soulsThronePhase === 'pause' || e.soulsThronePhase === 'standing');
        if (!onThroneIntro) {
          e.model.handle?.setClipOverride?.(null);
        }
        animateEntityModel(e.model, frameDt, false, 0, false, false, elapsedTime);
        if (e.isSoulsBoss) {
          updateSoulsBossVisuals(e.model.obj, frameDt, {
            phase2Enraged: Boolean(e.phase2Enraged),
            isAttacking: false,
            isWindup: false,
            isStaggered: false,
            elapsed: elapsedTime
          });
        }
      }
      if (companion?.model?.obj) {
        animateEntityModel(companion.model, frameDt, false, 0, false, false, elapsedTime);
      }
      for (let pi = projectiles.length - 1; pi >= 0; pi--) {
        const proj = projectiles[pi];
        const stepX = proj.vx * frameDt;
        const stepZ = proj.vz * frameDt;
        proj.x += stepX;
        proj.z += stepZ;
        proj.traveled += Math.hypot(stepX, stepZ);
        proj.vis.obj.position.set(proj.x, 0.72, proj.z);
        if (
          proj.traveled >= proj.maxDist ||
          Math.abs(proj.x) > ARENA_HALF_SIZE ||
          Math.abs(proj.z) > ARENA_HALF_SIZE
        ) {
          removeSceneObject(proj.vis.obj, proj.vis.handle);
          projectiles.splice(pi, 1);
        }
      }

      if (deathModalDelay <= 0) {
        const basePayload = pendingDefeatPayload || {
          victory: false,
          level: currentLevelNumber,
          isEndless,
          endlessWave,
          goldEarned: goldRun,
          kills,
          elapsedSec: Math.round(elapsedRunTime),
          elapsedTime: Math.round(elapsedRunTime),
          difficulty: currentDifficulty,
          unlockedWeapon: unlockedWeaponThisRun,
          soulsBossReached: Boolean(isSoulslike && souls.bossAwakened)
        };
        if (isEndless && basePayload.elapsedSec >= 10) {
          const timeBonus = Math.round(Math.floor(basePayload.elapsedSec / 10) * 3 * (stats?.goldMult || 1));
          if (timeBonus > 0) {
            progression.addGold(timeBonus);
            goldRun += timeBonus;
          }
        }
        basePayload.goldEarned = goldRun;
        pendingDefeatPayload = null;
        runEnded = true;
        runActive = false;
        const endCb = callbacks?.onRunEnd || callbacks?.onBattleEnd;
        endCb?.(basePayload);
      }
      return;
    }

    let dt = frameDt;
    if (isSoulslike) {
      dt = soulsGameFeel.consumeSimulationDt(frameDt);
      if (weaponTrails) {
        weaponTrails.update(dt);
      }
      if (dissolveAsh) {
        dissolveAsh.update(dt);
      }
      const liveCutState = world?.getBossDoorCutsceneState?.() || null;
      if (souls.doorCutsceneActive || liveCutState) {
        soulsGameFeel.syncCutsceneShake(liveCutState, frameDt);
      } else {
        const doorShudder = Number(world?.getDoorShudderIntensity?.() || 0);
        soulsGameFeel.setDoorRumble(doorShudder);
        soulsGameFeel.stepCameraShake(frameDt);
      }
    } else {
      if (hitStopCooldown > 0) hitStopCooldown = Math.max(0, hitStopCooldown - frameDt);
      if (hitStopTimer > 0) {
        hitStopTimer = Math.max(0, hitStopTimer - frameDt);
        dt = frameDt * 0.12;
      }
    }

    elapsedRunTime += dt;

    // Timers
    if (player.invulnTimer > 0) player.invulnTimer = Math.max(0, player.invulnTimer - dt);
    if (player.dashCooldown > 0) player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    if (player.dashInvulnTimer > 0) player.dashInvulnTimer = Math.max(0, player.dashInvulnTimer - dt);
    if (isSoulslike) {
      poiseCtrl.tickPlayerPoise(player, dt);
    } else if ((player.microStunTimer || 0) > 0) {
      player.microStunTimer = 0;
      player.microStunMoveMult = 1.0;
    }
    let activeLocked = validateLockedEnemy(true);
    let angToLocked = activeLocked ? Math.atan2(activeLocked.x - player.x, activeLocked.z - player.z) : null;
    if (player.comboTimer > 0) {
      player.comboTimer = Math.max(0, player.comboTimer - dt);
      if (player.comboTimer <= 0) player.comboStep = 0;
    }
    if (player.attackCooldown > 0) player.attackCooldown = Math.max(0, player.attackCooldown - dt);
    if (player.attackAnimTimer > 0) player.attackAnimTimer = Math.max(0, player.attackAnimTimer - dt);
    if (player.relicBumpTimer > 0) player.relicBumpTimer = Math.max(0, player.relicBumpTimer - dt);
    if (critFloaterCooldown > 0) critFloaterCooldown = Math.max(0, critFloaterCooldown - dt);
    if (shieldSparkCooldown > 0) shieldSparkCooldown = Math.max(0, shieldSparkCooldown - dt);
    if (hitSoundCooldown > 0) hitSoundCooldown = Math.max(0, hitSoundCooldown - dt);
    if (manaEmptyHintCooldown > 0) manaEmptyHintCooldown = Math.max(0, manaEmptyHintCooldown - dt);

    // Continuous Mana Regeneration for Mage (regenerates at all times, faster after brief cast pause!)
    if (stats?.usesMana && player.maxMana > 0 && player.mana < player.maxMana) {
      const calmBoost = player.attackAnimTimer <= 0 && player.attackCooldown <= 0 ? 1.28 : 1.0;
      const beastBoost = player.beastTimeLeft > 0 ? 2.5 : 1.0;
      player.mana = Math.min(player.maxMana, player.mana + (stats.manaRegen || 9.5) * calmBoost * beastBoost * dt);
    }

    // Beast Mode countdown & exit + Manual Ultimate activation [F]
    const wasBeast = player.beastTimeLeft > 0;
    if (wasBeast) {
      player.beastTimeLeft = Math.max(0, player.beastTimeLeft - dt);
      if (player.beastTimeLeft === 0) {
        heroModel?.handle?.setBeastMode?.(false, currentClassId);
        heroModel?.obj?.userData?.setBeastMode?.(false, currentClassId);
        player.invulnTimer = Math.max(player.invulnTimer, 0.9);
        emitShockwave(player.x, player.z, 5.2, 0xfbbf24, 0.35);
      }
    }
    if (!isSoulslike && input?.ult && player.beastReady && player.beastTimeLeft <= 0) {
      activateBeastMode();
    }
    const beastActive = !isSoulslike && player.beastTimeLeft > 0;

    // Manual reload request via input.reload (PvE only — in Dark Souls [R] is Estus Flask)
    if (!isSoulslike && (input?.reload || input?.reloadPressed)) {
      triggerReload();
    }

    // Reload timer progression (with 0.5s/shell partial top-up for Shotgun!)
    if (player.isReloading) {
      if (player.overdriveAmmo > 0 || beastActive) {
        player.isReloading = false;
        player.reloadTimer = 0;
        player.reloadShellAccum = 0;
        player.ammo = player.maxAmmo;
        syncHeroReloadModel(false);
      } else {
        const perShell = stats?.reloadPerShellTime || 0;
        player.reloadTimer = Math.max(0, player.reloadTimer - dt);
        if (perShell > 0) {
          player.reloadShellAccum = (player.reloadShellAccum || 0) + dt;
          while (player.reloadShellAccum >= perShell && player.ammo < player.maxAmmo) {
            player.reloadShellAccum -= perShell;
            player.ammo = Math.min(player.maxAmmo, player.ammo + 1);
            audio?.playReloadShell?.();
          }
        } else {
          const prog =
            player.reloadDuration > 0 ? 1 - player.reloadTimer / player.reloadDuration : 1;
          const curWpn = WEAPONS[currentWeaponId];
          if (!player.reloadMidShellPlayed && prog >= 0.52 && curWpn?.isShotgun) {
            player.reloadMidShellPlayed = true;
            audio?.playReloadShell?.();
          }
        }
        if (player.reloadTimer <= 0 || player.ammo >= player.maxAmmo) {
          player.isReloading = false;
          player.reloadTimer = 0;
          player.reloadShellAccum = 0;
          player.ammo = player.maxAmmo;
          audio?.playReloadReady?.();
          syncHeroReloadModel(false);
        }
      }
    }

    // Class-specific periodic & aura blessings (strictly PvE only — disabled in Abandoned Knight Rift!)
    if (player.sprintTimer > 0) player.sprintTimer = Math.max(0, player.sprintTimer - dt);

    if (!isSoulslike) {
      // 🛡️ Сфера Отражения (mage_arcane_ward) recharge
      if ((stats.mageWardStacks || 0) > 0 && !player.arcaneWardReady) {
        player.arcaneWardTimer -= dt;
        if (player.arcaneWardTimer <= 0) {
          player.arcaneWardReady = true;
          emitParticles(player.x, 0.9, player.z, 0xc084fc, 8, 3.2, 0.12);
        }
      }

      // ☄️ Звездопад Архонта (mage_meteor_shower)
      const meteorStacks = stats.mageMeteorStacks || 0;
      if (attackEnabled && meteorStacks > 0 && !beastActive && enemies.length > 0) {
        player.meteorTimer -= dt;
        if (player.meteorTimer <= 0) {
          player.meteorTimer = Math.max(2.3, 4.4 - meteorStacks * 0.65);
          const mTarget = enemies[Math.floor(Math.random() * enemies.length)];
          if (mTarget && mTarget.hp > 0) {
            const mColor = stats.mageElementColor || 0xff5722;
            world?.spawnMeteorStrike?.({ x: mTarget.x, z: mTarget.z, radius: 3.8, color: mColor, duration: 0.34 });
            pendingMeteors.push({
              x: mTarget.x,
              z: mTarget.z,
              radius: 3.8,
              timer: 0.34,
              damage: Math.round(stats.damage * (1.6 + meteorStacks * 0.55)),
              element: stats.mageElement
            });
          }
        }
      }
      for (let mi = pendingMeteors.length - 1; mi >= 0; mi--) {
        const mt = pendingMeteors[mi];
        mt.timer -= dt;
        if (mt.timer <= 0) {
          audio?.playExplosion?.();
          world?.addScreenShake?.(0.32, 0.16);
          damageEnemiesInRadius(mt.x, mt.z, mt.radius, mt.damage, 12.0, null, true, mt.element);
          pendingMeteors.splice(mi, 1);
        }
      }

      // 💣 Шрапнельный Капкан (gun_shrapnel_mine)
      const mineStacks = stats.gunMineStacks || 0;
      if (attackEnabled && mineStacks > 0 && !beastActive && shrapnelMines.length < 6) {
        player.mineTimer -= dt;
        if (player.mineTimer <= 0) {
          player.mineTimer = Math.max(2.6, 5.2 - mineStacks * 0.75);
          let mineMesh = null;
          if (world?.scene) {
            mineMesh = new THREE.Mesh(sharedMiniCrateGeo, getProjMaterial(0xef4444));
            mineMesh.scale.set(0.65, 0.32, 0.65);
            mineMesh.position.set(player.x, 0.14, player.z);
            world.scene.add(mineMesh);
          }
          shrapnelMines.push({
            x: player.x,
            z: player.z,
            age: 0,
            armTime: 0.35,
            damage: Math.round(stats.damage * (1.7 + mineStacks * 0.6) * Math.max(1, (stats.pellets || 1) * 0.35)),
            mesh: mineMesh
          });
        }
      }
      for (let smi = shrapnelMines.length - 1; smi >= 0; smi--) {
        const sm = shrapnelMines[smi];
        sm.age += dt;
        if (sm.mesh) sm.mesh.rotation.y += dt * 2.5;
        let triggered = sm.age > 14.0;
        if (!triggered && sm.age >= sm.armTime) {
          for (let ei = 0; ei < enemies.length; ei++) {
            const e = enemies[ei];
            if (e && e.hp > 0 && Math.hypot(e.x - sm.x, e.z - sm.z) <= 1.45 + e.radius) {
              triggered = true;
              break;
            }
          }
        }
        if (triggered) {
          if (sm.age <= 14.0) {
            audio?.playExplosion?.();
            emitShockwave(sm.x, sm.z, 3.6, 0xf97316, 0.34);
            emitParticles(sm.x, 0.5, sm.z, 0xfbbf24, 18, 7.2, 0.16);
            damageEnemiesInRadius(sm.x, sm.z, 3.6, sm.damage, 13.0, null, true);
          }
          if (sm.mesh?.parent) sm.mesh.parent.remove(sm.mesh);
          shrapnelMines.splice(smi, 1);
        }
      }

      // 🌪️ Вихрь Жнеца (war_whirlwind): automatic 360° spin slash!
      const wwStacks = stats.warWhirlwindStacks || 0;
      if (attackEnabled && wwStacks > 0 && !beastActive) {
        player.whirlwindTimer -= dt;
        if (player.whirlwindTimer <= 0) {
          player.whirlwindTimer = Math.max(2.6, 4.8 - wwStacks * 0.65);
          audio?.playMeleeSwing?.(true);
          emitSlashArc(player.x, player.z, player.facing, stats.range * 1.12, Math.PI * 1.98, 0xef4444);
          damageEnemiesInRadius(player.x, player.z, stats.range * 1.12, Math.round(stats.damage * (0.95 + wwStacks * 0.35)), stats.knockback * 1.1, null, true);
        }
      }

      // 🗡️ Клинки Предков (war_orbit_blades): real 3D spinning spectral swords around Warrior!
      const orbitStacks = stats.warOrbitStacks || 0;
      if (orbitStacks > 0 && world?.scene) {
        const desiredBlades = 1 + orbitStacks;
        if (!orbitBladesGroup) {
          orbitBladesGroup = new THREE.Group();
          world.scene.add(orbitBladesGroup);
          orbitBladeMeshes = [];
        }
        while (orbitBladeMeshes.length < desiredBlades) {
          const bGrp = new THREE.Group();
          const bladeMesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.04, 0.92),
            getProjMaterial(0xfde047)
          );
          bladeMesh.position.z = 0.25;
          bGrp.add(bladeMesh);
          orbitBladesGroup.add(bGrp);
          orbitBladeMeshes.push(bGrp);
        }
        orbitBladesGroup.position.set(player.x, 0.82, player.z);
        const baseSpin = elapsedTime * (3.6 + orbitStacks * 0.55);
        const orbitRad = 2.45;
        for (let bi = 0; bi < orbitBladeMeshes.length; bi++) {
          const ang = baseSpin + (bi / orbitBladeMeshes.length) * TWO_PI;
          const bx = Math.cos(ang) * orbitRad;
          const bz = Math.sin(ang) * orbitRad;
          orbitBladeMeshes[bi].position.set(bx, 0, bz);
          orbitBladeMeshes[bi].rotation.y = -ang;
          const wx = player.x + bx;
          const wz = player.z + bz;
          for (let ei = enemies.length - 1; ei >= 0; ei--) {
            if (!attackEnabled) break;
            const e = enemies[ei];
            if (!e || e.hp <= 0) continue;
            if (Math.hypot(e.x - wx, e.z - wz) <= 0.75 + e.radius) {
              const lastHit = player.orbitHitTimers.get(e.uid) || 0;
              if (elapsedTime - lastHit >= 0.36) {
                player.orbitHitTimers.set(e.uid, elapsedTime);
                applyDamageToEnemy(e, Math.max(4, Math.round(stats.damage * 0.55)), bx * 2.2, bz * 2.2, false, { isSplash: true });
              }
            }
          }
        }
      }
    }

    // 1. Player Movement, Active Roll/Dash, Smart Input Buffer, Stamina & Obstacle Sliding
    const prevPlayerFacingForStance = player.facing || 0;
    let mx = Number(input?.moveX) || 0;
    let mz = Number(input?.moveZ) || 0;
    let moveMag = Math.hypot(mx, mz);
    if (moveMag > 1) {
      mx /= moveMag;
      mz /= moveMag;
    }
    let speedRatio = Math.min(1, moveMag);

    let soulsDoorCutsceneActive = false;
    let soulsEscapeCutsceneActive = false;
    if (isSoulslike) {
      if (souls.escapeCutsceneActive) {
        const escState = world?.getBossEscapeCutsceneState?.() || null;
        if (!escState || escState.finished) {
          finishBossEscapeCutsceneToShore(false);
          soulsEscapeCutsceneActive = false;
        } else {
          soulsEscapeCutsceneActive = true;
          applyBossEscapeCutsceneState(escState, frameDt, elapsedTime, false);
        }
      } else if (souls.doorCutsceneActive) {
        souls.doorCutsceneTimer = Math.max(0, (souls.doorCutsceneTimer || 0) - frameDt);
        const cutState = world?.getBossDoorCutsceneState?.() || null;
        if (!cutState || cutState.finished || souls.doorCutsceneTimer <= 0) {
          finishBossDoorCutsceneIntoCombat(false);
          soulsDoorCutsceneActive = false;
        } else {
          soulsDoorCutsceneActive = true;
          souls.cutsceneSubtitleSpeaker = cutState.subtitleSpeaker || '';
          souls.cutsceneSubtitleText = cutState.subtitleText || '';
          souls.cutsceneShowBossTitleCard = Boolean(cutState.showBossTitleCard);
          souls.cutsceneCanSkip = Boolean(cutState.canSkip);
          souls.cutsceneBossTitleRu = cutState.bossTitleRu || BOSS_DOOR_CUTSCENE_ACTS.BOSS_TITLE_RU;
          souls.cutsceneBossSubtitleRu = cutState.bossSubtitleRu || BOSS_DOOR_CUTSCENE_ACTS.BOSS_SUBTITLE_RU;
          souls.cutsceneLetterbox01 = Number(cutState.letterbox01) || 0;

          if ((cutState.dustBurstStage || 0) > (souls.cutsceneLastDustStage || 0)) {
            souls.cutsceneLastDustStage = cutState.dustBurstStage;
            emitSoulsSparkBurst('cutscene_door_dust', 0, SOULS_CASTLE_CONSTANTS.BOSS_DOOR_Z, 0, 1);
          }

          if (cutState.doorSlam && !souls.cutsceneDoorSlammed) {
            souls.cutsceneDoorSlammed = true;
            world?.sealBossDoors?.();
            emitSoulsSparkBurst('door_dust', 0, SOULS_CASTLE_CONSTANTS.BOSS_DOOR_Z, 0, -1);
          }

          if (cutState.doorFullyClosed && !souls.cutsceneFogGateSealed) {
            souls.cutsceneFogGateSealed = true;
            world?.sealBossFogGate?.();
            world?.setSoulsFogGate?.(true);
          }

          const vCue = Number(cutState.voiceCueIndex) || 0;
          if (vCue > 0 && vCue !== souls.cutsceneLastVoiceCue) {
            souls.cutsceneLastVoiceCue = vCue;
            audio?.playBossIntroVoiceLine?.(vCue);
          }

          const aCue = Number(cutState.armorShiftCue) || 0;
          if (aCue > 0 && aCue !== souls.cutsceneLastArmorCue) {
            souls.cutsceneLastArmorCue = aCue;
            audio?.playBossArmorShift?.(1.0);
          }

          // Silent Hero choreography: push -> confident walk-in -> stoic silent stance
          player.facing = cutState.heroFacing ?? BOSS_DOOR_CUTSCENE_ACTS.HERO_FACING;
          player.moveVelX = 0;
          player.moveVelZ = 0;
          if (cutState.heroMode === 'push') {
            player.x = BOSS_DOOR_CUTSCENE_ACTS.HERO_PUSH_X;
            player.z = BOSS_DOOR_CUTSCENE_ACTS.HERO_PUSH_Z;
            heroModel?.handle?.setDoorPushMode?.(true, cutState.heroPushEffort ?? 0.8);
            souls.cutsceneHeroWalkAnim = false;
          } else if (cutState.heroMode === 'walk_in') {
            heroModel?.handle?.setDoorPushMode?.(false);
            if (Number.isFinite(cutState.heroTargetX)) player.x = cutState.heroTargetX;
            if (Number.isFinite(cutState.heroTargetZ)) player.z = cutState.heroTargetZ;
            souls.cutsceneHeroWalkAnim = true;
            const hStep = Number(cutState.heroStepCue) || 0;
            if (hStep > 0 && hStep !== souls.cutsceneLastHeroStep) {
              souls.cutsceneLastHeroStep = hStep;
              if (typeof audio?.playStepStone === 'function') {
                audio.playStepStone(hStep);
              } else {
                audio?.playFootstep?.(currentClassId, hStep, false, 'cathedral_stone');
              }
            }
          } else {
            heroModel?.handle?.setDoorPushMode?.(false);
            player.x = Number.isFinite(cutState.heroTargetX) ? cutState.heroTargetX : BOSS_DOOR_CUTSCENE_ACTS.HERO_FINAL_X;
            player.z = Number.isFinite(cutState.heroTargetZ) ? cutState.heroTargetZ : BOSS_DOOR_CUTSCENE_ACTS.HERO_FINAL_Z;
            souls.cutsceneHeroWalkAnim = false;
          }

          // Boss on illuminated Throne: Throne_Intro_Dialogue -> calm Throne_Intro_StandUp (ZERO roar!) -> ready
          const cutBoss = enemies.find((en) => en && en.isSoulsBoss && en.hp > 0);
          if (cutBoss) {
            bossEntity = cutBoss;
            cutBoss.x = 0;
            cutBoss.facing = 0;
            cutBoss.vx = 0;
            cutBoss.vz = 0;
            if (cutBoss.model?.obj) {
              cutBoss.model.obj.visible = true;
            }
            cutBoss.model?.handle?.setBossMouthOpen?.(cutState.mouthOpen01 || 0);
            if (cutBoss.model?.obj) {
              updateSoulsBossVisuals(cutBoss.model.obj, frameDt, {
                phase2Enraged: false,
                isWindup: false,
                isStaggered: false,
                mouthOpen01: cutState.mouthOpen01 || 0,
                elapsed: elapsedTime
              });
            }
            if (cutState.bossAnimPhase === 'dialogue') {
              cutBoss.z = BOSS_DOOR_CUTSCENE_ACTS.BOSS_SIT_Z;
              cutBoss.model?.handle?.setCutsceneClipNormalized?.('Throne_Intro_Dialogue', cutState.bossDialogueU ?? 0, 0.22);
            } else if (cutState.bossAnimPhase === 'standup') {
              souls.cutsceneIntroStandupStarted = true;
              cutBoss.z = Number.isFinite(cutState.bossTargetZ) ? cutState.bossTargetZ : BOSS_DOOR_CUTSCENE_ACTS.BOSS_SIT_Z;
              cutBoss.model?.handle?.setCutsceneClipNormalized?.('Throne_Intro_StandUp', cutState.bossStandupU ?? 0, 0.22);
              const bStep = Number(cutState.bossStepCue) || 0;
              if (bStep > 0 && bStep !== souls.cutsceneLastBossStep) {
                souls.cutsceneLastBossStep = bStep;
                audio?.playBossFootstep?.(0.15);
                soulsGameFeel.triggerKick(0, 1, 0.26, { dirY: -0.9 });
                world?.addScreenShake?.(0.14, 0.14);
                emitParticles(bStep === 1 ? 0.42 : -0.36, 0.14, cutBoss.z + 0.35, 0xd6d3d1, 8, 2.8, 0.12);
              }
            } else if (cutState.bossAnimPhase === 'ready') {
              cutBoss.z = BOSS_DOOR_CUTSCENE_ACTS.BOSS_FINAL_Z;
              cutBoss.model?.handle?.clearCutsceneClip?.(0.22);
              cutBoss.model?.handle?.setClipOverride?.(null);
            }
          }
        }
      } else {
        soulsDoorCutsceneActive = Boolean(world?.isBossDoorCutsceneActive?.());
      }
      if (soulsEscapeCutsceneActive) {
        soulsDoorCutsceneActive = true;
      }
      if (soulsDoorCutsceneActive) {
        mx = 0;
        mz = 0;
        moveMag = 0;
        speedRatio = 0;
      }
    }

    const liveCamYaw = world?.getCombatOrbitYaw?.() ?? input?.cameraYaw ?? 0;
    if (isSoulslike && !soulsEscapeCutsceneActive && souls.zoneMode === 'castle') {
      audio?.updateSoulsSpatial?.(
        player.x,
        player.z,
        liveCamYaw,
        true,
        Boolean(souls.bossAwakened && !souls.bossDefeated),
        frameDt,
        world?.getFlameTrapStates?.() || null
      );
    }
    const camFwdAngle = Math.atan2(-Math.sin(liveCamYaw), -Math.cos(liveCamYaw));
    const frameInputSource = input?.inputSource === 'touch' ? 'touch' : 'mouse_kb';
    const isTouchFrame = frameInputSource === 'touch';

    // Combat threat presence (strictly in Abandoned Knight Rift):
    //   - Out of combat (!hasNearbyCombatThreat): infinite 0/s sprint & front-facing attacks along player.facing/WASD.
    //   - In combat (hasNearbyCombatThreat): 12/s sprint drain & unlocked attacks track camera forward (+ 38 deg assist).
    let hasNearbyCombatThreat = false;
    if (isSoulslike) {
      souls.lastInputSource = frameInputSource;
      if (souls.mobileAutoFlaskCd > 0) souls.mobileAutoFlaskCd = Math.max(0, souls.mobileAutoFlaskCd - dt);
      if (souls.mobileManualUnlockTimer > 0) souls.mobileManualUnlockTimer = Math.max(0, souls.mobileManualUnlockTimer - dt);
      if (souls.mobileThreatCheckCd > 0) souls.mobileThreatCheckCd = Math.max(0, souls.mobileThreatCheckCd - dt);

      // Mobile-Only Smart Target Lock-On Director (PC remains 100% untouched!
      // NEVER auto-rotate camYaw when running backward — touch joystick is camera-relative!)
      if (isTouchFrame && !soulsDoorCutsceneActive && !souls.activeRiposte && !playerDying && !runEnded) {
        souls.mobileRetreatSprintSec = 0;
        if (mobileSmartLockEnabled && (souls.mobileManualUnlockTimer || 0) <= 0) {
          if (!activeLocked) {
            const autoCand = findBestMobileSmartTarget(null);
            if (autoCand) {
              lockedEnemy = autoCand;
              activeLocked = autoCand;
              angToLocked = Math.atan2(autoCand.x - player.x, autoCand.z - player.z);
              cancelPlayerTurn180(0.20);
              syncWorldLockOn();
            }
          } else if (!activeLocked.isSoulsBoss && (souls.mobileThreatCheckCd || 0) <= 0) {
            souls.mobileThreatCheckCd = 0.26;
            const curDist = Math.hypot(activeLocked.x - player.x, activeLocked.z - player.z);
            const closerThreat = findBestMobileSmartTarget(null);
            if (closerThreat && closerThreat !== activeLocked) {
              const closerDist = Math.hypot(closerThreat.x - player.x, closerThreat.z - player.z);
              if (closerDist <= 3.9 && closerDist + 2.2 < curDist) {
                lockedEnemy = closerThreat;
                activeLocked = closerThreat;
                angToLocked = Math.atan2(closerThreat.x - player.x, closerThreat.z - player.z);
                cancelPlayerTurn180(0.18);
                syncWorldLockOn();
              }
            }
          }
        }
      }

      hasNearbyCombatThreat = Boolean(activeLocked) || Boolean(souls.bossAwakened && !souls.bossDefeated);
      if (!hasNearbyCombatThreat) {
        for (let ei = 0; ei < enemies.length; ei++) {
          const e = enemies[ei];
          if (!e || e.hp <= 0 || e.isTrainingDummy || (e.emergeTimer || 0) > 0) continue;
          if (e.isSoulsBoss && !souls.bossAwakened) continue;
          const edist = Math.hypot(e.x - player.x, e.z - player.z);
          if (edist <= 9.5 || (e.soulsAwake && edist <= 13.5)) {
            hasNearbyCombatThreat = true;
            break;
          }
        }
      }
      souls.inCombat = hasNearbyCombatThreat;
    }

    const computeSoulsAimAngle = () => {
      let ang;
      if (angToLocked !== null) {
        ang = angToLocked;
      } else if (isTouchFrame && moveMag > 0.14) {
        ang = Math.atan2(mx, mz);
      } else if (hasNearbyCombatThreat) {
        ang = camFwdAngle;
      } else {
        ang = moveMag > 0.05 ? Math.atan2(mx, mz) : player.facing;
      }
      if (angToLocked === null && hasNearbyCombatThreat) {
        let bestAssistAng = null;
        let bestAssistScore = Infinity;
        const maxConeRad = isTouchFrame ? Math.PI : 0.66;
        const angWeight = isTouchFrame ? 0.85 : 2.2;
        for (let ei = 0; ei < enemies.length; ei++) {
          const e = enemies[ei];
          if (!e || e.hp <= 0 || (e.emergeTimer || 0) > 0) continue;
          if (e.isSoulsBoss && !souls.bossAwakened) continue;
          const edx = e.x - player.x;
          const edz = e.z - player.z;
          const edist = Math.hypot(edx, edz);
          const maxAssistDist = isTouchFrame
            ? Math.max(4.6, (e.radius || 0.7) + 2.8)
            : Math.max(3.6, (e.radius || 0.7) + 2.2);
          if (edist > maxAssistDist || edist < 0.05) continue;
          const eAng = Math.atan2(edx, edz);
          const angDiff = Math.abs(normalizeAngle(eAng - ang));
          if (angDiff <= maxConeRad) {
            const score = edist + angDiff * angWeight;
            if (score < bestAssistScore) {
              bestAssistScore = score;
              bestAssistAng = eAng;
            }
          }
        }
        if (bestAssistAng !== null) ang = bestAssistAng;
      }
      return ang;
    };

    let soulsBufferedRoll = false;
    let soulsBufferedHeavy = false;
    let soulsBufferedAttack = false;
    let soulsBufferedFlask = false;
    let soulsEarlyRollingR1Fired = false;

    // Chapter 26 Elden Ring State: Stamina Controller, 1-Slot Smart Action Buffer, Block/Parry, Flask [R], Bonfire & Fog Gate
    if (isSoulslike) {
      if (soulsStaminaEmptyHintCd > 0) soulsStaminaEmptyHintCd = Math.max(0, soulsStaminaEmptyHintCd - dt);
      if (souls.guardBreakTimer > 0) souls.guardBreakTimer = Math.max(0, souls.guardBreakTimer - dt);
      if (souls.guardCounterTimer > 0) souls.guardCounterTimer = Math.max(0, souls.guardCounterTimer - dt);
      if (souls.bonfireHealCooldown > 0) souls.bonfireHealCooldown = Math.max(0, souls.bonfireHealCooldown - dt);
      if (souls.bonfireRestTimer > 0) souls.bonfireRestTimer = Math.max(0, souls.bonfireRestTimer - dt);
      if (souls.shoreNoSwordHintCd > 0) souls.shoreNoSwordHintCd = Math.max(0, souls.shoreNoSwordHintCd - dt);
      if (souls.justLandedTimer > 0) souls.justLandedTimer = Math.max(0, souls.justLandedTimer - dt);
      if (souls.recoilVisual > 0) souls.recoilVisual = Math.max(0, souls.recoilVisual - dt * 3.8);

      const isExteriorShoreNow = souls.zoneMode === 'exterior_shore';
      let bf = world?.getSoulsBonfirePos?.() || SOULS_CASTLE_BONFIRE;
      let distToBonfire = 999;
      let nearBonfireNow = false;

      if (isExteriorShoreNow) {
        souls.zoneTitleRu = 'Берег Пепельного Стока';
        const shoreAnchors = world?.getExteriorShoreAnchors?.() || {};
        bf = shoreAnchors.bonfirePos || { x: -2.2, y: 0.2, z: 15.0 };
        distToBonfire = Math.hypot(player.x - bf.x, player.z - bf.z);
        nearBonfireNow = distToBonfire <= 5.5;
        if (!soulsEscapeCutsceneActive) {
          const shoreBfProx = souls.shoreBonfireLit ? Math.max(0, 1 - distToBonfire / 14.0) : 0;
          audio?.setExteriorShoreAmbient?.(true, {
            bonfireProximity: shoreBfProx,
            bonfireLit: Boolean(souls.shoreBonfireLit),
            listenerX: player.x,
            listenerZ: player.z,
            listenerYaw: liveCamYaw,
            bonfireX: bf.x,
            bonfireZ: bf.z
          });
        }
      } else if (!soulsEscapeCutsceneActive) {
        // Update current 6-zone non-linear Dark Souls castle room title
        const curRoom = getCastleRoomAt(player.x, player.z);
        if (curRoom && curRoom.labelRu) {
          souls.zoneTitleRu = curRoom.labelRu;
        } else if (player.z < SOULS_CASTLE_CONSTANTS.BOSS_DOOR_Z) {
          souls.zoneTitleRu = 'Тронный Зал';
        } else {
          souls.zoneTitleRu = 'Замок Пепла';
        }

        distToBonfire = Math.hypot(player.x - bf.x, player.z - bf.z);
        nearBonfireNow = (!souls.bossAwakened || souls.bossDefeated) && (isInBonfireSafeZone(player.x, player.z, 1.0) || distToBonfire <= 10.5);
        audio?.setSoulsAmbientActive?.(true, { nearBonfire: nearBonfireNow });
      }

      // Timed Wall Flame Jet Traps (#8, #449 — harder 5-gargoyle Fire Gauntlet) & East Alcove Flank Ambush (#9)
      if (souls.flameTrapHitCd > 0) {
        souls.flameTrapHitCd = Math.max(0, souls.flameTrapHitCd - dt);
      }
      if (!isExteriorShoreNow && !soulsDoorCutsceneActive && !souls.activeRiposte) {
        if (
          souls.flameTrapHitCd <= 0 &&
          player.invulnTimer <= 0 &&
          player.dashInvulnTimer <= 0 &&
          world?.isPointInFlameTrap?.(player.x, player.z, 1.0, player.radius)
        ) {
          souls.flameTrapHitCd = 0.42;
          applyDamageToPlayer(
            30,
            { x: player.x, z: player.z + 1.2, isTrap: true },
            { canParry: false, parryable: false, damageLevel: 'heavy', unblockable: true }
          );
          emitParticles(player.x, 0.95, player.z, 0xf97316, 16, 5.4, 0.14);
          spawnSoulsClashSparks(player.x, 1.0, player.z, 0, 0.65, 1, 'fire');
          world?.addScreenShake?.(0.22, 0.14);
          floatText('🔥 ОГНЕННАЯ ЛОВУШКА!', player.x, player.z - 0.85, '#f97316');
        }

        if (!(souls.triggeredAmbushes instanceof Set)) {
          souls.triggeredAmbushes = new Set();
        }
        const triggeredAmb = checkCastleAmbushTrigger(player.x, player.z, souls.triggeredAmbushes);
        if (triggeredAmb) {
          souls.triggeredAmbushes.add(triggeredAmb.id);
          const ambMob = enemies.find(
            (en) => en && en.hp > 0 && (en.soulsEncounterId === triggeredAmb.encounterId || en.ambushId === triggeredAmb.id)
          );
          if (ambMob) {
            ambMob.soulsAwake = true;
            ambMob.isAmbushGuard = false;
            ambMob.aiState = 'approach';
            audio?.playMobAggro?.(ambMob.type, getMobAudioDistNorm(ambMob));
            world?.addScreenShake?.(0.18, 0.16);
            emitParticles(ambMob.x, 1.1, ambMob.z, 0xf97316, 14, 4.8, 0.14);
            floatText(triggeredAmb.warCryToastRu || '⚔️ ЗАСАДА ИЗ ОРУЖЕЙНОЙ!', ambMob.x, ambMob.z - 0.9, '#fca5a5');
          }
        }
      }

      // Paired Critical Finishing Blow / Riposte (#20: 2.25s paired anim, 15% maxHP Boss / 55% maxHP Mob)
      const applySoulsRiposteTrueDamage = (target, dmg, isPullout) => {
        if (!target || target.hp <= 0) return;
        const dealt = Math.max(1, Math.round(dmg));
        if (!isPullout && target.hp > 1) {
          target.hp = Math.max(1, target.hp - dealt);
        } else {
          target.hp = Math.max(0, target.hp - dealt);
        }
        target.hitFlash = 0.22;
        floatText(`-${dealt}`, target.x + (Math.random() - 0.5) * 0.45, target.z - 0.75, '#fde047');
        if (target.hp <= 0) {
          handleEnemyDeath(target);
        }
      };

      const startSoulsCriticalRiposte = (target) => {
        if (!target || target.hp <= 0) return false;
        souls.activeRiposte = {
          target,
          elapsed: 0,
          duration: 2.25,
          hit1Done: false,
          hit2Done: false
        };
        souls.canRiposte = false;
        souls.riposteTarget = null;
        souls.isBlocking = false;
        souls.blockWasHeld = false;
        souls.blockHoldSec = 0;
        souls.parryWindowTimer = 0;
        souls.activeAttack = null;
        souls.flaskDrinkTimer = 0;
        souls.flaskHealTimer = 0;
        player.hasHyperArmor = false;
        player.dashTimer = 0;
        meleeStepLunge = null;
        pendingMeleeStrikes.length = 0;
        soulsActionBuffer.clear();
        setModelBlocking(heroModel, false);
        heroModel?.handle?.cancelFlaskDrinkAnim?.();
        heroModel?.handle?.cancelRollAnim?.();

        let dirX = player.x - target.x;
        let dirZ = player.z - target.z;
        const curD = Math.hypot(dirX, dirZ);
        if (curD < 0.05) {
          dirX = Math.sin(target.facing || 0);
          dirZ = Math.cos(target.facing || 0);
        } else {
          dirX /= curD;
          dirZ /= curD;
        }
        const standDist = target.isSoulsBoss ? 2.15 : 1.52;
        const desiredPos = clampPlayerCastlePos(target.x + dirX * standDist, target.z + dirZ * standDist, player.radius);
        player.x = desiredPos.x;
        player.z = desiredPos.z;
        player.facing = Math.atan2(target.x - player.x, target.z - player.z);
        // Align kneeling victim squarely chest-to-chest toward the Hero for crisp paired riposte contact!
        target.facing = Math.atan2(player.x - target.x, player.z - target.z);
        if (target.model?.obj) target.model.obj.rotation.y = target.facing;
        player.moveVelX = 0;
        player.moveVelZ = 0;
        player.invulnTimer = Math.max(player.invulnTimer || 0, 2.35);
        resetActorPhysics(player);
        resetActorPhysics(target);
        target.model?.handle?.cancelHitReact?.();
        heroModel?.handle?.playCriticalRiposte?.(1.0);

        if (target.isSoulsBoss) {
          startSoulsBossRiposteVictim(target, lastFrameElapsedTime, bossAiCtx);
        } else {
          // Atomic one-shot riposte consumption: immediately zero stagger & arm post-riposte immunity!
          target.soulsAwake = true;
          target.isAmbushGuard = false;
          target.soulsRiposteUsed = true;
          target.soulsRiposteInvuln = true;
          target.stagger = 0;
          target._soulsParryCount = 0;
          target.staggeredTimer = 0;
          target.parriedRiposteTimer = 0;
          target.staggerImmunityTimer = 4.8;
          target.soulsState = 'riposte_victim';
          target.aiState = 'riposte_victim';
          target.vx = 0;
          target.vz = 0;
          poiseCtrl.resetEntityPoise(target, { grantImmunity: true });
          releaseSoulsAttackToken(target);
          const ripRes = target.model?.handle?.playClampedClip?.('Riposte_Victim_Fall', 1.0, 0.14);
          const ripDur = ripRes?.ok && ripRes.duration > 0.8 ? ripRes.duration : 2.25;
          target._soulsRiposteHasClip = Boolean(ripRes?.ok);
          target.soulsRiposteTimer = Math.max(2.45, ripDur + 0.20);
          target.stunTimer = target.soulsRiposteTimer;
        }
        return true;
      };

      if (souls.activeRiposte) {
        const rip = souls.activeRiposte;
        rip.elapsed += dt;
        mx = 0;
        mz = 0;
        moveMag = 0;
        speedRatio = 0;
        player.moveVelX = 0;
        player.moveVelZ = 0;
        player.invulnTimer = Math.max(player.invulnTimer || 0, 0.2);
        const rt = rip.target;
        if (rt && rt.hp > 0) {
          player.facing = Math.atan2(rt.x - player.x, rt.z - player.z);
          if (rip.elapsed >= 0.56 && !rip.hit1Done) {
            rip.hit1Done = true;
            audio?.playRiposteImpact?.();
            emitSoulsSparkBurst('stance_break', rt.x, rt.z, Math.sin(player.facing), Math.cos(player.facing));
            spawnSoulsClashSparks(rt.x, 1.15, rt.z, -Math.sin(player.facing), 0.35, -Math.cos(player.facing), 'parry');
            soulsGameFeel.triggerHitstop(0.065);
            soulsGameFeel.triggerKick(Math.sin(player.facing), Math.cos(player.facing), 0.45);
            world?.addScreenShake?.(0.32, 0.18);
            const hit1Pct = rt.isSoulsBoss ? 0.05 : 0.18;
            applySoulsRiposteTrueDamage(rt, Math.max(1, Math.round((rt.maxHp || 100) * hit1Pct)), false);
          }
          if (rip.elapsed >= 1.48 && !rip.hit2Done) {
            rip.hit2Done = true;
            audio?.playRiposteImpact?.();
            emitSoulsSparkBurst('stance_break', rt.x, rt.z, -Math.sin(player.facing), -Math.cos(player.facing));
            emitParticles(rt.x, 1.25, rt.z, 0xfde047, 26, 7.6, 0.16);
            emitShockwave(rt.x, rt.z, 3.6, 0xfbbf24, 0.32);
            soulsGameFeel.triggerHitstop(0.085);
            soulsGameFeel.triggerKick(-Math.sin(player.facing), -Math.cos(player.facing), 0.72);
            world?.addScreenShake?.(0.50, 0.24);
            const hit2Pct = rt.isSoulsBoss ? 0.10 : 0.37;
            applySoulsRiposteTrueDamage(rt, Math.max(1, Math.round((rt.maxHp || 100) * hit2Pct)), true);
            floatText('КРИТИЧЕСКИЙ УДАР!', rt.x, rt.z - 0.95, '#fde047');
          }
        }
        if (rip.elapsed >= rip.duration) {
          souls.activeRiposte = null;
          if (rt && !rt.isSoulsBoss && rt.hp > 0 && rt.soulsState === 'riposte_victim') {
            triggerSoulsMobRiposteStandUp(rt, 2.30);
          }
        }
        souls.canRiposte = false;
        souls.riposteTarget = null;
      } else if (!soulsDoorCutsceneActive && !playerDying && player.dashTimer <= 0 && souls.guardBreakTimer <= 0 && souls.flaskDrinkTimer <= 0) {
        let bestRip = null;
        let bestRipDist = 2.75;
        for (let ei = 0; ei < enemies.length; ei++) {
          const cand = enemies[ei];
          if (!cand || cand.hp <= 0 || cand.isTrainingDummy) continue;
          if (cand.isSoulsBoss && !souls.bossAwakened) continue;
          if (
            cand.soulsState === 'riposte_victim' ||
            cand.soulsState === 'riposte_recover' ||
            cand.soulsState === 'stagger_recover' ||
            cand.soulsRiposteUsed ||
            cand.soulsRiposteInvuln
          ) continue;
          const isOpen =
            cand.soulsState === 'stagger_kneel' ||
            (cand.parriedRiposteTimer || 0) > 0 ||
            (cand.staggeredTimer || 0) > 0;
          if (!isOpen) continue;
          const dCand = Math.hypot(cand.x - player.x, cand.z - player.z);
          if (dCand <= bestRipDist) {
            bestRipDist = dCand;
            bestRip = cand;
          }
        }
        souls.canRiposte = Boolean(bestRip);
        souls.riposteTarget = bestRip;
      } else {
        souls.canRiposte = false;
        souls.riposteTarget = null;
      }

      // Rest near Castle Bonfire (0, 25): restore HP & refill Estus Flasks (skip on Exterior Shore — Shore Bonfire uses [E]!)
      if (!isExteriorShoreNow && (!souls.bossAwakened || souls.bossDefeated)) {
        if (distToBonfire <= 2.9 && souls.bonfireHealCooldown <= 0) {
          if (player.hp < stats.maxHp || souls.flasks < souls.flasksMax) {
            player.hp = stats.maxHp;
            souls.flasks = souls.flasksMax;
            soulsStaminaCtrl.reset(SOULS_STAMINA_CFG.MAX_STAMINA);
            syncSoulsStaminaMirror();
            souls.bonfireHealCooldown = 3.5;
            if (!hasNearbyCombatThreat) {
              souls.bonfireRestTimer = 2.5;
            }
            audio?.playPickup?.('heart');
            emitShockwave(bf.x, bf.z, 4.2, 0xfbbf24, 0.42);
            emitParticles(player.x, 0.9, player.z, 0xfde047, 18, 5.2, 0.14);
            floatText(`🔥 КОСТЁР: HP И ФЛЯГИ ${souls.flasks}/${souls.flasksMax}`, player.x, player.z - 0.8, '#fde047');
          }
        }
      }

      const rawInteractIn = Boolean(input?.interact);
      if (isExteriorShoreNow) {
        // Exterior River Shore («Берег Пепельного Стока») Interactive Landmarks:
        //   1. Fallen Great Club (`swordPos`) -> [E] Подобрать Большую Дубину
        //   2. Shore Bonfire (`bonfirePos`) -> [E] Зажечь Костёр Берега / Отдохнуть
        //   3. Ash Gorge Gate (`gatePos`) -> [E] Пепельное Ущелье (Глава II)
        //   4. Carved Runic Waystone Monolith (`monolithPos`) -> [E] Прочесть надпись на стеле
        const shoreAnchors = world?.getExteriorShoreAnchors?.() || {};
        const swordAnchor = shoreAnchors.swordPos || { x: 2.8, y: 0.08, z: 5.2 };
        const bonfireAnchor = shoreAnchors.bonfirePos || { x: -2.2, y: 0.21, z: 15.0 };
        const gateAnchor = shoreAnchors.gatePos || { x: 0.0, y: 0.56, z: 31.0 };
        const monolithAnchor = shoreAnchors.monolithPos || { x: -5.0, y: 0.42, z: 16.4 };

        const distSword = Math.hypot(player.x - swordAnchor.x, player.z - swordAnchor.z);
        const distShoreBf = Math.hypot(player.x - bonfireAnchor.x, player.z - bonfireAnchor.z);
        const distGate = Math.hypot(player.x - gateAnchor.x, player.z - gateAnchor.z);
        const distMonolith = Math.hypot(player.x - monolithAnchor.x, player.z - monolithAnchor.z);

        const nearShoreSword = !soulsDoorCutsceneActive && !souls.shoreSwordPickedUp && distSword <= 2.75;
        const nearShoreBonfire = !soulsDoorCutsceneActive && !nearShoreSword && distShoreBf <= 2.95;
        const nearShoreGate = !soulsDoorCutsceneActive && !nearShoreSword && !nearShoreBonfire && distGate <= 3.55;
        const nearShoreMonolith =
          !soulsDoorCutsceneActive && !nearShoreSword && !nearShoreBonfire && !nearShoreGate && distMonolith <= 2.75;

        souls.canRestAtBonfire = Boolean(nearShoreBonfire);
        souls.canInteract = Boolean(nearShoreSword || nearShoreBonfire || nearShoreGate || nearShoreMonolith);
        souls.canOpenBossDoors = souls.canInteract;
        const shoreLabel = nearShoreSword
          ? 'Подобрать Большую Дубину'
          : nearShoreBonfire
            ? (souls.shoreBonfireLit ? 'Отдохнуть у Костра Берега' : 'Зажечь Костёр Берега')
            : nearShoreGate
              ? 'Пепельное Ущелье (Глава II)'
              : nearShoreMonolith
                ? 'Прочесть надпись на стеле'
                : 'Открыть врата';
        souls.interactLabel = shoreLabel;
        souls.interactPromptRu = shoreLabel;

        if (rawInteractIn && !souls.prevInteractInput && !soulsDoorCutsceneActive && !souls.activeRiposte) {
          if (nearShoreSword) {
            souls.shoreSwordPickedUp = true;
            world?.setShoreSwordPickedUp?.(true);
            equipHeroWeapon('great_club');
            audio?.playSwordPickupChime?.();
            audio?.playBossHammerWhoosh?.(false);
            world?.addScreenShake?.(0.16, 0.14);
            emitParticles(swordAnchor.x, (swordAnchor.y || 0) + 0.55, swordAnchor.z, 0xd6b588, 22, 5.0, 0.14);
            emitParticles(player.x, 1.0, player.z, 0xfef08a, 14, 4.4, 0.13);
            floatText('🪵 БОЛЬШАЯ ДУБИНА ПОДОБРАНА!', player.x, player.z - 0.9, '#fde047');
            callbacks?.onSoulsCue?.('БОЛЬШАЯ ДУБИНА', 'guard_counter');
            callbacks?.onShoreSwordPickedUp?.();
          } else if (nearShoreBonfire) {
            souls.shoreBonfireLit = true;
            souls.escapedCastle = true;
            souls.bonfireCheckpointLit = true;
            souls.flasksMax = Math.max(4, souls.flasksMax || 4);
            souls.flasks = souls.flasksMax;
            player.hp = stats.maxHp;
            soulsStaminaCtrl.reset(SOULS_STAMINA_CFG.MAX_STAMINA);
            syncSoulsStaminaMirror();
            souls.bonfireHealCooldown = 3.5;
            souls.bonfireRestTimer = 4.5;
            world?.setShoreBonfireLit?.(true);
            audio?.playPickup?.('heart');
            audio?.playFlaskDrink?.();
            emitShockwave(bonfireAnchor.x, bonfireAnchor.z, 5.2, 0xfbbf24, 0.55);
            emitParticles(bonfireAnchor.x, (bonfireAnchor.y || 0) + 0.95, bonfireAnchor.z, 0xfde047, 28, 6.4, 0.16);
            emitParticles(player.x, 1.0, player.z, 0xf59e0b, 18, 4.8, 0.14);
            floatText(`🔥 КОСТЁР БЕРЕГА ЗАЖЖЁН • ЧЕКПОИНТ СОХРАНЁН • ${souls.flasks}/${souls.flasksMax} ФЛЯГ`, player.x, player.z - 0.9, '#fde047');
            callbacks?.onSoulsCue?.('КОСТЁР БЕРЕГА ЗАЖЖЁН', 'guard_counter');
            callbacks?.onShoreBonfireLit?.({
              escapedCastle: true,
              shoreBonfireLit: true,
              shoreSwordPickedUp: Boolean(souls.shoreSwordPickedUp)
            });
          } else if (nearShoreGate) {
            callbacks?.onShorePrologueGateInteract?.({
              escapedCastle: true,
              shoreSwordPickedUp: Boolean(souls.shoreSwordPickedUp),
              shoreBonfireLit: Boolean(souls.shoreBonfireLit)
            });
          } else if (nearShoreMonolith) {
            const loreLines = [
              '«Из стоков Замка Пепла живыми выходят лишь те, кого отвергла сама Бездна...»',
              '«Зажги Костёр Берега, путник. В Пепельном Ущелье клинок важнее клятвы.»',
              '«Палач Разлома ещё хранит печать. Вернись сильнее, Охотник.»'
            ];
            const idx = (souls.monolithReadCount || 0) % loreLines.length;
            souls.monolithReadCount = (souls.monolithReadCount || 0) + 1;
            audio?.playSwordPickupChime?.();
            emitParticles(monolithAnchor.x, (monolithAnchor.y || 0.4) + 1.35, monolithAnchor.z, 0x93c5fd, 16, 3.6, 0.12);
            floatText(`🗿 ${loreLines[idx]}`, monolithAnchor.x, monolithAnchor.z - 0.6, '#bfdbfe');
            callbacks?.onSoulsCue?.('НАДПИСЬ ПАЛОМНИКА', 'guard_counter');
          }
        }
        souls.prevInteractInput = rawInteractIn;
      } else {
      // Monumental Twin Boss Doors ([E]) + Pre-Boss Checkpoint Bonfire ([E]) + East Alcove Relic Shrine ([E])
      if (souls.bossDoorExitingHall) {
        if (player.z >= SOULS_CASTLE_CONSTANTS.BOSS_DOOR_Z + 1.0) {
          souls.bossDoorExitingHall = false;
        } else if (!souls.bossDefeated && player.z < SOULS_CASTLE_CONSTANTS.BOSS_DOOR_Z - 10.0) {
          souls.bossDoorExitingHall = false;
        }
      }
      const doorState = world?.getBossDoorState?.() || 'open';
      const nearDoor =
        !soulsDoorCutsceneActive &&
        (doorState === 'closed' || doorState === 'sealed') &&
        canInteractWithBossDoor(player.x, player.z, doorState, { allowReopenFromInside: true });
      const nearBonfireRest = !soulsDoorCutsceneActive && !nearDoor && (!souls.bossAwakened || souls.bossDefeated) && canRestAtBonfire(player.x, player.z);
      const nearRelic = !soulsDoorCutsceneActive && !nearDoor && !nearBonfireRest ? findInteractableRelic(player.x, player.z, souls.claimedRelics) : null;
      souls.canRestAtBonfire = Boolean(nearBonfireRest);
      souls.canInteract = Boolean(nearDoor || nearBonfireRest || nearRelic);
      souls.canOpenBossDoors = Boolean(nearDoor || nearBonfireRest || nearRelic);
      const activeInteractLabel = nearDoor
        ? 'Открыть врата'
        : nearBonfireRest
          ? (SOULS_CASTLE_BONFIRE.promptRestRu || 'Отдохнуть у Костра (Чекпоинт • 4/4 Фляги)')
          : nearRelic
            ? (nearRelic.promptRu || nearRelic.labelRu || 'Взять реликвию (+1 Фляга)')
            : 'Открыть врата';
      souls.interactLabel = activeInteractLabel;
      souls.interactPromptRu = activeInteractLabel;

      if (rawInteractIn && !souls.prevInteractInput && !soulsDoorCutsceneActive && !souls.activeRiposte) {
        if (nearDoor) {
          const isInsideReopen = doorState === 'sealed' || player.z < SOULS_CASTLE_CONSTANTS.BOSS_DOOR_Z - 0.5;
          if (!isInsideReopen && !souls.bossIntroPlayed) {
            souls.bossIntroPlayed = true;
            souls.doorCutsceneActive = true;
            souls.doorCutsceneTimer = BOSS_DOOR_CUTSCENE_DURATION;
            souls.cutsceneLastVoiceCue = 0;
            souls.cutsceneLastArmorCue = 0;
            souls.cutsceneLastHeroStep = 0;
            souls.cutsceneLastBossStep = 0;
            souls.cutsceneLastDustStage = 0;
            souls.cutsceneDoorSlammed = false;
            souls.cutsceneFogGateSealed = false;
            souls.cutsceneIntroStandupStarted = false;
            souls.cutsceneHeroWalkAnim = false;
            souls.cutsceneSubtitleSpeaker = '';
            souls.cutsceneSubtitleText = '';
            souls.cutsceneShowBossTitleCard = false;
            souls.cutsceneCanSkip = false;
            souls.cutsceneLetterbox01 = 0;
            soulsDoorCutsceneActive = true;
            souls.canOpenBossDoors = false;
            soulsActionBuffer.clear();
            souls.isBlocking = false;
            souls.blockHoldSec = 0;
            souls.activeAttack = null;
            souls.flaskDrinkTimer = 0;
            souls.flaskHealTimer = 0;
            player.hasHyperArmor = false;
            meleeStepLunge = null;
            pendingMeleeStrikes.length = 0;
            player.dashTimer = 0;
            player.moveVelX = 0;
            player.moveVelZ = 0;
            resetActorPhysics(player);
            weaponTrails?.clearAll?.();
            cancelPlayerTurn180(0.5);
            setModelBlocking(heroModel, false);
            heroModel?.handle?.cancelFlaskDrinkAnim?.();
            player.x = BOSS_DOOR_CUTSCENE_ACTS.HERO_PUSH_X;
            player.z = BOSS_DOOR_CUTSCENE_ACTS.HERO_PUSH_Z;
            player.facing = BOSS_DOOR_CUTSCENE_ACTS.HERO_FACING;
            mx = 0;
            mz = 0;
            moveMag = 0;
            speedRatio = 0;
            world?.openBossDoors?.();
            world?.startBossDoorCutscene?.(BOSS_DOOR_CUTSCENE_DURATION);
            audio?.playCinematicBossDoorSequence?.();
            heroModel?.handle?.setDoorPushMode?.(true, 0.25);
            emitSoulsSparkBurst('door_dust', 0, SOULS_CASTLE_CONSTANTS.BOSS_DOOR_Z, 0, 1);
          } else if (isInsideReopen) {
            // Re-open sealed Boss Doors from inside the Boss Hall without replaying the 41s intro cutscene.
            // Call setSoulsFogGate(false) BEFORE openBossDoors() so doors swing smoothly wide open.
            world?.setSoulsFogGate?.(false);
            world?.openBossDoors?.();
            world?.setBossAtmosphere?.(false);
            audio?.playCastleDoorOpen?.();
            souls.canOpenBossDoors = false;
            souls.canInteract = false;
            souls.bossDoorExitingHall = true;
            souls.bossAwakened = false;
            if (lockedEnemy?.isSoulsBoss) {
              clearTargetLock();
            }
            bossHazards.length = 0;
            activeBurningZones.length = 0;
            audio?.stopBossRoar?.(0.12);
            const liveBoss = enemies.find((en) => en && en.isSoulsBoss && en.hp > 0);
            if (liveBoss) {
              cancelSoulsBossTelegraph(liveBoss, elapsedTime);
              liveBoss.model?.handle?.setBossMouthOpen?.(0);
              liveBoss.soulsAwake = false;
              liveBoss.soulsState = 'idle';
              liveBoss.soulsGoal = 'idle';
              liveBoss.soulsTimer = 0.65;
              liveBoss.bossSubState = null;
              liveBoss.currentAttackMeta = null;
              liveBoss.vx = 0;
              liveBoss.vz = 0;
              resetActorPhysics(liveBoss);
              if (liveBoss._trailRecording) {
                weaponTrails?.endSwing?.(liveBoss.uid);
                liveBoss._trailRecording = false;
              }
              if (liveBoss.soulsThronePhase === 'pause' || liveBoss.soulsThronePhase === 'standing') {
                liveBoss.soulsThronePhase = 'sitting';
                liveBoss.x = 0;
                liveBoss.z = SOULS_THRONE_SIT_Z;
                liveBoss.facing = 0;
                liveBoss.visualGroundY = 0;
                liveBoss.model?.handle?.setClipOverride?.('Throne_Sit', 1.0, true);
              } else {
                liveBoss.model?.handle?.clearClampedClip?.(true, 0.16);
                liveBoss.model?.handle?.clearCutsceneClip?.(0.16);
                liveBoss.model?.handle?.setClipOverride?.(null);
                liveBoss.model?.handle?.setLocomotionState?.({
                  mode: 'idle',
                  moveLocalX: 0,
                  moveLocalZ: 0,
                  turnDelta: 0,
                  actualSpeed: 0
                });
                liveBoss.model?.handle?.setCombatPostureState?.({
                  combatPhase: 'neutral',
                  combatPhase01: 0,
                  moveType: null
                });
              }
            }
            audio?.setSoulsAmbientActive?.(true, { nearBonfire: false });
            audio?.setMusicMode?.('combat');
            emitSoulsSparkBurst('door_dust', 0, SOULS_CASTLE_CONSTANTS.BOSS_DOOR_Z, 0, -1);
          } else {
            world?.setSoulsFogGate?.(false);
            world?.openBossDoors?.();
            audio?.playCastleDoorOpen?.();
            souls.canOpenBossDoors = false;
            emitSoulsSparkBurst('door_dust', 0, SOULS_CASTLE_CONSTANTS.BOSS_DOOR_Z, 0, 1);
          }
        } else if (nearBonfireRest) {
          souls.bonfireCheckpointLit = true;
          souls.flasksMax = Math.max(4, souls.flasksMax || 4);
          souls.flasks = souls.flasksMax;
          player.hp = stats.maxHp;
          soulsStaminaCtrl.reset(SOULS_STAMINA_CFG.MAX_STAMINA);
          syncSoulsStaminaMirror();
          souls.bonfireHealCooldown = 3.5;
          souls.bonfireRestTimer = 4.5;
          audio?.playPickup?.('heart');
          audio?.playFlaskDrink?.();
          emitShockwave(bf.x, bf.z, 5.2, 0xfbbf24, 0.55);
          emitParticles(bf.x, 1.0, bf.z, 0xfde047, 26, 6.2, 0.16);
          emitParticles(player.x, 1.0, player.z, 0xf59e0b, 18, 4.8, 0.14);
          floatText(`🔥 КОСТЁР ЗАЖЖЁН • ЧЕКПОИНТ СОХРАНЁН • ${souls.flasks}/${souls.flasksMax} ФЛЯГ`, player.x, player.z - 0.9, '#fde047');
          callbacks?.onSoulsCue?.(`🔥 ЧЕКПОИНТ СОХРАНЁН • ФЛЯГИ ${souls.flasks}/${souls.flasksMax}`, 'guard_counter');
        } else if (nearRelic) {
          if (!(souls.claimedRelics instanceof Set)) souls.claimedRelics = new Set();
          souls.claimedRelics.add(nearRelic.id);
          world?.setShrineClaimed?.(nearRelic.id, true);
          const estusBonus = Math.max(1, Number(nearRelic.estusBonus) || 1);
          souls.flasksMax = Math.max(4, souls.flasksMax || 4) + estusBonus;
          souls.flasks = Math.min(souls.flasksMax, (souls.flasks || 0) + estusBonus);
          souls.canOpenBossDoors = false;
          audio?.playFlaskDrink?.();
          emitShockwave(nearRelic.x, nearRelic.z, 3.8, nearRelic.glowColor || 0xf59e0b, 0.44);
          emitParticles(nearRelic.x, 1.15, nearRelic.z, 0xfde047, 22, 5.8, 0.14);
          emitParticles(player.x, 1.0, player.z, 0xf59e0b, 14, 4.4, 0.12);
          floatText(
            nearRelic.claimedToastRu || `✨ РЕЛИКВИЯ: +${estusBonus} ФЛЯГА (${souls.flasks}/${souls.flasksMax})!`,
            player.x,
            player.z - 0.9,
            '#fde047'
          );
          callbacks?.onSoulsCue?.(`✨ РЕЛИКВИЯ: +1 ФЛЯГА (${souls.flasks}/${souls.flasksMax})!`, 'guard_counter');
        } else if (souls.canRiposte && souls.riposteTarget) {
          startSoulsCriticalRiposte(souls.riposteTarget);
        }
      }
      souls.prevInteractInput = rawInteractIn;

      // Cross open Boss Doors into Throne Hall: seal massive doors, start Boss music & awaken Throne Boss!
      // Skipped while the narrative intro cutscene owns boss awakening & door closure,
      // while the player is exiting through re-opened doors, or after Boss victory.
      if (
        !isExteriorShoreNow &&
        !souls.bossAwakened &&
        !souls.bossDefeated &&
        !souls.bossDoorExitingHall &&
        !souls.doorCutsceneActive &&
        !soulsDoorCutsceneActive &&
        !world?.isBossDoorCutsceneActive?.() &&
        player.z < SOULS_CASTLE_CONSTANTS.BOSS_DOOR_Z - 1.8
      ) {
        souls.bossAwakened = true;
        world?.sealBossDoors?.();
        world?.setSoulsFogGate?.(true);
        world?.setBossAtmosphere?.(true);
        audio?.playCastleDoorClose?.();
        audio?.setSoulsAmbientActive?.(true, { nearBonfire: false });
        audio?.setMusicMode?.('boss');
        const soulsBoss = enemies.find((en) => en && en.isSoulsBoss && en.hp > 0);
        if (soulsBoss) {
          bossEntity = soulsBoss;
          if (soulsBoss.soulsThronePhase === 'sitting') {
            // Dramatic 1.5s stare from the throne before rising smoothly via Throne_StandUp!
            soulsBoss.soulsThronePhase = 'pause';
            soulsBoss.soulsThroneTimer = SOULS_THRONE_PAUSE_SEC;
            soulsBoss.soulsThroneElapsed = 0;
            soulsBoss.soulsAwake = false;
            world?.addScreenShake?.(0.16, 0.22);
            floatText('👑 СУДИЯ РУИН ВОССЕДАЕТ НА ТРОНЕ...', player.x, player.z - 1.2, '#fbbf24');
          } else {
            soulsBoss.soulsAwake = true;
            soulsBoss.soulsState = 'stalk';
            soulsBoss.soulsTimer = 0.85;
            audio?.playBossSpawn?.();
            world?.addScreenShake?.(0.35, 0.25);
            emitShockwave(soulsBoss.x, soulsBoss.z, 7.5, 0xf59e0b, 0.55);
            floatText('⚔️ РЫЦАРЬ ПЕПЛА ПРОБУДИЛСЯ!', player.x, player.z - 1.2, '#fbbf24');
          }
        }
      }
      } // end castle vs exterior_shore interact branch

      // 1-Slot Smart Input Buffer capture (rising-edge + guaranteed discrete touch tap counter; heavy attack disabled)
      const soulsLockControls = soulsDoorCutsceneActive || Boolean(souls.activeRiposte);
      const rawDashIn = !soulsLockControls && Boolean(input?.dash);
      const rawAttackIn = !soulsLockControls && Boolean(input?.manualTrigger);
      const rawAttackEdge = !soulsLockControls && (Boolean(input?.attackEdge) || (rawAttackIn && !souls.prevManualTrigger));
      const rawFlaskIn = !soulsLockControls && Boolean(input?.flask || input?.useFlask);
      if (rawDashIn && !souls.prevDashInput) {
        soulsActionBuffer.push('roll', elapsedRunTime, { inputSource: frameInputSource });
      }
      if (rawAttackEdge) {
        soulsActionBuffer.push('attack', elapsedRunTime, { inputSource: frameInputSource });
      }
      if (rawFlaskIn && !souls.prevFlaskInput) {
        soulsActionBuffer.push('flask', elapsedRunTime, { inputSource: frameInputSource });
      }
      souls.prevDashInput = rawDashIn;
      souls.prevHeavyTrigger = false;
      souls.prevManualTrigger = rawAttackIn;
      souls.prevFlaskInput = rawFlaskIn;

      // Charged R2 upgrade during active R2 windup when heavyHeld >= 0.35s
      if (
        souls.activeAttack &&
        souls.activeAttack.key === 'r2' &&
        !souls.activeAttack.upgradedToCharged &&
        input?.heavyHeld &&
        souls.activeAttack.elapsed < souls.activeAttack.spec.startup
      ) {
        souls.activeAttack.chargeHoldTime += dt;
        souls.activeAttack.chargeSparkAccum += dt;
        if (souls.activeAttack.chargeSparkAccum >= 0.07) {
          souls.activeAttack.chargeSparkAccum = 0;
          emitParticles(player.x, 0.92, player.z, 0xfde047, 3, 2.8, 0.10);
        }
        if (souls.activeAttack.chargeHoldTime >= 0.35) {
          const chargedSpec = getSoulsAttackSpec('charged_r2', souls.activeAttack.wpnId);
          const r2BaseSpec = getSoulsAttackSpec('r2', souls.activeAttack.wpnId);
          const extraStam = Math.max(0, chargedSpec.stamina - r2BaseSpec.stamina);
          soulsStaminaCtrl.spend(extraStam, { allowDebt: true, force: true });
          syncSoulsStaminaMirror();
          souls.activeAttack.key = 'charged_r2';
          souls.activeAttack.spec = chargedSpec;
          souls.activeAttack.upgradedToCharged = true;
          souls.activeAttack.isFinisher = true;
          const totalChargedDur = chargedSpec.startup + chargedSpec.active + chargedSpec.recovery;
          player.attackCooldown = Math.max(player.attackCooldown, totalChargedDur - souls.activeAttack.elapsed);
          player.attackFaceHoldTimer = Math.max(player.attackFaceHoldTimer, chargedSpec.startup + chargedSpec.active - souls.activeAttack.elapsed + 0.14);
          player.attackAnimTimer = Math.max(player.attackAnimTimer, chargedSpec.startup + chargedSpec.active - souls.activeAttack.elapsed + 0.10);
          if (meleeStepLunge) {
            meleeStepLunge.totalDist = chargedSpec.lungeDist;
            meleeStepLunge.duration = Math.max(meleeStepLunge.duration, chargedSpec.startup + chargedSpec.active * 0.5);
          }
          emitShockwave(player.x, player.z, 1.9, 0xfde047, 0.24);
          emitParticles(player.x, 0.95, player.z, 0xfde047, 10, 5.0, 0.12);
          floatText('🔥 ЗАРЯЖЕННЫЙ УДАР!', player.x, player.z - 0.72, '#fde047');
        }
      }

      // Animation Commitment cancel gates: strictly forbid roll/block cancel during Startup + Active!
      const activeAtk = souls.activeAttack;
      const activeSpec = activeAtk?.spec || null;
      const rollCancelThreshold = activeSpec
        ? (isTouchFrame
            ? Math.min(activeSpec.cancelRollAt, activeSpec.startup + activeSpec.active + 0.05)
            : activeSpec.cancelRollAt)
        : 0;
      const blockCancelThreshold = activeSpec
        ? (isTouchFrame
            ? Math.min(activeSpec.cancelBlockAt, activeSpec.startup + activeSpec.active + 0.04)
            : activeSpec.cancelBlockAt)
        : 0;
      const canRollCancelAtk = !activeSpec || activeAtk.elapsed >= rollCancelThreshold;
      const canBlockCancelAtk = !activeSpec || activeAtk.elapsed >= blockCancelThreshold;
      const canChainCancelAtk = !activeSpec || activeAtk.elapsed >= activeSpec.cancelChainAt;

      const canActFromMicroStun = poiseCtrl.canPlayerCancelMicroStun(player);
      const isMicroStunnedNow = (player.microStunTimer || 0) > 0;

      // Consume highest-priority allowed buffered action for this sub-step
      const SOULS_ROLL_DUR = 0.6833;
      if (souls.activeRiposte) {
        // Paired Critical Riposte owns full hero control & i-frames for 2.25s
      } else if (player.dashTimer > 0) {
        const curRollU = clamp(1 - player.dashTimer / SOULS_ROLL_DUR, 0, 1);
        if (curRollU >= SOULS_ROLL_CFG.rollingAttackCancelU && souls.guardBreakTimer <= 0 && souls.flaskDrinkTimer <= 0 && soulsStaminaCtrl.canSpend()) {
          const rollFollow = soulsActionBuffer.consume(['attack'], elapsedRunTime);
          if (rollFollow) {
            player.dashTimer = 0;
            player.dashCooldown = 0;
            heroModel?.handle?.cancelRollAnim?.();
            const rollAim = computeSoulsAimAngle();
            player.facing = rollAim;
            const ok = performHeroAttack(rollAim, true, {
              attackKey: 'rolling_r1'
            });
            if (ok) soulsEarlyRollingR1Fired = true;
          }
        }
      } else {
        const allowedNow = new Set();
        if (
          canActFromMicroStun &&
          player.dashCooldown <= 0 &&
          souls.guardBreakTimer <= 0 &&
          souls.flaskDrinkTimer <= 0 &&
          canRollCancelAtk &&
          soulsStaminaCtrl.canSpend()
        ) {
          allowedNow.add('roll');
        }
        if (
          !isMicroStunnedNow &&
          souls.guardBreakTimer <= 0 &&
          souls.flaskDrinkTimer <= 0 &&
          canChainCancelAtk &&
          (activeSpec ? true : player.attackCooldown <= 0) &&
          soulsStaminaCtrl.canSpend()
        ) {
          allowedNow.add('attack');
        }
        if (
          !isMicroStunnedNow &&
          souls.guardBreakTimer <= 0 &&
          souls.flaskDrinkTimer <= 0 &&
          souls.flasks > 0 &&
          player.hp < stats.maxHp &&
          canRollCancelAtk
        ) {
          allowedNow.add('flask');
        }
        if (allowedNow.size > 0) {
          const consumed = soulsActionBuffer.consume(allowedNow, elapsedRunTime);
          if (consumed?.action === 'roll') soulsBufferedRoll = true;
          else if (consumed?.action === 'heavy') soulsBufferedHeavy = true;
          else if (consumed?.action === 'attack') soulsBufferedAttack = true;
          else if (consumed?.action === 'flask') soulsBufferedFlask = true;
        }
      }

      // LMB / R1 Critical Riposte launch when standing near staggered/parried victim (<= 2.75m)
      if (
        !souls.activeRiposte &&
        !soulsDoorCutsceneActive &&
        souls.canRiposte &&
        souls.riposteTarget &&
        (soulsBufferedAttack || rawAttackIn)
      ) {
        if (startSoulsCriticalRiposte(souls.riposteTarget)) {
          soulsBufferedAttack = false;
          soulsBufferedHeavy = false;
          soulsBufferedRoll = false;
          soulsBufferedFlask = false;
          mx = 0;
          mz = 0;
          moveMag = 0;
          speedRatio = 0;
        }
      }

      // Mobile-Only Smart Tactical Auto-Flask (drinks in safe combat windows when HP is low; PC untouched!)
      if (
        isTouchFrame &&
        mobileAutoFlaskEnabled &&
        !soulsBufferedFlask &&
        !soulsLockControls &&
        !playerDying &&
        !runEnded &&
        souls.flasks > 0 &&
        souls.flaskDrinkTimer <= 0 &&
        (souls.mobileAutoFlaskCd || 0) <= 0 &&
        player.dashTimer <= 0 &&
        !souls.activeAttack &&
        souls.guardBreakTimer <= 0 &&
        !isMicroStunnedNow &&
        !souls.canRiposte
      ) {
        const hpRatioNow = stats.maxHp > 0 ? player.hp / stats.maxHp : 1;
        const nearFreeBonfire = Boolean(nearBonfireNow && !hasNearbyCombatThreat && distToBonfire <= 5.5);
        if (!nearFreeBonfire && hpRatioNow <= 0.25) {
          if (!isImminentDangerForAutoFlask(true)) {
            soulsBufferedFlask = true;
            souls.mobileAutoFlaskTriggered = true;
            souls.mobileAutoFlaskCd = 2.6;
            souls.mobileAutoFlaskSafeSec = 0;
          }
        } else if (!nearFreeBonfire && hpRatioNow <= 0.48) {
          if (!isImminentDangerForAutoFlask(false)) {
            souls.mobileAutoFlaskSafeSec = (souls.mobileAutoFlaskSafeSec || 0) + dt;
            if (souls.mobileAutoFlaskSafeSec >= 0.10) {
              soulsBufferedFlask = true;
              souls.mobileAutoFlaskTriggered = true;
              souls.mobileAutoFlaskCd = 2.6;
              souls.mobileAutoFlaskSafeSec = 0;
            }
          } else {
            souls.mobileAutoFlaskSafeSec = 0;
          }
        } else if (!nearFreeBonfire && !hasNearbyCombatThreat && hpRatioNow <= 0.56 && souls.flasks >= 2) {
          souls.mobileAutoFlaskSafeSec = (souls.mobileAutoFlaskSafeSec || 0) + dt;
          if (souls.mobileAutoFlaskSafeSec >= 0.32) {
            soulsBufferedFlask = true;
            souls.mobileAutoFlaskTriggered = true;
            souls.mobileAutoFlaskCd = 2.6;
            souls.mobileAutoFlaskSafeSec = 0;
          }
        } else {
          souls.mobileAutoFlaskSafeSec = 0;
        }
      }

      // Estus Flask [R]: restores 55% HP over a deliberate 0.88s 3D drinking animation
      if (soulsBufferedFlask && souls.flasks > 0 && souls.flaskDrinkTimer <= 0 && player.hp < stats.maxHp) {
        const wasAutoFlask = Boolean(souls.mobileAutoFlaskTriggered);
        souls.mobileAutoFlaskTriggered = false;
        souls.flasks -= 1;
        souls.flaskDrinkTimer = 0.88;
        souls.flaskHealTimer = 0.88;
        souls.isBlocking = false;
        souls.activeAttack = null;
        player.hasHyperArmor = false;
        setModelBlocking(heroModel, false);
        heroModel?.handle?.playFlaskDrinkAnim?.(0.88);
        const healAmt = Math.max(25, Math.round(stats.maxHp * 0.55));
        player.hp = Math.min(stats.maxHp, player.hp + healAmt);
        if (typeof audio?.playFlaskDrink === 'function') {
          audio.playFlaskDrink();
        } else {
          audio?.playPickup?.('heart');
        }
        emitShockwave(player.x, player.z, 2.4, 0xf59e0b, 0.34);
        emitParticles(player.x, 0.9, player.z, 0xfde047, 16, 4.8, 0.14);
        floatText(
          wasAutoFlask
            ? `🧪 АВТО-ХИЛ +${healAmt} HP (${souls.flasks}/${souls.flasksMax})`
            : `🧪 +${healAmt} HP (${souls.flasks}/${souls.flasksMax})`,
          player.x,
          player.z - 0.6,
          '#fde047'
        );
      }
      if (souls.flaskDrinkTimer > 0) {
        souls.flaskDrinkTimer = Math.max(0, souls.flaskDrinkTimer - dt);
        souls.flaskHealTimer = souls.flaskDrinkTimer;
      }

      // Shield Block & Timed Parry (strictly gated by Animation Commitment `canBlockCancelAtk`!)
      const wantsBlock =
        !soulsDoorCutsceneActive &&
        !souls.activeRiposte &&
        Boolean(input?.block) &&
        souls.guardBreakTimer <= 0 &&
        souls.flaskDrinkTimer <= 0 &&
        soulsStaminaCtrl.canSpend() &&
        player.dashTimer <= 0 &&
        canBlockCancelAtk &&
        canActFromMicroStun &&
        !soulsBufferedRoll &&
        !soulsEarlyRollingR1Fired;
      if (wantsBlock) {
        if ((player.microStunTimer || 0) > 0) {
          poiseCtrl.cancelPlayerMicroStun(player);
          heroModel?.handle?.cancelHitReact?.();
        }
        if (souls.activeAttack && canBlockCancelAtk) {
          souls.activeAttack = null;
          player.hasHyperArmor = false;
          meleeStepLunge = null;
        }
        if (!souls.blockWasHeld) {
          souls.blockPressElapsed = 0;
          souls.blockParryTouch = isTouchFrame;
          souls.blockParryConsumed = false;
        } else {
          souls.blockPressElapsed = (souls.blockPressElapsed || 0) + dt;
        }
        const pStart = souls.blockParryTouch
          ? (SOULS_GUARD_CFG.parryStartupTouch ?? 0.0)
          : SOULS_GUARD_CFG.parryStartupSec;
        const pActive = souls.blockParryTouch ? SOULS_GUARD_CFG.parryActiveTouch : SOULS_GUARD_CFG.parryActivePc;
        const pEnd = pStart + pActive;
        souls.parryWindowTimer =
          !souls.blockParryConsumed && souls.blockPressElapsed >= pStart && souls.blockPressElapsed <= pEnd
            ? Math.max(0, pEnd - souls.blockPressElapsed)
            : 0;
        souls.isBlocking = true;
        souls.blockWasHeld = true;
        souls.blockHoldSec = (souls.blockHoldSec || 0) + dt;
      } else {
        souls.isBlocking = false;
        souls.blockWasHeld = false;
        souls.blockPressElapsed = 0;
        souls.blockHoldSec = 0;
        souls.blockParryConsumed = false;
        souls.parryWindowTimer = 0;
      }
      setModelBlocking(heroModel, souls.isBlocking);
    }

    const playerMicroStunned = isSoulslike && (player.microStunTimer || 0) > 0;
    const canRollOutOfMicroStun = !isSoulslike || poiseCtrl.canPlayerCancelMicroStun(player);
    let manualSprint =
      Boolean(input?.sprint) &&
      moveMag > 0.05 &&
      !playerMicroStunned &&
      (!isSoulslike || (!souls.isBlocking && souls.flaskDrinkTimer <= 0 && !souls.activeAttack && (!hasNearbyCombatThreat || soulsStaminaCtrl.canSpend())));
    if (isSoulslike) {
      if (manualSprint) {
        const sprintOk = soulsStaminaCtrl.drainSprint(dt, { inCombat: hasNearbyCombatThreat });
        if (!sprintOk) {
          manualSprint = false;
        }
      }
      const isBusyStaminaAction =
        player.dashTimer > 0 ||
        Boolean(souls.activeAttack && souls.activeAttack.elapsed < souls.activeAttack.spec.startup + souls.activeAttack.spec.active);
      soulsStaminaCtrl.tick(dt, {
        isBlocking: Boolean(souls.isBlocking),
        isBusyAction: isBusyStaminaAction,
        isSprintingInCombat: Boolean(manualSprint && hasNearbyCombatThreat)
      });
      syncSoulsStaminaMirror();
    }
    const isSprintingNow = !playerMicroStunned && (player.sprintTimer > 0 || manualSprint);
    const sprintMult = isSprintingNow ? 1.35 : 1.0;
    const soulsPaceMult = isSoulslike
      ? (souls.flaskDrinkTimer > 0
          ? 0.45
          : souls.isBlocking
            ? 0.60
            : souls.guardBreakTimer > 0
              ? 0.55
              : souls.activeAttack && souls.activeAttack.elapsed < souls.activeAttack.spec.startup + souls.activeAttack.spec.active
                ? 0.25
                : 1.0)
      : 1.0;
    const baseMoveSpeed = stats.moveSpeed * (beastActive ? 1.45 : 1.0) * sprintMult * soulsPaceMult;
    const microStunPaceMult = playerMicroStunned ? (player.microStunMoveMult || 0.32) : 1.0;
    const effectiveMoveSpeed = baseMoveSpeed * microStunPaceMult;

    const spawnDashFireTrailAt = (fx, fz) => {
      const fireStacks = stats?.dashFireTrailStacks || 0;
      if (fireStacks <= 0) return;
      const patchRadius = 1.25 + (fireStacks - 1) * 0.22;
      const patchDuration = 2.6;
      if (typeof world?.spawnFireTrailPatch === 'function') {
        world.spawnFireTrailPatch({ x: fx, z: fz, radius: patchRadius, duration: patchDuration });
      } else {
        emitParticles(fx, 0.25, fz, 0xf97316, 8, 3.6, 0.14);
      }
      if (fireTrailPatches.length >= 18) fireTrailPatches.shift();
      fireTrailPatches.push({
        x: fx,
        z: fz,
        radius: patchRadius,
        timer: patchDuration,
        tickAccum: 0.25,
        tickDmg: Math.max(6, Math.round((stats?.damage || 24) * (0.34 + fireStacks * 0.18)))
      });
    };

    const SOULS_ROLL_DURATION = SOULS_ROLL_CFG.duration;
    const canSoulRollCommitment =
      !isSoulslike ||
      !souls.activeAttack ||
      souls.activeAttack.elapsed >= souls.activeAttack.spec.cancelRollAt;
    const canSoulRoll =
      canRollOutOfMicroStun &&
      canSoulRollCommitment &&
      (!isSoulslike || (!souls.activeRiposte && soulsStaminaCtrl.canSpend() && souls.guardBreakTimer <= 0 && souls.flaskDrinkTimer <= 0));
    const triggerRollNow = isSoulslike ? soulsBufferedRoll : Boolean(input?.dash);
    if (triggerRollNow && player.dashCooldown <= 0 && player.dashTimer <= 0 && canSoulRoll) {
      meleeStepLunge = null;
      if ((player.microStunTimer || 0) > 0) {
        poiseCtrl.cancelPlayerMicroStun(player);
        heroModel?.handle?.cancelHitReact?.();
      }
      if (isSoulslike) {
        soulsStaminaCtrl.spend(SOULS_ROLL_CFG.staminaCost, { allowDebt: true });
        syncSoulsStaminaMirror();
        souls.isBlocking = false;
        souls.blockParryConsumed = false;
        souls.parryWindowTimer = 0;
        souls.activeAttack = null;
        souls.flaskDrinkTimer = 0;
        souls.flaskHealTimer = 0;
        souls._rollShoulderHitFired = false;
        souls._rollBootPlantFired = false;
        player.hasHyperArmor = false;
        setModelBlocking(heroModel, false);
        heroModel?.handle?.cancelFlaskDrinkAnim?.();
        pendingMeleeStrikes.length = 0;
        player.attackAnimTimer = 0;
        player.attackFaceHoldTimer = 0;
      }
      const dirX = moveMag > 0.05 ? mx / moveMag : Math.sin(player.facing || 0);
      const dirZ = moveMag > 0.05 ? mz / moveMag : Math.cos(player.facing || 0);
      player.dashDirX = dirX;
      player.dashDirZ = dirZ;
      player.dashTimer = isSoulslike ? SOULS_ROLL_DURATION : DASH_DURATION;
      player.dashInvulnTimer = isSoulslike ? getSoulsRollIframes(frameInputSource) : DASH_INVULN;
      player.dashCooldown = isSoulslike ? SOULS_ROLL_DURATION : getDashCooldownMax();
      player.dashTrailAccum = 0;
      player.dashFireTrailAccum = 0;
      player.standStillTimer = 0;
      cancelPlayerTurn180(0.35);
      player.runMomentumTime = 0;
      if (isSoulslike) {
        if (typeof audio?.playRollStone === 'function') {
          audio.playRollStone();
        } else {
          audio?.playDash?.();
        }
        player.facing = Math.atan2(dirX, dirZ);
        const playedRoll =
          heroModel?.handle?.playRollAnim?.(SOULS_ROLL_DURATION) ||
          heroModel?.obj?.userData?.playRollAnim?.(SOULS_ROLL_DURATION) ||
          false;
        if (!playedRoll) {
          player.mesh?.userData?.animCtrl?.triggerDash?.(0.28);
          heroModel?.handle?.triggerDash?.(0.28);
        }
      } else {
        audio?.playDash?.();
        player.mesh?.userData?.animCtrl?.triggerDash?.(0.22);
        heroModel?.handle?.triggerDash?.(0.22);
      }
      const dashCol =
        currentClassId === 'mage'
          ? stats?.mageElementColor || 0x38bdf8
          : currentClassId === 'gunslinger'
            ? 0xfbbf24
            : isSoulslike
              ? 0x44403c
              : 0xe2e8f0;
      emitParticles(player.x, isSoulslike ? 0.08 : 0.58, player.z, dashCol, isSoulslike ? 4 : 12, isSoulslike ? 1.8 : 5.8, isSoulslike ? 0.08 : 0.13);
      if (!isSoulslike) {
        world?.spawnShockwaveRing?.({ x: player.x, y: 0.05, z: player.z, radius: 1.15, color: dashCol, duration: 0.22 });
        spawnDashFireTrailAt(player.x, player.z);
      }
    }

    const isDashingNow = player.dashTimer > 0;
    if (isDashingNow) {
      const prevDashTimer = player.dashTimer;
      player.dashTimer = Math.max(0, prevDashTimer - dt);
      if (isSoulslike) {
        // Elden Ring Medium Dive-Roll (~3.72 m over 0.6833s via FPS-independent Simpson integral)
        const prevU = clamp(1 - prevDashTimer / SOULS_ROLL_DURATION, 0, 1);
        const nextU = clamp(1 - player.dashTimer / SOULS_ROLL_DURATION, 0, 1);
        const rollStepDist = sampleSoulsRollStepDist(prevU, nextU, SOULS_ROLL_DURATION);
        const instSpeed = dt > 1e-5 ? rollStepDist / dt : 0;
        player.moveVelX = player.dashDirX * instSpeed;
        player.moveVelZ = player.dashDirZ * instSpeed;
        player.x += player.dashDirX * rollStepDist;
        player.z += player.dashDirZ * rollStepDist;
        // Heavy shoulder-impact stone thud + dust ring right as the airborne dive hits stone (u = 0.44)!
        if (!souls._rollShoulderHitFired && nextU >= 0.44) {
          souls._rollShoulderHitFired = true;
          emitParticles(player.x, 0.14, player.z, 0xd6d3d1, 11, 3.8, 0.13);
          world?.spawnShockwaveRing?.({ x: player.x, y: 0.04, z: player.z, radius: 0.92, color: 0xa8a29e, duration: 0.20 });
          world?.addScreenShake?.(0.11, 0.08);
          audio?.playFootstep?.(currentClassId, 0, true, world?.getSurfaceType?.(player.x, player.z) || 'stone_courtyard');
        }
        // Heavy boot-catch squat dust puff (u = 0.76)
        if (!souls._rollBootPlantFired && nextU >= 0.76) {
          souls._rollBootPlantFired = true;
          emitParticles(player.x, 0.10, player.z, 0xd6d3d1, 7, 2.6, 0.11);
          audio?.playFootstep?.(currentClassId, 1, true, world?.getSurfaceType?.(player.x, player.z) || 'stone_courtyard');
        }
        if (player.dashTimer <= 0) {
          souls.justLandedTimer = 0.28;
        }
      } else {
        const dashSpeed = baseMoveSpeed * DASH_SPEED_MULT;
        player.moveVelX = player.dashDirX * dashSpeed;
        player.moveVelZ = player.dashDirZ * dashSpeed;
        player.x += player.moveVelX * dt;
        player.z += player.moveVelZ * dt;
      }
      player.standStillTimer = 0;
      player.dashTrailAccum = (player.dashTrailAccum || 0) + dt;
      if (!isSoulslike && player.dashTrailAccum >= 0.032) {
        player.dashTrailAccum = 0;
        const trailCol =
          (stats?.dashFireTrailStacks || 0) > 0
            ? 0xf97316
            : currentClassId === 'mage'
              ? stats?.mageElementColor || 0x38bdf8
              : currentClassId === 'gunslinger'
                ? 0xfbbf24
                : 0xfffbeb;
        emitParticles(player.x, 0.62, player.z, trailCol, 4, 3.0, 0.11);
      }
      if (!isSoulslike && (stats?.dashFireTrailStacks || 0) > 0) {
        player.dashFireTrailAccum = (player.dashFireTrailAccum || 0) + dt;
        if (player.dashFireTrailAccum >= 0.065) {
          player.dashFireTrailAccum = 0;
          spawnDashFireTrailAt(player.x, player.z);
        }
      }
    } else {
      // Smooth velocity acceleration/deceleration along pressed movement vector
      // (movement direction is independent of facing/aim so cursor aiming never pulls the hero off course).
      // During Warrior Turn_180, apply brief braking plant in the first third of the turn followed by crisp
      // push-off acceleration so the hero never slides sideways while rotating!
      const liveTurnVelState = player.turn180Active
        ? heroModel?.handle?.getTurn180State?.() || heroModel?.obj?.userData?.getTurn180State?.() || null
        : null;
      if (liveTurnVelState && liveTurnVelState.active) {
        const tp = liveTurnVelState.progress01 || 0;
        const targetVX = moveMag > 0.01 ? mx * effectiveMoveSpeed : 0;
        const targetVZ = moveMag > 0.01 ? mz * effectiveMoveSpeed : 0;
        if (tp < 0.20) {
          // Brief responsive braking plant (~90ms) with smooth 65% catch into new direction (zero muddy stall on W<->S!)
          const brakeAccel = 1 - Math.exp(-dt * 12);
          player.moveVelX = (player.moveVelX || 0) + (targetVX * 0.65 - (player.moveVelX || 0)) * brakeAccel;
          player.moveVelZ = (player.moveVelZ || 0) + (targetVZ * 0.65 - (player.moveVelZ || 0)) * brakeAccel;
        } else {
          // Crisp push-off launch: 0.68 -> 1.00 full speed by tp = 0.46 (~0.20s) in lockstep with the push-off leg
          const pushRamp = clamp((tp - 0.20) / 0.26, 0, 1);
          const speedScale = 0.68 + 0.32 * pushRamp;
          const pushAccel = 1 - Math.exp(-dt * 15);
          player.moveVelX = (player.moveVelX || 0) + (targetVX * speedScale - (player.moveVelX || 0)) * pushAccel;
          player.moveVelZ = (player.moveVelZ || 0) + (targetVZ * speedScale - (player.moveVelZ || 0)) * pushAccel;
        }
      } else {
        const accel = 1 - Math.exp(-dt * 11);
        const targetVX = moveMag > 0.01 ? mx * effectiveMoveSpeed : 0;
        const targetVZ = moveMag > 0.01 ? mz * effectiveMoveSpeed : 0;
        player.moveVelX = (player.moveVelX || 0) + (targetVX - (player.moveVelX || 0)) * accel;
        player.moveVelZ = (player.moveVelZ || 0) + (targetVZ - (player.moveVelZ || 0)) * accel;
      }
      if (Math.abs(player.moveVelX) < 0.02) player.moveVelX = 0;
      if (Math.abs(player.moveVelZ) < 0.02) player.moveVelZ = 0;
      player.x += player.moveVelX * dt;
      player.z += player.moveVelZ * dt;
      if (moveMag > 0.01) {
        player.standStillTimer = Math.max(0, (player.standStillTimer || 0) - dt * 4.5);
      } else {
        const maxFocusTime = Math.max(0.05, stats?.focusTime || 1.0);
        player.standStillTimer = Math.min(maxFocusTime, (player.standStillTimer || 0) + dt);
      }
    }

    // Smooth decay of physical recoil over ~0.14s
    if (Math.abs(player.recoilVx) > 0.001 || Math.abs(player.recoilVz) > 0.001) {
      player.x += player.recoilVx * 1.75 * dt;
      player.z += player.recoilVz * 1.75 * dt;
      const recoilDamp = Math.exp(-13.5 * dt);
      player.recoilVx *= recoilDamp;
      player.recoilVz *= recoilDamp;
      if (Math.hypot(player.recoilVx, player.recoilVz) < 0.02) {
        player.recoilVx = 0;
        player.recoilVz = 0;
      }
    }

    // Live Dark Souls camera-steered attack tracking (in combat, when unlocked in Abandoned Knight Rift):
    // Tracks camera forward strictly up to `spec.trackingCutoff01` (~65–70% of startup), then freezes!
    // Out of combat (!hasNearbyCombatThreat): ZERO auto-rotation into camFwdAngle (preserves front-facing inspection after S!).
    let steeringAttackToCam = false;
    if (isSoulslike && hasNearbyCombatThreat && angToLocked === null && !isDashingNow && souls.activeAttack) {
      const atk = souls.activeAttack;
      const trackLimit = atk.spec.startup * (atk.spec.trackingCutoff01 ?? 0.68);
      if (atk.elapsed < trackLimit) {
        const steerAlpha = Math.min(1, dt * 11.5);
        atk.strikeAngle = lerpAngle(atk.strikeAngle ?? atk.aimAngle, camFwdAngle, steerAlpha);
        atk.aimAngle = atk.strikeAngle;
        player.facing = lerpAngle(player.facing, camFwdAngle, steerAlpha);
        player.attackAimAngle = player.facing;
        steeringAttackToCam = true;
        if (meleeStepLunge) {
          const curLungeAng =
            Number.isFinite(meleeStepLunge.dirX) && Number.isFinite(meleeStepLunge.dirZ)
              ? Math.atan2(meleeStepLunge.dirX, meleeStepLunge.dirZ)
              : player.facing;
          const nextLungeAng = lerpAngle(curLungeAng, camFwdAngle, steerAlpha);
          meleeStepLunge.dirX = Math.sin(nextLungeAng);
          meleeStepLunge.dirZ = Math.cos(nextLungeAng);
        }
      }
    }

    // Warrior forward combat step-in lunge (`meleeStepLunge`):
    //   - Abandoned Knight Rift: accelerated C2 Elden Ring step-in via `sampleAttackLungeStep(prevU, nextU, totalDist)`
    //   - PvE: smoothstep lunge untouched
    if (meleeStepLunge) {
      if (isDashingNow || beastActive || player.hp <= 0 || playerDying || (isSoulslike && souls.isBlocking)) {
        meleeStepLunge = null;
      } else {
        let lungeFwdX;
        let lungeFwdZ;
        if (angToLocked !== null) {
          lungeFwdX = Math.sin(angToLocked);
          lungeFwdZ = Math.cos(angToLocked);
        } else if (isSoulslike && Number.isFinite(meleeStepLunge.dirX) && Number.isFinite(meleeStepLunge.dirZ)) {
          lungeFwdX = meleeStepLunge.dirX;
          lungeFwdZ = meleeStepLunge.dirZ;
        } else {
          const lungeYaw = player.facing || 0;
          lungeFwdX = Math.sin(lungeYaw);
          lungeFwdZ = Math.cos(lungeYaw);
        }
        const moveDotFwd = moveMag > 0.05 ? (mx * lungeFwdX + mz * lungeFwdZ) / moveMag : 0;
        if (moveMag > 0.05 && moveDotFwd < -0.35) {
          meleeStepLunge = null;
        } else {
          const prevU = clamp(meleeStepLunge.elapsed / meleeStepLunge.duration, 0, 1);
          meleeStepLunge.elapsed = Math.min(meleeStepLunge.duration, meleeStepLunge.elapsed + dt);
          const nextU = clamp(meleeStepLunge.elapsed / meleeStepLunge.duration, 0, 1);
          const isClubStep = currentWeaponId === 'great_club';
          const runForwardScale = moveMag > 0.05 && moveDotFwd > 0.35 ? (isClubStep ? 0.78 : 0.45) : 1.0;
          let stepDist;
          if (meleeStepLunge.useSoulsCurve) {
            stepDist = sampleAttackLungeStep(prevU, nextU, meleeStepLunge.totalDist) * runForwardScale;
          } else {
            const smoothPrev = prevU * prevU * (3 - 2 * prevU);
            const smoothNext = nextU * nextU * (3 - 2 * nextU);
            stepDist = meleeStepLunge.totalDist * (smoothNext - smoothPrev) * runForwardScale;
          }
          if (stepDist > 1e-5) {
            let candX = player.x + lungeFwdX * stepDist;
            let candZ = player.z + lungeFwdZ * stepDist;
            for (let ei = 0; ei < enemies.length; ei++) {
              const e = enemies[ei];
              if (!e || e.hp <= 0) continue;
              const minSep =
                (player.radius || 0.58) +
                (e.radius || 0.55) +
                (e.isTrainingDummy || e.isBoss ? 0.14 : 0.04);
              const dxE = candX - e.x;
              const dzE = candZ - e.z;
              const distE = Math.hypot(dxE, dzE);
              if (distE < minSep) {
                const prevDistE = Math.hypot(player.x - e.x, player.z - e.z);
                if (distE < prevDistE) {
                  const stopDist = Math.min(prevDistE, minSep);
                  const nxE = distE > 1e-4 ? dxE / distE : -lungeFwdX;
                  const nzE = distE > 1e-4 ? dzE / distE : -lungeFwdZ;
                  candX = e.x + nxE * stopDist;
                  candZ = e.z + nzE * stopDist;
                }
              }
            }
            const lungeSafe = resolveObstaclesAndBounds(candX, candZ, player.radius, ARENA_PLAYER_LIMIT);
            player.x = lungeSafe.x;
            player.z = lungeSafe.z;
          }
          if (isSoulslike && meleeStepLunge.useSoulsCurve && !meleeStepLunge.plantDustFired && nextU >= 0.78) {
            meleeStepLunge.plantDustFired = true;
            emitParticles(
              player.x + lungeFwdX * 0.28,
              0.08,
              player.z + lungeFwdZ * 0.28,
              0xd6d3d1,
              5,
              2.2,
              0.10
            );
            audio?.playFootstep?.(currentClassId, 0, true, world?.getSurfaceType?.(player.x, player.z) || 'stone_courtyard');
          }
          if (meleeStepLunge.elapsed >= meleeStepLunge.duration) {
            meleeStepLunge = null;
          }
        }
      }
    }

    // Step Souls physics momentum body (mass-based stone friction + castle wall bounce/sparks)
    if (isSoulslike && !soulsDoorCutsceneActive) {
      const pPhysStep = stepActorPhysicsBody(player, dt, {
        clampPosition: clampPlayerCastlePos,
        frictionMult: souls.isBlocking ? 1.28 : 1.0,
        lowSpec: combatLowSpecMode
      });
      if (pPhysStep.wallHit) {
        handleSoulsWallSlam(player, pPhysStep, false);
      }
    }

    // Pass 1: hard body collision against enemies/bosses/training dummy after movement, roll & melee lunge
    if (!soulsDoorCutsceneActive) {
      resolvePlayerEnemyBodyCollisions(false);

      const resolvedPlayer = resolveObstaclesAndBounds(player.x, player.z, player.radius, ARENA_PLAYER_LIMIT);
      player.x = resolvedPlayer.x;
      player.z = resolvedPlayer.z;
    }

    // Interactive Breakable 3D Candle Clusters (Castle) & Wooden Barrels/Crates (Exterior Shore) on Roll!
    if (isSoulslike && !soulsDoorCutsceneActive && (moveMag > 0.05 || isDashingNow)) {
      const onExteriorShore = souls.zoneMode === 'exterior_shore';
      if (onExteriorShore && isDashingNow) {
        const smashed = world?.hitShoreDestructibles?.(player.x, player.z, 0.95);
        if (smashed && smashed.count > 0) {
          for (let bi = 0; bi < smashed.hits.length; bi++) {
            const bh = smashed.hits[bi];
            emitParticles(bh.x, bh.y, bh.z, 0x9c7b57, 14, 4.6, 0.13);
            emitParticles(bh.x, bh.y + 0.15, bh.z, 0x5c4632, 8, 3.2, 0.10);
          }
          audio?.playBossHammerHit?.(0.42);
          world?.addScreenShake?.(0.09, 0.08);
        }
      } else if (!onExteriorShore) {
        const brokenCandles = world?.tryBreakCandlesNear?.(player.x, player.z, 0.72);
        if (Array.isArray(brokenCandles) && brokenCandles.length > 0) {
          for (let ci = 0; ci < brokenCandles.length; ci++) {
            const c = brokenCandles[ci];
            if (c) emitParticles(c.x, 0.25, c.z, 0xfde68a, 5, 2.2, 0.08);
          }
        }
      }
    }

    // 2. Aiming & Combat Firing
    // Strict Dark Souls vs PvE isolation:
    //   - Dark Souls (isSoulslike === true): 1-slot buffered R1/R2/Charged R2/Guard Counter/Rolling R1 + Lock-On / z59 front-facing rule.
    //   - PvE (isSoulslike === false): classic PvE auto-aim, auto-attack & manual cursor override (when hasManualAim).
    const isPlayerMicroStunnedNow = isSoulslike && (player.microStunTimer || 0) > 0;
    let engagedAimAngle = null;
    const explicitManualAttack = Boolean(input?.manualTrigger);
    if (!beastActive && !isPlayerMicroStunnedNow && !soulsDoorCutsceneActive && (isSoulslike || attackEnabled || explicitManualAttack)) {
      if (isSoulslike) {
        if (!souls.activeRiposte && !isDashingNow && !soulsEarlyRollingR1Fired && souls.guardBreakTimer <= 0 && souls.flaskDrinkTimer <= 0) {
          const atkCanChain = !souls.activeAttack || souls.activeAttack.elapsed >= souls.activeAttack.spec.cancelChainAt;
          const canTriggerSoulsAtk = atkCanChain && (souls.activeAttack ? true : player.attackCooldown <= 0);
          const wantLight = soulsBufferedAttack || (Boolean(input?.firing) && canTriggerSoulsAtk);
          if (wantLight && canTriggerSoulsAtk) {
            engagedAimAngle = computeSoulsAimAngle();
            if (Number.isFinite(engagedAimAngle)) {
              player.facing = engagedAimAngle;
            }
            performHeroAttack(engagedAimAngle, true, null);
          }
        }
      } else {
        const canInterruptShellReload =
          player.isReloading && (stats?.reloadPerShellTime || 0) > 0 && player.ammo > 0;
        const canShootNow = player.overdriveAmmo > 0 || !player.isReloading;
        const manualActive =
          explicitManualAttack ||
          (attackEnabled && (Boolean(input?.firing) || (!autoAim && Boolean(input?.hasManualAim))));
        if (manualActive) {
          if (angToLocked !== null) {
            engagedAimAngle = angToLocked;
          } else if (Boolean(input?.hasManualAim)) {
            const ax = Number(input?.aimWorldX);
            const az = Number(input?.aimWorldZ);
            if (Number.isFinite(ax) && Number.isFinite(az)) {
              const adx = ax - player.x;
              const adz = az - player.z;
              if (adx * adx + adz * adz > 0.001) {
                engagedAimAngle = Math.atan2(adx, adz);
              }
            }
          }
          if (engagedAimAngle === null) {
            engagedAimAngle = moveMag > 0.05 ? Math.atan2(mx, mz) : player.facing;
          }
          if ((canShootNow || canInterruptShellReload) && player.attackCooldown <= 0) {
            performHeroAttack(engagedAimAngle, true);
          }
        } else if (attackEnabled && autoAim) {
          const target = findAutoAimTarget(stats.clampToArenaBounds ? stats.range : stats.range * 1.06);
          if (target) {
            engagedAimAngle = Math.atan2(target.x - player.x, target.z - player.z);
            const distToTarget = Math.hypot(target.x - player.x, target.z - player.z);
            const emergencyShellShot = canInterruptShellReload && player.ammo >= 1 && distToTarget <= 3.6;
            if ((canShootNow || emergencyShellShot) && player.attackCooldown <= 0) {
              performHeroAttack(engagedAimAngle, false);
            }
          }
        }
      }
    }

    if (player.attackFaceHoldTimer > 0) {
      player.attackFaceHoldTimer = Math.max(0, player.attackFaceHoldTimer - dt);
    }

    // 2b. Warrior 60 FPS Turn_180 Detector (strictly during held Shift sprint `manualSprint` sharp 135°-180° reversals;
    //     NEVER triggered during normal non-sprint WASD movement, attacking, blocking, dashing, or dying!)
    if (player.turn180Cooldown > 0) {
      player.turn180Cooldown = Math.max(0, player.turn180Cooldown - dt);
    }
    const isAttackingNow =
      engagedAimAngle !== null ||
      explicitManualAttack ||
      Boolean(input?.firing) ||
      Boolean(isSoulslike && souls.activeAttack) ||
      (player.attackAnimTimer || 0) > 0 ||
      (player.attackFaceHoldTimer || 0) > 0 ||
      pendingMeleeStrikes.length > 0;
    const isBlockingNow = Boolean(isSoulslike && souls.isBlocking);
    const canDetectTurn180 =
      currentClassId === 'warrior' &&
      !isTouchFrame &&
      !activeLocked &&
      angToLocked === null &&
      !isAttackingNow &&
      !isBlockingNow &&
      !isDashingNow &&
      !isPlayerMicroStunnedNow &&
      !beastActive &&
      !playerDying &&
      !(isSoulslike && (souls.flaskDrinkTimer > 0 || souls.guardBreakTimer > 0));

    const actualMoveSpeedPre = Math.hypot(player.moveVelX || 0, player.moveVelZ || 0);
    const moveSpeedNorm = effectiveMoveSpeed > 0.1 ? actualMoveSpeedPre / effectiveMoveSpeed : 0;

    if (!canDetectTurn180) {
      if (activeLocked || angToLocked !== null || isAttackingNow || isBlockingNow || isDashingNow || playerDying) {
        cancelPlayerTurn180(isAttackingNow ? 0.30 : 0.15);
        player.runMomentumTime = 0;
      }
      if (!manualSprint) {
        player.runMomentumTime = 0;
        player.prevMoveDirX = 0;
        player.prevMoveDirZ = 0;
      } else if (moveMag > 0.45) {
        player.prevMoveDirX = mx / moveMag;
        player.prevMoveDirZ = mz / moveMag;
      }
    } else {
      const hasTurnInput = moveMag > 0.45;
      const inDirX = hasTurnInput ? mx / moveMag : 0;
      const inDirZ = hasTurnInput ? mz / moveMag : 0;

      if (player.turn180Active) {
        const activeTurnState =
          heroModel?.handle?.getTurn180State?.() ||
          heroModel?.obj?.userData?.getTurn180State?.() ||
          null;
        if (!activeTurnState || !activeTurnState.active) {
          player.turn180Active = false;
          player.turn180Delta = 0;
        } else if (hasTurnInput) {
          const liveTarget = Math.atan2(inDirX, inDirZ);
          const targetDrift = Math.abs(normalizeAngle(liveTarget - player.turn180TargetFacing));
          if (targetDrift < 0.85) {
            player.turn180TargetFacing = liveTarget;
            // Strictly preserve the clip's native spin direction (never flip sign mid-turn!)
            const spinSign = player.turn180Delta < 0 ? -1 : 1;
            let nextDelta = normalizeAngle(liveTarget - player.turn180StartFacing);
            if (spinSign < 0 && nextDelta > 0) nextDelta -= TWO_PI;
            else if (spinSign > 0 && nextDelta < 0) nextDelta += TWO_PI;
            player.turn180Delta = nextDelta;
          }
        }
      }

      if (!player.turn180Active) {
        if (!manualSprint) {
          // Turn_180 is strictly sprint-only: clear momentum & heading history when Shift is not held
          // so ordinary WASD movement / circle-spamming turns cleanly without ever firing Turn_180.
          player.runMomentumTime = 0;
          player.prevMoveDirX = 0;
          player.prevMoveDirZ = 0;
        } else {
          const prevLen = Math.hypot(player.prevMoveDirX || 0, player.prevMoveDirZ || 0);
          if (
            hasTurnInput &&
            moveSpeedNorm > 0.40 &&
            (player.runMomentumTime || 0) >= 0.12 &&
            prevLen > 0.5 &&
            (player.turn180Cooldown || 0) <= 0
          ) {
            const pDirX = player.prevMoveDirX / prevLen;
            const pDirZ = player.prevMoveDirZ / prevLen;
            const dotPrev = inDirX * pDirX + inDirZ * pDirZ;
            const velDirX = actualMoveSpeedPre > 0.1 ? player.moveVelX / actualMoveSpeedPre : pDirX;
            const velDirZ = actualMoveSpeedPre > 0.1 ? player.moveVelZ / actualMoveSpeedPre : pDirZ;
            const dotVel = inDirX * velDirX + inDirZ * velDirZ;
            const sharpDot = Math.min(dotPrev, dotVel);

            if (sharpDot < -0.72) {
              const started =
                heroModel?.handle?.triggerTurn180?.(1.85) ||
                heroModel?.obj?.userData?.triggerTurn180?.(1.85) ||
                false;
              if (started) {
                const targetAng = Math.atan2(inDirX, inDirZ);
                const rawDiff = normalizeAngle(targetAng - player.facing);
                const tState =
                  heroModel?.handle?.getTurn180State?.() ||
                  heroModel?.obj?.userData?.getTurn180State?.() ||
                  null;
                // Always match Mixamo's native right-shoulder spin sign (-1) so the de-yawed braking leg
                // stays strictly aligned along the braking axis (never kicking out sideways on +135°..+155° turns!)
                const nativeSign = tState?.turnSign || -1;
                let turnDelta = rawDiff;
                if (nativeSign < 0 && turnDelta > 0) turnDelta -= TWO_PI;
                else if (nativeSign > 0 && turnDelta < 0) turnDelta += TWO_PI;

                player.turn180Active = true;
                player.turn180StartFacing = player.facing;
                player.turn180TargetFacing = targetAng;
                player.turn180Delta = turnDelta;
                player.turn180Cooldown = 0.55;
                player.prevMoveDirX = inDirX;
                player.prevMoveDirZ = inDirZ;
                player.runMomentumTime = 0;
                if (isSoulslike) {
                  audio?.playTurnScrape?.();
                }
              }
            }
          }

          if (hasTurnInput && moveSpeedNorm > 0.35) {
            player.runMomentumTime = Math.min(1.0, (player.runMomentumTime || 0) + dt);
            if (prevLen < 0.25) {
              player.prevMoveDirX = inDirX;
              player.prevMoveDirZ = inDirZ;
            } else {
              const dirAlpha = 1 - Math.exp(-dt * 5.8);
              const nx = player.prevMoveDirX + (inDirX - player.prevMoveDirX) * dirAlpha;
              const nz = player.prevMoveDirZ + (inDirZ - player.prevMoveDirZ) * dirAlpha;
              const nLen = Math.hypot(nx, nz);
              if (nLen > 0.01) {
                player.prevMoveDirX = nx / nLen;
                player.prevMoveDirZ = nz / nLen;
              }
            }
          } else if (moveSpeedNorm < 0.20) {
            player.runMomentumTime = Math.max(0, (player.runMomentumTime || 0) - dt * 4.0);
            if (player.runMomentumTime <= 0.01) {
              player.prevMoveDirX = 0;
              player.prevMoveDirZ = 0;
            }
          }
        }
      } else if (hasTurnInput && manualSprint) {
        player.prevMoveDirX = inDirX;
        player.prevMoveDirZ = inDirZ;
      } else if (!manualSprint) {
        player.runMomentumTime = 0;
        player.prevMoveDirX = 0;
        player.prevMoveDirZ = 0;
      }
    }

    // Elden Ring Lock-On Facing vs Free Retreat Sprint:
    //   - When locked onto an enemy (`angToLocked !== null`), `player.facing` stays squarely locked toward the target
    //     during A/D lateral strafe, W forward walk/sprint, and S backpedal; ONLY when explicitly sprinting away on PC
    //     (`manualSprint && moveDotLock < -0.45`) does the Hero turn to sprint away cleanly!
    const isSprintingAwayFromLock = Boolean(
      angToLocked !== null &&
      manualSprint &&
      !isTouchFrame &&
      moveMag > 0.35 &&
      !isAttackingNow &&
      !isBlockingNow &&
      ((mx * Math.sin(angToLocked) + mz * Math.cos(angToLocked)) / moveMag) < -0.45
    );

    const targetFacing =
      soulsEscapeCutsceneActive
        ? null
        : soulsDoorCutsceneActive
        ? Math.PI
        : isSoulslike && isDashingNow
        ? Math.atan2(player.dashDirX || 0, player.dashDirZ || 1)
        : angToLocked !== null
          ? (isSprintingAwayFromLock ? Math.atan2(mx, mz) : angToLocked)
          : steeringAttackToCam
            ? null
            : engagedAimAngle !== null
              ? engagedAimAngle
              : player.attackFaceHoldTimer > 0 && Number.isFinite(player.attackAimAngle)
                ? player.attackAimAngle
                : moveMag > 0.05
                  ? Math.atan2(mx, mz)
                  : null;
    if (player.turn180Active && !isAttackingNow && !activeLocked && angToLocked === null) {
      const preTurnState =
        heroModel?.handle?.getTurn180State?.() ||
        heroModel?.obj?.userData?.getTurn180State?.() ||
        null;
      if (preTurnState && preTurnState.active) {
        player.facing = normalizeAngle(player.turn180StartFacing + player.turn180Delta * preTurnState.yawProgress01);
      } else {
        player.turn180Active = false;
      }
    } else if (targetFacing !== null) {
      const turnRate =
        isSoulslike && isDashingNow
          ? 24
          : angToLocked !== null && !isSprintingAwayFromLock
            ? 20
            : engagedAimAngle !== null || player.attackFaceHoldTimer > 0
              ? 16
              : 14.5;
      player.facing = lerpAngle(player.facing, targetFacing, 1 - Math.exp(-dt * turnRate));
    }

    if (heroModel?.obj) {
      if (soulsEscapeCutsceneActive) {
        // Hero X/Y/Z, facing, disarm & clip scrub are driven directly by applyBossEscapeCutsceneState()!
        animateEntityModel(heroModel, frameDt, false, 0, false, false, elapsedTime, 0, 1, false);
      } else {
      const heroGroundY = sampleSmoothGroundY(player, player.x, player.z, frameDt, soulsDoorCutsceneActive);
      const actualMoveSpeed = Math.hypot(player.moveVelX || 0, player.moveVelZ || 0);
      heroModel.obj.position.x = player.x;
      heroModel.obj.position.y = heroGroundY;
      heroModel.obj.position.z = player.z;
      heroModel.obj.rotation.y = player.facing;
      heroModel.obj.rotation.x = 0;
      heroModel.obj.rotation.z = 0;

      // Elden Ring Alive Stance visual breathing, weight shift, landing knee-absorb & block recoil
      // Applied purely visually to heroModel.obj in Rift (never mutates player.x/z or interferes with Roll / Turn_180 / Cutscene!)
      if (isSoulslike && !playerDying && !soulsDoorCutsceneActive) {
        const turnRateLive = normalizeAngle(player.facing - prevPlayerFacingForStance) / Math.max(dt, 0.001);
        const stanceVis = aliveStanceSmoother.step(dt, elapsedTime, {
          isBlocking: Boolean(souls.isBlocking),
          inCombat: Boolean(hasNearbyCombatThreat),
          moveSpeed: actualMoveSpeed,
          justLandedTimer: souls.justLandedTimer || 0,
          recoilAmount: souls.recoilVisual || 0,
          turnRate: turnRateLive,
          isTurning180: Boolean(player.turn180Active)
        });
        if (!isDashingNow && !player.turn180Active) {
          const rX = Math.cos(player.facing);
          const rZ = -Math.sin(player.facing);
          heroModel.obj.position.x = player.x + rX * stanceVis.weightShiftX;
          heroModel.obj.position.y = heroGroundY + stanceVis.breathBobY;
          heroModel.obj.position.z = player.z + rZ * stanceVis.weightShiftX;
          heroModel.obj.rotation.x = stanceVis.torsoLeanZ * 0.50;
          heroModel.obj.rotation.z = -stanceVis.shieldGuardTilt * 0.32;
        }
      }

      if (soulsDoorCutsceneActive) {
        animateEntityModel(
          heroModel,
          frameDt,
          Boolean(souls.cutsceneHeroWalkAnim),
          souls.cutsceneHeroWalkAnim ? 0.55 : 0,
          false,
          false,
          elapsedTime,
          0,
          1,
          false
        );
      } else {
        const strideRatio = actualMoveSpeed / 4.2;
        const faceSin = Math.sin(player.facing);
        const faceCos = Math.cos(player.facing);
        const useVelFallback = !isDashingNow && moveMag <= 0.01 && actualMoveSpeed > 0.20;
        const moveDirX = isDashingNow
          ? player.dashDirX
          : moveMag > 0.01
            ? mx / moveMag
            : useVelFallback
              ? (player.moveVelX || 0) / actualMoveSpeed
              : 0;
        const moveDirZ = isDashingNow
          ? player.dashDirZ
          : moveMag > 0.01
            ? mz / moveMag
            : useVelFallback
              ? (player.moveVelZ || 0) / actualMoveSpeed
              : 0;
        const hasMoveDir = isDashingNow || moveMag > 0.01 || useVelFallback;
        // Decompose world movement (mx, mz) into hero-local Forward (+Z: sin, cos) and Left-Strafe (+X: cos, -sin)
        // Pressing A (left) yields moveLocalX > 0 ('Strafe_Left'); pressing D (right) yields moveLocalX < 0 ('Strafe_Right').
        let moveLocalZ = hasMoveDir ? (moveDirX * faceSin + moveDirZ * faceCos) : 1;
        // During free-run steering (no lock-on, attack, or block), the Warrior always steers into
        // the movement heading — prevent brief 2-4 frame Running_Back flickers during fast WASD reversals!
        if (currentClassId === 'warrior' && !activeLocked && angToLocked === null && !isAttackingNow && !isBlockingNow) {
          moveLocalZ = Math.max(0, moveLocalZ);
        }
        const moveLocalX = hasMoveDir ? (moveDirX * faceCos - moveDirZ * faceSin) : 0;
        const lockLateralOrBack =
          angToLocked !== null &&
          !isSprintingAwayFromLock &&
          !isDashingNow &&
          (Math.abs(moveLocalX) > Math.abs(moveLocalZ) * 0.68 || moveLocalZ < -0.25);
        const isSprintingForAnim = !lockLateralOrBack && (isSprintingNow || isDashingNow);
        animateEntityModel(
          heroModel,
          dt,
          (!isSoulslike || !isAttackingNow) && (isDashingNow || moveMag > 0.05 || actualMoveSpeed > 0.25),
          strideRatio,
          player.attackAnimTimer > 0,
          beastActive,
          elapsedTime,
          moveLocalX,
          moveLocalZ,
          isSprintingForAnim
        );
      }
      // Zero-frame-lag lockstep: align root facing to the freshly stepped Turn_180 mixer yaw curve
      if (player.turn180Active && !isAttackingNow) {
        const postTurnState =
          heroModel?.handle?.getTurn180State?.() ||
          heroModel?.obj?.userData?.getTurn180State?.() ||
          null;
        if (postTurnState && postTurnState.active) {
          player.facing = normalizeAngle(player.turn180StartFacing + player.turn180Delta * postTurnState.yawProgress01);
          heroModel.obj.rotation.y = player.facing;
        } else {
          player.turn180Active = false;
          player.turn180Delta = 0;
        }
      }
      } // end !soulsEscapeCutsceneActive heroModel block
    }

    const emitHeroFootstep = (stepParity) => {
      if (soulsDoorCutsceneActive) return;
      const surface = world?.getSurfaceType?.(player.x, player.z) || 'dirt';
      audio?.playFootstep?.(currentClassId, stepParity, isSprintingNow, surface);
      if (currentClassId === 'mage') {
        const sideSign = stepParity % 2 === 0 ? -0.18 : 0.18;
        const fx = player.x + Math.cos(player.facing) * sideSign;
        const fz = player.z - Math.sin(player.facing) * sideSign;
        const elemId = stats?.mageElement || 'water';
        const stepCol =
          elemId === 'fire' ? 0xf97316 : elemId === 'lightning' ? 0xfacc15 : elemId === 'air' ? 0x5eead4 : 0x38bdf8;
        world?.spawnShockwaveRing?.({ x: fx, y: 0.035, z: fz, radius: 0.54, color: stepCol, duration: 0.30 });
        if (elemId === 'water') {
          emitParticles(fx, 0.08, fz, 0x7dd3fc, 3, 2.2, 0.07);
        }
      }
    };
    const consumeFootstep =
      heroModel?.handle?.consumeFootstepEvent || heroModel?.obj?.userData?.consumeFootstepEvent;
    if (typeof consumeFootstep === 'function') {
      const stepEv = consumeFootstep();
      if (stepEv) {
        emitHeroFootstep(stepEv.parity);
      }
      player.stepPhase = 0;
    } else if (moveMag > 0.08) {
      const clampedStepRate = Math.max(0.75, Math.min(1.65, speedRatio || 1)) * 9.4;
      const prevStepIdx = Math.floor((player.stepPhase || 0) / Math.PI);
      player.stepPhase = (player.stepPhase || 0) + dt * clampedStepRate;
      const nextStepIdx = Math.floor(player.stepPhase / Math.PI);
      if (nextStepIdx > prevStepIdx) {
        emitHeroFootstep(nextStepIdx);
      }
    } else {
      player.stepPhase = 0;
    }

    // Chapter 26 Elden Ring Active Swept Capsule Melee Tick (strictly `isSoulslike === true`, 1 hit per target per swing!)
    if (isSoulslike && souls.activeAttack) {
      if (player.hp <= 0 || playerDying) {
        souls.activeAttack = null;
        player.hasHyperArmor = false;
      } else {
        const atk = souls.activeAttack;
        const spec = atk.spec;
        const prevElapsed = atk.elapsed;
        atk.elapsed += dt;
        const activeStart = spec.startup;
        const activeEnd = spec.startup + spec.active;
        const totalDur = activeEnd + spec.recovery;

        player.hasHyperArmor = Boolean(spec.hyperarmor && atk.elapsed >= 0.06 && atk.elapsed <= activeEnd);

        if (!atk.whooshPlayed && atk.elapsed >= Math.max(0, activeStart - 0.055)) {
          atk.whooshPlayed = true;
          if (atk.wpnId === 'great_club') {
            if (atk.isHeavy || atk.comboStep === 3) {
              audio?.playBossHammerWhoosh?.(false);
            } else if (typeof audio?.playSwordSwing === 'function') {
              audio.playSwordSwing(atk.comboStep, true);
            } else {
              audio?.playMeleeSwing?.(atk.wpnId, true);
            }
          } else if (typeof audio?.playSwordSwing === 'function') {
            audio.playSwordSwing(atk.comboStep, atk.isHeavy);
          } else {
            audio?.playMeleeSwing?.(atk.wpnId, atk.isHeavy);
          }
        }

        if (!atk.vfxPlayed && atk.elapsed >= activeStart) {
          atk.vfxPlayed = true;
          const swingAim = Number.isFinite(atk.strikeAngle) ? atk.strikeAngle : player.facing;
          const fwdX = Math.sin(swingAim);
          const fwdZ = Math.cos(swingAim);
          const rightX = -Math.cos(swingAim);
          const rightZ = Math.sin(swingAim);
          const slashX = player.x + rightX * 0.16 + fwdX * 0.14;
          const slashZ = player.z + rightZ * 0.16 + fwdZ * 0.14;
          const vfxColor =
            atk.key === 'guard_counter' || atk.key === 'charged_r2'
              ? 0xfde047
              : atk.isHeavy
                ? 0xfbbf24
                : atk.wpnColor || 0xd97706;
          const baseSweep = atk.isHeavy ? 0.50 : 0.44;
          const slashOpts = {
            y: atk.comboStep === 2 ? 1.04 : atk.comboStep === 3 ? 0.98 : 0.92,
            duration: atk.isFinisher ? 0.24 : 0.18,
            sweepRad: atk.comboStep === 2 ? -baseSweep * 1.15 : atk.comboStep === 3 ? baseSweep * 1.25 : baseSweep
          };
          if (atk.wpnId !== 'great_club' && (atk.isHeavy || atk.key === 'guard_counter')) {
            if (atk.isFinisher) {
              emitShockwave(slashX + fwdX * 1.1, slashZ + fwdZ * 1.1, Math.min(2.6, atk.range * 0.78), 0xfbbf24, 0.28);
              emitParticles(slashX + fwdX * 0.72, 0.92, slashZ + fwdZ * 0.72, 0xfde047, 10, 6.2, 0.14);
              world?.addScreenShake?.(0.15, 0.10);
            }
          }
          atk.prevSeg =
            heroModel?.handle?.getWeaponSegmentWorld?.() ||
            heroModel?.obj?.userData?.getWeaponSegmentWorld?.() ||
            null;
        }

        // Elden Ring Great Club overhead earth-slam impact (Club_Attack_3 / R2 / Charged R2 / Guard Counter):
        // Trigger grounded blunt thud + earthy dust burst right when the massive timber head strikes the ground!
        if (
          atk.wpnId === 'great_club' &&
          !atk.clubSlamFired &&
          (atk.isHeavy || atk.comboStep === 3) &&
          atk.elapsed >= activeStart + spec.active * 0.62
        ) {
          atk.clubSlamFired = true;
          const slamAim = Number.isFinite(atk.strikeAngle) ? atk.strikeAngle : player.facing;
          const slamX = player.x + Math.sin(slamAim) * 1.28;
          const slamZ = player.z + Math.cos(slamAim) * 1.28;
          const slamGroundY = sampleSmoothGroundY(player, slamX, slamZ, 0, true);
          audio?.playBossHammerGround?.(atk.key === 'charged_r2' ? 0.62 : 0.44);
          emitParticles(slamX, slamGroundY + 0.16, slamZ, 0xb8a894, 15, 5.2, 0.14);
          emitParticles(slamX, slamGroundY + 0.24, slamZ, 0x6b4d35, 8, 3.8, 0.11);
          world?.addScreenShake?.(atk.key === 'charged_r2' ? 0.24 : 0.18, 0.14);
        }

        // Active hitbox window: test swept blade capsule across [startup, startup + active]
        if (atk.elapsed >= activeStart && prevElapsed <= activeEnd) {
          // Smash interactive wooden barrels & cargo crates on the Exterior Shore during active weapon swing!
          if (souls.zoneMode === 'exterior_shore') {
            const propAim = Number.isFinite(atk.strikeAngle) ? atk.strikeAngle : player.facing;
            const hitCenterDist = Math.min(1.65, (atk.range || 2.2) * 0.58);
            const propHitX = player.x + Math.sin(propAim) * hitCenterDist;
            const propHitZ = player.z + Math.cos(propAim) * hitCenterDist;
            const propHitRad = Math.max(1.25, (atk.range || 2.2) * 0.52);
            const smashed = world?.hitShoreDestructibles?.(propHitX, propHitZ, propHitRad);
            if (smashed && smashed.count > 0) {
              for (let bi = 0; bi < smashed.hits.length; bi++) {
                const bh = smashed.hits[bi];
                emitParticles(bh.x, bh.y, bh.z, 0xa8865f, 18, 5.2, 0.14);
                emitParticles(bh.x, bh.y + 0.18, bh.z, 0x5c4632, 10, 3.6, 0.11);
              }
              audio?.playBossHammerHit?.(0.52);
              world?.addScreenShake?.(0.13, 0.10);
            }
          }
          const curSeg =
            heroModel?.handle?.getWeaponSegmentWorld?.() ||
            heroModel?.obj?.userData?.getWeaponSegmentWorld?.() ||
            null;
          const newlyHit = testSweptBladeHits({
            prevSeg: atk.prevSeg,
            curSeg,
            radius: 0.44,
            fallbackOriginX: player.x,
            fallbackOriginZ: player.z,
            strikeAngle: Number.isFinite(atk.strikeAngle) ? atk.strikeAngle : player.facing,
            range: atk.range,
            coneHalfRad: atk.coneHalfRad,
            enemies,
            hitUids: atk.hitUids,
            subSteps: 3
          });
          atk.prevSeg = curSeg;

          for (let hi = 0; hi < newlyHit.length; hi++) {
            const hitE = newlyHit[hi];
            if (!hitE || hitE.hp <= 0) continue;
            const hdx = hitE.x - player.x;
            const hdz = hitE.z - player.z;
            const hDist = Math.hypot(hdx, hdz) || 1;
            const hnx = hdx / hDist;
            const hnz = hdz / hDist;
            const kbForce = (stats.knockback || 5.2) * (atk.isHeavy ? 1.25 : 0.95);
            const isThrustHit = atk.key === 'r2' || atk.key === 'charged_r2';
            applyDamageToEnemy(hitE, 0, hnx * kbForce, hnz * kbForce, true, {
              soulsPipeline: true,
              baseAR: stats.damage,
              motionValue: spec.mv,
              stanceDmg: spec.stanceDmg,
              isPierce: Boolean(spec.isPierce || isThrustHit || currentWeaponId === 'spear'),
              isHeavy: atk.isHeavy,
              isComboFinisher: atk.isFinisher,
              attackKey: atk.key,
              weaponId: atk.wpnId
            });
            const pull = Math.min(hitE.isBoss ? 1.15 : 0.32, (hitE.radius || 0.45) * 0.65);
            const sparkKind =
              atk.key === 'guard_counter'
                ? 'guard_counter'
                : isThrustHit
                  ? 'heavy_thrust'
                  : 'sword_armor';
            emitSoulsSparkBurst(sparkKind, hitE.x - hnx * pull, hitE.z - hnz * pull, hnx, hnz);
            const hitstopDur =
              atk.key === 'charged_r2'
                ? soulsGameFeel.HITSTOP_PRESETS.riposte
                : isThrustHit || atk.key === 'guard_counter'
                  ? soulsGameFeel.HITSTOP_PRESETS.r2
                  : (spec.hitstop || soulsGameFeel.HITSTOP_PRESETS.r1);
            triggerHitStop(hitstopDur, atk.key === 'charged_r2' || atk.key === 'guard_counter');
            if (atk.isHeavy) {
              world?.addScreenShake?.(0.16, 0.10);
            }
          }
        }

        // Subtle monochrome air-shear ribbon strictly during active blade flight (zero yellow super-strike, zero air sparks!)
        if (weaponTrails) {
          const trailStart = Math.max(0, activeStart - 0.015);
          const trailEnd = activeEnd + 0.045;
          if (atk.elapsed >= trailStart && atk.elapsed <= trailEnd) {
            const trailSeg =
              heroModel?.handle?.getWeaponSegmentWorld?.() ||
              heroModel?.obj?.userData?.getWeaponSegmentWorld?.() ||
              null;
            if (trailSeg) {
              weaponTrails.recordWeaponSegment('hero', trailSeg, 'hero_steel');
              heroTrailRecording = true;
            }
          } else if (heroTrailRecording) {
            weaponTrails.endSwing('hero');
            heroTrailRecording = false;
          }
        }

        if (atk.elapsed >= totalDur) {
          souls.activeAttack = null;
          player.hasHyperArmor = false;
          if (heroTrailRecording) {
            weaponTrails?.endSwing?.('hero');
            heroTrailRecording = false;
          }
        }
      }
    } else if (isSoulslike) {
      player.hasHyperArmor = false;
      if (heroTrailRecording) {
        weaponTrails?.endSwing?.('hero');
        heroTrailRecording = false;
      }
    }

    // Tick delayed Warrior melee strikes in exact lockstep with the animation mixer (PvE)
    if (pendingMeleeStrikes.length > 0) {
      if (beastActive || player.hp <= 0) {
        pendingMeleeStrikes.length = 0;
      } else {
        for (let si = pendingMeleeStrikes.length - 1; si >= 0; si--) {
          const st = pendingMeleeStrikes[si];
          st.elapsed = (st.elapsed || 0) + dt;
          st.whooshTimer -= dt;
          if (!st.whooshPlayed && st.whooshTimer <= 0) {
            st.whooshPlayed = true;
            audio?.playMeleeSwing?.(st.wpnId, st.isCritSwing);
          }
          st.timer -= dt;
          if (st.timer <= 0) {
            pendingMeleeStrikes.splice(si, 1);
            resolvePendingMeleeStrike(st);
          }
        }
      }
    }

    // 3. Companion AI (Mini Skeleton Squire)
    if (companion) {
      if (companion.boostTimer > 0) companion.boostTimer = Math.max(0, companion.boostTimer - dt);
      companion.orbitAngle += dt * 1.35;
      const desiredX = player.x + Math.cos(companion.orbitAngle) * 2.15;
      const desiredZ = player.z + Math.sin(companion.orbitAngle) * 2.15;
      companion.x += (desiredX - companion.x) * Math.min(1, dt * 7.5);
      companion.z += (desiredZ - companion.z) * Math.min(1, dt * 7.5);

      companion.shootCooldown -= dt;
      let compTarget = null;
      let compBestDistSq = 13.5 * 13.5;
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (e.hp <= 0) continue;
        if (world?.isWorldPointVisible && !world.isWorldPointVisible(e.x, e.z, 0.85, 0.94)) continue;
        const dSq = (e.x - companion.x) ** 2 + (e.z - companion.z) ** 2;
        if (dSq < compBestDistSq) {
          compBestDistSq = dSq;
          compTarget = e;
        }
      }

      if (compTarget) {
        companion.facing = Math.atan2(compTarget.x - companion.x, compTarget.z - companion.z);
        if (companion.shootCooldown <= 0) {
          companion.shootCooldown = companion.boostTimer > 0 ? 0.32 : 0.54;
          triggerModelAttack(companion.model);
          spawnProjectile({
            x: companion.x,
            z: companion.z,
            vx: Math.sin(companion.facing) * 24,
            vz: Math.cos(companion.facing) * 24,
            damage: Math.max(8, Math.round(stats.damage * (companion.boostTimer > 0 ? 0.65 : 0.48))),
            maxDist: 14.5,
            pierce: 1,
            splashRadius: 0,
            knockback: 2.2,
            kind: 'bullet',
            visualType: 'buckshot',
            color: 0x38bdf8,
            isEnemy: false
          });
        }
      } else if (moveMag > 0.05) {
        companion.facing = lerpAngle(companion.facing, player.facing, dt * 8);
      }

      companion.model.obj.position.x = companion.x;
      companion.model.obj.position.z = companion.z;
      companion.model.obj.rotation.y = companion.facing;
      animateEntityModel(companion.model, dt, moveMag > 0.05, speedRatio, false, false, elapsedTime);
    }

    // 4. Kill-Quota / Endless Wave Spawner, Explosive Barrels, Relic Crate & Bosses!
    // Peaceful map-inspection mode — enabled from the debug API (`startFreeRoam`).
    const TEMP_PEACEFUL_MAP_INSPECT = freeRoamMode || isSoulslike;
    if (!TEMP_PEACEFUL_MAP_INSPECT) {
      // Periodic interactive explosive barrel respawn (1 every ~22s, max 4 active on arena)
      barrelRespawnTimer -= dt;
      if (barrelRespawnTimer <= 0) {
        barrelRespawnTimer = 22.0;
        spawnExplosiveBarrel();
      }

      if (isEndless) {
        // Endless / Survival Mode: waves escalate every 25s, alternating Mini-Boss & Act Boss every 45s!
        const nextEndlessWave = Math.floor(elapsedRunTime / 25) + 1;
        if (nextEndlessWave > endlessWave) {
          endlessWave = nextEndlessWave;
          notifyDailyProgress('bosses_waves', 1);
          const waveGold = Math.round((8 + endlessWave * 3) * (stats?.goldMult || 1));
          progression.addGold(waveGold);
          goldRun += waveGold;
          audio?.playPickup?.('gold');
          floatText(`♾️ ВОЛНА ${endlessWave}! +${waveGold} 💰`, player.x, player.z - 1.1, '#fbbf24');
        }

        cursedChestTimer -= dt;
        if (cursedChestTimer <= 0) {
          cursedChestTimer = 65.0;
          spawnCursedChest();
        }

        endlessBossTimer -= dt;
        if (endlessBossTimer <= 0) {
          endlessBossTimer = 45.0;
          spawnEndlessBoss();
        }

        timeLeft = Math.floor(elapsedRunTime);
        spawnTimer -= dt;
        if (enemies.length <= 3 && spawnTimer > 0.55) {
          spawnTimer = 0.55;
        }
        if (spawnTimer <= 0) {
          spawnTimer = Math.max(2.3, 5.2 - (endlessWave - 1) * 0.24);
          spawnWavePack();
        }
      } else {
        if (!cursedChestSpawnedThisStage && currentLevelNumber >= 2 && !finaleStarted) {
          cursedChestTimer -= dt;
          if (cursedChestTimer <= 0) {
            cursedChestSpawnedThisStage = true;
            spawnCursedChest();
          }
        }

        if (!relicCrateSpawned && currentLevelDef.unlockWeaponTier && (kills >= Math.max(8, Math.floor(targetKills * 0.28)) || elapsedRunTime >= 18.0)) {
          relicCrateSpawned = true;
          spawnRelicWeaponEvent();
        }

        // Stage Mid-Run Mini-Boss: appears midway BEFORE the timed Boss on Boss chapters (5,10,15,20,25)!
        if (
          !midMiniBossSpawned &&
          !finaleStarted &&
          currentLevelDef.hasBoss &&
          (currentLevelDef.finaleMiniBossType || currentLevelDef.miniBossPool?.length > 0) &&
          (kills >= Math.floor(targetKills * 0.45) || (bossSpawnCountdown > 0 && bossSpawnCountdown <= (currentLevelDef.bossSpawnTimerSec || 45) * 0.55))
        ) {
          midMiniBossSpawned = true;
          spawnMiniBossFromPool(false);
        }

        // Boss chapters (5,10,15,20,25): timed Boss Arrival countdown EVEN IF horde/mini-boss remain; Non-Boss chapters: trigger at targetKills!
        if (!finaleStarted) {
          if (currentLevelDef.hasBoss) {
            bossSpawnCountdown = Math.max(0, bossSpawnCountdown - dt);
            if (bossSpawnCountdown <= 0 || kills >= targetKills) {
              timeLeft = 0;
              startWaveFinale();
            } else {
              timeLeft = Math.ceil(bossSpawnCountdown);
            }
          } else if (kills >= targetKills) {
            timeLeft = 0;
            startWaveFinale();
          } else {
            timeLeft = Math.max(1, targetKills - kills);
          }
        }

        // Minigore-2 Wave Pacing: Distinct rhythmic horde waves that stop strictly once targetKills quota is fulfilled or spawned!
        if (kills < targetKills && regularMobsSpawned < targetKills) {
          spawnTimer -= dt;
          if (!finaleStarted && enemies.length <= 2 && spawnTimer > 0.55) {
            spawnTimer = 0.55;
          }
          if (spawnTimer <= 0) {
            const timeRamp = clamp(elapsedRunTime / 60, 0, 1);
            const baseWaveGap = finaleStarted ? 9.5 : 6.4 - timeRamp * 1.65;
            spawnTimer = Math.max(4.2, baseWaveGap * clamp(currentLevelDef.spawnInterval || 1, 0.72, 1.12));
            spawnWavePack();
          }
        }
      }
    }

    // 4B. Update Dash Fire Trail AoE Patches (dash_fire_trail perk!)
    for (let fi = fireTrailPatches.length - 1; fi >= 0; fi--) {
      const fp = fireTrailPatches[fi];
      fp.timer -= dt;
      if (fp.timer <= 0) {
        fireTrailPatches.splice(fi, 1);
        continue;
      }
      fp.tickAccum += dt;
      if (fp.tickAccum >= 0.35) {
        fp.tickAccum = 0;
        for (let ei = enemies.length - 1; ei >= 0; ei--) {
          const e = enemies[ei];
          if (!e || e.hp <= 0) continue;
          if (Math.hypot(e.x - fp.x, e.z - fp.z) <= fp.radius + (e.radius || 0.45)) {
            applyDamageToEnemy(e, fp.tickDmg, 0, 0, false, { isDoT: true, isSplash: true });
            emitParticles(e.x, 0.45, e.z, 0xf97316, 2, 2.4, 0.10);
          }
        }
      }
    }

    // 50. Update Dying Skeleton Corpses (Elden Ring 3.20s Collapse + Ash Dissolve in Rift; PvE 0.66s sink)
    for (let ci = dyingCorpses.length - 1; ci >= 0; ci--) {
      const dc = dyingCorpses[ci];
      dc.age += dt;
      if (dc.age >= dc.duration) {
        if (dc.isSoulsBoss && dc.model?.obj) {
          disposeSoulsBossVisuals(dc.model.obj);
        }
        removeSceneObject(dc.model.obj, dc.model.handle);
        dyingCorpses.splice(ci, 1);
        continue;
      }
      if (dc.isSoulslikeCorpse) {
        const cDur = dc.collapseDur || 1.75;
        if (dc.age < cDur) {
          dc.model.handle?.updateDying?.(dt, 0, 0);
        } else {
          const dissolve01 = clamp((dc.age - cDur) / Math.max(0.4, dc.duration - cDur), 0, 1);
          dc.model.handle?.updateDying?.(dt, 0, dissolve01);
          dc.ashAccum = (dc.ashAccum || 0) + dt;
          if (dc.ashAccum >= 0.055) {
            dc.ashAccum = 0;
            dissolveAsh?.emitCorpseAsh?.(dc.x, 0.25, dc.z, (dc.radius || 0.75) * 1.15, 1.5);
          }
        }
      } else {
        const sink = dc.age > dc.duration * 0.72 ? (dc.age - dc.duration * 0.72) / (dc.duration * 0.28) : 0;
        dc.model.handle?.updateDying?.(dt, sink);
      }
    }

    // 50B. Update Water Mage's 7% Spherical Water Prisons (1.1s Mid-Air Suspension -> Slam Down for 3x Normal Attack Damage!)
    for (let wpi = activeWaterPrisons.length - 1; wpi >= 0; wpi--) {
      const wp = activeWaterPrisons[wpi];
      wp.timer -= dt;
      if (wp.timer > 0) {
        // Also snare any enemy that walks into the floating water sphere while it's active!
        for (let ei = 0; ei < enemies.length; ei++) {
          const cand = enemies[ei];
          if (!cand || cand.hp <= 0 || wp.targets.includes(cand)) continue;
          if (Math.hypot(cand.x - wp.x, cand.z - wp.z) <= wp.radius) {
            cand.waterLiftTimer = wp.timer;
            cand.stunTimer = Math.max(cand.stunTimer || 0, wp.timer + 0.1);
            wp.targets.push(cand);
          }
        }
        for (let ti = 0; ti < wp.targets.length; ti++) {
          const te = wp.targets[ti];
          if (!te || te.hp <= 0) continue;
          te.waterLiftTimer = Math.max(te.waterLiftTimer || 0, wp.timer);
          te.stunTimer = Math.max(te.stunTimer || 0, wp.timer + 0.08);
          // Pull firmly inside the suspended 3D water sphere!
          const orbitOffX = Math.cos(ti * 2.1 + elapsedTime * 3.2) * 0.42;
          const orbitOffZ = Math.sin(ti * 2.1 + elapsedTime * 3.2) * 0.42;
          te.x += (wp.x + orbitOffX - te.x) * Math.min(1, dt * 11.0);
          te.z += (wp.z + orbitOffZ - te.z) * Math.min(1, dt * 11.0);
          te.vx = 0;
          te.vz = 0;
        }
      } else {
        audio?.playElementImpact?.('water_prison_slam');
        world?.addScreenShake?.(0.36, 0.18);
        emitParticles(wp.x, 0.55, wp.z, 0x38bdf8, 24, 8.2, 0.19);
        emitParticles(wp.x, 0.45, wp.z, 0xe0f2fe, 12, 6.0, 0.15);
        for (let ti = 0; ti < wp.targets.length; ti++) {
          const te = wp.targets[ti];
          if (!te || te.hp <= 0) continue;
          te.waterLiftTimer = 0;
          if (te.model?.obj) {
            te.model.obj.position.y = 0;
            te.model.obj.rotation.x = 0;
            te.model.obj.rotation.z = 0;
          }
          floatText(`🌊 ×3! -${wp.slamDamage}`, te.x, te.z, '#38bdf8');
          applyDamageToEnemy(te, wp.slamDamage, 0, 0, false, {
            isWaterSlam: true,
            isSplash: true,
            mageElement: 'water'
          });
        }
        activeWaterPrisons.splice(wpi, 1);
      }
    }

    // 5A. Boss Ground Hazards Update (Phase 2 Molten Fissures & Volcanic Aftershocks!)
    for (let i = bossHazards.length - 1; i >= 0; i--) {
      const hz = bossHazards[i];
      hz.timer -= dt;
      // Rising lava-crack ember telegraph while armed (zero ugly flat red circles — pure volcanic sparks & heat shimmer!)
      if (hz.timer > 0 && (hz.isAshFissure || hz.isAftershock)) {
        const rate = hz.isAftershock ? 36 : 28;
        if (Math.random() < dt * rate) {
          const ang = Math.random() * TWO_PI;
          const rSpread = Math.sqrt(Math.random()) * Math.max(0.8, (hz.radius || 2.8) * 0.78);
          emitParticles(
            hz.x + Math.cos(ang) * rSpread,
            0.14,
            hz.z + Math.sin(ang) * rSpread,
            Math.random() < 0.45 ? 0xfde047 : 0xf97316,
            1,
            2.8,
            0.14
          );
        }
      }
      if (hz.timer <= 0) {
        const hzColor = hz.color || 0xf97316;
        const hzDmg = hz.damage || Math.round(28 * (currentLevelDef.dmgScale || 1));
        bossHazards.splice(i, 1);

        emitShockwave(hz.x, hz.z, hz.radius, hzColor, 0.36);
        if (hz.isAshFissure || hz.isAftershock) {
          const isCircleField = hz.shape === 'circle' || Boolean(hz.isAftershock && !hz.isAshFissure);
          const burnShape = isCircleField ? 'circle' : 'line';
          const burnKind = isCircleField ? 'circle' : 'fissure';
          const rawBurnDur = Number(hz.duration) > 0 ? Number(hz.duration) : 3.8;
          const burnDur = isCircleField ? Math.min(rawBurnDur, 1.0) : rawBurnDur;
          world?.spawnBossGroundFracture?.({
            x: hz.x,
            z: hz.z,
            radius: hz.radius,
            molten: true,
            burning: true,
            fissure: !isCircleField,
            kind: burnKind,
            dirX: hz.dirX || 0,
            dirZ: hz.dirZ || 1,
            duration: burnDur
          });
          activeBurningZones.push({
            x: hz.x,
            z: hz.z,
            radius: hz.radius * 0.92,
            remaining: burnDur,
            life: burnDur,
            shape: burnShape,
            kind: burnKind,
            sourceEnemy: hz.sourceEnemy || null
          });
          if (activeBurningZones.length > 24) {
            activeBurningZones.shift();
          }
          emitShockwave(hz.x, hz.z, hz.radius * 0.58, 0xfde047, 0.24);
          emitParticles(hz.x, 0.42, hz.z, 0xf97316, 22, 8.2, 0.17);
          emitParticles(hz.x, 0.25, hz.z, 0xd6d3d1, 12, 5.2, 0.14);
          if (typeof audio?.playBossHammerGround === 'function') {
            audio.playBossHammerGround();
          } else {
            audio?.playExplosion?.();
          }
          world?.addScreenShake?.(hz.isAftershock ? 0.42 : 0.28, 0.20);
        } else {
          emitParticles(hz.x, 0.5, hz.z, hzColor, 20, 7.2, 0.2);
          audio?.playExplosion?.();
          world?.addScreenShake?.(0.32, 0.2);
        }

        const pDist = Math.hypot(player.x - hz.x, player.z - hz.z);
        const minSafe = Number(hz.innerSafeRadius) || 0;
        if (pDist <= hz.radius + player.radius * 0.48 && pDist >= minSafe) {
          applyDamageToPlayer(
            hzDmg,
            hz.sourceEnemy || { x: hz.x, z: hz.z, isBoss: true },
            hz.attackMeta || { staminaDamage: 52, damageLevel: 'heavy', canParry: false, label: hz.label || 'Ash_Fissure' }
          );
        }
      }
    }

    // 5A-2. Persistent Burning Fire Circle (1.0s max) & Fire Road (3.8s) DoT Zones
    player._groundBurnTickCd = Math.max(0, (player._groundBurnTickCd || 0) - dt);
    if (activeBurningZones.length > 0) {
      const canBurnPlayer =
        player.hp > 0 &&
        !playerDying &&
        player.dashInvulnTimer <= 0 &&
        (player.beastTimeLeft || 0) <= 0 &&
        !(isSoulslike && souls.activeRiposte) &&
        !soulsDoorCutsceneActive &&
        !freeRoamMode &&
        !runEnded &&
        !pendingVictoryPayload;
      for (let bzi = activeBurningZones.length - 1; bzi >= 0; bzi--) {
        const bz = activeBurningZones[bzi];
        if (!bz) {
          activeBurningZones.splice(bzi, 1);
          continue;
        }
        if ((bz.shape === 'circle' || bz.kind === 'circle') && bz.remaining > 1.0) {
          bz.remaining = 1.0;
        }
        bz.remaining -= dt;
        bz.life = bz.remaining;
        if (bz.remaining <= 0) {
          activeBurningZones.splice(bzi, 1);
          continue;
        }
        if (
          canBurnPlayer &&
          bz.remaining > 0.35 &&
          player._groundBurnTickCd <= 0 &&
          Math.hypot(player.x - bz.x, player.z - bz.z) <= bz.radius + (player.radius || 0.58) * 0.35
        ) {
          player._groundBurnTickCd = 0.55;
          applyDamageToPlayer(
            13,
            bz.sourceEnemy || { x: bz.x, z: bz.z, isBoss: true },
            { canBlock: false, canParry: false, parryable: false, unblockable: true, damageLevel: 'burn_dot', isBurnDoT: true }
          );
        }
      }
    }

    // 5B. Toxic Slime / Bomber Hazards Update (Hurts player AND blasts nearby enemies for chain reactions!)
    for (let i = bomberHazards.length - 1; i >= 0; i--) {
      const bh = bomberHazards[i];
      if (!bh) continue;
      bh.timer -= dt;
      if (bh.timer <= 0) {
        bomberHazards.splice(i, 1);

        const bhColor = bh.color || 0x22c55e;
        audio?.playExplosion?.();
        world?.addScreenShake?.(0.45, 0.24);
        emitShockwave(bh.x, bh.z, bh.radius, bhColor, 0.38);
        emitParticles(bh.x, 0.6, bh.z, bhColor, 24, 8.2, 0.20);

        const pDist = Math.hypot(player.x - bh.x, player.z - bh.z);
        if (pDist <= bh.radius + player.radius * 0.45) {
          applyDamageToPlayer(bh.playerDamage, { x: bh.x, z: bh.z });
        }
        damageEnemiesInRadius(bh.x, bh.z, bh.radius, bh.enemyDamage, 10.5, null, false);
      }
    }

    // 6. Projectiles Update (Includes Shotgun Distance Falloff & Shieldbearer Directional Metadata!)
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const proj = projectiles[i];
      const stepX = proj.vx * dt;
      const stepZ = proj.vz * dt;
      const stepLen = Math.hypot(stepX, stepZ);
      proj.x += stepX;
      proj.z += stepZ;
      proj.traveled += stepLen;
      proj.vis.obj.position.set(proj.x, 0.72, proj.z);

      if (proj.kind === 'magic') {
        if (proj.mageElement !== 'water') {
          proj.vis.obj.rotation.y += dt * 8;
        }
        proj.trailTick += dt;
        if (proj.trailTick >= 0.055) {
          proj.trailTick = 0;
          emitParticles(proj.x, 0.72, proj.z, proj.color, 1, 1.4, 0.1);
        }
      }

      let removeProj = false;

      if (Math.abs(proj.x) > ARENA_HALF_SIZE || Math.abs(proj.z) > ARENA_HALF_SIZE) {
        removeProj = true;
      } else if (!proj.isEnemy && !stats?.clampToArenaBounds && world?.isWorldPointVisible && !world.isWorldPointVisible(proj.x, proj.z, 0.72, 1.04)) {
        removeProj = true;
      } else if (Array.isArray(world?.obstacles)) {
        for (let o = 0; o < world.obstacles.length; o++) {
          const obs = world.obstacles[o];
          if (!obs) continue;
          const ox = obs.x ?? obs.position?.x ?? 0;
          const oz = obs.z ?? obs.position?.z ?? 0;
          if (obs.halfW !== undefined || obs.halfD !== undefined || obs.width !== undefined) {
            const hw = obs.halfW ?? (obs.width !== undefined ? obs.width * 0.5 : (obs.halfD ?? 0.85));
            const hd = obs.halfD ?? (obs.depth !== undefined ? obs.depth * 0.5 : hw);
            if (Math.abs(proj.x - ox) < hw && Math.abs(proj.z - oz) < hd) {
              removeProj = true;
              break;
            }
          } else {
            const orad = obs.radius ?? obs.r ?? 0.85;
            if ((proj.x - ox) ** 2 + (proj.z - oz) ** 2 < orad * orad) {
              removeProj = true;
              break;
            }
          }
        }
      }

      if (!removeProj && proj.isEnemy) {
        const dPlayer = Math.hypot(proj.x - player.x, proj.z - player.z);
        if (dPlayer <= player.radius + 0.32) {
          const projMeta = proj.attackMeta || {
            canParry: false,
            parryable: false,
            staminaDamage: Math.max(18, Math.round(proj.damage * 0.9)),
            damageLevel: 'light'
          };
          applyDamageToPlayer(proj.damage, { x: proj.x - proj.vx * 0.1, z: proj.z - proj.vz * 0.1 }, projMeta);
          removeProj = true;
        }
      } else if (!removeProj && !proj.isEnemy) {
        for (let eIdx = enemies.length - 1; eIdx >= 0; eIdx--) {
          const e = enemies[eIdx];
          if (!e || e.hp <= 0 || proj.hitUids.has(e.uid)) continue;
          const dx = e.x - proj.x;
          const dz = e.z - proj.z;
          if (dx * dx + dz * dz <= (e.radius + 0.36) ** 2) {
            proj.hitUids.add(e.uid);
            const pSpd = Math.hypot(proj.vx, proj.vz) || 1;
            const pDirX = proj.vx / pSpd;
            const pDirZ = proj.vz / pSpd;

            // Shotgun Distance Falloff: <= 4.2m deals 100% (6 pellets = -10% vs Colt); tapers to 60% at max range!
            let falloffMult = 1.0;
            let knockMult = 1.0;
            if (proj.isShotgunPellet) {
              if (proj.traveled <= 4.2) {
                falloffMult = 1.0;
                knockMult = 1.15;
              } else {
                const t = clamp((proj.traveled - 4.2) / Math.max(0.5, proj.maxDist - 4.2), 0, 1);
                falloffMult = 1.0 + (0.60 - 1.0) * t;
                knockMult = 1.0 - 0.35 * t;
              }
            }

            const decayArr = proj.pierceDecay;
            const decayMult = Array.isArray(decayArr)
              ? (decayArr[Math.min(proj.hitsLanded || 0, decayArr.length - 1)] ?? decayArr[decayArr.length - 1] ?? 1.0)
              : 1.0;
            proj.hitsLanded = (proj.hitsLanded || 0) + 1;

            const critMult = proj.isCrit ? stats?.critMult || 1.75 : 1.0;
            const hitDamage = Math.max(1, Math.round(proj.damage * falloffMult * decayMult * critMult));
            const kx = pDirX * proj.knockback * knockMult;
            const kz = pDirZ * proj.knockback * knockMult;

            applyDamageToEnemy(e, hitDamage, kx, kz, true, {
              isProjectile: true,
              isShotgunPellet: proj.isShotgunPellet,
              isCrit: proj.isCrit,
              mageElement: proj.mageElement,
              traveled: proj.traveled,
              dirX: pDirX,
              dirZ: pDirZ
            });

            if (proj.mageElement === 'air') {
              // 🌪️ Air: Tight small wind-vortex splash (1.85m — smaller than Lightning chain reach, NO flat ground ring!)
              const catAir = stats?.mageCatalystStacks || 0;
              world?.spawnElementalImpact?.({ element: 'air', x: proj.x, z: proj.z, radius: 1.85 });
              damageEnemiesInRadius(
                proj.x,
                proj.z,
                1.85,
                Math.max(2, Math.round(hitDamage * (0.28 + catAir * 0.20))),
                proj.knockback * 0.72,
                e,
                false,
                'air'
              );
            } else if (proj.kind === 'magic') {
              if (proj.mageElement === 'water') {
                // Crown splash of water droplets & foam matching 00:03 of Water_mage_shooting_projectile!
                emitParticles(proj.x, 0.68, proj.z, 0x38bdf8, 13, 6.4, 0.16);
                emitParticles(proj.x, 0.76, proj.z, 0xe0faff, 7, 4.9, 0.12);
              } else {
                emitParticles(proj.x, 0.78, proj.z, proj.color, 8, 4.6, 0.15);
              }
            } else if (proj.splashRadius > 0) {
              const sRad = proj.splashRadius || 2.2;
              emitShockwave(proj.x, proj.z, sRad, proj.color, 0.28);
              emitParticles(proj.x, 0.72, proj.z, proj.color, 8, 5.4, 0.15);
              damageEnemiesInRadius(proj.x, proj.z, sRad, Math.round(hitDamage * 0.55), proj.knockback * 0.7, e, false);
            }

            proj.pierceLeft -= 1;
            if (proj.pierceLeft <= 0) {
              removeProj = true;
              break;
            }
          }
        }

        // Hit shootable crates & interactive explosive barrels
        if (!removeProj) {
          for (let pIdx = pickups.length - 1; pIdx >= 0; pIdx--) {
            const p = pickups[pIdx];
            if (!p || p.hp <= 0 || p.uid === proj.ignoreCrateUid) continue;
            if (
              p.type !== 'relic_weapon_crate' &&
              p.type !== 'supply_crate' &&
              p.type !== 'mimic_disguise' &&
              p.type !== 'explosive_barrel' &&
              p.type !== 'cursed_chest'
            ) continue;
            const dSq = (p.x - proj.x) ** 2 + (p.z - proj.z) ** 2;
            if (dSq <= (p.radius + 0.3) ** 2) {
              hitCrate(p);
              if (p.hp <= 0) {
                removePickup(p, pIdx);
              }
              removeProj = true;
              break;
            }
          }
        }
      }

      if (!removeProj && proj.traveled >= proj.maxDist) {
        if (!proj.isEnemy && proj.kind === 'magic' && proj.splashRadius > 0) {
          emitShockwave(proj.x, proj.z, proj.splashRadius, proj.color, 0.26);
          emitParticles(proj.x, 0.65, proj.z, proj.color, 9, 4.5, 0.14);
          damageEnemiesInRadius(
            proj.x,
            proj.z,
            proj.splashRadius,
            Math.round(proj.damage * 0.65),
            proj.knockback * 0.6,
            null,
            false
          );
        }
        removeProj = true;
      }

      if (removeProj) {
        removeSceneObject(proj.vis.obj, proj.vis.handle);
        projectiles.splice(i, 1);
      }
    }

    // 7. 9-Archetype Enemies & Bosses AI, Burn/Frost Ticks, Separation & Contact
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (!e || e.hp <= 0) {
        if (e && !e._corpseTransferred) {
          if (e.isSoulsBoss && e.model?.obj) disposeSoulsBossVisuals(e.model.obj);
          removeSceneObject(e.model.obj, e.model.handle);
        }
        enemies.splice(i, 1);
        continue;
      }

      if (e.contactCooldown > 0) e.contactCooldown = Math.max(0, e.contactCooldown - dt);
      if (e.trampleCooldown > 0) e.trampleCooldown = Math.max(0, e.trampleCooldown - dt);
      if (e.stunTimer > 0) e.stunTimer = Math.max(0, e.stunTimer - dt);
      if (e.disarmTimer > 0) {
        e.disarmTimer = Math.max(0, e.disarmTimer - dt);
        e.meleeCooldown = Math.max(e.meleeCooldown || 0, 0.15);
        e.cloakAttackTimer = Math.max(e.cloakAttackTimer || 0, 0.15);
        e.shootCooldown = Math.max(e.shootCooldown || 0, 0.15);
        e.windupTimer = 0;
      }
      if (e.frostTimer > 0) e.frostTimer = Math.max(0, e.frostTimer - dt);
      if (e.soakedTimer > 0) e.soakedTimer = Math.max(0, e.soakedTimer - dt);
      if (e.waterLiftTimer > 0) e.waterLiftTimer = Math.max(0, e.waterLiftTimer - dt);
      if (e.napalmTimer > 0) {
        e.napalmTimer = Math.max(0, e.napalmTimer - dt);
        if (e.napalmTimer <= 0) e.napalmStacks = 0;
      }

      // 🔥 Visible continuous Fire Burn DoT flames on burning enemies!
      if (e.burnTimer > 0 && e.burnDps > 0) {
        e.burnTimer = Math.max(0, e.burnTimer - dt);
        e.fireVfxTick = (e.fireVfxTick || 0) + dt;
        if (e.fireVfxTick >= 0.18) {
          e.fireVfxTick = 0;
          emitParticles(e.x + (Math.random() - 0.5) * 0.35, 0.65, e.z + (Math.random() - 0.5) * 0.35, Math.random() < 0.5 ? 0xff5722 : 0xfef08a, 2, 2.2, 0.13);
        }
        e.burnTickTimer += dt;
        if (e.burnTickTimer >= 0.45) {
          e.burnTickTimer -= 0.45;
          applyDamageToEnemy(e, Math.max(1, Math.round(e.burnDps * 0.45)), 0, 0, false, { isDoT: true });
          if (e.hp <= 0) {
            if (!e._corpseTransferred) {
              if (e.isSoulsBoss && e.model?.obj) disposeSoulsBossVisuals(e.model.obj);
              removeSceneObject(e.model.obj, e.model.handle);
            }
            enemies.splice(i, 1);
            continue;
          }
        }
      }

      // If enemy is suspended in mid-air inside Water Mage's 7% Spherical Water Ball, lift & flail their 3D model right inside the bubble!
      if ((e.waterLiftTimer || 0) > 0) {
        if (e.model?.obj) {
          const liftRamp = Math.min(1, (1.15 - e.waterLiftTimer) / 0.20);
          const targetY = e.isBoss ? 0.45 : 1.18;
          e.model.obj.position.x = e.x;
          e.model.obj.position.y = targetY * liftRamp + Math.sin(elapsedTime * 9 + e.uid) * 0.08;
          e.model.obj.position.z = e.z;
          e.facing += dt * 3.2;
          e.model.obj.rotation.y = e.facing;
          // Animate arms & legs flailing inside the water sphere!
          animateEntityModel(e.model, dt * 1.6, true, 1.4, false, false, elapsedTime);
          if (!e.isBoss) {
            e.model.obj.rotation.x = -0.56 * liftRamp;
            e.model.obj.rotation.z = Math.sin(elapsedTime * 7 + e.uid) * 0.34;
          }
        }
        continue;
      } else if (
        e.model?.obj &&
        ((!isSoulslike && e.model.obj.position.y > 0.01) || e.model.obj.rotation.x !== 0 || e.model.obj.rotation.z !== 0) &&
        !e.isBoss
      ) {
        if (!isSoulslike) e.model.obj.position.y = 0;
        e.model.obj.rotation.x = 0;
        e.model.obj.rotation.z = 0;
      }

      // Apply knockback velocity with crisp damping (PvE units ONLY; Souls units use stepActorPhysicsBody physVx/physVz!)
      if (!e.isSoulsUnit) {
        e.x += e.vx * dt;
        e.z += e.vz * dt;
        const damp = Math.exp(-10 * dt);
        e.vx *= damp;
        e.vz *= damp;
      } else {
        e.vx = 0;
        e.vz = 0;
      }

      // Dark Souls Poise, microstun & anti-stunlock immunity timers (strictly Dark Souls / Souls units)
      if (isSoulslike || e.isSoulsUnit) {
        poiseCtrl.tickEnemyPoise(e, dt);
      }

      // Regular Souls mob clean exit out of Riposte_Victim_Fall -> expressive 2.30s Riposte_Stand_Up!
      if (!e.isSoulsBoss && e.soulsState === 'riposte_victim' && !(souls.activeRiposte && souls.activeRiposte.target === e)) {
        e.soulsRiposteTimer = Math.max(0, (e.soulsRiposteTimer || 0) - dt);
        if (e.soulsRiposteTimer <= 0 || (e._soulsRiposteHasClip && e.model?.handle?.isClampedClipDone?.())) {
          triggerSoulsMobRiposteStandUp(e, 2.30);
        }
      }

      // Boss & Mob Stagger timer, immunity window & slow decay when not hit
      if (e.staggerMax > 0) {
        if ((e.staggeredTimer || 0) > 0) {
          e.staggeredTimer = Math.max(0, e.staggeredTimer - dt);
          if (!e.isSoulsBoss && Math.random() < 0.25) {
            emitParticles(e.x + (Math.random() - 0.5) * 0.7, 1.55, e.z + (Math.random() - 0.5) * 0.7, 0xfde047, 1, 2.2, 0.12);
          }
          if (e.staggeredTimer <= 0 && !e.isSoulsBoss) {
            if (e.soulsState === 'stagger_kneel') {
              triggerSoulsMobStaggerRecover(e, 0.85);
            } else {
              e.stagger = 0;
              e._soulsParryCount = 0;
              e.parriedRiposteTimer = 0;
              e.stunTimer = 0;
              e.soulsRiposteUsed = false;
              e.soulsRiposteInvuln = false;
              e.staggerImmunityTimer = 4.0;
              if (e.soulsState === 'stagger_recover') {
                e.model?.handle?.clearClampedClip?.(true, 0.16);
                e.soulsState = 'stalk';
                e.aiState = 'stalk';
                e.soulsTimer = 0.42;
              }
              poiseCtrl.resetEntityPoise(e, { grantImmunity: true });
            }
          }
        } else {
          if ((e.staggerImmunityTimer || 0) > 0) {
            e.staggerImmunityTimer = Math.max(0, e.staggerImmunityTimer - dt);
          }
          e.lastStaggerHitAge = (e.lastStaggerHitAge || 0) + dt;
          const stanceRegenDelay = (e.isSoulsUnit || isSoulslike) ? getStanceRegenDelay(e.staggerMax) : 3.0;
          if (
            e.lastStaggerHitAge >= stanceRegenDelay &&
            e.stagger > 0 &&
            e.soulsState !== 'stagger_kneel' &&
            e.soulsState !== 'stagger_recover' &&
            e.soulsState !== 'riposte_victim' &&
            e.soulsState !== 'riposte_recover'
          ) {
            const stanceDecayRate = (e.isSoulsUnit || isSoulslike) ? STANCE_REGEN_RATE : e.staggerMax * 0.12;
            e.stagger = Math.max(0, e.stagger - stanceDecayRate * dt);
          }
        }
      }

      const slowMult = e.frostTimer > 0 ? e.frostFactor || 0.75 : 1.0;
      const moveSpeed = e.speed * slowMult;
      const prevEx = e.x;
      const prevEz = e.z;
      const isStaggeredNow = (e.staggeredTimer || 0) > 0;

      if (e.parriedRiposteTimer > 0) {
        e.parriedRiposteTimer = Math.max(0, e.parriedRiposteTimer - dt);
      }

      // Chapter 26 Dark Souls / Elden Ring Handcrafted Deliberate Enemy & Boss AI
      if (e.isSoulsUnit) {
        if (e.isSoulsBoss && soulsEscapeCutsceneActive) {
          // 32.5s Boss Escape Cutscene: step handle.update(frameDt) so hit-flash decays & cutscene cross-fade advances cleanly!
          e.vx = 0;
          e.vz = 0;
          if (e.model?.obj && e.model.obj.visible) {
            animateEntityModel(e.model, frameDt, false, 0, false, false, elapsedTime);
          }
          continue;
        }
        // Active 43.20s First-Boss Narrative Intro Cutscene: boss pose & Z are driven strictly by `soulsCutsceneChoreography.js`!
        if (e.isSoulsBoss && soulsDoorCutsceneActive) {
          e.vx = 0;
          e.vz = 0;
          e.visualGroundY = 0;
          if (e.model?.obj) {
            e.model.obj.position.set(e.x, 0, e.z);
            e.model.obj.rotation.y = e.facing;
            animateEntityModel(e.model, frameDt, false, 0, false, false, elapsedTime);
            updateSoulsBossVisuals(e.model.obj, frameDt, {
              phase2Enraged: false,
              isWindup: false,
              isStaggered: false,
              elapsed: elapsedTime
            });
          }
          continue;
        }

        // Chapter 26 Boss Throne Seating + 1.5s Pause + Realistic Throne_StandUp Cutscene (Stake of Marika rematch / fallback)
        if (
          e.isSoulsBoss &&
          (e.soulsThronePhase === 'sitting' || e.soulsThronePhase === 'pause' || e.soulsThronePhase === 'standing')
        ) {
          e.vx = 0;
          e.vz = 0;
          e.x = 0;
          e.facing = 0;

          if (e.soulsThronePhase === 'sitting' || e.soulsThronePhase === 'pause') {
            e.z = SOULS_THRONE_SIT_Z;
            e.model?.handle?.setClipOverride?.('Throne_Sit', 1.0);
            if (e.soulsThronePhase === 'pause') {
              e.soulsThroneTimer = Math.max(0, (e.soulsThroneTimer || 0) - dt);
              if (e.soulsThroneTimer <= 0) {
                e.soulsThronePhase = 'standing';
                e.soulsThroneElapsed = 0;
                e.soulsThroneStep1Sfx = false;
                e.soulsThroneStep2Sfx = false;
                const res = e.model?.handle?.playClampedClip?.('Throne_StandUp', 1.0);
                e.soulsThroneDur =
                  res?.ok && res.duration > 0.2 ? res.duration : SOULS_THRONE_STANDUP_FALLBACK_SEC;
                audio?.playBossSpawn?.();
                world?.addScreenShake?.(0.35, 0.26);
                emitShockwave(0, SOULS_THRONE_RISE_Z, 7.5, 0xf59e0b, 0.55);
                emitParticles(0, 1.35, SOULS_THRONE_SIT_Z + 0.5, 0xf97316, 22, 6.5, 0.16);
                floatText('⚔️ РЫЦАРЬ ПЕПЛА ПОДНИМАЕТСЯ С ТРОНА!', player.x, player.z - 1.2, '#fbbf24');
              }
            }
          } else {
            // Smoothly rise off the throne & descend the stone dais strictly synced with Throne_StandUp (f1..f60)
            e.soulsThroneElapsed = (e.soulsThroneElapsed || 0) + dt;
            const dur = Math.max(0.2, e.soulsThroneDur || SOULS_THRONE_STANDUP_FALLBACK_SEC);
            const u = Math.min(1, e.soulsThroneElapsed / dur);
            e.z = getSoulsBossStandUpZ(u);

            if (!e.soulsThroneStep1Sfx && u >= 0.71) {
              e.soulsThroneStep1Sfx = true;
              world?.addScreenShake?.(0.14, 0.12);
              emitParticles(0.45, 0.28, -28.55, 0xd6d3d1, 8, 2.8, 0.12);
            }
            if (!e.soulsThroneStep2Sfx && u >= 0.86) {
              e.soulsThroneStep2Sfx = true;
              world?.addScreenShake?.(0.20, 0.15);
              emitParticles(-0.35, 0.08, -27.55, 0xd6d3d1, 10, 3.2, 0.13);
            }

            if (e.model?.obj) {
              e.model.obj.position.set(e.x, 0, e.z);
              e.model.obj.rotation.y = e.facing;
              animateEntityModel(e.model, dt, false, 0, false, false, elapsedTime);
              updateSoulsBossVisuals(e.model.obj, dt, {
                phase2Enraged: Boolean(e.phase2Enraged),
                isWindup: false,
                isStaggered: false,
                elapsed: elapsedTime
              });
            }

            if (e.soulsThroneElapsed >= dur || e.model?.handle?.isClampedClipDone?.()) {
              e.z = SOULS_THRONE_STAND_Z;
              if (e.model?.obj) {
                const standGroundY = sampleSmoothGroundY(e, e.x, e.z, dt, true);
                e.model.obj.position.set(e.x, standGroundY, e.z);
                e.model.obj.rotation.y = e.facing;
              }
              e.soulsThronePhase = 'done';
              e.soulsAwake = true;
              startSoulsBossOpeningRoar(e, elapsedTime, bossAiCtx);
            }
            continue;
          }

          e.visualGroundY = 0;
          if (e.model?.obj) {
            e.model.obj.position.set(e.x, 0, e.z);
            e.model.obj.rotation.y = e.facing;
            animateEntityModel(e.model, dt, false, 0, false, false, elapsedTime);
            updateSoulsBossVisuals(e.model.obj, dt, {
              phase2Enraged: Boolean(e.phase2Enraged),
              isWindup: false,
              isStaggered: false,
              elapsed: elapsedTime
            });
          }
          continue;
        }

        if (isSoulslike && (souls.bossAwakened || soulsDoorCutsceneActive) && !e.isSoulsBoss) {
          // Sealed Boss Doors culling: hide & freeze corridor guards behind sealed Boss Doors
          // (saves ~304k skinned triangles & 5×65-bone AnimationMixers during the entire Boss fight!)
          releaseSoulsAttackToken(e);
          e.soulsState = 'idle';
          e.soulsTimer = 0.5;
          if (e._trailRecording) {
            weaponTrails?.endSwing?.(e.uid);
            e._trailRecording = false;
          }
          if (e.model?.obj) {
            e.model.obj.visible = false;
          }
          continue;
        }

        // Distance culling for dormant Souls corridor mobs > 38m from hero (keeps GPU & CPU lean!)
        if (isSoulslike && !e.isSoulsBoss) {
          const distToHeroSq = (player.x - e.x) * (player.x - e.x) + (player.z - e.z) * (player.z - e.z);
          if (!e.soulsAwake && distToHeroSq > 38 * 38) {
            if (e.model?.obj && e.model.obj.visible) {
              e.model.obj.visible = false;
            }
            continue;
          }
          if (e.model?.obj && !e.model.obj.visible) {
            e.model.obj.visible = true;
          }
        }

        // Step mass-based physics body & wall-slam bounce (skip during paired riposte / grounded stand-up so victim has 0.0mm jitter!)
        const isRipostePinned =
          e.soulsState === 'riposte_victim' ||
          e.soulsState === 'riposte_recover' ||
          Boolean(souls.activeRiposte && souls.activeRiposte.target === e);
        const bossIgnoreThroneNow = isBossIgnoringThroneCollider(e);
        if (!isRipostePinned) {
          const ePhysStep = stepActorPhysicsBody(e, dt, {
            clampPosition: e.isSoulsBoss
              ? (cx, cz, cr, out) => clampBossCastlePos(cx, cz, cr, out, bossIgnoreThroneNow)
              : clampMobCastlePos,
            lowSpec: combatLowSpecMode
          });
          if (ePhysStep.wallHit) {
            handleSoulsWallSlam(e, ePhysStep, true);
          }
        }

        const dx = player.x - e.x;
        const dz = player.z - e.z;
        const dist = Math.hypot(dx, dz) || 0.001;
        const angToPlayer = Math.atan2(dx, dz);
        let soulsMoving = false;
        let soulsAnimSpeedMult = 0;

        if (e.isSoulsBoss) {
          if (e.model?.obj) {
            const hideBoss = !soulsDoorCutsceneActive && !souls.bossAwakened && Boolean(world?.isBossHallOccluded?.(player.z));
            e.model.obj.visible = !hideBoss;
          }
          if (!e.soulsAwake) {
            e.facing = lerpAngle(e.facing, 0, dt * 3);
            e.model?.handle?.setCombatPostureState?.({ combatPhase: 'neutral', combatPhase01: 0, moveType: null });
          } else {
            // Full Chapter XXVI Dark Souls / Elden Ring Goal-Stack Boss AI (`bossAi.js`)
            const bossRes = updateSoulsBossAI(e, dt, elapsedTime, bossAiCtx);
            soulsMoving = Boolean(bossRes?.isMoving);
            soulsAnimSpeedMult = soulsMoving ? 0.9 : 0;
            const bState = e.soulsState || 'stalk';
            const bAttacking =
              bState === 'overhead_cleave' ||
              bState === 'sweep_combo' ||
              bState === 'aaa_combo' ||
              bState === 'delayed_crush' ||
              bState === 'leap_slam' ||
              bState === 'whirl_windup' ||
              bState === 'whirl_spin' ||
              bState === 'rising_upcut' ||
              bState === 'ram_thrust_hook';
            const bPhase =
              bState === 'stagger_kneel' || bState === 'stagger_recover' || bState === 'riposte_victim' || bState === 'recover'
                ? 'recover'
                : bAttacking
                  ? (e.soulsPosturePhase || 'windup')
                  : 'neutral';
            const bPhase01 =
              bPhase === 'neutral'
                ? 0
                : Number.isFinite(e.soulsPosturePhase01)
                  ? e.soulsPosturePhase01
                  : 0.5;
            e.model?.handle?.setCombatPostureState?.({
              combatPhase: bPhase,
              combatPhase01: bPhase01,
              moveType: bAttacking ? (e.soulsMoveType || bState) : null,
              soulsState: bState
            });
          }
        } else if (e.stunTimer > 0 || isStaggeredNow || e.soulsState === 'riposte_victim') {
          // Stunned / Parried / Staggered / Riposte victim — locked from attacking AND frozen in rotation!
          releaseSoulsAttackToken(e);
          e._mobActiveSwing = null;
          e._soulsSlideTimer = 0;
          e.model?.handle?.setLocomotionState?.({ mode: 'idle', moveLocalX: 0, moveLocalZ: 0, turnDelta: 0, actualSpeed: 0 });
          e.model?.handle?.setCombatPostureState?.({ combatPhase: 'recover', combatPhase01: 0.5, moveType: null });
        } else if (
          (e.poiseMicroStunTimer || 0) > 0 &&
          e.soulsState !== 'riposte_recover' &&
          e.soulsState !== 'stagger_recover' &&
          !poiseCtrl.isEnemyHyperArmored(e)
        ) {
          // Dark Souls Hit_React stagger: mob is recoiling from player's hit — CANNOT attack, _mobActiveSwing strictly null!
          releaseSoulsAttackToken(e);
          e._mobActiveSwing = null;
          if (e._trailRecording) {
            weaponTrails?.endSwing?.(e.uid);
            e._trailRecording = false;
          }
          e.aiState = 'hit_react';
          e.soulsState = 'recover';
          e.soulsTimer = Math.max(e.soulsTimer || 0, 0.24);
          e.facing = lerpAngle(e.facing, angToPlayer, dt * 2.2);
          e._soulsSlideTimer = 0;
          e.model?.handle?.setLocomotionState?.({ mode: 'idle', moveLocalX: 0, moveLocalZ: 0, turnDelta: 0, actualSpeed: 0 });
          e.model?.handle?.setCombatPostureState?.({ combatPhase: 'recover', combatPhase01: 0.25, moveType: null });
        } else if (
          (e.soulsState === 'riposte_recover' || e.soulsState === 'stagger_recover') &&
          typeof SOULS_MOB_AI.startSoulsMobRiposteStandUp !== 'function'
        ) {
          releaseSoulsAttackToken(e);
          e._mobActiveSwing = null;
          e._soulsSlideTimer = 0;
          e.vx = 0;
          e.vz = 0;
          e.soulsRecoverTimer = Math.max(0, (e.soulsRecoverTimer ?? e.soulsTimer ?? 0) - dt);
          e.soulsTimer = e.soulsRecoverTimer;
          e.model?.handle?.setLocomotionState?.({ mode: 'idle', moveLocalX: 0, moveLocalZ: 0, turnDelta: 0, actualSpeed: 0 });
          e.model?.handle?.setCombatPostureState?.({ combatPhase: 'recover', combatPhase01: 0.5, moveType: null });
          if (e.soulsRecoverTimer <= 0) {
            e.model?.handle?.clearClampedClip?.(true, 0.18);
            e.soulsState = 'stalk';
            e.aiState = 'stalk';
            e.soulsTimer = 0.35;
          }
        } else {
          // Corridor & East Alcove Souls Mobs (`iron_knight`, `cursed_footman`, `bone_archer`):
          // Living patrol, Elden Ring Goal-Stack spacing, pack tokens, dynamic circling & exact GLB clips (`soulsMobAi.js`)
          const ai = stepSoulsMobAi(e, {
            dt,
            elapsedTime,
            player,
            allies: enemies,
            hasLineOfSight: hasCastleWallLineOfSight(e.x, e.z, player.x, player.z, {
              bossDoorState: world?.getBossDoorState?.() || (souls.bossAwakened ? 'sealed' : 'closed')
            }),
            bonfirePos: SOULS_CASTLE_BONFIRE,
            bonfireSafeRadius: SOULS_CASTLE_CONSTANTS.BONFIRE_SAFE_RADIUS,
            playerRestingAtBonfire: Boolean((souls.bonfireRestTimer || 0) > 0),
            bonfireRestActive: Boolean((souls.bonfireRestTimer || 0) > 0),
            fogGateSealed: Boolean(souls.bossAwakened),
            playerHealing: souls.flaskDrinkTimer > 0,
            playerBlocking: Boolean(souls.isBlocking),
            playerBlockHoldSec: souls.blockHoldSec || 0,
            playerRolling: Boolean(isDashingNow),
            audio,
            playAudio: true,
            autoWake: true,
            applyPosition: false,
            moveSpeed
          });

          if (ai.awokeThisStep) {
            audio?.playMobAggro?.(e.type, getMobAudioDistNorm(e));
            floatText(e.nameRu, e.x, e.z - 0.8, '#fca5a5');
          }
          // Play actual Backstep_Evade clip when mob executes a tactical burst backstep!
          if (ai.aiState === 'backstep' && e._prevSoulsAiState !== 'backstep') {
            e.model?.handle?.playAttackAnim?.('Backstep_Evade', 0, 1.38, 0.08);
          }
          e._prevSoulsAiState = ai.aiState;
          if (ai.startedWindup && ai.windupMeta) {
            e._mobActiveSwing = null;
            const windupClip = ai.attackAnimClip || ai.windupMeta.attackAnimClip || null;
            triggerModelAttack(e.model, windupClip, ai.windupMeta.windup);
            const isHeavyGrunt = ai.windupMeta.damageLevel === 'heavy' || Boolean(ai.windupMeta.heavySfx);
            audio?.playMobAttackGrunt?.(e.type, isHeavyGrunt, getMobAudioDistNorm(e), e.uid);
            e._soulsWindupAnimPlayed = true;
          }
          const stepLen = Math.hypot(ai.vx || 0, ai.vz || 0) * dt;
          if (stepLen > 0.0005) {
            const allowBack = ai.aiState === 'retreat' || ai.aiState === 'backstep';
            advanceSoulsMobStep(e, ai.vx, ai.vz, stepLen, allowBack);
          }
          soulsMoving = Boolean(ai.isMoving && !ai.hasRootMotionStep && (ai.combatPhase === 'neutral' || !ai.combatPhase));
          soulsAnimSpeedMult = ai.animSpeedMult ?? (soulsMoving ? 0.95 : 0);
          e._pendingSoulsLocoMode = ai.strafeAnimMode || (soulsMoving ? 'combat_walk' : 'idle');
          e._pendingSoulsLocoLocalX = ai.moveLocalX || 0;
          e._pendingSoulsLocoLocalZ = ai.moveLocalZ || 0;
          e._pendingSoulsLocoTurnDelta = ai.turnDelta || 0;
          e._pendingSoulsLocoCmdVx = ai.vx || 0;
          e._pendingSoulsLocoCmdVz = ai.vz || 0;
          e._hasPendingSoulsLoco = true;

          e.model?.handle?.setCombatPostureState?.({
            combatPhase: ai.combatPhase || 'neutral',
            combatPhase01: ai.combatPhase01 || 0,
            moveType: e.soulsMoveType || ai.windupMeta?.moveType || null
          });

          if (ai.strikeMeta) {
            const sm = ai.strikeMeta;
            e._soulsWindupAnimPlayed = false;
            const sx = Number.isFinite(sm.strikeDirX) ? sm.strikeDirX : (e.soulsStrikeDirX || Math.sin(e.facing));
            const sz = Number.isFinite(sm.strikeDirZ) ? sm.strikeDirZ : (e.soulsStrikeDirZ || Math.cos(e.facing));
            const sAng = Number.isFinite(sm.strikeAngle) ? sm.strikeAngle : Math.atan2(sx, sz);
            if (sm.isRanged) {
              e._mobActiveSwing = null;
              if (sm.releaseAnimClip && sm.releaseAnimClip !== sm.attackAnimClip) {
                triggerModelAttack(e.model, sm.releaseAnimClip, 0.22);
              }
              const spd = sm.projectileSpeed || 19.5;
              spawnProjectile({
                x: e.x + sx * 0.7,
                z: e.z + sz * 0.7,
                vx: sx * spd,
                vz: sz * spd,
                damage: Math.max(1, Math.round(e.damage * (sm.damageMult || 1))),
                maxDist: sm.projectileMaxDist || 18,
                pierce: 1,
                knockback: 3.5,
                kind: 'enemy_bolt',
                color: 0xf97316,
                isEnemy: true,
                attackMeta: sm
              });
            } else {
              // Arm active melee hitbox strictly tied to `ai.aiState === 'active'` & `sm.hitId` (zero outliving desync!)
              e._mobActiveSwing = {
                hitId: sm.hitId,
                meta: sm,
                strikeAng: sAng,
                hitDone: false
              };
            }
          }

          // Strict 1:1 atomic sync between `ai.aiState === 'active'` and `e._mobActiveSwing`:
          // The instant `soulsMobAi` transitions to `recover`, `retreat`, `backstep`, `approach`, `hit_react`, or `stunned`,
          // `liveActiveMeta` becomes null and `_mobActiveSwing` is immediately extinguished in the exact same frame!
          const liveActiveMeta =
            ai.aiState === 'active' && ai.activeAttackMeta && !ai.activeAttackMeta.isRanged
              ? ai.activeAttackMeta
              : null;
          if (
            !liveActiveMeta ||
            e.hp <= 0 ||
            e.stunTimer > 0 ||
            (e.poiseMicroStunTimer || 0) > 0 ||
            e.soulsState === 'stagger_kneel' ||
            e.soulsState === 'stagger_recover' ||
            e.soulsState === 'riposte_victim' ||
            e.soulsState === 'riposte_recover'
          ) {
            e._mobActiveSwing = null;
          } else {
            if (!e._mobActiveSwing || e._mobActiveSwing.hitId !== liveActiveMeta.hitId) {
              const sx = Number.isFinite(liveActiveMeta.strikeDirX)
                ? liveActiveMeta.strikeDirX
                : (e.soulsStrikeDirX || Math.sin(e.facing));
              const sz = Number.isFinite(liveActiveMeta.strikeDirZ)
                ? liveActiveMeta.strikeDirZ
                : (e.soulsStrikeDirZ || Math.cos(e.facing));
              e._mobActiveSwing = {
                hitId: liveActiveMeta.hitId,
                meta: liveActiveMeta,
                strikeAng: Number.isFinite(liveActiveMeta.strikeAngle)
                  ? liveActiveMeta.strikeAngle
                  : Math.atan2(sx, sz),
                hitDone: false
              };
            }
            const sw = e._mobActiveSwing;
            if (!sw.hitDone) {
              const sm = sw.meta;
              const reach = (sm.reach || 2.55) + 0.12;
              const arcRad = sm.arcRad || Math.PI * 0.85;
              const pDx = player.x - e.x;
              const pDz = player.z - e.z;
              const pDist = Math.hypot(pDx, pDz);
              const relA = Math.abs(normalizeAngle(Math.atan2(pDx, pDz) - sw.strikeAng));
              const inArc = pDist <= reach + player.radius * 0.65 && relA <= arcRad * 0.66;
              const inPointBlank = pDist <= 1.38 && relA <= Math.PI * 0.88;
              if (inArc || inPointBlank) {
                sw.hitDone = true;
                e._lastSwingConnected = true;
                applyDamageToPlayer(Math.max(1, Math.round(e.damage * (sm.damageMult || 1))), e, sm);
              }
            }
          }
        }

        if (!e.isSoulsBoss) {
          if (!isRipostePinned) {
            const castleSideClamp = clampCastlePosition(e.x, e.z, e.radius || 0.55, {
              bossDoorState: 'closed',
              allowBossHall: false,
              ignoreThrone: false
            });
            e.x = castleSideClamp.x;
            e.z = castleSideClamp.z;
          }

          // Compute TRUE post-clamp velocity & feed real (vx, vz) into setLocomotionState (kills wall treadmill skating!)
          if (e._hasPendingSoulsLoco) {
            e._hasPendingSoulsLoco = false;
            let postVx = e._soulsPostSmoothVx || 0;
            let postVz = e._soulsPostSmoothVz || 0;
            if (dt >= 0.004) {
              const rawVx = (e.x - prevEx) / dt;
              const rawVz = (e.z - prevEz) / dt;
              const a = 1 - Math.exp(-20 * dt);
              postVx += (rawVx - postVx) * a;
              postVz += (rawVz - postVz) * a;
              e._soulsPostSmoothVx = postVx;
              e._soulsPostSmoothVz = postVz;
            }
            const postSpd = Math.hypot(postVx, postVz);
            e.model?.handle?.setLocomotionState?.({
              mode: postSpd < 0.08 && soulsMoving ? 'idle' : e._pendingSoulsLocoMode,
              vx: postVx,
              vz: postVz,
              moveLocalX: e._pendingSoulsLocoLocalX,
              moveLocalZ: e._pendingSoulsLocoLocalZ,
              turnDelta: e._pendingSoulsLocoTurnDelta,
              actualSpeed: postSpd
            });
          }
        } else {
          const bossHallClamp = clampBossCastlePos(
            e.x,
            e.z,
            e.radius || 1.75,
            undefined,
            isBossIgnoringThroneCollider(e)
          );
          e.x = bossHallClamp.x;
          e.z = bossHallClamp.z;
        }

        // Universal distance-driven footsteps for patrolling & moving Souls corridor mobs (< 16m)
        if (!e.isSoulsBoss && e.hp > 0) {
          const mobMovedDist = Math.hypot(e.x - prevEx, e.z - prevEz);
          if (mobMovedDist > 0.002 && soulsMoving) {
            const stride = e.type === 'iron_knight' ? 1.32 : e.type === 'bone_archer' ? 1.18 : 1.25;
            e._mobStepDistAccum = (e._mobStepDistAccum || 0) + mobMovedDist;
            if (e._mobStepDistAccum >= stride) {
              e._mobStepDistAccum %= stride;
              const dMobPlayer = Math.hypot(e.x - player.x, e.z - player.z);
              if (dMobPlayer < 16.0) {
                audio?.playMobFootstep?.(e.type, clamp(dMobPlayer / 16.0, 0, 1), e.uid);
              }
            }
          }
        }

        if (e.model?.obj) {
          const enemyGroundY = sampleSmoothGroundY(e, e.x, e.z, dt, false);
          e.model.obj.position.set(e.x, enemyGroundY, e.z);
          e.model.obj.rotation.y = e.facing;
          animateEntityModel(e.model, dt, soulsMoving, soulsAnimSpeedMult, e.soulsState === 'windup', false, elapsedTime);
          if (e.isSoulsBoss) {
            updateSoulsBossVisuals(e.model.obj, dt, {
              phase2Enraged: Boolean(e.phase2Enraged),
              isAttacking: Boolean(
                e.soulsActiveAttack &&
                e.soulsState !== 'stalk' &&
                e.soulsState !== 'recover' &&
                e.soulsState !== 'roar_taunt' &&
                e.soulsState !== 'phase2_roar'
              ),
              isWindup: Boolean(e.soulsPosturePhase === 'windup' || e.soulsState === 'whirl_windup'),
              isStaggered: Boolean(e.soulsState === 'stagger_kneel' || (e.stunTimer || 0) > 0 || isStaggeredNow),
              elapsed: elapsedTime
            });
          }

          // Subtle monochrome steel air-shear ribbons (0 sparks; molten fire ONLY on Boss in Phase 2!)
          if (weaponTrails) {
            if (e.isSoulsBoss) {
              const bossSwingActive =
                e.soulsAwake &&
                (e.soulsState === 'overhead_cleave' ||
                  e.soulsState === 'sweep_combo' ||
                  e.soulsState === 'aaa_combo' ||
                  e.soulsState === 'delayed_crush' ||
                  e.soulsState === 'leap_slam' ||
                  e.soulsState === 'whirl_spin' ||
                  e.soulsState === 'rising_upcut' ||
                  e.soulsState === 'ram_thrust_hook');
              if (bossSwingActive) {
                const bSeg = e.model?.handle?.getWeaponSegmentWorld?.();
                if (bSeg) {
                  const isP2Boss = Boolean(e.phase2Enraged);
                  const bStyle = isP2Boss ? 'boss_ember_p2' : 'mob_iron';
                  weaponTrails.recordWeaponSegment(e.uid, bSeg, bStyle);
                  e._trailRecording = true;
                }
              } else if (e._trailRecording) {
                weaponTrails.endSwing(e.uid);
                e._trailRecording = false;
              }
            } else if (e._mobActiveSwing && !e._mobActiveSwing.meta?.isRanged && e._mobActiveSwing.meta?.moveType !== 'shield_bash') {
              const mSeg = e.model?.handle?.getWeaponSegmentWorld?.();
              if (mSeg) {
                weaponTrails.recordWeaponSegment(e.uid, mSeg, 'mob_iron');
                e._trailRecording = true;
              }
            } else if (e._trailRecording) {
              weaponTrails.endSwing(e.uid);
              e._trailRecording = false;
            }
          }
        }
        continue;
      }

      if (e.isTrainingDummy) {
        const dx = player.x - e.x;
        const dz = player.z - e.z;
        e.facing = Math.atan2(dx, dz);
        e.vx = 0;
        e.vz = 0;
        if (e.model?.obj) {
          e.model.obj.position.set(e.x, 0, e.z);
          e.model.obj.rotation.y = e.facing;
          animateEntityModel(e.model, dt, false, 1.0, false, false, elapsedTime);
        }
        continue;
      }

      if (e.isBoss && e.stunTimer <= 0 && !isStaggeredNow) {
        updateBossAI(e, dt, elapsedTime, bossAiCtx);
      } else if (e.stunTimer <= 0 && !isStaggeredNow) {
        const dx = player.x - e.x;
        const dz = player.z - e.z;
        const dist = Math.hypot(dx, dz) || 0.001;
        const angToPlayer = Math.atan2(dx, dz);

        // --- ARCHETYPE 0: HOPPING MONSTERS (`corrupted_treant`, `mimic_chest` — Coils on ground, then leaps in discrete forward arcs!) ---
        if (e.type === 'corrupted_treant' || e.type === 'mimic_chest') {
          const isMimic = e.type === 'mimic_chest';
          if ((e.emergeTimer || 0) <= 0) {
            e.hopCycle = ((e.hopCycle || 0) + dt * (isMimic ? 1.32 : 1.18) * slowMult) % 1.0;
            // Grounded coil [0.00..0.17] & landing stomp [0.83..1.00]: ZERO floor crawling — only turns toward hero & spawns landing dust!
            if (e.hopCycle >= 0.17 && e.hopCycle <= 0.83) {
              const airT = (e.hopCycle - 0.17) / 0.66;
              const hopBurst = 0.85 + 2.55 * Math.sin(airT * Math.PI);
              e.facing = lerpAngle(e.facing, angToPlayer, dt * 6.5);
              e.x += (dx / dist) * moveSpeed * hopBurst * dt;
              e.z += (dz / dist) * moveSpeed * hopBurst * dt;
              e._hopLandedDust = false;
            } else {
              e.facing = lerpAngle(e.facing, angToPlayer, dt * 12);
              if (e.hopCycle >= 0.83 && !e._hopLandedDust) {
                e._hopLandedDust = true;
                world?.spawnShockwaveRing?.({ x: e.x, y: 0.03, z: e.z, radius: 0.88, color: isMimic ? 0xc084fc : 0xf97316, duration: 0.28 });
                emitParticles(e.x, 0.10, e.z, isMimic ? 0xa855f7 : 0x78716c, 6, 3.2, 0.11);
              }
            }
          } else {
            e.facing = lerpAngle(e.facing, angToPlayer, dt * 8);
          }
        }
        // --- ARCHETYPE 1: CHARGERS (`iron_knight`, `brute` — 0.60s telegraph -> 0.65s bull-charge @ 13.5 spd!) ---
        else if (e.canCharge) {
          if (e.chargeState === 'telegraph') {
            e.chargeTimer -= dt;
            if (Math.random() < 0.45) {
              emitParticles(e.x, 0.95, e.z, e.color || 0xef4444, 2, 3.2, 0.14);
            }
            if (e.chargeTimer <= 0) {
              e.chargeState = 'charging';
              e.chargeTimer = 0.65;
              triggerModelAttack(e.model);
              audio?.playMeleeSwing?.(true);
            }
          } else if (e.chargeState === 'charging') {
            e.chargeTimer -= dt;
            e.facing = Math.atan2(e.chargeDirX, e.chargeDirZ);
            e.x += e.chargeDirX * (13.5 * slowMult) * dt;
            e.z += e.chargeDirZ * (13.5 * slowMult) * dt;
            if (Math.random() < 0.5) {
              emitParticles(e.x, 0.25, e.z, e.color || 0xf97316, 1, 2.4, 0.13);
            }
            if (e.chargeTimer <= 0) {
              e.chargeState = 'walk';
              e.specialCooldown = 4.5;
            }
          } else {
            e.facing = lerpAngle(e.facing, angToPlayer, dt * 8);
            e.x += (dx / dist) * moveSpeed * dt;
            e.z += (dz / dist) * moveSpeed * dt;
            e.specialCooldown -= dt;
            if (e.specialCooldown <= 0 && dist <= 11.0 && dist >= 2.2) {
              e.chargeState = 'telegraph';
              e.chargeTimer = 0.65;
              e.chargeDirX = dx / dist;
              e.chargeDirZ = dz / dist;
              e.facing = angToPlayer;
              triggerModelHitFlash(e.model);
              emitParticles(e.x, 1.0, e.z, 0xef4444, 12, 4.8, 0.16);
              emitTelegraphZone(
                clamp(e.x + e.chargeDirX * 4.4, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT),
                clamp(e.z + e.chargeDirZ * 4.4, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT),
                2.0,
                0.65,
                0xef4444
              );
              floatText(e.type === 'corrupted_treant' ? '🌿 КОРНЕВОЙ ТАРАН!' : '⚠️ ТАРАН!', e.x, e.z, '#f87171');
            }
          }
        }
        // --- ARCHETYPE 2: SUMMONERS (`mummy`, `necromancer` — keeps ~10.8m, raises 2 ember_skeletons every 6.8s) ---
        else if (e.summoner) {
          const keepDist = e.keepDistance || 10.8;
          e.facing = lerpAngle(e.facing, angToPlayer, dt * 8);
          if (dist > keepDist) {
            e.x += (dx / dist) * moveSpeed * dt;
            e.z += (dz / dist) * moveSpeed * dt;
          }
          e.specialCooldown -= dt;
          if (e.specialCooldown <= 0 && dist <= 20.0) {
            e.specialCooldown = 6.8;
            triggerModelAttack(e.model);
            audio?.playMagicCast?.('spark_staff');
            emitParticles(e.x, 0.75, e.z, e.color || 0x22d3ee, 16, 4.8, 0.15);

            for (let s = -1; s <= 1; s += 2) {
              if (enemies.length >= MAX_ACTIVE_ENEMIES + 6) break;
              const perpX = Math.cos(angToPlayer) * s * 1.5;
              const perpZ = -Math.sin(angToPlayer) * s * 1.5;
              const sx = clamp(e.x + perpX, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
              const sz = clamp(e.z + perpZ, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
              spawnEnemy('ember_skeleton', sx, sz, null, { isSummoned: true, xp: 4, gold: 1 });
              emitParticles(sx, 0.55, sz, 0xf97316, 7, 3.8, 0.13);
            }
          }
        }
        // --- ARCHETYPE 3B: VAMPIRE LORD (`vampire_lord` — stalks into melee for Cloak_Slash & pauses to summon Vampire Bats! ZERO ranged orbs!) ---
        else if (e.canSummonBats || e.type === 'vampire_lord') {
          e.cloakAttackTimer = Math.max(0, (e.cloakAttackTimer || 0) - dt);
          e.facing = lerpAngle(e.facing, angToPlayer, dt * 9);
          if ((e.castPauseTimer || 0) > 0) {
            e.castPauseTimer = Math.max(0, e.castPauseTimer - dt);
          } else if ((e.emergeTimer || 0) <= 0) {
            e.batSummonCooldown = (e.batSummonCooldown ?? 2.4) - dt;
            let aliveBats = 0;
            for (let b = 0; b < enemies.length; b++) {
              if (enemies[b]?.hp > 0 && enemies[b].type === 'vampire_bat') aliveBats += 1;
            }
            if (e.batSummonCooldown <= 0 && dist <= 16.5 && aliveBats < 5) {
              e.batSummonCooldown = 6.2;
              e.castPauseTimer = 0.72;
              triggerModelAttack(e.model, 'Cast_Attack');
              world?.spawnShockwaveRing?.({ x: e.x, y: 0.04, z: e.z, radius: 2.2, color: 0xe11d48, duration: 0.36 });
              emitParticles(e.x, 1.05, e.z, 0xf43f5e, 14, 4.5, 0.14);
              const batCount = aliveBats <= 3 ? 2 : 1;
              for (let s = 0; s < batCount; s++) {
                if (enemies.length >= MAX_ACTIVE_ENEMIES + 6) break;
                const side = s === 0 ? -1 : 1;
                const sx = clamp(e.x + Math.cos(angToPlayer) * side * 1.45, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
                const sz = clamp(e.z - Math.sin(angToPlayer) * side * 1.45, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
                spawnEnemy('vampire_bat', sx, sz, null, { isSummoned: true, noEmerge: true, xp: 4, gold: 2 });
                emitParticles(sx, 0.75, sz, 0xe11d48, 8, 3.6, 0.13);
              }
            } else {
              const stopDist = e.radius + player.radius + 0.85;
              if (dist > stopDist) {
                e.x += (dx / dist) * moveSpeed * dt;
                e.z += (dz / dist) * moveSpeed * dt;
              }
              if (dist <= e.radius + player.radius + 1.45 && e.cloakAttackTimer <= 0) {
                e.cloakAttackTimer = 1.15;
                e.castPauseTimer = 0.36;
                triggerModelAttack(e.model, 'Cloak_Slash');
                audio?.playMeleeSwing?.(false);
                emitSlashArc(e.x, e.z, angToPlayer, 2.45, Math.PI * 0.9, 0xe11d48);
                emitParticles(e.x + (dx / dist) * 0.85, 0.9, e.z + (dz / dist) * 0.85, 0xf43f5e, 10, 4.2, 0.13);
                applyDamageToPlayer(e.damage, e);
              }
            }
          }
        }
        // --- ARCHETYPE 3: RANGED CASTERS (`dark_cultist`, `archer`, `cultist` — 0.85s windup -> 1 dodgeable bolt) ---
        else if (e.ranged) {
          const pColor = e.projColor || 0xa855f7;
          const keepDist = e.keepDistance || 10.2;
          if (e.windupTimer > 0) {
            e.windupTimer -= dt;
            e.facing = Math.atan2(e.aimDirX, e.aimDirZ);
            if (Math.random() < 0.4) {
              emitParticles(e.x + e.aimDirX * 0.48, 0.92, e.z + e.aimDirZ * 0.48, pColor, 1, 1.9, 0.12);
            }
            if (e.windupTimer <= 0) {
              e.shootCooldown = 4.55 + Math.random() * 0.75;
              triggerModelAttack(e.model);
              spawnProjectile({
                x: e.x,
                z: e.z,
                vx: e.aimDirX * 10.5,
                vz: e.aimDirZ * 10.5,
                damage: e.damage,
                maxDist: 19,
                pierce: 1,
                kind: 'enemy',
                color: pColor,
                isEnemy: true
              });
            }
          } else {
            e.facing = lerpAngle(e.facing, angToPlayer, dt * 8.5);
            if (dist > keepDist) {
              e.x += (dx / dist) * moveSpeed * dt;
              e.z += (dz / dist) * moveSpeed * dt;
            }
            e.shootCooldown -= dt;
            if (e.shootCooldown <= 0 && dist <= 16.2) {
              e.windupTimer = 0.85;
              e.aimDirX = dx / dist;
              e.aimDirZ = dz / dist;
              emitParticles(e.x + e.aimDirX * 0.48, 0.92, e.z + e.aimDirZ * 0.48, pColor, 8, 3.2, 0.14);
            }
          }
        }
        // --- ARCHETYPE 4: DASHERS (`goblin`, `werewolf`, `dark_spider`, `gargoyle`, `hell_imp`, `mimic_chest`, `shadow_wisp`, `hound`) ---
        else if (e.canDash) {
          const dashMult = e.dashMult || 1.65;
          if ((e.lungeWindupTimer || 0) > 0) {
            e.lungeWindupTimer -= dt;
            e.facing = lerpAngle(e.facing, Math.atan2(e.lungeDirX, e.lungeDirZ), dt * 12);
            if (Math.random() < 0.4) {
              emitParticles(e.x, 0.6, e.z, e.color || 0xef4444, 1, 2.4, 0.11);
            }
            if (e.lungeWindupTimer <= 0) {
              e.lungeTimer = 0.45;
              triggerModelAttack(e.model);
              emitParticles(e.x, 0.55, e.z, e.color || 0xef4444, 8, 4.6, 0.13);
            }
          } else if (e.lungeTimer > 0) {
            e.lungeTimer -= dt;
            e.facing = lerpAngle(e.facing, Math.atan2(e.lungeDirX, e.lungeDirZ), dt * 14);
            e.x += e.lungeDirX * (moveSpeed * dashMult) * dt;
            e.z += e.lungeDirZ * (moveSpeed * dashMult) * dt;
          } else {
            e.facing = lerpAngle(e.facing, angToPlayer, dt * 10);
            e.x += (dx / dist) * moveSpeed * dt;
            e.z += (dz / dist) * moveSpeed * dt;
            e.specialCooldown -= dt;
            if (e.specialCooldown <= 0 && dist <= 9.0 && dist >= 1.5) {
              e.specialCooldown = 3.2;
              e.lungeDirX = dx / dist;
              e.lungeDirZ = dz / dist;
              if (e.eliteType || e.isMiniBoss || e.isWarden) {
                e.lungeWindupTimer = 0.65;
                const lungeReach = Math.min(dist + 0.8, moveSpeed * dashMult * 0.45);
                const tx = clamp(e.x + e.lungeDirX * lungeReach, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
                const tz = clamp(e.z + e.lungeDirZ * lungeReach, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
                emitTelegraphZone(tx, tz, Math.max(1.5, e.radius * 2.1), 0.65, e.eliteType === 'purple' ? 0xa855f7 : 0xef4444);
              } else {
                e.lungeTimer = 0.45;
                triggerModelAttack(e.model);
                emitParticles(e.x, 0.55, e.z, e.color || 0xef4444, 6, 4.2, 0.12);
              }
            }
          }
        }
        // --- ARCHETYPE 5: FRONTLINE WALKERS (`plague_zombie`, `ember_skeleton`, `cursed_footman`, `toxic_slime`, `phantom_ghost`) ---
        else {
          e.facing = lerpAngle(e.facing, angToPlayer, dt * 9);
          const stopDist = player.radius + e.radius + 0.14;
          const isMidSwing = (e.meleeWindupAnimTimer || 0) > 0.20 || (e.contactCooldown || 0) > 0.44;
          if ((e.emergeTimer || 0) <= 0 && dist > stopDist && !isMidSwing) {
            const stepMax = Math.min(moveSpeed * dt, dist - stopDist);
            e.x += (dx / dist) * stepMax;
            e.z += (dz / dist) * stepMax;
          }
        }
      }

      // Soft neighbor separation so hordes surround organically (damped 0.24 prevents buzzing jitter!)
      for (let j = i - 1; j >= 0 && j >= i - 10; j--) {
        const other = enemies[j];
        if (!other || other.hp <= 0) continue;
        const sdx = e.x - other.x;
        const sdz = e.z - other.z;
        const minSep = (e.radius + other.radius) * 0.90;
        const distSq = sdx * sdx + sdz * sdz;
        if (distSq > 0.0001 && distSq < minSep * minSep) {
          const d = Math.sqrt(distSq);
          const push = (minSep - d) * 0.24;
          const px = (sdx / d) * push;
          const pz = (sdz / d) * push;
          if (!e.isBoss) {
            e.x += px;
            e.z += pz;
          }
          if (!other.isBoss) {
            other.x -= px;
            other.z -= pz;
          }
        }
      }

      const resolvedEnemy = resolveObstaclesAndBounds(e.x, e.z, e.radius, ARENA_ENTITY_LIMIT);
      e.x = resolvedEnemy.x;
      e.z = resolvedEnemy.z;

      // Contact with Player: Beast Mode Trample, Bomber Barrel Trigger, OR Enemy Melee Hit
      const pdx = e.x - player.x;
      const pdz = e.z - player.z;
      const pDist = Math.hypot(pdx, pdz);
      const touchDist = player.radius + e.radius + (beastActive ? 0.85 : 0.12);

      if (pDist <= touchDist) {
        if (beastActive) {
          if (e.trampleCooldown <= 0) {
            e.trampleCooldown = 0.24;
            const nx = pDist > 0.001 ? pdx / pDist : 0;
            const nz = pDist > 0.001 ? pdz / pDist : 1;
            const trampleDmg = Math.max(95, Math.round(stats.damage * 2.65));
            world?.addScreenShake?.(0.24, 0.12);
            applyDamageToEnemy(e, trampleDmg, nx * 14.5, nz * 14.5, false);
          }
        } else if (e.explodesOnDeath && !e.bomberTriggered) {
          // Toxic Slime / Bomber bursts acid hazard pool right at player's feet and detonates in 0.80s!
          e.bomberTriggered = true;
          spawnBomberHazard(e.x, e.z, e.hazardColor || 0x22c55e);
          floatText('🧪 КИСЛОТА!', e.x, e.z, '#4ade80');
          e.hp = 0;
          handleEnemyDeath(e);
        } else if (e.contactCooldown <= 0 && (e.disarmTimer || 0) <= 0 && (e.staggeredTimer || 0) <= 0) {
          e.contactCooldown = 0.68;
          triggerModelAttack(e.model, 'Attack', 0.55);
          audio?.playMeleeSwing?.(false);
          applyDamageToPlayer(e.damage, e);
        }
      } else if (
        !beastActive &&
        !e.explodesOnDeath &&
        !e.ranged &&
        pDist <= touchDist + 0.58 &&
        e.contactCooldown <= 0.22 &&
        (e.meleeWindupAnimTimer || 0) <= 0
      ) {
        // Trigger visible zombie/melee claw-swipe windup right as they lunge into striking reach!
        e.meleeWindupAnimTimer = 0.65;
        triggerModelAttack(e.model, 'Attack', 0.55);
      }
      if ((e.meleeWindupAnimTimer || 0) > 0) {
        e.meleeWindupAnimTimer = Math.max(0, e.meleeWindupAnimTimer - dt);
      }

      if (e.hp > 0 && e.model?.obj) {
        e.model.obj.position.x = e.x;
        e.model.obj.position.z = e.z;
        if ((e.emergeTimer || 0) > 0) {
          e.emergeTimer = Math.max(0, e.emergeTimer - dt);
          const prog = 1 - e.emergeTimer / Math.max(0.01, e.emergeDuration || 0.85);
          const smooth = prog * prog * (3 - 2 * prog);
          e.model.obj.position.y = -1.9 * (1 - smooth);
        } else if ((e.waterLiftTimer || 0) <= 0 && e.bossSubState !== 'leaping') {
          e.model.obj.position.y = isSoulslike ? sampleSmoothGroundY(e, e.x, e.z, dt, false) : 0;
        }
        e.model.obj.rotation.y = e.facing;
        const pveMovedDist = Math.hypot(e.x - prevEx, e.z - prevEz);
        const isMoving =
          pveMovedDist > 0.0025 &&
          (e.emergeTimer || 0) <= 0 &&
          (e.castPauseTimer || 0) <= 0;
        if (isMoving && !e.isBoss && !e.isTrainingDummy) {
          e._mobStepDistAccum = (e._mobStepDistAccum || 0) + pveMovedDist;
          if (e._mobStepDistAccum >= 1.28) {
            e._mobStepDistAccum %= 1.28;
            const dPveMob = Math.hypot(e.x - player.x, e.z - player.z);
            if (dPveMob < 16.0) {
              audio?.playMobFootstep?.(e.type, clamp(dPveMob / 16.0, 0, 1));
            }
          }
        }
        animateEntityModel(e.model, dt, isMoving, slowMult, false, false, elapsedTime);
        if (e.type === 'corrupted_treant' || e.type === 'mimic_chest') {
          e.model.handle?.syncCyclePhase?.((e.emergeTimer || 0) > 0 ? 0 : (e.hopCycle || 0));
        }
      } else if (e.hp <= 0) {
        if (!e._corpseTransferred) {
          if (e.isSoulsBoss && e.model?.obj) disposeSoulsBossVisuals(e.model.obj);
          removeSceneObject(e.model.obj, e.model.handle);
        }
        enemies.splice(i, 1);
      }
    }

    // Pass 2: hard body collision after enemy/boss movement so advancing enemies never clip into the hero!
    if (!soulsDoorCutsceneActive) {
      resolvePlayerEnemyBodyCollisions(true);
    }

    // Keep Dark Souls Target Lock-On synced to updated enemy coordinates / auto-switch on death
    if (isSoulslike) {
      validateLockedEnemy(true);
    }

    // Update combat camera once per frame using final post-collision hero & lock-on positions (zero 1-frame lag!)
    syncFollowTarget(player.x, player.z, heroModel?.obj, frameDt);

    // 8. Tactical Pickups Magnet & Collection
    updatePickups(dt, elapsedTime);
  }

  function updatePickups(dt, elapsedTime) {
    if (playerDying || player.hp <= 0) return;
    const magnetRadius = stats ? stats.pickupRadius : 3.8;

    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      p.age += dt;
      if (p.hitWobble > 0) p.hitWobble = Math.max(0, p.hitWobble - dt);

      const dx = player.x - p.x;
      const dz = player.z - p.z;
      const dist = Math.hypot(dx, dz);

      const isMagnetic = p.type === 'heart' || p.type === 'clover';

      if (isMagnetic && dist <= magnetRadius && dist > 0.01) {
        const pullSpeed = 13.5 + (magnetRadius - dist) * 3.5;
        p.x += (dx / dist) * pullSpeed * dt;
        p.z += (dz / dist) * pullSpeed * dt;
      }

      if (p.type === 'relic_weapon_crate') {
        p.model.obj.rotation.y += dt * 0.9;
        if (dist <= p.radius + player.radius + 0.35 && player.relicBumpTimer <= 0) {
          player.relicBumpTimer = 0.32;
          hitCrate(p);
          if (p.hp <= 0) {
            removePickup(p, i);
            continue;
          }
        }
      } else if (p.type === 'explosive_barrel') {
        // Static destructible powder barrel: detonates only when hit by melee/projectiles/chain blasts
      } else if (p.type === 'cursed_chest') {
        if (dist <= p.radius + player.radius + 0.48) {
          openCursedChest(p);
          continue;
        }
      } else if (p.type === 'mimic_disguise') {
        if (dist <= 2.75) {
          awakenMimicDisguise(p, i);
          continue;
        }
      } else if (p.type === 'supply_crate' || p.type === 'companion_crate') {
        if (dist <= p.radius + player.radius + 0.28) {
          notifyDailyProgress('barrels_chests', 1);
          if (p.type === 'supply_crate') {
            maybeDropSpearBlueprint(p.x, p.z);
            activateOverdrive(p.x, p.z);
          } else {
            activateCompanion(p.x, p.z);
          }
          removePickup(p, i);
          continue;
        }
      } else if (dist <= 1.08) {
        if (p.type === 'heart') {
          audio?.playPickup?.('heart');
          const heal = p.value || 30;
          player.hp = Math.min(stats.maxHp, player.hp + heal);
          floatText(`+${heal} HP`, player.x, player.z, '#f87171');
        } else if (p.type === 'clover') {
          audio?.playPickup?.('clover');
          if (player.beastTimeLeft > 0) {
            player.beastTimeLeft = Math.min(12.0, player.beastTimeLeft + 3.0);
            floatText('+3С ЗВЕРЯ!', player.x, player.z, '#4ade80');
          } else if (player.beastReady || player.seals >= 5) {
            player.seals = 5;
            player.beastReady = true;
            const bonusHeal = Math.max(8, Math.round(stats.maxHp * 0.08));
            player.hp = Math.min(stats.maxHp, player.hp + bonusHeal);
            floatText(`🐺 Ярость Зверя готова [F]! +${bonusHeal} HP`, player.x, player.z, '#fde047');
          } else {
            player.seals = Math.min(5, player.seals + 1);
            if (player.seals >= 5) {
              player.seals = 5;
              player.beastReady = true;
              audio?.playBeastReady?.();
              emitShockwave(player.x, player.z, 3.6, 0xfde047, 0.36);
              emitParticles(player.x, 0.85, player.z, 0xfde047, 16, 5.5, 0.16);
              floatText('🐺 Ярость Зверя готова [F]!', player.x, player.z, '#fde047');
            } else {
              floatText(`🍀 ПЕЧАТЬ ${player.seals}/5`, player.x, player.z, '#4ade80');
            }
          }
        }
        removePickup(p, i);
        continue;
      }

      if (p.model?.obj) {
        p.model.obj.position.x = p.x;
        p.model.obj.position.z = p.z;
        if (typeof p.model.handle?.update === 'function') {
          p.model.handle.update(dt, elapsedTime);
        } else if (
          !p.type.includes('crate') &&
          p.type !== 'mimic_disguise' &&
          p.type !== 'explosive_barrel' &&
          p.type !== 'cursed_chest'
        ) {
          p.model.obj.position.y = 0.22 + Math.sin(elapsedTime * 4.2 + p.uid) * 0.09;
          p.model.obj.rotation.y += dt * 2.2;
        } else if (p.hitWobble > 0) {
          p.model.obj.rotation.z = Math.sin(elapsedTime * 48) * 0.16;
        } else {
          p.model.obj.rotation.z = 0;
        }
      }
    }
  }

  // === Rich HUD Snapshot (Shells, Reload Progress, Active Blessings & Boss Status) ===
  function getHudSnapshot() {
    const activeRelic = pickups.find((p) => p.type === 'relic_weapon_crate' && p.hp > 0);

    let activeBoss = bossEntity && bossEntity.hp > 0 ? bossEntity : null;
    let aliveFinaleCount = 0;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e && e.hp > 0 && (e.isBoss || e.isFinaleTarget)) {
        aliveFinaleCount += 1;
        if (!activeBoss) {
          activeBoss = e;
          bossEntity = e;
        }
      }
    }
    if (isSoulslike && !souls.bossAwakened) {
      activeBoss = null;
    }

    const wpnDef = WEAPONS[currentWeaponId] || WEAPONS.club;
    const maxHp = stats ? stats.maxHp : player.maxHp;
    const progState = progression.getState();
    const goldTotal = progState.gold;
    const reloadProgress =
      player.isReloading && player.reloadDuration > 0
        ? +clamp(1 - player.reloadTimer / player.reloadDuration, 0, 1).toFixed(3)
        : 0;

    const elapsedWholeSec = Math.floor(elapsedRunTime);
    const endlessMm = String(Math.floor(elapsedWholeSec / 60)).padStart(2, '0');
    const endlessSs = String(elapsedWholeSec % 60).padStart(2, '0');
    const beastReady = Boolean((player.beastReady || player.seals >= 5) && player.beastTimeLeft <= 0);

    const activeLocked = getLockedTarget();

    return {
      hp: Math.max(0, Math.ceil(player.hp)),
      maxHp,
      damageBlock: stats ? stats.damageBlock : 0,
      dodgeChance: stats ? stats.dodgeChance : 0,
      xp: progState.heroXp ?? xp,
      xpNext: progState.heroXpNext ?? xpNext,
      xpToNext: progState.heroXpNext ?? xpNext,
      runXp: 0,
      runXpNext: 0,
      runPerkLevel: 0,
      runLevel: progState.heroLevel ?? runLevel,
      weaponRunLevel,
      weaponId: wpnDef.id,
      weaponNameRu:
        isSoulslike && souls.zoneMode === 'exterior_shore' && !souls.shoreSwordPickedUp
          ? 'Без оружия'
          : wpnDef.nameRu,
      weapon: wpnDef,
      weaponDef: wpnDef,
      ammo: player.ammo,
      maxAmmo: player.maxAmmo,
      usesMana: Boolean(stats?.usesMana && player.maxMana > 0),
      mana: +(player.mana || 0).toFixed(1),
      maxMana: player.maxMana || 0,
      manaRegen: stats?.manaRegen || 0,
      manaCost: stats?.manaCost || 0,
      mageElement: stats?.mageElement || null,
      isReloading: Boolean(player.isReloading),
      reloadProgress,
      reloadPerShellTime: stats?.reloadPerShellTime || 0,
      focusRatio: stats?.focusTime > 0 ? +clamp((player.standStillTimer || 0) / stats.focusTime, 0, 1).toFixed(2) : 1,
      activePerks: [],
      overdriveAmmo: player.overdriveAmmo,
      overdriveMaxAmmo: player.overdriveMax,
      goldTotal,
      gold: goldTotal,
      goldRun,
      runGold: goldRun,
      riftGold: progression.getRiftGold?.() ?? goldRun,
      kills,
      targetKills,
      finaleStarted,
      isEndless,
      isFreeRoam: freeRoamMode,
      endlessWave,
      elapsedSec: elapsedWholeSec,
      phaseText: freeRoamMode
        ? '🎯 Тренировочный полигон • Бей по мишени'
        : isSoulslike
          ? souls.zoneMode === 'exterior_shore'
            ? (souls.shoreSwordPickedUp ? 'Иди к Вратам Пепельного Ущелья' : 'Подбери Большую Дубину')
            : souls.bossDefeated
              ? 'Локация зачищена • [Esc] Меню'
              : souls.bossAwakened
                ? 'СУДИЯ РУИН'
                : (souls.zoneTitleRu === 'Тронный Зал' ? 'Тронный Зал' : 'Иди на север')
          : isEndless
            ? `♾️ Волна ${endlessWave} • ${endlessMm}:${endlessSs} • ☠️ ${kills}`
            : finaleStarted
              ? '💀 УБЕЙ БОССА!'
              : currentLevelDef.hasBoss
                ? bossSpawnCountdown <= 10.5
                  ? `⚠️ Босс через ${Math.max(1, Math.ceil(bossSpawnCountdown))} с!`
                  : `⏳ Босс: ${Math.max(1, Math.ceil(bossSpawnCountdown))} с • ☠️ ${kills}/${targetKills}`
                : `☠️ Орда: ${Math.min(kills, targetKills)} / ${targetKills}`,
      seals: player.seals,
      beastReady,
      beastTimeLeft: +Math.max(0, player.beastTimeLeft).toFixed(2),
      beastDuration: 10,
      hasCompanion: Boolean(companion),
      timeLeft: +Math.max(0, timeLeft).toFixed(1),
      levelNumber: currentLevelNumber,
      levelNameRu: freeRoamMode ? 'Тренировочный полигон' : (isSoulslike && souls.zoneMode === 'exterior_shore' ? 'Берег Пепельного Стока' : currentLevelDef.nameRu),
      boss: activeBoss && !(isSoulslike && (souls.escapeCutsceneActive || souls.bossEscaped || souls.zoneMode === 'exterior_shore'))
        ? {
            nameRu: aliveFinaleCount > 1 ? `${activeBoss.nameRu} (+${aliveFinaleCount - 1})` : activeBoss.nameRu,
            hp: Math.max(0, Math.ceil(activeBoss.hp)),
            maxHp: activeBoss.maxHp,
            isMiniBoss: Boolean(activeBoss.isMiniBoss),
            stagger: Math.round(activeBoss.stagger || 0),
            staggerMax: Math.round(activeBoss.staggerMax || 0),
            staggered: Boolean((activeBoss.staggeredTimer || 0) > 0),
            poise: Math.round(activeBoss.poise ?? 0),
            poiseMax: Math.round(activeBoss.poiseMax ?? 0),
            hyperArmored: Boolean(poiseCtrl.isEnemyHyperArmored(activeBoss)),
            punishWindow: activeBoss.soulsPunishWindow || null
          }
        : null,
      relicCratePos: activeRelic ? { x: activeRelic.x, z: activeRelic.z } : null,
      playerPos: { x: player.x, z: player.z },
      dashCooldown: +Math.max(0, player.dashCooldown || 0).toFixed(2),
      dashCooldownMax: isSoulslike ? 0.6833 : getDashCooldownMax(),
      comboStep: player.comboStep || 0,
      comboTimer: +Math.max(0, player.comboTimer || 0).toFixed(2),
      isSoulslike,
      souls: isSoulslike
        ? {
            stamina: Math.max(0, Math.round(soulsStaminaCtrl.getDisplayStamina())),
            staminaMax: soulsStaminaCtrl.getMaxStamina(),
            maxStamina: soulsStaminaCtrl.getMaxStamina(),
            staminaExhausted: Boolean(soulsStaminaCtrl.isExhausted()),
            isBlocking: Boolean(souls.isBlocking),
            parryActive: souls.parryWindowTimer > 0,
            guardBroken: souls.guardBreakTimer > 0,
            guardCounterReady: (souls.guardCounterTimer || 0) > 0,
            guardCounterTimer: +Math.max(0, souls.guardCounterTimer || 0).toFixed(2),
            canRiposte: Boolean(souls.canRiposte),
            riposteActive: Boolean(souls.activeRiposte),
            activeAttackKey: souls.activeAttack?.key || null,
            playerHyperArmor: Boolean(player.hasHyperArmor),
            inCombat: Boolean(souls.inCombat),
            flasks: souls.flasks,
            flasksMax: souls.flasksMax,
            flaskDrinking: souls.flaskDrinkTimer > 0,
            mobileAutoFlaskEnabled: Boolean(mobileAutoFlaskEnabled),
            mobileSmartLockEnabled: Boolean(mobileSmartLockEnabled),
            zoneTitleRu: souls.zoneTitleRu,
            zoneMode: souls.zoneMode || 'castle',
            bossAwakened: Boolean(souls.bossAwakened),
            bossDefeated: Boolean(souls.bossDefeated),
            bossEscaped: Boolean(souls.bossEscaped),
            escapedCastle: Boolean(souls.escapedCastle),
            shoreSwordPickedUp: Boolean(souls.shoreSwordPickedUp),
            shoreBonfireLit: Boolean(souls.shoreBonfireLit),
            canOpenBossDoors: Boolean(souls.canOpenBossDoors),
            canRestAtBonfire: Boolean(souls.canRestAtBonfire),
            canInteract: Boolean(souls.canInteract || souls.canOpenBossDoors),
            bonfireCheckpointLit: Boolean(souls.bonfireCheckpointLit),
            interactLabel: souls.interactLabel || 'Открыть врата',
            interactPromptRu: souls.interactPromptRu || souls.interactLabel || 'Открыть врата',
            doorCutsceneActive: Boolean(souls.doorCutsceneActive || world?.isBossDoorCutsceneActive?.()),
            escapeCutsceneActive: Boolean(souls.escapeCutsceneActive || world?.isBossEscapeCutsceneActive?.()),
            subtitleSpeaker: (souls.doorCutsceneActive || souls.escapeCutsceneActive) ? (souls.cutsceneSubtitleSpeaker || '') : '',
            subtitleText: (souls.doorCutsceneActive || souls.escapeCutsceneActive) ? (souls.cutsceneSubtitleText || '') : '',
            showBossTitleCard: Boolean(souls.doorCutsceneActive && souls.cutsceneShowBossTitleCard),
            showLocationCard: Boolean(souls.escapeCutsceneActive && souls.cutsceneShowLocationCard),
            locationTitleRu: souls.cutsceneLocationTitleRu || 'БЕРЕГ ПЕПЕЛЬНОГО СТОКА',
            locationSubtitleRu: souls.cutsceneLocationSubtitleRu || 'ЗА СТЕНАМИ ЗАМКА ПЕПЛА',
            fadeToBlack01: souls.escapeCutsceneActive ? +(souls.cutsceneFadeToBlack01 || 0).toFixed(3) : 0,
            underwater01: souls.escapeCutsceneActive ? +(souls.cutsceneUnderwater01 || 0).toFixed(3) : 0,
            impactFlash01: souls.escapeCutsceneActive ? +(souls.cutsceneImpactFlash01 || 0).toFixed(3) : 0,
            slowMoFactor: souls.escapeCutsceneActive ? +(souls.cutsceneSlowMoFactor ?? 1).toFixed(3) : 1,
            cutsceneInstantSync: Boolean(souls.escapeCutsceneActive && souls.cutsceneInstantSync),
            canSkip: Boolean((souls.doorCutsceneActive || souls.escapeCutsceneActive) && souls.cutsceneCanSkip),
            bossTitleRu: souls.cutsceneBossTitleRu || BOSS_DOOR_CUTSCENE_ACTS.BOSS_TITLE_RU,
            bossSubtitleRu: souls.cutsceneBossSubtitleRu || BOSS_DOOR_CUTSCENE_ACTS.BOSS_SUBTITLE_RU,
            letterbox01: (souls.doorCutsceneActive || souls.escapeCutsceneActive) ? +(souls.cutsceneLetterbox01 || 0).toFixed(3) : 0
          }
        : null,
      onboardingDone: Boolean(progState.onboardingDone),
      isPlayerDying: Boolean(playerDying),
      isTargetLocked: Boolean(isSoulslike && activeLocked),
      lockedTargetName: isSoulslike && activeLocked ? (activeLocked.nameRu || 'Цель') : '',
      autoAim,
      attackEnabled
    };
  }

  function setAutoAim(enabled) {
    autoAim = Boolean(enabled);
    return autoAim;
  }

  function getAutoAim() {
    return autoAim;
  }

  function setAttackEnabled(enabled) {
    attackEnabled = Boolean(enabled);
    return attackEnabled;
  }

  function getAttackEnabled() {
    return attackEnabled;
  }

  // Debug helper for layout testing: place the hero at an exact coordinate and
  // report where the collision resolver actually put him.
  function debugTeleport(x, z) {
    if (!freeRoamMode && !/(?:^|[?&])qa=1(?:&|$)/i.test(window.location?.search || '')) return null;
    const resolved = resolveObstaclesAndBounds(x, z, player.radius, ARENA_PLAYER_LIMIT);
    player.x = resolved.x;
    player.z = resolved.z;
    return { x: resolved.x, z: resolved.z };
  }

  // Strictly ?qa=1 gated live inspection hook for automated Headless Edge combat/AI E2E tests.
  function getQaContext() {
    if (typeof window === 'undefined' || !/(?:^|[?&])qa=1(?:&|$)/i.test(window.location?.search || '')) {
      return null;
    }
    return {
      player,
      get heroModel() { return heroModel; },
      enemies,
      bossHazards,
      activeBurningZones,
      souls,
      weaponTrails,
      bossAiCtx,
      applyDamageToEnemy,
      applyDamageToPlayer,
      addBossStagger,
      startBossEscapeCutscene,
      skipBossEscapeCutscene,
      seekBossEscapeCutscene,
      teleportToExteriorShore,
      triggerBossParry: (boss) => applySoulsBossParry(boss, lastFrameElapsedTime, bossAiCtx),
      triggerMobParry: (mob) => {
        mob._mobActiveSwing = null;
        const mRes = onSoulsMobParried(mob, { stunSec: 2.6, riposteSec: 2.8 });
        mob.model?.handle?.cancelAttackAnim?.();
        if (mRes?.staggered) {
          mob.model?.handle?.playClampedClip?.('Stagger_Kneel', 1.0, 0.14);
        } else {
          mob.model?.handle?.triggerHitReact?.({ playClip: true, clipName: 'Hit_React', speed: 1.2, interruptAttack: true });
        }
        return mRes;
      },
      triggerBossMove: (boss, moveType) => {
        if (!boss) return false;
        souls.bossAwakened = true;
        boss.soulsThronePhase = 'done';
        boss.soulsAwake = true;
        boss.soulsState = 'stalk';
        boss.soulsTimer = 0;
        boss.model?.handle?.clearCutsceneClip?.(0);
        boss.model?.handle?.clearClampedClip?.(false, 0);
        boss.model?.handle?.setClipOverride?.(null);
        boss.soulsMoveCd = {
          leap_slam: 0,
          whirl_spin: 0,
          delayed_crush: 0,
          aaa_combo: 0,
          sweep_combo: 0,
          ash_fissure: 0,
          rising_upcut: 0,
          ram_thrust_hook: 0
        };
        boss._qaForceMove = moveType;
        return true;
      }
    };
  }

  // Debug helper: walk the arena without waves or damage (for layout testing).
  function setFreeRoam(enabled) {
    freeRoamMode = Boolean(enabled);
    if (freeRoamMode) {
      for (let i = 0; i < enemies.length; i++) {
        if (enemies[i]?.isSoulsBoss && enemies[i].model?.obj) {
          disposeSoulsBossVisuals(enemies[i].model.obj);
        }
        removeSceneObject(enemies[i].model.obj, enemies[i].model.handle);
      }
      enemies.length = 0;
      lockedEnemy = null;
      world?.setLockOnTarget?.(null);
      kills = 0;
      regularMobsSpawned = 0;
      timeLeft = 999;
    }
    return freeRoamMode;
  }

  function setLowSpecMode(enabled) {
    combatLowSpecMode = Boolean(enabled);
    soulsGameFeel.setLowSpec(combatLowSpecMode);
    weaponTrails?.setLowSpec?.(combatLowSpecMode);
    dissolveAsh?.setLowSpec?.(combatLowSpecMode);
  }

  return {
    startRun,
    revivePlayer,
    applyLevelUpChoice,
    triggerReload,
    setAutoAim,
    getAutoAim,
    setAttackEnabled,
    getAttackEnabled,
    toggleTargetLock,
    clearTargetLock,
    cycleTargetLock,
    getLockedTarget,
    handleMobileSmartLockTap,
    toggleMobileAutoFlask,
    setMobileAutoFlask,
    getMobileAutoFlask: () => mobileAutoFlaskEnabled,
    toggleMobileSmartLock,
    setMobileSmartLock,
    getMobileSmartLock: () => mobileSmartLockEnabled,
    setFreeRoam,
    getFreeRoam: () => freeRoamMode,
    isPlayerDying: () => playerDying,
    isSoulsBossAwakened: () => Boolean(isSoulslike && souls.bossAwakened),
    skipBossDoorCutscene,
    startBossEscapeCutscene,
    skipBossEscapeCutscene,
    seekBossEscapeCutscene,
    teleportToExteriorShore,
    equipWeapon: equipHeroWeapon,
    setLowSpecMode,
    debugTeleport,
    getQaContext,
    update,
    getHudSnapshot,
    disposeRun,
    stopRun: disposeRun
  };
}
