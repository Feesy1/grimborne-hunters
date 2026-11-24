// Dedicated Per-Weapon Upper-Body Stance & Grip Solver for Warrior_Run.glb
// Replaces legacy Sword+Shield carry overrides on 2H weapons so every weapon has
// an unmistakable, collision-free Hub / Idle / Run silhouette:
//   - Sword + Shield ('club', 'blade', 'claymore', 1H): 100% pure untouched Mixamo clips
//   - Axe / Hammer   ('axe', 'boss_hammer'): confident right-shoulder carry (clear of right horn) + free left arm outside torso
//   - Zweihander     ('zweihander'): two-handed front battle guard (NOT on shoulder), both hands visibly gripping hilt in front
//   - Spear          ('spear'): two-handed forward-couched spear guard, both hands gripping shaft outside torso
//
// All pose constants verified 1-to-1 in Blender 4.5.9 against Warrior_Run.glb + weapon GLBs
// across Hub Front, Combat Isometric, Right-Side Profile, and Running_A mid-stride views.

import * as THREE from '../../vendor/three.module.js';
import { solveMixamoArmIK } from './shared.js?v=20261124z87';

const MOUNT_PIVOT_POS = Object.freeze({ x: -0.0235, y: 0.0415, z: -0.0086 });
const MOUNT_PIVOT_ROT = Object.freeze({ x: -1.04, y: 0.24, z: -1.52 });

const _pivQ = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(MOUNT_PIVOT_ROT.x, MOUNT_PIVOT_ROT.y, MOUNT_PIVOT_ROT.z, 'XYZ')
);

function buildMountLocalQuatInv(rotY = 0) {
  const meshQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, rotY, 0, 'XYZ'));
  return _pivQ.clone().multiply(meshQ).normalize().invert();
}

const WEAPON_MOUNT_CONFIGS = Object.freeze({
  axe_tripo: Object.freeze({
    assetKey: 'axe_tripo',
    stanceId: 'axe_shoulder',
    twoHanded: true,
    scale: 0.74,
    gripY: 0.19,
    leftGripY: null,
    rotY: 0,
    centerZ: 0,
    pivotPos: MOUNT_PIVOT_POS,
    pivotRot: MOUNT_PIVOT_ROT,
    gripLX: 0,
    gripLY: 0.10,
    gripLZ: 0,
    mountLocalQInv: buildMountLocalQuatInv(0)
  }),
  hammer_tripo: Object.freeze({
    assetKey: 'hammer_tripo',
    stanceId: 'hammer_shoulder',
    twoHanded: true,
    scale: 0.78,
    gripY: 0.23,
    leftGripY: null,
    rotY: 0,
    centerZ: 0,
    pivotPos: MOUNT_PIVOT_POS,
    pivotRot: MOUNT_PIVOT_ROT,
    gripLX: 0,
    gripLY: 0.12,
    gripLZ: 0,
    mountLocalQInv: buildMountLocalQuatInv(0)
  }),
  zweihander_tripo: Object.freeze({
    assetKey: 'zweihander_tripo',
    stanceId: 'zweihander_2h',
    twoHanded: true,
    scale: 0.92,
    gripY: 0.175,
    leftGripY: 0.065,
    rotY: Math.PI * 0.5,
    centerZ: 0,
    pivotPos: MOUNT_PIVOT_POS,
    pivotRot: MOUNT_PIVOT_ROT,
    // Exact local position in mountPivot of weapon-local point (0, leftGripY, 0):
    // under wMesh.rotation(PI, rotY, 0), +Y_weapon maps to -Y_pivot -> y = (gripY - leftGripY) * scale
    gripLX: 0,
    gripLY: (0.175 - 0.065) * 0.92,
    gripLZ: 0,
    mountLocalQInv: buildMountLocalQuatInv(Math.PI * 0.5)
  }),
  spear_tripo: Object.freeze({
    assetKey: 'spear_tripo',
    stanceId: 'spear_forward',
    twoHanded: true,
    scale: 1.12,
    gripY: 0.17,
    leftGripY: 0.40,
    rotY: 0,
    centerZ: 0.021,
    pivotPos: MOUNT_PIVOT_POS,
    pivotRot: MOUNT_PIVOT_ROT,
    gripLX: 0,
    gripLY: (0.17 - 0.40) * 1.12,
    gripLZ: 0.021 * 1.12,
    mountLocalQInv: buildMountLocalQuatInv(0)
  })
});

// Model-space stance definitions (unit modelInstance space, anchored to Spine2 live position).
// All coordinates verified via exact 3D clearance checks & multi-angle Blender renders.
const STANCE_DEFS = Object.freeze({
  axe_shoulder: Object.freeze({
    torsoYaw: -0.10,
    torsoPitch: 0.04,
    runPitchBoost: 0.04,
    clavR: [0.16, -0.04],
    clavL: [-0.04, -0.05],
    handR: [-0.170, -0.020, 0.132],
    poleR: [-0.38, -0.16, -0.02],
    shaftDir: new THREE.Vector3(-0.52, 0.44, -0.73).normalize(),
    bladeXHint: new THREE.Vector3(-0.92, 0.25, 0.30).normalize(),
    leftMode: 'free',
    handL: [0.285, -0.115, 0.088],
    poleL: [0.48, -0.03, -0.10],
    leftRunSwingZ: 0.055,
    leftRunSwingY: 0.014,
    weaponRunBobY: 0.008
  }),
  hammer_shoulder: Object.freeze({
    torsoYaw: -0.10,
    torsoPitch: 0.04,
    runPitchBoost: 0.04,
    clavR: [0.16, -0.04],
    clavL: [-0.04, -0.05],
    handR: [-0.168, -0.020, 0.132],
    poleR: [-0.38, -0.16, -0.02],
    shaftDir: new THREE.Vector3(-0.49, 0.46, -0.74).normalize(),
    bladeXHint: new THREE.Vector3(-0.82, 0.45, 0.35).normalize(),
    leftMode: 'free',
    handL: [0.285, -0.115, 0.088],
    poleL: [0.48, -0.03, -0.10],
    leftRunSwingZ: 0.055,
    leftRunSwingY: 0.014,
    weaponRunBobY: 0.008
  }),
  zweihander_2h: Object.freeze({
    torsoYaw: -0.04,
    torsoPitch: 0.06,
    runPitchBoost: 0.05,
    clavR: [0.45, 0.04],
    clavL: [-0.45, -0.04],
    // Both hands visibly gripping long leather hilt in front of chest/belt, crossguard clear of eyes & face
    handR: [-0.080, -0.150, 0.215],
    poleR: [-0.35, -0.17, 0.04],
    shaftDir: new THREE.Vector3(-0.68, 0.56, 0.47).normalize(),
    bladeXHint: new THREE.Vector3(0.32, -0.26, 0.91).normalize(),
    leftMode: 'grip',
    poleL: [0.35, -0.16, 0.05],
    weaponRunSwayX: 0.010,
    weaponRunBobY: 0.007
  }),
  spear_forward: Object.freeze({
    torsoYaw: -0.22,
    torsoPitch: 0.04,
    runPitchBoost: 0.05,
    clavR: [0.16, 0.04],
    clavL: [-0.38, -0.02],
    // Rear hand outside right hip, forward hand outside chest along spear shaft aimed boldly forward (+Z)
    handR: [-0.145, -0.125, 0.035],
    poleR: [-0.38, -0.11, -0.14],
    shaftDir: new THREE.Vector3(0.32, 0.10, 0.94).normalize(),
    bladeXHint: new THREE.Vector3(0.88, 0.30, -0.36).normalize(),
    leftMode: 'grip',
    poleL: [0.36, -0.15, 0.08],
    weaponRunSwayX: 0.008,
    weaponRunBobY: 0.007
  })
});

export function resolveWarriorStanceId(weaponId) {
  const id = String(weaponId || 'club');
  if (id === 'axe' || id === 'flail') return 'axe_shoulder';
  if (id === 'boss_hammer' || id === 'hammer') return 'hammer_shoulder';
  if (id === 'zweihander') return 'zweihander_2h';
  if (id === 'spear' || id === 'cleaver') return 'spear_forward';
  return 'sword_shield';
}

export function getWarriorWeaponMountConfig(weaponId) {
  const id = String(weaponId || 'club');
  if (id === 'spear' || id === 'cleaver') return WEAPON_MOUNT_CONFIGS.spear_tripo;
  if (id === 'zweihander') return WEAPON_MOUNT_CONFIGS.zweihander_tripo;
  if (id === 'axe' || id === 'flail') return WEAPON_MOUNT_CONFIGS.axe_tripo;
  if (id === 'boss_hammer' || id === 'hammer') return WEAPON_MOUNT_CONFIGS.hammer_tripo;
  return null;
}

export function createWarriorStanceState() {
  return {
    blend: 1,
    lastStanceId: null
  };
}

// Module-level zero-allocation scratch objects
const _mWorldMatInv = new THREE.Matrix4();
const _mWorldQ = new THREE.Quaternion();
const _mWorldQInv = new THREE.Quaternion();
const _parentWorldQInv = new THREE.Quaternion();
const _qBoneModel = new THREE.Quaternion();
const _qTargetModel = new THREE.Quaternion();
const _qTargetWorld = new THREE.Quaternion();
const _qTargetLocal = new THREE.Quaternion();
const _qPrevLocal = new THREE.Quaternion();
const _qRotAxis = new THREE.Quaternion();
const _qYaw = new THREE.Quaternion();
const _qRoll = new THREE.Quaternion();
const _qWeaponModel = new THREE.Quaternion();
const _qHandRModel = new THREE.Quaternion();
const _qHandLModel = new THREE.Quaternion();
const _basisMat = new THREE.Matrix4();
const _vFwd = new THREE.Vector3();
const _vAnchorM = new THREE.Vector3();
const _vTargetRM = new THREE.Vector3();
const _vPoleRM = new THREE.Vector3();
const _vTargetRW = new THREE.Vector3();
const _vPoleRW = new THREE.Vector3();
const _vTargetLM = new THREE.Vector3();
const _vPoleLM = new THREE.Vector3();
const _vTargetLW = new THREE.Vector3();
const _vPoleLW = new THREE.Vector3();
const _vElbLM = new THREE.Vector3();
const _vHandLM = new THREE.Vector3();
const _vForeDir = new THREE.Vector3();
const _vWX = new THREE.Vector3();
const _vWY = new THREE.Vector3();
const _vWZ = new THREE.Vector3();
const _vBX = new THREE.Vector3();
const _vBY = new THREE.Vector3();
const _vBZ = new THREE.Vector3();
const _vGripM = new THREE.Vector3();
const _vGripW = new THREE.Vector3();
const _vPoleSafeW = new THREE.Vector3();
const _atkEuler = new THREE.Euler(0, 0, 0, 'XYZ');
const _atkQuat = new THREE.Quaternion();

const _UNIT_X = new THREE.Vector3(1, 0, 0);
const _UNIT_Y = new THREE.Vector3(0, 1, 0);
const _UNIT_Z = new THREE.Vector3(0, 0, 1);

const _skeletonRigCache = new WeakMap();

function normalizeAngle(rad) {
  let a = rad;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function makeBasisQuatYZ(yDir, zHint, outQ) {
  _vBY.copy(yDir).normalize();
  _vBZ.copy(zHint).addScaledVector(_vBY, -zHint.dot(_vBY));
  if (_vBZ.lengthSq() < 1e-6) {
    _vBZ.set(0, 0, 1);
    if (Math.abs(_vBY.z) > 0.9) _vBZ.set(1, 0, 0);
    _vBZ.addScaledVector(_vBY, -_vBZ.dot(_vBY));
  }
  _vBZ.normalize();
  _vBX.crossVectors(_vBY, _vBZ).normalize();
  _vBZ.crossVectors(_vBX, _vBY).normalize();
  _basisMat.makeBasis(_vBX, _vBY, _vBZ);
  return outQ.setFromRotationMatrix(_basisMat);
}

function getBoneModelPos(node, outV) {
  return node.getWorldPosition(outV).applyMatrix4(_mWorldMatInv);
}

function getBoneModelQuat(node, outQ) {
  return node.getWorldQuaternion(outQ).premultiply(_mWorldQInv);
}

function setBoneModelQuat(node, targetModelQ, blend) {
  if (!node || !node.parent) return;
  _qPrevLocal.copy(node.quaternion);
  _qTargetWorld.copy(_mWorldQ).multiply(targetModelQ);
  node.parent.getWorldQuaternion(_parentWorldQInv).invert();
  _qTargetLocal.copy(_parentWorldQInv).multiply(_qTargetWorld).normalize();
  if (blend < 0.999) {
    _qPrevLocal.slerp(_qTargetLocal, blend);
    node.quaternion.copy(_qPrevLocal);
  } else {
    node.quaternion.copy(_qTargetLocal);
  }
  node.updateWorldMatrix(true, false);
}

function rotateBoneModelAxis(node, axisModel, angleRad, blend) {
  if (!node || Math.abs(angleRad) < 1e-5) return;
  getBoneModelQuat(node, _qBoneModel);
  _qRotAxis.setFromAxisAngle(axisModel, angleRad);
  _qTargetModel.copy(_qRotAxis).multiply(_qBoneModel).normalize();
  setBoneModelQuat(node, _qTargetModel, blend);
}

function setClavicleModelRot(entry, yawY, rollZ, blend) {
  if (!entry || !entry.node || !entry.node.parent) return;
  const node = entry.node;
  _qPrevLocal.copy(node.quaternion);
  node.quaternion.copy(entry.restQ);
  node.updateWorldMatrix(true, false);

  getBoneModelQuat(node, _qBoneModel);
  _qYaw.setFromAxisAngle(_UNIT_Y, yawY);
  _qRoll.setFromAxisAngle(_UNIT_Z, rollZ);
  _qTargetModel.copy(_qYaw).multiply(_qRoll).multiply(_qBoneModel).normalize();

  _qTargetWorld.copy(_mWorldQ).multiply(_qTargetModel);
  node.parent.getWorldQuaternion(_parentWorldQInv).invert();
  _qTargetLocal.copy(_parentWorldQInv).multiply(_qTargetWorld).normalize();

  if (blend < 0.999) {
    _qPrevLocal.slerp(_qTargetLocal, blend);
    node.quaternion.copy(_qPrevLocal);
  } else {
    node.quaternion.copy(_qTargetLocal);
  }
  node.updateWorldMatrix(true, false);
}

function resolveRigContext(skeletonOrRig) {
  if (!skeletonOrRig) return null;
  if (skeletonOrRig.mx && skeletonOrRig.modelInstance) {
    return skeletonOrRig;
  }
  // Support direct THREE.Skeleton input as specified in public API
  if (Array.isArray(skeletonOrRig.bones)) {
    let cached = _skeletonRigCache.get(skeletonOrRig);
    if (!cached) {
      const mx = Object.create(null);
      let modelInstance = null;
      for (const bone of skeletonOrRig.bones) {
        if (!bone) continue;
        const m = (bone.name || '').match(/^mixamorig:?(.+)$/);
        if (m) {
          mx[m[1]] = {
            node: bone,
            restQ: bone.quaternion.clone(),
            restPos: bone.position.clone()
          };
        }
        if (!modelInstance) {
          let cur = bone;
          while (cur.parent && !/^Armature$/i.test(cur.name || '')) {
            cur = cur.parent;
          }
          modelInstance = cur.parent || cur;
        }
      }
      cached = {
        mx,
        modelInstance,
        mountedWeaponObj: null,
        leftGripSocket: null,
        state: createWarriorStanceState()
      };
      _skeletonRigCache.set(skeletonOrRig, cached);
    }
    return cached;
  }
  return null;
}

/**
 * Applies smooth per-weapon upper-body combat/Hub stances on top of Warrior_Run.glb
 * after AnimationMixer.update(dt).
 *
 * - 1H Sword + Shield ('club', 'blade', 'claymore', etc.): no-op (0% override).
 * - Axe / Hammer: confident right-shoulder carry (clear of horned helmet) + free left arm outside torso.
 * - Zweihander: two-handed front battle guard (NOT on shoulder), both hands visibly gripping hilt outside body.
 * - Spear: two-handed forward-couched guard, both hands visibly holding shaft outside body.
 * - Smoothly blends to 0 during active attacks, shield block, or death, and holds 100% in Hub, Idle & Run.
 *
 * @param {object|THREE.Skeleton} skeletonOrRig Rig context { mx, modelInstance, mountedWeaponObj, leftGripSocket, state } or THREE.Skeleton
 * @param {string} weaponId Equipped weapon ID
 * @param {number} dt Frame delta seconds
 * @param {object} [opts] { isAttacking, isBlocking, isHub, moveSpeed, isMoving, elapsedTime, isDead }
 * @returns {number} Active smoothed stance blend weight (0..1)
 */
export function applyWarriorWeaponStance(skeletonOrRig, weaponId, dt = 0.016, opts = {}) {
  const rig = resolveRigContext(skeletonOrRig);
  if (!rig || !rig.mx || !rig.modelInstance) return 0;

  const stanceId = resolveWarriorStanceId(weaponId);
  const state = rig.state || (rig.state = createWarriorStanceState());

  if (stanceId === 'sword_shield') {
    state.blend = 0;
    state.lastStanceId = stanceId;
    return 0;
  }

  const st = STANCE_DEFS[stanceId];
  const mountCfg = getWarriorWeaponMountConfig(weaponId);
  if (!st || !mountCfg) return 0;

  const mx = rig.mx;
  const modelInstance = rig.modelInstance;
  if (!mx.Spine2?.node || !mx.RightArm?.node || !mx.RightForeArm?.node || !mx.RightHand?.node) {
    return 0;
  }

  const safeDt = Math.min(Math.max(dt || 0.016, 0), 0.1);
  const isDead = Boolean(opts.isDead);
  const isAttacking = Boolean(opts.isAttacking);
  const isBlocking = Boolean(opts.isBlocking);
  const moveSpeed = Number(opts.moveSpeed) || 0;
  const isMoving = opts.isMoving !== undefined ? Boolean(opts.isMoving) : moveSpeed > 0.05;
  const isHub = Boolean(opts.isHub);
  const elapsedTime = Number(opts.elapsedTime) || 0;

  const targetBlend = isDead || isAttacking || isBlocking ? 0 : 1;

  // Snap cleanly on initial equip / weapon switch when not mid-attack so Hub never flashes 1 frame of Sword Idle
  if (state.lastStanceId !== stanceId) {
    state.lastStanceId = stanceId;
    state.blend = targetBlend;
  } else {
    const rate = isDead ? 24.0 : isAttacking ? 18.0 : isBlocking ? 14.0 : 7.5;
    state.blend += (targetBlend - state.blend) * Math.min(1, safeDt * rate);
    if (state.blend < 0.002 && targetBlend === 0) state.blend = 0;
    if (state.blend > 0.998 && targetBlend === 1) state.blend = 1;
  }

  const blend = state.blend;
  if (blend <= 0.002) {
    return 0;
  }

  // Refresh ancestors (root rotation/pos/scale) + descendants so modelInstance local <-> world transforms are exact
  modelInstance.updateWorldMatrix(true, true);
  _mWorldMatInv.copy(modelInstance.matrixWorld).invert();
  modelInstance.getWorldQuaternion(_mWorldQ);
  _mWorldQInv.copy(_mWorldQ).invert();

  // Subtle organic breathing (Hub/Idle) & athletic stride sway (Run)
  const moveFactor = isHub ? 0 : isMoving ? Math.min(1.25, Math.max(0.55, moveSpeed || 1)) : 0;
  const breath = Math.sin(elapsedTime * 2.15) * (1 - Math.min(1, moveFactor));
  const runCycle = Math.sin(elapsedTime * 9.5) * Math.min(1, moveFactor);
  const runBounce = Math.abs(Math.sin(elapsedTime * 9.5)) * Math.min(1, moveFactor);

  // 1. Align upper torso (Spine1 + Spine2) smoothly to weapon's heroic stance yaw & pitch
  getBoneModelQuat(mx.Spine2.node, _qBoneModel);
  _vFwd.copy(_UNIT_X).applyQuaternion(_qBoneModel);
  const curTorsoYaw = Math.atan2(_vFwd.x, _vFwd.z);
  const yawDelta = normalizeAngle(st.torsoYaw - curTorsoYaw);
  if (mx.Spine1?.node) {
    rotateBoneModelAxis(mx.Spine1.node, _UNIT_Y, yawDelta * 0.40, blend);
  }
  rotateBoneModelAxis(mx.Spine2.node, _UNIT_Y, yawDelta * 0.60, blend);

  const pitchTotal = st.torsoPitch + (st.runPitchBoost || 0) * Math.min(1, moveFactor) + breath * 0.012;
  getBoneModelQuat(mx.Spine2.node, _qBoneModel);
  _vFwd.copy(_UNIT_Y).applyQuaternion(_qBoneModel);
  const curTorsoPitch = Math.atan2(_vFwd.z, _vFwd.y);
  const pitchDelta = normalizeAngle(pitchTotal - curTorsoPitch);
  if (Math.abs(pitchDelta) > 1e-4) {
    rotateBoneModelAxis(mx.Spine2.node, _UNIT_X, pitchDelta, blend);
  }

  // Counter-rotate Neck + Head so the horned skull & blazing eyes gaze squarely forward (+Z)
  if (mx.Head?.node) {
    getBoneModelQuat(mx.Head.node, _qBoneModel);
    _vFwd.copy(_UNIT_X).applyQuaternion(_qBoneModel);
    const curHeadYaw = Math.atan2(_vFwd.x, _vFwd.z);
    const headYawFix = normalizeAngle(-curHeadYaw) * 0.95;
    if (mx.Neck?.node) {
      rotateBoneModelAxis(mx.Neck.node, _UNIT_Y, headYawFix * 0.45, blend);
    }
    rotateBoneModelAxis(mx.Head.node, _UNIT_Y, headYawFix * 0.55, blend);
  }

  // 2. Clavicle protraction / relaxation (world-Y forward reach + world-Z shoulder settle)
  if (mx.RightShoulder) {
    setClavicleModelRot(mx.RightShoulder, st.clavR[0], st.clavR[1], blend);
  }
  if (mx.LeftShoulder) {
    setClavicleModelRot(mx.LeftShoulder, st.clavL[0], st.clavL[1], blend);
  }

  // 3. Anchor all hand/elbow targets to Spine2 live position (inherits natural Idle breath & Run vertical bounce)
  getBoneModelPos(mx.Spine2.node, _vAnchorM);

  const bobY = breath * 0.0045 + runBounce * (st.weaponRunBobY || 0.006);
  const swayX = runCycle * (st.weaponRunSwayX || 0);

  _vTargetRM.set(
    _vAnchorM.x + st.handR[0] + swayX,
    _vAnchorM.y + st.handR[1] + bobY,
    _vAnchorM.z + st.handR[2]
  );
  _vPoleRM.set(
    _vAnchorM.x + st.poleR[0],
    _vAnchorM.y + st.poleR[1],
    _vAnchorM.z + st.poleR[2]
  );

  _vTargetRW.copy(_vTargetRM).applyMatrix4(modelInstance.matrixWorld);
  _vPoleRW.copy(_vPoleRM).applyMatrix4(modelInstance.matrixWorld);

  // Solve Right Arm 2-Bone IK
  solveMixamoArmIK(mx.RightArm, mx.RightForeArm, mx.RightHand, _vTargetRW, _vPoleRW, blend);

  // 4. Orient RightHand so mounted weapon aligns EXACTLY with shaftDir + bladeXHint
  _vWY.copy(st.shaftDir);
  if (Math.abs(breath) > 1e-4 || Math.abs(runCycle) > 1e-4) {
    _vWY.y += breath * 0.015 + runBounce * 0.018;
    _vWY.x += runCycle * 0.016;
    _vWY.normalize();
  }
  _vWX.copy(st.bladeXHint).addScaledVector(_vWY, -st.bladeXHint.dot(_vWY)).normalize();
  _vWZ.crossVectors(_vWX, _vWY).normalize();
  _vWX.crossVectors(_vWY, _vWZ).normalize();
  _basisMat.makeBasis(_vWX, _vWY, _vWZ);
  _qWeaponModel.setFromRotationMatrix(_basisMat);

  _qHandRModel.copy(_qWeaponModel).multiply(mountCfg.mountLocalQInv).normalize();
  setBoneModelQuat(mx.RightHand.node, _qHandRModel, blend);

  // 5. Solve Left Arm (either FREE visible balance stance for Axe/Hammer, or exact 2H grip IK for Zweihander/Spear)
  if (mx.LeftArm?.node && mx.LeftForeArm?.node && mx.LeftHand?.node) {
    _vPoleLM.set(
      _vAnchorM.x + st.poleL[0],
      _vAnchorM.y + st.poleL[1],
      _vAnchorM.z + st.poleL[2]
    );
    _vPoleLW.copy(_vPoleLM).applyMatrix4(modelInstance.matrixWorld);

    if (st.leftMode === 'free') {
      // Axe / Hammer: Left arm clearly OUTSIDE the left flank, pumping naturally when running!
      const swingZ = runCycle * (st.leftRunSwingZ || 0.05);
      const swingY = Math.abs(runCycle) * (st.leftRunSwingY || 0.012) + breath * 0.006;
      _vTargetLM.set(
        _vAnchorM.x + st.handL[0],
        _vAnchorM.y + st.handL[1] + swingY,
        _vAnchorM.z + st.handL[2] + swingZ
      );
      _vTargetLW.copy(_vTargetLM).applyMatrix4(modelInstance.matrixWorld);
      solveMixamoArmIK(mx.LeftArm, mx.LeftForeArm, mx.LeftHand, _vTargetLW, _vPoleLW, blend);

      // Keep LeftHand wrist naturally aligned straight with LeftForeArm (clenched battle fist!)
      getBoneModelPos(mx.LeftForeArm.node, _vElbLM);
      getBoneModelPos(mx.LeftHand.node, _vHandLM);
      _vForeDir.subVectors(_vHandLM, _vElbLM);
      if (_vForeDir.lengthSq() > 1e-6) {
        makeBasisQuatYZ(_vForeDir, _UNIT_Y, _qHandLModel);
        setBoneModelQuat(mx.LeftHand.node, _qHandLModel, blend);
      }
    } else if (st.leftMode === 'grip') {
      // Zweihander / Spear: Lock LeftHand directly onto the mounted weapon's left grip socket outside torso!
      let hasGripW = false;
      if (rig.leftGripSocket) {
        rig.leftGripSocket.updateWorldMatrix(true, false);
        rig.leftGripSocket.getWorldPosition(_vTargetLW);
        hasGripW = true;
      } else if (mountCfg.leftGripY !== null) {
        // Fallback when called with raw THREE.Skeleton without leftGripSocket
        getBoneModelPos(mx.RightHand.node, _vTargetLM);
        const deltaAlongShaft = (mountCfg.leftGripY - mountCfg.gripY) * mountCfg.scale;
        _vTargetLM.addScaledVector(_vWY, deltaAlongShaft);
        _vTargetLW.copy(_vTargetLM).applyMatrix4(modelInstance.matrixWorld);
        hasGripW = true;
      }

      if (hasGripW) {
        solveMixamoArmIK(mx.LeftArm, mx.LeftForeArm, mx.LeftHand, _vTargetLW, _vPoleLW, blend);
        getBoneModelPos(mx.LeftForeArm.node, _vElbLM);
        getBoneModelPos(mx.LeftHand.node, _vHandLM);
        _vForeDir.subVectors(_vHandLM, _vElbLM);
        if (_vForeDir.lengthSq() > 1e-6) {
          makeBasisQuatYZ(_vForeDir, _vWY, _qHandLModel);
          setBoneModelQuat(mx.LeftHand.node, _qHandLModel, blend);
        }
      }
    }
  }

  return blend;
}

/**
 * Applies crisp weapon-specific combat swing overlays during active 2H melee attacks
 * (Spear straight piercing thrust, Heavy 2H Cleave emphasis) while mathematically preventing
 * the left arm from ever pulling through the torso during windup/follow-through.
 */
export function applyWarriorAttackOverlay(rig, weaponId, attackProgress01, stanceBlend = 0) {
  if (!rig || !rig.mx || !rig.modelInstance) return 0;
  const stanceId = resolveWarriorStanceId(weaponId);
  if (stanceId === 'sword_shield') return 0;

  const u = Math.max(0, Math.min(1, attackProgress01));
  const atkWeight = Math.max(0, Math.min(1, 1 - stanceBlend * 0.85));
  if (atkWeight <= 0.01) return 0;

  const mx = rig.mx;
  const modelInstance = rig.modelInstance;
  const mountedWeaponObj = rig.mountedWeaponObj;
  const wChest = mx.Spine2?.node || mx.Spine1?.node;
  const wUpperR = mx.RightArm?.node;
  const wLowerR = mx.RightForeArm?.node;
  let lungeZ = 0;

  if (stanceId === 'spear_forward') {
    // Directed Forward Spear Thrust: crisp pullback -> straight piercing lunge -> recovery
    const wind = u < 0.22 ? Math.sin((u / 0.22) * Math.PI * 0.5) : Math.max(0, 1 - (u - 0.22) / 0.14);
    const thrust =
      u < 0.20
        ? 0
        : u < 0.54
          ? Math.sin(((u - 0.20) / 0.34) * Math.PI * 0.5)
          : Math.max(0, 1 - (u - 0.54) / 0.46);
    lungeZ = (thrust * 0.26 - wind * 0.08) * atkWeight;
    if (wChest) {
      _atkEuler.set((thrust * 0.20 - wind * 0.08) * atkWeight, (-thrust * 0.30 + wind * 0.16) * atkWeight, 0);
      _atkQuat.setFromEuler(_atkEuler);
      wChest.quaternion.multiply(_atkQuat);
    }
    if (wUpperR) {
      _atkEuler.set(
        (-thrust * 0.62 + wind * 0.24) * atkWeight,
        (-thrust * 0.38 + wind * 0.18) * atkWeight,
        0.42 * thrust * atkWeight
      );
      _atkQuat.setFromEuler(_atkEuler);
      wUpperR.quaternion.multiply(_atkQuat);
    }
    if (wLowerR) {
      _atkEuler.set(
        0.10 * wind * atkWeight,
        -0.28 * thrust * atkWeight,
        (-0.38 * thrust + 0.24 * wind) * atkWeight
      );
      _atkQuat.setFromEuler(_atkEuler);
      wLowerR.quaternion.multiply(_atkQuat);
    }
    if (mountedWeaponObj?.userData?.basePos) {
      mountedWeaponObj.translateY(-(thrust * 0.20 - wind * 0.09) * atkWeight);
      _atkEuler.set(0.18 * thrust * atkWeight, 0, -0.14 * thrust * atkWeight);
      _atkQuat.setFromEuler(_atkEuler);
      mountedWeaponObj.quaternion.multiply(_atkQuat);
    }
  } else {
    // Heavy Two-Handed Cleave emphasis for Zweihander / Axe / Hammer
    const isHammer = stanceId === 'hammer_shoulder';
    const isAxe = stanceId === 'axe_shoulder';
    const isZwei = stanceId === 'zweihander_2h';
    const wind = u < 0.28 ? Math.sin((u / 0.28) * Math.PI * 0.5) : 0;
    const swing =
      u < 0.28
        ? 0
        : u < 0.74
          ? Math.sin(((u - 0.28) / 0.46) * Math.PI * 0.5)
          : 1;
    const release = u > 0.74 ? Math.max(0, 1 - (u - 0.74) / 0.26) : 1;
    const heaviness = isHammer ? 1.16 : isAxe ? 1.10 : 1.04;
    const yawTwist = (0.36 * wind - 0.48 * swing) * release * atkWeight;
    const pitchSwing = (-0.48 * wind + (isZwei ? 0.58 : 0.84) * swing) * heaviness * release * atkWeight;
    const rollArc = (0.28 * wind - (isAxe ? 0.62 : 0.48) * swing) * release * atkWeight;
    if (wChest) {
      _atkEuler.set((0.20 * swing - 0.12 * wind) * release * atkWeight, yawTwist * 0.75, rollArc * 0.24);
      _atkQuat.setFromEuler(_atkEuler);
      wChest.quaternion.multiply(_atkQuat);
    }
    if (wUpperR) {
      _atkEuler.set(pitchSwing, yawTwist * 0.45, rollArc);
      _atkQuat.setFromEuler(_atkEuler);
      wUpperR.quaternion.multiply(_atkQuat);
    }
    if (wLowerR) {
      _atkEuler.set(
        0.18 * swing * release * atkWeight,
        -0.12 * swing * release * atkWeight,
        (-0.22 * wind + 0.20 * swing) * release * atkWeight
      );
      _atkQuat.setFromEuler(_atkEuler);
      wLowerR.quaternion.multiply(_atkQuat);
    }
    if (mountedWeaponObj?.userData?.baseQuat) {
      _atkEuler.set((-0.18 * wind + 0.15 * swing) * release * atkWeight, 0, rollArc * 0.20);
      _atkQuat.setFromEuler(_atkEuler);
      mountedWeaponObj.quaternion.multiply(_atkQuat);
    }
  }

  // Torso-safe 2H left-hand tracking ONLY for Zweihander & Spear, and ONLY when the grip target
  // lies safely in front of the chest (zInModel > +0.08) so LeftArm can NEVER clip through the torso!
  if (
    (stanceId === 'zweihander_2h' || stanceId === 'spear_forward') &&
    rig.leftGripSocket &&
    mx.LeftArm?.node &&
    mx.LeftForeArm?.node &&
    mx.LeftHand?.node &&
    mx.Spine2?.node
  ) {
    modelInstance.updateWorldMatrix(true, true);
    _mWorldMatInv.copy(modelInstance.matrixWorld).invert();
    rig.leftGripSocket.getWorldPosition(_vGripW);
    _vGripM.copy(_vGripW).applyMatrix4(_mWorldMatInv);
    getBoneModelPos(mx.Spine2.node, _vAnchorM);

    const relZ = _vGripM.z - _vAnchorM.z;
    const relX = _vGripM.x - _vAnchorM.x;
    // Smooth safety gate: 0 when grip is behind torso or far right, ramps to 1 when safely in front
    const frontSafe = Math.max(0, Math.min(1, (relZ - 0.08) / 0.10));
    const sideSafe = Math.max(0, Math.min(1, (relX + 0.16) / 0.12));
    const safeBlend = frontSafe * sideSafe * 0.78 * atkWeight;
    if (safeBlend > 0.04) {
      _vPoleLM.set(_vAnchorM.x + 0.38, _vAnchorM.y - 0.12, _vAnchorM.z + 0.06);
      _vPoleSafeW.copy(_vPoleLM).applyMatrix4(modelInstance.matrixWorld);
      solveMixamoArmIK(mx.LeftArm, mx.LeftForeArm, mx.LeftHand, _vGripW, _vPoleSafeW, safeBlend);
    }
  }

  return lungeZ;
}
