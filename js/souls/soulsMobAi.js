// Elden Ring Goal-Stack AI, Pack Token Coordination & AAA Living Footwork
// for `Abandoned Knight Rift` Enemies (Wave 2 — Wall LOS Guard, Archway Doorway
// Routing, Flame-Trap Forbidden Band, 2.2x Stagger Thresholds & Zero Red Circles):
//   - `iron_knight`    (`Rift_Executioner_Tripo.glb`, role: 'duelist', staggerMax: 145)
//   - `cursed_footman` (`Rift_Vanguard_Tripo.glb`,    role: 'guard',   staggerMax: 130)
//   - `bone_archer`    (`Rift_Acolyte_Tripo.glb`,     role: 'archer',  staggerMax: 95)
//
// Features:
//   - Zero aggro through walls: mobs NEVER wake up or start chasing while
//     `!hasMobWallLineOfSight(mob.x, mob.z, player.x, player.z)`.
//   - Smart archway routing (`resolveDoorwaySteerTarget` / `getCastleDoorwaySteerTarget`):
//     East Alcove & West Wing mobs thread cleanly through the center of the
//     connecting archway without ever running into stone piers from behind a wall.
//   - Strict Flame-Trap exclusion (`SOULS_FLAME_TRAP_NO_MOB_Z` & 6-zone
//     `SOULS_FLAME_GAUNTLET_Z_MIN..MAX` forbidden band): mobs NEVER patrol,
//     chase, lunge, or backstep into flame traps (nor into the Bonfire Safe Zone).
//   - Zero arcade red circles (`out.telegraph = null` always — pure readable 3D
//     skeletal windups + physical steel/dust cues).
//   - Calm Elden Ring pacing, Pack Token Coordination (`<= 2` melee attackers),
//     smooth C1 step-in (`1.2–2.2 m/s`), live velocity lead & shield-turtle reads.

import * as CASTLE_LAYOUT from './soulsCastleLayout.js?v=20261125z103';

const TWO_PI = Math.PI * 2;
const _tmpClampOut = { x: 0, z: 0 };

function getLiveCorridorBounds() {
  const C = CASTLE_LAYOUT.SOULS_CASTLE_CONSTANTS || {};
  const R = CASTLE_LAYOUT.SOULS_CASTLE_ROOMS || {};
  const spawnHall = R.spawn_hall || R.courtyard || {};
  const corridor = R.knights_nave || R.corridor || {};
  const eastAlcove = R.east_alcove || {};
  const eastArch = R.east_arch || {};

  const bossDoorZ = Number.isFinite(C.BOSS_DOOR_Z) ? C.BOSS_DOOR_Z : -16.0;
  const bossSealZ = Number.isFinite(C.BOSS_SEAL_Z) ? C.BOSS_SEAL_Z : bossDoorZ - 0.2;
  const fogGateZ = +(bossSealZ - 0.2).toFixed(3);

  let maxWalkableZ = Number.isFinite(spawnHall.maxZ)
    ? spawnHall.maxZ
    : (Number.isFinite(C.COURTYARD_MAX_Z) ? C.COURTYARD_MAX_Z : 38.0);
  const roomList = CASTLE_LAYOUT.SOULS_CASTLE_ROOM_LIST;
  if (Array.isArray(roomList)) {
    for (let i = 0; i < roomList.length; i++) {
      const rm = roomList[i];
      if (rm && Number.isFinite(rm.maxZ) && rm.maxZ > maxWalkableZ) {
        maxWalkableZ = rm.maxZ;
      }
    }
  }

  const courtyardMinZ = Number.isFinite(spawnHall.minZ)
    ? spawnHall.minZ
    : (Number.isFinite(C.COURTYARD_MIN_Z) ? C.COURTYARD_MIN_Z : 20.0);
  const courtyardHalfW = Number.isFinite(spawnHall.maxX)
    ? Math.abs(spawnHall.maxX)
    : (Number.isFinite(C.COURTYARD_MAX_X) ? C.COURTYARD_MAX_X : 8.6);
  const corridorHalfW = Number.isFinite(corridor.maxX)
    ? Math.abs(corridor.maxX)
    : (Number.isFinite(C.CORRIDOR_HALF_W) ? C.CORRIDOR_HALF_W : 5.0);

  const eastAlcoveMinX = Number.isFinite(eastAlcove.minX)
    ? eastAlcove.minX
    : (Number.isFinite(C.EAST_ALCOVE_MIN_X) ? C.EAST_ALCOVE_MIN_X : 5.8);
  const eastAlcoveMaxX = Number.isFinite(eastAlcove.maxX)
    ? eastAlcove.maxX
    : (Number.isFinite(C.EAST_ALCOVE_MAX_X) ? C.EAST_ALCOVE_MAX_X : 13.8);
  const eastAlcoveMinZ = Number.isFinite(eastAlcove.minZ)
    ? eastAlcove.minZ
    : (Number.isFinite(C.EAST_ALCOVE_MIN_Z) ? C.EAST_ALCOVE_MIN_Z : -5.0);
  const eastAlcoveMaxZ = Number.isFinite(eastAlcove.maxZ)
    ? eastAlcove.maxZ
    : (Number.isFinite(C.EAST_ALCOVE_MAX_Z) ? C.EAST_ALCOVE_MAX_Z : 4.0);
  const eastArchMinZ = Number.isFinite(eastArch.minZ)
    ? eastArch.minZ
    : (Number.isFinite(C.EAST_ARCH_MIN_Z) ? C.EAST_ARCH_MIN_Z : -2.8);
  const eastArchMaxZ = Number.isFinite(eastArch.maxZ)
    ? eastArch.maxZ
    : (Number.isFinite(C.EAST_ARCH_MAX_Z) ? C.EAST_ARCH_MAX_Z : 2.0);

  return {
    minZ: fogGateZ,
    maxZ: +(maxWalkableZ - 0.8).toFixed(3),
    bossDoorZ,
    bossSealZ,
    bridgeNorthZ: fogGateZ,
    bridgeSouthZ: courtyardMinZ,
    bridgeHalfWidth: corridorHalfW,
    courtyardHalfWidth: courtyardHalfW,
    eastAlcoveMinX,
    eastAlcoveMaxX,
    eastAlcoveMinZ,
    eastAlcoveMaxZ,
    eastArchMinZ,
    eastArchMaxZ,
    wallMargin: 0.22
  };
}

export const SOULS_CORRIDOR_BOUNDS = Object.freeze(getLiveCorridorBounds());
export const SOULS_FOG_GATE_Z = SOULS_CORRIDOR_BOUNDS.minZ;

/**
 * Returns the live forbidden Z-band `[minZ, maxZ]` occupied by corridor flame traps.
 * Supports both single-threshold `SOULS_FLAME_TRAP_NO_MOB_Z` (1.8) and 6-zone
 * `SOULS_FLAME_GAUNTLET_Z_MIN..MAX` ([7.0, 26.5] around [8.0, 25.5]).
 */
export function getFlameTrapForbiddenBand(opts = {}) {
  if (Number.isFinite(opts.flameGauntletMinZ) && Number.isFinite(opts.flameGauntletMaxZ)) {
    return {
      minZ: Number(opts.flameGauntletMinZ),
      maxZ: Number(opts.flameGauntletMaxZ)
    };
  }
  if (Number.isFinite(opts.flameTrapNoMobZ)) {
    const z0 = Number(opts.flameTrapNoMobZ);
    return { minZ: z0, maxZ: Math.max(z0 + 14.0, 20.0) };
  }
  if (
    Number.isFinite(CASTLE_LAYOUT.SOULS_FLAME_GAUNTLET_Z_MIN) &&
    Number.isFinite(CASTLE_LAYOUT.SOULS_FLAME_GAUNTLET_Z_MAX)
  ) {
    const noMobNorth = Number.isFinite(CASTLE_LAYOUT.SOULS_FLAME_TRAP_NO_MOB_Z)
      ? Math.min(Number(CASTLE_LAYOUT.SOULS_FLAME_TRAP_NO_MOB_Z), Number(CASTLE_LAYOUT.SOULS_FLAME_GAUNTLET_Z_MIN) - 1.0)
      : Number(CASTLE_LAYOUT.SOULS_FLAME_GAUNTLET_Z_MIN) - 1.0;
    return {
      minZ: noMobNorth,
      maxZ: Number(CASTLE_LAYOUT.SOULS_FLAME_GAUNTLET_Z_MAX) + 1.0
    };
  }
  if (Number.isFinite(CASTLE_LAYOUT.SOULS_FLAME_TRAP_NO_MOB_Z)) {
    const noMobZ = Number(CASTLE_LAYOUT.SOULS_FLAME_TRAP_NO_MOB_Z);
    const traps = CASTLE_LAYOUT.SOULS_CASTLE_FLAME_TRAPS;
    let maxTrapZ = noMobZ + 16.0;
    if (Array.isArray(traps)) {
      for (let i = 0; i < traps.length; i++) {
        if (Number.isFinite(traps[i]?.z)) {
          maxTrapZ = Math.max(maxTrapZ, traps[i].z + 2.2);
        }
      }
    }
    return { minZ: noMobZ, maxZ: maxTrapZ };
  }
  const traps = CASTLE_LAYOUT.SOULS_CASTLE_FLAME_TRAPS;
  if (Array.isArray(traps) && traps.length > 0) {
    let minTrapZ = Infinity;
    let maxTrapZ = -Infinity;
    for (let i = 0; i < traps.length; i++) {
      const tz = traps[i]?.z;
      if (Number.isFinite(tz)) {
        if (tz < minTrapZ) minTrapZ = tz;
        if (tz > maxTrapZ) maxTrapZ = tz;
      }
    }
    if (minTrapZ <= maxTrapZ) {
      return {
        minZ: Math.min(1.8, minTrapZ - 1.8),
        maxZ: maxTrapZ + 1.8
      };
    }
  }
  return { minZ: 1.8, maxZ: 20.0 };
}

export const SOULS_FLAME_TRAP_NO_MOB_Z = getFlameTrapForbiddenBand().minZ;

export const SOULS_PACK_CFG = Object.freeze({
  maxMeleeTokens: 2,
  maxRangedTokens: 1,
  minFlankAngleRad: 0.85,
  tokenStaleSec: 4.2,
  tokenHeartbeatSec: 0.65,
  allyStaleSec: 0.75,
  allySeparationRadius: 1.85,
  allySeparationStrength: 2.35
});

const PUNISH_DMG_MULT = Object.freeze({
  heavy: 1.25,
  light: 1.15
});

const PUNISH_STAGGER_MULT = Object.freeze({
  heavy: 1.4,
  light: 1.25
});

export const SOULS_BONFIRE_PHYSICAL_RADIUS = 1.35;

export function isPlayerRestingAtBonfire(opts = {}) {
  return Boolean(
    opts?.playerRestingAtBonfire ||
    opts?.bonfireRestActive ||
    opts?.souls?.bonfireRestActive ||
    Number(opts?.souls?.bonfireRestTimer) > 0 ||
    Number(opts?.souls?.bonfireHealCooldown) > 0
  );
}

export function getBonfireSafeZone(opts = {}) {
  const bf = opts.bonfirePos || CASTLE_LAYOUT.SOULS_CASTLE_BONFIRE || { x: 0, z: 32.5 };
  const radius = Number(opts.bonfireSafeRadius) > 0
    ? Number(opts.bonfireSafeRadius)
    : (Number(CASTLE_LAYOUT.SOULS_BONFIRE_SAFE_RADIUS) > 0
      ? Number(CASTLE_LAYOUT.SOULS_BONFIRE_SAFE_RADIUS)
      : 9.5);
  const colliderRadius = Number(bf.colliderRadius) > 0 ? Number(bf.colliderRadius) : 1.05;
  return {
    x: Number.isFinite(bf.x) ? bf.x : 0,
    z: Number.isFinite(bf.z) ? bf.z : 32.5,
    radius,
    colliderRadius,
    physicalRadius: Math.max(SOULS_BONFIRE_PHYSICAL_RADIUS, colliderRadius + 0.30)
  };
}

export function getEffectiveBonfireRepulsionRadius(opts = {}) {
  const zone = getBonfireSafeZone(opts);
  if (isPlayerRestingAtBonfire(opts)) {
    return Math.max(1.5, zone.radius - 0.35);
  }
  return zone.physicalRadius;
}

export function isPlayerInBonfireSafeZone(px, pz, opts = {}) {
  const zone = getBonfireSafeZone(opts);
  return Math.hypot((px || 0) - zone.x, (pz || 0) - zone.z) <= zone.radius;
}

// ============================================================================
// 1. Exact Wall/Pillar Line-of-Sight & Smart Archway Doorway Router
// ============================================================================

function segmentIntersectsAABB(x1, z1, x2, z2, minX, maxX, minZ, maxZ) {
  let t0 = 0.015;
  let t1 = 0.985;
  const dx = x2 - x1;
  const dz = z2 - z1;

  const checks = [
    [-dx, x1 - minX],
    [dx, maxX - x1],
    [-dz, z1 - minZ],
    [dz, maxZ - z1]
  ];
  for (let i = 0; i < 4; i++) {
    const p = checks[i][0];
    const q = checks[i][1];
    if (Math.abs(p) < 1e-8) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return t0 <= t1;
}

function segmentsIntersect2D(ax, az, bx, bz, cx, cz, dx, dz) {
  const rX = bx - ax;
  const rZ = bz - az;
  const sX = dx - cx;
  const sZ = dz - cz;
  const denom = rX * sZ - rZ * sX;
  if (Math.abs(denom) < 1e-8) return false;
  const qpX = cx - ax;
  const qpZ = cz - az;
  const t = (qpX * sZ - qpZ * sX) / denom;
  const u = (qpX * rZ - qpZ * rX) / denom;
  return t > 0.015 && t < 0.985 && u >= 0 && u <= 1;
}

function segmentHitsCircle(x1, z1, x2, z2, cx, cz, radius) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 1e-6) return false;
  const t = clamp(((cx - x1) * dx + (cz - z1) * dz) / lenSq, 0.02, 0.98);
  const px = x1 + dx * t;
  const pz = z1 + dz * t;
  const ex = px - cx;
  const ez = pz - cz;
  return ex * ex + ez * ez < radius * radius;
}

/**
 * Exact 2D wall, pier, column & closed Boss Door Line-of-Sight check.
 * Delegates first to `CASTLE_LAYOUT.hasCastleWallLineOfSight` when present,
 * with a built-in geometric test over `SOULS_CASTLE_WALL_SEGMENTS` & `SOULS_CASTLE_PILLARS`.
 */
export function hasMobWallLineOfSight(x1, z1, x2, z2, opts = {}) {
  if (opts?.hasLineOfSight === false && !opts?.ignorePillars && !opts?.forceGeometricLOS) {
    return false;
  }
  if (!Number.isFinite(x1) || !Number.isFinite(z1) || !Number.isFinite(x2) || !Number.isFinite(z2)) {
    return false;
  }
  if (Math.hypot(x2 - x1, z2 - z1) < 0.08) return true;

  if (typeof CASTLE_LAYOUT.hasCastleWallLineOfSight === 'function') {
    return Boolean(
      CASTLE_LAYOUT.hasCastleWallLineOfSight(x1, z1, x2, z2, {
        bossDoorState: opts?.doorOpen ? 'open' : 'closed',
        ...opts
      })
    );
  }

  const b = getLiveCorridorBounds();

  // Closed Boss Doors block LOS across z = bossDoorZ
  if (!opts?.doorOpen) {
    if ((z1 - b.bossDoorZ) * (z2 - b.bossDoorZ) < 0) {
      return false;
    }
  }

  const walls = CASTLE_LAYOUT.SOULS_CASTLE_WALL_SEGMENTS;
  if (Array.isArray(walls)) {
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      if (!w) continue;
      if (w.axis === 'x' || w.axis === 'z') {
        const halfX = w.axis === 'x'
          ? Math.max(0.05, (w.length || Math.abs((w.x2 || 0) - (w.x1 || 0))) * 0.5 - 0.03)
          : Math.max(0.08, (w.thickness || 0.8) * 0.5);
        const halfZ = w.axis === 'z'
          ? Math.max(0.05, (w.length || Math.abs((w.z2 || 0) - (w.z1 || 0))) * 0.5 - 0.03)
          : Math.max(0.08, (w.thickness || 0.8) * 0.5);
        const cx = Number.isFinite(w.x) ? w.x : ((w.x1 || 0) + (w.x2 || 0)) * 0.5;
        const cz = Number.isFinite(w.z) ? w.z : ((w.z1 || 0) + (w.z2 || 0)) * 0.5;
        if (segmentIntersectsAABB(x1, z1, x2, z2, cx - halfX, cx + halfX, cz - halfZ, cz + halfZ)) {
          return false;
        }
      } else if (Number.isFinite(w.x1) && Number.isFinite(w.x2)) {
        if (segmentsIntersect2D(x1, z1, x2, z2, w.x1, w.z1, w.x2, w.z2)) {
          return false;
        }
      }
    }
  }

  const pillars = CASTLE_LAYOUT.SOULS_CASTLE_PILLARS;
  if (Array.isArray(pillars) && opts?.ignorePillars !== true) {
    for (let i = 0; i < pillars.length; i++) {
      const p = pillars[i];
      if (!p || p.collider === false) continue;
      const pr = Math.max(0.25, (Number(p.radius) || 0.85) * 0.88);
      if (segmentHitsCircle(x1, z1, x2, z2, p.x, p.z, pr)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Latched tangent bypass solver around stone castle pillars (`pillar_sanctuary_w/e`, `pillar_nave_se/nw`, etc.).
 * Latches `mob._pillarBypassSign` & `mob._pillarBypassId` (preserving world-space side normal) until the mob
 * has genuinely cleared the blocking column, eliminating left-right (`+X / -X`) ping-pong oscillation!
 */
export function resolveLatchedPillarBypass(mob, fromX, fromZ, toX, toZ, zDom = null, opts = {}) {
  const pillars = CASTLE_LAYOUT.SOULS_CASTLE_PILLARS;
  if (!Array.isArray(pillars) || pillars.length === 0) return null;

  const distGoal = Math.hypot(toX - fromX, toZ - fromZ);
  if (distGoal < 0.35) {
    if (mob) {
      mob._pillarBypassId = null;
      mob._pillarBypassSign = 0;
    }
    return null;
  }

  const mobR = Number(mob?.radius) > 0 ? Number(mob.radius) : 0.55;
  const minSafeZ = Number.isFinite(zDom?.minZ) ? zDom.minZ + 0.28 : -31.72;
  const maxSafeZ = Number.isFinite(zDom?.maxZ) ? zDom.maxZ - 0.28 : 67.2;

  let targetCol = null;
  let bestDistFromMob = Infinity;

  for (let i = 0; i < pillars.length; i++) {
    const p = pillars[i];
    if (!p || p.collider === false) continue;
    const colR = Number(p.radius) || 0.85;
    const hitR = colR + mobR + 0.22;
    if (segmentHitsCircle(fromX, fromZ, toX, toZ, p.x, p.z, hitR)) {
      const d = Math.hypot(fromX - p.x, fromZ - p.z);
      if (d < bestDistFromMob) {
        bestDistFromMob = d;
        targetCol = p;
      }
    }
  }

  // Keep existing pillar latch alive while the mob is still rounding its shoulder
  if (!targetCol && mob && mob._pillarBypassId) {
    for (let i = 0; i < pillars.length; i++) {
      const p = pillars[i];
      if (!p || p.id !== mob._pillarBypassId || p.collider === false) continue;
      const colR = Number(p.radius) || 0.85;
      const dMob = Math.hypot(fromX - p.x, fromZ - p.z);
      const gpX = toX - p.x;
      const gpZ = toZ - p.z;
      const gpLen = Math.hypot(gpX, gpZ) || 1;
      const along = ((fromX - p.x) * gpX + (fromZ - p.z) * gpZ) / gpLen;
      const holdActive = (mob._pillarBypassHoldTimer || 0) > 0;
      if ((dMob < colR + mobR + 0.72 && along < colR * 0.45) || (holdActive && dMob < colR + mobR + 1.05)) {
        targetCol = p;
      }
      break;
    }
  }

  if (!targetCol) {
    if (mob && (mob._pillarBypassHoldTimer || 0) <= 0) {
      mob._pillarBypassId = null;
      mob._pillarBypassSign = 0;
    }
    return null;
  }

  const colR = Number(targetCol.radius) || 0.85;
  const bypassR = colR + mobR + 0.52;

  const gpX = toX - targetCol.x;
  const gpZ = toZ - targetCol.z;
  const gpLen = Math.hypot(gpX, gpZ);
  let uAxisX;
  let uAxisZ;
  if (gpLen > 0.42) {
    uAxisX = gpX / gpLen;
    uAxisZ = gpZ / gpLen;
  } else {
    const mpX = targetCol.x - fromX;
    const mpZ = targetCol.z - fromZ;
    const mpLen = Math.hypot(mpX, mpZ) || 1;
    uAxisX = mpX / mpLen;
    uAxisZ = mpZ / mpLen;
  }

  const tanPX = -uAxisZ;
  const tanPZ = uAxisX;

  const wxPlus = targetCol.x + tanPX * bypassR;
  const wzPlus = clamp(targetCol.z + tanPZ * bypassR, minSafeZ, maxSafeZ);
  const wxMinus = targetCol.x - tanPX * bypassR;
  const wzMinus = clamp(targetCol.z - tanPZ * bypassR, minSafeZ, maxSafeZ);

  let penPlus = Math.abs(targetCol.z + tanPZ * bypassR - wzPlus);
  let penMinus = Math.abs(targetCol.z - tanPZ * bypassR - wzMinus);

  if (typeof CASTLE_LAYOUT.clampCastlePosition === 'function') {
    const probeR = mobR + 0.28;
    const projPlus = CASTLE_LAYOUT.clampCastlePosition(wxPlus, wzPlus, probeR, {
      bossDoorState: 'closed',
      allowBossHall: false,
      out: _tmpClampOut
    });
    penPlus += Math.hypot(projPlus.x - wxPlus, projPlus.z - wzPlus);

    const projMinus = CASTLE_LAYOUT.clampCastlePosition(wxMinus, wzMinus, probeR, {
      bossDoorState: 'closed',
      allowBossHall: false,
      out: _tmpClampOut
    });
    penMinus += Math.hypot(projMinus.x - wxMinus, projMinus.z - wzMinus);
  } else {
    const maxXPlus = getCorridorMaxX(wzPlus, mobR + 0.25);
    const maxXMinus = getCorridorMaxX(wzMinus, mobR + 0.25);
    if (Math.abs(wxPlus) > maxXPlus) penPlus += Math.abs(wxPlus) - maxXPlus;
    if (Math.abs(wxMinus) > maxXMinus) penMinus += Math.abs(wxMinus) - maxXMinus;
  }

  const bfZone = getBonfireSafeZone(opts);
  const minBf = getEffectiveBonfireRepulsionRadius(opts);
  const bfDistPlus = Math.hypot(wxPlus - bfZone.x, wzPlus - bfZone.z);
  const bfDistMinus = Math.hypot(wxMinus - bfZone.x, wzMinus - bfZone.z);
  if (bfDistPlus < minBf) penPlus += minBf - bfDistPlus;
  if (bfDistMinus < minBf) penMinus += minBf - bfDistMinus;

  let chosenSign;
  if (penPlus > 0.14 && penMinus + 0.08 < penPlus) {
    chosenSign = -1;
  } else if (penMinus > 0.14 && penPlus + 0.08 < penMinus) {
    chosenSign = 1;
  } else if (
    mob &&
    mob._pillarBypassId === targetCol.id &&
    (mob._pillarBypassSign === 1 || mob._pillarBypassSign === -1)
  ) {
    if (Number.isFinite(mob._pillarBypassSideX) && Number.isFinite(mob._pillarBypassSideZ)) {
      const worldDot = tanPX * mob._pillarBypassSideX + tanPZ * mob._pillarBypassSideZ;
      chosenSign = worldDot >= 0 ? 1 : -1;
    } else {
      chosenSign = mob._pillarBypassSign;
    }
  } else {
    const latOff = (fromX - targetCol.x) * tanPX + (fromZ - targetCol.z) * tanPZ;
    if (Math.abs(latOff) >= 0.18) {
      chosenSign = latOff >= 0 ? 1 : -1;
    } else {
      // Near dead-center: favor the side with wider open hall space toward castle centerline X=0
      chosenSign = Math.abs(wxPlus) <= Math.abs(wxMinus) ? 1 : -1;
    }
  }

  if (mob) {
    if (mob._pillarBypassId !== targetCol.id) {
      mob._pillarBypassHoldTimer = 0.52;
    }
    mob._pillarBypassId = targetCol.id;
    mob._pillarBypassSign = chosenSign;
    mob._pillarBypassSideX = tanPX * chosenSign;
    mob._pillarBypassSideZ = tanPZ * chosenSign;
  }

  const relX = fromX - targetCol.x;
  const relZ = fromZ - targetCol.z;
  const along = relX * uAxisX + relZ * uAxisZ;
  const lat = (relX * tanPX + relZ * tanPZ) * chosenSign;

  let wpX;
  let wpZ;
  if (lat < bypassR * 0.74 && along < 0.16) {
    wpX = targetCol.x + tanPX * chosenSign * bypassR + uAxisX * 0.26;
    wpZ = targetCol.z + tanPZ * chosenSign * bypassR + uAxisZ * 0.26;
  } else {
    const wrapAdvance = Math.min(Math.max(0.55, gpLen), colR + mobR + 0.72);
    wpX = targetCol.x + tanPX * chosenSign * (bypassR * 0.70) + uAxisX * wrapAdvance;
    wpZ = targetCol.z + tanPZ * chosenSign * (bypassR * 0.70) + uAxisZ * wrapAdvance;
  }
  wpZ = clamp(wpZ, minSafeZ, maxSafeZ);

  if (typeof CASTLE_LAYOUT.clampCastlePosition === 'function') {
    const projWp = CASTLE_LAYOUT.clampCastlePosition(wpX, wpZ, mobR + 0.06, {
      bossDoorState: 'closed',
      allowBossHall: false,
      out: _tmpClampOut
    });
    wpX = projWp.x;
    wpZ = clamp(projWp.z, minSafeZ, maxSafeZ);
  }

  return {
    x: +wpX.toFixed(3),
    z: +wpZ.toFixed(3),
    viaDoorway: true,
    viaPillar: true,
    pillarId: targetCol.id,
    sign: chosenSign
  };
}

/**
 * Smart archway doorway router (`getCastleDoorwaySteerTarget` integration + latched pillar bypass).
 * Ensures mobs inside East Alcove or West Wing thread cleanly through the center
 * of the connecting gothic archway (e.g. `{ x: 4.5, z: -0.4 }`) and walk cleanly around pillars!
 */
export function resolveDoorwaySteerTarget(fromX, fromZ, toX, toZ, opts = {}) {
  const distGoal = Math.hypot(toX - fromX, toZ - fromZ);
  const clearWallLOS = hasMobWallLineOfSight(fromX, fromZ, toX, toZ, {
    ...opts,
    ignorePillars: true,
    forceGeometricLOS: true
  });
  const clearFullLOS = distGoal > 0.40
    ? hasMobWallLineOfSight(fromX, fromZ, toX, toZ, {
        ...opts,
        ignorePillars: false,
        forceGeometricLOS: true
      })
    : clearWallLOS;

  if (typeof CASTLE_LAYOUT.getCastleDoorwaySteerTarget === 'function') {
    const res = CASTLE_LAYOUT.getCastleDoorwaySteerTarget(fromX, fromZ, toX, toZ);
    if (res && Number.isFinite(res.x) && Number.isFinite(res.z)) {
      const deltaToGoal = Math.hypot(res.x - toX, res.z - toZ);
      const distToSteer = Math.hypot(res.x - fromX, res.z - fromZ);
      if (deltaToGoal > 0.25 && distToSteer > 0.22) {
        return { x: res.x, z: res.z, viaDoorway: true, viaPillar: false };
      }
    }
  }

  // Check latched pillar bypass whenever walls are clear (including while rounding a latched pillar shoulder!)
  if (clearWallLOS) {
    if (!clearFullLOS || opts?.mob?._pillarBypassId) {
      const pSteer = resolveLatchedPillarBypass(
        opts?.mob || null,
        fromX,
        fromZ,
        toX,
        toZ,
        opts?.zDom || null,
        opts
      );
      if (pSteer) {
        return pSteer;
      }
    }
    return { x: toX, z: toZ, viaDoorway: false, viaPillar: false };
  }

  // Geometric archway search over `SOULS_CASTLE_ARCHES` (handles East Alcove, West Wing & Nave arches)
  const arches = CASTLE_LAYOUT.SOULS_CASTLE_ARCHES;
  if (Array.isArray(arches)) {
    let bestArch = null;
    let bestCost = Infinity;

    for (let i = 0; i < arches.length; i++) {
      const a = arches[i];
      if (!a || a.id === 'boss_door_portal') continue;
      if (a.axis === 'z') {
        // Side-wing doorway (East Alcove or West Wing)
        const crossSide = (fromX - a.x) * (toX - a.x) <= 0;
        const insideWing = Math.abs(fromX) > Math.abs(a.x) - 0.35 && Math.sign(fromX) === Math.sign(a.x);
        if (crossSide || insideWing) {
          const cost = Math.hypot(fromX - a.x, fromZ - a.z) + Math.hypot(toX - a.x, toZ - a.z);
          if (cost < bestCost) {
            bestCost = cost;
            bestArch = a;
          }
        }
      } else if (a.axis === 'x') {
        // Transverse room doorway
        const crossZ = (fromZ - a.z) * (toZ - a.z) < 0;
        const outsideSpan = Math.abs(fromX - a.x) > Math.max(0.8, (a.halfSpan || 4.5) - 0.65);
        if (crossZ && outsideSpan) {
          const cost = Math.hypot(fromX - a.x, fromZ - a.z) + Math.hypot(toX - a.x, toZ - a.z);
          if (cost < bestCost) {
            bestCost = cost;
            bestArch = a;
          }
        }
      }
    }

    if (bestArch) {
      if (bestArch.axis === 'z') {
        const safeHalfZ = Math.max(0.55, (bestArch.halfSpan || 2.2) - 0.85);
        const exitSignX = toX < bestArch.x ? -1 : 1;
        // Stage 1: if misaligned in Z on the far side of the wall, align in front of the arch first!
        if ((fromX - bestArch.x) * exitSignX < -0.25 && Math.abs(fromZ - bestArch.z) > safeHalfZ) {
          return {
            x: bestArch.x - exitSignX * 0.75,
            z: bestArch.z,
            viaDoorway: true
          };
        }
        // Stage 2: step cleanly through the archway center onto the target side (e.g. x = 4.5, z = -0.4)
        return {
          x: +(bestArch.x + exitSignX * 0.9).toFixed(2),
          z: bestArch.z,
          viaDoorway: true
        };
      }

      const exitSignZ = toZ < bestArch.z ? -1 : 1;
      return {
        x: bestArch.x,
        z: +(bestArch.z + exitSignZ * 0.9).toFixed(2),
        viaDoorway: true
      };
    }
  }

  // Fallback East Alcove doorway `{ x: 4.5, z: archCenterZ }`
  const b = getLiveCorridorBounds();
  const archCenterZ = +((b.eastArchMinZ + b.eastArchMaxZ) * 0.5).toFixed(2);
  if (fromX > 5.1 && toX <= 5.1) {
    if (Math.abs(fromZ - archCenterZ) > 1.25 && fromX > 5.6) {
      return { x: 6.1, z: archCenterZ, viaDoorway: true };
    }
    return { x: 4.5, z: archCenterZ, viaDoorway: true };
  }
  if (fromX <= 5.1 && toX > 5.6) {
    return { x: 6.1, z: archCenterZ, viaDoorway: true };
  }

  return { x: toX, z: toZ, viaDoorway: false };
}

// ============================================================================
// 2. AAA Attack Metadata & Archetype Profiles (2.2x Stagger + Zero Red Circles!)
// ============================================================================

const IRON_KNIGHT_SLASH_1 = Object.freeze({
  id: 'slash_1',
  moveType: 'slash',
  attackAnimClip: 'Attack_Slash_1',
  releaseAnimClip: 'Attack_Slash_1',
  label: 'Диагональный разрез I',
  windup: 0.62,
  active: 0.17,
  recovery: 0.54,
  trackingCutoff01: 0.87,
  staminaDamage: 32,
  damageLevel: 'light',
  damageMult: 1.0,
  reach: 2.75,
  arcRad: Math.PI * 0.96,
  telegraphForward: 1.6,
  telegraphRadius: 0,
  lungeSpeed: 3.15,
  stepStart01: 0.34,
  stepPeak01: 0.88,
  lungeWindowSec: 0.34,
  followThroughSlide: 0.0,
  canParry: true,
  parryable: true,
  isPierce: false,
  isRanged: false,
  heavySfx: false,
  postBackstep: false,
  punishTier: 'light',
  punishDmgMult: 1.15,
  punishStaggerMult: 1.25,
  followUpIds: Object.freeze(['slash_2', 'overhead_crush'])
});

const IRON_KNIGHT_SLASH_2 = Object.freeze({
  id: 'slash_2',
  moveType: 'slash',
  attackAnimClip: 'Attack_Slash_2',
  releaseAnimClip: 'Attack_Slash_2',
  label: 'Обратный взмах II',
  windup: 0.56,
  active: 0.17,
  recovery: 0.56,
  trackingCutoff01: 0.88,
  staminaDamage: 36,
  damageLevel: 'light',
  damageMult: 1.10,
  reach: 2.85,
  arcRad: Math.PI * 1.02,
  telegraphForward: 1.65,
  telegraphRadius: 0,
  lungeSpeed: 3.35,
  stepStart01: 0.32,
  stepPeak01: 0.88,
  lungeWindowSec: 0.32,
  followThroughSlide: 0.0,
  canParry: true,
  parryable: true,
  isPierce: false,
  isRanged: false,
  heavySfx: false,
  postBackstep: false,
  punishTier: 'light',
  punishDmgMult: 1.18,
  punishStaggerMult: 1.25,
  followUpIds: Object.freeze(['overhead_crush'])
});

const IRON_KNIGHT_OVERHEAD_CRUSH = Object.freeze({
  id: 'overhead_crush',
  moveType: 'overhead',
  attackAnimClip: 'Attack_Overhead_Crush',
  releaseAnimClip: 'Attack_Overhead_Crush',
  label: 'Дробящий удар сверху',
  windup: 0.88,
  active: 0.18,
  recovery: 0.74,
  trackingCutoff01: 0.85,
  staminaDamage: 52,
  damageLevel: 'heavy',
  damageMult: 1.34,
  reach: 2.95,
  arcRad: Math.PI * 0.66,
  telegraphForward: 1.8,
  telegraphRadius: 0,
  lungeSpeed: 3.55,
  stepStart01: 0.42,
  stepPeak01: 0.90,
  lungeWindowSec: 0.38,
  followThroughSlide: 0.0,
  canParry: true,
  parryable: true,
  isPierce: false,
  isRanged: false,
  heavySfx: true,
  postBackstep: false,
  punishTier: 'heavy',
  punishDmgMult: 1.25,
  punishStaggerMult: 1.4,
  followUpIds: Object.freeze([])
});

const IRON_KNIGHT_THRUST_LUNGE = Object.freeze({
  id: 'thrust_lunge',
  moveType: 'thrust',
  attackAnimClip: 'Attack_Thrust_Lunge',
  releaseAnimClip: 'Attack_Thrust_Lunge',
  label: 'Пробивной выпад',
  windup: 0.66,
  active: 0.17,
  recovery: 0.64,
  trackingCutoff01: 0.86,
  staminaDamage: 40,
  damageLevel: 'heavy',
  damageMult: 1.20,
  reach: 3.25,
  arcRad: Math.PI * 0.52,
  telegraphForward: 2.1,
  telegraphRadius: 0,
  lungeSpeed: 4.85,
  stepStart01: 0.34,
  stepPeak01: 0.90,
  lungeWindowSec: 0.38,
  followThroughSlide: 0.0,
  canParry: true,
  parryable: true,
  isPierce: true,
  isRanged: false,
  heavySfx: true,
  postBackstep: false,
  punishTier: 'heavy',
  punishDmgMult: 1.25,
  punishStaggerMult: 1.35,
  followUpIds: Object.freeze(['slash_2'])
});

const FOOTMAN_THRUST_1 = Object.freeze({
  id: 'thrust_1',
  moveType: 'thrust',
  attackAnimClip: 'Attack_Thrust_1',
  releaseAnimClip: 'Attack_Thrust_1',
  label: 'Колющий выпад из-за щита',
  windup: 0.54,
  active: 0.16,
  recovery: 0.50,
  trackingCutoff01: 0.87,
  staminaDamage: 28,
  damageLevel: 'light',
  damageMult: 0.98,
  reach: 2.75,
  arcRad: Math.PI * 0.58,
  telegraphForward: 1.65,
  telegraphRadius: 0,
  lungeSpeed: 3.45,
  stepStart01: 0.34,
  stepPeak01: 0.88,
  lungeWindowSec: 0.30,
  followThroughSlide: 0.0,
  canParry: true,
  parryable: true,
  isPierce: true,
  isRanged: false,
  heavySfx: false,
  postBackstep: false,
  backstepSpeed: 3.15,
  backstepDuration: 0.32,
  punishTier: 'light',
  punishDmgMult: 1.15,
  punishStaggerMult: 1.25,
  followUpIds: Object.freeze(['sweep_2', 'shield_bash'])
});

const FOOTMAN_SWEEP_2 = Object.freeze({
  id: 'sweep_2',
  moveType: 'slash',
  attackAnimClip: 'Attack_Sweep_2',
  releaseAnimClip: 'Attack_Sweep_2',
  label: 'Размах алебардой II',
  windup: 0.58,
  active: 0.17,
  recovery: 0.54,
  trackingCutoff01: 0.88,
  staminaDamage: 32,
  damageLevel: 'light',
  damageMult: 1.08,
  reach: 2.75,
  arcRad: Math.PI * 0.96,
  telegraphForward: 1.55,
  telegraphRadius: 0,
  lungeSpeed: 3.10,
  stepStart01: 0.34,
  stepPeak01: 0.88,
  lungeWindowSec: 0.30,
  followThroughSlide: 0.0,
  canParry: true,
  parryable: true,
  isPierce: false,
  isRanged: false,
  heavySfx: false,
  postBackstep: false,
  backstepSpeed: 3.3,
  backstepDuration: 0.32,
  punishTier: 'light',
  punishDmgMult: 1.18,
  punishStaggerMult: 1.25,
  followUpIds: Object.freeze(['shield_bash'])
});

const FOOTMAN_SHIELD_BASH = Object.freeze({
  id: 'shield_bash',
  moveType: 'shield_bash',
  attackAnimClip: 'Attack_Shield_Bash',
  releaseAnimClip: 'Attack_Shield_Bash',
  label: 'Таранный удар щитом',
  windup: 0.60,
  active: 0.16,
  recovery: 0.64,
  trackingCutoff01: 0.86,
  staminaDamage: 58,
  damageLevel: 'heavy',
  damageMult: 0.95,
  reach: 2.45,
  arcRad: Math.PI * 0.72,
  telegraphForward: 1.35,
  telegraphRadius: 0,
  lungeSpeed: 3.95,
  stepStart01: 0.36,
  stepPeak01: 0.90,
  lungeWindowSec: 0.32,
  followThroughSlide: 0.0,
  canParry: false,
  parryable: false,
  guardBreaker: true,
  isPierce: false,
  isRanged: false,
  heavySfx: true,
  postBackstep: false,
  punishTier: 'heavy',
  punishDmgMult: 1.25,
  punishStaggerMult: 1.35,
  followUpIds: Object.freeze([])
});

const FOOTMAN_OVERHEAD_POKE = Object.freeze({
  id: 'overhead_poke',
  moveType: 'overhead',
  attackAnimClip: 'Attack_Overhead_Poke',
  releaseAnimClip: 'Attack_Overhead_Poke',
  label: 'Высокий укол поверх щита',
  windup: 0.66,
  active: 0.16,
  recovery: 0.58,
  trackingCutoff01: 0.86,
  staminaDamage: 36,
  damageLevel: 'light',
  damageMult: 1.14,
  reach: 2.85,
  arcRad: Math.PI * 0.56,
  telegraphForward: 1.65,
  telegraphRadius: 0,
  lungeSpeed: 3.15,
  stepStart01: 0.38,
  stepPeak01: 0.88,
  lungeWindowSec: 0.32,
  followThroughSlide: 0.0,
  canParry: true,
  parryable: true,
  isPierce: true,
  isRanged: false,
  heavySfx: false,
  postBackstep: false,
  backstepSpeed: 3.25,
  backstepDuration: 0.32,
  punishTier: 'light',
  punishDmgMult: 1.2,
  punishStaggerMult: 1.25,
  followUpIds: Object.freeze(['sweep_2'])
});

const ARCHER_AIM_SHOT = Object.freeze({
  id: 'shot',
  moveType: 'shot',
  attackAnimClip: 'Aim_Draw',
  releaseAnimClip: 'Shot_Release',
  label: 'Прицельный выстрел',
  windup: 0.74,
  active: 0.08,
  recovery: 0.82,
  trackingCutoff01: 0.86,
  staminaDamage: 24,
  damageLevel: 'light',
  damageMult: 1.0,
  reach: 16.5,
  arcRad: Math.PI * 0.2,
  telegraphForward: 1.0,
  telegraphRadius: 0,
  lungeSpeed: 0,
  stepStart01: 0,
  stepPeak01: 0,
  lungeWindowSec: 0,
  followThroughSlide: 0,
  projectileSpeed: 21.0,
  projectileMaxDist: 20.5,
  canParry: false,
  parryable: false,
  isPierce: true,
  isRanged: true,
  heavySfx: false,
  postBackstep: false,
  punishTier: 'light',
  punishDmgMult: 1.2,
  punishStaggerMult: 1.25,
  followUpIds: Object.freeze([])
});

const ARCHER_QUICK_RETREAT_SHOT = Object.freeze({
  id: 'quick_retreat_shot',
  moveType: 'shot',
  attackAnimClip: 'Quick_Retreat_Shot',
  releaseAnimClip: 'Quick_Retreat_Shot',
  label: 'Отпрыг с выстрелом',
  windup: 0.66,
  active: 0.08,
  recovery: 0.85,
  trackingCutoff01: 0.66,
  staminaDamage: 18,
  damageLevel: 'light',
  damageMult: 0.88,
  reach: 13.5,
  arcRad: Math.PI * 0.22,
  telegraphForward: 0.95,
  telegraphRadius: 0,
  lungeSpeed: -1.75,
  stepStart01: 0.35,
  stepPeak01: 0.88,
  lungeWindowSec: 0.28,
  followThroughSlide: 0,
  projectileSpeed: 17.5,
  projectileMaxDist: 18.0,
  canParry: false,
  parryable: false,
  isPierce: true,
  isRanged: true,
  heavySfx: false,
  postBackstep: true,
  backstepSpeed: 3.05,
  backstepDuration: 0.34,
  punishTier: 'light',
  punishDmgMult: 1.2,
  punishStaggerMult: 1.25,
  followUpIds: Object.freeze([])
});

export const SOULS_MOB_PROFILES = Object.freeze({
  iron_knight: Object.freeze({
    id: 'iron_knight',
    glbName: 'Rift_Executioner_Tripo.glb',
    role: 'duelist',
    staggerMax: 145,
    flatDef: 22,
    physNegation: 0.14,
    preferredDist: 2.65,
    retreatDist: 1.35,
    strafeSpeed: 2.25,
    approachSpeedMult: 1.28,
    inertiaAccel: 11.0,
    refWalkSpeed: 2.65,
    aggroRange: 9.8,
    parriesToKneel: 2,
    isRanged: false,
    strafeSwitchMinSec: 1.2,
    strafeSwitchMaxSec: 2.1,
    neutralDecisionMinSec: 0.58,
    neutralDecisionMaxSec: 1.18,
    assessIntervalMinSec: 3.2,
    assessIntervalMaxSec: 5.0,
    assessPauseMinSec: 0.18,
    assessPauseMaxSec: 0.34,
    postComboBackstepDist: 1.65,
    postComboBackstepChance: 0.12,
    backstepSpeed: 3.3,
    backstepDuration: 0.30,
    trackingTurnRate: 11.2,
    telegraphColor: null,
    patrolSpeed: 1.2,
    patrolRadiusMin: 1.5,
    patrolRadiusMax: 2.3,
    patrolIdleMinSec: 2.4,
    patrolIdleMaxSec: 4.2,
    patrolWalkMinSec: 1.8,
    patrolWalkMaxSec: 3.0,
    patrolAnimSpeedMult: 0.48,
    attackMetas: Object.freeze({
      slash_1: IRON_KNIGHT_SLASH_1,
      slash_2: IRON_KNIGHT_SLASH_2,
      overhead_crush: IRON_KNIGHT_OVERHEAD_CRUSH,
      thrust_lunge: IRON_KNIGHT_THRUST_LUNGE,
      slash: IRON_KNIGHT_SLASH_1,
      overhead: IRON_KNIGHT_OVERHEAD_CRUSH
    })
  }),

  cursed_footman: Object.freeze({
    id: 'cursed_footman',
    glbName: 'Rift_Vanguard_Tripo.glb',
    role: 'guard',
    staggerMax: 130,
    flatDef: 12,
    physNegation: 0.06,
    preferredDist: 2.35,
    retreatDist: 1.25,
    strafeSpeed: 2.45,
    approachSpeedMult: 1.32,
    inertiaAccel: 13.0,
    refWalkSpeed: 2.55,
    aggroRange: 10.4,
    parriesToKneel: 1,
    isRanged: false,
    strafeSwitchMinSec: 1.1,
    strafeSwitchMaxSec: 2.0,
    neutralDecisionMinSec: 0.52,
    neutralDecisionMaxSec: 1.10,
    assessIntervalMinSec: 3.2,
    assessIntervalMaxSec: 4.8,
    assessPauseMinSec: 0.16,
    assessPauseMaxSec: 0.30,
    postComboBackstepDist: 1.60,
    postComboBackstepChance: 0.14,
    backstepSpeed: 3.35,
    backstepDuration: 0.30,
    trackingTurnRate: 12.4,
    telegraphColor: null,
    patrolSpeed: 1.26,
    patrolRadiusMin: 1.5,
    patrolRadiusMax: 2.2,
    patrolIdleMinSec: 2.4,
    patrolIdleMaxSec: 4.0,
    patrolWalkMinSec: 1.8,
    patrolWalkMaxSec: 2.9,
    patrolAnimSpeedMult: 0.48,
    attackMetas: Object.freeze({
      thrust_1: FOOTMAN_THRUST_1,
      sweep_2: FOOTMAN_SWEEP_2,
      shield_bash: FOOTMAN_SHIELD_BASH,
      overhead_poke: FOOTMAN_OVERHEAD_POKE,
      thrust: FOOTMAN_THRUST_1,
      slash: FOOTMAN_SWEEP_2
    })
  }),

  ember_skeleton: Object.freeze({
    id: 'ember_skeleton',
    glbName: 'Rift_Vanguard_Tripo.glb',
    role: 'guard',
    staggerMax: 120,
    flatDef: 12,
    physNegation: 0.06,
    preferredDist: 2.35,
    retreatDist: 1.25,
    strafeSpeed: 2.45,
    approachSpeedMult: 1.32,
    inertiaAccel: 13.0,
    refWalkSpeed: 2.55,
    aggroRange: 10.4,
    parriesToKneel: 1,
    isRanged: false,
    strafeSwitchMinSec: 1.1,
    strafeSwitchMaxSec: 2.0,
    neutralDecisionMinSec: 0.52,
    neutralDecisionMaxSec: 1.10,
    assessIntervalMinSec: 3.2,
    assessIntervalMaxSec: 4.8,
    assessPauseMinSec: 0.16,
    assessPauseMaxSec: 0.30,
    postComboBackstepDist: 1.60,
    postComboBackstepChance: 0.14,
    backstepSpeed: 3.35,
    backstepDuration: 0.30,
    trackingTurnRate: 12.4,
    telegraphColor: null,
    patrolSpeed: 1.26,
    patrolRadiusMin: 1.5,
    patrolRadiusMax: 2.2,
    patrolIdleMinSec: 2.4,
    patrolIdleMaxSec: 4.0,
    patrolWalkMinSec: 1.8,
    patrolWalkMaxSec: 2.9,
    patrolAnimSpeedMult: 0.48,
    attackMetas: Object.freeze({
      thrust_1: FOOTMAN_THRUST_1,
      sweep_2: FOOTMAN_SWEEP_2,
      shield_bash: FOOTMAN_SHIELD_BASH,
      overhead_poke: FOOTMAN_OVERHEAD_POKE,
      thrust: FOOTMAN_THRUST_1,
      slash: FOOTMAN_SWEEP_2
    })
  }),

  bone_archer: Object.freeze({
    id: 'bone_archer',
    glbName: 'Rift_Acolyte_Tripo.glb',
    role: 'archer',
    staggerMax: 95,
    flatDef: 10,
    physNegation: 0.02,
    preferredDist: 12.0,
    retreatDist: 6.8,
    optimalMinDist: 8.5,
    optimalMaxDist: 16.0,
    noAdvanceBelowDist: 14.5,
    stepUpTriggerDist: 16.5,
    stepUpTargetDist: 13.5,
    maxHomeZoneRadius: 5.2,
    strafeSpeed: 1.55,
    approachSpeedMult: 0.85,
    inertiaAccel: 10.0,
    refWalkSpeed: 2.15,
    aggroRange: 14.5,
    parriesToKneel: 1,
    isRanged: true,
    strafeSwitchMinSec: 1.6,
    strafeSwitchMaxSec: 2.7,
    neutralDecisionMinSec: 0.75,
    neutralDecisionMaxSec: 1.45,
    assessIntervalMinSec: 3.2,
    assessIntervalMaxSec: 4.8,
    assessPauseMinSec: 0.18,
    assessPauseMaxSec: 0.34,
    postComboBackstepDist: 6.8,
    postComboBackstepChance: 0.62,
    backstepSpeed: 3.25,
    backstepDuration: 0.32,
    trackingTurnRate: 10.2,
    telegraphColor: null,
    patrolSpeed: 1.12,
    patrolRadiusMin: 1.0,
    patrolRadiusMax: 1.5,
    patrolIdleMinSec: 3.0,
    patrolIdleMaxSec: 5.0,
    patrolWalkMinSec: 1.6,
    patrolWalkMaxSec: 2.6,
    patrolAnimSpeedMult: 0.46,
    attackMetas: Object.freeze({
      shot: ARCHER_AIM_SHOT,
      aim_draw: ARCHER_AIM_SHOT,
      quick_retreat_shot: ARCHER_QUICK_RETREAT_SHOT,
      quick_shot: ARCHER_QUICK_RETREAT_SHOT
    })
  })
});

const ROLE_TO_PROFILE_ID = Object.freeze({
  duelist: 'iron_knight',
  guard: 'cursed_footman',
  archer: 'bone_archer'
});

export const SOULS_MOB_LEASH_PROFILES = Object.freeze({
  iron_knight: Object.freeze({
    maxPursuitDist: 15.5,
    noLosDisengageDist: 11.5,
    noLosDisengageSec: 1.8,
    reaggroDist: 9.5,
    returnWalkSpeed: 1.75
  }),
  cursed_footman: Object.freeze({
    maxPursuitDist: 17.5,
    noLosDisengageDist: 13.0,
    noLosDisengageSec: 2.0,
    reaggroDist: 9.5,
    returnWalkSpeed: 1.85
  }),
  ember_skeleton: Object.freeze({
    maxPursuitDist: 17.5,
    noLosDisengageDist: 13.0,
    noLosDisengageSec: 2.0,
    reaggroDist: 9.5,
    returnWalkSpeed: 1.85
  }),
  bone_archer: Object.freeze({
    maxPursuitDist: 24.0,
    noLosDisengageDist: 0.0,
    noLosDisengageSec: 6.5,
    reaggroDist: 14.5,
    returnWalkSpeed: 1.65
  })
});

export function getMobLeashConfig(e, profile) {
  const key =
    (typeof e?.type === 'string' && SOULS_MOB_LEASH_PROFILES[e.type] ? e.type : null) ||
    (profile?.id && SOULS_MOB_LEASH_PROFILES[profile.id] ? profile.id : null) ||
    (e?.soulsRole && SOULS_MOB_LEASH_PROFILES[ROLE_TO_PROFILE_ID[e.soulsRole]] ? ROLE_TO_PROFILE_ID[e.soulsRole] : null) ||
    'iron_knight';
  return SOULS_MOB_LEASH_PROFILES[key] || SOULS_MOB_LEASH_PROFILES.iron_knight;
}

// ============================================================================
// 3. Pack Attack Token Director & Anti-Clumping Registry
// ============================================================================
let _packSimClock = 0;
let _packFallbackUid = 1;
const _meleeTokenHolders = new Map();
const _rangedTokenHolders = new Map();
const _activeMobRegistry = new Map();

function getMobTokenId(e) {
  if (!e) return 'none';
  if (e.uid !== undefined && e.uid !== null) return String(e.uid);
  if (!e._soulsPackUid) {
    e._soulsPackUid = `mob_${_packFallbackUid++}`;
  }
  return e._soulsPackUid;
}

function prunePackCoordinator(nowSec, liveEnemies = null) {
  let liveSet = null;
  if (Array.isArray(liveEnemies) && liveEnemies.length > 0) {
    liveSet = new Set();
    for (let i = 0; i < liveEnemies.length; i++) {
      const m = liveEnemies[i];
      if (m && (m.hp === undefined || m.hp > 0)) {
        liveSet.add(getMobTokenId(m));
      }
    }
  }

  for (const [id, rec] of _meleeTokenHolders) {
    const expired =
      nowSec - rec.lastRefreshedAt > SOULS_PACK_CFG.tokenHeartbeatSec ||
      nowSec - rec.acquiredAt > SOULS_PACK_CFG.tokenStaleSec;
    if (expired || (liveSet && !liveSet.has(id))) {
      _meleeTokenHolders.delete(id);
    }
  }
  for (const [id, rec] of _rangedTokenHolders) {
    const expired =
      nowSec - rec.lastRefreshedAt > SOULS_PACK_CFG.tokenHeartbeatSec ||
      nowSec - rec.acquiredAt > SOULS_PACK_CFG.tokenStaleSec;
    if (expired || (liveSet && !liveSet.has(id))) {
      _rangedTokenHolders.delete(id);
    }
  }
  for (const [id, rec] of _activeMobRegistry) {
    if (nowSec - rec.lastSeenAt > SOULS_PACK_CFG.allyStaleSec || (liveSet && !liveSet.has(id))) {
      _activeMobRegistry.delete(id);
    }
  }
}

export function resetSoulsPackCoordinator() {
  _packSimClock = 0;
  _meleeTokenHolders.clear();
  _rangedTokenHolders.clear();
  _activeMobRegistry.clear();
}

export function releaseSoulsAttackToken(e) {
  if (!e) return;
  const id = getMobTokenId(e);
  _meleeTokenHolders.delete(id);
  _rangedTokenHolders.delete(id);
  e._soulsHasAttackToken = false;
}

export function getSoulsPackCoordinatorState() {
  return {
    activeMeleeCount: _meleeTokenHolders.size,
    activeRangedCount: _rangedTokenHolders.size,
    meleeHolderIds: Array.from(_meleeTokenHolders.keys()),
    rangedHolderIds: Array.from(_rangedTokenHolders.keys()),
    trackedMobCount: _activeMobRegistry.size
  };
}

function tryAcquireAttackToken(e, isRanged, angleFromPlayer, maxMelee, maxRanged) {
  const id = getMobTokenId(e);
  const map = isRanged ? _rangedTokenHolders : _meleeTokenHolders;
  const cap = isRanged ? Math.max(1, maxRanged | 0) : Math.max(1, maxMelee | 0);

  if (map.has(id)) {
    const rec = map.get(id);
    rec.angleFromPlayer = angleFromPlayer;
    rec.acquiredAt = _packSimClock;
    rec.lastRefreshedAt = _packSimClock;
    e._soulsHasAttackToken = true;
    return true;
  }

  if (map.size >= cap) {
    e._soulsHasAttackToken = false;
    return false;
  }

  if (!isRanged && map.size > 0) {
    for (const rec of map.values()) {
      const angGap = Math.abs(normalizeAngle(angleFromPlayer - rec.angleFromPlayer));
      if (angGap < SOULS_PACK_CFG.minFlankAngleRad) {
        e._soulsHasAttackToken = false;
        return false;
      }
    }
  }

  map.set(id, {
    id,
    angleFromPlayer,
    acquiredAt: _packSimClock,
    lastRefreshedAt: _packSimClock
  });
  e._soulsHasAttackToken = true;
  return true;
}

function renewAttackTokenOnCombo(e, isRanged, angleFromPlayer) {
  const id = getMobTokenId(e);
  const map = isRanged ? _rangedTokenHolders : _meleeTokenHolders;
  const rec = map.get(id);
  if (rec) {
    rec.acquiredAt = _packSimClock;
    rec.lastRefreshedAt = _packSimClock;
    if (Number.isFinite(angleFromPlayer)) rec.angleFromPlayer = angleFromPlayer;
    e._soulsHasAttackToken = true;
  }
}

function refreshAttackToken(e, isRanged, angleFromPlayer) {
  const id = getMobTokenId(e);
  const map = isRanged ? _rangedTokenHolders : _meleeTokenHolders;
  const rec = map.get(id);
  if (rec) {
    rec.angleFromPlayer = angleFromPlayer;
    rec.lastRefreshedAt = _packSimClock;
    e._soulsHasAttackToken = true;
    return true;
  }
  e._soulsHasAttackToken = false;
  return false;
}

function computeAllySeparationAndFlankBias(e, px, pz, liveEnemies) {
  const myId = getMobTokenId(e);
  const ex = e.x || 0;
  const ez = e.z || 0;
  const sepR = SOULS_PACK_CFG.allySeparationRadius;
  let sepX = 0;
  let sepZ = 0;

  if (Array.isArray(liveEnemies) && liveEnemies.length > 0) {
    for (let i = 0; i < liveEnemies.length; i++) {
      const other = liveEnemies[i];
      if (!other || other === e || !other.isSoulsUnit || other.isSoulsBoss) continue;
      if (other.hp !== undefined && other.hp <= 0) continue;
      const adx = ex - (other.x || 0);
      const adz = ez - (other.z || 0);
      const d = Math.hypot(adx, adz);
      if (d > 0.001 && d < sepR) {
        const push = (1 - d / sepR) * SOULS_PACK_CFG.allySeparationStrength;
        sepX += (adx / d) * push;
        sepZ += (adz / d) * push;
      }
    }
  } else {
    for (const [id, other] of _activeMobRegistry) {
      if (id === myId) continue;
      const adx = ex - other.x;
      const adz = ez - other.z;
      const d = Math.hypot(adx, adz);
      if (d > 0.001 && d < sepR) {
        const push = (1 - d / sepR) * SOULS_PACK_CFG.allySeparationStrength;
        sepX += (adx / d) * push;
        sepZ += (adz / d) * push;
      }
    }
  }

  let preferredFlankDir = 0;
  if (_meleeTokenHolders.size > 0 && !_meleeTokenHolders.has(myId)) {
    const myAngleFromPlayer = Math.atan2(ex - px, ez - pz);
    let nearestGap = Infinity;
    let signedGap = 0;
    for (const rec of _meleeTokenHolders.values()) {
      const diff = normalizeAngle(myAngleFromPlayer - rec.angleFromPlayer);
      if (Math.abs(diff) < nearestGap) {
        nearestGap = Math.abs(diff);
        signedGap = diff;
      }
    }
    if (nearestGap < 1.35) {
      preferredFlankDir = signedGap >= 0 ? 1 : -1;
    }
  }

  return { sepX, sepZ, preferredFlankDir };
}

// ============================================================================
// 4. Math, Flame-Trap Zone Bounds & Multi-Room Castle Velocity Guard
// ============================================================================

function clamp(val, min, max) {
  return val < min ? min : val > max ? max : val;
}

function smoothstep01(t) {
  const u = clamp(t, 0, 1);
  return u * u * (3 - 2 * u);
}

function normalizeAngle(angle) {
  let a = angle;
  while (a > Math.PI) a -= TWO_PI;
  while (a < -Math.PI) a += TWO_PI;
  return a;
}

function lerpAngle(current, target, t) {
  const diff = normalizeAngle(target - current);
  return current + diff * clamp(t, 0, 1);
}

function randRange(min, max, rng) {
  const r = typeof rng === 'function' ? rng() : Math.random();
  return min + (max - min) * clamp(Number.isFinite(r) ? r : 0.5, 0, 1);
}

export function getSoulsMobProfile(typeOrEnemy) {
  if (!typeOrEnemy) return SOULS_MOB_PROFILES.iron_knight;
  if (typeof typeOrEnemy === 'string') {
    return SOULS_MOB_PROFILES[typeOrEnemy] || SOULS_MOB_PROFILES[ROLE_TO_PROFILE_ID[typeOrEnemy]] || SOULS_MOB_PROFILES.iron_knight;
  }
  const byType = SOULS_MOB_PROFILES[typeOrEnemy.type];
  if (byType) return byType;
  const byRole = ROLE_TO_PROFILE_ID[typeOrEnemy.soulsRole];
  return SOULS_MOB_PROFILES[byRole] || SOULS_MOB_PROFILES.iron_knight;
}

export function getCorridorMaxX(z, radius = 0.55) {
  const b = getLiveCorridorBounds();
  const halfW = z >= b.bridgeSouthZ ? b.courtyardHalfWidth : b.bridgeHalfWidth;
  return Math.max(0.6, halfW - radius - b.wallMargin);
}

function isInEastAlcoveZone(e, x, z) {
  const b = getLiveCorridorBounds();
  if (e?.soulsRoomId === 'east_alcove') {
    return x >= b.eastAlcoveMinX - 1.0;
  }
  return x >= b.eastAlcoveMinX - 0.3 &&
    z >= b.eastAlcoveMinZ - 0.5 &&
    z <= b.eastAlcoveMaxZ + 0.5;
}

function resolveMobAllowedZDomain(e, liveBounds, flameBand) {
  const anchorZ = Number.isFinite(e?.homeZ)
    ? e.homeZ
    : (Number.isFinite(e?.patrolHomeZ)
      ? e.patrolHomeZ
      : (Number.isFinite(e?.z) ? e.z : 0));
  const bandMidZ = (flameBand.minZ + flameBand.maxZ) * 0.5;

  // Mobs spawned south of the Flame Gauntlet (e.g. `starter_duelist` in Zone 2)
  // stay strictly south of `flameBand.maxZ`; corridor/nave/wing mobs north of the
  // gauntlet stay strictly north of `flameBand.minZ` (e.g. z <= 1.8 or z <= 7.0)!
  if (anchorZ >= bandMidZ) {
    return {
      minZ: flameBand.maxZ,
      maxZ: liveBounds.maxZ,
      isSouthOfTraps: true
    };
  }
  return {
    minZ: liveBounds.minZ,
    maxZ: flameBand.minZ,
    isSouthOfTraps: false
  };
}

/**
 * Multi-room walkable stone, Boss Door (`z >= fogGateZ`) & Flame-Trap No-Mob
 * velocity guard. Delegates polygon clamping to `CASTLE_LAYOUT.clampCastlePosition`
 * while strictly keeping mobs out of flame traps and sealed Boss Hall.
 */
export function clampSoulsCorridorVelocity(e, vx, vz, dt = 0.016, opts = {}) {
  const b = getLiveCorridorBounds();
  const flameBand = getFlameTrapForbiddenBand(opts);
  const zDom = resolveMobAllowedZDomain(e, b, flameBand);
  const radius = Number(e?.radius) > 0 ? Number(e.radius) : 0.55;
  const x = Number.isFinite(e?.x) ? e.x : 0;
  const z = Number.isFinite(e?.z) ? e.z : 0;
  const safeDt = clamp(Number(dt) || 0.016, 0.001, 0.1);
  const inAlcove = isInEastAlcoveZone(e, x, z);

  const minZ = opts.minZ ?? Math.max(b.minZ, zDom.minZ);
  const maxZ = opts.maxZ ?? zDom.maxZ;

  let outVx = Number.isFinite(vx) ? vx : 0;
  let outVz = Number.isFinite(vz) ? vz : 0;
  let fogGateClamped = false;
  let flameTrapClamped = false;

  const nextZ = z + outVz * safeDt;
  if (nextZ < minZ) {
    outVz = Math.max(0, (minZ - z) / safeDt);
    if (zDom.isSouthOfTraps && minZ >= flameBand.maxZ - 0.05) {
      flameTrapClamped = true;
    } else if (minZ <= b.minZ + 0.05) {
      fogGateClamped = true;
    }
  } else if (nextZ > maxZ) {
    outVz = Math.min(0, (maxZ - z) / safeDt);
    if (!zDom.isSouthOfTraps && maxZ <= flameBand.minZ + 0.05) {
      flameTrapClamped = true;
    }
  }

  // Only enforce the 8.5m Bonfire Sanctuary repulsion when the player is ACTUALLY resting at the Bonfire;
  // during active combat/pursuit/return-home, use ONLY the physical Bonfire hearth radius (~1.35m)!
  const bfZone = getBonfireSafeZone(opts);
  const candX0 = x + outVx * safeDt;
  const candZ0 = clamp(z + outVz * safeDt, minZ, maxZ);
  const bdx = candX0 - bfZone.x;
  const bdz = candZ0 - bfZone.z;
  const bDist = Math.hypot(bdx, bdz);
  const minBfDist = getEffectiveBonfireRepulsionRadius(opts);
  if (bDist < minBfDist && bDist > 1e-4 && Math.hypot(x - bfZone.x, z - bfZone.z) >= minBfDist - 0.1) {
    const pushX = bfZone.x + (bdx / bDist) * minBfDist;
    const pushZ = clamp(bfZone.z + (bdz / bDist) * minBfDist, minZ, maxZ);
    outVx = (pushX - x) / safeDt;
    outVz = (pushZ - z) / safeDt;
  }

  // Exact multi-room walkable clamping via `CASTLE_LAYOUT.clampCastlePosition`
  if (typeof CASTLE_LAYOUT.clampCastlePosition === 'function') {
    const candX = x + outVx * safeDt;
    const candZ = clamp(z + outVz * safeDt, minZ, maxZ);
    const projected = CASTLE_LAYOUT.clampCastlePosition(candX, candZ, radius, {
      bossDoorState: 'closed',
      allowBossHall: false,
      out: _tmpClampOut
    });
    const clampedZ = clamp(projected.z, minZ, maxZ);
    if (Math.hypot(vx || 0, vz || 0) < 1e-5 && Math.hypot(projected.x - x, clampedZ - z) < 0.005) {
      outVx = 0;
      outVz = 0;
    } else {
      outVx = (projected.x - x) / safeDt;
      outVz = (clampedZ - z) / safeDt;
    }
    // Guard against hitstop tiny-dt velocity explosion (dt ~ 0.001s dividing tiny wall push -> 20 m/s spike!)
    const maxSafeSpd = Math.max(Math.hypot(vx || 0, vz || 0) * 1.15, 3.8);
    const outSpd = Math.hypot(outVx, outVz);
    if (outSpd > maxSafeSpd && outSpd > 1e-5) {
      const sc = maxSafeSpd / outSpd;
      outVx *= sc;
      outVz *= sc;
    }
    return {
      vx: outVx,
      vz: outVz,
      fogGateClamped,
      flameTrapClamped,
      maxX: Math.max(Math.abs(projected.x) + 0.5, getCorridorMaxX(clampedZ, radius)),
      minX: -Math.max(Math.abs(projected.x) + 0.5, getCorridorMaxX(clampedZ, radius)),
      minZ,
      maxZ
    };
  }

  let minX;
  let maxX;
  const clampedNextZ = clamp(z + outVz * safeDt, minZ, maxZ);
  if (inAlcove) {
    const inArch = clampedNextZ >= b.eastArchMinZ + radius && clampedNextZ <= b.eastArchMaxZ - radius;
    minX = inArch ? -b.bridgeHalfWidth + radius + b.wallMargin : b.eastAlcoveMinX + radius + b.wallMargin;
    maxX = b.eastAlcoveMaxX - radius - b.wallMargin;
  } else {
    maxX = getCorridorMaxX(clampedNextZ, radius);
    minX = -maxX;
    if (clampedNextZ >= b.eastArchMinZ + radius && clampedNextZ <= b.eastArchMaxZ - radius && x > b.bridgeHalfWidth - 1.9) {
      maxX = b.eastAlcoveMaxX - radius - b.wallMargin;
    }
  }

  const nextX = x + outVx * safeDt;
  if (nextX > maxX && outVx > 0) {
    outVx = Math.max(0, (maxX - x) / safeDt);
  } else if (nextX < minX && outVx < 0) {
    outVx = Math.min(0, (minX - x) / safeDt);
  }

  return { vx: outVx, vz: outVz, fogGateClamped, flameTrapClamped, maxX, minX, minZ, maxZ };
}

function checkAmbushTrigger(e, px, pz, dist, ctx) {
  if (ctx.ambushTriggered === true) return true;

  const tb = e.ambushTriggerBounds;
  if (tb && Number.isFinite(tb.minX) && Number.isFinite(tb.maxX) && Number.isFinite(tb.minZ) && Number.isFinite(tb.maxZ)) {
    if (px >= tb.minX && px <= tb.maxX && pz >= tb.minZ && pz <= tb.maxZ) return true;
  }
  if (Number.isFinite(e.ambushTriggerX) && Number.isFinite(e.ambushTriggerZ)) {
    const tr = Number(e.ambushTriggerRadius) > 0 ? Number(e.ambushTriggerRadius) : 4.2;
    if (Math.hypot(px - e.ambushTriggerX, pz - e.ambushTriggerZ) <= tr) return true;
  }

  if (typeof CASTLE_LAYOUT.checkCastleAmbushTrigger === 'function') {
    const hit = CASTLE_LAYOUT.checkCastleAmbushTrigger(px, pz);
    if (hit) {
      if (!e.ambushId || !hit.id || hit.id === e.ambushId) return true;
    }
  }
  const ambushes = CASTLE_LAYOUT.SOULS_CASTLE_AMBUSHES;
  if (ambushes) {
    const list = Array.isArray(ambushes) ? ambushes : Object.values(ambushes);
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!a || typeof a !== 'object') continue;
      if (e.ambushId && a.id && a.id !== e.ambushId) continue;
      const ab = a.triggerBounds || a.triggerZone || a.zone;
      if (ab && Number.isFinite(ab.minX) && Number.isFinite(ab.maxX) && Number.isFinite(ab.minZ) && Number.isFinite(ab.maxZ)) {
        if (px >= ab.minX && px <= ab.maxX && pz >= ab.minZ && pz <= ab.maxZ) return true;
      }
      const tx = Number.isFinite(a.triggerX) ? a.triggerX : (Number.isFinite(a.x) ? a.x : null);
      const tz = Number.isFinite(a.triggerZ) ? a.triggerZ : (Number.isFinite(a.z) ? a.z : null);
      const tr = Number(a.triggerRadius ?? a.radius) || 4.2;
      if (tx !== null && tz !== null && Math.hypot(px - tx, pz - tz) <= tr) {
        return true;
      }
    }
  }

  const b = getLiveCorridorBounds();
  const inArchCorridorBand =
    pz >= b.eastArchMinZ - 0.6 &&
    pz <= b.eastArchMaxZ + 0.6 &&
    px >= 2.2;
  if (inArchCorridorBand && dist <= (Number(e.ambushAggroRange) || 8.5)) {
    return true;
  }
  const closeAmbushR = Number(e.ambushAggroRange) > 0 ? Math.min(Number(e.ambushAggroRange), 4.6) : 4.4;
  return dist <= closeAmbushR;
}

function clearPunishWindow(e) {
  e.punishWindowTimer = 0;
  e.soulsPunishWindow = null;
  e.soulsPunishTimer = 0;
  e.soulsPunishDmgMult = 1.0;
  e.soulsPunishStaggerMult = 1.0;
  e.soulsPunishTagShown = false;
}

function openPunishWindow(e, duration, tier = 'light', dmgMult = null, staggerMult = null) {
  const dur = Math.max(0, Number(duration) || 0);
  const validTier = tier === 'heavy' || tier === 'light' ? tier : null;
  e.punishWindowTimer = validTier ? dur : 0;
  e.soulsPunishWindow = validTier;
  e.soulsPunishTimer = validTier ? dur : 0;
  e.soulsPunishDmgMult = validTier ? (dmgMult ?? PUNISH_DMG_MULT[validTier] ?? 1.0) : 1.0;
  e.soulsPunishStaggerMult = validTier ? (staggerMult ?? PUNISH_STAGGER_MULT[validTier] ?? 1.0) : 1.0;
  e.soulsPunishTagShown = false;
}

function computePatrolSeed(e) {
  const uid = Number.isFinite(e?.uid) ? e.uid : 0;
  const hx = Number.isFinite(e?.patrolHomeX) ? e.patrolHomeX : (Number.isFinite(e?.x) ? e.x : 0);
  const hz = Number.isFinite(e?.patrolHomeZ) ? e.patrolHomeZ : (Number.isFinite(e?.z) ? e.z : 0);
  const raw = Math.sin(uid * 12.9898 + hx * 78.233 + hz * 37.719 + 1.37) * 43758.5453;
  return raw - Math.floor(raw);
}

function pickPatrolWaypoint(e, profile, rng) {
  const b = getLiveCorridorBounds();
  const flameBand = getFlameTrapForbiddenBand();
  const zDom = resolveMobAllowedZDomain(e, b, flameBand);
  const radius = Number(e?.radius) > 0 ? Number(e.radius) : 0.55;
  const homeX = Number.isFinite(e.patrolHomeX) ? e.patrolHomeX : (Number.isFinite(e.x) ? e.x : 0);
  const homeZ = Number.isFinite(e.patrolHomeZ) ? e.patrolHomeZ : (Number.isFinite(e.z) ? e.z : 0);
  const minR = Number(profile.patrolRadiusMin) || 1.5;
  const maxR = Number(profile.patrolRadiusMax) || 2.3;
  const bfZone = getBonfireSafeZone();

  const minSafeZ = zDom.minZ + 0.45;
  const maxSafeZ = Math.max(minSafeZ + 0.2, zDom.maxZ - 0.45);

  e._patrolSideSign = -(e._patrolSideSign || 1);
  const sideSign = e._patrolSideSign;

  let bestX = homeX;
  let bestZ = clamp(homeZ, minSafeZ, maxSafeZ);
  let bestDistFromCur = -1;

  for (let attempt = 0; attempt < 5; attempt++) {
    const r = randRange(minR, maxR, rng);
    const lateralBias = sideSign * (0.45 + 0.55 * randRange(0, 1, rng));
    const zBias = randRange(-0.85, 0.85, rng);
    const norm = Math.hypot(lateralBias, zBias) || 1;

    let candX = homeX + (lateralBias / norm) * r;
    let candZ = clamp(homeZ + (zBias / norm) * r, minSafeZ, maxSafeZ);

    if (typeof CASTLE_LAYOUT.clampCastlePosition === 'function') {
      const proj = CASTLE_LAYOUT.clampCastlePosition(candX, candZ, radius + 0.2, {
        bossDoorState: 'closed',
        allowBossHall: false,
        out: _tmpClampOut
      });
      candX = proj.x;
      candZ = clamp(proj.z, minSafeZ, maxSafeZ);
    } else {
      const maxX = Math.max(0.45, getCorridorMaxX(candZ, radius) - 0.35);
      candX = clamp(candX, -maxX, maxX);
    }

    // Never patrol into the Bonfire Safe Zone or through walls away from home
    if (Math.hypot(candX - bfZone.x, candZ - bfZone.z) < bfZone.radius + 0.5) {
      continue;
    }
    if (!hasMobWallLineOfSight(homeX, homeZ, candX, candZ, { ignorePillars: true })) {
      continue;
    }

    const distFromCur = Math.hypot(candX - (e.x || 0), candZ - (e.z || 0));
    if (distFromCur > bestDistFromCur) {
      bestDistFromCur = distFromCur;
      bestX = candX;
      bestZ = candZ;
    }
    if (distFromCur >= Math.max(0.65, minR * 0.5)) {
      break;
    }
  }

  e._patrolTargetX = bestX;
  e._patrolTargetZ = bestZ;
  return { x: bestX, z: bestZ };
}

function projectLocalVelocity(vx, vz, facing) {
  const fwdX = Math.sin(facing);
  const fwdZ = Math.cos(facing);
  // Up(0,1,0) x Fwd(sin,0,cos) = (+cos, 0, -sin) = LOCAL LEFT (+X in character space)
  const leftX = Math.cos(facing);
  const leftZ = -Math.sin(facing);
  return {
    localZ: vx * fwdX + vz * fwdZ,
    localX: vx * leftX + vz * leftZ
  };
}

function resolveStrafeAnimMode({ e = null, isMoving, isPatrol, aiState, localX, localZ, yawDelta, dt }) {
  const safeDt = Math.max(0.001, Math.min(0.1, Number(dt) || 0.016));
  const prevMode = e?._soulsPrevAnimMode || 'idle';
  if (e) {
    e._soulsAnimModeHoldTimer = Math.max(0, (e._soulsAnimModeHoldTimer || 0) - safeDt);
  }

  let nextMode;
  if (aiState === 'backstep') {
    nextMode = 'backstep';
  } else if (!isMoving) {
    // Guard against hitstop dt collapse (~0.001s) producing bogus turn_left/turn_right flashes
    const yawRate = safeDt >= 0.004 ? yawDelta / safeDt : 0;
    const turnEnter = prevMode === 'turn_left' || prevMode === 'turn_right' ? 0.022 : 0.048;
    const turnRateEnter = prevMode === 'turn_left' || prevMode === 'turn_right' ? 0.95 : 1.55;
    if (Math.abs(yawDelta) > turnEnter || Math.abs(yawRate) > turnRateEnter) {
      nextMode = yawDelta > 0 ? 'turn_left' : 'turn_right';
    } else {
      nextMode = 'idle';
    }
  } else if (isPatrol) {
    nextMode = 'patrol';
  } else {
    const absX = Math.abs(localX);
    const absZ = Math.abs(localZ);
    const wasStrafe = prevMode === 'strafe_left' || prevMode === 'strafe_right';
    const wasBack = prevMode === 'backstep';
    const strafeRatio = wasStrafe ? 0.58 : 0.78;
    const strafeMinX = wasStrafe ? 0.20 : 0.34;
    const backMinZ = wasBack ? -0.24 : -0.38;
    if (localZ < backMinZ && absZ >= absX * 0.65) {
      nextMode = 'backstep';
    } else if (absX > absZ * strafeRatio && absX > strafeMinX) {
      // Fixed sign: localX > 0 is LEFT (+X), localX < 0 is RIGHT (-X)!
      nextMode = localX > 0 ? 'strafe_left' : 'strafe_right';
    } else {
      nextMode = 'combat_walk';
    }
  }

  // Crisp hysteresis (0.09s) between locomotion gaits avoids rapid twitching without wrong-way footwork lag
  const isGaitPrev = prevMode === 'combat_walk' || prevMode === 'strafe_left' || prevMode === 'strafe_right' || prevMode === 'backstep';
  const isGaitNext = nextMode === 'combat_walk' || nextMode === 'strafe_left' || nextMode === 'strafe_right' || nextMode === 'backstep';
  if (e && nextMode !== prevMode) {
    if (isGaitPrev && isGaitNext && aiState !== 'backstep' && e._soulsAnimModeHoldTimer > 0) {
      return prevMode;
    }
    e._soulsPrevAnimMode = nextMode;
    e._soulsAnimModeHoldTimer = isGaitNext ? 0.09 : 0.06;
  }
  return nextMode;
}

// ============================================================================
// 5. Lifecycle API: initSoulsMobState / onSoulsMobParried / onSoulsMobInterrupted
// ============================================================================

export function initSoulsMobState(e, opts = {}) {
  if (!e || typeof e !== 'object') return e;
  const rng = opts.rng || Math.random;
  const profile = getSoulsMobProfile(opts.profileId || e);
  const b = getLiveCorridorBounds();

  e.soulsMobProfileId = profile.id;
  if (!e.soulsRole) e.soulsRole = profile.role;
  e.staggerMax = Number(opts.staggerMax ?? profile.staggerMax);
  if (!Number.isFinite(e.stagger)) e.stagger = 0;
  e.flatDef = Number(opts.flatDef ?? profile.flatDef);
  e.physNegation = Number(opts.physNegation ?? profile.physNegation);
  e.preferredDist = Number(opts.preferredDist ?? profile.preferredDist);
  e.retreatDist = Number(opts.retreatDist ?? profile.retreatDist);
  e.strafeSpeed = Number(opts.strafeSpeed ?? profile.strafeSpeed);
  e.parriesToKneel = Number(opts.parriesToKneel ?? profile.parriesToKneel);
  e.attackMetas = profile.attackMetas;
  if (!(Number(e.soulsAggroRange) > 0)) {
    e.soulsAggroRange = profile.aggroRange;
  }

  e.isAmbushGuard = Boolean(opts.isAmbushGuard ?? e.isAmbushGuard);
  e._ambushSprung = Boolean(e.soulsAwake);

  e.patrolHomeX = Number.isFinite(opts.patrolHomeX)
    ? opts.patrolHomeX
    : (Number.isFinite(e.x) ? e.x : 0);
  e.patrolHomeZ = Number.isFinite(opts.patrolHomeZ)
    ? opts.patrolHomeZ
    : clamp(Number.isFinite(e.z) ? e.z : 0, b.minZ + 0.45, b.maxZ - 0.5);

  const patrolSeed = computePatrolSeed(e);
  e._patrolSideSign = patrolSeed < 0.5 ? 1 : -1;
  e._patrolPhase = e.isAmbushGuard ? 'idle' : (patrolSeed < 0.65 ? 'idle' : 'walk');
  e._patrolLookOffset = 0;
  e._patrolLookTargetOffset = (patrolSeed - 0.5) * 0.44;
  e._patrolLookTimer = 1.6 + patrolSeed * 2.4;
  e._patrolTargetX = e.patrolHomeX;
  e._patrolTargetZ = e.patrolHomeZ;
  if (e._patrolPhase === 'idle') {
    const idleSpan = (profile.patrolIdleMaxSec || 4.0) - (profile.patrolIdleMinSec || 2.4);
    e._patrolTimer = (profile.patrolIdleMinSec || 2.4) * (0.55 + 0.45 * patrolSeed) + idleSpan * ((patrolSeed * 1.73) % 1);
  } else {
    pickPatrolWaypoint(e, profile, rng);
    e._patrolTimer = randRange(profile.patrolWalkMinSec || 1.8, profile.patrolWalkMaxSec || 3.0, rng);
  }

  e.animSpeedMult = 0;
  e.strafeAnimMode = 'idle';
  e.attackAnimClip = null;
  e.combatPhase = 'neutral';
  e.combatPhase01 = 0;
  e._velX = 0;
  e._velZ = 0;
  e._soulsHasAttackToken = false;

  const initStrafeDir = (typeof rng === 'function' ? rng() : Math.random()) < 0.5 ? 1 : -1;
  const initStrafeTimer = randRange(profile.strafeSwitchMinSec, profile.strafeSwitchMaxSec, rng);

  e.aiState = e.soulsAwake ? 'circle' : (e.isAmbushGuard ? 'ambush' : 'idle');
  e.strafeDir = initStrafeDir;
  e._strafeBlend = initStrafeDir;
  e.strafeTimer = initStrafeTimer;
  e._soulsStrafeDir = initStrafeDir;
  e._soulsStrafeTimer = initStrafeTimer;
  e._soulsWallFlipCooldown = 0;

  e._soulsAssessTimer = 0;
  e._soulsAssessCooldown = randRange(
    profile.assessIntervalMinSec || 2.4,
    profile.assessIntervalMaxSec || 3.8,
    rng
  );

  e.currentAttackMeta = null;
  e.punishWindowTimer = 0;
  e._soulsParryCount = 0;
  e._soulsAttackElapsed = 0;
  e._soulsAttackHitId = 0;
  e._soulsLastAttackId = null;
  e._soulsLockedAngle = Number.isFinite(e.facing) ? e.facing : 0;
  e._soulsTrackingLocked = false;
  e._soulsActiveTimer = 0;
  e._soulsActiveDuration = 0.08;
  e._soulsRecoverDuration = 0;
  e._soulsRecoverElapsed = 0;
  e._soulsPendingBackstep = null;
  e._soulsBackstepTimer = 0;
  e._soulsBackstepDuration = 0;
  e._soulsBackstepSpeed = 0;
  e._soulsBackstepDirX = 0;
  e._soulsBackstepDirZ = 1;
  e._soulsSpacingBias = 0;
  e._soulsSpacingBiasTimer = 0;
  e._soulsPlayerRollMemory = 0;
  e._soulsPlayerBlockMemory = 0;
  e._soulsBlockHoldTime = 0;
  e._soulsRollCount = 0;
  e._soulsRollWindowTimer = 0;
  e._soulsWasPlayerRolling = false;
  e._soulsHealPunishCd = 0;
  e._soulsStepEndRawSpeed = 0;

  if (!e.soulsState) e.soulsState = e.soulsAwake ? 'stalk' : 'idle';
  if (!Number.isFinite(e.soulsTimer)) e.soulsTimer = randRange(0.95, 1.35, rng);
  if (!Number.isFinite(e.soulsComboLeft)) e.soulsComboLeft = 0;
  if (!e.soulsMoveType) e.soulsMoveType = profile.isRanged ? 'shot' : 'slash';
  if (!Number.isFinite(e.soulsStrikeDirX)) e.soulsStrikeDirX = Math.sin(e.facing || 0);
  if (!Number.isFinite(e.soulsStrikeDirZ)) e.soulsStrikeDirZ = Math.cos(e.facing || 0);
  if (!Number.isFinite(e.soulsTelegraphX)) e.soulsTelegraphX = e.x || 0;
  if (!Number.isFinite(e.soulsTelegraphZ)) e.soulsTelegraphZ = e.z || 0;
  clearPunishWindow(e);

  e._soulsMobAiInit = true;
  return e;
}

export function onSoulsMobParried(e, opts = {}) {
  if (!e || typeof e !== 'object') return { staggered: false, riposteOpen: false };
  if (!e._soulsMobAiInit) initSoulsMobState(e);
  releaseSoulsAttackToken(e);

  e._soulsParryCount = (e._soulsParryCount || 0) + 1;
  const parriesNeeded = Math.max(1, Number(e.parriesToKneel) || 1);
  const parryGain = e.staggerMax > 0 ? Math.ceil((e.staggerMax / parriesNeeded) * 1.04) : 82;
  const nextStagger = e.staggerMax > 0 ? Math.min(e.staggerMax, (e.stagger || 0) + parryGain) : 0;
  const fullKneel = e._soulsParryCount >= parriesNeeded || (e.staggerMax > 0 && nextStagger >= e.staggerMax);
  const riposteSec = fullKneel ? Number(opts.riposteSec ?? 2.8) : 0;
  const stunSec = fullKneel ? Number(opts.stunSec ?? 2.6) : 0.95;

  e.currentAttackMeta = null;
  e.soulsComboLeft = 0;
  e._soulsPendingBackstep = null;
  e._soulsAttackElapsed = 0;
  e._soulsActiveTimer = 0;
  e._soulsTrackingLocked = false;
  e._soulsWindupAnimPlayed = false;
  e._soulsSlideTimer = 0;
  e._soulsStepEndRawSpeed = 0;
  e._velX = 0;
  e._velZ = 0;

  if (fullKneel) {
    e._soulsParryCount = 0;
    if (e.staggerMax > 0) {
      e.stagger = e.staggerMax;
    }
    e.staggeredTimer = Math.max(e.staggeredTimer || 0, stunSec);
    e.parriedRiposteTimer = Math.max(e.parriedRiposteTimer || 0, riposteSec);
    e.soulsRiposteUsed = false;
    e.soulsRiposteInvuln = false;
    e._wasStaggerKneeling = true;
    e.soulsState = 'stagger_kneel';
    e.attackAnimClip = 'Stagger_Kneel';
    e.aiState = 'stunned';
    e.stunTimer = Math.max(e.stunTimer || 0, stunSec);
    e.soulsTimer = Math.max(e.soulsTimer || 0, stunSec);
    openPunishWindow(e, riposteSec, 'heavy', 1.25, 1.4);
  } else {
    // Elite Executioner 1st parry: heavy recoil & +52% stance damage, NOT instant riposte!
    if (e.staggerMax > 0) {
      e.stagger = nextStagger;
    }
    e.lastStaggerHitAge = 0;
    e.parriedRiposteTimer = 0;
    e.staggeredTimer = 0;
    e.soulsState = 'recover';
    e.aiState = 'recover';
    e.attackAnimClip = 'Hit_React';
    e.stunTimer = stunSec;
    e.soulsTimer = stunSec;
    openPunishWindow(e, stunSec, 'light', 1.15, 1.25);
  }

  e.combatPhase = 'recover';
  e.combatPhase01 = 0;
  e.strafeAnimMode = 'idle';
  e.animSpeedMult = 0;
  e.vx = 0;
  e.vz = 0;

  return {
    staggered: fullKneel,
    riposteOpen: fullKneel,
    parryCount: fullKneel ? parriesNeeded : e._soulsParryCount,
    parriesNeeded,
    stunSec,
    riposteSec
  };
}

export function onSoulsMobInterrupted(e, recoverSec = 0.56) {
  if (!e || typeof e !== 'object') return;
  if (!e._soulsMobAiInit) initSoulsMobState(e);
  releaseSoulsAttackToken(e);

  const wasAttacking =
    e.soulsState === 'windup' ||
    e.soulsState === 'active' ||
    e.aiState === 'windup' ||
    e.aiState === 'active';

  e._mobActiveSwing = null;
  e.currentAttackMeta = null;
  e.soulsComboLeft = 0;
  e._soulsPendingBackstep = null;
  e._soulsAttackElapsed = 0;
  e._soulsActiveTimer = 0;
  e._soulsTrackingLocked = false;
  e._soulsWindupAnimPlayed = false;
  e._soulsSlideTimer = 0;
  e._soulsStepEndRawSpeed = 0;
  e._velX = 0;
  e._velZ = 0;

  const dur = Math.max(0.32, Number(recoverSec) || 0.56);
  e.aiState = 'hit_react';
  e.soulsState = 'recover';
  e.soulsTimer = Math.max(e.soulsTimer || 0, dur);
  e._soulsRecoverDuration = dur;
  e._soulsRecoverElapsed = 0;
  e.attackAnimClip = 'Hit_React';
  e.combatPhase = 'recover';
  e.combatPhase01 = 0;
  e.strafeAnimMode = 'idle';
  e.animSpeedMult = 0;
  if (wasAttacking) {
    openPunishWindow(e, dur, 'light', 1.15, 1.2);
  }
  e.vx = 0;
  e.vz = 0;
}

export const SOULS_MOB_RIPOSTE_STANDUP_SEC = 2.30;
export const SOULS_MOB_STAGGER_RECOVER_SEC = 0.85;

/**
 * Transitions a regular Souls mob that survived `Riposte_Victim_Fall` into a grounded,
 * expressive 2.30s `Riposte_Stand_Up` recovery (`soulsState = 'riposte_recover'`).
 */
export function startSoulsMobRiposteStandUp(mob, standUpSec = SOULS_MOB_RIPOSTE_STANDUP_SEC) {
  if (!mob || typeof mob !== 'object') return { ok: false, duration: 0, clipName: 'Riposte_Stand_Up' };
  if (!mob._soulsMobAiInit) initSoulsMobState(mob);
  releaseSoulsAttackToken(mob);

  mob._mobActiveSwing = null;
  mob.currentAttackMeta = null;
  mob.soulsComboLeft = 0;
  mob._soulsPendingBackstep = null;
  mob._soulsAttackElapsed = 0;
  mob._soulsActiveTimer = 0;
  mob._soulsTrackingLocked = false;
  mob._soulsWindupAnimPlayed = false;
  mob._soulsSlideTimer = 0;
  mob._soulsStepEndRawSpeed = 0;
  mob._velX = 0;
  mob._velZ = 0;
  mob.aiVx = 0;
  mob.aiVz = 0;
  mob.vx = 0;
  mob.vz = 0;

  mob.soulsRiposteInvuln = false;
  mob.soulsRiposteUsed = false;
  mob._soulsRiposteHasClip = false;
  mob.soulsRiposteTimer = 0;
  mob._wasStaggerKneeling = false;
  mob.stagger = 0;
  mob._soulsParryCount = 0;
  mob.staggeredTimer = 0;
  mob.parriedRiposteTimer = 0;
  mob.stunTimer = 0;

  const fallbackDur = Number(standUpSec) > 0 ? Number(standUpSec) : SOULS_MOB_RIPOSTE_STANDUP_SEC;
  const res = mob.model?.handle?.playClampedClip?.('Riposte_Stand_Up', 1.0, 0.12);
  const dur = res?.ok && res.duration > 0.8 ? Number(res.duration) : fallbackDur;

  mob.soulsState = 'riposte_recover';
  mob.aiState = 'riposte_recover';
  mob.soulsRecoverTimer = dur;
  mob._soulsRecoverDuration = dur;
  mob._soulsRecoverElapsed = 0;
  mob._soulsStandUpClipStarted = Boolean(res?.ok);
  mob._inRiposteRecoverActive = true;
  mob.staggerImmunityTimer = Math.max(mob.staggerImmunityTimer || 0, dur + 2.5);
  mob.attackAnimClip = 'Riposte_Stand_Up';
  mob.combatPhase = 'recover';
  mob.combatPhase01 = 0;
  mob.strafeAnimMode = 'idle';
  mob.animSpeedMult = 0;
  clearPunishWindow(mob);

  return { ok: true, duration: dur, clipName: 'Riposte_Stand_Up' };
}

/**
 * Smoothly transitions a regular Souls mob out of an un-riposted `Stagger_Kneel`
 * over ~0.85s (`soulsState = 'stagger_recover'`) instead of snapping in 1 frame.
 */
export function startSoulsMobStaggerRecover(mob, recoverSec = SOULS_MOB_STAGGER_RECOVER_SEC) {
  if (!mob || typeof mob !== 'object') return { ok: false, duration: 0 };
  if (!mob._soulsMobAiInit) initSoulsMobState(mob);
  releaseSoulsAttackToken(mob);

  mob._mobActiveSwing = null;
  mob.currentAttackMeta = null;
  mob.soulsComboLeft = 0;
  mob._soulsPendingBackstep = null;
  mob._soulsTrackingLocked = false;
  mob._soulsStepEndRawSpeed = 0;
  mob._velX = 0;
  mob._velZ = 0;
  mob.aiVx = 0;
  mob.aiVz = 0;
  mob.vx = 0;
  mob.vz = 0;

  mob._wasStaggerKneeling = false;
  mob.stagger = 0;
  mob._soulsParryCount = 0;
  mob.staggeredTimer = 0;
  mob.parriedRiposteTimer = 0;
  mob.stunTimer = 0;
  mob.soulsRiposteUsed = false;
  mob.soulsRiposteInvuln = false;

  const dur = Math.max(0.35, Number(recoverSec) || SOULS_MOB_STAGGER_RECOVER_SEC);
  mob.model?.handle?.clearClampedClip?.(true, Math.min(0.82, dur * 0.92));

  mob.soulsState = 'stagger_recover';
  mob.aiState = 'stagger_recover';
  mob.soulsRecoverTimer = dur;
  mob._soulsRecoverDuration = dur;
  mob._soulsRecoverElapsed = 0;
  mob._soulsStaggerRecoverCleared = true;
  mob._inStaggerRecoverActive = true;
  mob.staggerImmunityTimer = Math.max(mob.staggerImmunityTimer || 0, dur + 3.2);
  mob.attackAnimClip = null;
  mob.combatPhase = 'recover';
  mob.combatPhase01 = 0;
  mob.strafeAnimMode = 'idle';
  mob.animSpeedMult = 0;
  clearPunishWindow(mob);

  return { ok: true, duration: dur };
}

// ============================================================================
// 6. Attack Selection, Combo Branching & Footwork Helpers (ZERO Red Circles!)
// ============================================================================

function beginAttackWindup(e, profile, attackId, dirToPlayerX, dirToPlayerZ, angToPlayer, comboLeft, out, audio, playAudio) {
  const metas = e.attackMetas || profile.attackMetas;
  const meta = metas[attackId] || Object.values(metas)[0];
  if (!meta) return;

  renewAttackTokenOnCombo(e, profile.isRanged, Math.atan2(-dirToPlayerX, -dirToPlayerZ));

  e._lastSwingConnected = false;
  e.currentAttackMeta = meta;
  e.aiState = 'windup';
  e.soulsState = 'windup';
  e.soulsMoveType = meta.moveType || meta.id;
  e.soulsTimer = meta.windup;
  e.soulsComboLeft = Math.max(0, comboLeft | 0);
  e._soulsAttackElapsed = 0;
  e._soulsActiveTimer = 0;
  e._soulsActiveDuration = Math.max(0.05, Number(meta.active) || 0.08);
  e._soulsTrackingLocked = false;
  e._soulsStepEndRawSpeed = 0;
  e._soulsLastAttackId = meta.id;
  e._soulsAttackHitId = (e._soulsAttackHitId || 0) + 1;
  e._soulsLockedAngle = angToPlayer;
  e.soulsStrikeDirX = dirToPlayerX;
  e.soulsStrikeDirZ = dirToPlayerZ;
  e.soulsTelegraphX = (e.x || 0) + dirToPlayerX * (meta.telegraphForward || 1.5);
  e.soulsTelegraphZ = (e.z || 0) + dirToPlayerZ * (meta.telegraphForward || 1.5);
  e.attackAnimClip = meta.attackAnimClip || null;
  e.combatPhase = 'windup';
  e.combatPhase01 = 0;
  clearPunishWindow(e);

  out.startedWindup = true;
  out.windupMeta = meta;
  out.attackAnimClip = meta.attackAnimClip || null;
  out.combatPhase = 'windup';
  out.combatPhase01 = 0;
  // Wave 2 rule: ZERO arcade red ground circles — players read pure 3D skeletal telegraphs!
  out.telegraph = null;

  if (meta.isRanged) {
    out.triggeredBowDrawSfx = true;
    if (playAudio) {
      audio?.playMobBowDraw?.();
    }
  }
}

function chooseInitialAttack(e, profile, dist, reads, liveFogGateZ, rng) {
  const { playerHealing, playerBlocking, playerTurtleBlocking, playerPanicRolling, playerRollSpam, playerBehind, playerFlanking, playerRetreatSpeed = 0 } = reads;
  const predDist = dist + Math.max(0, playerRetreatSpeed) * 0.22;

  if (profile.id === 'bone_archer') {
    const nearGate = (e.z || 0) <= liveFogGateZ + 1.65;
    const id = dist < (e.retreatDist || profile.retreatDist) && !nearGate ? 'quick_retreat_shot' : 'shot';
    return { attackId: id, comboLeft: 0 };
  }

  if (profile.id === 'cursed_footman' || profile.id === 'ember_skeleton') {
    // Strict reach awareness: NEVER swing short slashes/bashes into thin air if player is outside reach!
    if (predDist > 3.05) {
      return null;
    }
    if ((playerBehind || playerFlanking) && predDist <= 2.65) {
      return { attackId: 'sweep_2', comboLeft: 1 };
    }
    if ((playerTurtleBlocking || (playerBlocking && dist <= 2.35) || dist < 1.75) && predDist <= 2.40 && e._soulsLastAttackId !== 'shield_bash') {
      return { attackId: 'shield_bash', comboLeft: 0 };
    }
    const r = rng();
    if (playerHealing || predDist >= 2.45) {
      return { attackId: 'thrust_1', comboLeft: r < 0.25 ? 1 : 2 };
    }
    if ((playerPanicRolling || playerRollSpam) && e._soulsLastAttackId !== 'overhead_poke' && predDist <= 2.85) {
      return { attackId: 'overhead_poke', comboLeft: 1 };
    }
    if (r < 0.46 && predDist <= 2.68) {
      return { attackId: 'sweep_2', comboLeft: 1 };
    }
    if (r < 0.80) {
      return { attackId: 'thrust_1', comboLeft: r < 0.55 ? 1 : 2 };
    }
    return { attackId: 'overhead_poke', comboLeft: 1 };
  }

  const r = rng();
  const avoidRepeatHeavy = e._soulsLastAttackId === 'overhead_crush' || e._soulsLastAttackId === 'thrust_lunge';

  // Long gap-closer lunge ONLY when thrust_lunge is available and can genuinely connect (2.75..4.15m)
  if ((playerHealing || dist > 2.72) && !avoidRepeatHeavy && predDist <= 4.15) {
    return { attackId: 'thrust_lunge', comboLeft: 1 };
  }
  // If player is beyond standard sword reach (predDist > 2.92m) and thrust_lunge is on anti-repeat,
  // return null so the mob sprints closer instead of whiffing slash_1 into empty air!
  if (predDist > 2.92) {
    return null;
  }
  if ((playerBehind || playerFlanking) && predDist <= 2.75) {
    return { attackId: r < 0.55 ? 'slash_2' : 'slash_1', comboLeft: 2 };
  }
  if ((playerRollSpam || playerTurtleBlocking || playerPanicRolling || r < 0.22) && !avoidRepeatHeavy && predDist <= 2.90) {
    return { attackId: 'overhead_crush', comboLeft: 0 };
  }
  const links = r < 0.25 ? 1 : 2;
  return { attackId: 'slash_1', comboLeft: links };
}

function chooseComboFollowUp(e, profile, prevMeta, dist, relAngleRad, reads, rng) {
  if (!prevMeta || !Array.isArray(prevMeta.followUpIds) || prevMeta.followUpIds.length === 0) {
    return null;
  }
  if ((e.soulsComboLeft || 0) <= 0) return null;
  // Honest reach awareness: if player backed out of followup strike range, abort combo immediately and pursue!
  const predDist = dist + Math.max(0, reads?.playerRetreatSpeed || 0) * 0.20;
  const maxFollowDist = (prevMeta.reach || 2.75) + 0.32;
  if (predDist > maxFollowDist || dist > (prevMeta.reach || 2.75) + 0.45) return null;
  if (Math.abs(relAngleRad) > 1.95) return null;

  const { playerBlocking, playerTurtleBlocking, playerPanicRolling, playerRollSpam, playerFlanking } = reads;

  if (profile.id === 'iron_knight') {
    if (prevMeta.id === 'slash_1') {
      if ((playerPanicRolling || playerRollSpam) && predDist <= 3.00 && rng() < 0.62) {
        return 'overhead_crush';
      }
      return predDist <= 2.92 ? 'slash_2' : null;
    }
    if (prevMeta.id === 'thrust_lunge') {
      if (predDist <= 2.92) return 'slash_2';
      return null;
    }
    if (prevMeta.id === 'slash_2') {
      if ((playerPanicRolling || playerRollSpam || playerTurtleBlocking || (predDist <= 2.85 && rng() < 0.58)) && predDist <= 3.00) {
        return 'overhead_crush';
      }
      return null;
    }
  }

  if (profile.id === 'cursed_footman' || profile.id === 'ember_skeleton') {
    if (prevMeta.id === 'thrust_1') {
      if ((playerBlocking || playerTurtleBlocking) && !playerFlanking && predDist <= 2.45 && rng() < 0.68) {
        return 'shield_bash';
      }
      return predDist <= 2.78 ? 'sweep_2' : null;
    }
    if (prevMeta.id === 'overhead_poke') {
      return predDist <= 2.78 ? 'sweep_2' : null;
    }
    if (prevMeta.id === 'sweep_2') {
      if ((playerBlocking || playerTurtleBlocking || (predDist <= 2.42 && rng() < 0.52)) && predDist <= 2.50) {
        return 'shield_bash';
      }
      return null;
    }
  }

  return predDist <= 2.85 ? prevMeta.followUpIds[0] : null;
}

function isStrafeDirectionBlocked(x0, z0, ux, uz, distProbe, radius, zDom) {
  const probeX = x0 + ux * distProbe;
  const probeZ = z0 + uz * distProbe;
  if (zDom) {
    if (probeZ <= zDom.minZ + 0.14 || probeZ >= zDom.maxZ - 0.14) {
      return true;
    }
  }
  if (typeof CASTLE_LAYOUT.clampCastlePosition === 'function') {
    const proj = CASTLE_LAYOUT.clampCastlePosition(probeX, probeZ, radius + 0.14, {
      bossDoorState: 'closed',
      allowBossHall: false,
      out: _tmpSteerClamp
    });
    return Math.hypot(proj.x - probeX, proj.z - probeZ) > 0.08;
  }
  if (typeof CASTLE_LAYOUT.isInsideCastleWalkable === 'function') {
    return !CASTLE_LAYOUT.isInsideCastleWalkable(probeX, probeZ, radius + 0.12, {
      bossDoorState: 'closed',
      allowBossHall: false
    });
  }
  const maxX = getCorridorMaxX(z0, radius);
  return Math.abs(probeX) >= maxX - 0.1;
}

function updateStrafeTimerAndWallBounce(e, profile, dt, tanX, tanZ, preferredFlankDir, zDom, rng) {
  e._soulsWallFlipCooldown = Math.max(0, (e._soulsWallFlipCooldown || 0) - dt);
  e.strafeTimer = (e.strafeTimer || 0) - dt;

  const radius = Number(e.radius) > 0 ? Number(e.radius) : 0.55;
  const x0 = e.x || 0;
  const z0 = e.z || 0;

  // If currently bypassing a stone pillar, lock strafe direction to the latched world-space bypass side!
  if (e._pillarBypassId && Number.isFinite(e._pillarBypassSideX) && Number.isFinite(e._pillarBypassSideZ)) {
    const sideAlign = tanX * e._pillarBypassSideX + tanZ * e._pillarBypassSideZ;
    const lockedDir = sideAlign >= 0 ? 1 : -1;
    if (!isStrafeDirectionBlocked(x0, z0, tanX * lockedDir, tanZ * lockedDir, 0.65, radius, zDom)) {
      e.strafeDir = lockedDir;
      e.strafeTimer = Math.max(e.strafeTimer, 0.85);
      e._soulsWallFlipCooldown = Math.max(e._soulsWallFlipCooldown, 0.55);
    }
  }

  const curDir = e.strafeDir || 1;
  const hitWall = isStrafeDirectionBlocked(x0, z0, tanX * curDir, tanZ * curDir, 0.72, radius, zDom);

  if (hitWall && e._soulsWallFlipCooldown <= 0) {
    const oppBlocked = isStrafeDirectionBlocked(x0, z0, -tanX * curDir, -tanZ * curDir, 0.72, radius, zDom);
    if (!oppBlocked) {
      e.strafeDir = -curDir;
    }
    e.strafeTimer = randRange(profile.strafeSwitchMinSec, profile.strafeSwitchMaxSec, rng);
    e._soulsWallFlipCooldown = 1.05;
  } else if (preferredFlankDir !== 0 && e.strafeDir !== preferredFlankDir && e._soulsWallFlipCooldown <= 0 && !e._pillarBypassId) {
    // Only take preferredFlankDir if that side is NOT blocked by a wall, pillar, or jamb!
    const flankHitsWall = isStrafeDirectionBlocked(x0, z0, tanX * preferredFlankDir, tanZ * preferredFlankDir, 1.15, radius, zDom);
    if (!flankHitsWall) {
      e.strafeDir = preferredFlankDir;
      e.strafeTimer = randRange(profile.strafeSwitchMinSec * 0.85, profile.strafeSwitchMaxSec, rng);
      e._soulsWallFlipCooldown = 0.75;
    }
  } else if (e.strafeTimer <= 0) {
    const oppBlocked = isStrafeDirectionBlocked(x0, z0, -tanX * curDir, -tanZ * curDir, 0.90, radius, zDom);
    if (!oppBlocked) {
      e.strafeDir = -curDir;
    }
    e.strafeTimer = randRange(profile.strafeSwitchMinSec, profile.strafeSwitchMaxSec, rng);
  }

  const targetDir = e.strafeDir || 1;
  const blendAlpha = clamp(dt / 0.16, 0, 1);
  e._strafeBlend = (Number.isFinite(e._strafeBlend) ? e._strafeBlend : targetDir) +
    (targetDir - (Number.isFinite(e._strafeBlend) ? e._strafeBlend : targetDir)) * blendAlpha;

  e._soulsStrafeDir = e.strafeDir;
  e._soulsStrafeTimer = e.strafeTimer;
}

function startBackstep(e, profile, dirToPlayerX, dirToPlayerZ, tanX, tanZ, zDom, spec = null) {
  releaseSoulsAttackToken(e);
  const dur = Number(spec?.duration ?? profile.backstepDuration ?? 0.34);
  const spd = Number(spec?.speed ?? profile.backstepSpeed ?? 3.15);
  const sDir = e.strafeDir || 1;

  let bx = -dirToPlayerX * 0.92 + tanX * sDir * 0.36;
  let bz = -dirToPlayerZ * 0.92 + tanZ * sDir * 0.36;

  // Pivot sideways if near Boss Doors OR near Flame-Trap forbidden boundary!
  if ((e.z || 0) <= zDom.minZ + 0.85 && bz < 0) {
    bz = 0.08;
    bx = (tanX * sDir) * 1.05 || ((e.x || 0) >= 0 ? -1 : 1);
  } else if ((e.z || 0) >= zDom.maxZ - 0.85 && bz > 0) {
    bz = -0.08;
    bx = (tanX * sDir) * 1.05 || ((e.x || 0) >= 0 ? -1 : 1);
  }
  const bLen = Math.hypot(bx, bz) || 1;

  e.aiState = 'backstep';
  e.soulsState = 'stalk';
  e.attackAnimClip = 'Backstep_Evade';
  e.combatPhase = 'neutral';
  e.combatPhase01 = 0;
  e._soulsBackstepDuration = dur;
  e._soulsBackstepTimer = dur;
  e._soulsBackstepSpeed = spd;
  e._soulsBackstepDirX = bx / bLen;
  e._soulsBackstepDirZ = bz / bLen;
  e.soulsTimer = dur + (profile.isRanged ? 0.55 : 0.48);
}

function createEmptyOut(facing = 0) {
  return {
    vx: 0,
    vz: 0,
    moveLocalX: 0,
    moveLocalZ: 0,
    desiredFacing: facing,
    turnDelta: 0,
    lookYawOffset: 0,
    isMoving: false,
    hasRootMotionStep: false,
    animSpeedMult: 0,
    patrolMoveSpeedRatio: 0,
    strafeAnimMode: 'idle',
    attackAnimClip: null,
    combatPhase: 'neutral',
    combatPhase01: 0,
    aiState: 'idle',
    soulsState: 'idle',
    hasAttackToken: false,
    viaDoorway: false,
    awokeThisStep: false,
    ambushTriggered: false,
    startedWindup: false,
    windupMeta: null,
    telegraph: null,
    strikeMeta: null,
    activeAttackMeta: null,
    trackingLocked: false,
    triggeredSwingSfx: false,
    triggeredHeavySwingSfx: false,
    triggeredBowDrawSfx: false,
    triggeredArrowSfx: false,
    inPunishWindow: false,
    punishWindowTimer: 0,
    punishTier: null,
    fogGateClamped: false,
    flameTrapClamped: false
  };
}

const _STEER_CANDIDATE_ANGLES = Object.freeze([
  0.0,
  0.48, -0.48,
  0.96, -0.96,
  1.42, -1.42,
  1.92, -1.92,
  2.40, -2.40
]);
const _tmpSteerClamp = { x: 0, z: 0 };

function evalMobProbeProgress(e, x, z, ux, uz, probeDist, radius, zDom, bfZone, ctx) {
  const candX = x + ux * probeDist;
  const candZ = z + uz * probeDist;
  let projX = candX;
  let projZ = clamp(candZ, zDom.minZ + 0.08, zDom.maxZ - 0.08);

  if (typeof CASTLE_LAYOUT.clampCastlePosition === 'function') {
    const p = CASTLE_LAYOUT.clampCastlePosition(projX, projZ, radius + 0.08, {
      bossDoorState: 'closed',
      allowBossHall: false,
      out: _tmpSteerClamp
    });
    projX = p.x;
    projZ = clamp(p.z, zDom.minZ + 0.08, zDom.maxZ - 0.08);
  } else {
    const maxX = getCorridorMaxX(projZ, radius);
    projX = clamp(projX, -maxX, maxX);
  }

  // Repel from stone pillars & world obstacles (braziers, shrines, columns)
  const pillars = CASTLE_LAYOUT.SOULS_CASTLE_PILLARS;
  if (Array.isArray(pillars)) {
    for (let i = 0; i < pillars.length; i++) {
      const col = pillars[i];
      if (!col || col.collider === false) continue;
      const minR = (Number(col.radius) || 0.85) + radius + 0.14;
      const dx = projX - col.x;
      const dz = projZ - col.z;
      const d = Math.hypot(dx, dz);
      if (d < minR) {
        if (d > 1e-4) {
          projX = col.x + (dx / d) * minR;
          projZ = clamp(col.z + (dz / d) * minR, zDom.minZ + 0.08, zDom.maxZ - 0.08);
        } else {
          return 0;
        }
      }
    }
  }
  const extraObs = ctx?.obstacles;
  if (Array.isArray(extraObs)) {
    for (let i = 0; i < extraObs.length; i++) {
      const o = extraObs[i];
      if (!o || o.isBonfire) continue;
      if (o.radius != null && o.radius >= 0.4) {
        const minR = o.radius + radius + 0.12;
        const dx = projX - o.x;
        const dz = projZ - o.z;
        const d = Math.hypot(dx, dz);
        if (d < minR && d > 1e-4) {
          projX = o.x + (dx / d) * minR;
          projZ = clamp(o.z + (dz / d) * minR, zDom.minZ + 0.08, zDom.maxZ - 0.08);
        }
      }
    }
  }

  // Bonfire repulsion: enforce the 8.5m safe circle ONLY while player is resting at Bonfire;
  // during active combat/pursuit, treat Bonfire strictly as its ~1.35m physical hearth obstacle!
  const bdx = projX - bfZone.x;
  const bdz = projZ - bfZone.z;
  const bDist = Math.hypot(bdx, bdz);
  if (isPlayerRestingAtBonfire(ctx)) {
    const minBf = Math.max(1.5, bfZone.radius - 0.30);
    if (bDist < minBf && Math.hypot(x - bfZone.x, z - bfZone.z) >= minBf - 0.15) {
      return 0.05;
    }
  } else {
    const physBf = Math.max(SOULS_BONFIRE_PHYSICAL_RADIUS, (bfZone.colliderRadius || 1.05) + radius + 0.08);
    if (bDist < physBf) {
      if (bDist > 1e-4) {
        projX = bfZone.x + (bdx / bDist) * physBf;
        projZ = clamp(bfZone.z + (bdz / bDist) * physBf, zDom.minZ + 0.08, zDom.maxZ - 0.08);
      } else {
        return 0;
      }
    }
  }

  const adv = (projX - x) * ux + (projZ - z) * uz;
  return clamp(adv / Math.max(0.05, probeDist), 0, 1);
}

/**
 * Multi-angle obstacle, pillar & corner-unstick steering solver for Souls mobs.
 * Honors latched `e._pillarBypassSign` & `e._pillarBypassSideX/Z` so mobs walk cleanly
 * around pillars (`pillar_sanctuary_w/e`, `pillar_nave_se/nw`) without left-right oscillation!
 */
function steerMobAroundCornersAndObstacles(e, vx, vz, goalX, goalZ, zDom, dt, ctx) {
  e._pillarBypassHoldTimer = Math.max(0, (e._pillarBypassHoldTimer || 0) - dt);
  const spd = Math.hypot(vx, vz);
  if (spd < 0.12) {
    e._prevCmdSpd = 0;
    return { vx, vz, steered: false };
  }
  const x = Number.isFinite(e.x) ? e.x : 0;
  const z = Number.isFinite(e.z) ? e.z : 0;
  const radius = Number(e.radius) > 0 ? Number(e.radius) : 0.55;

  // Detect real frame-to-frame corner stall (commanded movement > 0.5 m/s yet displaced < 32%!)
  if (Number.isFinite(e._prevSteerX) && Number.isFinite(e._prevSteerZ) && (e._prevCmdSpd || 0) > 0.55 && dt >= 0.004) {
    const moved = Math.hypot(x - e._prevSteerX, z - e._prevSteerZ);
    const expected = e._prevCmdSpd * dt;
    if (expected > 0.004 && moved < expected * 0.32) {
      e._cornerStuckSec = Math.min(1.5, (e._cornerStuckSec || 0) + dt);
    } else {
      e._cornerStuckSec = Math.max(0, (e._cornerStuckSec || 0) - dt * 2.2);
    }
  }
  e._prevSteerX = x;
  e._prevSteerZ = z;
  e._prevCmdSpd = spd;

  e._cornerUnstickTimer = Math.max(0, (e._cornerUnstickTimer || 0) - dt);

  const baseAng = Math.atan2(vx, vz);
  const gDx = goalX - x;
  const gDz = goalZ - z;
  const gLen = Math.hypot(gDx, gDz) || 1;
  const goalDirX = gDx / gLen;
  const goalDirZ = gDz / gLen;
  const bfZone = getBonfireSafeZone(ctx);
  const probeDist = clamp(spd * 0.36, 0.58, 1.15);

  const fwdProg = evalMobProbeProgress(e, x, z, vx / spd, vz / spd, probeDist, radius, zDom, bfZone, ctx);
  const isStuckInCorner = (e._cornerStuckSec || 0) >= 0.11;

  if (fwdProg >= 0.85 && !isStuckInCorner && (e._cornerUnstickTimer || 0) <= 0) {
    return { vx, vz, steered: false };
  }

  let bestAng = baseAng;
  let bestScore = -999;
  let bestSign = e._pillarBypassSign || e._cornerUnstickSign || 1;
  const hasLatchedPillarSide =
    Boolean(e._pillarBypassId) &&
    Number.isFinite(e._pillarBypassSideX) &&
    Number.isFinite(e._pillarBypassSideZ);

  for (let i = 0; i < _STEER_CANDIDATE_ANGLES.length; i++) {
    const off = _STEER_CANDIDATE_ANGLES[i];
    if (isStuckInCorner && Math.abs(off) < 0.35) continue;
    const candAng = baseAng + off;
    const ux = Math.sin(candAng);
    const uz = Math.cos(candAng);
    const prog = evalMobProbeProgress(e, x, z, ux, uz, probeDist, radius, zDom, bfZone, ctx);
    if (prog < 0.25) continue;

    const alignCmd = Math.cos(off);
    const alignGoal = ux * goalDirX + uz * goalDirZ;
    let signMatch = 0;
    if (hasLatchedPillarSide) {
      const sideDot = ux * e._pillarBypassSideX + uz * e._pillarBypassSideZ;
      signMatch += sideDot * 0.55;
    } else if ((e._cornerUnstickTimer || 0) > 0 && off !== 0 && Math.sign(off) === (e._cornerUnstickSign || 1)) {
      signMatch += 0.42;
    }
    const score = prog * 1.35 + alignCmd * 0.36 + alignGoal * 0.32 + signMatch;
    if (score > bestScore) {
      bestScore = score;
      bestAng = candAng;
      if (off !== 0) bestSign = Math.sign(off);
    }
  }

  if (bestScore <= -900) {
    return { vx, vz, steered: false };
  }
  if (Math.abs(normalizeAngle(bestAng - baseAng)) > 0.20) {
    e._cornerUnstickSign = bestSign;
    e._cornerUnstickTimer = isStuckInCorner ? 0.85 : 0.60;
    if (isStuckInCorner) e._cornerStuckSec = 0.04;
    return {
      vx: Math.sin(bestAng) * spd,
      vz: Math.cos(bestAng) * spd,
      steered: true
    };
  }
  return { vx, vz, steered: false };
}

// ============================================================================
// 7. Main Simulation Step: stepSoulsMobAi(e, ctx)
// ============================================================================

export function stepSoulsMobAi(e, ctx = {}) {
  if (!e || typeof e !== 'object') {
    return createEmptyOut(0);
  }

  if (!e._soulsMobAiInit) {
    initSoulsMobState(e, { rng: ctx.rng });
  }

  // Latch initial guard spawn pose on first tick (after spawn caller sets e.x, e.z, e.facing)
  if (Number.isFinite(e.x)) e.homeX ??= e.x;
  if (Number.isFinite(e.z)) e.homeZ ??= e.z;
  e.homeFacing ??= Number.isFinite(e.facing) ? e.facing : 0;
  if (e.isAmbushGuard && !Number.isFinite(e.ambushFacing)) {
    e.ambushFacing = e.homeFacing;
  }

  const profile = getSoulsMobProfile(e);
  const liveBounds = getLiveCorridorBounds();
  const flameBand = getFlameTrapForbiddenBand(ctx);
  const zDom = resolveMobAllowedZDomain(e, liveBounds, flameBand);

  const dt = clamp(Number(ctx.dt) || 0.016, 0, 0.1);
  const rng = typeof ctx.rng === 'function' ? ctx.rng : Math.random;
  const audio = ctx.audio || null;
  const playAudio = ctx.playAudio !== false;
  const autoWake = ctx.autoWake !== false;
  const applyPosition = Boolean(ctx.applyPosition);

  const simTimeOverride = Number.isFinite(ctx.elapsedTime) ? ctx.elapsedTime : null;
  if (simTimeOverride !== null) {
    _packSimClock = Math.max(_packSimClock, simTimeOverride);
  } else {
    const activeDiv = Math.max(1, _activeMobRegistry.size);
    _packSimClock += dt / activeDiv;
  }

  const liveEnemies = Array.isArray(ctx.enemies) ? ctx.enemies : (Array.isArray(ctx.allies) ? ctx.allies : null);
  prunePackCoordinator(_packSimClock, liveEnemies);

  const px = Number.isFinite(ctx.playerX) ? ctx.playerX : (Number.isFinite(ctx.player?.x) ? ctx.player.x : 0);
  const pz = Number.isFinite(ctx.playerZ) ? ctx.playerZ : (Number.isFinite(ctx.player?.z) ? ctx.player.z : 0);
  const pvx = Number.isFinite(ctx.player?.vx)
    ? ctx.player.vx
    : (Number.isFinite(ctx.player?.moveVelX) ? ctx.player.moveVelX : 0);
  const pvz = Number.isFinite(ctx.player?.vz)
    ? ctx.player.vz
    : (Number.isFinite(ctx.player?.moveVelZ) ? ctx.player.moveVelZ : 0);
  const playerRadius = Number(ctx.player?.radius) > 0 ? Number(ctx.player.radius) : 0.58;
  const dx = px - (e.x || 0);
  const dz = pz - (e.z || 0);
  const dist = Math.hypot(dx, dz) || 0.0001;
  const dirX = dx / dist;
  const dirZ = dz / dist;
  const tanX = -dirZ;
  const tanZ = dirX;
  const angToPlayer = Math.atan2(dx, dz);
  const angleFromPlayer = Math.atan2(-dx, -dz);
  const prevFacing = Number.isFinite(e.facing) ? e.facing : angToPlayer;

  const frostSlow = (e.frostTimer || 0) > 0 ? (e.frostFactor || 0.72) : 1.0;
  const baseSpeed = Math.max(0.6, Number(ctx.moveSpeed ?? e.speed ?? profile.refWalkSpeed) * frostSlow);
  const strafeSpeed = Math.max(0.5, Number(e.strafeSpeed ?? profile.strafeSpeed) * frostSlow);
  const fogGateSealed = Boolean(ctx.fogGateSealed || ctx.bossAwakened || ctx.souls?.bossAwakened);
  const playerHealing = Boolean(ctx.playerHealing || (ctx.souls?.flaskDrinkTimer || 0) > 0);
  const playerBlocking = Boolean(ctx.playerBlocking || ctx.souls?.isBlocking);
  const playerRollingNow = Boolean(
    ctx.playerRolling ||
    ctx.playerJustRolled ||
    (ctx.player?.dashInvulnTimer || 0) > 0 ||
    (ctx.player?.dashTimer || 0) > 0
  );

  // Wall & Pillar Line-of-Sight check (prevents aggro/shots through solid stone!)
  const hasWallLOS = hasMobWallLineOfSight(e.x || 0, e.z || 0, px, pz, ctx);

  e._soulsHealPunishCd = Math.max(0, (e._soulsHealPunishCd || 0) - dt);
  e._soulsRollWindowTimer = Math.max(0, (e._soulsRollWindowTimer || 0) - dt);
  if (e._soulsRollWindowTimer <= 0) {
    e._soulsRollCount = 0;
  }
  if (playerRollingNow) {
    if (!e._soulsWasPlayerRolling) {
      e._soulsRollCount = (e._soulsRollCount || 0) + 1;
      e._soulsRollWindowTimer = 2.4;
    }
    e._soulsPlayerRollMemory = 0.65;
  } else {
    e._soulsPlayerRollMemory = Math.max(0, (e._soulsPlayerRollMemory || 0) - dt);
  }
  e._soulsWasPlayerRolling = playerRollingNow;

  const externalBlockHold = Number(ctx.playerBlockHoldSec ?? ctx.souls?.blockHoldSec) || 0;
  if (playerBlocking && dist <= 3.8) {
    e._soulsBlockHoldTime = Math.min(4.0, Math.max((e._soulsBlockHoldTime || 0) + dt, externalBlockHold));
    e._soulsPlayerBlockMemory = 0.45;
  } else {
    e._soulsBlockHoldTime = Math.max(0, (e._soulsBlockHoldTime || 0) - dt * 1.5);
    e._soulsPlayerBlockMemory = Math.max(0, (e._soulsPlayerBlockMemory || 0) - dt);
  }

  const effectiveBlockHold = Math.max(
    e._soulsBlockHoldTime || 0,
    playerBlocking && dist <= 3.8 ? externalBlockHold : 0
  );
  const relFacingToPlayer = Math.abs(normalizeAngle(angToPlayer - prevFacing));
  const pLatSpeed = Math.abs(-pvx * dirZ + pvz * dirX);
  const playerRetreatSpeed = pvx * dirX + pvz * dirZ;
  const reads = {
    playerHealing,
    playerBlocking: playerBlocking || e._soulsPlayerBlockMemory > 0.12,
    playerTurtleBlocking: effectiveBlockHold >= 1.1,
    playerPanicRolling: playerRollingNow || e._soulsPlayerRollMemory > 0,
    playerRollSpam: (e._soulsRollCount || 0) >= 2,
    playerBehind: relFacingToPlayer > 1.85,
    playerFlanking: relFacingToPlayer > 0.60 || (pLatSpeed > 1.35 && dist <= 3.6),
    playerRetreatSpeed
  };

  const out = createEmptyOut(prevFacing);
  out.aiState = e.aiState || 'idle';
  out.soulsState = e.soulsState || 'idle';

  if (e.hp !== undefined && e.hp <= 0) {
    releaseSoulsAttackToken(e);
    _activeMobRegistry.delete(getMobTokenId(e));
    e.vx = 0;
    e.vz = 0;
    e._velX = 0;
    e._velZ = 0;
    e.animSpeedMult = 0;
    e.strafeAnimMode = 'idle';
    e.attackAnimClip = 'Death_Collapse';
    out.attackAnimClip = 'Death_Collapse';
    return out;
  }

  // -------------------------------------------------------------------------
  // 1. SEALED BOSS DOORS / FOG GATE GUARD
  // -------------------------------------------------------------------------
  if (fogGateSealed) {
    releaseSoulsAttackToken(e);
    e.aiState = 'idle';
    e.soulsState = 'idle';
    e.soulsTimer = 0.5;
    e.currentAttackMeta = null;
    e.soulsComboLeft = 0;
    e._soulsPendingBackstep = null;
    e._soulsTrackingLocked = false;
    e._soulsStepEndRawSpeed = 0;
    e._velX = 0;
    e._velZ = 0;
    clearPunishWindow(e);

    if ((e.z || 0) < zDom.minZ) e.z = zDom.minZ;
    if ((e.z || 0) > zDom.maxZ) e.z = zDom.maxZ;
    if (typeof CASTLE_LAYOUT.clampCastlePosition === 'function' && Number.isFinite(e.x)) {
      const p = CASTLE_LAYOUT.clampCastlePosition(e.x, e.z || zDom.minZ, e.radius || 0.55, {
        bossDoorState: 'closed',
        allowBossHall: false,
        out: _tmpClampOut
      });
      e.x = p.x;
      e.z = clamp(p.z, zDom.minZ, zDom.maxZ);
    }

    out.desiredFacing = lerpAngle(prevFacing, Math.PI, dt * 3);
    out.turnDelta = normalizeAngle(out.desiredFacing - prevFacing);
    out.aiState = 'idle';
    out.soulsState = 'idle';
    out.strafeAnimMode = 'idle';
    out.combatPhase = 'neutral';
    out.combatPhase01 = 0;
    out.fogGateClamped = true;
    e.facing = out.desiredFacing;
    e.vx = 0;
    e.vz = 0;
    e.animSpeedMult = 0;
    e.strafeAnimMode = 'idle';
    e.attackAnimClip = null;
    e.combatPhase = 'neutral';
    e.combatPhase01 = 0;
    return out;
  }

  // -------------------------------------------------------------------------
  // 2. UNAWAKENED SENTRY (Requires Wall Line-of-Sight + Outside Bonfire Sanctuary!)
  // -------------------------------------------------------------------------
  if (!e.soulsAwake) {
    releaseSoulsAttackToken(e);
    const bfZone = getBonfireSafeZone(ctx);
    const restingAtBonfire = isPlayerRestingAtBonfire(ctx);
    const unawakeSafeRadius = restingAtBonfire ? bfZone.radius : 4.2;
    const playerInBonfireSanctuary =
      !ctx.ignoreBonfireSafeZone &&
      Math.hypot(px - bfZone.x, pz - bfZone.z) <= unawakeSafeRadius;

    // 2A. EAST ALCOVE AMBUSH GUARD: wakes ONLY when trigger crossed AND Wall LOS is clear!
    if (e.isAmbushGuard) {
      const ambushCanSee = ctx.ambushTriggered === true || hasWallLOS;
      if (autoWake && !playerInBonfireSanctuary && ambushCanSee && checkAmbushTrigger(e, px, pz, dist, ctx)) {
        e.soulsAwake = true;
        e._ambushSprung = true;
        e._patrolPhase = 'idle';
        e.aiState = 'approach';
        e.soulsState = 'stalk';
        e.soulsTimer = 0.28;
        out.awokeThisStep = true;
        out.ambushTriggered = true;
      } else {
        const ambushFacing = Number.isFinite(e.ambushFacing) ? e.ambushFacing : -Math.PI * 0.5;
        out.desiredFacing = lerpAngle(prevFacing, ambushFacing, dt * 3.0);
        out.turnDelta = normalizeAngle(out.desiredFacing - prevFacing);
        out.vx = 0;
        out.vz = 0;
        out.isMoving = false;
        out.animSpeedMult = 0;
        out.patrolMoveSpeedRatio = 0;
        out.strafeAnimMode = 'idle';
        out.aiState = 'ambush';
        out.soulsState = 'idle';
        out.combatPhase = 'neutral';
        out.combatPhase01 = 0;

        e.aiState = 'ambush';
        e.soulsState = 'idle';
        e.facing = out.desiredFacing;
        e.vx = 0;
        e.vz = 0;
        e._velX = 0;
        e._velZ = 0;
        e.animSpeedMult = 0;
        e.strafeAnimMode = 'idle';
        e.attackAnimClip = null;
        e.combatPhase = 'neutral';
        e.combatPhase01 = 0;
        return out;
      }
    } else {
      // 2B. STANDARD SENTRY: strictly requires `hasWallLOS` (plus optional side-wing `aggroBounds`) so mobs NEVER aggro through stone walls or from unentered side rooms!
      const aggroRange = Number(e.soulsAggroRange) > 0 ? Number(e.soulsAggroRange) : profile.aggroRange;
      const ab = e.aggroBounds;
      const inAggroBounds = !ab || (
        (!Number.isFinite(ab.minX) || px >= ab.minX) &&
        (!Number.isFinite(ab.maxX) || px <= ab.maxX) &&
        (!Number.isFinite(ab.minZ) || pz >= ab.minZ) &&
        (!Number.isFinite(ab.maxZ) || pz <= ab.maxZ)
      );
      if (autoWake && !playerInBonfireSanctuary && hasWallLOS && inAggroBounds && dist <= aggroRange) {
        e.soulsAwake = true;
        e._patrolPhase = 'idle';
        e._lastSeenPlayerX = px;
        e._lastSeenPlayerZ = pz;
        e._lastSeenPlayerAng = angToPlayer;
        if (profile.isRanged || e.type === 'bone_archer' || e.soulsRole === 'archer') {
          e._archerSteppingUp = false;
          e.aiState = dist < (e.retreatDist || profile.retreatDist)
            ? 'retreat'
            : (dist > (profile.stepUpTriggerDist || 16.5) ? 'approach' : 'circle');
        } else {
          e.aiState = dist > (e.preferredDist || profile.preferredDist) + 0.5 ? 'approach' : 'circle';
        }
        e.soulsState = 'stalk';
        e.soulsTimer = randRange(0.85, 1.3, rng);
        out.awokeThisStep = true;
      } else {
        if (!Number.isFinite(e.patrolHomeX)) e.patrolHomeX = Number.isFinite(e.x) ? e.x : 0;
        if (!Number.isFinite(e.patrolHomeZ)) {
          e.patrolHomeZ = clamp(Number.isFinite(e.z) ? e.z : 0, zDom.minZ + 0.45, zDom.maxZ - 0.45);
        }
        if (e._patrolPhase !== 'idle' && e._patrolPhase !== 'walk') {
          e._patrolPhase = 'idle';
          e._patrolTimer = randRange(profile.patrolIdleMinSec || 2.4, profile.patrolIdleMaxSec || 4.2, rng);
        }

        e._patrolTimer = Math.max(0, (e._patrolTimer || 0) - dt);

        if (e._patrolPhase === 'walk') {
          if (!Number.isFinite(e._patrolTargetX) || !Number.isFinite(e._patrolTargetZ)) {
            pickPatrolWaypoint(e, profile, rng);
          }
          const tdx = e._patrolTargetX - (e.x || 0);
          const tdz = e._patrolTargetZ - (e.z || 0);
          const tdist = Math.hypot(tdx, tdz);

          if (tdist <= 0.18 || e._patrolTimer <= 0) {
            e._patrolPhase = 'idle';
            e._patrolTimer = randRange(profile.patrolIdleMinSec || 2.4, profile.patrolIdleMaxSec || 4.2, rng);
            e._patrolLookTimer = randRange(1.5, 2.9, rng);
            e._patrolLookTargetOffset = randRange(-0.35, 0.35, rng);
          } else {
            const arriveScale = clamp(tdist / 0.55, 0.42, 1.0);
            const targetSpd = (profile.patrolSpeed || 1.2) * frostSlow * arriveScale;
            const targetVx = (tdx / tdist) * targetSpd;
            const targetVz = (tdz / tdist) * targetSpd;
            const damp = 1 - Math.exp(-7.5 * dt);
            e._velX = (e._velX || 0) + (targetVx - (e._velX || 0)) * damp;
            e._velZ = (e._velZ || 0) + (targetVz - (e._velZ || 0)) * damp;

            const clampedPatrol = clampSoulsCorridorVelocity(e, e._velX, e._velZ, dt, ctx);
            const actualSpd = Math.hypot(clampedPatrol.vx, clampedPatrol.vz);

            if (actualSpd < 0.12) {
              e._patrolPhase = 'idle';
              e._patrolTimer = randRange(profile.patrolIdleMinSec || 2.4, profile.patrolIdleMaxSec || 4.2, rng);
              e._velX = 0;
              e._velZ = 0;
            } else {
              const walkAng = Math.atan2(clampedPatrol.vx, clampedPatrol.vz);
              const basePatrolRatio = Number(profile.patrolAnimSpeedMult) || 0.48;
              const groundSyncedRatio = clamp(
                basePatrolRatio * (actualSpd / Math.max(0.4, profile.patrolSpeed || 1.2)),
                0.24,
                0.54
              );
              const loc = projectLocalVelocity(clampedPatrol.vx, clampedPatrol.vz, walkAng);

              out.vx = clampedPatrol.vx;
              out.vz = clampedPatrol.vz;
              out.moveLocalX = loc.localX;
              out.moveLocalZ = loc.localZ;
              out.desiredFacing = lerpAngle(prevFacing, walkAng, dt * 4.0);
              out.turnDelta = normalizeAngle(out.desiredFacing - prevFacing);
              out.lookYawOffset = 0;
              out.isMoving = true;
              out.animSpeedMult = groundSyncedRatio;
              out.patrolMoveSpeedRatio = groundSyncedRatio;
              out.strafeAnimMode = 'patrol';
              out.aiState = 'patrol';
              out.soulsState = 'idle';
              out.combatPhase = 'neutral';
              out.combatPhase01 = 0;
              out.fogGateClamped = clampedPatrol.fogGateClamped;
              out.flameTrapClamped = clampedPatrol.flameTrapClamped;

              e.aiState = 'patrol';
              e.soulsState = 'idle';
              e.facing = out.desiredFacing;
              e.aiVx = out.vx;
              e.aiVz = out.vz;
              e.vx = 0;
              e.vz = 0;
              e.animSpeedMult = groundSyncedRatio;
              e.strafeAnimMode = 'patrol';
              e.attackAnimClip = null;
              e.combatPhase = 'neutral';
              e.combatPhase01 = 0;

              if (applyPosition && dt > 0) {
                e.x = (e.x || 0) + out.vx * dt;
                e.z = clamp((e.z || 0) + out.vz * dt, clampedPatrol.minZ, clampedPatrol.maxZ);
              }
              return out;
            }
          }
        }

        e._velX *= Math.exp(-12 * dt);
        e._velZ *= Math.exp(-12 * dt);
        if (Math.hypot(e._velX, e._velZ) < 0.04) {
          e._velX = 0;
          e._velZ = 0;
        }

        e._patrolLookTimer = Math.max(0, (e._patrolLookTimer || 0) - dt);
        if (e._patrolLookTimer <= 0) {
          e._patrolLookTargetOffset = randRange(-0.36, 0.36, rng);
          e._patrolLookTimer = randRange(2.0, 3.8, rng);
        }
        e._patrolLookOffset = (e._patrolLookOffset || 0) +
          ((e._patrolLookTargetOffset || 0) - (e._patrolLookOffset || 0)) * clamp(dt * 2.2, 0, 1);

        if (e._patrolPhase === 'idle' && e._patrolTimer <= 0) {
          pickPatrolWaypoint(e, profile, rng);
          e._patrolPhase = 'walk';
          e._patrolTimer = randRange(profile.patrolWalkMinSec || 1.8, profile.patrolWalkMaxSec || 3.0, rng);
        }

        out.desiredFacing = prevFacing;
        out.turnDelta = 0;
        out.lookYawOffset = e._patrolLookOffset;
        out.vx = 0;
        out.vz = 0;
        out.isMoving = false;
        out.animSpeedMult = 0;
        out.patrolMoveSpeedRatio = 0;
        out.strafeAnimMode = 'idle';
        out.aiState = 'idle';
        out.soulsState = 'idle';
        out.combatPhase = 'neutral';
        out.combatPhase01 = 0;

        e.aiState = 'idle';
        e.soulsState = 'idle';
        e.facing = out.desiredFacing;
        e.vx = 0;
        e.vz = 0;
        e.animSpeedMult = 0;
        e.strafeAnimMode = 'idle';
        e.attackAnimClip = null;
        e.combatPhase = 'neutral';
        e.combatPhase01 = 0;
        return out;
      }
    }
  }

  _activeMobRegistry.set(getMobTokenId(e), {
    id: getMobTokenId(e),
    x: e.x || 0,
    z: e.z || 0,
    isRanged: profile.isRanged,
    lastSeenAt: _packSimClock
  });

  const isArcherUnit = Boolean(profile.isRanged || e.type === 'bone_archer' || e.soulsRole === 'archer');
  const hasDirectLOSNow = ctx.hasLineOfSight !== false && hasWallLOS;
  if (hasDirectLOSNow) {
    e._lastSeenPlayerX = px;
    e._lastSeenPlayerZ = pz;
    e._lastSeenPlayerAng = angToPlayer;
  } else if (!Number.isFinite(e._lastSeenPlayerAng)) {
    e._lastSeenPlayerAng = prevFacing;
  }

  // -------------------------------------------------------------------------
  // 3A. POST-RIPOSTE EXPRESSIVE STAND-UP (`riposte_recover`, 2.30s) & SMOOTH KNEEL EXIT (`stagger_recover`, 0.85s)
  // -------------------------------------------------------------------------
  if (e.soulsState === 'riposte_recover' || e.aiState === 'riposte_recover') {
    releaseSoulsAttackToken(e);
    e.soulsState = 'riposte_recover';
    e.aiState = 'riposte_recover';
    e._mobActiveSwing = null;
    e.currentAttackMeta = null;
    e._soulsTrackingLocked = false;
    e._soulsStepEndRawSpeed = 0;
    e._velX = 0;
    e._velZ = 0;
    clearPunishWindow(e);

    if (!e._inRiposteRecoverActive) {
      e._inRiposteRecoverActive = true;
      if (!(e.soulsRecoverTimer > 0)) {
        e.soulsRecoverTimer = SOULS_MOB_RIPOSTE_STANDUP_SEC;
      }
      e._soulsRecoverDuration = e.soulsRecoverTimer;
      e._soulsRecoverElapsed = 0;
    }
    if (!e._soulsStandUpClipStarted && typeof e.model?.handle?.playClampedClip === 'function') {
      const standRes = e.model.handle.playClampedClip('Riposte_Stand_Up', 1.0, 0.12);
      e._soulsStandUpClipStarted = true;
      if (standRes?.ok && standRes.duration > 0.8 && e._soulsRecoverElapsed <= 0.02) {
        e.soulsRecoverTimer = standRes.duration;
        e._soulsRecoverDuration = standRes.duration;
      }
    }

    const standTotalDur = Math.max(0.5, Number(e._soulsRecoverDuration) || SOULS_MOB_RIPOSTE_STANDUP_SEC);
    e.soulsRecoverTimer = Math.max(0, (Number(e.soulsRecoverTimer) || 0) - dt);
    e._soulsRecoverElapsed = clamp(standTotalDur - e.soulsRecoverTimer, 0, standTotalDur);
    const standProg01 = clamp(e._soulsRecoverElapsed / standTotalDur, 0, 1);

    if (e.soulsRecoverTimer > 0) {
      const targetStandAng = hasDirectLOSNow ? angToPlayer : (e._lastSeenPlayerAng ?? prevFacing);
      out.desiredFacing = standProg01 >= 0.78 ? lerpAngle(prevFacing, targetStandAng, dt * 2.4) : prevFacing;
      out.turnDelta = normalizeAngle(out.desiredFacing - prevFacing);
      out.vx = 0;
      out.vz = 0;
      out.isMoving = false;
      out.animSpeedMult = 0;
      out.strafeAnimMode = 'idle';
      out.aiState = 'riposte_recover';
      out.soulsState = 'riposte_recover';
      out.attackAnimClip = 'Riposte_Stand_Up';
      out.combatPhase = 'recover';
      out.combatPhase01 = standProg01;
      out.inPunishWindow = false;
      out.punishWindowTimer = 0;
      out.punishTier = null;

      e.facing = out.desiredFacing;
      e.aiVx = 0;
      e.aiVz = 0;
      e.vx = 0;
      e.vz = 0;
      e.animSpeedMult = 0;
      e.strafeAnimMode = 'idle';
      e.attackAnimClip = 'Riposte_Stand_Up';
      e.combatPhase = 'recover';
      e.combatPhase01 = standProg01;
      return out;
    }

    // Completed full ~2.30s Riposte_Stand_Up -> hand off cleanly to Idle/stalk!
    e.model?.handle?.clearClampedClip?.(true, 0.18);
    e._soulsStandUpClipStarted = false;
    e._inRiposteRecoverActive = false;
    e.attackAnimClip = null;
    e.soulsState = 'stalk';
    if (isArcherUnit) {
      e.aiState = !hasDirectLOSNow
        ? 'hold_vantage'
        : (dist < (e.retreatDist || profile.retreatDist) ? 'retreat' : 'circle');
    } else {
      e.aiState = hasDirectLOSNow && dist <= (e.preferredDist || profile.preferredDist) + 0.35 ? 'circle' : 'approach';
    }
    e.soulsTimer = randRange(0.38, 0.68, rng);
  }

  // Detect un-riposted Stagger_Kneel expiry and enter smooth ~0.85s `stagger_recover` (zero 1-frame snap!)
  const kneelTimersActive =
    (e.staggeredTimer || 0) > 0 ||
    (e.stunTimer || 0) > 0 ||
    (e.parriedRiposteTimer || 0) > 0;
  if (
    e.soulsState !== 'riposte_victim' &&
    e.soulsState !== 'riposte_recover' &&
    ((e.soulsState === 'stagger_kneel' && !kneelTimersActive) ||
      (e._wasStaggerKneeling && !kneelTimersActive && e.soulsState !== 'stagger_recover'))
  ) {
    startSoulsMobStaggerRecover(e, SOULS_MOB_STAGGER_RECOVER_SEC);
  }

  if (e.soulsState === 'stagger_recover' || e.aiState === 'stagger_recover') {
    releaseSoulsAttackToken(e);
    e.soulsState = 'stagger_recover';
    e.aiState = 'stagger_recover';
    e._mobActiveSwing = null;
    e.currentAttackMeta = null;
    e._soulsTrackingLocked = false;
    e._soulsStepEndRawSpeed = 0;
    e._velX = 0;
    e._velZ = 0;
    clearPunishWindow(e);

    if (!e._inStaggerRecoverActive) {
      e._inStaggerRecoverActive = true;
      if (!(e.soulsRecoverTimer > 0)) {
        e.soulsRecoverTimer = SOULS_MOB_STAGGER_RECOVER_SEC;
      }
      e._soulsRecoverDuration = e.soulsRecoverTimer;
      e._soulsRecoverElapsed = 0;
    }
    if (!e._soulsStaggerRecoverCleared) {
      e.model?.handle?.clearClampedClip?.(true, 0.78);
      e._soulsStaggerRecoverCleared = true;
    }

    const stagRecDur = Math.max(0.35, Number(e._soulsRecoverDuration) || SOULS_MOB_STAGGER_RECOVER_SEC);
    e.soulsRecoverTimer = Math.max(0, (Number(e.soulsRecoverTimer) || 0) - dt);
    e._soulsRecoverElapsed = clamp(stagRecDur - e.soulsRecoverTimer, 0, stagRecDur);
    const stagProg01 = clamp(e._soulsRecoverElapsed / stagRecDur, 0, 1);

    if (e.soulsRecoverTimer > 0) {
      const targetRecAng = hasDirectLOSNow ? angToPlayer : (e._lastSeenPlayerAng ?? prevFacing);
      out.desiredFacing = stagProg01 >= 0.45 ? lerpAngle(prevFacing, targetRecAng, dt * 2.6) : prevFacing;
      out.turnDelta = normalizeAngle(out.desiredFacing - prevFacing);
      out.vx = 0;
      out.vz = 0;
      out.isMoving = false;
      out.animSpeedMult = 0;
      out.strafeAnimMode = 'idle';
      out.aiState = 'stagger_recover';
      out.soulsState = 'stagger_recover';
      out.attackAnimClip = null;
      out.combatPhase = 'recover';
      out.combatPhase01 = stagProg01;
      out.inPunishWindow = false;
      out.punishWindowTimer = 0;
      out.punishTier = null;

      e.facing = out.desiredFacing;
      e.aiVx = 0;
      e.aiVz = 0;
      e.vx = 0;
      e.vz = 0;
      e.animSpeedMult = 0;
      e.strafeAnimMode = 'idle';
      e.attackAnimClip = null;
      e.combatPhase = 'recover';
      e.combatPhase01 = stagProg01;
      return out;
    }

    e._soulsStaggerRecoverCleared = false;
    e._inStaggerRecoverActive = false;
    e.soulsState = 'stalk';
    if (isArcherUnit) {
      e.aiState = !hasDirectLOSNow
        ? 'hold_vantage'
        : (dist < (e.retreatDist || profile.retreatDist) ? 'retreat' : 'circle');
    } else {
      e.aiState = hasDirectLOSNow && dist <= (e.preferredDist || profile.preferredDist) + 0.35 ? 'circle' : 'approach';
    }
    e.soulsTimer = randRange(0.38, 0.68, rng);
  }

  // -------------------------------------------------------------------------
  // 3. STUNNED / STAGGER KNEEL / RIPOSTE VICTIM / PARRY / POISE MICROSTUN
  // -------------------------------------------------------------------------
  const isRiposteVictim = e.soulsState === 'riposte_victim';
  const isKneelActive = e.soulsState === 'stagger_kneel' && kneelTimersActive;
  if (isKneelActive) {
    e._wasStaggerKneeling = true;
  }
  const isStunned = isKneelActive || isRiposteVictim || (e.stunTimer || 0) > 0 || (e.staggeredTimer || 0) > 0;
  if (isStunned) {
    releaseSoulsAttackToken(e);
    e.aiState = 'stunned';
    e.currentAttackMeta = null;
    e._soulsTrackingLocked = false;
    e._soulsStepEndRawSpeed = 0;
    e._velX = 0;
    e._velZ = 0;
    // Freeze facing 100% while stunned / kneeling on Stagger_Kneel so mob never rotates toward circling player!
    out.desiredFacing = prevFacing;
    out.turnDelta = normalizeAngle(out.desiredFacing - prevFacing);
    const openT = Math.max(e.stunTimer || 0, e.staggeredTimer || 0, e.parriedRiposteTimer || 0, e.punishWindowTimer || 0);
    e.punishWindowTimer = openT;
    out.inPunishWindow = !isRiposteVictim && (openT > 0 || isKneelActive);
    out.punishWindowTimer = openT;
    out.punishTier = isRiposteVictim ? null : 'heavy';
    out.aiState = 'stunned';
    out.soulsState = e.soulsState;
    out.strafeAnimMode = 'idle';
    out.attackAnimClip = isRiposteVictim ? 'Riposte_Victim_Fall' : 'Stagger_Kneel';
    out.combatPhase = 'recover';
    out.combatPhase01 = 0.5;
    e.facing = out.desiredFacing;
    e.vx = 0;
    e.vz = 0;
    e.animSpeedMult = 0;
    e.strafeAnimMode = 'idle';
    e.attackAnimClip = out.attackAnimClip;
    e.combatPhase = 'recover';
    e.combatPhase01 = 0.5;
    return out;
  }

  if ((e.poiseMicroStunTimer || 0) > 0) {
    releaseSoulsAttackToken(e);
    e.aiState = 'hit_react';
    e._soulsStepEndRawSpeed = 0;
    e._velX = 0;
    e._velZ = 0;
    out.desiredFacing = lerpAngle(prevFacing, angToPlayer, dt * 2.2);
    out.turnDelta = normalizeAngle(out.desiredFacing - prevFacing);
    out.aiState = 'hit_react';
    out.soulsState = e.soulsState;
    out.strafeAnimMode = 'idle';
    out.attackAnimClip = 'Hit_React';
    out.combatPhase = 'recover';
    out.combatPhase01 = 0.25;
    out.inPunishWindow = (e.punishWindowTimer || 0) > 0;
    out.punishWindowTimer = Math.max(0, e.punishWindowTimer || 0);
    out.punishTier = e.soulsPunishWindow || null;
    e.facing = out.desiredFacing;
    e.vx = 0;
    e.vz = 0;
    e.animSpeedMult = 0;
    e.strafeAnimMode = 'idle';
    e.attackAnimClip = 'Hit_React';
    e.combatPhase = 'recover';
    e.combatPhase01 = 0.25;
    return out;
  }

  // -------------------------------------------------------------------------
  // 3B. ARCHETYPE VISIBILITY / SPRINT-ESCAPE LEASH & RETURN-TO-HOME
  // -------------------------------------------------------------------------
  const leash = getMobLeashConfig(e, profile);
  const hasDirectLOS = ctx.hasLineOfSight !== false && hasWallLOS;
  const restingAtBonfire = isPlayerRestingAtBonfire(ctx);
  const recentlyHit =
    Number.isFinite(ctx.elapsedTime) &&
    Number.isFinite(e.soulsLastHitAt) &&
    ctx.elapsedTime - e.soulsLastHitAt < 1.0;

  if (hasDirectLOS || recentlyHit) {
    e._noLosPursuitTimer = 0;
  } else {
    e._noLosPursuitTimer = (e._noLosPursuitTimer || 0) + dt;
  }

  const exceededVisibilityLeash = isArcherUnit
    ? (
        restingAtBonfire ||
        dist > leash.maxPursuitDist ||
        e._noLosPursuitTimer > leash.noLosDisengageSec ||
        (dist > 18.5 && e._noLosPursuitTimer > 3.0)
      )
    : (
        restingAtBonfire ||
        dist > leash.maxPursuitDist ||
        (dist > leash.noLosDisengageDist && e._noLosPursuitTimer > leash.noLosDisengageSec)
      );

  if (e.aiState !== 'return_home' && e.soulsState !== 'return_home' && exceededVisibilityLeash) {
    releaseSoulsAttackToken(e);
    _activeMobRegistry.delete(getMobTokenId(e));
    e._mobActiveSwing = null;
    e.currentAttackMeta = null;
    e.attackAnimClip = null;
    e.soulsComboLeft = 0;
    e._soulsPendingBackstep = null;
    e._soulsTrackingLocked = false;
    e._soulsStepEndRawSpeed = 0;
    e._archerSteppingUp = false;
    e._pillarBypassId = null;
    e._pillarBypassSign = 0;
    clearPunishWindow(e);
    e.aiState = 'return_home';
    e.soulsState = 'return_home';
  }

  if (e.aiState === 'return_home' || e.soulsState === 'return_home') {
    if (!restingAtBonfire && hasDirectLOS && dist <= leash.reaggroDist) {
      e._noLosPursuitTimer = 0;
      e._pillarBypassId = null;
      e._pillarBypassSign = 0;
      if (isArcherUnit) {
        e._archerSteppingUp = false;
        e.aiState = dist < (e.retreatDist || profile.retreatDist)
          ? 'retreat'
          : (dist > (profile.stepUpTriggerDist || 16.5) ? 'approach' : 'circle');
      } else {
        e.aiState = dist > (e.preferredDist || profile.preferredDist) + 0.5 ? 'approach' : 'circle';
      }
      e.soulsState = 'stalk';
      e.soulsTimer = randRange(0.45, 0.85, rng);
      _activeMobRegistry.set(getMobTokenId(e), {
        id: getMobTokenId(e),
        x: e.x || 0,
        z: e.z || 0,
        isRanged: profile.isRanged,
        lastSeenAt: _packSimClock
      });
    } else {
      releaseSoulsAttackToken(e);
      _activeMobRegistry.delete(getMobTokenId(e));
      e._mobActiveSwing = null;
      e.currentAttackMeta = null;
      e.attackAnimClip = null;

      const homeX = Number.isFinite(e.homeX)
        ? e.homeX
        : (Number.isFinite(e.patrolHomeX) ? e.patrolHomeX : (e.x || 0));
      const homeZ = clamp(
        Number.isFinite(e.homeZ)
          ? e.homeZ
          : (Number.isFinite(e.patrolHomeZ) ? e.patrolHomeZ : (e.z || 0)),
        zDom.minZ + 0.30,
        zDom.maxZ - 0.30
      );
      const homeFacing = Number.isFinite(e.homeFacing) ? e.homeFacing : 0;
      const hdx = homeX - (e.x || 0);
      const hdz = homeZ - (e.z || 0);
      const distToHome = Math.hypot(hdx, hdz);

      if (distToHome <= 0.45) {
        e.soulsAwake = false;
        e.aiState = 'idle';
        e.soulsState = 'idle';
        e.facing = homeFacing;
        e._noLosPursuitTimer = 0;
        e._pillarBypassId = null;
        e._pillarBypassSign = 0;
        e._patrolPhase = 'idle';
        e._patrolTimer = randRange(profile.patrolIdleMinSec || 2.8, profile.patrolIdleMaxSec || 4.4, rng);
        e._patrolLookOffset = 0;
        e._velX = 0;
        e._velZ = 0;
        e.aiVx = 0;
        e.aiVz = 0;
        e.vx = 0;
        e.vz = 0;
        e.animSpeedMult = 0;
        e.strafeAnimMode = 'idle';
        e.attackAnimClip = null;
        e.combatPhase = 'neutral';
        e.combatPhase01 = 0;

        out.desiredFacing = homeFacing;
        out.turnDelta = normalizeAngle(homeFacing - prevFacing);
        out.vx = 0;
        out.vz = 0;
        out.isMoving = false;
        out.animSpeedMult = 0;
        out.patrolMoveSpeedRatio = 0;
        out.strafeAnimMode = 'idle';
        out.aiState = 'idle';
        out.soulsState = 'idle';
        out.combatPhase = 'neutral';
        out.combatPhase01 = 0;
        return out;
      }

      const navCtx = {
        ...ctx,
        hasLineOfSight: undefined,
        forceGeometricLOS: true,
        mob: e,
        zDom
      };
      const homeSteer = resolveDoorwaySteerTarget(e.x || 0, e.z || 0, homeX, homeZ, navCtx);
      out.viaDoorway = Boolean(homeSteer.viaDoorway);
      const goalX = homeSteer.x;
      const goalZ = homeSteer.z;
      const gdx = goalX - (e.x || 0);
      const gdz = goalZ - (e.z || 0);
      const gLen = Math.hypot(gdx, gdz) || 1;
      const arriveScale = clamp(distToHome / 0.85, 0.48, 1.0);
      const calmWalkSpd = (leash.returnWalkSpeed || 1.8) * frostSlow * arriveScale;

      let retVx = (gdx / gLen) * calmWalkSpd;
      let retVz = (gdz / gLen) * calmWalkSpd;
      const steeredHome = steerMobAroundCornersAndObstacles(e, retVx, retVz, goalX, goalZ, zDom, dt, navCtx);
      retVx = steeredHome.vx;
      retVz = steeredHome.vz;

      const damp = 1 - Math.exp(-8.5 * dt);
      e._velX = (e._velX || 0) + (retVx - (e._velX || 0)) * damp;
      e._velZ = (e._velZ || 0) + (retVz - (e._velZ || 0)) * damp;

      const clampedHome = clampSoulsCorridorVelocity(e, e._velX, e._velZ, dt, ctx);
      const homeSpd = Math.hypot(clampedHome.vx, clampedHome.vz);
      const walkYaw = homeSpd > 0.08 ? Math.atan2(clampedHome.vx, clampedHome.vz) : Math.atan2(gdx, gdz);
      out.desiredFacing = lerpAngle(prevFacing, walkYaw, dt * 6.2);
      out.turnDelta = normalizeAngle(out.desiredFacing - prevFacing);
      const locHome = projectLocalVelocity(clampedHome.vx, clampedHome.vz, out.desiredFacing);
      const isHomeMoving = homeSpd > 0.08;
      const basePatrolRatio = Number(profile.patrolAnimSpeedMult) || 0.48;
      const returnAnimRatio = isHomeMoving
        ? clamp(basePatrolRatio * (homeSpd / Math.max(0.5, profile.patrolSpeed || 1.2)), 0.32, 0.72)
        : 0;

      out.vx = clampedHome.vx;
      out.vz = clampedHome.vz;
      out.moveLocalX = locHome.localX;
      out.moveLocalZ = locHome.localZ;
      out.isMoving = isHomeMoving;
      out.animSpeedMult = returnAnimRatio;
      out.patrolMoveSpeedRatio = returnAnimRatio;
      out.strafeAnimMode = isHomeMoving ? 'patrol' : 'idle';
      out.aiState = 'return_home';
      out.soulsState = 'return_home';
      out.combatPhase = 'neutral';
      out.combatPhase01 = 0;
      out.fogGateClamped = clampedHome.fogGateClamped;
      out.flameTrapClamped = clampedHome.flameTrapClamped;

      e.aiState = 'return_home';
      e.soulsState = 'return_home';
      e.facing = out.desiredFacing;
      e.aiVx = out.vx;
      e.aiVz = out.vz;
      e.vx = 0;
      e.vz = 0;
      e.animSpeedMult = returnAnimRatio;
      e.strafeAnimMode = out.strafeAnimMode;
      e.attackAnimClip = null;
      e.combatPhase = 'neutral';
      e.combatPhase01 = 0;

      if (applyPosition && dt > 0) {
        e.x = (e.x || 0) + out.vx * dt;
        e.z = clamp((e.z || 0) + out.vz * dt, clampedHome.minZ, clampedHome.maxZ);
        if (typeof CASTLE_LAYOUT.clampCastlePosition === 'function') {
          const p = CASTLE_LAYOUT.clampCastlePosition(e.x, e.z, e.radius || 0.55, {
            bossDoorState: 'closed',
            allowBossHall: false,
            out: _tmpClampOut
          });
          e.x = p.x;
          e.z = clamp(p.z, clampedHome.minZ, clampedHome.maxZ);
        }
      }
      return out;
    }
  }

  const prevTimer = Number(e.soulsTimer) || 0;
  e.soulsTimer = Math.max(0, prevTimer - dt);

  let rawVx = 0;
  let rawVz = 0;
  let useInertialSmoothing = false;
  let suppressLocomotionBlend = false;

  const minMeleeGap = playerRadius + (Number(e.radius) || 0.55) + 0.14;
  const rawMaxMeleeTokens = Number(ctx.maxConcurrentAttackers ?? SOULS_PACK_CFG.maxMeleeTokens);
  // Crossfire fairness: while a ranged archer actively holds a shot token, cap concurrent melee swings to 1
  // so a second knight circles/flanks instead of double-hitting in the exact same frame as a bolt!
  const maxMeleeTokens =
    !profile.isRanged && _rangedTokenHolders.size > 0
      ? Math.min(rawMaxMeleeTokens, 1)
      : rawMaxMeleeTokens;
  const maxRangedTokens = Number(ctx.maxConcurrentRanged ?? SOULS_PACK_CFG.maxRangedTokens);

  // -------------------------------------------------------------------------
  // 4. STATE: WINDUP (Elden Ring Late-Lock 85–88% Tracking + Velocity Lead + Real Forward Lunge)
  // -------------------------------------------------------------------------
  if (e.soulsState === 'windup' || e.aiState === 'windup') {
    suppressLocomotionBlend = true;
    refreshAttackToken(e, profile.isRanged, angleFromPlayer);

    const meta = e.currentAttackMeta || Object.values(e.attackMetas || profile.attackMetas)[0];
    const windupDur = Math.max(0.08, Number(meta?.windup) || 0.56);
    const cutoff01 = clamp(Number(meta?.trackingCutoff01) || 0.86, 0.35, 0.92);

    e._soulsAttackElapsed = (e._soulsAttackElapsed || 0) + dt;
    const progress01 = clamp(e._soulsAttackElapsed / windupDur, 0, 1);

    out.attackAnimClip = meta?.attackAnimClip || null;
    out.combatPhase = 'windup';
    out.combatPhase01 = progress01;

    if (progress01 <= cutoff01) {
      let targetAimAng = angToPlayer;
      const pSpeed = Math.hypot(pvx, pvz);
      if (meta?.isRanged && pSpeed > 0.08) {
        const projSpd = Math.max(10, Number(meta.projectileSpeed) || 21);
        const leadSec = clamp((dist / projSpd) * 0.65, 0, 0.32);
        const ldx = (px + pvx * leadSec) - (e.x || 0);
        const ldz = (pz + pvz * leadSec) - (e.z || 0);
        if (Math.hypot(ldx, ldz) > 0.1) {
          targetAimAng = Math.atan2(ldx, ldz);
        }
      } else if (!meta?.isRanged && pSpeed > 0.9) {
        // Elden Ring melee strafe interception lead: prevents 1mm side-walk whiffing!
        const leadSec = clamp(0.07 + dist * 0.025, 0.07, 0.15) * (1.0 - progress01 * 0.55);
        const ldx = (px + pvx * leadSec) - (e.x || 0);
        const ldz = (pz + pvz * leadSec) - (e.z || 0);
        if (Math.hypot(ldx, ldz) > 0.1) {
          targetAimAng = Math.atan2(ldx, ldz);
        }
      }
      const taperStart = cutoff01 * 0.84;
      const taperFactor = progress01 <= taperStart
        ? 1.0
        : 1.0 - smoothstep01((progress01 - taperStart) / Math.max(0.04, cutoff01 - taperStart));
      const comboTurnBoost = (e.soulsComboLeft || 0) > 0 ? 1.25 : 1.0;
      out.desiredFacing = lerpAngle(
        prevFacing,
        targetAimAng,
        dt * profile.trackingTurnRate * comboTurnBoost * Math.max(0.36, taperFactor)
      );
      e._soulsLockedAngle = out.desiredFacing;
      e.soulsStrikeDirX = Math.sin(out.desiredFacing);
      e.soulsStrikeDirZ = Math.cos(out.desiredFacing);
      e.soulsTelegraphX = (e.x || 0) + e.soulsStrikeDirX * (meta?.telegraphForward || 1.5);
      e.soulsTelegraphZ = (e.z || 0) + e.soulsStrikeDirZ * (meta?.telegraphForward || 1.5);
      e._soulsTrackingLocked = false;
    } else {
      out.desiredFacing = e._soulsLockedAngle;
      e.soulsStrikeDirX = Math.sin(e._soulsLockedAngle);
      e.soulsStrikeDirZ = Math.cos(e._soulsLockedAngle);
      e._soulsTrackingLocked = true;
    }
    out.trackingLocked = Boolean(e._soulsTrackingLocked);

    // Authentic root-motion forward step-in (removed the old *0.55 nerf & >=0.55 delay clamp!)
    const lungeSpd = Number(meta?.lungeSpeed) || 0;
    const stepStart = clamp(Number(meta?.stepStart01) || 0.35, 0.20, 0.72);
    const stepPeak = Number(meta?.stepPeak01) || 0.90;
    const nearGateBack = lungeSpd < 0 && (e.z || 0) <= zDom.minZ + 1.35 && -e.soulsStrikeDirZ < 0;
    if (Math.abs(lungeSpd) > 0.01 && !nearGateBack && progress01 >= stepStart) {
      let curve;
      if (progress01 <= stepPeak) {
        curve = smoothstep01((progress01 - stepStart) / Math.max(0.05, stepPeak - stepStart));
      } else {
        const tailU = smoothstep01((progress01 - stepPeak) / Math.max(0.04, 1.0 - stepPeak));
        curve = 1.0 - 0.35 * tailU;
      }
      const rawStep = lungeSpd * curve * frostSlow;
      e._soulsStepEndRawSpeed = rawStep;
      const gapScale = lungeSpd > 0 ? clamp((dist - minMeleeGap) / 0.55, 0, 1) : 1.0;
      const effStep = rawStep * gapScale;
      rawVx = e.soulsStrikeDirX * effStep;
      rawVz = e.soulsStrikeDirZ * effStep;
    } else {
      const plantDecay = Math.exp(-26 * dt);
      rawVx = (e._velX || 0) * plantDecay;
      rawVz = (e._velZ || 0) * plantDecay;
      if (Math.hypot(rawVx, rawVz) < 0.08) {
        rawVx = 0;
        rawVz = 0;
      }
      e._soulsStepEndRawSpeed = 0;
    }

    if (e._soulsAttackElapsed >= windupDur || e.soulsTimer <= 0) {
      const activeDur = Math.max(0.05, Number(meta?.active) || 0.08);
      e.aiState = 'active';
      e.soulsState = 'active';
      e._soulsActiveDuration = activeDur;
      e._soulsActiveTimer = activeDur;
      e.soulsTimer = activeDur;
      e._soulsTrackingLocked = true;
      out.trackingLocked = true;
      out.attackAnimClip = meta?.releaseAnimClip || meta?.attackAnimClip || null;
      out.combatPhase = 'active';
      out.combatPhase01 = 0;

      const strikePayload = {
        ...meta,
        hitId: e._soulsAttackHitId,
        strikeAngle: e._soulsLockedAngle,
        strikeDirX: e.soulsStrikeDirX,
        strikeDirZ: e.soulsStrikeDirZ,
        telegraphX: e.soulsTelegraphX,
        telegraphZ: e.soulsTelegraphZ,
        activeWindowSec: activeDur
      };
      out.strikeMeta = strikePayload;
      out.activeAttackMeta = strikePayload;

      if (meta?.isRanged) {
        out.triggeredArrowSfx = true;
        if (playAudio) {
          audio?.playMobArrowWhoosh?.();
        }
      } else {
        out.triggeredSwingSfx = true;
        if (meta?.heavySfx) {
          out.triggeredHeavySwingSfx = true;
          if (playAudio) {
            if (typeof audio?.playMobHeavyWhoosh === 'function') {
              audio.playMobHeavyWhoosh();
            } else {
              audio?.playMobKnightSwing?.();
            }
          }
        } else if (playAudio) {
          audio?.playMobKnightSwing?.();
        }
      }
    }

  // -------------------------------------------------------------------------
  // 5. STATE: ACTIVE
  // -------------------------------------------------------------------------
  } else if (e.soulsState === 'active' || e.aiState === 'active') {
    suppressLocomotionBlend = true;
    refreshAttackToken(e, profile.isRanged, angleFromPlayer);

    const meta = e.currentAttackMeta || Object.values(e.attackMetas || profile.attackMetas)[0];
    const activeDur = Math.max(0.05, e._soulsActiveDuration || Number(meta?.active) || 0.08);
    e._soulsActiveTimer = Math.max(0, (e._soulsActiveTimer || 0) - dt);
    const activeProg01 = clamp(1 - e._soulsActiveTimer / activeDur, 0, 1);

    out.desiredFacing = e._soulsLockedAngle;
    out.trackingLocked = true;
    out.attackAnimClip = meta?.releaseAnimClip || meta?.attackAnimClip || null;
    out.combatPhase = 'active';
    out.combatPhase01 = activeProg01;
    out.activeAttackMeta = meta
      ? {
          ...meta,
          hitId: e._soulsAttackHitId,
          strikeAngle: e._soulsLockedAngle,
          strikeDirX: e.soulsStrikeDirX,
          strikeDirZ: e.soulsStrikeDirZ,
          activeWindowSec: activeDur
        }
      : null;

    const entryRawSpd = Number(e._soulsStepEndRawSpeed) || 0;
    if (Math.abs(entryRawSpd) > 0.01 && (entryRawSpd < 0 || dist > minMeleeGap)) {
      const gapScale = entryRawSpd > 0 ? clamp((dist - minMeleeGap) / 0.85, 0, 1) : 1.0;
      const carry = entryRawSpd * (1.0 - 0.6 * smoothstep01(activeProg01)) * gapScale;
      rawVx = e.soulsStrikeDirX * carry;
      rawVz = e.soulsStrikeDirZ * carry;
    }

    if (e._soulsActiveTimer <= 0) {
      const relAng = normalizeAngle(angToPlayer - e._soulsLockedAngle);
      const nextComboId = hasWallLOS ? chooseComboFollowUp(e, profile, meta, dist, relAng, reads, rng) : null;

      if (nextComboId) {
        e.soulsComboLeft = Math.max(0, (e.soulsComboLeft || 1) - 1);
        beginAttackWindup(e, profile, nextComboId, dirX, dirZ, angToPlayer, e.soulsComboLeft, out, audio, playAudio);
      } else {
        releaseSoulsAttackToken(e);
        const whiffedOutOfReach = !profile.isRanged && !e._lastSwingConnected && dist > (meta?.reach || 2.75) + 0.15;
        const baseRec = Math.max(0.34, Number(meta?.recovery) || 0.62);
        const recDur = whiffedOutOfReach ? Math.max(0.28, baseRec * 0.72) : baseRec;
        e._whiffedLastAttack = whiffedOutOfReach;
        e.aiState = 'recover';
        e.soulsState = 'recover';
        e.soulsTimer = recDur;
        e._soulsRecoverDuration = recDur;
        e._soulsRecoverElapsed = 0;
        e._soulsTrackingLocked = false;
        e.soulsComboLeft = 0;
        out.combatPhase = 'recover';
        out.combatPhase01 = 0;
        openPunishWindow(e, recDur, meta?.punishTier || 'light', meta?.punishDmgMult, meta?.punishStaggerMult);

        const wantsBackstep =
          !whiffedOutOfReach && (
            Boolean(meta?.postBackstep) ||
            (dist <= profile.postComboBackstepDist && rng() < profile.postComboBackstepChance)
          );
        if (wantsBackstep) {
          e._soulsPendingBackstep = {
            speed: meta?.backstepSpeed ?? profile.backstepSpeed,
            duration: meta?.backstepDuration ?? profile.backstepDuration
          };
        } else {
          e._soulsPendingBackstep = null;
        }
      }
    }

  // -------------------------------------------------------------------------
  // 6. STATE: RECOVER
  // -------------------------------------------------------------------------
  } else if (e.soulsState === 'recover' || e.aiState === 'recover') {
    suppressLocomotionBlend = true;
    releaseSoulsAttackToken(e);

    const meta = e.currentAttackMeta;
    const recDur = Math.max(0.28, e._soulsRecoverDuration || Number(meta?.recovery) || 0.6);
    e._soulsRecoverElapsed = (e._soulsRecoverElapsed || 0) + dt;
    const recProg01 = clamp(e._soulsRecoverElapsed / recDur, 0, 1);

    out.desiredFacing = lerpAngle(prevFacing, angToPlayer, dt * 2.2);
    out.attackAnimClip = meta?.releaseAnimClip || meta?.attackAnimClip || null;
    out.combatPhase = 'recover';
    out.combatPhase01 = recProg01;

    // Planted recovery stance: zero root skating while recovering from swing!
    e._soulsStepEndRawSpeed = 0;

    e.punishWindowTimer = Math.max(0, e.soulsTimer);
    if (e.soulsPunishWindow) {
      e.soulsPunishTimer = e.punishWindowTimer;
    }
    out.inPunishWindow = e.punishWindowTimer > 0;
    out.punishWindowTimer = e.punishWindowTimer;
    out.punishTier = e.soulsPunishWindow || null;

    if (e.soulsTimer <= 0) {
      e.currentAttackMeta = null;
      e.attackAnimClip = null;
      e._soulsStepEndRawSpeed = 0;
      clearPunishWindow(e);
      out.inPunishWindow = false;
      out.punishWindowTimer = 0;
      out.punishTier = null;
      out.attackAnimClip = null;

      const pendingBackstep = e._soulsPendingBackstep;
      e._soulsPendingBackstep = null;
      const archerCrowded = isArcherUnit && hasDirectLOS && dist < (e.retreatDist || profile.retreatDist);

      if ((pendingBackstep && (!isArcherUnit || hasDirectLOS)) || archerCrowded) {
        startBackstep(e, profile, dirX, dirZ, tanX, tanZ, zDom, pendingBackstep);
      } else if (isArcherUnit) {
        e._whiffedLastAttack = false;
        if (!hasDirectLOS) {
          e._archerSteppingUp = false;
          e._velX = 0;
          e._velZ = 0;
          e.aiState = 'hold_vantage';
        } else {
          e.aiState = dist < (e.retreatDist || profile.retreatDist)
            ? 'retreat'
            : (dist > (profile.stepUpTriggerDist || 16.5) ? 'approach' : 'circle');
        }
        e.soulsState = 'stalk';
        e.soulsTimer = randRange(profile.neutralDecisionMinSec * 0.85, profile.neutralDecisionMaxSec * 0.88, rng);
      } else if (!profile.isRanged && e._whiffedLastAttack && dist > 2.45) {
        // Relentless Elden Ring whiff-recovery pursuit: never stand frozen after missing a retreating player!
        e._whiffedLastAttack = false;
        e._soulsAssessTimer = 0;
        e.aiState = 'approach';
        e.soulsState = 'stalk';
        e.soulsTimer = randRange(0.12, 0.24, rng);
      } else {
        e._whiffedLastAttack = false;
        e.aiState = dist > (e.preferredDist || profile.preferredDist) + 0.30 ? 'approach' : 'circle';
        e.soulsState = 'stalk';
        e.soulsTimer = randRange(profile.neutralDecisionMinSec * 0.85, profile.neutralDecisionMaxSec * 0.88, rng);
      }
    }

  // -------------------------------------------------------------------------
  // 7. STATE: BACKSTEP
  // -------------------------------------------------------------------------
  } else if (e.aiState === 'backstep') {
    releaseSoulsAttackToken(e);
    e._soulsBackstepTimer = Math.max(0, (e._soulsBackstepTimer || 0) - dt);
    out.desiredFacing = lerpAngle(prevFacing, hasDirectLOS ? angToPlayer : (e._lastSeenPlayerAng ?? prevFacing), dt * 6.8);
    out.attackAnimClip = 'Backstep_Evade';
    out.combatPhase = 'neutral';
    out.combatPhase01 = 0;

    const dur = Math.max(0.1, e._soulsBackstepDuration || 0.34);
    const u = clamp(1 - e._soulsBackstepTimer / dur, 0, 1);
    const bell = Math.sin(u * Math.PI);
    const spd = (e._soulsBackstepSpeed || profile.backstepSpeed) * bell * frostSlow;
    rawVx = e._soulsBackstepDirX * spd;
    rawVz = e._soulsBackstepDirZ * spd;

    if (e._soulsBackstepTimer <= 0) {
      e.attackAnimClip = null;
      if (isArcherUnit) {
        e.aiState = !hasDirectLOS
          ? 'hold_vantage'
          : (dist < (e.retreatDist || profile.retreatDist) ? 'retreat' : 'circle');
      } else {
        e.aiState = dist > (e.preferredDist || profile.preferredDist) + 0.5 ? 'approach' : 'circle';
      }
      e.soulsState = 'stalk';
      e.soulsTimer = randRange(
        profile.neutralDecisionMinSec * 0.72,
        profile.neutralDecisionMaxSec * 0.9,
        rng
      );
    }

  // -------------------------------------------------------------------------
  // 8. STATE: ARCHWAY DOORWAY ROUTING + CALM NEUTRAL SPACING & FLANKING
  // -------------------------------------------------------------------------
  } else {
    useInertialSmoothing = true;
    releaseSoulsAttackToken(e);
    e.soulsState = 'stalk';
    e.attackAnimClip = null;
    out.combatPhase = 'neutral';
    out.combatPhase01 = 0;

    const pack = computeAllySeparationAndFlankBias(e, px, pz, liveEnemies);

    // Archers NEVER route through doorways or around blind pillars to chase a player out of sight!
    const doorwaySteer = isArcherUnit
      ? { x: px, z: pz, viaDoorway: false, viaPillar: false }
      : resolveDoorwaySteerTarget(e.x || 0, e.z || 0, px, pz, {
          ...ctx,
          mob: e,
          zDom
        });
    out.viaDoorway = Boolean(doorwaySteer.viaDoorway);

    if (doorwaySteer.viaDoorway) {
      e.aiState = 'approach';
      e._soulsAssessTimer = 0;
      const sdx = doorwaySteer.x - (e.x || 0);
      const sdz = doorwaySteer.z - (e.z || 0);
      const sLen = Math.hypot(sdx, sdz) || 1;
      const steerAng = Math.atan2(sdx, sdz);
      const targetFace = doorwaySteer.viaPillar && dist <= 3.4
        ? lerpAngle(steerAng, angToPlayer, 0.35)
        : steerAng;
      out.desiredFacing = lerpAngle(prevFacing, targetFace, dt * 7.2);
      const steerSpeedMult = doorwaySteer.viaPillar ? Math.max(1.04, profile.approachSpeedMult) : 0.96;
      rawVx = (sdx / sLen) * baseSpeed * steerSpeedMult + pack.sepX * 0.35;
      rawVz = (sdz / sLen) * baseSpeed * steerSpeedMult + pack.sepZ * 0.35;
    } else {
      const hasLOS = ctx.hasLineOfSight !== false && hasWallLOS;
      if (!isArcherUnit) {
        out.desiredFacing = lerpAngle(prevFacing, angToPlayer, dt * 6.4);
      }
      updateStrafeTimerAndWallBounce(e, profile, dt, tanX, tanZ, pack.preferredFlankDir, zDom, rng);

      e._soulsSpacingBiasTimer = (e._soulsSpacingBiasTimer || 0) - dt;
      if (e._soulsSpacingBiasTimer <= 0) {
        e._soulsSpacingBias = randRange(-0.28, 0.28, rng);
        e._soulsSpacingBiasTimer = randRange(1.2, 2.2, rng);
      }

      const sBlend = Number.isFinite(e._strafeBlend) ? e._strafeBlend : (e.strafeDir || 1);
      const retreatDist = e.retreatDist || profile.retreatDist;

      // Check if player retreated into the Flame-Trap Gauntlet beyond this mob's allowed Z boundary
      const playerInFlameTraps =
        (!zDom.isSouthOfTraps && pz > zDom.maxZ + 0.5 && (e.z || 0) >= zDom.maxZ - 0.85) ||
        (zDom.isSouthOfTraps && pz < zDom.minZ - 0.5 && (e.z || 0) <= zDom.minZ + 0.85);

      if (reads.playerHealing && hasLOS && !playerInFlameTraps && (e._soulsHealPunishCd || 0) <= 0) {
        const punishReach = isArcherUnit ? 16.0 : (e.preferredDist || profile.preferredDist) + 2.2;
        if (dist <= punishReach) {
          e._soulsAssessTimer = 0;
          e.soulsTimer = Math.min(e.soulsTimer, 0.04);
        }
      }

      if (isArcherUnit) {
        // Section 3.3 Strict LOS-Gated Ranged AI:
        //   1) When `!hasLOS`: NEVER pursue or advance around cover -> hold vantage (`vx = 0, vz = 0`)
        //      facing last-seen direction (returns home calmly once broken LOS > 6.5s).
        //   2) When `hasLOS`: maintain optimal [8.5m .. 16.0m] band, NEVER step forward if dist <= 14.5m
        //      (only step up to ~13.5m if dist > 16.5m WITH LOS AND inside home zone!), and kite backward
        //      (`Walk_Backward` / `Quick_Retreat_Shot`) whenever player closes < 6.8m!
        if (!hasLOS) {
          e._archerSteppingUp = false;
          e.aiState = 'hold_vantage';
          const holdYaw = Number.isFinite(e._lastSeenPlayerAng) ? e._lastSeenPlayerAng : prevFacing;
          out.desiredFacing = lerpAngle(prevFacing, holdYaw, dt * 4.2);
          rawVx = 0;
          rawVz = 0;
          e._velX = 0;
          e._velZ = 0;
          useInertialSmoothing = false;
        } else {
          out.desiredFacing = lerpAngle(prevFacing, angToPlayer, dt * 7.2);
          const kiteTriggerDist = Math.max(6.8, Number(retreatDist) || 6.8);
          const optMinDist = Number(profile.optimalMinDist) || 8.5;
          const noAdvanceDist = Number(profile.noAdvanceBelowDist) || 14.5;
          const stepUpTrigger = Number(profile.stepUpTriggerDist) || 16.5;
          const stepUpTarget = Number(profile.stepUpTargetDist) || 13.5;
          const maxHomeZoneR = Number(profile.maxHomeZoneRadius) || 5.2;

          const homeX = Number.isFinite(e.homeX)
            ? e.homeX
            : (Number.isFinite(e.patrolHomeX) ? e.patrolHomeX : (e.x || 0));
          const homeZ = Number.isFinite(e.homeZ)
            ? e.homeZ
            : (Number.isFinite(e.patrolHomeZ) ? e.patrolHomeZ : (e.z || 0));
          const nextStepHomeDist = Math.hypot((e.x || 0) + dirX * 0.55 - homeX, (e.z || 0) + dirZ * 0.55 - homeZ);

          if (dist < kiteTriggerDist) {
            e._archerSteppingUp = false;
            e.aiState = 'retreat';
            const urgency = dist < 4.2 ? 1.06 : 0.94;
            const nearNorthLimit = (e.z || 0) <= zDom.minZ + 1.45 && -dirZ < 0;
            const nearSouthLimit = (e.z || 0) >= zDom.maxZ - 1.45 && -dirZ > 0;
            const backBlocked =
              nearNorthLimit ||
              nearSouthLimit ||
              isStrafeDirectionBlocked(e.x || 0, e.z || 0, -dirX, -dirZ, 0.85, Number(e.radius) || 0.55, zDom);
            if (backBlocked) {
              rawVx = tanX * sBlend * strafeSpeed * 1.05 - dirX * baseSpeed * 0.35;
              rawVz = tanZ * sBlend * strafeSpeed * 1.05 - dirZ * baseSpeed * 0.35;
            } else {
              // Predominantly backward velocity so locomotion plays `Walk_Backward` while bow stays aimed at player!
              rawVx = -dirX * baseSpeed * urgency + tanX * sBlend * strafeSpeed * 0.28;
              rawVz = -dirZ * baseSpeed * urgency + tanZ * sBlend * strafeSpeed * 0.28;
            }
          } else if (dist < optMinDist) {
            e._archerSteppingUp = false;
            e.aiState = 'retreat';
            rawVx = -dirX * baseSpeed * 0.62 + tanX * sBlend * strafeSpeed * 0.44;
            rawVz = -dirZ * baseSpeed * 0.62 + tanZ * sBlend * strafeSpeed * 0.44;
          } else {
            if (dist > stepUpTrigger && !playerInFlameTraps && nextStepHomeDist <= maxHomeZoneR) {
              e._archerSteppingUp = true;
            }
            if (
              dist <= stepUpTarget ||
              (dist <= noAdvanceDist && !e._archerSteppingUp) ||
              playerInFlameTraps ||
              nextStepHomeDist > maxHomeZoneR
            ) {
              e._archerSteppingUp = false;
            }

            if (e._archerSteppingUp && dist > noAdvanceDist) {
              e.aiState = 'approach';
              rawVx = dirX * baseSpeed * (profile.approachSpeedMult || 0.85) + tanX * sBlend * strafeSpeed * 0.20;
              rawVz = dirZ * baseSpeed * (profile.approachSpeedMult || 0.85) + tanZ * sBlend * strafeSpeed * 0.20;
            } else if (dist > stepUpTrigger && nextStepHomeDist > maxHomeZoneR) {
              e.aiState = 'hold_vantage';
              rawVx = 0;
              rawVz = 0;
            } else {
              // Optimal [8.5m .. 16.0m] overwatch band: pure lateral positioning, ZERO forward closing!
              e.aiState = 'circle';
              rawVx = tanX * sBlend * strafeSpeed * 0.60;
              rawVz = tanZ * sBlend * strafeSpeed * 0.60;
            }
          }

          rawVx += pack.sepX * 0.55;
          rawVz += pack.sepZ * 0.55;

          // Guarantee ZERO forward radial movement toward player whenever dist <= 14.5m (or not stepping up)
          if (!e._archerSteppingUp || dist <= noAdvanceDist) {
            const fwdDot = rawVx * dirX + rawVz * dirZ;
            if (fwdDot > 0) {
              rawVx -= dirX * fwdDot;
              rawVz -= dirZ * fwdDot;
            }
          }

          if (!playerInFlameTraps && e.soulsTimer <= 0 && dist <= 16.2) {
            if (tryAcquireAttackToken(e, true, angleFromPlayer, maxMeleeTokens, maxRangedTokens)) {
              if (reads.playerHealing) e._soulsHealPunishCd = 4.0;
              const pick = chooseInitialAttack(e, profile, dist, reads, zDom.minZ, rng);
              beginAttackWindup(e, profile, pick.attackId, dirX, dirZ, angToPlayer, pick.comboLeft, out, audio, playAudio);
              const plantD = Math.exp(-14 * dt);
              rawVx = (e._velX || 0) * plantD;
              rawVz = (e._velZ || 0) * plantD;
              useInertialSmoothing = false;
              suppressLocomotionBlend = true;
            } else {
              e.soulsTimer = randRange(0.42, 0.72, rng);
            }
          }
        }
      } else {
        const waitingForSlot = _meleeTokenHolders.size >= maxMeleeTokens && !_meleeTokenHolders.has(getMobTokenId(e));
        const flankRingBonus = waitingForSlot ? 1.05 : 0;
        const prefDist = (e.preferredDist || profile.preferredDist) + e._soulsSpacingBias + flankRingBonus;

        e._soulsAssessTimer = Math.max(0, (e._soulsAssessTimer || 0) - dt);
        e._soulsAssessCooldown = Math.max(0, (e._soulsAssessCooldown || 0) - dt);

        const inSweetSpot = hasLOS && !waitingForSlot && dist >= retreatDist && dist <= prefDist + 0.55;
        if (inSweetSpot && e._soulsAssessTimer <= 0 && e._soulsAssessCooldown <= 0 && e.soulsTimer > 0.35) {
          if (dist < retreatDist + 0.5 && rng() < 0.34) {
            startBackstep(e, profile, dirX, dirZ, tanX, tanZ, zDom, { speed: 2.55, duration: 0.34 });
            e._soulsAssessCooldown = randRange(profile.assessIntervalMinSec || 2.4, profile.assessIntervalMaxSec || 3.8, rng);
          } else {
            e._soulsAssessTimer = randRange(profile.assessPauseMinSec || 0.45, profile.assessPauseMaxSec || 0.78, rng);
            e._soulsAssessCooldown = randRange(profile.assessIntervalMinSec || 2.4, profile.assessIntervalMaxSec || 3.8, rng);
          }
        }

        if (e.aiState === 'backstep') {
          useInertialSmoothing = false;
        } else if (playerInFlameTraps) {
          // Hold threshold smartly outside the flame traps without running into fire!
          e.aiState = 'circle';
          rawVx = tanX * sBlend * strafeSpeed * 0.85 + pack.sepX;
          rawVz = pack.sepZ * 0.4;
        } else if (!hasLOS) {
          // Never stand circling/assessing on the blind side of a pillar or pier — advance cleanly around cover!
          e.aiState = 'approach';
          e._soulsAssessTimer = 0;
          rawVx = dirX * baseSpeed * profile.approachSpeedMult + tanX * sBlend * strafeSpeed * 0.45 + pack.sepX;
          rawVz = dirZ * baseSpeed * profile.approachSpeedMult + tanZ * sBlend * strafeSpeed * 0.45 + pack.sepZ;
        } else if (e._soulsAssessTimer > 0 && inSweetSpot && dist <= 2.45) {
          e.aiState = 'assess';
          rawVx = tanX * sBlend * strafeSpeed * 0.52 + dirX * baseSpeed * 0.24 + pack.sepX * 0.5;
          rawVz = tanZ * sBlend * strafeSpeed * 0.52 + dirZ * baseSpeed * 0.24 + pack.sepZ * 0.5;
        } else if (waitingForSlot && dist <= prefDist + 1.2) {
          e.aiState = 'flank';
          const radialErr = clamp((dist - prefDist) * 0.45, -0.42, 0.42);
          rawVx = dirX * baseSpeed * radialErr + tanX * sBlend * strafeSpeed * 0.98 + pack.sepX;
          rawVz = dirZ * baseSpeed * radialErr + tanZ * sBlend * strafeSpeed * 0.98 + pack.sepZ;
        } else if (dist > prefDist + 0.25) {
          e.aiState = 'approach';
          const closeSurge = dist > 3.0 ? 1.12 : 1.0;
          const weave = dist < 5.8 ? 0.24 : 0.14;
          rawVx = dirX * baseSpeed * profile.approachSpeedMult * closeSurge + tanX * sBlend * strafeSpeed * weave + pack.sepX;
          rawVz = dirZ * baseSpeed * profile.approachSpeedMult * closeSurge + tanZ * sBlend * strafeSpeed * weave + pack.sepZ;
        } else if (dist < retreatDist) {
          e.aiState = 'retreat';
          rawVx = -dirX * baseSpeed * 0.42 + tanX * sBlend * strafeSpeed * 0.8 + pack.sepX;
          rawVz = -dirZ * baseSpeed * 0.42 + tanZ * sBlend * strafeSpeed * 0.8 + pack.sepZ;
        } else {
          e.aiState = 'circle';
          const radialErr = clamp((dist - prefDist) * 0.55, -0.32, 0.48);
          rawVx = dirX * baseSpeed * radialErr + tanX * sBlend * strafeSpeed * 0.92 + pack.sepX;
          rawVz = dirZ * baseSpeed * radialErr + tanZ * sBlend * strafeSpeed * 0.92 + pack.sepZ;
        }

        // Honest Souls engage range: verify `chooseInitialAttack` can genuinely reach BEFORE committing to windup!
        const maxEngageWindow =
          profile.id === 'iron_knight'
            ? (reads.playerHealing ? 4.35 : 4.05)
            : (reads.playerHealing ? 3.15 : 2.95);

        if (hasLOS && !playerInFlameTraps && e.aiState !== 'backstep' && e.soulsTimer <= 0 && dist <= maxEngageWindow) {
          const pick = chooseInitialAttack(e, profile, dist, reads, zDom.minZ, rng);
          if (pick) {
            if (tryAcquireAttackToken(e, false, angleFromPlayer, maxMeleeTokens, maxRangedTokens)) {
              if (reads.playerHealing) e._soulsHealPunishCd = 4.0;
              if (reads.playerRollSpam) e._soulsRollCount = 0;
              if (reads.playerTurtleBlocking) e._soulsBlockHoldTime = 0;
              e._soulsAssessTimer = 0;
              beginAttackWindup(e, profile, pick.attackId, dirX, dirZ, angToPlayer, pick.comboLeft, out, audio, playAudio);
              const plantD = Math.exp(-14 * dt);
              rawVx = (e._velX || 0) * plantD;
              rawVz = (e._velZ || 0) * plantD;
              useInertialSmoothing = false;
              suppressLocomotionBlend = true;
            } else {
              e.aiState = 'flank';
              e.soulsTimer = randRange(0.38, 0.68, rng);
            }
          } else {
            // Player is just outside honest blade reach (e.g. backed away to 3.1–3.9m): surge forward to close distance!
            e.aiState = 'approach';
            e._soulsAssessTimer = 0;
            rawVx = dirX * baseSpeed * profile.approachSpeedMult * 1.15 + tanX * sBlend * strafeSpeed * 0.16 + pack.sepX;
            rawVz = dirZ * baseSpeed * profile.approachSpeedMult * 1.15 + tanZ * sBlend * strafeSpeed * 0.16 + pack.sepZ;
          }
        }
      }
    }

    // Multi-angle obstacle, pillar & corner-unstick steering across ALL non-attack locomotion states!
    if (!suppressLocomotionBlend && e.aiState !== 'backstep' && e.aiState !== 'hold_vantage') {
      const steerGoalX = doorwaySteer.viaDoorway ? doorwaySteer.x : px;
      const steerGoalZ = doorwaySteer.viaDoorway ? doorwaySteer.z : pz;
      const steeredMove = steerMobAroundCornersAndObstacles(e, rawVx, rawVz, steerGoalX, steerGoalZ, zDom, dt, ctx);
      rawVx = steeredMove.vx;
      rawVz = steeredMove.vz;
      if (isArcherUnit && (!e._archerSteppingUp || dist <= (Number(profile.noAdvanceBelowDist) || 14.5))) {
        const fwdAfterSteer = rawVx * dirX + rawVz * dirZ;
        if (fwdAfterSteer > 0) {
          rawVx -= dirX * fwdAfterSteer;
          rawVz -= dirZ * fwdAfterSteer;
        }
      }
      if (!isArcherUnit && steeredMove.steered && Math.hypot(rawVx, rawVz) > 0.25) {
        out.desiredFacing = lerpAngle(prevFacing, Math.atan2(rawVx, rawVz), dt * 7.8);
      }
    }
  }

  // -------------------------------------------------------------------------
  // 9. INERTIAL SMOOTHING, WALKABLE/FLAME-TRAP CLAMPING & OUTPUTS
  // -------------------------------------------------------------------------
  if (useInertialSmoothing) {
    const accel = Number(profile.inertiaAccel) || 9.5;
    const damp = 1 - Math.exp(-accel * dt);
    e._velX = (e._velX || 0) + (rawVx - (e._velX || 0)) * damp;
    e._velZ = (e._velZ || 0) + (rawVz - (e._velZ || 0)) * damp;
    rawVx = e._velX;
    rawVz = e._velZ;
  } else {
    e._velX = rawVx;
    e._velZ = rawVz;
  }

  const clamped = clampSoulsCorridorVelocity(e, rawVx, rawVz, dt, ctx);
  const finalSpeed = Math.hypot(clamped.vx, clamped.vz);
  const localVel = projectLocalVelocity(clamped.vx, clamped.vz, out.desiredFacing);
  const yawDelta = normalizeAngle(out.desiredFacing - prevFacing);

  out.vx = clamped.vx;
  out.vz = clamped.vz;
  out.moveLocalX = localVel.localX;
  out.moveLocalZ = localVel.localZ;
  out.turnDelta = yawDelta;
  out.fogGateClamped = clamped.fogGateClamped;
  out.flameTrapClamped = clamped.flameTrapClamped;
  out.hasAttackToken = Boolean(e._soulsHasAttackToken);
  out.hasRootMotionStep = suppressLocomotionBlend && finalSpeed > 0.05;

  if (suppressLocomotionBlend) {
    out.isMoving = false;
    out.animSpeedMult = 0;
    out.patrolMoveSpeedRatio = 0;
    out.strafeAnimMode = 'idle';
  } else {
    // Hysteresis on moving threshold (0.14 enter / 0.06 exit) kills 'assess' separation idle<->walk flickering!
    const wasMoving = Boolean(e._soulsWasMoving);
    out.isMoving = wasMoving ? finalSpeed > 0.06 : finalSpeed > 0.14;
    e._soulsWasMoving = out.isMoving;
    const refSpd = Math.max(0.8, profile.refWalkSpeed || baseSpeed);
    out.animSpeedMult = out.isMoving
      ? clamp((finalSpeed / refSpd) * 0.95, 0.34, 1.08)
      : 0;
    out.patrolMoveSpeedRatio = out.animSpeedMult;
    out.strafeAnimMode = resolveStrafeAnimMode({
      e,
      isMoving: out.isMoving,
      isPatrol: false,
      aiState: e.aiState,
      localX: localVel.localX,
      localZ: localVel.localZ,
      yawDelta,
      dt
    });
  }

  out.aiState = e.aiState;
  out.soulsState = e.soulsState;

  e.facing = out.desiredFacing;
  // Store AI velocity in aiVx/aiVz (NEVER overload legacy knockback e.vx/e.vz which combat.js:8146 double-integrated!)
  e.aiVx = out.vx;
  e.aiVz = out.vz;
  e.vx = 0;
  e.vz = 0;
  e.animSpeedMult = out.animSpeedMult;
  e.strafeAnimMode = out.strafeAnimMode;
  e.attackAnimClip = out.attackAnimClip;
  e.combatPhase = out.combatPhase;
  e.combatPhase01 = out.combatPhase01;

  if (applyPosition && dt > 0) {
    e.x = (e.x || 0) + out.vx * dt;
    e.z = clamp((e.z || 0) + out.vz * dt, clamped.minZ, clamped.maxZ);
    if (typeof CASTLE_LAYOUT.clampCastlePosition === 'function') {
      const p = CASTLE_LAYOUT.clampCastlePosition(e.x, e.z, e.radius || 0.55, {
        bossDoorState: 'closed',
        allowBossHall: false,
        out: _tmpClampOut
      });
      e.x = p.x;
      e.z = clamp(p.z, clamped.minZ, clamped.maxZ);
    }
  }

  return out;
}

export const updateSoulsMobAi = stepSoulsMobAi;
