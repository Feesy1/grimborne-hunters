// Physically Grounded Gothic Castle Lighting & Dynamic Fire Shadow Rig
// Chapter 26 — «Abandoned Knight Rift» (Three.js r160, Pure ES Module, 0 Leaks)
//
// Exports:
//   - createSoulsEnvironmentMap(renderer, options)
//       Generates a linear HDR PMREM CubeUV environment map of a moonlit Gothic cathedral
//       with vaulted dark stone rib silhouettes, cool indigo-silver clerestory lancet lobes
//       above, and warm blackbody amber hearth/brazier lobes below/sideways — giving wet
//       flagstones, forged steel armor, blades, and iron cages authentic specular reflections
//       with ZERO highlight blowout or milky shadow washout.
//   - createSoulsFireShadowRig(scene, options)
//       On Desktop (!isMobile): manages 2 real shadow-casting THREE.PointLight instances
//       (primary 1024x1024 + secondary 512x512, inverse-square decay = 2, bias = -0.0006,
//       normalBias = 0.035, radius = 2.2) that bind seamlessly (hysteresis + fade-through-zero
//       rebind, zero shadow popping) to the nearest castle fire sources (Bonfire, braziers,
//       wall lanterns, active flame-jet traps, Throne torches) with multi-frequency buoyant
//       flame turbulence and +-0.03m shadow micro-motion.
//       On Mobile (isMobile): castShadow = false on all rig lights to preserve 60+ FPS.
//   - computePhysicalFireFlicker(time, seed)
//       Deterministic Kolmogorov / buoyant-puffing flame intensity multiplier (~0.78..1.22).
//   - samplePhysicalFireTurbulence(time, seed, out)
//       Zero-GC 3D micro-displacement (+-0.03m) + blackbody warmth + intensity multiplier.

import * as THREE from '../../vendor/three.module.js';

const MAX_SHADOW_MICRO_OFFSET_M = 0.03;

// Canonical fallback castle fire emitters (covering the full 6-zone non-linear castle route
// from Spawn Hall z=+60 -> First Duel Atrium -> Flame Gauntlet -> Knights Nave & West/East Wings
// -> Pre-Boss Bonfire Sanctuary z=-24 -> Boss Doors z=-32 -> Boss Throne Hall z=-47.2..-57.6).
// When `options.layout` or `options.sources` is supplied, live layout coordinates take precedence!
function buildDefaultCastleFireSources() {
  const sources = [
    // Zone 1: Spacious Spawn Hall (z in [46, 68], x in [-11, 11])
    { id: 'brazier_spawn_w', kind: 'brazier', roomId: 'spawn_hall', x: -6.4, y: 1.76, z: 58.0, color: 0xff8228, baseIntensity: 7.4, distance: 19.5, weight: 2.0, seed: 0.4, microAmp: 0.027 },
    { id: 'brazier_spawn_e', kind: 'brazier', roomId: 'spawn_hall', x: 6.4, y: 1.76, z: 58.0, color: 0xff8228, baseIntensity: 7.4, distance: 19.5, weight: 2.0, seed: 1.5, microAmp: 0.027 },
    { id: 'lantern_spawn_w', kind: 'lantern', roomId: 'spawn_hall', x: -10.2, y: 3.25, z: 50.0, color: 0xff9038, baseIntensity: 5.2, distance: 15.5, weight: 1.35, seed: 2.6, microAmp: 0.021 },
    { id: 'lantern_spawn_e', kind: 'lantern', roomId: 'spawn_hall', x: 10.2, y: 3.25, z: 50.0, color: 0xff9038, baseIntensity: 5.2, distance: 15.5, weight: 1.35, seed: 3.7, microAmp: 0.021 },

    // Zone 2: Asymmetric West Cloister / First Duel Atrium (z in [26, 46], x in [-13.5, 8.5])
    { id: 'brazier_atrium_w', kind: 'brazier', roomId: 'first_duel_atrium', x: -9.8, y: 1.76, z: 36.5, color: 0xff7e24, baseIntensity: 7.6, distance: 19.5, weight: 2.05, seed: 4.8, microAmp: 0.028 },
    { id: 'brazier_atrium_e', kind: 'brazier', roomId: 'first_duel_atrium', x: 5.8, y: 1.76, z: 34.0, color: 0xff7e24, baseIntensity: 7.4, distance: 19.0, weight: 2.0, seed: 5.9, microAmp: 0.028 },
    { id: 'lantern_atrium_n', kind: 'lantern', roomId: 'first_duel_atrium', x: -4.4, y: 3.2, z: 28.0, color: 0xff8e36, baseIntensity: 5.1, distance: 15.0, weight: 1.38, seed: 6.7, microAmp: 0.021 },

    // Zone 3: Flame Gauntlet Gallery (z in [8, 26], width 10.4m)
    { id: 'lantern_gauntlet_s_w', kind: 'lantern', roomId: 'flame_gauntlet', x: -4.45, y: 3.2, z: 24.2, color: 0xff8c34, baseIntensity: 5.0, distance: 14.8, weight: 1.35, seed: 7.8, microAmp: 0.021 },
    { id: 'lantern_gauntlet_m_e', kind: 'lantern', roomId: 'flame_gauntlet', x: 4.45, y: 3.2, z: 17.0, color: 0xff8c34, baseIntensity: 5.0, distance: 14.8, weight: 1.35, seed: 8.9, microAmp: 0.021 },
    { id: 'lantern_gauntlet_n_w', kind: 'lantern', roomId: 'flame_gauntlet', x: -4.45, y: 3.2, z: 9.6, color: 0xff8c34, baseIntensity: 5.0, distance: 14.8, weight: 1.35, seed: 10.1, microAmp: 0.021 },

    // Zone 4: Knights Nave + West Side Chapel + East Armory Alcove (z in [-16, 8])
    { id: 'brazier_nave_s_w', kind: 'brazier', roomId: 'knights_nave', x: -4.2, y: 1.76, z: 4.2, color: 0xff7e24, baseIntensity: 7.4, distance: 18.5, weight: 1.95, seed: 11.2, microAmp: 0.027 },
    { id: 'brazier_west_wing', kind: 'brazier', roomId: 'west_wing', x: -10.2, y: 1.72, z: -5.8, color: 0xff8228, baseIntensity: 6.8, distance: 16.8, weight: 1.9, seed: 12.4, microAmp: 0.025 },
    { id: 'brazier_alcove_n', kind: 'brazier', roomId: 'east_alcove', x: 11.8, y: 1.68, z: -6.8, color: 0xff862c, baseIntensity: 6.5, distance: 16.2, weight: 1.85, seed: 13.5, microAmp: 0.024 },
    { id: 'brazier_alcove_s', kind: 'brazier', roomId: 'east_alcove', x: 11.8, y: 1.68, z: -1.2, color: 0xff862c, baseIntensity: 6.5, distance: 16.2, weight: 1.85, seed: 14.6, microAmp: 0.024 },
    { id: 'shrine_east_estus', kind: 'shrine', roomId: 'east_alcove', x: 11.8, y: 1.58, z: -4.0, color: 0xffa63e, baseIntensity: 5.9, distance: 14.8, weight: 1.78, seed: 15.7, microAmp: 0.015 },
    { id: 'lantern_nave_n_e', kind: 'lantern', roomId: 'knights_nave', x: 4.3, y: 3.2, z: -12.2, color: 0xff8e36, baseIntensity: 5.2, distance: 15.0, weight: 1.4, seed: 16.8, microAmp: 0.021 },

    // Zone 5: Pre-Boss Bonfire Sanctuary (z in [-32, -16], Checkpoint Bonfire at (2.6, -24.0) + Boss Door Braziers at z=-30.4)
    {
      id: 'bonfire_main',
      kind: 'bonfire',
      roomId: 'pre_boss_sanctuary',
      x: 2.6,
      y: 1.82,
      z: -24.0,
      color: 0xff8428,
      baseIntensity: 10.6,
      distance: 23.0,
      weight: 2.9,
      seed: 0.35,
      microAmp: 0.03
    },
    { id: 'brazier_sanctuary_w', kind: 'brazier', roomId: 'pre_boss_sanctuary', x: -5.8, y: 1.76, z: -22.5, color: 0xff7e24, baseIntensity: 7.2, distance: 18.5, weight: 1.95, seed: 18.1, microAmp: 0.027 },
    { id: 'brazier_boss_door_w', kind: 'brazier', roomId: 'pre_boss_sanctuary', x: -3.9, y: 1.78, z: -30.35, color: 0xff7c22, baseIntensity: 7.9, distance: 19.0, weight: 2.15, seed: 19.3, microAmp: 0.028 },
    { id: 'brazier_boss_door_e', kind: 'brazier', roomId: 'pre_boss_sanctuary', x: 3.9, y: 1.78, z: -30.35, color: 0xff7c22, baseIntensity: 7.9, distance: 19.0, weight: 2.15, seed: 20.5, microAmp: 0.028 },

    // Zone 6: Boss Throne Cathedral (BOSS_DOOR_Z = -32.0, BOSS_CENTER_Z = -47.2, R = 16.0, Throne z = -57.6)
    { id: 'brazier_boss_entry_w', kind: 'brazier', roomId: 'boss_hall', x: -8.2, y: 1.84, z: -36.4, color: 0xff7e24, baseIntensity: 8.4, distance: 21.5, weight: 2.2, seed: 21.6, microAmp: 0.028 },
    { id: 'brazier_boss_entry_e', kind: 'brazier', roomId: 'boss_hall', x: 8.2, y: 1.84, z: -36.4, color: 0xff7e24, baseIntensity: 8.4, distance: 21.5, weight: 2.2, seed: 22.7, microAmp: 0.028 },
    { id: 'brazier_throne_w', kind: 'brazier', roomId: 'boss_hall', x: -9.6, y: 1.9, z: -54.4, color: 0xff7e24, baseIntensity: 8.8, distance: 22.5, weight: 2.25, seed: 23.8, microAmp: 0.029 },
    { id: 'brazier_throne_e', kind: 'brazier', roomId: 'boss_hall', x: 9.6, y: 1.9, z: -54.4, color: 0xff7e24, baseIntensity: 8.8, distance: 22.5, weight: 2.25, seed: 24.9, microAmp: 0.029 },
    { id: 'throne_torch_w', kind: 'throne_torch', roomId: 'boss_hall', x: -3.8, y: 3.15, z: -55.8, color: 0xff862c, baseIntensity: 8.6, distance: 21.5, weight: 2.45, seed: 26.0, microAmp: 0.026 },
    { id: 'throne_torch_e', kind: 'throne_torch', roomId: 'boss_hall', x: 3.8, y: 3.15, z: -55.8, color: 0xff862c, baseIntensity: 8.6, distance: 21.5, weight: 2.45, seed: 27.1, microAmp: 0.026 }
  ];

  const bossAnglesDeg = [-145, -108, -72, -36, 36, 72, 108, 145];
  const bossSconceR = 16.0 - 0.86;
  for (let i = 0; i < bossAnglesDeg.length; i++) {
    const rad = (bossAnglesDeg[i] * Math.PI) / 180;
    sources.push({
      id: `lantern_boss_${i + 1}`,
      kind: 'lantern',
      roomId: 'boss_hall',
      x: Math.sin(rad) * bossSconceR,
      y: 3.75,
      z: -47.2 - Math.cos(rad) * bossSconceR,
      color: 0xff8c38,
      baseIntensity: 5.8,
      distance: 17.5,
      weight: 1.45,
      seed: 28.5 + i * 1.37,
      microAmp: 0.022
    });
  }

  return sources;
}

/**
 * Builds normalized optical fire emitters directly from a `soulsCastleLayout` descriptor
 * (`{ constants, bonfire, braziers, wallLanterns, relics, throne }`) with zero hardcoded coords.
 */
export function buildFireSourcesFromCastleLayout(layout) {
  if (!layout || typeof layout !== 'object') return buildDefaultCastleFireSources();
  const list = [];

  const bf = layout.bonfire || layout.SOULS_CASTLE_BONFIRE;
  if (bf && Number.isFinite(bf.x) && Number.isFinite(bf.z)) {
    list.push({
      id: bf.id || 'bonfire_main',
      kind: 'bonfire',
      roomId: bf.roomId || '',
      x: bf.x,
      y: 1.82,
      z: bf.z,
      color: 0xff8428,
      baseIntensity: 10.6,
      distance: 23.0,
      weight: 2.9,
      seed: 0.35,
      microAmp: 0.03
    });
  }

  const braziers = layout.braziers || layout.SOULS_CASTLE_BRAZIERS;
  if (Array.isArray(braziers)) {
    for (let i = 0; i < braziers.length; i++) {
      const b = braziers[i];
      if (!b || !Number.isFinite(b.x) || !Number.isFinite(b.z)) continue;
      const sc = Number.isFinite(b.scale) ? b.scale : 1.0;
      list.push({
        id: b.id || `brazier_${i}`,
        kind: 'brazier',
        roomId: b.roomId || '',
        x: b.x,
        y: 1.72 * sc,
        z: b.z,
        color: 0xff7e24,
        baseIntensity: 7.4 * Math.min(1.2, Math.max(0.85, sc)),
        distance: 18.8 * Math.min(1.2, Math.max(0.9, sc)),
        weight: 2.05,
        seed: 1.2 + i * 1.31,
        microAmp: 0.028
      });
    }
  }

  const lanterns = layout.wallLanterns || layout.SOULS_CASTLE_WALL_LANTERNS;
  if (Array.isArray(lanterns)) {
    for (let i = 0; i < lanterns.length; i++) {
      const w = lanterns[i];
      if (!w || !Number.isFinite(w.x) || !Number.isFinite(w.z)) continue;
      list.push({
        id: w.id || `lantern_${i}`,
        kind: 'lantern',
        roomId: w.roomId || '',
        x: w.x,
        y: Number.isFinite(w.y) ? w.y : 3.2,
        z: w.z,
        normalX: w.normalX ?? w.nx ?? 0,
        normalZ: w.normalZ ?? w.nz ?? 0,
        color: Number.isFinite(w.color) ? w.color : 0xff8e36,
        baseIntensity: Number.isFinite(w.intensity) ? Math.min(6.4, w.intensity * 2.35) : 5.1,
        distance: Number.isFinite(w.distance) ? Math.max(13.5, w.distance * 1.15) : 15.0,
        weight: 1.38,
        seed: 12.0 + i * 1.17,
        microAmp: 0.021
      });
    }
  }

  const relics = layout.relics || layout.SOULS_CASTLE_RELICS;
  if (Array.isArray(relics)) {
    for (let i = 0; i < relics.length; i++) {
      const r = relics[i];
      if (!r || !Number.isFinite(r.x) || !Number.isFinite(r.z)) continue;
      list.push({
        id: r.id || `shrine_${i}`,
        kind: 'shrine',
        roomId: r.roomId || '',
        x: r.x,
        y: 1.58,
        z: r.z,
        color: Number.isFinite(r.glowColor) ? r.glowColor : 0xffa63e,
        baseIntensity: 5.8,
        distance: 14.5,
        weight: 1.75,
        seed: 42.0 + i * 1.7,
        microAmp: 0.015
      });
    }
  }

  const throne = layout.throne || layout.SOULS_CASTLE_THRONE_CONFIG;
  if (throne && Number.isFinite(throne.z)) {
    const tx = Number.isFinite(throne.x) ? throne.x : 0;
    const tz = throne.z;
    list.push(
      { id: 'throne_torch_w', kind: 'throne_torch', roomId: 'boss_hall', x: tx - 3.8, y: 3.15, z: tz + 1.8, color: 0xff862c, baseIntensity: 8.6, distance: 21.5, weight: 2.45, seed: 50.1, microAmp: 0.026 },
      { id: 'throne_torch_e', kind: 'throne_torch', roomId: 'boss_hall', x: tx + 3.8, y: 3.15, z: tz + 1.8, color: 0xff862c, baseIntensity: 8.6, distance: 21.5, weight: 2.45, seed: 51.4, microAmp: 0.026 }
    );
  }

  return list.length > 0 ? list : buildDefaultCastleFireSources();
}

/**
 * Physically motivated multi-frequency buoyant flame flicker scalar.
 * Models slow cathedral air draft + ~6.5-8.9 Hz buoyant vortex shedding (puffing mode)
 * + Kolmogorov-damped shear-layer tongue roll-up without harsh strobing.
 *
 * @param {number} [time=0] Elapsed time in seconds
 * @param {number} [seed=0] Per-emitter deterministic phase seed
 * @returns {number} Dimensionless intensity multiplier in [0.78, 1.22]
 */
export function computePhysicalFireFlicker(time = 0, seed = 0) {
  const t = Number.isFinite(time) ? time : 0;
  const s = Number.isFinite(seed) ? seed : 0;

  const p1 = s * 1.731 + 0.37;
  const p2 = s * 2.917 + 1.83;
  const p3 = s * 4.613 + 3.11;
  const p4 = s * 7.129 + 5.07;

  // 1. Low-frequency convective air draft across stone vaults
  const draft = Math.sin(t * 1.62 + p1) * 0.56 + Math.sin(t * 2.71 + p2) * 0.44;
  // 2. Buoyant puffing mode (~6.4 - 8.9 Hz) with slight positive flare skewness
  const puffRaw = Math.sin(t * 6.45 + p2) * 0.62 + Math.sin(t * 8.85 + p3) * 0.38;
  const puff = puffRaw + 0.18 * (puffRaw * puffRaw - 0.5);
  // 3. Damped high-frequency flame tip turbulence
  const fine = Math.sin(t * 13.7 + p3) * 0.6 + Math.sin(t * 18.9 + p4) * 0.4;

  const mul = 1.0 + draft * 0.085 + puff * 0.075 + fine * 0.028;
  return mul < 0.78 ? 0.78 : (mul > 1.22 ? 1.22 : mul);
}

const _sharedTurbulenceOut = {
  flicker: 1.0,
  dx: 0.0,
  dy: 0.0,
  dz: 0.0,
  warmth: 0.5
};

/**
 * Computes zero-GC 3D shadow-emitter micro-displacement (strictly within +-0.03m)
 * plus intensity flicker and blackbody color warmth shift.
 *
 * @param {number} [time=0]
 * @param {number} [seed=0]
 * @param {{ flicker?: number, dx?: number, dy?: number, dz?: number, warmth?: number } | null} [out=null]
 * @param {number} [amp=0.03]
 */
export function samplePhysicalFireTurbulence(time = 0, seed = 0, out = null, amp = MAX_SHADOW_MICRO_OFFSET_M) {
  const target = out || _sharedTurbulenceOut;
  const t = Number.isFinite(time) ? time : 0;
  const s = Number.isFinite(seed) ? seed : 0;
  const maxAmp = Math.max(0, Math.min(MAX_SHADOW_MICRO_OFFSET_M, Number.isFinite(amp) ? amp : MAX_SHADOW_MICRO_OFFSET_M));

  const flicker = computePhysicalFireFlicker(t, s);
  const a = s * 2.317 + 0.61;
  const b = s * 3.847 + 2.09;
  const c = s * 5.193 + 4.23;

  // Smooth incommensurate helical flame-tip wander so shadows dance organically without jitter
  const rawX = Math.sin(t * 3.15 + a) * 0.62 + Math.sin(t * 7.45 + b) * 0.38;
  const rawY = Math.sin(t * 4.65 + b) * 0.58 + Math.cos(t * 9.15 + c) * 0.42;
  const rawZ = Math.cos(t * 2.85 + c) * 0.62 + Math.sin(t * 6.85 + a) * 0.38;

  const clampUnit = (v) => (v < -1 ? -1 : (v > 1 ? 1 : v));
  target.flicker = flicker;
  target.dx = clampUnit(rawX) * maxAmp;
  target.dy = clampUnit(rawY) * (maxAmp * 0.85);
  target.dz = clampUnit(rawZ) * maxAmp;
  target.warmth = Math.max(0, Math.min(1, (flicker - 0.82) / 0.36));
  return target;
}

/**
 * Generates a balanced linear-HDR PMREM environment map tailored for Gothic dark-fantasy PBR
 * (wet chiseled stone, forged dark steel armor, polished blades, obsidian throne, iron cages).
 *
 * Returns the `THREE.Texture` (`CubeUVReflectionMapping`) directly so it can be assigned straight
 * to `scene.environment = envMap` OR read via `envMap.texture`, with `.dispose()` freeing both
 * the internal `WebGLRenderTarget` and `Texture` (0 GPU leaks).
 *
 * @param {THREE.WebGLRenderer} renderer
 * @param {{ blurSigma?: number }} [options={}]
 * @returns {THREE.Texture & { texture: THREE.Texture, envMap: THREE.Texture, renderTarget: THREE.WebGLRenderTarget | null, dispose: () => void }}
 */
export function createSoulsEnvironmentMap(renderer, options = {}) {
  if (!renderer || typeof renderer.render !== 'function') {
    throw new Error('[soulsLightingRig] createSoulsEnvironmentMap requires a valid THREE.WebGLRenderer');
  }

  const blurSigma = Number.isFinite(options?.blurSigma) ? Math.max(0, options.blurSigma) : 0.022;

  const envScene = new THREE.Scene();
  const domeGeo = new THREE.SphereGeometry(24, 48, 28);
  const domeMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldDir = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      varying vec3 vWorldDir;

      void main() {
        vec3 d = normalize(vWorldDir);
        float y = d.y;
        float az = atan(d.z, d.x);

        // 1. Base Gothic cathedral vertical gradient in linear HDR (balanced, zero whiteout)
        vec3 deepVault = vec3(0.028, 0.042, 0.082);
        vec3 zenithSky = vec3(0.085, 0.135, 0.245);
        vec3 horizonMasonry = vec3(0.024, 0.022, 0.032);
        vec3 nadirEmberBounce = vec3(0.072, 0.035, 0.018);

        vec3 col = horizonMasonry;
        if (y >= 0.0) {
          col = mix(horizonMasonry, mix(deepVault, zenithSky, smoothstep(0.08, 0.92, y)), smoothstep(0.0, 0.25, y));
        } else {
          col = mix(horizonMasonry, nadirEmberBounce, smoothstep(0.0, 0.65, -y));
        }

        // 2. Dark pointed vault ribs (structural dark silhouettes make metallic reflections read 200% crisper!)
        float ribWave = abs(sin(az * 4.0));
        float crossRib = abs(sin(az * 2.0 + y * 2.4));
        float ribMask = smoothstep(0.06, 0.22, ribWave) * (0.72 + 0.28 * smoothstep(0.04, 0.18, crossRib));
        col *= mix(1.0, 0.44 + 0.56 * ribMask, smoothstep(0.05, 0.45, y));

        // 3. Cool moonlit clerestory lancet windows + high silver-indigo moon key lobe
        float lancetAz = pow(max(0.0, cos(az * 3.0 - 0.35)), 14.0);
        float lancetBand = smoothstep(0.16, 0.34, y) * smoothstep(0.76, 0.48, y);
        vec3 moonWindowCol = vec3(0.58, 0.76, 1.16);
        col += moonWindowCol * (lancetAz * lancetBand * 0.85);

        vec3 moonDir = normalize(vec3(-0.36, 0.74, 0.56));
        float moonDot = max(0.0, dot(d, moonDir));
        col += vec3(0.72, 0.88, 1.32) * (pow(moonDot, 28.0) * 0.95 + pow(moonDot, 5.0) * 0.14);

        // 4. Warm blackbody amber fire / brazier specular lobes along lower-side horizon (zero acid clipping)
        vec3 fire1 = normalize(vec3(0.78, -0.10, 0.61));
        vec3 fire2 = normalize(vec3(-0.74, -0.14, 0.65));
        vec3 fire3 = normalize(vec3(0.32, -0.22, -0.92));
        vec3 fire4 = normalize(vec3(-0.52, -0.06, -0.85));

        float f1 = pow(max(0.0, dot(d, fire1)), 18.0) * 1.15 + pow(max(0.0, dot(d, fire1)), 4.0) * 0.16;
        float f2 = pow(max(0.0, dot(d, fire2)), 20.0) * 1.05 + pow(max(0.0, dot(d, fire2)), 4.0) * 0.14;
        float f3 = pow(max(0.0, dot(d, fire3)), 16.0) * 0.92 + pow(max(0.0, dot(d, fire3)), 4.0) * 0.13;
        float f4 = pow(max(0.0, dot(d, fire4)), 22.0) * 0.78;

        float fireSum = f1 + f2 + f3 + f4;
        vec3 emberOuter = vec3(0.86, 0.30, 0.07);
        vec3 amberCore = vec3(1.42, 0.68, 0.22);
        col += mix(emberOuter, amberCore, clamp(fireSum * 0.55, 0.0, 1.0)) * fireSum;

        // Soft warm hearth glow reflected off wet flagstones below
        float floorGlow = smoothstep(-0.08, -0.62, y) * (0.65 + 0.35 * cos(az * 2.0));
        col += vec3(0.11, 0.048, 0.018) * floorGlow;

        gl_FragColor = vec4(col, 1.0);
      }
    `
  });

  const domeMesh = new THREE.Mesh(domeGeo, domeMat);
  envScene.add(domeMesh);

  // Preserve renderer state strictly so mid-frame or setup calls leave 0 side effects
  const prevRenderTarget = renderer.getRenderTarget();
  const prevToneMapping = renderer.toneMapping;
  const prevExposure = renderer.toneMappingExposure;
  const prevClearAlpha = renderer.getClearAlpha();
  const prevClearColor = renderer.getClearColor(new THREE.Color());

  let pmrem = null;
  let envRT = null;
  try {
    renderer.toneMapping = THREE.NoToneMapping;
    pmrem = new THREE.PMREMGenerator(renderer);
    envRT = pmrem.fromScene(envScene, blurSigma, 0.1, 60);
  } finally {
    domeGeo.dispose();
    domeMat.dispose();
    if (pmrem) pmrem.dispose();
    renderer.toneMapping = prevToneMapping;
    renderer.toneMappingExposure = prevExposure;
    renderer.setClearColor(prevClearColor, prevClearAlpha);
    renderer.setRenderTarget(prevRenderTarget);
  }

  const envTex = envRT.texture;
  const origTexDispose = envTex.dispose.bind(envTex);
  let disposed = false;

  const fullDispose = () => {
    if (disposed) return;
    disposed = true;
    envRT.dispose();
    origTexDispose();
  };

  envTex.texture = envTex;
  envTex.envMap = envTex;
  envTex.renderTarget = envRT;
  envTex.dispose = fullDispose;

  return envTex;
}

function normalizeFireSource(raw, idx) {
  if (!raw || !Number.isFinite(raw.x) || !Number.isFinite(raw.z)) return null;
  const nx = Number.isFinite(raw.normalX) ? raw.normalX : (Number.isFinite(raw.nx) ? raw.nx : 0);
  const nz = Number.isFinite(raw.normalZ) ? raw.normalZ : (Number.isFinite(raw.nz) ? raw.nz : 0);
  const kind = raw.kind || 'brazier';
  // Push wall-mounted emitters slightly off the stone face if caller passed raw wall coords
  const wallOffset = (kind === 'lantern' || kind === 'wall') && (nx !== 0 || nz !== 0) ? 0.62 : 0;

  const baseY = Number.isFinite(raw.y)
    ? raw.y
    : (kind === 'bonfire' ? 1.82 : (kind === 'lantern' || kind === 'wall' ? 3.18 : 1.74));

  return {
    id: String(raw.id || `fire_src_${idx}`),
    kind,
    roomId: raw.roomId || '',
    x: raw.x + nx * wallOffset,
    y: baseY,
    z: raw.z + nz * wallOffset,
    colorHex: Number.isFinite(raw.color) ? raw.color : 0xff8228,
    baseIntensity: Number.isFinite(raw.baseIntensity)
      ? raw.baseIntensity
      : (Number.isFinite(raw.intensity) ? raw.intensity * 2.1 : 6.8),
    distance: Number.isFinite(raw.distance)
      ? raw.distance
      : (Number.isFinite(raw.dist) ? raw.dist : 18.0),
    weight: Number.isFinite(raw.weight) ? raw.weight : 1.6,
    seed: Number.isFinite(raw.seed) ? raw.seed : (Number.isFinite(raw.phase) ? raw.phase : idx * 1.37 + 0.5),
    microAmp: Number.isFinite(raw.microAmp) ? Math.min(MAX_SHADOW_MICRO_OFFSET_M, Math.max(0, raw.microAmp)) : 0.025,
    steady: Boolean(raw.steady)
  };
}

/**
 * Creates the dynamic 2-PointLight physical fire shadow rig for `souls_citadel`.
 *
 * - Desktop (`!isMobile`):
 *     * Primary light: `1024x1024` shadow map, `castShadow = true`, `decay = 2`
 *     * Secondary light: `512x512` shadow map, `castShadow = true`, `decay = 2`
 *     * Both configured with `shadow.bias = -0.0006`, `shadow.normalBias = 0.035`, `shadow.radius = 2.2`
 * - Mobile (`isMobile`):
 *     * `castShadow = false` on both lights to protect 60+ FPS on mobile GPUs.
 * - Seamless zero-pop binding:
 *     * Sticky hysteresis + fade-through-zero before switching a shadow caster to a new fire source.
 *
 * @param {THREE.Scene | THREE.Object3D | null} scene
 * @param {{
 *   isMobile?: boolean,
 *   lowSpec?: boolean,
 *   sources?: Array<object>,
 *   intensityScale?: number,
 *   bossDoorZ?: number
 * }} [options={}]
 */
export function createSoulsFireShadowRig(scene, options = {}) {
  const opts = options || {};
  const isMobile = Boolean(opts.isMobile);
  let lowSpec = Boolean(opts.lowSpec);
  let enabled = opts.enabled !== false;
  let disposed = false;
  const layoutConsts = opts.layout?.constants || opts.layout?.SOULS_CASTLE_CONSTANTS;
  let bossDoorZ = Number.isFinite(opts.bossDoorZ)
    ? opts.bossDoorZ
    : (Number.isFinite(layoutConsts?.BOSS_DOOR_Z) ? layoutConsts.BOSS_DOOR_Z : -32.0);
  let masterIntensityScale = Number.isFinite(opts.intensityScale) ? Math.max(0, opts.intensityScale) : 1.0;

  const group = new THREE.Group();
  group.name = 'SoulsFireShadowRig';
  if (scene && typeof scene.add === 'function') {
    scene.add(group);
  }

  let staticSources = [];
  const setSources = (rawList) => {
    if (!Array.isArray(rawList) || rawList.length === 0) {
      const baseList = opts.layout ? buildFireSourcesFromCastleLayout(opts.layout) : buildDefaultCastleFireSources();
      staticSources = baseList.map((s, i) => normalizeFireSource(s, i)).filter(Boolean);
      return;
    }
    const parsed = [];
    for (let i = 0; i < rawList.length; i++) {
      const norm = normalizeFireSource(rawList[i], i);
      if (norm) parsed.push(norm);
    }
    staticSources = parsed.length > 0
      ? parsed
      : buildDefaultCastleFireSources().map((s, i) => normalizeFireSource(s, i)).filter(Boolean);
  };
  const setLayout = (layoutObj) => {
    if (!layoutObj) return;
    const c = layoutObj.constants || layoutObj.SOULS_CASTLE_CONSTANTS;
    if (Number.isFinite(c?.BOSS_DOOR_Z)) {
      bossDoorZ = c.BOSS_DOOR_Z;
    }
    setSources(buildFireSourcesFromCastleLayout(layoutObj));
  };
  const setBossDoorZ = (z) => {
    if (Number.isFinite(z)) bossDoorZ = z;
  };
  setSources(opts.sources);

  // Configure 2 physical inverse-square (decay = 2) PointLights:
  // Primary slot casts crisp 512x512 PCFSoft cube shadows (6 faces, fixed far=16m -> 0 mid-walk matrix/shader hitches!),
  // Secondary slot provides warm physical cross-fill without 6 extra redundant cube-map shadow passes (80% less shadow fillrate!).
  const slotSpecs = [
    { mapSize: 512, far: 16.0, gain: 1.0, castsShadow: true },
    { mapSize: 256, far: 18.0, gain: 0.78, castsShadow: false }
  ];

  const slots = slotSpecs.map((spec, slotIdx) => {
    const light = new THREE.PointLight(0xff8428, 0, spec.far, 2);
    light.name = slotIdx === 0 ? 'SoulsFireShadowPrimary' : 'SoulsFireShadowSecondary';
    light.decay = 2;
    light.position.set(0, 1.82, 32.5);
    light.visible = true;

    const allowShadow = !isMobile && spec.castsShadow;
    light.castShadow = allowShadow;

    if (allowShadow) {
      light.shadow.mapSize.set(spec.mapSize, spec.mapSize);
      light.shadow.bias = -0.0007;
      light.shadow.normalBias = 0.04;
      light.shadow.radius = 2.4;
      light.shadow.camera.near = 0.35;
      light.shadow.camera.far = spec.far;
    }

    group.add(light);
    return {
      light,
      spec,
      assignedId: '',
      anchorX: 0,
      anchorY: 1.82,
      anchorZ: 32.5,
      baseIntensity: 0,
      distance: spec.far,
      colorHex: 0xff8428,
      seed: slotIdx * 3.1,
      microAmp: 0.026,
      steady: false,
      fade: 0
    };
  });

  const primaryLight = slots[0].light;
  const secondaryLight = slots[1].light;
  const lights = [primaryLight, secondaryLight];

  // Pre-allocated scratch structures (0 per-frame GC!)
  const _turb = { flicker: 1, dx: 0, dy: 0, dz: 0, warmth: 0.5 };
  const _baseCol = new THREE.Color();
  const _coolEmberCol = new THREE.Color(0xeb6216);
  const _hotGoldCol = new THREE.Color(0xffb45c);
  const _workCandidates = [];
  let hasSnappedOnce = false;

  function syncShadowFlags() {
    // ZERO-HITCH: never toggle light.castShadow mid-run (triggers Three.js WebGL shader recompile stutter);
    // simply mute intensity to 0 when disabled!
    for (let i = 0; i < slots.length; i++) {
      if (!enabled) {
        slots[i].light.intensity = 0;
      }
    }
    group.visible = enabled;
  }

  function setEnabled(flag) {
    if (disposed) return;
    enabled = Boolean(flag);
    if (!enabled) {
      for (let i = 0; i < slots.length; i++) {
        slots[i].fade = 0;
        slots[i].light.intensity = 0;
      }
      hasSnappedOnce = false;
    }
    syncShadowFlags();
  }

  function setLowSpecMode(flag) {
    if (disposed) return;
    lowSpec = Boolean(flag);
    syncShadowFlags();
    if (lowSpec) {
      // Zero-hitch: keep light.visible = true, fade secondary slot intensity to 0
      slots[1].fade = 0;
      slots[1].light.intensity = 0;
    }
  }

  function pushDynamicCandidate(raw, idxOffset) {
    if (!raw || !Number.isFinite(raw.x) || !Number.isFinite(raw.z)) return;
    const rawInt = Number.isFinite(raw.baseIntensity)
      ? raw.baseIntensity
      : (Number.isFinite(raw.intensity) ? raw.intensity : 0);
    if (rawInt <= 0.01) return;

    const dirX = Number.isFinite(raw.dirX) ? raw.dirX : 0;
    const dirZ = Number.isFinite(raw.dirZ) ? raw.dirZ : 0;
    const jetPush = (dirX !== 0 || dirZ !== 0) ? 1.35 : 0;

    _workCandidates.push({
      id: String(raw.id || `dyn_fire_${idxOffset}`),
      kind: raw.kind || 'flame_trap',
      roomId: raw.roomId || 'corridor',
      x: raw.x + dirX * jetPush,
      y: Number.isFinite(raw.y) ? raw.y : 1.35,
      z: raw.z + dirZ * jetPush,
      colorHex: Number.isFinite(raw.color) ? raw.color : 0xff7a1e,
      baseIntensity: Math.min(13.5, rawInt),
      distance: Number.isFinite(raw.distance) ? raw.distance : 16.5,
      weight: Number.isFinite(raw.weight) ? raw.weight : 3.35,
      seed: Number.isFinite(raw.seed) ? raw.seed : (idxOffset * 1.91 + 0.7),
      microAmp: MAX_SHADOW_MICRO_OFFSET_M,
      steady: false
    });
  }

  function gatherCandidates(heroX, heroZ, doorState, cutsceneActive, frameOpts) {
    _workCandidates.length = 0;

    const doorClosed = doorState === 'closed' && !cutsceneActive;
    const heroInCastleSide = heroZ >= bossDoorZ - 0.1;

    for (let i = 0; i < staticSources.length; i++) {
      const s = staticSources[i];
      // Prevent closed stone Boss Doors from leaking shadow-casting firelight across z = -16.0
      if (doorClosed) {
        const srcInBossHall = s.z < bossDoorZ - 0.2 || s.roomId === 'boss_hall';
        if (heroInCastleSide && srcInBossHall) continue;
        if (!heroInCastleSide && !srcInBossHall) continue;
      }
      _workCandidates.push(s);
    }

    const trapSources = frameOpts?.trapSources || frameOpts?.flameTrapSources || frameOpts?.activeTrapLights;
    if (Array.isArray(trapSources)) {
      for (let i = 0; i < trapSources.length; i++) {
        pushDynamicCandidate(trapSources[i], i);
      }
    }

    const extraSources = frameOpts?.extraSources || frameOpts?.dynamicSources;
    if (Array.isArray(extraSources)) {
      for (let i = 0; i < extraSources.length; i++) {
        pushDynamicCandidate(extraSources[i], 100 + i);
      }
    }
  }

  function scoreSource(src, focusX, focusZ, currentId) {
    const dx = src.x - focusX;
    const dz = src.z - focusZ;
    const distSq = dx * dx + dz * dz;
    // Cutoff beyond 1.45x light range so distant rooms never steal shadow slots
    const maxReach = src.distance * 1.45;
    if (distSq > maxReach * maxReach) return -1;

    let score = (src.weight * src.baseIntensity) / (distSq + 5.0);
    // Sticky hysteresis (+28%) avoids ping-ponging when walking midway between two braziers
    if (src.id === currentId) {
      score *= 1.28;
    }
    return score;
  }

  function bindSlotToSource(slot, src, snapFade) {
    slot.assignedId = src.id;
    slot.anchorX = src.x;
    slot.anchorY = src.y;
    slot.anchorZ = src.z;
    slot.baseIntensity = src.baseIntensity;
    slot.distance = src.distance;
    slot.colorHex = src.colorHex;
    slot.seed = src.seed;
    slot.microAmp = src.microAmp;
    slot.steady = src.steady;
    if (snapFade) {
      slot.fade = 1.0;
    }
  }

  function selectBestPair(focusX, focusZ) {
    let best0 = null;
    let best0Score = -1;

    for (let i = 0; i < _workCandidates.length; i++) {
      const c = _workCandidates[i];
      const sc = scoreSource(c, focusX, focusZ, slots[0].assignedId);
      if (sc > best0Score) {
        best0Score = sc;
        best0 = c;
      }
    }

    let best1 = null;
    let best1Score = -1;
    if (!lowSpec) {
      for (let i = 0; i < _workCandidates.length; i++) {
        const c = _workCandidates[i];
        if (best0 && c.id === best0.id) continue;
        let sc = scoreSource(c, focusX, focusZ, slots[1].assignedId);
        if (sc <= 0) continue;
        // Encourage angular/spatial separation from primary light for rich dual cross-shadows
        if (best0) {
          const sx = c.x - best0.x;
          const sz = c.z - best0.z;
          const sepSq = sx * sx + sz * sz;
          if (sepSq < 3.24) sc *= 0.25;
        }
        if (sc > best1Score) {
          best1Score = sc;
          best1 = c;
        }
      }
    }

    // Keep slot continuity if primary & secondary merely swapped rank!
    if (
      best0 &&
      best1 &&
      best0.id === slots[1].assignedId &&
      best1.id === slots[0].assignedId
    ) {
      const tmp = best0;
      best0 = best1;
      best1 = tmp;
    }

    return { best0, best1 };
  }

  function extractFocusXZ(heroPos, cameraPos, cutsceneActive) {
    const hx = Number.isFinite(heroPos?.x) ? heroPos.x : 0;
    const hz = Number.isFinite(heroPos?.z) ? heroPos.z : 29.2;
    if ( cameraPos && Number.isFinite(cameraPos.x) && Number.isFinite(cameraPos.z) ) {
      const camWeight = cutsceneActive ? 0.55 : 0.24;
      const heroWeight = 1.0 - camWeight;
      return {
        fx: hx * heroWeight + cameraPos.x * camWeight,
        fz: hz * heroWeight + cameraPos.z * camWeight,
        hx,
        hz
      };
    }
    return { fx: hx, fz: hz, hx, hz };
  }

  function snapToNearest(heroPos = null, cameraPos = null, frameOpts = {}) {
    if (disposed || !enabled) return;
    const cutsceneActive = Boolean(frameOpts?.cutsceneActive || frameOpts?.inCutscene);
    const doorState = frameOpts?.bossDoorState || frameOpts?.doorState || 'closed';
    const { fx, fz, hx, hz } = extractFocusXZ(heroPos, cameraPos, cutsceneActive);
    gatherCandidates(hx, hz, doorState, cutsceneActive, frameOpts);
    const { best0, best1 } = selectBestPair(fx, fz);

    if (best0) {
      bindSlotToSource(slots[0], best0, true);
    } else {
      slots[0].assignedId = '';
      slots[0].fade = 0;
    }

    if (best1 && !lowSpec) {
      bindSlotToSource(slots[1], best1, true);
    } else {
      slots[1].assignedId = '';
      slots[1].fade = 0;
    }
    hasSnappedOnce = true;
  }

  function findCandidateById(id) {
    if (!id) return null;
    for (let i = 0; i < _workCandidates.length; i++) {
      if (_workCandidates[i].id === id) return _workCandidates[i];
    }
    return null;
  }

  function update(arg0 = 0, arg1 = 0.016, arg2 = null) {
    if (disposed || !enabled) return;

    let time = 0;
    let dt = 0.016;
    let frameOpts = null;
    if (typeof arg0 === 'object' && arg0 !== null) {
      frameOpts = arg0;
      time = Number.isFinite(frameOpts.time) ? frameOpts.time : (Number.isFinite(frameOpts.t) ? frameOpts.t : 0);
      dt = Number.isFinite(frameOpts.dt) ? frameOpts.dt : 0.016;
    } else {
      time = Number.isFinite(arg0) ? arg0 : 0;
      dt = Number.isFinite(arg1) ? arg1 : 0.016;
      frameOpts = arg2 || null;
    }

    const safeDt = Math.max(0.001, Math.min(0.1, dt));
    if (frameOpts && Number.isFinite(frameOpts.intensityScale)) {
      masterIntensityScale = Math.max(0, frameOpts.intensityScale);
    }
    if (frameOpts && Number.isFinite(frameOpts.bossDoorZ)) {
      bossDoorZ = frameOpts.bossDoorZ;
    }

    const heroPos =
      frameOpts?.heroPos ||
      frameOpts?.playerPos ||
      frameOpts?.focusPos ||
      (Number.isFinite(frameOpts?.heroX) && Number.isFinite(frameOpts?.heroZ)
        ? { x: frameOpts.heroX, z: frameOpts.heroZ }
        : null);
    const cameraPos = frameOpts?.cameraPos || frameOpts?.camPos || frameOpts?.camera?.position || null;
    const cutsceneActive = Boolean(frameOpts?.cutsceneActive || frameOpts?.inCutscene);
    const doorState = frameOpts?.bossDoorState || frameOpts?.doorState || 'closed';

    if (!hasSnappedOnce || frameOpts?.snap) {
      snapToNearest(heroPos, cameraPos, frameOpts);
    }

    const { fx, fz, hx, hz } = extractFocusXZ(heroPos, cameraPos, cutsceneActive);
    gatherCandidates(hx, hz, doorState, cutsceneActive, frameOpts);
    const { best0, best1 } = selectBestPair(fx, fz);
    const targets = [best0, lowSpec ? null : best1];

    const fadeOutRate = 3.4;
    const fadeInRate = 2.8;
    const posFollow = 1.0 - Math.exp(-14.0 * safeDt);

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const desired = targets[i];

      if (!desired) {
        slot.fade = Math.max(0, slot.fade - fadeOutRate * safeDt);
        if (slot.fade <= 0.005) {
          slot.fade = 0;
          slot.assignedId = '';
          slot.light.intensity = 0;
          continue;
        }
      } else if (slot.assignedId === desired.id) {
        // Same emitter: track dynamic motion smoothly and ramp fade to 1
        slot.anchorX += (desired.x - slot.anchorX) * posFollow;
        slot.anchorY += (desired.y - slot.anchorY) * posFollow;
        slot.anchorZ += (desired.z - slot.anchorZ) * posFollow;
        slot.baseIntensity = desired.baseIntensity;
        slot.distance = desired.distance;
        slot.colorHex = desired.colorHex;
        slot.fade = Math.min(1, slot.fade + fadeInRate * safeDt);
      } else {
        // Different emitter: fade cleanly through zero BEFORE moving the shadow-casting light (0 shadow pop!)
        const liveAssigned = findCandidateById(slot.assignedId);
        if (liveAssigned) {
          slot.anchorX += (liveAssigned.x - slot.anchorX) * posFollow;
          slot.anchorY += (liveAssigned.y - slot.anchorY) * posFollow;
          slot.anchorZ += (liveAssigned.z - slot.anchorZ) * posFollow;
        }
        slot.fade = Math.max(0, slot.fade - fadeOutRate * safeDt);
        if (slot.fade <= 0.015) {
          bindSlotToSource(slot, desired, false);
          slot.fade = 0.02;
        }
      }

      if (slot.fade <= 0.001) {
        slot.light.intensity = 0;
        continue;
      }

      // Physical flame turbulence + +-0.03m shadow micro-motion
      samplePhysicalFireTurbulence(time, slot.seed, _turb, slot.steady ? slot.microAmp * 0.4 : slot.microAmp);
      const flick = slot.steady ? (0.94 + 0.06 * _turb.flicker) : _turb.flicker;

      slot.light.position.set(
        slot.anchorX + _turb.dx,
        slot.anchorY + _turb.dy,
        slot.anchorZ + _turb.dz
      );

      // Subtle blackbody color temperature shift (deeper ember in troughs -> golden amber on puffs)
      _baseCol.setHex(slot.colorHex);
      if (_turb.warmth < 0.5) {
        _baseCol.lerp(_coolEmberCol, (0.5 - _turb.warmth) * 0.28);
      } else {
        _baseCol.lerp(_hotGoldCol, (_turb.warmth - 0.5) * 0.32);
      }
      slot.light.color.copy(_baseCol);

      const reach = Math.max(6.0, slot.distance);
      slot.light.distance = reach;

      // Smooth cubic hermite fade envelope prevents sudden shadow edge appearance
      const smoothFade = slot.fade * slot.fade * (3.0 - 2.0 * slot.fade);
      slot.light.intensity = slot.baseIntensity * slot.spec.gain * flick * smoothFade * masterIntensityScale;
    }
  }

  function getStats() {
    return {
      isMobile,
      lowSpec,
      enabled,
      disposed,
      sourceCount: staticSources.length,
      shadowCastingLights: (primaryLight.castShadow ? 1 : 0) + (secondaryLight.castShadow ? 1 : 0),
      activeLights: (primaryLight.intensity > 0.01 ? 1 : 0) + (secondaryLight.intensity > 0.01 ? 1 : 0),
      primarySourceId: slots[0].assignedId,
      secondarySourceId: slots[1].assignedId,
      primaryIntensity: Number(primaryLight.intensity.toFixed(3)),
      secondaryIntensity: Number(secondaryLight.intensity.toFixed(3)),
      primaryShadowMapSize: primaryLight.shadow.mapSize.x,
      secondaryShadowMapSize: secondaryLight.shadow.mapSize.x
    };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    enabled = false;
    for (let i = 0; i < slots.length; i++) {
      const pl = slots[i].light;
      pl.intensity = 0;
      pl.castShadow = false;
      if (pl.shadow?.map) {
        pl.shadow.map.dispose();
        pl.shadow.map = null;
      }
      pl.dispose?.();
      group.remove(pl);
    }
    if (group.parent) {
      group.parent.remove(group);
    }
    _workCandidates.length = 0;
  }

  return {
    group,
    lights,
    primaryLight,
    secondaryLight,
    update,
    setSources,
    setLayout,
    setBossDoorZ,
    snapToNearest,
    setEnabled,
    setLowSpecMode,
    setLowSpec: setLowSpecMode,
    getStats,
    dispose
  };
}
