// 3-Class Combat Engine: True Heavy Shotguns (Magazine, Reload, Buckshot Falloff & Recoil),
// Direct Soul XP & Gold Economy (Zero Floor Clutter), 9-Archetype Villain AI & 5-Act Boss/Mini-Boss Ladder
import * as THREE from '../vendor/three.module.js';
import {
  ARENA_HALF_SIZE,
  CLASSES,
  WEAPONS,
  ENEMY_TYPES,
  LEVELS,
  RUN_UPGRADES
} from './config.js?v=20261117z20';

const TWO_PI = Math.PI * 2;
const ARENA_PLAYER_LIMIT = ARENA_HALF_SIZE - 1.4;
const ARENA_ENTITY_LIMIT = ARENA_HALF_SIZE - 1.6;
const MAX_ACTIVE_ENEMIES = 52;
const COS_75_DEG = Math.cos((75 * Math.PI) / 180); // ~0.2588 for ±75° Shieldbearer front arc

function clamp(val, min, max) {
  return val < min ? min : val > max ? max : val;
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

// Inspects function signature once to adapt seamlessly to positional or options-object APIs
function inspectSignature(fn) {
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

function getObj3D(handle) {
  if (!handle) return null;
  if (handle.isObject3D) return handle;
  return handle.mesh || handle.group || handle.root || handle.object3d || null;
}

export function createCombatController({
  world,
  models,
  progression,
  audio,
  callbacks = {}
} = {}) {
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

  function emitSlashArc(x, z, angle, range, arcAngle, color = 0xfbbf24) {
    if (!world?.spawnSlashArc) return;
    const duration = 0.22;
    if (sigSlash.isObject) {
      world.spawnSlashArc({
        x,
        y: 0.72,
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
        duration
      });
      return;
    }
    if (sigSlash.params.length > 0) {
      const args = sigSlash.params.map((name) => {
        const n = name.toLowerCase();
        if (n === 'x') return x;
        if (n === 'y') return 0.72;
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

  function emitDangerZone(x, z, radius, duration = 1.1, color = 0x9333ea) {
    if (!world?.spawnDangerZone) return;
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
    const activeElem = progression.getState().activeMageElement || 'fire';
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
        relic_weapon_crate: 0xfde047
      };
      const isCrate = pickupType.includes('crate');
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

  function animateEntityModel(modelWrap, dt, moving, speedRatio, attacking, beastMode, elapsedTime) {
    if (!modelWrap) return;
    const { handle, obj, sigUpdate } = modelWrap;
    const fn = handle?.update || obj?.userData?.update || handle?.animate;
    if (typeof fn === 'function') {
      const sig = sigUpdate?.valid ? sigUpdate : inspectSignature(fn);
      const p1 = (sig.params[1] || '').toLowerCase();
      const p2 = (sig.params[2] || '').toLowerCase();
      if (!sig.isObject && sig.params.length >= 4 && p2.includes('speed')) {
        fn.call(handle, dt, moving, speedRatio, elapsedTime);
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

  function triggerModelAttack(modelWrap, weaponType = null, attackDuration = 0) {
    if (!modelWrap) return;
    const { handle, obj } = modelWrap;
    if (typeof handle?.playAttackAnim === 'function') handle.playAttackAnim(weaponType, attackDuration);
    else if (typeof handle?.triggerAttack === 'function') handle.triggerAttack(weaponType, attackDuration);
    else if (typeof handle?.playAttack === 'function') handle.playAttack(weaponType, attackDuration);
    else if (typeof handle?.attack === 'function') handle.attack(weaponType, attackDuration);
    else if (typeof obj?.userData?.triggerAttack === 'function') obj.userData.triggerAttack(weaponType, attackDuration);
  }

  function triggerModelHitFlash(modelWrap) {
    if (!modelWrap) return;
    const { handle, obj } = modelWrap;
    if (typeof handle?.flashHit === 'function') handle.flashHit();
    else if (typeof handle?.hitFlash === 'function') handle.hitFlash();
    else if (typeof handle?.onHit === 'function') handle.onHit();
    else if (typeof obj?.userData?.flashHit === 'function') obj.userData.flashHit();
  }

  function syncHeroReloadModel(isReloading) {
    heroModel?.handle?.setReloading?.(isReloading);
    heroModel?.obj?.userData?.setReloading?.(isReloading);
  }

  // === Smooth Obstacle Collision & Arena Clamping ===
  function resolveObstaclesAndBounds(x, z, entityRadius, arenaLimit) {
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

    nx = clamp(nx, -arenaLimit, arenaLimit);
    nz = clamp(nz, -arenaLimit, arenaLimit);
    return { x: nx, z: nz };
  }

  // === Live Run State ===
  let autoAim = true;
  let attackEnabled = true;
  let runActive = false;
  let runEnded = false;
  let victoryDelayTimer = 0;
  let pendingVictoryPayload = null;

  let currentClassId = 'warrior';
  let currentWeaponId = 'club';
  let currentLevelNumber = 1;
  let currentDifficulty = 'normal';
  let currentLevelDef = LEVELS[0];

  let runLevel = 1;
  let xp = 0;
  let xpFraction = 0;
  let xpNext = 125;
  let pendingLevelUps = 0;
  let awaitingLevelUpChoice = false;

  let weaponRunLevel = 1;
  let perks = Object.create(null);
  let stats = null;

  let timeLeft = 65;
  let elapsedRunTime = 0;
  let spawnTimer = 0.45;
  let waveCount = 0;
  let lastWaveSector = 0;
  let relicCrateSpawned = false;
  let midMiniBossSpawned = false;
  let finaleStarted = false;
  let unlockedWeaponThisRun = null;

  let goldRun = 0;
  let kills = 0;
  let targetKills = 30;
  let levelSpawnQueue = [];
  let bossSpawnCountdown = 0;
  let nextEntityUid = 1;
  let critFloaterCooldown = 0;
  let shieldSparkCooldown = 0;
  let hitSoundCooldown = 0;
  let manaEmptyHintCooldown = 0;

  let player = {
    x: 0,
    z: 0,
    facing: 0,
    hp: 145,
    maxHp: 145,
    radius: 0.58,
    recoilVx: 0,
    recoilVz: 0,
    ammo: 0,
    maxAmmo: 0,
    mana: 0,
    maxMana: 0,
    reloadTimer: 0,
    reloadDuration: 0,
    reloadShellAccum: 0,
    isReloading: false,
    reloadMidShellPlayed: false,
    standStillTimer: 0,
    invulnTimer: 0,
    attackCooldown: 0,
    attackAnimTimer: 0,
    seals: 0,
    beastTimeLeft: 0,
    overdriveAmmo: 0,
    overdriveMax: 5,
    vampiricKills: 0,
    soulNovaTimer: 9.0,
    relicBumpTimer: 0
  };

  let heroModel = null;
  let overdriveCrateVisual = null;
  let companion = null;
  let enemies = [];
  let projectiles = [];
  let pickups = [];
  let bossHazards = [];
  let bomberHazards = [];
  let bossEntity = null;
  let dyingCorpses = [];
  let activeWaterPrisons = [];
  let pendingMeteors = [];
  let shrapnelMines = [];
  let orbitBladesGroup = null;
  let orbitBladeMeshes = [];

  function recomputeStats() {
    stats = progression.computeCombatStats(currentClassId, currentWeaponId, {
      weaponRunLevel,
      perks
    });
    player.maxHp = stats.maxHp;
    if (player.hp > player.maxHp) {
      player.hp = player.maxHp;
    }

    const prevMaxMana = player.maxMana || 0;
    player.maxMana = stats.usesMana ? (stats.maxMana || 120) : 0;
    if (player.maxMana <= 0) {
      player.mana = 0;
    } else {
      const manaGain = Math.max(0, player.maxMana - prevMaxMana);
      player.mana = Math.min(player.maxMana, (player.mana || 0) + manaGain);
    }

    player.maxAmmo = stats.magSize || 0;
    player.reloadDuration = stats.reloadTime || 0;
    if (player.maxAmmo <= 0) {
      player.ammo = 0;
      if (player.isReloading) {
        player.isReloading = false;
        player.reloadTimer = 0;
        syncHeroReloadModel(false);
      }
    } else if (player.ammo > player.maxAmmo) {
      player.ammo = player.maxAmmo;
    }
  }

  function floatText(text, x, z, color = '#ffffff') {
    callbacks?.onFloatingText?.(text, x, z, color);
  }

  // === Manual [R] & Automatic Magazine Reload ===
  function triggerReload() {
    if (!runActive || runEnded || awaitingLevelUpChoice) return false;
    if (!stats || !(stats.magSize > 0)) return false;
    if (player.isReloading) return false;
    if (player.ammo >= player.maxAmmo) return false;
    if (player.overdriveAmmo > 0 || player.beastTimeLeft > 0) return false;

    const wpn = WEAPONS[currentWeaponId] || WEAPONS.usp_pistol;
    player.isReloading = true;
    const perShell = stats.reloadPerShellTime || 0;
    if (perShell > 0) {
      const missingShells = Math.max(1, player.maxAmmo - player.ammo);
      player.reloadDuration = Math.max(perShell, +(missingShells * perShell).toFixed(3));
    } else {
      player.reloadDuration = Math.max(0.25, stats.reloadTime || wpn.reloadTime || 1.2);
    }
    player.reloadTimer = player.reloadDuration;
    player.reloadShellAccum = 0;
    player.reloadMidShellPlayed = false;

    audio?.playReloadShell?.();
    syncHeroReloadModel(true);

    // Пороховой Рывок (gun_tactical_reload): blast nearby enemies away & grant +35% sprint!
    const tacReloadStacks = stats.gunReloadStacks || 0;
    if (tacReloadStacks > 0) {
      player.sprintTimer = 1.6;
      const blastDmg = Math.round(stats.damage * (0.85 + tacReloadStacks * 0.45));
      emitShockwave(player.x, player.z, 3.6, 0x34d399, 0.30);
      emitParticles(player.x, 0.7, player.z, 0xfbbf24, 12, 6.0, 0.14);
      damageEnemiesInRadius(player.x, player.z, 3.6, blastDmg, 13.5, null, false);
    }
    return true;
  }

  // Layout-independent [R] reload shortcut (works on both EN QWERTY and RU ЙЦУКЕН!)
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyR' && !e.repeat && runActive && !runEnded && !awaitingLevelUpChoice) {
        triggerReload();
      }
    });
  }

  // === Cleanup ===
  function disposeRun() {
    runActive = false;
    runEnded = false;
    victoryDelayTimer = 0;
    pendingVictoryPayload = null;

    if (heroModel) {
      syncHeroReloadModel(false);
      removeSceneObject(heroModel.obj, heroModel.handle);
      heroModel = null;
    }
    if (overdriveCrateVisual) {
      removeSceneObject(overdriveCrateVisual, overdriveCrateVisual);
      overdriveCrateVisual = null;
    }
    if (companion) {
      removeSceneObject(companion.model.obj, companion.model.handle);
      companion = null;
    }
    for (let i = 0; i < enemies.length; i++) {
      removeSceneObject(enemies[i].model.obj, enemies[i].model.handle);
    }
    enemies = [];

    for (let i = 0; i < projectiles.length; i++) {
      removeSceneObject(projectiles[i].vis.obj, projectiles[i].vis.handle);
    }
    projectiles = [];

    for (let i = 0; i < pickups.length; i++) {
      removeSceneObject(pickups[i].model.obj, pickups[i].model.handle);
    }
    pickups = [];

    bossHazards = [];
    bomberHazards = [];
    bossEntity = null;
    activeWaterPrisons = [];
    pendingMeteors = [];

    for (let i = 0; i < dyingCorpses.length; i++) {
      removeSceneObject(dyingCorpses[i].model.obj, dyingCorpses[i].model.handle);
    }
    dyingCorpses = [];

    for (let i = 0; i < shrapnelMines.length; i++) {
      if (shrapnelMines[i].mesh?.parent) shrapnelMines[i].mesh.parent.remove(shrapnelMines[i].mesh);
    }
    shrapnelMines = [];

    if (orbitBladesGroup) {
      if (orbitBladesGroup.parent) orbitBladesGroup.parent.remove(orbitBladesGroup);
      orbitBladesGroup = null;
      orbitBladeMeshes = [];
    }
  }

  // === Start Run ===
  function startRun({ classId, levelNumber, difficultyMode } = {}) {
    disposeRun();

    world?.resetVfx?.();
    world?.setBossAtmosphere?.(false);

    currentClassId = CLASSES[classId] ? classId : progression.getState().selectedClass || 'warrior';
    currentDifficulty = difficultyMode === 'hard' ? 'hard' : 'normal';
    const lvlIdx = clamp((Number(levelNumber) || 1) - 1, 0, LEVELS.length - 1);
    currentLevelDef = LEVELS[lvlIdx];
    currentLevelNumber = currentLevelDef.level;
    world?.setArenaBiome?.(currentLevelNumber >= 11 ? 'misty_forest' : 'courtyard');

    currentWeaponId = progression.getEquippedWeaponId(currentClassId);
    const progInit = progression.getState();
    runLevel = progInit.heroLevel || 1;
    xp = progInit.heroXp || 0;
    xpFraction = 0;
    xpNext = progInit.heroXpNext || 95;
    pendingLevelUps = 0;
    awaitingLevelUpChoice = false;

    weaponRunLevel = 1;
    perks = Object.create(null);
    stats = progression.computeCombatStats(currentClassId, currentWeaponId, {
      weaponRunLevel,
      perks
    });

    const startSpot = resolveObstaclesAndBounds(0, 0, 0.75, ARENA_PLAYER_LIMIT);
    const initialMag = stats.magSize || 0;
    const initialMana = stats.usesMana ? (stats.maxMana || 120) : 0;
    targetKills = currentLevelDef.targetKills || (26 + currentLevelNumber * 4);
    bossSpawnCountdown = currentLevelDef.hasBoss ? (currentLevelDef.bossSpawnTimerSec || 45) : 0;
    levelSpawnQueue = [];
    if (currentLevelDef.enemyQuotas) {
      for (const [eType, qty] of Object.entries(currentLevelDef.enemyQuotas)) {
        for (let q = 0; q < (qty || 0); q++) {
          levelSpawnQueue.push(eType);
        }
      }
      for (let i = levelSpawnQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = levelSpawnQueue[i];
        levelSpawnQueue[i] = levelSpawnQueue[j];
        levelSpawnQueue[j] = tmp;
      }
    }
    player = {
      x: startSpot.x,
      z: startSpot.z,
      facing: 0,
      hp: stats.maxHp,
      maxHp: stats.maxHp,
      radius: 0.58,
      recoilVx: 0,
      recoilVz: 0,
      ammo: initialMag,
      maxAmmo: initialMag,
      mana: initialMana,
      maxMana: initialMana,
      reloadTimer: 0,
      reloadDuration: stats.reloadTime || 0,
      reloadShellAccum: 0,
      isReloading: false,
      reloadMidShellPlayed: false,
      standStillTimer: 0,
      invulnTimer: 1.0,
      attackCooldown: 0,
      attackAnimTimer: 0,
      seals: 0,
      beastTimeLeft: 0,
      overdriveAmmo: 0,
      overdriveMax: 5,
      vampiricKills: 0,
      soulNovaTimer: 9.0,
      relicBumpTimer: 0,
      sprintTimer: 0,
      meleeSwingCount: 0,
      gunShotCount: 0,
      mageCastCount: 0,
      whirlwindTimer: 4.5,
      meteorTimer: 3.2,
      mineTimer: 4.2,
      arcaneWardReady: false,
      arcaneWardTimer: 2.0,
      orbitHitTimers: new Map()
    };

    heroModel = buildHeroModel(currentClassId, currentWeaponId);
    heroModel.obj.position.set(player.x, 0, player.z);
    heroModel.obj.rotation.y = player.facing;
    syncFollowTarget(player.x, player.z, heroModel.obj);

    timeLeft = currentLevelDef.durationSec;
    elapsedRunTime = 0;
    spawnTimer = 0.35;
    waveCount = 0;
    lastWaveSector = Math.floor(Math.random() * 4);
    relicCrateSpawned = false;
    midMiniBossSpawned = false;
    finaleStarted = false;
    unlockedWeaponThisRun = null;
    goldRun = 0;
    kills = 0;
    critFloaterCooldown = 0;
    shieldSparkCooldown = 0;
    runEnded = false;
    runActive = true;
  }

  // === Tactical Ground Pickups & Crates ONLY (ZERO floor coins & ZERO floor XP orbs!) ===
  function spawnPickup(type, x, z, extra = {}) {
    // Strictly block any floor XP or Gold pickups — XP & Gold are awarded directly!
    if (type === 'xp' || type === 'gold') return null;

    const pos = resolveObstaclesAndBounds(x, z, 0.55, ARENA_ENTITY_LIMIT);
    const model = buildPickupModel(type, {
      weaponId: extra.targetWeaponId || null,
      classId: currentClassId,
      tier: currentLevelDef.unlockWeaponTier || 2
    });
    model.obj.position.set(pos.x, 0, pos.z);

    const isCrate = type.includes('crate');
    const entity = {
      uid: nextEntityUid++,
      type,
      x: pos.x,
      z: pos.z,
      radius: type === 'relic_weapon_crate' ? 1.05 : isCrate ? 0.85 : 0.45,
      hp: isCrate ? 3 : 1,
      maxHp: isCrate ? 3 : 1,
      value: extra.value ?? 1,
      targetWeaponId: extra.targetWeaponId || null,
      age: 0,
      hitWobble: 0,
      model
    };
    pickups.push(entity);
    return entity;
  }

  function findClassWeaponByTier(classId, tier) {
    const classWeapons = CLASSES[classId]?.weapons || [];
    for (let i = 0; i < classWeapons.length; i++) {
      const wId = classWeapons[i];
      if (WEAPONS[wId]?.tier === tier) return wId;
    }
    for (const w of Object.values(WEAPONS)) {
      if (w.classId === classId && w.tier === tier) return w.id;
    }
    return null;
  }

  function spawnRelicWeaponEvent() {
    if (currentClassId === 'warrior' || currentClassId === 'gunslinger') return;
    const tier = currentLevelDef.unlockWeaponTier;
    if (!tier) return;
    const targetWeaponId = findClassWeaponByTier(currentClassId, tier);
    if (!targetWeaponId) return;

    let bestSpot = { x: 0, z: -14 };
    for (let attempt = 0; attempt < 16; attempt++) {
      const angle = Math.random() * TWO_PI;
      const dist = 14 + Math.random() * 4;
      const rx = clamp(player.x + Math.sin(angle) * dist, -ARENA_HALF_SIZE + 4.5, ARENA_HALF_SIZE - 4.5);
      const rz = clamp(player.z + Math.cos(angle) * dist, -ARENA_HALF_SIZE + 4.5, ARENA_HALF_SIZE - 4.5);
      const dPlayer = Math.hypot(rx - player.x, rz - player.z);
      if (dPlayer >= 11.5) {
        bestSpot = resolveObstaclesAndBounds(rx, rz, 1.2, ARENA_HALF_SIZE - 4.2);
        break;
      }
      bestSpot = resolveObstaclesAndBounds(rx, rz, 1.2, ARENA_HALF_SIZE - 4.2);
    }

    spawnPickup('relic_weapon_crate', bestSpot.x, bestSpot.z, { targetWeaponId });
    emitShockwave(bestSpot.x, bestSpot.z, 5.0, 0xfde047, 0.55);
    emitParticles(bestSpot.x, 0.9, bestSpot.z, 0xfde047, 22, 6.5, 0.2);

    // Guarding Elite Champion beside the Relic Crate
    const guardType = currentLevelNumber >= 7 ? 'iron_knight' : 'cursed_footman';
    spawnEnemy(guardType, bestSpot.x + 1.8, bestSpot.z + 1.2, 'purple');
    floatText('✨ РУННЫЙ ЯЩИК ОРУЖИЯ!', player.x, player.z - 1.2, '#fde047');
  }

  // === Enemy & Boss Spawning ===
  function spawnEnemy(typeId, x, z, forcedElite = null, customOverrides = null) {
    const def = ENEMY_TYPES[typeId] || ENEMY_TYPES.ember_skeleton || ENEMY_TYPES.skeleton;

    let eliteType = forcedElite;
    if (
      eliteType === null &&
      !def.isBoss &&
      !customOverrides?.isWarden &&
      !customOverrides?.isMiniBoss &&
      !customOverrides?.isSummoned
    ) {
      const roll = Math.random();
      if (roll < 0.065) eliteType = 'purple';
      else if (roll < 0.135) eliteType = 'blue';
    }

    const progress = clamp(elapsedRunTime / Math.max(1, currentLevelDef.durationSec), 0, 1);
    const waveRamp = 1 + progress * 0.22;
    const diffHpMult = currentDifficulty === 'hard' ? 1.45 : 1.0;
    const diffDmgMult = currentDifficulty === 'hard' ? 1.25 : 1.0;
    const baseHpScale = (currentLevelDef.hpScale || 1) * (def.isBoss ? 0.85 : waveRamp) * diffHpMult;
    const baseDmgScale = (currentLevelDef.dmgScale || 1) * diffDmgMult;

    const eliteHpMult =
      eliteType === 'purple' ? 1.65 : eliteType === 'blue' ? 1.55 : 1.0;
    const eliteDmgMult = eliteType ? 1.15 : 1.0;

    const maxHp = Math.max(
      1,
      Math.round(customOverrides?.hp ?? def.hp * baseHpScale * eliteHpMult)
    );
    const damage = Math.max(
      1,
      Math.round(customOverrides?.damage ?? def.damage * baseDmgScale * eliteDmgMult)
    );
    const scale =
      (customOverrides?.scale ?? def.scale ?? 1.0) *
      (customOverrides?.scale ? 1.0 : eliteType === 'purple' ? 1.15 : eliteType === 'blue' ? 1.12 : 1.0);

    const visualTag =
      customOverrides?.isWarden || customOverrides?.isFinaleTarget ? 'warden' : eliteType;
    const model = buildEnemyModel(typeId, visualTag);

    const isBossUnit = Boolean(def.isBoss || customOverrides?.isMiniBoss);
    const isMiniBoss = Boolean(customOverrides?.isMiniBoss);

    const baseRadius = isMiniBoss
      ? 0.96
      : def.isBoss
        ? 1.28
        : customOverrides?.isWarden
          ? 0.95
          : 0.52 * scale;

    const spot = resolveObstaclesAndBounds(x, z, baseRadius * 0.85, ARENA_ENTITY_LIMIT);
    const emergeDuration = isBossUnit || customOverrides?.noEmerge ? 0 : 0.85;
    model.obj.position.set(spot.x, emergeDuration > 0 ? -1.9 : 0, spot.z);
    if (emergeDuration > 0) {
      const ringCol = typeId === 'corrupted_treant' ? 0xf97316 : 0x65a30d;
      world?.spawnShockwaveRing?.({ x: spot.x, y: 0.045, z: spot.z, radius: 1.25, color: ringCol, duration: 0.65 });
      world?.spawnShockwaveRing?.({ x: spot.x, y: 0.055, z: spot.z, radius: 0.72, color: 0xfef08a, duration: 0.50 });
      emitParticles(spot.x, 0.18, spot.z, ringCol, 8, 3.6, 0.13);
      emitParticles(spot.x, 0.10, spot.z, 0x57534e, 6, 2.8, 0.11);
    }
    if (customOverrides?.scale) {
      model.obj.scale.multiplyScalar(customOverrides.scale / (def.scale || 1));
    } else if (eliteType === 'purple' || eliteType === 'blue') {
      model.obj.scale.multiplyScalar(1.12);
    }

    const enemy = {
      uid: nextEntityUid++,
      type: typeId,
      nameRu: customOverrides?.nameRu || def.nameRu,
      isBoss: isBossUnit,
      isMiniBoss,
      isWarden: Boolean(customOverrides?.isWarden),
      isFinaleTarget: Boolean(customOverrides?.isFinaleTarget),
      isSummoned: Boolean(customOverrides?.isSummoned),
      eliteType,
      x: spot.x,
      z: spot.z,
      vx: 0,
      vz: 0,
      facing: 0,
      hp: maxHp,
      maxHp,
      speed: customOverrides?.speed ?? def.speed,
      damage,
      ranged: Boolean(def.ranged),
      canDash: Boolean(def.canDash),
      dashMult: def.dashMult || 1.65,
      canCharge: Boolean(def.canCharge),
      summoner: Boolean(def.summoner),
      canSummonBats: Boolean(def.canSummonBats || typeId === 'vampire_lord'),
      cloakMelee: Boolean(def.cloakMelee || typeId === 'vampire_lord'),
      batSummonCooldown: 2.0 + Math.random() * 1.4,
      castPauseTimer: 0,
      cloakAttackTimer: 0,
      keepDistance: def.keepDistance || 10.2,
      projColor: def.projColor || 0xa855f7,
      hazardColor: def.hazardColor || 0x22c55e,
      armor: def.armor || 0,
      frontArmor: def.frontArmor || 0,
      explodesOnDeath: Boolean(def.explodesOnDeath),
      bomberTriggered: false,
      xp: customOverrides?.xp ?? def.xp,
      gold: customOverrides?.gold ?? def.gold,
      radius: baseRadius,
      color: def.color,
      // Specialist AI timers
      shootCooldown: 1.1 + Math.random() * 1.1,
      windupTimer: 0,
      aimDirX: 0,
      aimDirZ: 1,
      specialCooldown:
        def.summoner
          ? 2.8 + Math.random() * 1.6
          : def.canCharge
            ? 2.2 + Math.random() * 1.4
            : 1.4 + Math.random() * 1.2,
      lungeTimer: 0,
      lungeDirX: 0,
      lungeDirZ: 1,
      chargeState: 'walk',
      chargeTimer: 0,
      chargeDirX: 0,
      chargeDirZ: 1,
      // Elemental & status effects
      frostTimer: 0,
      frostFactor: 1.0,
      burnTimer: 0,
      burnDps: 0,
      burnTickTimer: 0,
      fireVfxTick: 0,
      damageStage: 0,
      waterLiftTimer: 0,
      contactCooldown: 0,
      trampleCooldown: 0,
      stunTimer: 0,
      disarmTimer: 0,
      emergeTimer: emergeDuration,
      emergeDuration,
      hopCycle: Math.random(),
      _hopLandedDust: false,
      // Boss state machine
      bossPhase: 0,
      bossSubState: 'stalk',
      bossStateTimer: 1.8,
      bossStepCount: 0,
      dashStartX: spot.x,
      dashStartZ: spot.z,
      dashTargetX: spot.x,
      dashTargetZ: spot.z,
      model
    };

    enemies.push(enemy);
    return enemy;
  }

  function spawnWavePack() {
    const lvl = currentLevelDef?.level || 1;
    const maxConcurrentForLvl =
      lvl === 1 ? 4 : lvl === 2 ? 5 : lvl === 3 ? 6 : Math.min(MAX_ACTIVE_ENEMIES, 5 + Math.min(lvl, 12) * 2);
    if (enemies.length >= maxConcurrentForLvl) return;
    waveCount += 1;

    const pool = currentLevelDef.enemyPool || ['plague_zombie'];
    const meleePool = pool.filter((id) => !ENEMY_TYPES[id]?.ranged);
    const rangedPool = pool.filter((id) => Boolean(ENEMY_TYPES[id]?.ranged));
    const safeMeleePool = meleePool.length > 0 ? meleePool : ['plague_zombie'];

    let aliveRanged = 0;
    for (let i = 0; i < enemies.length; i++) {
      if (enemies[i]?.hp > 0 && enemies[i].ranged) {
        aliveRanged += 1;
      }
    }

    const timePressure = clamp(elapsedRunTime / 55, 0, 1.35);
    const basePack = lvl === 1 ? 2 : lvl === 2 ? 3 : lvl === 3 ? 3 : Math.min(5, 2 + Math.floor((lvl - 1) * 0.45));
    let totalWaveSize = finaleStarted
      ? Math.min(4, basePack + 1)
      : Math.min(
          lvl <= 3 ? 4 : 9,
          Math.round(basePack + timePressure * (lvl === 1 ? 0.9 : 1.2 + Math.min(2.4, (lvl - 1) * 0.2)))
        );
    if (!finaleStarted && currentLevelDef.enemyQuotas && levelSpawnQueue.length > 0) {
      totalWaveSize = Math.min(totalWaveSize, levelSpawnQueue.length);
    }

    // Pick a distinct courtyard flank direction (rotates 90°/135° from previous wave so waves emerge visibly from gates!)
    lastWaveSector = (lastWaveSector + 1 + (Math.random() < 0.45 ? 1 : 0)) % 4;
    const primarySectorAngle = lastWaveSector * (Math.PI * 0.5) + (Math.random() - 0.5) * 0.34;
    const usePincer = !finaleStarted && lvl >= 2 && waveCount >= 4 && timePressure > 0.55 && Math.random() < 0.35;
    const secondarySectorAngle = primarySectorAngle + Math.PI * (0.72 + Math.random() * 0.35);

    let spawnedRangedInWave = false;

    for (let n = 0; n < totalWaveSize; n++) {
      if (enemies.length >= maxConcurrentForLvl) break;
      if (!finaleStarted && currentLevelDef.enemyQuotas && levelSpawnQueue.length === 0 && kills + enemies.length >= targetKills) {
        break;
      }

      const inSecondSquad = usePincer && n >= Math.ceil(totalWaveSize * 0.62);
      const baseAngle = inSecondSquad ? secondarySectorAngle : primarySectorAngle;
      const localIdx = inSecondSquad ? n - Math.ceil(totalWaveSize * 0.62) : n;

      let isRangedUnit = false;
      let chosen;
      if (levelSpawnQueue.length > 0 && !finaleStarted) {
        chosen = levelSpawnQueue.pop();
        isRangedUnit = Boolean(ENEMY_TYPES[chosen]?.ranged);
      } else if (
        !spawnedRangedInWave &&
        rangedPool.length > 0 &&
        aliveRanged < 2 &&
        n === totalWaveSize - 1 &&
        waveCount >= 1 &&
        Math.random() < 0.85
      ) {
        chosen = rangedPool[Math.floor(Math.random() * rangedPool.length)];
        aliveRanged += 1;
        spawnedRangedInWave = true;
        isRangedUnit = true;
      } else {
        chosen = safeMeleePool[(waveCount + n) % safeMeleePool.length];
      }

      const row = Math.floor(localIdx / 3);
      const col = (localIdx % 3) - 1;
      const fwdX = Math.sin(baseAngle);
      const fwdZ = Math.cos(baseAngle);
      const sideX = fwdZ;
      const sideZ = -fwdX;

      // Keep spawn distance in [10.8m .. 14.5m] so underground rise portals are clearly visible near the hero without ambushing!
      const baseDist = (isRangedUnit ? 14.5 : 10.8) + row * 1.85 + Math.random() * 0.8;
      const lateralSpread = col * 1.9 + (Math.random() - 0.5) * 0.6;

      const sx = clamp(
        player.x + fwdX * baseDist + sideX * lateralSpread,
        -ARENA_ENTITY_LIMIT,
        ARENA_ENTITY_LIMIT
      );
      const sz = clamp(
        player.z + fwdZ * baseDist + sideZ * lateralSpread,
        -ARENA_ENTITY_LIMIT,
        ARENA_ENTITY_LIMIT
      );

      const spawned = spawnEnemy(chosen, sx, sz);
      if (localIdx === 0 && spawned) {
        emitParticles(spawned.x, 0.35, spawned.z, 0xa855f7, 8, 3.6, 0.14);
      }
    }

    // Field Chests (genuine 3D supply_crate & stealth 3D mimic_disguise that shares exact mesh!)
    if (!finaleStarted && (waveCount === 1 || waveCount % 2 === 1)) {
      let activeCrates = 0;
      for (let i = 0; i < pickups.length; i++) {
        const pt = pickups[i]?.type;
        if (pt === 'supply_crate' || pt === 'mimic_disguise') activeCrates += 1;
      }
      if (activeCrates < 2) {
        const crateAng = primarySectorAngle + Math.PI * (0.45 + Math.random() * 0.4);
        const crateDist = 7.4 + Math.random() * 3.6;
        const cx = clamp(player.x + Math.sin(crateAng) * crateDist, -ARENA_ENTITY_LIMIT + 1.5, ARENA_ENTITY_LIMIT - 1.5);
        const cz = clamp(player.z + Math.cos(crateAng) * crateDist, -ARENA_ENTITY_LIMIT + 1.5, ARENA_ENTITY_LIMIT - 1.5);
        const hasMimicPool = lvl >= 2 || (currentLevelDef.enemyPool || []).includes('mimic_chest');
        const kind = waveCount === 1 ? (hasMimicPool ? 'mimic_disguise' : 'supply_crate') : (hasMimicPool && Math.random() < 0.5 ? 'mimic_disguise' : 'supply_crate');
        spawnPickup(kind, cx, cz);
      }
    }
  }

  // Spawn previous-Act Boss as a Field or Finale Mini-Boss (Acts II–V non-boss chapters!)
  function spawnMiniBossFromPool(isFinale = false) {
    const pool = currentLevelDef.miniBossPool || [];
    const bossTypeId = currentLevelDef.finaleMiniBossType || (isFinale ? pool[pool.length - 1] : pool[Math.floor(Math.random() * pool.length)]);
    if (!bossTypeId) return null;
    const bossDef = ENEMY_TYPES[bossTypeId] || ENEMY_TYPES.toxic_slime;

    const hpScale = currentLevelDef.hpScale || 1;
    const dmgScale = currentLevelDef.dmgScale || 1;
    const miniHp = Math.max(
      115,
      Math.round((bossDef.hp || 90) * hpScale * (isFinale ? 2.25 : 1.75))
    );
    const miniDmg = Math.max(12, Math.round((bossDef.damage || 14) * dmgScale * 1.15));
    const miniScale = +((bossDef.scale || 1.0) * 1.42).toFixed(2);

    const angle = Math.random() * TWO_PI;
    const dist = 15.5;
    const mx = clamp(player.x + Math.sin(angle) * dist, -ARENA_HALF_SIZE + 4.5, ARENA_HALF_SIZE - 4.5);
    const mz = clamp(player.z + Math.cos(angle) * dist, -ARENA_HALF_SIZE + 4.5, ARENA_HALF_SIZE - 4.5);

    const mini = spawnEnemy(bossTypeId, mx, mz, null, {
      isMiniBoss: true,
      isWarden: Boolean(isFinale),
      isFinaleTarget: Boolean(isFinale),
      nameRu: isFinale ? `Страж: ${bossDef.nameRu}` : `Мини-босс: ${bossDef.nameRu}`,
      hp: miniHp,
      damage: miniDmg,
      scale: miniScale,
      speed: bossDef.speed * 0.96,
      xp: Math.round(bossDef.xp * 0.52),
      gold: Math.round(bossDef.gold * 0.50)
    });

    if (isFinale || !bossEntity || bossEntity.hp <= 0) {
      bossEntity = mini;
    }

    audio?.playBossSpawn?.();
    world?.addScreenShake?.(isFinale ? 0.58 : 0.42, 0.32);
    emitShockwave(mini.x, mini.z, 6.2, bossDef.color || 0xef4444, 0.48);
    emitParticles(mini.x, 1.0, mini.z, bossDef.color || 0xef4444, 24, 6.8, 0.20);
    floatText(
      isFinale ? `⚔️ ФИНАЛ: ${bossDef.nameRu.toUpperCase()}!` : `⚠️ МИНИ-БОСС: ${bossDef.nameRu.toUpperCase()}!`,
      player.x,
      player.z - 1.2,
      '#f87171'
    );
    return mini;
  }

  // === Toxic Slime / Bomber Acid Hazard Pool ===
  function spawnBomberHazard(x, z, hzColor = 0x22c55e) {
    const hpScale = currentLevelDef.hpScale || 1;
    const dmgScale = currentLevelDef.dmgScale || 1;
    emitDangerZone(x, z, 3.1, 0.80, hzColor);
    emitParticles(x, 0.55, z, hzColor, 12, 4.4, 0.15);
    bomberHazards.push({
      x,
      z,
      radius: 3.1,
      timer: 0.80,
      color: hzColor,
      playerDamage: Math.max(12, Math.round(24 * dmgScale)),
      enemyDamage: Math.max(45, Math.round(85 * hpScale))
    });
  }

  // === Crate Destruction, Mimic Ambush & Unlocks ===
  function awakenMimicDisguise(crate, idx = -1) {
    if (!crate) return;
    crate.hp = 0;
    const mx = crate.x;
    const mz = crate.z;
    if (idx >= 0 && pickups[idx] === crate) {
      removeSceneObject(crate.model.obj, crate.model.handle);
      pickups.splice(idx, 1);
    } else {
      const found = pickups.indexOf(crate);
      if (found >= 0) {
        removeSceneObject(crate.model.obj, crate.model.handle);
        pickups.splice(found, 1);
      }
    }
    world?.spawnShockwaveRing?.({ x: mx, y: 0.05, z: mz, radius: 1.9, color: 0xc084fc, duration: 0.42 });
    emitParticles(mx, 0.55, mz, 0xc084fc, 16, 5.4, 0.15);
    floatText('👹 МИМИК!', mx, mz, '#e879f9');
    audio?.playHit?.();
    spawnEnemy('mimic_chest', mx, mz, null, { noEmerge: true });
  }

  function hitCrate(crate) {
    if (!crate || crate.hp <= 0) return;
    if (crate.type === 'mimic_disguise') {
      awakenMimicDisguise(crate);
      return;
    }
    crate.hp -= 1;
    crate.hitWobble = 0.28;
    audio?.playHit?.();

    if (crate.type === 'supply_crate') {
      emitParticles(crate.x, 0.5, crate.z, 0xf97316, 8, 4.5, 0.14);
      if (crate.hp > 0) {
        if (typeof crate.model?.handle?.setDamageGlow === 'function') {
          crate.model.handle.setDamageGlow((3 - crate.hp) / 2);
        } else {
          crate.model.obj.traverse?.((child) => {
            if (child.isMesh && child.material) {
              if (!child.userData._origMat) {
                child.userData._origMat = child.material;
                child.material = child.material.clone();
              }
              child.material.color?.setHex(crate.hp === 1 ? 0xff1e1e : 0xf97316);
              if (child.material.emissive) {
                child.material.emissive.setHex(crate.hp === 1 ? 0xdc2626 : 0x9a3412);
              }
            }
          });
        }
        floatText(crate.hp === 1 ? '🔥 1!' : '2!', crate.x, crate.z, '#fb923c');
      } else {
        detonateSupplyCrate(crate);
      }
      return;
    }

    if (crate.type === 'relic_weapon_crate') {
      emitParticles(crate.x, 0.7, crate.z, 0xfde047, 12, 5.2, 0.16);
      if (crate.hp > 0) {
        floatText(`ПЕЧАТЬ ${crate.hp}/3`, crate.x, crate.z, '#fde047');
      } else {
        openRelicWeaponCrate(crate);
      }
      return;
    }

    if (crate.type === 'companion_crate' && crate.hp <= 0) {
      activateCompanion(crate.x, crate.z);
    }
  }

  function maybeDropSpearBlueprint(x, z) {
    if (currentLevelNumber < 3) return;
    if (progression.isWeaponUnlocked('spear') || progression.isBlueprintUnlocked?.('spear')) return;
    if (Math.random() < 0.20) {
      progression.unlockBlueprint?.('spear');
      audio?.playWeaponUnlock?.();
      world?.addScreenShake?.(0.42, 0.25);
      emitShockwave(x, z, 5.2, 0x38bdf8, 0.45);
      emitParticles(x, 0.85, z, 0x38bdf8, 26, 7.2, 0.20);
      floatText('📜 ЧЕРТЁЖ: БОЕВОЕ КОПЬЁ! (в Магазине)', player.x, player.z - 0.8, '#38bdf8');
      callbacks?.onBlueprintUnlocked?.('spear');
    }
  }

  function detonateSupplyCrate(crate) {
    maybeDropSpearBlueprint(crate.x, crate.z);
    audio?.playExplosion?.();
    world?.addScreenShake?.(0.68, 0.36);
    emitShockwave(crate.x, crate.z, 6.2, 0xef4444, 0.42);
    emitParticles(crate.x, 0.6, crate.z, 0xf97316, 28, 9.0, 0.22);
    floatText('💥 ВЗРЫВ ЯЩИКА!', crate.x, crate.z, '#f97316');

    const blastDmg = Math.max(110, Math.round(stats.damage * 3.0));
    damageEnemiesInRadius(crate.x, crate.z, 6.2, blastDmg, 11.5, null);

    const bulletDmg = Math.max(52, Math.round(stats.damage * 1.65));
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * TWO_PI;
      spawnProjectile({
        x: crate.x,
        z: crate.z,
        vx: Math.sin(ang) * 25,
        vz: Math.cos(ang) * 25,
        damage: bulletDmg,
        maxDist: 18,
        pierce: 3,
        splashRadius: 0.9,
        knockback: 6.5,
        kind: 'bullet',
        visualType: 'buckshot',
        color: 0xf97316,
        isEnemy: false,
        ignoreCrateUid: crate.uid
      });
    }
  }

  function unlockTierWeaponIfNeeded(targetWeaponId, sourceX, sourceZ, silentIfAlreadyOwned = false) {
    if (!targetWeaponId || !WEAPONS[targetWeaponId]) return;
    const weaponDef = WEAPONS[targetWeaponId];
    const alreadyUnlocked = progression.isWeaponUnlocked(targetWeaponId);

    if (!alreadyUnlocked) {
      progression.unlockWeapon(targetWeaponId);
      currentWeaponId = targetWeaponId;
      recomputeStats();
      player.ammo = player.maxAmmo;
      player.isReloading = false;
      player.reloadTimer = 0;
      syncHeroReloadModel(false);

      heroModel?.handle?.setWeapon?.(targetWeaponId);
      heroModel?.obj?.userData?.setWeapon?.(targetWeaponId);

      unlockedWeaponThisRun = weaponDef;
      audio?.playWeaponUnlock?.();
      world?.addScreenShake?.(0.6, 0.36);
      emitShockwave(sourceX, sourceZ, 6.8, 0xfde047, 0.52);
      emitParticles(sourceX, 0.9, sourceZ, 0xfde047, 34, 8.2, 0.22);
      floatText(`✨ ОТКРЫТО: ${weaponDef.nameRu.toUpperCase()}!`, sourceX, sourceZ, '#fde047');
      callbacks?.onWeaponUnlocked?.(weaponDef);
    } else if (!silentIfAlreadyOwned) {
      weaponRunLevel = Math.min(5, weaponRunLevel + 1);
      recomputeStats();
      player.ammo = player.maxAmmo;
      player.isReloading = false;
      player.reloadTimer = 0;
      syncHeroReloadModel(false);

      const bonusGold = Math.round(55 * (stats.goldMult || 1));
      progression.addGold(bonusGold);
      goldRun += bonusGold;
      audio?.playWeaponUnlock?.();
      emitShockwave(sourceX, sourceZ, 5.5, 0xfbbf24, 0.45);
      emitParticles(sourceX, 0.8, sourceZ, 0xfbbf24, 26, 7.0, 0.2);
      floatText(`⚡ +1 РАНГ И +${bonusGold} ЗОЛОТА!`, sourceX, sourceZ, '#fde047');
    }
  }

  function openRelicWeaponCrate(crate) {
    const targetWeaponId =
      crate.targetWeaponId ||
      findClassWeaponByTier(currentClassId, currentLevelDef.unlockWeaponTier || 2);
    unlockTierWeaponIfNeeded(targetWeaponId, crate.x, crate.z, false);
  }

  function activateCompanion(x, z) {
    audio?.playPickup?.('companion');
    emitShockwave(x, z, 4.2, 0xa855f7, 0.38);
    emitParticles(x, 0.6, z, 0xc084fc, 18, 5.5, 0.18);

    if (!companion) {
      const model = buildCompanionModel(currentClassId);
      model.obj.position.set(player.x - 1.6, 0, player.z - 1.2);
      companion = {
        x: player.x - 1.6,
        z: player.z - 1.2,
        facing: 0,
        shootCooldown: 0.25,
        boostTimer: 0,
        orbitAngle: 0,
        model
      };
      floatText('🦉 БОЕВОЙ НАПАРНИК!', x, z, '#c084fc');
    } else {
      companion.boostTimer = 15.0;
      floatText('⚡ НАПАРНИК УСИЛЕН!', x, z, '#c084fc');
    }
  }

  function activateOverdrive(x, z) {
    player.overdriveAmmo = 5;
    player.overdriveMax = 5;
    if (player.maxAmmo > 0) {
      player.ammo = player.maxAmmo;
      if (player.isReloading) {
        player.isReloading = false;
        player.reloadTimer = 0;
        syncHeroReloadModel(false);
      }
    }
    audio?.playPickup?.('crate');
    emitShockwave(x, z, 4.0, 0xfbbf24, 0.32);
    emitParticles(x, 0.6, z, 0xfbbf24, 18, 5.5, 0.16);
    floatText('🔥 СУПЕР-ЗАРЯД (5)!', player.x, player.z, '#fbbf24');
  }

  function activateBeastMode() {
    player.seals = 0;
    player.beastTimeLeft = 10.0;
    if (player.maxAmmo > 0) {
      player.ammo = player.maxAmmo;
    }
    if (player.maxMana > 0) {
      player.mana = player.maxMana;
    }
    if (player.isReloading) {
      player.isReloading = false;
      player.reloadTimer = 0;
      syncHeroReloadModel(false);
    }

    const cls = CLASSES[currentClassId] || CLASSES.warrior;
    heroModel?.handle?.setBeastMode?.(true, currentClassId);
    heroModel?.obj?.userData?.setBeastMode?.(true, currentClassId);

    audio?.playBeastRoar?.();
    world?.addScreenShake?.(0.72, 0.42);
    emitShockwave(player.x, player.z, 7.8, cls.beastColor || 0xd9480f, 0.48);
    emitParticles(player.x, 0.9, player.z, cls.beastColor || 0xd9480f, 32, 8.5, 0.22);
    floatText(`🐺 ${cls.beastNameRu.toUpperCase()}!`, player.x, player.z, '#fb923c');

    damageEnemiesInRadius(player.x, player.z, 5.5, Math.round(stats.damage * 1.8), 11.0, null);
  }

  // === Persistent Hero XP Progression (10x slower curve for gradual multi-stage progression, ZERO Combat Pause) ===
  function grantXp(amount, _suppressModal = false) {
    if (runEnded || pendingVictoryPayload) return;
    const scaled = Math.max(0, (Number(amount) || 0) * 0.1) + xpFraction;
    const gain = Math.floor(scaled);
    xpFraction = scaled - gain;
    if (gain <= 0) return;

    const res = progression.addHeroXp?.(gain);
    xp = res ? res.heroXp : xp + gain;
    xpNext = res ? res.heroXpNext : xpNext;
    runLevel = res ? res.newLevel : runLevel;

    if (res?.leveledUp) {
      audio?.playLevelUp?.();
      emitShockwave(player.x, player.z, 4.6, 0xfde047, 0.36);
      emitParticles(player.x, 0.9, player.z, 0xfde047, 18, 5.5, 0.16);
      floatText(`⭐ УРОВЕНЬ ${res.newLevel}! +1 Очко таланта`, player.x, player.z, '#fde047');
      callbacks?.onHeroLevelUp?.(res);
    }
  }

  function triggerNextLevelUpIfReady() {
    // "Благословение душ" combat modal disabled per design: skill points are spent in Menu Talents only.
    pendingLevelUps = 0;
    awaitingLevelUpChoice = false;
  }

  function applyLevelUpChoice(choiceId) {
    const prevMaxHp = stats ? stats.maxHp : player.maxHp;

    if (choiceId === 'weapon_level_up') {
      weaponRunLevel += 1;
      const wpnDef = WEAPONS[currentWeaponId] || WEAPONS.club;
      floatText(`${wpnDef.nameRu} РАНГ ${weaponRunLevel}!`, player.x, player.z, '#fde047');
    } else if (choiceId) {
      const wasFirstSoulNova = choiceId === 'soul_nova' && !perks.soul_nova;
      perks[choiceId] = (perks[choiceId] || 0) + 1;
      if (wasFirstSoulNova) {
        player.soulNovaTimer = 0.5;
      }
      const perkDef = RUN_UPGRADES.find((u) => u.id === choiceId);
      if (perkDef) {
        floatText(`${perkDef.icon} ${perkDef.nameRu}!`, player.x, player.z, '#c084fc');
      }
    }

    recomputeStats();

    // Choosing ammo_pouch immediately tops up magazine (or surges Mana!) and cancels reload!
    if (choiceId === 'ammo_pouch') {
      if (player.maxAmmo > 0) {
        player.ammo = player.maxAmmo;
        if (player.isReloading) {
          player.isReloading = false;
          player.reloadTimer = 0;
          syncHeroReloadModel(false);
        }
        audio?.playReloadReady?.();
      } else if (player.maxMana > 0) {
        player.mana = player.maxMana;
      }
    }

    const hpGainFromMax = Math.max(0, stats.maxHp - prevMaxHp);
    const bonusHeal = choiceId === 'war_iron_banner' ? 24 : 8;
    player.hp = Math.min(stats.maxHp, player.hp + hpGainFromMax + bonusHeal);
    if (choiceId === 'mage_arcane_ward') {
      player.arcaneWardReady = true;
    } else if (choiceId === 'mage_meteor_shower') {
      player.meteorTimer = 0.6;
    } else if (choiceId === 'war_whirlwind') {
      player.whirlwindTimer = 0.7;
    }

    awaitingLevelUpChoice = false;
    triggerNextLevelUpIfReady();
  }

  // === Revive (Yandex Rewarded Video) ===
  function revivePlayer() {
    if (!stats) recomputeStats();
    player.hp = stats.maxHp;
    player.invulnTimer = 2.5;
    if (player.maxAmmo > 0) {
      player.ammo = player.maxAmmo;
    }
    if (player.maxMana > 0) {
      player.mana = player.maxMana;
    }
    if (player.isReloading) {
      player.isReloading = false;
      player.reloadTimer = 0;
      syncHeroReloadModel(false);
    }
    runEnded = false;
    runActive = true;

    audio?.playLevelUp?.();
    world?.addScreenShake?.(0.68, 0.38);
    emitShockwave(player.x, player.z, 9.5, 0xfde047, 0.55);
    emitParticles(player.x, 0.9, player.z, 0xfde047, 32, 8.5, 0.22);
    floatText('✨ ВОСКРЕШЕНИЕ!', player.x, player.z, '#fde047');

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.hp <= 0) continue;
      const dx = e.x - player.x;
      const dz = e.z - player.z;
      const dist = Math.hypot(dx, dz) || 0.001;
      if (dist < 10.5) {
        const pushForce = e.isBoss ? 7.5 : 16.5;
        e.vx += (dx / dist) * pushForce;
        e.vz += (dz / dist) * pushForce;
        e.stunTimer = Math.max(e.stunTimer, e.isBoss ? 0.3 : 0.75);
      }
    }
    for (let i = projectiles.length - 1; i >= 0; i--) {
      if (projectiles[i].isEnemy) {
        removeSceneObject(projectiles[i].vis.obj, projectiles[i].vis.handle);
        projectiles.splice(i, 1);
      }
    }
  }

  // === Damage, Crits, Shieldbearer Armor, Elemental Statuses & Death ===
  function applyDamageToEnemy(enemy, amount, knockX = 0, knockZ = 0, allowChain = true, hitMeta = null) {
    if (!enemy || enemy.hp <= 0) return;

    const isDoT = Boolean(hitMeta?.isDoT);
    const isProjectile = Boolean(hitMeta?.isProjectile);
    const isCrit = Boolean(hitMeta?.isCrit);
    const isWaterSlam = Boolean(hitMeta?.isWaterSlam);
    const isSplash = Boolean(hitMeta?.isSplash);
    const hitElem = hitMeta?.mageElement || null;
    let finalAmount = amount;
    let kx = knockX;
    let kz = knockZ;

    // 🩸 Казнь Кровопийцы (war_blood_cleave): +50% execution damage against wounded enemies (<45% HP)!
    if (!isDoT && (stats?.warBloodStacks || 0) > 0 && enemy.hp < enemy.maxHp * 0.45) {
      finalAmount *= 1 + stats.warBloodStacks * 0.50;
    }

    // 🔥 Fire Element (Batrider Napalm): existing Napalm stacks amplify incoming damage by +12% per stack!
    if (!isDoT && hitElem === 'fire' && (enemy.napalmStacks || 0) > 0 && (enemy.napalmTimer || 0) > 0) {
      finalAmount *= 1 + enemy.napalmStacks * 0.12;
    }

    // General Mob Armor vs Hero Weapon Armor Penetration (armorPierce)
    const pierce = clamp(hitMeta?.armorPierceOverride ?? stats?.armorPierce ?? 0, 0, 1);
    if (!isDoT && enemy.armor > 0) {
      const effArmor = Math.max(0, enemy.armor * (1 - pierce));
      finalAmount *= 1 - effArmor;
    }

    // Shieldbearer Frontal Steel Shield (±75° dot-product check!)
    if (isProjectile && !isCrit && enemy.frontArmor > 0) {
      const fx = Math.sin(enemy.facing);
      const fz = Math.cos(enemy.facing);
      // Vector pointing out from enemy toward incoming projectile source
      const toSourceX = -(hitMeta.dirX || 0);
      const toSourceZ = -(hitMeta.dirZ || 0);
      const dot = fx * toSourceX + fz * toSourceZ;

      if (dot >= COS_75_DEG) {
        // Point-blank < 3.2m shotgun blasts bypass half the shield, plus armorPierce penetrates shields!
        const isPointBlankBuckshot = Boolean(hitMeta.isShotgunPellet && (hitMeta.traveled || 0) < 3.2);
        const baseFront = isPointBlankBuckshot ? enemy.frontArmor * 0.5 : enemy.frontArmor;
        const armorMult = baseFront * (1 - pierce * 0.55);
        finalAmount *= 1 - armorMult;
        kx *= isPointBlankBuckshot ? 0.65 : 0.35;
        kz *= isPointBlankBuckshot ? 0.65 : 0.35;

        if (shieldSparkCooldown <= 0) {
          shieldSparkCooldown = 0.06;
          audio?.playBlock?.();
          emitParticles(enemy.x + fx * 0.45, 0.82, enemy.z + fz * 0.45, 0x93c5fd, 5, 5.2, 0.12);
          emitParticles(enemy.x + fx * 0.45, 0.82, enemy.z + fz * 0.45, 0xffffff, 3, 4.0, 0.09);
        }
      }
    }

    const dmg = Math.max(1, Math.round(finalAmount));
    enemy.hp -= dmg;

    const resistMult = enemy.isMiniBoss
      ? 0.28
      : enemy.isBoss
        ? 0.14
        : enemy.isWarden
          ? 0.32
          : enemy.canCharge
            ? 0.52
            : 1.0;
    enemy.vx += kx * resistMult;
    enemy.vz += kz * resistMult;

    if (!isDoT) {
      triggerModelHitFlash(enemy.model);
      enemy.model?.handle?.playHitFlinch?.();
      // Bone-splinter chip particles when hitting skeletons!
      emitParticles(enemy.x, 0.78, enemy.z, 0xe7e0d0, 2, 3.6, 0.09);

      if (hitSoundCooldown <= 0) {
        hitSoundCooldown = 0.045;
        if (hitElem) {
          audio?.playElementImpact?.(hitElem);
        } else {
          audio?.playHit?.();
        }
      }

      // 🛡️🪖 3-Stage Progressive Shield (≤67% HP) & Helmet (≤34% HP) Break-Off!
      if (!enemy.isBoss && enemy.hp > 0) {
        const hitDirAng = Math.atan2(kx || 0.1, kz || 0.1);
        if (enemy.hp <= enemy.maxHp * 0.67 && (enemy.damageStage || 0) < 1) {
          enemy.damageStage = 1;
          const brokenPart = enemy.model?.handle?.setDamageStage?.(1);
          if (brokenPart) {
            enemy.frontArmor = 0;
            world?.spawnArmorBreakPiece?.('shield', enemy.x, enemy.z, hitDirAng);
            audio?.playArmorBreak?.('shield');
            if (critFloaterCooldown <= 0) {
              critFloaterCooldown = 0.08;
              floatText('🛡️ ЩИТ СБИТ!', enemy.x, enemy.z, '#93c5fd');
            }
          }
        }
        if (enemy.hp <= enemy.maxHp * 0.34 && (enemy.damageStage || 0) < 2) {
          enemy.damageStage = 2;
          const brokenHelm = enemy.model?.handle?.setDamageStage?.(2);
          if (brokenHelm) {
            world?.spawnArmorBreakPiece?.('helmet', enemy.x, enemy.z, hitDirAng);
            audio?.playArmorBreak?.('helmet');
            if (critFloaterCooldown <= 0) {
              critFloaterCooldown = 0.08;
              floatText('🪖 КАСКА СЛЕТЕЛА!', enemy.x, enemy.z, '#cbd5e1');
            }
          }
        }
      }

      if (isCrit) {
        const hitLen = Math.hypot(kx, kz) || 1;
        const cDirX = kx ? kx / hitLen : 0;
        const cDirZ = kz ? kz / hitLen : 1;
        world?.spawnCritBloodBurst?.({ x: enemy.x, z: enemy.z, dirX: cDirX, dirZ: cDirZ });
        audio?.playCritStrike?.();
        world?.addScreenShake?.(0.20, 0.12);
        if (critFloaterCooldown <= 0) {
          critFloaterCooldown = 0.09;
          floatText(`🩸 КРИТ ${dmg}!`, enemy.x, enemy.z, '#fca5a5');
        }
        // 💀 Жнец Черепов (crit_fang): crit triggers crimson blood-shrapnel burst on nearby enemies (ZERO flat red circle)!
        const critBlastStacks = stats?.critExplosionStacks || 0;
        if (critBlastStacks > 0 && allowChain) {
          emitParticles(enemy.x, 0.85, enemy.z, 0xdc2626, 12, 6.8, 0.16);
          damageEnemiesInRadius(enemy.x, enemy.z, 2.2, Math.max(2, Math.round(dmg * 0.35 * critBlastStacks)), 4.5, enemy, false);
        }
      } else {
        emitParticles(
          enemy.x,
          0.65,
          enemy.z,
          enemy.eliteType === 'purple' ? 0xc084fc : 0xfef08a,
          4,
          4.0,
          0.12
        );
      }

      // 🔫 Рикошет Свинца (gun_ricochet): buckshot pellets bounce to a nearby enemy!
      const ricochetStacks = stats?.gunRicochetStacks || 0;
      if (allowChain && hitMeta?.isShotgunPellet && ricochetStacks > 0) {
        const ricChance = Math.min(1.0, 0.25 + ricochetStacks * 0.25);
        if (Math.random() < ricChance) {
          triggerChainLightning(enemy, Math.max(2, Math.round(dmg * 0.65)), 1, 0xfbbf24);
        }
      }

      // === 4 MAGE ELEMENTAL EFFECTS ===
      const catStacks = stats?.mageCatalystStacks || 0;
      if (hitElem === 'fire') {
        const addStacks = 1 + (catStacks > 0 ? 1 : 0);
        const maxNapalm = 8 + catStacks * 2;
        enemy.napalmStacks = Math.min(maxNapalm, ((enemy.napalmTimer || 0) > 0 ? (enemy.napalmStacks || 0) : 0) + addStacks);
        enemy.napalmTimer = 4.2;
        enemy.burnTimer = Math.max(enemy.burnTimer || 0, 3.0);
        enemy.burnDps = Math.max(enemy.burnDps || 0, Math.max(4, Math.round((stats?.damage || 24) * (0.14 + enemy.napalmStacks * 0.08))));
        emitParticles(enemy.x, 0.72, enemy.z, 0xff5722, 5, 3.8, 0.13);
        if (enemy.napalmStacks >= 2 && enemy.napalmStacks % 2 === 0 && critFloaterCooldown <= 0) {
          critFloaterCooldown = 0.14;
          floatText(`🔥×${enemy.napalmStacks}`, enemy.x, enemy.z, '#fb923c');
        }
      } else if (hitElem === 'water') {
        enemy.soakedTimer = 3.0;
        enemy.frostTimer = Math.max(enemy.frostTimer || 0, 2.6);
        enemy.frostFactor = Math.min(enemy.frostFactor || 1.0, 0.58);
        emitParticles(enemy.x, 0.68, enemy.z, 0x38bdf8, 5, 3.4, 0.12);

        // 💧 STRICTLY FOR MAGE + WATER ELEMENT: 7% chance (+5% per Резонанс Стихии stack) to spawn Avatar-style levitating Water Sphere!
        // Lifts enemies in small radius into the air for 1.1s, then slams them down for 3x normal attack damage!
        if (
          currentClassId === 'mage' &&
          !isWaterSlam &&
          !isSplash &&
          (enemy.waterLiftTimer || 0) <= 0 &&
          activeWaterPrisons.length < 4
        ) {
          const waterSphereChance = 0.07 + catStacks * 0.05;
          if (Math.random() < waterSphereChance) {
            const sphereRad = 2.65;
            const sphereDur = 1.1;
            const captured = [];
            for (let ci = 0; ci < enemies.length; ci++) {
              const ce = enemies[ci];
              if (!ce || ce.hp <= 0) continue;
              if (Math.hypot(ce.x - enemy.x, ce.z - enemy.z) <= sphereRad + ce.radius * 0.5) {
                ce.waterLiftTimer = sphereDur;
                ce.stunTimer = Math.max(ce.stunTimer || 0, sphereDur + 0.15);
                ce.vx = 0;
                ce.vz = 0;
                captured.push(ce);
              }
            }
            if (captured.length > 0) {
              const normalAttackDmg = stats?.damage || 28;
              world?.spawnWaterPrisonSphere?.({ x: enemy.x, z: enemy.z, radius: sphereRad, duration: sphereDur });
              audio?.playElementImpact?.('water_prison_open');
              floatText('🌊 ВОДЯНОЙ ШАР!', enemy.x, enemy.z, '#38bdf8');
              activeWaterPrisons.push({
                x: enemy.x,
                z: enemy.z,
                radius: sphereRad,
                timer: sphereDur,
                duration: sphereDur,
                slamDamage: Math.max(3, Math.round(normalAttackDmg * 3.0)),
                targets: captured
              });
            }
          }
        }
      } else if (hitElem === 'lightning' && allowChain) {
        const bounceTargets = 1 + catStacks;
        const arcDmg = Math.max(2, Math.round(dmg * (0.58 + catStacks * 0.12)));
        triggerChainLightning(enemy, arcDmg, bounceTargets, 0x38bdf8);
      } else if (hitElem === 'air') {
        enemy.stunTimer = Math.max(enemy.stunTimer || 0, enemy.isBoss ? 0.06 : 0.24);
        emitParticles(enemy.x, 0.72, enemy.z, 0x5eead4, 5, 4.4, 0.12);
      }
    }

    if (enemy.hp <= 0) {
      handleEnemyDeath(enemy);
    }
  }

  function triggerChainLightning(originEnemy, chainDamage, maxBounces = 1, boltColor = 0x38bdf8) {
    let bounced = 0;
    let bestCandidates = [];
    for (let i = 0; i < enemies.length; i++) {
      const candidate = enemies[i];
      if (candidate === originEnemy || candidate.hp <= 0) continue;
      const dist = Math.hypot(candidate.x - originEnemy.x, candidate.z - originEnemy.z);
      if (dist <= 6.8) {
        bestCandidates.push({ candidate, dist });
      }
    }
    bestCandidates.sort((a, b) => a.dist - b.dist);
    for (let i = 0; i < bestCandidates.length && bounced < maxBounces; i++) {
      const { candidate } = bestCandidates[i];
      bounced += 1;
      world?.spawnLightningArc?.({
        x1: originEnemy.x,
        z1: originEnemy.z,
        x2: candidate.x,
        z2: candidate.z,
        color: boltColor
      });
      candidate.stunTimer = Math.max(candidate.stunTimer || 0, candidate.isBoss ? 0.05 : 0.16);
      emitParticles(candidate.x, 0.78, candidate.z, boltColor, 6, 4.2, 0.14);
      applyDamageToEnemy(candidate, chainDamage, 0, 0, false);
    }
  }

  function damageEnemiesInRadius(cx, cz, radius, damage, knockbackForce, excludeEnemy = null, canCrit = false, mageElement = null) {
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (!e || e === excludeEnemy || e.hp <= 0) continue;
      const dx = e.x - cx;
      const dz = e.z - cz;
      const dist = Math.hypot(dx, dz);
      if (dist <= radius + e.radius) {
        const nx = dist > 0.001 ? dx / dist : 0;
        const nz = dist > 0.001 ? dz / dist : 1;
        const isCrit = canCrit && Math.random() < (stats?.critChance || 0.04);
        const hitDmg = isCrit ? Math.round(damage * (stats?.critMult || 1.75)) : damage;
        applyDamageToEnemy(e, hitDmg, nx * knockbackForce, nz * knockbackForce, false, { isCrit, isSplash: true, mageElement });
      }
    }
  }

  function handleEnemyDeath(enemy) {
    if (enemy._deadHandled) return;
    enemy._deadHandled = true;

    // 💧 Water Element Mana Siphon: slaying drenched enemies restores +3 Mana!
    if ((enemy.soakedTimer || 0) > 0 && stats?.usesMana && player.maxMana > 0) {
      player.mana = Math.min(player.maxMana, player.mana + 3);
      emitParticles(enemy.x, 0.7, enemy.z, 0x38bdf8, 4, 3.2, 0.12);
    }
    kills += 1;

    emitParticles(
      enemy.x,
      0.65,
      enemy.z,
      enemy.eliteType === 'purple'
        ? 0xa855f7
        : enemy.eliteType === 'blue'
          ? 0x38bdf8
          : enemy.color || 0xd6d3d1,
      enemy.isBoss && !enemy.isMiniBoss ? 42 : enemy.isMiniBoss ? 24 : 11,
      enemy.isBoss ? 8.8 : 5.4,
      enemy.isBoss ? 0.22 : 0.15
    );

    // 💀 3D Physics Bone-Shatter + Authentic Rigged Skeleton Death Collapse!
    world?.spawnBoneShatter?.(enemy.x, enemy.z, Boolean(enemy.isBoss || enemy.isMiniBoss));
    audio?.playArmorBreak?.('bones');
    if (enemy.model && !enemy._corpseTransferred) {
      enemy._corpseTransferred = true;
      enemy.model.obj.position.y = 0;
      enemy.model.obj.rotation.z = 0;
      enemy.model.handle?.playDeathCollapse?.();
      const maxDyingCorpses =
        typeof navigator !== 'undefined' && /iPhone|iPod|iPad|Android/i.test(navigator.userAgent || '')
          ? 6
          : 9;
      if (dyingCorpses.length >= maxDyingCorpses) {
        const oldest = dyingCorpses.shift();
        removeSceneObject(oldest.model.obj, oldest.model.handle);
      }
      dyingCorpses.push({ model: enemy.model, age: 0, duration: 0.66 });
    }

    // Toxic Slime / Bomber spawns 0.80s acid/explosive hazard pool on death!
    if (enemy.explodesOnDeath && !enemy.bomberTriggered) {
      enemy.bomberTriggered = true;
      spawnBomberHazard(enemy.x, enemy.z, enemy.hazardColor || 0x22c55e);
    }

    // 🩸 Казнь Кровопийцы (war_blood_cleave): heal +12 HP per stack every 9 kills!
    const bloodCleaveStacks = stats?.warBloodStacks || 0;
    if (bloodCleaveStacks > 0) {
      player.vampiricKills += 1;
      if (player.vampiricKills >= 9) {
        player.vampiricKills = 0;
        const heal = 12 * bloodCleaveStacks;
        player.hp = Math.min(stats.maxHp, player.hp + heal);
        floatText(`+${heal} HP`, player.x, player.z, '#f87171');
      }
    }

    // Direct & immediate Gold + Soul XP (ZERO floor coins or XP meshes!)
    const earnedGold = Math.max(1, Math.round((enemy.gold || 1) * (stats?.goldMult || 1)));
    progression.addGold(earnedGold);
    goldRun += earnedGold;

    // Hammer Boss 10% Exclusive Boss Hammer Drop (first clear of milestone Stages 5, 10, 15, 20, 25 ONLY!)
    if ((enemy.type === 'boss_troll' || enemy.type === 'boss_warden') && [5, 10, 15, 20, 25].includes(currentLevelNumber)) {
      if (!progression.hasAttemptedBossHammerStage?.(currentLevelNumber)) {
        progression.markBossHammerAttempted?.(currentLevelNumber);
        if (!progression.isWeaponUnlocked('boss_hammer') && Math.random() < 0.10) {
          progression.unlockWeapon('boss_hammer');
          unlockedWeaponThisRun = WEAPONS.boss_hammer || unlockedWeaponThisRun;
          audio?.playWeaponUnlock?.();
          world?.addScreenShake?.(0.68, 0.40);
          emitShockwave(enemy.x, enemy.z, 7.5, 0xfde047, 0.58);
          emitParticles(enemy.x, 1.0, enemy.z, 0xfde047, 36, 9.0, 0.24);
          floatText('🔨 ВЫБИТ ТРОФЕЙ: МОЛОТ КОСТОЛОМА!', player.x, player.z - 1.1, '#fde047');
          if (WEAPONS.boss_hammer) callbacks?.onWeaponUnlocked?.(WEAPONS.boss_hammer);
        }
      }
    }

    // Check if this enemy is a Finale Target (Milestone Boss, Finale Mini-Boss, or Elite Finale Champion)
    let triggersChapterVictory = false;
    if (enemy.isFinaleTarget) {
      let remainingFinaleTargets = 0;
      let nextAliveFinaleTarget = null;
      for (let i = 0; i < enemies.length; i++) {
        const other = enemies[i];
        if (other && other !== enemy && other.isFinaleTarget && other.hp > 0) {
          remainingFinaleTargets += 1;
          if (!nextAliveFinaleTarget) nextAliveFinaleTarget = other;
        }
      }
      if (remainingFinaleTargets === 0) {
        triggersChapterVictory = true;
      } else {
        bossEntity = nextAliveFinaleTarget;
        floatText(`⚔️ ЕЩЁ ${remainingFinaleTargets} ЧЕМПИОН!`, enemy.x, enemy.z, '#fbbf24');
      }
    }

    grantXp(enemy.xp || 0, triggersChapterVictory);

    if (triggersChapterVictory) {
      triggerFinaleVictory(enemy);
      return;
    }

    // Mid-run Mini-Boss loot cache!
    if (enemy.isMiniBoss && !enemy.isFinaleTarget) {
      const crateKind = !companion && Math.random() < 0.45 ? 'companion_crate' : 'supply_crate';
      spawnPickup(crateKind, enemy.x, enemy.z);
      spawnPickup('heart', enemy.x - 0.75, enemy.z, { value: Math.round(stats.maxHp * 0.30) });
      spawnPickup('clover', enemy.x + 0.75, enemy.z);
      floatText(`+${earnedGold} 💰`, enemy.x, enemy.z, '#fbbf24');
      return;
    }

    // Rare tactical drops ONLY (Supply Crate, Companion Crate, Heart, Clover)
    const beastNow = player.beastTimeLeft > 0;
    if (enemy.eliteType === 'purple') {
      const dropCompanion = !companion && Math.random() < 0.48 ? 'companion_crate' : 'supply_crate';
      spawnPickup(dropCompanion, enemy.x, enemy.z);
    } else if (enemy.eliteType === 'blue') {
      spawnPickup('heart', enemy.x - 0.45, enemy.z, { value: Math.round(stats.maxHp * 0.25) });
      if (!beastNow && Math.random() < 0.32) {
        spawnPickup('clover', enemy.x + 0.45, enemy.z);
      }
    } else if (!enemy.isSummoned) {
      if (player.hp < stats.maxHp * 0.66 && Math.random() < 0.042) {
        spawnPickup('heart', enemy.x, enemy.z, { value: Math.round(stats.maxHp * 0.22) });
      } else if (!beastNow && Math.random() < 0.007) {
        spawnPickup('clover', enemy.x, enemy.z);
      }
    }
  }

  function triggerFinaleVictory(defeatedBoss) {
    if (runEnded || pendingVictoryPayload) return;

    const greedMult = 1 + (perks.greed_contract || 0) * 0.30;
    const rawChapterBonus = currentLevelDef.hasBoss
      ? 90 + currentLevelNumber * 6
      : 38 + currentLevelNumber * 4;
    const bonusGold = Math.round(rawChapterBonus * greedMult);
    progression.addGold(bonusGold);
    goldRun += bonusGold;

    // Golden celebration burst (zero floor coins!)
    emitParticles(defeatedBoss.x, 0.9, defeatedBoss.z, 0xfbbf24, 34, 8.8, 0.20);
    emitParticles(defeatedBoss.x, 1.1, defeatedBoss.z, 0xfde047, 22, 6.5, 0.16);

    // Reward chapter tier weapon ONLY for classes without Shop weapon purchases
    if (currentLevelDef.unlockWeaponTier && currentClassId !== 'warrior' && currentClassId !== 'gunslinger') {
      const tierWeapon = findClassWeaponByTier(currentClassId, currentLevelDef.unlockWeaponTier);
      if (tierWeapon && !progression.isWeaponUnlocked(tierWeapon)) {
        unlockTierWeaponIfNeeded(tierWeapon, defeatedBoss.x, defeatedBoss.z, true);
      }
    }

    progression.unlockNextLevel(currentLevelNumber);
    world?.setBossAtmosphere?.(false);
    audio?.playExplosion?.();
    audio?.playWeaponUnlock?.();
    world?.addScreenShake?.(0.85, 0.52);
    emitShockwave(defeatedBoss.x, defeatedBoss.z, 11.0, 0xfde047, 0.65);
    floatText(`🏆 ПОБЕДА! +${bonusGold} 💰`, player.x, player.z, '#fde047');

    // Wipe remaining minor undead in victory shockwave
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (e !== defeatedBoss && e.hp > 0) {
        emitParticles(e.x, 0.5, e.z, 0xfde047, 5, 4.5, 0.13);
        e.hp = 0;
      }
    }
    bossHazards.length = 0;
    bomberHazards.length = 0;

    const hpRatio = player.maxHp > 0 ? clamp(player.hp / player.maxHp, 0, 1) : 1;
    const elapsedSec = Math.round(elapsedRunTime);
    const star2 = hpRatio >= 0.55;
    const star3 = elapsedSec <= 95;
    const stars = 1 + (star2 ? 1 : 0) + (star3 ? 1 : 0);
    progression.recordLevelStars?.(currentLevelNumber, stars);

    pendingVictoryPayload = {
      victory: true,
      level: currentLevelNumber,
      goldEarned: goldRun,
      kills,
      hpRatio: +hpRatio.toFixed(2),
      elapsedSec,
      stars,
      starDetails: { win: true, highHp: star2, fastClear: star3 },
      difficulty: currentDifficulty,
      unlockedWeapon: unlockedWeaponThisRun
    };
    victoryDelayTimer = 0.8;
  }

  function applyDamageToPlayer(rawDamage) {
    if (runEnded || pendingVictoryPayload) return;
    if (player.invulnTimer > 0 || player.beastTimeLeft > 0) return;

    // Swift Boots spectral dodge!
    if (Math.random() < (stats?.dodgeChance || 0)) {
      player.invulnTimer = 0.28;
      emitParticles(player.x, 0.82, player.z, 0x34d399, 10, 5.0, 0.14);
      floatText('УКЛОНЕНИЕ!', player.x, player.z, '#34d399');
      return;
    }

    let dmg = rawDamage * (1 - (stats?.damageBlock || 0));

    // 🛡️ Сфера Отражения (mage_arcane_ward): absorbs 65% damage & blasts attackers away!
    if ((stats?.mageWardStacks || 0) > 0 && player.arcaneWardReady) {
      player.arcaneWardReady = false;
      player.arcaneWardTimer = Math.max(4.5, 8.5 - stats.mageWardStacks * 1.2);
      dmg *= 0.35;
      const wardColor = stats.mageElementColor || 0xc084fc;
      audio?.playMagicCast?.(stats.mageElement || 'void_orb');
      emitShockwave(player.x, player.z, 4.4, wardColor, 0.36);
      emitParticles(player.x, 0.85, player.z, wardColor, 16, 6.5, 0.16);
      damageEnemiesInRadius(player.x, player.z, 4.4, Math.round(stats.damage * (0.9 + stats.mageWardStacks * 0.45)), 15.0, null, false, stats.mageElement);
      floatText('🔮 ЩИТ ЧАР!', player.x, player.z, '#c084fc');
    }

    // Class Shield Block Passive!
    if (Math.random() < (stats?.blockChance || 0)) {
      dmg *= 0.5;
      audio?.playBlock?.();
      emitParticles(player.x, 0.85, player.z, 0xfbbf24, 10, 5.2, 0.15);
      floatText('БЛОК!', player.x, player.z, '#fbbf24');
    }

    const finalDmg = Math.max(1, Math.round(dmg));
    player.hp = Math.max(0, player.hp - finalDmg);
    player.invulnTimer = 0.44;

    triggerModelHitFlash(heroModel);
    audio?.playHit?.();
    world?.addScreenShake?.(0.34, 0.18);
    emitParticles(player.x, 0.75, player.z, 0xef4444, 9, 4.8, 0.15);

    if (player.hp <= 0) {
      player.hp = 0;
      runEnded = true;
      runActive = false;
      callbacks?.onRunEnd?.({
        victory: false,
        level: currentLevelNumber,
        goldEarned: goldRun,
        kills,
        elapsedSec: Math.round(elapsedRunTime),
        difficulty: currentDifficulty,
        unlockedWeapon: unlockedWeaponThisRun
      });
    }
  }

  // === Projectiles & Class Attacks ===
  function spawnProjectile({
    x,
    z,
    vx,
    vz,
    damage,
    maxDist,
    pierce = 1,
    pierceDecay = null,
    splashRadius = 0,
    knockback = 3.0,
    kind = 'ranged',
    visualType = null,
    isShotgunPellet = false,
    isCrit = false,
    color = 0xfbbf24,
    isEnemy = false,
    ignoreCrateUid = 0,
    mageElement = null
  }) {
    const scale =
      kind === 'magic' ? 1.28 : isEnemy ? 0.84 : isShotgunPellet ? 0.66 : 0.74;
    const vis = makeProjectileVisual(visualType || kind, color, scale);
    vis.obj.position.set(x, 0.78, z);
    vis.obj.rotation.y = Math.atan2(vx, vz);

    projectiles.push({
      x,
      z,
      vx,
      vz,
      damage,
      traveled: 0,
      maxDist,
      pierceLeft: pierce,
      pierceDecay,
      hitsLanded: 0,
      splashRadius,
      knockback,
      kind,
      isShotgunPellet,
      isCrit,
      color,
      isEnemy,
      ignoreCrateUid,
      mageElement,
      hitUids: new Set(),
      trailTick: 0,
      vis
    });
  }

  function findAutoAimTarget(maxRange) {
    let bestTarget = null;
    let bestScore = maxRange;
    const arenaCap = ARENA_HALF_SIZE - 0.35;

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.hp <= 0) continue;
      if (Math.abs(e.x) > arenaCap || Math.abs(e.z) > arenaCap) continue;
      if (!stats?.clampToArenaBounds && world?.isWorldPointVisible && !world.isWorldPointVisible(e.x, e.z, 0.85, 0.93)) continue;
      const dx = e.x - player.x;
      const dz = e.z - player.z;
      const edgeDist = Math.max(0, Math.hypot(dx, dz) - (e.radius || 0));
      if (edgeDist <= bestScore) {
        bestScore = edgeDist;
        bestTarget = e;
      }
    }

    if (bestTarget) return bestTarget;

    // Auto-target Relic Weapon Crate when nearby AND visible on screen
    for (let i = 0; i < pickups.length; i++) {
      const p = pickups[i];
      if (p.type === 'relic_weapon_crate' && p.hp > 0) {
        if (world?.isWorldPointVisible && !world.isWorldPointVisible(p.x, p.z, 0.75, 0.93)) continue;
        const dx = p.x - player.x;
        const dz = p.z - player.z;
        const edgeDist = Math.max(0, Math.hypot(dx, dz) - (p.radius || 0));
        if (edgeDist <= maxRange) {
          return p;
        }
      }
    }
    return null;
  }

  function performHeroAttack(aimAngle, isManualTrigger = false) {
    const wpn = WEAPONS[currentWeaponId] || WEAPONS.club;
    const isOverdrive = player.overdriveAmmo > 0;
    const isBeastFree = player.beastTimeLeft > 0;
    const usesMag = (stats.magSize || 0) > 0;
    const usesMana = Boolean(stats.usesMana && player.maxMana > 0);

    if (!isOverdrive && !isBeastFree && usesMana) {
      const mCost = stats.manaCost || 8;
      if (player.mana < mCost) {
        if (isManualTrigger && manaEmptyHintCooldown <= 0) {
          manaEmptyHintCooldown = 0.85;
          floatText('💧 Мало маны!', player.x, player.z, '#60a5fa');
        }
        return;
      }
      player.mana = Math.max(0, player.mana - mCost);
    }

    let ammoBeforeShot = player.ammo;
    if (!isOverdrive && usesMag) {
      if (player.isReloading) {
        // Interruptible shell-by-shell partial reload: firing with loaded shell(s) cancels reload!
        if ((stats?.reloadPerShellTime || 0) > 0 && player.ammo > 0) {
          player.isReloading = false;
          player.reloadTimer = 0;
          player.reloadShellAccum = 0;
          syncHeroReloadModel(false);
        } else {
          return;
        }
      }
      if (player.ammo <= 0) {
        triggerReload();
        return;
      }
      ammoBeforeShot = player.ammo;
      player.ammo = Math.max(0, player.ammo - 1);
    }

    if (isOverdrive) {
      player.overdriveAmmo = Math.max(0, player.overdriveAmmo - 1);
      if (player.overdriveAmmo === 0 && overdriveCrateVisual) {
        removeSceneObject(overdriveCrateVisual, overdriveCrateVisual);
        overdriveCrateVisual = null;
      }
    }

    // 🔥 Гнев Несокрушимого (war_iron_banner): missing HP boosts Warrior attack speed & damage up to +45% per stack!
    const missingHpRatio = wpn.type === 'melee' && (stats.warBannerStacks || 0) > 0
      ? clamp(1 - player.hp / Math.max(1, stats.maxHp), 0, 0.85)
      : 0;
    const berserkBoost = 1 + missingHpRatio * (stats.warBannerStacks || 0) * 0.52;

    player.facing = aimAngle;
    player.attackAnimTimer = 0.22;
    player.attackCooldown = (isOverdrive ? stats.cooldown / 1.55 : stats.cooldown) / berserkBoost;
    triggerModelAttack(heroModel, wpn.type, player.attackCooldown);

    const dirX = Math.sin(aimAngle);
    const dirZ = Math.cos(aimAngle);
    const muzzleX = player.x + dirX * 0.80;
    const muzzleZ = player.z + dirZ * 0.80;

    // Physical recoil kickback for ranged & magic weapons (strongest on heavy shotguns!)
    if (wpn.recoilKick > 0) {
      const kickScale = isOverdrive ? 0.65 : 1.0;
      player.recoilVx -= dirX * wpn.recoilKick * kickScale;
      player.recoilVz -= dirZ * wpn.recoilKick * kickScale;
    }

    // 1. WARRIOR MELEE:
    //   - club (Sword): strict single-target precision strike (1 enemy max)
    //   - spear (Spear): narrow linear thrust piercing up to 2 enemies inline (1st 100%, 2nd 50%; side-by-side mobs NOT hit)
    //   - axe (Axe): heavy frontal cleave hitting up to 3 enemies IN FRONT at 100% splash damage
    //   - boss_hammer: heavy seismic shockwave smash
    if (wpn.type === 'melee') {
      player.meleeSwingCount = (player.meleeSwingCount || 0) + 1;
      const effCritChance = Math.max(0.14, stats.critChance || 0.14);
      const isCritSwing = Math.random() < effCritChance;

      audio?.playMeleeSwing?.(wpn.id, isCritSwing);
      const swingColor = isCritSwing ? 0xdc2626 : isOverdrive ? 0xf97316 : wpn.color;
      const effRange = isCritSwing ? stats.range * 1.12 : stats.range;
      const effArc = stats.arcAngle;
      const halfArc = effArc * 0.5 + 0.14;
      const baseMeleeDmg = Math.round((isOverdrive ? stats.damage * 1.25 : stats.damage) * berserkBoost);

      // Pick the single best aligned enemy in melee reach (closest + most centered on aim)
      let bestTarget = null;
      let bestScore = Infinity;
      let bestDx = dirX;
      let bestDz = dirZ;
      let bestDist = effRange * 0.8;
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (!e || e.hp <= 0) continue;
        const dx = e.x - player.x;
        const dz = e.z - player.z;
        const dist = Math.hypot(dx, dz);
        if (dist <= effRange + e.radius) {
          const angToEnemy = Math.atan2(dx, dz);
          const angDiff = Math.abs(normalizeAngle(angToEnemy - aimAngle));
          if (angDiff <= halfArc || dist <= 1.35) {
            const score = dist + angDiff * 1.35;
            if (score < bestScore) {
              bestScore = score;
              bestTarget = e;
              bestDx = dx;
              bestDz = dz;
              bestDist = dist;
            }
          }
        }
      }

      const isSpear = wpn.id === 'spear';
      const isAxe = wpn.id === 'axe';
      const isZwei = wpn.id === 'zweihander';
      const isHammer = wpn.id === 'boss_hammer';
      const isCleaveMelee = isAxe || isZwei || isHammer;
      const strikeAng = bestTarget ? Math.atan2(bestDx, bestDz) : aimAngle;
      const strikeVisualArc = isCleaveMelee
        ? effArc
        : isSpear
          ? Math.min(Math.PI * 0.22, effArc * 0.55)
          : Math.min(Math.PI * 0.36, effArc * 0.55);
      const strikeVisualRange = isSpear
        ? Math.max(1.85, effRange)
        : bestTarget
          ? Math.min(effRange, Math.max(1.6, bestDist + 0.45))
          : effRange * 0.92;
      emitSlashArc(player.x, player.z, strikeAng, isCleaveMelee ? Math.max(1.5, effRange) : strikeVisualRange, strikeVisualArc, swingColor);
      if (isCritSwing) {
        emitSlashArc(player.x, player.z, strikeAng, (isCleaveMelee ? Math.max(1.5, effRange) : strikeVisualRange) * 0.94, strikeVisualArc * 0.82, 0xfde047);
      }

      const hitDmg = isCritSwing ? Math.round(baseMeleeDmg * (stats.critMult || 1.85)) : baseMeleeDmg;
      const kbMult = isCritSwing ? 1.32 : 1.0;

      const findInlineBehindTarget = (ux, uz, primary, primaryDist, maxProjReach) => {
        let found = null;
        let bestInlineScore = Infinity;
        for (let i = enemies.length - 1; i >= 0; i--) {
          const e = enemies[i];
          if (!e || e.hp <= 0 || e === primary) continue;
          const ex = e.x - player.x;
          const ez = e.z - player.z;
          const projAlong = ex * ux + ez * uz;
          const lateralDist = Math.abs(ex * (-uz) + ez * ux);
          const cap = Math.max(maxProjReach + (e.radius || 0.45), primaryDist + (e.radius || 0.45) * 2.1 + 0.45);
          if (
            projAlong > primaryDist + 0.15 &&
            projAlong <= cap &&
            lateralDist <= Math.min(0.72, (e.radius || 0.45) + 0.24)
          ) {
            const inlineScore = projAlong + lateralDist * 2.0;
            if (inlineScore < bestInlineScore) {
              bestInlineScore = inlineScore;
              found = e;
            }
          }
        }
        return found;
      };

      const collectFrontalTargets = (maxCount) => {
        const extras = [];
        for (let i = enemies.length - 1; i >= 0; i--) {
          const e = enemies[i];
          if (!e || e.hp <= 0 || e === bestTarget) continue;
          const dx = e.x - player.x;
          const dz = e.z - player.z;
          const dist = Math.hypot(dx, dz);
          if (dist <= effRange + e.radius) {
            const angDiffFromStrike = Math.abs(normalizeAngle(Math.atan2(dx, dz) - strikeAng));
            if (angDiffFromStrike <= halfArc) {
              extras.push({ enemy: e, dx, dz, dist, score: angDiffFromStrike * 1.35 + dist });
            }
          }
        }
        extras.sort((a, b) => a.score - b.score);
        const list = [];
        if (bestTarget) {
          list.push({ enemy: bestTarget, dx: bestDx, dz: bestDz, dist: bestDist });
        }
        const slots = Math.max(0, maxCount - list.length);
        for (let i = 0; i < Math.min(slots, extras.length); i++) {
          list.push(extras[i]);
        }
        return list;
      };

      if (isSpear) {
        const ux = Math.sin(strikeAng);
        const uz = Math.cos(strikeAng);
        if (bestTarget) {
          const nx = bestDist > 0.001 ? bestDx / bestDist : ux;
          const nz = bestDist > 0.001 ? bestDz / bestDist : uz;
          const inlineSecond = findInlineBehindTarget(ux, uz, bestTarget, bestDist, effRange + 0.25);
          applyDamageToEnemy(bestTarget, hitDmg, nx * stats.knockback * kbMult, nz * stats.knockback * kbMult, true, { isCrit: isCritSwing });
          if (inlineSecond && inlineSecond.hp > 0) {
            const secDmg = Math.max(1, Math.round(hitDmg * 0.5));
            applyDamageToEnemy(inlineSecond, secDmg, ux * stats.knockback * 0.72 * kbMult, uz * stats.knockback * 0.72 * kbMult, true, { isCrit: isCritSwing, armorPierceOverride: 0.15 });
            emitParticles(inlineSecond.x, 0.75, inlineSecond.z, wpn.color || 0x38bdf8, 8, 4.5, 0.18);
          }
        }
        // Bold forward spear-lunge piercing streak VFX along thrust line
        for (let step = 1; step <= 4; step++) {
          const d = 0.55 + (step / 4) * Math.max(1.5, effRange);
          emitParticles(player.x + ux * d, 0.88, player.z + uz * d, wpn.color || 0x38bdf8, 3, 2.8, 0.14);
        }
      } else if (isCleaveMelee) {
        const targetsToHit = collectFrontalTargets(Math.max(1, wpn.maxTargets || (isZwei ? 2 : 3)));
        if (isHammer && bestTarget) {
          const ux = Math.sin(strikeAng);
          const uz = Math.cos(strikeAng);
          const inlineSecond = findInlineBehindTarget(ux, uz, bestTarget, bestDist, effRange + 0.45);
          if (inlineSecond && !targetsToHit.some((t) => t.enemy === inlineSecond)) {
            const idx = inlineSecond.x - player.x;
            const idz = inlineSecond.z - player.z;
            targetsToHit.push({ enemy: inlineSecond, dx: idx, dz: idz, dist: Math.hypot(idx, idz) });
          }
        }
        for (const t of targetsToHit) {
          if (!t.enemy || t.enemy.hp <= 0) continue;
          const nx = t.dist > 0.001 ? t.dx / t.dist : Math.sin(strikeAng);
          const nz = t.dist > 0.001 ? t.dz / t.dist : Math.cos(strikeAng);
          applyDamageToEnemy(t.enemy, hitDmg, nx * stats.knockback * kbMult, nz * stats.knockback * kbMult, true, { isCrit: isCritSwing });
          if (isHammer && t.enemy.hp > 0 && (wpn.stunChance || 0) > 0 && Math.random() < wpn.stunChance) {
            t.enemy.stunTimer = Math.max(t.enemy.stunTimer || 0, wpn.stunDuration || 0.5);
            emitParticles(t.enemy.x, 1.38, t.enemy.z, 0xfacc15, 7, 3.6, 0.14);
            world?.spawnShockwaveRing?.({ x: t.enemy.x, y: 0.08, z: t.enemy.z, radius: 0.95, color: 0xfacc15, duration: 0.28 });
          }
          if (isZwei && t.enemy.hp > 0 && (wpn.disarmChance || 0) > 0 && Math.random() < wpn.disarmChance) {
            t.enemy.disarmTimer = Math.max(t.enemy.disarmTimer || 0, wpn.disarmDuration || 2.0);
            emitParticles(t.enemy.x, 1.32, t.enemy.z, 0x93c5fd, 7, 3.6, 0.14);
            floatText('🗡️ ОБЕЗОРУЖЕН!', t.enemy.x, t.enemy.z, '#93c5fd');
          }
        }
        const cleaveX = bestTarget ? bestTarget.x : player.x + dirX * Math.min(2.0, effRange * 0.75);
        const cleaveZ = bestTarget ? bestTarget.z : player.z + dirZ * Math.min(2.0, effRange * 0.75);
        emitParticles(cleaveX, 0.55, cleaveZ, wpn.color || 0xef4444, isHammer ? 14 : 11, 6.0, 0.15);
        world?.addScreenShake?.(isHammer ? 0.24 : 0.14, 0.12);
      } else {
        // Starter Sword ('club'): strict 1-target precision hit
        if (bestTarget) {
          const nx = bestDist > 0.001 ? bestDx / bestDist : dirX;
          const nz = bestDist > 0.001 ? bestDz / bestDist : dirZ;
          applyDamageToEnemy(bestTarget, hitDmg, nx * stats.knockback * kbMult, nz * stats.knockback * kbMult, true, { isCrit: isCritSwing });
        }
      }
      if (!bestTarget) {
        let bestCrate = null;
        let bestCrateIdx = -1;
        let bestCrateDist = Infinity;
        for (let i = pickups.length - 1; i >= 0; i--) {
          const p = pickups[i];
          if (!p || p.hp <= 0) continue;
          if (p.type !== 'relic_weapon_crate' && p.type !== 'supply_crate' && p.type !== 'mimic_disguise') continue;
          const dx = p.x - player.x;
          const dz = p.z - player.z;
          const dist = Math.hypot(dx, dz);
          if (p.type === 'supply_crate' && dist < 1.65) continue;
          if (dist <= stats.range + p.radius) {
            const angDiff = Math.abs(normalizeAngle(Math.atan2(dx, dz) - aimAngle));
            if ((angDiff <= halfArc || dist <= 1.7) && dist < bestCrateDist) {
              bestCrateDist = dist;
              bestCrate = p;
              bestCrateIdx = i;
            }
          }
        }
        if (bestCrate) {
          hitCrate(bestCrate);
          if (bestCrate.hp <= 0) {
            removeSceneObject(bestCrate.model.obj, bestCrate.model.handle);
            pickups.splice(bestCrateIdx, 1);
          }
        }
      }
      return;
    }

    // 2. GUNSLINGER HEAVY SHOTGUNS (Buckshot Cloud, Distance Falloff, Recoil & Auto-Reload!)
    if (wpn.type === 'ranged') {
      audio?.playGunshot?.(wpn.id);
      const flashColor = isOverdrive ? 0xf97316 : 0xff9f1c;
      const gunMuzzleX = player.x + dirX * 0.90;
      const gunMuzzleZ = player.z + dirZ * 0.90;
      world?.spawnMuzzleFlash?.({
        x: gunMuzzleX,
        y: 0.86,
        z: gunMuzzleZ,
        angle: aimAngle,
        color: flashColor,
        scale: wpn.id === 'blunderbuss' ? 1.56 : 1.28,
        smoke: true
      });
      if (wpn.isShotgun) {
        world?.addScreenShake?.(wpn.id === 'blunderbuss' ? 0.36 : 0.22, 0.16);
      }

      // Hot fiery muzzle sparks + glowing orange-gold ember droplets matching reference video!
      emitParticles(gunMuzzleX, 0.86, gunMuzzleZ, flashColor, wpn.id === 'blunderbuss' ? 16 : 12, 10.5, 0.11);
      emitParticles(gunMuzzleX + dirX * 0.22, 0.86, gunMuzzleZ + dirZ * 0.22, 0xfef08a, 6, 7.5, 0.08);
      const rightX = Math.cos(aimAngle);
      const rightZ = -Math.sin(aimAngle);
      emitParticles(player.x + rightX * 0.42 + dirX * 0.25, 0.80, player.z + rightZ * 0.42 + dirZ * 0.25, 0xfbbf24, 3, 4.4, 0.08);

      player.gunShotCount = (player.gunShotCount || 0) + 1;
      const isLastShell = usesMag && !isOverdrive && ammoBeforeShot === 1 && (stats.ammoPouchStacks || 0) > 0;
      const expSlugStacks = stats.gunExplosiveStacks || 0;
      const isExplosiveShot = expSlugStacks > 0 && player.gunShotCount % (expSlugStacks >= 3 ? 2 : 3) === 0;

      const count = wpn.isShotgun ? stats.pellets + (isOverdrive ? 2 : 0) : stats.pellets;
      const moveSp = stats.moveSpread ?? stats.spread ?? 0;
      const focusSp = stats.focusSpread ?? moveSp;
      const focusT = stats.focusTime || 0;
      const focusRatio = focusT > 0 ? clamp((player.standStillTimer || 0) / focusT, 0, 1) : 1;
      const activeSpreadPct = moveSp + (focusSp - moveSp) * focusRatio;
      const totalSpread =
        (wpn.isShotgun ? activeSpreadPct * 0.95 : activeSpreadPct * 0.90) + (isOverdrive ? 0.06 : 0);
      const projSplash = isExplosiveShot
        ? 2.25
        : isOverdrive
          ? Math.max(0.95, stats.splashRadius)
          : stats.splashRadius;
      const shotCrit = isLastShell || Math.random() < (stats.critChance || 0.04);
      const pelletDmg = Math.round(
        stats.damage *
          (isLastShell ? 2.0 / (stats.critMult || 1.8) : 1.0) *
          (isExplosiveShot ? 1 + expSlugStacks * 0.25 : 1.0)
      );
      if (isLastShell) {
        floatText('🎯 КОЗЫРЬ ×2!', player.x, player.z, '#fde047');
      }

      for (let i = 0; i < count; i++) {
        const frac = count > 1 ? i / (count - 1) - 0.5 : 0;
        const jitter = (Math.random() - 0.5) * (count > 1 ? totalSpread * 0.30 : totalSpread);
        const shotAngle = aimAngle + frac * totalSpread + jitter;
        const pelletSpeed = wpn.isShotgun
          ? stats.projectileSpeed * (0.90 + Math.random() * 0.20)
          : stats.projectileSpeed;
        const pelletMaxDist = wpn.isShotgun
          ? stats.range * (0.92 + Math.random() * 0.14)
          : stats.range;

        spawnProjectile({
          x: muzzleX,
          z: muzzleZ,
          vx: Math.sin(shotAngle) * pelletSpeed,
          vz: Math.cos(shotAngle) * pelletSpeed,
          damage: pelletDmg,
          maxDist: pelletMaxDist,
          pierce: stats.pierce + (isOverdrive ? 1 : 0),
          pierceDecay: stats.pierceDecay || null,
          splashRadius: projSplash,
          knockback: stats.knockback,
          kind: 'ranged',
          visualType: wpn.isShotgun ? 'buckshot' : wpn.id,
          isShotgunPellet: Boolean(wpn.isShotgun),
          isCrit: shotCrit,
          color: isExplosiveShot || isOverdrive ? 0xf97316 : shotCrit ? 0xfef08a : wpn.color,
          isEnemy: false
        });
      }

      if (!isOverdrive && usesMag && player.ammo <= 0) {
        triggerReload();
      }
      return;
    }

    // 3. MAGE ELEMENTAL STAVES (Fire = Burn DoT, Water = Charged Swirling Sphere + 7% Water Prison, Lightning = Chain, Air = Wind Gust!)
    const mageElem = stats.mageElement || 'fire';
    player.mageCastCount = (player.mageCastCount || 0) + 1;
    audio?.playMagicCast?.(mageElem);
    const castColor = isOverdrive ? 0xf43f5e : (stats.mageElementColor || wpn.color);
    const staffTipX = player.x + dirX * 1.04;
    const staffTipZ = player.z + dirZ * 1.04;
    world?.spawnMuzzleFlash?.({ x: staffTipX, y: 0.92, z: staffTipZ, angle: aimAngle, color: castColor, scale: mageElem === 'water' ? 1.42 : 1.24 });
    world?.addScreenShake?.(wpn.id === 'void_orb' ? 0.16 : 0.08, 0.10);
    emitParticles(staffTipX, 0.92, staffTipZ, castColor, mageElem === 'water' ? 12 : 8, 6.2, 0.14);
    if (mageElem === 'water') {
      emitParticles(staffTipX, 0.92, staffTipZ, 0xe0faff, 6, 4.8, 0.10);
    }

    // 💧 Астральный Колодец (mage_mana_font): every 6th cast restores +16 Mana & pulses arcane wave!
    if ((stats.mageManaFontStacks || 0) > 0 && player.mageCastCount % 6 === 0) {
      player.mana = Math.min(player.maxMana, player.mana + 16);
      emitParticles(player.x, 0.85, player.z, 0x38bdf8, 14, 5.8, 0.15);
      damageEnemiesInRadius(player.x, player.z, 3.6, Math.round(stats.damage * 0.85), 8.5, null, false, mageElem);
      floatText('💧 +16 МАНЫ!', player.x, player.z, '#38bdf8');
    }

    // ✨ Раздвоение Кометы (mage_twin_cast): 40% / 75% / 100% chance for a free twin projectile!
    const twinStacks = stats.mageTwinStacks || 0;
    const bonusTwin = twinStacks > 0 && Math.random() < Math.min(1.0, 0.05 + twinStacks * 0.35) ? 1 : 0;
    const orbCount = stats.pellets + (isOverdrive ? 1 : 0) + bonusTwin;
    const orbSpread = stats.spread + (orbCount > 1 ? 0.16 : 0);
    const spellCrit = Math.random() < (stats.critChance || 0.05);

    for (let i = 0; i < orbCount; i++) {
      const frac = orbCount > 1 ? i / (orbCount - 1) - 0.5 : 0;
      const shotAngle = aimAngle + frac * orbSpread + (Math.random() - 0.5) * 0.025;
      spawnProjectile({
        x: staffTipX,
        z: staffTipZ,
        vx: Math.sin(shotAngle) * stats.projectileSpeed,
        vz: Math.cos(shotAngle) * stats.projectileSpeed,
        damage: stats.damage,
        maxDist: stats.range,
        pierce: stats.pierce + (mageElem === 'air' ? 1 : 0),
        splashRadius: 0, // NO ugly flat ground splash circles on basic magic shots!
        knockback: stats.knockback,
        kind: 'magic',
        mageElement: mageElem,
        visualType: `magic_${mageElem}`,
        isCrit: spellCrit,
        color: castColor,
        isEnemy: false
      });
    }

    if (!isOverdrive && usesMag && player.ammo <= 0) {
      triggerReload();
    }
  }

  // === 25-Chapter Finale Spawning: Act Bosses (5,10,15,20,25), Mini-Bosses (Acts II-V), Elite Packs (1-4) ===
  function startWaveFinale() {
    finaleStarted = true;

    // 1. Milestone Act Boss Chapters (Levels 5, 10, 15, 20, 25 — including paired/squad Bosses!)
    if (currentLevelDef.hasBoss && (currentLevelDef.finaleBosses?.length > 0 || currentLevelDef.bossId)) {
      const bossIds =
        currentLevelDef.finaleBosses?.length > 0
          ? currentLevelDef.finaleBosses
          : [currentLevelDef.bossId, ...(currentLevelDef.coBossId ? [currentLevelDef.coBossId] : [])];

      world?.setBossAtmosphere?.(true);
      audio?.playBossSpawn?.();
      world?.addScreenShake?.(0.82, 0.5);

      const baseAngle = Math.random() * TWO_PI;
      const spawnedNames = [];
      for (let bi = 0; bi < bossIds.length; bi++) {
        const bId = bossIds[bi];
        const bDef = ENEMY_TYPES[bId] || ENEMY_TYPES.boss_troll;
        const ang = baseAngle + (bi / Math.max(1, bossIds.length)) * TWO_PI;
        const bx = clamp(player.x + Math.sin(ang) * 16, -ARENA_HALF_SIZE + 5, ARENA_HALF_SIZE - 5);
        const bz = clamp(player.z + Math.cos(ang) * 16, -ARENA_HALF_SIZE + 5, ARENA_HALF_SIZE - 5);
        const spawnedBoss = spawnEnemy(bId, bx, bz, null, { isFinaleTarget: true });
        if (bi === 0) bossEntity = spawnedBoss;
        emitShockwave(spawnedBoss.x, spawnedBoss.z, 8.5, bDef.color || 0xdc2626, 0.58);
        emitParticles(spawnedBoss.x, 1.2, spawnedBoss.z, bDef.color || 0xdc2626, 34, 8.0, 0.22);
        spawnedNames.push(bDef.nameRu);
      }
      const uniqueSummary = spawnedNames.length > 1
        ? `💀 БОССЫ (${spawnedNames.length}): ${spawnedNames[0].toUpperCase()}...`
        : `💀 ${(spawnedNames[0] || 'БОСС').toUpperCase()}!`;
      floatText(uniqueSummary, player.x, player.z - 1.2, '#ef4444');
      return;
    }

    // 2. Non-Boss Chapters (Stage 1: Slime, Stage 2: Treant, Stage 3: Mimic, etc.): Finale Mini-Boss!
    if (currentLevelDef.finaleMiniBossType || (currentLevelDef.miniBossPool && currentLevelDef.miniBossPool.length > 0)) {
      spawnMiniBossFromPool(true);
      return;
    }

    // 3. Levels 1–4 (Act I Non-Boss Chapters): NO Bosses! Spawn 2 tough Elite Finale Champions!
    audio?.playBossSpawn?.();
    world?.addScreenShake?.(0.45, 0.30);

    const pool = currentLevelDef.enemyPool || ['ember_skeleton', 'goblin'];
    const champTypes = [
      pool[pool.length - 1] || 'goblin',
      pool[Math.max(0, pool.length - 2)] || 'ember_skeleton'
    ];
    const hpScale = currentLevelDef.hpScale || 1;
    const dmgScale = currentLevelDef.dmgScale || 1;

    let leadChamp = null;
    for (let c = 0; c < 2; c++) {
      const cType = champTypes[c];
      const cDef = ENEMY_TYPES[cType] || ENEMY_TYPES.ember_skeleton || ENEMY_TYPES.skeleton;
      const angle = (c === 0 ? 0.35 : Math.PI + 0.35) + Math.random() * 0.5;
      const cx = clamp(player.x + Math.sin(angle) * 14.5, -ARENA_HALF_SIZE + 4, ARENA_HALF_SIZE - 4);
      const cz = clamp(player.z + Math.cos(angle) * 14.5, -ARENA_HALF_SIZE + 4, ARENA_HALF_SIZE - 4);

      const champ = spawnEnemy(cType, cx, cz, c === 0 ? 'purple' : 'blue', {
        isWarden: true,
        isFinaleTarget: true,
        nameRu: `Чемпион: ${cDef.nameRu}`,
        hp: Math.round((130 + cDef.hp * 2.1) * hpScale),
        damage: Math.round(cDef.damage * dmgScale * 1.2),
        scale: (cDef.scale || 0.95) * 1.32,
        xp: 42,
        gold: 28
      });
      emitShockwave(champ.x, champ.z, 4.8, c === 0 ? 0xa855f7 : 0x38bdf8, 0.42);
      if (!leadChamp) leadChamp = champ;
    }

    bossEntity = leadChamp;
    floatText('⚔️ ЭЛИТНЫЙ ДОЗОР ПОГОСТА!', player.x, player.z - 1.2, '#fbbf24');
  }

  // === 5 Distinct Act Boss State Machines (Works seamlessly for both Full Bosses & Mini-Bosses!) ===
  function updateBossAI(boss, dt, elapsedTime) {
    boss.bossStateTimer -= dt;
    const dx = player.x - boss.x;
    const dz = player.z - boss.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const angleToPlayer = Math.atan2(dx, dz);
    const slowMult = boss.frostTimer > 0 ? 1 - (1 - (boss.frostFactor || 0.75)) * 0.45 : 1.0;
    const effSpeed = boss.speed * slowMult;
    const mbScale = boss.isMiniBoss ? 0.82 : 1.0;

    // ------------------------------------------------------------------------
    // 1. BOSS_BUTCHER (Act I — Демон Преисподней): Double-Leap Magma Shockwaves + Greatsword Frenzy
    // ------------------------------------------------------------------------
    if (boss.type === 'boss_butcher') {
      if (boss.bossPhase === 0) {
        if (boss.bossSubState === 'stalk') {
          if (boss.model?.obj) boss.model.obj.position.y = 0;
          boss.facing = lerpAngle(boss.facing, angleToPlayer, dt * 8);
          boss.x += (dx / dist) * effSpeed * dt;
          boss.z += (dz / dist) * effSpeed * dt;

          if (boss.bossStateTimer <= 0 || dist < 7.5) {
            boss.bossSubState = 'leap_telegraph';
            boss.bossStepCount = 0;
            boss.bossStateTimer = 0.62;
            const jumpDist = Math.min(10.5, dist);
            boss.dashStartX = boss.x;
            boss.dashStartZ = boss.z;
            boss.dashTargetX = clamp(boss.x + (dx / dist) * jumpDist, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
            boss.dashTargetZ = clamp(boss.z + (dz / dist) * jumpDist, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
            boss.facing = angleToPlayer;
            emitDangerZone(boss.dashTargetX, boss.dashTargetZ, 3.4 * mbScale, 0.62, 0xea580c);
            floatText('🔥 ПРЫЖОК ДЕМОНА!', boss.x, boss.z, '#fb923c');
          }
        } else if (boss.bossSubState === 'leap_telegraph') {
          emitParticles(boss.x, 0.8, boss.z, 0xf97316, 1, 2.8, 0.13);
          if (boss.bossStateTimer <= 0) {
            boss.bossSubState = 'leaping';
            boss.bossStateTimer = 0.32;
            triggerModelAttack(boss.model);
          }
        } else if (boss.bossSubState === 'leaping') {
          const prog = clamp(1 - boss.bossStateTimer / 0.32, 0, 1);
          boss.x = boss.dashStartX + (boss.dashTargetX - boss.dashStartX) * prog;
          boss.z = boss.dashStartZ + (boss.dashTargetZ - boss.dashStartZ) * prog;
          if (boss.model?.obj) {
            boss.model.obj.position.y = Math.sin(prog * Math.PI) * 2.1 * mbScale;
          }

          if (boss.bossStateTimer <= 0) {
            if (boss.model?.obj) boss.model.obj.position.y = 0;
            const slamRad = 3.4 * mbScale;
            audio?.playExplosion?.();
            world?.addScreenShake?.(boss.isMiniBoss ? 0.34 : 0.52, 0.24);
            emitShockwave(boss.x, boss.z, slamRad, 0xea580c, 0.36);
            emitParticles(boss.x, 0.4, boss.z, 0xf97316, 18, 6.8, 0.18);

            if (Math.hypot(player.x - boss.x, player.z - boss.z) <= slamRad + player.radius * 0.45) {
              applyDamageToPlayer(boss.damage);
            }

            boss.bossStepCount += 1;
            if (boss.bossStepCount < 2) {
              // Immediate 2nd Leap!
              boss.bossSubState = 'leap_telegraph';
              boss.bossStateTimer = 0.56;
              const ndx = player.x - boss.x;
              const ndz = player.z - boss.z;
              const ndist = Math.hypot(ndx, ndz) || 0.001;
              const jump2 = Math.min(9.5, ndist);
              boss.dashStartX = boss.x;
              boss.dashStartZ = boss.z;
              boss.dashTargetX = clamp(boss.x + (ndx / ndist) * jump2, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
              boss.dashTargetZ = clamp(boss.z + (ndz / ndist) * jump2, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
              boss.facing = Math.atan2(ndx, ndz);
              emitDangerZone(boss.dashTargetX, boss.dashTargetZ, slamRad, 0.56, 0xea580c);
            } else {
              boss.bossPhase = 1;
              boss.bossSubState = 'cleave_chase';
              boss.bossStateTimer = 1.05;
            }
          }
        }
      } else {
        if (boss.model?.obj) boss.model.obj.position.y = 0;
        boss.facing = lerpAngle(boss.facing, angleToPlayer, dt * 9);
        if (boss.bossSubState === 'cleave_chase') {
          boss.x += (dx / dist) * (effSpeed * 1.15) * dt;
          boss.z += (dz / dist) * (effSpeed * 1.15) * dt;
          if (boss.bossStateTimer <= 0 || dist <= 3.8 * mbScale) {
            boss.bossSubState = 'recover';
            boss.bossStateTimer = 0.95;
            triggerModelAttack(boss.model);
            audio?.playMeleeSwing?.(true);
            const reach = 4.7 * mbScale;
            emitSlashArc(boss.x, boss.z, angleToPlayer, reach, Math.PI * 1.35, 0xf97316);
            if (dist <= reach + player.radius * 0.4) {
              applyDamageToPlayer(boss.damage);
            }
          }
        } else if (boss.bossStateTimer <= 0) {
          boss.bossPhase = 0;
          boss.bossSubState = 'stalk';
          boss.bossStateTimer = 1.75;
        }
      }
      return;
    }

    // ------------------------------------------------------------------------
    // 2. BOSS_TROLL / BOSS_WARDEN (Тролль-Костолом): Hammer Cleave & Juggernaut Whirlwind Spin (NO jumps/leaps!)
    // ------------------------------------------------------------------------
    if (boss.type === 'boss_warden' || boss.type === 'boss_troll') {
      boss.meleeCooldown = Math.max(0, (boss.meleeCooldown || 0) - dt);
      boss.spinHitTimer = Math.max(0, (boss.spinHitTimer || 0) - dt);
      boss.spinVfxTimer = Math.max(0, (boss.spinVfxTimer || 0) - dt);

      if (boss.bossPhase === 0) {
        if (boss.bossSubState === 'stalk') {
          boss.model?.handle?.setClipOverride?.(null);
          boss.facing = lerpAngle(boss.facing, angleToPlayer, dt * 7.5);
          if (dist > 2.2) {
            boss.x += (dx / dist) * effSpeed * dt;
            boss.z += (dz / dist) * effSpeed * dt;
          }

          if (dist <= 3.1 * mbScale && boss.meleeCooldown <= 0) {
            boss.meleeCooldown = 1.65;
            triggerModelAttack(boss.model, 'Heavy_Cleave');
            audio?.playMeleeSwing?.(true);
            emitSlashArc(boss.x, boss.z, boss.facing, 3.25 * mbScale, Math.PI * 0.95, 0xf59e0b);
            if (dist <= 2.95 * mbScale) {
              applyDamageToPlayer(boss.damage);
            }
          }

          if (boss.bossStateTimer <= 0 && dist <= 13.5) {
            boss.bossSubState = 'whirl_windup';
            boss.bossStateTimer = 0.62;
            boss.facing = angleToPlayer;
            emitDangerZone(boss.x, boss.z, 2.95 * mbScale, 0.62, 0xd97706);
            emitParticles(boss.x, 1.0, boss.z, 0xf59e0b, 14, 4.5, 0.16);
            floatText('🌀 ВИХРЬ МОЛОТА!', boss.x, boss.z, '#fbbf24');
          }
        } else if (boss.bossSubState === 'whirl_windup') {
          boss.facing = lerpAngle(boss.facing, angleToPlayer, dt * 8);
          boss.x += (dx / dist) * (effSpeed * 0.25) * dt;
          boss.z += (dz / dist) * (effSpeed * 0.25) * dt;
          if (Math.random() < 0.55) {
            emitParticles(boss.x, 0.9, boss.z, 0xf59e0b, 2, 3.2, 0.14);
          }
          if (boss.bossStateTimer <= 0) {
            boss.bossPhase = 1;
            boss.bossSubState = 'whirl_spin';
            boss.bossStateTimer = 3.2;
            boss.spinHitTimer = 0;
            boss.spinVfxTimer = 0;
            boss.model?.handle?.setClipOverride?.('Whirl_Spin');
            audio?.playMeleeSwing?.(true);
            emitShockwave(boss.x, boss.z, 3.1 * mbScale, 0xf59e0b, 0.35);
          }
        }
      } else {
        if (boss.bossSubState === 'whirl_spin') {
          boss.model?.handle?.setClipOverride?.('Whirl_Spin');
          // Rapidly spins around like Juggernaut while chasing with a mild speed boost slower than the hero!
          boss.facing += dt * 11.4;
          const spinSpeed = Math.min(4.15, effSpeed * 1.24);
          boss.x += (dx / dist) * spinSpeed * dt;
          boss.z += (dz / dist) * spinSpeed * dt;

          if (boss.spinVfxTimer <= 0) {
            boss.spinVfxTimer = 0.28;
            audio?.playMeleeSwing?.(false);
            emitSlashArc(boss.x, boss.z, boss.facing, 3.05 * mbScale, Math.PI * 1.5, 0xf97316);
            emitParticles(boss.x, 0.65, boss.z, 0xfbbf24, 5, 4.5, 0.13);
          }

          if (dist <= 2.75 * mbScale && boss.spinHitTimer <= 0) {
            boss.spinHitTimer = 0.52;
            world?.addScreenShake?.(0.32, 0.18);
            applyDamageToPlayer(Math.round(boss.damage * 0.85));
          }

          if (boss.bossStateTimer <= 0) {
            boss.model?.handle?.setClipOverride?.(null);
            boss.bossSubState = 'recover';
            boss.bossStateTimer = 1.25;
            emitShockwave(boss.x, boss.z, 2.8 * mbScale, 0xd97706, 0.3);
          }
        } else if (boss.bossSubState === 'recover' && boss.bossStateTimer <= 0) {
          boss.model?.handle?.setClipOverride?.(null);
          boss.bossPhase = 0;
          boss.bossSubState = 'stalk';
          boss.bossStateTimer = 3.6;
        }
      }
      return;
    }

    // ------------------------------------------------------------------------
    // 3. BOSS_ARCHLICH (Stage 10 Co-Boss — Король-Лич): Dark Flame Spiral + Cursed Rune Zones + Shadow Blink + Undead Raise
    // ------------------------------------------------------------------------
    if (boss.type === 'boss_archlich') {
      boss.blinkCooldown = Math.max(0, (boss.blinkCooldown || 0) - dt);
      boss.facing = lerpAngle(boss.facing, angleToPlayer, dt * 7);
      if (dist > 9.5) {
        boss.x += (dx / dist) * effSpeed * dt;
        boss.z += (dz / dist) * effSpeed * dt;
      } else if (dist < 4.3 && boss.blinkCooldown <= 0) {
        boss.blinkCooldown = 7.5;
        emitShockwave(boss.x, boss.z, 3.2, 0xa855f7, 0.35);
        emitParticles(boss.x, 1.0, boss.z, 0xc084fc, 18, 6.0, 0.16);
        const blinkAng = angleToPlayer + Math.PI + (Math.random() - 0.5) * 1.1;
        boss.x = clamp(player.x - Math.sin(blinkAng) * 9.5, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
        boss.z = clamp(player.z - Math.cos(blinkAng) * 9.5, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
        emitShockwave(boss.x, boss.z, 3.6, 0xd946ef, 0.42);
        emitParticles(boss.x, 1.0, boss.z, 0xd946ef, 22, 6.5, 0.18);
        floatText('🌑 ТЕНЕВОЙ ШАГ!', boss.x, boss.z, '#e879f9');
      } else if (dist < 5.5) {
        boss.x -= (dx / dist) * (effSpeed * 0.55) * dt;
        boss.z -= (dz / dist) * (effSpeed * 0.55) * dt;
      }

      if (boss.bossPhase === 0) {
        if (boss.bossSubState === 'stalk' && boss.bossStateTimer <= 0) {
          boss.bossSubState = 'spiral_1';
          boss.bossStateTimer = 0.52;
          triggerModelAttack(boss.model, 'Spellcast_Shoot');
          audio?.playMagicCast?.('spark_staff');
          floatText('🔮 СПИРАЛЬ ПЛАМЕНИ!', boss.x, boss.z, '#c084fc');

          const boltCount = boss.isMiniBoss ? 6 : 8;
          for (let b = 0; b < boltCount; b++) {
            const ba = angleToPlayer + (b / boltCount) * TWO_PI;
            spawnProjectile({
              x: boss.x,
              z: boss.z,
              vx: Math.sin(ba) * 11.2,
              vz: Math.cos(ba) * 11.2,
              damage: Math.round(boss.damage * 0.78),
              maxDist: 20,
              kind: 'enemy',
              color: 0xa855f7,
              isEnemy: true
            });
          }
        } else if (boss.bossSubState === 'spiral_1' && boss.bossStateTimer <= 0) {
          boss.bossPhase = 1;
          boss.bossSubState = 'plague_cast';
          boss.bossStateTimer = 0.95;
          triggerModelAttack(boss.model, 'Spellcast_Shoot');
          audio?.playMagicCast?.('void_orb');

          const boltCount = boss.isMiniBoss ? 6 : 8;
          for (let b = 0; b < boltCount; b++) {
            const ba = angleToPlayer + ((b + 0.5) / boltCount) * TWO_PI;
            spawnProjectile({
              x: boss.x,
              z: boss.z,
              vx: Math.sin(ba) * 11.6,
              vz: Math.cos(ba) * 11.6,
              damage: Math.round(boss.damage * 0.78),
              maxDist: 20,
              kind: 'enemy',
              color: 0xc084fc,
              isEnemy: true
            });
          }
        }
      } else if (boss.bossPhase === 1) {
        if (boss.bossSubState === 'plague_cast' && boss.bossStateTimer <= 0) {
          boss.bossSubState = 'plague_wait';
          boss.bossStateTimer = 1.25;
          triggerModelAttack(boss.model, 'Spellcast_Shoot');
          floatText('🟣 РУНЫ ИСТОЩЕНИЯ!', boss.x, boss.z, '#d8b4fe');
          const zoneCount = boss.isMiniBoss ? 2 : 3;
          for (let c = 0; c < zoneCount; c++) {
            const offAng = angleToPlayer + (c - (zoneCount - 1) * 0.5) * 0.95;
            const offDist = c === 0 ? 0 : 3.6;
            const zx = clamp(player.x + Math.sin(offAng) * offDist, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
            const zz = clamp(player.z + Math.cos(offAng) * offDist, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
            const zRad = 2.7 * mbScale;
            emitDangerZone(zx, zz, zRad, 1.15, 0x9333ea);
            bossHazards.push({
              x: zx,
              z: zz,
              radius: zRad,
              timer: 1.15,
              damage: Math.round(boss.damage * 0.85),
              color: 0xa855f7
            });
          }
        } else if (boss.bossSubState === 'plague_wait' && boss.bossStateTimer <= 0) {
          boss.bossPhase = 2;
          boss.bossSubState = 'summon';
          boss.bossStateTimer = 0.65;
        }
      } else {
        if (boss.bossSubState === 'summon' && boss.bossStateTimer <= 0) {
          boss.bossSubState = 'recover';
          boss.bossStateTimer = 1.45;
          triggerModelAttack(boss.model, 'Spellcast_Shoot');
          emitShockwave(boss.x, boss.z, 5.2 * mbScale, 0xa855f7, 0.45);
          floatText('💀 ВОССТАНЬТЕ!', boss.x, boss.z, '#d8b4fe');

          const count = boss.isMiniBoss ? 2 : 3;
          for (let s = 0; s < count; s++) {
            if (enemies.length >= MAX_ACTIVE_ENEMIES + 6) break;
            const sAng = (s / count) * TWO_PI + elapsedTime;
            const sx = clamp(boss.x + Math.cos(sAng) * 3.1, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
            const sz = clamp(boss.z + Math.sin(sAng) * 3.1, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
            spawnEnemy(s % 2 === 0 ? 'plague_zombie' : 'vampire_bat', sx, sz, null, { isSummoned: true, xp: 5, gold: 2 });
            emitParticles(sx, 0.6, sz, 0xa855f7, 8, 4.0, 0.14);
          }
        } else if (boss.bossSubState === 'recover' && boss.bossStateTimer <= 0) {
          boss.bossPhase = 0;
          boss.bossSubState = 'stalk';
          boss.bossStateTimer = 1.75;
        }
      }
      return;
    }

    // ------------------------------------------------------------------------
    // 5. BOSS_ASHLORD (Act V Final Ultra-Boss — Пепельный Дракон): Dragon Swoop + 5 Meteors + Dragon Guard
    // ------------------------------------------------------------------------
    if (boss.type === 'boss_ashlord') {
      if (boss.bossPhase === 0) {
        if (boss.bossSubState === 'stalk') {
          boss.facing = lerpAngle(boss.facing, angleToPlayer, dt * 8);
          boss.x += (dx / dist) * effSpeed * dt;
          boss.z += (dz / dist) * effSpeed * dt;

          if (boss.bossStateTimer <= 0 || dist < 7.0) {
            boss.bossSubState = 'telegraph_dash';
            boss.bossStateTimer = 0.62;
            const dashDist = Math.min(11.5, dist + 1.8);
            boss.dashTargetX = clamp(boss.x + (dx / dist) * dashDist, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
            boss.dashTargetZ = clamp(boss.z + (dz / dist) * dashDist, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
            boss.facing = angleToPlayer;
            emitDangerZone(boss.dashTargetX, boss.dashTargetZ, 4.2, 0.62, 0xf97316);
            emitParticles(boss.x, 1.3, boss.z, 0xf97316, 18, 6.0, 0.18);
            floatText('🐉 ПИКЕ ДРАКОНА!', boss.x, boss.z, '#fb923c');
          }
        } else if (boss.bossSubState === 'telegraph_dash') {
          emitParticles(boss.x, 1.0, boss.z, 0xef4444, 2, 3.5, 0.14);
          if (boss.bossStateTimer <= 0) {
            boss.bossSubState = 'dashing';
            boss.bossStateTimer = 0.30;
          }
        } else if (boss.bossSubState === 'dashing') {
          const tdx = boss.dashTargetX - boss.x;
          const tdz = boss.dashTargetZ - boss.z;
          const tdist = Math.hypot(tdx, tdz);
          if (tdist > 0.25) {
            const step = Math.min(tdist, 28 * dt);
            boss.x += (tdx / tdist) * step;
            boss.z += (tdz / tdist) * step;
          }
          if (boss.bossStateTimer <= 0) {
            const slashAngle = Math.atan2(player.x - boss.x, player.z - boss.z);
            boss.facing = slashAngle;
            triggerModelAttack(boss.model);
            audio?.playMeleeSwing?.(true);
            world?.addScreenShake?.(0.62, 0.30);
            emitSlashArc(boss.x, boss.z, slashAngle, 5.8, Math.PI * 1.45, 0xf97316);
            emitShockwave(boss.x, boss.z, 4.8, 0xef4444, 0.36);

            const pDist = Math.hypot(player.x - boss.x, player.z - boss.z);
            if (pDist <= 5.8) {
              const pAng = Math.atan2(player.x - boss.x, player.z - boss.z);
              if (Math.abs(normalizeAngle(pAng - slashAngle)) <= Math.PI * 0.75 || pDist <= 2.4) {
                applyDamageToPlayer(boss.damage);
              }
            }
            // Radial 8-ember burst on cleave finish!
            for (let k = 0; k < 8; k++) {
              const ka = slashAngle + (k / 8) * TWO_PI;
              spawnProjectile({
                x: boss.x,
                z: boss.z,
                vx: Math.sin(ka) * 13.0,
                vz: Math.cos(ka) * 13.0,
                damage: Math.round(boss.damage * 0.75),
                maxDist: 19,
                kind: 'enemy',
                color: 0xf97316,
                isEnemy: true
              });
            }

            boss.bossPhase = 1;
            boss.bossSubState = 'meteors';
            boss.bossStateTimer = 0.85;
          }
        }
      } else if (boss.bossPhase === 1) {
        boss.facing = lerpAngle(boss.facing, angleToPlayer, dt * 6);
        boss.x += (dx / dist) * (effSpeed * 0.45) * dt;
        boss.z += (dz / dist) * (effSpeed * 0.45) * dt;

        if (boss.bossSubState === 'meteors' && boss.bossStateTimer <= 0) {
          boss.bossSubState = 'wait_meteors';
          boss.bossStateTimer = 1.25;
          triggerModelAttack(boss.model);
          audio?.playMagicCast?.('cinder_tome');
          floatText('☄️ ДОЖДЬ ПЕПЛА!', boss.x, boss.z, '#ef4444');

          // 5 Meteor Danger Zones around player!
          for (let m = 0; m < 5; m++) {
            const mAng = (m / 5) * TWO_PI + elapsedTime * 0.7;
            const mDist = m === 0 ? 0 : 3.8 + (m % 2) * 1.4;
            const zx = clamp(player.x + Math.cos(mAng) * mDist, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
            const zz = clamp(player.z + Math.sin(mAng) * mDist, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
            emitDangerZone(zx, zz, 3.1, 1.10, 0xef4444);
            bossHazards.push({
              x: zx,
              z: zz,
              radius: 3.1,
              timer: 1.10,
              damage: Math.round(boss.damage * 0.92),
              color: 0xf97316
            });
          }
        } else if (boss.bossSubState === 'wait_meteors' && boss.bossStateTimer <= 0) {
          boss.bossPhase = 2;
          boss.bossSubState = 'summon_elite';
          boss.bossStateTimer = 0.65;
        }
      } else {
        boss.facing = lerpAngle(boss.facing, angleToPlayer, dt * 6);
        if (boss.bossSubState === 'summon_elite' && boss.bossStateTimer <= 0) {
          boss.bossSubState = 'recover';
          boss.bossStateTimer = 1.2;
          triggerModelAttack(boss.model);
          emitShockwave(boss.x, boss.z, 5.8, 0xf59e0b, 0.48);
          floatText('🔥 СТРАЖА ДРАКОНА!', boss.x, boss.z, '#fbbf24');

          const guards = ['gargoyle', 'dark_cultist'];
          for (let g = 0; g < guards.length; g++) {
            if (enemies.length >= MAX_ACTIVE_ENEMIES + 6) break;
            const gAng = angleToPlayer + (g === 0 ? -0.9 : 0.9);
            const gx = clamp(boss.x + Math.sin(gAng) * 3.5, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
            const gz = clamp(boss.z + Math.cos(gAng) * 3.5, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
            spawnEnemy(guards[g], gx, gz, null, { isSummoned: true, xp: 10, gold: 4 });
            emitParticles(gx, 0.7, gz, 0xf97316, 10, 4.5, 0.15);
          }
        } else if (boss.bossSubState === 'recover' && boss.bossStateTimer <= 0) {
          boss.bossPhase = 0;
          boss.bossSubState = 'stalk';
          boss.bossStateTimer = 1.85;
        }
      }
      return;
    }

    // ------------------------------------------------------------------------
    // 4. BOSS_CTHULHU / REAPER (Act III — Вестник Бездны & Default Boss): Tentacle Surge + Abyssal Rifts + Deep Summons
    // ------------------------------------------------------------------------
    if (boss.bossPhase === 0) {
      if (boss.bossSubState === 'stalk') {
        boss.facing = lerpAngle(boss.facing, angleToPlayer, dt * 8);
        boss.x += (dx / dist) * effSpeed * dt;
        boss.z += (dz / dist) * effSpeed * dt;

        if (boss.bossStateTimer <= 0 || dist < 6.4) {
          boss.bossSubState = 'telegraph_dash';
          boss.bossStateTimer = 0.66;
          const dashDist = Math.min(10.5, dist + 1.5);
          boss.dashTargetX = clamp(boss.x + (dx / dist) * dashDist, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
          boss.dashTargetZ = clamp(boss.z + (dz / dist) * dashDist, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
          boss.facing = angleToPlayer;

          emitDangerZone(boss.dashTargetX, boss.dashTargetZ, 3.8 * mbScale, 0.66, 0x06b6d4);
          emitParticles(boss.x, 1.2, boss.z, 0x22d3ee, 16, 5.5, 0.18);
          floatText('🌊 НАТИСК БЕЗДНЫ!', boss.x, boss.z, '#22d3ee');
        }
      } else if (boss.bossSubState === 'telegraph_dash') {
        emitParticles(boss.x, 1.0, boss.z, 0x06b6d4, 2, 3.0, 0.14);
        if (boss.bossStateTimer <= 0) {
          boss.bossSubState = 'dashing';
          boss.bossStateTimer = 0.28;
        }
      } else if (boss.bossSubState === 'dashing') {
        const tdx = boss.dashTargetX - boss.x;
        const tdz = boss.dashTargetZ - boss.z;
        const tdist = Math.hypot(tdx, tdz);
        if (tdist > 0.25) {
          const step = Math.min(tdist, 26 * dt);
          boss.x += (tdx / tdist) * step;
          boss.z += (tdz / tdist) * step;
        }
        if (boss.bossStateTimer <= 0) {
          const slashAngle = Math.atan2(player.x - boss.x, player.z - boss.z);
          boss.facing = slashAngle;
          triggerModelAttack(boss.model);
          audio?.playMeleeSwing?.(true);
          world?.addScreenShake?.(boss.isMiniBoss ? 0.36 : 0.52, 0.28);
          const reach = 5.4 * mbScale;
          emitSlashArc(boss.x, boss.z, slashAngle, reach, Math.PI * 1.28, 0x06b6d4);
          emitShockwave(boss.x, boss.z, 4.4 * mbScale, 0x22d3ee, 0.32);

          const pDist = Math.hypot(player.x - boss.x, player.z - boss.z);
          if (pDist <= reach + 0.15) {
            const pAng = Math.atan2(player.x - boss.x, player.z - boss.z);
            if (Math.abs(normalizeAngle(pAng - slashAngle)) <= Math.PI * 0.68 || pDist <= 2.2) {
              applyDamageToPlayer(boss.damage);
            }
          }

          boss.bossPhase = 1;
          boss.bossSubState = 'cast_flames';
          boss.bossStateTimer = 1.05;
        }
      }
    } else if (boss.bossPhase === 1) {
      boss.facing = lerpAngle(boss.facing, angleToPlayer, dt * 6);
      boss.x += (dx / dist) * (effSpeed * 0.45) * dt;
      boss.z += (dz / dist) * (effSpeed * 0.45) * dt;

      if (boss.bossSubState === 'cast_flames' && boss.bossStateTimer <= 0.45) {
        boss.bossSubState = 'wait_flames';
        boss.bossStateTimer = 1.25;
        triggerModelAttack(boss.model);
        audio?.playMagicCast?.('void_orb');
        floatText('🌀 СФЕРЫ БЕЗДНЫ!', boss.x, boss.z, '#67e8f9');

        const count = boss.isMiniBoss ? 2 : 3;
        for (let c = 0; c < count; c++) {
          const offsetAng = angleToPlayer + (c - (count - 1) * 0.5) * 0.85;
          const offsetDist = c === 1 ? 0 : 3.5;
          const zx = clamp(player.x + Math.sin(offsetAng) * offsetDist, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
          const zz = clamp(player.z + Math.cos(offsetAng) * offsetDist, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
          const fRad = 2.9 * mbScale;
          emitDangerZone(zx, zz, fRad, 1.08, 0x06b6d4);
          bossHazards.push({
            x: zx,
            z: zz,
            radius: fRad,
            timer: 1.08,
            damage: Math.round(boss.damage * 0.9),
            color: 0x06b6d4
          });
        }
      } else if (boss.bossSubState === 'wait_flames' && boss.bossStateTimer <= 0) {
        boss.bossPhase = 2;
        boss.bossSubState = 'summon';
        boss.bossStateTimer = 0.7;
      }
    } else {
      boss.facing = lerpAngle(boss.facing, angleToPlayer, dt * 6);
      if (boss.bossSubState === 'summon' && boss.bossStateTimer <= 0) {
        boss.bossSubState = 'recover';
        boss.bossStateTimer = 1.2;
        triggerModelAttack(boss.model);
        emitShockwave(boss.x, boss.z, 5.0 * mbScale, 0x0891b2, 0.45);
        floatText('🦑 ЗОВ БЕЗДНЫ!', boss.x, boss.z, '#67e8f9');

        const summonCount = boss.isMiniBoss ? 2 : 3;
        for (let s = 0; s < summonCount; s++) {
          if (enemies.length >= MAX_ACTIVE_ENEMIES + 6) break;
          const sAng = (s / summonCount) * TWO_PI + elapsedTime;
          const sx = clamp(boss.x + Math.cos(sAng) * 3.2, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
          const sz = clamp(boss.z + Math.sin(sAng) * 3.2, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
          const abyssMinion = s % 2 === 0 ? 'shadow_wisp' : 'dark_spider';
          spawnEnemy(abyssMinion, sx, sz, null, { isSummoned: true, xp: 5, gold: 2 });
          emitParticles(sx, 0.6, sz, 0x22d3ee, 8, 4.0, 0.15);
        }
      } else if (boss.bossSubState === 'recover' && boss.bossStateTimer <= 0) {
        boss.bossPhase = 0;
        boss.bossSubState = 'stalk';
        boss.bossStateTimer = 1.95;
      }
    }
  }

  // === Main Frame Update ===
  function update(rawDt, input = {}, elapsedTime = 0) {
    if (!runActive || runEnded || awaitingLevelUpChoice) return;
    const dt = clamp(Number(rawDt) || 0, 0, 0.05);
    if (dt <= 0) return;

    // Handle post-boss victory celebration beat
    if (pendingVictoryPayload) {
      victoryDelayTimer -= dt;
      updatePickups(dt, elapsedTime);
      if (victoryDelayTimer <= 0) {
        const payload = pendingVictoryPayload;
        pendingVictoryPayload = null;
        runEnded = true;
        runActive = false;
        callbacks?.onRunEnd?.(payload);
      }
      return;
    }

    elapsedRunTime += dt;

    // Timers
    if (player.invulnTimer > 0) player.invulnTimer = Math.max(0, player.invulnTimer - dt);
    if (player.attackCooldown > 0) player.attackCooldown = Math.max(0, player.attackCooldown - dt);
    if (player.attackAnimTimer > 0) player.attackAnimTimer = Math.max(0, player.attackAnimTimer - dt);
    if (player.relicBumpTimer > 0) player.relicBumpTimer = Math.max(0, player.relicBumpTimer - dt);
    if (critFloaterCooldown > 0) critFloaterCooldown = Math.max(0, critFloaterCooldown - dt);
    if (shieldSparkCooldown > 0) shieldSparkCooldown = Math.max(0, shieldSparkCooldown - dt);
    if (hitSoundCooldown > 0) hitSoundCooldown = Math.max(0, hitSoundCooldown - dt);
    if (manaEmptyHintCooldown > 0) manaEmptyHintCooldown = Math.max(0, manaEmptyHintCooldown - dt);

    // Continuous Mana Regeneration for Mage (regenerates at all times, faster after brief cast pause!)
    if (stats?.usesMana && player.maxMana > 0 && player.mana < player.maxMana) {
      const calmBoost = player.attackAnimTimer <= 0 && player.attackCooldown <= 0 ? 1.28 : 1.0;
      const beastBoost = player.beastTimeLeft > 0 ? 2.5 : 1.0;
      player.mana = Math.min(player.maxMana, player.mana + (stats.manaRegen || 9.5) * calmBoost * beastBoost * dt);
    }

    // Beast Mode countdown & exit
    const wasBeast = player.beastTimeLeft > 0;
    if (wasBeast) {
      player.beastTimeLeft = Math.max(0, player.beastTimeLeft - dt);
      if (player.beastTimeLeft === 0) {
        heroModel?.handle?.setBeastMode?.(false, currentClassId);
        heroModel?.obj?.userData?.setBeastMode?.(false, currentClassId);
        player.invulnTimer = Math.max(player.invulnTimer, 0.9);
        emitShockwave(player.x, player.z, 5.2, 0xfbbf24, 0.35);
      }
    }
    const beastActive = player.beastTimeLeft > 0;

    // Manual reload request via input.reload
    if (input?.reload || input?.reloadPressed) {
      triggerReload();
    }

    // Reload timer progression (with 0.5s/shell partial top-up for Shotgun!)
    if (player.isReloading) {
      if (player.overdriveAmmo > 0 || beastActive) {
        player.isReloading = false;
        player.reloadTimer = 0;
        player.reloadShellAccum = 0;
        player.ammo = player.maxAmmo;
        syncHeroReloadModel(false);
      } else {
        const perShell = stats?.reloadPerShellTime || 0;
        player.reloadTimer = Math.max(0, player.reloadTimer - dt);
        if (perShell > 0) {
          player.reloadShellAccum = (player.reloadShellAccum || 0) + dt;
          while (player.reloadShellAccum >= perShell && player.ammo < player.maxAmmo) {
            player.reloadShellAccum -= perShell;
            player.ammo = Math.min(player.maxAmmo, player.ammo + 1);
            audio?.playReloadShell?.();
          }
        } else {
          const prog =
            player.reloadDuration > 0 ? 1 - player.reloadTimer / player.reloadDuration : 1;
          const curWpn = WEAPONS[currentWeaponId];
          if (!player.reloadMidShellPlayed && prog >= 0.52 && curWpn?.isShotgun) {
            player.reloadMidShellPlayed = true;
            audio?.playReloadShell?.();
          }
        }
        if (player.reloadTimer <= 0 || player.ammo >= player.maxAmmo) {
          player.isReloading = false;
          player.reloadTimer = 0;
          player.reloadShellAccum = 0;
          player.ammo = player.maxAmmo;
          audio?.playReloadReady?.();
          syncHeroReloadModel(false);
        }
      }
    }

    // Class-specific periodic & aura blessings!
    if (player.sprintTimer > 0) player.sprintTimer = Math.max(0, player.sprintTimer - dt);

    // 🛡️ Сфера Отражения (mage_arcane_ward) recharge
    if ((stats.mageWardStacks || 0) > 0 && !player.arcaneWardReady) {
      player.arcaneWardTimer -= dt;
      if (player.arcaneWardTimer <= 0) {
        player.arcaneWardReady = true;
        emitParticles(player.x, 0.9, player.z, 0xc084fc, 8, 3.2, 0.12);
      }
    }

    // ☄️ Звездопад Архонта (mage_meteor_shower)
    const meteorStacks = stats.mageMeteorStacks || 0;
    if (attackEnabled && meteorStacks > 0 && !beastActive && enemies.length > 0) {
      player.meteorTimer -= dt;
      if (player.meteorTimer <= 0) {
        player.meteorTimer = Math.max(2.3, 4.4 - meteorStacks * 0.65);
        const mTarget = enemies[Math.floor(Math.random() * enemies.length)];
        if (mTarget && mTarget.hp > 0) {
          const mColor = stats.mageElementColor || 0xff5722;
          world?.spawnMeteorStrike?.({ x: mTarget.x, z: mTarget.z, radius: 3.8, color: mColor, duration: 0.34 });
          pendingMeteors.push({
            x: mTarget.x,
            z: mTarget.z,
            radius: 3.8,
            timer: 0.34,
            damage: Math.round(stats.damage * (1.6 + meteorStacks * 0.55)),
            element: stats.mageElement
          });
        }
      }
    }
    for (let mi = pendingMeteors.length - 1; mi >= 0; mi--) {
      const mt = pendingMeteors[mi];
      mt.timer -= dt;
      if (mt.timer <= 0) {
        audio?.playExplosion?.();
        world?.addScreenShake?.(0.32, 0.16);
        damageEnemiesInRadius(mt.x, mt.z, mt.radius, mt.damage, 12.0, null, true, mt.element);
        pendingMeteors.splice(mi, 1);
      }
    }

    // 💣 Шрапнельный Капкан (gun_shrapnel_mine)
    const mineStacks = stats.gunMineStacks || 0;
    if (attackEnabled && mineStacks > 0 && !beastActive && shrapnelMines.length < 6) {
      player.mineTimer -= dt;
      if (player.mineTimer <= 0) {
        player.mineTimer = Math.max(2.6, 5.2 - mineStacks * 0.75);
        let mineMesh = null;
        if (world?.scene) {
          mineMesh = new THREE.Mesh(sharedMiniCrateGeo, getProjMaterial(0xef4444));
          mineMesh.scale.set(0.65, 0.32, 0.65);
          mineMesh.position.set(player.x, 0.14, player.z);
          world.scene.add(mineMesh);
        }
        shrapnelMines.push({
          x: player.x,
          z: player.z,
          age: 0,
          armTime: 0.35,
          damage: Math.round(stats.damage * (1.7 + mineStacks * 0.6) * Math.max(1, (stats.pellets || 1) * 0.35)),
          mesh: mineMesh
        });
      }
    }
    for (let smi = shrapnelMines.length - 1; smi >= 0; smi--) {
      const sm = shrapnelMines[smi];
      sm.age += dt;
      if (sm.mesh) sm.mesh.rotation.y += dt * 2.5;
      let triggered = sm.age > 14.0;
      if (!triggered && sm.age >= sm.armTime) {
        for (let ei = 0; ei < enemies.length; ei++) {
          const e = enemies[ei];
          if (e && e.hp > 0 && Math.hypot(e.x - sm.x, e.z - sm.z) <= 1.45 + e.radius) {
            triggered = true;
            break;
          }
        }
      }
      if (triggered) {
        if (sm.age <= 14.0) {
          audio?.playExplosion?.();
          emitShockwave(sm.x, sm.z, 3.6, 0xf97316, 0.34);
          emitParticles(sm.x, 0.5, sm.z, 0xfbbf24, 18, 7.2, 0.16);
          damageEnemiesInRadius(sm.x, sm.z, 3.6, sm.damage, 13.0, null, true);
        }
        if (sm.mesh?.parent) sm.mesh.parent.remove(sm.mesh);
        shrapnelMines.splice(smi, 1);
      }
    }

    // 🌪️ Вихрь Жнеца (war_whirlwind): automatic 360° spin slash!
    const wwStacks = stats.warWhirlwindStacks || 0;
    if (attackEnabled && wwStacks > 0 && !beastActive) {
      player.whirlwindTimer -= dt;
      if (player.whirlwindTimer <= 0) {
        player.whirlwindTimer = Math.max(2.6, 4.8 - wwStacks * 0.65);
        audio?.playMeleeSwing?.(true);
        emitSlashArc(player.x, player.z, player.facing, stats.range * 1.12, Math.PI * 1.98, 0xef4444);
        damageEnemiesInRadius(player.x, player.z, stats.range * 1.12, Math.round(stats.damage * (0.95 + wwStacks * 0.35)), stats.knockback * 1.1, null, true);
      }
    }

    // 🗡️ Клинки Предков (war_orbit_blades): real 3D spinning spectral swords around Warrior!
    const orbitStacks = stats.warOrbitStacks || 0;
    if (orbitStacks > 0 && world?.scene) {
      const desiredBlades = 1 + orbitStacks;
      if (!orbitBladesGroup) {
        orbitBladesGroup = new THREE.Group();
        world.scene.add(orbitBladesGroup);
        orbitBladeMeshes = [];
      }
      while (orbitBladeMeshes.length < desiredBlades) {
        const bGrp = new THREE.Group();
        const bladeMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.04, 0.92),
          getProjMaterial(0xfde047)
        );
        bladeMesh.position.z = 0.25;
        bGrp.add(bladeMesh);
        orbitBladesGroup.add(bGrp);
        orbitBladeMeshes.push(bGrp);
      }
      orbitBladesGroup.position.set(player.x, 0.82, player.z);
      const baseSpin = elapsedTime * (3.6 + orbitStacks * 0.55);
      const orbitRad = 2.45;
      for (let bi = 0; bi < orbitBladeMeshes.length; bi++) {
        const ang = baseSpin + (bi / orbitBladeMeshes.length) * TWO_PI;
        const bx = Math.cos(ang) * orbitRad;
        const bz = Math.sin(ang) * orbitRad;
        orbitBladeMeshes[bi].position.set(bx, 0, bz);
        orbitBladeMeshes[bi].rotation.y = -ang;
        const wx = player.x + bx;
        const wz = player.z + bz;
        for (let ei = enemies.length - 1; ei >= 0; ei--) {
          if (!attackEnabled) break;
          const e = enemies[ei];
          if (!e || e.hp <= 0) continue;
          if (Math.hypot(e.x - wx, e.z - wz) <= 0.75 + e.radius) {
            const lastHit = player.orbitHitTimers.get(e.uid) || 0;
            if (elapsedTime - lastHit >= 0.36) {
              player.orbitHitTimers.set(e.uid, elapsedTime);
              applyDamageToEnemy(e, Math.max(4, Math.round(stats.damage * 0.55)), bx * 2.2, bz * 2.2, false, { isSplash: true });
            }
          }
        }
      }
    }

    // 1. Player Movement, Physical Shotgun Recoil & Obstacle Sliding
    let mx = Number(input?.moveX) || 0;
    let mz = Number(input?.moveZ) || 0;
    const moveMag = Math.hypot(mx, mz);
    if (moveMag > 1) {
      mx /= moveMag;
      mz /= moveMag;
    }
    const speedRatio = Math.min(1, moveMag);
    const sprintMult = player.sprintTimer > 0 ? 1.35 : 1.0;
    const effectiveMoveSpeed = stats.moveSpeed * (beastActive ? 1.45 : 1.0) * sprintMult;

    if (moveMag > 0.01) {
      player.x += mx * effectiveMoveSpeed * dt;
      player.z += mz * effectiveMoveSpeed * dt;
      player.standStillTimer = Math.max(0, (player.standStillTimer || 0) - dt * 4.5);
    } else {
      const maxFocusTime = Math.max(0.05, stats?.focusTime || 1.0);
      player.standStillTimer = Math.min(maxFocusTime, (player.standStillTimer || 0) + dt);
    }

    // Smooth decay of physical recoil over ~0.14s
    if (Math.abs(player.recoilVx) > 0.001 || Math.abs(player.recoilVz) > 0.001) {
      player.x += player.recoilVx * 1.75 * dt;
      player.z += player.recoilVz * 1.75 * dt;
      const recoilDamp = Math.exp(-13.5 * dt);
      player.recoilVx *= recoilDamp;
      player.recoilVz *= recoilDamp;
      if (Math.hypot(player.recoilVx, player.recoilVz) < 0.02) {
        player.recoilVx = 0;
        player.recoilVz = 0;
      }
    }

    const resolvedPlayer = resolveObstaclesAndBounds(player.x, player.z, player.radius, ARENA_PLAYER_LIMIT);
    player.x = resolvedPlayer.x;
    player.z = resolvedPlayer.z;

    // 2. Aiming & Combat Firing
    let engagedAimAngle = null;
    if (!beastActive && attackEnabled) {
      const canInterruptShellReload =
        player.isReloading && (stats?.reloadPerShellTime || 0) > 0 && player.ammo > 0;
      const canShootNow = player.overdriveAmmo > 0 || !player.isReloading;
      const manualActive = Boolean(input?.firing) || (!autoAim && Boolean(input?.hasManualAim));
      if (manualActive) {
        const ax = Number(input?.aimWorldX);
        const az = Number(input?.aimWorldZ);
        if (Number.isFinite(ax) && Number.isFinite(az)) {
          const adx = ax - player.x;
          const adz = az - player.z;
          if (adx * adx + adz * adz > 0.001) {
            engagedAimAngle = Math.atan2(adx, adz);
          }
        }
        if (engagedAimAngle === null) {
          engagedAimAngle = moveMag > 0.05 ? Math.atan2(mx, mz) : player.facing;
        }
        if ((canShootNow || canInterruptShellReload) && player.attackCooldown <= 0) {
          performHeroAttack(engagedAimAngle, true);
        }
      } else if (autoAim) {
        const target = findAutoAimTarget(stats.clampToArenaBounds ? stats.range : stats.range * 1.06);
        if (target) {
          engagedAimAngle = Math.atan2(target.x - player.x, target.z - player.z);
          const distToTarget = Math.hypot(target.x - player.x, target.z - player.z);
          const emergencyShellShot = canInterruptShellReload && player.ammo >= 1 && distToTarget <= 3.6;
          if ((canShootNow || emergencyShellShot) && player.attackCooldown <= 0) {
            performHeroAttack(engagedAimAngle, false);
          }
        }
      }
    }

    if (engagedAimAngle !== null) {
      player.facing = lerpAngle(player.facing, engagedAimAngle, dt * 18);
    } else if (moveMag > 0.05) {
      player.facing = lerpAngle(player.facing, Math.atan2(mx, mz), dt * 14);
    }

    if (moveMag > 0.08) {
      const clampedStepRate = Math.max(0.75, Math.min(1.65, speedRatio || 1)) * 9.4;
      const prevStepIdx = Math.floor((player.stepPhase || 0) / Math.PI);
      player.stepPhase = (player.stepPhase || 0) + dt * clampedStepRate;
      const nextStepIdx = Math.floor(player.stepPhase / Math.PI);
      if (nextStepIdx > prevStepIdx) {
        audio?.playFootstep?.(currentClassId, nextStepIdx);
        if (currentClassId === 'mage') {
          const sideSign = nextStepIdx % 2 === 0 ? -0.18 : 0.18;
          const fx = player.x + Math.cos(player.facing) * sideSign;
          const fz = player.z - Math.sin(player.facing) * sideSign;
          const elemId = stats?.mageElement || 'water';
          const stepCol =
            elemId === 'fire' ? 0xf97316 : elemId === 'lightning' ? 0xfacc15 : elemId === 'air' ? 0x5eead4 : 0x38bdf8;
          world?.spawnShockwaveRing?.({ x: fx, y: 0.035, z: fz, radius: 0.54, color: stepCol, duration: 0.30 });
          if (elemId === 'water') {
            emitParticles(fx, 0.08, fz, 0x7dd3fc, 3, 2.2, 0.07);
          }
        }
      }
    } else {
      player.stepPhase = 0;
    }

    if (heroModel?.obj) {
      const heroGroundY = world?.getGroundHeight?.(player.x, player.z) ?? 0;
      heroModel.obj.position.x = player.x;
      heroModel.obj.position.y = heroGroundY;
      heroModel.obj.position.z = player.z;
      heroModel.obj.rotation.y = player.facing;
      heroModel.obj.rotation.x = 0;
      heroModel.obj.rotation.z = 0;

      const strideRatio = speedRatio * (effectiveMoveSpeed / 4.2);
      animateEntityModel(
        heroModel,
        dt,
        moveMag > 0.05,
        strideRatio,
        player.attackAnimTimer > 0,
        beastActive,
        elapsedTime
      );
    }
    syncFollowTarget(player.x, player.z, heroModel?.obj, dt);

    // 3. Companion AI (Mini Skeleton Squire)
    if (companion) {
      if (companion.boostTimer > 0) companion.boostTimer = Math.max(0, companion.boostTimer - dt);
      companion.orbitAngle += dt * 1.35;
      const desiredX = player.x + Math.cos(companion.orbitAngle) * 2.15;
      const desiredZ = player.z + Math.sin(companion.orbitAngle) * 2.15;
      companion.x += (desiredX - companion.x) * Math.min(1, dt * 7.5);
      companion.z += (desiredZ - companion.z) * Math.min(1, dt * 7.5);

      companion.shootCooldown -= dt;
      let compTarget = null;
      let compBestDistSq = 13.5 * 13.5;
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (e.hp <= 0) continue;
        if (world?.isWorldPointVisible && !world.isWorldPointVisible(e.x, e.z, 0.85, 0.94)) continue;
        const dSq = (e.x - companion.x) ** 2 + (e.z - companion.z) ** 2;
        if (dSq < compBestDistSq) {
          compBestDistSq = dSq;
          compTarget = e;
        }
      }

      if (compTarget) {
        companion.facing = Math.atan2(compTarget.x - companion.x, compTarget.z - companion.z);
        if (companion.shootCooldown <= 0) {
          companion.shootCooldown = companion.boostTimer > 0 ? 0.32 : 0.54;
          triggerModelAttack(companion.model);
          spawnProjectile({
            x: companion.x,
            z: companion.z,
            vx: Math.sin(companion.facing) * 24,
            vz: Math.cos(companion.facing) * 24,
            damage: Math.max(8, Math.round(stats.damage * (companion.boostTimer > 0 ? 0.65 : 0.48))),
            maxDist: 14.5,
            pierce: 1,
            splashRadius: 0,
            knockback: 2.2,
            kind: 'bullet',
            visualType: 'buckshot',
            color: 0x38bdf8,
            isEnemy: false
          });
        }
      } else if (moveMag > 0.05) {
        companion.facing = lerpAngle(companion.facing, player.facing, dt * 8);
      }

      companion.model.obj.position.x = companion.x;
      companion.model.obj.position.z = companion.z;
      companion.model.obj.rotation.y = companion.facing;
      animateEntityModel(companion.model, dt, moveMag > 0.05, speedRatio, false, false, elapsedTime);
    }

    // 4. Kill-Quota Wave Spawner, Relic Crate, Mid-Quota Mini-Boss & Mandatory Boss Finale!
    // Temporary peaceful map-inspection mode turned OFF so monsters & new Tripo Zombie spawn normally!
    const TEMP_PEACEFUL_MAP_INSPECT = false;
    if (!TEMP_PEACEFUL_MAP_INSPECT) {
      if (!relicCrateSpawned && currentLevelDef.unlockWeaponTier && (kills >= Math.max(8, Math.floor(targetKills * 0.28)) || elapsedRunTime >= 18.0)) {
        relicCrateSpawned = true;
        spawnRelicWeaponEvent();
      }

      // Stage Mid-Run Mini-Boss: appears midway BEFORE the timed Boss on Boss chapters (5,10,15,20,25)!
      if (
        !midMiniBossSpawned &&
        !finaleStarted &&
        currentLevelDef.hasBoss &&
        (currentLevelDef.finaleMiniBossType || currentLevelDef.miniBossPool?.length > 0) &&
        (kills >= Math.floor(targetKills * 0.45) || (bossSpawnCountdown > 0 && bossSpawnCountdown <= (currentLevelDef.bossSpawnTimerSec || 45) * 0.55))
      ) {
        midMiniBossSpawned = true;
        spawnMiniBossFromPool(false);
      }

      // Boss chapters (5,10,15,20,25): timed Boss Arrival countdown EVEN IF horde/mini-boss remain; Non-Boss chapters: trigger at targetKills!
      if (!finaleStarted) {
        if (currentLevelDef.hasBoss) {
          bossSpawnCountdown = Math.max(0, bossSpawnCountdown - dt);
          if (bossSpawnCountdown <= 0 || kills >= targetKills) {
            timeLeft = 0;
            startWaveFinale();
          } else {
            timeLeft = Math.ceil(bossSpawnCountdown);
          }
        } else if (kills >= targetKills) {
          timeLeft = 0;
          startWaveFinale();
        } else {
          timeLeft = Math.max(1, targetKills - kills);
        }
      }

      // Minigore-2 Wave Pacing: Distinct rhythmic horde waves that accelerate with time pressure,
      // plus instant wave reinforcement if player wipes the field (< 3 enemies left)!
      spawnTimer -= dt;
      if (!finaleStarted && enemies.length <= 2 && spawnTimer > 0.55) {
        spawnTimer = 0.55;
      }
      if (spawnTimer <= 0) {
        const timeRamp = clamp(elapsedRunTime / 60, 0, 1);
        const baseWaveGap = finaleStarted ? 9.5 : 6.4 - timeRamp * 1.65;
        spawnTimer = Math.max(4.2, baseWaveGap * clamp(currentLevelDef.spawnInterval || 1, 0.72, 1.12));
        spawnWavePack();
      }
    }

    // 50. Update Dying Skeleton Corpses (Rigged Death Collapse onto Cobblestones -> Pool Recycle!)
    for (let ci = dyingCorpses.length - 1; ci >= 0; ci--) {
      const dc = dyingCorpses[ci];
      dc.age += dt;
      if (dc.age >= dc.duration) {
        removeSceneObject(dc.model.obj, dc.model.handle);
        dyingCorpses.splice(ci, 1);
        continue;
      }
      const sink = dc.age > dc.duration * 0.72 ? (dc.age - dc.duration * 0.72) / (dc.duration * 0.28) : 0;
      dc.model.handle?.updateDying?.(dt, sink);
    }

    // 50B. Update Water Mage's 7% Spherical Water Prisons (1.1s Mid-Air Suspension -> Slam Down for 3x Normal Attack Damage!)
    for (let wpi = activeWaterPrisons.length - 1; wpi >= 0; wpi--) {
      const wp = activeWaterPrisons[wpi];
      wp.timer -= dt;
      if (wp.timer > 0) {
        // Also snare any enemy that walks into the floating water sphere while it's active!
        for (let ei = 0; ei < enemies.length; ei++) {
          const cand = enemies[ei];
          if (!cand || cand.hp <= 0 || wp.targets.includes(cand)) continue;
          if (Math.hypot(cand.x - wp.x, cand.z - wp.z) <= wp.radius) {
            cand.waterLiftTimer = wp.timer;
            cand.stunTimer = Math.max(cand.stunTimer || 0, wp.timer + 0.1);
            wp.targets.push(cand);
          }
        }
        for (let ti = 0; ti < wp.targets.length; ti++) {
          const te = wp.targets[ti];
          if (!te || te.hp <= 0) continue;
          te.waterLiftTimer = Math.max(te.waterLiftTimer || 0, wp.timer);
          te.stunTimer = Math.max(te.stunTimer || 0, wp.timer + 0.08);
          // Pull firmly inside the suspended 3D water sphere!
          const orbitOffX = Math.cos(ti * 2.1 + elapsedTime * 3.2) * 0.42;
          const orbitOffZ = Math.sin(ti * 2.1 + elapsedTime * 3.2) * 0.42;
          te.x += (wp.x + orbitOffX - te.x) * Math.min(1, dt * 11.0);
          te.z += (wp.z + orbitOffZ - te.z) * Math.min(1, dt * 11.0);
          te.vx = 0;
          te.vz = 0;
        }
      } else {
        audio?.playElementImpact?.('water_prison_slam');
        world?.addScreenShake?.(0.36, 0.18);
        emitParticles(wp.x, 0.55, wp.z, 0x38bdf8, 24, 8.2, 0.19);
        emitParticles(wp.x, 0.45, wp.z, 0xe0f2fe, 12, 6.0, 0.15);
        for (let ti = 0; ti < wp.targets.length; ti++) {
          const te = wp.targets[ti];
          if (!te || te.hp <= 0) continue;
          te.waterLiftTimer = 0;
          if (te.model?.obj) {
            te.model.obj.position.y = 0;
            te.model.obj.rotation.x = 0;
            te.model.obj.rotation.z = 0;
          }
          floatText(`🌊 ×3! -${wp.slamDamage}`, te.x, te.z, '#38bdf8');
          applyDamageToEnemy(te, wp.slamDamage, 0, 0, false, {
            isWaterSlam: true,
            isSplash: true,
            mageElement: 'water'
          });
        }
        activeWaterPrisons.splice(wpi, 1);
      }
    }

    // 5A. Boss Ground Hazards Update
    for (let i = bossHazards.length - 1; i >= 0; i--) {
      const hz = bossHazards[i];
      hz.timer -= dt;
      if (hz.timer <= 0) {
        const hzColor = hz.color || 0x9333ea;
        const hzDmg = hz.damage || Math.round(26 * (currentLevelDef.dmgScale || 1));
        bossHazards.splice(i, 1);

        emitShockwave(hz.x, hz.z, hz.radius, hzColor, 0.38);
        emitParticles(hz.x, 0.5, hz.z, hzColor, 20, 7.2, 0.2);
        audio?.playExplosion?.();
        world?.addScreenShake?.(0.32, 0.2);

        const pDist = Math.hypot(player.x - hz.x, player.z - hz.z);
        if (pDist <= hz.radius + player.radius * 0.45) {
          applyDamageToPlayer(hzDmg);
        }
      }
    }

    // 5B. Toxic Slime / Bomber Hazards Update (Hurts player AND blasts nearby enemies for chain reactions!)
    for (let i = bomberHazards.length - 1; i >= 0; i--) {
      const bh = bomberHazards[i];
      if (!bh) continue;
      bh.timer -= dt;
      if (bh.timer <= 0) {
        bomberHazards.splice(i, 1);

        const bhColor = bh.color || 0x22c55e;
        audio?.playExplosion?.();
        world?.addScreenShake?.(0.45, 0.24);
        emitShockwave(bh.x, bh.z, bh.radius, bhColor, 0.38);
        emitParticles(bh.x, 0.6, bh.z, bhColor, 24, 8.2, 0.20);

        const pDist = Math.hypot(player.x - bh.x, player.z - bh.z);
        if (pDist <= bh.radius + player.radius * 0.45) {
          applyDamageToPlayer(bh.playerDamage);
        }
        damageEnemiesInRadius(bh.x, bh.z, bh.radius, bh.enemyDamage, 10.5, null, false);
      }
    }

    // 6. Projectiles Update (Includes Shotgun Distance Falloff & Shieldbearer Directional Metadata!)
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const proj = projectiles[i];
      const stepX = proj.vx * dt;
      const stepZ = proj.vz * dt;
      const stepLen = Math.hypot(stepX, stepZ);
      proj.x += stepX;
      proj.z += stepZ;
      proj.traveled += stepLen;
      proj.vis.obj.position.set(proj.x, 0.72, proj.z);

      if (proj.kind === 'magic') {
        if (proj.mageElement !== 'water') {
          proj.vis.obj.rotation.y += dt * 8;
        }
        proj.trailTick += dt;
        if (proj.trailTick >= 0.055) {
          proj.trailTick = 0;
          emitParticles(proj.x, 0.72, proj.z, proj.color, 1, 1.4, 0.1);
        }
      }

      let removeProj = false;

      if (Math.abs(proj.x) > ARENA_HALF_SIZE || Math.abs(proj.z) > ARENA_HALF_SIZE) {
        removeProj = true;
      } else if (!proj.isEnemy && !stats?.clampToArenaBounds && world?.isWorldPointVisible && !world.isWorldPointVisible(proj.x, proj.z, 0.72, 1.04)) {
        removeProj = true;
      } else if (Array.isArray(world?.obstacles)) {
        for (let o = 0; o < world.obstacles.length; o++) {
          const obs = world.obstacles[o];
          if (!obs) continue;
          const ox = obs.x ?? obs.position?.x ?? 0;
          const oz = obs.z ?? obs.position?.z ?? 0;
          const orad = obs.radius ?? obs.r ?? 0.85;
          if ((proj.x - ox) ** 2 + (proj.z - oz) ** 2 < orad * orad) {
            removeProj = true;
            break;
          }
        }
      }

      if (!removeProj && proj.isEnemy) {
        const dPlayer = Math.hypot(proj.x - player.x, proj.z - player.z);
        if (dPlayer <= player.radius + 0.32) {
          applyDamageToPlayer(proj.damage);
          removeProj = true;
        }
      } else if (!removeProj && !proj.isEnemy) {
        for (let eIdx = enemies.length - 1; eIdx >= 0; eIdx--) {
          const e = enemies[eIdx];
          if (!e || e.hp <= 0 || proj.hitUids.has(e.uid)) continue;
          const dx = e.x - proj.x;
          const dz = e.z - proj.z;
          if (dx * dx + dz * dz <= (e.radius + 0.36) ** 2) {
            proj.hitUids.add(e.uid);
            const pSpd = Math.hypot(proj.vx, proj.vz) || 1;
            const pDirX = proj.vx / pSpd;
            const pDirZ = proj.vz / pSpd;

            // Shotgun Distance Falloff: <= 4.2m deals 100% (6 pellets = -10% vs Colt); tapers to 60% at max range!
            let falloffMult = 1.0;
            let knockMult = 1.0;
            if (proj.isShotgunPellet) {
              if (proj.traveled <= 4.2) {
                falloffMult = 1.0;
                knockMult = 1.15;
              } else {
                const t = clamp((proj.traveled - 4.2) / Math.max(0.5, proj.maxDist - 4.2), 0, 1);
                falloffMult = 1.0 + (0.60 - 1.0) * t;
                knockMult = 1.0 - 0.35 * t;
              }
            }

            const decayArr = proj.pierceDecay;
            const decayMult = Array.isArray(decayArr)
              ? (decayArr[Math.min(proj.hitsLanded || 0, decayArr.length - 1)] ?? decayArr[decayArr.length - 1] ?? 1.0)
              : 1.0;
            proj.hitsLanded = (proj.hitsLanded || 0) + 1;

            const critMult = proj.isCrit ? stats?.critMult || 1.75 : 1.0;
            const hitDamage = Math.max(1, Math.round(proj.damage * falloffMult * decayMult * critMult));
            const kx = pDirX * proj.knockback * knockMult;
            const kz = pDirZ * proj.knockback * knockMult;

            applyDamageToEnemy(e, hitDamage, kx, kz, true, {
              isProjectile: true,
              isShotgunPellet: proj.isShotgunPellet,
              isCrit: proj.isCrit,
              mageElement: proj.mageElement,
              traveled: proj.traveled,
              dirX: pDirX,
              dirZ: pDirZ
            });

            if (proj.mageElement === 'air') {
              // 🌪️ Air: Tight small wind-vortex splash (1.85m — smaller than Lightning chain reach, NO flat ground ring!)
              const catAir = stats?.mageCatalystStacks || 0;
              world?.spawnElementalImpact?.({ element: 'air', x: proj.x, z: proj.z, radius: 1.85 });
              damageEnemiesInRadius(
                proj.x,
                proj.z,
                1.85,
                Math.max(2, Math.round(hitDamage * (0.28 + catAir * 0.20))),
                proj.knockback * 0.72,
                e,
                false,
                'air'
              );
            } else if (proj.kind === 'magic') {
              if (proj.mageElement === 'water') {
                // Crown splash of water droplets & foam matching 00:03 of Water_mage_shooting_projectile!
                emitParticles(proj.x, 0.68, proj.z, 0x38bdf8, 13, 6.4, 0.16);
                emitParticles(proj.x, 0.76, proj.z, 0xe0faff, 7, 4.9, 0.12);
              } else {
                emitParticles(proj.x, 0.78, proj.z, proj.color, 8, 4.6, 0.15);
              }
            } else if (proj.splashRadius > 0) {
              const sRad = proj.splashRadius || 2.2;
              emitShockwave(proj.x, proj.z, sRad, proj.color, 0.28);
              emitParticles(proj.x, 0.72, proj.z, proj.color, 8, 5.4, 0.15);
              damageEnemiesInRadius(proj.x, proj.z, sRad, Math.round(hitDamage * 0.55), proj.knockback * 0.7, e, false);
            }

            proj.pierceLeft -= 1;
            if (proj.pierceLeft <= 0) {
              removeProj = true;
              break;
            }
          }
        }

        // Hit shootable crates (Relic Crate & Supply Crate)
        if (!removeProj) {
          for (let pIdx = pickups.length - 1; pIdx >= 0; pIdx--) {
            const p = pickups[pIdx];
            if (!p || p.hp <= 0 || p.uid === proj.ignoreCrateUid) continue;
            if (p.type !== 'relic_weapon_crate' && p.type !== 'supply_crate' && p.type !== 'mimic_disguise') continue;
            const dSq = (p.x - proj.x) ** 2 + (p.z - proj.z) ** 2;
            if (dSq <= (p.radius + 0.3) ** 2) {
              hitCrate(p);
              if (p.hp <= 0) {
                removeSceneObject(p.model.obj, p.model.handle);
                pickups.splice(pIdx, 1);
              }
              removeProj = true;
              break;
            }
          }
        }
      }

      if (!removeProj && proj.traveled >= proj.maxDist) {
        if (!proj.isEnemy && proj.kind === 'magic' && proj.splashRadius > 0) {
          emitShockwave(proj.x, proj.z, proj.splashRadius, proj.color, 0.26);
          emitParticles(proj.x, 0.65, proj.z, proj.color, 9, 4.5, 0.14);
          damageEnemiesInRadius(
            proj.x,
            proj.z,
            proj.splashRadius,
            Math.round(proj.damage * 0.65),
            proj.knockback * 0.6,
            null,
            false
          );
        }
        removeProj = true;
      }

      if (removeProj) {
        removeSceneObject(proj.vis.obj, proj.vis.handle);
        projectiles.splice(i, 1);
      }
    }

    // 7. 9-Archetype Enemies & Bosses AI, Burn/Frost Ticks, Separation & Contact
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (!e || e.hp <= 0) {
        if (e && !e._corpseTransferred) removeSceneObject(e.model.obj, e.model.handle);
        enemies.splice(i, 1);
        continue;
      }

      if (e.contactCooldown > 0) e.contactCooldown = Math.max(0, e.contactCooldown - dt);
      if (e.trampleCooldown > 0) e.trampleCooldown = Math.max(0, e.trampleCooldown - dt);
      if (e.stunTimer > 0) e.stunTimer = Math.max(0, e.stunTimer - dt);
      if (e.disarmTimer > 0) {
        e.disarmTimer = Math.max(0, e.disarmTimer - dt);
        e.meleeCooldown = Math.max(e.meleeCooldown || 0, 0.15);
        e.cloakAttackTimer = Math.max(e.cloakAttackTimer || 0, 0.15);
        e.shootCooldown = Math.max(e.shootCooldown || 0, 0.15);
        e.windupTimer = 0;
      }
      if (e.frostTimer > 0) e.frostTimer = Math.max(0, e.frostTimer - dt);
      if (e.soakedTimer > 0) e.soakedTimer = Math.max(0, e.soakedTimer - dt);
      if (e.waterLiftTimer > 0) e.waterLiftTimer = Math.max(0, e.waterLiftTimer - dt);
      if (e.napalmTimer > 0) {
        e.napalmTimer = Math.max(0, e.napalmTimer - dt);
        if (e.napalmTimer <= 0) e.napalmStacks = 0;
      }

      // 🔥 Visible continuous Fire Burn DoT flames on burning enemies!
      if (e.burnTimer > 0 && e.burnDps > 0) {
        e.burnTimer = Math.max(0, e.burnTimer - dt);
        e.fireVfxTick = (e.fireVfxTick || 0) + dt;
        if (e.fireVfxTick >= 0.18) {
          e.fireVfxTick = 0;
          emitParticles(e.x + (Math.random() - 0.5) * 0.35, 0.65, e.z + (Math.random() - 0.5) * 0.35, Math.random() < 0.5 ? 0xff5722 : 0xfef08a, 2, 2.2, 0.13);
        }
        e.burnTickTimer += dt;
        if (e.burnTickTimer >= 0.45) {
          e.burnTickTimer -= 0.45;
          applyDamageToEnemy(e, Math.max(1, Math.round(e.burnDps * 0.45)), 0, 0, false, { isDoT: true });
          if (e.hp <= 0) {
            if (!e._corpseTransferred) removeSceneObject(e.model.obj, e.model.handle);
            enemies.splice(i, 1);
            continue;
          }
        }
      }

      // If enemy is suspended in mid-air inside Water Mage's 7% Spherical Water Ball, lift & flail their 3D model right inside the bubble!
      if ((e.waterLiftTimer || 0) > 0) {
        if (e.model?.obj) {
          const liftRamp = Math.min(1, (1.15 - e.waterLiftTimer) / 0.20);
          const targetY = e.isBoss ? 0.45 : 1.18;
          e.model.obj.position.x = e.x;
          e.model.obj.position.y = targetY * liftRamp + Math.sin(elapsedTime * 9 + e.uid) * 0.08;
          e.model.obj.position.z = e.z;
          e.facing += dt * 3.2;
          e.model.obj.rotation.y = e.facing;
          // Animate arms & legs flailing inside the water sphere!
          animateEntityModel(e.model, dt * 1.6, true, 1.4, false, false, elapsedTime);
          if (!e.isBoss) {
            e.model.obj.rotation.x = -0.56 * liftRamp;
            e.model.obj.rotation.z = Math.sin(elapsedTime * 7 + e.uid) * 0.34;
          }
        }
        continue;
      } else if (
        e.model?.obj &&
        (e.model.obj.position.y > 0.01 || e.model.obj.rotation.x !== 0 || e.model.obj.rotation.z !== 0) &&
        !e.isBoss
      ) {
        e.model.obj.position.y = 0;
        e.model.obj.rotation.x = 0;
        e.model.obj.rotation.z = 0;
      }

      // Apply knockback velocity with crisp damping
      e.x += e.vx * dt;
      e.z += e.vz * dt;
      const damp = Math.exp(-10 * dt);
      e.vx *= damp;
      e.vz *= damp;

      const slowMult = e.frostTimer > 0 ? e.frostFactor || 0.75 : 1.0;
      const moveSpeed = e.speed * slowMult;
      const prevEx = e.x;
      const prevEz = e.z;

      if (e.isBoss && e.stunTimer <= 0) {
        updateBossAI(e, dt, elapsedTime);
      } else if (e.stunTimer <= 0) {
        const dx = player.x - e.x;
        const dz = player.z - e.z;
        const dist = Math.hypot(dx, dz) || 0.001;
        const angToPlayer = Math.atan2(dx, dz);

        // --- ARCHETYPE 0: HOPPING MONSTERS (`corrupted_treant`, `mimic_chest` — Coils on ground, then leaps in discrete forward arcs!) ---
        if (e.type === 'corrupted_treant' || e.type === 'mimic_chest') {
          const isMimic = e.type === 'mimic_chest';
          if ((e.emergeTimer || 0) <= 0) {
            e.hopCycle = ((e.hopCycle || 0) + dt * (isMimic ? 1.32 : 1.18) * slowMult) % 1.0;
            // Grounded coil [0.00..0.17] & landing stomp [0.83..1.00]: ZERO floor crawling — only turns toward hero & spawns landing dust!
            if (e.hopCycle >= 0.17 && e.hopCycle <= 0.83) {
              const airT = (e.hopCycle - 0.17) / 0.66;
              const hopBurst = 0.85 + 2.55 * Math.sin(airT * Math.PI);
              e.facing = lerpAngle(e.facing, angToPlayer, dt * 6.5);
              e.x += (dx / dist) * moveSpeed * hopBurst * dt;
              e.z += (dz / dist) * moveSpeed * hopBurst * dt;
              e._hopLandedDust = false;
            } else {
              e.facing = lerpAngle(e.facing, angToPlayer, dt * 12);
              if (e.hopCycle >= 0.83 && !e._hopLandedDust) {
                e._hopLandedDust = true;
                world?.spawnShockwaveRing?.({ x: e.x, y: 0.03, z: e.z, radius: 0.88, color: isMimic ? 0xc084fc : 0xf97316, duration: 0.28 });
                emitParticles(e.x, 0.10, e.z, isMimic ? 0xa855f7 : 0x78716c, 6, 3.2, 0.11);
              }
            }
          } else {
            e.facing = lerpAngle(e.facing, angToPlayer, dt * 8);
          }
        }
        // --- ARCHETYPE 1: CHARGERS (`iron_knight`, `brute` — 0.60s telegraph -> 0.65s bull-charge @ 13.5 spd!) ---
        else if (e.canCharge) {
          if (e.chargeState === 'telegraph') {
            e.chargeTimer -= dt;
            if (Math.random() < 0.45) {
              emitParticles(e.x, 0.95, e.z, e.color || 0xef4444, 2, 3.2, 0.14);
            }
            if (e.chargeTimer <= 0) {
              e.chargeState = 'charging';
              e.chargeTimer = 0.65;
              triggerModelAttack(e.model);
              audio?.playMeleeSwing?.(true);
            }
          } else if (e.chargeState === 'charging') {
            e.chargeTimer -= dt;
            e.facing = Math.atan2(e.chargeDirX, e.chargeDirZ);
            e.x += e.chargeDirX * (13.5 * slowMult) * dt;
            e.z += e.chargeDirZ * (13.5 * slowMult) * dt;
            if (Math.random() < 0.5) {
              emitParticles(e.x, 0.25, e.z, e.color || 0xf97316, 1, 2.4, 0.13);
            }
            if (e.chargeTimer <= 0) {
              e.chargeState = 'walk';
              e.specialCooldown = 4.5;
            }
          } else {
            e.facing = lerpAngle(e.facing, angToPlayer, dt * 8);
            e.x += (dx / dist) * moveSpeed * dt;
            e.z += (dz / dist) * moveSpeed * dt;
            e.specialCooldown -= dt;
            if (e.specialCooldown <= 0 && dist <= 11.0 && dist >= 2.2) {
              e.chargeState = 'telegraph';
              e.chargeTimer = 0.60;
              e.chargeDirX = dx / dist;
              e.chargeDirZ = dz / dist;
              e.facing = angToPlayer;
              triggerModelHitFlash(e.model);
              emitParticles(e.x, 1.0, e.z, 0xef4444, 12, 4.8, 0.16);
              emitDangerZone(
                clamp(e.x + e.chargeDirX * 4.4, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT),
                clamp(e.z + e.chargeDirZ * 4.4, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT),
                2.0,
                0.60,
                0xef4444
              );
              floatText(e.type === 'corrupted_treant' ? '🌿 КОРНЕВОЙ ТАРАН!' : '⚠️ ТАРАН!', e.x, e.z, '#f87171');
            }
          }
        }
        // --- ARCHETYPE 2: SUMMONERS (`mummy`, `necromancer` — keeps ~10.8m, raises 2 ember_skeletons every 6.8s) ---
        else if (e.summoner) {
          const keepDist = e.keepDistance || 10.8;
          e.facing = lerpAngle(e.facing, angToPlayer, dt * 8);
          if (dist > keepDist) {
            e.x += (dx / dist) * moveSpeed * dt;
            e.z += (dz / dist) * moveSpeed * dt;
          }
          e.specialCooldown -= dt;
          if (e.specialCooldown <= 0 && dist <= 20.0) {
            e.specialCooldown = 6.8;
            triggerModelAttack(e.model);
            audio?.playMagicCast?.('spark_staff');
            emitParticles(e.x, 0.75, e.z, e.color || 0x22d3ee, 16, 4.8, 0.15);

            for (let s = -1; s <= 1; s += 2) {
              if (enemies.length >= MAX_ACTIVE_ENEMIES + 6) break;
              const perpX = Math.cos(angToPlayer) * s * 1.5;
              const perpZ = -Math.sin(angToPlayer) * s * 1.5;
              const sx = clamp(e.x + perpX, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
              const sz = clamp(e.z + perpZ, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
              spawnEnemy('ember_skeleton', sx, sz, null, { isSummoned: true, xp: 4, gold: 1 });
              emitParticles(sx, 0.55, sz, 0xf97316, 7, 3.8, 0.13);
            }
          }
        }
        // --- ARCHETYPE 3B: VAMPIRE LORD (`vampire_lord` — stalks into melee for Cloak_Slash & pauses to summon Vampire Bats! ZERO ranged orbs!) ---
        else if (e.canSummonBats || e.type === 'vampire_lord') {
          e.cloakAttackTimer = Math.max(0, (e.cloakAttackTimer || 0) - dt);
          e.facing = lerpAngle(e.facing, angToPlayer, dt * 9);
          if ((e.castPauseTimer || 0) > 0) {
            e.castPauseTimer = Math.max(0, e.castPauseTimer - dt);
          } else if ((e.emergeTimer || 0) <= 0) {
            e.batSummonCooldown = (e.batSummonCooldown ?? 2.4) - dt;
            let aliveBats = 0;
            for (let b = 0; b < enemies.length; b++) {
              if (enemies[b]?.hp > 0 && enemies[b].type === 'vampire_bat') aliveBats += 1;
            }
            if (e.batSummonCooldown <= 0 && dist <= 16.5 && aliveBats < 5) {
              e.batSummonCooldown = 6.2;
              e.castPauseTimer = 0.72;
              triggerModelAttack(e.model, 'Cast_Attack');
              world?.spawnShockwaveRing?.({ x: e.x, y: 0.04, z: e.z, radius: 2.2, color: 0xe11d48, duration: 0.36 });
              emitParticles(e.x, 1.05, e.z, 0xf43f5e, 14, 4.5, 0.14);
              const batCount = aliveBats <= 3 ? 2 : 1;
              for (let s = 0; s < batCount; s++) {
                if (enemies.length >= MAX_ACTIVE_ENEMIES + 6) break;
                const side = s === 0 ? -1 : 1;
                const sx = clamp(e.x + Math.cos(angToPlayer) * side * 1.45, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
                const sz = clamp(e.z - Math.sin(angToPlayer) * side * 1.45, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
                spawnEnemy('vampire_bat', sx, sz, null, { isSummoned: true, noEmerge: true, xp: 4, gold: 2 });
                emitParticles(sx, 0.75, sz, 0xe11d48, 8, 3.6, 0.13);
              }
            } else {
              const stopDist = e.radius + player.radius + 0.85;
              if (dist > stopDist) {
                e.x += (dx / dist) * moveSpeed * dt;
                e.z += (dz / dist) * moveSpeed * dt;
              }
              if (dist <= e.radius + player.radius + 1.45 && e.cloakAttackTimer <= 0) {
                e.cloakAttackTimer = 1.15;
                e.castPauseTimer = 0.36;
                triggerModelAttack(e.model, 'Cloak_Slash');
                audio?.playMeleeSwing?.(false);
                emitSlashArc(e.x, e.z, angToPlayer, 2.45, Math.PI * 0.9, 0xe11d48);
                emitParticles(e.x + (dx / dist) * 0.85, 0.9, e.z + (dz / dist) * 0.85, 0xf43f5e, 10, 4.2, 0.13);
                applyDamageToPlayer(e.damage);
              }
            }
          }
        }
        // --- ARCHETYPE 3: RANGED CASTERS (`dark_cultist`, `archer`, `cultist` — 0.85s windup -> 1 dodgeable bolt) ---
        else if (e.ranged) {
          const pColor = e.projColor || 0xa855f7;
          const keepDist = e.keepDistance || 10.2;
          if (e.windupTimer > 0) {
            e.windupTimer -= dt;
            e.facing = Math.atan2(e.aimDirX, e.aimDirZ);
            if (Math.random() < 0.4) {
              emitParticles(e.x + e.aimDirX * 0.48, 0.92, e.z + e.aimDirZ * 0.48, pColor, 1, 1.9, 0.12);
            }
            if (e.windupTimer <= 0) {
              e.shootCooldown = 4.55 + Math.random() * 0.75;
              triggerModelAttack(e.model);
              spawnProjectile({
                x: e.x,
                z: e.z,
                vx: e.aimDirX * 10.5,
                vz: e.aimDirZ * 10.5,
                damage: e.damage,
                maxDist: 19,
                pierce: 1,
                kind: 'enemy',
                color: pColor,
                isEnemy: true
              });
            }
          } else {
            e.facing = lerpAngle(e.facing, angToPlayer, dt * 8.5);
            if (dist > keepDist) {
              e.x += (dx / dist) * moveSpeed * dt;
              e.z += (dz / dist) * moveSpeed * dt;
            }
            e.shootCooldown -= dt;
            if (e.shootCooldown <= 0 && dist <= 16.2) {
              e.windupTimer = 0.85;
              e.aimDirX = dx / dist;
              e.aimDirZ = dz / dist;
              emitParticles(e.x + e.aimDirX * 0.48, 0.92, e.z + e.aimDirZ * 0.48, pColor, 8, 3.2, 0.14);
            }
          }
        }
        // --- ARCHETYPE 4: DASHERS (`goblin`, `werewolf`, `dark_spider`, `gargoyle`, `hell_imp`, `mimic_chest`, `shadow_wisp`, `hound`) ---
        else if (e.canDash) {
          const dashMult = e.dashMult || 1.65;
          if (e.lungeTimer > 0) {
            e.lungeTimer -= dt;
            e.facing = lerpAngle(e.facing, Math.atan2(e.lungeDirX, e.lungeDirZ), dt * 14);
            e.x += e.lungeDirX * (moveSpeed * dashMult) * dt;
            e.z += e.lungeDirZ * (moveSpeed * dashMult) * dt;
          } else {
            e.facing = lerpAngle(e.facing, angToPlayer, dt * 10);
            e.x += (dx / dist) * moveSpeed * dt;
            e.z += (dz / dist) * moveSpeed * dt;
            e.specialCooldown -= dt;
            if (e.specialCooldown <= 0 && dist <= 9.0 && dist >= 1.5) {
              e.specialCooldown = 3.2;
              e.lungeTimer = 0.45;
              e.lungeDirX = dx / dist;
              e.lungeDirZ = dz / dist;
              triggerModelAttack(e.model);
              emitParticles(e.x, 0.55, e.z, e.color || 0xef4444, 6, 4.2, 0.12);
            }
          }
        }
        // --- ARCHETYPE 5: FRONTLINE WALKERS (`plague_zombie`, `ember_skeleton`, `cursed_footman`, `toxic_slime`, `phantom_ghost`) ---
        else {
          e.facing = lerpAngle(e.facing, angToPlayer, dt * 9);
          if ((e.emergeTimer || 0) <= 0) {
            e.x += (dx / dist) * moveSpeed * dt;
            e.z += (dz / dist) * moveSpeed * dt;
          }
        }
      }

      // Soft neighbor separation so hordes surround organically
      for (let j = i - 1; j >= 0 && j >= i - 10; j--) {
        const other = enemies[j];
        if (!other || other.hp <= 0) continue;
        const sdx = e.x - other.x;
        const sdz = e.z - other.z;
        const minSep = (e.radius + other.radius) * 0.88;
        const distSq = sdx * sdx + sdz * sdz;
        if (distSq > 0.0001 && distSq < minSep * minSep) {
          const d = Math.sqrt(distSq);
          const push = (minSep - d) * 0.45;
          const px = (sdx / d) * push;
          const pz = (sdz / d) * push;
          if (!e.isBoss) {
            e.x += px;
            e.z += pz;
          }
          if (!other.isBoss) {
            other.x -= px;
            other.z -= pz;
          }
        }
      }

      const resolvedEnemy = resolveObstaclesAndBounds(e.x, e.z, e.radius * 0.75, ARENA_ENTITY_LIMIT);
      e.x = resolvedEnemy.x;
      e.z = resolvedEnemy.z;

      // Contact with Player: Beast Mode Trample, Bomber Barrel Trigger, OR Enemy Melee Hit
      const pdx = e.x - player.x;
      const pdz = e.z - player.z;
      const pDist = Math.hypot(pdx, pdz);
      const touchDist = player.radius + e.radius + (beastActive ? 0.85 : 0.12);

      if (pDist <= touchDist) {
        if (beastActive) {
          if (e.trampleCooldown <= 0) {
            e.trampleCooldown = 0.24;
            const nx = pDist > 0.001 ? pdx / pDist : 0;
            const nz = pDist > 0.001 ? pdz / pDist : 1;
            const trampleDmg = Math.max(95, Math.round(stats.damage * 2.65));
            world?.addScreenShake?.(0.24, 0.12);
            applyDamageToEnemy(e, trampleDmg, nx * 14.5, nz * 14.5, false);
          }
        } else if (e.explodesOnDeath && !e.bomberTriggered) {
          // Toxic Slime / Bomber bursts acid hazard pool right at player's feet and detonates in 0.80s!
          e.bomberTriggered = true;
          spawnBomberHazard(e.x, e.z, e.hazardColor || 0x22c55e);
          floatText('🧪 КИСЛОТА!', e.x, e.z, '#4ade80');
          e.hp = 0;
          handleEnemyDeath(e);
        } else if (e.contactCooldown <= 0 && (e.disarmTimer || 0) <= 0) {
          e.contactCooldown = 0.65;
          applyDamageToPlayer(e.damage);
        }
      }

      if (e.hp > 0 && e.model?.obj) {
        e.model.obj.position.x = e.x;
        e.model.obj.position.z = e.z;
        if ((e.emergeTimer || 0) > 0) {
          e.emergeTimer = Math.max(0, e.emergeTimer - dt);
          const prog = 1 - e.emergeTimer / Math.max(0.01, e.emergeDuration || 0.85);
          const smooth = prog * prog * (3 - 2 * prog);
          e.model.obj.position.y = -1.9 * (1 - smooth);
        } else if ((e.waterLiftTimer || 0) <= 0) {
          e.model.obj.position.y = 0;
        }
        e.model.obj.rotation.y = e.facing;
        const isMoving =
          Math.hypot(e.x - prevEx, e.z - prevEz) > 0.0025 &&
          (e.emergeTimer || 0) <= 0 &&
          (e.castPauseTimer || 0) <= 0;
        animateEntityModel(e.model, dt, isMoving, slowMult, false, false, elapsedTime);
        if (e.type === 'corrupted_treant' || e.type === 'mimic_chest') {
          e.model.handle?.syncCyclePhase?.((e.emergeTimer || 0) > 0 ? 0 : (e.hopCycle || 0));
        }
      } else if (e.hp <= 0) {
        if (!e._corpseTransferred) removeSceneObject(e.model.obj, e.model.handle);
        enemies.splice(i, 1);
      }
    }

    // 8. Tactical Pickups Magnet & Collection
    updatePickups(dt, elapsedTime);
  }

  function updatePickups(dt, elapsedTime) {
    const magnetRadius = stats ? stats.pickupRadius : 3.8;

    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      p.age += dt;
      if (p.hitWobble > 0) p.hitWobble = Math.max(0, p.hitWobble - dt);

      const dx = player.x - p.x;
      const dz = player.z - p.z;
      const dist = Math.hypot(dx, dz);

      const isMagnetic = p.type === 'heart' || p.type === 'clover';

      if (isMagnetic && dist <= magnetRadius && dist > 0.01) {
        const pullSpeed = 13.5 + (magnetRadius - dist) * 3.5;
        p.x += (dx / dist) * pullSpeed * dt;
        p.z += (dz / dist) * pullSpeed * dt;
      }

      if (p.type === 'relic_weapon_crate') {
        p.model.obj.rotation.y += dt * 0.9;
        if (dist <= p.radius + player.radius + 0.35 && player.relicBumpTimer <= 0) {
          player.relicBumpTimer = 0.32;
          hitCrate(p);
          if (p.hp <= 0) {
            removeSceneObject(p.model.obj, p.model.handle);
            pickups.splice(i, 1);
            continue;
          }
        }
      } else if (p.type === 'mimic_disguise') {
        if (dist <= 2.75) {
          awakenMimicDisguise(p, i);
          continue;
        }
      } else if (p.type === 'supply_crate' || p.type === 'companion_crate') {
        if (dist <= p.radius + player.radius + 0.28) {
          if (p.type === 'supply_crate') {
            maybeDropSpearBlueprint(p.x, p.z);
            activateOverdrive(p.x, p.z);
          } else {
            activateCompanion(p.x, p.z);
          }
          removeSceneObject(p.model.obj, p.model.handle);
          pickups.splice(i, 1);
          continue;
        }
      } else if (dist <= 1.08) {
        if (p.type === 'heart') {
          audio?.playPickup?.('heart');
          const heal = p.value || 30;
          player.hp = Math.min(stats.maxHp, player.hp + heal);
          floatText(`+${heal} HP`, player.x, player.z, '#f87171');
        } else if (p.type === 'clover') {
          audio?.playPickup?.('clover');
          if (player.beastTimeLeft > 0) {
            player.beastTimeLeft = Math.min(12.0, player.beastTimeLeft + 3.0);
            floatText('+3С ЗВЕРЯ!', player.x, player.z, '#4ade80');
          } else {
            player.seals += 1;
            if (player.seals >= 5) {
              activateBeastMode();
            } else {
              floatText(`🍀 ПЕЧАТЬ ${player.seals}/5`, player.x, player.z, '#4ade80');
            }
          }
        }
        removeSceneObject(p.model.obj, p.model.handle);
        pickups.splice(i, 1);
        continue;
      }

      if (p.model?.obj) {
        p.model.obj.position.x = p.x;
        p.model.obj.position.z = p.z;
        if (typeof p.model.handle?.update === 'function') {
          p.model.handle.update(dt, elapsedTime);
        } else if (!p.type.includes('crate') && p.type !== 'mimic_disguise') {
          p.model.obj.position.y = 0.22 + Math.sin(elapsedTime * 4.2 + p.uid) * 0.09;
          p.model.obj.rotation.y += dt * 2.2;
        } else if (p.hitWobble > 0) {
          p.model.obj.rotation.z = Math.sin(elapsedTime * 48) * 0.16;
        } else {
          p.model.obj.rotation.z = 0;
        }
      }
    }
  }

  // === Rich HUD Snapshot (Shells, Reload Progress, Active Blessings & Boss Status) ===
  function getHudSnapshot() {
    const activeRelic = pickups.find((p) => p.type === 'relic_weapon_crate' && p.hp > 0);

    let activeBoss = bossEntity && bossEntity.hp > 0 ? bossEntity : null;
    let aliveFinaleCount = 0;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e && e.hp > 0 && (e.isBoss || e.isFinaleTarget)) {
        aliveFinaleCount += 1;
        if (!activeBoss) {
          activeBoss = e;
          bossEntity = e;
        }
      }
    }

    const wpnDef = WEAPONS[currentWeaponId] || WEAPONS.club;
    const maxHp = stats ? stats.maxHp : player.maxHp;
    const progState = progression.getState();
    const goldTotal = progState.gold;
    const reloadProgress =
      player.isReloading && player.reloadDuration > 0
        ? +clamp(1 - player.reloadTimer / player.reloadDuration, 0, 1).toFixed(3)
        : 0;

    return {
      hp: Math.max(0, Math.ceil(player.hp)),
      maxHp,
      damageBlock: stats ? stats.damageBlock : 0,
      dodgeChance: stats ? stats.dodgeChance : 0,
      xp: progState.heroXp ?? xp,
      xpNext: progState.heroXpNext ?? xpNext,
      xpToNext: progState.heroXpNext ?? xpNext,
      runLevel: progState.heroLevel ?? runLevel,
      weaponRunLevel,
      weaponId: wpnDef.id,
      weapon: wpnDef,
      weaponDef: wpnDef,
      ammo: player.ammo,
      maxAmmo: player.maxAmmo,
      usesMana: Boolean(stats?.usesMana && player.maxMana > 0),
      mana: +(player.mana || 0).toFixed(1),
      maxMana: player.maxMana || 0,
      manaRegen: stats?.manaRegen || 0,
      manaCost: stats?.manaCost || 0,
      mageElement: stats?.mageElement || null,
      isReloading: Boolean(player.isReloading),
      reloadProgress,
      reloadPerShellTime: stats?.reloadPerShellTime || 0,
      focusRatio: stats?.focusTime > 0 ? +clamp((player.standStillTimer || 0) / stats.focusTime, 0, 1).toFixed(2) : 1,
      activePerks: perks,
      overdriveAmmo: player.overdriveAmmo,
      overdriveMaxAmmo: player.overdriveMax,
      goldTotal,
      gold: goldTotal,
      goldRun,
      runGold: goldRun,
      kills,
      targetKills,
      finaleStarted,
      phaseText: finaleStarted
        ? '💀 УБЕЙ БОССА!'
        : currentLevelDef.hasBoss
          ? bossSpawnCountdown <= 10.5
            ? `⚠️ Босс через ${Math.max(1, Math.ceil(bossSpawnCountdown))} с!`
            : `⏳ Босс: ${Math.max(1, Math.ceil(bossSpawnCountdown))} с • ☠️ ${kills}/${targetKills}`
          : `☠️ Орда: ${Math.min(kills, targetKills)} / ${targetKills}`,
      seals: player.seals,
      beastTimeLeft: +Math.max(0, player.beastTimeLeft).toFixed(2),
      beastDuration: 10,
      hasCompanion: Boolean(companion),
      timeLeft: +Math.max(0, timeLeft).toFixed(1),
      levelNumber: currentLevelNumber,
      levelNameRu: currentLevelDef.nameRu,
      boss: activeBoss
        ? {
            nameRu: aliveFinaleCount > 1 ? `${activeBoss.nameRu} (+${aliveFinaleCount - 1})` : activeBoss.nameRu,
            hp: Math.max(0, Math.ceil(activeBoss.hp)),
            maxHp: activeBoss.maxHp,
            isMiniBoss: Boolean(activeBoss.isMiniBoss)
          }
        : null,
      relicCratePos: activeRelic ? { x: activeRelic.x, z: activeRelic.z } : null,
      playerPos: { x: player.x, z: player.z },
      autoAim,
      attackEnabled
    };
  }

  function setAutoAim(enabled) {
    autoAim = Boolean(enabled);
    return autoAim;
  }

  function getAutoAim() {
    return autoAim;
  }

  function setAttackEnabled(enabled) {
    attackEnabled = Boolean(enabled);
    return attackEnabled;
  }

  function getAttackEnabled() {
    return attackEnabled;
  }

  return {
    startRun,
    revivePlayer,
    applyLevelUpChoice,
    triggerReload,
    setAutoAim,
    getAutoAim,
    setAttackEnabled,
    getAttackEnabled,
    update,
    getHudSnapshot,
    disposeRun,
    stopRun: disposeRun
  };
}
