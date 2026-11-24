// Chapter 26 Escape Finale & Free-Roam Exterior World — «Берег Пепельного Стока»
// Pure Vanilla ES Module (Three.js r160, ZERO external textures, ZERO external imports, 60+ FPS).
//
// Exports:
//   - EXTERIOR_SHORE_ANCHORS
//   - createSoulsExteriorShore(THREE, opts = {})
//
// Builds 3 cleanly isolated 3D scenic groups under `rootGroup` controlled by `setStageMode(mode)`:
//   A) `chasmOverlayGroup`  ('chasm_only')     — Act 3: 4.6m jagged WebGL Stencil-portal chasm in the Throne Hall floor
//                                                (supports BOTH overhead view AND looking UP from inside the abyss!),
//                                                14m+ stratified vertical stone walls, smoldering crimson cracks,
//                                                torn crimson royal velvet runner flaps, buckled rim flagstones &
//                                                18 instanced tumbling stone chunks.
//   B) `shaftAndRiverGroup` ('shaft_river')    — Act 4: 24m gloomy vertical stone shaft w/ snapped beams, roots,
//                                                falling dust & distant crimson Throne Hall breach overhead ->
//                                                vaulted gothic river tunnel w/ custom GLSL rushing black river,
//                                                massive rusty iron outfall grate at z = +26m, cold moonlight beams
//                                                pouring in from outside & explosive `triggerGrateBreak()` animation.
//   C) `exteriorGroup`      ('exterior_shore') — Act 5 + Full Free-Roam Gameplay (~46x54m):
//                                                Wet basalt pebble shore, roaring subterranean outfall waterfall &
//                                                broken grate behind (z = -14m), curving animated black gorge river,
//                                                MONUMENTAL CASTLE OF ASH silhouette on the high cliff (z = -56m,
//                                                y = +18..+48m) w/ glowing crimson Throne Hall windows & rising ash
//                                                column against a huge pale moon, drifting night clouds & stars,
//                                                planted Oath Sword w/ golden beacon (x=2.8, z=5.2),
//                                                Shore Bonfire w/ coiled sword & 3D FBM fire (x=-2.2, z=15.0),
//                                                Ruined Gate of the Ash Gorge w/ twin braziers & fog wall (z=31.0),
//                                                twisted dead pines, swaying reeds, washed-up wreckage & moonlit mist.

// ============================================================================
// Pure Math, Deterministic PRNG, Terrain Height & River Course (Single Source of Truth)
// ============================================================================
const WATER_LEVEL = -0.10;
const CHASM_STENCIL_ID = 65; // 0x41: odd bit-0 masks bossRing; far outside world.js crater pool slots (3..33)

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(edge0, edge1, x) {
  const denom = edge1 - edge0;
  if (Math.abs(denom) < 1e-6) return x >= edge1 ? 1.0 : 0.0;
  const t = clamp01((x - edge0) / denom);
  return t * t * (3.0 - 2.0 * t);
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

// Smooth S-curving black river exiting the outfall arch at (0, -14) and sweeping forward-right (+X) through the gorge
function getRiverCenterX(z) {
  const t = clamp01((z + 14.0) / 20.0);
  const s = t * t * (3.0 - 2.0 * t);
  const meander = Math.sin((z - 4.0) * 0.115) * 1.45 * s;
  const drift = Math.max(0.0, z - 6.0) * 0.11;
  return s * 10.6 + drift + meander;
}

function getRiverHalfWidth(z) {
  const poolBoost = 1.0 - smoothstep(-14.0, -5.5, z);
  return 4.65 + poolBoost * 1.35 + Math.sin(z * 0.18 + 0.6) * 0.35;
}

// Distance from point (x, z) to the river water centerline / plunge pool (negative = inside water)
function getRiverSignedDist(x, z) {
  const rcx = getRiverCenterX(z);
  const rhw = getRiverHalfWidth(z);
  const dRiver = Math.abs(x - rcx) - rhw;
  // Circular churned plunge pool directly in front of the waterfall arch at (0.3, -10.5)
  const dPool = Math.hypot((x - 0.35) * 0.92, z + 10.5) - 5.5;
  return Math.min(dRiver, dPool);
}

// Ancient stone-flagstone coastal trail centerline connecting wakePos -> bonfire -> ruined gorge gate
function getPathCenterX(z) {
  const t1 = smoothstep(2.5, 15.0, z);
  const t2 = smoothstep(15.0, 31.0, z);
  const mid = lerp(0.0, -1.85, t1);
  return lerp(mid, 0.0, t2) + Math.sin(z * 0.24) * 0.45 * (1.0 - smoothstep(26.0, 31.0, z));
}

// Continuous analytical shore heightfield (EXACT match between rendered terrain mesh and physics getGroundY!)
// Guaranteed exact 0.000m at wakePos (0, 2.5)!
function evalExteriorGroundY(x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return 0;

  // Base gentle slope rising slightly from the wet outfall shoal (z=2.5, y=0) toward the Bonfire & Gorge Gate
  const northRise = smoothstep(3.2, 32.0, z) * 0.56;
  // Subtle natural coastal shingle undulation (zeroed right at wakePos so hero wakes flush on y=0.0!)
  const dWake = Math.hypot(x - 0.0, z - 2.5);
  const wakeFlatMask = smoothstep(0.9, 3.6, dWake);
  const dBonfire = Math.hypot(x + 2.2, z - 15.0);
  const bonfireFlatMask = smoothstep(1.2, 3.4, dBonfire);
  const dGate = Math.hypot(x - 0.0, z - 31.0);
  const gateFlatMask = smoothstep(1.8, 4.4, dGate);
  const padMask = wakeFlatMask * bonfireFlatMask * gateFlatMask;

  const microWave =
    (Math.sin(x * 0.42 + z * 0.29) * 0.045 +
      Math.cos(x * 0.77 - z * 0.54) * 0.025 +
      Math.sin((x + z) * 0.19) * 0.03) *
    padMask;

  let h = northRise + microWave;

  // River bed & plunge pool carve
  const rDist = getRiverSignedDist(x, z);
  if (rDist < 2.8) {
    // Smooth shallow wading shelf from rDist = +2.8 down into deep river channel (rDist < -1.8)
    const shoreT = smoothstep(-2.4, 2.6, rDist);
    const bedY = lerp(-0.78, h, shoreT);
    // Keep wakePos strictly at y=0.0 while letting water lap cleanly right beside it
    h = lerp(h, bedY, 1.0 - (1.0 - wakeFlatMask) * 0.65);
  }

  // Sculpted west basalt bank rising outside playable shore (x < -10.5)
  const westSlope = smoothstep(-10.2, -19.5, x);
  h += westSlope * westSlope * 5.2;

  // Steep basalt cliff apron behind the outfall arch (z < -11.2, avoiding the river arch cutout at |x| < 4.5)
  const archOpenMask = smoothstep(3.4, 6.2, Math.abs(x));
  const backSlope = smoothstep(-10.5, -16.2, z);
  h += backSlope * backSlope * (1.4 + 6.8 * archOpenMask);

  // Far right gorge wall across the black river (x > riverCenterX + halfW + 1.2)
  const rcx = getRiverCenterX(z);
  const rhw = getRiverHalfWidth(z);
  const eastBankT = smoothstep(rcx + rhw + 0.6, rcx + rhw + 9.5, x);
  h += eastBankT * eastBankT * 6.4;

  // Ensure exact 0.000m at wakePos (0, 2.5)
  if (dWake < 0.9) {
    h = lerp(0.0, h, smoothstep(0.25, 0.9, dWake));
  }
  return h;
}

function evalExteriorSurfaceType(x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return 'gravel';
  const y = evalExteriorGroundY(x, z);
  const rDist = getRiverSignedDist(x, z);
  if (y <= WATER_LEVEL + 0.035 || rDist <= 0.35) {
    return 'shallow_water';
  }
  // Ancient flagstone path spine & ruined gate apron -> wet_stone
  const pathX = getPathCenterX(z);
  const onTrail = z >= 5.0 && z <= 33.5 && Math.abs(x - pathX) <= 2.35;
  const nearGate = Math.hypot(x, z - 31.0) <= 4.4;
  const nearShoalRim = rDist <= 2.15 || Math.hypot(x, z - 2.5) <= 2.1;
  if (onTrail || nearGate || nearShoalRim) {
    return 'wet_stone';
  }
  return 'gravel';
}

// Walkable perimeter + landmark colliders (kept 100% consistent with placed 3D props!)
const EXTERIOR_STATIC_COLLIDERS = Object.freeze([
  // Shore Bonfire hearth stone ring
  { x: -2.2, z: 15.0, r: 1.18 },
  // Ruined Gate of the Ash Gorge piers & flanking braziers
  { x: -3.85, z: 31.0, r: 1.48 },
  { x:  3.85, z: 31.0, r: 1.48 },
  { x: -3.55, z: 29.3, r: 0.66 },
  { x:  3.55, z: 29.3, r: 0.66 },
  // Prominent walkable-edge coastal boulders & dead pine trunks
  { x: -8.6, z:  0.8, r: 1.45 },
  { x: -9.4, z:  8.5, r: 1.55 },
  { x: -9.8, z: 18.8, r: 1.60 },
  { x: -8.8, z: 26.4, r: 1.55 },
  { x: -5.4, z: -2.6, r: 1.35 },
  { x:  6.4, z: 23.2, r: 1.25 },
  // Washed-up broken hull / driftwood snag on the west-south bank
  { x: -6.2, z:  5.8, r: 1.20 }
]);

function clampExteriorPosition(x, z, r = 0.55) {
  let px = Number.isFinite(x) ? x : 0.0;
  let pz = Number.isFinite(z) ? z : 2.5;
  const rad = Number.isFinite(r) ? Math.max(0.15, r) : 0.55;

  // Hard outer playable rectangle bounds (x in [-22..+22], z in [-16..+36])
  px = clamp(px, -22.0 + rad, 22.0 - rad);
  pz = clamp(pz, -16.0 + rad, 36.0 - rad);

  // Organic north/south gorge ends: stop cleanly before deep plunge pool & closed Ash Gorge fog gate
  const minZWall = -4.2 + smoothstep(-8.0, 2.0, px) * 0.8 + rad;
  const maxZWall = 32.1 - rad;
  if (pz < minZWall) pz = minZWall;
  if (pz > maxZWall) pz = maxZWall;

  // West basalt cliff wall curve (tighter near outfall & gate, wide coastal terrace in the middle)
  const leftCliffX =
    -11.2 +
    (1.0 - smoothstep(-4.0, 4.0, pz)) * 3.0 +
    smoothstep(25.5, 32.5, pz) * 5.2 +
    Math.sin(pz * 0.27) * 0.65;
  if (px < leftCliffX + rad) {
    px = leftCliffX + rad;
  }

  // Right rushing black river deep channel boundary (allows wading ~1.4m into shallow water edge!)
  const rcx = getRiverCenterX(pz);
  const rhw = getRiverHalfWidth(pz);
  const maxRiverX = Math.min(rcx - rhw + 1.35, 11.8) - rad;
  if (px > maxRiverX) {
    px = maxRiverX;
  }

  // Keep player out of the deep boiling outfall plunge pool behind wakePos
  const poolCx = 0.45;
  const poolCz = -9.6;
  const poolMinR = 5.65 + rad;
  const pdx = px - poolCx;
  const pdz = pz - poolCz;
  const pDist = Math.hypot(pdx, pdz);
  if (pDist < poolMinR) {
    if (pDist > 1e-4) {
      px = poolCx + (pdx / pDist) * poolMinR;
      pz = poolCz + (pdz / pDist) * poolMinR;
    } else {
      pz = poolCz + poolMinR;
    }
  }

  // Solid circle colliders (bonfire hearth, ruined gate piers, coastal boulders & wreckage)
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < EXTERIOR_STATIC_COLLIDERS.length; i++) {
      const c = EXTERIOR_STATIC_COLLIDERS[i];
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
  }

  // Final box safety clamp
  px = clamp(px, -22.0 + rad, 22.0 - rad);
  pz = clamp(pz, -16.0 + rad, 36.0 - rad);
  return { x: px, z: pz };
}

export const EXTERIOR_SHORE_ANCHORS = Object.freeze({
  wakePos: Object.freeze({ x: 0.0, y: evalExteriorGroundY(0.0, 2.5), z: 2.5 }),
  swordPos: Object.freeze({ x: 2.8, y: evalExteriorGroundY(2.8, 5.2), z: 5.2 }),
  bonfirePos: Object.freeze({ x: -2.2, y: evalExteriorGroundY(-2.2, 15.0), z: 15.0 }),
  gatePos: Object.freeze({ x: 0.0, y: evalExteriorGroundY(0.0, 31.0), z: 31.0 }),
  waterfallPos: Object.freeze({ x: 0.0, y: 0.0, z: -14.0 }),
  castlePos: Object.freeze({ x: 0.0, y: 18.0, z: -56.0 }),
  shaftCenter: Object.freeze({ x: 0.0, y: 0.0, z: 0.0 }),
  gratePos: Object.freeze({ x: 0.0, y: 1.8, z: 26.0 }),
  bounds: Object.freeze({ minX: -22.0, maxX: 22.0, minZ: -16.0, maxZ: 36.0 })
});

// ============================================================================
// Jagged Chasm Rim Curve (shared 1:1 between stencil aperture, shaft walls & rim crack shader)
// ============================================================================
function evalChasmEdgeR(theta) {
  return (
    2.28 +
    0.18 * Math.sin(theta * 5.0 + 0.35) +
    0.13 * Math.cos(theta * 8.0 - 0.85) +
    0.09 * Math.sin(theta * 13.0 + 1.55) +
    0.05 * Math.cos(theta * 19.0 - 0.4)
  );
}

// ============================================================================
// Procedural PBR Texture Suite (Zero External Assets, Anti-Shimmer Sobel Normals)
// ============================================================================
function createCanvas2D(w, h) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function createFallbackTex(THREE, r, g, b, a, isColor, repeat = true) {
  const data = new Uint8Array([r, g, b, a, r, g, b, a, r, g, b, a, r, g, b, a]);
  const tex = new THREE.DataTexture(data, 2, 2, THREE.RGBAFormat);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function finalizeCanvasTex(THREE, canvas, { isColor = true, repeat = true, anisotropy = 4 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

function buildSobelNormalTex(THREE, heightField, w, h, strength, anisotropy, repeat = true) {
  const data = new Uint8Array(w * h * 4);
  const wm = w - 1;
  const hm = h - 1;
  const r2 = Math.max(2, Math.round(w / 256) * 2);
  for (let y = 0; y < h; y++) {
    const ym1 = ((y - 1) & hm) * w;
    const y0 = y * w;
    const yp1 = ((y + 1) & hm) * w;
    const ym2 = ((y - r2) & hm) * w;
    const yp2 = ((y + r2) & hm) * w;
    const dstRow = (hm - y) * w;
    for (let x = 0; x < w; x++) {
      const xm1 = (x - 1) & wm;
      const xp1 = (x + 1) & wm;
      const xm2 = (x - r2) & wm;
      const xp2 = (x + r2) & wm;

      const dx1 =
        (heightField[ym1 + xp1] + 2 * heightField[y0 + xp1] + heightField[yp1 + xp1]) -
        (heightField[ym1 + xm1] + 2 * heightField[y0 + xm1] + heightField[yp1 + xm1]);
      const dy1 =
        (heightField[yp1 + xm1] + 2 * heightField[yp1 + x] + heightField[yp1 + xp1]) -
        (heightField[ym1 + xm1] + 2 * heightField[ym1 + x] + heightField[ym1 + xp1]);

      const dx2 = heightField[y0 + xp2] - heightField[y0 + xm2];
      const dy2 = heightField[yp2 + x] - heightField[ym2 + x];

      let nx = -(dx1 * strength + dx2 * strength * 1.4);
      let ny =  (dy1 * strength + dy2 * strength * 1.4);
      const invLen = 1.0 / Math.sqrt(nx * nx + ny * ny + 1.0);
      nx *= invLen;
      ny *= invLen;
      const idx = (dstRow + x) * 4;
      data[idx]     = (nx * 127.5 + 127.5) | 0;
      data[idx + 1] = (ny * 127.5 + 127.5) | 0;
      data[idx + 2] = (invLen * 127.5 + 127.5) | 0;
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.flipY = false;
  tex.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

function buildOrmTex(THREE, aoField, roughField, w, h, anisotropy, repeat = true) {
  const data = new Uint8Array(w * h * 4);
  const hm = h - 1;
  for (let y = 0; y < h; y++) {
    const srcRow = y * w;
    const dstRow = (hm - y) * w;
    for (let x = 0; x < w; x++) {
      const si = srcRow + x;
      const aoB = (clamp01(aoField[si]) * 255 + 0.5) | 0;
      const rgB = (clamp01(roughField[si]) * 255 + 0.5) | 0;
      const idx = (dstRow + x) * 4;
      data[idx]     = aoB; // .r = aoMap
      data[idx + 1] = rgB; // .g = roughnessMap
      data[idx + 2] = rgB;
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.flipY = false;
  tex.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

// Fast tileable 2D value noise helper
function makeNoiseSampler(gridSize, seed) {
  const rng = makeRng(seed);
  const grid = new Float32Array(gridSize * gridSize);
  for (let i = 0; i < grid.length; i++) grid[i] = rng();
  const mask = gridSize - 1;
  return (u, v) => {
    const gx = u * gridSize;
    const gy = v * gridSize;
    const x0 = Math.floor(gx) & mask;
    const y0 = Math.floor(gy) & mask;
    const x1 = (x0 + 1) & mask;
    const y1 = (y0 + 1) & mask;
    const fx = gx - Math.floor(gx);
    const fy = gy - Math.floor(gy);
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const r0 = y0 * gridSize;
    const r1 = y1 * gridSize;
    const n0 = grid[r0 + x0] + (grid[r0 + x1] - grid[r0 + x0]) * sx;
    const n1 = grid[r1 + x0] + (grid[r1 + x1] - grid[r1 + x0]) * sx;
    return n0 + (n1 - n0) * sy;
  };
}

// 1) Wet Coastal Pebble & Dark Slate Shingle PBR (Shore Terrain)
function buildShorePebblePbr(THREE, size, anisotropy, trackTex) {
  const c = createCanvas2D(size, size);
  const hc = createCanvas2D(size, size);
  if (!c || !hc) {
    const fbA = trackTex(createFallbackTex(THREE, 46, 50, 60, 255, true));
    const fbN = trackTex(createFallbackTex(THREE, 128, 128, 255, 255, false));
    const fbO = trackTex(createFallbackTex(THREE, 210, 175, 175, 255, false));
    return { albedo: fbA, normal: fbN, orm: fbO };
  }
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const hctx = hc.getContext('2d', { willReadFrequently: true });
  const rng = makeRng(774101);
  const sc = size / 512;

  // Damp dark volcanic silt & slate grit bed
  ctx.fillStyle = '#181c24';
  ctx.fillRect(0, 0, size, size);
  hctx.fillStyle = '#1c1c1c';
  hctx.fillRect(0, 0, size, size);

  const tones = [
    [44, 49, 60],
    [54, 59, 71],
    [36, 40, 50],
    [62, 65, 76],
    [48, 54, 62],
    [42, 48, 52], // faint damp olive-slate pebble
    [70, 74, 86]
  ];

  const drawWrapped = (fn, x, y, r) => {
    const ox0 = x + r > size ? -size : 0;
    const ox1 = x - r < 0 ? size : 0;
    const oy0 = y + r > size ? -size : 0;
    const oy1 = y - r < 0 ? size : 0;
    for (let ox = ox0; ox <= ox1; ox += size) {
      for (let oy = oy0; oy <= oy1; oy += size) {
        ctx.save();
        hctx.save();
        ctx.translate(ox, oy);
        hctx.translate(ox, oy);
        fn();
        ctx.restore();
        hctx.restore();
      }
    }
  };

  // Layer 1: flat weathered river flagstones & broad slate cobbles
  const cobbleCount = Math.round(95 * (size >= 1024 ? 1.3 : 1.0));
  for (let i = 0; i < cobbleCount; i++) {
    const cx = rng() * size;
    const cy = rng() * size;
    const rx = (12 + rng() * 24) * sc;
    const ry = (9 + rng() * 17) * sc;
    const rot = rng() * Math.PI;
    const t = tones[Math.floor(rng() * tones.length)];
    const sh = Math.floor((rng() - 0.5) * 14);
    const rr = clamp(t[0] + sh, 20, 96);
    const gg = clamp(t[1] + sh, 22, 100);
    const bb = clamp(t[2] + sh, 28, 114);
    const hv = Math.round(125 + rng() * 88);

    drawWrapped(() => {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${rr},${gg},${bb})`;
      ctx.fill();
      ctx.strokeStyle = 'rgba(6,8,12,0.55)';
      ctx.lineWidth = 2.0 * sc;
      ctx.stroke();

      const g = hctx.createRadialGradient(cx, cy, rx * 0.1, cx, cy, Math.max(rx, ry));
      g.addColorStop(0, `rgb(${hv},${hv},${hv})`);
      g.addColorStop(0.78, `rgb(${Math.round(hv * 0.72)},${Math.round(hv * 0.72)},${Math.round(hv * 0.72)})`);
      g.addColorStop(1, 'rgb(28,28,28)');
      hctx.beginPath();
      hctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
      hctx.fillStyle = g;
      hctx.fill();
    }, cx, cy, Math.max(rx, ry) + 4 * sc);
  }

  // Layer 2: dense multi-scale river pebbles & shingle
  const pebbleCount = Math.round(420 * (size >= 1024 ? 1.35 : 1.0));
  for (let i = 0; i < pebbleCount; i++) {
    const cx = rng() * size;
    const cy = rng() * size;
    const rx = (3.2 + rng() * 9.5) * sc;
    const ry = rx * (0.58 + rng() * 0.42);
    const rot = rng() * Math.PI;
    const t = tones[Math.floor(rng() * tones.length)];
    const sh = Math.floor((rng() - 0.5) * 24);
    const rr = clamp(t[0] + sh, 18, 112);
    const gg = clamp(t[1] + sh, 20, 116);
    const bb = clamp(t[2] + sh, 24, 128);
    const hv = Math.round(140 + rng() * 100);

    drawWrapped(() => {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${rr},${gg},${bb})`;
      ctx.fill();
      ctx.strokeStyle = 'rgba(5,7,11,0.45)';
      ctx.lineWidth = Math.max(1, 1.1 * sc);
      ctx.stroke();

      hctx.beginPath();
      hctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
      hctx.fillStyle = `rgb(${hv},${hv},${hv})`;
      hctx.fill();
    }, cx, cy, rx + 2 * sc);
  }

  const aImg = ctx.getImageData(0, 0, size, size);
  const aPix = aImg.data;
  const hPix = hctx.getImageData(0, 0, size, size).data;
  const total = size * size;
  const heightF = new Float32Array(total);
  const roughF = new Float32Array(total);
  const aoF = new Float32Array(total);
  const nWet = makeNoiseSampler(16, 4401);
  const nGrain = makeNoiseSampler(64, 4402);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const row = y * size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = row + x;
      const p4 = idx * 4;
      const bh = hPix[p4] * (1 / 255);
      const gr = nGrain(u * 4, v * 4);
      const wet = nWet(u * 2, v * 2);
      heightF[idx] = clamp01(bh * 0.86 + gr * 0.14);
      aoF[idx] = clamp01(0.42 + bh * 0.58);
      // Wet smooth pebbles glisten subtly (0.48..0.68), dark silt stays matte (0.86)
      roughF[idx] = clamp01(lerp(0.88, 0.52 + (1.0 - wet) * 0.22, smoothstep(0.18, 0.72, bh)));
      const grainMod = 0.88 + gr * 0.24;
      aPix[p4]     = clamp(aPix[p4] * grainMod, 0, 255) | 0;
      aPix[p4 + 1] = clamp(aPix[p4 + 1] * grainMod, 0, 255) | 0;
      aPix[p4 + 2] = clamp(aPix[p4 + 2] * grainMod, 0, 255) | 0;
    }
  }
  ctx.putImageData(aImg, 0, 0);

  const albedo = trackTex(finalizeCanvasTex(THREE, c, { isColor: true, repeat: true, anisotropy }));
  const normal = trackTex(buildSobelNormalTex(THREE, heightF, size, size, 1.35, anisotropy, true));
  const orm = trackTex(buildOrmTex(THREE, aoF, roughF, size, size, anisotropy, true));
  hc.width = 1;
  hc.height = 1;
  return { albedo, normal, orm };
}

// 2) Stratified Wet Black Basalt & Gothic Ashlar Masonry PBR (Cliffs, Shaft, Outfall Arch, Gate)
function buildWetBasaltPbr(THREE, size, anisotropy, trackTex) {
  const c = createCanvas2D(size, size);
  const hc = createCanvas2D(size, size);
  if (!c || !hc) {
    const fbA = trackTex(createFallbackTex(THREE, 42, 46, 56, 255, true));
    const fbN = trackTex(createFallbackTex(THREE, 128, 128, 255, 255, false));
    const fbO = trackTex(createFallbackTex(THREE, 200, 190, 190, 255, false));
    return { albedo: fbA, normal: fbN, orm: fbO };
  }
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const hctx = hc.getContext('2d', { willReadFrequently: true });
  const rng = makeRng(882103);
  const sc = size / 512;

  ctx.fillStyle = '#12151d';
  ctx.fillRect(0, 0, size, size);
  hctx.fillStyle = '#141414';
  hctx.fillRect(0, 0, size, size);

  // Horizontal fractured basalt & gothic ashlar strata courses
  const rows = 8;
  const rowH = size / rows;
  for (let r = 0; r < rows; r++) {
    const cols = 3 + (r % 2);
    const colW = size / cols;
    const xOff = (r % 2) * colW * 0.45;
    for (let k = -1; k <= cols; k++) {
      const bx = k * colW + xOff + 3 * sc;
      const by = r * rowH + 3 * sc;
      const bw = colW - 6 * sc;
      const bh = rowH - 6 * sc;
      const base = 38 + Math.floor(rng() * 24);
      const blu = base + 8 + Math.floor(rng() * 8);
      const hv = Math.round(135 + rng() * 95);

      const g = ctx.createLinearGradient(bx, by, bx, by + bh);
      g.addColorStop(0, `rgb(${base + 12},${base + 14},${blu + 14})`);
      g.addColorStop(0.55, `rgb(${base},${base + 2},${blu})`);
      g.addColorStop(1, `rgb(${Math.max(14, base - 12)},${Math.max(16, base - 10)},${Math.max(20, blu - 8)})`);
      ctx.fillStyle = g;
      ctx.fillRect(bx, by, bw, bh);

      // Subtle damp green-charcoal cliff moss along upper ledges
      if (rng() < 0.35) {
        ctx.fillStyle = 'rgba(26, 46, 36, 0.28)';
        ctx.fillRect(bx, by, bw, bh * (0.22 + rng() * 0.2));
      }

      // Deep fracture lines across basalt blocks
      ctx.strokeStyle = 'rgba(5,7,12,0.75)';
      ctx.lineWidth = (1.6 + rng() * 1.4) * sc;
      ctx.beginPath();
      const fx = bx + bw * (0.2 + rng() * 0.6);
      ctx.moveTo(fx, by);
      ctx.lineTo(fx + (rng() - 0.5) * 18 * sc, by + bh * 0.5);
      ctx.lineTo(fx + (rng() - 0.5) * 24 * sc, by + bh);
      ctx.stroke();

      hctx.fillStyle = `rgb(${hv},${hv},${hv})`;
      hctx.fillRect(bx + 2 * sc, by + 2 * sc, Math.max(2, bw - 4 * sc), Math.max(2, bh - 4 * sc));
      hctx.strokeStyle = 'rgb(20,20,20)';
      hctx.lineWidth = 3.2 * sc;
      hctx.beginPath();
      hctx.moveTo(fx, by);
      hctx.lineTo(fx + (rng() - 0.5) * 18 * sc, by + bh * 0.5);
      hctx.lineTo(fx + (rng() - 0.5) * 24 * sc, by + bh);
      hctx.stroke();
    }
  }

  const aImg = ctx.getImageData(0, 0, size, size);
  const aPix = aImg.data;
  const hPix = hctx.getImageData(0, 0, size, size).data;
  const total = size * size;
  const heightF = new Float32Array(total);
  const roughF = new Float32Array(total);
  const aoF = new Float32Array(total);
  const nBroad = makeNoiseSampler(16, 8821);
  const nFine = makeNoiseSampler(64, 8822);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const row = y * size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = row + x;
      const p4 = idx * 4;
      const bh = hPix[p4] * (1 / 255);
      const nb = nBroad(u * 2, v * 2);
      const nf = nFine(u * 5, v * 5);
      heightF[idx] = clamp01(bh * 0.72 + nb * 0.16 + nf * 0.12);
      aoF[idx] = clamp01(0.36 + bh * 0.64);
      // Damp glossy streaks vs rough weathered stone (anti-shimmer range 0.56..0.92)
      roughF[idx] = clamp01(0.58 + (1.0 - nb) * 0.24 + (1.0 - bh) * 0.12);
      const mod = 0.80 + nb * 0.24 + nf * 0.16;
      aPix[p4]     = clamp(aPix[p4] * mod, 0, 255) | 0;
      aPix[p4 + 1] = clamp(aPix[p4 + 1] * mod, 0, 255) | 0;
      aPix[p4 + 2] = clamp(aPix[p4 + 2] * mod, 0, 255) | 0;
    }
  }
  ctx.putImageData(aImg, 0, 0);

  const albedo = trackTex(finalizeCanvasTex(THREE, c, { isColor: true, repeat: true, anisotropy }));
  const normal = trackTex(buildSobelNormalTex(THREE, heightF, size, size, 1.45, anisotropy, true));
  const orm = trackTex(buildOrmTex(THREE, aoF, roughF, size, size, anisotropy, true));
  hc.width = 1;
  hc.height = 1;
  return { albedo, normal, orm };
}

// 2b) Natural Jagged Volcanic Basalt Cliff Rock PBR (ZERO brick grid! Stratified cliff rock + vertical fissures + damp moss!)
function buildNaturalCliffPbr(THREE, size, anisotropy, trackTex) {
  const c = createCanvas2D(size, size);
  if (!c) {
    const fbA = trackTex(createFallbackTex(THREE, 34, 39, 49, 255, true));
    const fbN = trackTex(createFallbackTex(THREE, 128, 128, 255, 255, false));
    const fbO = trackTex(createFallbackTex(THREE, 195, 195, 195, 255, false));
    return { albedo: fbA, normal: fbN, orm: fbO };
  }
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const aImg = ctx.createImageData(size, size);
  const aPix = aImg.data;
  const total = size * size;
  const heightF = new Float32Array(total);
  const roughF = new Float32Array(total);
  const aoF = new Float32Array(total);

  const nStrata = makeNoiseSampler(16, 6101);
  const nCrag = makeNoiseSampler(32, 6102);
  const nFine = makeNoiseSampler(64, 6103);
  const nMoss = makeNoiseSampler(16, 6104);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const row = y * size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = row + x;
      const p4 = idx * 4;

      const warp = nStrata(u * 2, v * 2) * 0.28;
      // Vertical columnar basalt & diagonal fractured cliff strata
      const colWave = nCrag(u * 5 + warp, v * 1.5);
      const ledgeWave = nCrag(u * 1.8, v * 6 + warp * 1.4);
      const fine = nFine(u * 8, v * 8);
      const ridge = 1.0 - Math.abs(colWave * 2.0 - 1.0);
      const fissure = Math.pow(clamp01(ridge), 5.0);
      const ledgeCrack = Math.pow(clamp01(1.0 - Math.abs(ledgeWave * 2.0 - 1.0)), 6.0);

      const hVal = clamp01(0.56 + (colWave - 0.5) * 0.36 + (ledgeWave - 0.5) * 0.24 + (fine - 0.5) * 0.16 - fissure * 0.42 - ledgeCrack * 0.34);
      heightF[idx] = hVal;
      aoF[idx] = clamp01(0.30 + hVal * 0.70);

      const mossNoise = nMoss(u * 3, v * 3);
      const mossMask = smoothstep(0.62, 0.86, mossNoise) * smoothstep(0.35, 0.72, hVal);
      const wetStreak = smoothstep(0.58, 0.85, nStrata(u * 4, v * 1));

      // Dark blue-charcoal coastal volcanic basalt + subtle damp olive cliff lichen
      let r = lerp(22, 62, hVal) * (0.85 + fine * 0.30);
      let g = lerp(25, 67, hVal) * (0.85 + fine * 0.30);
      let b = lerp(33, 82, hVal) * (0.85 + fine * 0.30);
      r = lerp(r, 34, mossMask * 0.55);
      g = lerp(g, 52, mossMask * 0.55);
      b = lerp(b, 40, mossMask * 0.55);

      aPix[p4]     = clamp(r, 0, 255) | 0;
      aPix[p4 + 1] = clamp(g, 0, 255) | 0;
      aPix[p4 + 2] = clamp(b, 0, 255) | 0;
      aPix[p4 + 3] = 255;

      // Anti-shimmer matte volcanic basalt (0.74..0.94 — zero white pixel glitter on grazing moonlight!)
      roughF[idx] = clamp01(lerp(0.92, 0.74, wetStreak * 0.65) + mossMask * 0.06);
    }
  }
  ctx.putImageData(aImg, 0, 0);
  const albedo = trackTex(finalizeCanvasTex(THREE, c, { isColor: true, repeat: true, anisotropy }));
  const normal = trackTex(buildSobelNormalTex(THREE, heightF, size, size, 1.85, anisotropy, true));
  const orm = trackTex(buildOrmTex(THREE, aoF, roughF, size, size, anisotropy, true));
  return { albedo, normal, orm };
}

// 3) Corroded Rusty Forged Iron PBR (Outfall Grate, Chains, Braziers)
function buildRustyIronPbr(THREE, size, anisotropy, trackTex) {
  const c = createCanvas2D(size, size);
  if (!c) {
    const fbA = trackTex(createFallbackTex(THREE, 68, 52, 46, 255, true));
    const fbN = trackTex(createFallbackTex(THREE, 128, 128, 255, 255, false));
    const fbO = trackTex(createFallbackTex(THREE, 210, 175, 175, 255, false));
    return { albedo: fbA, normal: fbN, orm: fbO };
  }
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const aImg = ctx.createImageData(size, size);
  const aPix = aImg.data;
  const total = size * size;
  const heightF = new Float32Array(total);
  const roughF = new Float32Array(total);
  const aoF = new Float32Array(total);
  const n1 = makeNoiseSampler(16, 3311);
  const n2 = makeNoiseSampler(32, 3312);
  const n3 = makeNoiseSampler(64, 3313);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const row = y * size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = row + x;
      const p4 = idx * 4;
      const f1 = n1(u * 2, v * 2);
      const f2 = n2(u * 4, v * 4);
      const f3 = n3(u * 6, v * 6);
      const rustMask = smoothstep(0.42, 0.78, f1 * 0.62 + f2 * 0.28 + f3 * 0.10);
      // Cold pitted iron vs deep burnt-oxide river rust
      const r = lerp(42, 118, rustMask) * (0.85 + f3 * 0.30);
      const g = lerp(46, 56, rustMask) * (0.85 + f3 * 0.30);
      const b = lerp(55, 34, rustMask) * (0.85 + f3 * 0.30);
      aPix[p4]     = clamp(r, 0, 255) | 0;
      aPix[p4 + 1] = clamp(g, 0, 255) | 0;
      aPix[p4 + 2] = clamp(b, 0, 255) | 0;
      aPix[p4 + 3] = 255;
      heightF[idx] = clamp01(0.55 - rustMask * 0.24 + (f2 - 0.5) * 0.25 + (f3 - 0.5) * 0.18);
      aoF[idx] = clamp01(0.65 + heightF[idx] * 0.35);
      roughF[idx] = clamp01(lerp(0.54, 0.91, rustMask));
    }
  }
  ctx.putImageData(aImg, 0, 0);
  const albedo = trackTex(finalizeCanvasTex(THREE, c, { isColor: true, repeat: true, anisotropy }));
  const normal = trackTex(buildSobelNormalTex(THREE, heightF, size, size, 1.25, anisotropy, true));
  const orm = trackTex(buildOrmTex(THREE, aoF, roughF, size, size, anisotropy, true));
  return { albedo, normal, orm };
}

// 4) Torn Royal Crimson-and-Gold Velvet Carpet Texture (for Chasm Drape)
function buildTornCarpetTex(THREE, size, anisotropy, trackTex) {
  const c = createCanvas2D(size, size);
  if (!c) return trackTex(createFallbackTex(THREE, 112, 22, 32, 255, true));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#5c121b';
  ctx.fillRect(0, 0, size, size);

  // Subtle gothic damask diamond weave
  ctx.strokeStyle = 'rgba(130, 26, 36, 0.45)';
  ctx.lineWidth = Math.max(1, size / 128);
  const step = size / 8;
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      ctx.beginPath();
      ctx.moveTo(x + step * 0.5, y);
      ctx.lineTo(x + step, y + step * 0.5);
      ctx.lineTo(x + step * 0.5, y + step);
      ctx.lineTo(x, y + step * 0.5);
      ctx.closePath();
      ctx.stroke();
    }
  }
  // Tarnished gold embroidered runner borders along u near 0 and 1
  const bw = size * 0.085;
  ctx.fillStyle = '#8b6a2c';
  ctx.fillRect(size * 0.03, 0, bw * 0.35, size);
  ctx.fillRect(size * 0.08, 0, bw * 0.18, size);
  ctx.fillRect(size * (1 - 0.03) - bw * 0.35, 0, bw * 0.35, size);
  ctx.fillRect(size * (1 - 0.08) - bw * 0.18, 0, bw * 0.18, size);

  // Charred soot & dust staining near torn edges
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0.0, 'rgba(8, 6, 8, 0.55)');
  grad.addColorStop(0.25, 'rgba(18, 8, 10, 0.10)');
  grad.addColorStop(0.75, 'rgba(14, 7, 9, 0.18)');
  grad.addColorStop(1.0, 'rgba(6, 5, 8, 0.72)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  return trackTex(finalizeCanvasTex(THREE, c, { isColor: true, repeat: false, anisotropy }));
}

// 5) Soft Multi-Lobe Radial Mist / Spray Sprite Texture (Zero Hard Square Edges!)
function buildSoftMistSpriteTex(THREE, trackTex) {
  const size = 256;
  const c = createCanvas2D(size, size);
  if (!c) return trackTex(createFallbackTex(THREE, 220, 232, 245, 160, true, false));
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const lobes = [
    [0.50, 0.50, 0.44, 0.42],
    [0.36, 0.46, 0.32, 0.28],
    [0.64, 0.54, 0.32, 0.28],
    [0.48, 0.36, 0.28, 0.22],
    [0.54, 0.65, 0.28, 0.22]
  ];
  for (let i = 0; i < lobes.length; i++) {
    const [ux, uy, ur, a] = lobes[i];
    const g = ctx.createRadialGradient(ux * size, uy * size, 2, ux * size, uy * size, ur * size);
    g.addColorStop(0.0, `rgba(255,255,255,${a})`);
    g.addColorStop(0.5, `rgba(255,255,255,${(a * 0.42).toFixed(3)})`);
    g.addColorStop(1.0, 'rgba(255,255,255,0.0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ux * size, uy * size, ur * size, 0, Math.PI * 2);
    ctx.fill();
  }
  return trackTex(finalizeCanvasTex(THREE, c, { isColor: true, repeat: false, anisotropy: 2 }));
}

// ============================================================================
// Zero-Dependency BufferGeometry Helpers (Uses Passed THREE Instance Only!)
// ============================================================================
function xformGeo(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  if (sx !== 1 || sy !== 1 || sz !== 1) geo.scale(sx, sy, sz);
  if (rx !== 0) geo.rotateX(rx);
  if (ry !== 0) geo.rotateY(ry);
  if (rz !== 0) geo.rotateZ(rz);
  if (x !== 0 || y !== 0 || z !== 0) geo.translate(x, y, z);
  return geo;
}

function applyBoxUVs(geo, tileScale = 3.2) {
  const pos = geo.attributes.position;
  const norm = geo.attributes.normal;
  if (!pos || !norm) return geo;
  let uv = geo.attributes.uv;
  if (!uv) {
    uv = new pos.constructor(new Float32Array(pos.count * 2), 2);
    geo.setAttribute('uv', uv);
  }
  const inv = 1.0 / Math.max(0.05, tileScale);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ax = Math.abs(norm.getX(i));
    const ay = Math.abs(norm.getY(i));
    const az = Math.abs(norm.getZ(i));
    if (ay >= ax && ay >= az) {
      uv.setXY(i, x * inv, z * inv);
    } else if (ax >= az) {
      uv.setXY(i, z * inv, y * inv);
    } else {
      uv.setXY(i, x * inv, y * inv);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

function mergeNonIndexedGeos(THREE, rawList, { boxUvTile = 0, withColor = false } = {}) {
  if (!rawList || rawList.length === 0) return null;
  const parts = [];
  let totalVerts = 0;
  for (let i = 0; i < rawList.length; i++) {
    const raw = rawList[i];
    if (!raw || !raw.attributes?.position) continue;
    const g = raw.index ? raw.toNonIndexed() : raw.clone();
    if (!g.attributes.normal) g.computeVertexNormals();
    if (boxUvTile > 0) applyBoxUVs(g, boxUvTile);
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
    if (colOut && g.attributes.color) {
      colOut.set(g.attributes.color.array, offset * 3);
    }
    offset += cnt;
    g.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(posOut, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normOut, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvOut, 2));
  if (colOut) {
    merged.setAttribute('color', new THREE.BufferAttribute(colOut, 3));
  }
  merged.computeBoundingSphere();
  return merged;
}

function tintGeo(THREE, rawGeo, topHex, bottomHex = null, jitter = 0.0, rng = null) {
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
    const j = jitter > 0 && rng ? (1.0 + (rng() - 0.5) * 2.0 * jitter) : 1.0;
    cols[i * 3]     = clamp01(lerp(cBot.r, cTop.r, t) * j);
    cols[i * 3 + 1] = clamp01(lerp(cBot.g, cTop.g, t) * j);
    cols[i * 3 + 2] = clamp01(lerp(cBot.b, cTop.b, t) * j);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return g;
}

// Sculpt an angular faceted basalt boulder / craggy cliff spire (zero smooth eggs!)
function buildSculptedRockGeo(THREE, radius = 1.0, seed = 1, flattenY = 0.72, detail = 1) {
  const rng = makeRng(seed);
  const geo = new THREE.IcosahedronGeometry(radius, detail);
  const pos = geo.attributes.position;
  const p1 = rng() * 6.28, p2 = rng() * 6.28, p3 = rng() * 6.28;
  const isTallCliff = flattenY > 1.05;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const len = Math.hypot(x, y, z) || 1;
    const nx = x / len, ny = y / len, nz = z / len;
    const strata = Math.sin(ny * 6.2 + p1) * 0.16;
    const crag = Math.sin(nx * 4.4 + nz * 4.8 + p2) * Math.cos(nz * 3.9 - ny * 3.2 + p3) * 0.26;
    const ridge = Math.abs(Math.sin(Math.atan2(nz, nx) * 3.0 + p3)) * 0.14;
    // Tall coastal cliffs taper into sharp jagged volcanic ridges instead of egg domes!
    const spireTaper = isTallCliff ? (1.08 - smoothstep(-0.2, 0.95, ny) * 0.42) : 1.0;
    const k = (0.84 + strata + crag + ridge) * spireTaper;
    x *= k;
    z *= k;
    y *= (0.86 + strata * 0.6 + crag * 0.5) * flattenY;
    // Slight flat bottom seating so boulders ground cleanly into terrain
    if (y < -radius * flattenY * 0.45) y = -radius * flattenY * 0.45 + (y + radius * flattenY * 0.45) * 0.25;
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

// ============================================================================
// Main Factory: createSoulsExteriorShore(THREE, opts = {})
// ============================================================================
export function createSoulsExteriorShore(THREE, opts = {}) {
  if (!THREE) {
    throw new Error('createSoulsExteriorShore(THREE, opts): THREE instance is required');
  }

  const isMobile = opts.isMobile !== undefined
    ? Boolean(opts.isMobile)
    : (typeof navigator !== 'undefined' && /iPhone|iPod|iPad|Android/i.test(navigator.userAgent || ''));
  let lowSpecMode = Boolean(opts.lowSpec);
  const anisotropy = isMobile ? 2 : 4;
  const externalPbr = opts.pbr || null;

  // Zero-leak resource registry
  const ownedGeos = [];
  const ownedMats = [];
  const ownedTex = [];
  const trackGeo = (g) => { if (g) ownedGeos.push(g); return g; };
  const trackMat = (m) => { if (m) ownedMats.push(m); return m; };
  const trackTex = (t) => { if (t) ownedTex.push(t); return t; };

  // Procedural PBR texture maps (1024px PC / 512px Mobile for stone & shingle, 512px/256px for iron & carpet)
  const stoneTexRes = isMobile ? 512 : 1024;
  const ironTexRes = isMobile ? 256 : 512;
  const shorePbr = buildShorePebblePbr(THREE, stoneTexRes, anisotropy, trackTex);
  const basaltPbr = buildWetBasaltPbr(THREE, stoneTexRes, anisotropy, trackTex);
  const cliffPbr = buildNaturalCliffPbr(THREE, stoneTexRes, anisotropy, trackTex);
  const ironPbr = buildRustyIronPbr(THREE, ironTexRes, anisotropy, trackTex);
  const carpetTex = externalPbr?.carpetAlbedo || buildTornCarpetTex(THREE, ironTexRes, anisotropy, trackTex);
  const mistSpriteTex = buildSoftMistSpriteTex(THREE, trackTex);

  const normalMappedMats = [];
  const regNormalMat = (mat, normalMap) => {
    if (mat && normalMap) normalMappedMats.push({ mat, map: normalMap });
    return mat;
  };

  // Root & 3 Stage Groups
  const rootGroup = new THREE.Group();
  rootGroup.name = 'SoulsExteriorShoreRoot';

  const chasmOverlayGroup = new THREE.Group();
  chasmOverlayGroup.name = 'ChasmOverlayGroup';
  chasmOverlayGroup.visible = false;

  const shaftAndRiverGroup = new THREE.Group();
  shaftAndRiverGroup.name = 'ShaftAndRiverGroup';
  shaftAndRiverGroup.visible = false;

  const exteriorGroup = new THREE.Group();
  exteriorGroup.name = 'ExteriorShoreGroup';
  exteriorGroup.visible = false;

  rootGroup.add(chasmOverlayGroup, shaftAndRiverGroup, exteriorGroup);

  // Tracked stage & gameplay states
  let stageMode = 'none';
  let chasmProgress = 0.0;
  let chasmX = 0.0;
  let chasmZ = 0.0;
  let chasmCamBelow = false;
  let grateBroken = false;
  let grateBreakAnim = 0.0; // 0 = intact, 0..1 = breaking explosion, 1 = fully bent open
  let swordPickedUp = false;
  let bonfireLit = false;

  // ==========================================================================
  // GROUP A: `chasmOverlayGroup` — Act 3: 4.6m WebGL Stencil Chasm in Throne Hall Floor
  // ==========================================================================
  const chasmContent = new THREE.Group();
  chasmContent.visible = false;
  chasmOverlayGroup.add(chasmContent);

  const CHASM_SEGS = isMobile ? 24 : 32;

  // 1. Jagged fractured-stone aperture disc (radius ~2.3m -> ~4.6m wide opening!)
  function buildChasmApertureGeo(segs) {
    const pos = new Float32Array((segs + 1) * 3);
    const idx = [];
    for (let s = 0; s < segs; s++) {
      const th = (s / segs) * Math.PI * 2;
      const r = evalChasmEdgeR(th);
      pos[(s + 1) * 3]     = Math.cos(th) * r;
      pos[(s + 1) * 3 + 1] = 0;
      pos[(s + 1) * 3 + 2] = Math.sin(th) * r;
      idx.push(0, ((s + 1) % segs) + 1, s + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  // 2. Deep 27m vertical irregular chasm shaft (inward-facing walls, rings from y=+0.03 down to y=-27.0m
  //    so Act 3 abyss upward camera plunging to y=-21.2m stays 100% enclosed inside rocky shaft walls!)
  function buildChasmShaftGeo(segs) {
    const profile = [
      { rScale: 1.07, y:   0.03, jag: 0.00, shade: 0.85 }, // outer seal collar clipped by stencil
      { rScale: 1.00, y:  -0.02, jag: 0.02, shade: 0.92 }, // broken floor lip
      { rScale: 0.98, y:  -0.38, jag: 0.04, shade: 0.78 }, // 36cm thick shattered cathedral flagstone slab!
      { rScale: 0.96, y:  -1.15, jag: 0.07, shade: 0.62 }, // sub-floor rubble masonry
      { rScale: 1.06, y:  -2.60, jag: 0.08, shade: 0.50 }, // undercut vault cavity
      { rScale: 1.02, y:  -5.00, jag: 0.10, shade: 0.38 }, // dark stratified basalt shaft
      { rScale: 1.12, y:  -8.60, jag: 0.11, shade: 0.26 },
      { rScale: 1.08, y: -13.20, jag: 0.11, shade: 0.16 },
      { rScale: 1.16, y: -18.50, jag: 0.10, shade: 0.09 },
      { rScale: 1.14, y: -24.00, jag: 0.09, shade: 0.05 },
      { rScale: 0.80, y: -26.80, jag: 0.05, shade: 0.02 },
      { rScale: 0.00, y: -27.50, jag: 0.00, shade: 0.01 }  // pitch-black abyss floor cap well below camY=-21.2
    ];
    const nR = profile.length;
    const rings = [];
    for (let ri = 0; ri < nR; ri++) {
      const rp = profile[ri];
      const row = [];
      for (let s = 0; s <= segs; s++) {
        const sw = s % segs;
        const th = (sw / segs) * Math.PI * 2;
        const baseR = evalChasmEdgeR(th);
        const h1 = Math.sin(sw * 3.7 + ri * 2.3) * Math.cos(sw * 2.1 - ri * 1.7);
        const h2 = Math.sin(sw * 7.3 - ri * 3.1);
        const r = Math.max(0.0, baseR * rp.rScale * (1.0 + rp.jag * (0.65 * h1 + 0.35 * h2)));
        const y = rp.y + rp.jag * 0.45 * h1;
        row.push({
          x: Math.cos(th) * r,
          y,
          z: Math.sin(th) * r,
          u: s / segs,
          v: Math.abs(y) / 14.0,
          shade: rp.shade * (0.82 + 0.34 * (0.5 + 0.5 * h2))
        });
      }
      rings.push(row);
    }

    const posArr = [];
    const colArr = [];
    const uvArr = [];
    const pushV = (v) => {
      posArr.push(v.x, v.y, v.z);
      colArr.push(v.shade, clamp01(v.v), 0.5);
      uvArr.push(v.u, v.v);
    };
    for (let ri = 0; ri < nR - 1; ri++) {
      for (let s = 0; s < segs; s++) {
        const a = rings[ri][s];
        const b = rings[ri + 1][s];
        const c = rings[ri][s + 1];
        const d = rings[ri + 1][s + 1];
        pushV(a); pushV(b); pushV(c);
        if (ri < nR - 2) {
          pushV(b); pushV(d); pushV(c);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvArr, 2));
    g.computeVertexNormals();
    return g;
  }

  const chasmApertureGeo = trackGeo(buildChasmApertureGeo(CHASM_SEGS));
  const chasmShaftGeo = trackGeo(buildChasmShaftGeo(CHASM_SEGS));

  // Pass 1: Stencil portal writer (y = +0.036 clears BOTH stone floor y=0 AND crimson carpet y=0.022!)
  const chasmStencilMaskMat = trackMat(new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    stencilWrite: true,
    stencilRef: CHASM_STENCIL_ID,
    stencilFunc: THREE.AlwaysStencilFunc,
    stencilFuncMask: 0xFF,
    stencilWriteMask: 0xFF,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.ReplaceStencilOp
  }));
  const chasmStencilMask = new THREE.Mesh(chasmApertureGeo, chasmStencilMaskMat);
  chasmStencilMask.position.y = 0.036;
  chasmStencilMask.renderOrder = -30;
  chasmStencilMask.frustumCulled = false;

  // Pass 2: Far-depth clear strictly inside the jagged stencil hole
  const chasmDepthClearMat = trackMat(new THREE.ShaderMaterial({
    vertexShader: `
      void main() {
        vec4 c = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = vec4(c.xy, c.w * 0.99995, c.w);
      }
    `,
    fragmentShader: `
      void main() { gl_FragColor = vec4(0.0); }
    `,
    colorWrite: false,
    depthWrite: true,
    depthTest: true,
    depthFunc: THREE.AlwaysDepth,
    side: THREE.DoubleSide,
    stencilWrite: true,
    stencilRef: CHASM_STENCIL_ID,
    stencilFunc: THREE.EqualStencilFunc,
    stencilFuncMask: 0xFF,
    stencilWriteMask: 0x00,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.KeepStencilOp
  }));
  const chasmDepthClear = new THREE.Mesh(chasmApertureGeo, chasmDepthClearMat);
  chasmDepthClear.position.y = 0.036;
  chasmDepthClear.renderOrder = -29;
  chasmDepthClear.frustumCulled = false;

  // Pass 3: Deep vertical stone chasm wall shader (crimson glowing upper fractures + rapid abyssal darkening)
  const chasmShaftUniforms = {
    uTime: { value: 0.0 },
    uHeat: { value: 1.0 }
  };
  const chasmShaftMat = trackMat(new THREE.ShaderMaterial({
    uniforms: chasmShaftUniforms,
    vertexShader: `
      attribute vec3 color;
      varying vec3 vNormalW;
      varying vec3 vMeta;
      varying vec2 vUv;
      varying vec3 vLocalPos;
      void main() {
        vMeta = color;
        vUv = uv;
        vLocalPos = position;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uHeat;
      varying vec3 vNormalW;
      varying vec3 vMeta;
      varying vec2 vUv;
      varying vec3 vLocalPos;

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
        vec3 N = normalize(vNormalW);
        float depthM = max(0.0, -vLocalPos.y);
        float depth01 = clamp(depthM / 14.0, 0.0, 1.0);

        // Organic fractured dark gothic masonry & rough stratified basalt rock (ZERO regular glow grids!)
        float arc = vUv.x * 18.0;
        float warp = vnoise(vec2(arc * 0.85, depthM * 0.95)) * 1.35;
        float row = floor(depthM * 1.9 + warp * 0.35);
        float colIdx = floor(arc + mod(row, 2.0) * 0.5 + warp * 0.25);
        float blkH = hash21(vec2(colIdx, row));
        float hSeam = 1.0 - smoothstep(0.02, 0.09, abs(fract(depthM * 1.9 + warp * 0.35) - 0.5));
        float vSeam = 1.0 - smoothstep(0.02, 0.08, abs(fract(arc + mod(row, 2.0) * 0.5 + warp * 0.25) - 0.5));
        float seam = max(hSeam * 0.55, vSeam * 0.42);

        float rockN = vnoise(vec2(arc * 1.7, depthM * 2.1)) * 0.58 + vnoise(vec2(arc * 4.8, depthM * 5.6)) * 0.42;
        float ridge = 1.0 - abs(vnoise(vec2(arc * 2.4 + warp, depthM * 2.8 - warp * 0.6)) * 2.0 - 1.0);
        float hairlineCrack = pow(clamp(ridge, 0.0, 1.0), 10.0);

        vec3 cTopSlab = vec3(0.048, 0.052, 0.070);
        vec3 cMidRock = vec3(0.016, 0.018, 0.028);
        vec3 cAbyss   = vec3(0.0012, 0.0014, 0.0024);

        vec3 baseCol = mix(cTopSlab, cMidRock, smoothstep(0.02, 0.16, depth01));
        baseCol = mix(baseCol, cAbyss, smoothstep(0.20, 0.78, depth01));
        baseCol *= (0.70 + 0.54 * blkH) * (0.72 + 0.50 * rockN) * (0.65 + 0.35 * vMeta.x);
        baseCol *= (1.0 - seam * 0.68);

        // Overhead Throne Hall firelight + cool moon shaft dropoff down the deep abyss
        vec3 keyL = normalize(vec3(0.35, 0.85, 0.38));
        vec3 warmL = normalize(vec3(-0.4, 0.72, -0.55));
        float overhangAo = mix(0.32, 1.0, smoothstep(0.0, 0.18, depthM));
        float depthFade = exp(-depthM * 0.38);
        float lightTerm = (0.18 + 0.92 * max(0.0, dot(N, keyL)) + 0.55 * max(0.0, dot(N, warmL))) * depthFade * overhangAo;
        vec3 lit = baseCol * lightTerm;

        // Subtle, jagged volcanic hairline crimson fissures ONLY near freshly shattered upper walls (never a grid!)
        float pulse = 0.82 + 0.18 * sin(uTime * 5.5 + arc * 1.4 + depthM * 1.8);
        float crackBand = smoothstep(0.0, 0.03, depth01) * (1.0 - smoothstep(0.10, 0.34, depth01));
        float emberMask = hairlineCrack * crackBand * smoothstep(0.42, 0.82, rockN) * uHeat;
        vec3 emberCol = mix(vec3(0.75, 0.06, 0.015), vec3(1.85, 0.42, 0.08), smoothstep(0.45, 0.95, rockN));
        lit += emberCol * emberMask * pulse * 0.95;

        // Subtle warm crimson scorch bounce right under the shattered lip
        lit += vec3(0.10, 0.016, 0.006) * (1.0 - smoothstep(0.0, 0.22, depth01)) * uHeat * 0.45;

        gl_FragColor = vec4(lit, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.FrontSide,
    depthTest: true,
    depthWrite: true,
    stencilWrite: true,
    stencilRef: CHASM_STENCIL_ID,
    stencilFunc: THREE.EqualStencilFunc,
    stencilFuncMask: 0xFF,
    stencilWriteMask: 0x00,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.KeepStencilOp
  }));
  const chasmShaftMesh = new THREE.Mesh(chasmShaftGeo, chasmShaftMat);
  chasmShaftMesh.position.y = 0.002;
  chasmShaftMesh.renderOrder = -28;
  chasmShaftMesh.frustumCulled = false;

  // Upward-view crimson cathedral smoke backdrop (ONLY visible when camera drops BELOW y = -0.15 looking UP!)
  const chasmUpwardBackdropMat = trackMat(new THREE.ShaderMaterial({
    uniforms: { uTime: chasmShaftUniforms.uTime },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float glow = exp(-r * r * 2.1);
        vec3 col = mix(vec3(0.035, 0.025, 0.040), vec3(0.24, 0.065, 0.038), glow);
        col *= 0.92 + 0.08 * sin(uTime * 3.1 + p.x * 4.0);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: false,
    stencilWrite: true,
    stencilRef: CHASM_STENCIL_ID,
    stencilFunc: THREE.EqualStencilFunc,
    stencilFuncMask: 0xFF,
    stencilWriteMask: 0x00,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.KeepStencilOp
  }));
  const chasmUpwardBackdrop = new THREE.Mesh(
    trackGeo(new THREE.CircleGeometry(14.0, 24)),
    chasmUpwardBackdropMat
  );
  chasmUpwardBackdrop.rotation.x = Math.PI * 0.5;
  chasmUpwardBackdrop.position.y = 14.5;
  chasmUpwardBackdrop.renderOrder = -28;
  chasmUpwardBackdrop.visible = false;
  chasmUpwardBackdrop.frustumCulled = false;

  // Broken sub-floor iron & timber joists jutting out of the chasm walls (stencil-clipped inside hole!)
  const chasmBeamsParts = [];
  const chasmRng = makeRng(30917);
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + 0.28 + (chasmRng() - 0.5) * 0.25;
    const edgeR = evalChasmEdgeR(ang);
    const beamLen = 0.75 + chasmRng() * 0.85;
    const by = -0.85 - i * 0.82 - chasmRng() * 0.35;
    const g = new THREE.BoxGeometry(0.18, 0.22, beamLen);
    xformGeo(
      g,
      Math.cos(ang) * (edgeR - beamLen * 0.34),
      by,
      Math.sin(ang) * (edgeR - beamLen * 0.34),
      (chasmRng() - 0.5) * 0.35,
      -ang + Math.PI * 0.5,
      (chasmRng() - 0.5) * 0.45
    );
    chasmBeamsParts.push(tintGeo(THREE, g, 0x3b322d, 0x1d1817));
  }
  const chasmInnerPropMat = trackMat(new THREE.MeshStandardMaterial({
    map: basaltPbr.albedo,
    roughness: 0.90,
    metalness: 0.22,
    vertexColors: true,
    color: 0x7b7270,
    stencilWrite: true,
    stencilRef: CHASM_STENCIL_ID,
    stencilFunc: THREE.EqualStencilFunc,
    stencilFuncMask: 0xFF,
    stencilWriteMask: 0x00,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.KeepStencilOp
  }));
  const chasmInnerBeams = new THREE.Mesh(
    trackGeo(mergeNonIndexedGeos(THREE, chasmBeamsParts, { boxUvTile: 1.5, withColor: true })),
    chasmInnerPropMat
  );
  chasmInnerBeams.renderOrder = -27;
  chasmInnerBeams.frustumCulled = false;

  // Outer spiderweb cracked rim disc (strictly discards inside evalChasmEdgeR so hole is 100% open!)
  const chasmRimCrackUniforms = {
    uTime: chasmShaftUniforms.uTime,
    uProgress: { value: 0.0 }
  };
  const chasmRimCrackMat = trackMat(new THREE.ShaderMaterial({
    uniforms: chasmRimCrackUniforms,
    vertexShader: `
      varying vec2 vLocalXZ;
      void main() {
        vLocalXZ = position.xz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uProgress;
      varying vec2 vLocalXZ;

      float hash21(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 34.53);
        return fract(p.x * p.y);
      }
      float evalEdge(float th) {
        return 2.28
          + 0.18 * sin(th * 5.0 + 0.35)
          + 0.13 * cos(th * 8.0 - 0.85)
          + 0.09 * sin(th * 13.0 + 1.55)
          + 0.05 * cos(th * 19.0 - 0.4);
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
        float r = length(vLocalXZ);
        float th = atan(vLocalXZ.y, vLocalXZ.x);
        float edgeR = evalEdge(th);
        if (r < edgeR - 0.04) discard;

        float distOut = r - edgeR;
        float outerFade = 1.0 - smoothstep(0.25, 2.05, distOut);
        if (outerFade <= 0.005) discard;

        // Jagged angular shattered-stone fracture cracks + soot blast scorch (ZERO smooth wavy rays!)
        float nWarp = vnoise(vLocalXZ * 2.1) * 0.65 + vnoise(vLocalXZ * 5.2) * 0.35;
        float jaggedTh = th + (nWarp - 0.5) * 0.36;
        float crackA = 1.0 - abs(sin(jaggedTh * 7.0 + floor(r * 1.8) * 0.18));
        float crackB = 1.0 - abs(vnoise(vLocalXZ * 3.4) * 2.0 - 1.0);
        float crackLine = pow(clamp(crackA, 0.0, 1.0), 14.0) * 0.95 + pow(clamp(crackB, 0.0, 1.0), 12.0) * 0.72;
        float rimChar = exp(-distOut * 1.95) * (0.72 + 0.38 * nWarp);

        float pulse = 0.84 + 0.16 * sin(uTime * 6.2 + th * 3.0);
        float heat = clamp((crackLine * 0.85 * exp(-distOut * 1.2) + exp(-distOut * 11.0) * 0.55) * outerFade * uProgress, 0.0, 1.0);

        vec3 scorchCol = vec3(0.012, 0.013, 0.018);
        vec3 glowCol = mix(vec3(0.72, 0.09, 0.02), vec3(1.55, 0.38, 0.07), clamp(heat * 1.1, 0.0, 1.0));
        vec3 col = mix(scorchCol, glowCol, smoothstep(0.28, 0.85, heat) * pulse);
        float alpha = clamp((rimChar * 0.88 + crackLine * 0.78 * outerFade) * uProgress, 0.0, 0.94);

        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide
  }));
  const chasmRimCrackGeo = trackGeo(new THREE.PlaneGeometry(9.6, 9.6, 1, 1));
  chasmRimCrackGeo.rotateX(-Math.PI * 0.5);
  const chasmRimCrackMesh = new THREE.Mesh(chasmRimCrackGeo, chasmRimCrackMat);
  chasmRimCrackMesh.position.y = 0.030;
  chasmRimCrackMesh.renderOrder = -26;
  chasmRimCrackMesh.frustumCulled = false;

  // 14 Jagged Buckled Broken Cathedral Flagstone Rim Slabs encircling the chasm lip
  const rimSlabMat = regNormalMat(
    trackMat(new THREE.MeshStandardMaterial({
      map: externalPbr?.floorAlbedo || basaltPbr.albedo,
      normalMap: lowSpecMode ? null : (externalPbr?.floorNormal || basaltPbr.normal),
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughnessMap: externalPbr?.floorRoughness || basaltPbr.orm,
      color: 0x8e93a6,
      roughness: 0.94,
      metalness: 0.06,
      vertexColors: true
    })),
    externalPbr?.floorNormal || basaltPbr.normal
  );
  const rimSlabsGroup = new THREE.Group();
  const rimSlabEntries = [];
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * Math.PI * 2 + (chasmRng() - 0.5) * 0.16;
    const edgeR = evalChasmEdgeR(ang);
    const w = 0.78 + chasmRng() * 0.52;
    const h = 0.16 + chasmRng() * 0.12;
    const d = 0.62 + chasmRng() * 0.44;
    const sg = new THREE.BoxGeometry(w, h, d, 2, 1, 2);
    const sp = sg.attributes.position;
    for (let vi = 0; vi < sp.count; vi++) {
      sp.setXYZ(
        vi,
        sp.getX(vi) + (chasmRng() - 0.5) * 0.11,
        sp.getY(vi) + (chasmRng() - 0.5) * 0.04,
        sp.getZ(vi) + (chasmRng() - 0.5) * 0.11
      );
    }
    sg.computeVertexNormals();
    applyBoxUVs(sg, 1.8);
    const coloredSlab = trackGeo(tintGeo(THREE, sg, 0x9fa5ba, 0x3b3d4a));
    const mesh = new THREE.Mesh(coloredSlab, rimSlabMat);
    mesh.rotation.order = 'YXZ';
    const dist = edgeR + 0.22 + (i % 3) * 0.18;
    const inwardTip = (i % 3 === 0); // 1/3 slabs sag steeply into the pit, 2/3 buckle upward!
    mesh.position.set(Math.cos(ang) * dist, 0.02, Math.sin(ang) * dist);
    const yaw = Math.atan2(Math.cos(ang), Math.sin(ang));
    const targetPitch = inwardTip ? -(0.34 + chasmRng() * 0.22) : (0.18 + chasmRng() * 0.26);
    const targetRoll = (chasmRng() - 0.5) * 0.22;
    const targetY = inwardTip ? -0.08 : (0.06 + chasmRng() * 0.08);
    mesh.rotation.set(targetPitch, yaw, targetRoll);
    mesh.receiveShadow = true;
    rimSlabsGroup.add(mesh);
    rimSlabEntries.push({ mesh, yaw, targetPitch, targetRoll, targetY });
  }

  // Torn Crimson Royal Velvet Runner Carpet flaps sagging down over the North & South chasm edges!
  const tornCarpetMat = trackMat(new THREE.MeshStandardMaterial({
    map: carpetTex,
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0.04,
    side: THREE.DoubleSide
  }));
  function buildTornCarpetFlapGeo(signZ) {
    // 10 columns across carpet width (2.36m), 7 rows curving from flat floor lip down into the chasm
    const cols = 10;
    const rows = 7;
    const positions = new Float32Array((cols + 1) * (rows + 1) * 3);
    const uvs = new Float32Array((cols + 1) * (rows + 1) * 2);
    const indices = [];
    const width = 2.34;
    for (let r = 0; r <= rows; r++) {
      const vFrac = r / rows; // 0 = anchored on floor rim, 1 = shredded dangling edge inside pit
      for (let c = 0; c <= cols; c++) {
        const uFrac = c / cols;
        const x = (uFrac - 0.5) * width;
        // Ragged torn cloth tooth length per column
        const tearLen = 0.85 + 0.55 * Math.sin(c * 2.4 + signZ * 1.1) + 0.28 * Math.cos(c * 4.7);
        const hang = vFrac * tearLen;
        // Curve gently over the stone edge then hang steeply into the pit
        const zOut = signZ * (2.36 - Math.min(hang, 0.45) * 0.92 - Math.max(0, hang - 0.45) * 0.16);
        const yDrop = 0.032 - Math.pow(vFrac, 1.55) * (0.95 * tearLen);
        const vi = r * (cols + 1) + c;
        positions[vi * 3]     = x;
        positions[vi * 3 + 1] = yDrop;
        positions[vi * 3 + 2] = zOut;
        uvs[vi * 2]     = uFrac;
        uvs[vi * 2 + 1] = vFrac;
      }
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const a = r * (cols + 1) + c;
        const b = (r + 1) * (cols + 1) + c;
        const d = r * (cols + 1) + (c + 1);
        const e = (r + 1) * (cols + 1) + (c + 1);
        indices.push(a, b, e, a, e, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }
  const tornCarpetNorth = new THREE.Mesh(trackGeo(buildTornCarpetFlapGeo(-1)), tornCarpetMat);
  const tornCarpetSouth = new THREE.Mesh(trackGeo(buildTornCarpetFlapGeo(1)), tornCarpetMat);
  tornCarpetNorth.renderOrder = -25;
  tornCarpetSouth.renderOrder = -25;

  // 18 Animated Falling Stone Chunks (1 InstancedMesh = 1 DC!) tumbling down into the 14m chasm
  const CHASM_CHUNK_COUNT = 18;
  const chasmChunkGeo = trackGeo(tintGeo(THREE, buildSculptedRockGeo(THREE, 0.34, 4123, 0.65, 1), 0x8d93a8, 0x3b3f4e));
  applyBoxUVs(chasmChunkGeo, 1.2);
  const chasmChunkMat = trackMat(new THREE.MeshStandardMaterial({
    map: basaltPbr.albedo,
    roughness: 0.90,
    metalness: 0.06,
    vertexColors: true,
    stencilWrite: true,
    stencilRef: CHASM_STENCIL_ID,
    stencilFunc: THREE.EqualStencilFunc,
    stencilFuncMask: 0xFF,
    stencilWriteMask: 0x00,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.KeepStencilOp
  }));
  const chasmChunksInst = new THREE.InstancedMesh(chasmChunkGeo, chasmChunkMat, CHASM_CHUNK_COUNT);
  chasmChunksInst.renderOrder = -27;
  chasmChunksInst.frustumCulled = false;

  const chasmChunkData = [];
  for (let i = 0; i < CHASM_CHUNK_COUNT; i++) {
    const ang = (i / CHASM_CHUNK_COUNT) * Math.PI * 2 + chasmRng() * 0.4;
    const rad = 0.25 + chasmRng() * 1.65;
    chasmChunkData.push({
      x0: Math.cos(ang) * rad,
      z0: Math.sin(ang) * rad,
      vx: Math.cos(ang) * (0.25 - chasmRng() * 0.65),
      vz: Math.sin(ang) * (0.25 - chasmRng() * 0.65),
      vy0: 1.2 + chasmRng() * 2.1, // brief upward blast on impact before plunging into abyss
      delay: (i % 6) * 0.06 + chasmRng() * 0.14,
      rx0: chasmRng() * 6.28,
      ry0: chasmRng() * 6.28,
      rz0: chasmRng() * 6.28,
      vrx: (chasmRng() - 0.5) * 6.5,
      vry: (chasmRng() - 0.5) * 6.5,
      vrz: (chasmRng() - 0.5) * 6.5,
      sx: 0.65 + chasmRng() * 0.95,
      sy: 0.45 + chasmRng() * 0.72,
      sz: 0.65 + chasmRng() * 0.95,
      loopPeriod: 2.3 + chasmRng() * 1.6
    });
  }

  // Rising dark crimson-ash abyss haze inside the open chasm
  const CHASM_MIST_COUNT = isMobile ? 16 : 28;
  const chasmMistPos = new Float32Array(CHASM_MIST_COUNT * 3);
  const chasmMistSeed = new Float32Array(CHASM_MIST_COUNT * 3);
  for (let i = 0; i < CHASM_MIST_COUNT; i++) {
    const a = chasmRng() * Math.PI * 2;
    const r = chasmRng() * 1.85;
    chasmMistPos[i * 3]     = Math.cos(a) * r;
    chasmMistPos[i * 3 + 1] = -chasmRng() * 8.5;
    chasmMistPos[i * 3 + 2] = Math.sin(a) * r;
    chasmMistSeed[i * 3]     = chasmRng();
    chasmMistSeed[i * 3 + 1] = 0.6 + chasmRng() * 0.9;
    chasmMistSeed[i * 3 + 2] = 1.6 + chasmRng() * 1.8;
  }
  const chasmMistGeo = trackGeo(new THREE.BufferGeometry());
  chasmMistGeo.setAttribute('position', new THREE.BufferAttribute(chasmMistPos, 3));
  chasmMistGeo.setAttribute('aSeed', new THREE.BufferAttribute(chasmMistSeed, 3));
  const chasmMistMat = trackMat(new THREE.ShaderMaterial({
    uniforms: {
      uTime: chasmShaftUniforms.uTime,
      uProgress: chasmRimCrackUniforms.uProgress,
      uTex: { value: mistSpriteTex }
    },
    vertexShader: `
      attribute vec3 aSeed;
      uniform float uTime;
      varying float vAlpha;
      varying float vEmber;
      void main() {
        float cyc = fract(aSeed.x + uTime * 0.14 * aSeed.y);
        vec3 p = position;
        p.y = mix(-8.5, 0.45, cyc);
        p.x += sin(uTime * 0.9 + aSeed.x * 12.0) * 0.35;
        p.z += cos(uTime * 0.8 + aSeed.x * 9.0) * 0.35;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp((aSeed.z * 260.0) / max(1.2, -mv.z), 12.0, 140.0);
        vAlpha = sin(cyc * 3.14159) * 0.36;
        vEmber = aSeed.x;
      }
    `,
    fragmentShader: `
      uniform sampler2D uTex;
      uniform float uProgress;
      varying float vAlpha;
      varying float vEmber;
      void main() {
        vec4 t = texture2D(uTex, gl_PointCoord);
        vec3 col = mix(vec3(0.08, 0.06, 0.09), vec3(0.55, 0.11, 0.04), smoothstep(0.45, 0.95, vEmber));
        float a = t.a * vAlpha * uProgress;
        if (a < 0.01) discard;
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
    stencilWrite: true,
    stencilRef: CHASM_STENCIL_ID,
    stencilFunc: THREE.EqualStencilFunc,
    stencilFuncMask: 0xFF,
    stencilWriteMask: 0x00,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.KeepStencilOp
  }));
  const chasmMistPoints = new THREE.Points(chasmMistGeo, chasmMistMat);
  chasmMistPoints.renderOrder = -25;
  chasmMistPoints.frustumCulled = false;

  const chasmGlowLight = new THREE.PointLight(0xff421c, 0.0, 12.0, 1.8);
  chasmGlowLight.position.set(0, -1.2, 0);
  chasmGlowLight.visible = false;

  chasmContent.add(
    chasmStencilMask,
    chasmDepthClear,
    chasmShaftMesh,
    chasmUpwardBackdrop,
    chasmInnerBeams,
    chasmRimCrackMesh,
    rimSlabsGroup,
    tornCarpetNorth,
    tornCarpetSouth,
    chasmChunksInst,
    chasmMistPoints,
    chasmGlowLight
  );

  // Seamless dual-mode switch: looking DOWN into chasm vs looking UP from inside chasm!
  function syncChasmCameraSide(camY) {
    const below = Number.isFinite(camY) && camY < -0.18;
    if (below === chasmCamBelow) return;
    chasmCamBelow = below;
    chasmStencilMaskMat.depthTest = !below;
    chasmShaftMat.stencilWrite = !below;
    chasmInnerPropMat.stencilWrite = !below;
    chasmChunkMat.stencilWrite = !below;
    chasmMistMat.stencilWrite = !below;
    chasmUpwardBackdrop.visible = below;
  }

  // Auto-sync before render even if opts.camY is omitted!
  chasmStencilMask.onBeforeRender = (_renderer, _scene, camera) => {
    if (camera && camera.position) {
      syncChasmCameraSide(camera.position.y);
    }
  };

  // ==========================================================================
  // GROUP B: `shaftAndRiverGroup` — Act 4: Vertical Shaft + Rushing Black River + Rusty Grate
  // ==========================================================================
  const shaftRng = makeRng(40499);

  // Shared Wet Underground Stone Material
  const tunnelStoneMat = regNormalMat(
    trackMat(new THREE.MeshStandardMaterial({
      map: basaltPbr.albedo,
      normalMap: lowSpecMode ? null : basaltPbr.normal,
      normalScale: new THREE.Vector2(0.82, 0.82),
      roughnessMap: basaltPbr.orm,
      aoMap: basaltPbr.orm,
      aoMapIntensity: 0.72,
      color: 0x626c84,
      roughness: 0.92,
      metalness: 0.06,
      vertexColors: true
    })),
    basaltPbr.normal
  );

  const rustedGrateMat = regNormalMat(
    trackMat(new THREE.MeshStandardMaterial({
      map: ironPbr.albedo,
      normalMap: lowSpecMode ? null : ironPbr.normal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: ironPbr.orm,
      color: 0xa6948c,
      roughness: 0.94,
      metalness: 0.68
    })),
    ironPbr.normal
  );

  // 1. Vertical Gloomy Stone Shaft (y = -2 .. +22.5m, radius ~7.2m, opening seamlessly into tunnel at +Z)
  function buildShaftAndTunnelGeo() {
    const parts = [];

    // Vertical shaft wall: segmented around 360 deg, skipping the tunnel cutout window on +Z (y in [-1.5..+9.5])
    const rSegs = isMobile ? 20 : 28;
    const hSegs = 12;
    const shaftH = 24.5;
    const yMin = -2.0;
    const pos = [];
    const col = [];
    const uv = [];
    const pushQuad = (a, b, c, d) => {
      const verts = [a, b, c, b, d, c];
      for (let i = 0; i < 6; i++) {
        const v = verts[i];
        pos.push(v.x, v.y, v.z);
        col.push(v.cr, v.cg, v.cb);
        uv.push(v.u, v.v);
      }
    };

    const sampleShaftPt = (s, hi) => {
      const th = (s / rSegs) * Math.PI * 2;
      const yFrac = hi / hSegs;
      const y = yMin + yFrac * shaftH;
      // Narrows slightly near top breach (y=+22m) for dramatic chimney perspective!
      const topPinch = 1.0 - smoothstep(14.0, 22.5, y) * 0.42;
      const crag = 1.0 + 0.075 * Math.sin(th * 5.0 + y * 0.45) + 0.05 * Math.cos(th * 9.0 - y * 0.7);
      const rad = 7.1 * topPinch * crag;
      const shade = lerp(0.58, 0.95, smoothstep(8.0, 22.0, y));
      const warmTop = smoothstep(15.0, 22.5, y);
      return {
        x: Math.cos(th) * rad,
        y,
        z: Math.sin(th) * rad,
        u: (s / rSegs) * 8.0,
        v: y / 4.2,
        cr: shade * lerp(0.88, 1.25, warmTop),
        cg: shade * lerp(0.94, 0.72, warmTop),
        cb: shade * lerp(1.08, 0.65, warmTop)
      };
    };

    for (let hi = 0; hi < hSegs; hi++) {
      const yMid = yMin + ((hi + 0.5) / hSegs) * shaftH;
      for (let s = 0; s < rSegs; s++) {
        const thMid = ((s + 0.5) / rSegs) * Math.PI * 2;
        const zDir = Math.sin(thMid);
        // Leave clean arched cutout on +Z side (zDir > 0.58, y < 9.2) for the horizontal vaulted river tunnel!
        if (zDir > 0.58 && yMid < 9.2 && yMid > -1.8) continue;
        // Winding so inward normals face the center of the shaft
        const a = sampleShaftPt(s, hi);
        const b = sampleShaftPt(s + 1, hi);
        const c = sampleShaftPt(s, hi + 1);
        const d = sampleShaftPt(s + 1, hi + 1);
        pushQuad(a, c, b, d);
      }
    }
    const shaftWallGeo = new THREE.BufferGeometry();
    shaftWallGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    shaftWallGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    shaftWallGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    shaftWallGeo.computeVertexNormals();
    parts.push(shaftWallGeo);

    // Vaulted Gothic Underground River Tunnel (z = +5.0 -> +36.5m, halfWidth = 6.2m, arch crown y = +9.4m)
    const archSegs = isMobile ? 12 : 16;
    const zSegs = 12;
    const zStart = 4.6;
    const zEnd = 36.5;
    const tPos = [];
    const tCol = [];
    const tUv = [];
    const sampleTunnelPt = (ai, zi) => {
      const aFrac = ai / archSegs; // 0 = west bank floor, 0.5 = crown apex, 1 = east bank floor
      const zFrac = zi / zSegs;
      const z = lerp(zStart, zEnd, zFrac);
      const ang = aFrac * Math.PI;
      const hw = 6.15 + Math.sin(z * 0.25 + aFrac * 5.0) * 0.28;
      const x = -Math.cos(ang) * hw;
      // Pointed gothic barrel vault profile!
      const sinA = Math.sin(ang);
      const pointedApex = Math.pow(sinA, 0.78);
      const y = -1.6 + pointedApex * 10.8 + Math.cos(z * 0.37 + ai * 1.4) * 0.16;
      const moonReach = smoothstep(14.0, 32.0, z);
      const wetDark = smoothstep(-1.2, 2.2, y);
      const base = lerp(0.36, 0.86, wetDark) * lerp(0.75, 1.15, moonReach);
      return {
        x,
        y,
        z,
        u: z / 4.2,
        v: aFrac * 6.0,
        cr: base * lerp(0.82, 0.90, moonReach),
        cg: base * lerp(0.90, 1.00, moonReach),
        cb: base * lerp(1.06, 1.24, moonReach)
      };
    };
    for (let zi = 0; zi < zSegs; zi++) {
      for (let ai = 0; ai < archSegs; ai++) {
        const a = sampleTunnelPt(ai, zi);
        const b = sampleTunnelPt(ai + 1, zi);
        const c = sampleTunnelPt(ai, zi + 1);
        const d = sampleTunnelPt(ai + 1, zi + 1);
        const verts = [a, c, b, b, c, d];
        for (let k = 0; k < 6; k++) {
          const v = verts[k];
          tPos.push(v.x, v.y, v.z);
          tCol.push(v.cr, v.cg, v.cb);
          tUv.push(v.u, v.v);
        }
      }
    }
    const tunnelVaultGeo = new THREE.BufferGeometry();
    tunnelVaultGeo.setAttribute('position', new THREE.Float32BufferAttribute(tPos, 3));
    tunnelVaultGeo.setAttribute('color', new THREE.Float32BufferAttribute(tCol, 3));
    tunnelVaultGeo.setAttribute('uv', new THREE.Float32BufferAttribute(tUv, 2));
    tunnelVaultGeo.computeVertexNormals();
    parts.push(tunnelVaultGeo);

    // Massive Gothic Masonry Rib Arches & Wet Stone Bank Ledges every 5.2m along the river tunnel
    for (let az = 8.5; az <= 34.5; az += 5.2) {
      const segs = 10;
      for (let i = 0; i < segs; i++) {
        const a0 = (i / segs) * Math.PI;
        const a1 = ((i + 1) / segs) * Math.PI;
        const am = (a0 + a1) * 0.5;
        const x0 = -Math.cos(a0) * 5.85;
        const y0 = -1.2 + Math.pow(Math.sin(a0), 0.78) * 10.2;
        const x1 = -Math.cos(a1) * 5.85;
        const y1 = -1.2 + Math.pow(Math.sin(a1), 0.78) * 10.2;
        const len = Math.hypot(x1 - x0, y1 - y0) + 0.16;
        const rotZ = Math.atan2(y1 - y0, x1 - x0);
        const rib = new THREE.BoxGeometry(len, 0.72, 0.88);
        xformGeo(rib, (x0 + x1) * 0.5, (y0 + y1) * 0.5, az, 0, 0, rotZ);
        parts.push(tintGeo(THREE, rib, 0x76829b, 0x3b4254));
      }
      // Wet masonry curb ledges along both banks
      for (const side of [-1, 1]) {
        const ledge = new THREE.BoxGeometry(1.4, 1.8, 5.1);
        xformGeo(ledge, side * 5.75, -0.35, az);
        parts.push(tintGeo(THREE, ledge, 0x525c72, 0x262b38));
      }
    }

    // Protruding rocky ledges inside the vertical shaft
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2 + shaftRng() * 0.5;
      const y = 2.0 + (i / 14) * 18.5;
      if (Math.sin(ang) > 0.55 && y < 9.5) continue;
      const topPinch = 1.0 - smoothstep(14.0, 22.5, y) * 0.42;
      const r = 6.3 * topPinch;
      const ledge = buildSculptedRockGeo(THREE, 1.15 + shaftRng() * 0.75, 500 + i, 0.52, 0);
      xformGeo(ledge, Math.cos(ang) * r, y, Math.sin(ang) * r, 0, ang, (shaftRng() - 0.5) * 0.25);
      parts.push(tintGeo(THREE, ledge, 0x5d6478, 0x2a2d3a));
    }

    // Dark rocky underwater riverbed floor enclosing shaft bottom & river tunnel (y = -2.15m -> 0 sky void when underwater!)
    const riverBed = new THREE.BoxGeometry(15.2, 0.8, 52.0);
    xformGeo(riverBed, 0, -2.35, 16.0);
    parts.push(tintGeo(THREE, riverBed, 0x161b26, 0x0a0d14));

    return mergeNonIndexedGeos(THREE, parts, { boxUvTile: 3.4, withColor: true });
  }

  const shaftTunnelMesh = new THREE.Mesh(trackGeo(buildShaftAndTunnelGeo()), tunnelStoneMat);
  shaftTunnelMesh.receiveShadow = true;
  shaftAndRiverGroup.add(shaftTunnelMesh);

  // 2. Broken Cross-Beams & Ancient Twisted Roots jutting across the vertical shaft (keeping center r<3.7m clear for camera & hero!)
  const shaftTimberParts = [];
  const beamHeights = [18.2, 15.0, 12.2, 9.4, 6.2, 3.6];
  for (let i = 0; i < beamHeights.length; i++) {
    const by = beamHeights[i];
    const ang = i * 1.18 + 0.4;
    const side = (i % 2 === 0) ? 1 : -1;
    // Offset chord safely outside r=3.85m so falling hero (r=0) & camera (r=3.16m) sweep past without clipping!
    const offsetR = 4.05 + (i % 3) * 0.42;
    const beamLen = 7.6;
    const beam = new THREE.BoxGeometry(beamLen, 0.36, 0.40);
    xformGeo(
      beam,
      Math.cos(ang) * offsetR * side,
      by,
      Math.sin(ang) * offsetR * side,
      (shaftRng() - 0.5) * 0.14,
      ang + Math.PI * 0.5,
      (shaftRng() - 0.5) * 0.18
    );
    shaftTimberParts.push(tintGeo(THREE, beam, 0x453830, 0x241d19));

    // Snapped jutting stub on opposite side
    const stubLen = 2.1 + shaftRng() * 0.9;
    const stub = new THREE.BoxGeometry(stubLen, 0.30, 0.32);
    xformGeo(
      stub,
      -Math.cos(ang) * 5.0 * side,
      by - 0.7,
      -Math.sin(ang) * 5.0 * side,
      0.12,
      ang,
      side * 0.28
    );
    shaftTimberParts.push(tintGeo(THREE, stub, 0x3b3029, 0x1d1714));

    // Hanging twisted subterranean roots draping down the walls
    const root = new THREE.CylinderGeometry(0.06, 0.14, 4.2 + shaftRng() * 2.5, 6);
    xformGeo(
      root,
      Math.cos(ang + 0.9) * 5.3,
      by - 1.4,
      Math.sin(ang + 0.9) * 5.3,
      (shaftRng() - 0.5) * 0.28,
      ang,
      (shaftRng() - 0.5) * 0.32
    );
    shaftTimberParts.push(tintGeo(THREE, root, 0x352e27, 0x1c1815));
  }
  const shaftTimberMat = trackMat(new THREE.MeshStandardMaterial({
    map: basaltPbr.albedo,
    roughness: 0.94,
    metalness: 0.04,
    vertexColors: true,
    color: 0x807268
  }));
  const shaftTimbersMesh = new THREE.Mesh(
    trackGeo(mergeNonIndexedGeos(THREE, shaftTimberParts, { boxUvTile: 2.0, withColor: true })),
    shaftTimberMat
  );
  shaftAndRiverGroup.add(shaftTimbersMesh);

  // 3. Distant Glowing Crimson Breach High Overhead at y = +22.2m (looking back up to the Throne Hall!)
  const shaftTopGlowUniforms = { uTime: { value: 0.0 } };
  const shaftTopGlowMat = trackMat(new THREE.ShaderMaterial({
    uniforms: shaftTopGlowUniforms,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float ang = atan(p.y, p.x);
        float jag = 0.58 + 0.12 * sin(ang * 5.0 + 0.3) + 0.08 * cos(ang * 9.0 - 0.7);
        float hole = 1.0 - smoothstep(jag * 0.65, jag, r);
        float halo = exp(-r * r * 2.6) * 0.65;
        float flick = 0.86 + 0.14 * sin(uTime * 5.4) + 0.06 * sin(uTime * 11.7);
        vec3 coreCol = mix(vec3(1.15, 0.18, 0.05), vec3(2.2, 0.72, 0.25), smoothstep(0.45, 0.0, r));
        vec3 col = coreCol * (hole * 1.15 + halo * 0.55) * flick;
        float alpha = clamp(hole + halo, 0.0, 1.0);
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false
  }));
  const shaftTopPortal = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(9.5, 9.5)), shaftTopGlowMat);
  shaftTopPortal.rotation.x = Math.PI * 0.5;
  shaftTopPortal.position.set(0, 22.1, 0);
  shaftAndRiverGroup.add(shaftTopPortal);

  // Subtle crimson shaft dust-cone descending from the Throne Hall breach
  const shaftRayMat = trackMat(new THREE.ShaderMaterial({
    uniforms: { uTime: shaftTopGlowUniforms.uTime },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNorm;
      varying vec3 vView;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNorm = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNorm;
      varying vec3 vView;
      void main() {
        float fres = pow(abs(dot(normalize(vNorm), normalize(vView))), 1.45);
        float topFade = smoothstep(0.0, 0.85, vUv.y) * (1.0 - smoothstep(0.92, 1.0, vUv.y));
        float wisp = 0.75 + 0.25 * sin(vUv.x * 18.84 + uTime * 1.1 + vUv.y * 5.0);
        float a = fres * topFade * wisp * 0.16;
        gl_FragColor = vec4(vec3(0.95, 0.22, 0.08), a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false
  }));
  const shaftRedBeam = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(2.6, 5.4, 21.0, 16, 1, true)), shaftRayMat);
  shaftRedBeam.position.set(0, 11.4, 0);
  shaftAndRiverGroup.add(shaftRedBeam);

  // 4. Rushing Black Underground River (y = 0, z = -7 .. +40m, custom animated GLSL shader!)
  const tunnelRiverUniforms = {
    uTime: { value: 0.0 },
    uLowSpec: { value: lowSpecMode ? 1.0 : 0.0 },
    uGrateBroken: { value: 0.0 }
  };
  const tunnelRiverGeo = trackGeo(new THREE.PlaneGeometry(14.0, 48.0, isMobile ? 20 : 34, isMobile ? 36 : 64));
  tunnelRiverGeo.rotateX(-Math.PI * 0.5);
  tunnelRiverGeo.translate(0, 0.0, 16.5);

  const tunnelRiverMat = trackMat(new THREE.ShaderMaterial({
    uniforms: tunnelRiverUniforms,
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying float vWaveH;
      void main() {
        vUv = uv;
        vec3 p = position;
        float t = uTime * 3.8;
        // Fast surging subterranean rapids racing along +Z toward the outfall grate!
        float w1 = sin(p.z * 0.65 - t * 2.1 + sin(p.x * 0.8) * 1.2) * 0.14;
        float w2 = cos(p.x * 1.35 + p.z * 1.05 - t * 2.8) * 0.07;
        // Extra churning turbulence at the shaft plunge splash (z~0) and grate impact (z~26)!
        float splashZone = exp(-dot(p.xz, p.xz) * 0.065) * 0.22;
        float grateChurn = exp(-pow(p.z - 25.5, 2.0) * 0.14) * 0.18;
        float disp = w1 + w2 + (splashZone + grateChurn) * sin(t * 3.6 + p.x * 2.5);
        p.y += disp;
        vWaveH = disp;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uLowSpec;
      uniform float uGrateBroken;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying float vWaveH;

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
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.55;
        for (int i = 0; i < 3; i++) {
          v += a * vnoise(p);
          p = p * 2.08 + vec2(13.1, 7.7);
          a *= 0.48;
        }
        return v;
      }

      void main() {
        float flowT = uTime * 3.4;
        vec2 flowUv = vec2(vWorldPos.x * 0.85, vWorldPos.z * 0.42 - flowT);
        float n1 = fbm(flowUv);
        float n2 = uLowSpec < 0.5 ? fbm(flowUv * 2.4 + vec2(n1 * 1.5, -flowT * 0.6)) : n1;
        float nX = fbm(flowUv + vec2(0.14, 0.0));
        float nZ = fbm(flowUv + vec2(0.0, 0.14));
        float ripple = n1 * 0.52 + n2 * 0.48;

        // Crisp finite-difference turbulent water normal (glinting dark obsidian rapids!)
        vec3 N = normalize(vec3((n1 - nX) * 4.2, 1.0, (n1 - nZ) * 4.6));
        vec3 V = normalize(cameraPosition - vWorldPos);
        float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);

        // Deep obsidian-black subterranean river water (glossy dark rapids w/ crisp moonlight glints!)
        vec3 deepCol    = vec3(0.002, 0.005, 0.011);
        vec3 shallowCol = vec3(0.010, 0.022, 0.042);
        vec3 col = mix(deepCol, shallowCol, clamp(ripple * 0.42 + fres * 0.48, 0.0, 1.0));

        // Razor-sharp silver moonlight reflections dancing on black wave crests from the grate exit!
        vec3 moonPos = vec3(0.0, 5.4, 34.0);
        vec3 Lm = normalize(moonPos - vWorldPos);
        vec3 Hm = normalize(Lm + V);
        float moonReach = smoothstep(6.0, 27.5, vWorldPos.z);
        float moonSpec = pow(max(dot(N, Hm), 0.0), 115.0) * (0.45 + 2.15 * moonReach);
        float broadSheen = pow(max(dot(N, Hm), 0.0), 22.0) * 0.075 * moonReach;
        col += vec3(0.52, 0.72, 1.02) * (moonSpec + broadSheen + fres * 0.14 * moonReach);

        // Eerie warm crimson reflection near the vertical shaft drop (z ~ 0)
        float shaftProx = exp(-dot(vWorldPos.xz, vWorldPos.xz) * 0.025);
        vec3 Lr = normalize(vec3(0.0, 18.0, 0.0) - vWorldPos);
        vec3 Hr = normalize(Lr + V);
        float redSpec = pow(max(dot(N, Hr), 0.0), 40.0) * shaftProx;
        col += vec3(0.95, 0.22, 0.08) * (redSpec * 0.90 + shaftProx * 0.04);

        // Lacy whitewater foam ribbons ONLY on banks, sharp wave crests & grate impact (keeps river unmistakably BLACK!)
        float lacy = smoothstep(0.62, 0.88, n2);
        float bankFoam = smoothstep(4.55, 5.75, abs(vWorldPos.x)) * lacy * 0.62;
        float crestFoam = smoothstep(0.80, 0.94, ripple + vWaveH * 0.45) * 0.42;
        float splashFoam = exp(-dot(vWorldPos.xz, vWorldPos.xz) * 0.11) * smoothstep(0.52, 0.84, n2) * 0.65;
        float grateFoam = exp(-pow(vWorldPos.z - 25.8, 2.0) * 0.25) * (0.42 + 0.42 * uGrateBroken) * smoothstep(0.48, 0.84, n2);
        float foam = clamp(bankFoam + crestFoam + splashFoam + grateFoam, 0.0, 0.82);
        vec3 foamCol = mix(vec3(0.18, 0.28, 0.42), vec3(0.62, 0.76, 0.94), moonReach * 0.68 + 0.22);
        col = mix(col, foamCol, foam * 0.72);

        // When camera submerges underwater (py < 0), render backlit refracted aquatic ceiling ripples!
        if (!gl_FrontFacing) {
          vec3 underCol = mix(vec3(0.015, 0.048, 0.075), vec3(0.36, 0.58, 0.78), smoothstep(0.38, 0.88, ripple) * (0.45 + 0.55 * moonReach));
          underCol += vec3(0.45, 0.12, 0.05) * shaftProx * 0.65;
          col = underCol;
        }

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.DoubleSide
  }));
  const tunnelRiverMesh = new THREE.Mesh(tunnelRiverGeo, tunnelRiverMat);
  shaftAndRiverGroup.add(tunnelRiverMesh);

  // 5. Massive Rusty Iron Outfall Grate at z = +26.0m (with hinged/snapping central bars for `triggerGrateBreak()`!)
  const grateGroup = new THREE.Group();
  grateGroup.position.set(0, 0, 26.0);
  shaftAndRiverGroup.add(grateGroup);

  // Heavy fixed stone-mounted outer iron frame & side portcullis bars
  const grateFrameParts = [];
  // Top heavy iron lintel & bottom submerged sill beam
  grateFrameParts.push(xformGeo(new THREE.BoxGeometry(11.6, 0.48, 0.48), 0, 7.6, 0));
  grateFrameParts.push(xformGeo(new THREE.BoxGeometry(11.6, 0.36, 0.38), 0, 4.9, 0));
  grateFrameParts.push(xformGeo(new THREE.BoxGeometry(11.6, 0.32, 0.36), 0, 0.4, 0));
  // Fixed outer flank vertical bars (|x| >= 2.8)
  const outerBarXs = [-4.9, -4.1, -3.3, 3.3, 4.1, 4.9];
  for (let i = 0; i < outerBarXs.length; i++) {
    grateFrameParts.push(xformGeo(new THREE.CylinderGeometry(0.11, 0.12, 8.6, 8), outerBarXs[i], 3.7, 0));
  }
  // Riveted gusset brackets
  for (const sx of [-5.3, 5.3]) {
    grateFrameParts.push(xformGeo(new THREE.BoxGeometry(0.65, 8.6, 0.65), sx, 3.7, 0));
  }
  const grateFrameMesh = new THREE.Mesh(
    trackGeo(mergeNonIndexedGeos(THREE, grateFrameParts, { boxUvTile: 1.6 })),
    rustedGrateMat
  );
  grateGroup.add(grateFrameMesh);

  // 7 Breakable Central Iron Bars (upper & lower halves that violently snap & blast outward into +Z!)
  const breakableBars = [];
  const centralBarGeo = trackGeo(new THREE.CylinderGeometry(0.105, 0.115, 4.1, 8));
  const centralCrossGeo = trackGeo(new THREE.BoxGeometry(5.6, 0.28, 0.30));

  for (let i = -3; i <= 3; i++) {
    const bx = i * 0.80;
    // Top half pivots from y = 7.4 downward/outward into +Z
    const topPivot = new THREE.Group();
    topPivot.position.set(bx, 7.4, 0);
    const topBar = new THREE.Mesh(centralBarGeo, rustedGrateMat);
    topBar.position.y = -2.05;
    topPivot.add(topBar);
    grateGroup.add(topPivot);

    // Bottom half pivots from y = 0.0 outward into +Z
    const botPivot = new THREE.Group();
    botPivot.position.set(bx, -0.3, 0);
    const botBar = new THREE.Mesh(centralBarGeo, rustedGrateMat);
    botBar.position.y = 2.05;
    botPivot.add(botBar);
    grateGroup.add(botPivot);

    const spread = (i / 3.0) * 0.52;
    const isCenter = Math.abs(i) <= 1;
    breakableBars.push({
      topPivot,
      botPivot,
      targetTopRx: -(isCenter ? 1.28 : 0.72 + Math.abs(i) * 0.12),
      targetBotRx:  (isCenter ? 1.18 : 0.65 + Math.abs(i) * 0.10),
      targetRz: spread * (isCenter ? 0.65 : 0.95),
      delay: Math.abs(i) * 0.035
    });
  }
  // Central horizontal bar that snaps & flies forward
  const brokenMidCross = new THREE.Mesh(centralCrossGeo, rustedGrateMat);
  brokenMidCross.position.set(0, 2.75, 0.06);
  grateGroup.add(brokenMidCross);

  // 6. Cold Moonlight Sky Portal & Volumetric Moonbeams Streaming In Through the Grate (z = +26..+54m!)
  const tunnelMoonBackdropMat = trackMat(new THREE.ShaderMaterial({
    uniforms: { uTime: tunnelRiverUniforms.uTime },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float glow = exp(-dot(p - vec2(0.0, 0.16), p - vec2(0.0, 0.16)) * 2.8);
        float mist = 0.5 + 0.5 * sin(p.x * 4.5 + uTime * 0.6) * cos(p.y * 3.2 - uTime * 0.4);
        vec3 nightCol = vec3(0.035, 0.062, 0.125);
        vec3 moonCol = vec3(0.46, 0.64, 0.90);
        vec3 col = mix(nightCol, moonCol, clamp(glow * 0.95 + mist * 0.08, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.DoubleSide,
    fog: false
  }));
  const tunnelMoonBackdrop = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(34, 24)), tunnelMoonBackdropMat);
  tunnelMoonBackdrop.position.set(0, 5.2, 42.0);
  tunnelMoonBackdrop.rotation.y = Math.PI;
  shaftAndRiverGroup.add(tunnelMoonBackdrop);

  // Volumetric cold moonlight god-ray sheets slanting inward from the iron grate
  const moonBeamMat = trackMat(new THREE.ShaderMaterial({
    uniforms: { uTime: tunnelRiverUniforms.uTime },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        float sideFade = sin(vUv.x * 3.14159);
        float lenFade = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.45, 1.0, vUv.y));
        float bars = 0.68 + 0.32 * sin(vUv.x * 22.0 + 0.4);
        float drift = 0.85 + 0.15 * sin(uTime * 1.2 + vUv.y * 6.0);
        float a = sideFade * lenFade * bars * drift * 0.24;
        if (a < 0.005) discard;
        gl_FragColor = vec4(vec3(0.58, 0.78, 1.05), a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false
  }));
  for (let b = 0; b < 3; b++) {
    const beam = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(7.2, 13.5)), moonBeamMat);
    beam.position.set((b - 1) * 1.9, 3.6 - b * 0.2, 22.8);
    beam.rotation.set(-0.92, (b - 1) * 0.14, 0);
    shaftAndRiverGroup.add(beam);
  }

  // 7. Falling Shaft Dust + Grate-Break Sparks & Water Spray Burst (GPU Points!)
  const SHAFT_DUST_COUNT = isMobile ? 70 : 140;
  const shaftDustPos = new Float32Array(SHAFT_DUST_COUNT * 3);
  const shaftDustSeed = new Float32Array(SHAFT_DUST_COUNT * 3);
  for (let i = 0; i < SHAFT_DUST_COUNT; i++) {
    const a = shaftRng() * Math.PI * 2;
    const r = 0.8 + shaftRng() * 5.2;
    shaftDustPos[i * 3]     = Math.cos(a) * r;
    shaftDustPos[i * 3 + 1] = shaftRng() * 22.0;
    shaftDustPos[i * 3 + 2] = Math.sin(a) * r;
    shaftDustSeed[i * 3]     = shaftRng();
    shaftDustSeed[i * 3 + 1] = 0.65 + shaftRng() * 0.85;
    shaftDustSeed[i * 3 + 2] = 0.7 + shaftRng() * 1.3;
  }
  const shaftDustGeo = trackGeo(new THREE.BufferGeometry());
  shaftDustGeo.setAttribute('position', new THREE.BufferAttribute(shaftDustPos, 3));
  shaftDustGeo.setAttribute('aSeed', new THREE.BufferAttribute(shaftDustSeed, 3));
  const shaftDustMat = trackMat(new THREE.ShaderMaterial({
    uniforms: { uTime: tunnelRiverUniforms.uTime, uTex: { value: mistSpriteTex } },
    vertexShader: `
      attribute vec3 aSeed;
      uniform float uTime;
      varying float vAlpha;
      varying float vWarm;
      void main() {
        float cyc = fract(aSeed.x - uTime * 0.28 * aSeed.y);
        vec3 p = position;
        p.y = cyc * 22.0;
        p.x += sin(uTime * 1.4 + aSeed.x * 16.0) * 0.28;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp((aSeed.z * 75.0) / max(1.0, -mv.z), 2.5, 22.0);
        vAlpha = sin(cyc * 3.14159) * 0.55;
        vWarm = smoothstep(11.0, 21.0, p.y);
      }
    `,
    fragmentShader: `
      uniform sampler2D uTex;
      varying float vAlpha;
      varying float vWarm;
      void main() {
        vec4 t = texture2D(uTex, gl_PointCoord);
        vec3 col = mix(vec3(0.52, 0.66, 0.82), vec3(0.95, 0.36, 0.16), vWarm);
        float a = t.a * vAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  const shaftDustPoints = new THREE.Points(shaftDustGeo, shaftDustMat);
  shaftAndRiverGroup.add(shaftDustPoints);

  // Grate Break Burst (Sparks + Exploding Water Spray at z = +26m!)
  const GRATE_BURST_COUNT = isMobile ? 48 : 88;
  const grateBurstPos = new Float32Array(GRATE_BURST_COUNT * 3);
  const grateBurstVel = new Float32Array(GRATE_BURST_COUNT * 3);
  const grateBurstKind = new Float32Array(GRATE_BURST_COUNT); // 0 = whitewater spray, 1 = golden iron spark
  for (let i = 0; i < GRATE_BURST_COUNT; i++) {
    const isSpark = i < Math.floor(GRATE_BURST_COUNT * 0.46);
    grateBurstPos[i * 3]     = (shaftRng() - 0.5) * 4.8;
    grateBurstPos[i * 3 + 1] = 0.6 + shaftRng() * 5.2;
    grateBurstPos[i * 3 + 2] = 25.9;
    grateBurstVel[i * 3]     = (shaftRng() - 0.5) * (isSpark ? 9.5 : 7.0);
    grateBurstVel[i * 3 + 1] = (isSpark ? 2.5 : 4.2) + shaftRng() * 5.8;
    grateBurstVel[i * 3 + 2] = (isSpark ? 6.5 : 8.5) + shaftRng() * 9.5;
    grateBurstKind[i]        = isSpark ? 1.0 : 0.0;
  }
  const grateBurstGeo = trackGeo(new THREE.BufferGeometry());
  grateBurstGeo.setAttribute('position', new THREE.BufferAttribute(grateBurstPos, 3));
  grateBurstGeo.setAttribute('aVel', new THREE.BufferAttribute(grateBurstVel, 3));
  grateBurstGeo.setAttribute('aKind', new THREE.BufferAttribute(grateBurstKind, 1));
  const grateBurstUniforms = {
    uAge: { value: 0.0 },
    uTex: { value: mistSpriteTex }
  };
  const grateBurstMat = trackMat(new THREE.ShaderMaterial({
    uniforms: grateBurstUniforms,
    vertexShader: `
      attribute vec3 aVel;
      attribute float aKind;
      uniform float uAge;
      varying float vAlpha;
      varying float vKind;
      void main() {
        float t = clamp(uAge, 0.0, 1.5);
        vec3 p = position + aVel * t + vec3(0.0, -9.8 * 0.5 * t * t, 0.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float sz = mix(175.0, 62.0, aKind);
        gl_PointSize = clamp(sz / max(1.0, -mv.z), 3.0, 56.0);
        vAlpha = smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.45, 1.25, t));
        vKind = aKind;
      }
    `,
    fragmentShader: `
      uniform sampler2D uTex;
      varying float vAlpha;
      varying float vKind;
      void main() {
        vec4 t = texture2D(uTex, gl_PointCoord);
        vec3 sprayCol = vec3(0.76, 0.88, 1.0);
        vec3 sparkCol = vec3(1.85, 0.96, 0.35);
        vec3 col = mix(sprayCol, sparkCol, vKind);
        float a = t.a * vAlpha * mix(0.68, 1.0, vKind);
        if (a < 0.01) discard;
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  const grateBurstPoints = new THREE.Points(grateBurstGeo, grateBurstMat);
  grateBurstPoints.visible = false;
  grateBurstPoints.frustumCulled = false;
  shaftAndRiverGroup.add(grateBurstPoints);

  // Local lights inside shaftAndRiverGroup (toggled strictly with stageMode === 'shaft_river'!)
  const shaftCrimsonLight = new THREE.PointLight(0xff4a24, 0.0, 32.0, 1.4);
  shaftCrimsonLight.position.set(0, 18.0, 0);
  const tunnelMoonLight = new THREE.PointLight(0x8cbaff, 0.0, 34.0, 1.3);
  tunnelMoonLight.position.set(0, 5.2, 29.0);
  const tunnelFillLight = new THREE.PointLight(0x46668c, 0.0, 26.0, 1.4);
  tunnelFillLight.position.set(0, 3.8, 12.0);
  shaftAndRiverGroup.add(shaftCrimsonLight, tunnelMoonLight, tunnelFillLight);

  // ==========================================================================
  // GROUP C: `exteriorGroup` — Act 5 & Free-Roam Gameplay: «Берег Пепельного Стока»
  // ==========================================================================
  const extRng = makeRng(90926);

  // --------------------------------------------------------------------------
  // C1. Nocturnal Exterior Sky Dome + Huge Pale Moon + Drifting Clouds + Stars (1 DC, fog: false)
  // --------------------------------------------------------------------------
  const extSkyUniforms = {
    uTime: { value: 0.0 },
    uLowSpec: { value: lowSpecMode ? 1.0 : 0.0 }
  };
  const extSkyMat = trackMat(new THREE.ShaderMaterial({
    uniforms: extSkyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
    fog: false,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uLowSpec;
      varying vec3 vDir;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
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
        vec3 d = normalize(vDir);
        float elev = clamp(d.y, -0.35, 1.0);

        // Deep nocturnal coastal gothic palette: rich midnight-indigo zenith -> brooding misty horizon
        vec3 abyssCol   = vec3(0.010, 0.015, 0.028);
        vec3 horizonCol = vec3(0.044, 0.064, 0.112);
        vec3 zenithCol  = vec3(0.008, 0.014, 0.032);
        vec3 col = elev < 0.0
          ? mix(horizonCol, abyssCol, clamp(-elev * 4.2, 0.0, 1.0))
          : mix(horizonCol, zenithCol, pow(elev, 0.52));

        // HUGE PALE ASHEN MOON framed dramatically in the open night sky right above-left of the Castle of Ash spires!
        vec3 moonDir = normalize(vec3(-0.26, 0.48, -0.838));
        float mDot = dot(d, moonDir);
        float moonHalo = pow(max(mDot, 0.0), 7.0) * 0.18
                       + pow(max(mDot, 0.0), 28.0) * 0.30
                       + pow(max(mDot, 0.0), 110.0) * 0.48;
        col += vec3(0.36, 0.48, 0.74) * moonHalo;

        // Crisp large full moon disc (~2.2x Souls arena moon!) with lunar maria craters
        float disc = smoothstep(0.9888, 0.9908, mDot);
        if (disc > 0.001) {
          vec2 mUv = (d.xy - moonDir.xy) * 11.4;
          float maria = vnoise(mUv * 1.9 + vec2(1.3, 2.7)) * 0.58
                      + vnoise(mUv * 4.6 - vec2(0.8, 1.4)) * 0.42;
          float limb = smoothstep(0.9888, 0.9960, mDot);
          vec3 moonCol = mix(vec3(0.68, 0.76, 0.90), vec3(0.98, 0.99, 1.05), maria) * (0.84 + 0.24 * limb);
          col = mix(col, moonCol, disc);
        }

        // Subtle crisp starfield in upper sky (smooth radial pinpoints, dimmed near moon halo)
        if (elev > 0.08) {
          vec2 starGrid = d.xz / (elev + 0.35) * 34.0;
          vec2 cell = floor(starGrid);
          vec2 f = fract(starGrid) - 0.5;
          float h = hash21(cell);
          if (h > 0.968) {
            vec2 off = vec2(hash21(cell + 17.3) - 0.5, hash21(cell + 41.9) - 0.5) * 0.55;
            float sd = length(f - off);
            float star = smoothstep(0.14, 0.02, sd) * (0.55 + 0.45 * sin(uTime * (1.8 + h * 4.0) + h * 60.0));
            col += vec3(0.75, 0.85, 1.0) * star * smoothstep(0.08, 0.35, elev) * (1.0 - disc) * (1.0 - moonHalo * 0.65);
          }
        }

        // Layered silver-rimmed nocturnal storm clouds drifting slowly behind the Castle of Ash
        if (uLowSpec < 0.5 && elev > 0.01) {
          vec2 cUv = d.xz / (elev + 0.22);
          float c1 = vnoise(cUv * 0.55 + vec2(uTime * 0.010, -uTime * 0.006));
          float c2 = vnoise(cUv * 1.35 - vec2(uTime * 0.016, uTime * 0.008));
          float c3 = vnoise(cUv * 2.80 + vec2(uTime * 0.022, uTime * 0.011));
          float cloudRaw = c1 * 0.56 + c2 * 0.30 + c3 * 0.14;
          float cloud = smoothstep(0.45, 0.80, cloudRaw)
                      * smoothstep(0.01, 0.16, elev)
                      * (1.0 - smoothstep(0.62, 0.95, elev));
          float silverRim = pow(max(mDot, 0.0), 4.0) * smoothstep(0.42, 0.65, cloudRaw);
          vec3 cloudDark = vec3(0.055, 0.072, 0.112);
          vec3 cloudLit  = vec3(0.38, 0.48, 0.68);
          vec3 cloudCol  = mix(cloudDark, cloudLit, clamp(silverRim * 1.25 + 0.14, 0.0, 1.0));
          col = mix(col, cloudCol, cloud * 0.64 * (1.0 - disc * 0.65));
        }

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  }));
  const extSkyDome = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(195, 28, 16)), extSkyMat);
  extSkyDome.position.set(0, -6, 0);
  extSkyDome.renderOrder = -20;
  exteriorGroup.add(extSkyDome);

  // --------------------------------------------------------------------------
  // C2. MONUMENTAL SILHOUETTE OF THE CASTLE OF ASH on High Precipice (z = -56m, y = +18..+48m!)
  //     Custom moonlight-rimmed shader (`fog: false`) so it NEVER fades away in scene.fog!
  // --------------------------------------------------------------------------
  function buildCastleOfAshVista() {
    const castleParts = [];
    const windowParts = [];

    const addCastleBox = (w, h, d, x, y, z, rx = 0, ry = 0, rz = 0, topC = 0x454e66, botC = 0x1a1e2b) => {
      castleParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz), topC, botC));
    };
    const addCastleSpire = (r, h, segs, x, y, z, ry = Math.PI / 4, topC = 0x4f5b78, botC = 0x222838) => {
      castleParts.push(tintGeo(THREE, xformGeo(new THREE.ConeGeometry(r, h, segs), x, y, z, 0, ry, 0), topC, botC));
    };
    const addWindow = (w, h, x, y, z, ry = 0) => {
      // Pointed gothic lancet window plane + sharp top triangle
      windowParts.push(xformGeo(new THREE.PlaneGeometry(w, h), x, y, z, 0, ry, 0));
      windowParts.push(xformGeo(new THREE.ConeGeometry(w * 0.56, w * 0.95, 3), x, y + h * 0.5 + w * 0.36, z, 0, ry, 0));
    };

    const cz = -56.0;
    const baseY = 18.0;

    // 1. Colossal Sheer Jagged Basalt Promontory Cliff supporting the Castle (y = -8 .. +22m)
    const cragSpecs = [
      { x:   0.0, y:  6.5, z: cz + 4.0, r: 16.5, sy: 1.05, seed: 701 },
      { x: -16.5, y:  5.5, z: cz + 7.0, r: 13.5, sy: 1.00, seed: 702 },
      { x:  17.0, y:  6.0, z: cz + 6.5, r: 14.0, sy: 1.02, seed: 703 },
      { x: -31.0, y:  3.0, z: cz + 14.0, r: 15.0, sy: 0.90, seed: 704 },
      { x:  32.0, y:  3.5, z: cz + 13.0, r: 15.5, sy: 0.92, seed: 705 },
      { x:  -9.0, y: 12.2, z: cz + 1.5, r:  9.8, sy: 0.95, seed: 706 },
      { x:   9.5, y: 12.4, z: cz + 2.0, r: 10.2, sy: 0.96, seed: 707 },
      { x:   0.0, y: 13.5, z: cz + 2.5, r: 11.2, sy: 0.82, seed: 708 }
    ];
    for (let i = 0; i < cragSpecs.length; i++) {
      const cs = cragSpecs[i];
      const g = buildSculptedRockGeo(THREE, cs.r, cs.seed, cs.sy, 1);
      xformGeo(g, cs.x, cs.y, cs.z);
      castleParts.push(tintGeo(THREE, g, 0x2e3546, 0x0d1018));
    }

    // 2. Massive Tiered Citadel Curtain Walls & Crenellated Battlements (y = 16 .. 26m)
    addCastleBox(36.0, 10.5, 6.2, 0, baseY + 3.0, cz + 3.8, 0, 0, 0, 0x3b4459, 0x161a26);
    // Battlement merlons along the front curtain wall
    for (let mx = -16.5; mx <= 16.5; mx += 2.75) {
      addCastleBox(1.5, 1.8, 1.4, mx, baseY + 8.9, cz + 6.4, 0, 0, 0, 0x4b5670, 0x262d3d);
    }
    // Lower buttressed bastion piers plunging down the precipice face
    for (const bx of [-14.0, -7.2, 0.0, 7.2, 14.0]) {
      addCastleBox(2.6, 15.0, 4.4, bx, baseY - 1.5, cz + 6.4, 0.10, 0, 0, 0x363f54, 0x121620);
    }

    // 3. GRAND CENTRAL THRONE CATHEDRAL KEEP (rises proudly to y = +48.5m!)
    addCastleBox(14.5, 18.5, 11.0, 0, baseY + 13.5, cz - 0.5, 0, 0, 0, 0x444e66, 0x1e2331);
    // Steep gothic cathedral pitched roof & crowning central bell-spire
    addCastleBox(15.2, 1.2, 11.8, 0, baseY + 23.0, cz - 0.5, 0, 0, 0, 0x525f7c, 0x2a3142);
    addCastleSpire(7.6, 12.5, 4, 0, baseY + 29.4, cz - 0.5, Math.PI / 4, 0x566482, 0x252c3d);
    // Twin slender needle-spires flanking the Throne Hall facade
    for (const sx of [-6.8, 6.8]) {
      addCastleBox(3.4, 21.0, 3.6, sx, baseY + 15.0, cz + 3.6, 0, 0, 0, 0x48536e, 0x1d2230);
      addCastleSpire(2.55, 11.2, 4, sx, baseY + 30.8, cz + 3.6, Math.PI / 4, 0x5a6888, 0x283042);
      // Pointed stone finials
      addCastleSpire(0.45, 3.2, 4, sx, baseY + 37.2, cz + 3.6, Math.PI / 4, 0x6b7ba0, 0x3c465c);
    }

    // 4. Flying Buttresses & Flanking Gothic Watchtowers (asymmetric iconic FromSoftware silhouette!)
    const towerSpecs = [
      { x: -16.8, z: cz + 2.8, w: 5.4, h: 20.5, spireH: 11.5, broken: false },
      { x:  17.4, z: cz + 2.4, w: 5.8, h: 22.0, spireH: 12.8, broken: false },
      { x: -24.5, z: cz + 6.5, w: 4.8, h: 15.0, spireH:  7.8, broken: true  },
      { x:  25.2, z: cz + 6.0, w: 4.6, h: 16.5, spireH:  8.5, broken: false },
      { x:  -9.8, z: cz - 6.5, w: 4.5, h: 24.0, spireH: 10.5, broken: false },
      { x:  10.4, z: cz - 7.0, w: 4.8, h: 26.0, spireH: 12.2, broken: false }
    ];
    for (let i = 0; i < towerSpecs.length; i++) {
      const tw = towerSpecs[i];
      addCastleBox(tw.w, tw.h, tw.w, tw.x, baseY + tw.h * 0.5 + 1.5, tw.z, 0, 0, 0, 0x424d66, 0x1a1f2d);
      // Tower cornice collar
      addCastleBox(tw.w + 0.9, 1.0, tw.w + 0.9, tw.x, baseY + tw.h + 1.6, tw.z, 0, 0, 0, 0x526080, 0x2b3244);
      if (!tw.broken) {
        addCastleSpire(tw.w * 0.72, tw.spireH, 4, tw.x, baseY + tw.h + 2.0 + tw.spireH * 0.5, tw.z);
      } else {
        // Shattered ruined watchtower crown
        addCastleBox(1.8, 3.2, 1.8, tw.x - 1.2, baseY + tw.h + 3.2, tw.z, 0, 0, 0.12);
        addCastleBox(1.6, 2.1, 1.8, tw.x + 1.4, baseY + tw.h + 2.6, tw.z + 0.6, 0, 0, -0.08);
      }
    }

    // Sweeping Flying Buttress Ribs bridging Central Keep to Flanking Towers
    for (const side of [-1, 1]) {
      addCastleBox(8.8, 1.7, 1.8, side * 11.4, baseY + 16.5, cz + 2.4, 0, 0, -side * 0.44, 0x4d5976, 0x242b3c);
      addCastleBox(8.8, 1.5, 1.8, side * 11.4, baseY + 11.2, cz + 2.4, 0, 0, -side * 0.36, 0x45506a, 0x202636);
      // Outer viaduct arch connecting main curtain wall to outer watchtower
      addCastleBox(7.2, 2.2, 2.0, side * 20.8, baseY + 11.0, cz + 4.5, 0, 0, -side * 0.14, 0x3e4860, 0x1b202e);
    }

    // 5. GLOWING CRIMSON THRONE HALL LANCET WINDOWS & ROSE WINDOW (recognizable firelit sanctuary!)
    // Three tall glowing lancet windows across the Throne Cathedral front facade
    addWindow(1.25, 5.4, -3.2, baseY + 14.8, cz + 5.15);
    addWindow(1.55, 6.6,  0.0, baseY + 15.4, cz + 5.15);
    addWindow(1.25, 5.4,  3.2, baseY + 14.8, cz + 5.15);
    // High crimson rose-window glow above central lancet
    windowParts.push(xformGeo(new THREE.CircleGeometry(1.55, 12), 0.0, baseY + 20.8, cz + 5.18));
    // Flanking tower crimson slit windows
    addWindow(0.72, 3.0, -16.8, baseY + 16.2, cz + 5.62);
    addWindow(0.72, 3.0,  17.4, baseY + 17.4, cz + 5.42);
    addWindow(0.65, 2.4,  -6.8, baseY + 18.8, cz + 5.48);
    addWindow(0.65, 2.4,   6.8, baseY + 18.8, cz + 5.48);
    // Faint warm bastion gate slit lower on the curtain wall
    addWindow(0.85, 2.2,   0.0, baseY + 4.8,  cz + 7.05);

    const castleGeo = trackGeo(mergeNonIndexedGeos(THREE, castleParts, { boxUvTile: 6.0, withColor: true }));
    const windowsGeo = trackGeo(mergeNonIndexedGeos(THREE, windowParts, { boxUvTile: 0, withColor: false }));
    return { castleGeo, windowsGeo };
  }

  const castleVista = buildCastleOfAshVista();

  // Custom Nocturnal Moon-Rimmed Gothic Castle Silhouette Shader (`fog: false` -> ALWAYS majestically readable!)
  const castleSilhouetteMat = trackMat(new THREE.ShaderMaterial({
    uniforms: {
      uTime: extSkyUniforms.uTime
    },
    vertexShader: `
      attribute vec3 color;
      varying vec3 vNormalW;
      varying vec3 vWorldPos;
      varying vec3 vCol;
      void main() {
        vCol = color;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vNormalW;
      varying vec3 vWorldPos;
      varying vec3 vCol;

      float hash21(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 34.53);
        return fract(p.x * p.y);
      }

      void main() {
        vec3 N = normalize(vNormalW);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 moonL = normalize(vec3(-0.22, 0.52, -0.82));
        vec3 frontFill = normalize(vec3(-0.35, 0.60, 0.72));

        // Subtle stone block grit so silhouette towers feel monumental, never flat plastic
        float masonry = 0.86 + 0.26 * hash21(floor(vec2((vWorldPos.x + vWorldPos.z) * 0.45, vWorldPos.y * 0.55)));
        vec3 base = vCol * masonry * 0.48;

        // Cold silver moonlight rim tracing every spire, gable & flying buttress!
        float fres = pow(1.0 - max(dot(N, V), 0.0), 2.4);
        float topCatch = max(0.0, N.y) * 0.45 + max(0.0, dot(N, frontFill)) * 0.55;
        float rimCatch = fres * (0.45 + 0.55 * max(0.0, dot(N, -moonL) * 0.5 + 0.5));

        vec3 lit = base * (0.45 + topCatch * 0.85);
        lit += vec3(0.14, 0.20, 0.32) * rimCatch * smoothstep(10.0, 38.0, vWorldPos.y);

        // Warm crimson bounce from the burning Throne Hall windows onto surrounding stone spires
        float throneDist = length(vWorldPos - vec3(0.0, 34.0, -50.8));
        float throneGlow = exp(-throneDist * 0.105) * (0.88 + 0.12 * sin(uTime * 4.8));
        lit += vec3(0.32, 0.055, 0.018) * throneGlow;

        // Gentle atmospheric valley mist hugging ONLY the cliff base (y < 22m), leaving spires razor-crisp!
        float baseMist = (1.0 - smoothstep(2.0, 26.0, vWorldPos.y)) * 0.48;
        vec3 mistCol = vec3(0.065, 0.085, 0.135);
        lit = mix(lit, mistCol, baseMist);

        gl_FragColor = vec4(lit, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.FrontSide,
    fog: false
  }));
  const castleVistaMesh = new THREE.Mesh(castleVista.castleGeo, castleSilhouetteMat);
  castleVistaMesh.frustumCulled = false;
  exteriorGroup.add(castleVistaMesh);

  // Glowing Crimson Throne Hall Windows (pulsing firelight high atop the cliff!)
  const castleWindowsMat = trackMat(new THREE.ShaderMaterial({
    uniforms: { uTime: extSkyUniforms.uTime },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vWorldPos;
      void main() {
        float fl = 0.82 + 0.18 * sin(uTime * 5.2 + vWorldPos.x * 0.9) + 0.09 * sin(uTime * 11.4 + vWorldPos.y);
        vec3 col = mix(vec3(1.15, 0.14, 0.04), vec3(2.25, 0.62, 0.14), clamp(fl * 0.65, 0.0, 1.0));
        gl_FragColor = vec4(col * fl, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.DoubleSide,
    fog: false
  }));
  const castleWindowsMesh = new THREE.Mesh(castleVista.windowsGeo, castleWindowsMat);
  castleWindowsMesh.frustumCulled = false;
  exteriorGroup.add(castleWindowsMesh);

  // Rising Column of Ash & Dark Smoke billowing up from the Castle of Ash Keep (1 DC, fog: false)
  const CASTLE_PLUME_COUNT = isMobile ? 22 : 42;
  const plumePos = new Float32Array(CASTLE_PLUME_COUNT * 3);
  const plumeSeed = new Float32Array(CASTLE_PLUME_COUNT * 3);
  for (let i = 0; i < CASTLE_PLUME_COUNT; i++) {
    plumePos[i * 3]     = (extRng() - 0.5) * 9.0;
    plumePos[i * 3 + 1] = 36.0 + extRng() * 26.0;
    plumePos[i * 3 + 2] = -55.0 + (extRng() - 0.5) * 6.0;
    plumeSeed[i * 3]     = extRng();
    plumeSeed[i * 3 + 1] = 0.6 + extRng() * 0.7;
    plumeSeed[i * 3 + 2] = 0.8 + extRng() * 1.4;
  }
  const castlePlumeGeo = trackGeo(new THREE.BufferGeometry());
  castlePlumeGeo.setAttribute('position', new THREE.BufferAttribute(plumePos, 3));
  castlePlumeGeo.setAttribute('aSeed', new THREE.BufferAttribute(plumeSeed, 3));
  const castlePlumeMat = trackMat(new THREE.ShaderMaterial({
    uniforms: { uTime: extSkyUniforms.uTime, uTex: { value: mistSpriteTex } },
    vertexShader: `
      attribute vec3 aSeed;
      uniform float uTime;
      varying float vAlpha;
      varying float vHeight;
      void main() {
        float cyc = fract(aSeed.x + uTime * 0.032 * aSeed.y);
        vec3 p = position;
        p.y = 35.0 + cyc * 32.0;
        p.x += cyc * 14.0 + sin(uTime * 0.35 + aSeed.x * 12.0) * 2.4;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(((1.2 + cyc * 2.2) * aSeed.z * 780.0) / max(8.0, -mv.z), 18.0, 170.0);
        vAlpha = sin(cyc * 3.14159) * 0.34;
        vHeight = cyc;
      }
    `,
    fragmentShader: `
      uniform sampler2D uTex;
      varying float vAlpha;
      varying float vHeight;
      void main() {
        vec4 t = texture2D(uTex, gl_PointCoord);
        vec3 col = mix(vec3(0.28, 0.10, 0.07), vec3(0.14, 0.18, 0.26), smoothstep(0.0, 0.55, vHeight));
        float a = t.a * vAlpha;
        if (a < 0.008) discard;
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    fog: false
  }));
  const castlePlumePoints = new THREE.Points(castlePlumeGeo, castlePlumeMat);
  castlePlumePoints.frustumCulled = false;
  exteriorGroup.add(castlePlumePoints);

  // --------------------------------------------------------------------------
  // C3. Sculpted Wet Pebble Shore Terrain Mesh (100% synced with evalExteriorGroundY!)
  // --------------------------------------------------------------------------
  const shoreTerrainMat = regNormalMat(
    trackMat(new THREE.MeshStandardMaterial({
      map: shorePbr.albedo,
      normalMap: lowSpecMode ? null : shorePbr.normal,
      normalScale: new THREE.Vector2(0.88, 0.88),
      roughnessMap: shorePbr.orm,
      aoMap: shorePbr.orm,
      aoMapIntensity: 0.65,
      vertexColors: true,
      color: 0xffffff,
      roughness: 0.92,
      metalness: 0.05
    })),
    shorePbr.normal
  );

  function buildShoreTerrainGeo() {
    const segX = isMobile ? 42 : 68;
    const segZ = isMobile ? 48 : 78;
    const minX = -26.0, maxX = 32.0;
    const minZ = -18.0, maxZ = 44.0;
    const geo = new THREE.PlaneGeometry(maxX - minX, maxZ - minZ, segX, segZ);
    geo.rotateX(-Math.PI * 0.5);
    geo.translate((minX + maxX) * 0.5, 0, (minZ + maxZ) * 0.5);

    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    const cols = new Float32Array(pos.count * 3);
    const cDry = new THREE.Color(0x6d7486);
    const cWet = new THREE.Color(0x3a4152);
    const cPath = new THREE.Color(0x7c8294);
    const cMoss = new THREE.Color(0x4a594d);
    const cCliff = new THREE.Color(0x2f3545);
    const cTmp = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = evalExteriorGroundY(x, z);
      pos.setY(i, y);
      uv.setXY(i, x * 0.24, z * 0.24);

      const rDist = getRiverSignedDist(x, z);
      const wetT = 1.0 - smoothstep(-0.3, 2.6, rDist);
      const pathT = (z >= 4.0 && z <= 33.5) ? (1.0 - smoothstep(1.2, 2.8, Math.abs(x - getPathCenterX(z)))) : 0.0;
      const cliffT = smoothstep(0.85, 3.2, y);
      const mossNoise = clamp01(0.5 + 0.5 * Math.sin(x * 0.55 + z * 0.37) * Math.cos(z * 0.41 - x * 0.28));
      const mossT = smoothstep(0.55, 0.88, mossNoise) * (1.0 - pathT) * (1.0 - wetT) * smoothstep(0.15, 0.9, y);

      cTmp.copy(cDry);
      cTmp.lerp(cPath, pathT * 0.65);
      cTmp.lerp(cMoss, mossT * 0.52);
      cTmp.lerp(cWet, wetT * 0.85);
      cTmp.lerp(cCliff, cliffT * 0.85);
      cols[i * 3]     = cTmp.r;
      cols[i * 3 + 1] = cTmp.g;
      cols[i * 3 + 2] = cTmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    return geo;
  }

  const shoreTerrainMesh = new THREE.Mesh(trackGeo(buildShoreTerrainGeo()), shoreTerrainMat);
  shoreTerrainMesh.receiveShadow = true;
  exteriorGroup.add(shoreTerrainMesh);

  // Ancient Half-Buried Flagstone Stepping Slabs along the Coastal Path (wakePos -> bonfire -> gate)
  const pathSlabParts = [];
  for (let pz = 5.6; pz <= 30.2; pz += 1.85) {
    const cx = getPathCenterX(pz) + (extRng() - 0.5) * 0.55;
    const gy = evalExteriorGroundY(cx, pz);
    const sw = 1.25 + extRng() * 0.75;
    const sd = 0.95 + extRng() * 0.55;
    const slab = new THREE.BoxGeometry(sw, 0.14, sd);
    xformGeo(slab, cx, gy - 0.025, pz, (extRng() - 0.5) * 0.04, (extRng() - 0.5) * 0.35, (extRng() - 0.5) * 0.04);
    pathSlabParts.push(tintGeo(THREE, slab, 0x858ca0, 0x454a5a));
  }
  const extAshlarMat = regNormalMat(
    trackMat(new THREE.MeshStandardMaterial({
      map: basaltPbr.albedo,
      normalMap: lowSpecMode ? null : basaltPbr.normal,
      normalScale: new THREE.Vector2(0.84, 0.84),
      roughnessMap: basaltPbr.orm,
      aoMap: basaltPbr.orm,
      aoMapIntensity: 0.70,
      vertexColors: true,
      color: 0xb6bfd4,
      roughness: 0.92,
      metalness: 0.05
    })),
    basaltPbr.normal
  );
  const pathSlabsMesh = new THREE.Mesh(
    trackGeo(mergeNonIndexedGeos(THREE, pathSlabParts, { boxUvTile: 2.2, withColor: true })),
    extAshlarMat
  );
  pathSlabsMesh.receiveShadow = true;
  exteriorGroup.add(pathSlabsMesh);

  // --------------------------------------------------------------------------
  // C4. Curving Black Gorge River Surface + Roaring Outfall Waterfall Cascade + Mist
  // --------------------------------------------------------------------------
  function buildExteriorRiverRibbonGeo() {
    const zSteps = isMobile ? 42 : 68;
    const xSteps = isMobile ? 14 : 20;
    const zMin = -14.8;
    const zMax = 44.0;
    const pos = new Float32Array((zSteps + 1) * (xSteps + 1) * 3);
    const uv = new Float32Array((zSteps + 1) * (xSteps + 1) * 2);
    const indices = [];

    for (let iz = 0; iz <= zSteps; iz++) {
      const v = iz / zSteps;
      const z = lerp(zMin, zMax, v);
      const rcx = getRiverCenterX(z);
      const rhw = getRiverHalfWidth(z) + 2.4; // generous feather skirt under pebble bank (zero polygon seam!)
      for (let ix = 0; ix <= xSteps; ix++) {
        const u = ix / xSteps;
        const x = rcx + (u * 2.0 - 1.0) * rhw;
        const vi = iz * (xSteps + 1) + ix;
        pos[vi * 3]     = x;
        pos[vi * 3 + 1] = WATER_LEVEL;
        pos[vi * 3 + 2] = z;
        uv[vi * 2]     = u;
        uv[vi * 2 + 1] = v * 12.0;
      }
    }
    for (let iz = 0; iz < zSteps; iz++) {
      for (let ix = 0; ix < xSteps; ix++) {
        const a = iz * (xSteps + 1) + ix;
        const b = (iz + 1) * (xSteps + 1) + ix;
        const d = iz * (xSteps + 1) + (ix + 1);
        const e = (iz + 1) * (xSteps + 1) + (ix + 1);
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

  const extRiverUniforms = {
    uTime: extSkyUniforms.uTime,
    uLowSpec: extSkyUniforms.uLowSpec,
    uBonfireLit: { value: 0.0 }
  };
  const extRiverMat = trackMat(new THREE.ShaderMaterial({
    uniforms: extRiverUniforms,
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying float vWave;
      void main() {
        vUv = uv;
        vec3 p = position;
        float t = uTime * 2.4;
        float edge = sin(clamp(uv.x, 0.0, 1.0) * 3.14159);
        float w = (sin(uv.y * 5.2 - t * 2.3 + uv.x * 4.0) * 0.045
                +  cos(uv.y * 8.4 - t * 3.1 - uv.x * 7.0) * 0.024) * edge;
        // Extra churning swell in the outfall plunge pool around (0.3, -10.5)
        float poolD = length(p.xz - vec2(0.3, -10.5));
        float poolSurge = exp(-poolD * poolD * 0.045) * sin(t * 4.2 - poolD * 2.4) * 0.085;
        p.y += w + poolSurge;
        vWave = w + poolSurge;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uLowSpec;
      uniform float uBonfireLit;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying float vWave;

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
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.55;
        for (int i = 0; i < 3; i++) {
          v += a * vnoise(p);
          p = p * 2.1 + vec2(9.3, 14.7);
          a *= 0.48;
        }
        return v;
      }

      void main() {
        float t = uTime * 1.85;
        vec2 fUv = vec2(vUv.x * 5.2, vUv.y * 2.1 - t);
        float n1 = fbm(fUv);
        float n2 = uLowSpec < 0.5 ? fbm(fUv * 2.4 + vec2(n1 * 1.35, -t * 0.65)) : n1;
        float nX = fbm(fUv + vec2(0.14, 0.0));
        float nZ = fbm(fUv + vec2(0.0, 0.14));
        float rpl = n1 * 0.52 + n2 * 0.48;

        // Sharp turbulent water-wave normal for dark obsidian gorge torrent!
        vec3 N = normalize(vec3((n1 - nX) * 3.8, 1.0, (n1 - nZ) * 4.2));
        vec3 V = normalize(cameraPosition - vWorldPos);
        float fres = pow(1.0 - max(dot(N, V), 0.0), 4.2);

        // Deep glossy ink-black mountain river water (never flat pale ice!)
        vec3 deepCol = vec3(0.003, 0.006, 0.013);
        vec3 skyRefl = vec3(0.075, 0.125, 0.225);
        vec3 col = mix(deepCol, skyRefl, fres * 0.58 + rpl * 0.06);

        // Crisp silver moonlight glints dancing across moving black ripples
        vec3 moonL = normalize(vec3(-0.26, 0.48, -0.838));
        vec3 Hm = normalize(moonL + V);
        float moonSpec = pow(max(dot(N, Hm), 0.0), 96.0);
        float moonSheen = pow(max(dot(N, Hm), 0.0), 20.0) * 0.10;
        col += vec3(0.72, 0.86, 1.08) * (moonSpec * 1.55 + moonSheen);

        // Warm amber reflection glint when the Shore Bonfire is lit!
        if (uBonfireLit > 0.01) {
          vec3 bPos = vec3(-2.2, 1.8, 15.0);
          vec3 Lb = bPos - vWorldPos;
          float bd = length(Lb);
          vec3 Hb = normalize(normalize(Lb) + V);
          float bSpec = pow(max(dot(N, Hb), 0.0), 24.0) * exp(-bd * 0.11) * uBonfireLit;
          col += vec3(1.25, 0.50, 0.12) * bSpec * 1.05;
        }

        // Plunge-pool churning whitewater + lacy shoreline lap foam + crisp rapids streaks
        float poolD = length(vWorldPos.xz - vec2(0.3, -10.8));
        float poolFoam = exp(-poolD * poolD * 0.065) * smoothstep(0.32, 0.74, n2) * 1.05;
        float bankMask = 1.0 - smoothstep(0.05, 0.18, min(vUv.x, 1.0 - vUv.x));
        float bankFoam = bankMask * smoothstep(0.46, 0.82, n2 + sin(uTime * 2.2 + vUv.y * 3.0) * 0.10);
        float rapidsFoam = smoothstep(0.76, 0.92, rpl + vWave * 2.2) * 0.45;
        float foam = clamp(poolFoam + bankFoam * 0.72 + rapidsFoam, 0.0, 0.88);
        col = mix(col, vec3(0.56, 0.68, 0.85), foam * 0.75);

        // Smooth feathered shoreline edge alpha
        float edgeAlpha = smoothstep(0.0, 0.12, vUv.x) * smoothstep(0.0, 0.12, 1.0 - vUv.x);
        float alpha = clamp(edgeAlpha * (0.92 + foam * 0.08), 0.0, 0.96);
        if (alpha < 0.01) discard;

        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
  }));
  const extRiverMesh = new THREE.Mesh(trackGeo(buildExteriorRiverRibbonGeo()), extRiverMat);
  extRiverMesh.renderOrder = 1;
  exteriorGroup.add(extRiverMesh);

  // Roaring Waterfall Cascade Sheet pouring out of the Outfall Arch at (0, +1.5 -> -0.15, z = -14.5 -> -10.8)
  function buildWaterfallSheetGeo() {
    const cols = 16;
    const rows = 14;
    const pos = new Float32Array((cols + 1) * (rows + 1) * 3);
    const uv = new Float32Array((cols + 1) * (rows + 1) * 2);
    const idx = [];
    for (let r = 0; r <= rows; r++) {
      const v = r / rows; // 0 = outfall lip inside arch, 1 = plunge pool splash
      const z = -14.4 + v * 3.55;
      const y = 1.55 - v * v * 1.75; // parabolic waterfall drop!
      const halfW = 2.65 + v * 0.85;
      for (let c = 0; c <= cols; c++) {
        const u = c / cols;
        const x = (u * 2.0 - 1.0) * halfW;
        const archDip = (1.0 - Math.pow(u * 2.0 - 1.0, 2.0)) * 0.22;
        const vi = r * (cols + 1) + c;
        pos[vi * 3]     = x;
        pos[vi * 3 + 1] = y + archDip * (1.0 - v);
        pos[vi * 3 + 2] = z + archDip * 0.55;
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

  const waterfallMat = trackMat(new THREE.ShaderMaterial({
    uniforms: { uTime: extSkyUniforms.uTime },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        p.y += sin(uv.x * 16.0 + uv.y * 8.0 - uTime * 9.0) * 0.06 * uv.y;
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
        float s1 = vnoise(vec2(vUv.x * 11.0, vUv.y * 5.0 - uTime * 4.8));
        float s2 = vnoise(vec2(vUv.x * 22.0 + 3.1, vUv.y * 9.0 - uTime * 7.6));
        float streak = smoothstep(0.28, 0.82, s1 * 0.6 + s2 * 0.4 + vUv.y * 0.25);
        float sideFade = smoothstep(0.0, 0.14, vUv.x) * smoothstep(0.0, 0.14, 1.0 - vUv.x);
        vec3 waterCol = mix(vec3(0.14, 0.22, 0.34), vec3(0.76, 0.86, 0.98), streak);
        float a = clamp((0.55 + streak * 0.45) * sideFade, 0.0, 0.94);
        if (a < 0.01) discard;
        gl_FragColor = vec4(waterCol, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
  }));
  const waterfallMesh = new THREE.Mesh(trackGeo(buildWaterfallSheetGeo()), waterfallMat);
  waterfallMesh.renderOrder = 2;
  exteriorGroup.add(waterfallMesh);

  // --------------------------------------------------------------------------
  // C5. Sheer Black Basalt Outfall Cliff, Massive Gothic Outfall Arch, Broken Iron Grate,
  //     Coastal Boulders & Ruined Gate of the Ash Gorge (Merged into tight PBR batches!)
  // --------------------------------------------------------------------------
  // Natural Jagged Volcanic Cliff & Boulder Material (uses cliffPbr — anti-shimmer matte volcanic basalt!)
  const extBasaltMat = regNormalMat(
    trackMat(new THREE.MeshStandardMaterial({
      map: cliffPbr.albedo,
      normalMap: lowSpecMode ? null : cliffPbr.normal,
      normalScale: new THREE.Vector2(0.76, 0.76),
      roughnessMap: cliffPbr.orm,
      aoMap: cliffPbr.orm,
      aoMapIntensity: 0.76,
      vertexColors: true,
      color: 0xb4bfd6,
      roughness: 0.96,
      metalness: 0.04
    })),
    cliffPbr.normal
  );

  const basaltParts = [];
  const ashlarParts = [];
  const extIronParts = [];

  // 1. Massive Sheer Basalt Outfall Cliff Face behind the hero (z = -14..-18m, V-gorge crest so Castle of Ash towers completely unobstructed above!)
  const cliffBlockSpecs = [
    // Left & Right sheer basalt cliff pillars framing the subterranean outfall arch (V-gorge framing!)
    { x: -10.5, y: 5.4, z: -15.4, r: 5.8, sy: 1.12, seed: 801 },
    { x:  10.5, y: 5.6, z: -15.2, r: 6.0, sy: 1.15, seed: 802 },
    { x: -18.5, y: 8.6, z: -14.2, r: 7.4, sy: 1.48, seed: 803 },
    { x:  18.8, y: 8.8, z: -14.0, r: 7.5, sy: 1.48, seed: 804 },
    // Crisp low basalt cliff crown directly above the outfall arch (crest ~y=9.8m -> reveals entire Castle of Ash behind!)
    { x:   0.0, y: 7.9, z: -16.6, r: 5.4, sy: 0.42, seed: 805 },
    { x:  -6.6, y: 8.6, z: -17.2, r: 5.2, sy: 0.56, seed: 806 },
    { x:   6.8, y: 8.8, z: -17.0, r: 5.4, sy: 0.56, seed: 807 },
    // Left coastal gorge cliff wall curving down the west flank (x = -15..-23, z = -10..+36)
    { x: -16.5, y: 4.5, z:  -5.0, r: 5.8, sy: 1.25, seed: 808 },
    { x: -17.5, y: 5.2, z:   4.5, r: 6.2, sy: 1.28, seed: 809 },
    { x: -18.2, y: 5.8, z:  14.5, r: 6.6, sy: 1.32, seed: 810 },
    { x: -16.8, y: 5.5, z:  24.5, r: 6.4, sy: 1.30, seed: 811 },
    { x: -13.2, y: 5.2, z:  33.0, r: 6.2, sy: 1.32, seed: 812 },
    // Right gorge cliff wall across the black river (x = +20..+28, z = -6..+36)
    { x:  21.5, y: 5.4, z:  -4.0, r: 6.4, sy: 1.32, seed: 813 },
    { x:  23.5, y: 6.0, z:   7.0, r: 6.8, sy: 1.35, seed: 814 },
    { x:  25.2, y: 6.2, z:  18.5, r: 7.0, sy: 1.35, seed: 815 },
    { x:  24.5, y: 5.8, z:  29.5, r: 6.8, sy: 1.32, seed: 816 },
    { x:  16.0, y: 4.8, z:  35.5, r: 6.0, sy: 1.24, seed: 817 }
  ];
  for (let i = 0; i < cliffBlockSpecs.length; i++) {
    const c = cliffBlockSpecs[i];
    const g = buildSculptedRockGeo(THREE, c.r, c.seed, c.sy, 1);
    xformGeo(g, c.x, c.y, c.z, 0, extRng() * 6.28, 0);
    basaltParts.push(tintGeo(THREE, g, 0x454e62, 0x161a24));
  }

  // Sculpted Shore & River Boulders (including those matching EXTERIOR_STATIC_COLLIDERS!)
  const boulderSpecs = [
    // Collider-matched shore boulders
    { x: -8.6, z:  0.8, r: 1.60, sy: 0.72 },
    { x: -9.4, z:  8.5, r: 1.72, sy: 0.78 },
    { x: -9.8, z: 18.8, r: 1.76, sy: 0.80 },
    { x: -8.8, z: 26.4, r: 1.70, sy: 0.76 },
    { x: -5.4, z: -2.6, r: 1.48, sy: 0.68 },
    { x:  6.4, z: 23.2, r: 1.38, sy: 0.66 },
    // Plunge pool & river rapids rocks (dramatic foam-splashed wet basalt!)
    { x:  4.6, z: -8.2, r: 1.45, sy: 0.62 },
    { x: -4.4, z: -9.5, r: 1.65, sy: 0.72 },
    { x:  9.2, z:  0.4, r: 1.22, sy: 0.56 },
    { x: 13.8, z: 11.2, r: 1.40, sy: 0.60 },
    { x: 11.2, z: 21.8, r: 1.28, sy: 0.58 },
    { x: 15.8, z: 28.0, r: 1.65, sy: 0.70 },
    // Small decorative coastal rocks outside center walklines
    { x: -11.5, z: 13.2, r: 1.35, sy: 0.70 },
    { x:  -7.2, z: 12.2, r: 0.72, sy: 0.55 },
    { x:   4.2, z: 10.6, r: 0.64, sy: 0.48 },
    { x:  -5.6, z: 22.0, r: 0.78, sy: 0.55 }
  ];
  for (let i = 0; i < boulderSpecs.length; i++) {
    const b = boulderSpecs[i];
    const gy = evalExteriorGroundY(b.x, b.z);
    const g = buildSculptedRockGeo(THREE, b.r, 850 + i, b.sy, 1);
    xformGeo(g, b.x, gy + b.r * b.sy * 0.32, b.z, 0, extRng() * 6.28, 0);
    // Subtle moss tint on drier boulders, darker wet basalt in the river
    const inWater = gy < WATER_LEVEL + 0.1;
    basaltParts.push(tintGeo(THREE, g, inWater ? 0x3b4456 : 0x525d68, 0x1a1e28));
  }

  // 2. Massive Subterranean Outfall Gothic Stone Archway at (0, 0, -14.0) + Broken Bent Rusty Grate!
  const archZ = -14.0;
  // Flanking massive outfall retaining piers
  for (const side of [-1, 1]) {
    ashlarParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(2.6, 7.6, 3.8), side * 4.4, 3.3, archZ), 0x626c84, 0x262b38));
    ashlarParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(3.0, 0.65, 4.2), side * 4.4, 6.8, archZ), 0x727e99, 0x343a4c));
  }
  // Pointed gothic stone arch voussoirs spanning the outfall opening (x in [-3.4..+3.4], y = 4.6 -> 7.8m)
  const outArchSegs = 12;
  for (let i = 0; i < outArchSegs; i++) {
    const a0 = (i / outArchSegs) * Math.PI;
    const a1 = ((i + 1) / outArchSegs) * Math.PI;
    const x0 = -Math.cos(a0) * 3.65;
    const y0 = 3.9 + Math.pow(Math.sin(a0), 0.82) * 3.85;
    const x1 = -Math.cos(a1) * 3.65;
    const y1 = 3.9 + Math.pow(Math.sin(a1), 0.82) * 3.85;
    const len = Math.hypot(x1 - x0, y1 - y0) + 0.18;
    const ang = Math.atan2(y1 - y0, x1 - x0);
    ashlarParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(len, 0.95, 3.4), (x0 + x1) * 0.5, (y0 + y1) * 0.5, archZ, 0, 0, ang), 0x707b96, 0x303648));
  }
  // Carved keystone & upper headwall masonry
  ashlarParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(1.15, 1.55, 3.8), 0, 7.85, archZ), 0x7c88a4, 0x3a4256));
  ashlarParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(11.6, 2.2, 2.8), 0, 8.8, archZ - 0.5), 0x525a70, 0x222634));

  // Pitch-black recessed subterranean tunnel mouth backing inside the outfall arch
  const outfallVoidMat = trackMat(new THREE.MeshBasicMaterial({ color: 0x03050a }));
  const outfallVoid = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(7.2, 7.4)), outfallVoidMat);
  outfallVoid.position.set(0, 3.4, archZ - 1.35);
  exteriorGroup.add(outfallVoid);

  // Shattered & Violently Bent-Outward Rusty Iron Grate Bars hanging from the Outfall Arch!
  extIronParts.push(xformGeo(new THREE.BoxGeometry(7.4, 0.34, 0.34), 0, 6.2, archZ + 1.25));
  for (let i = -4; i <= 4; i++) {
    const bx = i * 0.76;
    const isBrokenCenter = Math.abs(i) <= 2;
    if (isBrokenCenter) {
      // Bent & snapped upper stub jutting violently OUTWARD (+Z) from hero breaking through!
      const topStub = new THREE.CylinderGeometry(0.085, 0.095, 2.55, 7);
      xformGeo(topStub, bx, 5.15, archZ + 1.85, -0.78 - (2 - Math.abs(i)) * 0.22, 0, i * 0.14);
      extIronParts.push(topStub);
      // Twisted lower shard sticking out of the waterfall lip
      const botStub = new THREE.CylinderGeometry(0.08, 0.09, 1.55, 7);
      xformGeo(botStub, bx, 1.45, archZ + 1.72, 0.92, 0, -i * 0.18);
      extIronParts.push(botStub);
    } else {
      // Intact outer rusted bars
      const bar = new THREE.CylinderGeometry(0.09, 0.10, 5.4, 7);
      xformGeo(bar, bx, 3.55, archZ + 1.25);
      extIronParts.push(bar);
    }
  }

  // 3. Ancient Ruined GATE OF THE ASH GORGE at (0, y, z = +31.0) + Twin Gate Braziers!
  const gateZ = 31.0;
  const gateGroundY = evalExteriorGroundY(0.0, gateZ);
  for (const side of [-1, 1]) {
    // Massive battered gothic gatehouse pylon + plinth + buttress + broken battlements
    ashlarParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(2.7, 0.85, 2.9), side * 3.85, gateGroundY + 0.35, gateZ), 0x737f9a, 0x303648));
    ashlarParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(2.2, 7.6, 2.3), side * 3.85, gateGroundY + 4.2, gateZ), 0x6b7792, 0x2b3142));
    ashlarParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(2.55, 0.48, 2.65), side * 3.85, gateGroundY + 5.8, gateZ), 0x7d8aa6, 0x3b4358));
    // Stepped ruined pylon turret cap (asymmetric weathered break!)
    const capH = side < 0 ? 1.8 : 1.1;
    ashlarParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(1.75, capH, 1.85), side * 3.95, gateGroundY + 8.0 + capH * 0.5, gateZ), 0x7986a2, 0x3a4256));
    // Wing walls linking gate piers to the flanking gorge cliffs
    ashlarParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(5.6, 4.6, 1.5), side * 7.4, gateGroundY + 2.1, gateZ + 0.5, 0, -side * 0.16, 0), 0x5d677e, 0x252a38));
    // Flanking Brazier stone pedestals at (±3.55, 29.3)
    const bgy = evalExteriorGroundY(side * 3.55, 29.3);
    ashlarParts.push(tintGeo(THREE, xformGeo(new THREE.CylinderGeometry(0.42, 0.56, 1.15, 8), side * 3.55, bgy + 0.55, 29.3), 0x6f7b94, 0x2d3344));
    // Wrought-iron brazier bowl & 6-bar fire cage
    extIronParts.push(xformGeo(new THREE.CylinderGeometry(0.56, 0.36, 0.42, 8), side * 3.55, bgy + 1.32, 29.3));
    for (let bi = 0; bi < 6; bi++) {
      const ba = (bi / 6) * Math.PI * 2;
      extIronParts.push(xformGeo(
        new THREE.CylinderGeometry(0.032, 0.036, 0.62, 6),
        side * 3.55 + Math.cos(ba) * 0.48,
        bgy + 1.66,
        29.3 + Math.sin(ba) * 0.48,
        0, 0, 0
      ));
    }
    extIronParts.push(xformGeo(new THREE.TorusGeometry(0.52, 0.038, 6, 12), side * 3.55, bgy + 1.94, 29.3, Math.PI * 0.5, 0, 0));
  }
  // Broken Pointed Gothic Gate Archway (dramatically fractured gap near the crown!)
  const gateArchSegs = 10;
  for (let i = 0; i < gateArchSegs; i++) {
    if (i === 5) continue; // iconic crumbled gap in the ruined gate arch!
    const a0 = (i / gateArchSegs) * Math.PI;
    const a1 = ((i + 1) / gateArchSegs) * Math.PI;
    const x0 = -Math.cos(a0) * 3.15;
    const y0 = gateGroundY + 5.75 + Math.pow(Math.sin(a0), 0.78) * 3.35;
    const x1 = -Math.cos(a1) * 3.15;
    const y1 = gateGroundY + 5.75 + Math.pow(Math.sin(a1), 0.78) * 3.35;
    const len = Math.hypot(x1 - x0, y1 - y0) + 0.16;
    const ang = Math.atan2(y1 - y0, x1 - x0);
    ashlarParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(len, 0.76, 1.75), (x0 + x1) * 0.5, (y0 + y1) * 0.5, gateZ, 0, 0, ang), 0x77839f, 0x353c50));
  }

  // Carved ancient stone threshold sill across the Gate of the Ash Gorge floor (anchors fog wall seamlessly!)
  ashlarParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(6.6, 0.34, 2.2), 0, gateGroundY + 0.04, gateZ + 0.25), 0x646e84, 0x252a38));
  // Dark shadowed continuation rocks behind the fog gate so horizon sky never peeks under the threshold
  basaltParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(14.0, 2.4, 14.0), 0, gateGroundY - 0.85, gateZ + 8.0), 0x161b26, 0x0a0d14));

  // Merge basalt cliffs/boulders (1 DC), ashlar outfall+gate stonework (1 DC), and exterior ironwork (1 DC)!
  const extBasaltMesh = new THREE.Mesh(
    trackGeo(mergeNonIndexedGeos(THREE, basaltParts, { boxUvTile: 4.5, withColor: true })),
    extBasaltMat
  );
  extBasaltMesh.receiveShadow = true;
  exteriorGroup.add(extBasaltMesh);

  const extAshlarMesh = new THREE.Mesh(
    trackGeo(mergeNonIndexedGeos(THREE, ashlarParts, { boxUvTile: 2.8, withColor: true })),
    extAshlarMat
  );
  extAshlarMesh.receiveShadow = true;
  exteriorGroup.add(extAshlarMesh);

  const extIronMesh = new THREE.Mesh(
    trackGeo(mergeNonIndexedGeos(THREE, extIronParts, { boxUvTile: 1.4 })),
    rustedGrateMat
  );
  exteriorGroup.add(extIronMesh);

  // Swirling Moonlit Fog Gate Wall inside the Ruined Gate of the Ash Gorge (Chapter II threshold!)
  const gateFogMat = trackMat(new THREE.ShaderMaterial({
    uniforms: { uTime: extSkyUniforms.uTime },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
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
        float edgeX = smoothstep(0.0, 0.14, vUv.x) * smoothstep(0.0, 0.14, 1.0 - vUv.x);
        float edgeBottom = smoothstep(0.0, 0.05, vUv.y);
        float archTop = 1.0 - smoothstep(0.68, 0.98, vUv.y + pow(abs(vUv.x - 0.5) * 1.65, 2.0) * 0.45);
        float n1 = vnoise(vec2(vUv.x * 3.5 + uTime * 0.16, vUv.y * 2.8 - uTime * 0.24));
        float n2 = vnoise(vec2(vUv.x * 7.2 - uTime * 0.22, vUv.y * 5.6 - uTime * 0.35));
        float swirl = n1 * 0.62 + n2 * 0.38;
        vec3 col = mix(vec3(0.18, 0.26, 0.42), vec3(0.68, 0.78, 0.94), swirl);
        float a = edgeX * edgeBottom * archTop * (0.34 + swirl * 0.46);
        if (a < 0.01) discard;
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
  }));
  const gateFogWall = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(5.8, 8.6)), gateFogMat);
  gateFogWall.position.set(0, gateGroundY + 3.95, gateZ + 0.35);
  gateFogWall.renderOrder = 3;
  exteriorGroup.add(gateFogWall);

  // --------------------------------------------------------------------------
  // C6. Planted Oath Sword («Меч Клятвы») at swordPos (2.8, y, 5.2) + Golden Beacon!
  // --------------------------------------------------------------------------
  const swordGroup = new THREE.Group();
  const sx = EXTERIOR_SHORE_ANCHORS.swordPos.x;
  const sy = EXTERIOR_SHORE_ANCHORS.swordPos.y;
  const sz = EXTERIOR_SHORE_ANCHORS.swordPos.z;
  swordGroup.position.set(sx, sy, sz);
  exteriorGroup.add(swordGroup);

  // Small pebbled impact mound where the Oath Sword plunged into the shore
  const swordMoundMesh = new THREE.Mesh(
    trackGeo(tintGeo(THREE, buildSculptedRockGeo(THREE, 0.48, 910, 0.34, 1), 0x5c6476, 0x262b36)),
    shoreTerrainMat
  );
  swordMoundMesh.position.y = 0.04;
  swordGroup.add(swordMoundMesh);

  // Sculpted 3D Oath Sword (forged steel blade + fuller + gothic crossguard + wrapped hilt + pommel)
  const swordVisualPivot = new THREE.Group();
  swordVisualPivot.rotation.set(0.24, 0.58, -0.22); // jammed dramatically at an angle in the pebbles!
  swordGroup.add(swordVisualPivot);

  const oathSteelMat = trackMat(new THREE.MeshStandardMaterial({
    color: 0xd0daec,
    roughness: 0.28,
    metalness: 0.88,
    emissive: 0x3b2a10,
    emissiveIntensity: 0.35
  }));
  const oathGoldMat = trackMat(new THREE.MeshStandardMaterial({
    color: 0xd4a84e,
    roughness: 0.34,
    metalness: 0.82,
    emissive: 0x5a3a08,
    emissiveIntensity: 0.45
  }));

  const swordBladeParts = [];
  // Tapered diamond-section blade rising from pebbles (blade tip buried at y=-0.12, guard at y=+0.88)
  const bladeMain = new THREE.CylinderGeometry(0.056, 0.022, 1.04, 4);
  xformGeo(bladeMain, 0, 0.36, 0, 0, Math.PI / 4, 0, 1.0, 1.0, 0.34);
  swordBladeParts.push(bladeMain);
  const swordBladeMesh = new THREE.Mesh(
    trackGeo(mergeNonIndexedGeos(THREE, swordBladeParts)),
    oathSteelMat
  );
  swordVisualPivot.add(swordBladeMesh);

  const swordHiltParts = [];
  // Ornate gothic winged crossguard
  swordHiltParts.push(xformGeo(new THREE.BoxGeometry(0.42, 0.068, 0.072), 0, 0.89, 0));
  swordHiltParts.push(xformGeo(new THREE.ConeGeometry(0.046, 0.14, 4), -0.24, 0.86, 0, 0, 0, 1.18));
  swordHiltParts.push(xformGeo(new THREE.ConeGeometry(0.046, 0.14, 4),  0.24, 0.86, 0, 0, 0, -1.18));
  // Leather-ribbed grip & faceted pommel jewel
  swordHiltParts.push(xformGeo(new THREE.CylinderGeometry(0.032, 0.036, 0.28, 8), 0, 1.06, 0));
  swordHiltParts.push(xformGeo(new THREE.OctahedronGeometry(0.064, 0), 0, 1.24, 0));
  const swordHiltMesh = new THREE.Mesh(
    trackGeo(mergeNonIndexedGeos(THREE, swordHiltParts)),
    oathGoldMat
  );
  swordVisualPivot.add(swordHiltMesh);

  // Vertical Golden-Amber Beacon Light Pillar (guides the player's eye right to the dropped sword!)
  const swordBeaconMat = trackMat(new THREE.ShaderMaterial({
    uniforms: { uTime: extSkyUniforms.uTime },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNorm;
      varying vec3 vView;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNorm = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNorm;
      varying vec3 vView;
      void main() {
        float fres = pow(abs(dot(normalize(vNorm), normalize(vView))), 1.55);
        float yFade = smoothstep(0.0, 0.15, vUv.y) * pow(1.0 - vUv.y, 1.65);
        float shimmer = 0.78 + 0.22 * sin(uTime * 3.4 - vUv.y * 8.0);
        vec3 col = mix(vec3(1.15, 0.72, 0.18), vec3(1.85, 1.48, 0.72), smoothstep(0.6, 0.05, vUv.y));
        float a = fres * yFade * shimmer * 0.56;
        if (a < 0.008) discard;
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  }));
  const swordBeaconMesh = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.09, 0.34, 3.2, 12, 1, true)),
    swordBeaconMat
  );
  swordBeaconMesh.position.y = 1.62;
  swordBeaconMesh.renderOrder = 4;
  swordGroup.add(swordBeaconMesh);

  // Orbiting Golden Sparks around the Oath Sword
  const SWORD_SPARK_COUNT = isMobile ? 16 : 28;
  const swSpPos = new Float32Array(SWORD_SPARK_COUNT * 3);
  const swSpSeed = new Float32Array(SWORD_SPARK_COUNT * 3);
  for (let i = 0; i < SWORD_SPARK_COUNT; i++) {
    swSpPos[i * 3]     = 0;
    swSpPos[i * 3 + 1] = 0.4;
    swSpPos[i * 3 + 2] = 0;
    swSpSeed[i * 3]     = extRng();
    swSpSeed[i * 3 + 1] = 0.5 + extRng() * 0.9;
    swSpSeed[i * 3 + 2] = 0.22 + extRng() * 0.45;
  }
  const swordSparkGeo = trackGeo(new THREE.BufferGeometry());
  swordSparkGeo.setAttribute('position', new THREE.BufferAttribute(swSpPos, 3));
  swordSparkGeo.setAttribute('aSeed', new THREE.BufferAttribute(swSpSeed, 3));
  const swordSparkMat = trackMat(new THREE.ShaderMaterial({
    uniforms: { uTime: extSkyUniforms.uTime, uTex: { value: mistSpriteTex } },
    vertexShader: `
      attribute vec3 aSeed;
      uniform float uTime;
      varying float vAlpha;
      void main() {
        float cyc = fract(aSeed.x + uTime * 0.32 * aSeed.y);
        float ang = aSeed.x * 6.283 + uTime * (1.2 + aSeed.y * 1.1);
        float rad = aSeed.z * (1.0 - cyc * 0.45);
        vec3 p = vec3(cos(ang) * rad, 0.25 + cyc * 2.4, sin(ang) * rad);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(68.0 / max(1.0, -mv.z), 3.0, 22.0);
        vAlpha = sin(cyc * 3.14159) * 0.95;
      }
    `,
    fragmentShader: `
      uniform sampler2D uTex;
      varying float vAlpha;
      void main() {
        vec4 t = texture2D(uTex, gl_PointCoord);
        float a = t.a * vAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vec3(1.9, 1.38, 0.52), a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  const swordSparks = new THREE.Points(swordSparkGeo, swordSparkMat);
  swordSparks.renderOrder = 5;
  swordGroup.add(swordSparks);

  const swordBeaconLight = new THREE.PointLight(0xffcb66, 0.0, 8.5, 1.7);
  swordBeaconLight.position.set(0, 1.15, 0);
  swordGroup.add(swordBeaconLight);

  // --------------------------------------------------------------------------
  // C7. SHORE BONFIRE («Костёр Берега») at bonfirePos (-2.2, y, 15.0) + Gate Brazier Flames!
  // --------------------------------------------------------------------------
  const bonfireGroup = new THREE.Group();
  const bx = EXTERIOR_SHORE_ANCHORS.bonfirePos.x;
  const by = EXTERIOR_SHORE_ANCHORS.bonfirePos.y;
  const bz = EXTERIOR_SHORE_ANCHORS.bonfirePos.z;
  bonfireGroup.position.set(bx, by, bz);
  exteriorGroup.add(bonfireGroup);

  function buildShoreBonfireHearthGeo() {
    const parts = [];
    // Ash & charred earth mound
    const mound = new THREE.CylinderGeometry(0.55, 1.18, 0.34, 14, 2);
    xformGeo(mound, 0, 0.14, 0);
    parts.push(tintGeo(THREE, mound, 0x3b3838, 0x1e1d20));
    // 14-stone hearth ring matching Castle of Ash bonfire silhouette
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + (extRng() - 0.5) * 0.14;
      const rr = 0.96 + (i % 2) * 0.08;
      const st = buildSculptedRockGeo(THREE, 0.24 + (i % 3) * 0.04, 930 + i, 0.72, 0);
      xformGeo(st, Math.cos(a) * rr, 0.12, Math.sin(a) * rr, 0, a, 0);
      parts.push(tintGeo(THREE, st, 0x5c6272, 0x242630));
    }
    // 6 Charred logs & crossed weathered bones in the ash bed
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.25;
      const log = new THREE.CylinderGeometry(0.055, 0.072, 0.88, 6);
      xformGeo(log, Math.cos(a) * 0.34, 0.22, Math.sin(a) * 0.34, Math.PI * 0.44, a, 0.28);
      parts.push(tintGeo(THREE, log, 0x2c221d, 0x16110e));
    }
    return mergeNonIndexedGeos(THREE, parts, { boxUvTile: 1.5, withColor: true });
  }

  function buildShoreCoiledSwordGeo() {
    const parts = [];
    const segs = isMobile ? 16 : 26;
    const bladeH = 1.62;
    const blade = new THREE.CylinderGeometry(0.055, 0.068, bladeH, 4, segs);
    blade.rotateY(Math.PI / 4);
    const bp = blade.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const vx = bp.getX(i);
      const ly = bp.getY(i) + bladeH * 0.5;
      const vz = bp.getZ(i) * 0.45;
      const t = clamp01(ly / bladeH);
      const twist = t * Math.PI * 2.3;
      const waveX = Math.sin(t * Math.PI * 3.2) * 0.042;
      const c = Math.cos(twist);
      const s = Math.sin(twist);
      bp.setXYZ(i, vx * c - vz * s + waveX, 0.16 + ly, vx * s + vz * c);
    }
    blade.computeVertexNormals();
    parts.push(tintGeo(THREE, blade, 0x626a7f, 0x7c3f26));
    // Ornate twisted bonfire crossguard + pommel
    parts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(0.56, 0.068, 0.075), 0, 1.74, 0, 0, 0, 0.08), 0x5c6478, 0x353b4a));
    parts.push(tintGeo(THREE, xformGeo(new THREE.TorusGeometry(0.085, 0.018, 5, 10), 0, 1.76, 0.065), 0x646d84, 0x3a4052));
    parts.push(tintGeo(THREE, xformGeo(new THREE.CylinderGeometry(0.036, 0.042, 0.34, 8), 0, 1.96, 0), 0x302928, 0x1e1919));
    parts.push(tintGeo(THREE, xformGeo(new THREE.OctahedronGeometry(0.095, 0), 0, 2.18, 0), 0x69728a, 0x3c4252));
    return mergeNonIndexedGeos(THREE, parts, { boxUvTile: 1.2, withColor: true });
  }

  const bonfireHearthMesh = new THREE.Mesh(trackGeo(buildShoreBonfireHearthGeo()), extBasaltMat);
  bonfireHearthMesh.receiveShadow = true;
  bonfireGroup.add(bonfireHearthMesh);

  const coiledSwordMat = trackMat(new THREE.MeshStandardMaterial({
    map: ironPbr.albedo,
    roughnessMap: ironPbr.orm,
    vertexColors: true,
    color: 0xaab2c4,
    roughness: 0.72,
    metalness: 0.78
  }));
  const coiledSwordMesh = new THREE.Mesh(trackGeo(buildShoreCoiledSwordGeo()), coiledSwordMat);
  coiledSwordMesh.rotation.set(0.08, 0.45, -0.10);
  bonfireGroup.add(coiledSwordMesh);

  // Glowing Molten Ember Coal Bed inside the bonfire ring (smolders dimly unlit, blazes when lit!)
  const bonfireCoalsUniforms = {
    uTime: extSkyUniforms.uTime,
    uLit: { value: 0.0 }
  };
  const bonfireCoalsMat = trackMat(new THREE.ShaderMaterial({
    uniforms: bonfireCoalsUniforms,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
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
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;
        float n = hash21(floor(vUv * 18.0));
        float pulse = 0.78 + 0.22 * sin(uTime * 6.5 + n * 12.0);
        float radial = 1.0 - smoothstep(0.18, 0.98, r);
        float glow = radial * (0.14 + uLit * 0.96) * (0.65 + 0.35 * n) * pulse;
        vec3 col = mix(vec3(0.08, 0.03, 0.02), vec3(2.2, 0.62, 0.08), clamp(glow * 1.1, 0.0, 1.0));
        gl_FragColor = vec4(col, radial * (0.65 + uLit * 0.35));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false
  }));
  const bonfireCoals = new THREE.Mesh(trackGeo(new THREE.CircleGeometry(0.76, 18)), bonfireCoalsMat);
  bonfireCoals.rotation.x = -Math.PI * 0.5;
  bonfireCoals.position.y = 0.32;
  bonfireGroup.add(bonfireCoals);

  // Reusable 3D Volumetric FBM Flame Shader (used for Shore Bonfire & Twin Ash Gorge Gate Braziers!)
  function createFlameAssemblyMesh(scaleW, scaleH, litUniformRef) {
    const flameParts = [];
    // 3 intersecting sculpted teardrop flame-sheets + inner swirling core cone (full 360-deg volume!)
    for (let k = 0; k < 3; k++) {
      const plane = new THREE.PlaneGeometry(scaleW, scaleH, 6, 10);
      plane.translate(0, scaleH * 0.5, 0);
      plane.rotateY((k / 3) * Math.PI);
      flameParts.push(plane);
    }
    const geo = trackGeo(mergeNonIndexedGeos(THREE, flameParts));
    const mat = trackMat(new THREE.ShaderMaterial({
      uniforms: {
        uTime: extSkyUniforms.uTime,
        uLit: litUniformRef
      },
      vertexShader: `
        uniform float uTime;
        uniform float uLit;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 p = position;
          float h = clamp(uv.y, 0.0, 1.0);
          // Organic upward dancing sway & gentle taper into licking flame tongues
          float sway = sin(uTime * 7.4 - h * 5.2 + p.x * 3.0) * 0.16 * h * h;
          float swayZ = cos(uTime * 6.2 - h * 4.5 + p.z * 3.0) * 0.12 * h * h;
          p.x = p.x * (1.0 - h * 0.52) + sway;
          p.z = p.z * (1.0 - h * 0.52) + swayZ;
          p.y *= (0.20 + 0.80 * uLit);
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
          float n1 = vnoise(vec2(vUv.x * 4.2, vUv.y * 3.6 - uTime * 3.8));
          float n2 = vnoise(vec2(vUv.x * 8.5 + 2.1, vUv.y * 7.2 - uTime * 6.2));
          float turb = n1 * 0.65 + n2 * 0.35;
          float shape = (1.0 - cx * cx * (1.1 + vUv.y * 0.85)) * (1.0 - smoothstep(0.35, 1.0, vUv.y + (turb - 0.5) * 0.42));
          float mask = smoothstep(0.14, 0.62, shape + (turb - 0.45) * 0.32) * smoothstep(0.0, 0.14, vUv.y);
          if (mask < 0.02) discard;
          // Blackbody fire ramp: white-gold core -> vivid amber -> deep crimson tips
          float temp = clamp(mask * (1.15 - vUv.y * 0.72), 0.0, 1.0);
          vec3 col = mix(vec3(0.95, 0.14, 0.02), vec3(1.85, 0.68, 0.10), smoothstep(0.15, 0.55, temp));
          col = mix(col, vec3(2.4, 2.05, 1.15), smoothstep(0.62, 0.96, temp));
          gl_FragColor = vec4(col, mask * 0.92 * uLit);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    }));
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = 4;
    return m;
  }

  const bonfireFlameMesh = createFlameAssemblyMesh(1.05, 1.55, bonfireCoalsUniforms.uLit);
  bonfireFlameMesh.position.y = 0.26;
  bonfireFlameMesh.visible = false;
  bonfireGroup.add(bonfireFlameMesh);

  // Rising Bonfire Ember Sparks (visible when lit)
  const BF_EMBER_COUNT = isMobile ? 20 : 38;
  const bfEmPos = new Float32Array(BF_EMBER_COUNT * 3);
  const bfEmSeed = new Float32Array(BF_EMBER_COUNT * 3);
  for (let i = 0; i < BF_EMBER_COUNT; i++) {
    bfEmPos[i * 3] = 0; bfEmPos[i * 3 + 1] = 0.3; bfEmPos[i * 3 + 2] = 0;
    bfEmSeed[i * 3]     = extRng();
    bfEmSeed[i * 3 + 1] = 0.6 + extRng() * 0.9;
    bfEmSeed[i * 3 + 2] = 0.12 + extRng() * 0.42;
  }
  const bfEmberGeo = trackGeo(new THREE.BufferGeometry());
  bfEmberGeo.setAttribute('position', new THREE.BufferAttribute(bfEmPos, 3));
  bfEmberGeo.setAttribute('aSeed', new THREE.BufferAttribute(bfEmSeed, 3));
  const bfEmberMat = trackMat(new THREE.ShaderMaterial({
    uniforms: { uTime: extSkyUniforms.uTime, uLit: bonfireCoalsUniforms.uLit, uTex: { value: mistSpriteTex } },
    vertexShader: `
      attribute vec3 aSeed;
      uniform float uTime;
      varying float vAlpha;
      void main() {
        float cyc = fract(aSeed.x + uTime * 0.42 * aSeed.y);
        float ang = aSeed.x * 6.283 + uTime * 1.9 + cyc * 4.0;
        float rad = aSeed.z * (0.4 + cyc * 1.3);
        vec3 p = vec3(cos(ang) * rad, 0.30 + cyc * 3.2, sin(ang) * rad);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(56.0 / max(1.0, -mv.z), 2.5, 16.0);
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
        gl_FragColor = vec4(vec3(2.2, 0.85, 0.20), a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  const bonfireEmbers = new THREE.Points(bfEmberGeo, bfEmberMat);
  bonfireEmbers.visible = false;
  bonfireEmbers.renderOrder = 5;
  bonfireGroup.add(bonfireEmbers);

  const bonfireLight = new THREE.PointLight(0xff8a30, 0.0, 22.0, 1.5);
  bonfireLight.position.set(0, 1.55, 0);
  bonfireGroup.add(bonfireLight);

  // Always-lit Twin Gate Brazier Flames (guiding landmarks at z = 29.3!)
  const gateAlwaysLit = { value: 1.0 };
  for (const side of [-1, 1]) {
    const bgy = evalExteriorGroundY(side * 3.55, 29.3);
    const bf = createFlameAssemblyMesh(0.86, 1.25, gateAlwaysLit);
    bf.position.set(side * 3.55, bgy + 1.48, 29.3);
    exteriorGroup.add(bf);
  }
  const gateBrazierLight = new THREE.PointLight(0xff7824, 0.0, 19.0, 1.5);
  gateBrazierLight.position.set(0, gateGroundY + 3.4, 29.2);
  exteriorGroup.add(gateBrazierLight);

  // --------------------------------------------------------------------------
  // C8. Atmospheric Props: Dead Twisted Coastal Pines, Swaying Reeds & Washed-Up Wreckage!
  // --------------------------------------------------------------------------
  // 1) Twisted Dead Coastal Pines (gnarled dark silhouettes clinging to the basalt gorge flanks, 1 DC!)
  const deadTreeParts = [];
  const pinePlacements = [
    { x: -11.4, z:  -4.2, h: 6.4, leanX:  0.26, leanZ:  0.14, ry: 0.4 },
    { x: -12.6, z:   6.8, h: 7.4, leanX:  0.28, leanZ: -0.08, ry: 1.5 },
    { x: -12.8, z:  16.8, h: 7.0, leanX:  0.26, leanZ:  0.12, ry: 2.8 },
    { x: -10.6, z:  24.8, h: 6.2, leanX:  0.22, leanZ: -0.15, ry: 4.1 },
    { x:  -9.6, z:  31.0, h: 6.6, leanX:  0.18, leanZ: -0.18, ry: 5.2 },
    { x:  15.6, z:   1.8, h: 7.2, leanX: -0.26, leanZ:  0.10, ry: 0.9 },
    { x:  18.2, z:  14.8, h: 7.8, leanX: -0.28, leanZ: -0.08, ry: 2.3 },
    { x:  16.4, z:  26.5, h: 6.8, leanX: -0.24, leanZ:  0.12, ry: 3.7 }
  ];
  for (let i = 0; i < pinePlacements.length; i++) {
    const tr = pinePlacements[i];
    const gy = evalExteriorGroundY(tr.x, tr.z) - 0.25;
    // Lower trunk
    deadTreeParts.push(tintGeo(
      THREE,
      xformGeo(new THREE.CylinderGeometry(0.18, 0.36, tr.h * 0.56, 7), tr.x, gy + tr.h * 0.26, tr.z, tr.leanZ, tr.ry, -tr.leanX),
      0x343138, 0x16141a
    ));
    // Upper crooked trunk
    const midX = tr.x + Math.sin(tr.leanX) * tr.h * 0.45;
    const midY = gy + tr.h * 0.52;
    const midZ = tr.z + Math.sin(tr.leanZ) * tr.h * 0.45;
    deadTreeParts.push(tintGeo(
      THREE,
      xformGeo(new THREE.CylinderGeometry(0.06, 0.19, tr.h * 0.52, 6), midX, midY + tr.h * 0.22, midZ, tr.leanZ * 1.4, tr.ry + 0.5, -tr.leanX * 1.3),
      0x3a3742, 0x1e1c24
    ));
    // 4 gnarled wind-bent skeletal dead pine branches
    for (let b = 0; b < 4; b++) {
      const ba = tr.ry + b * 1.62 + 0.35;
      const bh = midY + (b - 0.6) * tr.h * 0.14;
      const blen = 1.6 + (b % 2) * 0.95;
      const br = new THREE.CylinderGeometry(0.025, 0.085, blen, 5);
      xformGeo(br, midX + Math.cos(ba) * blen * 0.42, bh, midZ + Math.sin(ba) * blen * 0.42, Math.sin(ba) * 1.15, ba, Math.cos(ba) * 1.15);
      deadTreeParts.push(tintGeo(THREE, br, 0x3b3945, 0x1c1b22));
    }
  }
  const deadTreeMat = trackMat(new THREE.MeshStandardMaterial({
    map: basaltPbr.albedo,
    roughness: 0.94,
    metalness: 0.04,
    vertexColors: true,
    color: 0x767a8a
  }));
  const deadTreesMesh = new THREE.Mesh(
    trackGeo(mergeNonIndexedGeos(THREE, deadTreeParts, { boxUvTile: 2.0, withColor: true })),
    deadTreeMat
  );
  exteriorGroup.add(deadTreesMesh);

  // 2) Swaying Shore Reeds & Wind-Bent Coastal Grass (1 DC merged w/ GPU wind-sway vertex shader!)
  const reedParts = [];
  const reedClusters = [
    [ 3.8,  1.2], [ 4.5,  3.8], [ 5.1,  7.6], [ 6.2, 11.4], [ 7.0, 15.6],
    [ 7.4, 20.2], [ 7.8, 25.0], [ 6.8, 28.4], [-4.8,  0.2], [-6.8,  4.2],
    [-7.6, 10.6], [-7.8, 16.5], [-7.4, 22.8], [-5.2, 27.6], [ 2.2, -2.5],
    [-2.8, -3.2], [ 4.8, 17.5], [-4.6, 12.2]
  ];
  const bladesPerCluster = isMobile ? 5 : 9;
  for (let ci = 0; ci < reedClusters.length; ci++) {
    const [cx, cz] = reedClusters[ci];
    for (let bi = 0; bi < bladesPerCluster; bi++) {
      const ox = cx + (extRng() - 0.5) * 1.4;
      const oz = cz + (extRng() - 0.5) * 1.4;
      const gy = evalExteriorGroundY(ox, oz);
      const bh = 0.65 + extRng() * 0.85;
      const bw = 0.055 + extRng() * 0.04;
      const blade = new THREE.PlaneGeometry(bw, bh, 1, 3);
      blade.translate(0, bh * 0.5, 0);
      xformGeo(blade, ox, gy - 0.04, oz, (extRng() - 0.5) * 0.18, extRng() * Math.PI, (extRng() - 0.5) * 0.22);
      reedParts.push(blade);
    }
  }
  const reedMat = trackMat(new THREE.ShaderMaterial({
    uniforms: { uTime: extSkyUniforms.uTime },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec3 p = position;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        float sway = sin(uTime * 2.1 + wp.x * 0.65 + wp.z * 0.45) * 0.16 * uv.y * uv.y;
        wp.x += sway;
        wp.z += sway * 0.45;
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        // Taper blade tip cleanly
        float halfW = 1.0 - smoothstep(0.15, 1.0, vUv.y);
        if (abs(vUv.x - 0.5) * 2.0 > halfW + 0.12) discard;
        vec3 botCol = vec3(0.032, 0.044, 0.048);
        vec3 tipCol = vec3(0.12, 0.16, 0.18);
        vec3 col = mix(botCol, tipCol, vUv.y);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.DoubleSide
  }));
  const reedsMesh = new THREE.Mesh(
    trackGeo(mergeNonIndexedGeos(THREE, reedParts)),
    reedMat
  );
  exteriorGroup.add(reedsMesh);

  // 3) Environmental Storytelling: Washed-Up Broken Hull/Planks, Tarnished Shields & Rusted Spear!
  const wreckWoodParts = [];
  const wreckMetalParts = [];
  // Broken timber boat/wagon hull half-buried at (-6.2, 5.8) matching collider!
  const wgy = evalExteriorGroundY(-6.2, 5.8);
  for (let p = 0; p < 7; p++) {
    const plank = new THREE.BoxGeometry(0.24, 0.08, 1.75 + (p % 3) * 0.42);
    xformGeo(plank, -6.2 + (p - 3) * 0.26, wgy + 0.24 + Math.abs(p - 3) * 0.08, 5.8 + (p % 2) * 0.18, 0.22 + (p % 3) * 0.06, 0.52 + (p - 3) * 0.08, (p - 3) * 0.16);
    wreckWoodParts.push(tintGeo(THREE, plank, 0x4b3d33, 0x221b17));
  }
  // Scattered splintered Castle beams washed onto the shoal
  const beamSpots = [
    [-3.4, -1.6, 1.6, 0.85],
    [ 4.2,  2.1, 1.4, -0.55],
    [ 4.9, 13.8, 1.9, 1.15],
    [-5.8, 19.6, 1.5, -0.92]
  ];
  for (let i = 0; i < beamSpots.length; i++) {
    const [bxp, bzp, blen, bry] = beamSpots[i];
    const gy = evalExteriorGroundY(bxp, bzp);
    wreckWoodParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(0.18, 0.14, blen), bxp, gy + 0.05, bzp, 0.05, bry, 0.06), 0x473a30, 0x201a16));
  }
  // Dented abandoned knight shields & rusted spear half-submerged along the bank (previous "guests"!)
  const shieldSpots = [
    [-4.1, 3.6, 0.45],
    [ 4.6, 8.8, -0.82],
    [-4.8, 21.4, 1.25]
  ];
  for (let i = 0; i < shieldSpots.length; i++) {
    const [shx, shz, shry] = shieldSpots[i];
    const gy = evalExteriorGroundY(shx, shz);
    // Curved kite/heater shield slab + rim boss
    wreckMetalParts.push(xformGeo(new THREE.CylinderGeometry(0.38, 0.34, 0.06, 7), shx, gy + 0.06, shz, 0.28, shry, 0.22));
    wreckMetalParts.push(xformGeo(new THREE.SphereGeometry(0.10, 6, 5), shx, gy + 0.11, shz));
  }
  // Rusted broken spear jammed near the washed-up wreckage
  const spGy = evalExteriorGroundY(-5.4, 6.5);
  wreckWoodParts.push(tintGeo(THREE, xformGeo(new THREE.CylinderGeometry(0.028, 0.032, 1.85, 6), -5.4, spGy + 0.72, 6.5, 0.35, 0.4, -0.45), 0x45372d, 0x1e1814));
  wreckMetalParts.push(xformGeo(new THREE.ConeGeometry(0.055, 0.32, 4), -5.06, spGy + 1.54, 6.76, 0.35, 0.4, -0.45));

  const wreckWoodMesh = new THREE.Mesh(
    trackGeo(mergeNonIndexedGeos(THREE, wreckWoodParts, { boxUvTile: 1.5, withColor: true })),
    deadTreeMat
  );
  exteriorGroup.add(wreckWoodMesh);
  const wreckMetalMesh = new THREE.Mesh(
    trackGeo(mergeNonIndexedGeos(THREE, wreckMetalParts, { boxUvTile: 1.0 })),
    rustedGrateMat
  );
  exteriorGroup.add(wreckMetalMesh);

  // --------------------------------------------------------------------------
  // C9. Drifting Pale Ash Flakes + Moonlit River Mist & Waterfall Spray Clouds (2 DCs!)
  // --------------------------------------------------------------------------
  const SHORE_ASH_COUNT = isMobile ? 90 : 180;
  const ashPos = new Float32Array(SHORE_ASH_COUNT * 3);
  const ashSeed = new Float32Array(SHORE_ASH_COUNT * 3);
  for (let i = 0; i < SHORE_ASH_COUNT; i++) {
    ashPos[i * 3]     = (extRng() - 0.5) * 34.0;
    ashPos[i * 3 + 1] = extRng() * 14.0;
    ashPos[i * 3 + 2] = -12.0 + extRng() * 48.0;
    ashSeed[i * 3]     = extRng();
    ashSeed[i * 3 + 1] = 0.55 + extRng() * 0.9;
    ashSeed[i * 3 + 2] = 0.65 + extRng() * 1.1;
  }
  const shoreAshGeo = trackGeo(new THREE.BufferGeometry());
  shoreAshGeo.setAttribute('position', new THREE.BufferAttribute(ashPos, 3));
  shoreAshGeo.setAttribute('aSeed', new THREE.BufferAttribute(ashSeed, 3));
  const shoreAshMat = trackMat(new THREE.ShaderMaterial({
    uniforms: { uTime: extSkyUniforms.uTime, uTex: { value: mistSpriteTex } },
    vertexShader: `
      attribute vec3 aSeed;
      uniform float uTime;
      varying float vAlpha;
      varying float vWarm;
      void main() {
        float cyc = fract(aSeed.x - uTime * 0.045 * aSeed.y);
        vec3 p = position;
        p.y = 0.4 + cyc * 14.5;
        p.x += sin(uTime * 0.55 + aSeed.x * 18.0) * 1.35 + uTime * 0.25 * (aSeed.y - 0.5);
        p.x = mod(p.x + 17.0, 34.0) - 17.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp((aSeed.z * 58.0) / max(1.2, -mv.z), 2.0, 14.0);
        vAlpha = sin(cyc * 3.14159) * 0.62;
        vWarm = step(0.84, aSeed.x);
      }
    `,
    fragmentShader: `
      uniform sampler2D uTex;
      varying float vAlpha;
      varying float vWarm;
      void main() {
        vec4 t = texture2D(uTex, gl_PointCoord);
        vec3 col = mix(vec3(0.68, 0.76, 0.88), vec3(1.6, 0.65, 0.22), vWarm);
        float a = t.a * vAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  const shoreAshPoints = new THREE.Points(shoreAshGeo, shoreAshMat);
  shoreAshPoints.frustumCulled = false;
  exteriorGroup.add(shoreAshPoints);

  // Waterfall Plunge-Pool Spray + Low Moonlit River Mist Clouds drifting along the black water!
  const SHORE_MIST_COUNT = isMobile ? 24 : 44;
  const smPos = new Float32Array(SHORE_MIST_COUNT * 3);
  const smSeed = new Float32Array(SHORE_MIST_COUNT * 3);
  for (let i = 0; i < SHORE_MIST_COUNT; i++) {
    const isWaterfallSpray = i < Math.floor(SHORE_MIST_COUNT * 0.45);
    if (isWaterfallSpray) {
      smPos[i * 3]     = (extRng() - 0.5) * 6.8;
      smPos[i * 3 + 1] = 0.4 + extRng() * 2.2;
      smPos[i * 3 + 2] = -12.2 + extRng() * 4.2;
      smSeed[i * 3]     = extRng();
      smSeed[i * 3 + 1] = 0.28 + extRng() * 0.35; // faster turbulent spray drift
      smSeed[i * 3 + 2] = 2.6 + extRng() * 2.4;
    } else {
      const mz = -8.0 + extRng() * 44.0;
      smPos[i * 3]     = getRiverCenterX(mz) + (extRng() - 0.5) * 8.5;
      smPos[i * 3 + 1] = 0.55 + extRng() * 1.4;
      smPos[i * 3 + 2] = mz;
      smSeed[i * 3]     = extRng();
      smSeed[i * 3 + 1] = 0.06 + extRng() * 0.08;
      smSeed[i * 3 + 2] = 4.2 + extRng() * 3.8;
    }
  }
  const shoreMistGeo = trackGeo(new THREE.BufferGeometry());
  shoreMistGeo.setAttribute('position', new THREE.BufferAttribute(smPos, 3));
  shoreMistGeo.setAttribute('aSeed', new THREE.BufferAttribute(smSeed, 3));
  const shoreMistMat = trackMat(new THREE.ShaderMaterial({
    uniforms: { uTime: extSkyUniforms.uTime, uTex: { value: mistSpriteTex } },
    vertexShader: `
      attribute vec3 aSeed;
      uniform float uTime;
      varying float vAlpha;
      void main() {
        float cyc = fract(aSeed.x + uTime * aSeed.y);
        vec3 p = position;
        p.y += cyc * 1.65;
        p.x += sin(uTime * 0.45 + aSeed.x * 10.0) * 1.25;
        p.z += cyc * 2.1;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp((aSeed.z * 320.0) / max(1.8, -mv.z), 18.0, 185.0);
        vAlpha = sin(cyc * 3.14159) * 0.26;
      }
    `,
    fragmentShader: `
      uniform sampler2D uTex;
      varying float vAlpha;
      void main() {
        vec4 t = texture2D(uTex, gl_PointCoord);
        float a = t.a * vAlpha;
        if (a < 0.008) discard;
        gl_FragColor = vec4(vec3(0.42, 0.54, 0.72), a);
      }
    `,
    transparent: true,
    depthWrite: false
  }));
  const shoreMistPoints = new THREE.Points(shoreMistGeo, shoreMistMat);
  shoreMistPoints.renderOrder = 3;
  shoreMistPoints.frustumCulled = false;
  exteriorGroup.add(shoreMistPoints);

  // --------------------------------------------------------------------------
  // C10. Dedicated Nocturnal Moonlight Directional Light + Cold Gorge Rim Fill
  // --------------------------------------------------------------------------
  const moonDirLight = new THREE.DirectionalLight(0xa4c4f4, 0.0);
  moonDirLight.position.set(-14.0, 28.0, -44.0);
  moonDirLight.target.position.set(0.0, 0.0, 10.0);
  exteriorGroup.add(moonDirLight, moonDirLight.target);

  const waterfallMistLight = new THREE.PointLight(0x6c92c8, 0.0, 22.0, 1.5);
  waterfallMistLight.position.set(0.0, 4.2, -9.5);
  exteriorGroup.add(waterfallMistLight);

  // ==========================================================================
  // Reusable Zero-GC Scratch Objects for Per-Frame Updates
  // ==========================================================================
  const _dummy = new THREE.Object3D();

  // ==========================================================================
  // Internal State Sync Helpers
  // ==========================================================================
  function syncActiveLights() {
    const isChasm = stageMode === 'chasm_only' && chasmProgress > 0.01;
    const isShaft = stageMode === 'shaft_river';
    const isExt = stageMode === 'exterior_shore';

    chasmGlowLight.visible = isChasm && !lowSpecMode;
    if (!chasmGlowLight.visible) chasmGlowLight.intensity = 0;

    shaftCrimsonLight.visible = isShaft;
    tunnelMoonLight.visible = isShaft;
    tunnelFillLight.visible = isShaft && !lowSpecMode;
    if (!isShaft) {
      shaftCrimsonLight.intensity = 0;
      tunnelMoonLight.intensity = 0;
      tunnelFillLight.intensity = 0;
    }

    moonDirLight.visible = isExt;
    waterfallMistLight.visible = isExt && !lowSpecMode;
    gateBrazierLight.visible = isExt && !lowSpecMode;
    swordBeaconLight.visible = isExt && !swordPickedUp && !lowSpecMode;
    bonfireLight.visible = isExt && bonfireLit;
    if (!isExt) {
      moonDirLight.intensity = 0;
      waterfallMistLight.intensity = 0;
      gateBrazierLight.intensity = 0;
      swordBeaconLight.intensity = 0;
      bonfireLight.intensity = 0;
    }
  }

  function applyChasmVisuals(elapsedSec = 0) {
    const p = chasmProgress;
    const active = p > 0.001;
    chasmContent.visible = active;
    if (!active) {
      chasmGlowLight.intensity = 0;
      return;
    }

    // Punchy crack-burst ease on opening aperture & buckled slabs
    const openScale = 0.12 + 0.88 * smoothstep(0.0, 0.55, p);
    chasmStencilMask.scale.set(openScale, 1.0, openScale);
    chasmDepthClear.scale.set(openScale, 1.0, openScale);
    chasmShaftMesh.scale.set(openScale, 1.0, openScale);
    chasmInnerBeams.scale.set(openScale, 1.0, openScale);
    chasmRimCrackMesh.scale.set(openScale, 1.0, openScale);
    chasmRimCrackUniforms.uProgress.value = smoothstep(0.0, 0.40, p);
    chasmShaftUniforms.uHeat.value = 0.45 + 0.55 * (1.0 - smoothstep(0.6, 1.0, p) * 0.35);

    // Buckled broken rim slabs pop up & tilt outward as the floor collapses
    const slabT = smoothstep(0.04, 0.62, p);
    for (let i = 0; i < rimSlabEntries.length; i++) {
      const s = rimSlabEntries[i];
      s.mesh.position.y = lerp(-0.08, s.targetY, slabT);
      s.mesh.rotation.set(s.targetPitch * slabT, s.yaw, s.targetRoll * slabT);
      s.mesh.scale.setScalar(0.35 + 0.65 * slabT);
    }

    // Torn crimson velvet carpet flaps sag down over the rim into the pit
    const drapeT = smoothstep(0.08, 0.72, p);
    tornCarpetNorth.scale.set(1.0, Math.max(0.05, drapeT), openScale);
    tornCarpetSouth.scale.set(1.0, Math.max(0.05, drapeT), openScale);

    // 18 animated falling stone chunks plunging down the 14m chasm!
    for (let i = 0; i < CHASM_CHUNK_COUNT; i++) {
      const c = chasmChunkData[i];
      // Primary blast fall tied to progress01 + continuous crumbling cascade while hole stays open
      const rawT = Math.max(0.0, (p * 1.95 - c.delay) + (p >= 0.99 ? ((elapsedSec + i * 0.37) % c.loopPeriod) : 0.0));
      const tFall = (p >= 0.99) ? ((elapsedSec * 0.95 + c.delay * 4.5 + i * 0.29) % c.loopPeriod) : rawT;
      const y = c.vy0 * Math.min(tFall, 0.45) - 0.5 * 11.8 * tFall * tFall;
      const inBounds = y > -14.8;
      if (!inBounds || tFall <= 0.001) {
        _dummy.position.set(0, -30, 0);
        _dummy.scale.setScalar(0.001);
      } else {
        const radialTighten = Math.max(0.45, 1.0 - Math.max(0, -y) * 0.025);
        _dummy.position.set(
          (c.x0 + c.vx * tFall) * openScale * radialTighten,
          y,
          (c.z0 + c.vz * tFall) * openScale * radialTighten
        );
        _dummy.rotation.set(c.rx0 + c.vrx * tFall, c.ry0 + c.vry * tFall, c.rz0 + c.vrz * tFall);
        const fadeOut = smoothstep(-14.6, -11.5, y);
        _dummy.scale.set(c.sx * fadeOut, c.sy * fadeOut, c.sz * fadeOut);
      }
      _dummy.updateMatrix();
      chasmChunksInst.setMatrixAt(i, _dummy.matrix);
    }
    chasmChunksInst.instanceMatrix.needsUpdate = true;

    if (chasmGlowLight.visible) {
      const fl = 0.86 + 0.14 * Math.sin(elapsedSec * 7.5);
      chasmGlowLight.intensity = 4.2 * smoothstep(0.0, 0.45, p) * fl;
    }
  }

  function applyGrateVisuals() {
    const a = clamp01(grateBreakAnim);
    tunnelRiverUniforms.uGrateBroken.value = grateBroken ? 1.0 : 0.0;
    for (let i = 0; i < breakableBars.length; i++) {
      const b = breakableBars[i];
      const localT = clamp01((a - b.delay) / Math.max(0.05, 0.45));
      // Punchy overshoot bounce as iron bars snap violently outward (+Z)!
      const bounce = localT > 0
        ? Math.min(1.18, 1.0 - Math.pow(1.0 - localT, 3.0) + Math.sin(localT * Math.PI * 2.5) * 0.12 * (1.0 - localT))
        : 0.0;
      b.topPivot.rotation.set(b.targetTopRx * bounce, 0, b.targetRz * bounce);
      b.botPivot.rotation.set(b.targetBotRx * bounce, 0, -b.targetRz * bounce);
    }
    if (a <= 0.001) {
      brokenMidCross.visible = true;
      brokenMidCross.position.set(0, 2.75, 0.06);
      brokenMidCross.rotation.set(0, 0, 0);
    } else if (a < 0.92) {
      brokenMidCross.visible = true;
      const ft = a * 1.15;
      brokenMidCross.position.set(ft * 1.2, 2.75 + ft * 1.8 - 4.9 * ft * ft, 0.06 + ft * 13.5);
      brokenMidCross.rotation.set(ft * 3.8, ft * 2.1, ft * 4.4);
    } else {
      brokenMidCross.visible = false;
    }

    const burstActive = grateBroken && grateBreakAnim > 0.001 && grateBreakAnim < 1.35;
    grateBurstPoints.visible = burstActive;
    grateBurstUniforms.uAge.value = grateBreakAnim * 1.15;
  }

  // ==========================================================================
  // Public API Implementation (Exact Contract)
  // ==========================================================================
  function setStageMode(mode) {
    const valid =
      mode === 'chasm_only' ||
      mode === 'shaft_river' ||
      mode === 'exterior_shore'
        ? mode
        : 'none';
    stageMode = valid;
    chasmOverlayGroup.visible = valid === 'chasm_only';
    shaftAndRiverGroup.visible = valid === 'shaft_river';
    exteriorGroup.visible = valid === 'exterior_shore';
    syncActiveLights();
    if (valid === 'chasm_only') applyChasmVisuals(0);
    if (valid === 'shaft_river') applyGrateVisuals();
  }

  function setChasmState(progress01, x, z) {
    chasmProgress = clamp01(Number.isFinite(progress01) ? progress01 : 0);
    if (Number.isFinite(x)) {
      chasmX = x;
      chasmOverlayGroup.position.x = x;
    }
    if (Number.isFinite(z)) {
      chasmZ = z;
      chasmOverlayGroup.position.z = z;
    }
    chasmOverlayGroup.position.y = 0;
    syncActiveLights();
    applyChasmVisuals(chasmShaftUniforms.uTime.value);
  }

  function triggerGrateBreak() {
    if (!grateBroken) {
      grateBroken = true;
      grateBreakAnim = 0.002;
    } else if (grateBreakAnim >= 1.35) {
      grateBreakAnim = 0.002;
    }
    applyGrateVisuals();
  }

  function setGrateBroken(broken) {
    const b = Boolean(broken);
    if (b && !grateBroken) {
      grateBroken = true;
      grateBreakAnim = 0.002; // animate explosive burst naturally on transition to true!
    } else if (!b) {
      grateBroken = false;
      grateBreakAnim = 0.0;
    }
    applyGrateVisuals();
  }

  function setSwordPickedUp(picked) {
    swordPickedUp = Boolean(picked);
    swordGroup.visible = !swordPickedUp;
    syncActiveLights();
  }

  function setBonfireLit(lit) {
    bonfireLit = Boolean(lit);
    bonfireFlameMesh.visible = bonfireLit;
    bonfireEmbers.visible = bonfireLit;
    bonfireCoalsUniforms.uLit.value = bonfireLit ? 1.0 : 0.0;
    extRiverUniforms.uBonfireLit.value = bonfireLit ? 1.0 : 0.0;
    syncActiveLights();
  }

  function getAnchors() {
    return {
      wakePos: { ...EXTERIOR_SHORE_ANCHORS.wakePos },
      swordPos: { ...EXTERIOR_SHORE_ANCHORS.swordPos },
      bonfirePos: { ...EXTERIOR_SHORE_ANCHORS.bonfirePos },
      gatePos: { ...EXTERIOR_SHORE_ANCHORS.gatePos },
      waterfallPos: { ...EXTERIOR_SHORE_ANCHORS.waterfallPos }
    };
  }

  function clampPosition(x, z, r = 0.55) {
    return clampExteriorPosition(x, z, r);
  }

  function getGroundY(x, z) {
    return evalExteriorGroundY(x, z);
  }

  function getSurfaceType(x, z) {
    return evalExteriorSurfaceType(x, z);
  }

  function setLowSpecMode(lowSpec) {
    lowSpecMode = Boolean(lowSpec);
    tunnelRiverUniforms.uLowSpec.value = lowSpecMode ? 1.0 : 0.0;
    extSkyUniforms.uLowSpec.value = lowSpecMode ? 1.0 : 0.0;
    extRiverUniforms.uLowSpec.value = lowSpecMode ? 1.0 : 0.0;

    for (let i = 0; i < normalMappedMats.length; i++) {
      const entry = normalMappedMats[i];
      entry.mat.normalMap = lowSpecMode ? null : entry.map;
      entry.mat.needsUpdate = true;
    }

    shoreAshGeo.setDrawRange(0, lowSpecMode ? Math.floor(SHORE_ASH_COUNT * 0.45) : SHORE_ASH_COUNT);
    shoreMistGeo.setDrawRange(0, lowSpecMode ? Math.floor(SHORE_MIST_COUNT * 0.45) : SHORE_MIST_COUNT);
    shaftDustGeo.setDrawRange(0, lowSpecMode ? Math.floor(SHAFT_DUST_COUNT * 0.45) : SHAFT_DUST_COUNT);
    castlePlumePoints.visible = !lowSpecMode;
    syncActiveLights();
  }

  function update(dt = 0.016, elapsed = 0, updateOpts = null) {
    const safeDt = Math.min(Math.max(Number.isFinite(dt) ? dt : 0.016, 0.001), 0.1);
    const t = Number.isFinite(elapsed) ? elapsed : 0.0;

    if (stageMode === 'none') return;

    // A) Chasm overlay animation
    if (stageMode === 'chasm_only') {
      chasmShaftUniforms.uTime.value = t;
      const camY =
        updateOpts?.camY ??
        updateOpts?.camPos?.y ??
        updateOpts?.camera?.position?.y;
      if (Number.isFinite(camY)) {
        syncChasmCameraSide(camY);
      }
      if (chasmProgress > 0.001) {
        applyChasmVisuals(t);
      }
      return;
    }

    // B) Vertical shaft + rushing underground river + outfall grate
    if (stageMode === 'shaft_river') {
      shaftTopGlowUniforms.uTime.value = t;
      tunnelRiverUniforms.uTime.value = t;

      if (grateBroken && grateBreakAnim < 1.35) {
        grateBreakAnim = Math.min(1.35, grateBreakAnim + safeDt * 1.45);
        applyGrateVisuals();
      }

      const redFlick = 0.85 + 0.15 * Math.sin(t * 6.8) + 0.06 * Math.sin(t * 14.3);
      shaftCrimsonLight.intensity = 10.5 * redFlick;
      tunnelMoonLight.intensity = 11.0 + (grateBroken ? 3.5 : 0.0);
      if (tunnelFillLight.visible) {
        tunnelFillLight.intensity = 3.8;
      }
      return;
    }

    // C) Exterior Shore («Берег Пепельного Стока»)
    if (stageMode === 'exterior_shore') {
      extSkyUniforms.uTime.value = t;

      // Subtle breathing golden aura on the planted Oath Sword
      if (!swordPickedUp) {
        const pulse = 0.84 + 0.16 * Math.sin(t * 3.1);
        swordBeaconMesh.scale.set(0.92 + 0.08 * pulse, 0.96 + 0.06 * pulse, 0.92 + 0.08 * pulse);
        if (swordBeaconLight.visible) {
          swordBeaconLight.intensity = 2.4 * pulse;
        }
      }

      // Warm flickering Shore Bonfire light
      if (bonfireLit && bonfireLight.visible) {
        const fl = 0.84 + 0.10 * Math.sin(t * 9.4) + 0.06 * Math.sin(t * 18.7);
        bonfireLight.intensity = 7.4 * fl;
      }

      // Steady nocturnal silver moonlight + subtle gate brazier & waterfall bounce
      moonDirLight.intensity = 1.65;
      if (waterfallMistLight.visible) {
        waterfallMistLight.intensity = 3.2 + 0.35 * Math.sin(t * 3.4);
      }
      if (gateBrazierLight.visible) {
        const gfl = 0.88 + 0.12 * Math.sin(t * 8.2 + 1.3);
        gateBrazierLight.intensity = 5.4 * gfl;
      }
    }
  }

  function dispose() {
    setStageMode('none');
    for (let i = 0; i < ownedGeos.length; i++) ownedGeos[i]?.dispose?.();
    for (let i = 0; i < ownedMats.length; i++) ownedMats[i]?.dispose?.();
    for (let i = 0; i < ownedTex.length; i++) ownedTex[i]?.dispose?.();
    ownedGeos.length = 0;
    ownedMats.length = 0;
    ownedTex.length = 0;
    normalMappedMats.length = 0;
    if (rootGroup.parent) rootGroup.parent.remove(rootGroup);
  }

  // Apply initial clean defaults
  setLowSpecMode(lowSpecMode);
  setSwordPickedUp(false);
  setBonfireLit(false);
  setGrateBroken(false);
  setStageMode('none');

  return {
    rootGroup,
    chasmOverlayGroup,
    shaftAndRiverGroup,
    exteriorGroup,
    setStageMode,
    setChasmState,
    triggerGrateBreak,
    setGrateBroken,
    setSwordPickedUp,
    setBonfireLit,
    getAnchors,
    clampPosition,
    getGroundY,
    getSurfaceType,
    update,
    setLowSpecMode,
    dispose,
    // Helpful read-only telemetry getters for QA
    getStageMode: () => stageMode,
    isSwordPickedUp: () => swordPickedUp,
    isBonfireLit: () => bonfireLit,
    isGrateBroken: () => grateBroken,
    getStats: () => ({
      stageMode,
      isMobile,
      lowSpecMode,
      ownedGeos: ownedGeos.length,
      ownedMats: ownedMats.length,
      ownedTex: ownedTex.length
    })
  };
}
