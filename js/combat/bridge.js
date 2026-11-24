// Pure combat math, adaptive World/VFX/Model bridges, and obstacle collision resolver.
// Extracted from js/combat.js (Stage 3 Wave 1 modular split).
import * as THREE from '../../vendor/three.module.js';
import {
  ARENA_HALF_SIZE,
  CLASSES,
  ENEMY_TYPES
} from '../config.js?v=20261124z93';

export const TWO_PI = Math.PI * 2;
// Keep the player just inside the decorative fence ring (HALF_SIZE - 1.6).
export const ARENA_PLAYER_LIMIT = ARENA_HALF_SIZE - 2.6;
export const ARENA_ENTITY_LIMIT = ARENA_HALF_SIZE - 2.8;
export const MAX_ACTIVE_ENEMIES = 52;
export const COS_75_DEG = Math.cos((75 * Math.PI) / 180); // ~0.2588 for ±75° Shieldbearer front arc

export function clamp(val, min, max) {
  return val < min ? min : val > max ? max : val;
}

export function normalizeAngle(angle) {
  let a = angle;
  while (a > Math.PI) a -= TWO_PI;
  while (a < -Math.PI) a += TWO_PI;
  return a;
}

export function lerpAngle(current, target, t) {
  const diff = normalizeAngle(target - current);
  return current + diff * clamp(t, 0, 1);
}

export function resolveArenaBiomeForLevel(levelNumber) {
  const lvl = Number(levelNumber) || 1;
  if (lvl === 26) return 'souls_citadel';
  if (lvl >= 21) return 'ash_citadel';
  if (lvl >= 16) return 'frost_ruins';
  if (lvl >= 6) return 'misty_forest';
  return 'courtyard';
}

// Inspects function signature once to adapt seamlessly to positional or options-object APIs
export function inspectSignature(fn) {
  if (typeof fn !== 'function') return { valid: false, isObject: false, params: [] };
  const src = Function.prototype.toString.call(fn);
  const openIdx = src.indexOf('(');
  if (openIdx === -1) return { valid: true, isObject: false, params: [] };

  let depth = 0;
  let closeIdx = -1;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) {
        closeIdx = i;
        break;
      }
    }
  }

  const raw = closeIdx > openIdx ? src.slice(openIdx + 1, closeIdx).trim() : '';
  if (!raw) return { valid: true, isObject: false, params: [] };
  if (raw.startsWith('{')) return { valid: true, isObject: true, params: ['{'] };

  const params = [];
  let cur = '';
  let nested = 0;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '(' || ch === '{' || ch === '[') nested++;
    else if (ch === ')' || ch === '}' || ch === ']') nested--;

    if (ch === ',' && nested === 0) {
      params.push(cur.trim().split('=')[0].replace(/^\.\.\./, '').trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) {
    params.push(cur.trim().split('=')[0].replace(/^\.\.\./, '').trim());
  }

  const first = params[0] || '';
  const isObject = /^(opts|options|cfg|config|params|spec|args|data|\{)/i.test(first);
  return { valid: true, isObject, params };
}

export function getObj3D(handle) {
  if (!handle) return null;
  if (handle.isObject3D) return handle;
  return handle.mesh || handle.group || handle.root || handle.object3d || null;
}

export function createCombatBridge({ world, models, progression } = {}) {
  // Shared fallback geometries & materials (allocated once, reused forever)
  const sharedProjGeo = new THREE.SphereGeometry(0.20, 8, 8);
  const sharedOrbGeo = new THREE.OctahedronGeometry(0.28, 0);
  const sharedRingGeo = new THREE.RingGeometry(0.62, 0.88, 20);
  sharedRingGeo.rotateX(-Math.PI / 2);
  const sharedMiniCrateGeo = new THREE.BoxGeometry(0.42, 0.36, 0.42);

  const eliteMats = {
    purple: new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false
    }),
    blue: new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false
    }),
    warden: new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  };

  const projMaterialCache = new Map();
  function getProjMaterial(colorHex) {
    const key = Number(colorHex) || 0xfbbf24;
    let mat = projMaterialCache.get(key);
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({ color: key });
      projMaterialCache.set(key, mat);
    }
    return mat;
  }

  // Signature caches for world & models adapters
  const sigParticles = inspectSignature(world?.spawnParticles);
  const sigSlash = inspectSignature(world?.spawnSlashArc);
  const sigShockwave = inspectSignature(world?.spawnShockwaveRing);
  const sigDanger = inspectSignature(world?.spawnDangerZone);
  const sigProjVis = inspectSignature(world?.createProjectileVisual);

  const sigHeroMesh = inspectSignature(models?.createHeroMesh);
  const sigCompMesh = inspectSignature(models?.createCompanionMesh);
  const sigEnemyMesh = inspectSignature(models?.createEnemyMesh);
  const sigPickupMesh = inspectSignature(models?.createPickupMesh);

  // === Adaptive VFX & Model Helpers ===
  function emitParticles(x, y, z, color, count = 10, speed = 5.5, size = 0.16) {
    if (!world?.spawnParticles) return;
    if (sigParticles.isObject) {
      world.spawnParticles({ x, y, z, color, count, speed, size, life: 0.48 });
      return;
    }
    const p1 = (sigParticles.params[1] || '').toLowerCase();
    if (p1 === 'z') {
      world.spawnParticles(x, z, color, count, speed, size);
    } else {
      world.spawnParticles(x, y, z, color, count, speed, size);
    }
  }

  function emitSlashArc(x, z, angle, range, arcAngle, color = 0xfbbf24, opts = null) {
    if (!world?.spawnSlashArc) return;
    const duration = opts?.duration ?? 0.22;
    const y = opts?.y ?? 0.88;
    const sweepRad = opts?.sweepRad ?? 0;
    if (sigSlash.isObject) {
      world.spawnSlashArc({
        x,
        y,
        z,
        angle,
        facing: angle,
        yaw: angle,
        dir: angle,
        range,
        radius: range,
        arcAngle,
        arc: arcAngle,
        color,
        duration,
        sweepRad
      });
      return;
    }
    if (sigSlash.params.length > 0) {
      const args = sigSlash.params.map((name) => {
        const n = name.toLowerCase();
        if (n === 'x') return x;
        if (n === 'y') return y;
        if (n === 'z') return z;
        if (n.includes('arc') || n.includes('spread') || n.includes('cone')) return arcAngle;
        if (n.includes('ang') || n.includes('fac') || n.includes('yaw') || n.includes('dir') || n.includes('rot')) return angle;
        if (n.includes('ran') || n.includes('rad') || n.includes('len')) return range;
        if (n.includes('col')) return color;
        if (n.includes('dur') || n.includes('lif')) return duration;
        return undefined;
      });
      world.spawnSlashArc(...args);
    } else {
      world.spawnSlashArc(x, z, angle, range, arcAngle, color);
    }
  }

  function emitShockwave(x, z, radius, color = 0xfbbf24, duration = 0.36) {
    if (!world?.spawnShockwaveRing) return;
    if (sigShockwave.isObject) {
      world.spawnShockwaveRing({
        x,
        y: 0.1,
        z,
        radius,
        maxRadius: radius,
        color,
        duration
      });
      return;
    }
    if (sigShockwave.params.length > 0) {
      const args = sigShockwave.params.map((name) => {
        const n = name.toLowerCase();
        if (n === 'x') return x;
        if (n === 'y') return 0.1;
        if (n === 'z') return z;
        if (n.includes('rad') || n.includes('ran') || n.includes('siz')) return radius;
        if (n.includes('col')) return color;
        if (n.includes('dur') || n.includes('lif')) return duration;
        return undefined;
      });
      world.spawnShockwaveRing(...args);
    } else {
      world.spawnShockwaveRing(x, z, radius, color, duration);
    }
  }

  function emitTelegraphZone(x, z, radius = 2.0, duration = 0.65, color = 0xef4444) {
    if (world?.isSoulsArena?.()) return { cancel() {} };
    if (typeof world?.spawnTelegraphZone === 'function') {
      return world.spawnTelegraphZone({ x, z, radius, color, duration });
    }
    if (typeof world?.spawnShockwaveRing === 'function') {
      world.spawnShockwaveRing({ x, y: 0.06, z, radius, color, duration });
      return null;
    }
    emitDangerZone(x, z, radius, duration, color);
    return null;
  }

  function emitDangerZone(x, z, radius, duration = 1.1, color = 0x9333ea) {
    if (world?.isSoulsArena?.()) return;
    if (typeof world?.spawnTelegraphZone === 'function') {
      world.spawnTelegraphZone({ x, z, radius, color, duration });
      return;
    }
    if (!world?.spawnDangerZone) {
      if (typeof world?.spawnShockwaveRing === 'function') {
        world.spawnShockwaveRing({ x, y: 0.06, z, radius, color, duration });
      }
      return;
    }
    if (sigDanger.isObject) {
      world.spawnDangerZone({
        x,
        y: 0.06,
        z,
        radius,
        duration,
        delay: duration,
        color
      });
      return;
    }
    if (sigDanger.params.length > 0) {
      const args = sigDanger.params.map((name) => {
        const n = name.toLowerCase();
        if (n === 'x') return x;
        if (n === 'y') return 0.06;
        if (n === 'z') return z;
        if (n.includes('rad') || n.includes('ran') || n.includes('siz')) return radius;
        if (n.includes('dur') || n.includes('del') || n.includes('tim') || n.includes('lif')) return duration;
        if (n.includes('col')) return color;
        return undefined;
      });
      world.spawnDangerZone(...args);
    } else {
      world.spawnDangerZone(x, z, radius, duration, color);
    }
  }

  function makeProjectileVisual(kind, color, scale = 1.0) {
    let handle = null;
    const radius = 0.20 * scale;
    if (typeof world?.createProjectileVisual === 'function') {
      try {
        if (sigProjVis.isObject) {
          handle = world.createProjectileVisual({
            type: kind,
            kind,
            color,
            radius,
            size: radius,
            scale
          });
        } else {
          const p0 = (sigProjVis.params[0] || '').toLowerCase();
          if (p0.includes('col')) {
            handle = world.createProjectileVisual(color, radius, kind);
          } else {
            handle = world.createProjectileVisual(kind, color, radius);
          }
        }
      } catch {
        handle = null;
      }
    }

    let obj = getObj3D(handle);
    if (!obj) {
      const geo = kind === 'magic' ? sharedOrbGeo : sharedProjGeo;
      obj = new THREE.Mesh(geo, getProjMaterial(color));
      obj.scale.setScalar(scale);
      handle = obj;
    }
    if (world?.scene && !obj.parent) {
      world.scene.add(obj);
    }
    return { handle, obj };
  }

  function buildHeroModel(classId, weaponId) {
    let handle = null;
    const activeElem = progression?.getState?.()?.activeMageElement || 'fire';
    if (typeof models?.createHeroMesh === 'function') {
      handle = sigHeroMesh.isObject
        ? models.createHeroMesh({ classId, weaponId, mageElement: activeElem })
        : models.createHeroMesh(classId, weaponId, activeElem);
    }
    let obj = getObj3D(handle);
    if (!obj) {
      obj = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 1.1, 0.6),
        getProjMaterial(CLASSES[classId]?.colorPrimary || 0x8b2635)
      );
      body.position.y = 0.65;
      obj.add(body);
      handle = obj;
    }
    if (world?.scene && !obj.parent) {
      world.scene.add(obj);
    }
    // Restore weapon positions placed with the in-game K editor.
    try { world?.loadWeaponLayout?.(); } catch {}
    return { handle, obj, sigUpdate: inspectSignature(handle?.update) };
  }

  function buildCompanionModel(classId) {
    let handle = null;
    if (typeof models?.createCompanionMesh === 'function') {
      handle = sigCompMesh.isObject
        ? models.createCompanionMesh({ classId })
        : models.createCompanionMesh(classId);
    }
    let obj = getObj3D(handle);
    if (!obj) {
      obj = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.75, 0.5),
        getProjMaterial(0x38bdf8)
      );
      body.position.y = 0.5;
      obj.add(body);
      handle = obj;
    }
    if (world?.scene && !obj.parent) {
      world.scene.add(obj);
    }
    return { handle, obj, sigUpdate: inspectSignature(handle?.update) };
  }

  function buildEnemyModel(typeId, eliteType) {
    let handle = null;
    if (typeof models?.createEnemyMesh === 'function') {
      handle = sigEnemyMesh.isObject
        ? models.createEnemyMesh({
            type: typeId,
            id: typeId,
            enemyType: typeId,
            eliteType,
            variant: eliteType,
            isElite: Boolean(eliteType)
          })
        : models.createEnemyMesh(typeId, eliteType);
    }
    let obj = getObj3D(handle);
    if (!obj) {
      obj = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.75, 1.05, 0.65),
        getProjMaterial(ENEMY_TYPES[typeId]?.color || 0xd6d3d1)
      );
      body.position.y = 0.6;
      obj.add(body);
      handle = obj;
    }

    handle?.setElite?.(eliteType);
    obj.userData?.setElite?.(eliteType);

    if (world?.scene && !obj.parent) {
      world.scene.add(obj);
    }
    return { handle, obj, sigUpdate: inspectSignature(handle?.update) };
  }

  function buildPickupModel(pickupType, options = {}) {
    let handle = null;
    if (typeof models?.createPickupMesh === 'function') {
      handle = sigPickupMesh.isObject
        ? models.createPickupMesh({ type: pickupType, kind: pickupType, ...options })
        : models.createPickupMesh(pickupType, options);
    }
    let obj = getObj3D(handle);
    if (!obj) {
      const fallbackColors = {
        heart: 0xef4444,
        clover: 0x22c55e,
        supply_crate: 0xd97706,
        companion_crate: 0xa855f7,
        relic_weapon_crate: 0xfde047,
        explosive_barrel: 0xdc2626
      };
      const isCrate = pickupType.includes('crate') || pickupType === 'explosive_barrel';
      const geo = isCrate ? sharedMiniCrateGeo : sharedOrbGeo;
      obj = new THREE.Mesh(geo, getProjMaterial(fallbackColors[pickupType] || 0xfbbf24));
      if (isCrate) obj.scale.setScalar(pickupType === 'relic_weapon_crate' ? 2.2 : 1.7);
      handle = obj;
    }
    if (world?.scene && !obj.parent) {
      world.scene.add(obj);
    }
    return { handle, obj };
  }

  function removeSceneObject(obj, handle) {
    if (obj && obj.parent) {
      obj.parent.remove(obj);
    }
    if (handle && handle !== obj && typeof handle.dispose === 'function') {
      try {
        handle.dispose();
      } catch {
        // Ignore custom dispose errors
      }
    }
  }

  function syncFollowTarget(x, z, heroObj, dt = 0) {
    if (!world) return;
    if (typeof world.setFollowTarget === 'function') {
      world.setFollowTarget(heroObj || { x, y: 0, z });
    }
    if (typeof world.followTarget === 'function') {
      if (world.followTarget.length >= 2 || inspectSignature(world.followTarget).params.length >= 2) {
        world.followTarget(x, z, dt);
      } else {
        world.followTarget(heroObj || { x, y: 0, z, position: { x, y: 0, z } });
      }
    } else if (world.followTarget && typeof world.followTarget === 'object') {
      if (typeof world.followTarget.set === 'function') {
        world.followTarget.set(x, 0, z);
      } else {
        world.followTarget.x = x;
        world.followTarget.y = 0;
        world.followTarget.z = z;
      }
    }
  }

  function animateEntityModel(modelWrap, dt, moving, speedRatio, attacking, beastMode, elapsedTime, moveLocalX = 0, moveLocalZ = 1, isSprinting = false) {
    if (!modelWrap) return;
    const { handle, obj, sigUpdate } = modelWrap;
    const fn = handle?.update || obj?.userData?.update || handle?.animate;
    if (typeof fn === 'function') {
      const sig = sigUpdate?.valid ? sigUpdate : inspectSignature(fn);
      const p1 = (sig.params[1] || '').toLowerCase();
      const p2 = (sig.params[2] || '').toLowerCase();
      if (!sig.isObject && sig.params.length >= 4 && p2.includes('speed')) {
        fn.call(handle, dt, moving, speedRatio, elapsedTime, moveLocalX, moveLocalZ, isSprinting);
      } else if (!sig.isObject && (p1.includes('mov') || p1.includes('spd') || p1.includes('walk') || p1 === 'arg2')) {
        fn.call(handle, dt, moving, elapsedTime, attacking);
      } else if (!sig.isObject && p1.includes('elaps')) {
        fn.call(handle, dt, elapsedTime);
      } else {
        fn.call(handle, dt, {
          moving,
          isMoving: moving,
          speed: speedRatio,
          moveRatio: speedRatio,
          attacking,
          beastMode,
          elapsedTime,
          time: elapsedTime
        });
      }
      return;
    }
    if (obj) {
      if (moving) {
        obj.position.y = Math.abs(Math.sin(elapsedTime * 11.5)) * 0.14;
      } else {
        obj.position.y *= Math.max(0, 1 - dt * 12);
      }
    }
  }

  function triggerModelAttack(modelWrap, weaponType = null, attackDuration = 0, comboStep = 1) {
    if (!modelWrap) return;
    const { handle, obj } = modelWrap;
    if (typeof handle?.playAttackAnim === 'function') handle.playAttackAnim(weaponType, attackDuration, comboStep);
    else if (typeof handle?.triggerAttack === 'function') handle.triggerAttack(weaponType, attackDuration, comboStep);
    else if (typeof handle?.playAttack === 'function') handle.playAttack(weaponType, attackDuration, comboStep);
    else if (typeof handle?.attack === 'function') handle.attack(weaponType, attackDuration, comboStep);
    else if (typeof obj?.userData?.triggerAttack === 'function') obj.userData.triggerAttack(weaponType, attackDuration, comboStep);
  }

  function triggerModelHitFlash(modelWrap) {
    if (!modelWrap) return;
    const { handle, obj } = modelWrap;
    if (typeof handle?.flashHit === 'function') handle.flashHit();
    else if (typeof handle?.hitFlash === 'function') handle.hitFlash();
    else if (typeof handle?.onHit === 'function') handle.onHit();
    else if (typeof obj?.userData?.flashHit === 'function') obj.userData.flashHit();
  }

  function setModelBlocking(modelWrap, active) {
    if (!modelWrap) return;
    const { handle, obj } = modelWrap;
    if (typeof handle?.setBlocking === 'function') handle.setBlocking(Boolean(active));
    else if (typeof obj?.userData?.setBlocking === 'function') obj.userData.setBlocking(Boolean(active));
  }

  // === Smooth Obstacle Collision & Arena Clamping ===
  function resolveObstaclesAndBounds(x, z, entityRadius, arenaLimit) {
    if (
      world?.isSoulsArena?.() &&
      world?.getSoulsZoneMode?.() === 'exterior_shore' &&
      typeof world.clampSoulsPosition === 'function'
    ) {
      return world.clampSoulsPosition(x, z, entityRadius);
    }
    let nx = x;
    let nz = z;
    const obstacles = world?.obstacles;

    if (Array.isArray(obstacles)) {
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < obstacles.length; i++) {
          const obs = obstacles[i];
          if (!obs) continue;
          const ox = obs.x ?? obs.position?.x ?? 0;
          const oz = obs.z ?? obs.position?.z ?? 0;

          if (obs.halfW !== undefined || obs.width !== undefined) {
            const hw = (obs.halfW ?? obs.width * 0.5) + entityRadius;
            const hd = (obs.halfD ?? (obs.depth ?? obs.width) * 0.5) + entityRadius;
            const dx = nx - ox;
            const dz = nz - oz;
            if (Math.abs(dx) < hw && Math.abs(dz) < hd) {
              const overlapX = hw - Math.abs(dx);
              const overlapZ = hd - Math.abs(dz);
              if (overlapX < overlapZ) {
                nx += dx >= 0 ? overlapX : -overlapX;
              } else {
                nz += dz >= 0 ? overlapZ : -overlapZ;
              }
            }
          } else {
            const orad = (obs.radius ?? obs.r ?? 0.95) + entityRadius;
            const dx = nx - ox;
            const dz = nz - oz;
            const distSq = dx * dx + dz * dz;
            if (distSq < orad * orad) {
              const dist = Math.sqrt(distSq);
              if (dist > 0.0001) {
                const push = orad - dist;
                nx += (dx / dist) * push;
                nz += (dz / dist) * push;
              } else {
                nx += orad;
              }
            }
          }
        }
      }
    }

    if (world?.isSoulsArena?.() && typeof world.clampSoulsPosition === 'function') {
      return world.clampSoulsPosition(nx, nz, entityRadius);
    }

    nx = clamp(nx, -arenaLimit, arenaLimit);
    nz = clamp(nz, -arenaLimit, arenaLimit);

    // The graveyard arena is round; a square clamp lets the player slip
    // through the circular fence at the diagonals. Clamp to a disc instead.
    if (world?.isArenaCircular?.()) {
      const dist = Math.hypot(nx, nz);
      if (dist > arenaLimit) {
        nx = (nx / dist) * arenaLimit;
        nz = (nz / dist) * arenaLimit;
      }
    }
    return { x: nx, z: nz };
  }

  return {
    sharedProjGeo,
    sharedOrbGeo,
    sharedRingGeo,
    sharedMiniCrateGeo,
    eliteMats,
    getProjMaterial,
    emitParticles,
    emitSlashArc,
    emitShockwave,
    emitTelegraphZone,
    emitDangerZone,
    makeProjectileVisual,
    buildHeroModel,
    buildCompanionModel,
    buildEnemyModel,
    buildPickupModel,
    removeSceneObject,
    syncFollowTarget,
    animateEntityModel,
    triggerModelAttack,
    triggerModelHitFlash,
    setModelBlocking,
    resolveObstaclesAndBounds
  };
}
