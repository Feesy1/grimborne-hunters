// Grimborne Hunters — Lightweight Escape Cutscene VFX
// Pure Vanilla ES Module (Three.js r160, ZERO PointLights, ZERO custom ShaderMaterials -> ZERO shader recompile hitches!).
// All clash sparks also layer with native `spawnSoulsClashSparks`; this module supplies compact dark stone collapse chunks,
// crisp metallic embers, water splash droplets, and subtle underwater bubbles with zero per-frame allocations.

export const SOULS_ESCAPE_VFX_VERSION = '20261124z96';

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

export function createSoulsEscapeVfx(THREE, opts = {}) {
  const isMobile = Boolean(opts.isMobile || opts.lowSpec);
  const rootGroup = new THREE.Group();
  rootGroup.name = 'soulsEscapeVfxRoot';
  rootGroup.visible = Boolean(opts.active);
  if (opts.parent && typeof opts.parent.add === 'function') {
    opts.parent.add(rootGroup);
  }

  let seed = 0x5EED1234 >>> 0;
  function rand() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed >>> 0) / 4294967296;
  }

  // 1. Pooled Compact Dark Stone & Iron Debris Chunks (1 InstancedMesh, standard MeshLambertMaterial — 0 shader compiles!)
  const MAX_DEBRIS = isMobile ? 32 : 56;
  const debrisGeo = new THREE.DodecahedronGeometry(0.16, 0);
  const debrisMat = new THREE.MeshLambertMaterial({ color: 0x3b3532 });
  const debrisMesh = new THREE.InstancedMesh(debrisGeo, debrisMat, MAX_DEBRIS);
  debrisMesh.frustumCulled = false;
  debrisMesh.castShadow = false;
  debrisMesh.receiveShadow = false;
  debrisMesh.count = 0;
  rootGroup.add(debrisMesh);

  const dPos = new Float32Array(MAX_DEBRIS * 3);
  const dVel = new Float32Array(MAX_DEBRIS * 3);
  const dRot = new Float32Array(MAX_DEBRIS * 3);
  const dSpin = new Float32Array(MAX_DEBRIS * 3);
  const dScale = new Float32Array(MAX_DEBRIS);
  const dLife = new Float32Array(MAX_DEBRIS);
  const dMaxLife = new Float32Array(MAX_DEBRIS);
  let dCursor = 0;

  // 2. Pooled Sparks / Water Spray Points (1 Points draw call, standard PointsMaterial — 0 shader compiles!)
  const MAX_PTS = isMobile ? 96 : 160;
  const ptPositions = new Float32Array(MAX_PTS * 3);
  const ptColors = new Float32Array(MAX_PTS * 3);
  const ptVel = new Float32Array(MAX_PTS * 3);
  const ptLife = new Float32Array(MAX_PTS);
  const ptMaxLife = new Float32Array(MAX_PTS);
  const ptGrav = new Float32Array(MAX_PTS);
  let ptCursor = 0;

  const ptGeo = new THREE.BufferGeometry();
  const ptPosAttr = new THREE.BufferAttribute(ptPositions, 3);
  const ptColAttr = new THREE.BufferAttribute(ptColors, 3);
  ptPosAttr.setUsage(THREE.DynamicDrawUsage);
  ptColAttr.setUsage(THREE.DynamicDrawUsage);
  ptGeo.setAttribute('position', ptPosAttr);
  ptGeo.setAttribute('color', ptColAttr);
  // Tiny 32x32 soft radial dot texture (0.05ms CPU) so PointsMaterial renders soft round glowing sparks instead of square pixels!
  let ptSpriteTex = null;
  if (typeof document !== 'undefined') {
    try {
      const c = document.createElement('canvas');
      c.width = 32; c.height = 32;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(16, 16, 1, 16, 16, 15);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.45, 'rgba(255,255,255,0.85)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 32, 32);
      ptSpriteTex = new THREE.CanvasTexture(c);
    } catch {}
  }
  const ptMat = new THREE.PointsMaterial({
    size: 0.22,
    map: ptSpriteTex,
    vertexColors: true,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    sizeAttenuation: true
  });
  const ptMesh = new THREE.Points(ptGeo, ptMat);
  ptMesh.frustumCulled = false;
  rootGroup.add(ptMesh);

  // 3. Subtle Underwater Bubbles (1 small InstancedMesh, standard MeshBasicMaterial)
  const MAX_BUBBLES = isMobile ? 20 : 32;
  const bubGeo = new THREE.SphereGeometry(0.06, 6, 5);
  const bubMat = new THREE.MeshBasicMaterial({
    color: 0xa5d8f3,
    transparent: true,
    opacity: 0.32,
    depthWrite: false
  });
  const bubMesh = new THREE.InstancedMesh(bubGeo, bubMat, MAX_BUBBLES);
  bubMesh.frustumCulled = false;
  bubMesh.visible = false;
  rootGroup.add(bubMesh);

  const bOff = new Float32Array(MAX_BUBBLES * 3);
  const bSpd = new Float32Array(MAX_BUBBLES);
  const bRad = new Float32Array(MAX_BUBBLES);
  for (let i = 0; i < MAX_BUBBLES; i++) {
    bOff[i * 3] = (rand() - 0.5) * 4.4;
    bOff[i * 3 + 1] = (rand() - 0.5) * 2.4;
    bOff[i * 3 + 2] = -0.8 - rand() * 3.6;
    bSpd[i] = 0.65 + rand() * 0.95;
    bRad[i] = 0.45 + rand() * 0.95;
  }

  let active = Boolean(opts.active);
  let underwaterOn = false;
  let fallingStreamOn = false;
  let streamAccum = 0;
  const uwOrigin = new THREE.Vector3(0, 0, 0);
  const fallOrigin = new THREE.Vector3(0, 0, 0);
  const tmpMat = new THREE.Matrix4();
  const tmpPos = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const tmpEuler = new THREE.Euler();
  const tmpScale = new THREE.Vector3();

  function spawnPoint(x, y, z, vx, vy, vz, r, g, b, life, grav = 9.2) {
    const i = ptCursor;
    ptCursor = (ptCursor + 1) % MAX_PTS;
    const i3 = i * 3;
    ptPositions[i3] = x;
    ptPositions[i3 + 1] = y;
    ptPositions[i3 + 2] = z;
    ptVel[i3] = vx;
    ptVel[i3 + 1] = vy;
    ptVel[i3 + 2] = vz;
    ptColors[i3] = r;
    ptColors[i3 + 1] = g;
    ptColors[i3 + 2] = b;
    ptLife[i] = life;
    ptMaxLife[i] = life;
    ptGrav[i] = grav;
  }

  function spawnDebris(x, y, z, vx, vy, vz, sc, life) {
    const i = dCursor;
    dCursor = (dCursor + 1) % MAX_DEBRIS;
    const i3 = i * 3;
    dPos[i3] = x;
    dPos[i3 + 1] = y;
    dPos[i3 + 2] = z;
    dVel[i3] = vx;
    dVel[i3 + 1] = vy;
    dVel[i3 + 2] = vz;
    dRot[i3] = rand() * 6.28;
    dRot[i3 + 1] = rand() * 6.28;
    dRot[i3 + 2] = rand() * 6.28;
    dSpin[i3] = (rand() - 0.5) * 8.0;
    dSpin[i3 + 1] = (rand() - 0.5) * 8.0;
    dSpin[i3 + 2] = (rand() - 0.5) * 8.0;
    dScale[i] = sc;
    dLife[i] = life;
    dMaxLife[i] = life;
  }

  function emitParrySparks(x, y, z, intensity = 1.0) {
    const n = Math.min(24, Math.round(14 * clamp(intensity, 0.5, 1.5)));
    for (let k = 0; k < n; k++) {
      const ang = rand() * Math.PI * 2;
      const spd = 2.4 + rand() * 4.2;
      spawnPoint(
        x + (rand() - 0.5) * 0.14,
        y + (rand() - 0.5) * 0.14,
        z + (rand() - 0.5) * 0.14,
        Math.cos(ang) * spd,
        1.2 + rand() * 3.0,
        Math.sin(ang) * spd,
        1.0,
        0.72 + rand() * 0.24,
        0.22 + rand() * 0.18,
        0.28 + rand() * 0.26,
        9.8
      );
    }
  }

  function emitDustImpact(x, y, z, scale = 1.0) {
    const n = Math.min(18, Math.round(12 * clamp(scale, 0.5, 1.5)));
    for (let k = 0; k < n; k++) {
      const ang = rand() * Math.PI * 2;
      const spd = (0.8 + rand() * 2.1) * scale;
      spawnPoint(
        x + Math.cos(ang) * 0.22,
        y + 0.06,
        z + Math.sin(ang) * 0.22,
        Math.cos(ang) * spd,
        0.4 + rand() * 1.1,
        Math.sin(ang) * spd,
        0.52, 0.48, 0.44,
        0.45 + rand() * 0.35,
        1.4
      );
    }
  }

  function emitFloorCollapseBurst(x, y, z) {
    // Compact dark stone chunks mostly dropping DOWN into the pit (never flying into the camera!)
    const nChunks = isMobile ? 16 : 26;
    for (let k = 0; k < nChunks; k++) {
      const ang = rand() * Math.PI * 2;
      const r = 0.25 + rand() * 1.55;
      spawnDebris(
        x + Math.cos(ang) * r,
        y - 0.05 + rand() * 0.25,
        z + Math.sin(ang) * r,
        Math.cos(ang) * (0.4 + rand() * 1.3),
        0.8 + rand() * 2.2,
        Math.sin(ang) * (0.4 + rand() * 1.3),
        0.45 + rand() * 0.65,
        1.6 + rand() * 1.1
      );
    }
    const nPts = isMobile ? 24 : 42;
    for (let k = 0; k < nPts; k++) {
      const ang = rand() * Math.PI * 2;
      const spd = 1.2 + rand() * 3.4;
      const hot = rand() < 0.38;
      spawnPoint(
        x + Math.cos(ang) * (0.2 + rand() * 1.2),
        y + 0.12,
        z + Math.sin(ang) * (0.2 + rand() * 1.2),
        Math.cos(ang) * spd,
        1.2 + rand() * 3.0,
        Math.sin(ang) * spd,
        hot ? 1.0 : 0.45,
        hot ? 0.56 : 0.42,
        hot ? 0.18 : 0.38,
        0.55 + rand() * 0.55,
        6.5
      );
    }
  }

  function emitWaterSplash(x, y, z, scale = 1.0) {
    const n = isMobile ? 28 : 48;
    for (let k = 0; k < n; k++) {
      const ang = rand() * Math.PI * 2;
      const spd = (1.1 + rand() * 3.2) * scale;
      spawnPoint(
        x + (rand() - 0.5) * 0.55,
        y + 0.08,
        z + (rand() - 0.5) * 0.55,
        Math.cos(ang) * spd,
        2.2 + rand() * 3.8 * scale,
        Math.sin(ang) * spd,
        0.78, 0.90, 0.96,
        0.55 + rand() * 0.48,
        9.4
      );
    }
  }

  function emitGrateBreakBurst(x, y, z) {
    for (let k = 0; k < 10; k++) {
      spawnDebris(
        x + (rand() - 0.5) * 1.2,
        y + (rand() - 0.5) * 0.6,
        z,
        (rand() - 0.5) * 3.2,
        1.2 + rand() * 2.6,
        3.5 + rand() * 3.5,
        0.42 + rand() * 0.35,
        1.3 + rand() * 0.7
      );
    }
    emitWaterSplash(x, y, z, 1.1);
  }

  function setActive(flag) {
    active = Boolean(flag);
    rootGroup.visible = active;
  }

  function setUnderwaterBubbles(on, camPos = null) {
    underwaterOn = Boolean(on);
    bubMesh.visible = underwaterOn && active;
    if (camPos) {
      uwOrigin.set(Number(camPos.x) || 0, Number(camPos.y) || 0, Number(camPos.z) || 0);
    }
  }

  function setFallingDebrisStream(on, originPos = null) {
    fallingStreamOn = Boolean(on);
    if (originPos) {
      fallOrigin.set(Number(originPos.x) || 0, Number(originPos.y) || 0, Number(originPos.z) || 0);
    }
  }

  function reset() {
    dLife.fill(0);
    ptLife.fill(0);
    for (let i = 0; i < MAX_PTS * 3; i++) ptPositions[i] = 99999;
    ptPosAttr.needsUpdate = true;
    debrisMesh.count = 0;
    underwaterOn = false;
    fallingStreamOn = false;
    bubMesh.visible = false;
  }

  function update(dt, elapsed = 0) {
    if (!active) return;
    const step = clamp(Number(dt) || 0.016, 0.001, 0.06);

    if (fallingStreamOn) {
      streamAccum += step;
      while (streamAccum >= 0.09) {
        streamAccum -= 0.09;
        const ang = rand() * Math.PI * 2;
        const r = 0.8 + rand() * 1.4;
        spawnDebris(
          fallOrigin.x + Math.cos(ang) * r,
          fallOrigin.y + 3.2 + rand() * 2.5,
          fallOrigin.z + Math.sin(ang) * r,
          (rand() - 0.5) * 0.5,
          -4.0 - rand() * 4.0,
          (rand() - 0.5) * 0.5,
          0.32 + rand() * 0.32,
          1.2
        );
      }
    }

    // Update 3D debris instances
    let aliveDebris = 0;
    for (let i = 0; i < MAX_DEBRIS; i++) {
      if (dLife[i] <= 0) continue;
      dLife[i] -= step;
      if (dLife[i] <= 0) continue;
      const i3 = i * 3;
      dVel[i3 + 1] -= 13.5 * step;
      dPos[i3] += dVel[i3] * step;
      dPos[i3 + 1] += dVel[i3 + 1] * step;
      dPos[i3 + 2] += dVel[i3 + 2] * step;
      dRot[i3] += dSpin[i3] * step;
      dRot[i3 + 1] += dSpin[i3 + 1] * step;
      dRot[i3 + 2] += dSpin[i3 + 2] * step;

      const fade = clamp(dLife[i] / Math.max(0.05, dMaxLife[i]), 0, 1);
      const s = dScale[i] * (fade < 0.25 ? fade * 4 : 1);
      tmpPos.set(dPos[i3], dPos[i3 + 1], dPos[i3 + 2]);
      tmpEuler.set(dRot[i3], dRot[i3 + 1], dRot[i3 + 2]);
      tmpQuat.setFromEuler(tmpEuler);
      tmpScale.set(s, s * 0.78, s * 0.92);
      tmpMat.compose(tmpPos, tmpQuat, tmpScale);
      debrisMesh.setMatrixAt(aliveDebris++, tmpMat);
    }
    debrisMesh.count = aliveDebris;
    if (aliveDebris > 0) debrisMesh.instanceMatrix.needsUpdate = true;

    // Update spark/water points
    let anyPt = false;
    for (let i = 0; i < MAX_PTS; i++) {
      const i3 = i * 3;
      if (ptLife[i] <= 0) {
        ptPositions[i3 + 1] = -9999;
        continue;
      }
      ptLife[i] -= step;
      if (ptLife[i] <= 0) {
        ptPositions[i3 + 1] = -9999;
        anyPt = true;
        continue;
      }
      ptVel[i3 + 1] -= ptGrav[i] * step;
      ptPositions[i3] += ptVel[i3] * step;
      ptPositions[i3 + 1] += ptVel[i3 + 1] * step;
      ptPositions[i3 + 2] += ptVel[i3 + 2] * step;
      anyPt = true;
    }
    if (anyPt) {
      ptPosAttr.needsUpdate = true;
      ptColAttr.needsUpdate = true;
    }

    // Update underwater bubbles
    if (underwaterOn && bubMesh.visible) {
      for (let i = 0; i < MAX_BUBBLES; i++) {
        const i3 = i * 3;
        bOff[i3 + 1] += bSpd[i] * step;
        if (bOff[i3 + 1] > 1.5) bOff[i3 + 1] = -1.4;
        tmpPos.set(
          uwOrigin.x + bOff[i3] + Math.sin(elapsed * 2.4 + i) * 0.14,
          uwOrigin.y + bOff[i3 + 1],
          uwOrigin.z + bOff[i3 + 2]
        );
        tmpQuat.identity();
        tmpScale.setScalar(bRad[i]);
        tmpMat.compose(tmpPos, tmpQuat, tmpScale);
        bubMesh.setMatrixAt(i, tmpMat);
      }
      bubMesh.instanceMatrix.needsUpdate = true;
    }
  }

  function dispose() {
    reset();
    if (rootGroup.parent) rootGroup.parent.remove(rootGroup);
    debrisGeo.dispose();
    debrisMat.dispose();
    ptGeo.dispose();
    ptMat.dispose();
    if (ptSpriteTex) ptSpriteTex.dispose();
    bubGeo.dispose();
    bubMat.dispose();
  }

  return {
    rootGroup,
    setActive,
    reset,
    emitParrySparks,
    emitDustImpact,
    emitFloorCollapseBurst,
    emitWaterSplash,
    emitGrateBreakBurst,
    setUnderwaterBubbles,
    setFallingDebrisStream,
    update,
    dispose
  };
}
