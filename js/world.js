// True-3D Dark-Fantasy Courtyard Arena (KayKit Dungeon & Halloween GLB/GLTF Architecture)
// + High-Craft Tracer Streaks, Muzzle Starbursts, Arcane Comet Projectiles & Pooled Voxel VFX

import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { DRACOLoader } from '../vendor/DRACOLoader.js';
import { ARENA_HALF_SIZE } from './config.js?v=20261121z68';
import { createMistyArena } from './mistyArena.js?v=20261121z68';
import { createSoulsArena } from './soulsArena.js?v=20261121z68';
import {
  BOSS_DOOR_CUTSCENE_DURATION,
  evaluateBossDoorCutscene,
  getBossDoorCutsceneSkipState,
  computeBossDoorCutsceneShakeOffset
} from './souls/soulsCutsceneChoreography.js?v=20261121z68';
import {
  clampCastleCameraPosition,
  SOULS_CASTLE_CONSTANTS
} from './souls/soulsCastleLayout.js?v=20261121z68';
import { createSoulsEnvironmentMap } from './souls/soulsLightingRig.js?v=20261121z68';
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
} from './world/textures.js?v=20261121z68';

const sharedDracoLoader = new DRACOLoader();
sharedDracoLoader.setDecoderPath('./vendor/draco/');

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
    alpha: true,
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
  let currentBiome = 'courtyard';
  const isMistyBiome = (b = currentBiome) =>
    b === 'misty_forest' || b === 'frost_ruins' || b === 'ash_citadel';
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
    if (isSoulsBiome(currentBiome)) return PALETTE_SOULS;
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
    if (b === 'souls_citadel') return { near: 14, far: 58 };
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
    0.4,
    180
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
  let mistyArena = null;
  function ensureMistyArena() {
    if (!mistyArena) {
      mistyArena = createMistyArena({ isMobile: isMobileDevice, lowSpec: lowSpecMode });
      arenaGroup.add(mistyArena.group);
    }
    return mistyArena;
  }

  let soulsArena = null;
  function ensureSoulsArena() {
    if (!soulsArena) {
      soulsArena = createSoulsArena();
      if (lowSpecMode) soulsArena.setLowSpecMode?.(true);
      arenaGroup.add(soulsArena.group);
    }
    return soulsArena;
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

  function getGroundHeight(x = 0, z = 0) {
    if (isSoulsBiome(currentBiome) && typeof soulsArena?.getFloorHeight === 'function') {
      const h = soulsArena.getFloorHeight(x, z);
      return Number.isFinite(h) ? h : 0;
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

  // Warm contrasting courtyard fires, braziers & rune lights against the cool twilight mist
  addFlickerLight(-14.5, 2.4, 5.5, 0xff8420, 4.6, 22, 0.5, true, courtyardPropsGroup);    // Campfire with real 3D logs & flames!
  addFlickerLight(-11.5, 2.8, -9.0, 0xb05cff, 3.1, 18, 1.7, false, courtyardPropsGroup);  // Purple Rune Altar glow
  addFlickerLight(13.0, 3.0, -6.5, 0xff9a30, 3.6, 19, 2.9, false, courtyardPropsGroup);   // Dead Lantern Tree warm glow
  addFlickerLight(-22.0, 3.6, -22.0, 0xff8624, 3.6, 22, 4.1, false, courtyardPropsGroup); // NW Crypt Mausoleum torches
  addFlickerLight(22.0, 3.2, -22.0, 0xff9430, 3.2, 20, 5.2, false, courtyardPropsGroup);  // NE Corner shrine glow
  addFlickerLight(20.0, 2.8, 19.0, 0xa855f7, 2.6, 18, 3.6, false, courtyardPropsGroup);   // SE Arcane portal glow
  addFlickerLight(1.5, 2.1, -15.5, 0xff922b, 3.0, 17, 2.2, false, courtyardPropsGroup);   // North Skull Candle Shrine brazier
  addFlickerLight(-6.5, 2.0, 12.5, 0xff8c28, 2.9, 17, 4.7, false, courtyardPropsGroup);   // South-West Coffin & Candle brazier

  // ==========================================================================
  // Load & Assemble Genuine 3D KayKit Environment Models (Zero 2D distortion!)
  // ==========================================================================
  const envPaths = {
    crypt: './assets/env/crypt.gltf',
    arch: './assets/env/arch.gltf',
    arch_gate: './assets/env/arch_gate.gltf',
    shrine: './assets/env/shrine.gltf',
    shrine_candles: './assets/env/shrine_candles.gltf',
    pillar: './assets/env/pillar.gltf',
    tree_dead_large: './assets/env/tree_dead_large_decorated.gltf',
    pine_large: './assets/env/tree_pine_orange_large.gltf',
    pine_med: './assets/env/tree_pine_orange_medium.gltf',
    ribcage: './assets/env/ribcage.gltf',
    fence: './assets/env/fence.gltf',
    fence_broken: './assets/env/fence_broken.gltf',
    fence_pillar: './assets/env/fence_pillar.gltf',
    post_lantern: './assets/env/post_lantern.gltf',
    post_skull: './assets/env/post_skull.gltf',
    lantern_standing: './assets/env/lantern_standing.gltf',
    candle_triple: './assets/env/candle_triple.gltf',
    skull_candle: './assets/env/skull_candle.gltf',
    gravestone: './assets/env/gravestone.gltf',
    coffin: './assets/env/coffin_decorated.gltf',
    banner_red: './assets/env/banner_patternA_red.gltf.glb?v=20261120z34',
    barrels: './assets/env/barrel_small_stack.gltf.glb?v=20261120z34',
    crates: './assets/env/crates_stacked.gltf.glb?v=20261120z34'
  };

  const ready = (async () => {
    const loader = new GLTFLoader();
    loader.setDRACOLoader(sharedDracoLoader);
    const templates = new Map();

    const envEntries = Object.entries(envPaths);
    const loadEnvProp = ([key, url]) =>
      new Promise((resolve) => {
        let settled = false;
        let attempt = 0;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        const timer = setTimeout(finish, 30000);
        const tryLoad = () => {
          attempt += 1;
          loader.load(
            url,
            (gltf) => {
              clearTimeout(timer);
              const isOuterOrTiny =
                key === 'pine_large' ||
                key === 'pine_med' ||
                key === 'candle_triple' ||
                key === 'skull_candle' ||
                key === 'fence' ||
                key === 'fence_broken';
              gltf.scene.traverse((n) => {
                if (n.isMesh) {
                  n.castShadow = !isMobileDevice && !isOuterOrTiny;
                  n.receiveShadow = key !== 'pine_large' && key !== 'pine_med';
                  if ((key === 'pine_large' || key === 'pine_med') && n.geometry) {
                    // Bake frosted dark-fantasy evergreen + snow-dusted upper needles!
                    const pos = n.geometry.attributes.position;
                    const nrm = n.geometry.attributes.normal;
                    const colors = new Float32Array(pos.count * 3);
                    const bark = new THREE.Color(0x382722);
                    const pine = new THREE.Color(0x284052);
                    const snow = new THREE.Color(0x9fb5d6);
                    const cTmp = new THREE.Color();
                    for (let i = 0; i < pos.count; i++) {
                      const py = pos.getY(i);
                      const ny = nrm ? nrm.getY(i) : 0;
                      if (py < 1.25) {
                        cTmp.copy(bark);
                      } else if (ny > 0.42) {
                        cTmp.copy(pine).lerp(snow, Math.min(1, (ny - 0.42) * 1.45));
                      } else {
                        cTmp.copy(pine);
                      }
                      colors[i * 3] = cTmp.r;
                      colors[i * 3 + 1] = cTmp.g;
                      colors[i * 3 + 2] = cTmp.b;
                    }
                    n.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
                    n.material = new THREE.MeshStandardMaterial({
                      vertexColors: true,
                      roughness: 0.85,
                      metalness: 0.05
                    });
                  } else if (n.material && key !== 'banner_red') {
                    // Moody twilight slate stone tint so KayKit props match the dark courtyard
                    const cloned = Array.isArray(n.material)
                      ? n.material.map((m) => m.clone())
                      : n.material.clone();
                    n.material = cloned;
                    const list = Array.isArray(cloned) ? cloned : [cloned];
                    for (const m of list) {
                      if (m.color) m.color.setHex(0x8c96b2);
                    }
                  }
                }
              });
              templates.set(key, gltf.scene);
              finish();
            },
            undefined,
            () => {
              if (attempt < 2 && !settled) {
                setTimeout(tryLoad, 180);
                return;
              }
              clearTimeout(timer);
              finish();
            }
          );
        };
        tryLoad();
      });

    let envIdx = 0;
    await Promise.all(
      Array.from({ length: Math.min(4, envEntries.length) }, async () => {
        while (envIdx < envEntries.length) {
          const i = envIdx++;
          await loadEnvProp(envEntries[i]);
        }
      })
    );

    const fallbackStoneMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.85,
      metalness: 0.1
    });
    function placeProp(key, x, y, z, rotY = 0, scale = 1.0, parent = courtyardPropsGroup) {
      const tpl = templates.get(key);
      if (!tpl) {
        // Never leave a collider invisible if a structural prop asset ever failed!
        if (key === 'shrine' || key === 'pillar' || key === 'shrine_candles' || key === 'coffin' || key === 'ribcage') {
          const obelisk = new THREE.Mesh(new THREE.CylinderGeometry(0.45 * scale, 0.65 * scale, 1.85 * scale, 6), fallbackStoneMat);
          obelisk.position.set(x, y + 0.92 * scale, z);
          obelisk.castShadow = true;
          obelisk.receiveShadow = true;
          parent.add(obelisk);
          return obelisk;
        }
        return null;
      }
      const inst = tpl.clone(true);
      const baseScale = tpl.scale.x || 1;
      const baseY = tpl.position.y || 0;
      inst.position.set(x, y + baseY * scale, z);
      inst.rotation.y = rotY;
      inst.scale.setScalar(baseScale * scale);
      parent.add(inst);
      inst.updateMatrixWorld(true);
      return inst;
    }

    // 1. Perimeter 3D Iron Fences, Stone Fence Pillars, Gothic Gates & Crimson Banners
    const fenceStep = 4.5;
    for (let v = -B; v <= B; v += fenceStep) {
      const isGateSlot = Math.abs(v) < 2.3;
      if (isGateSlot) {
        placeProp('arch_gate', 0, 0, -B, 0, 1.35);
        placeProp('banner_red', -2.6, 0, -B + 0.4, 0, 1.15);
        placeProp('banner_red', 2.6, 0, -B + 0.4, 0, 1.15);

        placeProp('arch', 0, 0, B, Math.PI, 1.35);
        placeProp('arch', -B, 0, 0, Math.PI / 2, 1.35);
        placeProp('arch', B, 0, 0, -Math.PI / 2, 1.35);
      } else {
        const fKeyN = Math.abs(v) % 9 < 4.5 ? 'fence' : 'fence_broken';
        placeProp(fKeyN, v, 0, -B, 0, 1.12);
        placeProp('fence_pillar', v + fenceStep * 0.5, 0, -B, 0, 1.15);

        const fKeyS = Math.abs(v + 3) % 9 < 4.5 ? 'fence' : 'fence_broken';
        placeProp(fKeyS, v, 0, B, Math.PI, 1.12);
        placeProp('fence_pillar', v + fenceStep * 0.5, 0, B, 0, 1.15);

        placeProp(fKeyN, -B, 0, v, Math.PI / 2, 1.12);
        placeProp(fKeyS, B, 0, v, -Math.PI / 2, 1.12);
      }
    }

    // 2. Outer 3D Landmarks & Frosted Pine Forest Ring (matching user's map silhouette in real 3D!)
    // Grand Crypt Mausoleum in North-West corner
    placeProp('crypt', -21.5, 0, -31.5, 0.35, 1.55);
    placeProp('banner_red', -17.2, 0, -28.0, 0.25, 1.25);
    placeProp('banner_red', -25.2, 0, -27.2, 0.42, 1.25);
    placeProp('post_lantern', -18.5, 0, -26.2, 0.2, 1.2);

    // North-East Ruined Sanctuary
    placeProp('arch', 20.5, 0, -30.5, -0.35, 1.45);
    placeProp('shrine_candles', 22.5, 0, -29.0, -0.4, 1.35);
    placeProp('banner_red', 17.5, 0, -27.5, -0.3, 1.2);

    // Dense 3D Frosted Pine Trees framing all 4 outer sides
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const dist = B + 4.2 + (i % 3) * 2.8;
      const tx = Math.cos(a) * dist;
      const tz = Math.sin(a) * dist;
      // Leave sightline clear right over the NW crypt entrance
      if (tx < -15 && tz < -25) continue;
      const pKey = i % 2 === 0 ? 'pine_large' : 'pine_med';
      placeProp(pKey, tx, 0, tz, i * 1.1, 1.25 + (i % 3) * 0.18);
    }

    // 3. The 7 Interior 3D Courtyard Landmarks (matching `obstacles` 1-to-1!)
    // Landmark 1 (-11.5, -9.0): Ruined Purple-Rune Altar Shrine
    placeProp('shrine_candles', -11.5, 0, -9.0, 0.5, 1.35);
    placeProp('pillar', -13.0, 0, -9.6, 0.2, 1.15);
    placeProp('pillar', -10.1, 0, -10.1, 1.4, 0.95);
    placeProp('candle_triple', -10.5, 0, -7.8, 0, 1.2);

    // Landmark 2 (13.0, -6.5): Gnarled Dead Lantern Tree & Giant Ribcage
    placeProp('tree_dead_large', 13.0, 0, -6.5, -0.4, 1.35);
    placeProp('lantern_standing', 11.4, 0, -5.6, 0.3, 1.15);
    placeProp('ribcage', 11.2, 0, -7.8, 0.65, 1.15);

    // Landmark 3 (-14.5, 5.5): Campfire Shrine (around our 3D flickering fire at -14.5, 5.5!)
    placeProp('pillar', -16.1, 0, 4.9, 0.3, 1.1);
    placeProp('barrels', -15.8, 0, 6.7, 0.9, 1.1);
    placeProp('post_lantern', -13.1, 0, 4.5, -0.4, 1.1);

    // Landmark 4 (1.5, -15.5): North Skull Candle Shrine
    placeProp('shrine', 1.5, 0, -15.5, 0.05, 1.28);
    placeProp('skull_candle', 0.4, 0, -14.6, 0.3, 1.25);
    placeProp('gravestone', 2.7, 0, -15.2, -0.25, 1.15);

    // Landmark 5 (-6.5, 12.5): South-West Coffin & Pillar Ruin
    placeProp('coffin', -6.5, 0, 12.5, 0.45, 1.2);
    placeProp('pillar', -7.7, 0, 12.0, 0.1, 1.0);
    placeProp('candle_triple', -5.4, 0, 11.8, 0, 1.15);

    // Landmark 6 (9.5, 11.5): South-East Rune Pillar Grave
    placeProp('pillar', 9.5, 0, 11.5, -0.4, 1.22);
    placeProp('gravestone', 10.7, 0, 11.1, -0.2, 1.2);
    placeProp('skull_candle', 8.6, 0, 10.8, 0.5, 1.2);

    // Landmark 7 (17.5, 6.0): East Ribcage & Stacked Crates
    placeProp('ribcage', 17.5, 0, 6.0, -0.6, 1.25);
    placeProp('crates', 18.7, 0, 5.2, 0.4, 1.1);
    placeProp('post_skull', 16.4, 0, 6.8, -0.3, 1.15);

    // 4. Glowing 3D Arcane Purple Crystal Clusters & Warm Candle Flames (like reference map!)
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      emissive: 0x9333ea,
      emissiveIntensity: 1.45,
      roughness: 0.18,
      metalness: 0.25
    });
    const crystalGeo = new THREE.ConeGeometry(0.24, 1.05, 5);
    crystalGeo.translate(0, 0.5, 0);

    const crystalBloomMat = registerAdaptiveBloomMat(
      new THREE.SpriteMaterial({
        map: bloomHaloTex,
        color: 0xc084fc,
        transparent: true,
        opacity: 0.34,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      }),
      0.34
    );

    function addCrystalCluster(cx, cz, scale = 1.0) {
      const grp = new THREE.Group();
      grp.position.set(cx, 0, cz);
      const specs = [
        { dx: 0, dz: 0, rx: 0.08, rz: -0.06, s: 1.15 },
        { dx: -0.26, dz: 0.18, rx: -0.28, rz: 0.32, s: 0.78 },
        { dx: 0.28, dz: 0.14, rx: 0.24, rz: -0.35, s: 0.84 },
        { dx: 0.06, dz: -0.26, rx: -0.32, rz: -0.15, s: 0.68 }
      ];
      for (const sp of specs) {
        const shard = new THREE.Mesh(crystalGeo, crystalMat);
        shard.position.set(sp.dx, -0.05, sp.dz);
        shard.rotation.set(sp.rx, 0, sp.rz);
        shard.scale.setScalar(sp.s * scale);
        shard.castShadow = true;
        grp.add(shard);
      }
      const cBloom = new THREE.Sprite(crystalBloomMat);
      cBloom.position.set(0, 0.72 * scale, 0);
      cBloom.scale.set(2.5 * scale, 2.5 * scale, 1);
      cBloom.renderOrder = 4;
      grp.add(cBloom);
      courtyardPropsGroup.add(grp);
    }

    addCrystalCluster(-9.6, -9.8, 0.95);
    addCrystalCluster(19.5, -16.5, 1.25);
    addCrystalCluster(-21.0, 18.5, 1.2);
    addCrystalCluster(21.5, 16.5, 1.25);
    addCrystalCluster(4.2, -23.5, 1.15);

    const candleFlameMat = new THREE.SpriteMaterial({
      map: softGlowTex,
      color: 0xffa028,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    });
    const candleBloomMat = registerAdaptiveBloomMat(
      new THREE.SpriteMaterial({
        map: bloomHaloTex,
        color: 0xff8c24,
        transparent: true,
        opacity: 0.36,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      }),
      0.36
    );
    const candleGlowCoords = [
      [-11.5, 1.45, -9.0],
      [-10.5, 0.68, -7.8],
      [0.4, 0.78, -14.6],
      [-5.4, 0.65, 11.8],
      [8.6, 0.75, 10.8],
      [11.4, 1.85, -5.6],
      [-13.1, 2.15, 4.5],
      [-18.5, 2.35, -26.2]
    ];
    for (const [fx, fy, fz] of candleGlowCoords) {
      const sp = new THREE.Sprite(candleFlameMat);
      sp.position.set(fx, fy, fz);
      sp.scale.set(0.85, 0.95, 1);
      courtyardPropsGroup.add(sp);

      const halo = new THREE.Sprite(candleBloomMat);
      halo.position.set(fx, fy, fz);
      halo.scale.set(2.45, 2.45, 1);
      halo.renderOrder = 4;
      courtyardPropsGroup.add(halo);
    }

    // Soft warm amber light pools painted onto cobblestones under courtyard campfire & key braziers
    const warmPoolMat = new THREE.MeshBasicMaterial({
      map: softGlowTex,
      color: 0xff8a24,
      transparent: true,
      opacity: 0.30,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    });
    const warmPoolGeo = new THREE.PlaneGeometry(1, 1);
    for (const [wx, wz, ws] of [
      [-14.5, 5.5, 8.8],
      [13.0, -6.5, 6.2],
      [1.5, -15.5, 5.4],
      [-6.5, 12.5, 5.4]
    ]) {
      const pool = new THREE.Mesh(warmPoolGeo, warmPoolMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(wx, 0.025, wz);
      pool.scale.set(ws, ws, 1);
      courtyardPropsGroup.add(pool);
    }
  })();

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
  // Pooled 3D Voxel Particle System (Single InstancedMesh Draw Call)
  // ==========================================================================
  const MAX_PARTICLES = 720;
  const partGeo = new THREE.OctahedronGeometry(0.62, 0);
  const partMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
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
      p.size = size * (0.75 + Math.random() * 0.45);
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

  const unitShockRingGeo = (() => {
    const g = new THREE.RingGeometry(0.82, 1.0, 36);
    g.rotateX(-Math.PI / 2);
    return g;
  })();
  const unitShockDiscGeo = (() => {
    const g = new THREE.CircleGeometry(0.96, 32);
    g.rotateX(-Math.PI / 2);
    return g;
  })();

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
      const ringMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const fillMat = new THREE.MeshBasicMaterial({
        map: arcaneCircleTex,
        color,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const ringMesh = new THREE.Mesh(unitShockRingGeo, ringMat);
      const fillMesh = new THREE.Mesh(unitShockDiscGeo, fillMat);
      fillMesh.position.y = -0.01;
      group.add(ringMesh, fillMesh);
      scene.add(group);
      sw = { group, ringMat, fillMat, radius: 1, age: 0, duration: 0.34 };
    } else {
      sw.ringMat.color.setHex(color);
      sw.fillMat.color.setHex(color);
      sw.ringMat.opacity = 0.95;
      sw.fillMat.opacity = 0.42;
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
        size: Math.max(2.6, Math.min(7.5, radius * 1.45)),
        duration: Math.min(0.42, Math.max(0.22, duration)),
        opacity: 0.56
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
  const debrisBoneMat = new THREE.MeshStandardMaterial({ color: 0xe7e0d0, roughness: 0.55, metalness: 0.05 });
  const debrisHelmMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.35, metalness: 0.75 });
  const debrisShieldMat = new THREE.MeshStandardMaterial({ color: 0x784828, roughness: 0.72, metalness: 0.22 });

  const activeDebris = [];
  const freeDebrisByKind = { skull: [], bone: [], helmet: [], shield: [] };

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
      } else {
        mesh = new THREE.Mesh(debrisBoneGeo, debrisBoneMat);
      }
      scene.add(mesh);
      d = { kind, mesh, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, vrx: 0, vry: 0, vrz: 0, age: 0, life: 0.9, baseScale: 1 };
    }
    d.mesh.visible = true;
    return d;
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
    const targetFov = isPortrait ? 48 : 40;
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov = targetFov;
      camera.updateProjectionMatrix();
    }

    // Keep (0, 0, 0) locked dead-center onto the stone pedestal of hub_stage_bg.jpg!
    currentHubShiftX = 0;

    const camZ = isPortrait ? 5.65 : 4.88;
    const camY = isPortrait ? 1.52 : 1.44;
    const lookY = isPortrait ? 0.60 : 0.72;

    const swayY = Math.sin(internalTime * 0.56) * 0.008;
    hubCamGoal.set(0, camY + swayY, camZ);

    if (snapNow || !dt || dt <= 0) {
      camera.position.copy(hubCamGoal);
    } else {
      const lerpFactor = 1 - Math.exp(-9.0 * Math.min(dt, 0.1));
      camera.position.lerp(hubCamGoal, lerpFactor);
    }
    camera.lookAt(0, lookY, 0);

    heroAuraLight.position.set(0, 2.3, 2.5);
    dirLight.position.set(3.4, 15.5, 5.2);
    dirLight.target.position.set(0, 0.75, 0);
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

    dirLight.castShadow = !lowSpecMode;
    const targetShadowRes = isMobileDevice
      ? 512
      : lowSpecMode
        ? 512
        : isSouls
          ? 2048
          : 1024;
    syncDirLightShadowMapSize(targetShadowRes);

    const combatShadExt = isSouls ? (isMobileDevice ? 13 : 11.8) : 21;
    dirLight.shadow.camera.left = -combatShadExt;
    dirLight.shadow.camera.right = combatShadExt;
    dirLight.shadow.camera.top = combatShadExt;
    dirLight.shadow.camera.bottom = -combatShadExt;
    dirLight.shadow.camera.near = isSouls ? 2 : 4;
    dirLight.shadow.camera.far = isSouls ? 62 : 75;
    dirLight.shadow.radius = isSouls ? 2.4 : 2.2;
    dirLight.shadow.bias = isSouls ? -0.0003 : -0.00035;
    dirLight.shadow.normalBias = isSouls ? 0.035 : 0.0;
    dirLight.shadow.camera.updateProjectionMatrix();

    plazaRuneMat.color.copy(combatPal.plazaRune);
    moteMat.color.copy(combatPal.plazaRune);
  }

  function setCameraMode(mode = 'combat') {
    const nextMode = mode === 'hub' ? 'hub' : 'combat';
    const changed = cameraMode !== nextMode;
    cameraMode = nextMode;

    if (cameraMode === 'hub') {
      scene.background = null;
      scene.environment = null;
      renderer.setClearColor(0x000000, 0);
      renderer.toneMappingExposure = HUB_EXPOSURE;
      arenaGroup.visible = false;
      motesPoints.visible = false;
      syncBiomeWeatherVisibility();
      hubKeySpotLight.visible = true;
      hubRimLight.visible = true;
      hubBackdropGroup.visible = true;
      const isArsenal = hubStageFocus === 'arsenal';
      hubArsenalGlowGroup.visible = isArsenal;
      hubContactAoMesh.visible = !isArsenal;
      hubShadowCatcher.visible = !isArsenal && !lowSpecMode;
      hubAnkleMistGroup.visible = !isArsenal;

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
      const sa = ensureSoulsArena();
      sa.group.visible = true;
      sa.setFogGateSealed(false);
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

    // Pre-seed 1 hidden pooled debris mesh per PBR material so first kill/break never compiles mid-combat
    if (activeDebris.length === 0) {
      const seedKinds = ['bone', 'helmet', 'shield'];
      for (let i = 0; i < seedKinds.length; i++) {
        const k = seedKinds[i];
        if (freeDebrisByKind[k] && freeDebrisByKind[k].length === 0) {
          const piece = acquireDebrisPiece(k);
          piece.mesh.visible = false;
          freeDebrisByKind[k].push(piece);
        }
      }
    }

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
      for (const [node, vis] of savedVis) {
        node.visible = vis;
      }
    }
  }

  // Free 3D Orbital Combat Camera State (RMB drag: yaw left/right & pitch up/down; Mouse wheel: zoom in/out)
  const DEFAULT_ORBIT_PITCH = Math.atan2(COMBAT_CAM_OFFSET.y - 0.5, COMBAT_CAM_OFFSET.z);
  const DEFAULT_ORBIT_DIST = Math.hypot(COMBAT_CAM_OFFSET.y - 0.5, COMBAT_CAM_OFFSET.z);
  const SOULS_DEFAULT_ORBIT_PITCH = 0.42;
  const SOULS_DEFAULT_ORBIT_DIST = 8.2;
  const SOULS_CAMERA_PIVOT_Y = 1.55;
  const SOULS_BOSS_LOCK_DIST_BONUS = 1.4;
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
    const minP = isSoulsBiome() ? 0.12 : 0.10;
    const maxP = isSoulsBiome() ? 1.10 : 1.48;
    orbitTargetPitch = Math.max(minP, Math.min(maxP, orbitTargetPitch + dPitch));
  }

  function applyFreeLookDelta(dx = 0, dy = 0) {
    if (cameraLocked) return;
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    orbitTargetYaw -= dx * 0.0024;
    const minP = isSoulsBiome() ? 0.12 : 0.14;
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
      devEditorsPromise = import('./world/devEditors.js?v=20261121z68')
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
    _lockOnTargetData.y = Number.isFinite(target.y) ? target.y : (target.isBoss ? 1.75 : 1.15);
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

  function followTarget(x = 0, z = 0, dt = 0.016) {
    if (cameraMode === 'hub') {
      lockOnTarget = null;
      lockOnReticle.visible = false;
      applyHubCameraPose(dt, false);
      return;
    }

    const clampedDt = Math.min(Math.max(dt || 0.016, 0), 0.1);
    lastHeroX = x;
    lastHeroZ = z;
    const groundY = getGroundHeight(x, z);
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
      // Keep towering boss comfortably framed when locked on in Souls mode (Elden Ring horizon)
      if (isSouls && lockOnTarget.isBoss) {
        const pitchNudge = 1 - Math.exp(-5.0 * clampedDt);
        if (orbitTargetPitch < 0.28) {
          orbitTargetPitch += (0.28 - orbitTargetPitch) * pitchNudge;
        } else if (orbitTargetPitch > 0.54) {
          orbitTargetPitch += (0.54 - orbitTargetPitch) * pitchNudge;
        }
      }
    }

    if (!hasFollowedOnce || !dt || dt <= 0) {
      targetX = x;
      targetY = groundY;
      targetZ = z;
      orbitYaw = orbitTargetYaw;
      orbitPitch = orbitTargetPitch;
      orbitDist = orbitTargetDist;
      soulsLockDistBonus = isSouls && lockOnTarget?.isBoss ? SOULS_BOSS_LOCK_DIST_BONUS : 0;
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

      const wantLockBonus = isSouls && lockOnTarget?.isBoss ? SOULS_BOSS_LOCK_DIST_BONUS : 0;
      soulsLockDistBonus += (wantLockBonus - soulsLockDistBonus) * (1 - Math.exp(-5.5 * clampedDt));
    }

    const pivotY = isSouls ? targetY + SOULS_CAMERA_PIVOT_Y : targetY + 0.85;

    // Smoothly interpolate weighted lookAt offset (Souls boss lock: 62% hero + 38% boss chest; PvE: 70% / 30%)
    const lockXzWeight = isSouls && lockOnTarget?.isBoss ? 0.38 : 0.30;
    const lockYWeight = isSouls && lockOnTarget?.isBoss ? 0.42 : 0.35;
    const wantLookOffX = lockOnTarget ? (lockOnTarget.x - targetX) * lockXzWeight : 0;
    const wantLookOffZ = lockOnTarget ? (lockOnTarget.z - targetZ) * lockXzWeight : 0;
    const wantLookOffY = lockOnTarget ? (lockOnTarget.y - pivotY) * lockYWeight : 0;
    const lookSmooth = (!dt || dt <= 0) ? 1 : (1 - Math.exp(-8.5 * clampedDt));
    lockLookOffsetX += (wantLookOffX - lockLookOffsetX) * lookSmooth;
    lockLookOffsetY += (wantLookOffY - lockLookOffsetY) * lookSmooth;
    lockLookOffsetZ += (wantLookOffZ - lockLookOffsetZ) * lookSmooth;

    // Update iconic 3D Lock-On reticle & subtle ground ring
    if (lockOnTarget) {
      lockOnPulseTime += clampedDt;
      const spPulse = 1 + Math.sin(lockOnPulseTime * 6.5) * 0.08;
      const ringPulse = 1 + Math.sin(lockOnPulseTime * 4.2) * 0.04;
      const spBase = lockOnTarget.isBoss ? 0.62 : 0.44;
      lockOnReticle.visible = true;
      lockOnSprite.position.set(lockOnTarget.x, lockOnTarget.y, lockOnTarget.z);
      lockOnSprite.scale.set(spBase * spPulse, spBase * spPulse, 1);
      const targetGroundY = getGroundHeight(lockOnTarget.x, lockOnTarget.z);
      lockOnFootRing.position.set(lockOnTarget.x, targetGroundY + 0.04, lockOnTarget.z);
      const ringScale = Math.max(0.65, lockOnTarget.radius * 1.15) * ringPulse;
      lockOnFootRing.scale.set(ringScale, ringScale, 1);
      lockOnFootRingMat.opacity = 0.28 + Math.sin(lockOnPulseTime * 4.2) * 0.08;
    } else {
      lockOnReticle.visible = false;
    }

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
      const pillarSafeDist = computeSoulsSafeCamDist(targetX, pivotY, targetZ, dirX, dirY, dirZ, desiredDist);
      let safeDist = pillarSafeDist;
      const doorStateNow = soulsArena?.getBossDoorState?.() || 'closed';
      if (!bossDoorCutsceneActive) {
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
      if (!bossDoorCutsceneActive) {
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

    if (bossDoorCutsceneActive && isSouls) {
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

    const snap = 0.5;
    const lx = Math.round(targetX / snap) * snap;
    const lz = Math.round(targetZ / snap) * snap;
    if (lx !== lastDirSnapX || lz !== lastDirSnapZ || isSouls !== lastDirSnapSouls) {
      lastDirSnapX = lx;
      lastDirSnapZ = lz;
      lastDirSnapSouls = isSouls;
      if (isSouls) {
        // ~50+ deg cool moonlit directional angle — casts crisp gothic shadows cleanly inside enclosed castle halls
        dirLight.position.set(lx + 11.5, 22.0, lz + 9.5);
      } else {
        dirLight.position.set(lx + 14, 28, lz + 16);
      }
      dirLight.target.position.set(lx, 0, lz);
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

    // Animate Chapter 26 Dark Souls castle bonfire, braziers, fog wall, dynamic light pool, roof & cutscene doors
    if (isSouls && soulsArena) {
      _soulsUpdateOpts.playerX = lastHeroX;
      _soulsUpdateOpts.playerZ = lastHeroZ;
      _soulsUpdateOpts.camX = camera.position.x;
      _soulsUpdateOpts.camY = camera.position.y;
      _soulsUpdateOpts.camZ = camera.position.z;
      _soulsUpdateOpts.cutsceneState = isBossDoorCutsceneActive() ? _cutsceneState : null;
      soulsArena.update(safeDt, t, _soulsUpdateOpts);
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
      sw.ringMat.opacity = (1 - p) * 0.95;
      sw.fillMat.opacity = (1 - p) * 0.42;
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

    // Update 3D Physics Debris (Skulls, Bones, Shields, Helmets)
    for (let i = activeDebris.length - 1; i >= 0; i--) {
      const d = activeDebris[i];
      d.age += safeDt;
      if (d.age >= d.life) {
        d.mesh.visible = false;
        activeDebris.splice(i, 1);
        (freeDebrisByKind[d.kind] || freeDebrisByKind.bone).push(d);
        continue;
      }
      d.vy -= 22 * safeDt;
      d.x += d.vx * safeDt;
      d.y += d.vy * safeDt;
      d.z += d.vz * safeDt;
      if (d.y < 0.09) {
        d.y = 0.09;
        d.vy = Math.abs(d.vy) * 0.42;
        d.vx *= 0.72;
        d.vz *= 0.72;
        d.vrx *= 0.78;
        d.vrz *= 0.78;
      }
      d.mesh.position.set(d.x, d.y, d.z);
      d.mesh.rotation.x += d.vrx * safeDt;
      d.mesh.rotation.y += d.vry * safeDt;
      d.mesh.rotation.z += d.vrz * safeDt;
      const rem = 1 - d.age / d.life;
      const sc = d.baseScale * (rem < 0.25 ? rem / 0.25 : 1.0);
      d.mesh.scale.setScalar(sc);
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
    dirLight.castShadow = !lowSpecMode;
    if (cameraMode === 'hub') {
      hubShadowCatcher.visible = hubStageFocus !== 'arsenal' && !lowSpecMode;
      syncDirLightShadowMapSize(isMobileDevice || lowSpecMode ? 512 : 1024);
    } else {
      syncDirLightShadowMapSize(
        isMobileDevice || lowSpecMode ? 512 : isSoulsBiome(currentBiome) ? 2048 : 1024
      );
    }
    refreshAdaptiveBloomMaterials();
    syncBiomeWeatherVisibility();
    mistyArena?.setLowSpecMode?.(lowSpecMode);
    soulsArena?.setLowSpecMode?.(lowSpecMode);
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
    resetCombatOrbit,
    setCameraMode,
    setArenaBiome,
    prewarmSoulsShaders,
    getBiomeForLevel,
    isArenaCircular,
    isSoulsArena: () => isSoulsBiome(currentBiome),
    getSurfaceType: (x = 0, z = 0) => {
      if (!isSoulsBiome(currentBiome)) return 'dirt';
      if (soulsArena?.getSurfaceType) return soulsArena.getSurfaceType(x, z);
      if (z >= 4.5) return 'stone_courtyard';
      if (z >= -10.5) return 'stone_bridge';
      return 'cathedral_stone';
    },
    setSoulsFogGate: (sealed) => soulsArena?.setFogGateSealed?.(Boolean(sealed)),
    getBossDoorState: () => soulsArena?.getBossDoorState?.() || 'closed',
    openBossDoors: () => soulsArena?.openBossDoors?.() ?? false,
    sealBossDoors: () => soulsArena?.sealBossDoors?.() ?? false,
    resetBossDoors: (keepOpen = false) => soulsArena?.resetBossDoors?.(Boolean(keepOpen)),
    tryBreakCandlesNear: (x, z, r = 0.72) => soulsArena?.tryBreakCandlesNear?.(x, z, r) || [],
    resetCandles: () => soulsArena?.resetCandles?.(),
    setShrineClaimed: (id, claimed = true) => soulsArena?.setShrineClaimed?.(id, claimed),
    getSoulsCastleLayout: () => soulsArena?.getSoulsCastleLayout?.() || soulsArena?.SOULS_CASTLE_ZONES || null,
    startBossDoorCutscene,
    isBossDoorCutsceneActive,
    getBossDoorCutsceneState,
    skipBossDoorCutscene,
    getActiveFlameBoxes: () => soulsArena?.getActiveFlameBoxes?.() || [],
    isPointInFlameTrap: (x, z, y = 0.6, r = 0.5) => Boolean(soulsArena?.isPointInFlameTrap?.(x, z, y, r)),
    getFlameTrapStates: () => soulsArena?.getFlameTrapStates?.() || [],
    isBossHallOccluded: (playerZ = 0) => Boolean(soulsArena?.isBossHallOccluded?.(playerZ)),
    clampSoulsPosition: (x, z, r = 0.5, opts = null) => soulsArena ? soulsArena.clampPosition(x, z, r, opts) : { x, z },
    getSoulsBonfirePos: () => soulsArena ? soulsArena.getBonfirePos() : { x: 0, z: 25 },
    setDebugColliders,
    setHubStageFocus,
    addScreenShake,
    spawnParticles,
    spawnMuzzleFlash,
    spawnShellCasing,
    spawnSlashArc,
    spawnShockwaveRing,
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
