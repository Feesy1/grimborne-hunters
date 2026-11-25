// Grimborne Hunters — Dark Souls / Bloodborne Multi-Elevation Interconnected Gorge Topology
// «Ущелье Лунного Стока» (Zones 0–3, z = -16 .. +124m, 6 Interconnected Walkable Layers)
// Pure Vanilla ES Module (Three.js r160 compatible, ZERO dependencies, ZERO per-frame GC allocations).
//
// Coordinate Convention (100% compatible with Zone 0 soulsExteriorShore.js):
//   +Z = forward North away from Castle of Ash (shore -> archway -> lantern road -> watchtower)
//   +X = screen-LEFT  (East / Moonlit River side)
//   -X = screen-RIGHT (West / Basalt Cliff & Upper Chapel side)
//   +Y = vertical elevation (0.000m exact at wakePos = (0, 0, 2.5))
//
// Interconnected Multi-Elevation Layers (Single Source of Truth):
//   1. 'main'          — Zone 0 Shore (z<=31), Zone 1 Ancient Archway Road (z=31..59),
//                        Zone 2 Lantern Road (z=59..98, passing DIRECTLY UNDER Aqueduct Bridge at z=82, y≈1.28m),
//                        Zone 3 Watchtower Lower Courtyard & Crypt Nook (z=98..120, y=2.65m).
//   2. 'river_shoal'   — Branch A: Lower Riverbank Smuggler's Shoal (z=36..60, +X side y≈0.08..0.28m),
//                        descending mossy stone steps near z=37, winding around mossy boulders outside
//                        the Archway left ivy wing wall to Hidden River Shrine (+4.8, 53.5), looping back at z=59.
//   3. 'grotto'        — Branch C: Cliffside Smuggler's Grotto Chamber (-X carved cliff at z=84..92),
//                        torchlit Gothic entrance at (-4.2, 88.5, y=1.45m), two-flight stone switchback
//                        staircase rising smoothly from y=1.45m -> 3.55m -> 5.60m onto Upper Aqueduct Bridge.
//   4. 'bridge'        — Monumental Gothic Stone Aqueduct Bridge (z=80.3..83.7, x=-11.8..+5.5, y=5.60m),
//                        true 3D vertical overlap 4.32m overhead above Lantern Road, with East River
//                        Overlook Balcony (+4.8, 5.60, 82.0) gazing over the river rapids & full moon.
//   5. 'upper_terrace' — Branch B: Upper Cliffside Ruined Chapel Terrace (x=-12.4..-7.8, z=52..80.3,
//                        stepping y=5.60m -> 4.90m -> 4.20m) + Shortcut Lever (-9.6, 4.20, 53.5) +
//                        one-way Iron_Shortcut_Gate (-9.5, 4.20, 52.0) + Cliffside Shortcut Staircase
//                        descending behind Twin Columns (z=52..44.4, y=4.20m -> 0.78m) back to Zone 1 Campfire!
//   6. 'bastion_upper' — Zone 3 Multi-Tier Watchtower Upper Rampart Walk (y=5.65m): stone ascent stair
//                        (x=-3.8..-1.4, z=103.5..109.5, y=2.65->5.65m) -> West Gallery (over Crypt Nook)
//                        -> North Portcullis Parapet (z=116.2..119.4) -> East River-Overlook Rampart Walk
//                        (x=+2.8..+6.2, z=103.8..119.4) overlooking the moonlit river gorge & Castle of Ash.

export const WATER_LEVEL = -0.10;

import {
  RIVER_REACH_LIFT_MIN_Y,
  RIVER_REACH_LIFT_MAX_Y,
  RIVER_REACH_LIFT_CENTER,
  evalRiverReachBaseTerrainY,
  resolveRiverReachLayer,
  evalRiverReachGroundY,
  evalRiverReachSurfaceType,
  clampRiverReachPosition,
  getRiverReachZoneTitleAt,
  getRiverReachLiftY,
  RIVER_REACH_STATIC_COLLIDERS,
  RIVER_REACH_ANCHORS,
  RIVER_REACH_FIRE_SOURCES,
  RIVER_REACH_EXTENDED_FIRE_SOURCES,
  RIVER_REACH_INTERACTABLES,
  RIVER_REACH_EXTENDED_INTERACTABLES
} from './soulsRiverReachTopology.js?v=20261125z105';

export {
  RIVER_REACH_LIFT_MIN_Y,
  RIVER_REACH_LIFT_MAX_Y,
  RIVER_REACH_LIFT_CENTER,
  evalRiverReachBaseTerrainY,
  resolveRiverReachLayer,
  evalRiverReachGroundY,
  evalRiverReachSurfaceType,
  clampRiverReachPosition,
  getRiverReachZoneTitleAt,
  getRiverReachLiftY,
  RIVER_REACH_STATIC_COLLIDERS,
  RIVER_REACH_ANCHORS,
  RIVER_REACH_FIRE_SOURCES,
  RIVER_REACH_INTERACTABLES
};

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
// Shared Architectural Dimensions & Elevation Constants (Single Source of Truth)
// ============================================================================
const BRIDGE_Y = 5.60;
const BRIDGE_Z_MIN = 80.30;
const BRIDGE_Z_MAX = 83.70;
const BRIDGE_X_MIN = -12.20;
const BRIDGE_X_MAX = 5.50;
const BRIDGE_BALCONY_X_MIN = 3.00;
const BRIDGE_BALCONY_X_MAX = 5.80;
const BRIDGE_BALCONY_Z_MIN = 79.60;
const BRIDGE_BALCONY_Z_MAX = 84.40;
const BRIDGE_OVERLAP_SPLIT_Y = 3.45;

const GROTTO_LOWER_Y = 1.45;
const GROTTO_MID_Y = 3.55;
const GROTTO_DOOR_X = -4.20;
const GROTTO_DOOR_Z_MIN = 87.20;
const GROTTO_DOOR_Z_MAX = 90.40;
const GROTTO_F1_X_START = -6.80;
const GROTTO_F1_X_END = -10.80;
const GROTTO_F1_Z_MIN = 87.20;
const GROTTO_F1_Z_MAX = 90.00;
const GROTTO_F2_Z_MIN = 83.60;
const GROTTO_F2_Z_MAX = 86.40;
const GROTTO_MID_X_MIN = -13.20;
const GROTTO_EXIT_X_MAX = -4.40;

const TERRACE_X_MIN = -12.40;
const TERRACE_X_MAX = -7.80;
const TERRACE_NAVE_Y = 4.90;
const TERRACE_GATE_Y = 4.20;
const SHORTCUT_GATE_Z = 52.00;
const SHORTCUT_GATE_HALF_T = 0.40;
const SHORTCUT_GATE_SPLIT_Y = 3.98;

const SHORTCUT_STAIR_Z_START = 44.40;
const SHORTCUT_STAIR_Z_END = 52.00;
const SHORTCUT_STAIR_X_START = -7.40;
const SHORTCUT_STAIR_X_END = -9.50;
const SHORTCUT_STAIR_HALF_W = 1.65;
const SHORTCUT_STAIR_Y_START = 0.78;

const BASTION_LOWER_Y = 2.65;
const BASTION_UPPER_Y = 5.65;
const BASTION_OVERLAP_SPLIT_Y = 4.15;
const BASTION_STAIR_X_MIN = -3.80;
const BASTION_STAIR_X_MAX = -1.40;
const BASTION_STAIR_Z_START = 103.50;
const BASTION_STAIR_Z_END = 109.50;
const BASTION_NORTH_Z_MIN = 116.20;
const BASTION_NORTH_Z_MAX = 119.40;
const BASTION_EAST_X_MIN = 2.80;
const BASTION_EAST_X_MAX = 6.20;
const BASTION_EAST_Z_MIN = 103.80;

// ============================================================================
// Road Centerline & Moonlit River Course (100% Zone 0 Compatible for z <= 31)
// ============================================================================
export function getGorgePathCenterX(z) {
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

export function getGorgeRiverHalfWidth(z) {
  const pz = Number.isFinite(z) ? z : 2.5;
  const poolBoost = 1.0 - smoothstep(-14.0, -5.5, pz);
  const gorgeWiden = smoothstep(32.0, 68.0, pz) * 1.45 + smoothstep(95.0, 145.0, pz) * 1.25;
  return 4.65 + poolBoost * 1.35 + gorgeWiden + Math.sin(pz * 0.16 + 0.6) * 0.32;
}

export function getGorgeRiverCenterX(z) {
  const pz = Number.isFinite(z) ? z : 2.5;
  const t = clamp01((pz + 14.0) / 20.0);
  const s = t * t * (3.0 - 2.0 * t);
  const meander = Math.sin((pz - 4.0) * 0.115) * 1.45 * s;
  const drift = Math.max(0.0, Math.min(pz, 31.0) - 6.0) * 0.11;
  const baseShoreRcx = s * 10.6 + drift + meander;
  if (pz <= 30.0) return baseShoreRcx;

  const blendGorge = smoothstep(30.0, 41.0, pz);
  const pX = getGorgePathCenterX(pz);
  const rhw = getGorgeRiverHalfWidth(pz);
  // Natural rocky cove widening around Branch A Smuggler's Shoal (z = 36..58) so the shoal
  // shelf (+3.6..+6.0) stays dry-wet above WATER_LEVEL while hugging the rushing river!
  const shoalCoveOut = smoothstep(32.5, 40.5, pz) * (1.0 - smoothstep(56.5, 64.5, pz)) * 2.90;
  const bastionOut = smoothstep(93.0, 107.0, pz) * 4.4 + smoothstep(118.0, 154.0, pz) * 5.2;
  const gorgeMeander = Math.sin((pz - 34.0) * 0.085) * 0.65;
  const gorgeRcx = pX + 3.85 + rhw + shoalCoveOut + bastionOut + gorgeMeander;
  return lerp(baseShoreRcx, gorgeRcx, blendGorge);
}

export function getGorgeRiverSignedDist(x, z) {
  const px = Number.isFinite(x) ? x : 0.0;
  const pz = Number.isFinite(z) ? z : 2.5;
  const rcx = getGorgeRiverCenterX(pz);
  const rhw = getGorgeRiverHalfWidth(pz);
  const dRiver = Math.abs(px - rcx) - rhw;
  const dPool = Math.hypot((px - 0.35) * 0.92, pz + 10.5) - 5.5;
  return dRiver < dPool ? dRiver : dPool;
}

// ============================================================================
// Internal Analytical Sub-Layer Height & Geometry Helpers (Zero-GC)
// ============================================================================
function getShortcutStairCenterX(z) {
  const t = clamp01((z - SHORTCUT_STAIR_Z_START) / (SHORTCUT_STAIR_Z_END - SHORTCUT_STAIR_Z_START));
  return lerp(SHORTCUT_STAIR_X_START, SHORTCUT_STAIR_X_END, t);
}

function evalShortcutStairY(z) {
  const t = clamp01((z - SHORTCUT_STAIR_Z_START) / (SHORTCUT_STAIR_Z_END - SHORTCUT_STAIR_Z_START));
  return lerp(SHORTCUT_STAIR_Y_START, TERRACE_GATE_Y, t);
}

function evalUpperTerraceY(z) {
  if (z >= 73.0) return BRIDGE_Y;
  if (z >= 69.0) {
    const t = clamp01((z - 69.0) / 4.0);
    return lerp(TERRACE_NAVE_Y, BRIDGE_Y, t);
  }
  if (z >= 59.0) return TERRACE_NAVE_Y;
  if (z >= 55.5) {
    const t = clamp01((z - 55.5) / 3.5);
    return lerp(TERRACE_GATE_Y, TERRACE_NAVE_Y, t);
  }
  return TERRACE_GATE_Y;
}

function evalGrottoY(x, z) {
  // Upper Exit Landing (y = 5.60m) & Flight 2 (x = -10.8 -> -6.8, y = 3.55 -> 5.60m)
  if (z <= 86.75) {
    if (x >= GROTTO_F1_X_START) return BRIDGE_Y;
    if (x <= GROTTO_F1_X_END) return GROTTO_MID_Y;
    const t = clamp01((x - GROTTO_F1_X_END) / (GROTTO_F1_X_START - GROTTO_F1_X_END));
    return lerp(GROTTO_MID_Y, BRIDGE_Y, t);
  }
  // Mid-Landing west turnaround (x <= -10.8, y = 3.55m)
  if (x <= GROTTO_F1_X_END) return GROTTO_MID_Y;
  // Flight 1 (x = -6.8 -> -10.8, y = 1.45 -> 3.55m)
  if (x < GROTTO_F1_X_START && z <= 90.20) {
    const t = clamp01((GROTTO_F1_X_START - x) / (GROTTO_F1_X_START - GROTTO_F1_X_END));
    return lerp(GROTTO_LOWER_Y, GROTTO_MID_Y, t);
  }
  // Smooth threshold blend at Grotto doorway (x = -2.8 .. -4.6) from Lantern Road into Lower Chamber
  if (x > -4.60) {
    const baseY = evalBaseTerrainY(x, z);
    const blend = smoothstep(-2.80, -4.60, x);
    return lerp(baseY, GROTTO_LOWER_Y, blend);
  }
  return GROTTO_LOWER_Y;
}

function evalBastionStairY(z) {
  const t = clamp01((z - BASTION_STAIR_Z_START) / (BASTION_STAIR_Z_END - BASTION_STAIR_Z_START));
  return lerp(BASTION_LOWER_Y, BASTION_UPPER_Y, t);
}

function evalShoalMask(x, z) {
  if (z <= 36.0 || z >= 60.5 || x <= 2.0 || x >= 7.2) return 0.0;
  const zMask = smoothstep(36.2, 40.8, z) * (1.0 - smoothstep(56.2, 60.2, z));
  const xMask = smoothstep(2.1, 3.8, x) * (1.0 - smoothstep(5.9, 7.0, x));
  return zMask * xMask;
}

function isInsideBridgeFootprint(x, z, pad = 0.0) {
  const inMain =
    x >= BRIDGE_X_MIN - pad &&
    x <= BRIDGE_X_MAX + pad &&
    z >= BRIDGE_Z_MIN - pad &&
    z <= BRIDGE_Z_MAX + pad;
  if (inMain) return true;
  return (
    x >= BRIDGE_BALCONY_X_MIN - pad &&
    x <= BRIDGE_BALCONY_X_MAX + pad &&
    z >= BRIDGE_BALCONY_Z_MIN - pad &&
    z <= BRIDGE_BALCONY_Z_MAX + pad
  );
}

function isInsideBastionUpperFootprint(x, z, pad = 0.0) {
  // West Gallery (over Crypt Nook)
  if (
    x >= BASTION_STAIR_X_MIN - pad &&
    x <= BASTION_STAIR_X_MAX + pad &&
    z >= BASTION_STAIR_Z_END - 0.3 - pad &&
    z <= BASTION_NORTH_Z_MAX + pad
  ) {
    return true;
  }
  // North Portcullis Parapet
  if (
    x >= BASTION_STAIR_X_MIN - pad &&
    x <= BASTION_EAST_X_MAX + pad &&
    z >= BASTION_NORTH_Z_MIN - pad &&
    z <= BASTION_NORTH_Z_MAX + pad
  ) {
    return true;
  }
  // East River-Overlook Rampart Walk
  return (
    x >= BASTION_EAST_X_MIN - pad &&
    x <= BASTION_EAST_X_MAX + pad &&
    z >= BASTION_EAST_Z_MIN - pad &&
    z <= BASTION_NORTH_Z_MAX + pad
  );
}

function isInsideBastionStairFootprint(x, z, pad = 0.0) {
  return (
    x >= BASTION_STAIR_X_MIN - pad &&
    x <= BASTION_STAIR_X_MAX + pad &&
    z >= BASTION_STAIR_Z_START - pad &&
    z <= BASTION_STAIR_Z_END + pad
  );
}

function isInsideUpperTerraceDeck(x, z, pad = 0.0) {
  return (
    x >= TERRACE_X_MIN - pad &&
    x <= TERRACE_X_MAX + pad &&
    z >= SHORTCUT_GATE_Z - 0.1 - pad &&
    z <= BRIDGE_Z_MIN + 0.5 + pad
  );
}

function isInsideShortcutStair(x, z, pad = 0.0) {
  if (z < SHORTCUT_STAIR_Z_START - pad || z > SHORTCUT_STAIR_Z_END + pad) return false;
  const cx = getShortcutStairCenterX(z);
  return Math.abs(x - cx) <= SHORTCUT_STAIR_HALF_W + pad;
}

function isInsideGrottoFootprint(x, z, currentY) {
  // Upper exit archway (z = 83.6..86.4, x = -6.8..-4.4): only active when elevated
  if (x >= -6.85 && x <= GROTTO_EXIT_X_MAX && z >= GROTTO_F2_Z_MIN - 0.1 && z <= GROTTO_F2_Z_MAX + 0.1) {
    return currentY >= 3.50;
  }
  // Mid-landing & Flight 2 (x <= -6.8, z = 83.6..86.5)
  if (x >= GROTTO_MID_X_MIN - 0.4 && x <= -6.65 && z >= GROTTO_F2_Z_MIN - 0.2 && z <= 86.75) {
    return true;
  }
  // Mid-landing west turnaround & Flight 1 (x <= -6.65, z = 86.75..90.2)
  if (x >= GROTTO_MID_X_MIN - 0.4 && x <= -6.65 && z >= 86.75 && z <= 90.25) {
    return true;
  }
  // Lower chamber + doorway apron (x = -7.0..-4.2, z = 87.0..92.1)
  if (x >= -7.05 && x <= GROTTO_DOOR_X && z >= 87.05 && z <= 92.05) {
    return true;
  }
  return false;
}

// ============================================================================
// Continuous Analytical Base Terrain Heightfield (Terrain Mesh + Base Ground)
// Guaranteed BIT-FOR-BIT match with Zone 0 (z <= 31.0), exact 0.000m at (0, 2.5)!
// ============================================================================
export function evalBaseTerrainY(x, z) {
  return evalRiverReachBaseTerrainY(x, z);
}

// ============================================================================
// Multi-Layer Resolution & Elevation Solver (True 3D Vertical Overlap!)
// ============================================================================
export function resolveGorgeLayer(x, z, currentY = 0, state = null) {
  const px = Number.isFinite(x) ? x : 0.0;
  const pz = Number.isFinite(z) ? z : 2.5;
  const cy = Number.isFinite(currentY) ? currentY : 0.0;

  // 0. Delegate seamlessly to Region I 8-Sector River Reach extended layers (P02, P03, P07, P08, SC-2 Lift, Sectors 03..08)
  const extLayer = resolveRiverReachLayer(px, pz, cy, state);
  if (extLayer !== null) {
    return extLayer;
  }

  // 1. Zone 3 Upper Watchtower Bastion Rampart Walk & Staircase
  if (pz >= 102.5) {
    if (isInsideBastionStairFootprint(px, pz, 0.15)) {
      const stairY = evalBastionStairY(pz);
      if (cy >= stairY - 0.95 || pz <= BASTION_STAIR_Z_START + 1.05) {
        return 'bastion_upper';
      }
    }
    if (cy >= BASTION_OVERLAP_SPLIT_Y && isInsideBastionUpperFootprint(px, pz, 0.35)) {
      return 'bastion_upper';
    }
  }

  // 2. Monumental Aqueduct Bridge (z = 80.3..83.7, y = 5.60m, overlapping Lantern Road at y ≈ 1.28m!)
  if (cy >= BRIDGE_OVERLAP_SPLIT_Y && isInsideBridgeFootprint(px, pz, 0.25)) {
    return 'bridge';
  }

  // 3. Branch C: Cliffside Smuggler's Grotto Chamber & Two-Flight Staircase (z = 83.5..92.2)
  if (isInsideGrottoFootprint(px, pz, cy)) {
    return 'grotto';
  }

  // 4. Branch B: Upper Cliffside Ruined Chapel Terrace (z = 52.0..80.5, x = -12.4..-7.8)
  if (
    isInsideUpperTerraceDeck(px, pz, 0.25) &&
    (cy >= 2.80 || px <= -7.95)
  ) {
    return 'upper_terrace';
  }

  // 5. Branch B (lower flight): Cliffside Shortcut Staircase behind Twin Columns (z = 44.4..52.0)
  if (isInsideShortcutStair(px, pz, 0.20)) {
    const stY = evalShortcutStairY(pz);
    if (cy >= stY - 1.15 || pz <= SHORTCUT_STAIR_Z_START + 1.2) {
      return 'upper_terrace';
    }
  }

  // 6. Branch A: Lower Riverbank Smuggler's Shoal (z = 36.2..60.0, +X side)
  if (evalShoalMask(px, pz) >= 0.22) {
    return 'river_shoal';
  }

  return 'main';
}

export function evalGorgeGroundY(x, z, currentY = 0, state = null) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return 0.0;
  const cy = Number.isFinite(currentY) ? currentY : 0.0;
  const layer = resolveGorgeLayer(x, z, cy, state);

  if (
    layer === 'lift_cage' ||
    layer === 'upper_lift_walkway' ||
    layer === 'aqueduct_east' ||
    layer === 'river_ford' ||
    layer === 'sector03' ||
    layer === 'sector05' ||
    layer === 'sector06' ||
    layer === 'monastery_shortcut' ||
    layer === 'sector07' ||
    layer === 'sector08'
  ) {
    return evalRiverReachGroundY(x, z, cy, state);
  }

  if (layer === 'bridge') {
    return BRIDGE_Y;
  }
  if (layer === 'grotto') {
    return evalGrottoY(x, z);
  }
  if (layer === 'upper_terrace') {
    if (z < SHORTCUT_GATE_Z) {
      return evalShortcutStairY(z);
    }
    return evalUpperTerraceY(z);
  }
  if (layer === 'bastion_upper') {
    if (z <= BASTION_STAIR_Z_END && x <= BASTION_STAIR_X_MAX + 0.15) {
      return evalBastionStairY(z);
    }
    return BASTION_UPPER_Y;
  }

  // Smooth threshold ramp approaching Grotto doorway from Lantern Road (x = -4.2..-2.8, z = 87.2..90.4)
  if (
    layer === 'main' &&
    x < -2.80 &&
    x > GROTTO_DOOR_X &&
    z >= GROTTO_DOOR_Z_MIN &&
    z <= GROTTO_DOOR_Z_MAX
  ) {
    return evalGrottoY(x, z);
  }

  return evalBaseTerrainY(x, z);
}

export function evalGorgeSurfaceType(x, z, currentY = 0, state = null) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return 'gravel';
  const cy = Number.isFinite(currentY) ? currentY : 0.0;
  const layer = resolveGorgeLayer(x, z, cy, state);

  if (
    layer === 'lift_cage' ||
    layer === 'upper_lift_walkway' ||
    layer === 'aqueduct_east' ||
    layer === 'river_ford' ||
    layer === 'sector03' ||
    layer === 'sector05' ||
    layer === 'sector06' ||
    layer === 'monastery_shortcut' ||
    layer === 'sector07' ||
    layer === 'sector08'
  ) {
    return evalRiverReachSurfaceType(x, z, cy, state);
  }

  if (layer === 'bridge' || layer === 'bastion_upper') {
    return 'stone_bridge';
  }
  if (layer === 'grotto' || layer === 'upper_terrace') {
    return 'stone_courtyard';
  }

  const y = evalBaseTerrainY(x, z);
  const rDist = getGorgeRiverSignedDist(x, z);
  if (y <= WATER_LEVEL + 0.035 || rDist <= 0.35) {
    return 'shallow_water';
  }
  if (layer === 'river_shoal') {
    return rDist <= 0.85 ? 'shallow_water' : 'wet_stone';
  }

  const pathX = getGorgePathCenterX(z);
  const inCourtyard = z >= 100.0 && z <= 121.0 && x >= -8.6 && x <= 6.6;
  const onTrail = z >= 5.0 && z <= 121.5 && Math.abs(x - pathX) <= (z > 31.0 ? 3.1 : 2.35);
  const nearGate = Math.hypot(x, z - 31.0) <= 4.4;
  const nearShoalRim = rDist <= 2.15 || Math.hypot(x, z - 2.5) <= 2.1;
  if (inCourtyard || onTrail || nearGate || nearShoalRim) {
    return 'wet_stone';
  }
  return 'gravel';
}

export function getGorgeZoneTitleAt(x, z, y = 0) {
  return getRiverReachZoneTitleAt(x, z, y);
}

// ============================================================================
// Layer-Tagged Static Colliders (100% Consistent With Placed 3D Props!)
// ============================================================================
export const EXTERIOR_ZONE0_COLLIDERS = Object.freeze([
  Object.freeze({ id: 'shore_bonfire', x: -2.20, z: 15.00, r: 1.18, layer: 'main', yMin: -2.0, yMax: 4.0 }),
  Object.freeze({ id: 'gate0_pier_r', x: -3.85, z: 31.00, r: 1.48, layer: 'main', yMin: -2.0, yMax: 8.0 }),
  Object.freeze({ id: 'gate0_pier_l', x:  3.85, z: 31.00, r: 1.48, layer: 'main', yMin: -2.0, yMax: 8.0 }),
  Object.freeze({ id: 'gate0_brazier_r', x: -3.55, z: 29.30, r: 0.66, layer: 'main', yMin: -2.0, yMax: 4.5 }),
  Object.freeze({ id: 'gate0_brazier_l', x:  3.55, z: 29.30, r: 0.66, layer: 'main', yMin: -2.0, yMax: 4.5 }),
  Object.freeze({ id: 'pilgrim_arch_r', x: -4.40, z: 10.60, r: 1.05, layer: 'main', yMin: -2.0, yMax: 7.0 }),
  Object.freeze({ id: 'pilgrim_arch_l', x:  3.80, z: 10.60, r: 1.05, layer: 'main', yMin: -2.0, yMax: 7.0 }),
  Object.freeze({ id: 'shore_monolith', x: -5.00, z: 16.40, r: 0.72, layer: 'main', yMin: -2.0, yMax: 5.0 }),
  Object.freeze({ id: 'shore_rock_1', x: -8.60, z:  0.80, r: 1.45, layer: 'main', yMin: -2.0, yMax: 5.0 }),
  Object.freeze({ id: 'shore_rock_2', x: -9.40, z:  8.50, r: 1.55, layer: 'main', yMin: -2.0, yMax: 5.0 }),
  Object.freeze({ id: 'shore_rock_3', x: -9.80, z: 18.80, r: 1.60, layer: 'main', yMin: -2.0, yMax: 5.0 }),
  Object.freeze({ id: 'shore_rock_4', x: -8.80, z: 26.40, r: 1.55, layer: 'main', yMin: -2.0, yMax: 5.0 }),
  Object.freeze({ id: 'shore_rock_5', x: -5.40, z: -2.60, r: 1.35, layer: 'main', yMin: -2.0, yMax: 5.0 }),
  Object.freeze({ id: 'shore_rock_6', x:  6.40, z: 23.20, r: 1.25, layer: 'main', yMin: -2.0, yMax: 5.0 }),
  Object.freeze({ id: 'shore_rock_7', x: -6.20, z:  5.80, r: 1.20, layer: 'main', yMin: -2.0, yMax: 5.0 })
]);

export const GORGE_STATIC_COLLIDERS = Object.freeze([
  // Zone 1: Ancient Archway Road (main layer)
  Object.freeze({ id: 'z1_gnarled_tree', x: -6.20, z: 39.00, r: 0.95, layer: 'main', yMin: -1.0, yMax: 8.0 }),
  Object.freeze({ id: 'z1_campfire_1', x: -2.95, z: 45.20, r: 0.95, layer: 'main', yMin: -1.0, yMax: 3.5 }),
  Object.freeze({ id: 'z1_fallen_log_1', x: -4.45, z: 46.50, r: 0.72, layer: 'main', yMin: -1.0, yMax: 3.0 }),
  Object.freeze({ id: 'z1_twin_column_1', x: -5.60, z: 46.10, r: 0.72, layer: 'main', yMin: -1.0, yMax: 7.5 }),
  Object.freeze({ id: 'z1_twin_column_2', x: -6.00, z: 49.40, r: 0.72, layer: 'main', yMin: -1.0, yMax: 6.5 }),
  // Open Ivy-Draped Ancient Archway at (-0.6, 55.5) — EXACT 4.60m clear road opening (-2.90 .. +1.70)!
  Object.freeze({ id: 'z1_arch_pier_r', x: -3.85, z: 55.50, r: 0.95, layer: 'main', yMin: -1.0, yMax: 8.5 }),
  Object.freeze({ id: 'z1_arch_pier_l', x:  2.65, z: 55.50, r: 0.95, layer: 'main', yMin: -1.0, yMax: 8.5 }),
  // Left ivy wing wall separating Main Road from Branch A River Shoal bypass (outer edge +4.03)
  Object.freeze({ id: 'z1_arch_wing_l', x:  3.55, z: 55.40, r: 0.48, layer: 'both_low', yMin: -1.0, yMax: 5.5 }),
  Object.freeze({ id: 'z1_arch_dead_tree', x: -5.35, z: 54.50, r: 0.80, layer: 'main', yMin: -1.0, yMax: 7.5 }),

  // Branch A: Lower Riverbank Smuggler's Shoal mossy boulders & hidden shrine pedestal
  Object.freeze({ id: 'shoal_boulder_1', x:  3.20, z: 45.80, r: 0.78, layer: 'both_low', yMin: -1.0, yMax: 3.0 }),
  Object.freeze({ id: 'shoal_boulder_2', x:  5.85, z: 49.20, r: 0.72, layer: 'river_shoal', yMin: -1.0, yMax: 3.0 }),
  Object.freeze({ id: 'shoal_shrine_pedestal', x:  4.05, z: 53.50, r: 0.52, layer: 'river_shoal', yMin: -1.0, yMax: 3.0 }),

  // Zone 2: Lantern Road (main layer, passes UNDER Aqueduct Bridge at z = 82.0!)
  Object.freeze({ id: 'z2_lantern_1', x: -4.05, z: 66.20, r: 0.36, layer: 'main', yMin: -1.0, yMax: 5.5 }),
  Object.freeze({ id: 'z2_campfire_2', x: -3.55, z: 71.20, r: 0.95, layer: 'main', yMin: -1.0, yMax: 3.5 }),
  Object.freeze({ id: 'z2_fallen_log_2', x: -5.45, z: 71.60, r: 0.80, layer: 'main', yMin: -1.0, yMax: 3.0 }),
  Object.freeze({ id: 'z2_banner_column', x: -6.15, z: 73.10, r: 0.78, layer: 'main', yMin: -1.0, yMax: 6.0 }),
  Object.freeze({ id: 'z2_lantern_2', x: -4.15, z: 75.40, r: 0.36, layer: 'main', yMin: -1.0, yMax: 5.5 }),
  // Monumental Stone Aqueduct Bridge support piers (7.20m clear road arch underneath, NEVER blocks bridge deck!)
  Object.freeze({ id: 'z2_bridge_pier_r', x: -5.65, z: 82.00, r: 1.15, layer: 'main', yMin: -1.0, yMax: 4.8 }),
  Object.freeze({ id: 'z2_bridge_pier_l', x:  3.85, z: 82.00, r: 1.15, layer: 'main', yMin: -1.0, yMax: 4.8 }),
  Object.freeze({ id: 'z2_lantern_3', x: -2.95, z: 84.20, r: 0.36, layer: 'main', yMin: -1.0, yMax: 5.5 }),
  // Torchlit Gothic Grotto Entry Doorway jambs at (-4.2, 88.5) — 3.20m clear doorway opening!
  Object.freeze({ id: 'z2_grotto_jamb_s', x: -4.20, z: 86.75, r: 0.45, layer: 'main', yMin: -1.0, yMax: 5.0 }),
  Object.freeze({ id: 'z2_grotto_jamb_n', x: -4.20, z: 90.85, r: 0.45, layer: 'main', yMin: -1.0, yMax: 5.0 }),
  Object.freeze({ id: 'z2_river_crag', x:  5.40, z: 88.60, r: 1.25, layer: 'main', yMin: -1.0, yMax: 4.5 }),
  Object.freeze({ id: 'z2_lantern_4', x: -1.45, z: 92.80, r: 0.36, layer: 'main', yMin: -1.0, yMax: 5.5 }),

  // Branch C: Grotto interior Lore Stone (tucked against north chamber wall, clear of stairs)
  Object.freeze({ id: 'grotto_lore_stone', x: -5.60, z: 91.20, r: 0.45, layer: 'grotto', yMin: 0.5, yMax: 4.0 }),

  // Branch B: Upper Cliffside Ruined Chapel Terrace altar & lever pedestal (tucked against west cliff wall)
  Object.freeze({ id: 'chapel_relic_altar', x: -11.85, z: 64.00, r: 0.48, layer: 'upper_terrace', yMin: 3.5, yMax: 8.0 }),
  Object.freeze({ id: 'shortcut_lever_post', x: -11.20, z: 53.50, r: 0.32, layer: 'upper_terrace', yMin: 3.5, yMax: 7.0 }),

  // Zone 3: Watchtower Bastion Lower Courtyard (main layer only — NEVER blocks bastion_upper!)
  Object.freeze({ id: 'z3_entry_pier_l', x:  5.25, z: 99.20, r: 1.15, layer: 'main', yMin: 0.0, yMax: 7.5 }),
  Object.freeze({ id: 'z3_entry_pier_r', x: -2.95, z: 99.20, r: 1.15, layer: 'main', yMin: 0.0, yMax: 7.5 }),
  Object.freeze({ id: 'z3_watchtower_bonfire', x:  0.65, z: 111.20, r: 1.05, layer: 'main', yMin: 1.5, yMax: 4.5 }),
  Object.freeze({ id: 'z3_crypt_lore_stone', x: -6.40, z: 111.00, r: 0.72, layer: 'main', yMin: 1.5, yMax: 5.0 }),
  Object.freeze({ id: 'z3_crypt_pillar_s', x: -3.20, z: 109.50, r: 0.72, layer: 'main', yMin: 1.5, yMax: 5.2 }),
  Object.freeze({ id: 'z3_crypt_pillar_n', x: -3.20, z: 115.80, r: 0.72, layer: 'main', yMin: 1.5, yMax: 5.2 }),
  Object.freeze({ id: 'z3_turret_se', x:  6.45, z: 107.40, r: 1.05, layer: 'main', yMin: 1.0, yMax: 9.0 }),
  Object.freeze({ id: 'z3_turret_ne', x:  6.30, z: 115.80, r: 1.05, layer: 'main', yMin: 1.0, yMax: 9.0 }),
  Object.freeze({ id: 'z3_portcullis_r', x: -2.45, z: 120.40, r: 1.25, layer: 'main', yMin: 1.0, yMax: 9.0 }),
  Object.freeze({ id: 'z3_portcullis_l', x:  4.05, z: 120.40, r: 1.25, layer: 'main', yMin: 1.0, yMax: 9.0 }),

  // Zone 3: Upper Bastion Rampart corner beacon brazier (tucked in SE parapet corner)
  Object.freeze({ id: 'z3_upper_beacon', x:  5.70, z: 104.50, r: 0.42, layer: 'bastion_upper', yMin: 5.0, yMax: 8.5 }),

  // Region I Extended Sectors (03, 05, 06, 07, 08) Static Colliders
  ...RIVER_REACH_STATIC_COLLIDERS
]);

// ============================================================================
// Zero-GC Multi-Rect Corridor Clamper Helpers
// ============================================================================
let _bestX = 0.0;
let _bestZ = 0.0;
let _bestDistSq = Infinity;
const _rrDelegateScratch = { x: 0.0, y: 0.0, z: 0.0, layer: 'main', surface: 'wet_stone' };

function resetUnionClamp() {
  _bestDistSq = Infinity;
}

function considerUnionRect(px, pz, minX, maxX, minZ, maxZ) {
  if (minX > maxX || minZ > maxZ) return false;
  const cx = px < minX ? minX : px > maxX ? maxX : px;
  const cz = pz < minZ ? minZ : pz > maxZ ? maxZ : pz;
  const dx = px - cx;
  const dz = pz - cz;
  const dSq = dx * dx + dz * dz;
  if (dSq < _bestDistSq) {
    _bestDistSq = dSq;
    _bestX = cx;
    _bestZ = cz;
  }
  return dSq === 0.0;
}

function considerDiagonalStairCorridor(px, pz, zMin, zMax, rad) {
  if (zMin > zMax) return false;
  const cz = pz < zMin ? zMin : pz > zMax ? zMax : pz;
  const centerX = getShortcutStairCenterX(cz);
  const halfW = Math.max(0.15, SHORTCUT_STAIR_HALF_W - rad);
  const minX = centerX - halfW;
  const maxX = centerX + halfW;
  const cx = px < minX ? minX : px > maxX ? maxX : px;
  const dx = px - cx;
  const dz = pz - cz;
  const dSq = dx * dx + dz * dz;
  if (dSq < _bestDistSq) {
    _bestDistSq = dSq;
    _bestX = cx;
    _bestZ = cz;
  }
  return dSq === 0.0;
}

function applyCircleColliders(px, pz, py, rad, layer, colliders) {
  let x = px;
  let z = pz;
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (py < c.yMin || py > c.yMax) continue;
    const matchesLayer =
      c.layer === layer ||
      (c.layer === 'both_low' && (layer === 'main' || layer === 'river_shoal'));
    if (!matchesLayer) continue;

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
  _bestX = x;
  _bestZ = z;
}

// ============================================================================
// Master Multi-Layer Position Clamper (Zero Teleports, Zero Invisible Walls)
// ============================================================================
export function clampGorgePosition(x, z, currentY = 0, r = 0.55, state = null, out = null) {
  let px = Number.isFinite(x) ? x : 0.0;
  let pz = Number.isFinite(z) ? z : 2.5;
  const cy = Number.isFinite(currentY) ? currentY : 0.0;
  const rad = Number.isFinite(r) ? Math.max(0.15, r) : 0.55;
  const shortcutUnlocked = Boolean(state && state.shortcutUnlocked);

  // 0. Delegate seamlessly to Region I 8-Sector River Reach extended layers
  //    (P02 Pier/Ford, P03 Fisherman's Bridge, P07 East Aqueduct, P08 Basalt Pass, SC-2 Lift, Sectors 03..08)
  const extLayer = resolveRiverReachLayer(px, pz, cy, state);
  if (extLayer !== null) {
    const target = out || _rrDelegateScratch;
    const res = clampRiverReachPosition(px, pz, cy, rad, state, target);
    if (res.layer !== 'main' && res.layer !== 'bridge') {
      if (out) return out;
      return { x: res.x, z: res.z, y: res.y, layer: res.layer, surface: res.surface };
    }
    px = res.x;
    pz = res.z;
  }

  let activeLayer = resolveGorgeLayer(px, pz, cy, state);

  // Guard: if player is ALREADY high up on an upper deck (bridge/terrace/grotto-upper/bastion_upper)
  // and pressed slightly past a parapet edge in (x, z), keep them on their elevated layer so they
  // slide cleanly along the stone parapet instead of dropping into the lower layer!
  if (activeLayer === 'main' || activeLayer === 'river_shoal') {
    if (pz >= 102.0 && cy >= BASTION_OVERLAP_SPLIT_Y) {
      activeLayer = 'bastion_upper';
    } else if (pz >= 78.2 && pz <= 86.2 && cy >= BRIDGE_OVERLAP_SPLIT_Y && px >= -13.6 && px <= 7.2) {
      activeLayer = pz > 83.75 && px < -4.0 ? 'grotto' : 'bridge';
    } else if (pz >= 50.5 && pz <= 81.2 && px <= -3.0 && cy >= 2.80) {
      activeLayer = 'upper_terrace';
    } else if (pz >= 83.2 && pz <= 93.2 && px <= -4.4 && cy >= 1.20) {
      activeLayer = 'grotto';
    }
  }

  // --------------------------------------------------------------------------
  // LAYER GROUP 1: Zone 3 Upper Watchtower Bastion Rampart Walk & Staircase
  // --------------------------------------------------------------------------
  if (activeLayer === 'bastion_upper') {
    // Allow seamless exit off bottom of staircase back onto Lower Courtyard (z < 103.5)
    if (pz < BASTION_STAIR_Z_START && cy <= 3.15 && px >= BASTION_STAIR_X_MIN - 0.5 && px <= BASTION_STAIR_X_MAX + 0.5) {
      activeLayer = 'main';
    } else {
      resetUnionClamp();
      // R_stair (open south at z=102.8 to descend back into courtyard; open north into West Gallery)
      let inside = considerUnionRect(
        px, pz,
        BASTION_STAIR_X_MIN + rad, BASTION_STAIR_X_MAX - rad,
        102.80, 110.20
      );
      // R_west (West Upper Gallery over Crypt Nook)
      if (!inside) {
        inside = considerUnionRect(
          px, pz,
          BASTION_STAIR_X_MIN + rad, BASTION_STAIR_X_MAX - rad,
          109.20, BASTION_NORTH_Z_MAX - rad
        );
      }
      // R_north (North Portcullis Parapet Walk)
      if (!inside) {
        inside = considerUnionRect(
          px, pz,
          BASTION_STAIR_X_MIN + rad, BASTION_EAST_X_MAX - rad,
          BASTION_NORTH_Z_MIN + rad, BASTION_NORTH_Z_MAX - rad
        );
      }
      // R_east (East River-Overlook Rampart Walk)
      if (!inside) {
        inside = considerUnionRect(
          px, pz,
          BASTION_EAST_X_MIN + rad, BASTION_EAST_X_MAX - rad,
          BASTION_EAST_Z_MIN + rad, BASTION_NORTH_Z_MAX - rad
        );
      }
      if (!inside) {
        px = _bestX;
        pz = _bestZ;
      }

      const preY = evalGorgeGroundY(px, pz, Math.max(cy, BASTION_LOWER_Y), state);
      applyCircleColliders(px, pz, preY, rad, 'bastion_upper', GORGE_STATIC_COLLIDERS);
      px = _bestX;
      pz = _bestZ;
    }
  }

  // --------------------------------------------------------------------------
  // LAYER GROUP 2: Interconnected Elevated Network (Grotto <-> Bridge <-> Upper Chapel <-> Shortcut Stairs)
  // --------------------------------------------------------------------------
  if (activeLayer === 'grotto' || activeLayer === 'bridge' || activeLayer === 'upper_terrace') {
    // Check clean horizontal exits back onto 'main' road:
    // (a) Exiting Grotto Lower Doorway back east onto Lantern Road (x > -4.2, z = 87.2..90.4, low Y)
    const exitingGrottoDoor =
      activeLayer === 'grotto' &&
      cy < 2.20 &&
      px > GROTTO_DOOR_X &&
      pz >= GROTTO_DOOR_Z_MIN + rad * 0.5 &&
      pz <= GROTTO_DOOR_Z_MAX - rad * 0.5;
    // (b) Descending Shortcut Stair foot back east onto Zone 1 Main Road (z <= 44.5, low Y)
    const exitingShortcutFoot =
      activeLayer === 'upper_terrace' &&
      cy < 1.35 &&
      pz <= SHORTCUT_STAIR_Z_START + 0.15 &&
      px >= -9.0;

    if (exitingGrottoDoor || exitingShortcutFoot) {
      activeLayer = 'main';
    } else {
      resetUnionClamp();
      let inside = false;

      // Determine whether player is on lower/mid Grotto vs upper elevated deck (for crisp separation
      // across the central grotto spine wall & locked Iron_Shortcut_Gate!)
      const onUpperSideOfGate = shortcutUnlocked || cy >= SHORTCUT_GATE_SPLIT_Y;
      const onLowerSideOfGate = shortcutUnlocked || cy < SHORTCUT_GATE_SPLIT_Y;

      // 1. Grotto Lower Chamber + Doorway + Flight 1 + Mid-Landing (ONLY active near Grotto z >= 81.5!)
      if (pz >= 81.5 && (cy <= 4.60 || (pz >= 83.4 && px <= -6.4))) {
        // G_doorway (connects seamlessly to Lantern Road at x = -4.2)
        if (cy <= 2.35) {
          inside = considerUnionRect(
            px, pz,
            -6.95, -2.50,
            GROTTO_DOOR_Z_MIN + rad, GROTTO_DOOR_Z_MAX - rad
          );
          // G_lower chamber (widens north to z = 92.0 for Lore Stone & crates)
          if (!inside) {
            inside = considerUnionRect(
              px, pz,
              -7.05, -4.55,
              GROTTO_DOOR_Z_MIN + rad, 92.00 - rad
            );
          }
        }
        // G_f1 (Flight 1 rising West: x = -6.8 -> -10.8, y = 1.45 -> 3.55m)
        if (!inside && cy <= 4.35) {
          inside = considerUnionRect(
            px, pz,
            -11.40, -6.40,
            GROTTO_F1_Z_MIN + rad, GROTTO_F1_Z_MAX - rad
          );
        }
        // G_mid (Mid-Landing turnaround: x = -13.2..-10.8, z = 83.6..90.0, y = 3.55m)
        if (!inside && cy >= 2.20 && cy <= 4.85) {
          inside = considerUnionRect(
            px, pz,
            GROTTO_MID_X_MIN + rad, -10.75,
            GROTTO_F2_Z_MIN + rad, GROTTO_F1_Z_MAX - rad
          );
        }
        // G_f2 (Flight 2 rising East: x = -10.8 -> -6.8, y = 3.55 -> 5.60m)
        if (!inside && cy >= 2.75) {
          inside = considerUnionRect(
            px, pz,
            -11.40, -6.35,
            GROTTO_F2_Z_MIN + rad, GROTTO_F2_Z_MAX - rad
          );
        }
      }

      // 2. Grotto Upper Exit + Stone Aqueduct Bridge + East Balcony + Upper Chapel Terrace (cy >= 3.45 or upper terrace)
      if (!inside && (cy >= 3.45 || (pz < 81.5 && pz >= SHORTCUT_GATE_Z - 0.5 && onUpperSideOfGate))) {
        // G_exit (Upper Grotto Archway landing at y = 5.60m opening south onto Bridge)
        if (cy >= 4.45) {
          inside = considerUnionRect(
            px, pz,
            -6.85, GROTTO_EXIT_X_MAX - rad,
            82.00, GROTTO_F2_Z_MAX - rad
          );
        }
        // B_span (Monumental Aqueduct Bridge main deck: x = -12.2..+5.5, z = 80.3..83.7, y = 5.60m)
        // Opens seamlessly east past x = +5.25 into P07 East Aqueduct Bridge Extension!
        if (!inside && cy >= BRIDGE_OVERLAP_SPLIT_Y) {
          inside = considerUnionRect(
            px, pz,
            BRIDGE_X_MIN + rad, 6.00,
            BRIDGE_Z_MIN + rad, BRIDGE_Z_MAX - rad
          );
        }
        // B_balcony (East River Overlook Balcony turret: x = +3.0..+5.8, z = 79.6..84.4, y = 5.60m)
        if (!inside && cy >= BRIDGE_OVERLAP_SPLIT_Y) {
          inside = considerUnionRect(
            px, pz,
            BRIDGE_BALCONY_X_MIN, BRIDGE_BALCONY_X_MAX - rad,
            BRIDGE_BALCONY_Z_MIN + rad, BRIDGE_BALCONY_Z_MAX - rad
          );
        }
        // T_main (Upper Cliffside Ruined Chapel Terrace: x = -12.4..-7.8, z = 52.0..81.5)
        // Enforces locked Iron_Shortcut_Gate at z = 52.0 (+0.40 + rad = 52.95) when !shortcutUnlocked!
        if (!inside && onUpperSideOfGate) {
          const terraceMinZ = shortcutUnlocked ? SHORTCUT_GATE_Z - 0.35 : SHORTCUT_GATE_Z + SHORTCUT_GATE_HALF_T + rad;
          inside = considerUnionRect(
            px, pz,
            TERRACE_X_MIN + rad, TERRACE_X_MAX - rad,
            terraceMinZ, BRIDGE_Z_MIN + 1.20
          );
        }
      }

      // 3. Cliffside Shortcut Staircase (z = 44.4..52.0) + Entry Apron (z = 42.4..45.2)
      // Enforces locked Iron_Shortcut_Gate at z = 52.0 (-0.40 - rad = 51.05) when !shortcutUnlocked!
      if (!inside && onLowerSideOfGate && pz <= 53.5) {
        const stairMaxZ = shortcutUnlocked ? SHORTCUT_STAIR_Z_END + 0.35 : SHORTCUT_GATE_Z - SHORTCUT_GATE_HALF_T - rad;
        inside = considerDiagonalStairCorridor(
          px, pz,
          SHORTCUT_STAIR_Z_START - 0.20,
          stairMaxZ,
          rad
        );
        // Entry apron connecting Stair Foot smoothly back onto Main Road
        if (!inside && cy <= 1.80) {
          inside = considerUnionRect(
            px, pz,
            -9.20 + rad, -4.00,
            42.40 + rad, 45.20 - rad
          );
        }
      }

      if (!inside) {
        px = _bestX;
        pz = _bestZ;
      }

      // Apply layer-specific static prop colliders (Grotto Lore Stone, Chapel Altar, Lever Post)
      const resolvedElevatedLayer = resolveGorgeLayer(px, pz, cy, state);
      const preY = evalGorgeGroundY(px, pz, cy, state);
      applyCircleColliders(px, pz, preY, rad, resolvedElevatedLayer, GORGE_STATIC_COLLIDERS);
      px = _bestX;
      pz = _bestZ;
    }
  }

  // --------------------------------------------------------------------------
  // LAYER GROUP 3: Base World ('main' Shore + Gorge Roads + Lower Courtyard & 'river_shoal')
  // --------------------------------------------------------------------------
  if (activeLayer === 'main' || activeLayer === 'river_shoal') {
    px = clamp(px, -24.0 + rad, 24.0 - rad);
    const inOpenPortcullisPre = px >= -1.20 && px <= 2.80;
    const inLowerLiftAlcove = px >= -7.40 && px <= -3.40;
    const zUpperBoundPre = inOpenPortcullisPre ? 121.50 : inLowerLiftAlcove ? 120.00 - rad : 120.2 - rad;
    pz = clamp(pz, -16.0 + rad, zUpperBoundPre);

    const minZWall = -4.2 + smoothstep(-8.0, 2.0, px) * 0.8 + rad;
    const maxZWall = inOpenPortcullisPre ? 121.50 : inLowerLiftAlcove ? 120.00 - rad : 119.65 - rad;
    if (pz < minZWall) pz = minZWall;
    if (pz > maxZWall) pz = maxZWall;

    // Right-side (-X) basalt cliff wall with clean diegetic openings for:
    //   1) Shortcut Stair Entry Apron (z = 42.4..45.2 -> opens to x = -9.2)
    //   2) Torchlit Smuggler's Grotto Doorway (z = 87.2..90.4 -> opens to x = -7.0)
    //   3) Watchtower Bastion Staircase entry (z = 101.5..104.6 -> x = -3.8)
    //   4) Watchtower Bastion Staircase solid flank wall (z = 104.6..109.5 -> x = -1.4 for low Y)
    //   5) Watchtower Cliffside Crypt Nook underpass (z = 109.5..115.8 -> opens to x = -8.5)
    //   6) SC-2 Lower Lift Station Alcove 4.5 (z = 116.4..120.0 -> opens to x = -7.4)
    const pathX = getGorgePathCenterX(pz);
    const shoreRightWall =
      -11.2 +
      (1.0 - smoothstep(-4.0, 4.0, pz)) * 3.0 +
      Math.sin(pz * 0.27) * 0.55;

    let gorgeRightWall = pathX - 4.75 + Math.sin(pz * 0.21) * 0.35;

    // Opening 1: Shortcut Stair Entry Apron (behind Campfire 1 & south of Twin Column #1)
    if (pz >= 42.2 && pz <= 45.4) {
      const apronOpen = smoothstep(42.2, 42.9, pz) * (1.0 - smoothstep(44.7, 45.4, pz));
      gorgeRightWall = lerp(gorgeRightWall, -9.20, apronOpen);
    }

    // Opening 2: Grotto Entrance Archway at z = 87.2..90.4
    if (pz >= 87.0 && pz <= 90.6) {
      const doorOpen = smoothstep(87.0, 87.4, pz) * (1.0 - smoothstep(90.2, 90.6, pz));
      gorgeRightWall = lerp(gorgeRightWall, -7.00, doorOpen);
    }

    // Zone 3 Watchtower Lower Courtyard west wall + Stair flank + Crypt Nook + SC-2 Lower Lift Alcove
    if (pz >= 99.5) {
      const bastionT = smoothstep(99.5, 102.0, pz);
      let z3WestWall = -3.85;
      if (pz >= 104.7 && pz < 109.6) {
        // Solid east masonry flank of the Bastion Ascent Staircase (prevents side-clipping into mid-stair!)
        z3WestWall = -1.40;
      } else if (pz >= 109.6) {
        // Deep Crypt Nook underpass (z = 109.6..115.8) flowing smoothly north into SC-2 Lower Lift Alcove 4.5 (x = -7.4)!
        const nookOpen = smoothstep(109.6, 110.3, pz);
        const liftAlcoveT = smoothstep(115.0, 116.4, pz);
        z3WestWall = lerp(-3.85, lerp(-8.55, -7.40, liftAlcoveT), nookOpen);
      }
      gorgeRightWall = lerp(gorgeRightWall, z3WestWall, bastionT);
    }

    const rightCliffX = lerp(shoreRightWall, gorgeRightWall, smoothstep(26.0, 35.0, pz));
    if (px < rightCliffX + rad) {
      px = rightCliffX + rad;
    }

    // Left-side (+X) riverbank boundary -> opens gracefully around Branch A River Shoal
    // and transitions cleanly to Watchtower overlook parapet at z >= 100!
    const rcx = getGorgeRiverCenterX(pz);
    const rhw = getGorgeRiverHalfWidth(pz);
    const riverEdgeX = rcx - rhw + (pz > 34.0 ? 0.35 : 1.35);
    const bastionParapetX = 5.75;
    const maxLeftX =
      lerp(Math.min(riverEdgeX, 11.8), bastionParapetX, smoothstep(97.0, 102.5, pz)) - rad;
    if (px > maxLeftX) {
      px = maxLeftX;
    }

    // Waterfall plunge pool exclusion (Zone 0 shore)
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

    // Resolve circular colliders (2 relaxation passes for clean corners!)
    const preY = evalBaseTerrainY(px, pz);
    const curLowLayer = evalShoalMask(px, pz) >= 0.22 ? 'river_shoal' : 'main';
    for (let pass = 0; pass < 2; pass++) {
      applyCircleColliders(px, pz, preY, rad, curLowLayer, EXTERIOR_ZONE0_COLLIDERS);
      px = _bestX;
      pz = _bestZ;
      applyCircleColliders(px, pz, preY, rad, curLowLayer, GORGE_STATIC_COLLIDERS);
      px = _bestX;
      pz = _bestZ;
    }

    px = clamp(px, -24.0 + rad, 24.0 - rad);
    const inOpenPortcullisPost = px >= -1.20 && px <= 2.80;
    const inLowerLiftAlcovePost = px >= -7.40 && px <= -3.40;
    const zUpperBoundPost = inOpenPortcullisPost ? 121.50 : inLowerLiftAlcovePost ? 120.00 - rad : 119.65 - rad;
    pz = clamp(pz, -16.0 + rad, zUpperBoundPost);
  }

  // Final authoritative layer, elevation & surface resolution
  const finalLayer = resolveGorgeLayer(px, pz, cy, state);
  const finalY = evalGorgeGroundY(px, pz, cy, state);
  const finalSurface = evalGorgeSurfaceType(px, pz, finalY, state);

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
// Canonical 3D Anchors (Single Source of Truth — Zone 0 100% Preserved!)
// ============================================================================
export const GORGE_ANCHORS = Object.freeze({
  // Zone 0: Ash Outfall Shore (100% compatible with soulsExteriorShore.js)
  wakePos: Object.freeze({ x: 0.0, y: evalBaseTerrainY(0.0, 2.5), z: 2.5, layer: 'main' }),
  swordPos: Object.freeze({ x: 2.8, y: evalBaseTerrainY(2.8, 5.2), z: 5.2, layer: 'main' }),
  bonfirePos: Object.freeze({ x: -2.2, y: evalBaseTerrainY(-2.2, 15.0), z: 15.0, layer: 'main' }),
  monolithPos: Object.freeze({ x: -5.0, y: evalBaseTerrainY(-5.0, 16.4), z: 16.4, layer: 'main' }),
  gatePos: Object.freeze({ x: 0.0, y: evalBaseTerrainY(0.0, 31.0), z: 31.0, layer: 'main' }),
  waterfallPos: Object.freeze({ x: 0.0, y: 0.0, z: -14.0, layer: 'main' }),
  castlePos: Object.freeze({ x: 0.0, y: 18.0, z: -56.0, layer: 'main' }),

  // Zone 1: Ancient Archway Road & Branch A Smuggler's Shoal
  gnarledTreePos: Object.freeze({ x: -6.2, y: evalBaseTerrainY(-6.2, 39.0), z: 39.0, layer: 'main' }),
  camp1Pos: Object.freeze({ x: -2.95, y: evalBaseTerrainY(-2.95, 45.2), z: 45.2, layer: 'main' }),
  twinColumn1Pos: Object.freeze({ x: -5.6, y: evalBaseTerrainY(-5.6, 46.1), z: 46.1, layer: 'main' }),
  twinColumn2Pos: Object.freeze({ x: -6.0, y: evalBaseTerrainY(-6.0, 49.4), z: 49.4, layer: 'main' }),
  archway1Pos: Object.freeze({ x: -0.6, y: evalBaseTerrainY(-0.6, 55.5), z: 55.5, layer: 'main' }),
  riverShrinePos: Object.freeze({ x: 4.8, y: evalBaseTerrainY(4.8, 53.5), z: 53.5, layer: 'river_shoal' }),

  // Branch B: Upper Cliffside Ruined Chapel Terrace & One-Way Shortcut Loop
  shortcutStairFootPos: Object.freeze({ x: -7.4, y: SHORTCUT_STAIR_Y_START, z: 44.4, layer: 'upper_terrace' }),
  shortcutGatePos: Object.freeze({ x: -9.5, y: TERRACE_GATE_Y, z: 52.0, layer: 'upper_terrace' }),
  shortcutLeverPos: Object.freeze({ x: -9.6, y: TERRACE_GATE_Y, z: 53.5, layer: 'upper_terrace' }),
  upperChapelAltarPos: Object.freeze({ x: -11.4, y: TERRACE_NAVE_Y, z: 64.0, layer: 'upper_terrace' }),
  upperChapelLanternPos: Object.freeze({ x: -8.0, y: TERRACE_NAVE_Y + 1.95, z: 64.0, layer: 'upper_terrace' }),

  // Zone 2: Lantern Road, Overhead Aqueduct Bridge & Branch C Cliffside Grotto
  camp2Pos: Object.freeze({ x: -3.55, y: evalBaseTerrainY(-3.55, 71.2), z: 71.2, layer: 'main' }),
  underBridgePos: Object.freeze({ x: 0.0, y: evalBaseTerrainY(0.0, 82.0), z: 82.0, layer: 'main' }),
  bridgeCenterPos: Object.freeze({ x: 0.0, y: BRIDGE_Y, z: 82.0, layer: 'bridge' }),
  bridgeOverlookPos: Object.freeze({ x: 4.8, y: BRIDGE_Y, z: 82.0, layer: 'bridge' }),
  grottoDoorPos: Object.freeze({ x: -4.2, y: evalGrottoY(-4.2, 88.5), z: 88.5, layer: 'grotto' }),
  grottoLorePos: Object.freeze({ x: -5.6, y: GROTTO_LOWER_Y, z: 91.0, layer: 'grotto' }),
  grottoMidLandingPos: Object.freeze({ x: -11.8, y: GROTTO_MID_Y, z: 86.8, layer: 'grotto' }),

  // Zone 3: Multi-Tier Watchtower Bastion Courtyard & Upper Rampart Walk
  bastionEntryPos: Object.freeze({ x: 1.15, y: evalBaseTerrainY(1.15, 99.2), z: 99.2, layer: 'main' }),
  watchtowerHearthPos: Object.freeze({ x: 0.65, y: BASTION_LOWER_Y, z: 111.2, layer: 'main' }),
  watchtowerLorePos: Object.freeze({ x: -6.4, y: BASTION_LOWER_Y, z: 111.0, layer: 'main' }),
  bastionCenterPos: Object.freeze({ x: 0.6, y: BASTION_LOWER_Y, z: 111.0, layer: 'main' }),
  portcullisPos: Object.freeze({ x: 0.8, y: BASTION_LOWER_Y, z: 120.4, layer: 'main' }),
  bastionStairFootPos: Object.freeze({ x: -2.6, y: BASTION_LOWER_Y, z: 103.5, layer: 'bastion_upper' }),
  bastionUpperParapetPos: Object.freeze({ x: 0.8, y: BASTION_UPPER_Y, z: 117.8, layer: 'bastion_upper' }),
  bastionUpperOverlookPos: Object.freeze({ x: 4.5, y: BASTION_UPPER_Y, z: 105.2, layer: 'bastion_upper' }),

  // Region I 8-Sector River Reach Anchors (44 POIs '1.1'..'8.5' + Sector Spawns '01'..'08' + Extended Bounds)
  ...RIVER_REACH_ANCHORS
});

// ============================================================================
// Unified 3D Fire & Warm Lantern Light Sources (Dynamic Lighting + Spatial Audio)
// ============================================================================
export const GORGE_FIRE_SOURCES = Object.freeze([
  // Major hearths & bonfires
  Object.freeze({
    id: 'gorge_camp_1',
    kind: 'campfire',
    x: -2.95,
    y: evalBaseTerrainY(-2.95, 45.2) + 1.55,
    z: 45.20,
    layer: 'main',
    weight: 0.96,
    radius: 17.0,
    lightIntensity: 9.2,
    alwaysLit: true
  }),
  Object.freeze({
    id: 'gorge_camp_2',
    kind: 'campfire',
    x: -3.55,
    y: evalBaseTerrainY(-3.55, 71.2) + 1.55,
    z: 71.20,
    layer: 'main',
    weight: 0.94,
    radius: 17.0,
    lightIntensity: 9.0,
    alwaysLit: true
  }),
  Object.freeze({
    id: 'gorge_watchtower_hearth',
    kind: 'bonfire',
    x: 0.65,
    y: BASTION_LOWER_Y + 1.60,
    z: 111.20,
    layer: 'main',
    weight: 1.00,
    radius: 18.0,
    lightIntensity: 9.8,
    alwaysLit: true,
    isBonfire: true
  }),
  // Multi-elevation sightline beacons & lanterns
  Object.freeze({
    id: 'gorge_archway_lantern',
    kind: 'lantern',
    x: -0.60,
    y: evalBaseTerrainY(-0.60, 55.5) + 3.65,
    z: 55.50,
    layer: 'main',
    weight: 0.68,
    radius: 13.0,
    lightIntensity: 5.4,
    alwaysLit: true
  }),
  Object.freeze({
    id: 'gorge_shoal_shrine_brazier',
    kind: 'brazier',
    x: 4.15,
    y: evalBaseTerrainY(4.15, 53.5) + 0.95,
    z: 53.50,
    layer: 'river_shoal',
    weight: 0.62,
    radius: 11.0,
    lightIntensity: 4.8,
    alwaysLit: true
  }),
  Object.freeze({
    id: 'gorge_chapel_overhang_lantern',
    kind: 'lantern',
    x: -8.00,
    y: TERRACE_NAVE_Y + 2.05,
    z: 64.00,
    layer: 'upper_terrace',
    weight: 0.80,
    radius: 16.0,
    lightIntensity: 6.8,
    alwaysLit: true
  }),
  Object.freeze({
    id: 'gorge_grotto_entry_torch',
    kind: 'brazier',
    x: -4.20,
    y: GROTTO_LOWER_Y + 1.85,
    z: 87.30,
    layer: 'grotto',
    weight: 0.78,
    radius: 14.0,
    lightIntensity: 6.2,
    alwaysLit: true
  }),
  Object.freeze({
    id: 'gorge_grotto_mid_lantern',
    kind: 'lantern',
    x: -12.60,
    y: GROTTO_MID_Y + 1.80,
    z: 86.80,
    layer: 'grotto',
    weight: 0.72,
    radius: 12.0,
    lightIntensity: 5.2,
    alwaysLit: true
  }),
  Object.freeze({
    id: 'gorge_bridge_overlook_brazier',
    kind: 'brazier',
    x: 5.10,
    y: BRIDGE_Y + 1.35,
    z: 82.00,
    layer: 'bridge',
    weight: 0.84,
    radius: 16.5,
    lightIntensity: 7.4,
    alwaysLit: true
  }),
  Object.freeze({
    id: 'gorge_bastion_upper_beacon',
    kind: 'brazier',
    x: 5.65,
    y: BASTION_UPPER_Y + 1.45,
    z: 104.55,
    layer: 'bastion_upper',
    weight: 0.88,
    radius: 18.0,
    lightIntensity: 8.0,
    alwaysLit: true
  }),
  // Region I Extended Bonfires (Village, Camp, Cliff, Viaduct) + 36+ Braziers & Lanterns across Sectors 03..08
  ...RIVER_REACH_EXTENDED_FIRE_SOURCES
]);

// ============================================================================
// Diegetic Interactables (Levers, Shortcut Gate, Bonfires, Lore Shrines, Vistas)
// ============================================================================
export const GORGE_INTERACTABLES = Object.freeze([
  Object.freeze({
    id: 'shore_bonfire',
    type: 'bonfire',
    x: -2.20,
    y: evalBaseTerrainY(-2.20, 15.00),
    z: 15.00,
    layer: 'main',
    radius: 2.35,
    title: 'Костёр Пепельного Стока',
    prompt: 'Отдохнуть у костра'
  }),
  Object.freeze({
    id: 'shore_monolith',
    type: 'lore',
    x: -5.00,
    y: evalBaseTerrainY(-5.00, 16.40),
    z: 16.40,
    layer: 'main',
    radius: 2.10,
    title: 'Рунический Монолит Стока',
    prompt: 'Прочесть надпись',
    loreText: '«Когда Замок Пепла рухнул в бездну, воды Лунного Стока унесли клятвы последних охотников к древнему акведуку.»'
  }),
  Object.freeze({
    id: 'river_shoal_shrine',
    type: 'shrine',
    x: 4.80,
    y: evalBaseTerrainY(4.80, 53.50),
    z: 53.50,
    layer: 'river_shoal',
    radius: 2.15,
    title: 'Забытый Алтарь Отмели',
    prompt: 'Осмотреть тайник контрабандистов',
    loreText: '«Под корнями арки, где река шепчет громче колоколов, мы прятали масло для фонарей и ключи от верхних ворот.»'
  }),
  Object.freeze({
    id: 'shortcut_gate',
    type: 'shortcut_gate',
    x: -9.50,
    y: TERRACE_GATE_Y,
    z: 52.00,
    layer: 'upper_terrace',
    radius: 2.25,
    stateKey: 'shortcutUnlocked',
    title: 'Кованые Ворота Утёса',
    lockedPrompt: 'Закрыто с другой стороны',
    unlockedPrompt: 'Ворота открыты'
  }),
  Object.freeze({
    id: 'shortcut_lever',
    type: 'shortcut_lever',
    x: -9.60,
    y: TERRACE_GATE_Y,
    z: 53.50,
    layer: 'upper_terrace',
    radius: 2.15,
    stateKey: 'shortcutUnlocked',
    setsState: 'shortcutUnlocked',
    title: 'Рычаг Короткого Пути',
    prompt: 'Потянуть рычаг ворот',
    activatedPrompt: 'Механизм ворот опущен'
  }),
  Object.freeze({
    id: 'upper_chapel_altar',
    type: 'lore',
    x: -11.40,
    y: TERRACE_NAVE_Y,
    z: 64.00,
    layer: 'upper_terrace',
    radius: 2.15,
    title: 'Алтарь Верхней Часовни',
    prompt: 'Осмотреть разбитый реликварий',
    loreText: '«Отсюда стражи наблюдали за фонарной набережной и опускали решётку утёса, когда в ущелье поднимался чёрный туман.»'
  }),
  Object.freeze({
    id: 'grotto_lore_stone',
    type: 'lore',
    x: -5.60,
    y: GROTTO_LOWER_Y,
    z: 91.00,
    layer: 'grotto',
    radius: 2.10,
    title: 'Записки Контрабандиста',
    prompt: 'Прочесть высеченные строки',
    loreText: '«Два пролёта вверх сквозь скалу — и ты выйдешь прямо на Акведук Разлома, выше фонарей и выше клинков на дороге.»'
  }),
  Object.freeze({
    id: 'bridge_overlook_vista',
    type: 'vista',
    x: 4.80,
    y: BRIDGE_Y,
    z: 82.00,
    layer: 'bridge',
    radius: 2.20,
    title: 'Балкон Акведука Разлома',
    prompt: 'Вглядеться в лунные пороги',
    loreText: '«Под аркой акведука река несётся к Башне Перевала, а вдали догорает Замок Пепла.»'
  }),
  Object.freeze({
    id: 'watchtower_bonfire',
    type: 'bonfire',
    x: 0.65,
    y: BASTION_LOWER_Y,
    z: 111.20,
    layer: 'main',
    radius: 2.40,
    title: 'Костёр Башни Перевала',
    prompt: 'Отдохнуть у костра'
  }),
  Object.freeze({
    id: 'watchtower_crypt_lore',
    type: 'lore',
    x: -6.40,
    y: BASTION_LOWER_Y,
    z: 111.00,
    layer: 'main',
    radius: 2.20,
    title: 'Скрижаль Стражей Перевала',
    prompt: 'Прочесть скрижаль',
    loreText: '«Поднимись по западной лестнице на верхние стены — оттуда виден весь путь от пепельного берега до северной пропасти.»'
  }),
  Object.freeze({
    id: 'watchtower_portcullis',
    type: 'lore',
    x: 0.80,
    y: BASTION_LOWER_Y,
    z: 119.40,
    layer: 'main',
    radius: 2.20,
    title: 'Поднятая Северная Решётка Перевала',
    prompt: 'Осмотреть проход на Скальные высоты',
    loreText: '«Решётка Башни Перевала поднята — за аркой тропа уходит вверх по Базальтовому перевалу к Скальным высотам и Древним сооружениям.»'
  }),
  Object.freeze({
    id: 'bastion_upper_overlook',
    type: 'vista',
    x: 4.50,
    y: BASTION_UPPER_Y,
    z: 105.20,
    layer: 'bastion_upper',
    radius: 2.20,
    title: 'Дозорный Бастион',
    prompt: 'Осмотреть Ущелье Лунного Стока',
    loreText: '«С верхних стен Перевала открывается вся цепь огней: костры тракта, акведук и багровое зарево Замка Пепла.»'
  }),
  // Region I Extended Interactables (4 Extended Bonfires, SC-2 Lift Bottom/Top Controls, SC-3/SC-4 Shortcuts,
  // 5 Secret Chests/Relics, Cathedral Boss Altar 8.3, Region II Citadel Finale Gate 8.5, Vistas & Lore)
  ...RIVER_REACH_EXTENDED_INTERACTABLES
]);

// ============================================================================
// Complete Structured 3D Placement Manifest (Blender GLB Kit & Procedural Fallback)
// Every coordinate & elevation matches colliders and multi-layer heights 1:1!
// ============================================================================
function placeGround(id, asset, x, z, rotY = 0, scale = 1.0, extra = null) {
  return Object.freeze({
    id,
    asset,
    x,
    y: evalBaseTerrainY(x, z),
    z,
    rotY,
    scale,
    layer: 'main',
    ...(extra || {})
  });
}

function placeExact(id, asset, x, y, z, rotY = 0, scale = 1.0, layer = 'main', extra = null) {
  return Object.freeze({
    id,
    asset,
    x,
    y,
    z,
    rotY,
    scale,
    layer,
    ...(extra || {})
  });
}

export const GORGE_PLACEMENT_MANIFEST = Object.freeze({
  cliffs: Object.freeze([
    // Right-side (-X) sheer basalt cliff faces framing Zones 1–3 & supporting Upper Chapel Terrace
    placeGround('cliff_r_z1_south', 'Basalt_Cliff_Wall_A', -14.2, 36.5, 0.12, 1.35),
    placeGround('cliff_r_z1_mid', 'Basalt_Cliff_Wall_B', -15.6, 48.0, -0.08, 1.45),
    placeGround('cliff_r_chapel_back_1', 'Basalt_Cliff_Wall_A', -15.8, 59.5, 0.06, 1.55),
    placeGround('cliff_r_chapel_back_2', 'Basalt_Cliff_Wall_B', -16.2, 71.0, -0.05, 1.60),
    placeGround('cliff_r_grotto_overhang', 'Basalt_Cliff_Overhang', -11.5, 88.5, 0.0, 1.50, { y: 6.40 }),
    placeGround('cliff_r_grotto_west', 'Basalt_Cliff_Wall_A', -16.8, 86.5, 0.14, 1.55),
    placeGround('cliff_r_z3_approach', 'Basalt_Cliff_Wall_B', -12.8, 97.5, -0.18, 1.40),
    placeGround('cliff_r_crypt_back', 'Basalt_Cliff_Wall_A', -13.2, 111.0, 0.04, 1.55),
    // Far-left (+X) forested gorge cliffs across the moonlit river
    placeGround('cliff_l_river_1', 'Basalt_Cliff_Ridge', 19.5, 44.0, Math.PI + 0.15, 1.50),
    placeGround('cliff_l_river_2', 'Basalt_Cliff_Ridge', 18.8, 66.0, Math.PI - 0.10, 1.55),
    placeGround('cliff_l_river_3', 'Basalt_Cliff_Ridge', 19.6, 88.0, Math.PI + 0.08, 1.60),
    placeGround('cliff_l_river_4', 'Basalt_Cliff_Ridge', 22.4, 112.0, Math.PI - 0.12, 1.75)
  ]),

  boulders: Object.freeze([
    // Branch A River Shoal winding mossy boulders (exact match with colliders!)
    placeGround('boulder_shoal_1', 'Mossy_Boulder_A', 3.20, 45.80, 0.72, 1.05, { layer: 'river_shoal' }),
    placeGround('boulder_shoal_2', 'Mossy_Boulder_B', 5.85, 49.20, 2.15, 0.96, { layer: 'river_shoal' }),
    placeGround('boulder_shoal_rim_1', 'Mossy_Boulder_Small', 6.45, 42.60, 1.30, 0.85, { layer: 'river_shoal' }),
    placeGround('boulder_shoal_rim_2', 'Mossy_Boulder_Small', 6.55, 56.20, 0.45, 0.88, { layer: 'river_shoal' }),
    // Zone 2 river-edge crag & road edge stones
    placeGround('boulder_river_crag', 'Mossy_Boulder_Large', 5.40, 88.60, 1.85, 1.38),
    placeGround('boulder_z2_bank_1', 'Mossy_Boulder_A', 3.60, 66.80, 0.40, 0.92),
    placeGround('boulder_z2_bank_2', 'Mossy_Boulder_B', 3.30, 75.00, 2.65, 0.88),
    placeGround('boulder_z3_cliff_base', 'Mossy_Boulder_Large', -6.80, 96.40, 1.12, 1.22)
  ]),

  pines: Object.freeze([
    // Across-river (+X) Gothic mountain spruce/pine ridge silhouettes
    placeGround('pine_east_1', 'Gothic_Pine_Tall', 16.4, 37.5, 0.4, 1.25),
    placeGround('pine_east_2', 'Gothic_Pine_Mid', 18.2, 46.5, 1.8, 1.15),
    placeGround('pine_east_3', 'Gothic_Pine_Tall', 17.5, 55.0, 2.9, 1.35),
    placeGround('pine_east_4', 'Gothic_Pine_Mid', 15.8, 64.5, 0.9, 1.20),
    placeGround('pine_east_5', 'Gothic_Pine_Tall', 16.8, 74.0, 2.1, 1.40),
    placeGround('pine_east_6', 'Gothic_Pine_Mid', 17.2, 83.5, 1.2, 1.25),
    placeGround('pine_east_7', 'Gothic_Pine_Tall', 18.6, 94.0, 0.5, 1.38),
    placeGround('pine_east_8', 'Gothic_Pine_Tall', 20.4, 106.5, 2.4, 1.45),
    // High west cliff rim (-X) pines framing the Upper Chapel Terrace skyline
    placeGround('pine_west_rim_1', 'Gothic_Pine_Mid', -14.8, 42.5, 1.1, 1.15),
    placeGround('pine_west_rim_2', 'Gothic_Pine_Tall', -15.6, 56.0, 2.5, 1.30),
    placeGround('pine_west_rim_3', 'Gothic_Pine_Tall', -16.0, 68.5, 0.7, 1.35),
    placeGround('pine_west_rim_4', 'Gothic_Pine_Mid', -16.2, 79.5, 1.9, 1.22),
    placeGround('pine_west_rim_5', 'Gothic_Pine_Tall', -14.6, 96.0, 2.8, 1.32)
  ]),

  gnarledTrees: Object.freeze([
    placeGround('gnarled_tree_z1', 'Gnarled_Dead_Tree', -6.20, 39.00, 0.65, 1.12),
    placeGround('gnarled_tree_archway', 'Bare_Twisted_Tree', -5.35, 54.50, 2.30, 1.05),
    placeExact('gnarled_tree_chapel_rim', 'Bare_Twisted_Tree', -13.20, TERRACE_NAVE_Y + 0.4, 67.80, 1.20, 1.18, 'upper_terrace')
  ]),

  archways: Object.freeze([
    // Zone 1 Iconic Open Ivy-Draped Ruined Stone Archway (4.60m clear road opening!)
    placeGround('archway_z1_main', 'Ivy_Ruined_Archway', -0.60, 55.50, 0.0, 1.0, { clearWidth: 4.60 }),
    placeGround('archway_z1_wing_l', 'Ivy_Wing_Wall', 3.55, 55.40, 0.14, 1.0),
    // Zone 3 Watchtower Bastion Entry Archway
    placeGround('archway_z3_entry', 'Bastion_Gate_Archway', 1.15, 99.20, 0.0, 1.0, { clearWidth: 5.90 }),
    // Zone 3 North Iron Portcullis closure
    placeExact('archway_z3_portcullis', 'Iron_Portcullis_Gate', 0.80, BASTION_LOWER_Y, 120.40, 0.0, 1.0, 'main')
  ]),

  columns: Object.freeze([
    // Zone 1 Twin Fluted Columns on square pedestals framing Shortcut Staircase behind them!
    placeGround('column_z1_twin_1', 'Fluted_Stone_Column_Tall', -5.60, 46.10, 0.25, 1.05),
    placeGround('column_z1_twin_2', 'Fluted_Stone_Column_Short', -6.00, 49.40, -0.40, 0.96),
    // Zone 2 Broken Column beside Campfire 2 (carries crimson banner)
    placeGround('column_z2_banner', 'Broken_Round_Column', -6.15, 73.10, 0.85, 1.0),
    // Zone 3 Crypt Nook support columns under West Gallery
    placeExact('column_z3_crypt_s', 'Gothic_Support_Pillar', -3.20, BASTION_LOWER_Y, 109.50, 0.0, 1.0, 'main'),
    placeExact('column_z3_crypt_n', 'Gothic_Support_Pillar', -3.20, BASTION_LOWER_Y, 115.80, 0.0, 1.0, 'main')
  ]),

  timberLanterns: Object.freeze([
    // Exact 4 Timber Gallows Lanterns curving along the right edge of Lantern Road
    placeGround('lantern_post_1', 'Timber_Gallows_Lantern', -4.05, 66.20, 0.18, 1.0),
    placeGround('lantern_post_2', 'Timber_Gallows_Lantern', -4.15, 75.40, 0.05, 1.0),
    placeGround('lantern_post_3', 'Timber_Gallows_Lantern', -2.95, 84.20, -0.14, 1.0),
    placeGround('lantern_post_4', 'Timber_Gallows_Lantern', -1.45, 92.80, -0.22, 1.0)
  ]),

  wallLanterns: Object.freeze([
    placeExact('wall_lantern_archway', 'Hanging_Iron_Lantern', -0.60, evalBaseTerrainY(-0.60, 55.5) + 3.70, 55.50, 0.0, 1.0, 'main'),
    placeExact('wall_lantern_chapel', 'Overhanging_Chapel_Lantern', -8.00, TERRACE_NAVE_Y + 2.05, 64.00, Math.PI * 0.5, 1.15, 'upper_terrace'),
    placeExact('wall_lantern_grotto_s', 'Iron_Wall_Lantern', -4.20, GROTTO_LOWER_Y + 1.85, 87.30, Math.PI * 0.5, 1.0, 'grotto'),
    placeExact('wall_lantern_grotto_n', 'Iron_Wall_Lantern', -4.20, GROTTO_LOWER_Y + 1.85, 90.20, Math.PI * 0.5, 1.0, 'grotto'),
    placeExact('wall_lantern_grotto_mid', 'Iron_Wall_Lantern', -12.60, GROTTO_MID_Y + 1.80, 86.80, Math.PI * 0.5, 1.0, 'grotto'),
    placeExact('wall_lantern_grotto_exit', 'Iron_Wall_Lantern', -5.70, BRIDGE_Y + 1.80, 83.75, Math.PI, 1.0, 'grotto'),
    placeExact('wall_lantern_crypt', 'Iron_Wall_Lantern', -7.85, BASTION_LOWER_Y + 1.85, 111.00, Math.PI * 0.5, 1.0, 'main')
  ]),

  aqueductBridge: Object.freeze([
    // Monumental Stone Aqueduct Bridge spanning OVER Lantern Road at z = 82.0, y = 5.60m!
    placeExact('bridge_bay_west', 'Aqueduct_Bridge_Bay', -8.80, BRIDGE_Y, 82.00, 0.0, 1.0, 'bridge', { spanX: 6.4, widthZ: 3.4 }),
    placeExact('bridge_bay_center', 'Aqueduct_Bridge_MainArch', -0.90, BRIDGE_Y, 82.00, 0.0, 1.0, 'bridge', { spanX: 9.5, widthZ: 3.4 }),
    placeExact('bridge_balcony_east', 'Aqueduct_Overlook_Balcony', 4.40, BRIDGE_Y, 82.00, 0.0, 1.0, 'bridge', { spanX: 2.8, widthZ: 4.8 }),
    placeGround('bridge_pier_right', 'Aqueduct_Support_Pier', -5.65, 82.00, 0.0, 1.0, { topY: BRIDGE_Y }),
    placeGround('bridge_pier_left', 'Aqueduct_Support_Pier', 3.85, 82.00, 0.0, 1.0, { topY: BRIDGE_Y }),
    placeExact('bridge_overlook_brazier', 'Gothic_Iron_Brazier', 5.10, BRIDGE_Y, 82.00, 0.0, 0.95, 'bridge')
  ]),

  stairs: Object.freeze([
    // Branch A: Natural mossy stone steps down to & back up from River Shoal
    placeGround('stairs_shoal_south', 'Mossy_Stone_Steps', 3.30, 38.80, 0.52, 1.0, { layer: 'river_shoal' }),
    placeGround('stairs_shoal_north', 'Mossy_Stone_Steps', 3.80, 58.20, -0.78, 1.0, { layer: 'river_shoal' }),
    // Branch B: Cliffside Shortcut Staircase (z = 44.4..52.0, y = 0.78 -> 4.20m)
    placeExact('stairs_shortcut_flight', 'Carved_Cliff_Staircase', -8.45, SHORTCUT_STAIR_Y_START, 48.20, -0.27, 1.0, 'upper_terrace', {
      startPos: { x: -7.4, y: SHORTCUT_STAIR_Y_START, z: 44.4 },
      endPos: { x: -9.5, y: TERRACE_GATE_Y, z: 52.0 },
      width: 3.3
    }),
    // Branch B: Upper Chapel Terrace tiered step flights
    placeExact('stairs_terrace_a', 'Gothic_Terrace_Steps', -10.10, TERRACE_NAVE_Y, 71.00, 0.0, 1.0, 'upper_terrace', {
      yStart: TERRACE_NAVE_Y, yEnd: BRIDGE_Y, lengthZ: 4.0, widthX: 4.6
    }),
    placeExact('stairs_terrace_b', 'Gothic_Terrace_Steps', -10.10, TERRACE_GATE_Y, 57.25, 0.0, 1.0, 'upper_terrace', {
      yStart: TERRACE_GATE_Y, yEnd: TERRACE_NAVE_Y, lengthZ: 3.5, widthX: 4.6
    }),
    // Branch C: Grotto Two-Flight Stone Switchback Staircase
    placeExact('stairs_grotto_f1', 'Grotto_Stone_Stair_Flight', -8.80, GROTTO_LOWER_Y, 88.60, -Math.PI * 0.5, 1.0, 'grotto', {
      startPos: { x: -6.8, y: GROTTO_LOWER_Y, z: 88.6 },
      endPos: { x: -10.8, y: GROTTO_MID_Y, z: 88.6 },
      width: 2.8
    }),
    placeExact('stairs_grotto_f2', 'Grotto_Stone_Stair_Flight', -8.80, GROTTO_MID_Y, 85.00, Math.PI * 0.5, 1.0, 'grotto', {
      startPos: { x: -10.8, y: GROTTO_MID_Y, z: 85.0 },
      endPos: { x: -6.8, y: BRIDGE_Y, z: 85.0 },
      width: 2.8
    }),
    // Zone 3: Bastion Entry Stepped Ascent & Upper Rampart Ascent Staircase
    placeGround('stairs_bastion_entry', 'Ruined_Stone_Steps_Wide', 1.15, 99.20, 0.0, 1.25),
    placeExact('stairs_bastion_upper', 'Bastion_Stone_Staircase', -2.60, BASTION_LOWER_Y, 106.50, 0.0, 1.0, 'bastion_upper', {
      startPos: { x: -2.6, y: BASTION_LOWER_Y, z: 103.5 },
      endPos: { x: -2.6, y: BASTION_UPPER_Y, z: 109.5 },
      width: 2.4
    })
  ]),

  chapelArches: Object.freeze([
    // Branch B: Ruined Cliffside Chapel Nave Arches (visible from road below!)
    placeExact('chapel_arch_1', 'Ruined_Chapel_Arch', -8.00, TERRACE_NAVE_Y, 66.50, Math.PI * 0.5, 1.0, 'upper_terrace'),
    placeExact('chapel_arch_2', 'Ruined_Chapel_Arch', -8.00, TERRACE_NAVE_Y, 61.50, Math.PI * 0.5, 1.0, 'upper_terrace'),
    placeExact('chapel_arch_3', 'Ruined_Chapel_Arch', -8.00, TERRACE_GATE_Y, 55.20, Math.PI * 0.5, 0.92, 'upper_terrace'),
    placeExact('chapel_relic_altar', 'Ruined_Stone_Altar', -11.85, TERRACE_NAVE_Y, 64.00, Math.PI * 0.5, 1.0, 'upper_terrace'),
    // Branch C: Grotto Entry & Upper Exit Gothic Archways
    placeExact('grotto_entry_arch', 'Ruined_Chapel_Arch', -4.20, GROTTO_LOWER_Y, 88.80, Math.PI * 0.5, 1.05, 'grotto'),
    placeExact('grotto_exit_arch', 'Ruined_Chapel_Arch', -5.70, BRIDGE_Y, 83.70, 0.0, 0.95, 'grotto'),
    // Branch A: Hidden River Shrine Altar
    placeGround('shoal_river_shrine', 'Mossy_River_Shrine', 4.05, 53.50, -Math.PI * 0.45, 0.95, { layer: 'river_shoal' })
  ]),

  shortcutGate: Object.freeze([
    placeExact('iron_shortcut_gate', 'Iron_Shortcut_Gate', -9.50, TERRACE_GATE_Y, 52.00, 0.0, 1.0, 'upper_terrace', {
      stateKey: 'shortcutUnlocked',
      clearWidth: 3.20
    }),
    placeExact('shortcut_lever', 'Shortcut_Lever', -11.20, TERRACE_GATE_Y, 53.50, Math.PI * 0.5, 1.0, 'upper_terrace', {
      interactPos: { x: -9.6, y: TERRACE_GATE_Y, z: 53.5 },
      stateKey: 'shortcutUnlocked'
    })
  ]),

  watchtowerTurrets: Object.freeze([
    placeExact('turret_se', 'Ruined_Watchtower_Turret', 6.45, BASTION_LOWER_Y, 107.40, -0.4, 1.05, 'main'),
    placeExact('turret_ne', 'Ruined_Watchtower_Turret', 6.30, BASTION_LOWER_Y, 115.80, 0.35, 1.10, 'main'),
    placeExact('pylon_portcullis_r', 'Bastion_Gatehouse_Pylon', -2.45, BASTION_LOWER_Y, 120.40, 0.0, 1.0, 'main'),
    placeExact('pylon_portcullis_l', 'Bastion_Gatehouse_Pylon', 4.05, BASTION_LOWER_Y, 120.40, 0.0, 1.0, 'main'),
    placeExact('rampart_west_deck', 'Bastion_Rampart_Walkway', -2.60, BASTION_UPPER_Y, 114.40, 0.0, 1.0, 'bastion_upper', { widthX: 2.4, lengthZ: 9.9 }),
    placeExact('rampart_north_deck', 'Bastion_Rampart_Walkway', 1.20, BASTION_UPPER_Y, 117.80, Math.PI * 0.5, 1.0, 'bastion_upper', { widthX: 10.0, lengthZ: 3.2 }),
    placeExact('rampart_east_deck', 'Bastion_Rampart_Walkway', 4.50, BASTION_UPPER_Y, 111.60, 0.0, 1.0, 'bastion_upper', { widthX: 3.4, lengthZ: 15.6 }),
    placeExact('rampart_upper_beacon', 'Gothic_Iron_Brazier', 5.70, BASTION_UPPER_Y, 104.50, 0.0, 1.10, 'bastion_upper')
  ]),

  campfires: Object.freeze([
    placeGround('campfire_z1', 'Wayside_Campfire', -2.95, 45.20, 0.3, 1.0),
    placeGround('campfire_z2', 'Wayside_Campfire', -3.55, 71.20, 1.1, 1.0),
    placeExact('bonfire_watchtower', 'Watchtower_Bonfire_Hearth', 0.65, BASTION_LOWER_Y, 111.20, 0.0, 1.08, 'main')
  ]),

  fallenLogs: Object.freeze([
    placeGround('fallen_log_z1', 'Fallen_Mossy_Log', -4.45, 46.50, 0.42, 1.0),
    placeGround('fallen_log_z2', 'Fallen_Mossy_Log', -5.45, 71.60, -0.35, 1.05)
  ]),

  planks: Object.freeze([
    placeGround('planks_z1_1', 'Broken_Wood_Planks', -1.80, 35.80, 0.45, 1.0),
    placeGround('planks_z1_2', 'Broken_Wood_Planks', 1.90, 41.20, -0.62, 0.95),
    placeGround('planks_shoal_1', 'Broken_Wood_Planks', 4.40, 43.20, 0.28, 0.90, { layer: 'river_shoal' }),
    placeGround('planks_z2_1', 'Broken_Wood_Planks', -2.60, 62.40, 1.05, 0.92),
    placeGround('planks_z2_2', 'Broken_Wood_Planks', 1.40, 86.20, -0.40, 0.95)
  ]),

  crates: Object.freeze([
    placeGround('crate_camp1_1', 'Wooden_Crate_Smashable', -4.10, 44.40, 0.35, 0.95),
    placeExact('crate_grotto_1', 'Wooden_Crate_Smashable', -6.30, GROTTO_LOWER_Y, 90.80, 0.25, 0.95, 'grotto'),
    placeExact('crate_grotto_2', 'Wooden_Crate_Smashable', -12.40, GROTTO_MID_Y, 89.20, 0.80, 0.90, 'grotto'),
    placeExact('crate_chapel_1', 'Wooden_Crate_Smashable', -11.90, TERRACE_NAVE_Y, 60.60, 0.55, 0.92, 'upper_terrace'),
    placeExact('crate_bastion_1', 'Wooden_Crate_Smashable', -7.50, BASTION_LOWER_Y, 109.80, 0.18, 0.95, 'main')
  ]),

  barrels: Object.freeze([
    placeGround('barrel_shoal_1', 'Smuggler_Barrel_Smashable', 4.15, 51.80, 0.20, 0.95, { layer: 'river_shoal' }),
    placeGround('barrel_shoal_2', 'Smuggler_Barrel_Smashable', 3.95, 54.60, 1.40, 0.90, { layer: 'river_shoal' }),
    placeExact('barrel_grotto_1', 'Smuggler_Barrel_Smashable', -6.60, GROTTO_LOWER_Y, 91.20, 0.65, 0.95, 'grotto'),
    placeExact('barrel_crypt_1', 'Smuggler_Barrel_Smashable', -7.65, BASTION_LOWER_Y, 114.20, 0.90, 0.95, 'main')
  ]),

  banners: Object.freeze([
    placeExact('banner_camp2_crimson', 'Tattered_Crimson_Banner', -6.15, evalBaseTerrainY(-6.15, 73.10) + 3.20, 73.10, 0.45, 1.0, 'main'),
    placeExact('banner_bastion_entry_l', 'Tattered_Crimson_Banner', 4.65, evalBaseTerrainY(4.65, 99.20) + 4.20, 99.20, 0.0, 1.0, 'main'),
    placeExact('banner_bastion_entry_r', 'Tattered_Crimson_Banner', -2.35, evalBaseTerrainY(-2.35, 99.20) + 4.20, 99.20, 0.0, 1.0, 'main'),
    placeExact('banner_bastion_parapet', 'Tattered_Crimson_Banner', 0.80, BASTION_UPPER_Y + 0.20, 119.35, Math.PI, 1.08, 'bastion_upper')
  ])
});
