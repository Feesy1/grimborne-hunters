// Authentic KayKit CC0 Rigged & Animated GLB Character + Enemy System (Three.js r160)
// Heroes match the user's Undead Dark-Fantasy Trio reference:
//   - Gunslinger (Стрелок): Hooded Skeleton with blazing orange eyes, red scarf, backpack & blunderbuss/shotgun
//   - Warrior (Воин): Horned-Helmet Armored Skeleton with blazing orange eyes, red cloak, broadsword & skull shield
//   - Mage (Маг): Wizard-Hat Robed Skeleton with blazing orange eyes, purple crystal staff & glowing potion flask

import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { DRACOLoader } from '../vendor/DRACOLoader.js';
import { clone as cloneSkinned } from '../vendor/SkeletonUtils.js';
import { WEAPONS } from './config.js?v=20261124z99';
import {
  getGeo,
  getMat,
  isMobileRuntimeDevice,
  disposeOwnedWeaponMaterials,
  createAnimController,
  setBoneRelEuler,
  solveMixamoArmIK
} from './models/shared.js?v=20261124z99';
import {
  getWarriorWeaponMountConfig,
  createWarriorStanceState,
  applyWarriorWeaponStance,
  applyWarriorAttackOverlay
} from './models/warriorStances.js?v=20261124z99';
import {
  computeFootSyncPlaybackRate,
  computeCombatPostureDynamics,
  applyCombatPostureToObject3D,
  applyCombatRecoilImpulse
} from './souls/soulsPhysicsFeel.js?v=20261124z99';
import { createActorContactShadowMesh } from './souls/soulsAtmosphere.js?v=20261124z99';
import {
  applyEldenDissolveToModel,
  resetEldenDissolveFromModel
} from './souls/soulsDissolveVfx.js?v=20261124z99';

const MODEL_PATHS = {
  // Warrior Knight (Mixamo Sword & Shield Run + Diagonal Slash + Turn_180 + Combat_Roll + Heavy_Thrust + Door_Push)
  warrior_run: './assets/models/Warrior_Run.glb?v=20261124z99',

  // All Warrior Melee Weapons + Shield (preserved for in-world discovery & future equipment!)
  sword_tripo: './assets/models/Sword_Tripo.glb?v=20261120z34',
  shield_custom: './assets/models/Shield_Custom.glb?v=20261120z34',
  great_club_tripo: './assets/models/Great_Club.glb?v=20261124z99',
  spear_tripo: './assets/models/Spear_Tripo.glb?v=20261120z34',
  zweihander_tripo: './assets/models/Zweihander_Tripo.glb?v=20261120z34',
  axe_tripo: './assets/models/Axe_Tripo.glb?v=20261120z34',
  hammer_tripo: './assets/models/Hammer_Tripo.glb?v=20261120z34',

  // Castle of Ash Enemies & Boss (Boss untouched!)
  rift_boss: './assets/models/Rift_Boss_Tripo.glb?v=20261124z99',
  rift_executioner: './assets/models/Rift_Executioner_Tripo.glb?v=20261124z99',
  rift_vanguard: './assets/models/Rift_Vanguard_Tripo.glb?v=20261124z99',
  rift_acolyte: './assets/models/Rift_Acolyte_Tripo.glb?v=20261124z99'
};

const gltfCache = new Map();
const inFlightModelLoads = new Map();
// Keys that failed to download (timeout / network error). They must not be
// re-queued forever: every battle would otherwise wait another 60 seconds.
const failedModelKeys = new Set();
let preloadPromise = null;
let sharedModelLoader = null;
let sharedDracoLoader = null;
const cachedEyeEmissiveTextures = new Map();
let cachedStaffGlobeAlphaTex = null;

// ============================================================================
// Fresnel Moonlit Rim-Light for Abandoned Knight Rift (0 extra draw calls!)
// Injected via onBeforeCompile on MeshStandardMaterial / MeshPhysicalMaterial
// right before <opaque_fragment> so USE_SKINNING, normalMap, emissiveMap (eyes),
// ACES tone-mapping, and abyss fog remain 100% intact.
// Auto-activates in souls_citadel (uSoulsRimStrength = 0.38) and stays 0.0 in
// Hub / PvE unless overridden via setSoulsRimLight(enabled, opts).
// ============================================================================
const SOULS_RIM_DEFAULT_STRENGTH = 0.16;
const SOULS_RIM_DEFAULT_POWER = 2.85;
const SOULS_RIM_COLOR_HEX = 0x687b9e;

const SOULS_RIM_UNIFORMS = {
  uSoulsRimColor: { value: new THREE.Color(SOULS_RIM_COLOR_HEX) },
  uSoulsRimStrength: { value: 0.0 },
  uSoulsRimPower: { value: SOULS_RIM_DEFAULT_POWER }
};
let soulsRimExplicitOverride = null;
let soulsRimCustomStrength = SOULS_RIM_DEFAULT_STRENGTH;

const SOULS_RIM_WEAPON_KEYS = new Set([
  'sword_tripo',
  'shield_custom',
  'great_club_tripo',
  'spear_tripo',
  'zweihander_tripo',
  'axe_tripo',
  'hammer_tripo'
]);

const SOULS_RIM_ENEMY_TYPES = new Set([
  'iron_knight',
  'cursed_footman',
  'bone_archer',
  'rift_executioner',
  'rift_vanguard',
  'rift_acolyte',
  'ember_skeleton',
  'boss_warden',
  'boss_troll'
]);

const SOULS_RIFT_ENEMY_MAP = {
  iron_knight: 'rift_executioner',
  cursed_footman: 'rift_vanguard',
  bone_archer: 'rift_acolyte',
  boss_warden: 'rift_boss',
  boss_troll: 'rift_boss'
};

const SOULS_RIFT_BIOME_KEYS = [
  'rift_executioner',
  'rift_vanguard',
  'rift_acolyte',
  'rift_boss',
  'troll_tripo'
];

function isSoulsLevelOrBiome(input) {
  if (!input) return false;
  if (typeof input === 'string') {
    const s = input.toLowerCase();
    return s === 'souls_citadel' || s === 'abandoned_knight_rift' || s === 'souls';
  }
  if (typeof input === 'number') {
    return input === 26;
  }
  if (typeof input === 'object') {
    return Boolean(
      input.isSoulslike ||
        input.isSouls ||
        input.biome === 'souls_citadel' ||
        Number(input.level) === 26
    );
  }
  return false;
}

function isSoulsBiomeActive(explicitOpts = null) {
  if (explicitOpts && typeof explicitOpts === 'object') {
    if (explicitOpts.isSouls === false || explicitOpts.forceKayKit === true) return false;
    if (
      explicitOpts.isSouls === true ||
      isSoulsLevelOrBiome(explicitOpts.biome) ||
      isSoulsLevelOrBiome(explicitOpts.levelDef)
    ) {
      return true;
    }
  }
  const worldApi = typeof window !== 'undefined' ? window.__grimborne?.world : null;
  if (worldApi && typeof worldApi.isSoulsArena === 'function') {
    return Boolean(worldApi.isSoulsArena());
  }
  return false;
}

function syncSoulsRimLightFromBiome() {
  if (soulsRimExplicitOverride !== null) {
    SOULS_RIM_UNIFORMS.uSoulsRimStrength.value = soulsRimExplicitOverride ? soulsRimCustomStrength : 0.0;
    return SOULS_RIM_UNIFORMS.uSoulsRimStrength.value;
  }
  const worldApi = typeof window !== 'undefined' ? window.__grimborne?.world : null;
  if (worldApi && typeof worldApi.isSoulsArena === 'function') {
    SOULS_RIM_UNIFORMS.uSoulsRimStrength.value = worldApi.isSoulsArena() ? soulsRimCustomStrength : 0.0;
  } else {
    SOULS_RIM_UNIFORMS.uSoulsRimStrength.value = 0.0;
  }
  return SOULS_RIM_UNIFORMS.uSoulsRimStrength.value;
}

export function setSoulsRimLight(enabled, opts = null) {
  if (enabled === null || enabled === undefined || enabled === 'auto') {
    soulsRimExplicitOverride = null;
    return syncSoulsRimLightFromBiome();
  }
  if (typeof opts === 'number' && Number.isFinite(opts)) {
    soulsRimCustomStrength = Math.max(0, Math.min(1.5, opts));
  } else if (opts && typeof opts === 'object') {
    const rawStr = opts.strength ?? opts.intensity;
    if (rawStr !== undefined && Number.isFinite(Number(rawStr))) {
      soulsRimCustomStrength = Math.max(0, Math.min(1.5, Number(rawStr)));
    }
    if (opts.power !== undefined && Number.isFinite(Number(opts.power))) {
      SOULS_RIM_UNIFORMS.uSoulsRimPower.value = Math.max(0.8, Math.min(8.0, Number(opts.power)));
    }
    if (opts.color !== undefined && opts.color !== null) {
      SOULS_RIM_UNIFORMS.uSoulsRimColor.value.set(opts.color);
    }
  }
  soulsRimExplicitOverride = Boolean(enabled);
  SOULS_RIM_UNIFORMS.uSoulsRimStrength.value = soulsRimExplicitOverride ? soulsRimCustomStrength : 0.0;
  return SOULS_RIM_UNIFORMS.uSoulsRimStrength.value;
}

export function getSoulsRimLightState() {
  syncSoulsRimLightFromBiome();
  return {
    enabled: SOULS_RIM_UNIFORMS.uSoulsRimStrength.value > 0.001,
    mode: soulsRimExplicitOverride === null ? 'auto' : 'manual',
    strength: SOULS_RIM_UNIFORMS.uSoulsRimStrength.value,
    power: SOULS_RIM_UNIFORMS.uSoulsRimPower.value,
    colorHex: `#${SOULS_RIM_UNIFORMS.uSoulsRimColor.value.getHexString()}`
  };
}

function applySoulsRimLight(mat) {
  if (!mat || !(mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial)) return mat;
  if (mat.userData?.hasSoulsRimLight) return mat;
  mat.userData = { ...(mat.userData || {}), hasSoulsRimLight: true };
  const hasOwnCompile = Object.prototype.hasOwnProperty.call(mat, 'onBeforeCompile') && typeof mat.onBeforeCompile === 'function';
  const prevOnBeforeCompile = hasOwnCompile ? mat.onBeforeCompile : null;
  const hasOwnCacheKey = Object.prototype.hasOwnProperty.call(mat, 'customProgramCacheKey') && typeof mat.customProgramCacheKey === 'function';
  const prevCacheKey = hasOwnCacheKey ? mat.customProgramCacheKey : null;
  mat.customProgramCacheKey = () => {
    const base = prevCacheKey ? prevCacheKey.call(mat) : '';
    return base ? `${base}|souls_moon_rim_v1` : 'souls_moon_rim_v1';
  };
  mat.onBeforeCompile = (shader, renderer) => {
    if (prevOnBeforeCompile) prevOnBeforeCompile.call(mat, shader, renderer);
    shader.uniforms.uSoulsRimColor = SOULS_RIM_UNIFORMS.uSoulsRimColor;
    shader.uniforms.uSoulsRimStrength = SOULS_RIM_UNIFORMS.uSoulsRimStrength;
    shader.uniforms.uSoulsRimPower = SOULS_RIM_UNIFORMS.uSoulsRimPower;
    if (!shader.fragmentShader.includes('uSoulsRimStrength')) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
uniform vec3 uSoulsRimColor;
uniform float uSoulsRimStrength;
uniform float uSoulsRimPower;`
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        `if ( uSoulsRimStrength > 0.001 ) {
  float soulsNdotV = clamp( dot( geometryNormal, geometryViewDir ), 0.0, 1.0 );
  float soulsFresnel = pow( max( 1.0 - soulsNdotV, 0.0001 ), uSoulsRimPower );
  float soulsTopMask = smoothstep( -0.35, 0.55, geometryNormal.y );
  outgoingLight += uSoulsRimColor * ( soulsFresnel * ( 0.35 + 0.65 * soulsTopMask ) * uSoulsRimStrength );
}
#include <opaque_fragment>`
      );
    }
  };
  mat.needsUpdate = true;
  return mat;
}

function applySoulsRimLightToObject(obj) {
  if (!obj) return;
  obj.traverse((n) => {
    if (!n.isMesh || !n.material) return;
    if (/Eyes/i.test(n.name || '')) return;
    if (Array.isArray(n.material)) {
      for (let i = 0; i < n.material.length; i++) applySoulsRimLight(n.material[i]);
    } else {
      applySoulsRimLight(n.material);
    }
  });
}

function buildStaffGlobeCutoutAlphaMap(img) {
  if (cachedStaffGlobeAlphaTex) return cachedStaffGlobeAlphaTex;
  if (!img || typeof document === 'undefined') return null;
  const imgW = img.width || img.naturalWidth || 0;
  const imgH = img.height || img.naturalHeight || 0;
  if (!imgW || !imgH) return null;

  const size = 256;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, size, size);
  const imgData = ctx.getImageData(0, 0, size, size);
  const d = imgData.data;

  // Dissolve ONLY the interior cyan/turquoise globe pixels while keeping 100% of olive/gold/coral wood claws!
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const isCyanGlobe = g > 118 && b > 116 && r < 96 && g - r > 44 && b - r > 38;
    const val = isCyanGlobe ? 0 : 255;
    d[i] = val;
    d[i + 1] = val;
    d[i + 2] = val;
    d[i + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  const tex = new THREE.CanvasTexture(cv);
  tex.flipY = false;
  tex.needsUpdate = true;
  cachedStaffGlobeAlphaTex = tex;
  return tex;
}

const ELEMENT_VORTEX_PALETTES = {
  water:     { deep: 0x02648c, mid: 0x06c8cc, core: 0xbefcf6, ribbon: 0x16c5c9, drop: 0x7ef9f5 },
  fire:      { deep: 0x7f1d1d, mid: 0xea580c, core: 0xfef08a, ribbon: 0xf97316, drop: 0xfde047 },
  lightning: { deep: 0x1e3a8a, mid: 0x0284c7, core: 0xfef9c3, ribbon: 0x38bdf8, drop: 0xfef08a },
  air:       { deep: 0x115e59, mid: 0x14b8a6, core: 0xccfbf1, ribbon: 0x5eead4, drop: 0xf0fdfa }
};

function createLivingStaffOrbVfx(orbRadius = 9.95, initialElement = 'water') {
  const pal = ELEMENT_VORTEX_PALETTES[initialElement] || ELEMENT_VORTEX_PALETTES.water;
  const grp = new THREE.Group();

  // 1. Single Seamless Sculpted Spiral Whirlpool Sphere (Matches fb044451.mp4 & bcf5a263.mp4 1-to-1:
  //    ZERO nested concentric rings, ZERO polar pinch, real wet 3D wave-crest relief!)
  const vortexUniforms = {
    uTime: { value: 0 },
    uCastPulse: { value: 0 },
    uColorDeep: { value: new THREE.Color(pal.deep) },
    uColorMid: { value: new THREE.Color(pal.mid) },
    uColorCore: { value: new THREE.Color(pal.core) }
  };

  const vortexMat = new THREE.ShaderMaterial({
    uniforms: vortexUniforms,
    transparent: true,
    depthWrite: true,
    extensions: { derivatives: true },
    vertexShader: `
      uniform float uTime;
      uniform float uCastPulse;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      varying vec3 vLocalDir;
      void main() {
        vec3 n = normalize(normal);
        vLocalDir = n;
        float w1 = sin(n.x * 4.2 + uTime * 3.8) * cos(n.y * 3.9 - uTime * 3.1);
        float w2 = sin(n.z * 4.5 - uTime * 4.4 + n.y * 3.2);
        float ripple = (w1 * 0.55 + w2 * 0.45) * (0.032 + uCastPulse * 0.055);
        vec3 displaced = position * (1.0 + uCastPulse * 0.10) + n * (length(position) * ripple);
        vec4 mvPos = modelViewMatrix * vec4(displaced, 1.0);
        vNormalV = normalize(normalMatrix * n);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uCastPulse;
      uniform vec3 uColorDeep;
      uniform vec3 uColorMid;
      uniform vec3 uColorCore;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      varying vec3 vLocalDir;

      float gyroid(vec3 p) {
        return dot(sin(p), cos(p.yzx));
      }

      void main() {
        vec3 N = normalize(vNormalV);
        vec3 V = normalize(vViewDir);
        float ndv = clamp(dot(N, V), 0.0, 1.0);

        // View-aligned spiral whirlpool coordinates (pinch-free at r -> 0!)
        vec2 disk = N.xy;
        float r = clamp(length(disk), 0.0, 1.0);
        float theta = atan(disk.y, disk.x);
        float spiralFade = smoothstep(0.0, 0.24, r) * smoothstep(1.0, 0.78, r);

        // 2-arm + 3-arm logarithmic whirlpool curling inward continuously
        float armA = sin(theta * 2.0 - r * 9.5 + uTime * 4.4);
        float armB = sin(theta * 3.0 - r * 13.0 + uTime * 5.8 + 1.2);
        float spiralWave = (armA * 0.62 + armB * 0.38) * spiralFade;

        // Pole-free 3D rotating gyroid liquid currents for organic volume from every camera angle
        float c = cos(uTime * 1.35);
        float s = sin(uTime * 1.35);
        vec3 pRot = vec3(vLocalDir.x * c - vLocalDir.z * s, vLocalDir.y, vLocalDir.x * s + vLocalDir.z * c);
        float g1 = gyroid(pRot * 4.2 + vec3(0.0, -uTime * 2.2, uTime * 1.6)) / 1.7;
        float g2 = gyroid(pRot * 7.8 - vec3(uTime * 2.8, uTime * 1.9, 0.0)) / 2.2;

        float eyeGlow = exp(-r * r * 13.5) * (0.72 + 0.28 * sin(uTime * 5.2));
        float height = clamp(0.50 + spiralWave * 0.34 + g1 * 0.24 + g2 * 0.12 + eyeGlow * 0.30, 0.0, 1.0);

        // Screen-space derivative normal perturbation for glossy 3D sculpted water crests!
        float dhx = dFdx(height);
        float dhy = dFdy(height);
        vec3 nPerturb = normalize(N - vec3(dhx, dhy, 0.0) * 3.6);
        vec3 lightDir = normalize(vec3(-0.38, 0.62, 0.68));
        float wetSpec = pow(max(dot(nPerturb, lightDir), 0.0), 22.0);
        float fresnel = pow(1.0 - ndv, 2.6);

        vec3 col = mix(uColorDeep, uColorMid, smoothstep(0.18, 0.72, height));
        float foamCrest = smoothstep(0.64, 0.95, height) * 0.68 + eyeGlow * 0.48 + fresnel * 0.45 + uCastPulse * 0.72;
        col = mix(col, uColorCore, clamp(foamCrest, 0.0, 1.0));
        col += vec3(0.88, 1.0, 0.99) * (wetSpec * 0.62);

        float edgeSoft = smoothstep(0.0, 0.08, ndv);
        float alpha = clamp((0.86 + fresnel * 0.12 + uCastPulse * 0.10) * edgeSoft, 0.0, 0.98);
        gl_FragColor = vec4(col, alpha);
      }
    `
  });

  const liquidSphereGeo = new THREE.SphereGeometry(orbRadius, 36, 30);
  const liquidSphere = new THREE.Mesh(liquidSphereGeo, vortexMat);
  grp.add(liquidSphere);

  // 2. Glossy Undulating Turquoise Water Ribbon hugging the S-curve wooden shaft (Matches fb044451.mp4!)
  const streamUniforms = {
    uTime: { value: 0 },
    uCastPulse: { value: 0 },
    uStreamDeep: { value: new THREE.Color(pal.deep) },
    uStreamCol: { value: new THREE.Color(pal.ribbon) },
    uFoamCol: { value: new THREE.Color(pal.core) }
  };
  const shaftPts = [];
  for (let s = 0; s <= 36; s++) {
    const u = s / 36;
    const ang = u * Math.PI * 3.2 + 0.55;
    const shaftCenterX = 3.5 * Math.min(1, u * 2.0);
    const rad = orbRadius * (0.44 - u * 0.16 + Math.sin(u * Math.PI * 2.0) * 0.09);
    const yy = -orbRadius * 0.86 - u * (orbRadius * 5.9);
    shaftPts.push(new THREE.Vector3(shaftCenterX + Math.cos(ang) * rad, yy, Math.sin(ang) * rad));
  }
  const shaftCurve = new THREE.CatmullRomCurve3(shaftPts);
  const shaftStreamGeo = new THREE.TubeGeometry(shaftCurve, 48, orbRadius * 0.125, 8, false);
  const sPos = shaftStreamGeo.attributes.position;
  const sUv = shaftStreamGeo.attributes.uv;
  const cPt = new THREE.Vector3();
  const vTmp = new THREE.Vector3();
  for (let i = 0; i < sPos.count; i++) {
    const u = Math.min(1, Math.max(0, sUv.getX(i)));
    const taper = Math.sin(u * Math.PI);
    shaftCurve.getPointAt(u, cPt);
    vTmp.fromBufferAttribute(sPos, i).sub(cPt).multiplyScalar(0.22 + 0.90 * taper).add(cPt);
    sPos.setXYZ(i, vTmp.x, vTmp.y, vTmp.z);
  }
  sPos.needsUpdate = true;
  shaftStreamGeo.computeVertexNormals();

  const shaftStreamMat = new THREE.ShaderMaterial({
    uniforms: streamUniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNormV;
      void main() {
        vUv = uv;
        vec3 p = position;
        float sway = sin(uv.x * 14.0 - uTime * 5.2) * 0.42 * sin(uv.x * 3.14159);
        p += normal * sway;
        vNormV = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uCastPulse;
      uniform vec3 uStreamDeep;
      uniform vec3 uStreamCol;
      uniform vec3 uFoamCol;
      varying vec2 vUv;
      varying vec3 vNormV;
      void main() {
        float endFade = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.84, vUv.x);
        float flow = 0.5 + 0.5 * sin(vUv.x * 20.0 - uTime * 6.8 + sin(vUv.y * 6.2831) * 1.5);
        float spec = pow(max(dot(normalize(vNormV), normalize(vec3(-0.35, 0.65, 0.7))), 0.0), 14.0);
        vec3 col = mix(uStreamDeep, uStreamCol, 0.35 + 0.65 * flow);
        col = mix(col, uFoamCol, pow(flow, 2.6) * 0.55 + spec * 0.55 + uCastPulse * 0.45);
        float alpha = endFade * (0.62 + 0.28 * flow + uCastPulse * 0.10);
        gl_FragColor = vec4(col, alpha);
      }
    `
  });
  const shaftStreamMesh = new THREE.Mesh(shaftStreamGeo, shaftStreamMat);
  grp.add(shaftStreamMesh);

  // 3. Radial Charge-Flash Rays on Attack
  const burstGroup = new THREE.Group();
  burstGroup.visible = false;
  const burstMat = new THREE.MeshBasicMaterial({
    color: pal.core,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const rayGeo = new THREE.ConeGeometry(orbRadius * 0.08, orbRadius * 1.05, 5);
  rayGeo.translate(0, orbRadius * 1.25, 0);
  for (let r = 0; r < 8; r++) {
    const ray = new THREE.Mesh(rayGeo, burstMat);
    ray.rotation.z = (r / 8) * Math.PI * 2;
    ray.rotation.x = (r % 2 === 0 ? 1 : -1) * 0.38;
    burstGroup.add(ray);
  }
  grp.add(burstGroup);

  // 4. Glossy Rising Teardrop Water Droplets around the coral tips & lower stream (Matches fb044451.mp4!)
  const dropGeo = new THREE.SphereGeometry(orbRadius * 0.072, 10, 10);
  const dropMat = new THREE.MeshStandardMaterial({
    color: pal.ribbon,
    emissive: pal.drop,
    emissiveIntensity: 0.65,
    roughness: 0.12,
    metalness: 0.05,
    transparent: true,
    opacity: 0.88
  });
  const droplets = [];
  for (let d = 0; d < 9; d++) {
    const dMesh = new THREE.Mesh(dropGeo, dropMat);
    grp.add(dMesh);
    droplets.push(dMesh);
  }

  function setElementTheme(elemId) {
    const p = ELEMENT_VORTEX_PALETTES[elemId] || ELEMENT_VORTEX_PALETTES.water;
    vortexUniforms.uColorDeep.value.setHex(p.deep);
    vortexUniforms.uColorMid.value.setHex(p.mid);
    vortexUniforms.uColorCore.value.setHex(p.core);
    streamUniforms.uStreamDeep.value.setHex(p.deep);
    streamUniforms.uStreamCol.value.setHex(p.ribbon);
    streamUniforms.uFoamCol.value.setHex(p.core);
    burstMat.color.setHex(p.core);
    dropMat.color.setHex(p.ribbon);
    dropMat.emissive.setHex(p.drop);
  }

  function updateVfx(elapsedTime = 0, castPulse = 0) {
    vortexUniforms.uTime.value = elapsedTime;
    vortexUniforms.uCastPulse.value = castPulse;
    streamUniforms.uTime.value = elapsedTime;
    streamUniforms.uCastPulse.value = castPulse;

    if (castPulse > 0.03) {
      burstGroup.visible = true;
      burstGroup.rotation.y = elapsedTime * 5.0;
      const bScale = 0.78 + (1.0 - castPulse) * 0.58;
      burstGroup.scale.setScalar(bScale);
      burstMat.opacity = castPulse * 0.80;
    } else {
      burstGroup.visible = false;
    }

    for (let i = 0; i < droplets.length; i++) {
      const dm = droplets[i];
      const uRise = ((elapsedTime * (0.48 + (i % 4) * 0.12) + i * 0.37) % 1);
      const fade = Math.sin(uRise * Math.PI);
      const isLower = i >= 6;
      const a = i * 2.15 + Math.sin(elapsedTime * 1.8 + i) * 0.35;
      const rad = orbRadius * (isLower ? 0.62 : 1.16 + (i % 2) * 0.14);
      const yy = isLower
        ? -orbRadius * (4.4 - uRise * 2.6)
        : -orbRadius * 0.55 + uRise * (orbRadius * 1.85);
      dm.position.set((isLower ? 3.2 : 0) + Math.cos(a) * rad, yy, Math.sin(a) * rad);
      const sc = (0.45 + 0.65 * fade) * (1.0 + castPulse * 0.35);
      dm.scale.set(sc * 0.88, sc * 1.24, sc * 0.88);
    }
  }

  function dispose() {
    liquidSphereGeo.dispose();
    shaftStreamGeo.dispose();
    rayGeo.dispose();
    dropGeo.dispose();
    vortexMat.dispose();
    shaftStreamMat.dispose();
    burstMat.dispose();
    dropMat.dispose();
  }

  return { group: grp, setElementTheme, updateVfx, dispose };
}

function buildTripoSkullEyeEmissiveMap(cacheKey, sceneRoot) {
  if (cachedEyeEmissiveTextures.has(cacheKey) || typeof document === 'undefined') {
    return cachedEyeEmissiveTextures.get(cacheKey) || null;
  }
  let targetMesh = null;
  sceneRoot.updateMatrixWorld(true);
  sceneRoot.traverse((n) => {
    if (!n.isMesh || !n.geometry?.attributes?.position || !n.geometry?.attributes?.uv || !n.material?.map?.image) {
      return;
    }
    if (cacheKey === 'gunslinger_tripo' && !/tripo_part_0/i.test(n.name || '')) {
      return;
    }
    if (!targetMesh) {
      targetMesh = n;
    }
  });
  if (!targetMesh) return null;

  const img = targetMesh.material.map.image;
  const imgW = img.width || img.naturalWidth || 0;
  const imgH = img.height || img.naturalHeight || 0;
  if (!imgW || !imgH) return null;

  // Find UV bounding region of front skull face vertices in scene space
  const posAttr = targetMesh.geometry.attributes.position;
  const uvAttr = targetMesh.geometry.attributes.uv;
  const matW = targetMesh.matrixWorld;
  const vPos = new THREE.Vector3();
  const faceCells = new Uint8Array(64 * 64);
  let foundAnyFace = false;

  if (cacheKey === 'tree_tripo') {
    faceCells.fill(1);
    foundAnyFace = true;
  } else {
    for (let i = 0; i < posAttr.count; i++) {
      vPos.fromBufferAttribute(posAttr, i).applyMatrix4(matW);
      if (vPos.y > 0.48 && vPos.y < 0.78 && vPos.z > 0.035 && Math.abs(vPos.x) < 0.145) {
        let u = uvAttr.getX(i);
        let v = uvAttr.getY(i);
        u = ((u % 1) + 1) % 1;
        v = ((v % 1) + 1) % 1;
        const cx = Math.min(63, Math.max(0, Math.floor(u * 64)));
        const cy = Math.min(63, Math.max(0, Math.floor(v * 64)));
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx >= 0 && nx < 64 && ny >= 0 && ny < 64) {
              faceCells[ny * 64 + nx] = 1;
              foundAnyFace = true;
            }
          }
        }
      }
    }
  }
  if (!foundAnyFace) return null;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, size, size);
  const imgData = ctx.getImageData(0, 0, size, size);
  const d = imgData.data;

  for (let py = 0; py < size; py++) {
    const cy = Math.min(63, Math.floor((py / size) * 64));
    for (let px = 0; px < size; px++) {
      const cx = Math.min(63, Math.floor((px / size) * 64));
      const idx = (py * size + px) * 4;
      if (!faceCells[cy * 64 + cx]) {
        d[idx] = 0;
        d[idx + 1] = 0;
        d[idx + 2] = 0;
        d[idx + 3] = 255;
        continue;
      }
      const r = d[idx];
      const g = d[idx + 1];
      const b = d[idx + 2];
      // Isolate blazing red/orange/yellow eye socket glow from pale skull bone & armor/hood
      if (r > 185 && g > 55 && r > b * 1.42 && r - b > 70) {
        const boost = Math.min(1, (r - 175) / 75);
        d[idx] = Math.min(255, Math.round(r * (0.85 + boost * 0.25)));
        d[idx + 1] = Math.min(255, Math.round(g * (0.75 + boost * 0.25)));
        d[idx + 2] = Math.round(b * 0.25);
      } else {
        d[idx] = 0;
        d[idx + 1] = 0;
        d[idx + 2] = 0;
      }
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  cachedEyeEmissiveTextures.set(cacheKey, tex);
  return tex;
}

function getWeaponAssetKey(weaponId = 'club') {
  if (weaponId === 'great_club') return 'great_club_tripo';
  if (weaponId === 'spear' || weaponId === 'cleaver') return 'spear_tripo';
  if (weaponId === 'zweihander') return 'zweihander_tripo';
  if (weaponId === 'axe' || weaponId === 'flail') return 'axe_tripo';
  if (weaponId === 'boss_hammer') return 'hammer_tripo';
  if (weaponId === 'usp_pistol') return 'pistol_tripo';
  if (weaponId === 'colt') return 'colt_tripo';
  if (weaponId === 'smg') return 'smg_tripo';
  if (weaponId === 'ak47') return 'ak47_tripo';
  if (weaponId === 'pistol' || weaponId === 'blunderbuss' || weaponId === 'gatling') return 'shotgun_tripo';
  if (weaponId === 'colt') return null; // procedural chrome revolver
  if (weaponId === 'spark_staff' || weaponId === 'void_orb') return 'staff_tripo';
  return 'sword_tripo';
}

function getHeroAssetKey(classId = 'warrior') {
  if (classId === 'gunslinger') return MODEL_PATHS.gunslinger_tripo ? 'gunslinger_tripo' : 'skel_minion';
  if (classId === 'mage') return 'mage_tripo';
  return MODEL_PATHS.warrior_run ? 'warrior_run' : 'skel_warrior';
}

function loadSingleModelKey(key) {
  if (!key || !MODEL_PATHS[key] || gltfCache.has(key) || failedModelKeys.has(key)) return Promise.resolve();
  if (inFlightModelLoads.has(key)) return inFlightModelLoads.get(key);
  if (!sharedModelLoader) {
    sharedModelLoader = new GLTFLoader();
    if (!sharedDracoLoader) {
      sharedDracoLoader = new DRACOLoader();
      sharedDracoLoader.setDecoderPath('./vendor/draco/');
    }
    sharedModelLoader.setDRACOLoader(sharedDracoLoader);
  }
  const url = MODEL_PATHS[key];
  const isMobile = isMobileRuntimeDevice();

  const p = new Promise((resolve) => {
    let settled = false;
    let attempt = 0;
    const finish = () => {
      if (settled) return;
      settled = true;
      inFlightModelLoads.delete(key);
      resolve();
    };
    const timer = setTimeout(() => {
      failedModelKeys.add(key);
      console.warn(`[models] Timeout loading ${url}, continuing with fallback (marked failed, will not retry this session)`);
      finish();
    }, 60000);

    const tryLoad = () => {
      attempt += 1;
      sharedModelLoader.load(
        url,
        (gltf) => {
          clearTimeout(timer);
          const clipMap = new Map();
          let warriorIdleHipsX = null;
          let warriorIdleHipsZ = null;
          if (key === 'warrior_run') {
            const idleRaw = (gltf.animations || []).find((c) => /^Idle(?:\.\d+)?$/i.test(c?.name || ''));
            const idleHipsTr = idleRaw?.tracks?.find((tr) => /^mixamorig:?Hips\.position$/i.test(tr?.name || ''));
            if (idleHipsTr?.values && idleHipsTr.values.length >= 3) {
              warriorIdleHipsX = idleHipsTr.values[0];
              warriorIdleHipsZ = idleHipsTr.values[2];
            }
          }
          for (const clip of gltf.animations || []) {
            // Normalize Blender-exported clips whose keyframes start at a non-zero timestamp (e.g. t0 = 0.0333s or 0.0417s).
            // Three.js loops [0, clip.duration], so t0 > 0 causes a 1-2 frame freeze + snap on every loop wrap.
            // Clone each unique times buffer per clip because GLTFLoader shares input accessors across tracks/clips.
            let minT = Infinity;
            for (const tr of clip.tracks || []) {
              if (tr?.times && tr.times.length > 0 && tr.times[0] < minT) {
                minT = tr.times[0];
              }
            }
            if (minT > 0.0001 && minT < 0.2) {
              const shiftedTimesCache = new Map();
              for (const tr of clip.tracks || []) {
                if (!tr?.times || tr.times.length === 0) continue;
                let shifted = shiftedTimesCache.get(tr.times);
                if (!shifted) {
                  const src = tr.times;
                  shifted = new Float32Array(src.length);
                  for (let i = 0; i < src.length; i++) {
                    shifted[i] = Math.max(0, src[i] - minT);
                  }
                  shiftedTimesCache.set(src, shifted);
                }
                tr.times = shifted;
              }
              clip.resetDuration();
            }
            // Strip lower-body leg tracks from Gunslinger Shoot_A / Shoot_B so 4-way movement legs stay crisp while firing!
            if (key === 'gunslinger_tripo' && /^Shoot_[AB](?:\.\d+)?$/i.test(clip.name || '')) {
              clip.tracks = (clip.tracks || []).filter((tr) => {
                const nodePart = (tr?.name || '').split('.')[0] || '';
                return !/(?:UpLeg|Leg|Foot|Toe)/i.test(nodePart);
              });
            }
            // Warrior Mixamo/custom clips:
            // 1) Convert Running_A & Running_Back to true in-place loops by detrending horizontal Hips.position.z drift
            //    (preserves vertical bounce & lateral sway while eliminating loop-wrap snaps).
            // 2) For melee attack clips (1H_Melee_Attack_Slice_Horizontal, Slash, Attack), build BOTH:
            //    a) <name>__Full (full-body footwork + linear X/Z drift compensation) for standing attacks from Idle;
            //    b) <name> (upper-body masked) for attacking on the move over Running_A__Lower / Running_Back__Lower.
            //    Block stays upper-body masked only.
            // 3) Stabilize Idle lower-body (Hips + legs/feet/toes) to frame 0 so both boots stay rock-solid planted
            //    on the Hub pedestal with zero knee/foot micro-twitch while keeping natural upper-body breathing.
            if (key === 'warrior_run') {
              const LOWER_BODY_RE = /(?:Hips|UpLeg|Leg|Foot|Toe)/i;
              if (/^(?:Running_A|Sprint_A|Running_Back)(?:\.\d+)?$/i.test(clip.name || '')) {
                const legMeans = new Map();
                for (const tr of clip.tracks || []) {
                  if (/^mixamorig:?Hips\.position$/i.test(tr?.name || '') && tr.values && tr.values.length >= 6) {
                    const v = tr.values;
                    const count = Math.floor(v.length / 3);
                    const z0 = v[2];
                    const z1 = v[(count - 1) * 3 + 2];
                    const dz = z1 - z0;
                    const denom = Math.max(1, count - 1);
                    for (let i = 0; i < count; i++) {
                      v[i * 3 + 2] -= z0 + dz * (i / denom);
                    }
                  } else if (/^(?:Running_A|Sprint_A)(?:\.\d+)?$/i.test(clip.name || '') && /^mixamorig:?(LeftUpLeg|RightUpLeg|LeftLeg|RightLeg)\.quaternion$/i.test(tr?.name || '') && tr.values && tr.values.length >= 8) {
                    const m = tr.name.match(/^mixamorig:?(LeftUpLeg|RightUpLeg|LeftLeg|RightLeg)\.quaternion$/i);
                    const v = tr.values;
                    const cnt = Math.floor(v.length / 4);
                    let sx = v[0], sy = v[1], sz = v[2], sw = v[3];
                    for (let i = 1; i < cnt; i++) {
                      let x = v[i * 4], y = v[i * 4 + 1], z = v[i * 4 + 2], w = v[i * 4 + 3];
                      if (x * sx + y * sy + z * sz + w * sw < 0) { x = -x; y = -y; z = -z; w = -w; }
                      sx += x; sy += y; sz += z; sw += w;
                    }
                    const qMean = new THREE.Quaternion(sx, sy, sz, sw).normalize();
                    legMeans.set(m[1], qMean);
                  }
                }
                if (legMeans.size > 0) clip.userData = { ...(clip.userData || {}), legMeans };
              } else if (/^(?:1H_Melee_Attack_Slice_Horizontal|Slash|Attack|Heavy_Thrust|Club_Attack_1|Club_Attack_2|Club_Attack_3|Block)(?:\.\d+)?$/i.test(clip.name || '')) {
                const cleanAtkName = (clip.name || '').replace(/\.\d+$/, '');
                const isMeleeAttackClip = /^(?:1H_Melee_Attack_Slice_Horizontal|Slash|Attack|Heavy_Thrust|Club_Attack_1|Club_Attack_2|Club_Attack_3)$/i.test(cleanAtkName);
                if (isMeleeAttackClip) {
                  // a) Full-body variant (<name>__Full) for standing attacks:
                  //    Preserves ALL leg/foot/hips rotations and natural mid-swing step/lunge displacement,
                  //    removing only linear net X/Z drift in Hips.position so frame 0 & end match Idle seamlessly.
                  const fullName = `${cleanAtkName}__Full`;
                  if (!clipMap.has(fullName)) {
                    const fullTracks = (clip.tracks || []).map((tr) => {
                      if (/^mixamorig:?Hips\.position$/i.test(tr?.name || '') && tr.values && tr.values.length >= 6) {
                        const v = tr.values;
                        const count = Math.floor(v.length / 3);
                        const outV = new Float32Array(v.length);
                        const x0 = v[0];
                        const z0 = v[2];
                        const x1 = v[(count - 1) * 3];
                        const z1 = v[(count - 1) * 3 + 2];
                        const dx = x1 - x0;
                        const dz = z1 - z0;
                        const denom = Math.max(1, count - 1);
                        const baseOffX = warriorIdleHipsX !== null ? x0 - warriorIdleHipsX : 0;
                        const baseOffZ = warriorIdleHipsZ !== null ? z0 - warriorIdleHipsZ : 0;
                        for (let i = 0; i < count; i++) {
                          const frac = i / denom;
                          outV[i * 3] = v[i * 3] - baseOffX - dx * frac;
                          outV[i * 3 + 1] = v[i * 3 + 1];
                          outV[i * 3 + 2] = v[i * 3 + 2] - baseOffZ - dz * frac;
                        }
                        return new THREE.VectorKeyframeTrack(tr.name, tr.times.slice(), outV);
                      }
                      return tr;
                    });
                    const fullClip = new THREE.AnimationClip(fullName, clip.duration, fullTracks);
                    fullClip.userData = {
                      ...(clip.userData || {}),
                      isFullBodyAttack: true,
                      maskedClipName: cleanAtkName
                    };
                    clipMap.set(fullName, fullClip);
                  }
                }
                // b) Upper-body masked variant (<name>) for attacking while running over Running_A__Lower
                clip.tracks = (clip.tracks || []).filter((tr) => {
                  const nodePart = (tr?.name || '').split('.')[0] || '';
                  return !LOWER_BODY_RE.test(nodePart);
                });
                clip.userData = {
                  ...(clip.userData || {}),
                  isUpperBodyMask: true,
                  ...(isMeleeAttackClip ? { fullClipName: `${cleanAtkName}__Full` } : {})
                };
              } else if (/^Idle(?:\.\d+)?$/i.test(clip.name || '')) {
                for (const tr of clip.tracks || []) {
                  const trName = tr?.name || '';
                  const isHipsPos = /^mixamorig:?Hips\.position$/i.test(trName);
                  const isLowerRot = /^mixamorig:?(?:Hips|(?:Left|Right)(?:UpLeg|Leg|Foot|ToeBase|Toe_End))\.quaternion$/i.test(trName);
                  if (!isHipsPos && !isLowerRot) continue;
                  const stride = isHipsPos ? 3 : 4;
                  const src = tr.values;
                  if (!src || src.length < stride * 2) continue;
                  const count = Math.floor(src.length / stride);
                  const locked = new Float32Array(src.length);
                  for (let i = 0; i < count; i++) {
                    const base = i * stride;
                    for (let c = 0; c < stride; c++) {
                      locked[base + c] = src[c];
                    }
                  }
                  tr.values = locked;
                }
              } else if (/^Turn_180(?:\.\d+)?$/i.test(clip.name || '')) {
                // Extract the exact 60 FPS Mixamo yaw trajectory from Hips.quaternion and convert
                // Turn_180 to an in-place forward-aligned pivot clip (0 deg -> 0 deg local Hips yaw)
                // while storing the exact normalized yaw curve for player.facing synchronization.
                // Guarantees zero entry/exit pop with Running_A and instant clean attack interruption!
                let hipsRotTrack = null;
                let hipsPosTrack = null;
                for (const tr of clip.tracks || []) {
                  const trName = tr?.name || '';
                  if (/^mixamorig:?Hips\.quaternion$/i.test(trName)) hipsRotTrack = tr;
                  else if (/^mixamorig:?Hips\.position$/i.test(trName)) hipsPosTrack = tr;
                }
                if (hipsRotTrack?.values && hipsRotTrack.values.length >= 8) {
                  const v = hipsRotTrack.values;
                  const count = Math.floor(v.length / 4);
                  const qTmp = new THREE.Quaternion();
                  const qComp = new THREE.Quaternion();
                  const yAxis = new THREE.Vector3(0, 1, 0);
                  const fwd = new THREE.Vector3();
                  const rawYaws = new Float32Array(count);
                  for (let i = 0; i < count; i++) {
                    qTmp.set(v[i * 4], v[i * 4 + 1], v[i * 4 + 2], v[i * 4 + 3]).normalize();
                    // Mixamo Hips local +X points along character forward (+Z in model space at rest)
                    fwd.set(1, 0, 0).applyQuaternion(qTmp);
                    let yaw = Math.atan2(fwd.x, fwd.z);
                    if (i > 0) {
                      let d = yaw - rawYaws[i - 1];
                      while (d > Math.PI) d -= Math.PI * 2;
                      while (d < -Math.PI) d += Math.PI * 2;
                      yaw = rawYaws[i - 1] + d;
                    }
                    rawYaws[i] = yaw;
                  }
                  const yaw0 = rawYaws[0];
                  const totalYaw = rawYaws[count - 1] - yaw0;
                  if (Math.abs(totalYaw) > 1.5) {
                    const turnYawCurve = new Float32Array(count);
                    const outQ = new Float32Array(v.length);
                    for (let i = 0; i < count; i++) {
                      const deltaYaw = rawYaws[i] - yaw0;
                      turnYawCurve[i] = Math.max(0, Math.min(1, deltaYaw / totalYaw));
                      qTmp.set(v[i * 4], v[i * 4 + 1], v[i * 4 + 2], v[i * 4 + 3]).normalize();
                      qComp.setFromAxisAngle(yAxis, -deltaYaw);
                      qTmp.premultiply(qComp).normalize();
                      if (i > 0) {
                        const prevDot =
                          outQ[(i - 1) * 4] * qTmp.x +
                          outQ[(i - 1) * 4 + 1] * qTmp.y +
                          outQ[(i - 1) * 4 + 2] * qTmp.z +
                          outQ[(i - 1) * 4 + 3] * qTmp.w;
                        if (prevDot < 0) {
                          qTmp.x = -qTmp.x;
                          qTmp.y = -qTmp.y;
                          qTmp.z = -qTmp.z;
                          qTmp.w = -qTmp.w;
                        }
                      }
                      outQ[i * 4] = qTmp.x;
                      outQ[i * 4 + 1] = qTmp.y;
                      outQ[i * 4 + 2] = qTmp.z;
                      outQ[i * 4 + 3] = qTmp.w;
                    }
                    hipsRotTrack.values = outQ;

                    // Keep subtle horizontal Hips pivot sway aligned with the de-yawed body
                    // and soften excessive mid-turn crouch dip by ~28% so the pivot stays athletic and grounded
                    if (hipsPosTrack?.values && hipsPosTrack.values.length >= count * 3) {
                      const pv = hipsPosTrack.values;
                      const outP = new Float32Array(pv.length);
                      const px0 = pv[0];
                      const py0 = pv[1];
                      const pz0 = pv[2];
                      const pCount = Math.floor(pv.length / 3);
                      const pyEnd = pv[(pCount - 1) * 3 + 1];
                      for (let i = 0; i < pCount; i++) {
                        const uP = i / Math.max(1, pCount - 1);
                        const idxYaw = Math.min(count - 1, Math.round(uP * (count - 1)));
                        const ang = -(rawYaws[idxYaw] - yaw0);
                        const c = Math.cos(ang);
                        const s = Math.sin(ang);
                        const dx = pv[i * 3] - px0;
                        const dz = pv[i * 3 + 2] - pz0;
                        const env = Math.sin(Math.PI * uP);
                        const yBase = py0 + (pyEnd - py0) * uP;
                        outP[i * 3] = px0 + (dx * c + dz * s) * (1 - 0.30 * env);
                        outP[i * 3 + 1] = pv[i * 3 + 1] + (yBase - pv[i * 3 + 1]) * (0.28 * env);
                        outP[i * 3 + 2] = pz0 + (-dx * s + dz * c) * (1 - 0.30 * env);
                      }
                      hipsPosTrack.values = outP;
                    }

                    // Moderate the wide braking/push-off leg kick (~55% restraint on Left push-off leg
                    // toward athletic stride midpoint via smooth bell envelope) so the push-off leg stays
                    // clearly visible yet restrained, with untouched frame 0 & end poses for seamless Run blends
                    const qLeg0 = new THREE.Quaternion();
                    const qLegEnd = new THREE.Quaternion();
                    const qLegTarget = new THREE.Quaternion();
                    const qLegCur = new THREE.Quaternion();
                    for (const tr of clip.tracks || []) {
                      const legMatch = (tr?.name || '').match(/^mixamorig:?(LeftUpLeg|LeftLeg|RightUpLeg|RightLeg)\.quaternion$/i);
                      if (!legMatch) continue;
                      const lv = tr.values;
                      if (!lv || lv.length < 8) continue;
                      const lCnt = Math.floor(lv.length / 4);
                      const legKey = legMatch[1];
                      const isLeftPushLeg = /^Left/i.test(legKey);
                      const restraint = isLeftPushLeg ? 0.56 : 0.28;
                      qLeg0.set(lv[0], lv[1], lv[2], lv[3]).normalize();
                      qLegEnd.set(
                        lv[(lCnt - 1) * 4],
                        lv[(lCnt - 1) * 4 + 1],
                        lv[(lCnt - 1) * 4 + 2],
                        lv[(lCnt - 1) * 4 + 3]
                      ).normalize();
                      if (qLeg0.dot(qLegEnd) < 0) {
                        qLegEnd.set(-qLegEnd.x, -qLegEnd.y, -qLegEnd.z, -qLegEnd.w);
                      }
                      qLegTarget.copy(qLeg0).slerp(qLegEnd, 0.5).normalize();
                      const outL = new Float32Array(lv.length);
                      for (let i = 0; i < lCnt; i++) {
                        const uL = i / Math.max(1, lCnt - 1);
                        const env = Math.sin(Math.PI * uL);
                        qLegCur.set(lv[i * 4], lv[i * 4 + 1], lv[i * 4 + 2], lv[i * 4 + 3]).normalize();
                        if (qLegCur.dot(qLegTarget) < 0) {
                          qLegCur.set(-qLegCur.x, -qLegCur.y, -qLegCur.z, -qLegCur.w);
                        }
                        qLegCur.slerp(qLegTarget, restraint * env).normalize();
                        if (i > 0) {
                          const pDot =
                            outL[(i - 1) * 4] * qLegCur.x +
                            outL[(i - 1) * 4 + 1] * qLegCur.y +
                            outL[(i - 1) * 4 + 2] * qLegCur.z +
                            outL[(i - 1) * 4 + 3] * qLegCur.w;
                          if (pDot < 0) {
                            qLegCur.set(-qLegCur.x, -qLegCur.y, -qLegCur.z, -qLegCur.w);
                          }
                        }
                        outL[i * 4] = qLegCur.x;
                        outL[i * 4 + 1] = qLegCur.y;
                        outL[i * 4 + 2] = qLegCur.z;
                        outL[i * 4 + 3] = qLegCur.w;
                      }
                      tr.values = outL;
                    }

                    clip.userData = {
                      ...(clip.userData || {}),
                      isTurn180Clip: true,
                      turnYawCurve,
                      turnTotalYaw: totalYaw,
                      turnSign: totalYaw < 0 ? -1 : 1
                    };
                  }
                }
              }
              // Build complementary lower-body-only clip for Idle / Running_A / Sprint_A / Running_Back / Strafe_Left / Strafe_Right
              // so upper-body attacks & shield block play at 100% pure amplitude (0% Idle/Run/Strafe dilution on arms & torso!)
              if (/^(?:Idle|Running_A|Sprint_A|Running_Back|Strafe_Left|Strafe_Right)(?:\.\d+)?$/i.test(clip.name || '')) {
                const lowerTracks = (clip.tracks || []).filter((tr) => {
                  const nodePart = (tr?.name || '').split('.')[0] || '';
                  return LOWER_BODY_RE.test(nodePart);
                });
                if (lowerTracks.length > 0) {
                  const cleanBase = (clip.name || '').replace(/\.\d+$/, '');
                  const lowerName = `${cleanBase}__Lower`;
                  if (!clipMap.has(lowerName)) {
                    clipMap.set(lowerName, new THREE.AnimationClip(lowerName, clip.duration, lowerTracks));
                  }
                }
              }
            }
            clipMap.set(clip.name, clip);
            const cleanClipName = clip.name.replace(/\.\d+$/, '');
            if (cleanClipName !== clip.name && !clipMap.has(cleanClipName)) {
              clipMap.set(cleanClipName, clip);
            }
          }
          const isTripoHero = key === 'gunslinger_tripo' || key === 'mage_tripo' || key === 'warrior_run' || key === 'warrior_tripo';
          const isTripoWeapon =
            key === 'shotgun_tripo' ||
            key === 'pistol_tripo' ||
            key === 'colt_tripo' ||
            key === 'smg_tripo' ||
            key === 'ak47_tripo' ||
            key === 'sword_tripo' ||
            key === 'great_club_tripo' ||
            key === 'spear_tripo' ||
            key === 'zweihander_tripo' ||
            key === 'axe_tripo' ||
            key === 'hammer_tripo' ||
            key === 'staff_tripo';
          const isRiftTripo =
            key === 'rift_executioner' ||
            key === 'rift_vanguard' ||
            key === 'rift_acolyte' ||
            key === 'rift_boss';
          const isTripoMonster =
            key === 'zombie_tripo' ||
            key === 'tree_tripo' ||
            key === 'dracula_tripo' ||
            key === 'mimic_tripo' ||
            key === 'chest_disguise_tripo' ||
            key === 'lich_tripo' ||
            key === 'troll_tripo' ||
            key === 'succubus_tripo' ||
            key === 'spider_tripo';
          const isTripoAsset = isTripoHero || isTripoWeapon || isTripoMonster;
          const eyeEmissiveTex = isTripoHero || key === 'tree_tripo' ? buildTripoSkullEyeEmissiveMap(key, gltf.scene) : null;
          const maxAniso = isMobile ? 1 : 4;
          gltf.scene.traverse((node) => {
            if (/^Icosphere/i.test(node.name || '')) {
              node.visible = false;
              return;
            }
            if (node.isMesh) {
              const isDecorativeHelmetShell =
                key === 'rift_executioner' && /Helmet_Shell/i.test(node.name || '');
              node.castShadow = !isDecorativeHelmetShell;
              node.receiveShadow = true;
              node.frustumCulled = false;
              if (isRiftTripo && node.material) {
                // Preserve Cycles PBR materials (albedo + ORM + normal + emissiveMap + emissiveStrength) intact!
                // Enable real dynamic shadows on the Boss (`rift_boss`) so cathedral firelight & columns shadow him cleanly!
                node.receiveShadow = key === 'rift_boss';
                const srcMats = Array.isArray(node.material) ? node.material : [node.material];
                for (let mi = 0; mi < srcMats.length; mi++) {
                  const m = srcMats[mi];
                  if (!m) continue;
                  if (key === 'rift_boss' && m.aoMap) {
                    m.aoMapIntensity = 1.05;
                  }
                  for (const t of [m.map, m.normalMap, m.roughnessMap, m.metalnessMap, m.aoMap, m.emissiveMap]) {
                    if (t) {
                      t.anisotropy = maxAniso;
                      t.minFilter = THREE.LinearMipmapLinearFilter;
                      t.magFilter = THREE.LinearFilter;
                      t.generateMipmaps = true;
                      t.needsUpdate = true;
                    }
                  }
                  if (!/Eyes/i.test(node.name || '')) {
                    applySoulsRimLight(m);
                  }
                }
              } else if (isTripoAsset && node.material) {
                node.receiveShadow = false;
                const isEmbeddedWeapon = /HeroWeapon|Sword|Staff|Shotgun/i.test(node.name);
                const isStaffMesh = key === 'staff_tripo' || /Staff/i.test(node.name);
                const srcMats = Array.isArray(node.material) ? node.material : [node.material];
                const cleanMats = srcMats.map((m) => {
                  for (const t of [m.map, m.normalMap, m.roughnessMap, m.metalnessMap]) {
                    if (t) {
                      t.anisotropy = maxAniso;
                      t.minFilter = THREE.LinearMipmapLinearFilter;
                      t.magFilter = THREE.LinearFilter;
                      t.generateMipmaps = true;
                      t.needsUpdate = true;
                    }
                  }
                  const staffCutoutAlpha = isStaffMesh && m.map?.image ? buildStaffGlobeCutoutAlphaMap(m.map.image) : null;
                  const isHeroKnight = key === 'warrior_run';
                  const isShieldCustom = key === 'shield_custom';
                  const std = new THREE.MeshStandardMaterial({
                    map: m.map || null,
                    alphaMap: staffCutoutAlpha || null,
                    alphaTest: staffCutoutAlpha ? 0.5 : 0,
                    normalMap: m.normalMap || null,
                    normalScale: new THREE.Vector2(isHeroKnight ? 1.45 : 1.72, isHeroKnight ? 1.45 : 1.72),
                    roughnessMap: m.roughnessMap || null,
                    metalnessMap: m.metalnessMap || null,
                    color: isHeroKnight ? 0x868c98 : isShieldCustom ? 0x9ea3b0 : 0xffffff,
                    roughness: isHeroKnight ? 0.78 : (isTripoWeapon || isEmbeddedWeapon || key === 'warrior_tripo' ? 0.52 : 0.60),
                    metalness: isHeroKnight ? 0.42 : (isTripoWeapon || isEmbeddedWeapon || key === 'warrior_tripo' ? 0.48 : 0.20),
                    envMapIntensity: isHeroKnight ? 0.44 : isShieldCustom ? 0.52 : 1.0
                  });
                  const allowEyeMap = !isEmbeddedWeapon && (key !== 'gunslinger_tripo' || /tripo_part_0/i.test(node.name));
                  if (eyeEmissiveTex && allowEyeMap) {
                    std.emissiveMap = eyeEmissiveTex;
                    std.emissive.setHex(key === 'mage_tripo' ? 0xff5200 : 0xff7a00);
                    std.emissiveIntensity = 2.4;
                  }
                  return std;
                });
                node.material = Array.isArray(node.material) ? cleanMats : cleanMats[0];
              }
              if (SOULS_RIM_WEAPON_KEYS.has(key) && node.material) {
                if (Array.isArray(node.material)) {
                  for (let mi = 0; mi < node.material.length; mi++) applySoulsRimLight(node.material[mi]);
                } else {
                  applySoulsRimLight(node.material);
                }
              }
            }
          });
          failedModelKeys.delete(key);
          gltfCache.set(key, { scene: gltf.scene, clips: clipMap });
          finish();
        },
        undefined,
        (err) => {
          if (attempt < 2 && !settled) {
            setTimeout(tryLoad, 220);
            return;
          }
          clearTimeout(timer);
          failedModelKeys.add(key);
          console.warn(`[models] Failed to load ${url}:`, err, '(marked failed, will not retry this session)');
          finish();
        }
      );
    };
    tryLoad();
  });

  inFlightModelLoads.set(key, p);
  return p;
}

export async function ensureModelKeysLoaded(keys = []) {
  const valid = [...new Set(keys.filter((k) => k && MODEL_PATHS[k] && !gltfCache.has(k) && !failedModelKeys.has(k)))];
  if (valid.length === 0) return;
  const conc = isMobileRuntimeDevice() ? 2 : 4;
  let cursor = 0;
  const workers = Array.from({ length: Math.min(conc, valid.length) }, async () => {
    while (cursor < valid.length) {
      const k = valid[cursor++];
      await loadSingleModelKey(k);
    }
  });
  await Promise.all(workers);
}

// Diagnostics: which assets failed to download this session (and were excluded from retries).
export function getFailedModelKeys() {
  return [...failedModelKeys];
}

export function resetFailedModelKeys() {
  failedModelKeys.clear();
}

export function getBootModelKeys(_classId = 'warrior', weaponId = 'club') {
  const set = new Set([
    'warrior_run',
    'shield_custom',
    'great_club_tripo',
    getWeaponAssetKey(weaponId || 'club'),
    ...SOULS_RIFT_BIOME_KEYS
  ]);
  return [...set].filter((k) => k && MODEL_PATHS[k]);
}

export function getMissingEnemyKeysForBiome() {
  return SOULS_RIFT_BIOME_KEYS.filter((k) => MODEL_PATHS[k] && !gltfCache.has(k) && !failedModelKeys.has(k));
}

export async function preloadAssetsForBiome() {
  const missing = getMissingEnemyKeysForBiome();
  if (missing.length > 0) {
    await ensureModelKeysLoaded(missing);
  }
  return missing;
}

export function getMissingHeroOrWeaponKeys(_classId = 'warrior', weaponId = 'club') {
  const out = [];
  if (MODEL_PATHS.warrior_run && !gltfCache.has('warrior_run') && !failedModelKeys.has('warrior_run')) {
    out.push('warrior_run');
  }
  if (!WEAPONS[weaponId]?.twoHanded && MODEL_PATHS.shield_custom && !gltfCache.has('shield_custom') && !failedModelKeys.has('shield_custom')) {
    out.push('shield_custom');
  }
  const wk = getWeaponAssetKey(weaponId || 'club');
  if (wk && MODEL_PATHS[wk] && !gltfCache.has(wk) && !failedModelKeys.has(wk)) out.push(wk);
  return out;
}

export function getMissingStageModelKeys(_classId = 'warrior', weaponId = 'club') {
  return getBootModelKeys('warrior', weaponId).filter((k) => !gltfCache.has(k) && !failedModelKeys.has(k));
}

export function preloadModels(onProgressOrOpts, maybeOpts = null) {
  if (preloadPromise) return preloadPromise;

  const opts = typeof onProgressOrOpts === 'object' && onProgressOrOpts !== null ? onProgressOrOpts : maybeOpts || {};
  const onProgress = typeof onProgressOrOpts === 'function' ? onProgressOrOpts : opts.onProgress;
  const isMobile = isMobileRuntimeDevice();
  const allKeys = Object.keys(MODEL_PATHS).filter((k) => !failedModelKeys.has(k));
  const priorityList = Array.isArray(opts.priorityKeys) && opts.priorityKeys.length > 0
    ? [...new Set(opts.priorityKeys.filter((k) => MODEL_PATHS[k] && !failedModelKeys.has(k)))]
    : null;

  const tier1Keys = (priorityList || [
    'warrior_run',
    'sword_tripo',
    'shield_custom',
    ...SOULS_RIFT_BIOME_KEYS
  ]).filter((k) => MODEL_PATHS[k] && !failedModelKeys.has(k));
  const tier1Set = new Set(tier1Keys);
  const tier2Keys = allKeys.filter((k) => !tier1Set.has(k));

  let doneCount = 0;
  const markDone = () => {
    doneCount += 1;
    try {
      onProgress?.(doneCount, tier1Keys.length);
    } catch {
      // ignore progress callback error
    }
  };

  const concTier1 = isMobile ? 2 : 4;
  let idx1 = 0;
  preloadPromise = (async () => {
    const workers1 = Array.from({ length: Math.min(concTier1, tier1Keys.length) }, async () => {
      while (idx1 < tier1Keys.length) {
        const k = tier1Keys[idx1++];
        await loadSingleModelKey(k);
        markDone();
      }
    });
    await Promise.all(workers1);

    // Kick off non-blocking background streaming of remaining models right after Hub unlocks!
    // Skip aggressive Tier-2 preload on mobile devices to avoid OOM from caching ~115 MB of
    // unused GLBs; Hub and startBattle already stream needed keys on demand via ensureModelKeysLoaded().
    if (!isMobile && tier2Keys.length > 0) {
      const concTier2 = 3;
      let idx2 = 0;
      const runBg = () => {
        Array.from({ length: Math.min(concTier2, tier2Keys.length) }, async () => {
          while (idx2 < tier2Keys.length) {
            const k = tier2Keys[idx2++];
            await loadSingleModelKey(k);
          }
        });
      };
      setTimeout(runBg, 120);
    }
  })();

  return preloadPromise;
}

// Pre-computed KayKit bone target quaternions for Two-Handed Forward Carry (Gunslinger, Archer, Bomber)
const GUN_UPPER_ARM_L_Q = new THREE.Quaternion(-0.136, -0.396, -0.900, 0.123).normalize();
const GUN_LOWER_ARM_L_Q = new THREE.Quaternion(0, 0, -0.415, 0.910).normalize();
const GUN_UPPER_ARM_R_Q = new THREE.Quaternion(-0.275, 0.025, 0.938, 0.210).normalize();
const GUN_LOWER_ARM_R_Q = new THREE.Quaternion(0, 0, 0.705, 0.709).normalize();

const GUN_RELOAD_LOWER_L_Q = new THREE.Quaternion(0, 0, -0.640, 0.768).normalize();
const _tmpQuatA = new THREE.Quaternion();
const _tmpQuatB = new THREE.Quaternion();
const _recoilPitchQuat = new THREE.Quaternion();
const _xAxis = new THREE.Vector3(1, 0, 0);

// ============================================================================
// Reference-Matched 3D Equipment Props Mounted to KayKit Rig Bones
// ============================================================================

function createCurvedHorn(mirror = 1, bloodTint = false) {
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(mirror * 0.30, 0.08, 0.02),
    new THREE.Vector3(mirror * 0.62, 0.20, 0.08),
    new THREE.Vector3(mirror * 0.54, 0.56, 0.16)
  );
  const geo = getGeo(`horn_v2_${mirror}`, () => new THREE.TubeGeometry(curve, 10, 0.072, 8, false));
  const hornMat = getMat(bloodTint ? 'horn_blood_mat' : 'horn_bone_mat', () =>
    new THREE.MeshStandardMaterial({
      color: bloodTint ? 0xd6c7b2 : 0xf3e5c8,
      emissive: bloodTint ? 0x7f1d1d : 0x000000,
      emissiveIntensity: bloodTint ? 0.35 : 0,
      roughness: 0.45,
      metalness: 0.12
    })
  );
  const mesh = new THREE.Mesh(geo, hornMat);
  const tip = new THREE.Mesh(
    getGeo('horn_tip_v2', () => new THREE.ConeGeometry(0.068, 0.20, 8)),
    hornMat
  );
  tip.position.set(mirror * 0.53, 0.63, 0.17);
  tip.rotation.z = -mirror * 0.22;
  const grp = new THREE.Group();
  grp.add(mesh, tip);
  return grp;
}

function createBackpackWithBedroll() {
  const grp = new THREE.Group();
  const leatherMat = getMat('pack_leather', () => new THREE.MeshStandardMaterial({ color: 0x6b4c35, roughness: 0.78, metalness: 0.1 }));
  const darkStrapMat = getMat('pack_strap', () => new THREE.MeshStandardMaterial({ color: 0x3b281c, roughness: 0.8, metalness: 0.15 }));
  const buckleMat = getMat('pack_buckle_mat', () => new THREE.MeshStandardMaterial({ color: 0xd4a359, roughness: 0.35, metalness: 0.75 }));

  const pack = new THREE.Mesh(getGeo('pack_body', () => new THREE.BoxGeometry(0.52, 0.54, 0.30)), leatherMat);
  pack.castShadow = true;
  const flap = new THREE.Mesh(getGeo('pack_flap', () => new THREE.BoxGeometry(0.54, 0.18, 0.32)), darkStrapMat);
  flap.position.y = 0.20;

  const roll = new THREE.Mesh(
    getGeo('pack_roll', () => {
      const cg = new THREE.CylinderGeometry(0.13, 0.13, 0.56, 12);
      cg.rotateZ(Math.PI / 2);
      return cg;
    }),
    darkStrapMat
  );
  roll.position.set(0, 0.36, -0.02);

  const pouch = new THREE.Mesh(getGeo('pack_pouch', () => new THREE.BoxGeometry(0.18, 0.24, 0.14)), leatherMat);
  pouch.position.set(-0.28, -0.08, 0);
  const buckle = new THREE.Mesh(getGeo('pack_buckle', () => new THREE.BoxGeometry(0.10, 0.08, 0.04)), buckleMat);
  buckle.position.set(0, 0.12, -0.17);

  grp.add(pack, flap, roll, pouch, buckle);
  return grp;
}

function createSkullShield(molten = false) {
  const grp = new THREE.Group();
  const woodMat = getMat(molten ? 'sh_obsidian_mat' : 'sh_wood_mat', () =>
    new THREE.MeshStandardMaterial({
      color: molten ? 0x290909 : 0x5c4033,
      emissive: molten ? 0x9a3412 : 0x000000,
      emissiveIntensity: molten ? 0.45 : 0,
      roughness: molten ? 0.45 : 0.75,
      metalness: molten ? 0.55 : 0.1
    })
  );
  const rimMat = getMat(molten ? 'sh_gold_rim_mat' : 'sh_iron_rim_mat', () =>
    new THREE.MeshStandardMaterial({
      color: molten ? 0xfbbf24 : 0x6b7280,
      emissive: molten ? 0xd97706 : 0x000000,
      emissiveIntensity: molten ? 0.5 : 0,
      roughness: 0.32,
      metalness: 0.82
    })
  );
  const boneMat = getMat(molten ? 'sh_molten_skull_mat' : 'sh_bone_mat', () =>
    new THREE.MeshStandardMaterial({
      color: molten ? 0xfde68a : 0xd6cfc2,
      emissive: molten ? 0xea580c : 0x000000,
      emissiveIntensity: molten ? 0.65 : 0,
      roughness: 0.45,
      metalness: molten ? 0.35 : 0.1
    })
  );

  const disc = new THREE.Mesh(
    getGeo('sh_disc', () => {
      const cg = new THREE.CylinderGeometry(0.46, 0.46, 0.08, 18);
      cg.rotateX(Math.PI / 2);
      return cg;
    }),
    woodMat
  );
  const rim = new THREE.Mesh(getGeo('sh_rim', () => new THREE.TorusGeometry(0.46, 0.055, 8, 20)), rimMat);
  const skullBoss = new THREE.Mesh(getGeo('sh_skull', () => new THREE.SphereGeometry(0.17, 10, 10)), boneMat);
  skullBoss.scale.set(0.95, 1.05, 0.65);
  skullBoss.position.set(0, 0.03, 0.05);
  const jaw = new THREE.Mesh(getGeo('sh_jaw', () => new THREE.BoxGeometry(0.16, 0.10, 0.09)), boneMat);
  jaw.position.set(0, -0.11, 0.05);

  grp.add(disc, rim, skullBoss, jaw);
  grp.position.set(0.08, 0.05, 0.14);
  grp.rotation.y = 0.22;
  return grp;
}

const ELEMENT_STAFF_COLORS = {
  fire: { color: 0xff6b35, emissive: 0xea580c },
  water: { color: 0x38bdf8, emissive: 0x0284c7 },
  lightning: { color: 0xfef08a, emissive: 0x06b6d4 },
  air: { color: 0x99f6e4, emissive: 0x14b8a6 }
};

function createHeroWeaponMesh(weaponId, mageElement = null) {
  const grp = new THREE.Group();
  const ownedMats = [];
  grp.userData.ownedMaterials = ownedMats;
  const ironMat = getMat('hw_iron', () => new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.80, roughness: 0.26 }));
  const darkIronMat = getMat('hw_dark_iron', () => new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.78, roughness: 0.32 }));
  const walnutMat = getMat('hw_walnut', () => new THREE.MeshStandardMaterial({ color: 0x6b3e20, roughness: 0.68, metalness: 0.08 }));
  const leatherMat = getMat('hw_leather', () => new THREE.MeshStandardMaterial({ color: 0x3b2314, roughness: 0.82, metalness: 0.10 }));
  const brassMat = getMat('hw_brass', () => new THREE.MeshStandardMaterial({ color: 0xe09f3e, metalness: 0.85, roughness: 0.24 }));
  const shellHullMat = getMat('hw_shell_hull', () => new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.45, metalness: 0.15 }));

  // === WARRIOR WEAPONS (Sword, Spear, Zweihander, Sekira Axe & Boss Warhammer in RightHand!) ===
  if (
    weaponId === 'club' ||
    weaponId === 'spear' ||
    weaponId === 'zweihander' ||
    weaponId === 'axe' ||
    weaponId === 'boss_hammer' ||
    weaponId === 'cleaver' ||
    weaponId === 'flail'
  ) {
    const assetKey =
      weaponId === 'spear' || weaponId === 'cleaver'
        ? 'spear_tripo'
        : weaponId === 'zweihander'
          ? 'zweihander_tripo'
          : weaponId === 'axe' || weaponId === 'flail'
            ? 'axe_tripo'
            : weaponId === 'boss_hammer'
              ? 'hammer_tripo'
              : 'sword_tripo';
    const tripoMelee = gltfCache.get(assetKey) || gltfCache.get('sword_tripo');
    if (tripoMelee?.scene) {
      const swClone = tripoMelee.scene.clone(true);
      const isSwordAsset = assetKey === 'sword_tripo';
      if (isSwordAsset) {
        const swScale = 0.0060;
        swClone.scale.setScalar(swScale);
        swClone.position.set(
          -78.2 * Math.cos(0.174533) * swScale,
          0.048 + 78.2 * Math.sin(0.174533) * swScale,
          -0.032
        );
        swClone.rotation.set(Math.PI, 0.0, 1.39626);
      } else {
        // Upright Tripo GLBs (Spear, Zweihander, Axe, Hammer): pommel at Y=0, tip at Y=0.98
        // Rotating Z by +1.39626 aligns +Y tip outward along (-X, +Y) matching HeroWeapon_Sword!
        const wScale =
          assetKey === 'spear_tripo'
            ? 1.05
            : assetKey === 'zweihander_tripo'
              ? 0.90
              : assetKey === 'hammer_tripo'
                ? 0.78
                : 0.72;
        const gripFrac =
          assetKey === 'spear_tripo'
            ? 0.36
            : assetKey === 'zweihander_tripo'
              ? 0.14
              : assetKey === 'hammer_tripo'
                ? 0.24
                : 0.26;
        const gripOff = gripFrac * wScale;
        swClone.scale.setScalar(wScale);
        swClone.position.set(
          gripOff * Math.cos(0.174533),
          0.048 - gripOff * Math.sin(0.174533),
          -0.032
        );
        swClone.rotation.set(0.0, 0.0, 1.39626);
      }

      swClone.traverse((n) => {
        if (n.isMesh && n.material) {
          n.castShadow = true;
          n.receiveShadow = false;
          n.frustumCulled = false;
          const cloneOne = (orig) => {
            const m = orig.clone();
            if (m.color) m.color.setHex(0xffffff);
            ownedMats.push(m);
            return m;
          };
          n.material = Array.isArray(n.material) ? n.material.map(cloneOne) : cloneOne(n.material);
        }
      });
      grp.add(swClone);
      return grp;
    }
    const isFlail = weaponId === 'flail';
    const isCleaver = weaponId === 'cleaver';
    const grip = new THREE.Mesh(
      getGeo('w_sw_grip', () => new THREE.CylinderGeometry(0.042, 0.048, 0.34, 8)),
      walnutMat
    );
    const guard = new THREE.Mesh(
      getGeo(isFlail ? 'w_sw_guard_wide' : 'w_sw_guard', () => new THREE.BoxGeometry(isFlail ? 0.48 : 0.36, 0.085, 0.13)),
      brassMat
    );
    guard.position.y = 0.16;

    const bladeW = isFlail ? 0.26 : isCleaver ? 0.29 : 0.19;
    const bladeH = isFlail ? 1.24 : isCleaver ? 1.08 : 0.88;
    const bladeMat = isFlail
      ? getMat('hw_cinder_blade', () => new THREE.MeshStandardMaterial({ color: 0xfde68a, emissive: 0xd97706, emissiveIntensity: 0.65, metalness: 0.82, roughness: 0.20 }))
      : isCleaver
        ? getMat('hw_cleaver_blade', () => new THREE.MeshStandardMaterial({ color: 0xd1d5db, emissive: 0x991b1b, emissiveIntensity: 0.32, metalness: 0.82, roughness: 0.22 }))
        : ironMat;

    const blade = new THREE.Mesh(
      getGeo(`w_blade_${weaponId}`, () => new THREE.BoxGeometry(bladeW, bladeH, 0.055)),
      bladeMat
    );
    blade.position.y = 0.20 + bladeH * 0.5;
    const tip = new THREE.Mesh(
      getGeo(`w_tip_${weaponId}`, () => {
        const cg = new THREE.ConeGeometry(bladeW * 0.52, 0.24, 4);
        cg.rotateY(Math.PI / 4);
        return cg;
      }),
      bladeMat
    );
    tip.scale.set(1, 1, 0.32);
    tip.position.y = 0.20 + bladeH + 0.11;
    grp.add(grip, guard, blade, tip);
    grp.rotation.x = Math.PI * 0.38;
    return grp;
  }

  // === GUNSLINGER DARK-FANTASY SHOTGUNS, TACTICAL USP, COLT REVOLVER, SMG & AK-47 ===
  if (weaponId === 'colt' && gltfCache.has('colt_tripo')) {
    const cClone = gltfCache.get('colt_tripo').scene.clone(true);
    cClone.position.set(0, 0, 0);
    cClone.traverse((n) => {
      if (n.isMesh && n.material) {
        n.castShadow = true;
        n.receiveShadow = true;
        n.frustumCulled = false;
      }
    });
    grp.add(cClone);
    grp.userData.tripoShotgun = cClone;
    grp.userData.baseZ = 0.04;
    return grp;
  }
  if (weaponId === 'colt') {
    const chromeMat = getMat('hw_colt_chrome_v2', () =>
      new THREE.MeshStandardMaterial({ color: 0xdce4ef, metalness: 0.92, roughness: 0.16 })
    );
    const frameMat = getMat('hw_colt_frame_v2', () =>
      new THREE.MeshStandardMaterial({ color: 0x8b98ad, metalness: 0.88, roughness: 0.24 })
    );
    const woodGripMat = getMat('hw_colt_walnut_v2', () => {
      let tex = null;
      if (typeof document !== 'undefined') {
        const cv = document.createElement('canvas');
        cv.width = 128;
        cv.height = 128;
        const c = cv.getContext('2d');
        if (c) {
          c.fillStyle = '#5c2c16';
          c.fillRect(0, 0, 128, 128);
          for (let y = 0; y < 128; y += 4) {
            c.fillStyle = y % 8 === 0 ? 'rgba(30,12,4,0.34)' : 'rgba(146,72,32,0.22)';
            c.fillRect(0, y, 128, 2);
          }
          tex = new THREE.CanvasTexture(cv);
          tex.colorSpace = THREE.SRGBColorSpace;
        }
      }
      return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: tex,
        roughness: 0.56,
        metalness: 0.08
      });
    });
    const revGrp = new THREE.Group();

    // Round heavy revolver barrel + recessed muzzle bore
    const barrel = new THREE.Mesh(
      getGeo('colt_barrel_cyl', () => {
        const g = new THREE.CylinderGeometry(0.025, 0.027, 0.285, 16);
        g.rotateX(Math.PI * 0.5);
        return g;
      }),
      chromeMat
    );
    barrel.position.set(0, 0.095, 0.215);

    const boreHole = new THREE.Mesh(
      getGeo('colt_bore', () => {
        const g = new THREE.CylinderGeometry(0.011, 0.011, 0.014, 12);
        g.rotateX(Math.PI * 0.5);
        return g;
      }),
      darkIronMat
    );
    boreHole.position.set(0, 0.095, 0.354);

    // Tapered lower underlug + cylindrical ejector rod housing
    const underlug = new THREE.Mesh(
      getGeo('colt_lug_cyl', () => {
        const g = new THREE.CylinderGeometry(0.015, 0.016, 0.255, 12);
        g.rotateX(Math.PI * 0.5);
        return g;
      }),
      frameMat
    );
    underlug.position.set(0, 0.062, 0.205);

    // Ventilated upper sight rib + front blade sight
    const topRib = new THREE.Mesh(
      getGeo('colt_rib_v2', () => new THREE.BoxGeometry(0.024, 0.014, 0.28)),
      frameMat
    );
    topRib.position.set(0, 0.123, 0.21);

    const frontSight = new THREE.Mesh(
      getGeo('colt_sight_v2', () => {
        const s = new THREE.Shape();
        s.moveTo(0, 0);
        s.lineTo(0.030, 0);
        s.lineTo(0.024, 0.022);
        s.lineTo(0.008, 0.022);
        s.closePath();
        const g = new THREE.ExtrudeGeometry(s, { depth: 0.010, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 });
        g.rotateY(-Math.PI * 0.5);
        g.translate(0.005, 0, -0.015);
        return g;
      }),
      darkIronMat
    );
    frontSight.position.set(0, 0.129, 0.33);

    // Contoured beveled steel frame (side profile extruded symmetrically)
    const frame = new THREE.Mesh(
      getGeo('colt_frame_ext', () => {
        const s = new THREE.Shape();
        s.moveTo(-0.072, -0.010);
        s.lineTo(0.088, -0.006);
        s.lineTo(0.088, 0.056);
        s.lineTo(0.075, 0.068);
        s.lineTo(-0.054, 0.068);
        s.lineTo(-0.076, 0.042);
        s.lineTo(-0.082, 0.008);
        s.closePath();
        const g = new THREE.ExtrudeGeometry(s, { depth: 0.036, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 2 });
        g.rotateY(-Math.PI * 0.5);
        g.translate(0.018, 0.054, 0.012);
        return g;
      }),
      frameMat
    );

    // Fluted 6-shot revolving cylinder + 6 recessed brass bullet rims
    const cylinder = new THREE.Mesh(
      getGeo('colt_cyl_v2', () => {
        const cg = new THREE.CylinderGeometry(0.047, 0.047, 0.088, 18);
        cg.rotateX(Math.PI * 0.5);
        return cg;
      }),
      chromeMat
    );
    cylinder.position.set(0, 0.082, 0.038);

    const cylGroup = new THREE.Group();
    cylGroup.add(cylinder);
    const rimGeo = getGeo('colt_brass_rim', () => {
      const g = new THREE.CylinderGeometry(0.010, 0.010, 0.094, 8);
      g.rotateX(Math.PI * 0.5);
      return g;
    });
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const rim = new THREE.Mesh(rimGeo, brassMat);
      rim.position.set(Math.sin(a) * 0.028, 0.082 + Math.cos(a) * 0.028, 0.038);
      cylGroup.add(rim);
    }

    const brassPin = new THREE.Mesh(
      getGeo('colt_pin', () => {
        const cg = new THREE.CylinderGeometry(0.011, 0.011, 0.106, 10);
        cg.rotateX(Math.PI * 0.5);
        return cg;
      }),
      brassMat
    );
    brassPin.position.set(0, 0.082, 0.042);

    const triggerGuard = new THREE.Mesh(
      getGeo('colt_tguard_v2', () => new THREE.TorusGeometry(0.029, 0.0065, 8, 16)),
      darkIronMat
    );
    triggerGuard.rotation.y = Math.PI * 0.5;
    triggerGuard.position.set(0, 0.016, 0.020);

    const trigger = new THREE.Mesh(
      getGeo('colt_trigger', () => new THREE.BoxGeometry(0.008, 0.024, 0.010)),
      brassMat
    );
    trigger.position.set(0, 0.018, 0.022);
    trigger.rotation.x = 0.28;

    const hammer = new THREE.Mesh(
      getGeo('colt_hammer_v2', () => {
        const s = new THREE.Shape();
        s.moveTo(0, 0);
        s.lineTo(0.022, 0.012);
        s.lineTo(0.012, 0.036);
        s.lineTo(-0.006, 0.032);
        s.closePath();
        const g = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 });
        g.rotateY(-Math.PI * 0.5);
        g.translate(0.006, 0, 0);
        return g;
      }),
      brassMat
    );
    hammer.position.set(0, 0.112, -0.058);

    // Ergonomic beveled walnut handle grip + brass medallions
    const grip = new THREE.Mesh(
      getGeo('colt_grip_ext', () => {
        const s = new THREE.Shape();
        s.moveTo(-0.024, 0);
        s.lineTo(0.032, 0.008);
        s.quadraticCurveTo(0.036, -0.065, 0.046, -0.145);
        s.lineTo(-0.028, -0.152);
        s.quadraticCurveTo(-0.020, -0.068, -0.024, 0);
        const g = new THREE.ExtrudeGeometry(s, { depth: 0.034, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.007, bevelSegments: 2 });
        g.rotateY(-Math.PI * 0.5);
        g.translate(0.017, 0.044, -0.045);
        return g;
      }),
      woodGripMat
    );

    const gripMedallion = new THREE.Mesh(
      getGeo('colt_medallion', () => {
        const g = new THREE.CylinderGeometry(0.013, 0.013, 0.053, 12);
        g.rotateZ(Math.PI * 0.5);
        return g;
      }),
      brassMat
    );
    gripMedallion.position.set(0, -0.028, -0.066);

    revGrp.add(barrel, boreHole, underlug, topRib, frontSight, frame, cylGroup, brassPin, triggerGuard, trigger, hammer, grip, gripMedallion);
    revGrp.traverse((n) => {
      if (n.isMesh) {
        n.castShadow = true;
        n.receiveShadow = true;
        n.frustumCulled = false;
      }
    });
    grp.add(revGrp);
    grp.userData.tripoShotgun = revGrp;
    grp.userData.baseZ = 0.04;
    return grp;
  }

  if (
    (weaponId === 'usp_pistol' && gltfCache.has('pistol_tripo')) ||
    (weaponId === 'smg' && gltfCache.has('smg_tripo')) ||
    (weaponId === 'ak47' && gltfCache.has('ak47_tripo'))
  ) {
    const gunKey = weaponId === 'smg' ? 'smg_tripo' : weaponId === 'ak47' ? 'ak47_tripo' : 'pistol_tripo';
    const pClone = gltfCache.get(gunKey).scene.clone(true);
    const pScale = weaponId === 'usp_pistol' ? 0.25 : weaponId === 'smg' ? 0.42 : 0.56;
    pClone.scale.setScalar(pScale);
    if (gunKey === 'smg_tripo' || gunKey === 'ak47_tripo') {
      // SMG & AK-47 barrels point +X in glTF -> rotate -90 deg around Y to aim +Z forward
      pClone.rotation.y = -Math.PI * 0.5;
      pClone.position.set(0, -0.045, 0.02);
    } else {
      pClone.position.set(0, -0.015, 0.04);
    }
    pClone.traverse((n) => {
      if (n.isMesh && n.material) {
        n.castShadow = true;
        n.receiveShadow = true;
        n.frustumCulled = false;
      }
    });
    grp.add(pClone);
    grp.userData.tripoShotgun = pClone;
    grp.userData.baseZ = 0.16;
    return grp;
  }
  if (
    weaponId === 'pistol' ||
    weaponId === 'usp_pistol' ||
    weaponId === 'smg' ||
    weaponId === 'ak47' ||
    weaponId === 'blunderbuss' ||
    weaponId === 'gatling'
  ) {
    const tripoShotgun = gltfCache.get('shotgun_tripo');
    if (tripoShotgun?.scene) {
      const sgClone = tripoShotgun.scene.clone(true);
      const sgScale = weaponId === 'blunderbuss' ? 0.0086 : weaponId === 'gatling' ? 0.0083 : 0.0080;
      sgClone.scale.setScalar(sgScale);
      // Center receiver balance point (raw Y=+10, Z=+26 in Blender -> Z=-10, Y=+26 in glTF Y-up) right at gunCarryPivot (0,0,0)!
      sgClone.position.set(0, -26.0 * sgScale, 10.0 * sgScale);

      const accentHex =
        weaponId === 'gatling' ? 0x0284c7 : weaponId === 'blunderbuss' ? 0xd97706 : 0x000000;
      const accentInt = weaponId === 'gatling' ? 0.22 : weaponId === 'blunderbuss' ? 0.18 : 0.0;

      sgClone.traverse((n) => {
        if (n.isMesh && n.material) {
          n.castShadow = true;
          n.receiveShadow = true;
          n.frustumCulled = false;
          const cloneOne = (orig) => {
            const m = orig.clone();
            if (m.color) m.color.setHex(0xffffff);
            if (m.emissive && accentInt > 0) {
              m.emissive.setHex(accentHex);
              m.emissiveIntensity = accentInt;
            }
            ownedMats.push(m);
            return m;
          };
          n.material = Array.isArray(n.material) ? n.material.map(cloneOne) : cloneOne(n.material);
        }
      });

      grp.add(sgClone);
      grp.userData.tripoShotgun = sgClone;
      grp.userData.baseZ = 0.18;
      return grp;
    }

    // Fallback procedural shotgun if GLB has not loaded yet
    // 1. Chunky Walnut Buttstock + Iron Buttplate + Pistol Grip Wrist
    const stock = new THREE.Mesh(
      getGeo('sg_stock', () => new THREE.BoxGeometry(0.135, 0.19, 0.30)),
      walnutMat
    );
    stock.position.set(0, -0.04, -0.19);
    stock.rotation.x = 0.14;

    const buttPlate = new THREE.Mesh(
      getGeo('sg_butt', () => new THREE.BoxGeometry(0.142, 0.205, 0.04)),
      darkIronMat
    );
    buttPlate.position.set(0, -0.06, -0.34);
    buttPlate.rotation.x = 0.14;

    const gripWrist = new THREE.Mesh(
      getGeo('sg_wrist', () => new THREE.BoxGeometry(0.115, 0.15, 0.14)),
      walnutMat
    );
    gripWrist.position.set(0, -0.065, -0.03);
    gripWrist.rotation.x = 0.36;

    // 2. Forged Dark-Iron Receiver + Top Sight Rib + Brass Trim
    const receiver = new THREE.Mesh(
      getGeo('sg_recv', () => new THREE.BoxGeometry(0.165, 0.19, 0.32)),
      darkIronMat
    );
    receiver.position.set(0, 0.03, 0.09);

    const topRib = new THREE.Mesh(
      getGeo('sg_rib', () => new THREE.BoxGeometry(0.065, 0.032, 0.30)),
      ironMat
    );
    topRib.position.set(0, 0.135, 0.09);

    // 3. Brass Shell Side-Saddle Rack (4 crimson-and-brass shells ready on receiver side!)
    const saddleStrap = new THREE.Mesh(
      getGeo('sg_saddle', () => new THREE.BoxGeometry(0.182, 0.095, 0.24)),
      leatherMat
    );
    saddleStrap.position.set(0, 0.03, 0.09);
    grp.add(stock, buttPlate, gripWrist, receiver, topRib, saddleStrap);

    const shellHullGeo = getGeo('sg_shell_hull', () => new THREE.CylinderGeometry(0.020, 0.020, 0.082, 8));
    const shellBrassGeo = getGeo('sg_shell_brass', () => new THREE.CylinderGeometry(0.022, 0.022, 0.028, 8));
    for (let s = 0; s < 4; s++) {
      const sz = 0.00 + s * 0.056;
      const hull = new THREE.Mesh(shellHullGeo, shellHullMat);
      hull.position.set(-0.096, 0.025, sz);
      const brassBase = new THREE.Mesh(shellBrassGeo, brassMat);
      brassBase.position.set(-0.096, 0.068, sz);
      grp.add(hull, brassBase);
    }

    if (weaponId === 'gatling') {
      // «Шквал» — Revolving Brass-Iron Drum + Quad Barrel Shroud
      const drumBody = new THREE.Mesh(
        getGeo('sg_gat_drum', () => {
          const cg = new THREE.CylinderGeometry(0.155, 0.155, 0.20, 14);
          cg.rotateX(Math.PI / 2);
          return cg;
        }),
        darkIronMat
      );
      drumBody.position.set(0, -0.055, 0.23);

      const drumTrim = new THREE.Mesh(
        getGeo('sg_gat_drum_trim', () => {
          const cg = new THREE.CylinderGeometry(0.162, 0.162, 0.04, 14);
          cg.rotateX(Math.PI / 2);
          return cg;
        }),
        brassMat
      );
      drumTrim.position.set(0, -0.055, 0.23);

      const runeBandMat = getMat('hw_gat_rune', () =>
        new THREE.MeshStandardMaterial({ color: 0x7dd3fc, emissive: 0x0284c7, emissiveIntensity: 1.4, roughness: 0.2 })
      );
      const runeCore = new THREE.Mesh(
        getGeo('sg_gat_rune_ring', () => new THREE.TorusGeometry(0.158, 0.016, 6, 16)),
        runeBandMat
      );
      runeCore.position.set(0, -0.055, 0.32);

      const gatlingCluster = new THREE.Group();
      gatlingCluster.position.set(0, 0.065, 0.51);
      const gatBrlGeo = getGeo('sg_gat_brl', () => {
        const cg = new THREE.CylinderGeometry(0.034, 0.036, 0.54, 8);
        cg.rotateX(Math.PI / 2);
        return cg;
      });
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
        const brl = new THREE.Mesh(gatBrlGeo, ironMat);
        brl.position.set(Math.cos(a) * 0.055, Math.sin(a) * 0.055, 0);
        gatlingCluster.add(brl);
      }

      const shroudGeo = getGeo('sg_gat_shroud', () => {
        const cg = new THREE.CylinderGeometry(0.112, 0.112, 0.055, 12);
        cg.rotateX(Math.PI / 2);
        return cg;
      });
      const shroudMid = new THREE.Mesh(shroudGeo, brassMat);
      shroudMid.position.z = -0.04;
      const shroudFront = new THREE.Mesh(shroudGeo, darkIronMat);
      shroudFront.position.z = 0.21;
      gatlingCluster.add(shroudMid, shroudFront);

      grp.add(drumBody, drumTrim, runeCore, gatlingCluster);
      grp.userData.gatlingCluster = gatlingCluster;
      return grp;
    }

    if (weaponId === 'blunderbuss') {
      // «Гром» — Twin Flared Brass-Iron Double-Barrel Blunderbuss
      const wideForend = new THREE.Mesh(
        getGeo('sg_blun_fore', () => new THREE.BoxGeometry(0.20, 0.115, 0.28)),
        walnutMat
      );
      wideForend.position.set(0, -0.01, 0.36);

      const brassStrap = new THREE.Mesh(
        getGeo('sg_blun_band', () => new THREE.BoxGeometry(0.225, 0.145, 0.048)),
        brassMat
      );
      brassStrap.position.set(0, 0.045, 0.48);
      grp.add(wideForend, brassStrap);

      const twinBrlGeo = getGeo('sg_blun_brl', () => {
        const cg = new THREE.CylinderGeometry(0.050, 0.056, 0.44, 10);
        cg.rotateX(Math.PI / 2);
        return cg;
      });
      // Note: after rotateX(+PI/2), radiusTop is at +Z (flared bell front!)
      const twinBellGeo = getGeo('sg_blun_bell', () => {
        const cg = new THREE.CylinderGeometry(0.092, 0.050, 0.15, 12);
        cg.rotateX(Math.PI / 2);
        return cg;
      });
      const boreGlowMat = getMat('hw_blun_bore', () =>
        new THREE.MeshStandardMaterial({ color: 0xfdba74, emissive: 0xea580c, emissiveIntensity: 1.25, roughness: 0.3 })
      );
      const boreGeo = getGeo('sg_blun_bore_disc', () => {
        const cg = new THREE.CylinderGeometry(0.068, 0.068, 0.02, 10);
        cg.rotateX(Math.PI / 2);
        return cg;
      });

      for (const ox of [-0.056, 0.056]) {
        const barrel = new THREE.Mesh(twinBrlGeo, darkIronMat);
        barrel.position.set(ox, 0.075, 0.45);
        const flaredBell = new THREE.Mesh(twinBellGeo, brassMat);
        flaredBell.position.set(ox, 0.075, 0.71);
        const bore = new THREE.Mesh(boreGeo, boreGlowMat);
        bore.position.set(ox, 0.075, 0.78);
        grp.add(barrel, flaredBell, bore);
      }
      return grp;
    }

    // Default 'pistol' («Охотничье ружьё»): Heavy Pump-Action Shotgun + Underbarrel Tube + Ribbed Walnut Forend
    const topBarrel = new THREE.Mesh(
      getGeo('sg_pump_brl', () => {
        const cg = new THREE.CylinderGeometry(0.050, 0.056, 0.52, 10);
        cg.rotateX(Math.PI / 2);
        return cg;
      }),
      ironMat
    );
    topBarrel.position.set(0, 0.085, 0.49);

    const muzzleChoke = new THREE.Mesh(
      getGeo('sg_pump_muz', () => {
        const cg = new THREE.CylinderGeometry(0.066, 0.054, 0.09, 10);
        cg.rotateX(Math.PI / 2);
        return cg;
      }),
      darkIronMat
    );
    muzzleChoke.position.set(0, 0.085, 0.74);

    const frontBead = new THREE.Mesh(
      getGeo('sg_pump_sight', () => new THREE.BoxGeometry(0.028, 0.045, 0.035)),
      brassMat
    );
    frontBead.position.set(0, 0.15, 0.75);

    const magTube = new THREE.Mesh(
      getGeo('sg_pump_mag', () => {
        const cg = new THREE.CylinderGeometry(0.038, 0.038, 0.44, 10);
        cg.rotateX(Math.PI / 2);
        return cg;
      }),
      darkIronMat
    );
    magTube.position.set(0, 0.008, 0.45);

    const barrelClamp = new THREE.Mesh(
      getGeo('sg_pump_clamp', () => new THREE.BoxGeometry(0.11, 0.155, 0.045)),
      brassMat
    );
    barrelClamp.position.set(0, 0.048, 0.63);

    const pumpForend = new THREE.Mesh(
      getGeo('sg_pump_fore', () => {
        const cg = new THREE.CylinderGeometry(0.064, 0.064, 0.26, 10);
        cg.rotateX(Math.PI / 2);
        return cg;
      }),
      walnutMat
    );
    pumpForend.position.set(0, -0.012, 0.39);
    pumpForend.userData.baseZ = 0.39;

    grp.add(topBarrel, muzzleChoke, frontBead, magTube, barrelClamp, pumpForend);
    grp.userData.pumpForend = pumpForend;
    return grp;
  }

  // === MAGE WEAPONS (4K Tripo Magic Staff in RightHand + Elemental Orb Glow!) ===
  const elCols = mageElement && ELEMENT_STAFF_COLORS[mageElement] ? ELEMENT_STAFF_COLORS[mageElement] : null;
  const crystalColor = elCols
    ? elCols.color
    : weaponId === 'cinder_tome'
      ? 0xf43f5e
      : weaponId === 'void_orb'
        ? 0x818cf8
        : 0xc084fc;
  const crystalEmissive = elCols
    ? elCols.emissive
    : weaponId === 'cinder_tome'
      ? 0xe11d48
      : weaponId === 'void_orb'
        ? 0x4f46e5
        : 0x9333ea;

  const tripoStaff = gltfCache.get('staff_tripo');
  if (tripoStaff?.scene) {
    const stClone = tripoStaff.scene.clone(true);
    const stScale = weaponId === 'void_orb' ? 0.0102 : weaponId === 'cinder_tome' ? 0.0099 : 0.0096;
    const ratio = stScale / 0.0096;
    stClone.scale.setScalar(stScale);
    stClone.position.set(-0.25509 * ratio, 0.03638, -0.26418 * ratio);
    stClone.quaternion.set(0.18785, -0.40613, -0.70380, 0.55176);

    stClone.traverse((n) => {
      if (n.isMesh && n.material) {
        n.castShadow = true;
        n.receiveShadow = false;
        n.frustumCulled = false;
        const cloneOne = (orig) => {
          const m = orig.clone();
          if (m.color) m.color.setHex(0xffffff);
          ownedMats.push(m);
          return m;
        };
        n.material = Array.isArray(n.material) ? n.material.map(cloneOne) : cloneOne(n.material);
      }
    });

    // Subtle additive elemental aura around the staff's top crystal sphere (-3.63, 80.82, 0.38 in staff local space)
    const orbAuraMat = new THREE.MeshBasicMaterial({
      color: crystalColor,
      transparent: true,
      opacity: 0.30,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    ownedMats.push(orbAuraMat);
    const orbAura = new THREE.Mesh(
      getGeo('tripo_staff_orb_aura', () => new THREE.SphereGeometry(10.6, 14, 14)),
      orbAuraMat
    );
    orbAura.position.set(-3.63, 80.82, 0.38);
    stClone.add(orbAura);
    grp.add(stClone);
    return grp;
  }

  const staffPole = new THREE.Mesh(
    getGeo('m_pole', () => new THREE.CylinderGeometry(0.042, 0.048, 1.65, 8)),
    walnutMat
  );
  staffPole.position.y = 0.52;
  const collar = new THREE.Mesh(getGeo('m_collar', () => new THREE.CylinderGeometry(0.11, 0.07, 0.14, 8)), brassMat);
  collar.position.y = 1.32;
  const crystalMat = new THREE.MeshStandardMaterial({
    color: crystalColor,
    emissive: crystalEmissive,
    emissiveIntensity: 1.65,
    roughness: 0.15,
    metalness: 0.1
  });
  ownedMats.push(crystalMat);
  const mainCrystal = new THREE.Mesh(
    getGeo('m_crystal', () => new THREE.OctahedronGeometry(0.22, 0)),
    crystalMat
  );
  mainCrystal.scale.set(0.85, 1.45, 0.85);
  mainCrystal.position.y = 1.58;

  for (let i = 0; i < 3; i++) {
    const shard = new THREE.Mesh(
      getGeo('m_shard', () => new THREE.OctahedronGeometry(0.065, 0)),
      mainCrystal.material
    );
    const a = (i / 3) * Math.PI * 2;
    shard.position.set(Math.cos(a) * 0.24, 1.56 + (i - 1) * 0.08, Math.sin(a) * 0.24);
    grp.add(shard);
  }

  grp.add(staffPole, collar, mainCrystal);
  return grp;
}

// ============================================================================
// 3D ARSENAL SHOWCASE WEAPON FACTORY (Floats & Spins 360° above Golden Pedestal!)
// ============================================================================
export function createArsenalShowcaseWeapon(weaponId = 'club', mageElement = 'water', isLocked = false) {
  const root = new THREE.Group();
  // Materials are cloned per instance below — remember them so the showcase
  // can actually free its VRAM when a different weapon is previewed.
  const showcaseMats = [];
  const floatPivot = new THREE.Group();
  const tiltPivot = new THREE.Group();
  root.add(floatPivot);
  floatPivot.add(tiltPivot);

  let rawModel = null;
  const isSword =
    weaponId === 'club' ||
    weaponId === 'spear' ||
    weaponId === 'zweihander' ||
    weaponId === 'axe' ||
    weaponId === 'boss_hammer' ||
    weaponId === 'cleaver' ||
    weaponId === 'flail';
  const isShotgun =
    weaponId === 'pistol' ||
    weaponId === 'usp_pistol' ||
    weaponId === 'colt' ||
    weaponId === 'smg' ||
    weaponId === 'ak47' ||
    weaponId === 'blunderbuss' ||
    weaponId === 'gatling';

  if (weaponId === 'spear' || weaponId === 'cleaver') {
    rawModel = gltfCache.has('spear_tripo')
      ? gltfCache.get('spear_tripo').scene.clone(true)
      : gltfCache.get('sword_tripo')?.scene.clone(true) || createHeroWeaponMesh(weaponId, mageElement);
  } else if (weaponId === 'zweihander') {
    rawModel = gltfCache.has('zweihander_tripo')
      ? gltfCache.get('zweihander_tripo').scene.clone(true)
      : gltfCache.get('sword_tripo')?.scene.clone(true) || createHeroWeaponMesh(weaponId, mageElement);
  } else if (weaponId === 'axe' || weaponId === 'flail') {
    rawModel = gltfCache.has('axe_tripo')
      ? gltfCache.get('axe_tripo').scene.clone(true)
      : gltfCache.get('sword_tripo')?.scene.clone(true) || createHeroWeaponMesh(weaponId, mageElement);
  } else if (weaponId === 'boss_hammer') {
    rawModel = gltfCache.has('hammer_tripo')
      ? gltfCache.get('hammer_tripo').scene.clone(true)
      : gltfCache.get('sword_tripo')?.scene.clone(true) || createHeroWeaponMesh(weaponId, mageElement);
  } else if (weaponId === 'colt' && gltfCache.has('colt_tripo')) {
    rawModel = gltfCache.get('colt_tripo').scene.clone(true);
  } else if (weaponId === 'colt') {
    rawModel = createHeroWeaponMesh('colt', null);
  } else if (weaponId === 'usp_pistol' && gltfCache.has('pistol_tripo')) {
    rawModel = gltfCache.get('pistol_tripo').scene.clone(true);
  } else if (weaponId === 'smg' && gltfCache.has('smg_tripo')) {
    rawModel = gltfCache.get('smg_tripo').scene.clone(true);
  } else if (weaponId === 'ak47' && gltfCache.has('ak47_tripo')) {
    rawModel = gltfCache.get('ak47_tripo').scene.clone(true);
  } else if (isSword && gltfCache.has('sword_tripo')) {
    rawModel = gltfCache.get('sword_tripo').scene.clone(true);
  } else if (isShotgun && gltfCache.has('shotgun_tripo')) {
    rawModel = gltfCache.get('shotgun_tripo').scene.clone(true);
  } else if (!isSword && !isShotgun && gltfCache.has('staff_tripo')) {
    rawModel = gltfCache.get('staff_tripo').scene.clone(true);
  } else {
    rawModel = createHeroWeaponMesh(weaponId, mageElement);
  }

  let tintHex = 0x000000;
  let tintInt = 0;
  if (weaponId === 'blunderbuss') { tintHex = 0xea580c; tintInt = 0.22; }
  else if (weaponId === 'gatling') { tintHex = 0x0284c7; tintInt = 0.25; }

  const preOwnedMats = Array.isArray(rawModel?.userData?.ownedMaterials)
    ? rawModel.userData.ownedMaterials.slice()
    : [];
  if (rawModel?.userData?.ownedMaterials) {
    rawModel.userData.ownedMaterials.length = 0;
  }

  rawModel.traverse((n) => {
    if (n.isMesh && n.material) {
      n.castShadow = true;
      n.receiveShadow = false;
      const list = Array.isArray(n.material) ? n.material.map((m) => m.clone()) : [n.material.clone()];
      showcaseMats.push(...list);
      for (const m of list) {
        if (isLocked) {
          if (m.color) m.color.setHex(0x524c66);
          m.roughness = 0.72;
        } else {
          if (m.color) m.color.setHex(0xffffff);
          if (m.emissive && tintInt > 0) {
            m.emissive.setHex(tintHex);
            m.emissiveIntensity = tintInt;
          }
        }
      }
      n.material = Array.isArray(n.material) ? list : list[0];
    }
  });
  for (const oldMat of preOwnedMats) {
    if (oldMat?.dispose) oldMat.dispose();
  }

  let showcaseStaffVfx = null;
  if (!isSword && !isShotgun && gltfCache.has('staff_tripo') && !isLocked) {
    showcaseStaffVfx = createLivingStaffOrbVfx(9.95, mageElement || 'water');
    showcaseStaffVfx.group.position.set(-3.8114, 81.55, 0.3818);
    rawModel.add(showcaseStaffVfx.group);
  }

  // Normalize bounding box to a crisp heroic ~1.82m showcase span centered at (0,0,0)!
  rawModel.position.set(0, 0, 0);
  rawModel.rotation.set(0, 0, 0);
  rawModel.scale.setScalar(1);
  rawModel.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(rawModel);
  const sz = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(sz.x, sz.y, sz.z, 0.001);
  const targetSpan =
    weaponId === 'usp_pistol'
      ? 1.32
      : weaponId === 'colt'
        ? 1.44
        : weaponId === 'spear'
          ? 2.10
          : weaponId === 'zweihander'
            ? 1.98
            : isShotgun
              ? 1.88
              : isSword
                ? 1.82
                : 1.92;
  const normScale = targetSpan / maxDim;
  rawModel.scale.setScalar(normScale);
  rawModel.updateMatrixWorld(true);
  const centeredBox = new THREE.Box3().setFromObject(rawModel);
  const center = centeredBox.getCenter(new THREE.Vector3());
  rawModel.position.sub(center);

  // Melee & Staves float vertically at a 42° heroic angle; Firearms ALWAYS float horizontally in sleek profile!
  const orientWrap = new THREE.Group();
  orientWrap.add(rawModel);
  if (isShotgun) {
    if (sz.z > sz.x) {
      orientWrap.rotation.y = Math.PI * 0.5;
    }
    tiltPivot.add(orientWrap);
    tiltPivot.rotation.z = 0.14;
    tiltPivot.rotation.x = 0.08;
  } else {
    if (sz.z > sz.y && sz.z > sz.x) {
      orientWrap.rotation.x = -Math.PI * 0.5;
    } else if (sz.x > sz.y && sz.x > sz.z) {
      orientWrap.rotation.z = Math.PI * 0.5;
    }
    tiltPivot.add(orientWrap);
    tiltPivot.rotation.z = -0.68;
    tiltPivot.rotation.x = 0.14;
  }

  root.position.set(0, 1.02, 0.12);

  function update(dt = 0.016, elapsedTime = 0) {
    floatPivot.position.y = Math.sin(elapsedTime * 2.1) * 0.055;
    showcaseStaffVfx?.updateVfx(elapsedTime, 0);
  }

  function dispose() {
    if (showcaseStaffVfx) {
      if (showcaseStaffVfx.group?.parent) {
        showcaseStaffVfx.group.parent.remove(showcaseStaffVfx.group);
      }
      showcaseStaffVfx.dispose?.();
      showcaseStaffVfx = null;
    }
    for (const mat of showcaseMats) {
      if (mat?.dispose) mat.dispose();
    }
    showcaseMats.length = 0;
    rawModel?.traverse?.((n) => {
      if (n.isSkinnedMesh && n.skeleton) n.skeleton.dispose();
    });
  }

  return { root, update, dispose };
}

function createMagePotionFlask() {
  const grp = new THREE.Group();
  const glass = new THREE.Mesh(
    getGeo('pot_glass', () => new THREE.SphereGeometry(0.13, 10, 10)),
    getMat('pot_glass_mat', () =>
      new THREE.MeshStandardMaterial({
        color: 0x93c5fd,
        emissive: 0x6366f1,
        emissiveIntensity: 1.35,
        roughness: 0.15
      })
    )
  );
  const neck = new THREE.Mesh(
    getGeo('pot_neck', () => new THREE.CylinderGeometry(0.05, 0.06, 0.10, 8)),
    getMat('pot_neck_mat', () => new THREE.MeshStandardMaterial({ color: 0xa78bfa, roughness: 0.3 }))
  );
  neck.position.y = 0.13;
  grp.add(glass, neck);
  grp.position.set(0, 0.08, 0.08);
  return grp;
}

// ============================================================================
// Stylized Dark-Souls Golden Estus Flask 3D Prop + Zero-Alloc Drink Solver
// Mounted to Warrior's LeftHand (visible = false by default). During drinking,
// the left-hand shield smoothly swings behind the left shoulder onto Spine2,
// the right-hand sword lowers calmly to the right hip (blade down-and-back),
// and the left hand raises & tilts the glowing Estus Flask to the visor!
// ============================================================================
function createEstusFlaskMesh() {
  const grp = new THREE.Group();
  grp.name = 'HeroProp_EstusFlask';

  // Faceted 6-sided crystal Estus bottle (base -> belly -> shoulder -> slender neck -> flared rim)
  const bottleGeo = getGeo('estus_flask_glass_v1', () => {
    const pts = [
      new THREE.Vector2(0.0, -0.052),
      new THREE.Vector2(0.028, -0.052),
      new THREE.Vector2(0.044, -0.022),
      new THREE.Vector2(0.042, 0.016),
      new THREE.Vector2(0.024, 0.046),
      new THREE.Vector2(0.015, 0.058),
      new THREE.Vector2(0.016, 0.080),
      new THREE.Vector2(0.024, 0.090),
      new THREE.Vector2(0.013, 0.088)
    ];
    const g = new THREE.LatheGeometry(pts, 6);
    g.computeVertexNormals();
    return g;
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.78,
    roughness: 0.16,
    metalness: 0.14,
    transparent: true,
    opacity: 0.84
  });
  const glassMesh = new THREE.Mesh(bottleGeo, glassMat);
  glassMesh.castShadow = false;
  glassMesh.frustumCulled = false;

  // Blazing amber-gold Estus liquid core inside the faceted bottle
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xfef9c3,
    emissive: 0xf59e0b,
    emissiveIntensity: 2.2,
    roughness: 0.12,
    metalness: 0.05
  });
  const coreMesh = new THREE.Mesh(
    getGeo('estus_flask_core_v1', () => new THREE.OctahedronGeometry(0.032, 0)),
    coreMat
  );
  coreMesh.scale.set(1.05, 1.24, 1.05);
  coreMesh.position.y = -0.004;
  coreMesh.frustumCulled = false;

  // Forged antique brass neck collar + flared drinking lip band
  const brassMat = getMat('estus_flask_brass_mat', () =>
    new THREE.MeshStandardMaterial({
      color: 0xd99b26,
      metalness: 0.85,
      roughness: 0.24
    })
  );
  const collarMesh = new THREE.Mesh(
    getGeo('estus_flask_collar_v1', () => new THREE.CylinderGeometry(0.019, 0.023, 0.015, 6)),
    brassMat
  );
  collarMesh.position.y = 0.056;
  collarMesh.frustumCulled = false;

  const rimMesh = new THREE.Mesh(
    getGeo('estus_flask_rim_v1', () => {
      const tg = new THREE.TorusGeometry(0.021, 0.0044, 6, 8);
      tg.rotateX(Math.PI * 0.5);
      return tg;
    }),
    brassMat
  );
  rimMesh.position.y = 0.088;
  rimMesh.frustumCulled = false;

  // Soft additive golden aura that surges brightly while pouring into the visor
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });
  const haloMesh = new THREE.Mesh(
    getGeo('estus_flask_halo_v1', () => new THREE.SphereGeometry(0.046, 10, 10)),
    haloMat
  );
  haloMesh.position.y = 0.008;
  haloMesh.frustumCulled = false;

  grp.add(glassMesh, coreMesh, collarMesh, rimMesh, haloMesh);
  grp.visible = false;
  grp.userData.glassMat = glassMat;
  grp.userData.coreMat = coreMat;
  grp.userData.haloMat = haloMat;
  grp.userData.haloMesh = haloMesh;
  grp.userData.ownedMaterials = [glassMat, coreMat, haloMat];
  return grp;
}

function smoothstep01(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / Math.max(1e-5, edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Precomputed Warrior RightHand model-space orientations for relaxed lowered-hip weapon hold while drinking Estus Flask
// (blade/shaft points down, outward-right, and back along (-0.42, -0.44, -0.79) — clear of face & floor!)
function buildFlaskLowerHandRModelQuat(rx, ry, rz, rotY = 0) {
  const qMount = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'XYZ'));
  const qFlip = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, rotY, 0, 'XYZ'));
  const qWeaponInHandRInv = qMount.multiply(qFlip).normalize().invert();
  const bladeY = new THREE.Vector3(-0.42, -0.44, -0.79).normalize();
  const xHint = new THREE.Vector3(0.85, -0.25, -0.45).normalize();
  const wx = xHint.clone().addScaledVector(bladeY, -xHint.dot(bladeY)).normalize();
  const wz = new THREE.Vector3().crossVectors(wx, bladeY).normalize();
  wx.crossVectors(bladeY, wz).normalize();
  const m = new THREE.Matrix4().makeBasis(wx, bladeY, wz);
  const qWeaponModel = new THREE.Quaternion().setFromRotationMatrix(m);
  return qWeaponModel.multiply(qWeaponInHandRInv).normalize();
}
const _FLASK_SWORD_LOWER_HAND_R_MODEL_Q = buildFlaskLowerHandRModelQuat(-1.0515, 0.4449, -1.6262, 0);
const _FLASK_2H_LOWER_HAND_R_MODEL_Q = buildFlaskLowerHandRModelQuat(-1.04, 0.24, -1.52, 0);
const _FLASK_ZWEI_LOWER_HAND_R_MODEL_Q = buildFlaskLowerHandRModelQuat(-1.04, 0.24, -1.52, Math.PI * 0.5);

const _FLASK_UPRIGHT_AXIS_M = new THREE.Vector3(-0.14, 0.98, 0.12).normalize();
const _FLASK_POUR_AXIS_M = new THREE.Vector3(-0.35, 0.42, -0.84).normalize();
const _FLASK_UNIT_X = new THREE.Vector3(1, 0, 0);
const _FLASK_UNIT_Y = new THREE.Vector3(0, 1, 0);
const _FLASK_UNIT_Z = new THREE.Vector3(0, 0, 1);

const _fModelMatInv = new THREE.Matrix4();
const _fModelQ = new THREE.Quaternion();
const _fModelQInv = new THREE.Quaternion();
const _fParentQInv = new THREE.Quaternion();
const _fBoneModelQ = new THREE.Quaternion();
const _fTargetModelQ = new THREE.Quaternion();
const _fTargetWorldQ = new THREE.Quaternion();
const _fTargetLocalQ = new THREE.Quaternion();
const _fPrevLocalQ = new THREE.Quaternion();
const _fRotAxisQ = new THREE.Quaternion();
const _fClavYawQ = new THREE.Quaternion();
const _fClavRollQ = new THREE.Quaternion();
const _fHandLModelQ = new THREE.Quaternion();
const _fShieldHandPosM = new THREE.Vector3();
const _fShieldHandQuatM = new THREE.Quaternion();
const _fShieldBackPosM = new THREE.Vector3();
const _fShieldBackQuatM = new THREE.Quaternion();
const _fShieldTmpM4 = new THREE.Matrix4();
const _fShieldTmpS = new THREE.Vector3();
const _fFwd = new THREE.Vector3();
const _fSpineM = new THREE.Vector3();
const _fHeadM = new THREE.Vector3();
const _fTargetRM = new THREE.Vector3();
const _fPoleRM = new THREE.Vector3();
const _fTargetRW = new THREE.Vector3();
const _fPoleRW = new THREE.Vector3();
const _fLowLM = new THREE.Vector3();
const _fHighLM = new THREE.Vector3();
const _fTargetLM = new THREE.Vector3();
const _fPoleLM = new THREE.Vector3();
const _fTargetLW = new THREE.Vector3();
const _fPoleLW = new THREE.Vector3();
const _fElbLM = new THREE.Vector3();
const _fHandLM = new THREE.Vector3();
const _fFlaskAxisX = new THREE.Vector3();
const _fForeY = new THREE.Vector3();
const _fHandZ = new THREE.Vector3();
const _fBasisM4 = new THREE.Matrix4();

function normalizeFlaskAngle(rad) {
  let a = rad;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function setFlaskBoneModelQuat(node, targetModelQ, blend) {
  if (!node || !node.parent) return;
  _fPrevLocalQ.copy(node.quaternion);
  _fTargetWorldQ.copy(_fModelQ).multiply(targetModelQ);
  node.parent.getWorldQuaternion(_fParentQInv).invert();
  _fTargetLocalQ.copy(_fParentQInv).multiply(_fTargetWorldQ).normalize();
  if (blend < 0.999) {
    _fPrevLocalQ.slerp(_fTargetLocalQ, blend);
    node.quaternion.copy(_fPrevLocalQ);
  } else {
    node.quaternion.copy(_fTargetLocalQ);
  }
  node.updateMatrixWorld(true);
}

function rotateFlaskBoneModelAxis(node, axisModel, angleRad, blend) {
  if (!node || Math.abs(angleRad) < 1e-5 || blend <= 1e-4) return;
  node.getWorldQuaternion(_fBoneModelQ).premultiply(_fModelQInv);
  _fRotAxisQ.setFromAxisAngle(axisModel, angleRad);
  _fTargetModelQ.copy(_fRotAxisQ).multiply(_fBoneModelQ).normalize();
  setFlaskBoneModelQuat(node, _fTargetModelQ, blend);
}

function setFlaskClavicleModelRot(entry, yawY, rollZ, blend) {
  if (!entry || !entry.node || !entry.node.parent || blend <= 1e-4) return;
  const node = entry.node;
  _fPrevLocalQ.copy(node.quaternion);
  node.quaternion.copy(entry.restQ);
  node.updateMatrixWorld(true);

  node.getWorldQuaternion(_fBoneModelQ).premultiply(_fModelQInv);
  _fClavYawQ.setFromAxisAngle(_FLASK_UNIT_Y, yawY);
  _fClavRollQ.setFromAxisAngle(_FLASK_UNIT_Z, rollZ);
  _fTargetModelQ.copy(_fClavYawQ).multiply(_fClavRollQ).multiply(_fBoneModelQ).normalize();

  _fTargetWorldQ.copy(_fModelQ).multiply(_fTargetModelQ);
  node.parent.getWorldQuaternion(_fParentQInv).invert();
  _fTargetLocalQ.copy(_fParentQInv).multiply(_fTargetWorldQ).normalize();

  if (blend < 0.999) {
    _fPrevLocalQ.slerp(_fTargetLocalQ, blend);
    node.quaternion.copy(_fPrevLocalQ);
  } else {
    node.quaternion.copy(_fTargetLocalQ);
  }
  node.updateMatrixWorld(true);
}

// ============================================================================
// 1. HERO FACTORY — Exact Undead Chibi Skeleton Trio matching User Reference!
//    - gunslinger -> Gunslinger_Tripo.glb (fallback: Skeleton_Minion.glb)
//    - warrior    -> Warrior_Run.glb (fallback: Skeleton_Warrior.glb)
//    - mage       -> Mage_Tripo.glb (fallback: Skeleton_Mage.glb)
// ============================================================================
const CLASS_SKELETON_ASSET = {
  warrior: 'skel_warrior',
  gunslinger: 'skel_minion',
  mage: 'skel_mage'
};

// Normalized [leftPlantPhase, rightPlantPhase] (0..1, after t0 -> 0 clip shift)
// measured via 3D FK boot-strike & mocap foot-lock analysis on each hero GLB.
// Parity 0 = Left boot strike, Parity 1 = Right boot strike.
const HERO_FOOT_PLANT_PHASES = {
  warrior_run: {
    Running_A: [0.315, 0.835],     // 2.200s loop: L heel-plant Fr 20.8, R heel-plant Fr 55.1
    Sprint_A: [0.315, 0.835],      // 2.200s full-sprint loop: synchronized stride phase with Running_A
    Running_Back: [0.365, 0.835],  // 1.333s loop: L toe-plant Fr 14.6, R toe-plant Fr 33.4
    Strafe_Left: [0.49, 0.98],     // 0.900s loop: L outward boot-plant u=0.50, R cross-behind boot-plant u=0.98
    Strafe_Right: [0.98, 0.49]     // 0.900s loop: L cross-behind boot-plant u=0.98, R outward boot-plant u=0.50
  },
  gunslinger_tripo: {
    Running_A: [0.47, 0.97],       // 0.833s loop: L plant Fr 9.4, R plant Fr 19.4
    Running_Back: [0.51, 0.01],    // 0.833s loop: L plant Fr 10.2, R plant Fr 0.2
    Strafe_Left: [0.50, 0.95],     // 0.833s loop: L plant Fr 10.0, R toe-plant Fr 19.0
    Strafe_Right: [0.48, 0.02]     // 0.833s loop: L plant Fr 9.6, R plant Fr 0.4
  },
  mage_tripo: {
    Running_A: [0.39, 0.87]        // 1.033s loop: L flat-lock Fr 12.0, R flat-lock Fr 27.0
  }
};

const HERO_BASE_SCALE = 1.02;
const TRIPO_GUNSLINGER_SCALE = 2.08;
const GUN_PIVOT_BASE_X = 0.06;
const GUN_PIVOT_BASE_Y = 0.70;
const GUN_PIVOT_BASE_Z = 0.24;

const TRIPO_GUN_PIVOT_X = 0.02;
const TRIPO_GUN_PIVOT_Y = 0.78;
const TRIPO_GUN_PIVOT_Z = 0.34;

const SHIELD_DECAL_POOL_MAX = 6;
let cachedShieldWoodGougeTex = null;

function getShieldWoodGougeTexture() {
  if (cachedShieldWoodGougeTex) return cachedShieldWoodGougeTex;
  if (typeof document !== 'undefined') {
    const w = 256;
    const h = 64;
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const c2 = cv.getContext('2d');
    if (c2) {
      c2.clearRect(0, 0, w, h);
      // 1. Jagged dark scorch / iron-scrape outer border
      c2.beginPath();
      c2.moveTo(8, h * 0.52);
      const topPts = [
        [28, h * 0.24], [58, h * 0.14], [96, h * 0.11],
        [142, h * 0.13], [186, h * 0.17], [224, h * 0.27], [248, h * 0.48]
      ];
      for (let i = 0; i < topPts.length; i++) c2.lineTo(topPts[i][0], topPts[i][1]);
      const botPts = [
        [220, h * 0.74], [180, h * 0.85], [136, h * 0.89],
        [90, h * 0.86], [52, h * 0.79], [24, h * 0.69]
      ];
      for (let i = 0; i < botPts.length; i++) c2.lineTo(botPts[i][0], botPts[i][1]);
      c2.closePath();
      c2.fillStyle = '#1b1008';
      c2.fill();

      // 2. Torn raw pale-oak heartwood interior gouge
      c2.save();
      c2.beginPath();
      c2.moveTo(16, h * 0.51);
      c2.lineTo(42, h * 0.29);
      c2.lineTo(88, h * 0.20);
      c2.lineTo(148, h * 0.21);
      c2.lineTo(202, h * 0.28);
      c2.lineTo(238, h * 0.49);
      c2.lineTo(198, h * 0.72);
      c2.lineTo(142, h * 0.79);
      c2.lineTo(82, h * 0.77);
      c2.lineTo(38, h * 0.66);
      c2.closePath();
      c2.clip();

      const oakGrad = c2.createLinearGradient(0, h * 0.18, 0, h * 0.82);
      oakGrad.addColorStop(0.0, '#7c5029');
      oakGrad.addColorStop(0.24, '#dfc092');
      oakGrad.addColorStop(0.52, '#ecd4ab');
      oakGrad.addColorStop(0.78, '#c89962');
      oakGrad.addColorStop(1.0, '#633d1d');
      c2.fillStyle = oakGrad;
      c2.fillRect(0, 0, w, h);

      // Longitudinal raw oak grain fibers & dark splinter crevices
      for (let f = 0; f < 22; f++) {
        const y0 = h * (0.23 + ((f * 37) % 54) * 0.01);
        const x0 = 18 + ((f * 29) % 45);
        const x1 = w - 18 - ((f * 23) % 45);
        c2.strokeStyle = f % 3 === 0 ? 'rgba(62,35,14,0.68)' : 'rgba(252,235,205,0.55)';
        c2.lineWidth = f % 4 === 0 ? 1.8 : 1.0;
        c2.beginPath();
        c2.moveTo(x0, y0);
        c2.quadraticCurveTo(w * 0.5, y0 + ((f % 2 === 0 ? 1 : -1) * 2.6), x1, y0 + ((f % 3) - 1) * 1.8);
        c2.stroke();
      }
      c2.restore();

      // 3. Protruding pale-oak torn splinter tongues at gouge ends
      c2.strokeStyle = '#d9b580';
      c2.lineWidth = 1.6;
      const splinters = [
        [24, h * 0.44, 6, h * 0.36],
        [34, h * 0.64, 14, h * 0.74],
        [218, h * 0.36, 246, h * 0.28],
        [212, h * 0.62, 242, h * 0.70]
      ];
      for (let s = 0; s < splinters.length; s++) {
        const sp = splinters[s];
        c2.beginPath();
        c2.moveTo(sp[0], sp[1]);
        c2.lineTo(sp[2], sp[3]);
        c2.stroke();
      }

      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      cachedShieldWoodGougeTex = tex;
      return tex;
    }
  }
  const data = new Uint8Array([223, 192, 146, 255, 198, 152, 98, 255, 45, 26, 13, 255, 235, 211, 172, 255]);
  const fallback = new THREE.DataTexture(data, 2, 2);
  fallback.needsUpdate = true;
  cachedShieldWoodGougeTex = fallback;
  return fallback;
}

function getShieldWoodGougeGeometry() {
  return getGeo('hero_shield_wood_gouge_strip_v1', () => {
    // Curved, beveled 3D splinter strip with raised center lip so gouges read with real 3D relief
    const geo = new THREE.PlaneGeometry(0.36, 0.086, 6, 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      const nx = px / 0.18; // -1 .. +1
      const ny = py / 0.043; // -1 .. +1
      const archZ = (1 - nx * nx * 0.65) * 0.0055;
      const lipZ = (1 - Math.abs(ny)) * 0.0038 + (ny > 0.4 ? 0.0028 * (1 - Math.abs(nx)) : 0);
      pos.setZ(i, archZ + lipZ);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  });
}

const _decalMeshLocalM4 = new THREE.Matrix4();
const _decalShieldInvM4 = new THREE.Matrix4();
const _decalVtx = new THREE.Vector3();

function ensureShieldOuterSurfaceCache(shieldObj) {
  if (!shieldObj) return null;
  if (shieldObj.userData._outerSurfaceCache) return shieldObj.userData._outerSurfaceCache;
  shieldObj.updateWorldMatrix(true, true);
  _decalShieldInvM4.copy(shieldObj.matrixWorld).invert();

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  const GN = 7;
  const gridMaxZ = new Float32Array(GN * GN);
  gridMaxZ.fill(-Infinity);

  const meshes = [];
  shieldObj.traverse((n) => {
    if (n.isMesh && n.geometry?.attributes?.position && !n.userData?.isShieldGougeDecal) {
      meshes.push(n);
    }
  });

  for (let m = 0; m < meshes.length; m++) {
    const mesh = meshes[m];
    _decalMeshLocalM4.copy(_decalShieldInvM4).multiply(mesh.matrixWorld);
    const posAttr = mesh.geometry.attributes.position;
    const step = Math.max(1, Math.floor(posAttr.count / 900));
    for (let i = 0; i < posAttr.count; i += step) {
      _decalVtx.fromBufferAttribute(posAttr, i).applyMatrix4(_decalMeshLocalM4);
      if (_decalVtx.x < minX) minX = _decalVtx.x;
      if (_decalVtx.x > maxX) maxX = _decalVtx.x;
      if (_decalVtx.y < minY) minY = _decalVtx.y;
      if (_decalVtx.y > maxY) maxY = _decalVtx.y;
      if (_decalVtx.z > maxZ) maxZ = _decalVtx.z;
    }
  }

  if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) {
    const fallback = {
      minX: -0.34,
      maxX: 0.34,
      minY: 0.14,
      maxY: 0.82,
      maxZ: 0.11,
      gn: 0,
      grid: null
    };
    shieldObj.userData._outerSurfaceCache = fallback;
    return fallback;
  }

  const spanX = Math.max(0.05, maxX - minX);
  const spanY = Math.max(0.05, maxY - minY);
  for (let m = 0; m < meshes.length; m++) {
    const mesh = meshes[m];
    _decalMeshLocalM4.copy(_decalShieldInvM4).multiply(mesh.matrixWorld);
    const posAttr = mesh.geometry.attributes.position;
    const step = Math.max(1, Math.floor(posAttr.count / 1200));
    for (let i = 0; i < posAttr.count; i += step) {
      _decalVtx.fromBufferAttribute(posAttr, i).applyMatrix4(_decalMeshLocalM4);
      const gx = Math.min(GN - 1, Math.max(0, Math.floor(((_decalVtx.x - minX) / spanX) * GN)));
      const gy = Math.min(GN - 1, Math.max(0, Math.floor(((_decalVtx.y - minY) / spanY) * GN)));
      const idx = gy * GN + gx;
      if (_decalVtx.z > gridMaxZ[idx]) gridMaxZ[idx] = _decalVtx.z;
    }
  }
  for (let k = 0; k < gridMaxZ.length; k++) {
    if (!Number.isFinite(gridMaxZ[k])) gridMaxZ[k] = maxZ * 0.82;
  }

  const cache = { minX, maxX, minY, maxY, maxZ, gn: GN, grid: gridMaxZ };
  shieldObj.userData._outerSurfaceCache = cache;
  return cache;
}

function sampleShieldOuterZ(cache, x, y) {
  if (!cache || !cache.grid || cache.gn < 2) return (cache?.maxZ ?? 0.10) + 0.004;
  const gn = cache.gn;
  const fx = Math.min(gn - 1.001, Math.max(0, ((x - cache.minX) / Math.max(0.05, cache.maxX - cache.minX)) * (gn - 1)));
  const fy = Math.min(gn - 1.001, Math.max(0, ((y - cache.minY) / Math.max(0.05, cache.maxY - cache.minY)) * (gn - 1)));
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = fx - ix;
  const ty = fy - iy;
  const g = cache.grid;
  const z00 = g[iy * gn + ix];
  const z10 = g[iy * gn + ix + 1];
  const z01 = g[(iy + 1) * gn + ix];
  const z11 = g[(iy + 1) * gn + ix + 1];
  const z0 = z00 + (z10 - z00) * tx;
  const z1 = z01 + (z11 - z01) * tx;
  return z0 + (z1 - z0) * ty;
}

export function createHeroMesh(classId = 'warrior', weaponId = null, mageElement = 'fire') {
  if (classId && typeof classId === 'object') {
    const opts = classId;
    weaponId = opts.weaponId ?? null;
    mageElement = opts.mageElement ?? 'fire';
    classId = opts.classId || 'warrior';
  }
  const safeClass = CLASS_SKELETON_ASSET[classId] ? classId : 'warrior';
  const isTripoGunslinger = safeClass === 'gunslinger' && gltfCache.has('gunslinger_tripo');
  const isTripoWarrior = safeClass === 'warrior' && (gltfCache.has('warrior_run') || gltfCache.has('warrior_tripo'));
  const isTripoMage = safeClass === 'mage' && gltfCache.has('mage_tripo');
  const isAnyTripoHero = isTripoGunslinger || isTripoWarrior || isTripoMage;
  const assetKey = isTripoGunslinger
    ? 'gunslinger_tripo'
    : isTripoWarrior
      ? (gltfCache.has('warrior_run') ? 'warrior_run' : 'warrior_tripo')
      : isTripoMage
        ? 'mage_tripo'
        : CLASS_SKELETON_ASSET[safeClass];
  const asset = gltfCache.get(assetKey);
  const heroBaseScale = isTripoGunslinger
    ? TRIPO_GUNSLINGER_SCALE
    : isTripoWarrior
      ? 2.17
      : isTripoMage
        ? 2.13
        : HERO_BASE_SCALE;

  const root = new THREE.Group();
  syncSoulsRimLightFromBiome();
  let currentWeaponId =
    weaponId || (safeClass === 'warrior' ? 'club' : safeClass === 'gunslinger' ? 'usp_pistol' : 'spark_staff');
  let currentMageElement = mageElement || 'fire';
  let isBeast = false;
  let flashTimer = 0;
  let isDisposed = false;
  let isDeadState = false;
  let proceduralDeathFall = false;
  let deathFallProgress = 0;
  let lastDeathDuration = 0;

  // Gunslinger two-handed carry pivot, recoil kick, pump rack & walk cycle state
  let gunCarryPivot = null;
  let gunKickTimer = 0;
  let gunShotCounter = 0;
  let gunStyleBlend = 0; // 0 = Style A (shots 1..5 extended 1H), 1 = Style B (shots 6..10 canted C.A.R. 1H)
  let aimHoldTimer = 0;
  let aimYawBlend = 0;
  let pumpCycleTimer = 0;
  let isReloadingState = false;
  let reloadBlend = 0;
  let walkPhase = 0;
  let moveBlend = 0;

  let modelInstance = null;
  let animCtrl = null;
  const instanceMats = [];
  let handR = null;
  let handL = null;
  let chestBone = null;
  let headBone = null;
  let upperArmR = null;
  let lowerArmR = null;
  let upperArmL = null;
  let lowerArmL = null;
  let mountedWeaponObj = null;
  let mountedShieldObj = null;
  let legacyWarriorShieldObj = null;
  let shieldDecalRoot = null;
  const shieldDecalSlots = [];
  let shieldDecalCursor = 0;
  let estusFlaskMesh = null;
  let warriorShieldBackAnchor = null;
  let shieldStowedToModelSpace = false;
  let embeddedWarriorSwordNode = null;
  let embeddedPistolNode = null;
  let embeddedShotgunNode = null;
  let embeddedStaffMesh = null;
  let embeddedStaffVfx = null;
  let staffCastPulse = 0;
  let warriorAttackTimer = 0;
  let warriorAttackDur = 0.45;
  let flaskDrinkAnimTimer = 0;
  let flaskDrinkAnimDur = 0.88;
  let heroBuckleTimer = 0;
  let heroBuckleDur = 0.36;
  let heroBuckleTier = 'light';
  let heroBuckleTwistSign = 1;
  const hasBakedGunslingerClips = Boolean(isTripoGunslinger && asset?.clips && asset.clips.has('Idle'));

  // Mixamo skeletal rig map for Tripo Gunslinger (used when IK fallback is active)
  const mx = Object.create(null);
  const mxFingersL = [];
  const mxFingersR = [];

  if (safeClass === 'gunslinger' && !hasBakedGunslingerClips) {
    gunCarryPivot = new THREE.Group();
    if (isTripoGunslinger) {
      gunCarryPivot.position.set(TRIPO_GUN_PIVOT_X, TRIPO_GUN_PIVOT_Y, TRIPO_GUN_PIVOT_Z);
    } else {
      gunCarryPivot.position.set(GUN_PIVOT_BASE_X, GUN_PIVOT_BASE_Y, GUN_PIVOT_BASE_Z);
    }
    root.add(gunCarryPivot);
  }

  const beastRing = new THREE.Mesh(
    getGeo('beast_ring', () => {
      const rg = new THREE.RingGeometry(0.85, 1.18, 28);
      rg.rotateX(-Math.PI / 2);
      return rg;
    }),
    new THREE.MeshBasicMaterial({
      color: safeClass === 'warrior' ? 0xf97316 : safeClass === 'gunslinger' ? 0x38bdf8 : 0xc084fc,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  beastRing.position.y = 0.04;
  beastRing.visible = false;
  root.add(beastRing);

  const heroContactShadow = createActorContactShadowMesh({
    radius: 0.88,
    isBoss: false,
    opacity: 0.56,
    yOffset: 0.016
  });
  root.add(heroContactShadow);

  if (asset) {
    modelInstance = cloneSkinned(asset.scene);
    modelInstance.scale.setScalar(heroBaseScale);
    root.add(modelInstance);

    modelInstance.traverse((node) => {
      const nm = node.name || '';
      const mxMatch = (isTripoGunslinger || assetKey === 'warrior_run')
        ? nm.match(/^mixamorig:?(.+)$/) : null;
      if (mxMatch) {
        const shortName = mxMatch[1];
        const entry = {
          node,
          restQ: node.quaternion.clone(),
          restPos: node.position.clone()
        };
        mx[shortName] = entry;
        if (/^LeftHand(Index|Middle|Ring|Pinky)[123]$/.test(shortName)) {
          mxFingersL.push(entry);
        } else if (/^RightHand(Index|Middle|Ring|Pinky)[123]$/.test(shortName)) {
          mxFingersR.push(entry);
        }
      }

      if (/^handslot\.?r$/i.test(nm) || (!handR && /^hand\.?r$/i.test(nm))) handR = node;
      if ((isTripoWarrior || isTripoMage) && /^mixamorig:?RightHand$/i.test(nm)) handR = node;
      if (/^handslot\.?l$/i.test(nm) || (!handL && /^hand\.?l$/i.test(nm))) handL = node;
      if ((isTripoWarrior || isTripoMage) && /^mixamorig:?LeftHand$/i.test(nm)) handL = node;
      if (/^chest$/i.test(nm)) chestBone = node;
      if (/^head$/i.test(nm)) headBone = node;
      if (/^upperarm\.?r$/i.test(nm)) upperArmR = node;
      if (/^lowerarm\.?r$/i.test(nm)) lowerArmR = node;
      if (/^upperarm\.?l$/i.test(nm)) upperArmL = node;
      if (/^lowerarm\.?l$/i.test(nm)) lowerArmL = node;

      if (node.isMesh && node.material) {
        const isEyeMesh = /Eyes/i.test(node.name);
        const isCloakOrScarf = /Cloak|Cape/i.test(node.name);
        const isRogueHood = /Skeleton_Rogue_Hood/i.test(node.name);
        const isMageHatOrRobe = /Skeleton_Mage_(Hat|Body)/i.test(node.name);

        if (isEyeMesh) {
          const eyeMat = new THREE.MeshStandardMaterial({
            color: 0xffc13b,
            emissive: 0xff6a00,
            emissiveIntensity: 2.6,
            roughness: 0.15
          });
          node.material = eyeMat;
          instanceMats.push({ mat: eyeMat, baseEmissive: 0xff6a00, baseEmissiveInt: 2.6, hasEyeMap: false });
          return;
        }

        const cloned = Array.isArray(node.material)
          ? node.material.map((m) => m.clone())
          : node.material.clone();
        node.material = cloned;
        const list = Array.isArray(cloned) ? cloned : [cloned];

        for (const m of list) {
          const isEmbeddedWeaponMesh = /HeroWeapon|Sword|Staff|Shotgun/i.test(node.name);
          if (isTripoMage && isEmbeddedWeaponMesh && !embeddedStaffMesh) {
            embeddedStaffMesh = node;
          }
          if (isTripoWarrior && /HeroWeapon_Sword/i.test(node.name) && !embeddedWarriorSwordNode) {
            embeddedWarriorSwordNode = node;
          }
          if (isTripoGunslinger && /HeroWeapon_Pistol/i.test(node.name) && !embeddedPistolNode) {
            embeddedPistolNode = node;
            embeddedPistolNode.userData.basePos = node.position.clone();
            embeddedPistolNode.userData.baseQuat = node.quaternion.clone();
          }
          if (isTripoGunslinger && /HeroWeapon_Shotgun/i.test(node.name) && !embeddedShotgunNode) {
            embeddedShotgunNode = node;
          }
          if (isAnyTripoHero) {
            if (m.color) m.color.setHex(0xffffff);
            const eyeTex = cachedEyeEmissiveTextures.get(assetKey);
            const allowEyeGlow = !isEmbeddedWeaponMesh && (!isTripoGunslinger || /tripo_part_0/i.test(node.name));
            if (eyeTex && allowEyeGlow && m.emissive !== undefined) {
              m.emissiveMap = eyeTex;
              m.emissive.setHex(isTripoMage ? 0xff5200 : 0xff7a00);
              m.emissiveIntensity = 2.35;
            }
          } else {
            if (isCloakOrScarf && (safeClass === 'warrior' || safeClass === 'gunslinger') && m.color) {
              m.color.setHex(0x9b2226);
            } else if (isRogueHood && m.color) {
              m.color.lerp(new THREE.Color(0x57534e), 0.65);
            } else if (isMageHatOrRobe && m.color) {
              m.color.lerp(new THREE.Color(0x6b2146), 0.45);
            }
          }
          applySoulsRimLight(m);
          const entry = {
            mat: m,
            baseEmissive: m.emissive ? m.emissive.getHex() : 0x000000,
            baseEmissiveInt: m.emissiveIntensity || 0,
            hasEyeMap: Boolean(m.emissiveMap)
          };
          instanceMats.push(entry);
        }
      }
    });

    // The new warrior_run model already faces +Z (verified in Idle), so it
    // must NOT get the legacy -90deg rotation — that made it run sideways.
    const legacyFaceFix = isTripoMage || (hasBakedGunslingerClips && embeddedShotgunNode && !embeddedPistolNode) ||
      (isTripoWarrior && assetKey !== 'warrior_run');
    if (legacyFaceFix) {
      modelInstance.rotation.y = -Math.PI * 0.5;
    }

    if (headBone && !isAnyTripoHero) {
      headBone.scale.setScalar(1.14);
    }

    if (safeClass === 'warrior' && !isTripoWarrior) {
      if (handL) {
        const legShield = createSkullShield(false);
        legShield.userData.basePos = legShield.position.clone();
        legShield.userData.baseQuat = legShield.quaternion.clone();
        legShield.userData.baseScale = legShield.scale.clone();
        handL.add(legShield);
        legacyWarriorShieldObj = legShield;
      }
    } else if (safeClass === 'gunslinger' && !isTripoGunslinger) {
      if (chestBone) {
        const pack = createBackpackWithBedroll();
        pack.position.set(0, 0.22, -0.26);
        chestBone.add(pack);
      }
    } else if (safeClass === 'mage' && !isTripoMage) {
      if (handL) {
        handL.add(createMagePotionFlask());
      }
    }

    // Golden Estus Flask prop mounted to Warrior's LeftHand (hidden until playFlaskDrinkAnim!)
    // + Spine2/chest back-sling anchor so the left-hand shield cleanly stows onto the back while drinking.
    if (safeClass === 'warrior') {
      if (handL) {
        estusFlaskMesh = createEstusFlaskMesh();
        if (assetKey === 'warrior_run') {
          estusFlaskMesh.position.set(0.006, 0.056, -0.030);
          estusFlaskMesh.rotation.set(0, 0, -Math.PI * 0.5);
          estusFlaskMesh.userData.baseScale = 1.0;
        } else {
          estusFlaskMesh.position.set(0, 0.06, 0.06);
          estusFlaskMesh.scale.setScalar(1.85);
          estusFlaskMesh.userData.baseScale = 1.85;
        }
        estusFlaskMesh.visible = false;
        handL.add(estusFlaskMesh);
      }
      if (assetKey === 'warrior_run' && mx.Spine2?.node) {
        warriorShieldBackAnchor = new THREE.Object3D();
        warriorShieldBackAnchor.name = 'Warrior_ShieldBackAnchor';
        warriorShieldBackAnchor.position.set(-0.2044, -0.2263, -0.0020);
        warriorShieldBackAnchor.quaternion.set(0.1249, 0.7775, -0.0723, -0.6120).normalize();
        mx.Spine2.node.add(warriorShieldBackAnchor);
      } else if (!isTripoWarrior && chestBone) {
        warriorShieldBackAnchor = new THREE.Object3D();
        warriorShieldBackAnchor.name = 'Warrior_ShieldBackAnchor';
        warriorShieldBackAnchor.position.set(0.04, 0.14, -0.34);
        warriorShieldBackAnchor.rotation.set(0.12, Math.PI + 0.18, 0.22);
        chestBone.add(warriorShieldBackAnchor);
      }
    }

    // Tripo warrior now has baked Mixamo clips (Idle, Running_A, Attack, ...):
    // Enable baked animation playback (Idle / Run / attack) for the new warrior.
    if (!isTripoGunslinger || hasBakedGunslingerClips) {
      animCtrl = createAnimController(modelInstance, asset.clips, 'Idle', 'Running_A');
    }

    // Mount Bone-Locked Living GLSL Water/Elemental Sphere right inside HeroWeapon_Staff's wooden claws (0.000mm drift!)
    if (isTripoMage && embeddedStaffMesh) {
      embeddedStaffVfx = createLivingStaffOrbVfx(9.95, currentMageElement || 'water');
      embeddedStaffVfx.group.position.set(-3.8114, 81.55, 0.3818);
      embeddedStaffMesh.add(embeddedStaffVfx.group);
    }
  }

  const gripSocketR = new THREE.Object3D();
  const forendSocketL = new THREE.Object3D();
  const poleTargetR = new THREE.Object3D();
  const poleTargetL = new THREE.Object3D();
  const footTargetL = new THREE.Object3D();
  const footTargetR = new THREE.Object3D();
  const kneePoleL = new THREE.Object3D();
  const kneePoleR = new THREE.Object3D();
  const footRestRootQL = new THREE.Quaternion();
  const footRestRootQR = new THREE.Quaternion();

  function makeBasisQuat(yx, yy, yz, zx, zy, zz) {
    const yv = new THREE.Vector3(yx, yy, yz).normalize();
    const zv = new THREE.Vector3(zx, zy, zz);
    zv.addScaledVector(yv, -zv.dot(yv)).normalize();
    const xv = new THREE.Vector3().crossVectors(yv, zv).normalize();
    zv.crossVectors(xv, yv).normalize();
    const m4 = new THREE.Matrix4().makeBasis(xv, yv, zv);
    return new THREE.Quaternion().setFromRotationMatrix(m4);
  }

  if (isTripoGunslinger && gunCarryPivot) {
    // Exact Pistol Grip/Trigger (Right Hand) & Under-Forend Palm-Up (Left Hand) sockets matching Blender 10/10 rig!
    gripSocketR.position.set(-0.052, -0.076, -0.210);
    gripSocketR.quaternion.copy(makeBasisQuat(0.14, -0.36, 0.92, 0.96, 0.20, -0.18));

    forendSocketL.position.set(0.044, -0.086, 0.062);
    forendSocketL.quaternion.copy(makeBasisQuat(-0.86, -0.02, 0.51, -0.06, -0.995, -0.04));

    gunCarryPivot.add(gripSocketR, forendSocketL);

    poleTargetR.position.set(-0.48, 0.55, -0.28);
    poleTargetL.position.set(0.45, 0.48, -0.12);
    kneePoleL.position.set(0.16, 0.38, 1.15);
    kneePoleR.position.set(-0.16, 0.38, 1.15);
    footTargetL.position.set(0.151, 0.171, 0.129);
    footTargetR.position.set(-0.144, 0.171, 0.038);
    root.add(poleTargetR, poleTargetL, kneePoleL, kneePoleR, footTargetL, footTargetR);

    // Capture rest foot world orientations in root space & pre-apply anatomical finger curls around grip & forend!
    root.updateMatrixWorld(true);
    const rootInvQ = root.getWorldQuaternion(new THREE.Quaternion()).invert();
    if (mx.LeftFoot) {
      mx.LeftFoot.node.getWorldQuaternion(footRestRootQL).premultiply(rootInvQ);
    }
    if (mx.RightFoot) {
      mx.RightFoot.node.getWorldQuaternion(footRestRootQR).premultiply(rootInvQ);
    }

    const palmDownRoot = new THREE.Vector3(0, -1, 0);
    const applyAnatomicalFingerCurl = (entry, angleRad, spreadRad = 0) => {
      if (!entry) return;
      const bWorldQ = entry.node.getWorldQuaternion(new THREE.Quaternion()).premultiply(rootInvQ);
      const yDir = new THREE.Vector3(0, 1, 0).applyQuaternion(bWorldQ).normalize();
      const hingeRoot = new THREE.Vector3().crossVectors(yDir, palmDownRoot);
      if (hingeRoot.lengthSq() < 1e-6) return;
      hingeRoot.normalize();
      const bInvQ = bWorldQ.clone().invert();
      const hingeLocal = hingeRoot.applyQuaternion(bInvQ).normalize();
      const qCurl = new THREE.Quaternion().setFromAxisAngle(hingeLocal, angleRad);
      if (Math.abs(spreadRad) > 1e-4) {
        const spreadLocal = palmDownRoot.clone().applyQuaternion(bInvQ).normalize();
        qCurl.premultiply(new THREE.Quaternion().setFromAxisAngle(spreadLocal, spreadRad));
      }
      entry.curlQ = entry.restQ.clone().multiply(qCurl);
      entry.node.quaternion.copy(entry.curlQ);
    };

    for (let i = 0; i < mxFingersL.length; i++) {
      const fEntry = mxFingersL[i];
      const j = Number(fEntry.node.name.slice(-1)) || 1;
      applyAnatomicalFingerCurl(fEntry, j === 1 ? 0.62 : j === 2 ? 0.76 : 0.50);
    }
    for (let i = 0; i < mxFingersR.length; i++) {
      const fEntry = mxFingersR[i];
      const nm = fEntry.node.name;
      const j = Number(nm.slice(-1)) || 1;
      if (nm.includes('Index')) {
        applyAnatomicalFingerCurl(fEntry, j === 1 ? 0.35 : j === 2 ? 0.85 : 0.60);
      } else {
        applyAnatomicalFingerCurl(fEntry, j === 1 ? 1.05 : j === 2 ? 1.12 : 0.78);
      }
    }
    for (const j of [1, 2, 3]) {
      applyAnatomicalFingerCurl(mx[`LeftHandThumb${j}`], j === 1 ? 0.65 : 0.50, j === 1 ? 0.60 : 0);
      applyAnatomicalFingerCurl(mx[`RightHandThumb${j}`], j === 1 ? 0.62 : 0.55, j === 1 ? 0.25 : 0);
    }
  }

  const _gripPosW = new THREE.Vector3();
  const _forendPosW = new THREE.Vector3();
  const _polePosRW = new THREE.Vector3();
  const _polePosLW = new THREE.Vector3();
  const _footPosLW = new THREE.Vector3();
  const _footPosRW = new THREE.Vector3();
  const _kneePoleLW = new THREE.Vector3();
  const _kneePoleRW = new THREE.Vector3();
  const _rootWorldQ = new THREE.Quaternion();
  const _parentInvQ = new THREE.Quaternion();
  const _targetWorldQ = new THREE.Quaternion();
  const _pitchQuat = new THREE.Quaternion();
  const _unitX = new THREE.Vector3(1, 0, 0);

  function evalTripoFootGait(u) {
    const uu = ((u % 1) + 1) % 1;
    const zFront = 0.267;
    const zRear = -0.077;
    const yFlat = 0.171;
    if (uu < 0.48) {
      const s = uu / 0.48;
      const az = zFront + (zRear - zFront) * s;
      if (s < 0.15) {
        const k = 1 - s / 0.15;
        return { y: yFlat + 0.010 * k, z: az, pitch: -0.28 * k };
      }
      if (s < 0.74) {
        return { y: yFlat, z: az, pitch: 0 };
      }
      const k = (s - 0.74) / 0.26;
      return { y: yFlat + 0.043 * k * k, z: az, pitch: 0.52 * k };
    }
    const s = (uu - 0.48) / 0.52;
    const zMid = 0.5 * (zFront + zRear);
    const zAmp = 0.5 * (zRear - zFront);
    const az = zMid + zAmp * Math.cos(Math.PI * s);
    const ay =
      yFlat +
      Math.sin(Math.PI * Math.pow(s, 0.78)) * 0.112 +
      0.043 * Math.pow(1 - s, 2.4) +
      0.010 * Math.pow(s, 3.0);
    const pitch =
      0.55 * Math.sin(Math.PI * Math.pow(s, 0.70)) * (1 - s * 0.65) +
      0.52 * Math.pow(1 - s, 2.2) -
      0.28 * Math.pow(s, 2.6);
    return { y: ay, z: az, pitch };
  }

  function positionTripoGunPivot(elapsedTime, kickCurve, pumpFrac, reloadBob, beastScale) {
    if (!isTripoGunslinger || !gunCarryPivot) return;
    const walkBobY = Math.sin(2 * walkPhase - 0.35) * 0.010 * moveBlend;
    const idleBobY = Math.sin(elapsedTime * 2.5) * 0.004 * (1 - moveBlend);
    const walkSwayX = -Math.cos(walkPhase) * 0.007 * moveBlend;
    // Natural diagonal carry across chest keeping BOTH elbows comfortably bent (snapping toward firing line when shooting!)
    const baseDiagonalYaw = 0.72 * (1 - aimYawBlend * 0.55);
    const carryYaw = baseDiagonalYaw + Math.sin(walkPhase) * 0.018 * moveBlend;

    gunCarryPivot.scale.setScalar(beastScale);
    gunCarryPivot.position.set(
      (TRIPO_GUN_PIVOT_X + walkSwayX) * beastScale,
      (TRIPO_GUN_PIVOT_Y + walkBobY + idleBobY + kickCurve * 0.026 + reloadBob * 0.018) * beastScale,
      (TRIPO_GUN_PIVOT_Z - kickCurve * 0.068 - pumpFrac * 0.014 - reloadBlend * 0.03) * beastScale
    );
    gunCarryPivot.rotation.set(
      -0.04 - kickCurve * 0.24 + pumpFrac * 0.05 + reloadBlend * 0.20 + reloadBob * 0.05,
      carryYaw + reloadBlend * -0.08,
      reloadBlend * 0.26
    );

    // Slide left-hand forend socket back & forth underneath wooden forend during pump-action rack!
    forendSocketL.position.set(
      0.044,
      -0.086 - reloadBob * 0.015,
      0.062 - pumpFrac * 0.055 - reloadBlend * 0.02
    );
  }

  function applyTripoGunslingerPose(elapsedTime, kickCurve) {
    if (!isTripoGunslinger || !mx.Hips) return;
    const m = moveBlend;
    const idle = 1 - m;
    const p = walkPhase;
    const breath = Math.sin(elapsedTime * 2.5);

    // 1. MONOLITHIC HIPS + SPINE:
    //    - Steady tactical left-side-leading yaw (-0.28 rad) with ZERO spine twisting (Spine/Spine1/Spine2 = 0!)
    //    - Subtle elastic ±0.006m step spring (NO downward pelvic dive!)
    const stanceYaw = -0.28 * (1 - aimYawBlend * 0.45);
    const hipsYOffset = -0.018 * idle + (-0.021 + Math.sin(2 * p - 0.4) * 0.006) * m + breath * 0.002 * idle;

    // Note: in Mixamo Hips local space, X=(-Z_root backward/forward), Y=(+Y_root up), Z=(-X_root)
    mx.Hips.node.position.set(
      mx.Hips.restPos.x - kickCurve * 0.016,
      mx.Hips.restPos.y + hipsYOffset,
      mx.Hips.restPos.z
    );
    setBoneRelEuler(mx.Hips, 0, stanceYaw, -0.05 - 0.02 * m + kickCurve * 0.09);

    // Lock Spine, Spine1, Spine2 at (0,0,0) -> entire Torso + Belt + Backpack move as ONE SOLID MONOLITH!
    setBoneRelEuler(mx.Spine, 0, 0, 0);
    setBoneRelEuler(mx.Spine1, 0, 0, 0);
    setBoneRelEuler(mx.Spine2, 0, 0, 0);

    // 2. Neck & Head: steady forward gaze along +Z
    const counterYaw = -stanceYaw * 1.02;
    setBoneRelEuler(mx.Neck, 0, counterYaw * 0.44, 0.02);
    setBoneRelEuler(
      mx.Head,
      0,
      counterYaw * 0.56 + Math.sin(elapsedTime * 1.4) * 0.02 * idle,
      0.03 - kickCurve * 0.05
    );

    // 3. 2-Bone Biomechanical Foot IK (65-85 deg knee bend on swing, flat boot on stance!)
    const beastScale = isBeast ? 1.78 : 1.0;
    const uL = (p / (Math.PI * 2)) % 1;
    const uR = (uL + 0.5) % 1;
    const gL = evalTripoFootGait(uL);
    const gR = evalTripoFootGait(uR);

    const footLY = (0.171 * idle + gL.y * m) * beastScale;
    const footLZ = (0.129 * idle + gL.z * m) * beastScale;
    const pitchL = gL.pitch * m;

    const footRY = (0.171 * idle + gR.y * m) * beastScale;
    const footRZ = (0.038 * idle + gR.z * m) * beastScale;
    const pitchR = gR.pitch * m;

    footTargetL.position.set(0.151 * beastScale, footLY, footLZ);
    footTargetR.position.set(-0.144 * beastScale, footRY, footRZ);
    kneePoleL.position.set(0.16 * beastScale, 0.38 * beastScale, 1.15 * beastScale);
    kneePoleR.position.set(-0.16 * beastScale, 0.38 * beastScale, 1.15 * beastScale);

    // Calm shoulders + twist-free Arm IK
    setBoneRelEuler(mx.LeftShoulder, 0, 0.04, -0.20);
    setBoneRelEuler(mx.RightShoulder, 0, 0, 0.04);
    root.updateMatrixWorld(true);
    root.getWorldQuaternion(_rootWorldQ);

    footTargetL.getWorldPosition(_footPosLW);
    footTargetR.getWorldPosition(_footPosRW);
    kneePoleL.getWorldPosition(_kneePoleLW);
    kneePoleR.getWorldPosition(_kneePoleRW);

    solveMixamoArmIK(mx.LeftUpLeg, mx.LeftLeg, mx.LeftFoot, _footPosLW, _kneePoleLW);
    solveMixamoArmIK(mx.RightUpLeg, mx.RightLeg, mx.RightFoot, _footPosRW, _kneePoleRW);

    // World-aligned Foot pitch so stance boot stays flat on arena floor!
    if (mx.LeftFoot && mx.LeftFoot.node.parent) {
      mx.LeftFoot.node.parent.getWorldQuaternion(_parentInvQ).invert();
      _pitchQuat.setFromAxisAngle(_unitX, pitchL);
      _targetWorldQ.copy(_rootWorldQ).multiply(_pitchQuat).multiply(footRestRootQL);
      mx.LeftFoot.node.quaternion.copy(_parentInvQ).multiply(_targetWorldQ);
    }
    if (mx.RightFoot && mx.RightFoot.node.parent) {
      mx.RightFoot.node.parent.getWorldQuaternion(_parentInvQ).invert();
      _pitchQuat.setFromAxisAngle(_unitX, pitchR);
      _targetWorldQ.copy(_rootWorldQ).multiply(_pitchQuat).multiply(footRestRootQR);
      mx.RightFoot.node.quaternion.copy(_parentInvQ).multiply(_targetWorldQ);
    }

    // 4. 2-Bone Arm IK + Exact World Hand Copy-Rotation onto Trigger/Grip & Underneath Wooden Forend!
    gripSocketR.getWorldPosition(_gripPosW);
    forendSocketL.getWorldPosition(_forendPosW);
    poleTargetR.getWorldPosition(_polePosRW);
    poleTargetL.getWorldPosition(_polePosLW);

    solveMixamoArmIK(mx.RightArm, mx.RightForeArm, mx.RightHand, _gripPosW, _polePosRW);
    solveMixamoArmIK(mx.LeftArm, mx.LeftForeArm, mx.LeftHand, _forendPosW, _polePosLW);

    if (mx.RightHand && mx.RightHand.node.parent) {
      mx.RightHand.node.parent.getWorldQuaternion(_parentInvQ).invert();
      gripSocketR.getWorldQuaternion(_targetWorldQ);
      mx.RightHand.node.quaternion.copy(_parentInvQ).multiply(_targetWorldQ);
    }
    if (mx.LeftHand && mx.LeftHand.node.parent) {
      mx.LeftHand.node.parent.getWorldQuaternion(_parentInvQ).invert();
      forendSocketL.getWorldQuaternion(_targetWorldQ);
      mx.LeftHand.node.quaternion.copy(_parentInvQ).multiply(_targetWorldQ);
    }
  }

  function applyGunslingerArmPose() {
    if (safeClass !== 'gunslinger' || isTripoGunslinger) return;
    if (upperArmL) upperArmL.quaternion.slerp(GUN_UPPER_ARM_L_Q, 0.90);
    if (lowerArmL) {
      if (reloadBlend > 0.02) {
        _tmpQuatA.copy(GUN_LOWER_ARM_L_Q).slerp(GUN_RELOAD_LOWER_L_Q, reloadBlend * 0.65);
        lowerArmL.quaternion.slerp(_tmpQuatA, 0.90);
      } else {
        lowerArmL.quaternion.slerp(GUN_LOWER_ARM_L_Q, 0.90);
      }
    }
    if (upperArmR) upperArmR.quaternion.slerp(GUN_UPPER_ARM_R_Q, 0.90);
    if (lowerArmR) lowerArmR.quaternion.slerp(GUN_LOWER_ARM_R_Q, 0.90);
  }

  let currentWeaponStyle = '1h_sword';
  let isCurrentWeaponTwoHanded = false;
  let warriorLeftGripSocket = null;
  let isWarriorBlocking = false;
  let dashAnimTimer = 0;
  let dashAnimDur = 0.22;
  const warriorStanceState = createWarriorStanceState();
  const warriorStanceRig = {
    mx,
    modelInstance,
    mountedWeaponObj: null,
    leftGripSocket: null,
    state: warriorStanceState
  };

  function resolveHeroWeaponStyle(wId) {
    const id = String(wId || 'club');
    if (id === 'spear' || id === 'cleaver') return { style: 'spear', twoHanded: true };
    if (id === 'zweihander') return { style: 'zweihander', twoHanded: true };
    if (id === 'axe' || id === 'flail') return { style: 'axe', twoHanded: true };
    if (id === 'boss_hammer' || id === 'hammer') return { style: 'hammer', twoHanded: true };
    return { style: '1h_sword', twoHanded: Boolean(WEAPONS[id]?.twoHanded) };
  }

  const FLASK_RESTORE_MX_BONES = [
    'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
    'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
    'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand'
  ];
  let flaskBonesDirty = false;
  let heroSwordDisarmed = false;
  let heroShieldDisarmed = false;

  // Normalized cutscene clip scrubber for Warrior (Boss Escape Cutscene:
  // Cutscene_FinalClash_Disarm, Cutscene_Knockdown_Scoot, Cutscene_Dodge_Fall,
  // Cutscene_River_Tumble, Cutscene_Shore_WakeUp, Heavy_Thrust__Full)
  let heroCutsceneAction = null;
  let heroPrevCutsceneFromAction = null;
  let heroCutsceneBlendElapsed = 0;
  let heroCutsceneBlendDur = 0.20;
  let heroCutsceneLastPerfMs = 0;

  function applyHeroDisarmVisibility() {
    if (mountedWeaponObj) {
      mountedWeaponObj.visible = !heroSwordDisarmed;
    }
    if (embeddedWarriorSwordNode) {
      embeddedWarriorSwordNode.visible = !heroSwordDisarmed && !mountedWeaponObj;
    }
    const activeShield = mountedShieldObj || legacyWarriorShieldObj;
    if (activeShield) {
      activeShield.visible = !heroShieldDisarmed && !isCurrentWeaponTwoHanded;
    }
  }

  function setWeaponDisarmed(swordHidden = false, shieldHidden = false) {
    heroSwordDisarmed = Boolean(swordHidden);
    heroShieldDisarmed = Boolean(shieldHidden);
    applyHeroDisarmVisibility();
  }

  function getWeaponDisarmed() {
    return { sword: heroSwordDisarmed, shield: heroShieldDisarmed };
  }

  function advanceHeroCutsceneBlend(dtSec) {
    if (!heroCutsceneAction) return;
    if (heroPrevCutsceneFromAction) {
      heroCutsceneBlendElapsed += Math.max(0, dtSec);
      const u = heroCutsceneBlendDur > 0.005 ? Math.min(1, heroCutsceneBlendElapsed / heroCutsceneBlendDur) : 1;
      const s = u * u * (3 - 2 * u);
      heroCutsceneAction.setEffectiveWeight(s);
      heroPrevCutsceneFromAction.setEffectiveWeight(1 - s);
      if (u >= 1) {
        heroPrevCutsceneFromAction.stopFading();
        heroPrevCutsceneFromAction.setEffectiveWeight(0);
        heroPrevCutsceneFromAction.stop();
        heroPrevCutsceneFromAction = null;
      }
    } else {
      heroCutsceneAction.setEffectiveWeight(1.0);
    }
  }

  function setCutsceneClipNormalized(clipName, u01 = 0, blendSec = 0.20) {
    if (isDeadState || !animCtrl || typeof clipName !== 'string' || !clipName) {
      return false;
    }
    const act = animCtrl.getAction?.(`${clipName}__Full`) || animCtrl.getAction?.(clipName);
    if (!act) return false;
    cancelFlaskDrinkAnim();
    isDoorPushing = false;
    animCtrl.setDoorPushState?.(false, 0);
    warriorAttackTimer = 0;
    dashAnimTimer = 0;
    isWarriorBlocking = false;
    animCtrl.setBlockState?.(false);

    const clip = act.getClip?.();
    const dur = clip?.duration > 0 ? clip.duration : 1.0;
    const clampedU = Math.max(0, Math.min(1, Number.isFinite(Number(u01)) ? Number(u01) : 0));
    const safeBlend = Number.isFinite(Number(blendSec)) ? Math.max(0, Math.min(0.8, Number(blendSec))) : 0.20;
    const nowMs = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();

    if (heroCutsceneAction !== act) {
      const preferredOutgoing = heroCutsceneAction && heroCutsceneAction !== act ? heroCutsceneAction : null;
      const rawFromAct = animCtrl.prepareExternalClip
        ? animCtrl.prepareExternalClip(act, safeBlend > 0.005 ? preferredOutgoing : null)
        : null;
      if (safeBlend <= 0.005 && rawFromAct && rawFromAct !== act) {
        rawFromAct.stopFading();
        rawFromAct.setEffectiveWeight(0);
        rawFromAct.stop();
      }
      const fromAct = safeBlend > 0.005 ? rawFromAct : null;
      if (heroPrevCutsceneFromAction && heroPrevCutsceneFromAction !== fromAct) {
        heroPrevCutsceneFromAction.stopFading();
        heroPrevCutsceneFromAction.setEffectiveWeight(0);
        heroPrevCutsceneFromAction.stop();
      }
      heroPrevCutsceneFromAction = safeBlend > 0.005 ? (fromAct || null) : null;
      if (heroPrevCutsceneFromAction) {
        heroPrevCutsceneFromAction.paused = true;
        heroPrevCutsceneFromAction.enabled = true;
        heroPrevCutsceneFromAction.setEffectiveWeight(1.0);
      }
      if (heroCutsceneAction && heroCutsceneAction !== fromAct) {
        heroCutsceneAction.stopFading();
        heroCutsceneAction.setEffectiveWeight(0);
        heroCutsceneAction.stop();
      }

      act.stopFading();
      act.reset();
      act.setLoop(THREE.LoopOnce, 1);
      act.clampWhenFinished = true;
      act.timeScale = 1.0;
      act.enabled = true;
      act.play();
      act.paused = true;
      act.time = clampedU * dur;
      heroCutsceneAction = act;
      heroCutsceneBlendDur = safeBlend;
      heroCutsceneBlendElapsed = heroPrevCutsceneFromAction ? 0 : safeBlend;
      heroCutsceneLastPerfMs = nowMs;
      advanceHeroCutsceneBlend(0);
    } else {
      act.enabled = true;
      act.paused = true;
      act.time = clampedU * dur;
      if (safeBlend <= 0.005 && heroPrevCutsceneFromAction) {
        heroPrevCutsceneFromAction.stopFading();
        heroPrevCutsceneFromAction.setEffectiveWeight(0);
        heroPrevCutsceneFromAction.stop();
        heroPrevCutsceneFromAction = null;
        act.setEffectiveWeight(1.0);
        heroCutsceneLastPerfMs = nowMs;
      } else if (heroPrevCutsceneFromAction) {
        const dtWall = heroCutsceneLastPerfMs > 0 ? Math.max(0, Math.min(0.05, (nowMs - heroCutsceneLastPerfMs) * 0.001)) : 0.016;
        heroCutsceneLastPerfMs = nowMs;
        advanceHeroCutsceneBlend(dtWall > 0.0005 ? dtWall : 0.016);
      } else {
        act.setEffectiveWeight(1.0);
        heroCutsceneLastPerfMs = nowMs;
      }
    }

    if (modelInstance) {
      modelInstance.rotation.x = 0;
      modelInstance.position.y = 0;
    }
    animCtrl.mixer.update(0);
    applyHeroDisarmVisibility();
    return true;
  }

  function clearCutsceneClip(blendOutSec = 0.20) {
    const outgoing = heroCutsceneAction;
    if (heroPrevCutsceneFromAction) {
      heroPrevCutsceneFromAction.stopFading();
      heroPrevCutsceneFromAction.setEffectiveWeight(0);
      heroPrevCutsceneFromAction.stop();
      heroPrevCutsceneFromAction = null;
    }
    heroCutsceneAction = null;
    heroCutsceneBlendElapsed = 0;
    heroCutsceneBlendDur = 0.20;
    heroCutsceneLastPerfMs = 0;
    if (animCtrl && !isDeadState) {
      const safeBlend = Number.isFinite(Number(blendOutSec)) ? Number(blendOutSec) : 0.20;
      if (outgoing && safeBlend > 0.01 && typeof animCtrl.handoffExternalClipToBase === 'function') {
        animCtrl.handoffExternalClipToBase(outgoing, 'Idle', 1.0, safeBlend);
      } else {
        if (outgoing) {
          outgoing.stopFading();
          outgoing.setEffectiveWeight(0);
          outgoing.stop();
        }
        animCtrl.setBaseState('Idle', 1.0);
        animCtrl.updateOneShotFade?.(0.25);
      }
      animCtrl.mixer.update(0);
    } else if (outgoing) {
      outgoing.stopFading();
      outgoing.setEffectiveWeight(0);
      outgoing.stop();
    }
    applyHeroDisarmVisibility();
  }

  function isCutsceneClipActive() {
    return Boolean(!isDeadState && heroCutsceneAction);
  }

  function restoreWeaponToRightHand() {
    if (safeClass !== 'warrior' || !mountedWeaponObj || !handR) return;
    if (mountedWeaponObj.parent !== handR) {
      handR.add(mountedWeaponObj);
    }
    if (mountedWeaponObj.userData?.basePos) mountedWeaponObj.position.copy(mountedWeaponObj.userData.basePos);
    if (mountedWeaponObj.userData?.baseQuat) mountedWeaponObj.quaternion.copy(mountedWeaponObj.userData.baseQuat);
    if (mountedWeaponObj.userData?.baseScale) mountedWeaponObj.scale.copy(mountedWeaponObj.userData.baseScale);
    mountedWeaponObj.visible = !heroSwordDisarmed;
  }

  function restoreShieldToLeftHand() {
    const activeShield = mountedShieldObj || legacyWarriorShieldObj;
    if (!activeShield || !handL) {
      shieldStowedToModelSpace = false;
      return;
    }
    if (activeShield.parent !== handL) {
      handL.add(activeShield);
    }
    if (activeShield.userData?.basePos) activeShield.position.copy(activeShield.userData.basePos);
    if (activeShield.userData?.baseQuat) activeShield.quaternion.copy(activeShield.userData.baseQuat);
    if (activeShield.userData?.baseScale) activeShield.scale.copy(activeShield.userData.baseScale);
    activeShield.visible = !heroShieldDisarmed && !isCurrentWeaponTwoHanded;
    shieldStowedToModelSpace = false;
  }

  function cancelFlaskDrinkAnim() {
    const wasActiveOrDirty = flaskDrinkAnimTimer > 0 || flaskBonesDirty;
    flaskDrinkAnimTimer = 0;
    flaskBonesDirty = false;
    if (estusFlaskMesh) {
      estusFlaskMesh.visible = false;
      const baseSc = estusFlaskMesh.userData?.baseScale ?? 1.0;
      estusFlaskMesh.scale.setScalar(baseSc);
    }
    restoreShieldToLeftHand();
    restoreWeaponToRightHand();
    if (wasActiveOrDirty && safeClass === 'warrior' && modelInstance && !isDisposed) {
      if (assetKey === 'warrior_run') {
        for (let i = 0; i < FLASK_RESTORE_MX_BONES.length; i++) {
          const entry = mx[FLASK_RESTORE_MX_BONES[i]];
          if (entry?.node && entry.restQ) {
            entry.node.quaternion.copy(entry.restQ);
          }
        }
      }
      if (animCtrl?.mixer && !isDeadState) {
        animCtrl.mixer.update(0);
      }
      if (assetKey === 'warrior_run' && (isCurrentWeaponTwoHanded || currentWeaponId === 'great_club') && !isDeadState) {
        warriorStanceRig.modelInstance = modelInstance;
        warriorStanceRig.mountedWeaponObj = mountedWeaponObj;
        warriorStanceRig.leftGripSocket = warriorLeftGripSocket;
        if (warriorStanceRig.state) {
          warriorStanceRig.state.blend = 1;
        }
        applyWarriorWeaponStance(warriorStanceRig, currentWeaponId, 0, {
          isAttacking: warriorAttackTimer > 0 || Boolean(animCtrl?.isOneShotActive?.()),
          isBlocking: isWarriorBlocking,
          isHub: false,
          moveSpeed: 0,
          isMoving: false,
          elapsedTime: 0,
          isDead: false
        });
      }
      modelInstance.updateWorldMatrix(true, true);
    }
  }

  let isDoorPushing = false;
  function setDoorPushMode(active, effort01 = 1.0) {
    if (isDeadState) {
      isDoorPushing = false;
      return false;
    }
    const want = Boolean(active);
    if (want) {
      cancelFlaskDrinkAnim();
      warriorAttackTimer = 0;
      dashAnimTimer = 0;
      isWarriorBlocking = false;
      animCtrl?.setBlockState?.(false);
      animCtrl?.cancelOneShot?.();
      animCtrl?.cancelTurn180?.();
      if (modelInstance) {
        modelInstance.rotation.x = 0;
        modelInstance.position.y = 0;
      }
    }
    const ok = Boolean(animCtrl?.setDoorPushState?.(want, effort01));
    isDoorPushing = want && ok;
    return ok;
  }

  function isDoorPushActive() {
    return Boolean(!isDeadState && (isDoorPushing || animCtrl?.isDoorPushActive?.()));
  }

  function playFlaskDrinkAnim(durationSec = 0.88) {
    if (isDeadState || animCtrl?.isRollActive?.() || animCtrl?.isHitActive?.()) {
      return false;
    }
    isDoorPushing = false;
    animCtrl?.setDoorPushState?.(false, 0);
    warriorAttackTimer = 0;
    dashAnimTimer = 0;
    isWarriorBlocking = false;
    animCtrl?.setBlockState?.(false);
    animCtrl?.cancelOneShot?.();
    animCtrl?.cancelTurn180?.();
    flaskDrinkAnimDur = Math.max(0.35, Math.min(2.2, Number(durationSec) || 0.88));
    flaskDrinkAnimTimer = flaskDrinkAnimDur;
    if (estusFlaskMesh) {
      estusFlaskMesh.visible = true;
    }
    return true;
  }

  function isFlaskDrinkActive() {
    return Boolean(!isDeadState && flaskDrinkAnimTimer > 0);
  }

  function triggerDash(durationSec = 0.22) {
    if (isDeadState || animCtrl?.isRollActive?.()) return;
    cancelFlaskDrinkAnim();
    animCtrl?.cancelTurn180?.();
    animCtrl?.cancelHit?.();
    dashAnimDur = Math.max(0.12, Math.min(0.65, Number(durationSec) || 0.22));
    dashAnimTimer = dashAnimDur;
  }

  function setWeapon(newWeaponId, nextElement = null) {
    cancelFlaskDrinkAnim();
    currentWeaponId = newWeaponId || currentWeaponId;
    const styleInfo = resolveHeroWeaponStyle(currentWeaponId);
    currentWeaponStyle = styleInfo.style;
    isCurrentWeaponTwoHanded = styleInfo.twoHanded;
    warriorLeftGripSocket = null;
    if (nextElement) currentMageElement = nextElement;
    if (embeddedStaffVfx) {
      embeddedStaffVfx.setElementTheme(currentMageElement);
    }
    if (mountedWeaponObj) {
      if (mountedWeaponObj.parent) {
        mountedWeaponObj.parent.remove(mountedWeaponObj);
      }
      disposeOwnedWeaponMaterials(mountedWeaponObj);
      mountedWeaponObj = null;
    }
    if (shieldDecalRoot) {
      if (shieldDecalRoot.parent) shieldDecalRoot.parent.remove(shieldDecalRoot);
      shieldDecalRoot = null;
    }
    for (let i = 0; i < shieldDecalSlots.length; i++) {
      shieldDecalSlots[i]?.mat?.dispose?.();
    }
    shieldDecalSlots.length = 0;
    shieldDecalCursor = 0;
    if (mountedShieldObj) {
      if (shieldDecalRoot && shieldDecalRoot.parent === mountedShieldObj) {
        mountedShieldObj.remove(shieldDecalRoot);
      }
      if (mountedShieldObj.parent) {
        mountedShieldObj.parent.remove(mountedShieldObj);
      }
      disposeOwnedWeaponMaterials(mountedShieldObj);
      mountedShieldObj = null;
    }

    if (isTripoMage) {
      return;
    }

    if (isTripoWarrior) {
      // warrior_run ships a clean body; its active weapon and (for 1H weapons)
      // shield are mounted here as children of the hand bones so they follow
      // every animation exactly.
      if (assetKey === 'warrior_run') {
        const stanceMountCfg = getWarriorWeaponMountConfig(currentWeaponId);
        const useDefaultSword = currentWeaponId === 'club' || (!stanceMountCfg && !WEAPONS[currentWeaponId]);
        const isTwoHanded = Boolean(WEAPONS[currentWeaponId]?.twoHanded || stanceMountCfg?.twoHanded);
        const wantedWeaponId = currentWeaponId;
        warriorStanceRig.modelInstance = modelInstance;
        warriorStanceRig.mountedWeaponObj = null;
        warriorStanceRig.leftGripSocket = null;

        if (handR) {
          if (useDefaultSword) {
            // Starter Oath Broadsword: exact palm-centered mount on warrior_run RightHand
            // (hilt squarely inside closed right palm/fingers; blade tip angled naturally forward +Z in Idle/Walk/Strafe).
            const swordAsset = gltfCache.get('sword_tripo');
            if (swordAsset?.scene) {
              mountedWeaponObj = swordAsset.scene.clone(true);
              mountedWeaponObj.name = 'HeroWeapon_Sword_Mount';
              mountedWeaponObj.scale.setScalar(0.006);
              mountedWeaponObj.position.set(-0.4458, 0.2314, 0.0689);
              mountedWeaponObj.rotation.set(-1.0515, 0.4449, -1.6262);
              mountedWeaponObj.userData.basePos = mountedWeaponObj.position.clone();
              mountedWeaponObj.userData.baseQuat = mountedWeaponObj.quaternion.clone();
              mountedWeaponObj.userData.baseScale = mountedWeaponObj.scale.clone();
              mountedWeaponObj.traverse((n) => {
                if (n.isMesh) {
                  // Disable 21k-tri weapon shadow casting (hero body casts main silhouette; saves 21k tris/shadow pass!)
                  n.castShadow = false;
                  n.frustumCulled = false;
                }
              });
              handR.add(mountedWeaponObj);
            } else {
              mountedWeaponObj = createHeroWeaponMesh(currentWeaponId, null);
              mountedWeaponObj.name = 'HeroWeapon_Sword_Mount';
              mountedWeaponObj.userData.basePos = mountedWeaponObj.position.clone();
              mountedWeaponObj.userData.baseQuat = mountedWeaponObj.quaternion.clone();
              mountedWeaponObj.userData.baseScale = mountedWeaponObj.scale.clone();
              handR.add(mountedWeaponObj);
              if (MODEL_PATHS.sword_tripo && !failedModelKeys.has('sword_tripo')) {
                loadSingleModelKey('sword_tripo').then(() => {
                  if (!isDisposed && currentWeaponId === wantedWeaponId && gltfCache.has('sword_tripo')) {
                    setWeapon(wantedWeaponId, currentMageElement);
                  }
                });
              }
            }
          } else {
            // Purchased / boss Warrior weapons (Spear, Zweihander, Axe, Hammer):
            // Mounted via unified Blender-verified grip & left-hand socket configs from warriorStances.js.
            const weaponKey = getWeaponAssetKey(currentWeaponId);
            const weaponAsset = weaponKey ? gltfCache.get(weaponKey) : null;
            if (weaponAsset?.scene) {
              const cfg = stanceMountCfg || {
                scale: 0.80,
                gripY: 0.24,
                rotY: 0,
                centerZ: 0,
                pivotPos: { x: -0.0235, y: 0.0415, z: -0.0086 },
                pivotRot: { x: -1.04, y: 0.24, z: -1.52 },
                gripLX: 0,
                gripLY: 0.12,
                gripLZ: 0
              };
              const mountPivot = new THREE.Group();
              mountPivot.name = 'HeroWeapon_Sword_Mount';
              mountPivot.position.set(cfg.pivotPos.x, cfg.pivotPos.y, cfg.pivotPos.z);
              mountPivot.rotation.set(cfg.pivotRot.x, cfg.pivotRot.y, cfg.pivotRot.z);
              mountPivot.userData.basePos = mountPivot.position.clone();
              mountPivot.userData.baseQuat = mountPivot.quaternion.clone();
              mountPivot.userData.baseScale = mountPivot.scale.clone();

              const wMesh = weaponAsset.scene.clone(true);
              wMesh.scale.setScalar(cfg.scale);
              wMesh.rotation.set(Math.PI, cfg.rotY, 0);
              wMesh.position.set(0, cfg.gripY * cfg.scale, cfg.centerZ * cfg.scale);
              wMesh.traverse((n) => {
                if (n.isMesh) {
                  n.castShadow = false;
                  n.frustumCulled = false;
                }
              });
              mountPivot.add(wMesh);

              if (isTwoHanded) {
                const gripL = new THREE.Object3D();
                gripL.name = 'HeroWeapon_LeftGripTarget';
                gripL.position.set(cfg.gripLX, cfg.gripLY, cfg.gripLZ);
                mountPivot.add(gripL);
                warriorLeftGripSocket = gripL;
              }

              handR.add(mountPivot);
              mountedWeaponObj = mountPivot;
            } else {
              mountedWeaponObj = createHeroWeaponMesh(currentWeaponId, null);
              mountedWeaponObj.name = 'HeroWeapon_Sword_Mount';
              mountedWeaponObj.userData.basePos = mountedWeaponObj.position.clone();
              mountedWeaponObj.userData.baseQuat = mountedWeaponObj.quaternion.clone();
              mountedWeaponObj.userData.baseScale = mountedWeaponObj.scale.clone();
              handR.add(mountedWeaponObj);
              if (weaponKey && MODEL_PATHS[weaponKey] && !failedModelKeys.has(weaponKey)) {
                loadSingleModelKey(weaponKey).then(() => {
                  if (!isDisposed && currentWeaponId === wantedWeaponId && gltfCache.has(weaponKey)) {
                    setWeapon(wantedWeaponId, currentMageElement);
                  }
                });
              }
            }
          }
        }

        // Shield in the left hand ONLY for 1-handed weapons (omit for 2H Spear/Zweihander/Axe/Hammer).
        if (!isTwoHanded && handL) {
          if (gltfCache.has('shield_custom')) {
            const sh = gltfCache.get('shield_custom').scene.clone(true);
            sh.name = 'HeroWeapon_Shield_Mount';
            sh.traverse((n) => {
              if (n.isMesh) {
                n.castShadow = false;
                n.frustumCulled = false;
              }
            });
            sh.scale.setScalar(0.42);
            sh.position.set(-0.1763, 0.1213, -0.0632);
            sh.rotation.set(-0.4292, -0.24, -2);
            sh.userData.basePos = sh.position.clone();
            sh.userData.baseQuat = sh.quaternion.clone();
            sh.userData.baseScale = sh.scale.clone();
            handL.add(sh);
            mountedShieldObj = sh;
          } else if (MODEL_PATHS.shield_custom && !failedModelKeys.has('shield_custom')) {
            loadSingleModelKey('shield_custom').then(() => {
              if (!isDisposed && currentWeaponId === wantedWeaponId && gltfCache.has('shield_custom')) {
                setWeapon(wantedWeaponId, currentMageElement);
              }
            });
          }
        }

        warriorStanceRig.mountedWeaponObj = mountedWeaponObj;
        warriorStanceRig.leftGripSocket = warriorLeftGripSocket;
        if (animCtrl?.mixer) {
          animCtrl.mixer.update(0);
        }
        applyWarriorWeaponStance(warriorStanceRig, currentWeaponId, 0, {
          isAttacking: warriorAttackTimer > 0 || Boolean(animCtrl?.isOneShotActive?.()),
          isBlocking: isWarriorBlocking,
          isHub: true,
          moveSpeed: 0,
          isMoving: false,
          elapsedTime: 0,
          isDead: Boolean(animCtrl?.isDeadState?.())
        });
        return;
      }
      const useEmbeddedSword = currentWeaponId === 'club' || !WEAPONS[currentWeaponId];
      if (embeddedWarriorSwordNode) {
        embeddedWarriorSwordNode.visible = useEmbeddedSword;
      }
      if (useEmbeddedSword || !handR) {
        return;
      }
      mountedWeaponObj = createHeroWeaponMesh(currentWeaponId, null);
      handR.add(mountedWeaponObj);
      return;
    }

    if (hasBakedGunslingerClips) {
      if (embeddedPistolNode) {
        const usesEmbeddedPistol = currentWeaponId === 'usp_pistol' || !WEAPONS[currentWeaponId];
        embeddedPistolNode.visible = usesEmbeddedPistol;
        if (usesEmbeddedPistol) {
          return;
        }
        const meshObj = createHeroWeaponMesh(currentWeaponId, null);
        const mountParent = embeddedPistolNode.parent || mx.RightHand?.node || handR;
        if (mountParent) {
          const gunSocket = new THREE.Group();
          gunSocket.position.copy(embeddedPistolNode.position);
          gunSocket.quaternion.copy(embeddedPistolNode.quaternion);
          gunSocket.scale.setScalar(1 / Math.max(0.5, heroBaseScale));
          if (currentWeaponId === 'colt') {
            meshObj.position.set(0, 0.035, 0.045);
            meshObj.scale.setScalar(1.05);
          } else if (currentWeaponId === 'smg') {
            meshObj.position.set(0, 0.025, 0.14);
            meshObj.scale.setScalar(0.95);
          } else if (currentWeaponId === 'ak47') {
            meshObj.position.set(0, 0.035, 0.22);
            meshObj.scale.setScalar(0.92);
          } else {
            meshObj.position.set(0, 0.035, 0.14);
            meshObj.scale.setScalar(0.88);
          }
          gunSocket.userData.basePos = gunSocket.position.clone();
          gunSocket.userData.baseQuat = gunSocket.quaternion.clone();
          gunSocket.add(meshObj);
          mountParent.add(gunSocket);
          mountedWeaponObj = gunSocket;
        }
        return;
      }
      const usesEmbeddedShotgun =
        currentWeaponId === 'pistol' || currentWeaponId === 'blunderbuss' || currentWeaponId === 'gatling';
      if (embeddedShotgunNode) {
        embeddedShotgunNode.visible = usesEmbeddedShotgun;
      }
      if (usesEmbeddedShotgun) {
        return;
      }
      const meshObj = createHeroWeaponMesh(currentWeaponId, null);
      const mountParent = embeddedShotgunNode?.parent || handR;
      if (mountParent) {
        const gunSocket = new THREE.Group();
        if (embeddedShotgunNode) {
          gunSocket.position.copy(embeddedShotgunNode.position);
          gunSocket.quaternion.copy(embeddedShotgunNode.quaternion);
          if (currentWeaponId === 'usp_pistol' || currentWeaponId === 'colt') {
            // Pull 1H sidearms closer to the right-hand palm so they sit right in the grip!
            gunSocket.position.y *= 0.56;
            gunSocket.position.z *= 0.52;
          } else {
            gunSocket.position.y *= 0.85;
            gunSocket.position.z *= 0.82;
          }
        }
        gunSocket.userData.basePos = gunSocket.position.clone();
        gunSocket.userData.baseQuat = gunSocket.quaternion.clone();
        meshObj.position.set(0, 0, 0);
        gunSocket.add(meshObj);
        mountParent.add(gunSocket);
        mountedWeaponObj = gunSocket;
      }
      return;
    }

    mountedWeaponObj = createHeroWeaponMesh(currentWeaponId, safeClass === 'mage' ? currentMageElement : null);
    if (safeClass === 'gunslinger' && gunCarryPivot) {
      gunCarryPivot.add(mountedWeaponObj);
    } else if (handR) {
      handR.add(mountedWeaponObj);
    }
  }

  function setElement(newElement) {
    if (!newElement) return;
    currentMageElement = newElement;
    if (embeddedStaffVfx) {
      embeddedStaffVfx.setElementTheme(currentMageElement);
    }
    if (safeClass === 'mage') {
      setWeapon(currentWeaponId, currentMageElement);
    }
  }

  setWeapon(currentWeaponId);
  if (isTripoGunslinger && !hasBakedGunslingerClips) {
    positionTripoGunPivot(0, 0, 0, 0, 1);
    applyTripoGunslingerPose(0, 0, 0);
  } else if (!hasBakedGunslingerClips) {
    applyGunslingerArmPose();
  }

  function setBeastMode(enabled) {
    isBeast = Boolean(enabled);
    beastRing.visible = isBeast;
    const beastScale = isBeast ? 1.78 : 1.0;
    if (modelInstance) {
      modelInstance.scale.setScalar(heroBaseScale * beastScale);
    }
    if (gunCarryPivot) {
      gunCarryPivot.scale.setScalar(beastScale);
      const bx = isTripoGunslinger ? TRIPO_GUN_PIVOT_X : GUN_PIVOT_BASE_X;
      const by = isTripoGunslinger ? TRIPO_GUN_PIVOT_Y : GUN_PIVOT_BASE_Y;
      const bz = isTripoGunslinger ? TRIPO_GUN_PIVOT_Z : GUN_PIVOT_BASE_Z;
      gunCarryPivot.position.set(bx * beastScale, by * beastScale, bz * beastScale);
    }
    const beastGlow = safeClass === 'warrior' ? 0xd9480f : safeClass === 'gunslinger' ? 0x2563eb : 0x9333ea;
    for (const item of instanceMats) {
      if (item.mat.emissive && !item.hasEyeMap && item.baseEmissiveInt < 2.0) {
        item.mat.emissive.setHex(isBeast ? beastGlow : item.baseEmissive);
        item.mat.emissiveIntensity = isBeast ? 0.55 : item.baseEmissiveInt;
      }
    }
  }

  function setReloading(reloadingBool) {
    isReloadingState = Boolean(reloadingBool);
  }

  function computeSyncedClipSpeed(clipName, fallbackSpeed, attackDuration, exactSync = false) {
    if (!attackDuration || attackDuration <= 0 || !asset?.clips) return fallbackSpeed;
    const cl = asset.clips.get(clipName);
    if (!cl || !cl.duration) return fallbackSpeed;
    if (exactSync) {
      return Math.max(0.52, Math.min(2.4, cl.duration / Math.max(0.28, attackDuration * 1.02)));
    }
    const minNeededSpeed = cl.duration / Math.max(0.22, attackDuration * 0.96);
    return Math.min(3.5, Math.max(fallbackSpeed, minNeededSpeed));
  }

  function playAttackAnim(_weaponType = null, attackDuration = 0, comboStep = 1) {
    if (isDeadState) return;
    isDoorPushing = false;
    animCtrl?.setDoorPushState?.(false, 0);
    cancelFlaskDrinkAnim();
    animCtrl?.cancelTurn180?.();
    animCtrl?.cancelRoll?.();
    if (safeClass === 'gunslinger') {
      gunShotCounter += 1;
      gunKickTimer = Math.min(0.24, Math.max(0.12, (attackDuration || 0.25) * 0.65));
      aimHoldTimer = 0.85;
      if (hasBakedGunslingerClips && animCtrl) {
        const useStyleB = Math.floor((gunShotCounter - 1) / 5) % 2 === 1;
        const shootClip = useStyleB && asset?.clips?.has('Shoot_B') ? 'Shoot_B' : asset?.clips?.has('Shoot_A') ? 'Shoot_A' : 'Shoot';
        if (asset?.clips?.has(shootClip)) {
          animCtrl.triggerOneShot(shootClip, computeSyncedClipSpeed(shootClip, 1.55, attackDuration));
        }
        return;
      }
      pumpCycleTimer = currentWeaponId === 'pistol' ? 0.38 : 0.22;
      return;
    }
    if (!animCtrl) return;
    if (safeClass === 'warrior') {
      const isHeavyThrust =
        comboStep === 4 ||
        comboStep === 'heavy' ||
        comboStep === 'r2' ||
        comboStep === 'heavy_thrust' ||
        _weaponType === 'heavy_thrust' ||
        _weaponType === 'Heavy_Thrust';
      const step = isHeavyThrust ? 4 : comboStep === 2 ? 2 : comboStep === 3 ? 3 : 1;
      const isGreatClub = currentWeaponId === 'great_club';
      const isHeavyWpn = currentWeaponId === 'axe' || currentWeaponId === 'boss_hammer' || isGreatClub;
      let targetClip = '1H_Melee_Attack_Slice_Horizontal';
      // Grounded Elden Ring strike cadence: readable steel blade arc (165-190ms) + physical end-of-arc arrest!
      let baseClipSpd = isGreatClub
        ? 1.0
        : isHeavyThrust
          ? (isHeavyWpn ? 0.84 : 0.94)
          : step === 3
            ? (isHeavyWpn ? 0.82 : 0.92)
            : step === 2
              ? (isHeavyWpn ? 0.96 : 1.08)
              : (isHeavyWpn ? 0.98 : 1.12);
      if (isTripoWarrior) {
        if (isGreatClub) {
          // Elden Ring Large Club / Great Club 3-hit authentic combo clips:
          //   1 -> Club_Attack_1 (high-right -> low-left diagonal downward crush, 1.05s)
          //   2 -> Club_Attack_2 (wide low-left -> high-right rising horizontal cross-sweep, 1.05s)
          //   3 / 4 -> Club_Attack_3 (sky-high overhead earth-slam crusher, 1.32s)
          const clubDesired = isHeavyThrust || step === 3
            ? 'Club_Attack_3'
            : step === 2
              ? 'Club_Attack_2'
              : 'Club_Attack_1';
          targetClip = asset?.clips?.has(clubDesired)
            ? clubDesired
            : asset?.clips?.has('Attack')
              ? 'Attack'
              : '1H_Melee_Attack_Slice_Horizontal';
        } else {
          // Warrior_Run.glb carries 4 distinct sword melee attack clips:
          //   1 -> 1H_Melee_Attack_Slice_Horizontal (crisp top-right -> bottom-left R1 opener)
          //   2 -> Slash (right-foot step-in diagonal top-left -> bottom-right R1 cut)
          //   3 -> Attack (slow, heavy overhead slam R1 finisher)
          //   4 -> Heavy_Thrust (60 FPS 1H piercing forward lunge for R2 / Charged R2)
          const desired = isHeavyThrust
            ? 'Heavy_Thrust'
            : step === 2
              ? 'Slash'
              : step === 3
                ? 'Attack'
                : '1H_Melee_Attack_Slice_Horizontal';
          targetClip = asset?.clips?.has(desired)
            ? desired
            : isHeavyThrust && asset?.clips?.has('Attack')
              ? 'Attack'
              : '1H_Melee_Attack_Slice_Horizontal';
        }
      } else {
        baseClipSpd = isHeavyThrust ? 1.05 : step === 3 ? 1.15 : step === 2 ? 1.32 : 1.75;
        const desired = isHeavyThrust
          ? '1H_Melee_Attack_Stab'
          : currentWeaponId === 'flail'
            ? '2H_Melee_Attack_Spin'
            : currentWeaponId === 'cleaver'
              ? '2H_Melee_Attack_Slice'
              : step === 2
                ? '1H_Melee_Attack_Slice_Diagonal'
                : step === 3
                  ? '1H_Melee_Attack_Chop'
                  : '1H_Melee_Attack_Slice_Horizontal';
        targetClip = asset?.clips?.has(desired) ? desired : '1H_Melee_Attack_Slice_Horizontal';
      }
      // Prevent same-clip restart spam, while allowing smooth cross-fade into the next combo clip or R2 Heavy_Thrust
      const remSec = animCtrl.getOneShotRemainingSec ? animCtrl.getOneShotRemainingSec() : (animCtrl.isOneShotActive?.() ? 0.2 : 0);
      const activeClip = animCtrl.getActiveAttackClipName ? animCtrl.getActiveAttackClipName() : null;
      const cleanActiveClip = activeClip ? activeClip.replace(/__Full$/, '') : null;
      const isDifferentComboClip = Boolean(cleanActiveClip && cleanActiveClip !== targetClip);
      if (!isHeavyThrust && remSec > (isDifferentComboClip ? 0.85 : 0.12)) return;
      if (isHeavyThrust && !isDifferentComboClip && remSec > 0.16) return;

      let finalSpd;
      if (isHeavyThrust) {
        const thrustCl = asset?.clips?.get(targetClip);
        finalSpd =
          attackDuration > 0 && thrustCl?.duration
            ? Math.max(0.45, Math.min(2.2, thrustCl.duration / Math.max(0.32, attackDuration * 1.02)))
            : baseClipSpd;
        warriorAttackDur =
          attackDuration > 0
            ? Math.max(0.35, Math.min(1.85, attackDuration))
            : thrustCl?.duration
              ? Math.max(0.35, thrustCl.duration / Math.max(0.3, finalSpd))
              : 0.90;
      } else {
        finalSpd = computeSyncedClipSpeed(targetClip, baseClipSpd, attackDuration, isTripoWarrior && attackDuration > 0);
        warriorAttackDur = attackDuration > 0 ? Math.max(0.34, Math.min(1.65, attackDuration * 0.96)) : 0.68;
      }
      warriorAttackTimer = warriorAttackDur;
      animCtrl.triggerOneShot(targetClip, finalSpd);
    } else {
      if (animCtrl.isOneShotActive && animCtrl.isOneShotActive()) return;
      staffCastPulse = 1.0;
      const baseSpd = isTripoMage ? 1.72 : 1.9;
      animCtrl.triggerOneShot('Spellcast_Shoot', computeSyncedClipSpeed('Spellcast_Shoot', baseSpd, attackDuration));
    }
  }

  function playHeavyThrustAnim(speedScale = 1.0, attackDuration = 0) {
    if (isDeadState || !animCtrl) return false;
    cancelFlaskDrinkAnim();
    animCtrl.cancelTurn180?.();
    animCtrl.cancelRoll?.();
    isWarriorBlocking = false;
    animCtrl.setBlockState?.(false);

    const safeScale = Math.max(0.4, Math.min(2.5, Number(speedScale) || 1.0));
    const targetClip =
      currentWeaponId === 'great_club' && asset?.clips?.has('Club_Attack_3')
        ? 'Club_Attack_3'
        : asset?.clips?.has('Heavy_Thrust')
          ? 'Heavy_Thrust'
          : asset?.clips?.has('1H_Melee_Attack_Stab')
            ? '1H_Melee_Attack_Stab'
            : asset?.clips?.has('Attack')
              ? 'Attack'
              : '1H_Melee_Attack_Slice_Horizontal';
    const cl = asset?.clips?.get(targetClip);
    let finalSpd = safeScale;
    if (attackDuration > 0 && cl?.duration) {
      finalSpd = Math.max(0.42, Math.min(2.4, (cl.duration / Math.max(0.28, attackDuration)) * safeScale));
    }
    warriorAttackDur = cl?.duration
      ? Math.max(0.28, Math.min(1.8, cl.duration / Math.max(0.3, finalSpd)))
      : Math.max(0.35, 0.90 / finalSpd);
    warriorAttackTimer = warriorAttackDur;
    animCtrl.triggerOneShot(targetClip, finalSpd);
    return true;
  }

  function triggerAttack(arg1 = null, arg2 = 0, arg3 = 1) {
    if (typeof arg1 === 'number') {
      return playAttackAnim(null, Number(arg2) || 0, arg1);
    }
    return playAttackAnim(arg1, arg2, arg3);
  }

  function setBlocking(active) {
    const rolling = Boolean(animCtrl?.isRollActive?.());
    isWarriorBlocking = isDeadState || rolling ? false : Boolean(active);
    if (isWarriorBlocking) {
      isDoorPushing = false;
      animCtrl?.setDoorPushState?.(false, 0);
      cancelFlaskDrinkAnim();
      animCtrl?.cancelTurn180?.();
    }
    if (safeClass === 'warrior' && animCtrl?.setBlockState) {
      animCtrl.setBlockState(isWarriorBlocking);
    }
  }

  function playRollAnim(durationSec = 0.6833) {
    if (isDeadState) return false;
    const safeDur = Math.max(0.18, Math.min(1.2, Number(durationSec) || 0.6833));
    isDoorPushing = false;
    animCtrl?.setDoorPushState?.(false, 0);
    cancelFlaskDrinkAnim();
    warriorAttackTimer = 0;
    dashAnimTimer = 0;
    isWarriorBlocking = false;
    animCtrl?.setBlockState?.(false);
    animCtrl?.cancelTurn180?.();
    animCtrl?.cancelHit?.();
    if (animCtrl?.triggerRoll?.(safeDur, 'Combat_Roll')) {
      if (modelInstance) {
        modelInstance.rotation.x = 0;
        modelInstance.position.y = 0;
      }
      return true;
    }
    // Safe fallback for hero classes without a baked Combat_Roll clip (Mage / Gunslinger)
    triggerDash(safeDur);
    return false;
  }

  function playCriticalRiposte(speed = 1.0, blendInSec = 0.12) {
    if (isDeadState || !animCtrl) return { ok: false, duration: 0 };
    const riposteAct = animCtrl.getAction?.('Critical_Riposte');
    if (!riposteAct) return { ok: false, duration: 0 };
    const safeSpeed = Number.isFinite(Number(speed)) && Number(speed) > 0.1 ? Number(speed) : 1.0;
    const safeBlend = Number.isFinite(Number(blendInSec)) && Number(blendInSec) >= 0.02 ? Number(blendInSec) : 0.12;
    isDoorPushing = false;
    animCtrl.setDoorPushState?.(false, 0);
    cancelFlaskDrinkAnim();
    warriorAttackTimer = 0;
    dashAnimTimer = 0;
    isWarriorBlocking = false;
    animCtrl.setBlockState?.(false);
    animCtrl.cancelRoll?.();
    animCtrl.cancelTurn180?.();
    animCtrl.cancelHit?.();
    if (modelInstance) {
      modelInstance.rotation.x = 0;
      modelInstance.position.y = 0;
    }
    animCtrl.triggerOneShot('Critical_Riposte', safeSpeed, safeBlend);
    const clipDur = riposteAct.getClip?.()?.duration || 2.25;
    return { ok: true, duration: clipDur / safeSpeed };
  }

  function isCriticalRiposteActive() {
    if (isDeadState || !animCtrl) return false;
    return animCtrl.getActiveAttackClipName?.() === 'Critical_Riposte' && Boolean(animCtrl.isOneShotActive?.());
  }

  function cancelRollAnim() {
    animCtrl?.cancelRoll?.();
  }

  function isRollActive() {
    return Boolean(!isDeadState && animCtrl?.isRollActive?.());
  }

  function triggerTurn180(speed = 1.38) {
    if (isDeadState || isWarriorBlocking || warriorAttackTimer > 0 || flaskDrinkAnimTimer > 0 || isDoorPushActive() || animCtrl?.isHitActive?.() || animCtrl?.isRollActive?.()) return false;
    if (assetKey !== 'warrior_run' || !animCtrl?.triggerTurn180) return false;
    return Boolean(animCtrl.triggerTurn180(speed));
  }

  function cancelTurn180() {
    animCtrl?.cancelTurn180?.();
  }

  function isTurn180Active() {
    return Boolean(!isDeadState && animCtrl?.isTurn180Active?.());
  }

  function getTurn180State() {
    if (isDeadState || !animCtrl?.getTurn180Progress) return null;
    return animCtrl.getTurn180Progress();
  }

  function triggerHitReact(speed = 1.75, clipName = 'Impact', opts = null) {
    if (isDeadState || isWarriorBlocking || animCtrl?.isRollActive?.() || isDoorPushActive()) return false;
    cancelFlaskDrinkAnim();
    if (!animCtrl?.triggerHit) return false;
    const interruptAttack = opts?.interruptAttack !== false;
    if (interruptAttack) {
      warriorAttackTimer = 0;
    }
    animCtrl.cancelTurn180?.();
    const tier = opts?.damageLevel === 'knockdown' ? 'knockdown' : opts?.damageLevel === 'heavy' ? 'heavy' : 'light';
    heroBuckleTier = tier;
    heroBuckleDur = tier === 'knockdown' ? 0.88 : tier === 'heavy' ? 0.52 : 0.34;
    heroBuckleTimer = heroBuckleDur;
    heroBuckleTwistSign = -heroBuckleTwistSign;
    const effClipSpeed =
      tier === 'knockdown'
        ? 1.08
        : tier === 'heavy'
          ? Math.min(1.55, Math.max(1.15, Number(speed) || 1.42))
          : Math.min(2.10, Math.max(1.45, Number(speed) || 1.85));
    return Boolean(
      animCtrl.triggerHit(effClipSpeed, clipName, {
        interruptAttack,
        blockGuard: true,
        blendInSec: opts?.blendInSec ?? 0.026,
        blendOutSec: opts?.blendOutSec ?? (tier === 'knockdown' ? 0.18 : 0.11),
        maxWeight: opts?.maxWeight ?? 1.0
      })
    );
  }

  function cancelHitReact() {
    heroBuckleTimer = 0;
    animCtrl?.cancelHit?.();
  }

  function isHitReactActive() {
    return Boolean(!isDeadState && animCtrl?.isHitActive?.());
  }

  function setDeadState(dead, speed = 1.25) {
    const wantDead = Boolean(dead);
    if (wantDead) {
      isDoorPushing = false;
      animCtrl?.setDoorPushState?.(false, 0);
      cancelFlaskDrinkAnim();
      if (isDeadState) {
        return lastDeathDuration || 1.4;
      }
      isDeadState = true;
      isWarriorBlocking = false;
      isReloadingState = false;
      dashAnimTimer = 0;
      warriorAttackTimer = 0;
      gunKickTimer = 0;
      warriorSprintBlend = 0;
      beastRing.visible = false;
      if (heroContactShadow) {
        heroContactShadow.userData?.setShadowOpacity?.(0.22);
      }
      pendingFootstepEvent = null;
      prevLocomotionClip = null;
      prevLocomotionPhase = null;
      if (warriorStanceRig?.state) {
        warriorStanceRig.state.blend = 0;
      }

      const safeSpeed = Math.max(0.25, Math.abs(Number(speed) || 1.25));
      let clipDur = 0;
      if (animCtrl) {
        if (typeof animCtrl.setDeadState === 'function') {
          clipDur = Number(animCtrl.setDeadState(true, safeSpeed)) || 0;
        } else if (animCtrl.triggerDeath?.(safeSpeed)) {
          clipDur = Number(animCtrl.getDeathClipDuration?.(safeSpeed)) || 1.73;
        }
      }
      if (clipDur > 0) {
        proceduralDeathFall = false;
        deathFallProgress = 0;
        if (modelInstance) {
          modelInstance.rotation.x = 0;
          modelInstance.position.y = 0;
          modelInstance.position.z = 0;
        }
        lastDeathDuration = clipDur;
      } else {
        proceduralDeathFall = true;
        deathFallProgress = 0;
        lastDeathDuration = 1.4;
      }
      return lastDeathDuration;
    }

    // Revive / reset back to clean Idle & normal controls
    if (!isDeadState && !animCtrl?.isDeadState?.()) {
      return 0;
    }
    cancelFlaskDrinkAnim();
    isDoorPushing = false;
    animCtrl?.setDoorPushState?.(false, 0);
    isDeadState = false;
    proceduralDeathFall = false;
    deathFallProgress = 0;
    lastDeathDuration = 0;
    isWarriorBlocking = false;
    isReloadingState = false;
    dashAnimTimer = 0;
    warriorAttackTimer = 0;
    gunKickTimer = 0;
    warriorSprintBlend = 0;
    flashTimer = 0;
    if (heroContactShadow) {
      heroContactShadow.visible = true;
      heroContactShadow.userData?.setShadowOpacity?.(heroContactShadow.userData?.baseOpacity ?? 0.56);
    }
    pendingFootstepEvent = null;
    prevLocomotionClip = null;
    prevLocomotionPhase = null;

    if (modelInstance) {
      modelInstance.rotation.x = 0;
      modelInstance.position.y = 0;
      modelInstance.position.z = 0;
    }
    if (animCtrl) {
      if (typeof animCtrl.setDeadState === 'function') {
        animCtrl.setDeadState(false);
      } else {
        animCtrl.resetAlive?.();
      }
    }
    if (warriorStanceRig?.state) {
      warriorStanceRig.state.blend = 1;
    }
    if (assetKey === 'warrior_run' && (isCurrentWeaponTwoHanded || currentWeaponId === 'great_club')) {
      applyWarriorWeaponAnimOverlay(0.016, false, 0, 0);
    } else if (isTripoGunslinger && !hasBakedGunslingerClips) {
      positionTripoGunPivot(0, 0, 0, 0, isBeast ? 1.78 : 1);
      applyTripoGunslingerPose(0, 0, 0);
    }
    setBeastMode(isBeast);
    return 0;
  }

  function playDeathAnim(speed = 1.25) {
    return setDeadState(true, speed);
  }

  function resetDeath() {
    return setDeadState(false);
  }

  function isDead() {
    return Boolean(isDeadState || animCtrl?.isDeadState?.());
  }

  function flashHit() {
    if (isDeadState) return;
    flashTimer = 0.12;
    for (const item of instanceMats) {
      if (item.mat.emissive && !item.hasEyeMap && item.baseEmissiveInt < 2.0) {
        item.mat.emissive.setHex(0xff3b30);
        item.mat.emissiveIntensity = 0.85;
      }
    }
  }

  function addShieldScrapeDecal(opts = null) {
    if (isDisposed || safeClass !== 'warrior') return false;
    const activeShield = mountedShieldObj || legacyWarriorShieldObj;
    if (!activeShield || isCurrentWeaponTwoHanded) return false;

    if (!shieldDecalRoot) {
      shieldDecalRoot = new THREE.Group();
      shieldDecalRoot.name = 'HeroShield_WoodGougeDecals';
    }
    if (shieldDecalRoot.parent !== activeShield) {
      activeShield.add(shieldDecalRoot);
    }

    const surf = ensureShieldOuterSurfaceCache(activeShield);
    const isBoss = Boolean(opts?.isBoss);
    const isHeavy = Boolean(opts?.isHeavy || isBoss);

    let slot = shieldDecalSlots[shieldDecalCursor] || null;
    if (!slot) {
      const mat = new THREE.MeshStandardMaterial({
        map: getShieldWoodGougeTexture(),
        color: 0xffffff,
        roughness: 0.86,
        metalness: 0.04,
        transparent: true,
        opacity: 0.96,
        alphaTest: 0.06,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3
      });
      const mesh = new THREE.Mesh(getShieldWoodGougeGeometry(), mat);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = 2;
      mesh.userData.isShieldGougeDecal = true;
      shieldDecalRoot.add(mesh);
      slot = {
        mesh,
        mat,
        age: 0,
        fadeStart: 14.0,
        maxAge: 16.5,
        baseOpacity: 0.96,
        emberBoost: 0,
        active: false
      };
      shieldDecalSlots[shieldDecalCursor] = slot;
    }

    const slotIdx = shieldDecalCursor;
    shieldDecalCursor = (shieldDecalCursor + 1) % SHIELD_DECAL_POOL_MAX;

    // Distribute 6 pooled gouges across distinct zones of the shield's outer face
    const colIdx = slotIdx % 2;
    const rowIdx = Math.floor(slotIdx / 2); // 0, 1, 2
    const uNorm = (colIdx === 0 ? -0.17 : 0.17) + (Math.random() - 0.5) * 0.14;
    const vNorm = 0.28 + rowIdx * 0.21 + (Math.random() - 0.5) * 0.10;
    const cx = (surf.minX + surf.maxX) * 0.5 + uNorm * (surf.maxX - surf.minX);
    const cy = surf.minY + vNorm * (surf.maxY - surf.minY);
    const cz = sampleShieldOuterZ(surf, cx, cy) + 0.0045;

    // Local convex surface tangent tilt so the strip hugs curved shield planks cleanly
    const dxStep = 0.05;
    const dyStep = 0.05;
    const dzDx = (sampleShieldOuterZ(surf, cx + dxStep, cy) - sampleShieldOuterZ(surf, cx - dxStep, cy)) / (2 * dxStep);
    const dzDy = (sampleShieldOuterZ(surf, cx, cy + dyStep) - sampleShieldOuterZ(surf, cx, cy - dyStep)) / (2 * dyStep);
    const slashSign = slotIdx % 2 === 0 ? 1 : -1;
    const slashRoll = slashSign * (0.34 + Math.random() * 0.44);

    const lenScale = isBoss ? 1.34 : isHeavy ? 1.16 : 0.94;
    const widScale = isBoss ? 1.26 : isHeavy ? 1.10 : 0.92;
    // Normalize strip size against shield local span (~0.98 for Shield_Custom vs ~0.68 for legacy shield)
    const shieldSpan = Math.max(0.45, surf.maxY - surf.minY);
    const unitScale = shieldSpan * 1.02;

    slot.mesh.position.set(cx, cy, cz);
    slot.mesh.rotation.set(
      Math.max(-0.42, Math.min(0.42, -dzDy * 0.85)),
      Math.max(-0.48, Math.min(0.48, dzDx * 0.85)),
      slashRoll
    );
    slot.mesh.scale.set(unitScale * lenScale, unitScale * widScale, 1.0);

    slot.age = 0;
    slot.fadeStart = 14.0;
    slot.maxAge = 16.5;
    slot.baseOpacity = isBoss ? 0.98 : 0.94;
    slot.emberBoost = isBoss ? 0.38 : 0;
    slot.mat.color.setHex(isBoss ? 0xffe4c4 : 0xf5dfc0);
    if (slot.mat.emissive) {
      slot.mat.emissive.setHex(isBoss ? 0x9a3412 : 0x000000);
      slot.mat.emissiveIntensity = slot.emberBoost;
    }
    slot.mat.opacity = slot.baseOpacity;
    slot.mesh.visible = true;
    slot.active = true;
    return true;
  }

  function updateShieldScrapeDecals(safeDt) {
    if (shieldDecalSlots.length === 0) return;
    const activeShield = mountedShieldObj || legacyWarriorShieldObj;
    if (shieldDecalRoot && activeShield && !isCurrentWeaponTwoHanded && shieldDecalRoot.parent !== activeShield && !shieldStowedToModelSpace) {
      activeShield.add(shieldDecalRoot);
    }
    for (let i = 0; i < shieldDecalSlots.length; i++) {
      const slot = shieldDecalSlots[i];
      if (!slot || !slot.active) continue;
      slot.age += safeDt;
      if (slot.emberBoost > 0 && slot.mat.emissive) {
        const cool = Math.max(0, 1 - slot.age / 1.6);
        slot.mat.emissiveIntensity = slot.emberBoost * cool * cool;
      }
      if (slot.age >= slot.maxAge) {
        slot.active = false;
        slot.mesh.visible = false;
        slot.mat.opacity = 0;
      } else if (slot.age > slot.fadeStart) {
        const uFade = (slot.age - slot.fadeStart) / Math.max(0.1, slot.maxAge - slot.fadeStart);
        const sFade = uFade * uFade * (3 - 2 * uFade);
        slot.mat.opacity = slot.baseOpacity * (1 - sFade);
      }
    }
  }

  const _wEuler = new THREE.Euler(0, 0, 0, 'XYZ');
  const _wQuat = new THREE.Quaternion();
  const _strideMeanInv = new THREE.Quaternion();
  const _strideDelta = new THREE.Quaternion();
  const _strideAxis = new THREE.Vector3();
  const _strideBoostQ = new THREE.Quaternion();
  let warriorSprintBlend = 0;

  function applyWarriorWeaponAnimOverlay(safeDt, isMoving, elapsedTime, speedRatio = 1) {
    if (safeClass !== 'warrior' || !modelInstance) return;
    if (warriorAttackTimer > 0) {
      warriorAttackTimer = Math.max(0, warriorAttackTimer - safeDt);
    }
    const isSpear = currentWeaponStyle === 'spear';
    const isAxe = currentWeaponStyle === 'axe';
    const isHammer = currentWeaponStyle === 'hammer';
    const isZwei = currentWeaponStyle === 'zweihander';
    const isGreatClub = currentWeaponId === 'great_club';
    const isTwoHand = isCurrentWeaponTwoHanded || isSpear || isZwei || isAxe || isHammer;
    const hasCustomStance = isTwoHand || isGreatClub;

    restoreWeaponToRightHand();

    // Warrior_Run.glb:
    //  - 1H Sword + Shield ('club', 'blade', 'claymore'): 100% pure golden Mixamo clips!
    //  - 1H Great Club + Shield ('great_club') & 2H weapons (Axe, Hammer, Zweihander, Spear):
    //    dedicated Blender-verified stance solver (warriorStances.js) with smooth fade-out during active swings/block/death!
    if (assetKey === 'warrior_run') {
      if (!hasCustomStance) {
        return;
      }
      const isDead = Boolean(animCtrl?.isDeadState?.());
      const isHitReacting = Boolean(animCtrl?.isHitActive?.());
      const isRolling = Boolean(animCtrl?.isRollActive?.());
      const isDrinking = flaskDrinkAnimTimer > 0;
      const isDoorPush = isDoorPushActive();
      const isAttacking = warriorAttackTimer > 0 || Boolean(animCtrl?.isOneShotActive?.());
      warriorStanceRig.modelInstance = modelInstance;
      warriorStanceRig.mountedWeaponObj = mountedWeaponObj;
      warriorStanceRig.leftGripSocket = warriorLeftGripSocket;

      const stanceBlend = applyWarriorWeaponStance(warriorStanceRig, currentWeaponId, safeDt, {
        isAttacking: isAttacking || isHitReacting || isRolling || isDrinking || isDoorPush,
        isBlocking: isWarriorBlocking,
        isHub: !isMoving && !isAttacking && !isHitReacting && !isRolling && !isWarriorBlocking && !isDrinking && !isDoorPush,
        moveSpeed: isMoving ? (speedRatio || 1) : 0,
        isMoving,
        elapsedTime,
        isDead
      });

      if (!isDead && warriorAttackTimer > 0 && warriorAttackDur > 0) {
        const u = Math.max(0, Math.min(1, 1 - warriorAttackTimer / warriorAttackDur));
        applyWarriorAttackOverlay(warriorStanceRig, currentWeaponId, u, stanceBlend);
      }

      modelInstance.position.z = 0;
      return;
    }

    const wChest = chestBone || mx.Spine2?.node || mx.Spine1?.node;
    const wUpperR = upperArmR || mx.RightArm?.node;
    const wLowerR = lowerArmR || mx.RightForeArm?.node;
    const wUpperL = upperArmL || mx.LeftArm?.node;
    const wLowerL = lowerArmL || mx.LeftForeArm?.node;

    let lungeZ = 0;

    // Legacy KayKit fallback Two-Handed Carry & Guard Stance (when warrior_run is unavailable)
    if (isTwoHand) {
      const sway = isMoving ? Math.sin(elapsedTime * 9.5) * 0.065 : Math.sin(elapsedTime * 2.2) * 0.022;
      if (warriorAttackTimer <= 0) {
        if (isSpear) {
          if (wChest) {
            _wEuler.set(0.05, -0.14, 0);
            _wQuat.setFromEuler(_wEuler);
            wChest.quaternion.multiply(_wQuat);
          }
          if (wUpperR) {
            _wEuler.set(-0.24 + sway * 0.5, -0.18, 0.22);
            _wQuat.setFromEuler(_wEuler);
            wUpperR.quaternion.multiply(_wQuat);
          }
          if (wLowerR) {
            _wEuler.set(0.10, -0.14, -0.22);
            _wQuat.setFromEuler(_wEuler);
            wLowerR.quaternion.multiply(_wQuat);
          }
        } else {
          const heavyLift = isZwei ? -0.18 : 0.10;
          if (wChest) {
            _wEuler.set(0.04, 0.10, 0);
            _wQuat.setFromEuler(_wEuler);
            wChest.quaternion.multiply(_wQuat);
          }
          if (wUpperR) {
            _wEuler.set(heavyLift + sway, 0.16, 0.18);
            _wQuat.setFromEuler(_wEuler);
            wUpperR.quaternion.multiply(_wQuat);
          }
          if (wLowerR) {
            _wEuler.set(0.14, 0.12, -0.16);
            _wQuat.setFromEuler(_wEuler);
            wLowerR.quaternion.multiply(_wQuat);
          }
        }
      }
    }

    // Legacy KayKit fallback attack trajectories
    if (warriorAttackTimer > 0 && warriorAttackDur > 0) {
      const u = Math.max(0, Math.min(1, 1 - warriorAttackTimer / warriorAttackDur));
      if (isSpear) {
        const wind = u < 0.22 ? Math.sin((u / 0.22) * Math.PI * 0.5) : Math.max(0, 1 - (u - 0.22) / 0.14);
        const thrust =
          u < 0.20
            ? 0
            : u < 0.54
              ? Math.sin(((u - 0.20) / 0.34) * Math.PI * 0.5)
              : Math.max(0, 1 - (u - 0.54) / 0.46);
        lungeZ = thrust * 0.26 - wind * 0.08;
        if (wChest) {
          _wEuler.set(thrust * 0.22 - wind * 0.08, -thrust * 0.34 + wind * 0.18, 0);
          _wQuat.setFromEuler(_wEuler);
          wChest.quaternion.multiply(_wQuat);
        }
        if (wUpperR) {
          _wEuler.set(-thrust * 0.68 + wind * 0.26, -thrust * 0.42 + wind * 0.20, 0.46 * thrust);
          _wQuat.setFromEuler(_wEuler);
          wUpperR.quaternion.multiply(_wQuat);
        }
        if (wLowerR) {
          _wEuler.set(0.10 * wind, -0.30 * thrust, -0.42 * thrust + 0.28 * wind);
          _wQuat.setFromEuler(_wEuler);
          wLowerR.quaternion.multiply(_wQuat);
        }
        if (mountedWeaponObj?.userData?.basePos) {
          mountedWeaponObj.translateY(-(thrust * 0.20 - wind * 0.09));
          _wEuler.set(0.18 * thrust, 0, -0.14 * thrust);
          _wQuat.setFromEuler(_wEuler);
          mountedWeaponObj.quaternion.multiply(_wQuat);
        }
      } else if (isZwei || isAxe || isHammer) {
        const wind = u < 0.28 ? Math.sin((u / 0.28) * Math.PI * 0.5) : 0;
        const swing =
          u < 0.28
            ? 0
            : u < 0.74
              ? Math.sin(((u - 0.28) / 0.46) * Math.PI * 0.5)
              : 1;
        const release = u > 0.74 ? Math.max(0, 1 - (u - 0.74) / 0.26) : 1;
        const heaviness = isHammer ? 1.28 : isAxe ? 1.18 : 1.12;
        const yawTwist = (0.48 * wind - 0.62 * swing) * release;
        const pitchSwing = (-0.64 * wind + (isZwei ? 0.72 : 1.05) * swing) * heaviness * release;
        const rollArc = (0.36 * wind - (isAxe ? 0.78 : 0.62) * swing) * release;
        if (wChest) {
          _wEuler.set((0.26 * swing - 0.14 * wind) * release, yawTwist * 0.85, rollArc * 0.30);
          _wQuat.setFromEuler(_wEuler);
          wChest.quaternion.multiply(_wQuat);
        }
        if (wUpperR) {
          _wEuler.set(pitchSwing, yawTwist * 0.55, rollArc);
          _wQuat.setFromEuler(_wEuler);
          wUpperR.quaternion.multiply(_wQuat);
        }
        if (wLowerR) {
          _wEuler.set(0.24 * swing * release, -0.16 * swing * release, (-0.30 * wind + 0.26 * swing) * release);
          _wQuat.setFromEuler(_wEuler);
          wLowerR.quaternion.multiply(_wQuat);
        }
        if (mountedWeaponObj?.userData?.baseQuat) {
          _wEuler.set(-0.22 * wind * release + 0.18 * swing * release, 0, rollArc * 0.25);
          _wQuat.setFromEuler(_wEuler);
          mountedWeaponObj.quaternion.multiply(_wQuat);
        }
      } else {
        const wind = u < 0.28 ? u / 0.28 : 0;
        const chop = u >= 0.28 ? Math.sin(Math.min(1, (u - 0.28) / 0.52) * Math.PI * 0.5) : 0;
        const release = u > 0.80 ? 1 - (u - 0.80) / 0.20 : 1;
        const pitchDelta = (-0.82 * wind + 1.15 * chop) * release;
        const rollDelta = (0.35 * wind - 0.62 * chop) * release;
        if (wChest) {
          _wEuler.set(0.28 * chop * release - 0.14 * wind, -0.22 * chop * release, rollDelta * 0.35);
          _wQuat.setFromEuler(_wEuler);
          wChest.quaternion.multiply(_wQuat);
        }
        if (wUpperR) {
          _wEuler.set(pitchDelta, -0.25 * chop * release, rollDelta);
          _wQuat.setFromEuler(_wEuler);
          wUpperR.quaternion.multiply(_wQuat);
        }
        if (wLowerR) {
          _wEuler.set(0.25 * chop * release, 0, -0.32 * wind + 0.24 * chop * release);
          _wQuat.setFromEuler(_wEuler);
          wLowerR.quaternion.multiply(_wQuat);
        }
      }
    }

    // Legacy KayKit fallback Two-Handed Left-Arm pose
    if (isTwoHand) {
      const sway = isMoving ? Math.sin(elapsedTime * 9.5) * 0.07 : Math.sin(elapsedTime * 2.2) * 0.025;
      if (wUpperL) {
        _wEuler.set(0.28 + sway, 0.24, -0.42);
        _wQuat.setFromEuler(_wEuler);
        wUpperL.quaternion.multiply(_wQuat);
      }
      if (wLowerL) {
        _wEuler.set(-0.36, 0.34, 0.22);
        _wQuat.setFromEuler(_wEuler);
        wLowerL.quaternion.multiply(_wQuat);
      }
    }

    modelInstance.position.z = isTripoWarrior ? 0 : lungeZ;
  }

  // Dark Souls / Elden Ring Estus Flask Drinking Overlay (runs AFTER mixer.update so Hero can slow-walk while drinking!):
  //  - Shield on LeftHand smoothly swings around left shoulder onto Spine2 back-sling (u: 0..0.15 stow, 0.82..1.00 return)
  //  - RightArm + Sword gently lowers to relaxed right-hip hold (blade pointed down-and-back, NEVER near visor/mouth!)
  //  - LeftArm lifts glowing Golden Estus Flask straight to helmet visor (u: 0..0.28), tilts to pour (0.28..0.72)
  //    with Head tilt-back (-0.22 rad) & golden emissive surge, then lowers cleanly and stows flask (0.72..1.0)!
  function applyWarriorFlaskDrinkOverlay(safeDt, _isMoving, elapsedTime, timerAlreadyStepped = false) {
    if (flaskDrinkAnimTimer <= 0) {
      if (estusFlaskMesh?.visible || shieldStowedToModelSpace || flaskBonesDirty) {
        cancelFlaskDrinkAnim();
      }
      return;
    }
    if (isDeadState || animCtrl?.isRollActive?.() || animCtrl?.isHitActive?.()) {
      cancelFlaskDrinkAnim();
      return;
    }

    if (!timerAlreadyStepped) {
      flaskDrinkAnimTimer = Math.max(0, flaskDrinkAnimTimer - safeDt);
      if (flaskDrinkAnimTimer <= 0) {
        cancelFlaskDrinkAnim();
        return;
      }
    }
    if (safeClass !== 'warrior' || !modelInstance) {
      return;
    }
    flaskBonesDirty = true;

    const u = Math.max(0, Math.min(1, 1 - flaskDrinkAnimTimer / Math.max(0.05, flaskDrinkAnimDur)));
    const stowT = smoothstep01(0.00, 0.15, u) * (1 - smoothstep01(0.82, 1.00, u));
    const armBlend = smoothstep01(0.00, 0.18, u) * (1 - smoothstep01(0.76, 1.00, u));
    const leftBlend = smoothstep01(0.00, 0.16, u) * (1 - smoothstep01(0.80, 1.00, u));
    const liftT = smoothstep01(0.02, 0.28, u) * (1 - smoothstep01(0.72, 0.96, u));
    const pourT = smoothstep01(0.28, 0.42, u) * (1 - smoothstep01(0.62, 0.74, u));
    const flaskScaleT = smoothstep01(0.00, 0.10, u) * (1 - smoothstep01(0.88, 1.00, u));

    const activeShield = mountedShieldObj || legacyWarriorShieldObj;

    // 1. Update Golden Estus Flask visibility, smooth scale & amber glow surge during pour
    if (estusFlaskMesh) {
      estusFlaskMesh.visible = flaskScaleT > 0.005;
      const baseSc = estusFlaskMesh.userData?.baseScale ?? 1.0;
      estusFlaskMesh.scale.setScalar(baseSc * (0.28 + 0.72 * flaskScaleT));
      const { glassMat, coreMat, haloMat, haloMesh } = estusFlaskMesh.userData || {};
      const flicker = Math.sin(elapsedTime * 18.0) * 0.22 * pourT;
      if (coreMat) {
        coreMat.emissiveIntensity = 2.1 + pourT * 2.8 + flicker;
      }
      if (glassMat) {
        glassMat.emissiveIntensity = 0.75 + pourT * 1.15 + flicker * 0.4;
      }
      if (haloMat) {
        haloMat.opacity = 0.15 + pourT * 0.24 + Math.sin(elapsedTime * 14.0) * 0.04 * pourT;
      }
      if (haloMesh) {
        haloMesh.scale.setScalar(1.0 + pourT * 0.28 + Math.sin(elapsedTime * 14.0) * 0.06 * pourT);
      }
    }

    // 2. Full Mixamo 2-Bone IK + Spine2 back-shield sling for Warrior_Run.glb
    if (assetKey === 'warrior_run' && mx.Spine2?.node && mx.LeftArm?.node && mx.LeftForeArm?.node && mx.LeftHand?.node) {
      modelInstance.updateWorldMatrix(true, true);
      _fModelMatInv.copy(modelInstance.matrixWorld).invert();
      modelInstance.getWorldQuaternion(_fModelQ);
      _fModelQInv.copy(_fModelQ).invert();

      // Capture the shield's pre-IK LeftHand pose BEFORE raising LeftArm so the shield detaches cleanly
      // from resting hip/forearm level and sweeps outward around the left shoulder onto Spine2 (0 helmet clipping!).
      let hasHandShieldPose = false;
      if (activeShield && handL && activeShield.userData?.basePos && activeShield.userData?.baseQuat && activeShield.userData?.baseScale) {
        _fShieldTmpM4.compose(
          activeShield.userData.basePos,
          activeShield.userData.baseQuat,
          activeShield.userData.baseScale
        );
        _fShieldTmpM4.premultiply(handL.matrixWorld).premultiply(_fModelMatInv);
        _fShieldTmpM4.decompose(_fShieldHandPosM, _fShieldHandQuatM, _fShieldTmpS);
        hasHandShieldPose = true;
      }

      // A) Torso: gently square upper chest forward (+0.08 rad yaw) + slight chest-up pour lean
      mx.Spine2.node.getWorldQuaternion(_fBoneModelQ).premultiply(_fModelQInv);
      _fFwd.copy(_FLASK_UNIT_X).applyQuaternion(_fBoneModelQ);
      const curTorsoYaw = Math.atan2(_fFwd.x, _fFwd.z);
      const torsoYawDelta = normalizeFlaskAngle(0.08 - curTorsoYaw);
      if (mx.Spine1?.node) {
        rotateFlaskBoneModelAxis(mx.Spine1.node, _FLASK_UNIT_Y, torsoYawDelta * 0.38, armBlend * 0.85);
      }
      rotateFlaskBoneModelAxis(mx.Spine2.node, _FLASK_UNIT_Y, torsoYawDelta * 0.62, armBlend * 0.85);
      if (pourT > 0.001) {
        rotateFlaskBoneModelAxis(mx.Spine2.node, _FLASK_UNIT_X, -0.055 * pourT, 1.0);
      }

      // B) Neck & Head: face straight forward and smoothly tilt horned helmet BACK (-0.22 rad) while pouring!
      if (mx.Head?.node) {
        mx.Head.node.getWorldQuaternion(_fBoneModelQ).premultiply(_fModelQInv);
        _fFwd.copy(_FLASK_UNIT_X).applyQuaternion(_fBoneModelQ);
        const headYawFix = normalizeFlaskAngle(-Math.atan2(_fFwd.x, _fFwd.z)) * 0.92;
        if (mx.Neck?.node) {
          rotateFlaskBoneModelAxis(mx.Neck.node, _FLASK_UNIT_Y, headYawFix * 0.42, armBlend);
        }
        rotateFlaskBoneModelAxis(mx.Head.node, _FLASK_UNIT_Y, headYawFix * 0.58, armBlend);
        if (pourT > 0.001) {
          if (mx.Neck?.node) {
            rotateFlaskBoneModelAxis(mx.Neck.node, _FLASK_UNIT_X, -0.08 * pourT, 1.0);
          }
          rotateFlaskBoneModelAxis(mx.Head.node, _FLASK_UNIT_X, -0.17 * pourT, 1.0);
        }
      }

      // C) Clavicles: soften right shoulder down, protract left shoulder gently up-forward for visor reach
      if (mx.RightShoulder) {
        setFlaskClavicleModelRot(mx.RightShoulder, 0.06, -0.06, armBlend);
      }
      if (mx.LeftShoulder) {
        setFlaskClavicleModelRot(mx.LeftShoulder, -0.22 * liftT, 0.07 * liftT, leftBlend);
      }

      // Refresh live Spine2 & Head positions in modelInstance space after torso/head adjustments
      mx.Spine2.node.getWorldPosition(_fSpineM).applyMatrix4(_fModelMatInv);
      if (mx.Head?.node) {
        mx.Head.node.getWorldPosition(_fHeadM).applyMatrix4(_fModelMatInv);
      } else {
        _fHeadM.set(_fSpineM.x, _fSpineM.y + 0.095, _fSpineM.z + 0.025);
      }

      // D) Right Arm + Sword: relaxed low grip at right hip (blade directed down-outward-back, 0 face/floor clip!)
      if (mx.RightArm?.node && mx.RightForeArm?.node && mx.RightHand?.node && armBlend > 0.002) {
        _fTargetRM.set(_fSpineM.x - 0.175, _fSpineM.y - 0.090, _fSpineM.z - 0.015);
        _fPoleRM.set(_fSpineM.x - 0.340, _fSpineM.y - 0.050, _fSpineM.z - 0.160);
        _fTargetRW.copy(_fTargetRM).applyMatrix4(modelInstance.matrixWorld);
        _fPoleRW.copy(_fPoleRM).applyMatrix4(modelInstance.matrixWorld);
        solveMixamoArmIK(mx.RightArm, mx.RightForeArm, mx.RightHand, _fTargetRW, _fPoleRW, armBlend);
        const lowerHandRQ = !isCurrentWeaponTwoHanded
          ? _FLASK_SWORD_LOWER_HAND_R_MODEL_Q
          : currentWeaponStyle === 'zweihander'
            ? _FLASK_ZWEI_LOWER_HAND_R_MODEL_Q
            : _FLASK_2H_LOWER_HAND_R_MODEL_Q;
        setFlaskBoneModelQuat(mx.RightHand.node, lowerHandRQ, armBlend);
      }

      // E) Left Arm + Glowing Golden Estus Flask: smooth lift from left hip -> jaw/visor -> pour tilt -> lower
      if (leftBlend > 0.002) {
        _fLowLM.set(_fSpineM.x + 0.165, _fSpineM.y - 0.075, _fSpineM.z + 0.105);
        _fHighLM.set(
          _fHeadM.x + 0.068,
          _fHeadM.y - 0.032 + 0.010 * pourT,
          _fHeadM.z + 0.145 - 0.012 * pourT
        );
        _fTargetLM.lerpVectors(_fLowLM, _fHighLM, liftT);
        _fTargetLM.x += 0.032 * Math.sin(Math.PI * liftT);

        _fPoleLM.set(
          _fSpineM.x + 0.35 + 0.04 * pourT,
          _fSpineM.y - 0.09 + 0.12 * liftT + 0.05 * pourT,
          _fSpineM.z - 0.02 + 0.09 * liftT
        );
        _fTargetLW.copy(_fTargetLM).applyMatrix4(modelInstance.matrixWorld);
        _fPoleLW.copy(_fPoleLM).applyMatrix4(modelInstance.matrixWorld);
        solveMixamoArmIK(mx.LeftArm, mx.LeftForeArm, mx.LeftHand, _fTargetLW, _fPoleLW, leftBlend);

        // Align LeftHand so bottle neck (+X_LeftHand) holds upright on lift and pours cleanly into visor during pourT!
        mx.LeftForeArm.node.getWorldPosition(_fElbLM).applyMatrix4(_fModelMatInv);
        mx.LeftHand.node.getWorldPosition(_fHandLM).applyMatrix4(_fModelMatInv);
        _fForeY.subVectors(_fHandLM, _fElbLM);
        if (_fForeY.lengthSq() > 1e-6) {
          _fForeY.normalize();
          _fFlaskAxisX.copy(_FLASK_UPRIGHT_AXIS_M).lerp(_FLASK_POUR_AXIS_M, pourT).normalize();
          _fForeY.addScaledVector(_fFlaskAxisX, -_fForeY.dot(_fFlaskAxisX));
          if (_fForeY.lengthSq() < 1e-5) {
            _fForeY.set(-0.7, 0.0, 0.7).addScaledVector(_fFlaskAxisX, -(-0.7 * _fFlaskAxisX.x + 0.7 * _fFlaskAxisX.z));
          }
          _fForeY.normalize();
          _fHandZ.crossVectors(_fFlaskAxisX, _fForeY).normalize();
          _fForeY.crossVectors(_fHandZ, _fFlaskAxisX).normalize();
          _fBasisM4.makeBasis(_fFlaskAxisX, _fForeY, _fHandZ);
          _fHandLModelQ.setFromRotationMatrix(_fBasisM4).normalize();
          setFlaskBoneModelQuat(mx.LeftHand.node, _fHandLModelQ, leftBlend);
        }
      }

      // F) Shield smoothly slung behind left shoulder onto Spine2 back anchor (u: 0..0.15 stow, 0.82..1.00 return)
      if (activeShield && warriorShieldBackAnchor && hasHandShieldPose) {
        if (activeShield.parent !== modelInstance) {
          modelInstance.add(activeShield);
          shieldStowedToModelSpace = true;
        }
        mx.Spine2.node.updateMatrixWorld(true);
        _fShieldTmpM4.copy(warriorShieldBackAnchor.matrixWorld).premultiply(_fModelMatInv);
        _fShieldTmpM4.decompose(_fShieldBackPosM, _fShieldBackQuatM, _fShieldTmpS);

        activeShield.position.lerpVectors(_fShieldHandPosM, _fShieldBackPosM, stowT);
        const arc = Math.sin(Math.PI * stowT);
        activeShield.position.x += 0.14 * arc;
        activeShield.position.z -= 0.04 * arc;
        activeShield.quaternion.copy(_fShieldHandQuatM).slerp(_fShieldBackQuatM, stowT).normalize();
        if (activeShield.userData?.baseScale) {
          activeShield.scale.copy(activeShield.userData.baseScale);
        }
      }
      return;
    }

    // 3. Legacy KayKit fallback Warrior drinking pose (when Warrior_Run.glb is unavailable)
    if (upperArmR) {
      _wEuler.set(0.32 * armBlend, 0.10 * armBlend, 0.28 * armBlend);
      _wQuat.setFromEuler(_wEuler);
      upperArmR.quaternion.multiply(_wQuat);
    }
    if (lowerArmR) {
      _wEuler.set(-0.22 * armBlend, 0, -0.12 * armBlend);
      _wQuat.setFromEuler(_wEuler);
      lowerArmR.quaternion.multiply(_wQuat);
    }
    if (upperArmL) {
      _wEuler.set((-1.05 * liftT - 0.18 * pourT) * leftBlend, -0.42 * liftT * leftBlend, -0.35 * liftT * leftBlend);
      _wQuat.setFromEuler(_wEuler);
      upperArmL.quaternion.multiply(_wQuat);
    }
    if (lowerArmL) {
      _wEuler.set((-0.85 * liftT - 0.35 * pourT) * leftBlend, 0.25 * liftT * leftBlend, 0.22 * pourT * leftBlend);
      _wQuat.setFromEuler(_wEuler);
      lowerArmL.quaternion.multiply(_wQuat);
    }
    if (headBone && pourT > 0.001) {
      _wEuler.set(-0.22 * pourT, 0, 0);
      _wQuat.setFromEuler(_wEuler);
      headBone.quaternion.multiply(_wQuat);
    }
    if (activeShield && warriorShieldBackAnchor && handL && activeShield.userData?.basePos) {
      modelInstance.updateWorldMatrix(true, true);
      _fModelMatInv.copy(modelInstance.matrixWorld).invert();
      _fShieldTmpM4.compose(
        activeShield.userData.basePos,
        activeShield.userData.baseQuat,
        activeShield.userData.baseScale
      );
      _fShieldTmpM4.premultiply(handL.matrixWorld).premultiply(_fModelMatInv);
      _fShieldTmpM4.decompose(_fShieldHandPosM, _fShieldHandQuatM, _fShieldTmpS);
      _fShieldTmpM4.copy(warriorShieldBackAnchor.matrixWorld).premultiply(_fModelMatInv);
      _fShieldTmpM4.decompose(_fShieldBackPosM, _fShieldBackQuatM, _fShieldTmpS);
      if (activeShield.parent !== modelInstance) {
        modelInstance.add(activeShield);
        shieldStowedToModelSpace = true;
      }
      activeShield.position.lerpVectors(_fShieldHandPosM, _fShieldBackPosM, stowT);
      activeShield.position.x += 0.22 * Math.sin(Math.PI * stowT);
      activeShield.quaternion.copy(_fShieldHandQuatM).slerp(_fShieldBackQuatM, stowT).normalize();
      activeShield.scale.copy(activeShield.userData.baseScale);
    }
  }

  function applyGunslingerWeaponAnimOverlay(safeDt, isMoving, elapsedTime) {
    if (safeClass !== 'gunslinger' || !hasBakedGunslingerClips || !modelInstance) return;
    if (gunKickTimer > 0) {
      gunKickTimer = Math.max(0, gunKickTimer - safeDt);
    }
    const wId = currentWeaponId || 'usp_pistol';
    const isOneHandPistol = wId === 'usp_pistol' || wId === 'colt';

    if (embeddedPistolNode) {
      // Smoothly transition between Shooting Style A (shots 1..5: extended sighted 1H)
      // and Shooting Style B (shots 6..10: canted C.A.R. close-quarters 1H) + crisp shot recoil!
      reloadBlend += ((isReloadingState ? 1 : 0) - reloadBlend) * Math.min(1, safeDt * 12);
      if (aimHoldTimer > 0) aimHoldTimer = Math.max(0, aimHoldTimer - safeDt);
      const targetStyleB = gunShotCounter > 0 && Math.floor((gunShotCounter - 1) / 5) % 2 === 1 ? 1 : 0;
      gunStyleBlend += (targetStyleB - gunStyleBlend) * Math.min(1, safeDt * 7.5);

      const kick = gunKickTimer > 0 ? Math.sin((gunKickTimer / 0.22) * Math.PI) : 0;
      const recoilPitch = wId === 'colt' ? 0.30 : wId === 'ak47' ? 0.16 : wId === 'smg' ? 0.10 : 0.20;
      const sb = gunStyleBlend;

      if (sb > 0.01 && isMoving) {
        // Apply Style B upper-body canted C.A.R. arm posture while moving so both styles are clearly distinct on the move too!
        if (mx.Spine2?.node) {
          _wEuler.set(0.06 * sb, -0.18 * sb, 0);
          _wQuat.setFromEuler(_wEuler);
          mx.Spine2.node.quaternion.multiply(_wQuat);
        }
        if (mx.RightArm?.node) {
          _wEuler.set(0.18 * sb, 0.22 * sb, -0.14 * sb);
          _wQuat.setFromEuler(_wEuler);
          mx.RightArm.node.quaternion.multiply(_wQuat);
        }
        if (mx.RightForeArm?.node) {
          _wEuler.set(-0.28 * sb, 0.24 * sb, 0.32 * sb);
          _wQuat.setFromEuler(_wEuler);
          mx.RightForeArm.node.quaternion.multiply(_wQuat);
        }
        if (mx.LeftForeArm?.node) {
          _wEuler.set(-0.35 * sb, 0.20 * sb, -0.25 * sb);
          _wQuat.setFromEuler(_wEuler);
          mx.LeftForeArm.node.quaternion.multiply(_wQuat);
        }
      }

      if (kick > 0.001 && mx.Spine2?.node) {
        _wEuler.set(-kick * recoilPitch * 0.24, -kick * 0.06 * sb, 0);
        _wQuat.setFromEuler(_wEuler);
        mx.Spine2.node.quaternion.multiply(_wQuat);
      }
      if (kick > 0.001 && mx.RightForeArm?.node) {
        _wEuler.set(-kick * recoilPitch * 0.55, 0, kick * 0.14 * sb);
        _wQuat.setFromEuler(_wEuler);
        mx.RightForeArm.node.quaternion.multiply(_wQuat);
      }
      if (reloadBlend > 0.02 && mx.RightForeArm?.node) {
        _wEuler.set(reloadBlend * 0.22, 0, -reloadBlend * 0.16);
        _wQuat.setFromEuler(_wEuler);
        mx.RightForeArm.node.quaternion.multiply(_wQuat);
      }
      const activeGunNode = mountedWeaponObj || embeddedPistolNode;
      if (activeGunNode?.userData?.basePos && activeGunNode?.userData?.baseQuat) {
        const kickBack = (wId === 'colt' ? 0.036 : wId === 'ak47' ? 0.026 : 0.020) / Math.max(0.5, heroBaseScale);
        activeGunNode.position.copy(activeGunNode.userData.basePos);
        activeGunNode.quaternion.copy(activeGunNode.userData.baseQuat);
        if (kick > 0.001 || sb > 0.01) {
          _wEuler.set(-kick * recoilPitch, 0, -0.42 * sb);
          _wQuat.setFromEuler(_wEuler);
          activeGunNode.quaternion.multiply(_wQuat);
          if (kick > 0.001) activeGunNode.translateZ(-kick * kickBack);
        }
      }
      return;
    }

    if (isOneHandPistol) {
      // Relax left arm out of the baked two-handed shotgun forend hold into a balanced 1-handed pistol stance!
      const walkSwing = isMoving ? Math.sin(elapsedTime * 11.2) * 0.24 : Math.sin(elapsedTime * 2.1) * 0.04;
      if (mx.LeftArm?.node) {
        _wEuler.set(0.55 + walkSwing, -0.22, -0.68);
        _wQuat.setFromEuler(_wEuler);
        mx.LeftArm.node.quaternion.multiply(_wQuat);
      }
      if (mx.LeftForeArm?.node) {
        _wEuler.set(-0.35, 0.20, 0.28);
        _wQuat.setFromEuler(_wEuler);
        mx.LeftForeArm.node.quaternion.multiply(_wQuat);
      }
      if (mx.RightArm?.node) {
        const kickLift = gunKickTimer > 0 ? Math.sin((gunKickTimer / 0.22) * Math.PI) * (wId === 'colt' ? 0.32 : 0.16) : 0;
        _wEuler.set(-0.14 - kickLift, 0.10, 0.08);
        _wQuat.setFromEuler(_wEuler);
        mx.RightArm.node.quaternion.multiply(_wQuat);
      }
    }

    if (mountedWeaponObj?.userData?.basePos && mountedWeaponObj?.userData?.baseQuat) {
      const kick = gunKickTimer > 0 ? Math.sin((gunKickTimer / 0.22) * Math.PI) : 0;
      const recoilStrength = wId === 'colt' ? 0.045 : wId === 'ak47' ? 0.032 : wId === 'smg' ? 0.020 : 0.025;
      mountedWeaponObj.position.copy(mountedWeaponObj.userData.basePos);
      mountedWeaponObj.position.z -= kick * recoilStrength;
      mountedWeaponObj.position.y += kick * recoilStrength * 0.45;
      _wEuler.set(-kick * (isOneHandPistol ? 0.22 : 0.08), 0, 0);
      _wQuat.setFromEuler(_wEuler);
      mountedWeaponObj.quaternion.copy(mountedWeaponObj.userData.baseQuat).multiply(_wQuat);
    }
  }

  const footPlantMap = HERO_FOOT_PLANT_PHASES[assetKey] || null;
  let prevLocomotionClip = null;
  let prevLocomotionPhase = null;
  let pendingFootstepEvent = null;

  function consumeFootstepEvent() {
    const ev = pendingFootstepEvent;
    pendingFootstepEvent = null;
    return ev;
  }

  function update(dt, isMoving = false, speedRatio = 1, elapsedTime = 0, moveLocalX = 0, moveLocalZ = 1, isSprinting = false) {
    const safeDt = Math.min(Math.max(dt || 0.016, 0), 0.1);
    syncSoulsRimLightFromBiome();
    updateShieldScrapeDecals(safeDt);

    // Dead state: advance Death_A to its clamped final frame (or procedural collapse fallback)
    // and never overwrite weights with Idle/Running/weapon stances until setDeadState(false).
    if (isDeadState) {
      pendingFootstepEvent = null;
      prevLocomotionClip = null;
      prevLocomotionPhase = null;
      beastRing.visible = false;
      if (animCtrl) {
        animCtrl.updateOneShotFade?.(safeDt);
        animCtrl.mixer.update(safeDt);
      }
      if (proceduralDeathFall && modelInstance) {
        deathFallProgress = Math.min(1, deathFallProgress + safeDt / 0.85);
        const t = deathFallProgress;
        const fall =
          t < 0.68
            ? (t / 0.68) * (t / 0.68) * 0.86
            : 0.86 + Math.sin(((t - 0.68) / 0.32) * Math.PI * 0.5) * 0.14;
        modelInstance.rotation.x = -Math.PI * 0.46 * fall;
        modelInstance.position.y = 0.12 * fall;
      }
      if (staffCastPulse > 0) {
        staffCastPulse = Math.max(0, staffCastPulse - safeDt * 5.2);
      }
      if (embeddedStaffVfx) {
        embeddedStaffVfx.updateVfx(elapsedTime, staffCastPulse);
      }
      if (flashTimer > 0) {
        flashTimer = Math.max(0, flashTimer - safeDt);
        if (flashTimer <= 0) setBeastMode(false);
      }
      return;
    }

    // Active normalized cutscene clip (Boss Escape Cutscene: Knockdown_Scoot / Dodge_Fall / River_Tumble / Shore_WakeUp):
    // Keep act.paused = true & time pinned strictly by setCutsceneClipNormalized(clip, u01) with zero Idle/Run overwrite!
    if (heroCutsceneAction && animCtrl) {
      pendingFootstepEvent = null;
      prevLocomotionClip = null;
      prevLocomotionPhase = null;
      advanceHeroCutsceneBlend(safeDt);
      heroCutsceneAction.enabled = true;
      heroCutsceneAction.paused = true;
      if (modelInstance) {
        modelInstance.rotation.x = 0;
        modelInstance.position.y = 0;
      }
      animCtrl.mixer.update(0);
      applyHeroDisarmVisibility();
      if (flashTimer > 0) {
        flashTimer = Math.max(0, flashTimer - safeDt);
        if (flashTimer <= 0) setBeastMode(isBeast);
      }
      return;
    }

    let activeRunClip = 'Running_A';
    const isTurning180 = Boolean(animCtrl?.isTurn180Active?.());
    const isRolling = Boolean(animCtrl?.isRollActive?.());
    if (animCtrl) {
      if (isMoving) {
        let runClip = isBeast && asset?.clips?.has('Running_B') ? 'Running_B' : 'Running_A';
        if (hasBakedGunslingerClips && !isBeast) {
          if (Math.abs(moveLocalX) > Math.abs(moveLocalZ) * 0.82) {
            const strafeClip = moveLocalX > 0 ? 'Strafe_Left' : 'Strafe_Right';
            if (asset?.clips?.has(strafeClip)) runClip = strafeClip;
          } else if (moveLocalZ < -0.35 && asset?.clips?.has('Running_Back')) {
            runClip = 'Running_Back';
          }
        } else if (isTripoWarrior && !isTurning180 && !isRolling) {
          if (!isSprinting && Math.abs(moveLocalX) > Math.abs(moveLocalZ) * 0.68) {
            const strafeClip = moveLocalX > 0 ? 'Strafe_Left' : 'Strafe_Right';
            if (asset?.clips?.has(strafeClip)) {
              runClip = strafeClip;
            }
          } else if (moveLocalZ < -0.35 && asset?.clips?.has('Running_Back')) {
            runClip = 'Running_Back';
          } else if (
            isSprinting &&
            moveLocalZ >= -0.15 &&
            !isWarriorBlocking &&
            flaskDrinkAnimTimer <= 0 &&
            asset?.clips?.has('Sprint_A')
          ) {
            runClip = 'Sprint_A';
          }
        }
        activeRunClip = runClip;
        let runScale;
        if (assetKey === 'warrior_run') {
          // Exact z76 heavy-armored knight cadence on Running_A (2.65x -> grounded footsteps, 0 ice-skating!),
          // grounded lock-on cross-step cadence on Strafe_Left/Strafe_Right (~1.15..1.65x),
          // + faster true forward sprint on Sprint_A (~3.25x)!
          const minRunSpd = flaskDrinkAnimTimer > 0 ? 0.72 : 1.22;
          const minBackSpd = flaskDrinkAnimTimer > 0 ? 0.75 : 1.15;
          const minStrafeSpd = flaskDrinkAnimTimer > 0 ? 0.78 : 1.15;
          const isStrafeClip = runClip === 'Strafe_Left' || runClip === 'Strafe_Right';
          runScale = isStrafeClip
            ? Math.max(minStrafeSpd, Math.min(1.65, speedRatio * 1.52))
            : runClip === 'Running_Back'
              ? Math.max(minBackSpd, Math.min(2.9, speedRatio * 2.55))
              : runClip === 'Sprint_A'
                ? Math.max(2.65, Math.min(3.50, speedRatio * 2.48))
                : Math.max(minRunSpd, Math.min(3.23, speedRatio * 2.65));
        } else {
          runScale = Math.max(0.95, Math.min(2.15, speedRatio * 1.32));
        }
        animCtrl.setBaseState(runClip, runScale);
      } else {
        animCtrl.setBaseState('Idle', 1.0);
      }
      animCtrl.updateOneShotFade?.(safeDt);
      animCtrl.mixer.update(safeDt);

      // Sync footstep audio strictly to exact visual boot-plant phase crossings of the active run clip.
      if (footPlantMap) {
        pendingFootstepEvent = null;
        if (isMoving && !isRolling) {
          const plantPhases = footPlantMap[activeRunClip];
          const lowerRunAct = plantPhases ? animCtrl.getAction?.(`${activeRunClip}__Lower`) : null;
          const fullRunAct = plantPhases ? animCtrl.getAction?.(activeRunClip) : null;
          const act =
            lowerRunAct && lowerRunAct.isRunning() && lowerRunAct.getEffectiveWeight() > 0.35
              ? lowerRunAct
              : fullRunAct && fullRunAct.isRunning()
                ? fullRunAct
                : null;
          const dur = act?.getClip?.()?.duration || 0;
          if (act && dur > 0.01 && act.getEffectiveWeight() > 0.35) {
            const currPhase01 = (((act.time % dur) + dur) % dur) / dur;
            if (prevLocomotionClip === activeRunClip && prevLocomotionPhase !== null) {
              const wrapped = currPhase01 < prevLocomotionPhase;
              for (let parity = 0; parity < plantPhases.length; parity++) {
                const p = plantPhases[parity];
                const crossed = wrapped
                  ? p > prevLocomotionPhase || p <= currPhase01
                  : prevLocomotionPhase < p && p <= currPhase01;
                if (crossed) {
                  pendingFootstepEvent = { parity, clipName: activeRunClip };
                  break;
                }
              }
            }
            prevLocomotionClip = activeRunClip;
            prevLocomotionPhase = currPhase01;
          } else {
            prevLocomotionClip = null;
            prevLocomotionPhase = null;
          }
        } else {
          prevLocomotionClip = null;
          prevLocomotionPhase = null;
        }
      }
    }

    // Widen Warrior stride length anatomically along each leg bone's own swing axis
    // and add a subtle athletic forward lean when sprinting (Shift), so faster movement
    // looks grounded rather than pushed by an external force.
    if (assetKey === 'warrior_run' && modelInstance && animCtrl) {
      const isHitReacting = Boolean(animCtrl.isHitActive?.());
      const isDoorPush = isDoorPushActive();
      const isForwardGait = activeRunClip === 'Running_A' || activeRunClip === 'Sprint_A';
      const targetSprint = isMoving && isSprinting && !isHitReacting && !isRolling && !isDoorPush && isForwardGait ? 1 : 0;
      warriorSprintBlend += (targetSprint - warriorSprintBlend) * Math.min(1, safeDt * 9);
      let runWeight = 0;
      let legMeans = null;
      if (isMoving && !isTurning180 && !isHitReacting && !isRolling && !isDoorPush && activeRunClip === 'Running_A') {
        const runAct = animCtrl.getAction?.('Running_A');
        const lowerRunAct = animCtrl.getAction?.('Running_A__Lower');
        runWeight = Math.min(
          1,
          (runAct && runAct.isRunning() ? runAct.getEffectiveWeight() : 0) +
            (lowerRunAct && lowerRunAct.isRunning() ? lowerRunAct.getEffectiveWeight() : 0)
        );
        legMeans = runAct?.getClip?.()?.userData?.legMeans || null;
      }
      if (runWeight > 0.05 && legMeans) {
        const amp = 1 + 0.08 * runWeight;
        for (const [boneName, qMean] of legMeans.entries()) {
          const bone = mx[boneName]?.node;
          if (!bone) continue;
          _strideMeanInv.copy(qMean).invert();
          _strideDelta.copy(_strideMeanInv).multiply(bone.quaternion);
          if (_strideDelta.w < 0) {
            _strideDelta.x = -_strideDelta.x;
            _strideDelta.y = -_strideDelta.y;
            _strideDelta.z = -_strideDelta.z;
            _strideDelta.w = -_strideDelta.w;
          }
          const sinHalf = Math.hypot(_strideDelta.x, _strideDelta.y, _strideDelta.z);
          if (sinHalf > 1e-4) {
            const halfAngle = Math.atan2(sinHalf, _strideDelta.w);
            const scaledAngle = Math.min(1.15, halfAngle * 2 * amp);
            _strideAxis.set(_strideDelta.x / sinHalf, _strideDelta.y / sinHalf, _strideDelta.z / sinHalf);
            _strideBoostQ.setFromAxisAngle(_strideAxis, scaledAngle);
            bone.quaternion.copy(qMean).multiply(_strideBoostQ);
          }
        }
      }
      const targetLean = isTurning180 || isHitReacting || isRolling || isDoorPush || isCriticalRiposteActive() || flaskDrinkAnimTimer > 0
        ? 0
        : (isMoving && isForwardGait ? 0.025 : 0) + warriorSprintBlend * 0.075;
      modelInstance.rotation.x += (targetLean - modelInstance.rotation.x) * Math.min(1, safeDt * 10);
    }

    // Dynamic Dash lean + athletic arm sweep / crouch across all hero classes (suppressed during 60 FPS Combat_Roll)!
    if (isRolling) {
      dashAnimTimer = 0;
      if (modelInstance && modelInstance.position.y !== 0) {
        modelInstance.position.y = 0;
      }
    } else if (dashAnimTimer > 0 && modelInstance) {
      dashAnimTimer = Math.max(0, dashAnimTimer - safeDt);
      const dProg = dashAnimDur > 0 ? 1 - dashAnimTimer / dashAnimDur : 1;
      const dEnv = Math.sin(Math.max(0, Math.min(1, dProg)) * Math.PI);
      const baseLeanX =
        assetKey === 'warrior_run'
          ? (isMoving && activeRunClip === 'Running_A' ? 0.035 : 0) + warriorSprintBlend * 0.11
          : 0;
      modelInstance.rotation.x = baseLeanX + dEnv * 0.34;
      modelInstance.position.y = -dEnv * 0.11;
      const dSpine = mx.Spine2?.node || chestBone;
      if (dSpine) {
        _wEuler.set(dEnv * 0.24, 0, 0);
        _wQuat.setFromEuler(_wEuler);
        dSpine.quaternion.multiply(_wQuat);
      }
      if (!isCurrentWeaponTwoHanded) {
        const dArmL = mx.LeftArm?.node || upperArmL;
        const dArmR = mx.RightArm?.node || upperArmR;
        if (dArmL) {
          _wEuler.set(dEnv * 0.32, 0, -dEnv * 0.22);
          _wQuat.setFromEuler(_wEuler);
          dArmL.quaternion.multiply(_wQuat);
        }
        if (dArmR && safeClass !== 'gunslinger') {
          _wEuler.set(dEnv * 0.28, 0, dEnv * 0.22);
          _wQuat.setFromEuler(_wEuler);
          dArmR.quaternion.multiply(_wQuat);
        }
      }
    } else if (modelInstance) {
      if (modelInstance.position.y !== 0) modelInstance.position.y = 0;
      if (assetKey !== 'warrior_run' && modelInstance.rotation.x !== 0) {
        modelInstance.rotation.x = 0;
      }
    }

    // Visceral Elden Ring Hero Hit-Buckle & Colossal Slam Knockdown Tumble Overlay
    if (heroBuckleTimer > 0 && !isRolling && !isDeadState && modelInstance) {
      heroBuckleTimer = Math.max(0, heroBuckleTimer - safeDt);
      const uB = heroBuckleDur > 0.01 ? Math.max(0, Math.min(1, 1 - heroBuckleTimer / heroBuckleDur)) : 1;
      // Fast 55ms blow snap -> visceral stagger/knockdown hold -> armored scramble recovery
      let shockEnv;
      if (heroBuckleTier === 'knockdown') {
        shockEnv = uB < 0.14
          ? smoothstep01(0, 0.14, uB)
          : uB < 0.56
            ? 1.0 - 0.10 * smoothstep01(0.14, 0.56, uB)
            : 0.90 * (1.0 - smoothstep01(0.56, 1.00, uB));
      } else {
        shockEnv = uB < 0.16
          ? smoothstep01(0, 0.16, uB)
          : 1.0 - smoothstep01(0.16, 1.00, uB);
      }
      const tierMult = heroBuckleTier === 'knockdown' ? 1.85 : heroBuckleTier === 'heavy' ? 1.25 : 0.72;
      const archRad = -0.22 * tierMult * shockEnv;
      const twistRad = 0.14 * tierMult * heroBuckleTwistSign * shockEnv;
      if (heroBuckleTier === 'knockdown') {
        modelInstance.position.y = -0.24 * shockEnv;
        modelInstance.rotation.x = -0.28 * shockEnv;
      } else if (heroBuckleTier === 'heavy') {
        modelInstance.position.y = -0.07 * shockEnv;
      }
      const sp0 = mx.Spine?.node;
      const sp1 = mx.Spine1?.node;
      const sp2 = mx.Spine2?.node || chestBone;
      const hd = mx.Head?.node || headBone;
      if (sp0) {
        _wEuler.set(archRad * 0.34, twistRad * 0.32, 0);
        _wQuat.setFromEuler(_wEuler);
        sp0.quaternion.multiply(_wQuat);
      }
      if (sp1) {
        _wEuler.set(archRad * 0.36, twistRad * 0.34, 0);
        _wQuat.setFromEuler(_wEuler);
        sp1.quaternion.multiply(_wQuat);
      }
      if (sp2) {
        _wEuler.set(archRad * 0.42, twistRad * 0.38, heroBuckleTwistSign * 0.08 * shockEnv);
        _wQuat.setFromEuler(_wEuler);
        sp2.quaternion.multiply(_wQuat);
      }
      if (hd) {
        _wEuler.set(archRad * 0.30, -twistRad * 0.20, 0);
        _wQuat.setFromEuler(_wEuler);
        hd.quaternion.multiply(_wQuat);
      }
    }

    let flaskTimerSteppedThisFrame = false;
    if (flaskDrinkAnimTimer > 0) {
      if (isDeadState || animCtrl?.isRollActive?.() || animCtrl?.isHitActive?.()) {
        cancelFlaskDrinkAnim();
      } else {
        flaskDrinkAnimTimer = Math.max(0, flaskDrinkAnimTimer - safeDt);
        flaskTimerSteppedThisFrame = true;
        if (flaskDrinkAnimTimer <= 0) {
          cancelFlaskDrinkAnim();
        }
      }
    } else if (estusFlaskMesh?.visible || shieldStowedToModelSpace || flaskBonesDirty) {
      cancelFlaskDrinkAnim();
    }

    applyWarriorWeaponAnimOverlay(safeDt, isMoving, elapsedTime, speedRatio);
    applyWarriorFlaskDrinkOverlay(safeDt, isMoving, elapsedTime, flaskTimerSteppedThisFrame);
    applyGunslingerWeaponAnimOverlay(safeDt, isMoving, elapsedTime);

    if (staffCastPulse > 0) {
      staffCastPulse = Math.max(0, staffCastPulse - safeDt * 5.2);
    }
    if (embeddedStaffVfx) {
      embeddedStaffVfx.updateVfx(elapsedTime, staffCastPulse);
    }

    // Two-handed shotgun carry pose, crisp recoil kick, pump rack & tactical chibi walk!
    if (safeClass === 'gunslinger' && gunCarryPivot) {
      const beastScale = isBeast ? 1.78 : 1.0;
      if (gunKickTimer > 0) {
        gunKickTimer = Math.max(0, gunKickTimer - safeDt);
      }
      if (aimHoldTimer > 0) {
        aimHoldTimer = Math.max(0, aimHoldTimer - safeDt);
      }
      if (pumpCycleTimer > 0) {
        pumpCycleTimer = Math.max(0, pumpCycleTimer - safeDt);
      }

      const targetMove = isMoving ? 1 : 0;
      moveBlend += (targetMove - moveBlend) * Math.min(1, safeDt * 11.5);
      if (moveBlend > 0.01) {
        const clampedSpd = Math.max(0.75, Math.min(1.65, speedRatio || 1));
        walkPhase += safeDt * 9.4 * clampedSpd;
      } else if (!isMoving) {
        walkPhase = 0;
      }

      const targetAim = aimHoldTimer > 0 ? 1 : 0;
      aimYawBlend += (targetAim - aimYawBlend) * Math.min(1, safeDt * 16);

      const targetReload = isReloadingState ? 1 : 0;
      reloadBlend += (targetReload - reloadBlend) * Math.min(1, safeDt * 12);

      // Punchy shotgun recoil spring curve (rapid kickback + smooth return)
      const kickRatio = gunKickTimer > 0 ? gunKickTimer / 0.26 : 0;
      const kickCurve = Math.pow(kickRatio, 0.65) * Math.sin(kickRatio * Math.PI * 0.92) * 1.28;

      // Pump-action rack window right after peak recoil (0.04..0.22s remaining)
      let pumpFrac = 0;
      if (pumpCycleTimer > 0 && pumpCycleTimer < 0.20) {
        pumpFrac = Math.sin((pumpCycleTimer / 0.20) * Math.PI);
      }

      const reloadBob = reloadBlend > 0.01 ? Math.sin(elapsedTime * 15.5) * reloadBlend : 0;

      if (isTripoGunslinger) {
        positionTripoGunPivot(elapsedTime, kickCurve, pumpFrac, reloadBob, beastScale);
        applyTripoGunslingerPose(elapsedTime, kickCurve, pumpFrac);
      } else {
        const strideBobY = isMoving ? Math.abs(Math.sin(elapsedTime * 11.5)) * 0.022 : Math.sin(elapsedTime * 2.6) * 0.008;

        gunCarryPivot.scale.setScalar(beastScale);
        gunCarryPivot.position.set(
          GUN_PIVOT_BASE_X * beastScale,
          (GUN_PIVOT_BASE_Y + strideBobY + reloadBob * 0.024) * beastScale,
          (GUN_PIVOT_BASE_Z - kickCurve * 0.18 - reloadBlend * 0.04) * beastScale
        );
        gunCarryPivot.rotation.x = -kickCurve * 0.32 + reloadBlend * 0.25 + reloadBob * 0.075;
        gunCarryPivot.rotation.y = reloadBlend * -0.10;
        gunCarryPivot.rotation.z = reloadBlend * 0.45;

        if (chestBone && kickCurve > 0.01) {
          _recoilPitchQuat.setFromAxisAngle(_xAxis, -kickCurve * 0.14);
          chestBone.quaternion.multiply(_recoilPitchQuat);
        }
        applyGunslingerArmPose();

        const forend = mountedWeaponObj?.userData?.pumpForend;
        if (forend) {
          forend.position.z = (forend.userData.baseZ || 0.39) - pumpFrac * 0.09;
        }
        const gatCluster = mountedWeaponObj?.userData?.gatlingCluster;
        if (gatCluster && gunKickTimer > 0) {
          gatCluster.rotation.z += safeDt * 18;
        }
      }
    }

    applyHeroDisarmVisibility();

    if (beastRing.visible) {
      beastRing.rotation.z = elapsedTime * 2.5;
      const pulse = 1 + Math.sin(elapsedTime * 7) * 0.08;
      beastRing.scale.set(pulse, pulse, 1);
    }

    if (flashTimer > 0) {
      flashTimer = Math.max(0, flashTimer - safeDt);
      if (flashTimer <= 0) setBeastMode(isBeast);
    }
  }

  const hasSyncedFootsteps = Boolean(animCtrl && footPlantMap);
  const getWeaponStyle = () => ({ style: currentWeaponStyle, twoHanded: isCurrentWeaponTwoHanded });

  // Cached weapon hilt -> tip endpoints in mounted-weapon local space for zero-alloc Swept Capsule hitboxes.
  let weaponSegSourceObj = null;
  let hasCachedWeaponSeg = false;
  const weaponHiltLocal = new THREE.Vector3();
  const weaponTipLocal = new THREE.Vector3();
  const _wSegHilt = new THREE.Vector3();
  const _wSegTip = new THREE.Vector3();
  const _wSegInvMount = new THREE.Matrix4();
  const _wSegToMount = new THREE.Matrix4();
  const _wSegEndA = new THREE.Vector3();
  const _wSegEndB = new THREE.Vector3();

  function refreshWeaponSegmentCache(srcObj) {
    weaponSegSourceObj = srcObj || null;
    hasCachedWeaponSeg = false;
    if (!srcObj) return;
    root.updateMatrixWorld(true);
    _wSegInvMount.copy(srcObj.matrixWorld).invert();
    if (handR) {
      handR.getWorldPosition(weaponHiltLocal).applyMatrix4(_wSegInvMount);
    } else {
      weaponHiltLocal.set(0, 0, 0);
    }
    let bestDistSq = -1;
    let foundMesh = false;
    srcObj.traverse((node) => {
      if (!node.isMesh || !node.geometry) return;
      if (!node.geometry.boundingBox) {
        node.geometry.computeBoundingBox();
      }
      const bb = node.geometry.boundingBox;
      if (!bb || bb.isEmpty()) return;
      const dx = bb.max.x - bb.min.x;
      const dy = bb.max.y - bb.min.y;
      const dz = bb.max.z - bb.min.z;
      const cx = (bb.min.x + bb.max.x) * 0.5;
      const cy = (bb.min.y + bb.max.y) * 0.5;
      const cz = (bb.min.z + bb.max.z) * 0.5;
      if (dy >= dx && dy >= dz) {
        _wSegEndA.set(cx, bb.min.y, cz);
        _wSegEndB.set(cx, bb.max.y, cz);
      } else if (dz >= dx && dz >= dy) {
        _wSegEndA.set(cx, cy, bb.min.z);
        _wSegEndB.set(cx, cy, bb.max.z);
      } else {
        _wSegEndA.set(bb.min.x, cy, cz);
        _wSegEndB.set(bb.max.x, cy, cz);
      }
      _wSegToMount.copy(_wSegInvMount).multiply(node.matrixWorld);
      _wSegEndA.applyMatrix4(_wSegToMount);
      _wSegEndB.applyMatrix4(_wSegToMount);
      const dA = _wSegEndA.distanceToSquared(weaponHiltLocal);
      const dB = _wSegEndB.distanceToSquared(weaponHiltLocal);
      if (dA > bestDistSq) {
        bestDistSq = dA;
        weaponTipLocal.copy(_wSegEndA);
        foundMesh = true;
      }
      if (dB > bestDistSq) {
        bestDistSq = dB;
        weaponTipLocal.copy(_wSegEndB);
        foundMesh = true;
      }
    });
    if (foundMesh && bestDistSq > 1e-4) {
      hasCachedWeaponSeg = true;
    }
  }

  function getWeaponSegmentWorld() {
    const activeSrc = mountedWeaponObj || (embeddedWarriorSwordNode?.visible ? embeddedWarriorSwordNode : null);
    if (activeSrc) {
      // Ancestor-only chain update (~7 bones instead of recursive 65-bone full skeleton walk!)
      activeSrc.updateWorldMatrix(true, false);
    } else {
      root.updateWorldMatrix(true, false);
    }
    if (activeSrc && (!hasCachedWeaponSeg || weaponSegSourceObj !== activeSrc)) {
      activeSrc.updateMatrixWorld(true);
      refreshWeaponSegmentCache(activeSrc);
    } else if (!activeSrc) {
      hasCachedWeaponSeg = false;
      weaponSegSourceObj = null;
    }
    if (hasCachedWeaponSeg && weaponSegSourceObj) {
      _wSegHilt.copy(weaponHiltLocal).applyMatrix4(weaponSegSourceObj.matrixWorld);
      _wSegTip.copy(weaponTipLocal).applyMatrix4(weaponSegSourceObj.matrixWorld);
      if (
        Number.isFinite(_wSegHilt.x) &&
        Number.isFinite(_wSegHilt.y) &&
        Number.isFinite(_wSegHilt.z) &&
        Number.isFinite(_wSegTip.x) &&
        Number.isFinite(_wSegTip.y) &&
        Number.isFinite(_wSegTip.z) &&
        _wSegHilt.distanceToSquared(_wSegTip) >= 0.16
      ) {
        return {
          hiltX: _wSegHilt.x,
          hiltY: _wSegHilt.y,
          hiltZ: _wSegHilt.z,
          tipX: _wSegTip.x,
          tipY: _wSegTip.y,
          tipZ: _wSegTip.z
        };
      }
    }
    // Reliable fallback segment along hero facing from right hand (or root chest height)
    const yaw = root.rotation?.y || 0;
    const fwdX = Math.sin(yaw);
    const fwdZ = Math.cos(yaw);
    let hx = root.position.x + fwdX * 0.25;
    let hy = root.position.y + 1.05;
    let hz = root.position.z + fwdZ * 0.25;
    if (handR) {
      handR.getWorldPosition(_wSegHilt);
      if (Number.isFinite(_wSegHilt.x) && Number.isFinite(_wSegHilt.y) && Number.isFinite(_wSegHilt.z)) {
        hx = _wSegHilt.x;
        hy = _wSegHilt.y;
        hz = _wSegHilt.z;
      }
    }
    const reach = isCurrentWeaponTwoHanded ? 1.85 : 1.35;
    return {
      hiltX: hx,
      hiltY: hy,
      hiltZ: hz,
      tipX: hx + fwdX * reach,
      tipY: hy,
      tipZ: hz + fwdZ * reach
    };
  }

  const heroAnimFacade = {
    ...(animCtrl || {}),
    triggerDash,
    playRollAnim,
    cancelRollAnim,
    isRollActive,
    playCriticalRiposte,
    isCriticalRiposteActive,
    setDoorPushMode,
    isDoorPushActive,
    setCutsceneClipNormalized,
    clearCutsceneClip,
    isCutsceneClipActive,
    setWeaponDisarmed,
    getWeaponDisarmed,
    playFlaskDrinkAnim,
    cancelFlaskDrinkAnim,
    isFlaskDrinkActive,
    playHeavyThrustAnim,
    triggerAttack,
    triggerTurn180,
    cancelTurn180,
    isTurn180Active,
    getTurn180State,
    triggerHitReact,
    cancelHitReact,
    isHitReactActive,
    setWeapon,
    getWeaponStyle,
    getWeaponSegmentWorld,
    playAttackAnim,
    playDeathAnim,
    setDeadState,
    resetDeath,
    isDead,
    setBlocking,
    addShieldScrapeDecal
  };
  root.userData.animCtrl = heroAnimFacade;
  root.userData.setWeapon = setWeapon;
  root.userData.setElement = setElement;
  root.userData.setBeastMode = setBeastMode;
  root.userData.setReloading = setReloading;
  root.userData.playAttackAnim = playAttackAnim;
  root.userData.playHeavyThrustAnim = playHeavyThrustAnim;
  root.userData.triggerAttack = triggerAttack;
  root.userData.playFlaskDrinkAnim = playFlaskDrinkAnim;
  root.userData.cancelFlaskDrinkAnim = cancelFlaskDrinkAnim;
  root.userData.isFlaskDrinkActive = isFlaskDrinkActive;
  root.userData.setDoorPushMode = setDoorPushMode;
  root.userData.isDoorPushActive = isDoorPushActive;
  root.userData.setCutsceneClipNormalized = setCutsceneClipNormalized;
  root.userData.clearCutsceneClip = clearCutsceneClip;
  root.userData.isCutsceneClipActive = isCutsceneClipActive;
  root.userData.setWeaponDisarmed = setWeaponDisarmed;
  root.userData.getWeaponDisarmed = getWeaponDisarmed;
  root.userData.contactShadow = heroContactShadow;
  root.userData.playDeathAnim = playDeathAnim;
  root.userData.setDeadState = setDeadState;
  root.userData.resetDeath = resetDeath;
  root.userData.isDead = isDead;
  root.userData.setBlocking = setBlocking;
  root.userData.triggerDash = triggerDash;
  root.userData.playRollAnim = playRollAnim;
  root.userData.cancelRollAnim = cancelRollAnim;
  root.userData.isRollActive = isRollActive;
  root.userData.playCriticalRiposte = playCriticalRiposte;
  root.userData.isCriticalRiposteActive = isCriticalRiposteActive;
  root.userData.triggerTurn180 = triggerTurn180;
  root.userData.cancelTurn180 = cancelTurn180;
  root.userData.isTurn180Active = isTurn180Active;
  root.userData.getTurn180State = getTurn180State;
  root.userData.triggerHitReact = triggerHitReact;
  root.userData.cancelHitReact = cancelHitReact;
  root.userData.isHitReactActive = isHitReactActive;
  root.userData.getWeaponStyle = getWeaponStyle;
  root.userData.getWeaponSegmentWorld = getWeaponSegmentWorld;
  root.userData.addShieldScrapeDecal = addShieldScrapeDecal;
  root.userData.flashHit = flashHit;
  root.userData.update = update;
  if (hasSyncedFootsteps) {
    root.userData.consumeFootstepEvent = consumeFootstepEvent;
  }

  // Free the GPU memory owned by this particular copy of the hero.
  // Shared geometry/textures from gltfCache are intentionally NOT disposed —
  // other instances still use them. Only cloned materials, skeletons and
  // mixer bindings belong to this instance.
  function dispose() {
    isDisposed = true;
    isDoorPushing = false;
    animCtrl?.setDoorPushState?.(false, 0);
    cancelFlaskDrinkAnim();
    if (heroContactShadow) {
      if (heroContactShadow.parent) heroContactShadow.parent.remove(heroContactShadow);
      heroContactShadow.userData?.dispose?.();
    }
    if (estusFlaskMesh) {
      if (estusFlaskMesh.parent) estusFlaskMesh.parent.remove(estusFlaskMesh);
      disposeOwnedWeaponMaterials(estusFlaskMesh);
      estusFlaskMesh = null;
    }
    if (warriorShieldBackAnchor?.parent) {
      warriorShieldBackAnchor.parent.remove(warriorShieldBackAnchor);
      warriorShieldBackAnchor = null;
    }
    if (mountedWeaponObj) {
      if (mountedWeaponObj.parent) mountedWeaponObj.parent.remove(mountedWeaponObj);
      disposeOwnedWeaponMaterials(mountedWeaponObj);
      mountedWeaponObj = null;
    }
    if (shieldDecalRoot) {
      if (shieldDecalRoot.parent) shieldDecalRoot.parent.remove(shieldDecalRoot);
      shieldDecalRoot = null;
    }
    for (let i = 0; i < shieldDecalSlots.length; i++) {
      shieldDecalSlots[i]?.mat?.dispose?.();
    }
    shieldDecalSlots.length = 0;
    shieldDecalCursor = 0;
    if (mountedShieldObj) {
      if (mountedShieldObj.parent) mountedShieldObj.parent.remove(mountedShieldObj);
      disposeOwnedWeaponMaterials(mountedShieldObj);
      mountedShieldObj = null;
    }
    if (legacyWarriorShieldObj) {
      if (legacyWarriorShieldObj.parent) legacyWarriorShieldObj.parent.remove(legacyWarriorShieldObj);
      legacyWarriorShieldObj = null;
    }
    if (embeddedStaffVfx) {
      if (embeddedStaffVfx.group?.parent) {
        embeddedStaffVfx.group.parent.remove(embeddedStaffVfx.group);
      }
      embeddedStaffVfx.dispose?.();
      embeddedStaffVfx = null;
    }
    if (beastRing?.material?.dispose) {
      beastRing.material.dispose();
    }
    if (animCtrl?.mixer && modelInstance) {
      animCtrl.mixer.stopAllAction();
      animCtrl.mixer.uncacheRoot(modelInstance);
    }
    if (modelInstance) {
      modelInstance.traverse((n) => {
        if (n.isSkinnedMesh && n.skeleton) n.skeleton.dispose();
      });
    }
    for (const item of instanceMats) {
      if (item.mat?.dispose) item.mat.dispose();
    }
    instanceMats.length = 0;
  }

  const heroHandle = {
    root,
    contactShadow: heroContactShadow,
    dispose,
    setWeapon,
    setElement,
    setBeastMode,
    setReloading,
    playAttackAnim,
    playHeavyThrustAnim,
    triggerAttack,
    playFlaskDrinkAnim,
    cancelFlaskDrinkAnim,
    isFlaskDrinkActive,
    setDoorPushMode,
    isDoorPushActive,
    setCutsceneClipNormalized,
    clearCutsceneClip,
    isCutsceneClipActive,
    setWeaponDisarmed,
    getWeaponDisarmed,
    playDeathAnim,
    setDeadState,
    resetDeath,
    isDead,
    setBlocking,
    triggerDash,
    playRollAnim,
    cancelRollAnim,
    isRollActive,
    playCriticalRiposte,
    isCriticalRiposteActive,
    triggerTurn180,
    cancelTurn180,
    isTurn180Active,
    getTurn180State,
    triggerHitReact,
    cancelHitReact,
    isHitReactActive,
    getWeaponStyle,
    getWeaponSegmentWorld,
    addShieldScrapeDecal,
    flashHit,
    update
  };
  if (hasSyncedFootsteps) {
    heroHandle.consumeFootstepEvent = consumeFootstepEvent;
  }
  return heroHandle;
}

// ============================================================================
// 1b. DROPPED & SHORE OATH BROADSWORD PROPS (Real 3D sword_tripo clone 1:1 with Hero)
// ============================================================================
const HERO_EQUIPPED_OATH_SWORD_LEN = 1.272; // 97.692 * 2.17 (heroBaseScale) * 0.006 (handR mount)

export function createRealOathSwordClone({ targetLen = HERO_EQUIPPED_OATH_SWORD_LEN, centerOrigin = true } = {}) {
  const swordAsset = gltfCache.get('sword_tripo');
  if (!swordAsset?.scene) return null;
  const wrapper = new THREE.Group();
  wrapper.name = 'RealOathSwordTripoClone';
  const inner = swordAsset.scene.clone(true);
  inner.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inner);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const maxSpan = Math.max(size.x, size.y, size.z, 1e-4);
  const sc = (Number(targetLen) > 0 ? Number(targetLen) : HERO_EQUIPPED_OATH_SWORD_LEN) / maxSpan;
  inner.scale.setScalar(sc);
  if (centerOrigin) {
    inner.position.set(-center.x * sc, -center.y * sc, -center.z * sc);
  } else {
    inner.position.set(-center.x * sc, -box.min.y * sc, -center.z * sc);
  }
  inner.traverse((n) => {
    if (n.isMesh) {
      n.castShadow = true;
      n.receiveShadow = false;
      n.frustumCulled = false;
    }
  });
  wrapper.add(inner);
  wrapper.userData.isRealSwordTripo = true;
  return wrapper;
}

const HERO_EQUIPPED_GREAT_CLUB_LEN = 1.62; // Gnarled dark-oak Elden Ring Great Club resting length on the shore

export function createRealGreatClubClone({ targetLen = HERO_EQUIPPED_GREAT_CLUB_LEN, centerOrigin = false } = {}) {
  const clubAsset = gltfCache.get('great_club_tripo');
  if (!clubAsset?.scene) return null;
  const wrapper = new THREE.Group();
  wrapper.name = 'RealGreatClubTripoClone';
  const inner = clubAsset.scene.clone(true);
  inner.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inner);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const maxSpan = Math.max(size.x, size.y, size.z, 1e-4);
  const sc = (Number(targetLen) > 0 ? Number(targetLen) : HERO_EQUIPPED_GREAT_CLUB_LEN) / maxSpan;
  inner.scale.setScalar(sc);
  if (centerOrigin) {
    inner.position.set(-center.x * sc, -center.y * sc, -center.z * sc);
  } else {
    inner.position.set(-center.x * sc, -box.min.y * sc, -center.z * sc);
  }
  inner.traverse((n) => {
    if (n.isMesh) {
      n.castShadow = true;
      n.receiveShadow = true;
      n.frustumCulled = false;
    }
  });
  wrapper.add(inner);
  wrapper.userData.isRealGreatClub = true;
  wrapper.userData.isGreatClub = true;
  return wrapper;
}

export function createDroppedSwordMesh() {
  const root = new THREE.Group();
  root.name = 'DroppedOathSword';
  let disposed = false;
  let inner = createRealOathSwordClone({ targetLen: HERO_EQUIPPED_OATH_SWORD_LEN, centerOrigin: true });
  let usingRealModel = Boolean(inner);
  if (!inner) {
    inner = createHeroWeaponMesh('club', null);
    inner.scale.setScalar(1.22);
    if (MODEL_PATHS.sword_tripo && !failedModelKeys.has('sword_tripo')) {
      loadSingleModelKey('sword_tripo').then(() => {
        if (disposed || usingRealModel) return;
        const realClone = createRealOathSwordClone({ targetLen: HERO_EQUIPPED_OATH_SWORD_LEN, centerOrigin: true });
        if (!realClone) return;
        if (inner) {
          root.remove(inner);
          disposeOwnedWeaponMaterials(inner);
        }
        inner = realClone;
        usingRealModel = true;
        root.add(inner);
      });
    }
  }
  root.add(inner);
  root.visible = false;
  return {
    obj: root,
    isRealModel: () => usingRealModel,
    dispose() {
      disposed = true;
      if (root.parent) root.parent.remove(root);
      disposeOwnedWeaponMaterials(inner);
    }
  };
}

// ============================================================================
// 2. COMPANION FACTORY (Friendly Mini Skeleton Squire)
// ============================================================================
export function createCompanionMesh() {
  const root = new THREE.Group();
  const asset = gltfCache.get('skel_minion');
  let animCtrl = null;
  let companionInst = null;
  const companionMats = [];

  if (asset) {
    const inst = cloneSkinned(asset.scene);
    companionInst = inst;
    inst.scale.setScalar(0.62);
    inst.traverse((n) => {
      if (n.isMesh && /Eyes/i.test(n.name)) {
        const eyeMat = new THREE.MeshStandardMaterial({
          color: 0x67e8f9,
          emissive: 0x06b6d4,
          emissiveIntensity: 2.2
        });
        n.material = eyeMat;
        companionMats.push(eyeMat);
      }
    });
    root.add(inst);
    animCtrl = createAnimController(inst, asset.clips, 'Idle', 'Running_A');
  }

  function dispose() {
    if (animCtrl?.mixer && companionInst) {
      animCtrl.mixer.stopAllAction();
      animCtrl.mixer.uncacheRoot(companionInst);
    }
    if (companionInst) {
      companionInst.traverse((n) => {
        if (n.isSkinnedMesh && n.skeleton) n.skeleton.dispose();
      });
    }
    for (const mat of companionMats) {
      if (mat?.dispose) mat.dispose();
    }
    companionMats.length = 0;
  }

  return {
    root,
    dispose,
    playAttackAnim() {
      animCtrl?.triggerOneShot('1H_Melee_Attack_Chop', 1.9);
    },
    update(dt, isMoving = false) {
      const safeDt = Math.min(Math.max(dt || 0.016, 0), 0.1);
      if (animCtrl) {
        animCtrl.setBaseState(isMoving ? 'Running_A' : 'Idle', isMoving ? 1.25 : 1.0);
        animCtrl.mixer.update(safeDt);
      }
    }
  };
}

// ============================================================================
// 3. ENEMY SPECIALISTS & 5 MILESTONE ACT BOSSES FACTORY (Matches ad09b7c9.jpg!)
// ============================================================================

function createGlowingEyePair(eyeHex, spreadX = 0.155, posY = 0.41, posZ = 0.44, scaleX = 1.28, scaleY = 0.78) {
  const grp = new THREE.Group();
  const eyeMat = getMat(`en_eye_${eyeHex}`, () =>
    new THREE.MeshStandardMaterial({
      color: eyeHex,
      emissive: eyeHex,
      emissiveIntensity: 2.75,
      roughness: 0.14
    })
  );
  const eyeGeo = getGeo('en_eye_sphere', () => new THREE.SphereGeometry(0.060, 8, 8));
  for (const sx of [-spreadX, spreadX]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.scale.set(scaleX, scaleY, 0.65);
    eye.position.set(sx, posY, posZ);
    eye.rotation.z = sx < 0 ? 0.18 : -0.18;
    grp.add(eye);
  }
  return grp;
}

function createBatWings(boneHex = 0x4b4e57, membraneHex = 0x373940, wingSpan = 1.0, magmaGlow = false) {
  const grp = new THREE.Group();
  const boneMat = getMat(`bw_bone_${boneHex}`, () =>
    new THREE.MeshStandardMaterial({ color: boneHex, roughness: 0.58, metalness: 0.24 })
  );
  const memMat = getMat(`bw_mem_${membraneHex}_${magmaGlow ? 1 : 0}`, () =>
    new THREE.MeshStandardMaterial({
      color: membraneHex,
      emissive: magmaGlow ? 0xea580c : 0x000000,
      emissiveIntensity: magmaGlow ? 1.15 : 0,
      roughness: 0.52,
      metalness: 0.08,
      side: THREE.DoubleSide
    })
  );

  const wingShape = getGeo('bw_web_geo', () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0.05);
    s.lineTo(0.55, 0.48);
    s.lineTo(1.08, 0.24);
    s.quadraticCurveTo(0.84, -0.08, 0.74, -0.44);
    s.quadraticCurveTo(0.50, -0.18, 0.36, -0.48);
    s.quadraticCurveTo(0.18, -0.22, 0.02, -0.32);
    s.closePath();
    return new THREE.ShapeGeometry(s, 6);
  });
  const sparGeo = getGeo('bw_spar', () => {
    const cg = new THREE.CylinderGeometry(0.028, 0.042, 0.68, 7);
    cg.translate(0, 0.34, 0);
    return cg;
  });
  const clawGeo = getGeo('bw_claw', () => new THREE.ConeGeometry(0.042, 0.15, 5));

  const wingPivots = [];
  for (const side of [-1, 1]) {
    const wPivot = new THREE.Group();
    wPivot.position.set(side * 0.16, 0.32, -0.22);

    const innerArm = new THREE.Mesh(sparGeo, boneMat);
    innerArm.rotation.z = -side * 0.88;
    innerArm.position.set(0, 0.04, 0);

    const outerArm = new THREE.Mesh(sparGeo, boneMat);
    outerArm.scale.set(0.85, 0.92, 0.85);
    outerArm.position.set(side * 0.52, 0.46, -0.02);
    outerArm.rotation.z = -side * 1.92;

    const thumbClaw = new THREE.Mesh(clawGeo, boneMat);
    thumbClaw.position.set(side * 0.54, 0.54, 0.02);
    thumbClaw.rotation.z = -side * 0.35;

    const web = new THREE.Mesh(wingShape, memMat);
    web.scale.set(side, 1, 1);
    web.position.set(0, 0.02, -0.02);

    wPivot.add(innerArm, outerArm, thumbClaw, web);
    wPivot.scale.setScalar(wingSpan);
    wPivot.rotation.y = -side * 0.36;
    grp.add(wPivot);
    wingPivots.push({ pivot: wPivot, side });
  }
  grp.userData.wingPivots = wingPivots;
  return grp;
}

function createChibiMonsterHead({
  skinHex = 0x5c8a32,
  eyeHex = 0xff4500,
  ears = 'pointed', // 'pointed' | 'wolf' | 'ogre' | 'none'
  horns = 'none',   // 'none' | 'imp' | 'gargoyle' | 'demon_magma'
  tusks = false,
  wolfSnout = false,
  goblinNose = false
} = {}) {
  const grp = new THREE.Group();
  const skinMat = getMat(`cmh_skin_${skinHex}`, () =>
    new THREE.MeshStandardMaterial({ color: skinHex, roughness: 0.68, metalness: 0.08 })
  );
  const darkMouthMat = getMat('cmh_mouth_dark', () =>
    new THREE.MeshStandardMaterial({ color: 0x140d12, roughness: 0.85 })
  );
  const fangMat = getMat('cmh_fang_ivory', () =>
    new THREE.MeshStandardMaterial({ color: 0xf5efe0, roughness: 0.38, metalness: 0.06 })
  );

  const cranium = new THREE.Mesh(
    getGeo('cmh_cranium', () => new THREE.SphereGeometry(0.43, 14, 12)),
    skinMat
  );
  cranium.scale.set(1.04, 0.98, 0.98);
  cranium.position.set(0, 0.42, 0.02);

  const jaw = new THREE.Mesh(
    getGeo('cmh_jaw', () => new THREE.BoxGeometry(0.56, 0.28, 0.48)),
    skinMat
  );
  jaw.position.set(0, 0.20, 0.10);

  const brow = new THREE.Mesh(
    getGeo('cmh_brow', () => new THREE.BoxGeometry(0.58, 0.11, 0.24)),
    skinMat
  );
  brow.position.set(0, 0.50, 0.34);
  brow.rotation.x = 0.18;

  const mouth = new THREE.Mesh(
    getGeo('cmh_mouth_box', () => new THREE.BoxGeometry(0.36, 0.10, 0.10)),
    darkMouthMat
  );
  mouth.position.set(0, 0.21, 0.33);

  grp.add(cranium, jaw, brow, mouth);
  grp.add(createGlowingEyePair(eyeHex, 0.155, 0.41, 0.41, 1.32, 0.76));

  if (goblinNose) {
    const nose = new THREE.Mesh(
      getGeo('cmh_gob_nose', () => {
        const cg = new THREE.ConeGeometry(0.085, 0.24, 6);
        cg.rotateX(Math.PI * 0.56);
        return cg;
      }),
      skinMat
    );
    nose.position.set(0, 0.35, 0.47);
    grp.add(nose);
  }

  if (wolfSnout) {
    const snout = new THREE.Mesh(
      getGeo('cmh_wolf_snout', () => new THREE.BoxGeometry(0.36, 0.24, 0.38)),
      skinMat
    );
    snout.position.set(0, 0.28, 0.42);
    const noseTip = new THREE.Mesh(
      getGeo('cmh_wolf_nose', () => new THREE.SphereGeometry(0.075, 8, 8)),
      darkMouthMat
    );
    noseTip.position.set(0, 0.36, 0.60);
    grp.add(snout, noseTip);
    for (const sx of [-0.11, 0.11]) {
      const wf = new THREE.Mesh(
        getGeo('cmh_wolf_fang', () => new THREE.ConeGeometry(0.036, 0.12, 5)),
        fangMat
      );
      wf.rotation.x = Math.PI;
      wf.position.set(sx, 0.18, 0.54);
      grp.add(wf);
    }
    // Shaggy cheek fur tufts
    const tuftGeo = getGeo('cmh_wolf_tuft', () => new THREE.ConeGeometry(0.14, 0.34, 5));
    for (const sx of [-1, 1]) {
      const tuft = new THREE.Mesh(tuftGeo, skinMat);
      tuft.position.set(sx * 0.46, 0.30, 0.08);
      tuft.rotation.z = -sx * 1.25;
      grp.add(tuft);
    }
  } else if (tusks) {
    const tuskGeo = getGeo('cmh_tusk', () => new THREE.ConeGeometry(0.052, 0.20, 6));
    for (const sx of [-0.15, 0.15]) {
      const t = new THREE.Mesh(tuskGeo, fangMat);
      t.position.set(sx, 0.26, 0.38);
      t.rotation.x = 0.24;
      t.rotation.z = sx < 0 ? 0.15 : -0.15;
      grp.add(t);
    }
  } else {
    const fangGeo = getGeo('cmh_tiny_fang', () => new THREE.ConeGeometry(0.032, 0.09, 5));
    for (const sx of [-0.11, 0.11]) {
      const f = new THREE.Mesh(fangGeo, fangMat);
      f.rotation.x = Math.PI;
      f.position.set(sx, 0.23, 0.37);
      grp.add(f);
    }
  }

  if (ears === 'pointed') {
    const earGeo = getGeo('cmh_ear_long', () => new THREE.ConeGeometry(0.12, 0.48, 5));
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(earGeo, skinMat);
      ear.position.set(sx * 0.55, 0.42, 0.02);
      ear.rotation.z = -sx * 1.28;
      ear.rotation.y = -sx * 0.22;
      grp.add(ear);
    }
  } else if (ears === 'wolf') {
    const wEarGeo = getGeo('cmh_ear_wolf', () => new THREE.ConeGeometry(0.14, 0.42, 5));
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(wEarGeo, skinMat);
      ear.position.set(sx * 0.28, 0.88, -0.02);
      ear.rotation.z = -sx * 0.24;
      grp.add(ear);
    }
  } else if (ears === 'ogre') {
    const oEarGeo = getGeo('cmh_ear_ogre', () => new THREE.SphereGeometry(0.11, 8, 8));
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(oEarGeo, skinMat);
      ear.scale.set(0.65, 1.1, 0.85);
      ear.position.set(sx * 0.45, 0.42, 0.0);
      grp.add(ear);
    }
  }

  if (horns === 'imp' || horns === 'gargoyle') {
    const isStone = horns === 'gargoyle';
    const hMat = getMat(isStone ? 'cmh_stone_horn' : 'cmh_imp_horn', () =>
      new THREE.MeshStandardMaterial({
        color: isStone ? 0x373a42 : 0x450a0a,
        roughness: 0.48,
        metalness: 0.22
      })
    );
    for (const sx of [-1, 1]) {
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(sx * 0.24, 0.72, 0.08),
        new THREE.Vector3(sx * 0.46, 0.94, 0.02),
        new THREE.Vector3(sx * 0.36, 1.18, -0.10)
      );
      const hGeo = getGeo(`cmh_small_horn_${sx}`, () => new THREE.TubeGeometry(curve, 8, 0.062, 7, false));
      const tip = new THREE.Mesh(getGeo('cmh_small_horn_tip', () => new THREE.ConeGeometry(0.06, 0.16, 6)), hMat);
      tip.position.set(sx * 0.35, 1.24, -0.12);
      tip.rotation.x = -0.35;
      grp.add(new THREE.Mesh(hGeo, hMat), tip);
    }
  } else if (horns === 'demon_magma') {
    // Sweeping dark-obsidian bull/demon horns with blazing molten orange-yellow tips (matches Act I Boss in ad09b7c9.jpg!)
    const obsMat = getMat('demon_obs_horn', () =>
      new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.42, metalness: 0.35 })
    );
    const magmaTipMat = getMat('demon_magma_tip', () =>
      new THREE.MeshStandardMaterial({
        color: 0xfde047,
        emissive: 0xff5500,
        emissiveIntensity: 2.4,
        roughness: 0.20
      })
    );
    for (const sx of [-1, 1]) {
      const baseCurve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(sx * 0.28, 0.68, 0.04),
        new THREE.Vector3(sx * 0.74, 0.76, 0.08),
        new THREE.Vector3(sx * 0.68, 1.14, 0.12)
      );
      const hBase = new THREE.Mesh(
        getGeo(`demon_horn_base_${sx}`, () => new THREE.TubeGeometry(baseCurve, 10, 0.098, 8, false)),
        obsMat
      );
      const tipCone = new THREE.Mesh(
        getGeo('demon_horn_glow_tip', () => new THREE.ConeGeometry(0.095, 0.42, 8)),
        magmaTipMat
      );
      tipCone.position.set(sx * 0.62, 1.32, 0.13);
      tipCone.rotation.z = sx * 0.28;
      grp.add(hBase, tipCone);
    }
  }

  return grp;
}

function createCthulhuHeadAndTentacles() {
  const grp = new THREE.Group();
  const abyssSkinMat = getMat('cth_skin', () =>
    new THREE.MeshStandardMaterial({ color: 0x1f4e5f, roughness: 0.52, metalness: 0.12 })
  );
  const darkCrestMat = getMat('cth_crest', () =>
    new THREE.MeshStandardMaterial({ color: 0x133340, roughness: 0.58, metalness: 0.18 })
  );
  const runeMat = getMat('cth_cyan_rune', () =>
    new THREE.MeshStandardMaterial({
      color: 0xa5f3fc,
      emissive: 0x06b6d4,
      emissiveIntensity: 2.6,
      roughness: 0.15
    })
  );

  // Tall bulbous cephalopod cranium dome
  const dome = new THREE.Mesh(
    getGeo('cth_dome', () => new THREE.SphereGeometry(0.50, 16, 14)),
    abyssSkinMat
  );
  dome.scale.set(1.02, 1.32, 1.14);
  dome.position.set(0, 0.62, -0.04);

  const brow = new THREE.Mesh(
    getGeo('cth_brow', () => new THREE.BoxGeometry(0.62, 0.13, 0.28)),
    darkCrestMat
  );
  brow.position.set(0, 0.48, 0.36);
  brow.rotation.x = 0.22;

  // Forehead glowing cyan elder rune (matches ad09b7c9.jpg #3!)
  const runeV = new THREE.Mesh(getGeo('cth_rune_v', () => new THREE.BoxGeometry(0.042, 0.24, 0.04)), runeMat);
  runeV.position.set(-0.03, 0.72, 0.46);
  const runeDiag1 = new THREE.Mesh(getGeo('cth_rune_d', () => new THREE.BoxGeometry(0.14, 0.038, 0.04)), runeMat);
  runeDiag1.position.set(0.03, 0.78, 0.46);
  runeDiag1.rotation.z = -0.52;
  const runeDiag2 = new THREE.Mesh(getGeo('cth_rune_d', () => new THREE.BoxGeometry(0.14, 0.038, 0.04)), runeMat);
  runeDiag2.position.set(0.03, 0.66, 0.46);
  runeDiag2.rotation.z = -0.62;

  grp.add(dome, brow, runeV, runeDiag1, runeDiag2);
  grp.add(createGlowingEyePair(0xff6a00, 0.17, 0.40, 0.42, 1.35, 0.78));

  // 5 Sculpted Curling Face Tentacles hanging from face over chest!
  const tentacles = [];
  for (let i = 0; i < 5; i++) {
    const frac = (i - 2) / 2; // -1 .. +1
    const ox = frac * 0.24;
    const oz = 0.38 - Math.abs(frac) * 0.08;
    const tPivot = new THREE.Group();
    tPivot.position.set(ox, 0.28, oz);

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(ox * 0.35, -0.22, 0.10),
      new THREE.Vector3(ox * 0.65, -0.48, 0.04),
      new THREE.Vector3(ox * 0.95 + (i % 2 === 0 ? 0.08 : -0.08), -0.64, 0.16)
    ]);
    const tGeo = getGeo(`cth_face_tent_${i}`, () => new THREE.TubeGeometry(curve, 12, 0.068, 7, false));
    const tMesh = new THREE.Mesh(tGeo, abyssSkinMat);
    const tipCone = new THREE.Mesh(getGeo('cth_tent_tip', () => new THREE.ConeGeometry(0.064, 0.16, 6)), darkCrestMat);
    const endPt = curve.getPoint(1);
    tipCone.position.copy(endPt);
    tipCone.rotation.x = Math.PI * 0.65;
    tPivot.add(tMesh, tipCone);
    grp.add(tPivot);
    tentacles.push({ pivot: tPivot, phase: i * 1.15 });
  }
  grp.userData.tentacles = tentacles;
  return grp;
}

function createCthulhuArmorAndBaseTentacles() {
  const chestProps = new THREE.Group();
  const baseProps = new THREE.Group();
  const slateMat = getMat('cth_armor_slate', () =>
    new THREE.MeshStandardMaterial({ color: 0x2a3444, metalness: 0.72, roughness: 0.36 })
  );
  const hornMat = getMat('cth_pauldron_horn', () =>
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.42, metalness: 0.2 })
  );
  const runeMat = getMat('cth_cyan_rune', () =>
    new THREE.MeshStandardMaterial({ color: 0xa5f3fc, emissive: 0x06b6d4, emissiveIntensity: 2.6, roughness: 0.15 })
  );
  const tentMat = getMat('cth_skin', () =>
    new THREE.MeshStandardMaterial({ color: 0x1f4e5f, roughness: 0.52, metalness: 0.12 })
  );

  for (const sx of [-1, 1]) {
    const pauldron = new THREE.Mesh(
      getGeo('cth_pauldron', () => new THREE.SphereGeometry(0.28, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.58)),
      slateMat
    );
    pauldron.position.set(sx * 0.44, 0.36, 0.02);
    pauldron.rotation.z = -sx * 0.42;
    const spike = new THREE.Mesh(getGeo('cth_p_spike', () => new THREE.ConeGeometry(0.068, 0.26, 6)), hornMat);
    spike.position.set(sx * 0.56, 0.54, 0.04);
    spike.rotation.z = -sx * 0.32;
    const runeStrip = new THREE.Mesh(getGeo('cth_p_rune', () => new THREE.BoxGeometry(0.14, 0.036, 0.04)), runeMat);
    runeStrip.position.set(sx * 0.46, 0.38, 0.25);
    chestProps.add(pauldron, spike, runeStrip);
  }
  const beltRune = new THREE.Mesh(getGeo('cth_belt_gem', () => new THREE.OctahedronGeometry(0.11, 0)), runeMat);
  beltRune.scale.set(0.85, 1.35, 0.45);
  beltRune.position.set(0, -0.05, 0.26);
  chestProps.add(beltRune);

  const baseTentacles = [];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.4;
    const piv = new THREE.Group();
    piv.rotation.y = a;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.18, 0.22),
      new THREE.Vector3(0.08, 0.09, 0.58),
      new THREE.Vector3(-0.08, 0.14, 0.92),
      new THREE.Vector3(0.04, 0.34, 1.04)
    ]);
    const tg = getGeo('cth_base_tent', () => new THREE.TubeGeometry(curve, 12, 0.095, 7, false));
    piv.add(new THREE.Mesh(tg, tentMat));
    baseProps.add(piv);
    baseTentacles.push({ pivot: piv, baseY: a, phase: k * 1.05 });
  }
  baseProps.userData.baseTentacles = baseTentacles;
  return { chestProps, baseProps };
}

function createAshenDragonHead() {
  const grp = new THREE.Group();
  const obsMat = getMat('drg_obsidian', () =>
    new THREE.MeshStandardMaterial({ color: 0x1c191e, roughness: 0.46, metalness: 0.34 })
  );
  const lavaMawMat = getMat('drg_lava_maw', () =>
    new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xff5500,
      emissiveIntensity: 2.8,
      roughness: 0.15
    })
  );
  const hornGlowMat = getMat('drg_horn_glow', () =>
    new THREE.MeshStandardMaterial({
      color: 0xfdba74,
      emissive: 0xea580c,
      emissiveIntensity: 2.0,
      roughness: 0.24
    })
  );

  // Sculpted dragon skull & upper snout
  const skull = new THREE.Mesh(getGeo('drg_skull', () => new THREE.BoxGeometry(0.62, 0.46, 0.58)), obsMat);
  skull.position.set(0, 0.48, 0.02);
  const snout = new THREE.Mesh(getGeo('drg_snout', () => new THREE.BoxGeometry(0.44, 0.24, 0.48)), obsMat);
  snout.position.set(0, 0.44, 0.42);
  snout.rotation.x = 0.12;

  // Wide-open lower jaw + glowing molten lava throat interior!
  const lowerJaw = new THREE.Mesh(getGeo('drg_jaw_low', () => new THREE.BoxGeometry(0.40, 0.16, 0.46)), obsMat);
  lowerJaw.position.set(0, 0.18, 0.38);
  lowerJaw.rotation.x = 0.36;

  const lavaCore = new THREE.Mesh(getGeo('drg_maw_fire', () => new THREE.SphereGeometry(0.21, 10, 10)), lavaMawMat);
  lavaCore.scale.set(0.92, 0.85, 1.25);
  lavaCore.position.set(0, 0.30, 0.36);

  grp.add(skull, snout, lowerJaw, lavaCore);
  grp.add(createGlowingEyePair(0xff7a00, 0.20, 0.52, 0.34, 1.42, 0.70));

  // Jagged dragon fangs framing the molten maw
  const toothGeo = getGeo('drg_tooth', () => new THREE.ConeGeometry(0.038, 0.12, 5));
  for (const sx of [-0.15, -0.06, 0.06, 0.15]) {
    const upT = new THREE.Mesh(toothGeo, obsMat);
    upT.rotation.x = Math.PI;
    upT.position.set(sx, 0.33, 0.56);
    const dnT = new THREE.Mesh(toothGeo, obsMat);
    dnT.position.set(sx, 0.22, 0.53);
    dnT.rotation.x = 0.32;
    grp.add(upT, dnT);
  }

  // 4 Swept-back horned dragon crests with glowing magma tips
  for (const sx of [-1, 1]) {
    const mainHorn = new THREE.Mesh(
      getGeo('drg_main_horn', () => new THREE.ConeGeometry(0.095, 0.62, 7)),
      obsMat
    );
    mainHorn.position.set(sx * 0.28, 0.84, -0.14);
    mainHorn.rotation.x = -0.58;
    mainHorn.rotation.z = -sx * 0.34;

    const hornTip = new THREE.Mesh(
      getGeo('drg_horn_tip', () => new THREE.ConeGeometry(0.065, 0.28, 6)),
      hornGlowMat
    );
    hornTip.position.set(sx * 0.36, 1.06, -0.28);
    hornTip.rotation.x = -0.58;
    hornTip.rotation.z = -sx * 0.34;

    const cheekFin = new THREE.Mesh(
      getGeo('drg_cheek_fin', () => new THREE.ConeGeometry(0.065, 0.34, 5)),
      hornGlowMat
    );
    cheekFin.position.set(sx * 0.38, 0.44, -0.06);
    cheekFin.rotation.z = -sx * 1.15;
    cheekFin.rotation.y = -sx * 0.45;
    grp.add(mainHorn, hornTip, cheekFin);
  }

  return grp;
}

function createDragonTailWithFlame() {
  const piv = new THREE.Group();
  const obsMat = getMat('drg_obsidian', () =>
    new THREE.MeshStandardMaterial({ color: 0x1c191e, roughness: 0.46, metalness: 0.34 })
  );
  const flameOuterMat = getMat('drg_tail_flame_out', () =>
    new THREE.MeshStandardMaterial({
      color: 0xff6a00,
      emissive: 0xff4500,
      emissiveIntensity: 2.5,
      roughness: 0.18
    })
  );
  const flameCoreMat = getMat('drg_tail_flame_in', () =>
    new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfacc15,
      emissiveIntensity: 2.8,
      roughness: 0.12
    })
  );

  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.05, -0.20),
    new THREE.Vector3(0.18, -0.18, -0.62),
    new THREE.Vector3(0.46, -0.12, -0.92),
    new THREE.Vector3(0.62, 0.24, -0.98)
  ]);
  const tailMesh = new THREE.Mesh(
    getGeo('drg_tail_tube', () => new THREE.TubeGeometry(curve, 14, 0.115, 8, false)),
    obsMat
  );
  const flamePlume = new THREE.Mesh(
    getGeo('drg_tail_plume', () => new THREE.ConeGeometry(0.18, 0.48, 7)),
    flameOuterMat
  );
  flamePlume.position.set(0.64, 0.44, -0.98);
  const flameInner = new THREE.Mesh(
    getGeo('drg_tail_plume_in', () => new THREE.ConeGeometry(0.10, 0.32, 6)),
    flameCoreMat
  );
  flameInner.position.set(0.64, 0.40, -0.96);
  piv.add(tailMesh, flamePlume, flameInner);
  return piv;
}

function createSpikedPauldronsAndMoltenCore(withMoltenCore = true) {
  const grp = new THREE.Group();
  const darkIron = getMat('sp_dark_iron', () =>
    new THREE.MeshStandardMaterial({ color: 0x2d292e, metalness: 0.78, roughness: 0.34 })
  );
  const boneSpikeMat = getMat('sp_bone_spike', () =>
    new THREE.MeshStandardMaterial({ color: 0xd6cbb8, roughness: 0.45, metalness: 0.12 })
  );
  for (const sx of [-1, 1]) {
    const pad = new THREE.Mesh(
      getGeo('sp_pad_dome', () => new THREE.SphereGeometry(0.28, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.56)),
      darkIron
    );
    pad.position.set(sx * 0.45, 0.36, 0.02);
    pad.rotation.z = -sx * 0.45;
    const sp1 = new THREE.Mesh(getGeo('sp_cone_a', () => new THREE.ConeGeometry(0.065, 0.26, 6)), boneSpikeMat);
    sp1.position.set(sx * 0.54, 0.56, 0.02);
    sp1.rotation.z = -sx * 0.35;
    const sp2 = new THREE.Mesh(getGeo('sp_cone_b', () => new THREE.ConeGeometry(0.052, 0.20, 6)), boneSpikeMat);
    sp2.position.set(sx * 0.64, 0.42, 0.04);
    sp2.rotation.z = -sx * 0.85;
    grp.add(pad, sp1, sp2);
  }

  if (withMoltenCore) {
    const magmaMat = getMat('molten_fissure_mat', () =>
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xff5500,
        emissiveIntensity: 2.75,
        roughness: 0.16
      })
    );
    const fissureV = new THREE.Mesh(
      getGeo('molten_fissure_v', () => new THREE.OctahedronGeometry(0.15, 0)),
      magmaMat
    );
    fissureV.scale.set(0.62, 1.85, 0.45);
    fissureV.position.set(0, 0.18, 0.24);
    grp.add(fissureV);
    const ribGeo = getGeo('molten_fissure_rib', () => new THREE.BoxGeometry(0.22, 0.032, 0.04));
    for (let r = -1; r <= 1; r++) {
      for (const sx of [-1, 1]) {
        const vein = new THREE.Mesh(ribGeo, magmaMat);
        vein.position.set(sx * 0.12, 0.18 + r * 0.08, 0.23);
        vein.rotation.z = -sx * 0.28;
        grp.add(vein);
      }
    }
  }
  return grp;
}

function createArchlichDarkCrown() {
  const grp = new THREE.Group();
  const darkCrownMat = getMat('lich_dark_iron', () =>
    new THREE.MeshStandardMaterial({ color: 0x261d34, metalness: 0.82, roughness: 0.28 })
  );
  const violetGemMat = getMat('lich_violet_gem', () =>
    new THREE.MeshStandardMaterial({
      color: 0xf5d0fe,
      emissive: 0xa855f7,
      emissiveIntensity: 2.6,
      roughness: 0.15
    })
  );
  const circlet = new THREE.Mesh(
    getGeo('lich_crown_band', () => new THREE.CylinderGeometry(0.45, 0.41, 0.20, 14)),
    darkCrownMat
  );
  circlet.position.y = 0.78;
  grp.add(circlet);

  const tallSp = getGeo('lich_sp_tall', () => new THREE.ConeGeometry(0.09, 0.56, 4));
  const midSp = getGeo('lich_sp_mid', () => new THREE.ConeGeometry(0.068, 0.34, 4));
  const gemGeo = getGeo('lich_gem_oct', () => new THREE.OctahedronGeometry(0.075, 0));

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const isFront = i === 0;
    const isTall = i % 2 === 0;
    const sp = new THREE.Mesh(isTall ? tallSp : midSp, darkCrownMat);
    sp.position.set(Math.sin(a) * 0.41, 0.96 + (isTall ? 0.16 : 0.04) + (isFront ? 0.12 : 0), Math.cos(a) * 0.41);
    if (isFront) sp.scale.set(1.28, 1.32, 1.28);
    sp.rotation.y = a;
    grp.add(sp);
    if (isTall) {
      const gm = new THREE.Mesh(gemGeo, violetGemMat);
      gm.scale.set(0.8, 1.35, 0.6);
      gm.position.set(Math.sin(a) * 0.44, 0.84, Math.cos(a) * 0.44);
      grp.add(gm);
    }
  }
  return grp;
}

function createArchlichCollar() {
  const grp = new THREE.Group();
  const robeMat = getMat('lich_collar_robe', () =>
    new THREE.MeshStandardMaterial({ color: 0x4c1d95, roughness: 0.58, metalness: 0.15, side: THREE.DoubleSide })
  );
  const trimMat = getMat('lich_dark_iron', () =>
    new THREE.MeshStandardMaterial({ color: 0x261d34, metalness: 0.82, roughness: 0.28 })
  );
  const gemMat = getMat('lich_violet_gem', () =>
    new THREE.MeshStandardMaterial({ color: 0xf5d0fe, emissive: 0xa855f7, emissiveIntensity: 2.6, roughness: 0.15 })
  );
  const collarCone = new THREE.Mesh(
    getGeo('lich_high_collar', () => new THREE.CylinderGeometry(0.58, 0.34, 0.38, 12, 1, true, Math.PI * 0.55, Math.PI * 0.9)),
    robeMat
  );
  collarCone.position.set(0, 0.46, -0.04);
  grp.add(collarCone);

  for (const sx of [-1, 1]) {
    const wingPad = new THREE.Mesh(getGeo('lich_sh_pad', () => new THREE.ConeGeometry(0.24, 0.48, 5)), trimMat);
    wingPad.position.set(sx * 0.48, 0.42, 0.02);
    wingPad.rotation.z = -sx * 1.18;
    const clasp = new THREE.Mesh(getGeo('lich_clasp_gem', () => new THREE.SphereGeometry(0.085, 8, 8)), gemMat);
    clasp.position.set(sx * 0.24, 0.32, 0.22);
    grp.add(wingPad, clasp);
  }
  return grp;
}

function createHandSpellOrb(coreHex = 0xf5d0fe, glowHex = 0xa855f7) {
  const grp = new THREE.Group();
  const coreMat = getMat(`orb_core_${coreHex}_${glowHex}`, () =>
    new THREE.MeshStandardMaterial({
      color: coreHex,
      emissive: glowHex,
      emissiveIntensity: 2.8,
      roughness: 0.12
    })
  );
  const auraMat = getMat(`orb_aura_${glowHex}`, () =>
    new THREE.MeshBasicMaterial({
      color: glowHex,
      transparent: true,
      opacity: 0.52,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    })
  );
  const core = new THREE.Mesh(getGeo('hand_orb_core', () => new THREE.SphereGeometry(0.15, 12, 12)), coreMat);
  const flame = new THREE.Mesh(getGeo('hand_orb_flame', () => new THREE.ConeGeometry(0.16, 0.38, 7)), auraMat);
  flame.position.y = 0.14;
  grp.add(core, flame);
  grp.position.set(0, 0.16, 0.14);
  return grp;
}

function createMoltenRibcageAndSkullPads() {
  const grp = new THREE.Group();
  const coreMat = getMat('ember_skel_core', () =>
    new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xff5a00,
      emissiveIntensity: 2.9,
      roughness: 0.15
    })
  );
  const boneMat = getMat('ember_skel_pad_bone', () =>
    new THREE.MeshStandardMaterial({ color: 0xe7dfd3, roughness: 0.52, metalness: 0.08 })
  );
  const heart = new THREE.Mesh(
    getGeo('ember_rib_heart', () => new THREE.SphereGeometry(0.18, 10, 10)),
    coreMat
  );
  heart.scale.set(0.95, 1.25, 0.78);
  heart.position.set(0, 0.19, 0.10);
  grp.add(heart);

  // Twin bone skull pauldrons on shoulders (matches ad09b7c9.jpg!)
  const skullPadGeo = getGeo('ember_skull_pad', () => new THREE.SphereGeometry(0.19, 10, 10));
  for (const sx of [-1, 1]) {
    const sk = new THREE.Mesh(skullPadGeo, boneMat);
    sk.scale.set(1.0, 1.08, 0.92);
    sk.position.set(sx * 0.41, 0.34, 0.02);
    grp.add(sk);
  }
  grp.userData.heart = heart;
  return grp;
}

function createCultistHoodAndSkullClasp() {
  const headGrp = new THREE.Group();
  const chestGrp = new THREE.Group();
  const hoodMat = getMat('cult_purple_hood', () =>
    new THREE.MeshStandardMaterial({ color: 0x4c1d95, roughness: 0.68, metalness: 0.08 })
  );
  const goldTrim = getMat('cult_gold_trim', () =>
    new THREE.MeshStandardMaterial({ color: 0xd99b26, metalness: 0.82, roughness: 0.28 })
  );
  const darkVoid = getMat('cult_hood_void', () =>
    new THREE.MeshBasicMaterial({ color: 0x090514 })
  );
  const boneMat = getMat('ember_skel_pad_bone', () =>
    new THREE.MeshStandardMaterial({ color: 0xe7dfd3, roughness: 0.52, metalness: 0.08 })
  );

  const cowl = new THREE.Mesh(
    getGeo('cult_cowl_dome', () => new THREE.SphereGeometry(0.49, 12, 10)),
    hoodMat
  );
  cowl.scale.set(1.04, 1.08, 1.08);
  cowl.position.set(0, 0.48, -0.02);

  const peak = new THREE.Mesh(
    getGeo('cult_cowl_peak', () => new THREE.ConeGeometry(0.32, 0.52, 8)),
    hoodMat
  );
  peak.position.set(0, 0.92, -0.10);
  peak.rotation.x = -0.32;

  const rim = new THREE.Mesh(
    getGeo('cult_cowl_rim', () => new THREE.TorusGeometry(0.38, 0.045, 7, 16)),
    goldTrim
  );
  rim.position.set(0, 0.44, 0.26);

  const shadowFace = new THREE.Mesh(
    getGeo('cult_void_face', () => new THREE.SphereGeometry(0.35, 10, 10)),
    darkVoid
  );
  shadowFace.position.set(0, 0.44, 0.16);

  headGrp.add(cowl, peak, rim, shadowFace);
  headGrp.add(createGlowingEyePair(0xd946ef, 0.145, 0.44, 0.48, 1.35, 0.72));

  const skullClasp = new THREE.Mesh(
    getGeo('cult_skull_clasp', () => new THREE.SphereGeometry(0.12, 8, 8)),
    boneMat
  );
  skullClasp.position.set(0, 0.34, 0.24);
  chestGrp.add(skullClasp);
  return { headGrp, chestGrp };
}

function createMummyHeadAndCollar() {
  const headGrp = new THREE.Group();
  const chestGrp = new THREE.Group();
  const linenMat = getMat('mum_linen', () =>
    new THREE.MeshStandardMaterial({ color: 0xd9c79e, roughness: 0.85, metalness: 0.04 })
  );
  const darkSlit = getMat('cult_hood_void', () => new THREE.MeshBasicMaterial({ color: 0x0b131e }));
  const goldMat = getMat('mum_pharaoh_gold', () =>
    new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.86, roughness: 0.22 })
  );
  const turqMat = getMat('mum_pharaoh_turq', () =>
    new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0891b2, emissiveIntensity: 0.85, roughness: 0.25 })
  );

  const wrapSkull = new THREE.Mesh(
    getGeo('mum_wrap_dome', () => new THREE.SphereGeometry(0.45, 12, 10)),
    linenMat
  );
  wrapSkull.position.set(0, 0.44, 0.02);
  const bandTop = new THREE.Mesh(
    getGeo('mum_band_top', () => new THREE.CylinderGeometry(0.45, 0.46, 0.16, 12)),
    linenMat
  );
  bandTop.position.set(0, 0.60, 0.02);
  bandTop.rotation.z = 0.08;
  const bandLow = new THREE.Mesh(
    getGeo('mum_band_low', () => new THREE.CylinderGeometry(0.44, 0.42, 0.18, 12)),
    linenMat
  );
  bandLow.position.set(0, 0.24, 0.04);
  bandLow.rotation.z = -0.06;
  const eyeBand = new THREE.Mesh(
    getGeo('mum_eye_slit', () => new THREE.BoxGeometry(0.56, 0.14, 0.28)),
    darkSlit
  );
  eyeBand.position.set(0, 0.42, 0.30);

  headGrp.add(wrapSkull, bandTop, bandLow, eyeBand);
  headGrp.add(createGlowingEyePair(0x22d3ee, 0.15, 0.42, 0.46, 1.38, 0.72));

  // Broad Golden & Turquoise Pharaoh Collar
  const collarGold = new THREE.Mesh(
    getGeo('mum_collar_disc', () => new THREE.CylinderGeometry(0.46, 0.56, 0.10, 14)),
    goldMat
  );
  collarGold.position.set(0, 0.36, 0.02);
  const collarTurq = new THREE.Mesh(
    getGeo('mum_collar_ring', () => {
      const tg = new THREE.TorusGeometry(0.49, 0.045, 6, 16);
      tg.rotateX(Math.PI * 0.5);
      return tg;
    }),
    turqMat
  );
  collarTurq.position.set(0, 0.35, 0.03);
  chestGrp.add(collarGold, collarTurq);
  return { headGrp, chestGrp };
}

function createVampireHeadAndCape() {
  const headGrp = new THREE.Group();
  const chestGrp = new THREE.Group();
  const paleMat = getMat('vamp_pale_skin', () =>
    new THREE.MeshStandardMaterial({ color: 0xd8d8e2, roughness: 0.55, metalness: 0.05 })
  );
  const hairMat = getMat('vamp_black_hair', () =>
    new THREE.MeshStandardMaterial({ color: 0x111116, roughness: 0.42, metalness: 0.18 })
  );
  const crimsonMat = getMat('vamp_crimson_cloth', () =>
    new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.58, metalness: 0.08, side: THREE.DoubleSide })
  );

  const headSphere = new THREE.Mesh(
    getGeo('cmh_cranium', () => new THREE.SphereGeometry(0.43, 14, 12)),
    paleMat
  );
  headSphere.position.set(0, 0.42, 0.02);

  // Slicked-back black hair dome + widow's peak on forehead
  const hairDome = new THREE.Mesh(
    getGeo('vamp_hair_dome', () => new THREE.SphereGeometry(0.455, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.56)),
    hairMat
  );
  hairDome.position.set(0, 0.46, -0.02);
  hairDome.rotation.x = -0.22;
  const widowPeak = new THREE.Mesh(
    getGeo('vamp_widow_peak', () => new THREE.ConeGeometry(0.11, 0.20, 4)),
    hairMat
  );
  widowPeak.rotation.x = Math.PI;
  widowPeak.position.set(0, 0.62, 0.39);

  const earGeo = getGeo('vamp_ear', () => new THREE.ConeGeometry(0.09, 0.30, 5));
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(earGeo, paleMat);
    ear.position.set(sx * 0.46, 0.43, 0.02);
    ear.rotation.z = -sx * 1.15;
    headGrp.add(ear);
  }

  headGrp.add(headSphere, hairDome, widowPeak);
  headGrp.add(createGlowingEyePair(0xff1e1e, 0.15, 0.41, 0.44, 1.32, 0.72));

  // Upstanding Crimson Vampire Collar + Crimson Waistcoat
  const highCollar = new THREE.Mesh(
    getGeo('vamp_collar', () => new THREE.CylinderGeometry(0.52, 0.32, 0.36, 12, 1, true, Math.PI * 0.52, Math.PI * 0.96)),
    crimsonMat
  );
  highCollar.position.set(0, 0.46, -0.05);
  const vest = new THREE.Mesh(
    getGeo('vamp_vest', () => new THREE.BoxGeometry(0.36, 0.36, 0.08)),
    crimsonMat
  );
  vest.position.set(0, 0.18, 0.21);
  chestGrp.add(highCollar, vest);
  return { headGrp, chestGrp };
}

function createIronTowerShield() {
  const grp = new THREE.Group();
  const plateMat = getMat('ts_rusted_plate', () =>
    new THREE.MeshStandardMaterial({ color: 0x4b423b, metalness: 0.72, roughness: 0.42 })
  );
  const rimMat = getMat('ts_rusted_rim', () =>
    new THREE.MeshStandardMaterial({ color: 0x78716c, metalness: 0.80, roughness: 0.32 })
  );
  const mainPlate = new THREE.Mesh(getGeo('ts_body', () => new THREE.BoxGeometry(0.64, 0.86, 0.075)), plateMat);
  const borderV = new THREE.Mesh(getGeo('ts_border_v', () => new THREE.BoxGeometry(0.70, 0.90, 0.045)), rimMat);
  borderV.position.z = -0.015;
  const boss = new THREE.Mesh(getGeo('skel_buckler_boss', () => new THREE.SphereGeometry(0.11, 8, 8)), rimMat);
  boss.position.set(0, 0.06, 0.055);
  grp.add(mainPlate, borderV, boss);
  grp.position.set(0.08, 0.04, 0.16);
  grp.rotation.y = 0.18;
  return grp;
}

function makeEnemyWeaponProp(kind) {
  const g = new THREE.Group();
  const darkWoodMat = getMat('ew_wood', () => new THREE.MeshStandardMaterial({ color: 0x452b1a, roughness: 0.78, metalness: 0.08 }));
  const darkIronMat = getMat('ew_dark_iron', () => new THREE.MeshStandardMaterial({ color: 0x333842, metalness: 0.80, roughness: 0.32 }));
  const stoneMat = getMat('ew_stone', () => new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.72, metalness: 0.18 }));
  const steelMat = getMat('ew_steel', () => new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.82, roughness: 0.26 }));
  const goldMat = getMat('ew_gold', () => new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.88, roughness: 0.20 }));
  const boneMat = getMat('ew_bone', () => new THREE.MeshStandardMaterial({ color: 0xe2dacb, roughness: 0.50, metalness: 0.08 }));

  if (kind === 'goblin_stone_axe') {
    const shaft = new THREE.Mesh(getGeo('ga_shaft', () => new THREE.CylinderGeometry(0.042, 0.048, 0.92, 7)), darkWoodMat);
    shaft.position.y = 0.34;
    const headStone = new THREE.Mesh(getGeo('ga_stone', () => new THREE.BoxGeometry(0.42, 0.26, 0.11)), stoneMat);
    headStone.position.set(0.10, 0.68, 0);
    const edge = new THREE.Mesh(getGeo('ga_edge', () => new THREE.BoxGeometry(0.12, 0.32, 0.06)), steelMat);
    edge.position.set(0.28, 0.68, 0);
    const wrap = new THREE.Mesh(getGeo('ga_wrap', () => new THREE.BoxGeometry(0.15, 0.14, 0.14)), darkWoodMat);
    wrap.position.set(0, 0.68, 0);
    g.add(shaft, headStone, edge, wrap);
    g.rotation.y = Math.PI * 0.5;
    return g;
  }

  if (kind === 'mummy_crescent_staff') {
    const pole = new THREE.Mesh(getGeo('mc_pole', () => new THREE.CylinderGeometry(0.040, 0.048, 1.68, 8)), goldMat);
    pole.position.y = 0.58;
    const collar = new THREE.Mesh(getGeo('mc_collar', () => new THREE.CylinderGeometry(0.09, 0.06, 0.14, 8)), goldMat);
    collar.position.y = 1.38;
    const crescent = new THREE.Mesh(
      getGeo('mc_crescent', () => new THREE.TorusGeometry(0.23, 0.052, 8, 18, Math.PI * 1.42)),
      goldMat
    );
    crescent.position.set(0.04, 1.62, 0);
    crescent.rotation.z = 0.42;
    g.add(pole, collar, crescent);
    return g;
  }

  if (kind === 'cultist_skull_staff' || kind === 'archlich_violet_staff') {
    const isBoss = kind === 'archlich_violet_staff';
    const poleH = isBoss ? 1.98 : 1.62;
    const pole = new THREE.Mesh(
      getGeo(isBoss ? 'cs_pole_boss' : 'cs_pole', () => new THREE.CylinderGeometry(0.042, 0.054, poleH, 8)),
      isBoss ? darkIronMat : darkWoodMat
    );
    pole.position.y = poleH * 0.36;

    const skull = new THREE.Mesh(getGeo('ns_skull', () => new THREE.SphereGeometry(0.15, 10, 10)), boneMat);
    skull.scale.set(0.96, 1.12, 0.96);
    skull.position.y = poleH * 0.80;

    const violetMat = getMat('cs_violet_flame', () =>
      new THREE.MeshStandardMaterial({
        color: 0xf5d0fe,
        emissive: 0xa855f7,
        emissiveIntensity: 2.5,
        roughness: 0.14
      })
    );
    const orb = new THREE.Mesh(
      getGeo(isBoss ? 'cs_orb_boss' : 'cs_orb', () => new THREE.SphereGeometry(isBoss ? 0.21 : 0.14, 10, 10)),
      violetMat
    );
    orb.position.y = poleH * 0.80 + (isBoss ? 0.30 : 0.20);
    const flameTip = new THREE.Mesh(
      getGeo('cs_flame_cone', () => new THREE.ConeGeometry(isBoss ? 0.20 : 0.12, isBoss ? 0.42 : 0.26, 7)),
      violetMat
    );
    flameTip.position.y = orb.position.y + (isBoss ? 0.20 : 0.12);
    g.add(pole, skull, orb, flameTip);
    if (isBoss) {
      for (const sx of [-1, 1]) {
        const prong = new THREE.Mesh(getGeo('cs_prong', () => new THREE.ConeGeometry(0.055, 0.46, 5)), darkIronMat);
        prong.position.set(sx * 0.22, orb.position.y + 0.02, 0);
        prong.rotation.z = -sx * 0.28;
        g.add(prong);
      }
    }
    return g;
  }

  if (kind === 'ogre_colossal_warhammer') {
    // Act IV Boss «Огр-Костолом» Colossal Forged Iron Warhammer (matches ad09b7c9.jpg #4!)
    const shaft = new THREE.Mesh(
      getGeo('og_wh_shaft', () => new THREE.CylinderGeometry(0.056, 0.064, 1.85, 8)),
      darkWoodMat
    );
    shaft.position.y = 0.68;
    const gripBand = new THREE.Mesh(
      getGeo('og_wh_collar', () => new THREE.CylinderGeometry(0.10, 0.09, 0.20, 8)),
      darkIronMat
    );
    gripBand.position.y = 1.32;
    const headBlock = new THREE.Mesh(
      getGeo('og_wh_head', () => new THREE.BoxGeometry(0.78, 0.44, 0.42)),
      darkIronMat
    );
    headBlock.position.y = 1.56;
    const steelFaces = new THREE.Mesh(
      getGeo('og_wh_faces', () => new THREE.BoxGeometry(0.84, 0.36, 0.36)),
      steelMat
    );
    steelFaces.position.y = 1.56;
    const midStrap = new THREE.Mesh(
      getGeo('og_wh_strap', () => new THREE.BoxGeometry(0.24, 0.48, 0.46)),
      steelMat
    );
    midStrap.position.y = 1.56;
    g.add(shaft, gripBand, headBlock, steelFaces, midStrap);
    g.rotation.y = Math.PI * 0.5;
    return g;
  }

  if (kind === 'demon_magma_greatsword') {
    // Act I Boss «Демон Преисподней» Blazing Magma Greatsword (matches ad09b7c9.jpg #1!)
    const hilt = new THREE.Mesh(
      getGeo('mg_hilt', () => new THREE.CylinderGeometry(0.055, 0.062, 0.48, 8)),
      darkIronMat
    );
    hilt.position.y = 0.05;
    const guard = new THREE.Mesh(
      getGeo('mg_guard', () => new THREE.BoxGeometry(0.68, 0.13, 0.16)),
      darkIronMat
    );
    guard.position.y = 0.28;
    const skullGuard = new THREE.Mesh(getGeo('ns_skull', () => new THREE.SphereGeometry(0.14, 9, 9)), boneMat);
    skullGuard.position.set(0, 0.29, 0.06);

    const obsidianCore = new THREE.Mesh(
      getGeo('mg_core_blade', () => new THREE.BoxGeometry(0.22, 1.54, 0.075)),
      getMat('mg_obs_mat', () =>
        new THREE.MeshStandardMaterial({ color: 0x290909, emissive: 0x9a3412, emissiveIntensity: 0.75, metalness: 0.72, roughness: 0.3 })
      )
    );
    obsidianCore.position.y = 1.10;

    const magmaEdgeMat = getMat('mg_magma_edge', () =>
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xff4500,
        emissiveIntensity: 2.6,
        roughness: 0.16
      })
    );
    const flameBlade = new THREE.Mesh(
      getGeo('mg_flame_blade', () => new THREE.BoxGeometry(0.38, 1.50, 0.044)),
      magmaEdgeMat
    );
    flameBlade.position.y = 1.10;
    const flameTip = new THREE.Mesh(
      getGeo('mg_flame_tip', () => {
        const cg = new THREE.ConeGeometry(0.22, 0.42, 4);
        cg.rotateY(Math.PI / 4);
        return cg;
      }),
      magmaEdgeMat
    );
    flameTip.scale.set(1, 1, 0.32);
    flameTip.position.y = 2.04;

    g.add(hilt, guard, skullGuard, obsidianCore, flameBlade, flameTip);
    g.rotation.x = 0.22;
    g.rotation.y = Math.PI * 0.5;
    return g;
  }

  // Default 'bone_sword' / 'broadsword'
  const isBroad = kind === 'broadsword';
  const bladeLen = isBroad ? 0.98 : 0.86;
  const bladeW = isBroad ? 0.16 : 0.12;
  const grip = new THREE.Mesh(getGeo('ew_sw_grip', () => new THREE.CylinderGeometry(0.038, 0.042, 0.26, 8)), darkWoodMat);
  const cross = new THREE.Mesh(getGeo('ew_sw_cross', () => new THREE.BoxGeometry(isBroad ? 0.30 : 0.24, 0.06, 0.09)), darkIronMat);
  cross.position.y = 0.14;
  const blade = new THREE.Mesh(
    getGeo(`eblade_v3_${kind}`, () => new THREE.BoxGeometry(bladeW, bladeLen, 0.040)),
    isBroad ? steelMat : boneMat
  );
  blade.position.y = bladeLen * 0.5 + 0.17;
  g.add(grip, cross, blade);
  g.rotation.x = 0.25;
  g.rotation.y = Math.PI * 0.5;
  return g;
}

// ============================================================================
// Custom Multi-Part Animated 3D Creature Rigs (Spider, Slime, Ghost, Wisp, Mimic, Treant)
// ============================================================================
function buildProceduralMonsterRig(rigType, scale = 1.0, flashSlots = []) {
  const grp = new THREE.Group();
  grp.scale.setScalar(scale);

  const regMesh = (mesh, skipFlash = false) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (!skipFlash && mesh.material) {
      flashSlots.push({ mesh, origMat: mesh.material });
    }
    return mesh;
  };

  let attackTimer = 0;

  if (rigType === 'dark_spider') {
    const bodyGrp = new THREE.Group();
    bodyGrp.position.y = 0.42;
    grp.add(bodyGrp);

    const chitinMat = getMat('spid_chitin', () =>
      new THREE.MeshStandardMaterial({ color: 0x1c1e26, roughness: 0.46, metalness: 0.26 })
    );
    const legMat = getMat('spid_leg', () =>
      new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.42, metalness: 0.30 })
    );
    const redEyeMat = getMat('spid_red_eye', () =>
      new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff0000, emissiveIntensity: 3.0, roughness: 0.12 })
    );

    const abdomen = regMesh(new THREE.Mesh(getGeo('spid_abd', () => new THREE.SphereGeometry(0.46, 14, 12)), chitinMat));
    abdomen.scale.set(1.06, 0.88, 1.24);
    abdomen.position.set(0, 0.10, -0.34);

    const head = regMesh(new THREE.Mesh(getGeo('spid_head', () => new THREE.SphereGeometry(0.32, 12, 10)), chitinMat));
    head.scale.set(1.05, 0.85, 1.02);
    head.position.set(0, 0.0, 0.24);
    bodyGrp.add(abdomen, head);

    // Cluster of 6 glowing crimson spider eyes!
    const mainEyeGeo = getGeo('spid_eye_lg', () => new THREE.SphereGeometry(0.056, 8, 8));
    const subEyeGeo = getGeo('spid_eye_sm', () => new THREE.SphereGeometry(0.036, 7, 7));
    const eyeSpecs = [
      [-0.10, 0.04, 0.52, mainEyeGeo],
      [0.10, 0.04, 0.52, mainEyeGeo],
      [-0.20, 0.07, 0.46, subEyeGeo],
      [0.20, 0.07, 0.46, subEyeGeo],
      [-0.06, 0.13, 0.49, subEyeGeo],
      [0.06, 0.13, 0.49, subEyeGeo]
    ];
    for (const [ex, ey, ez, eg] of eyeSpecs) {
      const em = regMesh(new THREE.Mesh(eg, redEyeMat), true);
      em.position.set(ex, ey, ez);
      bodyGrp.add(em);
    }

    // 2 Snapping Front Fangs (Chelicerae)
    const fangGeo = getGeo('spid_fang', () => new THREE.ConeGeometry(0.048, 0.22, 6));
    const fangs = [];
    for (const sx of [-1, 1]) {
      const f = regMesh(new THREE.Mesh(fangGeo, legMat));
      f.position.set(sx * 0.12, -0.10, 0.52);
      f.rotation.x = Math.PI * 0.78;
      f.rotation.z = sx * 0.25;
      bodyGrp.add(f);
      fangs.push({ mesh: f, sx });
    }

    // 8 Articulated 2-Segment Spider Legs
    const femurGeo = getGeo('spid_femur', () => {
      const cg = new THREE.CylinderGeometry(0.042, 0.052, 0.56, 7);
      cg.translate(0, 0.28, 0);
      return cg;
    });
    const tibiaGeo = getGeo('spid_tibia', () => {
      const cg = new THREE.ConeGeometry(0.044, 0.68, 7);
      cg.rotateX(Math.PI);
      cg.translate(0, -0.34, 0);
      return cg;
    });
    const legs = [];
    const legZ = [0.24, 0.07, -0.10, -0.27];
    const legYaw = [0.58, 0.18, -0.22, -0.62];
    for (let li = 0; li < 4; li++) {
      for (const sx of [-1, 1]) {
        const hip = new THREE.Group();
        hip.position.set(sx * 0.24, -0.02, legZ[li]);
        hip.rotation.y = sx * legYaw[li];

        const femur = regMesh(new THREE.Mesh(femurGeo, legMat));
        femur.rotation.z = -sx * 0.96;

        const knee = new THREE.Group();
        knee.position.set(sx * 0.46, 0.31, 0);
        const tibia = regMesh(new THREE.Mesh(tibiaGeo, legMat));
        tibia.rotation.z = -sx * 0.32;
        knee.add(tibia);

        hip.add(femur, knee);
        bodyGrp.add(hip);
        legs.push({ hip, baseYaw: sx * legYaw[li], sx, phase: (li % 2 === 0 ? 0 : Math.PI) + (sx < 0 ? Math.PI : 0) });
      }
    }

    return {
      root: grp,
      triggerAttack() { attackTimer = 0.26; },
      update(dt, t, isDying) {
        if (isDying) return;
        if (attackTimer > 0) attackTimer = Math.max(0, attackTimer - dt);
        const atkSnap = attackTimer > 0 ? Math.sin((attackTimer / 0.26) * Math.PI) : 0;
        bodyGrp.position.y = 0.42 + Math.sin(t * 16) * 0.03 + atkSnap * 0.12;
        for (let i = 0; i < legs.length; i++) {
          const lg = legs[i];
          const cyc = Math.sin(t * 17.0 + lg.phase);
          lg.hip.rotation.y = lg.baseYaw + cyc * 0.26;
          lg.hip.rotation.z = lg.sx * Math.max(0, cyc) * 0.18;
        }
        for (const fg of fangs) {
          fg.mesh.rotation.z = fg.sx * (0.25 - atkSnap * 0.55);
        }
      }
    };
  }

  if (rigType === 'toxic_slime') {
    const slimeMat = getMat('slime_purple', () =>
      new THREE.MeshStandardMaterial({ color: 0x3b1d5e, roughness: 0.16, metalness: 0.12 })
    );
    const acidGlowMat = getMat('slime_acid_glow', () =>
      new THREE.MeshStandardMaterial({ color: 0x86efac, emissive: 0x22c55e, emissiveIntensity: 3.0, roughness: 0.12 })
    );
    const cavityMat = getMat('slime_cavity', () =>
      new THREE.MeshStandardMaterial({ color: 0x150826, roughness: 0.8 })
    );
    const boneMat = getMat('ew_bone', () =>
      new THREE.MeshStandardMaterial({ color: 0xe2dacb, roughness: 0.5, metalness: 0.08 })
    );

    const jelly = new THREE.Group();
    grp.add(jelly);

    const puddle = regMesh(new THREE.Mesh(getGeo('slime_puddle', () => new THREE.CylinderGeometry(0.62, 0.78, 0.22, 16)), slimeMat));
    puddle.position.y = 0.11;
    const dome = regMesh(new THREE.Mesh(getGeo('slime_dome', () => new THREE.SphereGeometry(0.58, 16, 14)), slimeMat));
    dome.scale.set(1.02, 1.18, 0.98);
    dome.position.y = 0.56;
    jelly.add(puddle, dome);

    // Glossy ooze blisters around base
    const blisterGeo = getGeo('slime_blister', () => new THREE.SphereGeometry(0.18, 10, 10));
    for (let b = 0; b < 6; b++) {
      const a = (b / 6) * Math.PI * 2 + 0.3;
      const bl = regMesh(new THREE.Mesh(blisterGeo, slimeMat));
      bl.position.set(Math.cos(a) * 0.56, 0.18 + (b % 2) * 0.12, Math.sin(a) * 0.54);
      jelly.add(bl);
    }

    // Protruding pale bones sticking out of the ooze (matches ad09b7c9.jpg!)
    const topBone = regMesh(new THREE.Mesh(getGeo('slime_femur', () => new THREE.CylinderGeometry(0.045, 0.05, 0.42, 7)), boneMat));
    topBone.position.set(-0.22, 1.14, -0.04);
    topBone.rotation.z = 0.45;
    const sideBone = regMesh(new THREE.Mesh(getGeo('slime_rib', () => new THREE.ConeGeometry(0.055, 0.28, 6)), boneMat));
    sideBone.position.set(0.46, 0.62, 0.12);
    sideBone.rotation.z = -0.85;
    jelly.add(topBone, sideBone);

    // Glowing Toxic-Green Eyes & Jagged Acid Maw
    for (const sx of [-0.18, 0.18]) {
      const eye = regMesh(new THREE.Mesh(getGeo('slime_eye', () => new THREE.SphereGeometry(0.085, 8, 8)), acidGlowMat), true);
      eye.scale.set(1.25, 0.82, 0.65);
      eye.position.set(sx, 0.78, 0.51);
      eye.rotation.z = sx < 0 ? -0.25 : 0.25;
      jelly.add(eye);
    }
    const mawBack = regMesh(new THREE.Mesh(getGeo('slime_maw_back', () => new THREE.SphereGeometry(0.24, 10, 8)), cavityMat));
    mawBack.scale.set(1.25, 0.82, 0.45);
    mawBack.position.set(0, 0.48, 0.49);
    const mawGlow = regMesh(new THREE.Mesh(getGeo('slime_maw_glow', () => new THREE.SphereGeometry(0.20, 10, 8)), acidGlowMat), true);
    mawGlow.scale.set(1.20, 0.74, 0.42);
    mawGlow.position.set(0, 0.48, 0.51);
    jelly.add(mawBack, mawGlow);

    return {
      root: grp,
      triggerAttack() { attackTimer = 0.28; },
      update(dt, t, isDying) {
        if (isDying) return;
        if (attackTimer > 0) attackTimer = Math.max(0, attackTimer - dt);
        const sq = Math.sin(t * 9.5) * 0.11 + (attackTimer > 0 ? 0.18 : 0);
        jelly.scale.set(1 - sq * 0.55, 1 + sq, 1 - sq * 0.55);
      }
    };
  }

  if (rigType === 'phantom_ghost') {
    const floatGrp = new THREE.Group();
    floatGrp.position.y = 0.26;
    grp.add(floatGrp);

    const sheetMat = getMat('ghost_sheet', () =>
      new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        emissive: 0x64748b,
        emissiveIntensity: 0.36,
        roughness: 0.38,
        metalness: 0.04,
        side: THREE.DoubleSide
      })
    );
    const hollowMat = getMat('ghost_hollow', () => new THREE.MeshBasicMaterial({ color: 0x09090d }));
    const pupilMat = getMat('ghost_pupil', () =>
      new THREE.MeshStandardMaterial({ color: 0xffb703, emissive: 0xff6a00, emissiveIntensity: 2.9, roughness: 0.12 })
    );

    const ghostBodyGeo = getGeo('ghost_draped_sheet', () => {
      const g = new THREE.CylinderGeometry(0.36, 0.64, 1.08, 24, 10, true);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const vy = pos.getY(i); // -0.54 .. +0.54
        const vx = pos.getX(i);
        const vz = pos.getZ(i);
        const ang = Math.atan2(vz, vx);
        const bottomFactor = Math.max(0, (0.20 - vy) / 0.74);
        const ruffle = Math.sin(ang * 7) * 0.08 * bottomFactor;
        const scallopY = Math.cos(ang * 7) * 0.065 * bottomFactor;
        pos.setX(i, vx * (1 + ruffle));
        pos.setZ(i, vz * (1 + ruffle));
        pos.setY(i, vy + scallopY + 0.54);
      }
      g.computeVertexNormals();
      return g;
    });

    const sheet = regMesh(new THREE.Mesh(ghostBodyGeo, sheetMat));
    const headDome = regMesh(new THREE.Mesh(getGeo('ghost_head_cap', () => new THREE.SphereGeometry(0.365, 16, 12)), sheetMat));
    headDome.position.y = 1.06;
    floatGrp.add(sheet, headDome);

    // 2 Draped Ghost Arms
    const armGeo = getGeo('ghost_arm', () => new THREE.ConeGeometry(0.15, 0.44, 8));
    const arms = [];
    for (const sx of [-1, 1]) {
      const arm = regMesh(new THREE.Mesh(armGeo, sheetMat));
      arm.position.set(sx * 0.46, 0.72, 0.06);
      arm.rotation.z = sx * 2.15;
      arm.rotation.x = 0.25;
      floatGrp.add(arm);
      arms.push({ mesh: arm, sx });
    }

    // Dark oval eye sockets + glowing orange pupils + wailing open mouth (matches ad09b7c9.jpg!)
    for (const sx of [-0.14, 0.14]) {
      const sock = new THREE.Mesh(getGeo('ghost_sock', () => new THREE.SphereGeometry(0.085, 9, 9)), hollowMat);
      sock.scale.set(0.85, 1.35, 0.45);
      sock.position.set(sx, 0.98, 0.35);
      const pup = regMesh(new THREE.Mesh(getGeo('ghost_pup', () => new THREE.SphereGeometry(0.052, 8, 8)), pupilMat), true);
      pup.position.set(sx, 0.96, 0.38);
      floatGrp.add(sock, pup);
    }
    const wailMouth = new THREE.Mesh(getGeo('ghost_wail', () => new THREE.SphereGeometry(0.095, 9, 9)), hollowMat);
    wailMouth.scale.set(0.78, 1.48, 0.45);
    wailMouth.position.set(0, 0.72, 0.42);
    floatGrp.add(wailMouth);

    return {
      root: grp,
      triggerAttack() { attackTimer = 0.25; },
      update(dt, t, isDying) {
        if (isDying) return;
        if (attackTimer > 0) attackTimer = Math.max(0, attackTimer - dt);
        floatGrp.position.y = 0.24 + Math.sin(t * 4.4) * 0.10;
        floatGrp.rotation.z = Math.sin(t * 2.8) * 0.06;
        for (const a of arms) {
          a.mesh.rotation.z = a.sx * (2.15 + Math.sin(t * 5.2) * 0.16 - (attackTimer > 0 ? 0.45 : 0));
        }
      }
    };
  }

  if (rigType === 'vampire_bat') {
    const batGrp = new THREE.Group();
    batGrp.position.y = 1.05;
    grp.add(batGrp);

    const furMat = getMat('vbat_fur', () =>
      new THREE.MeshStandardMaterial({ color: 0x1e1429, roughness: 0.78, metalness: 0.12 })
    );
    const wingMat = getMat('vbat_wing', () =>
      new THREE.MeshStandardMaterial({ color: 0x4c1028, emissive: 0x881337, emissiveIntensity: 0.25, roughness: 0.55, side: THREE.DoubleSide })
    );
    const fangMat = getMat('vbat_fang', () =>
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 })
    );

    const torso = regMesh(new THREE.Mesh(getGeo('vbat_body', () => new THREE.SphereGeometry(0.24, 12, 10)), furMat));
    torso.scale.set(0.95, 0.9, 1.35);
    const head = regMesh(new THREE.Mesh(getGeo('vbat_head', () => new THREE.SphereGeometry(0.18, 12, 10)), furMat));
    head.position.set(0, 0.08, 0.24);
    const earGeo = getGeo('vbat_ear', () => new THREE.ConeGeometry(0.06, 0.18, 5));
    const earL = regMesh(new THREE.Mesh(earGeo, furMat));
    earL.position.set(-0.09, 0.24, 0.22);
    earL.rotation.z = 0.28;
    const earR = regMesh(new THREE.Mesh(earGeo, furMat));
    earR.position.set(0.09, 0.24, 0.22);
    earR.rotation.z = -0.28;

    const fangGeo = getGeo('vbat_f', () => new THREE.ConeGeometry(0.022, 0.075, 4));
    const fL = regMesh(new THREE.Mesh(fangGeo, fangMat));
    fL.rotation.x = Math.PI;
    fL.position.set(-0.045, -0.02, 0.40);
    const fR = regMesh(new THREE.Mesh(fangGeo, fangMat));
    fR.rotation.x = Math.PI;
    fR.position.set(0.045, -0.02, 0.40);

    head.add(createGlowingEyePair(0xff1e1e, 0.07, 0.04, 0.16, 0.65, 0.42));
    batGrp.add(torso, head, earL, earR, fL, fR);

    const wingGeo = getGeo('vbat_wing_geo', () => {
      const sh = new THREE.Shape();
      sh.moveTo(0, 0);
      sh.lineTo(0.42, 0.14);
      sh.lineTo(0.68, -0.02);
      sh.lineTo(0.46, -0.18);
      sh.lineTo(0.24, -0.12);
      sh.lineTo(0, -0.18);
      sh.closePath();
      return new THREE.ShapeGeometry(sh);
    });
    const wingLPiv = new THREE.Group();
    wingLPiv.position.set(-0.14, 0.06, 0.05);
    const wingL = regMesh(new THREE.Mesh(wingGeo, wingMat));
    wingL.rotation.x = -Math.PI * 0.5;
    wingL.scale.x = -1;
    wingLPiv.add(wingL);

    const wingRPiv = new THREE.Group();
    wingRPiv.position.set(0.14, 0.06, 0.05);
    const wingR = regMesh(new THREE.Mesh(wingGeo, wingMat));
    wingR.rotation.x = -Math.PI * 0.5;
    wingRPiv.add(wingR);

    batGrp.add(wingLPiv, wingRPiv);

    return {
      root: grp,
      triggerAttack() { attackTimer = 0.25; },
      update(dt, t, isDying) {
        if (isDying) return;
        if (attackTimer > 0) attackTimer = Math.max(0, attackTimer - dt);
        const flap = Math.sin(t * 25.0 + (grp.id || 0));
        batGrp.position.y = 1.05 + flap * 0.11 + (attackTimer > 0 ? 0.16 : 0);
        wingLPiv.rotation.z = flap * 0.85;
        wingRPiv.rotation.z = -flap * 0.85;
        batGrp.rotation.x = 0.22 + (attackTimer > 0 ? 0.35 : 0);
      }
    };
  }

  if (rigType === 'shadow_wisp') {
    const floatGrp = new THREE.Group();
    floatGrp.position.y = 0.28;
    grp.add(floatGrp);

    const shadowMat = getMat('wisp_pitch_black', () =>
      new THREE.MeshStandardMaterial({ color: 0x09090f, roughness: 0.90, metalness: 0.05 })
    );
    const eyeMat = getMat('wisp_blaze_eye', () =>
      new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xff6a00, emissiveIntensity: 3.2, roughness: 0.10 })
    );

    const head = regMesh(new THREE.Mesh(getGeo('wisp_head', () => new THREE.SphereGeometry(0.40, 14, 12)), shadowMat));
    head.position.y = 0.88;
    const torso = regMesh(new THREE.Mesh(getGeo('wisp_torso', () => new THREE.ConeGeometry(0.32, 0.82, 12)), shadowMat));
    torso.rotation.x = Math.PI;
    torso.position.y = 0.46;
    const tailTip = regMesh(new THREE.Mesh(getGeo('wisp_tail', () => new THREE.ConeGeometry(0.15, 0.42, 8)), shadowMat));
    tailTip.rotation.x = Math.PI;
    tailTip.position.set(0.08, 0.14, -0.08);
    tailTip.rotation.z = 0.35;
    floatGrp.add(head, torso, tailTip);

    // Crown of 5 pitch-black shadow flame tongues on head
    const flames = [];
    const flameGeo = getGeo('wisp_crown_flame', () => new THREE.ConeGeometry(0.13, 0.46, 6));
    for (let i = 0; i < 5; i++) {
      const f = regMesh(new THREE.Mesh(flameGeo, shadowMat));
      const frac = (i - 2) * 0.14;
      f.position.set(frac, 1.28 + (i === 2 ? 0.10 : 0), (i % 2 === 0 ? -0.04 : 0.04));
      f.rotation.z = -frac * 1.4;
      floatGrp.add(f);
      flames.push({ mesh: f, phase: i * 1.3 });
    }

    // 2 Shadow Arms
    const armGeo = getGeo('wisp_arm', () => new THREE.ConeGeometry(0.10, 0.42, 6));
    for (const sx of [-1, 1]) {
      const arm = regMesh(new THREE.Mesh(armGeo, shadowMat));
      arm.position.set(sx * 0.38, 0.62, 0.08);
      arm.rotation.z = sx * 2.25;
      floatGrp.add(arm);
    }

    // 2 Large Slanted Blazing Orange Eyes
    for (const sx of [-0.15, 0.15]) {
      const eye = regMesh(new THREE.Mesh(getGeo('wisp_eye', () => new THREE.SphereGeometry(0.088, 9, 9)), eyeMat), true);
      eye.scale.set(1.38, 0.78, 0.55);
      eye.position.set(sx, 0.86, 0.36);
      eye.rotation.z = sx < 0 ? -0.28 : 0.28;
      floatGrp.add(eye);
    }

    return {
      root: grp,
      triggerAttack() { attackTimer = 0.24; },
      update(dt, t, isDying) {
        if (isDying) return;
        if (attackTimer > 0) attackTimer = Math.max(0, attackTimer - dt);
        floatGrp.position.y = 0.26 + Math.sin(t * 5.2) * 0.11;
        tailTip.rotation.z = 0.32 + Math.sin(t * 7.5) * 0.22;
        for (const fl of flames) {
          fl.mesh.scale.y = 0.88 + Math.sin(t * 11.0 + fl.phase) * 0.20;
        }
      }
    };
  }

  if (rigType === 'mimic_chest') {
    const hopGrp = new THREE.Group();
    grp.add(hopGrp);

    const woodMat = getMat('mim_wood', () =>
      new THREE.MeshStandardMaterial({ color: 0x5c361c, roughness: 0.72, metalness: 0.10 })
    );
    const goldMat = getMat('mim_brass', () =>
      new THREE.MeshStandardMaterial({ color: 0xd99b26, metalness: 0.82, roughness: 0.26 })
    );
    const mawMat = getMat('mim_maw_dark', () =>
      new THREE.MeshStandardMaterial({ color: 0x1e0b24, roughness: 0.85 })
    );
    const tongueMat = getMat('mim_purple_tongue', () =>
      new THREE.MeshStandardMaterial({ color: 0x9333ea, roughness: 0.24, metalness: 0.08 })
    );
    const fangMat = getMat('cmh_fang_ivory', () =>
      new THREE.MeshStandardMaterial({ color: 0xf5efe0, roughness: 0.38, metalness: 0.06 })
    );

    // Lower Chest Box + Gold Trim + Maw Cavity
    const baseBox = regMesh(new THREE.Mesh(getGeo('mim_base', () => new THREE.BoxGeometry(0.96, 0.52, 0.74)), woodMat));
    baseBox.position.y = 0.26;
    const baseRim = regMesh(new THREE.Mesh(getGeo('mim_base_rim', () => new THREE.BoxGeometry(1.02, 0.10, 0.80)), goldMat));
    baseRim.position.y = 0.48;
    const mawCavity = new THREE.Mesh(getGeo('mim_cavity', () => new THREE.BoxGeometry(0.84, 0.12, 0.62)), mawMat);
    mawCavity.position.y = 0.50;
    const lockPlate = regMesh(new THREE.Mesh(getGeo('mim_lock', () => new THREE.BoxGeometry(0.18, 0.20, 0.06)), goldMat));
    lockPlate.position.set(0, 0.40, 0.40);
    hopGrp.add(baseBox, baseRim, mawCavity, lockPlate);

    // Lower Row of Sharp Ivory Fangs
    const fangGeo = getGeo('mim_fang', () => new THREE.ConeGeometry(0.048, 0.18, 5));
    for (let i = 0; i < 6; i++) {
      const fx = -0.35 + (i / 5) * 0.70;
      const lf = regMesh(new THREE.Mesh(fangGeo, fangMat));
      lf.position.set(fx, 0.58, 0.32);
      hopGrp.add(lf);
    }

    // Curling Glossy Purple Tongue
    const tonguePivot = new THREE.Group();
    tonguePivot.position.set(0, 0.48, 0.10);
    const tCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.06, 0.08, 0.28),
      new THREE.Vector3(0.14, -0.06, 0.54),
      new THREE.Vector3(0.08, -0.22, 0.62)
    ]);
    const tongueMesh = regMesh(
      new THREE.Mesh(getGeo('mim_tongue_tube', () => new THREE.TubeGeometry(tCurve, 12, 0.095, 8, false)), tongueMat)
    );
    tonguePivot.add(tongueMesh);
    hopGrp.add(tonguePivot);

    // Hinged Upper Treasure Lid + Upper Row of Fangs + Glowing Eyes
    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, 0.52, -0.35);
    const lidVault = regMesh(
      new THREE.Mesh(
        getGeo('mim_lid_vault', () => {
          const cg = new THREE.CylinderGeometry(0.37, 0.37, 0.96, 12, 1, false, 0, Math.PI);
          cg.rotateZ(Math.PI * 0.5);
          return cg;
        }),
        woodMat
      )
    );
    lidVault.position.set(0, 0.02, 0.35);
    const lidRim = regMesh(new THREE.Mesh(getGeo('mim_base_rim', () => new THREE.BoxGeometry(1.02, 0.10, 0.80)), goldMat));
    lidRim.position.set(0, 0.02, 0.35);
    lidPivot.add(lidVault, lidRim);

    for (let i = 0; i < 6; i++) {
      const fx = -0.35 + (i / 5) * 0.70;
      const uf = regMesh(new THREE.Mesh(fangGeo, fangMat));
      uf.rotation.x = Math.PI;
      uf.position.set(fx, -0.08, 0.67);
      lidPivot.add(uf);
    }
    lidPivot.add(createGlowingEyePair(0xff7a00, 0.22, 0.18, 0.70, 1.25, 0.70));
    lidPivot.rotation.x = -0.68;
    hopGrp.add(lidPivot);

    return {
      root: grp,
      triggerAttack() { attackTimer = 0.28; },
      update(dt, t, isDying) {
        if (isDying) return;
        if (attackTimer > 0) attackTimer = Math.max(0, attackTimer - dt);
        const hop = Math.abs(Math.sin(t * 8.5));
        hopGrp.position.y = hop * 0.16;
        const chomp = attackTimer > 0 ? Math.sin((attackTimer / 0.28) * Math.PI) * 0.52 : hop * 0.26;
        lidPivot.rotation.x = -0.78 + chomp;
        tonguePivot.rotation.y = Math.sin(t * 7.0) * 0.26;
      }
    };
  }

  // Default procedural rig: 'corrupted_treant' (Гнилой древень — Twisted dead tree with blazing orange jack-o'-lantern face!)
  const swayGrp = new THREE.Group();
  grp.add(swayGrp);

  const barkMat = getMat('treant_bark', () =>
    new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 0.88, metalness: 0.04 })
  );
  const darkHollowMat = getMat('treant_hollow', () =>
    new THREE.MeshStandardMaterial({ color: 0x1a0d06, roughness: 0.9 })
  );
  const fireFaceMat = getMat('treant_fire_face', () =>
    new THREE.MeshStandardMaterial({ color: 0xfde047, emissive: 0xff6a00, emissiveIntensity: 3.0, roughness: 0.14 })
  );

  // Fluted gnarled tree trunk
  const trunkGeo = getGeo('treant_trunk', () => {
    const cg = new THREE.CylinderGeometry(0.42, 0.64, 1.48, 12, 6);
    const pos = cg.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const a = Math.atan2(vz, vx);
      const flute = 1 + Math.sin(a * 5 + vy * 1.8) * 0.10;
      pos.setX(i, vx * flute);
      pos.setZ(i, vz * flute);
      pos.setY(i, vy + 0.74);
    }
    cg.computeVertexNormals();
    return cg;
  });
  const trunk = regMesh(new THREE.Mesh(trunkGeo, barkMat));
  swayGrp.add(trunk);

  // 5 Sprawling Root-Feet
  const rootGeo = getGeo('treant_root', () => new THREE.ConeGeometry(0.16, 0.56, 6));
  for (let r = 0; r < 5; r++) {
    const a = (r / 5) * Math.PI * 2 + 0.3;
    const rf = regMesh(new THREE.Mesh(rootGeo, barkMat));
    rf.position.set(Math.cos(a) * 0.56, 0.14, Math.sin(a) * 0.56);
    rf.rotation.z = -Math.cos(a) * 1.15;
    rf.rotation.x = Math.sin(a) * 1.15;
    swayGrp.add(rf);
  }

  // Crown of 6 Gnarled Dead Branches
  for (let b = 0; b < 6; b++) {
    const a = (b / 6) * Math.PI * 2 + 0.25;
    const bCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 0.26, 1.38, Math.sin(a) * 0.26),
      new THREE.Vector3(Math.cos(a) * 0.54, 1.78, Math.sin(a) * 0.54),
      new THREE.Vector3(Math.cos(a + 0.3) * 0.72, 2.12 + (b % 2) * 0.16, Math.sin(a + 0.3) * 0.72)
    ]);
    const bMesh = regMesh(
      new THREE.Mesh(getGeo(`treant_bough_${b}`, () => new THREE.TubeGeometry(bCurve, 8, 0.072, 6, false)), barkMat)
    );
    swayGrp.add(bMesh);
  }

  // 2 Swinging Clawed Branch Arms
  const branchArms = [];
  const armGeo = getGeo('treant_arm', () => {
    const cg = new THREE.CylinderGeometry(0.08, 0.12, 0.78, 6);
    cg.translate(0, -0.34, 0);
    return cg;
  });
  for (const sx of [-1, 1]) {
    const armPiv = new THREE.Group();
    armPiv.position.set(sx * 0.50, 1.16, 0.06);
    const arm = regMesh(new THREE.Mesh(armGeo, barkMat));
    arm.rotation.z = sx * 0.42;
    armPiv.add(arm);
    swayGrp.add(armPiv);
    branchArms.push({ piv: armPiv, sx });
  }

  // Blazing Orange Jack-o'-Lantern Eyes & Jagged Grin on Trunk!
  const faceBack = new THREE.Mesh(getGeo('treant_face_back', () => new THREE.BoxGeometry(0.56, 0.46, 0.14)), darkHollowMat);
  faceBack.position.set(0, 0.88, 0.42);
  swayGrp.add(faceBack);

  const triEyeGeo = getGeo('treant_tri_eye', () => new THREE.ConeGeometry(0.105, 0.18, 4));
  for (const sx of [-0.16, 0.16]) {
    const eye = regMesh(new THREE.Mesh(triEyeGeo, fireFaceMat), true);
    eye.scale.set(1.25, 0.85, 0.5);
    eye.position.set(sx, 1.00, 0.49);
    eye.rotation.z = sx < 0 ? -0.35 : 0.35;
    swayGrp.add(eye);
  }
  const grinGeo = getGeo('treant_grin_seg', () => new THREE.OctahedronGeometry(0.078, 0));
  for (let m = -2; m <= 2; m++) {
    const seg = regMesh(new THREE.Mesh(grinGeo, fireFaceMat), true);
    seg.scale.set(1.1, 1.25, 0.45);
    seg.position.set(m * 0.088, 0.74 + Math.abs(m) * 0.025, 0.50);
    swayGrp.add(seg);
  }

  return {
    root: grp,
    triggerAttack() { attackTimer = 0.32; },
    update(dt, t, isDying) {
      if (isDying) return;
      if (attackTimer > 0) attackTimer = Math.max(0, attackTimer - dt);
      const atkSwing = attackTimer > 0 ? Math.sin((attackTimer / 0.32) * Math.PI) * 1.1 : 0;
      swayGrp.rotation.z = Math.sin(t * 4.8) * 0.055;
      swayGrp.position.y = Math.abs(Math.sin(t * 4.8)) * 0.04;
      for (const ba of branchArms) {
        ba.piv.rotation.x = Math.sin(t * 4.8 + (ba.sx < 0 ? 0 : Math.PI)) * 0.35 - atkSwing;
      }
    }
  };
}

const ENEMY_TYPE_ALIASES = {
  skeleton: 'ember_skeleton',
  hound: 'goblin',
  archer: 'vampire_lord',
  shieldbearer: 'cursed_footman',
  bomber: 'toxic_slime',
  necromancer: 'mummy',
  cultist: 'dark_cultist',
  brute: 'iron_knight',
  reaper: 'boss_cthulhu'
};

const ENEMY_MODEL_CFG = {
  // === 16 Regular & Specialist Dark-Fantasy Monsters ===
  ember_skeleton: {
    key: 'skel_minion',
    scale: 0.90,
    moveClip: 'Walking_D_Skeletons',
    idleClip: 'Idle',
    atkClip: '1H_Melee_Attack_Slice_Horizontal',
    weapon: 'bone_sword',
    tint: 0xe7dfd3,
    tintLerp: 0.38,
    eye: 0xff6a00
  },
  bone_archer: {
    key: 'skel_minion',
    scale: 0.90,
    moveClip: 'Walking_D_Skeletons',
    idleClip: 'Idle',
    atkClip: 'Spellcast_Shoot',
    weapon: 'cultist_skull_staff',
    tint: 0xd8cec0,
    tintLerp: 0.42,
    eye: 0xf97316
  },
  goblin: {
    key: 'barbarian',
    scale: 0.80,
    moveClip: 'Running_B',
    idleClip: 'Idle',
    atkClip: '1H_Melee_Attack_Chop',
    weapon: 'goblin_stone_axe',
    tint: 0x5c8a32,
    tintLerp: 0.72,
    eye: 0xff4500,
    moveSpeedAnim: 1.38
  },
  werewolf: {
    key: 'barbarian',
    scale: 0.95,
    moveClip: 'Running_B',
    idleClip: 'Idle',
    atkClip: 'Dualwield_Melee_Attack_Slice',
    weapon: null,
    tint: 0x2b2930,
    tintLerp: 0.84,
    eye: 0xff6a00,
    moveSpeedAnim: 1.44
  },
  cursed_footman: {
    key: 'skel_warrior',
    scale: 1.00,
    moveClip: 'Walking_B',
    idleClip: 'Idle',
    atkClip: '1H_Melee_Attack_Slice_Horizontal',
    weapon: 'broadsword',
    tint: 0x5c6842,
    tintLerp: 0.50,
    eye: 0xf59e0b
  },
  plague_zombie: {
    key: 'zombie_tripo',
    scale: 2.02,
    moveClip: 'Strut_Walking',
    idleClip: 'Idle',
    atkClip: 'Attack',
    weapon: null,
    tint: null,
    eye: null
  },
  iron_knight: {
    key: 'knight',
    scale: 1.26,
    moveClip: 'Walking_B',
    idleClip: 'Idle',
    atkClip: '2H_Melee_Attack_Chop',
    weapon: null, // Uses built-in 2H_Sword!
    tint: 0x523c2b,
    tintLerp: 0.66,
    eye: 0xff6a00
  },
  // === Abandoned Knight Rift (Level 26 souls_citadel) Exclusive AAA Tripo Enemies ===
  // PvE Chapters 1-25 continue using lightweight KayKit iron_knight / cursed_footman / bone_archer.
  rift_executioner: {
    key: 'rift_executioner',
    scale: 2.48, // In Souls Citadel (enc.scale 1.18 / def.scale 1.32 = 0.894x) -> ~2.20m (~1.22x Hero!)
    moveClip: 'Combat_Walk',
    patrolClip: 'Patrol_Walk',
    idleClip: 'Idle',
    atkClip: 'Attack_Slash_1',
    weapon: null,
    tint: null,
    eye: null,
    isRiftTripo: true,
    physicsType: 'iron_knight',
    moveSpeedAnim: 1.0,
    contactShadowRadius: 1.14,
    weaponBoneSegment: {
      hilt: [0.04, 0.06, 0.00],
      tip: [-0.88, 0.08, 0.00]
    }
  },
  rift_vanguard: {
    key: 'rift_vanguard',
    scale: 2.02, // In Souls Citadel (enc.scale 1.12 / def.scale 1.04 = 1.077x) -> ~1.97m (~1.09x Hero!)
    moveClip: 'Combat_Walk',
    patrolClip: 'Patrol_Walk',
    idleClip: 'Idle',
    atkClip: 'Attack_Thrust_1',
    weapon: null,
    tint: null,
    eye: null,
    isRiftTripo: true,
    physicsType: 'cursed_footman',
    moveSpeedAnim: 1.0,
    contactShadowRadius: 0.96,
    weaponBoneSegment: {
      hilt: [0.02, 0.06, -0.04],
      tip: [-0.87, 0.06, -0.04]
    }
  },
  rift_acolyte: {
    key: 'rift_acolyte',
    scale: 2.08, // ~1.91m vs Hero 1.83m (~1.05-1.14x tall hooded arbalest acolyte)
    moveClip: 'Combat_Walk',
    patrolClip: 'Patrol_Walk',
    idleClip: 'Idle',
    atkClip: 'Shot_Release',
    weapon: null,
    tint: null,
    eye: null,
    isRiftTripo: true,
    physicsType: 'bone_archer',
    moveSpeedAnim: 1.0,
    contactShadowRadius: 0.88,
    weaponBoneSegment: {
      hilt: [0.04, 0.04, -0.06],
      tip: [0.06, 0.62, -0.06]
    }
  },
  dark_cultist: {
    key: 'skel_mage',
    scale: 0.92,
    moveClip: 'Walking_A',
    idleClip: 'Idle',
    atkClip: 'Spellcast_Shoot',
    weapon: 'cultist_skull_staff',
    tint: 0x4c1d95,
    tintLerp: 0.72,
    eye: 0xd946ef
  },
  mummy: {
    key: 'skel_mage',
    scale: 0.94,
    moveClip: 'Walking_A',
    idleClip: 'Idle',
    atkClip: 'Spellcast_Raise',
    weapon: 'mummy_crescent_staff',
    tint: 0xd9c79e,
    tintLerp: 0.78,
    eye: 0x22d3ee
  },
  dark_spider: {
    key: 'spider_tripo',
    scale: 1.75,
    moveClip: 'Scuttle_Walk',
    idleClip: 'Idle',
    atkClip: 'Bite_Lunge',
    weapon: null,
    tint: null,
    eye: null,
    moveSpeedAnim: 1.45
  },
  succubus: {
    key: 'succubus_tripo',
    scale: 2.02,
    moveClip: 'Walking',
    idleClip: 'Idle',
    atkClip: 'Cast_Attack',
    weapon: null,
    tint: null,
    eye: null,
    moveSpeedAnim: 1.12
  },
  toxic_slime: {
    proceduralRig: 'toxic_slime',
    scale: 0.92
  },
  gargoyle: {
    key: 'barbarian',
    scale: 0.88,
    moveClip: 'Running_A',
    idleClip: 'Idle',
    atkClip: 'Dualwield_Melee_Attack_Chop',
    weapon: null,
    tint: 0x575a64,
    tintLerp: 0.84,
    eye: 0xef4444,
    moveSpeedAnim: 1.24
  },
  hell_imp: {
    key: 'barbarian',
    scale: 0.76,
    moveClip: 'Running_B',
    idleClip: 'Idle',
    atkClip: 'Dualwield_Melee_Attack_Slice',
    weapon: null,
    tint: 0xb91c1c,
    tintLerp: 0.78,
    eye: 0xff5500,
    moveSpeedAnim: 1.42
  },
  phantom_ghost: {
    proceduralRig: 'phantom_ghost',
    scale: 0.96
  },
  vampire_lord: {
    key: 'dracula_tripo',
    scale: 2.08,
    moveClip: 'Walking',
    idleClip: 'Idle',
    atkClip: 'Cloak_Slash',
    weapon: null,
    tint: null,
    eye: null
  },
  vampire_bat: {
    proceduralRig: 'vampire_bat',
    scale: 0.92
  },
  mimic_chest: {
    key: 'mimic_tripo',
    scale: 1.92,
    moveClip: 'Hop_Chomp',
    idleClip: 'Hop_Chomp',
    atkClip: 'Hop_Chomp',
    weapon: null,
    tint: null,
    eye: null
  },
  corrupted_treant: {
    key: 'tree_tripo',
    scale: 2.12,
    moveClip: 'Hop_Forward',
    idleClip: 'Idle',
    atkClip: 'Hop_Forward',
    weapon: null,
    tint: null,
    eye: null
  },
  shadow_wisp: {
    proceduralRig: 'shadow_wisp',
    scale: 0.94
  },

  // === 5 Distinct Milestone Act Bosses (Matches Top Row of ad09b7c9.jpg!) ===
  boss_butcher: {
    key: 'barbarian',
    scale: 1.72,
    moveClip: 'Running_B',
    idleClip: 'Idle',
    atkClip: '2H_Melee_Attack_Slice',
    weapon: 'demon_magma_greatsword',
    tint: 0x262022,
    tintLerp: 0.80,
    baseEmissive: 0x9a3412,
    baseEmissiveInt: 0.22,
    eye: 0xff5500,
    isBossVisual: true
  },
  boss_archlich: {
    key: 'lich_tripo',
    scale: 2.65,
    moveClip: 'Running_A',
    idleClip: 'Idle',
    atkClip: 'Spellcast_Shoot',
    weapon: null,
    tint: null,
    eye: null,
    isBossVisual: true,
    moveSpeedAnim: 1.05
  },
  boss_cthulhu: {
    key: 'barbarian',
    scale: 1.92,
    moveClip: 'Walking_B',
    idleClip: 'Idle',
    atkClip: 'Spellcast_Shoot',
    weapon: null,
    tint: 0x1b4552,
    tintLerp: 0.82,
    eye: 0xff6a00,
    isBossVisual: true
  },
  boss_troll: {
    key: 'troll_tripo',
    scale: 2.85,
    moveClip: 'Walking',
    idleClip: 'Idle',
    atkClip: 'Heavy_Cleave',
    weapon: null,
    tint: null,
    eye: null,
    isBossVisual: true,
    physicsType: 'boss_troll',
    moveSpeedAnim: 1.08,
    contactShadowRadius: 2.05,
    weaponBoneSegment: {
      hilt: [0.04, 0.05, 0.00],
      tip: [0.12, 0.14, 0.45]
    }
  },
  boss_warden: {
    key: 'troll_tripo',
    scale: 2.85,
    moveClip: 'Walking',
    idleClip: 'Idle',
    atkClip: 'Heavy_Cleave',
    weapon: null,
    tint: null,
    eye: null,
    isBossVisual: true,
    physicsType: 'boss_troll',
    moveSpeedAnim: 1.08,
    contactShadowRadius: 2.05,
    weaponBoneSegment: {
      hilt: [0.04, 0.05, 0.00],
      tip: [0.12, 0.14, 0.45]
    }
  },
  rift_boss: {
    key: 'rift_boss',
    scale: 2.05,
    moveClip: 'Walking',
    idleClip: 'Idle',
    atkClip: 'Heavy_Cleave',
    weapon: null,
    tint: null,
    eye: null,
    isBossVisual: true,
    isRiftTripo: true,
    physicsType: 'boss_troll',
    moveSpeedAnim: 1.0,
    contactShadowRadius: 2.15,
    weaponBoneSegment: {
      hilt: [0.00, 0.02, 0.00],
      tip: [0.04, 0.08, 0.50]
    }
  },
  boss_ashlord: {
    key: 'barbarian',
    scale: 2.28,
    moveClip: 'Walking_B',
    idleClip: 'Idle',
    atkClip: 'Dualwield_Melee_Attack_Chop',
    weapon: null,
    tint: 0x1c191e,
    tintLerp: 0.86,
    baseEmissive: 0xd9480f,
    baseEmissiveInt: 0.28,
    eye: 0xff7a00,
    isBossVisual: true
  }
};

// Measured strike/release impact-peak fraction (t_peak / clip.duration) per enemy attack clip
// so Souls & telegraphed windups land the visual swing/shot peak EXACTLY on `desiredImpactDur`!
const ENEMY_CLIP_IMPACT_FRAC = {
  '2H_Melee_Attack_Chop': 0.50,
  '2H_Melee_Attack_Slice': 0.36,
  '1H_Melee_Attack_Slice_Horizontal': 0.28,
  '1H_Melee_Attack_Chop': 0.56,
  '1H_Melee_Attack_Slice_Diagonal': 0.38,
  'Dualwield_Melee_Attack_Slice': 0.50,
  'Dualwield_Melee_Attack_Chop': 0.43,
  'Spellcast_Shoot': 0.34,
  'Spellcast_Raise': 0.25,
  'Heavy_Cleave': 0.48,
  // Abandoned Knight Rift AAA enemies (Executioner, Vanguard, Acolyte)
  'Attack_Slash_1': 0.54,
  'Attack_Slash_2': 0.53,
  'Attack_Overhead_Crush': 0.58,
  'Attack_Thrust_Lunge': 0.53,
  'Attack_Thrust_1': 0.53,
  'Attack_Sweep_2': 0.54,
  'Attack_Shield_Bash': 0.52,
  'Attack_Overhead_Poke': 0.54,
  'Aim_Draw': 0.85,
  'Shot_Release': 0.25,
  'Quick_Retreat_Shot': 0.45,
  // Boss Warden / Troll AAA 3-hit combo & special attacks
  'Combo_Sweep_1': 0.53,
  'Combo_Backhand_2': 0.48,
  'Combo_Slam_3': 0.64,
  'Leap_Slam': 0.56,
  'Delayed_Crush': 0.62,
  'Sweep_Combo': 0.46,
  'Whirl_Spin': 0.50,
  'Rising_Upcut': 0.39,
  'Ram_Thrust_Hook': 0.31
};

const enemyMeshPool = new Map();
let enemyInstanceSeq = 0;
const _enemyWepHilt = new THREE.Vector3();
const _enemyWepTip = new THREE.Vector3();
const _wepCalMatA = new THREE.Matrix4();
const _wepCalMatB = new THREE.Matrix4();
const _wepCalVec = new THREE.Vector3();
const SOFT_HIT_FLASH_TINT = new THREE.Color(0xffdcb0);

// One-time bind-pose calibration for dedicated weapon bones (e.g. Rift Boss `mixamorig:WeaponHammer`):
// measures exact shaft hilt & hammer-head tip in targetBone local space regardless of Blender bone axes.
function calibrateWeaponBoneSegment(instRoot, targetBone) {
  if (!instRoot || !targetBone) return null;
  let namedHammerMesh = null;
  let fallbackSkinnedMesh = null;
  let fallbackSkinnedIdx = -1;
  instRoot.traverse((n) => {
    if (!n.isMesh || !n.geometry?.attributes?.position) return;
    const nm = n.name || '';
    if (n.isSkinnedMesh && n.skeleton && Array.isArray(n.skeleton.bones)) {
      const bIdx = n.skeleton.bones.indexOf(targetBone);
      if (bIdx >= 0 && n.skeleton.boneInverses?.[bIdx]) {
        if (/Warhammer|Hammer|Weapon/i.test(nm)) {
          namedHammerMesh = { mesh: n, bIdx, filterWeight: false };
        } else if (!fallbackSkinnedMesh) {
          fallbackSkinnedMesh = n;
          fallbackSkinnedIdx = bIdx;
        }
      }
    } else if (!namedHammerMesh && /Warhammer|Hammer/i.test(nm)) {
      namedHammerMesh = { mesh: n, bIdx: -1, filterWeight: false };
    }
  });

  const target =
    namedHammerMesh ||
    (fallbackSkinnedMesh ? { mesh: fallbackSkinnedMesh, bIdx: fallbackSkinnedIdx, filterWeight: true } : null);
  if (!target) return null;

  const { mesh, bIdx, filterWeight } = target;
  const posAttr = mesh.geometry.attributes.position;
  const count = posAttr.count || 0;
  if (count < 4) return null;

  const skinIdx = filterWeight ? mesh.geometry.attributes.skinIndex : null;
  const skinW = filterWeight ? mesh.geometry.attributes.skinWeight : null;
  if (filterWeight && (!skinIdx || !skinW)) return null;

  if (bIdx >= 0) {
    _wepCalMatA.multiplyMatrices(mesh.skeleton.boneInverses[bIdx], mesh.bindMatrix);
  } else {
    targetBone.updateWorldMatrix(true, false);
    mesh.updateWorldMatrix(true, false);
    _wepCalMatB.copy(targetBone.matrixWorld).invert();
    _wepCalMatA.multiplyMatrices(_wepCalMatB, mesh.matrixWorld);
  }

  const stride = Math.max(1, Math.floor(count / 1200));
  const matchesBone = (i) => {
    if (!filterWeight) return true;
    let wSum = 0;
    if (skinIdx.getX(i) === bIdx) wSum += skinW.getX(i);
    if (skinIdx.getY(i) === bIdx) wSum += skinW.getY(i);
    if (skinIdx.getZ(i) === bIdx) wSum += skinW.getZ(i);
    if (skinIdx.getW(i) === bIdx) wSum += skinW.getW(i);
    return wSum >= 0.45;
  };

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  let matchedCount = 0;
  for (let i = 0; i < count; i += stride) {
    if (!matchesBone(i)) continue;
    _wepCalVec.fromBufferAttribute(posAttr, i).applyMatrix4(_wepCalMatA);
    if (!Number.isFinite(_wepCalVec.x) || !Number.isFinite(_wepCalVec.y) || !Number.isFinite(_wepCalVec.z)) continue;
    matchedCount++;
    if (_wepCalVec.x < minX) minX = _wepCalVec.x;
    if (_wepCalVec.x > maxX) maxX = _wepCalVec.x;
    if (_wepCalVec.y < minY) minY = _wepCalVec.y;
    if (_wepCalVec.y > maxY) maxY = _wepCalVec.y;
    if (_wepCalVec.z < minZ) minZ = _wepCalVec.z;
    if (_wepCalVec.z > maxZ) maxZ = _wepCalVec.z;
  }
  if (matchedCount < 4) return null;

  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const spanZ = maxZ - minZ;
  let axis = 1;
  let axisMin = minY;
  let axisSpan = spanY;
  if (spanX >= spanY && spanX >= spanZ) {
    axis = 0;
    axisMin = minX;
    axisSpan = spanX;
  } else if (spanZ >= spanX && spanZ >= spanY) {
    axis = 2;
    axisMin = minZ;
    axisSpan = spanZ;
  }
  if (axisSpan < 0.15) return null;

  const loCut = axisMin + axisSpan * 0.18;
  const hiCut = axisMin + axisSpan * 0.82;
  let loX = 0, loY = 0, loZ = 0, loN = 0;
  let hiX = 0, hiY = 0, hiZ = 0, hiN = 0;
  for (let i = 0; i < count; i += stride) {
    if (!matchesBone(i)) continue;
    _wepCalVec.fromBufferAttribute(posAttr, i).applyMatrix4(_wepCalMatA);
    if (!Number.isFinite(_wepCalVec.x)) continue;
    const coord = axis === 0 ? _wepCalVec.x : axis === 1 ? _wepCalVec.y : _wepCalVec.z;
    if (coord <= loCut) {
      loX += _wepCalVec.x; loY += _wepCalVec.y; loZ += _wepCalVec.z; loN++;
    } else if (coord >= hiCut) {
      hiX += _wepCalVec.x; hiY += _wepCalVec.y; hiZ += _wepCalVec.z; hiN++;
    }
  }
  if (loN < 1 || hiN < 1) return null;
  loX /= loN; loY /= loN; loZ /= loN;
  hiX /= hiN; hiY /= hiN; hiZ /= hiN;

  let loSpread = 0;
  let hiSpread = 0;
  for (let i = 0; i < count; i += stride) {
    if (!matchesBone(i)) continue;
    _wepCalVec.fromBufferAttribute(posAttr, i).applyMatrix4(_wepCalMatA);
    if (!Number.isFinite(_wepCalVec.x)) continue;
    const coord = axis === 0 ? _wepCalVec.x : axis === 1 ? _wepCalVec.y : _wepCalVec.z;
    if (coord <= loCut) {
      const d0 = axis === 0 ? (_wepCalVec.y - loY) : (_wepCalVec.x - loX);
      const d1 = axis === 2 ? (_wepCalVec.y - loY) : (_wepCalVec.z - loZ);
      loSpread += d0 * d0 + d1 * d1;
    } else if (coord >= hiCut) {
      const d0 = axis === 0 ? (_wepCalVec.y - hiY) : (_wepCalVec.x - hiX);
      const d1 = axis === 2 ? (_wepCalVec.y - hiY) : (_wepCalVec.z - hiZ);
      hiSpread += d0 * d0 + d1 * d1;
    }
  }
  loSpread /= loN;
  hiSpread /= hiN;

  const loOriginDistSq = loX * loX + loY * loY + loZ * loZ;
  const hiOriginDistSq = hiX * hiX + hiY * hiY + hiZ * hiZ;
  const loIsHead =
    loSpread > hiSpread * 1.25 ||
    (hiSpread <= loSpread * 1.25 && loOriginDistSq > hiOriginDistSq);
  const hilt = loIsHead ? [hiX, hiY, hiZ] : [loX, loY, loZ];
  const tip = loIsHead ? [loX, loY, loZ] : [hiX, hiY, hiZ];
  const lenSq = (tip[0] - hilt[0]) ** 2 + (tip[1] - hilt[1]) ** 2 + (tip[2] - hilt[2]) ** 2;
  if (!Number.isFinite(lenSq) || lenSq < 0.04) return null;
  return { hilt, tip };
}

// Delicate warm steel/gold hit-flash variant for AAA Rift Tripo enemies & Tripo Bosses:
// keeps albedo/normal/ORM/emissive maps intact (no flat white cardboard!), warms the albedo
// and briefly lifts emissive. Cached per source material so instances share one variant.
function getSoftHitFlashMaterial(srcMat) {
  if (!srcMat || !(srcMat.isMeshStandardMaterial || srcMat.isMeshPhysicalMaterial)) return null;
  return getMat(`soft_hit_flash_v1_${srcMat.uuid}`, () => {
    const m = srcMat.clone();
    if (m.userData && m.userData.hasSoulsRimLight) {
      m.userData = { ...m.userData };
      delete m.userData.hasSoulsRimLight;
    }
    if (m.color) m.color.lerp(SOFT_HIT_FLASH_TINT, 0.30);
    if (m.emissive) {
      if (m.emissiveMap) {
        m.emissiveIntensity = Math.max(1.0, Number(m.emissiveIntensity) || 1.0) * 1.45;
      } else {
        m.emissive.setHex(0xff9a4a);
        m.emissiveIntensity = Math.max(Number(m.emissiveIntensity) || 0, 0.30);
      }
    }
    applySoulsRimLight(m);
    return m;
  });
}

function buildSoftHitFlashSlotMat(mat) {
  if (Array.isArray(mat)) {
    let any = false;
    const out = mat.map((m) => {
      const f = getSoftHitFlashMaterial(m);
      if (f) any = true;
      return f || m;
    });
    return any ? out : null;
  }
  return getSoftHitFlashMaterial(mat);
}

export function createEnemyMesh(typeId = 'ember_skeleton', eliteVariant = null, customScaleMult = 1.0, extraOpts = null) {
  let spawnOpts = extraOpts && typeof extraOpts === 'object' ? extraOpts : null;
  if (typeId && typeof typeId === 'object') {
    spawnOpts = typeId;
    eliteVariant = spawnOpts.eliteVariant ?? spawnOpts.eliteType ?? spawnOpts.variant ?? null;
    customScaleMult = spawnOpts.customScaleMult ?? spawnOpts.scaleMult ?? 1.0;
    typeId = spawnOpts.typeId || spawnOpts.type || spawnOpts.enemyType || spawnOpts.id || 'ember_skeleton';
  }

  const canonicalType = ENEMY_TYPE_ALIASES[typeId] || typeId;
  const riftMappedType = SOULS_RIFT_ENEMY_MAP[canonicalType] || null;
  const riftAssetKey = riftMappedType ? ENEMY_MODEL_CFG[riftMappedType]?.key : null;
  const hasWorldArenaApi =
    typeof window !== 'undefined' && typeof window.__grimborne?.world?.isSoulsArena === 'function';
  const wantRiftModel = Boolean(
    riftMappedType &&
      riftAssetKey &&
      gltfCache.has(riftAssetKey) &&
      (isSoulsBiomeActive(spawnOpts) ||
        (!hasWorldArenaApi && spawnOpts?.isSouls !== false && spawnOpts?.forceKayKit !== true))
  );
  const resolvedModelType = wantRiftModel ? riftMappedType : canonicalType;
  const cfg = ENEMY_MODEL_CFG[resolvedModelType] || ENEMY_MODEL_CFG[canonicalType] || ENEMY_MODEL_CFG.ember_skeleton;
  const rawMult = Number(customScaleMult);
  const validMult = Number.isFinite(rawMult) && rawMult > 0 ? rawMult : 1.0;
  const effectiveScaleMult =
    eliteVariant === 'miniboss' && Math.abs(validMult - 1.0) < 0.001 ? 0.72 : validMult;

  const canPool = eliteVariant !== 'warden' && !cfg.isBossVisual;
  const poolKey = `${resolvedModelType}|${eliteVariant || 'std'}|${effectiveScaleMult.toFixed(2)}`;
  if (canPool) {
    const bucket = enemyMeshPool.get(poolKey);
    if (bucket && bucket.length > 0) {
      const reused = bucket.pop();
      reused._markActive();
      return reused;
    }
  }

  const enemyUid = ++enemyInstanceSeq;
  const root = new THREE.Group();
  root.userData.canonicalType = canonicalType;
  root.userData.resolvedModelType = resolvedModelType;
  root.userData.modelAssetKey = cfg.key || cfg.proceduralRig || null;
  syncSoulsRimLightFromBiome();
  let animCtrl = null;
  let resolvedIdleClip = null;
  let hasDedicatedIdleClip = false;
  let procRig = null;
  let handR = null;
  let weaponHammerBone = null;
  let calibratedWeaponBoneSeg = null;
  let headBone = null;
  let neckBone = null;
  let jawBone = null;
  let spineBone = null;
  let spine1Bone = null;
  let spine2Bone = null;
  let torsoFlinchApplied = false;
  let neckClampApplied = false;
  const spinePreFlinchQ = new THREE.Quaternion();
  const spine1PreFlinchQ = new THREE.Quaternion();
  const spine2PreFlinchQ = new THREE.Quaternion();
  const neckPreAdditiveQ = new THREE.Quaternion();
  const jawBindQuat = new THREE.Quaternion();
  let hasJawBindQuat = false;
  const _jawBindInvQ = new THREE.Quaternion();
  const _jawRelQ = new THREE.Quaternion();
  const _headUpVecW = new THREE.Vector3();
  const _flinchWorldAxis = new THREE.Vector3();
  const _flinchDeltaW = new THREE.Quaternion();
  const _flinchParentInvQ = new THREE.Quaternion();
  const _flinchBoneW = new THREE.Quaternion();
  let hitJoltDur = 0.26;
  let mouthOpen01 = 0;
  let bossMouthSmooth = 0;
  let headSpeechDamped = 0;
  let jawAdditiveApplied = false;
  const jawPreAdditiveQ = new THREE.Quaternion();
  let dissolveActive = false;
  let softHitFlashMode = false;
  const isRiftTripo = Boolean(cfg.isRiftTripo);
  let mountedEnemyWeaponProp = null;
  const instanceMats = [];
  const flashMeshSlots = [];
  const hitFlashMat = getMat('enemy_shared_hit_flash', () =>
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.9,
      roughness: 0.3
    })
  );
  let flashTimer = 0;
  let spawnedInst = null;
  let baseInstScaleX = 1;
  let baseInstScaleY = 1;
  let baseInstScaleZ = 1;

  let wingGroup = null;
  let dragonTail = null;
  let cthulhuHead = null;
  let cthulhuBase = null;
  let emberCoreGrp = null;
  let archlichOrbit = null;
  const archlichCrystals = [];
  let stage1BreakNode = null;
  let stage2BreakNode = null;

  if (cfg.proceduralRig) {
    procRig = buildProceduralMonsterRig(cfg.proceduralRig, cfg.scale * effectiveScaleMult, flashMeshSlots);
    spawnedInst = procRig.root;
    baseInstScaleX = spawnedInst.scale.x;
    baseInstScaleY = spawnedInst.scale.y;
    baseInstScaleZ = spawnedInst.scale.z;
    root.add(procRig.root);
  } else {
    const asset = gltfCache.get(cfg.key);
    if (asset) {
      const inst = cloneSkinned(asset.scene);
      spawnedInst = inst;
      inst.scale.setScalar(cfg.scale * effectiveScaleMult);
      baseInstScaleX = inst.scale.x;
      baseInstScaleY = inst.scale.y;
      baseInstScaleZ = inst.scale.z;
      root.add(inst);

      let handL = null;
      let chestBone = null;
      let foundEyeMesh = false;
      const isTripoEnemy = isRiftTripo || /_tripo$/i.test(cfg.key || '');
      const useSoftHitFlash = Boolean(isRiftTripo || (cfg.isBossVisual && isTripoEnemy));
      softHitFlashMode = useSoftHitFlash;
      const usesCustomHead =
        !isTripoEnemy && (
        canonicalType === 'goblin' ||
        canonicalType === 'werewolf' ||
        canonicalType === 'gargoyle' ||
        canonicalType === 'hell_imp' ||
        canonicalType === 'vampire_lord' ||
        canonicalType === 'boss_butcher' ||
        canonicalType === 'boss_cthulhu' ||
        canonicalType === 'boss_warden' ||
        canonicalType === 'boss_ashlord');

      const allowEnemyShadows =
        Boolean(cfg.isBossVisual || isRiftTripo || eliteVariant === 'miniboss' || eliteVariant === 'warden') &&
        (!isMobileRuntimeDevice() || Boolean(cfg.isBossVisual));

      inst.traverse((n) => {
        const nm = n.name || '';
        if (n.isMesh) {
          // Zero-visual-loss perf fix: disable shadow-pass on decorative 45.5k-tri Helmet_Shell meshes on rift_executioner
          // while keeping castShadow = true on main armored body meshes & receiveShadow = true on the Boss (`rift_boss`)!
          const isDecorativeHelmetShell =
            cfg.key === 'rift_executioner' && /Helmet_Shell/i.test(nm);
          n.castShadow = allowEnemyShadows && !isDecorativeHelmetShell;
          n.receiveShadow = cfg.key === 'rift_boss';
        }
        if (/^mixamorig:?WeaponHammer$/i.test(nm) && (!weaponHammerBone || n.isBone)) {
          weaponHammerBone = n;
        }
        if (
          /^handslot\.?r$/i.test(nm) ||
          (!handR && (/^hand\.?r$/i.test(nm) || /^mixamorig:?RightHand$/i.test(nm)))
        ) handR = n;
        if (
          /^handslot\.?l$/i.test(nm) ||
          (!handL && (/^hand\.?l$/i.test(nm) || /^mixamorig:?LeftHand$/i.test(nm)))
        ) handL = n;
        if (/^head$/i.test(nm) || (!headBone && /^mixamorig:?Head$/i.test(nm))) headBone = n;
        if (!neckBone && n.isBone && (/^neck$/i.test(nm) || /^mixamorig:?Neck$/i.test(nm))) neckBone = n;
        if (/^chest$/i.test(nm) || (!chestBone && /^mixamorig:?Spine2$/i.test(nm))) {
          chestBone = n;
          if (!spine2Bone) spine2Bone = n;
        }
        if (!spineBone && n.isBone && /^mixamorig:?Spine$/i.test(nm)) spineBone = n;
        if (!spine1Bone && n.isBone && /^mixamorig:?Spine1$/i.test(nm)) spine1Bone = n;
        if (!jawBone && n.isBone && /^mixamorig:?Jaw$/i.test(nm)) {
          jawBone = n;
          jawBindQuat.copy(n.quaternion);
          hasJawBindQuat = true;
        }

        if (!cfg.isBossVisual && !isRiftTripo) {
          if (nm === 'Skeleton_Warrior_Helmet' || nm === 'Knight_Helmet') {
            stage2BreakNode = n;
          }
          if (canonicalType === 'iron_knight' && nm === 'Knight_Cape') {
            stage1BreakNode = n;
          }
        }

        // Hide unwanted built-in KayKit props so each archetype silhouette matches ad09b7c9.jpg!
        if (!isRiftTripo) {
          if (nm === 'Mug' || nm === 'Spellbook' || nm === 'Spellbook_open' || nm === '1H_Wand') {
            n.visible = false;
          }
          if (usesCustomHead && /^(Barbarian_Head|Barbarian_Hat|Mage_Head|Mage_Hat)$/i.test(nm)) {
            n.visible = false;
          }
          if (canonicalType === 'ember_skeleton' && nm === 'Skeleton_Minion_Cloak') {
            n.visible = false;
          }
          if ((canonicalType === 'dark_cultist' || canonicalType === 'mummy' || canonicalType === 'boss_archlich') && nm === 'Skeleton_Mage_Hat') {
            n.visible = false;
          }
          if (canonicalType === 'vampire_lord' && nm === '2H_Staff') {
            n.visible = false;
          }
          if (cfg.key === 'barbarian') {
            if (nm === '2H_Axe' || nm === 'Barbarian_Round_Shield' || nm === '1H_Axe' || nm === '1H_Axe_Offhand' || nm === 'Barbarian_Hat') {
              n.visible = false;
            }
            if (
              (canonicalType === 'gargoyle' ||
                canonicalType === 'hell_imp' ||
                canonicalType === 'werewolf' ||
                canonicalType === 'boss_ashlord' ||
                canonicalType === 'boss_cthulhu' ||
                canonicalType === 'boss_warden') &&
              nm === 'Barbarian_Cape'
            ) {
              n.visible = false;
            }
          }
          if (canonicalType === 'iron_knight') {
            if (
              nm === '1H_Sword' ||
              nm === '1H_Sword_Offhand' ||
              nm === 'Round_Shield' ||
              nm === 'Badge_Shield' ||
              nm === 'Rectangle_Shield' ||
              nm === 'Spike_Shield'
            ) {
              n.visible = false;
            }
          }
        }

        if (n.isMesh && n.material) {
          if (isRiftTripo) {
            // Preserve Cycles PBR materials (albedo + ORM + normal + emissiveMap + emissiveStrength) intact!
            if (eliteVariant === 'purple' || eliteVariant === 'blue') {
              const eliteEm = eliteVariant === 'purple' ? 0x6b21a8 : 0x0369a1;
              const mapElite = (srcMat) =>
                getMat(`rift_elite_${resolvedModelType}_${eliteVariant}_${srcMat.uuid}`, () => {
                  const m = srcMat.clone();
                  if (m.emissive && !m.emissiveMap) {
                    m.emissive.setHex(eliteEm);
                    m.emissiveIntensity = Math.max(m.emissiveIntensity || 0, 0.28);
                  }
                  if (!/Eyes/i.test(nm)) applySoulsRimLight(m);
                  return m;
                });
              n.material = Array.isArray(n.material) ? n.material.map(mapElite) : mapElite(n.material);
            }
            // Skip material-swap flashMeshSlots on rift_boss so soulsBossVisuals's uBossHitFlash shader stays 100% bound!
            if (n.visible && cfg.key !== 'rift_boss') {
              flashMeshSlots.push({ mesh: n, origMat: n.material, flashMat: buildSoftHitFlashSlotMat(n.material) });
            }
            return;
          }
          if (/Eyes/i.test(nm)) {
            foundEyeMesh = true;
            n.material = getMat(`eye_mat_${cfg.eye}_${cfg.isBossVisual ? 'b' : 'n'}`, () =>
              new THREE.MeshStandardMaterial({
                color: cfg.eye,
                emissive: cfg.eye,
                emissiveIntensity: cfg.isBossVisual ? 2.7 : 2.2,
                roughness: 0.15
              })
            );
            return;
          }
          const needsUniqueInstanceMat = canonicalType === 'boss_ashlord' || canonicalType === 'boss_butcher';
          const isVampireCape = canonicalType === 'vampire_lord' && nm === 'Mage_Cape';
          const mapOneMat = (srcMat) => {
            let baseEm = cfg.baseEmissive || 0x000000;
            let baseEmInt = cfg.baseEmissiveInt || 0;
            if (eliteVariant === 'purple' || eliteVariant === 'blue') {
              baseEm = eliteVariant === 'purple' ? 0x6b21a8 : 0x0369a1;
              baseEmInt = Math.max(baseEmInt, 0.28);
            }
            const buildTinted = () => {
              const m = srcMat.clone();
              if (m.color) {
                if (isVampireCape) {
                  m.color.setHex(0x991b1b);
                } else if (cfg.tint !== null && cfg.tint !== undefined) {
                  m.color.lerp(new THREE.Color(cfg.tint), cfg.tintLerp ?? 0.55);
                }
              }
              if (m.emissive && baseEmInt > 0) {
                m.emissive.setHex(baseEm);
                m.emissiveIntensity = baseEmInt;
              }
              if (SOULS_RIM_ENEMY_TYPES.has(resolvedModelType) || SOULS_RIM_ENEMY_TYPES.has(canonicalType)) {
                applySoulsRimLight(m);
              }
              return m;
            };
            if (needsUniqueInstanceMat) {
              const uniqueMat = buildTinted();
              instanceMats.push({ mat: uniqueMat, baseEmissive: baseEm, baseEmissiveInt: baseEmInt, owned: true });
              return uniqueMat;
            }
            return getMat(`enemy_tint_v3_${resolvedModelType}_${isVampireCape ? 'cape' : 'b'}_${eliteVariant || 'std'}_${srcMat.uuid}`, buildTinted);
          };
          const mapped = Array.isArray(n.material) ? n.material.map(mapOneMat) : mapOneMat(n.material);
          n.material = mapped;
          if (!needsUniqueInstanceMat && n.visible) {
            const softFlash = useSoftHitFlash ? buildSoftHitFlashSlotMat(mapped) : null;
            flashMeshSlots.push({ mesh: n, origMat: mapped, flashMat: softFlash });
          }
        }
      });

      if (weaponHammerBone) {
        calibratedWeaponBoneSeg = calibrateWeaponBoneSegment(inst, weaponHammerBone);
      }

      if (!isRiftTripo && !foundEyeMesh && !usesCustomHead && headBone && cfg.eye) {
        const visorForward = cfg.key === 'knight';
        headBone.add(createGlowingEyePair(cfg.eye, 0.155, visorForward ? 0.38 : 0.40, visorForward ? 0.52 : 0.45));
      }

      if (!isRiftTripo && handR && cfg.weapon) {
        mountedEnemyWeaponProp = makeEnemyWeaponProp(cfg.weapon);
        if (SOULS_RIM_ENEMY_TYPES.has(canonicalType)) {
          applySoulsRimLightToObject(mountedEnemyWeaponProp);
        }
        handR.add(mountedEnemyWeaponProp);
      }

      // === Archetype & Act Boss Signature 3D Sculpted Attachments (KayKit only — never attach to AAA Rift Tripo!) ===
      if (!isRiftTripo) {
      if (canonicalType === 'ember_skeleton') {
        if (chestBone) {
          emberCoreGrp = createMoltenRibcageAndSkullPads();
          chestBone.add(emberCoreGrp);
        }
      } else if (canonicalType === 'goblin' && headBone) {
        headBone.add(createChibiMonsterHead({
          skinHex: 0x659a38,
          eyeHex: 0xff4500,
          ears: 'pointed',
          goblinNose: true
        }));
      } else if (canonicalType === 'werewolf') {
        if (headBone) {
          headBone.add(createChibiMonsterHead({
            skinHex: 0x2f2d36,
            eyeHex: 0xff6a00,
            ears: 'wolf',
            wolfSnout: true
          }));
        }
        if (chestBone) {
          const tail = new THREE.Mesh(
            getGeo('wolf_tail', () => new THREE.ConeGeometry(0.14, 0.54, 7)),
            getMat('wolf_tail_mat', () => new THREE.MeshStandardMaterial({ color: 0x26252c, roughness: 0.8 }))
          );
          tail.position.set(0, -0.05, -0.34);
          tail.rotation.x = -0.95;
          chestBone.add(tail);
        }
      } else if (canonicalType === 'cursed_footman' && handL) {
        const shield = createIronTowerShield();
        handL.add(shield);
        stage1BreakNode = shield;
      } else if (canonicalType === 'iron_knight' && chestBone) {
        chestBone.add(createSpikedPauldronsAndMoltenCore(false));
      } else if (canonicalType === 'dark_cultist') {
        const { headGrp, chestGrp } = createCultistHoodAndSkullClasp();
        if (headBone) headBone.add(headGrp);
        if (chestBone) chestBone.add(chestGrp);
        if (handL) handL.add(createHandSpellOrb(0xf5d0fe, 0xa855f7));
      } else if (canonicalType === 'mummy') {
        const { headGrp, chestGrp } = createMummyHeadAndCollar();
        if (headBone) headBone.add(headGrp);
        if (chestBone) chestBone.add(chestGrp);
      } else if (canonicalType === 'gargoyle') {
        if (headBone) {
          headBone.add(createChibiMonsterHead({
            skinHex: 0x575a64,
            eyeHex: 0xff1e1e,
            ears: 'pointed',
            horns: 'gargoyle'
          }));
        }
        if (chestBone) {
          wingGroup = createBatWings(0x4b4e57, 0x3b3e47, 0.96, false);
          chestBone.add(wingGroup);
        }
      } else if (canonicalType === 'hell_imp') {
        if (headBone) {
          headBone.add(createChibiMonsterHead({
            skinHex: 0xc82222,
            eyeHex: 0xff6a00,
            ears: 'pointed',
            horns: 'imp'
          }));
        }
        if (chestBone) {
          wingGroup = createBatWings(0x7f1d1d, 0x991b1b, 0.88, false);
          chestBone.add(wingGroup);
        }
      } else if (canonicalType === 'vampire_lord') {
        const { headGrp, chestGrp } = createVampireHeadAndCape();
        if (headBone) headBone.add(headGrp);
        if (chestBone) chestBone.add(chestGrp);
        if (handR) handR.add(createHandSpellOrb(0xfecdd3, 0xe11d48));
      } else if (canonicalType === 'boss_butcher') {
        // Act I Boss: Демон Преисподней
        if (headBone) {
          headBone.add(createChibiMonsterHead({
            skinHex: 0x332b2e,
            eyeHex: 0xff5500,
            ears: 'pointed',
            horns: 'demon_magma',
            tusks: true
          }));
        }
        if (chestBone) {
          chestBone.add(createSpikedPauldronsAndMoltenCore(true));
        }
      } else if (canonicalType === 'boss_archlich') {
        // Act II / Stage 10 Boss: Король-Лич Тёмного Пламени
        if (!isTripoEnemy) {
          if (headBone) headBone.add(createArchlichDarkCrown());
          if (chestBone) chestBone.add(createArchlichCollar());
          if (handL) handL.add(createHandSpellOrb(0xf5d0fe, 0xa855f7));
        }

        archlichOrbit = new THREE.Group();
        archlichOrbit.position.y = (isTripoEnemy ? 1.55 : 1.28) * effectiveScaleMult;
        const crystalGeo = getGeo('lich_orbit_crystal', () => new THREE.OctahedronGeometry(0.18, 0));
        const crystalMat = getMat('lich_orbit_violet_mat', () =>
          new THREE.MeshStandardMaterial({
            color: 0xf5d0fe,
            emissive: 0xa855f7,
            emissiveIntensity: 2.4,
            roughness: 0.15
          })
        );
        const orbitR = 1.15 * effectiveScaleMult;
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          const shard = new THREE.Mesh(crystalGeo, crystalMat);
          shard.scale.set(0.82 * effectiveScaleMult, 1.42 * effectiveScaleMult, 0.82 * effectiveScaleMult);
          shard.position.set(Math.cos(a) * orbitR, 0, Math.sin(a) * orbitR);
          archlichOrbit.add(shard);
          archlichCrystals.push(shard);
        }
        root.add(archlichOrbit);
      } else if (canonicalType === 'boss_cthulhu') {
        // Act III Boss: Вестник Бездны
        if (headBone) {
          cthulhuHead = createCthulhuHeadAndTentacles();
          headBone.add(cthulhuHead);
        }
        const { chestProps, baseProps } = createCthulhuArmorAndBaseTentacles();
        if (chestBone) chestBone.add(chestProps);
        baseProps.scale.setScalar(cfg.scale * effectiveScaleMult);
        cthulhuBase = baseProps;
        root.add(baseProps);
        if (handL) handL.add(createHandSpellOrb(0x090d16, 0x06b6d4));
      } else if (canonicalType === 'boss_warden' || canonicalType === 'boss_troll') {
        // Act IV / Stage 10 Co-Boss: Тролль-Костолом с боевым молотом
        if (!isTripoEnemy) {
          if (headBone) {
            headBone.add(createChibiMonsterHead({
              skinHex: 0xa87654,
              eyeHex: 0xff6a00,
              ears: 'ogre',
              tusks: true
            }));
          }
          if (chestBone) {
            chestBone.add(createSpikedPauldronsAndMoltenCore(false));
          }
        }
      } else if (canonicalType === 'boss_ashlord') {
        // Act V Boss: Пепельный Дракон
        if (headBone) {
          headBone.add(createAshenDragonHead());
        }
        if (chestBone) {
          wingGroup = createBatWings(0x18151a, 0x7c2d12, 1.42, true);
          dragonTail = createDragonTailWithFlame();
          chestBone.add(wingGroup, dragonTail, createSpikedPauldronsAndMoltenCore(true));
        }
      }
      } // end if (!isRiftTripo)

      resolvedIdleClip =
        (cfg.idleClip && asset.clips?.has(cfg.idleClip) ? cfg.idleClip : null) ||
        (asset.clips?.has('Idle') ? 'Idle' : null) ||
        (asset.clips?.has('Idle_Combat') ? 'Idle_Combat' : null) ||
        (asset.clips?.has('Idle_B') ? 'Idle_B' : null);
      hasDedicatedIdleClip = Boolean(resolvedIdleClip && resolvedIdleClip !== cfg.moveClip);

      animCtrl = createAnimController(inst, asset.clips, resolvedIdleClip || 'Idle', cfg.moveClip);
      if (canonicalType === 'corrupted_treant' || canonicalType === 'mimic_chest') {
        animCtrl.syncPhase(cfg.moveClip, 0);
      } else {
        animCtrl.mixer.update(Math.random() * 1.2);
      }
    }
  }

  // Clean Artistic Elite Indicator (ZERO flat red circles on Bosses; delicate feathered sigil + floating 3D crystal crest on Elites!)
  let halo = null;
  let innerBossHalo = null;
  let eliteCrest = null;
  const eliteCrestBaseY = (cfg.scale || 0.9) * effectiveScaleMult * 2.18;

  if (!cfg.isBossVisual && !isRiftTripo && (eliteVariant === 'purple' || eliteVariant === 'blue' || eliteVariant === 'warden')) {
    const crestColor =
      eliteVariant === 'purple' ? 0xc084fc : eliteVariant === 'warden' ? 0xfbbf24 : 0x38bdf8;
    const glowColor =
      eliteVariant === 'purple' ? 0x9333ea : eliteVariant === 'warden' ? 0xd97706 : 0x0284c7;

    const sigilTex = getMat('elite_feathered_sigil_tex', () => {
      const sz = 192;
      const cv = document.createElement('canvas');
      cv.width = sz;
      cv.height = sz;
      const c2 = cv.getContext('2d');
      const mid = sz * 0.5;
      const rg = c2.createRadialGradient(mid, mid, sz * 0.08, mid, mid, mid * 0.94);
      rg.addColorStop(0.0, 'rgba(255,255,255,0.10)');
      rg.addColorStop(0.62, 'rgba(255,255,255,0.28)');
      rg.addColorStop(0.80, 'rgba(255,255,255,0.55)');
      rg.addColorStop(0.92, 'rgba(255,255,255,0.12)');
      rg.addColorStop(1.0, 'rgba(255,255,255,0.0)');
      c2.fillStyle = rg;
      c2.fillRect(0, 0, sz, sz);

      c2.strokeStyle = 'rgba(255,255,255,0.72)';
      c2.lineWidth = 2.2;
      c2.beginPath();
      c2.arc(mid, mid, mid * 0.74, 0, Math.PI * 2);
      c2.stroke();

      c2.setLineDash([7, 9]);
      c2.lineWidth = 1.5;
      c2.beginPath();
      c2.arc(mid, mid, mid * 0.58, 0, Math.PI * 2);
      c2.stroke();
      c2.setLineDash([]);

      for (let k = 0; k < 4; k++) {
        const ka = (k / 4) * Math.PI * 2;
        const px = mid + Math.cos(ka) * mid * 0.74;
        const py = mid + Math.sin(ka) * mid * 0.74;
        c2.fillStyle = 'rgba(255,255,255,0.92)';
        c2.beginPath();
        c2.arc(px, py, 3.6, 0, Math.PI * 2);
        c2.fill();
      }
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    });

    halo = new THREE.Mesh(
      getGeo('elite_sigil_plane', () => {
        const pg = new THREE.PlaneGeometry(1.62, 1.62);
        pg.rotateX(-Math.PI / 2);
        return pg;
      }),
      getMat(`elite_sigil_mat_${crestColor}`, () =>
        new THREE.MeshBasicMaterial({
          map: sigilTex,
          color: crestColor,
          transparent: true,
          opacity: 0.44,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false
        })
      )
    );
    halo.position.y = 0.032;
    halo.scale.setScalar(effectiveScaleMult);
    root.add(halo);

    eliteCrest = new THREE.Group();
    const gemMesh = new THREE.Mesh(
      getGeo('elite_crest_gem', () => new THREE.OctahedronGeometry(0.135, 0)),
      getMat(`elite_crest_mat_${crestColor}`, () =>
        new THREE.MeshStandardMaterial({
          color: crestColor,
          emissive: glowColor,
          emissiveIntensity: 2.1,
          roughness: 0.15,
          metalness: 0.35
        })
      )
    );
    gemMesh.scale.set(0.82, 1.48, 0.82);
    const orbitBand = new THREE.Mesh(
      getGeo('elite_crest_ring', () => {
        const tg = new THREE.TorusGeometry(0.19, 0.018, 6, 16);
        tg.rotateX(Math.PI * 0.5);
        return tg;
      }),
      getMat(`elite_crest_band_${crestColor}`, () =>
        new THREE.MeshBasicMaterial({
          color: crestColor,
          transparent: true,
          opacity: 0.78,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false
        })
      )
    );
    eliteCrest.add(gemMesh, orbitBand);
    eliteCrest.position.set(0, eliteCrestBaseY, 0);
    root.add(eliteCrest);
  }

  // Soft Grounded Contact AO Shadow Disk under every enemy & Boss (on root so it stays flat during posture pitch/roll!)
  const contactShadowRadius =
    (cfg.contactShadowRadius || (cfg.isBossVisual ? 1.92 : Math.max(0.66, (cfg.scale || 1.0) * 0.72))) *
    effectiveScaleMult;
  const contactShadow = createActorContactShadowMesh({
    radius: contactShadowRadius,
    isBoss: Boolean(cfg.isBossVisual),
    opacity: cfg.isBossVisual ? 0.74 : 0.62,
    yOffset: 0.015
  });
  root.add(contactShadow);

  let inPool = false;
  let isDying = false;
  let deathBaseY = 0;
  let proceduralFall = false;
  let hitJoltTimer = 0;
  let hitJoltAmp = 1.0;
  let hitReactCooldown = 0;
  let hitTwistDir = 1;
  let baseClipOverride = null;
  let baseClipOverrideSpeed = null;
  let activeClampedAction = null;
  let activeClampedClipName = null;
  let prevClampedFromAction = null;
  let activeClampedDuration = 0;
  let activeClampedElapsed = 0;
  let activeClampedBlendSec = 0.08;
  const CLAMPED_BLEND_IN_SEC = 0.08;
  let activeCutsceneAction = null;
  let prevCutsceneFromAction = null;
  let cutsceneBlendElapsed = 0;
  let cutsceneBlendDur = 0.22;
  let cutsceneLastPerfMs = 0;

  // Zero-alloc locomotion, ground-displacement & dynamic combat posture state (soulsPhysicsFeel.js)
  let prevRootX = root.position.x;
  let prevRootZ = root.position.z;
  let prevRootYaw = root.rotation.y;
  let hasPrevRootPose = false;
  let hasEverMovedRoot = false;
  let zeroDispSec = 0;
  let lastExplicitMode = null;
  let lastExplicitVx = null;
  let lastExplicitVz = null;
  let lastExplicitLocalX = null;
  let lastExplicitLocalZ = null;
  let lastExplicitIsMoving = null;
  let lastExplicitSpeedMult = null;
  let lastExplicitActualSpeed = null;
  let lastExplicitTurnDelta = null;
  let lastPosturePhase = null;
  let lastPosturePhase01 = null;
  let lastPostureMoveType = null;
  let lastPostureBlocking = false;
  let lastPostureInCombat = false;
  let lastPostureStaggered = false;
  let lastPostureDead = false;
  let lastAttackClipPlayed = cfg.atkClip || 'Attack_Slash_1';

  const isColossalBossPhysics = Boolean(
    cfg.isBossVisual &&
      (cfg.physicsType === 'boss_troll' || cfg.key === 'troll_tripo' || cfg.key === 'rift_boss')
  );
  const physicsActorState = {
    uid: enemyUid,
    type: cfg.physicsType || canonicalType,
    x: 0,
    z: 0,
    vx: 0,
    vz: 0,
    facing: 0,
    scale: (cfg.scale || 1.0) * effectiveScaleMult,
    soulsAwake: false,
    isSoulsBoss: isColossalBossPhysics,
    isDying: false,
    soulsThronePhase: null,
    soulsState: null
  };
  const footSyncOpts = {
    type: cfg.physicsType || canonicalType,
    strafeAnimMode: 'combat_walk',
    clipDuration: 1.0,
    scale: (cfg.scale || 1.0) * effectiveScaleMult,
    smoothDt: 0.016
  };
  const postureOpts = {
    vx: 0,
    vz: 0,
    facing: 0,
    turnRate: 0,
    scale: (cfg.scale || 1.0) * effectiveScaleMult,
    combatPhase: 'neutral',
    combatPhase01: 0,
    moveType: 'slash',
    isBlocking: false,
    inCombat: false,
    isDead: false,
    elapsedTime: 0,
    timeSec: 0
  };
  const postureApplyOpts = {
    isLocalChild: true,
    baseY: 0,
    applyForwardLean: false,
    applyBobY: false
  };

  function resolveEnemyLocomotionClip(mode, isMovingFlag, speedMultVal, localX, localZ, yawRateVal) {
    const has = (name) => Boolean(name && animCtrl?.getAction?.(name));
    const pick = (...names) => {
      for (let i = 0; i < names.length; i++) {
        if (has(names[i])) return names[i];
      }
      return cfg.moveClip;
    };
    let m = typeof mode === 'string' && mode ? mode.toLowerCase() : null;
    if (!m) {
      if (!isMovingFlag) {
        if (Math.abs(yawRateVal) > 1.35 && (has('Turn_Left') || has('Turn_Right'))) {
          m = yawRateVal > 0 ? 'turn_left' : 'turn_right';
        } else {
          m = 'idle';
        }
      } else if (Math.abs(localX) > Math.abs(localZ) * 0.85 && Math.abs(localX) > 0.25) {
        m = localX > 0 ? 'strafe_left' : 'strafe_right';
      } else if (localZ < -0.45 && (has('Walk_Backward') || has('Backstep_Evade'))) {
        m = 'backstep';
      } else if (speedMultVal < 0.62 && has(cfg.patrolClip || 'Patrol_Walk')) {
        m = 'patrol';
      } else {
        m = 'combat_walk';
      }
    }
    switch (m) {
      case 'idle':
        return { mode: 'idle', clip: resolvedIdleClip || cfg.idleClip || 'Idle', isIdle: true };
      case 'patrol':
        return { mode: 'patrol', clip: pick(cfg.patrolClip, 'Patrol_Walk', cfg.moveClip), isIdle: false };
      case 'combat_walk':
        return { mode: 'combat_walk', clip: pick('Combat_Walk', cfg.moveClip), isIdle: false };
      case 'strafe_left':
        return { mode: 'strafe_left', clip: pick('Strafe_Left', 'Combat_Walk', cfg.moveClip), isIdle: false };
      case 'strafe_right':
        return { mode: 'strafe_right', clip: pick('Strafe_Right', 'Combat_Walk', cfg.moveClip), isIdle: false };
      case 'turn_left': {
        const turnClip = pick('Turn_Left', 'Strafe_Left', resolvedIdleClip || 'Idle');
        return { mode: 'turn_left', clip: turnClip, isIdle: turnClip === (resolvedIdleClip || 'Idle') };
      }
      case 'turn_right': {
        const turnClip = pick('Turn_Right', 'Strafe_Right', resolvedIdleClip || 'Idle');
        return { mode: 'turn_right', clip: turnClip, isIdle: turnClip === (resolvedIdleClip || 'Idle') };
      }
      case 'backstep':
        return { mode: 'backstep', clip: pick('Walk_Backward', 'Backstep_Evade', 'Combat_Walk', cfg.moveClip), isIdle: false };
      default:
        return isMovingFlag
          ? { mode: 'combat_walk', clip: pick(cfg.moveClip, 'Combat_Walk'), isIdle: false }
          : { mode: 'idle', clip: resolvedIdleClip || cfg.idleClip || 'Idle', isIdle: true };
    }
  }

  function getWeaponSegmentWorld() {
    const activeWeaponBone = weaponHammerBone || handR;
    if (activeWeaponBone) {
      // Ancestor-only chain update (~6 bones instead of recursive 67-bone full armature walk!)
      activeWeaponBone.updateWorldMatrix(true, false);
    } else {
      root.updateWorldMatrix(true, false);
    }
    const activeWeaponSeg = weaponHammerBone
      ? (calibratedWeaponBoneSeg || cfg.weaponBoneSegment)
      : cfg.weaponBoneSegment;
    if (activeWeaponBone && activeWeaponSeg) {
      const seg = activeWeaponSeg;
      _enemyWepHilt.set(seg.hilt[0], seg.hilt[1], seg.hilt[2]).applyMatrix4(activeWeaponBone.matrixWorld);
      _enemyWepTip.set(seg.tip[0], seg.tip[1], seg.tip[2]).applyMatrix4(activeWeaponBone.matrixWorld);
      if (
        Number.isFinite(_enemyWepHilt.x) &&
        Number.isFinite(_enemyWepHilt.y) &&
        Number.isFinite(_enemyWepHilt.z) &&
        Number.isFinite(_enemyWepTip.x) &&
        Number.isFinite(_enemyWepTip.y) &&
        Number.isFinite(_enemyWepTip.z) &&
        _enemyWepHilt.distanceToSquared(_enemyWepTip) >= 0.04
      ) {
        return {
          hiltX: _enemyWepHilt.x,
          hiltY: _enemyWepHilt.y,
          hiltZ: _enemyWepHilt.z,
          tipX: _enemyWepTip.x,
          tipY: _enemyWepTip.y,
          tipZ: _enemyWepTip.z
        };
      }
    }
    if (mountedEnemyWeaponProp) {
      _enemyWepHilt.set(0, 0.05, 0).applyMatrix4(mountedEnemyWeaponProp.matrixWorld);
      _enemyWepTip.set(0, 1.05, 0).applyMatrix4(mountedEnemyWeaponProp.matrixWorld);
      if (
        Number.isFinite(_enemyWepHilt.x) &&
        Number.isFinite(_enemyWepTip.x) &&
        _enemyWepHilt.distanceToSquared(_enemyWepTip) >= 0.04
      ) {
        return {
          hiltX: _enemyWepHilt.x,
          hiltY: _enemyWepHilt.y,
          hiltZ: _enemyWepHilt.z,
          tipX: _enemyWepTip.x,
          tipY: _enemyWepTip.y,
          tipZ: _enemyWepTip.z
        };
      }
    }
    const yaw = root.rotation?.y || 0;
    const fwdX = Math.sin(yaw);
    const fwdZ = Math.cos(yaw);
    let hx = root.position.x + fwdX * 0.25;
    let hy = root.position.y + (cfg.isBossVisual ? 1.9 : 1.05);
    let hz = root.position.z + fwdZ * 0.25;
    const fallbackWepBone = weaponHammerBone || handR;
    if (fallbackWepBone) {
      fallbackWepBone.getWorldPosition(_enemyWepHilt);
      if (Number.isFinite(_enemyWepHilt.x) && Number.isFinite(_enemyWepHilt.y) && Number.isFinite(_enemyWepHilt.z)) {
        hx = _enemyWepHilt.x;
        hy = _enemyWepHilt.y;
        hz = _enemyWepHilt.z;
      }
    }
    const reach = cfg.isBossVisual ? 2.4 : 1.45;
    return {
      hiltX: hx,
      hiltY: hy,
      hiltZ: hz,
      tipX: hx + fwdX * reach,
      tipY: hy,
      tipZ: hz + fwdZ * reach
    };
  }

  // Additive live Boss jaw, forward neck/head chest-clearance clamp & gentle damped head-speech accent:
  // undone before every mixer evaluation and re-applied after it, so no bone EVER accumulates drift.
  let headAdditiveApplied = false;
  const headPreAdditiveQ = new THREE.Quaternion();
  function restoreJawAdditive() {
    if (jawAdditiveApplied && jawBone) {
      jawBone.quaternion.copy(jawPreAdditiveQ);
    }
    if (headAdditiveApplied && headBone) {
      headBone.quaternion.copy(headPreAdditiveQ);
    }
    if (neckClampApplied && neckBone) {
      neckBone.quaternion.copy(neckPreAdditiveQ);
    }
    if (torsoFlinchApplied) {
      if (spineBone) spineBone.quaternion.copy(spinePreFlinchQ);
      if (spine1Bone) spine1Bone.quaternion.copy(spine1PreFlinchQ);
      if (spine2Bone) spine2Bone.quaternion.copy(spine2PreFlinchQ);
    }
    jawAdditiveApplied = false;
    headAdditiveApplied = false;
    neckClampApplied = false;
    torsoFlinchApplied = false;
  }

  function clampBossNeckHeadForwardPitch() {
    if (isDying || cfg.key !== 'rift_boss' || (!neckBone && !headBone)) return;
    const yaw = root.rotation?.y || 0;
    const fwdX = Math.sin(yaw);
    const fwdZ = Math.cos(yaw);
    // Right axis in world space = (cos(yaw), 0, -sin(yaw)); +angle pitches forward/down, -angle lifts upward/back!
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);

    if (neckBone && neckBone.parent) {
      neckBone.parent.updateWorldMatrix(true, false);
      neckBone.updateWorldMatrix(false, false);
      neckBone.getWorldQuaternion(_flinchBoneW);
      _headUpVecW.set(0, 1, 0).applyQuaternion(_flinchBoneW);
      const fwdTilt = Math.atan2(_headUpVecW.x * fwdX + _headUpVecW.z * fwdZ, Math.max(0.05, _headUpVecW.y));
      if (fwdTilt > 0.34) {
        if (!neckClampApplied) {
          neckPreAdditiveQ.copy(neckBone.quaternion);
          neckClampApplied = true;
        }
        const corr = -(fwdTilt - 0.34);
        neckBone.parent.getWorldQuaternion(_flinchParentInvQ).invert();
        _flinchWorldAxis.set(rx, 0, rz).normalize();
        _flinchDeltaW.setFromAxisAngle(_flinchWorldAxis, corr);
        _flinchBoneW.premultiply(_flinchDeltaW);
        neckBone.quaternion.copy(_flinchParentInvQ).multiply(_flinchBoneW).normalize();
        neckBone.updateMatrixWorld(false);
      }
    }

    if (headBone && headBone.parent) {
      headBone.parent.updateWorldMatrix(true, false);
      headBone.updateWorldMatrix(false, false);
      headBone.getWorldQuaternion(_flinchBoneW);
      _headUpVecW.set(0, 1, 0).applyQuaternion(_flinchBoneW);
      const fwdTilt = Math.atan2(_headUpVecW.x * fwdX + _headUpVecW.z * fwdZ, Math.max(0.05, _headUpVecW.y));
      if (fwdTilt > 0.38) {
        if (!headAdditiveApplied) {
          headPreAdditiveQ.copy(headBone.quaternion);
          headAdditiveApplied = true;
        }
        const corr = -(fwdTilt - 0.38);
        headBone.parent.getWorldQuaternion(_flinchParentInvQ).invert();
        _flinchWorldAxis.set(rx, 0, rz).normalize();
        _flinchDeltaW.setFromAxisAngle(_flinchWorldAxis, corr);
        _flinchBoneW.premultiply(_flinchDeltaW);
        headBone.quaternion.copy(_flinchParentInvQ).multiply(_flinchBoneW).normalize();
        headBone.updateMatrixWorld(false);
      }
    }
  }

  function applyRiftTorsoFlinch(safeDt) {
    if (hitJoltTimer <= 0 || isDying || activeCutsceneAction || activeClampedAction) {
      hitJoltTimer = Math.max(0, hitJoltTimer - safeDt);
      return;
    }
    hitJoltTimer = Math.max(0, hitJoltTimer - safeDt);
    if (!cfg.isRiftTripo || (!spineBone && !spine1Bone && !spine2Bone)) return;
    const u = hitJoltDur > 0.01 ? Math.max(0, Math.min(1, 1 - hitJoltTimer / hitJoltDur)) : 1;
    const env = Math.sin(Math.pow(u, 0.58) * Math.PI) * Math.exp(-2.1 * u);
    if (env <= 0.004) return;

    if (spineBone) spinePreFlinchQ.copy(spineBone.quaternion);
    if (spine1Bone) spine1PreFlinchQ.copy(spine1Bone.quaternion);
    if (spine2Bone) spine2PreFlinchQ.copy(spine2Bone.quaternion);
    torsoFlinchApplied = true;

    const isBossRig = cfg.key === 'rift_boss';
    const baseRad = isBossRig ? 0.24 : 0.42;
    const maxAmp = isBossRig ? 1.30 : 1.85;
    const clampedAmp = Math.min(maxAmp, Math.max(0.45, hitJoltAmp));
    // Strictly negative (<= 0) backward chest recoil so flinches NEVER pitch torso/head downward!
    const totalPitchBack = -Math.abs(baseRad * clampedAmp * env);
    const totalYawWrench = baseRad * 0.64 * hitTwistDir * Math.min(isBossRig ? 1.25 : 1.75, clampedAmp) * env;
    const yaw = root.rotation?.y || 0;
    // Right axis in world space = (cos(yaw), 0, -sin(yaw)); +angle pitches forward, so negative pitches backward!
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);

    const applyBoneShare = (bone, share) => {
      if (!bone || !bone.parent) return;
      bone.parent.updateWorldMatrix(true, false);
      bone.updateWorldMatrix(false, false);
      bone.parent.getWorldQuaternion(_flinchParentInvQ).invert();
      bone.getWorldQuaternion(_flinchBoneW);
      _flinchWorldAxis.set(rx, 0, rz).normalize();
      _flinchDeltaW.setFromAxisAngle(_flinchWorldAxis, totalPitchBack * share);
      _flinchBoneW.premultiply(_flinchDeltaW);
      _flinchWorldAxis.set(0, 1, 0);
      _flinchDeltaW.setFromAxisAngle(_flinchWorldAxis, totalYawWrench * share);
      _flinchBoneW.premultiply(_flinchDeltaW);
      bone.quaternion.copy(_flinchParentInvQ).multiply(_flinchBoneW).normalize();
      bone.updateMatrixWorld(false);
    };

    applyBoneShare(spineBone, 0.32);
    applyBoneShare(spine1Bone, 0.38);
    applyBoneShare(spine2Bone, 0.44);
  }

  function computeBossRoarJawOpen01() {
    if (cfg.key !== 'rift_boss' || isDying) return 0;
    const isRoarClamped =
      Boolean(activeClampedAction) &&
      (activeClampedClipName === 'Roar_Taunt' || activeClampedClipName === 'Cutscene_Rise_Roar');
    const isRoarState =
      physicsActorState.soulsState === 'roar_taunt' || physicsActorState.soulsState === 'phase2_roar';
    if (!isRoarClamped && !isRoarState) return 0;
    if (isRoarClamped && activeClampedDuration > 0.05) {
      const u = Math.max(0, Math.min(1, activeClampedElapsed / activeClampedDuration));
      const env = smoothstep01(0.01, 0.10, u) * (1 - smoothstep01(0.80, 0.97, u));
      const tremor = 1 - 0.04 * (0.5 - 0.5 * Math.cos(activeClampedElapsed * 22.0));
      return Math.max(0, Math.min(1, env * tremor));
    }
    return 0.92;
  }

  function applyJawAdditive() {
    if (isDying) return;
    const roarOpen01 = computeBossRoarJawOpen01();
    const effSpeech01 = cfg.key === 'rift_boss' ? bossMouthSmooth : mouthOpen01;
    if (effSpeech01 <= 0.001 && roarOpen01 <= 0.001 && headSpeechDamped <= 0.001) return;

    if (jawBone) {
      if (cfg.key === 'rift_boss') {
        // Real lower-jaw articulation on Rift_Boss_Tripo.glb (z83 isolated Jaw skin weights below mouth):
        //   - Dialogue speech: 0 .. 0.16 rad driven by bossMouthSmooth
        //   - Roar_Taunt / phase2_roar: crisp 0.15 rad open (zero stretched chin / face protrusion!)
        const targetJawRad = Math.max(effSpeech01 * 0.16, roarOpen01 * 0.15);
        if (targetJawRad > 0.0008) {
          let addRad = targetJawRad;
          if (hasJawBindQuat && roarOpen01 > 0.001) {
            _jawBindInvQ.copy(jawBindQuat).invert();
            _jawRelQ.copy(_jawBindInvQ).multiply(jawBone.quaternion);
            if (_jawRelQ.w < 0) {
              _jawRelQ.x = -_jawRelQ.x;
              _jawRelQ.w = -_jawRelQ.w;
            }
            const bakedPitchX = 2 * Math.atan2(_jawRelQ.x, Math.max(1e-4, _jawRelQ.w));
            if (bakedPitchX > 0) {
              addRad = Math.max(0, targetJawRad - bakedPitchX);
            }
          }
          if (addRad > 0.0005) {
            jawPreAdditiveQ.copy(jawBone.quaternion);
            jawBone.rotateX(Math.min(0.16, addRad));
            jawAdditiveApplied = true;
          }
        }
      } else if (mouthOpen01 > 0.001) {
        jawPreAdditiveQ.copy(jawBone.quaternion);
        jawBone.rotateX(mouthOpen01 * 0.11);
        jawAdditiveApplied = true;
      }
    }
    if (headBone && cfg.key === 'rift_boss') {
      const headWeight = headSpeechDamped > 0.001 ? headSpeechDamped : effSpeech01;
      if (headWeight > 0.001 && headBone.parent) {
        if (!headAdditiveApplied) {
          headPreAdditiveQ.copy(headBone.quaternion);
          headAdditiveApplied = true;
        }
        const yaw = root.rotation?.y || 0;
        headBone.parent.updateWorldMatrix(true, false);
        headBone.updateWorldMatrix(false, false);
        headBone.parent.getWorldQuaternion(_flinchParentInvQ).invert();
        headBone.getWorldQuaternion(_flinchBoneW);
        _flinchWorldAxis.set(Math.cos(yaw), 0, -Math.sin(yaw)).normalize();
        _flinchDeltaW.setFromAxisAngle(_flinchWorldAxis, -headWeight * 0.028);
        _flinchBoneW.premultiply(_flinchDeltaW);
        headBone.quaternion.copy(_flinchParentInvQ).multiply(_flinchBoneW).normalize();
        headBone.updateMatrixWorld(false);
      }
    }
  }

  function stopCutsceneInternal() {
    if (prevCutsceneFromAction) {
      prevCutsceneFromAction.stopFading();
      prevCutsceneFromAction.setEffectiveWeight(0);
      prevCutsceneFromAction.stop();
      prevCutsceneFromAction = null;
    }
    if (activeCutsceneAction) {
      activeCutsceneAction.stopFading();
      activeCutsceneAction.setEffectiveWeight(0);
      activeCutsceneAction.stop();
      activeCutsceneAction = null;
    }
    cutsceneBlendElapsed = 0;
    cutsceneBlendDur = 0.22;
    cutsceneLastPerfMs = 0;
  }

  function advanceCutsceneBlend(dtSec) {
    if (!activeCutsceneAction) return;
    if (prevCutsceneFromAction) {
      if (dtSec > 0) cutsceneBlendElapsed += dtSec;
      const rawW = cutsceneBlendDur > 1e-4 ? Math.min(1, cutsceneBlendElapsed / cutsceneBlendDur) : 1.0;
      const wIn = smoothstep01(0, 1, rawW);
      if (rawW >= 1.0) {
        prevCutsceneFromAction.stopFading();
        prevCutsceneFromAction.setEffectiveWeight(0);
        prevCutsceneFromAction.stop();
        prevCutsceneFromAction = null;
        activeCutsceneAction.setEffectiveWeight(1.0);
      } else {
        prevCutsceneFromAction.enabled = true;
        prevCutsceneFromAction.setEffectiveWeight(1.0 - wIn);
        activeCutsceneAction.setEffectiveWeight(wIn);
      }
    } else {
      activeCutsceneAction.setEffectiveWeight(1.0);
    }
  }

  function stopClampedInternal() {
    if (prevClampedFromAction) {
      prevClampedFromAction.stopFading();
      prevClampedFromAction.setEffectiveWeight(0);
      prevClampedFromAction.stop();
      prevClampedFromAction = null;
    }
    if (activeClampedAction) {
      activeClampedAction.stopFading();
      activeClampedAction.setEffectiveWeight(0);
      activeClampedAction.stop();
      activeClampedAction = null;
    }
    activeClampedClipName = null;
    activeClampedDuration = 0;
    activeClampedElapsed = 0;
  }

  const handle = {
    root,
    modelType: resolvedModelType,
    contactShadow,
    getWeaponSegmentWorld,
    hasJawBone: Boolean(jawBone),
    // Real-time Boss lip-sync: clean lower-jaw articulation (0..0.26 rad) + gentle damped head speech accent layered after the mixer.
    setBossMouthOpen(open01 = 0) {
      const v = Number(open01);
      mouthOpen01 = Number.isFinite(v) ? (v < 0 ? 0 : v > 1 ? 1 : v) : 0;
      bossMouthSmooth = mouthOpen01 <= 0.001
        ? (bossMouthSmooth < 0.008 ? 0 : bossMouthSmooth * 0.55)
        : (bossMouthSmooth + (mouthOpen01 - bossMouthSmooth) * 0.52);
      headSpeechDamped = mouthOpen01 <= 0.001
        ? 0
        : (headSpeechDamped + (mouthOpen01 - headSpeechDamped) * 0.35);
      if (!jawBone && !(headBone && cfg.key === 'rift_boss')) return false;
      restoreJawAdditive();
      clampBossNeckHeadForwardPitch();
      applyJawAdditive();
      return true;
    },
    getBossMouthOpen() {
      return mouthOpen01;
    },
    setLocomotionState(opts = null) {
      if (!opts || typeof opts !== 'object') {
        lastExplicitMode = null;
        lastExplicitVx = null;
        lastExplicitVz = null;
        lastExplicitLocalX = null;
        lastExplicitLocalZ = null;
        lastExplicitIsMoving = null;
        lastExplicitSpeedMult = null;
        lastExplicitActualSpeed = null;
        lastExplicitTurnDelta = null;
        return;
      }
      if (opts.strafeAnimMode !== undefined || opts.mode !== undefined) {
        const m = opts.strafeAnimMode ?? opts.mode;
        lastExplicitMode = typeof m === 'string' && m ? m : null;
      }
      if (opts.vx !== undefined) lastExplicitVx = Number.isFinite(Number(opts.vx)) ? Number(opts.vx) : null;
      if (opts.vz !== undefined) lastExplicitVz = Number.isFinite(Number(opts.vz)) ? Number(opts.vz) : null;
      if (opts.moveLocalX !== undefined) lastExplicitLocalX = Number.isFinite(Number(opts.moveLocalX)) ? Number(opts.moveLocalX) : null;
      if (opts.moveLocalZ !== undefined) lastExplicitLocalZ = Number.isFinite(Number(opts.moveLocalZ)) ? Number(opts.moveLocalZ) : null;
      if (opts.isMoving !== undefined) lastExplicitIsMoving = Boolean(opts.isMoving);
      if (opts.speedMult !== undefined) lastExplicitSpeedMult = Number.isFinite(Number(opts.speedMult)) ? Number(opts.speedMult) : null;
      if (opts.actualSpeed !== undefined) lastExplicitActualSpeed = Number.isFinite(Number(opts.actualSpeed)) ? Math.max(0, Number(opts.actualSpeed)) : null;
      if (opts.turnDelta !== undefined) lastExplicitTurnDelta = Number.isFinite(Number(opts.turnDelta)) ? Number(opts.turnDelta) : null;
    },
    setCombatPostureState(opts = null) {
      if (!opts || typeof opts !== 'object') {
        lastPosturePhase = null;
        lastPosturePhase01 = null;
        lastPostureMoveType = null;
        lastPostureBlocking = false;
        lastPostureStaggered = false;
        lastPostureDead = false;
        physicsActorState.soulsThronePhase = null;
        physicsActorState.soulsState = null;
        return;
      }
      if (opts.isDead !== undefined) lastPostureDead = Boolean(opts.isDead);
      if (opts.soulsThronePhase !== undefined) {
        physicsActorState.soulsThronePhase = typeof opts.soulsThronePhase === 'string' ? opts.soulsThronePhase : null;
      }
      if (opts.soulsState !== undefined) {
        physicsActorState.soulsState = typeof opts.soulsState === 'string' ? opts.soulsState : null;
      }
      if (opts.combatPhase !== undefined || opts.phase !== undefined || opts.bossPosture !== undefined) {
        const ph = opts.combatPhase ?? opts.phase ?? opts.bossPosture;
        lastPosturePhase = typeof ph === 'string' && ph ? ph : null;
      } else if (opts.isStaggered) {
        lastPosturePhase = 'stagger';
      } else if (opts.isWindup) {
        lastPosturePhase = 'windup';
      } else if (opts.isSwingActive) {
        lastPosturePhase = 'active';
      } else if (opts.isRecovering) {
        lastPosturePhase = 'recover';
      } else if (opts.isWindup === false && opts.isSwingActive === false && opts.isRecovering === false) {
        lastPosturePhase = null;
      }
      if (opts.combatPhase01 !== undefined || opts.phase01 !== undefined || opts.windupProgress !== undefined) {
        const p01 = opts.combatPhase01 ?? opts.phase01 ?? opts.windupProgress;
        lastPosturePhase01 = Number.isFinite(Number(p01)) ? Number(p01) : null;
      }
      if (opts.moveType !== undefined || opts.attackKey !== undefined) {
        const mt = opts.moveType ?? opts.attackKey;
        lastPostureMoveType = typeof mt === 'string' && mt ? mt : null;
      }
      if (opts.isBlocking !== undefined) lastPostureBlocking = Boolean(opts.isBlocking);
      if (opts.inCombat !== undefined || opts.isAlerted !== undefined) {
        lastPostureInCombat = Boolean(opts.inCombat ?? opts.isAlerted);
      }
      if (opts.isStaggered !== undefined) lastPostureStaggered = Boolean(opts.isStaggered);
    },
    applyRecoilImpulse(opts = null) {
      if (isDying) return;
      applyCombatRecoilImpulse(physicsActorState, opts || { kind: 'hitRecoil', intensity: 1.0 });
    },
    setClipOverride(clipName = null, speed = null, snap = false) {
      baseClipOverride = typeof clipName === 'string' && clipName ? clipName : null;
      baseClipOverrideSpeed =
        baseClipOverride && Number.isFinite(Number(speed)) && Number(speed) > 0 ? Number(speed) : null;
      if (snap && baseClipOverride && animCtrl && !isDying) {
        stopCutsceneInternal();
        stopClampedInternal();
        const spd = baseClipOverrideSpeed ?? 1.0;
        animCtrl.setBaseState(baseClipOverride, spd);
        animCtrl.updateOneShotFade?.(0.25);
        const act = animCtrl.getAction?.(baseClipOverride);
        if (act) {
          act.time = 0;
          act.setEffectiveWeight(1.0);
        }
        animCtrl.mixer.update(0);
      }
    },
    // Smoothly transfers any active one-shot attack (or Recover_Heft tail) into a looping base override
    // (e.g., Heavy_Cleave -> Whirl_Spin) so an outgoing one-shot NEVER blocks base clip overrides!
    handoffToClipOverride(clipName = null, speed = null, blendSec = 0.20) {
      baseClipOverride = typeof clipName === 'string' && clipName ? clipName : null;
      baseClipOverrideSpeed =
        baseClipOverride && Number.isFinite(Number(speed)) && Number(speed) > 0 ? Number(speed) : null;
      if (!baseClipOverride || !animCtrl || isDying) return false;
      const spd = baseClipOverrideSpeed ?? 1.0;
      const safeBlend = Number.isFinite(Number(blendSec)) ? Math.max(0.06, Math.min(0.45, Number(blendSec))) : 0.20;
      if (activeCutsceneAction) {
        handle.clearCutsceneClip(safeBlend);
      }
      if (activeClampedAction) {
        handle.clearClampedClip(false, 0);
      }
      if (typeof animCtrl.handoffOneShotToBase === 'function') {
        animCtrl.handoffOneShotToBase(baseClipOverride, spd, safeBlend);
      } else {
        animCtrl.cancelOneShot?.();
        animCtrl.setBaseState(baseClipOverride, spd, safeBlend);
      }
      restoreJawAdditive();
      animCtrl.mixer.update(0);
      clampBossNeckHeadForwardPitch();
      applyJawAdditive();
      return true;
    },
    // Smoothly releases any lingering one-shot (e.g., short Recover_Heft) directly back into base locomotion/Idle
    // with strict wSum === 1.000 and ZERO 1-frame snap or ice-skating!
    handoffToBase(clipName = null, speed = 1.0, blendSec = 0.20) {
      baseClipOverride = null;
      baseClipOverrideSpeed = null;
      if (!animCtrl || isDying) return false;
      const target = typeof clipName === 'string' && clipName ? clipName : (resolvedIdleClip || cfg.idleClip || 'Idle');
      const spd = Number.isFinite(Number(speed)) && Number(speed) > 0 ? Number(speed) : 1.0;
      const safeBlend = Number.isFinite(Number(blendSec)) ? Math.max(0.06, Math.min(0.45, Number(blendSec))) : 0.20;
      if (typeof animCtrl.handoffOneShotToBase === 'function') {
        animCtrl.handoffOneShotToBase(target, spd, safeBlend);
      } else {
        animCtrl.cancelOneShot?.();
        animCtrl.setBaseState(target, spd, safeBlend);
      }
      restoreJawAdditive();
      animCtrl.mixer.update(0);
      clampBossNeckHeadForwardPitch();
      applyJawAdditive();
      return true;
    },
    // FPS-independent normalized cutscene scrubber for Boss intro acting (Throne_Intro_Dialogue / Throne_Intro_StandUp).
    // Smoothly cross-fades into `clipName` over `blendSec`, freezes `act.paused = true`, and pins
    // `act.time = clamp01(u01) * clip.duration` with strict wSum === 1.000 on every frame!
    setCutsceneClipNormalized(clipName, u01 = 0, blendSec = 0.22) {
      if (isDying || !animCtrl || typeof clipName !== 'string' || !clipName) {
        return false;
      }
      const act = animCtrl.getAction?.(clipName);
      if (!act) return false;
      const clip = act.getClip?.();
      const dur = clip?.duration > 0 ? clip.duration : 1.0;
      const clampedU = Math.max(0, Math.min(1, Number.isFinite(Number(u01)) ? Number(u01) : 0));
      const safeBlend = Number.isFinite(Number(blendSec)) ? Math.max(0, Math.min(0.8, Number(blendSec))) : 0.22;
      const nowMs = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();

      if (activeCutsceneAction !== act) {
        const preferredOutgoing =
          (activeCutsceneAction && activeCutsceneAction !== act ? activeCutsceneAction : null) ||
          (activeClampedAction && activeClampedAction !== act ? activeClampedAction : null);
        // Clear clamped pointers without stopping preferredOutgoing if it will be handed off
        if (prevClampedFromAction && prevClampedFromAction !== preferredOutgoing) {
          prevClampedFromAction.stopFading();
          prevClampedFromAction.setEffectiveWeight(0);
          prevClampedFromAction.stop();
        }
        prevClampedFromAction = null;
        activeClampedAction = null;
        activeClampedClipName = null;
        activeClampedDuration = 0;
        activeClampedElapsed = 0;
        baseClipOverride = null;
        baseClipOverrideSpeed = null;

        const rawFromAct = animCtrl.prepareExternalClip
          ? animCtrl.prepareExternalClip(act, safeBlend > 0.005 ? preferredOutgoing : null)
          : null;
        if (safeBlend <= 0.005 && rawFromAct && rawFromAct !== act) {
          rawFromAct.stopFading();
          rawFromAct.setEffectiveWeight(0);
          rawFromAct.stop();
        }
        const fromAct = safeBlend > 0.005 ? rawFromAct : null;
        if (prevCutsceneFromAction && prevCutsceneFromAction !== fromAct) {
          prevCutsceneFromAction.stopFading();
          prevCutsceneFromAction.setEffectiveWeight(0);
          prevCutsceneFromAction.stop();
        }
        prevCutsceneFromAction = safeBlend > 0.005 ? (fromAct || null) : null;
        if (prevCutsceneFromAction) {
          prevCutsceneFromAction.paused = true;
          prevCutsceneFromAction.enabled = true;
          prevCutsceneFromAction.setEffectiveWeight(1.0);
        }
        if (activeCutsceneAction && activeCutsceneAction !== fromAct) {
          activeCutsceneAction.stopFading();
          activeCutsceneAction.setEffectiveWeight(0);
          activeCutsceneAction.stop();
        }

        act.stopFading();
        act.reset();
        act.setLoop(THREE.LoopOnce, 1);
        act.clampWhenFinished = true;
        act.timeScale = 1.0;
        act.enabled = true;
        act.play();
        act.paused = true;
        act.time = clampedU * dur;
        activeCutsceneAction = act;
        cutsceneBlendDur = safeBlend;
        cutsceneBlendElapsed = prevCutsceneFromAction ? 0 : safeBlend;
        cutsceneLastPerfMs = nowMs;
        advanceCutsceneBlend(0);
      } else {
        act.enabled = true;
        act.paused = true;
        act.time = clampedU * dur;
        if (safeBlend <= 0.005 && prevCutsceneFromAction) {
          prevCutsceneFromAction.stopFading();
          prevCutsceneFromAction.setEffectiveWeight(0);
          prevCutsceneFromAction.stop();
          prevCutsceneFromAction = null;
          act.setEffectiveWeight(1.0);
          cutsceneLastPerfMs = nowMs;
        } else if (prevCutsceneFromAction) {
          const dtWall = cutsceneLastPerfMs > 0 ? Math.max(0, Math.min(0.05, (nowMs - cutsceneLastPerfMs) * 0.001)) : 0.016;
          cutsceneLastPerfMs = nowMs;
          advanceCutsceneBlend(dtWall > 0.0005 ? dtWall : 0.016);
        } else {
          act.setEffectiveWeight(1.0);
          cutsceneLastPerfMs = nowMs;
        }
      }

      if (spawnedInst) {
        spawnedInst.rotation.set(0, 0, 0);
        spawnedInst.position.set(0, 0, 0);
      }
      restoreJawAdditive();
      animCtrl.mixer.update(0);
      clampBossNeckHeadForwardPitch();
      applyJawAdditive();
      return true;
    },
    clearCutsceneClip(blendOutSec = 0.18) {
      const outgoing = activeCutsceneAction;
      if (prevCutsceneFromAction) {
        prevCutsceneFromAction.stopFading();
        prevCutsceneFromAction.setEffectiveWeight(0);
        prevCutsceneFromAction.stop();
        prevCutsceneFromAction = null;
      }
      activeCutsceneAction = null;
      cutsceneBlendElapsed = 0;
      cutsceneBlendDur = 0.22;
      cutsceneLastPerfMs = 0;
      baseClipOverride = null;
      baseClipOverrideSpeed = null;
      if (animCtrl && !isDying) {
        const idleName = resolvedIdleClip || cfg.idleClip || 'Idle';
        const safeBlend = Number.isFinite(Number(blendOutSec)) ? Number(blendOutSec) : 0.18;
        if (outgoing && safeBlend > 0.01 && typeof animCtrl.handoffExternalClipToBase === 'function') {
          animCtrl.handoffExternalClipToBase(outgoing, idleName, 1.0, safeBlend);
        } else {
          if (outgoing) {
            outgoing.stopFading();
            outgoing.setEffectiveWeight(0);
            outgoing.stop();
          }
          animCtrl.setBaseState(idleName, 1.0);
          animCtrl.updateOneShotFade?.(0.25);
        }
        animCtrl.mixer.update(0);
      } else if (outgoing) {
        outgoing.stopFading();
        outgoing.setEffectiveWeight(0);
        outgoing.stop();
      }
    },
    playClampedClip(clipName, speed = 1.0, blendInSec = CLAMPED_BLEND_IN_SEC) {
      if (isDying || !animCtrl || typeof clipName !== 'string' || !clipName) {
        return { ok: false, duration: 0 };
      }
      const act = animCtrl.getAction?.(clipName);
      if (!act) return { ok: false, duration: 0 };
      const safeSpeed = Math.max(0.1, Number(speed) || 1.0);
      const safeBlend =
        Number.isFinite(Number(blendInSec)) && Number(blendInSec) >= 0.01
          ? Number(blendInSec)
          : CLAMPED_BLEND_IN_SEC;
      // Preserve outgoing clamped clip (e.g. Stagger_Kneel -> Stagger_Recover, Throne_StandUp -> Roar_Taunt)
      // or dominant live action (e.g. Walking / Heavy_Cleave -> Stagger_Kneel) and stop every other layer
      // so clamped & clamped->clamped transitions strictly keep wSum === 1.000 with zero leftover weights!
      const outgoingCutscene = activeCutsceneAction && activeCutsceneAction !== act ? activeCutsceneAction : null;
      if (activeCutsceneAction || prevCutsceneFromAction) {
        if (prevCutsceneFromAction && prevCutsceneFromAction !== outgoingCutscene) {
          prevCutsceneFromAction.stopFading();
          prevCutsceneFromAction.setEffectiveWeight(0);
          prevCutsceneFromAction.stop();
        }
        prevCutsceneFromAction = null;
        activeCutsceneAction = null;
        cutsceneBlendElapsed = 0;
        cutsceneLastPerfMs = 0;
        if (outgoingCutscene) outgoingCutscene.paused = false;
      }
      const outgoingClamped =
        (activeClampedAction && activeClampedAction !== act ? activeClampedAction : null) || outgoingCutscene;
      const fromAct = animCtrl.prepareExternalClip
        ? animCtrl.prepareExternalClip(act, outgoingClamped)
        : outgoingClamped;
      if (prevClampedFromAction && prevClampedFromAction !== fromAct) {
        prevClampedFromAction.stopFading();
        prevClampedFromAction.setEffectiveWeight(0);
        prevClampedFromAction.stop();
      }
      prevClampedFromAction = fromAct || null;
      if (activeClampedAction && activeClampedAction !== fromAct) {
        activeClampedAction.stopFading();
        activeClampedAction.setEffectiveWeight(0);
        activeClampedAction.stop();
      }
      activeClampedAction = null;
      activeClampedDuration = 0;
      activeClampedElapsed = 0;
      activeClampedBlendSec = safeBlend;

      const clip = act.getClip?.();
      activeClampedDuration = clip?.duration ? clip.duration / safeSpeed : 2.0 / safeSpeed;
      activeClampedElapsed = 0;
      act.stopFading();
      act.reset();
      act.setLoop(THREE.LoopOnce, 1);
      act.clampWhenFinished = true;
      act.timeScale = safeSpeed;
      act.enabled = true;
      act.paused = false;
      act.setEffectiveWeight(prevClampedFromAction ? 0.001 : 1.0);
      act.play();
      activeClampedAction = act;
      activeClampedClipName = clipName;
      restoreJawAdditive();
      animCtrl.mixer.update(0);
      clampBossNeckHeadForwardPitch();
      applyJawAdditive();
      return { ok: true, duration: activeClampedDuration };
    },
    isClampedClipDone() {
      if (!activeClampedAction) return true;
      return activeClampedElapsed >= Math.max(0.01, activeClampedDuration - 0.008);
    },
    clearClampedClip(snapToIdle = true, blendOutSec = 0.16) {
      const outgoing = activeClampedAction;
      if (prevClampedFromAction) {
        prevClampedFromAction.stopFading();
        prevClampedFromAction.setEffectiveWeight(0);
        prevClampedFromAction.stop();
        prevClampedFromAction = null;
      }
      activeClampedAction = null;
      activeClampedClipName = null;
      activeClampedDuration = 0;
      activeClampedElapsed = 0;
      baseClipOverride = null;
      baseClipOverrideSpeed = null;
      if (snapToIdle && animCtrl && !isDying) {
        const idleName = resolvedIdleClip || cfg.idleClip || 'Idle';
        const safeBlend = Number.isFinite(Number(blendOutSec)) ? Number(blendOutSec) : 0.16;
        if (outgoing && safeBlend > 0.01 && typeof animCtrl.handoffExternalClipToBase === 'function') {
          animCtrl.handoffExternalClipToBase(outgoing, idleName, 1.0, safeBlend);
        } else {
          if (outgoing) {
            outgoing.stopFading();
            outgoing.setEffectiveWeight(0);
            outgoing.stop();
          }
          animCtrl.setBaseState(idleName, 1.0);
          animCtrl.updateOneShotFade?.(0.25);
        }
        animCtrl.mixer.update(0);
      } else if (outgoing) {
        outgoing.stopFading();
        outgoing.setEffectiveWeight(0);
        outgoing.stop();
      }
    },
    _markActive() {
      stopCutsceneInternal();
      stopClampedInternal();
      restoreJawAdditive();
      mouthOpen01 = 0;
      bossMouthSmooth = 0;
      headSpeechDamped = 0;
      resetEldenDissolveFromModel(spawnedInst || root);
      dissolveActive = false;
      physicsActorState.isDying = false;
      physicsActorState.soulsThronePhase = null;
      physicsActorState.soulsState = null;
      lastPostureDead = false;
      baseClipOverride = null;
      baseClipOverrideSpeed = null;
      inPool = false;
      isDying = false;
      deathBaseY = 0;
      proceduralFall = false;
      hitJoltTimer = 0;
      hitJoltAmp = 1.0;
      hitReactCooldown = 0;
      hitTwistDir = 1;
      flashTimer = 0;
      hasPrevRootPose = false;
      hasEverMovedRoot = false;
      zeroDispSec = 0;
      lastExplicitMode = null;
      lastExplicitVx = null;
      lastExplicitVz = null;
      lastExplicitLocalX = null;
      lastExplicitLocalZ = null;
      lastExplicitIsMoving = null;
      lastExplicitSpeedMult = null;
      lastExplicitActualSpeed = null;
      lastExplicitTurnDelta = null;
      lastPosturePhase = null;
      lastPosturePhase01 = null;
      lastPostureMoveType = null;
      lastPostureBlocking = false;
      lastPostureInCombat = false;
      lastPostureStaggered = false;
      root.visible = true;
      root.position.y = 0;
      root.scale.set(1, 1, 1);
      root.rotation.set(0, 0, 0);
      if (spawnedInst) {
        spawnedInst.rotation.set(0, 0, 0);
        spawnedInst.position.set(0, 0, 0);
        spawnedInst.scale.set(baseInstScaleX, baseInstScaleY, baseInstScaleZ);
      }
      if (contactShadow) {
        contactShadow.visible = true;
        contactShadow.position.y = contactShadow.userData?.baseYOffset ?? 0.015;
        contactShadow.userData?.setShadowOpacity?.(contactShadow.userData?.baseOpacity ?? 0.62);
        contactShadow.userData?.setShadowScale?.(contactShadowRadius, contactShadowRadius);
      }
      if (stage1BreakNode) stage1BreakNode.visible = true;
      if (stage2BreakNode) stage2BreakNode.visible = true;
      if (halo) halo.visible = true;
      if (innerBossHalo) innerBossHalo.visible = true;
      if (eliteCrest) eliteCrest.visible = true;
      animCtrl?.resetAlive?.();
      for (let i = 0; i < flashMeshSlots.length; i++) {
        flashMeshSlots[i].mesh.material = flashMeshSlots[i].origMat;
      }
    },
    setDamageStage(stage) {
      if (stage >= 1 && stage1BreakNode && stage1BreakNode.visible) {
        stage1BreakNode.visible = false;
        return 'shield';
      }
      if (stage >= 2 && stage2BreakNode && stage2BreakNode.visible) {
        stage2BreakNode.visible = false;
        return 'helmet';
      }
      return null;
    },
    triggerHitReact(arg1 = null, arg2 = null, arg3 = null) {
      if (isDying) return false;
      let opts = null;
      let positionalClip = null;
      let positionalSpeed = null;
      if (typeof arg1 === 'string') {
        positionalClip = arg1;
        opts = arg2 && typeof arg2 === 'object' ? arg2 : null;
      } else if (typeof arg1 === 'number') {
        positionalSpeed = arg1;
        if (typeof arg2 === 'string') positionalClip = arg2;
        opts = arg3 && typeof arg3 === 'object' ? arg3 : (arg2 && typeof arg2 === 'object' ? arg2 : null);
      } else if (arg1 && typeof arg1 === 'object') {
        opts = arg1;
      }
      const isObj = Boolean(opts && typeof opts === 'object');
      const playClip = isObj && opts.playClip !== undefined ? Boolean(opts.playClip) : true;
      const rawJolt =
        isObj && Number.isFinite(Number(opts.joltScale))
          ? Math.max(0, Number(opts.joltScale))
          : 1.0;
      const isBossRig = cfg.key === 'rift_boss';
      const mobJoltBoost = isBossRig ? 1.0 : 1.25;
      const joltScale = Math.max(0, Math.min(isBossRig ? 1.35 : 1.88, rawJolt * mobJoltBoost));
      if (joltScale > 0.01 && !activeClampedAction && !activeCutsceneAction) {
        // Unified critically damped physics recoil spring + grounded Rift skeletal torso flinch!
        applyCombatRecoilImpulse(physicsActorState, {
          kind: 'hitRecoil',
          dirX: isObj ? opts.dirX : undefined,
          dirZ: isObj ? opts.dirZ : undefined,
          intensity: joltScale,
          isHeavy: Boolean(isObj && opts.isHeavy)
        });
        hitJoltDur = isBossRig ? 0.25 : 0.30;
        hitJoltTimer = hitJoltDur;
        hitJoltAmp = joltScale * (isObj && opts.isHeavy ? 1.32 : 1.0);
        hitTwistDir = -hitTwistDir;
      }
      const forceRestart = Boolean(isObj && (opts.forceRestart || opts.interruptAttack));
      if (!playClip || activeClampedAction || activeCutsceneAction || (!forceRestart && hitReactCooldown > 0)) {
        return false;
      }
      const clipName =
        (isObj && typeof opts.clipName === 'string' && opts.clipName ? opts.clipName : null) ||
        positionalClip ||
        null;
      const speed =
        isObj && Number.isFinite(Number(opts.speed))
          ? Number(opts.speed)
          : Number.isFinite(Number(positionalSpeed)) && Number(positionalSpeed) > 0
            ? Number(positionalSpeed)
            : 1.85;
      const playedClip = animCtrl?.triggerHit?.(speed, clipName, {
        interruptAttack: Boolean(isObj && opts.interruptAttack),
        blockGuard: false,
        blendInSec: isObj && Number.isFinite(Number(opts.blendInSec)) ? Number(opts.blendInSec) : 0.04,
        blendOutSec: isObj && Number.isFinite(Number(opts.blendOutSec)) ? Number(opts.blendOutSec) : 0.09,
        maxWeight: isObj && Number.isFinite(Number(opts.maxWeight)) ? Number(opts.maxWeight) : 1.0
      });
      hitReactCooldown = playedClip ? 0.12 : 0.06;
      return Boolean(playedClip);
    },
    cancelHitReact() {
      animCtrl?.cancelHit?.();
    },
    playHitFlinch(...args) {
      return handle.triggerHitReact(...args);
    },
    playDeathCollapse() {
      if (isDying) return;
      stopCutsceneInternal();
      stopClampedInternal();
      restoreJawAdditive();
      baseClipOverride = null;
      baseClipOverrideSpeed = null;
      isDying = true;
      deathBaseY = Number.isFinite(root.position.y) ? root.position.y : 0;
      physicsActorState.isDying = true;
      hitJoltTimer = 0;
      if (spawnedInst) {
        spawnedInst.position.set(0, 0, 0);
        spawnedInst.rotation.set(0, 0, 0);
      }
      if (halo) halo.visible = false;
      if (innerBossHalo) innerBossHalo.visible = false;
      if (eliteCrest) eliteCrest.visible = false;
      const deathSpeed = cfg.isBossVisual || isRiftTripo ? 1.0 : 1.38;
      const hasClip = animCtrl?.triggerDeath?.(deathSpeed);
      proceduralFall = !hasClip;
    },
    // updateDying(dt, sinkRatio, dissolve01):
    //   - dissolve01 > 0 -> Elden Ring ash/ember dissolution IN PLACE on the stone floor/stairs (no sinking!)
    //   - otherwise legacy sinkRatio floor-sink fallback (PvE Chapters 1-25 untouched).
    updateDying(dt, sinkRatio = 0, dissolve01 = 0) {
      const safeDt = Math.min(Math.max(dt || 0.016, 0), 0.1);
      restoreJawAdditive();
      if (animCtrl) {
        animCtrl.mixer.update(safeDt);
      }
      if (proceduralFall && spawnedInst) {
        spawnedInst.rotation.x = Math.max(-Math.PI * 0.48, spawnedInst.rotation.x - safeDt * 4.2);
      }
      // Hit-flash restore runs BEFORE dissolve so the dissolve clones always stay bound this frame.
      if (flashTimer > 0) {
        flashTimer = Math.max(0, flashTimer - safeDt);
        if (flashTimer <= 0 || dissolveActive) {
          flashTimer = 0;
          for (let i = 0; i < flashMeshSlots.length; i++) {
            flashMeshSlots[i].mesh.material = flashMeshSlots[i].origMat;
          }
        }
      }
      const rawDissolve = Number(dissolve01);
      const d01 = Number.isFinite(rawDissolve) ? (rawDissolve < 0 ? 0 : rawDissolve > 1 ? 1 : rawDissolve) : 0;
      let shadowFade = 1;
      if (d01 > 0) {
        if (flashTimer > 0) {
          flashTimer = 0;
          for (let i = 0; i < flashMeshSlots.length; i++) {
            flashMeshSlots[i].mesh.material = flashMeshSlots[i].origMat;
          }
        }
        root.position.y = deathBaseY;
        dissolveActive = applyEldenDissolveToModel(spawnedInst || root, d01, { dt: safeDt });
        if (!dissolveActive && d01 > 0.5) {
          // Graceful fallback for non-patchable materials: gentle sink once past the halfway point
          root.position.y = deathBaseY - (d01 - 0.5) * 0.9;
        }
        const t = d01 <= 0.08 ? 0 : d01 >= 0.85 ? 1 : (d01 - 0.08) / 0.77;
        shadowFade = 1 - t * t * (3 - 2 * t);
      } else {
        if (dissolveActive) {
          resetEldenDissolveFromModel(spawnedInst || root);
          dissolveActive = false;
        }
        if (sinkRatio > 0) {
          root.position.y = -sinkRatio * 0.45;
        }
        shadowFade = Math.max(0, 1 - sinkRatio * 1.4);
      }
      if (contactShadow) {
        const baseOp = contactShadow.userData?.baseOpacity ?? 0.62;
        contactShadow.userData?.setShadowOpacity?.(baseOp * shadowFade);
      }
    },
    playAttackAnim(overrideClip = null, desiredImpactDur = 0, explicitSpeed = 0, blendInSec = null) {
      if (isDying) return;
      // A live combat attack always ends any lingering normalized cutscene scrub smoothly.
      if (activeCutsceneAction) {
        handle.clearCutsceneClip(0.12);
      }
      // Never freeze Boss or enemy if a preceding clamped clip already reached its end frame!
      if (activeClampedAction) {
        if (activeClampedElapsed >= Math.max(0.01, activeClampedDuration - 0.012)) {
          handle.clearClampedClip(true, 0.12);
        } else {
          return;
        }
      }
      procRig?.triggerAttack?.();
      const targetClip = typeof overrideClip === 'string' && overrideClip ? overrideClip : cfg.atkClip;
      if (animCtrl && targetClip) {
        lastAttackClipPlayed = targetClip;
        const impactSec = Number(desiredImpactDur);
        const hasDesiredImpact = Number.isFinite(impactSec) && impactSec > 0.10;
        const rawExplicit = Number(explicitSpeed);
        // combat/bridge.js triggerModelAttack() passes default `comboStep = 1` as 3rd arg (blendInSec === undefined).
        // Treat `explicitSpeed` as a direct speed override only when NOT windup-synced and either `blendInSec` is supplied
        // (direct bossAi call) or `explicitSpeed` is a non-default speed (!== 1).
        const hasExplicitSpeed =
          !hasDesiredImpact &&
          Number.isFinite(rawExplicit) &&
          rawExplicit > 0 &&
          ((blendInSec !== null && blendInSec !== undefined) || Math.abs(rawExplicit - 1) > 1e-4);

        let spd = hasExplicitSpeed ? rawExplicit : cfg.isBossVisual ? 1.42 : 1.55;
        if (hasDesiredImpact) {
          if (targetClip === 'Heavy_Cleave') {
            spd = Math.max(0.62, Math.min(2.1, 1.033 / impactSec));
          } else {
            const act = animCtrl.getAction?.(targetClip);
            const clipDur = act?.getClip?.()?.duration || 0;
            if (clipDur > 0.05) {
              const impactFrac = ENEMY_CLIP_IMPACT_FRAC[targetClip] ?? 0.45;
              const impactTimeAt1x = clipDur * impactFrac;
              const maxSyncSpd = isRiftTripo ? 1.24 : 2.5;
              spd = Math.max(0.45, Math.min(maxSyncSpd, impactTimeAt1x / impactSec));
            }
          }
        }
        const safeBlendIn =
          Number.isFinite(Number(blendInSec)) && Number(blendInSec) >= 0.01 ? Number(blendInSec) : null;
        animCtrl.triggerOneShot(targetClip, spd, safeBlendIn);
      }
    },
    playBossClip(clipName, speed = 1.0, blendInSec = 0.14) {
      if (isDying || !animCtrl || typeof clipName !== 'string' || !clipName) {
        return { ok: false, duration: 0 };
      }
      if (activeCutsceneAction) {
        handle.clearCutsceneClip(0.12);
      }
      if (activeClampedAction) {
        if (activeClampedElapsed >= Math.max(0.01, activeClampedDuration - 0.012)) {
          handle.clearClampedClip(true, 0.12);
        } else {
          return { ok: false, duration: 0 };
        }
      }
      const act = animCtrl.getAction?.(clipName);
      if (!act) return { ok: false, duration: 0 };
      lastAttackClipPlayed = clipName;
      const safeSpeed = Math.max(0.1, Number(speed) || 1.0);
      const safeBlend =
        Number.isFinite(Number(blendInSec)) && Number(blendInSec) >= 0.01 ? Number(blendInSec) : 0.14;
      animCtrl.triggerOneShot(clipName, safeSpeed, safeBlend);
      const clip = act.getClip?.();
      return { ok: true, duration: clip?.duration ? clip.duration / safeSpeed : 1.0 / safeSpeed };
    },
    cancelAttackAnim() {
      animCtrl?.cancelOneShot?.();
    },
    setActiveAttackTimeScale(speed) {
      return animCtrl?.setActiveAttackTimeScale?.(speed) || false;
    },
    flashHit() {
      // Never flash a dissolving corpse (keeps the Elden ember-edge dissolve shader bound!)
      if (dissolveActive) return;
      flashTimer = softHitFlashMode ? 0.09 : 0.10;
      for (let i = 0; i < flashMeshSlots.length; i++) {
        const slot = flashMeshSlots[i];
        slot.mesh.material = slot.flashMat || hitFlashMat;
      }
      for (const item of instanceMats) {
        if (item.mat.emissive) {
          item.mat.emissive.setHex(0xffffff);
          item.mat.emissiveIntensity = 0.85;
        }
      }
    },
    dispose() {
      if (inPool) return;
      flashTimer = 0;
      for (let i = 0; i < flashMeshSlots.length; i++) {
        flashMeshSlots[i].mesh.material = flashMeshSlots[i].origMat;
      }
      // Always free per-corpse dissolve material clones (restores shared originals before pooling!)
      restoreJawAdditive();
      resetEldenDissolveFromModel(spawnedInst || root);
      dissolveActive = false;
      if (canPool) {
        let bucket = enemyMeshPool.get(poolKey);
        if (!bucket) {
          bucket = [];
          enemyMeshPool.set(poolKey, bucket);
        }
        if (bucket.length < 18) {
          inPool = true;
          root.visible = false;
          bucket.push(handle);
          return;
        }
      }
      if (contactShadow) {
        if (contactShadow.parent) contactShadow.parent.remove(contactShadow);
        contactShadow.userData?.dispose?.();
      }
      if (animCtrl?.mixer && spawnedInst) {
        animCtrl.mixer.stopAllAction();
        animCtrl.mixer.uncacheRoot(spawnedInst);
      }
      if (spawnedInst && !procRig) {
        spawnedInst.traverse((n) => {
          if (n.isSkinnedMesh && n.skeleton) {
            n.skeleton.dispose();
          }
        });
      }
      for (const item of instanceMats) {
        if (item.owned && item.mat?.dispose) item.mat.dispose();
      }
      instanceMats.length = 0;
      flashMeshSlots.length = 0;
    },
    syncCyclePhase(phase01) {
      if (animCtrl && !isDying && typeof animCtrl.syncPhase === 'function') {
        animCtrl.syncPhase(cfg.moveClip, phase01);
      }
    },
    // Signature `(dt, isMovingArg, speedMultArg, elapsedTimeArg, moveLocalXArg, moveLocalZArg, extraStateArg)`
    // is matched by combat/bridge.js (`params.length >= 4 && params[2].includes('speed')`),
    // while also supporting `(dt, { isMoving, speedMult, elapsedTime, strafeAnimMode, vx, vz, ... })` and `(dt, elapsedTime)`.
    update(dt, isMovingArg = true, speedMultArg = 1, elapsedTimeArg = 0, moveLocalXArg = 0, moveLocalZArg = 1, extraStateArg = null) {
      const safeDt = Number.isFinite(dt) ? Math.min(Math.max(dt, 0), 0.1) : 0.016;
      // Undo last frame's additive jaw lip-sync BEFORE the mixer evaluates (0 drift)
      restoreJawAdditive();
      if (cfg.key === 'rift_boss') {
        const mAlpha = 1 - Math.exp(-safeDt * 18);
        bossMouthSmooth += (mouthOpen01 - bossMouthSmooth) * mAlpha;
        if (mouthOpen01 <= 0.001 && bossMouthSmooth < 0.002) {
          bossMouthSmooth = 0;
        }
      }
      let isMoving = true;
      let rawSpeedMult = 1;
      let elapsedTime = 0;
      let localX = Number.isFinite(Number(moveLocalXArg)) ? Number(moveLocalXArg) : 0;
      let localZ = Number.isFinite(Number(moveLocalZArg)) ? Number(moveLocalZArg) : 1;
      let optsObj = extraStateArg && typeof extraStateArg === 'object' ? extraStateArg : null;

      if (isMovingArg && typeof isMovingArg === 'object') {
        optsObj = isMovingArg;
        isMoving =
          optsObj.isMoving !== undefined
            ? Boolean(optsObj.isMoving)
            : optsObj.moving !== undefined
              ? Boolean(optsObj.moving)
              : true;
        rawSpeedMult = Number(
          optsObj.speedMult ??
            optsObj.animSpeedMult ??
            optsObj.speed ??
            optsObj.moveRatio ??
            1
        );
        elapsedTime = Number(optsObj.elapsedTime ?? optsObj.time ?? 0) || 0;
        if (optsObj.moveLocalX !== undefined) localX = Number(optsObj.moveLocalX) || 0;
        if (optsObj.moveLocalZ !== undefined) localZ = Number(optsObj.moveLocalZ) || 0;
      } else if (typeof isMovingArg === 'number') {
        isMoving = true;
        rawSpeedMult = 1;
        elapsedTime = isMovingArg;
      } else {
        isMoving = typeof isMovingArg === 'boolean' ? isMovingArg : true;
        rawSpeedMult = Number.isFinite(Number(speedMultArg)) ? Number(speedMultArg) : 1;
        elapsedTime = Number.isFinite(Number(elapsedTimeArg)) ? Number(elapsedTimeArg) : 0;
      }

      if (lastExplicitIsMoving !== null && !(optsObj && (optsObj.isMoving !== undefined || optsObj.moving !== undefined))) {
        isMoving = lastExplicitIsMoving;
      }
      if (lastExplicitSpeedMult !== null && !(optsObj && optsObj.speedMult !== undefined)) {
        rawSpeedMult = lastExplicitSpeedMult;
      }
      if (lastExplicitLocalX !== null && !(optsObj && optsObj.moveLocalX !== undefined)) {
        localX = lastExplicitLocalX;
      }
      if (lastExplicitLocalZ !== null && !(optsObj && optsObj.moveLocalZ !== undefined)) {
        localZ = lastExplicitLocalZ;
      }

      // Measure real post-collision ground displacement & yaw turn rate (guarded against hitstop dt ~ 0.001s explosion!)
      let realVx = physicsActorState._smoothRealVx || 0;
      let realVz = physicsActorState._smoothRealVz || 0;
      let realSpeed = physicsActorState._smoothRealSpeed || 0;
      let yawRate = physicsActorState._smoothYawRate || 0;
      if (hasPrevRootPose && safeDt >= 0.004) {
        const dx = root.position.x - prevRootX;
        const dz = root.position.z - prevRootZ;
        const disp = Math.hypot(dx, dz);
        const rawVx = dx / safeDt;
        const rawVz = dz / safeDt;
        const rawSpd = disp / safeDt;
        let dyaw = root.rotation.y - prevRootYaw;
        while (dyaw > Math.PI) dyaw -= Math.PI * 2;
        while (dyaw < -Math.PI) dyaw += Math.PI * 2;
        const rawYawRate = Math.max(-14, Math.min(14, dyaw / safeDt));
        const velAlpha = 1 - Math.exp(-22 * safeDt);
        realVx += (rawVx - realVx) * velAlpha;
        realVz += (rawVz - realVz) * velAlpha;
        realSpeed += (rawSpd - realSpeed) * velAlpha;
        yawRate += (rawYawRate - yawRate) * velAlpha;
        physicsActorState._smoothRealVx = realVx;
        physicsActorState._smoothRealVz = realVz;
        physicsActorState._smoothRealSpeed = realSpeed;
        physicsActorState._smoothYawRate = yawRate;
        if (disp > 0.002) {
          hasEverMovedRoot = true;
          zeroDispSec = 0;
        } else {
          zeroDispSec += safeDt;
        }
        prevRootX = root.position.x;
        prevRootZ = root.position.z;
        prevRootYaw = root.rotation.y;
      } else if (!hasPrevRootPose) {
        prevRootX = root.position.x;
        prevRootZ = root.position.z;
        prevRootYaw = root.rotation.y;
      }
      hasPrevRootPose = true;

      const optVx = optsObj && Number.isFinite(Number(optsObj.vx)) ? Number(optsObj.vx) : lastExplicitVx;
      const optVz = optsObj && Number.isFinite(Number(optsObj.vz)) ? Number(optsObj.vz) : lastExplicitVz;
      const optActualSpd =
        optsObj && Number.isFinite(Number(optsObj.actualSpeed))
          ? Math.max(0, Number(optsObj.actualSpeed))
          : lastExplicitActualSpeed;
      const optTurnDelta =
        optsObj && Number.isFinite(Number(optsObj.turnDelta))
          ? Number(optsObj.turnDelta)
          : lastExplicitTurnDelta;
      if (Math.abs(yawRate) < 0.05 && optTurnDelta !== null && Math.abs(optTurnDelta) > 0.02 && safeDt >= 0.004) {
        yawRate = Math.max(-14, Math.min(14, optTurnDelta / safeDt));
      }
      const hasCallerVel = optVx !== null && optVz !== null;
      const stalledAgainstWall = hasEverMovedRoot && realSpeed < 0.08 && zeroDispSec > 0.14;
      const explicitMode =
        (optsObj && typeof (optsObj.strafeAnimMode ?? optsObj.mode) === 'string' && (optsObj.strafeAnimMode ?? optsObj.mode)) ||
        lastExplicitMode;

      const clampedSpeedMult =
        Number.isFinite(rawSpeedMult) && rawSpeedMult > 0.05
          ? Math.max(0.28, Math.min(2.2, rawSpeedMult))
          : 1.0;

      // Resolve effective world velocity for 1:1 foot-sync cadence
      let effVx = 0;
      let effVz = 0;
      if (hasCallerVel && !stalledAgainstWall) {
        effVx = optVx;
        effVz = optVz;
      } else if (optActualSpd !== null && !stalledAgainstWall) {
        const yaw = root.rotation.y || 0;
        effVx = Math.sin(yaw) * optActualSpd;
        effVz = Math.cos(yaw) * optActualSpd;
      } else if (hasEverMovedRoot) {
        effVx = realVx;
        effVz = realVz;
      } else if (isMoving) {
        const nomSpd = (cfg.isBossVisual ? 3.8 : 3.2) * clampedSpeedMult;
        const yaw = root.rotation.y || 0;
        effVx = Math.sin(yaw) * nomSpd;
        effVz = Math.cos(yaw) * nomSpd;
      }

      physicsActorState.x = root.position.x;
      physicsActorState.z = root.position.z;
      physicsActorState.vx = effVx;
      physicsActorState.vz = effVz;
      physicsActorState.facing = root.rotation.y || 0;
      physicsActorState.isDying = isDying;
      // Live in-game scale (combat.js multiplies root.scale by enc.scale / def.scale) for exact stride & posture calibration
      const liveScale = (cfg.scale || 1.0) * effectiveScaleMult * (Math.abs(root.scale.x) > 1e-4 ? Math.abs(root.scale.x) : 1);
      physicsActorState.scale = liveScale;
      footSyncOpts.scale = liveScale;
      postureOpts.scale = liveScale;
      physicsActorState.soulsAwake = Boolean(
        (optsObj && (optsObj.inCombat ?? optsObj.isAlerted)) ?? lastPostureInCombat ?? isMoving
      );

      if (hitReactCooldown > 0) {
        hitReactCooldown = Math.max(0, hitReactCooldown - safeDt);
      }
      let useFallbackIdleBreath = false;
      if (animCtrl && !isDying && canonicalType !== 'corrupted_treant' && canonicalType !== 'mimic_chest') {
        if (activeCutsceneAction) {
          // Normalized FPS-independent cutscene scrub owns the skeleton — advance only crossfade weight,
          // keeping act.paused = true and act.time strictly pinned to setCutsceneClipNormalized(clip, u01)!
          const nowMs = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
          cutsceneLastPerfMs = nowMs;
          advanceCutsceneBlend(safeDt);
          activeCutsceneAction.enabled = true;
          activeCutsceneAction.paused = true;
          animCtrl.mixer.update(0);
        } else if (activeClampedAction) {
          activeClampedElapsed += safeDt;
          const rawW = prevClampedFromAction
            ? Math.min(1, activeClampedElapsed / Math.max(0.01, activeClampedBlendSec))
            : 1.0;
          const wIn = prevClampedFromAction ? smoothstep01(0, 1, rawW) : 1.0;
          if (prevClampedFromAction) {
            if (rawW >= 1.0) {
              prevClampedFromAction.stopFading();
              prevClampedFromAction.setEffectiveWeight(0);
              prevClampedFromAction.stop();
              prevClampedFromAction = null;
            } else {
              prevClampedFromAction.setEffectiveWeight(1.0 - wIn);
            }
          }
          activeClampedAction.enabled = true;
          activeClampedAction.setEffectiveWeight(wIn);
          animCtrl.mixer.update(safeDt);
        } else if (baseClipOverride) {
          animCtrl.setBaseState(baseClipOverride, baseClipOverrideSpeed ?? 1.35);
          animCtrl.updateOneShotFade?.(safeDt);
          animCtrl.mixer.update(safeDt);
        } else {
          const effectiveMoving = isMoving && !stalledAgainstWall;
          const loco = resolveEnemyLocomotionClip(
            explicitMode,
            effectiveMoving,
            clampedSpeedMult,
            localX,
            localZ,
            yawRate
          );
          const isInPlaceTurn = loco.mode === 'turn_left' || loco.mode === 'turn_right';
          const isBackstep = loco.mode === 'backstep';

          if (!loco.isIdle && isInPlaceTurn) {
            const turnSpd = Math.max(0.75, Math.min(1.65, Math.abs(yawRate) > 0.4 ? Math.abs(yawRate) / 2.2 : 1.0));
            animCtrl.setBaseState(loco.clip, turnSpd, 0.14);
            animCtrl.updateOneShotFade?.(safeDt);
            animCtrl.mixer.update(safeDt);
          } else if (!loco.isIdle && isBackstep && loco.clip !== 'Walk_Backward') {
            animCtrl.setBaseState(loco.clip, 1.15, 0.12);
            animCtrl.updateOneShotFade?.(safeDt);
            animCtrl.mixer.update(safeDt);
          } else if (!loco.isIdle) {
            const locoAct = animCtrl.getAction?.(loco.clip);
            footSyncOpts.strafeAnimMode = loco.mode;
            footSyncOpts.clipDuration = locoAct?.getClip?.()?.duration || 1.0;
            footSyncOpts.smoothDt = safeDt;
            const syncedRate = computeFootSyncPlaybackRate(physicsActorState, effVx, effVz, footSyncOpts);
            if (syncedRate > 0.02) {
              // Apply exact biomechanical 1:1 foot-sync to ALL enemies (Souls Rift, Bosses AND regular PvE mobs!)
              const rateScale = syncedRate;
              animCtrl.setBaseState(loco.clip, rateScale, 0.18);
            } else if (hasDedicatedIdleClip) {
              animCtrl.setBaseState(resolvedIdleClip, 1.0, 0.18);
            } else {
              animCtrl.setBaseState(cfg.moveClip, 0);
              const moveAct = animCtrl.getAction?.(cfg.moveClip);
              if (moveAct) {
                moveAct.time = 0;
                moveAct.paused = true;
              }
              useFallbackIdleBreath = true;
            }
            animCtrl.updateOneShotFade?.(safeDt);
            animCtrl.mixer.update(safeDt);
          } else if (hasDedicatedIdleClip) {
            // Standing guard / unawakened / stunned: blend smoothly into real baked Idle clip (0% treadmill!)
            animCtrl.setBaseState(resolvedIdleClip, 1.0, 0.18);
            animCtrl.updateOneShotFade?.(safeDt);
            animCtrl.mixer.update(safeDt);
          } else {
            // Defensive fallback for clip-less rigs without a dedicated Idle clip: freeze move clip at neutral stance
            animCtrl.setBaseState(cfg.moveClip, 0);
            const moveAct = animCtrl.getAction?.(cfg.moveClip);
            if (moveAct) {
              moveAct.time = 0;
              moveAct.paused = true;
            }
            animCtrl.updateOneShotFade?.(safeDt);
            animCtrl.mixer.update(safeDt);
            useFallbackIdleBreath = true;
          }
        }
        // Re-apply Boss additive jaw lip-sync, forward neck/head clamp & grounded Rift torso hit-flinch strictly AFTER mixer.update
        applyRiftTorsoFlinch(safeDt);
        clampBossNeckHeadForwardPitch();
        applyJawAdditive();
      }
      if (procRig) {
        procRig.update(safeDt, elapsedTime, isDying);
      }

      if (!isDying && spawnedInst && !procRig) {
        const isFullBodyBakedRift =
          cfg.key === 'rift_boss' ||
          cfg.key === 'rift_executioner' ||
          cfg.key === 'rift_vanguard' ||
          cfg.key === 'rift_acolyte';
        if (activeCutsceneAction || activeClampedAction || isFullBodyBakedRift) {
          // Pure baked grounded skeleton pose — NEVER tilt whole GLB root above feet (kills boot underground clipping,
          // rear-boot hover, bowling-pin lean, and planted-foot yaw skating!)
          if (spawnedInst.rotation.x !== 0 || spawnedInst.rotation.y !== 0 || spawnedInst.rotation.z !== 0) {
            spawnedInst.rotation.set(0, 0, 0);
          }
          if (spawnedInst.position.x !== 0 || spawnedInst.position.y !== 0 || spawnedInst.position.z !== 0) {
            spawnedInst.position.set(0, 0, 0);
          }
        } else {
          // Grounded physics posture (windup coil, strike lunge, heavy follow-through, strafe bank, turn lean & spring recoil)
          let phase = (optsObj && (optsObj.combatPhase ?? optsObj.phase ?? optsObj.bossPosture)) || lastPosturePhase || 'neutral';
          let phase01 =
            optsObj && Number.isFinite(Number(optsObj.combatPhase01 ?? optsObj.phase01))
              ? Number(optsObj.combatPhase01 ?? optsObj.phase01)
              : lastPosturePhase01 ?? 0;
          let moveType = (optsObj && (optsObj.moveType ?? optsObj.attackKey)) || lastPostureMoveType || lastAttackClipPlayed;

          if (phase === 'neutral' && animCtrl?.isOneShotActive?.()) {
            const activeClip = animCtrl.getActiveAttackClipName?.() || lastAttackClipPlayed;
            // Never misclassify non-attack reaction/breather clips as a 'slash' attack!
            const isNonAttackClip =
              !activeClip ||
              activeClip === 'Recover_Heft' ||
              activeClip === 'Whirl_End' ||
              activeClip === 'Roar_Taunt' ||
              activeClip === 'Hit_React' ||
              activeClip === 'Hit_React_Left' ||
              activeClip === 'Hit_React_Gut' ||
              activeClip === 'Riposte_Stand_Up' ||
              activeClip === 'Block_React' ||
              activeClip === 'Shield_Block_Hit' ||
              activeClip === 'Backstep_Evade';
            if (!isNonAttackClip) {
              const prog = animCtrl.getActiveAttackProgress01?.() ?? 0;
              const impFrac = ENEMY_CLIP_IMPACT_FRAC[activeClip] ?? 0.48;
              const windEnd = Math.max(0.15, impFrac * 0.82);
              const activeEnd = Math.min(0.88, impFrac + 0.16);
              moveType = activeClip || moveType;
              if (prog < windEnd) {
                phase = 'windup';
                phase01 = prog / windEnd;
              } else if (prog < activeEnd) {
                phase = 'active';
                phase01 = (prog - windEnd) / Math.max(0.05, activeEnd - windEnd);
              } else {
                phase = 'recover';
                phase01 = (prog - activeEnd) / Math.max(0.05, 1.0 - activeEnd);
              }
            } else {
              phase = 'recover';
              phase01 = 0.5;
            }
          } else if (lastPostureStaggered && phase === 'neutral') {
            phase = 'stagger';
          }

          postureOpts.vx = effVx;
          postureOpts.vz = effVz;
          postureOpts.facing = root.rotation.y || 0;
          postureOpts.turnRate = yawRate;
          postureOpts.combatPhase = phase;
          postureOpts.combatPhase01 = phase01;
          postureOpts.moveType = moveType;
          postureOpts.isBlocking = Boolean((optsObj && optsObj.isBlocking) ?? lastPostureBlocking);
          postureOpts.inCombat = physicsActorState.soulsAwake;
          postureOpts.isDead = Boolean(isDying || lastPostureDead || (optsObj && optsObj.isDead));
          postureOpts.elapsedTime = elapsedTime;
          postureOpts.timeSec = elapsedTime;

          const posture = computeCombatPostureDynamics(physicsActorState, postureOpts, safeDt);
          applyCombatPostureToObject3D(spawnedInst, posture, postureApplyOpts);
        }

        const breathY = useFallbackIdleBreath ? 1 + Math.sin(elapsedTime * 2.2) * 0.014 : 1;
        const targetSY = baseInstScaleY * breathY;
        if (
          spawnedInst.scale.x !== baseInstScaleX ||
          Math.abs(spawnedInst.scale.y - targetSY) > 1e-5 ||
          spawnedInst.scale.z !== baseInstScaleZ
        ) {
          spawnedInst.scale.set(baseInstScaleX, targetSY, baseInstScaleZ);
        }
      } else if (!isDying && spawnedInst) {
        if (spawnedInst.rotation.x !== 0 || spawnedInst.rotation.z !== 0) {
          spawnedInst.rotation.x = 0;
          spawnedInst.rotation.z = 0;
        }
        if (
          spawnedInst.scale.x !== baseInstScaleX ||
          spawnedInst.scale.y !== baseInstScaleY ||
          spawnedInst.scale.z !== baseInstScaleZ
        ) {
          spawnedInst.scale.set(baseInstScaleX, baseInstScaleY, baseInstScaleZ);
        }
      }

      if (wingGroup?.userData?.wingPivots && !isDying) {
        const flapSpeed = canonicalType === 'boss_ashlord' ? 5.6 : 9.2;
        const flapAmp = canonicalType === 'boss_ashlord' ? 0.36 : 0.42;
        const flap = Math.sin(elapsedTime * flapSpeed) * flapAmp;
        for (const wp of wingGroup.userData.wingPivots) {
          wp.pivot.rotation.y = -wp.side * (0.38 + flap);
        }
      }
      if (dragonTail && !isDying) {
        dragonTail.rotation.y = Math.sin(elapsedTime * 4.4) * 0.24;
      }
      if (emberCoreGrp?.userData?.heart && !isDying) {
        const p = 1 + Math.sin(elapsedTime * 7.5) * 0.10;
        emberCoreGrp.userData.heart.scale.set(0.95 * p, 1.25 * p, 0.78 * p);
      }
      if (cthulhuHead?.userData?.tentacles && !isDying) {
        for (const tt of cthulhuHead.userData.tentacles) {
          tt.pivot.rotation.x = Math.sin(elapsedTime * 4.8 + tt.phase) * 0.16;
          tt.pivot.rotation.z = Math.cos(elapsedTime * 3.9 + tt.phase) * 0.12;
        }
      }
      if (cthulhuBase?.userData?.baseTentacles && !isDying) {
        for (const bt of cthulhuBase.userData.baseTentacles) {
          bt.pivot.rotation.y = bt.baseY + Math.sin(elapsedTime * 3.6 + bt.phase) * 0.18;
        }
      }
      if (canonicalType === 'boss_archlich' && archlichOrbit) {
        archlichOrbit.rotation.y = elapsedTime * 1.95;
        for (let i = 0; i < archlichCrystals.length; i++) {
          const c = archlichCrystals[i];
          c.position.y = Math.sin(elapsedTime * 4.2 + i * 1.57) * 0.14 * effectiveScaleMult;
          c.rotation.y = elapsedTime * 3.2 + i;
        }
      } else if ((canonicalType === 'boss_ashlord' || canonicalType === 'boss_butcher') && flashTimer <= 0) {
        const magmaPulse = 0.28 + Math.sin(elapsedTime * 5.5) * 0.14;
        for (const item of instanceMats) {
          if (item.mat.emissive) {
            item.mat.emissiveIntensity = magmaPulse;
          }
        }
      }

      if (halo) {
        halo.rotation.y = elapsedTime * 0.95;
      }
      if (eliteCrest && !isDying) {
        eliteCrest.rotation.y = elapsedTime * 2.4;
        eliteCrest.position.y = eliteCrestBaseY + Math.sin(elapsedTime * 3.8) * 0.07;
      }

      if (flashTimer > 0) {
        flashTimer = Math.max(0, flashTimer - safeDt);
        if (flashTimer <= 0) {
          for (let i = 0; i < flashMeshSlots.length; i++) {
            flashMeshSlots[i].mesh.material = flashMeshSlots[i].origMat;
          }
          for (const item of instanceMats) {
            if (item.mat.emissive) {
              item.mat.emissive.setHex(item.baseEmissive);
              item.mat.emissiveIntensity = item.baseEmissiveInt;
            }
          }
        }
      }
    }
  };
  const enemyAnimFacade = {
    ...(animCtrl || {}),
    triggerHitReact: (...args) => handle.triggerHitReact(...args),
    cancelHitReact: () => handle.cancelHitReact(),
    playHitFlinch: (...args) => handle.playHitFlinch(...args),
    playAttackAnim: (c, d, s, b) => handle.playAttackAnim(c, d, s, b),
    playBossClip: (c, s, b) => handle.playBossClip(c, s, b),
    playClampedClip: (c, s, b) => handle.playClampedClip(c, s, b),
    isClampedClipDone: () => handle.isClampedClipDone(),
    clearClampedClip: (snap, b) => handle.clearClampedClip(snap, b),
    handoffToClipOverride: (c, s, b) => handle.handoffToClipOverride(c, s, b),
    handoffToBase: (c, s, b) => handle.handoffToBase(c, s, b),
    playDeathCollapse: () => handle.playDeathCollapse(),
    getWeaponSegmentWorld: () => handle.getWeaponSegmentWorld(),
    setLocomotionState: (opts) => handle.setLocomotionState(opts),
    setCombatPostureState: (opts) => handle.setCombatPostureState(opts),
    applyRecoilImpulse: (opts) => handle.applyRecoilImpulse(opts),
    setCutsceneClipNormalized: (c, u, b) => handle.setCutsceneClipNormalized(c, u, b),
    clearCutsceneClip: (b) => handle.clearCutsceneClip(b),
    setBossMouthOpen: (v) => handle.setBossMouthOpen(v),
    getBossMouthOpen: () => handle.getBossMouthOpen()
  };
  root.userData.animCtrl = enemyAnimFacade;
  root.userData.triggerHitReact = enemyAnimFacade.triggerHitReact;
  root.userData.playClampedClip = enemyAnimFacade.playClampedClip;
  root.userData.isClampedClipDone = enemyAnimFacade.isClampedClipDone;
  root.userData.clearClampedClip = enemyAnimFacade.clearClampedClip;
  root.userData.playBossClip = enemyAnimFacade.playBossClip;
  root.userData.getWeaponSegmentWorld = enemyAnimFacade.getWeaponSegmentWorld;
  root.userData.setLocomotionState = enemyAnimFacade.setLocomotionState;
  root.userData.setCombatPostureState = enemyAnimFacade.setCombatPostureState;
  root.userData.applyRecoilImpulse = enemyAnimFacade.applyRecoilImpulse;
  root.userData.setCutsceneClipNormalized = enemyAnimFacade.setCutsceneClipNormalized;
  root.userData.clearCutsceneClip = enemyAnimFacade.clearCutsceneClip;
  root.userData.setBossMouthOpen = enemyAnimFacade.setBossMouthOpen;
  root.userData.getBossMouthOpen = enemyAnimFacade.getBossMouthOpen;
  root.userData.contactShadow = contactShadow;
  return handle;
}

// ============================================================================
// 4. PICKUPS, SUPPLY CRATES & RELIC WEAPON CHESTS
// ============================================================================
export function createPickupMesh(pickupType = 'xp') {
  const root = new THREE.Group();
  const visualPivot = new THREE.Group();
  root.add(visualPivot);

  let floatingPart = null;
  let beaconPart = null;
  let fuseFlamePivot = null;
  let fuseSparkMesh = null;
  let barrelRuneMat = null;
  let barrelHaloRing = null;
  let cursedCrystalPivot = null;
  let cursedShardsPivot = null;
  let cursedGlowMat = null;
  let cursedHaloRing = null;
  const damageMats = [];
  const ownedMats = [];
  let shrinkRatio = 1.0;
  let damageGlow = 0.0;

  if (pickupType === 'xp') {
    floatingPart = new THREE.Mesh(
      getGeo('pk_xp', () => new THREE.OctahedronGeometry(0.28, 0)),
      getMat('pk_xp_mat', () => new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x06b6d4, emissiveIntensity: 0.9, roughness: 0.2 }))
    );
    floatingPart.position.y = 0.45;
    visualPivot.add(floatingPart);
  } else if (pickupType === 'gold') {
    floatingPart = new THREE.Mesh(
      getGeo('pk_gold', () => new THREE.CylinderGeometry(0.24, 0.24, 0.1, 14)),
      getMat('pk_gold_mat', () => new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xca8a04, emissiveIntensity: 0.5, metalness: 0.8, roughness: 0.25 }))
    );
    floatingPart.rotation.x = Math.PI * 0.32;
    floatingPart.position.y = 0.36;
    visualPivot.add(floatingPart);
  } else if (pickupType === 'heart') {
    floatingPart = new THREE.Mesh(
      getGeo('pk_heart', () => new THREE.DodecahedronGeometry(0.3, 0)),
      getMat('pk_heart_mat', () => new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0xe11d48, emissiveIntensity: 0.85, roughness: 0.25 }))
    );
    floatingPart.position.y = 0.46;
    visualPivot.add(floatingPart);
  } else if (pickupType === 'clover') {
    const grp = new THREE.Group();
    const leafMat = getMat('pk_clover_mat', () => new THREE.MeshStandardMaterial({ color: 0x4ade80, emissive: 0x16a34a, emissiveIntensity: 0.9, roughness: 0.25 }));
    for (let i = 0; i < 4; i++) {
      const leaf = new THREE.Mesh(getGeo('pk_leaf', () => new THREE.SphereGeometry(0.15, 8, 8)), leafMat);
      const a = (i / 4) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 0.14, 0, Math.sin(a) * 0.14);
      grp.add(leaf);
    }
    grp.position.y = 0.5;
    floatingPart = grp;
    visualPivot.add(grp);
  } else if (pickupType === 'supply_crate' || pickupType === 'companion_crate' || pickupType === 'mimic_disguise') {
    const isComp = pickupType === 'companion_crate';
    const chestAsset = gltfCache.get('chest_disguise_tripo') || gltfCache.get(isComp ? 'chest_gold' : 'chest');
    const isTripoChest = !!gltfCache.get('chest_disguise_tripo');
    if (chestAsset?.scene) {
      const cloned = chestAsset.scene.clone(true);
      cloned.scale.setScalar(isTripoChest ? 1.85 : 0.85);
      cloned.traverse((n) => {
        if (n.isMesh && n.material) {
          const cloneOne = (m) => {
            const c = m.clone();
            if (isComp && c.color) c.color.lerp(new THREE.Color(0xa855f7), 0.35);
            damageMats.push(c);
            ownedMats.push(c);
            return c;
          };
          n.material = Array.isArray(n.material) ? n.material.map(cloneOne) : cloneOne(n.material);
          n.castShadow = true;
          n.receiveShadow = true;
        }
      });
      visualPivot.add(cloned);
    } else {
      const crateMat = new THREE.MeshStandardMaterial({
        color: isComp ? 0x6d28d9 : 0x92400e,
        roughness: 0.65,
        metalness: 0.2
      });
      const trimMat = new THREE.MeshStandardMaterial({
        color: isComp ? 0xfacc15 : 0x52525b,
        metalness: 0.75,
        roughness: 0.35
      });
      damageMats.push(crateMat, trimMat);
      ownedMats.push(crateMat, trimMat);
      const box = new THREE.Mesh(getGeo('crate_box', () => new THREE.BoxGeometry(0.86, 0.82, 0.86)), crateMat);
      box.position.y = 0.41;
      box.castShadow = true;
      const band = new THREE.Mesh(getGeo('crate_band', () => new THREE.BoxGeometry(0.92, 0.18, 0.92)), trimMat);
      band.position.y = 0.44;
      visualPivot.add(box, band);
    }
  } else if (pickupType === 'relic_weapon_crate') {
    const goldChestAsset = gltfCache.get('chest_disguise_tripo') || gltfCache.get('chest_gold');
    const isTripoGold = !!gltfCache.get('chest_disguise_tripo');
    if (goldChestAsset?.scene) {
      const cloned = goldChestAsset.scene.clone(true);
      cloned.scale.setScalar(isTripoGold ? 2.15 : 1.05);
      cloned.traverse((n) => {
        if (n.isMesh) {
          if (isTripoGold && n.material) {
            const warmGold = (m) => {
              const c = m.clone();
              if (c.color) c.color.lerp(new THREE.Color(0xfbbf24), 0.24);
              ownedMats.push(c);
              return c;
            };
            n.material = Array.isArray(n.material) ? n.material.map(warmGold) : warmGold(n.material);
          }
          n.castShadow = true;
          n.receiveShadow = true;
        }
      });
      visualPivot.add(cloned);
    } else {
      const baseMat = getMat('pk_relic_base_mat', () => new THREE.MeshStandardMaterial({ color: 0x272038, metalness: 0.5, roughness: 0.4 }));
      const chest = new THREE.Mesh(getGeo('relic_chest', () => new THREE.BoxGeometry(1.25, 0.82, 0.92)), baseMat);
      chest.position.y = 0.41;
      chest.castShadow = true;
      visualPivot.add(chest);
    }

    beaconPart = new THREE.Mesh(
      getGeo('relic_beam', () => new THREE.CylinderGeometry(0.32, 0.58, 7.5, 16, 1, true)),
      getMat('pk_relic_beam_mat', () => new THREE.MeshBasicMaterial({
        color: 0xfde047,
        transparent: true,
        opacity: 0.24,
        side: THREE.DoubleSide,
        depthWrite: false
      }))
    );
    beaconPart.position.y = 3.8;
    root.add(beaconPart);

    floatingPart = new THREE.Mesh(
      getGeo('relic_star', () => new THREE.OctahedronGeometry(0.34, 0)),
      getMat('pk_relic_star_mat', () => new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xf59e0b, emissiveIntensity: 1.4 }))
    );
    floatingPart.position.y = 1.85;
    root.add(floatingPart);
  } else if (pickupType === 'explosive_barrel') {
    const barrelBodyMat = getMat('pk_eb_wood', () =>
      new THREE.MeshStandardMaterial({
        color: 0x991b1b,
        emissive: 0x3b0707,
        emissiveIntensity: 0.48,
        roughness: 0.54,
        metalness: 0.14
      })
    );
    const barrelLidMat = getMat('pk_eb_lid_mat', () =>
      new THREE.MeshStandardMaterial({ color: 0x3f1d1d, roughness: 0.72, metalness: 0.15 })
    );
    const ironHoopMat = getMat('pk_eb_iron', () =>
      new THREE.MeshStandardMaterial({ color: 0x3f3f46, metalness: 0.84, roughness: 0.3 })
    );
    const fuseCordMat = getMat('pk_eb_fuse_mat', () =>
      new THREE.MeshStandardMaterial({ color: 0xd6c7a1, roughness: 0.9, metalness: 0.05 })
    );
    const flameOuterMat = getMat('pk_eb_flame_out', () =>
      new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.92 })
    );
    const flameCoreMat = getMat('pk_eb_flame_core', () =>
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    const haloMat = getMat('pk_eb_halo_mat', () =>
      new THREE.MeshBasicMaterial({
        color: 0xf97316,
        transparent: true,
        opacity: 0.38,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );

    // Per-instance glowing fiery rune material (animated pulse + cleanly disposed in dispose())
    barrelRuneMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf97316,
      emissiveIntensity: 1.45,
      roughness: 0.22,
      metalness: 0.12
    });
    ownedMats.push(barrelRuneMat);
    damageMats.push(barrelRuneMat);

    // Bulging gothic powder keg body
    const body = new THREE.Mesh(
      getGeo('pk_eb_body', () => new THREE.CylinderGeometry(0.41, 0.45, 0.98, 12)),
      barrelBodyMat
    );
    body.position.y = 0.49;
    body.castShadow = true;
    body.receiveShadow = true;
    visualPivot.add(body);

    const topLid = new THREE.Mesh(
      getGeo('pk_eb_lid', () => new THREE.CylinderGeometry(0.38, 0.38, 0.06, 12)),
      barrelLidMat
    );
    topLid.position.y = 0.98;
    visualPivot.add(topLid);

    // Forged iron reinforcement hoops (bottom, belly, top)
    const hoopEndGeo = getGeo('pk_eb_hoop_end', () => {
      const g = new THREE.TorusGeometry(0.422, 0.032, 6, 16);
      g.rotateX(Math.PI * 0.5);
      return g;
    });
    const hoopMidGeo = getGeo('pk_eb_hoop_mid', () => {
      const g = new THREE.TorusGeometry(0.442, 0.036, 6, 16);
      g.rotateX(Math.PI * 0.5);
      return g;
    });
    const hoopBot = new THREE.Mesh(hoopEndGeo, ironHoopMat);
    hoopBot.position.y = 0.17;
    const hoopMid = new THREE.Mesh(hoopMidGeo, ironHoopMat);
    hoopMid.position.y = 0.50;
    const hoopTop = new THREE.Mesh(hoopEndGeo, ironHoopMat);
    hoopTop.position.y = 0.83;
    visualPivot.add(hoopBot, hoopMid, hoopTop);

    // 4 Glowing Fiery Hazard Runes around the keg belly (readable from any camera angle!)
    const runeGeo = getGeo('pk_eb_rune', () => new THREE.OctahedronGeometry(0.115, 0));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const rune = new THREE.Mesh(runeGeo, barrelRuneMat);
      rune.position.set(Math.sin(a) * 0.44, 0.50, Math.cos(a) * 0.44);
      rune.rotation.y = a;
      rune.scale.set(0.95, 1.38, 0.34);
      visualPivot.add(rune);
    }

    // Braided fuse cord + flickering live fuse flame & spark on top
    const fuseCord = new THREE.Mesh(
      getGeo('pk_eb_fuse', () => new THREE.CylinderGeometry(0.024, 0.03, 0.22, 6)),
      fuseCordMat
    );
    fuseCord.position.set(0.02, 1.09, 0.01);
    fuseCord.rotation.z = -0.18;
    visualPivot.add(fuseCord);

    fuseFlamePivot = new THREE.Group();
    fuseFlamePivot.position.set(0.04, 1.21, 0.01);
    const flameOuter = new THREE.Mesh(
      getGeo('pk_eb_flame_out_geo', () => new THREE.ConeGeometry(0.115, 0.29, 7)),
      flameOuterMat
    );
    flameOuter.position.y = 0.12;
    const flameCore = new THREE.Mesh(
      getGeo('pk_eb_flame_core_geo', () => new THREE.SphereGeometry(0.068, 7, 7)),
      flameCoreMat
    );
    flameCore.position.y = 0.05;
    fuseFlamePivot.add(flameOuter, flameCore);
    visualPivot.add(fuseFlamePivot);

    fuseSparkMesh = new THREE.Mesh(
      getGeo('pk_eb_spark_geo', () => new THREE.OctahedronGeometry(0.045, 0)),
      flameCoreMat
    );
    fuseSparkMesh.position.set(0.04, 1.42, 0.01);
    visualPivot.add(fuseSparkMesh);

    // Subtle glowing ground hazard ring so the keg stands out cleanly in combat
    barrelHaloRing = new THREE.Mesh(
      getGeo('pk_eb_halo_geo', () => {
        const g = new THREE.RingGeometry(0.47, 0.65, 18);
        g.rotateX(-Math.PI * 0.5);
        return g;
      }),
      haloMat
    );
    barrelHaloRing.position.y = 0.03;
    root.add(barrelHaloRing);
  } else if (pickupType === 'cursed_chest') {
    // Sinister Crimson-Violet Runic Cursed Chest (×3 Gold Jackpot + Ambush!)
    cursedGlowMat = new THREE.MeshStandardMaterial({
      color: 0xf0abfc,
      emissive: 0xc026d3,
      emissiveIntensity: 1.55,
      roughness: 0.18,
      metalness: 0.25
    });
    ownedMats.push(cursedGlowMat);
    damageMats.push(cursedGlowMat);

    const cursedChestAsset = gltfCache.get('chest_disguise_tripo') || gltfCache.get('chest_gold') || gltfCache.get('chest');
    const isTripoCursed = Boolean(gltfCache.get('chest_disguise_tripo'));
    if (cursedChestAsset?.scene) {
      const cloned = cursedChestAsset.scene.clone(true);
      cloned.scale.setScalar(isTripoCursed ? 1.95 : 0.96);
      const darkObsidian = new THREE.Color(0x2e1042);
      cloned.traverse((n) => {
        if (n.isMesh && n.material) {
          const cloneOne = (m) => {
            const c = m.clone();
            if (c.color) c.color.lerp(darkObsidian, 0.58);
            if (c.emissive) {
              c.emissive.setHex(0x6b1048);
              c.emissiveIntensity = 0.45;
            }
            damageMats.push(c);
            ownedMats.push(c);
            return c;
          };
          n.material = Array.isArray(n.material) ? n.material.map(cloneOne) : cloneOne(n.material);
          n.castShadow = true;
          n.receiveShadow = true;
        }
      });
      visualPivot.add(cloned);
    } else {
      const bodyMat = getMat('pk_cc_body_mat', () =>
        new THREE.MeshStandardMaterial({
          color: 0x2a1038,
          emissive: 0x58103c,
          emissiveIntensity: 0.42,
          roughness: 0.48,
          metalness: 0.35
        })
      );
      const trimMat = getMat('pk_cc_trim_mat', () =>
        new THREE.MeshStandardMaterial({
          color: 0x3b2c4a,
          metalness: 0.85,
          roughness: 0.28
        })
      );
      const box = new THREE.Mesh(
        getGeo('pk_cc_box_geo', () => new THREE.BoxGeometry(0.92, 0.58, 0.68)),
        bodyMat
      );
      box.position.y = 0.30;
      box.castShadow = true;
      box.receiveShadow = true;
      const lid = new THREE.Mesh(
        getGeo('pk_cc_lid_geo', () => new THREE.CylinderGeometry(0.34, 0.34, 0.92, 10, 1, false, 0, Math.PI)),
        bodyMat
      );
      lid.rotation.z = Math.PI * 0.5;
      lid.position.y = 0.59;
      lid.castShadow = true;
      const bandL = new THREE.Mesh(
        getGeo('pk_cc_band_geo', () => new THREE.BoxGeometry(0.10, 0.64, 0.72)),
        trimMat
      );
      bandL.position.set(-0.28, 0.34, 0);
      const bandR = bandL.clone();
      bandR.position.x = 0.28;
      const clasp = new THREE.Mesh(
        getGeo('pk_cc_clasp_geo', () => new THREE.OctahedronGeometry(0.11, 0)),
        cursedGlowMat
      );
      clasp.position.set(0, 0.52, 0.36);
      visualPivot.add(box, lid, bandL, bandR, clasp);
    }

    // Floating spinning crimson-violet cursed rune crystal above the chest
    cursedCrystalPivot = new THREE.Group();
    cursedCrystalPivot.position.set(0, 1.38, 0);
    const crystal = new THREE.Mesh(
      getGeo('pk_cc_crystal_geo', () => new THREE.OctahedronGeometry(0.22, 0)),
      cursedGlowMat
    );
    crystal.scale.set(0.85, 1.55, 0.85);
    const crystalHalo = new THREE.Mesh(
      getGeo('pk_cc_cring_geo', () => {
        const g = new THREE.TorusGeometry(0.32, 0.022, 6, 18);
        g.rotateX(Math.PI * 0.35);
        return g;
      }),
      getMat('pk_cc_ring_mat', () =>
        new THREE.MeshBasicMaterial({
          color: 0xf43f5e,
          transparent: true,
          opacity: 0.78,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      )
    );
    cursedCrystalPivot.add(crystal, crystalHalo);
    root.add(cursedCrystalPivot);

    // 3 orbiting dark-crimson shards around the chest
    cursedShardsPivot = new THREE.Group();
    cursedShardsPivot.position.y = 0.78;
    const shardGeo = getGeo('pk_cc_shard_geo', () => new THREE.OctahedronGeometry(0.085, 0));
    const shardMat = getMat('pk_cc_shard_mat', () =>
      new THREE.MeshBasicMaterial({
        color: 0xe879f9,
        transparent: true,
        opacity: 0.88,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const sh = new THREE.Mesh(shardGeo, shardMat);
      sh.position.set(Math.cos(a) * 0.72, (i % 2 === 0 ? 0.08 : -0.08), Math.sin(a) * 0.72);
      sh.scale.set(0.7, 1.5, 0.7);
      cursedShardsPivot.add(sh);
    }
    root.add(cursedShardsPivot);

    // Sinister crimson-violet ground hex halo
    cursedHaloRing = new THREE.Mesh(
      getGeo('pk_cc_halo_geo', () => {
        const g = new THREE.RingGeometry(0.64, 0.94, 24);
        g.rotateX(-Math.PI * 0.5);
        return g;
      }),
      getMat('pk_cc_halo_mat', () =>
        new THREE.MeshBasicMaterial({
          color: 0xc026d3,
          transparent: true,
          opacity: 0.48,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      )
    );
    cursedHaloRing.position.y = 0.035;
    root.add(cursedHaloRing);

    beaconPart = new THREE.Mesh(
      getGeo('pk_cc_beacon_geo', () => new THREE.CylinderGeometry(0.18, 0.62, 2.35, 12, 1, true)),
      getMat('pk_cc_beacon_mat', () =>
        new THREE.MeshBasicMaterial({
          color: 0x9333ea,
          transparent: true,
          opacity: 0.24,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      )
    );
    beaconPart.position.y = 1.18;
    root.add(beaconPart);
  }

  return {
    root,
    dispose() {
      for (const m of ownedMats) {
        if (m?.dispose) m.dispose();
      }
      ownedMats.length = 0;
      damageMats.length = 0;
      barrelRuneMat = null;
      cursedGlowMat = null;
    },
    setShrinkRatio(r) {
      shrinkRatio = Math.max(0.45, Math.min(1.0, Number(r) || 1.0));
      visualPivot.scale.setScalar(shrinkRatio);
    },
    setDamageGlow(r) {
      damageGlow = Math.max(0, Math.min(1, Number(r) || 0));
      for (const m of damageMats) {
        const restHex = m === barrelRuneMat ? 0xf97316 : m === cursedGlowMat ? 0xc026d3 : 0x000000;
        const restInt = m === barrelRuneMat ? 1.45 : m === cursedGlowMat ? 1.55 : 0;
        m.emissive.setHex(damageGlow > 0.02 ? 0xef4444 : restHex);
        m.emissiveIntensity = damageGlow > 0.02 ? damageGlow * 1.6 : restInt;
      }
    },
    update(dt, elapsedTime = 0) {
      if (floatingPart) floatingPart.rotation.y = elapsedTime * 2.4;
      if (beaconPart) {
        const s = 0.88 + Math.sin(elapsedTime * 4.2) * 0.14;
        beaconPart.scale.set(s, 1, s);
      }
      if (fuseFlamePivot) {
        const flick = 0.86 + Math.sin(elapsedTime * 21.0) * 0.16 + Math.cos(elapsedTime * 34.0) * 0.09;
        fuseFlamePivot.scale.set(0.92 + Math.sin(elapsedTime * 17.0) * 0.12, flick * 1.15, 0.92 + Math.cos(elapsedTime * 19.0) * 0.12);
        fuseFlamePivot.rotation.z = Math.sin(elapsedTime * 13.0) * 0.16;
      }
      if (fuseSparkMesh) {
        const u = (elapsedTime * 2.6) % 1;
        const a = elapsedTime * 9.5;
        fuseSparkMesh.position.set(0.04 + Math.cos(a) * (0.04 + u * 0.11), 1.32 + u * 0.36, 0.01 + Math.sin(a) * (0.04 + u * 0.11));
        fuseSparkMesh.scale.setScalar(Math.max(0.15, (1 - u) * 1.15));
      }
      if (barrelRuneMat && damageGlow <= 0.02) {
        barrelRuneMat.emissiveIntensity = 1.25 + Math.sin(elapsedTime * 6.5) * 0.45;
      }
      if (barrelHaloRing) {
        const hs = 0.94 + Math.sin(elapsedTime * 5.0) * 0.08;
        barrelHaloRing.scale.set(hs, 1, hs);
      }
      if (cursedCrystalPivot) {
        cursedCrystalPivot.rotation.y = elapsedTime * 2.1;
        cursedCrystalPivot.position.y = 1.36 + Math.sin(elapsedTime * 3.6) * 0.11;
      }
      if (cursedShardsPivot) {
        cursedShardsPivot.rotation.y = -elapsedTime * 2.6;
        cursedShardsPivot.position.y = 0.78 + Math.cos(elapsedTime * 3.0) * 0.06;
      }
      if (cursedGlowMat && damageGlow <= 0.02) {
        cursedGlowMat.emissiveIntensity = 1.35 + Math.sin(elapsedTime * 5.8) * 0.55;
      }
      if (cursedHaloRing) {
        const cs = 0.92 + Math.sin(elapsedTime * 4.4) * 0.10;
        cursedHaloRing.scale.set(cs, 1, cs);
        cursedHaloRing.rotation.z = elapsedTime * 0.85;
      }
      if (damageGlow > 0.05) {
        visualPivot.position.x = Math.sin(elapsedTime * 55) * damageGlow * 0.06;
      } else {
        visualPivot.position.x = 0;
      }
    }
  };
}
