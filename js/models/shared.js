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

  function smoothstep01(x) {
    const t = x <= 0 ? 0 : x >= 1 ? 1 : x;
    return t * t * (3 - 2 * t);
  }

  let currentBase = null;
  let currentBaseName = null;
  let prevBase = null;
  let prevBaseName = null;
  let baseFadeTimer = 0;
  const BASE_FADE_DUR = 0.18;
  let baseFadeDur = BASE_FADE_DUR;

  let activeLowerBase = null;
  let prevLowerBase = null;

  let activeAttackAction = null;
  let attackUsesMask = false;
  let lastAttackWeight = 0;
  let attackBlendInAge = 0;
  let attackBlendInDur = 0.08;
  let prevAttackAction = null;
  let prevAttackStartWeight = 0;
  let prevAttackFadeTimer = 0;
  let prevAttackFadeDur = 0.10;
  const PREV_ATTACK_FADE_DUR = 0.10;
  const RUN_HANDOFF_FADE_DUR = 0.14;
  let legacyAtkAge = 0;
  let legacyAtkInDur = 0.10;
  const LEGACY_ATK_IN_DUR = 0.10;
  const LEGACY_ATK_OUT_DUR = 0.14;
  const LEGACY_COMBO_CROSSFADE_DUR = 0.12;

  function isClipUpperMask(act) {
    return Boolean(act?.getClip()?.userData?.isUpperBodyMask);
  }

  function isClipFullBodyAttack(act) {
    return Boolean(act?.getClip()?.userData?.isFullBodyAttack);
  }

  let blockWanted = false;
  let blockBlend = 0;
  let blockAction = null;

  let doorPushWanted = false;
  let doorPushEffort = 1.0;
  let doorPushBlend = 0;
  let doorPushAction = null;

  let activeHitAction = null;
  let hitBlendInAge = 0;
  let hitBlendInDur = 0.036;
  let hitBlendOutDur = 0.085;
  let hitMaxWeight = 1.0;
  let activeDeathAction = null;
  let isDead = false;

  let activeTurnAction = null;
  let turnBlendInAge = 0;
  const TURN_BLEND_IN_DUR = 0.055;
  const TURN_BLEND_OUT_DUR = 0.11;

  let activeRollAction = null;
  let rollBlendInAge = 0;
  const ROLL_BLEND_IN_DUR = 0.065;
  const ROLL_BLEND_OUT_DUR = 0.11;

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
    // Never restart a clamped one-shot action that is serving as a smooth outgoing prevBase pose
    const clipDur = act.getClip?.()?.duration || 0;
    const isFinishedClamped = Boolean(act.clampWhenFinished && clipDur > 0 && act.time >= clipDur - 1e-4);
    if (!act.isRunning() && !isFinishedClamped) act.play();
  }

  function stopActionClean(act) {
    if (!act) return;
    act.stopFading();
    act.setEffectiveWeight(0);
    act.stop();
  }

  function clearAttackMaskState(preservePrev = false) {
    if (!preservePrev) {
      stopActionClean(prevAttackAction);
      prevAttackAction = null;
      prevAttackFadeTimer = 0;
      prevAttackFadeDur = PREV_ATTACK_FADE_DUR;
      prevAttackStartWeight = 0;
    }
    attackBlendInAge = 0;
    attackBlendInDur = 0.08;
    if (blockBlend <= 0.001) {
      stopActionClean(activeLowerBase);
      activeLowerBase = null;
      stopActionClean(prevLowerBase);
      prevLowerBase = null;
    }
    attackUsesMask = false;
    lastAttackWeight = 0;
  }

  function stopAllNonDeathActions(keepAct = null) {
    blockWanted = false;
    blockBlend = 0;
    if (blockAction && blockAction !== keepAct) {
      stopActionClean(blockAction);
    }
    doorPushWanted = false;
    doorPushBlend = 0;
    if (doorPushAction && doorPushAction !== keepAct) {
      stopActionClean(doorPushAction);
    }
    if (activeLowerBase && activeLowerBase !== keepAct) stopActionClean(activeLowerBase);
    activeLowerBase = null;
    if (prevLowerBase && prevLowerBase !== keepAct) stopActionClean(prevLowerBase);
    prevLowerBase = null;
    if (prevBase && prevBase !== keepAct) stopActionClean(prevBase);
    prevBase = null;
    prevBaseName = null;
    baseFadeTimer = 0;
    baseFadeDur = BASE_FADE_DUR;
    if (currentBase && currentBase !== keepAct) stopActionClean(currentBase);
    currentBase = null;
    currentBaseName = null;
    clearAttackMaskState(prevAttackAction === keepAct);
    if (prevAttackAction === keepAct) {
      prevAttackAction = null;
      prevAttackFadeTimer = 0;
      prevAttackFadeDur = PREV_ATTACK_FADE_DUR;
      prevAttackStartWeight = 0;
    }
    if (activeAttackAction && activeAttackAction !== keepAct) {
      stopActionClean(activeAttackAction);
    }
    activeAttackAction = null;
    legacyAtkAge = 0;
    legacyAtkInDur = LEGACY_ATK_IN_DUR;
    if (activeHitAction && activeHitAction !== keepAct) {
      stopActionClean(activeHitAction);
    }
    activeHitAction = null;
    hitBlendInAge = 0;
    if (activeTurnAction && activeTurnAction !== keepAct) {
      stopActionClean(activeTurnAction);
    }
    activeTurnAction = null;
    turnBlendInAge = 0;
    if (activeRollAction && activeRollAction !== keepAct) {
      stopActionClean(activeRollAction);
    }
    activeRollAction = null;
    rollBlendInAge = 0;
    for (const other of actions.values()) {
      if (other && other !== keepAct) {
        stopActionClean(other);
      }
    }
  }

  function setBlockState(active) {
    if (isDead || activeDeathAction) {
      blockWanted = false;
      return;
    }
    blockWanted = Boolean(active);
    if (blockWanted && doorPushWanted) {
      doorPushWanted = false;
      doorPushBlend = 0;
      if (doorPushAction) stopActionClean(doorPushAction);
    }
    if (blockWanted && activeTurnAction) {
      stopActionClean(activeTurnAction);
      activeTurnAction = null;
      turnBlendInAge = 0;
    }
    if (blockWanted && activeHitAction) {
      stopActionClean(activeHitAction);
      activeHitAction = null;
      hitBlendInAge = 0;
    }
    if (blockWanted && !blockAction) {
      const candidate = getAction('Block') || getAction('Blocking');
      if (candidate && candidate.getClip()?.userData?.isUpperBodyMask) {
        blockAction = candidate;
      }
    }
  }

  function setDoorPushState(active, effort01 = 1.0) {
    if (isDead || activeDeathAction) {
      doorPushWanted = false;
      return false;
    }
    const want = Boolean(active);
    const clampedEffort = Number.isFinite(Number(effort01))
      ? Math.max(0.0, Math.min(1.5, Number(effort01)))
      : 1.0;
    doorPushEffort = clampedEffort;
    if (!want) {
      doorPushWanted = false;
      return true;
    }
    const act = doorPushAction || getAction('Door_Push');
    if (!act) {
      doorPushWanted = false;
      return false;
    }
    doorPushAction = act;
    const wasActive = doorPushWanted || doorPushBlend > 0.01;
    if (!wasActive) {
      blockWanted = false;
      blockBlend = 0;
      if (blockAction) stopActionClean(blockAction);
      if (activeTurnAction) {
        stopActionClean(activeTurnAction);
        activeTurnAction = null;
        turnBlendInAge = 0;
      }
      if (activeHitAction) {
        stopActionClean(activeHitAction);
        activeHitAction = null;
        hitBlendInAge = 0;
      }
      clearAttackMaskState();
      if (activeAttackAction) {
        stopActionClean(activeAttackAction);
        activeAttackAction = null;
      }
      legacyAtkAge = 0;
      legacyAtkInDur = LEGACY_ATK_IN_DUR;
      act.stopFading();
      act.reset();
      act._fadingOut = false;
      act.setLoop(THREE.LoopOnce, 1);
      act.clampWhenFinished = true;
      act.enabled = true;
      act.paused = false;
      act.play();
    }
    doorPushWanted = true;
    act.timeScale = 0.72 + Math.max(0, Math.min(1.5, clampedEffort)) * 0.42;
    syncLayerWeights(0);
    return true;
  }

  function isDoorPushActive() {
    return Boolean(!isDead && !activeDeathAction && (doorPushWanted || doorPushBlend > 0.01));
  }

  function cancelRoll() {
    if (!activeRollAction) return;
    stopActionClean(activeRollAction);
    activeRollAction = null;
    rollBlendInAge = 0;
    if (!isDead && !activeDeathAction) {
      syncLayerWeights(0);
    }
  }

  function triggerRoll(durationSec = 0.6833, clipName = 'Combat_Roll') {
    if (isDead || activeDeathAction) return false;
    const act =
      (typeof clipName === 'string' && clipName ? getAction(clipName) : null) ||
      getAction('Combat_Roll');
    if (!act) return false;

    // Immediately cancel all lower-priority layers (Door_Push, Turn_180, Attack, Shield Block, Hit React)
    doorPushWanted = false;
    doorPushBlend = 0;
    if (doorPushAction) {
      stopActionClean(doorPushAction);
    }
    if (activeTurnAction) {
      stopActionClean(activeTurnAction);
      activeTurnAction = null;
      turnBlendInAge = 0;
    }
    if (activeHitAction) {
      stopActionClean(activeHitAction);
      activeHitAction = null;
      hitBlendInAge = 0;
    }
    clearAttackMaskState();
    if (activeAttackAction) {
      stopActionClean(activeAttackAction);
      activeAttackAction = null;
    }
    legacyAtkAge = 0;
    legacyAtkInDur = LEGACY_ATK_IN_DUR;
    blockWanted = false;
    blockBlend = 0;
    if (blockAction) {
      stopActionClean(blockAction);
    }
    if (activeRollAction && activeRollAction !== act) {
      stopActionClean(activeRollAction);
    }

    const clip = act.getClip?.();
    const clipDur = clip?.duration > 0.05 ? clip.duration : 0.6833;
    const isBakedCombatRoll = (clip?.name || clipName) === 'Combat_Roll';
    const targetDur =
      Number.isFinite(Number(durationSec)) && Number(durationSec) > 0.08
        ? Number(durationSec)
        : clipDur;
    // Play Elden-Ring Combat_Roll at natural 1.0x cadence (0.6833s) without artificial speedup
    const safeSpeed = isBakedCombatRoll
      ? 1.0
      : Math.max(0.35, Math.min(3.0, clipDur / targetDur));

    act.stopFading();
    act.reset();
    act._fadingOut = false;
    act.setLoop(THREE.LoopOnce, 1);
    act.clampWhenFinished = true;
    act.timeScale = safeSpeed;
    act.enabled = true;
    act.paused = false;
    act.play();
    activeRollAction = act;
    rollBlendInAge = 0;
    syncLayerWeights(0);
    return true;
  }

  function isRollActive() {
    if (!activeRollAction) return false;
    const clip = activeRollAction.getClip?.();
    if (!clip || !activeRollAction.isRunning()) return false;
    const spd = Math.max(0.1, Math.abs(activeRollAction.timeScale || 1));
    return (clip.duration - activeRollAction.time) / spd > 0.004;
  }

  function cancelTurn180() {
    if (!activeTurnAction) return;
    stopActionClean(activeTurnAction);
    activeTurnAction = null;
    turnBlendInAge = 0;
    if (!isDead && !activeDeathAction) {
      syncLayerWeights(0);
    }
  }

  function triggerTurn180(speed = 1.38) {
    if (isDead || activeDeathAction || activeRollAction || activeAttackAction || blockWanted || activeHitAction) return false;
    const act = getAction('Turn_180');
    if (!act) return false;
    const safeSpeed = Math.max(0.5, Math.abs(Number(speed) || 1.38));
    if (activeTurnAction && activeTurnAction !== act) {
      stopActionClean(activeTurnAction);
    }
    act.stopFading();
    act.reset();
    act._fadingOut = false;
    act.setLoop(THREE.LoopOnce, 1);
    act.clampWhenFinished = true;
    act.timeScale = safeSpeed;
    act.enabled = true;
    act.paused = false;
    act.play();
    activeTurnAction = act;
    turnBlendInAge = 0;
    syncLayerWeights(0);
    return true;
  }

  function isTurn180Active() {
    if (!activeTurnAction) return false;
    const clip = activeTurnAction.getClip?.();
    if (!clip || !activeTurnAction.isRunning()) return false;
    const spd = Math.max(0.1, Math.abs(activeTurnAction.timeScale || 1));
    return (clip.duration - activeTurnAction.time) / spd > 0.004;
  }

  function getTurn180Progress() {
    if (!activeTurnAction) return null;
    const clip = activeTurnAction.getClip?.();
    if (!clip || !activeTurnAction.isRunning()) return null;
    const dur = Math.max(1e-4, clip.duration || 0.8167);
    const spd = Math.max(0.1, Math.abs(activeTurnAction.timeScale || 1));
    const remainingSec = Math.max(0, (dur - activeTurnAction.time) / spd);
    if (remainingSec <= 0.002) return null;
    const progress01 = Math.max(0, Math.min(1, activeTurnAction.time / dur));
    const curve = clip.userData?.turnYawCurve;
    let yawProgress01 = progress01;
    if (curve && curve.length >= 2) {
      const fIdx = progress01 * (curve.length - 1);
      const i0 = Math.min(curve.length - 1, Math.floor(fIdx));
      const i1 = Math.min(curve.length - 1, i0 + 1);
      const frac = fIdx - i0;
      yawProgress01 = curve[i0] + (curve[i1] - curve[i0]) * frac;
    }
    return {
      active: true,
      progress01,
      yawProgress01: Math.max(0, Math.min(1, yawProgress01)),
      remainingSec,
      turnSign: clip.userData?.turnSign || -1
    };
  }

  // Deterministic weight solver:
  // Guarantees sum of weights === 1.000 on BOTH lower-body and upper-body bones on EVERY frame
  // (mathematically eliminates T-pose flashes and Three.js fadeOut jump-to-1.0 snaps!).
  function syncLayerWeights(dt = 0) {
    if (isDead || activeDeathAction) {
      if (activeDeathAction) {
        activeDeathAction.enabled = true;
        activeDeathAction.setEffectiveWeight(1.0);
      }
      return;
    }

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

    const rawPrevBase = prevBase && baseFadeTimer > 0 ? Math.min(1, baseFadeTimer / Math.max(0.01, baseFadeDur)) : 0;
    const wPrevBase = smoothstep01(rawPrevBase);
    const wCurBase = 1.0 - wPrevBase;

    // Full-body 60 FPS Combat_Roll layer with exact partition of unity:
    //   wRoll + (1 - wRoll) * (wCurBase + wPrevBase) === 1.000 on every bone (zero T-pose!)
    if (activeRollAction) {
      const rClip = activeRollAction.getClip?.();
      const rSpd = Math.max(0.1, Math.abs(activeRollAction.timeScale || 1));
      const rDur = rClip?.duration || 0.50;
      const rRem = Math.max(0, (rDur - activeRollAction.time) / rSpd);
      if (dt > 0) rollBlendInAge += dt;

      if (!rClip || rRem <= 0.002) {
        stopActionClean(activeRollAction);
        activeRollAction = null;
        rollBlendInAge = 0;
      } else {
        const wIn = smoothstep01(rollBlendInAge / ROLL_BLEND_IN_DUR);
        const wOut = smoothstep01(rRem / ROLL_BLEND_OUT_DUR);
        const wRoll = Math.max(0, Math.min(1, Math.min(wIn, wOut)));
        const wBaseRem = Math.max(0, 1.0 - wRoll);

        blockBlend = 0;
        if (blockAction) stopActionClean(blockAction);
        doorPushWanted = false;
        doorPushBlend = 0;
        if (doorPushAction) stopActionClean(doorPushAction);
        if (activeLowerBase) {
          stopActionClean(activeLowerBase);
          activeLowerBase = null;
        }
        if (prevLowerBase) {
          stopActionClean(prevLowerBase);
          prevLowerBase = null;
        }
        if (activeTurnAction) {
          stopActionClean(activeTurnAction);
          activeTurnAction = null;
          turnBlendInAge = 0;
        }
        if (activeHitAction) {
          stopActionClean(activeHitAction);
          activeHitAction = null;
          hitBlendInAge = 0;
        }
        if (!currentBase) {
          currentBase = getAction(idleClipName);
          currentBaseName = idleClipName;
        }

        activeRollAction.stopFading();
        activeRollAction.enabled = true;
        activeRollAction.paused = false;
        activeRollAction.setEffectiveWeight(wRoll);
        if (!activeRollAction.isRunning()) activeRollAction.play();

        if (currentBase) {
          ensureRunningLoop(currentBase);
          currentBase.setEffectiveWeight(wBaseRem * wCurBase);
        }
        if (prevBase) {
          ensureRunningLoop(prevBase);
          prevBase.setEffectiveWeight(wBaseRem * wPrevBase);
        }
        return;
      }
    }

    // Full-body 60 FPS Door_Push layer (Souls Citadel boss-gate push) with strict partition of unity:
    //   wDoor + (1 - wDoor) * (wCurBase + wPrevBase) === 1.000 on every bone!
    if (doorPushAction && (doorPushWanted || doorPushBlend > 0.001)) {
      if (dt > 0) {
        const targetDP = doorPushWanted ? 1 : 0;
        const durDP = doorPushWanted ? 0.14 : 0.18;
        const step = dt / durDP;
        if (targetDP > doorPushBlend) {
          doorPushBlend = Math.min(1, doorPushBlend + step);
        } else {
          doorPushBlend = Math.max(0, doorPushBlend - step);
        }
      } else if (doorPushWanted && doorPushBlend <= 0.001) {
        doorPushBlend = 0.08;
      }
      const wDoor = smoothstep01(doorPushBlend);
      if (wDoor > 0.001) {
        const wBaseRem = Math.max(0, 1.0 - wDoor);
        blockBlend = 0;
        if (blockAction) stopActionClean(blockAction);
        if (activeLowerBase) {
          stopActionClean(activeLowerBase);
          activeLowerBase = null;
        }
        if (prevLowerBase) {
          stopActionClean(prevLowerBase);
          prevLowerBase = null;
        }
        if (!currentBase) {
          currentBase = getAction(idleClipName);
          currentBaseName = idleClipName;
        }
        doorPushAction.stopFading();
        doorPushAction.enabled = true;
        doorPushAction.paused = false;
        doorPushAction.timeScale = 0.72 + Math.max(0, Math.min(1.5, doorPushEffort)) * 0.42;
        doorPushAction.setEffectiveWeight(wDoor);
        const dpDur = doorPushAction.getClip?.()?.duration || 2.1;
        if (!doorPushAction.isRunning() && doorPushAction.time < dpDur - 1e-3) {
          doorPushAction.play();
        }
        if (currentBase) {
          ensureRunningLoop(currentBase);
          currentBase.setEffectiveWeight(wBaseRem * wCurBase);
        }
        if (prevBase) {
          ensureRunningLoop(prevBase);
          prevBase.setEffectiveWeight(wBaseRem * wPrevBase);
        }
        return;
      } else {
        stopActionClean(doorPushAction);
        doorPushBlend = 0;
      }
    }

    // Smoothly ramp upper-body Shield Block blend (0..1)
    if (dt > 0) {
      const targetB = blockWanted && blockAction ? 1 : 0;
      const rate = targetB > blockBlend ? 10.0 : 8.5;
      blockBlend = blockBlend + (targetB - blockBlend) * Math.min(1, dt * rate);
      if (blockBlend < 0.003 && targetB === 0) blockBlend = 0;
      if (blockBlend > 0.997 && targetB === 1) blockBlend = 1;
    }

    const hasMaskedAttack = Boolean(attackUsesMask && activeAttackAction);
    const hasMaskedBlock = Boolean(blockAction && blockBlend > 0.002 && currentBaseName && findLowerAction(currentBaseName));

    // Full-body Hit React / Warrior Impact layer with exact partition of unity:
    //   wHit + (1 - wHit) * (wCurBase + wPrevBase) === 1.000 on every bone (zero T-pose!)
    if (activeHitAction) {
      if (hasMaskedAttack || hasMaskedBlock || blockWanted || activeAttackAction) {
        stopActionClean(activeHitAction);
        activeHitAction = null;
        hitBlendInAge = 0;
      } else {
        const hClip = activeHitAction.getClip?.();
        const hSpd = Math.max(0.1, Math.abs(activeHitAction.timeScale || 1));
        const hDur = hClip?.duration || 0.4;
        const hRem = Math.max(0, (hDur - activeHitAction.time) / hSpd);
        if (dt > 0) hitBlendInAge += dt;

        if (!hClip || hRem <= 0.002) {
          stopActionClean(activeHitAction);
          activeHitAction = null;
          hitBlendInAge = 0;
        } else {
          const wIn = hitBlendInDur > 1e-4 ? smoothstep01(hitBlendInAge / hitBlendInDur) : 1;
          const wOut = hitBlendOutDur > 1e-4 ? smoothstep01(hRem / hitBlendOutDur) : 1;
          const wHit = Math.max(0, Math.min(hitMaxWeight, Math.min(wIn, wOut) * hitMaxWeight));
          const wBaseRem = Math.max(0, 1.0 - wHit);

          if (blockAction) stopActionClean(blockAction);
          if (activeLowerBase) {
            stopActionClean(activeLowerBase);
            activeLowerBase = null;
          }
          if (prevLowerBase) {
            stopActionClean(prevLowerBase);
            prevLowerBase = null;
          }
          if (activeTurnAction) {
            stopActionClean(activeTurnAction);
            activeTurnAction = null;
            turnBlendInAge = 0;
          }
          if (!currentBase) {
            currentBase = getAction(idleClipName);
            currentBaseName = idleClipName;
          }

          activeHitAction.stopFading();
          activeHitAction.enabled = true;
          activeHitAction.paused = false;
          activeHitAction.setEffectiveWeight(wHit);
          if (!activeHitAction.isRunning()) activeHitAction.play();

          if (currentBase) {
            ensureRunningLoop(currentBase);
            currentBase.setEffectiveWeight(wBaseRem * wCurBase);
          }
          if (prevBase) {
            ensureRunningLoop(prevBase);
            prevBase.setEffectiveWeight(wBaseRem * wPrevBase);
          }
          return;
        }
      }
    }

    // Attacks and Shield Block strictly override Turn_180 immediately (zero turn lag on combat actions).
    if (activeTurnAction && (hasMaskedAttack || hasMaskedBlock || blockWanted || activeAttackAction)) {
      stopActionClean(activeTurnAction);
      activeTurnAction = null;
      turnBlendInAge = 0;
    }

    // Full-body 60 FPS Turn_180 layer with exact partition of unity: wTurn + (1 - wTurn) * (wCurBase + wPrevBase) === 1.000
    if (activeTurnAction && !hasMaskedAttack && !hasMaskedBlock) {
      const tClip = activeTurnAction.getClip?.();
      const tSpd = Math.max(0.1, Math.abs(activeTurnAction.timeScale || 1));
      const tDur = tClip?.duration || 0.8167;
      const tRem = Math.max(0, (tDur - activeTurnAction.time) / tSpd);
      if (dt > 0) turnBlendInAge += dt;

      if (!tClip || tRem <= 0.002) {
        stopActionClean(activeTurnAction);
        activeTurnAction = null;
        turnBlendInAge = 0;
      } else {
        const wIn = smoothstep01(turnBlendInAge / TURN_BLEND_IN_DUR);
        const wOut = smoothstep01(tRem / TURN_BLEND_OUT_DUR);
        const wTurn = Math.max(0, Math.min(1, Math.min(wIn, wOut)));
        const wBaseRem = Math.max(0, 1.0 - wTurn);

        if (blockAction) stopActionClean(blockAction);
        if (activeLowerBase) {
          stopActionClean(activeLowerBase);
          activeLowerBase = null;
        }
        if (prevLowerBase) {
          stopActionClean(prevLowerBase);
          prevLowerBase = null;
        }

        activeTurnAction.stopFading();
        activeTurnAction.enabled = true;
        activeTurnAction.paused = false;
        activeTurnAction.setEffectiveWeight(wTurn);
        if (!activeTurnAction.isRunning()) activeTurnAction.play();

        if (currentBase) {
          ensureRunningLoop(currentBase);
          currentBase.setEffectiveWeight(wBaseRem * wCurBase);
        }
        if (prevBase) {
          ensureRunningLoop(prevBase);
          prevBase.setEffectiveWeight(wBaseRem * wPrevBase);
        }
        return;
      }
    }

    if (!hasMaskedAttack && !hasMaskedBlock) {
      if (blockAction) stopActionClean(blockAction);
      if (activeLowerBase) {
        stopActionClean(activeLowerBase);
        activeLowerBase = null;
      }
      if (prevLowerBase) {
        stopActionClean(prevLowerBase);
        prevLowerBase = null;
      }
      // Guarantee currentBase is always initialized so sum(weights) === 1.000 never drops to 0 (zero T-pose!)
      if (!currentBase) {
        currentBase = getAction(idleClipName);
        currentBaseName = idleClipName;
      }
      // Full-body non-masked one-shot & multi-hit combo crossfade (Rift AAA enemies, Boss Troll combos, Mage, Gunslinger):
      // Strict partition of unity: wCurAtk + wPrevAtk + wBaseRem * (wCurBase + wPrevBase) === 1.000 on EVERY frame,
      // and ZERO 1-frame dip back into Idle when chaining Attack_Slash_1 -> Attack_Slash_2 -> Attack_Overhead_Crush
      // or Combo_Sweep_1 -> Combo_Backhand_2 -> Combo_Slam_3!
      if (prevAttackAction && prevAttackFadeTimer > 0 && dt > 0) {
        prevAttackFadeTimer = Math.max(0, prevAttackFadeTimer - dt);
        if (prevAttackFadeTimer <= 0) {
          stopActionClean(prevAttackAction);
          prevAttackAction = null;
          prevAttackStartWeight = 0;
          prevAttackFadeDur = PREV_ATTACK_FADE_DUR;
        }
      }
      if (activeAttackAction) {
        const aClip = activeAttackAction.getClip?.();
        const aSpd = Math.max(0.1, Math.abs(activeAttackAction.timeScale || 1));
        const aDur = aClip?.duration || 0.8;
        const aRem = Math.max(0, (aDur - activeAttackAction.time) / aSpd);
        if (dt > 0) legacyAtkAge += dt;

        if (!aClip || aRem <= 0.002) {
          stopActionClean(activeAttackAction);
          activeAttackAction = null;
          if (prevAttackAction) {
            stopActionClean(prevAttackAction);
            prevAttackAction = null;
            prevAttackFadeTimer = 0;
            prevAttackStartWeight = 0;
          }
          legacyAtkAge = 0;
          lastAttackWeight = 0;
        } else {
          const wIn = smoothstep01(legacyAtkAge / Math.max(0.01, legacyAtkInDur));
          const wOut = smoothstep01(aRem / LEGACY_ATK_OUT_DUR);
          const wCurRaw = Math.max(0, Math.min(1, Math.min(wIn, wOut)));
          const fadeDenom = Math.max(1e-4, prevAttackFadeDur || LEGACY_COMBO_CROSSFADE_DUR);
          const wPrevRaw =
            prevAttackAction && prevAttackFadeTimer > 0
              ? prevAttackStartWeight * smoothstep01(prevAttackFadeTimer / fadeDenom)
              : 0;

          const rawSum = wCurRaw + wPrevRaw;
          const wTotalAtk = Math.min(1, rawSum);
          let wCurFull = 0;
          let wPrevFull = 0;
          if (rawSum > 1e-5) {
            wCurFull = wTotalAtk * (wCurRaw / rawSum);
            wPrevFull = wTotalAtk * (wPrevRaw / rawSum);
          }
          const wBaseRem = Math.max(0, 1.0 - wTotalAtk);
          lastAttackWeight = wCurFull;

          activeAttackAction.stopFading();
          activeAttackAction.enabled = true;
          activeAttackAction.paused = false;
          activeAttackAction.setEffectiveWeight(wCurFull);
          if (!activeAttackAction.isRunning()) activeAttackAction.play();

          if (prevAttackAction) {
            if (wPrevFull > 0.0005) {
              prevAttackAction.stopFading();
              prevAttackAction.enabled = true;
              prevAttackAction.setEffectiveWeight(wPrevFull);
            } else {
              stopActionClean(prevAttackAction);
              prevAttackAction = null;
              prevAttackFadeTimer = 0;
              prevAttackStartWeight = 0;
            }
          }

          if (currentBase) {
            ensureRunningLoop(currentBase);
            currentBase.setEffectiveWeight(wBaseRem * wCurBase);
          }
          if (prevBase) {
            ensureRunningLoop(prevBase);
            prevBase.setEffectiveWeight(wBaseRem * wPrevBase);
          }
          return;
        }
      } else if (prevAttackAction) {
        stopActionClean(prevAttackAction);
        prevAttackAction = null;
        prevAttackFadeTimer = 0;
        prevAttackStartWeight = 0;
      }
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

    let wAtk = 0;
    let wCurAtk = 0;
    let wPrevAtk = 0;
    let wAtkFull = 0;
    let wAtkMasked = 0;

    if (hasMaskedAttack) {
      const clip = activeAttackAction.getClip();
      const spd = Math.max(0.1, Math.abs(activeAttackAction.timeScale || 1));
      const dur = clip?.duration || 0.8;
      const remainingReal = Math.max(0, (dur - activeAttackAction.time) / spd);

      if (dt > 0) {
        attackBlendInAge += dt;
      }

      if (prevAttackFadeTimer > 0 && dt > 0) {
        prevAttackFadeTimer = Math.max(0, prevAttackFadeTimer - dt);
        if (prevAttackFadeTimer <= 0 && prevAttackAction) {
          stopActionClean(prevAttackAction);
          prevAttackAction = null;
          prevAttackStartWeight = 0;
          prevAttackFadeDur = PREV_ATTACK_FADE_DUR;
        }
      }

      if (remainingReal <= 0.002) {
        stopActionClean(activeAttackAction);
        activeAttackAction = null;
        clearAttackMaskState();
      } else {
        const wIn = attackBlendInDur > 1e-4 ? smoothstep01(attackBlendInAge / attackBlendInDur) : 1;
        const wOut = smoothstep01(remainingReal / 0.12);
        const wCurAtkRaw = Math.min(wIn, wOut);
        const fadeDenom = Math.max(1e-4, prevAttackFadeDur || PREV_ATTACK_FADE_DUR);
        const wPrevAtkRaw =
          prevAttackAction && prevAttackFadeTimer > 0
            ? prevAttackStartWeight * smoothstep01(prevAttackFadeTimer / fadeDenom)
            : 0;

        const rawSum = wCurAtkRaw + wPrevAtkRaw;
        wAtk = Math.min(1, rawSum);
        if (rawSum > 1e-5) {
          wCurAtk = wAtk * (wCurAtkRaw / rawSum);
          wPrevAtk = wAtk * (wPrevAtkRaw / rawSum);
        }
        lastAttackWeight = wCurAtk;

        const curIsUpperMask = isClipUpperMask(activeAttackAction);
        const prevIsUpperMask = isClipUpperMask(prevAttackAction);
        wAtkFull = (curIsUpperMask ? 0 : wCurAtk) + (prevIsUpperMask ? 0 : wPrevAtk);
        wAtkMasked = (curIsUpperMask ? wCurAtk : 0) + (prevIsUpperMask ? wPrevAtk : 0);

        activeAttackAction.stopFading();
        activeAttackAction.enabled = true;
        activeAttackAction.setEffectiveWeight(wCurAtk);
        if (!activeAttackAction.isRunning()) activeAttackAction.play();

        if (prevAttackAction) {
          prevAttackAction.stopFading();
          prevAttackAction.enabled = true;
          prevAttackAction.setEffectiveWeight(wPrevAtk);
        }
      }
    }

    // Shield block sits cleanly underneath attacks (wBlockEff + wAtk <= 1.0)
    const wBlockEff = hasMaskedBlock ? blockBlend * (1.0 - wAtk) : 0;
    if (blockAction) {
      if (wBlockEff > 0.001) {
        blockAction.stopFading();
        blockAction.enabled = true;
        blockAction.paused = false;
        blockAction.setLoop(THREE.LoopPingPong, Infinity);
        blockAction.timeScale = 0.25;
        if (!blockAction.isRunning()) {
          blockAction.reset();
          blockAction.time = 0.35;
          blockAction.play();
        }
        blockAction.setEffectiveWeight(wBlockEff);
      } else {
        stopActionClean(blockAction);
      }
    }

    // Exact partition of unity on BOTH upper and lower bone sets:
    //   UPPER sum = wAtk + wBlockEff + wBaseFull === 1.000
    //   LOWER sum = wAtkFull + wBaseFull + wLowerComp === 1.000
    const wUpper = Math.min(1, wAtk + wBlockEff);
    const wBaseFull = Math.max(0, 1.0 - wUpper);
    const wLowerComp = Math.min(1, wAtkMasked + wBlockEff);

    // 2) Full base actions (weight = 1 - wUpper; kept enabled so .time advances smoothly in lockstep!)
    if (currentBase) {
      ensureRunningLoop(currentBase);
      currentBase.setEffectiveWeight(wBaseFull * wCurBase);
    }
    if (prevBase) {
      ensureRunningLoop(prevBase);
      prevBase.setEffectiveWeight(wBaseFull * wPrevBase);
    }

    // 3) Complementary lower-body actions (active ONLY for upper-body masked layers: wLowerComp = wAtkMasked + wBlockEff)
    if (wLowerComp > 0.001) {
      const targetCurLower = findLowerAction(currentBaseName);
      if (targetCurLower !== activeLowerBase) {
        if (activeLowerBase && activeLowerBase !== prevLowerBase) stopActionClean(activeLowerBase);
        activeLowerBase = targetCurLower;
      }
      if (activeLowerBase) {
        ensureRunningLoop(activeLowerBase, currentBase);
        activeLowerBase.setEffectiveWeight(wLowerComp * wCurBase);
      }

      const targetPrevLower = prevBaseName ? findLowerAction(prevBaseName) : null;
      if (targetPrevLower !== prevLowerBase) {
        if (prevLowerBase && prevLowerBase !== activeLowerBase) stopActionClean(prevLowerBase);
        prevLowerBase = targetPrevLower;
      }
      if (prevLowerBase && prevBase) {
        ensureRunningLoop(prevLowerBase, prevBase);
        prevLowerBase.setEffectiveWeight(wLowerComp * wPrevBase);
      }
    } else {
      if (activeLowerBase) {
        stopActionClean(activeLowerBase);
        activeLowerBase = null;
      }
      if (prevLowerBase) {
        stopActionClean(prevLowerBase);
        prevLowerBase = null;
      }
    }
  }

  function setBaseState(clipName, timeScale = 1.0, fadeDurSec = null) {
    if (isDead || activeDeathAction) return;
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
      baseFadeDur =
        Number.isFinite(Number(fadeDurSec)) && Number(fadeDurSec) >= 0.04
          ? Math.min(0.45, Number(fadeDurSec))
          : BASE_FADE_DUR;
      baseFadeTimer = baseFadeDur;
    } else {
      prevBase = null;
      prevBaseName = null;
      baseFadeTimer = 0;
      baseFadeDur = BASE_FADE_DUR;
    }

    next.setLoop(THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = false;
    if (!next.isRunning()) next.reset();
    next.stopFading();
    next.enabled = true;
    next.play();
    currentBase = next;
    currentBaseName = nextName;

    // If player starts running mid-swing during a stationary full-body attack (<clip>__Full),
    // smoothly hand off to its time-synced upper-body masked version so legs glide into Running_A__Lower
    // with zero discontinuity on the sword swing and strict wSum === 1.000 on every bone.
    if (
      attackUsesMask &&
      activeAttackAction &&
      nextName !== idleClipName &&
      isClipFullBodyAttack(activeAttackAction) &&
      findLowerAction(nextName)
    ) {
      const fullClip = activeAttackAction.getClip();
      const maskedName =
        fullClip?.userData?.maskedClipName || (fullClip?.name || '').replace(/__Full$/, '');
      const maskedAct = getAction(maskedName);
      const spd = Math.max(0.1, Math.abs(activeAttackAction.timeScale || 1));
      const dur = fullClip?.duration || 0.8;
      const remReal = Math.max(0, (dur - activeAttackAction.time) / spd);
      if (maskedAct && maskedAct !== activeAttackAction && remReal > 0.10) {
        stopActionClean(prevAttackAction);
        prevAttackAction = activeAttackAction;
        prevAttackStartWeight = Math.max(
          0.05,
          lastAttackWeight || activeAttackAction.getEffectiveWeight() || 0.5
        );
        prevAttackFadeDur = Math.min(RUN_HANDOFF_FADE_DUR, Math.max(0.05, remReal * 0.6));
        prevAttackFadeTimer = prevAttackFadeDur;

        maskedAct.stopFading();
        maskedAct.reset();
        maskedAct._fadingOut = false;
        maskedAct.setLoop(THREE.LoopOnce, 1);
        maskedAct.clampWhenFinished = true;
        maskedAct.time = Math.min(maskedAct.getClip()?.duration || dur, activeAttackAction.time);
        maskedAct.timeScale = activeAttackAction.timeScale;
        maskedAct.enabled = true;
        maskedAct.play();

        activeAttackAction = maskedAct;
        attackBlendInAge = 0;
        attackBlendInDur = prevAttackFadeDur;
      }
    }

    syncLayerWeights(0);
  }

  function triggerOneShot(clipName, speed = 1.5, blendInDur = null) {
    if (isDead || activeDeathAction) return;
    // Instant interruption: any attack immediately cancels an in-progress Door_Push, Turn_180, lingering roll recovery, or hit react!
    if (doorPushWanted || doorPushBlend > 0) {
      doorPushWanted = false;
      doorPushBlend = 0;
      if (doorPushAction) stopActionClean(doorPushAction);
    }
    if (activeRollAction) {
      stopActionClean(activeRollAction);
      activeRollAction = null;
      rollBlendInAge = 0;
    }
    if (activeTurnAction) {
      stopActionClean(activeTurnAction);
      activeTurnAction = null;
      turnBlendInAge = 0;
    }
    if (activeHitAction) {
      stopActionClean(activeHitAction);
      activeHitAction = null;
      hitBlendInAge = 0;
    }
    // Standing still ('Idle') -> prefer full-body attack clip (<clipName>__Full) for natural footwork/step-in!
    // Moving ('Running_A' / 'Running_Back') -> use upper-body masked clip over <base>__Lower.
    const isStationaryBase = !currentBaseName || currentBaseName === idleClipName;
    const fullAct = isStationaryBase ? getAction(`${clipName}__Full`) : null;
    const act = fullAct || getAction(clipName);
    if (!act) return;
    const usesManagedLayer =
      isClipFullBodyAttack(act) ||
      (isClipUpperMask(act) && Boolean(currentBaseName && findLowerAction(currentBaseName)));

    if (usesManagedLayer) {
      if (activeAttackAction && activeAttackAction !== act) {
        stopActionClean(prevAttackAction);
        prevAttackAction = activeAttackAction;
        prevAttackStartWeight = Math.max(0.05, lastAttackWeight || activeAttackAction.getEffectiveWeight() || 0.5);
        prevAttackFadeDur = PREV_ATTACK_FADE_DUR;
        prevAttackFadeTimer = PREV_ATTACK_FADE_DUR;
      } else {
        stopActionClean(prevAttackAction);
        prevAttackAction = null;
        prevAttackFadeDur = PREV_ATTACK_FADE_DUR;
        prevAttackFadeTimer = 0;
        prevAttackStartWeight = 0;
      }
      attackUsesMask = true;
      attackBlendInAge = 0;
      attackBlendInDur = 0.08;
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

    // Full-body non-masked one-shot path (Rift AAA enemies, Boss Troll combos, Mage, Gunslinger)
    // Seamless direct combo crossfade (prevAttackAction -> activeAttackAction) with strict sum(weights) === 1.000
    // and ZERO 1-frame dip back into Idle between chained swings!
    if (attackUsesMask) clearAttackMaskState();
    const explicitBlend = Number.isFinite(Number(blendInDur)) && Number(blendInDur) >= 0.01 ? Number(blendInDur) : null;
    if (activeAttackAction && activeAttackAction !== act) {
      const prevW = Math.max(0.05, lastAttackWeight || activeAttackAction.getEffectiveWeight() || 0.85);
      if (prevAttackAction && prevAttackAction !== activeAttackAction) {
        stopActionClean(prevAttackAction);
      }
      prevAttackAction = activeAttackAction;
      prevAttackStartWeight = Math.min(1.0, prevW);
      const comboFade = Math.max(0.06, Math.min(0.24, explicitBlend ?? LEGACY_COMBO_CROSSFADE_DUR));
      prevAttackFadeDur = comboFade;
      prevAttackFadeTimer = comboFade;
      legacyAtkInDur = comboFade;
    } else {
      stopActionClean(prevAttackAction);
      prevAttackAction = null;
      prevAttackFadeTimer = 0;
      prevAttackFadeDur = PREV_ATTACK_FADE_DUR;
      prevAttackStartWeight = 0;
      legacyAtkInDur = explicitBlend ?? LEGACY_ATK_IN_DUR;
    }
    act.stopFading();
    act.reset();
    act._fadingOut = false;
    act.setLoop(THREE.LoopOnce, 1);
    act.clampWhenFinished = true;
    act.timeScale = Math.max(0.1, Math.abs(Number(speed) || 1.0));
    act.enabled = true;
    act.paused = false;
    act.play();
    activeAttackAction = act;
    legacyAtkAge = 0;
    syncLayerWeights(0);
  }

  function cancelOneShot() {
    if (!activeAttackAction && !prevAttackAction) return;
    if (attackUsesMask) {
      if (activeAttackAction) {
        stopActionClean(activeAttackAction);
        activeAttackAction = null;
      }
      clearAttackMaskState();
    } else {
      if (activeAttackAction) {
        stopActionClean(activeAttackAction);
        activeAttackAction = null;
      }
      if (prevAttackAction) {
        stopActionClean(prevAttackAction);
        prevAttackAction = null;
      }
      prevAttackFadeTimer = 0;
      prevAttackFadeDur = PREV_ATTACK_FADE_DUR;
      prevAttackStartWeight = 0;
      lastAttackWeight = 0;
    }
    legacyAtkAge = 0;
    legacyAtkInDur = LEGACY_ATK_IN_DUR;
    if (!isDead && !activeDeathAction) {
      syncLayerWeights(0);
    }
  }

  function updateOneShotFade(dt = 0.016) {
    syncLayerWeights(dt);
  }

  function cancelHit() {
    if (!activeHitAction) return;
    stopActionClean(activeHitAction);
    activeHitAction = null;
    hitBlendInAge = 0;
    if (!isDead && !activeDeathAction) {
      syncLayerWeights(0);
    }
  }

  function isHitActive() {
    if (!activeHitAction) return false;
    const clip = activeHitAction.getClip?.();
    if (!clip || !activeHitAction.isRunning()) return false;
    const spd = Math.max(0.1, Math.abs(activeHitAction.timeScale || 1));
    return (clip.duration - activeHitAction.time) / spd > 0.004;
  }

  // Isolates a single outgoing pose action (clearing all other base/attack/hit layers)
  // so external clamped sequences (Throne_StandUp, Roar_Taunt, Stagger_Kneel -> Stagger_Recover)
  // cross-fade cleanly with strict sum(weights) === 1.000 and zero leftover Walking/Attack leaks!
  function prepareExternalClip(targetAct, preferredFromAct = null) {
    if (isDead || activeDeathAction) return null;
    let sourceAct =
      preferredFromAct && preferredFromAct !== targetAct && preferredFromAct.isScheduled?.()
        ? preferredFromAct
        : null;
    if (!sourceAct) {
      let bestW = 0;
      for (const act of actions.values()) {
        if (!act || act === targetAct || !act.enabled || !act.isScheduled?.()) continue;
        const w = act.getEffectiveWeight?.() ?? 0;
        if (w > bestW) {
          bestW = w;
          sourceAct = act;
        }
      }
    }
    stopAllNonDeathActions(sourceAct);
    if (sourceAct) {
      sourceAct.stopFading();
      sourceAct.enabled = true;
      sourceAct.setEffectiveWeight(1.0);
    }
    return sourceAct;
  }

  function handoffExternalClipToBase(fromAct, targetBaseName = idleClipName, timeScale = 1.0, blendOutSec = 0.16) {
    if (isDead || activeDeathAction) return false;
    const next = getAction(targetBaseName) || getAction(idleClipName);
    if (!next) return false;
    const nextName = (next.getClip()?.name || targetBaseName || idleClipName).replace(/\.\d+$/, '');
    const keepSource =
      fromAct && fromAct !== next && fromAct.isScheduled?.() && (fromAct.getEffectiveWeight?.() ?? 0) > 0.005
        ? fromAct
        : null;

    stopAllNonDeathActions(keepSource);

    next.stopFading();
    next.reset();
    next.setLoop(THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = false;
    next.timeScale = Math.max(0.01, Number(timeScale) || 1.0);
    next.enabled = true;
    next.paused = false;
    next.play();

    currentBase = next;
    currentBaseName = nextName;
    if (keepSource) {
      keepSource.stopFading();
      keepSource.enabled = true;
      prevBase = keepSource;
      prevBaseName = (keepSource.getClip()?.name || '').replace(/\.\d+$/, '');
      baseFadeDur = Math.max(0.06, Math.min(0.45, Number(blendOutSec) || 0.16));
      baseFadeTimer = baseFadeDur;
    } else {
      prevBase = null;
      prevBaseName = null;
      baseFadeTimer = 0;
      baseFadeDur = BASE_FADE_DUR;
    }
    syncLayerWeights(0);
    return true;
  }

  function triggerHit(speed = 1.85, clipName = null, opts = null) {
    if (isDead || activeDeathAction || activeRollAction || doorPushWanted) return false;
    const blockGuard = opts?.blockGuard !== false;
    if (blockGuard && blockWanted) return false;

    const act =
      (typeof clipName === 'string' && clipName ? getAction(clipName) : null) ||
      getAction('Hit_React') ||
      getAction('Impact') ||
      getAction('Hit_A') ||
      getAction('Hit_B');
    if (!act) return false;

    const interruptAttack = Boolean(opts?.interruptAttack);
    if (activeAttackAction) {
      if (!interruptAttack) return false;
      clearAttackMaskState();
      stopActionClean(activeAttackAction);
      activeAttackAction = null;
      legacyAtkAge = 0;
    }

    if (activeTurnAction) {
      stopActionClean(activeTurnAction);
      activeTurnAction = null;
      turnBlendInAge = 0;
    }
    if (activeHitAction && activeHitAction !== act) {
      stopActionClean(activeHitAction);
    }

    const safeSpeed = Math.max(0.2, Math.abs(Number(speed) || 1.85));
    act.stopFading();
    act.reset();
    act._fadingOut = false;
    act.setLoop(THREE.LoopOnce, 1);
    act.clampWhenFinished = true;
    act.timeScale = safeSpeed;
    act.enabled = true;
    act.paused = false;
    act.play();
    activeHitAction = act;
    hitBlendInAge = 0;
    hitBlendInDur = Math.max(0.015, Number(opts?.blendInSec) || 0.036);
    hitBlendOutDur = Math.max(0.03, Number(opts?.blendOutSec) || 0.085);
    hitMaxWeight = Math.max(0.1, Math.min(1.0, Number(opts?.maxWeight) || 1.0));
    syncLayerWeights(0);
    return true;
  }

  function getDeathClipDuration(speed = 1.25) {
    const act =
      getAction('Death_Collapse') ||
      getAction('Death_A') ||
      getAction('Death_B') ||
      getAction('Skeletons_Death_Resurrect');
    const dur = act?.getClip?.()?.duration || 0;
    if (!(dur > 0)) return 0;
    const safeSpeed = Math.max(0.1, Math.abs(Number(speed) || 1.0));
    return dur / safeSpeed;
  }

  function triggerDeath(speed = 1.48) {
    const act =
      getAction('Death_Collapse') ||
      getAction('Death_A') ||
      getAction('Death_B') ||
      getAction('Skeletons_Death_Resurrect');
    if (!act) return false;
    const safeSpeed = Math.max(0.1, Math.abs(Number(speed) || 1.0));
    isDead = true;
    stopAllNonDeathActions(act);
    act.stopFading();
    act.reset();
    act._fadingOut = false;
    act.setLoop(THREE.LoopOnce, 1);
    act.clampWhenFinished = true;
    act.timeScale = safeSpeed;
    act.enabled = true;
    act.paused = false;
    act.setEffectiveWeight(1.0);
    act.play();
    activeDeathAction = act;
    mixer.update(0);
    return true;
  }

  function resetAlive() {
    isDead = false;
    if (activeDeathAction) {
      stopActionClean(activeDeathAction);
      activeDeathAction = null;
    }
    stopAllNonDeathActions(null);
    setBaseState(idleClipName, 1.0);
    mixer.update(0.016);
  }

  function setDeadState(dead, speed = 1.25) {
    if (!dead) {
      resetAlive();
      return 0;
    }
    if (isDead && activeDeathAction) {
      const clip = activeDeathAction.getClip?.();
      const spd = Math.max(0.1, Math.abs(activeDeathAction.timeScale || speed || 1.0));
      return clip?.duration ? clip.duration / spd : 0;
    }
    isDead = true;
    if (triggerDeath(speed) && activeDeathAction) {
      const clip = activeDeathAction.getClip?.();
      const spd = Math.max(0.1, Math.abs(activeDeathAction.timeScale || speed || 1.0));
      return clip?.duration ? clip.duration / spd : 0;
    }
    // No death clip on this rig: freeze Idle pose cleanly (weight 1, paused) so procedural fall has zero T-pose
    const idleAct = getAction(idleClipName);
    stopAllNonDeathActions(idleAct);
    if (idleAct) {
      idleAct.stopFading();
      idleAct.enabled = true;
      idleAct.paused = true;
      idleAct.setEffectiveWeight(1.0);
      currentBase = idleAct;
      currentBaseName = idleClipName;
    }
    return 0;
  }

  function syncPhase(clipName, phase01 = 0) {
    if (isDead || activeDeathAction) return false;
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
  function getActiveAttackProgress01() {
    if (!activeAttackAction || !activeAttackAction.isRunning()) return 0;
    const clip = activeAttackAction.getClip?.();
    const dur = clip?.duration || 0;
    if (!(dur > 1e-4)) return 0;
    return Math.max(0, Math.min(1, activeAttackAction.time / dur));
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
  function isDeadState() {
    return isDead || Boolean(activeDeathAction);
  }
  return {
    mixer,
    setBaseState,
    setBlockState,
    setDoorPushState,
    isDoorPushActive,
    setDeadState,
    isDeadState,
    getDeathClipDuration,
    syncPhase,
    getAction,
    getActiveTime,
    getActiveAttackClipName,
    getActiveAttackProgress01,
    getOneShotRemainingSec,
    isOneShotActive,
    updateOneShotFade,
    triggerOneShot,
    cancelOneShot,
    triggerTurn180,
    cancelTurn180,
    isTurn180Active,
    getTurn180Progress,
    triggerRoll,
    cancelRoll,
    isRollActive,
    triggerHit,
    cancelHit,
    isHitActive,
    prepareExternalClip,
    handoffExternalClipToBase,
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
