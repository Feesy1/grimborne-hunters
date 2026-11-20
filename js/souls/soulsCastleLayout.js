// Compact Enclosed Castle Layout, Trap & Ambush Specs, and Exact Collision Geometry
// for `Abandoned Knight Rift` (Pass 2 / ?v=20261121z64).
// Pure zero-dependency ES module (Vanilla JS, V8/Browser/Node compatible).
//
// Expanded & Balanced Dark Souls Progression (no sprawling maze — crisp enclosed castle):
//   1. Bonfire Hall (`courtyard`):   x in [-9.0, +9.0], z in [+20.0, +38.0] (Bonfire at (0, 32.5), Safe Zone R=9.5m)
//   2. Castle Corridor (`corridor`): x in [-5.0, +5.0], z in [-16.0, +20.0] (36m long x 10m wide, 3 timed Flame Traps)
//   3. East Alcove (`east_alcove`):  x in [+5.8, +13.8], z in [-5.0, +4.0]  (single ~8.8m side branch via 4.8m arch
//                                    `east_arch` z in [-2.8, +2.0]: Flank Ambush Warden + Estus Relic Shrine at (12.2, -0.4))
//   4. Massive Twin Boss Doors:      z = -16.0 (portal x in [-3.15, +3.15], seal z = -16.2, interact [E])
//   5. Boss Throne Hall (`boss_hall`): enlarged circular cathedral center (0, -31.2), R = 16.0 (+21% radius, +47% area)
//                                      Obsidian Throne at (0, -41.6), Hero Entry at (0, -21.2)
//
// Solid full-height stone walls enclose 100% of the perimeter (including full 8.6m South wall behind Bonfire).

export const SOULS_BONFIRE_SAFE_RADIUS = 9.5;

export const SOULS_CASTLE_CONSTANTS = Object.freeze({
  BOSS_DOOR_Z: -16.0,
  BOSS_SEAL_Z: -16.2,
  BOSS_PORTAL_HALF_W: 3.15,
  BOSS_CENTER_X: 0,
  BOSS_CENTER_Z: -31.2,
  BOSS_RADIUS: 16.0,
  BOSS_HERO_ENTRY_Z: -21.2,
  BONFIRE_SAFE_RADIUS: SOULS_BONFIRE_SAFE_RADIUS,
  COURTYARD_MIN_X: -9.0,
  COURTYARD_MAX_X: 9.0,
  COURTYARD_MIN_Z: 20.0,
  COURTYARD_MAX_Z: 38.0,
  CORRIDOR_HALF_W: 5.0,
  CORRIDOR_MIN_Z: -16.0,
  CORRIDOR_MAX_Z: 20.0,
  EAST_ALCOVE_MIN_X: 5.8,
  EAST_ALCOVE_MAX_X: 13.8,
  EAST_ALCOVE_MIN_Z: -5.0,
  EAST_ALCOVE_MAX_Z: 4.0,
  EAST_ARCH_MIN_Z: -2.8,
  EAST_ARCH_MAX_Z: 2.0,
  WALL_THICKNESS: 1.2,
  INTERIOR_PIER_THICKNESS: 0.8,
  COURTYARD_WALL_HEIGHT: 8.6,
  CORRIDOR_WALL_HEIGHT: 8.4,
  ALCOVE_WALL_HEIGHT: 7.8,
  BOSS_WALL_HEIGHT: 12.4,
  DEFAULT_ACTOR_RADIUS: 0.55
});

export const SOULS_CASTLE_BONFIRE = Object.freeze({
  id: 'bonfire_main',
  roomId: 'courtyard',
  x: 0,
  z: 32.5,
  colliderRadius: 1.05,
  interactRadius: 2.8,
  safeRadius: SOULS_BONFIRE_SAFE_RADIUS
});

export const SOULS_CASTLE_PLAYER_SPAWN = Object.freeze({
  roomId: 'courtyard',
  x: 0,
  z: 29.2,
  facing: Math.PI
});

export const SOULS_CASTLE_DOOR_CONFIG = Object.freeze({
  id: 'boss_twin_doors',
  x: 0,
  z: SOULS_CASTLE_CONSTANTS.BOSS_DOOR_Z,
  sealZ: SOULS_CASTLE_CONSTANTS.BOSS_SEAL_Z,
  portalHalfWidth: SOULS_CASTLE_CONSTANTS.BOSS_PORTAL_HALF_W,
  portalWidth: SOULS_CASTLE_CONSTANTS.BOSS_PORTAL_HALF_W * 2,
  portalHeight: 6.4,
  interactX: 0,
  interactZ: -14.2,
  interactRadius: 3.1,
  promptOpenRu: 'Открыть врата'
});

export const SOULS_CASTLE_THRONE_CONFIG = Object.freeze({
  x: 0,
  z: -41.6,
  sitZ: -40.9,
  riseZ: -39.6,
  standZ: -37.4,
  heroEntryZ: SOULS_CASTLE_CONSTANTS.BOSS_HERO_ENTRY_Z,
  footrestY: 0.50,
  lowerStepY: 0.25,
  seatY: 1.53
});

// ============================================================================
// 1. Canonical Walkable Rooms & Architectural Floor Slabs
// ============================================================================
export const SOULS_CASTLE_ROOMS = Object.freeze({
  courtyard: Object.freeze({
    id: 'courtyard',
    labelRu: 'Зал Костра',
    shape: 'rect',
    minX: -9.0,
    maxX: 9.0,
    minZ: 20.0,
    maxZ: 38.0,
    surface: 'stone_courtyard',
    floorY: 0,
    ceilingY: 11.4,
    isBranch: false,
    isConnector: false,
    requiresOpenDoor: false
  }),
  corridor: Object.freeze({
    id: 'corridor',
    labelRu: 'Замковый Коридор',
    shape: 'rect',
    minX: -5.0,
    maxX: 5.0,
    minZ: -16.0,
    maxZ: 20.0,
    surface: 'stone_bridge',
    floorY: 0,
    ceilingY: 10.2,
    isBranch: false,
    isConnector: false,
    requiresOpenDoor: false
  }),
  east_arch: Object.freeze({
    id: 'east_arch',
    labelRu: 'Арка Восточного Алькова',
    shape: 'rect',
    minX: 5.0,
    maxX: 5.8,
    minZ: -2.8,
    maxZ: 2.0,
    surface: 'stone_bridge',
    floorY: 0,
    ceilingY: 5.8,
    isBranch: true,
    isConnector: true,
    requiresOpenDoor: false
  }),
  east_alcove: Object.freeze({
    id: 'east_alcove',
    labelRu: 'Восточный Альков — Оружейная',
    shape: 'rect',
    minX: 5.8,
    maxX: 13.8,
    minZ: -5.0,
    maxZ: 4.0,
    surface: 'cathedral_stone',
    floorY: 0,
    ceilingY: 8.9,
    isBranch: true,
    isConnector: false,
    requiresOpenDoor: false
  }),
  boss_portal: Object.freeze({
    id: 'boss_portal',
    labelRu: 'Порог Врат Босса',
    shape: 'rect',
    minX: -3.15,
    maxX: 3.15,
    minZ: -17.8,
    maxZ: -15.0,
    surface: 'cathedral_stone',
    floorY: 0,
    ceilingY: 7.65,
    isBranch: false,
    isConnector: true,
    requiresOpenDoor: true
  }),
  boss_hall: Object.freeze({
    id: 'boss_hall',
    labelRu: 'Тронный Зал Босса',
    shape: 'circle',
    cx: 0,
    cz: -31.2,
    radius: 16.0,
    maxZ: -16.2,
    surface: 'cathedral_stone',
    floorY: 0,
    ceilingY: 18.2,
    isBranch: false,
    isConnector: false,
    requiresOpenDoor: true
  })
});

export const SOULS_CASTLE_ROOM_LIST = Object.freeze(Object.values(SOULS_CASTLE_ROOMS));

// Non-overlapping architectural stone floor slabs (safe for merged mesh generation without Z-fighting)
export const SOULS_CASTLE_FLOOR_SLABS = Object.freeze([
  Object.freeze({
    id: 'floor_courtyard',
    roomId: 'courtyard',
    shape: 'rect',
    cx: 0,
    cz: 29.3,
    width: 19.2,
    depth: 18.6,
    y: 0,
    surface: 'stone_courtyard'
  }),
  Object.freeze({
    id: 'floor_corridor',
    roomId: 'corridor',
    shape: 'rect',
    cx: 0,
    cz: 1.8,
    width: 11.2,
    depth: 36.4,
    y: 0,
    surface: 'stone_bridge'
  }),
  Object.freeze({
    id: 'floor_east_alcove',
    roomId: 'east_alcove',
    shape: 'rect',
    cx: 9.9,
    cz: -0.5,
    width: 8.6,
    depth: 10.2,
    y: 0,
    surface: 'cathedral_stone'
  }),
  Object.freeze({
    id: 'floor_boss_hall',
    roomId: 'boss_hall',
    shape: 'circle',
    cx: 0,
    cz: -31.2,
    radius: 16.8,
    y: -0.004,
    surface: 'cathedral_stone'
  })
]);

// ============================================================================
// 2. Internal Walkable Primitives (Deep-Overlap Minkowski-Safe Union)
//    Each connector extends deeply into its two adjacent rooms (while remaining
//    100% inside the true walkable union) so Minkowski erosion by `r <= 1.25`
//    ALWAYS overlaps seamlessly across every archway — ZERO invisible walls!
// ============================================================================
const CASTLE_SIDE_RECTS = Object.freeze([
  Object.freeze({ id: 'courtyard', minX: -9.0, maxX: 9.0, minZ: 20.0, maxZ: 38.0 }),
  Object.freeze({ id: 'corridor', minX: -5.0, maxX: 5.0, minZ: -16.0, maxZ: 22.5 }),
  Object.freeze({ id: 'east_arch', minX: 2.5, maxX: 8.3, minZ: -2.8, maxZ: 2.0 }),
  Object.freeze({ id: 'east_alcove', minX: 5.8, maxX: 13.8, minZ: -5.0, maxZ: 4.0 })
]);

const BOSS_PORTAL_RECT = Object.freeze({
  id: 'boss_portal',
  minX: -3.15,
  maxX: 3.15,
  minZ: -19.2,
  maxZ: -13.6
});

const BOSS_HALL_CAPPED_DISK = Object.freeze({
  id: 'boss_hall',
  cx: SOULS_CASTLE_CONSTANTS.BOSS_CENTER_X,
  cz: SOULS_CASTLE_CONSTANTS.BOSS_CENTER_Z,
  radius: SOULS_CASTLE_CONSTANTS.BOSS_RADIUS,
  maxZ: SOULS_CASTLE_CONSTANTS.BOSS_SEAL_Z
});

function isInsideErodedRect(x, z, rect, r) {
  const minX = rect.minX + r;
  const maxX = rect.maxX - r;
  const minZ = rect.minZ + r;
  const maxZ = rect.maxZ - r;
  if (minX > maxX || minZ > maxZ) return false;
  return x >= minX && x <= maxX && z >= minZ && z <= maxZ;
}

function projectToErodedRect(x, z, rect, r, out) {
  let minX = rect.minX + r;
  let maxX = rect.maxX - r;
  let minZ = rect.minZ + r;
  let maxZ = rect.maxZ - r;
  if (minX > maxX) {
    const midX = (rect.minX + rect.maxX) * 0.5;
    minX = midX;
    maxX = midX;
  }
  if (minZ > maxZ) {
    const midZ = (rect.minZ + rect.maxZ) * 0.5;
    minZ = midZ;
    maxZ = midZ;
  }
  const px = x < minX ? minX : (x > maxX ? maxX : x);
  const pz = z < minZ ? minZ : (z > maxZ ? maxZ : z);
  const dx = x - px;
  const dz = z - pz;
  out.x = px;
  out.z = pz;
  out.distSq = dx * dx + dz * dz;
  return out;
}

function isInsideErodedCappedDisk(x, z, disk, r) {
  const effR = Math.max(0.05, disk.radius - r);
  const capZ = disk.maxZ - r;
  if (z > capZ) return false;
  const dx = x - disk.cx;
  const dz = z - disk.cz;
  return dx * dx + dz * dz <= effR * effR + 1e-9;
}

// Exact Euclidean projection onto intersection of Disk(cx, cz, R - r) and Half-plane(z <= maxZ - r)
function projectToErodedCappedDisk(x, z, disk, r, out) {
  const effR = Math.max(0.05, disk.radius - r);
  const capZ = disk.maxZ - r;
  const dx = x - disk.cx;
  const dz = z - disk.cz;
  const distSq = dx * dx + dz * dz;

  if (z <= capZ && distSq <= effR * effR) {
    out.x = x;
    out.z = z;
    out.distSq = 0;
    return out;
  }

  // Chord half-width where z = capZ intersects the eroded circle
  const capDz = capZ - disk.cz;
  const capHalfXSq = effR * effR - capDz * capDz;
  const capHalfX = capHalfXSq > 0 ? Math.sqrt(capHalfXSq) : 0;

  // Candidate 1: closest point on the flat seal chord (z = capZ, x in [-capHalfX, +capHalfX])
  let bestX = disk.cx + (dx < -capHalfX ? -capHalfX : (dx > capHalfX ? capHalfX : dx));
  let bestZ = capZ;
  let bestDistSq = (x - bestX) * (x - bestX) + (z - bestZ) * (z - bestZ);

  // Candidate 2: radial projection onto the circular arc (valid iff projected z <= capZ)
  if (distSq > 1e-12) {
    const invDist = effR / Math.sqrt(distSq);
    const arcX = disk.cx + dx * invDist;
    const arcZ = disk.cz + dz * invDist;
    if (arcZ <= capZ + 1e-9) {
      const adx = x - arcX;
      const adz = z - arcZ;
      const arcDistSq = adx * adx + adz * adz;
      if (arcDistSq < bestDistSq) {
        bestX = arcX;
        bestZ = arcZ;
        bestDistSq = arcDistSq;
      }
    }
  } else {
    const cdz = z - Math.min(disk.cz, capZ);
    const cDistSq = dx * dx + cdz * cdz;
    if (cDistSq < bestDistSq) {
      bestX = disk.cx;
      bestZ = Math.min(disk.cz, capZ);
      bestDistSq = cDistSq;
    }
  }

  out.x = bestX;
  out.z = bestZ;
  out.distSq = bestDistSq;
  return out;
}

const _tmpProj = { x: 0, z: 0, distSq: 0 };

function resolveActiveDomain(z, bossDoorState, allowBossHallOpt) {
  const doorState = bossDoorState || 'closed';
  if (doorState === 'open') {
    return 'full_open';
  }
  if (doorState === 'sealed') {
    // Explicit `allowBossHall: false` allows corridor mobs outside to remain clamped on the castle side
    if (allowBossHallOpt === false) {
      return 'castle_only';
    }
    return 'boss_only';
  }
  // 'closed' or 'opening'
  if (allowBossHallOpt === true && z < SOULS_CASTLE_CONSTANTS.BOSS_DOOR_Z) {
    return 'boss_only';
  }
  return 'castle_only';
}

function isInsideDomain(x, z, r, domain) {
  if (domain === 'boss_only') {
    return isInsideErodedCappedDisk(x, z, BOSS_HALL_CAPPED_DISK, r);
  }
  for (let i = 0; i < CASTLE_SIDE_RECTS.length; i++) {
    if (isInsideErodedRect(x, z, CASTLE_SIDE_RECTS[i], r)) return true;
  }
  if (domain === 'full_open') {
    return (
      isInsideErodedRect(x, z, BOSS_PORTAL_RECT, r) ||
      isInsideErodedCappedDisk(x, z, BOSS_HALL_CAPPED_DISK, r)
    );
  }
  return false;
}

/**
 * Exact, zero-seam position clamping for the entire castle level.
 *
 * - Keeps player & enemies strictly inside the union of walkable rooms & archways
 *   with exact Minkowski margin `radius` from every exterior wall & archway jamb.
 * - Zero invisible walls inside the Courtyard<->Corridor arch, Corridor<->East Alcove arch,
 *   or open Boss Doors.
 * - Enforces Boss Door barrier:
 *     * `'closed'` / `'opening'`: castle side clamped to `z >= -16.0 + r`
 *       (actors inside boss hall with `allowBossHall: true` stay clamped to `z <= -16.2 - r`).
 *     * `'open'`: full seamless passage across `z = -16.0` through `x in [-3.15, +3.15]`.
 *     * `'sealed'`: player/boss clamped strictly inside Boss Hall (`z <= -16.2 - r`).
 *
 * @param {number} x
 * @param {number} z
 * @param {number} [radius=0.55]
 * @param {{ bossDoorState?: 'closed'|'opening'|'open'|'sealed', allowBossHall?: boolean, out?: { x: number, z: number } }} [options]
 * @returns {{ x: number, z: number }}
 */
export function clampCastlePosition(x, z, radius = 0.55, options = {}) {
  const opts = options || {};
  const bossDoorState = opts.bossDoorState || 'closed';
  const allowBossHallOpt = opts.allowBossHall;
  const out = opts.out || { x: 0, z: 0 };

  const r = Number.isFinite(radius) ? Math.max(0, Math.min(2.2, radius)) : 0.55;
  const safeX = Number.isFinite(x) ? x : 0;
  const safeZ = Number.isFinite(z)
    ? z
    : (bossDoorState === 'sealed' ? SOULS_CASTLE_CONSTANTS.BOSS_CENTER_Z : SOULS_CASTLE_PLAYER_SPAWN.z);

  const domain = resolveActiveDomain(safeZ, bossDoorState, allowBossHallOpt);

  if (domain === 'boss_only') {
    projectToErodedCappedDisk(safeX, safeZ, BOSS_HALL_CAPPED_DISK, r, _tmpProj);
    out.x = _tmpProj.x;
    out.z = _tmpProj.z;
    return out;
  }

  // Fast path: if already inside ANY active eroded primitive, return untouched (0 jitter!)
  if (isInsideDomain(safeX, safeZ, r, domain)) {
    out.x = safeX;
    out.z = safeZ;
    return out;
  }

  // Exterior point: pick exact nearest Euclidean projection across all active eroded primitives
  let bestX = SOULS_CASTLE_PLAYER_SPAWN.x;
  let bestZ = SOULS_CASTLE_PLAYER_SPAWN.z;
  let bestDistSq = Infinity;

  for (let i = 0; i < CASTLE_SIDE_RECTS.length; i++) {
    projectToErodedRect(safeX, safeZ, CASTLE_SIDE_RECTS[i], r, _tmpProj);
    if (_tmpProj.distSq < bestDistSq) {
      bestDistSq = _tmpProj.distSq;
      bestX = _tmpProj.x;
      bestZ = _tmpProj.z;
    }
  }

  if (domain === 'full_open') {
    projectToErodedRect(safeX, safeZ, BOSS_PORTAL_RECT, r, _tmpProj);
    if (_tmpProj.distSq < bestDistSq) {
      bestDistSq = _tmpProj.distSq;
      bestX = _tmpProj.x;
      bestZ = _tmpProj.z;
    }
    projectToErodedCappedDisk(safeX, safeZ, BOSS_HALL_CAPPED_DISK, r, _tmpProj);
    if (_tmpProj.distSq < bestDistSq) {
      bestDistSq = _tmpProj.distSq;
      bestX = _tmpProj.x;
      bestZ = _tmpProj.z;
    }
  }

  out.x = bestX;
  out.z = bestZ;
  return out;
}

/**
 * Checks whether (x, z) is validly inside the eroded walkable domain for the given door state.
 */
export function isInsideCastleWalkable(x, z, radius = 0.55, options = {}) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  const opts = options || {};
  const r = Number.isFinite(radius) ? Math.max(0, Math.min(2.2, radius)) : 0.55;
  const domain = resolveActiveDomain(z, opts.bossDoorState || 'closed', opts.allowBossHall);
  return isInsideDomain(x, z, r, domain);
}

/**
 * Returns true if (x, z) is inside the Bonfire Safe Zone (R = 9.5m around Bonfire).
 */
export function isInBonfireSafeZone(x, z, extraMargin = 0) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  const r = SOULS_BONFIRE_SAFE_RADIUS + (Number.isFinite(extraMargin) ? extraMargin : 0);
  const dx = x - SOULS_CASTLE_BONFIRE.x;
  const dz = z - SOULS_CASTLE_BONFIRE.z;
  return dx * dx + dz * dz <= r * r;
}

/**
 * Returns the canonical room id at world coordinates (x, z), or null if outside walls.
 */
export function getCastleRoomAt(x = 0, z = 0) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  if (x >= -9.0 && x <= 9.0 && z >= 20.0 && z <= 38.0) return 'courtyard';
  if (x >= -5.0 && x <= 5.0 && z >= -16.0 && z <= 20.0) return 'corridor';
  if (x > 5.0 && x < 5.8 && z >= -2.8 && z <= 2.0) return 'east_arch';
  if (x >= 5.8 && x <= 13.8 && z >= -5.0 && z <= 4.0) return 'east_alcove';
  if (z < -16.0) {
    if (z >= -17.8 && Math.abs(x) <= 3.15) return 'boss_portal';
    const dx = x - SOULS_CASTLE_CONSTANTS.BOSS_CENTER_X;
    const dz = z - SOULS_CASTLE_CONSTANTS.BOSS_CENTER_Z;
    if (dx * dx + dz * dz <= SOULS_CASTLE_CONSTANTS.BOSS_RADIUS * SOULS_CASTLE_CONSTANTS.BOSS_RADIUS) {
      return 'boss_hall';
    }
  }
  return null;
}

/**
 * Exact Spring-Arm Camera Collision Resolver against all Castle Perimeter Walls,
 * Archway Piers, Vaulted Ceilings, and Sealed/Closed Boss Doors (z = -16.0 / -16.2).
 *
 * Guarantees:
 *   - Camera NEVER clips outside solid castle walls into the void.
 *   - Camera NEVER tunnels through thin 0.8m interior piers (fine raymarch + 8-iter binary search).
 *   - When player is inside Boss Hall (`targetZ < BOSS_DOOR_Z`) or `doorState === 'sealed'`,
 *     the Boss Door plane is a HARD SOLID WALL (`z <= BOSS_SEAL_Z - pad`), preventing the camera
 *     from getting trapped outside sealed Boss Doors after cutscene skip or boss fight start!
 *
 * @param {number} targetX
 * @param {number} targetY
 * @param {number} targetZ
 * @param {number} camX
 * @param {number} camY
 * @param {number} camZ
 * @param {'closed'|'opening'|'open'|'sealed'} [doorState='closed']
 * @param {{ pad?: number, minY?: number, step?: number, out?: { x: number, y: number, z: number, hitWall: boolean, fraction: number } }} [options]
 * @returns {{ x: number, y: number, z: number, hitWall: boolean, fraction: number }}
 */
const _camOriginTmp = { x: 0, z: 0 };

function getCeilingHeightForRoom(roomId) {
  switch (roomId) {
    case 'courtyard': return 10.6;
    case 'corridor': return 9.2;
    case 'east_arch': return 5.4;
    case 'east_alcove': return 8.1;
    case 'boss_portal': return 7.1;
    case 'boss_hall': return 16.8;
    default: return 9.0;
  }
}

export function clampCastleCameraPosition(
  targetX,
  targetY,
  targetZ,
  camX,
  camY,
  camZ,
  doorState = 'closed',
  options = {}
) {
  const opts = options || {};
  const pad = Number.isFinite(opts.pad) ? Math.max(0.15, Math.min(1.2, opts.pad)) : 0.48;
  const minY = Number.isFinite(opts.minY) ? opts.minY : 0.65;
  const stepSize = Number.isFinite(opts.step) ? Math.max(0.1, opts.step) : 0.22;
  const out = opts.out || { x: 0, y: 0, z: 0, hitWall: false, fraction: 1 };

  const st = doorState || 'closed';
  const tx = Number.isFinite(targetX) ? targetX : 0;
  const ty = Number.isFinite(targetY) ? targetY : 1.5;
  const tz = Number.isFinite(targetZ)
    ? targetZ
    : (st === 'sealed' ? SOULS_CASTLE_CONSTANTS.BOSS_HERO_ENTRY_Z : SOULS_CASTLE_PLAYER_SPAWN.z);
  const cx = Number.isFinite(camX) ? camX : tx;
  const cy = Number.isFinite(camY) ? camY : ty + 3.5;
  const cz = Number.isFinite(camZ) ? camZ : tz + 6.0;

  // Determine exact camera domain anchored to the focus target's side of the Boss Door!
  let domain;
  if (st === 'open') {
    domain = 'full_open';
  } else if (st === 'sealed' || tz < SOULS_CASTLE_CONSTANTS.BOSS_DOOR_Z) {
    domain = 'boss_only';
  } else {
    domain = 'castle_only';
  }

  // Ensure ray origin (ox, oz) sits strictly inside the valid padded camera domain
  let ox = tx;
  let oz = tz;
  if (!isInsideDomain(ox, oz, pad, domain)) {
    const clampOpts = {
      bossDoorState: domain === 'boss_only' ? 'sealed' : (domain === 'full_open' ? 'open' : 'closed'),
      allowBossHall: domain === 'boss_only',
      out: _camOriginTmp
    };
    clampCastlePosition(ox, oz, pad, clampOpts);
    ox = _camOriginTmp.x;
    oz = _camOriginTmp.z;
  }

  const dx = cx - ox;
  const dy = cy - ty;
  const dz = cz - oz;
  const horizLen = Math.hypot(dx, dz);

  let hitFraction = 1.0;
  let hitWall = false;

  if (horizLen > 1e-5) {
    const steps = Math.max(1, Math.min(128, Math.ceil(horizLen / stepSize)));
    let prevT = 0.0;
    let blockedT = -1.0;

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const px = ox + dx * t;
      const pz = oz + dz * t;
      if (!isInsideDomain(px, pz, pad, domain)) {
        blockedT = t;
        break;
      }
      prevT = t;
    }

    if (blockedT >= 0) {
      hitWall = true;
      let lo = prevT;
      let hi = blockedT;
      for (let iter = 0; iter < 8; iter++) {
        const mid = (lo + hi) * 0.5;
        if (isInsideDomain(ox + dx * mid, oz + dz * mid, pad, domain)) {
          lo = mid;
        } else {
          hi = mid;
        }
      }
      hitFraction = lo;
    }
  }

  const resX = ox + dx * hitFraction;
  const resZ = oz + dz * hitFraction;
  const room = getCastleRoomAt(resX, resZ) || (domain === 'boss_only' ? 'boss_hall' : 'corridor');
  const maxCeilY = getCeilingHeightForRoom(room);
  const rawY = ty + dy * hitFraction;
  const resY = rawY < minY ? minY : (rawY > maxCeilY ? maxCeilY : rawY);

  out.x = resX;
  out.y = resY;
  out.z = resZ;
  out.hitWall = hitWall || rawY !== resY;
  out.fraction = hitFraction;
  return out;
}

/**
 * Returns audio-compatible stone surface type for `soulsEnvAudio.js` & `audio.js`:
 *   - `'stone_courtyard'` (Bonfire Hall)
 *   - `'stone_bridge'`    (Vaulted Castle Corridor & East Archway)
 *   - `'cathedral_stone'` (East Relic Chapel Alcove & Boss Throne Cathedral)
 */
export function getCastleSurfaceType(x = 0, z = 0) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return 'stone_courtyard';
  if (z < SOULS_CASTLE_CONSTANTS.BOSS_DOOR_Z) return 'cathedral_stone';
  if (x >= SOULS_CASTLE_CONSTANTS.EAST_ALCOVE_MIN_X && z >= -5.0 && z <= 4.0) {
    return 'cathedral_stone';
  }
  if (z >= SOULS_CASTLE_CONSTANTS.COURTYARD_MIN_Z) return 'stone_courtyard';
  return 'stone_bridge';
}

/**
 * Returns true if the player at (x, z) is standing in front of the closed Boss Doors and can press [E].
 */
export function canInteractWithBossDoor(x, z, bossDoorState = 'closed') {
  if (bossDoorState !== 'closed') return false;
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  if (z < SOULS_CASTLE_CONSTANTS.BOSS_DOOR_Z - 0.1) return false;
  const dx = x - SOULS_CASTLE_DOOR_CONFIG.interactX;
  const dz = z - SOULS_CASTLE_DOOR_CONFIG.interactZ;
  return dx * dx + dz * dz <= SOULS_CASTLE_DOOR_CONFIG.interactRadius * SOULS_CASTLE_DOOR_CONFIG.interactRadius;
}

// ============================================================================
// 3. Watertight Architectural Wall Segments (Solid Perimeter + Boss Cathedral)
//    Note: `courtyard_south` is full-height (`role: 'perimeter'`, 8.6m) so NO
//    empty sky void ever shows behind the Bonfire!
// ============================================================================
function makeAxisWall({ id, role, roomId, axis, x1, z1, x2, z2, thickness, height, normalX, normalZ, fullHeight = false }) {
  const isX = axis === 'x';
  const length = isX ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
  // Shift wall center outward by thickness/2 along (-normalX, -normalZ) so (x1,z1)-(x2,z2) is exact inner face
  const cx = (x1 + x2) * 0.5 - normalX * (thickness * 0.5);
  const cz = (z1 + z2) * 0.5 - normalZ * (thickness * 0.5);
  return Object.freeze({
    id,
    role,
    roomId,
    axis,
    x: Number(cx.toFixed(4)),
    z: Number(cz.toFixed(4)),
    length: Number(length.toFixed(4)),
    thickness,
    height,
    angleY: isX ? 0 : Math.PI * 0.5,
    x1,
    z1,
    x2,
    z2,
    normalX,
    normalZ,
    fullHeight
  });
}

function buildBossCathedralWallSegments() {
  const segs = [];
  const cx = SOULS_CASTLE_CONSTANTS.BOSS_CENTER_X;
  const cz = SOULS_CASTLE_CONSTANTS.BOSS_CENTER_Z;
  const innerR = SOULS_CASTLE_CONSTANTS.BOSS_RADIUS;
  const thickness = 1.5;
  const height = SOULS_CASTLE_CONSTANTS.BOSS_WALL_HEIGHT;
  const count = 16;

  // Leave exact Boss Door opening x in [-3.15, +3.15] on the south (+Z) side of the circle
  const doorHalfAng = Math.asin(SOULS_CASTLE_CONSTANTS.BOSS_PORTAL_HALF_W / innerR);
  const startAng = Math.PI * 0.5 + doorHalfAng;
  const endAng = Math.PI * 2.5 - doorHalfAng;
  const stepAng = (endAng - startAng) / count;
  // Scale vertex radius by 1 / cos(stepAng/2) so the inner flat chord midpoint sits at exact R = 16.00m
  const vertexR = innerR / Math.cos(stepAng * 0.5);
  const midR = innerR + thickness * 0.5;

  for (let i = 0; i < count; i++) {
    const a0 = startAng + i * stepAng;
    const a1 = a0 + stepAng;
    const am = (a0 + a1) * 0.5;
    const x1 = cx + Math.cos(a0) * vertexR;
    const z1 = cz + Math.sin(a0) * vertexR;
    const x2 = cx + Math.cos(a1) * vertexR;
    const z2 = cz + Math.sin(a1) * vertexR;
    const chordLen = Math.hypot(x2 - x1, z2 - z1) + 0.4; // slight miter overlap for watertight corners
    const mx = cx + Math.cos(am) * midR;
    const mz = cz + Math.sin(am) * midR;
    const nx = -Math.cos(am);
    const nz = -Math.sin(am);
    const angleY = -Math.atan2(z2 - z1, x2 - x1);

    segs.push(
      Object.freeze({
        id: `boss_hall_wall_${i + 1}`,
        role: 'boss_cathedral',
        roomId: 'boss_hall',
        axis: 'angled',
        x: Number(mx.toFixed(4)),
        z: Number(mz.toFixed(4)),
        length: Number(chordLen.toFixed(4)),
        thickness,
        height,
        angleY: Number(angleY.toFixed(5)),
        x1: Number(x1.toFixed(4)),
        z1: Number(z1.toFixed(4)),
        x2: Number(x2.toFixed(4)),
        z2: Number(z2.toFixed(4)),
        normalX: Number(nx.toFixed(4)),
        normalZ: Number(nz.toFixed(4)),
        fullHeight: true
      })
    );
  }
  return segs;
}

export const SOULS_CASTLE_WALL_SEGMENTS = Object.freeze([
  // --- Bonfire Hall (Courtyard) Perimeter (FULL-HEIGHT South Wall behind Bonfire!) ---
  makeAxisWall({
    id: 'courtyard_south',
    role: 'perimeter',
    roomId: 'courtyard',
    axis: 'x',
    x1: -10.2,
    z1: 38.0,
    x2: 10.2,
    z2: 38.0,
    thickness: 1.2,
    height: SOULS_CASTLE_CONSTANTS.COURTYARD_WALL_HEIGHT,
    normalX: 0,
    normalZ: -1,
    fullHeight: true
  }),
  makeAxisWall({
    id: 'courtyard_west',
    role: 'perimeter',
    roomId: 'courtyard',
    axis: 'z',
    x1: -9.0,
    z1: 18.8,
    x2: -9.0,
    z2: 38.0,
    thickness: 1.2,
    height: SOULS_CASTLE_CONSTANTS.COURTYARD_WALL_HEIGHT,
    normalX: 1,
    normalZ: 0,
    fullHeight: true
  }),
  makeAxisWall({
    id: 'courtyard_east',
    role: 'perimeter',
    roomId: 'courtyard',
    axis: 'z',
    x1: 9.0,
    z1: 18.8,
    x2: 9.0,
    z2: 38.0,
    thickness: 1.2,
    height: SOULS_CASTLE_CONSTANTS.COURTYARD_WALL_HEIGHT,
    normalX: -1,
    normalZ: 0,
    fullHeight: true
  }),
  makeAxisWall({
    id: 'courtyard_north_west',
    role: 'perimeter',
    roomId: 'courtyard',
    axis: 'x',
    x1: -10.2,
    z1: 20.0,
    x2: -5.0,
    z2: 20.0,
    thickness: 1.2,
    height: SOULS_CASTLE_CONSTANTS.COURTYARD_WALL_HEIGHT,
    normalX: 0,
    normalZ: 1,
    fullHeight: true
  }),
  makeAxisWall({
    id: 'courtyard_north_east',
    role: 'perimeter',
    roomId: 'courtyard',
    axis: 'x',
    x1: 5.0,
    z1: 20.0,
    x2: 10.2,
    z2: 20.0,
    thickness: 1.2,
    height: SOULS_CASTLE_CONSTANTS.COURTYARD_WALL_HEIGHT,
    normalX: 0,
    normalZ: 1,
    fullHeight: true
  }),

  // --- Central Castle Corridor Walls (36m long x 10m wide) ---
  makeAxisWall({
    id: 'corridor_west',
    role: 'perimeter',
    roomId: 'corridor',
    axis: 'z',
    x1: -5.0,
    z1: -16.7,
    x2: -5.0,
    z2: 20.0,
    thickness: 1.2,
    height: SOULS_CASTLE_CONSTANTS.CORRIDOR_WALL_HEIGHT,
    normalX: 1,
    normalZ: 0,
    fullHeight: true
  }),
  makeAxisWall({
    id: 'corridor_east_south',
    role: 'perimeter',
    roomId: 'corridor',
    axis: 'z',
    x1: 5.0,
    z1: 4.0,
    x2: 5.0,
    z2: 20.0,
    thickness: 1.2,
    height: SOULS_CASTLE_CONSTANTS.CORRIDOR_WALL_HEIGHT,
    normalX: -1,
    normalZ: 0,
    fullHeight: true
  }),
  makeAxisWall({
    id: 'corridor_east_north_ext',
    role: 'perimeter',
    roomId: 'corridor',
    axis: 'z',
    x1: 5.0,
    z1: -16.7,
    x2: 5.0,
    z2: -5.0,
    thickness: 1.2,
    height: SOULS_CASTLE_CONSTANTS.CORRIDOR_WALL_HEIGHT,
    normalX: -1,
    normalZ: 0,
    fullHeight: true
  }),

  // --- East Alcove Interior Archway Piers (0.8m thick masonry between x=5.0 and x=5.8) ---
  makeAxisWall({
    id: 'east_arch_pier_south',
    role: 'interior_pier',
    roomId: 'east_arch',
    axis: 'z',
    x1: 5.0,
    z1: 2.0,
    x2: 5.0,
    z2: 4.0,
    thickness: SOULS_CASTLE_CONSTANTS.INTERIOR_PIER_THICKNESS,
    height: SOULS_CASTLE_CONSTANTS.CORRIDOR_WALL_HEIGHT,
    normalX: -1,
    normalZ: 0,
    fullHeight: true
  }),
  makeAxisWall({
    id: 'east_arch_pier_north',
    role: 'interior_pier',
    roomId: 'east_arch',
    axis: 'z',
    x1: 5.0,
    z1: -5.0,
    x2: 5.0,
    z2: -2.8,
    thickness: SOULS_CASTLE_CONSTANTS.INTERIOR_PIER_THICKNESS,
    height: SOULS_CASTLE_CONSTANTS.CORRIDOR_WALL_HEIGHT,
    normalX: -1,
    normalZ: 0,
    fullHeight: true
  }),

  // --- Compact East Alcove (Armory Chapel) Outer Perimeter Walls ---
  makeAxisWall({
    id: 'east_alcove_south',
    role: 'perimeter_south',
    roomId: 'east_alcove',
    axis: 'x',
    x1: 5.0,
    z1: 4.0,
    x2: 15.0,
    z2: 4.0,
    thickness: 1.2,
    height: SOULS_CASTLE_CONSTANTS.ALCOVE_WALL_HEIGHT,
    normalX: 0,
    normalZ: -1,
    fullHeight: true
  }),
  makeAxisWall({
    id: 'east_alcove_east',
    role: 'perimeter',
    roomId: 'east_alcove',
    axis: 'z',
    x1: 13.8,
    z1: -6.2,
    x2: 13.8,
    z2: 5.2,
    thickness: 1.2,
    height: SOULS_CASTLE_CONSTANTS.ALCOVE_WALL_HEIGHT,
    normalX: -1,
    normalZ: 0,
    fullHeight: true
  }),
  makeAxisWall({
    id: 'east_alcove_north',
    role: 'perimeter',
    roomId: 'east_alcove',
    axis: 'x',
    x1: 5.0,
    z1: -5.0,
    x2: 15.0,
    z2: -5.0,
    thickness: 1.2,
    height: SOULS_CASTLE_CONSTANTS.ALCOVE_WALL_HEIGHT,
    normalX: 0,
    normalZ: 1,
    fullHeight: true
  }),

  // --- Boss Door Stone Jambs (joining Corridor ±5.0 to Boss Door pivots ±3.15 at z=-16.0) ---
  Object.freeze({
    id: 'boss_door_jamb_west',
    role: 'jamb',
    roomId: 'boss_portal',
    axis: 'x',
    x: -4.675,
    z: -16.0,
    length: 3.05,
    thickness: 1.4,
    height: 9.2,
    angleY: 0,
    x1: -6.2,
    z1: -15.3,
    x2: -3.15,
    z2: -15.3,
    normalX: 0,
    normalZ: 1,
    fullHeight: true
  }),
  Object.freeze({
    id: 'boss_door_jamb_east',
    role: 'jamb',
    roomId: 'boss_portal',
    axis: 'x',
    x: 4.675,
    z: -16.0,
    length: 3.05,
    thickness: 1.4,
    height: 9.2,
    angleY: 0,
    x1: 3.15,
    z1: -15.3,
    x2: 6.2,
    z2: -15.3,
    normalX: 0,
    normalZ: 1,
    fullHeight: true
  }),

  // --- Boss Throne Cathedral Circular Curtain Wall (16 watertight segments, R=16.0) ---
  ...buildBossCathedralWallSegments()
]);

// ============================================================================
// 4. Gothic Archways & Portal Openings
// ============================================================================
export const SOULS_CASTLE_ARCHES = Object.freeze([
  Object.freeze({
    id: 'grand_corridor_arch',
    roomId: 'courtyard',
    connects: Object.freeze(['courtyard', 'corridor']),
    x: 0,
    z: 19.6,
    axis: 'x',
    spanWidth: 10.0,
    halfSpan: 5.0,
    springY: 5.0,
    apexY: 7.8,
    depth: 1.2,
    cameraFade: true
  }),
  Object.freeze({
    id: 'corridor_south_arch',
    roomId: 'corridor',
    connects: Object.freeze(['corridor', 'corridor']),
    x: 0,
    z: 10.2,
    axis: 'x',
    spanWidth: 10.0,
    halfSpan: 5.0,
    springY: 5.0,
    apexY: 7.7,
    depth: 1.05,
    cameraFade: true
  }),
  Object.freeze({
    id: 'corridor_mid_arch',
    roomId: 'corridor',
    connects: Object.freeze(['corridor', 'corridor']),
    x: 0,
    z: -5.4,
    axis: 'x',
    spanWidth: 10.0,
    halfSpan: 5.0,
    springY: 5.0,
    apexY: 7.7,
    depth: 1.05,
    cameraFade: true
  }),
  Object.freeze({
    id: 'east_alcove_arch',
    roomId: 'east_arch',
    connects: Object.freeze(['corridor', 'east_alcove']),
    x: 5.4,
    z: -0.4,
    axis: 'z',
    spanWidth: 4.8,
    halfSpan: 2.4,
    springY: 3.6,
    apexY: 5.8,
    depth: 0.92,
    cameraFade: true
  }),
  Object.freeze({
    id: 'boss_door_portal',
    roomId: 'boss_portal',
    connects: Object.freeze(['corridor', 'boss_hall']),
    x: 0,
    z: -16.0,
    axis: 'x',
    spanWidth: 6.3,
    halfSpan: 3.15,
    springY: 4.75,
    apexY: 7.65,
    depth: 1.48,
    cameraFade: false
  })
]);

// ============================================================================
// 5. Structural Gothic Pillars, Floor Braziers (with Solid Colliders!),
//    Wall-Mounted Lantern Sconces, Candle Clusters & Castle Banners
// ============================================================================
export const SOULS_CASTLE_PILLARS = Object.freeze([
  // Bonfire Hall interior nave columns (huge 12.7m open center around Bonfire)
  Object.freeze({ id: 'pillar_court_sw', roomId: 'courtyard', x: -7.2, z: 30.2, height: 7.4, broken: false, collider: true, radius: 0.85 }),
  Object.freeze({ id: 'pillar_court_se', roomId: 'courtyard', x: 7.2, z: 30.2, height: 7.4, broken: false, collider: true, radius: 0.85 }),
  Object.freeze({ id: 'pillar_court_nw', roomId: 'courtyard', x: -7.2, z: 23.2, height: 6.2, broken: true, collider: true, radius: 0.85 }),
  Object.freeze({ id: 'pillar_court_ne', roomId: 'courtyard', x: 7.2, z: 23.2, height: 7.4, broken: false, collider: true, radius: 0.85 }),

  // Boss Cathedral outer colonnade (R ~ 12.8m on R=16.0 arena, leaving ~23.6m open duel ring!)
  Object.freeze({ id: 'pillar_boss_nw', roomId: 'boss_hall', x: -7.8, z: -41.4, height: 10.8, broken: false, collider: true, radius: 0.92 }),
  Object.freeze({ id: 'pillar_boss_ne', roomId: 'boss_hall', x: 7.8, z: -41.4, height: 10.8, broken: false, collider: true, radius: 0.92 }),
  Object.freeze({ id: 'pillar_boss_w', roomId: 'boss_hall', x: -12.8, z: -31.2, height: 10.2, broken: false, collider: true, radius: 0.92 }),
  Object.freeze({ id: 'pillar_boss_e', roomId: 'boss_hall', x: 12.8, z: -31.2, height: 7.0, broken: true, collider: true, radius: 0.92 }),
  Object.freeze({ id: 'pillar_boss_sw', roomId: 'boss_hall', x: -10.2, z: -23.2, height: 9.8, broken: false, collider: true, radius: 0.92 }),
  Object.freeze({ id: 'pillar_boss_se', roomId: 'boss_hall', x: 10.2, z: -23.2, height: 9.8, broken: false, collider: true, radius: 0.92 })
]);

// Solid floor wrought-iron lantern braziers (every brazier carries an explicit collider radius!)
export const SOULS_CASTLE_BRAZIERS = Object.freeze([
  // Courtyard flanking Bonfire & Grand Archway
  Object.freeze({ id: 'brazier_bonfire_w', roomId: 'courtyard', x: -4.4, z: 33.8, scale: 1.0, radius: 0.56 }),
  Object.freeze({ id: 'brazier_bonfire_e', roomId: 'courtyard', x: 4.4, z: 33.8, scale: 1.0, radius: 0.56 }),
  Object.freeze({ id: 'brazier_grand_arch_w', roomId: 'courtyard', x: -6.2, z: 21.4, scale: 1.05, radius: 0.59 }),
  Object.freeze({ id: 'brazier_grand_arch_e', roomId: 'courtyard', x: 6.2, z: 21.4, scale: 1.05, radius: 0.59 }),

  // Corridor flanking Boss Doors
  Object.freeze({ id: 'brazier_boss_door_w', roomId: 'corridor', x: -4.0, z: -14.4, scale: 1.05, radius: 0.59 }),
  Object.freeze({ id: 'brazier_boss_door_e', roomId: 'corridor', x: 4.0, z: -14.4, scale: 1.05, radius: 0.59 }),

  // East Alcove flanking the Relic Shrine
  Object.freeze({ id: 'brazier_alcove_n', roomId: 'east_alcove', x: 12.2, z: -3.3, scale: 0.92, radius: 0.52 }),
  Object.freeze({ id: 'brazier_alcove_s', roomId: 'east_alcove', x: 12.2, z: 2.5, scale: 0.92, radius: 0.52 }),

  // Boss Throne Hall ceremonial braziers (enlarged R=16.0 cathedral)
  Object.freeze({ id: 'brazier_boss_entry_w', roomId: 'boss_hall', x: -8.2, z: -20.4, scale: 1.1, radius: 0.62 }),
  Object.freeze({ id: 'brazier_boss_entry_e', roomId: 'boss_hall', x: 8.2, z: -20.4, scale: 1.1, radius: 0.62 }),
  Object.freeze({ id: 'brazier_throne_w', roomId: 'boss_hall', x: -9.6, z: -38.4, scale: 1.15, radius: 0.64 }),
  Object.freeze({ id: 'brazier_throne_e', roomId: 'boss_hall', x: 9.6, z: -38.4, scale: 1.15, radius: 0.64 })
]);

// Wall-mounted gothic wrought-iron lantern sconces along castle walls (warm amber / firelight)
function buildBossWallLanterns() {
  const lanterns = [];
  const anglesDeg = [-145, -108, -72, -36, 36, 72, 108, 145]; // 0 deg = North (-Z) behind throne
  const r = SOULS_CASTLE_CONSTANTS.BOSS_RADIUS - 0.16;
  for (let i = 0; i < anglesDeg.length; i++) {
    const rad = (anglesDeg[i] * Math.PI) / 180;
    const x = Math.sin(rad) * r;
    const z = SOULS_CASTLE_CONSTANTS.BOSS_CENTER_Z - Math.cos(rad) * r;
    lanterns.push(
      Object.freeze({
        id: `lantern_boss_${i + 1}`,
        roomId: 'boss_hall',
        x: Number(x.toFixed(3)),
        y: 3.8,
        z: Number(z.toFixed(3)),
        normalX: Number((-Math.sin(rad)).toFixed(4)),
        normalZ: Number(Math.cos(rad).toFixed(4)),
        color: 0xff8c3a,
        intensity: 2.4,
        distance: 15.0
      })
    );
  }
  return lanterns;
}

export const SOULS_CASTLE_WALL_LANTERNS = Object.freeze([
  // Courtyard West wall
  Object.freeze({ id: 'lantern_court_w1', roomId: 'courtyard', x: -8.85, y: 3.2, z: 34.5, normalX: 1, normalZ: 0, color: 0xff9240, intensity: 2.1, distance: 12.5 }),
  Object.freeze({ id: 'lantern_court_w2', roomId: 'courtyard', x: -8.85, y: 3.2, z: 28.5, normalX: 1, normalZ: 0, color: 0xff9240, intensity: 2.1, distance: 12.5 }),
  Object.freeze({ id: 'lantern_court_w3', roomId: 'courtyard', x: -8.85, y: 3.2, z: 22.8, normalX: 1, normalZ: 0, color: 0xff9240, intensity: 2.1, distance: 12.5 }),
  // Courtyard East wall
  Object.freeze({ id: 'lantern_court_e1', roomId: 'courtyard', x: 8.85, y: 3.2, z: 34.5, normalX: -1, normalZ: 0, color: 0xff9240, intensity: 2.1, distance: 12.5 }),
  Object.freeze({ id: 'lantern_court_e2', roomId: 'courtyard', x: 8.85, y: 3.2, z: 28.5, normalX: -1, normalZ: 0, color: 0xff9240, intensity: 2.1, distance: 12.5 }),
  Object.freeze({ id: 'lantern_court_e3', roomId: 'courtyard', x: 8.85, y: 3.2, z: 22.8, normalX: -1, normalZ: 0, color: 0xff9240, intensity: 2.1, distance: 12.5 }),
  // Courtyard South wall (full height!)
  Object.freeze({ id: 'lantern_court_s1', roomId: 'courtyard', x: -4.4, y: 3.2, z: 37.85, normalX: 0, normalZ: -1, color: 0xff9240, intensity: 1.9, distance: 11.5 }),
  Object.freeze({ id: 'lantern_court_s2', roomId: 'courtyard', x: 4.4, y: 3.2, z: 37.85, normalX: 0, normalZ: -1, color: 0xff9240, intensity: 1.9, distance: 11.5 }),

  // Corridor West & East walls (36m corridor, respecting East Alcove opening z in [-2.8, +2.0] and Flame Traps)
  Object.freeze({ id: 'lantern_corr_w1', roomId: 'corridor', x: -4.85, y: 3.2, z: 15.5, normalX: 1, normalZ: 0, color: 0xff8a34, intensity: 2.2, distance: 12.0 }),
  Object.freeze({ id: 'lantern_corr_w2', roomId: 'corridor', x: -4.85, y: 3.2, z: 4.5, normalX: 1, normalZ: 0, color: 0xff8a34, intensity: 2.2, distance: 12.0 }),
  Object.freeze({ id: 'lantern_corr_w3', roomId: 'corridor', x: -4.85, y: 3.2, z: -1.8, normalX: 1, normalZ: 0, color: 0xff8a34, intensity: 2.2, distance: 12.0 }),
  Object.freeze({ id: 'lantern_corr_w4', roomId: 'corridor', x: -4.85, y: 3.2, z: -10.8, normalX: 1, normalZ: 0, color: 0xff8a34, intensity: 2.2, distance: 12.0 }),
  Object.freeze({ id: 'lantern_corr_e1', roomId: 'corridor', x: 4.85, y: 3.2, z: 15.5, normalX: -1, normalZ: 0, color: 0xff8a34, intensity: 2.2, distance: 12.0 }),
  Object.freeze({ id: 'lantern_corr_e2', roomId: 'corridor', x: 4.85, y: 3.2, z: 7.5, normalX: -1, normalZ: 0, color: 0xff8a34, intensity: 2.2, distance: 12.0 }),
  Object.freeze({ id: 'lantern_corr_e3', roomId: 'corridor', x: 4.85, y: 3.2, z: -10.8, normalX: -1, normalZ: 0, color: 0xff8a34, intensity: 2.2, distance: 12.0 }),

  // East Alcove interior sconces (leading the eye toward the Relic Shrine)
  Object.freeze({ id: 'lantern_alcove_n', roomId: 'east_alcove', x: 9.8, y: 3.0, z: -4.85, normalX: 0, normalZ: 1, color: 0xffa042, intensity: 2.3, distance: 11.0 }),
  Object.freeze({ id: 'lantern_alcove_s', roomId: 'east_alcove', x: 9.8, y: 3.0, z: 3.85, normalX: 0, normalZ: -1, color: 0xffa042, intensity: 2.3, distance: 11.0 }),

  // Boss Hall Cathedral sconces (8 sconces around R=16.0 cathedral)
  ...buildBossWallLanterns()
]);

export const SOULS_CASTLE_CANDLE_CLUSTERS = Object.freeze([
  Object.freeze({ id: 'candles_bonfire_w', roomId: 'courtyard', x: -1.65, y: 0, z: 33.6, count: 5, radius: 0.42 }),
  Object.freeze({ id: 'candles_bonfire_e', roomId: 'courtyard', x: 1.7, y: 0, z: 33.3, count: 4, radius: 0.38 }),
  Object.freeze({ id: 'candles_bonfire_nw', roomId: 'courtyard', x: -1.45, y: 0, z: 31.2, count: 4, radius: 0.35 }),
  Object.freeze({ id: 'candles_shrine_n', roomId: 'east_alcove', x: 11.4, y: 0, z: -1.65, count: 5, radius: 0.4 }),
  Object.freeze({ id: 'candles_shrine_s', roomId: 'east_alcove', x: 11.4, y: 0, z: 0.85, count: 5, radius: 0.4 }),
  Object.freeze({ id: 'candles_door_w', roomId: 'corridor', x: -3.9, y: 0, z: -15.15, count: 4, radius: 0.36 }),
  Object.freeze({ id: 'candles_door_e', roomId: 'corridor', x: 3.9, y: 0, z: -15.15, count: 4, radius: 0.36 }),
  Object.freeze({ id: 'candles_throne_w', roomId: 'boss_hall', x: -3.2, y: 0.25, z: -39.6, count: 6, radius: 0.46 }),
  Object.freeze({ id: 'candles_throne_e', roomId: 'boss_hall', x: 3.2, y: 0.25, z: -39.6, count: 6, radius: 0.46 })
]);

export const SOULS_CASTLE_BANNERS = Object.freeze([
  Object.freeze({ id: 'banner_court_nw', roomId: 'courtyard', x: -7.0, y: 4.8, z: 20.12, normalX: 0, normalZ: 1, width: 1.25, height: 3.2 }),
  Object.freeze({ id: 'banner_court_ne', roomId: 'courtyard', x: 7.0, y: 4.8, z: 20.12, normalX: 0, normalZ: 1, width: 1.25, height: 3.2 }),
  Object.freeze({ id: 'banner_corr_w1', roomId: 'corridor', x: -4.88, y: 4.7, z: 12.6, normalX: 1, normalZ: 0, width: 1.15, height: 3.0 }),
  Object.freeze({ id: 'banner_corr_w2', roomId: 'corridor', x: -4.88, y: 4.7, z: 1.0, normalX: 1, normalZ: 0, width: 1.15, height: 3.0 }),
  Object.freeze({ id: 'banner_corr_w3', roomId: 'corridor', x: -4.88, y: 4.7, z: -12.6, normalX: 1, normalZ: 0, width: 1.15, height: 3.0 }),
  Object.freeze({ id: 'banner_corr_e1', roomId: 'corridor', x: 4.88, y: 4.7, z: 12.6, normalX: -1, normalZ: 0, width: 1.15, height: 3.0 }),
  Object.freeze({ id: 'banner_alcove_n', roomId: 'east_alcove', x: 13.68, y: 4.5, z: -2.6, normalX: -1, normalZ: 0, width: 1.1, height: 2.9 }),
  Object.freeze({ id: 'banner_alcove_s', roomId: 'east_alcove', x: 13.68, y: 4.5, z: 1.8, normalX: -1, normalZ: 0, width: 1.1, height: 2.9 }),
  Object.freeze({ id: 'banner_boss_nw', roomId: 'boss_hall', x: -4.8, y: 6.2, z: -45.8, normalX: 0.3, normalZ: 0.95, width: 1.65, height: 4.4 }),
  Object.freeze({ id: 'banner_boss_ne', roomId: 'boss_hall', x: 4.8, y: 6.2, z: -45.8, normalX: -0.3, normalZ: 0.95, width: 1.65, height: 4.4 })
]);

// ============================================================================
// 5b. Ribbed Gothic Vaulted Ceilings, Wrought-Iron Chandeliers,
//     Clerestory God-Ray Light Shafts & East Alcove Armory Decor
// ============================================================================
export const SOULS_CASTLE_VAULTS = Object.freeze([
  // Bonfire Hall (Courtyard) — 3 soaring ribbed gothic groin-vault nave bays
  Object.freeze({
    id: 'vault_courtyard_south',
    roomId: 'courtyard',
    kind: 'ribbed_groin',
    cx: 0,
    cz: 35.0,
    spanX: 18.0,
    spanZ: 6.2,
    springY: 7.4,
    apexY: 11.4,
    ribThick: 0.42,
    hasOculus: true,
    oculusRadius: 2.3,
    oculusX: 0,
    oculusZ: 32.5,
    cameraFade: true
  }),
  Object.freeze({
    id: 'vault_courtyard_mid',
    roomId: 'courtyard',
    kind: 'ribbed_groin',
    cx: 0,
    cz: 29.0,
    spanX: 18.0,
    spanZ: 6.0,
    springY: 7.4,
    apexY: 11.4,
    ribThick: 0.42,
    hasOculus: false,
    cameraFade: true
  }),
  Object.freeze({
    id: 'vault_courtyard_north',
    roomId: 'courtyard',
    kind: 'ribbed_groin',
    cx: 0,
    cz: 23.0,
    spanX: 18.0,
    spanZ: 6.2,
    springY: 7.4,
    apexY: 11.4,
    ribThick: 0.42,
    hasOculus: false,
    cameraFade: true
  }),

  // Central Castle Corridor (36m x 10m) — 6 pointed ogive ribbed vault bays
  Object.freeze({ id: 'vault_corridor_1', roomId: 'corridor', kind: 'ribbed_groin', cx: 0, cz: 17.0, spanX: 10.0, spanZ: 6.2, springY: 6.6, apexY: 10.2, ribThick: 0.38, hasOculus: false, cameraFade: true }),
  Object.freeze({ id: 'vault_corridor_2', roomId: 'corridor', kind: 'ribbed_groin', cx: 0, cz: 11.0, spanX: 10.0, spanZ: 6.0, springY: 6.6, apexY: 10.2, ribThick: 0.38, hasOculus: false, cameraFade: true }),
  Object.freeze({ id: 'vault_corridor_3', roomId: 'corridor', kind: 'ribbed_groin', cx: 0, cz: 5.0, spanX: 10.0, spanZ: 6.0, springY: 6.6, apexY: 10.2, ribThick: 0.38, hasOculus: false, cameraFade: true }),
  Object.freeze({ id: 'vault_corridor_4', roomId: 'corridor', kind: 'ribbed_groin', cx: 0, cz: -1.0, spanX: 10.0, spanZ: 6.0, springY: 6.6, apexY: 10.2, ribThick: 0.38, hasOculus: false, cameraFade: true }),
  Object.freeze({ id: 'vault_corridor_5', roomId: 'corridor', kind: 'ribbed_groin', cx: 0, cz: -7.0, spanX: 10.0, spanZ: 6.0, springY: 6.6, apexY: 10.2, ribThick: 0.38, hasOculus: false, cameraFade: true }),
  Object.freeze({ id: 'vault_corridor_6', roomId: 'corridor', kind: 'ribbed_groin', cx: 0, cz: -13.0, spanX: 10.0, spanZ: 6.2, springY: 6.6, apexY: 10.2, ribThick: 0.38, hasOculus: false, cameraFade: true }),

  // East Alcove (Armory Chapel) — single cross-ribbed gothic chapel vault
  Object.freeze({
    id: 'vault_east_alcove',
    roomId: 'east_alcove',
    kind: 'ribbed_groin',
    cx: 9.8,
    cz: -0.5,
    spanX: 8.0,
    spanZ: 9.0,
    springY: 5.8,
    apexY: 8.9,
    ribThick: 0.34,
    hasOculus: false,
    cameraFade: true
  }),

  // Boss Throne Cathedral (enlarged R=16.0) — monumental 16-ribbed radial dome vault
  Object.freeze({
    id: 'vault_boss_cathedral',
    roomId: 'boss_hall',
    kind: 'radial_cathedral_dome',
    cx: SOULS_CASTLE_CONSTANTS.BOSS_CENTER_X,
    cz: SOULS_CASTLE_CONSTANTS.BOSS_CENTER_Z,
    radius: 16.2,
    springY: 10.8,
    apexY: 18.2,
    ribCount: 16,
    ribThick: 0.5,
    hasOculus: true,
    oculusRadius: 4.0,
    oculusX: SOULS_CASTLE_CONSTANTS.BOSS_CENTER_X,
    oculusZ: SOULS_CASTLE_CONSTANTS.BOSS_CENTER_Z,
    cameraFade: false
  })
]);

export const SOULS_CASTLE_CHANDELIERS = Object.freeze([
  Object.freeze({
    id: 'chandelier_courtyard_center',
    roomId: 'courtyard',
    x: 0,
    z: 26.8,
    hangFromY: 11.4,
    ringY: 7.1,
    chainLength: 4.3,
    ringRadius: 2.0,
    tierCount: 2,
    candleCount: 12,
    lightColor: 0xffa04a,
    lightIntensity: 2.4,
    lightDistance: 15.5,
    swayAmp: 0.014,
    swaySpeed: 0.62,
    swayPhase: 0.0,
    cameraFade: true
  }),
  Object.freeze({
    id: 'chandelier_corridor_south',
    roomId: 'corridor',
    x: 0,
    z: 14.0,
    hangFromY: 10.2,
    ringY: 6.3,
    chainLength: 3.9,
    ringRadius: 1.45,
    tierCount: 1,
    candleCount: 8,
    lightColor: 0xff943e,
    lightIntensity: 2.0,
    lightDistance: 13.0,
    swayAmp: 0.015,
    swaySpeed: 0.7,
    swayPhase: 1.1,
    cameraFade: true
  }),
  Object.freeze({
    id: 'chandelier_corridor_mid',
    roomId: 'corridor',
    x: 0,
    z: 2.0,
    hangFromY: 10.2,
    ringY: 6.3,
    chainLength: 3.9,
    ringRadius: 1.45,
    tierCount: 1,
    candleCount: 8,
    lightColor: 0xff943e,
    lightIntensity: 2.0,
    lightDistance: 13.0,
    swayAmp: 0.015,
    swaySpeed: 0.67,
    swayPhase: 2.3,
    cameraFade: true
  }),
  Object.freeze({
    id: 'chandelier_corridor_north',
    roomId: 'corridor',
    x: 0,
    z: -10.0,
    hangFromY: 10.2,
    ringY: 6.3,
    chainLength: 3.9,
    ringRadius: 1.45,
    tierCount: 1,
    candleCount: 8,
    lightColor: 0xff943e,
    lightIntensity: 2.0,
    lightDistance: 13.0,
    swayAmp: 0.015,
    swaySpeed: 0.69,
    swayPhase: 3.5,
    cameraFade: true
  }),
  Object.freeze({
    id: 'chandelier_east_alcove',
    roomId: 'east_alcove',
    x: 9.8,
    z: -0.5,
    hangFromY: 8.9,
    ringY: 5.5,
    chainLength: 3.4,
    ringRadius: 1.25,
    tierCount: 1,
    candleCount: 8,
    lightColor: 0xffaa4c,
    lightIntensity: 2.2,
    lightDistance: 11.5,
    swayAmp: 0.012,
    swaySpeed: 0.74,
    swayPhase: 4.1,
    cameraFade: true
  }),
  Object.freeze({
    id: 'chandelier_boss_center',
    roomId: 'boss_hall',
    x: 0,
    z: -31.2,
    hangFromY: 18.2,
    ringY: 10.4,
    chainLength: 7.8,
    ringRadius: 3.5,
    tierCount: 2,
    candleCount: 18,
    lightColor: 0xff963c,
    lightIntensity: 3.1,
    lightDistance: 24.0,
    swayAmp: 0.01,
    swaySpeed: 0.48,
    swayPhase: 0.6,
    cameraFade: false
  }),
  Object.freeze({
    id: 'chandelier_boss_throne',
    roomId: 'boss_hall',
    x: 0,
    z: -38.6,
    hangFromY: 15.6,
    ringY: 9.4,
    chainLength: 6.2,
    ringRadius: 2.0,
    tierCount: 1,
    candleCount: 10,
    lightColor: 0xff8a32,
    lightIntensity: 2.5,
    lightDistance: 17.5,
    swayAmp: 0.011,
    swaySpeed: 0.54,
    swayPhase: 4.5,
    cameraFade: false
  })
]);

function makeClerestoryShaft({
  id,
  roomId,
  windowX,
  windowY,
  windowZ,
  windowWidth,
  windowHeight,
  normalX,
  normalZ,
  targetX,
  targetZ,
  topRadius,
  bottomRadius,
  color,
  opacity,
  priority
}) {
  const targetY = 0.02;
  const dx = targetX - windowX;
  const dy = targetY - windowY;
  const dz = targetZ - windowZ;
  const length = Math.hypot(dx, dy, dz);
  const invLen = length > 1e-6 ? 1 / length : 1;
  return Object.freeze({
    id,
    roomId,
    windowX,
    windowY,
    windowZ,
    windowWidth,
    windowHeight,
    normalX,
    normalZ,
    targetX,
    targetY,
    targetZ,
    dirX: Number((dx * invLen).toFixed(5)),
    dirY: Number((dy * invLen).toFixed(5)),
    dirZ: Number((dz * invLen).toFixed(5)),
    length: Number(length.toFixed(4)),
    topRadius,
    bottomRadius,
    color,
    opacity,
    priority
  });
}

export const SOULS_CASTLE_CLERESTORY_SHAFTS = Object.freeze([
  makeClerestoryShaft({
    id: 'shaft_bonfire_oculus',
    roomId: 'courtyard',
    windowX: -8.2,
    windowY: 8.1,
    windowZ: 31.8,
    windowWidth: 1.65,
    windowHeight: 3.1,
    normalX: 1,
    normalZ: 0,
    targetX: 0.2,
    targetZ: 32.5,
    topRadius: 0.95,
    bottomRadius: 2.65,
    color: 0xa7c2ef,
    opacity: 0.14,
    priority: 1
  }),
  makeClerestoryShaft({
    id: 'shaft_courtyard_nave',
    roomId: 'courtyard',
    windowX: -8.85,
    windowY: 6.8,
    windowZ: 23.8,
    windowWidth: 1.35,
    windowHeight: 2.8,
    normalX: 1,
    normalZ: 0,
    targetX: -1.2,
    targetZ: 22.8,
    topRadius: 0.75,
    bottomRadius: 2.15,
    color: 0x9cb9e8,
    opacity: 0.12,
    priority: 2
  }),
  makeClerestoryShaft({
    id: 'shaft_corridor_south',
    roomId: 'corridor',
    windowX: -4.88,
    windowY: 6.5,
    windowZ: 13.8,
    windowWidth: 1.25,
    windowHeight: 2.7,
    normalX: 1,
    normalZ: 0,
    targetX: 1.4,
    targetZ: 12.2,
    topRadius: 0.7,
    bottomRadius: 2.05,
    color: 0x9cb9e8,
    opacity: 0.13,
    priority: 1
  }),
  makeClerestoryShaft({
    id: 'shaft_corridor_mid',
    roomId: 'corridor',
    windowX: -4.88,
    windowY: 6.5,
    windowZ: 1.5,
    windowWidth: 1.25,
    windowHeight: 2.7,
    normalX: 1,
    normalZ: 0,
    targetX: 1.5,
    targetZ: -0.2,
    topRadius: 0.7,
    bottomRadius: 2.05,
    color: 0x9cb9e8,
    opacity: 0.12,
    priority: 2
  }),
  makeClerestoryShaft({
    id: 'shaft_corridor_doors',
    roomId: 'corridor',
    windowX: -4.88,
    windowY: 6.7,
    windowZ: -11.4,
    windowWidth: 1.35,
    windowHeight: 2.9,
    normalX: 1,
    normalZ: 0,
    targetX: 0.4,
    targetZ: -14.4,
    topRadius: 0.75,
    bottomRadius: 2.35,
    color: 0xaec8f2,
    opacity: 0.15,
    priority: 1
  }),
  makeClerestoryShaft({
    id: 'shaft_east_alcove_shrine',
    roomId: 'east_alcove',
    windowX: 13.65,
    windowY: 6.1,
    windowZ: -0.4,
    windowWidth: 1.25,
    windowHeight: 2.5,
    normalX: -1,
    normalZ: 0,
    targetX: 10.2,
    targetZ: -0.4,
    topRadius: 0.65,
    bottomRadius: 1.85,
    color: 0xe6b87d,
    opacity: 0.15,
    priority: 1
  }),
  makeClerestoryShaft({
    id: 'shaft_boss_arena_west',
    roomId: 'boss_hall',
    windowX: -15.2,
    windowY: 10.2,
    windowZ: -28.0,
    windowWidth: 2.1,
    windowHeight: 4.5,
    normalX: 0.98,
    normalZ: -0.2,
    targetX: -2.0,
    targetZ: -30.8,
    topRadius: 1.25,
    bottomRadius: 3.8,
    color: 0xa4c0ee,
    opacity: 0.14,
    priority: 1
  }),
  makeClerestoryShaft({
    id: 'shaft_boss_throne',
    roomId: 'boss_hall',
    windowX: -6.5,
    windowY: 10.8,
    windowZ: -44.8,
    windowWidth: 2.2,
    windowHeight: 4.6,
    normalX: 0.43,
    normalZ: 0.9,
    targetX: 0.0,
    targetZ: -40.4,
    topRadius: 1.2,
    bottomRadius: 3.4,
    color: 0xb6ccf5,
    opacity: 0.16,
    priority: 1
  })
]);

export const SOULS_CASTLE_ALCOVE_DECOR = Object.freeze([
  // Floor gothic weapon racks tucked flush along East Alcove north & south walls
  Object.freeze({
    id: 'alcove_weapon_rack_nw',
    roomId: 'east_alcove',
    kind: 'weapon_rack',
    style: 'greatswords_halberds',
    x: 9.6,
    y: 0,
    z: -4.45,
    facing: 0,
    width: 1.8,
    height: 1.85,
    depth: 0.65,
    collider: true,
    radius: 0.62
  }),
  Object.freeze({
    id: 'alcove_weapon_rack_sw',
    roomId: 'east_alcove',
    kind: 'weapon_rack',
    style: 'longswords_spears',
    x: 9.6,
    y: 0,
    z: 3.45,
    facing: Math.PI,
    width: 1.8,
    height: 1.85,
    depth: 0.65,
    collider: true,
    radius: 0.62
  }),

  // Flanking knight armor stands in the NW & SW inner corners of the East Alcove
  Object.freeze({
    id: 'alcove_armor_stand_n',
    roomId: 'east_alcove',
    kind: 'armor_stand',
    style: 'ashen_plate',
    x: 6.45,
    y: 0,
    z: -4.25,
    facing: Math.PI * 0.25,
    collider: true,
    radius: 0.48
  }),
  Object.freeze({
    id: 'alcove_armor_stand_s',
    roomId: 'east_alcove',
    kind: 'armor_stand',
    style: 'ashen_plate',
    x: 6.45,
    y: 0,
    z: 3.15,
    facing: Math.PI * 0.75,
    collider: true,
    radius: 0.48
  }),

  // Wall-mounted gothic heraldic shields & crossed blades (zero floor obstruction)
  Object.freeze({
    id: 'alcove_shield_n1',
    roomId: 'east_alcove',
    kind: 'wall_shield',
    crest: 'ashen_crown',
    crossedSwords: true,
    x: 8.0,
    y: 2.85,
    z: -4.92,
    normalX: 0,
    normalZ: 1,
    scale: 1.0,
    collider: false
  }),
  Object.freeze({
    id: 'alcove_shield_n2',
    roomId: 'east_alcove',
    kind: 'wall_shield',
    crest: 'iron_cross',
    crossedSwords: false,
    x: 11.2,
    y: 2.85,
    z: -4.92,
    normalX: 0,
    normalZ: 1,
    scale: 0.95,
    collider: false
  }),
  Object.freeze({
    id: 'alcove_shield_s1',
    roomId: 'east_alcove',
    kind: 'wall_shield',
    crest: 'ashen_crown',
    crossedSwords: true,
    x: 8.0,
    y: 2.85,
    z: 3.92,
    normalX: 0,
    normalZ: -1,
    scale: 1.0,
    collider: false
  }),
  Object.freeze({
    id: 'alcove_shield_s2',
    roomId: 'east_alcove',
    kind: 'wall_shield',
    crest: 'iron_cross',
    crossedSwords: false,
    x: 11.2,
    y: 2.85,
    z: 3.92,
    normalX: 0,
    normalZ: -1,
    scale: 0.95,
    collider: false
  }),
  Object.freeze({
    id: 'alcove_shield_shrine_crest',
    roomId: 'east_alcove',
    kind: 'wall_shield',
    crest: 'relic_sun_shield',
    crossedSwords: true,
    x: 13.72,
    y: 3.65,
    z: -0.4,
    normalX: -1,
    normalZ: 0,
    scale: 1.28,
    collider: false
  })
]);

// ============================================================================
// 5c. Timed Wall Flame Jet Traps & East Alcove Flank Ambush
// ============================================================================
export const SOULS_CASTLE_FLAME_TRAPS = Object.freeze([
  Object.freeze({
    id: 'flame_trap_corridor_south',
    roomId: 'corridor',
    side: 'west',
    x: -4.92,
    y: 1.15,
    z: 7.5,
    dirX: 1,
    dirZ: 0,
    phaseOffset: 0.0,
    telegraphSec: 0.95,
    jetSec: 1.55,
    cycleSec: 4.8,
    jetLength: 7.4,
    jetHalfWidth: 1.15,
    damagePerTick: 18,
    tickIntervalSec: 0.35
  }),
  Object.freeze({
    id: 'flame_trap_corridor_mid',
    roomId: 'corridor',
    side: 'east',
    // Mounted solidly on east_arch_pier_south (z in [2.0, 4.0]) rather than floating inside open east_arch!
    x: 4.92,
    y: 1.15,
    z: 2.8,
    dirX: -1,
    dirZ: 0,
    phaseOffset: 1.6,
    telegraphSec: 0.95,
    jetSec: 1.55,
    cycleSec: 4.8,
    jetLength: 7.4,
    jetHalfWidth: 1.15,
    damagePerTick: 18,
    tickIntervalSec: 0.35
  }),
  Object.freeze({
    id: 'flame_trap_corridor_north',
    roomId: 'corridor',
    side: 'west',
    x: -4.92,
    y: 1.15,
    z: -5.5,
    dirX: 1,
    dirZ: 0,
    phaseOffset: 3.2,
    telegraphSec: 0.95,
    jetSec: 1.55,
    cycleSec: 4.8,
    jetLength: 7.4,
    jetHalfWidth: 1.15,
    damagePerTick: 18,
    tickIntervalSec: 0.35
  })
]);

/**
 * Deterministic flame trap phase evaluator shared by `soulsFireVfx.js` & `combat.js`.
 */
export function evaluateFlameTrapState(trap, elapsedSec = 0) {
  const cycle = trap.cycleSec || 4.8;
  const tele = trap.telegraphSec || 0.95;
  const jet = trap.jetSec || 1.55;
  const t = (((Number(elapsedSec) || 0) + (trap.phaseOffset || 0)) % cycle + cycle) % cycle;

  if (t < tele) {
    const p = t / tele;
    return { phase: 'telegraph', phase01: p, intensity: 0.25 + 0.75 * p, activeHitbox: null };
  }
  if (t < tele + jet) {
    const p = (t - tele) / jet;
    const ramp = p < 0.12 ? (p / 0.12) : (p > 0.85 ? ((1 - p) / 0.15) : 1.0);
    const curLen = trap.jetLength * (0.35 + 0.65 * Math.min(1, p / 0.14));
    const endX = trap.x + trap.dirX * curLen;
    const minX = Math.min(trap.x, endX);
    const maxX = Math.max(trap.x, endX);
    return {
      phase: 'jet',
      phase01: p,
      intensity: Math.max(0, Math.min(1, ramp)),
      activeHitbox: {
        id: trap.id,
        minX,
        maxX,
        minZ: trap.z - trap.jetHalfWidth,
        maxZ: trap.z + trap.jetHalfWidth,
        damagePerTick: trap.damagePerTick,
        tickIntervalSec: trap.tickIntervalSec
      }
    };
  }
  const idleDur = Math.max(0.01, cycle - tele - jet);
  return {
    phase: 'idle',
    phase01: (t - tele - jet) / idleDur,
    intensity: 0,
    activeHitbox: null
  };
}

export const SOULS_CASTLE_AMBUSHES = Object.freeze([
  Object.freeze({
    id: 'east_alcove_flank_ambush',
    encounterId: 'east_alcove_warden',
    baitEncounterId: 'corridor_archer',
    roomId: 'east_alcove',
    // Triggers when player approaches the East Alcove archway while spotting the Archer ahead
    triggerBox: Object.freeze({
      minX: -5.0,
      maxX: 6.4,
      minZ: -3.2,
      maxZ: 2.2
    }),
    waitPos: Object.freeze({ x: 8.1, z: -3.0, facing: -2.25 }),
    exitArchPos: Object.freeze({ x: 5.4, z: -0.4 }),
    sprintTargetPos: Object.freeze({ x: 1.8, z: -0.6 }),
    sprintSpeedMult: 1.28,
    warCryToastRu: '⚔️ ЗАСАДА ИЗ ОРУЖЕЙНОЙ!'
  })
]);

/**
 * Checks whether player position (x, z) crosses any untriggered ambush zone.
 * @param {number} x
 * @param {number} z
 * @param {Set<string>|Record<string, boolean>|null} [triggeredIds]
 */
export function checkCastleAmbushTrigger(x, z, triggeredIds = null) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  for (let i = 0; i < SOULS_CASTLE_AMBUSHES.length; i++) {
    const amb = SOULS_CASTLE_AMBUSHES[i];
    if (triggeredIds) {
      const done = typeof triggeredIds.has === 'function'
        ? triggeredIds.has(amb.id)
        : Boolean(triggeredIds[amb.id]);
      if (done) continue;
    }
    const b = amb.triggerBox;
    if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) {
      return amb;
    }
  }
  return null;
}

// ============================================================================
// 6. Relic Shrines & Handcrafted Souls Encounters
// ============================================================================
export const SOULS_CASTLE_RELICS = Object.freeze([
  Object.freeze({
    id: 'east_estus_shrine',
    roomId: 'east_alcove',
    x: 12.2,
    z: -0.4,
    facing: -Math.PI * 0.5,
    colliderRadius: 0.85,
    interactRadius: 2.35,
    rewardType: 'estus_charge',
    estusBonus: 1,
    damageBonusPct: 0,
    titleRu: 'Алтарь Пепельной Фляги',
    promptRu: 'Забрать Реликвию (+1 Фляга Эстуса)',
    claimedToastRu: '🔥 РЕЛИКВИЯ ПОЛУЧЕНА • +1 Фляга Эстуса (5/5)!',
    glowColor: 0xf59e0b
  })
]);

export const SOULS_CASTLE_ENCOUNTERS = Object.freeze([
  Object.freeze({
    id: 'courtyard_guard',
    type: 'iron_knight',
    roomId: 'corridor',
    // Positioned well beyond Bonfire Safe Zone (R=9.5m around (0, 32.5) -> safe to z=23.0)
    x: 0.0,
    z: 16.0,
    facing: 0,
    nameRu: 'Полый Страж',
    hp: 260,
    damage: 28,
    speed: 2.55,
    xp: 45,
    gold: 35,
    scale: 1.18,
    soulsRole: 'duelist',
    staggerMax: 65,
    flatDef: 22,
    physNegation: 0.14,
    aggroRange: 9.0,
    isOptional: false,
    isAmbushGuard: false
  }),
  Object.freeze({
    id: 'corridor_footman',
    type: 'cursed_footman',
    roomId: 'corridor',
    // Positioned cleanly between Flame Trap 1 (z=7.5) and Flame Trap 2 (z=2.8)
    x: -1.4,
    z: 5.1,
    facing: 0,
    nameRu: 'Щитоносец Коридора',
    hp: 220,
    damage: 24,
    speed: 2.45,
    xp: 40,
    gold: 30,
    scale: 1.12,
    soulsRole: 'guard',
    staggerMax: 45,
    flatDef: 12,
    physNegation: 0.06,
    aggroRange: 9.2,
    isOptional: false,
    isAmbushGuard: false
  }),
  Object.freeze({
    id: 'east_alcove_warden',
    type: 'iron_knight',
    roomId: 'east_alcove',
    // Hidden behind north archway pier; springs out on `east_alcove_flank_ambush` trigger!
    x: 8.1,
    z: -3.0,
    facing: -2.25,
    nameRu: 'Страж Оружейной',
    hp: 245,
    damage: 27,
    speed: 2.5,
    xp: 55,
    gold: 45,
    scale: 1.16,
    soulsRole: 'duelist',
    staggerMax: 60,
    flatDef: 20,
    physNegation: 0.12,
    aggroRange: 6.8,
    isOptional: true,
    isAmbushGuard: true,
    ambushId: 'east_alcove_flank_ambush',
    guardsRelicId: 'east_estus_shrine'
  }),
  Object.freeze({
    id: 'corridor_archer',
    type: 'bone_archer',
    roomId: 'corridor',
    // Visible down the north corridor beyond Flame Trap 3 (z=-5.5), baiting player past East Alcove
    x: 1.6,
    z: -10.8,
    facing: 0,
    nameRu: 'Пепельный Стрелок',
    hp: 155,
    damage: 20,
    speed: 2.15,
    xp: 35,
    gold: 25,
    scale: 1.08,
    soulsRole: 'archer',
    staggerMax: 35,
    flatDef: 10,
    physNegation: 0.02,
    aggroRange: 12.2,
    isOptional: false,
    isAmbushGuard: false
  })
]);

/**
 * Finds the nearest unclaimed Relic Shrine within interaction distance of (x, z).
 * @param {number} x
 * @param {number} z
 * @param {Set<string>|Record<string, boolean>|null} [claimedIds]
 */
export function findInteractableRelic(x, z, claimedIds = null) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  let best = null;
  let bestDistSq = Infinity;
  for (let i = 0; i < SOULS_CASTLE_RELICS.length; i++) {
    const relic = SOULS_CASTLE_RELICS[i];
    if (claimedIds) {
      const isClaimed = typeof claimedIds.has === 'function'
        ? claimedIds.has(relic.id)
        : Boolean(claimedIds[relic.id]);
      if (isClaimed) continue;
    }
    const dx = x - relic.x;
    const dz = z - relic.z;
    const dSq = dx * dx + dz * dz;
    const maxSq = relic.interactRadius * relic.interactRadius;
    if (dSq <= maxSq && dSq < bestDistSq) {
      bestDistSq = dSq;
      best = relic;
    }
  }
  return best;
}

/**
 * Returns all static cylindrical obstacle colliders in the castle:
 * Bonfire + 12 Floor Lantern Braziers + 10 Gothic Pillars + Relic Shrine Altar
 * + 4 East Alcove Armory floor props (weapon racks & armor stands).
 */
export function getCastleStaticColliders() {
  const cols = [
    {
      id: SOULS_CASTLE_BONFIRE.id,
      kind: 'bonfire',
      x: SOULS_CASTLE_BONFIRE.x,
      z: SOULS_CASTLE_BONFIRE.z,
      radius: SOULS_CASTLE_BONFIRE.colliderRadius
    }
  ];
  for (let i = 0; i < SOULS_CASTLE_BRAZIERS.length; i++) {
    const b = SOULS_CASTLE_BRAZIERS[i];
    cols.push({ id: b.id, kind: 'brazier', x: b.x, z: b.z, radius: b.radius });
  }
  for (let i = 0; i < SOULS_CASTLE_PILLARS.length; i++) {
    const p = SOULS_CASTLE_PILLARS[i];
    if (p.collider) {
      cols.push({ id: p.id, kind: 'pillar', x: p.x, z: p.z, radius: p.radius });
    }
  }
  for (let i = 0; i < SOULS_CASTLE_RELICS.length; i++) {
    const rel = SOULS_CASTLE_RELICS[i];
    cols.push({ id: rel.id, kind: 'relic_shrine', x: rel.x, z: rel.z, radius: rel.colliderRadius });
  }
  for (let i = 0; i < SOULS_CASTLE_ALCOVE_DECOR.length; i++) {
    const d = SOULS_CASTLE_ALCOVE_DECOR[i];
    if (d.collider) {
      cols.push({ id: d.id, kind: d.kind, x: d.x, z: d.z, radius: d.radius });
    }
  }
  return cols;
}

/**
 * Resolves circular push-out against static colliders (braziers, pillars, bonfire, shrines, racks).
 */
export function resolveCastleStaticColliders(x, z, radius = 0.55, colliders = null, iterations = 2) {
  const list = colliders || getCastleStaticColliders();
  let nx = Number.isFinite(x) ? x : 0;
  let nz = Number.isFinite(z) ? z : SOULS_CASTLE_PLAYER_SPAWN.z;
  const r = Number.isFinite(radius) ? Math.max(0, radius) : 0.55;

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      const cr = c.radius ?? c.r ?? 0.55;
      const minDist = r + cr;
      const dx = nx - c.x;
      const dz = nz - c.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < minDist * minDist) {
        if (dSq > 1e-8) {
          const d = Math.sqrt(dSq);
          const push = (minDist - d) / d;
          nx += dx * push;
          nz += dz * push;
        } else {
          nz += minDist;
        }
      }
    }
  }
  return { x: nx, z: nz };
}
