// Elden Ring Combat Damage Pipeline (AtkParam_Pc / 5-Piece Defense Curve / Pierce Counter)
// & Deterministic Swept Capsule Blade Hitboxes (30/60 FPS mobile-safe, zero tunneling).
// Pure zero-dependency Vanilla ES Module for Grimborne Hunters (Chapter 26: Abandoned Knight Rift).

function clamp(v, min, max) {
  return v < min ? min : (v > max ? max : v);
}

function normalizeAngle(rad) {
  let a = rad;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * Elden Ring 5-piece flat defense multiplier curve (exact datamined AtkParam_Pc formula).
 * Continuous across all 4 knots (x = 0.125, 1.0, 2.5, 8.0), bounded in [0.10, 0.90].
 *
 * @param {number} effAtk - Effective attack power (baseAR * motionValue).
 * @param {number} flatDef - Target flat defense.
 * @returns {number} Defense multiplier in [0.10, 0.90].
 */
export function computeEldenDefenseMult(effAtk, flatDef) {
  if (!Number.isFinite(flatDef) || flatDef <= 0.001) {
    return 0.90;
  }
  const safeAtk = Number.isFinite(effAtk) ? effAtk : 0;
  const x = safeAtk / flatDef;

  if (x < 0.125) {
    return 0.10;
  }
  if (x < 1.0) {
    const d = x - 0.125;
    return 0.10 + (19.2 / 49) * d * d;
  }
  if (x < 2.5) {
    const d = 2.5 - x;
    return 0.70 - (0.4 / 3) * d * d;
  }
  if (x < 8.0) {
    const d = 8.0 - x;
    return 0.90 - (0.8 / 121) * d * d;
  }
  return 0.90;
}

/**
 * Full Elden Ring damage pipeline:
 *   effAtk -> 5-piece flat defense (bypassed on Critical Riposte) ->
 *   multiplicative damage negations -> Pierce Counter (1.30x) ->
 *   punish & crit multipliers -> rounded integer >= 1.
 *
 * @param {object} [params]
 * @param {number} params.baseAR
 * @param {number} [params.motionValue=1.0]
 * @param {number} [params.flatDef=18]
 * @param {number[]} [params.negations=[]]
 * @param {boolean} [params.isPierce=false]
 * @param {boolean} [params.targetInAttackWindow=false]
 * @param {number} [params.punishMult=1.0]
 * @param {number} [params.critMult=1.0]
 * @param {boolean} [params.bypassFlatDef=false]
 * @returns {{
 *   finalDamage: number,
 *   effAtk: number,
 *   defMult: number,
 *   negMult: number,
 *   counterMult: number,
 *   isPierceCounter: boolean
 * }}
 */
export function computeSoulsDamage({
  baseAR,
  motionValue = 1.0,
  flatDef = 18,
  negations = [],
  isPierce = false,
  targetInAttackWindow = false,
  punishMult = 1.0,
  critMult = 1.0,
  bypassFlatDef = false
} = {}) {
  const safeAR = Number.isFinite(baseAR) ? baseAR : 0;
  const safeMV = Number.isFinite(motionValue) ? motionValue : 1.0;
  const effAtk = Math.max(1, safeAR * safeMV);

  const defMult = bypassFlatDef ? 1.0 : computeEldenDefenseMult(effAtk, flatDef);

  const negList = Array.isArray(negations)
    ? negations
    : (Number.isFinite(negations) ? [negations] : []);
  const negMult = negList.reduce((acc, n) => {
    const safeN = Number.isFinite(n) ? n : 0;
    return acc * (1 - clamp(safeN, -1, 0.95));
  }, 1.0);

  const counterMult = (isPierce && targetInAttackWindow) ? 1.30 : 1.0;
  const safePunish = Number.isFinite(punishMult) ? Math.max(0, punishMult) : 1.0;
  const safeCrit = Number.isFinite(critMult) ? Math.max(0, critMult) : 1.0;

  const finalDamage = Math.max(
    1,
    Math.round(effAtk * defMult * negMult * counterMult * safePunish * safeCrit)
  );

  return {
    finalDamage,
    effAtk,
    defMult,
    negMult,
    counterMult,
    isPierceCounter: counterMult > 1
  };
}

/**
 * 1H Straight Sword (Warrior baseline) Motion Values & TAE event timings (seconds).
 * Calibrated to Elden Ring frame data: tangible windup coil, crisp active whip,
 * weighted follow-through overshoot, and real animation commitment before roll/chain cancel!
 */
export const SOULS_ATTACK_SPECS = Object.freeze({
  r1_1: Object.freeze({
    startup: 0.26,
    active: 0.165,
    recovery: 0.42,
    cancelChainAt: 0.52,
    cancelRollAt: 0.50,
    cancelBlockAt: 0.52,
    trackingCutoff01: 0.70,
    mv: 1.00,
    stanceDmg: 8,
    stamina: 12,
    hitstop: 0.058,
    lungeDist: 0.68
  }),
  r1_2: Object.freeze({
    startup: 0.26,
    active: 0.165,
    recovery: 0.44,
    cancelChainAt: 0.54,
    cancelRollAt: 0.52,
    cancelBlockAt: 0.54,
    trackingCutoff01: 0.70,
    mv: 1.06,
    stanceDmg: 9,
    stamina: 12,
    hitstop: 0.062,
    lungeDist: 0.80
  }),
  r1_3: Object.freeze({
    startup: 0.36,
    active: 0.185,
    recovery: 0.54,
    cancelChainAt: 0.92,
    cancelRollAt: 0.70,
    cancelBlockAt: 0.72,
    trackingCutoff01: 0.66,
    mv: 1.32,
    stanceDmg: 20,
    stamina: 17,
    hitstop: 0.086,
    lungeDist: 0.92,
    hyperarmor: true
  }),
  r2: Object.freeze({
    startup: 0.38,
    active: 0.180,
    recovery: 0.50,
    cancelChainAt: 0.82,
    cancelRollAt: 0.68,
    cancelBlockAt: 0.70,
    trackingCutoff01: 0.68,
    mv: 1.44,
    stanceDmg: 20,
    stamina: 20,
    hitstop: 0.088,
    lungeDist: 1.10,
    hyperarmor: true
  }),
  charged_r2: Object.freeze({
    startup: 0.66,
    active: 0.195,
    recovery: 0.56,
    cancelChainAt: 1.04,
    cancelRollAt: 0.92,
    cancelBlockAt: 0.94,
    trackingCutoff01: 0.66,
    mv: 1.82,
    stanceDmg: 34,
    stamina: 28,
    hitstop: 0.110,
    lungeDist: 1.36,
    hyperarmor: true
  }),
  rolling_r1: Object.freeze({
    startup: 0.22,
    active: 0.150,
    recovery: 0.38,
    cancelChainAt: 0.48,
    cancelRollAt: 0.46,
    cancelBlockAt: 0.48,
    trackingCutoff01: 0.72,
    mv: 0.98,
    stanceDmg: 8,
    stamina: 14,
    hitstop: 0.054,
    lungeDist: 0.74,
    isPierce: true
  }),
  guard_counter: Object.freeze({
    startup: 0.28,
    active: 0.170,
    recovery: 0.45,
    cancelChainAt: 0.62,
    cancelRollAt: 0.56,
    cancelBlockAt: 0.58,
    trackingCutoff01: 0.74,
    mv: 1.40,
    stanceDmg: 32,
    stamina: 18,
    hitstop: 0.096,
    lungeDist: 1.00,
    hyperarmor: true
  })
});

export const SOULS_WEAPON_WEIGHT_PROFILES = Object.freeze({
  club: Object.freeze({ timeMult: 1.00, lungeMult: 1.00, staminaMult: 1.00, stanceMult: 1.00, hitstopMult: 1.00 }),
  spear: Object.freeze({ timeMult: 1.09, lungeMult: 1.22, staminaMult: 1.12, stanceMult: 1.15, hitstopMult: 1.10, forcePierce: true }),
  cleaver: Object.freeze({ timeMult: 1.12, lungeMult: 1.10, staminaMult: 1.15, stanceMult: 1.22, hitstopMult: 1.15 }),
  axe: Object.freeze({ timeMult: 1.16, lungeMult: 1.06, staminaMult: 1.20, stanceMult: 1.35, hitstopMult: 1.20 }),
  flail: Object.freeze({ timeMult: 1.18, lungeMult: 1.08, staminaMult: 1.22, stanceMult: 1.38, hitstopMult: 1.22 }),
  zweihander: Object.freeze({ timeMult: 1.28, lungeMult: 1.16, staminaMult: 1.35, stanceMult: 1.65, hitstopMult: 1.35, hyperarmorHeavy: true }),
  boss_hammer: Object.freeze({ timeMult: 1.36, lungeMult: 1.12, staminaMult: 1.45, stanceMult: 1.85, hitstopMult: 1.45, hyperarmorHeavy: true })
});

const _scaledSpecCache = new Map();

/**
 * Safe lookup helper for SOULS_ATTACK_SPECS with zero-alloc weapon-class weight scaling.
 *
 * @param {string} attackKey
 * @param {string|null} [weaponId=null]
 * @returns {object}
 */
export function getSoulsAttackSpec(attackKey, weaponId = null) {
  const safeKey = attackKey && SOULS_ATTACK_SPECS[attackKey] ? attackKey : 'r1_1';
  const base = SOULS_ATTACK_SPECS[safeKey];
  if (!weaponId || weaponId === 'club' || !SOULS_WEAPON_WEIGHT_PROFILES[weaponId]) {
    return base;
  }
  const cacheKey = `${weaponId}:${safeKey}`;
  const cached = _scaledSpecCache.get(cacheKey);
  if (cached) return cached;

  const wp = SOULS_WEAPON_WEIGHT_PROFILES[weaponId];
  const tm = wp.timeMult || 1.0;
  const scaled = Object.freeze({
    ...base,
    startup: +(base.startup * tm).toFixed(3),
    active: +(base.active * (1 + (tm - 1) * 0.55)).toFixed(3),
    recovery: +(base.recovery * tm).toFixed(3),
    cancelChainAt: +(base.cancelChainAt * tm).toFixed(3),
    cancelRollAt: +(base.cancelRollAt * tm).toFixed(3),
    cancelBlockAt: +(base.cancelBlockAt * tm).toFixed(3),
    stanceDmg: Math.round(base.stanceDmg * (wp.stanceMult || 1.0)),
    stamina: Math.round(base.stamina * (wp.staminaMult || 1.0)),
    hitstop: +(base.hitstop * (wp.hitstopMult || 1.0)).toFixed(3),
    lungeDist: +(base.lungeDist * (wp.lungeMult || 1.0)).toFixed(3),
    isPierce: Boolean(base.isPierce || wp.forcePierce),
    hyperarmor: Boolean(base.hyperarmor || (wp.hyperarmorHeavy && safeKey !== 'rolling_r1'))
  });
  _scaledSpecCache.set(cacheKey, scaled);
  return scaled;
}

/**
 * Squared 2D XZ distance from point (px, pz) to line segment (ax, az) -> (bx, bz).
 *
 * @param {number} px
 * @param {number} pz
 * @param {number} ax
 * @param {number} az
 * @param {number} bx
 * @param {number} bz
 * @returns {number}
 */
export function pointToSegmentDistSqXZ(px, pz, ax, az, bx, bz) {
  const abx = bx - ax;
  const abz = bz - az;
  const lenSq = abx * abx + abz * abz;
  if (lenSq <= 1e-10) {
    const dx = px - ax;
    const dz = pz - az;
    return dx * dx + dz * dz;
  }
  const t = clamp(((px - ax) * abx + (pz - az) * abz) / lenSq, 0, 1);
  const cx = ax + abx * t;
  const cz = az + abz * t;
  const dx = px - cx;
  const dz = pz - cz;
  return dx * dx + dz * dz;
}

function extractSegmentXZ(seg) {
  if (!seg || typeof seg !== 'object') return null;

  if (seg.hilt && seg.tip) {
    const hx = seg.hilt.x;
    const hz = seg.hilt.z;
    const tx = seg.tip.x;
    const tz = seg.tip.z;
    if (Number.isFinite(hx) && Number.isFinite(hz) && Number.isFinite(tx) && Number.isFinite(tz)) {
      return { hx, hz, tx, tz };
    }
  }
  if (
    Number.isFinite(seg.hiltX) && Number.isFinite(seg.hiltZ) &&
    Number.isFinite(seg.tipX) && Number.isFinite(seg.tipZ)
  ) {
    return { hx: seg.hiltX, hz: seg.hiltZ, tx: seg.tipX, tz: seg.tipZ };
  }
  if (seg.start && seg.end) {
    const hx = seg.start.x;
    const hz = seg.start.z;
    const tx = seg.end.x;
    const tz = seg.end.z;
    if (Number.isFinite(hx) && Number.isFinite(hz) && Number.isFinite(tx) && Number.isFinite(tz)) {
      return { hx, hz, tx, tz };
    }
  }
  if (seg.a && seg.b) {
    const hx = seg.a.x;
    const hz = seg.a.z;
    const tx = seg.b.x;
    const tz = seg.b.z;
    if (Number.isFinite(hx) && Number.isFinite(hz) && Number.isFinite(tx) && Number.isFinite(tz)) {
      return { hx, hz, tx, tz };
    }
  }
  if (
    Number.isFinite(seg.x0) && Number.isFinite(seg.z0) &&
    Number.isFinite(seg.x1) && Number.isFinite(seg.z1)
  ) {
    return { hx: seg.x0, hz: seg.z0, tx: seg.x1, tz: seg.z1 };
  }
  return null;
}

/**
 * Active Swept Capsule blade hitbox with per-swing UID deduplication.
 *
 * - When `curSeg` is provided, linearly interpolates blade segment (hilt -> tip) from `prevSeg`
 *   to `curSeg` across at least `subSteps` (automatically scaled up when blade sweep displacement
 *   exceeds capsule radius, guaranteeing 0 tunneling even for thin blades at 30 FPS).
 * - When `curSeg` is omitted, falls back to an exact 2D XZ circle-vs-sector swept arc test
 *   centered at (`fallbackOriginX`, `fallbackOriginZ`) around `strikeAngle` with `range` & `coneHalfRad`.
 * - Skips enemies already in `hitUids`, records newly hit enemy UIDs into `hitUids`
 *   (strictly 1 damage tick per swing), and returns the array of newly hit enemies.
 *
 * @param {object} [params]
 * @param {object|null} [params.prevSeg]
 * @param {object|null} [params.curSeg]
 * @param {number} [params.radius=0.42]
 * @param {number} [params.fallbackOriginX=0]
 * @param {number} [params.fallbackOriginZ=0]
 * @param {number} [params.strikeAngle=0]
 * @param {number} [params.range=2.1]
 * @param {number} [params.coneHalfRad=1.18]
 * @param {Array<object>} [params.enemies=[]]
 * @param {Set<*>} [params.hitUids]
 * @param {number} [params.subSteps=3]
 * @returns {Array<object>} Newly hit enemy objects (ordered by earliest sweep contact).
 */
export function testSweptBladeHits({
  prevSeg = null,
  curSeg = null,
  radius = 0.42,
  fallbackOriginX = 0,
  fallbackOriginZ = 0,
  strikeAngle = 0,
  range = 2.1,
  coneHalfRad = Math.PI * 0.38,
  enemies = [],
  hitUids = null,
  subSteps = 3
} = {}) {
  if (!Array.isArray(enemies) || enemies.length === 0) {
    return [];
  }

  const seenUids = hitUids instanceof Set ? hitUids : new Set();
  const safeRadius = Number.isFinite(radius) ? Math.max(0, radius) : 0.42;
  const baseSubSteps = Number.isFinite(subSteps) ? Math.max(1, Math.round(subSteps)) : 3;

  const cSeg = extractSegmentXZ(curSeg);
  const scoredHits = [];

  if (cSeg) {
    const pSeg = extractSegmentXZ(prevSeg) || cSeg;
    const dhx = cSeg.hx - pSeg.hx;
    const dhz = cSeg.hz - pSeg.hz;
    const v0x = pSeg.tx - pSeg.hx;
    const v0z = pSeg.tz - pSeg.hz;
    const v1x = cSeg.tx - cSeg.hx;
    const v1z = cSeg.tz - cSeg.hz;

    const len0 = Math.hypot(v0x, v0z);
    const len1 = Math.hypot(v1x, v1z);
    const maxLen = Math.max(len0, len1);
    const usePolarSweep = len0 > 1e-6 && len1 > 1e-6;

    const ang0 = usePolarSweep ? Math.atan2(v0x, v0z) : 0;
    const dAng = usePolarSweep ? normalizeAngle(Math.atan2(v1x, v1z) - ang0) : 0;
    const dLen = len1 - len0;
    const dtx = cSeg.tx - pSeg.tx;
    const dtz = cSeg.tz - pSeg.tz;

    const hiltTravel = Math.hypot(dhx, dhz);
    const tipTravel = usePolarSweep
      ? hiltTravel + Math.abs(dAng) * maxLen + Math.abs(dLen)
      : Math.hypot(dtx, dtz);
    const maxTravel = Math.max(hiltTravel, tipTravel);

    // Broadphase AABB accounts for full rigid-body arc radius around the hilt path
    const segMinX = usePolarSweep
      ? Math.min(pSeg.hx, cSeg.hx) - maxLen
      : Math.min(pSeg.hx, pSeg.tx, cSeg.hx, cSeg.tx);
    const segMaxX = usePolarSweep
      ? Math.max(pSeg.hx, cSeg.hx) + maxLen
      : Math.max(pSeg.hx, pSeg.tx, cSeg.hx, cSeg.tx);
    const segMinZ = usePolarSweep
      ? Math.min(pSeg.hz, cSeg.hz) - maxLen
      : Math.min(pSeg.hz, pSeg.tz, cSeg.hz, cSeg.tz);
    const segMaxZ = usePolarSweep
      ? Math.max(pSeg.hz, cSeg.hz) + maxLen
      : Math.max(pSeg.hz, pSeg.tz, cSeg.hz, cSeg.tz);

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e) continue;
      if ((Number.isFinite(e.hp) && e.hp <= 0) || e.dead === true || e.alive === false) continue;

      const uid = e.uid !== undefined ? e.uid : (e.id !== undefined ? e.id : e);
      if (seenUids.has(uid)) continue;

      const ex = e.x;
      const ez = e.z;
      if (!Number.isFinite(ex) || !Number.isFinite(ez)) continue;

      const er = Number.isFinite(e.radius) ? Math.max(0, e.radius) : 0.45;
      const hitR = er + safeRadius;

      if (
        ex < segMinX - hitR || ex > segMaxX + hitR ||
        ez < segMinZ - hitR || ez > segMaxZ + hitR
      ) {
        continue;
      }

      const hitRSq = hitR * hitR;
      let hitT = -1;

      if (maxTravel <= 1e-6) {
        if (pointToSegmentDistSqXZ(ex, ez, cSeg.hx, cSeg.hz, cSeg.tx, cSeg.tz) <= hitRSq) {
          hitT = 0;
        }
      } else {
        // Adaptive sub-stepping guarantees arc spacing <= 0.75 * hitR (0 tunneling at 30 FPS)
        const adaptiveSteps = hitR > 1e-4 ? Math.ceil(maxTravel / (hitR * 0.75)) : 64;
        const steps = clamp(Math.max(baseSubSteps, adaptiveSteps), 1, 64);

        for (let s = 0; s <= steps; s++) {
          const u = s / steps;
          const hx = pSeg.hx + dhx * u;
          const hz = pSeg.hz + dhz * u;
          let tx;
          let tz;
          if (usePolarSweep) {
            const curAng = ang0 + dAng * u;
            const curLen = len0 + dLen * u;
            tx = hx + Math.sin(curAng) * curLen;
            tz = hz + Math.cos(curAng) * curLen;
          } else {
            tx = pSeg.tx + dtx * u;
            tz = pSeg.tz + dtz * u;
          }
          if (pointToSegmentDistSqXZ(ex, ez, hx, hz, tx, tz) <= hitRSq) {
            hitT = u;
            break;
          }
        }
      }

      if (hitT >= 0) {
        seenUids.add(uid);
        const distFromHiltSq = (ex - cSeg.hx) * (ex - cSeg.hx) + (ez - cSeg.hz) * (ez - cSeg.hz);
        scoredHits.push({ enemy: e, orderA: hitT, orderB: distFromHiltSq });
      }
    }
  } else {
    // Pure swept-arc fallback around strikeAngle (Grimborne XZ convention: fwd = (sin(a), cos(a)))
    const ox = Number.isFinite(fallbackOriginX) ? fallbackOriginX : 0;
    const oz = Number.isFinite(fallbackOriginZ) ? fallbackOriginZ : 0;
    const effAngle = Number.isFinite(strikeAngle) ? strikeAngle : 0;
    const effRange = Number.isFinite(range) && range > 0 ? range : 2.1;
    const effConeHalf = Number.isFinite(coneHalfRad) && coneHalfRad >= 0 ? coneHalfRad : Math.PI * 0.38;

    const leftAng = effAngle - effConeHalf;
    const rightAng = effAngle + effConeHalf;
    const leftEndX = ox + Math.sin(leftAng) * effRange;
    const leftEndZ = oz + Math.cos(leftAng) * effRange;
    const rightEndX = ox + Math.sin(rightAng) * effRange;
    const rightEndZ = oz + Math.cos(rightAng) * effRange;

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e) continue;
      if ((Number.isFinite(e.hp) && e.hp <= 0) || e.dead === true || e.alive === false) continue;

      const uid = e.uid !== undefined ? e.uid : (e.id !== undefined ? e.id : e);
      if (seenUids.has(uid)) continue;

      const ex = e.x;
      const ez = e.z;
      if (!Number.isFinite(ex) || !Number.isFinite(ez)) continue;

      const er = Number.isFinite(e.radius) ? Math.max(0, e.radius) : 0.45;
      const dx = ex - ox;
      const dz = ez - oz;
      const dist = Math.hypot(dx, dz);
      const maxReach = effRange + er;
      if (dist > maxReach) continue;

      let hit = false;
      const relAng = dist > 1e-6 ? normalizeAngle(Math.atan2(dx, dz) - effAngle) : 0;
      const absRelAng = Math.abs(relAng);

      if (absRelAng <= effConeHalf || dist <= er) {
        hit = true;
      } else {
        // Exact circle-vs-sector boundary ray check
        const erSq = er * er;
        const dLeftSq = pointToSegmentDistSqXZ(ex, ez, ox, oz, leftEndX, leftEndZ);
        const dRightSq = pointToSegmentDistSqXZ(ex, ez, ox, oz, rightEndX, rightEndZ);
        if (dLeftSq <= erSq || dRightSq <= erSq) {
          hit = true;
        }
      }

      if (hit) {
        seenUids.add(uid);
        scoredHits.push({ enemy: e, orderA: absRelAng, orderB: dist });
      }
    }
  }

  if (scoredHits.length > 1) {
    scoredHits.sort((a, b) => (a.orderA - b.orderA) || (a.orderB - b.orderB));
  }

  const result = new Array(scoredHits.length);
  for (let i = 0; i < scoredHits.length; i++) {
    result[i] = scoredHits[i].enemy;
  }
  return result;
}
