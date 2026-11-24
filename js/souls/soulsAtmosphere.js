// Cinematic Castle Atmosphere, Physical Light-Scattering & Depth VFX for Chapter 26 — «Abandoned Knight Rift»
// Wave 2 Next-Gen Light Physics Edition (100% data-driven over js/souls/soulsCastleLayout.js — supports both
// classic 4-hall and 6-zone non-linear castle layouts with zero hardcoded room names or Z coordinates!).
// Pure Vanilla ES module (Three.js r160, 0 DOM dependency, 0 ANGLE X4000 warnings, V8/Browser/Mobile safe).
//
// Draw-Call Budget (strictly <= 5 DC PC / <= 3 DC Mobile / <= 2 DC LowSpec!):
//   - PC (5 DC):
//       1. staticContactAoMesh  (1 DC) — Deep multi-scale analytical Contact AO under pillars, braziers, bonfire,
//                                        shrine, armory props, throne/dais, portal jambs & perimeter wall crevices
//       2. firelightScatterMesh (1 DC) — True 3D inverse-square stone light-pools + Blinn-Phong wet-stone glints
//                                        on walls & floors + delicate Mie/Tyndall lantern halos (opacity <= 0.185!)
//       3. groundMistMesh       (1 DC) — 3-layer drifting dark-indigo FBM ground mist (y = 0.10..0.50, 3 octaves)
//       4. godRayMesh           (1 DC) — Slender focused Gothic moonlit shafts w/ Fresnel fade & lit internal dust
//       5. dustMotesPoints      (1 DC) — 120 GPU cathedral dust motes (brighter inside moonbeam shafts)
//   - Mobile (3 DC):
//       1. mobileFloorMesh      (1 DC) — Merged NormalBlending batch: Deep Contact AO + 2-layer 2-octave FBM Mist
//       2. mobileLightBatchMesh (1 DC) — Merged AdditiveBlending batch: Slender God-Rays + Inverse-Square Stone
//                                        Light-Pools + Delicate Lantern Halos (opacity <= 0.175!)
//       3. dustMotesPoints      (1 DC) — 55 GPU cathedral dust motes evenly interleaved across all chambers
//   - LowSpec (2 DC):
//       - Dust motes = 0, Ground Mist = OFF, Firelight Scatter/Halos = OFF; Deep Contact AO (1 DC) +
//         simplified 0-noise Moonlit God-Rays (1 DC) remain active.
//
// Plus exported `createActorContactShadowMesh(optionsOrRadius)` for `models.js` (Hero, Mobs, Boss)
// with ref-counted shared unit geometry & deep dual-zone procedural DataTexture (0 WebGL leaks!).

import * as THREE from '../../vendor/three.module.js';
import { mergeGeometries } from '../../vendor/BufferGeometryUtils.js';
import * as CASTLE_LAYOUT from './soulsCastleLayout.js?v=20261124z90';

const DUST_COUNT_PC = 120;
const DUST_COUNT_MOBILE = 55;
const DUST_COUNT_LOWSPEC = 0;

// Strict optical ceiling for lantern/brazier atmospheric halos (guaranteed <= 0.20, zero milky washout!)
const MAX_HALO_OPACITY_WALL = 0.145;
const MAX_HALO_OPACITY_BRAZIER = 0.168;
const HARD_HALO_ALPHA_CAP = 0.188;

// ============================================================================
// Internal Deterministic Helpers & Live Layout Resolvers
// ============================================================================
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

function getSafePixelRatio() {
  if (typeof window === 'undefined') return 1.0;
  return Math.min(Math.max(window.devicePixelRatio || 1, 1), 1.5);
}

function makeRng(seedInit) {
  let s = seedInit >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function resolveYawFromNormal(spec) {
  if (Number.isFinite(spec?.rotY)) return spec.rotY;
  if (Number.isFinite(spec?.facing)) return spec.facing;
  if (Number.isFinite(spec?.normalX) || Number.isFinite(spec?.normalZ)) {
    return Math.atan2(spec.normalX || 0, spec.normalZ || 0);
  }
  if (Number.isFinite(spec?.nx) || Number.isFinite(spec?.nz)) {
    return Math.atan2(spec.nx || 0, spec.nz || 0);
  }
  return 0;
}

function toNonIndexedClean(rawGeo, keepUv = true, keepNormal = true) {
  const g = rawGeo.index ? rawGeo.toNonIndexed() : rawGeo.clone();
  rawGeo.dispose();
  for (const attrName of Object.keys(g.attributes)) {
    if (
      attrName !== 'position' &&
      (!keepNormal || attrName !== 'normal') &&
      (!keepUv || attrName !== 'uv')
    ) {
      g.deleteAttribute(attrName);
    }
  }
  if (keepNormal && !g.attributes.normal) {
    g.computeVertexNormals();
  }
  if (keepUv && !g.attributes.uv) {
    const count = g.attributes.position.count;
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  return g;
}

function normalizeRaySpecs(customSpecs) {
  const defaultShafts = CASTLE_LAYOUT.SOULS_CASTLE_CLERESTORY_SHAFTS || [];
  const src = Array.isArray(customSpecs) && customSpecs.length > 0
    ? customSpecs
    : defaultShafts;
  const out = [];
  for (let i = 0; i < src.length; i++) {
    const s = src[i];
    if (!s) continue;
    const ox = Array.isArray(s.origin) ? s.origin[0] : (s.windowX ?? s.x ?? 0);
    const oy = Array.isArray(s.origin) ? s.origin[1] : (s.windowY ?? s.y ?? 8.0);
    const oz = Array.isArray(s.origin) ? s.origin[2] : (s.windowZ ?? s.z ?? 0);
    const tx = Array.isArray(s.target) ? s.target[0] : (s.targetX ?? ox + 4.5);
    const ty = Array.isArray(s.target) ? s.target[1] : (s.targetY ?? 0.02);
    const tz = Array.isArray(s.target) ? s.target[2] : (s.targetZ ?? oz + 1.0);
    out.push(
      Object.freeze({
        id: s.id || `ray_${i}`,
        roomId: s.roomId || 'courtyard',
        origin: Object.freeze([ox, oy, oz]),
        target: Object.freeze([tx, ty, tz]),
        topRadius: Number.isFinite(s.topRadius) ? s.topRadius : 0.75,
        bottomRadius: Number.isFinite(s.bottomRadius) ? s.bottomRadius : 2.35,
        color: Number.isFinite(s.color) ? s.color : 0x8cb8ff,
        intensity: Number.isFinite(s.intensity)
          ? s.intensity
          : (Number.isFinite(s.opacity) ? Math.min(1.28, Math.max(0.75, s.opacity / 0.135)) : 1.0)
      })
    );
  }
  return Object.freeze(out);
}

// Canonical Volumetric Moonlit God-Ray Shafts synced 1:1 with SOULS_CASTLE_CLERESTORY_SHAFTS
export const CASTLE_GOD_RAY_SPECS = normalizeRaySpecs(CASTLE_LAYOUT.SOULS_CASTLE_CLERESTORY_SHAFTS);

// ============================================================================
// 1. Slender Volumetric Moonlit God-Ray Shafts w/ Illuminated Dust (1 DC PC)
//    Uses unified attribute layout (`aScatterMeta`, `aScatterOptics`, `aFlamePos`,
//    `aScatterColor`) when `unifiedMobileSchema === true` so Mobile merges
//    God-Rays + Stone Light-Pools + Delicate Halos into 1 single Draw Call!
// ============================================================================
function buildGodRayShaftParts(raySpecs, isMobile, unifiedMobileSchema = false) {
  const parts = [];
  const radialSegsOuter = isMobile ? 12 : 20;
  const radialSegsInner = isMobile ? 10 : 16;
  const heightSegs = isMobile ? 2 : 4;

  const upVec = new THREE.Vector3(0, 1, 0);
  const vOrigin = new THREE.Vector3();
  const vTarget = new THREE.Vector3();
  const vAxisUp = new THREE.Vector3();
  const vMid = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const unitScale = new THREE.Vector3(1, 1, 1);
  const xform = new THREE.Matrix4();
  const colTmp = new THREE.Color();

  for (let i = 0; i < raySpecs.length; i++) {
    const spec = raySpecs[i];
    vOrigin.set(spec.origin[0], spec.origin[1], spec.origin[2]);
    vTarget.set(spec.target[0], spec.target[1], spec.target[2]);
    vAxisUp.subVectors(vOrigin, vTarget);
    const len = vAxisUp.length();
    if (len < 0.5) continue;
    vAxisUp.multiplyScalar(1 / len);
    quat.setFromUnitVectors(upVec, vAxisUp);
    vMid.addVectors(vOrigin, vTarget).multiplyScalar(0.5);
    xform.compose(vMid, quat, unitScale);

    colTmp.setHex(spec.color);
    const intensityScale = spec.intensity;
    const phase = (i * 1.6180339 + 0.37) * Math.PI;

    // Slender, refined Gothic shafts (~26% tighter than Wave 1 — crisp lunar pencil-beams, zero white washout!):
    //   Shell 0 = subtle outer Tyndall atmospheric scatter veil
    //   Shell 1 = slender defined lunar beam core with illuminated drifting dust
    const shells = [
      { rMulTop: 0.90, rMulBot: 0.96, coreFlag: 0.0, segs: radialSegsOuter },
      { rMulTop: 0.46, rMulBot: 0.50, coreFlag: 1.0, segs: radialSegsInner }
    ];

    for (let sIdx = 0; sIdx < shells.length; sIdx++) {
      const sh = shells[sIdx];
      const raw = new THREE.CylinderGeometry(
        spec.topRadius * sh.rMulTop,
        spec.bottomRadius * sh.rMulBot,
        len,
        sh.segs,
        heightSegs,
        true
      );
      const g = toNonIndexedClean(raw, true, true);
      const pos = g.attributes.position;
      const uv = g.attributes.uv;
      const count = pos.count;

      const shaftColor = new Float32Array(count * 3);
      if (unifiedMobileSchema) {
        const meta = new Float32Array(count * 4);
        const optics = new Float32Array(count * 4);
        const flamePos = new Float32Array(count * 3);
        for (let v = 0; v < count; v++) {
          const lx = pos.getX(v);
          const lz = pos.getZ(v);
          const angle = Math.atan2(lz, lx);
          const along = clamp01(1.0 - uv.getY(v));

          const o4 = v * 4;
          meta[o4] = along;
          meta[o4 + 1] = sh.coreFlag;
          meta[o4 + 2] = phase;
          meta[o4 + 3] = 3.0; // kind = 3.0 (God-Ray Shaft)

          optics[o4] = angle;
          optics[o4 + 1] = 0.0;
          optics[o4 + 2] = 0.0;
          optics[o4 + 3] = 0.0;

          const o3 = v * 3;
          flamePos[o3] = spec.origin[0];
          flamePos[o3 + 1] = spec.origin[1];
          flamePos[o3 + 2] = spec.origin[2];

          shaftColor[o3] = colTmp.r * intensityScale;
          shaftColor[o3 + 1] = colTmp.g * intensityScale;
          shaftColor[o3 + 2] = colTmp.b * intensityScale;
        }
        g.applyMatrix4(xform);
        g.deleteAttribute('uv');
        g.setAttribute('aScatterMeta', new THREE.BufferAttribute(meta, 4));
        g.setAttribute('aScatterOptics', new THREE.BufferAttribute(optics, 4));
        g.setAttribute('aFlamePos', new THREE.BufferAttribute(flamePos, 3));
        g.setAttribute('aScatterColor', new THREE.BufferAttribute(shaftColor, 3));
      } else {
        const shaftInfo = new Float32Array(count * 4);
        for (let v = 0; v < count; v++) {
          const lx = pos.getX(v);
          const lz = pos.getZ(v);
          const angle = Math.atan2(lz, lx);
          const along = clamp01(1.0 - uv.getY(v));

          const o4 = v * 4;
          shaftInfo[o4] = along;
          shaftInfo[o4 + 1] = sh.coreFlag;
          shaftInfo[o4 + 2] = phase;
          shaftInfo[o4 + 3] = angle;

          const o3 = v * 3;
          shaftColor[o3] = colTmp.r * intensityScale;
          shaftColor[o3 + 1] = colTmp.g * intensityScale;
          shaftColor[o3 + 2] = colTmp.b * intensityScale;
        }
        g.applyMatrix4(xform);
        g.deleteAttribute('uv');
        g.setAttribute('aShaftInfo', new THREE.BufferAttribute(shaftInfo, 4));
        g.setAttribute('aShaftColor', new THREE.BufferAttribute(shaftColor, 3));
      }
      parts.push(g);
    }
  }

  return parts;
}

// Shared GLSL evaluation for Slender Moonlit God-Ray Shafts w/ Illuminated Dust (0 discard, 0 X4000!)
const GOD_RAY_EVAL_GLSL = `
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float ndotv = max(dot(N, V), 0.0);
  float fresnelExp = mix(2.35, 1.62, coreFlag);
  float fresnel = pow(max(ndotv, 1e-4), fresnelExp) * smoothstep(0.0, 0.045, ndotv);

  float topSoft = smoothstep(0.0, 0.12, along);
  float lengthFalloff = pow(max(1.0 - along, 1e-4), 0.96) * smoothstep(1.0, 0.70, along);
  float floorFade = smoothstep(0.05, 1.12, vWorldPos.y);

  float nearFade = smoothstep(1.20, 4.00, vViewDist);
  float farFade = smoothstep(115.0, 36.0, vViewDist);

  // Delicate stained-glass lancet mullion filaments + illuminated airborne micro-dust glints inside beam
  float mullion = 0.78 + 0.16 * sin(angle * 4.0 + phase * 1.7) + 0.06 * sin(angle * 9.0 - phase * 0.9);
  float shimmer = 1.0;
  float litDustBoost = 0.0;
  if (uLowSpec < 0.5) {
    vec2 uvA = vec2(angle * 1.35 + uTime * 0.045 + phase, along * 4.2 - uTime * 0.13);
    vec2 uvB = vec2(vWorldPos.x * 0.42 - uTime * 0.065, vWorldPos.y * 0.52 + vWorldPos.z * 0.30 - uTime * 0.095);
    float n1 = vnoise(uvA);
    float n2 = vnoise(uvB);
    float dustVeil = 0.74 + (n1 * 0.58 + n2 * 0.42) * 0.48;
    // Fine illuminated dust motes catching cold moonlight strictly inside the shaft core
    float moteLattice1 = vnoise(uvB * 3.6 + vec2(uTime * 0.16, -uTime * 0.21));
    float moteLattice2 = vnoise(uvA * 4.4 - vec2(uTime * 0.11, uTime * 0.18));
    litDustBoost = smoothstep(0.73, 0.98, moteLattice1 * 0.55 + moteLattice2 * 0.45) * 0.42 * coreFlag * fresnel;
    shimmer = dustVeil + litDustBoost;
  }

  vec3 silverTop = mix(rayColor, vec3(0.86, 0.94, 1.0), 0.38);
  vec3 deepBottom = rayColor * vec3(0.82, 0.91, 1.06);
  vec3 beamCol = mix(silverTop, deepBottom, smoothstep(0.08, 0.85, along));
  beamCol = mix(beamCol, vec3(0.95, 0.97, 1.0), clamp(litDustBoost * 0.85, 0.0, 0.45));

  float layerGain = mix(0.068, 0.148, coreFlag);
  float rayAlpha = clamp(
    layerGain * fresnel * topSoft * lengthFalloff * floorFade * nearFade * farFade * mullion * shimmer * uGodRayIntensity,
    0.0,
    0.30
  );
`;

function createDedicatedGodRayMaterial(lowSpec) {
  const uniforms = {
    uTime: { value: 0 },
    uGodRayIntensity: { value: 1.0 },
    uLowSpec: { value: lowSpec ? 1.0 : 0.0 }
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    fog: false,
    vertexShader: `
      attribute vec4 aShaftInfo;
      attribute vec3 aShaftColor;

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec4 vShaftInfo;
      varying vec3 vShaftColor;
      varying float vViewDist;

      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vShaftInfo = aShaftInfo;
        vShaftColor = aShaftColor;
        vec4 mvPos = viewMatrix * worldPos;
        vViewDist = -mvPos.z;
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uGodRayIntensity;
      uniform float uLowSpec;

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec4 vShaftInfo;
      varying vec3 vShaftColor;
      varying float vViewDist;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      void main() {
        float along = vShaftInfo.x;
        float coreFlag = vShaftInfo.y;
        float phase = vShaftInfo.z;
        float angle = vShaftInfo.w;
        vec3 rayColor = vShaftColor;

        ${GOD_RAY_EVAL_GLSL}

        gl_FragColor = vec4(beamCol, rayAlpha);
      }
    `
  });

  return { material, uniforms };
}

// ============================================================================
// 2. Physical Inverse-Square Stone Light-Pools & Delicate Volumetric Halos
//    - True 3D inverse-square irradiance `N·L / (h^2 + r^2)` + Blinn-Phong
//      wet-stone facet glints on castle walls & flagstones (ZERO sharp circles!)
//    - Delicate Mie/Tyndall atmospheric lantern & brazier halos (`opacity <= 0.185!`)
// ============================================================================
function appendWorldPoolQuad(parts, {
  cx,
  cy,
  cz,
  halfW,
  halfH,
  isWall,
  rotY = 0,
  nx = 0,
  ny = 1,
  nz = 0,
  flameX,
  flameY,
  flameZ,
  hRef,
  innerOccludeNorm,
  peakStrength,
  phase,
  colorHex
}) {
  const raw = new THREE.PlaneGeometry(halfW * 2, halfH * 2, 1, 1);
  if (isWall) {
    if (rotY !== 0) raw.rotateY(rotY);
  } else {
    raw.rotateX(-Math.PI / 2);
  }
  raw.translate(cx, cy, cz);

  const g = toNonIndexedClean(raw, true, false);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  const count = pos.count;

  const normals = new Float32Array(count * 3);
  const meta = new Float32Array(count * 4);
  const optics = new Float32Array(count * 4);
  const flamePos = new Float32Array(count * 3);
  const colorArr = new Float32Array(count * 3);

  const col = new THREE.Color(colorHex);
  const kindVal = isWall ? 1.0 : 0.0;

  for (let v = 0; v < count; v++) {
    const o3 = v * 3;
    normals[o3] = nx;
    normals[o3 + 1] = ny;
    normals[o3 + 2] = nz;

    flamePos[o3] = flameX;
    flamePos[o3 + 1] = flameY;
    flamePos[o3 + 2] = flameZ;

    colorArr[o3] = col.r;
    colorArr[o3 + 1] = col.g;
    colorArr[o3 + 2] = col.b;

    const o4 = v * 4;
    meta[o4] = uv.getX(v) * 2.0 - 1.0;
    meta[o4 + 1] = uv.getY(v) * 2.0 - 1.0;
    meta[o4 + 2] = phase;
    meta[o4 + 3] = kindVal;

    optics[o4] = hRef;
    optics[o4 + 1] = innerOccludeNorm;
    optics[o4 + 2] = peakStrength;
    optics[o4 + 3] = isWall ? 0.55 : 1.0; // wet-stone glint weight
  }

  g.deleteAttribute('uv');
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  g.setAttribute('aScatterMeta', new THREE.BufferAttribute(meta, 4));
  g.setAttribute('aScatterOptics', new THREE.BufferAttribute(optics, 4));
  g.setAttribute('aFlamePos', new THREE.BufferAttribute(flamePos, 3));
  g.setAttribute('aScatterColor', new THREE.BufferAttribute(colorArr, 3));
  parts.push(g);
}

function appendBillboardHaloQuad(parts, {
  fx,
  fy,
  fz,
  radius,
  peakOpacity,
  phase,
  colorHex
}) {
  // 2-triangle quad whose `position` stores exact world flame center `(fx, fy, fz)`
  // and `normal` stores `(cornerX, cornerY, radius)` for zero-CPU GPU view-space billboarding!
  const corners = [
    [-1, -1], [1, -1], [1, 1],
    [-1, -1], [1, 1], [-1, 1]
  ];
  const count = 6;
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const meta = new Float32Array(count * 4);
  const optics = new Float32Array(count * 4);
  const flamePos = new Float32Array(count * 3);
  const colorArr = new Float32Array(count * 3);

  const col = new THREE.Color(colorHex);
  const safePeak = Math.min(HARD_HALO_ALPHA_CAP, Math.max(0.02, peakOpacity));

  for (let v = 0; v < count; v++) {
    const cx = corners[v][0];
    const cy = corners[v][1];
    const o3 = v * 3;
    positions[o3] = fx;
    positions[o3 + 1] = fy;
    positions[o3 + 2] = fz;

    normals[o3] = cx;
    normals[o3 + 1] = cy;
    normals[o3 + 2] = radius;

    flamePos[o3] = fx;
    flamePos[o3 + 1] = fy;
    flamePos[o3 + 2] = fz;

    colorArr[o3] = col.r;
    colorArr[o3 + 1] = col.g;
    colorArr[o3 + 2] = col.b;

    const o4 = v * 4;
    meta[o4] = cx;
    meta[o4 + 1] = cy;
    meta[o4 + 2] = phase;
    meta[o4 + 3] = 2.0; // kind = 2.0 (Delicate Volumetric Billboard Halo)

    optics[o4] = safePeak;
    optics[o4 + 1] = 14.5; // Mie pinpoint core falloff
    optics[o4 + 2] = 4.2;  // Tyndall soft veil falloff
    optics[o4 + 3] = 0.0;
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  g.setAttribute('aScatterMeta', new THREE.BufferAttribute(meta, 4));
  g.setAttribute('aScatterOptics', new THREE.BufferAttribute(optics, 4));
  g.setAttribute('aFlamePos', new THREE.BufferAttribute(flamePos, 3));
  g.setAttribute('aScatterColor', new THREE.BufferAttribute(colorArr, 3));
  parts.push(g);
}

function buildFirelightScatterParts({
  braziers,
  wallLanterns,
  bonfire,
  relics,
  bossDoorZ
}) {
  const parts = [];

  // 1. All Standing Floor Braziers: Floor Inverse-Square Stone Light-Pool (with pedestal self-occlusion!)
  //    + Delicate Volumetric Atmospheric Halo (opacity <= 0.168)
  for (let i = 0; i < braziers.length; i++) {
    const b = braziers[i];
    if (!b) continue;
    const sc = Number.isFinite(b.scale) ? b.scale : 1.0;
    const isBoss = b.roomId === 'boss_hall' || b.z < bossDoorZ;
    const floorY = isBoss ? 0.015 : 0.020;
    const flameY = 1.38 * sc;
    const phase = i * 1.37 + 0.41;
    const poolRadius = 3.55 * sc;

    appendWorldPoolQuad(parts, {
      cx: b.x,
      cy: floorY,
      cz: b.z,
      halfW: poolRadius,
      halfH: poolRadius,
      isWall: false,
      nx: 0,
      ny: 1,
      nz: 0,
      flameX: b.x,
      flameY,
      flameZ: b.z,
      hRef: flameY,
      innerOccludeNorm: 0.17, // Stone pedestal blocks direct downward rays under r < 0.60m!
      peakStrength: 0.118,
      phase,
      colorHex: 0xff8a30
    });

    appendBillboardHaloQuad(parts, {
      fx: b.x,
      fy: 1.44 * sc,
      fz: b.z,
      radius: 1.24 * sc,
      peakOpacity: MAX_HALO_OPACITY_BRAZIER,
      phase,
      colorHex: 0xff943b
    });
  }

  // 2. All Wall-Mounted Lantern Sconces:
  //    - Wide 4.0m Wall Grazing Inverse-Square Pool (curvature-safe inward offset in Boss Cathedral!)
  //    - Floor Wall-Base Inverse-Square Reflection Pool linking sconces to flagstones below
  //    - Delicate Volumetric Atmospheric Halo (opacity <= 0.145)
  for (let j = 0; j < wallLanterns.length; j++) {
    const w = wallLanterns[j];
    if (!w) continue;
    const sc = Number.isFinite(w.scale) ? w.scale : 1.0;
    const wy = Number.isFinite(w.y) ? w.y : 3.2;
    const rotY = resolveYawFromNormal(w);
    const nx = Number.isFinite(w.normalX) ? w.normalX : (Number.isFinite(w.nx) ? w.nx : Math.sin(rotY));
    const nz = Number.isFinite(w.normalZ) ? w.normalZ : (Number.isFinite(w.nz) ? w.nz : Math.cos(rotY));
    const isBoss = w.roomId === 'boss_hall' || w.z < bossDoorZ;
    const phase = (braziers.length + j) * 1.51 + 0.63;

    // Hanging lantern glass cage center sits 0.60m inward from wall bracket
    const arm = 0.60 * sc;
    const fx = (w.x || 0) + nx * arm;
    const fy = wy - 0.38 * sc;
    const fz = (w.z || 0) + nz * arm;
    const colHex = Number.isFinite(w.color) ? w.color : 0xff8c36;

    // Curvature-safe offset keeps flat wall quad 100% in front of 16-sided Boss Cathedral masonry
    const wallPush = isBoss ? 0.04 : 0.062;
    appendWorldPoolQuad(parts, {
      cx: (w.x || 0) + nx * wallPush,
      cy: fy + 0.08 * sc,
      cz: (w.z || 0) + nz * wallPush,
      halfW: (isBoss ? 1.65 : 2.05) * sc,
      halfH: 1.95 * sc,
      isWall: true,
      rotY,
      nx,
      ny: 0,
      nz,
      flameX: fx,
      flameY: fy,
      flameZ: fz,
      hRef: 0.62 * sc,
      innerOccludeNorm: 0.16, // Softly yields center to soulsCastleProps bracket soot decal (0 hotspot!)
      peakStrength: 0.092,
      phase,
      colorHex: colHex
    });

    // Floor reflection pool on flagstones right along the base of the wall beneath the sconce
    appendWorldPoolQuad(parts, {
      cx: (w.x || 0) + nx * 1.15,
      cy: isBoss ? 0.015 : 0.020,
      cz: (w.z || 0) + nz * 1.15,
      halfW: 1.85 * sc,
      halfH: 1.75 * sc,
      isWall: false,
      nx: 0,
      ny: 1,
      nz: 0,
      flameX: fx,
      flameY: fy,
      flameZ: fz,
      hRef: fy,
      innerOccludeNorm: -0.1,
      peakStrength: 0.068,
      phase,
      colorHex: colHex
    });

    appendBillboardHaloQuad(parts, {
      fx,
      fy,
      fz,
      radius: 0.88 * sc,
      peakOpacity: MAX_HALO_OPACITY_WALL,
      phase,
      colorHex: 0xff9b44
    });
  }

  // 3. Hero Bonfire Hearth Floor Bounce Ring (warm inverse-square ember reflection outside the 10-stone ring)
  if (bonfire && Number.isFinite(bonfire.x) && Number.isFinite(bonfire.z)) {
    const isBoss = bonfire.z < bossDoorZ;
    appendWorldPoolQuad(parts, {
      cx: bonfire.x,
      cy: isBoss ? 0.015 : 0.020,
      cz: bonfire.z,
      halfW: 5.1,
      halfH: 5.1,
      isWall: false,
      nx: 0,
      ny: 1,
      nz: 0,
      flameX: bonfire.x,
      flameY: 1.25,
      flameZ: bonfire.z,
      hRef: 1.35,
      innerOccludeNorm: 0.21, // Occluded inside the 10-stone ash ring!
      peakStrength: 0.125,
      phase: 0.15,
      colorHex: 0xff8426
    });
  }

  // 4. Relic Shrine Golden Floor Reflection Pool
  for (let r = 0; r < relics.length; r++) {
    const rel = relics[r];
    if (!rel) continue;
    appendWorldPoolQuad(parts, {
      cx: rel.x,
      cy: 0.020,
      cz: rel.z,
      halfW: 3.0,
      halfH: 3.0,
      isWall: false,
      nx: 0,
      ny: 1,
      nz: 0,
      flameX: rel.x,
      flameY: 1.35,
      flameZ: rel.z,
      hRef: 1.35,
      innerOccludeNorm: 0.24,
      peakStrength: 0.088,
      phase: 2.05 + r,
      colorHex: 0xffaa38
    });
  }

  return parts;
}

// Shared GLSL evaluation for Stone Light-Pools & Delicate Volumetric Halos (0 discard, 0 X4000!)
const FIRELIGHT_SCATTER_EVAL_GLSL = `
  float phase = vScatterMeta.z;
  float flicker = 0.92
    + 0.072 * sin(uTime * 6.4 + phase)
    + 0.044 * sin(uTime * 11.7 + phase * 1.73)
    + 0.024 * cos(uTime * 18.3 + phase * 2.41);

  vec3 scatterOutCol = vec3(0.0);
  float scatterOutAlpha = 0.0;

  if (vScatterMeta.w < 1.5) {
    // Kind 0 (Floor Stone Pool) & Kind 1 (Wall Grazing Stone Pool):
    // True 3D Lambertian inverse-square irradiance + Blinn-Phong wet-stone facet glints!
    vec2 localUv = vScatterMeta.xy;
    float rNormSq = dot(localUv, localUv);
    float rNorm = sqrt(max(rNormSq, 1e-6));
    float c2Window = clamp(1.0 - rNormSq, 0.0, 1.0);
    c2Window = c2Window * c2Window;

    vec3 toLight = vFlamePos - vWorldPos;
    float distSq = max(0.08, dot(toLight, toLight));
    vec3 L = toLight * inversesqrt(distSq);
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);

    float hRef = max(0.25, vScatterOptics.x);
    float hSq = hRef * hRef;
    // Exact normalized physical inverse-square cosine irradiance: h^2 / (h^2 + d_plane^2) * (N·L)
    float invSq = (hSq / (hSq + distSq)) * max(dot(N, L), 0.0);

    // Pedestal / bracket inner self-occlusion (smoothly masks center where solid stone blocks rays)
    float innerOcc = vScatterOptics.y;
    float occMask = innerOcc > 0.0
      ? mix(0.22, 1.0, smoothstep(innerOcc * 0.55, innerOcc * 1.45, rNorm))
      : 1.0;

    // Procedural ashlar stone micro-facets + view-dependent Blinn-Phong wet specular glints
    float glintSpec = 0.0;
    float stoneMod = 1.0;
    if (uLowSpec < 0.5) {
      vec2 stoneCoord = vScatterMeta.w < 0.5
        ? vWorldPos.xz * 2.65
        : vec2(vWorldPos.x + vWorldPos.z, vWorldPos.y) * 2.65;
      float facetA = vnoise(stoneCoord);
      float facetB = vnoise(stoneCoord * 3.1 + vec2(7.3, 2.9));
      float mortarMask = smoothstep(0.18, 0.62, facetA);
      stoneMod = 0.80 + 0.36 * mortarMask;

      vec3 H = normalize(L + V);
      float ndoth = max(dot(N, H), 1e-4);
      float wetPatch = smoothstep(0.38, 0.86, facetA * 0.62 + facetB * 0.38);
      glintSpec = pow(ndoth, 14.0) * wetPatch * vScatterOptics.w * 0.55;
    }

    // Gentle close-range balance so analytical pools never over-stack with the 4 active real PointLights
    float poolBalance = mix(0.56, 1.0, smoothstep(5.5, 16.5, vViewDist));
    float farFade = smoothstep(112.0, 34.0, vViewDist);

    float irrad = invSq * c2Window * occMask * stoneMod * flicker * poolBalance * farFade;
    vec3 warmDiffuse = vScatterColor;
    vec3 specHighlight = mix(vScatterColor, vec3(1.0, 0.86, 0.62), 0.52);
    scatterOutCol = warmDiffuse + specHighlight * glintSpec;
    scatterOutAlpha = clamp((irrad * vScatterOptics.z + glintSpec * c2Window * occMask * 0.085 * flicker * farFade) * uFireScatterIntensity, 0.0, 0.24);
  } else {
    // Kind 2: Delicate Volumetric Atmospheric Halo (Mie pinpoint + Tyndall whisper veil, strictly <= 0.188!)
    vec2 corner = vScatterMeta.xy;
    float rSq = dot(corner, corner);
    float win = clamp(1.0 - rSq, 0.0, 1.0);
    win = win * win;

    float mieCore = 1.0 / pow(1.0 + rSq * vScatterOptics.y, 1.65);
    float tyndallVeil = 1.0 / pow(1.0 + rSq * vScatterOptics.z, 1.35);
    float phaseScatter = (mieCore * 0.60 + tyndallVeil * 0.40) * win;

    float nearSafe = smoothstep(1.45, 4.25, vViewDist);
    float farFade = smoothstep(108.0, 32.0, vViewDist);

    vec3 coreGold = vec3(1.0, 0.84, 0.54);
    scatterOutCol = mix(vScatterColor * 0.92, coreGold, mieCore);
    scatterOutAlpha = clamp(
      phaseScatter * vScatterOptics.x * flicker * nearSafe * farFade * uHaloIntensity,
      0.0,
      ${HARD_HALO_ALPHA_CAP.toFixed(3)}
    );
  }
`;

function createDedicatedFirelightScatterMaterial(lowSpec) {
  const uniforms = {
    uTime: { value: 0 },
    uFireScatterIntensity: { value: 1.0 },
    uHaloIntensity: { value: 1.0 },
    uLowSpec: { value: lowSpec ? 1.0 : 0.0 }
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    fog: false,
    vertexShader: `
      attribute vec4 aScatterMeta;
      attribute vec4 aScatterOptics;
      attribute vec3 aFlamePos;
      attribute vec3 aScatterColor;

      uniform float uTime;

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec4 vScatterMeta;
      varying vec4 vScatterOptics;
      varying vec3 vFlamePos;
      varying vec3 vScatterColor;
      varying float vViewDist;

      void main() {
        vScatterMeta = aScatterMeta;
        vScatterOptics = aScatterOptics;
        vFlamePos = aFlamePos;
        vScatterColor = aScatterColor;

        if (aScatterMeta.w > 1.5) {
          // GPU View-Space Billboard Halo (position = flame world center, normal = (cx, cy, radius))
          vec4 worldCenter = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldCenter.xyz;
          vWorldNormal = vec3(0.0, 0.0, 1.0);
          vec4 mvCenter = viewMatrix * worldCenter;
          float breath = 0.96 + 0.04 * sin(uTime * 6.4 + aScatterMeta.z);
          mvCenter.xy += normal.xy * (normal.z * breath);
          vViewDist = -mvCenter.z;
          gl_Position = projectionMatrix * mvCenter;
        } else {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          vec4 mvPos = viewMatrix * worldPos;
          vViewDist = -mvPos.z;
          gl_Position = projectionMatrix * mvPos;
        }
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uFireScatterIntensity;
      uniform float uHaloIntensity;
      uniform float uLowSpec;

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec4 vScatterMeta;
      varying vec4 vScatterOptics;
      varying vec3 vFlamePos;
      varying vec3 vScatterColor;
      varying float vViewDist;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      void main() {
        ${FIRELIGHT_SCATTER_EVAL_GLSL}
        gl_FragColor = vec4(scatterOutCol, scatterOutAlpha);
      }
    `
  });

  return { material, uniforms };
}

// Mobile-only unified AdditiveBlending shader: Slender God-Rays + Stone Light-Pools + Delicate Halos in 1 DC!
function createMobileUnifiedAdditiveLightMaterial(lowSpec) {
  const uniforms = {
    uTime: { value: 0 },
    uGodRayIntensity: { value: 1.0 },
    uFireScatterIntensity: { value: 1.0 },
    uHaloIntensity: { value: 1.0 },
    uLowSpec: { value: lowSpec ? 1.0 : 0.0 }
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    fog: false,
    vertexShader: `
      attribute vec4 aScatterMeta;
      attribute vec4 aScatterOptics;
      attribute vec3 aFlamePos;
      attribute vec3 aScatterColor;

      uniform float uTime;

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec4 vScatterMeta;
      varying vec4 vScatterOptics;
      varying vec3 vFlamePos;
      varying vec3 vScatterColor;
      varying float vViewDist;

      void main() {
        vScatterMeta = aScatterMeta;
        vScatterOptics = aScatterOptics;
        vFlamePos = aFlamePos;
        vScatterColor = aScatterColor;

        if (aScatterMeta.w > 1.5 && aScatterMeta.w < 2.5) {
          vec4 worldCenter = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldCenter.xyz;
          vWorldNormal = vec3(0.0, 0.0, 1.0);
          vec4 mvCenter = viewMatrix * worldCenter;
          float breath = 0.96 + 0.04 * sin(uTime * 6.4 + aScatterMeta.z);
          mvCenter.xy += normal.xy * (normal.z * breath);
          vViewDist = -mvCenter.z;
          gl_Position = projectionMatrix * mvCenter;
        } else {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          vec4 mvPos = viewMatrix * worldPos;
          vViewDist = -mvPos.z;
          gl_Position = projectionMatrix * mvPos;
        }
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uGodRayIntensity;
      uniform float uFireScatterIntensity;
      uniform float uHaloIntensity;
      uniform float uLowSpec;

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec4 vScatterMeta;
      varying vec4 vScatterOptics;
      varying vec3 vFlamePos;
      varying vec3 vScatterColor;
      varying float vViewDist;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      void main() {
        vec3 finalCol = vec3(0.0);
        float finalAlpha = 0.0;

        if (vScatterMeta.w > 2.5) {
          float along = vScatterMeta.x;
          float coreFlag = vScatterMeta.y;
          float phase = vScatterMeta.z;
          float angle = vScatterOptics.x;
          vec3 rayColor = vScatterColor;
          ${GOD_RAY_EVAL_GLSL}
          finalCol = beamCol;
          finalAlpha = rayAlpha;
        } else {
          ${FIRELIGHT_SCATTER_EVAL_GLSL}
          finalCol = scatterOutCol;
          finalAlpha = scatterOutAlpha;
        }

        gl_FragColor = vec4(finalCol, finalAlpha);
      }
    `
  });

  return { material, uniforms };
}

function mergeAdditiveParts(parts) {
  if (!parts.length) return null;
  const merged = mergeGeometries(parts, false);
  for (let i = 0; i < parts.length; i++) parts[i].dispose();
  merged.computeBoundingBox();
  if (merged.boundingBox) merged.boundingBox.expandByScalar(1.8);
  merged.computeBoundingSphere();
  if (merged.boundingSphere) merged.boundingSphere.radius += 1.8;
  return merged;
}

// ============================================================================
// 3. Data-Driven Ground Mist & Deep Multi-Scale Contact AO Builders
// ============================================================================
function buildMistZones({ rooms, bossCenter, bossRadius }) {
  const zones = [];
  const roomList = rooms ? Object.values(rooms) : [];
  let hasCircleBoss = false;
  let seedIdx = 0;

  // Generic data-driven iteration supports ANY room topology (classic 4-room OR 6-zone non-linear castle!)
  for (let i = 0; i < roomList.length; i++) {
    const r = roomList[i];
    if (!r || r.isConnector) continue;

    if (r.shape === 'circle' || r.id === 'boss_hall') {
      hasCircleBoss = true;
      const rad = Number.isFinite(r.radius) ? r.radius : bossRadius;
      const diam = Math.max(10.0, (rad - 0.35) * 2.0);
      zones.push({
        id: `mist_${r.id || 'boss_hall'}`,
        cx: Number.isFinite(r.cx) ? r.cx : bossCenter.x,
        cz: Number.isFinite(r.cz) ? r.cz : bossCenter.z,
        width: diam,
        depth: diam,
        density: 0.96,
        zoneType: 1.0,
        seed: 5.73
      });
    } else if (Number.isFinite(r.minX) && Number.isFinite(r.maxX) && Number.isFinite(r.minZ) && Number.isFinite(r.maxZ)) {
      const spanX = r.maxX - r.minX;
      const spanZ = r.maxZ - r.minZ;
      if (spanX < 2.2 || spanZ < 2.2) continue;

      const w = Math.max(2.0, spanX - 0.65);
      const cx = (r.minX + r.maxX) * 0.5;
      // Subdivide long halls (> 22m) into overlapping ribbons so mist stays continuous end-to-end
      const subCount = Math.max(1, Math.ceil(spanZ / 18.5));
      const stepZ = spanZ / subCount;
      const overlap = subCount > 1 ? 2.4 : 0.0;

      for (let s = 0; s < subCount; s++) {
        const z0 = r.minZ + s * stepZ - (s > 0 ? overlap : -0.3);
        const z1 = r.minZ + (s + 1) * stepZ + (s < subCount - 1 ? overlap : -0.3);
        const isBranch = Boolean(r.isBranch);
        zones.push({
          id: `mist_${r.id}_${s}`,
          cx,
          cz: (z0 + z1) * 0.5,
          width: w,
          depth: Math.max(2.4, z1 - z0),
          density: isBranch ? 0.78 : 0.88,
          zoneType: 0.0,
          seed: 0.37 + (seedIdx++) * 1.41
        });
      }
    }
  }

  if (!hasCircleBoss) {
    const diam = Math.max(10.0, (bossRadius - 0.35) * 2.0);
    zones.push({
      id: 'mist_boss_perimeter',
      cx: bossCenter.x,
      cz: bossCenter.z,
      width: diam,
      depth: diam,
      density: 0.96,
      zoneType: 1.0,
      seed: 5.73
    });
  }

  return zones;
}

function buildStaticAoPadSpecs({
  pillars,
  braziers,
  bonfire,
  relics,
  alcoveDecor,
  throne,
  wallSegments,
  bossDoorZ
}) {
  const pads = [];

  // 1. All Gothic Pillars (deep rounded-square AO matching 1.74 x 1.74 stone plinth bases)
  for (let i = 0; i < pillars.length; i++) {
    const p = pillars[i];
    if (!p) continue;
    const isBossHall = p.roomId === 'boss_hall' || p.z < bossDoorZ;
    const baseR = (p.radius || 0.85) * 2.18;
    pads.push({
      x: p.x,
      y: isBossHall ? 0.006 : 0.010,
      z: p.z,
      rx: baseR,
      rz: baseR,
      rotY: 0,
      strength: 0.94,
      shapePower: 2.85,
      inner: 0.46
    });
  }

  // 2. All Standing Floor Lantern Braziers (deep circular contact AO under carved pedestals)
  for (let i = 0; i < braziers.length; i++) {
    const b = braziers[i];
    if (!b) continue;
    const isBossHall = b.roomId === 'boss_hall' || b.z < bossDoorZ;
    const sc = b.scale || 1.0;
    const rad = 1.26 * sc;
    pads.push({
      x: b.x,
      y: isBossHall ? 0.006 : 0.010,
      z: b.z,
      rx: rad,
      rz: rad,
      rotY: 0,
      strength: 0.90,
      shapePower: 2.0,
      inner: 0.38
    });
  }

  // 3. Hero Bonfire (grounded scorch/contact shadow bedding the 10-stone ash ring wherever placed!)
  if (bonfire && Number.isFinite(bonfire.x) && Number.isFinite(bonfire.z)) {
    const isBoss = bonfire.z < bossDoorZ;
    pads.push({
      x: bonfire.x,
      y: isBoss ? 0.006 : 0.010,
      z: bonfire.z,
      rx: 2.35,
      rz: 2.35,
      rotY: 0,
      strength: 0.86,
      shapePower: 2.0,
      inner: 0.48
    });
  }

  // 4. Relic Shrines
  for (let i = 0; i < relics.length; i++) {
    const rel = relics[i];
    if (!rel) continue;
    const rad = (rel.radius || rel.colliderRadius || 0.85) * 1.96;
    pads.push({
      x: rel.x,
      y: 0.010,
      z: rel.z,
      rx: rad,
      rz: rad * 1.08,
      rotY: 0,
      strength: 0.88,
      shapePower: 2.5,
      inner: 0.40
    });
  }

  // 5. Floor Armory / Architectural Decor Props (weapon racks, armor stands, urns, etc.)
  for (let i = 0; i < alcoveDecor.length; i++) {
    const prop = alcoveDecor[i];
    if (!prop || prop.collider === false) continue;
    const rx = prop.rx || (prop.width ? prop.width * 0.74 : (prop.radius || 0.5) * 1.80);
    const rz = prop.rz || (prop.depth ? prop.depth * 1.08 : (prop.radius || 0.5) * 1.80);
    pads.push({
      x: prop.x,
      y: prop.z < bossDoorZ ? 0.006 : 0.010,
      z: prop.z,
      rx,
      rz,
      rotY: Number.isFinite(prop.facing) ? prop.facing : 0,
      strength: prop.strength ?? 0.76,
      shapePower: prop.shapePower ?? 2.4,
      inner: prop.inner ?? 0.35
    });
  }

  // 6. Obsidian Throne + Ceremonial Stepped Dais
  if (throne && Number.isFinite(throne.x) && Number.isFinite(throne.z)) {
    const tx = throne.x;
    const tz = throne.z;
    pads.push(
      { x: tx, y: 0.006, z: tz - 0.05, rx: 4.65, rz: 3.25, rotY: 0, strength: 0.90, shapePower: 3.0, inner: 0.64 },
      { x: tx, y: 0.007, z: tz + 2.95, rx: 3.50, rz: 1.10, rotY: 0, strength: 0.66, shapePower: 2.8, inner: 0.44 },
      { x: tx, y: 0.068, z: tz - 0.15, rx: 2.30, rz: 1.90, rotY: 0, strength: 0.93, shapePower: 2.6, inner: 0.48 }
    );
  }

  // 7. Boss Door Jambs, Interior Piers & Architectural Wall-Floor Crevice AO Strips!
  let addedJambs = 0;
  for (let i = 0; i < wallSegments.length; i++) {
    const seg = wallSegments[i];
    if (!seg) continue;
    if (seg.role === 'jamb') {
      addedJambs += 1;
      pads.push({
        x: seg.x,
        y: 0.010,
        z: seg.z + (seg.thickness || 1.4) * 0.48,
        rx: (seg.length || 3.0) * 0.62,
        rz: 1.30,
        rotY: 0,
        strength: 0.80,
        shapePower: 2.8,
        inner: 0.44
      });
    } else if (seg.role === 'interior_pier') {
      pads.push({
        x: seg.x,
        y: 0.010,
        z: seg.z,
        rx: (seg.thickness || 0.8) * 1.40,
        rz: (seg.length || 2.1) * 0.66,
        rotY: 0,
        strength: 0.76,
        shapePower: 2.8,
        inner: 0.40
      });
    } else if (Number.isFinite(seg.x1) && Number.isFinite(seg.z1) && Number.isFinite(seg.x2) && Number.isFinite(seg.z2)) {
      // Grounded wall-floor crevice AO strip along exact inner wall line (eliminates sterile 90-deg floor seams!)
      const segLen = seg.length || Math.hypot(seg.x2 - seg.x1, seg.z2 - seg.z1);
      if (segLen < 2.0) continue;
      const nx = seg.normalX || 0;
      const nz = seg.normalZ || 0;
      const mx = (seg.x1 + seg.x2) * 0.5 + nx * 0.18;
      const mz = (seg.z1 + seg.z2) * 0.5 + nz * 0.18;
      const isBoss = seg.role === 'boss_cathedral' || seg.roomId === 'boss_hall' || mz < bossDoorZ;
      const yCrevice = isBoss ? 0.005 : 0.009;
      if (seg.axis === 'x') {
        pads.push({
          x: mx,
          y: yCrevice,
          z: mz,
          rx: segLen * 0.5,
          rz: 0.52,
          rotY: 0,
          strength: 0.56,
          shapePower: 3.4,
          inner: 0.28
        });
      } else if (seg.axis === 'z') {
        pads.push({
          x: mx,
          y: yCrevice,
          z: mz,
          rx: 0.52,
          rz: segLen * 0.5,
          rotY: 0,
          strength: 0.56,
          shapePower: 3.4,
          inner: 0.28
        });
      } else {
        pads.push({
          x: mx,
          y: yCrevice,
          z: mz,
          rx: segLen * 0.5,
          rz: 0.54,
          rotY: seg.angleY || 0,
          strength: 0.56,
          shapePower: 3.4,
          inner: 0.28
        });
      }
    }
  }

  if (addedJambs === 0) {
    const portalHalf = CASTLE_LAYOUT.SOULS_CASTLE_CONSTANTS?.BOSS_PORTAL_HALF_W ?? 3.15;
    const corrHalf = CASTLE_LAYOUT.SOULS_CASTLE_CONSTANTS?.CORRIDOR_HALF_W ?? 5.0;
    const jambX = (portalHalf + corrHalf + 1.2) * 0.5;
    pads.push(
      { x: -jambX, y: 0.010, z: bossDoorZ + 0.65, rx: 1.85, rz: 1.30, rotY: 0, strength: 0.80, shapePower: 2.8, inner: 0.44 },
      { x:  jambX, y: 0.010, z: bossDoorZ + 0.65, rx: 1.85, rz: 1.30, rotY: 0, strength: 0.80, shapePower: 2.8, inner: 0.44 }
    );
  }

  return pads;
}

function buildAoParts(aoPads) {
  const parts = [];
  for (let i = 0; i < aoPads.length; i++) {
    const pad = aoPads[i];
    const raw = new THREE.PlaneGeometry(pad.rx * 2, pad.rz * 2, 1, 1);
    raw.rotateX(-Math.PI / 2);
    if (pad.rotY) raw.rotateY(pad.rotY);
    raw.translate(pad.x, pad.y, pad.z);
    const g = toNonIndexedClean(raw, true, false);
    const count = g.attributes.position.count;
    const params = new Float32Array(count * 4);
    for (let v = 0; v < count; v++) {
      const o = v * 4;
      params[o] = pad.strength;
      params[o + 1] = pad.shapePower;
      params[o + 2] = pad.inner;
      params[o + 3] = 0.0; // kind = 0 (Contact AO)
    }
    g.setAttribute('aFloorMeta', new THREE.BufferAttribute(params, 4));
    parts.push(g);
  }
  return parts;
}

function buildMistParts(mistZones, isMobile) {
  const parts = [];
  const layerSpecs = isMobile
    ? [
        { y: 0.14, hFrac: 0.0, weight: 1.00 }
      ]
    : [
        { y: 0.12, hFrac: 0.0, weight: 1.00 },
        { y: 0.40, hFrac: 1.0, weight: 0.68 }
      ];

  for (let l = 0; l < layerSpecs.length; l++) {
    const layer = layerSpecs[l];
    for (let zIdx = 0; zIdx < mistZones.length; zIdx++) {
      const zone = mistZones[zIdx];
      const driftShiftX = (l - 1) * 0.24;
      const driftShiftZ = (l - 1) * -0.22;
      const raw = new THREE.PlaneGeometry(zone.width, zone.depth, 1, 1);
      raw.rotateX(-Math.PI / 2);
      raw.translate(zone.cx + driftShiftX, layer.y, zone.cz + driftShiftZ);
      const g = toNonIndexedClean(raw, true, false);
      const count = g.attributes.position.count;
      const meta = new Float32Array(count * 4);
      const zoneDensity = zone.density * layer.weight;
      const packedMeta = zone.zoneType > 0.5 ? 2.0 : 1.0;
      for (let v = 0; v < count; v++) {
        const o = v * 4;
        meta[o] = layer.hFrac;
        meta[o + 1] = zoneDensity;
        meta[o + 2] = zone.seed + l * 1.73;
        meta[o + 3] = packedMeta;
      }
      g.setAttribute('aFloorMeta', new THREE.BufferAttribute(meta, 4));
      parts.push(g);
    }
  }
  return parts;
}

function mergeFloorParts(parts) {
  if (!parts.length) return null;
  const merged = mergeGeometries(parts, false);
  for (let i = 0; i < parts.length; i++) parts[i].dispose();
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

// Unrolled FBM GLSL chunk (strictly 2 octaves Mobile / 3 octaves PC, ZERO dynamic loops!)
function getMistFbmGlsl(isMobile) {
  return `
    float hash21(vec2 p) {
      p = fract(p * vec2(127.1, 311.7));
      p += dot(p, p + 34.5);
      return fract(p.x * p.y);
    }
    float vnoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash21(i);
      float b = hash21(i + vec2(1.0, 0.0));
      float c = hash21(i + vec2(0.0, 1.0));
      float d = hash21(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }
    float fbmMist(vec2 p) {
      float sum = vnoise(p) * 0.64;
      p = mat2(0.80, -0.60, 0.60, 0.80) * p * 2.03 + vec2(17.1, 31.7);
      sum += vnoise(p) * 0.36;
      return sum;
    }
  `;
}

// Noble dark-gothic slate-indigo mist evaluation (ZERO white fog, ZERO discard, 0 X4000!)
function getMistEvalGlsl(isMobile) {
  const layerAlphaScale = isMobile ? '0.24' : '0.18';
  return `
    float hFrac = vFloorMeta.x;
    float density = vFloorMeta.y;
    float seed = vFloorMeta.z;
    float isAnnular = step(1.5, vFloorMeta.w);

    vec2 centered = vUv * 2.0 - 1.0;
    vec2 absC = abs(centered);
    float rectMask = (1.0 - smoothstep(0.70, 1.0, absC.x)) * (1.0 - smoothstep(0.76, 1.0, absC.y));

    float rad = length(centered);
    float ringOuter = 1.0 - smoothstep(0.72, 1.0, rad);
    float ringInner = mix(0.12, 1.0, smoothstep(0.30, 0.60, rad));
    float southWallKeep = 1.0 - smoothstep(uBossDoorZ - 0.95, uBossDoorZ - 0.15, vWorldPos.z) * smoothstep(2.8, 3.8, abs(vWorldPos.x));
    float bossMask = ringOuter * ringInner * southWallKeep;

    float zoneMask = mix(rectMask, bossMask, isAnnular);

    vec2 wp = vWorldPos.xz;
    float t = uTime * 0.105;
    vec2 uv1 = wp * 0.175 + vec2(t * 0.85 + seed * 0.4, -t * 0.45 - hFrac * 0.6);
    float n1 = fbmMist(uv1);
    vec2 uv2 = wp * 0.275 + vec2(-t * 0.55 + n1 * 0.45, t * 0.36 + seed * 0.3);
    float n2 = fbmMist(uv2);
    float cloud = smoothstep(0.24 + hFrac * 0.09, 0.76, n1 * 0.58 + n2 * 0.42);

    float dBonfire = length(wp - uBonfirePos);
    float bonfireClear = mix(0.14, 1.0, smoothstep(1.5, 4.2, dBonfire));
    float bonfireWarm = smoothstep(6.8, 2.1, dBonfire) * smoothstep(1.1, 2.6, dBonfire);

    float dDoor = length(wp - vec2(0.0, uBossDoorZ + 0.2));
    float doorBoost = 1.0 + smoothstep(6.0, 0.8, dDoor) * (0.38 + uDoorSurge * 0.28);

    vec3 V = normalize(cameraPosition - vWorldPos);
    float angleSoft = smoothstep(0.012, 0.10, abs(V.y));
    float nearFade = smoothstep(0.85, 2.6, vViewDist);
    float farFade = smoothstep(98.0, 30.0, vViewDist);

    vec3 mistDeep = vec3(0.12, 0.17, 0.29);
    vec3 mistCrest = vec3(0.38, 0.50, 0.70);
    vec3 mistCol = mix(mistDeep, mistCrest, clamp(cloud * 0.82 + hFrac * 0.20, 0.0, 1.0));
    mistCol = mix(mistCol, vec3(0.76, 0.44, 0.22), bonfireWarm * 0.42);

    float mistAlpha = clamp(
      cloud * zoneMask * bonfireClear * doorBoost * density * angleSoft * nearFade * farFade * ${layerAlphaScale} * uMistIntensity,
      0.0,
      0.30
    );
  `;
}

// Deep analytical Contact AO evaluation (abyssal crevice shadow, ZERO texture fetches, ZERO discard!)
const AO_EVAL_GLSL = `
  vec2 q = abs(vUv * 2.0 - 1.0);
  float p = vFloorMeta.y;
  float dist = pow(pow(max(q.x, 1e-4), p) + pow(max(q.y, 1e-4), p), 1.0 / p);
  float inner = vFloorMeta.z;
  float tRad = clamp((dist - inner) / max(0.001, 0.98 - inner), 0.0, 1.0);
  float sCurve = 1.0 - tRad * tRad * (3.0 - 2.0 * tRad);
  float aoShape = sCurve * (0.38 + 0.62 * sCurve);
  float aoFarFade = smoothstep(115.0, 36.0, vViewDist);
  float aoAlpha = clamp(aoShape * vFloorMeta.x * uAoStrength * aoFarFade, 0.0, 0.95);
  vec3 aoCol = vec3(0.006, 0.009, 0.020);
`;

function createDedicatedMistMaterial(bonfire, bossDoorZ, isMobile) {
  const uniforms = {
    uTime: { value: 0 },
    uMistIntensity: { value: 1.0 },
    uDoorSurge: { value: 0.0 },
    uBonfirePos: { value: new THREE.Vector2(bonfire?.x ?? 0, bonfire?.z ?? 32.5) },
    uBossDoorZ: { value: bossDoorZ }
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
    side: THREE.FrontSide,
    fog: false,
    vertexShader: `
      attribute vec4 aFloorMeta;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec4 vFloorMeta;
      varying float vViewDist;
      void main() {
        vUv = uv;
        vFloorMeta = aFloorMeta;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vec4 mv = viewMatrix * wp;
        vViewDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uMistIntensity;
      uniform float uDoorSurge;
      uniform vec2 uBonfirePos;
      uniform float uBossDoorZ;

      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec4 vFloorMeta;
      varying float vViewDist;

      ${getMistFbmGlsl(isMobile)}

      void main() {
        ${getMistEvalGlsl(isMobile)}
        gl_FragColor = vec4(mistCol, mistAlpha);
      }
    `
  });

  return { material, uniforms };
}

function createDedicatedStaticAoMaterial() {
  const uniforms = {
    uAoStrength: { value: 1.0 }
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
    side: THREE.FrontSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    fog: false,
    vertexShader: `
      attribute vec4 aFloorMeta;
      varying vec2 vUv;
      varying vec4 vFloorMeta;
      varying float vViewDist;
      void main() {
        vUv = uv;
        vFloorMeta = aFloorMeta;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uAoStrength;
      varying vec2 vUv;
      varying vec4 vFloorMeta;
      varying float vViewDist;
      void main() {
        ${AO_EVAL_GLSL}
        gl_FragColor = vec4(aoCol, aoAlpha);
      }
    `
  });

  return { material, uniforms };
}

function createMobileCombinedFloorMaterial(bonfire, bossDoorZ) {
  const uniforms = {
    uTime: { value: 0 },
    uMistIntensity: { value: 1.0 },
    uAoStrength: { value: 1.0 },
    uDoorSurge: { value: 0.0 },
    uBonfirePos: { value: new THREE.Vector2(bonfire?.x ?? 0, bonfire?.z ?? 32.5) },
    uBossDoorZ: { value: bossDoorZ }
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
    side: THREE.FrontSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    fog: false,
    vertexShader: `
      attribute vec4 aFloorMeta;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec4 vFloorMeta;
      varying float vViewDist;
      void main() {
        vUv = uv;
        vFloorMeta = aFloorMeta;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vec4 mv = viewMatrix * wp;
        vViewDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uMistIntensity;
      uniform float uAoStrength;
      uniform float uDoorSurge;
      uniform vec2 uBonfirePos;
      uniform float uBossDoorZ;

      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec4 vFloorMeta;
      varying float vViewDist;

      ${getMistFbmGlsl(true)}

      void main() {
        vec3 floorCol = vec3(0.0);
        float floorAlpha = 0.0;
        if (vFloorMeta.w < 0.5) {
          ${AO_EVAL_GLSL}
          floorCol = aoCol;
          floorAlpha = aoAlpha;
        } else {
          ${getMistEvalGlsl(true)}
          floorCol = mistCol;
          floorAlpha = mistAlpha;
        }
        gl_FragColor = vec4(floorCol, floorAlpha);
      }
    `
  });

  return { material, uniforms };
}

// ============================================================================
// 4. Cathedral Dust Motes (1 DC, 100% GPU Points — 75% Beam-Illuminated!)
// ============================================================================
function buildCathedralDustMotes(raySpecs, { rooms, bossCenter, bossRadius }, isMobile, lowSpec) {
  const rng = makeRng(0xCA571E07);
  const maxCount = DUST_COUNT_PC;

  const positions = new Float32Array(maxCount * 3);
  const motion = new Float32Array(maxCount * 4);
  const style = new Float32Array(maxCount * 4);

  const ambientVolumes = [];
  const roomList = rooms ? Object.values(rooms) : [];
  for (let i = 0; i < roomList.length; i++) {
    const r = roomList[i];
    if (!r || r.isConnector) continue;
    if (r.shape === 'circle' || r.id === 'boss_hall') {
      const rad = Number.isFinite(r.radius) ? r.radius : bossRadius;
      ambientVolumes.push({
        cx: Number.isFinite(r.cx) ? r.cx : bossCenter.x,
        cy: 4.2,
        cz: Number.isFinite(r.cz) ? r.cz : bossCenter.z,
        rx: Math.max(4.0, rad * 0.76),
        ry: 3.4,
        rz: Math.max(4.0, rad * 0.76),
        warmBias: 0.48
      });
    } else if (Number.isFinite(r.minX) && Number.isFinite(r.maxX) && Number.isFinite(r.minZ) && Number.isFinite(r.maxZ)) {
      const sx = (r.maxX - r.minX) * 0.5;
      const sz = (r.maxZ - r.minZ) * 0.5;
      if (sx < 1.0 || sz < 1.0) continue;
      ambientVolumes.push({
        cx: (r.minX + r.maxX) * 0.5,
        cy: 2.9,
        cz: (r.minZ + r.maxZ) * 0.5,
        rx: Math.max(1.2, sx - 1.0),
        ry: 2.2,
        rz: Math.max(1.2, sz - 1.0),
        warmBias: r.isBranch ? 0.72 : 0.56
      });
    }
  }
  if (!ambientVolumes.length) {
    ambientVolumes.push({
      cx: bossCenter.x,
      cy: 4.0,
      cz: bossCenter.z,
      rx: Math.max(4.0, bossRadius * 0.76),
      ry: 3.2,
      rz: Math.max(4.0, bossRadius * 0.76),
      warmBias: 0.5
    });
  }

  const hasRays = raySpecs.length > 0;
  for (let i = 0; i < maxCount; i++) {
    let x = 0;
    let y = 2.5;
    let z = 0;
    let tint = 0.25;
    let beamGain = 0.58;

    // 75% seeded tightly inside the slender moonlit shafts (brightly lunar-illuminated motes!)
    if (hasRays && (i % 4 !== 3)) {
      const ray = raySpecs[i % raySpecs.length];
      const t = 0.14 + rng() * 0.74;
      const cx = ray.origin[0] + (ray.target[0] - ray.origin[0]) * t;
      const cy = ray.origin[1] + (ray.target[1] - ray.origin[1]) * t;
      const cz = ray.origin[2] + (ray.target[2] - ray.origin[2]) * t;
      // Tighter 0.54 radius matching slender Wave-2 god-ray shafts
      const coneR = (ray.topRadius + (ray.bottomRadius - ray.topRadius) * t) * 0.54;
      const ang = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * coneR;
      x = cx + Math.cos(ang) * r;
      y = Math.max(0.55, cy + (rng() - 0.5) * 0.45);
      z = cz + Math.sin(ang) * r;
      tint = rng() < 0.22 ? (0.60 + rng() * 0.40) : (rng() * 0.28);
      beamGain = 1.0;
    } else {
      const vol = ambientVolumes[i % ambientVolumes.length];
      x = vol.cx + (rng() - 0.5) * 2.0 * vol.rx;
      y = Math.max(0.55, vol.cy + (rng() - 0.5) * 2.0 * vol.ry);
      z = vol.cz + (rng() - 0.5) * 2.0 * vol.rz;
      tint = rng() < vol.warmBias ? (0.58 + rng() * 0.42) : (rng() * 0.36);
      beamGain = 0.56;
    }

    const o3 = i * 3;
    positions[o3] = x;
    positions[o3 + 1] = y;
    positions[o3 + 2] = z;

    const o4 = i * 4;
    motion[o4] = 0.26 + rng() * 0.68;        // refined drift swirl radius
    motion[o4 + 1] = 0.16 + rng() * 0.30;    // swirl speed
    motion[o4 + 2] = 0.20 + rng() * 0.52;    // vertical buoyant amplitude
    motion[o4 + 3] = rng() * Math.PI * 2.0;  // phase seed

    style[o4] = 0.068 + rng() * 0.082;       // crisp optical point scale (no giant blobs!)
    style[o4 + 1] = tint;                    // 0 = lunar silver-blue, 1 = firelit gold
    style[o4 + 2] = 1.25 + rng() * 2.15;     // twinkle speed
    style[o4 + 3] = beamGain;                // illuminated beam boost
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aMotion', new THREE.BufferAttribute(motion, 4));
  geo.setAttribute('aStyle', new THREE.BufferAttribute(style, 4));
  geo.computeBoundingBox();
  if (geo.boundingBox) geo.boundingBox.expandByScalar(1.6);
  geo.computeBoundingSphere();
  if (geo.boundingSphere) geo.boundingSphere.radius += 1.6;

  const targetCount = lowSpec ? DUST_COUNT_LOWSPEC : (isMobile ? DUST_COUNT_MOBILE : DUST_COUNT_PC);
  geo.setDrawRange(0, targetCount);

  const uniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: getSafePixelRatio() },
    uIntensity: { value: 1.0 }
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    fog: false,
    vertexShader: `
      attribute vec4 aMotion;
      attribute vec4 aStyle;

      uniform float uTime;
      uniform float uPixelRatio;

      varying float vTint;
      varying float vAlpha;

      void main() {
        float swirlR = aMotion.x;
        float speed = aMotion.y;
        float bobAmp = aMotion.z;
        float phase = aMotion.w;

        float t = uTime * speed + phase;
        vec3 p = position;
        p.x += sin(t) * swirlR + cos(t * 0.53 + phase) * swirlR * 0.35;
        p.y += sin(t * 0.73 + phase * 1.3) * bobAmp + cos(t * 0.31) * bobAmp * 0.25;
        p.z += cos(t * 0.87 + phase * 0.7) * swirlR * 0.85;

        vec4 mvPos = modelViewMatrix * vec4(p, 1.0);
        float viewDist = -mvPos.z;

        float twinkle = 0.50 + 0.50 * sin(uTime * aStyle.z + phase * 2.7);
        float nearFade = smoothstep(0.90, 2.8, viewDist);
        float farFade = smoothstep(92.0, 26.0, viewDist);

        vTint = aStyle.y;
        vAlpha = twinkle * nearFade * farFade * aStyle.w;

        float ptSize = (aStyle.x * 240.0 * uPixelRatio * (0.78 + 0.32 * twinkle)) / max(1.0, viewDist);
        gl_PointSize = clamp(ptSize, 1.4, 8.8);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float uIntensity;
      varying float vTint;
      varying float vAlpha;

      void main() {
        vec2 c = gl_PointCoord - vec2(0.5);
        float d = length(c) * 2.0;
        float mask = 1.0 - smoothstep(0.16, 1.0, d);
        float core = exp(-d * d * 7.2);
        float shape = (core * 0.76 + mask * 0.24) * mask;

        vec3 moonSilver = vec3(0.70, 0.86, 1.00);
        vec3 warmGold = vec3(1.00, 0.84, 0.52);
        vec3 col = mix(moonSilver, warmGold, vTint);

        float alpha = clamp(shape * vAlpha * 0.82 * uIntensity, 0.0, 0.90);
        gl_FragColor = vec4(col, alpha);
      }
    `
  });

  const points = new THREE.Points(geo, material);
  points.name = 'CastleCathedralDustMotes';
  points.frustumCulled = true;
  points.visible = targetCount > 0;
  points.renderOrder = 5;

  return { points, geo, material, uniforms };
}

// ============================================================================
// 5. Exported Helper for models.js: Deep Dual-Zone Actor Contact AO Disc
// ============================================================================
let sharedActorShadowGeo = null;
let sharedActorShadowTex = null;
let sharedActorShadowRefs = 0;

function buildActorContactAoTexture() {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  const invHalf = 2.0 / (size - 1);

  for (let y = 0; y < size; y++) {
    const ny = y * invHalf - 1.0;
    const ny2 = ny * ny;
    const row = y * size;
    for (let x = 0; x < size; x++) {
      const nx = x * invHalf - 1.0;
      const r = Math.sqrt(nx * nx + ny2);
      // Deep physical dual-zone contact AO: dense stance contact core + inverse-square penumbra
      let a = 0.0;
      if (r < 0.96) {
        const t = r / 0.96;
        const win = 1.0 - t * t * (3.0 - 2.0 * t);
        const core = Math.exp(-r * r * 6.2);
        const penumbra = 1.0 / Math.pow(1.0 + r * r * 2.8, 1.45);
        a = clamp01((core * 0.56 + penumbra * 0.44) * win);
      }
      const idx = (row + x) * 4;
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = (a * 255 + 0.5) | 0;
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function acquireSharedActorShadowResources() {
  if (!sharedActorShadowGeo) {
    sharedActorShadowGeo = new THREE.PlaneGeometry(2, 2, 1, 1);
    sharedActorShadowGeo.rotateX(-Math.PI / 2);
    sharedActorShadowGeo.computeBoundingBox();
    sharedActorShadowGeo.computeBoundingSphere();
  }
  if (!sharedActorShadowTex) {
    sharedActorShadowTex = buildActorContactAoTexture();
  }
  sharedActorShadowRefs += 1;
  return { geo: sharedActorShadowGeo, tex: sharedActorShadowTex };
}

function releaseSharedActorShadowResources() {
  sharedActorShadowRefs = Math.max(0, sharedActorShadowRefs - 1);
  if (sharedActorShadowRefs === 0) {
    if (sharedActorShadowGeo) {
      sharedActorShadowGeo.dispose();
      sharedActorShadowGeo = null;
    }
    if (sharedActorShadowTex) {
      sharedActorShadowTex.dispose();
      sharedActorShadowTex = null;
    }
  }
}

export function disposeSharedActorShadowResources() {
  sharedActorShadowRefs = 0;
  if (sharedActorShadowGeo) {
    sharedActorShadowGeo.dispose();
    sharedActorShadowGeo = null;
  }
  if (sharedActorShadowTex) {
    sharedActorShadowTex.dispose();
    sharedActorShadowTex = null;
  }
}

export function createActorContactShadowMesh(optionsOrRadius = {}) {
  const isNum = typeof optionsOrRadius === 'number' && Number.isFinite(optionsOrRadius);
  const opts = isNum ? { radius: optionsOrRadius } : (optionsOrRadius || {});
  const isBoss = Boolean(opts.isBoss);

  const baseRadiusX = Number.isFinite(opts.radius)
    ? Math.max(0.15, opts.radius)
    : (isBoss ? 1.92 : 0.90);
  const baseRadiusZ = Number.isFinite(opts.radiusZ)
    ? Math.max(0.15, opts.radiusZ)
    : baseRadiusX;
  const baseOpacity = Number.isFinite(opts.opacity)
    ? clamp01(opts.opacity)
    : (isBoss ? 0.84 : 0.76);
  const yOffset = Number.isFinite(opts.yOffset) ? opts.yOffset : 0.014;
  const colorHex = Number.isFinite(opts.color) ? opts.color : 0x04060e;

  const { geo, tex } = acquireSharedActorShadowResources();

  const mat = new THREE.MeshBasicMaterial({
    color: colorHex,
    map: tex,
    transparent: true,
    opacity: baseOpacity,
    depthWrite: false,
    depthTest: true,
    side: THREE.FrontSide,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = isBoss ? 'BossContactShadowAO' : 'ActorContactShadowAO';
  mesh.position.set(0, yOffset, 0);
  mesh.scale.set(baseRadiusX, 1, baseRadiusZ);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = true;
  mesh.renderOrder = 2;

  let released = false;
  const onMaterialDispose = () => {
    if (released) return;
    released = true;
    mat.removeEventListener('dispose', onMaterialDispose);
    releaseSharedActorShadowResources();
  };
  mat.addEventListener('dispose', onMaterialDispose);

  let curRadiusX = baseRadiusX;
  let curRadiusZ = baseRadiusZ;
  let curOpacity = baseOpacity;

  mesh.userData.isActorContactShadow = true;
  mesh.userData.baseRadiusX = baseRadiusX;
  mesh.userData.baseRadiusZ = baseRadiusZ;
  mesh.userData.baseOpacity = baseOpacity;
  mesh.userData.baseYOffset = yOffset;

  mesh.userData.setShadowScale = (rx = baseRadiusX, rz = rx) => {
    curRadiusX = Math.max(0.1, Number.isFinite(rx) ? rx : baseRadiusX);
    curRadiusZ = Math.max(0.1, Number.isFinite(rz) ? rz : curRadiusX);
    mesh.scale.set(curRadiusX, 1, curRadiusZ);
  };

  mesh.userData.setShadowOpacity = (op = baseOpacity) => {
    curOpacity = clamp01(Number.isFinite(op) ? op : baseOpacity);
    mat.opacity = curOpacity;
    mesh.visible = curOpacity > 0.01;
  };

  mesh.userData.setAirborneHeight = (heightY = 0) => {
    const h = Math.max(0, Number.isFinite(heightY) ? heightY : 0);
    const expand = 1.0 + Math.min(0.55, h * 0.14);
    const fade = 1.0 / (1.0 + h * 0.52);
    mesh.scale.set(curRadiusX * expand, 1, curRadiusZ * expand);
    mesh.position.y = yOffset - h;
    mat.opacity = curOpacity * fade;
  };

  mesh.userData.dispose = () => {
    if (mesh.parent) mesh.parent.remove(mesh);
    if (!released) {
      mat.dispose();
    }
  };

  return mesh;
}

// ============================================================================
// Main Factory: createCastleAtmosphere({ isMobile, lowSpec, ... })
// ============================================================================
export function createCastleAtmosphere(options = {}) {
  const opts = options || {};
  const isMobile = opts.isMobile !== undefined ? Boolean(opts.isMobile) : detectMobileDevice();
  let lowSpec = Boolean(opts.lowSpec);
  let disposed = false;

  const group = new THREE.Group();
  group.name = 'SoulsCastleAtmosphere';

  const ownedGeos = [];
  const ownedMats = [];
  const ownedTex = [];
  const trackGeo = (g) => {
    if (!g) return g;
    ownedGeos.push(g);
    if (typeof opts.trackGeo === 'function') opts.trackGeo(g);
    return g;
  };
  const trackMat = (m) => {
    if (!m) return m;
    ownedMats.push(m);
    if (typeof opts.trackMat === 'function') opts.trackMat(m);
    return m;
  };
  const trackTex = (t) => {
    if (!t) return t;
    ownedTex.push(t);
    if (typeof opts.trackTex === 'function') opts.trackTex(t);
    return t;
  };

  const C = CASTLE_LAYOUT.SOULS_CASTLE_CONSTANTS || {};
  const rooms = opts.rooms || CASTLE_LAYOUT.SOULS_CASTLE_ROOMS || {};
  const bonfire = opts.bonfire || CASTLE_LAYOUT.SOULS_CASTLE_BONFIRE || { x: 0, z: 32.5 };
  const throne = opts.throne || CASTLE_LAYOUT.SOULS_CASTLE_THRONE_CONFIG || { x: 0, z: -41.6 };
  const bossCenter = {
    x: Number.isFinite(opts.bossCenter?.x) ? opts.bossCenter.x : (C.BOSS_CENTER_X ?? 0),
    z: Number.isFinite(opts.bossCenter?.z) ? opts.bossCenter.z : (C.BOSS_CENTER_Z ?? -31.2)
  };
  const bossRadius = Number.isFinite(opts.bossRadius)
    ? opts.bossRadius
    : (Number.isFinite(opts.bossCenter?.radius) ? opts.bossCenter.radius : (C.BOSS_RADIUS ?? 16.0));
  const bossDoorZ = Number.isFinite(opts.bossDoorZ) ? opts.bossDoorZ : (C.BOSS_DOOR_Z ?? -16.0);

  const pillars = Array.isArray(opts.pillars) ? opts.pillars : (CASTLE_LAYOUT.SOULS_CASTLE_PILLARS || []);
  const braziers = Array.isArray(opts.braziers) ? opts.braziers : (CASTLE_LAYOUT.SOULS_CASTLE_BRAZIERS || []);
  const wallLanterns = Array.isArray(opts.wallLanterns)
    ? opts.wallLanterns
    : (CASTLE_LAYOUT.SOULS_CASTLE_WALL_LANTERNS || []);
  const relics = Array.isArray(opts.relics) ? opts.relics : (CASTLE_LAYOUT.SOULS_CASTLE_RELICS || []);
  const alcoveDecor = Array.isArray(opts.alcoveDecor)
    ? opts.alcoveDecor
    : (CASTLE_LAYOUT.SOULS_CASTLE_ALCOVE_DECOR || []);
  const wallSegments = Array.isArray(opts.wallSegments)
    ? opts.wallSegments
    : (CASTLE_LAYOUT.SOULS_CASTLE_WALL_SEGMENTS || []);
  const raySpecs = normalizeRaySpecs(opts.godRaySpecs || opts.clerestoryShafts);

  // --------------------------------------------------------------------------
  // 1 & 2. Slender God-Rays + Physical Inverse-Square Stone Light-Pools & Halos
  //        PC:     2 dedicated meshes (firelightScatterMesh [1 DC] + godRayMesh [1 DC])
  //        Mobile: 1 merged AdditiveBlending mesh [1 DC] (keeps Mobile strictly <= 3 DC!)
  // --------------------------------------------------------------------------
  const scatterParts = buildFirelightScatterParts({
    braziers,
    wallLanterns,
    bonfire,
    relics,
    bossDoorZ
  });
  const scatterQuadCount = scatterParts.length;

  let godRayMesh = null;
  let firelightScatterMesh = null;
  let mobileAdditiveGeo = null;
  let mobileGodRayVertexCount = 0;
  let mobileAdditiveTotalVertexCount = 0;
  let godRayUniforms = null;
  let scatterUniforms = null;

  if (isMobile) {
    const rayParts = buildGodRayShaftParts(raySpecs, true, true);
    for (let i = 0; i < rayParts.length; i++) {
      mobileGodRayVertexCount += rayParts[i].attributes.position.count;
    }
    mobileAdditiveGeo = trackGeo(mergeAdditiveParts([...rayParts, ...scatterParts]));
    mobileAdditiveTotalVertexCount = mobileAdditiveGeo ? mobileAdditiveGeo.attributes.position.count : 0;
    if (mobileAdditiveGeo) {
      mobileAdditiveGeo.setDrawRange(0, lowSpec ? mobileGodRayVertexCount : mobileAdditiveTotalVertexCount);
    }

    const { material: mobAddMat, uniforms: mobAddU } = createMobileUnifiedAdditiveLightMaterial(lowSpec);
    trackMat(mobAddMat);
    godRayUniforms = mobAddU;
    scatterUniforms = mobAddU;

    const mobAdditiveMesh = new THREE.Mesh(mobileAdditiveGeo, mobAddMat);
    mobAdditiveMesh.name = 'CastleAdditiveRaysAndFireScatterMobile';
    mobAdditiveMesh.castShadow = false;
    mobAdditiveMesh.receiveShadow = false;
    mobAdditiveMesh.frustumCulled = true;
    mobAdditiveMesh.renderOrder = 4;
    group.add(mobAdditiveMesh);

    godRayMesh = mobAdditiveMesh;
    firelightScatterMesh = mobAdditiveMesh;
  } else {
    // PC Dedicated Physical Inverse-Square Stone Light-Pools + Delicate Halos [1 DC]
    const scatterGeo = trackGeo(mergeAdditiveParts(scatterParts));
    const { material: scatterMat, uniforms: dedScatterU } = createDedicatedFirelightScatterMaterial(lowSpec);
    trackMat(scatterMat);
    scatterUniforms = dedScatterU;

    firelightScatterMesh = new THREE.Mesh(scatterGeo, scatterMat);
    firelightScatterMesh.name = 'CastleFirelightScatterAndHalos';
    firelightScatterMesh.castShadow = false;
    firelightScatterMesh.receiveShadow = false;
    firelightScatterMesh.frustumCulled = true;
    firelightScatterMesh.visible = !lowSpec;
    firelightScatterMesh.renderOrder = 2; // Renders under drifting ground mist for authentic aerial perspective!
    group.add(firelightScatterMesh);

    // PC Dedicated Slender Volumetric Moonlit God-Ray Shafts [1 DC]
    const rayGeo = trackGeo(mergeAdditiveParts(buildGodRayShaftParts(raySpecs, false, false)));
    const { material: rayMat, uniforms: dedRayU } = createDedicatedGodRayMaterial(lowSpec);
    trackMat(rayMat);
    godRayUniforms = dedRayU;

    godRayMesh = new THREE.Mesh(rayGeo, rayMat);
    godRayMesh.name = 'CastleMoonlitGodRays';
    godRayMesh.castShadow = false;
    godRayMesh.receiveShadow = false;
    godRayMesh.frustumCulled = true;
    godRayMesh.renderOrder = 4;
    group.add(godRayMesh);
  }

  // --------------------------------------------------------------------------
  // 3. Layered Drifting Ground Mist + Deep Multi-Scale Static Contact AO
  //    PC:     2 dedicated meshes (staticContactAoMesh [1 DC] + groundMistMesh [1 DC])
  //    Mobile: 1 merged NormalBlending mesh [1 DC]
  // --------------------------------------------------------------------------
  const mistZones = buildMistZones({ rooms, bossCenter, bossRadius });
  const aoPads = buildStaticAoPadSpecs({
    pillars,
    braziers,
    bonfire,
    relics,
    alcoveDecor,
    throne,
    wallSegments,
    bossDoorZ
  });

  let staticContactAoMesh = null;
  let groundMistMesh = null;
  let mobileFloorMesh = null;
  let mobileFloorGeo = null;
  let mobileAoVertexCount = 0;
  let mobileTotalVertexCount = 0;
  let mistUniforms = null;
  let aoUniforms = null;

  if (isMobile) {
    const aoParts = buildAoParts(aoPads);
    for (let i = 0; i < aoParts.length; i++) {
      mobileAoVertexCount += aoParts[i].attributes.position.count;
    }
    const mistParts = buildMistParts(mistZones, true);
    const combinedGeo = trackGeo(mergeFloorParts([...aoParts, ...mistParts]));
    mobileFloorGeo = combinedGeo;
    mobileTotalVertexCount = combinedGeo.attributes.position.count;
    combinedGeo.setDrawRange(0, lowSpec ? mobileAoVertexCount : mobileTotalVertexCount);

    const { material: floorMat, uniforms: floorUniforms } = createMobileCombinedFloorMaterial(bonfire, bossDoorZ);
    trackMat(floorMat);
    mistUniforms = floorUniforms;
    aoUniforms = floorUniforms;

    mobileFloorMesh = new THREE.Mesh(combinedGeo, floorMat);
    mobileFloorMesh.name = 'CastleContactAoAndMistMobile';
    mobileFloorMesh.castShadow = false;
    mobileFloorMesh.receiveShadow = false;
    mobileFloorMesh.frustumCulled = true;
    mobileFloorMesh.renderOrder = 2;
    group.add(mobileFloorMesh);

    staticContactAoMesh = mobileFloorMesh;
    groundMistMesh = mobileFloorMesh;
  } else {
    const aoGeo = trackGeo(mergeFloorParts(buildAoParts(aoPads)));
    const { material: aoMat, uniforms: dedicatedAoU } = createDedicatedStaticAoMaterial();
    trackMat(aoMat);
    aoUniforms = dedicatedAoU;

    staticContactAoMesh = new THREE.Mesh(aoGeo, aoMat);
    staticContactAoMesh.name = 'CastleStaticContactAO';
    staticContactAoMesh.castShadow = false;
    staticContactAoMesh.receiveShadow = false;
    staticContactAoMesh.frustumCulled = true;
    staticContactAoMesh.renderOrder = 1;
    group.add(staticContactAoMesh);

    const mistGeo = trackGeo(mergeFloorParts(buildMistParts(mistZones, false)));
    const { material: mistMat, uniforms: dedicatedMistU } = createDedicatedMistMaterial(bonfire, bossDoorZ, false);
    trackMat(mistMat);
    mistUniforms = dedicatedMistU;

    groundMistMesh = new THREE.Mesh(mistGeo, mistMat);
    groundMistMesh.name = 'CastleDriftingGroundMist';
    groundMistMesh.castShadow = false;
    groundMistMesh.receiveShadow = false;
    groundMistMesh.frustumCulled = true;
    groundMistMesh.visible = !lowSpec;
    groundMistMesh.renderOrder = 3;
    group.add(groundMistMesh);
  }

  // --------------------------------------------------------------------------
  // 4. Cathedral Dust Motes [1 DC, 100% GPU Points]
  // --------------------------------------------------------------------------
  const dustBuild = buildCathedralDustMotes(raySpecs, { rooms, bossCenter, bossRadius }, isMobile, lowSpec);
  trackGeo(dustBuild.geo);
  trackMat(dustBuild.material);
  const dustMotesPoints = dustBuild.points;
  const dustUniforms = dustBuild.uniforms;
  group.add(dustMotesPoints);

  // --------------------------------------------------------------------------
  // Runtime Intensity, LowSpec, Per-Frame Update & Zero-Leak Disposal
  // --------------------------------------------------------------------------
  let baseGodRayIntensity = 1.0;
  let baseMistIntensity = 1.0;
  let baseDustIntensity = 1.0;
  let baseAoStrength = 1.0;
  let baseFireScatterIntensity = 1.0;
  let baseHaloIntensity = 1.0;
  let internalTime = 0;

  function applyLowSpecState() {
    godRayUniforms.uLowSpec.value = lowSpec ? 1.0 : 0.0;
    if (scatterUniforms) scatterUniforms.uLowSpec.value = lowSpec ? 1.0 : 0.0;

    const targetDust = lowSpec ? DUST_COUNT_LOWSPEC : (isMobile ? DUST_COUNT_MOBILE : DUST_COUNT_PC);
    dustBuild.geo.setDrawRange(0, targetDust);
    dustMotesPoints.visible = targetDust > 0;

    if (isMobile) {
      if (mobileFloorGeo) {
        mobileFloorGeo.setDrawRange(0, lowSpec ? mobileAoVertexCount : mobileTotalVertexCount);
      }
      if (mobileAdditiveGeo) {
        mobileAdditiveGeo.setDrawRange(0, lowSpec ? mobileGodRayVertexCount : mobileAdditiveTotalVertexCount);
      }
    } else {
      if (groundMistMesh) groundMistMesh.visible = !lowSpec;
      if (firelightScatterMesh) firelightScatterMesh.visible = !lowSpec;
    }
  }

  function setLowSpec(enabled = false) {
    if (disposed) return;
    const next = Boolean(enabled);
    if (next === lowSpec) return;
    lowSpec = next;
    applyLowSpecState();
  }

  function setIntensity(cfg = {}) {
    if (disposed || !cfg) return;
    if (Number.isFinite(cfg.godRays)) {
      baseGodRayIntensity = Math.max(0, cfg.godRays);
      godRayUniforms.uGodRayIntensity.value = baseGodRayIntensity;
    }
    if (Number.isFinite(cfg.mist)) {
      baseMistIntensity = Math.max(0, cfg.mist);
      if (mistUniforms) mistUniforms.uMistIntensity.value = baseMistIntensity;
    }
    if (Number.isFinite(cfg.dust)) {
      baseDustIntensity = Math.max(0, cfg.dust);
      dustUniforms.uIntensity.value = baseDustIntensity;
    }
    if (Number.isFinite(cfg.ao)) {
      baseAoStrength = Math.max(0, cfg.ao);
      if (aoUniforms) aoUniforms.uAoStrength.value = baseAoStrength;
    }
    if (Number.isFinite(cfg.fireScatter)) {
      baseFireScatterIntensity = Math.max(0, cfg.fireScatter);
      if (scatterUniforms) scatterUniforms.uFireScatterIntensity.value = baseFireScatterIntensity;
    }
    if (Number.isFinite(cfg.halos)) {
      baseHaloIntensity = clamp01(cfg.halos);
      if (scatterUniforms) scatterUniforms.uHaloIntensity.value = baseHaloIntensity;
    }
  }

  function update(time = 0, dt = 0.016, frameOpts = null) {
    if (disposed || !group.visible) return;
    const safeDt = Number.isFinite(dt) ? Math.min(Math.max(dt, 0.001), 0.1) : 0.016;
    const t = Number.isFinite(time) ? time : (internalTime += safeDt);
    internalTime = t;

    const doorProg = frameOpts && Number.isFinite(frameOpts.doorOpenProgress)
      ? clamp01(frameOpts.doorOpenProgress)
      : 0.0;

    godRayUniforms.uTime.value = t;
    godRayUniforms.uGodRayIntensity.value = baseGodRayIntensity * (1.0 + doorProg * 0.14);

    if (!lowSpec) {
      if (scatterUniforms && scatterUniforms !== godRayUniforms) {
        scatterUniforms.uTime.value = t;
      }
      if (mistUniforms) {
        mistUniforms.uTime.value = t;
        mistUniforms.uDoorSurge.value = doorProg;
      }
      dustUniforms.uTime.value = t;
    }
  }

  function getStats() {
    const dustCount = lowSpec ? DUST_COUNT_LOWSPEC : (isMobile ? DUST_COUNT_MOBILE : DUST_COUNT_PC);
    const activeDrawCalls = isMobile
      ? ((godRayMesh && godRayMesh.visible ? 1 : 0) +
         (mobileFloorMesh && mobileFloorMesh.visible ? 1 : 0) +
         (dustMotesPoints.visible ? 1 : 0))
      : ((staticContactAoMesh && staticContactAoMesh.visible ? 1 : 0) +
         (firelightScatterMesh && firelightScatterMesh.visible ? 1 : 0) +
         (groundMistMesh && groundMistMesh.visible ? 1 : 0) +
         (godRayMesh && godRayMesh.visible ? 1 : 0) +
         (dustMotesPoints.visible ? 1 : 0));

    return {
      isMobile,
      lowSpec,
      drawCalls: isMobile ? 3 : 5,
      activeDrawCalls,
      godRayCount: raySpecs.length,
      fireScatterQuadCount: lowSpec ? 0 : scatterQuadCount,
      maxHaloOpacity: HARD_HALO_ALPHA_CAP,
      mistZones: mistZones.length,
      mistLayers: lowSpec ? 0 : (isMobile ? 2 : 3),
      mistOctaves: lowSpec ? 0 : (isMobile ? 2 : 3),
      dustCount,
      staticAoCount: aoPads.length,
      bossRadius,
      bossDoorZ,
      disposed
    };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (let i = 0; i < ownedGeos.length; i++) ownedGeos[i]?.dispose?.();
    for (let i = 0; i < ownedMats.length; i++) ownedMats[i]?.dispose?.();
    for (let i = 0; i < ownedTex.length; i++) ownedTex[i]?.dispose?.();
    ownedGeos.length = 0;
    ownedMats.length = 0;
    ownedTex.length = 0;
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }
  }

  void trackTex;

  return {
    group,
    godRayMesh,
    firelightScatterMesh,
    groundMistMesh,
    dustMotesPoints,
    staticContactAoMesh,
    update,
    setLowSpec,
    setIntensity,
    getStats,
    dispose
  };
}
