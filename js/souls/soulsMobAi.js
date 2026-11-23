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

import * as CASTLE_LAYOUT from './soulsCastleLayout.js?v=20261123z71';

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

export function getBonfireSafeZone(opts = {}) {
  const bf = opts.bonfirePos || CASTLE_LAYOUT.SOULS_CASTLE_BONFIRE || { x: 0, z: 32.5 };
  const radius = Number(opts.bonfireSafeRadius) > 0
    ? Number(opts.bonfireSafeRadius)
    : (Number(CASTLE_LAYOUT.SOULS_BONFIRE_SAFE_RADIUS) > 0
      ? Number(CASTLE_LAYOUT.SOULS_BONFIRE_SAFE_RADIUS)
      : 9.5);
  return {
    x: Number.isFinite(bf.x) ? bf.x : 0,
    z: Number.isFinite(bf.z) ? bf.z : 32.5,
    radius
  };
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
  if (opts?.hasLineOfSight === false) return false;
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
 * Smart archway doorway router (`getCastleDoorwaySteerTarget` integration + fallback).
 * Ensures mobs inside East Alcove or West Wing thread cleanly through the center
 * of the connecting gothic archway (e.g. `{ x: 4.5, z: -0.4 }`) and NEVER slam into walls!
 */
export function resolveDoorwaySteerTarget(fromX, fromZ, toX, toZ, opts = {}) {
  const clearLOS = hasMobWallLineOfSight(fromX, fromZ, toX, toZ, { ...opts, ignorePillars: true });

  if (typeof CASTLE_LAYOUT.getCastleDoorwaySteerTarget === 'function') {
    const res = CASTLE_LAYOUT.getCastleDoorwaySteerTarget(fromX, fromZ, toX, toZ);
    if (res && Number.isFinite(res.x) && Number.isFinite(res.z)) {
      const deltaToGoal = Math.hypot(res.x - toX, res.z - toZ);
      const distToSteer = Math.hypot(res.x - fromX, res.z - fromZ);
      if (deltaToGoal > 0.25 && distToSteer > 0.22) {
        return { x: res.x, z: res.z, viaDoorway: true };
      }
    }
    if (clearLOS) {
      return { x: toX, z: toZ, viaDoorway: false };
    }
  }

  if (clearLOS) {
    return { x: toX, z: toZ, viaDoorway: false };
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
  windup: 0.66,
  active: 0.09,
  recovery: 0.6,
  trackingCutoff01: 0.68,
  staminaDamage: 30,
  damageLevel: 'light',
  damageMult: 1.0,
  reach: 2.6,
  arcRad: Math.PI * 0.78,
  telegraphForward: 1.5,
  telegraphRadius: 0,
  lungeSpeed: 1.55,
  stepStart01: 0.45,
  stepPeak01: 0.88,
  lungeWindowSec: 0.28,
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
  windup: 0.57,
  active: 0.09,
  recovery: 0.65,
  trackingCutoff01: 0.67,
  staminaDamage: 34,
  damageLevel: 'light',
  damageMult: 1.08,
  reach: 2.65,
  arcRad: Math.PI * 0.82,
  telegraphForward: 1.55,
  telegraphRadius: 0,
  lungeSpeed: 1.65,
  stepStart01: 0.42,
  stepPeak01: 0.88,
  lungeWindowSec: 0.26,
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
  windup: 0.94,
  active: 0.1,
  recovery: 0.95,
  trackingCutoff01: 0.65,
  staminaDamage: 50,
  damageLevel: 'heavy',
  damageMult: 1.32,
  reach: 2.8,
  arcRad: Math.PI * 0.54,
  telegraphForward: 1.7,
  telegraphRadius: 0,
  lungeSpeed: 1.85,
  stepStart01: 0.54,
  stepPeak01: 0.9,
  lungeWindowSec: 0.34,
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
  windup: 0.71,
  active: 0.09,
  recovery: 0.8,
  trackingCutoff01: 0.66,
  staminaDamage: 38,
  damageLevel: 'heavy',
  damageMult: 1.18,
  reach: 3.0,
  arcRad: Math.PI * 0.36,
  telegraphForward: 1.9,
  telegraphRadius: 0,
  lungeSpeed: 2.2,
  stepStart01: 0.44,
  stepPeak01: 0.88,
  lungeWindowSec: 0.34,
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
  followUpIds: Object.freeze([])
});

const FOOTMAN_THRUST_1 = Object.freeze({
  id: 'thrust_1',
  moveType: 'thrust',
  attackAnimClip: 'Attack_Thrust_1',
  releaseAnimClip: 'Attack_Thrust_1',
  label: 'Колющий выпад из-за щита',
  windup: 0.54,
  active: 0.08,
  recovery: 0.55,
  trackingCutoff01: 0.66,
  staminaDamage: 26,
  damageLevel: 'light',
  damageMult: 0.96,
  reach: 2.65,
  arcRad: Math.PI * 0.42,
  telegraphForward: 1.6,
  telegraphRadius: 0,
  lungeSpeed: 1.95,
  stepStart01: 0.42,
  stepPeak01: 0.88,
  lungeWindowSec: 0.26,
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
  windup: 0.61,
  active: 0.09,
  recovery: 0.68,
  trackingCutoff01: 0.67,
  staminaDamage: 30,
  damageLevel: 'light',
  damageMult: 1.06,
  reach: 2.55,
  arcRad: Math.PI * 0.78,
  telegraphForward: 1.45,
  telegraphRadius: 0,
  lungeSpeed: 1.45,
  stepStart01: 0.45,
  stepPeak01: 0.88,
  lungeWindowSec: 0.26,
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
  windup: 0.64,
  active: 0.09,
  recovery: 0.82,
  trackingCutoff01: 0.66,
  staminaDamage: 56,
  damageLevel: 'heavy',
  damageMult: 0.92,
  reach: 2.25,
  arcRad: Math.PI * 0.56,
  telegraphForward: 1.25,
  telegraphRadius: 0,
  lungeSpeed: 2.1,
  stepStart01: 0.46,
  stepPeak01: 0.9,
  lungeWindowSec: 0.28,
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
  windup: 0.73,
  active: 0.08,
  recovery: 0.72,
  trackingCutoff01: 0.66,
  staminaDamage: 34,
  damageLevel: 'light',
  damageMult: 1.12,
  reach: 2.7,
  arcRad: Math.PI * 0.38,
  telegraphForward: 1.6,
  telegraphRadius: 0,
  lungeSpeed: 1.35,
  stepStart01: 0.48,
  stepPeak01: 0.88,
  lungeWindowSec: 0.28,
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
  followUpIds: Object.freeze([])
});

const ARCHER_AIM_SHOT = Object.freeze({
  id: 'shot',
  moveType: 'shot',
  attackAnimClip: 'Aim_Draw',
  releaseAnimClip: 'Shot_Release',
  label: 'Прицельный выстрел',
  windup: 0.9,
  active: 0.08,
  recovery: 1.08,
  trackingCutoff01: 0.68,
  staminaDamage: 22,
  damageLevel: 'light',
  damageMult: 1.0,
  reach: 14.5,
  arcRad: Math.PI * 0.2,
  telegraphForward: 1.0,
  telegraphRadius: 0,
  lungeSpeed: 0,
  stepStart01: 0,
  stepPeak01: 0,
  lungeWindowSec: 0,
  followThroughSlide: 0,
  projectileSpeed: 18.0,
  projectileMaxDist: 17.5,
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
  reach: 12.5,
  arcRad: Math.PI * 0.22,
  telegraphForward: 0.95,
  telegraphRadius: 0,
  lungeSpeed: -1.75,
  stepStart01: 0.35,
  stepPeak01: 0.88,
  lungeWindowSec: 0.28,
  followThroughSlide: 0,
  projectileSpeed: 17.5,
  projectileMaxDist: 16.0,
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
    preferredDist: 3.1,
    retreatDist: 1.65,
    strafeSpeed: 1.65,
    approachSpeedMult: 0.92,
    inertiaAccel: 8.5,
    refWalkSpeed: 2.55,
    aggroRange: 9.2,
    parriesToKneel: 1,
    isRanged: false,
    strafeSwitchMinSec: 1.6,
    strafeSwitchMaxSec: 2.8,
    neutralDecisionMinSec: 1.4,
    neutralDecisionMaxSec: 2.45,
    assessIntervalMinSec: 2.4,
    assessIntervalMaxSec: 3.8,
    assessPauseMinSec: 0.45,
    assessPauseMaxSec: 0.78,
    postComboBackstepDist: 2.15,
    postComboBackstepChance: 0.36,
    backstepSpeed: 3.1,
    backstepDuration: 0.34,
    trackingTurnRate: 6.2,
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
    preferredDist: 2.6,
    retreatDist: 1.45,
    strafeSpeed: 1.9,
    approachSpeedMult: 0.96,
    inertiaAccel: 11.5,
    refWalkSpeed: 2.45,
    aggroRange: 10.2,
    parriesToKneel: 1,
    isRanged: false,
    strafeSwitchMinSec: 1.5,
    strafeSwitchMaxSec: 2.5,
    neutralDecisionMinSec: 1.35,
    neutralDecisionMaxSec: 2.35,
    assessIntervalMinSec: 2.3,
    assessIntervalMaxSec: 3.6,
    assessPauseMinSec: 0.42,
    assessPauseMaxSec: 0.7,
    postComboBackstepDist: 2.1,
    postComboBackstepChance: 0.38,
    backstepSpeed: 3.25,
    backstepDuration: 0.34,
    trackingTurnRate: 7.0,
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
    preferredDist: 11.5,
    retreatDist: 6.2,
    strafeSpeed: 1.55,
    approachSpeedMult: 0.9,
    inertiaAccel: 10.0,
    refWalkSpeed: 2.15,
    aggroRange: 12.2,
    parriesToKneel: 1,
    isRanged: true,
    strafeSwitchMinSec: 1.6,
    strafeSwitchMaxSec: 2.7,
    neutralDecisionMinSec: 1.45,
    neutralDecisionMaxSec: 2.5,
    assessIntervalMinSec: 2.6,
    assessIntervalMaxSec: 4.0,
    assessPauseMinSec: 0.4,
    assessPauseMaxSec: 0.68,
    postComboBackstepDist: 6.2,
    postComboBackstepChance: 0.72,
    backstepSpeed: 3.05,
    backstepDuration: 0.34,
    trackingTurnRate: 6.8,
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
  const anchorZ = Number.isFinite(e?.patrolHomeZ)
    ? e.patrolHomeZ
    : (Number.isFinite(e?.z) ? e.z : 0);
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

  // Keep enemies out of the Bonfire Sanctuary circle when active
  const bfZone = getBonfireSafeZone(opts);
  const candX0 = x + outVx * safeDt;
  const candZ0 = clamp(z + outVz * safeDt, minZ, maxZ);
  const bdx = candX0 - bfZone.x;
  const bdz = candZ0 - bfZone.z;
  const bDist = Math.hypot(bdx, bdz);
  const minBfDist = Math.max(1.5, bfZone.radius - 0.35);
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
    outVx = (projected.x - x) / safeDt;
    outVz = (clampedZ - z) / safeDt;
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
    px >= -2.6;
  if (inArchCorridorBand && dist <= (Number(e.ambushAggroRange) || 10.5)) {
    return true;
  }
  const closeAmbushR = Number(e.ambushAggroRange) > 0 ? Math.min(Number(e.ambushAggroRange), 5.6) : 5.4;
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

  // Schmitt-trigger minimum hold time (0.22s) between locomotion gaits prevents rapid flip-flop twitching
  const isGaitPrev = prevMode === 'combat_walk' || prevMode === 'strafe_left' || prevMode === 'strafe_right' || prevMode === 'backstep';
  const isGaitNext = nextMode === 'combat_walk' || nextMode === 'strafe_left' || nextMode === 'strafe_right' || nextMode === 'backstep';
  if (e && nextMode !== prevMode) {
    if (isGaitPrev && isGaitNext && aiState !== 'backstep' && e._soulsAnimModeHoldTimer > 0) {
      return prevMode;
    }
    e._soulsPrevAnimMode = nextMode;
    e._soulsAnimModeHoldTimer = isGaitNext ? 0.22 : 0.12;
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
  const fullKneel = e._soulsParryCount >= parriesNeeded;
  const riposteSec = Number(opts.riposteSec ?? (fullKneel ? 2.6 : 1.5));
  const stunSec = Number(opts.stunSec ?? (fullKneel ? 2.4 : 1.35));

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
    e.soulsState = 'stagger_kneel';
    e.attackAnimClip = 'Stagger_Kneel';
  } else {
    if (e.staggerMax > 0) {
      e.stagger = Math.min(e.staggerMax, (e.stagger || 0) + Math.ceil(e.staggerMax / parriesNeeded));
    }
    e.soulsState = 'recover';
    e.attackAnimClip = 'Hit_React';
  }

  e.aiState = 'stunned';
  e.combatPhase = 'recover';
  e.combatPhase01 = 0;
  e.strafeAnimMode = 'idle';
  e.animSpeedMult = 0;
  e.stunTimer = Math.max(e.stunTimer || 0, stunSec);
  e.parriedRiposteTimer = Math.max(e.parriedRiposteTimer || 0, riposteSec);
  e.soulsTimer = Math.max(e.soulsTimer || 0, stunSec);
  openPunishWindow(e, riposteSec, 'heavy', 1.25, 1.4);
  e.vx = 0;
  e.vz = 0;

  return {
    staggered: fullKneel,
    riposteOpen: true,
    stunSec,
    riposteSec
  };
}

export function onSoulsMobInterrupted(e, recoverSec = 0.56) {
  if (!e || typeof e !== 'object') return;
  if (!e._soulsMobAiInit) initSoulsMobState(e);
  releaseSoulsAttackToken(e);

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

  if (e.soulsState === 'windup' || e.soulsState === 'active') {
    const dur = Math.max(0.28, Number(recoverSec) || 0.56);
    e.aiState = 'hit_react';
    e.soulsState = 'recover';
    e.soulsTimer = dur;
    e._soulsRecoverDuration = dur;
    e._soulsRecoverElapsed = 0;
    e.attackAnimClip = 'Hit_React';
    e.combatPhase = 'recover';
    e.combatPhase01 = 0;
    e.strafeAnimMode = 'idle';
    e.animSpeedMult = 0;
    openPunishWindow(e, dur, 'light', 1.15, 1.2);
  }
  e.vx = 0;
  e.vz = 0;
}

// ============================================================================
// 6. Attack Selection, Combo Branching & Footwork Helpers (ZERO Red Circles!)
// ============================================================================

function beginAttackWindup(e, profile, attackId, dirToPlayerX, dirToPlayerZ, angToPlayer, comboLeft, out, audio, playAudio) {
  const metas = e.attackMetas || profile.attackMetas;
  const meta = metas[attackId] || Object.values(metas)[0];
  if (!meta) return;

  renewAttackTokenOnCombo(e, profile.isRanged, Math.atan2(-dirToPlayerX, -dirToPlayerZ));

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
  const { playerHealing, playerBlocking, playerTurtleBlocking, playerPanicRolling, playerRollSpam, playerBehind } = reads;

  if (profile.id === 'bone_archer') {
    const nearGate = (e.z || 0) <= liveFogGateZ + 1.65;
    const id = dist < (e.retreatDist || profile.retreatDist) && !nearGate ? 'quick_retreat_shot' : 'shot';
    return { attackId: id, comboLeft: 0 };
  }

  if (profile.id === 'cursed_footman') {
    if ((playerTurtleBlocking || (playerBlocking && dist <= 2.6) || dist < 1.85) && dist <= 2.95 && e._soulsLastAttackId !== 'shield_bash') {
      return { attackId: 'shield_bash', comboLeft: 0 };
    }
    const r = rng();
    if (playerHealing || dist >= 2.25 || r < 0.56) {
      const links = playerBlocking ? 2 : (r < 0.42 ? 0 : (r < 0.82 ? 1 : 2));
      return { attackId: 'thrust_1', comboLeft: links };
    }
    if (r < 0.8 && e._soulsLastAttackId !== 'overhead_poke') {
      return { attackId: 'overhead_poke', comboLeft: 0 };
    }
    return { attackId: 'sweep_2', comboLeft: playerBlocking ? 1 : 0 };
  }

  const r = rng();
  const avoidRepeatHeavy = e._soulsLastAttackId === 'overhead_crush' || e._soulsLastAttackId === 'thrust_lunge';

  if (playerBehind && dist <= 2.9) {
    return { attackId: 'slash_2', comboLeft: 1 };
  }
  if ((playerHealing || dist > 3.45) && !avoidRepeatHeavy && dist <= 5.4) {
    return { attackId: 'thrust_lunge', comboLeft: 0 };
  }
  if ((playerRollSpam || playerTurtleBlocking || playerPanicRolling || r < 0.24) && !avoidRepeatHeavy) {
    return { attackId: 'overhead_crush', comboLeft: 0 };
  }
  const links = r < 0.35 ? 0 : (r < 0.78 ? 1 : 2);
  return { attackId: 'slash_1', comboLeft: links };
}

function chooseComboFollowUp(e, profile, prevMeta, dist, relAngleRad, reads, rng) {
  if (!prevMeta || !Array.isArray(prevMeta.followUpIds) || prevMeta.followUpIds.length === 0) {
    return null;
  }
  if ((e.soulsComboLeft || 0) <= 0) return null;
  if (dist > (prevMeta.reach || 2.6) + 1.65) return null;
  if (Math.abs(relAngleRad) > 1.75) return null;

  const { playerBlocking, playerTurtleBlocking, playerPanicRolling, playerRollSpam } = reads;

  if (profile.id === 'iron_knight') {
    if (prevMeta.id === 'slash_1') {
      if ((playerPanicRolling || playerRollSpam) && dist <= 3.5 && rng() < 0.65) {
        return 'overhead_crush';
      }
      return 'slash_2';
    }
    if (prevMeta.id === 'slash_2') {
      if (playerPanicRolling || playerRollSpam || playerTurtleBlocking || (dist <= 3.25 && rng() < 0.42)) {
        return 'overhead_crush';
      }
      return null;
    }
  }

  if (profile.id === 'cursed_footman') {
    if (prevMeta.id === 'thrust_1') {
      if ((playerBlocking || playerTurtleBlocking) && dist <= 2.85 && rng() < 0.72) {
        return 'shield_bash';
      }
      return 'sweep_2';
    }
    if (prevMeta.id === 'sweep_2') {
      if ((playerBlocking || playerTurtleBlocking) && dist <= 2.95) {
        return 'shield_bash';
      }
      return null;
    }
  }

  return prevMeta.followUpIds[0];
}

function updateStrafeTimerAndWallBounce(e, profile, dt, tanX, tanZ, preferredFlankDir, rng) {
  e._soulsWallFlipCooldown = Math.max(0, (e._soulsWallFlipCooldown || 0) - dt);
  e.strafeTimer = (e.strafeTimer || 0) - dt;

  const radius = Number(e.radius) > 0 ? Number(e.radius) : 0.55;
  const sDir = e.strafeDir || 1;
  const probeX = (e.x || 0) + tanX * sDir * 0.65;
  const probeZ = (e.z || 0) + tanZ * sDir * 0.65;

  let hitWall = false;
  if (typeof CASTLE_LAYOUT.isInsideCastleWalkable === 'function') {
    hitWall = !CASTLE_LAYOUT.isInsideCastleWalkable(probeX, probeZ, radius + 0.12, {
      bossDoorState: 'closed',
      allowBossHall: false
    });
  } else {
    const maxX = getCorridorMaxX(e.z || 0, radius);
    hitWall = Math.abs(probeX) >= maxX - 0.1;
  }

  if (hitWall && e._soulsWallFlipCooldown <= 0) {
    e.strafeDir = -sDir;
    e.strafeTimer = randRange(profile.strafeSwitchMinSec, profile.strafeSwitchMaxSec, rng);
    e._soulsWallFlipCooldown = 0.55;
  } else if (preferredFlankDir !== 0 && e.strafeDir !== preferredFlankDir && e._soulsWallFlipCooldown <= 0) {
    // Only take preferredFlankDir if that side is NOT blocked by a wall (stops corridor wall ping-pong!)
    const fProbeX = (e.x || 0) + tanX * preferredFlankDir * 1.15;
    const fProbeZ = (e.z || 0) + tanZ * preferredFlankDir * 1.15;
    const flankHitsWall = typeof CASTLE_LAYOUT.isInsideCastleWalkable === 'function'
      ? !CASTLE_LAYOUT.isInsideCastleWalkable(fProbeX, fProbeZ, radius + 0.12, { bossDoorState: 'closed', allowBossHall: false })
      : Math.abs(fProbeX) >= getCorridorMaxX(e.z || 0, radius) - 0.1;
    if (!flankHitsWall) {
      e.strafeDir = preferredFlankDir;
      e.strafeTimer = randRange(profile.strafeSwitchMinSec * 0.8, profile.strafeSwitchMaxSec, rng);
      e._soulsWallFlipCooldown = 0.45;
    }
  } else if (e.strafeTimer <= 0) {
    e.strafeDir = -sDir;
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
  const reads = {
    playerHealing,
    playerBlocking: playerBlocking || e._soulsPlayerBlockMemory > 0.12,
    playerTurtleBlocking: effectiveBlockHold >= 1.1,
    playerPanicRolling: playerRollingNow || e._soulsPlayerRollMemory > 0,
    playerRollSpam: (e._soulsRollCount || 0) >= 2,
    playerBehind: relFacingToPlayer > 2.0
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
    const playerInBonfireSanctuary =
      !ctx.ignoreBonfireSafeZone &&
      isPlayerInBonfireSafeZone(px, pz, {
        bonfirePos: ctx.bonfirePos,
        bonfireSafeRadius: ctx.bonfireSafeRadius
      });

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
      // 2B. STANDARD SENTRY: strictly requires `hasWallLOS` so mobs NEVER aggro through stone walls!
      const aggroRange = Number(e.soulsAggroRange) > 0 ? Number(e.soulsAggroRange) : profile.aggroRange;
      if (autoWake && !playerInBonfireSanctuary && hasWallLOS && dist <= aggroRange) {
        e.soulsAwake = true;
        e._patrolPhase = 'idle';
        e.aiState = dist > (e.preferredDist || profile.preferredDist) + 0.5 ? 'approach' : 'circle';
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

  // -------------------------------------------------------------------------
  // 3. STUNNED / STAGGER KNEEL / RIPOSTE VICTIM / PARRY / POISE MICROSTUN
  // -------------------------------------------------------------------------
  const isRiposteVictim = e.soulsState === 'riposte_victim';
  const isKneelOrRecover = e.soulsState === 'stagger_kneel' || e.soulsState === 'stagger_recover' || isRiposteVictim;
  const isStunned = isKneelOrRecover || (e.stunTimer || 0) > 0 || (e.staggeredTimer || 0) > 0;
  if (isStunned) {
    releaseSoulsAttackToken(e);
    e.aiState = 'stunned';
    e.currentAttackMeta = null;
    e._soulsTrackingLocked = false;
    e._soulsStepEndRawSpeed = 0;
    e._velX = 0;
    e._velZ = 0;
    out.desiredFacing = isRiposteVictim ? prevFacing : lerpAngle(prevFacing, angToPlayer, dt * 1.2);
    out.turnDelta = normalizeAngle(out.desiredFacing - prevFacing);
    const openT = Math.max(e.stunTimer || 0, e.staggeredTimer || 0, e.parriedRiposteTimer || 0, e.punishWindowTimer || 0);
    e.punishWindowTimer = openT;
    out.inPunishWindow = !isRiposteVictim && (openT > 0 || isKneelOrRecover);
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

  const prevTimer = Number(e.soulsTimer) || 0;
  e.soulsTimer = Math.max(0, prevTimer - dt);

  let rawVx = 0;
  let rawVz = 0;
  let useInertialSmoothing = false;
  let suppressLocomotionBlend = false;

  const minMeleeGap = playerRadius + (Number(e.radius) || 0.55) + 0.52;
  const maxMeleeTokens = Number(ctx.maxConcurrentAttackers ?? SOULS_PACK_CFG.maxMeleeTokens);
  const maxRangedTokens = Number(ctx.maxConcurrentRanged ?? SOULS_PACK_CFG.maxRangedTokens);

  // -------------------------------------------------------------------------
  // 4. STATE: WINDUP (Tapered 65–68% Cutoff + Single-Scaled C1 Step-In + 0 Red Circles)
  // -------------------------------------------------------------------------
  if (e.soulsState === 'windup' || e.aiState === 'windup') {
    suppressLocomotionBlend = true;
    refreshAttackToken(e, profile.isRanged, angleFromPlayer);

    const meta = e.currentAttackMeta || Object.values(e.attackMetas || profile.attackMetas)[0];
    const windupDur = Math.max(0.08, Number(meta?.windup) || 0.66);
    const cutoff01 = clamp(Number(meta?.trackingCutoff01) || 0.66, 0.3, 0.85);

    e._soulsAttackElapsed = (e._soulsAttackElapsed || 0) + dt;
    const progress01 = clamp(e._soulsAttackElapsed / windupDur, 0, 1);

    out.attackAnimClip = meta?.attackAnimClip || null;
    out.combatPhase = 'windup';
    out.combatPhase01 = progress01;

    if (progress01 <= cutoff01) {
      let targetAimAng = angToPlayer;
      if (meta?.isRanged && (Math.abs(pvx) > 0.05 || Math.abs(pvz) > 0.05)) {
        const projSpd = Math.max(8, Number(meta.projectileSpeed) || 18);
        const leadSec = clamp((dist / projSpd) * 0.55, 0, 0.28);
        const ldx = (px + pvx * leadSec) - (e.x || 0);
        const ldz = (pz + pvz * leadSec) - (e.z || 0);
        if (Math.hypot(ldx, ldz) > 0.1) {
          targetAimAng = Math.atan2(ldx, ldz);
        }
      }
      const taperStart = cutoff01 * 0.72;
      const taperFactor = progress01 <= taperStart
        ? 1.0
        : 1.0 - smoothstep01((progress01 - taperStart) / Math.max(0.05, cutoff01 - taperStart));
      out.desiredFacing = lerpAngle(prevFacing, targetAimAng, dt * profile.trackingTurnRate * Math.max(0.12, taperFactor));
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

    const lungeSpd = (Number(meta?.lungeSpeed) || 0) * 0.55;
    const stepStart = Math.max(0.55, Number(meta?.stepStart01) || 0.55);
    const stepPeak = Number(meta?.stepPeak01) || 0.90;
    const nearGateBack = lungeSpd < 0 && (e.z || 0) <= zDom.minZ + 1.35 && -e.soulsStrikeDirZ < 0;
    if (Math.abs(lungeSpd) > 0.01 && !nearGateBack && progress01 >= stepStart) {
      let curve;
      if (progress01 <= stepPeak) {
        curve = smoothstep01((progress01 - stepStart) / Math.max(0.05, stepPeak - stepStart));
      } else {
        const tailU = smoothstep01((progress01 - stepPeak) / Math.max(0.04, 1.0 - stepPeak));
        curve = 1.0 - 0.55 * tailU;
      }
      const rawStep = lungeSpd * curve * frostSlow;
      e._soulsStepEndRawSpeed = rawStep;
      const gapScale = lungeSpd > 0 ? clamp((dist - minMeleeGap) / 0.85, 0, 1) : 1.0;
      const effStep = rawStep * gapScale;
      rawVx = e.soulsStrikeDirX * effStep;
      rawVz = e.soulsStrikeDirZ * effStep;
    } else {
      // Planted windup feet: kill pre-step coasting promptly so boots never skate before the lunge!
      const plantDecay = Math.exp(-28 * dt);
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
        const recDur = Math.max(0.36, Number(meta?.recovery) || 0.65);
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
          Boolean(meta?.postBackstep) ||
          (dist <= profile.postComboBackstepDist && rng() < profile.postComboBackstepChance);
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
      const archerCrowded = profile.isRanged && dist < (e.retreatDist || profile.retreatDist);

      if (pendingBackstep || archerCrowded) {
        startBackstep(e, profile, dirX, dirZ, tanX, tanZ, zDom, pendingBackstep);
      } else {
        e.aiState = dist > (e.preferredDist || profile.preferredDist) + 0.5 ? 'approach' : 'circle';
        e.soulsState = 'stalk';
        e.soulsTimer = randRange(profile.neutralDecisionMinSec, profile.neutralDecisionMaxSec, rng);
      }
    }

  // -------------------------------------------------------------------------
  // 7. STATE: BACKSTEP
  // -------------------------------------------------------------------------
  } else if (e.aiState === 'backstep') {
    releaseSoulsAttackToken(e);
    e._soulsBackstepTimer = Math.max(0, (e._soulsBackstepTimer || 0) - dt);
    out.desiredFacing = lerpAngle(prevFacing, angToPlayer, dt * 6.8);
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
      e.aiState = dist > (e.preferredDist || profile.preferredDist) + 0.5 ? 'approach' : 'circle';
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

    // Check if mob needs to thread an archway doorway (`getCastleDoorwaySteerTarget`)
    // instead of walking straight into a dividing stone wall!
    const doorwaySteer = resolveDoorwaySteerTarget(e.x || 0, e.z || 0, px, pz, ctx);
    out.viaDoorway = Boolean(doorwaySteer.viaDoorway);

    if (doorwaySteer.viaDoorway) {
      e.aiState = 'approach';
      e._soulsAssessTimer = 0;
      const sdx = doorwaySteer.x - (e.x || 0);
      const sdz = doorwaySteer.z - (e.z || 0);
      const sLen = Math.hypot(sdx, sdz) || 1;
      const steerAng = Math.atan2(sdx, sdz);
      out.desiredFacing = lerpAngle(prevFacing, steerAng, dt * 7.2);
      rawVx = (sdx / sLen) * baseSpeed * 0.96 + pack.sepX * 0.35;
      rawVz = (sdz / sLen) * baseSpeed * 0.96 + pack.sepZ * 0.35;
    } else {
      out.desiredFacing = lerpAngle(prevFacing, angToPlayer, dt * 6.4);
      updateStrafeTimerAndWallBounce(e, profile, dt, tanX, tanZ, pack.preferredFlankDir, rng);

      e._soulsSpacingBiasTimer = (e._soulsSpacingBiasTimer || 0) - dt;
      if (e._soulsSpacingBiasTimer <= 0) {
        e._soulsSpacingBias = randRange(-0.28, 0.28, rng);
        e._soulsSpacingBiasTimer = randRange(1.2, 2.2, rng);
      }

      const sBlend = Number.isFinite(e._strafeBlend) ? e._strafeBlend : (e.strafeDir || 1);
      const retreatDist = e.retreatDist || profile.retreatDist;
      const hasLOS = ctx.hasLineOfSight !== false && hasWallLOS;

      // Check if player retreated into the Flame-Trap Gauntlet beyond this mob's allowed Z boundary
      const playerInFlameTraps =
        (!zDom.isSouthOfTraps && pz > zDom.maxZ + 0.5 && (e.z || 0) >= zDom.maxZ - 0.85) ||
        (zDom.isSouthOfTraps && pz < zDom.minZ - 0.5 && (e.z || 0) <= zDom.minZ + 0.85);

      if (reads.playerHealing && hasLOS && !playerInFlameTraps && (e._soulsHealPunishCd || 0) <= 0) {
        const punishReach = profile.isRanged ? 14.5 : (e.preferredDist || profile.preferredDist) + 2.2;
        if (dist <= punishReach) {
          e._soulsAssessTimer = 0;
          e.soulsTimer = Math.min(e.soulsTimer, 0.04);
        }
      }

      if (profile.isRanged) {
        const prefDist = (e.preferredDist || profile.preferredDist) + e._soulsSpacingBias;
        if (!hasLOS) {
          e.aiState = 'flank';
          rawVx = tanX * sBlend * strafeSpeed * 1.15 + dirX * baseSpeed * 0.25;
          rawVz = tanZ * sBlend * strafeSpeed * 1.15 + dirZ * baseSpeed * 0.25;
        } else if (dist < retreatDist) {
          e.aiState = 'retreat';
          const urgency = dist < 3.6 ? 1.02 : 0.86;
          const nearNorthLimit = (e.z || 0) <= zDom.minZ + 1.45 && -dirZ < 0;
          const nearSouthLimit = (e.z || 0) >= zDom.maxZ - 1.45 && -dirZ > 0;
          if (nearNorthLimit || nearSouthLimit) {
            rawVx = tanX * sBlend * strafeSpeed * 1.1 - dirX * baseSpeed * 0.32;
            rawVz = tanZ * sBlend * strafeSpeed * 0.55;
          } else {
            rawVx = -dirX * baseSpeed * urgency + tanX * sBlend * strafeSpeed * 0.6;
            rawVz = -dirZ * baseSpeed * urgency + tanZ * sBlend * strafeSpeed * 0.6;
          }
        } else if (dist > prefDist + 1.1 && !playerInFlameTraps) {
          e.aiState = 'approach';
          rawVx = dirX * baseSpeed * profile.approachSpeedMult + tanX * sBlend * strafeSpeed * 0.28;
          rawVz = dirZ * baseSpeed * profile.approachSpeedMult + tanZ * sBlend * strafeSpeed * 0.28;
        } else {
          e.aiState = 'circle';
          const radialErr = playerInFlameTraps ? 0 : clamp((dist - prefDist) * 0.35, -0.4, 0.4);
          rawVx = dirX * baseSpeed * radialErr + tanX * sBlend * strafeSpeed * 0.72;
          rawVz = dirZ * baseSpeed * radialErr + tanZ * sBlend * strafeSpeed * 0.72;
        }

        rawVx += pack.sepX;
        rawVz += pack.sepZ;

        if (hasLOS && e.soulsTimer <= 0 && dist <= 14.8) {
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
      } else {
        const waitingForSlot = _meleeTokenHolders.size >= maxMeleeTokens && !_meleeTokenHolders.has(getMobTokenId(e));
        const flankRingBonus = waitingForSlot ? 1.05 : 0;
        const prefDist = (e.preferredDist || profile.preferredDist) + e._soulsSpacingBias + flankRingBonus;

        e._soulsAssessTimer = Math.max(0, (e._soulsAssessTimer || 0) - dt);
        e._soulsAssessCooldown = Math.max(0, (e._soulsAssessCooldown || 0) - dt);

        const inSweetSpot = !waitingForSlot && dist >= retreatDist && dist <= prefDist + 0.55;
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
        } else if (e._soulsAssessTimer > 0 && inSweetSpot) {
          e.aiState = 'assess';
          rawVx = pack.sepX * 0.5;
          rawVz = pack.sepZ * 0.5;
        } else if (waitingForSlot && dist <= prefDist + 1.2) {
          e.aiState = 'flank';
          const radialErr = clamp((dist - prefDist) * 0.45, -0.42, 0.42);
          rawVx = dirX * baseSpeed * radialErr + tanX * sBlend * strafeSpeed * 0.98 + pack.sepX;
          rawVz = dirZ * baseSpeed * radialErr + tanZ * sBlend * strafeSpeed * 0.98 + pack.sepZ;
        } else if (dist > prefDist + 0.45) {
          e.aiState = 'approach';
          const weave = dist < 6.5 ? 0.3 : 0.18;
          rawVx = dirX * baseSpeed * profile.approachSpeedMult + tanX * sBlend * strafeSpeed * weave + pack.sepX;
          rawVz = dirZ * baseSpeed * profile.approachSpeedMult + tanZ * sBlend * strafeSpeed * weave + pack.sepZ;
        } else if (dist < retreatDist) {
          e.aiState = 'retreat';
          rawVx = -dirX * baseSpeed * 0.42 + tanX * sBlend * strafeSpeed * 0.8 + pack.sepX;
          rawVz = -dirZ * baseSpeed * 0.42 + tanZ * sBlend * strafeSpeed * 0.8 + pack.sepZ;
        } else {
          e.aiState = 'circle';
          const radialErr = clamp((dist - prefDist) * 0.45, -0.35, 0.38);
          rawVx = dirX * baseSpeed * radialErr + tanX * sBlend * strafeSpeed * 0.92 + pack.sepX;
          rawVz = dirZ * baseSpeed * radialErr + tanZ * sBlend * strafeSpeed * 0.92 + pack.sepZ;
        }

        const engageRange = (e.preferredDist || profile.preferredDist) +
          (reads.playerHealing ? 2.15 : (profile.id === 'iron_knight' ? 1.35 : 1.05));

        if (hasLOS && !playerInFlameTraps && e.aiState !== 'backstep' && e.soulsTimer <= 0 && dist <= engageRange) {
          if (tryAcquireAttackToken(e, false, angleFromPlayer, maxMeleeTokens, maxRangedTokens)) {
            if (reads.playerHealing) e._soulsHealPunishCd = 4.0;
            if (reads.playerRollSpam) e._soulsRollCount = 0;
            if (reads.playerTurtleBlocking) e._soulsBlockHoldTime = 0;
            e._soulsAssessTimer = 0;
            const pick = chooseInitialAttack(e, profile, dist, reads, zDom.minZ, rng);
            beginAttackWindup(e, profile, pick.attackId, dirX, dirZ, angToPlayer, pick.comboLeft, out, audio, playAudio);
            const plantD = Math.exp(-14 * dt);
            rawVx = (e._velX || 0) * plantD;
            rawVz = (e._velZ || 0) * plantD;
            useInertialSmoothing = false;
            suppressLocomotionBlend = true;
          } else {
            e.aiState = 'flank';
            e.soulsTimer = randRange(0.45, 0.78, rng);
          }
        }
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
