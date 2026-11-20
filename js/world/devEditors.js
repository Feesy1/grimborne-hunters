// Lazy-loaded Dev-only 3D Editors: Arena Prop Editor (G) & Weapon Placement Editor (K).
// Extracted from js/world.js (Wave 2 modular split). Loaded dynamically ONLY when
// dev mode is active (?dev=1 or localStorage.grimborne_dev === '1').

import * as THREE from '../../vendor/three.module.js';

export const WEAPON_LAYOUT_KEY = 'grimborne_weapon_layout_v1';

export function createWorldDevEditors(ctx) {
  const {
    scene,
    camera,
    renderer,
    getMistyArena,
    ensureMistyArena,
    isDevModeEnabled,
    isMistyBiome,
    syncMistyObstacles,
    getCameraLocked,
    setCameraLock,
    getOrbitState,
    setCameraPreset,
    getActiveCameraPreset,
    orbitCamera,
    zoomCamera,
    getTargetPos,
    loadWeaponLayout,
    getHeroMovement,
    setHeroMovement
  } = ctx;

  // --- Weapon placement editor (K) ----------------------------------------
  let weaponEditMode = false;
  let weaponEditorPrevCameraLocked = null;
  let weaponSelected = null;        // the THREE.Object3D mount group
  let weaponDragging = false;
  let weaponCameraOrbiting = false;
  let weaponLastX = 0;
  let weaponLastY = 0;
  const weaponPointer = new THREE.Vector2();
  const weaponRaycaster = new THREE.Raycaster();
  const weaponDragPlane = new THREE.Plane();
  const weaponHit = new THREE.Vector3();
  const weaponDragOffset = new THREE.Vector3();
  let weaponHint = null;

  // --- Arena prop placement editor (G) ------------------------------------
  const arenaRaycaster = new THREE.Raycaster();
  const arenaPointer = new THREE.Vector2();
  const arenaGroundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const arenaHitPoint = new THREE.Vector3();
  let arenaEditMode = false;
  let arenaEditorPrevCameraLocked = null;
  let arenaEditorSavedOrbit = null;
  let arenaSelected = null;
  let arenaDragging = false;
  const arenaDragOffset = new THREE.Vector3();
  let arenaCameraOrbiting = false;
  let arenaLastOrbitX = 0;
  let arenaLastOrbitY = 0;
  let arenaEditHint = null;
  let arenaEditorHintText = null;
  let arenaEditorPanel = null;

  const arenaSelectionRing = new THREE.Mesh(
    new THREE.RingGeometry(0.85, 1.0, 40),
    new THREE.MeshBasicMaterial({
      color: 0xffd24a,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  );
  arenaSelectionRing.rotation.x = -Math.PI / 2;
  arenaSelectionRing.position.y = 0.06;
  arenaSelectionRing.visible = false;
  scene.add(arenaSelectionRing);

  // ---- weapon editor helpers ---------------------------------------------
  function findWeaponMounts() {
    const found = [];
    scene.traverse((o) => {
      if (o.name === 'HeroWeapon_Sword_Mount' || o.name === 'HeroWeapon_Shield_Mount') found.push(o);
    });
    return found;
  }

  function setWeaponPointer(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    weaponPointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    weaponPointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    weaponRaycaster.setFromCamera(weaponPointer, camera);
  }

  function saveWeaponLayout() {
    try {
      const data = findWeaponMounts().map((o) => ({
        name: o.name,
        p: [o.position.x, o.position.y, o.position.z].map((v) => +v.toFixed(4)),
        r: [o.rotation.x, o.rotation.y, o.rotation.z].map((v) => +v.toFixed(4)),
        s: +o.scale.x.toFixed(4)
      }));
      localStorage.setItem(WEAPON_LAYOUT_KEY, JSON.stringify(data));
      console.log('[weapon] layout saved:', data);
    } catch (e) {
      console.warn('[weapon] save failed', e);
    }
  }

  function onWeaponPointerDown(e) {
    if (!weaponEditMode || e.button !== 0) return;
    setWeaponPointer(e);
    const mounts = findWeaponMounts();
    const hits = weaponRaycaster.intersectObjects(mounts, true);
    for (const hit of hits) {
      let obj = hit.object;
      while (obj && !mounts.includes(obj)) obj = obj.parent;
      if (!obj) continue;
      weaponSelected = obj;
      weaponDragging = true;
      // Drag on a plane facing the camera, passing through the object.
      const n = new THREE.Vector3();
      camera.getWorldDirection(n);
      weaponDragPlane.setFromNormalAndCoplanarPoint(n, obj.getWorldPosition(new THREE.Vector3()));
      if (weaponRaycaster.ray.intersectPlane(weaponDragPlane, weaponHit)) {
        const local = obj.parent.worldToLocal(weaponHit.clone());
        weaponDragOffset.set(obj.position.x - local.x, obj.position.y - local.y, obj.position.z - local.z);
      } else {
        weaponDragOffset.set(0, 0, 0);
      }
      try { renderer.domElement.setPointerCapture(e.pointerId); } catch {}
      if (weaponHint) {
        weaponHint.textContent =
          'ОРУЖИЕ • ' +
          (obj.name.includes('Sword') ? 'МЕЧ' : 'ЩИТ') +
          ' • тащи мышью • Z/X/Q/E/C/V — поворот • K — выход';
      }
      e.preventDefault();
      return;
    }
    weaponSelected = null;
    weaponCameraOrbiting = true;
    weaponLastX = e.clientX;
    weaponLastY = e.clientY;
    e.preventDefault();
  }

  function onWeaponPointerMove(e) {
    if (!weaponEditMode) return;
    if (weaponCameraOrbiting) {
      orbitCamera(-(e.clientX - weaponLastX) * 0.005, -(e.clientY - weaponLastY) * 0.005);
      weaponLastX = e.clientX;
      weaponLastY = e.clientY;
      return;
    }
    if (!weaponDragging || !weaponSelected) return;
    setWeaponPointer(e);
    if (weaponRaycaster.ray.intersectPlane(weaponDragPlane, weaponHit)) {
      const local = weaponSelected.parent.worldToLocal(weaponHit.clone());
      weaponSelected.position.set(
        local.x + weaponDragOffset.x,
        local.y + weaponDragOffset.y,
        local.z + weaponDragOffset.z
      );
    }
  }

  function onWeaponWheel(e) {
    if (!weaponEditMode) return;
    e.preventDefault();
    zoomCamera(Math.sign(e.deltaY) * 1.6);
  }

  function onWeaponPointerUp(e) {
    try { if (e?.pointerId !== undefined) renderer.domElement.releasePointerCapture(e.pointerId); } catch {}
    if (weaponDragging && weaponSelected) saveWeaponLayout();
    weaponDragging = false;
    weaponCameraOrbiting = false;
  }

  function onWeaponKeyDown(e) {
    if (!weaponEditMode) return;
    if (e.code === 'KeyK') {
      setWeaponEditMode(false);
      return;
    }
    if (!weaponSelected) return;
    const step = 0.08;
    if (e.code === 'KeyZ') weaponSelected.rotation.y -= step;
    else if (e.code === 'KeyX') weaponSelected.rotation.y += step;
    else if (e.code === 'KeyQ') weaponSelected.rotation.x -= step;
    else if (e.code === 'KeyE') weaponSelected.rotation.x += step;
    else if (e.code === 'KeyC') weaponSelected.rotation.z -= step;
    else if (e.code === 'KeyV') weaponSelected.rotation.z += step;
    else return;
    e.preventDefault();
    saveWeaponLayout();
  }

  function setWeaponEditMode(enabled = true) {
    const next = Boolean(enabled);
    if (next && !isDevModeEnabled()) return;
    if (next === weaponEditMode) return;
    weaponEditMode = next;
    const dom = renderer.domElement;
    if (weaponEditMode) {
      weaponEditorPrevCameraLocked = getCameraLocked();
      dom.addEventListener('pointerdown', onWeaponPointerDown);
      window.addEventListener('pointermove', onWeaponPointerMove);
      window.addEventListener('pointerup', onWeaponPointerUp);
      window.addEventListener('keydown', onWeaponKeyDown);
      dom.addEventListener('wheel', onWeaponWheel, { passive: false });
      setCameraLock(true);
      if (!weaponHint) {
        weaponHint = document.createElement('div');
        weaponHint.style.cssText =
          'position:fixed;bottom:8px;left:50%;transform:translateX(-50%);z-index:99999;background:rgba(20,12,30,.94);color:#7dd3fc;padding:8px 16px;border:1px solid #38bdf8;border-radius:6px;font:13px sans-serif;pointer-events:none';
        document.body.appendChild(weaponHint);
      }
      weaponHint.textContent =
        'ОРУЖИЕ • ЛКМ по мечу/щиту — перетащить • ЛКМ по пустому — поворот камеры • КОЛЕСО — приблизить • Q/E/Z/X/C/V — поворот • K — выход';
      loadWeaponLayout();
      console.log('[weapon] editor ON');
    } else {
      dom.removeEventListener('pointerdown', onWeaponPointerDown);
      window.removeEventListener('pointermove', onWeaponPointerMove);
      window.removeEventListener('pointerup', onWeaponPointerUp);
      window.removeEventListener('keydown', onWeaponKeyDown);
      dom.removeEventListener('wheel', onWeaponWheel);
      const prevLocked = weaponEditorPrevCameraLocked;
      weaponEditorPrevCameraLocked = null;
      setCameraLock(prevLocked !== null ? prevLocked : false);
      weaponSelected = null;
      weaponDragging = false;
      weaponCameraOrbiting = false;
      if (weaponHint) {
        weaponHint.remove();
        weaponHint = null;
      }
      console.log('[weapon] editor OFF');
    }
  }

  // ---- arena editor helpers ----------------------------------------------
  function setArenaPointer(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    arenaPointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    arenaPointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    arenaRaycaster.setFromCamera(arenaPointer, camera);
  }

  function onArenaPointerDown(e) {
    const mistyArena = getMistyArena();
    if (!arenaEditMode || e.button !== 0 || !mistyArena) return;
    setArenaPointer(e);
    const hits = arenaRaycaster.intersectObjects(mistyArena.group.children, true);
    for (const hit of hits) {
      let obj = hit.object;
      while (obj && obj.parent !== mistyArena.group) obj = obj.parent;
      if (!obj || obj === mistyArena.group) continue;
      // Skip the painted floor plate, framing decor, mist, and dynamic VFX layers.
      if (obj.userData?.isArenaVisualOnly) continue;
      if (
        obj.geometry &&
        (obj.geometry.type === 'CircleGeometry' ||
          obj.geometry.type === 'RingGeometry' ||
          obj.geometry.type === 'PlaneGeometry')
      ) {
        continue;
      }
      arenaSelected = obj;
      arenaDragging = true;
      if (arenaRaycaster.ray.intersectPlane(arenaGroundPlane, arenaHitPoint)) {
        const localHit = mistyArena.group.worldToLocal(arenaHitPoint.clone());
        arenaDragOffset.set(obj.position.x - localHit.x, 0, obj.position.z - localHit.z);
      } else {
        arenaDragOffset.set(0, 0, 0);
      }
      try { renderer.domElement.setPointerCapture(e.pointerId); } catch {}
      e.preventDefault();
      arenaSelectionRing.visible = true;
      const wp = obj.getWorldPosition(new THREE.Vector3());
      arenaSelectionRing.position.set(wp.x, 0.06, wp.z);
      console.log(
        '[arena] selected:',
        obj.userData.arenaKey || obj.name || obj.uuid,
        'x:',
        obj.position.x.toFixed(1),
        'z:',
        obj.position.z.toFixed(1)
      );
      return;
    }
    arenaSelected = null;
    arenaSelectionRing.visible = false;
    // Empty space + LMB = orbit the camera around the hero.
    arenaCameraOrbiting = true;
    arenaLastOrbitX = e.clientX;
    arenaLastOrbitY = e.clientY;
    e.preventDefault();
  }

  function onArenaPointerMove(e) {
    if (arenaCameraOrbiting) {
      const dx = e.clientX - arenaLastOrbitX;
      const dy = e.clientY - arenaLastOrbitY;
      orbitCamera(-dx * 0.005, -dy * 0.005);
      arenaLastOrbitX = e.clientX;
      arenaLastOrbitY = e.clientY;
      return;
    }
    const mistyArena = getMistyArena();
    if (!arenaDragging || !arenaSelected || !mistyArena) return;
    setArenaPointer(e);
    if (arenaRaycaster.ray.intersectPlane(arenaGroundPlane, arenaHitPoint)) {
      const localHit = mistyArena.group.worldToLocal(arenaHitPoint.clone());
      arenaSelected.position.x = localHit.x + arenaDragOffset.x;
      arenaSelected.position.z = localHit.z + arenaDragOffset.z;
      const wp = arenaSelected.getWorldPosition(new THREE.Vector3());
      arenaSelectionRing.position.set(wp.x, 0.06, wp.z);
    }
  }

  function onArenaPointerUp(e) {
    try { if (e?.pointerId !== undefined) renderer.domElement.releasePointerCapture(e.pointerId); } catch {}
    arenaCameraOrbiting = false;
    const mistyArena = getMistyArena();
    if (arenaDragging && arenaSelected) {
      mistyArena?.saveLayout?.();
      mistyArena?.syncEffects?.();
      syncMistyObstacles();
      console.log('[arena] moved to:', arenaSelected.position.x.toFixed(1), arenaSelected.position.z.toFixed(1));
    }
    arenaDragging = false;
  }

  function arenaEditorSave() {
    const mistyArena = getMistyArena();
    if (!mistyArena) return;
    const json = JSON.stringify(mistyArena.list(), null, 2);
    console.log('[arena] layout:\n' + json);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(json)
        .then(() => {
          if (arenaEditorHintText) arenaEditorHintText.textContent = 'РЕДАКТОР АРЕНЫ • расстановка скопирована в буфер';
        })
        .catch(() => {});
    }
  }

  function arenaEditorLoad() {
    const mistyArena = getMistyArena();
    if (!mistyArena) return;
    const text = window.prompt('Вставьте JSON расстановки:');
    if (!text) return;
    try {
      const items = JSON.parse(text);
      mistyArena.clear();
      arenaSelected = null;
      arenaSelectionRing.visible = false;
      for (const it of items) {
        mistyArena.spawn(it.key, it.x, it.z, it.rot || 0, it.scale || 1);
      }
      mistyArena.saveLayout?.();
      mistyArena.syncEffects?.();
      syncMistyObstacles();
      console.log('[arena] loaded', items.length, 'props');
    } catch (e) {
      console.error('[arena] bad JSON', e);
    }
  }

  // Snap the selected prop to the nearest 90° so it lines up exactly with other props.
  function alignArenaSelection() {
    if (!arenaSelected) return;
    const mistyArena = getMistyArena();
    const step = Math.PI / 2;
    arenaSelected.rotation.y = Math.round(arenaSelected.rotation.y / step) * step;
    mistyArena?.saveLayout?.();
    mistyArena?.syncEffects?.();
    syncMistyObstacles();
    console.log('[arena] aligned rotation:', ((arenaSelected.rotation.y * 180) / Math.PI).toFixed(0), 'deg');
    if (arenaEditorHintText) {
      arenaEditorHintText.textContent = 'РЕДАКТОР АРЕНЫ • модель выровнена по 90°';
    }
  }

  function buildArenaEditorPanel() {
    const ma = ensureMistyArena();
    const panel = document.createElement('div');
    panel.style.cssText =
      'position:fixed;top:10px;right:10px;width:250px;max-height:calc(100vh - 20px);overflow:auto;z-index:99998;background:rgba(18,14,26,.96);border:1px solid #7c5cbf;border-radius:8px;padding:10px;color:#e8dfff;font:12px sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.6)';
    const title = document.createElement('div');
    title.textContent = 'РЕДАКТОР АРЕНЫ';
    title.style.cssText = 'font-weight:bold;color:#fbbf24;margin-bottom:8px';
    panel.appendChild(title);

    const moveBtn = document.createElement('button');
    moveBtn.textContent = 'ДВИЖЕНИЕ ГЕРОЯ WASD: ' + (getHeroMovement() ? 'ВКЛ' : 'ВЫКЛ');
    moveBtn.style.cssText =
      'display:block;width:100%;margin-bottom:8px;padding:6px;background:#23402e;color:#c9f5d8;border:1px solid #3d8a5a;border-radius:4px;cursor:pointer';
    moveBtn.onclick = () => {
      const next = !getHeroMovement();
      setHeroMovement(next);
      moveBtn.textContent = 'ДВИЖЕНИЕ ГЕРОЯ WASD: ' + (next ? 'ВКЛ' : 'ВЫКЛ');
      console.log('[arena] hero movement:', next ? 'ON' : 'OFF');
    };
    panel.appendChild(moveBtn);

    for (const key of ma.templateKeys()) {
      const btn = document.createElement('button');
      btn.textContent = '+ ' + key;
      btn.style.cssText =
        'display:block;width:100%;margin:3px 0;padding:6px;background:#2c2140;color:#e8dfff;border:1px solid #6b4fa0;border-radius:4px;cursor:pointer;text-align:left';
      btn.onclick = () => {
        const tgt = getTargetPos();
        const worldPoint = new THREE.Vector3(tgt.x, 0, tgt.z);
        const local = ma.group.worldToLocal(worldPoint);
        const obj = ma.spawn(key, local.x, local.z, 0, 1);
        if (obj) {
          arenaSelected = obj;
          ma.saveLayout?.();
          ma.syncEffects?.();
          syncMistyObstacles();
          console.log('[arena] added', key, 'at world', tgt.x.toFixed(1), tgt.z.toFixed(1));
        }
      };
      panel.appendChild(btn);
    }

    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'ОЧИСТИТЬ СЦЕНУ (всё, кроме пола)';
    clearBtn.style.cssText =
      'display:block;width:100%;margin-top:8px;padding:6px;background:#5a1e2c;color:#ffd7dd;border:1px solid #9b2d4b;border-radius:4px;cursor:pointer';
    clearBtn.onclick = () => {
      ma.clear();
      ma.saveLayout?.();
      syncMistyObstacles();
      arenaSelected = null;
      arenaSelectionRing.visible = false;
      console.log('[arena] scene cleared');
    };
    panel.appendChild(clearBtn);

    const del = document.createElement('button');
    del.textContent = 'УДАЛИТЬ ВЫБРАННОЕ (Delete)';
    del.style.cssText =
      'display:block;width:100%;margin-top:8px;padding:6px;background:#5a1e2c;color:#ffd7dd;border:1px solid #9b2d4b;border-radius:4px;cursor:pointer';
    del.onclick = () => {
      if (arenaSelected) {
        ma.remove(arenaSelected);
        ma.saveLayout?.();
        ma.syncEffects?.();
        syncMistyObstacles();
        arenaSelected = null;
        arenaSelectionRing.visible = false;
      }
    };
    panel.appendChild(del);

    const align = document.createElement('button');
    align.textContent = 'ВЫРОВНЯТЬ МОДЕЛЬ [R]';
    align.style.cssText =
      'display:block;width:100%;margin-top:4px;padding:6px;background:#2f5a3a;color:#cfe8d4;border:1px solid #4a9a62;border-radius:4px;cursor:pointer';
    align.onclick = () => alignArenaSelection();
    panel.appendChild(align);

    const save = document.createElement('button');
    save.textContent = 'СКОПИРОВАТЬ РАССТАНОВКУ';
    save.style.cssText =
      'display:block;width:100%;margin-top:4px;padding:6px;background:#1e3a5a;color:#d7e8ff;border:1px solid #3b6ea5;border-radius:4px;cursor:pointer';
    save.onclick = arenaEditorSave;
    panel.appendChild(save);

    const load = document.createElement('button');
    load.textContent = 'ЗАГРУЗИТЬ JSON';
    load.style.cssText = save.style.cssText;
    load.onclick = arenaEditorLoad;
    panel.appendChild(load);

    const close = document.createElement('button');
    close.textContent = 'ЗАКРЫТЬ (G)';
    close.style.cssText =
      'display:block;width:100%;margin-top:8px;padding:6px;background:#332b3f;color:#cbb8e8;border:1px solid #5a4a72;border-radius:4px;cursor:pointer';
    close.onclick = () => setArenaEditMode(false);
    panel.appendChild(close);

    document.body.appendChild(panel);
    return panel;
  }

  function onArenaWheel(e) {
    if (!arenaEditMode) return;
    e.preventDefault();
    // Ctrl / Cmd + wheel = zoom the camera; plain wheel = rotate the model.
    if (e.ctrlKey || e.metaKey) {
      zoomCamera(Math.sign(e.deltaY) * 2);
      return;
    }
    if (!arenaSelected) return;
    const mistyArena = getMistyArena();
    arenaSelected.rotation.y += Math.sign(e.deltaY) * 0.1;
    mistyArena?.saveLayout?.();
    mistyArena?.syncEffects?.();
    syncMistyObstacles();
  }

  function onArenaKeyDown(e) {
    if (e.code === 'KeyG' && !e.repeat) {
      if (!arenaEditMode && !isDevModeEnabled()) return;
      if (!arenaEditMode && !isMistyBiome()) {
        console.log('[arena] editor is available only on the new arena (chapter 6+)');
        return;
      }
      setArenaEditMode(!arenaEditMode);
      return;
    }
    if (!arenaEditMode) return;
    if (e.code === 'Equal' || e.code === 'NumpadAdd') {
      zoomCamera(-2);
      return;
    }
    if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
      zoomCamera(2);
      return;
    }
    const mistyArena = getMistyArena();
    if ((e.code === 'Delete' || e.code === 'Backspace') && arenaSelected) {
      mistyArena?.remove(arenaSelected);
      mistyArena?.saveLayout?.();
      mistyArena?.syncEffects?.();
      syncMistyObstacles();
      arenaSelected = null;
      arenaSelectionRing.visible = false;
      return;
    }
    if (!arenaSelected) return;
    if (e.code === 'KeyR') {
      alignArenaSelection();
      return;
    }
    if (e.code === 'KeyZ') arenaSelected.rotation.y -= 0.16;
    else if (e.code === 'KeyX') arenaSelected.rotation.y += 0.16;
    else return;
    mistyArena?.saveLayout?.();
    mistyArena?.syncEffects?.();
    syncMistyObstacles();
    console.log('[arena] rotation:', arenaSelected.rotation.y.toFixed(2));
  }

  function setArenaEditMode(enabled = true) {
    const next = Boolean(enabled);
    if (next && !isDevModeEnabled()) return;
    if (next && !isMistyBiome()) {
      console.log('[arena] editor is available only on the new arena (chapter 6+)');
      return;
    }
    if (next === arenaEditMode) return;
    arenaEditMode = next;
    if (arenaEditMode) {
      arenaEditorPrevCameraLocked = getCameraLocked();
      const ma = ensureMistyArena();
      if (!ma.isLoaded()) {
        ma.ensureLoaded().then(() => {
          if (isMistyBiome()) {
            ma.setBiomeTheme?.(ctx.getCurrentBiome());
            syncMistyObstacles();
          }
        });
      }
      renderer.domElement.addEventListener('pointerdown', onArenaPointerDown);
      window.addEventListener('pointermove', onArenaPointerMove);
      window.addEventListener('pointerup', onArenaPointerUp);
      renderer.domElement.addEventListener('wheel', onArenaWheel, { passive: false });
      if (!arenaEditorSavedOrbit) {
        arenaEditorSavedOrbit = getOrbitState();
      }
      setCameraPreset(getActiveCameraPreset() || { yaw: 0, pitch: 0.95, dist: 11 });
      setCameraLock(true);
      if (!arenaEditHint) {
        arenaEditHint = document.createElement('div');
        arenaEditorHintText = document.createElement('span');
        arenaEditHint.appendChild(arenaEditorHintText);
        arenaEditorHintText.textContent =
          'РЕДАКТОР • WASD — герой • ЛКМ по модели — двигать • ЛКМ по пустому — поворот камеры • Z/X/колесо — поворот модели • R — выровнять по 90° • +/- — зум • Delete — удалить • G — выйти';
        arenaEditHint.style.cssText =
          'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:99999;background:rgba(20,12,30,.92);color:#fbbf24;padding:8px 16px;border:1px solid #fbbf24;border-radius:6px;font:13px sans-serif;pointer-events:none';
        document.body.appendChild(arenaEditHint);
      }
      if (!arenaEditorPanel) arenaEditorPanel = buildArenaEditorPanel();
      console.log('[arena] edit mode ON — drag props with LMB, rotate with Z/X or wheel');
    } else {
      renderer.domElement.removeEventListener('pointerdown', onArenaPointerDown);
      window.removeEventListener('pointermove', onArenaPointerMove);
      window.removeEventListener('pointerup', onArenaPointerUp);
      renderer.domElement.removeEventListener('wheel', onArenaWheel);
      const prevLocked = arenaEditorPrevCameraLocked;
      arenaEditorPrevCameraLocked = null;
      setCameraLock(prevLocked !== null ? prevLocked : false);
      if (arenaEditHint) {
        arenaEditHint.remove();
        arenaEditHint = null;
        arenaEditorHintText = null;
      }
      if (arenaEditorPanel) {
        arenaEditorPanel.remove();
        arenaEditorPanel = null;
      }
      arenaSelectionRing.visible = false;
      arenaDragging = false;
      arenaCameraOrbiting = false;
      arenaSelected = null;
      console.log('[arena] edit mode OFF');
    }
  }

  return {
    setArenaEditMode,
    isArenaEditMode: () => arenaEditMode,
    setWeaponEditMode,
    isWeaponEditMode: () => weaponEditMode,
    saveWeaponLayout,
    onArenaKeyDown
  };
}
