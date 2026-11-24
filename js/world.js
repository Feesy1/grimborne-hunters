// True-3D Dark-Fantasy Courtyard Arena (KayKit Dungeon & Halloween GLB/GLTF Architecture)
// + High-Craft Tracer Streaks, Muzzle Starbursts, Arcane Comet Projectiles & Pooled Voxel VFX

import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { DRACOLoader } from '../vendor/DRACOLoader.js';
import { ARENA_HALF_SIZE } from './config.js?v=20261125z102';
import { createSoulsArena } from './soulsArena.js?v=20261125z102';
import {
  BOSS_DOOR_CUTSCENE_DURATION,
  evaluateBossDoorCutscene,
  getBossDoorCutsceneSkipState,
  computeBossDoorCutsceneShakeOffset
} from './souls/soulsCutsceneChoreography.js?v=20261125z102';
import {
  BOSS_ESCAPE_CUTSCENE_DURATION,
  BOSS_ESCAPE_CUTSCENE_SKIP_TIME,
  BOSS_ESCAPE_ACTS,
  createBossEscapeCutsceneRig,
  createBossEscapeCutsceneState,
  sampleBossEscapeCutscene,
  getBossEscapeCutsceneSkipState,
  computeBossEscapeCameraShakeOffset
} from './souls/soulsEscapeCutscene.js?v=20261125z102';
import {
  EXTERIOR_SHORE_ANCHORS,
  createSoulsExteriorShore
} from './souls/soulsExteriorShore.js?v=20261125z102';
import { createSoulsEscapeVfx } from './souls/soulsEscapeVfx.js?v=20261125z102';
import {
  clampCastleCameraPosition,
  SOULS_CASTLE_CONSTANTS
} from './souls/soulsCastleLayout.js?v=20261125z102';
import { createSoulsEnvironmentMap } from './souls/soulsLightingRig.js?v=20261125z102';
import { applyEldenDissolveToModel } from './souls/soulsDissolveVfx.js?v=20261125z102';
import * as SoulsFireVfx from './souls/soulsFireVfx.js?v=20261125z102';
import {
  createCourtyardStoneTexture,
  createHubMistTexture,
  createSoftGlowTexture,
  createBloomHaloTexture,
  createSnowflakeTexture,
  createAshEmberTexture,
  createHubContactAoTexture,
  createArcaneCircleTexture,
  getSlashCrescentGeo
} from './world/textures.js?v=20261125z102';

const sharedDracoLoader = new DRACOLoader();
sharedDracoLoader.setDecoderPath('./vendor/draco/');
const sharedGltfLoader = new GLTFLoader();
sharedGltfLoader.setDRACOLoader(sharedDracoLoader);

const _tmpColor = new THREE.Color();
const _tmpParticleColor = new THREE.Color();

// ============================================================================
// Main 3D Arena World Factory
// ============================================================================
export function createArenaWorld(canvas) {
  const isMobileDevice =
    typeof navigator !== 'undefined' &&
    (/iPhone|iPod|iPad|Android/i.test(navigator.userAgent || '') ||
      ((navigator.maxTouchPoints || 0) > 1 && Math.min(window.innerWidth || 1280, window.innerHeight || 720) <= 1024));
  const nativeDpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
  const baseMaxDpr = isMobileDevice ? 1.0 : 1.35;
  let lowSpecMode = false;
  const getTargetPixelRatio = () =>
    Math.min(typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : nativeDpr, lowSpecMode ? (isMobileDevice ? 0.85 : 1.0) : baseMaxDpr);

  const renderer = new THREE.WebGLRenderer({
    canvas: canvas || undefined,
    alpha: false,
    stencil: true,
    antialias: !isMobileDevice && nativeDpr < 1.5,
    powerPreference: 'high-performance'
  });
  renderer.setClearColor(0x181326, 1);
  renderer.setPixelRatio(getTargetPixelRatio());
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = isMobileDevice ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.28;

  if (renderer.domElement) {
    renderer.domElement.addEventListener(
      'webglcontextlost',
      (e) => {
        e.preventDefault();
      },
      false
    );
    renderer.domElement.addEventListener(
      'webglcontextrestored',
      () => {
        const vp = window.__getGameViewportSize?.();
        const w = vp?.w || window.innerWidth;
        const h = vp?.h || window.innerHeight;
        renderer.setPixelRatio(getTargetPixelRatio());
        renderer.setSize(w, h);
      },
      false
    );
  }

  const scene = new THREE.Scene();

  const PALETTE_NORMAL = {
    bg: new THREE.Color(0x161b30),
    fog: new THREE.Color(0x1b213a),
    hemiSky: new THREE.Color(0x9fb8ff),
    hemiGround: new THREE.Color(0x4a405c),
    dir: new THREE.Color(0xdfe8ff),
    plazaRune: new THREE.Color(0xa855f7)
  };
  const PALETTE_FOREST = {
    bg: new THREE.Color(0x2a1f45),
    fog: new THREE.Color(0x3a265c),
    hemiSky: new THREE.Color(0xd8ccff),
    hemiGround: new THREE.Color(0x634a78),
    dir: new THREE.Color(0xebe8ff),
    plazaRune: new THREE.Color(0xc084fc)
  };
  const PALETTE_FROST = {
    bg: new THREE.Color(0x13283d),
    fog: new THREE.Color(0x1f4562),
    hemiSky: new THREE.Color(0xbceeff),
    hemiGround: new THREE.Color(0x3a647a),
    dir: new THREE.Color(0xdff6ff),
    plazaRune: new THREE.Color(0x38bdf8)
  };
  const PALETTE_ASH = {
    bg: new THREE.Color(0x1c0f12),
    fog: new THREE.Color(0x3b1518),
    hemiSky: new THREE.Color(0xffb49a),
    hemiGround: new THREE.Color(0x9a2c18),
    dir: new THREE.Color(0xffd7c2),
    plazaRune: new THREE.Color(0xf97316)
  };
  const PALETTE_BOSS = {
    bg: new THREE.Color(0x281320),
    fog: new THREE.Color(0x2c1625),
    hemiSky: new THREE.Color(0xff8fa3),
    hemiGround: new THREE.Color(0x582c42),
    dir: new THREE.Color(0xffe0e8),
    plazaRune: new THREE.Color(0xf43f5e)
  };
  const PALETTE_SOULS = {
    bg: new THREE.Color(0x0a0d16),
    fog: new THREE.Color(0x0d1220),
    hemiSky: new THREE.Color(0x5a7cb8),
    hemiGround: new THREE.Color(0x2a1710),
    dir: new THREE.Color(0xa8c8ff),
    plazaRune: new THREE.Color(0xf59e0b)
  };
  const PALETTE_SOULS_SHAFT = {
    bg: new THREE.Color(0x04070e),
    fog: new THREE.Color(0x050a16),
    hemiSky: new THREE.Color(0x305478),
    hemiGround: new THREE.Color(0x0e1824),
    dir: new THREE.Color(0x7ca2d6),
    plazaRune: new THREE.Color(0x38bdf8)
  };
  const PALETTE_SOULS_SHORE = {
    bg: new THREE.Color(0x0b1525),
    fog: new THREE.Color(0x17253a),
    hemiSky: new THREE.Color(0x7ba4dc),
    hemiGround: new THREE.Color(0x233045),
    dir: new THREE.Color(0xc8dfff),
    plazaRune: new THREE.Color(0xf59e0b)
  };
  let soulsZoneMode = 'castle'; // 'castle' | 'shaft_river' | 'exterior_shore'
  const PALETTE_HUB = {
    bg: new THREE.Color(0x221630),
    fog: new THREE.Color(0x2d1c38),
    hemiSky: new THREE.Color(0x6b5b95),
    hemiGround: new THREE.Color(0x4a2c2a),
    dir: new THREE.Color(0xdec8d4),
    plazaRune: new THREE.Color(0xf97316)
  };
  function getBiomeForLevel(levelNumber = 1) {
    const lvl = Math.max(1, Math.floor(Number(levelNumber) || 1));
    if (lvl === 26) return 'souls_citadel';
    if (lvl >= 21) return 'ash_citadel';
    if (lvl >= 16) return 'frost_ruins';
    if (lvl >= 6) return 'misty_forest';
    return 'courtyard';
  }
  function resolveBiomeId(biomeOrLevel = 'courtyard', levelNumber = null) {
    if (typeof biomeOrLevel === 'number' && Number.isFinite(biomeOrLevel)) {
      return getBiomeForLevel(biomeOrLevel);
    }
    const raw = typeof biomeOrLevel === 'string' ? biomeOrLevel.trim().toLowerCase() : '';
    if (raw === 'souls_citadel' || raw === 'frost_ruins' || raw === 'ash_citadel') return raw;
    if (levelNumber !== null && levelNumber !== undefined && Number.isFinite(Number(levelNumber))) {
      return getBiomeForLevel(Number(levelNumber));
    }
    if (raw === 'misty_forest') return 'misty_forest';
    return 'courtyard';
  }
  let currentBiome = 'souls_citadel';
  const isMistyBiome = () => false;
  const isSoulsBiome = (b = currentBiome) => b === 'souls_citadel';
  const getCombatBasePalette = () => {
    if (currentBiome === 'souls_citadel') return PALETTE_SOULS;
    if (currentBiome === 'frost_ruins') return PALETTE_FROST;
    if (currentBiome === 'ash_citadel') return PALETTE_ASH;
    if (currentBiome === 'misty_forest') return PALETTE_FOREST;
    return PALETTE_NORMAL;
  };
  // Never overwrite PALETTE_SOULS with neon-pink PALETTE_BOSS during Souls boss fights!
  const getActiveCombatPalette = () => {
    if (isSoulsBiome(currentBiome)) {
      if (soulsZoneMode === 'shaft_river') return PALETTE_SOULS_SHAFT;
      if (soulsZoneMode === 'exterior_shore') return PALETTE_SOULS_SHORE;
      return PALETTE_SOULS;
    }
    return bossModeActive ? PALETTE_BOSS : getCombatBasePalette();
  };

  // Linear HDR Gothic Cathedral PMREM environment map strictly for souls_citadel
  // (from soulsLightingRig.js: moonlit clerestory + dark stone ribs + warm firelight bounce; null in Hub & PvE)
  let soulsEnvRenderTarget = null;
  let soulsEnvMap = null;
  function getSoulsEnvMap() {
    if (soulsEnvMap) return soulsEnvMap;
    try {
      soulsEnvMap = createSoulsEnvironmentMap(renderer, { isMobile: isMobileDevice });
    } catch {
      soulsEnvMap = null;
    }
    return soulsEnvMap;
  }
  const getCombatExposureForBiome = (b = currentBiome) => {
    if (b === 'souls_citadel') return 1.12;
    if (b === 'misty_forest') return COMBAT_FOREST_EXPOSURE;
    if (b === 'frost_ruins' || b === 'ash_citadel') return 1.36;
    return COMBAT_EXPOSURE;
  };
  const getCombatAmbientColorForBiome = (b = currentBiome) => {
    if (b === 'souls_citadel') return 0x64708c;
    if (b === 'frost_ruins') return 0x7aaec9;
    if (b === 'ash_citadel') return 0xa66e64;
    return COMBAT_AMBIENT_COLOR;
  };
  const getCombatFogForBiome = (b = currentBiome, isModeSwitch = false) => {
    if (b === 'souls_citadel') {
      if (soulsZoneMode === 'shaft_river') return { near: 8, far: 48 };
      if (soulsZoneMode === 'exterior_shore') return { near: 26, far: 166 };
      return { near: 14, far: 58 };
    }
    if (b === 'frost_ruins') return { near: 46, far: 116 };
    if (b === 'ash_citadel') return { near: 44, far: 114 };
    if (b === 'misty_forest') return { near: 48, far: isModeSwitch ? 122 : 120 };
    return { near: 48, far: 112 };
  };
  const getOuterGroundColorForBiome = (b = currentBiome) => {
    if (b === 'souls_citadel') return 0x090a10;
    if (b === 'frost_ruins') return 0x102436;
    if (b === 'ash_citadel') return 0x1a0b0d;
    if (b === 'misty_forest') return 0x221638;
    return 0x161728;
  };

  scene.background = PALETTE_NORMAL.bg.clone();
  scene.fog = new THREE.Fog(PALETTE_NORMAL.fog.clone(), 48, 112);

  const COMBAT_CAM_OFFSET = new THREE.Vector3(0, 17.4, 13.15);
  const HUB_CAM_POS = new THREE.Vector3(0, 2.45, 4.9);
  const HUB_LOOK_TARGET = new THREE.Vector3(0, 1.15, 0);

  const camera = new THREE.PerspectiveCamera(
    44,
    Math.max(window.innerWidth, 1) / Math.max(window.innerHeight, 1),
    0.35,
    360
  );
  camera.position.copy(COMBAT_CAM_OFFSET);
  camera.lookAt(0, 0.5, 0);

  // ==========================================================================
  // Crisp Moonlit Dark-Fantasy Lighting Rig (with saved Combat vs Hub values)
  // ==========================================================================
  const COMBAT_EXPOSURE = 1.28;
  const COMBAT_FOREST_EXPOSURE = 1.38;
  const HUB_EXPOSURE = 1.10;
  const COMBAT_HEMI_INTENSITY = 1.95;
  const HUB_HEMI_INTENSITY = 1.25;
  const COMBAT_AMBIENT_COLOR = 0x858cb8;
  const COMBAT_AMBIENT_INTENSITY = 0.96;
  const HUB_AMBIENT_COLOR = 0x524873;
  const HUB_AMBIENT_INTENSITY = 0.50;
  const COMBAT_DIR_INTENSITY = 2.82;
  const HUB_DIR_INTENSITY = 1.30;
  const COMBAT_HERO_AURA_COLOR = 0xffe2b0;
  const COMBAT_HERO_AURA_INTENSITY = 1.85;
  const HUB_HERO_AURA_COLOR = 0xd2bfe0;
  const HUB_HERO_AURA_INTENSITY = 0.35;

  const hemiLight = new THREE.HemisphereLight(
    PALETTE_FOREST.hemiSky.getHex(),
    PALETTE_FOREST.hemiGround.getHex(),
    COMBAT_HEMI_INTENSITY
  );
  scene.add(hemiLight);

  const ambientLight = new THREE.AmbientLight(COMBAT_AMBIENT_COLOR, COMBAT_AMBIENT_INTENSITY);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(PALETTE_FOREST.dir.getHex(), COMBAT_DIR_INTENSITY);
  dirLight.position.set(14, 28, 16);
  dirLight.castShadow = true;
  const shadMapRes = isMobileDevice ? 512 : 1024;
  dirLight.shadow.mapSize.set(shadMapRes, shadMapRes);
  dirLight.shadow.camera.near = 4;
  dirLight.shadow.camera.far = 75;
  const shadowExtent = 21;
  dirLight.shadow.camera.left = -shadowExtent;
  dirLight.shadow.camera.right = shadowExtent;
  dirLight.shadow.camera.top = shadowExtent;
  dirLight.shadow.camera.bottom = -shadowExtent;
  dirLight.shadow.bias = -0.0004;
  dirLight.shadow.normalBias = 0.04;
  scene.add(dirLight);
  scene.add(dirLight.target);

  const heroAuraLight = new THREE.PointLight(COMBAT_HERO_AURA_COLOR, COMBAT_HERO_AURA_INTENSITY, 16.5, 1.35);
  heroAuraLight.position.set(0, 3.2, 0);
  scene.add(heroAuraLight);

  // Hub Showcase Dusk Key & Right-Back Sunset Rim (scene-matched to hub_stage_bg.jpg)
  const hubKeySpotLight = new THREE.SpotLight(0xe2cfd8, 2.0, 16, Math.PI * 0.30, 0.80, 1.1);
  hubKeySpotLight.position.set(-1.3, 3.6, 4.3);
  hubKeySpotLight.target.position.set(0, 1.05, 0);
  hubKeySpotLight.visible = false;
  scene.add(hubKeySpotLight);
  scene.add(hubKeySpotLight.target);

  const hubRimLight = new THREE.PointLight(0xff7854, 2.8, 11.5, 1.2);
  hubRimLight.position.set(2.5, 2.7, -2.2);
  hubRimLight.visible = false;
  scene.add(hubRimLight);

  // ==========================================================================
  // True-3D Courtyard Ground & Etched Arcane Rune Circles (Zero 2D stretch!)
  // ==========================================================================
  const arenaGroup = new THREE.Group();
  scene.add(arenaGroup);

  // Clean standalone arena scene for chapters 6+ (painted plate + 3D props),
  // created and downloaded lazily ONLY when entering misty_forest / frost_ruins / ash_citadel.
  const mistyArena = null;
  function ensureMistyArena() {
    return null;
  }

  let soulsArena = null;
  let soulsExteriorShore = null;
  let soulsEscapeVfx = null;
  let soulsEscapePrewarmed = false;
  let pendingShoreSwordMesh = null;
  let phase2ArenaFireRingCtrl = null;
  function ensurePhase2ArenaFireRing() {
    if (!phase2ArenaFireRingCtrl && typeof SoulsFireVfx.createPhase2ArenaFireRingController === 'function') {
      phase2ArenaFireRingCtrl = SoulsFireVfx.createPhase2ArenaFireRingController({
        isMobile: isMobileDevice,
        lowSpec: lowSpecMode,
        getGroundHeight
      });
      if (phase2ArenaFireRingCtrl?.group) {
        arenaGroup.add(phase2ArenaFireRingCtrl.group);
      }
    }
    return phase2ArenaFireRingCtrl;
  }

  function triggerPhase2ArenaFireWave(originX = 0, originZ = -44) {
    if (originX && typeof originX === 'object') {
      const opts = originX;
      originX = Number.isFinite(opts.x) ? opts.x : (Number.isFinite(opts.originX) ? opts.originX : 0);
      originZ = Number.isFinite(opts.z) ? opts.z : (Number.isFinite(opts.originZ) ? opts.originZ : -44);
    }
    const bx = Number.isFinite(Number(originX)) ? Number(originX) : 0;
    const bz = Number.isFinite(Number(originZ)) ? Number(originZ) : -44;
    const ctrl = ensurePhase2ArenaFireRing();
    ctrl?.trigger?.(bx, bz);
    return Boolean(ctrl);
  }

  function prewarmSoulsEscapeStages() {
    if (soulsEscapePrewarmed) return;
    soulsEscapePrewarmed = true;
    try {
      const shore = ensureSoulsExteriorShore();
      const vfx = ensureSoulsEscapeVfx();
      const prevArenaVis = soulsArena?.group ? soulsArena.group.visible : false;
      const prevVfxVis = vfx?.rootGroup ? vfx.rootGroup.visible : false;
      shore?.setCompilePreview?.(true);
      if (vfx?.rootGroup) vfx.rootGroup.visible = true;
      // Compile shaders ONCE for castle-visible lighting state AND shore/shaft-only lighting state (including boss hidden!)
      // so ZERO HLSL/WebGL shader-compile hitches ever occur during the escape cutscene!
      if (soulsArena?.group) soulsArena.group.visible = true;
      renderer.compile(scene, camera);
      const hiddenLanterns = [];
      scene.traverse((o) => {
        if (o && o.isPointLight && o.name === 'bossShoulderLanternLight' && o.visible) {
          o.visible = false;
          hiddenLanterns.push(o);
        }
      });
      if (soulsArena?.group) soulsArena.group.visible = false;
      renderer.compile(scene, camera);
      for (let i = 0; i < hiddenLanterns.length; i++) hiddenLanterns[i].visible = true;
      if (soulsArena?.group) soulsArena.group.visible = prevArenaVis;
      if (vfx?.rootGroup) vfx.rootGroup.visible = prevVfxVis;
      shore?.setCompilePreview?.(false);
    } catch {}
  }

  function ensureSoulsArena() {
    if (!soulsArena) {
      soulsArena = createSoulsArena();
      if (lowSpecMode) soulsArena.setLowSpecMode?.(true);
      arenaGroup.add(soulsArena.group);
    }
    ensurePhase2ArenaFireRing();
    ensureSoulsExteriorShore();
    ensureSoulsEscapeVfx();
    return soulsArena;
  }

  function ensureSoulsExteriorShore() {
    if (!soulsExteriorShore) {
      soulsExteriorShore = createSoulsExteriorShore(THREE, {
        isMobile: isMobileDevice,
        lowSpec: lowSpecMode,
        gltfLoader: sharedGltfLoader
      });
      if (soulsExteriorShore?.rootGroup) {
        arenaGroup.add(soulsExteriorShore.rootGroup);
      }
      if (pendingShoreSwordMesh) {
        soulsExteriorShore?.attachRealSwordModel?.(pendingShoreSwordMesh);
      }
      soulsExteriorShore?.setStageMode?.('none');
    }
    return soulsExteriorShore;
  }

  function ensureSoulsEscapeVfx() {
    if (!soulsEscapeVfx) {
      soulsEscapeVfx = createSoulsEscapeVfx(THREE, {
        parent: arenaGroup,
        isMobile: isMobileDevice,
        lowSpec: lowSpecMode,
        active: false
      });
    }
    return soulsEscapeVfx;
  }

  function attachShoreRealSwordModel(swordMesh) {
    if (!swordMesh) return false;
    pendingShoreSwordMesh = swordMesh;
    if (soulsExteriorShore) {
      return Boolean(soulsExteriorShore.attachRealSwordModel?.(swordMesh));
    }
    return true;
  }

  function setSoulsZoneMode(mode = 'castle') {
    const next = mode === 'exterior_shore'
      ? 'exterior_shore'
      : mode === 'shaft_river'
        ? 'shaft_river'
        : 'castle';
    soulsZoneMode = next;
    const isSouls = isSoulsBiome(currentBiome);
    if (!isSouls) return soulsZoneMode;

    if (next === 'castle') {
      const sa = ensureSoulsArena();
      if (sa?.group) sa.group.visible = true;
      if (soulsExteriorShore) {
        soulsExteriorShore.setStageMode?.(bossEscapeCutsceneActive && bossEscapeChasmEnabled ? 'chasm_only' : 'none');
      }
    } else if (next === 'shaft_river') {
      if (soulsArena?.group) soulsArena.group.visible = false;
      phase2ArenaFireRingCtrl?.reset?.();
      const shore = ensureSoulsExteriorShore();
      shore?.setStageMode?.('shaft_river');
    } else {
      if (soulsArena?.group) soulsArena.group.visible = false;
      phase2ArenaFireRingCtrl?.reset?.();
      const shore = ensureSoulsExteriorShore();
      shore?.setStageMode?.('exterior_shore');
    }

    if (cameraMode !== 'hub') {
      const pal = getActiveCombatPalette();
      const fogCfg = getCombatFogForBiome(currentBiome, false);
      if (scene.background) scene.background.copy(pal.bg);
      renderer.setClearColor(pal.bg.getHex(), 1);
      scene.fog.color.copy(pal.fog);
      scene.fog.near = fogCfg.near;
      scene.fog.far = fogCfg.far;
      hemiLight.color.copy(pal.hemiSky);
      hemiLight.groundColor.copy(pal.hemiGround);
      dirLight.color.copy(pal.dir);
      // Drive nocturnal moonlight / cavern bounce cleanly through permanent lights (0 extra lights -> 0 shader recompile!)
      if (next === 'exterior_shore') {
        hemiLight.intensity = 1.48;
        dirLight.intensity = 2.15;
        ambientLight.intensity = 0.36;
        const extShad = isMobileDevice ? 14.5 : 19.5;
        dirLight.shadow.camera.left = -extShad;
        dirLight.shadow.camera.right = extShad;
        dirLight.shadow.camera.top = extShad;
        dirLight.shadow.camera.bottom = -extShad;
        dirLight.shadow.camera.near = 2;
        dirLight.shadow.camera.far = 76;
        dirLight.shadow.camera.updateProjectionMatrix();
        burningGroundLight.color.setHex(0xff8a28);
        burningGroundLight.distance = 24;
        burningGroundLight.decay = 1.5;
        burningGroundLight.position.set(EXTERIOR_SHORE_ANCHORS.bonfirePos.x, 1.85, EXTERIOR_SHORE_ANCHORS.bonfirePos.z);
        burningGroundLight.intensity = soulsExteriorShore?.isBonfireLit?.() ? 9.5 : 1.8;
        // Cinematic Dark Souls / Bloodborne outdoor over-the-shoulder pitch so Full Moon, arches & peaks frame the horizon!
        if (orbitTargetPitch > 0.28) {
          orbitPitch = orbitTargetPitch = 0.20;
          orbitDist = orbitTargetDist = Math.min(orbitTargetDist, 7.2);
          soulsCamClipDist = orbitDist;
        }
      } else if (next === 'shaft_river') {
        hemiLight.intensity = 0.92;
        dirLight.intensity = 1.25;
        burningGroundLight.color.setHex(0x8ec4ff);
        burningGroundLight.position.set(0, 5.2, 26.0);
        burningGroundLight.intensity = 5.5;
      } else {
        hemiLight.intensity = 0.78;
        dirLight.intensity = 1.12;
        burningGroundLight.intensity = 0;
      }
    }
    return soulsZoneMode;
  }

  const courtyardPropsGroup = new THREE.Group();
  courtyardPropsGroup.visible = true;
  // Original courtyard props were authored for a 54 m arena — scale the whole
  // group so the old map keeps its exact proportional layout after enlargement.
  courtyardPropsGroup.scale.setScalar(ARENA_HALF_SIZE / 27);
  arenaGroup.add(courtyardPropsGroup);

  const B = ARENA_HALF_SIZE; // 23
  const arenaSpan = B * 2;
  const cobbleTex = createCourtyardStoneTexture();
  const hubMistTex = createHubMistTexture();
  const softGlowTex = createSoftGlowTexture();
  const bloomHaloTex = createBloomHaloTexture();
  const snowflakeTex = createSnowflakeTexture();
  const ashEmberTex = createAshEmberTexture();
  const arcaneCircleTex = createArcaneCircleTexture();

  // Adaptive lightweight pseudo-bloom intensity (zero extra render targets — keeps MSAA & 60 FPS)
  const getBloomIntensityScale = () => (lowSpecMode ? 0.55 : isMobileDevice ? 0.78 : 1.0);
  const adaptiveBloomMaterials = [];
  function registerAdaptiveBloomMat(mat, baseOpacity) {
    adaptiveBloomMaterials.push({ mat, baseOpacity });
    mat.opacity = baseOpacity * getBloomIntensityScale();
    return mat;
  }
  function refreshAdaptiveBloomMaterials() {
    const sc = getBloomIntensityScale();
    for (let i = 0; i < adaptiveBloomMaterials.length; i++) {
      const entry = adaptiveBloomMaterials[i];
      entry.mat.opacity = entry.baseOpacity * sc;
    }
  }

  function getGroundHeight(x = 0, z = 0, currentY) {
    if (isSoulsBiome(currentBiome)) {
      if (soulsZoneMode === 'exterior_shore') {
        const shore = ensureSoulsExteriorShore();
        const sh = shore?.getGroundY?.(x, z, currentY);
        return Number.isFinite(sh) ? sh : 0;
      }
      if (soulsZoneMode === 'shaft_river') {
        return 0;
      }
      if (typeof soulsArena?.getFloorHeight === 'function') {
        const h = soulsArena.getFloorHeight(x, z);
        return Number.isFinite(h) ? h : 0;
      }
    }
    return 0;
  }

  // Crisp Grounding Contact Shadow Disc right under the Hero's boots in Combat (eliminates any floating illusion!)
  const combatContactShadowMat = new THREE.MeshBasicMaterial({
    map: softGlowTex,
    color: 0x05030a,
    transparent: true,
    opacity: 0.62,
    depthWrite: false
  });
  const combatHeroContactShadow = new THREE.Mesh(new THREE.PlaneGeometry(1.42, 1.42), combatContactShadowMat);
  combatHeroContactShadow.rotation.x = -Math.PI / 2;
  combatHeroContactShadow.position.set(0, 0.02, 0);
  combatHeroContactShadow.renderOrder = 2;
  arenaGroup.add(combatHeroContactShadow);

  const outerGround = new THREE.Mesh(
    new THREE.PlaneGeometry(210, 210),
    new THREE.MeshStandardMaterial({ color: 0x161728, roughness: 0.95, metalness: 0.05 })
  );
  outerGround.rotation.x = -Math.PI / 2;
  outerGround.position.y = -0.06;
  outerGround.receiveShadow = true;
  arenaGroup.add(outerGround);

  const groundMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(arenaSpan + 6, arenaSpan + 6),
    new THREE.MeshStandardMaterial({
      map: cobbleTex,
      color: 0xe8e6f0,
      emissive: 0x161422,
      emissiveMap: cobbleTex,
      emissiveIntensity: 0.32,
      roughness: 0.84,
      metalness: 0.05
    })
  );
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.receiveShadow = true;
  groundMesh.visible = true;
  arenaGroup.add(groundMesh);

  // Hub Showcase Raised Stone Pedestal + Pedestal Mystic Circle (visible ONLY in 'hub' mode — zero confusing floor circles in combat!)
  const plazaRuneMat = new THREE.MeshBasicMaterial({
    map: arcaneCircleTex,
    color: 0xc084fc,
    transparent: true,
    opacity: 0.52,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const HUB_PEDESTAL_TOP_Y = 0.0;

  const hubBackdropGroup = new THREE.Group();
  hubBackdropGroup.visible = false;
  scene.add(hubBackdropGroup);

  // Real 3D Shadow Catcher + Soft Contact AO grounding the hero's boots to the 2D stone pedestal!
  const hubShadowCatcher = new THREE.Mesh(
    new THREE.CircleGeometry(1.85, 32),
    new THREE.ShadowMaterial({
      color: 0x120a24,
      opacity: 0.46,
      depthWrite: false
    })
  );
  hubShadowCatcher.rotation.x = -Math.PI / 2;
  hubShadowCatcher.position.set(0, HUB_PEDESTAL_TOP_Y + 0.002, 0);
  hubShadowCatcher.receiveShadow = true;
  hubShadowCatcher.renderOrder = 1;
  hubShadowCatcher.visible = true;
  hubBackdropGroup.add(hubShadowCatcher);

  const hubContactAoTex = createHubContactAoTexture();
  const hubContactAoMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.55, 1.55),
    new THREE.MeshBasicMaterial({
      map: hubContactAoTex,
      transparent: true,
      opacity: 0.56,
      depthWrite: false
    })
  );
  hubContactAoMesh.rotation.x = -Math.PI / 2;
  hubContactAoMesh.position.set(0, HUB_PEDESTAL_TOP_Y + 0.004, 0);
  hubContactAoMesh.renderOrder = 2;
  hubContactAoMesh.visible = true;
  hubBackdropGroup.add(hubContactAoMesh);

  // Soft Golden Arsenal Forge Pool & Feathered Volumetric Mist (ZERO hard ring / trapezoid edges!)
  const hubArsenalGlowGroup = new THREE.Group();
  hubArsenalGlowGroup.visible = false;
  hubBackdropGroup.add(hubArsenalGlowGroup);

  const arsenalDiscMat = new THREE.MeshBasicMaterial({
    map: softGlowTex,
    color: 0xffb836,
    transparent: true,
    opacity: 0.86,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });
  const arsenalGlowDisc = new THREE.Mesh(new THREE.PlaneGeometry(1.92, 1.18), arsenalDiscMat);
  arsenalGlowDisc.rotation.x = -Math.PI / 2;
  arsenalGlowDisc.position.set(0, 0.012, 0.06);

  const arsenalCoreDiscMat = new THREE.MeshBasicMaterial({
    map: softGlowTex,
    color: 0xfff3b0,
    transparent: true,
    opacity: 0.58,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });
  const arsenalCoreDisc = new THREE.Mesh(new THREE.PlaneGeometry(1.12, 0.68), arsenalCoreDiscMat);
  arsenalCoreDisc.rotation.x = -Math.PI / 2;
  arsenalCoreDisc.position.set(0, 0.015, 0.06);

  const arsenalMistUniforms = {
    uTime: { value: 0 },
    uOpacity: { value: 0.34 }
  };
  const arsenalBeamMat = new THREE.ShaderMaterial({
    uniforms: arsenalMistUniforms,
    transparent: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormalV = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      void main() {
        float edgeFade = pow(abs(dot(normalize(vNormalV), normalize(vViewDir))), 1.85);
        float bottomFade = smoothstep(0.0, 0.18, vUv.y);
        float topFade = pow(clamp(1.0 - vUv.y, 0.0, 1.0), 2.75);
        float shimmer = 0.86 + 0.14 * sin(vUv.x * 18.8495 - uTime * 1.9 + vUv.y * 4.0);
        vec3 col = mix(vec3(1.0, 0.62, 0.14), vec3(1.0, 0.92, 0.58), clamp(1.0 - vUv.y * 0.85, 0.0, 1.0));
        float alpha = edgeFade * bottomFade * topFade * shimmer * uOpacity;
        gl_FragColor = vec4(col, alpha);
      }
    `
  });
  const arsenalBeamCone = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.76, 1.48, 36, 1, true), arsenalBeamMat);
  arsenalBeamCone.position.set(0, 0.72, 0.06);

  const ARSENAL_SPARK_COUNT = 28;
  const arsenalSparkPos = new Float32Array(ARSENAL_SPARK_COUNT * 3);
  const arsenalSparkSeeds = new Float32Array(ARSENAL_SPARK_COUNT * 2);
  for (let i = 0; i < ARSENAL_SPARK_COUNT; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.68;
    arsenalSparkPos[i * 3] = Math.cos(a) * r;
    arsenalSparkPos[i * 3 + 1] = 0.05 + Math.random() * 1.35;
    arsenalSparkPos[i * 3 + 2] = 0.06 + Math.sin(a) * r * 0.65;
    arsenalSparkSeeds[i * 2] = 0.28 + Math.random() * 0.42;
    arsenalSparkSeeds[i * 2 + 1] = Math.random() * Math.PI * 2;
  }
  const arsenalSparkGeo = new THREE.BufferGeometry();
  arsenalSparkGeo.setAttribute('position', new THREE.BufferAttribute(arsenalSparkPos, 3));
  const arsenalSparkMat = new THREE.PointsMaterial({
    map: softGlowTex,
    color: 0xffe58f,
    size: 0.085,
    transparent: true,
    opacity: 0.88,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });
  const arsenalSparkPoints = new THREE.Points(arsenalSparkGeo, arsenalSparkMat);

  const arsenalForgeLight = new THREE.PointLight(0xffb732, 3.6, 7.5, 1.25);
  arsenalForgeLight.position.set(0, 0.62, 0.42);
  hubArsenalGlowGroup.add(arsenalGlowDisc, arsenalCoreDisc, arsenalBeamCone, arsenalSparkPoints, arsenalForgeLight);

  // Warm Flickering Lower-Left Campfire Light & Smoldering Sparks (matched to coals on the left of hub_stage_bg.jpg)
  const HUB_CAMPFIRE_BASE_INTENSITY = 2.4;
  const hubCampfireLight = new THREE.PointLight(0xff6b22, HUB_CAMPFIRE_BASE_INTENSITY, 8.5, 1.4);
  hubCampfireLight.position.set(-2.3, 0.85, 1.7);
  hubBackdropGroup.add(hubCampfireLight);

  const hubLeftFireGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.55, 1.15),
    new THREE.MeshBasicMaterial({
      map: softGlowTex,
      color: 0xff5a00,
      transparent: true,
      opacity: 0.36,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    })
  );
  hubLeftFireGlow.position.set(-2.32, 0.24, 0.72);
  hubLeftFireGlow.rotation.y = 0.32;
  hubBackdropGroup.add(hubLeftFireGlow);

  const HUB_LEFT_ASH_COUNT = 54;
  const hubLeftAshPos = new Float32Array(HUB_LEFT_ASH_COUNT * 3);
  const hubLeftAshSeeds = new Float32Array(HUB_LEFT_ASH_COUNT * 3);
  for (let i = 0; i < HUB_LEFT_ASH_COUNT; i++) {
    hubLeftAshPos[i * 3] = -2.65 + (Math.random() - 0.5) * 1.15;
    hubLeftAshPos[i * 3 + 1] = -0.08 + Math.random() * 2.45;
    hubLeftAshPos[i * 3 + 2] = 0.35 + (Math.random() - 0.5) * 1.1;
    hubLeftAshSeeds[i * 3] = 0.45 + Math.random() * 0.82;
    hubLeftAshSeeds[i * 3 + 1] = Math.random() * Math.PI * 2;
    hubLeftAshSeeds[i * 3 + 2] = 0.18 + Math.random() * 0.36;
  }
  const hubLeftAshGeo = new THREE.BufferGeometry();
  hubLeftAshGeo.setAttribute('position', new THREE.BufferAttribute(hubLeftAshPos, 3));
  const hubLeftAshMat = new THREE.PointsMaterial({
    map: softGlowTex,
    color: 0xff7b1c,
    size: 0.095,
    transparent: true,
    opacity: 0.78,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });
  const hubLeftAshPoints = new THREE.Points(hubLeftAshGeo, hubLeftAshMat);
  hubBackdropGroup.add(hubLeftAshPoints);

  // Existing flags inside hub_stage_bg.jpg are animated directly via UV cloth-wave shader on #hub-bg-plate (ZERO extra 3D flags!)
  const hubFlagUniforms = { uTime: { value: 0 } };

  // Subtle cool twilight violet separation on the left-back (opposite the warm right-back sunset rim)
  const hubBackFillLight = new THREE.PointLight(0x8c7ae6, 1.2, 10.5, 1.25);
  hubBackFillLight.position.set(-2.4, 2.8, -2.5);
  hubBackdropGroup.add(hubBackFillLight);

  // Floating Rising 3D Fire Embers & Drifting Ash across the Hub Stage
  const HUB_EMBER_COUNT = 115;
  const hubEmberPositions = new Float32Array(HUB_EMBER_COUNT * 3);
  const hubEmberSeeds = new Float32Array(HUB_EMBER_COUNT * 3);
  for (let i = 0; i < HUB_EMBER_COUNT; i++) {
    hubEmberPositions[i * 3] = (Math.random() - 0.5) * 8.2;
    hubEmberPositions[i * 3 + 1] = -0.15 + Math.random() * 3.8;
    hubEmberPositions[i * 3 + 2] = -2.8 + Math.random() * 5.2;
    hubEmberSeeds[i * 3] = 0.28 + Math.random() * 0.65;
    hubEmberSeeds[i * 3 + 1] = Math.random() * Math.PI * 2;
    hubEmberSeeds[i * 3 + 2] = 0.22 + Math.random() * 0.48;
  }
  const hubEmberGeo = new THREE.BufferGeometry();
  hubEmberGeo.setAttribute('position', new THREE.BufferAttribute(hubEmberPositions, 3));
  const hubEmberMat = new THREE.PointsMaterial({
    map: softGlowTex,
    color: 0xff8c2b,
    size: 0.082,
    transparent: true,
    opacity: 0.66,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });
  const hubEmbersPoints = new THREE.Points(hubEmberGeo, hubEmberMat);
  hubBackdropGroup.add(hubEmbersPoints);

  // Foreground Hero-Zone 3D Embers (drifting behind AND in front of the hero for true atmospheric depth)
  const HUB_FG_EMBER_COUNT = 30;
  const hubFgEmberPositions = new Float32Array(HUB_FG_EMBER_COUNT * 3);
  const hubFgEmberColors = new Float32Array(HUB_FG_EMBER_COUNT * 3);
  const hubFgEmberSeeds = new Float32Array(HUB_FG_EMBER_COUNT * 4); // speedY, phase, swirlAmpX, swirlAmpZ
  const _fgEmberColA = new THREE.Color(0xff8c32);
  const _fgEmberColB = new THREE.Color(0xffbe55);
  const _fgEmberColMix = new THREE.Color();
  for (let i = 0; i < HUB_FG_EMBER_COUNT; i++) {
    hubFgEmberPositions[i * 3] = (Math.random() - 0.5) * 4.8; // x: -2.4 .. +2.4
    hubFgEmberPositions[i * 3 + 1] = 0.05 + Math.random() * 2.75; // y: 0.05 .. 2.80
    // Bias half the sparks into positive Z so glowing embers pass cleanly in front of boots & cloak
    const frontBias = i % 2 === 0 ? (0.25 + Math.random() * 1.35) : (-1.2 + Math.random() * 2.8);
    hubFgEmberPositions[i * 3 + 2] = frontBias; // z: -1.2 .. +1.6
    _fgEmberColMix.copy(_fgEmberColA).lerp(_fgEmberColB, Math.random());
    hubFgEmberColors[i * 3] = _fgEmberColMix.r;
    hubFgEmberColors[i * 3 + 1] = _fgEmberColMix.g;
    hubFgEmberColors[i * 3 + 2] = _fgEmberColMix.b;
    hubFgEmberSeeds[i * 4] = 0.24 + Math.random() * 0.46;
    hubFgEmberSeeds[i * 4 + 1] = Math.random() * Math.PI * 2;
    hubFgEmberSeeds[i * 4 + 2] = 0.16 + Math.random() * 0.34;
    hubFgEmberSeeds[i * 4 + 3] = 0.08 + Math.random() * 0.18;
  }
  const hubFgEmberGeo = new THREE.BufferGeometry();
  hubFgEmberGeo.setAttribute('position', new THREE.BufferAttribute(hubFgEmberPositions, 3));
  hubFgEmberGeo.setAttribute('color', new THREE.BufferAttribute(hubFgEmberColors, 3));
  const hubFgEmberMat = new THREE.PointsMaterial({
    map: softGlowTex,
    vertexColors: true,
    size: 0.088,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });
  const hubFgEmbersPoints = new THREE.Points(hubFgEmberGeo, hubFgEmberMat);
  hubFgEmbersPoints.renderOrder = 6;
  hubBackdropGroup.add(hubFgEmbersPoints);

  // Subtle Low-Lying Twilight Ankle Mist across the pedestal front edge (blends hero boots into atmosphere)
  const hubAnkleMistGroup = new THREE.Group();
  hubBackdropGroup.add(hubAnkleMistGroup);
  const hubAnkleMistSpecs = [
    { x: -0.78, y: 0.22, z: 0.72, sx: 2.35, sy: 0.72, col: 0x5a4b82, op: 0.14, spd: 0.28, ampX: 0.36, ph: 0.4 },
    { x: 0.08, y: 0.16, z: 0.96, sx: 2.65, sy: 0.62, col: 0x62528c, op: 0.12, spd: 0.22, ampX: 0.42, ph: 2.3 },
    { x: 0.88, y: 0.30, z: 0.64, sx: 2.25, sy: 0.78, col: 0x56477d, op: 0.13, spd: 0.26, ampX: 0.34, ph: 4.1 }
  ];
  const hubAnkleMistSprites = hubAnkleMistSpecs.map((spec) => {
    const mat = new THREE.SpriteMaterial({
      map: hubMistTex,
      color: spec.col,
      transparent: true,
      opacity: spec.op,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(spec.x, HUB_PEDESTAL_TOP_Y + spec.y, spec.z);
    sprite.scale.set(spec.sx, spec.sy, 1);
    sprite.renderOrder = 4;
    hubAnkleMistGroup.add(sprite);
    return { sprite, mat, ...spec };
  });

  // ==========================================================================
  // Dynamic Flickering Campfire & Torch/Altar PointLights
  // ==========================================================================
  const lanterns = [];

  function addFlickerLight(
    x,
    y,
    z,
    colorHex,
    intensity,
    distance,
    phase = 0,
    withFireCone = false,
    parentGrp = courtyardPropsGroup
  ) {
    const pl = new THREE.PointLight(colorHex, intensity, distance, 1.45);
    pl.position.set(x, y, z);
    parentGrp.add(pl);

    let flameGrp = null;
    if (withFireCone) {
      flameGrp = new THREE.Group();
      flameGrp.position.set(x, 0.12, z);
      // 3D campfire logs + glowing layered flame cones
      const logMat = new THREE.MeshStandardMaterial({ color: 0x3b2416, roughness: 0.9 });
      for (let i = 0; i < 3; i++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.10, 0.95, 7), logMat);
        log.rotation.z = Math.PI / 2;
        log.rotation.y = (i / 3) * Math.PI;
        log.position.y = 0.08;
        flameGrp.add(log);
      }
      const outerFlame = new THREE.Mesh(
        new THREE.ConeGeometry(0.34, 0.85, 8),
        new THREE.MeshBasicMaterial({
          color: 0xf97316,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      outerFlame.position.y = 0.42;
      const innerFlame = new THREE.Mesh(
        new THREE.ConeGeometry(0.19, 0.58, 8),
        new THREE.MeshBasicMaterial({
          color: 0xfef08a,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      innerFlame.position.y = 0.34;
      const glowSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: softGlowTex,
          color: 0xff8c24,
          transparent: true,
          opacity: 0.65,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      glowSprite.scale.set(2.2, 2.2, 1);
      glowSprite.position.y = 0.48;
      flameGrp.add(outerFlame, innerFlame, glowSprite);
      parentGrp.add(flameGrp);
    }

    // Wide soft additive pseudo-bloom halo around courtyard torches, campfire & rune shrines
    const baseBloomOpacity = withFireCone ? 0.44 : 0.34;
    const baseBloomScale = withFireCone ? 4.8 : 3.6;
    const bloomMat = new THREE.SpriteMaterial({
      map: bloomHaloTex,
      color: colorHex,
      transparent: true,
      opacity: baseBloomOpacity * getBloomIntensityScale(),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    });
    const bloomSprite = new THREE.Sprite(bloomMat);
    bloomSprite.position.set(x, withFireCone ? 0.96 : Math.max(1.2, y * 0.78), z);
    bloomSprite.scale.set(baseBloomScale, baseBloomScale, 1);
    bloomSprite.renderOrder = 4;
    parentGrp.add(bloomSprite);

    lanterns.push({
      pointLight: pl,
      flameGrp,
      bloomSprite,
      bloomMat,
      baseBloomScale,
      baseBloomOpacity,
      parentGrp,
      baseIntensity: intensity,
      phase
    });
  }

  // Interior Landmark Colliders (well-spaced, snugly matched to visible 3D props!)
  const COURTYARD_OBSTACLES = [
    { x: -11.5, z: -9.0, radius: 1.95 }, // 1. Ruined Purple-Rune Altar Shrine
    { x: 13.0,  z: -6.5, radius: 1.85 }, // 2. Gnarled Dead Lantern Tree & Ribcage
    { x: -14.5, z: 5.5,  radius: 1.80 }, // 3. Campfire Cauldron & Pillars
    { x: 1.5,   z: -15.5,radius: 1.65 }, // 4. North Skull Candle Shrine
    { x: -6.5,  z: 12.5, radius: 1.65 }, // 5. South-West Coffin & Pillar Ruin
    { x: 9.5,   z: 11.5, radius: 1.55 }, // 6. South-East Rune Pillar Grave
    { x: 17.5,  z: 6.0,  radius: 1.70 }  // 7. East Ribcage & Stacked Crates
  ];

  const initCourtyardScale = ARENA_HALF_SIZE / 27;
  const obstacles = COURTYARD_OBSTACLES.map((o) => ({
    ...o,
    x: o.x * initCourtyardScale,
    z: o.z * initCourtyardScale
  }));

  // PvE graveyard courtyard props & lights removed — Castle of Ash arena loads cleanly via soulsArena.js!
  courtyardPropsGroup.visible = false;
  const ready = Promise.resolve();

  // Ambient floating spirit motes
  const moteCount = 90;
  const motePositions = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i++) {
    motePositions[i * 3] = (Math.random() - 0.5) * (arenaSpan - 4);
    motePositions[i * 3 + 1] = 0.5 + Math.random() * 4.5;
    motePositions[i * 3 + 2] = (Math.random() - 0.5) * (arenaSpan - 4);
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const moteMat = new THREE.PointsMaterial({
    color: 0xc084fc,
    size: 0.20,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const motesPoints = new THREE.Points(moteGeo, moteMat);
  scene.add(motesPoints);

  // ==========================================================================
  // Late-Act Biome Atmospheric Particles (Chapters 16–20 Frost & 21–25 Ash)
  // Zero CPU/GPU cost on chapters 1–15 and Hub (visible = false when inactive).
  // ==========================================================================
  const FROST_SNOW_MAX = isMobileDevice ? 84 : 172;
  const frostSnowPositions = new Float32Array(FROST_SNOW_MAX * 3);
  const frostSnowColors = new Float32Array(FROST_SNOW_MAX * 3);
  const frostSnowSeeds = new Float32Array(FROST_SNOW_MAX * 4); // [fallSpeed, swayAmp, phase, windDrift]
  const snowPalette = [0xffffff, 0xe0f7ff, 0xbae6fd, 0x7dd3fc];
  for (let i = 0; i < FROST_SNOW_MAX; i++) {
    frostSnowPositions[i * 3] = (Math.random() - 0.5) * (arenaSpan + 4);
    frostSnowPositions[i * 3 + 1] = 0.25 + Math.random() * 12.5;
    frostSnowPositions[i * 3 + 2] = (Math.random() - 0.5) * (arenaSpan + 4);
    _tmpColor.setHex(snowPalette[i % snowPalette.length]);
    frostSnowColors[i * 3] = _tmpColor.r;
    frostSnowColors[i * 3 + 1] = _tmpColor.g;
    frostSnowColors[i * 3 + 2] = _tmpColor.b;
    frostSnowSeeds[i * 4] = 1.55 + Math.random() * 1.9;
    frostSnowSeeds[i * 4 + 1] = 0.45 + Math.random() * 0.95;
    frostSnowSeeds[i * 4 + 2] = Math.random() * Math.PI * 2;
    frostSnowSeeds[i * 4 + 3] = 0.35 + Math.random() * 0.65;
  }
  const frostSnowGeo = new THREE.BufferGeometry();
  frostSnowGeo.setAttribute('position', new THREE.BufferAttribute(frostSnowPositions, 3));
  frostSnowGeo.setAttribute('color', new THREE.BufferAttribute(frostSnowColors, 3));
  const frostSnowMat = new THREE.PointsMaterial({
    map: snowflakeTex,
    size: isMobileDevice ? 0.38 : 0.32,
    vertexColors: true,
    transparent: true,
    opacity: 0.84,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });
  const frostSnowPoints = new THREE.Points(frostSnowGeo, frostSnowMat);
  frostSnowPoints.visible = false;
  frostSnowPoints.frustumCulled = false;
  frostSnowPoints.renderOrder = 8;
  scene.add(frostSnowPoints);

  const ASH_EMBER_MAX = isMobileDevice ? 92 : 186;
  const ashEmberPositions = new Float32Array(ASH_EMBER_MAX * 3);
  const ashEmberColors = new Float32Array(ASH_EMBER_MAX * 3);
  const ashEmberSeeds = new Float32Array(ASH_EMBER_MAX * 4); // [riseSpeed, swirlAmp, phase, gust]
  const ashPalette = [0xfef08a, 0xff7b1c, 0xff4518, 0xdc2626, 0xb45309];
  for (let i = 0; i < ASH_EMBER_MAX; i++) {
    ashEmberPositions[i * 3] = (Math.random() - 0.5) * (arenaSpan + 4);
    ashEmberPositions[i * 3 + 1] = 0.1 + Math.random() * 10.8;
    ashEmberPositions[i * 3 + 2] = (Math.random() - 0.5) * (arenaSpan + 4);
    _tmpColor.setHex(ashPalette[i % ashPalette.length]);
    ashEmberColors[i * 3] = _tmpColor.r;
    ashEmberColors[i * 3 + 1] = _tmpColor.g;
    ashEmberColors[i * 3 + 2] = _tmpColor.b;
    ashEmberSeeds[i * 4] = 1.25 + Math.random() * 2.15;
    ashEmberSeeds[i * 4 + 1] = 0.55 + Math.random() * 1.15;
    ashEmberSeeds[i * 4 + 2] = Math.random() * Math.PI * 2;
    ashEmberSeeds[i * 4 + 3] = (Math.random() - 0.35) * 0.9;
  }
  const ashEmberGeo = new THREE.BufferGeometry();
  ashEmberGeo.setAttribute('position', new THREE.BufferAttribute(ashEmberPositions, 3));
  ashEmberGeo.setAttribute('color', new THREE.BufferAttribute(ashEmberColors, 3));
  const ashEmberMat = new THREE.PointsMaterial({
    map: ashEmberTex,
    size: isMobileDevice ? 0.34 : 0.28,
    vertexColors: true,
    transparent: true,
    opacity: 0.90,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });
  const ashEmberPoints = new THREE.Points(ashEmberGeo, ashEmberMat);
  ashEmberPoints.visible = false;
  ashEmberPoints.frustumCulled = false;
  ashEmberPoints.renderOrder = 8;
  scene.add(ashEmberPoints);

  function syncBiomeWeatherVisibility() {
    const inCombat = cameraMode !== 'hub';
    frostSnowPoints.visible = inCombat && currentBiome === 'frost_ruins';
    ashEmberPoints.visible = inCombat && currentBiome === 'ash_citadel';
    frostSnowGeo.setDrawRange(0, lowSpecMode ? Math.round(FROST_SNOW_MAX * 0.5) : FROST_SNOW_MAX);
    ashEmberGeo.setDrawRange(0, lowSpecMode ? Math.round(ASH_EMBER_MAX * 0.5) : ASH_EMBER_MAX);
    frostSnowMat.opacity = lowSpecMode ? 0.62 : 0.84;
    ashEmberMat.opacity = lowSpecMode ? 0.68 : 0.90;
  }

  // ==========================================================================
  // Lightweight Pooled Additive Pseudo-Bloom Flashes (Magic Explosions & Bursts)
  // ==========================================================================
  const MAX_BLOOM_FLASHES = isMobileDevice ? 12 : 20;
  const freeBloomFlashes = [];
  const activeBloomFlashes = [];

  function spawnBloomFlash({
    x = 0,
    y = 0.85,
    z = 0,
    color = 0xffa040,
    size = 4.2,
    duration = 0.34,
    opacity = 0.72
  } = {}) {
    if (activeBloomFlashes.length >= MAX_BLOOM_FLASHES) return;
    let bf = freeBloomFlashes.pop();
    if (!bf) {
      const mat = new THREE.SpriteMaterial({
        map: bloomHaloTex,
        color,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      });
      const sprite = new THREE.Sprite(mat);
      sprite.renderOrder = 8;
      scene.add(sprite);
      bf = { sprite, mat, startScale: 1, endScale: 4, baseOpacity: 0.72, age: 0, duration: 0.34 };
    } else {
      bf.mat.color.setHex(color);
      bf.sprite.visible = true;
    }
    const targetSize = Math.max(1.2, Number(size) || 4.2);
    bf.sprite.position.set(x, y, z);
    bf.startScale = targetSize * 0.45;
    bf.endScale = targetSize * 1.25;
    bf.sprite.scale.set(bf.startScale, bf.startScale, 1);
    bf.baseOpacity = Math.min(1, Math.max(0.15, opacity)) * getBloomIntensityScale();
    bf.mat.opacity = bf.baseOpacity;
    bf.age = 0;
    bf.duration = Math.max(0.12, duration);
    activeBloomFlashes.push(bf);
  }

  // Attach an adaptive additive pseudo-bloom halo sprite onto any 3D object (e.g. cursed chests)
  function attachBloomHalo(targetObj, { color = 0xc084fc, size = 3.2, y = 0.85, opacity = 0.46 } = {}) {
    if (!targetObj) return null;
    const mat = new THREE.SpriteMaterial({
      map: bloomHaloTex,
      color,
      transparent: true,
      opacity: opacity * getBloomIntensityScale(),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(0, y, 0);
    sprite.scale.set(size, size, 1);
    sprite.renderOrder = 4;
    sprite.userData.isAdaptiveBloomHalo = true;
    targetObj.add(sprite);
    return sprite;
  }

  // ==========================================================================
  // Pooled 3D Spark / Ember Shard Particle System (Single InstancedMesh Draw Call)
  // ==========================================================================
  const MAX_PARTICLES = 720;
  const partGeo = (() => {
    const g = new THREE.OctahedronGeometry(0.46, 0);
    // Fine tapered ember-spark shard (eliminates blocky square/voxel Minecraft look in gothic combat!)
    g.scale(0.36, 1.05, 0.36);
    return g;
  })();
  const partMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: true });
  const particleMesh = new THREE.InstancedMesh(partGeo, partMat, MAX_PARTICLES);
  particleMesh.frustumCulled = false;
  particleMesh.visible = false;
  particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  const tmpColor = new THREE.Color();
  for (let i = 0; i < MAX_PARTICLES; i++) {
    particleMesh.setMatrixAt(i, zeroMatrix);
    particleMesh.setColorAt(i, tmpColor.setHex(0xffffff));
  }
  particleMesh.instanceMatrix.needsUpdate = true;
  if (particleMesh.instanceColor) particleMesh.instanceColor.needsUpdate = true;
  scene.add(particleMesh);

  const particles = new Array(MAX_PARTICLES);
  for (let i = 0; i < MAX_PARTICLES; i++) {
    particles[i] = {
      active: false,
      x: 0, y: 0, z: 0,
      vx: 0, vy: 0, vz: 0,
      rx: 0, ry: 0, rz: 0,
      vrx: 0, vry: 0,
      size: 0.16,
      age: 0,
      life: 0.42,
      gravity: 12
    };
  }
  let activeParticleCount = 0;
  let particleCursor = 0;
  const pDummy = new THREE.Object3D();

  function spawnParticles({
    x = 0,
    y = 0.8,
    z = 0,
    color = 0xffffff,
    count = 8,
    speed = 6,
    size = 0.16,
    life = 0.42,
    gravity = 12
  } = {}) {
    const n = Math.max(1, Math.min(80, Math.floor(count)));
    tmpColor.set(color);

    for (let k = 0; k < n; k++) {
      const idx = particleCursor;
      particleCursor = (particleCursor + 1) % MAX_PARTICLES;
      const p = particles[idx];

      const theta = Math.random() * Math.PI * 2;
      const horiz = (0.35 + Math.random() * 0.75) * speed;
      if (!p.active) {
        p.active = true;
        activeParticleCount += 1;
      }
      p.x = x + (Math.random() - 0.5) * 0.22;
      p.y = Math.max(0.12, y + (Math.random() - 0.5) * 0.20);
      p.z = z + (Math.random() - 0.5) * 0.22;
      p.vx = Math.cos(theta) * horiz;
      p.vz = Math.sin(theta) * horiz;
      p.vy = (0.35 + Math.random() * 0.75) * speed * (gravity > 0 ? 0.72 : 0.22);
      p.rx = Math.random() * Math.PI;
      p.ry = Math.random() * Math.PI;
      p.rz = Math.random() * Math.PI;
      p.vrx = (Math.random() - 0.5) * 15;
      p.vry = (Math.random() - 0.5) * 15;
      const soulsSparkScale = isSoulsBiome(currentBiome) ? 0.62 : 1.0;
      p.size = size * soulsSparkScale * (0.68 + Math.random() * 0.52);
      p.age = 0;
      p.life = life * (0.8 + Math.random() * 0.4);
      p.gravity = gravity;

      const lumShift = (Math.random() - 0.5) * 0.14;
      _tmpParticleColor.copy(tmpColor).offsetHSL(0, 0, lumShift);
      particleMesh.setColorAt(idx, _tmpParticleColor);
    }
    particleMesh.visible = true;
    if (particleMesh.instanceColor) particleMesh.instanceColor.needsUpdate = true;
  }

  // ==========================================================================
  // High-Craft Muzzle Flashes, Slash Arcs, Shockwaves & Sleek Projectiles
  // ==========================================================================
  const activeSlashArcs = [];
  const activeShockwaves = [];
  const activeDangerZones = [];
  const activeTelegraphZones = [];
  const activeFireTrails = [];
  const activeBarrelExplosions = [];
  const activeMuzzleFlashes = [];
  const activeGunSmokes = [];
  const activeShellCasings = [];
  const freeShellCasings = [];
  const activeProjectiles = new Set();

  const shellCasingGeo = (() => {
    const g = new THREE.CylinderGeometry(0.022, 0.022, 0.095, 8);
    g.rotateZ(Math.PI * 0.5);
    return g;
  })();
  const shellCasingMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xa16207,
    emissiveIntensity: 0.35,
    metalness: 0.92,
    roughness: 0.18
  });

  function spawnShellCasing({ x = 0, y = 0.86, z = 0, angle = 0 } = {}) {
    let sc = freeShellCasings.pop();
    if (!sc) {
      const mesh = new THREE.Mesh(shellCasingGeo, shellCasingMat);
      scene.add(mesh);
      sc = { mesh, vx: 0, vy: 0, vz: 0, vrx: 0, vry: 0, vrz: 0, age: 0, duration: 0.78 };
    }
    const rightX = Math.cos(angle);
    const rightZ = -Math.sin(angle);
    const backX = -Math.sin(angle);
    const backZ = -Math.cos(angle);
    const sideSpd = 2.4 + Math.random() * 1.1;
    const backSpd = 0.4 + (Math.random() - 0.5) * 0.8;
    sc.mesh.position.set(x, y, z);
    sc.mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    sc.mesh.scale.setScalar(1.0);
    sc.mesh.visible = true;
    sc.vx = rightX * sideSpd + backX * backSpd;
    sc.vy = 2.6 + Math.random() * 1.1;
    sc.vz = rightZ * sideSpd + backZ * backSpd;
    sc.vrx = (Math.random() - 0.5) * 28;
    sc.vry = (Math.random() - 0.5) * 28;
    sc.vrz = 18 + Math.random() * 16;
    sc.age = 0;
    sc.duration = 0.78;
    activeShellCasings.push(sc);
  }

  const muzzleConeGeo = (() => {
    const g = new THREE.ConeGeometry(0.21, 0.96, 8);
    g.rotateX(Math.PI / 2);
    g.translate(0, 0, 0.48);
    return g;
  })();

  // Pooled VFX (Muzzle Flashes, Gunpowder Smoke Puffs, Shockwaves, Slash Arcs & Danger Zones — ZERO mid-combat allocate/dispose!)
  const freeMuzzleFlashes = [];
  const freeGunSmokes = [];
  const freeShockwaves = [];
  const freeSlashArcsByArc = new Map();
  const freeDangerZones = [];
  const freeTelegraphZones = [];
  const MAX_TELEGRAPH_POOL = 24;
  const freeFireTrails = [];
  const MAX_FIRE_TRAIL_POOL = 24;
  const freeBarrelExplosions = [];
  const MAX_BARREL_EXPLOSION_POOL = 10;

  function spawnGunSmokePuffs(x, y, z, angle, scale = 1.0) {
    const dirX = Math.sin(angle);
    const dirZ = Math.cos(angle);
    for (let i = 0; i < 3; i++) {
      let sm = freeGunSmokes.pop();
      if (!sm) {
        const mat = new THREE.SpriteMaterial({
          map: softGlowTex,
          color: 0xd6d3d1,
          transparent: true,
          opacity: 0.42,
          depthWrite: false
        });
        const sprite = new THREE.Sprite(mat);
        scene.add(sprite);
        sm = { sprite, mat, vx: 0, vy: 0, vz: 0, startScale: 0.5, endScale: 1.5, age: 0, duration: 0.42 };
      }
      const fwd = (0.18 + i * 0.24) * scale;
      const spreadX = (Math.random() - 0.5) * 0.18;
      const spreadZ = (Math.random() - 0.5) * 0.18;
      sm.sprite.position.set(x + dirX * fwd + spreadX, y + (Math.random() - 0.3) * 0.08, z + dirZ * fwd + spreadZ);
      sm.vx = dirX * (2.2 - i * 0.45) + (Math.random() - 0.5) * 0.8;
      sm.vy = 0.85 + Math.random() * 0.55;
      sm.vz = dirZ * (2.2 - i * 0.45) + (Math.random() - 0.5) * 0.8;
      sm.startScale = (0.42 + i * 0.14) * scale;
      sm.endScale = (1.28 + i * 0.36) * scale;
      sm.age = 0;
      sm.duration = 0.36 + i * 0.07;
      sm.mat.color.setHex(i === 0 ? 0xfed7aa : 0xa8a29e);
      sm.mat.opacity = i === 0 ? 0.48 : 0.36;
      sm.sprite.scale.set(sm.startScale, sm.startScale, 1);
      sm.sprite.visible = true;
      activeGunSmokes.push(sm);
    }
  }

  function spawnMuzzleFlash({ x = 0, y = 0.84, z = 0, angle = 0, color = 0xfbbf24, scale = 1.0, smoke = false } = {}) {
    // Firearms (smoke === true) use a tight, realistic warm gunpowder flash instead of an oversized plasma cone!
    const effColor = smoke ? 0xffb703 : color;
    const effScale = smoke ? scale * 0.34 : scale;
    _tmpColor.set(effColor).offsetHSL(0, 0.14, -0.02);
    let mf = freeMuzzleFlashes.pop();
    if (!mf) {
      const group = new THREE.Group();
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0xfffbeb,
        transparent: true,
        opacity: 0.96,
        depthWrite: false,
        toneMapped: false
      });
      const outerMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      });
      outerMat.color.copy(_tmpColor);
      const mainJet = new THREE.Mesh(muzzleConeGeo, outerMat);
      const coreJet = new THREE.Mesh(muzzleConeGeo, coreMat);
      coreJet.scale.set(0.46, 0.46, 0.62);
      const sideJetL = new THREE.Mesh(muzzleConeGeo, outerMat);
      sideJetL.scale.set(0.54, 0.54, 0.52);
      sideJetL.rotation.y = 0.48;
      const sideJetR = new THREE.Mesh(muzzleConeGeo, outerMat);
      sideJetR.scale.set(0.54, 0.54, 0.52);
      sideJetR.rotation.y = -0.48;
      const spriteMat = new THREE.SpriteMaterial({
        map: softGlowTex,
        color: 0xffffff,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      });
      spriteMat.color.copy(_tmpColor);
      const flashSprite = new THREE.Sprite(spriteMat);
      flashSprite.scale.set(0.76, 0.76, 1);
      group.add(mainJet, coreJet, sideJetL, sideJetR, flashSprite);
      scene.add(group);
      mf = { group, coreMat, outerMat, spriteMat, baseScale: effScale, age: 0, duration: smoke ? 0.052 : 0.095 };
    } else {
      mf.outerMat.color.copy(_tmpColor);
      mf.spriteMat.color.copy(_tmpColor);
      mf.coreMat.opacity = 0.96;
      mf.outerMat.opacity = 0.92;
      mf.spriteMat.opacity = smoke ? 0.58 : 0.85;
      mf.group.visible = true;
    }
    mf.group.position.set(x, y, z);
    mf.group.rotation.y = angle;
    mf.group.scale.setScalar(effScale);
    mf.baseScale = effScale;
    mf.age = 0;
    mf.duration = smoke ? 0.052 : 0.095;
    activeMuzzleFlashes.push(mf);

    if (smoke) {
      spawnGunSmokePuffs(x, y, z, angle, scale * 0.65);
    }
  }

  function spawnSlashArc({
    x = 0,
    y = 0.88,
    z = 0,
    angle = 0,
    radius = 3.8,
    arcAngle = Math.PI * 0.8,
    color = 0xfbbf24,
    duration = 0.19,
    sweepRad = 0
  } = {}) {
    const arcKey = arcAngle.toFixed(2);
    let bucket = freeSlashArcsByArc.get(arcKey);
    if (!bucket) {
      bucket = [];
      freeSlashArcsByArc.set(arcKey, bucket);
    }
    let sa = bucket.pop();
    if (!sa) {
      const geo = getSlashCrescentGeo(arcAngle, 0.12);
      const group = new THREE.Group();
      const mainMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.62,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const edgeMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const mainMesh = new THREE.Mesh(geo, mainMat);
      const edgeMesh = new THREE.Mesh(geo, edgeMat);
      edgeMesh.scale.set(1.015, 1.08, 1.015);
      edgeMesh.position.y = 0.015;
      group.add(mainMesh, edgeMesh);
      scene.add(group);
      sa = { group, mainMat, edgeMat, arcKey, radius, age: 0, duration: 0.19, baseAngle: angle, sweepRad: 0 };
    } else {
      sa.mainMat.color.setHex(color);
      sa.mainMat.opacity = 0.62;
      sa.edgeMat.opacity = 0.72;
      sa.group.visible = true;
    }

    sa.group.position.set(x, Number.isFinite(y) ? y : 0.88, z);
    sa.baseAngle = angle;
    sa.sweepRad = Number.isFinite(sweepRad) ? sweepRad : 0;
    sa.group.rotation.y = angle - sa.sweepRad * 0.5;
    const startRadius = radius * 0.68;
    sa.group.scale.set(startRadius, 1, startRadius);
    sa.radius = radius;
    sa.age = 0;
    sa.duration = duration > 0 ? duration : 0.19;
    activeSlashArcs.push(sa);
  }

  const unitShockPlaneGeo = (() => {
    const g = new THREE.PlaneGeometry(2.16, 2.16, 1, 1);
    g.rotateX(-Math.PI / 2);
    return g;
  })();

  function createFeatheredShockwaveMaterial(colorHex) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(colorHex) },
        uOpacity: { value: 0.72 },
        uProgress: { value: 0.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform float uProgress;
        varying vec2 vUv;
        float hash21(vec2 p) {
          p = fract(p * vec2(127.1, 311.7));
          p += dot(p, p + 34.5);
          return fract(p.x * p.y);
        }
        float vnoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
            mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }
        void main() {
          vec2 d = vUv * 2.0 - 1.0;
          float r = length(d);
          if (r > 1.0) discard;
          float ang = atan(d.y, d.x);
          float n1 = vnoise(vec2(ang * 3.8 + uProgress * 2.2, r * 6.0 - uProgress * 3.5));
          float n2 = vnoise(vec2(ang * 8.5 - uProgress * 3.0, r * 11.0));
          float wisp = 0.62 + 0.38 * (n1 * 0.65 + n2 * 0.35);
          // Soft feathered kinetic wave crest (zero hard flat paper-ring edges!)
          float crestPos = 0.84;
          float bandDist = abs(r - crestPos);
          float crest = exp(-bandDist * bandDist * 95.0) * wisp;
          float innerGlow = smoothstep(0.95, 0.20, r) * smoothstep(0.18, 0.80, r) * 0.24 * wisp;
          float outerFade = 1.0 - smoothstep(0.86, 1.0, r);
          float alpha = (crest * 0.82 + innerGlow) * outerFade * uOpacity;
          vec3 col = mix(uColor * 0.82, uColor * 1.28 + vec3(0.16, 0.10, 0.04), crest);
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
  }

  function spawnShockwaveRing({
    x = 0,
    z = 0,
    radius = 3.5,
    color = 0xc084fc,
    duration = 0.34,
    withBloom = true
  } = {}) {
    let sw = freeShockwaves.pop();
    if (!sw) {
      const group = new THREE.Group();
      const ringMat = createFeatheredShockwaveMaterial(color);
      const ringMesh = new THREE.Mesh(unitShockPlaneGeo, ringMat);
      ringMesh.renderOrder = 4;
      group.add(ringMesh);
      scene.add(group);
      sw = { group, ringMat, fillMat: null, radius: 1, age: 0, duration: 0.34 };
    } else {
      sw.ringMat.uniforms.uColor.value.setHex(color);
      sw.ringMat.uniforms.uOpacity.value = 0.72;
      sw.ringMat.uniforms.uProgress.value = 0.0;
      sw.group.visible = true;
    }
    sw.group.position.set(x, 0.07, z);
    const initR = Math.max(0.2, radius * 0.18);
    sw.group.scale.set(initR, 1, initR);
    sw.radius = Math.max(0.5, radius);
    sw.age = 0;
    sw.duration = Math.max(0.1, duration);
    activeShockwaves.push(sw);

    if (withBloom) {
      spawnBloomFlash({
        x,
        y: 0.72,
        z,
        color,
        size: Math.max(2.2, Math.min(6.2, radius * 1.25)),
        duration: Math.min(0.38, Math.max(0.20, duration)),
        opacity: 0.42
      });
    }
  }

  const dangerBorderGeo = (() => {
    const g = new THREE.RingGeometry(0.92, 1.0, 40);
    g.rotateX(-Math.PI / 2);
    return g;
  })();
  const dangerFillGeo = (() => {
    const g = new THREE.CircleGeometry(0.98, 36);
    g.rotateX(-Math.PI / 2);
    return g;
  })();

  function spawnDangerZone({
    x = 0,
    z = 0,
    radius = 3.5,
    duration = 1.1,
    color = 0xef4444
  } = {}) {
    // Pure Dark Souls mode: zero arcade red floor circles/zones in Abandoned Knight Rift!
    if (currentBiome === 'souls_citadel') return { cancel() {} };
    let entry = freeDangerZones.pop();
    if (!entry) {
      const group = new THREE.Group();
      const borderMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const fillMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const borderMesh = new THREE.Mesh(dangerBorderGeo, borderMat);
      const fillMesh = new THREE.Mesh(dangerFillGeo, fillMat);
      fillMesh.position.y = -0.005;
      group.add(borderMesh, fillMesh);
      scene.add(group);
      entry = {
        group,
        borderMat,
        fillMat,
        borderMesh,
        fillMesh,
        radius,
        age: 0,
        duration: Math.max(0.15, duration)
      };
    } else {
      entry.borderMat.color.setHex(color);
      entry.fillMat.color.setHex(color);
      entry.borderMat.opacity = 0.9;
      entry.fillMat.opacity = 0.22;
      entry.group.visible = true;
    }

    entry.group.position.set(x, 0.045, z);
    entry.borderMesh.scale.set(radius, 1, radius);
    entry.fillMesh.scale.set(0.05, 1, 0.05);
    entry.radius = radius;
    entry.age = 0;
    entry.duration = Math.max(0.15, duration);
    activeDangerZones.push(entry);

    return {
      cancel() {
        entry.age = entry.duration + 1;
      }
    };
  }

  // Pooled Ground Telegraph Zones for Elite/Boss Attacks (reused cached unit geometries, zero leaks)
  const telegraphOuterRingGeo = (() => {
    const g = new THREE.RingGeometry(0.90, 1.0, 48);
    g.rotateX(-Math.PI / 2);
    return g;
  })();
  const telegraphLeadingRingGeo = (() => {
    const g = new THREE.RingGeometry(0.92, 1.0, 40);
    g.rotateX(-Math.PI / 2);
    return g;
  })();
  const telegraphFillGeo = (() => {
    const g = new THREE.CircleGeometry(0.98, 40);
    g.rotateX(-Math.PI / 2);
    return g;
  })();

  let telegraphsVisible = true;

  function releaseTelegraphZone(entry) {
    entry.group.visible = false;
    if (freeTelegraphZones.length < MAX_TELEGRAPH_POOL) {
      freeTelegraphZones.push(entry);
    } else {
      scene.remove(entry.group);
      entry.outerMat.dispose();
      entry.baseMat.dispose();
      entry.fillMat.dispose();
      entry.leadMat.dispose();
    }
  }

  function setTelegraphsVisible(visible) {
    telegraphsVisible = Boolean(visible);
    if (!telegraphsVisible) {
      while (activeTelegraphZones.length > 0) {
        releaseTelegraphZone(activeTelegraphZones.pop());
      }
    }
    return telegraphsVisible;
  }

  function getTelegraphsVisible() {
    return Boolean(telegraphsVisible);
  }

  function spawnTelegraphZone({
    x = 0,
    z = 0,
    radius = 2.0,
    color = 0xef4444,
    duration = 0.65
  } = {}) {
    // Pure Dark Souls mode: zero red floor telegraph circles for mobs or Boss in Abandoned Knight Rift!
    if (currentBiome === 'souls_citadel' || !telegraphsVisible) return { cancel() {} };
    const safeRadius = Math.max(0.35, Number(radius) || 2.0);
    const safeDuration = Math.max(0.1, Number(duration) || 0.65);

    let entry = freeTelegraphZones.pop();
    if (!entry) {
      const group = new THREE.Group();
      const outerMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.82,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false
      });
      const baseMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.14,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false
      });
      const fillMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.24,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false
      });
      const leadMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false
      });

      const outerMesh = new THREE.Mesh(telegraphOuterRingGeo, outerMat);
      outerMesh.renderOrder = 5;
      const baseMesh = new THREE.Mesh(telegraphFillGeo, baseMat);
      baseMesh.position.y = -0.006;
      baseMesh.renderOrder = 4;
      const fillMesh = new THREE.Mesh(telegraphFillGeo, fillMat);
      fillMesh.position.y = -0.003;
      fillMesh.renderOrder = 4;
      const leadMesh = new THREE.Mesh(telegraphLeadingRingGeo, leadMat);
      leadMesh.position.y = 0.002;
      leadMesh.renderOrder = 5;

      group.add(baseMesh, fillMesh, outerMesh, leadMesh);
      scene.add(group);
      entry = {
        group,
        outerMat,
        baseMat,
        fillMat,
        leadMat,
        outerMesh,
        baseMesh,
        fillMesh,
        leadMesh,
        radius: safeRadius,
        age: 0,
        duration: safeDuration
      };
    }

    entry.outerMat.color.set(color);
    entry.baseMat.color.set(color);
    entry.fillMat.color.set(color);
    entry.leadMat.color.set(color).lerp(_tmpColor.setHex(0xffffff), 0.35);

    entry.outerMat.opacity = 0.82;
    entry.baseMat.opacity = 0.14;
    entry.fillMat.opacity = 0.22;
    entry.leadMat.opacity = 0.92;
    entry.group.visible = true;

    entry.group.position.set(x, 0.052, z);
    entry.outerMesh.scale.set(safeRadius, 1, safeRadius);
    entry.baseMesh.scale.set(safeRadius, 1, safeRadius);
    const initR = Math.max(0.05, safeRadius * 0.06);
    entry.fillMesh.scale.set(initR, 1, initR);
    entry.leadMesh.scale.set(initR, 1, initR);
    entry.radius = safeRadius;
    entry.age = 0;
    entry.duration = safeDuration;
    activeTelegraphZones.push(entry);

    return {
      cancel() {
        entry.age = entry.duration + 1;
      }
    };
  }

  // Pooled Smoldering Fire Trail Patches (dash_fire_trail perk — cached unit geo, mobile-safe)
  const fireTrailDiscGeo = (() => {
    const g = new THREE.CircleGeometry(1.0, 20);
    g.rotateX(-Math.PI / 2);
    return g;
  })();

  function releaseFireTrailPatch(entry) {
    entry.group.visible = false;
    if (freeFireTrails.length < MAX_FIRE_TRAIL_POOL) {
      freeFireTrails.push(entry);
    } else {
      scene.remove(entry.group);
      entry.charMat.dispose();
      entry.glowMat.dispose();
      entry.coreMat.dispose();
    }
  }

  function spawnFireTrailPatch({
    x = 0,
    z = 0,
    radius = 1.25,
    duration = 2.6
  } = {}) {
    const safeRadius = Math.max(0.4, Number(radius) || 1.25);
    const safeDuration = Math.max(0.25, Number(duration) || 2.6);
    const maxActive = isMobileDevice ? 16 : 28;
    if (activeFireTrails.length >= maxActive) {
      releaseFireTrailPatch(activeFireTrails.shift());
    }

    let entry = freeFireTrails.pop();
    if (!entry) {
      const group = new THREE.Group();
      const charMat = new THREE.MeshBasicMaterial({
        map: softGlowTex,
        color: 0x3b120b,
        transparent: true,
        opacity: 0.62,
        depthWrite: false
      });
      const glowMat = new THREE.MeshBasicMaterial({
        map: softGlowTex,
        color: 0xff5a12,
        transparent: true,
        opacity: 0.82,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      });
      const coreMat = new THREE.MeshBasicMaterial({
        map: softGlowTex,
        color: 0xfef08a,
        transparent: true,
        opacity: 0.56,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      });

      const charMesh = new THREE.Mesh(fireTrailDiscGeo, charMat);
      charMesh.position.y = -0.004;
      charMesh.renderOrder = 3;
      const glowMesh = new THREE.Mesh(fireTrailDiscGeo, glowMat);
      glowMesh.renderOrder = 4;
      const coreMesh = new THREE.Mesh(fireTrailDiscGeo, coreMat);
      coreMesh.position.y = 0.004;
      coreMesh.renderOrder = 5;

      group.add(charMesh, glowMesh, coreMesh);
      scene.add(group);
      entry = {
        group,
        charMat,
        glowMat,
        coreMat,
        charMesh,
        glowMesh,
        coreMesh,
        x: 0,
        z: 0,
        radius: safeRadius,
        age: 0,
        duration: safeDuration,
        emitTick: 0,
        phase: 0
      };
    }

    entry.x = x;
    entry.z = z;
    entry.radius = safeRadius;
    entry.age = 0;
    entry.duration = safeDuration;
    entry.emitTick = Math.random() * 0.14;
    entry.phase = Math.random() * Math.PI * 2;
    entry.group.position.set(x, 0.042, z);
    entry.group.rotation.y = Math.random() * Math.PI * 2;
    entry.charMesh.scale.set(safeRadius * 1.05, 1, safeRadius * 1.05);
    entry.glowMesh.scale.set(safeRadius, 1, safeRadius);
    entry.coreMesh.scale.set(safeRadius * 0.52, 1, safeRadius * 0.52);
    entry.charMat.opacity = 0.62;
    entry.glowMat.opacity = 0.82;
    entry.coreMat.opacity = 0.56;
    entry.group.visible = true;
    activeFireTrails.push(entry);

    return {
      cancel() {
        entry.age = entry.duration + 1;
      }
    };
  }

  // Pooled Explosive Barrel Detonations (fireball flash + expanding fire shockwave + spark salvo + shake)
  const explosionFlashSphereGeo = new THREE.SphereGeometry(1.0, 14, 10);
  const explosionShockRingGeo = (() => {
    const g = new THREE.RingGeometry(0.72, 1.0, 36);
    g.rotateX(-Math.PI / 2);
    return g;
  })();

  function releaseBarrelExplosion(entry) {
    entry.group.visible = false;
    if (freeBarrelExplosions.length < MAX_BARREL_EXPLOSION_POOL) {
      freeBarrelExplosions.push(entry);
    } else {
      scene.remove(entry.group);
      entry.coreMat.dispose();
      entry.outerMat.dispose();
      entry.ringMat.dispose();
      entry.scorchMat.dispose();
    }
  }

  function spawnBarrelExplosion({
    x = 0,
    z = 0,
    radius = 4.2
  } = {}) {
    const safeRadius = Math.max(1.2, Number(radius) || 4.2);

    let entry = freeBarrelExplosions.pop();
    if (!entry) {
      const group = new THREE.Group();
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0xfff5c0,
        transparent: true,
        opacity: 0.96,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      });
      const outerMat = new THREE.MeshBasicMaterial({
        color: 0xff5212,
        transparent: true,
        opacity: 0.88,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      });
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xff8a1e,
        transparent: true,
        opacity: 0.94,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false
      });
      const scorchMat = new THREE.MeshBasicMaterial({
        map: softGlowTex,
        color: 0xff5500,
        transparent: true,
        opacity: 0.82,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      });

      const coreSphere = new THREE.Mesh(explosionFlashSphereGeo, coreMat);
      coreSphere.position.y = 0.72;
      coreSphere.renderOrder = 7;
      const outerSphere = new THREE.Mesh(explosionFlashSphereGeo, outerMat);
      outerSphere.position.y = 0.68;
      outerSphere.renderOrder = 6;
      const ringMesh = new THREE.Mesh(explosionShockRingGeo, ringMat);
      ringMesh.position.y = 0.08;
      ringMesh.renderOrder = 6;
      const scorchMesh = new THREE.Mesh(fireTrailDiscGeo, scorchMat);
      scorchMesh.position.y = 0.05;
      scorchMesh.renderOrder = 5;

      group.add(scorchMesh, ringMesh, outerSphere, coreSphere);
      scene.add(group);
      entry = {
        group,
        coreMat,
        outerMat,
        ringMat,
        scorchMat,
        coreSphere,
        outerSphere,
        ringMesh,
        scorchMesh,
        radius: safeRadius,
        age: 0,
        duration: 0.48
      };
    }

    entry.radius = safeRadius;
    entry.age = 0;
    entry.duration = 0.48;
    entry.group.position.set(x, 0, z);
    entry.coreSphere.scale.setScalar(safeRadius * 0.16);
    entry.outerSphere.scale.setScalar(safeRadius * 0.24);
    entry.ringMesh.scale.set(safeRadius * 0.2, 1, safeRadius * 0.2);
    entry.scorchMesh.scale.set(safeRadius * 0.35, 1, safeRadius * 0.35);
    entry.coreMat.opacity = 0.96;
    entry.outerMat.opacity = 0.88;
    entry.ringMat.opacity = 0.94;
    entry.scorchMat.opacity = 0.82;
    entry.group.visible = true;
    activeBarrelExplosions.push(entry);

    spawnShockwaveRing({ x, z, radius: safeRadius, color: 0xff6b14, duration: 0.36, withBloom: false });
    spawnBloomFlash({
      x,
      y: 1.05,
      z,
      color: 0xff7b1c,
      size: safeRadius * 2.1,
      duration: 0.44,
      opacity: 0.84
    });
    spawnParticles({
      x,
      y: 0.75,
      z,
      color: 0xff5a12,
      count: isMobileDevice ? 16 : 26,
      speed: 9.8,
      size: 0.22,
      life: 0.52,
      gravity: 12.5
    });
    spawnParticles({
      x,
      y: 0.92,
      z,
      color: 0xfef08a,
      count: isMobileDevice ? 10 : 16,
      speed: 11.4,
      size: 0.16,
      life: 0.38,
      gravity: 7.5
    });
    spawnParticles({
      x,
      y: 0.55,
      z,
      color: 0x7f1d1d,
      count: isMobileDevice ? 6 : 10,
      speed: 6.8,
      size: 0.24,
      life: 0.62,
      gravity: 16.0
    });
    addScreenShake(0.35);
  }

  // ==========================================================================
  // Pooled 3D Shattered Cathedral Stone Craters, Parallax Sunken Funnel Shader,
  // 3x Volumetric Fire Field ('circle') & Fire Road ('fissure') + Wrench Dust
  // ==========================================================================
  const activeGroundFractures = [];
  const freeGroundFractures = [];
  let sharedFractureAssets = null;

  // Pooled combat ground PointLight (stays inside arenaGroup with visible=true & intensity=0 when idle
  // so NUM_POINT_LIGHTS never changes mid-combat — 0ms shader recompile hitch & 0 light leaks!)
  const burningGroundLight = new THREE.PointLight(0xff6218, 0, 12.5, 1.5);
  burningGroundLight.castShadow = false;
  burningGroundLight.position.set(0, -80, 0);
  arenaGroup.add(burningGroundLight);

  // Pooled Soft Dark-Stone Floor Dust Puffs (for crater slams, rock-bounce dust & stuck-hammer extraction tugs)
  const MAX_STONE_DUST_PUFFS = isMobileDevice ? 28 : 52;
  const activeStoneDustPuffs = [];
  const freeStoneDustPuffs = [];

  function spawnStoneDustPuff({
    x = 0,
    y = 0.08,
    z = 0,
    vx = 0,
    vy = 0.35,
    vz = 0,
    startScale = 0.55,
    endScale = 1.65,
    opacity = 0.38,
    duration = 0.62,
    color = 0x35303a
  } = {}) {
    if (lowSpecMode && activeStoneDustPuffs.length >= 16) return;
    let dp = freeStoneDustPuffs.pop();
    if (!dp) {
      if (activeStoneDustPuffs.length >= MAX_STONE_DUST_PUFFS) {
        dp = activeStoneDustPuffs.shift();
      } else {
        const mat = new THREE.SpriteMaterial({
          map: hubMistTex,
          color: 0x35303a,
          transparent: true,
          opacity: 0.38,
          blending: THREE.NormalBlending,
          depthWrite: false,
          toneMapped: true
        });
        const sprite = new THREE.Sprite(mat);
        sprite.renderOrder = 5;
        scene.add(sprite);
        dp = {
          sprite,
          mat,
          x: 0,
          y: 0,
          z: 0,
          vx: 0,
          vy: 0,
          vz: 0,
          startScale: 0.5,
          endScale: 1.5,
          baseOpacity: 0.38,
          age: 0,
          duration: 0.6
        };
      }
    }
    dp.x = x;
    dp.y = y;
    dp.z = z;
    dp.vx = vx;
    dp.vy = vy;
    dp.vz = vz;
    dp.startScale = startScale;
    dp.endScale = endScale;
    dp.baseOpacity = Math.min(0.62, Math.max(0.08, opacity));
    dp.age = 0;
    dp.duration = Math.max(0.18, duration);
    dp.mat.color.setHex(color);
    dp.mat.opacity = dp.baseOpacity * 0.25;
    dp.sprite.position.set(x, y, z);
    dp.sprite.scale.set(startScale, startScale * 0.68, 1);
    dp.sprite.visible = true;
    activeStoneDustPuffs.push(dp);
  }

  // Subdivided horizontal XZ grid (x, z in [-1, 1], uv in [0, 1]) for real 3D buckled rim silhouette
  // + exact tangent-free local-space view ray for Parallax Occlusion Funnel ray-marching!
  function buildCraterFunnelGridGeometry(segs = 38) {
    const vertsPerRow = segs + 1;
    const totalVerts = vertsPerRow * vertsPerRow;
    const positions = new Float32Array(totalVerts * 3);
    const uvs = new Float32Array(totalVerts * 2);
    const indices = [];

    let vIdx = 0;
    let uvIdx = 0;
    for (let iz = 0; iz <= segs; iz++) {
      const vz = iz / segs;
      const z = vz * 2.0 - 1.0;
      for (let ix = 0; ix <= segs; ix++) {
        const ux = ix / segs;
        const x = ux * 2.0 - 1.0;
        positions[vIdx++] = x;
        positions[vIdx++] = 0.0;
        positions[vIdx++] = z;
        uvs[uvIdx++] = ux;
        uvs[uvIdx++] = vz;
      }
    }
    for (let iz = 0; iz < segs; iz++) {
      for (let ix = 0; ix < segs; ix++) {
        const a = iz * vertsPerRow + ix;
        const b = a + 1;
        const c = a + vertsPerRow;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    return geo;
  }

  // Multi-channel RGBA DataTexture encoding:
  //   R = Sharp primary, secondary, concentric & spiderweb hairline fault cracks [0..1]
  //   G = Sculpted sunken funnel / tectonic trench heightfield [0..1] (neutral floor = 0.64, pit = 0.02, buckled rim = 0.90)
  //   B = Crushed cathedral flagstone block facets, mortar seams & granite grain [0..1]
  //   A = Torn polygonal fractured-stone outer perimeter alpha mask [0..1]
  function buildCraterReliefDataTexture({ fissure = false } = {}) {
    const sz = 512;
    const mid = sz * 0.5;
    const maxR = mid * 0.95;

    const crackCv = document.createElement('canvas');
    crackCv.width = sz;
    crackCv.height = sz;
    const cc = crackCv.getContext('2d');
    cc.fillStyle = '#000000';
    cc.fillRect(0, 0, sz, sz);

    const stoneCv = document.createElement('canvas');
    stoneCv.width = sz;
    stoneCv.height = sz;
    const sc = stoneCv.getContext('2d');
    sc.fillStyle = 'rgb(148, 148, 148)';
    sc.fillRect(0, 0, sz, sz);

    let seed = fissure ? 0x6d2b79f5 : 0x3b9a71d3;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    const strokeFault = (pts, startW, endW, intensity = 1.0) => {
      if (pts.length < 2) return;
      cc.save();
      cc.lineCap = 'round';
      cc.lineJoin = 'round';
      for (let i = 0; i < pts.length - 1; i++) {
        const u = i / Math.max(1, pts.length - 1);
        const w = startW + (endW - startW) * u;
        const p0 = pts[i];
        const p1 = pts[i + 1];
        // Soft fracture shoulder ramp (carves realistic angled stone bevels in heightfield!)
        const shVal = Math.round(135 * intensity * (1 - u * 0.32));
        cc.strokeStyle = `rgba(${shVal}, 0, 0, 0.55)`;
        cc.lineWidth = w * 2.15;
        cc.beginPath();
        cc.moveTo(p0[0], p0[1]);
        cc.lineTo(p1[0], p1[1]);
        cc.stroke();

        // Razor-sharp incised abyssal fault core
        const coreVal = Math.round(255 * intensity * (1 - u * 0.18));
        cc.strokeStyle = `rgba(${coreVal}, 0, 0, 0.96)`;
        cc.lineWidth = Math.max(0.85, w);
        cc.beginPath();
        cc.moveTo(p0[0], p0[1]);
        cc.lineTo(p1[0], p1[1]);
        cc.stroke();
      }
      cc.restore();
    };

    // Draw staggered cathedral flagstone courses onto stoneCv (radially pinched near impact center!)
    const rows = 8;
    const rowH = sz / rows;
    for (let r = -1; r <= rows; r++) {
      const y0 = r * rowH;
      let curX = -((r & 1) ? rowH * 0.65 : rowH * 0.15);
      while (curX < sz + rowH) {
        const bw = rowH * (0.85 + rnd() * 0.65);
        const bh = rowH * (0.92 + (rnd() - 0.5) * 0.08);
        const shade = Math.round(112 + rnd() * 88);
        sc.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
        sc.strokeStyle = 'rgb(28, 28, 28)';
        sc.lineWidth = 3.2;

        const poly = [
          [curX + 2 + (rnd() - 0.5) * 4, y0 + 2 + (rnd() - 0.5) * 4],
          [curX + bw - 2 + (rnd() - 0.5) * 4, y0 + 2 + (rnd() - 0.5) * 4],
          [curX + bw - 2 + (rnd() - 0.5) * 4, y0 + bh - 2 + (rnd() - 0.5) * 4],
          [curX + 2 + (rnd() - 0.5) * 4, y0 + bh - 2 + (rnd() - 0.5) * 4]
        ];
        // Pull vertices inward toward impact center/trench to pre-bake crushed masonry deformation!
        for (let k = 0; k < poly.length; k++) {
          if (!fissure) {
            const dx = poly[k][0] - mid;
            const dy = poly[k][1] - mid;
            const d = Math.hypot(dx, dy) / maxR;
            const pull = 1.0 - 0.34 * Math.exp(-d * d * 7.5);
            poly[k][0] = mid + dx * pull;
            poly[k][1] = mid + dy * pull;
          } else {
            const dx = poly[k][0] - mid;
            const ax = Math.abs(dx) / (sz * 0.45);
            const pull = 1.0 - 0.28 * Math.exp(-ax * ax * 8.0);
            poly[k][0] = mid + dx * pull;
          }
        }
        sc.beginPath();
        sc.moveTo(poly[0][0], poly[0][1]);
        for (let k = 1; k < poly.length; k++) sc.lineTo(poly[k][0], poly[k][1]);
        sc.closePath();
        sc.fill();
        sc.stroke();
        curX += bw;
      }
    }

    const rayAngles = [];
    if (!fissure) {
      // Central pulverized warhammer socket chasm
      const pitGrad = cc.createRadialGradient(mid, mid, 2, mid, mid, maxR * 0.22);
      pitGrad.addColorStop(0.0, 'rgba(255, 0, 0, 0.96)');
      pitGrad.addColorStop(0.55, 'rgba(185, 0, 0, 0.62)');
      pitGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
      cc.fillStyle = pitGrad;
      cc.beginPath();
      cc.arc(mid, mid, maxR * 0.22, 0, Math.PI * 2);
      cc.fill();

      // 3 broken polygonal hinge-buckle fault rings (inner pit lip 0.35R, heaved crest 0.57R, outer spall 0.80R)
      const ringSpecs = [
        { r: 0.35, segs: 18, w: 6.2, skipChance: 0.14, inten: 0.92 },
        { r: 0.57, segs: 26, w: 4.8, skipChance: 0.24, inten: 0.78 },
        { r: 0.80, segs: 32, w: 3.4, skipChance: 0.34, inten: 0.62 }
      ];
      for (let ri = 0; ri < ringSpecs.length; ri++) {
        const rs = ringSpecs[ri];
        let prevPt = null;
        for (let s = 0; s <= rs.segs; s++) {
          const a = (s / rs.segs) * Math.PI * 2 + ri * 0.37;
          const rad = maxR * (rs.r + (rnd() - 0.5) * 0.068);
          const pt = [mid + Math.cos(a) * rad, mid + Math.sin(a) * rad];
          if (prevPt && rnd() > rs.skipChance) {
            strokeFault([prevPt, pt], rs.w, rs.w * 0.86, rs.inten);
          }
          prevPt = pt;
        }
      }

      // 11 primary jagged radial tectonic chasms + branching Y-forks
      const primaryCount = 11;
      for (let r = 0; r < primaryCount; r++) {
        const baseA = (r / primaryCount) * Math.PI * 2 + (rnd() - 0.5) * 0.22;
        rayAngles.push(baseA);
        const steps = 10;
        const maxReach = 0.85 + rnd() * 0.12;
        const pts = [[mid + (rnd() - 0.5) * 7, mid + (rnd() - 0.5) * 7]];
        let curA = baseA;
        for (let s = 1; s <= steps; s++) {
          const u = s / steps;
          curA += (rnd() - 0.5) * 0.24;
          const rad = maxR * maxReach * u;
          const px = mid + Math.cos(curA) * rad;
          const py = mid + Math.sin(curA) * rad;
          pts.push([px, py]);

          if (s === 3 || s === 5 || s === 7) {
            const forkSide = rnd() < 0.5 ? 1 : -1;
            const forkA = curA + forkSide * (0.34 + rnd() * 0.30);
            const f1 = [px + Math.cos(forkA) * maxR * 0.12, py + Math.sin(forkA) * maxR * 0.12];
            const f2 = [
              f1[0] + Math.cos(forkA + forkSide * 0.20) * maxR * 0.13,
              f1[1] + Math.sin(forkA + forkSide * 0.20) * maxR * 0.13
            ];
            if (Math.hypot(f2[0] - mid, f2[1] - mid) < maxR * 0.96) {
              strokeFault([[px, py], f1, f2], 4.8 * (1 - u * 0.35), 1.2, 0.82);
            }
          }
        }
        strokeFault(pts, 9.6, 1.8, 1.0);
      }

      // 16 secondary radial & transverse shear cracks
      for (let s = 0; s < 16; s++) {
        const a0 = (s / 16) * Math.PI * 2 + 0.14 + (rnd() - 0.5) * 0.24;
        const rStart = maxR * (0.12 + rnd() * 0.20);
        const rEnd = maxR * (0.58 + rnd() * 0.28);
        const pts = [];
        let ca = a0;
        for (let k = 0; k <= 5; k++) {
          const u = k / 5;
          ca += (rnd() - 0.5) * 0.26;
          const rr = rStart + (rEnd - rStart) * u;
          pts.push([mid + Math.cos(ca) * rr, mid + Math.sin(ca) * rr]);
        }
        strokeFault(pts, 4.2, 1.05, 0.76);
      }

      // 30 fine spiderweb hairline fractures around the sunken pit & buckled rim
      for (let h = 0; h < 30; h++) {
        const ha = rnd() * Math.PI * 2;
        const hr0 = maxR * (0.08 + rnd() * 0.56);
        const x0 = mid + Math.cos(ha) * hr0;
        const y0 = mid + Math.sin(ha) * hr0;
        const dirA = ha + (rnd() - 0.5) * 1.65;
        const segLen = maxR * (0.08 + rnd() * 0.14);
        const xm = x0 + Math.cos(dirA) * segLen * 0.52;
        const ym = y0 + Math.sin(dirA) * segLen * 0.52;
        const x1 = xm + Math.cos(dirA + (rnd() - 0.5) * 0.55) * segLen * 0.52;
        const y1 = ym + Math.sin(dirA + (rnd() - 0.5) * 0.55) * segLen * 0.52;
        strokeFault([[x0, y0], [xm, ym], [x1, y1]], 1.85, 0.75, 0.58);
      }
    } else {
      // Directional tectonic fissure trench + chevron shear faults
      for (let sp = 0; sp < 2; sp++) {
        const pts = [];
        const segs = 18;
        for (let s = 0; s <= segs; s++) {
          const v = s / segs;
          const y = 26 + v * (sz - 52);
          const env = Math.sin(v * Math.PI);
          const ox = ((sp === 0 ? -1 : 1) * 10 + (rnd() - 0.5) * 32) * env;
          pts.push([mid + ox, y]);
          if (s >= 2 && s <= segs - 2) {
            for (let side = -1; side <= 1; side += 2) {
              if ((s + (sp === 0 ? 0 : 1)) % 2 !== 0) continue;
              const b1x = mid + ox + side * (34 + rnd() * 32) * env;
              const b1y = y + (16 + rnd() * 20);
              const b2x = b1x + side * (36 + rnd() * 36) * env;
              const b2y = b1y + (14 + rnd() * 22);
              strokeFault([[mid + ox, y], [b1x, b1y], [b2x, b2y]], 5.2, 1.2, 0.85);
            }
          }
        }
        strokeFault(pts, sp === 0 ? 10.5 : 6.8, sp === 0 ? 7.5 : 5.0, 1.0);
      }
      for (let h = 0; h < 24; h++) {
        const y0 = 42 + rnd() * (sz - 84);
        const x0 = mid + (rnd() - 0.5) * sz * 0.44;
        const ang = (rnd() < 0.5 ? 1 : -1) * (0.55 + rnd() * 0.85);
        const len = 24 + rnd() * 38;
        strokeFault(
          [
            [x0, y0],
            [x0 + Math.cos(ang) * len * 0.5, y0 + Math.sin(ang) * len * 0.5],
            [x0 + Math.cos(ang + 0.3) * len, y0 + Math.sin(ang + 0.3) * len]
          ],
          2.0,
          0.8,
          0.60
        );
      }
    }

    const crackData = cc.getImageData(0, 0, sz, sz).data;
    const stoneData = sc.getImageData(0, 0, sz, sz).data;
    const out = new Uint8Array(sz * sz * 4);

    for (let y = 0; y < sz; y++) {
      // Flip Y into Three.js DataTexture UV convention (v = 0 at iz = 0 -> z = -1)
      const srcY = y;
      const ny = (srcY - mid) / maxR;
      for (let x = 0; x < sz; x++) {
        const nx = (x - mid) / maxR;
        const srcIdx = (srcY * sz + x) * 4;
        const dstIdx = (y * sz + x) * 4;

        const crackVal = crackData[srcIdx] / 255.0;
        const stoneVal = stoneData[srcIdx] / 255.0;

        // Deterministic multi-frequency mineral grain
        const gHash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        const microGrain = (gHash - Math.floor(gHash)) - 0.5;

        let h = 0.64;
        let alpha = 0.0;

        if (!fissure) {
          const rn = Math.hypot(nx, ny);
          const ang = Math.atan2(ny, nx);
          const wedgeWave =
            0.50 * Math.sin(ang * 7.0 + 0.6) +
            0.32 * Math.cos(ang * 11.0 - 1.2) +
            0.18 * Math.sin(ang * 17.0 + 2.1);

          // Sunken central crushed-stone funnel (rn < 0.39) + stepped broken ledges + heaved rim crown (0.50..0.74)
          if (rn < 0.39) {
            const uPit = rn / 0.39;
            // Steep funnel bowl with subtle broken flagstone shelf step around uPit ~ 0.62
            const bowl = Math.pow(uPit, 1.55) * 0.54;
            const ledgeStep = Math.tanh((uPit - 0.58) * 9.0) * 0.045;
            h = 0.035 + bowl + ledgeStep + wedgeWave * 0.032 * uPit;
          } else if (rn < 0.56) {
            const uSlope = (rn - 0.39) / 0.17;
            const sCurve = uSlope * uSlope * (3.0 - 2.0 * uSlope);
            h = 0.575 + sCurve * (0.275 + wedgeWave * 0.055);
          } else if (rn < 0.84) {
            const uRim = (rn - 0.56) / 0.28;
            const sDown = uRim * uRim * (3.0 - 2.0 * uRim);
            const crest = 0.850 + wedgeWave * 0.055;
            h = crest + (0.64 - crest) * sDown;
          } else {
            h = 0.64;
          }

          // Irregular torn-stone outer perimeter (never a smooth circle!)
          const maxTipBoost = crackVal * 0.085;
          const rimBoundary = 0.84 + wedgeWave * 0.085 + (stoneVal - 0.5) * 0.05 + maxTipBoost;
          if (rn <= rimBoundary - 0.12) {
            alpha = 1.0;
          } else if (rn < rimBoundary + 0.06) {
            const tEdge = 1.0 - (rn - (rimBoundary - 0.12)) / 0.18;
            alpha = Math.max(0.0, Math.min(1.0, tEdge * tEdge * (3.0 - 2.0 * tEdge)));
          } else {
            alpha = 0.0;
          }
          if (rn > 0.99) alpha = 0.0;
        } else {
          const ax = Math.abs(nx);
          const az = Math.abs(ny);
          const endEnv = Math.max(0.0, Math.cos(Math.min(1.0, az) * Math.PI * 0.5));
          const jagWave =
            0.55 * Math.sin(ny * 11.0 + 0.4) +
            0.45 * Math.cos(ny * 19.0 - 0.9);

          if (ax < 0.30) {
            const uTrench = ax / 0.30;
            h = 0.64 - (0.56 - uTrench * uTrench * 0.48) * endEnv;
          } else if (ax < 0.54) {
            const uCurb = (ax - 0.30) / 0.24;
            const bell = Math.sin(uCurb * Math.PI);
            h = 0.64 + bell * (0.20 + jagWave * 0.04) * endEnv;
          } else {
            h = 0.64;
          }

          const latBound = (0.68 + jagWave * 0.11 + crackVal * 0.09) * (0.45 + 0.55 * endEnv);
          const latAlpha = ax < latBound - 0.12
            ? 1.0
            : ax < latBound + 0.08
              ? 1.0 - (ax - (latBound - 0.12)) / 0.20
              : 0.0;
          const endAlpha = az < 0.74 ? 1.0 : az < 0.98 ? 1.0 - (az - 0.74) / 0.24 : 0.0;
          alpha = Math.max(0.0, Math.min(1.0, latAlpha * endAlpha));
        }

        // Incise cracks + broken stone block tilt into heightfield
        h = h + (stoneVal - 0.5) * 0.095 + microGrain * 0.022 - crackVal * 0.52;
        h = Math.max(0.0, Math.min(1.0, h));

        out[dstIdx] = Math.max(0, Math.min(255, Math.round(crackVal * 255)));
        out[dstIdx + 1] = Math.max(0, Math.min(255, Math.round(h * 255)));
        out[dstIdx + 2] = Math.max(0, Math.min(255, Math.round(stoneVal * 255)));
        out[dstIdx + 3] = Math.max(0, Math.min(255, Math.round(alpha * 255)));
      }
    }

    const tex = new THREE.DataTexture(out, sz, sz, THREE.RGBAFormat);
    tex.colorSpace = THREE.NoColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy?.() || 1);
    tex.needsUpdate = true;
    return tex;
  }

  // ==========================================================================
  // Custom Dark-Gothic Parallax Sunken Funnel & Shattered Stone Shader
  //   - Parallax Ray-Marched Depth Sink in center (r < 0.38 -> real 3D sunken funnel!)
  //   - Radial inward masonry UV pinch + procedural infinite-sharp Voronoi stone facets
  //   - Overhead directional + torch bevel shading with Pit Rim Self-Shadowing
  //   - ZERO glowing white lines! Cold stone strictly capped <= #3d3740 dusty basalt!
  // ==========================================================================
  const CRATER_FUNNEL_VERT_GLSL = /* glsl */ `
    uniform float uHeave;
    uniform float uFissure;
    uniform float uSeed;

    varying vec2 vUv;
    varying vec3 vViewLocal;
    varying vec3 vAxisX;
    varying vec3 vAxisY;
    varying vec3 vAxisZ;

    void main() {
      vUv = uv;
      vec3 p = position;

      if (uFissure < 0.5) {
        float r = length(p.xz);
        float ang = atan(p.z, p.x);
        float buckle = 0.72 + 0.28 * sin(ang * 5.0 + uSeed) * cos(ang * 3.0 - uSeed * 0.7);
        float rimRidge = exp(-pow((r - 0.48) / 0.16, 2.0)) * buckle;
        float baseLift = 0.008 * (1.0 - smoothstep(0.76, 1.0, r)) + 0.004;
        p.y = baseLift + rimRidge * 0.026 * uHeave;
      } else {
        float ax = abs(p.x);
        float endEnv = sin(clamp(uv.y, 0.0, 1.0) * 3.14159265);
        float curb = exp(-pow((ax - 0.40) / 0.16, 2.0)) * endEnv;
        p.y = 0.010 * endEnv + curb * 0.044 * uHeave + 0.005;
      }

      vec4 worldPos = modelMatrix * vec4(p, 1.0);
      vec3 axisX = normalize(modelMatrix[0].xyz);
      vec3 axisY = normalize(modelMatrix[1].xyz);
      vec3 axisZ = normalize(modelMatrix[2].xyz);
      vAxisX = axisX;
      vAxisY = axisY;
      vAxisZ = axisZ;

      vec3 worldView = cameraPosition - worldPos.xyz;
      vViewLocal = vec3(dot(worldView, axisX), dot(worldView, axisY), dot(worldView, axisZ));

      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `;

  const CRATER_FUNNEL_FRAG_GLSL = /* glsl */ `
    uniform sampler2D uReliefMap;
    uniform float uOpacity;
    uniform float uCollapse;
    uniform float uMolten;
    uniform float uFissure;
    uniform float uTime;
    uniform float uSeed;
    uniform float uWrenchPulse;

    varying vec2 vUv;
    varying vec3 vViewLocal;
    varying vec3 vAxisX;
    varying vec3 vAxisY;
    varying vec3 vAxisZ;

    vec2 hash22(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.xx + p3.yz) * p3.zy);
    }

    // Crisp procedural Voronoi shattered-flagstone cells & hairline border cracks
    // Returns vec3(borderDist, cellHash, facetTilt)
    vec3 voronoiStoneCells(vec2 x) {
      vec2 n = floor(x);
      vec2 f = fract(x);
      vec2 mg = vec2(0.0);
      vec2 mr = vec2(0.0);
      float md = 8.0;
      float cellId = 0.0;

      for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
          vec2 g = vec2(float(i), float(j));
          vec2 o = hash22(n + g);
          vec2 r = g + (0.16 + 0.68 * o) - f;
          float d = dot(r, r);
          if (d < md) {
            md = d;
            mr = r;
            mg = g;
            cellId = o.x * 0.63 + o.y * 0.37;
          }
        }
      }

      md = 8.0;
      for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
          vec2 g = vec2(float(i), float(j));
          vec2 o = hash22(n + g);
          vec2 r = g + (0.16 + 0.68 * o) - f;
          if (dot(mr - r, mr - r) > 0.0001) {
            md = min(md, dot(0.5 * (mr + r), normalize(r - mr)));
          }
        }
      }
      float tilt = clamp(0.5 + (mr.x * 0.42 - mr.y * 0.38), 0.0, 1.0);
      return vec3(md, cellId, tilt);
    }

    void main() {
      vec2 p0 = vUv * 2.0 - 1.0;
      float r0 = length(p0);
      if (uFissure < 0.5 && r0 > 1.01) discard;
      // Cut an actual open jagged portal in the flat rim decal for circular craters so the REAL 3D recessed pit shows cleanly!
      if (uFissure < 0.5) {
        float angPit = atan(p0.y, p0.x);
        float pitEdge = (0.385 + 0.022 * sin(angPit * 5.0 + 0.4) + 0.015 * cos(angPit * 8.0 - 0.9) + 0.011 * sin(angPit * 13.0 + 1.7)) / 1.04;
        if (r0 < pitEdge + 0.004) discard;
      }

      float outerMask = texture2D(uReliefMap, vUv).a;
      if (outerMask < 0.008) discard;

      // 1. 6-step Parallax Occlusion Ray-March into the sunken crushed-stone funnel!
      vec3 V = normalize(vViewLocal);
      float sinkMask = (uFissure < 0.5)
        ? (1.0 - smoothstep(0.32, 0.86, r0))
        : (1.0 - smoothstep(0.22, 0.72, abs(p0.x)));
      vec2 paraSpan = (-V.xz / max(0.38, V.y)) * (0.165 * uCollapse * (0.35 + 0.65 * sinkMask));

      float layerDepth = 0.0;
      float prevDepth = 0.0;
      float prevMapDepth = 0.0;
      vec2 curUv = vUv;
      float curMapDepth = clamp((0.67 - texture2D(uReliefMap, curUv).g) * 1.49, 0.0, 1.0);

      for (int i = 0; i < 6; i++) {
        if (layerDepth < curMapDepth) {
          prevDepth = layerDepth;
          prevMapDepth = curMapDepth;
          layerDepth += 0.1666667;
          curUv = clamp(vUv + paraSpan * layerDepth, 0.003, 0.997);
          curMapDepth = clamp((0.67 - texture2D(uReliefMap, curUv).g) * 1.49, 0.0, 1.0);
        }
      }

      float denom = (curMapDepth - layerDepth) - (prevMapDepth - prevDepth);
      float secWeight = abs(denom) > 0.0001 ? clamp((curMapDepth - layerDepth) / denom, 0.0, 1.0) : 0.0;
      vec2 uvPara = clamp(mix(curUv, curUv - paraSpan * 0.1666667, secWeight), 0.003, 0.997);

      // 2. Miniature Funnel Surface Texture Deformation (radial inward pinch & downward shear in r < 0.44!)
      vec2 pPara = uvPara * 2.0 - 1.0;
      float rPara = length(pPara);
      float funnelFocus = (uFissure < 0.5)
        ? exp(-rPara * rPara * 9.8)
        : exp(-pPara.x * pPara.x * 11.5);
      float funnelPinch = funnelFocus * (0.54 + 0.12 * uWrenchPulse) * uCollapse;
      vec2 pFunnel = pPara * (1.0 + funnelPinch);
      vec2 uvFunnel = clamp(pFunnel * 0.5 + 0.5, 0.003, 0.997);

      vec4 relA = texture2D(uReliefMap, uvPara);
      vec4 relF = texture2D(uReliefMap, uvFunnel);

      // Infinite-resolution shattered flagstone Voronoi facets & hairline spiderweb seams
      vec3 vor = voronoiStoneCells(pFunnel * 4.15 + vec2(uSeed * 0.37, -uSeed * 0.29));
      float vorSeam = 1.0 - smoothstep(0.012, 0.058, vor.x);
      float vorFine = 1.0 - smoothstep(0.004, 0.026, voronoiStoneCells(pFunnel * 8.4 + vec2(2.7, -1.9)).x);
      float vorActive = (uFissure < 0.5)
        ? (1.0 - smoothstep(0.45, 0.88, rPara))
        : (1.0 - smoothstep(0.35, 0.76, abs(pPara.x)));

      float crack = clamp(
        max(relA.r, relF.r * 0.90) + vorSeam * 0.52 * vorActive + vorFine * 0.28 * funnelFocus,
        0.0,
        1.0
      );
      float hCenter = mix(relA.g, relF.g, 0.46) + (vor.z - 0.5) * 0.075 * vorActive - vorSeam * 0.14 * vorActive;

      // 3. Analytical Central-Difference Surface Normal for realistic directional stone bevels
      const float texel = 1.0 / 512.0;
      float hL = texture2D(uReliefMap, clamp(uvPara - vec2(texel * 1.6, 0.0), 0.002, 0.998)).g;
      float hR = texture2D(uReliefMap, clamp(uvPara + vec2(texel * 1.6, 0.0), 0.002, 0.998)).g;
      float hD = texture2D(uReliefMap, clamp(uvPara - vec2(0.0, texel * 1.6), 0.002, 0.998)).g;
      float hU = texture2D(uReliefMap, clamp(uvPara + vec2(0.0, texel * 1.6), 0.002, 0.998)).g;
      float dhdx = (hR - hL) * 3.85 + (vor.z - 0.5) * 0.32 * vorActive;
      float dhdz = (hU - hD) * 3.85;
      vec3 localN = normalize(vec3(-dhdx, 1.0, -dhdz));
      vec3 worldN = normalize(vAxisX * localN.x + vAxisY * localN.y + vAxisZ * localN.z);

      // World-locked cathedral moonlit key + warm brazier fill
      vec3 worldKeyL = normalize(vec3(0.44, 0.81, 0.39));
      vec3 worldWarmL = normalize(vec3(-0.56, 0.44, -0.70));
      vec2 localKeyXZ = vec2(dot(worldKeyL, vAxisX), dot(worldKeyL, vAxisZ));

      // Pit Rim Self-Shadowing: near lip of crater casts a curved shadow down into the sunken pit!
      float hLight1 = texture2D(uReliefMap, clamp(uvPara + localKeyXZ * 0.055, 0.003, 0.997)).g;
      float hLight2 = texture2D(uReliefMap, clamp(uvPara + localKeyXZ * 0.115, 0.003, 0.997)).g;
      float occluderH = max(hLight1, hLight2);
      float pitShadow = clamp(1.0 - max(0.0, occluderH - hCenter - 0.04) * 3.15, 0.16, 1.0);

      float ndotlKey = max(0.0, dot(worldN, worldKeyL)) * pitShadow;
      float ndotlWarm = max(0.0, dot(worldN, worldWarmL));

      float pitDepth01 = clamp((0.60 - hCenter) / 0.56, 0.0, 1.0) * uCollapse;
      float stoneVar = clamp(relF.b * 0.65 + vor.y * 0.35, 0.0, 1.0);
      float rimDustBand = (uFissure < 0.5)
        ? exp(-pow((rPara - 0.56) / 0.19, 2.0))
        : exp(-pow((abs(pPara.x) - 0.44) / 0.18, 2.0));

      vec3 col = vec3(0.0);
      float finalAlpha = outerMask * uOpacity;

      if (uMolten < 0.5) {
        // ====================================================================
        // PHASE-1 SHATTERED CATHEDRAL STONE CRATER (ZERO WHITE LINES!)
        // Deep abyssal chasms (#070609 -> #17141b) + dusty basalt rim bevels (<= #3d3740)
        // ====================================================================
        vec3 cAbyss     = vec3(0.0020, 0.0017, 0.0026); // #070609 deep fault / pit throat
        vec3 cPitFloor  = vec3(0.0068, 0.0056, 0.0088); // #141118 crushed sunken pit
        vec3 cInnerSlab = vec3(0.0135, 0.0114, 0.0170); // #1e1b24 tilted inner masonry shelf
        vec3 cRimStone  = vec3(0.0245, 0.0208, 0.0285); // #2b2730 weathered cathedral flagstone
        vec3 cDustBevel = vec3(0.0455, 0.0378, 0.0505); // #3d3740 STRICT MAX dusty basalt bevel!

        vec3 baseStone = mix(cRimStone, cInnerSlab, smoothstep(0.08, 0.52, pitDepth01));
        baseStone = mix(baseStone, cPitFloor, smoothstep(0.48, 0.92, pitDepth01));
        baseStone *= (0.80 + 0.36 * stoneVar);

        // Directional overhead + torch bevel relief across broken slabs & crack lips (no painted lines!)
        float bevelRelief = ndotlKey * 0.95 + ndotlWarm * 0.28;
        vec3 litStone = baseStone * (0.34 + 0.92 * bevelRelief);

        // Subtle pulverized basalt dust along buckled rim lips (only on sunlit upward/angled facets)
        float bevelLip = clamp((ndotlKey - 0.52) * 1.85, 0.0, 1.0) * (0.45 + 0.55 * rimDustBand) * (1.0 - pitDepth01 * 0.78);
        litStone = mix(litStone, cDustBevel, bevelLip * 0.58);
        litStone = mix(litStone, vec3(0.029, 0.025, 0.033), rimDustBand * 0.24 * (1.0 - crack));

        // Incise deep dark tectonic chasms & sunken warhammer pit AO
        float cavityAo = (1.0 - pitDepth01 * 0.72) * (1.0 - crack * 0.88);
        col = mix(cAbyss, litStone * (0.42 + 0.58 * cavityAo), clamp(1.0 - crack * 0.92, 0.0, 1.0));

        // Wrench tug dust shudder darkening/stirring inside pit
        col = mix(col, vec3(0.026, 0.022, 0.030), uWrenchPulse * 0.22 * rimDustBand);

        // Hard physical cap at #3d3740 so ZERO pixels can ever appear gray/white!
        col = min(col, cDustBevel);

        // Make central pit & cracks strongly opaque while outer torn-stone edge feathers seamlessly into floor
        float centerSolid = smoothstep(0.0, 0.35, pitDepth01 + crack * 0.85);
        finalAlpha = clamp(outerMask * mix(0.84, 0.99, centerSolid), 0.0, 0.99) * uOpacity;
      } else {
        // ====================================================================
        // PHASE-2 SCORCHED OBSIDIAN & MOLTEN MAGMA CRATER/TRENCH BASE
        // ====================================================================
        vec3 cCharred = vec3(0.0045, 0.0028, 0.0024);
        vec3 cBasalt  = vec3(0.0180, 0.0115, 0.0102) * (0.75 + 0.45 * stoneVar);
        float bevel = 0.35 + 0.85 * ndotlKey + 0.35 * ndotlWarm;
        vec3 crust = mix(cCharred, cBasalt * bevel, 1.0 - pitDepth01 * 0.65);

        float pulse = 0.82 + 0.18 * sin(uTime * 11.5 + uSeed + rPara * 4.5);
        float magmaHeat = clamp(crack * 1.12 + pitDepth01 * 0.68, 0.0, 1.0) * pulse * uMolten;
        vec3 cDeepLava = vec3(0.42, 0.035, 0.006);
        vec3 cOrange   = vec3(1.15, 0.24, 0.02);
        vec3 cGoldCore = vec3(2.10, 1.25, 0.32);
        vec3 lavaCol = magmaHeat < 0.52
          ? mix(cDeepLava, cOrange, magmaHeat / 0.52)
          : mix(cOrange, cGoldCore, (magmaHeat - 0.52) / 0.48);

        col = mix(crust, lavaCol, smoothstep(0.14, 0.78, magmaHeat));
        finalAlpha = clamp(outerMask * mix(0.88, 0.99, clamp(magmaHeat + crack, 0.0, 1.0)), 0.0, 0.99) * uOpacity;
      }

      if (finalAlpha < 0.006) discard;
      gl_FragColor = vec4(col, finalAlpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `;

  function createShatteredCraterShaderMaterial(defaultReliefTex) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uReliefMap: { value: defaultReliefTex },
        uOpacity: { value: 1.0 },
        uCollapse: { value: 1.0 },
        uHeave: { value: 1.0 },
        uMolten: { value: 0.0 },
        uFissure: { value: 0.0 },
        uTime: { value: 0.0 },
        uSeed: { value: 0.0 },
        uWrenchPulse: { value: 0.0 }
      },
      vertexShader: CRATER_FUNNEL_VERT_GLSL,
      fragmentShader: CRATER_FUNNEL_FRAG_GLSL,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      stencilWrite: true,
      stencilRef: 0,
      stencilFunc: THREE.EqualStencilFunc,
      stencilFuncMask: 0x01,
      stencilWriteMask: 0x00,
      stencilFail: THREE.KeepStencilOp,
      stencilZFail: THREE.KeepStencilOp,
      stencilZPass: THREE.KeepStencilOp,
      toneMapped: true
    });
  }

  // Procedural Dark Cathedral Granite Albedo, Chisel Bump & Volcanic Vein Emissive Textures
  // Eliminates untextured plastic prisms and flat solid-orange Phase-2 rocks!
  function buildCathedralRockTextures() {
    const sz = 256;
    const albCv = document.createElement('canvas');
    albCv.width = sz; albCv.height = sz;
    const ac = albCv.getContext('2d');

    const bmpCv = document.createElement('canvas');
    bmpCv.width = sz; bmpCv.height = sz;
    const bc = bmpCv.getContext('2d');

    const emCv = document.createElement('canvas');
    emCv.width = sz; emCv.height = sz;
    const ec = emCv.getContext('2d');

    let seed = 0x51a7c3d9;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    // Base dark cathedral blue-slate granite matching Boss Hall flagstones
    ac.fillStyle = '#3c404f';
    ac.fillRect(0, 0, sz, sz);
    bc.fillStyle = '#808080';
    bc.fillRect(0, 0, sz, sz);
    ec.fillStyle = '#000000';
    ec.fillRect(0, 0, sz, sz);

    // Mottled fractured mineral & quarry grain patches
    for (let i = 0; i < 420; i++) {
      const px = rnd() * sz;
      const py = rnd() * sz;
      const rw = 4 + rnd() * 22;
      const rh = 3 + rnd() * 14;
      const ang = rnd() * Math.PI;
      const v = Math.round(42 + rnd() * 44);
      const b = Math.min(255, Math.round(v * 1.12));
      ac.save();
      ac.translate(px, py);
      ac.rotate(ang);
      ac.fillStyle = `rgba(${v}, ${Math.round(v * 1.02)}, ${b}, ${0.22 + rnd() * 0.25})`;
      ac.fillRect(-rw * 0.5, -rh * 0.5, rw, rh);
      ac.restore();

      const bv = Math.round(70 + rnd() * 120);
      bc.save();
      bc.translate(px, py);
      bc.rotate(ang);
      bc.fillStyle = `rgba(${bv}, ${bv}, ${bv}, 0.28)`;
      bc.fillRect(-rw * 0.5, -rh * 0.5, rw, rh);
      bc.restore();
    }

    // Fine stone grit speckles
    for (let i = 0; i < 700; i++) {
      const px = rnd() * sz;
      const py = rnd() * sz;
      const d = rnd() < 0.5 ? 24 : 96;
      ac.fillStyle = `rgba(${d}, ${d}, ${Math.min(255, Math.round(d * 1.1))}, 0.24)`;
      ac.fillRect(px, py, 2, 2);
      bc.fillStyle = `rgba(${d * 2}, ${d * 2}, ${d * 2}, 0.25)`;
      bc.fillRect(px, py, 2, 2);
    }

    // Sharp fractured rock cracks (dark in albedo/bump; thin hot volcanic veins in molten emissive!)
    for (let c = 0; c < 18; c++) {
      let cx = rnd() * sz;
      let cy = rnd() * sz;
      let dir = rnd() * Math.PI * 2;
      const segs = 5 + Math.floor(rnd() * 5);
      const pts = [[cx, cy]];
      for (let s = 0; s < segs; s++) {
        dir += (rnd() - 0.5) * 1.05;
        const len = 10 + rnd() * 20;
        cx += Math.cos(dir) * len;
        cy += Math.sin(dir) * len;
        pts.push([cx, cy]);
      }
      ac.strokeStyle = 'rgba(12, 13, 18, 0.78)';
      ac.lineWidth = 1.4 + rnd() * 1.6;
      ac.beginPath();
      ac.moveTo(pts[0][0], pts[0][1]);
      for (let s = 1; s < pts.length; s++) ac.lineTo(pts[s][0], pts[s][1]);
      ac.stroke();

      bc.strokeStyle = 'rgba(20, 20, 20, 0.85)';
      bc.lineWidth = 2.0 + rnd() * 1.5;
      bc.beginPath();
      bc.moveTo(pts[0][0], pts[0][1]);
      for (let s = 1; s < pts.length; s++) bc.lineTo(pts[s][0], pts[s][1]);
      bc.stroke();

      // Only ~40% of cracks carry subtle warm orange-amber magma fissures (natural scorched volcanic rock, never neon scribbles!)
      if (c < 7) {
        ec.lineCap = 'round';
        ec.strokeStyle = 'rgba(175, 42, 6, 0.42)';
        ec.lineWidth = 4.6;
        ec.beginPath();
        ec.moveTo(pts[0][0], pts[0][1]);
        for (let s = 1; s < pts.length; s++) ec.lineTo(pts[s][0], pts[s][1]);
        ec.stroke();

        ec.strokeStyle = 'rgba(255, 165, 58, 0.88)';
        ec.lineWidth = 1.4;
        ec.beginPath();
        ec.moveTo(pts[0][0], pts[0][1]);
        for (let s = 1; s < pts.length; s++) ec.lineTo(pts[s][0], pts[s][1]);
        ec.stroke();
      }
    }

    const makeTex = (cv, isColor) => {
      const t = new THREE.CanvasTexture(cv);
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      if (isColor) t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
      return t;
    };
    return {
      stoneRockTex: makeTex(albCv, true),
      stoneBumpTex: makeTex(bmpCv, false),
      moltenEmissiveTex: makeTex(emCv, true)
    };
  }

  // Sculpted 3D Fractured Cathedral Flagstone Wedges (jagged rim slabs with box-projected UVs & dark split edges!)
  function buildBrokenCathedralFlagstoneGeo(variant = 0) {
    const sides = variant === 0 ? 7 : (variant === 1 ? 6 : (variant === 2 ? 7 : 5));
    const topR = variant === 3 ? 0.21 : 0.28;
    const botR = variant === 3 ? 0.26 : 0.34;
    const height = variant === 3 ? 0.16 : 0.14;
    const rawGeo = new THREE.CylinderGeometry(topR, botR, height, sides, 2, false);
    const geo = rawGeo.toNonIndexed();
    rawGeo.dispose();

    const pos = geo.attributes.position;
    let seed = 24681 + variant * 9733;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    const vMap = new Map();
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const key = `${vx.toFixed(3)}_${vy.toFixed(3)}_${vz.toFixed(3)}`;
      let out = vMap.get(key);
      if (!out) {
        const ang = Math.atan2(vz, vx);
        const jag = 0.84 + 0.32 * Math.abs(Math.sin(ang * 3.0 + variant * 1.7)) + (rnd() - 0.5) * 0.26;
        const wedgeWidth = ((variant === 0 ? 1.24 : 1.06) + (vz > 0 ? 0.20 : -0.14)) * jag;
        const wedgeDepth = (variant === 2 ? 1.18 : 0.96) * (0.88 + rnd() * 0.24);
        const chiselSlope = vy > 0
          ? (vz > 0 ? 0.028 : -0.024) + (rnd() - 0.5) * 0.026
          : (rnd() - 0.5) * 0.018;
        out = [vx * wedgeWidth, vy + chiselSlope, vz * wedgeDepth];
        vMap.set(key, out);
      }
      pos.setXYZ(i, out[0], out[1], out[2]);
    }
    geo.computeVertexNormals();

    const norm = geo.attributes.normal;
    const colors = new Float32Array(pos.count * 3);
    const uvs = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      const pz = pos.getZ(i);
      const ny = norm.getY(i);
      const shade = ny > 0.52
        ? 0.88 + (i % 5) * 0.024
        : (py < 0 ? 0.36 : 0.52 + (i % 3) * 0.05);
      colors[i * 3] = shade;
      colors[i * 3 + 1] = shade * 0.99;
      colors[i * 3 + 2] = shade * 1.04;
      // Box-projected UVs so granite grain & lava veins map cleanly on top AND vertical split sides!
      if (Math.abs(ny) > 0.55) {
        uvs[i * 2] = px * 2.4 + 0.5;
        uvs[i * 2 + 1] = pz * 2.4 + 0.5;
      } else {
        uvs[i * 2] = (px + pz) * 2.2 + 0.5;
        uvs[i * 2 + 1] = py * 3.4 + 0.5;
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    return geo;
  }

  // Sculpted Multi-Faceted Angular 3D Boulders & Crushed Rubble Chunks resting DEEP INSIDE THE CRATER PIT!
  function buildRoughCraterBoulderGeo(variant = 0) {
    const rawGeo = new THREE.IcosahedronGeometry(0.28, 1);
    const geo = rawGeo.toNonIndexed();
    rawGeo.dispose();

    const pos = geo.attributes.position;
    let seed = 88417 + variant * 13177;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const sx = variant === 0 ? 1.38 : (variant === 1 ? 1.12 : 1.28);
    const sy = variant === 0 ? 0.72 : (variant === 1 ? 0.92 : 0.62);
    const sz = variant === 0 ? 1.06 : (variant === 1 ? 1.24 : 0.94);

    const vMap = new Map();
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const key = `${vx.toFixed(3)}_${vy.toFixed(3)}_${vz.toFixed(3)}`;
      let out = vMap.get(key);
      if (!out) {
        const crag = 0.72 + rnd() * 0.52;
        const flatTop = vy > 0.12 ? 0.84 : 1.0;
        const shearX = vy * (variant === 1 ? 0.28 : -0.22);
        out = [vx * sx * crag + shearX, vy * sy * crag * flatTop, vz * sz * crag];
        vMap.set(key, out);
      }
      pos.setXYZ(i, out[0], out[1], out[2]);
    }
    geo.computeVertexNormals();

    const norm = geo.attributes.normal;
    const colors = new Float32Array(pos.count * 3);
    const uvs = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      const pz = pos.getZ(i);
      const ny = norm.getY(i);
      const shade = Math.max(0.28, Math.min(1.0, 0.56 + ny * 0.34 + (i % 4) * 0.03));
      colors[i * 3] = shade;
      colors[i * 3 + 1] = shade * 0.98;
      colors[i * 3 + 2] = shade * 1.04;
      if (Math.abs(ny) > 0.55) {
        uvs[i * 2] = px * 2.2 + 0.5;
        uvs[i * 2 + 1] = pz * 2.2 + 0.5;
      } else {
        uvs[i * 2] = (px + pz) * 2.0 + 0.5;
        uvs[i * 2 + 1] = py * 2.6 + 0.5;
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    return geo;
  }

  // Crisp angular broken-flagstone crater-pit aperture boundary matching CRATER_FUNNEL_FRAG_GLSL 1:1
  function evalCraterPitEdgeR(theta) {
    return (
      0.385 +
      0.022 * Math.sin(theta * 5.0 + 0.4) +
      0.015 * Math.cos(theta * 8.0 - 0.9) +
      0.011 * Math.sin(theta * 13.0 + 1.7)
    );
  }

  // Flat angular broken-stone crater opening disc (XZ radius = evalCraterPitEdgeR(theta), y = 0)
  function buildCraterPitApertureGeometry(segs = 24) {
    const positions = new Float32Array((segs + 1) * 3);
    const indices = [];
    positions[0] = 0;
    positions[1] = 0;
    positions[2] = 0;
    for (let s = 0; s < segs; s++) {
      const th = (s / segs) * Math.PI * 2;
      const r = evalCraterPitEdgeR(th);
      positions[(s + 1) * 3] = Math.cos(th) * r;
      positions[(s + 1) * 3 + 1] = 0;
      positions[(s + 1) * 3 + 2] = Math.sin(th) * r;
    }
    for (let s = 0; s < segs; s++) {
      const cur = s + 1;
      const nxt = ((s + 1) % segs) + 1;
      indices.push(0, nxt, cur);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  // TRUE 3D Physically Recessed Deep Cathedral Stone Chasm (plunges steeply down to y = -1.48m!)
  //   - Ring 0 (rFrac 1.06, y +0.026) extends slightly past stencil portal so ZERO 1px sky pinholes ever appear!
  //   - Rings 1..2 form a STEEP 22cm vertical broken flagstone cross-section wall!
  //   - Rings 3..7 drop steeply through fractured dark basalt ledges down into a deep crushed pit basin!
  function buildReal3DPitBowlGeometry(segs = 24) {
    const ringProfile = [
      { rFrac: 1.06, y:  0.026, jag: 0.000, shade: 0.68 }, // stencil-clipped outer seal collar
      { rFrac: 1.00, y: -0.018, jag: 0.016, shade: 0.78 }, // sharp top lip of broken cathedral stone floor
      { rFrac: 0.97, y: -0.240, jag: 0.036, shade: 0.62 }, // steep 22cm vertical broken flagstone slab cross-section!
      { rFrac: 0.90, y: -0.560, jag: 0.056, shade: 0.44 }, // jagged sub-floor mortar & stepped masonry ledge
      { rFrac: 0.74, y: -0.960, jag: 0.064, shade: 0.28 }, // steep dark fractured basalt shaft wall
      { rFrac: 0.48, y: -1.280, jag: 0.050, shade: 0.17 }, // deep crushed stone rubble terrace
      { rFrac: 0.22, y: -1.420, jag: 0.028, shade: 0.11 }, // abyssal pit basin floor
      { rFrac: 0.00, y: -1.480, jag: 0.000, shade: 0.08 }  // deep warhammer impact socket bottom
    ];
    const nRings = ringProfile.length;
    const ringVerts = [];
    for (let ri = 0; ri < nRings; ri++) {
      const rp = ringProfile[ri];
      const row = [];
      for (let s = 0; s <= segs; s++) {
        const sWrap = s % segs;
        const th = (sWrap / segs) * Math.PI * 2;
        const baseEdge = evalCraterPitEdgeR(th);
        const h1 = Math.sin(sWrap * 4.3 + ri * 2.7) * Math.cos(sWrap * 2.9 - ri * 1.9);
        const h2 = Math.sin(sWrap * 8.7 - ri * 3.1);
        const rJitter = 1.0 + rp.jag * (0.65 * h1 + 0.35 * h2);
        const yJitter = rp.jag * 1.15 * h1;
        const r = Math.max(0.0, baseEdge * rp.rFrac * rJitter);
        const y = rp.y + yJitter;
        const x = Math.cos(th) * r;
        const z = Math.sin(th) * r;
        const depth01 = Math.max(0.0, Math.min(1.0, (-y) / 1.48));
        const facetVar = 0.80 + 0.40 * (0.5 + 0.5 * h2);
        row.push({ x, y, z, depth01, shade: rp.shade * facetVar, u: s / segs, v: ri / (nRings - 1) });
      }
      ringVerts.push(row);
    }

    const posArr = [];
    const colArr = [];
    const uvArr = [];
    const pushVert = (v) => {
      posArr.push(v.x, v.y, v.z);
      colArr.push(v.shade, v.depth01, 0.5);
      uvArr.push(v.u, v.v);
    };
    for (let ri = 0; ri < nRings - 1; ri++) {
      for (let s = 0; s < segs; s++) {
        const a = ringVerts[ri][s];
        const b = ringVerts[ri + 1][s];
        const c = ringVerts[ri][s + 1];
        const d = ringVerts[ri + 1][s + 1];
        pushVert(a); pushVert(b); pushVert(c);
        if (ri < nRings - 2) {
          pushVert(b); pushVert(d); pushVert(c);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvArr, 2));
    geo.computeVertexNormals();
    return geo;
  }

  // Dedicated 3D Recessed Pit Wall Shader:
  //   - Exact inverse-transpose world normal under non-uniform (pitR, pitDepth, pitR) scaling!
  //   - World-space stratified cathedral stone blocks on the upper 28cm vertical slab cross-section
  //   - Crisp dark overhang AO right under the floor lip -> rapid darkening into deep abyssal pit floor
  //   - ZERO bright clay halo! Reads 100% unmistakably as a deep recessed physical hole in dark cathedral stone!
  const PIT_BOWL_VERT_GLSL = /* glsl */ `
    attribute vec3 color;
    varying vec3 vNormalW;
    varying vec3 vMeta;
    varying vec2 vUv;
    varying vec3 vWorldPos;
    void main() {
      vMeta = color;
      vUv = uv;
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      // Exact inverse-transpose world normal for non-uniform scale M = R * S -> M * diag(1/s^2) * n
      vec3 invS = vec3(
        1.0 / max(0.001, length(modelMatrix[0].xyz)),
        1.0 / max(0.001, length(modelMatrix[1].xyz)),
        1.0 / max(0.001, length(modelMatrix[2].xyz))
      );
      vNormalW = normalize(mat3(modelMatrix) * (normal * invS * invS));
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `;

  const PIT_BOWL_FRAG_GLSL = /* glsl */ `
    uniform float uMolten;
    uniform float uTime;
    uniform float uSeed;
    uniform float uGroundY;
    varying vec3 vNormalW;
    varying vec3 vMeta;
    varying vec2 vUv;
    varying vec3 vWorldPos;

    float hash21(vec2 p) {
      p = fract(p * vec2(127.1, 311.7));
      p += dot(p, p + 34.53);
      return fract(p.x * p.y);
    }

    void main() {
      vec3 N = normalize(vNormalW);
      float rockShade = vMeta.x;
      float depthM = max(0.0, uGroundY - vWorldPos.y);
      float depth01 = clamp(depthM / 1.45, 0.0, 1.0);

      // World-space fractured masonry courses & vertical broken stone joints along the pit walls
      float arcCoord = vUv.x * 16.0 + uSeed * 0.7;
      float courseRow = floor(depthM * 4.4);
      float blockCol = floor(arcCoord + mod(courseRow, 2.0) * 0.5);
      float blockHash = hash21(vec2(blockCol, courseRow));
      float horizJoint = 1.0 - smoothstep(0.04, 0.14, abs(fract(depthM * 4.4) - 0.5));
      float vertJoint = 1.0 - smoothstep(0.03, 0.11, abs(fract(arcCoord + mod(courseRow, 2.0) * 0.5) - 0.5));
      float masonrySeam = max(horizJoint * 0.55, vertJoint * 0.42) * (1.0 - smoothstep(0.45, 0.88, depth01));
      float grit = 0.84 + 0.32 * hash21(floor(vec2(vWorldPos.x * 9.0 + vWorldPos.z * 9.0, vWorldPos.y * 12.0)));

      // Overhead cathedral moonlight + subtle warm torch fill — vertical FAR wall catches directional bevels!
      vec3 keyL = normalize(vec3(0.42, 0.78, 0.46));
      vec3 warmL = normalize(vec3(-0.52, 0.40, -0.75));
      float ndlKey = max(0.0, dot(N, keyL));
      float ndlWarm = max(0.0, dot(N, warmL));

      // Steepness mask: true vertical broken-slab shear wall (abs(N.y) < 0.65) shows individual stone cross-section
      float isVertWall = 1.0 - smoothstep(0.28, 0.78, abs(N.y));
      // Crisp dark overhang AO directly under the broken floor rim (0..6cm) so the floor edge visibly overhangs the chasm!
      float overhangAo = mix(0.42, 1.0, smoothstep(0.0, 0.08, depthM));
      // Exponential light falloff down into the deep dark abyssal pit!
      float pitDepthAo = exp(-depthM * 1.95);

      // Cool dark cathedral slate-basalt palette strictly matching the Boss Hall flagstones (NEVER bright clay grey!)
      vec3 cBrokenSlab = vec3(0.028, 0.030, 0.042);   // vertical broken cathedral flagstone cross-section
      vec3 cSubMasonry = vec3(0.013, 0.013, 0.020);   // dark sub-floor fractured stone
      vec3 cDeepAbyss  = vec3(0.0018, 0.0019, 0.0030); // near-black crushed pit floor

      vec3 baseCol = mix(cBrokenSlab, cSubMasonry, smoothstep(0.14, 0.48, depth01));
      baseCol = mix(baseCol, cDeepAbyss, smoothstep(0.50, 0.95, depth01));
      baseCol *= (0.76 + 0.48 * blockHash) * grit * (0.65 + 0.35 * rockShade);
      baseCol *= (1.0 - masonrySeam * 0.72);

      // Crisp directional wall shading with deep shadow drop-off
      float lightSum = (0.18 + 1.18 * ndlKey + 0.42 * ndlWarm) * pitDepthAo * overhangAo;
      vec3 lit = baseCol * lightSum;
      // Subtle cool stone bevel catch ONLY on sunlit vertical cross-section blocks (keeps rim crisp without glowing!)
      lit += cBrokenSlab * isVertWall * ndlKey * (1.0 - smoothstep(0.04, 0.36, depth01)) * overhangAo * 0.48;

      if (uMolten > 0.01) {
        // Phase-2 incandescent volcanic magma glowing DEEP AT THE BOTTOM & rising through fractured pit wall cracks!
        float pulse = 0.84 + 0.16 * sin(uTime * 10.5 + uSeed + vUv.x * 12.0);
        float bottomPool = smoothstep(0.50, 0.94, depth01) * (0.72 + 0.28 * blockHash);
        float wallCrack = max(horizJoint, vertJoint) * smoothstep(0.24, 0.85, depth01) * (0.55 + 0.45 * blockHash);
        float heat = clamp((bottomPool * 1.15 + wallCrack * 0.85) * pulse * uMolten, 0.0, 1.0);
        vec3 lavaCol = mix(vec3(0.55, 0.045, 0.006), vec3(1.95, 0.72, 0.10), heat);
        // Upward warm magma under-glow bouncing onto lower jagged pit walls!
        float underGlow = smoothstep(0.22, 0.90, depth01) * (0.35 + 0.65 * max(0.0, -N.y * 0.5 + 0.5)) * uMolten;
        lit = lit * 0.65 + vec3(0.24, 0.045, 0.008) * underGlow;
        lit = mix(lit, lavaCol, smoothstep(0.14, 0.80, heat));
      }

      gl_FragColor = vec4(lit, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `;

  function createCraterPitBowlMaterial(stencilId = 3) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uMolten: { value: 0.0 },
        uTime: { value: 0.0 },
        uSeed: { value: 0.0 },
        uGroundY: { value: 0.0 }
      },
      vertexShader: PIT_BOWL_VERT_GLSL,
      fragmentShader: PIT_BOWL_FRAG_GLSL,
      transparent: false,
      depthTest: true,
      depthWrite: true,
      side: THREE.FrontSide,
      stencilWrite: true,
      stencilRef: stencilId,
      stencilFunc: THREE.EqualStencilFunc,
      stencilFuncMask: 0xFF,
      stencilWriteMask: 0x00,
      stencilFail: THREE.KeepStencilOp,
      stencilZFail: THREE.KeepStencilOp,
      stencilZPass: THREE.KeepStencilOp,
      toneMapped: true
    });
  }

  let nextGroundFractureSlotIdx = 0;

  function getSharedFractureAssets() {
    if (sharedFractureAssets) return sharedFractureAssets;
    const craterGridGeo = buildCraterFunnelGridGeometry(isMobileDevice ? 28 : 38);
    const pitApertureGeo = buildCraterPitApertureGeometry(isMobileDevice ? 20 : 24);
    const pitBowlGeo = buildReal3DPitBowlGeometry(isMobileDevice ? 20 : 24);
    const slabGeos = [
      buildBrokenCathedralFlagstoneGeo(0),
      buildBrokenCathedralFlagstoneGeo(1),
      buildBrokenCathedralFlagstoneGeo(2),
      buildBrokenCathedralFlagstoneGeo(3)
    ];
    const boulderGeos = [
      buildRoughCraterBoulderGeo(0),
      buildRoughCraterBoulderGeo(1),
      buildRoughCraterBoulderGeo(2)
    ];
    const rockTex = buildCathedralRockTextures();

    const circleReliefTex = buildCraterReliefDataTexture({ fissure: false });
    const fissureReliefTex = buildCraterReliefDataTexture({ fissure: true });

    // Upgrade flying debris stone materials once rockTex is ready so molten chunks have real glowing cracks (not flat orange!)
    if (typeof debrisRockMat !== 'undefined' && debrisRockMat) {
      debrisRockMat.map = rockTex.stoneRockTex;
      debrisRockMat.bumpMap = rockTex.stoneBumpTex;
      debrisRockMat.bumpScale = 0.025;
      debrisRockMat.color.setHex(0x888c9e);
      debrisRockMat.needsUpdate = true;
    }
    if (typeof debrisFlagstoneChipMat !== 'undefined' && debrisFlagstoneChipMat) {
      debrisFlagstoneChipMat.map = rockTex.stoneRockTex;
      debrisFlagstoneChipMat.bumpMap = rockTex.stoneBumpTex;
      debrisFlagstoneChipMat.bumpScale = 0.025;
      debrisFlagstoneChipMat.color.setHex(0x989cae);
      debrisFlagstoneChipMat.needsUpdate = true;
    }
    if (typeof debrisMoltenRockMat !== 'undefined' && debrisMoltenRockMat) {
      debrisMoltenRockMat.map = rockTex.stoneRockTex;
      debrisMoltenRockMat.bumpMap = rockTex.stoneBumpTex;
      debrisMoltenRockMat.bumpScale = 0.03;
      debrisMoltenRockMat.emissiveMap = rockTex.moltenEmissiveTex;
      debrisMoltenRockMat.color.setHex(0x4b3f44);
      debrisMoltenRockMat.emissive.setHex(0xff7824);
      debrisMoltenRockMat.emissiveIntensity = 0.98;
      debrisMoltenRockMat.needsUpdate = true;
    }

    // Outer buckled cathedral flagstone slabs (textured dark granite & charred obsidian with glowing lava veins!)
    const stoneSlabMat = new THREE.MeshStandardMaterial({
      color: 0x868a9c,
      map: rockTex.stoneRockTex,
      bumpMap: rockTex.stoneBumpTex,
      bumpScale: 0.032,
      vertexColors: true,
      roughness: 0.90,
      metalness: 0.05
    });
    const moltenSlabMat = new THREE.MeshStandardMaterial({
      color: 0x4c4045,
      map: rockTex.stoneRockTex,
      bumpMap: rockTex.stoneBumpTex,
      bumpScale: 0.034,
      vertexColors: true,
      emissive: 0xff7824,
      emissiveMap: rockTex.moltenEmissiveTex,
      emissiveIntensity: 0.92,
      roughness: 0.86,
      metalness: 0.08
    });

    sharedFractureAssets = {
      craterGridGeo,
      pitApertureGeo,
      pitBowlGeo,
      slabGeos,
      boulderGeos,
      rockTex,
      circleReliefTex,
      fissureReliefTex,
      stoneSlabMat,
      moltenSlabMat
    };
    return sharedFractureAssets;
  }

  function createGroundFracturePoolEntry(assets) {
    const slotIdx = nextGroundFractureSlotIdx % 16;
    nextGroundFractureSlotIdx += 1;
    // Odd unique 8-bit stencil ID (3, 5, 7, ..., 33):
    //   - Bit 0 (0x01) = "inside ANY open pit" (masks bossRing, floor decals & overlapping crater rim decals!)
    //   - Bits 1..7 = unique crater slot ID (100% isolated overlapping 3D pits!)
    const stencilId = ((slotIdx + 1) << 1) | 1;
    const baseOrder = -120 + slotIdx * 5;

    const group = new THREE.Group();

    // --- REAL PHYSICALLY RECESSED 3D STENCIL PIT (isolated per slot, BEFORE opaque actors at renderOrder 0!) ---
    const pitGroup = new THREE.Group();

    const pitStencilMaskMat = new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      stencilWrite: true,
      stencilRef: stencilId,
      stencilFunc: THREE.AlwaysStencilFunc,
      stencilFuncMask: 0xFF,
      stencilWriteMask: 0xFF,
      stencilFail: THREE.KeepStencilOp,
      stencilZFail: THREE.KeepStencilOp,
      stencilZPass: THREE.ReplaceStencilOp
    });
    const pitStencilMask = new THREE.Mesh(assets.pitApertureGeo, pitStencilMaskMat);
    pitStencilMask.position.y = 0.028;
    pitStencilMask.renderOrder = baseOrder + 0;
    pitStencilMask.frustumCulled = false;

    const pitDepthClearMat = new THREE.ShaderMaterial({
      vertexShader: `void main() { vec4 c = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = vec4(c.xy, c.w * 0.99995, c.w); }`,
      fragmentShader: `void main() { gl_FragColor = vec4(0.0); }`,
      colorWrite: false,
      depthWrite: true,
      depthTest: true,
      depthFunc: THREE.AlwaysDepth,
      side: THREE.DoubleSide,
      stencilWrite: true,
      stencilRef: stencilId,
      stencilFunc: THREE.EqualStencilFunc,
      stencilFuncMask: 0xFF,
      stencilWriteMask: 0x00,
      stencilFail: THREE.KeepStencilOp,
      stencilZFail: THREE.KeepStencilOp,
      stencilZPass: THREE.KeepStencilOp
    });
    const pitDepthClear = new THREE.Mesh(assets.pitApertureGeo, pitDepthClearMat);
    pitDepthClear.position.y = 0.028;
    pitDepthClear.renderOrder = baseOrder + 1;
    pitDepthClear.frustumCulled = false;

    const pitBowlMat = createCraterPitBowlMaterial(stencilId);
    const pitBowlMesh = new THREE.Mesh(assets.pitBowlGeo, pitBowlMat);
    pitBowlMesh.position.y = 0.002;
    pitBowlMesh.renderOrder = baseOrder + 2;
    pitBowlMesh.frustumCulled = false;

    // Per-slot stencil-masked textured granite & volcanic boulder materials (clipped cleanly by floor overhang!)
    const pitInnerStoneMat = new THREE.MeshStandardMaterial({
      color: 0x626678,
      map: assets.rockTex.stoneRockTex,
      bumpMap: assets.rockTex.stoneBumpTex,
      bumpScale: 0.036,
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.05,
      stencilWrite: true,
      stencilRef: stencilId,
      stencilFunc: THREE.EqualStencilFunc,
      stencilFuncMask: 0xFF,
      stencilWriteMask: 0x00,
      stencilFail: THREE.KeepStencilOp,
      stencilZFail: THREE.KeepStencilOp,
      stencilZPass: THREE.KeepStencilOp
    });
    const pitInnerMoltenMat = new THREE.MeshStandardMaterial({
      color: 0x423539,
      map: assets.rockTex.stoneRockTex,
      bumpMap: assets.rockTex.stoneBumpTex,
      bumpScale: 0.036,
      vertexColors: true,
      emissive: 0xff7824,
      emissiveMap: assets.rockTex.moltenEmissiveTex,
      emissiveIntensity: 1.05,
      roughness: 0.86,
      metalness: 0.08,
      stencilWrite: true,
      stencilRef: stencilId,
      stencilFunc: THREE.EqualStencilFunc,
      stencilFuncMask: 0xFF,
      stencilWriteMask: 0x00,
      stencilFail: THREE.KeepStencilOp,
      stencilZFail: THREE.KeepStencilOp,
      stencilZPass: THREE.KeepStencilOp
    });

    // 10 REAL 3D sculpted angular stone boulders & collapsed flagstone slabs resting DEEP INSIDE THE PIT!
    // Physically positioned at y = -1.34m .. -0.68m so deep open chasm depth reads unmistakably around the rubble!
    const pitInnerRocks = [];
    const innerRockCount = isMobileDevice ? 7 : 10;
    for (let i = 0; i < innerRockCount; i++) {
      const useBoulder = i % 3 !== 2;
      const geo = useBoulder
        ? assets.boulderGeos[i % assets.boulderGeos.length]
        : assets.slabGeos[i % assets.slabGeos.length];
      const rm = new THREE.Mesh(geo, pitInnerStoneMat);
      rm.rotation.order = 'YXZ';
      rm.castShadow = false;
      rm.receiveShadow = false;
      rm.renderOrder = baseOrder + 3;
      pitGroup.add(rm);

      const isDeepCluster = i < 4;
      const ang = (i / innerRockCount) * Math.PI * 2 + (isDeepCluster ? 0.35 : 0.82);
      const distFrac = isDeepCluster ? (0.06 + (i % 2) * 0.065) : (0.19 + (i % 3) * 0.045);
      // Seated cleanly on the deep chasm bottom (-1.34m .. -1.06m) & lower stone shelves (-0.98m .. -0.68m)!
      const depthY = isDeepCluster ? (-1.34 + (i % 3) * 0.12) : (-0.98 + (i % 3) * 0.14);
      pitInnerRocks.push({
        mesh: rm,
        dirX: Math.cos(ang) * distFrac,
        dirZ: Math.sin(ang) * distFrac,
        baseDepthY: depthY,
        yaw: ang + 1.15 + (i % 3) * 0.42,
        pitch: (isDeepCluster ? 0.30 : 0.56) * ((i % 2) * 2 - 1),
        roll: (0.26 + (i % 3) * 0.16) * ((i % 3 === 0) ? -1 : 1),
        scaleW: isDeepCluster ? (0.92 + (i % 3) * 0.20) : (0.78 + (i % 3) * 0.18),
        scaleH: useBoulder ? (0.95 + (i % 2) * 0.24) : 1.15
      });
    }

    pitGroup.add(pitStencilMask, pitDepthClear, pitBowlMesh);
    group.add(pitGroup);

    // Outer cracked cathedral stone rim ring (center hole is discarded in fragment shader!)
    const craterMat = createShatteredCraterShaderMaterial(assets.circleReliefTex);
    const craterDisc = new THREE.Mesh(assets.craterGridGeo, craterMat);
    craterDisc.position.y = 0.006;
    craterDisc.renderOrder = 2;
    group.add(craterDisc);

    // 3x Volumetric Fire Field ('circle', 1.0s blaze) & Fire Road ('fissure') from soulsFireVfx.js
    const fireField = typeof SoulsFireVfx.createVolumetricFireFieldMesh === 'function'
      ? SoulsFireVfx.createVolumetricFireFieldMesh({ isMobile: isMobileDevice, lowSpec: lowSpecMode })
      : null;
    if (fireField?.group) {
      fireField.group.position.y = 0.014;
      fireField.group.renderOrder = 6;
      fireField.group.visible = false;
      group.add(fireField.group);
    }

    const fireRoad = typeof SoulsFireVfx.createVolumetricFireRoadMesh === 'function'
      ? SoulsFireVfx.createVolumetricFireRoadMesh({ isMobile: isMobileDevice, lowSpec: lowSpecMode })
      : null;
    if (fireRoad?.group) {
      fireRoad.group.position.y = 0.014;
      fireRoad.group.renderOrder = 6;
      fireRoad.group.visible = false;
      group.add(fireRoad.group);
    }

    // 18 multi-tier 3D broken cathedral flagstones STRICTLY OUTSIDE THE PIT APERTURE (NEVER hovering over the hole!):
    //   - Tier 1 (0..9):  10 buckled crater-rim flagstone wedges sitting around the jagged pit lip (r = 0.50..0.62R)
    //   - Tier 2 (10..17): 8 outer fractured spall plates & scattered broken stones around the rim (r = 0.70..0.88R)
    const slabs = [];
    const slabCount = 18;
    for (let i = 0; i < slabCount; i++) {
      const sm = new THREE.Mesh(assets.slabGeos[i % assets.slabGeos.length], assets.stoneSlabMat);
      sm.rotation.order = 'YXZ';
      sm.castShadow = false;
      sm.receiveShadow = true;
      group.add(sm);

      let ringAng;
      let distFrac;
      let circlePitch;
      let circleLift;
      let tier;
      if (i < 10) {
        // Primary buckled crater-rim wedges strictly OUTSIDE evalCraterPitEdgeR(ringAng)!
        tier = 1;
        ringAng = (i / 10) * Math.PI * 2 + 0.09 + ((i % 2) - 0.5) * 0.06;
        const localPitEdge = evalCraterPitEdgeR(ringAng);
        distFrac = localPitEdge + 0.09 + (i % 3) * 0.038;
        circlePitch = 0.28 + (i % 4) * 0.052;
        circleLift = 0.075 + (i % 4) * 0.034;
      } else {
        // Outer perimeter fractured spall plates & scattered rubble around the crater
        tier = 2;
        const k = i - 10;
        ringAng = (k / 8) * Math.PI * 2 + 0.34;
        const localPitEdge = evalCraterPitEdgeR(ringAng);
        distFrac = Math.max(0.72, localPitEdge + 0.26) + (k % 2) * 0.08;
        circlePitch = 0.14 + (k % 3) * 0.042;
        circleLift = 0.042 + (k % 3) * 0.020;
      }

      const side = i < 9 ? -1 : 1;
      const idxSide = i % 9;
      const zFrac = -0.86 + (idxSide / 8) * 1.72;
      const isInnerTrenchSlab = idxSide % 4 === 0;
      const xFrac = side * (isInnerTrenchSlab ? 0.22 : 0.38 + (idxSide % 3) * 0.11);

      slabs.push({
        mesh: sm,
        tier,
        circleX: Math.cos(ringAng) * distFrac,
        circleZ: Math.sin(ringAng) * distFrac,
        circleYaw: Math.atan2(Math.cos(ringAng), Math.sin(ringAng)),
        circlePitch,
        circleLift,
        fissureX: xFrac,
        fissureZ: zFrac,
        fissureYaw: (side > 0 ? Math.PI * 0.5 : -Math.PI * 0.5) + ((idxSide % 3) - 1) * 0.20,
        fissurePitch: isInnerTrenchSlab ? -0.34 : 0.30 + (idxSide % 3) * 0.07,
        fissureLift: isInnerTrenchSlab ? 0.022 : 0.088 + (idxSide % 3) * 0.032,
        tiltPitch: circlePitch,
        tiltRoll: ((i % 2) * 2 - 1) * (0.09 + (i % 3) * 0.045),
        scaleW: tier === 1 ? (0.94 + (i % 3) * 0.20) : (0.80 + (i % 4) * 0.18),
        maxLiftY: circleLift
      });
    }

    scene.add(group);
    return {
      group,
      pitGroup,
      pitStencilMask,
      pitDepthClear,
      pitBowlMesh,
      pitBowlMat,
      pitInnerStoneMat,
      pitInnerMoltenMat,
      pitInnerRocks,
      craterMat,
      craterDisc,
      fireField,
      fireRoad,
      slabs,
      x: 0,
      z: 0,
      groundY: 0,
      dirX: 0,
      dirZ: 1,
      kind: 'circle',
      age: 0,
      duration: 2.4,
      fireDuration: 1.0,
      radius: 4.2,
      pitDepth: 1.05,
      molten: false,
      burning: false,
      emberTick: 0,
      seed: 0,
      wrenchImpulse: 0
    };
  }

  function ensurePoolEntryFireMeshes(entry) {
    if (!entry) return;
    if (!entry.fireField && typeof SoulsFireVfx.createVolumetricFireFieldMesh === 'function') {
      entry.fireField = SoulsFireVfx.createVolumetricFireFieldMesh({ isMobile: isMobileDevice, lowSpec: lowSpecMode });
      if (entry.fireField?.group) {
        entry.fireField.group.position.y = 0.014;
        entry.fireField.group.renderOrder = 6;
        entry.fireField.group.visible = false;
        entry.group.add(entry.fireField.group);
      }
    }
    if (!entry.fireRoad && typeof SoulsFireVfx.createVolumetricFireRoadMesh === 'function') {
      entry.fireRoad = SoulsFireVfx.createVolumetricFireRoadMesh({ isMobile: isMobileDevice, lowSpec: lowSpecMode });
      if (entry.fireRoad?.group) {
        entry.fireRoad.group.position.y = 0.014;
        entry.fireRoad.group.renderOrder = 6;
        entry.fireRoad.group.visible = false;
        entry.group.add(entry.fireRoad.group);
      }
    }
  }

  function spawnBossGroundFracture({
    x = 0,
    z = 0,
    radius = 4.2,
    molten = false,
    burning = false,
    fissure = undefined,
    kind = 'circle',
    shape = undefined,
    dirX = 0,
    dirZ = 1,
    duration = 2.4
  } = {}) {
    const assets = getSharedFractureAssets();
    const safeR = Math.max(1.2, Math.min(7.8, Number(radius) || 4.2));
    const isFissure = Boolean(fissure) || kind === 'fissure' || kind === 'line' || shape === 'fissure' || shape === 'line';
    const normKind = isFissure ? 'fissure' : 'circle';
    const isMolten = Boolean(molten) || Boolean(burning);
    const isBurning = isMolten && (Boolean(burning) || isFissure || Number(duration) <= 1.25);

    const rawDur = Number(duration);
    let safeDur = Math.max(
      0.5,
      Math.min(8.5, Number.isFinite(rawDur) && rawDur > 0 ? rawDur : (isFissure && isMolten ? 3.8 : (isBurning ? 1.0 : 2.6)))
    );
    // Section 4.5 & 5.0: Phase-2 circular burning fire fields strictly extinguish by <= 1.0s!
    if (isMolten && !isFissure && Boolean(burning)) {
      safeDur = Math.min(safeDur, 1.0);
    }
    const fireDuration = isMolten
      ? (isFissure ? safeDur : Math.min(safeDur, 1.0))
      : 0.0;

    let ndx = Number(dirX) || 0;
    let ndz = Number(dirZ) || 0;
    const dLen = Math.hypot(ndx, ndz);
    if (dLen > 0.0001) {
      ndx /= dLen;
      ndz /= dLen;
    } else {
      ndx = 0;
      ndz = 1;
    }

    let entry = freeGroundFractures.pop();
    if (!entry) {
      if (activeGroundFractures.length >= 16) {
        entry = activeGroundFractures.shift();
      } else {
        entry = createGroundFracturePoolEntry(assets);
      }
    }
    ensurePoolEntryFireMeshes(entry);

    const groundY = getGroundHeight(x, z);
    entry.x = x;
    entry.z = z;
    entry.groundY = groundY;
    entry.dirX = ndx;
    entry.dirZ = ndz;
    entry.kind = normKind;
    entry.age = 0;
    entry.duration = safeDur;
    entry.fireDuration = fireDuration;
    entry.radius = safeR;
    entry.molten = isMolten;
    entry.burning = isBurning;
    entry.emberTick = Math.random() * 0.06;
    entry.seed = Math.random() * 12.56;
    entry.wrenchImpulse = 0;

    entry.group.position.set(x, groundY, z);
    entry.group.rotation.y = isFissure ? Math.atan2(ndx, ndz) : Math.random() * Math.PI * 2;

    const cu = entry.craterMat.uniforms;
    cu.uReliefMap.value = isFissure ? assets.fissureReliefTex : assets.circleReliefTex;
    cu.uOpacity.value = 1.0;
    cu.uCollapse.value = 0.25;
    cu.uHeave.value = 0.25;
    cu.uMolten.value = isMolten ? 1.0 : 0.0;
    cu.uFissure.value = isFissure ? 1.0 : 0.0;
    cu.uTime.value = 0.0;
    cu.uSeed.value = entry.seed;
    cu.uWrenchPulse.value = 0.0;
    entry.craterDisc.scale.set(
      isFissure ? safeR * 0.90 : safeR * 1.04,
      1,
      isFissure ? safeR * 1.20 : safeR * 1.04
    );

    // Wire REAL physically recessed 3D Stencil Pit for circular hammer craters (steep 1.35..1.65m deep broken chasm!)
    const showRealPit = !isFissure;
    entry.pitDepth = Math.min(1.22, Math.max(0.88, safeR * 0.22));
    if (entry.pitGroup) {
      entry.pitGroup.visible = showRealPit;
      if (showRealPit) {
        entry.pitStencilMask.scale.set(safeR, 1, safeR);
        entry.pitDepthClear.scale.set(safeR, 1, safeR);
        entry.pitBowlMesh.scale.set(safeR, entry.pitDepth * 0.45, safeR);
        entry.pitBowlMat.uniforms.uMolten.value = isMolten ? 1.0 : 0.0;
        entry.pitBowlMat.uniforms.uTime.value = 0.0;
        entry.pitBowlMat.uniforms.uSeed.value = entry.seed;
        entry.pitBowlMat.uniforms.uGroundY.value = groundY;

        const innerRockScale = Math.max(0.80, Math.min(1.55, safeR / 3.45));
        const innerMat = isMolten ? entry.pitInnerMoltenMat : entry.pitInnerStoneMat;
        for (let i = 0; i < entry.pitInnerRocks.length; i++) {
          const ir = entry.pitInnerRocks[i];
          ir.mesh.material = innerMat;
          ir.mesh.position.set(ir.dirX * safeR, ir.baseDepthY * entry.pitDepth, ir.dirZ * safeR);
          ir.mesh.rotation.set(ir.pitch, ir.yaw, ir.roll);
          ir.mesh.scale.set(ir.scaleW * innerRockScale, ir.scaleH * innerRockScale, innerRockScale);
          ir.mesh.visible = !lowSpecMode || i % 2 === 0;
        }
      }
    }

    // Wire 3x Volumetric Fire Field ('circle') & Fire Road ('fissure') when molten === true
    if (entry.fireField?.group) {
      const showField = isMolten && !isFissure;
      entry.fireField.group.visible = showField;
      if (showField) {
        entry.fireField.group.scale.set(safeR, 1.0, safeR);
        entry.fireField.reset?.({ radius: safeR, seed: entry.seed });
        entry.fireField.update?.(entry, 0, 0, 1.0);
      }
    }
    if (entry.fireRoad?.group) {
      const showRoad = isMolten && isFissure;
      entry.fireRoad.group.visible = showRoad;
      if (showRoad) {
        entry.fireRoad.group.scale.set(safeR * 0.88, 1.0, safeR * 1.16);
        entry.fireRoad.reset?.({ radius: safeR, seed: entry.seed });
        entry.fireRoad.update?.(entry, 0, 0, 1.0, 0.0);
      }
    }

    const slabScale = Math.max(0.64, Math.min(1.56, safeR / (isFissure ? 2.65 : 3.80)));
    for (let i = 0; i < entry.slabs.length; i++) {
      const sl = entry.slabs[i];
      const lx = (isFissure ? sl.fissureX : sl.circleX) * safeR;
      const lz = (isFissure ? sl.fissureZ : sl.circleZ) * safeR;
      const yaw = isFissure ? sl.fissureYaw : sl.circleYaw;
      sl.tiltPitch = isFissure ? sl.fissurePitch : sl.circlePitch;
      sl.maxLiftY = (isFissure ? sl.fissureLift : sl.circleLift) * (isMolten ? 1.12 : 1.0);
      sl.mesh.material = isMolten ? assets.moltenSlabMat : assets.stoneSlabMat;
      sl.mesh.position.set(lx, 0.01, lz);
      sl.mesh.rotation.set(0, yaw, 0);
      sl.mesh.scale.set(sl.scaleW * slabScale, slabScale * 1.12, slabScale);
      sl.mesh.visible = !lowSpecMode || i % 2 === 0;
    }

    entry.group.visible = true;
    activeGroundFractures.push(entry);

    // 3D jagged dark stone & flagstone rubble chunks arcing outward with gravity, single floor bounce & dust puffs!
    spawnFractureRockChunks(x, groundY, z, safeR, isMolten, isBurning, isFissure, ndx, ndz);

    // Low radial billowing dark-stone dust ring hugging the shattered flagstones (zero white lines/dots!)
    const dustCount = lowSpecMode ? 3 : (isFissure ? 5 : 7);
    for (let di = 0; di < dustCount; di++) {
      let dx;
      let dz;
      let dvx;
      let dvz;
      if (isFissure) {
        const side = di % 2 === 0 ? 1 : -1;
        const along = ((di / Math.max(1, dustCount - 1)) - 0.5) * safeR * 1.5;
        dx = ndx * along - ndz * side * 0.35;
        dz = ndz * along + ndx * side * 0.35;
        dvx = -ndz * side * (1.2 + Math.random() * 1.4) + ndx * 0.8;
        dvz = ndx * side * (1.2 + Math.random() * 1.4) + ndz * 0.8;
      } else {
        const a = (di / dustCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        const rOff = safeR * (0.18 + Math.random() * 0.32);
        dx = Math.cos(a) * rOff;
        dz = Math.sin(a) * rOff;
        const outSpd = 1.6 + Math.random() * 2.1;
        dvx = Math.cos(a) * outSpd;
        dvz = Math.sin(a) * outSpd;
      }
      spawnStoneDustPuff({
        x: x + dx,
        y: groundY + 0.16 + Math.random() * 0.12,
        z: z + dz,
        vx: dvx,
        vy: 0.32 + Math.random() * 0.42,
        vz: dvz,
        startScale: 0.65 + safeR * 0.12,
        endScale: 1.75 + safeR * 0.28,
        opacity: isMolten ? 0.34 : 0.42,
        duration: 0.62 + Math.random() * 0.24,
        color: isMolten ? 0x3b261d : (di % 2 === 0 ? 0x332e38 : 0x3e3843)
      });
    }

    // Fine dark basalt grit splinters (dark charcoal 0x2c2832 — never bright gray/white!)
    spawnParticles({
      x,
      y: groundY + 0.16,
      z,
      color: isMolten ? 0x3a251c : 0x2c2832,
      count: lowSpecMode ? 6 : 14,
      speed: 5.8 + safeR * 0.62,
      size: 0.13,
      life: 0.72,
      gravity: 21.0
    });
    if (isMolten) {
      spawnParticles({
        x,
        y: groundY + 0.24,
        z,
        color: isBurning ? 0xfb923c : 0xf97316,
        count: lowSpecMode ? 8 : (isBurning ? 18 : 14),
        speed: 6.8 + safeR * 0.55,
        size: 0.14,
        life: 0.62,
        gravity: 12.5
      });
    }
    return entry;
  }

  // Section 5.1 & 4.3: Stuck-Hammer 4-Heave Extraction Dust, Trembling Pebble Chips & Pull-4 Release Eruption!
  function spawnBossHammerWrenchDust(x = 0, z = 0, pullIndex = 1) {
    let moltenHint = false;
    if (x && typeof x === 'object') {
      const opts = x;
      x = Number(opts.x) || 0;
      z = Number(opts.z) || 0;
      pullIndex = opts.pullIndex ?? opts.pullIdx ?? 1;
      moltenHint = Boolean(opts.molten);
    }
    const px = Number.isFinite(Number(x)) ? Number(x) : 0;
    const pz = Number.isFinite(Number(z)) ? Number(z) : 0;
    const pullIdx = Math.max(1, Math.min(4, Math.round(Number(pullIndex) || 1)));
    const isFinalRip = pullIdx >= 4;
    const groundY = getGroundHeight(px, pz);

    // Find nearest active crater under the stuck warhammer so its 3D flagstones & funnel shudder with every tug!
    let nearestGf = null;
    let bestDistSq = 42.25; // <= 6.5m (covers +30% 5.53m Leap_Slam crater radius)
    for (let i = 0; i < activeGroundFractures.length; i++) {
      const gf = activeGroundFractures[i];
      const dx = gf.x - px;
      const dz = gf.z - pz;
      const dSq = dx * dx + dz * dz;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        nearestGf = gf;
      }
    }

    let isMolten = moltenHint;
    if (nearestGf) {
      isMolten = isMolten || nearestGf.molten;
      nearestGf.wrenchImpulse = isFinalRip ? 1.45 : (0.68 + pullIdx * 0.18);
      // Keep the physical stone crater intact underneath the Boss's pinned warhammer across all 4 tugs
      // (while nearestGf.fireDuration stays strictly <= 1.0s so flames still extinguish on time!)
      if (nearestGf.kind !== 'fissure') {
        nearestGf.duration = Math.max(nearestGf.duration, nearestGf.age + (isFinalRip ? 1.40 : 1.15));
      }
    }

    // 1. Fresh dark-gothic crushed-stone dust puffs billowing out of the crater mouth
    const puffCount = lowSpecMode ? (isFinalRip ? 4 : 2) : (isFinalRip ? 8 : 3 + (pullIdx >= 3 ? 1 : 0));
    for (let i = 0; i < puffCount; i++) {
      const ang = (i / puffCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.55;
      const rOff = (0.15 + Math.random() * 0.55) * (isFinalRip ? 1.35 : 0.9);
      const outSpd = (isFinalRip ? 2.2 : 0.95 + pullIdx * 0.22) * (0.75 + Math.random() * 0.55);
      spawnStoneDustPuff({
        x: px + Math.cos(ang) * rOff,
        y: groundY + 0.14 + Math.random() * 0.16,
        z: pz + Math.sin(ang) * rOff,
        vx: Math.cos(ang) * outSpd,
        vy: (isFinalRip ? 0.85 : 0.36 + pullIdx * 0.08) + Math.random() * 0.35,
        vz: Math.sin(ang) * outSpd,
        startScale: isFinalRip ? 0.72 : 0.46 + pullIdx * 0.06,
        endScale: isFinalRip ? 2.15 : 1.22 + pullIdx * 0.16,
        opacity: isFinalRip ? 0.46 : 0.34 + pullIdx * 0.025,
        duration: isFinalRip ? 0.78 : 0.52 + Math.random() * 0.16,
        color: isMolten ? 0x3d261c : (i % 2 === 0 ? 0x332e38 : 0x3f3945)
      });
    }

    // 2. Trembling stone pebble chips on tugs 1..3 -> dramatic shattered flagstone release burst on pullIndex === 4!
    if (activeDebris.length <= 116) {
      const chipCount = lowSpecMode
        ? (isFinalRip ? 6 : 2)
        : (isFinalRip ? 12 : 3 + pullIdx);
      for (let i = 0; i < chipCount; i++) {
        const kind = isMolten
          ? 'molten_chunk'
          : (i % 3 === 0 ? 'flagstone_chip' : 'rock_chunk');
        const d = acquireDebrisPiece(kind);
        const ang = (i / chipCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
        const rOff = 0.14 + Math.random() * (isFinalRip ? 0.72 : 0.42);
        const horizSpd = isFinalRip
          ? (2.6 + Math.random() * 4.2)
          : (1.05 + pullIdx * 0.32 + Math.random() * 1.35);

        d.x = px + Math.cos(ang) * rOff;
        d.y = groundY + 0.10 + Math.random() * 0.14;
        d.z = pz + Math.sin(ang) * rOff;
        d.vx = Math.cos(ang) * horizSpd;
        d.vz = Math.sin(ang) * horizSpd;
        d.vy = isFinalRip
          ? (4.8 + Math.random() * 3.8)
          : (2.1 + pullIdx * 0.48 + Math.random() * 1.45);
        d.vrx = (Math.random() - 0.5) * (isFinalRip ? 21 : 14);
        d.vry = (Math.random() - 0.5) * (isFinalRip ? 21 : 14);
        d.vrz = (Math.random() - 0.5) * (isFinalRip ? 21 : 14);
        d.age = 0;
        d.life = isFinalRip ? (1.15 + Math.random() * 0.40) : (0.76 + Math.random() * 0.26);
        d.baseScale = isFinalRip
          ? (0.72 + Math.random() * 0.68)
          : (0.42 + Math.random() * 0.36);
        d.bounces = 0;
        d.emitBounceDust = isFinalRip || i % 2 === 0;
        d.mesh.position.set(d.x, d.y, d.z);
        d.mesh.rotation.set(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28);
        d.mesh.scale.setScalar(d.baseScale);
        activeDebris.push(d);
      }
    }

    // 3. Fine dark stone grit & screen micro-tremor (heavier jolt on pull 4 release!)
    spawnParticles({
      x: px,
      y: groundY + 0.14,
      z: pz,
      color: isMolten ? 0x3b251c : 0x2d2833,
      count: lowSpecMode ? (isFinalRip ? 5 : 2) : (isFinalRip ? 12 : 4 + pullIdx),
      speed: isFinalRip ? 5.8 : 2.6 + pullIdx * 0.5,
      size: isFinalRip ? 0.125 : 0.095,
      life: isFinalRip ? 0.68 : 0.46,
      gravity: 20.5
    });
    if (isMolten) {
      spawnParticles({
        x: px,
        y: groundY + 0.20,
        z: pz,
        color: isFinalRip ? 0xfbbf24 : 0xf97316,
        count: lowSpecMode ? 3 : (isFinalRip ? 12 : 5),
        speed: isFinalRip ? 6.4 : 3.4,
        size: 0.12,
        life: 0.54,
        gravity: 11.5
      });
    }
    addScreenShake(isFinalRip ? 0.24 : 0.055 + pullIdx * 0.02);
  }

  // Sleek Projectile Geometries (Oriented so +Z is forward flight direction!)
  // 1) Realistic Metallic Brass Cartridge + Copper Ogive Bullet Nose + Thin Ballistic Tracer Streak (ZERO plasma!)
  const bulletCoreGeo = (() => {
    const g = new THREE.ConeGeometry(0.036, 0.22, 8);
    g.rotateX(Math.PI / 2);
    g.translate(0, 0, 0.09);
    return g;
  })();
  const bulletBrassCaseGeo = (() => {
    const g = new THREE.CylinderGeometry(0.036, 0.036, 0.20, 8);
    g.rotateX(Math.PI / 2);
    g.translate(0, 0, -0.10);
    return g;
  })();
  const bulletCopperMat = new THREE.MeshStandardMaterial({
    color: 0xd97736,
    emissive: 0x9a3412,
    emissiveIntensity: 0.35,
    metalness: 0.88,
    roughness: 0.22
  });
  const bulletBrassMat = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    emissive: 0xa16207,
    emissiveIntensity: 0.42,
    metalness: 0.92,
    roughness: 0.18
  });
  const bulletTracerMat = new THREE.MeshBasicMaterial({
    color: 0xfde047,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false
  });
  const bulletTailGeo = (() => {
    const g = new THREE.ConeGeometry(0.022, 1.05, 6, 1, true);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -0.68);
    return g;
  })();

  // 1b) Compact Blazing Hot-Brass / Tungsten Buckshot Pellet + 0.85m Smoky-Amber Fiery Wake
  const buckshotCoreGeo = (() => {
    const g = new THREE.ConeGeometry(0.062, 0.28, 6);
    g.rotateX(Math.PI / 2);
    return g;
  })();
  const buckshotSparkGeo = (() => {
    const g = new THREE.OctahedronGeometry(0.052, 0);
    g.scale(0.85, 0.85, 1.45);
    return g;
  })();
  const buckshotWakeGeo = (() => {
    const g = new THREE.ConeGeometry(0.088, 0.85, 6, 1, true);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -0.42);
    return g;
  })();

  // 2) Arcane / Elemental Sculpted 3D Geometries (Fire Tongues, Water Orb, Lightning Zig-Zag, Air Cyclone)
  const spellCrystalGeo = new THREE.OctahedronGeometry(0.18, 0);
  const fireHeartGeo = new THREE.SphereGeometry(0.165, 10, 10);
  const fireTongueGeo = (() => {
    const g = new THREE.ConeGeometry(0.145, 0.92, 6, 1, true);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -0.34);
    return g;
  })();
  const waterOrbGeo = (() => {
    const g = new THREE.SphereGeometry(0.19, 12, 12);
    g.scale(0.92, 0.92, 1.28);
    return g;
  })();
  const lightningZigGeo = (() => {
    const g = new THREE.OctahedronGeometry(0.085, 0);
    g.scale(0.45, 0.45, 4.8);
    return g;
  })();
  const airCutterGeo = getSlashCrescentGeo(Math.PI * 0.92);
  const spellTailGeo = (() => {
    const g = new THREE.ConeGeometry(0.22, 1.55, 8, 1, true);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -0.78);
    return g;
  })();
  const spellOrbitRingGeo = new THREE.TorusGeometry(0.26, 0.025, 6, 18);

  // Pooled 3D Chain-Lightning Arcs between enemies!
  const activeLightningArcs = [];
  const freeLightningArcs = [];
  const unitBoltSegGeo = (() => {
    const g = new THREE.BoxGeometry(0.055, 0.055, 1.0);
    g.translate(0, 0, 0.5);
    return g;
  })();

  function spawnLightningArc({ x1 = 0, z1 = 0, x2 = 1, z2 = 1, color = 0x38bdf8 } = {}) {
    let arc = freeLightningArcs.pop();
    if (!arc) {
      const group = new THREE.Group();
      const outerMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      });
      const innerMat = new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.98,
        depthWrite: false,
        toneMapped: false
      });
      const segs = [];
      for (let i = 0; i < 3; i++) {
        const sGrp = new THREE.Group();
        const outer = new THREE.Mesh(unitBoltSegGeo, outerMat);
        outer.scale.set(1.6, 1.6, 1);
        const inner = new THREE.Mesh(unitBoltSegGeo, innerMat);
        sGrp.add(outer, inner);
        group.add(sGrp);
        segs.push(sGrp);
      }
      scene.add(group);
      arc = { group, segs, outerMat, innerMat, age: 0, duration: 0.14 };
    } else {
      arc.outerMat.color.setHex(color);
      arc.outerMat.opacity = 0.95;
      arc.innerMat.opacity = 0.98;
      arc.group.visible = true;
    }

    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.max(0.2, Math.hypot(dx, dz));
    const perpX = -dz / len;
    const perpZ = dx / len;
    const j1 = (Math.random() - 0.5) * Math.min(0.85, len * 0.22);
    const j2 = (Math.random() - 0.5) * Math.min(0.85, len * 0.22);
    const pts = [
      { x: x1, z: z1 },
      { x: x1 + dx * 0.33 + perpX * j1, z: z1 + dz * 0.33 + perpZ * j1 },
      { x: x1 + dx * 0.67 + perpX * j2, z: z1 + dz * 0.67 + perpZ * j2 },
      { x: x2, z: z2 }
    ];
    for (let i = 0; i < 3; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const sdx = b.x - a.x;
      const sdz = b.z - a.z;
      const slen = Math.max(0.05, Math.hypot(sdx, sdz));
      const sg = arc.segs[i];
      sg.position.set(a.x, 0.82, a.z);
      sg.rotation.y = Math.atan2(sdx, sdz);
      sg.scale.set(1, 1, slen);
    }
    arc.age = 0;
    arc.duration = 0.14;
    activeLightningArcs.push(arc);
  }

  // ==========================================================================
  // Pooled 3D Physics Debris (Skulls, Bones, Flying Shields & Helmets)
  // + 3D Water Prison Sphere, Elemental Tornado/Fire-Patch/Sky-Bolt & Meteors!
  // ==========================================================================
  const debrisSkullGeo = new THREE.SphereGeometry(0.14, 8, 7);
  const debrisBoneGeo = (() => {
    const g = new THREE.CylinderGeometry(0.032, 0.036, 0.42, 6);
    g.rotateZ(Math.PI / 2);
    return g;
  })();
  const debrisHelmGeo = new THREE.SphereGeometry(0.22, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const debrisShieldGeo = (() => {
    const g = new THREE.CylinderGeometry(0.28, 0.28, 0.05, 10);
    g.rotateX(Math.PI / 2);
    return g;
  })();
  const debrisRockGeo = (() => {
    const g = new THREE.DodecahedronGeometry(0.118, 0);
    g.scale(1.36, 0.66, 0.98);
    g.computeVertexNormals();
    return g;
  })();
  const debrisFlagstoneChipGeo = (() => {
    const g = new THREE.CylinderGeometry(0.145, 0.175, 0.052, 5, 1, false);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      pos.setX(i, vx * (vx > 0 ? 1.24 : 0.86));
      pos.setZ(i, vz * (vz > 0 ? 0.88 : 1.18));
    }
    g.computeVertexNormals();
    return g;
  })();
  const debrisBoneMat = new THREE.MeshStandardMaterial({ color: 0xe7e0d0, roughness: 0.55, metalness: 0.05 });
  const debrisHelmMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.35, metalness: 0.75 });
  const debrisShieldMat = new THREE.MeshStandardMaterial({ color: 0x784828, roughness: 0.72, metalness: 0.22 });
  const debrisRockMat = new THREE.MeshStandardMaterial({ color: 0x2f2a35, roughness: 0.90, metalness: 0.05 });
  const debrisFlagstoneChipMat = new THREE.MeshStandardMaterial({ color: 0x393441, roughness: 0.88, metalness: 0.05 });
  const debrisMoltenRockMat = new THREE.MeshStandardMaterial({
    color: 0x231917,
    emissive: 0xea580c,
    emissiveIntensity: 0.72,
    roughness: 0.78,
    metalness: 0.12
  });

  const activeDebris = [];
  const freeDebrisByKind = {
    skull: [],
    bone: [],
    helmet: [],
    shield: [],
    rock_chunk: [],
    flagstone_chip: [],
    molten_chunk: []
  };

  function acquireDebrisPiece(kind = 'bone') {
    const bucket = freeDebrisByKind[kind] || freeDebrisByKind.bone;
    let d = bucket.pop();
    if (!d) {
      let mesh;
      if (kind === 'skull') {
        mesh = new THREE.Mesh(debrisSkullGeo, debrisBoneMat);
        mesh.scale.set(0.92, 1.05, 0.96);
      } else if (kind === 'helmet') {
        mesh = new THREE.Mesh(debrisHelmGeo, debrisHelmMat);
      } else if (kind === 'shield') {
        mesh = new THREE.Mesh(debrisShieldGeo, debrisShieldMat);
      } else if (kind === 'rock_chunk') {
        mesh = new THREE.Mesh(debrisRockGeo, debrisRockMat);
      } else if (kind === 'flagstone_chip') {
        mesh = new THREE.Mesh(debrisFlagstoneChipGeo, debrisFlagstoneChipMat);
      } else if (kind === 'molten_chunk') {
        mesh = new THREE.Mesh(debrisRockGeo, debrisMoltenRockMat);
      } else {
        mesh = new THREE.Mesh(debrisBoneGeo, debrisBoneMat);
      }
      scene.add(mesh);
      d = {
        kind,
        mesh,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        vrx: 0,
        vry: 0,
        vrz: 0,
        age: 0,
        life: 0.9,
        baseScale: 1,
        bounces: 0,
        emitBounceDust: false
      };
    }
    d.bounces = 0;
    d.emitBounceDust = false;
    d.mesh.visible = true;
    return d;
  }

  function spawnFractureRockChunks(x, groundY, z, radius, isMolten, isBurning, isFissure, dirX, dirZ) {
    if (activeDebris.length > 108) return;
    const count = lowSpecMode ? 6 : (isFissure ? 11 : 15);
    const perpX = -dirZ;
    const perpZ = dirX;

    for (let i = 0; i < count; i++) {
      const isFlatChip = !isMolten && i % 3 === 1;
      const kind = isMolten ? 'molten_chunk' : (isFlatChip ? 'flagstone_chip' : 'rock_chunk');
      const d = acquireDebrisPiece(kind);
      // Heavy big chunks fly slower & land closer; small jagged chips launch faster & bounce further!
      const isHeavyBlock = i % 4 === 0;
      let vx;
      let vz;
      let ox;
      let oz;
      const spd = (isHeavyBlock ? 2.4 + Math.random() * 2.2 : 3.6 + Math.random() * 4.2) * (0.85 + Math.min(0.45, radius * 0.08));

      if (isFissure) {
        const side = i % 2 === 0 ? 1 : -1;
        const along = ((i / Math.max(1, count - 1)) - 0.5) * radius * 1.45;
        ox = dirX * along + perpX * side * (0.16 + Math.random() * 0.26);
        oz = dirZ * along + perpZ * side * (0.16 + Math.random() * 0.26);
        const fwdMix = 0.35 + Math.random() * 0.55;
        const latMix = side * (0.55 + Math.random() * 0.45);
        const inv = 1 / Math.max(0.001, Math.hypot(fwdMix, latMix));
        vx = (dirX * fwdMix + perpX * latMix) * inv * spd;
        vz = (dirZ * fwdMix + perpZ * latMix) * inv * spd;
      } else {
        const ang = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.38;
        const fallsIntoPit = i % 3 === 0;
        const rOff = fallsIntoPit
          ? radius * (0.06 + Math.random() * 0.22)
          : radius * (0.34 + Math.random() * 0.28);
        const effSpd = fallsIntoPit ? (0.45 + Math.random() * 0.85) : spd;
        ox = Math.cos(ang) * rOff;
        oz = Math.sin(ang) * rOff;
        vx = Math.cos(ang) * effSpd;
        vz = Math.sin(ang) * effSpd;
      }

      d.x = x + ox;
      d.y = groundY + 0.12 + Math.random() * 0.16;
      d.z = z + oz;
      d.vx = vx;
      d.vz = vz;
      d.vy = isHeavyBlock ? (3.8 + Math.random() * 2.6) : (4.8 + Math.random() * 4.1);
      d.vrx = (Math.random() - 0.5) * (isHeavyBlock ? 11 : 19);
      d.vry = (Math.random() - 0.5) * (isHeavyBlock ? 12 : 20);
      d.vrz = (Math.random() - 0.5) * (isHeavyBlock ? 11 : 19);
      d.age = 0;
      d.life = 1.32 + Math.random() * 0.48;
      d.baseScale = isHeavyBlock ? (1.12 + Math.random() * 0.52) : (0.66 + Math.random() * 0.56);
      d.bounces = 0;
      d.emitBounceDust = !lowSpecMode && (isHeavyBlock || i % 2 === 0);
      d.mesh.position.set(d.x, d.y, d.z);
      d.mesh.rotation.set(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28);
      d.mesh.scale.setScalar(d.baseScale);
      activeDebris.push(d);
    }
  }

  // ==========================================================================
  // Pooled 3D Oak Wood Shield-Scrape Splinters & Shavings (0 per-hit allocations!)
  // ==========================================================================
  const woodSplinterGeoLong = (() => {
    const g = new THREE.BoxGeometry(0.025, 0.010, 0.215, 1, 1, 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const pz = pos.getZ(i);
      if (Math.abs(pz) > 0.08) {
        const tipSign = pz > 0 ? 1 : -1;
        pos.setX(i, pos.getX(i) * 0.22 + tipSign * 0.004);
        pos.setY(i, pos.getY(i) * 0.45);
      }
    }
    g.computeVertexNormals();
    return g;
  })();

  const woodSplinterGeoChip = (() => {
    const g = new THREE.BoxGeometry(0.044, 0.009, 0.148, 1, 1, 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const pz = pos.getZ(i);
      if (Math.abs(pz) > 0.05) {
        pos.setX(i, pos.getX(i) * 0.42);
        pos.setY(i, pos.getY(i) + 0.003);
      }
    }
    g.computeVertexNormals();
    return g;
  })();

  const woodSplinterMats = [
    new THREE.MeshStandardMaterial({ color: 0xc28e52, roughness: 0.78, metalness: 0.04 }),
    new THREE.MeshStandardMaterial({ color: 0x8c5828, roughness: 0.84, metalness: 0.05 }),
    new THREE.MeshStandardMaterial({ color: 0xdcb47e, roughness: 0.72, metalness: 0.03 })
  ];

  const activeWoodSplinters = [];
  const freeWoodSplinters = [];
  const MAX_WOOD_SPLINTERS_POOL = 96;

  function createWoodSplinterEntry(variantIdx = 0) {
    const mat = woodSplinterMats[variantIdx % woodSplinterMats.length];
    const geo = variantIdx % 3 === 1 ? woodSplinterGeoChip : woodSplinterGeoLong;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.visible = false;
    scene.add(mesh);
    return {
      mesh,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      vrx: 0,
      vry: 0,
      vrz: 0,
      age: 0,
      life: 1.1,
      sx: 1,
      sy: 1,
      sz: 1,
      bounced: false
    };
  }

  function spawnWoodShieldSplinters(x = 0, y = 0.96, z = 0, dirX = 0, dirZ = 1, isHeavy = false) {
    if (x && typeof x === 'object') {
      const opts = x;
      x = Number(opts.x) || 0;
      y = opts.y !== undefined ? Number(opts.y) : 0.96;
      z = Number(opts.z) || 0;
      dirX = Number(opts.dirX) || 0;
      dirZ = opts.dirZ !== undefined ? Number(opts.dirZ) : 1;
      isHeavy = Boolean(opts.isHeavy);
    }

    const heavy = Boolean(isHeavy);
    let ux = Number(dirX) || 0;
    let uz = Number(dirZ) || 0;
    const dLen = Math.hypot(ux, uz);
    if (dLen > 0.0001) {
      ux /= dLen;
      uz /= dLen;
    } else {
      ux = 0;
      uz = 1;
    }
    // Tangent across outer face of Hero's wooden shield
    const tx = -uz;
    const tz = ux;

    const targetCount = heavy ? 16 : 12;
    const count = lowSpecMode ? Math.max(7, Math.round(targetCount * 0.62)) : targetCount;
    const spdScale = heavy ? 1.26 : 1.0;

    for (let i = 0; i < count; i++) {
      let sp = freeWoodSplinters.pop();
      if (!sp) {
        if (activeWoodSplinters.length >= MAX_WOOD_SPLINTERS_POOL) {
          sp = activeWoodSplinters.shift();
        } else {
          sp = createWoodSplinterEntry(activeWoodSplinters.length + i);
        }
      }

      // Tangential + outward deflection fan so oak shavings shear across the shield face without clipping into Hero
      const sideSign = i % 2 === 0 ? 1 : -1;
      const tangDrive = sideSign * (0.42 + Math.random() * 0.85);
      const outDrive = -0.38 + Math.random() * 0.72;
      const norm = 1 / Math.max(0.001, Math.hypot(tangDrive, outDrive));
      const spd = (2.8 + Math.random() * 4.4) * spdScale;

      sp.x = x + tx * (Math.random() - 0.5) * 0.24 + ux * (Math.random() - 0.5) * 0.10;
      sp.y = y + (Math.random() - 0.5) * 0.22;
      sp.z = z + tz * (Math.random() - 0.5) * 0.24 + uz * (Math.random() - 0.5) * 0.10;
      sp.vx = (tx * tangDrive + ux * outDrive) * norm * spd;
      sp.vz = (tz * tangDrive + uz * outDrive) * norm * spd;
      sp.vy = (1.8 + Math.random() * 3.4) * spdScale;
      sp.vrx = (Math.random() - 0.5) * 26;
      sp.vry = (Math.random() - 0.5) * 28;
      sp.vrz = (Math.random() - 0.5) * 26;
      sp.age = 0;
      sp.life = 1.05 + Math.random() * 0.35;
      sp.sx = 0.82 + Math.random() * 0.55;
      sp.sy = 0.85 + Math.random() * 0.45;
      sp.sz = (0.78 + Math.random() * 0.68) * (heavy ? 1.16 : 1.0);
      sp.bounced = false;

      sp.mesh.position.set(sp.x, sp.y, sp.z);
      sp.mesh.rotation.set(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28);
      sp.mesh.scale.set(sp.sx, sp.sy, sp.sz);
      sp.mesh.visible = true;
      activeWoodSplinters.push(sp);
    }

    // Fine pale-oak sawdust puff at shield scrape point
    spawnParticles({
      x,
      y,
      z,
      color: 0xdcb47e,
      count: lowSpecMode ? 3 : (heavy ? 7 : 5),
      speed: 3.4 * spdScale,
      size: 0.085,
      life: 0.38,
      gravity: 9.5
    });
  }

  function spawnBoneShatter(x, z, isBig = false) {
    if (activeDebris.length > 56) return;
    const boneCount = isBig ? 6 : 4;
    // 1 tumbling skull + spinning femur/rib bones!
    for (let i = 0; i <= boneCount; i++) {
      const kind = i === 0 ? 'skull' : 'bone';
      const d = acquireDebrisPiece(kind);
      const ang = (i / (boneCount + 1)) * Math.PI * 2 + (Math.random() - 0.5) * 0.7;
      const spd = (2.4 + Math.random() * 3.4) * (isBig ? 1.25 : 1.0);
      d.x = x + (Math.random() - 0.5) * 0.25;
      d.y = i === 0 ? 0.95 : 0.55 + Math.random() * 0.35;
      d.z = z + (Math.random() - 0.5) * 0.25;
      d.vx = Math.cos(ang) * spd;
      d.vz = Math.sin(ang) * spd;
      d.vy = 4.2 + Math.random() * 3.2;
      d.vrx = (Math.random() - 0.5) * 16;
      d.vry = (Math.random() - 0.5) * 16;
      d.vrz = (Math.random() - 0.5) * 16;
      d.age = 0;
      d.life = 0.82 + Math.random() * 0.22;
      d.baseScale = isBig ? 1.28 : 1.0;
      d.mesh.position.set(d.x, d.y, d.z);
      d.mesh.scale.setScalar(d.baseScale);
      activeDebris.push(d);
    }
  }

  function spawnArmorBreakPiece(kind = 'helmet', x = 0, z = 0, dirAngle = 0) {
    if (activeDebris.length > 64) return;
    const validKind = kind === 'shield' ? 'shield' : 'helmet';
    const d = acquireDebrisPiece(validKind);
    const scatter = dirAngle + (Math.random() - 0.5) * 0.9;
    const spd = 3.2 + Math.random() * 2.2;
    d.x = x;
    d.y = validKind === 'helmet' ? 1.28 : 0.85;
    d.z = z;
    d.vx = Math.sin(scatter) * spd;
    d.vz = Math.cos(scatter) * spd;
    d.vy = validKind === 'helmet' ? 5.6 : 4.2;
    d.vrx = (Math.random() - 0.5) * 18;
    d.vry = (Math.random() - 0.5) * 18;
    d.vrz = (Math.random() - 0.5) * 18;
    d.age = 0;
    d.life = 0.95;
    d.baseScale = 1.08;
    d.mesh.position.set(d.x, d.y, d.z);
    d.mesh.scale.setScalar(d.baseScale);
    activeDebris.push(d);
  }

  // 💧 3D Reference-Matched Water Prison Sphere (Matches media_1794830656604_3654e5bb.jpg 1-to-1!):
  //    1) Crystal-clear deep-sapphire core + luminous electric-cyan Fresnel outer rim + curved crescent specular highlight
  //    2) Flowing 3D caustic swirl shell + 3 tapered spiraling liquid water tendrils curling upward
  //    3) Glowing concentric ground puddle rings + 8-point flared splash crown + twisting water vortex stem
  //    4) 12 orbiting glossy mini-bubbles (each with Fresnel rim & specular dot) + explosive droplet fountain on slam!
  const waterBubbleTex = (() => {
    const size = 512;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    const cx = size * 0.5;
    const cy = size * 0.5;
    const R = size * 0.465;

    // 1. Soft outer atmospheric cyan bloom
    const outerGlow = ctx.createRadialGradient(cx, cy, R * 0.82, cx, cy, size * 0.5);
    outerGlow.addColorStop(0.0, 'rgba(56, 189, 248, 0.0)');
    outerGlow.addColorStop(0.55, 'rgba(56, 189, 248, 0.34)');
    outerGlow.addColorStop(0.78, 'rgba(96, 165, 250, 0.14)');
    outerGlow.addColorStop(1.0, 'rgba(14, 116, 144, 0.0)');
    ctx.fillStyle = outerGlow;
    ctx.fillRect(0, 0, size, size);

    // 2. Refractive liquid-glass body: crystal-clear center so skeleton inside stays sharp, vivid Fresnel rim!
    const bodyGrad = ctx.createRadialGradient(cx - R * 0.12, cy - R * 0.14, R * 0.06, cx, cy, R);
    bodyGrad.addColorStop(0.0, 'rgba(30, 64, 175, 0.10)');
    bodyGrad.addColorStop(0.48, 'rgba(37, 99, 235, 0.16)');
    bodyGrad.addColorStop(0.72, 'rgba(59, 130, 246, 0.32)');
    bodyGrad.addColorStop(0.86, 'rgba(56, 189, 248, 0.64)');
    bodyGrad.addColorStop(0.95, 'rgba(186, 230, 253, 0.92)');
    bodyGrad.addColorStop(0.985, 'rgba(224, 242, 254, 0.96)');
    bodyGrad.addColorStop(1.0, 'rgba(56, 189, 248, 0.0)');
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // 3. Internal subtle aqua-violet liquid refraction arcs
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.96, 0, Math.PI * 2);
    ctx.clip();

    // Lower-right turquoise-cyan bounce light crescent
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.52)';
    ctx.lineWidth = R * 0.09;
    ctx.lineCap = 'round';
    ctx.filter = 'blur(6px)';
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.83, Math.PI * 0.08, Math.PI * 0.56);
    ctx.stroke();

    // Internal diagonal swirling water current wisps
    ctx.strokeStyle = 'rgba(147, 197, 253, 0.28)';
    ctx.lineWidth = R * 0.065;
    ctx.beginPath();
    ctx.bezierCurveTo
      ? (ctx.moveTo(cx - R * 0.65, cy + R * 0.28),
        ctx.bezierCurveTo(cx - R * 0.2, cy + R * 0.55, cx + R * 0.35, cy + R * 0.18, cx + R * 0.68, cy - R * 0.26))
      : null;
    ctx.stroke();

    // 4. Primary upper-left curved glossy crescent specular highlight
    ctx.filter = 'blur(4px)';
    ctx.strokeStyle = 'rgba(240, 249, 255, 0.88)';
    ctx.lineWidth = R * 0.095;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.78, Math.PI * 1.06, Math.PI * 1.48);
    ctx.stroke();

    ctx.filter = 'none';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = R * 0.042;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.79, Math.PI * 1.11, Math.PI * 1.43);
    ctx.stroke();

    // Secondary crisp specular droplet shine dot below crescent
    ctx.fillStyle = 'rgba(255, 255, 255, 0.90)';
    ctx.beginPath();
    ctx.ellipse(cx - R * 0.66, cy - R * 0.14, R * 0.048, R * 0.082, 0.28, 0, Math.PI * 2);
    ctx.fill();

    // Top-right delicate rim glint
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.72)';
    ctx.lineWidth = R * 0.028;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.91, Math.PI * 1.62, Math.PI * 1.88);
    ctx.stroke();

    ctx.restore();

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })();

  const waterSwirlTex = (() => {
    const size = 256;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, size, size);

    for (let i = 0; i < 7; i++) {
      const yBase = (i / 7) * size;
      const grad = ctx.createLinearGradient(0, yBase, size, yBase + 48);
      grad.addColorStop(0.0, 'rgba(56, 189, 248, 0.0)');
      grad.addColorStop(0.35, 'rgba(96, 165, 250, 0.34)');
      grad.addColorStop(0.55, 'rgba(224, 242, 254, 0.62)');
      grad.addColorStop(0.8, 'rgba(56, 189, 248, 0.25)');
      grad.addColorStop(1.0, 'rgba(56, 189, 248, 0.0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 6 + (i % 3) * 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(8, yBase + 14);
      ctx.bezierCurveTo(size * 0.33, yBase - 18, size * 0.66, yBase + 44, size - 8, yBase + 10);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })();

  const waterSphereShellGeo = new THREE.SphereGeometry(1.0, 28, 20);
  const waterBaseRingOuterGeo = (() => {
    const g = new THREE.RingGeometry(0.76, 0.94, 36);
    g.rotateX(-Math.PI / 2);
    return g;
  })();
  const waterBaseRingInnerGeo = (() => {
    const g = new THREE.RingGeometry(0.36, 0.54, 32);
    g.rotateX(-Math.PI / 2);
    return g;
  })();
  const waterSplashCrownGeo = (() => {
    // 10-point jagged liquid splash crown rising from the puddle
    const radialSegs = 20;
    const g = new THREE.CylinderGeometry(0.74, 0.34, 0.44, radialSegs, 1, true);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vy = pos.getY(i);
      if (vy > 0) {
        const vx = pos.getX(i);
        const vz = pos.getZ(i);
        const ang = Math.atan2(vz, vx);
        const wave = 0.58 + 0.42 * Math.max(0, Math.sin(ang * 7));
        pos.setY(i, 0.08 + 0.38 * wave);
        pos.setX(i, vx * (0.85 + 0.25 * wave));
        pos.setZ(i, vz * (0.85 + 0.25 * wave));
      } else {
        pos.setY(i, 0.02);
      }
    }
    g.computeVertexNormals();
    return g;
  })();
  const waterStemGeo = (() => {
    // Curved funnel-shaped twisting water stem connecting puddle to bottom of bubble
    const g = new THREE.CylinderGeometry(0.16, 0.46, 0.78, 16, 6, true);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vy = pos.getY(i) + 0.39; // 0 .. 0.78
      const f = vy / 0.78;
      const pinch = 1.0 - Math.sin(f * Math.PI) * 0.36;
      const twist = f * 1.15;
      const ox = pos.getX(i) * pinch;
      const oz = pos.getZ(i) * pinch;
      const sway = Math.sin(f * Math.PI) * 0.08;
      pos.setX(i, ox * Math.cos(twist) - oz * Math.sin(twist) + sway);
      pos.setY(i, vy);
      pos.setZ(i, ox * Math.sin(twist) + oz * Math.cos(twist));
    }
    g.computeVertexNormals();
    return g;
  })();
  const waterHelixRibbonGeo = (() => {
    // Tapered 3D liquid water tendril spiraling gracefully around the sphere surface
    const segs = 26;
    const radSegs = 6;
    const positions = [];
    const uvs = [];
    const indices = [];
    const pts = [];
    for (let s = 0; s <= segs; s++) {
      const f = s / segs;
      const theta = f * Math.PI * 1.55;
      const phi = -0.44 * Math.PI + f * Math.PI * 0.84;
      const rad = Math.cos(phi) * 1.045 + (1 - f) * 0.08;
      pts.push(new THREE.Vector3(Math.cos(theta) * rad, Math.sin(phi) * 1.02, Math.sin(theta) * rad));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const frames = curve.computeFrenetFrames(segs, false);
    for (let i = 0; i <= segs; i++) {
      const f = i / segs;
      const p = curve.getPointAt(f);
      const N = frames.normals[i];
      const B = frames.binormals[i];
      // Taper sharply at tip and base, thicker glossy belly in middle
      const rTube = 0.072 * Math.sin(Math.pow(f, 0.78) * Math.PI);
      for (let j = 0; j <= radSegs; j++) {
        const v = (j / radSegs) * Math.PI * 2;
        const cx = Math.cos(v) * rTube;
        const cy = Math.sin(v) * rTube * 0.52; // flattened ribbon cross-section
        positions.push(
          p.x + N.x * cx + B.x * cy,
          p.y + N.y * cx + B.y * cy,
          p.z + N.z * cx + B.z * cy
        );
        uvs.push(f, j / radSegs);
      }
    }
    const stride = radSegs + 1;
    for (let i = 0; i < segs; i++) {
      for (let j = 0; j < radSegs; j++) {
        const a = i * stride + j;
        const b = (i + 1) * stride + j;
        const c = (i + 1) * stride + (j + 1);
        const d = i * stride + (j + 1);
        indices.push(a, b, d, b, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  })();

  const activeWaterSpheres = [];
  const freeWaterSpheres = [];

  function spawnWaterPrisonSphere({ x = 0, z = 0, radius = 2.65, duration = 1.15 } = {}) {
    let ws = freeWaterSpheres.pop();
    if (!ws) {
      const rootGroup = new THREE.Group();
      const baseGroup = new THREE.Group();
      const bubbleGroup = new THREE.Group();

      const swirlShellMat = new THREE.MeshBasicMaterial({
        map: waterSwirlTex,
        color: 0x60a5fa,
        transparent: true,
        opacity: 0.48,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false
      });
      const bubbleSpriteMat = new THREE.SpriteMaterial({
        map: waterBubbleTex,
        color: 0xffffff,
        transparent: true,
        opacity: 0.96,
        depthWrite: false,
        toneMapped: false
      });
      const stemMat = new THREE.MeshBasicMaterial({
        map: waterSwirlTex,
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.68,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false
      });
      const ribbonMat = new THREE.MeshBasicMaterial({
        color: 0x7dd3fc,
        transparent: true,
        opacity: 0.86,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      });
      const specMat = new THREE.MeshBasicMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0.90,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      });
      const dropletSpriteMat = new THREE.SpriteMaterial({
        map: waterBubbleTex,
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        toneMapped: false
      });

      // 1. Concentric glowing ground ripple rings + 10-point splash crown + twisting water funnel stem
      const ringOut = new THREE.Mesh(waterBaseRingOuterGeo, ribbonMat);
      ringOut.position.y = 0.03;
      const ringIn = new THREE.Mesh(waterBaseRingInnerGeo, specMat);
      ringIn.position.y = 0.036;
      const crown = new THREE.Mesh(waterSplashCrownGeo, stemMat);
      const stem = new THREE.Mesh(waterStemGeo, stemMat);
      baseGroup.add(ringOut, ringIn, crown, stem);

      // 2. Camera-facing refractive Fresnel + Crescent-Highlight Bubble Sprite + 3D Caustic Swirl Sphere
      const bubbleSprite = new THREE.Sprite(bubbleSpriteMat);
      bubbleSprite.scale.set(2.24, 2.24, 1);
      bubbleSprite.renderOrder = 14;

      const swirlSphere = new THREE.Mesh(waterSphereShellGeo, swirlShellMat);
      swirlSphere.scale.setScalar(0.985);
      swirlSphere.renderOrder = 13;

      const ribbons = new THREE.Group();
      for (let r = 0; r < 3; r++) {
        const rib = new THREE.Mesh(waterHelixRibbonGeo, r === 0 ? specMat : ribbonMat);
        rib.rotation.y = (r / 3) * Math.PI * 2;
        rib.renderOrder = 15;
        ribbons.add(rib);
      }

      // 3. 12 orbiting glossy mini-bubbles (each with Fresnel rim & white specular dot!)
      const dropletsGroup = new THREE.Group();
      const droplets = [];
      for (let d = 0; d < 12; d++) {
        const dm = new THREE.Sprite(dropletSpriteMat);
        const ang = (d / 12) * Math.PI * 2;
        const yOff = ((d % 5) - 2) * 0.34;
        const distR = 1.18 + (d % 3) * 0.16;
        const dScale = 0.14 + (d % 4) * 0.065;
        dm.scale.set(dScale, dScale, 1);
        dm.position.set(Math.cos(ang) * distR, yOff, Math.sin(ang) * distR);
        dm.renderOrder = 16;
        dropletsGroup.add(dm);
        droplets.push({ mesh: dm, baseY: yOff, phase: d * 0.95 });
      }

      bubbleGroup.add(swirlSphere, bubbleSprite, ribbons, dropletsGroup);
      rootGroup.add(baseGroup, bubbleGroup);
      scene.add(rootGroup);

      ws = {
        group: rootGroup,
        baseGroup,
        bubbleGroup,
        swirlSphere,
        stem,
        crown,
        ribbons,
        dropletsGroup,
        droplets,
        swirlShellMat,
        bubbleSpriteMat,
        stemMat,
        ribbonMat,
        specMat,
        dropletSpriteMat,
        x: 0,
        z: 0,
        radius: 2.65,
        age: 0,
        duration: 1.15
      };
    }
    ws.x = x;
    ws.z = z;
    ws.radius = radius;
    ws.age = 0;
    ws.duration = duration;
    ws.group.position.set(x, 0, z);
    ws.bubbleGroup.position.set(0, 0.45, 0);
    ws.bubbleGroup.scale.setScalar(0.15);
    ws.group.visible = true;
    activeWaterSpheres.push(ws);
  }

  // 🩸⚔️ Visceral Critical Strike Blood Splatter & Crossed Execution Flash (ZERO flat red rings!)
  const bloodSplatterTex = (() => {
    const size = 192;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    const cx = size * 0.5;
    const cy = size * 0.5;

    // Irregular dark-crimson splatter pool + directional droplets on cobblestones
    ctx.fillStyle = 'rgba(136, 14, 24, 0.86)';
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2 + (i % 3) * 0.25;
      const d = (i % 4) * 11;
      const rx = 24 - (i % 3) * 5;
      const ry = 17 + (i % 2) * 7;
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rx, ry, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(220, 38, 38, 0.72)';
    for (let i = 0; i < 14; i++) {
      const a = i * 1.68;
      const d = 30 + (i % 5) * 11;
      const r = 3.5 + (i % 4) * 2.4;
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * 1.45, r * 0.85, a, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })();

  const critDecalGeo = (() => {
    const g = new THREE.PlaneGeometry(1.55, 1.55);
    g.rotateX(-Math.PI / 2);
    return g;
  })();
  const critCrossSlashGeo = new THREE.BoxGeometry(0.065, 0.065, 1.45);
  const activeCritBursts = [];
  const freeCritBursts = [];

  function spawnCritBloodBurst({ x = 0, z = 0, dirX = 0, dirZ = 1 } = {}) {
    // 1. Directional arterial crimson & dark-blood droplet spray!
    const sprayX = x + dirX * 0.22;
    const sprayZ = z + dirZ * 0.22;
    spawnParticles({
      x: sprayX,
      y: 0.86,
      z: sprayZ,
      color: 0xdc2626,
      count: 16,
      speed: 7.8,
      size: 0.17,
      life: 0.44,
      gravity: 16.5
    });
    spawnParticles({
      x: sprayX,
      y: 0.92,
      z: sprayZ,
      color: 0x7f1d1d,
      count: 11,
      speed: 6.2,
      size: 0.20,
      life: 0.50,
      gravity: 17.5
    });
    spawnParticles({
      x,
      y: 0.95,
      z,
      color: 0xfef08a,
      count: 6,
      speed: 6.5,
      size: 0.13,
      life: 0.28,
      gravity: 6.0
    });

    // 2. Pooled crossed crimson-gold X-execution flash at chest + cobblestone blood splatter stain!
    let cb = freeCritBursts.pop();
    if (!cb) {
      const group = new THREE.Group();
      const decalMat = new THREE.MeshBasicMaterial({
        map: bloodSplatterTex,
        transparent: true,
        opacity: 0.82,
        depthWrite: false
      });
      const slashMat = new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.96,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      });
      const crimsonMat = new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      });

      const decal = new THREE.Mesh(critDecalGeo, decalMat);
      decal.position.y = 0.024;

      const crossWrap = new THREE.Group();
      crossWrap.position.y = 0.88;
      const barA = new THREE.Mesh(critCrossSlashGeo, slashMat);
      barA.rotation.z = Math.PI * 0.25;
      barA.rotation.x = Math.PI * 0.22;
      const barB = new THREE.Mesh(critCrossSlashGeo, crimsonMat);
      barB.scale.set(1.5, 1.5, 1.15);
      barB.rotation.z = -Math.PI * 0.25;
      barB.rotation.x = -Math.PI * 0.22;
      crossWrap.add(barA, barB);

      group.add(decal, crossWrap);
      scene.add(group);
      cb = { group, decal, crossWrap, decalMat, slashMat, crimsonMat, age: 0, duration: 1.15 };
    }
    cb.age = 0;
    cb.duration = 1.15;
    cb.group.position.set(x, 0, z);
    cb.decal.rotation.y = Math.atan2(dirX, dirZ) + (Math.random() - 0.5) * 0.8;
    const dScale = 0.85 + Math.random() * 0.35;
    cb.decal.scale.setScalar(dScale);
    cb.crossWrap.visible = true;
    cb.crossWrap.scale.setScalar(0.55);
    cb.crossWrap.rotation.y = Math.atan2(dirX, dirZ);
    cb.decalMat.opacity = 0.82;
    cb.slashMat.opacity = 0.96;
    cb.crimsonMat.opacity = 0.92;
    cb.group.visible = true;
    activeCritBursts.push(cb);
  }

  // 🔥🌪️⚡💧 Pooled 3D Elemental Impacts (Tornado Vortex, Burning Magma Patch, Vertical Sky-Bolt) & Falling Meteors!
  const tornadoRingGeo = (() => {
    const g = new THREE.TorusGeometry(1.0, 0.06, 6, 20);
    g.rotateX(Math.PI / 2);
    return g;
  })();
  const firePatchGeo = (() => {
    const g = new THREE.CircleGeometry(1.0, 22);
    g.rotateX(-Math.PI / 2);
    return g;
  })();
  const skyBoltGeo = (() => {
    const g = new THREE.CylinderGeometry(0.06, 0.14, 6.2, 6);
    g.translate(0, 3.1, 0);
    return g;
  })();
  const meteorRockGeo = new THREE.DodecahedronGeometry(0.55, 0);

  const activeElemVfx = [];

  function spawnElementalImpact({ element = 'fire', x = 0, z = 0, radius = 2.4 } = {}) {
    if (activeElemVfx.length > 26) return;
    if (element === 'air') {
      // Rising 4-ring 3D Cyclone Tornado!
      const group = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({
        color: 0x99f6e4,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      });
      const rings = [];
      for (let r = 0; r < 4; r++) {
        const rm = new THREE.Mesh(tornadoRingGeo, mat);
        rm.position.y = 0.22 + r * 0.42;
        const s = 0.45 + r * 0.26;
        rm.scale.set(s, 1, s);
        rm.rotation.z = (r % 2 === 0 ? 1 : -1) * 0.14;
        group.add(rm);
        rings.push(rm);
      }
      group.position.set(x, 0, z);
      scene.add(group);
      activeElemVfx.push({ kind: 'tornado', group, mat, rings, radius: Math.max(1.4, radius * 0.65), age: 0, duration: 0.56 });
      spawnBloomFlash({ x, y: 0.9, z, color: 0x5eead4, size: Math.max(3.2, radius * 1.5), duration: 0.36, opacity: 0.56 });
      spawnParticles({ x, y: 0.5, z, color: 0x5eead4, count: 14, speed: 6.5, size: 0.15, life: 0.42, gravity: -2.8 });
    } else if (element === 'lightning') {
      // Blinding vertical jagged sky-bolt + electric burst!
      const group = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({
        color: 0x7dd3fc,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      });
      const bolt = new THREE.Mesh(skyBoltGeo, mat);
      bolt.rotation.z = (Math.random() - 0.5) * 0.18;
      bolt.rotation.x = (Math.random() - 0.5) * 0.18;
      group.add(bolt);
      group.position.set(x, 0.05, z);
      scene.add(group);
      activeElemVfx.push({ kind: 'skybolt', group, mat, age: 0, duration: 0.18 });
      spawnShockwaveRing({ x, y: 0.08, z, radius: Math.max(1.8, radius * 0.78), color: 0x38bdf8, duration: 0.24, withBloom: false });
      spawnBloomFlash({ x, y: 1.2, z, color: 0x7dd3fc, size: Math.max(4.4, radius * 1.9), duration: 0.28, opacity: 0.82 });
      spawnParticles({ x, y: 0.75, z, color: 0xfef08a, count: 14, speed: 7.4, size: 0.14, life: 0.30, gravity: 4 });
    } else if (element === 'water') {
      // 3D Crown Splash of Arcing Water Droplets & Bright Cyan-White Foam (Matching Water_mage_shooting_projectile!)
      spawnShockwaveRing({ x, y: 0.06, z, radius: Math.min(1.65, radius * 0.72), color: 0x38bdf8, duration: 0.28, withBloom: false });
      spawnBloomFlash({ x, y: 0.82, z, color: 0x38bdf8, size: Math.max(3.2, radius * 1.45), duration: 0.30, opacity: 0.62 });
      spawnParticles({ x, y: 0.55, z, color: 0x38bdf8, count: 16, speed: 7.4, size: 0.17, life: 0.42, gravity: 14.5 });
      spawnParticles({ x, y: 0.68, z, color: 0xe0faff, count: 10, speed: 5.8, size: 0.13, life: 0.36, gravity: 12.0 });
    } else {
      // 🔥 Fire: Blazing ground magma scorch patch + roaring flame burst!
      const group = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({
        map: softGlowTex,
        color: 0xff5722,
        transparent: true,
        opacity: 0.82,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      });
      const patch = new THREE.Mesh(firePatchGeo, mat);
      patch.scale.setScalar(radius * 0.92);
      group.add(patch);
      group.position.set(x, 0.04, z);
      scene.add(group);
      activeElemVfx.push({ kind: 'firepatch', group, mat, x, z, emitTick: 0, age: 0, duration: 1.05 });
      spawnShockwaveRing({ x, y: 0.08, z, radius, color: 0xff6b00, duration: 0.30, withBloom: false });
      spawnBloomFlash({ x, y: 0.95, z, color: 0xff6b1a, size: Math.max(4.0, radius * 1.75), duration: 0.36, opacity: 0.78 });
      spawnParticles({ x, y: 0.65, z, color: 0xfef08a, count: 14, speed: 6.2, size: 0.18, life: 0.40, gravity: -3.2 });
    }
  }

  function spawnMeteorStrike({ x = 0, z = 0, radius = 3.8, color = 0xff5722, duration = 0.34 } = {}) {
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xfef08a, toneMapped: false });
    const auraMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    });
    const core = new THREE.Mesh(meteorRockGeo, mat);
    const aura = new THREE.Mesh(meteorRockGeo, auraMat);
    aura.scale.setScalar(1.55);
    group.add(core, aura);
    const startX = x - 3.2;
    const startY = 9.5;
    const startZ = z - 2.4;
    group.position.set(startX, startY, startZ);
    scene.add(group);
    spawnDangerZone({ x, z, radius, duration, color });
    activeElemVfx.push({
      kind: 'meteor',
      group,
      mat: auraMat,
      coreMat: mat,
      startX,
      startY,
      startZ,
      endX: x,
      endZ: z,
      color,
      radius,
      age: 0,
      duration
    });
  }

  // 3) Enemy Cultist Jagged Shadow Spear (Needle diamond + dark tail)
  const enemySpearGeo = (() => {
    const g = new THREE.OctahedronGeometry(0.13, 0);
    g.scale(0.75, 0.75, 2.6);
    return g;
  })();
  const enemyTailGeo = (() => {
    const g = new THREE.ConeGeometry(0.12, 1.15, 6, 1, true);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -0.58);
    return g;
  })();

  // Shared GLSL Glossy Water Orb & Undulating Tapered Liquid Ribbon Wake (Matches bcf5a263.mp4 1-to-1!)
  const waterProjUniforms = { uTime: { value: 0 } };
  const waterProjSphereGeo = new THREE.SphereGeometry(0.32, 26, 22);
  const waterProjShaderMat = new THREE.ShaderMaterial({
    uniforms: waterProjUniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      uniform float uTime;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      void main() {
        vec3 n = normalize(normal);
        float w = sin(n.x * 5.0 + uTime * 11.0) * cos(n.z * 5.0 - uTime * 9.0) * 0.016;
        vec4 mvPos = modelViewMatrix * vec4(position + n * w, 1.0);
        vNormalV = normalize(normalMatrix * n);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      void main() {
        vec3 N = normalize(vNormalV);
        vec3 V = normalize(vViewDir);
        float ndv = clamp(dot(N, V), 0.0, 1.0);
        float fresnel = pow(1.0 - ndv, 2.05);

        // Rotating glossy curved internal water crescents matching bcf5a263.mp4!
        vec2 d = N.xy;
        float r = length(d);
        float a = atan(d.y, d.x);
        float cresA = smoothstep(0.45, 0.92, sin(a * 1.0 - r * 4.5 + uTime * 8.5)) * smoothstep(0.18, 0.72, r) * smoothstep(0.98, 0.62, r);
        float cresB = smoothstep(0.55, 0.95, cos(a * 2.0 + r * 5.2 - uTime * 10.5)) * smoothstep(0.12, 0.58, r);
        float specTop = pow(max(dot(N, normalize(vec3(-0.35, 0.68, 0.64))), 0.0), 20.0);

        vec3 deep = vec3(0.02, 0.44, 0.84);
        vec3 mid = vec3(0.10, 0.78, 0.98);
        vec3 foam = vec3(0.88, 0.99, 1.0);
        vec3 col = mix(deep, mid, 0.35 + 0.65 * (1.0 - r * 0.55));
        float highlight = clamp(fresnel * 0.82 + cresA * 0.75 + cresB * 0.42 + specTop * 0.85, 0.0, 1.0);
        col = mix(col, foam, highlight);
        gl_FragColor = vec4(col, clamp(0.76 + fresnel * 0.22 + highlight * 0.16, 0.0, 0.98));
      }
    `
  });

  // Smooth tapered 3D liquid comet wake extending behind the water sphere (-Z)
  const waterWakeGeo = (() => {
    const g = new THREE.CylinderGeometry(0.015, 0.24, 1.65, 14, 18, true);
    g.rotateX(Math.PI * 0.5);
    g.translate(0, 0, -0.86);
    return g;
  })();
  const waterWakeMat = new THREE.ShaderMaterial({
    uniforms: waterProjUniforms,
    transparent: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        float tailFrac = clamp(-p.z / 1.68, 0.0, 1.0);
        p.x += sin(tailFrac * 8.5 - uTime * 18.0) * 0.085 * tailFrac;
        p.y += cos(tailFrac * 7.0 - uTime * 15.0) * 0.045 * tailFrac;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        // vUv.y = 1 near sphere, 0 at far tail tip
        float headFade = smoothstep(1.0, 0.84, vUv.y);
        float tailFade = pow(clamp(vUv.y, 0.0, 1.0), 1.65);
        float streamA = 0.5 + 0.5 * sin(vUv.y * 16.0 + uTime * 18.0 + vUv.x * 6.2831);
        float streamB = 0.5 + 0.5 * cos(vUv.y * 24.0 + uTime * 23.0 - vUv.x * 12.566);
        float streak = clamp(streamA * 0.65 + streamB * 0.35, 0.0, 1.0);
        vec3 col = mix(vec3(0.04, 0.64, 0.96), vec3(0.84, 0.99, 1.0), pow(streak, 2.0) * 0.75);
        float alpha = headFade * tailFade * (0.26 + 0.52 * streak);
        gl_FragColor = vec4(col, alpha);
      }
    `
  });

  // Coaxial hydro-ring around the front launch zone (matching 00:03 of bcf5a263.mp4!)
  const waterCollarRingGeo = new THREE.TorusGeometry(0.35, 0.022, 8, 28);
  const waterCollarRingMat = new THREE.MeshBasicMaterial({
    color: 0xbae6fd,
    transparent: true,
    opacity: 0.58,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });

  const projWhiteCoreMat = new THREE.MeshBasicMaterial({ color: 0xfffbeb, toneMapped: false });
  const projDarkCoreMat = new THREE.MeshBasicMaterial({ color: 0x3b0764, toneMapped: false });

  const projMatCache = new Map();
  function getProjMatBundle(keyTag, color, isBuckshot, isBullet) {
    const cacheKey = `${keyTag}_${color}_${isBuckshot ? 1 : 0}_${isBullet ? 1 : 0}`;
    let matSet = projMatCache.get(cacheKey);
    if (!matSet) {
      const fallbackBulletHue = (isBullet || isBuckshot) && color === 0xe2e8f0 ? 0xfbbf24 : color;
      const baseHue = new THREE.Color(fallbackBulletHue);
      if (isBuckshot && keyTag !== 'gatling') {
        baseHue.lerp(new THREE.Color(0xf59e0b), 0.25);
      }
      const richColor = baseHue.clone().offsetHSL(0, 0.2, -0.08);
      const brightCoreColor = baseHue.clone().lerp(new THREE.Color(0xffffff), isBuckshot ? 0.52 : 0.42);
      matSet = {
        richHex: richColor.getHex(),
        solidCoreMat: new THREE.MeshBasicMaterial({
          color: brightCoreColor,
          toneMapped: false
        }),
        glowMat: new THREE.MeshBasicMaterial({
          color: richColor,
          transparent: true,
          opacity: isBuckshot ? 0.78 : isBullet ? 0.82 : 0.66,
          depthWrite: false,
          side: THREE.DoubleSide,
          toneMapped: false
        }),
        haloSpriteMat: new THREE.SpriteMaterial({
          map: softGlowTex,
          color: richColor,
          transparent: true,
          opacity: isBuckshot ? 0.44 : 0.55,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false
        })
      };
      projMatCache.set(cacheKey, matSet);
    }
    return matSet;
  }

  function createProjectileVisual(type = 'ranged', color = 0xfbbf24, radius = 0.16) {
    const mesh = new THREE.Group();
    // Guard against legacy callers passing ~1.0 scale instead of ~0.16 radius
    const rawR = Number(radius) || 0.16;
    const scaleMult = rawR > 0.45 ? rawR * 0.85 : Math.max(0.75, rawR / 0.16);

    const isBuckshot =
      type === 'buckshot' ||
      type === 'pellet' ||
      type === 'pistol' ||
      type === 'blunderbuss' ||
      type === 'gatling';

    const isBullet =
      !isBuckshot &&
      (type === 'ranged' ||
        type === 'bullet' ||
        type === 'bolt' ||
        type === 'usp_pistol' ||
        type === 'colt' ||
        type === 'smg' ||
        type === 'ak47');

    const isEnemyProj = type === 'enemy' || type === 'enemy_bolt';

    const matSet = getProjMatBundle(type, color, isBuckshot, isBullet);
    const { richHex, solidCoreMat, glowMat, haloSpriteMat } = matSet;
    const haloSprite = new THREE.Sprite(haloSpriteMat);

    let spinCore = null;
    let orbitRingA = null;
    let orbitRingB = null;

    if (isBuckshot) {
      const pelletCore = new THREE.Mesh(buckshotCoreGeo, solidCoreMat);
      const leadSpark = new THREE.Mesh(buckshotSparkGeo, projWhiteCoreMat);
      leadSpark.position.z = 0.05;
      const wake = new THREE.Mesh(buckshotWakeGeo, glowMat);
      haloSprite.scale.set(0.38, 0.38, 1);
      mesh.add(pelletCore, leadSpark, wake, haloSprite);
      mesh.scale.setScalar(scaleMult * 0.78);
    } else if (isBullet) {
      // Real metallic copper-jacketed bullet + brass cartridge + razor-thin warm ballistic tracer (NO plasma orb!)
      const copperNose = new THREE.Mesh(bulletCoreGeo, bulletCopperMat);
      const brassBody = new THREE.Mesh(bulletBrassCaseGeo, bulletBrassMat);
      const tail = new THREE.Mesh(bulletTailGeo, bulletTracerMat);
      haloSprite.scale.set(0.14, 0.14, 1);
      mesh.add(copperNose, brassBody, tail);
      mesh.scale.setScalar(scaleMult * (type === 'colt' ? 1.18 : 1.0));
    } else if (isEnemyProj) {
      const spear = new THREE.Mesh(enemySpearGeo, solidCoreMat);
      const outerSpear = new THREE.Mesh(enemySpearGeo, glowMat);
      outerSpear.scale.setScalar(1.35);
      const tail = new THREE.Mesh(enemyTailGeo, glowMat);
      haloSprite.scale.set(0.68, 0.68, 1);
      spinCore = spear;
      mesh.add(spear, outerSpear, tail, haloSprite);
      mesh.scale.setScalar(scaleMult);
    } else if (type === 'magic_fire') {
      // 🔥 LIVING ROARING FIREBALL: Incandescent heart + 3 swirling jagged flame tongues + fiery wake!
      const fireOuterMat = getProjMatBundle('mfire_out', 0xff3d00, false, false).glowMat;
      const fireMidMat = getProjMatBundle('mfire_mid', 0xff9100, false, false).solidCoreMat;
      const heart = new THREE.Mesh(fireHeartGeo, projWhiteCoreMat);
      const midShell = new THREE.Mesh(fireHeartGeo, fireMidMat);
      midShell.scale.set(1.26, 1.26, 1.55);

      const flameWhirl = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const tongue = new THREE.Mesh(fireTongueGeo, i === 0 ? fireMidMat : fireOuterMat);
        const ang = (i / 3) * Math.PI * 2;
        tongue.position.set(Math.cos(ang) * 0.08, Math.sin(ang) * 0.08, 0.08);
        tongue.rotation.z = ang;
        tongue.scale.set(1.15, 1.15, 1.05 + i * 0.22);
        flameWhirl.add(tongue);
      }
      const wake = new THREE.Mesh(spellTailGeo, fireOuterMat);
      wake.scale.set(1.15, 1.15, 1.12);
      haloSprite.material = getProjMatBundle('mfire_out', 0xff5722, false, false).haloSpriteMat;
      haloSprite.scale.set(1.15, 1.15, 1);
      orbitRingA = flameWhirl;
      spinCore = midShell;
      mesh.add(heart, midShell, flameWhirl, wake, haloSprite);
      mesh.scale.setScalar(scaleMult * 1.08);
    } else if (type === 'magic_water') {
      // 💧 GLOSSY WATER BUBBLE + UNDULATING LIQUID WAKE RIBBON (Matches bcf5a263.mp4 1-to-1!):
      const liquidOrb = new THREE.Mesh(waterProjSphereGeo, waterProjShaderMat);
      const liquidWake = new THREE.Mesh(waterWakeGeo, waterWakeMat);
      const collarRing = new THREE.Mesh(waterCollarRingGeo, waterCollarRingMat);
      collarRing.position.z = -0.18;

      haloSprite.material = getProjMatBundle('mwat_deep', 0x38bdf8, false, false).haloSpriteMat;
      haloSprite.scale.set(1.18, 1.18, 1);
      orbitRingA = collarRing;
      spinCore = liquidOrb;
      mesh.add(liquidOrb, liquidWake, collarRing, haloSprite);
      // Scale water orb down 4x per user feedback while keeping shader/wake look intact
      mesh.scale.setScalar(scaleMult * 0.295);
    } else if (type === 'magic_lightning') {
      // ⚡ CRACKLING BALL LIGHTNING & ZIG-ZAG SPEAR: Plasma core + 3 criss-crossing electric bolts!
      const elecCyanMat = getProjMatBundle('mlight_cy', 0x38bdf8, false, false).glowMat;
      const elecGoldMat = getProjMatBundle('mlight_gd', 0xfef08a, false, false).solidCoreMat;
      const plasmaCore = new THREE.Mesh(spellCrystalGeo, projWhiteCoreMat);
      plasmaCore.scale.set(0.68, 0.68, 1.35);

      const arcsCluster = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const bolt = new THREE.Mesh(lightningZigGeo, i === 0 ? elecGoldMat : elecCyanMat);
        bolt.rotation.z = (i / 3) * Math.PI;
        bolt.rotation.x = (i - 1) * 0.28;
        bolt.rotation.y = (1 - i) * 0.24;
        arcsCluster.add(bolt);
      }
      orbitRingA = arcsCluster;
      spinCore = plasmaCore;
      haloSprite.material = getProjMatBundle('mlight_cy', 0x38bdf8, false, false).haloSpriteMat;
      haloSprite.scale.set(1.12, 1.12, 1);
      mesh.add(plasmaCore, arcsCluster, haloSprite);
      mesh.scale.setScalar(scaleMult * 1.1);
    } else if (type === 'magic_air') {
      // 🌪️ RAZOR WIND CUTTER & CYCLONE VORTEX: Swept crescent wind-blade + 3 stacked spinning tornado rings!
      const windMintMat = getProjMatBundle('mair_mint', 0x5eead4, false, false).glowMat;
      const windWhiteMat = getProjMatBundle('mair_wht', 0xf8fafc, false, false).solidCoreMat;
      const cutter = new THREE.Mesh(airCutterGeo, windWhiteMat);
      cutter.scale.set(0.46, 1.0, 0.46);

      const cyclone = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(spellOrbitRingGeo, i === 1 ? windWhiteMat : windMintMat);
        ring.rotation.x = Math.PI * 0.5;
        const rScale = 0.62 + i * 0.34;
        ring.scale.set(rScale, rScale, 1);
        ring.position.y = (i - 1) * 0.11;
        ring.position.z = -i * 0.14;
        cyclone.add(ring);
      }
      const slipstream = new THREE.Mesh(spellTailGeo, windMintMat);
      slipstream.scale.set(0.85, 0.85, 0.85);
      orbitRingB = cyclone;
      spinCore = cutter;
      haloSprite.material = getProjMatBundle('mair_mint', 0x5eead4, false, false).haloSpriteMat;
      haloSprite.scale.set(1.0, 1.0, 1);
      mesh.add(cutter, cyclone, slipstream, haloSprite);
      mesh.scale.setScalar(scaleMult * 1.08);
    } else {
      // Fallback Mage Spell Comet
      const isVoid = type === 'void_orb';
      const core = new THREE.Mesh(spellCrystalGeo, isVoid ? projDarkCoreMat : solidCoreMat);
      const innerSpark = new THREE.Mesh(spellCrystalGeo, projWhiteCoreMat);
      innerSpark.scale.setScalar(0.52);
      const tail = new THREE.Mesh(spellTailGeo, glowMat);
      orbitRingA = new THREE.Mesh(spellOrbitRingGeo, solidCoreMat);
      orbitRingB = new THREE.Mesh(spellOrbitRingGeo, glowMat);
      orbitRingB.rotation.x = Math.PI * 0.5;
      haloSprite.scale.set(0.95, 0.95, 1);
      spinCore = core;
      mesh.add(core, innerSpark, tail, orbitRingA, orbitRingB, haloSprite);
      mesh.scale.setScalar(scaleMult);
    }

    scene.add(mesh);

    let disposed = false;
    const handle = {
      mesh,
      visualKind: type,
      spinCore,
      orbitRingA,
      orbitRingB,
      prevX: null,
      prevZ: null,
      trailAccum: 0,
      isMagic: !isBullet && !isBuckshot && !isEnemyProj,
      color: richHex,
      dispose() {
        if (disposed) return;
        disposed = true;
        if (mesh.parent) mesh.parent.remove(mesh);
        activeProjectiles.delete(handle);
      }
    };
    activeProjectiles.add(handle);
    return handle;
  }

  // ==========================================================================
  // Camera Mode ('hub' Showcase vs 'combat' Isometric), Follow, Shake & Aim
  // ==========================================================================
  let cameraMode = 'combat';
  let hubStageFocus = 'center'; // 'center' (Главная) | 'heroes' (Герои)
  let currentHubShiftX = 0;
  let targetX = 0;
  let targetY = 0;
  let targetZ = 0;
  let lastHeroX = 0;
  let lastHeroZ = 0;
  let lastDirSnapX = NaN;
  let lastDirSnapZ = NaN;
  let lastDirSnapSouls = null;

  // Cinematic 7.2s 4-Act Boss Door Opening Cutscene (Abandoned Knight Rift [E])
  let bossDoorCutsceneActive = false;
  let bossDoorCutsceneElapsed = 0;
  let bossDoorCutsceneDuration = BOSS_DOOR_CUTSCENE_DURATION;
  let bossDoorCutsceneStartFov = 52;
  let bossDoorCutsceneNormalFov = 52;
  const _cutsceneStartPos = new THREE.Vector3();
  const _cutsceneStartLook = new THREE.Vector3();
  const _cutsceneNormalPos = new THREE.Vector3();
  const _cutsceneNormalLook = new THREE.Vector3();
  const _cutsceneStateOut = {
    camPos: { x: 0, y: 0, z: 0 },
    camLook: { x: 0, y: 0, z: 0 }
  };
  const _cutsceneShakeOut = { x: 0, y: 0, z: 0, roll: 0 };
  let _cutsceneState = null;

  function startBossDoorCutscene(durationSec = BOSS_DOOR_CUTSCENE_DURATION) {
    if (cameraMode === 'hub' || !isSoulsBiome(currentBiome)) return null;
    _cutsceneStartPos.copy(camera.position);
    const groundY = getGroundHeight(targetX, targetZ);
    _cutsceneStartLook.set(
      targetX + lockLookOffsetX,
      groundY + 1.05 + lockLookOffsetY,
      targetZ + lockLookOffsetZ
    );
    bossDoorCutsceneStartFov = camera.fov || 52;
    bossDoorCutsceneNormalFov = getCombatFovForBiome(camera.aspect || 1);
    bossDoorCutsceneElapsed = 0;
    bossDoorCutsceneDuration = Math.max(0.8, Number(durationSec) || BOSS_DOOR_CUTSCENE_DURATION);
    bossDoorCutsceneActive = true;
    lockOnTarget = null;
    lockOnReticle.visible = false;
    lockOnFootRing.visible = false;
    _cutsceneState = evaluateBossDoorCutscene(
      0,
      _cutsceneStartPos,
      _cutsceneStartLook,
      _cutsceneStartPos,
      _cutsceneStartLook,
      {
        startFov: bossDoorCutsceneStartFov,
        normalFov: bossDoorCutsceneNormalFov,
        out: _cutsceneStateOut
      }
    );
    _cutsceneState.active = true;
    _cutsceneState.elapsed = 0;
    _cutsceneState.duration = bossDoorCutsceneDuration;
    return _cutsceneState;
  }

  function isBossDoorCutsceneActive() {
    return Boolean(bossDoorCutsceneActive && cameraMode !== 'hub' && isSoulsBiome(currentBiome));
  }

  function getBossDoorCutsceneState() {
    if (!isBossDoorCutsceneActive()) return null;
    return _cutsceneState;
  }

  // Pre-allocated spring-arm collision output (0 GC allocations per frame)
  const _castleCamClampOut = { x: 0, y: 0, z: 0, hitWall: false, fraction: 1 };
  const _castleCamClampOpts = { out: _castleCamClampOut };

  function skipBossDoorCutscene(force = false, overrideHeroPos = null) {
    if (!isBossDoorCutsceneActive()) return null;
    const scaledElapsed = bossDoorCutsceneDuration > 0
      ? (bossDoorCutsceneElapsed / bossDoorCutsceneDuration) * BOSS_DOOR_CUTSCENE_DURATION
      : BOSS_DOOR_CUTSCENE_DURATION;
    if (!force && scaledElapsed < 1.5 && !_cutsceneState?.canSkip) {
      return null;
    }
    const normalFov = getCombatFovForBiome(camera.aspect || 1);

    // Optional explicit final hero position (default Boss Hall entry z = BOSS_HERO_ENTRY_Z):
    // camera jumps straight inside the Throne Hall behind the hero (not to the old pre-door point)
    const effectiveOverride = overrideHeroPos === true
      ? { x: 0, z: SOULS_CASTLE_CONSTANTS.BOSS_HERO_ENTRY_Z }
      : overrideHeroPos;
    const hasOverride = Boolean(effectiveOverride && Number.isFinite(Number(effectiveOverride.z)));
    if (hasOverride) {
      const hx = Number.isFinite(Number(effectiveOverride.x)) ? Number(effectiveOverride.x) : 0;
      const hz = Number(effectiveOverride.z);
      targetX = hx;
      targetZ = hz;
      lastHeroX = hx;
      lastHeroZ = hz;
      const hgY = getGroundHeight(hx, hz);
      targetY = hgY;
      const hPivotY = hgY + SOULS_CAMERA_PIVOT_Y;
      const cosP = Math.cos(orbitPitch);
      const reqDist = Math.max(2.8, orbitDist);
      let cX = hx + Math.sin(orbitYaw) * cosP * reqDist;
      let cY = Math.max(hgY + 0.52, hPivotY + Math.sin(orbitPitch) * reqDist);
      let cZ = hz + Math.cos(orbitYaw) * cosP * reqDist;
      const clamped = clampCastleCameraPosition(hx, hPivotY, hz, cX, cY, cZ, 'sealed', _castleCamClampOpts);
      cX = clamped.x;
      cY = clamped.y;
      cZ = clamped.z;
      _cutsceneNormalPos.set(cX, cY, cZ);
      _cutsceneNormalLook.set(hx + lockLookOffsetX, hPivotY + lockLookOffsetY, hz + lockLookOffsetZ);
      soulsCamClipDist = Math.max(3.2, Math.hypot(cX - hx, cZ - hz) / Math.max(0.2, cosP));
      hasFollowedOnce = false;
    }

    _cutsceneState = getBossDoorCutsceneSkipState(_cutsceneNormalPos, _cutsceneNormalLook, {
      normalFov,
      out: _cutsceneStateOut
    });
    _cutsceneState.active = false;
    _cutsceneState.elapsed = bossDoorCutsceneDuration;
    _cutsceneState.duration = bossDoorCutsceneDuration;
    bossDoorCutsceneActive = false;
    bossDoorCutsceneElapsed = 0;
    if (Math.abs(camera.fov - normalFov) > 0.01) {
      camera.fov = normalFov;
      camera.updateProjectionMatrix();
    }
    camera.position.copy(_cutsceneNormalPos);
    camera.lookAt(_cutsceneNormalLook);
    camera.updateMatrixWorld();
    return _cutsceneState;
  }

  // Cinematic 5-Act Boss Escape Cutscene («Escape from the Castle of Ash» -> Exterior Shore)
  let bossEscapeCutsceneActive = false;
  let bossEscapeCutsceneElapsed = 0;
  let bossEscapeCutsceneRig = null;
  let bossEscapeLastStageMode = 'castle';
  let bossEscapeChasmEnabled = false;
  let bossEscapeGrateBroken = false;
  let bossEscapeLastCameraCutId = -1;
  const _escapeCutsceneStateOut = createBossEscapeCutsceneState();
  const _escapeCutsceneShakeOut = { x: 0, y: 0, z: 0, roll: 0 };
  const _escapeShoreNormPos = new THREE.Vector3(0, 3.15, 8.2);
  const _escapeShoreNormLook = new THREE.Vector3(0, 1.65, 2.5);
  const _escapeCutsceneOpts = {
    normalCamPos: _escapeShoreNormPos,
    normalCamLook: _escapeShoreNormLook,
    normalFov: 56
  };
  let _escapeCutsceneState = null;

  const SHORE_WAKE_ORBIT_PITCH = 0.245;
  const SHORE_WAKE_ORBIT_DIST = 5.88;

  function computeShoreNormalCamPose(yaw = 0, outPos = _escapeShoreNormPos, outLook = _escapeShoreNormLook, pitchOverride = null, distOverride = null) {
    const anchors = soulsExteriorShore?.getAnchors?.() || EXTERIOR_SHORE_ANCHORS;
    const wake = anchors.wakePos || { x: 0, y: 0, z: 2.5 };
    const wx = Number.isFinite(wake.x) ? wake.x : 0;
    const wz = Number.isFinite(wake.z) ? wake.z : 2.5;
    const hgY = soulsExteriorShore?.getGroundY ? soulsExteriorShore.getGroundY(wx, wz) : (Number.isFinite(wake.y) ? wake.y : 0);
    const safeYaw = Number.isFinite(Number(yaw)) ? Number(yaw) : 0;
    const safePitch = (pitchOverride !== null && pitchOverride !== undefined && Number.isFinite(Number(pitchOverride)))
      ? Number(pitchOverride)
      : SHORE_WAKE_ORBIT_PITCH;
    const safeDist = Math.max(
      2.8,
      (distOverride !== null && distOverride !== undefined && Number.isFinite(Number(distOverride)))
        ? Number(distOverride)
        : SHORE_WAKE_ORBIT_DIST
    );
    const hPivotY = hgY + SOULS_CAMERA_PIVOT_Y;
    const cosP = Math.cos(safePitch);
    const cX = wx + Math.sin(safeYaw) * cosP * safeDist;
    const cY = Math.max(hgY + 0.52, hPivotY + Math.sin(safePitch) * safeDist);
    const cZ = wz + Math.cos(safeYaw) * cosP * safeDist;
    outPos.set(cX, cY, cZ);
    outLook.set(wx, hPivotY, wz);
    return { wx, hgY, wz, hPivotY, safeYaw, safePitch, safeDist };
  }

  function applyEscapeCutsceneCamera(st, shakeOut = null, normalFov = 56) {
    if (!st) return;
    const cutId = Number.isFinite(Number(st.cameraCutId)) ? Number(st.cameraCutId) : -1;
    if (cutId >= 0 && cutId !== bossEscapeLastCameraCutId) {
      // Hard montage cut: reset camera smoothing / transient world shake immediately!
      bossEscapeLastCameraCutId = cutId;
      shakeIntensity = Math.min(shakeIntensity, Number(st.screenShake) || 0);
    }
    const targetCutFov = Number(st.camFov) || normalFov;
    if (Math.abs(camera.fov - targetCutFov) > 0.01) {
      camera.fov = targetCutFov;
      camera.updateProjectionMatrix();
    }
    const shX = Number(shakeOut?.x) || 0;
    const shY = Number(shakeOut?.y) || 0;
    const shZ = Number(shakeOut?.z) || 0;
    camera.up.set(0, 1, 0);
    camera.position.set(
      (st.camPos?.x || 0) + shX,
      (st.camPos?.y || 0) + shY,
      (st.camPos?.z || 0) + shZ
    );
    camera.lookAt(
      (st.camLook?.x || 0) + shX * 0.35,
      (st.camLook?.y || 0) + shY * 0.35,
      (st.camLook?.z || 0) + shZ * 0.35
    );
    const totalRoll = (Number(st.camRoll) || 0) + (Number(shakeOut?.roll) || 0);
    if (Math.abs(totalRoll) > 1e-5) {
      camera.rotateZ(totalRoll);
    }
    camera.updateMatrixWorld();
  }

  function applyEscapeStageAndChasmFromState(st, isSeek = false) {
    if (!st) return;
    const shore = ensureSoulsExteriorShore();
    const stStage = st.stageMode || 'castle';
    if (stStage !== bossEscapeLastStageMode) {
      bossEscapeLastStageMode = stStage;
      setSoulsZoneMode(stStage);
      if (stStage === 'castle') {
        bossEscapeChasmEnabled = false;
      }
    }
    if (stStage === 'castle') {
      const holeP = Number(st.floorHoleProgress) || 0;
      if (holeP > 0.001) {
        if (!bossEscapeChasmEnabled) {
          bossEscapeChasmEnabled = true;
          shore?.setStageMode?.('chasm_only');
        }
        shore?.setChasmState?.(holeP, st.floorHoleX || 0, st.floorHoleZ ?? SOULS_CASTLE_CONSTANTS.BOSS_CENTER_Z);
      } else {
        bossEscapeChasmEnabled = false;
        shore?.setChasmState?.(0, st.floorHoleX || 0, st.floorHoleZ ?? SOULS_CASTLE_CONSTANTS.BOSS_CENTER_Z);
        if (shore?.getStageMode?.() !== 'none') {
          shore?.setStageMode?.('none');
        }
      }
    } else if (stStage === 'shaft_river' || stStage === 'exterior_shore') {
      const wantBroken = Boolean(
        st.grateBroken ||
        stStage === 'exterior_shore' ||
        (st.cues?.grateBreakCue || 0) > 0
      );
      if (!isSeek && stStage === 'shaft_river' && (st.cues?.grateBreakCue || 0) > 0 && !bossEscapeGrateBroken) {
        bossEscapeGrateBroken = true;
        shore?.triggerGrateBreak?.();
        shore?.setGrateBroken?.(true);
      } else if (isSeek && stStage === 'shaft_river' && wantBroken) {
        bossEscapeGrateBroken = true;
        const breakElapsed = Math.max(0, (Number(st.t) || 0) - (BOSS_ESCAPE_ACTS?.GRATE_BREAK_TIME ?? 27.65));
        const animP = Math.min(1.45, 0.32 + breakElapsed * 1.15);
        shore?.setGrateBroken?.(true, animP);
      } else {
        bossEscapeGrateBroken = wantBroken;
        shore?.setGrateBroken?.(wantBroken);
      }
    }
  }

  const _escapeVfxHeroPos = { x: 0, y: 0, z: 0 };

  function syncEscapeVfxStreams(st) {
    if (!soulsEscapeVfx || !st) return;
    const uw = Number(st.underwater01) || 0;
    soulsEscapeVfx.setUnderwaterBubbles?.(uw > 0.15, st.camPos || camera.position);
    const fallingInShaft = Boolean(
      st.stageMode === 'shaft_river' &&
      (Number(st.cues?.waterSplashCue) || 0) === 0 &&
      (Number(st.heroY) || 0) > 0.35
    );
    _escapeVfxHeroPos.x = Number(st.heroX) || 0;
    _escapeVfxHeroPos.y = Number(st.heroY) || 0;
    _escapeVfxHeroPos.z = Number(st.heroZ) || 0;
    soulsEscapeVfx.setFallingDebrisStream?.(fallingInShaft, _escapeVfxHeroPos);
  }

  function startBossEscapeCutscene(anchorX = 0, anchorZ = SOULS_CASTLE_CONSTANTS.BOSS_CENTER_Z) {
    if (cameraMode === 'hub' || !isSoulsBiome(currentBiome)) return null;
    bossDoorCutsceneActive = false;
    bossDoorCutsceneElapsed = 0;
    _cutsceneState = null;
    lockOnTarget = null;
    lockOnReticle.visible = false;
    lockOnFootRing.visible = false;

    const shore = ensureSoulsExteriorShore();
    shore?.setGrateBroken?.(false);
    shore?.setSwordPickedUp?.(false);
    shore?.setBonfireLit?.(false);
    shore?.setChasmState?.(0, anchorX, anchorZ);
    shore?.setStageMode?.('none');

    const escVfx = ensureSoulsEscapeVfx();
    escVfx?.reset?.();
    escVfx?.setActive?.(true);

    bossEscapeCutsceneRig = createBossEscapeCutsceneRig(anchorX, anchorZ);
    bossEscapeCutsceneElapsed = 0;
    bossEscapeLastStageMode = 'castle';
    bossEscapeChasmEnabled = false;
    bossEscapeGrateBroken = false;
    bossEscapeLastCameraCutId = -1;
    setSoulsZoneMode('castle');
    bossEscapeCutsceneActive = true;

    computeShoreNormalCamPose(0, _escapeShoreNormPos, _escapeShoreNormLook);
    _escapeCutsceneOpts.normalCamPos = _escapeShoreNormPos;
    _escapeCutsceneOpts.normalCamLook = _escapeShoreNormLook;
    _escapeCutsceneOpts.normalFov = getCombatFovForBiome(camera.aspect || 1);
    _escapeCutsceneState = sampleBossEscapeCutscene(
      bossEscapeCutsceneRig,
      0,
      _escapeCutsceneStateOut,
      _escapeCutsceneOpts
    );
    _escapeCutsceneState.active = true;
    applyEscapeStageAndChasmFromState(_escapeCutsceneState, true);
    applyEscapeCutsceneCamera(_escapeCutsceneState, null, _escapeCutsceneOpts.normalFov);
    syncEscapeVfxStreams(_escapeCutsceneState);
    escVfx?.update?.(0.016, 0, _escapeCutsceneState);
    return _escapeCutsceneState;
  }

  function isBossEscapeCutsceneActive() {
    return Boolean(bossEscapeCutsceneActive && cameraMode !== 'hub' && isSoulsBiome(currentBiome));
  }

  function getBossEscapeCutsceneState() {
    if (!isBossEscapeCutsceneActive()) return null;
    return _escapeCutsceneState;
  }

  function seekBossEscapeCutscene(tSec = 0) {
    if (!isBossEscapeCutsceneActive() || !bossEscapeCutsceneRig) return null;
    const clampedT = Math.max(0, Math.min(BOSS_ESCAPE_CUTSCENE_DURATION - 0.001, Number(tSec) || 0));
    bossEscapeCutsceneElapsed = clampedT;
    lockOnTarget = null;
    lockOnReticle.visible = false;
    lockOnFootRing.visible = false;
    computeShoreNormalCamPose(0, _escapeShoreNormPos, _escapeShoreNormLook);
    _escapeCutsceneOpts.normalCamPos = _escapeShoreNormPos;
    _escapeCutsceneOpts.normalCamLook = _escapeShoreNormLook;
    _escapeCutsceneOpts.normalFov = getCombatFovForBiome(camera.aspect || 1);
    _escapeCutsceneState = sampleBossEscapeCutscene(
      bossEscapeCutsceneRig,
      clampedT,
      _escapeCutsceneStateOut,
      _escapeCutsceneOpts
    );
    _escapeCutsceneState.active = !_escapeCutsceneState.finished;
    applyEscapeStageAndChasmFromState(_escapeCutsceneState, true);
    applyEscapeCutsceneCamera(_escapeCutsceneState, null, _escapeCutsceneOpts.normalFov);

    // Sync 3-point cinema lighting, underwater bubbles, shaft debris & preview impact bursts on seek frames!
    const escVfx = ensureSoulsEscapeVfx();
    escVfx?.reset?.();
    escVfx?.setActive?.(true);
    syncEscapeVfxStreams(_escapeCutsceneState);
    const st = _escapeCutsceneState;
    const hx = Number(st.heroX) || 0;
    const hy = Number(st.heroY) || 0;
    const hz = Number(st.heroZ) || 0;
    const bx = Number(st.bossX) || 0;
    const bz = Number(st.bossZ) || hz - 2;
    const fx = Number(st.floorHoleX) || 0;
    const fz = Number(st.floorHoleZ) ?? SOULS_CASTLE_CONSTANTS.BOSS_CENTER_Z;
    if (st.stageMode === 'castle') {
      if ((Number(st.impactFlash01) || 0) > 0.12 && clampedT < (BOSS_ESCAPE_ACTS?.ACT2_START ?? 4.2)) {
        escVfx?.emitParrySparks?.((hx + bx) * 0.5, 1.38, (hz + bz) * 0.5, 1.0);
      } else if (clampedT >= (BOSS_ESCAPE_ACTS?.KNOCKDOWN_CUE_TIME ?? 2.85) && clampedT <= (BOSS_ESCAPE_ACTS?.ACT2_START ?? 4.2)) {
        escVfx?.emitDustImpact?.(hx, 0.14, hz, 1.1);
      } else if ((Number(st.floorHoleProgress) || 0) > 0.04 && clampedT < (BOSS_ESCAPE_ACTS?.ACT4_START ?? 17.5)) {
        escVfx?.emitFloorCollapseBurst?.(fx, 0.25, fz);
      }
    } else if (st.stageMode === 'shaft_river') {
      const wsT = BOSS_ESCAPE_ACTS?.WATER_SPLASH_TIME ?? 18.85;
      const gbT = BOSS_ESCAPE_ACTS?.GRATE_BREAK_TIME ?? 20.85;
      if ((Number(st.cues?.waterSplashCue) || 0) > 0 && clampedT < wsT + 1.2) {
        escVfx?.emitWaterSplash?.(hx, 0.15, hz, 1.2);
      } else if (Boolean(st.grateBroken) && clampedT < gbT + 0.9) {
        escVfx?.emitGrateBreakBurst?.(hx, 0.55, Math.min(26.2, hz + 0.6));
      }
    }
    escVfx?.update?.(0.08, clampedT, st);
    return _escapeCutsceneState;
  }

  function syncOrbitFromFinalEscapeState(st, normalFov) {
    const anchors = ensureSoulsExteriorShore()?.getAnchors?.() || EXTERIOR_SHORE_ANCHORS;
    const wake = anchors.wakePos || { x: 0, y: 0, z: 2.5 };
    const wx = Number.isFinite(wake.x) ? wake.x : 0;
    const wz = Number.isFinite(wake.z) ? wake.z : 2.5;
    const hgY = getGroundHeight(wx, wz);
    const hPivotY = hgY + SOULS_CAMERA_PIVOT_Y;
    const finalYaw = Number.isFinite(Number(st?.finalCamYaw)) ? Number(st.finalCamYaw) : 0;

    // Derive exact pitch & distance from the cutscene's last camera frame (t = 34.0s) if on Exterior Shore
    // so there is ZERO jump when control hands back to live gameplay!
    let finalPitch = SHORE_WAKE_ORBIT_PITCH;
    let finalDist = SHORE_WAKE_ORBIT_DIST;
    const aspectMult = camera.aspect < 0.92 ? 1.15 : 1;
    if (st?.camPos && Number.isFinite(st.camPos.x) && Number.isFinite(st.camPos.y) && Number.isFinite(st.camPos.z)) {
      const dx = st.camPos.x - wx;
      const dy = st.camPos.y - hPivotY;
      const dz = st.camPos.z - wz;
      const d = Math.hypot(dx, dy, dz);
      if (d >= 2.8 && d <= 14.0) {
        finalDist = d / aspectMult;
        finalPitch = Math.max(0.14, Math.min(0.85, Math.asin(Math.max(-0.95, Math.min(0.95, dy / d)))));
      }
    }

    setCombatOrbitYaw(finalYaw, finalPitch, finalDist);
    soulsLockDistBonus = 0;
    targetX = wx;
    targetY = hgY;
    targetZ = wz;
    lastHeroX = wx;
    lastHeroZ = wz;
    hasFollowedOnce = true;

    computeShoreNormalCamPose(finalYaw, _cutsceneNormalPos, _cutsceneNormalLook, finalPitch, finalDist * aspectMult);
    if (Math.abs(camera.fov - normalFov) > 0.01) {
      camera.fov = normalFov;
      camera.updateProjectionMatrix();
    }
    camera.up.set(0, 1, 0);
    camera.position.copy(_cutsceneNormalPos);
    camera.lookAt(_cutsceneNormalLook);
    camera.updateMatrixWorld();
  }

  function skipBossEscapeCutscene(force = false) {
    if (!isBossEscapeCutsceneActive()) return null;
    if (!force && bossEscapeCutsceneElapsed < BOSS_ESCAPE_CUTSCENE_SKIP_TIME && !_escapeCutsceneState?.canSkip) {
      return null;
    }
    const normalFov = getCombatFovForBiome(camera.aspect || 1);

    bossEscapeCutsceneActive = false;
    bossEscapeCutsceneElapsed = BOSS_ESCAPE_CUTSCENE_DURATION;
    bossEscapeLastStageMode = 'exterior_shore';
    bossEscapeChasmEnabled = false;
    bossEscapeGrateBroken = true;
    bossEscapeLastCameraCutId = -1;
    soulsEscapeVfx?.setUnderwaterBubbles?.(false);
    soulsEscapeVfx?.setFallingDebrisStream?.(false);
    soulsEscapeVfx?.setActive?.(false);
    soulsEscapeVfx?.reset?.();
    setSoulsZoneMode('exterior_shore');
    soulsExteriorShore?.setGrateBroken?.(true);

    computeShoreNormalCamPose(0, _escapeShoreNormPos, _escapeShoreNormLook);
    _escapeCutsceneOpts.normalCamPos = _escapeShoreNormPos;
    _escapeCutsceneOpts.normalCamLook = _escapeShoreNormLook;
    _escapeCutsceneOpts.normalFov = normalFov;
    _escapeCutsceneState = getBossEscapeCutsceneSkipState(
      bossEscapeCutsceneRig,
      _escapeCutsceneStateOut,
      _escapeCutsceneOpts
    );
    _escapeCutsceneState.active = false;
    syncOrbitFromFinalEscapeState(_escapeCutsceneState, normalFov);
    return _escapeCutsceneState;
  }
  let hasFollowedOnce = false;
  let shakeIntensity = 0;
  let shakeTime = 0;
  let bossModeActive = false;
  let internalTime = 0;
  const hubCamGoal = new THREE.Vector3();

  function setHubStageFocus(focusMode = 'center') {
    hubStageFocus = focusMode === 'heroes' ? 'heroes' : focusMode === 'arsenal' ? 'arsenal' : 'center';
    const isArsenal = hubStageFocus === 'arsenal';
    hubArsenalGlowGroup.visible = isArsenal;
    hubContactAoMesh.visible = !isArsenal;
    hubShadowCatcher.visible = !isArsenal && !lowSpecMode;
    hubAnkleMistGroup.visible = !isArsenal;
  }

  function applyHubCameraPose(dt, snapNow = false) {
    const aspect = camera.aspect || 1;
    const isPortrait = aspect < 0.92;
    const targetFov = isPortrait ? 46 : 38;
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov = targetFov;
      camera.updateProjectionMatrix();
    }

    // Offset look target left so the 3D Warrior Knight frames heroically on the right-center while
    // the clean Dark Souls title menu column sits cleanly on the left (ZERO overlap on PC & Mobile!).
    currentHubShiftX = isPortrait ? 0 : -0.82;

    const camZ = isPortrait ? 5.25 : 4.55;
    const camY = isPortrait ? 1.48 : 1.42;
    const lookY = isPortrait ? 0.72 : 0.84;

    const swayY = Math.sin(internalTime * 0.52) * 0.010;
    const swayX = Math.cos(internalTime * 0.34) * 0.018;
    hubCamGoal.set(currentHubShiftX + swayX, camY + swayY, camZ);

    if (snapNow || !dt || dt <= 0) {
      camera.position.copy(hubCamGoal);
    } else {
      const lerpFactor = 1 - Math.exp(-9.0 * Math.min(dt, 0.1));
      camera.position.lerp(hubCamGoal, lerpFactor);
    }
    camera.lookAt(currentHubShiftX, lookY, 0);

    heroAuraLight.position.set(0.4, 2.2, 2.6);
    dirLight.position.set(3.2, 14.0, 5.0);
    dirLight.target.position.set(0, 0.85, 0);
    dirLight.target.updateMatrixWorld();
  }

  function syncDirLightShadowMapSize(targetRes) {
    const safeRes = Math.max(512, Math.min(2048, targetRes | 0));
    if (dirLight.shadow.mapSize.width === safeRes && dirLight.shadow.mapSize.height === safeRes) return;
    dirLight.shadow.mapSize.set(safeRes, safeRes);
    if (dirLight.shadow.map) {
      dirLight.shadow.map.dispose();
      dirLight.shadow.map = null;
    }
    dirLight.shadow.needsUpdate = true;
  }

  function applyCombatLightingAndShadows(isModeSwitch = false) {
    const basePal = getCombatBasePalette();
    const combatPal = getActiveCombatPalette();
    const isSouls = isSoulsBiome(currentBiome);
    const isMisty = isMistyBiome(currentBiome);
    const isAsh = currentBiome === 'ash_citadel';
    const isFrost = currentBiome === 'frost_ruins';
    const fogCfg = getCombatFogForBiome(currentBiome, isModeSwitch);

    if (!scene.background) scene.background = combatPal.bg.clone();
    else scene.background.copy(combatPal.bg);
    renderer.setClearColor((isModeSwitch ? basePal : combatPal).bg.getHex(), 1);
    renderer.toneMappingExposure = getCombatExposureForBiome(currentBiome);
    scene.environment = isSouls ? getSoulsEnvMap() : null;
    scene.fog.color.copy(combatPal.fog);
    scene.fog.near = fogCfg.near;
    scene.fog.far = fogCfg.far;
    // CRITICAL (#351): strictly hide legacy square motesPoints in souls_citadel (replaced by round cathedral dust in soulsAtmosphere.js)
    motesPoints.visible = !isSouls;

    hemiLight.color.copy(combatPal.hemiSky);
    hemiLight.groundColor.copy(combatPal.hemiGround);
    hemiLight.intensity = isSouls
      ? 0.56
      : isMisty
        ? COMBAT_HEMI_INTENSITY * (isAsh ? 1.14 : 1.12)
        : COMBAT_HEMI_INTENSITY;

    ambientLight.color.setHex(getCombatAmbientColorForBiome(currentBiome));
    ambientLight.intensity = isSouls
      ? 0.15
      : isMisty
        ? COMBAT_AMBIENT_INTENSITY * (isAsh ? 1.12 : isFrost ? 1.14 : 1.15)
        : COMBAT_AMBIENT_INTENSITY;

    dirLight.color.copy(combatPal.dir);
    dirLight.intensity = isSouls
      ? 1.85
      : isMisty
        ? COMBAT_DIR_INTENSITY * (isFrost || isAsh ? 1.08 : 1.06)
        : COMBAT_DIR_INTENSITY;

    // Subtle cool moonlit rim fill on hero in souls_citadel so warm bonfire/brazier/boss fire pops with cinematic contrast
    heroAuraLight.color.setHex(isSouls ? 0x9eb8e8 : COMBAT_HERO_AURA_COLOR);
    heroAuraLight.intensity = isSouls ? 0.28 : COMBAT_HERO_AURA_INTENSITY;
    heroAuraLight.distance = isSouls ? 8.5 : 16.5;

    dirLight.castShadow = true;
    const targetShadowRes = isMobileDevice
      ? 512
      : lowSpecMode
        ? 512
        : (isSouls ? 2048 : 1024);
    syncDirLightShadowMapSize(targetShadowRes);

    const combatShadExt = isSouls ? (isMobileDevice ? 13 : 12.2) : 21;
    dirLight.shadow.camera.left = -combatShadExt;
    dirLight.shadow.camera.right = combatShadExt;
    dirLight.shadow.camera.top = combatShadExt;
    dirLight.shadow.camera.bottom = -combatShadExt;
    dirLight.shadow.camera.near = isSouls ? 2 : 4;
    dirLight.shadow.camera.far = isSouls ? 62 : 75;
    dirLight.shadow.radius = isSouls ? 2.0 : 2.2;
    dirLight.shadow.bias = isSouls ? -0.00028 : -0.00035;
    dirLight.shadow.normalBias = isSouls ? 0.032 : 0.0;
    dirLight.shadow.camera.updateProjectionMatrix();
    lastDirSnapX = NaN;
    lastDirSnapZ = NaN;

    plazaRuneMat.color.copy(combatPal.plazaRune);
    moteMat.color.copy(combatPal.plazaRune);
  }

  function setCameraMode(mode = 'combat') {
    const nextMode = mode === 'hub' ? 'hub' : 'combat';
    const changed = cameraMode !== nextMode;
    cameraMode = nextMode;

    if (cameraMode === 'hub') {
      // Pure Dark-Fantasy Gothic Title Screen backdrop (deep obsidian void + torch rim + rising embers)
      if (!scene.background) scene.background = new THREE.Color(0x07060b);
      else scene.background.setHex(0x07060b);
      scene.environment = getSoulsEnvMap();
      renderer.setClearColor(0x07060b, 1);
      renderer.toneMappingExposure = 1.08;
      arenaGroup.visible = false;
      motesPoints.visible = false;
      syncBiomeWeatherVisibility();
      hubKeySpotLight.color.setHex(0xc8d4ec);
      hubKeySpotLight.intensity = 2.25;
      hubKeySpotLight.visible = true;
      hubRimLight.color.setHex(0xff6b24);
      hubRimLight.intensity = 3.4;
      hubRimLight.visible = true;
      hubBackdropGroup.visible = true;
      hubArsenalGlowGroup.visible = false;
      hubContactAoMesh.visible = true;
      hubShadowCatcher.visible = !lowSpecMode;
      hubAnkleMistGroup.visible = true;

      // Apply moody twilight Hub lighting (original combat values restored when leaving Hub)
      hemiLight.color.copy(PALETTE_HUB.hemiSky);
      hemiLight.groundColor.copy(PALETTE_HUB.hemiGround);
      hemiLight.intensity = HUB_HEMI_INTENSITY;
      ambientLight.color.setHex(HUB_AMBIENT_COLOR);
      ambientLight.intensity = HUB_AMBIENT_INTENSITY;
      dirLight.color.copy(PALETTE_HUB.dir);
      dirLight.intensity = HUB_DIR_INTENSITY;
      heroAuraLight.color.setHex(HUB_HERO_AURA_COLOR);
      heroAuraLight.intensity = HUB_HERO_AURA_INTENSITY;
      heroAuraLight.distance = 16.5;

      dirLight.castShadow = !lowSpecMode;
      syncDirLightShadowMapSize(isMobileDevice || lowSpecMode ? 512 : 1024);
      // Tighten directional shadow frustum around the Hub pedestal for crisp-yet-soft ground shadows!
      const hubShadExt = 2.6;
      dirLight.shadow.camera.left = -hubShadExt;
      dirLight.shadow.camera.right = hubShadExt;
      dirLight.shadow.camera.top = hubShadExt;
      dirLight.shadow.camera.bottom = -hubShadExt;
      dirLight.shadow.camera.near = 2;
      dirLight.shadow.camera.far = 28;
      dirLight.shadow.radius = 4;
      dirLight.shadow.bias = -0.0002;
      dirLight.shadow.normalBias = 0.0;
      dirLight.shadow.camera.updateProjectionMatrix();
      scene.fog.near = 40;
      scene.fog.far = 120;
      targetX = 0;
      targetY = 0;
      targetZ = 0;
      lastDirSnapX = NaN;
      lastDirSnapZ = NaN;
      lastDirSnapSouls = null;
      bossDoorCutsceneActive = false;
      bossDoorCutsceneElapsed = 0;
      _cutsceneState = null;
      bossEscapeCutsceneActive = false;
      bossEscapeCutsceneElapsed = 0;
      _escapeCutsceneState = null;
      bossEscapeLastStageMode = 'castle';
      bossEscapeChasmEnabled = false;
      bossEscapeGrateBroken = false;
      soulsZoneMode = 'castle';
      soulsExteriorShore?.setStageMode?.('none');
      lockOnTarget = null;
      lockLookOffsetX = 0;
      lockLookOffsetY = 0;
      lockLookOffsetZ = 0;
      lockOnReticle.visible = false;
      applyHubCameraPose(0.016, changed || !hasFollowedOnce);
      hasFollowedOnce = true;
    } else {
      arenaGroup.visible = true;
      motesPoints.visible = !isSoulsBiome(currentBiome);
      syncBiomeWeatherVisibility();
      hubKeySpotLight.visible = false;
      hubRimLight.visible = false;
      hubBackdropGroup.visible = false;

      // Apply biome-accurate Combat lighting, PMREM env (Souls only), and shadow frustum
      applyCombatLightingAndShadows(true);
      if (isSoulsBiome(currentBiome)) {
        prewarmSoulsEscapeStages();
      }

      lastDirSnapX = NaN;
      lastDirSnapZ = NaN;
      lastDirSnapSouls = null;
      hasFollowedOnce = false;
      const aspect = camera.aspect || 1;
      camera.fov = getCombatFovForBiome(aspect);
      camera.updateProjectionMatrix();
      const mult = aspect < 0.92 ? 1.15 : 1;
      camera.position.set(
        targetX + COMBAT_CAM_OFFSET.x * mult,
        COMBAT_CAM_OFFSET.y * mult,
        targetZ + COMBAT_CAM_OFFSET.z * mult
      );
      camera.lookAt(targetX, 0.5, targetZ);
      heroAuraLight.position.set(targetX, 3.2, targetZ);
    }
  }

  function getCombatFovForBiome(aspect = 1) {
    if (isSoulsBiome(currentBiome)) {
      return aspect < 1.0 ? Math.min(68, 56 + (1.0 - aspect) * 22) : 56;
    }
    return aspect < 1.0 ? Math.min(64, 44 + (1.0 - aspect) * 34) : 44;
  }

  // Debug: draw every invisible collider and the movement boundary on the floor.
  const debugColliderGroup = new THREE.Group();
  debugColliderGroup.visible = false;
  arenaGroup.add(debugColliderGroup);

  function setDebugColliders(enabled = true) {
    debugColliderGroup.visible = Boolean(enabled);
    if (!enabled) return;
    const disposedMats = new Set();
    while (debugColliderGroup.children.length) {
      const ch = debugColliderGroup.children.pop();
      if (ch.geometry) ch.geometry.dispose();
      if (ch.material && !disposedMats.has(ch.material)) {
        disposedMats.add(ch.material);
        ch.material.dispose();
      }
    }
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff3355, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide
    });
    const boundaryMat = new THREE.MeshBasicMaterial({
      color: 0x33ddff, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide
    });
    for (const o of obstacles) {
      if (o.halfW !== undefined || o.width !== undefined) {
        const w = (o.halfW !== undefined ? o.halfW * 2 : o.width) || 1.6;
        const d = (o.halfD !== undefined ? o.halfD * 2 : (o.depth ?? o.width)) || 1.6;
        const box = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
        box.rotation.x = -Math.PI / 2;
        box.position.set(o.x ?? 0, 0.09, o.z ?? 0);
        debugColliderGroup.add(box);
      } else {
        const r = o.radius ?? o.r ?? 0.95;
        const ring = new THREE.Mesh(new THREE.RingGeometry(Math.max(0.02, r - 0.04), r + 0.04, 32), mat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(o.x ?? 0, 0.09, o.z ?? 0);
        debugColliderGroup.add(ring);
      }
    }
    for (const [radius, color] of [[B - 2.6, boundaryMat], [B - 1.6, boundaryMat]]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.05, radius + 0.05, 96), color);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.08;
      debugColliderGroup.add(ring);
    }
  }

  const isArenaCircular = () => isMistyBiome(currentBiome);

  function syncMistyObstacles() {
    if (!isMistyBiome(currentBiome)) return;
    obstacles.length = 0;
    const ma = ensureMistyArena();
    const cols = ma.getColliders();
    for (let i = 0; i < cols.length; i++) {
      obstacles.push(cols[i]);
    }
    if (debugColliderGroup.visible) {
      setDebugColliders(true);
    }
  }

  function setArenaBiome(biomeOrLevel = 'courtyard', levelNumber = null) {
    currentBiome = resolveBiomeId(biomeOrLevel, levelNumber);
    const isSouls = isSoulsBiome(currentBiome);
    const isMisty = isMistyBiome(currentBiome);
    const isAsh = currentBiome === 'ash_citadel';
    const isFrost = currentBiome === 'frost_ruins';
    courtyardPropsGroup.visible = !isMisty && !isSouls;

    if (isSouls) {
      if (mistyArena) mistyArena.group.visible = false;
      bossEscapeCutsceneActive = false;
      bossEscapeCutsceneElapsed = 0;
      _escapeCutsceneState = null;
      bossEscapeLastStageMode = 'castle';
      bossEscapeChasmEnabled = false;
      bossEscapeGrateBroken = false;
      soulsZoneMode = 'castle';
      soulsExteriorShore?.setStageMode?.('none');
      const sa = ensureSoulsArena();
      sa.group.visible = true;
      sa.setFogGateSealed(false);
      phase2ArenaFireRingCtrl?.reset?.();
      obstacles.length = 0;
      const cols = sa.getColliders();
      for (let i = 0; i < cols.length; i++) obstacles.push(cols[i]);
      // Authentic Elden Ring / Dark Souls 3 over-the-head 3rd-person camera framing
      cameraLocked = false;
      orbitYaw = orbitTargetYaw = 0;
      orbitPitch = orbitTargetPitch = SOULS_DEFAULT_ORBIT_PITCH;
      orbitDist = orbitTargetDist = SOULS_DEFAULT_ORBIT_DIST;
      soulsCamClipDist = SOULS_DEFAULT_ORBIT_DIST;
      soulsLockDistBonus = 0;
    } else if (isMisty) {
      if (soulsArena) soulsArena.group.visible = false;
      const ma = ensureMistyArena();
      ma.setBiomeTheme?.(currentBiome);
      ma.group.visible = true;
      syncMistyObstacles();
      if (!ma.isLoaded()) {
        ma.ensureLoaded().then(() => {
          if (isMistyBiome(currentBiome)) {
            ma.setBiomeTheme?.(currentBiome);
            syncMistyObstacles();
          }
        });
      }
    } else {
      if (mistyArena) mistyArena.group.visible = false;
      if (soulsArena) soulsArena.group.visible = false;
      obstacles.length = 0;
      // The original courtyard was authored for a 54 m arena; keep its layout
      // proportionally identical after the arena was enlarged.
      const scale = ARENA_HALF_SIZE / 27;
      for (let i = 0; i < COURTYARD_OBSTACLES.length; i++) {
        const o = COURTYARD_OBSTACLES[i];
        obstacles.push({ ...o, x: o.x * scale, z: o.z * scale });
      }
      if (debugColliderGroup.visible) {
        setDebugColliders(true);
      }
    }

    groundMesh.visible = !isMisty && !isSouls;
    outerGround.visible = !isSouls;
    if (!isMisty && !isSouls) {
      groundMesh.material.map = cobbleTex;
      groundMesh.material.color.setHex(0xe8e6f0);
      groundMesh.material.emissive.setHex(0x161422);
      groundMesh.material.emissiveMap = cobbleTex;
      groundMesh.material.emissiveIntensity = 0.32;
      groundMesh.material.roughness = 0.84;
      groundMesh.material.metalness = 0.05;
      groundMesh.material.needsUpdate = true;
    }
    if (!isSouls) {
      outerGround.position.y = -0.06;
      outerGround.material.color.setHex(getOuterGroundColorForBiome(currentBiome));
      outerGround.material.roughness = 0.95;
    }
    syncBiomeWeatherVisibility();

    if (cameraMode !== 'hub') {
      applyCombatLightingAndShadows(false);
      const targetFov = getCombatFovForBiome(camera.aspect || 1);
      if (Math.abs(camera.fov - targetFov) > 0.05) {
        camera.fov = targetFov;
        camera.updateProjectionMatrix();
      }
    }
  }

  // One-time GPU Shader Pre-Compilation + Texture Upload for souls_citadel (ZERO mid-run GLSL compile hitches!)
  const prewarmedTextures = new WeakSet();
  const PREWARM_TEX_KEYS = [
    'map',
    'normalMap',
    'roughnessMap',
    'metalnessMap',
    'emissiveMap',
    'aoMap',
    'alphaMap',
    'bumpMap',
    'envMap'
  ];

  function prewarmTextureIfReady(tex) {
    if (!tex || !tex.isTexture || prewarmedTextures.has(tex)) return;
    if (tex.isRenderTargetTexture || tex.isFramebufferTexture) return;
    const img = tex.image;
    if (!img) return;
    if (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement && (!img.complete || img.naturalWidth === 0)) {
      return;
    }
    try {
      renderer.initTexture(tex);
      prewarmedTextures.add(tex);
    } catch {}
  }

  function prewarmMaterialTextures(mat) {
    if (!mat) return;
    for (let i = 0; i < PREWARM_TEX_KEYS.length; i++) {
      prewarmTextureIfReady(mat[PREWARM_TEX_KEYS[i]]);
    }
    if (mat.uniforms && typeof mat.uniforms === 'object') {
      const keys = Object.keys(mat.uniforms);
      for (let i = 0; i < keys.length; i++) {
        const u = mat.uniforms[keys[i]];
        if (u && u.value && u.value.isTexture) {
          prewarmTextureIfReady(u.value);
        }
      }
    }
  }

  function prewarmSoulsShaders() {
    if (!isSoulsBiome(currentBiome)) return false;
    const sa = ensureSoulsArena();
    if (!sa || !sa.group) return false;

      // Pre-seed pooled debris, wood shield splinters, stone dust & ground fracture FBM fire shaders so 1st hit/slam has 0ms compile hitch!
      if (activeDebris.length === 0) {
        const seedKinds = ['bone', 'helmet', 'shield', 'rock_chunk', 'flagstone_chip', 'molten_chunk'];
        for (let i = 0; i < seedKinds.length; i++) {
          const k = seedKinds[i];
          if (freeDebrisByKind[k] && freeDebrisByKind[k].length === 0) {
            const piece = acquireDebrisPiece(k);
            piece.mesh.position.set(0, -100, 0);
            piece.mesh.visible = false;
            freeDebrisByKind[k].push(piece);
          }
        }
      }
      if (activeStoneDustPuffs.length === 0 && freeStoneDustPuffs.length === 0) {
        spawnStoneDustPuff({ x: 0, y: -100, z: 0, opacity: 0.01, duration: 0.2 });
        const dp0 = activeStoneDustPuffs.pop();
        if (dp0) {
          dp0.sprite.visible = false;
          freeStoneDustPuffs.push(dp0);
        }
      }
      if (activeWoodSplinters.length === 0 && freeWoodSplinters.length < 3) {
        for (let i = freeWoodSplinters.length; i < 3; i++) {
          const sp = createWoodSplinterEntry(i);
          sp.mesh.position.set(0, -100, 0);
          sp.mesh.visible = false;
          freeWoodSplinters.push(sp);
        }
      }
      if (activeGroundFractures.length === 0 && freeGroundFractures.length === 0) {
        const assets = getSharedFractureAssets();
        const gfEntry = createGroundFracturePoolEntry(assets);
        gfEntry.group.position.set(0, -100, 0);
        gfEntry.group.visible = false;
        if (gfEntry.slabs.length > 1) {
          gfEntry.slabs[1].mesh.material = assets.moltenSlabMat;
        }
        freeGroundFractures.push(gfEntry);
      }
      ensurePoolEntryFireMeshes(freeGroundFractures[0]);
      const p2FireRing = ensurePhase2ArenaFireRing();

      // Prewarm elden_dissolve_v2 shader program once during load (eliminates 80-300ms freeze on first mob/boss kill!)
      let dissolveWarmupGroup = null;
      let dissolveWarmupGeo = null;
      let dissolveWarmupMat = null;
      try {
        dissolveWarmupGeo = new THREE.BufferGeometry();
        dissolveWarmupGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0.01, 0, 0, 0, 0.01, 0]), 3));
        dissolveWarmupGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
        dissolveWarmupGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1]), 2));
        dissolveWarmupMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.7, metalness: 0.2 });
        const dissolveMesh = new THREE.Mesh(dissolveWarmupGeo, dissolveWarmupMat);
        dissolveMesh.frustumCulled = false;
        dissolveWarmupGroup = new THREE.Group();
        dissolveWarmupGroup.position.set(0, -100, 0);
        dissolveWarmupGroup.add(dissolveMesh);
        applyEldenDissolveToModel(dissolveWarmupGroup, 0.25, { dt: 0.016 });
        scene.add(dissolveWarmupGroup);
      } catch {}

    const savedVis = new Map();
    const setTempVisible = (node, vis) => {
      if (!node) return;
      if (!savedVis.has(node)) savedVis.set(node, node.visible);
      node.visible = vis;
    };

    try {
      setTempVisible(arenaGroup, true);
      setTempVisible(sa.group, true);
      setTempVisible(courtyardPropsGroup, false);
      if (mistyArena) setTempVisible(mistyArena.group, false);
      setTempVisible(hubBackdropGroup, false);
      setTempVisible(hubKeySpotLight, false);
      setTempVisible(hubRimLight, false);

      // Temporarily expose pre-seeded below-floor VFX meshes so renderer.compile() compiles all shaders & textures upfront!
      for (const k of Object.keys(freeDebrisByKind)) {
        const arr = freeDebrisByKind[k];
        if (arr && arr.length > 0) setTempVisible(arr[0].mesh, true);
      }
      for (let i = 0; i < Math.min(3, freeWoodSplinters.length); i++) {
        setTempVisible(freeWoodSplinters[i].mesh, true);
      }
      if (freeStoneDustPuffs.length > 0) {
        setTempVisible(freeStoneDustPuffs[0].sprite, true);
      }
      if (freeGroundFractures.length > 0) {
        const gf0 = freeGroundFractures[0];
        setTempVisible(gf0.group, true);
        setTempVisible(gf0.craterDisc, true);
        if (gf0.pitGroup) setTempVisible(gf0.pitGroup, true);
        if (gf0.fireField?.group) setTempVisible(gf0.fireField.group, true);
        if (gf0.fireRoad?.group) setTempVisible(gf0.fireRoad.group, true);
      }
      if (p2FireRing?.group && !p2FireRing.isActive?.()) {
        setTempVisible(p2FireRing.group, true);
      }

      if (!scene.environment) {
        scene.environment = getSoulsEnvMap();
      }

      const isExcludedSubtree = (obj) => {
        let cur = obj;
        while (cur) {
          if (cur === courtyardPropsGroup || cur === hubBackdropGroup || (mistyArena && cur === mistyArena.group)) {
            return true;
          }
          cur = cur.parent;
        }
        return false;
      };

      const occludableSoulsLights = [];
      let anyOccludableVisibleNow = false;
      scene.traverse((obj) => {
        if (!obj || isExcludedSubtree(obj)) return;
        if (obj.isPointLight && obj.name === 'bossShoulderLanternLight') {
          occludableSoulsLights.push(obj);
          let effVis = true;
          let cur = obj;
          while (cur) {
            if (!cur.visible) {
              effVis = false;
              break;
            }
            cur = cur.parent;
          }
          if (effVis) anyOccludableVisibleNow = true;
        }
        const mat = obj.material;
        if (mat) {
          if (Array.isArray(mat)) {
            for (let i = 0; i < mat.length; i++) prewarmMaterialTextures(mat[i]);
          } else {
            prewarmMaterialTextures(mat);
          }
        }
      });

      scene.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);

      const applyOccludableLightState = (enabled) => {
        for (let i = 0; i < occludableSoulsLights.length; i++) {
          const l = occludableSoulsLights[i];
          if (enabled) {
            let cur = l;
            while (cur && cur !== scene) {
              setTempVisible(cur, true);
              cur = cur.parent;
            }
          } else {
            setTempVisible(l, false);
          }
        }
      };

      // Compile BOTH active & occluded Boss-light count shader variants upfront (current state last
      // so material.currentProgram matches gameplay frame 1 with zero mid-run GLSL recompiles!)
      if (occludableSoulsLights.length > 0) {
        applyOccludableLightState(!anyOccludableVisibleNow);
        renderer.compile(scene, camera);
        applyOccludableLightState(anyOccludableVisibleNow);
        renderer.compile(scene, camera);
      } else {
        renderer.compile(scene, camera);
      }
      return true;
    } catch (err) {
      console.warn('[world] prewarmSoulsShaders skipped:', err);
      return false;
    } finally {
      if (dissolveWarmupGroup) {
        scene.remove(dissolveWarmupGroup);
        dissolveWarmupGeo?.dispose?.();
        dissolveWarmupMat?.dispose?.();
      }
      for (const [node, vis] of savedVis) {
        node.visible = vis;
      }
    }
  }

  // Free 3D Orbital Combat Camera State (RMB drag: yaw left/right & pitch up/down; Mouse wheel: zoom in/out)
  const DEFAULT_ORBIT_PITCH = Math.atan2(COMBAT_CAM_OFFSET.y - 0.5, COMBAT_CAM_OFFSET.z);
  const DEFAULT_ORBIT_DIST = Math.hypot(COMBAT_CAM_OFFSET.y - 0.5, COMBAT_CAM_OFFSET.z);
  const SOULS_DEFAULT_ORBIT_PITCH = 0.44;
  const SOULS_DEFAULT_ORBIT_DIST = 8.4;
  const SOULS_CAMERA_PIVOT_Y = 1.72;
  const SOULS_BOSS_LOCK_DIST_BONUS = 2.45;
  let orbitYaw = Math.PI / 4;
  let orbitPitch = DEFAULT_ORBIT_PITCH;
  let orbitDist = DEFAULT_ORBIT_DIST;
  let orbitTargetYaw = Math.PI / 4;
  let orbitTargetPitch = DEFAULT_ORBIT_PITCH;
  let orbitTargetDist = DEFAULT_ORBIT_DIST;
  let soulsCamClipDist = SOULS_DEFAULT_ORBIT_DIST;
  let soulsLockDistBonus = 0;

  let cameraLocked = false;
  let activeCameraPreset = null;

  function adjustCombatOrbit(dYaw = 0, dPitch = 0) {
    if (cameraLocked) return;
    orbitTargetYaw += dYaw;
    const minP = isSoulsBiome() ? (soulsZoneMode === 'exterior_shore' ? 0.04 : 0.12) : 0.10;
    const maxP = isSoulsBiome() ? 1.10 : 1.48;
    orbitTargetPitch = Math.max(minP, Math.min(maxP, orbitTargetPitch + dPitch));
  }

  function applyFreeLookDelta(dx = 0, dy = 0) {
    if (cameraLocked) return;
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    orbitTargetYaw -= dx * 0.0024;
    const minP = isSoulsBiome() ? (soulsZoneMode === 'exterior_shore' ? 0.04 : 0.12) : 0.14;
    const maxP = isSoulsBiome() ? 1.10 : 1.25;
    orbitTargetPitch = Math.max(minP, Math.min(maxP, orbitTargetPitch + dy * 0.0018));
  }

  function zoomCombatOrbit(wheelDelta = 0) {
    if (cameraLocked) return;
    const step = Math.sign(wheelDelta) * Math.min(Math.abs(wheelDelta), 160) * 0.018;
    const minD = isSoulsBiome() ? 4.6 : 3.0;
    const maxD = isSoulsBiome() ? 16.0 : 68.0;
    orbitTargetDist = Math.max(minD, Math.min(maxD, orbitTargetDist * Math.exp(step * 0.12)));
  }

  function setCameraLock(locked = true) {
    cameraLocked = Boolean(locked);
  }

  // Change camera distance directly (works even while a dev editor locks orbit).
  function zoomCamera(delta = 0) {
    const next = Math.max(3, Math.min(68, orbitTargetDist + delta));
    orbitDist = orbitTargetDist = next;
  }

  // Direct orbit used by dev editors; ignores the normal camera lock.
  function orbitCamera(dYaw = 0, dPitch = 0) {
    orbitYaw = orbitTargetYaw += dYaw;
    orbitPitch = orbitTargetPitch = Math.max(0.10, Math.min(1.48, orbitPitch + dPitch));
  }

  function isDevModeEnabled() {
    try {
      if (typeof window !== 'undefined' && window.location?.search?.includes('dev=1')) return true;
      if (typeof localStorage !== 'undefined' && localStorage.getItem('grimborne_dev') === '1') return true;
    } catch {}
    return false;
  }

  // ==========================================================================
  // Lazy-Loaded Dev Editors (G = Arena Editor, K = Weapon Editor)
  // Module `./world/devEditors.js` is dynamically imported ONLY when dev mode
  // is active (`?dev=1` or `localStorage.grimborne_dev === '1'`).
  // ==========================================================================
  const WEAPON_LAYOUT_KEY = 'grimborne_weapon_layout_v1';
  let devEditors = null;
  let devEditorsPromise = null;
  let arenaEditorHeroMovement = true;

  function loadWeaponLayout() {
    try {
      const raw = localStorage.getItem(WEAPON_LAYOUT_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      const mounts = [];
      scene.traverse((o) => {
        if (o.name === 'HeroWeapon_Sword_Mount' || o.name === 'HeroWeapon_Shield_Mount') mounts.push(o);
      });
      for (const it of data) {
        const obj = mounts.find((m) => m.name === it.name);
        if (!obj) continue;
        obj.position.fromArray(it.p);
        obj.rotation.set(it.r[0], it.r[1], it.r[2]);
        obj.scale.setScalar(it.s);
      }
      console.log('[weapon] layout loaded');
    } catch (e) {
      console.warn('[weapon] load failed', e);
    }
  }

  function ensureDevEditors() {
    if (devEditors) return Promise.resolve(devEditors);
    if (!isDevModeEnabled()) return Promise.resolve(null);
    if (!devEditorsPromise) {
      devEditorsPromise = import('./world/devEditors.js?v=20261125z102')
        .then((mod) => {
          devEditors = mod.createWorldDevEditors({
            scene,
            camera,
            renderer,
            getMistyArena: () => mistyArena,
            ensureMistyArena,
            isDevModeEnabled,
            isMistyBiome: () => isMistyBiome(currentBiome),
            getCurrentBiome: () => currentBiome,
            syncMistyObstacles,
            getCameraLocked: () => cameraLocked,
            setCameraLock,
            getOrbitState: () => ({ yaw: orbitYaw, pitch: orbitPitch, dist: orbitDist }),
            setCameraPreset,
            getActiveCameraPreset: () => activeCameraPreset,
            orbitCamera,
            zoomCamera,
            getTargetPos: () => ({ x: targetX, z: targetZ }),
            loadWeaponLayout,
            getHeroMovement: () => arenaEditorHeroMovement,
            setHeroMovement: (v) => {
              arenaEditorHeroMovement = Boolean(v);
            }
          });
          return devEditors;
        })
        .catch((err) => {
          devEditorsPromise = null;
          console.warn('[world] failed to load devEditors:', err);
          return null;
        });
    }
    return devEditorsPromise;
  }

  function saveWeaponLayout() {
    if (!isDevModeEnabled()) return;
    if (devEditors) {
      devEditors.saveWeaponLayout();
    } else {
      ensureDevEditors().then((ed) => ed?.saveWeaponLayout());
    }
  }

  function setWeaponEditMode(enabled = true) {
    const next = Boolean(enabled);
    if (!next) {
      devEditors?.setWeaponEditMode(false);
      return;
    }
    if (!isDevModeEnabled()) return;
    if (devEditors) {
      devEditors.setWeaponEditMode(true);
    } else {
      ensureDevEditors().then((ed) => ed?.setWeaponEditMode(true));
    }
  }

  function setArenaEditMode(enabled = true) {
    const next = Boolean(enabled);
    if (!next) {
      devEditors?.setArenaEditMode(false);
      return;
    }
    if (!isDevModeEnabled()) return;
    if (!isMistyBiome(currentBiome)) {
      console.log('[arena] editor is available only on the new arena (chapter 6+)');
      return;
    }
    if (devEditors) {
      devEditors.setArenaEditMode(true);
    } else {
      ensureDevEditors().then((ed) => ed?.setArenaEditMode(true));
    }
  }

  function onArenaKeyDown(e) {
    if (devEditors) {
      devEditors.onArenaKeyDown(e);
      return;
    }
    if (e.code === 'KeyG' && !e.repeat) {
      if (!isDevModeEnabled()) return;
      if (!isMistyBiome(currentBiome)) {
        console.log('[arena] editor is available only on the new arena (chapter 6+)');
        return;
      }
      ensureDevEditors().then((ed) => ed?.setArenaEditMode(true));
    }
  }

  window.addEventListener('keydown', onArenaKeyDown);

  function setArenaEditorHeroMovement(enabled = true) {
    arenaEditorHeroMovement = Boolean(enabled);
  }

  function getArenaProps() {
    if (!mistyArena) return [];
    return mistyArena.group.children
      .filter((o) => o !== mistyArena.group && !o.userData?.isArenaVisualOnly && o.geometry?.type !== 'CircleGeometry' && o.geometry?.type !== 'RingGeometry' && o.geometry?.type !== 'PlaneGeometry')
      .map((o, i) => ({ index: i, name: o.name || o.uuid, x: +o.position.x.toFixed(2), z: +o.position.z.toFixed(2) }));
  }

  function setArenaPropPos(index, x, z) {
    if (!mistyArena) return false;
    const prop = mistyArena.group.children.filter((o) => !o.userData?.isArenaVisualOnly && o.geometry?.type !== 'CircleGeometry' && o.geometry?.type !== 'RingGeometry' && o.geometry?.type !== 'PlaneGeometry')[index];
    if (!prop) return false;
    prop.position.x = x;
    prop.position.z = z;
    mistyArena.syncEffects?.();
    syncMistyObstacles();
    return true;
  }

  // Snap both current and target orbit values to a level-specific camera preset.
  function setCameraPreset({ yaw = Math.PI / 4, pitch = 1.13, dist = 60 } = {}) {
    activeCameraPreset = { yaw, pitch, dist };
    orbitYaw = orbitTargetYaw = yaw;
    orbitPitch = orbitTargetPitch = Math.max(0.10, Math.min(1.48, pitch));
    orbitDist = orbitTargetDist = Math.max(3.0, Math.min(68.0, dist));
  }

  function getCombatOrbitYaw() {
    return orbitYaw;
  }

  function setCombatOrbitYaw(yaw = 0, pitch = null, dist = null) {
    const safeYaw = Number.isFinite(Number(yaw)) ? Number(yaw) : 0;
    orbitYaw = safeYaw;
    orbitTargetYaw = safeYaw;
    if (pitch !== null && pitch !== undefined && Number.isFinite(Number(pitch))) {
      const minP = (isSoulsBiome() && soulsZoneMode === 'exterior_shore') ? 0.04 : 0.10;
      const clampedPitch = Math.max(minP, Math.min(1.48, Number(pitch)));
      orbitPitch = clampedPitch;
      orbitTargetPitch = clampedPitch;
    }
    if (dist !== null && dist !== undefined && Number.isFinite(Number(dist))) {
      const clampedDist = Math.max(2.8, Math.min(68.0, Number(dist)));
      orbitDist = clampedDist;
      orbitTargetDist = clampedDist;
      if (isSoulsBiome()) soulsCamClipDist = clampedDist;
    }
    return orbitYaw;
  }

  function resetCombatOrbit() {
    orbitYaw = 0;
    const p = isSoulsBiome() ? SOULS_DEFAULT_ORBIT_PITCH : DEFAULT_ORBIT_PITCH;
    const d = isSoulsBiome() ? SOULS_DEFAULT_ORBIT_DIST : DEFAULT_ORBIT_DIST;
    orbitPitch = p;
    orbitDist = d;
    orbitTargetYaw = 0;
    orbitTargetPitch = p;
    orbitTargetDist = d;
    if (isSoulsBiome()) soulsCamClipDist = d;
  }

  // Dark Souls / Elden Ring Target Lock-On State & Iconic 3D Reticle
  let lockOnTarget = null;
  const _lockOnTargetData = { x: 0, y: 1.2, z: 0, radius: 0.7, isBoss: false };
  let lockLookOffsetX = 0;
  let lockLookOffsetY = 0;
  let lockLookOffsetZ = 0;
  let lockOnPulseTime = 0;

  function createLockOnReticleTexture() {
    const size = 128;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    const half = size * 0.5;

    ctx.clearRect(0, 0, size, size);

    // Soft golden-white ambient halo
    const halo = ctx.createRadialGradient(half, half, 4, half, half, 54);
    halo.addColorStop(0.0, 'rgba(255, 252, 235, 0.95)');
    halo.addColorStop(0.24, 'rgba(253, 230, 138, 0.42)');
    halo.addColorStop(0.58, 'rgba(250, 204, 21, 0.14)');
    halo.addColorStop(1.0, 'rgba(250, 204, 21, 0.0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(half, half, 54, 0, Math.PI * 2);
    ctx.fill();

    // Thin outer golden-white ring
    ctx.strokeStyle = 'rgba(254, 243, 199, 0.82)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(half, half, 30, 0, Math.PI * 2);
    ctx.stroke();

    // Thin crisp Souls-style diamond around the center
    ctx.strokeStyle = 'rgba(255, 250, 224, 0.92)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(half, half - 42);
    ctx.lineTo(half + 42, half);
    ctx.lineTo(half, half + 42);
    ctx.lineTo(half - 42, half);
    ctx.closePath();
    ctx.stroke();

    // Bright pure-white central pinpoint dot
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(255, 245, 200, 0.95)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(half, half, 8.5, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  const lockOnReticle = new THREE.Group();
  lockOnReticle.name = 'LockOnReticle';
  lockOnReticle.visible = false;

  const lockOnSpriteMat = new THREE.SpriteMaterial({
    map: createLockOnReticleTexture(),
    transparent: true,
    depthTest: false,
    depthWrite: false,
    fog: false
  });
  const lockOnSprite = new THREE.Sprite(lockOnSpriteMat);
  lockOnSprite.renderOrder = 999;
  lockOnReticle.add(lockOnSprite);

  const lockOnFootRingGeo = new THREE.RingGeometry(0.86, 1.0, 40);
  lockOnFootRingGeo.rotateX(-Math.PI / 2);
  const lockOnFootRingMat = new THREE.MeshBasicMaterial({
    color: 0xfde68a,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending
  });
  const lockOnFootRing = new THREE.Mesh(lockOnFootRingGeo, lockOnFootRingMat);
  lockOnFootRing.renderOrder = 12;
  lockOnReticle.add(lockOnFootRing);
  scene.add(lockOnReticle);

  function setLockOnTarget(target = null) {
    if (cameraMode === 'hub' || !target || !Number.isFinite(target.x) || !Number.isFinite(target.z)) {
      lockOnTarget = null;
      lockOnReticle.visible = false;
      return;
    }
    _lockOnTargetData.x = target.x;
    _lockOnTargetData.y = Number.isFinite(target.y) ? target.y : (target.isBoss ? 2.05 : 1.32);
    _lockOnTargetData.z = target.z;
    _lockOnTargetData.radius = Number.isFinite(target.radius) ? target.radius : 0.7;
    _lockOnTargetData.isBoss = Boolean(target.isBoss);
    lockOnTarget = _lockOnTargetData;
  }

  function computeSoulsSafeCamDist(pivotX, pivotY, pivotZ, dirX, dirY, dirZ, desiredDist) {
    const minDist = 2.6;
    if (desiredDist <= minDist) return desiredDist;
    const steps = 16;
    const camPad = 0.34;
    let safeDist = desiredDist;

    // Wall, doorway, sealed Boss Door & vaulted-ceiling clamping is handled authoritatively by
    // clampCastleCameraPosition() for the full 6-zone castle layout (z in [-64..+68]).
    // Here we only sweep against tall interior columns & Throne backrest so they never occlude the hero.
    if (obstacles.length > 0) {
      for (let s = 1; s <= steps; s++) {
        const d = minDist + ((desiredDist - minDist) * s) / steps;
        const px = pivotX + dirX * d;
        const py = pivotY + dirY * d;
        const pz = pivotZ + dirZ * d;
        let hit = false;

        for (let i = 0; i < obstacles.length; i++) {
          const o = obstacles[i];
          if (!o || o.isBonfire || o.kind === 'bonfire' || o.kind === 'brazier' || o.kind === 'shrine') continue;
          if (o.height != null && py > o.height + 0.25) continue;
          if (o.halfW != null && o.halfD != null) {
            if (Math.max(o.halfW, o.halfD) < 0.9) continue;
            if (
              Math.abs(px - o.x) < o.halfW + camPad &&
              Math.abs(pz - o.z) < o.halfD + camPad
            ) {
              hit = true;
              break;
            }
          } else if (o.radius != null) {
            if (o.radius < 0.9) continue;
            const ox = px - o.x;
            const oz = pz - o.z;
            const rLim = o.radius + camPad;
            if (ox * ox + oz * oz < rLim * rLim) {
              hit = true;
              break;
            }
          }
        }

        if (hit) {
          safeDist = Math.max(minDist, d - (desiredDist - minDist) / steps - 0.10);
          break;
        }
      }
    }
    return safeDist;
  }

  function followTarget(x = 0, z = 0, dt = 0.016, explicitY) {
    if (cameraMode === 'hub') {
      lockOnTarget = null;
      lockOnReticle.visible = false;
      applyHubCameraPose(dt, false);
      return;
    }

    const clampedDt = Math.min(Math.max(dt || 0.016, 0), 0.1);
    lastHeroX = x;
    lastHeroZ = z;
    const queryY = Number.isFinite(explicitY) ? explicitY : (hasFollowedOnce ? targetY : undefined);
    const groundY = Number.isFinite(explicitY) ? explicitY : getGroundHeight(x, z, queryY);
    const isSouls = isSoulsBiome(currentBiome);

    // Smooth Dark Souls Lock-On Camera Yaw Tracking (shortest angular path, zero 360-deg wraps!)
    if (lockOnTarget && !cameraLocked) {
      const dxLock = x - lockOnTarget.x;
      const dzLock = z - lockOnTarget.z;
      if (dxLock * dxLock + dzLock * dzLock > 0.64) {
        const desiredYaw = Math.atan2(dxLock, dzLock);
        const yawDiff = Math.atan2(
          Math.sin(desiredYaw - orbitTargetYaw),
          Math.cos(desiredYaw - orbitTargetYaw)
        );
        const lockYawStep = 1 - Math.exp(-5.5 * clampedDt);
        orbitTargetYaw += yawDiff * lockYawStep;
      }
      // Keep towering boss & tall knights comfortably framed when locked on in Souls mode (Elden Ring horizon — never blocked by hero helmet!)
      if (isSouls) {
        const pitchNudge = 1 - Math.exp(-5.5 * clampedDt);
        const minLockPitch = lockOnTarget.isBoss ? 0.30 : 0.34;
        const maxLockPitch = lockOnTarget.isBoss ? 0.56 : 0.58;
        if (orbitTargetPitch < minLockPitch) {
          orbitTargetPitch += (minLockPitch - orbitTargetPitch) * pitchNudge;
        } else if (orbitTargetPitch > maxLockPitch) {
          orbitTargetPitch += (maxLockPitch - orbitTargetPitch) * pitchNudge;
        }
      }
    }

    const lockHorizDist = lockOnTarget ? Math.hypot(x - lockOnTarget.x, z - lockOnTarget.z) : 99;
    const closeProximityPull =
      isSouls && lockOnTarget
        ? Math.max(0, 1 - Math.min(1, lockHorizDist / (lockOnTarget.isBoss ? 6.5 : 4.2))) *
          (lockOnTarget.isBoss ? 0.85 : 0.65)
        : 0;

    if (!hasFollowedOnce || !dt || dt <= 0) {
      targetX = x;
      targetY = groundY;
      targetZ = z;
      orbitYaw = orbitTargetYaw;
      orbitPitch = orbitTargetPitch;
      orbitDist = orbitTargetDist;
      soulsLockDistBonus = isSouls && lockOnTarget
        ? (lockOnTarget.isBoss ? SOULS_BOSS_LOCK_DIST_BONUS : 0.45) + closeProximityPull
        : 0;
      soulsCamClipDist = orbitDist + soulsLockDistBonus;
      hasFollowedOnce = true;
    } else {
      const posFactor = isSouls
        ? 1 - Math.exp(-11.5 * clampedDt)
        : 1 - Math.exp(-26 * clampedDt);
      const yFactor = isSouls
        ? 1 - Math.exp(-16 * clampedDt)
        : 1 - Math.exp(-26 * clampedDt);
      targetX += (x - targetX) * posFactor;
      targetY += (groundY - targetY) * yFactor;
      targetZ += (z - targetZ) * posFactor;
      const orbitSmooth = isSouls
        ? 1 - Math.exp(-24 * clampedDt)
        : 1 - Math.exp(-18 * clampedDt);
      const orbitYawDiff = Math.atan2(
        Math.sin(orbitTargetYaw - orbitYaw),
        Math.cos(orbitTargetYaw - orbitYaw)
      );
      orbitYaw += orbitYawDiff * orbitSmooth;
      orbitPitch += (orbitTargetPitch - orbitPitch) * orbitSmooth;
      orbitDist += (orbitTargetDist - orbitDist) * orbitSmooth;

      const wantLockBonus = isSouls && lockOnTarget
        ? (lockOnTarget.isBoss ? SOULS_BOSS_LOCK_DIST_BONUS : 0.45) + closeProximityPull
        : 0;
      soulsLockDistBonus += (wantLockBonus - soulsLockDistBonus) * (1 - Math.exp(-5.5 * clampedDt));
    }

    const lockPivotLift = isSouls && lockOnTarget ? (lockOnTarget.isBoss ? 0.24 : 0.14) : 0;
    const pivotY = isSouls ? targetY + SOULS_CAMERA_PIVOT_Y + lockPivotLift : targetY + 0.85;

    // Smoothly interpolate weighted lookAt offset (Souls boss lock: frames both hero & colossal boss overhead weapon + feet!)
    const lockXzWeight = isSouls && lockOnTarget?.isBoss ? 0.42 : 0.34;
    const lockYWeight = isSouls && lockOnTarget?.isBoss ? 0.48 : 0.38;
    const wantLookOffX = lockOnTarget ? (lockOnTarget.x - targetX) * lockXzWeight : 0;
    const wantLookOffZ = lockOnTarget ? (lockOnTarget.z - targetZ) * lockXzWeight : 0;
    const wantLookOffY = lockOnTarget ? (lockOnTarget.y - pivotY) * lockYWeight : 0;
    const lookSmooth = (!dt || dt <= 0) ? 1 : (1 - Math.exp(-8.5 * clampedDt));
    lockLookOffsetX += (wantLookOffX - lockLookOffsetX) * lookSmooth;
    lockLookOffsetY += (wantLookOffY - lockLookOffsetY) * lookSmooth;
    lockLookOffsetZ += (wantLookOffZ - lockLookOffsetZ) * lookSmooth;

    // Update iconic 3D Lock-On reticle (ZERO floor ring in Soulslike mode — hidden 100% during cutscenes!)
    if (lockOnTarget && !bossEscapeCutsceneActive && !bossDoorCutsceneActive) {
      lockOnPulseTime += clampedDt;
      const spPulse = 1 + Math.sin(lockOnPulseTime * 6.5) * 0.08;
      const spBase = lockOnTarget.isBoss ? 0.56 : 0.40;
      lockOnReticle.visible = true;
      lockOnSprite.position.set(lockOnTarget.x, lockOnTarget.y, lockOnTarget.z);
      lockOnSprite.scale.set(spBase * spPulse, spBase * spPulse, 1);
      if (isSouls) {
        lockOnFootRing.visible = false;
      } else {
        const ringPulse = 1 + Math.sin(lockOnPulseTime * 4.2) * 0.04;
        const targetGroundY = getGroundHeight(lockOnTarget.x, lockOnTarget.z);
        lockOnFootRing.visible = true;
        lockOnFootRing.position.set(lockOnTarget.x, targetGroundY + 0.04, lockOnTarget.z);
        const ringScale = Math.max(0.65, lockOnTarget.radius * 1.15) * ringPulse;
        lockOnFootRing.scale.set(ringScale, ringScale, 1);
        lockOnFootRingMat.opacity = 0.28 + Math.sin(lockOnPulseTime * 4.2) * 0.08;
      }
    } else {
      lockOnReticle.visible = false;
      lockOnFootRing.visible = false;
    }

    combatHeroContactShadow.visible = !(isSouls && (soulsZoneMode === 'shaft_river' || (bossEscapeCutsceneActive && (_escapeCutsceneState?.heroY ?? 0) < -0.45)));
    combatHeroContactShadow.position.set(x, groundY + 0.022, z);

    let sx = 0, sy = 0, sz = 0;
    if (shakeIntensity > 0.002) {
      sx = (Math.sin(shakeTime * 47) + (Math.random() - 0.5) * 0.8) * shakeIntensity * 0.55;
      sy = Math.cos(shakeTime * 53) * shakeIntensity * 0.28;
      sz = (Math.cos(shakeTime * 41) + (Math.random() - 0.5) * 0.8) * shakeIntensity * 0.55;
    }

    const mult = camera.aspect < 0.92 ? 1.15 : 1;
    const baseEffDist = orbitDist * mult;
    let camX, camY, camZ;
    if (isSouls) {
      const desiredDist = baseEffDist + soulsLockDistBonus;
      const cosP = Math.cos(orbitPitch);
      const dirX = Math.sin(orbitYaw) * cosP;
      const dirY = Math.sin(orbitPitch);
      const dirZ = Math.cos(orbitYaw) * cosP;
      const inCastleWalls = soulsZoneMode === 'castle';
      const pillarSafeDist = inCastleWalls
        ? computeSoulsSafeCamDist(targetX, pivotY, targetZ, dirX, dirY, dirZ, desiredDist)
        : desiredDist;
      let safeDist = pillarSafeDist;
      const doorStateNow = soulsArena?.getBossDoorState?.() || 'closed';
      if (inCastleWalls && !bossDoorCutsceneActive && !bossEscapeCutsceneActive) {
        const rawCamX = targetX + dirX * safeDist;
        const rawCamY = Math.max(groundY + 0.52, pivotY + dirY * safeDist);
        const rawCamZ = targetZ + dirZ * safeDist;
        const wallTest = clampCastleCameraPosition(
          targetX, pivotY, targetZ, rawCamX, rawCamY, rawCamZ, doorStateNow, _castleCamClampOpts
        );
        if (wallTest.hitWall) {
          const wallDist = Math.hypot(wallTest.x - targetX, wallTest.y - pivotY, wallTest.z - targetZ);
          if (wallDist < safeDist) safeDist = Math.max(2.6, wallDist);
        }
      }
      const clipSmooth = (!dt || dt <= 0)
        ? 1
        : safeDist < soulsCamClipDist
          ? 1 - Math.exp(-24 * clampedDt)
          : 1 - Math.exp(-7.5 * clampedDt);
      soulsCamClipDist += (safeDist - soulsCamClipDist) * clipSmooth;
      const finalDist = Math.max(2.6, Math.min(desiredDist, soulsCamClipDist));
      camX = targetX + dirX * finalDist;
      camZ = targetZ + dirZ * finalDist;
      const camGroundY = getGroundHeight(camX, camZ);
      const minCamFloorY = Math.max(targetY, groundY, camGroundY) + 0.52;
      camY = Math.max(minCamFloorY, pivotY + dirY * finalDist);

      // Final hard spring-arm clamp so camera never pokes outside castle walls or sealed Boss Gates.
      if (inCastleWalls && !bossDoorCutsceneActive && !bossEscapeCutsceneActive) {
        const sprung = clampCastleCameraPosition(
          targetX, pivotY, targetZ, camX, camY, camZ, doorStateNow, _castleCamClampOpts
        );
        if (sprung.hitWall) {
          camX = sprung.x;
          camY = Math.max(minCamFloorY, sprung.y);
          camZ = sprung.z;
          const sprungDist = Math.hypot(camX - targetX, camY - pivotY, camZ - targetZ);
          if (sprungDist < soulsCamClipDist) soulsCamClipDist = sprungDist;
        }
      }
    } else {
      const horizDist = Math.cos(orbitPitch) * baseEffDist;
      camY = Math.max(targetY + 0.65, targetY + 0.5 + Math.sin(orbitPitch) * baseEffDist);
      camX = targetX + Math.sin(orbitYaw) * horizDist;
      camZ = targetZ + Math.cos(orbitYaw) * horizDist;
    }

    const finalNormCamX = camX + sx;
    const finalNormCamY = Math.max(Math.max(targetY, groundY) + (isSouls ? 0.52 : 0.65), camY + sy);
    const finalNormCamZ = camZ + sz;
    const finalNormLookX = targetX + lockLookOffsetX + sx * 0.35;
    const finalNormLookY = pivotY + lockLookOffsetY;
    const finalNormLookZ = targetZ + lockLookOffsetZ + sz * 0.35;

    _cutsceneNormalPos.set(finalNormCamX, finalNormCamY, finalNormCamZ);
    _cutsceneNormalLook.set(finalNormLookX, finalNormLookY, finalNormLookZ);

    if (bossEscapeCutsceneActive && isSouls && bossEscapeCutsceneRig) {
      const prevSlowMo = Math.max(0.22, Math.min(1.0, Number(_escapeCutsceneState?.slowMoFactor) || 1.0));
      const hitstopScale = (Number(_escapeCutsceneState?.hitstopSec) || 0) > 0.005 ? 0.30 : 1.0;
      bossEscapeCutsceneElapsed += clampedDt * prevSlowMo * hitstopScale;
      const normalFov = getCombatFovForBiome(camera.aspect || 1);
      computeShoreNormalCamPose(0, _escapeShoreNormPos, _escapeShoreNormLook);
      _escapeCutsceneOpts.normalCamPos = _escapeShoreNormPos;
      _escapeCutsceneOpts.normalCamLook = _escapeShoreNormLook;
      _escapeCutsceneOpts.normalFov = normalFov;
      _escapeCutsceneState = sampleBossEscapeCutscene(
        bossEscapeCutsceneRig,
        bossEscapeCutsceneElapsed,
        _escapeCutsceneStateOut,
        _escapeCutsceneOpts
      );
      _escapeCutsceneState.active = !_escapeCutsceneState.finished;
      applyEscapeStageAndChasmFromState(_escapeCutsceneState, false);

      if (_escapeCutsceneState.finished) {
        bossEscapeCutsceneActive = false;
        bossEscapeCutsceneElapsed = BOSS_ESCAPE_CUTSCENE_DURATION;
        bossEscapeLastStageMode = 'exterior_shore';
        bossEscapeChasmEnabled = false;
        bossEscapeGrateBroken = true;
        bossEscapeLastCameraCutId = -1;
        soulsEscapeVfx?.setUnderwaterBubbles?.(false);
        soulsEscapeVfx?.setFallingDebrisStream?.(false);
        soulsEscapeVfx?.setActive?.(false);
        soulsEscapeVfx?.reset?.();
        setSoulsZoneMode('exterior_shore');
        soulsExteriorShore?.setGrateBroken?.(true);
        syncOrbitFromFinalEscapeState(_escapeCutsceneState, normalFov);
      } else {
        const totalShake = Math.max(Number(_escapeCutsceneState.screenShake) || 0, shakeIntensity);
        const sh = computeBossEscapeCameraShakeOffset(
          bossEscapeCutsceneElapsed,
          totalShake,
          _escapeCutsceneShakeOut
        );
        applyEscapeCutsceneCamera(_escapeCutsceneState, sh, normalFov);
      }
    } else if (bossDoorCutsceneActive && isSouls) {
      bossDoorCutsceneElapsed += clampedDt;
      const tEval = bossDoorCutsceneDuration > 0
        ? (bossDoorCutsceneElapsed / bossDoorCutsceneDuration) * BOSS_DOOR_CUTSCENE_DURATION
        : BOSS_DOOR_CUTSCENE_DURATION;
      const normalFov = getCombatFovForBiome(camera.aspect || 1);
      _cutsceneState = evaluateBossDoorCutscene(
        tEval,
        _cutsceneStartPos,
        _cutsceneStartLook,
        _cutsceneNormalPos,
        _cutsceneNormalLook,
        {
          startFov: bossDoorCutsceneStartFov,
          normalFov,
          out: _cutsceneStateOut
        }
      );
      _cutsceneState.active = !_cutsceneState.finished;
      _cutsceneState.elapsed = bossDoorCutsceneElapsed;
      _cutsceneState.duration = bossDoorCutsceneDuration;

      if (_cutsceneState.finished) {
        bossDoorCutsceneActive = false;
        bossDoorCutsceneElapsed = 0;
        if (Math.abs(camera.fov - normalFov) > 0.01) {
          camera.fov = normalFov;
          camera.updateProjectionMatrix();
        }
        camera.position.set(finalNormCamX, finalNormCamY, finalNormCamZ);
        camera.lookAt(finalNormLookX, finalNormLookY, finalNormLookZ);
      } else {
        if (Math.abs(camera.fov - _cutsceneState.fov) > 0.01) {
          camera.fov = _cutsceneState.fov;
          camera.updateProjectionMatrix();
        }
        const sh = computeBossDoorCutsceneShakeOffset(tEval, _cutsceneState.shake, _cutsceneShakeOut);
        camera.position.set(
          _cutsceneState.camPos.x + sh.x,
          _cutsceneState.camPos.y + sh.y,
          _cutsceneState.camPos.z + sh.z
        );
        camera.lookAt(
          _cutsceneState.camLook.x + sh.x * 0.35,
          _cutsceneState.camLook.y + sh.y * 0.35,
          _cutsceneState.camLook.z + sh.z * 0.35
        );
        if (sh.roll) {
          camera.rotateZ(sh.roll);
        }
      }
    } else {
      camera.position.set(finalNormCamX, finalNormCamY, finalNormCamZ);
      camera.lookAt(finalNormLookX, finalNormLookY, finalNormLookZ);
    }
    camera.updateMatrixWorld();

    heroAuraLight.position.set(targetX, targetY + 3.2, targetZ);

    // Exact Orthographic Light-Space Shadow-Map Texel Snapping:
    // Eliminates both 0.5m discrete shadow jumping AND sub-texel shadow swimming on stone columns!
    const isExtShoreLight = isSouls && soulsZoneMode === 'exterior_shore';
    const offX = isExtShoreLight ? 10.5 : (isSouls ? 11.5 : 14.0);
    const offY = isExtShoreLight ? 20.5 : (isSouls ? 22.0 : 28.0);
    const offZ = isExtShoreLight ? 22.0 : (isSouls ? 9.5 : 16.0);
    const invOffLen = 1.0 / Math.hypot(offX, offY, offZ);
    const zCamX = offX * invOffLen;
    const zCamY = offY * invOffLen;
    const zCamZ = offZ * invOffLen;
    // X_cam = normalize((0,1,0) x Z_cam) = normalize(zCamZ, 0, -zCamX)
    const invHorizLen = 1.0 / Math.max(1e-6, Math.hypot(zCamZ, zCamX));
    const xCamX = zCamZ * invHorizLen;
    const xCamZ = -zCamX * invHorizLen;
    // Y_cam = Z_cam x X_cam (with X_cam.y === 0)
    const yCamX = zCamY * xCamZ;
    const yCamY = zCamZ * xCamX - zCamX * xCamZ;
    const yCamZ = -zCamY * xCamX;

    const shadExt = Math.abs(dirLight.shadow.camera.right) || (isSouls ? 12.2 : 21.0);
    const shadRes = Math.max(256, dirLight.shadow.mapSize.width || 1024);
    const texelSize = (2.0 * shadExt) / shadRes;

    const baseTargetY = isExtShoreLight ? targetY : 0;
    const uLight = targetX * xCamX + targetZ * xCamZ;
    const vLight = targetX * yCamX + baseTargetY * yCamY + targetZ * yCamZ;
    const ku = Math.round(uLight / texelSize);
    const kv = Math.round(vLight / texelSize);
    const snapKeyMode = isExtShoreLight ? 2 : (isSouls ? 1 : 0);

    if (ku !== lastDirSnapX || kv !== lastDirSnapZ || snapKeyMode !== lastDirSnapSouls) {
      lastDirSnapX = ku;
      lastDirSnapZ = kv;
      lastDirSnapSouls = snapKeyMode;
      const du = ku * texelSize - uLight;
      const dv = kv * texelSize - vLight;
      const snapX = targetX + du * xCamX + dv * yCamX;
      const snapY = baseTargetY + dv * yCamY;
      const snapZ = targetZ + du * xCamZ + dv * yCamZ;
      dirLight.position.set(snapX + offX, snapY + offY, snapZ + offZ);
      dirLight.target.position.set(snapX, snapY, snapZ);
      dirLight.target.updateMatrixWorld();
    }
  }

  function addScreenShake(amount = 0.3) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    shakeIntensity = Math.min(1.6, shakeIntensity + amount);
  }

  function setBossAtmosphere(active) {
    bossModeActive = Boolean(active);
  }

  const raycaster = new THREE.Raycaster();
  const ndcMouse = new THREE.Vector2();
  const aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.7);
  const aimHit = new THREE.Vector3();

  const _visCheckVec = new THREE.Vector3();
  function isWorldPointVisible(wx, wz, wy = 0.85, ndcMargin = 0.94) {
    _visCheckVec.set(wx, wy, wz).project(camera);
    return (
      _visCheckVec.z >= -1 &&
      _visCheckVec.z <= 1 &&
      Math.abs(_visCheckVec.x) <= ndcMargin &&
      Math.abs(_visCheckVec.y) <= ndcMargin
    );
  }

  function getAimPointOnGround(clientX, clientY) {
    const vp = window.__getGameViewportSize?.();
    const mapped = window.__toGameCoords ? window.__toGameCoords(clientX, clientY) : { x: clientX, y: clientY };
    const w = Math.max(vp?.w || window.innerWidth, 1);
    const h = Math.max(vp?.h || window.innerHeight, 1);

    ndcMouse.x = (mapped.x / w) * 2 - 1;
    ndcMouse.y = -(mapped.y / h) * 2 + 1;

    raycaster.setFromCamera(ndcMouse, camera);
    const hit = raycaster.ray.intersectPlane(aimPlane, aimHit);
    return hit ? { x: aimHit.x, z: aimHit.z } : { x: targetX, z: targetZ };
  }

  const _soulsUpdateOpts = {
    playerX: 0,
    playerZ: 0,
    camX: 0,
    camY: 0,
    camZ: 0,
    cutsceneState: null
  };

  // ==========================================================================
  // Frame Update, Resize, Render & VFX Reset
  // ==========================================================================
  function update(dt = 0.016, elapsedTime) {
    const safeDt = Math.min(Math.max(dt || 0.016, 0), 0.1);
    internalTime += safeDt;
    const t = Number.isFinite(elapsedTime) ? elapsedTime : internalTime;
    const isSouls = cameraMode !== 'hub' && isSoulsBiome(currentBiome);

    if (cameraMode === 'hub') {
      applyHubCameraPose(safeDt, false);
    }

    if (shakeIntensity > 0) {
      shakeTime += safeDt;
      shakeIntensity = Math.max(0, shakeIntensity - safeDt * 3.4);
    }

    const pal = cameraMode === 'hub' ? PALETTE_HUB : getActiveCombatPalette();
    const atmLerp = Math.min(1, safeDt * 2.8);
    if (cameraMode !== 'hub' && scene.background) {
      scene.background.lerp(pal.bg, atmLerp);
    }
    scene.fog.color.lerp(pal.fog, atmLerp);
    if (cameraMode !== 'hub' && isSouls) {
      const targetFog = getCombatFogForBiome(currentBiome, false);
      scene.fog.near += (targetFog.near - scene.fog.near) * atmLerp;
      scene.fog.far += (targetFog.far - scene.fog.far) * atmLerp;
    }
    hemiLight.color.lerp(pal.hemiSky, atmLerp);
    hemiLight.groundColor.lerp(pal.hemiGround, atmLerp);
    dirLight.color.lerp(pal.dir, atmLerp);
    if (!isSouls) {
      plazaRuneMat.color.lerp(pal.plazaRune, atmLerp);
      moteMat.color.lerp(pal.plazaRune, atmLerp);
      plazaRuneMat.opacity = 0.44 + Math.sin(t * 2.5) * 0.12;
      if (motesPoints.visible) {
        motesPoints.position.y = Math.sin(t * 0.9) * 0.28;
        motesPoints.rotation.y = t * 0.03;
      }
    }

    if (!isSouls || activeProjectiles.size > 0) {
      waterProjUniforms.uTime.value = t;
    }

    if (cameraMode === 'hub') {
      hubFlagUniforms.uTime.value = t;
      const hf = 0.88 + Math.sin(t * 7.8) * 0.08 + Math.sin(t * 19.3) * 0.05 + Math.sin(t * 3.1) * 0.04;
      hubCampfireLight.intensity = HUB_CAMPFIRE_BASE_INTENSITY * hf;
      hubLeftFireGlow.material.opacity = 0.34 * hf;
      if (hubArsenalGlowGroup.visible) {
        const gf = 0.92 + Math.sin(t * 3.6) * 0.08;
        arsenalDiscMat.opacity = 0.84 * gf;
        arsenalCoreDiscMat.opacity = 0.56 * gf;
        arsenalMistUniforms.uTime.value = t;
        arsenalMistUniforms.uOpacity.value = 0.34 * gf;
        arsenalForgeLight.intensity = 3.6 * gf;

        const spArr = arsenalSparkGeo.attributes.position.array;
        for (let i = 0; i < ARSENAL_SPARK_COUNT; i++) {
          const idx = i * 3;
          const spd = arsenalSparkSeeds[i * 2];
          const ph = arsenalSparkSeeds[i * 2 + 1];
          spArr[idx + 1] += spd * safeDt;
          spArr[idx] += Math.sin(t * 2.4 + ph) * 0.14 * safeDt;
          if (spArr[idx + 1] > 1.42) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * 0.65;
            spArr[idx] = Math.cos(a) * r;
            spArr[idx + 1] = 0.04;
            spArr[idx + 2] = 0.06 + Math.sin(a) * r * 0.65;
          }
        }
        arsenalSparkGeo.attributes.position.needsUpdate = true;
      }

      const lArr = hubLeftAshGeo.attributes.position.array;
      for (let i = 0; i < HUB_LEFT_ASH_COUNT; i++) {
        const idx = i * 3;
        const spd = hubLeftAshSeeds[idx];
        const ph = hubLeftAshSeeds[idx + 1];
        const drift = hubLeftAshSeeds[idx + 2];
        lArr[idx + 1] += spd * safeDt;
        lArr[idx] += (0.14 + Math.sin(t * 2.5 + ph) * drift) * safeDt;
        if (lArr[idx + 1] > 2.55) {
          lArr[idx] = -2.65 + (Math.random() - 0.5) * 1.1;
          lArr[idx + 1] = -0.06;
          lArr[idx + 2] = 0.35 + (Math.random() - 0.5) * 1.05;
        }
      }
      hubLeftAshGeo.attributes.position.needsUpdate = true;

      const eArr = hubEmberGeo.attributes.position.array;
      for (let i = 0; i < HUB_EMBER_COUNT; i++) {
        const idx = i * 3;
        const spd = hubEmberSeeds[idx];
        const ph = hubEmberSeeds[idx + 1];
        const drift = hubEmberSeeds[idx + 2];
        eArr[idx + 1] += spd * safeDt;
        eArr[idx] += Math.sin(t * 1.8 + ph) * drift * safeDt;
        if (eArr[idx + 1] > 3.8) {
          eArr[idx + 1] = -0.15;
          eArr[idx] = (Math.random() - 0.5) * 8.2;
          eArr[idx + 2] = -2.8 + Math.random() * 5.2;
        }
      }
      hubEmberGeo.attributes.position.needsUpdate = true;

      // Foreground embers drifting upward and swirling behind & in front of the hero
      const fgArr = hubFgEmberGeo.attributes.position.array;
      for (let i = 0; i < HUB_FG_EMBER_COUNT; i++) {
        const pIdx = i * 3;
        const sIdx = i * 4;
        const spd = hubFgEmberSeeds[sIdx];
        const ph = hubFgEmberSeeds[sIdx + 1];
        const ampX = hubFgEmberSeeds[sIdx + 2];
        const ampZ = hubFgEmberSeeds[sIdx + 3];
        fgArr[pIdx + 1] += spd * safeDt;
        fgArr[pIdx] += (0.06 + Math.sin(t * 1.65 + ph) * ampX) * safeDt;
        fgArr[pIdx + 2] += Math.cos(t * 1.35 + ph * 1.3) * ampZ * safeDt;
        if (fgArr[pIdx + 1] > 2.8) {
          fgArr[pIdx] = (Math.random() - 0.5) * 4.8;
          fgArr[pIdx + 1] = 0.05;
          fgArr[pIdx + 2] = i % 2 === 0 ? (0.25 + Math.random() * 1.35) : (-1.2 + Math.random() * 2.8);
        }
      }
      hubFgEmberGeo.attributes.position.needsUpdate = true;

      // Subtle twilight mist wisps drifting slowly across the hero's boots & pedestal front lip
      if (hubAnkleMistGroup.visible) {
        for (let i = 0; i < hubAnkleMistSprites.length; i++) {
          const m = hubAnkleMistSprites[i];
          m.sprite.position.x = m.x + Math.sin(t * m.spd + m.ph) * m.ampX;
          m.sprite.position.y = HUB_PEDESTAL_TOP_Y + m.y + Math.sin(t * (m.spd * 0.75) + m.ph) * 0.035;
          m.mat.opacity = m.op * (0.82 + 0.18 * Math.sin(t * 0.65 + m.ph));
        }
      }
    }

    // Flickering courtyard fires, rune lights & adaptive pseudo-bloom halos (skip cleanly in souls_citadel)
    if (!isSouls && courtyardPropsGroup.visible) {
      const bloomScale = getBloomIntensityScale();
      for (let i = 0; i < lanterns.length; i++) {
        const l = lanterns[i];
        if (l.parentGrp && !l.parentGrp.visible) continue;
        const flicker = 0.88 + Math.sin(t * 9.5 + l.phase) * 0.08 + Math.sin(t * 23.0 + l.phase * 2.1) * 0.05;
        if (l.pointLight) l.pointLight.intensity = l.baseIntensity * flicker;
        if (l.bloomSprite && l.bloomMat) {
          const bs = l.baseBloomScale * (0.94 + (flicker - 0.88) * 0.65);
          l.bloomSprite.scale.set(bs, bs, 1);
          l.bloomMat.opacity = l.baseBloomOpacity * bloomScale * (0.86 + (flicker - 0.88) * 1.1);
        }
        if (l.flameGrp) {
          l.flameGrp.children.forEach((ch, idx) => {
            if (idx >= 3) ch.scale.y = flicker;
          });
        }
      }
    }

    // Animate Chapter 26 Dark Souls castle bonfire, braziers, fog wall, dynamic light pool, roof, cutscene doors & Phase-2 fire ring
    if (isSouls) {
      const cutSlowMo = bossEscapeCutsceneActive
        ? Math.max(0.22, Math.min(1.0, Number(_escapeCutsceneState?.slowMoFactor) || 1.0))
        : 1.0;
      const soulsAnimDt = safeDt * cutSlowMo;
      if (soulsArena && soulsArena.group?.visible) {
        _soulsUpdateOpts.playerX = lastHeroX;
        _soulsUpdateOpts.playerZ = lastHeroZ;
        _soulsUpdateOpts.camX = camera.position.x;
        _soulsUpdateOpts.camY = camera.position.y;
        _soulsUpdateOpts.camZ = camera.position.z;
        _soulsUpdateOpts.cutsceneState = isBossDoorCutsceneActive() ? _cutsceneState : null;
        soulsArena.update(soulsAnimDt, t, _soulsUpdateOpts);
        if (phase2ArenaFireRingCtrl && phase2ArenaFireRingCtrl.isActive?.()) {
          phase2ArenaFireRingCtrl.update(soulsAnimDt, t);
        }
      }
      if (soulsExteriorShore && (soulsZoneMode !== 'castle' || bossEscapeCutsceneActive)) {
        soulsExteriorShore.update(soulsAnimDt, t, {
          camY: camera.position.y,
          camPos: camera.position,
          camera,
          playerX: lastHeroX,
          playerZ: lastHeroZ
        });
      }
      if (soulsEscapeVfx && bossEscapeCutsceneActive && _escapeCutsceneState) {
        syncEscapeVfxStreams(_escapeCutsceneState);
        soulsEscapeVfx.update(soulsAnimDt, t, _escapeCutsceneState);
      }
    } else if (cameraMode !== 'hub' && isMistyBiome(currentBiome) && mistyArena?.isLoaded()) {
      // Animate Misty Forest / Frost Ruins / Ash Citadel mist, glowing portal sigil, campfire & lanterns
      mistyArena.update(safeDt, t);
    }

    // PvE weather loops (Frost Ruins snow & Ash Citadel embers): skip completely in souls_citadel!
    if (!isSouls) {
      // Chapters 16–20 (Frost Ruins): falling snowflakes & glacial ice crystals
      if (frostSnowPoints.visible) {
        const activeCount = lowSpecMode ? Math.round(FROST_SNOW_MAX * 0.5) : FROST_SNOW_MAX;
        const arr = frostSnowGeo.attributes.position.array;
        const halfSpan = B + 2;
        for (let i = 0; i < activeCount; i++) {
          const pIdx = i * 3;
          const sIdx = i * 4;
          const fallSpd = frostSnowSeeds[sIdx];
          const swayAmp = frostSnowSeeds[sIdx + 1];
          const ph = frostSnowSeeds[sIdx + 2];
          const wind = frostSnowSeeds[sIdx + 3];
          arr[pIdx] += (wind * 0.48 + Math.sin(t * 1.35 + ph) * swayAmp) * safeDt;
          arr[pIdx + 1] -= fallSpd * safeDt;
          arr[pIdx + 2] += (wind * 0.32 + Math.cos(t * 1.12 + ph * 1.3) * swayAmp * 0.85) * safeDt;
          if (arr[pIdx + 1] < 0.08) {
            arr[pIdx] = targetX + (Math.random() - 0.5) * (arenaSpan + 4);
            arr[pIdx + 1] = 10.8 + Math.random() * 2.8;
            arr[pIdx + 2] = targetZ + (Math.random() - 0.5) * (arenaSpan + 4);
          } else {
            if (arr[pIdx] > targetX + halfSpan) arr[pIdx] -= arenaSpan + 4;
            else if (arr[pIdx] < targetX - halfSpan) arr[pIdx] += arenaSpan + 4;
            if (arr[pIdx + 2] > targetZ + halfSpan) arr[pIdx + 2] -= arenaSpan + 4;
            else if (arr[pIdx + 2] < targetZ - halfSpan) arr[pIdx + 2] += arenaSpan + 4;
          }
        }
        frostSnowGeo.attributes.position.needsUpdate = true;
      }

      // Chapters 21–25 (Ash Citadel): rising volcanic ash & glowing lava sparks
      if (ashEmberPoints.visible) {
        const activeCount = lowSpecMode ? Math.round(ASH_EMBER_MAX * 0.5) : ASH_EMBER_MAX;
        const arr = ashEmberGeo.attributes.position.array;
        const halfSpan = B + 2;
        for (let i = 0; i < activeCount; i++) {
          const pIdx = i * 3;
          const sIdx = i * 4;
          const riseSpd = ashEmberSeeds[sIdx];
          const swirlAmp = ashEmberSeeds[sIdx + 1];
          const ph = ashEmberSeeds[sIdx + 2];
          const gust = ashEmberSeeds[sIdx + 3];
          arr[pIdx] += (gust + Math.sin(t * 2.4 + ph) * swirlAmp) * safeDt;
          arr[pIdx + 1] += riseSpd * safeDt;
          arr[pIdx + 2] += (gust * 0.6 + Math.cos(t * 2.0 + ph * 1.4) * swirlAmp) * safeDt;
          if (arr[pIdx + 1] > 11.4) {
            arr[pIdx] = targetX + (Math.random() - 0.5) * (arenaSpan + 4);
            arr[pIdx + 1] = 0.08 + Math.random() * 0.65;
            arr[pIdx + 2] = targetZ + (Math.random() - 0.5) * (arenaSpan + 4);
          } else {
            if (arr[pIdx] > targetX + halfSpan) arr[pIdx] -= arenaSpan + 4;
            else if (arr[pIdx] < targetX - halfSpan) arr[pIdx] += arenaSpan + 4;
            if (arr[pIdx + 2] > targetZ + halfSpan) arr[pIdx + 2] -= arenaSpan + 4;
            else if (arr[pIdx + 2] < targetZ - halfSpan) arr[pIdx + 2] += arenaSpan + 4;
          }
        }
        ashEmberGeo.attributes.position.needsUpdate = true;
      }
    }

    // Animate active projectiles (spin arcane crystals, align tracer tails to velocity & emit comet sparks!)
    for (const proj of activeProjectiles) {
      const m = proj.mesh;
      if (proj.prevX !== null) {
        const dx = m.position.x - proj.prevX;
        const dz = m.position.z - proj.prevZ;
        if (dx * dx + dz * dz > 0.00005) {
          m.rotation.y = Math.atan2(dx, dz);
        }
      }
      proj.prevX = m.position.x;
      proj.prevZ = m.position.z;

      if (proj.spinCore) {
        if (proj.visualKind === 'magic_water') {
          proj.spinCore.rotation.z += safeDt * 11;
        } else if (proj.visualKind !== 'magic_air') {
          proj.spinCore.rotation.z += safeDt * 14;
          proj.spinCore.rotation.x += safeDt * 9;
        }
      }
      if (proj.orbitRingA) {
        if (proj.visualKind === 'magic_fire') {
          proj.orbitRingA.rotation.z += safeDt * 18;
        } else if (proj.visualKind === 'magic_water') {
          proj.orbitRingA.rotation.z -= safeDt * 20;
        } else if (proj.visualKind === 'magic_lightning') {
          proj.orbitRingA.rotation.z += safeDt * 34;
          proj.orbitRingA.rotation.x = Math.sin(t * 45) * 0.35;
        } else {
          proj.orbitRingA.rotation.x += safeDt * 12;
          proj.orbitRingA.rotation.y += safeDt * 8;
        }
      }
      if (proj.orbitRingB) {
        if (proj.visualKind === 'magic_air') {
          proj.orbitRingB.rotation.y += safeDt * 24;
        } else {
          proj.orbitRingB.rotation.z -= safeDt * 13;
        }
      }
      if (proj.isMagic) {
        proj.trailAccum += safeDt;
        if (proj.trailAccum >= 0.018) {
          proj.trailAccum = 0;
          let tColor = proj.color;
          let tCount = 3;
          let tSpeed = 2.4;
          let tSize = 0.14;
          let tGrav = -2.2;
          if (proj.visualKind === 'magic_fire') {
            tColor = Math.random() < 0.45 ? 0xfef08a : 0xff5722;
            tCount = 4;
            tSpeed = 2.8;
            tSize = 0.16;
            tGrav = -3.4;
          } else if (proj.visualKind === 'magic_water') {
            tColor = Math.random() < 0.4 ? 0xe0f2fe : 0x38bdf8;
            tCount = 2;
            tSpeed = 1.4;
            tSize = 0.045;
            tGrav = 4.5;
          } else if (proj.visualKind === 'magic_lightning') {
            tColor = Math.random() < 0.5 ? 0xfef08a : 0x38bdf8;
            tCount = 3;
            tSpeed = 3.8;
            tSize = 0.12;
            tGrav = 0;
          } else if (proj.visualKind === 'magic_air') {
            tColor = Math.random() < 0.5 ? 0xf8fafc : 0x5eead4;
            tCount = 3;
            tSpeed = 3.2;
            tSize = 0.13;
            tGrav = -1.2;
          }
          spawnParticles({
            x: m.position.x,
            y: m.position.y,
            z: m.position.z,
            color: tColor,
            count: tCount,
            speed: tSpeed,
            size: tSize,
            life: 0.28,
            gravity: tGrav
          });
        }
      }
    }

    // Update Muzzle Flashes
    for (let i = activeMuzzleFlashes.length - 1; i >= 0; i--) {
      const mf = activeMuzzleFlashes[i];
      mf.age += safeDt;
      if (mf.age >= mf.duration) {
        mf.group.visible = false;
        activeMuzzleFlashes.splice(i, 1);
        freeMuzzleFlashes.push(mf);
        continue;
      }
      const p = 1 - mf.age / mf.duration;
      mf.coreMat.opacity = p;
      mf.outerMat.opacity = p * 0.9;
      mf.spriteMat.opacity = p * 0.85;
      mf.group.scale.setScalar(mf.baseScale * (0.75 + p * 0.45));
    }

    // Update Gunpowder Smoke Puffs
    for (let i = activeGunSmokes.length - 1; i >= 0; i--) {
      const sm = activeGunSmokes[i];
      sm.age += safeDt;
      if (sm.age >= sm.duration) {
        sm.sprite.visible = false;
        activeGunSmokes.splice(i, 1);
        freeGunSmokes.push(sm);
        continue;
      }
      const t = sm.age / sm.duration;
      sm.sprite.position.x += sm.vx * safeDt;
      sm.sprite.position.y += sm.vy * safeDt;
      sm.sprite.position.z += sm.vz * safeDt;
      sm.vx *= Math.max(0, 1 - safeDt * 4.2);
      sm.vz *= Math.max(0, 1 - safeDt * 4.2);
      const curScale = sm.startScale + (sm.endScale - sm.startScale) * Math.pow(t, 0.65);
      sm.sprite.scale.set(curScale, curScale, 1);
      sm.mat.opacity = (1 - t) * (1 - t) * 0.44;
    }

    // Update Pooled Instanced Particles (0 CPU/GPU cost when idle!)
    if (activeParticleCount > 0) {
      let anyParticleChanged = false;
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const p = particles[i];
        if (!p.active) continue;
        anyParticleChanged = true;

        p.age += safeDt;
        if (p.age >= p.life) {
          p.active = false;
          activeParticleCount -= 1;
          particleMesh.setMatrixAt(i, zeroMatrix);
          continue;
        }

        p.vy -= p.gravity * safeDt;
        p.x += p.vx * safeDt;
        p.y += p.vy * safeDt;
        p.z += p.vz * safeDt;

        const floorY = p.size * 0.5;
        if (p.gravity > 0 && p.y < floorY) {
          p.y = floorY;
          p.vy = Math.abs(p.vy) * 0.34;
          p.vx *= 0.72;
          p.vz *= 0.72;
        }

        p.rx += p.vrx * safeDt;
        p.ry += p.vry * safeDt;

        const lifeLeft = 1 - p.age / p.life;
        const scaleFactor = lifeLeft < 0.4 ? lifeLeft / 0.4 : 1.0;
        const s = p.size * scaleFactor;

        pDummy.position.set(p.x, p.y, p.z);
        pDummy.rotation.set(p.rx, p.ry, p.rz);
        pDummy.scale.set(s, s, s);
        pDummy.updateMatrix();
        particleMesh.setMatrixAt(i, pDummy.matrix);
      }
      if (anyParticleChanged) {
        particleMesh.instanceMatrix.needsUpdate = true;
      }
      if (activeParticleCount <= 0) {
        activeParticleCount = 0;
        particleMesh.visible = false;
      }
    }

    // Update Ejected Brass Shell Casings
    for (let i = activeShellCasings.length - 1; i >= 0; i--) {
      const sc = activeShellCasings[i];
      sc.age += safeDt;
      if (sc.age >= sc.duration) {
        sc.mesh.visible = false;
        activeShellCasings.splice(i, 1);
        freeShellCasings.push(sc);
        continue;
      }
      sc.vy -= 14.5 * safeDt;
      sc.mesh.position.x += sc.vx * safeDt;
      sc.mesh.position.y += sc.vy * safeDt;
      sc.mesh.position.z += sc.vz * safeDt;
      if (sc.mesh.position.y < 0.03) {
        sc.mesh.position.y = 0.03;
        sc.vy = Math.abs(sc.vy) * 0.42;
        sc.vx *= 0.65;
        sc.vz *= 0.65;
      }
      sc.mesh.rotation.x += sc.vrx * safeDt;
      sc.mesh.rotation.y += sc.vry * safeDt;
      sc.mesh.rotation.z += sc.vrz * safeDt;
      const rem = 1 - sc.age / sc.duration;
      if (rem < 0.25) sc.mesh.scale.setScalar(rem / 0.25);
    }

    // Update Slash Arcs
    for (let i = activeSlashArcs.length - 1; i >= 0; i--) {
      const sa = activeSlashArcs[i];
      sa.age += safeDt;
      if (sa.age >= sa.duration) {
        sa.group.visible = false;
        let bucket = freeSlashArcsByArc.get(sa.arcKey);
        if (!bucket) {
          bucket = [];
          freeSlashArcsByArc.set(sa.arcKey, bucket);
        }
        bucket.push(sa);
        activeSlashArcs.splice(i, 1);
        continue;
      }
      const p = sa.age / sa.duration;
      const easeOut = 1 - (1 - p) * (1 - p);
      const expand = sa.radius * (0.68 + 0.18 * easeOut);
      sa.group.scale.set(expand, 1, expand);
      if (sa.sweepRad) {
        sa.group.rotation.y = sa.baseAngle + (easeOut - 0.5) * sa.sweepRad;
      }
      sa.mainMat.opacity = (1 - p) * 0.56;
      sa.edgeMat.opacity = (1 - p) * (1 - p) * 0.68;
    }

    // Update Shockwave Rings
    for (let i = activeShockwaves.length - 1; i >= 0; i--) {
      const sw = activeShockwaves[i];
      sw.age += safeDt;
      if (sw.age >= sw.duration) {
        sw.group.visible = false;
        activeShockwaves.splice(i, 1);
        freeShockwaves.push(sw);
        continue;
      }
      const p = sw.age / sw.duration;
      const easeOut = 1 - (1 - p) * (1 - p);
      const curR = sw.radius * (0.18 + 0.82 * easeOut);
      sw.group.scale.set(curR, 1, curR);
      if (sw.ringMat?.uniforms) {
        sw.ringMat.uniforms.uOpacity.value = (1 - p) * (1 - p * 0.35) * 0.72;
        sw.ringMat.uniforms.uProgress.value = p;
      } else {
        sw.ringMat.opacity = (1 - p) * 0.95;
        if (sw.fillMat) sw.fillMat.opacity = (1 - p) * 0.42;
      }
    }

    // Update 3D Shattered Cathedral Stone Craters, 3x Volumetric Fire Field & Fire Road + Pooled Ground Light
    let burnLightWeightSum = 0;
    let burnLightWx = 0;
    let burnLightWy = 0;
    let burnLightWz = 0;
    let burnLightPeak = 0;
    let burnLightMaxR = 4.0;
    let anyBurningZone = false;
    const emberInterval = lowSpecMode ? 0.22 : (isMobileDevice ? 0.14 : 0.085);

    for (let i = activeGroundFractures.length - 1; i >= 0; i--) {
      const gf = activeGroundFractures[i];
      gf.age += safeDt;
      if (gf.age >= gf.duration) {
        if (gf.fireField?.group) gf.fireField.group.visible = false;
        if (gf.fireRoad?.group) gf.fireRoad.group.visible = false;
        gf.group.visible = false;
        activeGroundFractures.splice(i, 1);
        freeGroundFractures.push(gf);
        continue;
      }
      const u = gf.age / gf.duration;
      const remSec = Math.max(0, gf.duration - gf.age);
      const isFissure = gf.kind === 'fissure';

      // Decay any stuck-hammer extraction tug impulse smoothly
      if (gf.wrenchImpulse > 0) {
        gf.wrenchImpulse = Math.max(0, gf.wrenchImpulse - safeDt * 5.4);
      }

      // Violent upward stone shock-heave in 0.065s (1.28x overshoot) -> elastic settle by 0.19s -> smooth sink at end!
      let heaveFactor;
      if (gf.age < 0.065) {
        const pIn = gf.age / 0.065;
        heaveFactor = (1 - (1 - pIn) * (1 - pIn)) * 1.28;
      } else if (gf.age < 0.19) {
        const pSettle = (gf.age - 0.065) / 0.125;
        heaveFactor = 1.28 - 0.28 * (pSettle * pSettle * (3 - 2 * pSettle));
      } else {
        heaveFactor = 1.0;
      }

      // Fast sunken collapse of central warhammer funnel (0 -> 1 in 0.055s)
      const collapseIn = gf.age < 0.055 ? (0.35 + 0.65 * (gf.age / 0.055)) : 1.0;

      let healSmooth;
      if (gf.burning) {
        const extWin = Math.min(0.45, gf.duration * 0.35);
        const ext01 = remSec < extWin ? remSec / Math.max(0.05, extWin) : 1.0;
        healSmooth = ext01 * ext01 * (3 - 2 * ext01);
      } else {
        const healOut = u > 0.76 ? 1 - (u - 0.76) / 0.24 : 1.0;
        healSmooth = healOut * healOut * (3 - 2 * healOut);
      }

      const wrenchJolt = gf.wrenchImpulse > 0
        ? Math.sin(gf.wrenchImpulse * 9.5) * 0.16 * gf.wrenchImpulse + gf.wrenchImpulse * 0.22
        : 0;
      const amp = (heaveFactor + wrenchJolt) * healSmooth;

      const cu = gf.craterMat.uniforms;
      cu.uOpacity.value = healSmooth;
      cu.uCollapse.value = collapseIn * healSmooth;
      cu.uHeave.value = amp;
      cu.uTime.value = gf.age;
      cu.uWrenchPulse.value = Math.min(1.5, gf.wrenchImpulse);

      // Animate REAL physically recessed 3D Stencil Pit & sunken pit boulders!
      if (gf.pitGroup) {
        if (!isFissure && healSmooth > 0.03) {
          gf.pitGroup.visible = true;
          // Hold full aperture until the final 25% heal-out, then smoothly collapse aperture & depth back to floor
          const pitOpen01 = healSmooth > 0.25 ? 1.0 : healSmooth / 0.25;
          const pitEase = pitOpen01 * pitOpen01 * (3.0 - 2.0 * pitOpen01);
          const pitR = gf.radius * (0.25 + 0.75 * pitEase);
          const pitDepthNow = (gf.pitDepth || 1.05) * collapseIn * pitEase;
          gf.pitStencilMask.scale.set(pitR, 1, pitR);
          gf.pitDepthClear.scale.set(pitR, 1, pitR);
          gf.pitBowlMesh.scale.set(pitR, Math.max(0.02, pitDepthNow), pitR);
          gf.pitBowlMat.uniforms.uTime.value = gf.age;
          gf.pitBowlMat.uniforms.uMolten.value = gf.molten ? cu.uMolten.value : 0.0;
          gf.pitBowlMat.uniforms.uGroundY.value = gf.groundY || 0;
          const pitRockJitter = gf.wrenchImpulse > 0 ? Math.sin(gf.age * 55.0 + gf.seed) * 0.022 * gf.wrenchImpulse : 0;
          for (let ri = 0; ri < gf.pitInnerRocks.length; ri++) {
            const ir = gf.pitInnerRocks[ri];
            if (!ir.mesh.visible) continue;
            ir.mesh.position.set(
              ir.dirX * pitR,
              ir.baseDepthY * pitDepthNow + pitRockJitter * ((ri % 2) * 2 - 1),
              ir.dirZ * pitR
            );
          }
        } else {
          gf.pitGroup.visible = false;
        }
      }

      if (gf.molten) {
        const fireDur = isFissure ? gf.duration : (gf.fireDuration || Math.min(gf.duration, 1.0));
        const fireActiveNow = gf.age < fireDur;

        if (!isFissure) {
          if (gf.fireField?.group) {
            if (fireActiveNow) {
              const life01 = Math.min(1.0, gf.age / Math.max(0.05, fireDur));
              gf.fireField.group.visible = true;
              gf.fireField.update?.(gf, gf.age, life01, 1.0);
            } else {
              gf.fireField.group.visible = false;
            }
          }
          if (gf.fireRoad?.group) gf.fireRoad.group.visible = false;
        } else {
          if (gf.fireRoad?.group) {
            const life01 = Math.min(1.0, gf.age / Math.max(0.05, fireDur));
            gf.fireRoad.group.visible = true;
            gf.fireRoad.update?.(gf, gf.age, life01, 1.0);
          }
          if (gf.fireField?.group) gf.fireField.group.visible = false;
        }

        if (fireActiveNow) {
          anyBurningZone = true;
          const fireLife01 = Math.min(1.0, gf.age / Math.max(0.05, fireDur));
          const ignite01 = Math.min(1.0, fireLife01 / 0.15);
          const burnDown01 = fireLife01 > 0.65 ? Math.max(0.0, (1.0 - fireLife01) / 0.35) : 1.0;
          const fireEnv = ignite01 * (burnDown01 * burnDown01 * (3 - 2 * burnDown01));
          cu.uMolten.value = Math.max(0.28 * healSmooth, fireEnv);

          // Supplemental rising dynamic ember shards in world particle pool
          gf.emberTick += safeDt;
          if (gf.emberTick >= emberInterval && fireLife01 < 0.76) {
            gf.emberTick = 0;
            let ex;
            let ez;
            if (isFissure) {
              const along = (Math.random() - 0.5) * gf.radius * 1.85;
              const lat = (Math.random() - 0.5) * gf.radius * 0.85;
              ex = gf.x + gf.dirX * along - gf.dirZ * lat;
              ez = gf.z + gf.dirZ * along + gf.dirX * lat;
            } else {
              const ang = Math.random() * Math.PI * 2;
              const rPick = Math.random() < 0.68
                ? gf.radius * (0.72 + Math.random() * 0.20)
                : gf.radius * Math.sqrt(Math.random()) * 0.72;
              ex = gf.x + Math.cos(ang) * rPick;
              ez = gf.z + Math.sin(ang) * rPick;
            }
            const sparkCol = Math.random() < 0.38 ? 0xfef08a : (Math.random() < 0.65 ? 0xf97316 : 0xea580c);
            spawnParticles({
              x: ex,
              y: gf.groundY + 0.16 + Math.random() * 0.25,
              z: ez,
              color: sparkCol,
              count: lowSpecMode ? 1 : 2,
              speed: 1.85 + Math.random() * 1.25,
              size: 0.11,
              life: 0.42 + Math.random() * 0.20,
              gravity: -4.4
            });
          }

          // Warm floor light pulse weighted toward nearest active fire zone
          const distToHero = Math.hypot(gf.x - lastHeroX, gf.z - lastHeroZ);
          const proxW = 1 / (1 + distToHero * 0.18);
          const w = fireEnv * proxW;
          burnLightWeightSum += w;
          burnLightWx += gf.x * w;
          burnLightWy += (gf.groundY + 0.65) * w;
          burnLightWz += gf.z * w;
          if (fireEnv > burnLightPeak) burnLightPeak = fireEnv;
          if (gf.radius > burnLightMaxR) burnLightMaxR = gf.radius;
        } else {
          cu.uMolten.value = 0.28 * healSmooth;
        }
        if (gf.pitBowlMat?.uniforms) {
          gf.pitBowlMat.uniforms.uMolten.value = cu.uMolten.value;
        }
      }

      const tremor = (gf.burning ? Math.sin(gf.age * 24.0 + gf.seed) * 0.007 : 0) +
        (gf.wrenchImpulse > 0 ? Math.sin(gf.age * 52.0 + gf.seed) * 0.014 * gf.wrenchImpulse : 0);
      for (let k = 0; k < gf.slabs.length; k++) {
        const sl = gf.slabs[k];
        if (!sl.mesh.visible) continue;
        const wrenchSlabBoost = sl.tier <= 1 ? wrenchJolt * 0.035 : 0;
        sl.mesh.position.y =
          -0.062 * (1 - Math.min(1, healSmooth)) +
          sl.maxLiftY * amp +
          wrenchSlabBoost +
          tremor * ((k % 2) * 2 - 1) * healSmooth;
        sl.mesh.rotation.x = sl.tiltPitch * amp;
        sl.mesh.rotation.z = sl.tiltRoll * amp;
      }
    }

    // Blend Phase-2 Arena Perimeter Fire Awakening light hint if active (0 extra PointLights -> 0 shader recompile!)
    if (isSouls && phase2ArenaFireRingCtrl && phase2ArenaFireRingCtrl.isActive?.()) {
      const ringHint = phase2ArenaFireRingCtrl.getLightHint?.();
      const hintInt = Number(ringHint?.intensity) || 0;
      if (hintInt > 0.01) {
        const hw = Math.min(1.25, hintInt * 0.35);
        const hx = Number.isFinite(ringHint.x) ? ringHint.x : 0;
        const hy = Number.isFinite(ringHint.y) ? ringHint.y : 0.75;
        const hz = Number.isFinite(ringHint.z) ? ringHint.z : -44;
        burnLightWeightSum += hw;
        burnLightWx += hx * hw;
        burnLightWy += hy * hw;
        burnLightWz += hz * hw;
        anyBurningZone = true;
        const normHintPeak = Math.min(1.15, hintInt * 0.32);
        if (normHintPeak > burnLightPeak) burnLightPeak = normHintPeak;
        const hr = Number(ringHint.radius) || 6.5;
        if (hr > burnLightMaxR) burnLightMaxR = hr;
      }
    }

    // Dynamic closest-campfire 3D warm firelight tracking across the Exterior Shore & Extended Gorge Road
    // (reuses permanent `burningGroundLight` — ZERO extra PointLights & ZERO shader recompiles!)
    if (!lowSpecMode && cameraMode !== 'hub' && isSouls && soulsZoneMode === 'exterior_shore' && !bossEscapeCutsceneActive) {
      const hearths = soulsExteriorShore?.getActiveFireSources?.() || null;
      let bestH = null;
      let bestScore = 0;
      if (hearths && hearths.length) {
        for (let hi = 0; hi < hearths.length; hi++) {
          const fh = hearths[hi];
          const maxR = Number(fh.radius) || 17.0;
          const dy = ((Number(fh.y) || 1.5) - (targetY + 1.2)) * 1.15;
          const dist = Math.hypot(lastHeroX - fh.x, dy, lastHeroZ - fh.z);
          if (dist >= maxR * 1.35) continue;
          const prox = Math.max(0, 1.0 - dist / (maxR * 1.35));
          const score = prox * (Number(fh.lightIntensity) || 8.0);
          if (score > bestScore) {
            bestScore = score;
            bestH = fh;
          }
        }
      }
      if (bestH) {
        burningGroundLight.color.setHex(0xff8c2b);
        burningGroundLight.position.set(bestH.x, Number.isFinite(bestH.y) ? bestH.y : 1.85, bestH.z);
        burningGroundLight.distance = 24.0;
        burningGroundLight.decay = 1.55;
        const flicker = 0.88 + 0.08 * Math.sin(t * 14.3) + 0.04 * Math.cos(t * 25.1);
        burningGroundLight.intensity = (Number(bestH.lightIntensity) || 9.0) * flicker;
      } else if (burningGroundLight.intensity !== 0) {
        burningGroundLight.intensity = 0;
      }
    } else if (!lowSpecMode && cameraMode !== 'hub' && burnLightWeightSum > 0.001 && burnLightPeak > 0.01) {
      const invW = 1 / burnLightWeightSum;
      burningGroundLight.position.set(burnLightWx * invW, burnLightWy * invW, burnLightWz * invW);
      burningGroundLight.distance = Math.max(9.5, Math.min(19.5, burnLightMaxR * 2.65));
      const flicker = 0.85 + 0.09 * Math.sin(t * 17.3) + 0.06 * Math.cos(t * 29.7);
      burningGroundLight.intensity = burnLightPeak * (anyBurningZone ? 3.85 : 1.55) * flicker;
    } else if (burningGroundLight.intensity !== 0) {
      burningGroundLight.intensity = 0;
    }

    // Update Pooled Soft Dark-Stone Floor Dust Puffs
    for (let i = activeStoneDustPuffs.length - 1; i >= 0; i--) {
      const dp = activeStoneDustPuffs[i];
      dp.age += safeDt;
      if (dp.age >= dp.duration) {
        dp.sprite.visible = false;
        activeStoneDustPuffs.splice(i, 1);
        freeStoneDustPuffs.push(dp);
        continue;
      }
      const p = dp.age / dp.duration;
      const drag = Math.max(0, 1 - safeDt * 3.8);
      dp.vx *= drag;
      dp.vz *= drag;
      dp.vy *= Math.max(0, 1 - safeDt * 2.2);
      dp.x += dp.vx * safeDt;
      dp.y += dp.vy * safeDt;
      dp.z += dp.vz * safeDt;

      const ease = 1 - (1 - p) * (1 - p);
      const sc = dp.startScale + (dp.endScale - dp.startScale) * ease;
      const fadeIn = p < 0.16 ? p / 0.16 : 1.0;
      const fadeOut = (1 - p) * (1 - p * 0.45);
      dp.sprite.position.set(dp.x, dp.y, dp.z);
      dp.sprite.scale.set(sc, sc * 0.66, 1);
      dp.mat.opacity = dp.baseOpacity * fadeIn * fadeOut;
    }

    // Update 3D Chain-Lightning Arcs
    for (let i = activeLightningArcs.length - 1; i >= 0; i--) {
      const la = activeLightningArcs[i];
      la.age += safeDt;
      if (la.age >= la.duration) {
        la.group.visible = false;
        activeLightningArcs.splice(i, 1);
        freeLightningArcs.push(la);
        continue;
      }
      const p = 1 - la.age / la.duration;
      la.outerMat.opacity = p * 0.95;
      la.innerMat.opacity = p;
    }

    // Update 3D Physics Debris (Skulls, Bones, Shields, Helmets, Fractured Stone, Flagstone Chips & Magma Chunks)
    for (let i = activeDebris.length - 1; i >= 0; i--) {
      const d = activeDebris[i];
      d.age += safeDt;
      if (d.age >= d.life) {
        d.mesh.visible = false;
        activeDebris.splice(i, 1);
        (freeDebrisByKind[d.kind] || freeDebrisByKind.bone).push(d);
        continue;
      }

      const isStoneRubble = d.kind === 'rock_chunk' || d.kind === 'flagstone_chip' || d.kind === 'molten_chunk';
      if (isStoneRubble) {
        if (d.bounces < 2) {
          d.vy -= 23.5 * safeDt;
          d.x += d.vx * safeDt;
          d.y += d.vy * safeDt;
          d.z += d.vz * safeDt;
        } else {
          const slideDrag = Math.exp(-15.0 * safeDt);
          d.vx *= slideDrag;
          d.vz *= slideDrag;
          d.x += d.vx * safeDt;
          d.z += d.vz * safeDt;
          d.vry *= slideDrag;
        }

        const restHalfH = (d.kind === 'flagstone_chip' ? 0.028 : 0.068) * d.baseScale;
        let baseFloorY = getGroundHeight(d.x, d.z);
        // Physical sunken-pit collision: rocks falling over a circular crater DROP DOWN INSIDE THE HOLE instead of bouncing on thin air!
        for (let ci = 0; ci < activeGroundFractures.length; ci++) {
          const gf = activeGroundFractures[ci];
          if (gf.kind === 'fissure' || !gf.pitGroup?.visible) continue;
          const dxC = d.x - gf.x;
          const dzC = d.z - gf.z;
          const distC = Math.hypot(dxC, dzC);
          const pitOpeningR = gf.radius * 0.37;
          if (distC < pitOpeningR) {
            const uR = distC / Math.max(0.01, pitOpeningR);
            const sinkDepth = (gf.pitDepth || 1.05) * (1.28 * (1.0 - uR * uR * 0.62));
            baseFloorY = Math.min(baseFloorY, gf.groundY - sinkDepth);
          }
        }
        const floorY = baseFloorY + restHalfH;
        if (d.y <= floorY) {
          d.y = floorY;
          if (d.bounces === 0) {
            // Single crisp stone-on-flagstone bounce + tiny dust puff right at impact point!
            const hitSpeed = Math.abs(d.vy);
            d.bounces = 1;
            d.vy = Math.max(1.25, hitSpeed * 0.36);
            d.vx *= 0.60;
            d.vz *= 0.60;
            d.vrx *= 0.46;
            d.vry *= 0.62;
            d.vrz *= 0.46;
            if (d.emitBounceDust && hitSpeed > 2.2) {
              d.emitBounceDust = false;
              spawnStoneDustPuff({
                x: d.x,
                y: floorY + 0.05,
                z: d.z,
                vx: d.vx * 0.22,
                vy: 0.22 + Math.random() * 0.18,
                vz: d.vz * 0.22,
                startScale: 0.26 * d.baseScale,
                endScale: 0.78 * d.baseScale,
                opacity: d.kind === 'molten_chunk' ? 0.30 : 0.34,
                duration: 0.38 + Math.random() * 0.14,
                color: d.kind === 'molten_chunk' ? 0x3d261c : 0x36313c
              });
            }
          } else {
            // Second contact: stone settles cleanly onto the cathedral floor before fading!
            d.bounces = 2;
            d.vy = 0;
            d.vrx = 0;
            d.vrz = 0;
            if (d.kind === 'flagstone_chip') {
              d.mesh.rotation.x *= 0.55;
              d.mesh.rotation.z *= 0.55;
            }
          }
        }
      } else {
        d.vy -= 22 * safeDt;
        d.x += d.vx * safeDt;
        d.y += d.vy * safeDt;
        d.z += d.vz * safeDt;
        const floorY = getGroundHeight(d.x, d.z) + 0.09;
        if (d.y < floorY) {
          d.y = floorY;
          d.vy = Math.abs(d.vy) * 0.42;
          d.vx *= 0.72;
          d.vz *= 0.72;
          d.vrx *= 0.78;
          d.vrz *= 0.78;
        }
      }

      const rem = 1 - d.age / d.life;
      const fade01 = rem < 0.22 ? rem / 0.22 : 1.0;
      const sinkY = isStoneRubble && rem < 0.22 ? (1 - fade01) * 0.045 * d.baseScale : 0;
      d.mesh.position.set(d.x, d.y - sinkY, d.z);
      d.mesh.rotation.x += d.vrx * safeDt;
      d.mesh.rotation.y += d.vry * safeDt;
      d.mesh.rotation.z += d.vrz * safeDt;
      d.mesh.scale.setScalar(d.baseScale * (isStoneRubble ? (0.45 + 0.55 * fade01) : fade01));
    }

    // Update Pooled 3D Oak Wood Shield-Scrape Splinters (spin outward + single realistic bounce on stone floor)
    for (let i = activeWoodSplinters.length - 1; i >= 0; i--) {
      const sp = activeWoodSplinters[i];
      sp.age += safeDt;
      if (sp.age >= sp.life) {
        sp.mesh.visible = false;
        activeWoodSplinters.splice(i, 1);
        freeWoodSplinters.push(sp);
        continue;
      }
      sp.vy -= 19.5 * safeDt;
      sp.x += sp.vx * safeDt;
      sp.y += sp.vy * safeDt;
      sp.z += sp.vz * safeDt;

      const floorY = getGroundHeight(sp.x, sp.z) + 0.018;
      if (sp.y <= floorY) {
        sp.y = floorY;
        if (!sp.bounced) {
          sp.bounced = true;
          sp.vy = Math.abs(sp.vy) * 0.36;
          sp.vx *= 0.60;
          sp.vz *= 0.60;
          sp.vrx *= 0.42;
          sp.vry *= 0.58;
          sp.vrz *= 0.42;
        } else {
          sp.vy = 0;
          const slideDrag = Math.max(0, 1 - safeDt * 14.0);
          sp.vx *= slideDrag;
          sp.vz *= slideDrag;
          sp.vrx = 0;
          sp.vry *= slideDrag;
          sp.vrz = 0;
          sp.mesh.rotation.x *= 0.65;
          sp.mesh.rotation.z *= 0.65;
        }
      }

      sp.mesh.position.set(sp.x, sp.y, sp.z);
      sp.mesh.rotation.x += sp.vrx * safeDt;
      sp.mesh.rotation.y += sp.vry * safeDt;
      sp.mesh.rotation.z += sp.vrz * safeDt;

      const rem = 1 - sp.age / sp.life;
      const fadeSc = rem < 0.24 ? rem / 0.24 : 1.0;
      sp.mesh.scale.set(sp.sx * fadeSc, sp.sy * fadeSc, sp.sz * fadeSc);
    }

    // Update 3D Water Prison Spheres (9-stage rise -> glossy Fresnel bubble + tendrils + droplets -> splash burst!)
    if (activeWaterSpheres.length > 0) {
      waterSwirlTex.offset.x = (waterSwirlTex.offset.x + safeDt * 0.52) % 1;
      waterSwirlTex.offset.y = (waterSwirlTex.offset.y - safeDt * 0.34) % 1;
    }
    for (let i = activeWaterSpheres.length - 1; i >= 0; i--) {
      const ws = activeWaterSpheres[i];
      ws.age += safeDt;
      if (ws.age >= ws.duration) {
        // Frame 9 burst: explosive fountain of glossy water droplets & concentric splash ring!
        spawnShockwaveRing({
          x: ws.x,
          y: 0.06,
          z: ws.z,
          radius: ws.radius * 0.92,
          color: 0x38bdf8,
          duration: 0.36
        });
        spawnParticles({
          x: ws.x,
          y: 1.48,
          z: ws.z,
          color: 0x38bdf8,
          count: 26,
          speed: 9.2,
          size: 0.20,
          life: 0.50,
          gravity: 16.5
        });
        spawnParticles({
          x: ws.x,
          y: 1.58,
          z: ws.z,
          color: 0xe0f2fe,
          count: 16,
          speed: 7.6,
          size: 0.14,
          life: 0.44,
          gravity: 15.0
        });
        ws.group.visible = false;
        activeWaterSpheres.splice(i, 1);
        freeWaterSpheres.push(ws);
        continue;
      }
      const p = ws.age / ws.duration;
      const riseEase = p < 0.22 ? 1 - Math.pow(1 - p / 0.22, 2) : 1.0;
      const popScale = p < 0.20 ? 0.25 + 0.75 * (p / 0.20) : p > 0.92 ? 1 + (p - 0.92) * 2.2 : 1.0;
      const alphaFade = p > 0.92 ? (1 - p) / 0.08 : 1.0;
      const sphereR = ws.radius * 0.56 * popScale;
      const wobble = 1 + Math.sin(ws.age * 13) * 0.032;

      // Ground ripple & twisting water funnel stem connecting ground puddle to bottom of sphere
      const baseR = ws.radius * 0.58 * (0.62 + 0.38 * riseEase);
      ws.baseGroup.scale.set(baseR, 0.52 + 0.76 * riseEase, baseR);
      ws.baseGroup.rotation.y += safeDt * 3.4;

      // Levitating refractive spherical bubble at y = 1.62
      ws.bubbleGroup.position.y = 0.45 + 1.18 * riseEase + Math.sin(ws.age * 8.5) * 0.048;
      ws.bubbleGroup.scale.set(sphereR * wobble, (sphereR / wobble) * 1.02, sphereR * wobble);
      ws.swirlSphere.rotation.y -= safeDt * 2.6;
      ws.swirlSphere.rotation.x = Math.sin(ws.age * 3.2) * 0.22;
      ws.ribbons.rotation.y += safeDt * 5.4;
      ws.ribbons.rotation.z = Math.sin(ws.age * 4.2) * 0.16;
      ws.dropletsGroup.rotation.y -= safeDt * 2.6;
      for (let d = 0; d < ws.droplets.length; d++) {
        const dr = ws.droplets[d];
        dr.mesh.position.y = dr.baseY + Math.sin(ws.age * 7.2 + dr.phase) * 0.12;
      }

      ws.bubbleSpriteMat.opacity = 0.96 * alphaFade;
      ws.swirlShellMat.opacity = 0.48 * alphaFade;
      ws.stemMat.opacity = 0.72 * alphaFade;
      ws.ribbonMat.opacity = 0.88 * alphaFade;
      ws.specMat.opacity = 0.92 * alphaFade;
      ws.dropletSpriteMat.opacity = 0.94 * alphaFade;
    }

    // Update Critical Strike X-Execution Flash & Cobblestone Blood Splatter
    for (let i = activeCritBursts.length - 1; i >= 0; i--) {
      const cb = activeCritBursts[i];
      cb.age += safeDt;
      if (cb.age >= cb.duration) {
        cb.group.visible = false;
        activeCritBursts.splice(i, 1);
        freeCritBursts.push(cb);
        continue;
      }
      if (cb.age < 0.18) {
        const sp = cb.age / 0.18;
        cb.crossWrap.scale.setScalar(0.55 + sp * 0.85);
        cb.slashMat.opacity = (1 - sp) * 0.98;
        cb.crimsonMat.opacity = (1 - sp) * 0.94;
      } else {
        cb.crossWrap.visible = false;
      }
      const fade = cb.age > 0.55 ? 1 - (cb.age - 0.55) / (cb.duration - 0.55) : 1.0;
      cb.decalMat.opacity = 0.82 * Math.max(0, fade);
    }

    // Update Elemental Impacts (Tornadoes, Fire Patches, Sky-Bolts & Meteors)
    for (let i = activeElemVfx.length - 1; i >= 0; i--) {
      const ev = activeElemVfx[i];
      ev.age += safeDt;
      if (ev.age >= ev.duration) {
        if (ev.kind === 'meteor') {
          spawnShockwaveRing({ x: ev.endX, y: 0.1, z: ev.endZ, radius: ev.radius, color: ev.color, duration: 0.42, withBloom: false });
          spawnBloomFlash({ x: ev.endX, y: 1.1, z: ev.endZ, color: ev.color, size: Math.max(4.8, ev.radius * 1.9), duration: 0.44, opacity: 0.85 });
          spawnParticles({ x: ev.endX, y: 0.6, z: ev.endZ, color: ev.color, count: 22, speed: 8.5, size: 0.22, life: 0.5, gravity: 8 });
          ev.coreMat?.dispose();
        }
        scene.remove(ev.group);
        ev.mat?.dispose();
        activeElemVfx.splice(i, 1);
        continue;
      }
      const p = ev.age / ev.duration;
      if (ev.kind === 'tornado') {
        ev.group.rotation.y += safeDt * 18;
        const fade = 1 - p;
        ev.mat.opacity = fade * 0.88;
        const expand = ev.radius * (0.7 + p * 0.5);
        ev.group.scale.set(expand, 0.6 + p * 0.65, expand);
      } else if (ev.kind === 'skybolt') {
        ev.mat.opacity = (1 - p) * 0.96;
        ev.group.scale.set(1 + p * 0.5, 1, 1 + p * 0.5);
      } else if (ev.kind === 'firepatch') {
        ev.mat.opacity = (1 - p) * 0.78;
        ev.emitTick += safeDt;
        if (ev.emitTick >= 0.12) {
          ev.emitTick = 0;
          spawnParticles({
            x: ev.x + (Math.random() - 0.5) * 1.4,
            y: 0.18,
            z: ev.z + (Math.random() - 0.5) * 1.4,
            color: Math.random() < 0.5 ? 0xff5722 : 0xfef08a,
            count: 2,
            speed: 1.8,
            size: 0.14,
            life: 0.36,
            gravity: -3.6
          });
        }
      } else if (ev.kind === 'meteor') {
        const mx = ev.startX + (ev.endX - ev.startX) * p;
        const my = ev.startY * (1 - p) + 0.35 * p;
        const mz = ev.startZ + (ev.endZ - ev.startZ) * p;
        ev.group.position.set(mx, my, mz);
        ev.group.rotation.x += safeDt * 12;
        ev.group.rotation.y += safeDt * 10;
      }
    }

    // Update Boss Danger Zones
    for (let i = activeDangerZones.length - 1; i >= 0; i--) {
      const dz = activeDangerZones[i];
      dz.age += safeDt;
      if (dz.age >= dz.duration) {
        dz.group.visible = false;
        freeDangerZones.push(dz);
        activeDangerZones.splice(i, 1);
        continue;
      }
      const p = Math.min(1, dz.age / dz.duration);
      const fillR = dz.radius * Math.max(0.05, p);
      dz.fillMesh.scale.set(fillR, 1, fillR);
      dz.fillMat.opacity = p > 0.75 ? 0.55 + Math.sin(t * 36) * 0.35 : 0.20 + p * 0.28;
      dz.borderMat.opacity = 0.72 + Math.sin(t * 16) * 0.22;
    }

    // Update Ground Telegraph Zones (expanding fill from center to outer contour)
    for (let i = activeTelegraphZones.length - 1; i >= 0; i--) {
      const tz = activeTelegraphZones[i];
      tz.age += safeDt;
      if (tz.age >= tz.duration) {
        activeTelegraphZones.splice(i, 1);
        releaseTelegraphZone(tz);
        continue;
      }
      const p = Math.min(1, tz.age / tz.duration);
      const fillR = tz.radius * Math.max(0.06, p);
      tz.fillMesh.scale.set(fillR, 1, fillR);
      tz.leadMesh.scale.set(fillR, 1, fillR);
      const nearEnd = p > 0.78;
      const pulse = nearEnd ? 0.5 + 0.5 * Math.sin(t * 40) : 0;
      tz.fillMat.opacity = 0.18 + p * 0.32 + pulse * 0.24;
      tz.outerMat.opacity = 0.74 + p * 0.22 + pulse * 0.12;
      tz.leadMat.opacity = 0.85 + pulse * 0.15;
    }

    // Update Smoldering Fire Trail Patches
    const fireEmitInterval = isMobileDevice ? 0.28 : 0.17;
    for (let i = activeFireTrails.length - 1; i >= 0; i--) {
      const ft = activeFireTrails[i];
      ft.age += safeDt;
      if (ft.age >= ft.duration) {
        activeFireTrails.splice(i, 1);
        releaseFireTrailPatch(ft);
        continue;
      }
      const p = ft.age / ft.duration;
      const popIn = ft.age < 0.12 ? 0.45 + 0.55 * (ft.age / 0.12) : 1.0;
      const fadeOut = p > 0.7 ? Math.max(0, (1 - p) / 0.3) : 1.0;
      const fl = 0.86 + 0.14 * Math.sin(t * 11.5 + ft.phase);
      const rScale = ft.radius * popIn * (0.96 + 0.04 * fl);
      ft.charMesh.scale.set(rScale * 1.06, 1, rScale * 1.06);
      ft.glowMesh.scale.set(rScale, 1, rScale);
      ft.coreMesh.scale.set(rScale * 0.52 * fl, 1, rScale * 0.52 * fl);
      ft.charMat.opacity = 0.58 * fadeOut;
      ft.glowMat.opacity = 0.80 * fl * fadeOut;
      ft.coreMat.opacity = 0.54 * fl * fadeOut;

      ft.emitTick += safeDt;
      if (ft.emitTick >= fireEmitInterval && fadeOut > 0.25) {
        ft.emitTick = 0;
        const ang = Math.random() * Math.PI * 2;
        const dist = Math.random() * ft.radius * 0.72;
        spawnParticles({
          x: ft.x + Math.cos(ang) * dist,
          y: 0.16,
          z: ft.z + Math.sin(ang) * dist,
          color: Math.random() < 0.45 ? 0xfef08a : 0xff6b14,
          count: 1,
          speed: 1.45,
          size: 0.12,
          life: 0.38,
          gravity: -2.8
        });
      }
    }

    // Update Explosive Barrel Detonations
    for (let i = activeBarrelExplosions.length - 1; i >= 0; i--) {
      const bx = activeBarrelExplosions[i];
      bx.age += safeDt;
      if (bx.age >= bx.duration) {
        activeBarrelExplosions.splice(i, 1);
        releaseBarrelExplosion(bx);
        continue;
      }
      const p = bx.age / bx.duration;
      const easeOut = 1 - (1 - p) * (1 - p);
      const flashP = Math.min(1, p / 0.65);
      const coreR = bx.radius * (0.16 + 0.42 * flashP);
      const outerR = bx.radius * (0.24 + 0.58 * easeOut);
      const ringR = bx.radius * (0.20 + 0.86 * easeOut);
      const scorchR = bx.radius * (0.35 + 0.68 * easeOut);

      bx.coreSphere.scale.set(coreR, coreR * 0.82, coreR);
      bx.outerSphere.scale.set(outerR, outerR * 0.72, outerR);
      bx.ringMesh.scale.set(ringR, 1, ringR);
      bx.scorchMesh.scale.set(scorchR, 1, scorchR);

      bx.coreMat.opacity = Math.max(0, (1 - flashP) * (1 - flashP) * 0.96);
      bx.outerMat.opacity = Math.max(0, (1 - p) * (1 - p) * 0.88);
      bx.ringMat.opacity = Math.max(0, (1 - p) * 0.94);
      bx.scorchMat.opacity = Math.max(0, (1 - p) * 0.76);
    }

    // Update Lightweight Pooled Pseudo-Bloom Flashes
    for (let i = activeBloomFlashes.length - 1; i >= 0; i--) {
      const bf = activeBloomFlashes[i];
      bf.age += safeDt;
      if (bf.age >= bf.duration) {
        bf.sprite.visible = false;
        freeBloomFlashes.push(bf);
        activeBloomFlashes.splice(i, 1);
        continue;
      }
      const p = bf.age / bf.duration;
      const easeOut = 1 - (1 - p) * (1 - p);
      const sc = bf.startScale + (bf.endScale - bf.startScale) * easeOut;
      bf.sprite.scale.set(sc, sc, 1);
      bf.mat.opacity = bf.baseOpacity * (1 - p) * (1 - p * 0.45);
    }
  }

  function render() {
    renderer.render(scene, camera);
  }

  function setLowSpecMode(enabled) {
    const next = Boolean(enabled);
    if (next === lowSpecMode) return;
    lowSpecMode = next;
    renderer.setPixelRatio(getTargetPixelRatio());
    // ZERO-HITCH: NEVER toggle dirLight.castShadow mid-combat (changes NUM_DIR_LIGHT_SHADOWS across every lit shader
    // causing a 200-600ms synchronous HLSL recompile freeze!). Scale DPR, shadow map res, particles & uniforms instead.
    if (cameraMode === 'hub') {
      hubShadowCatcher.visible = hubStageFocus !== 'arsenal' && !lowSpecMode;
      syncDirLightShadowMapSize(isMobileDevice || lowSpecMode ? 512 : 1024);
    } else {
      syncDirLightShadowMapSize(isMobileDevice || lowSpecMode ? 512 : 1024);
    }
    if (lowSpecMode) {
      burningGroundLight.intensity = 0;
    }
    refreshAdaptiveBloomMaterials();
    syncBiomeWeatherVisibility();
    mistyArena?.setLowSpecMode?.(lowSpecMode);
    soulsArena?.setLowSpecMode?.(lowSpecMode);
    soulsExteriorShore?.setLowSpecMode?.(lowSpecMode);
    soulsEscapeVfx?.setLowSpecMode?.(lowSpecMode);
    phase2ArenaFireRingCtrl?.setLowSpec?.(lowSpecMode);
    for (let i = 0; i < activeGroundFractures.length; i++) {
      activeGroundFractures[i].fireField?.setLowSpec?.(lowSpecMode);
      activeGroundFractures[i].fireRoad?.setLowSpec?.(lowSpecMode);
    }
    for (let i = 0; i < freeGroundFractures.length; i++) {
      freeGroundFractures[i].fireField?.setLowSpec?.(lowSpecMode);
      freeGroundFractures[i].fireRoad?.setLowSpec?.(lowSpecMode);
    }
  }

  function resize() {
    const vp = window.__getGameViewportSize?.();
    const vv = window.visualViewport;
    const w = Math.max(Math.round(vp?.w || vv?.width || document.documentElement.clientWidth || window.innerWidth), 1);
    const h = Math.max(Math.round(vp?.h || vv?.height || document.documentElement.clientHeight || window.innerHeight), 1);
    renderer.setPixelRatio(getTargetPixelRatio());
    renderer.setSize(w, h, true);
    const aspect = w / h;
    camera.aspect = aspect;
    if (cameraMode === 'hub') {
      camera.fov = aspect < 0.92 ? 48 : 40;
    } else if (!isBossDoorCutsceneActive()) {
      camera.fov = getCombatFovForBiome(aspect);
    }
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  function resetVfx() {
    shakeIntensity = 0;
    bossModeActive = false;
    bossDoorCutsceneActive = false;
    bossDoorCutsceneElapsed = 0;
    _cutsceneState = null;
    const basePal = getCombatBasePalette();
    const activePal = cameraMode === 'hub' ? PALETTE_HUB : basePal;
    if (cameraMode !== 'hub') {
      if (!scene.background) scene.background = basePal.bg.clone();
      else scene.background.copy(basePal.bg);
    }
    scene.fog.color.copy(activePal.fog);
    hemiLight.color.copy(activePal.hemiSky);
    hemiLight.groundColor.copy(activePal.hemiGround);
    dirLight.color.copy(activePal.dir);
    plazaRuneMat.color.copy(activePal.plazaRune);

    for (let i = 0; i < MAX_PARTICLES; i++) {
      particles[i].active = false;
      particleMesh.setMatrixAt(i, zeroMatrix);
    }
    activeParticleCount = 0;
    particleMesh.visible = false;
    particleMesh.instanceMatrix.needsUpdate = true;

    while (activeMuzzleFlashes.length > 0) {
      const mf = activeMuzzleFlashes.pop();
      mf.group.visible = false;
      freeMuzzleFlashes.push(mf);
    }
    while (activeGunSmokes.length > 0) {
      const sm = activeGunSmokes.pop();
      sm.sprite.visible = false;
      freeGunSmokes.push(sm);
    }
    while (activeSlashArcs.length > 0) {
      const sa = activeSlashArcs.pop();
      sa.group.visible = false;
      let bucket = freeSlashArcsByArc.get(sa.arcKey);
      if (!bucket) {
        bucket = [];
        freeSlashArcsByArc.set(sa.arcKey, bucket);
      }
      bucket.push(sa);
    }
    while (activeShockwaves.length > 0) {
      const sw = activeShockwaves.pop();
      sw.group.visible = false;
      freeShockwaves.push(sw);
    }
    burningGroundLight.intensity = 0;
    burningGroundLight.position.set(0, -80, 0);
    phase2ArenaFireRingCtrl?.reset?.();
    while (activeGroundFractures.length > 0) {
      const gf = activeGroundFractures.pop();
      if (gf.fireField?.group) gf.fireField.group.visible = false;
      if (gf.fireRoad?.group) gf.fireRoad.group.visible = false;
      gf.group.visible = false;
      freeGroundFractures.push(gf);
    }
    while (activeStoneDustPuffs.length > 0) {
      const dp = activeStoneDustPuffs.pop();
      dp.sprite.visible = false;
      freeStoneDustPuffs.push(dp);
    }
    while (activeWoodSplinters.length > 0) {
      const sp = activeWoodSplinters.pop();
      sp.mesh.visible = false;
      freeWoodSplinters.push(sp);
    }
    while (activeLightningArcs.length > 0) {
      const la = activeLightningArcs.pop();
      la.group.visible = false;
      freeLightningArcs.push(la);
    }
    while (activeDebris.length > 0) {
      const d = activeDebris.pop();
      d.mesh.visible = false;
      (freeDebrisByKind[d.kind] || freeDebrisByKind.bone).push(d);
    }
    while (activeWaterSpheres.length > 0) {
      const ws = activeWaterSpheres.pop();
      ws.group.visible = false;
      freeWaterSpheres.push(ws);
    }
    while (activeCritBursts.length > 0) {
      const cb = activeCritBursts.pop();
      cb.group.visible = false;
      freeCritBursts.push(cb);
    }
    while (activeElemVfx.length > 0) {
      const ev = activeElemVfx.pop();
      scene.remove(ev.group);
      ev.mat?.dispose();
      ev.coreMat?.dispose();
    }
    while (activeDangerZones.length > 0) {
      const dz = activeDangerZones.pop();
      dz.group.visible = false;
      freeDangerZones.push(dz);
    }
    while (activeTelegraphZones.length > 0) {
      releaseTelegraphZone(activeTelegraphZones.pop());
    }
    while (activeFireTrails.length > 0) {
      releaseFireTrailPatch(activeFireTrails.pop());
    }
    while (activeBarrelExplosions.length > 0) {
      releaseBarrelExplosion(activeBarrelExplosions.pop());
    }
    while (activeBloomFlashes.length > 0) {
      const bf = activeBloomFlashes.pop();
      bf.sprite.visible = false;
      freeBloomFlashes.push(bf);
    }
    for (const proj of Array.from(activeProjectiles)) {
      proj.dispose();
    }
    activeProjectiles.clear();
    lockOnTarget = null;
    lockLookOffsetX = 0;
    lockLookOffsetY = 0;
    lockLookOffsetZ = 0;
    lockOnReticle.visible = false;
    soulsEscapeVfx?.reset?.();
  }

  return {
    ready,
    scene,
    camera,
    renderer,
    obstacles,
    HUB_PEDESTAL_TOP_Y,
    followTarget,
    setLockOnTarget,
    getGroundHeight,
    adjustCombatOrbit,
    applyFreeLookDelta,
    zoomCombatOrbit,
    setCameraLock,
    setCameraPreset,
    zoomCamera,
    orbitCamera,
    setArenaEditMode,
    isArenaEditMode: () => Boolean(devEditors?.isArenaEditMode()),
    setWeaponEditMode,
    isWeaponEditMode: () => Boolean(devEditors?.isWeaponEditMode()),
    saveWeaponLayout,
    loadWeaponLayout,
    isArenaEditorHeroMovement: () => arenaEditorHeroMovement,
    setArenaEditorHeroMovement,
    getArenaProps,
    setArenaPropPos,
    getCombatOrbitYaw,
    setCombatOrbitYaw,
    resetCombatOrbit,
    setCameraMode,
    setArenaBiome,
    prewarmSoulsShaders,
    getBiomeForLevel,
    isArenaCircular,
    isSoulsArena: () => isSoulsBiome(currentBiome),
    getSurfaceType: (x = 0, z = 0, currentY) => {
      if (!isSoulsBiome(currentBiome)) return 'dirt';
      if (soulsZoneMode === 'exterior_shore' && soulsExteriorShore?.getSurfaceType) {
        return soulsExteriorShore.getSurfaceType(x, z, currentY);
      }
      if (soulsZoneMode === 'shaft_river') return 'wet_stone';
      if (soulsArena?.getSurfaceType) return soulsArena.getSurfaceType(x, z);
      if (z >= 4.5) return 'stone_courtyard';
      if (z >= -10.5) return 'stone_bridge';
      return 'cathedral_stone';
    },
    setSoulsZoneMode,
    getSoulsZoneMode: () => soulsZoneMode,
    getExteriorShoreAnchors: () => (soulsExteriorShore?.getAnchors?.() || EXTERIOR_SHORE_ANCHORS),
    getExteriorShoreFireSources: () => (soulsExteriorShore?.getActiveFireSources?.() || []),
    getExteriorShoreInteractables: () => (soulsExteriorShore?.getInteractables?.() || []),
    getExteriorShoreZoneTitle: (x = 0, z = 0, currentY) => (soulsExteriorShore?.getZoneTitleAt?.(x, z, currentY) || 'Берег Пепельного Стока'),
    setGorgeShortcutUnlocked: (unlocked) => ensureSoulsExteriorShore()?.setShortcutUnlocked?.(Boolean(unlocked)),
    isGorgeShortcutUnlocked: () => Boolean(soulsExteriorShore?.isShortcutUnlocked?.()),
    getExteriorShoreReadyPromise: () => soulsExteriorShore?.getReadyPromise?.() || Promise.resolve(),
    attachShoreRealSwordModel,
    setShoreSwordPickedUp: (picked) => ensureSoulsExteriorShore()?.setSwordPickedUp?.(Boolean(picked)),
    setShoreBonfireLit: (lit) => {
      ensureSoulsExteriorShore()?.setBonfireLit?.(Boolean(lit));
      if (soulsZoneMode === 'exterior_shore') {
        burningGroundLight.color.setHex(0xff8c2b);
        burningGroundLight.distance = 24;
        burningGroundLight.decay = 1.55;
        burningGroundLight.position.set(EXTERIOR_SHORE_ANCHORS.bonfirePos.x, 1.85, EXTERIOR_SHORE_ANCHORS.bonfirePos.z);
        burningGroundLight.intensity = lit ? 9.5 : 1.8;
      }
    },
    hitShoreDestructibles: (x, z, r = 1.65) =>
      soulsExteriorShore?.hitDestructibles?.(x, z, r) || { count: 0, hits: [] },
    resetShoreDestructibles: () => soulsExteriorShore?.resetDestructibles?.(),
    setShoreGrateBroken: (broken) => ensureSoulsExteriorShore()?.setGrateBroken?.(Boolean(broken)),
    triggerShoreGrateBreak: () => ensureSoulsExteriorShore()?.triggerGrateBreak?.(),
    getSoulsEscapeVfx: () => ensureSoulsEscapeVfx(),
    emitEscapeParrySparks: (x, y, z, intensity = 1.0) => ensureSoulsEscapeVfx()?.emitParrySparks?.(x, y, z, intensity),
    emitEscapeDustImpact: (x, y, z, scale = 1.0) => ensureSoulsEscapeVfx()?.emitDustImpact?.(x, y, z, scale),
    emitEscapeFloorCollapseBurst: (x, y, z) => ensureSoulsEscapeVfx()?.emitFloorCollapseBurst?.(x, y, z),
    emitEscapeWaterSplash: (x, y, z, scale = 1.0) => ensureSoulsEscapeVfx()?.emitWaterSplash?.(x, y, z, scale),
    emitEscapeGrateBreakBurst: (x, y, z) => ensureSoulsEscapeVfx()?.emitGrateBreakBurst?.(x, y, z),
    setSoulsFogGate: (sealed) => {
      const isSealed = Boolean(sealed);
      if (!isSealed) {
        phase2ArenaFireRingCtrl?.reset?.();
      }
      return soulsArena?.setFogGateSealed?.(isSealed);
    },
    getBossDoorState: () => soulsArena?.getBossDoorState?.() || 'closed',
    openBossDoors: () => soulsArena?.openBossDoors?.() ?? false,
    sealBossDoors: () => soulsArena?.sealBossDoors?.() ?? false,
    resetBossDoors: (keepOpen = false) => {
      phase2ArenaFireRingCtrl?.reset?.();
      return soulsArena?.resetBossDoors?.(Boolean(keepOpen));
    },
    tryBreakCandlesNear: (x, z, r = 0.72) => soulsArena?.tryBreakCandlesNear?.(x, z, r) || [],
    resetCandles: () => soulsArena?.resetCandles?.(),
    setShrineClaimed: (id, claimed = true) => soulsArena?.setShrineClaimed?.(id, claimed),
    getSoulsCastleLayout: () => soulsArena?.getSoulsCastleLayout?.() || soulsArena?.SOULS_CASTLE_ZONES || null,
    startBossDoorCutscene,
    isBossDoorCutsceneActive,
    getBossDoorCutsceneState,
    skipBossDoorCutscene,
    startBossEscapeCutscene,
    isBossEscapeCutsceneActive,
    getBossEscapeCutsceneState,
    seekBossEscapeCutscene,
    skipBossEscapeCutscene,
    getActiveFlameBoxes: () => (soulsZoneMode === 'castle' ? (soulsArena?.getActiveFlameBoxes?.() || []) : []),
    isPointInFlameTrap: (x, z, y = 0.6, r = 0.5) => (soulsZoneMode === 'castle' ? Boolean(soulsArena?.isPointInFlameTrap?.(x, z, y, r)) : false),
    getFlameTrapStates: () => (soulsZoneMode === 'castle' ? (soulsArena?.getFlameTrapStates?.() || []) : []),
    isBossHallOccluded: (playerZ = 0) => (soulsZoneMode === 'castle' ? Boolean(soulsArena?.isBossHallOccluded?.(playerZ)) : false),
    clampSoulsPosition: (x, z, r = 0.5, opts = null) => {
      if (soulsZoneMode === 'exterior_shore') {
        const shore = ensureSoulsExteriorShore();
        const safeOpts = opts && Number.isFinite(opts.currentY)
          ? opts
          : { ...(opts || {}), currentY: hasFollowedOnce ? targetY : 0 };
        return shore?.clampPosition ? shore.clampPosition(x, z, r, safeOpts) : { x, z };
      }
      return soulsArena ? soulsArena.clampPosition(x, z, r, opts) : { x, z };
    },
    getSoulsBonfirePos: () => soulsArena ? soulsArena.getBonfirePos() : { x: 0, z: 25 },
    setDebugColliders,
    setHubStageFocus,
    addScreenShake,
    spawnParticles,
    spawnMuzzleFlash,
    spawnShellCasing,
    spawnSlashArc,
    spawnShockwaveRing,
    spawnBossGroundFracture,
    spawnBossHammerWrenchDust,
    triggerPhase2ArenaFireWave,
    getActiveGroundFracturesCount: () => activeGroundFractures.length,
    spawnWoodShieldSplinters,
    spawnBloomFlash,
    attachBloomHalo,
    spawnLightningArc,
    spawnBoneShatter,
    spawnArmorBreakPiece,
    spawnWaterPrisonSphere,
    spawnCritBloodBurst,
    spawnElementalImpact,
    spawnMeteorStrike,
    spawnDangerZone,
    spawnTelegraphZone,
    setTelegraphsVisible,
    getTelegraphsVisible,
    spawnFireTrailPatch,
    spawnBarrelExplosion,
    createProjectileVisual,
    setBossAtmosphere,
    getAimPointOnGround,
    isWorldPointVisible,
    update,
    render,
    resize,
    setLowSpecMode,
    resetVfx
  };
}
