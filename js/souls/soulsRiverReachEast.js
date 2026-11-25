// Grimborne Hunters (z104) — Eastern River Reach 3D Builder («Рыбацкое поселение • Акведук • Стоянка Охотников»)
// Owns:
//   - Sector 01 Wooden Ferry Pier (1.4), Stepping-Stone Secret Ford (P02) & Glowing Shoal Chest (1.6)
//   - Sector 02 Old Fisherman's Bridge (2.3 / P03) with stone cutwater piers & hanging amber lanterns
//   - Sector 03 Wide Moonlit Fishing Lagoon, Northern Waterfall (3.1), Stilted Village Boardwalks (3.3),
//               Pier Bonfire Bastion (3.2), Sunken Chapel (3.4), Wrecked Barge (3.6), Watch-Cliff Stair & Turret (3.5),
//               and Forest Outpost Trail (P06)
//   - Sector 04 East Aqueduct Extension (P07) arched viaduct + carved cliff ledge & Gorge Waterfall (4.4)
//   - Sector 05 Wolf Ravine Bridge (5.3), Abandoned Hunter Camp & Bonfire (5.1), Watchtower & Beacon (5.2),
//               Overlook Cliff Vista (5.4), Forest Ruins Secret Chest (5.5), Animated Kick-Down Log Bridge (SC-4),
//               and Forest Ruins Ascent (P10) into Sector 07
//
// Pure Vanilla ES Module (Three.js r160, ZERO external CDN deps, ZERO extra PointLights,
// ZERO per-frame GC allocations, full dispose() hygiene, 60–120 FPS with distance chunk culling).

import { createMossCoatedStoneMaterial } from './soulsGorgeTerrainMat.js?v=20261125z106';

const ASSET_VER = '20261125z106';
const WATER_LEVEL = -0.10;

const VILLAGE_GLB_URL = `./assets/env/sector03_village.glb?v=${ASSET_VER}`;
const CAMP_GLB_URL = `./assets/env/sector0506_camp_heights.glb?v=${ASSET_VER}`;
const NATURE_GLB_URL = `./assets/env/gorge_nature.glb?v=${ASSET_VER}`;
const RUINS_GLB_URL = `./assets/env/gorge_ruins.glb?v=${ASSET_VER}`;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(edge0, edge1, x) {
  const d = edge1 - edge0;
  if (Math.abs(d) < 1e-6) return x >= edge1 ? 1.0 : 0.0;
  const t = clamp01((x - edge0) / d);
  return t * t * (3.0 - 2.0 * t);
}

function makeRng(seedInit) {
  let seed = seedInit >>> 0;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// Distance from point (px, pz) to 2D line segment (ax, az)-(bx, bz)
function distToSeg2D(px, pz, ax, az, bx, bz) {
  const vx = bx - ax;
  const vz = bz - az;
  const wx = px - ax;
  const wz = pz - az;
  const c1 = wx * vx + wz * vz;
  if (c1 <= 0) return Math.hypot(px - ax, pz - az);
  const c2 = vx * vx + vz * vz;
  if (c2 <= c1) return Math.hypot(px - bx, pz - bz);
  const b = c1 / c2;
  return Math.hypot(px - (ax + b * vx), pz - (az + b * vz));
}

// ============================================================================
// Default BufferGeometry Fallbacks (used only if caller omits helper fns)
// ============================================================================
function fallbackXformGeo(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  if (sx !== 1 || sy !== 1 || sz !== 1) geo.scale(sx, sy, sz);
  if (rx !== 0) geo.rotateX(rx);
  if (ry !== 0) geo.rotateY(ry);
  if (rz !== 0) geo.rotateZ(rz);
  if (x !== 0 || y !== 0 || z !== 0) geo.translate(x, y, z);
  return geo;
}

function fallbackTintGeo(THREE, rawGeo, topHex, bottomHex = null) {
  const g = rawGeo.index ? rawGeo.toNonIndexed() : rawGeo;
  if (g !== rawGeo) rawGeo.dispose();
  if (!g.attributes.normal) g.computeVertexNormals();
  const pos = g.attributes.position;
  const cnt = pos.count;
  const cTop = new THREE.Color(topHex);
  const cBot = bottomHex !== null ? new THREE.Color(bottomHex) : cTop;
  let minY = Infinity;
  let maxY = -Infinity;
  if (bottomHex !== null) {
    for (let i = 0; i < cnt; i++) {
      const y = pos.getY(i);
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const span = Math.max(1e-4, maxY - minY);
  const cols = new Float32Array(cnt * 3);
  for (let i = 0; i < cnt; i++) {
    const t = bottomHex !== null ? clamp01((pos.getY(i) - minY) / span) : 1.0;
    cols[i * 3] = lerp(cBot.r, cTop.r, t);
    cols[i * 3 + 1] = lerp(cBot.g, cTop.g, t);
    cols[i * 3 + 2] = lerp(cBot.b, cTop.b, t);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return g;
}

function fallbackMergeNonIndexedGeos(THREE, rawList, { boxUvTile = 0, withColor = false } = {}) {
  if (!rawList || rawList.length === 0) return null;
  const parts = [];
  let totalVerts = 0;
  for (let i = 0; i < rawList.length; i++) {
    const raw = rawList[i];
    if (!raw || !raw.attributes?.position) continue;
    const g = raw.index ? raw.toNonIndexed() : raw.clone();
    if (!g.attributes.normal) g.computeVertexNormals();
    if (boxUvTile > 0) {
      const pos = g.attributes.position;
      const norm = g.attributes.normal;
      const uv = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2);
      const inv = 1.0 / Math.max(0.05, boxUvTile);
      for (let k = 0; k < pos.count; k++) {
        const ax = Math.abs(norm.getX(k));
        const ay = Math.abs(norm.getY(k));
        const az = Math.abs(norm.getZ(k));
        if (ay >= ax && ay >= az) uv.setXY(k, pos.getX(k) * inv, pos.getZ(k) * inv);
        else if (ax >= az) uv.setXY(k, pos.getZ(k) * inv, pos.getY(k) * inv);
        else uv.setXY(k, pos.getX(k) * inv, pos.getY(k) * inv);
      }
      g.setAttribute('uv', uv);
    }
    if (!g.attributes.uv) {
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    }
    if (withColor && !g.attributes.color) {
      const cArr = new Float32Array(g.attributes.position.count * 3);
      cArr.fill(1.0);
      g.setAttribute('color', new THREE.BufferAttribute(cArr, 3));
    }
    totalVerts += g.attributes.position.count;
    parts.push(g);
    raw.dispose();
  }
  if (totalVerts === 0) return null;
  const posOut = new Float32Array(totalVerts * 3);
  const normOut = new Float32Array(totalVerts * 3);
  const uvOut = new Float32Array(totalVerts * 2);
  const colOut = withColor ? new Float32Array(totalVerts * 3) : null;
  let offset = 0;
  for (let i = 0; i < parts.length; i++) {
    const g = parts[i];
    const cnt = g.attributes.position.count;
    posOut.set(g.attributes.position.array, offset * 3);
    normOut.set(g.attributes.normal.array, offset * 3);
    uvOut.set(g.attributes.uv.array, offset * 2);
    if (colOut && g.attributes.color) colOut.set(g.attributes.color.array, offset * 3);
    offset += cnt;
    g.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(posOut, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normOut, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvOut, 2));
  if (colOut) merged.setAttribute('color', new THREE.BufferAttribute(colOut, 3));
  merged.computeBoundingSphere();
  return merged;
}

// ============================================================================
// Procedural Botanical & Wind-Sway Helpers (InstancedMesh-safe)
// ============================================================================
function buildCurvedCardGeo(THREE, width, height, segsY = 4, archFwd = 0.22, vCamber = 0.06, tiltX = 0.0) {
  const geo = new THREE.PlaneGeometry(width, height, 2, segsY);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i) + height * 0.5;
    const t = clamp(y / Math.max(0.001, height), 0, 1);
    const nx = Math.abs(x / Math.max(0.001, width * 0.5));
    const curveZ = t * t * archFwd - nx * vCamber * (0.4 + 0.6 * t);
    const curveY = y - t * t * t * archFwd * 0.42;
    pos.setXYZ(i, x, curveY, curveZ);
  }
  if (tiltX !== 0) geo.rotateX(tiltX);
  geo.computeVertexNormals();
  return geo;
}

function buildFernRosetteGeo(THREE, mergeNonIndexedGeos) {
  const parts = [];
  const frondSpecs = [
    { yaw: 0.0,  len: 1.05, w: 0.64, arch: 0.48, tilt: 0.58 },
    { yaw: 1.24, len: 0.96, w: 0.58, arch: 0.44, tilt: 0.62 },
    { yaw: 2.52, len: 1.08, w: 0.65, arch: 0.50, tilt: 0.55 },
    { yaw: 3.78, len: 0.92, w: 0.56, arch: 0.42, tilt: 0.66 },
    { yaw: 5.04, len: 1.00, w: 0.60, arch: 0.46, tilt: 0.60 },
    { yaw: 0.62, len: 0.72, w: 0.48, arch: 0.28, tilt: 0.34 },
    { yaw: 3.15, len: 0.76, w: 0.50, arch: 0.30, tilt: 0.36 }
  ];
  for (let i = 0; i < frondSpecs.length; i++) {
    const f = frondSpecs[i];
    const g = buildCurvedCardGeo(THREE, f.w, f.len, 3, f.arch, 0.05, f.tilt);
    g.rotateY(f.yaw);
    parts.push(g);
  }
  return mergeNonIndexedGeos(THREE, parts, { boxUvTile: 0, withColor: false });
}

function buildRiverGrassClumpGeo(THREE, mergeNonIndexedGeos) {
  const parts = [];
  const cardSpecs = [
    { yaw: 0.0,  w: 0.74, h: 0.86, arch: 0.14, x: 0.0,   z: 0.0 },
    { yaw: 1.05, w: 0.68, h: 0.78, arch: 0.18, x: 0.06,  z: -0.04 },
    { yaw: 2.12, w: 0.72, h: 0.82, arch: 0.16, x: -0.05, z: 0.05 }
  ];
  for (let i = 0; i < cardSpecs.length; i++) {
    const c = cardSpecs[i];
    const g = buildCurvedCardGeo(THREE, c.w, c.h, 3, c.arch, 0.03, 0.06);
    g.rotateY(c.yaw);
    g.translate(c.x, -0.04, c.z);
    parts.push(g);
  }
  return mergeNonIndexedGeos(THREE, parts, { boxUvTile: 0, withColor: false });
}

function applyWindSway(mat, uTimeUniform, { amp = 0.09, freq = 1.65, anchorTop = false, cacheKey = 'east_wind' } = {}) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = uTimeUniform;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uWindTime;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec4 wBase = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          #ifdef USE_INSTANCING
            wBase = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          #endif
          float swayMask = ${anchorTop ? 'clamp(1.0 - uv.y, 0.0, 1.0)' : 'clamp(uv.y, 0.0, 1.0)'};
          swayMask *= swayMask;
          float ph = uWindTime * ${freq.toFixed(2)} + wBase.x * 0.42 + wBase.z * 0.31 + position.y * 0.6;
          transformed.x += sin(ph) * ${(amp).toFixed(4)} * swayMask;
          transformed.z += cos(ph * 0.82 + 1.3) * ${(amp * 0.75).toFixed(4)} * swayMask;
        }`
      );
  };
  mat.customProgramCacheKey = () => cacheKey;
  return mat;
}

// ============================================================================
// Main Factory: `createSoulsRiverReachEast`
// ============================================================================
export function createSoulsRiverReachEast(THREE, ctx = {}) {
  const {
    parentGroup = null,
    gltfLoader = null,
    pbrTex = null,
    terrainMat = null,
    riverMat = null,
    campfireRig = null,
    isMobile = false,
    lowSpecMode = false,
    trackGeo = (g) => g,
    trackMat = (m) => m,
    regNormalMat = null,
    xformGeo = fallbackXformGeo,
    tintGeo = fallbackTintGeo,
    mergeNonIndexedGeos = fallbackMergeNonIndexedGeos,
    uTimeUniform = { value: 0.0 },
    mistSpriteTex = null,
    evalTerrainY = () => 0.0
  } = ctx || {};

  const group = new THREE.Group();
  group.name = 'SoulsRiverReachEast';
  if (parentGroup) parentGroup.add(group);

  // Owned GPU resource trackers for clean, leak-free dispose()
  const ownedGeos = [];
  const ownedMats = [];
  const ownedInsts = [];
  const ownedTextures = [];
  const campfireHandles = [];
  let disposed = false;

  const regGeo = (g) => {
    if (!g) return g;
    ownedGeos.push(g);
    return typeof trackGeo === 'function' ? trackGeo(g) : g;
  };

  const regMat = (m) => {
    if (!m) return m;
    ownedMats.push(m);
    return typeof trackMat === 'function' ? trackMat(m) : m;
  };

  const safeEvalY = (x, z) => {
    const y = typeof evalTerrainY === 'function' ? evalTerrainY(x, z) : 0.0;
    return Number.isFinite(y) ? y : 0.0;
  };

  const rng = makeRng(202611254);
  const alwaysOneUniform = { value: 1.0 };
  const _m = new THREE.Object3D();

  // Soft fallback radial texture if mistSpriteTex is omitted
  let resolvedMistTex = mistSpriteTex;
  if (!resolvedMistTex) {
    const data = new Uint8Array([
      255, 255, 255, 255, 255, 255, 255, 255,
      255, 255, 255, 255, 255, 255, 255, 255
    ]);
    resolvedMistTex = new THREE.DataTexture(data, 2, 2, THREE.RGBAFormat);
    resolvedMistTex.colorSpace = THREE.SRGBColorSpace;
    resolvedMistTex.needsUpdate = true;
    ownedTextures.push(resolvedMistTex);
  }

  // Distance-culled minor prop/foliage chunk groups (> 130m culling with hysteresis!)
  const landmarkGroup = new THREE.Group();
  landmarkGroup.name = 'EastReach_Landmarks';
  group.add(landmarkGroup);

  const cullChunks = [];
  function makeCullChunk(name, cx, cy, cz, cullDist = 130.0) {
    const cg = new THREE.Group();
    cg.name = name;
    group.add(cg);
    cullChunks.push({
      group: cg,
      x: cx,
      y: cy,
      z: cz,
      hideDistSq: (cullDist + 2.0) * (cullDist + 2.0),
      showDistSq: (cullDist - 4.0) * (cullDist - 4.0)
    });
    return cg;
  }

  const chunkS1S2Minor = makeCullChunk('EastReach_S1S2_Minor', 16.0, 1.0, 38.0, 130.0);
  const chunkS3Minor = makeCullChunk('EastReach_S3_Minor', 50.0, 2.0, 50.0, 130.0);
  const chunkS4Minor = makeCullChunk('EastReach_S4_Minor', 26.0, 8.0, 92.0, 130.0);
  const chunkS5Minor = makeCullChunk('EastReach_S5_Minor', 50.0, 14.0, 142.0, 130.0);

  // Animation pools (strictly zero-GC in update())
  const warmSprites = [];
  const spraySprites = [];
  const bobbingBoats = [];

  // --------------------------------------------------------------------------
  // 1. UNIFIED STYLIZED-REALISTIC MOSS-COATED PBR MATERIALS (z104 Cohesion)
  // --------------------------------------------------------------------------
  const ruinStoneMat = createMossCoatedStoneMaterial(THREE, pbrTex, {
    kind: 'ruin',
    color: 0xb4c0d4,
    envMapIntensity: 0.44,
    mossAmount: 0.68,
    groundAO: 0.36,
    rimStrength: 0.15,
    lowSpecMode,
    trackMat: regMat,
    regNormalMat
  });

  const ruinStoneDeckMat = createMossCoatedStoneMaterial(THREE, pbrTex, {
    kind: 'deck',
    color: 0xb8c4d8,
    envMapIntensity: 0.52,
    mossAmount: 0.16,
    groundAO: 0.24,
    rimStrength: 0.12,
    lowSpecMode,
    trackMat: regMat,
    regNormalMat
  });

  const cliffRockMat = createMossCoatedStoneMaterial(THREE, pbrTex, {
    kind: 'cliff',
    color: 0xa8b5c8,
    envMapIntensity: 0.42,
    mossAmount: 0.80,
    groundAO: 0.38,
    rimStrength: 0.16,
    lowSpecMode,
    trackMat: regMat,
    regNormalMat
  });

  const wetRiverBoulderMat = createMossCoatedStoneMaterial(THREE, pbrTex, {
    kind: 'boulder',
    color: 0x98a8c0,
    envMapIntensity: 0.62,
    mossAmount: 0.66,
    groundAO: 0.40,
    rimStrength: 0.16,
    lowSpecMode,
    trackMat: regMat,
    regNormalMat
  });

  const mossMoundMat = createMossCoatedStoneMaterial(THREE, pbrTex, {
    kind: 'cliff',
    color: 0x9cb0a4,
    envMapIntensity: 0.42,
    mossAmount: 0.94,
    groundAO: 0.34,
    rimStrength: 0.12,
    lowSpecMode,
    trackMat: regMat,
    regNormalMat
  });

  const barkMat = createMossCoatedStoneMaterial(THREE, pbrTex, {
    kind: 'bark',
    color: 0xb6aca2,
    envMapIntensity: 0.42,
    mossAmount: 0.32,
    groundAO: 0.38,
    rimStrength: 0.14,
    lowSpecMode,
    trackMat: regMat,
    regNormalMat
  });

  const timberWoodMat = createMossCoatedStoneMaterial(THREE, pbrTex, {
    kind: 'timber',
    color: 0xd8c8b6,
    envMapIntensity: 0.64,
    mossAmount: 0.14,
    groundAO: 0.22,
    rimStrength: 0.20,
    lowSpecMode,
    trackMat: regMat,
    regNormalMat
  });

  const wetPierTimberMat = createMossCoatedStoneMaterial(THREE, pbrTex, {
    kind: 'timber',
    color: 0xd2c4b4,
    envMapIntensity: 0.66,
    mossAmount: 0.22,
    groundAO: 0.24,
    rimStrength: 0.22,
    lowSpecMode,
    trackMat: regMat,
    regNormalMat
  });

  const forgedIronMat = regMat(new THREE.MeshStandardMaterial({
    color: 0x3b424e,
    roughness: 0.46,
    metalness: 0.82,
    envMapIntensity: 0.62,
    vertexColors: true
  }));

  const canvasTentMat = regMat(new THREE.MeshStandardMaterial({
    color: 0x7a746a,
    roughness: 0.90,
    metalness: 0.02,
    envMapIntensity: 0.40,
    vertexColors: true,
    side: THREE.DoubleSide
  }));

  const lanternGlassMat = regMat(new THREE.MeshStandardMaterial({
    color: 0xffd584,
    emissive: new THREE.Color(0xff9a28),
    emissiveIntensity: 3.8,
    roughness: 0.22,
    metalness: 0.0
  }));

  const chestGoldMat = regMat(new THREE.MeshStandardMaterial({
    color: 0xc99c4a,
    emissive: new THREE.Color(0x6e4310),
    emissiveIntensity: 0.72,
    roughness: 0.34,
    metalness: 0.78,
    envMapIntensity: 0.72
  }));

  const crimsonBannerMat = applyWindSway(
    regMat(new THREE.MeshStandardMaterial({
      color: 0x9b242c,
      roughness: 0.86,
      metalness: 0.02,
      envMapIntensity: 0.42,
      vertexColors: true,
      side: THREE.DoubleSide
    })),
    uTimeUniform,
    { amp: 0.14, freq: 2.1, anchorTop: true, cacheKey: 'east_banner_wind' }
  );

  const pineFoliageMat = applyWindSway(
    regMat(new THREE.MeshStandardMaterial({
      map: pbrTex?.foliage?.pineBough || null,
      alphaTest: 0.40,
      side: THREE.DoubleSide,
      color: 0xd0e4d6,
      roughness: 0.86,
      metalness: 0.02,
      envMapIntensity: 0.48,
      vertexColors: true
    })),
    uTimeUniform,
    { amp: 0.11, freq: 1.35, anchorTop: false, cacheKey: 'east_pine_wind' }
  );

  const ivyCurtainMat = applyWindSway(
    regMat(new THREE.MeshStandardMaterial({
      map: pbrTex?.foliage?.ivyVinePlane || pbrTex?.foliage?.ivyVine || null,
      alphaTest: 0.36,
      side: THREE.DoubleSide,
      color: 0xc2d8bc,
      roughness: 0.82,
      metalness: 0.02,
      envMapIntensity: 0.48
    })),
    uTimeUniform,
    { amp: 0.06, freq: 1.75, anchorTop: true, cacheKey: 'east_ivy_wind' }
  );

  const fernMat = applyWindSway(
    regMat(new THREE.MeshStandardMaterial({
      map: pbrTex?.foliage?.fernFrond || null,
      alphaTest: 0.42,
      side: THREE.DoubleSide,
      color: 0xd0e2c4,
      roughness: 0.78,
      metalness: 0.02,
      envMapIntensity: 0.48
    })),
    uTimeUniform,
    { amp: 0.075, freq: 1.85, anchorTop: false, cacheKey: 'east_fern_wind' }
  );

  const riverGrassMat = applyWindSway(
    regMat(new THREE.MeshStandardMaterial({
      map: pbrTex?.foliage?.riverGrass || null,
      alphaTest: 0.40,
      side: THREE.DoubleSide,
      color: 0xc6dac0,
      roughness: 0.80,
      metalness: 0.02,
      envMapIntensity: 0.48
    })),
    uTimeUniform,
    { amp: 0.085, freq: 2.15, anchorTop: false, cacheKey: 'east_grass_wind' }
  );

  const distantMountainMat = regMat(new THREE.ShaderMaterial({
    uniforms: { uTime: uTimeUniform },
    vertexShader: `
      attribute vec3 color;
      varying vec3 vNormalW;
      varying vec3 vWorldPos;
      varying vec3 vCol;
      void main() {
        vCol = color;
        vec4 localPos = vec4(position, 1.0);
        vec3 localNorm = normal;
        #ifdef USE_INSTANCING
          localPos = instanceMatrix * localPos;
          localNorm = mat3(instanceMatrix) * localNorm;
        #endif
        vec4 wp = modelMatrix * localPos;
        vWorldPos = wp.xyz;
        vNormalW = normalize(mat3(modelMatrix) * localNorm);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vNormalW;
      varying vec3 vWorldPos;
      varying vec3 vCol;
      void main() {
        vec3 N = normalize(vNormalW);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 moonL = normalize(vec3(0.240, 0.315, 0.918));
        float ndl = max(dot(N, moonL), 0.0);
        float rim = pow(1.0 - max(dot(N, V), 0.0), 2.6);
        float ridge = smoothstep(0.42, 0.86, N.y);

        vec3 rockDark = vec3(0.018, 0.030, 0.054);
        vec3 rockLit  = vec3(0.085, 0.125, 0.195);
        vec3 col = mix(rockDark, rockLit, clamp(ndl * 0.60 + ridge * 0.22, 0.0, 1.0)) * (0.62 + 0.50 * vCol.r);
        col += vec3(0.18, 0.27, 0.42) * rim * (0.30 + 0.65 * ndl);

        float dist = length(vWorldPos - cameraPosition);
        float valleyMist = (1.0 - smoothstep(4.0, 34.0, vWorldPos.y)) * 0.72;
        float depthMist = smoothstep(72.0, 210.0, dist) * 0.68;
        float totalMist = clamp(max(valleyMist, depthMist), 0.0, 0.86);
        vec3 mistCol = mix(vec3(0.088, 0.145, 0.242), vec3(0.145, 0.220, 0.348), clamp(ndl * 0.36 + smoothstep(10.0, 34.0, vWorldPos.y) * 0.26, 0.0, 1.0));
        col = mix(col, mistCol, totalMist);

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.FrontSide,
    fog: false
  }));

  const warmHaloMat = regMat(new THREE.SpriteMaterial({
    map: resolvedMistTex,
    color: 0xffa63d,
    transparent: true,
    opacity: 0.50,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }));

  const chestShimmerMat = regMat(new THREE.SpriteMaterial({
    map: resolvedMistTex,
    color: 0xffd27a,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }));

  const sprayMistMat = regMat(new THREE.SpriteMaterial({
    map: resolvedMistTex,
    color: 0x8fb2d8,
    transparent: true,
    opacity: 0.30,
    depthWrite: false
  }));

  // Fallback terrain material only if ctx.terrainMat wasn't supplied
  const resolvedTerrainMat = terrainMat || cliffRockMat;

  // Fallback river water shader only if ctx.riverMat wasn't supplied
  const resolvedRiverMat = riverMat || regMat(new THREE.ShaderMaterial({
    uniforms: { uTime: uTimeUniform },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        float rip = sin(vWorldPos.x * 0.8 + uTime * 1.4) * cos(vWorldPos.z * 0.7 - uTime * 1.1) * 0.5 + 0.5;
        vec3 col = mix(vec3(0.008, 0.018, 0.036), vec3(0.032, 0.056, 0.098), rip);
        float edge = smoothstep(0.0, 0.08, min(vUv.x, 1.0 - vUv.x));
        gl_FragColor = vec4(col, edge * 0.92);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  }));

  function addWarmSprite(parent, x, y, z, scale = 1.8, isChest = false) {
    const sp = new THREE.Sprite(isChest ? chestShimmerMat : warmHaloMat);
    sp.position.set(x, y, z);
    sp.scale.set(scale, scale, 1);
    parent.add(sp);
    warmSprites.push({ sprite: sp, baseScale: scale, phase: rng() * 6.28318 });
    return sp;
  }

  // --------------------------------------------------------------------------
  // 2. EASTERN VALLEY TERRAIN MESH (x = +12..+96, z = -12..+196)
  //    Displaced via evalTerrainY(x, z), aTerrainMix + baked warm campfire pools!
  // --------------------------------------------------------------------------
  function buildEasternTerrainGeo() {
    const minX = 12.0;
    const maxX = 96.0;
    const minZ = -12.0;
    const maxZ = 188.0;
    const segX = isMobile ? 64 : 112;
    const segZ = isMobile ? 124 : 216;

    const geo = new THREE.PlaneGeometry(maxX - minX, maxZ - minZ, segX, segZ);
    geo.rotateX(-Math.PI * 0.5);
    geo.translate((minX + maxX) * 0.5, 0.0, (minZ + maxZ) * 0.5);

    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    const cols = new Float32Array(pos.count * 3);
    const mixAttr = new Float32Array(pos.count * 4);

    const cDry = new THREE.Color(0x6e7b91);
    const cWet = new THREE.Color(0x2c3648);
    const cPath = new THREE.Color(0x9aa8bf);
    const cMoss = new THREE.Color(0x5d785e);
    const cCliff = new THREE.Color(0x4b586e);
    const cWarmFire = new THREE.Color(0xffaa52);
    const cTmp = new THREE.Color();

    // Baked warm campfire & lantern radiance pools (ZERO extra PointLights!)
    const bakedWarmPools = [
      // 3.2 Pier Bonfire & village bastion glow
      { x: 46.0, z: 54.0, r: 9.2, w: 0.82 },
      // 3.5 Watch-Cliff Turret Brazier glow
      { x: 55.0, z: 80.0, r: 7.4, w: 0.58 },
      // 5.1 Hunter Camp Bonfire clearing radiance pool
      { x: 50.0, z: 134.0, r: 10.5, w: 0.86 },
      // 5.2 Watchtower foot & beacon spill
      { x: 41.0, z: 126.0, r: 7.2, w: 0.52 },
      // 5.5 Forest Ruins secret chest warm amber glow
      { x: 64.0, z: 152.0, r: 5.4, w: 0.46 },
      // 1.4 Pier & 2.3 Bridge east abutment lanterns
      { x: 12.1, z: 19.7, r: 4.4, w: 0.38 },
      { x: 29.8, z: 49.0, r: 5.2, w: 0.44 },
      // Sector 03 village chapel & barge pier lanterns
      { x: 55.0, z: 41.0, r: 5.6, w: 0.44 },
      { x: 38.0, z: 48.0, r: 5.0, w: 0.38 },
      // Sector 05 camp barracks & ravine bridge entrance lanterns
      { x: 56.5, z: 137.0, r: 5.6, w: 0.44 },
      { x: 34.0, z: 118.0, r: 5.2, w: 0.40 }
    ];

    // Trail segments defining cobble/flagstone pathT weights
    const trailSegs = [
      [10.0, 22.0, 26.0, 38.0, 3.2],   // P02 Ford
      [48.0, 60.0, 53.0, 86.0, 4.6],   // 3.5 Watch-Cliff Stair
      [52.0, 86.0, 52.0, 102.0, 4.4],  // P06 Forest Outpost Trail
      [52.0, 102.0, 50.0, 122.0, 4.2], // P06 -> Camp approach
      [34.0, 83.0, 34.0, 118.0, 3.8],  // P07 cliff ledge + 5.3 bridge
      [34.0, 118.0, 44.0, 128.0, 4.0], // Ravine bridge -> Camp
      [42.0, 88.0, 42.0, 118.0, 3.0],  // SC-4 Log shortcut corridor
      [46.0, 132.0, 28.0, 128.0, 3.0], // 5.4 Overlook Cliff trail
      [52.0, 138.0, 64.0, 152.0, 3.4], // 5.5 Forest Ruins trail
      [44.0, 148.0, 44.0, 184.0, 4.8]  // P10 Forest Ruins Ascent
    ];

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const rawY = safeEvalY(x, z);
      // Tuck the northern seam (z > 180) cleanly beneath NorthernMountainCragsTerrain so triangles never z-fight
      const northTuck = smoothstep(180.0, 186.0, z) * 1.65;
      const y = rawY - northTuck;
      pos.setY(i, y);
      uv.setXY(i, x * 0.44, z * 0.44);

      // Wet shoreline / lagoon bed mask
      const inLagoonBox = (x >= 14.0 && x <= 84.0 && z >= 14.0 && z <= 75.0);
      const lowWaterWet = 1.0 - smoothstep(-0.25, 1.35, y);
      const wf1D = Math.hypot(x - 70.0, z - 24.0);
      const wf2D = Math.hypot(x - 18.0, z - 96.0);
      const wfSprayWet = clamp01((1.0 - smoothstep(3.5, 12.0, wf1D)) + (1.0 - smoothstep(3.0, 10.5, wf2D)));
      const wetT = clamp01(Math.max(lowWaterWet * (inLagoonBox ? 1.0 : 0.78), wfSprayWet * 0.85));

      // Trail & clearing cobble/stone path mask
      let pathT = 0.0;
      for (let ti = 0; ti < trailSegs.length; ti++) {
        const s = trailSegs[ti];
        const d = distToSeg2D(x, z, s[0], s[1], s[2], s[3]);
        const w = 1.0 - smoothstep(s[4] * 0.45, s[4] + 1.6, d);
        if (w > pathT) pathT = w;
      }
      // Hunter Camp central clearing (50, 134)
      const dCamp = Math.hypot((x - 50.0) * 0.85, z - 134.0);
      const campClear = 1.0 - smoothstep(6.5, 14.5, dCamp);
      if (campClear * 0.82 > pathT) pathT = campClear * 0.82;
      // 5.5 Ruins plaza & 5.4 Overlook vista
      const dRuins = Math.hypot(x - 64.0, z - 152.0);
      const ruinsClear = (1.0 - smoothstep(3.5, 8.2, dRuins)) * 0.88;
      if (ruinsClear > pathT) pathT = ruinsClear;
      const dOverlook = Math.hypot(x - 28.0, z - 128.0);
      const overlookClear = (1.0 - smoothstep(2.5, 6.2, dOverlook)) * 0.78;
      if (overlookClear > pathT) pathT = overlookClear;

      // Estimate local slope via finite difference for cliff/moss assignment
      const yX = safeEvalY(x + 1.0, z);
      const yZ = safeEvalY(x, z + 1.0);
      const slope = Math.hypot(yX - y, yZ - y);
      const cliffT = clamp01(smoothstep(0.45, 1.15, slope) + smoothstep(18.5, 29.0, y) * 0.55);

      const mossNoise = clamp01(0.5 + 0.5 * Math.sin(x * 0.36 + z * 0.28) * Math.cos(z * 0.31 - x * 0.22));
      const mossT = clamp01(
        (0.46 + mossNoise * 0.54) *
        (1.0 - pathT * 0.72) *
        (1.0 - wetT * 0.65) *
        (1.0 - cliffT * 0.60) *
        smoothstep(0.15, 1.6, y)
      );

      mixAttr[i * 4]     = clamp01(pathT);
      mixAttr[i * 4 + 1] = mossT;
      mixAttr[i * 4 + 2] = cliffT;
      mixAttr[i * 4 + 3] = clamp01(wetT + pathT * 0.22);

      cTmp.copy(cDry);
      cTmp.lerp(cPath, pathT * 0.72);
      cTmp.lerp(cMoss, mossT * 0.58);
      cTmp.lerp(cWet, wetT * 0.68);
      cTmp.lerp(cCliff, cliffT * 0.70);

      let warmSum = 0.0;
      for (let pi = 0; pi < bakedWarmPools.length; pi++) {
        const bp = bakedWarmPools[pi];
        const d = Math.hypot(x - bp.x, z - bp.z);
        if (d < bp.r) {
          const f = 1.0 - d / bp.r;
          warmSum += f * f * bp.w;
        }
      }
      if (warmSum > 0.005) {
        cTmp.lerp(cWarmFire, Math.min(0.78, warmSum));
      }

      cols[i * 3]     = cTmp.r;
      cols[i * 3 + 1] = cTmp.g;
      cols[i * 3 + 2] = cTmp.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geo.setAttribute('aTerrainMix', new THREE.BufferAttribute(mixAttr, 4));
    geo.computeVertexNormals();
    return geo;
  }

  const eastTerrainMesh = new THREE.Mesh(regGeo(buildEasternTerrainGeo()), resolvedTerrainMat);
  eastTerrainMesh.name = 'EastValleyTerrain';
  eastTerrainMesh.receiveShadow = true;
  landmarkGroup.add(eastTerrainMesh);

  // --------------------------------------------------------------------------
  // 3. WIDE MOONLIT FISHING LAGOON WATER PLANE (x = +16..+82, z = +16..+72, y = -0.10)
  // --------------------------------------------------------------------------
  function buildLagoonWaterGeo() {
    const xMin = 16.0;
    const xMax = 82.0;
    const zMin = 16.0;
    const zMax = 72.0;
    const segX = isMobile ? 28 : 48;
    const segZ = isMobile ? 28 : 48;

    const pos = new Float32Array((segZ + 1) * (segX + 1) * 3);
    const uv = new Float32Array((segZ + 1) * (segX + 1) * 2);
    const indices = [];

    for (let iz = 0; iz <= segZ; iz++) {
      const v = iz / segZ;
      const z = lerp(zMin, zMax, v);
      // Soft western edge feathering along z extremes so lagoon blends invisibly into main river ribbon
      const zEdgePinch = smoothstep(0.0, 0.14, v) * smoothstep(0.0, 0.14, 1.0 - v);
      for (let ix = 0; ix <= segX; ix++) {
        const u = ix / segX;
        const x = lerp(xMin, xMax, u);
        const vi = iz * (segX + 1) + ix;
        pos[vi * 3]     = x;
        pos[vi * 3 + 1] = WATER_LEVEL;
        pos[vi * 3 + 2] = z;
        // Modulate uv.x near north/south western channel borders so riverMat shoreEdge feathers smoothly
        const uFade = (x < 24.0) ? u * zEdgePinch : u;
        uv[vi * 2]      = uFade;
        uv[vi * 2 + 1]  = v * 11.5;
      }
    }

    for (let iz = 0; iz < segZ; iz++) {
      for (let ix = 0; ix < segX; ix++) {
        const a = iz * (segX + 1) + ix;
        const b = (iz + 1) * (segX + 1) + ix;
        const d = iz * (segX + 1) + (ix + 1);
        const e = (iz + 1) * (segX + 1) + (ix + 1);
        indices.push(a, b, e, a, e, d);
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }

  const lagoonWaterMesh = new THREE.Mesh(regGeo(buildLagoonWaterGeo()), resolvedRiverMat);
  lagoonWaterMesh.name = 'FishingLagoonWater';
  lagoonWaterMesh.renderOrder = 1;
  landmarkGroup.add(lagoonWaterMesh);

  // --------------------------------------------------------------------------
  // 4. TWO MULTI-LAYERED ANIMATED 3D WATERFALLS + PLUNGE POOL FOAM + MIST SPRAY!
  //    - 3.1 Northern Waterfall: (72.0, 14.0 -> -0.10, 20.0) into Fishing Lagoon
  //    - 4.4 Gorge Waterfall:    (19.0, 10.5 -> -0.10, 96.0) into Canyon River
  // --------------------------------------------------------------------------
  function buildWaterfallSheetGeo(dropForward, dropY, wStart, wEnd, bulge) {
    const cols = isMobile ? 12 : 18;
    const rows = isMobile ? 14 : 22;
    const pos = new Float32Array((cols + 1) * (rows + 1) * 3);
    const uv = new Float32Array((cols + 1) * (rows + 1) * 2);
    const idx = [];
    for (let r = 0; r <= rows; r++) {
      const v = r / rows;
      // Parabolic cascade trajectory along local +Z, dropping along -Y from 0 to -dropY
      const z = Math.pow(v, 0.72) * dropForward;
      const y = -Math.pow(v, 1.92) * dropY;
      const halfW = lerp(wStart, wEnd, v) * 0.5;
      for (let c = 0; c <= cols; c++) {
        const u = c / cols;
        const nx = u * 2.0 - 1.0;
        const x = nx * halfW;
        const archDip = (1.0 - nx * nx) * bulge;
        const rib = Math.sin(u * Math.PI * 5.0) * 0.14 * v;
        const vi = r * (cols + 1) + c;
        pos[vi * 3]     = x;
        pos[vi * 3 + 1] = y + archDip * (1.0 - v * 0.75) + rib * 0.5;
        pos[vi * 3 + 2] = z + archDip * 0.65 + Math.abs(rib) * 0.7;
        uv[vi * 2]      = u;
        uv[vi * 2 + 1]  = v;
      }
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const a = r * (cols + 1) + c;
        const b = (r + 1) * (cols + 1) + c;
        const d = r * (cols + 1) + (c + 1);
        const e = (r + 1) * (cols + 1) + (c + 1);
        idx.push(a, b, e, a, e, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  function makeWaterfallMat(speedMul, opacityMul, foamBias) {
    return regMat(new THREE.ShaderMaterial({
      uniforms: { uTime: uTimeUniform },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
      vertexShader: `
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec3 p = position;
          p.z += sin(uv.x * 16.0 + uv.y * 10.0 - uTime * ${(8.2 * speedMul).toFixed(2)}) * 0.11 * uv.y;
          p.x += cos(uv.y * 14.0 - uTime * ${(6.6 * speedMul).toFixed(2)}) * 0.06 * uv.y;
          vec4 localPos = vec4(p, 1.0);
          #ifdef USE_INSTANCING
            localPos = instanceMatrix * localPos;
          #endif
          vec4 wp = modelMatrix * localPos;
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        float hash21(vec2 p) {
          p = fract(p * vec2(127.1, 311.7));
          p += dot(p, p + 34.53);
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
          float t = uTime * ${(4.5 * speedMul).toFixed(2)};
          float s1 = vnoise(vec2(vUv.x * 14.0, vUv.y * 5.2 - t));
          float s2 = vnoise(vec2(vUv.x * 28.0 + 3.1, vUv.y * 9.5 - t * 1.55));
          float s3 = vnoise(vec2(vUv.x * 6.5 - 1.4, vUv.y * 3.0 - t * 0.78));
          float streak = smoothstep(0.24, 0.80, s1 * 0.48 + s2 * 0.34 + s3 * 0.18 + vUv.y * 0.32 + ${foamBias.toFixed(2)});
          float plungeFroth = smoothstep(0.76, 1.0, vUv.y) * 0.52;
          float sideFade = smoothstep(0.0, 0.16, vUv.x) * smoothstep(0.0, 0.16, 1.0 - vUv.x);
          float topFade = smoothstep(0.0, 0.08, vUv.y);

          vec3 slateWater = vec3(0.085, 0.155, 0.275);
          vec3 moonFoam   = vec3(0.74, 0.86, 1.00);
          vec3 col = mix(slateWater, moonFoam, clamp(streak + plungeFroth, 0.0, 1.0));

          // Smooth valley mist distance blend matching #1a2a40
          float camDist = length(vWorldPos - cameraPosition);
          float mistBlend = smoothstep(65.0, 195.0, camDist) * 0.62;
          col = mix(col, vec3(0.088, 0.145, 0.242), mistBlend);

          float a = clamp((0.44 + streak * 0.56 + plungeFroth * 0.35) * sideFade * topFade * ${opacityMul.toFixed(2)}, 0.0, 0.94);
          if (a < 0.01) discard;
          gl_FragColor = vec4(col, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `
    }));
  }

  const wfCoreMat = makeWaterfallMat(1.0, 0.92, 0.0);
  const wfVeilMat = makeWaterfallMat(1.26, 0.56, 0.14);

  const plungeFoamMat = regMat(new THREE.ShaderMaterial({
    uniforms: { uTime: uTimeUniform },
    transparent: true,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      float hash21(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 34.53);
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
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r >= 1.0) discard;
        float ang = atan(p.y, p.x);
        float n1 = vnoise(vec2(ang * 3.5, r * 6.5 - uTime * 2.2));
        float n2 = vnoise(p * 7.5 + vec2(uTime * 0.7, -uTime * 1.1));
        float rings = 0.5 + 0.5 * sin(r * 16.0 - uTime * 5.2 + n1 * 3.2);
        float core = exp(-r * r * 3.6);
        float rim = smoothstep(0.18, 0.65, r) * (1.0 - smoothstep(0.62, 1.0, r)) * rings;
        float foam = clamp((core * 0.85 + rim * 0.68) * (0.55 + 0.45 * n2), 0.0, 1.0);
        vec3 col = mix(vec3(0.24, 0.36, 0.54), vec3(0.76, 0.88, 1.0), foam);
        float camDist = length(vWorldPos - cameraPosition);
        col = mix(col, vec3(0.088, 0.145, 0.242), smoothstep(65.0, 185.0, camDist) * 0.55);
        float a = foam * (1.0 - smoothstep(0.72, 1.0, r)) * 0.78;
        if (a < 0.01) discard;
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  }));

  function addWaterfallAssembly({
    name, x, yTop, z, yBot = WATER_LEVEL - 0.15,
    yaw = 0, dropForward = 4.6, wTop = 4.8, wBot = 7.0,
    plungeRadius = 6.2, sprayCount = 7
  }) {
    const wfGroup = new THREE.Group();
    wfGroup.name = name;
    wfGroup.position.set(x, yTop, z);
    wfGroup.rotation.y = yaw;
    landmarkGroup.add(wfGroup);

    const dropY = yTop - yBot;

    // Layer 1: Dense Core Torrent
    const coreMesh = new THREE.Mesh(
      regGeo(buildWaterfallSheetGeo(dropForward, dropY, wTop, wBot, 0.48)),
      wfCoreMat
    );
    coreMesh.renderOrder = 2;
    wfGroup.add(coreMesh);

    // Layer 2: Outer Frothy Spray Curtain
    const veilMesh = new THREE.Mesh(
      regGeo(buildWaterfallSheetGeo(dropForward + 0.62, dropY + 0.12, wTop + 0.7, wBot + 1.15, 0.74)),
      wfVeilMat
    );
    veilMesh.position.set(0, 0.12, 0.32);
    veilMesh.renderOrder = 3;
    wfGroup.add(veilMesh);

    // Layer 3: Flanking Secondary Spill Ribbons over mossy cliff ledges
    for (const side of [-1, 1]) {
      const sideRibbon = new THREE.Mesh(
        regGeo(buildWaterfallSheetGeo(dropForward * 0.78, dropY * 0.96, wTop * 0.26, wBot * 0.32, 0.22)),
        wfVeilMat
      );
      sideRibbon.position.set(side * (wTop * 0.54), -0.45, -0.25);
      sideRibbon.renderOrder = 2;
      wfGroup.add(sideRibbon);
    }

    // Plunge-pool churning foam disc at exact waterline
    const sinY = Math.sin(yaw);
    const cosY = Math.cos(yaw);
    const px = x + sinY * (dropForward + 0.35);
    const pz = z + cosY * (dropForward + 0.35);
    const foamGeo = regGeo(new THREE.CircleGeometry(plungeRadius, isMobile ? 18 : 28));
    foamGeo.rotateX(-Math.PI * 0.5);
    const foamDisc = new THREE.Mesh(foamGeo, plungeFoamMat);
    foamDisc.position.set(px, WATER_LEVEL + 0.05, pz);
    foamDisc.renderOrder = 2;
    landmarkGroup.add(foamDisc);

    // Billowing waterfall mist spray sprites rising from the plunge pool
    const count = isMobile ? Math.max(3, Math.floor(sprayCount * 0.6)) : sprayCount;
    for (let i = 0; i < count; i++) {
      const sp = new THREE.Sprite(sprayMistMat);
      const frac = i / count;
      const spreadX = (rng() - 0.5) * wBot * 0.85;
      const ox = px + cosY * spreadX + sinY * (rng() * 1.8);
      const oz = pz - sinY * spreadX + cosY * (rng() * 1.8);
      const baseSc = plungeRadius * (0.72 + rng() * 0.62);
      sp.position.set(ox, WATER_LEVEL + 0.8 + frac * 3.4, oz);
      sp.scale.set(baseSc, baseSc * 0.82, 1);
      sp.renderOrder = 4;
      landmarkGroup.add(sp);
      spraySprites.push({
        sprite: sp,
        baseX: ox,
        baseY: WATER_LEVEL + 0.5,
        baseZ: oz,
        driftX: sinY * (1.2 + rng() * 1.4),
        driftZ: cosY * (1.2 + rng() * 1.4),
        riseH: 3.2 + rng() * 2.8,
        baseScale: baseSc,
        speed: 0.24 + rng() * 0.14,
        phase: frac + rng() * 0.2
      });
    }
  }

  // 3.1 Northern Waterfall: (72.0, 14.0 -> -0.1, 20.0) pouring SSW into Fishing Lagoon
  addWaterfallAssembly({
    name: 'Waterfall_3_1_Northern',
    x: 72.0,
    yTop: 14.0,
    z: 20.0,
    yaw: -0.42,
    dropForward: 4.8,
    wTop: 5.2,
    wBot: 7.6,
    plungeRadius: 6.8,
    sprayCount: 8
  });

  // 4.4 Gorge Waterfall: (19.0, 10.5 -> -0.1, 96.0) pouring Westward (-X) into Canyon River
  addWaterfallAssembly({
    name: 'Waterfall_4_4_Gorge',
    x: 20.6,
    yTop: 10.5,
    z: 96.0,
    yaw: -Math.PI * 0.5,
    dropForward: 3.8,
    wTop: 3.6,
    wBot: 5.4,
    plungeRadius: 4.8,
    sprayCount: 6
  });

  // --------------------------------------------------------------------------
  // 5. SOLID WALKABLE ARCHITECTURAL BRIDGES, PIERS, BOARDWALKS, STAIRS & PATHS
  //    (100% grounded shadow-casting masonry & timber — ZERO floating hero!)
  // --------------------------------------------------------------------------
  const archStoneParts = [];
  const archDeckParts = [];
  const archTimberParts = [];
  const archPierWoodParts = [];
  const archIronParts = [];
  const archGlassParts = [];
  const archGoldParts = [];

  function addBox(parts, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0, topHex = 0x8a99b2, botHex = 0x3b4456) {
    parts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz), topHex, botHex));
  }

  function addCyl(parts, rTop, rBot, h, segs, x, y, z, rx = 0, ry = 0, rz = 0, topHex = 0x867666, botHex = 0x342d26) {
    parts.push(tintGeo(THREE, xformGeo(new THREE.CylinderGeometry(rTop, rBot, h, segs), x, y, z, rx, ry, rz), topHex, botHex));
  }

  function addSteppedStairFlight(parts, { x0, y0, z0, x1, y1, z1, width = 4.0, steps = 16, sideWalls = true, depthExtra = 0.85 }) {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const horizLen = Math.hypot(dx, dz);
    const yaw = Math.atan2(dx, dz);
    const stepD = horizLen / steps;
    const baseMinY = Math.min(y0, y1);

    for (let i = 0; i < steps; i++) {
      const f = (i + 0.5) / steps;
      const sx = lerp(x0, x1, f);
      const sz = lerp(z0, z1, f);
      const topY = lerp(y0, y1, (i + 1) / steps);
      const terrainFloor = Math.min(baseMinY - depthExtra, safeEvalY(sx, sz) - 0.85);
      const hBlock = Math.max(0.65, topY - terrainFloor);
      addBox(
        parts,
        width,
        hBlock,
        stepD + 0.14,
        sx,
        topY - hBlock * 0.5,
        sz,
        0,
        yaw,
        0,
        0x96a5bf,
        0x363f52
      );
    }

    if (sideWalls) {
      const perpX = Math.cos(yaw);
      const perpZ = -Math.sin(yaw);
      const segs = Math.max(4, Math.round(horizLen / 4.2));
      for (const side of [-1, 1]) {
        for (let k = 0; k < segs; k++) {
          const f = (k + 0.5) / segs;
          const cx = lerp(x0, x1, f) + perpX * side * (width * 0.5 + 0.28);
          const cz = lerp(z0, z1, f) + perpZ * side * (width * 0.5 + 0.28);
          const baseY = lerp(y0, y1, f);
          const segH = 1.05 + (k % 2) * 0.16;
          addBox(archStoneParts, 0.52, segH, horizLen / segs + 0.18, cx, baseY + segH * 0.30, cz, 0, yaw, 0, 0x8896b0, 0x384154);
        }
      }
    }
  }

  // Helper: Gothic iron-bound glowing Treasure Chest prop (for 1.6, 3.6, 5.5)
  function addTreasureChestProp(x, y, z, yaw = 0, parent = landmarkGroup) {
    // Stone plinth / wooden base pad
    addBox(archStoneParts, 1.45, 0.26, 1.05, x, y + 0.11, z, 0, yaw, 0, 0x8f9db6, 0x3b4354);
    // Chest body (weathered dark oak)
    addBox(archTimberParts, 0.96, 0.48, 0.56, x, y + 0.48, z, 0, yaw, 0, 0x8d7660, 0x3c3026);
    // Rounded arched lid
    addCyl(archTimberParts, 0.28, 0.28, 0.96, 8, x, y + 0.72, z, 0, yaw, Math.PI * 0.5, 0x9c8268, 0x4b3c2f);
    // Forged iron straps & lock plate
    for (const off of [-0.36, 0.0, 0.36]) {
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      addBox(archIronParts, 0.07, 0.62, 0.60, x + cosY * off, y + 0.54, z - sinY * off, 0, yaw, 0, 0x5c6472, 0x262b34);
    }
    // Golden glowing clasp & relic trim
    const sinY = Math.sin(yaw);
    const cosY = Math.cos(yaw);
    addBox(archGoldParts, 0.18, 0.18, 0.08, x + sinY * 0.30, y + 0.64, z + cosY * 0.30, 0, yaw, 0, 0xffd580, 0x8d6322);
    addWarmSprite(parent, x, y + 0.95, z, 1.95, true);
  }

  // Helper: Rustic Timber Lantern Post (hanging warm lantern cage + glow halo)
  function addTimberLanternPost(x, yBase, z, armYaw = 0, postH = 3.15, parent = landmarkGroup) {
    // Timber post
    addCyl(archPierWoodParts, 0.10, 0.13, postH, 6, x, yBase + postH * 0.5, z, 0, 0, 0, 0x8c7a69, 0x332b24);
    // Iron gallows arm pointing along armYaw
    const ax = Math.sin(armYaw);
    const az = Math.cos(armYaw);
    const armLen = 0.78;
    addBox(archIronParts, 0.08, 0.08, armLen, x + ax * armLen * 0.48, yBase + postH - 0.16, z + az * armLen * 0.48, 0, armYaw, 0, 0x565f6e, 0x262b34);
    // Lantern cage & emissive amber glass core
    const lx = x + ax * (armLen - 0.06);
    const ly = yBase + postH - 0.48;
    const lz = z + az * (armLen - 0.06);
    addBox(archIronParts, 0.28, 0.07, 0.28, lx, ly + 0.22, lz, 0, armYaw, 0, 0x4b5260, 0x22262f);
    addBox(archIronParts, 0.26, 0.06, 0.26, lx, ly - 0.20, lz, 0, armYaw, 0, 0x4b5260, 0x22262f);
    addBox(archGlassParts, 0.20, 0.36, 0.20, lx, ly, lz, 0, armYaw, 0, 0xffe4a0, 0xff9b30);
    addWarmSprite(parent, lx, ly, lz, 1.95, false);
  }

  // --------------------------------------------------------------------------
  // 5A. SECTOR 01: WOODEN FERRY PIER (1.4), STEPPING-STONE FORD (P02) & CHEST (1.6)
  // --------------------------------------------------------------------------
  // Pier 1.4: x = +5.0..+12.5, z = 19.5..22.5, exact top Y = 0.65m
  {
    const pierY = 0.65;
    // Continuous solid flush walkable plank deck (x=5.0..12.5, z=19.5..22.5)
    addBox(archPierWoodParts, 7.6, 0.16, 3.0, 8.75, pierY - 0.08, 21.0, 0, 0, 0, 0x9b8875, 0x3b3129);
    // Subtle cross-plank relief slats along pier deck
    for (let px = 5.25; px <= 12.25; px += 0.48) {
      addBox(archPierWoodParts, 0.40, 0.04, 2.96, px, pierY - 0.015, 21.0 + (rng() - 0.5) * 0.05, 0, (rng() - 0.5) * 0.02, 0, 0xa89580, 0x4a3e33);
    }
    // Longitudinal heavy timber stringers underneath
    addBox(archPierWoodParts, 7.5, 0.22, 0.24, 8.75, pierY - 0.24, 19.85, 0, 0, 0, 0x7a6a5b, 0x2a221c);
    addBox(archPierWoodParts, 7.5, 0.22, 0.24, 8.75, pierY - 0.24, 22.15, 0, 0, 0, 0x7a6a5b, 0x2a221c);
    // Mossy timber pilings driven deep into riverbed (-1.6m)
    const pilingXs = [5.4, 7.7, 10.0, 12.2];
    for (let i = 0; i < pilingXs.length; i++) {
      const px = pilingXs[i];
      const isHead = i === pilingXs.length - 1;
      const topH = isHead ? pierY + 0.72 : pierY + 0.12;
      const h = topH + 1.65;
      addCyl(archPierWoodParts, 0.15, 0.18, h, 7, px, topH - h * 0.5, 19.62, 0, 0, 0, 0x867464, 0x221d18);
      addCyl(archPierWoodParts, 0.15, 0.18, h, 7, px, topH - h * 0.5, 22.38, 0, 0, 0, 0x867464, 0x221d18);
    }
    // West stone shore abutment grounding pier cleanly into riverbank
    addBox(archStoneParts, 1.35, 1.5, 3.3, 4.75, pierY - 0.76, 21.0, 0, 0, 0, 0x8a98b0, 0x323a4b);
    // Pier-head warm hanging lantern
    addTimberLanternPost(12.15, pierY, 19.65, -0.65, 3.05, landmarkGroup);
  }

  // Secret Stepping-Stone Ford P02: (10, 22) -> (26, 38), y = 0.25m rising to 0.85m
  {
    const fordPadCount = 13;
    for (let i = 0; i < fordPadCount; i++) {
      const t = i / (fordPadCount - 1);
      const fx = lerp(10.0, 26.0, t) + Math.sin(t * Math.PI * 2.2) * 1.15;
      const fz = lerp(22.0, 38.0, t) - Math.sin(t * Math.PI * 2.2) * 0.75;
      const topY = lerp(0.25, 0.85, smoothstep(0.55, 1.0, t));
      const padR = 1.15 + (i % 3) * 0.16;
      const padH = topY + 1.25;
      const cyl = new THREE.CylinderGeometry(padR, padR * 1.18, padH, 7);
      xformGeo(cyl, fx, topY - padH * 0.5, fz, (rng() - 0.5) * 0.03, rng() * 6.28, (rng() - 0.5) * 0.03, 1.12, 1.0, 0.92);
      archDeckParts.push(tintGeo(THREE, cyl, 0x8d9cb2, 0x2b3342));
    }
    // 1.6 Glowing Secret Shoal Treasure Chest on mossy stone island pad near (14.5, 0.25, 26.5)
    const islandH = 1.45;
    const islandGeo = new THREE.CylinderGeometry(2.15, 2.55, islandH, 8);
    xformGeo(islandGeo, 14.5, 0.26 - islandH * 0.5, 26.5);
    archStoneParts.push(tintGeo(THREE, islandGeo, 0x8695ad, 0x293140));
    addTreasureChestProp(14.5, 0.26, 26.5, -0.78, landmarkGroup);
  }

  // --------------------------------------------------------------------------
  // 5B. SECTOR 02: OLD FISHERMAN'S BRIDGE (2.3 / P03)
  //     x = +3.5..+30.0, z = 47.0..51.0, exact top Y = 1.35m + 4 stone piers + lanterns!
  // --------------------------------------------------------------------------
  {
    const brY = 1.35;
    // West ramp/abutment connecting Sector 02 road/shoal (x=2.2..4.2) up to bridge deck (y=1.35m)
    addSteppedStairFlight(archDeckParts, {
      x0: 2.2, y0: Math.max(0.45, safeEvalY(2.2, 49.0)), z0: 49.0,
      x1: 4.1, y1: brY, z1: 49.0,
      width: 3.9, steps: 5, sideWalls: false, depthExtra: 1.2
    });
    // Heavy solid timber deck spanning x = 3.5..30.2, z = 47.0..51.0, top exact Y = 1.35m
    addBox(archTimberParts, 26.8, 0.20, 4.0, 16.85, brY - 0.10, 49.0, 0, 0, 0, 0x9b8875, 0x3d322a);
    // Longitudinal support beams
    for (const bz of [47.35, 49.0, 50.65]) {
      addBox(archTimberParts, 26.6, 0.28, 0.28, 16.85, brY - 0.34, bz, 0, 0, 0, 0x7b6a5b, 0x2c241d);
    }
    // 4 Monumental Mossy Ashlar Stone River Piers with pointed cutwaters (x = 8.0, 14.0, 20.0, 26.0)
    const pierXs = [8.0, 14.0, 20.0, 26.0];
    for (let i = 0; i < pierXs.length; i++) {
      const px = pierXs[i];
      const pH = brY + 2.25;
      addBox(archStoneParts, 1.55, pH, 4.65, px, brY - 0.24 - pH * 0.5, 49.0, 0, 0, 0, 0x8997b0, 0x2a3140);
      // Upstream/downstream cutwater prows
      addBox(archStoneParts, 0.95, pH - 0.35, 0.95, px, brY - 0.42 - (pH - 0.35) * 0.5, 46.65, 0, Math.PI * 0.25, 0, 0x94a3bd, 0x2d3546);
      addBox(archStoneParts, 0.95, pH - 0.35, 0.95, px, brY - 0.42 - (pH - 0.35) * 0.5, 51.35, 0, Math.PI * 0.25, 0, 0x94a3bd, 0x2d3546);
      // Diagonal timber knee braces up to bridge stringers
      addBox(archTimberParts, 0.20, 1.25, 0.20, px - 0.95, brY - 0.72, 47.4, 0, 0, -0.58, 0x7b6a5b, 0x2c241d);
      addBox(archTimberParts, 0.20, 1.25, 0.20, px + 0.95, brY - 0.72, 47.4, 0, 0, 0.58, 0x7b6a5b, 0x2c241d);
      addBox(archTimberParts, 0.20, 1.25, 0.20, px - 0.95, brY - 0.72, 50.6, 0, 0, -0.58, 0x7b6a5b, 0x2c241d);
      addBox(archTimberParts, 0.20, 1.25, 0.20, px + 0.95, brY - 0.72, 50.6, 0, 0, 0.58, 0x7b6a5b, 0x2c241d);
    }
    // Weathered side railing posts & top rails along z = 47.08 & z = 50.92
    for (let px = 4.4; px <= 29.6; px += 3.15) {
      addBox(archTimberParts, 0.18, 1.05, 0.18, px, brY + 0.50, 47.08, 0, 0, 0, 0x8f7d6c, 0x352c24);
      addBox(archTimberParts, 0.18, 1.05, 0.18, px, brY + 0.50, 50.92, 0, 0, 0, 0x8f7d6c, 0x352c24);
    }
    // Segmented top rails with 1 authentic weathered gap
    addBox(archTimberParts, 11.2, 0.12, 0.16, 10.0, brY + 0.94, 47.08, 0, 0, 0, 0x998674, 0x3c3229);
    addBox(archTimberParts, 11.4, 0.12, 0.16, 23.8, brY + 0.94, 47.08, 0, 0, 0, 0x998674, 0x3c3229);
    addBox(archTimberParts, 13.8, 0.12, 0.16, 11.3, brY + 0.94, 50.92, 0, 0, 0, 0x998674, 0x3c3229);
    addBox(archTimberParts, 9.6, 0.12, 0.16, 24.8, brY + 0.94, 50.92, 0, 0, 0, 0x998674, 0x3c3229);
    // 4 Hanging amber bridge lanterns illuminating the dark river crossing!
    addTimberLanternPost(6.8, brY, 47.08, 0.0, 3.05, landmarkGroup);
    addTimberLanternPost(13.8, brY, 50.92, Math.PI, 3.05, landmarkGroup);
    addTimberLanternPost(20.6, brY, 47.08, 0.0, 3.05, landmarkGroup);
    addTimberLanternPost(27.8, brY, 50.92, Math.PI, 3.05, landmarkGroup);
  }

  // --------------------------------------------------------------------------
  // 5C. SECTOR 03: STILT VILLAGE BOARDWALK HUB, PIER BONFIRE BASTION,
  //     CHAPEL & BARGE SPURS, WATCH-CLIFF STAIRCASE (3.5) & FOREST TRAIL (P06)
  // --------------------------------------------------------------------------
  {
    const hubY = 1.35;
    // Main Walkable Boardwalk Hub: x = 28..52, z = 38..62, exact top Y = 1.35m
    addBox(archPierWoodParts, 24.2, 0.22, 24.2, 40.0, hubY - 0.11, 50.0, 0, 0, 0, 0x968574, 0x383028);
    // Structural timber sub-beams & mossy piling forest underneath down to y = -2.0m
    for (let px = 28.5; px <= 51.5; px += 4.6) {
      addBox(archPierWoodParts, 0.26, 0.30, 24.0, px, hubY - 0.36, 50.0, 0, 0, 0, 0x736456, 0x26201a);
      for (let pz = 38.5; pz <= 61.5; pz += 4.6) {
        const isEdge = (px < 30.0 || px > 50.0 || pz < 40.0 || pz > 60.0);
        const topP = isEdge ? hubY + 0.52 : hubY - 0.15;
        const pH = topP + 2.05;
        addCyl(archPierWoodParts, 0.16, 0.20, pH, 6, px, topP - pH * 0.5, pz, 0, 0, 0, 0x7e6e5f, 0x1e1915);
      }
    }
    // Cross-deck timber curb beams along outer boardwalk perimeter
    addBox(archPierWoodParts, 24.2, 0.14, 0.26, 40.0, hubY + 0.05, 38.05, 0, 0, 0, 0x8f7e6d, 0x342c24);
    addBox(archPierWoodParts, 24.2, 0.14, 0.26, 40.0, hubY + 0.05, 61.95, 0, 0, 0, 0x8f7e6d, 0x342c24);
    addBox(archPierWoodParts, 0.26, 0.14, 10.0, 28.05, hubY + 0.05, 42.8, 0, 0, 0, 0x8f7e6d, 0x342c24);
    addBox(archPierWoodParts, 0.26, 0.14, 10.6, 28.05, hubY + 0.05, 56.5, 0, 0, 0, 0x8f7e6d, 0x342c24);

    // Ford P02 -> Village SW Boardwalk landing steps: (26.0, 0.85, 38.0) -> (28.8, 1.35, 40.2)
    addSteppedStairFlight(archPierWoodParts, {
      x0: 25.8, y0: 0.85, z0: 37.8,
      x1: 28.8, y1: hubY, z1: 40.4,
      width: 3.4, steps: 4, sideWalls: false, depthExtra: 1.4
    });

    // 3.2 Stone Pier Bonfire Bastion at (46.0, 1.65, 54.0) — solid octagonal/square masonry plinth
    const bastY = 1.65;
    addBox(archStoneParts, 7.6, 3.45, 7.6, 46.0, bastY - 1.78, 54.0, 0, 0, 0, 0x8897b0, 0x2b3242);
    addBox(archDeckParts, 7.4, 0.20, 7.4, 46.0, bastY - 0.10, 54.0, 0, 0, 0, 0x9caac4, 0x4b556b);
    // Wide flush approach steps connecting hub (1.35m) up to Bastion (1.65m) on West & South sides
    addBox(archDeckParts, 0.90, 0.22, 6.2, 41.9, 1.46, 54.0, 0, 0, 0, 0x95a4be, 0x454f63);
    addBox(archDeckParts, 6.2, 0.22, 0.90, 46.0, 1.46, 49.9, 0, 0, 0, 0x95a4be, 0x454f63);
    // Low weathered gothic parapet curbs framing the bastion corners
    addBox(archStoneParts, 0.56, 0.72, 2.8, 49.65, bastY + 0.34, 51.6, 0, 0, 0, 0x8c9cb8, 0x3a4358);
    addBox(archStoneParts, 2.8, 0.72, 0.56, 43.8, bastY + 0.34, 57.65, 0, 0, 0, 0x8c9cb8, 0x3a4358);

    // 3.4 Chapel Boardwalk Spur: (46, 52) -> (56, 40) at exact y = 1.35m + Stone Chapel Plinth!
    {
      const dx = 56.0 - 46.0;
      const dz = 40.0 - 52.0;
      const len = Math.hypot(dx, dz);
      const yaw = Math.atan2(dx, dz);
      addBox(archPierWoodParts, 3.8, 0.22, len + 1.4, 51.0, hubY - 0.11, 46.0, 0, yaw, 0, 0x978674, 0x393028);
      for (let k = 1; k <= 4; k++) {
        const f = k / 5;
        const px = lerp(46.0, 56.0, f);
        const pz = lerp(52.0, 40.0, f);
        const perpX = Math.cos(yaw) * 1.65;
        const perpZ = -Math.sin(yaw) * 1.65;
        addCyl(archPierWoodParts, 0.15, 0.18, 3.6, 6, px + perpX, hubY - 1.5, pz + perpZ, 0, 0, 0, 0x7e6e5f, 0x1f1a16);
        addCyl(archPierWoodParts, 0.15, 0.18, 3.6, 6, px - perpX, hubY - 1.5, pz - perpZ, 0, 0, 0, 0x7e6e5f, 0x1f1a16);
      }
      // Solid mossy stone foundation plinth under Sunken Chapel at (56.0, 1.35, 40.0)
      // Matched to real Sunken_Chapel_Stone GLB bounds (6.2m X x 8.5m Z) with 1.2m walkable ambulatory skirt!
      addBox(archStoneParts, 8.8, 3.1, 10.8, 56.0, hubY - 1.62, 40.0, 0, 0.22, 0, 0x8594ae, 0x283040);
      addBox(archDeckParts, 8.4, 0.22, 10.4, 56.0, hubY - 0.11, 40.0, 0, 0.22, 0, 0x98a7c2, 0x485268);
    }

    // 3.6 Wrecked Barge Spur: (56, 40, y=1.35) -> (64, 32, y=0.85) + landing deck + secret chest!
    {
      const dx = 64.0 - 56.0;
      const dz = 32.0 - 40.0;
      const len = Math.hypot(dx, dz);
      const yaw = Math.atan2(dx, dz);
      addSteppedStairFlight(archPierWoodParts, {
        x0: 57.5, y0: hubY, z0: 38.5,
        x1: 63.0, y1: 0.85, z1: 33.0,
        width: 3.0, steps: 6, sideWalls: false, depthExtra: 2.2
      });
      // Walkable barge wreckage landing deck around (64.0, 0.85, 32.0)
      addBox(archPierWoodParts, 5.4, 0.22, 4.4, 64.0, 0.85 - 0.11, 32.0, 0, yaw, 0, 0x938270, 0x362d26);
      for (const ox of [-2.2, 2.2]) {
        for (const oz of [-1.7, 1.7]) {
          addCyl(archPierWoodParts, 0.15, 0.18, 2.8, 6, 64.0 + ox, -0.45, 32.0 + oz, 0, 0, 0, 0x7a6a5c, 0x1e1915);
        }
      }
      addTreasureChestProp(64.6, 0.85, 31.4, -2.35, landmarkGroup);
    }

    // 3.5 Watch-Cliff Stepped Stone Staircase: x = 48..56, z = 60..86, y = 1.65 -> 8.2m
    //     + Watch-Cliff Turret Landing Terrace around (55.0, 8.2, 80.0)!
    addBox(archDeckParts, 7.0, 0.26, 4.4, 50.5, 1.65 - 0.13, 59.5, 0, 0, 0, 0x99a8c2, 0x4b556b);
    addBox(archStoneParts, 7.2, 2.8, 4.6, 50.5, 1.65 - 1.55, 59.5, 0, 0, 0, 0x7e8ca6, 0x2c3445);
    addSteppedStairFlight(archDeckParts, {
      x0: 51.8, y0: 1.65, z0: 60.5,
      x1: 52.2, y1: 8.20, z1: 80.0,
      width: 5.4, steps: 28, sideWalls: true, depthExtra: 1.6
    });
    // Wide stone coastal beacon terrace at y = 8.20m (x = 48..58.5, z = 78.5..86.5)
    addBox(archStoneParts, 10.6, 6.2, 8.2, 53.2, 8.20 - 3.22, 82.5, 0, 0, 0, 0x7c8aa4, 0x283040);
    addBox(archDeckParts, 10.4, 0.26, 8.0, 53.2, 8.20 - 0.13, 82.5, 0, 0, 0, 0x9aa9c4, 0x4d576c);
    // Weathered cliff-edge parapet merlons overlooking the lagoon
    for (let mz = 79.4; mz <= 85.4; mz += 2.0) {
      addBox(archStoneParts, 0.56, 0.96, 1.25, 48.1, 8.66, mz, 0, 0, 0, 0x92a1bc, 0x414b60);
    }

    // P06 Stone Forest Outpost Trail: x = 48..56, z = 86..102, y = 8.2 -> 10.5m
    addSteppedStairFlight(archDeckParts, {
      x0: 52.0, y0: 8.20, z0: 86.0,
      x1: 52.0, y1: 10.50, z1: 102.0,
      width: 5.8, steps: 16, sideWalls: false, depthExtra: 1.2
    });
    // Low trail boundary kerbs & marker monoliths at P06 Sector 03->05 gate
    for (let kz = 88.0; kz <= 101.0; kz += 3.2) {
      const ky = lerp(8.20, 10.50, (kz - 86.0) / 16.0);
      addBox(archStoneParts, 0.48, 0.62, 1.9, 48.8, ky + 0.22, kz, 0, 0, 0, 0x8695ae, 0x353e50);
      addBox(archStoneParts, 0.48, 0.62, 1.9, 55.2, ky + 0.22, kz, 0, 0, 0, 0x8695ae, 0x353e50);
    }
    // Connecting stone landing spur for SC-4 Kick-Down Log Bridge south landing: (42, 8.5, 88) -> (49, 8.5, 88)
    addBox(archStoneParts, 8.4, 4.6, 4.4, 45.2, 8.50 - 2.42, 88.0, 0, 0, 0, 0x7d8ba4, 0x2b3242);
    addBox(archDeckParts, 8.2, 0.24, 4.2, 45.2, 8.50 - 0.12, 88.0, 0, 0, 0, 0x9aa8c2, 0x4b556b);
    // Stone log-receiving cradle at (42.0, 8.5, 88.0)
    addBox(archStoneParts, 0.65, 0.85, 2.2, 40.5, 8.85, 88.0, 0, 0, 0, 0x8d9cb6, 0x3a4356);
    addBox(archStoneParts, 0.65, 0.85, 2.2, 43.5, 8.85, 88.0, 0, 0, 0, 0x8d9cb6, 0x3a4356);
  }

  // --------------------------------------------------------------------------
  // 5D. SECTOR 04 -> 05: EAST AQUEDUCT EXTENSION (P07)
  //     Arched stone bridge: x = +5.0..+34.0, z = 80.3..83.7, y = 5.60 -> 10.50m
  //     Carved North Cliff Ledge: x = +31.0..+37.0, z = 83.0..102.0, y = 10.50m
  // --------------------------------------------------------------------------
  {
    const aqX0 = 5.0;
    const aqX1 = 34.0;
    const aqY0 = 5.60;
    const aqY1 = 10.50;
    const aqSpan = aqX1 - aqX0; // 29.0m
    const aqSlopeAngle = Math.atan2(aqY1 - aqY0, aqSpan); // ~0.1674 rad
    const aqLen3D = Math.hypot(aqSpan, aqY1 - aqY0);

    // Continuous flush walkable sloped stone viaduct deck (exact y = 5.60 -> 10.50m)
    const midX = (aqX0 + aqX1) * 0.5;
    const midY = (aqY0 + aqY1) * 0.5;
    addBox(archDeckParts, aqLen3D + 0.5, 0.34, 3.5, midX, midY - 0.17, 82.0, 0, 0, aqSlopeAngle, 0x9caac4, 0x4c566b);
    // Thick stone viaduct spandrel fascia beneath deck
    addBox(archStoneParts, aqLen3D + 0.4, 1.35, 3.7, midX, midY - 0.98, 82.0, 0, 0, aqSlopeAngle, 0x8392ac, 0x30384a);

    // 4 Soaring Gothic Stone Aqueduct Piers & Arched Rib Haunches (x = 9.8, 17.2, 24.6, 32.0)
    const aqPierXs = [9.8, 17.2, 24.6, 32.0];
    for (let i = 0; i < aqPierXs.length; i++) {
      const px = aqPierXs[i];
      const pyTop = lerp(aqY0, aqY1, (px - aqX0) / aqSpan) - 0.55;
      const pBot = -2.4;
      const pH = pyTop - pBot;
      addBox(archStoneParts, 1.95, pH, 4.15, px, pBot + pH * 0.5, 82.0, 0, 0, 0, 0x8493ad, 0x283040);
      // Buttress plinth foot
      addBox(archStoneParts, 2.55, 2.4, 4.75, px, pBot + 1.2, 82.0, 0, 0, 0, 0x7b89a2, 0x232a38);
      // Pointed Gothic arch voussoir haunches flanking each pier
      if (i < aqPierXs.length - 1) {
        const nx = aqPierXs[i + 1];
        const archMidX = (px + nx) * 0.5;
        const archTopY = lerp(aqY0, aqY1, (archMidX - aqX0) / aqSpan) - 1.15;
        addBox(archStoneParts, 1.9, 1.85, 3.6, px + 1.45, archTopY - 1.05, 82.0, 0, 0, -0.58, 0x8897b2, 0x31394a);
        addBox(archStoneParts, 1.9, 1.85, 3.6, nx - 1.45, archTopY - 0.72, 82.0, 0, 0, 0.58, 0x8897b2, 0x31394a);
      }
    }

    // Broken weathered Gothic parapets flanking Aqueduct Extension along z = 80.22 & z = 83.78
    for (let k = 0; k < 9; k++) {
      const f = (k + 0.5) / 9;
      const px = lerp(aqX0 + 1.0, aqX1 - 1.0, f);
      const py = lerp(aqY0, aqY1, (px - aqX0) / aqSpan);
      const segH = (k % 3 === 1) ? 0.52 : 0.94;
      addBox(archStoneParts, 2.75, segH, 0.42, px, py + segH * 0.48, 80.22, 0, 0, aqSlopeAngle, 0x95a4be, 0x424c61);
      addBox(archStoneParts, 2.75, (k % 3 === 2) ? 0.48 : 0.92, 0.42, px, py + 0.44, 83.78, 0, 0, aqSlopeAngle, 0x95a4be, 0x424c61);
    }

    // Aqueduct Corner Bastion & Carved North Cliff Ledge: x = +31..+37, z = 80.2..102.2, exact Y = 10.50m!
    const ledgeY = 10.50;
    addBox(archStoneParts, 6.4, 9.6, 22.4, 34.0, ledgeY - 4.94, 91.2, 0, 0, 0, 0x7c8aa4, 0x262d3d);
    addBox(archDeckParts, 6.2, 0.28, 22.2, 34.0, ledgeY - 0.14, 91.2, 0, 0, 0, 0x9caac4, 0x4e586d);
    // West cliff-edge battlement merlons overlooking Gorge Waterfall 4.4 right below!
    for (let mz = 84.8; mz <= 101.2; mz += 2.6) {
      addBox(archStoneParts, 0.52, 0.98, 1.55, 31.05, ledgeY + 0.48, mz, 0, 0, 0, 0x93a2bd, 0x424c61);
    }
    // Warm sightline lantern at Aqueduct turn & ledge midpoint
    addTimberLanternPost(36.4, ledgeY, 81.2, -0.78, 3.10, landmarkGroup);
    addTimberLanternPost(31.5, ledgeY, 94.5, 1.57, 3.05, landmarkGroup);
  }

  // --------------------------------------------------------------------------
  // 5E. SECTOR 05: WOLF RAVINE BRIDGE (5.3), OVERLOOK (5.4), FOREST RUINS (5.5),
  //     FOREST RUINS ASCENT (P10) & ANIMATED KICK-DOWN LOG BRIDGE (SC-4)!
  // --------------------------------------------------------------------------
  // 5.3 Wolf Ravine Plank Bridge: x = +31..+37, z = 102..118, y = 10.5 -> 12.2m
  {
    const z0 = 102.0;
    const z1 = 118.0;
    const y0 = 10.50;
    const y1 = 12.20;
    const spanZ = z1 - z0;
    const pitch = Math.atan2(y1 - y0, spanZ);
    const len3D = Math.hypot(spanZ, y1 - y0);

    // Stone ravine abutments at South & North ends
    addBox(archStoneParts, 6.2, 5.2, 2.2, 34.0, y0 - 2.65, z0 - 0.5, 0, 0, 0, 0x8290aa, 0x2a3140);
    addBox(archStoneParts, 6.2, 5.2, 2.4, 34.0, y1 - 2.65, z1 + 0.6, 0, 0, 0, 0x8290aa, 0x2a3140);

    // Solid flush sloped timber sub-deck beneath Ravine_Plank_Bridge GLB bays (exact y = 10.50 -> 12.20m)
    addBox(archTimberParts, 5.2, 0.22, len3D + 0.5, 34.0, (y0 + y1) * 0.5 - 0.13, (z0 + z1) * 0.5, -pitch, 0, 0, 0x998674, 0x3b3129);
    // Heavy timber trestle bents & cross-braces descending deep into the Wolf Ravine
    for (const tz of [105.5, 110.0, 114.5]) {
      const ty = lerp(y0, y1, (tz - z0) / spanZ);
      const tH = 7.4;
      addCyl(archTimberParts, 0.22, 0.26, tH, 7, 31.6, ty - 0.22 - tH * 0.5, tz, 0, 0, 0, 0x7e6d5d, 0x26201a);
      addCyl(archTimberParts, 0.22, 0.26, tH, 7, 36.4, ty - 0.22 - tH * 0.5, tz, 0, 0, 0, 0x7e6d5d, 0x26201a);
      addBox(archTimberParts, 5.2, 0.28, 0.28, 34.0, ty - 0.44, tz, 0, 0, 0, 0x7a695a, 0x2c241d);
      addBox(archTimberParts, 5.8, 0.20, 0.20, 34.0, ty - 2.4, tz, 0, 0, 0.58, 0x726254, 0x28211b);
      addBox(archTimberParts, 5.8, 0.20, 0.20, 34.0, ty - 2.4, tz, 0, 0, -0.58, 0x726254, 0x28211b);
    }

    // Smooth stepped stone ramp joining Ravine Bridge north end (34, 12.2, 118) into Camp clearing (38, 13.5, 122)
    addSteppedStairFlight(archDeckParts, {
      x0: 34.0, y0: 12.20, z0: 117.8,
      x1: 38.2, y1: 13.50, z1: 122.4,
      width: 5.2, steps: 6, sideWalls: false, depthExtra: 1.4
    });
  }

  // 5.1 Hunter Camp Bonfire Stone Hearth Pad at (50.0, 13.5, 134.0) & 5.2 Watchtower stone footings
  {
    const hearthGeo = new THREE.CylinderGeometry(3.4, 3.7, 0.32, 10);
    xformGeo(hearthGeo, 50.0, 13.50 - 0.14, 134.0);
    archDeckParts.push(tintGeo(THREE, hearthGeo, 0x98a6c0, 0x465066));
    // Stone watchtower footings at (41.0, 13.5, 126.0)
    for (const ox of [-1.8, 1.8]) {
      for (const oz of [-1.8, 1.8]) {
        addBox(archStoneParts, 0.95, 1.4, 0.95, 41.0 + ox, 13.50 - 0.65, 126.0 + oz, 0, 0, 0, 0x8694ae, 0x303848);
      }
    }
    // Camp gate lanterns
    addTimberLanternPost(37.6, 13.50, 123.6, 0.85, 3.15, landmarkGroup);
    addTimberLanternPost(54.8, 13.50, 136.2, -1.9, 3.15, landmarkGroup);
    addTimberLanternPost(46.2, 13.50, 148.0, 0.0, 3.15, landmarkGroup);
  }

  // 5.4 Overlook Cliff Vista Platform at (28.0, 12.8, 128.0) overlooking Gorge Road & River!
  {
    const ovY = 12.80;
    addBox(archStoneParts, 6.2, 4.8, 6.0, 28.0, ovY - 2.52, 128.0, 0, 0.18, 0, 0x7c8aa4, 0x262e3e);
    addBox(archTimberParts, 5.8, 0.24, 5.6, 28.0, ovY - 0.12, 128.0, 0, 0.18, 0, 0x948270, 0x372f27);
    // Low cliffside timber overlook rail on West edge
    addBox(archTimberParts, 0.18, 0.95, 5.4, 25.25, ovY + 0.45, 128.0, 0, 0.18, 0, 0x8e7c6a, 0x332b23);
    addTimberLanternPost(26.4, ovY, 130.2, 1.5, 2.95, landmarkGroup);
  }

  // 5.5 Forest Ruins Stone Plinth & Secret Chest at (64.0, 15.2, 152.0)
  {
    const rY = 15.20;
    addBox(archStoneParts, 9.4, 3.2, 9.4, 64.0, rY - 1.72, 152.0, 0, 0.25, 0, 0x7e8ca6, 0x283040);
    addBox(archDeckParts, 9.0, 0.24, 9.0, 64.0, rY - 0.12, 152.0, 0, 0.25, 0, 0x99a8c2, 0x4b556b);
    addTreasureChestProp(64.0, rY, 152.0, -2.15, landmarkGroup);
  }

  // P10 Forest Ruins Ascent to Sector 07: x = +40..+48, z = 150..182, y = 13.5 -> 20.5m
  {
    addSteppedStairFlight(archDeckParts, {
      x0: 44.0, y0: 13.50, z0: 150.0,
      x1: 44.0, y1: 20.50, z1: 182.0,
      width: 6.4, steps: 30, sideWalls: true, depthExtra: 1.8
    });
    // Monumental Forest Ruins Portal Piers framing top of P10 at z = 180.5 (clear 5.2m opening!)
    addBox(archStoneParts, 1.85, 6.8, 2.1, 40.2, 20.2 + 3.2, 180.5, 0, 0, 0, 0x8897b2, 0x2d3546);
    addBox(archStoneParts, 1.85, 6.2, 2.1, 47.8, 20.2 + 2.9, 180.5, 0, 0, 0, 0x8897b2, 0x2d3546);
    addBox(archStoneParts, 9.8, 1.25, 2.2, 44.0, 20.2 + 6.4, 180.5, 0, 0, 0, 0x92a2be, 0x384154);
    addTimberLanternPost(41.2, 20.2, 179.2, 0.4, 3.05, landmarkGroup);
  }

  // Merge all solid structural geometry buckets into minimal shadow-casting draw calls!
  function addMergedBucket(parts, mat, boxUvTile, withColor, name, castShadow = true, receiveShadow = true) {
    if (!parts.length) return null;
    const g = regGeo(mergeNonIndexedGeos(THREE, parts, { boxUvTile, withColor }));
    if (!g) return null;
    const mesh = new THREE.Mesh(g, mat);
    mesh.name = name;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    landmarkGroup.add(mesh);
    return mesh;
  }

  addMergedBucket(archStoneParts, ruinStoneMat, 2.8, true, 'EastReach_ArchStone');
  addMergedBucket(archDeckParts, ruinStoneDeckMat, 2.4, true, 'EastReach_ArchDecks');
  addMergedBucket(archTimberParts, timberWoodMat, 2.2, true, 'EastReach_ArchTimber');
  addMergedBucket(archPierWoodParts, wetPierTimberMat, 2.0, true, 'EastReach_PierWood');
  addMergedBucket(archIronParts, forgedIronMat, 1.2, true, 'EastReach_Iron');
  addMergedBucket(archGlassParts, lanternGlassMat, 0.8, false, 'EastReach_LanternGlass', false, false);
  addMergedBucket(archGoldParts, chestGoldMat, 0.8, false, 'EastReach_ChestTrim', false, true);

  // --------------------------------------------------------------------------
  // 5F. SHORTCUT SC-4: ANIMATED KICK-DOWN LOG BRIDGE AT (42, 13.5, 118) -> (42, 8.5, 88)
  // --------------------------------------------------------------------------
  const LOG_SPAN_Z = 30.0;
  const LOG_DROP_Y = 5.0;
  const LOG_LEN = Math.hypot(LOG_SPAN_Z, LOG_DROP_Y); // 30.4138m
  const LOG_DOWN_ANGLE = -Math.atan2(LOG_DROP_Y, LOG_SPAN_Z); // -0.16515 rad -> lands at exact (42, 8.5, 88)!
  const LOG_UP_ANGLE = 1.32; // Upright precariously leaning pine trunk (~75.6 deg) before kicked down!

  const logShortcutPivot = new THREE.Group();
  logShortcutPivot.name = 'Shortcut_SC4_LogBridgePivot';
  logShortcutPivot.position.set(42.0, 13.50, 118.0);
  landmarkGroup.add(logShortcutPivot);

  {
    const logBarkParts = [];
    const logPlankParts = [];
    const logIronParts = [];

    // Main massive gnarled pine trunk extending along local -Z from 0 to -LOG_LEN
    const segs = 10;
    const segLen = LOG_LEN / segs;
    for (let i = 0; i < segs; i++) {
      const f0 = i / segs;
      const f1 = (i + 1) / segs;
      const fm = (f0 + f1) * 0.5;
      const r0 = lerp(1.18, 0.86, f0);
      const r1 = lerp(1.18, 0.86, f1);
      const zMid = -fm * LOG_LEN;
      const xWob = Math.sin(fm * Math.PI * 2.0) * 0.14;
      const cyl = new THREE.CylinderGeometry(r1, r0, segLen + 0.16, 9);
      // Orient cylinder along -Z (rotateX +PI/2 puts +Y toward +Z, so rotateX -PI/2 puts +Y toward -Z!)
      xformGeo(cyl, xWob, -r0 * 0.55, zMid, -Math.PI * 0.5, 0, 0);
      logBarkParts.push(tintGeo(THREE, cyl, 0x867462, 0x2c241d));

      // Stubbed side pine branches sticking out asymmetrically for rugged organic silhouette
      if (i > 1 && i < segs - 1 && i % 2 === 0) {
        const side = (i % 4 === 0) ? 1 : -1;
        const br = new THREE.CylinderGeometry(0.10, 0.24, 1.9, 6);
        xformGeo(br, xWob + side * (r0 + 0.48), -r0 * 0.45, zMid, 0.18, 0, -side * 1.15);
        logBarkParts.push(tintGeo(THREE, br, 0x7c6a5a, 0x28211b));
      }
    }

    // Hewn flat walkable top plank crown flush with Y = 0.0 in pivot space so hero walks dead-smooth!
    const topCrown = new THREE.BoxGeometry(2.32, 0.24, LOG_LEN + 0.3);
    xformGeo(topCrown, 0.0, -0.10, -LOG_LEN * 0.5);
    logPlankParts.push(tintGeo(THREE, topCrown, 0x9b8976, 0x3f342b));

    // Iron-banded rope lashings & axe-cut notch markings near hinge end
    for (const lz of [-1.6, -8.5, -15.5, -22.5, -28.6]) {
      const band = new THREE.TorusGeometry(1.06, 0.075, 6, 12);
      xformGeo(band, 0.0, -0.58, lz);
      logIronParts.push(tintGeo(THREE, band, 0x525a68, 0x22262e));
    }

    const logBarkMesh = new THREE.Mesh(
      regGeo(mergeNonIndexedGeos(THREE, logBarkParts, { boxUvTile: 2.0, withColor: true })),
      barkMat
    );
    logBarkMesh.castShadow = true;
    logBarkMesh.receiveShadow = true;
    logShortcutPivot.add(logBarkMesh);

    const logTopMesh = new THREE.Mesh(
      regGeo(mergeNonIndexedGeos(THREE, logPlankParts, { boxUvTile: 2.2, withColor: true })),
      timberWoodMat
    );
    logTopMesh.castShadow = true;
    logTopMesh.receiveShadow = true;
    logShortcutPivot.add(logTopMesh);

    const logBandMesh = new THREE.Mesh(
      regGeo(mergeNonIndexedGeos(THREE, logIronParts, { boxUvTile: 1.0, withColor: true })),
      forgedIronMat
    );
    logBandMesh.castShadow = true;
    logShortcutPivot.add(logBandMesh);

    // Grounded mossy tree-stump hinge pedestal right at (42.0, 13.5, 118.4)
    const stumpGeo = regGeo(tintGeo(THREE, xformGeo(new THREE.CylinderGeometry(1.15, 1.55, 1.25, 9), 42.0, 13.15, 118.45), 0x867462, 0x26201a));
    const stumpMesh = new THREE.Mesh(stumpGeo, barkMat);
    stumpMesh.castShadow = true;
    stumpMesh.receiveShadow = true;
    landmarkGroup.add(stumpMesh);
  }

  let logShortcutUnlocked = false;
  let logShortcutAnim = 0.0;

  function applyLogShortcutPose() {
    const t = clamp01(logShortcutAnim);
    // Gravity-accelerated crash down with subtle damped wood-thud bounce at impact
    let ease;
    if (t < 0.88) {
      const u = t / 0.88;
      ease = u * u * u;
    } else {
      const u = (t - 0.88) / 0.12;
      ease = 1.0 - Math.sin(u * Math.PI) * 0.022 * (1.0 - u);
    }
    logShortcutPivot.rotation.x = lerp(LOG_UP_ANGLE, LOG_DOWN_ANGLE, ease);
  }
  applyLogShortcutPose();

  function setLogShortcutUnlocked(unlocked, instant = false) {
    logShortcutUnlocked = Boolean(unlocked);
    if (instant) {
      logShortcutAnim = logShortcutUnlocked ? 1.0 : 0.0;
    }
    applyLogShortcutPose();
  }

  // --------------------------------------------------------------------------
  // 6. ROARING SMOKY CAMPFIRES & ELEVATED BEACONS VIA `campfireRig.addCampfire`
  //    (STRICTLY addPointLight: false — ZERO extra PointLights!)
  // --------------------------------------------------------------------------
  function registerEastCampfire(x, y, z, scale = 1.2, haloScale = 2.6) {
    if (campfireRig && typeof campfireRig.addCampfire === 'function') {
      const handle = campfireRig.addCampfire(x, y, z, {
        scale,
        litUniform: alwaysOneUniform,
        phase: x * 0.57 + z * 0.41,
        addPointLight: false
      });
      if (handle) campfireHandles.push(handle);
    }
    addWarmSprite(landmarkGroup, x, y + 0.95 * scale, z, haloScale, false);
  }

  // 1) 3.2 Pier Bonfire (46, 1.65, 54)
  registerEastCampfire(46.0, 1.65, 54.0, 1.25, 2.8);
  // 2) 3.5 Watch-Cliff Turret Brazier (55, 11.5, 80) — elevated coastal fire bowl
  {
    const brazierParts = [];
    addCyl(brazierParts, 0.24, 0.38, 0.95, 7, 55.0, 11.0, 80.0, 0, 0, 0, 0x525a68, 0x22262f);
    addCyl(brazierParts, 0.68, 0.34, 0.44, 8, 55.0, 11.55, 80.0, 0, 0, 0, 0x5c6474, 0x262b34);
    const bm = new THREE.Mesh(
      regGeo(mergeNonIndexedGeos(THREE, brazierParts, { boxUvTile: 1.0, withColor: true })),
      forgedIronMat
    );
    bm.castShadow = true;
    landmarkGroup.add(bm);
    registerEastCampfire(55.0, 11.50, 80.0, 1.24, 3.2);
  }
  // 3) 5.1 Hunter Camp Bonfire (50, 13.5, 134)
  registerEastCampfire(50.0, 13.50, 134.0, 1.32, 3.1);
  // 4) 5.2 Watchtower Beacon (41, 22.8, 126) — blazing rooftop signal fire!
  {
    const wtBrazierParts = [];
    addCyl(wtBrazierParts, 0.78, 0.42, 0.52, 8, 41.0, 22.72, 126.0, 0, 0, 0, 0x5c6474, 0x242932);
    const wbm = new THREE.Mesh(
      regGeo(mergeNonIndexedGeos(THREE, wtBrazierParts, { boxUvTile: 1.0, withColor: true })),
      forgedIronMat
    );
    wbm.castShadow = true;
    landmarkGroup.add(wbm);
    registerEastCampfire(41.0, 22.80, 126.0, 1.42, 3.8);
  }

  // --------------------------------------------------------------------------
  // 7. BOTANICAL UNDERGROWTH (Instanced Ferns, Lagoon Sedge Grass & Aqueduct Ivy)
  // --------------------------------------------------------------------------
  const fernGeo = regGeo(buildFernRosetteGeo(THREE, mergeNonIndexedGeos));
  const grassGeo = regGeo(buildRiverGrassClumpGeo(THREE, mergeNonIndexedGeos));
  const ivyCardGeo = regGeo(buildCurvedCardGeo(THREE, 2.2, 3.2, 4, 0.16, 0.04, 0.0));
  ivyCardGeo.translate(0, -3.2, 0);

  function addInstancedCluster(geo, mat, specs, parent, castShadow = false, receiveShadow = true) {
    if (!geo || !specs.length) return null;
    const inst = new THREE.InstancedMesh(geo, mat, specs.length);
    inst.castShadow = castShadow;
    inst.receiveShadow = receiveShadow;
    for (let i = 0; i < specs.length; i++) {
      const s = specs[i];
      _m.position.set(s.x, s.y, s.z);
      _m.rotation.set(s.rx || 0, s.ry || 0, s.rz || 0);
      _m.scale.set(s.sx ?? s.s ?? 1, s.sy ?? s.s ?? 1, s.sz ?? s.s ?? 1);
      _m.updateMatrix();
      inst.setMatrixAt(i, _m.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    parent.add(inst);
    ownedInsts.push(inst);
    return inst;
  }

  // Sector 03 & 01/02 Lagoon Shoreline Sedge Grass & Ferns
  {
    const grassS1S2 = [];
    const grassS3 = [];
    const targetGrass = isMobile ? 120 : 240;
    for (let i = 0; i < targetGrass; i++) {
      const inLagoon = rng() < 0.72;
      const x = inLagoon ? (22.0 + rng() * 58.0) : (12.5 + rng() * 14.0);
      const z = inLagoon ? (16.0 + rng() * 58.0) : (16.0 + rng() * 44.0);
      // Keep clear of solid boardwalk hub
      if (x >= 27.2 && x <= 52.8 && z >= 37.2 && z <= 62.8) continue;
      const gy = safeEvalY(x, z);
      if (gy < WATER_LEVEL - 0.14 || gy > 2.4) continue;
      const sc = 0.72 + rng() * 0.76;
      const item = {
        x, y: Math.max(gy, WATER_LEVEL - 0.04) - 0.02, z,
        rx: (rng() - 0.5) * 0.16, ry: rng() * 6.28, rz: (rng() - 0.5) * 0.16,
        sx: sc, sy: sc * (0.85 + rng() * 0.4), sz: sc
      };
      if (x < 26.0) grassS1S2.push(item);
      else grassS3.push(item);
    }
    addInstancedCluster(grassGeo, riverGrassMat, grassS1S2, chunkS1S2Minor, false, true);
    addInstancedCluster(grassGeo, riverGrassMat, grassS3, chunkS3Minor, false, true);
  }

  // Sector 05 Misty Nordic Pine Forest Ferns (framing trails, camp perimeter & P10!)
  {
    const fernsS5 = [];
    const fernsS3 = [];
    const targetFerns = isMobile ? 130 : 260;
    for (let i = 0; i < targetFerns; i++) {
      const inS5 = rng() < 0.74;
      const x = inS5 ? (24.0 + rng() * 54.0) : (40.0 + rng() * 38.0);
      const z = inS5 ? (100.0 + rng() * 86.0) : (58.0 + rng() * 44.0);
      // Keep clear of Hunter Camp bonfire ring & main stair treads
      if (Math.hypot(x - 50.0, z - 134.0) < 6.2) continue;
      if (Math.abs(x - 44.0) < 3.6 && z >= 149.0 && z <= 183.0) continue;
      if (Math.abs(x - 52.0) < 3.4 && z >= 60.0 && z <= 102.0) continue;
      const gy = safeEvalY(x, z);
      if (gy < 1.2 || gy > 24.0) continue;
      const sc = 0.72 + rng() * 0.85;
      const item = {
        x, y: gy - 0.04, z,
        rx: (rng() - 0.5) * 0.14, ry: rng() * 6.28, rz: (rng() - 0.5) * 0.14,
        sx: sc, sy: sc * (0.86 + rng() * 0.34), sz: sc
      };
      if (inS5) fernsS5.push(item);
      else fernsS3.push(item);
    }
    addInstancedCluster(fernGeo, fernMat, fernsS5, chunkS5Minor, false, true);
    addInstancedCluster(fernGeo, fernMat, fernsS3, chunkS3Minor, false, true);
  }

  // Cascading Ivy Curtains draping over East Aqueduct Extension P07 & Sunken Chapel walls!
  {
    const ivySpecs = [
      { x: 10.5, y: 6.45, z: 80.02, ry: 0.0, sx: 1.15, sy: 1.15 },
      { x: 17.5, y: 7.72, z: 80.02, ry: 0.0, sx: 1.20, sy: 1.25 },
      { x: 25.0, y: 8.98, z: 80.02, ry: 0.0, sx: 1.10, sy: 1.05 },
      { x: 14.0, y: 7.12, z: 83.98, ry: Math.PI, sx: 1.05, sy: 1.05 },
      { x: 22.0, y: 8.48, z: 83.98, ry: Math.PI, sx: 1.18, sy: 1.12 },
      { x: 30.82, y: 10.45, z: 88.5, ry: -Math.PI * 0.5, sx: 1.22, sy: 1.25 },
      { x: 30.82, y: 10.45, z: 96.0, ry: -Math.PI * 0.5, sx: 1.15, sy: 1.15 },
      { x: 55.2, y: 5.20, z: 42.8, ry: 0.22, sx: 1.15, sy: 1.10 },
      { x: 56.8, y: 5.10, z: 37.2, ry: Math.PI + 0.22, sx: 1.10, sy: 1.05 }
    ];
    addInstancedCluster(ivyCardGeo, ivyCurtainMat, ivySpecs, chunkS4Minor, false, true);
  }

  // --------------------------------------------------------------------------
  // 8. PROCEDURAL STYLIZED FALLBACK BUILDERS (in case any GLB mesh is absent)
  // --------------------------------------------------------------------------
  function buildFallbackShackGeo(variant = 'A') {
    const parts = [];
    const w = variant === 'A' ? 5.2 : 4.3;
    const d = variant === 'A' ? 4.8 : 4.5;
    const h = variant === 'A' ? 3.1 : 2.7;
    // Stilts down to -2.2m
    for (const sx of [-w * 0.44, w * 0.44]) {
      for (const sz of [-d * 0.44, d * 0.44]) {
        addCyl(parts, 0.14, 0.17, 2.6, 6, sx, -1.1, sz, 0, 0, 0, 0x746456, 0x1c1713);
      }
    }
    // Cabin timber walls
    addBox(parts, w, h, d, 0, h * 0.5, 0, 0, 0, variant === 'A' ? 0.025 : -0.02, 0x8e7c6a, 0x352c24);
    // Steep sagging shingled roof slopes
    addBox(parts, w * 0.68, 0.24, d + 0.8, -w * 0.27, h + 0.78, 0, 0, 0, 0.58, 0x646e7e, 0x262b36);
    addBox(parts, w * 0.68, 0.24, d + 0.8, w * 0.27, h + 0.78, 0, 0, 0, -0.58, 0x646e7e, 0x262b36);
    return regGeo(mergeNonIndexedGeos(THREE, parts, { boxUvTile: 2.2, withColor: true }));
  }

  function buildFallbackRowboatGeo() {
    const parts = [];
    addBox(parts, 1.32, 0.56, 3.4, 0, 0.28, 0, 0, 0, 0, 0x8a7664, 0x2d241d);
    addBox(parts, 1.18, 0.12, 0.34, 0, 0.44, -0.4, 0, 0, 0, 0x998470, 0x3b3026);
    addBox(parts, 1.18, 0.12, 0.34, 0, 0.44, 0.55, 0, 0, 0, 0x998470, 0x3b3026);
    return regGeo(mergeNonIndexedGeos(THREE, parts, { boxUvTile: 1.5, withColor: true }));
  }

  function buildFallbackChapelGeo() {
    const parts = [];
    // Half-flooded roofless Gothic chapel walls with open doorway & lancet gaps
    addBox(parts, 0.75, 5.8, 6.2, -3.9, 2.9, 0, 0, 0, 0, 0x8c9ab4, 0x30384a);
    addBox(parts, 0.75, 5.2, 6.2, 3.9, 2.6, 0, 0, 0, 0, 0x8c9ab4, 0x30384a);
    addBox(parts, 8.4, 6.2, 0.80, 0, 3.1, -2.8, 0, 0, 0, 0x92a1bc, 0x323b4d);
    // Front entrance flanking walls (clear 2.8m doorway)
    addBox(parts, 2.8, 5.2, 0.80, -2.8, 2.6, 2.8, 0, 0, 0, 0x8c9ab4, 0x30384a);
    addBox(parts, 2.8, 4.8, 0.80, 2.8, 2.4, 2.8, 0, 0, 0, 0x8c9ab4, 0x30384a);
    addBox(parts, 3.6, 1.25, 0.85, 0, 4.8, 2.8, 0, 0, 0, 0x96a6c2, 0x3c4558);
    return regGeo(mergeNonIndexedGeos(THREE, parts, { boxUvTile: 2.6, withColor: true }));
  }

  function buildFallbackBargeGeo() {
    const parts = [];
    addBox(parts, 2.6, 0.95, 6.4, 0, 0.42, 0, 0.08, 0, 0.22, 0x7e6d5d, 0x26201a);
    for (let z = -2.4; z <= 2.4; z += 1.2) {
      addBox(parts, 0.16, 1.75, 0.18, -1.2, 0.95, z, 0, 0, -0.28, 0x8c7967, 0x302820);
      addBox(parts, 0.16, 1.45, 0.18, 1.2, 0.82, z, 0, 0, 0.32, 0x8c7967, 0x302820);
    }
    return regGeo(mergeNonIndexedGeos(THREE, parts, { boxUvTile: 2.0, withColor: true }));
  }

  function buildFallbackTurretGeo() {
    const parts = [];
    addCyl(parts, 2.45, 2.75, 6.4, 8, 0, 3.2, 0, 0, 0, 0, 0x8e9db8, 0x2d3546);
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      addBox(parts, 1.15, 0.95, 0.56, Math.cos(ang) * 2.25, 6.85, Math.sin(ang) * 2.25, 0, -ang + Math.PI * 0.5, 0, 0x9aaac4, 0x424c60);
    }
    return regGeo(mergeNonIndexedGeos(THREE, parts, { boxUvTile: 2.6, withColor: true }));
  }

  function buildFallbackDryingNetGeo() {
    const parts = [];
    addCyl(parts, 0.08, 0.10, 2.5, 6, -1.5, 1.2, 0, 0, 0, -0.14, 0x867462, 0x2c241d);
    addCyl(parts, 0.08, 0.10, 2.5, 6, 1.5, 1.2, 0, 0, 0, 0.14, 0x867462, 0x2c241d);
    addBox(parts, 3.3, 0.12, 0.12, 0, 2.32, 0, 0, 0, 0, 0x94816e, 0x362d25);
    addBox(parts, 2.8, 1.75, 0.06, 0, 1.38, 0, 0.08, 0, 0, 0x626b76, 0x2b313a);
    return regGeo(mergeNonIndexedGeos(THREE, parts, { boxUvTile: 1.5, withColor: true }));
  }

  function buildFallbackWatchtowerGeo() {
    const parts = [];
    // 4 tall corner posts up to 9.6m
    for (const sx of [-1.8, 1.8]) {
      for (const sz of [-1.8, 1.8]) {
        addCyl(parts, 0.18, 0.24, 9.8, 7, sx, 4.9, sz, 0, 0, 0, 0x8a7866, 0x2b231c);
      }
    }
    // Cross-bracing tiers
    for (const yTier of [2.4, 5.4, 8.2]) {
      addBox(parts, 3.9, 0.22, 0.22, 0, yTier, -1.8, 0, 0, 0, 0x7e6d5d, 0x2c241d);
      addBox(parts, 3.9, 0.22, 0.22, 0, yTier, 1.8, 0, 0, 0, 0x7e6d5d, 0x2c241d);
      addBox(parts, 0.22, 0.22, 3.9, -1.8, yTier, 0, 0, 0, 0, 0x7e6d5d, 0x2c241d);
      addBox(parts, 0.22, 0.22, 3.9, 1.8, yTier, 0, 0, 0, 0, 0x7e6d5d, 0x2c241d);
    }
    // Upper lookout deck at y = 8.4m + parapet walls up to 9.4m
    addBox(parts, 4.4, 0.26, 4.4, 0, 8.45, 0, 0, 0, 0, 0x998674, 0x3b3129);
    addBox(parts, 4.4, 0.95, 0.20, 0, 9.0, -2.1, 0, 0, 0, 0x8d7b69, 0x342b23);
    addBox(parts, 4.4, 0.95, 0.20, 0, 9.0, 2.1, 0, 0, 0, 0x8d7b69, 0x342b23);
    addBox(parts, 0.20, 0.95, 4.4, -2.1, 9.0, 0, 0, 0, 0, 0x8d7b69, 0x342b23);
    addBox(parts, 0.20, 0.95, 4.4, 2.1, 9.0, 0, 0, 0, 0, 0x8d7b69, 0x342b23);
    return regGeo(mergeNonIndexedGeos(THREE, parts, { boxUvTile: 2.2, withColor: true }));
  }

  function buildFallbackBarracksGeo() {
    const parts = [];
    addBox(parts, 6.2, 2.6, 4.4, 0, 1.3, 0, 0, 0, 0, 0x8c7b6a, 0x322a22);
    addBox(parts, 6.6, 0.26, 3.0, 0, 3.15, -1.15, -0.52, 0, 0, 0x66707e, 0x272d38);
    addBox(parts, 6.6, 0.26, 3.0, 0, 3.15, 1.15, 0.52, 0, 0, 0x66707e, 0x272d38);
    addBox(parts, 1.1, 4.2, 1.1, 2.3, 2.1, -1.4, 0, 0, 0, 0x8997b0, 0x2e3647);
    return regGeo(mergeNonIndexedGeos(THREE, parts, { boxUvTile: 2.2, withColor: true }));
  }

  function buildFallbackTentGeo() {
    const parts = [];
    addBox(parts, 2.2, 0.14, 3.4, -0.82, 1.05, 0, 0, 0, 0.84, 0x8c8478, 0x3b3732);
    addBox(parts, 2.2, 0.14, 3.4, 0.82, 1.05, 0, 0, 0, -0.84, 0x8c8478, 0x3b3732);
    return regGeo(mergeNonIndexedGeos(THREE, parts, { boxUvTile: 1.8, withColor: true }));
  }

  function buildFallbackPalisadeGeo() {
    const parts = [];
    for (let lx = -1.98; lx <= 1.98; lx += 0.44) {
      const lh = 2.45 + Math.sin(lx * 3.1) * 0.26;
      addCyl(parts, 0.06, 0.19, lh, 6, lx, lh * 0.5, 0, 0, 0, 0, 0x8a7765, 0x28211b);
    }
    addBox(parts, 4.35, 0.20, 0.18, 0, 0.85, 0.16, 0, 0, 0, 0x7c6b5b, 0x2b231d);
    addBox(parts, 4.35, 0.20, 0.18, 0, 1.82, 0.16, 0, 0, 0, 0x7c6b5b, 0x2b231d);
    return regGeo(mergeNonIndexedGeos(THREE, parts, { boxUvTile: 1.8, withColor: true }));
  }

  // --------------------------------------------------------------------------
  // 9. ASYNC BLENDER GLB KIT LOADER & POPULATOR (Sectors 03, 04 & 05!)
  // --------------------------------------------------------------------------
  function extractNamedAssets(gltfScene) {
    const meshMap = new Map();
    const groupMeshesMap = new Map();
    if (!gltfScene) return { meshMap, groupMeshesMap };

    gltfScene.updateMatrixWorld(true);
    gltfScene.traverse((obj) => {
      if (!obj.name) return;
      const clean = obj.name.replace(/\.\d+$/, '');
      if (obj.isMesh && obj.geometry) {
        meshMap.set(obj.name, obj);
        if (!meshMap.has(clean)) meshMap.set(clean, obj);
      } else if (obj.children && obj.children.length > 0) {
        const kids = [];
        obj.traverse((ch) => {
          if (ch.isMesh && ch.geometry) kids.push(ch);
        });
        if (kids.length > 0) {
          groupMeshesMap.set(obj.name, kids);
          if (!groupMeshesMap.has(clean)) groupMeshesMap.set(clean, kids);
        }
      }
    });
    return { meshMap, groupMeshesMap };
  }

  function pickSubMeshMat(subMesh, defaultMat) {
    const n = `${subMesh.name || ''} ${subMesh.material?.name || ''}`.toLowerCase();
    if (n.includes('glass') || n.includes('flame') || n.includes('glow') || n.includes('lantern_core')) return lanternGlassMat;
    if (n.includes('iron') || n.includes('metal') || n.includes('chain') || n.includes('cage')) return forgedIronMat;
    if (n.includes('canvas') || n.includes('cloth') || n.includes('tent')) return canvasTentMat;
    if (n.includes('stone') || n.includes('chimney') || n.includes('plinth') || n.includes('masonry')) return ruinStoneMat;
    if (n.includes('bark') || n.includes('log')) return barkMat;
    return defaultMat;
  }

  function getAssetMeshes(assetPack, name) {
    const exact = assetPack.meshMap.get(name);
    if (exact) return [exact];
    const grp = assetPack.groupMeshesMap.get(name);
    if (grp && grp.length) return grp;
    // Prefix scan for split multi-material Blender exports (e.g. Pier_Lantern_Post_Wood / _Iron / _Glass)
    const matched = [];
    const prefix = `${name}_`;
    assetPack.meshMap.forEach((m, key) => {
      if (key.startsWith(prefix) && !matched.includes(m)) matched.push(m);
    });
    return matched;
  }

  function placeInstancedAsset(assetPack, name, fallbackGeoFn, defaultMat, transforms, parent, { castShadow = true, receiveShadow = true } = {}) {
    if (!transforms.length) return [];
    const srcMeshes = getAssetMeshes(assetPack, name);
    const created = [];

    if (srcMeshes.length > 0) {
      for (let si = 0; si < srcMeshes.length; si++) {
        const sm = srcMeshes[si];
        const mat = srcMeshes.length > 1 ? pickSubMeshMat(sm, defaultMat) : defaultMat;
        const isGlass = mat === lanternGlassMat;
        const inst = new THREE.InstancedMesh(sm.geometry, mat, transforms.length);
        inst.castShadow = isGlass ? false : castShadow;
        inst.receiveShadow = isGlass ? false : receiveShadow;
        for (let i = 0; i < transforms.length; i++) {
          const t = transforms[i];
          _m.position.set(t.x, t.y, t.z);
          _m.rotation.set(t.rx || 0, t.ry || 0, t.rz || 0);
          _m.scale.set(t.sx ?? t.s ?? 1, t.sy ?? t.s ?? 1, t.sz ?? t.s ?? 1);
          _m.updateMatrix();
          inst.setMatrixAt(i, _m.matrix);
        }
        inst.instanceMatrix.needsUpdate = true;
        parent.add(inst);
        ownedInsts.push(inst);
        created.push(inst);
      }
      return created;
    }

    if (typeof fallbackGeoFn === 'function') {
      const fg = fallbackGeoFn();
      const inst = addInstancedCluster(fg, defaultMat, transforms, parent, castShadow, receiveShadow);
      if (inst) created.push(inst);
    }
    return created;
  }

  function placeSingleAsset(assetPack, name, fallbackGeoFn, defaultMat, xf, parent, { castShadow = true, receiveShadow = true } = {}) {
    const srcMeshes = getAssetMeshes(assetPack, name);
    const holder = new THREE.Group();
    holder.position.set(xf.x, xf.y, xf.z);
    holder.rotation.set(xf.rx || 0, xf.ry || 0, xf.rz || 0);
    holder.scale.set(xf.sx ?? xf.s ?? 1, xf.sy ?? xf.s ?? 1, xf.sz ?? xf.s ?? 1);

    if (srcMeshes.length > 0) {
      for (let i = 0; i < srcMeshes.length; i++) {
        const sm = srcMeshes[i];
        const mat = srcMeshes.length > 1 ? pickSubMeshMat(sm, defaultMat) : defaultMat;
        const m = new THREE.Mesh(sm.geometry, mat);
        m.castShadow = mat === lanternGlassMat ? false : castShadow;
        m.receiveShadow = mat === lanternGlassMat ? false : receiveShadow;
        holder.add(m);
      }
      parent.add(holder);
      return holder;
    }

    if (typeof fallbackGeoFn === 'function') {
      const m = new THREE.Mesh(fallbackGeoFn(), defaultMat);
      m.castShadow = castShadow;
      m.receiveShadow = receiveShadow;
      holder.add(m);
      parent.add(holder);
      return holder;
    }
    return null;
  }

  function loadGlb(url) {
    return new Promise((resolve) => {
      if (!gltfLoader) {
        resolve(null);
        return;
      }
      gltfLoader.load(
        url,
        (gltf) => resolve(gltf),
        undefined,
        (err) => {
          console.warn('[soulsRiverReachEast] GLB fallback triggered for:', url, err);
          resolve(null);
        }
      );
    });
  }

  const readyPromise = Promise.all([
    pbrTex?.readyPromise || Promise.resolve(),
    loadGlb(VILLAGE_GLB_URL),
    loadGlb(CAMP_GLB_URL),
    loadGlb(NATURE_GLB_URL),
    loadGlb(RUINS_GLB_URL)
  ]).then(([, villageGltf, campGltf, natureGltf, ruinsGltf]) => {
    if (disposed) return false;

    const villagePack = extractNamedAssets(villageGltf?.scene);
    const campPack = extractNamedAssets(campGltf?.scene);
    const naturePack = extractNamedAssets(natureGltf?.scene);
    const ruinsPack = extractNamedAssets(ruinsGltf?.scene);

    // Track loaded GLB geometries for disposal hygiene
    const trackPack = (pack) => {
      pack.meshMap.forEach((m) => { if (m.geometry) regGeo(m.geometry); });
    };
    trackPack(villagePack);
    trackPack(campPack);
    trackPack(naturePack);
    trackPack(ruinsPack);

    // ========================================================================
    // A) SECTOR 03: STILT FISHING VILLAGE (`sector03_village.glb`)
    // ========================================================================
    // 1. 5 Crooked Stilt Shacks framing the lagoon hub & outer piers (Stilt_Shack_A & Stilt_Shack_B)
    const shackAXforms = [
      { x: 33.2, y: 1.35, z: 41.2, ry:  0.32, s: 1.04 },
      { x: 43.4, y: 1.35, z: 41.6, ry: -0.24, s: 1.00 },
      { x: 33.6, y: 1.35, z: 58.6, ry:  2.72, s: 1.06 }
    ];
    const shackBXforms = [
      { x: 49.4, y: 1.35, z: 45.4, ry: -1.18, s: 1.02 },
      { x: 25.8, y: 1.15, z: 55.8, ry:  0.94, s: 0.98 }
    ];
    placeInstancedAsset(villagePack, 'Stilt_Shack_A', () => buildFallbackShackGeo('A'), wetPierTimberMat, shackAXforms, landmarkGroup);
    placeInstancedAsset(villagePack, 'Stilt_Shack_B', () => buildFallbackShackGeo('B'), wetPierTimberMat, shackBXforms, landmarkGroup);

    // Warm window glow hints tucked under shack eaves
    addWarmSprite(landmarkGroup, 34.4, 2.75, 43.2, 1.55, false);
    addWarmSprite(landmarkGroup, 43.2, 2.75, 43.6, 1.45, false);
    addWarmSprite(landmarkGroup, 35.0, 2.75, 56.6, 1.55, false);

    // 2. 4 Gently Bobbing Moored Rowboats around Pier 1.4 & Village Lagoon
    const boatSpecs = [
      { x: 13.6, y: WATER_LEVEL + 0.04, z: 22.8, ry:  0.48, s: 1.02 },
      { x: 26.2, y: WATER_LEVEL + 0.04, z: 44.2, ry: -0.35, s: 1.04 },
      { x: 38.8, y: WATER_LEVEL + 0.04, z: 35.8, ry:  1.22, s: 1.00 },
      { x: 52.8, y: WATER_LEVEL + 0.04, z: 58.6, ry: -1.05, s: 0.98 }
    ];
    let sharedBoatFallback = null;
    const getBoatFallback = () => {
      if (!sharedBoatFallback) sharedBoatFallback = buildFallbackRowboatGeo();
      return sharedBoatFallback;
    };
    for (let i = 0; i < boatSpecs.length; i++) {
      const bs = boatSpecs[i];
      const boatObj = placeSingleAsset(villagePack, 'Moored_Rowboat', getBoatFallback, wetPierTimberMat, bs, landmarkGroup);
      if (boatObj) {
        bobbingBoats.push({
          obj: boatObj,
          baseY: bs.y,
          baseRy: bs.ry,
          phase: i * 1.67 + 0.4
        });
      }
    }

    // 3. 3.4 Sunken Fisherman's Chapel at (56.0, 1.35, 40.0)
    placeSingleAsset(
      villagePack,
      'Sunken_Chapel_Stone',
      buildFallbackChapelGeo,
      ruinStoneMat,
      { x: 56.0, y: 1.35, z: 40.0, ry: 0.22, s: 1.02 },
      landmarkGroup
    );

    // 4. 3.6 Wrecked Barge at (64.0, 0.85, 32.0)
    placeSingleAsset(
      villagePack,
      'Wrecked_Barge',
      buildFallbackBargeGeo,
      wetPierTimberMat,
      { x: 64.0, y: 0.85, z: 32.0, ry: -0.68, rz: 0.14, s: 1.05 },
      landmarkGroup
    );

    // 5. 3.5 Watch-Cliff Coastal Stone Beacon Turret at (55.0, 8.20, 80.0)
    placeSingleAsset(
      villagePack,
      'Watch_Turret_Stone',
      buildFallbackTurretGeo,
      ruinStoneMat,
      { x: 55.0, y: 8.20, z: 80.0, ry: -0.45, s: 1.04 },
      landmarkGroup
    );

    // 6. 8 Pier_Lantern_Post glowing lanterns illuminating the village boardwalks, chapel & spurs!
    const pierLanternSpecs = [
      { x: 29.8, y: 1.35, z: 46.8, ry:  0.40, s: 1.0 },
      { x: 36.2, y: 1.35, z: 46.4, ry: -0.25, s: 1.0 },
      { x: 41.2, y: 1.35, z: 50.8, ry:  0.80, s: 1.0 },
      { x: 42.6, y: 1.65, z: 57.2, ry:  2.20, s: 1.0 },
      { x: 49.4, y: 1.65, z: 50.8, ry: -1.10, s: 1.0 },
      { x: 51.8, y: 1.35, z: 44.2, ry:  0.65, s: 1.0 },
      { x: 58.6, y: 1.35, z: 37.8, ry: -0.55, s: 1.0 },
      { x: 49.6, y: 8.20, z: 79.4, ry:  1.40, s: 1.04 }
    ];
    const hasGlbLantern = getAssetMeshes(villagePack, 'Pier_Lantern_Post').length > 0;
    if (hasGlbLantern) {
      placeInstancedAsset(villagePack, 'Pier_Lantern_Post', null, wetPierTimberMat, pierLanternSpecs, landmarkGroup);
      // Real Pier_Lantern_Post GLB iron arm projects along local +X (+0.86m, y=+2.72m):
      // mount glowing emissive amber glass bulbs + warm additive halos right inside every cage!
      const glbLanternBulbs = [];
      for (let i = 0; i < pierLanternSpecs.length; i++) {
        const lp = pierLanternSpecs[i];
        const lx = lp.x + Math.cos(lp.ry) * 0.86 * lp.s;
        const ly = lp.y + 2.72 * lp.s;
        const lz = lp.z - Math.sin(lp.ry) * 0.86 * lp.s;
        addBox(glbLanternBulbs, 0.20 * lp.s, 0.34 * lp.s, 0.20 * lp.s, lx, ly, lz, 0, lp.ry, 0, 0xffe4a0, 0xff9b30);
        addWarmSprite(landmarkGroup, lx, ly, lz, 2.15 * lp.s, false);
      }
      addMergedBucket(glbLanternBulbs, lanternGlassMat, 0.8, false, 'EastReach_GlbPierLanternGlass', false, false);
    } else {
      // Procedural fallback posts if GLB not loaded
      const lpWood = [];
      const lpIron = [];
      const lpGlass = [];
      for (let i = 0; i < pierLanternSpecs.length; i++) {
        const lp = pierLanternSpecs[i];
        addCyl(lpWood, 0.10, 0.13, 3.15, 6, lp.x, lp.y + 1.58, lp.z, 0, 0, 0, 0x867462, 0x2c241d);
        const ax = Math.cos(lp.ry) * 0.45;
        const az = -Math.sin(lp.ry) * 0.45;
        addBox(lpIron, 0.72, 0.08, 0.08, lp.x + ax, lp.y + 3.02, lp.z + az, 0, lp.ry, 0, 0x525a68, 0x22262f);
        addBox(lpGlass, 0.22, 0.36, 0.22, lp.x + ax * 1.9, lp.y + 2.74, lp.z + az * 1.9, 0, lp.ry, 0, 0xffe4a0, 0xff9b30);
        addWarmSprite(landmarkGroup, lp.x + ax * 1.9, lp.y + 2.74, lp.z + az * 1.9, 2.15, false);
      }
      addMergedBucket(lpWood, wetPierTimberMat, 1.5, true, 'EastReach_PierLanternWood');
      addMergedBucket(lpIron, forgedIronMat, 1.0, true, 'EastReach_PierLanternIron');
      addMergedBucket(lpGlass, lanternGlassMat, 0.8, false, 'EastReach_PierLanternGlass', false, false);
    }

    // 6b. 4 Sculpted Fishing_Pier_Bay outer boat-slip spurs dressing the lagoon perimeter
    if (getAssetMeshes(villagePack, 'Fishing_Pier_Bay').length > 0) {
      const bayXforms = [
        { x: 26.8, y: 1.35, z: 44.2, ry: Math.PI * 0.5, s: 1.0 },
        { x: 38.8, y: 1.35, z: 36.2, ry: 0.0, s: 1.0 },
        { x: 53.6, y: 1.35, z: 58.2, ry: Math.PI * 0.5, s: 1.0 },
        { x: 32.8, y: 1.35, z: 63.6, ry: 0.0, s: 1.0 }
      ];
      placeInstancedAsset(villagePack, 'Fishing_Pier_Bay', null, wetPierTimberMat, bayXforms, landmarkGroup);
    }

    // 7. 3 Drying_Net_Frame racks along village boardwalk edges (culled > 130m)
    const netXforms = [
      { x: 38.6, y: 1.35, z: 39.2, ry:  0.12, s: 1.02 },
      { x: 29.8, y: 1.35, z: 54.4, ry:  1.48, s: 0.98 },
      { x: 47.6, y: 1.35, z: 60.6, ry: -0.28, s: 1.04 }
    ];
    placeInstancedAsset(villagePack, 'Drying_Net_Frame', buildFallbackDryingNetGeo, wetPierTimberMat, netXforms, chunkS3Minor);

    // ========================================================================
    // B) SECTOR 05: ABANDONED HUNTER CAMP (`sector0506_camp_heights.glb`)
    // ========================================================================
    // 1. 5.2 Hunter Watchtower Wood at (41.0, 13.5, 126.0) crowned with blazing fire at y = 22.8!
    placeSingleAsset(
      campPack,
      'Hunter_Watchtower_Wood',
      buildFallbackWatchtowerGeo,
      timberWoodMat,
      { x: 41.0, y: 13.50, z: 126.0, ry: 0.35, s: 1.0 },
      landmarkGroup
    );

    // 2. Hunter Barracks Shack at (58.0, 13.5, 138.0)
    placeSingleAsset(
      campPack,
      'Hunter_Barracks_Shack',
      buildFallbackBarracksGeo,
      timberWoodMat,
      { x: 58.0, y: 13.50, z: 138.0, ry: -0.48, s: 1.04 },
      landmarkGroup
    );
    addWarmSprite(landmarkGroup, 55.8, 15.1, 137.4, 1.65, false);

    // 3. 3 Hunter Tattered Tents around the clearing (50, 134)
    const tentXforms = [
      { x: 43.5, y: 13.50, z: 141.5, ry:  0.72, s: 1.06 },
      { x: 55.4, y: 13.50, z: 127.6, ry: -2.25, s: 1.02 },
      { x: 49.2, y: 13.50, z: 145.6, ry:  2.95, s: 0.98 }
    ];
    placeInstancedAsset(campPack, 'Hunter_Tattered_Tent', buildFallbackTentGeo, canvasTentMat, tentXforms, chunkS5Minor);

    // 4. Ring of sharpened log Palisade_Wall_Seg around camp clearing (50, 134)
    //    Leaves wide clear gateways for: Wolf Ravine SW, P06/SC-4 South, Overlook West, P10 North, Ruins NE!
    const palisadeSpecs = [
      // South-East arc
      { x: 56.8, z: 120.4, ry: -0.45 },
      { x: 60.8, z: 123.2, ry: -0.88 },
      { x: 63.4, z: 127.4, ry: -1.32 },
      // East arc behind Barracks
      { x: 64.4, z: 132.2, ry: -1.58 },
      { x: 64.2, z: 137.4, ry: -1.65 },
      { x: 63.2, z: 142.4, ry: -1.92 },
      // North arc (East of P10 exit)
      { x: 55.4, z: 149.2, ry:  2.88 },
      { x: 50.8, z: 150.2, ry:  3.08 },
      // North-West arc (West of P10 exit)
      { x: 38.6, z: 148.4, ry:  2.55 },
      { x: 35.6, z: 144.4, ry:  2.12 },
      { x: 34.4, z: 139.6, ry:  1.72 },
      // West-South arc (leaving gap at z=128 for 5.4 Overlook trail & SW for 5.3 Ravine Bridge!)
      { x: 34.8, z: 134.8, ry:  1.45 },
      { x: 46.2, z: 119.2, ry:  0.12 }
    ].map((p) => ({
      x: p.x,
      y: Math.max(13.2, safeEvalY(p.x, p.z) - 0.14),
      z: p.z,
      ry: p.ry,
      s: 1.04
    }));
    placeInstancedAsset(campPack, 'Palisade_Wall_Seg', buildFallbackPalisadeGeo, barkMat, palisadeSpecs, landmarkGroup);

    // 5. Twin end-to-end Ravine_Plank_Bridge GLB bays (8.0m each -> exact 16.0m span z=102..118, centered at (34, 11.4, 110)!)
    const ravinePitch = Math.atan2(1.70, 16.0);
    if (getAssetMeshes(campPack, 'Ravine_Plank_Bridge').length > 0) {
      placeInstancedAsset(
        campPack,
        'Ravine_Plank_Bridge',
        null,
        timberWoodMat,
        [
          { x: 34.0, y: 10.925, z: 106.0, rx: -ravinePitch, ry: 0, sx: 1.66, sy: 1.0, sz: 1.02 },
          { x: 34.0, y: 11.775, z: 114.0, rx: -ravinePitch, ry: 0, sx: 1.66, sy: 1.0, sz: 1.02 }
        ],
        landmarkGroup
      );
    } else {
      // Procedural fallback bridge railings only if GLB absent
      const fbRails = [];
      for (let tz = 103.0; tz <= 117.5; tz += 3.6) {
        const ty = lerp(10.50, 12.20, (tz - 102.0) / 16.0);
        addBox(fbRails, 0.18, 1.02, 0.18, 31.42, ty + 0.48, tz, 0, 0, 0, 0x8e7c6b, 0x352c24);
        addBox(fbRails, 0.18, 1.02, 0.18, 36.58, ty + 0.48, tz, 0, 0, 0, 0x8e7c6b, 0x352c24);
      }
      const fbLen = Math.hypot(16.0, 1.70);
      addBox(fbRails, 0.14, 0.12, fbLen, 31.42, 11.35 + 0.90, 110.0, -ravinePitch, 0, 0, 0x988573, 0x3a3028);
      addBox(fbRails, 0.14, 0.12, fbLen, 36.58, 11.35 + 0.90, 110.0, -ravinePitch, 0, 0, 0x988573, 0x3a3028);
      addMergedBucket(fbRails, timberWoodMat, 2.0, true, 'EastReach_RavineFallbackRails');
    }

    // ========================================================================
    // C) NATURE KIT INSTANCING (`gorge_nature.glb`)
    //    Dense Nordic Pines (35+ in Sector 05 + cliffs/waterfalls in Sector 03),
    //    Cliff Crags, Wet Lagoon Boulders, Fallen Logs, Moss Mounds & Mountains!
    // ========================================================================
    const pineATrunk = naturePack.meshMap.get('Nordic_Pine_A_Trunk');
    const pineAFol = naturePack.meshMap.get('Nordic_Pine_A_Foliage');
    const pineBTrunk = naturePack.meshMap.get('Nordic_Pine_B_Trunk');
    const pineBFol = naturePack.meshMap.get('Nordic_Pine_B_Foliage');

    const pineALandmark = [];
    const pineBLandmark = [];
    const pineAMinor = [];
    const pineBMinor = [];

    // Hero Sector 03 Waterfall & Watch-Cliff framing pines
    const s3PineSpecs = [
      { x: 64.5, z: 17.5, s: 1.38, kind: 'B' }, { x: 78.5, z: 18.0, s: 1.46, kind: 'A' },
      { x: 81.2, z: 26.8, s: 1.34, kind: 'B' }, { x: 76.4, z: 36.2, s: 1.28, kind: 'A' },
      { x: 69.8, z: 45.4, s: 1.32, kind: 'B' }, { x: 74.2, z: 54.8, s: 1.40, kind: 'A' },
      { x: 64.8, z: 65.5, s: 1.35, kind: 'B' }, { x: 68.5, z: 76.2, s: 1.44, kind: 'A' },
      { x: 62.4, z: 85.4, s: 1.30, kind: 'B' }, { x: 43.2, z: 71.5, s: 1.22, kind: 'A' },
      { x: 42.6, z: 80.5, s: 1.26, kind: 'B' }, { x: 60.8, z: 94.6, s: 1.38, kind: 'A' },
      { x: 24.4, z: 68.2, s: 1.24, kind: 'B' }, { x: 26.8, z: 76.4, s: 1.30, kind: 'A' }
    ];

    // Dense Sector 05 Misty Nordic Pine Forest (44 pines framing Camp, Trails & P10 Ascent!)
    const s5PineSpecs = [
      // West forest edge overlooking canyon & Ravine Bridge
      { x: 24.5, z: 106.0, s: 1.34, kind: 'B' }, { x: 23.2, z: 116.5, s: 1.42, kind: 'A' },
      { x: 22.8, z: 136.5, s: 1.36, kind: 'B' }, { x: 25.4, z: 146.0, s: 1.48, kind: 'A' },
      { x: 28.5, z: 156.0, s: 1.44, kind: 'B' }, { x: 31.2, z: 166.5, s: 1.52, kind: 'A' },
      { x: 33.4, z: 176.5, s: 1.40, kind: 'B' },
      // South forest belt between Sector 03 & Hunter Camp (clear of P06 & SC-4!)
      { x: 61.5, z: 105.0, s: 1.38, kind: 'A' }, { x: 68.4, z: 112.0, s: 1.50, kind: 'B' },
      { x: 74.2, z: 121.0, s: 1.44, kind: 'A' }, { x: 72.8, z: 132.5, s: 1.52, kind: 'B' },
      { x: 71.6, z: 143.0, s: 1.38, kind: 'A' }, { x: 75.8, z: 153.5, s: 1.55, kind: 'B' },
      { x: 70.4, z: 162.5, s: 1.42, kind: 'A' }, { x: 64.2, z: 168.5, s: 1.48, kind: 'B' },
      // Dense pine corridor framing P10 Forest Ruins Ascent (z = 150..186, flanking x=40..48!)
      { x: 35.8, z: 152.0, s: 1.32, kind: 'A' }, { x: 52.8, z: 154.0, s: 1.36, kind: 'B' },
      { x: 34.4, z: 160.5, s: 1.44, kind: 'B' }, { x: 54.6, z: 162.0, s: 1.40, kind: 'A' },
      { x: 36.2, z: 169.0, s: 1.38, kind: 'A' }, { x: 52.4, z: 170.5, s: 1.46, kind: 'B' },
      { x: 35.2, z: 178.0, s: 1.48, kind: 'B' }, { x: 53.6, z: 178.5, s: 1.42, kind: 'A' },
      { x: 38.4, z: 186.5, s: 1.52, kind: 'A' }, { x: 51.8, z: 187.5, s: 1.54, kind: 'B' },
      // Inner secondary forest grove around camp perimeter & ruins 5.5 (minor cullable cluster!)
      { x: 30.8, z: 121.5, s: 1.18, kind: 'A', minor: true }, { x: 30.2, z: 134.8, s: 1.24, kind: 'B', minor: true },
      { x: 32.5, z: 147.8, s: 1.28, kind: 'A', minor: true }, { x: 67.2, z: 126.4, s: 1.22, kind: 'B', minor: true },
      { x: 68.5, z: 137.8, s: 1.30, kind: 'A', minor: true }, { x: 67.8, z: 146.5, s: 1.20, kind: 'B', minor: true },
      { x: 58.2, z: 147.2, s: 1.16, kind: 'A', minor: true }, { x: 57.5, z: 158.6, s: 1.26, kind: 'B', minor: true },
      { x: 68.4, z: 156.8, s: 1.32, kind: 'A', minor: true }, { x: 59.6, z: 165.4, s: 1.28, kind: 'B', minor: true },
      { x: 36.8, z: 112.4, s: 1.15, kind: 'A', minor: true }, { x: 47.4, z: 111.5, s: 1.22, kind: 'B', minor: true },
      { x: 57.8, z: 112.8, s: 1.26, kind: 'A', minor: true }, { x: 64.5, z: 116.5, s: 1.34, kind: 'B', minor: true },
      { x: 78.2, z: 110.5, s: 1.45, kind: 'A', minor: true }, { x: 80.5, z: 128.0, s: 1.52, kind: 'B', minor: true },
      { x: 81.2, z: 144.5, s: 1.48, kind: 'A', minor: true }, { x: 79.6, z: 165.0, s: 1.56, kind: 'B', minor: true },
      { x: 74.5, z: 179.0, s: 1.50, kind: 'A', minor: true }
    ];

    const pushPines = (list) => {
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        const gy = safeEvalY(p.x, p.z);
        const xf = { x: p.x, y: gy - 0.24, z: p.z, ry: (i * 1.91) % 6.283, s: p.s };
        if (p.minor) {
          if (p.kind === 'B') pineBMinor.push(xf);
          else pineAMinor.push(xf);
        } else {
          if (p.kind === 'B') pineBLandmark.push(xf);
          else pineALandmark.push(xf);
        }
      }
    };
    pushPines(s3PineSpecs);
    pushPines(s5PineSpecs);

    if (pineATrunk && pineAFol) {
      addInstancedCluster(pineATrunk.geometry, barkMat, pineALandmark, landmarkGroup, true, true);
      addInstancedCluster(pineAFol.geometry, pineFoliageMat, pineALandmark, landmarkGroup, !isMobile, true);
      addInstancedCluster(pineATrunk.geometry, barkMat, pineAMinor, chunkS5Minor, true, true);
      addInstancedCluster(pineAFol.geometry, pineFoliageMat, pineAMinor, chunkS5Minor, !isMobile, true);
    }
    if (pineBTrunk && pineBFol) {
      addInstancedCluster(pineBTrunk.geometry, barkMat, pineBLandmark, landmarkGroup, true, true);
      addInstancedCluster(pineBFol.geometry, pineFoliageMat, pineBLandmark, landmarkGroup, !isMobile, true);
      addInstancedCluster(pineBTrunk.geometry, barkMat, pineBMinor, chunkS5Minor, true, true);
      addInstancedCluster(pineBFol.geometry, pineFoliageMat, pineBMinor, chunkS5Minor, !isMobile, true);
    }

    // Gnarled Dead Trees accentuating 5.4 Overlook Cliff & Sunken Chapel Shore
    const gnarledTree = naturePack.meshMap.get('Gnarled_Dead_Tree');
    const archTree = naturePack.meshMap.get('Arch_Dead_Tree');
    if (gnarledTree) {
      addInstancedCluster(gnarledTree.geometry, barkMat, [
        { x: 25.2, y: safeEvalY(25.2, 131.0) - 0.25, z: 131.0, ry: 1.45, s: 1.18 },
        { x: 67.5, y: safeEvalY(67.5, 42.5) - 0.22, z: 42.5, ry: -0.82, s: 1.12 }
      ], landmarkGroup, true, true);
    }
    if (archTree) {
      addInstancedCluster(archTree.geometry, barkMat, [
        { x: 46.8, y: safeEvalY(46.8, 76.5) - 0.20, z: 76.5, ry: 0.65, s: 1.15 },
        { x: 59.5, y: safeEvalY(59.5, 149.0) - 0.20, z: 149.0, ry: 2.35, s: 1.10 }
      ], chunkS5Minor, true, true);
    }

    // Stratified Basalt Cliff Crags framing Waterfalls 3.1 & 4.4, Watch-Cliff 3.5 & Eastern Canyon Rim!
    const cragA = naturePack.meshMap.get('Cliff_Crag_A');
    const cragB = naturePack.meshMap.get('Cliff_Crag_B');
    const overhangC = naturePack.meshMap.get('Cliff_Overhang_C');

    if (cragA) {
      const cragAXforms = [
        // 3.1 Northern Waterfall sheer dark cliff headwall & flanking gorge buttresses (72, 14->0, 20)
        { x: 66.2, y: -0.6, z: 16.5, ry:  0.32, sx: 1.45, sy: 1.55, sz: 1.38 },
        { x: 77.8, y: -0.6, z: 19.2, ry: -0.48, sx: 1.48, sy: 1.62, sz: 1.42 },
        { x: 72.5, y:  2.2, z: 12.8, ry:  0.10, sx: 1.65, sy: 1.48, sz: 1.35 },
        { x: 84.5, y: -0.4, z: 32.0, ry: -1.25, sx: 1.55, sy: 1.42, sz: 1.50 },
        { x: 84.0, y: -0.2, z: 50.0, ry: -1.48, sx: 1.52, sy: 1.35, sz: 1.50 },
        // 4.4 Gorge Waterfall sheer cliff walls framing (19, 10.5->0, 96)
        { x: 24.5, y: -0.8, z: 90.2, ry:  1.42, sx: 1.25, sy: 1.28, sz: 1.18 },
        { x: 24.8, y: -0.8, z: 102.2, ry: 1.68, sx: 1.28, sy: 1.35, sz: 1.20 },
        { x: 25.5, y:  0.5, z: 96.0, ry:  1.57, sx: 1.15, sy: 1.12, sz: 1.15 },
        // Eastern valley high cliff rim behind Sector 05
        { x: 84.0, y: 11.0, z: 118.0, ry: -1.45, sx: 1.65, sy: 1.55, sz: 1.55 },
        { x: 85.5, y: 12.5, z: 146.0, ry: -1.62, sx: 1.72, sy: 1.65, sz: 1.60 },
        { x: 82.0, y: 14.0, z: 174.0, ry: -1.35, sx: 1.68, sy: 1.62, sz: 1.58 }
      ];
      addInstancedCluster(cragA.geometry, cliffRockMat, cragAXforms, landmarkGroup, true, true);
    }

    if (cragB) {
      const cragBXforms = [
        // Lagoon NE & SE rocky promontories
        { x: 61.0, y: -0.8, z: 16.5, ry:  0.55, sx: 1.25, sy: 1.12, sz: 1.20 },
        { x: 79.2, y: -0.6, z: 41.5, ry: -1.35, sx: 1.30, sy: 1.05, sz: 1.25 },
        { x: 62.5, y:  1.2, z: 72.5, ry: -0.85, sx: 1.32, sy: 1.18, sz: 1.28 },
        { x: 62.2, y:  3.5, z: 83.5, ry: -1.15, sx: 1.28, sy: 1.10, sz: 1.25 },
        // Ravine & Overlook cliff shoulders (cleanly clear of walkways!)
        { x: 24.0, y:  5.2, z: 126.5, ry: 1.50, sx: 1.18, sy: 0.95, sz: 1.22 },
        { x: 25.5, y:  4.0, z: 112.0, ry: 1.32, sx: 1.15, sy: 0.92, sz: 1.18 },
        { x: 37.2, y:  3.5, z: 75.5, ry:  0.42, sx: 1.18, sy: 0.92, sz: 1.12 }
      ];
      addInstancedCluster(cragB.geometry, cliffRockMat, cragBXforms, landmarkGroup, true, true);
    }

    if (overhangC) {
      addInstancedCluster(overhangC.geometry, cliffRockMat, [
        { x: 72.2, y: 12.2, z: 16.5, ry: -0.42, sx: 1.35, sy: 0.95, sz: 1.20 },
        { x: 23.2, y: 8.6, z: 96.0, ry: -1.57, sx: 1.15, sy: 0.85, sz: 1.10 }
      ], landmarkGroup, true, true);
    }

    // Wet Lagoon Boulders, Waterfall Plunge Rocks, Moss Ledges & Fallen Logs
    const boulderA = naturePack.meshMap.get('River_Boulder_A');
    const boulderB = naturePack.meshMap.get('River_Boulder_B');
    const mossFlat = naturePack.meshMap.get('Moss_Rock_Flat');
    const fallenLog = naturePack.meshMap.get('Fallen_Mossy_Log');
    const mossMound = naturePack.meshMap.get('Moss_Mound_Cushion');
    const cliffRubble = naturePack.meshMap.get('Cliff_Rubble_Pile');

    if (boulderA) {
      const bAXforms = [
        // 3.1 Northern Waterfall plunge boulders
        { x: 65.5, y: WATER_LEVEL - 0.18, z: 24.5, ry: 0.4, s: 1.35 },
        { x: 74.5, y: WATER_LEVEL - 0.18, z: 26.8, ry: 1.8, s: 1.42 },
        { x: 68.0, y: WATER_LEVEL - 0.22, z: 28.8, ry: 2.9, s: 1.15 },
        // 4.4 Gorge Waterfall plunge boulders
        { x: 17.6, y: WATER_LEVEL - 0.18, z: 92.8, ry: 0.9, s: 1.25 },
        { x: 17.8, y: WATER_LEVEL - 0.18, z: 99.2, ry: 2.4, s: 1.30 },
        // Lagoon shoal & pier framing wet boulders
        { x: 21.5, y: WATER_LEVEL - 0.20, z: 31.2, ry: 0.6, s: 1.12 },
        { x: 24.2, y: WATER_LEVEL - 0.20, z: 54.5, ry: 1.9, s: 1.18 },
        { x: 46.5, y: WATER_LEVEL - 0.20, z: 33.4, ry: 3.1, s: 1.26 },
        { x: 59.4, y: WATER_LEVEL - 0.20, z: 26.2, ry: 0.8, s: 1.14 },
        { x: 72.5, y: WATER_LEVEL - 0.20, z: 40.2, ry: 2.2, s: 1.28 },
        { x: 56.8, y: WATER_LEVEL - 0.20, z: 52.8, ry: 1.4, s: 1.15 }
      ];
      addInstancedCluster(boulderA.geometry, wetRiverBoulderMat, bAXforms, chunkS3Minor, true, true);
    }

    if (boulderB) {
      const bBXforms = [
        { x: 16.5, y: WATER_LEVEL - 0.16, z: 24.8, ry: 0.7, s: 0.95 },
        { x: 19.2, y: WATER_LEVEL - 0.16, z: 29.4, ry: 2.1, s: 1.05 },
        { x: 23.8, y: WATER_LEVEL - 0.16, z: 34.6, ry: 1.3, s: 0.88 },
        { x: 32.5, y: WATER_LEVEL - 0.16, z: 34.2, ry: 3.4, s: 1.10 },
        { x: 41.2, y: WATER_LEVEL - 0.16, z: 35.8, ry: 0.5, s: 0.92 },
        { x: 61.5, y: WATER_LEVEL - 0.16, z: 36.2, ry: 2.6, s: 1.04 },
        { x: 66.8, y: WATER_LEVEL - 0.16, z: 30.0, ry: 1.8, s: 0.98 }
      ];
      addInstancedCluster(boulderB.geometry, wetRiverBoulderMat, bBXforms, chunkS3Minor, true, true);
    }

    if (mossFlat) {
      const flatXforms = [
        { x: 47.2, z: 66.5, ry: 0.4, s: 1.15 },
        { x: 57.2, z: 73.5, ry: 1.7, s: 1.22 },
        { x: 46.8, z: 95.4, ry: 2.4, s: 1.10 },
        { x: 57.5, z: 96.2, ry: 0.9, s: 1.18 },
        { x: 38.2, z: 156.5, ry: 1.5, s: 1.24 },
        { x: 50.2, z: 164.0, ry: 2.8, s: 1.18 }
      ].map((f) => ({ x: f.x, y: safeEvalY(f.x, f.z) - 0.14, z: f.z, ry: f.ry, s: f.s }));
      addInstancedCluster(mossFlat.geometry, cliffRockMat, flatXforms, chunkS5Minor, true, true);
    }

    if (fallenLog) {
      const logXforms = [
        { x: 47.4, z: 130.5, ry:  0.62, s: 1.04 }, // Campfire seating log 1
        { x: 52.8, z: 136.8, ry: -0.95, s: 1.02 }, // Campfire seating log 2
        { x: 37.5, z: 158.0, ry:  0.40, s: 1.25 },
        { x: 53.5, z: 168.5, ry: -0.55, s: 1.20 },
        { x: 60.2, z: 115.2, ry:  1.12, s: 1.15 }
      ].map((l) => ({ x: l.x, y: safeEvalY(l.x, l.z) - 0.06, z: l.z, ry: l.ry, s: l.s }));
      addInstancedCluster(fallenLog.geometry, barkMat, logXforms, chunkS5Minor, true, true);
    }

    if (mossMound) {
      const moundSpecs = [];
      for (let i = 0; i < (isMobile ? 14 : 26); i++) {
        const mx = 28.0 + rng() * 44.0;
        const mz = 96.0 + rng() * 86.0;
        if (Math.hypot(mx - 50.0, mz - 134.0) < 7.0) continue;
        if (Math.abs(mx - 44.0) < 4.2 && mz >= 149.0) continue;
        const my = safeEvalY(mx, mz);
        if (my < 4.0) continue;
        const sc = 0.90 + rng() * 0.45;
        moundSpecs.push({ x: mx, y: my - 0.08, z: mz, ry: rng() * 6.28, s: sc });
      }
      addInstancedCluster(mossMound.geometry, mossMoundMat, moundSpecs, chunkS5Minor, false, true);
    }

    if (cliffRubble) {
      const rubSpecs = [
        { x: 47.5, z: 62.5, ry: 0.4, s: 1.02 },
        { x: 57.0, z: 84.5, ry: 1.8, s: 1.08 },
        { x: 38.2, z: 85.2, ry: -0.6, s: 1.05 },
        { x: 38.0, z: 98.5, ry: 0.9, s: 1.00 },
        { x: 60.2, z: 148.5, ry: 2.1, s: 1.10 },
        { x: 67.8, z: 155.2, ry: -1.1, s: 1.06 },
        { x: 39.2, z: 179.5, ry: 0.5, s: 1.12 },
        { x: 49.0, z: 179.5, ry: -0.7, s: 1.10 }
      ].map((r) => ({ x: r.x, y: safeEvalY(r.x, r.z) - 0.14, z: r.z, ry: r.ry, s: r.s }));
      addInstancedCluster(cliffRubble.geometry, cliffRockMat, rubSpecs, chunkS4Minor, true, true);
    }

    // Brooding Distant Alpine Mountains framing the Eastern Valley horizon behind Waterfalls & Forest
    const mtnA = naturePack.meshMap.get('Distant_Mountain_A');
    const mtnB = naturePack.meshMap.get('Distant_Mountain_B');
    if (mtnA) {
      addInstancedCluster(mtnA.geometry, distantMountainMat, [
        { x: 108.0, y: -2.0, z: 22.0, ry: -1.20, sx: 1.65, sy: 1.80, sz: 1.55 },
        { x: 112.0, y:  2.0, z: 96.0, ry: -1.55, sx: 1.75, sy: 1.95, sz: 1.65 },
        { x: 106.0, y:  6.0, z: 172.0, ry: -1.35, sx: 1.80, sy: 2.05, sz: 1.70 }
      ], landmarkGroup, false, false);
    }
    if (mtnB) {
      addInstancedCluster(mtnB.geometry, distantMountainMat, [
        { x: 86.0, y: -2.0, z: -18.0, ry: -0.55, sx: 1.60, sy: 1.75, sz: 1.55 },
        { x: 118.0, y: 4.0, z: 136.0, ry: -1.72, sx: 1.90, sy: 2.15, sz: 1.80 }
      ], landmarkGroup, false, false);
    }

    // ========================================================================
    // D) MEDIEVAL RUINS & CAMP PROPS KIT (`gorge_ruins.glb`)
    //    5.5 Ancient Forest Ruins at (64, 15.2, 152), Campfire Stone Rings,
    //    P10 Ruined Arch, Village/Camp Crates, Barrels, Planks & War Banners!
    // ========================================================================
    // 1. 5.5 Ancient Ruined Columns, Arches & Crumbling Walls around (64.0, 15.2, 152.0) + P10 Arch!
    const colTall = ruinsPack.meshMap.get('Ruined_Column_Tall');
    const colBroken = ruinsPack.meshMap.get('Ruined_Column_Broken');
    const chapelArch = ruinsPack.meshMap.get('Ruined_Chapel_Arch');
    const ruinWall = ruinsPack.meshMap.get('Ruined_Wall_Section');

    if (colTall) {
      addInstancedCluster(colTall.geometry, ruinStoneMat, [
        { x: 60.4, y: 15.16, z: 148.6, ry:  0.30, s: 1.06 },
        { x: 67.6, y: 15.16, z: 149.4, ry: -0.55, s: 1.02 },
        { x: 61.2, y: 15.16, z: 155.8, ry:  1.20, s: 1.10 },
        { x: 40.4, y: 16.50, z: 164.0, ry:  0.15, s: 1.05 }
      ], landmarkGroup, true, true);
    }
    if (colBroken) {
      addInstancedCluster(colBroken.geometry, ruinStoneMat, [
        { x: 67.4, y: 15.16, z: 155.2, ry:  0.85, s: 1.04 },
        { x: 47.8, y: 16.50, z: 164.0, ry: -0.45, s: 1.00 },
        { x: 48.2, y:  9.20, z: 93.5, ry:  0.62, s: 0.96 }
      ], landmarkGroup, true, true);
    }
    if (chapelArch) {
      addInstancedCluster(chapelArch.geometry, ruinStoneMat, [
        { x: 64.0, y: 15.16, z: 155.8, ry:  0.25, s: 1.08 },
        { x: 44.0, y: 14.80, z: 156.0, ry:  0.00, sx: 1.55, sy: 1.38, sz: 1.25 }
      ], landmarkGroup, true, true);
    }
    if (ruinWall) {
      addInstancedCluster(ruinWall.geometry, ruinStoneMat, [
        { x: 68.4, y: 15.12, z: 152.2, ry:  1.80, s: 1.05 },
        { x: 59.6, y: 15.12, z: 152.6, ry: -1.35, s: 0.98 }
      ], landmarkGroup, true, true);
    }

    // 2. Sculpted Campfire Stone Rings & Split Logs at 3.2 Pier Bonfire (46, 1.65, 54) & 5.1 Camp Bonfire (50, 13.5, 134)
    const cfStones = ruinsPack.meshMap.get('Campfire_Stones');
    const cfLogs = ruinsPack.meshMap.get('Campfire_Logs');
    const cfAsh = ruinsPack.meshMap.get('Campfire_Ash_Mound');
    const cfXforms = [
      { x: 46.0, y: 1.64, z: 54.0, ry: 0.45, s: 1.24 },
      { x: 50.0, y: 13.48, z: 134.0, ry: 1.85, s: 1.32 }
    ];
    if (cfStones) addInstancedCluster(cfStones.geometry, cliffRockMat, cfXforms, landmarkGroup, true, true);
    if (cfLogs) addInstancedCluster(cfLogs.geometry, barkMat, cfXforms, landmarkGroup, true, true);
    if (cfAsh) addInstancedCluster(cfAsh.geometry, cliffRockMat, cfXforms, landmarkGroup, false, true);

    // 3. Weathered Wooden Crates, Barrels & Plank Piles (village cargo & hunter camp supplies, culled > 130m!)
    const crateMesh = ruinsPack.meshMap.get('Wooden_Crate_AAA');
    const barrelMesh = ruinsPack.meshMap.get('Oak_Barrel_AAA');
    const plankPile = ruinsPack.meshMap.get('Weathered_Plank_Pile');

    if (crateMesh) {
      addInstancedCluster(crateMesh.geometry, timberWoodMat, [
        { x: 11.2, y: 0.65, z: 21.8, ry: 0.35, s: 0.92 },
        { x: 31.4, y: 1.35, z: 47.2, ry: 0.22, s: 0.98 },
        { x: 36.8, y: 1.35, z: 43.8, ry: 1.15, s: 1.02 },
        { x: 44.2, y: 1.65, z: 56.6, ry: -0.42, s: 0.96 },
        { x: 50.2, y: 1.35, z: 48.2, ry: 0.78, s: 0.95 }
      ], chunkS3Minor, true, true);
      addInstancedCluster(crateMesh.geometry, timberWoodMat, [
        { x: 54.6, y: 13.50, z: 138.8, ry: 0.42, s: 1.02 },
        { x: 53.8, y: 13.50, z: 139.6, ry: -0.25, s: 0.94 },
        { x: 44.2, y: 13.50, z: 127.8, ry: 1.05, s: 1.00 },
        { x: 47.6, y: 13.50, z: 143.2, ry: 0.18, s: 0.96 }
      ], chunkS5Minor, true, true);
    }

    if (barrelMesh) {
      addInstancedCluster(barrelMesh.geometry, timberWoodMat, [
        { x: 10.4, y: 0.65, z: 22.0, ry: 0.2, s: 0.94 },
        { x: 32.2, y: 1.35, z: 46.6, ry: 1.4, s: 0.98 },
        { x: 37.5, y: 1.35, z: 44.4, ry: 0.5, s: 0.96 },
        { x: 49.4, y: 1.35, z: 48.8, ry: 2.1, s: 1.00 },
        { x: 53.4, y: 8.20, z: 83.2, ry: 0.8, s: 0.98 }
      ], chunkS3Minor, true, true);
      addInstancedCluster(barrelMesh.geometry, timberWoodMat, [
        { x: 55.4, y: 13.50, z: 137.4, ry: 0.3, s: 1.02 },
        { x: 55.8, y: 13.50, z: 136.4, ry: 1.8, s: 0.96 },
        { x: 44.8, y: 13.50, z: 128.6, ry: 0.9, s: 0.98 }
      ], chunkS5Minor, true, true);
    }

    if (plankPile) {
      addInstancedCluster(plankPile.geometry, wetPierTimberMat, [
        { x: 39.2, y: 1.35, z: 51.5, ry: 0.45, s: 1.08 },
        { x: 47.8, y: 1.35, z: 46.2, ry: -0.72, s: 1.02 },
        { x: 61.8, y: 0.92, z: 33.8, ry: 1.15, s: 1.12 }
      ], chunkS3Minor, true, true);
      addInstancedCluster(plankPile.geometry, timberWoodMat, [
        { x: 45.2, y: 13.50, z: 122.4, ry: 0.35, s: 1.10 },
        { x: 51.6, y: 13.50, z: 129.8, ry: -0.82, s: 0.98 }
      ], chunkS5Minor, true, true);
    }

    // 4. Tattered Crimson Hunter Banners marking Watch-Cliff Turret & Hunter Camp Entrance!
    const bannerPole = ruinsPack.meshMap.get('Banner_Pole_Wood');
    const bannerCloth = ruinsPack.meshMap.get('Banner_Cloth');
    if (bannerPole && bannerCloth) {
      const bannerSpecs = [
        { x: 50.8, y: 8.20, z: 79.0, ry: -0.45, s: 1.08 },
        { x: 46.2, y: 13.50, z: 121.0, ry: 0.15, s: 1.12 },
        { x: 41.2, y: 13.50, z: 149.2, ry: 3.14, s: 1.10 },
        { x: 46.8, y: 13.50, z: 149.2, ry: 3.14, s: 1.10 }
      ];
      addInstancedCluster(bannerPole.geometry, timberWoodMat, bannerSpecs, landmarkGroup, true, true);
      addInstancedCluster(bannerCloth.geometry, crimsonBannerMat, bannerSpecs, landmarkGroup, true, true);
    }

    return true;
  });

  // --------------------------------------------------------------------------
  // 10. ZERO-GC PER-FRAME UPDATE (Waterfalls, Lanterns, Boats, SC-4 Log & Culling)
  // --------------------------------------------------------------------------
  function update(dt = 0.016, elapsed = 0, camPos = null) {
    if (disposed) return;

    const safeDt = Math.min(Math.max(Number.isFinite(dt) ? dt : 0.016, 0.001), 0.1);
    const t = Number.isFinite(elapsed) ? elapsed : (uTimeUniform ? uTimeUniform.value : 0.0);

    // 1. SC-4 Animated Kick-Down Log Bridge smooth fall/raise
    const targetAnim = logShortcutUnlocked ? 1.0 : 0.0;
    if (Math.abs(logShortcutAnim - targetAnim) > 0.0005) {
      const step = safeDt * 0.72;
      logShortcutAnim = logShortcutAnim < targetAnim
        ? Math.min(targetAnim, logShortcutAnim + step)
        : Math.max(targetAnim, logShortcutAnim - step);
      applyLogShortcutPose();
    }

    // 2. Warm lantern, campfire & secret-chest shimmer sprites
    for (let i = 0; i < warmSprites.length; i++) {
      const ws = warmSprites[i];
      const pulse = 0.90 + 0.09 * Math.sin(t * 7.1 + ws.phase) + 0.04 * Math.cos(t * 14.8 + ws.phase * 1.6);
      const sc = ws.baseScale * pulse;
      ws.sprite.scale.set(sc, sc, 1);
    }

    // 3. Waterfall plunge-pool rising mist spray sprites
    for (let i = 0; i < spraySprites.length; i++) {
      const sp = spraySprites[i];
      const raw = sp.phase + t * sp.speed;
      const cyc = raw - Math.floor(raw);
      const sc = sp.baseScale * (0.72 + cyc * 0.85);
      sp.sprite.position.set(
        sp.baseX + sp.driftX * cyc + Math.sin(t * 0.9 + sp.phase * 6.28) * 0.35,
        sp.baseY + cyc * sp.riseH,
        sp.baseZ + sp.driftZ * cyc + Math.cos(t * 0.8 + sp.phase * 6.28) * 0.35
      );
      sp.sprite.scale.set(sc, sc * 0.80, 1);
    }

    // 4. Gently bobbing moored fishing rowboats on the moonlit lagoon
    for (let i = 0; i < bobbingBoats.length; i++) {
      const b = bobbingBoats[i];
      const wave = Math.sin(t * 1.35 + b.phase);
      const sway = Math.cos(t * 0.95 + b.phase * 1.3);
      b.obj.position.y = b.baseY + wave * 0.055;
      b.obj.rotation.x = sway * 0.032;
      b.obj.rotation.z = wave * 0.042;
      b.obj.rotation.y = b.baseRy + Math.sin(t * 0.45 + b.phase) * 0.035;
    }

    // 5. Distance Chunk Culling (> 130m hysteresis for dense minor props/foliage!)
    if (camPos && Number.isFinite(camPos.x) && Number.isFinite(camPos.z)) {
      const cx = camPos.x;
      const cy = Number.isFinite(camPos.y) ? camPos.y : 0.0;
      const cz = camPos.z;
      for (let i = 0; i < cullChunks.length; i++) {
        const ch = cullChunks[i];
        const dx = cx - ch.x;
        const dy = cy - ch.y;
        const dz = cz - ch.z;
        const dSq = dx * dx + dy * dy + dz * dz;
        if (ch.group.visible) {
          if (dSq > ch.hideDistSq) ch.group.visible = false;
        } else {
          if (dSq < ch.showDistSq) ch.group.visible = true;
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // 11. FULL GPU & SCENE GRAPH DISPOSE HYGIENE
  // --------------------------------------------------------------------------
  function dispose() {
    if (disposed) return;
    disposed = true;

    for (let i = 0; i < campfireHandles.length; i++) {
      const r = campfireHandles[i]?.root;
      if (r && r.parent) r.parent.remove(r);
    }
    campfireHandles.length = 0;

    for (let i = 0; i < ownedInsts.length; i++) {
      ownedInsts[i]?.dispose?.();
    }
    ownedInsts.length = 0;

    for (let i = 0; i < ownedGeos.length; i++) {
      ownedGeos[i]?.dispose?.();
    }
    ownedGeos.length = 0;

    for (let i = 0; i < ownedMats.length; i++) {
      ownedMats[i]?.dispose?.();
    }
    ownedMats.length = 0;

    for (let i = 0; i < ownedTextures.length; i++) {
      ownedTextures[i]?.dispose?.();
    }
    ownedTextures.length = 0;

    warmSprites.length = 0;
    spraySprites.length = 0;
    bobbingBoats.length = 0;
    cullChunks.length = 0;

    if (group.parent) group.parent.remove(group);
  }

  return {
    group,
    readyPromise,
    setLogShortcutUnlocked,
    update,
    dispose
  };
}
