// Cinematic Castle Atmosphere & Depth Lighting VFX for Chapter 26 — «Abandoned Knight Rift»
// Pass 2 Synchronized Edition (Expanded 36m x 10m Corridor, R = 16.0 Boss Cathedral, Bonfire (0, 32.5),
// Throne (0, -41.6), Boss Doors z = -16.0 — directly synced with js/souls/soulsCastleLayout.js!).
// Pure Vanilla ES module (Three.js r160, 0 DOM dependency, V8/Browser/Mobile compatible).
//
// Draw-Call Budget (strictly <= 4 DC PC / <= 3 DC Mobile / <= 2 DC LowSpec!):
//   - PC (4 DC):
//       1. godRayMesh          (1 DC) — 8 merged Volumetric Moonlit God-Ray Shafts (SOULS_CASTLE_CLERESTORY_SHAFTS, Fresnel dot(N,V) fade)
//       2. groundMistMesh      (1 DC) — 3-layer drifting procedural FBM ground mist (y = 0.10..0.50, 3 octaves unrolled) across all 4 chambers
//       3. dustMotesPoints     (1 DC) — 120 GPU cathedral golden-blue dust motes in air currents
//       4. staticContactAoMesh (1 DC) — Merged analytical Contact AO shadows under pillars, braziers, bonfire, shrine, alcove decor, throne & portal jambs
//   - Mobile (3 DC):
//       1. godRayMesh          (1 DC) — 8 merged moonlit shafts (mobile-optimized cone tessellation)
//       2. floorAtmosMesh      (1 DC) — Single merged NormalBlending batch: Static Contact AO + 2-layer 2-octave FBM Ground Mist
//       3. dustMotesPoints     (1 DC) — 55 GPU cathedral dust motes evenly distributed across all 4 halls
//   - LowSpec (2 DC):
//       - Dust motes = 0 (hidden), Ground Mist = OFF (0 fragment cost), Static Contact AO = ON (1 DC), simplified 0-noise God-Rays = ON (1 DC).
//
// Plus exported `createActorContactShadowMesh(optionsOrRadius)` for `models.js` (Hero, Mobs, Boss)
// with ref-counted shared unit geometry & procedural DataTexture (0 WebGL leaks!).

import * as THREE from '../../vendor/three.module.js';
import { mergeGeometries } from '../../vendor/BufferGeometryUtils.js';
import {
  SOULS_CASTLE_CONSTANTS,
  SOULS_CASTLE_ROOMS,
  SOULS_CASTLE_BONFIRE,
  SOULS_CASTLE_THRONE_CONFIG,
  SOULS_CASTLE_WALL_SEGMENTS,
  SOULS_CASTLE_PILLARS,
  SOULS_CASTLE_BRAZIERS,
  SOULS_CASTLE_RELICS,
  SOULS_CASTLE_CLERESTORY_SHAFTS,
  SOULS_CASTLE_ALCOVE_DECOR
} from './soulsCastleLayout.js?v=20261121z64';

const DUST_COUNT_PC = 120;
const DUST_COUNT_MOBILE = 55;
const DUST_COUNT_LOWSPEC = 0;

// ============================================================================
// Internal Deterministic Helpers & Layout Normalizers
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
  const src = Array.isArray(customSpecs) && customSpecs.length > 0
    ? customSpecs
    : SOULS_CASTLE_CLERESTORY_SHAFTS;
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
          : (Number.isFinite(s.opacity) ? Math.min(1.32, Math.max(0.76, s.opacity / 0.135)) : 1.0)
      })
    );
  }
  return Object.freeze(out);
}

// Canonical Volumetric Moonlit God-Ray Shafts directly synced 1:1 with SOULS_CASTLE_CLERESTORY_SHAFTS (8 shafts)
export const CASTLE_GOD_RAY_SPECS = normalizeRaySpecs(SOULS_CASTLE_CLERESTORY_SHAFTS);

// ============================================================================
// 1. Volumetric Moonlit God-Ray Shafts Geometry & GLSL Shader (1 DC)
// ============================================================================
function buildGodRayShaftsGeometry(raySpecs, isMobile) {
  const parts = [];
  const radialSegsOuter = isMobile ? 12 : 18;
  const radialSegsInner = isMobile ? 10 : 14;
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

    // Two coaxial shells per shaft merged into 1 single BufferGeometry:
    //   Shell 0 = broad soft atmospheric Tyndall scatter veil
    //   Shell 1 = defined inner lunar beam core
    const shells = isMobile
      ? [
          { rMulTop: 1.14, rMulBot: 1.22, coreFlag: 0.0, segs: radialSegsOuter },
          { rMulTop: 0.62, rMulBot: 0.68, coreFlag: 1.0, segs: radialSegsInner }
        ]
      : [
          { rMulTop: 1.18, rMulBot: 1.26, coreFlag: 0.0, segs: radialSegsOuter },
          { rMulTop: 0.62, rMulBot: 0.68, coreFlag: 1.0, segs: radialSegsInner }
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

      const shaftInfo = new Float32Array(count * 4);
      const shaftColor = new Float32Array(count * 3);

      for (let v = 0; v < count; v++) {
        // Compute local polar angle BEFORE world transform so gothic mullion bands stay cylinder-aligned
        const lx = pos.getX(v);
        const lz = pos.getZ(v);
        const angle = Math.atan2(lz, lx);
        // CylinderGeometry uv.y = 1.0 at top (window), 0.0 at bottom (floor)
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

      // Rigid rotation + translation transforms both positions and outward normals cleanly
      g.applyMatrix4(xform);
      g.deleteAttribute('uv');
      g.setAttribute('aShaftInfo', new THREE.BufferAttribute(shaftInfo, 4));
      g.setAttribute('aShaftColor', new THREE.BufferAttribute(shaftColor, 3));
      parts.push(g);
    }
  }

  if (!parts.length) return null;
  const merged = mergeGeometries(parts, false);
  for (let i = 0; i < parts.length; i++) parts[i].dispose();
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

function createGodRayShaderMaterial(lowSpec) {
  const uniforms = {
    uTime: { value: 0 },
    uIntensity: { value: 1.0 },
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
      uniform float uIntensity;
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

        // Smooth Fresnel edge fade via dot(N, V) — completely removes hard cone edges
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        float ndotv = max(dot(N, V), 0.0);
        float fresnelExp = mix(2.18, 1.42, coreFlag);
        float fresnel = pow(max(ndotv, 1e-4), fresnelExp) * smoothstep(0.0, 0.04, ndotv);

        // Soft entry near upper gothic window + gradual atmospheric falloff down to flagstones
        float topSoft = smoothstep(0.0, 0.12, along);
        float lengthFalloff = pow(max(1.0 - along, 1e-4), 0.92) * smoothstep(1.0, 0.72, along);
        float floorFade = smoothstep(0.05, 1.08, vWorldPos.y);

        // Camera proximity & extended distant fog fade (safe for 36m corridor vistas & 51.3s cutscene)
        float nearFade = smoothstep(1.15, 3.85, vViewDist);
        float farFade = smoothstep(98.0, 32.0, vViewDist);

        // Subtle gothic lancet mullion striping + animated airborne dust shimmer
        float mullion = 0.80 + 0.20 * sin(angle * 3.0 + phase * 1.7);
        float shimmer = 1.0;
        if (uLowSpec < 0.5) {
          vec2 uvA = vec2(angle * 1.15 + uTime * 0.05 + phase, along * 3.5 - uTime * 0.15);
          vec2 uvB = vec2(vWorldPos.x * 0.36 - uTime * 0.075, vWorldPos.y * 0.44 + vWorldPos.z * 0.24 - uTime * 0.105);
          float n1 = vnoise(uvA);
          float n2 = vnoise(uvB);
          float dustVeil = 0.76 + (n1 * 0.60 + n2 * 0.40) * 0.56;
          float glints = smoothstep(0.70, 0.98, vnoise(uvB * 2.3 + vec2(uTime * 0.13, -uTime * 0.17))) * 0.30 * coreFlag;
          shimmer = dustVeil + glints;
        }

        // Cool moonlit blue (#8cb8ff..#b6ccf5) core shifting from pale lunar silver at window to deep twilight blue near floor
        vec3 silverTop = mix(vShaftColor, vec3(0.86, 0.94, 1.0), 0.40);
        vec3 deepBottom = vShaftColor * vec3(0.84, 0.92, 1.06);
        vec3 beamCol = mix(silverTop, deepBottom, smoothstep(0.08, 0.85, along));

        float layerGain = mix(0.105, 0.195, coreFlag);
        float alpha = clamp(
          layerGain * fresnel * topSoft * lengthFalloff * floorFade * nearFade * farFade * mullion * shimmer * uIntensity,
          0.0,
          0.42
        );

        gl_FragColor = vec4(beamCol, alpha);
      }
    `
  });

  return { material, uniforms };
}

// ============================================================================
// 2. Layered Drifting Ground Mist & Static Contact AO Geometry Builders
// ============================================================================
function buildMistZones({ rooms, bossCenter, bossRadius }) {
  const court = rooms.courtyard || SOULS_CASTLE_ROOMS.courtyard;
  const corr = rooms.corridor || SOULS_CASTLE_ROOMS.corridor;
  const alcove = rooms.east_alcove || SOULS_CASTLE_ROOMS.east_alcove;

  const courtW = Math.max(4.0, (court.maxX - court.minX) - 0.8);
  const courtD = Math.max(4.0, (court.maxZ - court.minZ) - 0.8);
  const courtCx = (court.minX + court.maxX) * 0.5;
  const courtCz = (court.minZ + court.maxZ) * 0.5;

  // Split the expanded 36m x 10m corridor into 2 overlapping ribbons so mist stays rich
  // from the Grand Arch (z = +20) past the 3 Flame Traps all the way to the Boss Doors (z = -16)!
  const corrW = Math.max(3.5, (corr.maxX - corr.minX) - 0.6);
  const corrCx = (corr.minX + corr.maxX) * 0.5;
  const corrMidZ = (corr.minZ + corr.maxZ) * 0.5; // +2.0 for [-16, +20]
  const corrOverlap = 2.6;
  const corrSouthMinZ = corrMidZ - corrOverlap;
  const corrSouthMaxZ = corr.maxZ + 0.2;
  const corrNorthMinZ = corr.minZ - 0.2;
  const corrNorthMaxZ = corrMidZ + corrOverlap;

  const alcoveW = Math.max(3.0, (alcove.maxX - alcove.minX) - 0.6);
  const alcoveD = Math.max(3.0, (alcove.maxZ - alcove.minZ) - 0.6);
  const alcoveCx = (alcove.minX + alcove.maxX) * 0.5;
  const alcoveCz = (alcove.minZ + alcove.maxZ) * 0.5;

  const bossDiam = Math.max(10.0, (bossRadius - 0.35) * 2.0);

  return [
    // Zone A: Bonfire Hall (Courtyard) — carves around hot Bonfire while mist hugs columns & arch
    {
      id: 'mist_courtyard',
      cx: courtCx,
      cz: courtCz,
      width: courtW,
      depth: courtD,
      density: 0.88,
      zoneType: 0.0, // Soft rounded-rect fade
      seed: 0.17
    },
    // Zone B1: South & Mid 36m Corridor (Grand Arch -> Flame Traps -> East Alcove Junction)
    {
      id: 'mist_corridor_south_mid',
      cx: corrCx,
      cz: (corrSouthMinZ + corrSouthMaxZ) * 0.5,
      width: corrW,
      depth: Math.max(4.0, corrSouthMaxZ - corrSouthMinZ),
      density: 0.86,
      zoneType: 0.0,
      seed: 1.49
    },
    // Zone B2: North Corridor & Boss Door Threshold (deepens right in front of Twin Boss Doors at z = -16!)
    {
      id: 'mist_corridor_doors',
      cx: corrCx,
      cz: (corrNorthMinZ + corrNorthMaxZ) * 0.5,
      width: corrW,
      depth: Math.max(4.0, corrNorthMaxZ - corrNorthMinZ),
      density: 0.96,
      zoneType: 0.0,
      seed: 2.31
    },
    // Zone C: East Alcove (Armory Chapel)
    {
      id: 'mist_east_alcove',
      cx: alcoveCx,
      cz: alcoveCz,
      width: alcoveW,
      depth: alcoveD,
      density: 0.78,
      zoneType: 0.0,
      seed: 4.19
    },
    // Zone D: Enlarged Boss Throne Hall Perimeter (R = 16.0, annular ring keeps central duel area crystal clear!)
    {
      id: 'mist_boss_perimeter',
      cx: bossCenter.x,
      cz: bossCenter.z,
      width: bossDiam,
      depth: bossDiam,
      density: 1.0,
      zoneType: 1.0, // Circular annular perimeter mask
      seed: 5.73
    }
  ];
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

  // 1. All Gothic Pillars (rounded-square AO matching 1.74 x 1.74 stone plinth bases)
  for (let i = 0; i < pillars.length; i++) {
    const p = pillars[i];
    const isBossHall = p.roomId === 'boss_hall' || p.z < bossDoorZ;
    const baseR = (p.radius || 0.85) * 2.12;
    pads.push({
      x: p.x,
      y: isBossHall ? 0.006 : 0.010,
      z: p.z,
      rx: baseR,
      rz: baseR,
      strength: 0.90,
      shapePower: 2.85,
      inner: 0.44
    });
  }

  // 2. All Standing Floor Lantern Braziers (circular radial AO under stone pedestals)
  for (let i = 0; i < braziers.length; i++) {
    const b = braziers[i];
    const isBossHall = b.roomId === 'boss_hall' || b.z < bossDoorZ;
    const sc = b.scale || 1.0;
    const rad = 1.22 * sc;
    pads.push({
      x: b.x,
      y: isBossHall ? 0.006 : 0.010,
      z: b.z,
      rx: rad,
      rz: rad,
      strength: 0.86,
      shapePower: 2.0,
      inner: 0.34
    });
  }

  // 3. Hero Bonfire at (0, 32.5) (scorch & contact occlusion shadow bedding the 10-stone ash ring)
  pads.push({
    x: bonfire.x,
    y: 0.010,
    z: bonfire.z,
    rx: 2.25,
    rz: 2.25,
    strength: 0.78,
    shapePower: 2.0,
    inner: 0.46
  });

  // 4. Relic Shrines (East Alcove Altar at (12.2, -0.4))
  for (let i = 0; i < relics.length; i++) {
    const rel = relics[i];
    const rad = (rel.radius || rel.colliderRadius || 0.85) * 1.90;
    pads.push({
      x: rel.x,
      y: 0.010,
      z: rel.z,
      rx: rad,
      rz: rad * 1.08,
      strength: 0.82,
      shapePower: 2.5,
      inner: 0.38
    });
  }

  // 5. East Alcove Floor Armory Props (2 weapon racks + 2 armor stands)
  for (let i = 0; i < alcoveDecor.length; i++) {
    const prop = alcoveDecor[i];
    if (prop.collider === false) continue;
    const rx = prop.rx || (prop.width ? prop.width * 0.72 : (prop.radius || 0.5) * 1.75);
    const rz = prop.rz || (prop.depth ? prop.depth * 1.05 : (prop.radius || 0.5) * 1.75);
    pads.push({
      x: prop.x,
      y: 0.010,
      z: prop.z,
      rx,
      rz,
      strength: prop.strength ?? 0.68,
      shapePower: prop.shapePower ?? 2.4,
      inner: prop.inner ?? 0.32
    });
  }

  // 6. Obsidian Throne + Ceremonial Stepped Dais at (0, -41.6)
  const tx = throne.x;
  const tz = throne.z;
  // Wide dais perimeter footprint contact shadow on Boss Hall floor (y = -0.004 -> pad at 0.006)
  pads.push({
    x: tx,
    y: 0.006,
    z: tz - 0.05,
    rx: 4.55,
    rz: 3.15,
    strength: 0.84,
    shapePower: 3.0,
    inner: 0.62
  });
  // Stepped dais front tread crease (z = tz + 2.95)
  pads.push({
    x: tx,
    y: 0.007,
    z: tz + 2.95,
    rx: 3.45,
    rz: 1.05,
    strength: 0.58,
    shapePower: 2.8,
    inner: 0.42
  });
  // Direct contact AO beneath the Obsidian Throne base sitting on the dais deck (dais top y = 0.06 -> pad at 0.068)
  pads.push({
    x: tx,
    y: 0.068,
    z: tz - 0.15,
    rx: 2.25,
    rz: 1.85,
    strength: 0.88,
    shapePower: 2.6,
    inner: 0.46
  });

  // 7. Boss Door Monumental Stone Jambs & East Alcove Interior Archway Piers (synced directly from wallSegments!)
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
        rx: (seg.length || 3.0) * 0.60,
        rz: 1.25,
        strength: 0.74,
        shapePower: 2.8,
        inner: 0.42
      });
    } else if (seg.role === 'interior_pier') {
      pads.push({
        x: seg.x,
        y: 0.010,
        z: seg.z,
        rx: (seg.thickness || 0.8) * 1.35,
        rz: (seg.length || 2.1) * 0.64,
        strength: 0.68,
        shapePower: 2.8,
        inner: 0.38
      });
    }
  }
  if (addedJambs === 0) {
    const jambX = (SOULS_CASTLE_CONSTANTS.BOSS_PORTAL_HALF_W + SOULS_CASTLE_CONSTANTS.CORRIDOR_HALF_W + 1.2) * 0.5;
    pads.push(
      { x: -jambX, y: 0.010, z: bossDoorZ + 0.65, rx: 1.85, rz: 1.25, strength: 0.74, shapePower: 2.8, inner: 0.42 },
      { x:  jambX, y: 0.010, z: bossDoorZ + 0.65, rx: 1.85, rz: 1.25, strength: 0.74, shapePower: 2.8, inner: 0.42 }
    );
  }

  return pads;
}

// Unified floor geometry builder:
//   - On PC: builds dedicated Static Contact AO geometry AND dedicated 3-layer Mist geometry (2 clean shaders)
//   - On Mobile: builds ONE combined geometry [AO verts..., Mist verts...] (1 single Draw Call!
//     and LowSpec cleanly slices `setDrawRange(0, aoVertexCount)` for 0 mist GPU cost!)
function buildAoParts(aoPads) {
  const parts = [];
  for (let i = 0; i < aoPads.length; i++) {
    const pad = aoPads[i];
    const raw = new THREE.PlaneGeometry(pad.rx * 2, pad.rz * 2, 1, 1);
    raw.rotateX(-Math.PI / 2);
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
  // Stacked volumetric heights within y = 0.08..0.55 (3 layers PC / 2 layers Mobile)
  const layerSpecs = isMobile
    ? [
        { y: 0.12, hFrac: 0.0, weight: 1.00 },
        { y: 0.38, hFrac: 1.0, weight: 0.72 }
      ]
    : [
        { y: 0.10, hFrac: 0.0, weight: 1.00 },
        { y: 0.28, hFrac: 0.5, weight: 0.80 },
        { y: 0.50, hFrac: 1.0, weight: 0.58 }
      ];

  for (let l = 0; l < layerSpecs.length; l++) {
    const layer = layerSpecs[l];
    for (let zIdx = 0; zIdx < mistZones.length; zIdx++) {
      const zone = mistZones[zIdx];
      // Slight horizontal offset between stacked layers breaks vertical alignment for lush 3D parallax
      const driftShiftX = (l - 1) * 0.25;
      const driftShiftZ = (l - 1) * -0.22;
      const raw = new THREE.PlaneGeometry(zone.width, zone.depth, 1, 1);
      raw.rotateX(-Math.PI / 2);
      raw.translate(zone.cx + driftShiftX, layer.y, zone.cz + driftShiftZ);
      const g = toNonIndexedClean(raw, true, false);
      const count = g.attributes.position.count;
      const meta = new Float32Array(count * 4);
      const zoneDensity = zone.density * layer.weight;
      const packedMeta = zone.zoneType > 0.5 ? 2.0 : 1.0; // 1 = rect mist, 2 = annular boss-hall mist
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

// Unrolled FBM GLSL chunk (strictly 2 octaves Mobile / 3 octaves PC, ZERO variable-length loops!)
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
      float sum = vnoise(p) * 0.58;
      p = mat2(0.80, -0.60, 0.60, 0.80) * p * 2.03 + vec2(17.1, 31.7);
      sum += vnoise(p) * 0.30;
      ${isMobile ? '' : `
      p = mat2(0.80, -0.60, 0.60, 0.80) * p * 2.02 + vec2(9.4, 13.8);
      sum += vnoise(p) * 0.12;
      `}
      return sum;
    }
  `;
}

// Shared mist evaluation GLSL snippet (ZERO discard, smooth Bonfire warm rim & Boss Door surge)
function getMistEvalGlsl(isMobile) {
  const layerAlphaScale = isMobile ? '0.32' : '0.24';
  return `
    float hFrac = vFloorMeta.x;
    float density = vFloorMeta.y;
    float seed = vFloorMeta.z;
    float isAnnular = step(1.5, vFloorMeta.w);

    // 1. Spatial zone mask (never touches walls; Boss Hall keeps central duel circle crystal clear!)
    vec2 centered = vUv * 2.0 - 1.0;
    vec2 absC = abs(centered);
    float rectMask = (1.0 - smoothstep(0.70, 1.0, absC.x)) * (1.0 - smoothstep(0.76, 1.0, absC.y));

    float rad = length(centered);
    float ringOuter = 1.0 - smoothstep(0.72, 1.0, rad);
    float ringInner = mix(0.14, 1.0, smoothstep(0.28, 0.58, rad));
    // Dynamically clip Boss Hall mist cleanly along the south doorway wall (z = uBossDoorZ - 0.15) outside the portal width
    float southWallKeep = 1.0 - smoothstep(uBossDoorZ - 0.95, uBossDoorZ - 0.15, vWorldPos.z) * smoothstep(2.8, 3.8, abs(vWorldPos.x));
    float bossMask = ringOuter * ringInner * southWallKeep;

    float zoneMask = mix(rectMask, bossMask, isAnnular);

    // 2. World-space slow counter-drifting procedural FBM wisps
    vec2 wp = vWorldPos.xz;
    float t = uTime * 0.11;
    vec2 uv1 = wp * 0.175 + vec2(t * 0.85 + seed * 0.4, -t * 0.45 - hFrac * 0.6);
    float n1 = fbmMist(uv1);
    vec2 uv2 = wp * 0.275 + vec2(-t * 0.55 + n1 * 0.45, t * 0.36 + seed * 0.3);
    float n2 = fbmMist(uv2);
    float cloud = smoothstep(0.20 + hFrac * 0.08, 0.74, n1 * 0.58 + n2 * 0.42);

    // 3. Bonfire thermal dissipation + warm amber firelight rim scatter
    float dBonfire = length(wp - uBonfirePos);
    float bonfireClear = mix(0.16, 1.0, smoothstep(1.5, 4.1, dBonfire));
    float bonfireWarm = smoothstep(7.2, 2.2, dBonfire) * smoothstep(1.1, 2.7, dBonfire);

    // 4. Eerie cold mist surge around the Twin Boss Doors threshold (z = uBossDoorZ)
    float dDoor = length(wp - vec2(0.0, uBossDoorZ + 0.2));
    float doorBoost = 1.0 + smoothstep(6.2, 0.8, dDoor) * (0.45 + uDoorSurge * 0.30);

    // 5. Perspective grazing damping + camera-near & extended far-fog fade
    vec3 V = normalize(cameraPosition - vWorldPos);
    float angleSoft = smoothstep(0.012, 0.10, abs(V.y));
    float nearFade = smoothstep(0.80, 2.5, vViewDist);
    float farFade = smoothstep(92.0, 28.0, vViewDist);

    // 6. Cold moonlit slate-blue mist palette with subtle Bonfire amber rim
    vec3 mistDeep = vec3(0.22, 0.30, 0.46);
    vec3 mistCrest = vec3(0.56, 0.70, 0.92);
    vec3 mistCol = mix(mistDeep, mistCrest, clamp(cloud * 0.85 + hFrac * 0.24, 0.0, 1.0));
    mistCol = mix(mistCol, vec3(0.84, 0.50, 0.26), bonfireWarm * 0.46);

    float mistAlpha = clamp(
      cloud * zoneMask * bonfireClear * doorBoost * density * angleSoft * nearFade * farFade * ${layerAlphaScale} * uMistIntensity,
      0.0,
      0.38
    );
  `;
}

// Shared analytical Contact AO evaluation GLSL snippet (ZERO texture fetches, ZERO discard!)
const AO_EVAL_GLSL = `
  vec2 q = abs(vUv * 2.0 - 1.0);
  float p = vFloorMeta.y;
  float dist = pow(pow(max(q.x, 1e-4), p) + pow(max(q.y, 1e-4), p), 1.0 / p);
  float inner = vFloorMeta.z;
  float tRad = clamp((dist - inner) / max(0.001, 0.98 - inner), 0.0, 1.0);
  float sCurve = 1.0 - tRad * tRad * (3.0 - 2.0 * tRad);
  float aoShape = sCurve * (0.44 + 0.56 * sCurve);
  float aoFarFade = smoothstep(98.0, 32.0, vViewDist);
  float aoAlpha = clamp(aoShape * vFloorMeta.x * uAoStrength * aoFarFade, 0.0, 0.92);
  vec3 aoCol = vec3(0.012, 0.016, 0.030);
`;

function createDedicatedMistMaterial(bonfire, bossDoorZ, isMobile) {
  const uniforms = {
    uTime: { value: 0 },
    uMistIntensity: { value: 1.0 },
    uDoorSurge: { value: 0.0 },
    uBonfirePos: { value: new THREE.Vector2(bonfire.x, bonfire.z) },
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

// Mobile-only combined Static AO + 2-Octave FBM Ground Mist material (saves 1 full Draw Call -> 3 DC total!)
function createMobileCombinedFloorMaterial(bonfire, bossDoorZ) {
  const uniforms = {
    uTime: { value: 0 },
    uMistIntensity: { value: 1.0 },
    uAoStrength: { value: 1.0 },
    uDoorSurge: { value: 0.0 },
    uBonfirePos: { value: new THREE.Vector2(bonfire.x, bonfire.z) },
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
        // Coherent per-triangle branch: AO pads skip FBM completely (5 ALU ops!)
        if (vFloorMeta.w < 0.5) {
          ${AO_EVAL_GLSL}
          gl_FragColor = vec4(aoCol, aoAlpha);
        } else {
          ${getMistEvalGlsl(true)}
          gl_FragColor = vec4(mistCol, mistAlpha);
        }
      }
    `
  });

  return { material, uniforms };
}

// ============================================================================
// 3. Cathedral Dust Motes (1 DC, 100% GPU Points — 120 PC / 55 Mobile / 0 LowSpec)
// ============================================================================
function buildCathedralDustMotes(raySpecs, { rooms, bossCenter, bossRadius }, isMobile, lowSpec) {
  const rng = makeRng(0xCA571E07);
  const maxCount = DUST_COUNT_PC;

  const positions = new Float32Array(maxCount * 3);
  const motion = new Float32Array(maxCount * 4);
  const style = new Float32Array(maxCount * 3);

  const court = rooms.courtyard || SOULS_CASTLE_ROOMS.courtyard;
  const corr = rooms.corridor || SOULS_CASTLE_ROOMS.corridor;
  const alcove = rooms.east_alcove || SOULS_CASTLE_ROOMS.east_alcove;

  // Dynamically sized to current room bounds (including expanded 36m corridor & R = 16.0 Boss Cathedral!)
  // Interleaved seeding guarantees slicing drawRange(0, 55) for Mobile covers EVERY hall & shaft evenly!
  const ambientVolumes = [
    {
      cx: (court.minX + court.maxX) * 0.5,
      cy: 3.0,
      cz: (court.minZ + court.maxZ) * 0.5,
      rx: Math.max(2.0, (court.maxX - court.minX) * 0.5 - 1.4),
      ry: 2.4,
      rz: Math.max(2.0, (court.maxZ - court.minZ) * 0.5 - 1.4),
      warmBias: 0.78
    },
    {
      cx: (corr.minX + corr.maxX) * 0.5,
      cy: 2.9,
      cz: (corr.minZ + corr.maxZ) * 0.5,
      rx: Math.max(1.5, (corr.maxX - corr.minX) * 0.5 - 1.0),
      ry: 2.2,
      rz: Math.max(4.0, (corr.maxZ - corr.minZ) * 0.5 - 1.4),
      warmBias: 0.44
    },
    {
      cx: (alcove.minX + alcove.maxX) * 0.5,
      cy: 2.7,
      cz: (alcove.minZ + alcove.maxZ) * 0.5,
      rx: Math.max(1.5, (alcove.maxX - alcove.minX) * 0.5 - 0.8),
      ry: 2.0,
      rz: Math.max(1.5, (alcove.maxZ - alcove.minZ) * 0.5 - 0.8),
      warmBias: 0.72
    },
    {
      cx: bossCenter.x,
      cy: 4.2,
      cz: bossCenter.z,
      rx: Math.max(4.0, bossRadius * 0.76),
      ry: 3.4,
      rz: Math.max(4.0, bossRadius * 0.76),
      warmBias: 0.48
    }
  ];

  const hasRays = raySpecs.length > 0;
  for (let i = 0; i < maxCount; i++) {
    let x, y, z, tint;

    // 65% inside the volumetric god-ray shafts (cool lunar blue-silver with subtle gold flecks),
    // 35% gently drifting across all 4 chambers (warmer candle/bonfire gold-blue mix)
    if (hasRays && (i % 3 !== 2)) {
      const ray = raySpecs[i % raySpecs.length];
      const t = 0.14 + rng() * 0.74;
      const cx = ray.origin[0] + (ray.target[0] - ray.origin[0]) * t;
      const cy = ray.origin[1] + (ray.target[1] - ray.origin[1]) * t;
      const cz = ray.origin[2] + (ray.target[2] - ray.origin[2]) * t;
      const coneR = (ray.topRadius + (ray.bottomRadius - ray.topRadius) * t) * 0.78;
      const ang = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * coneR;
      x = cx + Math.cos(ang) * r;
      y = Math.max(0.55, cy + (rng() - 0.5) * 0.55);
      z = cz + Math.sin(ang) * r;
      // Mostly moon-blue inside rays with 28% catching golden torch reflections
      tint = rng() < 0.28 ? (0.62 + rng() * 0.38) : (rng() * 0.34);
    } else {
      const vol = ambientVolumes[i % ambientVolumes.length];
      x = vol.cx + (rng() - 0.5) * 2.0 * vol.rx;
      y = Math.max(0.55, vol.cy + (rng() - 0.5) * 2.0 * vol.ry);
      z = vol.cz + (rng() - 0.5) * 2.0 * vol.rz;
      tint = rng() < vol.warmBias ? (0.55 + rng() * 0.45) : (rng() * 0.40);
    }

    const o3 = i * 3;
    positions[o3] = x;
    positions[o3 + 1] = y;
    positions[o3 + 2] = z;

    const o4 = i * 4;
    motion[o4] = 0.32 + rng() * 0.82;        // swirl radius (m)
    motion[o4 + 1] = 0.18 + rng() * 0.34;    // swirl speed
    motion[o4 + 2] = 0.24 + rng() * 0.62;    // vertical buoyant amplitude (m)
    motion[o4 + 3] = rng() * Math.PI * 2.0;  // phase seed

    style[o3] = 0.085 + rng() * 0.105;       // world-space point scale
    style[o3 + 1] = tint;                    // 0 = lunar blue, 1 = cathedral gold
    style[o3 + 2] = 1.15 + rng() * 2.10;     // twinkle speed
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aMotion', new THREE.BufferAttribute(motion, 4));
  geo.setAttribute('aStyle', new THREE.BufferAttribute(style, 3));
  // Explicit generous bounding box/sphere covering max swirl displacement so frustumCulled=true is 100% safe
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
      attribute vec3 aStyle;

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
        // Organic 3D cathedral draft currents (incommensurate frequencies, 0 CPU uploads)
        p.x += sin(t) * swirlR + cos(t * 0.53 + phase) * swirlR * 0.35;
        p.y += sin(t * 0.73 + phase * 1.3) * bobAmp + cos(t * 0.31) * bobAmp * 0.25;
        p.z += cos(t * 0.87 + phase * 0.7) * swirlR * 0.85;

        vec4 mvPos = modelViewMatrix * vec4(p, 1.0);
        float viewDist = -mvPos.z;

        float twinkle = 0.52 + 0.48 * sin(uTime * aStyle.z + phase * 2.7);
        float nearFade = smoothstep(0.85, 2.7, viewDist);
        float farFade = smoothstep(76.0, 24.0, viewDist);

        vTint = aStyle.y;
        vAlpha = twinkle * nearFade * farFade;

        float ptSize = (aStyle.x * 285.0 * uPixelRatio * (0.80 + 0.32 * twinkle)) / max(1.0, viewDist);
        gl_PointSize = clamp(ptSize, 1.8, 13.0);
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
        // Soft circular bokeh mote with zero hard square edges and zero discard
        float mask = 1.0 - smoothstep(0.18, 1.0, d);
        float core = exp(-d * d * 6.0);
        float shape = (core * 0.72 + mask * 0.28) * mask;

        vec3 moonBlue = vec3(0.64, 0.82, 1.00);
        vec3 warmGold = vec3(1.00, 0.86, 0.56);
        vec3 col = mix(moonBlue, warmGold, vTint);

        float alpha = clamp(shape * vAlpha * 0.84 * uIntensity, 0.0, 0.92);
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
// 4. Exported Helper for models.js: Actor Contact AO Shadow Disc (0 Leaks!)
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
      // Smooth dual-lobe contact AO: deep dark core under boots + feathery penumbra reaching exact 0 before border
      let a = 0.0;
      if (r < 0.96) {
        const t = r / 0.96;
        const s = 1.0 - t * t * (3.0 - 2.0 * t);
        const core = Math.exp(-r * r * 5.2);
        a = clamp01(s * 0.52 + core * s * 0.48);
      }
      const idx = (row + x) * 4;
      // White RGB (tinted cleanly by material.color), alpha carries radial AO falloff
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

/**
 * Forces immediate cleanup of shared actor contact-shadow geometry & texture cache.
 * Normally unnecessary because every actor shadow auto-decrements ref-count when disposed.
 */
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

/**
 * Creates a soft radial Contact Ambient Occlusion shadow disc to attach under Hero, Mobs, or Boss in `models.js`.
 *
 * Accepts either a numeric radius (`createActorContactShadowMesh(0.95)`) or an options object:
 *   `{ radius = 0.88, radiusZ = null, opacity = 0.66, color = 0x060812, yOffset = 0.014, isBoss = false }`
 *
 * Returns a `THREE.Mesh` ready for `actorRoot.add(mesh)` with helper methods on `mesh.userData`:
 *   - `setShadowScale(rx, rz?)`
 *   - `setShadowOpacity(opacity)`
 *   - `setAirborneHeight(heightY)` (softens & gently expands shadow during jump / Leap_Slam)
 *   - `dispose()` (also triggers automatically if caller disposes `mesh.material` directly!)
 */
export function createActorContactShadowMesh(optionsOrRadius = {}) {
  const isNum = typeof optionsOrRadius === 'number' && Number.isFinite(optionsOrRadius);
  const opts = isNum ? { radius: optionsOrRadius } : (optionsOrRadius || {});
  const isBoss = Boolean(opts.isBoss);

  const baseRadiusX = Number.isFinite(opts.radius)
    ? Math.max(0.15, opts.radius)
    : (isBoss ? 1.85 : 0.88);
  const baseRadiusZ = Number.isFinite(opts.radiusZ)
    ? Math.max(0.15, opts.radiusZ)
    : baseRadiusX;
  const baseOpacity = Number.isFinite(opts.opacity)
    ? clamp01(opts.opacity)
    : (isBoss ? 0.76 : 0.66);
  const yOffset = Number.isFinite(opts.yOffset) ? opts.yOffset : 0.014;
  const colorHex = Number.isFinite(opts.color) ? opts.color : 0x060812;

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
      mat.dispose(); // Triggers onMaterialDispose -> decrements ref-count once
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

  const rooms = opts.rooms || SOULS_CASTLE_ROOMS;
  const bonfire = opts.bonfire || SOULS_CASTLE_BONFIRE;
  const throne = opts.throne || SOULS_CASTLE_THRONE_CONFIG;
  const bossCenter = {
    x: Number.isFinite(opts.bossCenter?.x) ? opts.bossCenter.x : SOULS_CASTLE_CONSTANTS.BOSS_CENTER_X,
    z: Number.isFinite(opts.bossCenter?.z) ? opts.bossCenter.z : SOULS_CASTLE_CONSTANTS.BOSS_CENTER_Z
  };
  const bossRadius = Number.isFinite(opts.bossRadius)
    ? opts.bossRadius
    : (Number.isFinite(opts.bossCenter?.radius) ? opts.bossCenter.radius : SOULS_CASTLE_CONSTANTS.BOSS_RADIUS);
  const bossDoorZ = Number.isFinite(opts.bossDoorZ) ? opts.bossDoorZ : SOULS_CASTLE_CONSTANTS.BOSS_DOOR_Z;

  const pillars = Array.isArray(opts.pillars) ? opts.pillars : SOULS_CASTLE_PILLARS;
  const braziers = Array.isArray(opts.braziers) ? opts.braziers : SOULS_CASTLE_BRAZIERS;
  const relics = Array.isArray(opts.relics) ? opts.relics : SOULS_CASTLE_RELICS;
  const alcoveDecor = Array.isArray(opts.alcoveDecor) ? opts.alcoveDecor : SOULS_CASTLE_ALCOVE_DECOR;
  const wallSegments = Array.isArray(opts.wallSegments) ? opts.wallSegments : SOULS_CASTLE_WALL_SEGMENTS;
  const raySpecs = normalizeRaySpecs(opts.godRaySpecs || opts.clerestoryShafts);

  // --------------------------------------------------------------------------
  // 1. Volumetric Moonlit God-Ray Shafts [1 DC]
  // --------------------------------------------------------------------------
  const godRayGeo = trackGeo(buildGodRayShaftsGeometry(raySpecs, isMobile));
  const { material: godRayMat, uniforms: godRayUniforms } = createGodRayShaderMaterial(lowSpec);
  trackMat(godRayMat);

  const godRayMesh = new THREE.Mesh(godRayGeo, godRayMat);
  godRayMesh.name = 'CastleMoonlitGodRays';
  godRayMesh.castShadow = false;
  godRayMesh.receiveShadow = false;
  godRayMesh.frustumCulled = true;
  godRayMesh.renderOrder = 4;
  group.add(godRayMesh);

  // --------------------------------------------------------------------------
  // 2 & 4. Layered Drifting Ground Mist + Static Contact AO Shadows
  //        PC:     2 dedicated meshes (staticContactAoMesh [1 DC] + groundMistMesh [1 DC])
  //        Mobile: 1 merged NormalBlending mesh [1 DC] (keeps Mobile total <= 3 DC!)
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
    // PC Dedicated Static Contact AO [1 DC]
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

    // PC Dedicated 3-Layer Drifting FBM Ground Mist [1 DC]
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
  // 3. Cathedral Dust Motes [1 DC, 100% GPU Points]
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
  let internalTime = 0;

  function applyLowSpecState() {
    godRayUniforms.uLowSpec.value = lowSpec ? 1.0 : 0.0;

    const targetDust = lowSpec ? DUST_COUNT_LOWSPEC : (isMobile ? DUST_COUNT_MOBILE : DUST_COUNT_PC);
    dustBuild.geo.setDrawRange(0, targetDust);
    dustMotesPoints.visible = targetDust > 0;

    if (isMobile && mobileFloorGeo) {
      // Slice out mist vertices cleanly on LowSpec while keeping Static Contact AO 100% intact!
      mobileFloorGeo.setDrawRange(0, lowSpec ? mobileAoVertexCount : mobileTotalVertexCount);
    } else if (groundMistMesh) {
      groundMistMesh.visible = !lowSpec;
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
      godRayUniforms.uIntensity.value = baseGodRayIntensity;
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
  }

  function update(time = 0, dt = 0.016, frameOpts = null) {
    if (disposed || !group.visible) return;
    const safeDt = Number.isFinite(dt) ? Math.min(Math.max(dt, 0.001), 0.1) : 0.016;
    const t = Number.isFinite(time) ? time : (internalTime += safeDt);
    internalTime = t;

    // Optional Boss Door cutscene surge (100% zero-allocation, fully optional!)
    const doorProg = frameOpts && Number.isFinite(frameOpts.doorOpenProgress)
      ? clamp01(frameOpts.doorOpenProgress)
      : 0.0;

    godRayUniforms.uTime.value = t;
    godRayUniforms.uIntensity.value = baseGodRayIntensity * (1.0 + doorProg * 0.16);

    if (!lowSpec) {
      if (mistUniforms) {
        mistUniforms.uTime.value = t;
        mistUniforms.uDoorSurge.value = doorProg;
      }
      dustUniforms.uTime.value = t;
    }
  }

  function getStats() {
    const dustCount = lowSpec ? DUST_COUNT_LOWSPEC : (isMobile ? DUST_COUNT_MOBILE : DUST_COUNT_PC);
    const activeDrawCalls =
      (godRayMesh.visible ? 1 : 0) +
      (isMobile
        ? (mobileFloorMesh && mobileFloorMesh.visible ? 1 : 0)
        : ((staticContactAoMesh && staticContactAoMesh.visible ? 1 : 0) +
           (groundMistMesh && groundMistMesh.visible ? 1 : 0))) +
      (dustMotesPoints.visible ? 1 : 0);

    return {
      isMobile,
      lowSpec,
      drawCalls: isMobile ? 3 : 4,
      activeDrawCalls,
      godRayCount: raySpecs.length,
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

  // Keep trackTex available cleanly if future textures are added
  void trackTex;

  return {
    group,
    godRayMesh,
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
