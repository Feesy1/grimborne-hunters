// Grimborne Hunters — Sector 01 Vertical Slice («01 • Выход из водоотвода», z105)
// Handcrafted, metric-locked dark-fantasy tutorial shore with:
//   - Real matte PBR stoneware & terrain (ZERO glossy photo-paper glare, ZERO fake orange ground paint)
//   - 5 stationary physical PointLights (ZERO flashlight snapping/popping on hero!)
//   - High-detail Blender 4.5.9 sculpted architecture & hero-scale props (`sector01_arch.glb`, `sector01_props.glb`)
//   - Single-Source-of-Truth collision registry (EVERY wall, pillar, lantern, brazier, bonfire, boat, boulder,
//     tree trunk, and unbroken barrel/crate blocks movement; smashing any barrel/crate clears its collider live!)
//   - Depth-aware translucent river shoreline + realistic streaming outfall waterfall + live wading ripples & splashes!

import { createMossCoatedStoneMaterial } from './soulsGorgeTerrainMat.js?v=20261125z105';
import { createGorgeRiverMaterial } from './soulsGorgeAtmosphere.js?v=20261125z105';

export const SECTOR01_ASSET_VER = '20261125z105';
export const SECTOR01_WATER_LEVEL = -0.10;

const ARCH_GLB_URL = `./assets/env/sector01_arch.glb?v=${SECTOR01_ASSET_VER}`;
const PROPS_GLB_URL = `./assets/env/sector01_props.glb?v=${SECTOR01_ASSET_VER}`;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(edge0, edge1, x) {
  const d = edge1 - edge0;
  if (Math.abs(d) < 1e-6) return x >= edge1 ? 1.0 : 0.0;
  const t = clamp01((x - edge0) / d);
  return t * t * (3.0 - 2.0 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hash21(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function vnoise2(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3.0 - 2.0 * fx);
  const uz = fz * fz * (3.0 - 2.0 * fz);
  const a = hash21(ix, iz);
  const b = hash21(ix + 1, iz);
  const c = hash21(ix, iz + 1);
  const d = hash21(ix + 1, iz + 1);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uz);
}

// ============================================================================
// 1. Single-Source-of-Truth Sector 01 Analytical Terrain & Shoreline Curves
//    Guaranteed exact 0.000m at wakePos (0, 2.5)!
// ============================================================================
export function getSector01PathX(z) {
  const pz = Number.isFinite(z) ? z : 2.5;
  const t1 = smoothstep(2.5, 15.5, pz);
  const t2 = smoothstep(15.5, 30.0, pz);
  const mid = lerp(0.0, -0.85, t1);
  return lerp(mid, 0.0, t2) + Math.sin((pz - 2.5) * 0.18) * 0.28 * (1.0 - smoothstep(25.0, 31.0, pz));
}

// Organic curving river waterline edge (where terrain smoothly crosses WATER_LEVEL = -0.10m)
export function getSector01ShorelineX(z) {
  const pz = Number.isFinite(z) ? z : 2.5;
  // Wide outfall plunge pool near z = -14..-4, gentle shore spit around z = 14..23 for Fisherman's Skiff
  const poolRecess = (1.0 - smoothstep(-10.0, 0.5, pz)) * -3.4;
  const spitBulge = smoothstep(9.0, 16.5, pz) * (1.0 - smoothstep(21.5, 29.0, pz)) * 2.55;
  const meander = Math.sin(pz * 0.14 + 0.5) * 0.65 + Math.cos(pz * 0.29 - 0.8) * 0.28;
  return 5.65 + poolRecess + spitBulge + meander;
}

function evalSector01TerrainRawY(x, z) {
  const px = Number.isFinite(x) ? x : 0.0;
  const pz = Number.isFinite(z) ? z : 2.5;
  const pathX = getSector01PathX(pz);
  const shoreX = getSector01ShorelineX(pz);

  // Gentle natural pilgrim road climb from landing shore (0.00m at z=2.5) to Ash Gatehouse (+0.58m at z=31),
  // continuing smoothly up into the distant misty northern gorge beyond the closed portcullis (z = 32..70)
  const northRise = smoothstep(2.5, 31.5, pz) * 0.58 + smoothstep(32.0, 68.0, pz) * 2.25;

  // Solid basalt mountain ridge behind the Outfall Arch (z < -16.5) so Castle of Ash sits on real mountain rock!
  const southMountainBack = smoothstep(-16.0, -29.0, pz) * 11.5;

  // Outfall plunge pool basin (z = -14..-4.5, centered at x = 0.0)
  const poolDist = Math.hypot(px * 0.86, pz + 10.2);
  const poolBasin = (1.0 - smoothstep(2.4, 7.6, poolDist)) * -1.05;

  // Natural gently sloping East riverbank (5.5m wide beach -> shallow wading water -> deep river channel!)
  const riverDepthDrop = smoothstep(shoreX - 3.2, shoreX + 7.8, px) * -1.62;
  // Far East river mountain bank rising back up across the water (x = +16..+28)
  const farEastBankRise = smoothstep(shoreX + 9.5, shoreX + 18.5, px) * 6.8;

  // West dark basalt canyon cliff wall rising organically outside the walkable sanctuary (x < -6.8)
  const cliffInset = -6.85 - smoothstep(11.0, 18.0, pz) * (1.0 - smoothstep(20.0, 26.5, pz)) * 1.15;
  const westCliffRise =
    smoothstep(cliffInset, cliffInset - 6.5, px) * 3.8 +
    smoothstep(cliffInset - 4.5, cliffInset - 14.5, px) * 7.2;

  // Subtle organic ground undulation (suppressed on flat road crown & bonfire sanctuary alcove)
  const roadCore = 1.0 - smoothstep(1.8, 4.2, Math.abs(px - pathX));
  const bonfireFlat = 1.0 - smoothstep(1.6, 3.8, Math.hypot(px - (-2.30), pz - 16.0));
  const flatFactor = Math.max(roadCore * 0.72, bonfireFlat * 0.92);
  const microBump =
    (Math.sin(px * 0.52 + pz * 0.34) * 0.045 + Math.cos(px * 0.88 - pz * 0.62) * 0.025) *
    (1.0 - flatFactor);

  // Subtle raised road crown along z = 8..68 so the cobbled pilgrim road sits cleanly proud of roadside earth
  const roadCrown = roadCore * smoothstep(5.5, 11.5, pz) * 0.08;

  return northRise + southMountainBack + roadCrown + poolBasin + riverDepthDrop + farEastBankRise + westCliffRise + microBump;
}

const _WAKE_Y_OFFSET = evalSector01TerrainRawY(0.0, 2.5);

export function evalSector01TerrainY(x, z) {
  return evalSector01TerrainRawY(x, z) - _WAKE_Y_OFFSET;
}

export function evalSector01SurfaceType(x, z) {
  const px = Number.isFinite(x) ? x : 0.0;
  const pz = Number.isFinite(z) ? z : 2.5;
  const y = evalSector01TerrainY(px, pz);
  if (y < SECTOR01_WATER_LEVEL + 0.04) return 'shallow_water';
  const pathX = getSector01PathX(pz);
  const dPath = Math.abs(px - pathX);
  if (pz >= 8.2 && dPath <= 2.75) return 'stone_courtyard';
  if (y < SECTOR01_WATER_LEVEL + 0.24) return 'wet_stone';
  return 'gravel';
}

export const SECTOR01_ANCHORS = Object.freeze({
  wakePos: Object.freeze({ x: 0.0, y: 0.0, z: 2.5 }),
  swordPos: Object.freeze({ x: 2.65, y: evalSector01TerrainY(2.65, 5.40), z: 5.40 }),
  bonfirePos: Object.freeze({ x: -2.30, y: evalSector01TerrainY(-2.30, 16.00), z: 16.00 }),
  gatePos: Object.freeze({ x: 0.0, y: evalSector01TerrainY(0.0, 30.20), z: 30.20 }),
  shaftCenter: Object.freeze({ x: 0.0, y: 0.0, z: 0.0 }),
  gratePos: Object.freeze({ x: 0.0, y: 1.8, z: 26.0 })
});

export const SECTOR01_INTERACTABLES = Object.freeze([
  Object.freeze({
    id: 'shore_bonfire',
    type: 'bonfire',
    x: SECTOR01_ANCHORS.bonfirePos.x,
    y: SECTOR01_ANCHORS.bonfirePos.y,
    z: SECTOR01_ANCHORS.bonfirePos.z,
    layer: 'main',
    radius: 2.35,
    title: 'Костёр Берега',
    prompt: 'Зажечь Костёр Берега (Чекпоинт)',
    litPrompt: 'Отдохнуть у Костра Берега'
  }),
  Object.freeze({
    id: 'ash_gorge_gate',
    type: 'locked_gate',
    x: 0.0,
    y: evalSector01TerrainY(0.0, 29.8),
    z: 29.8,
    layer: 'main',
    radius: 2.85,
    title: 'Врата Пепельного Ущелья',
    prompt: 'Осмотреть Врата Пепельного Ущелья',
    lockedPrompt: 'Врата запечатаны. Дальнейший путь откроется после приёмки Сектора 01.'
  })
]);

// ============================================================================
// 2. Handcrafted Sector 01 Vertical Slice 3D Builder
// ============================================================================
export function createSoulsSector01Slice(THREE, opts = {}) {
  const {
    parentGroup = null,
    gltfLoader = null,
    pbrTex = null,
    terrainMat = null,
    uTimeUniform = null,
    uBonfireLitUniform = null,
    mistSpriteTex = null,
    rustedGrateMat = null,
    isMobile = false,
    lowSpecMode = false,
    trackGeo = (g) => g,
    trackMat = (m) => m,
    regNormalMat = null
  } = opts;

  const group = new THREE.Group();
  group.name = 'Sector01VerticalSliceGroup';
  if (parentGroup) parentGroup.add(group);

  const sharedTime = uTimeUniform || { value: 0.0 };
  const sharedBonfireLit = uBonfireLitUniform || { value: 0.0 };

  const ownedGeos = [];
  const ownedMats = [];
  const regGeo = (g) => {
    ownedGeos.push(g);
    return typeof trackGeo === 'function' ? trackGeo(g) : g;
  };
  const regMat = (m) => {
    ownedMats.push(m);
    return typeof trackMat === 'function' ? trackMat(m) : m;
  };

  // ==========================================================================
  // A. SINGLE-SOURCE-OF-TRUTH COLLISION REGISTRY (Populated directly as meshes are placed!)
  // ==========================================================================
  const staticCircleColliders = []; // { id, x, z, r }
  const destructibleProps = [];     // { id, x, y, z, r, broken, mesh, kind }

  function registerStaticCircle(id, x, z, r) {
    staticCircleColliders.push({ id, x, z, r });
  }

  // Register a line of overlapping circle colliders along a rotated footprint (e.g., boat hull or wall wing!)
  function registerCapsuleColliders(id, cx, cz, halfLen, rotY, r, count = 3) {
    const dirX = Math.cos(rotY);
    const dirZ = -Math.sin(rotY);
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : (i / (count - 1)) * 2.0 - 1.0;
      staticCircleColliders.push({
        id: `${id}_${i}`,
        x: cx + dirX * halfLen * t,
        z: cz + dirZ * halfLen * t,
        r
      });
    }
  }

  // Master Sector 01 Clamper — guarantees hero NEVER walks through walls, pillars, lanterns, braziers,
  // bonfire, boat, boulders, tree trunks, or unbroken crates/barrels, AND wades cleanly up to shin depth!
  const _clampOut = { x: 0, z: 2.5, y: 0, layer: 'main', surface: 'gravel' };

  function clampPosition(x, z, r = 0.50, out = null) {
    let px = Number.isFinite(x) ? x : 0.0;
    let pz = Number.isFinite(z) ? z : 2.5;
    const rad = Number.isFinite(r) ? Math.max(0.20, r) : 0.50;

    // 1. North Gatehouse Portcullis wall & South Outfall Plunge-Pool limits
    if (pz > 30.25 - rad) pz = 30.25 - rad;
    if (pz < -5.60 + rad) pz = -5.60 + rad;

    // 2. West Basalt Canyon Cliff slope boundary (smoothly matches visual cliff foot!)
    const westLimit = -6.95 - smoothstep(11.0, 18.0, pz) * (1.0 - smoothstep(20.0, 26.5, pz)) * 0.95;
    if (px < westLimit + rad) px = westLimit + rad;

    // 3. East Deep River Water boundary: allow organic wading into shin-deep water (y >= -0.32m),
    //    smoothly block walking out into deep dark channel!
    const shoreX = getSector01ShorelineX(pz);
    const maxWadeX = shoreX + 1.85;
    if (px > maxWadeX - rad) px = maxWadeX - rad;
    // Also keep hero out of the roaring waterfall plunge basin directly under the outfall arch
    const poolDx = px * 0.88;
    const poolDz = pz + 10.2;
    const poolD = Math.hypot(poolDx, poolDz);
    const minPoolD = 5.45 + rad;
    if (poolD < minPoolD && poolD > 1e-4) {
      px = (poolDx / poolD) * minPoolD / 0.88;
      pz = -10.2 + (poolDz / poolD) * minPoolD;
    }

    // 4. Two-pass iterative resolution against ALL static mesh colliders + LIVE unbroken destructibles
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < staticCircleColliders.length; i++) {
        const c = staticCircleColliders[i];
        const dx = px - c.x;
        const dz = pz - c.z;
        const minD = c.r + rad;
        const dSq = dx * dx + dz * dz;
        if (dSq < minD * minD) {
          const d = Math.sqrt(dSq);
          if (d > 1e-4) {
            px = c.x + (dx / d) * minD;
            pz = c.z + (dz / d) * minD;
          } else {
            px = c.x + minD;
          }
        }
      }
      for (let i = 0; i < destructibleProps.length; i++) {
        const dp = destructibleProps[i];
        if (dp.broken) continue;
        const dx = px - dp.x;
        const dz = pz - dp.z;
        const minD = dp.r + rad;
        const dSq = dx * dx + dz * dz;
        if (dSq < minD * minD) {
          const d = Math.sqrt(dSq);
          if (d > 1e-4) {
            px = dp.x + (dx / d) * minD;
            pz = dp.z + (dz / d) * minD;
          } else {
            px = dp.x + minD;
          }
        }
      }
    }

    // Final safety clamp on north gate line
    if (pz > 30.25 - rad) pz = 30.25 - rad;

    const target = out || _clampOut;
    target.x = px;
    target.z = pz;
    target.y = evalSector01TerrainY(px, pz);
    target.layer = 'main';
    target.surface = evalSector01SurfaceType(px, pz);
    return target;
  }

  // ==========================================================================
  // B. HONEST MATTE PBR MATERIALS (ZERO plastic shine, ZERO yellow cubes!)
  // ==========================================================================
  const archStoneMat = createMossCoatedStoneMaterial(THREE, pbrTex, {
    kind: 'ruin',
    color: 0xd0dbed,
    roughness: 0.92,
    metalness: 0.0,
    envMapIntensity: 0.36,
    mossAmount: 0.30,
    groundAO: 0.16,
    rimStrength: 0.14,
    lowSpecMode,
    trackMat: regMat,
    regNormalMat
  });

  const cliffBasaltMat = createMossCoatedStoneMaterial(THREE, pbrTex, {
    kind: 'cliff',
    color: 0xb8c6da,
    roughness: 0.94,
    metalness: 0.0,
    envMapIntensity: 0.32,
    mossAmount: 0.44,
    groundAO: 0.20,
    rimStrength: 0.12,
    lowSpecMode,
    trackMat: regMat,
    regNormalMat
  });

  const boulderStoneMat = createMossCoatedStoneMaterial(THREE, pbrTex, {
    kind: 'boulder',
    color: 0xc4d2e4,
    roughness: 0.91,
    metalness: 0.0,
    envMapIntensity: 0.34,
    mossAmount: 0.40,
    groundAO: 0.18,
    rimStrength: 0.13,
    lowSpecMode,
    trackMat: regMat,
    regNormalMat
  });

  const weatheredTimberMat = createMossCoatedStoneMaterial(THREE, pbrTex, {
    kind: 'timber',
    color: 0xe2c8a8,
    roughness: 0.90,
    metalness: 0.0,
    envMapIntensity: 0.34,
    mossAmount: 0.0,
    groundAO: 0.14,
    rimStrength: 0.10,
    lowSpecMode,
    trackMat: regMat,
    regNormalMat
  });

  const pineBarkMat = createMossCoatedStoneMaterial(THREE, pbrTex, {
    kind: 'bark',
    color: 0xb6a290,
    roughness: 0.94,
    metalness: 0.0,
    envMapIntensity: 0.30,
    mossAmount: 0.16,
    groundAO: 0.18,
    rimStrength: 0.10,
    lowSpecMode,
    trackMat: regMat,
    regNormalMat
  });

  const pineNeedleMat = regMat(new THREE.MeshStandardMaterial({
    color: 0x3e6250,
    roughness: 0.93,
    metalness: 0.0,
    envMapIntensity: 0.28,
    vertexColors: true,
    side: THREE.FrontSide
  }));

  const wroughtIronMat = regMat(new THREE.MeshStandardMaterial({
    color: 0x5c6678,
    roughness: 0.54,
    metalness: 0.68,
    envMapIntensity: 0.48,
    vertexColors: true
  }));

  const bonfireSwordMat = regMat(new THREE.MeshStandardMaterial({
    color: 0xb2bfd4,
    roughness: 0.44,
    metalness: 0.82,
    envMapIntensity: 0.56,
    vertexColors: true
  }));

  // Warm frosted lantern glass (soft glowing warm-amber frosted glass INSIDE wrought-iron mullions — ZERO flat yellow cube!)
  const frostedLanternGlassMat = regMat(new THREE.MeshStandardMaterial({
    color: 0xffe0a6,
    emissive: 0xff9b38,
    emissiveIntensity: 1.55,
    roughness: 0.42,
    metalness: 0.0,
    transparent: true,
    opacity: 0.92
  }));

  // ==========================================================================
  // C. HIGH-RESOLUTION SEAMLESS SECTOR 01 TERRAIN MESH
  //    Organic gravel shore -> gradual worn cobble road -> mossy shoulders -> wet river bed!
  //    ZERO baked orange paint! ZERO harsh straight biome cutoffs!
  // ==========================================================================
  function buildSector01TerrainGeo() {
    const minX = -28.0;
    const maxX = 38.0;
    const minZ = -32.0;
    const maxZ = 72.0;
    const segX = isMobile ? 80 : 140;
    const segZ = isMobile ? 104 : 184;

    const geo = new THREE.PlaneGeometry(maxX - minX, maxZ - minZ, segX, segZ);
    geo.rotateX(-Math.PI * 0.5);
    geo.translate((minX + maxX) * 0.5, 0.0, (minZ + maxZ) * 0.5);

    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    const cols = new Float32Array(pos.count * 3);
    const mixAttr = new Float32Array(pos.count * 4);

    const cDry = new THREE.Color(0x8a95a8);
    const cRoad = new THREE.Color(0xa6b2c6);
    const cMoss = new THREE.Color(0x647d60);
    const cBank = new THREE.Color(0x525f72);
    const cCliff = new THREE.Color(0x66748a);
    const cTmp = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = evalSector01TerrainY(x, z);
      pos.setY(i, y);
      uv.setXY(i, x * 0.42, z * 0.42);

      const pathX = getSector01PathX(z);
      const n1 = vnoise2(x * 0.34 + 3.1, z * 0.34 - 1.9);
      const n2 = vnoise2(x * 0.85 - 5.2, z * 0.85 + 2.7);
      const organicJit = (n1 * 0.65 + n2 * 0.35 - 0.5);

      // Gradual organic start of weathered cobblestone road (smooth noisy transition z = 5.5 .. 13.0!)
      const zRoadMask = smoothstep(5.2, 12.8, z + organicJit * 2.8);
      const halfRoadW = 2.45 + organicJit * 0.75;
      const roadW = (1.0 - smoothstep(halfRoadW * 0.55, halfRoadW + 1.35, Math.abs(x - pathX))) * zRoadMask;
      // Bonfire alcove stone apron around (-2.30, 16.0)
      const bfApron = (1.0 - smoothstep(1.8, 3.6, Math.hypot(x - (-2.30), z - 16.0) + organicJit * 0.65)) * 0.72;
      const pathT = clamp01(Math.max(roadW, bfApron));

      // Local slope via finite difference
      const yX = evalSector01TerrainY(x + 0.7, z);
      const yZ = evalSector01TerrainY(x, z + 0.7);
      const slope = Math.hypot((yX - y) / 0.7, (yZ - y) / 0.7);

      const cliffT = clamp01(smoothstep(0.42, 0.96, slope) * smoothstep(0.55, 1.85, y));
      const wetT = clamp01(1.0 - smoothstep(SECTOR01_WATER_LEVEL - 0.05, 0.32, y + organicJit * 0.14));
      const mossT = clamp01(
        (0.42 + n1 * 0.58) *
        (1.0 - pathT * 0.88) *
        (1.0 - wetT * 0.85) *
        (1.0 - cliffT * 0.55) *
        smoothstep(0.08, 0.55, y)
      );

      // aTerrainMix: R=road cobble, G=moss/loam shoulder, B=steep basalt cliff, A=wet pebble bank
      mixAttr[i * 4]     = pathT;
      mixAttr[i * 4 + 1] = mossT;
      mixAttr[i * 4 + 2] = cliffT;
      mixAttr[i * 4 + 3] = wetT;

      cTmp.copy(cDry);
      cTmp.lerp(cRoad, pathT * 0.65);
      cTmp.lerp(cMoss, mossT * 0.55);
      cTmp.lerp(cBank, wetT * 0.68);
      cTmp.lerp(cCliff, cliffT * 0.65);

      cols[i * 3]     = cTmp.r;
      cols[i * 3 + 1] = cTmp.g;
      cols[i * 3 + 2] = cTmp.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geo.setAttribute('aTerrainMix', new THREE.BufferAttribute(mixAttr, 4));
    geo.computeVertexNormals();
    return geo;
  }

  const terrainMesh = new THREE.Mesh(regGeo(buildSector01TerrainGeo()), terrainMat || cliffBasaltMat);
  terrainMesh.name = 'Sector01Terrain';
  terrainMesh.receiveShadow = true;
  group.add(terrainMesh);

  // ==========================================================================
  // D. DEPTH-AWARE TRANSLUCENT MOONLIT RIVER + LIVE WADING RIPPLES & SPLASHES
  // ==========================================================================
  function buildDepthAwareRiverGeo() {
    const zMin = -15.5;
    const zMax = 72.0;
    const xMin = -5.5;
    const xMax = 28.0;
    const segX = isMobile ? 44 : 72;
    const segZ = isMobile ? 84 : 144;

    const geo = new THREE.PlaneGeometry(xMax - xMin, zMax - zMin, segX, segZ);
    geo.rotateX(-Math.PI * 0.5);
    geo.translate((xMin + xMax) * 0.5, SECTOR01_WATER_LEVEL, (zMin + zMax) * 0.5);

    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    const depths = new Float32Array(pos.count);

    for (let i = 0; i < pos.count; i++) {
      const wx = pos.getX(i);
      const wz = pos.getZ(i);
      const bedY = evalSector01TerrainY(wx, wz);
      depths[i] = Math.max(-0.20, SECTOR01_WATER_LEVEL - bedY);
      // Clean normalized U/V for downstream flow + soft far edge
      const u = clamp01((wx - xMin) / (xMax - xMin));
      const v = ((wz - zMin) / (zMax - zMin)) * 14.0;
      uv.setXY(i, u, v);
    }
    geo.setAttribute('aWaterDepth', new THREE.BufferAttribute(depths, 1));
    return geo;
  }

  const riverMat = regMat(createGorgeRiverMaterial(THREE, sharedTime, sharedBonfireLit, lowSpecMode));
  if (riverMat.uniforms?.uFogColor?.value) {
    riverMat.uniforms.uFogColor.value.setHex(0x132032);
  }
  const riverMesh = new THREE.Mesh(regGeo(buildDepthAwareRiverGeo()), riverMat);
  riverMesh.name = 'Sector01DepthAwareRiver';
  riverMesh.renderOrder = 1;
  group.add(riverMesh);

  // Interactive Shallow-Water Wading Ripple Rings + Flying Splash Droplets!
  const MAX_RIPPLES = 18;
  const ripplePool = [];
  const rippleGeo = regGeo(new THREE.PlaneGeometry(1.0, 1.0));
  rippleGeo.rotateX(-Math.PI * 0.5);

  function createRippleMat() {
    return regMat(new THREE.ShaderMaterial({
      uniforms: { uProgress: { value: 1.0 } },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uProgress;
        varying vec2 vUv;
        void main() {
          float r = length(vUv * 2.0 - 1.0);
          if (r > 1.0) discard;
          float ring1 = exp(-pow((r - (0.28 + uProgress * 0.64)) * 14.0, 2.0));
          float ring2 = exp(-pow((r - (0.14 + uProgress * 0.44)) * 16.0, 2.0)) * 0.65;
          float fade = (1.0 - uProgress) * smoothstep(0.0, 0.12, uProgress);
          float alpha = (ring1 + ring2) * fade * 0.52;
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(0.68, 0.80, 0.96, alpha);
        }
      `,
      transparent: true,
      depthWrite: false
    }));
  }

  for (let i = 0; i < MAX_RIPPLES; i++) {
    const mat = createRippleMat();
    const mesh = new THREE.Mesh(rippleGeo, mat);
    mesh.visible = false;
    mesh.renderOrder = 3;
    group.add(mesh);
    ripplePool.push({ mesh, mat, age: 1.0, dur: 0.95, baseScale: 1.0 });
  }
  let nextRippleIdx = 0;

  const splashDropGeo = regGeo(new THREE.SphereGeometry(0.042, 5, 4));
  const splashDropMat = regMat(new THREE.MeshBasicMaterial({
    color: 0x9bb8dc,
    transparent: true,
    opacity: 0.75,
    depthWrite: false
  }));
  const activeSplashDrops = [];

  function emitWaterRipple(x, z, isSprint = false) {
    const slot = ripplePool[nextRippleIdx];
    nextRippleIdx = (nextRippleIdx + 1) % MAX_RIPPLES;
    slot.age = 0.0;
    slot.dur = isSprint ? 0.88 : 0.76;
    slot.baseScale = isSprint ? 2.45 : 1.75;
    slot.mesh.position.set(x, SECTOR01_WATER_LEVEL + 0.018, z);
    slot.mesh.scale.setScalar(slot.baseScale);
    slot.mat.uniforms.uProgress.value = 0.0;
    slot.mesh.visible = true;

    const dropCount = isSprint ? 8 : 5;
    for (let i = 0; i < dropCount; i++) {
      const a = (i / dropCount) * Math.PI * 2 + Math.random() * 0.7;
      const spd = (isSprint ? 1.45 : 0.95) + Math.random() * 0.85;
      const m = new THREE.Mesh(splashDropGeo, splashDropMat);
      m.position.set(x + Math.cos(a) * 0.12, SECTOR01_WATER_LEVEL + 0.06, z + Math.sin(a) * 0.12);
      m.scale.setScalar(0.7 + Math.random() * 0.75);
      group.add(m);
      activeSplashDrops.push({
        mesh: m,
        vx: Math.cos(a) * spd,
        vy: (isSprint ? 2.35 : 1.70) + Math.random() * 0.9,
        vz: Math.sin(a) * spd,
        age: 0.0,
        maxAge: 0.45 + Math.random() * 0.20
      });
    }
  }

  // ==========================================================================
  // E. REALISTIC STREAMING OUTFALL WATERFALL (Translucent Water + Whitewater Streaks, ZERO Steam!)
  // ==========================================================================
  function buildOutfallCascadeGeo(zStart, yTop, dropZ, dropY, wStart, wEnd, bulge) {
    const cols = 22;
    const rows = 20;
    const pos = new Float32Array((cols + 1) * (rows + 1) * 3);
    const uv = new Float32Array((cols + 1) * (rows + 1) * 2);
    const idx = [];
    for (let r = 0; r <= rows; r++) {
      const v = r / rows;
      const z = zStart + v * dropZ;
      const y = yTop - Math.pow(v, 1.92) * dropY;
      const halfW = lerp(wStart, wEnd, v);
      for (let c = 0; c <= cols; c++) {
        const u = c / cols;
        const nx = u * 2.0 - 1.0;
        const x = nx * halfW;
        const archDip = (1.0 - nx * nx) * bulge;
        const streamRib = Math.sin(u * Math.PI * 7.0) * 0.055 * v;
        const vi = r * (cols + 1) + c;
        pos[vi * 3]     = x;
        pos[vi * 3 + 1] = y + archDip * (1.0 - v * 0.65) + streamRib;
        pos[vi * 3 + 2] = z + archDip * 0.55 + Math.abs(streamRib) * 0.45;
        uv[vi * 2]     = u;
        uv[vi * 2 + 1] = v;
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

  function createStreamingWaterMat(speedMul, opacityMul) {
    return regMat(new THREE.ShaderMaterial({
      uniforms: { uTime: sharedTime },
      vertexShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 p = position;
          p.y += sin(uv.x * 22.0 + uv.y * 12.0 - uTime * ${(10.5 * speedMul).toFixed(2)}) * 0.04 * uv.y;
          p.z += cos(uv.x * 14.0 - uTime * ${(8.2 * speedMul).toFixed(2)}) * 0.03 * uv.y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
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
          float t = uTime * ${(5.4 * speedMul).toFixed(2)};
          // Sharp elongated vertical water jets & separated foaming threads (looks like REAL falling water, never steam!)
          float jet1 = vnoise(vec2(vUv.x * 19.0, vUv.y * 2.6 - t));
          float jet2 = vnoise(vec2(vUv.x * 38.0 + 4.2, vUv.y * 5.2 - t * 1.48));
          float jet3 = vnoise(vec2(vUv.x * 9.0 - 2.1, vUv.y * 1.8 - t * 0.85));
          float combined = jet1 * 0.46 + jet2 * 0.36 + jet3 * 0.18;
          float threadFoam = smoothstep(0.54, 0.84, combined + vUv.y * 0.14);
          float baseSplash = smoothstep(0.76, 1.0, vUv.y) * smoothstep(0.32, 0.78, combined) * 0.72;
          float sideFade = smoothstep(0.0, 0.12, vUv.x) * smoothstep(0.0, 0.12, 1.0 - vUv.x);
          float topFade = smoothstep(0.0, 0.06, vUv.y);
          // Deep dark translucent nocturnal water body + crisp silver-blue whitewater ribbons
          vec3 darkStream = vec3(0.018, 0.042, 0.075);
          vec3 midStream  = vec3(0.065, 0.125, 0.205);
          vec3 foamCol    = vec3(0.58, 0.70, 0.86);
          vec3 col = mix(darkStream, midStream, smoothstep(0.28, 0.65, combined));
          col = mix(col, foamCol, clamp(threadFoam * 0.85 + baseSplash, 0.0, 1.0));
          float a = clamp((0.36 + threadFoam * 0.56 + baseSplash * 0.38) * sideFade * topFade * ${opacityMul.toFixed(2)}, 0.0, 0.90);
          if (a < 0.015) discard;
          gl_FragColor = vec4(col, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    }));
  }

  const waterfallCore = new THREE.Mesh(
    regGeo(buildOutfallCascadeGeo(-14.3, 2.15, 3.85, 2.38, 2.55, 3.25, 0.24)),
    createStreamingWaterMat(1.0, 0.88)
  );
  waterfallCore.renderOrder = 2;
  group.add(waterfallCore);

  const waterfallOuter = new THREE.Mesh(
    regGeo(buildOutfallCascadeGeo(-14.0, 2.30, 4.10, 2.52, 2.70, 3.55, 0.36)),
    createStreamingWaterMat(1.28, 0.52)
  );
  waterfallOuter.renderOrder = 3;
  group.add(waterfallOuter);

  // Dark tunnel recess behind the Outfall Sluice Arch
  const outfallVoid = new THREE.Mesh(
    regGeo(new THREE.PlaneGeometry(6.8, 7.2)),
    regMat(new THREE.MeshBasicMaterial({ color: 0x03050a }))
  );
  outfallVoid.position.set(0, 3.3, -15.3);
  group.add(outfallVoid);

  // Violently ripped rusty iron sluice grate bars framing the Outfall Arch breach (matching Act 4 escape!)
  if (rustedGrateMat) {
    const grateGroup = new THREE.Group();
    grateGroup.position.set(0, 0, -12.65);
    const topBar = new THREE.Mesh(regGeo(new THREE.BoxGeometry(6.9, 0.32, 0.32)), rustedGrateMat);
    topBar.position.set(0, 6.25, 0);
    grateGroup.add(topBar);
    const barGeoFull = regGeo(new THREE.CylinderGeometry(0.085, 0.095, 5.4, 8));
    const barGeoStub = regGeo(new THREE.CylinderGeometry(0.08, 0.09, 2.1, 8));
    for (let i = -4; i <= 4; i++) {
      const bx = i * 0.74;
      if (Math.abs(i) <= 2) {
        const stub = new THREE.Mesh(barGeoStub, rustedGrateMat);
        stub.position.set(bx, 5.45, 0.55 + (2 - Math.abs(i)) * 0.24);
        stub.rotation.set(-0.95 - (2 - Math.abs(i)) * 0.20, 0, i * 0.22);
        grateGroup.add(stub);
      } else {
        const bar = new THREE.Mesh(barGeoFull, rustedGrateMat);
        bar.position.set(bx, 3.55, 0);
        grateGroup.add(bar);
      }
    }
    group.add(grateGroup);
  }

  // ==========================================================================
  // F. 7 STATIONARY PHYSICAL POINT LIGHTS (ALL 4 LANTERNS + BONFIRE + 2 BRAZIERS — ZERO TELEPORTING!)
  // ==========================================================================
  const bonfirePos = SECTOR01_ANCHORS.bonfirePos;
  const bonfirePointLight = new THREE.PointLight(0xff8424, 2.2, 19.0, 2.0);
  bonfirePointLight.position.set(bonfirePos.x, bonfirePos.y + 1.28, bonfirePos.z);
  group.add(bonfirePointLight);

  const lanternLightSpecs = [
    // Lantern #1 over Great Club & Shore Landing (exact glass core center at ry=PI -> x - 0.66, y + 2.88)
    { x:  2.89, y: evalSector01TerrainY( 3.55,  6.20) + 2.88, z:  6.20, intensity: 6.4, dist: 16.5, isBrazier: false },
    // Lantern #2 lighting Pilgrim Archway, western barrel/crate cluster & road
    { x: -3.49, y: evalSector01TerrainY(-4.15, 13.60) + 2.88, z: 13.60, intensity: 6.0, dist: 16.5, isBrazier: false },
    // Lantern #3 bathing the 3.90m Fisherman's Skiff & shoreline spit in warm amber glow!
    { x:  2.79, y: evalSector01TerrainY( 3.45, 19.60) + 2.88, z: 19.60, intensity: 6.4, dist: 17.0, isBrazier: false },
    // Lantern #4 lighting mid-road approaching Ash Gorge Gate (ry=0 -> x + 0.66, y + 2.88)
    { x: -3.19, y: evalSector01TerrainY(-3.85, 22.80) + 2.88, z: 22.80, intensity: 6.0, dist: 16.5, isBrazier: false },
    // West Gate Brazier (bathes Ash Gatehouse masonry & portcullis!)
    { x: -3.90, y: evalSector01TerrainY(-3.90, 27.65) + 2.38, z: 27.65, intensity: 8.6, dist: 18.0, isBrazier: true },
    // East Gate Brazier (bathes Ash Gatehouse masonry & portcullis!)
    { x:  3.90, y: evalSector01TerrainY( 3.90, 27.65) + 2.38, z: 27.65, intensity: 8.6, dist: 18.0, isBrazier: true }
  ];
  const staticWarmLights = [];
  const activeLightCount = lowSpecMode ? 2 : lanternLightSpecs.length;
  for (let i = 0; i < activeLightCount; i++) {
    const ls = lanternLightSpecs[i];
    const pl = new THREE.PointLight(ls.isBrazier ? 0xff8628 : 0xffaa4e, ls.intensity, ls.dist, 2.0);
    pl.position.set(ls.x, ls.y, ls.z);
    group.add(pl);
    staticWarmLights.push({ light: pl, baseInt: ls.intensity, phase: i * 1.9 + 0.7, isBrazier: ls.isBrazier });
  }

  // ==========================================================================
  // G. VOLUMETRIC MULTI-TONGUE FIRE & EMBER RIG (Bonfire + Twin Gate Braziers)
  // ==========================================================================
  function createRichFlameRig(scaleW, scaleH, litUniformRef) {
    const fg = new THREE.Group();
    const sheetSpecs = [
      { w: scaleW * 0.95, h: scaleH * 1.05, ry: 0.00, ox:  0.00, oz:  0.00 },
      { w: scaleW * 0.88, h: scaleH * 0.98, ry: 1.05, ox:  0.04, oz: -0.04 },
      { w: scaleW * 0.86, h: scaleH * 1.00, ry: 2.09, ox: -0.04, oz:  0.04 },
      { w: scaleW * 0.66, h: scaleH * 1.18, ry: 0.52, ox:  0.06, oz:  0.05 },
      { w: scaleW * 0.64, h: scaleH * 1.14, ry: 1.57, ox: -0.06, oz: -0.05 }
    ];
    const flameMat = regMat(new THREE.ShaderMaterial({
      uniforms: { uTime: sharedTime, uLit: litUniformRef },
      vertexShader: `
        uniform float uTime;
        uniform float uLit;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 p = position;
          float h = clamp(uv.y, 0.0, 1.0);
          float sway = sin(uTime * 6.4 - h * 5.8 + p.x * 4.0) * 0.14 * h * h;
          float swayZ = cos(uTime * 5.5 - h * 5.2 + p.z * 4.0) * 0.12 * h * h;
          p.x = p.x * (1.0 - smoothstep(0.18, 1.0, h) * 0.62) + sway;
          p.z = p.z * (1.0 - smoothstep(0.18, 1.0, h) * 0.62) + swayZ;
          p.y *= (0.18 + 0.82 * uLit);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uLit;
        varying vec2 vUv;
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
          if (uLit < 0.02) discard;
          float cx = abs(vUv.x - 0.5) * 2.0;
          float n1 = vnoise(vec2(vUv.x * 4.2, vUv.y * 3.8 - uTime * 3.6));
          float n2 = vnoise(vec2(vUv.x * 9.5 + 2.3, vUv.y * 7.6 - uTime * 6.2));
          float turb = n1 * 0.55 + n2 * 0.45;
          float tongue = smoothstep(0.26, 0.82, turb + (1.0 - vUv.y) * 0.40 - cx * cx * 0.94);
          float envY = smoothstep(0.0, 0.14, vUv.y) * (1.0 - smoothstep(0.34, 0.98, vUv.y + (0.50 - turb) * 0.62));
          float m = tongue * envY;
          if (m < 0.02) discard;
          float heat = clamp(m * (1.05 - vUv.y * 0.82) + (turb - 0.5) * 0.22, 0.0, 1.0);
          vec3 col = mix(vec3(0.76, 0.10, 0.01), vec3(1.24, 0.38, 0.04), smoothstep(0.08, 0.52, heat));
          col = mix(col, vec3(1.52, 0.92, 0.30), smoothstep(0.58, 0.94, heat));
          gl_FragColor = vec4(col, m * 0.46 * uLit);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    }));

    for (let k = 0; k < sheetSpecs.length; k++) {
      const sp = sheetSpecs[k];
      const g = regGeo(new THREE.PlaneGeometry(sp.w, sp.h, 5, 10));
      g.translate(0, sp.h * 0.5, 0);
      const m = new THREE.Mesh(g, flameMat);
      m.position.set(sp.ox, 0, sp.oz);
      m.rotation.y = sp.ry;
      m.renderOrder = 4;
      fg.add(m);
    }
    return fg;
  }

  // Glowing ember bed inside Shore Bonfire
  const bonfireCoalsMat = regMat(new THREE.ShaderMaterial({
    uniforms: { uTime: sharedTime, uLit: sharedBonfireLit },
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uLit;
      varying vec2 vUv;
      float hash21(vec2 p) { p = fract(p * vec2(127.1, 311.7)); p += dot(p, p + 34.53); return fract(p.x * p.y); }
      void main() {
        float r = length(vUv * 2.0 - 1.0);
        if (r > 1.0) discard;
        float n = hash21(floor(vUv * 20.0));
        float pulse = 0.82 + 0.18 * sin(uTime * 5.2 + n * 14.0);
        float radial = 1.0 - smoothstep(0.22, 0.98, r);
        float glow = radial * (0.30 + uLit * 0.95) * (0.62 + 0.38 * n) * pulse;
        vec3 col = mix(vec3(0.18, 0.04, 0.01), vec3(2.15, 0.65, 0.10), clamp(glow, 0.0, 1.0));
        gl_FragColor = vec4(col, radial * (0.76 + uLit * 0.24));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false
  }));
  const bonfireCoals = new THREE.Mesh(regGeo(new THREE.CircleGeometry(0.68, 18)), bonfireCoalsMat);
  bonfireCoals.rotation.x = -Math.PI * 0.5;
  bonfireCoals.position.set(bonfirePos.x, bonfirePos.y + 0.24, bonfirePos.z);
  group.add(bonfireCoals);

  const bonfireFlames = createRichFlameRig(0.95, 1.38, sharedBonfireLit);
  bonfireFlames.position.set(bonfirePos.x, bonfirePos.y + 0.22, bonfirePos.z);
  bonfireFlames.visible = false;
  group.add(bonfireFlames);

  // Rising bonfire embers
  const emberCount = isMobile ? 20 : 38;
  const emPos = new Float32Array(emberCount * 3);
  const emSeed = new Float32Array(emberCount * 3);
  for (let i = 0; i < emberCount; i++) {
    emPos[i * 3] = bonfirePos.x;
    emPos[i * 3 + 1] = bonfirePos.y + 0.28;
    emPos[i * 3 + 2] = bonfirePos.z;
    emSeed[i * 3] = (i * 0.6180339) % 1;
    emSeed[i * 3 + 1] = 0.6 + ((i * 37) % 100) * 0.008;
    emSeed[i * 3 + 2] = 0.10 + ((i * 53) % 100) * 0.0032;
  }
  const emberGeo = regGeo(new THREE.BufferGeometry());
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emPos, 3));
  emberGeo.setAttribute('aSeed', new THREE.BufferAttribute(emSeed, 3));
  const emberMat = regMat(new THREE.ShaderMaterial({
    uniforms: { uTime: sharedTime, uLit: sharedBonfireLit, uTex: { value: mistSpriteTex } },
    vertexShader: `
      attribute vec3 aSeed;
      uniform float uTime;
      varying float vAlpha;
      void main() {
        float cyc = fract(aSeed.x + uTime * 0.42 * aSeed.y);
        float ang = aSeed.x * 6.283 + uTime * 1.8 + cyc * 3.5;
        float rad = aSeed.z * (0.4 + cyc * 1.15);
        vec3 p = position + vec3(cos(ang) * rad, cyc * 2.8, sin(ang) * rad);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(48.0 / max(1.0, -mv.z), 2.5, 13.0);
        vAlpha = sin(cyc * 3.14159);
      }
    `,
    fragmentShader: `
      uniform sampler2D uTex;
      uniform float uLit;
      varying float vAlpha;
      void main() {
        vec4 t = texture2D(uTex, gl_PointCoord);
        float a = t.a * vAlpha * uLit;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vec3(2.15, 0.85, 0.22), a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  const bonfireEmbers = new THREE.Points(emberGeo, emberMat);
  bonfireEmbers.visible = false;
  bonfireEmbers.renderOrder = 5;
  group.add(bonfireEmbers);

  // Twin Gate Brazier flames + glowing coal beds (positioned cleanly at ±3.90, z=27.65 — >0.8m clear of gate towers!)
  const alwaysLitUniform = { value: 1.0 };
  const brazierCoalGeo = regGeo(new THREE.CircleGeometry(0.48, 16));
  const brazierCoalMat = regMat(new THREE.MeshBasicMaterial({ color: 0xff6e1a }));
  for (const side of [-1, 1]) {
    const bx = side * 3.90;
    const bz = 27.65;
    const by = evalSector01TerrainY(bx, bz);
    const gf = createRichFlameRig(0.86, 1.28, alwaysLitUniform);
    gf.position.set(bx, by + 1.56, bz);
    group.add(gf);
    const coalDisc = new THREE.Mesh(brazierCoalGeo, brazierCoalMat);
    coalDisc.rotation.x = -Math.PI * 0.5;
    coalDisc.position.set(bx, by + 1.58, bz);
    group.add(coalDisc);
  }

  // ==========================================================================
  // H. ORGANIC BOTANICAL FERNS STRICTLY ON EARTH/CLIFF MARGINS (NEVER ON STONE ROAD!)
  // ==========================================================================
  if (pbrTex?.fernFrond) {
    const fernMat = regMat(new THREE.MeshStandardMaterial({
      map: pbrTex.fernFrond,
      alphaTest: 0.42,
      color: 0x627c62,
      roughness: 0.94,
      metalness: 0.0,
      envMapIntensity: 0.16,
      side: THREE.DoubleSide
    }));
    // Strictly on west cliff shoulder & mossy riverbank margins (far from cobblestones!)
    const fernSpots = [
      [-5.9,  3.2], [-6.2,  7.4], [-6.1, 12.6], [-6.4, 18.8], [-5.8, 24.4], [-6.1, 28.6],
      [ 4.2,  2.8], [ 5.4, 12.2], [ 6.8, 22.8], [ 5.2, 26.2], [-5.4, 21.0], [ 4.8,  8.6]
    ];
    const frondGeo = regGeo(new THREE.PlaneGeometry(0.68, 0.82, 2, 3));
    const fPos = frondGeo.attributes.position;
    for (let i = 0; i < fPos.count; i++) {
      const fy = fPos.getY(i) + 0.41;
      const t = clamp01(fy / 0.82);
      fPos.setY(i, fy * 0.85);
      fPos.setZ(i, t * t * 0.42);
    }
    frondGeo.computeVertexNormals();
    const totalFronds = fernSpots.length * 6;
    const fernInst = new THREE.InstancedMesh(frondGeo, fernMat, totalFronds);
    const dummy = new THREE.Object3D();
    let idx = 0;
    for (let s = 0; s < fernSpots.length; s++) {
      const [fx, fz] = fernSpots[s];
      const fy = evalSector01TerrainY(fx, fz) - 0.04;
      for (let k = 0; k < 6; k++) {
        dummy.position.set(fx, fy, fz);
        dummy.rotation.set(0.18 + (k % 2) * 0.10, (k / 6) * Math.PI * 2 + s * 0.9, 0);
        const sc = 0.78 + ((s * 7 + k * 13) % 10) * 0.045;
        dummy.scale.setScalar(sc);
        dummy.updateMatrix();
        fernInst.setMatrixAt(idx++, dummy.matrix);
      }
    }
    fernInst.instanceMatrix.needsUpdate = true;
    group.add(fernInst);
  }

  // ==========================================================================
  // I. LOAD HIGH-DETAIL BLENDER 4.5.9 GLB KITS & PLACE WITH 1:1 COLLIDERS!
  // ==========================================================================
  function extractNamedMap(gltfScene) {
    const map = new Map();
    if (!gltfScene) return map;
    for (let i = 0; i < gltfScene.children.length; i++) {
      const ch = gltfScene.children[i];
      if (ch && ch.name) map.set(ch.name, ch);
    }
    gltfScene.traverse((n) => {
      if (n && n.isMesh && n.name && !map.has(n.name)) {
        map.set(n.name, n);
      }
    });
    return map;
  }

  function cloneStyled(src, mat, { castShadow = true, receiveShadow = true } = {}) {
    if (!src) return null;
    const cl = src.clone(true);
    cl.traverse((n) => {
      if (n.isMesh) {
        n.material = mat;
        n.castShadow = castShadow;
        n.receiveShadow = receiveShadow;
      }
    });
    return cl;
  }

  // Register ALL exact static colliders immediately (so physics works synchronously even before GLB async finishes!)
  // 1) Outfall Sluice Archway piers (z = -14.0)
  registerStaticCircle('outfall_pier_w', -4.35, -14.0, 2.05);
  registerStaticCircle('outfall_pier_e',  4.35, -14.0, 2.05);
  // 2) Great Club resting mossy boulder (behind club at +2.65, 5.40)
  registerStaticCircle('club_cairn_boulder', 3.45, 5.15, 0.78);
  // 3) Collapsed Pilgrim Archway left & right piers (center x = -0.35, z = 11.2, clear span = 5.6m!)
  registerStaticCircle('pilgrim_arch_pier_w', -3.85, 11.20, 1.05);
  registerStaticCircle('pilgrim_arch_pier_e',  3.15, 11.20, 1.05);
  // 4) Shore Bonfire Stone Hearth Ring (-2.30, 16.00) — THE ONLY BONFIRE IN SECTOR 01!
  registerStaticCircle('shore_bonfire_hearth', bonfirePos.x, bonfirePos.z, 1.08);
  // 5) 4 Unified Tall Road Lanterns (3.35m tall, real solid stone plinth collider!)
  const lanternSpecs = [
    { id: 'lantern_1_shore',   x:  3.55, z:  6.20, ry: Math.PI },
    { id: 'lantern_2_bonfire', x: -4.15, z: 13.60, ry: 0.0 },
    { id: 'lantern_3_river',   x:  3.45, z: 19.60, ry: Math.PI },
    { id: 'lantern_4_gate',    x: -3.85, z: 22.80, ry: 0.0 }
  ];
  for (let i = 0; i < lanternSpecs.length; i++) {
    const ls = lanternSpecs[i];
    registerStaticCircle(ls.id, ls.x, ls.z, 0.38);
  }
  // 6) True-Scale 3.90m Fisherman's Skiff resting on East Gravel Spit (+6.40, 18.60, ry = 0.42)
  const skiffSpec = { x: 6.35, z: 18.60, ry: 0.42 };
  registerCapsuleColliders('fisher_skiff', skiffSpec.x, skiffSpec.z, 1.38, skiffSpec.ry, 0.78, 3);
  // 7) Monumental Ash Gorge Gatehouse towers & Twin Gate Braziers (cleanly clear of gate walls!)
  registerStaticCircle('ash_gate_tower_w', -4.25, 31.0, 2.05);
  registerStaticCircle('ash_gate_tower_e',  4.25, 31.0, 2.05);
  registerStaticCircle('gate_brazier_w',   -3.90, 27.65, 0.74);
  registerStaticCircle('gate_brazier_e',    3.90, 27.65, 0.74);
  // 8) Sculpted Shore Boulders (matching exact mesh placement!)
  const boulderSpecs = [
    { id: 'boulder_club',   x:  3.45, z:  5.15, ry:  0.65, s: 0.56, r: 0.0 }, // collider registered above
    { id: 'boulder_w1',     x: -6.45, z:  1.40, ry:  1.20, s: 0.92, r: 1.05 },
    { id: 'boulder_w2',     x: -6.85, z:  8.40, ry: -0.80, s: 0.96, r: 1.12 },
    { id: 'boulder_w3',     x: -6.95, z: 20.60, ry:  2.15, s: 1.00, r: 1.15 },
    { id: 'boulder_river1', x:  9.20, z:  2.40, ry:  0.40, s: 0.88, r: 0.95 },
    { id: 'boulder_river2', x: 11.40, z: 13.80, ry:  1.85, s: 1.02, r: 1.08 },
    { id: 'boulder_river3', x:  9.80, z: 25.40, ry: -1.10, s: 0.95, r: 1.00 },
    { id: 'boulder_pool_w', x: -4.25, z: -8.40, ry:  0.30, s: 1.10, r: 1.25 },
    { id: 'boulder_pool_e', x:  4.40, z: -8.20, ry: -0.95, s: 1.05, r: 1.20 }
  ];
  for (let i = 0; i < boulderSpecs.length; i++) {
    const bs = boulderSpecs[i];
    if (bs.r > 0) registerStaticCircle(bs.id, bs.x, bs.z, bs.r);
  }
  // 9) Nordic Conifer Pines — strictly on earthy cliff slopes & far East river bank (ZERO on rocks/water/road!)
  const pineSpecs = [
    // West canyon upper slopes (behind cliff foot, framing sky!)
    { id: 'pine_w1', x: -10.8, z:  -3.5, ry: 0.45, s: 0.95, kind: 'A' },
    { id: 'pine_w2', x: -11.4, z:   5.8, ry: 1.85, s: 1.05, kind: 'B' },
    { id: 'pine_w3', x: -12.2, z:  14.5, ry: 3.10, s: 1.02, kind: 'A' },
    { id: 'pine_w4', x: -11.2, z:  22.4, ry: 4.40, s: 1.08, kind: 'B' },
    { id: 'pine_w5', x:  -9.6, z:  30.2, ry: 5.20, s: 0.96, kind: 'A' },
    { id: 'pine_w6', x: -15.5, z:  10.2, ry: 2.30, s: 1.18, kind: 'B' },
    { id: 'pine_w7', x: -16.2, z:  26.5, ry: 0.85, s: 1.15, kind: 'A' },
    // Far East forested river bank across the moonlit water (strictly high on dry East bank — ZERO trunks in water!)
    { id: 'pine_e1', x:  20.5, z:   1.5, ry: 1.10, s: 1.02, kind: 'B' },
    { id: 'pine_e2', x:  21.8, z:  11.8, ry: 2.65, s: 1.12, kind: 'A' },
    { id: 'pine_e3', x:  21.5, z:  21.4, ry: 4.10, s: 1.08, kind: 'B' },
    { id: 'pine_e4', x:  21.8, z:  31.6, ry: 5.55, s: 1.04, kind: 'A' },
    { id: 'pine_e5', x:  25.4, z:   6.8, ry: 0.25, s: 1.22, kind: 'B' },
    { id: 'pine_e6', x:  26.2, z:  17.2, ry: 3.45, s: 1.18, kind: 'A' },
    { id: 'pine_e7', x:  22.5, z:  42.0, ry: 1.75, s: 1.14, kind: 'B' },
    // Distant northern gorge treeline framing vista through the Ash Gorge Gate portcullis!
    { id: 'pine_n1', x:  -9.2, z:  39.5, ry: 1.45, s: 1.08, kind: 'B' },
    { id: 'pine_n2', x:  -6.5, z:  49.5, ry: 2.85, s: 1.16, kind: 'A' },
    { id: 'pine_n3', x:   6.8, z:  48.2, ry: 3.90, s: 1.12, kind: 'B' },
    { id: 'pine_n4', x:  -2.4, z:  59.0, ry: 0.65, s: 1.24, kind: 'A' },
    { id: 'pine_n5', x:   3.8, z:  61.5, ry: 4.55, s: 1.20, kind: 'B' }
  ];
  // 10) 8 Smashable Wooden Barrels & Crates in 3 logical supply clusters — ALL 8 solid until smashed!
  const destructibleSpecs = [
    // Cluster 1: Outfall Shore Landing West
    { id: 'dest_crate_1',  x: -4.45, z:  4.85, ry:  0.22, kind: 'crate' },
    { id: 'dest_barrel_1', x: -3.95, z:  5.80, ry:  1.15, kind: 'barrel' },
    { id: 'dest_barrel_2', x: -4.95, z:  5.70, ry: -0.75, kind: 'barrel' },
    // Cluster 2: Beside Pilgrim Archway West Flank
    { id: 'dest_crate_2',  x: -4.80, z:  9.90, ry:  0.48, kind: 'crate' },
    { id: 'dest_barrel_3', x: -5.35, z: 10.95, ry:  2.20, kind: 'barrel' },
    // Cluster 3: Gatehouse Supply Alcoves
    { id: 'dest_crate_3',  x: -4.85, z: 25.60, ry: -0.30, kind: 'crate' },
    { id: 'dest_barrel_4', x: -5.25, z: 26.65, ry:  0.90, kind: 'barrel' },
    { id: 'dest_crate_4',  x:  4.50, z: 25.20, ry:  0.38, kind: 'crate' }
  ];
  for (let i = 0; i < destructibleSpecs.length; i++) {
    const ds = destructibleSpecs[i];
    destructibleProps.push({
      id: ds.id,
      x: ds.x,
      y: evalSector01TerrainY(ds.x, ds.z),
      z: ds.z,
      ry: ds.ry,
      r: ds.kind === 'crate' ? 0.56 : 0.46,
      kind: ds.kind,
      broken: false,
      mesh: null
    });
  }

  // Splinter physics pool for smashed barrels & crates
  const splinterGeo = regGeo(new THREE.BoxGeometry(0.11, 0.05, 0.48));
  const activeSplinters = [];

  function spawnWoodSplinters(ox, oy, oz) {
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * Math.PI * 2 + Math.random() * 0.5;
      const spd = 2.2 + Math.random() * 2.6;
      const m = new THREE.Mesh(splinterGeo, weatheredTimberMat);
      m.position.set(ox + Math.cos(ang) * 0.16, oy + 0.40, oz + Math.sin(ang) * 0.16);
      m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      group.add(m);
      activeSplinters.push({
        mesh: m,
        vx: Math.cos(ang) * spd,
        vy: 2.8 + Math.random() * 2.4,
        vz: Math.sin(ang) * spd,
        rx: (Math.random() - 0.5) * 11,
        ry: (Math.random() - 0.5) * 11,
        age: 0,
        maxAge: 2.0
      });
    }
  }

  function hitDestructibles(hx, hz, radius = 1.65) {
    const hits = [];
    for (let i = 0; i < destructibleProps.length; i++) {
      const p = destructibleProps[i];
      if (p.broken) continue;
      if (Math.hypot(p.x - hx, p.z - hz) <= radius + p.r) {
        p.broken = true;
        if (p.mesh) p.mesh.visible = false;
        spawnWoodSplinters(p.x, p.y, p.z);
        hits.push({ x: p.x, y: p.y + 0.42, z: p.z });
      }
    }
    return { count: hits.length, hits };
  }

  function resetDestructibles() {
    for (let i = 0; i < destructibleProps.length; i++) {
      destructibleProps[i].broken = false;
      if (destructibleProps[i].mesh) destructibleProps[i].mesh.visible = true;
    }
    for (let i = activeSplinters.length - 1; i >= 0; i--) {
      group.remove(activeSplinters[i].mesh);
    }
    activeSplinters.length = 0;
  }

  // Async GLB load & mount
  const loadGlb = (url) => new Promise((resolve) => {
    if (!gltfLoader || typeof gltfLoader.load !== 'function') {
      resolve(null);
      return;
    }
    gltfLoader.load(
      url,
      (gltf) => resolve(gltf?.scene || null),
      undefined,
      () => resolve(null)
    );
  });

  const readyPromise = Promise.all([loadGlb(ARCH_GLB_URL), loadGlb(PROPS_GLB_URL)]).then(([archScene, propsScene]) => {
    const archMap = extractNamedMap(archScene);
    const propsMap = extractNamedMap(propsScene);

    // 1. Outfall Sluice Archway at (0, -0.35, -14.0)
    const outfallArch = cloneStyled(archMap.get('S01_Outfall_Arch'), archStoneMat);
    if (outfallArch) {
      outfallArch.position.set(0.0, -0.45, -14.0);
      group.add(outfallArch);
    }

    // 2. Collapsed Pilgrim Archway at (-0.35, y, 11.20)
    const pilgrimArch = cloneStyled(archMap.get('S01_Pilgrim_Archway'), archStoneMat);
    if (pilgrimArch) {
      pilgrimArch.position.set(-0.35, evalSector01TerrainY(-0.35, 11.20) - 0.14, 11.20);
      group.add(pilgrimArch);
    }

    // 3. Monumental Ash Gorge Gatehouse + Closed Iron Portcullis at (0.0, y, 31.0)
    const gateY = evalSector01TerrainY(0.0, 31.0) - 0.12;
    const ashGate = cloneStyled(archMap.get('S01_Ash_Gatehouse'), archStoneMat);
    if (ashGate) {
      ashGate.position.set(0.0, gateY, 31.0);
      group.add(ashGate);
    }
    const portcullis = cloneStyled(archMap.get('S01_Gate_Portcullis'), wroughtIronMat);
    if (portcullis) {
      portcullis.position.set(0.0, gateY, 31.0);
      group.add(portcullis);
    }

    // 4. Twin Ornate Gate Braziers cleanly at (±3.90, y, 27.65) — generously clear of gate towers!
    const brazierStoneSrc = archMap.get('S01_Gate_Brazier_Stone');
    const brazierIronSrc = archMap.get('S01_Gate_Brazier_Iron');
    for (const side of [-1, 1]) {
      const bx = side * 3.90;
      const bz = 27.65;
      const by = evalSector01TerrainY(bx, bz) - 0.04;
      const bs = cloneStyled(brazierStoneSrc, archStoneMat);
      if (bs) { bs.position.set(bx, by, bz); group.add(bs); }
      const bi = cloneStyled(brazierIronSrc, wroughtIronMat);
      if (bi) { bi.position.set(bx, by, bz); group.add(bi); }
    }

    // 5. Masterwork True-Scale Shore Bonfire Sanctuary (-2.30, y, 16.00)
    //    castShadow=false on low hearth stones eliminates shadow-acne flickering around bonfire!
    const bfY = bonfirePos.y - 0.03;
    const bfStone = cloneStyled(propsMap.get('S01_Bonfire_Stone'), boulderStoneMat, { castShadow: false, receiveShadow: true });
    if (bfStone) { bfStone.position.set(bonfirePos.x, bfY, bonfirePos.z); group.add(bfStone); }
    const bfLogs = cloneStyled(propsMap.get('S01_Bonfire_Logs'), weatheredTimberMat, { castShadow: false, receiveShadow: true });
    if (bfLogs) { bfLogs.position.set(bonfirePos.x, bfY, bonfirePos.z); group.add(bfLogs); }
    const bfSword = cloneStyled(propsMap.get('S01_Bonfire_Sword'), bonfireSwordMat, { castShadow: true, receiveShadow: true });
    if (bfSword) { bfSword.position.set(bonfirePos.x, bfY, bonfirePos.z); group.add(bfSword); }

    // 6. 4 Unified Tall Gothic Road Lanterns (3.35m tall, frosted glass inside wrought-iron cages!)
    const lanStoneSrc = propsMap.get('S01_Lantern_Stone');
    const lanIronSrc = propsMap.get('S01_Lantern_Iron');
    const lanGlassSrc = propsMap.get('S01_Lantern_Glass');
    for (let i = 0; i < lanternSpecs.length; i++) {
      const ls = lanternSpecs[i];
      const ly = evalSector01TerrainY(ls.x, ls.z) - 0.05;
      const gLan = new THREE.Group();
      gLan.position.set(ls.x, ly, ls.z);
      gLan.rotation.y = ls.ry;
      const s = cloneStyled(lanStoneSrc, archStoneMat);
      const ir = cloneStyled(lanIronSrc, wroughtIronMat);
      const gl = cloneStyled(lanGlassSrc, frostedLanternGlassMat, { castShadow: false, receiveShadow: false });
      if (s) gLan.add(s);
      if (ir) gLan.add(ir);
      if (gl) gLan.add(gl);
      group.add(gLan);
    }

    // 7. True-Scale 3.90m Clinker-Built Fisherman's Skiff resting naturally on East gravel spit!
    const skiff = cloneStyled(propsMap.get('S01_Fisher_Skiff'), weatheredTimberMat);
    if (skiff) {
      const sy = evalSector01TerrainY(skiffSpec.x, skiffSpec.z) - 0.04;
      skiff.position.set(skiffSpec.x, sy, skiffSpec.z);
      skiff.rotation.set(0.05, skiffSpec.ry, -0.06);
      group.add(skiff);
    }

    // 8. All 8 Smashable Barrels & Crates (100% solid until broken, 100% smashable!)
    const barrelSrc = propsMap.get('S01_Barrel');
    const crateSrc = propsMap.get('S01_Crate');
    for (let i = 0; i < destructibleProps.length; i++) {
      const dp = destructibleProps[i];
      const m = cloneStyled(dp.kind === 'barrel' ? barrelSrc : crateSrc, weatheredTimberMat);
      if (m) {
        m.position.set(dp.x, dp.y - 0.03, dp.z);
        m.rotation.y = dp.ry;
        m.visible = !dp.broken;
        group.add(m);
        dp.mesh = m;
      }
    }

    // 9. Sculpted Shore & River Boulders
    const boulderSrc = propsMap.get('S01_Shore_Boulder_A');
    for (let i = 0; i < boulderSpecs.length; i++) {
      const bs = boulderSpecs[i];
      const b = cloneStyled(boulderSrc, boulderStoneMat);
      if (b) {
        b.position.set(bs.x, evalSector01TerrainY(bs.x, bs.z) - 0.18, bs.z);
        b.rotation.y = bs.ry;
        b.scale.setScalar(bs.s);
        group.add(b);
      }
    }

    // 10. Stratified Basalt Canyon Cliffs framing West shore, Outfall V-canyon, and far East river mountain wall
    //     (Keeps Castle of Ash at z=-58 and Giant Cratered Full Moon 100% unobstructed!)
    const cliffSrc = propsMap.get('S01_Cliff_Crag_A');
    const cliffSpecs = [
      // Outfall V-canyon framing shoulders + solid mountain backdrop grounding Castle of Ash!
      { x: -10.8, y: -1.6, z: -15.2, ry:  0.22, sx: 1.15, sy: 1.05, sz: 1.05 },
      { x:  11.0, y: -1.6, z: -15.0, ry: -0.25, sx: 1.18, sy: 1.08, sz: 1.05 },
      { x: -18.5, y: -1.2, z: -12.5, ry:  0.65, sx: 1.35, sy: 1.38, sz: 1.22 },
      { x:  19.2, y: -1.2, z: -12.2, ry: -0.58, sx: 1.38, sy: 1.42, sz: 1.25 },
      { x:   0.0, y:  3.6, z: -24.5, ry:  0.12, sx: 1.85, sy: 1.15, sz: 1.45 },
      { x: -10.5, y:  3.2, z: -23.8, ry:  0.88, sx: 1.65, sy: 1.28, sz: 1.40 },
      { x:  10.8, y:  3.2, z: -23.6, ry: -0.74, sx: 1.65, sy: 1.28, sz: 1.40 },
      // West coastal basalt canyon ridge
      { x: -14.8, y: -1.0, z:  -2.8, ry:  0.14, sx: 1.22, sy: 1.12, sz: 1.32 },
      { x: -15.6, y: -1.0, z:   8.0, ry: -0.18, sx: 1.28, sy: 1.22, sz: 1.35 },
      { x: -16.2, y: -0.8, z:  19.2, ry:  0.12, sx: 1.30, sy: 1.28, sz: 1.38 },
      { x: -13.6, y: -0.6, z:  30.4, ry: -0.24, sx: 1.24, sy: 1.24, sz: 1.28 },
      // Far East mountain wall across the moonlit river
      { x:  24.5, y: -1.2, z:  -1.5, ry:  2.95, sx: 1.32, sy: 1.22, sz: 1.35 },
      { x:  26.2, y: -1.2, z:  11.5, ry:  3.25, sx: 1.38, sy: 1.30, sz: 1.40 },
      { x:  25.8, y: -1.0, z:  24.5, ry:  2.85, sx: 1.36, sy: 1.28, sz: 1.38 },
      { x:  24.5, y: -0.8, z:  38.5, ry:  2.55, sx: 1.36, sy: 1.26, sz: 1.35 },
      // Northern gorge canyon continuation visible through the closed Ash Gorge Gatehouse portcullis!
      { x: -13.2, y:  0.0, z:  44.5, ry:  0.35, sx: 1.38, sy: 1.32, sz: 1.42 },
      { x: -10.5, y:  0.8, z:  58.5, ry: -0.45, sx: 1.55, sy: 1.48, sz: 1.45 },
      { x:  14.2, y:  0.4, z:  54.0, ry:  2.20, sx: 1.48, sy: 1.42, sz: 1.45 },
      { x:   1.5, y:  1.2, z:  67.5, ry:  1.15, sx: 2.10, sy: 1.45, sz: 1.55 }
    ];
    for (let i = 0; i < cliffSpecs.length; i++) {
      const cs = cliffSpecs[i];
      const cm = cloneStyled(cliffSrc, cliffBasaltMat, { castShadow: false, receiveShadow: true });
      if (cm) {
        cm.position.set(cs.x, cs.y, cs.z);
        cm.rotation.y = cs.ry;
        cm.scale.set(cs.sx, cs.sy, cs.sz);
        group.add(cm);
      }
    }

    // 11. High-Detail Sculpted Nordic Conifer Pines (separated smooth bark trunk + lush layered needle canopy!)
    const trunkA = propsMap.get('S01_Nordic_Pine_Trunk_A');
    const canopyA = propsMap.get('S01_Nordic_Pine_Canopy_A');
    const trunkB = propsMap.get('S01_Nordic_Pine_Trunk_B');
    const canopyB = propsMap.get('S01_Nordic_Pine_Canopy_B');
    for (let i = 0; i < pineSpecs.length; i++) {
      const ps = pineSpecs[i];
      const py = evalSector01TerrainY(ps.x, ps.z) - 0.28;
      const gTree = new THREE.Group();
      gTree.position.set(ps.x, py, ps.z);
      gTree.rotation.y = ps.ry;
      gTree.scale.setScalar(ps.s);
      const tMesh = cloneStyled(ps.kind === 'B' ? trunkB : trunkA, pineBarkMat, { castShadow: false, receiveShadow: true });
      const cMesh = cloneStyled(ps.kind === 'B' ? canopyB : canopyA, pineNeedleMat, { castShadow: false, receiveShadow: true });
      if (tMesh) gTree.add(tMesh);
      if (cMesh) gTree.add(cMesh);
      group.add(gTree);
    }

    return true;
  });

  let isBonfireLitState = false;
  let bonfireSmoothLit = 0.0;

  function setBonfireLit(lit) {
    isBonfireLitState = Boolean(lit);
    bonfireFlames.visible = isBonfireLitState;
    bonfireEmbers.visible = isBonfireLitState;
    sharedBonfireLit.value = isBonfireLitState ? 1.0 : 0.0;
  }

  function update(dt, elapsedSec) {
    const safeDt = Math.min(0.05, Math.max(0.001, Number(dt) || 0.016));
    const t = Number(elapsedSec) || 0;

    // 1. Smoothly breathe Shore Bonfire PointLight (gentle organic flicker, ZERO harsh pop!)
    const targetLit = isBonfireLitState ? 1.0 : 0.0;
    bonfireSmoothLit += (targetLit - bonfireSmoothLit) * (1.0 - Math.exp(-safeDt * 4.5));
    const bfFlick = 0.94 + 0.04 * Math.sin(t * 7.8) + 0.02 * Math.cos(t * 13.4);
    bonfirePointLight.intensity = lerp(2.2, 11.5, bonfireSmoothLit) * bfFlick;

    // 2. Gentle atmospheric breath on Gate Braziers & Road Lanterns
    for (let i = 0; i < staticWarmLights.length; i++) {
      const sw = staticWarmLights[i];
      const amp = sw.isBrazier ? 0.06 : 0.025;
      const spd = sw.isBrazier ? 8.2 : 4.2;
      sw.light.intensity = sw.baseInt * (1.0 + amp * Math.sin(t * spd + sw.phase));
    }

    // 3. Animate expanding shallow-water wading ripples
    for (let i = 0; i < ripplePool.length; i++) {
      const rp = ripplePool[i];
      if (!rp.mesh.visible) continue;
      rp.age += safeDt;
      const u = rp.age / rp.dur;
      if (u >= 1.0) {
        rp.mesh.visible = false;
      } else {
        rp.mat.uniforms.uProgress.value = u;
      }
    }

    // 4. Animate water splash droplets
    for (let i = activeSplashDrops.length - 1; i >= 0; i--) {
      const sd = activeSplashDrops[i];
      sd.age += safeDt;
      if (sd.age >= sd.maxAge) {
        group.remove(sd.mesh);
        activeSplashDrops.splice(i, 1);
      } else {
        sd.vy -= 9.8 * safeDt;
        sd.mesh.position.x += sd.vx * safeDt;
        sd.mesh.position.y += sd.vy * safeDt;
        sd.mesh.position.z += sd.vz * safeDt;
        if (sd.mesh.position.y < SECTOR01_WATER_LEVEL) {
          sd.mesh.position.y = SECTOR01_WATER_LEVEL;
        }
      }
    }

    // 5. Animate flying oak barrel/crate splinters
    for (let i = activeSplinters.length - 1; i >= 0; i--) {
      const sp = activeSplinters[i];
      sp.age += safeDt;
      if (sp.age >= sp.maxAge) {
        group.remove(sp.mesh);
        activeSplinters.splice(i, 1);
      } else {
        sp.vy -= 12.0 * safeDt;
        sp.mesh.position.x += sp.vx * safeDt;
        sp.mesh.position.y += sp.vy * safeDt;
        sp.mesh.position.z += sp.vz * safeDt;
        const groundY = evalSector01TerrainY(sp.mesh.position.x, sp.mesh.position.z) + 0.04;
        if (sp.mesh.position.y < groundY) {
          sp.mesh.position.y = groundY;
          sp.vy = Math.abs(sp.vy) * 0.25;
          sp.vx *= 0.65;
          sp.vz *= 0.65;
        }
        sp.mesh.rotation.x += sp.rx * safeDt;
        sp.mesh.rotation.y += sp.ry * safeDt;
        const fade = 1.0 - smoothstep(sp.maxAge * 0.72, sp.maxAge, sp.age);
        sp.mesh.scale.setScalar(Math.max(0.01, fade));
      }
    }
  }

  function dispose() {
    for (let i = 0; i < ownedGeos.length; i++) {
      try { ownedGeos[i].dispose(); } catch {}
    }
    for (let i = 0; i < ownedMats.length; i++) {
      try { ownedMats[i].dispose(); } catch {}
    }
    if (group.parent) group.parent.remove(group);
  }

  return {
    group,
    getReadyPromise: () => readyPromise,
    evalGroundY: evalSector01TerrainY,
    evalSurfaceType: evalSector01SurfaceType,
    clampPosition,
    getZoneTitleAt: () => '01 • Выход из водоотвода',
    getInteractables: () => SECTOR01_INTERACTABLES,
    getAnchors: () => SECTOR01_ANCHORS,
    getColliderCount: () => staticCircleColliders.length,
    getDestructibles: () => destructibleProps,
    setBonfireLit,
    hitDestructibles,
    resetDestructibles,
    emitWaterRipple,
    update,
    dispose
  };
}
