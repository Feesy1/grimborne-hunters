// Elden Ring-Style Corpse Ash-and-Ember Dissolve VFX Module (Three.js r160, Vanilla ES)
// Chapter 26 — «Abandoned Knight Rift» (0 DOM dependencies, WebGL2 & Mobile safe)
//
// Exports:
//   - applyEldenDissolveToModel(root, progress01, opts?)
//       Injects a 3D procedural noise dissolve shader via `onBeforeCompile` on safely cloned
//       per-corpse materials (leaving shared living-enemy materials untouched!) while preserving
//       USE_SKINNING, normalMap, emissiveMap, `applySoulsRimLight`, and `soulsBossVisuals`.
//       As `progress01` sweeps 0 -> 1, the vaporizing edge chars and blazes with molten
//       golden-orange embers (#ffbe42 -> #ff4500) before vanishing completely into ash.
//   - resetEldenDissolveFromModel(root) / disposeEldenDissolveFromModel(root)
//       Restores original mesh materials & `castShadow` and disposes temporary cloned materials
//       (safe for enemy object pooling — 0 GPU leaks).
//   - isModelEldenDissolving(root)
//       Returns whether `root` currently has active dissolve state attached.
//   - createDissolveAshSystem(scene, { isMobile, lowSpec, maxParticles })
//       Strictly 1-Draw-Call GPU-driven InstancedBufferGeometry particle system using
//       premultiplied dual-mode blending (NormalBlending fluttering dark-grey ash flakes +
//       luminous Additive golden-orange rising sparks in a single draw call; 0 DC when idle).
//       API: `.emitCorpseAsh(x, y, z, radius, intensity, opts?)`, `.update(dt)`,
//       `.clearAll()`, `.setLowSpec(enabled)`, `.getActiveCount()`, `.getDrawCallCount()`, `.dispose()`.

import * as THREE from '../../vendor/three.module.js';

// ============================================================================
// Constants & Reusable Scratch Objects (Zero Per-Frame Allocations)
// ============================================================================
const DISSOLVE_CACHE_TAG = 'elden_dissolve_v1';
const _tmpOrigin = new THREE.Vector3();

const corpseDissolveState = new WeakMap();

function detectMobileDevice() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPhone|iPod|iPad|Android/i.test(ua)) return true;
  if (typeof window !== 'undefined') {
    const touch = navigator.maxTouchPoints || 0;
    const minDim = Math.min(window.innerWidth || 1280, window.innerHeight || 720);
    if (touch > 1 && minDim <= 1024) return true;
  }
  return false;
}

function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n >= 1 ? 1 : n;
}

function isPatchableBuiltinMaterial(mat) {
  if (!mat || typeof mat !== 'object') return false;
  if (mat.isShaderMaterial || mat.isRawShaderMaterial || mat.isSpriteMaterial || mat.isPointsMaterial) {
    return false;
  }
  return Boolean(
    mat.isMeshStandardMaterial ||
    mat.isMeshPhysicalMaterial ||
    mat.isMeshLambertMaterial ||
    mat.isMeshPhongMaterial ||
    mat.isMeshBasicMaterial ||
    mat.isMeshToonMaterial
  );
}

function shouldSkipDissolveMesh(node) {
  if (!node || !node.isMesh || !node.material) return true;
  if (node.userData?.isActorContactShadow || node.userData?.skipEldenDissolve) return true;
  const nm = node.name || '';
  if (/ContactShadow/i.test(nm)) return true;
  return false;
}

/**
 * Safely clones a Three.js material without letting Material.prototype.copy()
 * JSON-serialize arbitrary Texture/Object3D entries inside `userData`, AND
 * preserves any own `onBeforeCompile` / `customProgramCacheKey` hooks
 * (such as `applySoulsRimLight` and `soulsBossVisuals`).
 */
function safeCloneMaterialWithHooks(srcMat) {
  const origUserData = srcMat.userData;
  srcMat.userData = {};
  let cloned;
  try {
    cloned = srcMat.clone();
  } finally {
    srcMat.userData = origUserData;
  }
  cloned.userData = { ...(origUserData || {}), isEldenDissolveClone: true };

  const hadOwnCompile =
    Object.prototype.hasOwnProperty.call(srcMat, 'onBeforeCompile') &&
    typeof srcMat.onBeforeCompile === 'function';
  const hadOwnCacheKey =
    Object.prototype.hasOwnProperty.call(srcMat, 'customProgramCacheKey') &&
    typeof srcMat.customProgramCacheKey === 'function';

  if (hadOwnCompile) {
    cloned.onBeforeCompile = srcMat.onBeforeCompile;
  }
  if (hadOwnCacheKey) {
    cloned.customProgramCacheKey = srcMat.customProgramCacheKey;
  }
  return cloned;
}

// ============================================================================
// Compact, Mobile-Safe, ANGLE/D3D11 Warning-Free 3D Dissolve GLSL Chunks
// ============================================================================
const GLSL_DISSOLVE_VERT_COMMON = /* glsl */ `
varying vec3 vEldenDissolveWorldPos;
`;

const GLSL_DISSOLVE_VERT_PROJECT = /* glsl */ `
#ifdef USE_INSTANCING
  vec4 edWorldPos4 = modelMatrix * instanceMatrix * vec4( transformed, 1.0 );
#else
  vec4 edWorldPos4 = modelMatrix * vec4( transformed, 1.0 );
#endif
vEldenDissolveWorldPos = edWorldPos4.xyz;
#include <project_vertex>
`;

const GLSL_DISSOLVE_FRAG_COMMON = /* glsl */ `
uniform float uEldenDissolve;
uniform vec3 uEldenOrigin;
uniform float uEldenHeight;
uniform float uEldenNoiseScale;
uniform float uEldenEdgeWidth;
uniform float uEldenEmberIntensity;
uniform float uEldenTime;
varying vec3 vEldenDissolveWorldPos;

float edHash31( vec3 p3 ) {
  p3 = fract( p3 * 0.1031 );
  p3 += dot( p3, p3.zyx + 31.32 );
  return fract( ( p3.x + p3.y ) * p3.z );
}

float edValueNoise3( vec3 p ) {
  vec3 i = floor( p );
  vec3 f = fract( p );
  vec3 u = f * f * ( 3.0 - 2.0 * f );
  float n000 = edHash31( i + vec3( 0.0, 0.0, 0.0 ) );
  float n100 = edHash31( i + vec3( 1.0, 0.0, 0.0 ) );
  float n010 = edHash31( i + vec3( 0.0, 1.0, 0.0 ) );
  float n110 = edHash31( i + vec3( 1.0, 1.0, 0.0 ) );
  float n001 = edHash31( i + vec3( 0.0, 0.0, 1.0 ) );
  float n101 = edHash31( i + vec3( 1.0, 0.0, 1.0 ) );
  float n011 = edHash31( i + vec3( 0.0, 1.0, 1.0 ) );
  float n111 = edHash31( i + vec3( 1.0, 1.0, 1.0 ) );
  float nx00 = mix( n000, n100, u.x );
  float nx10 = mix( n010, n110, u.x );
  float nx01 = mix( n001, n101, u.x );
  float nx11 = mix( n011, n111, u.x );
  float nxy0 = mix( nx00, nx10, u.y );
  float nxy1 = mix( nx01, nx11, u.y );
  return mix( nxy0, nxy1, u.z );
}

float edDissolveFbm( vec3 p ) {
  float a = edValueNoise3( p );
  float b = edValueNoise3( p * 2.31 + vec3( 17.3, 9.1, 23.7 ) );
  return a * 0.62 + b * 0.38;
}
`;

// Injected strictly right before `#include <opaque_fragment>` so `applySoulsRimLight`
// and `soulsBossVisuals` run first, while ACES tone-mapping, fog, and dithering run after!
const GLSL_DISSOLVE_FRAG_OPAQUE = /* glsl */ `
if ( uEldenDissolve > 0.0005 ) {
  vec3 edRel = vEldenDissolveWorldPos - uEldenOrigin;
  float edSafeH = max( uEldenHeight, 0.25 );
  float edHeightNorm = clamp( edRel.y / edSafeH, 0.0, 1.0 );
  float edRadial = clamp( length( edRel.xz ) / max( edSafeH * 0.72, 0.40 ), 0.0, 1.0 );
  float edNoise = edDissolveFbm( edRel * uEldenNoiseScale );
  float edField = clamp( edNoise * 0.74 + ( 1.0 - edRadial ) * 0.14 + edHeightNorm * 0.12, 0.0, 1.0 );

  float edCut = uEldenDissolve * 1.08 - 0.04;
  float edDist = edField - edCut;
  if ( edDist < 0.0 ) discard;

  float edW = max( uEldenEdgeWidth, 0.02 );
  float edFadeIn = smoothstep( 0.0, 0.10, uEldenDissolve );
  float edBand = 1.0 - smoothstep( 0.0, edW, edDist );
  float edCore = 1.0 - smoothstep( 0.0, edW * 0.28, edDist );
  float edChar = ( 1.0 - smoothstep( 0.0, edW * 1.75, edDist ) ) * edFadeIn;

  // Living ember crackle along the burning contour (upward-drifting fine grain)
  float edCrackle = edValueNoise3( edRel * ( uEldenNoiseScale * 3.1 ) + vec3( 0.0, -uEldenTime * 1.9, 0.0 ) );
  float edSparkBoost = 0.78 + 0.44 * edCrackle;

  // Linear-space golden-orange ember ramp (#ff4500 -> #ffbe42 -> incandescent white-gold)
  vec3 edColDeep = vec3( 1.0, 0.062, 0.004 );
  vec3 edColGold = vec3( 1.0, 0.515, 0.055 );
  vec3 edColHot  = vec3( 1.0, 0.860, 0.400 );
  vec3 edEmber = mix( edColDeep, edColGold, smoothstep( 0.18, 0.80, edBand ) );
  edEmber = mix( edEmber, edColHot, clamp( edCore * ( 0.58 + 0.42 * edCrackle ), 0.0, 1.0 ) );

  // Char the surface just ahead of the flame front, then add HDR golden-orange glow
  outgoingLight *= mix( 1.0, 0.18, edChar * ( 1.0 - edBand * 0.58 ) );
  outgoingLight += edEmber * ( ( edBand * 1.85 + edCore * 1.45 ) * edSparkBoost * edFadeIn * uEldenEmberIntensity );
}
#include <opaque_fragment>
`;

function patchClonedMaterialForDissolve(clonedMat, uniforms) {
  const hadOwnCompile =
    Object.prototype.hasOwnProperty.call(clonedMat, 'onBeforeCompile') &&
    typeof clonedMat.onBeforeCompile === 'function';
  const prevOnBeforeCompile = hadOwnCompile ? clonedMat.onBeforeCompile : null;

  const hadOwnCacheKey =
    Object.prototype.hasOwnProperty.call(clonedMat, 'customProgramCacheKey') &&
    typeof clonedMat.customProgramCacheKey === 'function';
  const prevCacheKey = hadOwnCacheKey ? clonedMat.customProgramCacheKey : null;

  // DoubleSide reveals the glowing interior ember contours as holes burn through armor
  clonedMat.side = THREE.DoubleSide;

  clonedMat.customProgramCacheKey = () => {
    const base = prevCacheKey ? prevCacheKey.call(clonedMat) : '';
    if (base && base.includes(DISSOLVE_CACHE_TAG)) return base;
    return base ? `${base}|${DISSOLVE_CACHE_TAG}` : DISSOLVE_CACHE_TAG;
  };

  clonedMat.onBeforeCompile = (shader, renderer) => {
    if (prevOnBeforeCompile) {
      prevOnBeforeCompile.call(clonedMat, shader, renderer);
    }
    shader.uniforms.uEldenDissolve = uniforms.uEldenDissolve;
    shader.uniforms.uEldenOrigin = uniforms.uEldenOrigin;
    shader.uniforms.uEldenHeight = uniforms.uEldenHeight;
    shader.uniforms.uEldenNoiseScale = uniforms.uEldenNoiseScale;
    shader.uniforms.uEldenEdgeWidth = uniforms.uEldenEdgeWidth;
    shader.uniforms.uEldenEmberIntensity = uniforms.uEldenEmberIntensity;
    shader.uniforms.uEldenTime = uniforms.uEldenTime;

    if (!shader.vertexShader.includes('vEldenDissolveWorldPos')) {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${GLSL_DISSOLVE_VERT_COMMON}`)
        .replace('#include <project_vertex>', GLSL_DISSOLVE_VERT_PROJECT);
    }

    if (!shader.fragmentShader.includes('uEldenDissolve')) {
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${GLSL_DISSOLVE_FRAG_COMMON}`)
        .replace('#include <opaque_fragment>', GLSL_DISSOLVE_FRAG_OPAQUE);
    }
  };

  clonedMat.needsUpdate = true;
  return clonedMat;
}

function estimateModelMetricHeight(root, opts) {
  if (Number.isFinite(Number(opts?.height)) && Number(opts.height) > 0.2) {
    return Number(opts.height);
  }
  const sy = Math.abs(root?.scale?.y || 1);
  return Math.max(0.9, Math.min(5.5, 1.8 * sy));
}

function initCorpseDissolveRecord(root, opts) {
  root.updateWorldMatrix(true, false);
  root.getWorldPosition(_tmpOrigin);

  const height = estimateModelMetricHeight(root, opts);
  const defaultNoiseScale = height > 2.6 ? 3.6 : 5.4;
  const noiseScale = Number.isFinite(Number(opts?.noiseScale))
    ? Math.max(0.5, Number(opts.noiseScale))
    : defaultNoiseScale;
  const edgeWidth = Number.isFinite(Number(opts?.edgeWidth))
    ? Math.max(0.03, Math.min(0.40, Number(opts.edgeWidth)))
    : 0.115;
  const emberIntensity = Number.isFinite(Number(opts?.emberIntensity))
    ? Math.max(0, Number(opts.emberIntensity))
    : 1.0;

  const uniforms = {
    uEldenDissolve: { value: 0.0 },
    uEldenOrigin: { value: _tmpOrigin.clone() },
    uEldenHeight: { value: height },
    uEldenNoiseScale: { value: noiseScale },
    uEldenEdgeWidth: { value: edgeWidth },
    uEldenEmberIntensity: { value: emberIntensity },
    uEldenTime: { value: 0.0 }
  };

  const entries = [];
  const ownedClones = [];
  const cloneBySource = new Map();

  const getOrClonePatched = (srcMat) => {
    if (!isPatchableBuiltinMaterial(srcMat)) return srcMat;
    if (cloneBySource.has(srcMat)) return cloneBySource.get(srcMat);
    const cloned = safeCloneMaterialWithHooks(srcMat);
    patchClonedMaterialForDissolve(cloned, uniforms);
    cloneBySource.set(srcMat, cloned);
    ownedClones.push(cloned);
    return cloned;
  };

  root.traverse((node) => {
    if (shouldSkipDissolveMesh(node)) return;
    const origMat = node.material;
    if (Array.isArray(origMat)) {
      let anyPatched = false;
      const mapped = origMat.map((m) => {
        const next = getOrClonePatched(m);
        if (next !== m) anyPatched = true;
        return next;
      });
      if (!anyPatched) return;
      entries.push({
        mesh: node,
        origMat,
        dissolveMat: mapped,
        origCastShadow: Boolean(node.castShadow)
      });
      node.material = mapped;
    } else {
      const next = getOrClonePatched(origMat);
      if (next === origMat) return;
      entries.push({
        mesh: node,
        origMat,
        dissolveMat: next,
        origCastShadow: Boolean(node.castShadow)
      });
      node.material = next;
    }
  });

  const rec = {
    uniforms,
    entries,
    ownedClones,
    active: entries.length > 0
  };
  corpseDissolveState.set(root, rec);
  return rec;
}

/**
 * Restores original materials & shadow flags on `root` and disposes all temporary
 * per-corpse dissolve material clones (0 GPU leaks, safe for enemy pooling!).
 */
export function resetEldenDissolveFromModel(root) {
  if (!root) return false;
  const rec = corpseDissolveState.get(root);
  if (!rec) return false;

  rec.uniforms.uEldenDissolve.value = 0.0;
  for (let i = 0; i < rec.entries.length; i++) {
    const entry = rec.entries[i];
    if (entry.mesh) {
      entry.mesh.material = entry.origMat;
      entry.mesh.castShadow = entry.origCastShadow;
    }
  }
  for (let i = 0; i < rec.ownedClones.length; i++) {
    const mat = rec.ownedClones[i];
    if (mat && typeof mat.dispose === 'function') {
      mat.dispose();
    }
  }
  rec.entries.length = 0;
  rec.ownedClones.length = 0;
  rec.active = false;
  corpseDissolveState.delete(root);
  return true;
}

export const disposeEldenDissolveFromModel = resetEldenDissolveFromModel;

export function isModelEldenDissolving(root) {
  if (!root) return false;
  const rec = corpseDissolveState.get(root);
  return Boolean(rec && rec.active && rec.uniforms.uEldenDissolve.value > 0.0005);
}

/**
 * Applies smooth 3D-noise Elden Ring ash/ember dissolution (`progress01`: 0 -> 1)
 * to a dying 3D character model (`root`), keeping living enemies on shared materials
 * 100% untouched and preserving `USE_SKINNING` + `applySoulsRimLight` + `soulsBossVisuals`.
 *
 * Calling with `progress01 <= 0` automatically restores original materials & cleans up clones.
 *
 * @param {THREE.Object3D} root
 * @param {number} progress01  Normalized dissolve progress in [0, 1]
 * @param {object} [opts]      Optional `{ dt, time, height, noiseScale, edgeWidth, emberIntensity }`
 * @returns {boolean} True while dissolve shader is active on `root`
 */
export function applyEldenDissolveToModel(root, progress01, opts = null) {
  if (!root) return false;
  const p = clamp01(progress01);

  if (p <= 0.0001) {
    if (corpseDissolveState.has(root)) {
      resetEldenDissolveFromModel(root);
    }
    return false;
  }

  let rec = corpseDissolveState.get(root);
  if (!rec) {
    rec = initCorpseDissolveRecord(root, opts);
  }
  if (!rec.active) return false;

  rec.uniforms.uEldenDissolve.value = p;
  if (opts && Number.isFinite(Number(opts.time))) {
    rec.uniforms.uEldenTime.value = Number(opts.time);
  } else {
    const dt = opts && Number.isFinite(Number(opts.dt)) ? Math.max(0, Math.min(0.1, Number(opts.dt))) : 0.016;
    rec.uniforms.uEldenTime.value += dt;
  }
  if (opts && Number.isFinite(Number(opts.emberIntensity))) {
    rec.uniforms.uEldenEmberIntensity.value = Math.max(0, Number(opts.emberIntensity));
  }
  if (opts && Number.isFinite(Number(opts.noiseScale))) {
    rec.uniforms.uEldenNoiseScale.value = Math.max(0.5, Number(opts.noiseScale));
  }
  if (opts && Number.isFinite(Number(opts.edgeWidth))) {
    rec.uniforms.uEldenEdgeWidth.value = Math.max(0.03, Math.min(0.40, Number(opts.edgeWidth)));
  }

  // Keep dissolve materials bound even if a hit-flash timer resets mesh.material mid-death,
  // and fade out opaque shadow casting once the corpse is mostly vaporized.
  const keepShadow = p < 0.35;
  for (let i = 0; i < rec.entries.length; i++) {
    const entry = rec.entries[i];
    if (!entry.mesh) continue;
    if (entry.mesh.material !== entry.dissolveMat) {
      entry.mesh.material = entry.dissolveMat;
    }
    entry.mesh.castShadow = keepShadow ? entry.origCastShadow : false;
  }

  return true;
}

// ============================================================================
// 1-Draw-Call GPU Instanced Dissolve Ash & Golden Embers Particle System
// ============================================================================
const ASH_VERT_SHADER = /* glsl */ `
uniform float uTime;
uniform float uPixelScale;

attribute vec4 aSpawnPosTime; // xyz = world spawn pos, w = spawnTime
attribute vec4 aVelLife;      // xyz = initial velocity, w = lifetime sec
attribute vec4 aStyle;        // x = base size (m), y = isEmber (0 ash | 1 spark), z = seed [0..1], w = swirlAmp

varying vec2 vUv;
varying float vAlpha;
varying float vIsEmber;
varying float vLifeT;
varying float vSeed;

void main() {
  vUv = uv;
  float age = uTime - aSpawnPosTime.w;
  float life = max( aVelLife.w, 0.001 );
  float t = age / life;

  if ( age < 0.0 || t >= 1.0 || aStyle.x <= 0.0001 ) {
    vAlpha = 0.0;
    vIsEmber = 0.0;
    vLifeT = 1.0;
    vSeed = 0.0;
    gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );
    return;
  }

  float isEmber = aStyle.y;
  float seed = aStyle.z;
  float swirlAmp = aStyle.w;

  // Smooth aerodynamic drag on initial burst + rising thermal draft + helical cathedral air swirl
  float drag = ( 1.0 - exp( -age * ( isEmber > 0.5 ? 1.15 : 1.65 ) ) ) / ( isEmber > 0.5 ? 1.15 : 1.65 );
  float buoyancy = ( isEmber > 0.5 ? 0.42 : 0.16 ) * age * age;
  float swirlFreq = ( isEmber > 0.5 ? 3.2 : 1.9 ) + seed * 1.8;
  float swirlPhase = age * swirlFreq + seed * 6.2831853;
  float swirlEnv = smoothstep( 0.0, 0.30, t ) * ( 1.0 - 0.35 * t );

  vec3 worldPos = aSpawnPosTime.xyz;
  worldPos.x += aVelLife.x * drag + cos( swirlPhase ) * swirlAmp * swirlEnv;
  worldPos.z += aVelLife.z * drag + sin( swirlPhase * 0.87 + seed * 3.14159 ) * swirlAmp * swirlEnv;
  worldPos.y += aVelLife.y * age + buoyancy;

  // Size envelope: crisp pop-in, gentle shrink as ash/embers burn out
  float popIn = smoothstep( 0.0, 0.11, t );
  float fadeOut = 1.0 - smoothstep( 0.48, 1.0, t );
  float sizeCurve = popIn * mix( 1.0, 0.32, smoothstep( 0.35, 1.0, t ) );
  float baseSize = aStyle.x * sizeCurve * uPixelScale;

  // Tumbling spin for ash flakes; subtle vertical velocity streak for rising golden sparks
  float rot = ( seed * 6.2831853 ) + age * ( isEmber > 0.5 ? 0.55 : mix( -3.6, 3.6, fract( seed * 7.13 ) ) );
  float cs = cos( rot );
  float sn = sin( rot );

  vec2 localPos = position.xy;
  if ( isEmber > 0.5 ) {
    localPos.x *= baseSize * 0.78;
    localPos.y *= baseSize * 1.48;
  } else {
    float rx = localPos.x * cs - localPos.y * sn;
    float ry = localPos.x * sn + localPos.y * cs;
    // Slight flutter foreshortening so flat ash flakes shimmer as they turn in mid-air
    float flutter = 0.52 + 0.48 * abs( cos( age * ( 2.6 + seed * 3.4 ) + seed * 12.0 ) );
    localPos.x = rx * baseSize * 1.15;
    localPos.y = ry * baseSize * flutter;
  }

  vec4 mvCenter = modelViewMatrix * vec4( worldPos, 1.0 );
  mvCenter.xy += localPos;

  vAlpha = popIn * fadeOut;
  vIsEmber = isEmber;
  vLifeT = t;
  vSeed = seed;
  gl_Position = projectionMatrix * mvCenter;
}
`;

const ASH_FRAG_SHADER = /* glsl */ `
uniform float uTime;

varying vec2 vUv;
varying float vAlpha;
varying float vIsEmber;
varying float vLifeT;
varying float vSeed;

void main() {
  if ( vAlpha <= 0.002 ) discard;

  vec2 p = vUv * 2.0 - 1.0;
  float r = length( p );
  if ( r >= 1.0 ) discard;

  if ( vIsEmber < 0.5 ) {
    // Organic irregular flaky ash silhouette (NormalBlending via premultiplied alpha!)
    float ang = atan( p.y, p.x );
    float edgeR = 0.68
      + 0.17 * sin( ang * 3.0 + vSeed * 6.2831853 )
      + 0.11 * cos( ang * 5.0 - vSeed * 11.73 );
    float mask = 1.0 - smoothstep( edgeR - 0.28, edgeR, r );
    if ( mask <= 0.015 ) discard;

    // Charcoal-grey to pale silver-ash flake with subtle fading ember glow right after detaching
    vec3 darkAsh = vec3( 0.24, 0.23, 0.25 );
    vec3 paleAsh = vec3( 0.58, 0.56, 0.54 );
    vec3 ashCol = mix( darkAsh, paleAsh, fract( vSeed * 5.37 ) );
    float freshEmber = ( 1.0 - smoothstep( 0.0, 0.26, vLifeT ) ) * ( 1.0 - r * 0.7 );
    ashCol = mix( ashCol, vec3( 0.96, 0.44, 0.08 ), freshEmber * 0.62 );

    float a = clamp( mask * vAlpha * 0.84, 0.0, 1.0 );
    gl_FragColor = vec4( ashCol * a, a );
  } else {
    // Blazing golden-orange rising spark (#fff2b2 -> #ffbe42 -> #ff4500), luminous additive via premultiplied alpha!
    float core = exp( -r * r * 6.4 );
    float halo = pow( max( 1.0 - r, 0.0001 ), 2.25 );
    float flicker = 0.76 + 0.24 * sin( uTime * ( 10.5 + vSeed * 8.5 ) + vSeed * 41.0 );

    vec3 colHot  = vec3( 1.0, 0.95, 0.68 );
    vec3 colGold = vec3( 1.0, 0.745, 0.259 ); // #ffbe42
    vec3 colDeep = vec3( 1.0, 0.271, 0.020 ); // #ff4500

    vec3 emberCol = mix( colHot, colGold, smoothstep( 0.0, 0.35, vLifeT ) );
    emberCol = mix( emberCol, colDeep, smoothstep( 0.42, 0.92, vLifeT ) );

    vec3 rgb = emberCol * ( ( core * 1.90 + halo * 0.82 ) * vAlpha * flicker );
    float a = clamp( ( core * 0.14 + halo * 0.04 ) * vAlpha, 0.0, 0.22 );
    gl_FragColor = vec4( rgb, a );
  }
}
`;

/**
 * Creates a strictly 1-draw-call GPU instanced particle system of rising grey ash flakes
 * and luminous golden-orange embers (`#ffbe42 -> #ff4500`) drifting up from dissolving corpses.
 *
 * @param {THREE.Scene|THREE.Object3D|null} scene
 * @param {object} [opts]  `{ isMobile, lowSpec, maxParticles }`
 */
export function createDissolveAshSystem(scene = null, opts = {}) {
  const isMobile = opts?.isMobile !== undefined ? Boolean(opts.isMobile) : detectMobileDevice();
  let lowSpec = Boolean(opts?.lowSpec);

  const defaultMax = lowSpec ? 120 : isMobile ? 220 : 420;
  const maxParticles = Number.isFinite(Number(opts?.maxParticles))
    ? Math.max(32, Math.min(1024, Math.floor(Number(opts.maxParticles))))
    : defaultMax;

  // Base unit billboard quad (4 vertices, 2 triangles)
  const instGeo = new THREE.InstancedBufferGeometry();
  const basePos = new Float32Array([
    -0.5, -0.5, 0.0,
     0.5, -0.5, 0.0,
     0.5,  0.5, 0.0,
    -0.5,  0.5, 0.0
  ]);
  const baseUv = new Float32Array([
    0.0, 0.0,
    1.0, 0.0,
    1.0, 1.0,
    0.0, 1.0
  ]);
  instGeo.setAttribute('position', new THREE.BufferAttribute(basePos, 3));
  instGeo.setAttribute('uv', new THREE.BufferAttribute(baseUv, 2));
  instGeo.setIndex([0, 1, 2, 0, 2, 3]);

  const spawnPosTimeArr = new Float32Array(maxParticles * 4);
  const velLifeArr = new Float32Array(maxParticles * 4);
  const styleArr = new Float32Array(maxParticles * 4);

  // Initialize all slots expired so nothing renders until emitCorpseAsh() is called
  for (let i = 0; i < maxParticles; i++) {
    spawnPosTimeArr[i * 4 + 3] = -999.0;
    velLifeArr[i * 4 + 3] = 0.01;
    styleArr[i * 4] = 0.0;
  }

  const spawnPosTimeAttr = new THREE.InstancedBufferAttribute(spawnPosTimeArr, 4);
  const velLifeAttr = new THREE.InstancedBufferAttribute(velLifeArr, 4);
  const styleAttr = new THREE.InstancedBufferAttribute(styleArr, 4);
  spawnPosTimeAttr.setUsage(THREE.DynamicDrawUsage);
  velLifeAttr.setUsage(THREE.DynamicDrawUsage);
  styleAttr.setUsage(THREE.DynamicDrawUsage);

  instGeo.setAttribute('aSpawnPosTime', spawnPosTimeAttr);
  instGeo.setAttribute('aVelLife', velLifeAttr);
  instGeo.setAttribute('aStyle', styleAttr);
  instGeo.instanceCount = 0;

  const uniforms = {
    uTime: { value: 0.0 },
    uPixelScale: { value: lowSpec ? 0.92 : 1.0 }
  };

  // Premultiplied dual-mode blending:
  //   - Ash flakes output (rgb * a, a) -> crisp NormalBlending dark charcoal/grey flakes
  //   - Golden embers output (rgb * glow, ~0.08) -> vibrant Additive luminous sparks
  // Both render together inside ONE single draw call (1 DC)!
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: ASH_VERT_SHADER,
    fragmentShader: ASH_FRAG_SHADER,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendEquationAlpha: THREE.AddEquation,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    toneMapped: false
  });

  const mesh = new THREE.Mesh(instGeo, material);
  mesh.name = 'SoulsDissolveAshSystem';
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 14;
  mesh.visible = false;

  if (scene && typeof scene.add === 'function') {
    scene.add(mesh);
  }

  // Deterministic lightweight PRNG (zero Math.random GC jitter, silky distribution)
  let rngState = 0x9e3779b9;
  const nextRand = () => {
    rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0;
    return rngState / 4294967296;
  };

  let elapsedTime = 0.0;
  let writeCursor = 0;
  let highWaterCount = 0;
  let maxExpireTime = -1.0;
  let emitFrac = 0.0;
  let disposed = false;

  function emitCorpseAsh(x, y, z, radius = 0.75, intensity = 1.0, emitOpts = null) {
    if (disposed) return 0;

    const cx = Number.isFinite(Number(x)) ? Number(x) : 0;
    const cy = Number.isFinite(Number(y)) ? Number(y) : 0;
    const cz = Number.isFinite(Number(z)) ? Number(z) : 0;
    const safeR = Number.isFinite(Number(radius)) ? Math.max(0.18, Math.min(6.0, Number(radius))) : 0.75;
    const safeInt = Number.isFinite(Number(intensity)) ? Math.max(0, Number(intensity)) : 1.0;

    let spawnCount = 0;
    if (emitOpts && Number.isFinite(Number(emitOpts.count))) {
      spawnCount = Math.max(0, Math.min(maxParticles, Math.floor(Number(emitOpts.count))));
    } else {
      const baseBurst = lowSpec ? 12 : isMobile ? 22 : 38;
      const budgetCap = lowSpec ? Math.min(maxParticles, 120) : maxParticles;
      const raw = safeInt * baseBurst + emitFrac;
      spawnCount = Math.min(budgetCap, Math.floor(raw));
      emitFrac = raw - Math.floor(raw);
    }

    if (spawnCount <= 0) return 0;

    const emberRatio =
      emitOpts && Number.isFinite(Number(emitOpts.emberRatio))
        ? clamp01(emitOpts.emberRatio)
        : 0.44;
    const riseScale =
      emitOpts && Number.isFinite(Number(emitOpts.riseScale))
        ? Math.max(0.25, Number(emitOpts.riseScale))
        : 1.0;
    const sizeScale = Math.max(0.75, Math.min(2.2, 0.75 + safeR * 0.28));
    const slotLimit = lowSpec ? Math.min(maxParticles, 120) : maxParticles;

    for (let i = 0; i < spawnCount; i++) {
      const idx = writeCursor;
      writeCursor = (writeCursor + 1) % slotLimit;
      if (idx + 1 > highWaterCount) highWaterCount = idx + 1;

      const isEmber = nextRand() < emberRatio ? 1.0 : 0.0;
      const angle = nextRand() * Math.PI * 2.0;
      // Bias radial spread across the fallen corpse silhouette
      const dist = Math.sqrt(nextRand()) * safeR;
      const heightSpread = Math.max(0.22, safeR * 0.55);

      const px = cx + Math.cos(angle) * dist;
      const py = cy + 0.04 + nextRand() * heightSpread;
      const pz = cz + Math.sin(angle) * dist;

      // Slight time stagger prevents flat planar rings on large burst spawns
      const spawnT = elapsedTime + nextRand() * 0.10;
      const life = isEmber > 0.5
        ? 0.95 + nextRand() * 1.05
        : 1.35 + nextRand() * 1.25;

      const radialSpeed = (0.14 + nextRand() * 0.52) * (isEmber > 0.5 ? 1.15 : 0.75);
      const vx = Math.cos(angle) * radialSpeed + (nextRand() - 0.5) * 0.25;
      const vz = Math.sin(angle) * radialSpeed + (nextRand() - 0.5) * 0.25;
      const vy = (isEmber > 0.5 ? 0.72 + nextRand() * 1.15 : 0.36 + nextRand() * 0.68) * riseScale;

      const baseSize = isEmber > 0.5
        ? (0.045 + nextRand() * 0.055) * sizeScale
        : (0.055 + nextRand() * 0.085) * sizeScale;
      const seed = nextRand();
      const swirlAmp = (isEmber > 0.5 ? 0.14 + nextRand() * 0.22 : 0.18 + nextRand() * 0.30) * Math.min(1.6, 0.75 + safeR * 0.3);

      const o = idx * 4;
      spawnPosTimeArr[o]     = px;
      spawnPosTimeArr[o + 1] = py;
      spawnPosTimeArr[o + 2] = pz;
      spawnPosTimeArr[o + 3] = spawnT;

      velLifeArr[o]     = vx;
      velLifeArr[o + 1] = vy;
      velLifeArr[o + 2] = vz;
      velLifeArr[o + 3] = life;

      styleArr[o]     = baseSize;
      styleArr[o + 1] = isEmber;
      styleArr[o + 2] = seed;
      styleArr[o + 3] = swirlAmp;

      const expT = spawnT + life;
      if (expT > maxExpireTime) maxExpireTime = expT;
    }

    spawnPosTimeAttr.needsUpdate = true;
    velLifeAttr.needsUpdate = true;
    styleAttr.needsUpdate = true;

    instGeo.instanceCount = Math.min(highWaterCount, slotLimit);
    mesh.visible = instGeo.instanceCount > 0;
    return spawnCount;
  }

  function update(dt) {
    if (disposed) return;
    const safeDt = Number.isFinite(Number(dt)) ? Math.max(0, Math.min(0.1, Number(dt))) : 0.016;
    elapsedTime += safeDt;
    uniforms.uTime.value = elapsedTime;

    if (mesh.visible && elapsedTime > maxExpireTime + 0.05) {
      mesh.visible = false;
      instGeo.instanceCount = 0;
      highWaterCount = 0;
      writeCursor = 0;
    }
  }

  function clearAll() {
    if (disposed) return;
    for (let i = 0; i < maxParticles; i++) {
      spawnPosTimeArr[i * 4 + 3] = -999.0;
      styleArr[i * 4] = 0.0;
    }
    spawnPosTimeAttr.needsUpdate = true;
    styleAttr.needsUpdate = true;
    writeCursor = 0;
    highWaterCount = 0;
    maxExpireTime = -1.0;
    emitFrac = 0.0;
    instGeo.instanceCount = 0;
    mesh.visible = false;
  }

  function setLowSpec(enabled) {
    lowSpec = Boolean(enabled);
    uniforms.uPixelScale.value = lowSpec ? 0.92 : 1.0;
    const slotLimit = lowSpec ? Math.min(maxParticles, 120) : maxParticles;
    if (instGeo.instanceCount > slotLimit) {
      instGeo.instanceCount = slotLimit;
    }
    if (writeCursor >= slotLimit) {
      writeCursor = 0;
    }
  }

  function getActiveCount() {
    if (disposed || !mesh.visible || instGeo.instanceCount <= 0) return 0;
    let alive = 0;
    const n = instGeo.instanceCount;
    for (let i = 0; i < n; i++) {
      const st = spawnPosTimeArr[i * 4 + 3];
      const life = velLifeArr[i * 4 + 3];
      if (elapsedTime >= st - 0.12 && elapsedTime < st + life) {
        alive += 1;
      }
    }
    return alive;
  }

  function getDrawCallCount() {
    return !disposed && mesh.visible && instGeo.instanceCount > 0 ? 1 : 0;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (mesh.parent) {
      mesh.parent.remove(mesh);
    }
    instGeo.dispose();
    material.dispose();
  }

  return {
    mesh,
    maxParticles,
    emitCorpseAsh,
    update,
    clearAll,
    setLowSpec,
    getActiveCount,
    getDrawCallCount,
    dispose
  };
}
