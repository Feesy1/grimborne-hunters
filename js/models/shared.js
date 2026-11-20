// Shared Geometry/Material Caches, Animation Controller & Mixamo 2-Bone Arm IK
// Extracted from js/models.js (Wave 2 modularization) — zero circular deps.

import * as THREE from '../../vendor/three.module.js';

const sharedGeo = new Map();
export function getGeo(key, fn) {
  if (!sharedGeo.has(key)) sharedGeo.set(key, fn());
  return sharedGeo.get(key);
}

const sharedMat = new Map();
export function getMat(key, fn) {
  if (!sharedMat.has(key)) sharedMat.set(key, fn());
  return sharedMat.get(key);
}

export function isMobileRuntimeDevice() {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPhone|iPod|iPad|Android/i.test(navigator.userAgent || '') ||
    ((navigator.maxTouchPoints || 0) > 0 && Math.min(window.innerWidth || 1280, window.innerHeight || 720) <= 720)
  );
}

export function disposeOwnedWeaponMaterials(obj) {
  if (!obj) return;
  obj.traverse((n) => {
    if (Array.isArray(n.userData?.ownedMaterials)) {
      for (const m of n.userData.ownedMaterials) {
        if (m?.dispose) m.dispose();
      }
      n.userData.ownedMaterials.length = 0;
    }
    if (n.isSkinnedMesh && n.skeleton) {
      n.skeleton.dispose();
    }
  });
}

export function createAnimController(modelRoot, clipMap, idleClipName = 'Idle', moveClipName = 'Running_A') {
  const mixer = new THREE.AnimationMixer(modelRoot);
  const actions = new Map();

  function getAction(name) {
    if (!name || !clipMap) return null;
    if (actions.has(name)) return actions.get(name);
    const clip = clipMap.get(name);
    if (!clip) return null;
    const act = mixer.clipAction(clip);
    actions.set(name, act);
    return act;
  }

  let currentBase = null;
  let currentBaseName = null;
  let prevBase = null;
  let prevBaseName = null;
  let baseFadeTimer = 0;
  const BASE_FADE_DUR = 0.18;

  let activeLowerBase = null;
  let prevLowerBase = null;

  let activeAttackAction = null;
  let attackUsesMask = false;
  let lastAttackWeight = 0;
  let prevAttackAction = null;
  let prevAttackStartWeight = 0;
  let prevAttackFadeTimer = 0;
  const PREV_ATTACK_FADE_DUR = 0.07;

  let activeHitAction = null;
  let activeDeathAction = null;

  function findLowerAction(baseName) {
    if (!baseName) return null;
    return getAction(`${baseName}__Lower`);
  }

  function ensureRunningLoop(act, syncSource = null) {
    if (!act) return;
    act.stopFading();
    act.enabled = true;
    act.paused = false;
    if (syncSource) {
      act.time = syncSource.time;
      act.timeScale = syncSource.timeScale;
    }
    if (!act.isRunning()) act.play();
  }

  function stopActionClean(act) {
    if (!act) return;
    act.stopFading();
    act.setEffectiveWeight(0);
    act.stop();
  }

  function clearAttackMaskState() {
    stopActionClean(prevAttackAction);
    prevAttackAction = null;
    prevAttackFadeTimer = 0;
    prevAttackStartWeight = 0;
    stopActionClean(activeLowerBase);
    activeLowerBase = null;
    stopActionClean(prevLowerBase);
    prevLowerBase = null;
    attackUsesMask = false;
    lastAttackWeight = 0;
  }

  // Deterministic weight solver:
  // Guarantees sum of weights === 1.000 on BOTH lower-body and upper-body bones on EVERY frame
  // (mathematically eliminates T-pose flashes and Three.js fadeOut jump-to-1.0 snaps!).
  function syncLayerWeights(dt = 0) {
    if (activeDeathAction) return;

    if (baseFadeTimer > 0 && dt > 0) {
      baseFadeTimer = Math.max(0, baseFadeTimer - dt);
      if (baseFadeTimer <= 0 && prevBase) {
        stopActionClean(prevBase);
        prevBase = null;
        prevBaseName = null;
        stopActionClean(prevLowerBase);
        prevLowerBase = null;
      }
    }

    const wPrevBase = prevBase && baseFadeTimer > 0 ? Math.min(1, baseFadeTimer / BASE_FADE_DUR) : 0;
    const wCurBase = 1.0 - wPrevBase;

    if (!attackUsesMask || !activeAttackAction) {
      if (currentBase) {
        ensureRunningLoop(currentBase);
        currentBase.setEffectiveWeight(wCurBase);
      }
      if (prevBase) {
        ensureRunningLoop(prevBase);
        prevBase.setEffectiveWeight(wPrevBase);
      }
      if (activeLowerBase) {
        stopActionClean(activeLowerBase);
        activeLowerBase = null;
      }
      if (prevLowerBase) {
        stopActionClean(prevLowerBase);
        prevLowerBase = null;
      }
      return;
    }

    const clip = activeAttackAction.getClip();
    const spd = Math.max(0.1, Math.abs(activeAttackAction.timeScale || 1));
    const dur = clip?.duration || 0.8;
    const elapsedReal = Math.max(0, activeAttackAction.time / spd);
    const remainingReal = Math.max(0, (dur - activeAttackAction.time) / spd);

    if (prevAttackFadeTimer > 0 && dt > 0) {
      prevAttackFadeTimer = Math.max(0, prevAttackFadeTimer - dt);
      if (prevAttackFadeTimer <= 0 && prevAttackAction) {
        stopActionClean(prevAttackAction);
        prevAttackAction = null;
        prevAttackStartWeight = 0;
      }
    }

    // Finish cleanly once the clip reaches its final clamped frame and blends smoothly back to base
    if (remainingReal <= 0.002) {
      stopActionClean(activeAttackAction);
      activeAttackAction = null;
      clearAttackMaskState();
      if (currentBase) {
        ensureRunningLoop(currentBase);
        currentBase.setEffectiveWeight(wCurBase);
      }
      if (prevBase) {
        ensureRunningLoop(prevBase);
        prevBase.setEffectiveWeight(wPrevBase);
      }
      return;
    }

    const wIn = Math.min(1, elapsedReal / 0.06);
    const wOut = Math.min(1, remainingReal / 0.10);
    const wCurAtkRaw = Math.min(wIn, wOut);
    const wPrevAtkRaw =
      prevAttackAction && prevAttackFadeTimer > 0
        ? prevAttackStartWeight * Math.min(1, prevAttackFadeTimer / PREV_ATTACK_FADE_DUR)
        : 0;

    const rawSum = wCurAtkRaw + wPrevAtkRaw;
    const wAtk = Math.min(1, rawSum);
    let wCurAtk = 0;
    let wPrevAtk = 0;
    if (rawSum > 1e-5) {
      wCurAtk = wAtk * (wCurAtkRaw / rawSum);
      wPrevAtk = wAtk * (wPrevAtkRaw / rawSum);
    }
    const wBaseFull = 1.0 - wAtk;
    lastAttackWeight = wCurAtk;

    // 1) Upper-body attack actions (sum = wAtk)
    activeAttackAction.stopFading();
    activeAttackAction.enabled = true;
    activeAttackAction.setEffectiveWeight(wCurAtk);
    if (!activeAttackAction.isRunning()) activeAttackAction.play();

    if (prevAttackAction) {
      prevAttackAction.stopFading();
      prevAttackAction.enabled = true;
      prevAttackAction.setEffectiveWeight(wPrevAtk);
    }

    // 2) Full base actions (weight = 1 - wAtk; kept enabled so .time advances smoothly in lockstep!)
    if (currentBase) {
      ensureRunningLoop(currentBase);
      currentBase.setEffectiveWeight(wBaseFull * wCurBase);
    }
    if (prevBase) {
      ensureRunningLoop(prevBase);
      prevBase.setEffectiveWeight(wBaseFull * wPrevBase);
    }

    // 3) Complementary lower-body actions (weight = wAtk; lower sum = (1 - wAtk) + wAtk === 1.000!)
    const targetCurLower = findLowerAction(currentBaseName);
    if (targetCurLower !== activeLowerBase) {
      if (activeLowerBase && activeLowerBase !== prevLowerBase) stopActionClean(activeLowerBase);
      activeLowerBase = targetCurLower;
    }
    if (activeLowerBase) {
      ensureRunningLoop(activeLowerBase, currentBase);
      activeLowerBase.setEffectiveWeight(wAtk * wCurBase);
    }

    const targetPrevLower = prevBaseName ? findLowerAction(prevBaseName) : null;
    if (targetPrevLower !== prevLowerBase) {
      if (prevLowerBase && prevLowerBase !== activeLowerBase) stopActionClean(prevLowerBase);
      prevLowerBase = targetPrevLower;
    }
    if (prevLowerBase && prevBase) {
      ensureRunningLoop(prevLowerBase, prevBase);
      prevLowerBase.setEffectiveWeight(wAtk * wPrevBase);
    }
  }

  function setBaseState(clipName, timeScale = 1.0) {
    const next = getAction(clipName) || getAction('Idle');
    if (!next) return;
    const nextName = (next.getClip()?.name || clipName || 'Idle').replace(/\.\d+$/, '');
    next.timeScale = timeScale;
    if (next.paused) next.paused = false;

    if (currentBase === next) {
      if (activeLowerBase) activeLowerBase.timeScale = timeScale;
      return;
    }

    if (prevBase && prevBase !== next) {
      stopActionClean(prevBase);
      stopActionClean(prevLowerBase);
      prevLowerBase = null;
    }

    if (currentBase) {
      prevBase = currentBase;
      prevBaseName = currentBaseName;
      prevLowerBase = activeLowerBase;
      activeLowerBase = null;
      baseFadeTimer = BASE_FADE_DUR;
    } else {
      prevBase = null;
      prevBaseName = null;
      baseFadeTimer = 0;
    }

    if (!next.isRunning()) next.reset();
    next.stopFading();
    next.enabled = true;
    next.play();
    currentBase = next;
    currentBaseName = nextName;
    syncLayerWeights(0);
  }

  function triggerOneShot(clipName, speed = 1.5) {
    if (activeDeathAction) return;
    const act = getAction(clipName);
    if (!act) return;
    const usesUpperMask =
      Boolean(act.getClip()?.userData?.isUpperBodyMask) &&
      Boolean(currentBaseName && findLowerAction(currentBaseName));

    if (usesUpperMask) {
      if (activeAttackAction && activeAttackAction !== act) {
        stopActionClean(prevAttackAction);
        prevAttackAction = activeAttackAction;
        prevAttackStartWeight = Math.max(0.05, lastAttackWeight || activeAttackAction.getEffectiveWeight() || 0.5);
        prevAttackFadeTimer = PREV_ATTACK_FADE_DUR;
      } else {
        stopActionClean(prevAttackAction);
        prevAttackAction = null;
        prevAttackFadeTimer = 0;
        prevAttackStartWeight = 0;
      }
      attackUsesMask = true;
      act.stopFading();
      act.reset();
      act._fadingOut = false;
      act.setLoop(THREE.LoopOnce, 1);
      act.clampWhenFinished = true;
      act.timeScale = speed;
      act.enabled = true;
      act.play();
      activeAttackAction = act;
      syncLayerWeights(0);
      return;
    }

    // Legacy non-masked one-shot path (Mage, Gunslinger, enemies)
    if (attackUsesMask) clearAttackMaskState();
    if (activeAttackAction && activeAttackAction !== act) {
      activeAttackAction.fadeOut(0.06);
    }
    act.stopFading();
    act.reset();
    act._fadingOut = false;
    act.setLoop(THREE.LoopOnce, 1);
    act.clampWhenFinished = false;
    act.timeScale = speed;
    act.weight = 1.0;
    act.fadeIn(0.05).play();
    activeAttackAction = act;
  }

  function updateOneShotFade(dt = 0.016) {
    if (activeHitAction) {
      const hClip = activeHitAction.getClip();
      if (!hClip || !activeHitAction.isRunning()) {
        activeHitAction = null;
      } else {
        const hSpd = Math.max(0.1, Math.abs(activeHitAction.timeScale || 1));
        const hRem = (hClip.duration - activeHitAction.time) / hSpd;
        if (hRem <= 0.08 && !activeHitAction._fadingOut) {
          activeHitAction._fadingOut = true;
          activeHitAction.fadeOut(Math.max(0.03, hRem));
        }
      }
    }

    if (attackUsesMask) {
      syncLayerWeights(dt);
      return;
    }

    syncLayerWeights(dt);
    if (!activeAttackAction) return;
    const clip = activeAttackAction.getClip();
    if (!clip || !activeAttackAction.isRunning()) {
      activeAttackAction = null;
      return;
    }
    const spd = Math.max(0.1, Math.abs(activeAttackAction.timeScale || 1));
    const remainingRealSec = (clip.duration - activeAttackAction.time) / spd;
    if (remainingRealSec <= 0.11 && !activeAttackAction._fadingOut) {
      const fadeDur = Math.max(0.04, remainingRealSec);
      activeAttackAction._fadingOut = true;
      activeAttackAction.fadeOut(fadeDur);
    }
  }

  function triggerHit(speed = 1.85) {
    if (activeDeathAction) return false;
    const act = getAction('Hit_A') || getAction('Hit_B');
    if (!act) return false;
    if (activeHitAction && activeHitAction !== act) {
      activeHitAction.fadeOut(0.04);
    }
    act.reset();
    act._fadingOut = false;
    act.setLoop(THREE.LoopOnce, 1);
    act.clampWhenFinished = false;
    act.timeScale = speed;
    act.weight = 0.78;
    act.fadeIn(0.03).play();
    activeHitAction = act;
    return true;
  }

  function triggerDeath(speed = 1.48) {
    const act =
      getAction('Death_A') ||
      getAction('Death_B') ||
      getAction('Skeletons_Death_Resurrect');
    if (!act) return false;
    if (currentBase) {
      currentBase.fadeOut(0.08);
      currentBase = null;
      currentBaseName = null;
    }
    if (prevBase) {
      stopActionClean(prevBase);
      prevBase = null;
      prevBaseName = null;
      baseFadeTimer = 0;
    }
    clearAttackMaskState();
    if (activeAttackAction) {
      activeAttackAction.fadeOut(0.06);
      activeAttackAction = null;
    }
    if (activeHitAction) {
      activeHitAction.fadeOut(0.04);
      activeHitAction = null;
    }
    act.reset();
    act.setLoop(THREE.LoopOnce, 1);
    act.clampWhenFinished = true;
    act.timeScale = speed;
    act.weight = 1.0;
    act.fadeIn(0.05).play();
    activeDeathAction = act;
    return true;
  }

  function resetAlive() {
    if (activeDeathAction) {
      activeDeathAction.stop();
      activeDeathAction = null;
    }
    if (activeAttackAction) {
      activeAttackAction.stop();
      activeAttackAction = null;
    }
    if (activeHitAction) {
      activeHitAction.stop();
      activeHitAction = null;
    }
    if (prevBase) {
      stopActionClean(prevBase);
      prevBase = null;
      prevBaseName = null;
      baseFadeTimer = 0;
    }
    clearAttackMaskState();
    currentBase = null;
    currentBaseName = null;
    setBaseState(idleClipName, 1.0);
    mixer.update(0.016);
  }

  function syncPhase(clipName, phase01 = 0) {
    if (activeDeathAction) return false;
    const act = getAction(clipName) || getAction(moveClipName) || getAction(idleClipName);
    if (!act) return false;
    const clip = act.getClip();
    const dur = clip?.duration || 0.8;
    const wrapped = ((phase01 % 1) + 1) % 1;
    if (currentBase !== act) {
      if (currentBase) currentBase.stop();
      act.reset().play();
      currentBase = act;
    }
    act.enabled = true;
    act.paused = true;
    act.weight = 1.0;
    act.time = wrapped * dur;
    mixer.update(0);
    return true;
  }

  setBaseState(idleClipName, 1.0);
  mixer.update(0.016);

  function getActiveTime() { return currentBase ? currentBase.time : 0; }
  function getActiveAttackClipName() {
    if (!activeAttackAction || !activeAttackAction.isRunning()) return null;
    return activeAttackAction.getClip()?.name || null;
  }
  function getOneShotRemainingSec() {
    if (!activeAttackAction) return 0;
    const clip = activeAttackAction.getClip();
    if (!activeAttackAction.isRunning() || !clip) return 0;
    const spd = Math.max(0.1, Math.abs(activeAttackAction.timeScale || 1));
    return Math.max(0, (clip.duration - activeAttackAction.time) / spd);
  }
  function isOneShotActive() {
    return getOneShotRemainingSec() > 0.06;
  }
  return {
    mixer,
    setBaseState,
    syncPhase,
    getAction,
    getActiveTime,
    getActiveAttackClipName,
    getOneShotRemainingSec,
    isOneShotActive,
    updateOneShotFade,
    triggerOneShot,
    triggerHit,
    triggerDeath,
    resetAlive
  };
}

const _tmpEuler = new THREE.Euler(0, 0, 0, 'XYZ');
const _tmpDeltaQ = new THREE.Quaternion();
const _ikShoulderW = new THREE.Vector3();
const _ikTargetW = new THREE.Vector3();
const _ikPoleW = new THREE.Vector3();
const _ikDir = new THREE.Vector3();
const _ikPoleOrtho = new THREE.Vector3();
const _ikElbowW = new THREE.Vector3();
const _ikDesiredLocal = new THREE.Vector3();
const _ikParentWorldQ = new THREE.Quaternion();
const _ikRotQ = new THREE.Quaternion();
const _yUnit = new THREE.Vector3(0, 1, 0);
const _uRestDir = new THREE.Vector3();
const _fRestDir = new THREE.Vector3();
const _prevUpperQ = new THREE.Quaternion();
const _prevForeQ = new THREE.Quaternion();

export function setBoneRelEuler(boneEntry, rx = 0, ry = 0, rz = 0) {
  if (!boneEntry) return;
  _tmpEuler.set(rx, ry, rz, 'XYZ');
  _tmpDeltaQ.setFromEuler(_tmpEuler);
  boneEntry.node.quaternion.copy(boneEntry.restQ).multiply(_tmpDeltaQ);
}

// Exact 2-Bone Analytic Arm IK for Mixamo limbs (+Y local bone axis along limb)
// Optional blend (0..1, default 1.0) slerps smoothly from the current animated arm pose.
export function solveMixamoArmIK(upperEntry, foreEntry, handEntry, targetWorldPos, poleWorldPos, blend = 1.0) {
  if (!upperEntry || !foreEntry || !handEntry) return;
  const uNode = upperEntry.node;
  const fNode = foreEntry.node;
  const hNode = handEntry.node;
  if (!uNode.parent) return;

  const useBlend = blend < 0.999;
  if (useBlend) {
    _prevUpperQ.copy(uNode.quaternion);
    _prevForeQ.copy(fNode.quaternion);
  }

  // Reset to rest before measuring/solving
  uNode.quaternion.copy(upperEntry.restQ);
  fNode.quaternion.copy(foreEntry.restQ);
  uNode.parent.updateWorldMatrix(true, false);
  uNode.updateMatrixWorld(true);

  uNode.getWorldPosition(_ikShoulderW);
  fNode.getWorldPosition(_ikElbowW);
  hNode.getWorldPosition(_ikTargetW);

  const L1 = _ikShoulderW.distanceTo(_ikElbowW);
  const L2 = _ikElbowW.distanceTo(_ikTargetW);
  if (L1 < 1e-4 || L2 < 1e-4) {
    if (useBlend) {
      uNode.quaternion.copy(_prevUpperQ);
      fNode.quaternion.copy(_prevForeQ);
    }
    return;
  }

  _ikDir.subVectors(targetWorldPos, _ikShoulderW);
  const rawDist = _ikDir.length();
  if (rawDist < 1e-4) {
    if (useBlend) {
      uNode.quaternion.copy(_prevUpperQ);
      fNode.quaternion.copy(_prevForeQ);
    }
    return;
  }
  _ikDir.divideScalar(rawDist);

  const minD = Math.abs(L1 - L2) + 0.004;
  const maxD = (L1 + L2) * 0.992;
  const D = Math.max(minD, Math.min(maxD, rawDist));

  const cosA = Math.max(-1, Math.min(1, (L1 * L1 + D * D - L2 * L2) / (2 * L1 * D)));
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));

  _ikPoleOrtho.subVectors(poleWorldPos, _ikShoulderW);
  _ikPoleOrtho.addScaledVector(_ikDir, -_ikPoleOrtho.dot(_ikDir));
  if (_ikPoleOrtho.lengthSq() < 1e-6) {
    _ikPoleOrtho.set(0, -1, -0.5).addScaledVector(_ikDir, -_ikDir.y).normalize();
  } else {
    _ikPoleOrtho.normalize();
  }

  // Desired elbow position in world space
  _ikElbowW
    .copy(_ikShoulderW)
    .addScaledVector(_ikDir, L1 * cosA)
    .addScaledVector(_ikPoleOrtho, L1 * sinA);

  // Rotate UpperArm so its +Y axis points at _ikElbowW
  uNode.parent.getWorldQuaternion(_ikParentWorldQ);
  _ikDesiredLocal.subVectors(_ikElbowW, _ikShoulderW).normalize();
  _ikDesiredLocal.applyQuaternion(_ikParentWorldQ.invert());
  _uRestDir.copy(_yUnit).applyQuaternion(upperEntry.restQ).normalize();
  _ikRotQ.setFromUnitVectors(_uRestDir, _ikDesiredLocal);
  uNode.quaternion.copy(_ikRotQ).multiply(upperEntry.restQ);
  if (useBlend) {
    _prevUpperQ.slerp(uNode.quaternion, blend);
    uNode.quaternion.copy(_prevUpperQ);
  }
  uNode.updateMatrixWorld(true);

  // Rotate ForeArm so its +Y axis points at targetWorldPos
  fNode.getWorldPosition(_ikElbowW);
  uNode.getWorldQuaternion(_ikParentWorldQ);
  _ikDesiredLocal.subVectors(targetWorldPos, _ikElbowW).normalize();
  _ikDesiredLocal.applyQuaternion(_ikParentWorldQ.invert());
  _fRestDir.copy(_yUnit).applyQuaternion(foreEntry.restQ).normalize();
  _ikRotQ.setFromUnitVectors(_fRestDir, _ikDesiredLocal);
  fNode.quaternion.copy(_ikRotQ).multiply(foreEntry.restQ);
  if (useBlend) {
    _prevForeQ.slerp(fNode.quaternion, blend);
    fNode.quaternion.copy(_prevForeQ);
  }
  fNode.updateMatrixWorld(true);
}
