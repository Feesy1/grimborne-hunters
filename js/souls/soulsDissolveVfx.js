// Elden Ring-Style Corpse Ash-and-Ember Dissolve VFX Module — Wave 2 Next-Gen Coal & Vortex Edition
// Pure Vanilla ES Module (Three.js r160, 0 DOM dependencies, WebGL2 / ANGLE D3D11 / Mobile safe)
//
// Exports:
//   - applyEldenDissolveToModel(root, progress01, opts?)
//       Injects a 3-scale 3D noise + ridged coal-fissure dissolve shader via `onBeforeCompile`
//       on safely cloned per-corpse materials (leaving shared living-enemy materials untouched!)
//       while preserving USE_SKINNING, normalMap, emissiveMap, `applySoulsRimLight`, and
//       `soulsBossVisuals`. Features a physically-grounded 4-zone smoldering charcoal rim:
//         1) Matte scorched soot band ahead of the burn front
//         2) Cracked dark-crimson smoldering coal bed (ridged multifractal veins)
//         3) Razor-thin blackbody molten ember lip (#ff4500 -> #ffbe42) with crawling micro-cinders
//         4) Darkened hollow charred interior on backfaces (!gl_FrontFacing) — zero blown-out wash!
//   - resetEldenDissolveFromModel(root) / disposeEldenDissolveFromModel(root)
//       Restores original mesh materials & `castShadow` and disposes temporary cloned materials
//       (safe for enemy object pooling — 0 GPU leaks).
//   - isModelEldenDissolving(root)
//       Returns whether `root` currently has active dissolve state attached.
//   - createDissolveAshSystem(scene, { isMobile, lowSpec, maxParticles })
//       Strictly 1-Draw-Call GPU InstancedBufferGeometry Rankine-vortex particle system combining
//       3 distinct sub-species in a single premultiplied dual-mode draw call (0 DC when idle):
//         1) Fine micro-ash dust motes swirling in the rising thermal column
//         2) Jagged tumbling charcoal-crust flakes with cooling ember rims
//         3) Velocity-tangent blackbody sparks (#ffd97d -> #ffbe42 -> #ff4500 -> #7a1202)
//       API: `.emitCorpseAsh(x, y, z, radius, intensity, opts?)`, `.update(dt)`,
//       `.clearAll()`, `.setLowSpec(enabled)`, `.getActiveCount()`, `.getDrawCallCount()`, `.dispose()`.

import * as THREE from '../../vendor/three.module.js';

// ============================================================================
// Constants & Reusable Scratch Objects (Zero Per-Frame Allocations)
// ============================================================================
const DISSOLVE_CACHE_TAG = 'elden_dissolve_v2';
const _tmpOrigin = new THREE.Vector3();
const _tmpWorldScale = new THREE.Vector3();

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
// Next-Gen Smoldering Coal & Ash Filigree 3D Dissolve GLSL Chunks
// (Sin-free mediump-safe hash, unrolled 0-loop FBM -> 0 ANGLE X4000 warnings!)
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

// 3-scale jagged ash-crust + ridged coal-crack erosion field in [0, 1]
vec2 edCoalErosionField( vec3 p ) {
  float nMacro = edValueNoise3( p );
  float nFlake = edValueNoise3( p * 2.47 + vec3( 17.3, 9.1, 23.7 ) );
  float nFine  = edValueNoise3( p * 5.63 + vec3( -11.4, 29.2, 7.8 ) );
  // Sharp ridged coal fissure signal: 1.0 along glowing cracks, 0.0 on dark ash plates
  float ridge = 1.0 - abs( nFine * 2.0 - 1.0 );
  float crack = ridge * ridge;
  float field = nMacro * 0.54 + nFlake * 0.31 + nFine * 0.15;
  return vec2( field, crack );
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

  vec2 edSample = edCoalErosionField( edRel * uEldenNoiseScale );
  float edNoise = edSample.x;
  float edCoalCrack = edSample.y;

  float edField = clamp( edNoise * 0.76 + ( 1.0 - edRadial ) * 0.13 + edHeightNorm * 0.11, 0.0, 1.0 );
  float edCut = uEldenDissolve * 1.08 - 0.04;
  float edDist = edField - edCut;
  if ( edDist < 0.0 ) discard;

  float edW = max( uEldenEdgeWidth, 0.02 );
  float edFadeIn = smoothstep( 0.0, 0.09, uEldenDissolve );

  // 4-Zone Physical Smoldering Coal Rim:
  //   edSootBand : wide matte scorched-charcoal zone ahead of the burn line (kills shiny metal/plastic look)
  //   edCoalBand : cracked cherry-crimson coal bed threaded with glowing fissures
  //   edLipBand  : crisp molten amber-orange crumbling edge (#ff4500 -> #ffbe42)
  //   edCinderLip: razor-thin incandescent micro-cinder sparks right on the vaporizing lip
  float edSootBand  = ( 1.0 - smoothstep( 0.0, edW * 1.95, edDist ) ) * edFadeIn;
  float edCoalBand  = ( 1.0 - smoothstep( 0.0, edW * 0.92, edDist ) ) * edFadeIn;
  float edLipBand   = ( 1.0 - smoothstep( 0.0, edW * 0.40, edDist ) ) * edFadeIn;
  float edCinderLip = ( 1.0 - smoothstep( 0.0, edW * 0.15, edDist ) ) * edFadeIn;

  // Upward-crawling micro-cinder cellular flicker along the crumbling coal edge
  float edSparkGrain = edValueNoise3( edRel * ( uEldenNoiseScale * 6.8 ) + vec3( 0.0, -uEldenTime * 2.4, uEldenTime * 0.7 ) );
  float edCinderDots = smoothstep( 0.46, 0.88, edSparkGrain );
  float edBreath = 0.84 + 0.16 * sin( uEldenTime * 5.6 + edCoalCrack * 6.2831 );

  // Authentic blackbody coal & ember palette in linear RGB (noble contrast, zero neon/white blowout!)
  vec3 edColCherry = vec3( 0.36, 0.014, 0.001 ); // deep smoldering cherry coal
  vec3 edColFlame  = vec3( 0.98, 0.115, 0.008 ); // molten ember orange (#ff4500 linear)
  vec3 edColAmber  = vec3( 1.00, 0.485, 0.052 ); // rich Elden gold (#ffbe42 linear)
  vec3 edColSpark  = vec3( 1.00, 0.800, 0.310 ); // tiny hot white-gold cinder pinpoint

  if ( !gl_FrontFacing ) {
    // Hollow interior of armor/body: dark charred soot with dim smoldering coal veins
    outgoingLight *= 0.09;
    vec3 edInnerCoal = mix( edColCherry, edColFlame, edCoalCrack * 0.75 + edLipBand * 0.45 );
    outgoingLight += edInnerCoal * ( ( edCoalBand * ( 0.35 + 0.65 * edCoalCrack ) + edLipBand * 0.75 ) * edBreath * uEldenEmberIntensity );
  } else {
    // 1. Matte soot charring & grey ash-crust frosting ahead of the burning edge
    float edAshFrost = smoothstep( 0.55, 0.92, edSparkGrain ) * edSootBand * ( 1.0 - edLipBand );
    outgoingLight *= mix( 1.0, 0.12, edSootBand * 0.88 );
    outgoingLight += vec3( 0.032, 0.029, 0.028 ) * edAshFrost;

    // 2. Cracked glowing coal veins + crisp molten amber lip + pinpoint micro-cinders
    float edVeinMask = edCoalBand * ( 0.28 + 0.72 * edCoalCrack );
    vec3 edCoalGlow = mix( edColCherry, edColFlame, clamp( edCoalCrack * 0.72 + edLipBand * 0.55, 0.0, 1.0 ) );
    vec3 edLipGlow  = mix( edColFlame, edColAmber, smoothstep( 0.15, 0.85, edLipBand ) );
    edLipGlow = mix( edLipGlow, edColSpark, edCinderLip * edCinderDots );

    float edGlowEnergy = ( edVeinMask * 0.78 + edLipBand * 1.18 + edCinderLip * edCinderDots * 0.95 ) * edBreath * uEldenEmberIntensity;
    vec3 edFinalEmber = mix( edCoalGlow, edLipGlow, clamp( edLipBand * 1.15, 0.0, 1.0 ) );
    outgoingLight += edFinalEmber * edGlowEnergy;
  }
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

  // DoubleSide reveals the charred hollow interior & smoldering coal veins as armor crumbles
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
  if (root && typeof root.getWorldScale === 'function') {
    root.getWorldScale(_tmpWorldScale);
    const wy = Math.abs(_tmpWorldScale.y || 1);
    // Tripo unit rigs have local height ~0.82m scaled by ~2.15 (mob ~1.8m) or ~5.2 (boss ~3.7m);
    // unscaled root wrappers have wy ~1.0 (height ~1.8m) or ~1.83 (boss ~3.3m).
    if (wy > 3.4) return Math.min(5.2, wy * 0.72);
    if (wy > 1.6 && wy <= 3.4) return 1.85;
    return Math.max(1.1, Math.min(4.5, 1.8 * wy));
  }
  return 1.8;
}

function initCorpseDissolveRecord(root, opts) {
  root.updateWorldMatrix(true, false);
  root.getWorldPosition(_tmpOrigin);

  const height = estimateModelMetricHeight(root, opts);
  const defaultNoiseScale = height > 2.6 ? 4.4 : 6.4;
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
 * Applies smooth 3D-noise Elden Ring smoldering coal & ash dissolution (`progress01`: 0 -> 1)
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

  // Keep current world origin synced while early death collapse settles (p < 0.25)
  if (p < 0.25) {
    root.updateWorldMatrix(true, false);
    root.getWorldPosition(rec.uniforms.uEldenOrigin.value);
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
// 1-Draw-Call GPU Rankine-Vortex Fine Ash, Charcoal Flakes & Cooling Sparks
// ============================================================================
const ASH_VERT_SHADER = /* glsl */ `
uniform float uTime;
uniform float uPixelScale;

attribute vec4 aSpawnPosTime; // xyz = world spawn pos, w = spawnTime
attribute vec4 aVelLife;      // xyz = initial velocity, w = lifetime sec
attribute vec4 aStyle;        // x = base size (m), y = kind [0..1] (<0.34 fine dust, <0.68 flake, >=0.68 spark), z = seed [0..1], w = swirlAmp
attribute vec2 aVortexCenter; // xy = corpse world XZ center for coherent helical Rankine vortex!

varying vec2 vUv;
varying float vAlpha;
varying float vKind;
varying float vLifeT;
varying float vSeed;

vec3 evalVortexWorldPos( float age, float t, float isSpark, float seed, float swirlAmp ) {
  float dragK = isSpark > 0.5 ? 1.25 : 1.75;
  float drag = ( 1.0 - exp( -age * dragK ) ) / dragK;
  float buoyancy = ( isSpark > 0.5 ? 0.52 : 0.24 ) * age * age;

  // Coherent helical Rankine-vortex rotation around the corpse XZ center:
  // inner particles orbit faster, pulling gently inward in the updraft core before dispersing aloft!
  vec2 rel0 = aSpawnPosTime.xz - aVortexCenter.xy;
  float r0 = length( rel0 );
  float spinSign = fract( seed * 13.37 ) > 0.18 ? 1.0 : -1.0;
  float omega = spinSign * ( 1.75 + 0.85 / ( 0.32 + r0 ) ) * ( isSpark > 0.5 ? 1.18 : 0.92 );
  float theta = age * omega * smoothstep( 0.0, 0.18, t );
  float radialPinch = mix( 1.0, 0.62, smoothstep( 0.05, 0.48, t ) ) * mix( 1.0, 1.48, smoothstep( 0.52, 1.0, t ) );

  float ct = cos( theta );
  float st = sin( theta );
  vec2 spunRel = vec2( rel0.x * ct - rel0.y * st, rel0.x * st + rel0.y * ct ) * radialPinch;

  // Secondary micro-turbulence curl eddy
  float eddyFreq = ( isSpark > 0.5 ? 4.4 : 2.6 ) + seed * 2.2;
  float eddyPhase = age * eddyFreq + seed * 6.2831853;
  float eddyEnv = smoothstep( 0.0, 0.25, t ) * ( 1.0 - 0.30 * t );
  vec2 eddy = vec2(
    cos( eddyPhase ) * swirlAmp * eddyEnv,
    sin( eddyPhase * 0.89 + seed * 3.14159 ) * swirlAmp * eddyEnv
  );

  vec3 wp = vec3( 0.0 );
  wp.xz = aVortexCenter.xy + spunRel + aVelLife.xz * drag + eddy;
  wp.y = aSpawnPosTime.y + aVelLife.y * age + buoyancy;
  return wp;
}

void main() {
  vUv = uv;
  float age = uTime - aSpawnPosTime.w;
  float life = max( aVelLife.w, 0.001 );
  float t = age / life;

  if ( age < 0.0 || t >= 1.0 || aStyle.x <= 0.0001 ) {
    vAlpha = 0.0;
    vKind = 0.0;
    vLifeT = 1.0;
    vSeed = 0.0;
    gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );
    return;
  }

  float kind = aStyle.y;
  float isSpark = kind >= 0.68 ? 1.0 : 0.0;
  float seed = aStyle.z;
  float swirlAmp = aStyle.w;

  vec3 worldPos = evalVortexWorldPos( age, t, isSpark, seed, swirlAmp );
  vec4 mvCenter = modelViewMatrix * vec4( worldPos, 1.0 );

  // Size envelope: crisp emergence, gradual burn-down into fine dust
  float popIn = smoothstep( 0.0, 0.09, t );
  float fadeOut = 1.0 - smoothstep( 0.44, 1.0, t );
  float sizeCurve = popIn * mix( 1.0, 0.28, smoothstep( 0.32, 1.0, t ) );
  float baseSize = aStyle.x * sizeCurve * uPixelScale;

  vec2 localPos = position.xy;
  if ( isSpark > 0.5 ) {
    // Align glowing spark streak strictly along its true 3D screen-space helical velocity!
    float dtSample = 0.022;
    vec3 nextWorldPos = evalVortexWorldPos( age + dtSample, min( 1.0, ( age + dtSample ) / life ), isSpark, seed, swirlAmp );
    vec4 mvNext = modelViewMatrix * vec4( nextWorldPos, 1.0 );
    vec2 mvVel = mvNext.xy - mvCenter.xy;
    float velLen = length( mvVel );
    vec2 dir = velLen > 0.0001 ? ( mvVel / velLen ) : vec2( 0.0, 1.0 );
    vec2 perp = vec2( -dir.y, dir.x );
    float streakStretch = clamp( 1.45 + velLen * 18.0, 1.45, 3.25 );
    localPos = perp * ( position.x * baseSize * 0.58 ) + dir * ( position.y * baseSize * streakStretch );
  } else {
    // Tumbling 3D flutter for charcoal flakes & fine ash motes
    float spinSpeed = mix( -4.4, 4.4, fract( seed * 7.13 ) );
    float rot = seed * 6.2831853 + age * spinSpeed;
    float cs = cos( rot );
    float sn = sin( rot );
    float rx = localPos.x * cs - localPos.y * sn;
    float ry = localPos.x * sn + localPos.y * cs;
    float flutter = kind < 0.34
      ? 0.88
      : ( 0.42 + 0.58 * abs( cos( age * ( 3.1 + seed * 3.8 ) + seed * 12.0 ) ) );
    localPos.x = rx * baseSize * ( kind < 0.34 ? 0.95 : 1.18 );
    localPos.y = ry * baseSize * flutter;
  }

  mvCenter.xy += localPos;

  vAlpha = popIn * fadeOut;
  vKind = kind;
  vLifeT = t;
  vSeed = seed;
  gl_Position = projectionMatrix * mvCenter;
}
`;

const ASH_FRAG_SHADER = /* glsl */ `
uniform float uTime;

varying vec2 vUv;
varying float vAlpha;
varying float vKind;
varying float vLifeT;
varying float vSeed;

void main() {
  if ( vAlpha <= 0.002 ) discard;

  vec2 p = vUv * 2.0 - 1.0;
  float r = length( p );
  if ( r >= 1.0 ) discard;

  if ( vKind < 0.34 ) {
    // 1. Fine Micro-Ash Soot & Slate Dust Mote (soft atmospheric speck, NormalBlending)
    float softMask = pow( max( 1.0 - r, 0.0 ), 1.75 );
    if ( softMask <= 0.015 ) discard;

    vec3 sootCol = mix( vec3( 0.16, 0.15, 0.17 ), vec3( 0.44, 0.42, 0.41 ), fract( vSeed * 9.17 ) );
    float warmBirth = ( 1.0 - smoothstep( 0.0, 0.20, vLifeT ) ) * ( 1.0 - r );
    sootCol = mix( sootCol, vec3( 0.78, 0.28, 0.04 ), warmBirth * 0.45 );

    float a = clamp( softMask * vAlpha * 0.68, 0.0, 1.0 );
    gl_FragColor = vec4( sootCol * a, a );
  } else if ( vKind < 0.68 ) {
    // 2. Jagged Tumbling Charcoal-Crust Flake with Smoldering Rim (NormalBlending + glowing coal edge)
    float ang = atan( p.y, p.x );
    float edgeR = 0.66
      + 0.16 * sin( ang * 3.0 + vSeed * 6.2831853 )
      + 0.11 * cos( ang * 5.0 - vSeed * 11.73 )
      + 0.06 * sin( ang * 7.0 + vSeed * 19.41 );
    float mask = 1.0 - smoothstep( edgeR - 0.22, edgeR, r );
    if ( mask <= 0.015 ) discard;

    vec3 darkCrust = vec3( 0.14, 0.13, 0.15 );
    vec3 greyAsh   = vec3( 0.50, 0.48, 0.46 );
    vec3 ashCol = mix( darkCrust, greyAsh, fract( vSeed * 5.37 ) );

    // Smoldering coal rim right along one edge of the freshly-peeled ash flake, cooling as it rises
    float rimBand = smoothstep( edgeR - 0.30, edgeR - 0.04, r );
    float coolCurve = 1.0 - smoothstep( 0.0, 0.44, vLifeT );
    float sideBias = 0.5 + 0.5 * cos( ang - vSeed * 6.2831853 );
    float emberRim = rimBand * coolCurve * ( 0.35 + 0.65 * sideBias );
    vec3 rimCol = mix( vec3( 0.92, 0.18, 0.02 ), vec3( 1.0, 0.62, 0.14 ), emberRim );

    float a = clamp( mask * vAlpha * 0.86, 0.0, 1.0 );
    vec3 premult = ashCol * a + rimCol * ( emberRim * mask * vAlpha * 0.65 );
    gl_FragColor = vec4( premult, a );
  } else {
    // 3. Velocity-Tangent Blackbody Spark (#ffd97d -> #ffbe42 -> #ff4500 -> cooling cherry coal)
    float core = exp( -r * r * 7.8 );
    float halo = pow( max( 1.0 - r, 0.0001 ), 2.6 );
    float flicker = 0.78 + 0.22 * sin( uTime * ( 13.0 + vSeed * 11.0 ) + vSeed * 47.0 );

    vec3 colHot    = vec3( 1.00, 0.90, 0.56 ); // #ffe58f pinpoint birth
    vec3 colGold   = vec3( 1.00, 0.72, 0.22 ); // #ffbe42 golden mid
    vec3 colOrange = vec3( 0.98, 0.27, 0.02 ); // #ff4500 molten orange
    vec3 colCherry = vec3( 0.48, 0.07, 0.01 ); // cooling cherry-red cinder tip

    vec3 emberCol = mix( colHot, colGold, smoothstep( 0.0, 0.28, vLifeT ) );
    emberCol = mix( emberCol, colOrange, smoothstep( 0.28, 0.68, vLifeT ) );
    emberCol = mix( emberCol, colCherry, smoothstep( 0.68, 1.00, vLifeT ) );

    vec3 rgb = emberCol * ( ( core * 1.55 + halo * 0.58 ) * vAlpha * flicker );
    float a = clamp( ( core * 0.12 + halo * 0.03 ) * vAlpha, 0.0, 0.20 );
    gl_FragColor = vec4( rgb, a );
  }
}
`;

/**
 * Creates a strictly 1-draw-call GPU instanced Rankine-vortex particle system of fine ash dust,
 * jagged charcoal flakes, and velocity-tangent blackbody sparks drifting up from dissolving corpses.
 *
 * @param {THREE.Scene|THREE.Object3D|null} scene
 * @param {object} [opts]  `{ isMobile, lowSpec, maxParticles }`
 */
export function createDissolveAshSystem(scene = null, opts = {}) {
  const isMobile = opts?.isMobile !== undefined ? Boolean(opts.isMobile) : detectMobileDevice();
  let lowSpec = Boolean(opts?.lowSpec);

  const defaultMax = lowSpec ? 200 : isMobile ? 440 : 960;
  const maxParticles = Number.isFinite(Number(opts?.maxParticles))
    ? Math.max(32, Math.min(2048, Math.floor(Number(opts.maxParticles))))
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
  const vortexCenterArr = new Float32Array(maxParticles * 2);

  // Initialize all slots expired so nothing renders until emitCorpseAsh() is called
  for (let i = 0; i < maxParticles; i++) {
    spawnPosTimeArr[i * 4 + 3] = -999.0;
    velLifeArr[i * 4 + 3] = 0.01;
    styleArr[i * 4] = 0.0;
  }

  const spawnPosTimeAttr = new THREE.InstancedBufferAttribute(spawnPosTimeArr, 4);
  const velLifeAttr = new THREE.InstancedBufferAttribute(velLifeArr, 4);
  const styleAttr = new THREE.InstancedBufferAttribute(styleArr, 4);
  const vortexCenterAttr = new THREE.InstancedBufferAttribute(vortexCenterArr, 2);
  spawnPosTimeAttr.setUsage(THREE.DynamicDrawUsage);
  velLifeAttr.setUsage(THREE.DynamicDrawUsage);
  styleAttr.setUsage(THREE.DynamicDrawUsage);
  vortexCenterAttr.setUsage(THREE.DynamicDrawUsage);

  instGeo.setAttribute('aSpawnPosTime', spawnPosTimeAttr);
  instGeo.setAttribute('aVelLife', velLifeAttr);
  instGeo.setAttribute('aStyle', styleAttr);
  instGeo.setAttribute('aVortexCenter', vortexCenterAttr);
  instGeo.instanceCount = 0;

  const uniforms = {
    uTime: { value: 0.0 },
    uPixelScale: { value: lowSpec ? 0.90 : 1.0 }
  };

  // Premultiplied dual-mode blending:
  //   - Fine ash & charcoal flakes output (rgb * a + rim, a) -> crisp NormalBlending + coal edge
  //   - Velocity-tangent sparks output (rgb * glow, ~0.06) -> luminous Additive blackbody sparks
  // All 3 sub-species render together inside ONE single draw call (1 DC)!
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

  // Finds an expired slot near writeCursor first so continuous 55ms streams never clip rising vortex tips
  function acquireSlot(slotLimit) {
    for (let probe = 0; probe < 8; probe++) {
      const cand = (writeCursor + probe) % slotLimit;
      const st = spawnPosTimeArr[cand * 4 + 3];
      const lf = velLifeArr[cand * 4 + 3];
      if (elapsedTime >= st + lf) {
        writeCursor = (cand + 1) % slotLimit;
        return cand;
      }
    }
    const idx = writeCursor;
    writeCursor = (writeCursor + 1) % slotLimit;
    return idx;
  }

  function emitCorpseAsh(x, y, z, radius = 0.75, intensity = 1.0, emitOpts = null) {
    if (disposed) return 0;

    const cx = Number.isFinite(Number(x)) ? Number(x) : 0;
    const cy = Number.isFinite(Number(y)) ? Number(y) : 0;
    const cz = Number.isFinite(Number(z)) ? Number(z) : 0;
    const safeR = Number.isFinite(Number(radius)) ? Math.max(0.18, Math.min(6.0, Number(radius))) : 0.75;
    const safeInt = Number.isFinite(Number(intensity)) ? Math.max(0, Number(intensity)) : 1.0;

    const slotLimit = lowSpec ? Math.min(maxParticles, 200) : maxParticles;
    let spawnCount = 0;
    if (emitOpts && Number.isFinite(Number(emitOpts.count))) {
      spawnCount = Math.max(0, Math.min(slotLimit, Math.floor(Number(emitOpts.count))));
    } else {
      // Calibrated for both 55ms periodic combat pulses (intensity ~1.5 -> ~26 fine motes/pulse)
      // and single bursts, filling a tall 960-particle swirling vortex without premature overwrite!
      const baseBurst = lowSpec ? 8 : isMobile ? 14 : 20;
      const raw = safeInt * baseBurst + emitFrac;
      spawnCount = Math.min(slotLimit, Math.floor(raw));
      emitFrac = raw - Math.floor(raw);
    }

    if (spawnCount <= 0) return 0;

    const emberRatio =
      emitOpts && Number.isFinite(Number(emitOpts.emberRatio))
        ? clamp01(emitOpts.emberRatio)
        : 0.36;
    const riseScale =
      emitOpts && Number.isFinite(Number(emitOpts.riseScale))
        ? Math.max(0.25, Number(emitOpts.riseScale))
        : 1.0;
    // Finer, crisper particle grain (+200% detail — fine ash specks + pinpoint cinders, zero big blobs!)
    const sizeScale = Math.max(0.72, Math.min(1.65, 0.72 + safeR * 0.20));

    for (let i = 0; i < spawnCount; i++) {
      const idx = acquireSlot(slotLimit);
      if (idx + 1 > highWaterCount) highWaterCount = idx + 1;

      // Sub-species encoding in [0..1]:
      //   [0.00..0.33] fine micro-ash dust
      //   [0.34..0.67] jagged charcoal-crust flake
      //   [0.68..1.00] velocity-tangent blackbody spark
      const roll = nextRand();
      let kind;
      if (roll < emberRatio) {
        kind = 0.70 + nextRand() * 0.29;
      } else if (nextRand() < 0.48) {
        kind = nextRand() * 0.32;
      } else {
        kind = 0.35 + nextRand() * 0.31;
      }
      const isSpark = kind >= 0.68;
      const isFineDust = kind < 0.34;

      const angle = nextRand() * Math.PI * 2.0;
      const dist = Math.pow(nextRand(), 0.58) * safeR;
      const heightSpread = Math.max(0.20, safeR * 0.52);

      const px = cx + Math.cos(angle) * dist;
      const py = cy + 0.03 + nextRand() * heightSpread;
      const pz = cz + Math.sin(angle) * dist;

      const spawnT = elapsedTime + nextRand() * 0.08;
      const life = isSpark
        ? 0.90 + nextRand() * 0.95
        : isFineDust
          ? 1.45 + nextRand() * 1.15
          : 1.25 + nextRand() * 1.10;

      // Initial tangential + gentle upward velocity feeding smoothly into the Rankine vortex
      const tangSpeed = (0.22 + nextRand() * 0.48) * (isSpark ? 1.25 : 0.85);
      const outSpeed = (0.06 + nextRand() * 0.24) * (isSpark ? 1.10 : 0.65);
      const vx = -Math.sin(angle) * tangSpeed + Math.cos(angle) * outSpeed + (nextRand() - 0.5) * 0.16;
      const vz =  Math.cos(angle) * tangSpeed + Math.sin(angle) * outSpeed + (nextRand() - 0.5) * 0.16;
      const vy = (isSpark ? 0.85 + nextRand() * 1.25 : isFineDust ? 0.48 + nextRand() * 0.72 : 0.42 + nextRand() * 0.68) * riseScale;

      const baseSize = isSpark
        ? (0.018 + nextRand() * 0.022) * sizeScale
        : isFineDust
          ? (0.024 + nextRand() * 0.032) * sizeScale
          : (0.034 + nextRand() * 0.044) * sizeScale;
      const seed = nextRand();
      const swirlAmp = (isSpark ? 0.10 + nextRand() * 0.16 : 0.12 + nextRand() * 0.22) * Math.min(1.5, 0.75 + safeR * 0.25);

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
      styleArr[o + 1] = kind;
      styleArr[o + 2] = seed;
      styleArr[o + 3] = swirlAmp;

      const vo = idx * 2;
      vortexCenterArr[vo]     = cx;
      vortexCenterArr[vo + 1] = cz;

      const expT = spawnT + life;
      if (expT > maxExpireTime) maxExpireTime = expT;
    }

    spawnPosTimeAttr.needsUpdate = true;
    velLifeAttr.needsUpdate = true;
    styleAttr.needsUpdate = true;
    vortexCenterAttr.needsUpdate = true;

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
    uniforms.uPixelScale.value = lowSpec ? 0.90 : 1.0;
    const slotLimit = lowSpec ? Math.min(maxParticles, 200) : maxParticles;
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
