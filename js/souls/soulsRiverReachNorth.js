// Grimborne Hunters — Northern Heights, Ancient Cloister & Mountain Monastery 3D Builder (`z104`)
// «Скальные высоты (06) • Древние сооружения (07) • Заброшенный Монастырь (08)»
// Pure Vanilla ES Module (Three.js r160, ZERO external CDN dependencies, 60+ FPS, ZERO GC in update(), full dispose()).
//
// Exports:
//   - createSoulsRiverReachNorth(THREE, ctx)
//
// Builds:
//   1. Northern Mountain Crags Terrain Mesh (x=-46..+68, z=+116..+336) via evalTerrainY(x, z) + terrainMat
//      with baked zero-PointLight warm firelight radiance pools at 6.4, 7.1, 7.5, 8.3 & landmark braziers.
//   2. Swirling Abyssal Mist Cloud Sea (3 layered soft drifting translucent cloud sheets at y=+4m, +12m, +16m).
//   3. Solid Multi-Elevation Walkable Decks, Switchback Stairs & Retaining Architecture (ZERO floating hero!):
//        - Sector 06: P08 Basalt Pass, 6.1 Scaffolding Catwalk, 6.2 Windy Bastion, 6.5 Secret Eagle Cave,
//                     6.4 Semicircular Cliff Bonfire Terrace, 6.3 Upper Lift Walkway,
//                     Working Animated Vertical Counterweight Cage Lift (SC-2: y=2.65m <-> 17.65m), P11 Twin Stair.
//        - Sector 07: 7.3 Cloister Colonnades, 7.1 Bell-Tower Plaza, 7.2 360-deg Sunken Amphitheater + P10 Steps,
//                     7.4 Underground Relic Crypt, 7.5 Pre-Viaduct Cliff Rim Terrace.
//        - Sector 08: 8.1 Grand Broken Viaduct (3 spans), 8.2 Twin-Towered Monastery Gatehouse,
//                     8.3 Ribbed Cathedral Boss Courtyard, 8.4 Shortcut Bell-Tower & Animated Gate/Lever (SC-3),
//                     8.5 Northern Region II Causeway & Citadel Gate.
//   4. Unified Moss-Coated Stone GLB Kit Loading (`sector0506_camp_heights`, `sector07_ruins`, `sector08_monastery`,
//      `gorge_nature`, `gorge_ruins`), Always-Visible Regional Sightlines, Roaring Campfires/Braziers (ZERO PointLights),
//      Botanical Undergrowth, and Region II Alpine Mountain Fangs (`z = 335..410`).

import { createMossCoatedStoneMaterial } from './soulsGorgeTerrainMat.js?v=20261125z104';

const ASSET_VER = '20261125z104';
const GLB_URLS = Object.freeze({
  campHeights: `./assets/env/sector0506_camp_heights.glb?v=${ASSET_VER}`,
  ruins07: `./assets/env/sector07_ruins.glb?v=${ASSET_VER}`,
  monastery08: `./assets/env/sector08_monastery.glb?v=${ASSET_VER}`,
  nature: `./assets/env/gorge_nature.glb?v=${ASSET_VER}`,
  gorgeRuins: `./assets/env/gorge_ruins.glb?v=${ASSET_VER}`
});

const LIFT_X = -5.6;
const LIFT_Z = 118.2;
const LIFT_CW_X = LIFT_X - 3.15;
const LIFT_Y_MIN = 2.65;
const LIFT_Y_MAX = 17.65;
const LIFT_PULLEY_Y = 21.85;
const LIFT_PULLEY_RADIUS = 1.10;
const LIFT_CAGE_TOP_OFFSET = 3.60;

const SC3_GATE_X = -13.0;
const SC3_GATE_Y = 27.50;
const SC3_GATE_Z = 266.0;
const SC3_LEVER_X = -11.4;
const SC3_LEVER_Y = 27.80;
const SC3_LEVER_Z = 269.0;

// ============================================================================
// Pure Zero-GC Math Utilities
// ============================================================================
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

// Standalone BufferGeometry Fallbacks (used only if caller omits helpers)
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
    const pos = g.attributes.position;
    const norm = g.attributes.normal;
    if (boxUvTile > 0) {
      const inv = 1.0 / Math.max(0.05, boxUvTile);
      const uvArr = new Float32Array(pos.count * 2);
      for (let v = 0; v < pos.count; v++) {
        const ax = Math.abs(norm.getX(v));
        const ay = Math.abs(norm.getY(v));
        const az = Math.abs(norm.getZ(v));
        if (ay >= ax && ay >= az) {
          uvArr[v * 2] = pos.getX(v) * inv;
          uvArr[v * 2 + 1] = pos.getZ(v) * inv;
        } else if (ax >= az) {
          uvArr[v * 2] = pos.getZ(v) * inv;
          uvArr[v * 2 + 1] = pos.getY(v) * inv;
        } else {
          uvArr[v * 2] = pos.getX(v) * inv;
          uvArr[v * 2 + 1] = pos.getY(v) * inv;
        }
      }
      g.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
    } else if (!g.attributes.uv) {
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2));
    }
    if (withColor && !g.attributes.color) {
      const cArr = new Float32Array(pos.count * 3);
      cArr.fill(1.0);
      g.setAttribute('color', new THREE.BufferAttribute(cArr, 3));
    }
    totalVerts += pos.count;
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
// Procedural Curved Botanical Cards (Woodland Ferns & Cascading Ivy Curtains)
// ============================================================================
function buildCurvedCardGeo(THREE, width, height, segsY = 4, archFwd = 0.22, vCamber = 0.06, tiltX = 0.0) {
  const geo = new THREE.PlaneGeometry(width, height, 2, segsY);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i) + height * 0.5;
    const t = clamp01(y / Math.max(0.001, height));
    const nx = Math.abs(x / Math.max(0.001, width * 0.5));
    const curveZ = t * t * archFwd - nx * vCamber * (0.4 + 0.6 * t);
    const curveY = y - t * t * t * archFwd * 0.42;
    pos.setXYZ(i, x, curveY, curveZ);
  }
  if (tiltX !== 0) geo.rotateX(tiltX);
  geo.computeVertexNormals();
  return geo;
}

function buildFernRosetteGeo(THREE, mergeFn) {
  const parts = [];
  const frondSpecs = [
    { yaw: 0.00, len: 1.08, w: 0.64, arch: 0.48, tilt: 0.58 },
    { yaw: 1.24, len: 0.98, w: 0.58, arch: 0.44, tilt: 0.62 },
    { yaw: 2.52, len: 1.10, w: 0.65, arch: 0.50, tilt: 0.55 },
    { yaw: 3.78, len: 0.94, w: 0.56, arch: 0.42, tilt: 0.66 },
    { yaw: 5.04, len: 1.02, w: 0.60, arch: 0.46, tilt: 0.60 },
    { yaw: 0.62, len: 0.74, w: 0.48, arch: 0.28, tilt: 0.34 },
    { yaw: 3.15, len: 0.78, w: 0.50, arch: 0.30, tilt: 0.36 }
  ];
  for (let i = 0; i < frondSpecs.length; i++) {
    const f = frondSpecs[i];
    const g = buildCurvedCardGeo(THREE, f.w, f.len, 3, f.arch, 0.05, f.tilt);
    g.rotateY(f.yaw);
    parts.push(g);
  }
  return mergeFn(THREE, parts, { boxUvTile: 0, withColor: false });
}

// Wind-Sway onBeforeCompile Patch (full USE_INSTANCING support!)
function applyWindSway(mat, uTimeUniform, { amp = 0.09, freq = 1.65, anchorTop = false, cacheKey = 'rr_north_wind' } = {}) {
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
          float ph = uWindTime * ${freq.toFixed(2)} + wBase.x * 0.36 + wBase.z * 0.28 + position.y * 0.52;
          transformed.x += sin(ph) * ${amp.toFixed(4)} * swayMask;
          transformed.z += cos(ph * 0.82 + 1.3) * ${(amp * 0.75).toFixed(4)} * swayMask;
        }`
      );
  };
  mat.customProgramCacheKey = () => cacheKey;
  return mat;
}

// ============================================================================
// Main Factory: `createSoulsRiverReachNorth`
// ============================================================================
export function createSoulsRiverReachNorth(THREE, ctx = {}) {
  const {
    parentGroup = null,
    gltfLoader = null,
    pbrTex = null,
    terrainMat = null,
    campfireRig = null,
    isMobile = false,
    lowSpecMode = false,
    trackGeo = null,
    trackMat = null,
    regNormalMat = null,
    xformGeo = fallbackXformGeo,
    tintGeo = fallbackTintGeo,
    mergeNonIndexedGeos = fallbackMergeNonIndexedGeos,
    uTimeUniform = { value: 0.0 },
    mistSpriteTex = null,
    evalTerrainY = null
  } = ctx;

  const evalY = typeof evalTerrainY === 'function'
    ? evalTerrainY
    : (x, z) => {
        const tz = clamp01((z - 120.0) / 198.0);
        return lerp(2.65, 31.5, tz) - Math.max(0.0, Math.abs(x - 6.0) - 24.0) * 0.35;
      };

  const ownedGeos = [];
  const ownedMats = [];
  const ownedTex = [];
  const addedCampfireRoots = [];

  function ownGeo(g) {
    if (!g) return g;
    ownedGeos.push(g);
    if (typeof trackGeo === 'function') trackGeo(g);
    return g;
  }

  function ownMat(m) {
    if (!m) return m;
    ownedMats.push(m);
    if (typeof trackMat === 'function') trackMat(m);
    return m;
  }

  const group = new THREE.Group();
  group.name = 'SoulsRiverReachNorth';
  if (parentGroup) parentGroup.add(group);

  const rng = makeRng(202611256);
  const alwaysOneUniform = ctx.alwaysOneUniform || { value: 1.0 };

  // Scratch transform objects allocated ONCE (ZERO per-frame GC!)
  const _obj = new THREE.Object3D();
  const _matA = new THREE.Matrix4();

  // ==========================================================================
  // 1. UNIFIED STYLIZED-REALISTIC MOSS-COATED PBR MATERIALS (`soulsGorgeTerrainMat`)
  // ==========================================================================
  const ruinStoneMat = createMossCoatedStoneMaterial(THREE, pbrTex, {
    kind: 'ruin',
    color: 0xcbd8ec,
    envMapIntensity: 0.68,
    mossAmount: 0.62,
    groundAO: 0.25,
    rimStrength: 0.26,
    lowSpecMode,
    trackMat: ownMat,
    regNormalMat
  });

  const monasteryStoneMat = createMossCoatedStoneMaterial(THREE, pbrTex, {
    kind: 'ruin',
    color: 0xd0ddef,
    envMapIntensity: 0.74,
    mossAmount: 0.48,
    groundAO: 0.24,
    rimStrength: 0.30,
    lowSpecMode,
    trackMat: ownMat,
    regNormalMat
  });

  const ruinStoneDeckMat = createMossCoatedStoneMaterial(THREE, pbrTex, {
    kind: 'deck',
    color: 0xb8c4d8,
    envMapIntensity: 0.52,
    mossAmount: 0.18,
    groundAO: 0.24,
    rimStrength: 0.13,
    lowSpecMode,
    trackMat: ownMat,
    regNormalMat
  });

  const cliffRockMat = createMossCoatedStoneMaterial(THREE, pbrTex, {
    kind: 'cliff',
    color: 0xa8b5c8,
    envMapIntensity: 0.42,
    mossAmount: 0.78,
    groundAO: 0.38,
    rimStrength: 0.16,
    lowSpecMode,
    trackMat: ownMat,
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
    trackMat: ownMat,
    regNormalMat
  });

  const barkMat = createMossCoatedStoneMaterial(THREE, pbrTex, {
    kind: 'bark',
    color: 0xb6aca2,
    envMapIntensity: 0.42,
    mossAmount: 0.30,
    groundAO: 0.38,
    rimStrength: 0.14,
    lowSpecMode,
    trackMat: ownMat,
    regNormalMat
  });

  const timberWoodMat = createMossCoatedStoneMaterial(THREE, pbrTex, {
    kind: 'timber',
    color: 0xb8a898,
    envMapIntensity: 0.44,
    mossAmount: 0.14,
    groundAO: 0.32,
    rimStrength: 0.12,
    lowSpecMode,
    trackMat: ownMat,
    regNormalMat
  });

  const forgedIronMat = ownMat(new THREE.MeshStandardMaterial({
    color: 0x3b424e,
    roughness: 0.46,
    metalness: 0.82,
    envMapIntensity: 0.62,
    vertexColors: true
  }));

  const forgedIronPlainMat = ownMat(new THREE.MeshStandardMaterial({
    color: 0x3b424e,
    roughness: 0.46,
    metalness: 0.82,
    envMapIntensity: 0.62,
    vertexColors: false
  }));

  // Subtle glowing forged-iron chain material for SC-2 Cage Lift suspension chains
  const liftChainMat = ownMat(new THREE.MeshStandardMaterial({
    color: 0x454e5d,
    emissive: new THREE.Color(0xff8428),
    emissiveIntensity: 0.36,
    roughness: 0.38,
    metalness: 0.86,
    envMapIntensity: 0.68
  }));

  const lanternGlassMat = ownMat(new THREE.MeshStandardMaterial({
    color: 0xffd584,
    emissive: new THREE.Color(0xff9a28),
    emissiveIntensity: 3.8,
    roughness: 0.22,
    metalness: 0.0
  }));

  const monasteryWindowMat = ownMat(new THREE.MeshStandardMaterial({
    color: 0xffc470,
    emissive: new THREE.Color(0xff8e24),
    emissiveIntensity: 2.8,
    roughness: 0.28,
    metalness: 0.0
  }));

  const crimsonBannerMat = applyWindSway(
    ownMat(new THREE.MeshStandardMaterial({
      color: 0x9b242c,
      roughness: 0.86,
      metalness: 0.02,
      envMapIntensity: 0.42,
      vertexColors: true,
      side: THREE.DoubleSide
    })),
    uTimeUniform,
    { amp: 0.14, freq: 2.1, anchorTop: true, cacheKey: 'rr_north_banner_wind' }
  );

  // Botanical Alpha-Cutout Materials (matching gorgeRoad calibration & zero white halo)
  const pineFoliageMat = applyWindSway(
    ownMat(new THREE.MeshStandardMaterial({
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
    { amp: 0.11, freq: 1.35, anchorTop: false, cacheKey: 'rr_north_pine_wind' }
  );

  const ivyArchMat = applyWindSway(
    ownMat(new THREE.MeshStandardMaterial({
      map: pbrTex?.foliage?.ivyVine || null,
      alphaTest: 0.36,
      side: THREE.DoubleSide,
      color: 0xcce2c6,
      roughness: 0.80,
      metalness: 0.02,
      envMapIntensity: 0.48,
      vertexColors: true
    })),
    uTimeUniform,
    { amp: 0.06, freq: 1.75, anchorTop: true, cacheKey: 'rr_north_ivy_arch_wind' }
  );

  const ivyCurtainMat = applyWindSway(
    ownMat(new THREE.MeshStandardMaterial({
      map: pbrTex?.foliage?.ivyVinePlane || null,
      alphaTest: 0.36,
      side: THREE.DoubleSide,
      color: 0xc2d8bc,
      roughness: 0.82,
      metalness: 0.02,
      envMapIntensity: 0.48
    })),
    uTimeUniform,
    { amp: 0.06, freq: 1.75, anchorTop: true, cacheKey: 'rr_north_ivy_plane_wind' }
  );

  const fernMat = applyWindSway(
    ownMat(new THREE.MeshStandardMaterial({
      map: pbrTex?.foliage?.fernFrond || null,
      alphaTest: 0.42,
      side: THREE.DoubleSide,
      color: 0xd0e2c4,
      roughness: 0.78,
      metalness: 0.02,
      envMapIntensity: 0.48
    })),
    uTimeUniform,
    { amp: 0.075, freq: 1.85, anchorTop: false, cacheKey: 'rr_north_fern_wind' }
  );

  // Atmospheric Distant Region II Alpine Mountain Fangs Material (full USE_INSTANCING support!)
  const distantMountainMat = ownMat(new THREE.ShaderMaterial({
    uniforms: {
      uTime: uTimeUniform
    },
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
        float rim = pow(1.0 - max(dot(N, V), 0.0), 2.5);
        float ridge = smoothstep(0.42, 0.86, N.y);

        // Deep brooding dark charcoal-slate alpine granite with cold silver moonlight along jagged arêtes
        vec3 rockDark = vec3(0.016, 0.028, 0.052);
        vec3 rockLit  = vec3(0.088, 0.130, 0.204);
        vec3 col = mix(rockDark, rockLit, clamp(ndl * 0.58 + ridge * 0.24, 0.0, 1.0)) * (0.64 + 0.48 * vCol.r);
        col += vec3(0.20, 0.30, 0.46) * rim * (0.34 + 0.66 * ndl);

        // High-altitude abyssal blue-slate cloud sea enveloping mountain bases (y < 36m) + aerial perspective
        float dist = length(vWorldPos - cameraPosition);
        float cloudBaseMist = (1.0 - smoothstep(10.0, 42.0, vWorldPos.y)) * 0.78;
        float depthMist = smoothstep(82.0, 235.0, dist) * 0.68;
        float totalMist = clamp(max(cloudBaseMist, depthMist), 0.0, 0.88);
        vec3 mistCol = mix(
          vec3(0.084, 0.140, 0.236),
          vec3(0.155, 0.232, 0.362),
          clamp(ndl * 0.38 + smoothstep(18.0, 56.0, vWorldPos.y) * 0.28, 0.0, 1.0)
        );
        col = mix(col, mistCol, totalMist);

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.FrontSide,
    fog: false
  }));

  // Warm soft glow halo sprite for lanterns, braziers & bonfires (Zero PointLights!)
  const warmHaloMat = ownMat(new THREE.SpriteMaterial({
    map: mistSpriteTex || null,
    color: 0xffa63d,
    transparent: true,
    opacity: 0.50,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }));

  // Additive flickering warm amber ground-bounce radiance disc for elevated masonry decks
  const warmDeckPoolMat = ownMat(new THREE.ShaderMaterial({
    uniforms: {
      uTime: uTimeUniform
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    fog: false,
    vertexShader: `
      attribute float aPoolPhase;
      attribute float aPoolStr;
      varying vec2 vUv;
      varying float vPhase;
      varying float vStr;
      void main() {
        vUv = uv;
        vPhase = aPoolPhase;
        vStr = aPoolStr;
        vec4 localPos = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          localPos = instanceMatrix * localPos;
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * localPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying float vPhase;
      varying float vStr;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r2 = dot(p, p);
        if (r2 >= 1.0) discard;
        float r = sqrt(r2);
        float flick = 0.88 + 0.08 * sin(uTime * 7.4 + vPhase) + 0.04 * cos(uTime * 13.8 - vPhase * 1.4);
        float falloff = exp(-r2 * 3.4) * (1.0 - smoothstep(0.55, 1.0, r));
        vec3 warmCol = mix(vec3(0.95, 0.30, 0.04), vec3(1.42, 0.68, 0.16), exp(-r2 * 4.2));
        float alpha = falloff * vStr * flick;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(warmCol * flick, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  }));

  // ==========================================================================
  // 2. NORTHERN MOUNTAIN CRAGS TERRAIN MESH (x=-46..+68, z=+116..+336)
  //    Evaluates evalTerrainY(x, z), uses shared terrainMat + baked warm fire pools!
  // ==========================================================================
  function buildNorthernTerrainGeo() {
    const minX = -46.0;
    const maxX = 68.0;
    const minZ = 116.0;
    const maxZ = 336.0;
    const segX = isMobile ? 64 : 114;
    const segZ = isMobile ? 112 : 196;

    const geo = new THREE.PlaneGeometry(maxX - minX, maxZ - minZ, segX, segZ);
    geo.rotateX(-Math.PI * 0.5);
    geo.translate((minX + maxX) * 0.5, 0, (minZ + maxZ) * 0.5);

    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    const cols = new Float32Array(pos.count * 3);
    const mixAttr = new Float32Array(pos.count * 4);

    const cDry = new THREE.Color(0x6e7b91);
    const cPath = new THREE.Color(0x9aa8bf);
    const cMoss = new THREE.Color(0x5d785e);
    const cCliff = new THREE.Color(0x4b586e);
    const cAbyss = new THREE.Color(0x232c3d);
    const cWarmFire = new THREE.Color(0xffaa52);
    const cTmp = new THREE.Color();

    // Baked Zero-PointLight Warm Firelight Radiance Pools (6.4, 7.1, 7.5, 8.3 & landmarks!)
    const bakedWarmPools = [
      // Sector 06: 6.2 Windy Bastion & 6.4 Cliff Bonfire (-12, 170)
      { x: -19.5, z: 154.5, r: 6.8, w: 0.56 },
      { x: -12.0, z: 170.0, r: 10.2, w: 0.82 },
      // Sector 07: 7.3 Cloister, 7.1 Bell-Tower Plaza (16, 208) + 4 Corner Braziers, 7.4 Crypt, 7.5 Pre-Viaduct (12, 236)
      { x: -1.8,  z: 192.5, r: 6.0, w: 0.50 },
      { x:  6.0,  z: 192.0, r: 6.0, w: 0.50 },
      { x: 16.0,  z: 208.0, r: 13.5, w: 0.60 },
      { x: 10.2,  z: 202.2, r: 6.8, w: 0.68 },
      { x: 21.8,  z: 202.2, r: 6.8, w: 0.68 },
      { x: 10.2,  z: 213.8, r: 6.8, w: 0.68 },
      { x: 21.8,  z: 213.8, r: 6.8, w: 0.68 },
      { x: -5.5,  z: 206.0, r: 6.2, w: 0.52 },
      { x: 12.0,  z: 236.0, r: 10.0, w: 0.82 },
      // Sector 08: 8.2 Gatehouse Twin Braziers, 8.3 Cathedral Courtyard (12, 294) + 5 Braziers, 8.4 Shortcut Turret
      { x:  7.8,  z: 270.4, r: 6.8, w: 0.64 },
      { x: 16.2,  z: 270.4, r: 6.8, w: 0.64 },
      { x: 12.0,  z: 294.0, r: 16.5, w: 0.72 },
      { x:  5.2,  z: 282.5, r: 7.2, w: 0.68 },
      { x: 18.8,  z: 282.5, r: 7.2, w: 0.68 },
      { x:  5.2,  z: 292.0, r: 7.2, w: 0.68 },
      { x: 18.8,  z: 292.0, r: 7.2, w: 0.68 },
      { x: 12.0,  z: 295.2, r: 8.5, w: 0.74 },
      { x: -13.0, z: 266.0, r: 7.0, w: 0.52 }
    ];

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const rawY = evalY(x, z);
      // Depress beneath EastValleyTerrain inside Sector 05 overlap (x > 13, z < 183) to prevent coplanar z-fighting!
      const eastOverlap = smoothstep(12.5, 16.5, x) * (1.0 - smoothstep(177.5, 182.5, z));
      const y = rawY - eastOverlap * 1.65;
      pos.setY(i, y);
      uv.setXY(i, x * 0.44, z * 0.44);

      // Finite-difference slope for crisp basalt cliff vs mossy alpine ledge vs cobbled terrace blending
      const dx = (evalY(x + 1.0, z) - evalY(x - 1.0, z)) * 0.5;
      const dz = (evalY(x, z + 1.0) - evalY(x, z - 1.0)) * 0.5;
      const slope = Math.hypot(dx, dz);

      // Walkable stone plazas, terraces & trail footprints across Sectors 06, 07, 08
      let pathT = 0.0;
      if (z >= 118.0 && z <= 137.0 && x >= -6.0 && x <= 5.0) pathT = 0.85; // P08 Basalt Pass
      if (z >= 149.0 && z <= 179.0 && x >= -27.0 && x <= -5.0) pathT = Math.max(pathT, 0.78); // 6.2 & 6.4
      if (z >= 186.0 && z <= 226.0 && x >= -7.0 && x <= 30.0) pathT = Math.max(pathT, 0.88); // 7.3 & 7.1 Plaza
      if (Math.hypot(x - 36.0, z - 214.0) < 12.5) pathT = Math.max(pathT, 0.74); // 7.2 Amphitheater
      if (z >= 224.0 && z <= 243.0 && x >= 5.0 && x <= 19.0) pathT = Math.max(pathT, 0.86); // 7.5 Pre-Viaduct
      if (z >= 272.0 && z <= 319.0 && x >= -5.0 && x <= 29.0) pathT = Math.max(pathT, 0.90); // 8.3 & 8.5 Cathedral
      if (z >= 178.0 && z <= 204.0 && x >= 35.0 && x <= 49.0) pathT = Math.max(pathT, 0.65); // P10 Forest Trail
      pathT *= (1.0 - smoothstep(0.45, 0.95, slope));

      const cliffT = clamp01(smoothstep(0.42, 1.05, slope) * 0.92 + (1.0 - smoothstep(4.0, 12.0, y)) * 0.35);
      const mossNoise = clamp01(0.5 + 0.5 * Math.sin(x * 0.38 + z * 0.27) * Math.cos(z * 0.31 - x * 0.22));
      const mossT = clamp01((0.36 + mossNoise * 0.64) * (1.0 - pathT * 0.78) * (1.0 - cliffT * 0.82) * smoothstep(3.0, 14.0, y));
      const dampT = clamp01(pathT * 0.34 + (1.0 - smoothstep(6.0, 16.0, y)) * 0.55);

      mixAttr[i * 4] = pathT;
      mixAttr[i * 4 + 1] = mossT;
      mixAttr[i * 4 + 2] = cliffT;
      mixAttr[i * 4 + 3] = dampT;

      cTmp.copy(cDry);
      cTmp.lerp(cPath, pathT * 0.72);
      cTmp.lerp(cMoss, mossT * 0.58);
      cTmp.lerp(cCliff, cliffT * 0.72);
      const abyssFade = 1.0 - smoothstep(2.0, 13.0, y);
      cTmp.lerp(cAbyss, abyssFade * 0.58);

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

      cols[i * 3] = cTmp.r;
      cols[i * 3 + 1] = cTmp.g;
      cols[i * 3 + 2] = cTmp.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geo.setAttribute('aTerrainMix', new THREE.BufferAttribute(mixAttr, 4));
    geo.computeVertexNormals();
    return geo;
  }

  const northTerrainMat = terrainMat || cliffRockMat;
  const northTerrainMesh = new THREE.Mesh(ownGeo(buildNorthernTerrainGeo()), northTerrainMat);
  northTerrainMesh.name = 'NorthernMountainCragsTerrain';
  northTerrainMesh.receiveShadow = true;
  northTerrainMesh.castShadow = false;
  group.add(northTerrainMesh);

  // ==========================================================================
  // 3. SWIRLING ABYSSAL MIST CLOUD SEA (3 Layered Drifting Cloud Sheets!)
  //    Hangs deep beneath Sector 06 Scaffolding (y=+4m) & Sector 08 Viaduct (y=+12m, +16m)
  // ==========================================================================
  function createAbyssalCloudMaterial({ speedX = 0.022, speedZ = 0.014, opacity = 0.56, tintHex = 0x1e324d, rimHex = 0x5275a4, seed = 0.0 }) {
    return ownMat(new THREE.ShaderMaterial({
      uniforms: {
        uTime: uTimeUniform,
        uSpeed: { value: new THREE.Vector2(speedX, speedZ) },
        uOpacity: { value: opacity },
        uSeed: { value: seed },
        uLowSpec: { value: lowSpecMode ? 1.0 : 0.0 },
        uBaseCol: { value: new THREE.Color(tintHex) },
        uRimCol: { value: new THREE.Color(rimHex) }
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
      vertexShader: `
        uniform float uTime;
        uniform float uSeed;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec3 p = position;
          float wave = sin(p.x * 0.065 + uTime * 0.28 + uSeed) * cos(p.z * 0.058 - uTime * 0.22 + uSeed * 1.7);
          p.y += wave * 1.15;
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
        uniform vec2 uSpeed;
        uniform float uOpacity;
        uniform float uSeed;
        uniform float uLowSpec;
        uniform vec3 uBaseCol;
        uniform vec3 uRimCol;
        varying vec2 vUv;
        varying vec3 vWorldPos;

        float acHash21(vec2 p) {
          p = fract(p * vec2(127.1, 311.7));
          p += dot(p, p + 34.53);
          return fract(p.x * p.y);
        }

        float acVnoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(acHash21(i), acHash21(i + vec2(1.0, 0.0)), f.x),
            mix(acHash21(i + vec2(0.0, 1.0)), acHash21(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }

        float acFbm(vec2 p) {
          float v = acVnoise(p) * 0.54;
          v += acVnoise(p * 2.08 + vec2(5.2, -3.7)) * 0.30;
          if (uLowSpec < 0.5) {
            v += acVnoise(p * 4.22 - vec2(7.4, 6.1)) * 0.16;
          }
          return v;
        }

        void main() {
          vec2 edge2 = min(vUv, 1.0 - vUv);
          float edgeMask = smoothstep(0.0, 0.22, edge2.x) * smoothstep(0.0, 0.22, edge2.y);
          if (edgeMask < 0.005) discard;

          vec2 wp = vWorldPos.xz * 0.026 + vec2(uSeed * 3.1, -uSeed * 2.4);
          vec2 drift1 = uSpeed * uTime;
          vec2 drift2 = vec2(-uSpeed.y * 0.72, uSpeed.x * 0.85) * uTime;

          // Domain-warped swirling mountain abyss cloud billows (Bloodborne / Elden Ring peak mist!)
          float warp = acFbm(wp * 1.15 + drift1 * 0.8);
          vec2 q = wp + vec2(warp * 0.85, -warp * 0.62);
          float c1 = acFbm(q * 1.45 + drift1);
          float c2 = acFbm(q * 2.75 + drift2 + vec2(4.1, -2.9));
          float cloud = smoothstep(0.24, 0.82, c1 * 0.64 + c2 * 0.36);

          // Soft moonlit crest illumination on billowing tops + subtle warm glow tint near viaduct/cliff fires
          vec3 deepSlate = uBaseCol * 0.55;
          vec3 silverCrest = uRimCol * 1.08;
          vec3 col = mix(deepSlate, uBaseCol, smoothstep(0.18, 0.58, cloud));
          col = mix(col, silverCrest, smoothstep(0.54, 0.92, cloud) * 0.65);

          // Gentle warm atmospheric scatter from Pre-Viaduct & Cliff bonfires drifting over the chasm rim
          float dCliffFire = length(vWorldPos.xz - vec2(-12.0, 170.0));
          float dViaductFire = length(vWorldPos.xz - vec2(12.0, 236.0));
          float warmRim = (exp(-dCliffFire * 0.065) + exp(-dViaductFire * 0.055)) * 0.22;
          col += vec3(0.46, 0.22, 0.06) * warmRim * cloud;

          // Soft camera-proximity fade so camera never hits a hard translucent sheet
          float camDist = length(vWorldPos - cameraPosition);
          float nearFade = smoothstep(3.0, 14.0, camDist);
          float alpha = cloud * edgeMask * nearFade * uOpacity;
          if (alpha < 0.005) discard;

          gl_FragColor = vec4(col, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `
    }));
  }

  const cloudSeaGroup = new THREE.Group();
  cloudSeaGroup.name = 'AbyssalMistCloudSea';
  group.add(cloudSeaGroup);

  const cloudLayerSpecs = [
    // Sheet 1: Deep Sector 06 Scaffolding & Lift Chasm Sea (y = +4.0m)
    {
      name: 'CloudSea_S06_Chasm',
      w: 88, d: 96, cx: -16.0, y: 4.0, cz: 158.0,
      speedX: 0.024, speedZ: 0.015, opacity: 0.56,
      tintHex: 0x1a2c44, rimHex: 0x4b6d9a, seed: 1.3
    },
    // Sheet 2: Mid-Chasm Swirling Mist Ribbon under Sector 06/07 & Grand Viaduct lower piers (y = +12.0m)
    {
      name: 'CloudSea_Mid_ViaductLower',
      w: 112, d: 156, cx: 4.0, y: 12.0, cz: 226.0,
      speedX: -0.020, speedZ: 0.016, opacity: 0.50,
      tintHex: 0x1f334f, rimHex: 0x567ba8, seed: 4.7
    },
    // Sheet 3: High Viaduct & Monastery Peak Abyssal Cloud Canopy (y = +16.0m)
    {
      name: 'CloudSea_S08_ViaductPeak',
      w: 116, d: 132, cx: 8.0, y: 16.0, cz: 284.0,
      speedX: 0.018, speedZ: -0.014, opacity: 0.48,
      tintHex: 0x243a58, rimHex: 0x6289b8, seed: 8.2
    }
  ];

  const cloudSegs = isMobile ? 12 : 24;
  for (let i = 0; i < cloudLayerSpecs.length; i++) {
    const cl = cloudLayerSpecs[i];
    const cGeo = ownGeo(new THREE.PlaneGeometry(cl.w, cl.d, cloudSegs, cloudSegs));
    cGeo.rotateX(-Math.PI * 0.5);
    const cMat = createAbyssalCloudMaterial(cl);
    const cMesh = new THREE.Mesh(cGeo, cMat);
    cMesh.name = cl.name;
    cMesh.position.set(cl.cx, cl.y, cl.cz);
    cMesh.renderOrder = 2 + i;
    cMesh.frustumCulled = false;
    cloudSeaGroup.add(cMesh);
  }

  // ==========================================================================
  // 4. SOLID MULTI-ELEVATION WALKABLE DECKS, SWITCHBACK STAIRS & ARCHITECTURE
  //    (Merged shadow-casting meshes — ZERO floating hero, 100% contract-matched!)
  // ==========================================================================
  const archStoneParts = [];
  const archDeckParts = [];
  const archTimberParts = [];

  function addMasonryBox(parts, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0, topHex = 0x8896b0, botHex = 0x384154) {
    parts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz), topHex, botHex));
  }

  function addMasonryCyl(parts, rTop, rBot, h, segs, x, y, z, topHex = 0x8896b0, botHex = 0x363f52) {
    parts.push(tintGeo(THREE, xformGeo(new THREE.CylinderGeometry(rTop, rBot, h, segs), x, y, z), topHex, botHex));
  }

  function addSteppedStairFlight(parts, {
    x0, y0, z0, x1, y1, z1,
    width = 3.6,
    steps = 14,
    sideWalls = true,
    deepFoundation = 1.2,
    topHex = 0x98a6c0,
    botHex = 0x363f52
  }) {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const horizLen = Math.hypot(dx, dz);
    const yaw = Math.atan2(dx, dz);
    const stepD = horizLen / steps;
    const minY = Math.min(y0, y1);

    for (let i = 0; i < steps; i++) {
      const f = (i + 0.5) / steps;
      const sx = lerp(x0, x1, f);
      const sz = lerp(z0, z1, f);
      const topY = lerp(y0, y1, (i + 1) / steps) + 0.01;
      const hBlock = Math.max(0.55, topY - minY + deepFoundation);
      addMasonryBox(
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
        topHex,
        botHex
      );
    }

    if (sideWalls) {
      const perpX = Math.cos(yaw);
      const perpZ = -Math.sin(yaw);
      const wallSegs = Math.max(4, Math.round(horizLen / 3.2));
      for (const side of [-1, 1]) {
        for (let k = 0; k < wallSegs; k++) {
          const f = (k + 0.5) / wallSegs;
          const cx = lerp(x0, x1, f) + perpX * side * (width * 0.5 + 0.26);
          const cz = lerp(z0, z1, f) + perpZ * side * (width * 0.5 + 0.26);
          const baseY = lerp(y0, y1, f);
          const segH = 1.22 + (k % 2) * 0.16;
          addMasonryBox(
            archStoneParts,
            0.52,
            segH,
            horizLen / wallSegs + 0.16,
            cx,
            baseY + segH * 0.30,
            cz,
            0,
            yaw,
            0,
            0x8c9ab4,
            0x394254
          );
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // 4A. SECTOR 06 — Скальные высоты (P08, 6.1, 6.2, 6.5, 6.4, 6.3, SC-2, P11)
  // --------------------------------------------------------------------------
  // P08 Basalt Pass Ascent Stairs (z=120..136, y=2.65 -> 8.0m)
  addMasonryBox(archStoneParts, 8.2, 2.8, 3.2, 0.5, 1.25, 120.5, 0, 0, 0, 0x7a88a0, 0x2b3242);
  addMasonryBox(archDeckParts,  8.0, 0.26, 3.0, 0.5, 2.53, 120.5, 0, 0, 0, 0x9aa9c4, 0x4d576c);
  addSteppedStairFlight(archDeckParts, {
    x0: 0.2, y0: 2.65, z0: 121.0,
    x1: -2.2, y1: 8.00, z1: 135.5,
    width: 6.2,
    steps: 20,
    sideWalls: true,
    deepFoundation: 3.4
  });
  // P08 Top Stone Arrival Landing joining 6.1 Scaffolding Catwalk (x=-6.8..+1.2, z=133.6..138.6, y=8.00m)
  addMasonryBox(archStoneParts, 8.2, 7.6, 5.2, -2.8, 4.10, 136.1, 0, 0, 0, 0x76849c, 0x282f3f);
  addMasonryBox(archDeckParts,  8.0, 0.26, 5.0, -2.8, 7.88, 136.1, 0, 0, 0, 0x9caac6, 0x4e586e);

  // 6.1 Cliffside Wooden Scaffolding Catwalk Deck (x=-22..-4, z=134..150, y=8.0 -> 13.0m)
  // Continuous solid stepped timber boardwalk + heavy cross-braced chasm stilts plunging 10m down!
  const scafSteps = 22;
  const scafX0 = -4.6;
  const scafZ0 = 135.8;
  const scafY0 = 8.00;
  const scafX1 = -21.2;
  const scafZ1 = 150.2;
  const scafY1 = 13.00;
  const scafYaw = Math.atan2(scafX1 - scafX0, scafZ1 - scafZ0);
  const scafLen = Math.hypot(scafX1 - scafX0, scafZ1 - scafZ0);
  const scafPerpX = Math.cos(scafYaw);
  const scafPerpZ = -Math.sin(scafYaw);
  for (let i = 0; i < scafSteps; i++) {
    const f = (i + 0.5) / scafSteps;
    const sx = lerp(scafX0, scafX1, f);
    const sz = lerp(scafZ0, scafZ1, f);
    const sy = lerp(scafY0, scafY1, (i + 1) / scafSteps) + 0.01;
    // Wide solid walkable plank tread (4.6m wide so player never slips off catwalk!)
    addMasonryBox(
      archTimberParts,
      4.6,
      0.34,
      scafLen / scafSteps + 0.28,
      sx,
      sy - 0.17,
      sz,
      0,
      scafYaw,
      0,
      0x9a8268,
      0x4e3c2c
    );
    // Heavy twin longitudinal timber stringers underneath
    for (const side of [-1.75, 1.75]) {
      addMasonryBox(
        archTimberParts,
        0.34,
        0.46,
        scafLen / scafSteps + 0.22,
        sx + scafPerpX * side,
        sy - 0.52,
        sz + scafPerpZ * side,
        0,
        scafYaw,
        0,
        0x7f6850,
        0x3d2e20
      );
    }
    // Deep cliffside scaffolding stilts, cross-bracing & handrail posts every 3 treads
    if (i % 3 === 1) {
      for (const side of [-2.05, 2.05]) {
        const px = sx + scafPerpX * side;
        const pz = sz + scafPerpZ * side;
        const postH = 10.8;
        addMasonryBox(archTimberParts, 0.34, postH, 0.34, px, sy - postH * 0.5 + 0.95, pz, 0, scafYaw, 0, 0x8a725a, 0x3b2c1e);
      }
      // Horizontal scaffold tie beam & diagonal X-brace below deck (iconic s06_view1 silhouette!)
      addMasonryBox(archTimberParts, 4.4, 0.28, 0.28, sx, sy - 2.6, sz, 0, scafYaw, 0, 0x7c644c, 0x3b2c1e);
      addMasonryBox(archTimberParts, 4.4, 0.28, 0.28, sx, sy - 5.4, sz, 0, scafYaw, 0, 0x7c644c, 0x3b2c1e);
      addMasonryBox(archTimberParts, 4.8, 0.22, 0.22, sx, sy - 4.0, sz, 0, scafYaw, 0.52, 0x7c644c, 0x3b2c1e);
      addMasonryBox(archTimberParts, 4.8, 0.22, 0.22, sx, sy - 4.0, sz, 0, scafYaw, -0.52, 0x7c644c, 0x3b2c1e);
    }
  }
  // Extra wooden staging spur platform protruding slightly cliffside (matching s06_view1 right timber scaffold!)
  addMasonryBox(archTimberParts, 4.2, 0.32, 3.8, -11.2, 10.15, 144.6, 0, scafYaw, 0, 0x988066, 0x4b3929);
  for (const ox of [-1.8, 1.8]) {
    for (const oz of [-1.6, 1.6]) {
      addMasonryBox(archTimberParts, 0.32, 9.2, 0.32, -11.2 + ox, 5.5, 144.6 + oz, 0, 0, 0, 0x826a52, 0x3a2b1e);
    }
  }

  // 6.2 Windy Bastion Overlook Stone Platform (x=-26..-16, z=150..164, y=13.0 -> 16.0m)
  // Lower Bastion Pad (z=149.2..156.6, y=13.0m -> 14.5m)
  addMasonryBox(archStoneParts, 10.6, 12.2, 7.6, -21.0, 6.85, 152.8, 0, 0, 0, 0x74829a, 0x262d3d);
  addMasonryBox(archDeckParts,  10.2, 0.28, 7.4, -21.0, 12.88, 152.8, 0, 0, 0, 0x9caac6, 0x4e586e);
  // Stepped ascent across Bastion Overlook to Upper Bastion Pad (y=13.0 -> 16.0m)
  addSteppedStairFlight(archDeckParts, {
    x0: -21.0, y0: 13.00, z0: 154.5,
    x1: -20.5, y1: 16.00, z1: 163.8,
    width: 7.4,
    steps: 12,
    sideWalls: false,
    deepFoundation: 4.5
  });
  // Upper Bastion Overlook Platform (x=-25.8..-15.6, z=158.0..165.4, y=16.0m)
  addMasonryBox(archStoneParts, 10.4, 13.8, 7.6, -20.7, 9.05, 161.7, 0, 0, 0, 0x76849c, 0x272e3e);
  addMasonryBox(archDeckParts,  10.0, 0.28, 7.4, -20.7, 15.88, 161.7, 0, 0, 0, 0x9caac6, 0x4e586e);
  // Crenellated Gothic Bastion Merlons around Windy Bastion chasm edge (matching s06_view1!)
  for (let mz = 150.2; mz <= 164.0; mz += 2.3) {
    const by = mz < 156.5 ? 13.0 : 16.0;
    addMasonryBox(archStoneParts, 0.56, 1.05, 1.38, -16.0, by + 0.52, mz, 0, 0, 0, 0x95a4be, 0x434d61);
  }
  for (let mx = -25.0; mx <= -16.6; mx += 2.1) {
    addMasonryBox(archStoneParts, 1.28, 1.08, 0.56, mx, 16.52, 165.2, 0, 0, 0, 0x95a4be, 0x434d61);
  }
  // Curved Stone Stair connecting 6.2 Windy Bastion (16.0m) -> 6.4 Upper Cliff Bonfire Terrace (17.65m)
  addSteppedStairFlight(archDeckParts, {
    x0: -18.2, y0: 16.00, z0: 162.8,
    x1: -14.2, y1: 17.65, z1: 167.2,
    width: 4.8,
    steps: 8,
    sideWalls: true,
    deepFoundation: 4.0
  });

  // 6.5 Secret Eagle Cave Shelf (x=-33..-25, z=148..156, y=14.5m)
  // Step spur off the west side of 6.2 into a secluded vaulted basalt eagle cavern!
  addSteppedStairFlight(archDeckParts, {
    x0: -24.5, y0: 13.20, z0: 152.2,
    x1: -26.6, y1: 14.50, z1: 152.2,
    width: 3.4,
    steps: 5,
    sideWalls: false,
    deepFoundation: 3.0
  });
  addMasonryBox(archStoneParts, 8.6, 11.5, 8.4, -29.2, 8.65, 152.0, 0, 0, 0, 0x6c7a92, 0x242b3a);
  addMasonryBox(archDeckParts,  8.2, 0.28, 8.0, -29.2, 14.38, 152.0, 0, 0, 0, 0x93a2bc, 0x454f64);
  // Dramatic natural-hewn cave alcove back wall & stone overhang roof sheltering the Eagle Cave chest shrine
  addMasonryBox(archStoneParts, 1.4, 5.4, 8.8, -33.2, 17.1, 152.0, 0, 0, 0, 0x606e84, 0x222836);
  addMasonryBox(archStoneParts, 8.2, 5.4, 1.2, -29.2, 17.1, 147.8, 0, 0, 0, 0x606e84, 0x222836);
  addMasonryBox(archStoneParts, 8.2, 5.4, 1.2, -29.2, 17.1, 156.2, 0, 0, 0, 0x606e84, 0x222836);
  addMasonryBox(archStoneParts, 8.8, 1.4, 9.2, -29.2, 20.1, 152.0, 0, 0, 0, 0x5c6a80, 0x232938);
  // Eagle Shrine Stone Pedestal at (-30.6, 14.5, 152.0)
  addMasonryBox(archStoneParts, 1.5, 0.36, 1.9, -30.6, 14.68, 152.0, 0, 0, 0, 0x8e9db8, 0x3e475a);
  addMasonryBox(archStoneParts, 1.0, 0.92, 1.4, -30.6, 15.32, 152.0, 0, 0, 0, 0x98a8c4, 0x454f64);

  // 6.4 Semicircular Upper Cliff Bonfire Terrace (x=-18..-6, z=164..178, y=17.65m)
  // Monumental semicircular drum perched over the abyss (exact silhouette of s06_view2!)
  addMasonryCyl(archStoneParts, 7.2, 7.8, 15.2, 16, -12.0, 9.95, 170.5, 0x76849c, 0x252c3c);
  addMasonryCyl(archDeckParts,  7.0, 7.1, 0.32, 16, -12.0, 17.50, 170.5, 0xa0aec8, 0x4e586e);
  // Rectangular tie apron joining terrace cleanly to P11 stair (north), SC-3 stair (west) & 6.3 Lift Walkway (south)
  addMasonryBox(archStoneParts, 12.6, 14.8, 14.2, -12.0, 10.15, 171.0, 0, 0, 0, 0x74829a, 0x252c3c);
  addMasonryBox(archDeckParts,  12.4, 0.28, 14.0, -12.0, 17.52, 171.0, 0, 0, 0, 0x9eaec8, 0x4e586e);
  // Curved carved stone parapet curb wrapping the eastern chasm rim of Bonfire Terrace (s06_view2!)
  for (let i = 0; i < 9; i++) {
    const ang = lerp(-Math.PI * 0.44, Math.PI * 0.38, i / 8);
    const px = -12.0 + Math.cos(ang) * 6.85;
    const pz = 170.5 + Math.sin(ang) * 6.85;
    addMasonryBox(archStoneParts, 0.62, 0.92, 1.55, px, 18.10, pz, 0, -ang, 0, 0x9aa8c4, 0x444e63);
  }

  // 6.3 Upper Lift Stone Walkway (x=-9.0..-3.8, z=116.4..166.0, y=17.65m)
  // Runs straight south from Bonfire 6.4 to the top of the SC-2 Counterweight Lift Shaft!
  // Main walkway north of lift shaft (z=120.2..166.2, x=-9.0..-3.8, y=17.65m)
  addMasonryBox(archStoneParts, 5.4, 1.65, 46.2, -6.4, 16.70, 143.2, 0, 0, 0, 0x7c8aa2, 0x2e3648);
  addMasonryBox(archDeckParts,  5.3, 0.28, 46.2, -6.4, 17.52, 143.2, 0, 0, 0, 0x9eaec8, 0x4e586e);
  // Deep supporting gothic buttress piers descending under the Upper Lift Walkway into the cliff face!
  for (let pz = 124.0; pz <= 162.0; pz += 7.6) {
    addMasonryBox(archStoneParts, 2.6, 15.8, 1.8, -6.4, 8.6, pz, 0, 0, 0, 0x728098, 0x242a3a);
  }
  // Low stone parapet merlons along east canyon drop of Upper Lift Walkway (x=-3.95)
  for (let pz = 123.0; pz <= 163.5; pz += 3.2) {
    addMasonryBox(archStoneParts, 0.46, 0.88, 1.85, -3.95, 18.08, pz, 0, 0, 0, 0x95a4be, 0x424c60);
  }
  // Upper Lift Station Landing wrapping WEST & SOUTH of the open shaft (leaving x=-7.35..-3.85, z=116.45..119.95 OPEN!)
  addMasonryBox(archStoneParts, 2.8, 15.8, 7.4, -8.8, 9.65, 119.2, 0, 0, 0, 0x76849c, 0x262d3d);
  addMasonryBox(archDeckParts,  2.7, 0.28, 7.2, -8.8, 17.52, 119.2, 0, 0, 0, 0x9eaec8, 0x4e586e);
  // South narrow rim deck behind the lift shaft at y=17.65m
  addMasonryBox(archStoneParts, 6.2, 1.4, 1.6, -5.6, 16.82, 115.6, 0, 0, 0, 0x7a88a0, 0x2b3242);
  addMasonryBox(archDeckParts,  6.0, 0.28, 1.5, -5.6, 17.52, 115.6, 0, 0, 0, 0x9eaec8, 0x4e586e);
  // Lower Lift Station Landing at y=2.65m (joining Sector 04 Watchtower Courtyard seamlessly!)
  addMasonryBox(archStoneParts, 6.6, 3.6, 6.6, -5.6, 0.80, 118.2, 0, 0, 0, 0x76849c, 0x262d3d);
  addMasonryBox(archDeckParts,  6.4, 0.24, 6.4, -5.6, 2.52, 118.2, 0, 0, 0, 0x98a6c0, 0x4b556a);

  // P11 Carved Twin Stair ascending NW from Bonfire Terrace 6.4 into Sector 07 Cloister (x=-8..+2, z=176..188, y=17.65->21.5m)
  addSteppedStairFlight(archDeckParts, {
    x0: -6.8, y0: 17.65, z0: 176.0,
    x1: -1.4, y1: 21.50, z1: 187.5,
    width: 6.2,
    steps: 16,
    sideWalls: true,
    deepFoundation: 5.0
  });

  // --------------------------------------------------------------------------
  // 4B. SECTOR 07 — Древние сооружения (7.3, 7.1, 7.2, 7.4, 7.5, P10)
  // --------------------------------------------------------------------------
  // 7.3 Southern Cloister Colonnade Flagstone Floor (x=-6..+15, z=185.5..202.0)
  // Strictly matches evalSector07Y(x, z): flat y=21.50 (z<=187), smooth Z-ramp y=21.50->23.00 (z=187..198),
  // ceremonial approach steps y=23.00->23.50 (z=198..202) into Bell-Tower Plaza!
  addMasonryBox(archStoneParts, 21.6, 8.8, 2.4, 4.4, 17.00, 186.4, 0, 0, 0, 0x76849c, 0x262d3d);
  addMasonryBox(archDeckParts,  21.4, 0.28, 2.2, 4.4, 21.36, 186.4, 0, 0, 0, 0x9caac6, 0x4d576c);
  addSteppedStairFlight(archDeckParts, {
    x0: 4.4, y0: 21.50, z0: 187.0,
    x1: 4.4, y1: 23.00, z1: 198.0,
    width: 21.2,
    steps: 14,
    sideWalls: false,
    deepFoundation: 6.0
  });
  // Wide ceremonial steps entering Bell-Tower Plaza from South Cloister (z=198.0..202.0, y=23.0 -> 23.5m)
  addSteppedStairFlight(archDeckParts, {
    x0: 13.0, y0: 23.00, z0: 198.0,
    x1: 13.0, y1: 23.50, z1: 202.0,
    width: 19.0,
    steps: 6,
    sideWalls: false,
    deepFoundation: 5.0
  });

  // 7.1 Bell-Tower Plaza Flagstone Courtyard (x=+4..+28, z=198..224, y=23.5m)
  addMasonryBox(archStoneParts, 24.8, 10.5, 26.8, 16.0, 18.15, 211.0, 0, 0, 0, 0x76849c, 0x262d3d);
  addMasonryBox(archDeckParts,  24.4, 0.30, 26.4, 16.0, 23.36, 211.0, 0, 0, 0, 0x9eaec8, 0x4e586e);
  // Raised Gothic stone plinth framing Shattered Bell-Tower base & 4 corner braziers (s07_view1!)
  addMasonryBox(archDeckParts,  13.2, 0.16, 13.2, 16.0, 23.55, 208.0, 0, 0, 0, 0xa4b4ce, 0x525d74);

  // 7.2 Sunken Stone Amphitheater Flat Floor (circle (36, 214, r=10.5m, y=21.5m)) + West & P10 South Steps!
  addMasonryCyl(archStoneParts, 11.2, 12.0, 8.8, 24, 36.0, 17.00, 214.0, 0x728098, 0x252c3c);
  addMasonryCyl(archDeckParts,  10.9, 11.0, 0.30, 24, 36.0, 21.36, 214.0, 0x95a5bf, 0x495368);
  // West steps linking Bell-Tower Plaza (x=26.5, y=23.5m) down into Sunken Amphitheater (x=28.2..24.8 -> y=21.5m)
  addSteppedStairFlight(archDeckParts, {
    x0: 29.2, y0: 21.50, z0: 214.0,
    x1: 24.6, y1: 23.50, z1: 214.0,
    width: 5.6,
    steps: 8,
    sideWalls: true,
    deepFoundation: 4.5
  });
  // South P10 Forest Ruins Ascent Steps & Causeway connecting Sector 05 (z=178..204, y=20.5 -> 21.5m) to Amphitheater!
  addSteppedStairFlight(archDeckParts, {
    x0: 43.8, y0: 20.50, z0: 179.0,
    x1: 37.8, y1: 21.50, z1: 203.8,
    width: 6.2,
    steps: 14,
    sideWalls: false,
    deepFoundation: 4.2
  });
  // Stone rim threshold steps crossing the south amphitheater tier at z=203..206
  addMasonryBox(archDeckParts, 6.2, 0.42, 4.4, 37.2, 21.42, 204.2, 0, 0.22, 0, 0x98a6c0, 0x4a5468);

  // 7.4 Underground Relic Crypt Descending Staircase & Vaulted Stone Chamber (x=-8..+4, z=200..212, y=23.0->19.8m)
  addSteppedStairFlight(archDeckParts, {
    x0: -2.0, y0: 19.80, z0: 206.0,
    x1:  4.4, y1: 23.45, z1: 206.0,
    width: 4.0,
    steps: 14,
    sideWalls: true,
    deepFoundation: 3.5
  });
  // Vaulted underground crypt floor, thick side stone walls & vaulted ceiling slab!
  addMasonryBox(archStoneParts, 8.0, 2.2, 12.6, -5.2, 18.60, 206.0, 0, 0, 0, 0x6c7a92, 0x222836);
  addMasonryBox(archDeckParts,  7.6, 0.28, 12.2, -5.2, 19.68, 206.0, 0, 0, 0, 0x8e9db6, 0x424c60);
  addMasonryBox(archStoneParts, 1.1, 4.8, 12.8, -8.8, 22.10, 206.0, 0, 0, 0, 0x6a7890, 0x242a3a); // West back wall
  addMasonryBox(archStoneParts, 8.2, 4.8, 1.1, -5.2, 22.10, 200.0, 0, 0, 0, 0x6a7890, 0x242a3a); // South crypt wall
  addMasonryBox(archStoneParts, 8.2, 4.8, 1.1, -5.2, 22.10, 212.0, 0, 0, 0, 0x6a7890, 0x242a3a); // North crypt wall
  addMasonryBox(archStoneParts, 9.0, 1.25, 13.4, -4.8, 24.85, 206.0, 0, 0, 0, 0x728098, 0x282f3f); // Vaulted stone roof slab

  // 7.5 Pre-Viaduct Cliff Rim Terrace (x=+6..+18, z=224..243, y=23.5 -> 25.8m, Bonfire at (12, 25.5, 236))
  // Matches evalSector07Y(x, z) exactly: ramp z=224..235 (y=23.5->25.5), flat z=235..238 (y=25.5), threshold z=238..242.5 (y=25.5->25.8)!
  addSteppedStairFlight(archDeckParts, {
    x0: 12.0, y0: 23.50, z0: 224.0,
    x1: 12.0, y1: 25.50, z1: 235.0,
    width: 10.4,
    steps: 12,
    sideWalls: true,
    deepFoundation: 5.5
  });
  addMasonryBox(archStoneParts, 12.8, 13.6, 6.4, 12.0, 18.60, 238.1, 0, 0, 0, 0x74829a, 0x242b3b);
  addMasonryBox(archDeckParts,  12.4, 0.30, 6.2, 12.0, 25.35, 238.1, 0, 0, 0, 0x9eaec8, 0x4e586e);
  // Subtle rise onto the Viaduct southern threshold (z=238.5..242.5, y=25.5 -> 25.8m)
  addMasonryBox(archDeckParts,  7.4, 0.32, 3.8, 12.0, 25.50, 240.8, -0.072, 0, 0, 0x9eaec8, 0x4e586e);
  // Weathered low cliffside parapet curbs flanking Pre-Viaduct terrace rim (s07_view2!)
  addMasonryBox(archStoneParts, 0.56, 0.85, 7.4,  6.05, 25.92, 237.2, 0, 0, 0, 0x909eb8, 0x404a5e);
  addMasonryBox(archStoneParts, 0.56, 0.85, 7.4, 17.95, 25.92, 237.2, 0, 0, 0, 0x909eb8, 0x404a5e);

  // --------------------------------------------------------------------------
  // 4C. SECTOR 08 — Заброшенный Монастырь (8.1, 8.2, 8.3, 8.4 SC-3, 8.5)
  // --------------------------------------------------------------------------
  // 8.1 Grand Broken Viaduct Walkable Flagstone Deck (x=+9.0..+15.0, z=242..274, y=25.8 -> 28.2m)
  const viaductSegs = 8;
  const viaductZ0 = 242.0;
  const viaductZ1 = 274.0;
  const viaductY0 = 25.80;
  const viaductY1 = 28.20;
  const viaductSegLen = (viaductZ1 - viaductZ0) / viaductSegs;
  const viaductSlopePitch = -Math.atan2(viaductY1 - viaductY0, viaductZ1 - viaductZ0);
  for (let i = 0; i < viaductSegs; i++) {
    const zMid = lerp(viaductZ0, viaductZ1, (i + 0.5) / viaductSegs);
    const yMid = lerp(viaductY0, viaductY1, (i + 0.5) / viaductSegs) + 0.01;
    // Solid continuous walkable bridge flagstone roadway (6.2m wide) + stone underside arch soffit!
    addMasonryBox(
      archDeckParts,
      6.2,
      0.46,
      viaductSegLen + 0.16,
      12.0,
      yMid - 0.22,
      zMid,
      viaductSlopePitch,
      0,
      0,
      0xa0aec8,
      0x4e586e
    );
    addMasonryBox(
      archStoneParts,
      6.6,
      1.15,
      viaductSegLen + 0.12,
      12.0,
      yMid - 0.96,
      zMid,
      viaductSlopePitch,
      0,
      0,
      0x7c8aa4,
      0x2f3749
    );
    // Weathered broken Gothic viaduct stone parapet merlons with dramatic ruined gaps (s08_view1!)
    for (const side of [-1, 1]) {
      const brokenGap = (i === 3 && side === 1) || (i === 5 && side === -1);
      const pH = brokenGap ? 0.34 : (0.86 + ((i + (side > 0 ? 1 : 0)) % 2) * 0.14);
      addMasonryBox(
        archStoneParts,
        0.54,
        pH,
        viaductSegLen * 0.78,
        12.0 + side * 3.05,
        yMid + pH * 0.48,
        zMid,
        viaductSlopePitch,
        0,
        0,
        0x95a4be,
        0x424c60
      );
    }
  }
  // Monumental stone abutment piers anchoring Viaduct ends deep into the chasm
  addMasonryBox(archStoneParts, 7.6, 17.0, 3.2, 12.0, 17.2, 242.6, 0, 0, 0, 0x74829a, 0x222938);
  addMasonryBox(archStoneParts, 7.8, 18.0, 3.6, 12.0, 19.0, 271.4, 0, 0, 0, 0x74829a, 0x222938);

  // Ceremonial Entry Steps from Monastery Twin Gatehouse (z=272.2, y=28.2m) onto Cathedral Courtyard (z=275.4, y=29.0m)
  addSteppedStairFlight(archDeckParts, {
    x0: 12.0, y0: 28.20, z0: 272.2,
    x1: 12.0, y1: 29.00, z1: 275.4,
    width: 9.0,
    steps: 4,
    sideWalls: false,
    deepFoundation: 4.5
  });

  // 8.3 Cathedral Boss Courtyard (x=-4..+28, z=274..308, y=29.0m) perched on massive retaining cliff masonry!
  addMasonryBox(archStoneParts, 33.0, 16.5, 35.0, 12.0, 20.60, 291.0, 0, 0, 0, 0x74829a, 0x222938);
  addMasonryBox(archDeckParts,  32.4, 0.34, 34.4, 12.0, 28.84, 291.0, 0, 0, 0, 0xa0aec8, 0x4e586e);
  // Towering Gothic outer retaining buttresses descending down the Cathedral mountain sheer cliffs!
  for (let bz = 278.0; bz <= 306.0; bz += 7.0) {
    addMasonryBox(archStoneParts, 2.2, 18.5, 2.0, -4.6, 20.2, bz, 0, 0, 0, 0x7e8ca6, 0x262d3d);
    addMasonryBox(archStoneParts, 2.2, 18.5, 2.0, 28.6, 20.2, bz, 0, 0, 0, 0x7e8ca6, 0x262d3d);
  }
  // Low stone edge curbing along north-east & north-west cliff rims of boss arena
  addMasonryBox(archStoneParts, 11.4, 0.92, 0.62,  1.5, 29.45, 308.0, 0, 0, 0, 0x95a4be, 0x424c60);
  addMasonryBox(archStoneParts, 11.4, 0.92, 0.62, 22.5, 29.45, 308.0, 0, 0, 0, 0x95a4be, 0x424c60);

  // 8.5 Northern Region II Pass Causeway (x=+7..+17, z=308..318, y=29.0 -> 31.5m) to Region2_Citadel_Gate!
  addSteppedStairFlight(archDeckParts, {
    x0: 12.0, y0: 29.00, z0: 307.6,
    x1: 12.0, y1: 31.50, z1: 316.2,
    width: 10.0,
    steps: 11,
    sideWalls: true,
    deepFoundation: 10.0
  });
  // Citadel Gate threshold plaza (x=+5..+19, z=315.6..321.5, y=31.5m)
  addMasonryBox(archStoneParts, 15.6, 15.5, 6.4, 12.0, 23.60, 318.6, 0, 0, 0, 0x74829a, 0x222938);
  addMasonryBox(archDeckParts,  15.2, 0.30, 6.0, 12.0, 31.36, 318.6, 0, 0, 0, 0xa2b0ca, 0x505a70);

  // 8.4 Southern Shortcut Bell-Tower & Carved Cliff Stair (`SC-3`: x=-16..-10, z=178..278, y=17.65 -> 28.5m)
  // Connects Cathedral Boss Courtyard West Breach (x=-4, z=276, y=29.0m) straight down to Bonfire Terrace 6.4 (z=177, y=17.65m)!
  // Flight 1: Bonfire Terrace 6.4 -> Mid-Lower Cliff Landing (z=177..206, y=17.65 -> 21.0m)
  addSteppedStairFlight(archDeckParts, {
    x0: -13.0, y0: 17.65, z0: 177.0,
    x1: -13.0, y1: 21.00, z1: 204.0,
    width: 5.8,
    steps: 18,
    sideWalls: true,
    deepFoundation: 7.0
  });
  addMasonryBox(archStoneParts, 6.4, 11.5, 5.4, -13.0, 15.2, 206.5, 0, 0, 0, 0x76849c, 0x252c3c);
  addMasonryBox(archDeckParts,  6.2, 0.28, 5.2, -13.0, 20.88, 206.5, 0, 0, 0, 0x9caac6, 0x4d576c);
  // Flight 2: Mid-Lower -> Mid-Upper Cliff Landing (z=209..236, y=21.0 -> 24.3m)
  addSteppedStairFlight(archDeckParts, {
    x0: -13.0, y0: 21.00, z0: 209.0,
    x1: -13.0, y1: 24.30, z1: 235.0,
    width: 5.8,
    steps: 18,
    sideWalls: true,
    deepFoundation: 8.5
  });
  addMasonryBox(archStoneParts, 6.4, 13.5, 5.4, -13.0, 17.5, 237.5, 0, 0, 0, 0x76849c, 0x252c3c);
  addMasonryBox(archDeckParts,  6.2, 0.28, 5.2, -13.0, 24.18, 237.5, 0, 0, 0, 0x9caac6, 0x4d576c);
  // Flight 3: Mid-Upper -> Shortcut Bell-Turret Gate Landing (z=240..264, y=24.3 -> 27.5m)
  addSteppedStairFlight(archDeckParts, {
    x0: -13.0, y0: 24.30, z0: 240.0,
    x1: -13.0, y1: 27.50, z1: 264.0,
    width: 5.8,
    steps: 16,
    sideWalls: true,
    deepFoundation: 10.5
  });
  // Shortcut Gate & Lever Landing Deck (x=-16.2..-9.8, z=263.6..271.5, y=27.5 -> 27.8m)
  addMasonryBox(archStoneParts, 6.8, 14.5, 8.2, -13.0, 20.3, 267.6, 0, 0, 0, 0x76849c, 0x252c3c);
  addMasonryBox(archDeckParts,  6.4, 0.28, 8.0, -13.0, 27.44, 267.6, 0, 0, 0, 0x9eaec8, 0x4e586e);
  // Flanking stone gate jambs sealing sides of SC-3 gate at z=266.0 so forged-iron gate spans cleanly across!
  addMasonryBox(archStoneParts, 1.45, 4.4, 1.15, -15.45, 29.6, 266.0, 0, 0, 0, 0x8a98b2, 0x384154);
  addMasonryBox(archStoneParts, 1.45, 4.4, 1.15, -10.55, 29.6, 266.0, 0, 0, 0, 0x8a98b2, 0x384154);
  addMasonryBox(archStoneParts, 6.4, 0.95, 1.25, -13.0, 31.8, 266.0, 0, 0, 0, 0x909eb8, 0x3c4558);
  // Final Steps from Shortcut Lever Landing (y=27.8m, z=270.8) up to Cathedral West Breach Terrace (y=28.8..29.0m, z=278)
  addSteppedStairFlight(archDeckParts, {
    x0: -13.0, y0: 27.60, z0: 270.8,
    x1: -13.0, y1: 28.60, z1: 276.6,
    width: 6.0,
    steps: 6,
    sideWalls: true,
    deepFoundation: 10.5
  });
  // West Connecting Bridge linking Shortcut Upper Landing (x=-13, z=276.5, y=28.6m) into Cathedral Courtyard (x=-4, y=29.0m)
  addMasonryBox(archStoneParts, 12.8, 15.0, 6.8, -9.8, 21.1, 276.8, 0, 0, 0, 0x76849c, 0x252c3c);
  addMasonryBox(archDeckParts,  12.6, 0.30, 6.6, -9.8, 28.66, 276.8, 0, 0, 0, 0x9eaec8, 0x4e586e);
  addSteppedStairFlight(archDeckParts, {
    x0: -7.5, y0: 28.65, z0: 276.8,
    x1: -3.6, y1: 29.00, z1: 276.8,
    width: 6.2,
    steps: 3,
    sideWalls: false,
    deepFoundation: 4.5
  });

  // Merge structural masonry, walkable flagstone decks & cliff timber scaffolding into 3 shadow-casting draw calls!
  const archStoneMesh = new THREE.Mesh(
    ownGeo(mergeNonIndexedGeos(THREE, archStoneParts, { boxUvTile: 2.8, withColor: true })),
    ruinStoneMat
  );
  archStoneMesh.name = 'RiverReachNorthMasonry';
  archStoneMesh.castShadow = true;
  archStoneMesh.receiveShadow = true;
  group.add(archStoneMesh);

  const archDeckMesh = new THREE.Mesh(
    ownGeo(mergeNonIndexedGeos(THREE, archDeckParts, { boxUvTile: 2.4, withColor: true })),
    ruinStoneDeckMat
  );
  archDeckMesh.name = 'RiverReachNorthDecks';
  archDeckMesh.castShadow = true;
  archDeckMesh.receiveShadow = true;
  group.add(archDeckMesh);

  const archTimberMesh = new THREE.Mesh(
    ownGeo(mergeNonIndexedGeos(THREE, archTimberParts, { boxUvTile: 2.2, withColor: true })),
    timberWoodMat
  );
  archTimberMesh.name = 'RiverReachNorthScaffolding';
  archTimberMesh.castShadow = true;
  archTimberMesh.receiveShadow = true;
  group.add(archTimberMesh);

  // ==========================================================================
  // 5. WORKING ANIMATED VERTICAL COUNTERWEIGHT CAGE LIFT (`SC-2`)
  //    Center (-5.6, liftY, 118.2), travels smoothly y = 2.65m <-> 17.65m!
  // ==========================================================================
  let liftUnlocked = false;
  let liftRiding = false;
  let liftTargetY = LIFT_Y_MAX;
  let liftCurrentY = LIFT_Y_MAX;
  let liftLeverAnim = 0.0;

  const liftSystemGroup = new THREE.Group();
  liftSystemGroup.name = 'CounterweightCageLift_SC2';
  group.add(liftSystemGroup);

  // Moving Cage Group (floor deck exact at local y = 0.0)
  const liftCageGroup = new THREE.Group();
  liftCageGroup.name = 'LiftCageMovingPlatform';
  liftCageGroup.position.set(LIFT_X, liftCurrentY, LIFT_Z);
  liftSystemGroup.add(liftCageGroup);

  // Solid subtle iron-timber floor plate inside cage so hero boots NEVER float even before GLB resolves!
  const liftCageBaseDeckGeo = ownGeo(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(3.16, 0.14, 3.16), 0, -0.07, 0), 0x766654, 0x3b3026));
  const liftCageBaseDeck = new THREE.Mesh(liftCageBaseDeckGeo, timberWoodMat);
  liftCageBaseDeck.castShadow = true;
  liftCageBaseDeck.receiveShadow = true;
  liftCageGroup.add(liftCageBaseDeck);

  // Warm cage hanging beacon lantern inside top of cage (local y = +3.18m)
  const cageLanternGlass = new THREE.Mesh(ownGeo(new THREE.CylinderGeometry(0.16, 0.14, 0.34, 8)), lanternGlassMat);
  cageLanternGlass.position.set(0, 3.18, 0);
  liftCageGroup.add(cageLanternGlass);
  const cageLanternHalo = new THREE.Sprite(warmHaloMat);
  cageLanternHalo.position.set(0, 3.18, 0);
  cageLanternHalo.scale.set(2.1, 2.1, 1);
  liftCageGroup.add(cageLanternHalo);

  // Overhead Pulley Wheel Group (Lift_Pulley_Wheel lies in XY plane -> axle along Z, rotates cleanly on rotation.z!)
  const liftPulleyWheelGroup = new THREE.Group();
  liftPulleyWheelGroup.name = 'LiftPulleyWheelMain';
  liftPulleyWheelGroup.position.set(LIFT_X, LIFT_PULLEY_Y, LIFT_Z);
  liftSystemGroup.add(liftPulleyWheelGroup);

  // Secondary counterweight pulley wheel cleanly outside the west stone shaft pier (x = LIFT_CW_X)
  const liftCwPulleyGroup = new THREE.Group();
  liftCwPulleyGroup.name = 'LiftPulleyWheelCounterweight';
  liftCwPulleyGroup.position.set(LIFT_CW_X, LIFT_PULLEY_Y, LIFT_Z);
  liftSystemGroup.add(liftCwPulleyGroup);

  // Overhead Forged-Iron Gantry Cross-Beam + Twin Z-Axle Pins supporting both pulley wheels at y = 21.85m
  const gantryParts = [
    xformGeo(new THREE.BoxGeometry(6.8, 0.34, 0.34), LIFT_X - 1.25, LIFT_PULLEY_Y + 0.02, LIFT_Z - 0.56),
    xformGeo(new THREE.BoxGeometry(6.8, 0.34, 0.34), LIFT_X - 1.25, LIFT_PULLEY_Y + 0.02, LIFT_Z + 0.56),
    xformGeo(new THREE.CylinderGeometry(0.14, 0.14, 1.35, 8), LIFT_X, LIFT_PULLEY_Y, LIFT_Z, Math.PI * 0.5, 0, 0),
    xformGeo(new THREE.CylinderGeometry(0.12, 0.12, 1.35, 8), LIFT_CW_X, LIFT_PULLEY_Y, LIFT_Z, Math.PI * 0.5, 0, 0)
  ];
  const gantryAxleMesh = new THREE.Mesh(
    ownGeo(mergeNonIndexedGeos(THREE, gantryParts, { boxUvTile: 1.0, withColor: false })),
    forgedIronPlainMat
  );
  gantryAxleMesh.castShadow = true;
  liftSystemGroup.add(gantryAxleMesh);

  // Dynamic Glowing Forged-Iron Lift Chains (unit height 1.0 scaled dynamically in update(), ZERO GC!)
  const unitChainGeo = ownGeo(new THREE.CylinderGeometry(0.055, 0.055, 1.0, 6));
  const liftChainLeft = new THREE.Mesh(unitChainGeo, liftChainMat);
  liftChainLeft.position.set(LIFT_X - 0.24, 15.0, LIFT_Z);
  liftChainLeft.frustumCulled = false;
  liftSystemGroup.add(liftChainLeft);

  const liftChainRight = new THREE.Mesh(unitChainGeo, liftChainMat);
  liftChainRight.position.set(LIFT_X + 0.24, 15.0, LIFT_Z);
  liftChainRight.frustumCulled = false;
  liftSystemGroup.add(liftChainRight);

  // Horizontal overhead counterweight chain running across the top rims of both XY-plane pulleys
  const liftTopSpanChain = new THREE.Mesh(unitChainGeo, liftChainMat);
  liftTopSpanChain.rotation.z = Math.PI * 0.5;
  liftTopSpanChain.position.set((LIFT_X + LIFT_CW_X) * 0.5, LIFT_PULLEY_Y + LIFT_PULLEY_RADIUS * 0.94, LIFT_Z);
  liftTopSpanChain.scale.y = Math.abs(LIFT_X - LIFT_CW_X);
  liftTopSpanChain.frustumCulled = false;
  liftSystemGroup.add(liftTopSpanChain);

  // Counterweight chain + heavy iron counterweight block moving opposite to cage outside west pier!
  const liftCwChain = new THREE.Mesh(unitChainGeo, liftChainMat);
  liftCwChain.position.set(LIFT_CW_X, 15.0, LIFT_Z);
  liftCwChain.frustumCulled = false;
  liftSystemGroup.add(liftCwChain);

  const liftCounterweightMesh = new THREE.Mesh(
    ownGeo(new THREE.BoxGeometry(0.86, 1.65, 0.86)),
    forgedIronPlainMat
  );
  liftCounterweightMesh.position.set(LIFT_CW_X, LIFT_Y_MIN + 2.0, LIFT_Z);
  liftCounterweightMesh.castShadow = true;
  liftSystemGroup.add(liftCounterweightMesh);

  // Fallback cage bars / pulley wheel references (hidden automatically once GLB nodes load!)
  const liftFallbackCageGroup = new THREE.Group();
  const fbBarGeo = ownGeo(new THREE.CylinderGeometry(0.055, 0.06, 3.60, 6));
  for (const cx of [-1.46, 1.46]) {
    for (const cz of [-1.46, 1.46]) {
      const post = new THREE.Mesh(fbBarGeo, forgedIronPlainMat);
      post.position.set(cx, 1.80, cz);
      post.castShadow = true;
      liftFallbackCageGroup.add(post);
    }
  }
  const fbTopRing = new THREE.Mesh(ownGeo(new THREE.TorusGeometry(0.32, 0.06, 6, 12)), forgedIronPlainMat);
  fbTopRing.position.set(0, 3.60, 0);
  liftFallbackCageGroup.add(fbTopRing);
  liftCageGroup.add(liftFallbackCageGroup);

  const liftFallbackPulley = new THREE.Mesh(ownGeo(new THREE.TorusGeometry(LIFT_PULLEY_RADIUS, 0.14, 8, 18)), forgedIronPlainMat);
  liftPulleyWheelGroup.add(liftFallbackPulley);

  const liftFallbackTowerGroup = new THREE.Group();
  const fbTowerPierGeo = ownGeo(tintGeo(THREE, new THREE.BoxGeometry(0.95, 19.6, 0.95), 0x8a98b2, 0x353e50));
  for (const px of [-2.45, 2.45]) {
    for (const pz of [-2.45, 2.45]) {
      const pier = new THREE.Mesh(fbTowerPierGeo, ruinStoneMat);
      pier.position.set(LIFT_X + px, LIFT_Y_MIN + 9.8, LIFT_Z + pz);
      pier.castShadow = true;
      pier.receiveShadow = true;
      liftFallbackTowerGroup.add(pier);
    }
  }
  liftSystemGroup.add(liftFallbackTowerGroup);

  let liftLeverArmObj = null;

  function applyLiftVisuals() {
    const cy = clamp(liftCurrentY, LIFT_Y_MIN, LIFT_Y_MAX);
    liftCageGroup.position.y = cy;

    // Rotate XY-plane main & counterweight pulley wheels around their Z axle in lockstep with vertical travel!
    const travel = cy - LIFT_Y_MIN;
    const wheelAngle = travel / LIFT_PULLEY_RADIUS;
    liftPulleyWheelGroup.rotation.z = -wheelAngle;
    liftCwPulleyGroup.rotation.z = -wheelAngle * 1.19;

    // Stretch taut vertical iron chains cleanly from cage suspension ring to pulley axle
    const chainBottom = cy + LIFT_CAGE_TOP_OFFSET;
    const chainLen = Math.max(0.25, LIFT_PULLEY_Y - chainBottom);
    const chainMidY = chainBottom + chainLen * 0.5;
    liftChainLeft.position.y = chainMidY;
    liftChainLeft.scale.y = chainLen;
    liftChainRight.position.y = chainMidY;
    liftChainRight.scale.y = chainLen;

    // Opposite-phase counterweight iron block & chain
    const cwY = LIFT_Y_MIN + LIFT_Y_MAX - cy + 1.4;
    liftCounterweightMesh.position.y = cwY;
    const cwChainBot = cwY + 0.80;
    const cwChainLen = Math.max(0.25, LIFT_PULLEY_Y - cwChainBot);
    liftCwChain.position.y = cwChainBot + cwChainLen * 0.5;
    liftCwChain.scale.y = cwChainLen;

    if (liftLeverArmObj) {
      const ease = 1.0 - Math.pow(1.0 - clamp01(liftLeverAnim), 3.0);
      liftLeverArmObj.rotation.x = ease * 1.24;
    }
  }
  applyLiftVisuals();

  // ==========================================================================
  // 6. MONASTERY SHORTCUT GATE & LEVER STATE (`SC-3`)
  // ==========================================================================
  let monasteryShortcutUnlocked = false;
  let monasteryDoorAnim = 0.0;
  let monasteryGateDoorObj = null;
  let monasteryLeverArmObj = null;

  // Fallback forged-iron swinging shortcut gate (replaced cleanly if Iron_Shortcut_Gate_Door loads from gorge_ruins.glb!)
  const sc3FallbackGatePivot = new THREE.Group();
  sc3FallbackGatePivot.position.set(SC3_GATE_X - 1.72, SC3_GATE_Y, SC3_GATE_Z);
  const sc3FbParts = [];
  for (let i = 0; i < 7; i++) {
    sc3FbParts.push(xformGeo(new THREE.CylinderGeometry(0.055, 0.06, 3.8, 6), 0.24 + i * 0.50, 1.9, 0));
  }
  for (let y = 0.45; y <= 3.55; y += 1.0) {
    sc3FbParts.push(xformGeo(new THREE.BoxGeometry(3.48, 0.14, 0.14), 1.74, y, 0));
  }
  const sc3FallbackGateMesh = new THREE.Mesh(
    ownGeo(mergeNonIndexedGeos(THREE, sc3FbParts, { boxUvTile: 1.0, withColor: false })),
    forgedIronPlainMat
  );
  sc3FallbackGateMesh.castShadow = true;
  sc3FallbackGatePivot.add(sc3FallbackGateMesh);
  group.add(sc3FallbackGatePivot);
  monasteryGateDoorObj = sc3FallbackGatePivot;

  function applyMonasteryShortcutVisuals() {
    const t = clamp01(monasteryDoorAnim);
    const ease = 1.0 - Math.pow(1.0 - t, 3.0);
    if (monasteryGateDoorObj) {
      // Swing wrought-iron Monastery Shortcut Gate cleanly inward (+Z) by 108 degrees on hinge!
      monasteryGateDoorObj.rotation.y = -ease * 1.88;
    }
    if (monasteryLeverArmObj) {
      // Throw medieval iron lever forward by 72 degrees!
      monasteryLeverArmObj.rotation.x = ease * 1.26;
    }
  }

  // ==========================================================================
  // 7. ROARING SMOKY BONFIRES, MONUMENTAL BRAZIERS & WARM DECK POOLS (ZERO PointLights!)
  // ==========================================================================
  const warmSprites = [];
  const warmPoolSpecs = [];

  function addLanternGlowSprite(x, y, z, scale = 1.85) {
    const sp = new THREE.Sprite(warmHaloMat);
    sp.position.set(x, y, z);
    sp.scale.set(scale, scale, 1);
    group.add(sp);
    warmSprites.push({ sprite: sp, baseScale: scale, phase: rng() * 6.283 });
  }

  function registerWarmFloorPool(x, y, z, radius = 5.4, strength = 0.42, phase = 0.0) {
    warmPoolSpecs.push({ x, y, z, radius, strength, phase });
  }

  function addFireFx(x, y, z, scale = 1.0, floorY = null, poolRadius = 5.8, poolStr = 0.44) {
    const phase = x * 0.63 + z * 0.41;
    if (campfireRig && typeof campfireRig.addCampfire === 'function') {
      // CRITICAL: addPointLight: false -> ZERO extra PointLights, ZERO shader recompile hitch!
      const cf = campfireRig.addCampfire(x, y, z, {
        scale,
        litUniform: alwaysOneUniform,
        phase,
        addPointLight: false
      });
      if (cf && cf.root) addedCampfireRoots.push(cf.root);
    }
    addLanternGlowSprite(x, y + 0.85 * scale, z, 2.25 * scale);
    const gy = Number.isFinite(floorY) ? floorY : y;
    registerWarmFloorPool(x, gy + 0.04, z, poolRadius * scale, poolStr, phase);
  }

  // Hero Bonfire 6.4 (Cliff Bonfire Terrace) & Hero Bonfire 7.5 (Pre-Viaduct Cliff Rim)
  addFireFx(-12.0, 17.65, 170.0, 1.24, 17.65, 6.2, 0.48);
  addFireFx( 12.0, 25.50, 236.0, 1.24, 25.50, 6.4, 0.48);

  // Monumental Grand_Brazier_Bowl Placement List (synced 1:1 with GLB instancing & roaring brazier fire!)
  // Grand_Brazier_Bowl is 2.1m tall -> cauldron fire bed sits cleanly at baseY + 1.66m!
  const grandBrazierSpecs = [
    // Sector 06: 6.2 Windy Bastion Overlook Brazier (matching s06_view1!)
    { x: -19.5, y: 14.50, z: 154.5, ry: 0.4, s: 0.96, fireScale: 0.82 },
    // Sector 07: 7.1 Four Bell-Tower Plaza Corner Braziers (matching s07_view1!)
    { x: 10.2, y: 23.62, z: 202.2, ry: 0.0, s: 1.06, fireScale: 0.92 },
    { x: 21.8, y: 23.62, z: 202.2, ry: 1.5, s: 1.06, fireScale: 0.92 },
    { x: 10.2, y: 23.62, z: 213.8, ry: 3.1, s: 1.06, fireScale: 0.92 },
    { x: 21.8, y: 23.62, z: 213.8, ry: 4.7, s: 1.06, fireScale: 0.92 },
    // Sector 07: 7.3 Southern Cloister Colonnade Braziers (matching s07_view1 right side!)
    { x: -1.8, y: 21.50, z: 192.5, ry: 0.7, s: 0.92, fireScale: 0.78 },
    { x:  6.0, y: 22.80, z: 192.0, ry: 2.1, s: 0.92, fireScale: 0.78 },
    // Sector 08: 8.2 Monastery Twin Gatehouse Portal Braziers (matching s08_view1!)
    { x:  7.8, y: 28.15, z: 270.4, ry: 0.2, s: 1.14, fireScale: 1.02 },
    { x: 16.2, y: 28.15, z: 270.4, ry: 2.9, s: 1.14, fireScale: 1.02 },
    // Sector 08: 8.3 Cathedral Boss Courtyard — 5 Blazing Altar & Nave Braziers (matching s08_view2!)
    { x:  5.2, y: 29.00, z: 282.5, ry: 0.5, s: 1.08, fireScale: 0.95 },
    { x: 18.8, y: 29.00, z: 282.5, ry: 2.1, s: 1.08, fireScale: 0.95 },
    { x:  5.2, y: 29.00, z: 292.0, ry: 1.2, s: 1.08, fireScale: 0.95 },
    { x: 18.8, y: 29.00, z: 292.0, ry: 4.1, s: 1.08, fireScale: 0.95 },
    { x: 12.0, y: 29.55, z: 296.8, ry: 0.0, s: 1.18, fireScale: 1.12 },
    // Sector 08: 8.4 Shortcut Bell-Turret Rooftop Beacon Brazier (matching s08_view2 lower-right!)
    { x: -13.0, y: 36.85, z: 266.0, ry: 0.8, s: 1.05, fireScale: 0.95 }
  ];

  for (let i = 0; i < grandBrazierSpecs.length; i++) {
    const b = grandBrazierSpecs[i];
    addFireFx(b.x, b.y + 1.78 * b.s, b.z, b.fireScale, b.y, 5.2, 0.40);
  }

  // Subtle warm glow pools over Cathedral Altar Reliquary (8.3), Crypt Shrine (7.4) & Eagle Cave (6.5)
  registerWarmFloorPool(12.0, 29.04, 294.0, 7.2, 0.36, 1.1);
  registerWarmFloorPool(-5.6, 19.84, 206.0, 4.6, 0.34, 2.3);
  registerWarmFloorPool(-29.8, 14.54, 152.0, 4.2, 0.32, 4.1);

  // Merge all warm additive deck radiance pools into a SINGLE InstancedMesh draw call!
  const basePoolGeo = ownGeo(new THREE.PlaneGeometry(2.0, 2.0, 1, 1));
  basePoolGeo.rotateX(-Math.PI * 0.5);
  const poolCount = warmPoolSpecs.length;
  const poolPhases = new Float32Array(poolCount);
  const poolStrs = new Float32Array(poolCount);
  for (let i = 0; i < poolCount; i++) {
    poolPhases[i] = warmPoolSpecs[i].phase;
    poolStrs[i] = warmPoolSpecs[i].strength;
  }
  basePoolGeo.setAttribute('aPoolPhase', new THREE.InstancedBufferAttribute(poolPhases, 1));
  basePoolGeo.setAttribute('aPoolStr', new THREE.InstancedBufferAttribute(poolStrs, 1));
  const warmPoolsInst = new THREE.InstancedMesh(basePoolGeo, warmDeckPoolMat, poolCount);
  warmPoolsInst.name = 'NorthWarmFireDeckPools';
  warmPoolsInst.renderOrder = 2;
  warmPoolsInst.frustumCulled = false;
  for (let i = 0; i < poolCount; i++) {
    const p = warmPoolSpecs[i];
    _obj.position.set(p.x, p.y, p.z);
    _obj.rotation.set(0, 0, 0);
    _obj.scale.set(p.radius, 1.0, p.radius);
    _obj.updateMatrix();
    warmPoolsInst.setMatrixAt(i, _obj.matrix);
  }
  warmPoolsInst.instanceMatrix.needsUpdate = true;
  group.add(warmPoolsInst);

  // Warm amber gothic lancet window glow plates set softly inside Monastery Gatehouse towers & Shortcut Bell-Turret
  // (Recreates iconic warm distant amber window eyes in s06_view2, s07_view2, s08_view2!)
  const glowWindowSpecs = [
    { x:  6.4, y: 39.2, z: 268.9, w: 1.5, h: 3.4, ry: 0.0 },
    { x: 17.6, y: 39.2, z: 268.9, w: 1.5, h: 3.4, ry: 0.0 },
    { x:  6.4, y: 39.2, z: 275.1, w: 1.5, h: 3.4, ry: 0.0 },
    { x: 17.6, y: 39.2, z: 275.1, w: 1.5, h: 3.4, ry: 0.0 },
    { x: -10.0, y: 31.4, z: 266.0, w: 1.1, h: 2.1, ry: Math.PI * 0.5 },
    { x: -13.0, y: 31.4, z: 263.0, w: 1.1, h: 2.1, ry: 0.0 }
  ];
  const windowParts = [];
  for (let i = 0; i < glowWindowSpecs.length; i++) {
    const w = glowWindowSpecs[i];
    windowParts.push(xformGeo(new THREE.BoxGeometry(w.w, w.h, 0.24), w.x, w.y, w.z, 0, w.ry, 0));
    addLanternGlowSprite(w.x, w.y, w.z, 2.4);
  }
  const monasteryWindowsMesh = new THREE.Mesh(
    ownGeo(mergeNonIndexedGeos(THREE, windowParts, { boxUvTile: 0, withColor: false })),
    monasteryWindowMat
  );
  monasteryWindowsMesh.name = 'MonasteryWarmLancetGlows';
  monasteryWindowsMesh.frustumCulled = false;
  group.add(monasteryWindowsMesh);

  // ==========================================================================
  // 8. LUSH ALPINE BOTANICAL UNDERGROWTH (Woodland Ferns & Cascading Ivy Curtains!)
  // ==========================================================================
  const fernGeo = ownGeo(buildFernRosetteGeo(THREE, mergeNonIndexedGeos));
  const ivyCardGeo = ownGeo(buildCurvedCardGeo(THREE, 2.4, 3.6, 4, 0.16, 0.04, 0.0));
  ivyCardGeo.translate(0, -3.6, 0);

  const fernSpots = [
    // Sector 07 Pre-Viaduct Cliff Rim foreground ferns (iconic s07_view2 bottom framing!)
    { x:  7.8, y: 25.50, z: 233.4, s: 1.28 }, { x:  9.2, y: 25.50, z: 232.2, s: 1.15 },
    { x: 14.8, y: 25.50, z: 233.0, s: 1.24 }, { x: 16.5, y: 25.50, z: 235.6, s: 1.18 },
    { x:  7.2, y: 25.50, z: 239.2, s: 1.22 }, { x: 16.8, y: 25.50, z: 239.4, s: 1.26 },
    // Sector 07 Cloister Colonnades & Bell-Tower Plaza edges (s07_view1!)
    { x: -4.8, y: 21.50, z: 188.5, s: 1.20 }, { x: -4.6, y: 21.50, z: 194.2, s: 1.25 },
    { x: -4.2, y: 21.50, z: 199.6, s: 1.14 }, { x:  8.5, y: 22.90, z: 187.8, s: 1.18 },
    { x: 13.4, y: 23.00, z: 196.2, s: 1.22 }, { x:  5.2, y: 23.50, z: 218.6, s: 1.26 },
    { x:  6.4, y: 23.50, z: 221.8, s: 1.18 }, { x: 25.6, y: 23.50, z: 202.4, s: 1.24 },
    { x: 26.2, y: 23.50, z: 221.0, s: 1.20 },
    // Sector 07 Sunken Amphitheater mossy rim & P10 forest trail
    { x: 30.0, y: 21.55, z: 206.5, s: 1.18 }, { x: 42.5, y: 21.55, z: 206.8, s: 1.22 },
    { x: 45.2, y: 21.55, z: 218.2, s: 1.16 }, { x: 32.2, y: 21.55, z: 222.8, s: 1.24 },
    { x: 40.5, y: 21.00, z: 193.5, s: 1.26 }, { x: 46.2, y: 20.80, z: 185.4, s: 1.30 },
    // Sector 06 Windy Bastion, Cliff Bonfire rim & P08 Basalt Pass verge
    { x:  3.4, y: 4.80,  z: 127.0, s: 1.20 }, { x: -4.2, y: 6.40,  z: 131.5, s: 1.15 },
    { x: -24.8, y: 13.00, z: 151.2, s: 1.18 }, { x: -24.4, y: 16.00, z: 160.5, s: 1.22 },
    { x: -17.2, y: 17.65, z: 173.4, s: 1.16 }, { x: -7.4,  y: 17.65, z: 174.2, s: 1.14 },
    // Sector 08 Cathedral ruined nave side walls (s08_view2!)
    { x: -0.4, y: 29.00, z: 281.0, s: 1.18 }, { x: -0.6, y: 29.00, z: 289.5, s: 1.24 },
    { x: -0.2, y: 29.00, z: 299.2, s: 1.15 }, { x: 24.4, y: 29.00, z: 281.5, s: 1.20 },
    { x: 24.6, y: 29.00, z: 291.0, s: 1.26 }, { x: 24.2, y: 29.00, z: 300.5, s: 1.18 },
    { x:  6.6, y: 29.00, z: 306.8, s: 1.14 }, { x: 17.4, y: 29.00, z: 306.8, s: 1.16 }
  ];
  // Extra organic alpine ferns tucked on natural terrain ledges across Sectors 06 & 07
  const extraFernTarget = isMobile ? 48 : 96;
  for (let i = 0; i < extraFernTarget; i++) {
    const fx = lerp(-28.0, 52.0, rng());
    const fz = lerp(124.0, 240.0, rng());
    // Keep clear of main stairways, bonfires & amphitheater center
    if (Math.hypot(fx - (-12.0), fz - 170.0) < 4.2) continue;
    if (Math.hypot(fx - 12.0, fz - 236.0) < 4.0) continue;
    if (Math.hypot(fx - 16.0, fz - 208.0) < 9.5) continue;
    if (Math.hypot(fx - 36.0, fz - 214.0) < 9.2) continue;
    const fy = evalY(fx, fz);
    if (fy < 6.0 || fy > 28.0) continue;
    fernSpots.push({ x: fx, y: fy, z: fz, s: 0.72 + rng() * 0.68 });
  }
  const fernInst = new THREE.InstancedMesh(fernGeo, fernMat, fernSpots.length);
  fernInst.name = 'NorthAlpineFerns';
  for (let i = 0; i < fernSpots.length; i++) {
    const s = fernSpots[i];
    _obj.position.set(s.x, s.y - 0.04, s.z);
    _obj.rotation.set((rng() - 0.5) * 0.14, rng() * Math.PI * 2, (rng() - 0.5) * 0.14);
    _obj.scale.set(s.s, s.s * (0.85 + rng() * 0.32), s.s);
    _obj.updateMatrix();
    fernInst.setMatrixAt(i, _obj.matrix);
  }
  fernInst.instanceMatrix.needsUpdate = true;
  fernInst.receiveShadow = true;
  group.add(fernInst);

  // Cascading Hanging Ivy Curtains draping over Cloister Colonnades (s07_view1!), Crypt Arch, Viaduct & Cathedral!
  const ivyCurtainSpecs = [
    // Sector 07 Southern Cloister Colonnade arches (West N-S bays at x=-4.2 + South E-W bays at z=188.6)
    { x: -2.0, y: 27.3, z: 189.6, ry: Math.PI * 0.5, sx: 1.20, sy: 1.15 },
    { x: -2.0, y: 27.3, z: 193.2, ry: Math.PI * 0.5, sx: 1.15, sy: 1.25 },
    { x: -2.0, y: 27.3, z: 197.0, ry: Math.PI * 0.5, sx: 1.25, sy: 1.10 },
    { x:  4.2, y: 28.6, z: 190.8, ry: 0.0, sx: 1.18, sy: 1.12 },
    { x: 10.6, y: 28.8, z: 190.8, ry: 0.0, sx: 1.15, sy: 1.05 },
    // Sector 07 Crypt Portal Arch & Bell-Tower base arch
    { x:  3.0, y: 27.4, z: 204.2, ry: Math.PI * 0.5, sx: 1.05, sy: 1.00 },
    { x:  3.0, y: 27.4, z: 207.8, ry: Math.PI * 0.5, sx: 1.05, sy: 0.95 },
    { x: 16.0, y: 31.2, z: 203.8, ry: 0.0, sx: 1.30, sy: 1.20 },
    // Sector 08 Grand Broken Viaduct parapets & Cathedral Side Arcades (x=-2.4 & x=+26.4!)
    { x:  8.8, y: 26.6, z: 251.5, ry: -Math.PI * 0.5, sx: 1.10, sy: 1.20 },
    { x: 15.2, y: 27.3, z: 260.5, ry:  Math.PI * 0.5, sx: 1.15, sy: 1.25 },
    { x: -1.1, y: 36.2, z: 285.0, ry:  Math.PI * 0.5, sx: 1.25, sy: 1.30 },
    { x: -1.1, y: 36.2, z: 295.5, ry:  Math.PI * 0.5, sx: 1.20, sy: 1.25 },
    { x: 25.1, y: 36.2, z: 284.5, ry: -Math.PI * 0.5, sx: 1.25, sy: 1.25 },
    { x: 25.1, y: 36.2, z: 296.0, ry: -Math.PI * 0.5, sx: 1.20, sy: 1.20 }
  ];
  const ivyInst = new THREE.InstancedMesh(ivyCardGeo, ivyCurtainMat, ivyCurtainSpecs.length);
  ivyInst.name = 'NorthCascadingIvy';
  for (let i = 0; i < ivyCurtainSpecs.length; i++) {
    const ic = ivyCurtainSpecs[i];
    _obj.position.set(ic.x, ic.y, ic.z);
    _obj.rotation.set(0, ic.ry, 0);
    _obj.scale.set(ic.sx, ic.sy, 1.0);
    _obj.updateMatrix();
    ivyInst.setMatrixAt(i, _obj.matrix);
  }
  ivyInst.instanceMatrix.needsUpdate = true;
  group.add(ivyInst);

  // ==========================================================================
  // 9. ASYNC BLENDER GLB KIT LOADING & SMART MULTI-PRIMITIVE ASSET PLACEMENT
  // ==========================================================================
  // Supports BOTH single-Mesh nodes AND multi-material Group nodes exported by Blender!
  function extractNamedAssets(gltfScene) {
    const assetMap = new Map();
    if (!gltfScene) return assetMap;
    gltfScene.updateMatrixWorld(true);

    // First register every direct mesh by exact & suffix-stripped name
    gltfScene.traverse((obj) => {
      if (obj.isMesh && obj.geometry && obj.name) {
        const clean = obj.name.replace(/\.\d+$/, '');
        const entry = {
          parts: [{
            geometry: obj.geometry,
            localMatrix: new THREE.Matrix4(),
            meshName: obj.name,
            matName: obj.material?.name || ''
          }]
        };
        assetMap.set(obj.name, entry);
        if (!assetMap.has(clean)) assetMap.set(clean, entry);
      }
    });

    // Also register parent Group nodes that contain split multi-material child meshes
    gltfScene.traverse((obj) => {
      if (!obj.isMesh && obj.name && obj.children && obj.children.length > 0) {
        const clean = obj.name.replace(/\.\d+$/, '');
        const childParts = [];
        const invParent = new THREE.Matrix4().copy(obj.matrixWorld).invert();
        obj.traverse((ch) => {
          if (ch.isMesh && ch.geometry) {
            const relMat = new THREE.Matrix4().multiplyMatrices(invParent, ch.matrixWorld);
            childParts.push({
              geometry: ch.geometry,
              localMatrix: relMat,
              meshName: ch.name || '',
              matName: ch.material?.name || ''
            });
          }
        });
        if (childParts.length > 0) {
          const groupEntry = { parts: childParts };
          if (!assetMap.has(obj.name)) assetMap.set(obj.name, groupEntry);
          if (!assetMap.has(clean)) assetMap.set(clean, groupEntry);
        }
      }
    });

    // Register all GLB geometries for clean dispose()
    const seenGeos = new Set();
    gltfScene.traverse((obj) => {
      if (obj.isMesh && obj.geometry && !seenGeos.has(obj.geometry)) {
        seenGeos.add(obj.geometry);
        ownGeo(obj.geometry);
      }
    });
    return assetMap;
  }

  function resolvePartMaterial(part, defaultMat, overrideMat = null) {
    if (overrideMat) return overrideMat;
    const matLow = (part.matName || '').toLowerCase();
    const meshLow = (part.meshName || '').toLowerCase();
    const tag = `${meshLow} ${matLow}`;
    const hasVCol = Boolean(part.geometry?.attributes?.color);
    // Explicit stone materials from our Blender GLB kits ALWAYS keep moss-coated stone (never iron!)
    if (matLow.includes('stone') || matLow.includes('rock') || matLow.includes('cliff')) {
      return defaultMat;
    }
    if (tag.includes('glass') || tag.includes('glow') || tag.includes('ember') || tag.includes('flame')) {
      return lanternGlassMat;
    }
    if (tag.includes('ivy') || tag.includes('vine')) return ivyArchMat;
    if (tag.includes('banner') || tag.includes('cloth')) return crimsonBannerMat;
    if (tag.includes('iron') || tag.includes('metal') || tag.includes('chain') || tag.includes('cage') || tag.includes('pulley') || tag.includes('grate') || tag.includes('lever') || tag.includes('gate_door')) {
      return hasVCol ? forgedIronMat : forgedIronPlainMat;
    }
    if (tag.includes('wood') || tag.includes('timber') || tag.includes('plank') || tag.includes('scaffold') || tag.includes('beam')) {
      return timberWoodMat;
    }
    return defaultMat;
  }

  function cloneAssetObject(assetEntry, defaultMat, {
    castShadow = true,
    receiveShadow = true,
    frustumCulled = true,
    overrideMat = null
  } = {}) {
    if (!assetEntry || !assetEntry.parts || assetEntry.parts.length === 0) return null;
    if (assetEntry.parts.length === 1) {
      const p = assetEntry.parts[0];
      const mat = resolvePartMaterial(p, defaultMat, overrideMat);
      const m = new THREE.Mesh(p.geometry, mat);
      m.castShadow = castShadow;
      m.receiveShadow = receiveShadow;
      m.frustumCulled = frustumCulled;
      return m;
    }
    const holder = new THREE.Group();
    for (let i = 0; i < assetEntry.parts.length; i++) {
      const p = assetEntry.parts[i];
      const mat = resolvePartMaterial(p, defaultMat, overrideMat);
      const m = new THREE.Mesh(p.geometry, mat);
      m.applyMatrix4(p.localMatrix);
      m.castShadow = castShadow;
      m.receiveShadow = receiveShadow;
      m.frustumCulled = frustumCulled;
      holder.add(m);
    }
    return holder;
  }

  function createInstancedAsset(assetEntry, defaultMat, transforms, {
    castShadow = true,
    receiveShadow = true,
    frustumCulled = true,
    overrideMat = null,
    targetGroup = group
  } = {}) {
    if (!assetEntry || !assetEntry.parts || !transforms || transforms.length === 0) return [];
    const created = [];
    for (let pi = 0; pi < assetEntry.parts.length; pi++) {
      const p = assetEntry.parts[pi];
      const mat = resolvePartMaterial(p, defaultMat, overrideMat);
      const inst = new THREE.InstancedMesh(p.geometry, mat, transforms.length);
      inst.castShadow = castShadow;
      inst.receiveShadow = receiveShadow;
      inst.frustumCulled = frustumCulled;
      for (let i = 0; i < transforms.length; i++) {
        const t = transforms[i];
        _obj.position.set(t.x, t.y, t.z);
        _obj.rotation.set(t.rx || 0, t.ry || 0, t.rz || 0);
        _obj.scale.set(t.sx ?? t.s ?? 1, t.sy ?? t.s ?? 1, t.sz ?? t.s ?? 1);
        _obj.updateMatrix();
        _matA.multiplyMatrices(_obj.matrix, p.localMatrix);
        inst.setMatrixAt(i, _matA);
      }
      inst.instanceMatrix.needsUpdate = true;
      targetGroup.add(inst);
      created.push(inst);
    }
    return created;
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
          console.warn('[soulsRiverReachNorth] Failed to load GLB:', url, err);
          resolve(null);
        }
      );
    });
  }

  let shatteredBellSubMesh = null;
  let disposed = false;

  const readyPromise = Promise.all([
    pbrTex?.readyPromise || Promise.resolve(true),
    loadGlb(GLB_URLS.campHeights),
    loadGlb(GLB_URLS.ruins07),
    loadGlb(GLB_URLS.monastery08),
    loadGlb(GLB_URLS.nature),
    loadGlb(GLB_URLS.gorgeRuins)
  ]).then(([, campHeightsGltf, ruins07Gltf, monastery08Gltf, natureGltf, gorgeRuinsGltf]) => {
    if (disposed) return false;

    const campMap = extractNamedAssets(campHeightsGltf?.scene);
    const ruins07Map = extractNamedAssets(ruins07Gltf?.scene);
    const mon08Map = extractNamedAssets(monastery08Gltf?.scene);
    const natureMap = extractNamedAssets(natureGltf?.scene);
    const gorgeRuinsMap = extractNamedAssets(gorgeRuinsGltf?.scene);

    // ========================================================================
    // A) SECTOR 06 GLB KIT (`sector0506_camp_heights.glb`)
    // ========================================================================
    // 1. Working Animated Vertical Counterweight Cage Lift (`SC-2`)
    const liftTowerAsset = campMap.get('Lift_Tower_Stone');
    const liftCageAsset = campMap.get('Lift_Cage_Iron');
    const liftPulleyAsset = campMap.get('Lift_Pulley_Wheel');

    if (liftTowerAsset) {
      const towerObj = cloneAssetObject(liftTowerAsset, ruinStoneMat, {
        castShadow: true,
        receiveShadow: true,
        frustumCulled: false
      });
      if (towerObj) {
        towerObj.name = 'Lift_Tower_Stone_SC2';
        towerObj.position.set(LIFT_X, LIFT_Y_MIN, LIFT_Z);
        liftSystemGroup.add(towerObj);
        liftFallbackTowerGroup.visible = false;
      }
    }

    if (liftCageAsset) {
      const cageObj = cloneAssetObject(liftCageAsset, forgedIronMat, {
        castShadow: true,
        receiveShadow: true,
        frustumCulled: false
      });
      if (cageObj) {
        cageObj.name = 'Lift_Cage_Iron_SC2';
        liftCageGroup.add(cageObj);
        liftFallbackCageGroup.visible = false;
      }
    }

    if (liftPulleyAsset) {
      const pulleyMain = cloneAssetObject(liftPulleyAsset, forgedIronMat, {
        castShadow: true,
        receiveShadow: true,
        frustumCulled: false
      });
      const pulleyCw = cloneAssetObject(liftPulleyAsset, forgedIronMat, {
        castShadow: true,
        receiveShadow: true,
        frustumCulled: false
      });
      if (pulleyMain) {
        pulleyMain.name = 'Lift_Pulley_Wheel_Main';
        liftPulleyWheelGroup.add(pulleyMain);
        liftFallbackPulley.visible = false;
      }
      if (pulleyCw) {
        pulleyCw.name = 'Lift_Pulley_Wheel_CW';
        pulleyCw.scale.setScalar(0.84);
        liftCwPulleyGroup.add(pulleyCw);
      }
    }

    // 2. Cliffside Wooden Scaffolding Bays along 6.1 Catwalk (`x=-22..-4, z=134..150, y=8.0->13.0m`)
    const scaffoldBayAsset = campMap.get('Cliff_Scaffold_Bay');
    if (scaffoldBayAsset) {
      const scafBayTransforms = [
        { x: -7.8,  y:  8.90, z: 138.6, ry: scafYaw, s: 1.05 },
        { x: -12.9, y: 10.50, z: 143.0, ry: scafYaw, s: 1.05 },
        { x: -18.0, y: 12.10, z: 147.4, ry: scafYaw, s: 1.05 }
      ];
      createInstancedAsset(scaffoldBayAsset, timberWoodMat, scafBayTransforms, {
        castShadow: true,
        receiveShadow: true
      });
    }

    // ========================================================================
    // B) SECTOR 07 GLB KIT (`sector07_ruins.glb`) — ALWAYS-VISIBLE BELL-TOWER!
    // ========================================================================
    // 1. ALWAYS-VISIBLE REGIONAL SIGHTLINE: 28m `Shattered_Bell_Tower` at (16.0, 23.5, 208.0), scale 1.15 -> Y = +55.7m!
    const bellTowerAsset = ruins07Map.get('Shattered_Bell_Tower');
    if (bellTowerAsset) {
      const btObj = cloneAssetObject(bellTowerAsset, monasteryStoneMat, {
        castShadow: true,
        receiveShadow: true,
        frustumCulled: false
      });
      if (btObj) {
        btObj.name = 'Shattered_Bell_Tower_Sightline';
        btObj.position.set(16.0, 23.5, 208.0);
        btObj.scale.setScalar(1.15);
        // Find optional separated hanging iron bell child for gentle mountain-wind pendulum sway
        btObj.traverse((ch) => {
          if (ch.isMesh && ch.name && ch.name.toLowerCase().includes('bell') && !ch.name.toLowerCase().includes('tower')) {
            shatteredBellSubMesh = ch;
          }
        });
        group.add(btObj);
      }
    }

    // 2. Southern Cloister Colonnade Rows (`Cloister_Colonnade_Bay` long 6m axis is along local X!)
    const cloisterBayAsset = ruins07Map.get('Cloister_Colonnade_Bay');
    if (cloisterBayAsset) {
      const cloisterTransforms = [
        // West N-S colonnade arcade flanking 7.3 arrival (rotated +90 deg so 6m arcade runs along Z!)
        { x: -4.2, y: 21.70, z: 189.8, ry: Math.PI * 0.5, s: 1.02 },
        { x: -4.2, y: 22.55, z: 196.0, ry: Math.PI * 0.5, s: 1.02 },
        // South E-W colonnade arcade framing 7.3 southern terrace rim (ry = 0 so 6m arcade runs along X!)
        { x:  4.2, y: 21.62, z: 188.6, ry: 0.0,           s: 1.00 },
        { x: 10.6, y: 21.62, z: 188.6, ry: 0.0,           s: 1.00 }
      ];
      createInstancedAsset(cloisterBayAsset, ruinStoneMat, cloisterTransforms, {
        castShadow: true,
        receiveShadow: true
      });
    }

    // 3. Full 360-deg Sunken Stone Amphitheater (`4 × Amphitheater_Step_Arc` around (36, 21.5, 214)!)
    const amphiArcAsset = ruins07Map.get('Amphitheater_Step_Arc');
    if (amphiArcAsset) {
      const amphiTransforms = [
        { x: 36.0, y: 21.50, z: 214.0, ry: 0.0,            s: 1.0 },
        { x: 36.0, y: 21.50, z: 214.0, ry: Math.PI * 0.5,  s: 1.0 },
        { x: 36.0, y: 21.50, z: 214.0, ry: Math.PI,        s: 1.0 },
        { x: 36.0, y: 21.50, z: 214.0, ry: Math.PI * 1.5,  s: 1.0 }
      ];
      createInstancedAsset(amphiArcAsset, ruinStoneMat, amphiTransforms, {
        castShadow: true,
        receiveShadow: true
      });
    }

    // 4. Underground Relic Crypt (`Crypt_Portal_Arch` + `Ancient_Relic_Altar` at 7.4!)
    const cryptPortalAsset = ruins07Map.get('Crypt_Portal_Arch');
    if (cryptPortalAsset) {
      const cp = cloneAssetObject(cryptPortalAsset, ruinStoneMat, { castShadow: true, receiveShadow: true });
      if (cp) {
        cp.name = 'Crypt_Portal_Arch_7_4';
        cp.position.set(2.8, 23.00, 206.0);
        cp.rotation.y = -Math.PI * 0.5;
        group.add(cp);
      }
    }
    const relicAltarAsset = ruins07Map.get('Ancient_Relic_Altar');
    if (relicAltarAsset) {
      const ra = cloneAssetObject(relicAltarAsset, ruinStoneMat, { castShadow: true, receiveShadow: true });
      if (ra) {
        ra.name = 'Ancient_Relic_Altar_7_4';
        ra.position.set(-6.0, 19.80, 206.0);
        ra.rotation.y = Math.PI * 0.5;
        group.add(ra);
      }
    }

    // 5. Monumental Blazing `Grand_Brazier_Bowl` Cauldrons across Sectors 06, 07 & 08!
    const grandBrazierAsset = ruins07Map.get('Grand_Brazier_Bowl');
    if (grandBrazierAsset) {
      createInstancedAsset(grandBrazierAsset, ruinStoneMat, grandBrazierSpecs, {
        castShadow: true,
        receiveShadow: true,
        frustumCulled: false
      });
    } else {
      // Crisp forged-iron & stone fallback cauldrons if GLB unavailable
      const fbBrazierParts = [];
      for (let i = 0; i < grandBrazierSpecs.length; i++) {
        const b = grandBrazierSpecs[i];
        fbBrazierParts.push(xformGeo(new THREE.CylinderGeometry(0.32 * b.s, 0.56 * b.s, 1.35 * b.s, 7), b.x, b.y + 0.68 * b.s, b.z));
        fbBrazierParts.push(xformGeo(new THREE.CylinderGeometry(0.80 * b.s, 0.42 * b.s, 0.55 * b.s, 8), b.x, b.y + 1.56 * b.s, b.z));
      }
      const fbBrazierMesh = new THREE.Mesh(
        ownGeo(mergeNonIndexedGeos(THREE, fbBrazierParts, { boxUvTile: 1.0, withColor: false })),
        forgedIronPlainMat
      );
      fbBrazierMesh.castShadow = true;
      group.add(fbBrazierMesh);
    }

    // ========================================================================
    // C) SECTOR 08 GLB KIT (`sector08_monastery.glb`) — ALWAYS-VISIBLE SIGHTLINES!
    // ========================================================================
    // 1. 3 Monumental `Grand_Viaduct_Span` Bays plunging 18m into the swirling mist chasm (`8.1`)
    const viaductSpanAsset = mon08Map.get('Grand_Viaduct_Span');
    if (viaductSpanAsset) {
      const viaductTransforms = [
        { x: 12.0, y: 26.10, z: 247.0, ry: 0.0, s: 1.0 },
        { x: 12.0, y: 26.85, z: 257.0, ry: 0.0, s: 1.0 },
        { x: 12.0, y: 27.60, z: 267.0, ry: 0.0, s: 1.0 }
      ];
      createInstancedAsset(viaductSpanAsset, monasteryStoneMat, viaductTransforms, {
        castShadow: true,
        receiveShadow: true,
        frustumCulled: false
      });
    }

    // 2. ALWAYS-VISIBLE REGIONAL SIGHTLINE: `Monastery_Twin_Gatehouse` at (12.0, 28.0, 272.0)
    const twinGatehouseAsset = mon08Map.get('Monastery_Twin_Gatehouse');
    if (twinGatehouseAsset) {
      const gh = cloneAssetObject(twinGatehouseAsset, monasteryStoneMat, {
        castShadow: true,
        receiveShadow: true,
        frustumCulled: false
      });
      if (gh) {
        gh.name = 'Monastery_Twin_Gatehouse_Sightline';
        gh.position.set(12.0, 28.0, 272.0);
        group.add(gh);
      }
    }

    // 3. ALWAYS-VISIBLE REGIONAL SIGHTLINE: 3 Soaring `Cathedral_Vault_Rib_Arch` Arches over (12, 29, 282/292/302)!
    const vaultRibAsset = mon08Map.get('Cathedral_Vault_Rib_Arch');
    if (vaultRibAsset) {
      const ribTransforms = [
        { x: 12.0, y: 29.0, z: 282.0, ry: 0.0, s: 1.0 },
        { x: 12.0, y: 29.0, z: 292.0, ry: 0.0, s: 1.0 },
        { x: 12.0, y: 29.0, z: 302.0, ry: 0.0, s: 1.0 }
      ];
      createInstancedAsset(vaultRibAsset, monasteryStoneMat, ribTransforms, {
        castShadow: true,
        receiveShadow: true,
        frustumCulled: false
      });
    }

    // 4. Ruined Cathedral Nave Side Walls (`Cathedral_Side_Arcade` long 8m axis is already along local Z!)
    const sideArcadeAsset = mon08Map.get('Cathedral_Side_Arcade');
    if (sideArcadeAsset) {
      const arcadeTransforms = [
        // East Nave Ruined Window Arcade framing outer east edge of Boss Courtyard (x = +26.4, ry = 0 along Z!)
        { x: 26.4, y: 29.0, z: 280.5, ry: 0.0,     s: 1.02 },
        { x: 26.4, y: 29.0, z: 289.5, ry: 0.0,     s: 1.02 },
        { x: 26.4, y: 29.0, z: 298.5, ry: 0.0,     s: 1.02 },
        // West Nave Ruined Window Arcade (x = -2.4, leaving south breach z=274..280 wide open toward Shortcut Tower 8.4!)
        { x: -2.4, y: 29.0, z: 284.5, ry: Math.PI, s: 1.02 },
        { x: -2.4, y: 29.0, z: 293.0, ry: Math.PI, s: 1.02 },
        { x: -2.4, y: 29.0, z: 301.5, ry: Math.PI, s: 1.02 }
      ];
      createInstancedAsset(sideArcadeAsset, monasteryStoneMat, arcadeTransforms, {
        castShadow: true,
        receiveShadow: true,
        frustumCulled: false
      });
    }

    // 5. Boss Arena Central `Cathedral_Altar_Dais` at (12.0, 29.0, 294.0)
    const altarDaisAsset = mon08Map.get('Cathedral_Altar_Dais');
    if (altarDaisAsset) {
      const dais = cloneAssetObject(altarDaisAsset, monasteryStoneMat, {
        castShadow: true,
        receiveShadow: true
      });
      if (dais) {
        dais.name = 'Cathedral_Altar_Dais_8_3';
        dais.position.set(12.0, 29.0, 294.0);
        group.add(dais);
      }
    }

    // 6. ALWAYS-VISIBLE REGIONAL SIGHTLINE: `Shortcut_Bell_Turret` at (-13.0, 25.5, 266.0)!
    const shortcutTurretAsset = mon08Map.get('Shortcut_Bell_Turret');
    if (shortcutTurretAsset) {
      const st = cloneAssetObject(shortcutTurretAsset, monasteryStoneMat, {
        castShadow: true,
        receiveShadow: true,
        frustumCulled: false
      });
      if (st) {
        st.name = 'Shortcut_Bell_Turret_Sightline';
        st.position.set(-13.0, 25.5, 266.0);
        group.add(st);
      }
    }

    // 7. ALWAYS-VISIBLE REGIONAL SIGHTLINE: `Region2_Citadel_Gate` at (12.0, 31.5, 317.5)!
    const citadelGateAsset = mon08Map.get('Region2_Citadel_Gate');
    if (citadelGateAsset) {
      const cg = cloneAssetObject(citadelGateAsset, monasteryStoneMat, {
        castShadow: true,
        receiveShadow: true,
        frustumCulled: false
      });
      if (cg) {
        cg.name = 'Region2_Citadel_Gate_Sightline';
        cg.position.set(12.0, 31.5, 317.5);
        group.add(cg);
      }
    }

    // ========================================================================
    // D) SHARED GORGE RUINS KIT (`gorge_ruins.glb`) — SC-3 GATE, LEVERS, LANTERNS, CAMPFIRES & PROPS
    // ========================================================================
    // 1. Animated Monastery Shortcut Gate (`SC-3`, z=266) & Lever (-11.4, 27.8, 269.0) + Lift Lever (-8.2, 17.65, 121.0)
    const gateFrameAsset = gorgeRuinsMap.get('Iron_Shortcut_Gate_Frame');
    const gateDoorAsset = gorgeRuinsMap.get('Iron_Shortcut_Gate_Door');
    const leverBaseAsset = gorgeRuinsMap.get('Shortcut_Lever_Base');
    const leverArmAsset = gorgeRuinsMap.get('Shortcut_Lever_Arm');

    if (gateFrameAsset) {
      const gf = cloneAssetObject(gateFrameAsset, ruinStoneMat, { castShadow: true, receiveShadow: true });
      if (gf) {
        gf.position.set(SC3_GATE_X, SC3_GATE_Y, SC3_GATE_Z);
        gf.scale.set(1.36, 1.12, 1.10);
        group.add(gf);
      }
    }
    if (gateDoorAsset) {
      const gd = cloneAssetObject(gateDoorAsset, forgedIronMat, { castShadow: true, receiveShadow: true });
      if (gd) {
        // Exact Blender hinge offset scaled by gate frame X factor (1.22 * 1.36 = 1.66)
        gd.position.set(SC3_GATE_X - 1.66, SC3_GATE_Y, SC3_GATE_Z);
        gd.scale.set(1.36, 1.12, 1.10);
        group.add(gd);
        sc3FallbackGatePivot.visible = false;
        monasteryGateDoorObj = gd;
      }
    }
    if (leverBaseAsset) {
      // Monastery Shortcut SC-3 Lever at (-11.4, 27.8, 269.0)
      const lb1 = cloneAssetObject(leverBaseAsset, forgedIronMat, { castShadow: true, receiveShadow: true });
      if (lb1) {
        lb1.position.set(SC3_LEVER_X, SC3_LEVER_Y, SC3_LEVER_Z);
        lb1.rotation.y = Math.PI * 0.5;
        group.add(lb1);
      }
      // Upper Cage Lift SC-2 Lever at (-8.2, 17.65, 121.0)
      const lb2 = cloneAssetObject(leverBaseAsset, forgedIronMat, { castShadow: true, receiveShadow: true });
      if (lb2) {
        lb2.position.set(-8.2, LIFT_Y_MAX, 121.0);
        lb2.rotation.y = Math.PI * 0.5;
        group.add(lb2);
      }
    }
    if (leverArmAsset) {
      const la1Pivot = new THREE.Group();
      la1Pivot.position.set(SC3_LEVER_X, SC3_LEVER_Y + 0.34, SC3_LEVER_Z);
      la1Pivot.rotation.y = Math.PI * 0.5;
      const la1 = cloneAssetObject(leverArmAsset, forgedIronMat, { castShadow: true, receiveShadow: true });
      if (la1) {
        la1Pivot.add(la1);
        group.add(la1Pivot);
        monasteryLeverArmObj = la1;
      }

      const la2Pivot = new THREE.Group();
      la2Pivot.position.set(-8.2, LIFT_Y_MAX + 0.34, 121.0);
      la2Pivot.rotation.y = Math.PI * 0.5;
      const la2 = cloneAssetObject(leverArmAsset, forgedIronMat, { castShadow: true, receiveShadow: true });
      if (la2) {
        la2Pivot.add(la2);
        group.add(la2Pivot);
        liftLeverArmObj = la2;
      }
    }

    // 2. Sculpted Campfire Rings & Split Logs at Cliff Bonfire 6.4 (-12, 17.65, 170) & Pre-Viaduct Bonfire 7.5 (12, 25.5, 236)!
    const cfStones = gorgeRuinsMap.get('Campfire_Stones');
    const cfLogs = gorgeRuinsMap.get('Campfire_Logs');
    const cfAsh = gorgeRuinsMap.get('Campfire_Ash_Mound');
    const bonfireXforms = [
      { x: -12.0, y: 17.63, z: 170.0, ry: 0.45, s: 1.24 },
      { x:  12.0, y: 25.48, z: 236.0, ry: 1.85, s: 1.24 }
    ];
    createInstancedAsset(cfStones, cliffRockMat, bonfireXforms, { castShadow: true, receiveShadow: true });
    createInstancedAsset(cfLogs, barkMat, bonfireXforms, { castShadow: true, receiveShadow: true });
    createInstancedAsset(cfAsh, cliffRockMat, bonfireXforms, { castShadow: false, receiveShadow: true });

    // 3. Hanging Timber Gallows Lantern Posts (6.1 Cliff Scaffolding Catwalk + 6.2 Bastion + P08 + 7.5 Rim!)
    const galWood = gorgeRuinsMap.get('Timber_Gallows_Lantern_Wood');
    const galIron = gorgeRuinsMap.get('Timber_Gallows_Lantern_Iron');
    const galGlass = gorgeRuinsMap.get('Timber_Gallows_Lantern_Glass');
    const gallowsSpecs = [
      // Sector 06: 6.1 Scaffolding Catwalk glowing lantern posts (iconic s06_view1!)
      { x: -5.2,  y:  8.10, z: 136.4, ry: -0.65 },
      { x: -10.8, y:  9.95, z: 141.2, ry: -0.70 },
      { x: -16.8, y: 11.75, z: 146.4, ry: -0.72 },
      // Sector 06: 6.2 Windy Bastion & P08 Basalt Pass
      { x:  2.8,  y:  5.20, z: 128.0, ry:  Math.PI },
      { x: -16.5, y: 15.95, z: 162.8, ry:  Math.PI * 0.85 },
      // Sector 07: P10 Forest Trail Arrival & Pre-Viaduct Approach
      { x: 38.4,  y: 21.40, z: 199.5, ry: -Math.PI * 0.4 },
      { x:  7.0,  y: 25.45, z: 239.2, ry:  0.15 }
    ];
    for (let i = 0; i < gallowsSpecs.length; i++) {
      const lp = gallowsSpecs[i];
      const lGrp = new THREE.Group();
      lGrp.position.set(lp.x, lp.y - 0.06, lp.z);
      lGrp.rotation.y = lp.ry;
      if (galWood) lGrp.add(cloneAssetObject(galWood, timberWoodMat));
      if (galIron) lGrp.add(cloneAssetObject(galIron, forgedIronMat));
      if (galGlass) lGrp.add(cloneAssetObject(galGlass, lanternGlassMat, { castShadow: false, receiveShadow: false }));
      group.add(lGrp);
      const gx = lp.x + Math.cos(lp.ry) * 0.94;
      const gz = lp.z - Math.sin(lp.ry) * 0.94;
      addLanternGlowSprite(gx, lp.y + 2.92, gz, 1.95);
    }

    // 4. Wall Bracket Lanterns (6.3 Upper Lift Walkway, 6.5 Eagle Cave, 7.4 Crypt, 8.4 SC-3 Stair & 8.5 Citadel Gate!)
    const wallWood = gorgeRuinsMap.get('Wall_Bracket_Lantern_Wood');
    const wallIron = gorgeRuinsMap.get('Wall_Bracket_Lantern_Iron');
    const wallGlass = gorgeRuinsMap.get('Wall_Bracket_Lantern_Glass');
    const wallLanternSpecs = [
      // 6.3 Upper Lift Walkway & Lift Station entry
      { x: -8.6,  y: 20.6, z: 122.4, ry: 0.0,            sc: 1.05 },
      { x: -8.6,  y: 20.6, z: 142.0, ry: 0.0,            sc: 1.05 },
      { x: -8.6,  y: 20.6, z: 158.0, ry: 0.0,            sc: 1.05 },
      // 6.5 Secret Eagle Cave treasure glow clue
      { x: -32.2, y: 17.6, z: 152.0, ry: 0.0,            sc: 1.00 },
      // 7.4 Underground Relic Crypt interior sconces
      { x: -7.8,  y: 22.8, z: 203.2, ry: 0.0,            sc: 1.05 },
      { x: -7.8,  y: 22.8, z: 208.8, ry: 0.0,            sc: 1.05 },
      // 8.4 Monastery Shortcut SC-3 Cliff Stair & Gate sconces
      { x: -15.4, y: 23.8, z: 206.5, ry: 0.0,            sc: 1.05 },
      { x: -15.4, y: 27.2, z: 237.5, ry: 0.0,            sc: 1.05 },
      { x: -15.2, y: 30.2, z: 264.8, ry: 0.0,            sc: 1.10 },
      { x: -10.8, y: 30.2, z: 267.4, ry: Math.PI,        sc: 1.10 },
      // 8.5 Region II Citadel Gate flanking torches
      { x:  7.4,  y: 35.4, z: 315.4, ry: Math.PI * 0.5,  sc: 1.20 },
      { x: 16.6,  y: 35.4, z: 315.4, ry: Math.PI * 0.5,  sc: 1.20 }
    ];
    for (let i = 0; i < wallLanternSpecs.length; i++) {
      const wl = wallLanternSpecs[i];
      const wGrp = new THREE.Group();
      wGrp.position.set(wl.x, wl.y, wl.z);
      wGrp.rotation.y = wl.ry;
      wGrp.scale.setScalar(wl.sc);
      if (wallWood) wGrp.add(cloneAssetObject(wallWood, timberWoodMat));
      if (wallIron) wGrp.add(cloneAssetObject(wallIron, forgedIronMat));
      if (wallGlass) wGrp.add(cloneAssetObject(wallGlass, lanternGlassMat, { castShadow: false, receiveShadow: false }));
      group.add(wGrp);
      const gx = wl.x + Math.cos(wl.ry) * 0.78 * wl.sc;
      const gz = wl.z - Math.sin(wl.ry) * 0.78 * wl.sc;
      addLanternGlowSprite(gx, wl.y - 0.36 * wl.sc, gz, 1.72 * wl.sc);
    }

    // 5. Ruined Gothic Columns, Fallen Drums, P10 Forest Ruins Arch, War Banners, Crates, Barrels & Firewood Piles!
    const colTall = gorgeRuinsMap.get('Ruined_Column_Tall');
    const colBroken = gorgeRuinsMap.get('Ruined_Column_Broken');
    const chapelArch = gorgeRuinsMap.get('Ruined_Chapel_Arch');
    const ruinWall = gorgeRuinsMap.get('Ruined_Wall_Section');
    const plankPile = gorgeRuinsMap.get('Weathered_Plank_Pile');
    const crateAsset = gorgeRuinsMap.get('Wooden_Crate_AAA');
    const barrelAsset = gorgeRuinsMap.get('Oak_Barrel_AAA');
    const bannerPole = gorgeRuinsMap.get('Banner_Pole_Wood');
    const bannerCloth = gorgeRuinsMap.get('Banner_Cloth');

    if (colTall) {
      createInstancedAsset(colTall, ruinStoneMat, [
        { x:  4.2, y: 23.50, z: 200.5, ry: 0.3, s: 1.05 },
        { x: 25.5, y: 23.50, z: 201.0, ry: 1.8, s: 1.08 },
        { x: -2.4, y: 29.00, z: 279.0, ry: 0.7, s: 1.12 },
        { x: 26.2, y: 29.00, z: 279.0, ry: 2.2, s: 1.12 }
      ], { castShadow: true, receiveShadow: true });
    }
    if (colBroken) {
      // Iconic fallen/broken gothic columns beside Cloister Colonnades (s07_view1!) & Boss Courtyard!
      createInstancedAsset(colBroken, ruinStoneMat, [
        { x:  1.4, y: 21.55, z: 194.2, rx: 1.48, ry: 0.55, rz: 0.12, s: 1.06 },
        { x:  3.6, y: 22.10, z: 196.8, rx: 1.52, ry: -0.82, rz: 0.08, s: 0.98 },
        { x: 22.8, y: 23.50, z: 220.4, ry: 0.9, s: 1.10 },
        { x:  1.2, y: 29.00, z: 296.5, ry: 1.4, s: 1.05 },
        { x: 22.8, y: 29.00, z: 297.2, ry: 2.7, s: 1.05 }
      ], { castShadow: true, receiveShadow: true });
    }
    if (chapelArch) {
      // Framing P11 Stairtop Arch (s06_view2!), P10 Forest Ruins Entry Arch & Monastery West Breach Arch!
      createInstancedAsset(chapelArch, ruinStoneMat, [
        { x: -1.4, y: 21.50, z: 187.0, ry: 0.12, sx: 1.45, sy: 1.32, sz: 1.25 },
        { x: 40.4, y: 21.00, z: 192.5, ry: -0.22, sx: 1.48, sy: 1.35, sz: 1.25 },
        { x: -3.8, y: 29.00, z: 276.8, ry: Math.PI * 0.5, sx: 1.38, sy: 1.28, sz: 1.20 }
      ], { castShadow: true, receiveShadow: true });
    }
    if (ruinWall) {
      createInstancedAsset(ruinWall, ruinStoneMat, [
        { x: 26.8, y: 23.50, z: 223.8, ry: 0.45, s: 1.25 },
        { x:  5.4, y: 23.50, z: 222.8, ry: -0.35, s: 1.22 },
        { x: 47.2, y: 23.00, z: 221.5, ry: 0.72, s: 1.32 }
      ], { castShadow: true, receiveShadow: true });
    }
    if (plankPile) {
      // Stacked timber/firewood framing Cliff Bonfire 6.4 (s06_view2!), Windy Bastion 6.2 & Cloister!
      createInstancedAsset(plankPile, timberWoodMat, [
        { x: -15.4, y: 17.64, z: 169.2, ry: 0.35, s: 1.24 },
        { x:  -9.6, y: 17.64, z: 167.2, ry: -0.62, s: 1.18 },
        { x: -18.0, y: 15.98, z: 160.2, ry: 1.15, s: 1.12 },
        { x:   9.2, y: 25.48, z: 234.6, ry: 0.48, s: 1.10 },
        { x:  14.8, y: 23.48, z: 199.4, ry: -0.45, s: 1.15 }
      ], { castShadow: true, receiveShadow: true });
    }
    if (crateAsset) {
      createInstancedAsset(crateAsset, timberWoodMat, [
        { x: -23.8, y: 13.00, z: 153.6, ry: 0.28, s: 1.04 },
        { x: -22.6, y: 13.00, z: 154.2, ry: 0.85, s: 0.94 },
        { x: -14.8, y: 17.65, z: 172.8, ry: 0.18, s: 1.05 },
        { x: -29.2, y: 14.50, z: 154.2, ry: 0.52, s: 0.98 },
        { x:  -7.2, y: 19.80, z: 202.6, ry: 0.40, s: 1.00 }
      ], { castShadow: true, receiveShadow: true });
    }
    if (barrelAsset) {
      createInstancedAsset(barrelAsset, timberWoodMat, [
        { x: -24.2, y: 13.00, z: 151.8, ry: 0.40, s: 1.04 },
        { x: -15.6, y: 17.65, z: 171.8, ry: 1.10, s: 1.00 },
        { x: -28.4, y: 14.50, z: 150.2, ry: 0.65, s: 0.98 },
        { x:  -7.4, y: 19.80, z: 209.4, ry: 0.25, s: 1.02 }
      ], { castShadow: true, receiveShadow: true });
    }
    if (bannerPole && bannerCloth) {
      const northBanners = [
        { x:  8.4, y: 28.20, z: 270.0, ry: 0.0, s: 1.24 },
        { x: 15.6, y: 28.20, z: 270.0, ry: 0.0, s: 1.24 },
        { x:  7.2, y: 31.50, z: 315.8, ry: 0.0, s: 1.32 },
        { x: 16.8, y: 31.50, z: 315.8, ry: 0.0, s: 1.32 },
        { x: -10.4, y: 28.60, z: 274.2, ry: Math.PI * 0.5, s: 1.10 }
      ];
      createInstancedAsset(bannerPole, timberWoodMat, northBanners, { castShadow: true, receiveShadow: true });
      createInstancedAsset(bannerCloth, crimsonBannerMat, northBanners, { castShadow: true, receiveShadow: true });
    }

    // ========================================================================
    // E) SHARED NATURE KIT (`gorge_nature.glb`) — ALPINE CRAGS, PINES, BOULDERS & REGION II FANGS!
    // ========================================================================
    // 1. Dramatic Region II Alpine Mountain Fangs framing the Northern Horizon (`z = 335..410`) + High Flanks!
    const mtnA = natureMap.get('Distant_Mountain_A');
    const mtnB = natureMap.get('Distant_Mountain_B');
    const mtnAXforms = [
      // Northern Region II Alpine Horizon Fangs behind Region2_Citadel_Gate (z = 335..380)
      { x: -42.0, y:  6.0, z: 344.0, ry:  0.32, sx: 2.15, sy: 2.85, sz: 2.10 },
      { x:  62.0, y:  8.0, z: 342.0, ry: -0.45, sx: 2.25, sy: 2.95, sz: 2.20 },
      { x:  14.0, y:  6.0, z: 368.0, ry:  0.14, sx: 2.65, sy: 3.30, sz: 2.45 },
      { x: -78.0, y:  4.0, z: 286.0, ry:  1.10, sx: 2.05, sy: 2.50, sz: 1.95 },
      { x:  92.0, y:  4.0, z: 278.0, ry: -1.20, sx: 2.15, sy: 2.55, sz: 2.00 },
      { x: -72.0, y:  0.0, z: 196.0, ry:  0.95, sx: 1.85, sy: 2.25, sz: 1.80 }
    ];
    const mtnBXforms = [
      // Towering Cathedral-Crown Backdrop Fangs piercing out of the high cloud sea (z = 355..410, s08_view2!)
      { x: -24.0, y:  8.0, z: 378.0, ry: -0.22, sx: 2.45, sy: 3.45, sz: 2.35 },
      { x:  44.0, y:  8.0, z: 386.0, ry:  0.48, sx: 2.55, sy: 3.60, sz: 2.40 },
      { x:   4.0, y: 10.0, z: 406.0, ry:  0.08, sx: 2.90, sy: 3.95, sz: 2.65 },
      { x: -64.0, y:  6.0, z: 398.0, ry: -0.62, sx: 2.60, sy: 3.35, sz: 2.45 },
      { x:  84.0, y:  6.0, z: 392.0, ry:  0.74, sx: 2.60, sy: 3.40, sz: 2.45 }
    ];
    createInstancedAsset(mtnA, distantMountainMat, mtnAXforms, {
      castShadow: false,
      receiveShadow: false,
      frustumCulled: false,
      overrideMat: distantMountainMat
    });
    createInstancedAsset(mtnB, distantMountainMat, mtnBXforms, {
      castShadow: false,
      receiveShadow: false,
      frustumCulled: false,
      overrideMat: distantMountainMat
    });

    // 2. Stratified Basalt Cliff Walls & Overhangs clothing Sector 06/07/08 mountain drops (ZERO clipping into paths!)
    const cragA = natureMap.get('Cliff_Crag_A');
    const cragB = natureMap.get('Cliff_Crag_B');
    const overhangC = natureMap.get('Cliff_Overhang_C');
    const cragAXforms = [
      // Sheer basalt wall backing Sector 06 Scaffolding 6.1 & Windy Bastion 6.2 (west of x=-26!)
      { x: -29.5, y:  4.0, z: 138.0, ry:  0.18, sx: 1.55, sy: 1.85, sz: 1.65 },
      { x: -35.8, y:  8.0, z: 152.0, ry: -0.10, sx: 1.65, sy: 2.00, sz: 1.75 },
      { x: -30.5, y:  9.5, z: 165.0, ry:  0.12, sx: 1.55, sy: 1.95, sz: 1.65 },
      // Basalt cliff apron directly under Cliff Bonfire Terrace 6.4 & SC-3 Shortcut Stair
      { x: -24.5, y:  7.0, z: 184.0, ry:  0.06, sx: 1.65, sy: 1.90, sz: 1.70 },
      { x: -24.8, y:  9.0, z: 212.0, ry: -0.14, sx: 1.70, sy: 2.05, sz: 1.75 },
      { x: -24.5, y: 12.0, z: 244.0, ry:  0.08, sx: 1.75, sy: 2.25, sz: 1.80 },
      // Dramatic twin chasm cliffs framing Grand Broken Viaduct 8.1 & Cathedral Peak 8.3!
      { x:  -5.8, y: 13.5, z: 238.0, ry:  0.42, sx: 1.55, sy: 1.85, sz: 1.55 },
      { x:  29.5, y: 14.0, z: 240.0, ry: -0.35, sx: 1.65, sy: 1.95, sz: 1.60 },
      { x: -16.5, y: 14.5, z: 288.0, ry:  0.22, sx: 1.85, sy: 2.15, sz: 1.95 },
      { x:  38.5, y: 14.5, z: 290.0, ry: -0.25, sx: 1.90, sy: 2.20, sz: 2.00 },
      { x:  -6.5, y: 18.0, z: 320.0, ry:  0.30, sx: 1.95, sy: 2.35, sz: 1.85 },
      { x:  31.0, y: 18.0, z: 320.0, ry: -0.32, sx: 1.95, sy: 2.35, sz: 1.85 }
    ];
    const cragBXforms = [
      // Sector 07 Forest Rim & Amphitheater Eastern Crags (behind Sunken Amphitheater 7.2, s07_view1!)
      { x:  52.5, y: 16.5, z: 204.0, ry: Math.PI + 0.14, sx: 1.65, sy: 1.45, sz: 1.65 },
      { x:  54.0, y: 17.5, z: 222.0, ry: Math.PI - 0.18, sx: 1.75, sy: 1.55, sz: 1.70 },
      { x:  42.0, y: 18.0, z: 236.0, ry: Math.PI + 0.35, sx: 1.60, sy: 1.50, sz: 1.60 },
      // East Abyss Drop flanking Sector 06 Lift Tower & P08 Pass
      { x:  14.0, y:  1.5, z: 132.0, ry: Math.PI - 0.20, sx: 1.45, sy: 1.25, sz: 1.45 },
      { x:  16.5, y:  6.0, z: 164.0, ry: Math.PI + 0.12, sx: 1.55, sy: 1.45, sz: 1.55 }
    ];
    const overhangXforms = [
      // Natural basalt rock brow crowning Secret Eagle Cave 6.5 (-30, 19.6, 152) & Crypt Vault 7.4 (-5.2, 24.4, 206)!
      { x: -29.8, y: 19.4, z: 152.0, ry:  0.10, sx: 1.52, sy: 1.08, sz: 1.56 },
      { x:  -5.4, y: 24.4, z: 206.0, ry: -0.12, sx: 1.48, sy: 1.02, sz: 1.68 }
    ];
    createInstancedAsset(cragA, cliffRockMat, cragAXforms, { castShadow: true, receiveShadow: true, frustumCulled: false });
    createInstancedAsset(cragB, cliffRockMat, cragBXforms, { castShadow: true, receiveShadow: true, frustumCulled: false });
    createInstancedAsset(overhangC, cliffRockMat, overhangXforms, { castShadow: true, receiveShadow: true });

    // 3. Sculpted Alpine Nordic Pines framing Sector 06 Ledges, Sector 07 Ruins Forest & Monastery Ridges!
    const pineATrunk = natureMap.get('Nordic_Pine_A_Trunk');
    const pineAFol = natureMap.get('Nordic_Pine_A_Foliage');
    const pineBTrunk = natureMap.get('Nordic_Pine_B_Trunk');
    const pineBFol = natureMap.get('Nordic_Pine_B_Foliage');

    const northPines = [
      // Sector 06: Rocky outcrops near Lift Tower & eastern gorge cliff rim (s06_view1!)
      { x: -1.8, y:  4.2, z: 114.2, ry: 0.4, s: 1.15, kind: 'B' },
      { x: -11.5, y: 11.2, z: 126.5, ry: 1.8, s: 1.24, kind: 'A' },
      { x:  8.6, y:  8.5, z: 135.0, ry: 2.5, s: 1.32, kind: 'B' },
      { x:  9.8, y: 11.4, z: 150.0, ry: 0.9, s: 1.36, kind: 'A' },
      { x: -28.0, y: 19.2, z: 162.0, ry: 1.4, s: 1.28, kind: 'B' },
      // Sector 07: Pine forest encircling Amphitheater 7.2, P10 Trail & Bell-Tower horizon (s07_view1 & s07_view2!)
      { x: 48.5, y: 21.8, z: 186.0, ry: 0.6, s: 1.38, kind: 'B' },
      { x: 52.0, y: 22.4, z: 198.0, ry: 2.1, s: 1.44, kind: 'A' },
      { x: 51.2, y: 22.8, z: 212.0, ry: 1.2, s: 1.48, kind: 'B' },
      { x: 47.8, y: 23.0, z: 226.0, ry: 2.9, s: 1.42, kind: 'A' },
      { x: 36.2, y: 23.2, z: 232.0, ry: 0.5, s: 1.35, kind: 'B' },
      { x: 26.8, y: 23.6, z: 229.0, ry: 1.7, s: 1.28, kind: 'A' },
      { x:  0.8, y: 24.4, z: 224.0, ry: 2.4, s: 1.36, kind: 'B' },
      { x: -3.2, y: 25.0, z: 232.0, ry: 0.8, s: 1.42, kind: 'A' },
      { x:  2.2, y: 25.2, z: 238.0, ry: 1.9, s: 1.26, kind: 'B' },
      { x: -10.5, y: 22.0, z: 196.0, ry: 0.3, s: 1.30, kind: 'B' },
      { x: -11.2, y: 23.2, z: 214.0, ry: 2.6, s: 1.34, kind: 'A' },
      // Sector 08: Dramatic high-cliff dark pines silhouetted on outer Monastery ridges (s08_view1!)
      { x: -21.0, y: 27.5, z: 276.0, ry: 1.1, s: 1.45, kind: 'B' },
      { x: -22.5, y: 28.0, z: 294.0, ry: 2.3, s: 1.50, kind: 'A' },
      { x:  34.5, y: 28.0, z: 282.0, ry: 0.7, s: 1.48, kind: 'B' },
      { x:  35.8, y: 28.4, z: 298.0, ry: 1.9, s: 1.52, kind: 'A' },
      { x:  32.0, y: 29.5, z: 314.0, ry: 2.8, s: 1.46, kind: 'B' },
      { x:  -9.5, y: 29.8, z: 312.0, ry: 0.4, s: 1.44, kind: 'B' }
    ];
    const pineAXforms = [];
    const pineBXforms = [];
    for (let i = 0; i < northPines.length; i++) {
      const p = northPines[i];
      const gy = Math.max(p.y, evalY(p.x, p.z));
      const xf = { x: p.x, y: gy - 0.22, z: p.z, ry: p.ry, s: p.s };
      if (p.kind === 'B') pineBXforms.push(xf);
      else pineAXforms.push(xf);
    }
    createInstancedAsset(pineATrunk, barkMat, pineAXforms, { castShadow: true, receiveShadow: true });
    createInstancedAsset(pineAFol, pineFoliageMat, pineAXforms, { castShadow: !isMobile, receiveShadow: true });
    createInstancedAsset(pineBTrunk, barkMat, pineBXforms, { castShadow: true, receiveShadow: true });
    createInstancedAsset(pineBFol, pineFoliageMat, pineBXforms, { castShadow: !isMobile, receiveShadow: true });

    // 4. Windswept Gnarled Dead Trees, Grounding Flagstones, Rubble Piles & Velvety Moss Mounds!
    const gnarledTree = natureMap.get('Gnarled_Dead_Tree');
    const archTree = natureMap.get('Arch_Dead_Tree');
    const flagstoneCluster = natureMap.get('Road_Flagstone_Cluster');
    const cliffRubble = natureMap.get('Cliff_Rubble_Pile');
    const mossMound = natureMap.get('Moss_Mound_Cushion');
    const mossFlat = natureMap.get('Moss_Rock_Flat');
    const boulderA = natureMap.get('River_Boulder_A');

    if (gnarledTree) {
      createInstancedAsset(gnarledTree, barkMat, [
        { x: -24.5, y: 15.85, z: 164.0, ry: 0.85, s: 1.15 },
        { x:   6.8, y: 25.35, z: 234.5, ry: 2.15, s: 1.08 }
      ], { castShadow: true, receiveShadow: true });
    }
    if (archTree) {
      createInstancedAsset(archTree, barkMat, [
        { x:  4.6, y: 23.35, z: 215.5, ry: 1.25, s: 1.10 },
        { x: 25.8, y: 23.35, z: 205.5, ry: -0.65, s: 1.12 }
      ], { castShadow: true, receiveShadow: true });
    }

    if (flagstoneCluster) {
      // Tactile 3D mossy paving clusters breaking up flat deck surfaces on 6.4, 7.1, 7.5, 8.1 & 8.3!
      const flagXforms = [
        { x: -10.4, y: 17.61, z: 172.4, ry: 0.4, sx: 1.25, sy: 0.65, sz: 1.25 },
        { x: -13.8, y: 17.61, z: 168.0, ry: 2.1, sx: 1.20, sy: 0.65, sz: 1.20 },
        { x:  11.5, y: 23.46, z: 205.5, ry: 0.8, sx: 1.35, sy: 0.65, sz: 1.35 },
        { x:  20.5, y: 23.46, z: 211.0, ry: 1.9, sx: 1.35, sy: 0.65, sz: 1.35 },
        { x:  14.2, y: 23.46, z: 218.5, ry: 2.7, sx: 1.40, sy: 0.65, sz: 1.40 },
        { x:  12.0, y: 25.46, z: 232.8, ry: 0.5, sx: 1.32, sy: 0.65, sz: 1.32 },
        { x:  12.0, y: 25.46, z: 239.2, ry: 1.6, sx: 1.30, sy: 0.65, sz: 1.30 },
        { x:  12.0, y: 26.55, z: 252.0, ry: 0.2, sx: 1.25, sy: 0.60, sz: 1.25 },
        { x:  12.0, y: 27.32, z: 262.0, ry: 1.1, sx: 1.25, sy: 0.60, sz: 1.25 },
        { x:   9.2, y: 28.96, z: 286.0, ry: 0.9, sx: 1.42, sy: 0.65, sz: 1.42 },
        { x:  15.2, y: 28.96, z: 288.5, ry: 2.4, sx: 1.42, sy: 0.65, sz: 1.42 },
        { x:  12.0, y: 28.96, z: 303.5, ry: 1.5, sx: 1.45, sy: 0.65, sz: 1.45 }
      ];
      createInstancedAsset(flagstoneCluster, ruinStoneDeckMat, flagXforms, { castShadow: false, receiveShadow: true });
    }

    if (cliffRubble) {
      const rubbleXforms = [
        { x: -16.8, y: 17.60, z: 175.8, ry: 0.5, s: 1.10 },
        { x:  12.2, y: 23.45, z: 204.2, ry: 1.2, s: 1.12 },
        { x:  19.8, y: 23.45, z: 211.8, ry: 2.6, s: 1.10 },
        { x:  -2.6, y: 21.45, z: 188.0, ry: 0.9, s: 1.05 },
        { x:  26.4, y: 23.45, z: 208.5, ry: 1.7, s: 1.15 },
        { x:   7.2, y: 25.45, z: 241.0, ry: 0.4, s: 1.08 },
        { x:  16.8, y: 25.45, z: 241.0, ry: 2.8, s: 1.08 },
        { x:   0.8, y: 28.95, z: 284.5, ry: 1.1, s: 1.18 },
        { x:  23.4, y: 28.95, z: 286.0, ry: 2.3, s: 1.18 },
        { x:   1.4, y: 28.95, z: 304.2, ry: 0.6, s: 1.16 },
        { x:  22.6, y: 28.95, z: 304.5, ry: 1.9, s: 1.16 }
      ];
      createInstancedAsset(cliffRubble, cliffRockMat, rubbleXforms, { castShadow: true, receiveShadow: true });
    }

    if (mossMound) {
      const mossXforms = [
        { x:  -6.8, y: 17.60, z: 173.0, ry: 0.4, s: 1.15 },
        { x:  -4.2, y: 21.45, z: 192.0, ry: 1.6, s: 1.20 },
        { x:  24.2, y: 23.45, z: 218.5, ry: 2.8, s: 1.22 },
        { x:  32.5, y: 21.45, z: 208.5, ry: 0.9, s: 1.18 },
        { x:  40.2, y: 21.45, z: 219.5, ry: 2.1, s: 1.20 },
        { x:   7.8, y: 25.45, z: 237.8, ry: 1.3, s: 1.25 },
        { x:  16.4, y: 25.45, z: 237.4, ry: 3.1, s: 1.22 },
        { x:   9.6, y: 26.20, z: 248.5, ry: 0.6, s: 1.05 },
        { x:  14.4, y: 27.15, z: 260.0, ry: 1.9, s: 1.05 },
        { x:   2.2, y: 28.95, z: 280.5, ry: 0.7, s: 1.20 },
        { x:  21.8, y: 28.95, z: 280.5, ry: 2.4, s: 1.20 },
        { x:   6.8, y: 28.95, z: 306.5, ry: 1.1, s: 1.18 },
        { x:  17.2, y: 28.95, z: 306.5, ry: 2.9, s: 1.18 }
      ];
      createInstancedAsset(mossMound, mossMoundMat, mossXforms, { castShadow: true, receiveShadow: true });
    }

    if (mossFlat && boulderA) {
      createInstancedAsset(mossFlat, cliffRockMat, [
        { x: 16.5, y: 25.35, z: 234.0, ry: 0.5, s: 1.25 },
        { x:  7.2, y: 25.35, z: 231.5, ry: 1.8, s: 1.18 },
        { x: 29.8, y: 21.38, z: 219.8, ry: 2.4, s: 1.15 }
      ], { castShadow: true, receiveShadow: true });
      createInstancedAsset(boulderA, cliffRockMat, [
        { x: -24.0, y: 15.80, z: 158.2, ry: 0.6, s: 1.18 },
        { x:  44.8, y: 21.40, z: 205.0, ry: 1.9, s: 1.26 },
        { x:   2.2, y: 23.35, z: 218.0, ry: 2.7, s: 1.22 }
      ], { castShadow: true, receiveShadow: true });
    }

    // Re-apply dynamic states in case setLiftState / setMonasteryShortcutUnlocked ran before GLBs resolved!
    applyLiftVisuals();
    applyMonasteryShortcutVisuals();
    return true;
  });

  // ==========================================================================
  // 10. PUBLIC CONTROLLER METHODS (`setLiftState`, `setMonasteryShortcutUnlocked`, `getLiftCageY`, `update`, `dispose`)
  // ==========================================================================
  function setLiftState(state = {}) {
    if (!state || typeof state !== 'object') return;
    if (typeof state.unlocked === 'boolean') {
      liftUnlocked = state.unlocked;
    }
    if (typeof state.riding === 'boolean') {
      liftRiding = state.riding;
    }
    if (Number.isFinite(state.y)) {
      liftTargetY = clamp(state.y, LIFT_Y_MIN, LIFT_Y_MAX);
      // When topology actively drives cage height while riding (or instant snap requested),
      // keep visual platform locked tightly to player physics so boots NEVER float!
      if (state.instant === true || (liftRiding && Math.abs(liftTargetY - liftCurrentY) < 0.65)) {
        liftCurrentY = liftTargetY;
      }
    }
    if (state.instant === true) {
      liftLeverAnim = liftUnlocked ? 1.0 : 0.0;
    }
    applyLiftVisuals();
  }

  function setMonasteryShortcutUnlocked(unlocked, instant = false) {
    monasteryShortcutUnlocked = Boolean(unlocked);
    if (instant) {
      monasteryDoorAnim = monasteryShortcutUnlocked ? 1.0 : 0.0;
    }
    applyMonasteryShortcutVisuals();
  }

  function getLiftCageY() {
    return liftCurrentY;
  }

  // Zero-GC Per-Frame Update
  function update(dt = 0.016, elapsed = 0, camPos = null) {
    if (disposed) return;
    const safeDt = Math.min(Math.max(Number.isFinite(dt) ? dt : 0.016, 0.001), 0.1);
    const t = Number.isFinite(elapsed) ? elapsed : uTimeUniform.value;

    // 1. Smooth Vertical Cage Lift (`SC-2`) + Rotating Pulley Wheel + Glowing Forged-Iron Chains
    let liftChanged = false;
    const liftDiff = liftTargetY - liftCurrentY;
    if (Math.abs(liftDiff) > 0.0005) {
      const maxSpeed = liftRiding ? 18.0 : 5.2;
      const step = maxSpeed * safeDt;
      if (Math.abs(liftDiff) <= step) {
        liftCurrentY = liftTargetY;
      } else {
        liftCurrentY += liftDiff > 0 ? step : -step;
      }
      liftChanged = true;
    }

    const liftLeverTarget = liftUnlocked ? 1.0 : 0.0;
    if (Math.abs(liftLeverAnim - liftLeverTarget) > 0.001) {
      const lStep = safeDt * 1.25;
      liftLeverAnim = liftLeverAnim < liftLeverTarget
        ? Math.min(liftLeverTarget, liftLeverAnim + lStep)
        : Math.max(liftLeverTarget, liftLeverAnim - lStep);
      liftChanged = true;
    }
    if (liftChanged) {
      applyLiftVisuals();
    }

    // Subtle molten ember gleam along lift iron chains (intensifies when riding or unlocked!)
    const chainBaseGlow = liftRiding ? 0.88 : (liftUnlocked ? 0.52 : 0.24);
    liftChainMat.emissiveIntensity = chainBaseGlow + 0.14 * Math.sin(t * 4.2);

    // 2. Smooth Monastery Shortcut Gate (`SC-3`) & Lever Animation
    const doorTarget = monasteryShortcutUnlocked ? 1.0 : 0.0;
    if (Math.abs(monasteryDoorAnim - doorTarget) > 0.001) {
      const dStep = safeDt * 1.15;
      monasteryDoorAnim = monasteryDoorAnim < doorTarget
        ? Math.min(doorTarget, monasteryDoorAnim + dStep)
        : Math.max(doorTarget, monasteryDoorAnim - dStep);
      applyMonasteryShortcutVisuals();
    }

    // 3. Gentle Mountain-Wind Sway on Suspended Shattered Bell-Tower Iron Bell (if separated sub-mesh)
    if (shatteredBellSubMesh) {
      shatteredBellSubMesh.rotation.z = Math.sin(t * 1.15) * 0.065;
    }

    // 4. Organic Warm Amber Flicker on Lantern & Brazier Halo Sprites (Zero GC)
    for (let i = 0; i < warmSprites.length; i++) {
      const ws = warmSprites[i];
      const pulse = 0.90 + 0.10 * Math.sin(t * 7.2 + ws.phase) + 0.05 * Math.cos(t * 15.1 + ws.phase * 1.6);
      const sc = ws.baseScale * pulse;
      ws.sprite.scale.set(sc, sc, 1);
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;

    for (let i = 0; i < addedCampfireRoots.length; i++) {
      const r = addedCampfireRoots[i];
      if (r && r.parent) r.parent.remove(r);
    }
    addedCampfireRoots.length = 0;

    if (group.parent) {
      group.parent.remove(group);
    }

    for (let i = 0; i < ownedGeos.length; i++) {
      ownedGeos[i]?.dispose?.();
    }
    for (let i = 0; i < ownedMats.length; i++) {
      ownedMats[i]?.dispose?.();
    }
    for (let i = 0; i < ownedTex.length; i++) {
      ownedTex[i]?.dispose?.();
    }
    ownedGeos.length = 0;
    ownedMats.length = 0;
    ownedTex.length = 0;
    warmSprites.length = 0;
    shatteredBellSubMesh = null;
    monasteryGateDoorObj = null;
    monasteryLeverArmObj = null;
    liftLeverArmObj = null;
  }

  return {
    group,
    readyPromise,
    setLiftState,
    setMonasteryShortcutUnlocked,
    getLiftCageY,
    update,
    dispose
  };
}
