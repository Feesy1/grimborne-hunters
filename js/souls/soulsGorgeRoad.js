// Dark Souls / Bloodborne Interconnected Riverside Gorge Renderer («Тракт Древней Арки • Акведук Разлома • Башня Перевала»)
// Stylized-Realistic Visual Cohesion Overhaul (z103):
//   - Real Blender 4.5.9 sculpted Draco-compressed GLB kits (`gorge_nature.glb` + `gorge_ruins.glb`)
//   - 1024px seamlessly tileable PBR textures (`cobble`, `ruin_stone`, `cliff_rock`) + 512px (`bark`, `wood_timber`, `moss_earth`)
//   - Unified moss-coated stone/cliff/boulder/timber materials (`soulsGorgeTerrainMat.js`) & smoky campfire VFX (`soulsGorgeAtmosphere.js`)
//   - 512px alpha-cutout botanical foliage (`pine_bough_rgba`, `fern_frond_rgba`, `ivy_vine_rgba`, `river_grass_rgba`) with wind sway
//   - True multi-elevation Dark Souls architecture synced 1:1 with `soulsGorgeTopology.js`:
//       Zone 0 Sculpted Ash Gate & Pilgrim Arch
//       Zone 1 Ancient Archway Road + Branch A Lower River Shoal
//       Zone 2 Lantern Road + Overhead Stone Aqueduct Bridge (y = 5.60m) + Branch C Smuggler's Grotto
//       Branch B Upper Cliffside Ruined Chapel Terrace + Interactive One-Way Iron Shortcut Gate & Lever
//       Zone 3 Multi-Tier Watchtower Bastion Courtyard + Crypt Nook + Upper Rampart Ring (y = 5.65m)
//   - Pure Vanilla ES Module (Three.js r160, 60+ FPS, zero GC in update(), full dispose()).

import {
  WATER_LEVEL,
  GORGE_ANCHORS,
  GORGE_FIRE_SOURCES,
  GORGE_INTERACTABLES,
  GORGE_STATIC_COLLIDERS,
  GORGE_PLACEMENT_MANIFEST,
  evalBaseTerrainY,
  getGorgePathCenterX,
  getGorgeRiverCenterX,
  getGorgeRiverHalfWidth,
  getGorgeRiverSignedDist
} from './soulsGorgeTopology.js?v=20261125z106';
import { createCampfireVfxRig } from './soulsGorgeAtmosphere.js?v=20261125z106';
import {
  createStylizedGorgeTerrainMaterial,
  createMossCoatedStoneMaterial
} from './soulsGorgeTerrainMat.js?v=20261125z106';

const ASSET_VER = '20261125z106';
const TEX_BASE = './assets/env/textures';
const NATURE_GLB_URL = `./assets/env/gorge_nature.glb?v=${ASSET_VER}`;
const RUINS_GLB_URL = `./assets/env/gorge_ruins.glb?v=${ASSET_VER}`;

// Re-export legacy symbol names for backwards-compatibility with any callers
export const GORGE_ROAD_ANCHORS = GORGE_ANCHORS;
export { GORGE_STATIC_COLLIDERS, GORGE_FIRE_SOURCES, GORGE_INTERACTABLES };

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function makeRng(seedInit) {
  let seed = seedInit >>> 0;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// ============================================================================
// Shared 1024px PBR Texture Pack Loader (Used by BOTH Gorge Road & Zone 0 Shore!)
// ============================================================================
export function createGorgePbrTextures(THREE, { anisotropy = 4, trackTex = (t) => t } = {}) {
  const loader = new THREE.TextureLoader();
  const maxAniso = Math.min(8, Math.max(1, Number(anisotropy) || 4));
  const pendingPromises = [];

  function loadTex(filename, { isColor = true, repeat = true, flipY = true, repX = 1, repY = 1 } = {}) {
    let resolveFn;
    const p = new Promise((res) => { resolveFn = res; });
    pendingPromises.push(p);

    const url = `${TEX_BASE}/${filename}?v=${ASSET_VER}`;
    const tex = loader.load(
      url,
      () => resolveFn(true),
      undefined,
      () => resolveFn(false)
    );
    tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    tex.flipY = flipY;
    if (repeat && (repX !== 1 || repY !== 1)) {
      tex.repeat.set(repX, repY);
    }
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = maxAniso;
    tex.needsUpdate = true;
    return trackTex(tex);
  }

  const cobble = {
    albedo: loadTex('cobble_albedo.png', { isColor: true, repeat: true }),
    normal: loadTex('cobble_normal.png', { isColor: false, repeat: true }),
    orm: loadTex('cobble_orm.png', { isColor: false, repeat: true })
  };
  const ruinStone = {
    albedo: loadTex('ruin_stone_albedo.png', { isColor: true, repeat: true }),
    normal: loadTex('ruin_stone_normal.png', { isColor: false, repeat: true }),
    orm: loadTex('ruin_stone_orm.png', { isColor: false, repeat: true })
  };
  const cliffRock = {
    albedo: loadTex('cliff_rock_albedo.png', { isColor: true, repeat: true }),
    normal: loadTex('cliff_rock_normal.png', { isColor: false, repeat: true }),
    orm: loadTex('cliff_rock_orm.png', { isColor: false, repeat: true })
  };
  const bark = {
    albedo: loadTex('bark_albedo.png', { isColor: true, repeat: true }),
    normal: loadTex('bark_normal.png', { isColor: false, repeat: true })
  };
  const woodTimber = {
    albedo: loadTex('wood_timber_albedo.png', { isColor: true, repeat: true }),
    normal: loadTex('wood_timber_normal.png', { isColor: false, repeat: true })
  };
  const mossEarth = {
    albedo: loadTex('moss_earth_albedo.png', { isColor: true, repeat: true }),
    normal: loadTex('moss_earth_normal.png', { isColor: false, repeat: true })
  };

  // Botanical RGBA alpha-cutout cards:
  //   - pine_bough & ivy_vine are mapped onto Blender glTF meshes (glTF flips V -> flipY = false!)
  //   - fern_frond & river_grass are mapped onto Three.js curved PlaneGeometries (flipY = true!)
  const foliage = {
    pineBough: loadTex('pine_bough_rgba.png', { isColor: true, repeat: false, flipY: false }),
    ivyVine: loadTex('ivy_vine_rgba.png', { isColor: true, repeat: false, flipY: false }),
    ivyVinePlane: loadTex('ivy_vine_rgba.png', { isColor: true, repeat: false, flipY: true }),
    fernFrond: loadTex('fern_frond_rgba.png', { isColor: true, repeat: false, flipY: true }),
    riverGrass: loadTex('river_grass_rgba.png', { isColor: true, repeat: false, flipY: true })
  };

  return {
    cobble,
    ruinStone,
    cliffRock,
    bark,
    woodTimber,
    mossEarth,
    foliage,
    readyPromise: Promise.all(pendingPromises)
  };
}

// ============================================================================
// Backward-Compatible Wrapper -> Unified Stylized-Realistic Gorge Terrain Material (z103)
// ============================================================================
export function createWetGorgeTerrainMaterial(THREE, pbrTex, opts = {}) {
  return createStylizedGorgeTerrainMaterial(THREE, pbrTex, opts);
}

// ============================================================================
// Procedural Curved Botanical Cluster Geometries (Ferns, Sedge Grass, Ivy Curtains)
// ============================================================================
function buildCurvedCardGeo(THREE, width, height, segsY = 4, archFwd = 0.22, vCamber = 0.06, tiltX = 0.0) {
  const geo = new THREE.PlaneGeometry(width, height, 2, segsY);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i) + height * 0.5; // shift base pivot to y = 0
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

// ============================================================================
// Wind-Sway Patch for Botanical Foliage Materials (`alphaTest` + soft nocturnal rim)
// ============================================================================
function applyWindSway(mat, uTimeUniform, { amp = 0.09, freq = 1.65, anchorTop = false, cacheKey = 'gorge_wind' } = {}) {
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
// Main Factory: `createSoulsGorgeRoad`
// ============================================================================
export function createSoulsGorgeRoad(THREE, ctx) {
  const {
    parentGroup,
    gltfLoader,
    pbrTex,
    isMobile = false,
    lowSpecMode = false,
    trackGeo,
    trackMat,
    regNormalMat,
    xformGeo,
    tintGeo,
    mergeNonIndexedGeos,
    createFlameAssemblyMesh,
    addWarmGroundPool,
    alwaysOneUniform,
    uTimeUniform,
    mistSpriteTex,
    rustedGrateMat,
    destructibleProps
  } = ctx;

  const gorgeGroup = new THREE.Group();
  gorgeGroup.name = 'SoulsGorgeRoadAAA';
  parentGroup.add(gorgeGroup);

  const rng = makeRng(202611251);

  // --------------------------------------------------------------------------
  // 1. Unified Stylized-Realistic Moss-Coated PBR Materials (Hero Cohesion envMapIntensity 0.40–0.62)
  // --------------------------------------------------------------------------
  const ruinStoneMat = createMossCoatedStoneMaterial(THREE, pbrTex, {
    kind: 'ruin',
    color: 0xb4c0d4,
    envMapIntensity: 0.44,
    mossAmount: 0.68,
    groundAO: 0.36,
    rimStrength: 0.15,
    lowSpecMode,
    trackMat,
    regNormalMat
  });

  const zone0GateMat = createMossCoatedStoneMaterial(THREE, pbrTex, {
    kind: 'zone0_gate',
    color: 0xb6c2d6,
    envMapIntensity: 0.44,
    mossAmount: 0.58,
    groundAO: 0.38,
    rimStrength: 0.16,
    lowSpecMode,
    trackMat,
    regNormalMat
  });

  const ruinStoneDeckMat = createMossCoatedStoneMaterial(THREE, pbrTex, {
    kind: 'deck',
    color: 0xb8c4d8,
    envMapIntensity: 0.52,
    mossAmount: 0.14,
    groundAO: 0.24,
    rimStrength: 0.12,
    lowSpecMode,
    trackMat,
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
    trackMat,
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
    trackMat,
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
    trackMat,
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
    trackMat,
    regNormalMat
  });

  const timberWoodMat = createMossCoatedStoneMaterial(THREE, pbrTex, {
    kind: 'timber',
    color: 0xb8a898,
    envMapIntensity: 0.44,
    mossAmount: 0.10,
    groundAO: 0.32,
    rimStrength: 0.12,
    lowSpecMode,
    trackMat,
    regNormalMat
  });

  const forgedIronMat = trackMat(new THREE.MeshStandardMaterial({
    color: 0x3b424e,
    roughness: 0.46,
    metalness: 0.82,
    envMapIntensity: 0.62,
    vertexColors: true
  }));

  const lanternGlassMat = trackMat(new THREE.MeshStandardMaterial({
    color: 0xffd584,
    emissive: new THREE.Color(0xff9a28),
    emissiveIntensity: 3.8,
    roughness: 0.22,
    metalness: 0.0
  }));

  const crimsonBannerMat = applyWindSway(
    trackMat(new THREE.MeshStandardMaterial({
      color: 0x9b242c,
      roughness: 0.86,
      metalness: 0.02,
      envMapIntensity: 0.42,
      vertexColors: true,
      side: THREE.DoubleSide
    })),
    uTimeUniform,
    { amp: 0.14, freq: 2.1, anchorTop: true, cacheKey: 'gorge_banner_wind' }
  );

  // Botanical Alpha-Cutout Materials (0 halo, double-sided, balanced moonlit tints for v2 deep botanical cards!)
  const pineFoliageMat = applyWindSway(
    trackMat(new THREE.MeshStandardMaterial({
      map: pbrTex.foliage.pineBough,
      alphaTest: 0.40,
      side: THREE.DoubleSide,
      color: 0xd0e4d6,
      roughness: 0.86,
      metalness: 0.02,
      envMapIntensity: 0.48,
      vertexColors: true
    })),
    uTimeUniform,
    { amp: 0.11, freq: 1.35, anchorTop: false, cacheKey: 'gorge_pine_wind' }
  );

  const ivyArchMat = applyWindSway(
    trackMat(new THREE.MeshStandardMaterial({
      map: pbrTex.foliage.ivyVine,
      alphaTest: 0.36,
      side: THREE.DoubleSide,
      color: 0xcce2c6,
      roughness: 0.80,
      metalness: 0.02,
      envMapIntensity: 0.48,
      vertexColors: true
    })),
    uTimeUniform,
    { amp: 0.06, freq: 1.75, anchorTop: true, cacheKey: 'gorge_ivy_arch_wind' }
  );

  const ivyCurtainMat = applyWindSway(
    trackMat(new THREE.MeshStandardMaterial({
      map: pbrTex.foliage.ivyVinePlane,
      alphaTest: 0.36,
      side: THREE.DoubleSide,
      color: 0xc2d8bc,
      roughness: 0.82,
      metalness: 0.02,
      envMapIntensity: 0.48
    })),
    uTimeUniform,
    { amp: 0.06, freq: 1.75, anchorTop: true, cacheKey: 'gorge_ivy_plane_wind' }
  );

  const fernMat = applyWindSway(
    trackMat(new THREE.MeshStandardMaterial({
      map: pbrTex.foliage.fernFrond,
      alphaTest: 0.42,
      side: THREE.DoubleSide,
      color: 0xd0e2c4,
      roughness: 0.78,
      metalness: 0.02,
      envMapIntensity: 0.48
    })),
    uTimeUniform,
    { amp: 0.075, freq: 1.85, anchorTop: false, cacheKey: 'gorge_fern_wind' }
  );

  const riverGrassMat = applyWindSway(
    trackMat(new THREE.MeshStandardMaterial({
      map: pbrTex.foliage.riverGrass,
      alphaTest: 0.40,
      side: THREE.DoubleSide,
      color: 0xc6dac0,
      roughness: 0.80,
      metalness: 0.02,
      envMapIntensity: 0.48
    })),
    uTimeUniform,
    { amp: 0.085, freq: 2.15, anchorTop: false, cacheKey: 'gorge_grass_wind' }
  );

  // Atmospheric Distant Alpine Mountain Material (supports InstancedMesh! Fades seamlessly into layered blue-slate valley mist #0e1828!)
  const distantMountainMat = trackMat(new THREE.ShaderMaterial({
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
        float rim = pow(1.0 - max(dot(N, V), 0.0), 2.6);
        float ridge = smoothstep(0.42, 0.86, N.y);

        // Deep brooding dark-slate alpine rock with cold moonlight rim along craggy arêtes (NEVER pale snow!)
        vec3 rockDark = vec3(0.018, 0.030, 0.054);
        vec3 rockLit  = vec3(0.085, 0.125, 0.195);
        vec3 col = mix(rockDark, rockLit, clamp(ndl * 0.60 + ridge * 0.22, 0.0, 1.0)) * (0.62 + 0.50 * vCol.r);
        col += vec3(0.18, 0.27, 0.42) * rim * (0.30 + 0.65 * ndl);

        // Layered luminous moonlit blue-slate valley mist (#1a2a40) rising from the mountain base + aerial perspective
        float dist = length(vWorldPos - cameraPosition);
        float valleyMist = (1.0 - smoothstep(-2.0, 22.0, vWorldPos.y)) * 0.72;
        float depthMist = smoothstep(64.0, 188.0, dist) * 0.66;
        float totalMist = clamp(max(valleyMist, depthMist), 0.0, 0.85);
        vec3 mistCol = mix(vec3(0.088, 0.145, 0.242), vec3(0.145, 0.220, 0.348), clamp(ndl * 0.36 + smoothstep(8.0, 28.0, vWorldPos.y) * 0.26, 0.0, 1.0));
        col = mix(col, mistCol, totalMist);

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.FrontSide,
    fog: false
  }));

  // Warm soft glow halo sprite for lanterns & fires
  const warmHaloMat = trackMat(new THREE.SpriteMaterial({
    map: mistSpriteTex,
    color: 0xffa63d,
    transparent: true,
    opacity: 0.48,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }));

  // --------------------------------------------------------------------------
  // 2. SOLID MULTI-ELEVATION ARCHITECTURAL DECKS, STAIRS, RETAINING WALLS & GROTTO
  //    (100% 1:1 with `soulsGorgeTopology.js` walkable surfaces — ZERO floating hero!)
  // --------------------------------------------------------------------------
  const archStoneParts = [];
  const archDeckParts = [];

  function addMasonryBox(parts, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0, topHex = 0x8694ae, botHex = 0x3b4456) {
    parts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz), topHex, botHex));
  }

  function addSteppedStairFlight(parts, { x0, y0, z0, x1, y1, z1, width = 2.6, steps = 14, sideWalls = true }) {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const horizLen = Math.hypot(dx, dz);
    const yaw = Math.atan2(dx, dz);
    const rise = y1 - y0;
    const stepD = horizLen / steps;
    const stepH = Math.abs(rise) / steps;

    for (let i = 0; i < steps; i++) {
      const f = (i + 0.5) / steps;
      const sx = lerp(x0, x1, f);
      const sz = lerp(z0, z1, f);
      const topY = lerp(y0, y1, (i + 1) / steps);
      // Solid masonry base descending beneath each tread so stairs look monumental & grounded from underneath!
      const hBlock = Math.max(0.45, topY - Math.min(y0, y1) + 0.55);
      addMasonryBox(
        parts,
        width,
        hBlock,
        stepD + 0.08,
        sx,
        topY - hBlock * 0.5,
        sz,
        0,
        yaw,
        0,
        0x95a4be,
        0x363f52
      );
    }

    if (sideWalls) {
      const perpX = Math.cos(yaw);
      const perpZ = -Math.sin(yaw);
      for (const side of [-1, 1]) {
        for (let k = 0; k < 5; k++) {
          const f = (k + 0.5) / 5;
          const cx = lerp(x0, x1, f) + perpX * side * (width * 0.5 + 0.24);
          const cz = lerp(z0, z1, f) + perpZ * side * (width * 0.5 + 0.24);
          const baseY = lerp(y0, y1, f);
          const segH = 1.15 + (k % 2) * 0.14;
          addMasonryBox(parts, 0.46, segH, horizLen / 5 + 0.14, cx, baseY + segH * 0.32, cz, 0, yaw, 0, 0x8a98b2, 0x3b4456);
        }
      }
    }
  }

  // A) Branch B: Upper Cliffside Ruined Chapel Terrace Retaining Wall, Flagstone Decks & Tiered Steps!
  //    (Recessed back at x = -10.5 and clothed with sculpted Basalt Cliff Crags on its lower face so Lantern Road
  //     sees rugged mossy alpine cliffs crowned high above by ruined Gothic chapel arches!)
  addMasonryBox(archStoneParts, 4.8, 5.8, 7.6, -10.5, 2.70, 76.5, 0, 0, 0, 0x566276, 0x202634); // South Bridge Junction Deck
  addMasonryBox(archDeckParts,  4.8, 0.24, 7.5, -10.1, 5.49, 76.55, 0, 0, 0, 0x9aa8c2, 0x4c566b);
  addMasonryBox(archStoneParts, 4.8, 5.1, 10.2, -10.5, 2.35, 64.0, 0, 0, 0, 0x566276, 0x202634); // Chapel Nave Deck
  addMasonryBox(archDeckParts,  4.8, 0.24, 10.1, -10.1, 4.79, 64.0, 0, 0, 0, 0x9aa8c2, 0x4c566b);
  addMasonryBox(archStoneParts, 4.8, 4.4, 4.0, -10.5, 2.00, 53.6, 0, 0, 0, 0x566276, 0x202634); // Shortcut Gate Landing
  addMasonryBox(archDeckParts,  4.8, 0.24, 4.0, -10.1, 4.09, 53.6, 0, 0, 0, 0x9aa8c2, 0x4c566b);

  // Low weathered gothic stone parapet curb along eastern cliff edge (crags clothe the rock face below!)
  for (let bz = 54.0; bz <= 78.5; bz += 4.8) {
    const topY = bz >= 72.0 ? 5.65 : bz >= 58.0 ? 4.95 : 4.25;
    addMasonryBox(archStoneParts, 0.52, 0.85, 3.8, -7.75, topY + 0.36, bz, 0, 0, 0, 0x8694ae, 0x3b4456);
  }
  // Upper Chapel Terrace tiered step transitions (matching `evalTerraceY` 1:1!)
  addSteppedStairFlight(archDeckParts, { x0: -10.1, y0: 4.90, z0: 69.0, x1: -10.1, y1: 5.60, z1: 73.0, width: 4.6, steps: 5, sideWalls: false });
  addSteppedStairFlight(archDeckParts, { x0: -10.1, y0: 4.20, z0: 55.5, x1: -10.1, y1: 4.90, z1: 59.0, width: 4.6, steps: 5, sideWalls: false });

  // Cliffside One-Way Shortcut Staircase: (-7.4, 0.78, 44.4) -> (-9.5, 4.20, 52.0)
  addSteppedStairFlight(archDeckParts, {
    x0: -7.40, y0: 0.78, z0: 44.40,
    x1: -9.50, y1: 4.20, z1: 52.00,
    width: 3.3,
    steps: 15,
    sideWalls: true
  });
  // Ruined Stone Relic Altar on Upper Chapel Terrace (-11.85, 4.90, 64.0)
  addMasonryBox(archStoneParts, 1.15, 0.34, 2.25, -11.85, 5.07, 64.0, 0, 0, 0, 0x8e9db8, 0x3f485b);
  addMasonryBox(archStoneParts, 0.85, 0.92, 1.75, -11.85, 5.68, 64.0, 0, 0, 0, 0x95a5c0, 0x444e62);
  addMasonryBox(archStoneParts, 1.08, 0.22, 2.05, -11.85, 6.20, 64.0, 0, 0, 0, 0xa2b2ce, 0x4f5a70);

  // B) Stone Aqueduct Bridge East River-Overlook Balcony (x = 3.5..5.7, z = 79.6..84.4, y = 5.60m)
  //    Slender Gothic open colonnade piers underneath (keeps river & moonlit valley vista WIDE OPEN in frame_07!)
  addMasonryBox(archStoneParts, 0.72, 5.7, 0.72, 5.42, 2.65, 79.90, 0, 0, 0, 0x8a99b4, 0x343d50);
  addMasonryBox(archStoneParts, 0.72, 5.7, 0.72, 5.42, 2.65, 84.10, 0, 0, 0, 0x8a99b4, 0x343d50);
  addMasonryBox(archStoneParts, 2.60, 0.52, 4.90, 4.60, 5.14, 82.0, 0, 0, 0, 0x8c9bb6, 0x3a4358);
  addMasonryBox(archDeckParts,  2.6, 0.26, 4.9, 4.60, 5.48, 82.0, 0, 0, 0, 0xa0aec8, 0x4e586d);
  // Overlook balcony low broken weathered parapets (north & south curbs + open east portal posts into P07 East Aqueduct Extension!)
  addMasonryBox(archStoneParts, 0.54, 1.15, 0.56, 5.78, 6.14, 79.82, 0, 0, 0, 0x96a6c2, 0x444e63);
  addMasonryBox(archStoneParts, 0.54, 1.15, 0.56, 5.78, 6.14, 84.18, 0, 0, 0, 0x96a6c2, 0x444e63);
  addMasonryBox(archStoneParts, 2.4, 0.72, 0.42, 4.60, 5.94, 79.58, 0, 0, 0, 0x96a6c2, 0x444e63);
  addMasonryBox(archStoneParts, 2.4, 0.72, 0.42, 4.60, 5.94, 84.42, 0, 0, 0, 0x96a6c2, 0x444e63);
  // West bridge transition deck tying `Stone_Arch_Bridge_Bay` (-6.1) seamlessly into Upper Chapel Terrace (-12.4)
  addMasonryBox(archStoneParts, 6.6, 5.8, 3.8, -9.2, 2.68, 82.0, 0, 0, 0, 0x7a88a0, 0x2b3242);
  addMasonryBox(archDeckParts,  6.5, 0.24, 3.5, -9.2, 5.49, 82.0, 0, 0, 0, 0x9baac4, 0x4d576c);
  addMasonryBox(archStoneParts, 6.6, 0.92, 0.42, -9.2, 6.02, 80.15, 0, 0, 0, 0x95a4be, 0x434d61);

  // C) Branch C: Torchlit Cliffside Smuggler's Grotto Interior Chamber, Switchback Stairs & Vaulted Roof!
  //    Lower Entry Hall (x = -7.0..-4.0, z = 87.0..92.2, y = 1.45m)
  addMasonryBox(archDeckParts,  3.4, 0.34, 5.4, -5.5, 1.28, 89.6, 0, 0, 0, 0x8695ae, 0x3b4456);
  //    Mid Switchback Landing (x = -13.4..-10.6, z = 83.6..90.4, y = 3.55m)
  addMasonryBox(archStoneParts, 3.0, 3.8, 7.0, -12.0, 1.65, 87.0, 0, 0, 0, 0x74829a, 0x282f3f);
  addMasonryBox(archDeckParts,  2.9, 0.26, 6.8, -12.0, 3.43, 87.0, 0, 0, 0, 0x92a1bc, 0x465066);
  //    Upper Bridge Exit Vestibule (x = -7.0..-4.2, z = 83.5..86.6, y = 5.60m)
  addMasonryBox(archStoneParts, 3.0, 1.2, 3.2, -5.6, 4.98, 85.05, 0, 0, 0, 0x7b89a2, 0x303849);
  addMasonryBox(archDeckParts,  2.9, 0.24, 3.2, -5.6, 5.49, 85.05, 0, 0, 0, 0x9baac4, 0x4d576c);
  //    Flight 1 (Lower -> Mid: x = -6.8 -> -10.8, z = 88.6, y = 1.45 -> 3.55)
  addSteppedStairFlight(archDeckParts, {
    x0: -6.80, y0: 1.45, z0: 88.60,
    x1: -10.80, y1: 3.55, z1: 88.60,
    width: 2.8,
    steps: 10,
    sideWalls: false
  });
  //    Flight 2 (Mid -> Bridge: x = -10.8 -> -6.8, z = 85.0, y = 3.55 -> 5.60)
  addSteppedStairFlight(archDeckParts, {
    x0: -10.80, y0: 3.55, z0: 85.00,
    x1: -6.80, y1: 5.60, z1: 85.00,
    width: 2.8,
    steps: 10,
    sideWalls: false
  });
  //    Central masonry spine wall separating Flight 1 (z=88.6) & Flight 2 (z=85.0) + vaulted grotto walls & roof!
  addMasonryBox(archStoneParts, 4.4, 5.2, 0.65, -8.8, 3.8, 86.8, 0, 0, 0, 0x7a88a0, 0x2b3242);
  addMasonryBox(archStoneParts, 0.85, 7.2, 9.2, -13.6, 4.4, 87.8, 0, 0, 0, 0x707e96, 0x262c3a); // Back west rock-stone wall
  addMasonryBox(archStoneParts, 9.8, 7.2, 0.90, -8.8, 4.4, 92.4, 0, 0, 0, 0x707e96, 0x262c3a); // North grotto wall
  addMasonryBox(archStoneParts, 9.8, 1.35, 9.2, -8.8, 8.2, 87.8, 0, 0, 0, 0x6b788f, 0x272e3d); // Vaulted stone roof slab
  //    Grotto carved lore stone pedestal at (-5.6, 1.45, 91.0)
  addMasonryBox(archStoneParts, 0.72, 1.38, 0.44, -5.6, 2.14, 91.45, 0, 0.15, 0, 0x9aa8c2, 0x454f64);

  // D) Zone 3: Multi-Tier Watchtower Bastion Courtyard (y=2.65m), Crypt Nook & Upper Rampart Ring (y=5.65m)!
  //    Lower Courtyard flagstone paving (z = 99.5..120.8, x = -4.2..6.2, y = 2.65m)
  addMasonryBox(archStoneParts, 11.2, 2.2, 21.6, 1.0, 1.54, 110.2, 0, 0, 0, 0x7a88a0, 0x2a3140);
  addMasonryBox(archDeckParts,  10.8, 0.22, 21.2, 1.0, 2.55, 110.2, 0, 0, 0, 0x9aa9c4, 0x4d576c);
  //    Crypt Nook recessed floor & stone vault walls (x = -8.6..-3.5, z = 109.4..116.2, y = 2.65m)
  addMasonryBox(archDeckParts,  5.4, 0.30, 6.8, -6.0, 2.50, 112.8, 0, 0, 0, 0x8b9ab4, 0x3e475a);
  addMasonryBox(archStoneParts, 0.85, 3.4, 7.2, -8.8, 4.3, 112.8, 0, 0, 0, 0x728098, 0x282f3e);
  addMasonryBox(archStoneParts, 5.4, 3.4, 0.75, -6.0, 4.3, 109.4, 0, 0, 0, 0x728098, 0x282f3e);
  addMasonryBox(archStoneParts, 5.4, 3.4, 0.75, -6.0, 4.3, 116.2, 0, 0, 0, 0x728098, 0x282f3e);
  addMasonryBox(archStoneParts, 5.6, 0.75, 7.2, -6.0, 5.95, 112.8, 0, 0, 0, 0x7886a0, 0x2e3546);
  //    Crypt Lore Stone Tablet at (-6.4, 2.65, 111.0)
  addMasonryBox(archStoneParts, 0.56, 1.65, 1.15, -7.95, 3.48, 111.0, 0, 0, 0, 0x9aa9c4, 0x444e63);

  //    Bastion Entry Stepped Approach (z = 95.8..100.8, y = 1.48 -> 2.65m)
  addSteppedStairFlight(archDeckParts, {
    x0: 1.05, y0: 1.48, z0: 95.8,
    x1: 1.15, y1: 2.65, z1: 100.8,
    width: 5.4,
    steps: 8,
    sideWalls: false
  });
  //    Bastion Upper Rampart Ascent Staircase (x = -2.6, z = 103.5..109.5, y = 2.65 -> 5.65m)
  addSteppedStairFlight(archDeckParts, {
    x0: -2.60, y0: 2.65, z0: 103.5,
    x1: -2.60, y1: 5.65, z1: 109.5,
    width: 2.4,
    steps: 14,
    sideWalls: true
  });
  //    Upper Rampart Ring Decks (y = 5.65m):
  //      West Gallery (x = -3.8..-1.4, z = 109.4..119.4)
  addMasonryBox(archDeckParts,  2.6, 0.36, 10.2, -2.60, 5.47, 114.4, 0, 0, 0, 0x9caac6, 0x4f5a70);
  //      North Portcullis Parapet (x = -3.8..+6.2, z = 116.2..119.4)
  addMasonryBox(archStoneParts, 10.4, 3.2, 3.5, 1.20, 4.05, 118.4, 0, 0, 0, 0x7b89a2, 0x2d3546);
  addMasonryBox(archDeckParts,  10.2, 0.32, 3.4, 1.20, 5.50, 117.8, 0, 0, 0, 0x9caac6, 0x4f5a70);
  //      East River-Overlook Rampart Walk (x = +2.8..+6.2, z = 103.8..119.4) + thick masonry soffit & lower colonnade!
  addMasonryBox(archDeckParts,  3.5, 0.68, 15.8, 4.50, 5.31, 111.6, 0, 0, 0, 0x9caac6, 0x424c60);
  addMasonryBox(archStoneParts, 0.78, 3.2, 15.8, 6.08, 4.05, 111.6, 0, 0, 0, 0x7e8ca6, 0x2d3546);
  for (let pz = 105.0; pz <= 116.5; pz += 3.8) {
    addMasonryBox(archStoneParts, 0.96, 3.1, 0.96, 3.05, 4.05, pz, 0, 0, 0, 0x8897b2, 0x363e52);
  }
  //    Upper Rampart Battlement Parapet Merlons along East & North outer walls
  for (let mz = 104.4; mz <= 118.8; mz += 2.4) {
    addMasonryBox(archStoneParts, 0.55, 1.05, 1.35, 6.05, 6.18, mz, 0, 0, 0, 0x98a7c4, 0x465066);
  }
  for (let mx = -3.2; mx <= 5.6; mx += 2.2) {
    addMasonryBox(archStoneParts, 1.25, 1.12, 0.55, mx, 6.20, 119.35, 0, 0, 0, 0x98a7c4, 0x465066);
  }
  //    Watchtower North Portcullis Gatehouse Pylons & Locked Forged-Iron Portcullis Grille at z = 120.2
  addMasonryBox(archStoneParts, 2.2, 8.6, 2.4, -2.45, 6.8, 120.2, 0, 0, 0, 0x8291ac, 0x31394a);
  addMasonryBox(archStoneParts, 2.2, 8.6, 2.4,  4.05, 6.8, 120.2, 0, 0, 0, 0x8291ac, 0x31394a);
  addMasonryBox(archStoneParts, 8.6, 1.65, 2.5, 0.80, 10.6, 120.2, 0, 0, 0, 0x8c9cb8, 0x3a4358);
  const portcullisParts = [];
  for (let px = -1.2; px <= 2.8; px += 0.50) {
    portcullisParts.push(xformGeo(new THREE.CylinderGeometry(0.055, 0.06, 5.2, 6), px, 5.2, 120.1));
  }
  for (let py = 3.2; py <= 7.2; py += 1.0) {
    portcullisParts.push(xformGeo(new THREE.BoxGeometry(4.4, 0.14, 0.16), 0.8, py, 120.1));
  }
  const portcullisMesh = new THREE.Mesh(
    trackGeo(mergeNonIndexedGeos(THREE, portcullisParts, { boxUvTile: 1.4 })),
    rustedGrateMat
  );
  // Hoisted open for z104 seam P08 (Sector 04 -> Sector 06 Cliff Heights!)
  portcullisMesh.position.y = 4.15;
  portcullisMesh.castShadow = true;
  portcullisMesh.receiveShadow = true;
  gorgeGroup.add(portcullisMesh);

  // Branch A: Hidden River Shrine Stone Pedestal at (4.05, y, 53.5)
  const shrineY = evalBaseTerrainY(4.05, 53.5);
  addMasonryBox(archStoneParts, 1.35, 0.34, 1.35, 4.05, shrineY + 0.15, 53.5, 0, 0.3, 0, 0x8e9db8, 0x3d4658);
  addMasonryBox(archStoneParts, 0.86, 1.15, 0.86, 4.05, shrineY + 0.88, 53.5, 0, 0.3, 0, 0x98a8c4, 0x454f64);
  addMasonryBox(archStoneParts, 1.12, 0.24, 1.12, 4.05, shrineY + 1.54, 53.5, 0, 0.3, 0, 0xa4b4d0, 0x4f5a70);

  // Merge structural masonry & walkable flagstone decks into 2 crisp shadow-casting draw calls!
  const archStoneMesh = new THREE.Mesh(
    trackGeo(mergeNonIndexedGeos(THREE, archStoneParts, { boxUvTile: 2.8, withColor: true })),
    ruinStoneMat
  );
  archStoneMesh.castShadow = true;
  archStoneMesh.receiveShadow = true;
  gorgeGroup.add(archStoneMesh);

  const archDeckMesh = new THREE.Mesh(
    trackGeo(mergeNonIndexedGeos(THREE, archDeckParts, { boxUvTile: 2.4, withColor: true })),
    ruinStoneDeckMat
  );
  archDeckMesh.castShadow = true;
  archDeckMesh.receiveShadow = true;
  gorgeGroup.add(archDeckMesh);

  // --------------------------------------------------------------------------
  // 3. ROARING SMOKY CAMPFIRES (`createCampfireVfxRig`), BRAZIERS & WARM GROUND POOLS
  // --------------------------------------------------------------------------
  const fireAssemblies = [];
  const warmSprites = [];

  const campfireRig = createCampfireVfxRig(THREE, {
    parentGroup: gorgeGroup,
    uTimeUniform,
    mistSpriteTex,
    isMobile,
    lowSpecMode,
    trackGeo,
    trackMat
  });

  function addLanternGlowSprite(x, y, z, scale = 1.65) {
    const sp = new THREE.Sprite(warmHaloMat);
    sp.position.set(x, y, z);
    sp.scale.set(scale, scale, 1);
    gorgeGroup.add(sp);
    warmSprites.push({ sprite: sp, baseScale: scale, phase: rng() * 6.28 });
  }

  function addCampfireFx(x, y, z, scale = 1.0) {
    // CRITICAL: addPointLight: false so NUM_POINT_LIGHTS never changes (zero shader recompile hitch;
    // world.js permanent burningGroundLight handles real dynamic firelight!)
    campfireRig.addCampfire(x, y, z, {
      scale,
      litUniform: alwaysOneUniform,
      phase: x * 0.7 + z * 0.4,
      addPointLight: false
    });
    // addWarmGroundPool(px, pz, radius, colorRgb, strength, litUniformRef, phaseOff) — EXACT 7 args!
    addWarmGroundPool(x, z, 5.4 * scale, [1.12, 0.48, 0.12], 0.44, alwaysOneUniform, x * 0.7 + z * 0.4);
    addLanternGlowSprite(x, y + 0.88 * scale, z, 2.2 * scale);
  }

  // Campfire 1 (Zone 1), Campfire 2 (Zone 2), Watchtower Bonfire (Zone 3)
  addCampfireFx(GORGE_ANCHORS.camp1Pos.x, GORGE_ANCHORS.camp1Pos.y, GORGE_ANCHORS.camp1Pos.z, 1.08);
  addCampfireFx(GORGE_ANCHORS.camp2Pos.x, GORGE_ANCHORS.camp2Pos.y, GORGE_ANCHORS.camp2Pos.z, 1.08);
  addCampfireFx(GORGE_ANCHORS.watchtowerHearthPos.x, GORGE_ANCHORS.watchtowerHearthPos.y, GORGE_ANCHORS.watchtowerHearthPos.z, 1.24);

  // Elevated Dark Souls Sightline Braziers (Bridge Overlook, Watchtower Upper Beacon, River Shoal Shrine)
  const brazierSpecs = [
    { x: 5.10, y: 5.60, z: 82.00, sc: 0.78 },
    { x: 5.65, y: 5.65, z: 104.55, sc: 0.92 },
    { x: 4.15, y: evalBaseTerrainY(4.15, 53.50), z: 53.50, sc: 0.58 }
  ];
  const brazierIronParts = [];
  for (let i = 0; i < brazierSpecs.length; i++) {
    const b = brazierSpecs[i];
    brazierIronParts.push(xformGeo(new THREE.CylinderGeometry(0.18, 0.32, 0.88, 7), b.x, b.y + 0.44, b.z));
    brazierIronParts.push(xformGeo(new THREE.CylinderGeometry(0.46, 0.24, 0.34, 8), b.x, b.y + 0.96, b.z));
    const fl = createFlameAssemblyMesh(0.48 * b.sc, 0.86 * b.sc, alwaysOneUniform);
    fl.position.set(b.x, b.y + 1.08, b.z);
    gorgeGroup.add(fl);
    fireAssemblies.push(fl);
    addLanternGlowSprite(b.x, b.y + 1.38, b.z, 2.0 * b.sc);
  }
  const brazierMesh = new THREE.Mesh(
    trackGeo(mergeNonIndexedGeos(THREE, brazierIronParts, { boxUvTile: 1.0 })),
    rustedGrateMat
  );
  brazierMesh.castShadow = true;
  gorgeGroup.add(brazierMesh);

  // --------------------------------------------------------------------------
  // 4. LUSH BOTANICAL UNDERGROWTH (`InstancedMesh`: Woodland Ferns, River Sedge Grass & Hanging Ivy!)
  //    Eliminates every trace of barren "dump" ground — frames foreground, riverbank & ruins like frame_00/07!
  // --------------------------------------------------------------------------
  const fernGeo = trackGeo(buildFernRosetteGeo(THREE, mergeNonIndexedGeos));
  const grassGeo = trackGeo(buildRiverGrassClumpGeo(THREE, mergeNonIndexedGeos));
  const ivyCardGeo = trackGeo(buildCurvedCardGeo(THREE, 2.2, 3.1, 4, 0.16, 0.04, 0.0));
  // Shift ivy pivot to TOP (y = 0 at anchor, hanging down to y = -3.1)
  ivyCardGeo.translate(0, -3.1, 0);

  const fernSpots = [];
  // Hero foreground ferns framing bottom-right, tree roots & road shoulders of Video Part 1 (`frame_00`)
  const heroFerns = [
    { x: -3.2, z: 34.4, sc: 1.25 }, { x: -4.4, z: 35.6, sc: 1.18 }, { x: -5.2, z: 37.8, sc: 1.32 },
    { x: -4.6, z: 40.4, sc: 1.10 }, { x: -6.8, z: 42.2, sc: 1.22 }, { x: -5.4, z: 47.6, sc: 1.15 },
    { x: -4.8, z: 51.8, sc: 1.26 }, { x:  3.4, z: 54.6, sc: 1.18 }, { x:  4.5, z: 52.4, sc: 1.05 },
    { x: -4.9, z: 60.5, sc: 1.18 }, { x: -5.2, z: 65.0, sc: 1.24 }, { x: -4.8, z: 73.6, sc: 1.20 },
    { x: -4.5, z: 78.2, sc: 1.16 }, { x: -3.8, z: 86.2, sc: 1.22 }, { x: -4.4, z: 93.4, sc: 1.15 },
    // Extra tight clusters around Gnarled Dead Tree roots, Archway Dead Tree, and foreground riverbank rocks
    { x: -5.2, z: 38.6, sc: 1.08 }, { x: -6.4, z: 39.8, sc: 1.20 }, { x: -5.5, z: 40.5, sc: 1.02 },
    { x: -4.4, z: 53.6, sc: 1.12 }, { x: -5.4, z: 54.9, sc: 1.18 }, { x:  2.9, z: 35.4, sc: 1.04 },
    { x:  3.3, z: 38.0, sc: 1.12 }, { x:  3.1, z: 42.0, sc: 1.08 }, { x: -4.6, z: 32.6, sc: 1.14 }
  ];
  for (let i = 0; i < heroFerns.length; i++) fernSpots.push(heroFerns[i]);
  // Dense organic scatter tightly clustered around tree roots, right cliff foot (-X) & riverbank rocks (+X)
  const fernAnchorClusters = [
    { x: -5.85, z: 39.2, r: 2.3 }, // Gnarled Dead Tree roots
    { x: -4.85, z: 54.4, r: 2.0 }, // Archway Dead Tree roots
    { x: -4.90, z: 47.6, r: 2.1 }, // Twin Fluted Columns foot
    { x: -4.60, z: 31.4, r: 2.0 }, // Zone 0 Ash Gate west pier
    { x:  4.40, z: 31.4, r: 2.0 }, // Zone 0 Ash Gate east pier
    { x: -3.60, z: 55.6, r: 1.8 }, // Ancient Archway west pier
    { x:  3.40, z: 55.2, r: 2.0 }, // Ancient Archway east wing
    { x: -5.40, z: 65.5, r: 2.6 }, // Lantern Road cliff foot mid
    { x: -5.30, z: 76.0, r: 2.5 }  // Lantern Road cliff foot north
  ];
  const fernCountTarget = isMobile ? 160 : 290;
  for (let i = 0; i < fernCountTarget; i++) {
    const mode = rng();
    let x;
    let z;
    if (mode < 0.28) {
      // Tight botanical pockets hugging tree roots & ruin pier bases
      const cl = fernAnchorClusters[Math.floor(rng() * fernAnchorClusters.length)];
      const ang = rng() * Math.PI * 2;
      const rad = 0.55 + Math.sqrt(rng()) * cl.r;
      x = cl.x + Math.cos(ang) * rad;
      z = cl.z + Math.sin(ang) * rad;
    } else {
      z = 16.0 + rng() * 96.0;
      const pathX = getGorgePathCenterX(z);
      if (mode < 0.72) {
        // Right cliff foot (-X) tighter border along verges & crag feet
        x = pathX - (2.35 + rng() * 3.85);
      } else {
        // Left riverbank rocks (+X) between road shoulder and wet waterline
        const rcx = getGorgeRiverCenterX(z);
        const rhw = getGorgeRiverHalfWidth(z);
        x = lerp(pathX + 2.35, rcx - rhw + 0.45, rng());
      }
    }
    const pathX = getGorgePathCenterX(z);
    if (Math.abs(x - pathX) < 2.10 && z < 98.0) continue;
    const gy = evalBaseTerrainY(x, z);
    if (gy < WATER_LEVEL + 0.08 || gy > 4.6) continue;
    // Keep clear of campfires, shore bonfire & grotto doorway
    if (Math.hypot(x - GORGE_ANCHORS.bonfirePos.x, z - GORGE_ANCHORS.bonfirePos.z) < 2.2) continue;
    if (Math.hypot(x - GORGE_ANCHORS.camp1Pos.x, z - GORGE_ANCHORS.camp1Pos.z) < 2.1) continue;
    if (Math.hypot(x - GORGE_ANCHORS.camp2Pos.x, z - GORGE_ANCHORS.camp2Pos.z) < 2.1) continue;
    if (Math.hypot(x - (-4.2), z - 88.8) < 2.1) continue;
    fernSpots.push({ x, z, sc: 0.66 + rng() * 0.74 });
  }
  const fernInst = new THREE.InstancedMesh(fernGeo, fernMat, fernSpots.length);
  const _m = new THREE.Object3D();
  for (let i = 0; i < fernSpots.length; i++) {
    const s = fernSpots[i];
    const gy = evalBaseTerrainY(s.x, s.z);
    _m.position.set(s.x, gy - 0.04, s.z);
    _m.rotation.set((rng() - 0.5) * 0.14, rng() * Math.PI * 2, (rng() - 0.5) * 0.14);
    _m.scale.set(s.sc, s.sc * (0.85 + rng() * 0.35), s.sc);
    _m.updateMatrix();
    fernInst.setMatrixAt(i, _m.matrix);
  }
  fernInst.instanceMatrix.needsUpdate = true;
  fernInst.receiveShadow = true;
  gorgeGroup.add(fernInst);

  // Riverbank Sedge & Wet Roadside Grass Tufts (hugging near rocky riverbank scree & cobble road kerbs!)
  const grassSpots = [];
  const grassCountTarget = isMobile ? 220 : 420;
  for (let i = 0; i < grassCountTarget; i++) {
    const z = 8.0 + rng() * 108.0;
    const rcx = getGorgeRiverCenterX(z);
    const rhw = getGorgeRiverHalfWidth(z);
    const pathX = getGorgePathCenterX(z);
    const mode = rng();
    let x;
    if (mode < 0.54) {
      // Tightly hugging the near (+X) rocky riverbank scree & water margin!
      x = lerp(pathX + 2.35, rcx - rhw + 0.85, rng());
    } else if (mode < 0.78) {
      // Right cobble road kerb (-X) creeping out between damp cobbles & cliff boulders
      x = pathX - (2.05 + rng() * 2.25);
    } else if (mode < 0.88) {
      // Left cobble road kerb (+X) tufting right along the cobbled shoulder
      x = pathX + (2.05 + rng() * 1.25);
    } else {
      // Far riverbank (+X) edge across the water
      x = (rcx + rhw) + (rng() - 0.3) * 2.6;
    }
    const gy = evalBaseTerrainY(x, z);
    if (gy < WATER_LEVEL - 0.10 || gy > 3.2) continue;
    if (Math.abs(x - pathX) < 1.90 && z < 98.0) continue;
    if (Math.hypot(x - GORGE_ANCHORS.bonfirePos.x, z - GORGE_ANCHORS.bonfirePos.z) < 2.0) continue;
    if (Math.hypot(x - GORGE_ANCHORS.camp1Pos.x, z - GORGE_ANCHORS.camp1Pos.z) < 2.0) continue;
    if (Math.hypot(x - GORGE_ANCHORS.camp2Pos.x, z - GORGE_ANCHORS.camp2Pos.z) < 2.0) continue;
    if (Math.hypot(x - (-4.2), z - 88.8) < 2.0) continue;
    grassSpots.push({ x, y: Math.max(gy, WATER_LEVEL - 0.04), z, sc: 0.70 + rng() * 0.78 });
  }
  const grassInst = new THREE.InstancedMesh(grassGeo, riverGrassMat, grassSpots.length);
  for (let i = 0; i < grassSpots.length; i++) {
    const g = grassSpots[i];
    _m.position.set(g.x, g.y - 0.03, g.z);
    _m.rotation.set((rng() - 0.5) * 0.16, rng() * Math.PI * 2, (rng() - 0.5) * 0.16);
    _m.scale.set(g.sc, g.sc * (0.82 + rng() * 0.42), g.sc);
    _m.updateMatrix();
    grassInst.setMatrixAt(i, _m.matrix);
  }
  grassInst.instanceMatrix.needsUpdate = true;
  grassInst.receiveShadow = true;
  gorgeGroup.add(grassInst);

  // Additional Cascading Ivy Curtains draping over Stone Aqueduct Bridge, Upper Chapel & Watchtower!
  const ivyCurtainSpecs = [
    { x: -3.8, y: 5.55, z: 80.18, ry: 0.0, sx: 1.05, sy: 0.95 },
    { x:  2.2, y: 5.55, z: 80.18, ry: 0.0, sx: 1.15, sy: 1.10 },
    { x: -1.2, y: 5.55, z: 83.82, ry: Math.PI, sx: 1.0, sy: 0.85 },
    { x: -7.58, y: 4.92, z: 66.4, ry: Math.PI * 0.5, sx: 1.15, sy: 1.15 },
    { x: -7.58, y: 4.92, z: 61.5, ry: Math.PI * 0.5, sx: 1.05, sy: 0.95 },
    { x: -7.58, y: 4.22, z: 54.6, ry: Math.PI * 0.5, sx: 0.95, sy: 0.85 },
    { x:  5.82, y: 6.10, z: 108.5, ry: Math.PI * 0.5, sx: 1.10, sy: 1.05 },
    { x:  5.82, y: 6.10, z: 114.2, ry: Math.PI * 0.5, sx: 1.05, sy: 0.95 }
  ];
  const ivyInst = new THREE.InstancedMesh(ivyCardGeo, ivyCurtainMat, ivyCurtainSpecs.length);
  for (let i = 0; i < ivyCurtainSpecs.length; i++) {
    const ic = ivyCurtainSpecs[i];
    _m.position.set(ic.x, ic.y, ic.z);
    _m.rotation.set(0, ic.ry, 0);
    _m.scale.set(ic.sx, ic.sy, 1.0);
    _m.updateMatrix();
    ivyInst.setMatrixAt(i, _m.matrix);
  }
  ivyInst.instanceMatrix.needsUpdate = true;
  gorgeGroup.add(ivyInst);

  // --------------------------------------------------------------------------
  // 5. ANIMATED INTERACTIVE REFERENCES (Populated on GLB Load)
  // --------------------------------------------------------------------------
  let shortcutUnlocked = false;
  let shortcutDoorAnim = 0.0;
  let shortcutGateDoorObj = null;
  let shortcutLeverArmObj = null;
  const lanternSwingEntries = [];

  // --------------------------------------------------------------------------
  // 6. ASYNC BLENDER GLB KIT LOADER (`gorge_nature.glb` + `gorge_ruins.glb`)
  // --------------------------------------------------------------------------
  function extractNamedMeshes(gltfScene) {
    const map = new Map();
    gltfScene.traverse((obj) => {
      if (obj.isMesh && obj.name) {
        map.set(obj.name, obj);
        // Strip Blender numeric suffixes if any
        const clean = obj.name.replace(/\.\d+$/, '');
        if (!map.has(clean)) map.set(clean, obj);
      }
    });
    return map;
  }

  function cloneStyledMesh(srcMesh, mat, { castShadow = true, receiveShadow = true } = {}) {
    if (!srcMesh || !srcMesh.geometry) return null;
    const m = new THREE.Mesh(srcMesh.geometry, mat);
    m.castShadow = castShadow;
    m.receiveShadow = receiveShadow;
    return m;
  }

  function createInstancedFromMesh(srcMesh, mat, transforms, { castShadow = true, receiveShadow = true } = {}) {
    if (!srcMesh || !srcMesh.geometry || !transforms.length) return null;
    const inst = new THREE.InstancedMesh(srcMesh.geometry, mat, transforms.length);
    inst.castShadow = castShadow;
    inst.receiveShadow = receiveShadow;
    for (let i = 0; i < transforms.length; i++) {
      const t = transforms[i];
      _m.position.set(t.x, t.y, t.z);
      _m.rotation.set(t.rx || 0, t.ry || 0, t.rz || 0);
      _m.scale.set(t.sx ?? t.s ?? 1, t.sy ?? t.s ?? 1, t.sz ?? t.s ?? 1);
      _m.updateMatrix();
      inst.setMatrixAt(i, _m.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    gorgeGroup.add(inst);
    return inst;
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
          console.warn('[soulsGorgeRoad] Failed to load GLB:', url, err);
          resolve(null);
        }
      );
    });
  }

  const readyPromise = Promise.all([
    pbrTex.readyPromise,
    loadGlb(NATURE_GLB_URL),
    loadGlb(RUINS_GLB_URL)
  ]).then(([, natureGltf, ruinsGltf]) => {
    const natureMap = natureGltf?.scene ? extractNamedMeshes(natureGltf.scene) : new Map();
    const ruinsMap = ruinsGltf?.scene ? extractNamedMeshes(ruinsGltf.scene) : new Map();

    // Register GLB geometries for clean dispose()
    natureMap.forEach((m) => { if (m.geometry) trackGeo(m.geometry); });
    ruinsMap.forEach((m) => { if (m.geometry) trackGeo(m.geometry); });

    // ========================================================================
    // A) NATURE KIT INSTANCING (`gorge_nature.glb`)
    // ========================================================================
    // 1. Gnarled Dead Trees (Foreground Right Hero Tree at (-6.2, 39.0) + Archway Snag at (-5.35, 54.5)!)
    const gnarledMesh = natureMap.get('Gnarled_Dead_Tree');
    const archTreeMesh = natureMap.get('Arch_Dead_Tree');
    if (gnarledMesh) {
      const t1 = cloneStyledMesh(gnarledMesh, barkMat);
      t1.position.set(-5.85, evalBaseTerrainY(-5.85, 39.2) - 0.14, 39.2);
      t1.rotation.set(0.04, 0.72, -0.06);
      t1.scale.setScalar(1.18);
      gorgeGroup.add(t1);
    }
    if (archTreeMesh) {
      const t2 = cloneStyledMesh(archTreeMesh, barkMat);
      t2.position.set(-4.85, evalBaseTerrainY(-4.85, 54.4) - 0.10, 54.4);
      t2.rotation.set(0, 2.25, 0.04);
      t2.scale.setScalar(1.12);
      gorgeGroup.add(t2);

      const t3 = cloneStyledMesh(archTreeMesh, barkMat);
      t3.position.set(-13.2, 5.15, 67.8);
      t3.rotation.set(0, 1.15, -0.05);
      t3.scale.setScalar(1.22);
      gorgeGroup.add(t3);
    }

    // 2. Real Sculpted Nordic Pines (Across-River Cliffs + West Rim Skyline — ZERO cones!)
    const pineATrunk = natureMap.get('Nordic_Pine_A_Trunk');
    const pineAFol = natureMap.get('Nordic_Pine_A_Foliage');
    const pineBTrunk = natureMap.get('Nordic_Pine_B_Trunk');
    const pineBFol = natureMap.get('Nordic_Pine_B_Foliage');

    const pineAXforms = [];
    const pineBXforms = [];
    // Hero pines from topology manifest + rich alpine forest clusters along left riverbank & high cliffs!
    const allPines = [
      ...GORGE_PLACEMENT_MANIFEST.pines.map((p) => ({ x: p.x, z: p.z, ry: p.rotY, s: p.scale, kind: p.asset === 'Gothic_Pine_Tall' ? 'B' : 'A' })),
      // Left across-river iconic framing pines (`frame_00` & `frame_07` top-left silhouettes!)
      { x: 14.2, z: 32.5, ry: 0.6, s: 1.18, kind: 'B' },
      { x: 15.6, z: 41.8, ry: 2.1, s: 1.28, kind: 'A' },
      { x: 19.8, z: 50.5, ry: 1.3, s: 1.42, kind: 'B' },
      { x: 14.9, z: 60.2, ry: 2.7, s: 1.15, kind: 'A' },
      { x: 18.6, z: 69.5, ry: 0.4, s: 1.38, kind: 'B' },
      { x: 15.8, z: 79.0, ry: 1.9, s: 1.24, kind: 'A' },
      { x: 19.2, z: 89.2, ry: 0.8, s: 1.44, kind: 'B' },
      { x: 22.8, z: 99.5, ry: 2.4, s: 1.50, kind: 'B' },
      { x: 24.5, z: 114.0, ry: 1.1, s: 1.55, kind: 'A' },
      // High right-cliff (-X) ridge skyline pines (`frame_07` upper-right!)
      { x: -13.4, z: 49.0, ry: 1.7, s: 1.20, kind: 'B' },
      { x: -14.8, z: 63.0, ry: 0.3, s: 1.28, kind: 'A' },
      { x: -15.4, z: 74.5, ry: 2.2, s: 1.36, kind: 'B' },
      { x: -14.5, z: 85.0, ry: 1.4, s: 1.32, kind: 'A' },
      { x: -12.6, z: 103.5, ry: 0.9, s: 1.26, kind: 'B' },
      { x: -13.8, z: 117.5, ry: 2.6, s: 1.38, kind: 'A' },
      // Distant gorge valley pines fading into blue mist
      { x: 12.0, z: 126.0, ry: 0.5, s: 1.65, kind: 'B' },
      { x: -9.5, z: 128.0, ry: 1.8, s: 1.55, kind: 'B' }
    ];
    for (let i = 0; i < allPines.length; i++) {
      const p = allPines[i];
      const gy = evalBaseTerrainY(p.x, p.z);
      const xf = { x: p.x, y: gy - 0.18, z: p.z, ry: p.ry, s: p.s };
      if (p.kind === 'B') pineBXforms.push(xf);
      else pineAXforms.push(xf);
    }
    createInstancedFromMesh(pineATrunk, barkMat, pineAXforms, { castShadow: true, receiveShadow: true });
    createInstancedFromMesh(pineAFol, pineFoliageMat, pineAXforms, { castShadow: !isMobile, receiveShadow: true });
    createInstancedFromMesh(pineBTrunk, barkMat, pineBXforms, { castShadow: true, receiveShadow: true });
    createInstancedFromMesh(pineBFol, pineFoliageMat, pineBXforms, { castShadow: !isMobile, receiveShadow: true });

    // 3. Stratified Basalt Cliff Walls & Overhangs (`Cliff_Crag_A`, `Cliff_Crag_B`, `Cliff_Overhang_C`)
    //    Carefully positioned cleanly OUTSIDE all walkable elevated paths (Upper Chapel Terrace x=-12.4..-7.8,
    //    Shortcut Gate z=52.0, Grotto x=-13.2..-4.2) so ZERO rock ever clips into walkways or gates!
    const cragA = natureMap.get('Cliff_Crag_A');
    const cragB = natureMap.get('Cliff_Crag_B');
    const overhangC = natureMap.get('Cliff_Overhang_C');
    const cragAXforms = [
      // Right-side (-X) sheer alpine basalt cliffs cleanly west of x = -12.8!
      { x: -16.8, y: evalBaseTerrainY(-16.8, 36.5) - 1.2, z: 36.5, ry:  0.12, sx: 1.25, sy: 1.35, sz: 1.35 },
      { x: -19.2, y: evalBaseTerrainY(-19.2, 48.0) - 1.2, z: 48.0, ry: -0.08, sx: 1.22, sy: 1.45, sz: 1.40 },
      { x: -19.8, y: evalBaseTerrainY(-19.8, 59.5) - 1.2, z: 59.5, ry:  0.06, sx: 1.25, sy: 1.55, sz: 1.45 },
      { x: -20.2, y: evalBaseTerrainY(-20.2, 71.0) - 1.2, z: 71.0, ry: -0.05, sx: 1.28, sy: 1.60, sz: 1.48 },
      { x: -20.6, y: evalBaseTerrainY(-20.6, 86.5) - 1.2, z: 86.5, ry:  0.14, sx: 1.25, sy: 1.55, sz: 1.45 },
      { x: -15.6, y: evalBaseTerrainY(-15.6, 97.5) - 1.2, z: 97.5, ry: -0.18, sx: 1.22, sy: 1.40, sz: 1.35 },
      { x: -16.2, y: evalBaseTerrainY(-16.2, 111.0) - 1.2, z: 111.0, ry: 0.04, sx: 1.25, sy: 1.55, sz: 1.45 },
      // Lower basalt rock face strictly BELOW y = 4.6m dressing the cliff beneath Upper Chapel Terrace (z = 59..78)
      { x: -7.75, y: 0.0, z: 60.8, ry:  0.14, sx: 0.34, sy: 0.34, sz: 0.88 },
      { x: -7.85, y: 0.1, z: 66.8, ry: -0.18, sx: 0.36, sy: 0.36, sz: 0.94 },
      { x: -7.75, y: 0.2, z: 73.2, ry:  0.10, sx: 0.36, sy: 0.39, sz: 0.96 },
      { x: -7.60, y: 0.3, z: 78.4, ry: -0.12, sx: 0.38, sy: 0.40, sz: 0.82 }
    ];
    const cragBXforms = [
      // Far-left (+X) forested cliff terraces across the moonlit river (kept wide & low enough to frame Full Moon + mountains!)
      { x: 21.8, y: evalBaseTerrainY(21.8, 39.0) - 1.8, z: 39.0, ry: Math.PI + 0.18, sx: 1.30, sy: 0.68, sz: 1.35 },
      { x: 21.2, y: evalBaseTerrainY(21.2, 58.0) - 1.8, z: 58.0, ry: Math.PI - 0.12, sx: 1.35, sy: 0.76, sz: 1.40 },
      { x: 21.6, y: evalBaseTerrainY(21.6, 78.0) - 1.8, z: 78.0, ry: Math.PI + 0.10, sx: 1.38, sy: 0.82, sz: 1.42 },
      { x: 23.4, y: evalBaseTerrainY(23.4, 102.0) - 1.8, z: 102.0, ry: Math.PI - 0.14, sx: 1.48, sy: 0.92, sz: 1.48 }
    ];
    const overhangXforms = [
      { x: -10.8, y: 6.20, z: 88.8, ry: 0.08, sx: 1.42, sy: 1.05, sz: 1.52 }
    ];
    createInstancedFromMesh(cragA, cliffRockMat, cragAXforms, { castShadow: true, receiveShadow: true });
    createInstancedFromMesh(cragB, cliffRockMat, cragBXforms, { castShadow: true, receiveShadow: true });
    createInstancedFromMesh(overhangC, cliffRockMat, overhangXforms, { castShadow: true, receiveShadow: true });

    // 4. Sculpted Wet River Boulders, Moss Rocks & Fallen Mossy Logs (`River_Boulder_A/B`, `Moss_Rock_Flat`, `Fallen_Mossy_Log`)
    const boulderA = natureMap.get('River_Boulder_A');
    const boulderB = natureMap.get('River_Boulder_B');
    const mossFlat = natureMap.get('Moss_Rock_Flat');
    const fallenLog = natureMap.get('Fallen_Mossy_Log');

    const bAXforms = [];
    const bBXforms = [];
    const mossFlatXforms = [];

    for (let i = 0; i < GORGE_PLACEMENT_MANIFEST.boulders.length; i++) {
      const b = GORGE_PLACEMENT_MANIFEST.boulders[i];
      const xf = { x: b.x, y: b.y - 0.16, z: b.z, ry: b.rotY, s: b.scale };
      if (b.asset === 'Mossy_Boulder_B' || b.asset === 'Mossy_Boulder_Small') bBXforms.push(xf);
      else bAXforms.push(xf);
    }
    // Iconic submerged river rocks & glossy wet stepping stones along the moonlit river (`frame_00` & `frame_07`!)
    const riverRockSpecs = [
      { z: 34.5, off: -0.65, s: 0.72, kind: 'B' }, { z: 37.2, off: -0.30, s: 0.92, kind: 'A' },
      { z: 39.8, off:  0.15, s: 0.68, kind: 'B' }, { z: 43.2, off: -0.58, s: 0.86, kind: 'A' },
      { z: 46.8, off:  0.40, s: 1.05, kind: 'A' }, { z: 50.5, off: -0.18, s: 0.74, kind: 'B' },
      { z: 54.0, off:  0.52, s: 0.95, kind: 'A' }, { z: 58.6, off: -0.42, s: 0.88, kind: 'A' },
      { z: 62.5, off:  0.22, s: 0.76, kind: 'B' }, { z: 66.2, off: -0.62, s: 0.98, kind: 'A' },
      { z: 70.4, off:  0.35, s: 0.82, kind: 'B' }, { z: 74.8, off: -0.25, s: 1.08, kind: 'A' },
      { z: 79.2, off:  0.48, s: 0.78, kind: 'B' }, { z: 85.4, off: -0.50, s: 0.96, kind: 'A' },
      { z: 91.5, off:  0.18, s: 0.88, kind: 'B' }, { z: 98.0, off: -0.32, s: 1.12, kind: 'A' },
      { z: 105.0, off: 0.25, s: 1.20, kind: 'A' }
    ];
    for (let i = 0; i < riverRockSpecs.length; i++) {
      const rr = riverRockSpecs[i];
      const rcx = getGorgeRiverCenterX(rr.z);
      const rhw = getGorgeRiverHalfWidth(rr.z);
      const x = rcx + rr.off * rhw;
      const xf = { x, y: WATER_LEVEL - 0.22, z: rr.z, ry: (i * 1.73) % 6.28, s: rr.s };
      if (rr.kind === 'A') bAXforms.push(xf);
      else bBXforms.push(xf);
    }
    // Broad flat-topped mossy riverside rock ledges (`frame_00` foreground & `frame_07` riverbank!)
    const mossLedgeSpecs = [
      { x:  2.75, z: 36.4, ry: 0.45, s: 0.95 },
      { x: -4.20, z: 36.2, ry: 1.65, s: 0.88 },
      { x:  4.50, z: 42.4, ry: 2.30, s: 1.05 },
      { x:  3.45, z: 63.8, ry: 0.85, s: 1.12 },
      { x:  3.80, z: 72.4, ry: 2.10, s: 1.02 },
      { x:  4.35, z: 84.8, ry: 1.20, s: 1.15 }
    ];
    for (let i = 0; i < mossLedgeSpecs.length; i++) {
      const ml = mossLedgeSpecs[i];
      mossFlatXforms.push({ x: ml.x, y: evalBaseTerrainY(ml.x, ml.z) - 0.14, z: ml.z, ry: ml.ry, s: ml.s });
    }
    createInstancedFromMesh(boulderA, wetRiverBoulderMat, bAXforms, { castShadow: true, receiveShadow: true });
    createInstancedFromMesh(boulderB, wetRiverBoulderMat, bBXforms, { castShadow: true, receiveShadow: true });
    createInstancedFromMesh(mossFlat, cliffRockMat, mossFlatXforms, { castShadow: true, receiveShadow: true });

    if (fallenLog) {
      const logXforms = GORGE_PLACEMENT_MANIFEST.fallenLogs.map((fl) => ({
        x: fl.x,
        y: fl.y - 0.06,
        z: fl.z,
        ry: fl.rotY,
        s: fl.scale
      }));
      createInstancedFromMesh(fallenLog, barkMat, logXforms, { castShadow: true, receiveShadow: true });
    }

    // 4b. Sculpted 3D Ground-Cover Meshes (`Road_Flagstone_Cluster`, `Riverbank_Scree_Cluster`,
    //     `Cliff_Rubble_Pile`, `Moss_Mound_Cushion`) — breaks up smooth terrain & grounds ruins/roots!
    const groundRng = makeRng(202611259);

    // 4b-1. Grounded Medieval Road Flagstone Clusters (~34 along z = 32.5..95.5, clear of campfire pits)
    const flagstoneCluster = natureMap.get('Road_Flagstone_Cluster');
    if (flagstoneCluster) {
      const FLAGSTONE_COUNT = 34;
      const flagXforms = [];
      for (let i = 0; i < FLAGSTONE_COUNT; i++) {
        const z = lerp(32.5, 95.5, i / (FLAGSTONE_COUNT - 1)) + (groundRng() - 0.5) * 0.34;
        const pathX = getGorgePathCenterX(z);
        const sideSign = (i % 2 === 0) ? 1 : -1;
        let x = pathX + sideSign * (0.20 + groundRng() * 0.70);
        // Keep clear of Campfire 1 & Campfire 2 stone rings
        if (Math.hypot(x - GORGE_ANCHORS.camp1Pos.x, z - GORGE_ANCHORS.camp1Pos.z) < 2.30) {
          x = pathX + 0.75;
        }
        if (Math.hypot(x - GORGE_ANCHORS.camp2Pos.x, z - GORGE_ANCHORS.camp2Pos.z) < 2.30) {
          x = pathX + 0.75;
        }
        if (Math.hypot(x - GORGE_ANCHORS.camp1Pos.x, z - GORGE_ANCHORS.camp1Pos.z) < 2.15) continue;
        if (Math.hypot(x - GORGE_ANCHORS.camp2Pos.x, z - GORGE_ANCHORS.camp2Pos.z) < 2.15) continue;
        const y = evalBaseTerrainY(x, z) - 0.048;
        flagXforms.push({
          x,
          y,
          z,
          ry: groundRng() * Math.PI * 2,
          sx: 0.90 + groundRng() * 0.42,
          sy: 0.62 + groundRng() * 0.20,
          sz: 0.90 + groundRng() * 0.42
        });
      }
      createInstancedFromMesh(flagstoneCluster, ruinStoneDeckMat, flagXforms, { castShadow: false, receiveShadow: true });
    }

    // 4b-2. Interlocking Wet Riverbank Scree Clusters (~48 armoring the entire road-to-river slope z = 26..101!)
    const screeCluster = natureMap.get('Riverbank_Scree_Cluster');
    if (screeCluster) {
      const SCREE_COUNT = 48;
      const screeXforms = [];
      for (let i = 0; i < SCREE_COUNT; i++) {
        const z = lerp(26.0, 101.0, i / (SCREE_COUNT - 1)) + (groundRng() - 0.5) * 0.28;
        const pathX = getGorgePathCenterX(z);
        const rcx = getGorgeRiverCenterX(z);
        const rhw = getGorgeRiverHalfWidth(z);
        const edgeRoad = pathX + 2.55;
        const edgeWater = Math.max(edgeRoad + 0.35, rcx - rhw + 0.35);
        // Hug closer to the waterline along Branch A River Shoal (z=38..58.5) & Zone 0 Ash Gate (z=29..33)
        const inShoalOrGate = (z >= 37.8 && z <= 58.8) || (z >= 29.0 && z <= 33.2);
        const tBank = inShoalOrGate
          ? (0.68 + groundRng() * 0.28)
          : (0.24 + groundRng() * 0.64);
        const x = lerp(edgeRoad, edgeWater, tBank);
        const y = evalBaseTerrainY(x, z) - 0.14;
        const sBase = 0.95 + groundRng() * 0.50;
        screeXforms.push({
          x,
          y,
          z,
          rx: (groundRng() - 0.5) * 0.06,
          // Mesh tapers down from local -Z (high road bank) to local +Z (low waterline), long axis along local X:
          // rotate +90deg around Y so long axis runs along Z shoreline and slope drops cleanly toward +X river!
          ry: Math.PI * 0.5 + (groundRng() - 0.5) * 0.28,
          rz: (groundRng() - 0.5) * 0.06,
          sx: sBase * (0.94 + groundRng() * 0.12),
          sy: sBase * (0.86 + groundRng() * 0.20),
          sz: sBase * (0.94 + groundRng() * 0.12)
        });
      }
      createInstancedFromMesh(screeCluster, wetRiverBoulderMat, screeXforms, { castShadow: true, receiveShadow: true });
    }

    // 4b-3. Grounding Cliff & Architectural Pier Rubble Piles (~20 piles, strictly outside road & doorways!)
    const cliffRubble = natureMap.get('Cliff_Rubble_Pile');
    if (cliffRubble) {
      const rubbleSpecs = [
        // Zone 0 Pilgrim Arch piers
        { x: -4.60, z: 10.60, ry:  0.35, s: 0.92 },
        { x:  4.00, z: 10.60, ry: -0.55, s: 0.90 },
        // Zone 0 Ash Gate piers
        { x: -4.40, z: 31.20, ry:  0.80, s: 0.98 },
        { x:  4.40, z: 31.20, ry: -0.95, s: 0.96 },
        // Twin Fluted Columns pedestals
        { x: -4.90, z: 46.20, ry:  0.42, s: 0.78 },
        { x: -5.30, z: 49.40, ry:  1.85, s: 0.80 },
        // Zone 1 Ancient Archway piers
        { x: -3.40, z: 55.50, ry:  0.22, s: 0.76 },
        { x:  2.20, z: 55.50, ry: -0.40, s: 0.74 },
        // Right cliff foot & Lantern Road ruin bases (clear of road, campfires, shortcut stair & grotto door!)
        { x: -6.80, z: 36.00, ry:  0.50, s: 1.08 },
        { x: -7.20, z: 41.50, ry: -0.30, s: 1.04 },
        { x: -6.10, z: 52.50, ry:  1.10, s: 0.96 },
        { x: -6.60, z: 60.50, ry:  0.15, s: 1.05 },
        { x: -6.75, z: 67.50, ry: -0.65, s: 1.10 },
        { x: -6.65, z: 73.50, ry:  0.90, s: 1.02 },
        { x: -6.50, z: 79.00, ry: -0.25, s: 1.08 },
        { x: -5.45, z: 86.00, ry:  0.60, s: 0.88 },
        { x: -5.80, z: 93.00, ry: -0.45, s: 1.05 },
        { x: -4.40, z: 98.50, ry:  0.75, s: 1.00 },
        // Aqueduct Bridge east pier foot & Bastion approach east base
        { x:  4.65, z: 82.60, ry: -1.20, s: 0.92 },
        { x:  4.90, z: 98.50, ry:  2.10, s: 0.98 }
      ];
      const rubbleXforms = rubbleSpecs.map((r) => ({
        x: r.x,
        y: evalBaseTerrainY(r.x, r.z) - 0.12,
        z: r.z,
        ry: r.ry,
        sx: r.s * (0.94 + groundRng() * 0.14),
        sy: r.s * (0.88 + groundRng() * 0.18),
        sz: r.s * (0.94 + groundRng() * 0.14)
      }));
      createInstancedFromMesh(cliffRubble, cliffRockMat, rubbleXforms, { castShadow: true, receiveShadow: true });
    }

    // 4b-4. Plush Velvety Moss Ground Mounds (~30 around dead tree roots, foreground verges & boulders!)
    const mossMound = natureMap.get('Moss_Mound_Cushion');
    if (mossMound) {
      const mossSpecs = [
        // 4 mounds hugging Gnarled Dead Tree root flare (-5.85, 39.2)
        { x: -5.05, z: 38.40, ry:  0.40, s: 1.08 },
        { x: -6.45, z: 38.60, ry:  1.95, s: 1.15 },
        { x: -5.25, z: 40.10, ry:  3.10, s: 0.96 },
        { x: -6.60, z: 40.00, ry:  4.60, s: 1.10 },
        // 3 mounds hugging Archway Dead Tree root flare (-4.85, 54.4)
        { x: -4.25, z: 53.60, ry:  0.85, s: 0.98 },
        { x: -5.45, z: 54.80, ry:  2.40, s: 1.06 },
        { x: -4.40, z: 55.10, ry:  4.10, s: 0.88 },
        // 9 foreground road verges (z = 33.5..44.5 on both -X and +X shoulders matching frame_00!)
        { x: -3.25, z: 33.80, ry:  0.25, s: 1.05 },
        { x: -3.75, z: 36.00, ry:  1.45, s: 1.12 },
        { x: -4.20, z: 38.20, ry:  2.80, s: 0.95 },
        { x: -4.45, z: 41.20, ry:  4.25, s: 1.08 },
        { x: -4.85, z: 43.80, ry:  5.40, s: 1.00 },
        { x:  2.65, z: 34.40, ry:  0.70, s: 1.04 },
        { x:  2.95, z: 37.50, ry:  2.15, s: 1.14 },
        { x:  3.10, z: 40.60, ry:  3.60, s: 1.02 },
        { x:  2.85, z: 43.60, ry:  5.05, s: 0.96 },
        // 14 mossy cushions along mossy boulders & Lantern Road verges (z = 48..95, clear of road & campfires!)
        { x: -4.35, z: 48.20, ry:  1.15, s: 0.96 },
        { x:  2.60, z: 48.60, ry:  2.65, s: 1.05 },
        { x: -4.15, z: 51.40, ry:  4.05, s: 0.98 },
        { x:  3.55, z: 51.80, ry:  0.55, s: 1.08 },
        { x: -4.55, z: 58.60, ry:  1.80, s: 1.12 },
        { x:  2.45, z: 59.40, ry:  3.35, s: 1.00 },
        { x: -4.85, z: 62.80, ry:  4.90, s: 1.10 },
        { x:  2.35, z: 64.20, ry:  0.95, s: 1.04 },
        { x: -5.10, z: 67.60, ry:  2.30, s: 1.15 },
        { x:  2.10, z: 69.80, ry:  3.80, s: 0.98 },
        { x: -5.25, z: 74.80, ry:  5.20, s: 1.06 },
        { x:  1.85, z: 76.20, ry:  1.40, s: 1.02 },
        { x: -4.75, z: 80.20, ry:  2.95, s: 1.08 },
        { x: -3.20, z: 93.80, ry:  4.45, s: 1.04 }
      ];
      const mossXforms = mossSpecs.map((ms) => ({
        x: ms.x,
        y: evalBaseTerrainY(ms.x, ms.z) - 0.06,
        z: ms.z,
        ry: ms.ry,
        sx: ms.s * (0.92 + groundRng() * 0.22),
        sy: ms.s * (0.85 + groundRng() * 0.26),
        sz: ms.s * (0.92 + groundRng() * 0.22)
      }));
      createInstancedFromMesh(mossMound, mossMoundMat, mossXforms, { castShadow: true, receiveShadow: true });
    }

    // 5. Monumental Eroded Alpine Distant Mountains (`Distant_Mountain_A/B`) framing the far-west horizon (clear of all 8 sectors!)
    const mtnA = natureMap.get('Distant_Mountain_A');
    const mtnB = natureMap.get('Distant_Mountain_B');
    const mtnAXforms = [
      { x: -72.0, y: -3.5, z:  42.0, ry:  0.35, sx: 1.55, sy: 1.75, sz: 1.55 },
      { x: -78.0, y: -3.5, z: 108.0, ry: -0.45, sx: 1.65, sy: 1.85, sz: 1.65 },
      { x: -84.0, y: -2.0, z: 174.0, ry:  1.15, sx: 1.75, sy: 2.05, sz: 1.70 },
      { x: -66.0, y: -4.0, z: -26.0, ry: -1.10, sx: 1.50, sy: 1.60, sz: 1.45 }
    ];
    const mtnBXforms = [
      { x: -94.0, y: -3.0, z:  76.0, ry:  0.18, sx: 1.85, sy: 2.15, sz: 1.75 },
      { x: -98.0, y: -2.0, z: 146.0, ry: -0.28, sx: 1.95, sy: 2.35, sz: 1.85 },
      { x: -92.0, y:  0.0, z: 228.0, ry:  0.62, sx: 2.05, sy: 2.45, sz: 1.90 }
    ];
    createInstancedFromMesh(mtnA, distantMountainMat, mtnAXforms, { castShadow: false, receiveShadow: false });
    createInstancedFromMesh(mtnB, distantMountainMat, mtnBXforms, { castShadow: false, receiveShadow: false });

    // ========================================================================
    // B) MEDIEVAL RUINS & PROPS KIT (`gorge_ruins.glb`)
    // ========================================================================
    // 0. Sculpted Zone 0 Architectural Gates (`Zone0_Ash_Gate_Stone` & `Zone0_Pilgrim_Arch_Stone`)
    const zone0AshGate = ruinsMap.get('Zone0_Ash_Gate_Stone');
    const zone0AshGateIvy = ruinsMap.get('Zone0_Ash_Gate_Ivy');
    const zone0AshGateIron = ruinsMap.get('Zone0_Ash_Gate_Iron');
    const ashGateY = evalBaseTerrainY(0.0, 31.0) - 0.06;
    if (zone0AshGate) {
      const m = cloneStyledMesh(zone0AshGate, zone0GateMat, { castShadow: true, receiveShadow: true });
      m.position.set(0.0, ashGateY, 31.0);
      gorgeGroup.add(m);
    }
    if (zone0AshGateIvy) {
      const mIvy = cloneStyledMesh(zone0AshGateIvy, ivyArchMat, { castShadow: false, receiveShadow: true });
      mIvy.position.set(0.0, ashGateY, 31.0);
      gorgeGroup.add(mIvy);
    }
    if (zone0AshGateIron) {
      const mIron = cloneStyledMesh(zone0AshGateIron, forgedIronMat, { castShadow: true, receiveShadow: true });
      mIron.position.set(0.0, ashGateY, 31.0);
      gorgeGroup.add(mIron);
    }

    const zone0PilgrimArch = ruinsMap.get('Zone0_Pilgrim_Arch_Stone');
    const zone0PilgrimArchIvy = ruinsMap.get('Zone0_Pilgrim_Arch_Ivy');
    const pilgrimArchY = evalBaseTerrainY(-0.30, 10.60) - 0.06;
    if (zone0PilgrimArch) {
      const m = cloneStyledMesh(zone0PilgrimArch, zone0GateMat, { castShadow: true, receiveShadow: true });
      m.position.set(-0.30, pilgrimArchY, 10.60);
      gorgeGroup.add(m);
    }
    if (zone0PilgrimArchIvy) {
      const mIvy = cloneStyledMesh(zone0PilgrimArchIvy, ivyArchMat, { castShadow: false, receiveShadow: true });
      mIvy.position.set(-0.30, pilgrimArchY, 10.60);
      gorgeGroup.add(mIvy);
    }

    // 1. Iconic Zone 1 Ancient Ivy-Draped Ruined Stone Archway (`-0.60, y, 55.50`, exact 4.60m clear road!)
    const archStone = ruinsMap.get('Ancient_Archway_Stone');
    const archIvy = ruinsMap.get('Ancient_Archway_Ivy');
    const archY = evalBaseTerrainY(-0.60, 55.50);
    if (archStone) {
      const m = cloneStyledMesh(archStone, ruinStoneMat);
      m.position.set(-0.60, archY - 0.12, 55.50);
      gorgeGroup.add(m);
    }
    if (archIvy) {
      const ivyM = cloneStyledMesh(archIvy, ivyArchMat, { castShadow: false, receiveShadow: true });
      ivyM.position.set(-0.60, archY - 0.12, 55.50);
      gorgeGroup.add(ivyM);
    }

    // 2. Monumental Overhead Stone Aqueduct Bridge (`z = 82.0, exact deck Y = 5.600m!`)
    const bridgeBay = ruinsMap.get('Stone_Arch_Bridge_Bay');
    if (bridgeBay) {
      const bayCenter = cloneStyledMesh(bridgeBay, ruinStoneMat);
      // Blender deck sits at exact Y = 5.600 when positioned at y = 0.000!
      bayCenter.position.set(-0.90, 0.0, 82.0);
      gorgeGroup.add(bayCenter);
    }

    // 3. Twin Fluted Columns (Zone 1 — heroically visible right beside Campfire 1 matching frame_00!) & Zone 2 Banner Column
    const colTall = ruinsMap.get('Ruined_Column_Tall');
    const colBroken = ruinsMap.get('Ruined_Column_Broken');
    if (colTall) {
      const colTallXforms = [
        { x: -4.85, y: evalBaseTerrainY(-4.85, 46.20) - 0.08, z: 46.20, ry: 0.25, s: 1.08 },
        { x: -3.20, y: 2.65, z: 109.50, ry: 0.0, sx: 0.72, sy: 0.62, sz: 0.72 },
        { x: -3.20, y: 2.65, z: 115.80, ry: 0.0, sx: 0.72, sy: 0.62, sz: 0.72 }
      ];
      createInstancedFromMesh(colTall, ruinStoneMat, colTallXforms, { castShadow: true, receiveShadow: true });
    }
    if (colBroken) {
      const colBrokenXforms = [
        { x: -5.25, y: evalBaseTerrainY(-5.25, 49.40) - 0.08, z: 49.40, ry: -0.40, s: 1.02 },
        { x: -6.15, y: evalBaseTerrainY(-6.15, 73.10) - 0.08, z: 73.10, ry: 0.85, s: 1.02 }
      ];
      createInstancedFromMesh(colBroken, ruinStoneMat, colBrokenXforms, { castShadow: true, receiveShadow: true });
    }

    // 4. Ruined Chapel Arches (Branch B Upper Chapel Terrace, Branch C Grotto Entry/Exit, Bastion Entry)
    const chapelArch = ruinsMap.get('Ruined_Chapel_Arch');
    if (chapelArch) {
      const chapelXforms = [
        { x: -8.00, y: 4.90, z: 66.50, ry: Math.PI * 0.5, s: 1.00 },
        { x: -8.00, y: 4.90, z: 61.50, ry: Math.PI * 0.5, s: 1.00 },
        { x: -8.00, y: 4.20, z: 55.20, ry: Math.PI * 0.5, s: 0.92 },
        // Branch C Grotto Entrance Archway on Lantern Road (-X cliff face!)
        { x: -4.25, y: 1.45, z: 88.80, ry: Math.PI * 0.5, s: 1.04 },
        // Branch C Grotto Upper Exit Archway onto Aqueduct Bridge
        { x: -5.70, y: 5.60, z: 83.75, ry: 0.0, s: 0.95 },
        // Zone 3 Watchtower Bastion Grand Entry Archway (scaled wide to 5.9m clear opening!)
        { x:  1.15, y: 2.55, z: 99.20, ry: 0.0, sx: 1.62, sy: 1.45, sz: 1.35 }
      ];
      createInstancedFromMesh(chapelArch, ruinStoneMat, chapelXforms, { castShadow: true, receiveShadow: true });
    }

    // 5. Towering Ruined Watchtower Turrets & Crumbled Rampart Walls (Zone 3)
    const turretMesh = ruinsMap.get('Watchtower_Turret_Ruined');
    if (turretMesh) {
      const turretXforms = [
        { x: 6.45, y: 2.45, z: 107.40, ry: -0.40, s: 1.12 },
        { x: 6.30, y: 2.45, z: 115.80, ry:  0.35, s: 1.18 },
        // Distant ruined fortress tower silhouette on far left cliff crag (matches `frame_07` distant ruin!)
        { x: 13.8, y: evalBaseTerrainY(13.8, 92.0) - 0.5, z: 92.0, ry: 0.85, s: 1.22 }
      ];
      createInstancedFromMesh(turretMesh, ruinStoneMat, turretXforms, { castShadow: true, receiveShadow: true });
    }
    const ruinWall = ruinsMap.get('Ruined_Wall_Section');
    if (ruinWall) {
      const wallXforms = [
        { x: 12.6, y: evalBaseTerrainY(12.6, 89.2) - 0.5, z: 89.2, ry: 0.52, s: 1.15 },
        { x: 14.5, y: evalBaseTerrainY(14.5, 95.5) - 0.5, z: 95.5, ry: -0.35, s: 1.10 }
      ];
      createInstancedFromMesh(ruinWall, ruinStoneMat, wallXforms, { castShadow: true, receiveShadow: true });
    }

    // 6. Interactive One-Way Iron Shortcut Gate & Ratchet Lever on Upper Chapel Terrace!
    const gateFrame = ruinsMap.get('Iron_Shortcut_Gate_Frame');
    const gateDoor = ruinsMap.get('Iron_Shortcut_Gate_Door');
    const leverBase = ruinsMap.get('Shortcut_Lever_Base');
    const leverArm = ruinsMap.get('Shortcut_Lever_Arm');
    const gatePos = GORGE_ANCHORS.shortcutGatePos;
    if (gateFrame) {
      const gf = cloneStyledMesh(gateFrame, ruinStoneMat);
      gf.position.set(gatePos.x, gatePos.y, gatePos.z);
      gorgeGroup.add(gf);
    }
    if (gateDoor) {
      // Blender node pivot is at exact left hinge (-1.22, 0, 0) in frame local space!
      const gd = cloneStyledMesh(gateDoor, forgedIronMat);
      gd.position.set(gatePos.x - 1.22, gatePos.y, gatePos.z);
      gorgeGroup.add(gd);
      shortcutGateDoorObj = gd;
    }
    if (leverBase) {
      const lb = cloneStyledMesh(leverBase, forgedIronMat);
      lb.position.set(-11.20, gatePos.y, 53.50);
      lb.rotation.y = Math.PI * 0.5;
      gorgeGroup.add(lb);
    }
    if (leverArm) {
      const laPivot = new THREE.Group();
      laPivot.position.set(-11.20, gatePos.y + 0.34, 53.50);
      laPivot.rotation.y = Math.PI * 0.5;
      const la = cloneStyledMesh(leverArm, forgedIronMat);
      laPivot.add(la);
      gorgeGroup.add(laPivot);
      shortcutLeverArmObj = la;
    }

    // 7. Curving Timber Gallows Lanterns (Zone 2 Lantern Road — `frame_07`!) & Wall Bracket Lanterns!
    const galWood = ruinsMap.get('Timber_Gallows_Lantern_Wood');
    const galIron = ruinsMap.get('Timber_Gallows_Lantern_Iron');
    const galGlass = ruinsMap.get('Timber_Gallows_Lantern_Glass');
    const wallWood = ruinsMap.get('Wall_Bracket_Lantern_Wood');
    const wallIron = ruinsMap.get('Wall_Bracket_Lantern_Iron');
    const wallGlass = ruinsMap.get('Wall_Bracket_Lantern_Glass');

    for (let i = 0; i < GORGE_PLACEMENT_MANIFEST.timberLanterns.length; i++) {
      const lp = GORGE_PLACEMENT_MANIFEST.timberLanterns[i];
      const grp = new THREE.Group();
      grp.position.set(lp.x, lp.y - 0.08, lp.z);
      grp.rotation.y = lp.rotY;
      if (galWood) grp.add(cloneStyledMesh(galWood, timberWoodMat));
      if (galIron) grp.add(cloneStyledMesh(galIron, forgedIronMat));
      if (galGlass) grp.add(cloneStyledMesh(galGlass, lanternGlassMat, { castShadow: false, receiveShadow: false }));
      gorgeGroup.add(grp);
      // Compute world lantern glass position (+0.94 local X, +2.98 local Y) for warm halo & wet road pool!
      const lx = lp.x + Math.cos(lp.rotY) * 0.94;
      const lz = lp.z - Math.sin(lp.rotY) * 0.94;
      addLanternGlowSprite(lx, lp.y + 2.90, lz, 1.85);
      addWarmGroundPool(lx, lz, 3.8, [1.08, 0.56, 0.16], 0.30, alwaysOneUniform, lx * 0.8 + lz * 0.5);
    }

    // Wall Bracket Lanterns (Archway right jamb matching `frame_00`, Upper Chapel overhang beacon, Grotto doorway & switchback!)
    const wallLanternSpecs = [
      { x: -2.42, y: archY + 3.65, z: 54.65, ry: 0.0, sc: 1.05 }, // Archway right jamb (`frame_00` exact lantern!)
      { x: -7.65, y: 6.95, z: 64.00, ry: 0.0, sc: 1.15 },         // Upper Chapel Overhang sightline lantern
      { x: -4.25, y: 3.45, z: 87.35, ry: 0.0, sc: 1.00 },         // Grotto entrance south jamb
      { x: -4.25, y: 3.45, z: 90.25, ry: 0.0, sc: 1.00 },         // Grotto entrance north jamb
      { x: -13.15, y: 5.45, z: 86.80, ry: 0.0, sc: 1.00 },        // Grotto mid-stair landing
      { x: -8.35, y: 4.55, z: 111.00, ry: 0.0, sc: 1.00 }         // Watchtower Crypt Nook
    ];
    for (let i = 0; i < wallLanternSpecs.length; i++) {
      const wl = wallLanternSpecs[i];
      const grp = new THREE.Group();
      grp.position.set(wl.x, wl.y, wl.z);
      grp.rotation.y = wl.ry;
      grp.scale.setScalar(wl.sc);
      if (wallWood) grp.add(cloneStyledMesh(wallWood, timberWoodMat));
      if (wallIron) grp.add(cloneStyledMesh(wallIron, forgedIronMat));
      if (wallGlass) grp.add(cloneStyledMesh(wallGlass, lanternGlassMat, { castShadow: false, receiveShadow: false }));
      gorgeGroup.add(grp);
      const gx = wl.x + Math.cos(wl.ry) * 0.78 * wl.sc;
      const gz = wl.z - Math.sin(wl.ry) * 0.78 * wl.sc;
      addLanternGlowSprite(gx, wl.y - 0.38 * wl.sc, gz, 1.55 * wl.sc);
    }

    // 8. Sculpted Campfire Rings & Split Logs, Weathered Plank Piles, Crimson War Banners
    const cfStones = ruinsMap.get('Campfire_Stones');
    const cfLogs = ruinsMap.get('Campfire_Logs');
    const cfAshMound = ruinsMap.get('Campfire_Ash_Mound');
    const cfXforms = GORGE_PLACEMENT_MANIFEST.campfires.map((cf) => ({
      x: cf.x,
      y: cf.y - 0.02,
      z: cf.z,
      ry: cf.rotY,
      s: cf.scale
    }));
    createInstancedFromMesh(cfStones, cliffRockMat, cfXforms, { castShadow: true, receiveShadow: true });
    createInstancedFromMesh(cfLogs, barkMat, cfXforms, { castShadow: true, receiveShadow: true });
    if (cfAshMound) {
      createInstancedFromMesh(cfAshMound, cliffRockMat, cfXforms, { castShadow: false, receiveShadow: true });
    }

    const plankPile = ruinsMap.get('Weathered_Plank_Pile');
    if (plankPile) {
      const plankXforms = [
        // Hero broken planks scattered diagonally across wet cobblestones in `frame_00`!
        { x: -1.75, y: evalBaseTerrainY(-1.75, 36.6) - 0.01, z: 36.6, ry: 0.42, s: 1.15 },
        { x: -1.95, y: evalBaseTerrainY(-1.95, 42.4) - 0.01, z: 42.4, ry: -0.68, s: 0.95 },
        ...GORGE_PLACEMENT_MANIFEST.planks.map((p) => ({ x: p.x, y: p.y - 0.01, z: p.z, ry: p.rotY, s: p.scale }))
      ];
      createInstancedFromMesh(plankPile, timberWoodMat, plankXforms, { castShadow: true, receiveShadow: true });
    }

    const bannerPole = ruinsMap.get('Banner_Pole_Wood');
    const bannerCloth = ruinsMap.get('Banner_Cloth');
    if (bannerPole && bannerCloth) {
      const bannerSpecs = [
        { x: -5.25, y: evalBaseTerrainY(-5.25, 72.4) - 0.05, z: 72.4, ry: 0.45, s: 1.0 },
        { x:  4.65, y: evalBaseTerrainY( 4.65, 99.2) - 0.05, z: 99.2, ry: 0.0,  s: 1.12 },
        { x: -2.35, y: evalBaseTerrainY(-2.35, 99.2) - 0.05, z: 99.2, ry: 0.0,  s: 1.12 },
        { x:  0.80, y: 5.65, z: 119.1, ry: Math.PI, s: 1.05 }
      ];
      createInstancedFromMesh(bannerPole, timberWoodMat, bannerSpecs, { castShadow: true, receiveShadow: true });
      createInstancedFromMesh(bannerCloth, crimsonBannerMat, bannerSpecs, { castShadow: true, receiveShadow: true });
    }

    // 9. Smashable AAA Wooden Crates & 4-Hoop Oak Barrels (registered into `destructibleProps`!)
    const crateMeshSrc = ruinsMap.get('Wooden_Crate_AAA');
    const barrelMeshSrc = ruinsMap.get('Oak_Barrel_AAA');
    const smashSpecs = [
      ...GORGE_PLACEMENT_MANIFEST.crates.map((c) => ({ ...c, kind: 'crate' })),
      ...GORGE_PLACEMENT_MANIFEST.barrels.map((b) => ({ ...b, kind: 'barrel' })),
      // Extra props framing Campfire 1 & Campfire 2 just like `frame_00` & `frame_07`!
      { x: -4.25, y: evalBaseTerrainY(-4.25, 45.8), z: 45.8, rotY: 0.22, scale: 0.96, kind: 'crate' },
      { x: -4.85, y: evalBaseTerrainY(-4.85, 69.6), z: 69.6, rotY: 0.48, scale: 0.96, kind: 'crate' },
      { x: -5.15, y: evalBaseTerrainY(-5.15, 68.4), z: 68.4, rotY: 1.15, scale: 0.96, kind: 'barrel' }
    ];
    for (let i = 0; i < smashSpecs.length; i++) {
      const sp = smashSpecs[i];
      const src = sp.kind === 'barrel' ? barrelMeshSrc : crateMeshSrc;
      if (!src) continue;
      const m = cloneStyledMesh(src, timberWoodMat);
      m.position.set(sp.x, sp.y - 0.02, sp.z);
      m.rotation.y = sp.rotY || 0;
      m.scale.setScalar(sp.scale || 1.0);
      gorgeGroup.add(m);
      if (Array.isArray(destructibleProps)) {
        destructibleProps.push({ x: sp.x, y: sp.y, z: sp.z, r: 0.54, broken: false, mesh: m });
      }
    }

    // Apply current shortcut door pose if already unlocked before GLB finished loading
    applyShortcutVisuals();
    return true;
  });

  function applyShortcutVisuals() {
    const t = clamp(shortcutDoorAnim, 0, 1);
    const ease = 1.0 - Math.pow(1.0 - t, 3.0);
    if (shortcutGateDoorObj) {
      // Swing wrought-iron gate cleanly inward (+Z) by 108 degrees on its exact Blender hinge!
      shortcutGateDoorObj.rotation.y = -ease * 1.88;
    }
    if (shortcutLeverArmObj) {
      // Throw medieval iron lever forward by 72 degrees through the ratchet slot!
      shortcutLeverArmObj.rotation.x = ease * 1.26;
    }
  }

  function setShortcutUnlocked(unlocked, instant = false) {
    shortcutUnlocked = Boolean(unlocked);
    if (instant) {
      shortcutDoorAnim = shortcutUnlocked ? 1.0 : 0.0;
    }
    applyShortcutVisuals();
  }

  function setLowSpec(flag) {
    campfireRig.setLowSpec(Boolean(flag));
  }

  function update(dt = 0.016, elapsed = 0, camPos = null) {
    const safeDt = Math.min(Math.max(Number.isFinite(dt) ? dt : 0.016, 0.001), 0.1);
    const t = Number.isFinite(elapsed) ? elapsed : 0.0;

    // Update smoky roaring campfires (billowing smoke plumes, molten embers, flames, sparks)
    campfireRig.update(t);

    // Smooth one-way Iron Shortcut Gate & Lever animation
    const targetAnim = shortcutUnlocked ? 1.0 : 0.0;
    if (Math.abs(shortcutDoorAnim - targetAnim) > 0.001) {
      const step = safeDt * 1.15;
      shortcutDoorAnim = shortcutDoorAnim < targetAnim
        ? Math.min(targetAnim, shortcutDoorAnim + step)
        : Math.max(targetAnim, shortcutDoorAnim - step);
      applyShortcutVisuals();
    }

    // Gentle organic flicker on lantern & campfire warm glow halos
    for (let i = 0; i < warmSprites.length; i++) {
      const ws = warmSprites[i];
      const pulse = 0.90 + 0.10 * Math.sin(t * 7.2 + ws.phase) + 0.05 * Math.cos(t * 15.4 + ws.phase * 1.7);
      const sc = ws.baseScale * pulse;
      ws.sprite.scale.set(sc, sc, 1);
    }
  }

  return {
    gorgeGroup,
    campfireRig,
    readyPromise,
    setShortcutUnlocked,
    isShortcutUnlocked: () => shortcutUnlocked,
    setLowSpec,
    update
  };
}
