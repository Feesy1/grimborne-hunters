// Grimborne Hunters — Region I «Речной Предел» 8-Sector Master Topology & Collision System (z104)
// Pure Vanilla ES Module (Three.js-independent, ZERO external dependencies, ZERO per-frame GC allocations).
//
// Coordinate Convention (100% compatible with soulsGorgeTopology.js / soulsExteriorShore.js):
//   +Z = North (forward away from Castle of Ash outfall at z = -14 .. Region II Citadel Gate at z = +318)
//   +X = East  (screen-LEFT when facing North — Moonlit River, Fishing Village 03, Hunter Camp 05, Amphitheater 07)
//   -X = West  (screen-RIGHT — Basalt Cliffs, Upper Chapel 02, Cliff Heights 06, Monastery Shortcut SC-3)
//   +Y = Vertical elevation (0.000m exact at wakePos = (0, 0, 2.5))
//
// Coverage:
//   - Full Valley Analytical Heightfield: x = -48..+96, z = -18..+336
//     (GUARANTEED IEEE-754 BIT-FOR-BIT IDENTICAL to core Zone 0-3 evalBaseTerrainY inside x=[-14..+14], z=[-16..+120]!)
//   - All 8 Interconnected Sectors (01..08), All 13 Seams (P01..P13), All 4 Shortcuts (SC-1..SC-4)
//   - Working Animated Vertical Cage Lift (SC-2: 4.5 Lower Station y=2.65m <-> 6.3 Upper Lift Walkway y=17.65m)
//   - All 44 POIs (1.1..8.5) + Quick Sector Spawns ('01'..'08'), 6 Bonfires + 36+ Braziers/Lanterns, Full Interactables.

export const RIVER_REACH_WATER_LEVEL = -0.10;

// Animated Vertical Cage Lift (SC-2: 4.5 <-> 6.3) Shared Constants
export const RIVER_REACH_LIFT_MIN_Y = 2.65;
export const RIVER_REACH_LIFT_MAX_Y = 17.65;
export const RIVER_REACH_LIFT_CX = -5.60;
export const RIVER_REACH_LIFT_CZ = 118.20;
export const RIVER_REACH_LIFT_HALF = 1.60; // 3.2m x 3.2m iron cage footprint
export const RIVER_REACH_LIFT_CENTER = Object.freeze({
  x: RIVER_REACH_LIFT_CX,
  z: RIVER_REACH_LIFT_CZ,
  minY: RIVER_REACH_LIFT_MIN_Y,
  maxY: RIVER_REACH_LIFT_MAX_Y,
  halfSize: RIVER_REACH_LIFT_HALF
});

// ============================================================================
// Pure Zero-GC Math Utilities
// ============================================================================
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

// ============================================================================
// Core Zone 0-3 Road, River & Base Terrain Math
// (Character-for-character exact match with soulsGorgeTopology.js inside [-14..+14] x [-16..+120])
// ============================================================================
const CORE_BRIDGE_Y = 5.60;
const CORE_TERRACE_NAVE_Y = 4.90;
const CORE_TERRACE_GATE_Y = 4.20;
const CORE_SHORTCUT_STAIR_Y_START = 0.78;

function corePathCenterX(z) {
  const pz = Number.isFinite(z) ? z : 2.5;
  if (pz <= 31.0) {
    const t1 = smoothstep(2.5, 15.0, pz);
    const t2 = smoothstep(15.0, 31.0, pz);
    const mid = lerp(0.0, -1.85, t1);
    return lerp(mid, 0.0, t2) + Math.sin(pz * 0.24) * 0.45 * (1.0 - smoothstep(26.0, 31.0, pz));
  }
  if (pz <= 56.0) {
    const t = smoothstep(31.0, 56.0, pz);
    return lerp(0.0, -0.60, t) - Math.sin(t * Math.PI) * 0.32;
  }
  if (pz <= 73.0) {
    const t = smoothstep(56.0, 73.0, pz);
    return lerp(-0.60, -1.95, t);
  }
  if (pz <= 99.0) {
    const t = smoothstep(73.0, 99.0, pz);
    return lerp(-1.95, 1.15, t);
  }
  const tEnd = smoothstep(99.0, 114.0, pz);
  return lerp(1.15, 0.80, tEnd);
}

function coreRiverHalfWidth(z) {
  const pz = Number.isFinite(z) ? z : 2.5;
  const poolBoost = 1.0 - smoothstep(-14.0, -5.5, pz);
  const gorgeWiden = smoothstep(32.0, 68.0, pz) * 1.45 + smoothstep(95.0, 145.0, pz) * 1.25;
  return 4.65 + poolBoost * 1.35 + gorgeWiden + Math.sin(pz * 0.16 + 0.6) * 0.32;
}

function coreRiverCenterX(z) {
  const pz = Number.isFinite(z) ? z : 2.5;
  const t = clamp01((pz + 14.0) / 20.0);
  const s = t * t * (3.0 - 2.0 * t);
  const meander = Math.sin((pz - 4.0) * 0.115) * 1.45 * s;
  const drift = Math.max(0.0, Math.min(pz, 31.0) - 6.0) * 0.11;
  const baseShoreRcx = s * 10.6 + drift + meander;
  if (pz <= 30.0) return baseShoreRcx;

  const blendGorge = smoothstep(30.0, 41.0, pz);
  const pX = corePathCenterX(pz);
  const rhw = coreRiverHalfWidth(pz);
  const shoalCoveOut = smoothstep(32.5, 40.5, pz) * (1.0 - smoothstep(56.5, 64.5, pz)) * 2.90;
  const bastionOut = smoothstep(93.0, 107.0, pz) * 4.4 + smoothstep(118.0, 154.0, pz) * 5.2;
  const gorgeMeander = Math.sin((pz - 34.0) * 0.085) * 0.65;
  const gorgeRcx = pX + 3.85 + rhw + shoalCoveOut + bastionOut + gorgeMeander;
  return lerp(baseShoreRcx, gorgeRcx, blendGorge);
}

function coreRiverSignedDist(x, z) {
  const px = Number.isFinite(x) ? x : 0.0;
  const pz = Number.isFinite(z) ? z : 2.5;
  const rcx = coreRiverCenterX(pz);
  const rhw = coreRiverHalfWidth(pz);
  const dRiver = Math.abs(px - rcx) - rhw;
  const dPool = Math.hypot((px - 0.35) * 0.92, pz + 10.5) - 5.5;
  return dRiver < dPool ? dRiver : dPool;
}

function coreEvalUpperTerraceY(z) {
  if (z >= 73.0) return CORE_BRIDGE_Y;
  if (z >= 69.0) {
    const t = clamp01((z - 69.0) / 4.0);
    return lerp(CORE_TERRACE_NAVE_Y, CORE_BRIDGE_Y, t);
  }
  if (z >= 59.0) return CORE_TERRACE_NAVE_Y;
  if (z >= 55.5) {
    const t = clamp01((z - 55.5) / 3.5);
    return lerp(CORE_TERRACE_GATE_Y, CORE_TERRACE_NAVE_Y, t);
  }
  return CORE_TERRACE_GATE_Y;
}

function coreEvalShoalMask(x, z) {
  if (z <= 36.0 || z >= 60.5 || x <= 2.0 || x >= 7.2) return 0.0;
  const zMask = smoothstep(36.2, 40.8, z) * (1.0 - smoothstep(56.2, 60.2, z));
  const xMask = smoothstep(2.1, 3.8, x) * (1.0 - smoothstep(5.9, 7.0, x));
  return zMask * xMask;
}

export function evalCoreGorgeBaseTerrainY(x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return 0.0;

  const northRise =
    smoothstep(3.2, 32.0, z) * 0.56 +
    smoothstep(32.0, 57.0, z) * 0.28 +
    smoothstep(57.0, 93.0, z) * 0.62 +
    smoothstep(94.5, 102.2, z) * 1.19;

  const dWake = Math.hypot(x - 0.0, z - 2.5);
  const wakeFlatMask = smoothstep(0.9, 3.6, dWake);
  const dBonfire = Math.hypot(x + 2.2, z - 15.0);
  const bonfireFlatMask = smoothstep(1.2, 3.4, dBonfire);
  const dGate = Math.hypot(x - 0.0, z - 31.0);
  const gateFlatMask = smoothstep(1.8, 4.4, dGate);
  const dCamp1 = Math.hypot(x + 2.95, z - 45.2);
  const camp1FlatMask = smoothstep(1.2, 3.8, dCamp1);
  const dCamp2 = Math.hypot(x + 3.55, z - 71.2);
  const camp2FlatMask = smoothstep(1.2, 3.8, dCamp2);
  const courtFlatMask =
    1.0 -
    smoothstep(100.8, 102.4, z) *
      (1.0 - smoothstep(118.5, 122.0, z)) *
      (1.0 - smoothstep(6.2, 9.2, Math.abs(x + 0.6)));
  const padMask =
    wakeFlatMask *
    bonfireFlatMask *
    gateFlatMask *
    camp1FlatMask *
    camp2FlatMask *
    courtFlatMask;

  const microWave =
    (Math.sin(x * 0.42 + z * 0.29) * 0.045 +
      Math.cos(x * 0.77 - z * 0.54) * 0.025 +
      Math.sin((x + z) * 0.19) * 0.03) *
    padMask;

  let h = northRise + microWave;

  const shoalMask = coreEvalShoalMask(x, z);
  if (shoalMask > 1e-4) {
    const shoalY =
      0.19 +
      Math.sin(z * 0.31 + x * 0.45) * 0.042 +
      Math.cos(z * 0.17 - x * 0.23) * 0.024;
    h = lerp(h, shoalY, shoalMask);
  }

  const rDist = coreRiverSignedDist(x, z);
  if (rDist < 2.8) {
    const shoreUpper = lerp(2.6, 0.75, shoalMask);
    const shoreLower = lerp(-2.4, -1.75, shoalMask);
    const shoreT = smoothstep(shoreLower, shoreUpper, rDist);
    const bedY = lerp(-0.82, h, shoreT);
    h = lerp(h, bedY, 1.0 - (1.0 - wakeFlatMask) * 0.65);
  }

  const pathX = corePathCenterX(z);
  const apronRecess =
    smoothstep(41.2, 43.0, z) * (1.0 - smoothstep(44.8, 46.6, z)) * 3.6;
  const grottoDoorRecess =
    smoothstep(85.8, 87.3, z) * (1.0 - smoothstep(90.1, 91.6, z)) * 2.2;
  const cryptExpand =
    smoothstep(105.0, 108.5, z) * (1.0 - smoothstep(115.2, 118.5, z)) * 3.8;
  const gorgeWallEdge = lerp(
    -10.2,
    pathX - 6.0 - apronRecess - grottoDoorRecess - cryptExpand,
    smoothstep(28.0, 38.0, z)
  );
  const westSlope = smoothstep(gorgeWallEdge, gorgeWallEdge - 9.2, x);
  let cliffAdd = westSlope * westSlope * (5.2 + smoothstep(32.0, 88.0, z) * 2.6);

  if (z > 50.0 && z < 82.5 && x < -7.0 && x > -13.5) {
    const terraceCarve =
      smoothstep(50.2, 52.5, z) *
      (1.0 - smoothstep(79.5, 82.0, z)) *
      smoothstep(-7.0, -8.2, x) *
      (1.0 - smoothstep(-11.8, -13.4, x));
    const maxUnderY = coreEvalUpperTerraceY(z) - 0.35;
    if (h + cliffAdd > maxUnderY) {
      cliffAdd = lerp(cliffAdd, Math.max(0.0, maxUnderY - h), terraceCarve);
    }
  }
  h += cliffAdd;

  const archOpenMask = smoothstep(3.4, 6.2, Math.abs(x));
  const backSlope = smoothstep(-10.5, -16.2, z);
  h += backSlope * backSlope * (1.4 + 6.8 * archOpenMask);

  const rcx = coreRiverCenterX(z);
  const rhw = coreRiverHalfWidth(z);
  const eastBankT = smoothstep(rcx + rhw + 0.6, rcx + rhw + 9.5, x);
  h += eastBankT * eastBankT * 6.8;

  // Note: chasmDrop in original Zone 3 starts at z > 123.0, which is identically 0.0 inside z <= 120.0.
  const chasmDrop = smoothstep(123.0, 134.0, z);
  h -= chasmDrop * 2.4;

  if (z > 41.8 && z < 45.6 && x < -4.2 && x > -9.8) {
    const apronT =
      smoothstep(41.8, 43.2, z) *
      (1.0 - smoothstep(44.6, 45.6, z)) *
      smoothstep(-4.2, -6.2, x) *
      (1.0 - smoothstep(-8.6, -9.8, x));
    h = lerp(h, CORE_SHORTCUT_STAIR_Y_START, apronT);
  }

  if (dWake < 0.9) {
    h = lerp(0.0, h, smoothstep(0.25, 0.9, dWake));
  }
  return h;
}

// ============================================================================
// Continuous Extended Region I Valley Base Terrain Heightfield
// Covers x = -48..+96, z = -18..+336
// GUARANTEED BIT-FOR-BIT IDENTICAL to evalCoreGorgeBaseTerrainY inside x=[-14..+14], z=[-16..+120]!
// ============================================================================
function evalExtendedValleyTerrainY(x, z) {
  // Subtle organic valley undulation
  const undul =
    Math.sin(x * 0.095 + z * 0.072) * 0.22 +
    Math.cos(x * 0.19 - z * 0.14) * 0.11 +
    Math.sin((x - z) * 0.045) * 0.16;

  // Base south-to-north alpine valley climb across Sectors 01 -> 08
  let h =
    smoothstep(18.0, 64.0, z) * 1.4 +
    smoothstep(64.0, 102.0, z) * 8.6 +
    smoothstep(102.0, 152.0, z) * 4.5 +
    smoothstep(152.0, 198.0, z) * 8.8 +
    smoothstep(198.0, 242.0, z) * 2.5 +
    smoothstep(242.0, 278.0, z) * 3.2 +
    smoothstep(278.0, 318.0, z) * 2.5 +
    undul;

  // 1. Sector 03 Moonlit Fishing Cove & Stilt Village Basin (x = 14..68, z = 14..64)
  //    Keeps the riverbed & flooded stilt-village lagoon shallow (-0.55..+0.25m) so boardwalks at y=1.35m sit on pilings over dark water!
  const coveX = smoothstep(12.0, 22.0, x) * (1.0 - smoothstep(60.0, 72.0, x));
  const coveZ = smoothstep(8.0, 22.0, z) * (1.0 - smoothstep(56.0, 68.0, z));
  const coveMask = coveX * coveZ;
  if (coveMask > 1e-4) {
    const fordRaise =
      smoothstep(12.0, 16.0, x) * (1.0 - smoothstep(26.0, 31.0, x)) *
      smoothstep(20.0, 24.0, z) * (1.0 - smoothstep(35.0, 39.0, z)) * 0.48;
    const lagoonY = -0.45 + fordRaise + Math.sin(x * 0.24 + z * 0.19) * 0.08;
    h = lerp(h, lagoonY, coveMask);
  }

  // 2. Sector 03 Watch-Cliff Slope (x = 44..62, z = 58..104, rising 1.4 -> 8.2 -> 10.5m)
  const watchX = smoothstep(42.0, 47.0, x) * (1.0 - smoothstep(58.0, 66.0, x));
  const watchZ = smoothstep(58.0, 63.0, z) * (1.0 - smoothstep(100.0, 108.0, z));
  const watchMask = watchX * watchZ;
  if (watchMask > 1e-4) {
    const watchY =
      z <= 85.0
        ? lerp(1.35, 8.15, clamp01((z - 60.0) / 24.0))
        : lerp(8.15, 10.50, clamp01((z - 86.0) / 16.0));
    h = lerp(h, watchY - 0.12, watchMask);
  }

  // 3. Sector 03/04 Gorge Waterfall Cliff & River Gorge Chasm (x = 12..30, z = 62..118)
  const gorgeRiverX = smoothstep(10.0, 15.0, x) * (1.0 - smoothstep(22.0, 30.0, x));
  const gorgeRiverZ = smoothstep(60.0, 68.0, z) * (1.0 - smoothstep(106.0, 118.0, z));
  const gorgeRiverMask = gorgeRiverX * gorgeRiverZ;
  if (gorgeRiverMask > 1e-4) {
    h = lerp(h, -0.55 + Math.sin(z * 0.2) * 0.08, gorgeRiverMask);
  }

  // 4. Sector 05 Hunter Camp Forest Plateau (x = 24..72, z = 102..182)
  const campX = smoothstep(23.0, 30.0, x) * (1.0 - smoothstep(66.0, 76.0, x));
  const campZ = smoothstep(100.0, 114.0, z) * (1.0 - smoothstep(178.0, 188.0, z));
  const campMask = campX * campZ;
  if (campMask > 1e-4) {
    let campY = 13.50;
    if (z < 118.0) {
      campY = lerp(10.40, 13.50, clamp01((z - 102.0) / 16.0));
    } else if (z > 150.0) {
      campY = lerp(13.50, 20.50, clamp01((z - 150.0) / 32.0));
    }
    // Overlook Cliff 5.4 slight bench drop
    const overlookT =
      (1.0 - smoothstep(32.0, 37.0, x)) *
      smoothstep(122.0, 125.0, z) *
      (1.0 - smoothstep(131.0, 135.0, z));
    campY = lerp(campY, 12.75, overlookT);
    // Forest Ruins 5.5 knoll rise
    const ruinsT =
      smoothstep(57.0, 61.0, x) *
      smoothstep(146.0, 150.0, z) *
      (1.0 - smoothstep(157.0, 162.0, z));
    campY = lerp(campY, 15.15, ruinsT);
    // Wolf Ravine cleft beneath 5.3 plank bridge (x = 30..38, z = 103..117)
    const ravineT =
      smoothstep(29.0, 32.0, x) * (1.0 - smoothstep(36.0, 39.5, x)) *
      smoothstep(102.0, 106.0, z) * (1.0 - smoothstep(115.0, 118.5, z));
    campY -= ravineT * 3.8;
    // SC-4 gully drop below kick-down log bridge (x = 39.5..46.5, z = 88..116)
    const gullyT =
      smoothstep(39.0, 41.0, x) * (1.0 - smoothstep(45.0, 47.5, x)) *
      smoothstep(88.0, 93.0, z) * (1.0 - smoothstep(113.0, 117.5, z));
    campY -= gullyT * 3.2;

    h = lerp(h, campY + undul * 0.25, campMask);
  }

  // 5. Sector 06 Basalt Pass & Cliff Heights (x = -36..+10, z = 120..186)
  const s06X = smoothstep(-38.0, -30.0, x) * (1.0 - smoothstep(6.0, 16.0, x));
  const s06Z = smoothstep(118.0, 123.0, z) * (1.0 - smoothstep(182.0, 190.0, z));
  const s06Mask = s06X * s06Z;
  if (s06Mask > 1e-4) {
    let s06Y;
    if (z <= 136.0) {
      s06Y = lerp(2.65, 8.00, clamp01((z - 120.0) / 14.5));
    } else if (z <= 150.0) {
      const tX = clamp01((-4.0 - x) / 12.0);
      const tZ = clamp01((z - 136.0) / 14.0);
      s06Y = lerp(8.00, 13.00, 0.55 * tX + 0.45 * tZ) - 0.25;
    } else if (z <= 166.0) {
      s06Y =
        z <= 162.0
          ? lerp(13.00, 16.00, clamp01((z - 150.0) / 12.0))
          : lerp(16.00, 17.65, clamp01((z - 162.0) / 4.0));
    } else if (z <= 177.0) {
      s06Y = 17.65;
    } else {
      s06Y = lerp(17.65, 21.50, clamp01((z - 177.0) / 10.0));
    }
    // Keep Eagle Cave recess flat around 14.45m
    const caveT =
      (1.0 - smoothstep(-27.0, -23.0, x)) *
      smoothstep(147.0, 150.0, z) *
      (1.0 - smoothstep(155.0, 158.0, z));
    s06Y = lerp(s06Y, 14.45, caveT);
    h = lerp(h, s06Y + undul * 0.20, s06Mask);
  }

  // 6. Sector 07 Ancient Ruins Plateau (x = -10..+50, z = 184..244)
  const s07X = smoothstep(-12.0, -6.0, x) * (1.0 - smoothstep(46.0, 56.0, x));
  const s07Z = smoothstep(182.0, 188.0, z) * (1.0 - smoothstep(240.0, 246.0, z));
  const s07Mask = s07X * s07Z;
  if (s07Mask > 1e-4) {
    let s07Y = 23.50;
    if (z < 199.0) {
      s07Y = lerp(21.50, 23.00, clamp01((z - 187.0) / 11.0));
    } else if (z < 202.0) {
      s07Y = lerp(23.00, 23.50, clamp01((z - 198.0) / 4.0));
    } else if (z > 224.0) {
      s07Y =
        z <= 235.0
          ? lerp(23.50, 25.50, clamp01((z - 224.0) / 11.0))
          : lerp(25.50, 25.80, clamp01((z - 238.0) / 4.5));
    }
    // Sunken Stone Amphitheater 7.2 bowl centered at (36, 214)
    const dAmp = Math.hypot(x - 36.0, z - 214.0);
    const ampBowlT = 1.0 - smoothstep(10.0, 14.5, dAmp);
    s07Y = lerp(s07Y, 21.48, ampBowlT);
    // Underground Crypt 7.4 recessed stairwell pocket
    const cryptT =
      (1.0 - smoothstep(-3.0, 4.5, x)) *
      smoothstep(200.5, 202.5, z) *
      (1.0 - smoothstep(211.0, 213.5, z));
    s07Y = lerp(s07Y, 19.78, cryptT);
    // SE P10 approach trail blend (x = 32..48, z = 182..204)
    const p10T =
      smoothstep(30.0, 35.0, x) * (1.0 - smoothstep(46.0, 51.0, x)) *
      (1.0 - smoothstep(201.0, 206.0, z));
    if (p10T > 1e-4) {
      const p10Y = lerp(20.50, 21.50, clamp01((z - 182.0) / 21.0));
      s07Y = lerp(s07Y, p10Y, p10T);
    }
    h = lerp(h, s07Y, s07Mask);
  }

  // 7. Deep Misty Viaduct Gorge Chasm beneath 8.1 Grand Broken Viaduct (z = 243..273, x > -8)
  const chasmX = smoothstep(-9.0, -3.0, x) * (1.0 - smoothstep(32.0, 46.0, x));
  const chasmZ = smoothstep(242.5, 249.0, z) * (1.0 - smoothstep(267.0, 274.5, z));
  const chasmMask = chasmX * chasmZ;
  if (chasmMask > 1e-4) {
    h = lerp(h, 9.50 + Math.sin(x * 0.14 + z * 0.11) * 0.65, chasmMask);
  }

  // 8. Sector 08 Abandoned Monastery Citadel Plateau (x = -8..+32, z = 273..322)
  const s08X = smoothstep(-10.0, -4.0, x) * (1.0 - smoothstep(28.0, 36.0, x));
  const s08Z = smoothstep(273.0, 276.0, z) * (1.0 - smoothstep(318.0, 326.0, z));
  const s08Mask = s08X * s08Z;
  if (s08Mask > 1e-4) {
    let s08Y = 29.00;
    if (z > 308.0) {
      s08Y = lerp(29.00, 31.50, clamp01((z - 308.0) / 8.0));
    }
    h = lerp(h, s08Y, s08Mask);
  }

  // 9. Shortcut SC-3 Carved Flank Stair Shelf (x = -18..-9.5, z = 176..280)
  const sc3X = smoothstep(-18.5, -15.5, x) * (1.0 - smoothstep(-10.5, -8.5, x));
  const sc3Z = smoothstep(175.0, 178.0, z) * (1.0 - smoothstep(279.0, 283.0, z));
  const sc3Mask = sc3X * sc3Z;
  if (sc3Mask > 1e-4) {
    const sc3Y =
      z <= 266.0
        ? lerp(17.65, 27.50, clamp01((z - 177.0) / 89.0))
        : lerp(27.50, 28.50, clamp01((z - 266.0) / 9.0));
    h = lerp(h, sc3Y - 0.08, sc3Mask);
  }

  // 10. Dramatic Perimeter Alpine Mountain Rim framing the 8-Sector Valley
  //     - Far East Waterfall Cliff (x > 66, supporting 3.1 Northern Waterfall at (72, 14->-0.1, 20)!)
  const eastMountainT = smoothstep(64.0, 86.0, x);
  h += eastMountainT * eastMountainT * 18.5;
  //     - Far West Alpine Basalt Ridge (x < -33)
  const westMountainT = smoothstep(-32.0, -48.0, x);
  h += westMountainT * westMountainT * 19.0;
  //     - Far North Citadel Mountain Backdrop past Region II Gate (z > 318)
  const northMountainT = smoothstep(318.0, 336.0, z);
  h += northMountainT * northMountainT * 14.0;
  //     - Far South Castle of Ash Backdrop (z < -12)
  const southMountainT = smoothstep(-12.0, -18.0, z);
  h += southMountainT * southMountainT * 9.0;

  return h;
}

export function evalRiverReachBaseTerrainY(x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return 0.0;

  // Compute exterior blend mask: IDENTICALLY 0.0 inside [-14..+14] x [-16..+120]
  const extX = x > 14.0
    ? smoothstep(14.0, 22.0, x)
    : x < -14.0
      ? smoothstep(-14.0, -22.0, x)
      : 0.0;
  const extZ = z > 120.0
    ? smoothstep(120.0, 128.0, z)
    : z < -16.0
      ? smoothstep(-16.0, -20.0, z)
      : 0.0;
  const extMask = extX > extZ ? extX : extZ;

  if (extMask === 0.0) {
    // GUARANTEED IEEE-754 BIT-FOR-BIT IDENTICAL to core evalBaseTerrainY!
    return evalCoreGorgeBaseTerrainY(x, z);
  }
  if (extMask >= 1.0) {
    return evalExtendedValleyTerrainY(x, z);
  }
  // Smooth C1 transition across the 8m border outside [-14..+14] x [-16..+120]
  // Note: suppress core chasmDrop in the z=120..128 blend band so Basalt Pass rises smoothly!
  let coreY = evalCoreGorgeBaseTerrainY(x, z);
  if (z > 123.0) {
    coreY += smoothstep(123.0, 134.0, z) * 2.4;
  }
  return lerp(coreY, evalExtendedValleyTerrainY(x, z), extMask);
}

// ============================================================================
// Lift Position Helper (Zero-GC)
// ============================================================================
export function getRiverReachLiftY(state) {
  if (state && Number.isFinite(state.liftY)) {
    return clamp(state.liftY, RIVER_REACH_LIFT_MIN_Y, RIVER_REACH_LIFT_MAX_Y);
  }
  if (state && state.liftUnlocked) {
    return RIVER_REACH_LIFT_MIN_Y;
  }
  // Before unlock, cage waits at top station 6.3 (classic Dark Souls counterweight lift!)
  return RIVER_REACH_LIFT_MAX_Y;
}

function isInsideLiftCageFootprint(x, z, pad = 0.0) {
  return (
    x >= RIVER_REACH_LIFT_CX - RIVER_REACH_LIFT_HALF - pad &&
    x <= RIVER_REACH_LIFT_CX + RIVER_REACH_LIFT_HALF + pad &&
    z >= RIVER_REACH_LIFT_CZ - RIVER_REACH_LIFT_HALF - pad &&
    z <= RIVER_REACH_LIFT_CZ + RIVER_REACH_LIFT_HALF + pad
  );
}

// ============================================================================
// Analytical Extended Elevation Functions (Zero-GC, Smooth & Monotonic Across All 13 Seams)
// ============================================================================
function evalRiverFordY(x, z) {
  // Wooden Pier 1.4 approach ramp from Sector 01 beach (x = 5.0 -> 7.5, y = shore -> 0.65m)
  if (x < 7.5 && z <= 23.0) {
    const shoreY = evalCoreGorgeBaseTerrainY(5.0, z);
    const t = clamp01((x - 5.0) / 2.5);
    return lerp(shoreY, 0.65, t);
  }
  // Wooden Pier 1.4 flat deck (x = 7.5..11.5, z = 19.3..25.0) & smooth steps down onto Ford 1.6
  if (x <= 14.0 && z <= 27.5) {
    const stepT = Math.max(clamp01((x - 11.5) / 2.5), clamp01((z - 25.0) / 2.5));
    return lerp(0.65, 0.25, stepT);
  }
  // Stone Ford 1.6 (y = 0.25m) rising smoothly into Sector 03 Boardwalk Hub (0.25 -> 0.85 -> 1.35m)
  if (z <= 33.0) return 0.25;
  if (z <= 38.0) return lerp(0.25, 0.85, (z - 33.0) / 5.0);
  if (z <= 41.0) return lerp(0.85, 1.35, (z - 38.0) / 3.0);
  return 1.35;
}

function evalFishermanBridgeY(x, z) {
  // Smooth timber ramp off Sector 02 Main Road east curb (x = 1.8 -> 6.0, y = road -> 1.35m)
  if (x < 6.0) {
    const roadY = evalCoreGorgeBaseTerrainY(1.8, z);
    const t = clamp01((x - 1.8) / 4.2);
    return lerp(roadY, 1.35, t);
  }
  return 1.35;
}

function evalAqueductEastY(x, z) {
  // P07 East Aqueduct Bridge Extension (x = 5.5 -> 31.0, y = 5.60 -> 10.50m) + North Turn (x = 31..37, z = 80.3..102, y = 10.50m)
  if (x <= 5.5) return 5.60;
  if (x < 31.0 && z <= 84.5) {
    return lerp(5.60, 10.50, clamp01((x - 5.5) / 25.5));
  }
  return 10.50;
}

function evalSector03Y(x, z) {
  // P03 Old Fisherman's Bridge west of hub
  if (x < 26.0 && z >= 45.0 && z <= 53.0) {
    return evalFishermanBridgeY(x, z);
  }
  // Wrecked Barge Spur 3.6 (x = 55..68, z = 30..40.5, y = 0.85 -> 1.35m)
  if (x >= 55.0 && z <= 40.5) {
    if (z <= 36.5) return 0.85;
    return lerp(0.85, 1.35, (z - 36.5) / 4.0);
  }
  // Watch-Cliff Staircase 3.5 & Forest Outpost Trail P06 (x >= 46.5, z >= 60.0)
  if (z >= 60.0 && x >= 46.0) {
    if (z <= 84.0) return lerp(1.65, 8.20, (z - 60.0) / 24.0);
    if (z <= 87.5) return 8.20;
    if (z <= 102.0) return lerp(8.20, 10.50, (z - 87.5) / 14.5);
    return lerp(10.50, 13.50, clamp01((z - 102.0) / 16.5));
  }
  // Shortcut SC-4 South Connector & Kick-Down Log Bridge (x = 39.5..46.5, z >= 84.0)
  if (z >= 84.0 && x >= 39.5 && x < 46.5) {
    if (z <= 87.0) return 8.20;
    return lerp(8.20, 13.50, clamp01((z - 87.0) / 31.0));
  }
  // Ford-to-Hub arrival ramp in SW corner of Boardwalk Hub (x <= 34, z <= 41)
  let baseHubY = 1.35;
  if (z < 41.0 && x < 34.0) {
    const fordRampY = evalRiverFordY(x, z);
    const blendHub = smoothstep(31.0, 34.0, x);
    baseHubY = lerp(fordRampY, 1.35, blendHub);
  }
  // Pier Bonfire Bastion Pad 3.2 (46, 54, y=1.65) smoothly elevated above Hub (1.35 -> 1.65)
  const bastionT = smoothstep(39.0, 42.5, x) * smoothstep(49.0, 52.5, z);
  return lerp(baseHubY, 1.65, bastionT);
}

function evalSector05Y(x, z) {
  // P07 East Aqueduct North Turn (z <= 102, x <= 38)
  if (z <= 102.0 && x <= 38.0) {
    return evalAqueductEastY(x, z);
  }
  // SC-4 Kick-Down Log Bridge (x = 39.5..46.5, z = 84..118.5)
  if (z <= 118.5 && x >= 39.5 && x <= 46.5) {
    if (z <= 87.0) return 8.20;
    return lerp(8.20, 13.50, clamp01((z - 87.0) / 31.0));
  }
  // P06 Upper Forest Outpost Trail into Camp SE (x >= 46.5, z <= 118.5)
  if (z <= 118.5 && x > 46.5) {
    if (z <= 87.5) return 8.20;
    if (z <= 102.0) return lerp(8.20, 10.50, (z - 87.5) / 14.5);
    return lerp(10.50, 13.50, clamp01((z - 102.0) / 16.5));
  }
  // 5.3 Wolf Ravine Plank Bridge + SW Camp Entry Ramp (x <= 38.5, z = 102..122.5)
  if (x <= 38.5 && z >= 102.0 && z <= 122.5) {
    if (z <= 118.0) {
      return lerp(10.50, 12.20, clamp01((z - 102.0) / 16.0));
    }
    const campEntryT = clamp01(Math.max((z - 118.0) / 4.0, (x - 35.5) / 3.0));
    return lerp(12.20, 13.50, campEntryT);
  }
  // 5.4 Overlook Cliff Spur (x = 26..38, z = 123.5..132.5, y = 12.8 -> 13.5m)
  if (x < 37.0 && z >= 123.0 && z <= 133.0) {
    return lerp(12.80, 13.50, clamp01((x - 33.0) / 4.0));
  }
  // 5.5 Forest Ruins Chest Spur (x = 58..68, z = 146..158, y = 13.5 -> 15.2m)
  if (x >= 57.5 && z >= 146.0 && z <= 158.5) {
    return lerp(13.50, 15.20, clamp01((z - 147.0) / 5.0));
  }
  // P10 Forest Ruins Ascent to Sector 07 Sunken Amphitheater (z >= 150)
  if (z > 150.0) {
    if (z <= 182.0) return lerp(13.50, 20.50, (z - 150.0) / 32.0);
    return lerp(20.50, 21.50, clamp01((z - 182.0) / 21.0));
  }
  // 5.1 Hunter Camp Clearing (x = 36..64, z = 118..150)
  return 13.50;
}

function evalSector06Y(x, z) {
  // P08 Basalt Pass Ramp (x = -4..+4, z = 119.5..136.5, y = 2.65 -> 8.00m)
  if (z <= 136.0 && x >= -4.0) {
    if (z <= 120.0) return evalCoreGorgeBaseTerrainY(x, z);
    return lerp(2.65, 8.00, clamp01((z - 120.0) / 14.5));
  }
  // 6.1 Cliff Scaffolding Catwalk (x = -22..-4, z = 134..150, y = 8.00 -> 13.00m)
  if (z <= 150.0 && x >= -23.0) {
    const tX = clamp01((-4.0 - x) / 12.0);
    const tZ = clamp01((z - 136.0) / 14.0);
    return lerp(8.00, 13.00, 0.55 * tX + 0.45 * tZ);
  }
  // 6.5 Secret Eagle Cave Pocket (x = -33..-24.5, z = 148..156, y = 14.50m blended seamlessly to 6.2)
  if (x < -24.5 && z >= 147.5 && z <= 156.5) {
    const bastionY = lerp(13.00, 16.00, clamp01((z - 150.0) / 12.0));
    const blendOut = clamp01((x + 27.5) / 3.0);
    return lerp(14.50, bastionY, blendOut);
  }
  // 6.2 Windy Bastion Overlook (x = -26..-16, z = 150..162, y = 13.0 -> 16.0) + Ascent Stair (z = 162..166, y = 16.0 -> 17.65)
  if (z <= 162.0) {
    return lerp(13.00, 16.00, clamp01((z - 150.0) / 12.0));
  }
  if (z < 166.0) {
    // Keep eastern 6.3 Lift Walkway arrival (x >= -10) flat at 17.65m
    if (x >= -10.5) return 17.65;
    return lerp(16.00, 17.65, clamp01((z - 162.0) / 4.0));
  }
  // 6.4 Upper Cliff Bonfire Terrace (x = -18..-6, z = 166..177, y = 17.65m)
  if (z <= 177.0) {
    return 17.65;
  }
  // SC-3 Monastery Shortcut Flank Stair south start (x <= -10, z > 177)
  if (x <= -10.0) {
    return evalMonasteryShortcutY(x, z);
  }
  // P11 Carved Stair NW to Sector 07 (x = -10..+2, z = 177..187, y = 17.65 -> 21.50m)
  return lerp(17.65, 21.50, clamp01((z - 177.0) / 10.0));
}

function evalMonasteryShortcutY(x, z) {
  // SC-3 Monastery Bell-Tower Flank Stair (x = -16..-10, z = 177..278) + Connector to Cathedral Courtyard (x = -10..-3.5, z = 274.5..280)
  if (z <= 177.0) return 17.65;
  if (z <= 266.0) return lerp(17.65, 27.50, (z - 177.0) / 89.0);
  if (z <= 275.0) return lerp(27.50, 28.50, (z - 266.0) / 9.0);
  if (x > -10.0) {
    return lerp(28.50, 29.00, clamp01((x + 10.0) / 6.5));
  }
  return 28.50;
}

function evalSector07Y(x, z) {
  // P10 SE Ruins Approach into Sunken Amphitheater (x >= 32, z <= 203.5)
  if (x >= 32.0 && z <= 203.5) {
    return lerp(20.50, 21.50, clamp01((z - 182.0) / 21.0));
  }
  // 7.3 Southern Cloister Colonnades (z = 186..202)
  if (z <= 198.0) {
    if (z <= 187.0) return 21.50;
    return lerp(21.50, 23.00, (z - 187.0) / 11.0);
  }
  if (z <= 202.0 && x >= 3.5 && x <= 25.0) {
    return lerp(23.00, 23.50, clamp01((z - 198.0) / 4.0));
  }
  // 7.4 Underground Relic Crypt (x = -8..+4.5, z = 201..212, y = 23.5 -> 19.8m)
  if (x < 4.5 && z >= 200.5 && z <= 212.5) {
    const plazaEdgeY = lerp(23.00, 23.50, clamp01((z - 198.0) / 4.0));
    const tCrypt = clamp01((4.5 - x) / 9.0);
    return lerp(plazaEdgeY, 19.80, tCrypt);
  }
  // 7.2 Sunken Stone Amphitheater (cx=36, cz=214, r=11, y=21.5) & West Connector Ramp (x=25..29.5)
  if (x > 25.0 && z >= 202.0 && z <= 226.0) {
    if (x >= 29.5) return 21.50;
    return lerp(23.50, 21.50, (x - 25.0) / 4.5);
  }
  // 7.5 Pre-Viaduct Rim & Bonfire (x = 6..18, z = 224..242.5)
  if (z > 224.0) {
    if (z <= 235.0) return lerp(23.50, 25.50, (z - 224.0) / 11.0);
    if (z <= 238.0) return 25.50;
    return lerp(25.50, 25.80, clamp01((z - 238.0) / 4.5));
  }
  // 7.1 Shattered Gothic Bell-Tower Plaza (x = 4..25, z = 202..224)
  return 23.50;
}

function evalSector08Y(x, z) {
  // SC-3 Monastery Shortcut Flank & Connector (x < -3.5)
  if (x < -3.5) {
    return evalMonasteryShortcutY(x, z);
  }
  // 8.1 Grand Broken Viaduct (x = 9..15, z = 242..275, y = 25.8 -> 28.0 -> 29.0m)
  if (z <= 272.0) {
    return lerp(25.80, 28.00, clamp01((z - 242.5) / 29.5));
  }
  if (z < 275.0) {
    return lerp(28.00, 29.00, clamp01((z - 272.0) / 3.0));
  }
  // 8.5 Northern Region II Citadel Gate Approach (x = 7..17, z = 308..318, y = 29.0 -> 31.5m)
  if (z > 308.0) {
    return lerp(29.00, 31.50, clamp01((z - 308.0) / 8.0));
  }
  // 8.3 Cathedral Boss Courtyard (x = -4..+28, z = 275..308)
  return 29.00;
}

// ============================================================================
// Layer Resolution & Delegation Classifier (Zero-GC)
// ============================================================================
export function resolveRiverReachLayer(x, z, currentY = 0, state = null) {
  const px = Number.isFinite(x) ? x : 0.0;
  const pz = Number.isFinite(z) ? z : 2.5;
  const cy = Number.isFinite(currentY) ? currentY : 0.0;
  const liftY = getRiverReachLiftY(state);

  // 1. SC-2 Animated Vertical Cage Lift Platform (4.5 <-> 6.3, centered at (-5.6, liftY, 118.2))
  const liftInTransit = liftY > RIVER_REACH_LIFT_MIN_Y + 0.35 && liftY < RIVER_REACH_LIFT_MAX_Y - 0.35;
  if (isInsideLiftCageFootprint(px, pz, 0.25)) {
    const nearLiftY = Math.abs(cy - liftY) <= 2.20;
    const midShaft = cy > RIVER_REACH_LIFT_MIN_Y + 0.80 && cy < RIVER_REACH_LIFT_MAX_Y - 0.80;
    if (nearLiftY || midShaft) {
      return 'lift_cage';
    }
  } else if (
    liftInTransit &&
    Math.abs(cy - liftY) <= 1.60 &&
    isInsideLiftCageFootprint(px, pz, 1.50) &&
    (px < -3.35 || Math.abs(cy - 5.65) > 0.35)
  ) {
    // Mid-transit anti-escape guard: prevents fast steps or dodge-rolls from clipping out of the moving iron cage
    // while never stealing a player standing on bastion_upper (x >= -3.25, y = 5.65)!
    return 'lift_cage';
  }

  // 2. 6.3 Upper Lift Walkway (y = 17.65m, vertically overlapping 4.5 / P08 / 6.1 below!)
  if (
    cy >= 15.20 &&
    px >= -9.80 &&
    px <= -3.40 &&
    pz >= 116.00 &&
    pz <= 167.50
  ) {
    return 'upper_lift_walkway';
  }

  // 3. P07 East Aqueduct Bridge Extension (x = 5.25..37.5, z = 79.8..102.0, y = 5.60..10.50m)
  if (cy >= 3.45) {
    if (px >= 5.25 && px <= 37.50 && pz >= 79.80 && pz <= 84.20) {
      return 'aqueduct_east';
    }
    if (px >= 30.50 && px <= 37.50 && pz >= 80.00 && pz <= 102.20) {
      return 'aqueduct_east';
    }
  }

  // 4. SC-3 Monastery Shortcut Flank Stair (x = -16.5..-9.5, z = 176.5..280.5) + Connector to 8.3
  if (px >= -16.80 && px <= -9.50 && pz >= 176.50 && pz <= 280.50) {
    return 'monastery_shortcut';
  }
  if (px >= -12.00 && px <= -3.50 && pz >= 274.20 && pz <= 280.50) {
    return 'monastery_shortcut';
  }

  // 5. Sector 08 Abandoned Monastery (Viaduct 8.1, Gatehouse 8.2, Cathedral Courtyard 8.3, Citadel Gate 8.5)
  if (pz >= 242.50) {
    return 'sector08';
  }

  // 6. Sector 07 Ancient Ruins (Cloister 7.3, Plaza 7.1, Amphitheater 7.2, Crypt 7.4, Pre-Viaduct Rim 7.5)
  if (pz >= 187.00 && px >= -8.80) {
    return 'sector07';
  }
  if (px >= 32.00 && pz >= 182.00) {
    return 'sector07';
  }

  // 7. Sector 06 Basalt Cliff Heights (z >= 120.0, west side x <= 14.0)
  if (pz >= 120.00 && px <= 14.00) {
    return 'sector06';
  }

  // 8. Sector 05 Hunter Camp & Approaches (x >= 24.0, z >= 102.0, plus SC-4 log bridge z >= 86.5)
  if (px >= 24.00 && pz >= 102.00) {
    return 'sector05';
  }
  if (px >= 39.50 && px <= 46.50 && pz >= 86.50 && pz <= 120.00) {
    return 'sector05';
  }

  // 9. P02 Wooden Pier 1.4 & Stepping-Stone Ford 1.6 (Sector 01 -> Sector 03)
  if (px >= 5.20 && px <= 13.50 && pz >= 19.20 && pz <= 22.80) {
    return 'river_ford';
  }
  if (px >= 8.20 && px <= 13.80 && pz >= 19.20 && pz <= 26.50) {
    return 'river_ford';
  }
  if (px >= 10.00 && px <= 30.00 && pz >= 22.00 && pz <= 38.50) {
    return 'river_ford';
  }

  // 10. P03 Old Fisherman's Bridge (Sector 02 -> Sector 03)
  //     Cleanly separated from lower River Shoal (y ≈ 0.19m) via cy >= 0.54 for x < 7.0!
  if (px >= 1.80 && px <= 31.00 && pz >= 46.80 && pz <= 51.20) {
    if (px >= 6.80 || cy >= 0.54) {
      return 'sector03';
    }
  }

  // 11. Sector 03 Fishing Village, Sunken Chapel, Wrecked Barge, Watch-Cliff & P06 lower
  if (px >= 24.00 && pz >= 28.00 && pz < 102.00) {
    return 'sector03';
  }

  // Sticky guard for coordinates outside Core Gorge box ([-14..+14] x [-16..+120]) so no player
  // pressing against an outer railing/cliff ever drops back into Core Zone 0-3 clamping!
  if (px > 14.00) {
    if (pz >= 102.00) return 'sector05';
    if (pz >= 78.00 && pz <= 86.00 && cy >= 3.45 && px <= 38.00) return 'aqueduct_east';
    if (pz <= 38.50 && px <= 30.00) return 'river_ford';
    return 'sector03';
  }
  if (px < -14.00 && pz > 115.00) {
    return 'sector06';
  }
  // Sticky parapet guard for P03 Fisherman's Bridge over the river (x = 6.6..14.0, z = 44..55)
  if (px >= 6.60 && pz >= 44.50 && pz <= 54.00 && cy >= 0.54) {
    return 'sector03';
  }
  // Sticky parapet guard for P02 Pier & Ford over the river (x = 8.0..14.0, z = 18.0..41.5)
  if (px >= 8.00 && pz >= 18.00 && pz <= 41.50) {
    return 'river_ford';
  }

  return null;
}

export function isInsideRiverReachExtended(x, z, currentY = 0, state = null) {
  return resolveRiverReachLayer(x, z, currentY, state) !== null;
}

// ============================================================================
// Extended Elevation & Surface Type Solvers (Zero-GC)
// ============================================================================
export function evalRiverReachGroundY(x, z, currentY = 0, state = null) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return 0.0;
  const cy = Number.isFinite(currentY) ? currentY : 0.0;
  const layer = resolveRiverReachLayer(x, z, cy, state);

  if (layer === 'lift_cage') {
    return getRiverReachLiftY(state);
  }
  if (layer === 'upper_lift_walkway') {
    return RIVER_REACH_LIFT_MAX_Y;
  }
  if (layer === 'aqueduct_east') {
    return evalAqueductEastY(x, z);
  }
  if (layer === 'river_ford') {
    return evalRiverFordY(x, z);
  }
  if (layer === 'sector03') {
    return evalSector03Y(x, z);
  }
  if (layer === 'sector05') {
    return evalSector05Y(x, z);
  }
  if (layer === 'sector06') {
    return evalSector06Y(x, z);
  }
  if (layer === 'monastery_shortcut') {
    return evalMonasteryShortcutY(x, z);
  }
  if (layer === 'sector07') {
    return evalSector07Y(x, z);
  }
  if (layer === 'sector08') {
    return evalSector08Y(x, z);
  }
  return evalRiverReachBaseTerrainY(x, z);
}

export function evalRiverReachSurfaceType(x, z, currentY = 0, state = null) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return 'gravel';
  const cy = Number.isFinite(currentY) ? currentY : 0.0;
  const layer = resolveRiverReachLayer(x, z, cy, state);

  if (layer === 'lift_cage') return 'iron_lift';
  if (layer === 'upper_lift_walkway' || layer === 'aqueduct_east') return 'stone_bridge';
  if (layer === 'monastery_shortcut') return 'stone_courtyard';
  if (layer === 'river_ford') {
    if (x <= 12.2 && z <= 26.0) return 'wood_pier';
    return z <= 35.5 ? 'shallow_water' : 'wet_stone';
  }
  if (layer === 'sector03') {
    if (z >= 60.0) return 'wet_stone';
    if (x >= 50.0 && x <= 60.0 && z >= 38.0 && z <= 46.0) return 'stone_courtyard';
    return 'wood_pier';
  }
  if (layer === 'sector05') {
    if (x >= 31.0 && x <= 37.0 && z >= 102.0 && z <= 118.0) return 'wood_pier';
    if (x >= 40.0 && x <= 46.0 && z >= 86.0 && z <= 118.0) return 'wood_pier';
    return 'gravel';
  }
  if (layer === 'sector06') {
    if (x >= -22.0 && x <= -4.0 && z >= 134.0 && z <= 150.0) return 'wood_pier';
    return 'wet_stone';
  }
  if (layer === 'sector07') return 'stone_courtyard';
  if (layer === 'sector08') {
    if (z <= 274.0) return 'stone_bridge';
    return 'stone_courtyard';
  }
  return 'wet_stone';
}

// ============================================================================
// Russian Atlas 8-Sector Zone Title Resolver (Zero-GC)
// ============================================================================
export function getRiverReachZoneTitleAt(x, z, y = 0) {
  const px = Number.isFinite(x) ? x : 0.0;
  const pz = Number.isFinite(z) ? z : 2.5;
  const py = Number.isFinite(y) ? y : 0.0;

  // Sector 08: Abandoned Monastery (Grand Viaduct, Gatehouse, Boss Courtyard, Citadel Gate, Upper SC-3)
  if (pz >= 242.0) {
    return '08 • Заброшенный Монастырь';
  }
  // Sector 07: Ancient Ruins (Cloister, Bell-Tower Plaza, Amphitheater, Crypt, Pre-Viaduct Rim)
  if (pz >= 182.0) {
    return '07 • Древние сооружения';
  }
  // Sector 06: Cliff Heights (Upper Lift Walkway 6.3 at y>=15.0 OR north of Portcullis z>=120 on west side)
  if (py >= 15.0 && px >= -10.5 && px <= -3.0 && pz >= 116.0) {
    return '06 • Скальные высоты';
  }
  if (pz >= 120.0 && px < 22.0) {
    return '06 • Скальные высоты';
  }
  // Sector 05: Abandoned Hunter Camp (East highlands z >= 100, x >= 24)
  if (px >= 24.0 && pz >= 100.0) {
    return '05 • Заброшенная стоянка';
  }
  // Sector 04: Deep Gorge (East Aqueduct P07 span before x=31, OR main gorge z=64..120, x < 24)
  if (pz >= 79.0 && pz <= 85.0 && px >= 4.5 && px < 31.0 && py >= 4.5) {
    return '04 • Глубокое ущелье';
  }
  // Sector 03: Fishing Village (East of river across P02 Ford / P03 Bridge up to Watch-Cliff & P06)
  if (px >= 14.0 && pz >= 22.0 && pz < 100.0) {
    return '03 • Рыбацкое поселение';
  }
  // Sector 04: Deep Gorge (Lantern Road, Grotto, Aqueduct, Watchtower & Lower Lift Station 4.5)
  if (pz >= 64.0 && pz < 120.0) {
    return '04 • Глубокое ущелье';
  }
  // Sector 02: Old River Road (Ancient Archway, River Shoal, Upper Chapel Terrace)
  if (pz >= 31.0 && pz < 64.0) {
    return '02 • Старый речной тракт';
  }
  // Sector 01: Outfall Shore (Wake shore, Oath Sword, Ash Outfall Bonfire, Wooden Pier 1.4)
  return '01 • Выход из водоотвода';
}

// ============================================================================
// Extended Static Colliders (Verified Zero Pinch, Zero Seam Blockage!)
// ============================================================================
export const RIVER_REACH_STATIC_COLLIDERS = Object.freeze([
  // Sector 03 Fishing Village
  Object.freeze({ id: 's03_village_bonfire', x: 46.00, z: 54.00, r: 0.95, layer: 'sector03', yMin: 0.5, yMax: 4.5 }),
  Object.freeze({ id: 's03_chapel_altar', x: 57.80, z: 40.00, r: 0.72, layer: 'sector03', yMin: 0.0, yMax: 4.5 }),
  Object.freeze({ id: 's03_watch_turret', x: 56.20, z: 80.00, r: 1.80, layer: 'sector03', yMin: 4.0, yMax: 16.0 }),

  // Sector 05 Hunter Camp
  Object.freeze({ id: 's05_camp_bonfire', x: 50.00, z: 134.00, r: 1.05, layer: 'sector05', yMin: 12.0, yMax: 17.0 }),
  Object.freeze({ id: 's05_watchtower', x: 41.00, z: 126.00, r: 1.85, layer: 'sector05', yMin: 12.0, yMax: 24.0 }),

  // Sector 06 Cliff Heights
  Object.freeze({ id: 's06_cliff_bonfire', x: -12.00, z: 170.00, r: 1.00, layer: 'sector06', yMin: 16.0, yMax: 21.0 }),

  // Sector 07 Ancient Ruins (Exact Bell-Tower base collider at 16, 208, r=3.6!)
  Object.freeze({ id: 's07_bell_tower', x: 16.00, z: 208.00, r: 3.60, layer: 'sector07', yMin: 21.0, yMax: 54.0 }),
  Object.freeze({ id: 's07_crypt_shrine', x: -6.80, z: 206.00, r: 0.65, layer: 'sector07', yMin: 18.5, yMax: 23.0 }),
  Object.freeze({ id: 's07_viaduct_bonfire', x: 12.00, z: 236.00, r: 1.00, layer: 'sector07', yMin: 24.0, yMax: 29.0 }),

  // Sector 08 Abandoned Monastery (Clear 6.5m central Gatehouse arch x = 9..15!)
  Object.freeze({ id: 's08_gatehouse_w', x: 6.40, z: 272.00, r: 1.80, layer: 'sector08', yMin: 26.0, yMax: 48.0 }),
  Object.freeze({ id: 's08_gatehouse_e', x: 17.60, z: 272.00, r: 1.80, layer: 'sector08', yMin: 26.0, yMax: 48.0 }),
  Object.freeze({ id: 's08_cathedral_altar', x: 12.00, z: 294.00, r: 2.10, layer: 'sector08', yMin: 27.5, yMax: 34.0 })
]);

// ============================================================================
// Zero-GC Multi-Shape Union Clamper Helpers
// ============================================================================
let _rrBestX = 0.0;
let _rrBestZ = 0.0;
let _rrBestDistSq = Infinity;

function resetUnion() {
  _rrBestDistSq = Infinity;
}

function considerRect(px, pz, minX, maxX, minZ, maxZ) {
  if (minX > maxX || minZ > maxZ) return false;
  const cx = px < minX ? minX : px > maxX ? maxX : px;
  const cz = pz < minZ ? minZ : pz > maxZ ? maxZ : pz;
  const dx = px - cx;
  const dz = pz - cz;
  const dSq = dx * dx + dz * dz;
  if (dSq < _rrBestDistSq) {
    _rrBestDistSq = dSq;
    _rrBestX = cx;
    _rrBestZ = cz;
  }
  return dSq === 0.0;
}

function considerCircle(px, pz, cx, cz, radius) {
  if (radius <= 0.0) return false;
  const dx = px - cx;
  const dz = pz - cz;
  const dSq = dx * dx + dz * dz;
  if (dSq <= radius * radius) {
    _rrBestDistSq = 0.0;
    _rrBestX = px;
    _rrBestZ = pz;
    return true;
  }
  const d = Math.sqrt(dSq);
  const inv = radius / d;
  const qx = cx + dx * inv;
  const qz = cz + dz * inv;
  const ex = px - qx;
  const ez = pz - qz;
  const eSq = ex * ex + ez * ez;
  if (eSq < _rrBestDistSq) {
    _rrBestDistSq = eSq;
    _rrBestX = qx;
    _rrBestZ = qz;
  }
  return false;
}

function applyExtendedColliders(px, pz, py, rad, layer) {
  let x = px;
  let z = pz;
  for (let i = 0; i < RIVER_REACH_STATIC_COLLIDERS.length; i++) {
    const c = RIVER_REACH_STATIC_COLLIDERS[i];
    if (py < c.yMin || py > c.yMax) continue;
    if (c.layer !== layer) continue;
    const dx = x - c.x;
    const dz = z - c.z;
    const minD = c.r + rad;
    const dSq = dx * dx + dz * dz;
    if (dSq < minD * minD) {
      const d = Math.sqrt(dSq);
      if (d > 1e-4) {
        x = c.x + (dx / d) * minD;
        z = c.z + (dz / d) * minD;
      } else {
        x = c.x + minD;
      }
    }
  }
  _rrBestX = x;
  _rrBestZ = z;
}

// ============================================================================
// Master Extended Region I Position Clamper (Zero-GC, Zero Teleports, Zero Gaps!)
// Note: Open connecting portal edges are NEVER inset by `rad` — only solid cliff/parapet walls!
// ============================================================================
export function clampRiverReachPosition(x, z, currentY = 0, r = 0.55, state = null, out = null) {
  let px = Number.isFinite(x) ? x : 0.0;
  let pz = Number.isFinite(z) ? z : 2.5;
  const cy = Number.isFinite(currentY) ? currentY : 0.0;
  const rad = Number.isFinite(r) ? Math.max(0.15, r) : 0.55;

  const liftY = getRiverReachLiftY(state);
  const logShortcutUnlocked = Boolean(state && state.logShortcutUnlocked);
  const monasteryShortcutUnlocked = Boolean(state && state.monasteryShortcutUnlocked);

  const activeLayer = resolveRiverReachLayer(px, pz, cy, state);

  // --------------------------------------------------------------------------
  // GROUP 1: SC-2 Animated Vertical Cage Lift (4.5 <-> 6.3)
  // --------------------------------------------------------------------------
  if (activeLayer === 'lift_cage') {
    const cageMinX = RIVER_REACH_LIFT_CX - RIVER_REACH_LIFT_HALF;
    const cageMaxX = RIVER_REACH_LIFT_CX + RIVER_REACH_LIFT_HALF;
    const cageMinZ = RIVER_REACH_LIFT_CZ - RIVER_REACH_LIFT_HALF;
    const cageMaxZ = RIVER_REACH_LIFT_CZ + RIVER_REACH_LIFT_HALF;
    const dockedBottom = liftY <= RIVER_REACH_LIFT_MIN_Y + 0.35;
    const dockedTop = liftY >= RIVER_REACH_LIFT_MAX_Y - 0.35;

    resetUnion();
    let inside = false;
    if (!dockedBottom && !dockedTop) {
      // Strictly enclosed inside moving iron elevator cage while in transit!
      inside = considerRect(px, pz, cageMinX + rad, cageMaxX - rad, cageMinZ + rad, cageMaxZ - rad);
    } else if (dockedBottom) {
      // Open south/east into Lower Station Alcove (4.5: x=-7.4..-3.4, z=116.4..120.0)
      inside = considerRect(px, pz, -7.40 + rad, -3.20, 115.60, 120.00 - rad);
    } else {
      // Docked at top (6.3): open north/west onto Upper Lift Walkway & Lever Ledge!
      inside = considerRect(px, pz, cageMinX + rad, cageMaxX - rad, cageMinZ + rad, 122.00);
      if (!inside) {
        inside = considerRect(px, pz, -9.00 + rad, -3.80 - rad, 119.80, 168.00);
      }
      if (!inside) {
        inside = considerRect(px, pz, -9.00 + rad, cageMinX + rad, 116.40 + rad, 122.00);
      }
    }
    if (!inside) {
      px = _rrBestX;
      pz = _rrBestZ;
    }

    const finalLayer = resolveRiverReachLayer(px, pz, liftY, state) || 'main';
    const finalY = finalLayer === 'lift_cage' ? liftY : evalRiverReachGroundY(px, pz, liftY, state);
    const finalSurface = evalRiverReachSurfaceType(px, pz, finalY, state);
    if (out) {
      out.x = px;
      out.z = pz;
      out.y = finalY;
      out.layer = finalLayer;
      out.surface = finalSurface;
      return out;
    }
    return { x: px, z: pz, y: finalY, layer: finalLayer, surface: finalSurface };
  }

  // --------------------------------------------------------------------------
  // GROUP 2: 6.3 Upper Lift Walkway (y = 17.65m, elevated over 4.5 / P08 / 6.1)
  // --------------------------------------------------------------------------
  if (activeLayer === 'upper_lift_walkway') {
    const dockedTop = liftY >= RIVER_REACH_LIFT_MAX_Y - 0.35;
    resetUnion();
    let inside = false;
    // Main north-south cliff ledge connecting seamlessly north into 6.4 Terrace (z=164..178)
    inside = considerRect(px, pz, -9.00 + rad, -3.80 - rad, 119.80 + rad, 168.50);
    // West lever ledge beside lift shaft (lever at -8.2, 17.65, 121.0)
    if (!inside) {
      inside = considerRect(px, pz, -9.00 + rad, -7.20 - rad, 116.40 + rad, 122.00);
    }
    // Open junction flare into 6.4 Upper Cliff Bonfire Terrace (x = -18..-6, z = 164..178)
    if (!inside) {
      inside = considerRect(px, pz, -18.00 + rad, -4.50 - rad, 164.00 + rad, 178.00);
    }
    // When cage is docked at top, open directly into cage interior!
    if (!inside && dockedTop) {
      inside = considerRect(
        px, pz,
        RIVER_REACH_LIFT_CX - RIVER_REACH_LIFT_HALF + rad,
        RIVER_REACH_LIFT_CX + RIVER_REACH_LIFT_HALF - rad,
        RIVER_REACH_LIFT_CZ - RIVER_REACH_LIFT_HALF + rad,
        121.50
      );
    }
    if (!inside) {
      px = _rrBestX;
      pz = _rrBestZ;
    }

    const finalLayer = resolveRiverReachLayer(px, pz, RIVER_REACH_LIFT_MAX_Y, state) || 'upper_lift_walkway';
    const finalY = evalRiverReachGroundY(px, pz, RIVER_REACH_LIFT_MAX_Y, state);
    const finalSurface = evalRiverReachSurfaceType(px, pz, finalY, state);
    if (out) {
      out.x = px;
      out.z = pz;
      out.y = finalY;
      out.layer = finalLayer;
      out.surface = finalSurface;
      return out;
    }
    return { x: px, z: pz, y: finalY, layer: finalLayer, surface: finalSurface };
  }

  // --------------------------------------------------------------------------
  // GROUP 3: P07 East Aqueduct Bridge Extension (elevated over river, links 04 bridge <-> 05 ravine)
  // --------------------------------------------------------------------------
  if (activeLayer === 'aqueduct_east') {
    resetUnion();
    // East aqueduct span (open west at x=4.5 back onto Core 'bridge', open east into north turn!)
    let inside = considerRect(px, pz, 4.50, 37.00 - rad, 80.30 + rad, 83.70 - rad);
    // North cliffside aqueduct ledge running smoothly into 5.3 Wolf Ravine Plank Bridge (z=102..118)
    if (!inside) {
      inside = considerRect(px, pz, 31.00 + rad, 37.00 - rad, 80.30 + rad, 104.00);
    }
    if (!inside) {
      px = _rrBestX;
      pz = _rrBestZ;
    }

    const finalLayer = resolveRiverReachLayer(px, pz, Math.max(cy, 5.60), state) || 'bridge';
    const finalY = finalLayer === 'bridge' ? 5.60 : evalRiverReachGroundY(px, pz, Math.max(cy, 5.60), state);
    const finalSurface = evalRiverReachSurfaceType(px, pz, finalY, state);
    if (out) {
      out.x = px;
      out.z = pz;
      out.y = finalY;
      out.layer = finalLayer;
      out.surface = finalSurface;
      return out;
    }
    return { x: px, z: pz, y: finalY, layer: finalLayer, surface: finalSurface };
  }

  // --------------------------------------------------------------------------
  // GROUP 4: Unified Seamless Extended Region I Network
  //          (P02 Ford, P03 Bridge, Sector 03, Sector 05, Sector 06, Sector 07, Sector 08, SC-3, SC-4)
  // --------------------------------------------------------------------------
  resetUnion();
  let inside = false;

  // --- P02: Sector 01 Wooden Pier 1.4 + Secret Stepping-Stone Ford 1.6 -> Sector 03 ---
  // Pier deck 1.4 (open west to x=4.6 back onto Sector 01 shore, open east into ford)
  if (!inside) inside = considerRect(px, pz, 4.60, 13.00 - rad, 19.40 + rad, 22.60 - rad);
  // Pier north-east apron connecting cleanly to stepping-stone ford (clear of shore_rock_6 at x=6.4)
  if (!inside) inside = considerRect(px, pz, 8.20 + rad, 13.50, 19.40 + rad, 26.20);
  // Stepping-Stone Ford 1.6 shoal causeway (x=10..28, z=22..38, flared north into Sector 03 Hub!)
  if (!inside) inside = considerRect(px, pz, 10.00 + rad, 28.00 - rad, 22.00 + rad, 38.50);
  // Wide Ford-to-Hub arrival boardwalk landing (x=24..32, z=35..42)
  if (!inside) inside = considerRect(px, pz, 24.00 + rad, 32.00, 35.00, 42.00);

  // --- P03: Sector 02 Old Fisherman's Bridge 2.3 -> Sector 03 ---
  // Open west to x=1.2 back onto Sector 02 Main Road; open east into Boardwalk Hub
  if (!inside) inside = considerRect(px, pz, 1.20, 31.00, 47.00 + rad, 51.00 - rad);

  // --- Sector 03: Stilt Fishing Village, Bonfire Bastion, Sunken Chapel, Wrecked Barge, Watch-Cliff ---
  // 3.3 Stilt Village Boardwalk Hub (x=26..52, z=38..62)
  if (!inside) inside = considerRect(px, pz, 26.00 + rad, 52.00 - rad, 38.00 + rad, 62.00 - rad);
  // 3.2 Pier Bonfire Bastion Pad (x=42..56, z=50..62, connects seamlessly to Watch-Cliff Stair 3.5!)
  if (!inside) inside = considerRect(px, pz, 42.00, 56.00 - rad, 50.00, 62.00);
  // 3.4 Sunken Fisherman's Chapel Spur (x=46..60, z=38..54)
  if (!inside) inside = considerRect(px, pz, 46.00, 60.00 - rad, 38.00 + rad, 54.00 - rad);
  // 3.6 Wrecked Barge Secret Chest Spur (x=56..68, z=30..40, overlaps chapel at x=56..60, z=38..40!)
  if (!inside) inside = considerRect(px, pz, 56.00 + rad, 68.00 - rad, 30.00 + rad, 40.50);
  // 3.5 Watch-Cliff Staircase (x=48..56, z=60..86) + widened Turret Landing (x=46..58, z=76..88)
  if (!inside) inside = considerRect(px, pz, 48.00 + rad, 56.00 - rad, 59.50, 88.00);
  if (!inside) inside = considerRect(px, pz, 46.00 + rad, 58.00 - rad, 76.00 + rad, 88.00 - rad);
  // P06 Forest Outpost Trail (x=48..56, z=86..102) + Upper Forest Trail into Hunter Camp SE (x=46..56, z=100..121)
  if (!inside) inside = considerRect(px, pz, 47.00 + rad, 56.00 - rad, 85.00, 121.00);

  // --- SC-4: Kick-Down Log Bridge Shortcut (Camp 05 <-> Watch-Cliff 03) ---
  // Watch-Cliff west landing stub (always walkable from 03 Watch-Cliff!)
  if (!inside) inside = considerRect(px, pz, 40.00 + rad, 50.00, 84.00 + rad, 88.50 - rad);
  // Camp south kick-down rim (always walkable from 05 Camp to trigger kick-down!)
  if (!inside) inside = considerRect(px, pz, 40.00 + rad, 46.00 - rad, 116.80 + rad, 121.00);
  if (logShortcutUnlocked && !inside) {
    // Full Kick-Down Log Bridge open across ravine (x=40..46, z=85.5..120.5)!
    inside = considerRect(px, pz, 40.00 + rad, 46.00 - rad, 85.50, 120.50);
  }

  // --- Sector 05: Wolf Ravine Bridge, Hunter Camp, Overlook Cliff, Forest Ruins, P10 Forest Ascent ---
  // P07 North Turn handoff landing (z=99..104 so walking south enters aqueduct_east cleanly!)
  if (!inside) inside = considerRect(px, pz, 31.00 + rad, 37.00 - rad, 99.00, 104.00);
  // 5.3 Wolf Ravine Plank Bridge (x=31..37, z=102..118) + SW Camp Entry Ramp (x=31..42, z=117..123)
  if (!inside) inside = considerRect(px, pz, 31.00 + rad, 37.00 - rad, 101.50, 122.50 - rad);
  if (!inside) inside = considerRect(px, pz, 31.00 + rad, 42.00, 117.00 + rad, 123.00);
  // 5.1 Hunter Camp Clearing (x=36..64, z=118..150)
  if (!inside) inside = considerRect(px, pz, 36.00 + rad, 64.00 - rad, 118.00 + rad, 150.00 - rad);
  // 5.4 Overlook Cliff Spur (x=26..38, z=124..132)
  if (!inside) inside = considerRect(px, pz, 26.00 + rad, 38.50, 124.00 + rad, 132.00 - rad);
  // 5.5 Forest Ruins Secret Chest Spur (x=58..68, z=146..158)
  if (!inside) inside = considerRect(px, pz, 58.00 + rad, 68.00 - rad, 146.00, 158.00 - rad);
  // P10 Forest Ascent (x=40..48, z=149..183) + SE Ancient Ruins Approach into Amphitheater 7.2 (x=34..46, z=180..207)
  if (!inside) inside = considerRect(px, pz, 40.00 + rad, 48.00 - rad, 148.50, 183.00);
  if (!inside) inside = considerRect(px, pz, 34.00 + rad, 45.00 - rad, 180.00, 207.50);

  // --- Sector 06: Basalt Pass P08, Cliff Scaffolding 6.1, Windy Bastion 6.2, Eagle Cave 6.5, Bonfire Terrace 6.4, P11 ---
  // P08 Watchtower Portcullis Open Throat (open south to z=118.5 back into Sector 04 Watchtower Courtyard!)
  if (!inside) inside = considerRect(px, pz, -1.20 + rad, 2.80 - rad, 118.50, 122.00);
  // P08 Basalt Pass Ramp (x=-4..+4, z=120..136)
  if (!inside) inside = considerRect(px, pz, -4.00 + rad, 4.00 - rad, 120.00 + rad, 136.50 - rad);
  // Wide doorway from Basalt Pass into 6.1 Scaffolding (x=-6..-2, z=134..136.5)
  if (!inside) inside = considerRect(px, pz, -6.50, -2.00, 134.00 + rad, 136.50 - rad);
  // 6.1 Cliff Scaffolding Catwalk (x=-22..-4, z=134..150)
  if (!inside) inside = considerRect(px, pz, -22.00 + rad, -4.00 - rad, 134.00 + rad, 150.50);
  // 6.2 Windy Bastion Overlook (x=-26..-16, z=150..164) + Bastion Ascent Stair to 6.4 (x=-24..-12, z=161..168)
  if (!inside) inside = considerRect(px, pz, -26.00 + rad, -16.00 - rad, 149.50, 164.50 - rad);
  if (!inside) inside = considerRect(px, pz, -24.00 + rad, -11.00, 161.00 + rad, 168.00);
  // 6.5 Secret Eagle Cave Pocket (x=-33..-24, z=148..156)
  if (!inside) inside = considerRect(px, pz, -33.00 + rad, -23.50, 148.00 + rad, 156.00 - rad);
  // 6.4 Upper Cliff Bonfire Terrace (x=-18..-6, z=164..178) + junction south to 6.3 Upper Lift Walkway (x=-10..-4.5, z=163..168)
  if (!inside) inside = considerRect(px, pz, -18.00 + rad, -6.00 - rad, 164.00 + rad, 178.00 - rad);
  if (!inside && cy >= 15.20) inside = considerRect(px, pz, -10.50, -4.20 - rad, 162.50, 168.50);
  // P11 Carved Stair NW to Sector 07 (flared at south x=-10..+2, z=175..188 so 6.4 <-> P11 is wide open!)
  if (!inside) inside = considerRect(px, pz, -10.00 + rad, 2.00 - rad, 175.50, 188.50);

  // --- Sector 07: Southern Cloister 7.3, Bell-Tower Plaza 7.1, Sunken Amphitheater 7.2, Crypt 7.4, Pre-Viaduct Rim 7.5 ---
  // 7.3 Southern Cloister Colonnades (x=-6..+14, z=186..199.5, plus wide east portal into Plaza x=+4..+14, z=197..203!)
  if (!inside) inside = considerRect(px, pz, -6.00 + rad, 14.00 - rad, 186.00 + rad, 199.50 - rad);
  if (!inside) inside = considerRect(px, pz, 4.00 + rad, 14.00 - rad, 197.00, 203.00);
  // 7.1 Shattered Bell-Tower Plaza (x=+4..+28, z=198..224)
  if (!inside) inside = considerRect(px, pz, 4.00 + rad, 28.00 - rad, 198.00 + rad, 224.00 - rad);
  // 7.4 Underground Relic Crypt (entered off West side of Bell-Tower Plaza: x=-8..+5.5, z=201.5..212.0)
  if (!inside) inside = considerRect(px, pz, -8.00 + rad, 6.00, 201.50 + rad, 212.00 - rad);
  // 7.2 Sunken Stone Amphitheater (exact circle cx=36, cz=214, r=11.0 - rad) + West Connector Ramp to Plaza (x=24..32, z=208..220)
  if (!inside) inside = considerCircle(px, pz, 36.00, 214.00, 11.00 - rad);
  if (!inside) inside = considerRect(px, pz, 24.00, 32.00, 208.00 + rad, 220.00 - rad);
  // 7.5 Pre-Viaduct Rim & Bonfire (x=+6..+18, z=224..243)
  if (!inside) inside = considerRect(px, pz, 6.00 + rad, 18.00 - rad, 223.00, 243.50 - rad);

  // --- Sector 08: Grand Broken Viaduct 8.1, Gatehouse 8.2, Cathedral Boss Courtyard 8.3, Citadel Gate 8.5 ---
  // 8.1 Grand Broken Viaduct (P12: x=+9.0..+15.0, z=242..276)
  if (!inside) inside = considerRect(px, pz, 9.00 + rad, 15.00 - rad, 241.50, 276.50);
  // 8.3 Cathedral Boss Courtyard Arena (x=-4..+28, z=275..308)
  if (!inside) inside = considerRect(px, pz, -4.00 + rad, 28.00 - rad, 275.00 + rad, 308.00 - rad);
  // 8.5 Northern Region II Citadel Gate Approach (P13 Finale: x=+7..+17, z=308..318)
  if (!inside) inside = considerRect(px, pz, 7.00 + rad, 17.00 - rad, 307.00, 318.00 - rad);

  // --- SC-3: Monastery Bell-Tower Flank Stair & Locked Gate (6.4 <-> 8.4 <-> 8.3) ---
  // Locked gate splits corridor cleanly at z = 266.0 (+/- 0.40m half-thickness) until state.monasteryShortcutUnlocked!
  const sc3GateZ = 266.00;
  const sc3GateHalfT = 0.40;
  if (monasteryShortcutUnlocked) {
    if (!inside) inside = considerRect(px, pz, -16.00 + rad, -10.00 - rad, 175.50, 280.00 - rad);
  } else {
    // South flight (accessible from Sector 06 Bonfire Terrace 6.4 up to locked gate south face)
    const onSouthSide = pz < sc3GateZ || cy < 27.50;
    if (onSouthSide && !inside) {
      inside = considerRect(px, pz, -16.00 + rad, -10.00 - rad, 175.50, sc3GateZ - sc3GateHalfT - rad);
    }
    // North upper landing & lever platform (accessible from Sector 08 Cathedral Courtyard 8.3!)
    const onNorthSide = pz >= sc3GateZ || cy >= 27.50;
    if (onNorthSide && !inside) {
      inside = considerRect(px, pz, -16.00 + rad, -10.00 - rad, sc3GateZ + sc3GateHalfT + rad, 280.00 - rad);
    }
  }
  // SC-3 Upper Connector into Cathedral Boss Courtyard (x=-12..-2.5, z=275..280)
  if (!inside) inside = considerRect(px, pz, -12.00, -2.50, 275.00 + rad, 280.00 - rad);

  if (!inside) {
    px = _rrBestX;
    pz = _rrBestZ;
  }

  // Resolve final extended layer & apply circular static colliders (2 relaxation passes for smooth corners!)
  const resolvedLayer = resolveRiverReachLayer(px, pz, cy, state) || activeLayer || 'sector03';
  const preY = evalRiverReachGroundY(px, pz, cy, state);
  for (let pass = 0; pass < 2; pass++) {
    applyExtendedColliders(px, pz, preY, rad, resolvedLayer);
    px = _rrBestX;
    pz = _rrBestZ;
  }

  // Clamp outer global valley bounds safety guard
  px = clamp(px, -48.0 + rad, 96.0 - rad);
  pz = clamp(pz, -18.0 + rad, 336.0 - rad);

  const finalLayer = resolveRiverReachLayer(px, pz, cy, state) || 'main';
  const finalY = evalRiverReachGroundY(px, pz, cy, state);
  const finalSurface = evalRiverReachSurfaceType(px, pz, finalY, state);

  if (out) {
    out.x = px;
    out.z = pz;
    out.y = finalY;
    out.layer = finalLayer;
    out.surface = finalSurface;
    return out;
  }
  return { x: px, z: pz, y: finalY, layer: finalLayer, surface: finalSurface };
}

// ============================================================================
// Canonical Anchors — All 44 POIs (1.1..8.5) + Quick Sector Spawns ('01'..'08')
// ============================================================================
export const RIVER_REACH_ANCHORS = Object.freeze({
  // Quick Sector Spawn / Fast-Travel Points ('01'..'08') — Verified Collider-Free!
  '01': Object.freeze({ x: 0.0, y: 0.0, z: 2.5, layer: 'main', title: '01 • Выход из водоотвода' }),
  '02': Object.freeze({ x: -0.3, y: evalCoreGorgeBaseTerrainY(-0.3, 44.0), z: 44.0, layer: 'main', title: '02 • Старый речной тракт' }),
  '03': Object.freeze({ x: 38.0, y: 1.35, z: 49.0, layer: 'sector03', title: '03 • Рыбацкое поселение' }),
  '04': Object.freeze({ x: 0.6, y: 2.65, z: 106.0, layer: 'main', title: '04 • Глубокое ущелье' }),
  '05': Object.freeze({ x: 46.5, y: 13.50, z: 134.0, layer: 'sector05', title: '05 • Заброшенная стоянка' }),
  '06': Object.freeze({ x: -12.0, y: 17.65, z: 167.0, layer: 'sector06', title: '06 • Скальные высоты' }),
  '07': Object.freeze({ x: 10.0, y: 23.50, z: 208.0, layer: 'sector07', title: '07 • Древние сооружения' }),
  '08': Object.freeze({ x: 12.0, y: 29.00, z: 282.0, layer: 'sector08', title: '08 • Заброшенный Монастырь' }),

  // Sector 01 POIs (1.1 .. 1.6)
  '1.1': Object.freeze({ x: 0.0, y: 0.0, z: 2.5, layer: 'main', name: 'Берег Пепельного Стока' }),
  '1.2': Object.freeze({ x: 2.8, y: evalCoreGorgeBaseTerrainY(2.8, 5.2), z: 5.2, layer: 'main', name: 'Меч Клятвы на отмели' }),
  '1.3': Object.freeze({ x: -2.2, y: evalCoreGorgeBaseTerrainY(-2.2, 15.0), z: 15.0, layer: 'main', name: 'Костёр Пепельного Стока' }),
  '1.4': Object.freeze({ x: 9.5, y: 0.65, z: 21.0, layer: 'river_ford', name: 'Деревянный причал' }),
  '1.5': Object.freeze({ x: 0.0, y: evalCoreGorgeBaseTerrainY(0.0, 31.0), z: 31.0, layer: 'main', name: 'Врата Пепельного Ущелья' }),
  '1.6': Object.freeze({ x: 19.0, y: 0.25, z: 29.0, layer: 'river_ford', name: 'Тайный брод и сундук отмели' }),

  // Sector 02 POIs (2.1 .. 2.6)
  '2.1': Object.freeze({ x: -2.95, y: evalCoreGorgeBaseTerrainY(-2.95, 45.2), z: 45.2, layer: 'main', name: 'Придорожный костёр тракта' }),
  '2.2': Object.freeze({ x: -0.6, y: evalCoreGorgeBaseTerrainY(-0.6, 55.5), z: 55.5, layer: 'main', name: 'Древняя арка в плюще' }),
  '2.3': Object.freeze({ x: 16.0, y: 1.35, z: 49.0, layer: 'sector03', name: 'Старый рыбацкий мост' }),
  '2.4': Object.freeze({ x: 4.8, y: evalCoreGorgeBaseTerrainY(4.8, 53.5), z: 53.5, layer: 'river_shoal', name: 'Забытый алтарь отмели' }),
  '2.5': Object.freeze({ x: -11.4, y: 4.90, z: 64.0, layer: 'upper_terrace', name: 'Верхняя часовня утёса' }),
  '2.6': Object.freeze({ x: -9.5, y: 4.20, z: 52.0, layer: 'upper_terrace', name: 'Кованые ворота утёса (SC-1)' }),

  // Sector 03 POIs (3.1 .. 3.6)
  '3.1': Object.freeze({ x: 72.0, y: 14.00, z: 20.0, layer: 'scenic', name: 'Северный водопад' }),
  '3.2': Object.freeze({ x: 46.0, y: 1.65, z: 54.0, layer: 'sector03', name: 'Костёр рыбацкого причала' }),
  '3.3': Object.freeze({ x: 38.0, y: 1.35, z: 49.0, layer: 'sector03', name: 'Свайные мостки деревни' }),
  '3.4': Object.freeze({ x: 56.0, y: 1.35, z: 40.0, layer: 'sector03', name: 'Затопленная часовня рыбаков' }),
  '3.5': Object.freeze({ x: 52.0, y: 8.20, z: 84.0, layer: 'sector03', name: 'Лестница и башня дозорного утёса' }),
  '3.6': Object.freeze({ x: 64.0, y: 0.85, z: 32.0, layer: 'sector03', name: 'Разбитая баржа (тайник)' }),

  // Sector 04 POIs (4.1 .. 4.6)
  '4.1': Object.freeze({ x: -3.55, y: evalCoreGorgeBaseTerrainY(-3.55, 71.2), z: 71.2, layer: 'main', name: 'Фонарная набережная' }),
  '4.2': Object.freeze({ x: -5.6, y: 1.45, z: 91.0, layer: 'grotto', name: 'Грот контрабандистов' }),
  '4.3': Object.freeze({ x: 0.0, y: 5.60, z: 82.0, layer: 'bridge', name: 'Акведук Разлома' }),
  '4.4': Object.freeze({ x: 19.0, y: 10.50, z: 96.0, layer: 'scenic', name: 'Водопад глубокого ущелья' }),
  '4.5': Object.freeze({ x: -5.6, y: 2.65, z: 118.2, layer: 'lift_cage', name: 'Нижняя станция клети-подъёмника (SC-2)' }),
  '4.6': Object.freeze({ x: 0.65, y: 2.65, z: 111.2, layer: 'main', name: 'Костёр Башни Перевала' }),

  // Sector 05 POIs (5.1 .. 5.5)
  '5.1': Object.freeze({ x: 50.0, y: 13.50, z: 134.0, layer: 'sector05', name: 'Костёр охотничьего лагеря' }),
  '5.2': Object.freeze({ x: 41.0, y: 13.50, z: 126.0, layer: 'sector05', name: 'Деревянная сторожевая вышка' }),
  '5.3': Object.freeze({ x: 34.0, y: 11.35, z: 110.0, layer: 'sector05', name: 'Дощатый мост Волчьего оврага' }),
  '5.4': Object.freeze({ x: 28.0, y: 12.80, z: 128.0, layer: 'sector05', name: 'Утёс над речным трактом' }),
  '5.5': Object.freeze({ x: 64.0, y: 15.20, z: 152.0, layer: 'sector05', name: 'Лесные руины (тайник)' }),

  // Sector 06 POIs (6.1 .. 6.5)
  '6.1': Object.freeze({ x: -13.0, y: 11.00, z: 142.0, layer: 'sector06', name: 'Скальные деревянные подмостки' }),
  '6.2': Object.freeze({ x: -21.0, y: 14.50, z: 157.0, layer: 'sector06', name: 'Ветреный бастион' }),
  '6.3': Object.freeze({ x: -5.6, y: 17.65, z: 118.2, layer: 'upper_lift_walkway', name: 'Верхний переход подъёмника (SC-2)' }),
  '6.4': Object.freeze({ x: -12.0, y: 17.65, z: 170.0, layer: 'sector06', name: 'Костёр верхнего утёса' }),
  '6.5': Object.freeze({ x: -30.0, y: 14.50, z: 152.0, layer: 'sector06', name: 'Орлиная пещера (тайник)' }),

  // Sector 07 POIs (7.1 .. 7.5)
  '7.1': Object.freeze({ x: 16.0, y: 23.50, z: 208.0, layer: 'sector07', name: 'Площадь Разбитой Колокольни' }),
  '7.2': Object.freeze({ x: 36.0, y: 21.50, z: 214.0, layer: 'sector07', name: 'Затонувший каменный амфитеатр' }),
  '7.3': Object.freeze({ x: 4.0, y: 22.35, z: 194.0, layer: 'sector07', name: 'Южная колоннада клуатра' }),
  '7.4': Object.freeze({ x: -6.0, y: 19.80, z: 206.0, layer: 'sector07', name: 'Подземный склеп реликвий' }),
  '7.5': Object.freeze({ x: 12.0, y: 25.50, z: 236.0, layer: 'sector07', name: 'Костёр у края Виадука' }),

  // Sector 08 POIs (8.1 .. 8.5)
  '8.1': Object.freeze({ x: 12.0, y: 26.90, z: 256.0, layer: 'sector08', name: 'Великий Разбитый Виадук' }),
  '8.2': Object.freeze({ x: 12.0, y: 28.00, z: 272.0, layer: 'sector08', name: 'Двубашенные врата Монастыря' }),
  '8.3': Object.freeze({ x: 12.0, y: 29.00, z: 294.0, layer: 'sector08', name: 'Соборный двор и Алтарь Босса' }),
  '8.4': Object.freeze({ x: -13.0, y: 27.50, z: 266.0, layer: 'monastery_shortcut', name: 'Южная башня короткого пути (SC-3)' }),
  '8.5': Object.freeze({ x: 12.0, y: 31.50, z: 316.0, layer: 'sector08', name: 'Северные Врата Цитадели (Регион II)' }),

  // Semantic Named Anchors for Builders & AI
  woodenPierPos: Object.freeze({ x: 9.5, y: 0.65, z: 21.0, layer: 'river_ford' }),
  fordChestPos: Object.freeze({ x: 19.0, y: 0.25, z: 29.0, layer: 'river_ford' }),
  fishermanBridgePos: Object.freeze({ x: 16.0, y: 1.35, z: 49.0, layer: 'sector03' }),
  villageBonfirePos: Object.freeze({ x: 46.0, y: 1.65, z: 54.0, layer: 'sector03' }),
  sunkenChapelPos: Object.freeze({ x: 56.0, y: 1.35, z: 40.0, layer: 'sector03' }),
  wreckedBargePos: Object.freeze({ x: 64.0, y: 0.85, z: 32.0, layer: 'sector03' }),
  watchCliffTurretPos: Object.freeze({ x: 55.0, y: 8.20, z: 80.0, layer: 'sector03' }),
  liftBottomPos: Object.freeze({ x: -5.6, y: 2.65, z: 118.2, layer: 'lift_cage' }),
  liftTopPos: Object.freeze({ x: -5.6, y: 17.65, z: 118.2, layer: 'upper_lift_walkway' }),
  liftTopLeverPos: Object.freeze({ x: -8.2, y: 17.65, z: 121.0, layer: 'upper_lift_walkway' }),
  campBonfirePos: Object.freeze({ x: 50.0, y: 13.50, z: 134.0, layer: 'sector05' }),
  campWatchtowerPos: Object.freeze({ x: 41.0, y: 13.50, z: 126.0, layer: 'sector05' }),
  campOverlookPos: Object.freeze({ x: 28.0, y: 12.80, z: 128.0, layer: 'sector05' }),
  forestRuinsChestPos: Object.freeze({ x: 64.0, y: 15.20, z: 152.0, layer: 'sector05' }),
  logShortcutPos: Object.freeze({ x: 43.0, y: 13.50, z: 117.5, layer: 'sector05' }),
  cliffBonfirePos: Object.freeze({ x: -12.0, y: 17.65, z: 170.0, layer: 'sector06' }),
  eagleCaveChestPos: Object.freeze({ x: -30.0, y: 14.50, z: 152.0, layer: 'sector06' }),
  bellTowerPos: Object.freeze({ x: 16.0, y: 23.50, z: 208.0, layer: 'sector07' }),
  amphitheaterPos: Object.freeze({ x: 36.0, y: 21.50, z: 214.0, layer: 'sector07' }),
  cryptShrinePos: Object.freeze({ x: -6.0, y: 19.80, z: 206.0, layer: 'sector07' }),
  viaductBonfirePos: Object.freeze({ x: 12.0, y: 25.50, z: 236.0, layer: 'sector07' }),
  monasteryGatePos: Object.freeze({ x: 12.0, y: 28.00, z: 272.0, layer: 'sector08' }),
  cathedralAltarPos: Object.freeze({ x: 12.0, y: 29.00, z: 294.0, layer: 'sector08' }),
  monasteryShortcutGatePos: Object.freeze({ x: -13.0, y: 27.50, z: 266.0, layer: 'monastery_shortcut' }),
  monasteryShortcutLeverPos: Object.freeze({ x: -11.4, y: 27.83, z: 269.0, layer: 'monastery_shortcut' }),
  citadelGatePos: Object.freeze({ x: 12.0, y: 31.50, z: 316.0, layer: 'sector08' }),

  bounds: Object.freeze({ minX: -48.0, maxX: 96.0, minZ: -18.0, maxZ: 336.0 })
});

// ============================================================================
// Unified 3D Fire & Warm Lantern Light Sources Across Extended Region I
// (6 Bonfires + 36+ Braziers & Lanterns tracking the player everywhere!)
// ============================================================================
export const RIVER_REACH_EXTENDED_FIRE_SOURCES = Object.freeze([
  // --- P02 / P03 Crossings & Sector 03 Fishing Village ---
  Object.freeze({
    id: 'village_bonfire',
    kind: 'bonfire',
    x: 46.00,
    y: 1.65 + 1.60,
    z: 54.00,
    layer: 'sector03',
    weight: 1.00,
    radius: 19.0,
    lightIntensity: 10.2,
    alwaysLit: true,
    isBonfire: true
  }),
  Object.freeze({ id: 'pier_lantern_1', kind: 'lantern', x: 9.80, y: 0.65 + 2.95, z: 20.10, layer: 'river_ford', weight: 0.68, radius: 13.0, lightIntensity: 5.5, alwaysLit: true }),
  Object.freeze({ id: 'ford_lantern_2', kind: 'lantern', x: 22.50, y: 0.35 + 2.50, z: 34.50, layer: 'river_ford', weight: 0.64, radius: 12.5, lightIntensity: 5.0, alwaysLit: true }),
  Object.freeze({ id: 'fisherman_bridge_lantern_w', kind: 'lantern', x: 8.50, y: 1.35 + 2.95, z: 47.40, layer: 'sector03', weight: 0.70, radius: 14.0, lightIntensity: 5.8, alwaysLit: true }),
  Object.freeze({ id: 'fisherman_bridge_lantern_e', kind: 'lantern', x: 24.00, y: 1.35 + 2.95, z: 50.60, layer: 'sector03', weight: 0.70, radius: 14.0, lightIntensity: 5.8, alwaysLit: true }),
  Object.freeze({ id: 'village_hub_lantern_1', kind: 'lantern', x: 32.00, y: 1.35 + 3.00, z: 44.00, layer: 'sector03', weight: 0.74, radius: 15.0, lightIntensity: 6.2, alwaysLit: true }),
  Object.freeze({ id: 'village_hub_lantern_2', kind: 'lantern', x: 38.00, y: 1.35 + 3.00, z: 56.50, layer: 'sector03', weight: 0.74, radius: 15.0, lightIntensity: 6.2, alwaysLit: true }),
  Object.freeze({ id: 'sunken_chapel_brazier', kind: 'brazier', x: 56.00, y: 1.35 + 1.50, z: 42.00, layer: 'sector03', weight: 0.80, radius: 15.5, lightIntensity: 6.8, alwaysLit: true }),
  Object.freeze({ id: 'wrecked_barge_lantern', kind: 'lantern', x: 61.50, y: 0.85 + 2.25, z: 34.50, layer: 'sector03', weight: 0.66, radius: 13.0, lightIntensity: 5.2, alwaysLit: true }),
  Object.freeze({ id: 'watch_cliff_beacon', kind: 'brazier', x: 54.50, y: 8.20 + 2.10, z: 82.00, layer: 'sector03', weight: 0.86, radius: 18.0, lightIntensity: 7.8, alwaysLit: true }),

  // --- P07 East Aqueduct Extension & SC-2 Lower Lift Station ---
  Object.freeze({ id: 'aqueduct_east_brazier_1', kind: 'brazier', x: 18.00, y: 8.00 + 1.45, z: 80.70, layer: 'aqueduct_east', weight: 0.76, radius: 15.0, lightIntensity: 6.4, alwaysLit: true }),
  Object.freeze({ id: 'aqueduct_east_brazier_2', kind: 'brazier', x: 33.50, y: 10.50 + 1.55, z: 83.20, layer: 'aqueduct_east', weight: 0.80, radius: 16.0, lightIntensity: 6.8, alwaysLit: true }),
  Object.freeze({ id: 'lift_lower_lantern', kind: 'lantern', x: -7.00, y: 2.65 + 2.45, z: 117.20, layer: 'main', weight: 0.72, radius: 13.5, lightIntensity: 5.8, alwaysLit: true }),

  // --- Sector 05 Hunter Camp & Approaches ---
  Object.freeze({
    id: 'camp_bonfire',
    kind: 'bonfire',
    x: 50.00,
    y: 13.50 + 1.60,
    z: 134.00,
    layer: 'sector05',
    weight: 1.00,
    radius: 20.0,
    lightIntensity: 10.5,
    alwaysLit: true,
    isBonfire: true
  }),
  Object.freeze({ id: 'ravine_bridge_torch_s', kind: 'brazier', x: 31.60, y: 10.70 + 2.20, z: 104.00, layer: 'sector05', weight: 0.72, radius: 14.0, lightIntensity: 5.8, alwaysLit: true }),
  Object.freeze({ id: 'ravine_bridge_torch_n', kind: 'brazier', x: 36.40, y: 12.10 + 2.20, z: 117.00, layer: 'sector05', weight: 0.72, radius: 14.0, lightIntensity: 5.8, alwaysLit: true }),
  Object.freeze({ id: 'camp_watchtower_beacon', kind: 'brazier', x: 41.00, y: 13.50 + 6.50, z: 126.00, layer: 'sector05', weight: 0.88, radius: 22.0, lightIntensity: 8.4, alwaysLit: true }),
  Object.freeze({ id: 'camp_palisade_brazier_e', kind: 'brazier', x: 59.50, y: 13.50 + 1.85, z: 128.00, layer: 'sector05', weight: 0.76, radius: 15.0, lightIntensity: 6.4, alwaysLit: true }),
  Object.freeze({ id: 'camp_overlook_lantern', kind: 'lantern', x: 28.50, y: 12.80 + 2.40, z: 128.00, layer: 'sector05', weight: 0.70, radius: 14.0, lightIntensity: 5.6, alwaysLit: true }),
  Object.freeze({ id: 'forest_ruins_brazier', kind: 'brazier', x: 63.50, y: 15.20 + 1.55, z: 151.00, layer: 'sector05', weight: 0.74, radius: 14.5, lightIntensity: 6.2, alwaysLit: true }),
  Object.freeze({ id: 'forest_ascent_torch', kind: 'brazier', x: 44.00, y: 17.50 + 2.20, z: 168.00, layer: 'sector05', weight: 0.72, radius: 15.0, lightIntensity: 6.0, alwaysLit: true }),

  // --- Sector 06 Basalt Cliff Heights ---
  Object.freeze({
    id: 'cliff_bonfire',
    kind: 'bonfire',
    x: -12.00,
    y: 17.65 + 1.60,
    z: 170.00,
    layer: 'sector06',
    weight: 1.00,
    radius: 20.0,
    lightIntensity: 10.4,
    alwaysLit: true,
    isBonfire: true
  }),
  Object.freeze({ id: 'basalt_pass_torch', kind: 'brazier', x: -3.20, y: 5.40 + 2.20, z: 128.00, layer: 'sector06', weight: 0.74, radius: 14.5, lightIntensity: 6.0, alwaysLit: true }),
  Object.freeze({ id: 'scaffold_lantern_1', kind: 'lantern', x: -12.00, y: 10.60 + 2.80, z: 136.50, layer: 'sector06', weight: 0.70, radius: 14.0, lightIntensity: 5.8, alwaysLit: true }),
  Object.freeze({ id: 'scaffold_lantern_2', kind: 'lantern', x: -19.50, y: 12.20 + 2.80, z: 146.00, layer: 'sector06', weight: 0.70, radius: 14.0, lightIntensity: 5.8, alwaysLit: true }),
  Object.freeze({ id: 'windy_bastion_brazier', kind: 'brazier', x: -23.50, y: 14.80 + 1.65, z: 158.00, layer: 'sector06', weight: 0.82, radius: 16.5, lightIntensity: 7.2, alwaysLit: true }),
  Object.freeze({ id: 'lift_upper_lantern', kind: 'lantern', x: -8.20, y: 17.65 + 2.55, z: 121.00, layer: 'upper_lift_walkway', weight: 0.76, radius: 15.0, lightIntensity: 6.4, alwaysLit: true }),
  Object.freeze({ id: 'lift_walkway_lantern', kind: 'lantern', x: -4.40, y: 17.65 + 2.65, z: 144.00, layer: 'upper_lift_walkway', weight: 0.70, radius: 14.0, lightIntensity: 5.6, alwaysLit: true }),

  // --- Sector 07 Ancient Ruins ---
  Object.freeze({
    id: 'viaduct_bonfire',
    kind: 'bonfire',
    x: 12.00,
    y: 25.50 + 1.60,
    z: 236.00,
    layer: 'sector07',
    weight: 1.00,
    radius: 20.0,
    lightIntensity: 10.5,
    alwaysLit: true,
    isBonfire: true
  }),
  Object.freeze({ id: 'cloister_brazier_1', kind: 'brazier', x: 0.00, y: 22.10 + 1.80, z: 193.00, layer: 'sector07', weight: 0.78, radius: 15.5, lightIntensity: 6.6, alwaysLit: true }),
  Object.freeze({ id: 'cloister_brazier_2', kind: 'brazier', x: 10.00, y: 23.10 + 1.80, z: 199.00, layer: 'sector07', weight: 0.78, radius: 15.5, lightIntensity: 6.6, alwaysLit: true }),
  Object.freeze({ id: 'bell_tower_brazier_w', kind: 'brazier', x: 10.50, y: 23.50 + 1.85, z: 208.00, layer: 'sector07', weight: 0.86, radius: 18.0, lightIntensity: 8.0, alwaysLit: true }),
  Object.freeze({ id: 'bell_tower_brazier_e', kind: 'brazier', x: 21.50, y: 23.50 + 1.85, z: 208.00, layer: 'sector07', weight: 0.86, radius: 18.0, lightIntensity: 8.0, alwaysLit: true }),
  Object.freeze({ id: 'amphitheater_brazier', kind: 'brazier', x: 36.00, y: 21.50 + 1.75, z: 214.00, layer: 'sector07', weight: 0.84, radius: 17.5, lightIntensity: 7.6, alwaysLit: true }),
  Object.freeze({ id: 'crypt_shrine_brazier', kind: 'brazier', x: -6.00, y: 19.80 + 1.45, z: 206.00, layer: 'sector07', weight: 0.76, radius: 14.0, lightIntensity: 6.2, alwaysLit: true }),

  // --- Sector 08 Abandoned Monastery ---
  Object.freeze({ id: 'viaduct_brazier_1', kind: 'brazier', x: 9.40, y: 26.50 + 1.85, z: 252.00, layer: 'sector08', weight: 0.82, radius: 16.5, lightIntensity: 7.4, alwaysLit: true }),
  Object.freeze({ id: 'viaduct_brazier_2', kind: 'brazier', x: 14.60, y: 27.35 + 1.85, z: 263.00, layer: 'sector08', weight: 0.82, radius: 16.5, lightIntensity: 7.4, alwaysLit: true }),
  Object.freeze({ id: 'monastery_gate_brazier_w', kind: 'brazier', x: 8.20, y: 28.00 + 2.25, z: 272.00, layer: 'sector08', weight: 0.90, radius: 19.0, lightIntensity: 8.8, alwaysLit: true }),
  Object.freeze({ id: 'monastery_gate_brazier_e', kind: 'brazier', x: 15.80, y: 28.00 + 2.25, z: 272.00, layer: 'sector08', weight: 0.90, radius: 19.0, lightIntensity: 8.8, alwaysLit: true }),
  Object.freeze({ id: 'cathedral_courtyard_brazier_sw', kind: 'brazier', x: 2.00, y: 29.00 + 2.00, z: 284.00, layer: 'sector08', weight: 0.88, radius: 19.0, lightIntensity: 8.6, alwaysLit: true }),
  Object.freeze({ id: 'cathedral_courtyard_brazier_se', kind: 'brazier', x: 22.00, y: 29.00 + 2.00, z: 284.00, layer: 'sector08', weight: 0.88, radius: 19.0, lightIntensity: 8.6, alwaysLit: true }),
  Object.freeze({ id: 'cathedral_altar_brazier_w', kind: 'brazier', x: 7.50, y: 29.00 + 2.05, z: 296.00, layer: 'sector08', weight: 0.94, radius: 20.0, lightIntensity: 9.4, alwaysLit: true }),
  Object.freeze({ id: 'cathedral_altar_brazier_e', kind: 'brazier', x: 16.50, y: 29.00 + 2.05, z: 296.00, layer: 'sector08', weight: 0.94, radius: 20.0, lightIntensity: 9.4, alwaysLit: true }),
  Object.freeze({ id: 'monastery_shortcut_lantern', kind: 'lantern', x: -11.40, y: 27.83 + 2.45, z: 269.00, layer: 'monastery_shortcut', weight: 0.76, radius: 15.0, lightIntensity: 6.4, alwaysLit: true }),
  Object.freeze({ id: 'citadel_gate_brazier_w', kind: 'brazier', x: 8.50, y: 31.50 + 2.20, z: 315.00, layer: 'sector08', weight: 0.92, radius: 19.5, lightIntensity: 9.0, alwaysLit: true }),
  Object.freeze({ id: 'citadel_gate_brazier_e', kind: 'brazier', x: 15.50, y: 31.50 + 2.20, z: 315.00, layer: 'sector08', weight: 0.92, radius: 19.5, lightIntensity: 9.0, alwaysLit: true })
]);

// Complete Region I Fire Sources (includes Sector 01 & Sector 04 bonfires + all extended bonfires/braziers/lanterns!)
export const RIVER_REACH_FIRE_SOURCES = Object.freeze([
  Object.freeze({
    id: 'shore_bonfire',
    kind: 'bonfire',
    x: -2.20,
    y: evalCoreGorgeBaseTerrainY(-2.20, 15.00) + 1.65,
    z: 15.00,
    layer: 'main',
    weight: 1.00,
    radius: 17.5,
    lightIntensity: 9.5,
    alwaysLit: false,
    isBonfire: true
  }),
  Object.freeze({
    id: 'gorge_watchtower_hearth',
    kind: 'bonfire',
    x: 0.65,
    y: 2.65 + 1.60,
    z: 111.20,
    layer: 'main',
    weight: 1.00,
    radius: 18.0,
    lightIntensity: 9.8,
    alwaysLit: true,
    isBonfire: true
  }),
  ...RIVER_REACH_EXTENDED_FIRE_SOURCES
]);

// ============================================================================
// Extended Interactables (4 Extended Bonfires, SC-2 Lift Controls, SC-3/SC-4 Shortcuts,
// 5 Secret Chests/Relics, Cathedral Boss Altar 8.3, Region II Citadel Gate 8.5, Vistas/Lore)
// ============================================================================
export const RIVER_REACH_EXTENDED_INTERACTABLES = Object.freeze([
  // --- 4 Extended Bonfires (plus Shore & Watchtower = 6 Region I Bonfires total!) ---
  Object.freeze({
    id: 'village_bonfire',
    type: 'bonfire',
    x: 46.00,
    y: 1.65,
    z: 54.00,
    layer: 'sector03',
    radius: 2.45,
    sector: '03',
    title: 'Костёр Рыбацкого Причала',
    prompt: 'Отдохнуть у костра'
  }),
  Object.freeze({
    id: 'camp_bonfire',
    type: 'bonfire',
    x: 50.00,
    y: 13.50,
    z: 134.00,
    layer: 'sector05',
    radius: 2.45,
    sector: '05',
    title: 'Костёр Заброшенной Стоянки',
    prompt: 'Отдохнуть у костра'
  }),
  Object.freeze({
    id: 'cliff_bonfire',
    type: 'bonfire',
    x: -12.00,
    y: 17.65,
    z: 170.00,
    layer: 'sector06',
    radius: 2.45,
    sector: '06',
    title: 'Костёр Верхнего Утёса',
    prompt: 'Отдохнуть у костра'
  }),
  Object.freeze({
    id: 'viaduct_bonfire',
    type: 'bonfire',
    x: 12.00,
    y: 25.50,
    z: 236.00,
    layer: 'sector07',
    radius: 2.45,
    sector: '07',
    title: 'Костёр у Края Виадука',
    prompt: 'Отдохнуть у костра'
  }),

  // --- SC-2: Vertical Cage Lift Controls (4.5 Bottom + 6.3 Top + Cage Switch) ---
  Object.freeze({
    id: 'lift_lever_bottom',
    type: 'lift_lever',
    x: -6.80,
    y: 2.65,
    z: 117.20,
    layer: 'main',
    radius: 2.25,
    stateKey: 'liftUnlocked',
    targetFloor: 'bottom',
    title: 'Механизм Подъёмника Перевала',
    prompt: 'Вызвать клеть подъёмника',
    lockedPrompt: 'Противовес заклинило сверху — активируйте на Скальных высотах'
  }),
  Object.freeze({
    id: 'lift_lever_top',
    type: 'lift_lever',
    x: -8.20,
    y: 17.65,
    z: 121.00,
    layer: 'upper_lift_walkway',
    radius: 2.35,
    stateKey: 'liftUnlocked',
    setsState: 'liftUnlocked',
    targetFloor: 'top',
    title: 'Рычаг Противовеса Клети (SC-2)',
    prompt: 'Освободить противовес и запустить подъёмник',
    activatedPrompt: 'Отправить клеть подъёмника'
  }),
  Object.freeze({
    id: 'lift_cage_switch',
    type: 'lift_platform',
    x: RIVER_REACH_LIFT_CX,
    y: RIVER_REACH_LIFT_MIN_Y,
    z: RIVER_REACH_LIFT_CZ,
    layer: 'lift_cage',
    radius: 1.85,
    stateKey: 'liftUnlocked',
    title: 'Кованая Клеть Подъёмника',
    prompt: 'Запустить подъёмник'
  }),

  // --- SC-3: Monastery Bell-Tower Flank Shortcut (8.4 <-> 6.4) ---
  Object.freeze({
    id: 'monastery_shortcut_gate',
    type: 'shortcut_gate',
    x: -13.00,
    y: 27.50,
    z: 266.00,
    layer: 'monastery_shortcut',
    radius: 2.35,
    stateKey: 'monasteryShortcutUnlocked',
    title: 'Южные Врата Башни Монастыря (SC-3)',
    lockedPrompt: 'Закрыто со стороны Заброшенного Монастыря',
    unlockedPrompt: 'Врата короткого пути открыты'
  }),
  Object.freeze({
    id: 'monastery_shortcut_lever',
    type: 'shortcut_lever',
    x: -11.40,
    y: 27.83,
    z: 269.00,
    layer: 'monastery_shortcut',
    radius: 2.30,
    stateKey: 'monasteryShortcutUnlocked',
    setsState: 'monasteryShortcutUnlocked',
    title: 'Рычаг Башни Монастыря (SC-3)',
    prompt: 'Открыть короткий путь к Скальным высотам',
    activatedPrompt: 'Врата короткого пути подняты'
  }),

  // --- SC-4: Hunter Camp Kick-Down Log Bridge (5.1 <-> 3.5) ---
  Object.freeze({
    id: 'camp_log_shortcut',
    type: 'shortcut_lever',
    x: 43.00,
    y: 13.50,
    z: 117.50,
    layer: 'sector05',
    radius: 2.35,
    stateKey: 'logShortcutUnlocked',
    setsState: 'logShortcutUnlocked',
    title: 'Подгнивший Ствол над Оврагом (SC-4)',
    prompt: 'Столкнуть бревно к Дозорному утёсу',
    activatedPrompt: 'Переправа в Рыбацкое поселение открыта'
  }),

  // --- 5 Secret Chests & Relics Across Region I ---
  Object.freeze({
    id: 'shoal_ford_chest',
    type: 'chest',
    x: 19.00,
    y: 0.25,
    z: 29.00,
    layer: 'river_ford',
    radius: 2.15,
    poi: '1.6',
    title: 'Сундук Речного Брода',
    prompt: 'Открыть окованный сундук',
    rewardId: 'ashen_ember_shard',
    loreText: '«Контрабандисты переправлялись вброд по лунным камням, когда воды Лунного Стока отступали к полуночи.»'
  }),
  Object.freeze({
    id: 'wrecked_barge_chest',
    type: 'chest',
    x: 64.00,
    y: 0.85,
    z: 32.00,
    layer: 'sector03',
    radius: 2.20,
    poi: '3.6',
    title: 'Тайник Разбитой Баржи',
    prompt: 'Обыскать остов баржи',
    rewardId: 'mariners_silver_talisman',
    loreText: '«Последний груз серебряных наконечников так и не дошёл до Замка Пепла — река забрала баржу у северного водопада.»'
  }),
  Object.freeze({
    id: 'forest_ruins_chest',
    type: 'chest',
    x: 64.00,
    y: 15.20,
    z: 152.00,
    layer: 'sector05',
    radius: 2.20,
    poi: '5.5',
    title: 'Сундук Лесных Руин',
    prompt: 'Открыть охотничий тайник',
    rewardId: 'hunters_oiled_whetstone',
    loreText: '«Охотники держали здесь смоляное масло и запасы стали перед ночным восхождением к древнему амфитеатру.»'
  }),
  Object.freeze({
    id: 'eagle_cave_chest',
    type: 'chest',
    x: -30.00,
    y: 14.50,
    z: 152.00,
    layer: 'sector06',
    radius: 2.20,
    poi: '6.5',
    title: 'Реликвия Орлиной Пещеры',
    prompt: 'Забрать древнюю реликвию',
    rewardId: 'basalt_crest_ring',
    loreText: '«Ветра Скальных высот вырезали в базальте грот, где дозорные прятали печать ордена.»'
  }),
  Object.freeze({
    id: 'crypt_relic_shrine',
    type: 'chest',
    x: -6.00,
    y: 19.80,
    z: 206.00,
    layer: 'sector07',
    radius: 2.25,
    poi: '7.4',
    title: 'Алтарь Подземного Склепа',
    prompt: 'Принять древнюю реликвию',
    rewardId: 'monastery_sanctum_seal',
    loreText: '«Под плитами колокольни покоятся хранители, чья кровь сдерживала тьму Заброшенного Монастыря.»'
  }),

  // --- Sector 08 Cathedral Boss Altar (8.3) & Region II Citadel Finale Gate (8.5) ---
  Object.freeze({
    id: 'cathedral_boss_altar',
    type: 'boss_altar',
    x: 12.00,
    y: 29.00,
    z: 294.00,
    layer: 'sector08',
    radius: 3.10,
    poi: '8.3',
    title: 'Алтарь Заброшенного Монастыря',
    prompt: 'Возложить клятву на соборный алтарь',
    loreText: '«Здесь, под расколотыми сводами, ждёт Хранитель Пепельного Обета. Лишь победивший его откроет путь к Цитадели.»'
  }),
  Object.freeze({
    id: 'region2_citadel_gate',
    type: 'region_gate',
    x: 12.00,
    y: 31.50,
    z: 316.00,
    layer: 'sector08',
    radius: 2.85,
    poi: '8.5',
    title: 'Северные Врата Цитадели (Регион II)',
    prompt: 'Осмотреть печать Северной Цитадели',
    lockedPrompt: 'Врата Региона II запечатаны — за ними лежат Верхние Бастионы Цитадели',
    loreText: '«За Речным Пределом начинается путь в сердце проклятой Цитадели. Охота лишь разгорается.»'
  }),

  // --- Atmospheric Vistas & Lore Markers ---
  Object.freeze({
    id: 'sunken_chapel_lore',
    type: 'lore',
    x: 56.00,
    y: 1.35,
    z: 40.00,
    layer: 'sector03',
    radius: 2.25,
    title: 'Затопленная Часовня Рыбаков',
    prompt: 'Прочесть выцветший псалом',
    loreText: '«Когда колокол над обрывом умолк, вода поднялась до алтаря, но фонари на причале всё ещё ждут лодок.»'
  }),
  Object.freeze({
    id: 'camp_overlook_vista',
    type: 'vista',
    x: 28.00,
    y: 12.80,
    z: 128.00,
    layer: 'sector05',
    radius: 2.30,
    title: 'Утёс над Речным Трактом',
    prompt: 'Оглядеть всю долину Речного Предела',
    loreText: '«Внизу блестит Фонарная набережная и Башня Перевала, а на западе темнеют подмостки Скальных высот.»'
  }),
  Object.freeze({
    id: 'bell_tower_lore',
    type: 'lore',
    x: 12.00,
    y: 23.50,
    z: 208.00,
    layer: 'sector07',
    radius: 2.50,
    title: 'Разбитая Готическая Колокольня',
    prompt: 'Осмотреть расколотый колокол',
    loreText: '«Последний удар этого колокола возвестил падение Замка Пепла и разбудил эхо над Великим Виадуком.»'
  })
]);

// Complete Region I Interactables (6 Bonfires, SC-1..SC-4, Lift Controls, 5 Secret Chests, Boss Altar, Region II Gate)
export const RIVER_REACH_INTERACTABLES = Object.freeze([
  Object.freeze({
    id: 'shore_bonfire',
    type: 'bonfire',
    x: -2.20,
    y: evalCoreGorgeBaseTerrainY(-2.20, 15.00),
    z: 15.00,
    layer: 'main',
    radius: 2.35,
    sector: '01',
    title: 'Костёр Пепельного Стока',
    prompt: 'Отдохнуть у костра'
  }),
  Object.freeze({
    id: 'shortcut_gate',
    type: 'shortcut_gate',
    x: -9.50,
    y: 4.20,
    z: 52.00,
    layer: 'upper_terrace',
    radius: 2.25,
    stateKey: 'shortcutUnlocked',
    title: 'Кованые Ворота Утёса (SC-1)',
    lockedPrompt: 'Закрыто с другой стороны',
    unlockedPrompt: 'Ворота открыты'
  }),
  Object.freeze({
    id: 'shortcut_lever',
    type: 'shortcut_lever',
    x: -9.60,
    y: 4.20,
    z: 53.50,
    layer: 'upper_terrace',
    radius: 2.15,
    stateKey: 'shortcutUnlocked',
    setsState: 'shortcutUnlocked',
    title: 'Рычаг Короткого Пути (SC-1)',
    prompt: 'Потянуть рычаг ворот',
    activatedPrompt: 'Механизм ворот опущен'
  }),
  Object.freeze({
    id: 'watchtower_bonfire',
    type: 'bonfire',
    x: 0.65,
    y: 2.65,
    z: 111.20,
    layer: 'main',
    radius: 2.40,
    sector: '04',
    title: 'Костёр Башни Перевала',
    prompt: 'Отдохнуть у костра'
  }),
  ...RIVER_REACH_EXTENDED_INTERACTABLES
]);
