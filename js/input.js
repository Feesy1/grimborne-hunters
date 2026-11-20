// Unified PC (Mouse/Keyboard/Pointer Lock) + Mobile Touch Input Controller
// Supports rising-edge 0ms Roll, Heavy/Charged R2 ([F] / Shift+LMB / Touch R2),
// Block/Parry (Mouse 4 / RMB / Touch Hold), Target Lock-On ([Q] / MMB / Touch),
// and deterministic sub-step edge clearing for 30/60/144 FPS parity.

export function createInputController({
  canvas,
  isPlaying,
  isHub,
  isPaused,
  isSoulsRunActive,
  isPointerLocked,
  requestPointerLock,
  exitPointerLock,
  isDevEditorEnabled,
  world,
  audio,
  callbacks = {}
}) {
  const keysDown = new Set();

  const isTouchOnly = () =>
    typeof window !== 'undefined' &&
    Boolean(
      window.matchMedia?.('(pointer: coarse)')?.matches &&
      !window.matchMedia?.('(any-pointer: fine)')?.matches
    );

  let inputSource = isTouchOnly() ? 'touch' : 'mouse_kb';
  let pointerClientX = typeof window !== 'undefined' ? window.innerWidth * 0.5 : 640;
  let pointerClientY = typeof window !== 'undefined' ? window.innerHeight * 0.5 : 360;
  let pointerFiring = false;
  let pointerClickQueued = false;
  let pointerMovedRecently = 0;

  let reloadRequested = false;
  let dashRequested = false;
  let ultRequested = false;
  let flaskRequested = false;
  let interactRequested = false;
  let heavyRequested = false;
  let heavyKeyHeld = false;
  let heavyMouseHeld = false;

  let rmbOrbitingCamera = false;
  let lastCombatOrbitX = 0;
  let lastCombatOrbitY = 0;
  let rmbBlockingSouls = false;
  let mouse4BlockingSouls = false;
  let lastAttackHeld = false;

  const setInputSource = (nextSrc) => {
    if (nextSrc === 'touch' || nextSrc === 'mouse_kb') {
      inputSource = nextSrc;
    }
  };

  const resetCombatInputs = () => {
    reloadRequested = false;
    dashRequested = false;
    ultRequested = false;
    flaskRequested = false;
    interactRequested = false;
    heavyRequested = false;
    heavyKeyHeld = false;
    heavyMouseHeld = false;
    pointerFiring = false;
    pointerClickQueued = false;
    rmbOrbitingCamera = false;
    rmbBlockingSouls = false;
    mouse4BlockingSouls = false;
  };

  const resetAllInputs = () => {
    keysDown.clear();
    resetCombatInputs();
  };

  // === Layout-independent Keyboard Input (works on both RU ЙЦУКЕН and EN QWERTY) ===
  window.addEventListener('keydown', (e) => {
    setInputSource('mouse_kb');
    if (e.code === 'KeyK' && !e.repeat) {
      if (!isDevEditorEnabled?.() && !world.isWeaponEditMode?.()) return;
      world.setWeaponEditMode?.(!world.isWeaponEditMode?.());
      return;
    }
    if (e.code === 'KeyG' && !isDevEditorEnabled?.()) {
      return;
    }
    if (world.isWeaponEditMode?.()) return;
    if (world.isArenaEditMode?.()) {
      if (!world.isArenaEditorHeroMovement?.()) return;
      const moveKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (!moveKeys.includes(e.code)) return;
    }

    keysDown.add(e.code);
    const playing = Boolean(isPlaying?.());
    const paused = Boolean(isPaused?.());
    const soulsActive = Boolean(isSoulsRunActive?.());

    if ((e.code === 'AltLeft' || e.code === 'AltRight') && playing) {
      e.preventDefault();
      audio?.unlock?.();
      if (soulsActive && !e.repeat) {
        // Rising-edge 0ms Roll on Alt in Abandoned Knight Rift
        dashRequested = true;
      }
    }
    if (e.code === 'Space' && playing && !e.repeat) {
      e.preventDefault();
      audio?.unlock?.();
      dashRequested = true;
    }
    if (e.code === 'KeyF' && playing) {
      e.preventDefault();
      audio?.unlock?.();
      if (soulsActive) {
        if (!e.repeat) {
          heavyRequested = true;
        }
        heavyKeyHeld = true;
      } else if (!e.repeat) {
        ultRequested = true;
      }
    }
    if (e.code === 'KeyR' && playing && !e.repeat) {
      audio?.unlock?.();
      if (soulsActive) {
        flaskRequested = true;
      } else {
        callbacks.onManualReload?.();
        reloadRequested = true;
      }
    }
    if (e.code === 'KeyQ' && playing && !e.repeat) {
      if (soulsActive) {
        e.preventDefault();
        callbacks.onToggleTargetLock?.();
      } else {
        callbacks.onToggleAutoAimHotkey?.();
      }
    }
    if (e.code === 'Tab' && playing && soulsActive) {
      e.preventDefault();
      if (!e.repeat) {
        callbacks.onCycleTargetLock?.(1);
      }
    }
    if (e.code === 'KeyE' && playing && !e.repeat) {
      if (soulsActive) {
        e.preventDefault();
        audio?.unlock?.();
        interactRequested = true;
      } else {
        callbacks.onToggleAttackHotkey?.();
      }
    }
    if ((e.code === 'Escape' || e.code === 'KeyP') && (playing || paused) && !e.repeat) {
      e.preventDefault();
      callbacks.onTogglePause?.();
    }
    if ((e.code === 'Digit9' || e.code === 'Numpad9') && (playing || paused) && !e.repeat) {
      const targetTag = (e.target?.tagName || '').toUpperCase();
      if (targetTag !== 'INPUT' && targetTag !== 'TEXTAREA' && !e.target?.isContentEditable) {
        e.preventDefault();
        callbacks.onToggleTelegraphs?.();
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    if ((e.code === 'AltLeft' || e.code === 'AltRight') && isPlaying?.()) {
      e.preventDefault();
    }
    if (e.code === 'KeyF') {
      heavyKeyHeld = false;
    }
    keysDown.delete(e.code);
  });

  window.addEventListener('blur', () => {
    resetAllInputs();
    exitPointerLock?.();
    callbacks.onWindowBlur?.();
  });

  // Suppress browser context menu on Right-Click in Hub (hero turntable) and in Abandoned Knight Rift (RMB block)
  window.addEventListener('contextmenu', (e) => {
    if (isPlaying?.() && isSoulsRunActive?.()) {
      e.preventDefault();
      return;
    }
    if (!isHub?.()) return;
    if (e.target && typeof e.target.closest === 'function' && e.target.closest('.sound-trigger-btn')) {
      return;
    }
    e.preventDefault();
  });

  window.addEventListener(
    'wheel',
    (e) => {
      if (!isPlaying?.()) return;
      if (
        e.target &&
        typeof e.target.closest === 'function' &&
        e.target.closest('.modal-backdrop:not(.hidden), .sound-popover:not(.hidden)')
      ) {
        return;
      }
      e.preventDefault();
      world.zoomCombatOrbit?.(e.deltaY);
    },
    { passive: false }
  );

  // Mouse 4 (button === 3) raises Shield Block/Parry strictly in Abandoned Knight Rift & blocks browser Back nav
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType === 'touch') {
        setInputSource('touch');
        return;
      }
      setInputSource('mouse_kb');
      if (e.button === 3 && isPlaying?.() && isSoulsRunActive?.()) {
        e.preventDefault();
        e.stopPropagation();
        audio?.unlock?.();
        mouse4BlockingSouls = true;
      }
    },
    { capture: true }
  );

  window.addEventListener(
    'touchstart',
    () => {
      setInputSource('touch');
    },
    { passive: true }
  );

  // Middle mouse button toggles Target Lock-On; Mouse 4 blocks/parries — strictly in Abandoned Knight Rift
  window.addEventListener('mousedown', (e) => {
    if (!isPlaying?.() || !isSoulsRunActive?.()) return;
    if (e.button === 3) {
      e.preventDefault();
      e.stopPropagation();
      audio?.unlock?.();
      mouse4BlockingSouls = true;
      return;
    }
    if (e.button !== 1) return;
    if (
      e.target &&
      typeof e.target.closest === 'function' &&
      e.target.closest('button, input, a, .modal-backdrop:not(.hidden), .sound-popover:not(.hidden)')
    ) {
      return;
    }
    e.preventDefault();
    callbacks.onToggleTargetLock?.();
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button === 3) {
      if (isPlaying?.() && isSoulsRunActive?.()) {
        e.preventDefault();
        e.stopPropagation();
      }
      mouse4BlockingSouls = false;
    }
  });

  window.addEventListener('auxclick', (e) => {
    if ((e.button === 1 || e.button === 3) && isPlaying?.() && isSoulsRunActive?.()) {
      e.preventDefault();
      e.stopPropagation();
    }
  });

  // Free-look 360° mouse camera strictly inside Abandoned Knight Rift while Pointer Lock is active
  window.addEventListener('mousemove', (e) => {
    if (!canvas || document.pointerLockElement !== canvas) return;
    if (!isSoulsRunActive?.() || !isPlaying?.()) return;
    setInputSource('mouse_kb');
    const mx = Math.max(-140, Math.min(140, Number(e.movementX) || 0));
    const my = Math.max(-140, Math.min(140, Number(e.movementY) || 0));
    if (mx !== 0 || my !== 0) {
      world.applyFreeLookDelta?.(mx, my);
    }
  });

  if (canvas) {
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      setInputSource('mouse_kb');
      if (rmbOrbitingCamera && isPlaying?.()) {
        if (typeof e.buttons === 'number' && (e.buttons & 2) === 0) {
          rmbOrbitingCamera = false;
        } else {
          const mapped = window.__toGameCoords
            ? window.__toGameCoords(e.clientX, e.clientY)
            : { x: e.clientX, y: e.clientY };
          const dx = mapped.x - lastCombatOrbitX;
          const dy = mapped.y - lastCombatOrbitY;
          lastCombatOrbitX = mapped.x;
          lastCombatOrbitY = mapped.y;
          world.adjustCombatOrbit?.(-dx * 0.0068, dy * 0.0056);
        }
      }
      pointerClientX = e.clientX;
      pointerClientY = e.clientY;
      pointerMovedRecently = 2.5;
    });

    canvas.addEventListener('pointerdown', (e) => {
      audio?.unlock?.();
      if (e.pointerType === 'touch') {
        setInputSource('touch');
        return;
      }
      setInputSource('mouse_kb');
      const playing = Boolean(isPlaying?.());
      const soulsActive = Boolean(isSoulsRunActive?.());
      const inSoulsCombat = playing && soulsActive && !world.isArenaEditMode?.() && !world.isWeaponEditMode?.();

      if (inSoulsCombat && e.button === 1) {
        e.preventDefault();
        return;
      }
      if (inSoulsCombat && e.button === 3) {
        e.preventDefault();
        e.stopPropagation();
        mouse4BlockingSouls = true;
        return;
      }
      if (inSoulsCombat && !isPointerLocked?.() && (e.button === 0 || e.button === 2)) {
        requestPointerLock?.();
      }
      if (e.button === 2 && playing) {
        e.preventDefault();
        if (inSoulsCombat) {
          rmbBlockingSouls = true;
          return;
        }
        const mapped = window.__toGameCoords
          ? window.__toGameCoords(e.clientX, e.clientY)
          : { x: e.clientX, y: e.clientY };
        rmbOrbitingCamera = true;
        lastCombatOrbitX = mapped.x;
        lastCombatOrbitY = mapped.y;
        return;
      }
      if (e.button === 0 && playing && !world.isArenaEditMode?.() && !world.isWeaponEditMode?.()) {
        pointerClientX = e.clientX;
        pointerClientY = e.clientY;
        const shiftHeavy = inSoulsCombat && (e.shiftKey || keysDown.has('ShiftLeft') || keysDown.has('ShiftRight'));
        if (shiftHeavy) {
          heavyRequested = true;
          heavyMouseHeld = true;
        } else {
          pointerFiring = true;
          pointerClickQueued = true;
        }
      }
    });
  }

  const endCombatPointer = (e) => {
    if (e.pointerType === 'touch') return;
    if (e.type === 'pointercancel') {
      rmbOrbitingCamera = false;
      rmbBlockingSouls = false;
      mouse4BlockingSouls = false;
      pointerFiring = false;
      heavyMouseHeld = false;
      return;
    }
    if (e.button === 3) {
      if (isPlaying?.() && isSoulsRunActive?.()) {
        e.preventDefault();
        e.stopPropagation();
      }
      mouse4BlockingSouls = false;
    }
    if (e.button === 2) {
      rmbOrbitingCamera = false;
      rmbBlockingSouls = false;
    }
    if (e.button === 0) {
      pointerFiring = false;
      heavyMouseHeld = false;
    }
  };
  window.addEventListener('pointerup', endCombatPointer);
  window.addEventListener('pointercancel', endCombatPointer);

  function gatherFrameInput({ dt, touch, combat, ui }) {
    const soulsActive = Boolean(isSoulsRunActive?.());

    // Drain any accumulated 1-finger touch camera swipe delta (strictly in Abandoned Knight Rift)
    if (touch && (touch.camDx || touch.camDy)) {
      const cdx = Number(touch.camDx) || 0;
      const cdy = Number(touch.camDy) || 0;
      touch.camDx = 0;
      touch.camDy = 0;
      if (soulsActive && (cdx !== 0 || cdy !== 0)) {
        setInputSource('touch');
        world.applyFreeLookDelta?.(cdx, cdy);
      }
    }

    if (world.isWeaponEditMode?.()) {
      dashRequested = false;
      ultRequested = false;
      heavyRequested = false;
      if (touch) {
        touch.dash = false;
        touch.ult = false;
        touch.attackTrigger = false;
        touch.heavyTrigger = false;
      }
      return {
        moveX: 0,
        moveZ: 0,
        cameraYaw: world.getCombatOrbitYaw?.() ?? 0,
        aimWorldX: 0,
        aimWorldZ: 0,
        hasManualAim: false,
        firing: false,
        manualTrigger: false,
        heavyTrigger: false,
        heavyHeld: false,
        sprint: false,
        reload: false,
        dash: false,
        ult: false,
        block: false,
        flask: false,
        inputSource
      };
    }

    if (world.isArenaEditMode?.() && !world.isArenaEditorHeroMovement?.()) {
      dashRequested = false;
      ultRequested = false;
      flaskRequested = false;
      heavyRequested = false;
      if (touch) {
        touch.dash = false;
        touch.ult = false;
        touch.flask = false;
        touch.attackTrigger = false;
        touch.heavyTrigger = false;
      }
      return {
        moveX: 0,
        moveZ: 0,
        cameraYaw: world.getCombatOrbitYaw?.() ?? 0,
        aimWorldX: 0,
        aimWorldZ: 0,
        hasManualAim: false,
        firing: false,
        manualTrigger: false,
        heavyTrigger: false,
        heavyHeld: false,
        sprint: false,
        reload: false,
        dash: false,
        ult: false,
        block: false,
        flask: false,
        inputSource
      };
    }

    let moveX = 0;
    let moveZ = 0;

    if (keysDown.has('KeyW') || keysDown.has('ArrowUp')) moveZ -= 1;
    if (keysDown.has('KeyS') || keysDown.has('ArrowDown')) moveZ += 1;
    if (keysDown.has('KeyA') || keysDown.has('ArrowLeft')) moveX -= 1;
    if (keysDown.has('KeyD') || keysDown.has('ArrowRight')) moveX += 1;

    if (touch?.moveActive) {
      setInputSource('touch');
      moveX = touch.moveX;
      moveZ = touch.moveZ;
      // Never toggle PvE auto-aim inside Abandoned Knight Rift
      if (!soulsActive && !combat.getAutoAim()) {
        combat.setAutoAim(true);
        ui.setAutoAimState(true);
      }
    } else {
      const len = Math.hypot(moveX, moveZ);
      if (len > 1) {
        moveX /= len;
        moveZ /= len;
      }
    }

    const camYaw = world.getCombatOrbitYaw?.() ?? 0;
    if (Math.abs(camYaw) > 0.0001 && (moveX !== 0 || moveZ !== 0)) {
      const cosY = Math.cos(camYaw);
      const sinY = Math.sin(camYaw);
      const rx = moveX * cosY + moveZ * sinY;
      const rz = -moveX * sinY + moveZ * cosY;
      moveX = rx;
      moveZ = rz;
    }

    if (pointerMovedRecently > 0) {
      pointerMovedRecently = Math.max(0, pointerMovedRecently - dt);
    }

    let aimWorldX = 0;
    let aimWorldZ = 0;
    let hasManualAim = false;
    let firing = false;

    const touchAttackTrigger = Boolean(touch?.attackTrigger);
    const touchAttackHeld = Boolean(touch?.attackHeld);
    if (touch && touch.attackTrigger) touch.attackTrigger = false;
    if (touchAttackTrigger || touchAttackHeld) setInputSource('touch');

    const touchHeavyTrigger = Boolean(touch?.heavyTrigger);
    const touchHeavyHeld = Boolean(touch?.heavyHeld);
    if (touch && touch.heavyTrigger) touch.heavyTrigger = false;
    if (touchHeavyTrigger || touchHeavyHeld) setInputSource('touch');

    const explicitLmb = !touch?.moveActive && (pointerFiring || pointerClickQueued);
    pointerClickQueued = false;

    const manualTrigger = soulsActive
      ? Boolean(explicitLmb || touchAttackTrigger || touchAttackHeld)
      : Boolean(explicitLmb);
    lastAttackHeld = soulsActive
      ? Boolean((!touch?.moveActive && pointerFiring) || touchAttackHeld)
      : Boolean(!touch?.moveActive && pointerFiring);

    if (soulsActive) {
      firing = manualTrigger;
      hasManualAim = false;
    } else if (!touch?.moveActive && (explicitLmb || (!combat.getAutoAim() && pointerMovedRecently > 0))) {
      const groundPt = world.getAimPointOnGround(pointerClientX, pointerClientY);
      if (groundPt) {
        aimWorldX = groundPt.x;
        aimWorldZ = groundPt.z;
        hasManualAim = true;
      }
      firing = explicitLmb || !combat.getAutoAim();
    }

    const heavyTrigger = soulsActive ? Boolean(heavyRequested || touchHeavyTrigger) : false;
    heavyRequested = false;
    const heavyHeld = soulsActive ? Boolean(heavyKeyHeld || heavyMouseHeld || touchHeavyHeld) : false;

    const reload = reloadRequested;
    reloadRequested = false;

    const touchDash = Boolean(touch?.dash);
    if (touch && touch.dash) touch.dash = false;
    if (touchDash) setInputSource('touch');
    const dash = dashRequested || touchDash;
    dashRequested = false;

    const touchUlt = Boolean(touch?.ult);
    if (touch && touch.ult) touch.ult = false;
    const ult = !soulsActive && (ultRequested || touchUlt);
    ultRequested = false;

    if (touch?.block) setInputSource('touch');
    const block = soulsActive
      ? Boolean(mouse4BlockingSouls || rmbBlockingSouls || touch?.block)
      : Boolean(keysDown.has('AltLeft') || keysDown.has('AltRight') || touch?.block);

    const touchFlask = Boolean(touch?.flask);
    if (touch && touch.flask) touch.flask = false;
    if (touchFlask) setInputSource('touch');
    const flask = flaskRequested || touchFlask;
    flaskRequested = false;

    const touchInteract = Boolean(touch?.interact);
    if (touch && touch.interact) touch.interact = false;
    if (touchInteract) setInputSource('touch');
    const interact = soulsActive ? Boolean(interactRequested || touchInteract) : false;
    interactRequested = false;

    const touchSprint = Boolean(touch?.sprint);
    const sprint = keysDown.has('ShiftLeft') || keysDown.has('ShiftRight') || touchSprint;

    return {
      moveX,
      moveZ,
      cameraYaw: camYaw,
      aimWorldX,
      aimWorldZ,
      hasManualAim,
      firing,
      manualTrigger,
      heavyTrigger,
      heavyHeld,
      sprint,
      reload,
      dash,
      ult,
      block,
      flask,
      interact,
      inputSource
    };
  }

  // Clear one-shot edge triggers after sub-step 0 so 30 FPS multi-substep never double-fires actions
  function clearSubStepEdgeTriggers(frameInput) {
    if (!frameInput) return;
    frameInput.dash = false;
    frameInput.heavyTrigger = false;
    frameInput.reload = false;
    frameInput.ult = false;
    frameInput.flask = false;
    frameInput.interact = false;
    frameInput.manualTrigger = lastAttackHeld;
    if (isSoulsRunActive?.()) {
      frameInput.firing = lastAttackHeld;
    }
  }

  return {
    keysDown,
    getInputSource: () => inputSource,
    setInputSource,
    requestReload: () => {
      reloadRequested = true;
    },
    requestDash: () => {
      dashRequested = true;
    },
    requestFlask: () => {
      flaskRequested = true;
    },
    requestInteract: () => {
      interactRequested = true;
    },
    clearBlockingFlags: () => {
      rmbBlockingSouls = false;
      mouse4BlockingSouls = false;
    },
    resetCombatInputs,
    resetAllInputs,
    gatherFrameInput,
    clearSubStepEdgeTriggers
  };
}
