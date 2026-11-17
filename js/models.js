// Authentic KayKit CC0 Rigged & Animated GLB Character + Enemy System (Three.js r160)
// Heroes match the user's Undead Dark-Fantasy Trio reference:
//   - Gunslinger (Стрелок): Hooded Skeleton with blazing orange eyes, red scarf, backpack & blunderbuss/shotgun
//   - Warrior (Воин): Horned-Helmet Armored Skeleton with blazing orange eyes, red cloak, broadsword & skull shield
//   - Mage (Маг): Wizard-Hat Robed Skeleton with blazing orange eyes, purple crystal staff & glowing potion flask

import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { clone as cloneSkinned } from '../vendor/SkeletonUtils.js';
import { WEAPONS } from './config.js?v=20261117z18';

const MODEL_PATHS = {
  warrior_tripo: './assets/models/Warrior_Tripo.glb?v=20261117z18',
  sword_tripo: './assets/models/Sword_Tripo.glb?v=20261117z18',
  spear_tripo: './assets/models/Spear_Tripo.glb?v=20261117z18',
  zweihander_tripo: './assets/models/Zweihander_Tripo.glb?v=20261117z18',
  axe_tripo: './assets/models/Axe_Tripo.glb?v=20261117z18',
  hammer_tripo: './assets/models/Hammer_Tripo.glb?v=20261117z18',
  mage_tripo: './assets/models/Mage_Tripo.glb?v=20261117z18',
  staff_tripo: './assets/models/Staff_Tripo.glb?v=20261117z18',
  gunslinger_tripo: './assets/models/Gunslinger_Tripo.glb?v=20261117z18',
  shotgun_tripo: './assets/models/Shotgun_Tripo.glb?v=20261117z18',
  pistol_tripo: './assets/models/Pistol_Tripo.glb?v=20261117z18',
  smg_tripo: './assets/models/SMG_Tripo.glb?v=20261117z18',
  ak47_tripo: './assets/models/AK47_Tripo.glb?v=20261117z18',
  zombie_tripo: './assets/models/Zombie_Tripo.glb?v=20261117z18',
  tree_tripo: './assets/models/Tree_Tripo.glb?v=20261117z18',
  dracula_tripo: './assets/models/Dracula_Tripo.glb?v=20261117z18',
  mimic_tripo: './assets/models/Mimic_Tripo.glb?v=20261117z18',
  chest_disguise_tripo: './assets/models/Chest_Disguise_Tripo.glb?v=20261117z18',
  lich_tripo: './assets/models/Lich_Tripo.glb?v=20261117z18',
  troll_tripo: './assets/models/Troll_Tripo.glb?v=20261117z18',
  succubus_tripo: './assets/models/Succubus_Tripo.glb?v=20261117z18',
  spider_tripo: './assets/models/Spider_Tripo.glb?v=20261117z18',
  barbarian: './assets/models/Barbarian.glb',
  knight: './assets/models/Knight.glb',
  rogue: './assets/models/Rogue_Hooded.glb',
  mage: './assets/models/Mage.glb',
  skel_minion: './assets/models/Skeleton_Minion.glb',
  skel_rogue: './assets/models/Skeleton_Rogue.glb',
  skel_mage: './assets/models/Skeleton_Mage.glb',
  skel_warrior: './assets/models/Skeleton_Warrior.glb',
  chest: './assets/env/chest.glb',
  chest_gold: './assets/env/chest_gold.glb'
};

const gltfCache = new Map();
const inFlightModelLoads = new Map();
let preloadPromise = null;
let sharedModelLoader = null;
const cachedEyeEmissiveTextures = new Map();
let cachedStaffGlobeAlphaTex = null;

function isMobileRuntimeDevice() {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPhone|iPod|iPad|Android/i.test(navigator.userAgent || '') ||
    ((navigator.maxTouchPoints || 0) > 0 && Math.min(window.innerWidth || 1280, window.innerHeight || 720) <= 720)
  );
}

function buildStaffGlobeCutoutAlphaMap(img) {
  if (cachedStaffGlobeAlphaTex) return cachedStaffGlobeAlphaTex;
  if (!img || typeof document === 'undefined') return null;
  const imgW = img.width || img.naturalWidth || 0;
  const imgH = img.height || img.naturalHeight || 0;
  if (!imgW || !imgH) return null;

  const size = 512;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, size, size);
  const imgData = ctx.getImageData(0, 0, size, size);
  const d = imgData.data;

  // Dissolve ONLY the interior cyan/turquoise globe pixels while keeping 100% of olive/gold/coral wood claws!
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const isCyanGlobe = g > 118 && b > 116 && r < 96 && g - r > 44 && b - r > 38;
    const val = isCyanGlobe ? 0 : 255;
    d[i] = val;
    d[i + 1] = val;
    d[i + 2] = val;
    d[i + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  const tex = new THREE.CanvasTexture(cv);
  tex.flipY = false;
  tex.needsUpdate = true;
  cachedStaffGlobeAlphaTex = tex;
  return tex;
}

const ELEMENT_VORTEX_PALETTES = {
  water:     { deep: 0x02648c, mid: 0x06c8cc, core: 0xbefcf6, ribbon: 0x16c5c9, drop: 0x7ef9f5 },
  fire:      { deep: 0x7f1d1d, mid: 0xea580c, core: 0xfef08a, ribbon: 0xf97316, drop: 0xfde047 },
  lightning: { deep: 0x1e3a8a, mid: 0x0284c7, core: 0xfef9c3, ribbon: 0x38bdf8, drop: 0xfef08a },
  air:       { deep: 0x115e59, mid: 0x14b8a6, core: 0xccfbf1, ribbon: 0x5eead4, drop: 0xf0fdfa }
};

function createLivingStaffOrbVfx(orbRadius = 9.95, initialElement = 'water') {
  const pal = ELEMENT_VORTEX_PALETTES[initialElement] || ELEMENT_VORTEX_PALETTES.water;
  const grp = new THREE.Group();

  // 1. Single Seamless Sculpted Spiral Whirlpool Sphere (Matches fb044451.mp4 & bcf5a263.mp4 1-to-1:
  //    ZERO nested concentric rings, ZERO polar pinch, real wet 3D wave-crest relief!)
  const vortexUniforms = {
    uTime: { value: 0 },
    uCastPulse: { value: 0 },
    uColorDeep: { value: new THREE.Color(pal.deep) },
    uColorMid: { value: new THREE.Color(pal.mid) },
    uColorCore: { value: new THREE.Color(pal.core) }
  };

  const vortexMat = new THREE.ShaderMaterial({
    uniforms: vortexUniforms,
    transparent: true,
    depthWrite: true,
    extensions: { derivatives: true },
    vertexShader: `
      uniform float uTime;
      uniform float uCastPulse;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      varying vec3 vLocalDir;
      void main() {
        vec3 n = normalize(normal);
        vLocalDir = n;
        float w1 = sin(n.x * 4.2 + uTime * 3.8) * cos(n.y * 3.9 - uTime * 3.1);
        float w2 = sin(n.z * 4.5 - uTime * 4.4 + n.y * 3.2);
        float ripple = (w1 * 0.55 + w2 * 0.45) * (0.032 + uCastPulse * 0.055);
        vec3 displaced = position * (1.0 + uCastPulse * 0.10) + n * (length(position) * ripple);
        vec4 mvPos = modelViewMatrix * vec4(displaced, 1.0);
        vNormalV = normalize(normalMatrix * n);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uCastPulse;
      uniform vec3 uColorDeep;
      uniform vec3 uColorMid;
      uniform vec3 uColorCore;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      varying vec3 vLocalDir;

      float gyroid(vec3 p) {
        return dot(sin(p), cos(p.yzx));
      }

      void main() {
        vec3 N = normalize(vNormalV);
        vec3 V = normalize(vViewDir);
        float ndv = clamp(dot(N, V), 0.0, 1.0);

        // View-aligned spiral whirlpool coordinates (pinch-free at r -> 0!)
        vec2 disk = N.xy;
        float r = clamp(length(disk), 0.0, 1.0);
        float theta = atan(disk.y, disk.x);
        float spiralFade = smoothstep(0.0, 0.24, r) * smoothstep(1.0, 0.78, r);

        // 2-arm + 3-arm logarithmic whirlpool curling inward continuously
        float armA = sin(theta * 2.0 - r * 9.5 + uTime * 4.4);
        float armB = sin(theta * 3.0 - r * 13.0 + uTime * 5.8 + 1.2);
        float spiralWave = (armA * 0.62 + armB * 0.38) * spiralFade;

        // Pole-free 3D rotating gyroid liquid currents for organic volume from every camera angle
        float c = cos(uTime * 1.35);
        float s = sin(uTime * 1.35);
        vec3 pRot = vec3(vLocalDir.x * c - vLocalDir.z * s, vLocalDir.y, vLocalDir.x * s + vLocalDir.z * c);
        float g1 = gyroid(pRot * 4.2 + vec3(0.0, -uTime * 2.2, uTime * 1.6)) / 1.7;
        float g2 = gyroid(pRot * 7.8 - vec3(uTime * 2.8, uTime * 1.9, 0.0)) / 2.2;

        float eyeGlow = exp(-r * r * 13.5) * (0.72 + 0.28 * sin(uTime * 5.2));
        float height = clamp(0.50 + spiralWave * 0.34 + g1 * 0.24 + g2 * 0.12 + eyeGlow * 0.30, 0.0, 1.0);

        // Screen-space derivative normal perturbation for glossy 3D sculpted water crests!
        float dhx = dFdx(height);
        float dhy = dFdy(height);
        vec3 nPerturb = normalize(N - vec3(dhx, dhy, 0.0) * 3.6);
        vec3 lightDir = normalize(vec3(-0.38, 0.62, 0.68));
        float wetSpec = pow(max(dot(nPerturb, lightDir), 0.0), 22.0);
        float fresnel = pow(1.0 - ndv, 2.6);

        vec3 col = mix(uColorDeep, uColorMid, smoothstep(0.18, 0.72, height));
        float foamCrest = smoothstep(0.64, 0.95, height) * 0.68 + eyeGlow * 0.48 + fresnel * 0.45 + uCastPulse * 0.72;
        col = mix(col, uColorCore, clamp(foamCrest, 0.0, 1.0));
        col += vec3(0.88, 1.0, 0.99) * (wetSpec * 0.62);

        float edgeSoft = smoothstep(0.0, 0.08, ndv);
        float alpha = clamp((0.86 + fresnel * 0.12 + uCastPulse * 0.10) * edgeSoft, 0.0, 0.98);
        gl_FragColor = vec4(col, alpha);
      }
    `
  });

  const liquidSphere = new THREE.Mesh(new THREE.SphereGeometry(orbRadius, 36, 30), vortexMat);
  grp.add(liquidSphere);

  // 2. Glossy Undulating Turquoise Water Ribbon hugging the S-curve wooden shaft (Matches fb044451.mp4!)
  const streamUniforms = {
    uTime: { value: 0 },
    uCastPulse: { value: 0 },
    uStreamDeep: { value: new THREE.Color(pal.deep) },
    uStreamCol: { value: new THREE.Color(pal.ribbon) },
    uFoamCol: { value: new THREE.Color(pal.core) }
  };
  const shaftPts = [];
  for (let s = 0; s <= 36; s++) {
    const u = s / 36;
    const ang = u * Math.PI * 3.2 + 0.55;
    const shaftCenterX = 3.5 * Math.min(1, u * 2.0);
    const rad = orbRadius * (0.44 - u * 0.16 + Math.sin(u * Math.PI * 2.0) * 0.09);
    const yy = -orbRadius * 0.86 - u * (orbRadius * 5.9);
    shaftPts.push(new THREE.Vector3(shaftCenterX + Math.cos(ang) * rad, yy, Math.sin(ang) * rad));
  }
  const shaftCurve = new THREE.CatmullRomCurve3(shaftPts);
  const shaftStreamGeo = new THREE.TubeGeometry(shaftCurve, 48, orbRadius * 0.125, 8, false);
  const sPos = shaftStreamGeo.attributes.position;
  const sUv = shaftStreamGeo.attributes.uv;
  const cPt = new THREE.Vector3();
  const vTmp = new THREE.Vector3();
  for (let i = 0; i < sPos.count; i++) {
    const u = Math.min(1, Math.max(0, sUv.getX(i)));
    const taper = Math.sin(u * Math.PI);
    shaftCurve.getPointAt(u, cPt);
    vTmp.fromBufferAttribute(sPos, i).sub(cPt).multiplyScalar(0.22 + 0.90 * taper).add(cPt);
    sPos.setXYZ(i, vTmp.x, vTmp.y, vTmp.z);
  }
  sPos.needsUpdate = true;
  shaftStreamGeo.computeVertexNormals();

  const shaftStreamMat = new THREE.ShaderMaterial({
    uniforms: streamUniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNormV;
      void main() {
        vUv = uv;
        vec3 p = position;
        float sway = sin(uv.x * 14.0 - uTime * 5.2) * 0.42 * sin(uv.x * 3.14159);
        p += normal * sway;
        vNormV = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uCastPulse;
      uniform vec3 uStreamDeep;
      uniform vec3 uStreamCol;
      uniform vec3 uFoamCol;
      varying vec2 vUv;
      varying vec3 vNormV;
      void main() {
        float endFade = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.84, vUv.x);
        float flow = 0.5 + 0.5 * sin(vUv.x * 20.0 - uTime * 6.8 + sin(vUv.y * 6.2831) * 1.5);
        float spec = pow(max(dot(normalize(vNormV), normalize(vec3(-0.35, 0.65, 0.7))), 0.0), 14.0);
        vec3 col = mix(uStreamDeep, uStreamCol, 0.35 + 0.65 * flow);
        col = mix(col, uFoamCol, pow(flow, 2.6) * 0.55 + spec * 0.55 + uCastPulse * 0.45);
        float alpha = endFade * (0.62 + 0.28 * flow + uCastPulse * 0.10);
        gl_FragColor = vec4(col, alpha);
      }
    `
  });
  const shaftStreamMesh = new THREE.Mesh(shaftStreamGeo, shaftStreamMat);
  grp.add(shaftStreamMesh);

  // 3. Radial Charge-Flash Rays on Attack
  const burstGroup = new THREE.Group();
  burstGroup.visible = false;
  const burstMat = new THREE.MeshBasicMaterial({
    color: pal.core,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const rayGeo = new THREE.ConeGeometry(orbRadius * 0.08, orbRadius * 1.05, 5);
  rayGeo.translate(0, orbRadius * 1.25, 0);
  for (let r = 0; r < 8; r++) {
    const ray = new THREE.Mesh(rayGeo, burstMat);
    ray.rotation.z = (r / 8) * Math.PI * 2;
    ray.rotation.x = (r % 2 === 0 ? 1 : -1) * 0.38;
    burstGroup.add(ray);
  }
  grp.add(burstGroup);

  // 4. Glossy Rising Teardrop Water Droplets around the coral tips & lower stream (Matches fb044451.mp4!)
  const dropGeo = new THREE.SphereGeometry(orbRadius * 0.072, 10, 10);
  const dropMat = new THREE.MeshStandardMaterial({
    color: pal.ribbon,
    emissive: pal.drop,
    emissiveIntensity: 0.65,
    roughness: 0.12,
    metalness: 0.05,
    transparent: true,
    opacity: 0.88
  });
  const droplets = [];
  for (let d = 0; d < 9; d++) {
    const dMesh = new THREE.Mesh(dropGeo, dropMat);
    grp.add(dMesh);
    droplets.push(dMesh);
  }

  function setElementTheme(elemId) {
    const p = ELEMENT_VORTEX_PALETTES[elemId] || ELEMENT_VORTEX_PALETTES.water;
    vortexUniforms.uColorDeep.value.setHex(p.deep);
    vortexUniforms.uColorMid.value.setHex(p.mid);
    vortexUniforms.uColorCore.value.setHex(p.core);
    streamUniforms.uStreamDeep.value.setHex(p.deep);
    streamUniforms.uStreamCol.value.setHex(p.ribbon);
    streamUniforms.uFoamCol.value.setHex(p.core);
    burstMat.color.setHex(p.core);
    dropMat.color.setHex(p.ribbon);
    dropMat.emissive.setHex(p.drop);
  }

  function updateVfx(elapsedTime = 0, castPulse = 0) {
    vortexUniforms.uTime.value = elapsedTime;
    vortexUniforms.uCastPulse.value = castPulse;
    streamUniforms.uTime.value = elapsedTime;
    streamUniforms.uCastPulse.value = castPulse;

    if (castPulse > 0.03) {
      burstGroup.visible = true;
      burstGroup.rotation.y = elapsedTime * 5.0;
      const bScale = 0.78 + (1.0 - castPulse) * 0.58;
      burstGroup.scale.setScalar(bScale);
      burstMat.opacity = castPulse * 0.80;
    } else {
      burstGroup.visible = false;
    }

    for (let i = 0; i < droplets.length; i++) {
      const dm = droplets[i];
      const uRise = ((elapsedTime * (0.48 + (i % 4) * 0.12) + i * 0.37) % 1);
      const fade = Math.sin(uRise * Math.PI);
      const isLower = i >= 6;
      const a = i * 2.15 + Math.sin(elapsedTime * 1.8 + i) * 0.35;
      const rad = orbRadius * (isLower ? 0.62 : 1.16 + (i % 2) * 0.14);
      const yy = isLower
        ? -orbRadius * (4.4 - uRise * 2.6)
        : -orbRadius * 0.55 + uRise * (orbRadius * 1.85);
      dm.position.set((isLower ? 3.2 : 0) + Math.cos(a) * rad, yy, Math.sin(a) * rad);
      const sc = (0.45 + 0.65 * fade) * (1.0 + castPulse * 0.35);
      dm.scale.set(sc * 0.88, sc * 1.24, sc * 0.88);
    }
  }

  return { group: grp, setElementTheme, updateVfx };
}

function buildTripoSkullEyeEmissiveMap(cacheKey, sceneRoot) {
  if (cachedEyeEmissiveTextures.has(cacheKey) || typeof document === 'undefined') {
    return cachedEyeEmissiveTextures.get(cacheKey) || null;
  }
  let targetMesh = null;
  sceneRoot.updateMatrixWorld(true);
  sceneRoot.traverse((n) => {
    if (!targetMesh && n.isMesh && n.geometry?.attributes?.position && n.geometry?.attributes?.uv && n.material?.map?.image) {
      targetMesh = n;
    }
  });
  if (!targetMesh) return null;

  const img = targetMesh.material.map.image;
  const imgW = img.width || img.naturalWidth || 0;
  const imgH = img.height || img.naturalHeight || 0;
  if (!imgW || !imgH) return null;

  // Find UV bounding region of front skull face vertices in scene space
  const posAttr = targetMesh.geometry.attributes.position;
  const uvAttr = targetMesh.geometry.attributes.uv;
  const matW = targetMesh.matrixWorld;
  const vPos = new THREE.Vector3();
  const faceCells = new Uint8Array(64 * 64);
  let foundAnyFace = false;

  if (cacheKey === 'tree_tripo') {
    faceCells.fill(1);
    foundAnyFace = true;
  } else {
    for (let i = 0; i < posAttr.count; i++) {
      vPos.fromBufferAttribute(posAttr, i).applyMatrix4(matW);
      if (vPos.y > 0.48 && vPos.y < 0.78 && vPos.z > 0.035 && Math.abs(vPos.x) < 0.145) {
        let u = uvAttr.getX(i);
        let v = uvAttr.getY(i);
        u = ((u % 1) + 1) % 1;
        v = ((v % 1) + 1) % 1;
        const cx = Math.min(63, Math.max(0, Math.floor(u * 64)));
        const cy = Math.min(63, Math.max(0, Math.floor(v * 64)));
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx >= 0 && nx < 64 && ny >= 0 && ny < 64) {
              faceCells[ny * 64 + nx] = 1;
              foundAnyFace = true;
            }
          }
        }
      }
    }
  }
  if (!foundAnyFace) return null;

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, size, size);
  const imgData = ctx.getImageData(0, 0, size, size);
  const d = imgData.data;

  for (let py = 0; py < size; py++) {
    const cy = Math.min(63, Math.floor((py / size) * 64));
    for (let px = 0; px < size; px++) {
      const cx = Math.min(63, Math.floor((px / size) * 64));
      const idx = (py * size + px) * 4;
      if (!faceCells[cy * 64 + cx]) {
        d[idx] = 0;
        d[idx + 1] = 0;
        d[idx + 2] = 0;
        d[idx + 3] = 255;
        continue;
      }
      const r = d[idx];
      const g = d[idx + 1];
      const b = d[idx + 2];
      // Isolate blazing red/orange/yellow eye socket glow from pale skull bone & armor/hood
      if (r > 185 && g > 55 && r > b * 1.42 && r - b > 70) {
        const boost = Math.min(1, (r - 175) / 75);
        d[idx] = Math.min(255, Math.round(r * (0.85 + boost * 0.25)));
        d[idx + 1] = Math.min(255, Math.round(g * (0.75 + boost * 0.25)));
        d[idx + 2] = Math.round(b * 0.25);
      } else {
        d[idx] = 0;
        d[idx + 1] = 0;
        d[idx + 2] = 0;
      }
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  cachedEyeEmissiveTextures.set(cacheKey, tex);
  return tex;
}

function getWeaponAssetKey(weaponId = 'club') {
  if (weaponId === 'spear' || weaponId === 'cleaver') return 'spear_tripo';
  if (weaponId === 'zweihander') return 'zweihander_tripo';
  if (weaponId === 'axe' || weaponId === 'flail') return 'axe_tripo';
  if (weaponId === 'boss_hammer') return 'hammer_tripo';
  if (weaponId === 'usp_pistol') return 'pistol_tripo';
  if (weaponId === 'smg') return 'smg_tripo';
  if (weaponId === 'ak47') return 'ak47_tripo';
  if (weaponId === 'pistol' || weaponId === 'blunderbuss' || weaponId === 'gatling') return 'shotgun_tripo';
  if (weaponId === 'colt') return null; // procedural chrome revolver
  if (weaponId === 'spark_staff' || weaponId === 'void_orb') return 'staff_tripo';
  return 'sword_tripo';
}

function getHeroAssetKey(classId = 'warrior') {
  if (classId === 'gunslinger') return 'gunslinger_tripo';
  if (classId === 'mage') return 'mage_tripo';
  return 'warrior_tripo';
}

function loadSingleModelKey(key) {
  if (!key || !MODEL_PATHS[key] || gltfCache.has(key)) return Promise.resolve();
  if (inFlightModelLoads.has(key)) return inFlightModelLoads.get(key);
  if (!sharedModelLoader) sharedModelLoader = new GLTFLoader();
  const url = MODEL_PATHS[key];
  const isMobile = isMobileRuntimeDevice();

  const p = new Promise((resolve) => {
    let settled = false;
    let attempt = 0;
    const finish = () => {
      if (settled) return;
      settled = true;
      inFlightModelLoads.delete(key);
      resolve();
    };
    const timer = setTimeout(() => {
      console.warn(`[models] Timeout loading ${url}, continuing with fallback`);
      finish();
    }, 60000);

    const tryLoad = () => {
      attempt += 1;
      sharedModelLoader.load(
        url,
        (gltf) => {
          clearTimeout(timer);
          const clipMap = new Map();
          for (const clip of gltf.animations || []) {
            clipMap.set(clip.name, clip);
            const cleanClipName = clip.name.replace(/\.\d+$/, '');
            if (cleanClipName !== clip.name && !clipMap.has(cleanClipName)) {
              clipMap.set(cleanClipName, clip);
            }
          }
          const isTripoHero = key === 'gunslinger_tripo' || key === 'mage_tripo' || key === 'warrior_tripo';
          const isTripoWeapon =
            key === 'shotgun_tripo' ||
            key === 'pistol_tripo' ||
            key === 'smg_tripo' ||
            key === 'ak47_tripo' ||
            key === 'sword_tripo' ||
            key === 'spear_tripo' ||
            key === 'zweihander_tripo' ||
            key === 'axe_tripo' ||
            key === 'hammer_tripo' ||
            key === 'staff_tripo';
          const isTripoMonster =
            key === 'zombie_tripo' ||
            key === 'tree_tripo' ||
            key === 'dracula_tripo' ||
            key === 'mimic_tripo' ||
            key === 'chest_disguise_tripo' ||
            key === 'lich_tripo' ||
            key === 'troll_tripo' ||
            key === 'succubus_tripo' ||
            key === 'spider_tripo';
          const isTripoAsset = isTripoHero || isTripoWeapon || isTripoMonster;
          const eyeEmissiveTex = isTripoHero || key === 'tree_tripo' ? buildTripoSkullEyeEmissiveMap(key, gltf.scene) : null;
          const maxAniso = isMobile ? 2 : 16;
          gltf.scene.traverse((node) => {
            if (/^Icosphere/i.test(node.name || '')) {
              node.visible = false;
              return;
            }
            if (node.isMesh) {
              node.castShadow = true;
              node.receiveShadow = true;
              node.frustumCulled = false;
              if (isTripoAsset && node.material) {
                node.receiveShadow = false;
                const isEmbeddedWeapon = /HeroWeapon|Sword|Staff|Shotgun/i.test(node.name);
                const isStaffMesh = key === 'staff_tripo' || /Staff/i.test(node.name);
                const srcMats = Array.isArray(node.material) ? node.material : [node.material];
                const cleanMats = srcMats.map((m) => {
                  for (const t of [m.map, m.normalMap, m.roughnessMap, m.metalnessMap]) {
                    if (t) {
                      t.anisotropy = maxAniso;
                      t.minFilter = THREE.LinearMipmapLinearFilter;
                      t.magFilter = THREE.LinearFilter;
                      t.generateMipmaps = true;
                      t.needsUpdate = true;
                    }
                  }
                  const staffCutoutAlpha = isStaffMesh && m.map?.image ? buildStaffGlobeCutoutAlphaMap(m.map.image) : null;
                  const std = new THREE.MeshStandardMaterial({
                    map: m.map || null,
                    alphaMap: staffCutoutAlpha || null,
                    alphaTest: staffCutoutAlpha ? 0.5 : 0,
                    normalMap: m.normalMap || null,
                    normalScale: new THREE.Vector2(1.72, 1.72),
                    roughnessMap: m.roughnessMap || null,
                    metalnessMap: m.metalnessMap || null,
                    color: 0xffffff,
                    roughness: isTripoWeapon || isEmbeddedWeapon || key === 'warrior_tripo' ? 0.48 : 0.60,
                    metalness: isTripoWeapon || isEmbeddedWeapon || key === 'warrior_tripo' ? 0.46 : 0.20
                  });
                  if (eyeEmissiveTex && !isEmbeddedWeapon) {
                    std.emissiveMap = eyeEmissiveTex;
                    std.emissive.setHex(key === 'mage_tripo' ? 0xff5200 : 0xff7a00);
                    std.emissiveIntensity = 2.4;
                  }
                  return std;
                });
                node.material = Array.isArray(node.material) ? cleanMats : cleanMats[0];
              }
            }
          });
          gltfCache.set(key, { scene: gltf.scene, clips: clipMap });
          finish();
        },
        undefined,
        (err) => {
          if (attempt < 2 && !settled) {
            setTimeout(tryLoad, 220);
            return;
          }
          clearTimeout(timer);
          console.warn(`[models] Failed to load ${url}:`, err);
          finish();
        }
      );
    };
    tryLoad();
  });

  inFlightModelLoads.set(key, p);
  return p;
}

export async function ensureModelKeysLoaded(keys = []) {
  const valid = [...new Set(keys.filter((k) => k && MODEL_PATHS[k] && !gltfCache.has(k)))];
  if (valid.length === 0) return;
  const conc = isMobileRuntimeDevice() ? 2 : 4;
  let cursor = 0;
  const workers = Array.from({ length: Math.min(conc, valid.length) }, async () => {
    while (cursor < valid.length) {
      const k = valid[cursor++];
      await loadSingleModelKey(k);
    }
  });
  await Promise.all(workers);
}

export function getBootModelKeys(classId = 'warrior', weaponId = null, levelDef = null) {
  const set = new Set([
    getHeroAssetKey(classId),
    getWeaponAssetKey(weaponId || (classId === 'gunslinger' ? 'usp_pistol' : classId === 'mage' ? 'spark_staff' : 'club')),
    'zombie_tripo',
    'chest',
    'chest_gold',
    'skel_minion',
    'skel_warrior'
  ]);
  const pool = [
    ...(levelDef?.enemyPool || []),
    ...(levelDef?.enemies || []),
    ...Object.keys(levelDef?.enemyQuotas || {}),
    ...(levelDef?.miniBossPool || []),
    ...(levelDef?.finaleBosses || []),
    levelDef?.bossId,
    levelDef?.coBossId,
    levelDef?.finaleMiniBossType
  ];
  for (const eType of pool) {
    if (!eType) continue;
    const canon = ENEMY_TYPE_ALIASES?.[eType] || eType;
    const k = ENEMY_MODEL_CFG?.[canon]?.key || ENEMY_MODEL_CFG?.[eType]?.key;
    if (k && MODEL_PATHS[k]) set.add(k);
  }
  return [...set].filter(Boolean);
}

export function getMissingHeroOrWeaponKeys(classId = 'warrior', weaponId = null) {
  const out = [];
  const hk = getHeroAssetKey(classId);
  if (hk && MODEL_PATHS[hk] && !gltfCache.has(hk)) out.push(hk);
  const wk = getWeaponAssetKey(weaponId);
  if (wk && MODEL_PATHS[wk] && !gltfCache.has(wk)) out.push(wk);
  return out;
}

export function getMissingStageModelKeys(classId = 'warrior', weaponId = null, levelDef = null) {
  return getBootModelKeys(classId, weaponId, levelDef).filter((k) => !gltfCache.has(k));
}

export function preloadModels(onProgressOrOpts, maybeOpts = null) {
  if (preloadPromise) return preloadPromise;

  const opts = typeof onProgressOrOpts === 'object' && onProgressOrOpts !== null ? onProgressOrOpts : maybeOpts || {};
  const onProgress = typeof onProgressOrOpts === 'function' ? onProgressOrOpts : opts.onProgress;
  const allKeys = Object.keys(MODEL_PATHS);
  const priorityList = Array.isArray(opts.priorityKeys) && opts.priorityKeys.length > 0
    ? [...new Set(opts.priorityKeys.filter((k) => MODEL_PATHS[k]))]
    : null;

  // Fast Progressive Boot (iPhone / MacBook / Web): await ONLY Tier-1 essential keys before opening the Hub,
  // then stream all remaining heroes, weapons & late bosses smoothly in the background!
  const isMobile = isMobileRuntimeDevice();
  const tier1Keys = priorityList || [
    'warrior_tripo',
    'sword_tripo',
    'zombie_tripo',
    'chest',
    'chest_gold',
    'skel_minion',
    'skel_warrior',
    ...(isMobile ? [] : ['gunslinger_tripo', 'pistol_tripo', 'mage_tripo', 'staff_tripo'])
  ];
  const tier1Set = new Set(tier1Keys);
  const tier2Keys = allKeys.filter((k) => !tier1Set.has(k));

  let doneCount = 0;
  const markDone = () => {
    doneCount += 1;
    try {
      onProgress?.(doneCount, tier1Keys.length);
    } catch {
      // ignore progress callback error
    }
  };

  const concTier1 = isMobile ? 2 : 4;
  let idx1 = 0;
  preloadPromise = (async () => {
    const workers1 = Array.from({ length: Math.min(concTier1, tier1Keys.length) }, async () => {
      while (idx1 < tier1Keys.length) {
        const k = tier1Keys[idx1++];
        await loadSingleModelKey(k);
        markDone();
      }
    });
    await Promise.all(workers1);

    // Kick off non-blocking background streaming of remaining models right after Hub unlocks!
    if (tier2Keys.length > 0) {
      const concTier2 = isMobile ? 2 : 3;
      let idx2 = 0;
      const runBg = () => {
        Array.from({ length: Math.min(concTier2, tier2Keys.length) }, async () => {
          while (idx2 < tier2Keys.length) {
            const k = tier2Keys[idx2++];
            await loadSingleModelKey(k);
          }
        });
      };
      setTimeout(runBg, isMobile ? 450 : 120);
    }
  })();

  return preloadPromise;
}

const sharedGeo = new Map();
function getGeo(key, fn) {
  if (!sharedGeo.has(key)) sharedGeo.set(key, fn());
  return sharedGeo.get(key);
}

const sharedMat = new Map();
function getMat(key, fn) {
  if (!sharedMat.has(key)) sharedMat.set(key, fn());
  return sharedMat.get(key);
}

// Pre-computed KayKit bone target quaternions for Two-Handed Forward Carry (Gunslinger, Archer, Bomber)
const GUN_UPPER_ARM_L_Q = new THREE.Quaternion(-0.136, -0.396, -0.900, 0.123).normalize();
const GUN_LOWER_ARM_L_Q = new THREE.Quaternion(0, 0, -0.415, 0.910).normalize();
const GUN_UPPER_ARM_R_Q = new THREE.Quaternion(-0.275, 0.025, 0.938, 0.210).normalize();
const GUN_LOWER_ARM_R_Q = new THREE.Quaternion(0, 0, 0.705, 0.709).normalize();

const GUN_RELOAD_LOWER_L_Q = new THREE.Quaternion(0, 0, -0.640, 0.768).normalize();
const _tmpQuatA = new THREE.Quaternion();
const _tmpQuatB = new THREE.Quaternion();
const _recoilPitchQuat = new THREE.Quaternion();
const _xAxis = new THREE.Vector3(1, 0, 0);

// ============================================================================
// Reference-Matched 3D Equipment Props Mounted to KayKit Rig Bones
// ============================================================================

function createCurvedHorn(mirror = 1, bloodTint = false) {
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(mirror * 0.30, 0.08, 0.02),
    new THREE.Vector3(mirror * 0.62, 0.20, 0.08),
    new THREE.Vector3(mirror * 0.54, 0.56, 0.16)
  );
  const geo = getGeo(`horn_v2_${mirror}`, () => new THREE.TubeGeometry(curve, 10, 0.072, 8, false));
  const hornMat = getMat(bloodTint ? 'horn_blood_mat' : 'horn_bone_mat', () =>
    new THREE.MeshStandardMaterial({
      color: bloodTint ? 0xd6c7b2 : 0xf3e5c8,
      emissive: bloodTint ? 0x7f1d1d : 0x000000,
      emissiveIntensity: bloodTint ? 0.35 : 0,
      roughness: 0.45,
      metalness: 0.12
    })
  );
  const mesh = new THREE.Mesh(geo, hornMat);
  const tip = new THREE.Mesh(
    getGeo('horn_tip_v2', () => new THREE.ConeGeometry(0.068, 0.20, 8)),
    hornMat
  );
  tip.position.set(mirror * 0.53, 0.63, 0.17);
  tip.rotation.z = -mirror * 0.22;
  const grp = new THREE.Group();
  grp.add(mesh, tip);
  return grp;
}

function createBackpackWithBedroll() {
  const grp = new THREE.Group();
  const leatherMat = getMat('pack_leather', () => new THREE.MeshStandardMaterial({ color: 0x6b4c35, roughness: 0.78, metalness: 0.1 }));
  const darkStrapMat = getMat('pack_strap', () => new THREE.MeshStandardMaterial({ color: 0x3b281c, roughness: 0.8, metalness: 0.15 }));
  const buckleMat = getMat('pack_buckle_mat', () => new THREE.MeshStandardMaterial({ color: 0xd4a359, roughness: 0.35, metalness: 0.75 }));

  const pack = new THREE.Mesh(getGeo('pack_body', () => new THREE.BoxGeometry(0.52, 0.54, 0.30)), leatherMat);
  pack.castShadow = true;
  const flap = new THREE.Mesh(getGeo('pack_flap', () => new THREE.BoxGeometry(0.54, 0.18, 0.32)), darkStrapMat);
  flap.position.y = 0.20;

  const roll = new THREE.Mesh(
    getGeo('pack_roll', () => {
      const cg = new THREE.CylinderGeometry(0.13, 0.13, 0.56, 12);
      cg.rotateZ(Math.PI / 2);
      return cg;
    }),
    darkStrapMat
  );
  roll.position.set(0, 0.36, -0.02);

  const pouch = new THREE.Mesh(getGeo('pack_pouch', () => new THREE.BoxGeometry(0.18, 0.24, 0.14)), leatherMat);
  pouch.position.set(-0.28, -0.08, 0);
  const buckle = new THREE.Mesh(getGeo('pack_buckle', () => new THREE.BoxGeometry(0.10, 0.08, 0.04)), buckleMat);
  buckle.position.set(0, 0.12, -0.17);

  grp.add(pack, flap, roll, pouch, buckle);
  return grp;
}

function createSkullShield(molten = false) {
  const grp = new THREE.Group();
  const woodMat = getMat(molten ? 'sh_obsidian_mat' : 'sh_wood_mat', () =>
    new THREE.MeshStandardMaterial({
      color: molten ? 0x290909 : 0x5c4033,
      emissive: molten ? 0x9a3412 : 0x000000,
      emissiveIntensity: molten ? 0.45 : 0,
      roughness: molten ? 0.45 : 0.75,
      metalness: molten ? 0.55 : 0.1
    })
  );
  const rimMat = getMat(molten ? 'sh_gold_rim_mat' : 'sh_iron_rim_mat', () =>
    new THREE.MeshStandardMaterial({
      color: molten ? 0xfbbf24 : 0x6b7280,
      emissive: molten ? 0xd97706 : 0x000000,
      emissiveIntensity: molten ? 0.5 : 0,
      roughness: 0.32,
      metalness: 0.82
    })
  );
  const boneMat = getMat(molten ? 'sh_molten_skull_mat' : 'sh_bone_mat', () =>
    new THREE.MeshStandardMaterial({
      color: molten ? 0xfde68a : 0xd6cfc2,
      emissive: molten ? 0xea580c : 0x000000,
      emissiveIntensity: molten ? 0.65 : 0,
      roughness: 0.45,
      metalness: molten ? 0.35 : 0.1
    })
  );

  const disc = new THREE.Mesh(
    getGeo('sh_disc', () => {
      const cg = new THREE.CylinderGeometry(0.46, 0.46, 0.08, 18);
      cg.rotateX(Math.PI / 2);
      return cg;
    }),
    woodMat
  );
  const rim = new THREE.Mesh(getGeo('sh_rim', () => new THREE.TorusGeometry(0.46, 0.055, 8, 20)), rimMat);
  const skullBoss = new THREE.Mesh(getGeo('sh_skull', () => new THREE.SphereGeometry(0.17, 10, 10)), boneMat);
  skullBoss.scale.set(0.95, 1.05, 0.65);
  skullBoss.position.set(0, 0.03, 0.05);
  const jaw = new THREE.Mesh(getGeo('sh_jaw', () => new THREE.BoxGeometry(0.16, 0.10, 0.09)), boneMat);
  jaw.position.set(0, -0.11, 0.05);

  grp.add(disc, rim, skullBoss, jaw);
  grp.position.set(0.08, 0.05, 0.14);
  grp.rotation.y = 0.22;
  return grp;
}

const ELEMENT_STAFF_COLORS = {
  fire: { color: 0xff6b35, emissive: 0xea580c },
  water: { color: 0x38bdf8, emissive: 0x0284c7 },
  lightning: { color: 0xfef08a, emissive: 0x06b6d4 },
  air: { color: 0x99f6e4, emissive: 0x14b8a6 }
};

function createHeroWeaponMesh(weaponId, mageElement = null) {
  const grp = new THREE.Group();
  const ironMat = getMat('hw_iron', () => new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.80, roughness: 0.26 }));
  const darkIronMat = getMat('hw_dark_iron', () => new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.78, roughness: 0.32 }));
  const walnutMat = getMat('hw_walnut', () => new THREE.MeshStandardMaterial({ color: 0x6b3e20, roughness: 0.68, metalness: 0.08 }));
  const leatherMat = getMat('hw_leather', () => new THREE.MeshStandardMaterial({ color: 0x3b2314, roughness: 0.82, metalness: 0.10 }));
  const brassMat = getMat('hw_brass', () => new THREE.MeshStandardMaterial({ color: 0xe09f3e, metalness: 0.85, roughness: 0.24 }));
  const shellHullMat = getMat('hw_shell_hull', () => new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.45, metalness: 0.15 }));

  // === WARRIOR WEAPONS (Sword, Spear, Zweihander, Sekira Axe & Boss Warhammer in RightHand!) ===
  if (
    weaponId === 'club' ||
    weaponId === 'spear' ||
    weaponId === 'zweihander' ||
    weaponId === 'axe' ||
    weaponId === 'boss_hammer' ||
    weaponId === 'cleaver' ||
    weaponId === 'flail'
  ) {
    const assetKey =
      weaponId === 'spear' || weaponId === 'cleaver'
        ? 'spear_tripo'
        : weaponId === 'zweihander'
          ? 'zweihander_tripo'
          : weaponId === 'axe' || weaponId === 'flail'
            ? 'axe_tripo'
            : weaponId === 'boss_hammer'
              ? 'hammer_tripo'
              : 'sword_tripo';
    const tripoMelee = gltfCache.get(assetKey) || gltfCache.get('sword_tripo');
    if (tripoMelee?.scene) {
      const swClone = tripoMelee.scene.clone(true);
      const isSwordAsset = assetKey === 'sword_tripo';
      if (isSwordAsset) {
        const swScale = 0.0060;
        swClone.scale.setScalar(swScale);
        swClone.position.set(
          -78.2 * Math.cos(0.174533) * swScale,
          0.048 + 78.2 * Math.sin(0.174533) * swScale,
          -0.032
        );
        swClone.rotation.set(Math.PI, 0.0, 1.39626);
      } else {
        // Upright Tripo GLBs (Spear, Zweihander, Axe, Hammer): pommel at Y=0, tip at Y=0.98
        // Rotating Z by +1.39626 aligns +Y tip outward along (-X, +Y) matching HeroWeapon_Sword!
        const wScale =
          assetKey === 'spear_tripo'
            ? 1.05
            : assetKey === 'zweihander_tripo'
              ? 0.90
              : assetKey === 'hammer_tripo'
                ? 0.78
                : 0.72;
        const gripFrac =
          assetKey === 'spear_tripo'
            ? 0.36
            : assetKey === 'zweihander_tripo'
              ? 0.14
              : assetKey === 'hammer_tripo'
                ? 0.24
                : 0.26;
        const gripOff = gripFrac * wScale;
        swClone.scale.setScalar(wScale);
        swClone.position.set(
          gripOff * Math.cos(0.174533),
          0.048 - gripOff * Math.sin(0.174533),
          -0.032
        );
        swClone.rotation.set(0.0, 0.0, 1.39626);
      }

      swClone.traverse((n) => {
        if (n.isMesh && n.material) {
          n.castShadow = true;
          n.receiveShadow = false;
          n.frustumCulled = false;
          const m = n.material.clone();
          if (m.color) m.color.setHex(0xffffff);
          n.material = m;
        }
      });
      grp.add(swClone);
      return grp;
    }
    const isFlail = weaponId === 'flail';
    const isCleaver = weaponId === 'cleaver';
    const grip = new THREE.Mesh(
      getGeo('w_sw_grip', () => new THREE.CylinderGeometry(0.042, 0.048, 0.34, 8)),
      walnutMat
    );
    const guard = new THREE.Mesh(
      getGeo(isFlail ? 'w_sw_guard_wide' : 'w_sw_guard', () => new THREE.BoxGeometry(isFlail ? 0.48 : 0.36, 0.085, 0.13)),
      brassMat
    );
    guard.position.y = 0.16;

    const bladeW = isFlail ? 0.26 : isCleaver ? 0.29 : 0.19;
    const bladeH = isFlail ? 1.24 : isCleaver ? 1.08 : 0.88;
    const bladeMat = isFlail
      ? getMat('hw_cinder_blade', () => new THREE.MeshStandardMaterial({ color: 0xfde68a, emissive: 0xd97706, emissiveIntensity: 0.65, metalness: 0.82, roughness: 0.20 }))
      : isCleaver
        ? getMat('hw_cleaver_blade', () => new THREE.MeshStandardMaterial({ color: 0xd1d5db, emissive: 0x991b1b, emissiveIntensity: 0.32, metalness: 0.82, roughness: 0.22 }))
        : ironMat;

    const blade = new THREE.Mesh(
      getGeo(`w_blade_${weaponId}`, () => new THREE.BoxGeometry(bladeW, bladeH, 0.055)),
      bladeMat
    );
    blade.position.y = 0.20 + bladeH * 0.5;
    const tip = new THREE.Mesh(
      getGeo(`w_tip_${weaponId}`, () => {
        const cg = new THREE.ConeGeometry(bladeW * 0.52, 0.24, 4);
        cg.rotateY(Math.PI / 4);
        return cg;
      }),
      bladeMat
    );
    tip.scale.set(1, 1, 0.32);
    tip.position.y = 0.20 + bladeH + 0.11;
    grp.add(grip, guard, blade, tip);
    grp.rotation.x = Math.PI * 0.38;
    return grp;
  }

  // === GUNSLINGER DARK-FANTASY SHOTGUNS, TACTICAL USP, COLT REVOLVER, SMG & AK-47 ===
  if (weaponId === 'colt') {
    const chromeMat = getMat('hw_colt_chrome', () =>
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.90, roughness: 0.18 })
    );
    const frameMat = getMat('hw_colt_frame', () =>
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.24 })
    );
    const revGrp = new THREE.Group();

    const barrel = new THREE.Mesh(
      getGeo('colt_barrel', () => new THREE.BoxGeometry(0.044, 0.058, 0.28)),
      chromeMat
    );
    barrel.position.set(0, 0.095, 0.21);

    const underlug = new THREE.Mesh(
      getGeo('colt_lug', () => new THREE.BoxGeometry(0.034, 0.032, 0.24)),
      frameMat
    );
    underlug.position.set(0, 0.056, 0.195);

    const topRib = new THREE.Mesh(
      getGeo('colt_rib', () => new THREE.BoxGeometry(0.032, 0.016, 0.29)),
      darkIronMat
    );
    topRib.position.set(0, 0.130, 0.205);

    const frontSight = new THREE.Mesh(
      getGeo('colt_sight', () => new THREE.BoxGeometry(0.014, 0.022, 0.028)),
      brassMat
    );
    frontSight.position.set(0, 0.142, 0.33);

    const frame = new THREE.Mesh(
      getGeo('colt_frame', () => new THREE.BoxGeometry(0.052, 0.092, 0.175)),
      frameMat
    );
    frame.position.set(0, 0.072, 0.015);

    const cylinder = new THREE.Mesh(
      getGeo('colt_cyl', () => {
        const cg = new THREE.CylinderGeometry(0.048, 0.048, 0.088, 12);
        cg.rotateX(Math.PI * 0.5);
        return cg;
      }),
      chromeMat
    );
    cylinder.position.set(0, 0.082, 0.038);

    const brassPin = new THREE.Mesh(
      getGeo('colt_pin', () => {
        const cg = new THREE.CylinderGeometry(0.012, 0.012, 0.105, 8);
        cg.rotateX(Math.PI * 0.5);
        return cg;
      }),
      brassMat
    );
    brassPin.position.set(0, 0.082, 0.042);

    const triggerGuard = new THREE.Mesh(
      getGeo('colt_tguard', () => new THREE.TorusGeometry(0.030, 0.007, 6, 12)),
      darkIronMat
    );
    triggerGuard.rotation.y = Math.PI * 0.5;
    triggerGuard.position.set(0, 0.012, 0.015);

    const hammer = new THREE.Mesh(
      getGeo('colt_hammer', () => new THREE.BoxGeometry(0.016, 0.032, 0.028)),
      brassMat
    );
    hammer.position.set(0, 0.122, -0.068);
    hammer.rotation.x = -0.55;

    const grip = new THREE.Mesh(
      getGeo('colt_grip', () => new THREE.BoxGeometry(0.048, 0.145, 0.068)),
      walnutMat
    );
    grip.position.set(0, -0.036, -0.055);
    grip.rotation.x = 0.34;

    const pommel = new THREE.Mesh(
      getGeo('colt_pommel', () => new THREE.BoxGeometry(0.052, 0.024, 0.072)),
      brassMat
    );
    pommel.position.set(0, -0.102, -0.078);
    pommel.rotation.x = 0.34;

    revGrp.add(barrel, underlug, topRib, frontSight, frame, cylinder, brassPin, triggerGuard, hammer, grip, pommel);
    revGrp.traverse((n) => {
      if (n.isMesh) {
        n.castShadow = true;
        n.receiveShadow = true;
        n.frustumCulled = false;
      }
    });
    grp.add(revGrp);
    grp.userData.tripoShotgun = revGrp;
    grp.userData.baseZ = 0.04;
    return grp;
  }

  if (
    (weaponId === 'usp_pistol' && gltfCache.has('pistol_tripo')) ||
    (weaponId === 'smg' && gltfCache.has('smg_tripo')) ||
    (weaponId === 'ak47' && gltfCache.has('ak47_tripo'))
  ) {
    const gunKey = weaponId === 'smg' ? 'smg_tripo' : weaponId === 'ak47' ? 'ak47_tripo' : 'pistol_tripo';
    const pClone = gltfCache.get(gunKey).scene.clone(true);
    const pScale = weaponId === 'usp_pistol' ? 0.25 : weaponId === 'smg' ? 0.42 : 0.56;
    pClone.scale.setScalar(pScale);
    if (gunKey === 'smg_tripo' || gunKey === 'ak47_tripo') {
      // SMG & AK-47 barrels point +X in glTF -> rotate -90 deg around Y to aim +Z forward
      pClone.rotation.y = -Math.PI * 0.5;
      pClone.position.set(0, -0.045, 0.02);
    } else {
      pClone.position.set(0, -0.015, 0.04);
    }
    pClone.traverse((n) => {
      if (n.isMesh && n.material) {
        n.castShadow = true;
        n.receiveShadow = true;
        n.frustumCulled = false;
      }
    });
    grp.add(pClone);
    grp.userData.tripoShotgun = pClone;
    grp.userData.baseZ = 0.16;
    return grp;
  }
  if (
    weaponId === 'pistol' ||
    weaponId === 'usp_pistol' ||
    weaponId === 'smg' ||
    weaponId === 'ak47' ||
    weaponId === 'blunderbuss' ||
    weaponId === 'gatling'
  ) {
    const tripoShotgun = gltfCache.get('shotgun_tripo');
    if (tripoShotgun?.scene) {
      const sgClone = tripoShotgun.scene.clone(true);
      const sgScale = weaponId === 'blunderbuss' ? 0.0086 : weaponId === 'gatling' ? 0.0083 : 0.0080;
      sgClone.scale.setScalar(sgScale);
      // Center receiver balance point (raw Y=+10, Z=+26 in Blender -> Z=-10, Y=+26 in glTF Y-up) right at gunCarryPivot (0,0,0)!
      sgClone.position.set(0, -26.0 * sgScale, 10.0 * sgScale);

      const accentHex =
        weaponId === 'gatling' ? 0x0284c7 : weaponId === 'blunderbuss' ? 0xd97706 : 0x000000;
      const accentInt = weaponId === 'gatling' ? 0.22 : weaponId === 'blunderbuss' ? 0.18 : 0.0;

      sgClone.traverse((n) => {
        if (n.isMesh && n.material) {
          n.castShadow = true;
          n.receiveShadow = true;
          n.frustumCulled = false;
          const m = n.material.clone();
          if (m.color) m.color.setHex(0xffffff);
          if (m.emissive && accentInt > 0) {
            m.emissive.setHex(accentHex);
            m.emissiveIntensity = accentInt;
          }
          n.material = m;
        }
      });

      grp.add(sgClone);
      grp.userData.tripoShotgun = sgClone;
      grp.userData.baseZ = 0.18;
      return grp;
    }

    // Fallback procedural shotgun if GLB has not loaded yet
    // 1. Chunky Walnut Buttstock + Iron Buttplate + Pistol Grip Wrist
    const stock = new THREE.Mesh(
      getGeo('sg_stock', () => new THREE.BoxGeometry(0.135, 0.19, 0.30)),
      walnutMat
    );
    stock.position.set(0, -0.04, -0.19);
    stock.rotation.x = 0.14;

    const buttPlate = new THREE.Mesh(
      getGeo('sg_butt', () => new THREE.BoxGeometry(0.142, 0.205, 0.04)),
      darkIronMat
    );
    buttPlate.position.set(0, -0.06, -0.34);
    buttPlate.rotation.x = 0.14;

    const gripWrist = new THREE.Mesh(
      getGeo('sg_wrist', () => new THREE.BoxGeometry(0.115, 0.15, 0.14)),
      walnutMat
    );
    gripWrist.position.set(0, -0.065, -0.03);
    gripWrist.rotation.x = 0.36;

    // 2. Forged Dark-Iron Receiver + Top Sight Rib + Brass Trim
    const receiver = new THREE.Mesh(
      getGeo('sg_recv', () => new THREE.BoxGeometry(0.165, 0.19, 0.32)),
      darkIronMat
    );
    receiver.position.set(0, 0.03, 0.09);

    const topRib = new THREE.Mesh(
      getGeo('sg_rib', () => new THREE.BoxGeometry(0.065, 0.032, 0.30)),
      ironMat
    );
    topRib.position.set(0, 0.135, 0.09);

    // 3. Brass Shell Side-Saddle Rack (4 crimson-and-brass shells ready on receiver side!)
    const saddleStrap = new THREE.Mesh(
      getGeo('sg_saddle', () => new THREE.BoxGeometry(0.182, 0.095, 0.24)),
      leatherMat
    );
    saddleStrap.position.set(0, 0.03, 0.09);
    grp.add(stock, buttPlate, gripWrist, receiver, topRib, saddleStrap);

    const shellHullGeo = getGeo('sg_shell_hull', () => new THREE.CylinderGeometry(0.020, 0.020, 0.082, 8));
    const shellBrassGeo = getGeo('sg_shell_brass', () => new THREE.CylinderGeometry(0.022, 0.022, 0.028, 8));
    for (let s = 0; s < 4; s++) {
      const sz = 0.00 + s * 0.056;
      const hull = new THREE.Mesh(shellHullGeo, shellHullMat);
      hull.position.set(-0.096, 0.025, sz);
      const brassBase = new THREE.Mesh(shellBrassGeo, brassMat);
      brassBase.position.set(-0.096, 0.068, sz);
      grp.add(hull, brassBase);
    }

    if (weaponId === 'gatling') {
      // «Шквал» — Revolving Brass-Iron Drum + Quad Barrel Shroud
      const drumBody = new THREE.Mesh(
        getGeo('sg_gat_drum', () => {
          const cg = new THREE.CylinderGeometry(0.155, 0.155, 0.20, 14);
          cg.rotateX(Math.PI / 2);
          return cg;
        }),
        darkIronMat
      );
      drumBody.position.set(0, -0.055, 0.23);

      const drumTrim = new THREE.Mesh(
        getGeo('sg_gat_drum_trim', () => {
          const cg = new THREE.CylinderGeometry(0.162, 0.162, 0.04, 14);
          cg.rotateX(Math.PI / 2);
          return cg;
        }),
        brassMat
      );
      drumTrim.position.set(0, -0.055, 0.23);

      const runeBandMat = getMat('hw_gat_rune', () =>
        new THREE.MeshStandardMaterial({ color: 0x7dd3fc, emissive: 0x0284c7, emissiveIntensity: 1.4, roughness: 0.2 })
      );
      const runeCore = new THREE.Mesh(
        getGeo('sg_gat_rune_ring', () => new THREE.TorusGeometry(0.158, 0.016, 6, 16)),
        runeBandMat
      );
      runeCore.position.set(0, -0.055, 0.32);

      const gatlingCluster = new THREE.Group();
      gatlingCluster.position.set(0, 0.065, 0.51);
      const gatBrlGeo = getGeo('sg_gat_brl', () => {
        const cg = new THREE.CylinderGeometry(0.034, 0.036, 0.54, 8);
        cg.rotateX(Math.PI / 2);
        return cg;
      });
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
        const brl = new THREE.Mesh(gatBrlGeo, ironMat);
        brl.position.set(Math.cos(a) * 0.055, Math.sin(a) * 0.055, 0);
        gatlingCluster.add(brl);
      }

      const shroudGeo = getGeo('sg_gat_shroud', () => {
        const cg = new THREE.CylinderGeometry(0.112, 0.112, 0.055, 12);
        cg.rotateX(Math.PI / 2);
        return cg;
      });
      const shroudMid = new THREE.Mesh(shroudGeo, brassMat);
      shroudMid.position.z = -0.04;
      const shroudFront = new THREE.Mesh(shroudGeo, darkIronMat);
      shroudFront.position.z = 0.21;
      gatlingCluster.add(shroudMid, shroudFront);

      grp.add(drumBody, drumTrim, runeCore, gatlingCluster);
      grp.userData.gatlingCluster = gatlingCluster;
      return grp;
    }

    if (weaponId === 'blunderbuss') {
      // «Гром» — Twin Flared Brass-Iron Double-Barrel Blunderbuss
      const wideForend = new THREE.Mesh(
        getGeo('sg_blun_fore', () => new THREE.BoxGeometry(0.20, 0.115, 0.28)),
        walnutMat
      );
      wideForend.position.set(0, -0.01, 0.36);

      const brassStrap = new THREE.Mesh(
        getGeo('sg_blun_band', () => new THREE.BoxGeometry(0.225, 0.145, 0.048)),
        brassMat
      );
      brassStrap.position.set(0, 0.045, 0.48);
      grp.add(wideForend, brassStrap);

      const twinBrlGeo = getGeo('sg_blun_brl', () => {
        const cg = new THREE.CylinderGeometry(0.050, 0.056, 0.44, 10);
        cg.rotateX(Math.PI / 2);
        return cg;
      });
      // Note: after rotateX(+PI/2), radiusTop is at +Z (flared bell front!)
      const twinBellGeo = getGeo('sg_blun_bell', () => {
        const cg = new THREE.CylinderGeometry(0.092, 0.050, 0.15, 12);
        cg.rotateX(Math.PI / 2);
        return cg;
      });
      const boreGlowMat = getMat('hw_blun_bore', () =>
        new THREE.MeshStandardMaterial({ color: 0xfdba74, emissive: 0xea580c, emissiveIntensity: 1.25, roughness: 0.3 })
      );
      const boreGeo = getGeo('sg_blun_bore_disc', () => {
        const cg = new THREE.CylinderGeometry(0.068, 0.068, 0.02, 10);
        cg.rotateX(Math.PI / 2);
        return cg;
      });

      for (const ox of [-0.056, 0.056]) {
        const barrel = new THREE.Mesh(twinBrlGeo, darkIronMat);
        barrel.position.set(ox, 0.075, 0.45);
        const flaredBell = new THREE.Mesh(twinBellGeo, brassMat);
        flaredBell.position.set(ox, 0.075, 0.71);
        const bore = new THREE.Mesh(boreGeo, boreGlowMat);
        bore.position.set(ox, 0.075, 0.78);
        grp.add(barrel, flaredBell, bore);
      }
      return grp;
    }

    // Default 'pistol' («Охотничье ружьё»): Heavy Pump-Action Shotgun + Underbarrel Tube + Ribbed Walnut Forend
    const topBarrel = new THREE.Mesh(
      getGeo('sg_pump_brl', () => {
        const cg = new THREE.CylinderGeometry(0.050, 0.056, 0.52, 10);
        cg.rotateX(Math.PI / 2);
        return cg;
      }),
      ironMat
    );
    topBarrel.position.set(0, 0.085, 0.49);

    const muzzleChoke = new THREE.Mesh(
      getGeo('sg_pump_muz', () => {
        const cg = new THREE.CylinderGeometry(0.066, 0.054, 0.09, 10);
        cg.rotateX(Math.PI / 2);
        return cg;
      }),
      darkIronMat
    );
    muzzleChoke.position.set(0, 0.085, 0.74);

    const frontBead = new THREE.Mesh(
      getGeo('sg_pump_sight', () => new THREE.BoxGeometry(0.028, 0.045, 0.035)),
      brassMat
    );
    frontBead.position.set(0, 0.15, 0.75);

    const magTube = new THREE.Mesh(
      getGeo('sg_pump_mag', () => {
        const cg = new THREE.CylinderGeometry(0.038, 0.038, 0.44, 10);
        cg.rotateX(Math.PI / 2);
        return cg;
      }),
      darkIronMat
    );
    magTube.position.set(0, 0.008, 0.45);

    const barrelClamp = new THREE.Mesh(
      getGeo('sg_pump_clamp', () => new THREE.BoxGeometry(0.11, 0.155, 0.045)),
      brassMat
    );
    barrelClamp.position.set(0, 0.048, 0.63);

    const pumpForend = new THREE.Mesh(
      getGeo('sg_pump_fore', () => {
        const cg = new THREE.CylinderGeometry(0.064, 0.064, 0.26, 10);
        cg.rotateX(Math.PI / 2);
        return cg;
      }),
      walnutMat
    );
    pumpForend.position.set(0, -0.012, 0.39);
    pumpForend.userData.baseZ = 0.39;

    grp.add(topBarrel, muzzleChoke, frontBead, magTube, barrelClamp, pumpForend);
    grp.userData.pumpForend = pumpForend;
    return grp;
  }

  // === MAGE WEAPONS (4K Tripo Magic Staff in RightHand + Elemental Orb Glow!) ===
  const elCols = mageElement && ELEMENT_STAFF_COLORS[mageElement] ? ELEMENT_STAFF_COLORS[mageElement] : null;
  const crystalColor = elCols
    ? elCols.color
    : weaponId === 'cinder_tome'
      ? 0xf43f5e
      : weaponId === 'void_orb'
        ? 0x818cf8
        : 0xc084fc;
  const crystalEmissive = elCols
    ? elCols.emissive
    : weaponId === 'cinder_tome'
      ? 0xe11d48
      : weaponId === 'void_orb'
        ? 0x4f46e5
        : 0x9333ea;

  const tripoStaff = gltfCache.get('staff_tripo');
  if (tripoStaff?.scene) {
    const stClone = tripoStaff.scene.clone(true);
    const stScale = weaponId === 'void_orb' ? 0.0102 : weaponId === 'cinder_tome' ? 0.0099 : 0.0096;
    const ratio = stScale / 0.0096;
    stClone.scale.setScalar(stScale);
    stClone.position.set(-0.25509 * ratio, 0.03638, -0.26418 * ratio);
    stClone.quaternion.set(0.18785, -0.40613, -0.70380, 0.55176);

    stClone.traverse((n) => {
      if (n.isMesh && n.material) {
        n.castShadow = true;
        n.receiveShadow = false;
        n.frustumCulled = false;
        const m = n.material.clone();
        if (m.color) m.color.setHex(0xffffff);
        n.material = m;
      }
    });

    // Subtle additive elemental aura around the staff's top crystal sphere (-3.63, 80.82, 0.38 in staff local space)
    const orbAura = new THREE.Mesh(
      getGeo('tripo_staff_orb_aura', () => new THREE.SphereGeometry(10.6, 14, 14)),
      new THREE.MeshBasicMaterial({
        color: crystalColor,
        transparent: true,
        opacity: 0.30,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    orbAura.position.set(-3.63, 80.82, 0.38);
    stClone.add(orbAura);
    grp.add(stClone);
    return grp;
  }

  const staffPole = new THREE.Mesh(
    getGeo('m_pole', () => new THREE.CylinderGeometry(0.042, 0.048, 1.65, 8)),
    walnutMat
  );
  staffPole.position.y = 0.52;
  const collar = new THREE.Mesh(getGeo('m_collar', () => new THREE.CylinderGeometry(0.11, 0.07, 0.14, 8)), brassMat);
  collar.position.y = 1.32;
  const mainCrystal = new THREE.Mesh(
    getGeo('m_crystal', () => new THREE.OctahedronGeometry(0.22, 0)),
    new THREE.MeshStandardMaterial({
      color: crystalColor,
      emissive: crystalEmissive,
      emissiveIntensity: 1.65,
      roughness: 0.15,
      metalness: 0.1
    })
  );
  mainCrystal.scale.set(0.85, 1.45, 0.85);
  mainCrystal.position.y = 1.58;

  for (let i = 0; i < 3; i++) {
    const shard = new THREE.Mesh(
      getGeo('m_shard', () => new THREE.OctahedronGeometry(0.065, 0)),
      mainCrystal.material
    );
    const a = (i / 3) * Math.PI * 2;
    shard.position.set(Math.cos(a) * 0.24, 1.56 + (i - 1) * 0.08, Math.sin(a) * 0.24);
    grp.add(shard);
  }

  grp.add(staffPole, collar, mainCrystal);
  return grp;
}

// ============================================================================
// 3D ARSENAL SHOWCASE WEAPON FACTORY (Floats & Spins 360° above Golden Pedestal!)
// ============================================================================
export function createArsenalShowcaseWeapon(weaponId = 'club', mageElement = 'water', isLocked = false) {
  const root = new THREE.Group();
  const floatPivot = new THREE.Group();
  const tiltPivot = new THREE.Group();
  root.add(floatPivot);
  floatPivot.add(tiltPivot);

  let rawModel = null;
  const isSword =
    weaponId === 'club' ||
    weaponId === 'spear' ||
    weaponId === 'zweihander' ||
    weaponId === 'axe' ||
    weaponId === 'boss_hammer' ||
    weaponId === 'cleaver' ||
    weaponId === 'flail';
  const isShotgun =
    weaponId === 'pistol' ||
    weaponId === 'usp_pistol' ||
    weaponId === 'colt' ||
    weaponId === 'smg' ||
    weaponId === 'ak47' ||
    weaponId === 'blunderbuss' ||
    weaponId === 'gatling';

  if (weaponId === 'spear' || weaponId === 'cleaver') {
    rawModel = gltfCache.has('spear_tripo')
      ? gltfCache.get('spear_tripo').scene.clone(true)
      : gltfCache.get('sword_tripo')?.scene.clone(true) || createHeroWeaponMesh(weaponId, mageElement);
  } else if (weaponId === 'zweihander') {
    rawModel = gltfCache.has('zweihander_tripo')
      ? gltfCache.get('zweihander_tripo').scene.clone(true)
      : gltfCache.get('sword_tripo')?.scene.clone(true) || createHeroWeaponMesh(weaponId, mageElement);
  } else if (weaponId === 'axe' || weaponId === 'flail') {
    rawModel = gltfCache.has('axe_tripo')
      ? gltfCache.get('axe_tripo').scene.clone(true)
      : gltfCache.get('sword_tripo')?.scene.clone(true) || createHeroWeaponMesh(weaponId, mageElement);
  } else if (weaponId === 'boss_hammer') {
    rawModel = gltfCache.has('hammer_tripo')
      ? gltfCache.get('hammer_tripo').scene.clone(true)
      : gltfCache.get('sword_tripo')?.scene.clone(true) || createHeroWeaponMesh(weaponId, mageElement);
  } else if (weaponId === 'colt') {
    rawModel = createHeroWeaponMesh('colt', null);
  } else if (weaponId === 'usp_pistol' && gltfCache.has('pistol_tripo')) {
    rawModel = gltfCache.get('pistol_tripo').scene.clone(true);
  } else if (weaponId === 'smg' && gltfCache.has('smg_tripo')) {
    rawModel = gltfCache.get('smg_tripo').scene.clone(true);
  } else if (weaponId === 'ak47' && gltfCache.has('ak47_tripo')) {
    rawModel = gltfCache.get('ak47_tripo').scene.clone(true);
  } else if (isSword && gltfCache.has('sword_tripo')) {
    rawModel = gltfCache.get('sword_tripo').scene.clone(true);
  } else if (isShotgun && gltfCache.has('shotgun_tripo')) {
    rawModel = gltfCache.get('shotgun_tripo').scene.clone(true);
  } else if (!isSword && !isShotgun && gltfCache.has('staff_tripo')) {
    rawModel = gltfCache.get('staff_tripo').scene.clone(true);
  } else {
    rawModel = createHeroWeaponMesh(weaponId, mageElement);
  }

  let tintHex = 0x000000;
  let tintInt = 0;
  if (weaponId === 'blunderbuss') { tintHex = 0xea580c; tintInt = 0.22; }
  else if (weaponId === 'gatling') { tintHex = 0x0284c7; tintInt = 0.25; }

  rawModel.traverse((n) => {
    if (n.isMesh && n.material) {
      n.castShadow = true;
      n.receiveShadow = false;
      const list = Array.isArray(n.material) ? n.material.map((m) => m.clone()) : [n.material.clone()];
      for (const m of list) {
        if (isLocked) {
          if (m.color) m.color.setHex(0x524c66);
          m.roughness = 0.72;
        } else {
          if (m.color) m.color.setHex(0xffffff);
          if (m.emissive && tintInt > 0) {
            m.emissive.setHex(tintHex);
            m.emissiveIntensity = tintInt;
          }
        }
      }
      n.material = Array.isArray(n.material) ? list : list[0];
    }
  });

  let showcaseStaffVfx = null;
  if (!isSword && !isShotgun && gltfCache.has('staff_tripo') && !isLocked) {
    showcaseStaffVfx = createLivingStaffOrbVfx(9.95, mageElement || 'water');
    showcaseStaffVfx.group.position.set(-3.8114, 81.55, 0.3818);
    rawModel.add(showcaseStaffVfx.group);
  }

  // Normalize bounding box to a crisp heroic ~1.82m showcase span centered at (0,0,0)!
  rawModel.position.set(0, 0, 0);
  rawModel.rotation.set(0, 0, 0);
  rawModel.scale.setScalar(1);
  rawModel.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(rawModel);
  const sz = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(sz.x, sz.y, sz.z, 0.001);
  const targetSpan =
    weaponId === 'usp_pistol'
      ? 1.32
      : weaponId === 'colt'
        ? 1.44
        : weaponId === 'spear'
          ? 2.10
          : weaponId === 'zweihander'
            ? 1.98
            : isShotgun
              ? 1.88
              : isSword
                ? 1.82
                : 1.92;
  const normScale = targetSpan / maxDim;
  rawModel.scale.setScalar(normScale);
  rawModel.updateMatrixWorld(true);
  const centeredBox = new THREE.Box3().setFromObject(rawModel);
  const center = centeredBox.getCenter(new THREE.Vector3());
  rawModel.position.sub(center);

  // Melee & Staves float vertically at a 42° heroic angle; Firearms ALWAYS float horizontally in sleek profile!
  const orientWrap = new THREE.Group();
  orientWrap.add(rawModel);
  if (isShotgun) {
    if (sz.z > sz.x) {
      orientWrap.rotation.y = Math.PI * 0.5;
    }
    tiltPivot.add(orientWrap);
    tiltPivot.rotation.z = 0.14;
    tiltPivot.rotation.x = 0.08;
  } else {
    if (sz.z > sz.y && sz.z > sz.x) {
      orientWrap.rotation.x = -Math.PI * 0.5;
    } else if (sz.x > sz.y && sz.x > sz.z) {
      orientWrap.rotation.z = Math.PI * 0.5;
    }
    tiltPivot.add(orientWrap);
    tiltPivot.rotation.z = -0.68;
    tiltPivot.rotation.x = 0.14;
  }

  root.position.set(0, 1.02, 0.12);

  function update(dt = 0.016, elapsedTime = 0) {
    floatPivot.position.y = Math.sin(elapsedTime * 2.1) * 0.055;
    showcaseStaffVfx?.updateVfx(elapsedTime, 0);
  }

  return { root, update };
}

function createMagePotionFlask() {
  const grp = new THREE.Group();
  const glass = new THREE.Mesh(
    getGeo('pot_glass', () => new THREE.SphereGeometry(0.13, 10, 10)),
    getMat('pot_glass_mat', () =>
      new THREE.MeshStandardMaterial({
        color: 0x93c5fd,
        emissive: 0x6366f1,
        emissiveIntensity: 1.35,
        roughness: 0.15
      })
    )
  );
  const neck = new THREE.Mesh(
    getGeo('pot_neck', () => new THREE.CylinderGeometry(0.05, 0.06, 0.10, 8)),
    getMat('pot_neck_mat', () => new THREE.MeshStandardMaterial({ color: 0xa78bfa, roughness: 0.3 }))
  );
  neck.position.y = 0.13;
  grp.add(glass, neck);
  grp.position.set(0, 0.08, 0.08);
  return grp;
}

function createAnimController(modelRoot, clipMap, idleClipName = 'Idle', moveClipName = 'Running_A') {
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
  let activeAttackAction = null;

  function setBaseState(clipName, timeScale = 1.0) {
    const next = getAction(clipName) || getAction('Idle');
    if (!next) return;
    next.timeScale = timeScale;
    if (currentBase === next) return;
    next.reset().fadeIn(0.16).play();
    if (currentBase) currentBase.fadeOut(0.16);
    currentBase = next;
  }

  let activeDeathAction = null;

  function triggerOneShot(clipName, speed = 1.5) {
    if (activeDeathAction) return;
    const act = getAction(clipName);
    if (!act) return;
    if (activeAttackAction && activeAttackAction !== act) {
      activeAttackAction.fadeOut(0.08);
    }
    act.reset();
    act.setLoop(THREE.LoopOnce, 1);
    act.clampWhenFinished = false;
    act.timeScale = speed;
    act.weight = 1.0;
    act.fadeIn(0.05).play();
    activeAttackAction = act;
  }

  function triggerHit(speed = 1.85) {
    if (activeDeathAction) return false;
    const act = getAction('Hit_A') || getAction('Hit_B');
    if (!act) return false;
    act.reset();
    act.setLoop(THREE.LoopOnce, 1);
    act.clampWhenFinished = false;
    act.timeScale = speed;
    act.weight = 0.85;
    act.fadeIn(0.03).play();
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
    }
    if (activeAttackAction) {
      activeAttackAction.fadeOut(0.06);
      activeAttackAction = null;
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
    currentBase = null;
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

  return { mixer, setBaseState, syncPhase, triggerOneShot, triggerHit, triggerDeath, resetAlive };
}

// ============================================================================
// 1. HERO FACTORY — Exact Undead Chibi Skeleton Trio matching User Reference!
//    - gunslinger -> Skeleton_Rogue.glb (Hood + Red Scarf + Backpack + Two-Handed Forward Shotgun + Recoil/Reload!)
//    - warrior    -> Skeleton_Warrior.glb (Horned Iron Helm + Red Scarf + Sword & Skull Shield + Orange Eyes)
//    - mage       -> Skeleton_Mage.glb (Pointed Wizard Hat + Purple Robes + Crystal Staff & Potion + Orange Eyes)
// ============================================================================
const CLASS_SKELETON_ASSET = {
  warrior: 'skel_warrior',
  gunslinger: 'skel_rogue',
  mage: 'skel_mage'
};

const HERO_BASE_SCALE = 1.02;
const TRIPO_GUNSLINGER_SCALE = 1.98;
const GUN_PIVOT_BASE_X = 0.06;
const GUN_PIVOT_BASE_Y = 0.70;
const GUN_PIVOT_BASE_Z = 0.24;

const TRIPO_GUN_PIVOT_X = 0.02;
const TRIPO_GUN_PIVOT_Y = 0.78;
const TRIPO_GUN_PIVOT_Z = 0.34;

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

function setBoneRelEuler(boneEntry, rx = 0, ry = 0, rz = 0) {
  if (!boneEntry) return;
  _tmpEuler.set(rx, ry, rz, 'XYZ');
  _tmpDeltaQ.setFromEuler(_tmpEuler);
  boneEntry.node.quaternion.copy(boneEntry.restQ).multiply(_tmpDeltaQ);
}

// Exact 2-Bone Analytic Arm IK for Mixamo limbs (+Y local bone axis along limb)
function solveMixamoArmIK(upperEntry, foreEntry, handEntry, targetWorldPos, poleWorldPos) {
  if (!upperEntry || !foreEntry || !handEntry) return;
  const uNode = upperEntry.node;
  const fNode = foreEntry.node;
  const hNode = handEntry.node;
  if (!uNode.parent) return;

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
  if (L1 < 1e-4 || L2 < 1e-4) return;

  _ikDir.subVectors(targetWorldPos, _ikShoulderW);
  const rawDist = _ikDir.length();
  if (rawDist < 1e-4) return;
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
  const uRestDir = _yUnit.clone().applyQuaternion(upperEntry.restQ).normalize();
  _ikRotQ.setFromUnitVectors(uRestDir, _ikDesiredLocal);
  uNode.quaternion.copy(_ikRotQ).multiply(upperEntry.restQ);
  uNode.updateMatrixWorld(true);

  // Rotate ForeArm so its +Y axis points at targetWorldPos
  fNode.getWorldPosition(_ikElbowW);
  uNode.getWorldQuaternion(_ikParentWorldQ);
  _ikDesiredLocal.subVectors(targetWorldPos, _ikElbowW).normalize();
  _ikDesiredLocal.applyQuaternion(_ikParentWorldQ.invert());
  const fRestDir = _yUnit.clone().applyQuaternion(foreEntry.restQ).normalize();
  _ikRotQ.setFromUnitVectors(fRestDir, _ikDesiredLocal);
  fNode.quaternion.copy(_ikRotQ).multiply(foreEntry.restQ);
  fNode.updateMatrixWorld(true);
}

export function createHeroMesh(classId = 'warrior', weaponId = null, mageElement = 'fire') {
  if (classId && typeof classId === 'object') {
    const opts = classId;
    weaponId = opts.weaponId ?? null;
    mageElement = opts.mageElement ?? 'fire';
    classId = opts.classId || 'warrior';
  }
  const safeClass = CLASS_SKELETON_ASSET[classId] ? classId : 'warrior';
  const isTripoGunslinger = safeClass === 'gunslinger' && gltfCache.has('gunslinger_tripo');
  const isTripoWarrior = safeClass === 'warrior' && gltfCache.has('warrior_tripo');
  const isTripoMage = safeClass === 'mage' && gltfCache.has('mage_tripo');
  const isAnyTripoHero = isTripoGunslinger || isTripoWarrior || isTripoMage;
  const assetKey = isTripoGunslinger
    ? 'gunslinger_tripo'
    : isTripoWarrior
      ? 'warrior_tripo'
      : isTripoMage
        ? 'mage_tripo'
        : CLASS_SKELETON_ASSET[safeClass];
  const asset = gltfCache.get(assetKey);
  const heroBaseScale = isTripoGunslinger
    ? TRIPO_GUNSLINGER_SCALE
    : isTripoWarrior
      ? 2.17
      : isTripoMage
        ? 2.13
        : HERO_BASE_SCALE;

  const root = new THREE.Group();
  let currentWeaponId =
    weaponId || (safeClass === 'warrior' ? 'club' : safeClass === 'gunslinger' ? 'usp_pistol' : 'spark_staff');
  let currentMageElement = mageElement || 'fire';
  let isBeast = false;
  let flashTimer = 0;

  // Gunslinger two-handed carry pivot, recoil kick, pump rack & walk cycle state
  let gunCarryPivot = null;
  let gunKickTimer = 0;
  let aimHoldTimer = 0;
  let aimYawBlend = 0;
  let pumpCycleTimer = 0;
  let isReloadingState = false;
  let reloadBlend = 0;
  let walkPhase = 0;
  let moveBlend = 0;

  let modelInstance = null;
  let animCtrl = null;
  const instanceMats = [];
  let handR = null;
  let handL = null;
  let chestBone = null;
  let upperArmR = null;
  let lowerArmR = null;
  let upperArmL = null;
  let lowerArmL = null;
  let mountedWeaponObj = null;
  let embeddedWarriorSwordNode = null;
  let embeddedShotgunNode = null;
  let embeddedStaffMesh = null;
  let embeddedStaffVfx = null;
  let staffCastPulse = 0;
  let warriorAttackTimer = 0;
  let warriorAttackDur = 0.45;
  const hasBakedGunslingerClips = Boolean(isTripoGunslinger && asset?.clips && asset.clips.has('Idle'));

  // Mixamo skeletal rig map for Tripo Gunslinger (used when IK fallback is active)
  const mx = Object.create(null);
  const mxFingersL = [];
  const mxFingersR = [];

  if (safeClass === 'gunslinger' && !hasBakedGunslingerClips) {
    gunCarryPivot = new THREE.Group();
    if (isTripoGunslinger) {
      gunCarryPivot.position.set(TRIPO_GUN_PIVOT_X, TRIPO_GUN_PIVOT_Y, TRIPO_GUN_PIVOT_Z);
    } else {
      gunCarryPivot.position.set(GUN_PIVOT_BASE_X, GUN_PIVOT_BASE_Y, GUN_PIVOT_BASE_Z);
    }
    root.add(gunCarryPivot);
  }

  const beastRing = new THREE.Mesh(
    getGeo('beast_ring', () => {
      const rg = new THREE.RingGeometry(0.85, 1.18, 28);
      rg.rotateX(-Math.PI / 2);
      return rg;
    }),
    new THREE.MeshBasicMaterial({
      color: safeClass === 'warrior' ? 0xf97316 : safeClass === 'gunslinger' ? 0x38bdf8 : 0xc084fc,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  beastRing.position.y = 0.04;
  beastRing.visible = false;
  root.add(beastRing);

  if (asset) {
    modelInstance = cloneSkinned(asset.scene);
    modelInstance.scale.setScalar(heroBaseScale);
    if (isTripoWarrior || isTripoMage || hasBakedGunslingerClips) {
      // Blender baked Mixamo NLA export faces +X in glTF Y-up; rotate -90 deg around Y to face +Z!
      modelInstance.rotation.y = -Math.PI * 0.5;
    }
    root.add(modelInstance);

    let headBone = null;

    modelInstance.traverse((node) => {
      const nm = node.name || '';
      const mxMatch = isTripoGunslinger ? nm.match(/^mixamorig:?(.+)$/) : null;
      if (mxMatch) {
        const shortName = mxMatch[1];
        const entry = {
          node,
          restQ: node.quaternion.clone(),
          restPos: node.position.clone()
        };
        mx[shortName] = entry;
        if (/^LeftHand(Index|Middle|Ring|Pinky)[123]$/.test(shortName)) {
          mxFingersL.push(entry);
        } else if (/^RightHand(Index|Middle|Ring|Pinky)[123]$/.test(shortName)) {
          mxFingersR.push(entry);
        }
      }

      if (/^handslot\.?r$/i.test(nm) || (!handR && /^hand\.?r$/i.test(nm))) handR = node;
      if ((isTripoWarrior || isTripoMage) && /^mixamorig:?RightHand$/i.test(nm)) handR = node;
      if (/^handslot\.?l$/i.test(nm) || (!handL && /^hand\.?l$/i.test(nm))) handL = node;
      if ((isTripoWarrior || isTripoMage) && /^mixamorig:?LeftHand$/i.test(nm)) handL = node;
      if (/^chest$/i.test(nm)) chestBone = node;
      if (/^head$/i.test(nm)) headBone = node;
      if (/^upperarm\.?r$/i.test(nm)) upperArmR = node;
      if (/^lowerarm\.?r$/i.test(nm)) lowerArmR = node;
      if (/^upperarm\.?l$/i.test(nm)) upperArmL = node;
      if (/^lowerarm\.?l$/i.test(nm)) lowerArmL = node;

      if (node.isMesh && node.material) {
        const isEyeMesh = /Eyes/i.test(node.name);
        const isCloakOrScarf = /Cloak|Cape/i.test(node.name);
        const isRogueHood = /Skeleton_Rogue_Hood/i.test(node.name);
        const isMageHatOrRobe = /Skeleton_Mage_(Hat|Body)/i.test(node.name);

        if (isEyeMesh) {
          const eyeMat = new THREE.MeshStandardMaterial({
            color: 0xffc13b,
            emissive: 0xff6a00,
            emissiveIntensity: 2.6,
            roughness: 0.15
          });
          node.material = eyeMat;
          instanceMats.push({ mat: eyeMat, baseEmissive: 0xff6a00, baseEmissiveInt: 2.6, hasEyeMap: false });
          return;
        }

        const cloned = Array.isArray(node.material)
          ? node.material.map((m) => m.clone())
          : node.material.clone();
        node.material = cloned;
        const list = Array.isArray(cloned) ? cloned : [cloned];

        for (const m of list) {
          const isEmbeddedWeaponMesh = /HeroWeapon|Sword|Staff|Shotgun/i.test(node.name);
          if (isTripoMage && isEmbeddedWeaponMesh && !embeddedStaffMesh) {
            embeddedStaffMesh = node;
          }
          if (isTripoWarrior && /HeroWeapon_Sword/i.test(node.name) && !embeddedWarriorSwordNode) {
            embeddedWarriorSwordNode = node;
          }
          if (isTripoGunslinger && /HeroWeapon_Shotgun/i.test(node.name) && !embeddedShotgunNode) {
            embeddedShotgunNode = node;
          }
          if (isAnyTripoHero) {
            if (m.color) m.color.setHex(0xffffff);
            const eyeTex = cachedEyeEmissiveTextures.get(assetKey);
            if (eyeTex && !isEmbeddedWeaponMesh && m.emissive !== undefined) {
              m.emissiveMap = eyeTex;
              m.emissive.setHex(isTripoMage ? 0xff5200 : 0xff7a00);
              m.emissiveIntensity = 2.35;
            }
          } else {
            if (isCloakOrScarf && (safeClass === 'warrior' || safeClass === 'gunslinger') && m.color) {
              m.color.setHex(0x9b2226);
            } else if (isRogueHood && m.color) {
              m.color.lerp(new THREE.Color(0x57534e), 0.65);
            } else if (isMageHatOrRobe && m.color) {
              m.color.lerp(new THREE.Color(0x6b2146), 0.45);
            }
          }
          const entry = {
            mat: m,
            baseEmissive: m.emissive ? m.emissive.getHex() : 0x000000,
            baseEmissiveInt: m.emissiveIntensity || 0,
            hasEyeMap: Boolean(m.emissiveMap)
          };
          instanceMats.push(entry);
        }
      }
    });

    if (headBone && !isAnyTripoHero) {
      headBone.scale.setScalar(1.14);
    }

    if (safeClass === 'warrior' && !isTripoWarrior) {
      if (handL) {
        handL.add(createSkullShield(false));
      }
    } else if (safeClass === 'gunslinger' && !isTripoGunslinger) {
      if (chestBone) {
        const pack = createBackpackWithBedroll();
        pack.position.set(0, 0.22, -0.26);
        chestBone.add(pack);
      }
    } else if (safeClass === 'mage' && !isTripoMage) {
      if (handL) {
        handL.add(createMagePotionFlask());
      }
    }

    if (!isTripoGunslinger || hasBakedGunslingerClips) {
      animCtrl = createAnimController(modelInstance, asset.clips, 'Idle', 'Running_A');
    }

    // Mount Bone-Locked Living GLSL Water/Elemental Sphere right inside HeroWeapon_Staff's wooden claws (0.000mm drift!)
    if (isTripoMage && embeddedStaffMesh) {
      embeddedStaffVfx = createLivingStaffOrbVfx(9.95, currentMageElement || 'water');
      embeddedStaffVfx.group.position.set(-3.8114, 81.55, 0.3818);
      embeddedStaffMesh.add(embeddedStaffVfx.group);
    }
  }

  const gripSocketR = new THREE.Object3D();
  const forendSocketL = new THREE.Object3D();
  const poleTargetR = new THREE.Object3D();
  const poleTargetL = new THREE.Object3D();
  const footTargetL = new THREE.Object3D();
  const footTargetR = new THREE.Object3D();
  const kneePoleL = new THREE.Object3D();
  const kneePoleR = new THREE.Object3D();
  const footRestRootQL = new THREE.Quaternion();
  const footRestRootQR = new THREE.Quaternion();

  function makeBasisQuat(yx, yy, yz, zx, zy, zz) {
    const yv = new THREE.Vector3(yx, yy, yz).normalize();
    const zv = new THREE.Vector3(zx, zy, zz);
    zv.addScaledVector(yv, -zv.dot(yv)).normalize();
    const xv = new THREE.Vector3().crossVectors(yv, zv).normalize();
    zv.crossVectors(xv, yv).normalize();
    const m4 = new THREE.Matrix4().makeBasis(xv, yv, zv);
    return new THREE.Quaternion().setFromRotationMatrix(m4);
  }

  if (isTripoGunslinger && gunCarryPivot) {
    // Exact Pistol Grip/Trigger (Right Hand) & Under-Forend Palm-Up (Left Hand) sockets matching Blender 10/10 rig!
    gripSocketR.position.set(-0.052, -0.076, -0.210);
    gripSocketR.quaternion.copy(makeBasisQuat(0.14, -0.36, 0.92, 0.96, 0.20, -0.18));

    forendSocketL.position.set(0.044, -0.086, 0.062);
    forendSocketL.quaternion.copy(makeBasisQuat(-0.86, -0.02, 0.51, -0.06, -0.995, -0.04));

    gunCarryPivot.add(gripSocketR, forendSocketL);

    poleTargetR.position.set(-0.48, 0.55, -0.28);
    poleTargetL.position.set(0.45, 0.48, -0.12);
    kneePoleL.position.set(0.16, 0.38, 1.15);
    kneePoleR.position.set(-0.16, 0.38, 1.15);
    footTargetL.position.set(0.151, 0.171, 0.129);
    footTargetR.position.set(-0.144, 0.171, 0.038);
    root.add(poleTargetR, poleTargetL, kneePoleL, kneePoleR, footTargetL, footTargetR);

    // Capture rest foot world orientations in root space & pre-apply anatomical finger curls around grip & forend!
    root.updateMatrixWorld(true);
    const rootInvQ = root.getWorldQuaternion(new THREE.Quaternion()).invert();
    if (mx.LeftFoot) {
      mx.LeftFoot.node.getWorldQuaternion(footRestRootQL).premultiply(rootInvQ);
    }
    if (mx.RightFoot) {
      mx.RightFoot.node.getWorldQuaternion(footRestRootQR).premultiply(rootInvQ);
    }

    const palmDownRoot = new THREE.Vector3(0, -1, 0);
    const applyAnatomicalFingerCurl = (entry, angleRad, spreadRad = 0) => {
      if (!entry) return;
      const bWorldQ = entry.node.getWorldQuaternion(new THREE.Quaternion()).premultiply(rootInvQ);
      const yDir = new THREE.Vector3(0, 1, 0).applyQuaternion(bWorldQ).normalize();
      const hingeRoot = new THREE.Vector3().crossVectors(yDir, palmDownRoot);
      if (hingeRoot.lengthSq() < 1e-6) return;
      hingeRoot.normalize();
      const bInvQ = bWorldQ.clone().invert();
      const hingeLocal = hingeRoot.applyQuaternion(bInvQ).normalize();
      const qCurl = new THREE.Quaternion().setFromAxisAngle(hingeLocal, angleRad);
      if (Math.abs(spreadRad) > 1e-4) {
        const spreadLocal = palmDownRoot.clone().applyQuaternion(bInvQ).normalize();
        qCurl.premultiply(new THREE.Quaternion().setFromAxisAngle(spreadLocal, spreadRad));
      }
      entry.curlQ = entry.restQ.clone().multiply(qCurl);
      entry.node.quaternion.copy(entry.curlQ);
    };

    for (let i = 0; i < mxFingersL.length; i++) {
      const fEntry = mxFingersL[i];
      const j = Number(fEntry.node.name.slice(-1)) || 1;
      applyAnatomicalFingerCurl(fEntry, j === 1 ? 0.62 : j === 2 ? 0.76 : 0.50);
    }
    for (let i = 0; i < mxFingersR.length; i++) {
      const fEntry = mxFingersR[i];
      const nm = fEntry.node.name;
      const j = Number(nm.slice(-1)) || 1;
      if (nm.includes('Index')) {
        applyAnatomicalFingerCurl(fEntry, j === 1 ? 0.35 : j === 2 ? 0.85 : 0.60);
      } else {
        applyAnatomicalFingerCurl(fEntry, j === 1 ? 1.05 : j === 2 ? 1.12 : 0.78);
      }
    }
    for (const j of [1, 2, 3]) {
      applyAnatomicalFingerCurl(mx[`LeftHandThumb${j}`], j === 1 ? 0.65 : 0.50, j === 1 ? 0.60 : 0);
      applyAnatomicalFingerCurl(mx[`RightHandThumb${j}`], j === 1 ? 0.62 : 0.55, j === 1 ? 0.25 : 0);
    }
  }

  const _gripPosW = new THREE.Vector3();
  const _forendPosW = new THREE.Vector3();
  const _polePosRW = new THREE.Vector3();
  const _polePosLW = new THREE.Vector3();
  const _footPosLW = new THREE.Vector3();
  const _footPosRW = new THREE.Vector3();
  const _kneePoleLW = new THREE.Vector3();
  const _kneePoleRW = new THREE.Vector3();
  const _rootWorldQ = new THREE.Quaternion();
  const _parentInvQ = new THREE.Quaternion();
  const _targetWorldQ = new THREE.Quaternion();
  const _pitchQuat = new THREE.Quaternion();
  const _unitX = new THREE.Vector3(1, 0, 0);

  function evalTripoFootGait(u) {
    const uu = ((u % 1) + 1) % 1;
    const zFront = 0.267;
    const zRear = -0.077;
    const yFlat = 0.171;
    if (uu < 0.48) {
      const s = uu / 0.48;
      const az = zFront + (zRear - zFront) * s;
      if (s < 0.15) {
        const k = 1 - s / 0.15;
        return { y: yFlat + 0.010 * k, z: az, pitch: -0.28 * k };
      }
      if (s < 0.74) {
        return { y: yFlat, z: az, pitch: 0 };
      }
      const k = (s - 0.74) / 0.26;
      return { y: yFlat + 0.043 * k * k, z: az, pitch: 0.52 * k };
    }
    const s = (uu - 0.48) / 0.52;
    const zMid = 0.5 * (zFront + zRear);
    const zAmp = 0.5 * (zRear - zFront);
    const az = zMid + zAmp * Math.cos(Math.PI * s);
    const ay =
      yFlat +
      Math.sin(Math.PI * Math.pow(s, 0.78)) * 0.112 +
      0.043 * Math.pow(1 - s, 2.4) +
      0.010 * Math.pow(s, 3.0);
    const pitch =
      0.55 * Math.sin(Math.PI * Math.pow(s, 0.70)) * (1 - s * 0.65) +
      0.52 * Math.pow(1 - s, 2.2) -
      0.28 * Math.pow(s, 2.6);
    return { y: ay, z: az, pitch };
  }

  function positionTripoGunPivot(elapsedTime, kickCurve, pumpFrac, reloadBob, beastScale) {
    if (!isTripoGunslinger || !gunCarryPivot) return;
    const walkBobY = Math.sin(2 * walkPhase - 0.35) * 0.010 * moveBlend;
    const idleBobY = Math.sin(elapsedTime * 2.5) * 0.004 * (1 - moveBlend);
    const walkSwayX = -Math.cos(walkPhase) * 0.007 * moveBlend;
    // Natural diagonal carry across chest keeping BOTH elbows comfortably bent (snapping toward firing line when shooting!)
    const baseDiagonalYaw = 0.72 * (1 - aimYawBlend * 0.55);
    const carryYaw = baseDiagonalYaw + Math.sin(walkPhase) * 0.018 * moveBlend;

    gunCarryPivot.scale.setScalar(beastScale);
    gunCarryPivot.position.set(
      (TRIPO_GUN_PIVOT_X + walkSwayX) * beastScale,
      (TRIPO_GUN_PIVOT_Y + walkBobY + idleBobY + kickCurve * 0.026 + reloadBob * 0.018) * beastScale,
      (TRIPO_GUN_PIVOT_Z - kickCurve * 0.068 - pumpFrac * 0.014 - reloadBlend * 0.03) * beastScale
    );
    gunCarryPivot.rotation.set(
      -0.04 - kickCurve * 0.24 + pumpFrac * 0.05 + reloadBlend * 0.20 + reloadBob * 0.05,
      carryYaw + reloadBlend * -0.08,
      reloadBlend * 0.26
    );

    // Slide left-hand forend socket back & forth underneath wooden forend during pump-action rack!
    forendSocketL.position.set(
      0.044,
      -0.086 - reloadBob * 0.015,
      0.062 - pumpFrac * 0.055 - reloadBlend * 0.02
    );
  }

  function applyTripoGunslingerPose(elapsedTime, kickCurve) {
    if (!isTripoGunslinger || !mx.Hips) return;
    const m = moveBlend;
    const idle = 1 - m;
    const p = walkPhase;
    const breath = Math.sin(elapsedTime * 2.5);

    // 1. MONOLITHIC HIPS + SPINE:
    //    - Steady tactical left-side-leading yaw (-0.28 rad) with ZERO spine twisting (Spine/Spine1/Spine2 = 0!)
    //    - Subtle elastic ±0.006m step spring (NO downward pelvic dive!)
    const stanceYaw = -0.28 * (1 - aimYawBlend * 0.45);
    const hipsYOffset = -0.018 * idle + (-0.021 + Math.sin(2 * p - 0.4) * 0.006) * m + breath * 0.002 * idle;

    // Note: in Mixamo Hips local space, X=(-Z_root backward/forward), Y=(+Y_root up), Z=(-X_root)
    mx.Hips.node.position.set(
      mx.Hips.restPos.x - kickCurve * 0.016,
      mx.Hips.restPos.y + hipsYOffset,
      mx.Hips.restPos.z
    );
    setBoneRelEuler(mx.Hips, 0, stanceYaw, -0.05 - 0.02 * m + kickCurve * 0.09);

    // Lock Spine, Spine1, Spine2 at (0,0,0) -> entire Torso + Belt + Backpack move as ONE SOLID MONOLITH!
    setBoneRelEuler(mx.Spine, 0, 0, 0);
    setBoneRelEuler(mx.Spine1, 0, 0, 0);
    setBoneRelEuler(mx.Spine2, 0, 0, 0);

    // 2. Neck & Head: steady forward gaze along +Z
    const counterYaw = -stanceYaw * 1.02;
    setBoneRelEuler(mx.Neck, 0, counterYaw * 0.44, 0.02);
    setBoneRelEuler(
      mx.Head,
      0,
      counterYaw * 0.56 + Math.sin(elapsedTime * 1.4) * 0.02 * idle,
      0.03 - kickCurve * 0.05
    );

    // 3. 2-Bone Biomechanical Foot IK (65-85 deg knee bend on swing, flat boot on stance!)
    const beastScale = isBeast ? 1.78 : 1.0;
    const uL = (p / (Math.PI * 2)) % 1;
    const uR = (uL + 0.5) % 1;
    const gL = evalTripoFootGait(uL);
    const gR = evalTripoFootGait(uR);

    const footLY = (0.171 * idle + gL.y * m) * beastScale;
    const footLZ = (0.129 * idle + gL.z * m) * beastScale;
    const pitchL = gL.pitch * m;

    const footRY = (0.171 * idle + gR.y * m) * beastScale;
    const footRZ = (0.038 * idle + gR.z * m) * beastScale;
    const pitchR = gR.pitch * m;

    footTargetL.position.set(0.151 * beastScale, footLY, footLZ);
    footTargetR.position.set(-0.144 * beastScale, footRY, footRZ);
    kneePoleL.position.set(0.16 * beastScale, 0.38 * beastScale, 1.15 * beastScale);
    kneePoleR.position.set(-0.16 * beastScale, 0.38 * beastScale, 1.15 * beastScale);

    // Calm shoulders + twist-free Arm IK
    setBoneRelEuler(mx.LeftShoulder, 0, 0.04, -0.20);
    setBoneRelEuler(mx.RightShoulder, 0, 0, 0.04);
    root.updateMatrixWorld(true);
    root.getWorldQuaternion(_rootWorldQ);

    footTargetL.getWorldPosition(_footPosLW);
    footTargetR.getWorldPosition(_footPosRW);
    kneePoleL.getWorldPosition(_kneePoleLW);
    kneePoleR.getWorldPosition(_kneePoleRW);

    solveMixamoArmIK(mx.LeftUpLeg, mx.LeftLeg, mx.LeftFoot, _footPosLW, _kneePoleLW);
    solveMixamoArmIK(mx.RightUpLeg, mx.RightLeg, mx.RightFoot, _footPosRW, _kneePoleRW);

    // World-aligned Foot pitch so stance boot stays flat on arena floor!
    if (mx.LeftFoot && mx.LeftFoot.node.parent) {
      mx.LeftFoot.node.parent.getWorldQuaternion(_parentInvQ).invert();
      _pitchQuat.setFromAxisAngle(_unitX, pitchL);
      _targetWorldQ.copy(_rootWorldQ).multiply(_pitchQuat).multiply(footRestRootQL);
      mx.LeftFoot.node.quaternion.copy(_parentInvQ).multiply(_targetWorldQ);
    }
    if (mx.RightFoot && mx.RightFoot.node.parent) {
      mx.RightFoot.node.parent.getWorldQuaternion(_parentInvQ).invert();
      _pitchQuat.setFromAxisAngle(_unitX, pitchR);
      _targetWorldQ.copy(_rootWorldQ).multiply(_pitchQuat).multiply(footRestRootQR);
      mx.RightFoot.node.quaternion.copy(_parentInvQ).multiply(_targetWorldQ);
    }

    // 4. 2-Bone Arm IK + Exact World Hand Copy-Rotation onto Trigger/Grip & Underneath Wooden Forend!
    gripSocketR.getWorldPosition(_gripPosW);
    forendSocketL.getWorldPosition(_forendPosW);
    poleTargetR.getWorldPosition(_polePosRW);
    poleTargetL.getWorldPosition(_polePosLW);

    solveMixamoArmIK(mx.RightArm, mx.RightForeArm, mx.RightHand, _gripPosW, _polePosRW);
    solveMixamoArmIK(mx.LeftArm, mx.LeftForeArm, mx.LeftHand, _forendPosW, _polePosLW);

    if (mx.RightHand && mx.RightHand.node.parent) {
      mx.RightHand.node.parent.getWorldQuaternion(_parentInvQ).invert();
      gripSocketR.getWorldQuaternion(_targetWorldQ);
      mx.RightHand.node.quaternion.copy(_parentInvQ).multiply(_targetWorldQ);
    }
    if (mx.LeftHand && mx.LeftHand.node.parent) {
      mx.LeftHand.node.parent.getWorldQuaternion(_parentInvQ).invert();
      forendSocketL.getWorldQuaternion(_targetWorldQ);
      mx.LeftHand.node.quaternion.copy(_parentInvQ).multiply(_targetWorldQ);
    }
  }

  function applyGunslingerArmPose() {
    if (safeClass !== 'gunslinger' || isTripoGunslinger) return;
    if (upperArmL) upperArmL.quaternion.slerp(GUN_UPPER_ARM_L_Q, 0.90);
    if (lowerArmL) {
      if (reloadBlend > 0.02) {
        _tmpQuatA.copy(GUN_LOWER_ARM_L_Q).slerp(GUN_RELOAD_LOWER_L_Q, reloadBlend * 0.65);
        lowerArmL.quaternion.slerp(_tmpQuatA, 0.90);
      } else {
        lowerArmL.quaternion.slerp(GUN_LOWER_ARM_L_Q, 0.90);
      }
    }
    if (upperArmR) upperArmR.quaternion.slerp(GUN_UPPER_ARM_R_Q, 0.90);
    if (lowerArmR) lowerArmR.quaternion.slerp(GUN_LOWER_ARM_R_Q, 0.90);
  }

  function setWeapon(newWeaponId, nextElement = null) {
    currentWeaponId = newWeaponId || currentWeaponId;
    if (nextElement) currentMageElement = nextElement;
    if (embeddedStaffVfx) {
      embeddedStaffVfx.setElementTheme(currentMageElement);
    }
    if (mountedWeaponObj && mountedWeaponObj.parent) {
      mountedWeaponObj.parent.remove(mountedWeaponObj);
    }
    mountedWeaponObj = null;

    if (isTripoMage) {
      return;
    }

    if (isTripoWarrior) {
      const useEmbeddedSword = currentWeaponId === 'club' || !WEAPONS[currentWeaponId];
      if (embeddedWarriorSwordNode) {
        embeddedWarriorSwordNode.visible = useEmbeddedSword;
      }
      if (useEmbeddedSword || !handR) {
        return;
      }
      mountedWeaponObj = createHeroWeaponMesh(currentWeaponId, null);
      handR.add(mountedWeaponObj);
      return;
    }

    if (hasBakedGunslingerClips) {
      const usesEmbeddedShotgun =
        currentWeaponId === 'pistol' || currentWeaponId === 'blunderbuss' || currentWeaponId === 'gatling';
      if (embeddedShotgunNode) {
        embeddedShotgunNode.visible = usesEmbeddedShotgun;
      }
      if (usesEmbeddedShotgun) {
        return;
      }
      const meshObj = createHeroWeaponMesh(currentWeaponId, null);
      const mountParent = embeddedShotgunNode?.parent || handR;
      if (mountParent) {
        const gunSocket = new THREE.Group();
        if (embeddedShotgunNode) {
          gunSocket.position.copy(embeddedShotgunNode.position);
          gunSocket.quaternion.copy(embeddedShotgunNode.quaternion);
          if (currentWeaponId === 'usp_pistol' || currentWeaponId === 'colt') {
            // Pull 1H sidearms closer to the right-hand palm so they sit right in the grip!
            gunSocket.position.y *= 0.56;
            gunSocket.position.z *= 0.52;
          } else {
            gunSocket.position.y *= 0.85;
            gunSocket.position.z *= 0.82;
          }
        }
        gunSocket.userData.basePos = gunSocket.position.clone();
        gunSocket.userData.baseQuat = gunSocket.quaternion.clone();
        meshObj.position.set(0, 0, 0);
        gunSocket.add(meshObj);
        mountParent.add(gunSocket);
        mountedWeaponObj = gunSocket;
      }
      return;
    }

    mountedWeaponObj = createHeroWeaponMesh(currentWeaponId, safeClass === 'mage' ? currentMageElement : null);
    if (safeClass === 'gunslinger' && gunCarryPivot) {
      gunCarryPivot.add(mountedWeaponObj);
    } else if (handR) {
      handR.add(mountedWeaponObj);
    }
  }

  function setElement(newElement) {
    if (!newElement) return;
    currentMageElement = newElement;
    if (embeddedStaffVfx) {
      embeddedStaffVfx.setElementTheme(currentMageElement);
    }
    if (safeClass === 'mage') {
      setWeapon(currentWeaponId, currentMageElement);
    }
  }

  setWeapon(currentWeaponId);
  if (isTripoGunslinger && !hasBakedGunslingerClips) {
    positionTripoGunPivot(0, 0, 0, 0, 1);
    applyTripoGunslingerPose(0, 0, 0);
  } else if (!hasBakedGunslingerClips) {
    applyGunslingerArmPose();
  }

  function setBeastMode(enabled) {
    isBeast = Boolean(enabled);
    beastRing.visible = isBeast;
    const beastScale = isBeast ? 1.78 : 1.0;
    if (modelInstance) {
      modelInstance.scale.setScalar(heroBaseScale * beastScale);
    }
    if (gunCarryPivot) {
      gunCarryPivot.scale.setScalar(beastScale);
      const bx = isTripoGunslinger ? TRIPO_GUN_PIVOT_X : GUN_PIVOT_BASE_X;
      const by = isTripoGunslinger ? TRIPO_GUN_PIVOT_Y : GUN_PIVOT_BASE_Y;
      const bz = isTripoGunslinger ? TRIPO_GUN_PIVOT_Z : GUN_PIVOT_BASE_Z;
      gunCarryPivot.position.set(bx * beastScale, by * beastScale, bz * beastScale);
    }
    const beastGlow = safeClass === 'warrior' ? 0xd9480f : safeClass === 'gunslinger' ? 0x2563eb : 0x9333ea;
    for (const item of instanceMats) {
      if (item.mat.emissive && !item.hasEyeMap && item.baseEmissiveInt < 2.0) {
        item.mat.emissive.setHex(isBeast ? beastGlow : item.baseEmissive);
        item.mat.emissiveIntensity = isBeast ? 0.55 : item.baseEmissiveInt;
      }
    }
  }

  function setReloading(reloadingBool) {
    isReloadingState = Boolean(reloadingBool);
  }

  function computeSyncedClipSpeed(clipName, fallbackSpeed, attackDuration) {
    if (!attackDuration || attackDuration <= 0 || !asset?.clips) return fallbackSpeed;
    const cl = asset.clips.get(clipName);
    if (!cl || !cl.duration) return fallbackSpeed;
    const minNeededSpeed = cl.duration / Math.max(0.18, attackDuration * 0.90);
    return Math.min(3.8, Math.max(fallbackSpeed, minNeededSpeed));
  }

  function playAttackAnim(_weaponType = null, attackDuration = 0) {
    if (safeClass === 'gunslinger') {
      gunKickTimer = Math.min(0.24, Math.max(0.11, (attackDuration || 0.25) * 0.65));
      if (hasBakedGunslingerClips && animCtrl) {
        animCtrl.triggerOneShot('Shoot', computeSyncedClipSpeed('Shoot', 1.75, attackDuration));
        return;
      }
      aimHoldTimer = 0.65;
      pumpCycleTimer = currentWeaponId === 'pistol' ? 0.38 : 0.22;
      return;
    }
    if (!animCtrl) return;
    if (safeClass === 'warrior') {
      warriorAttackDur = attackDuration > 0 ? Math.max(0.28, Math.min(0.95, attackDuration * 0.85)) : 0.44;
      warriorAttackTimer = warriorAttackDur;
      if (isTripoWarrior) {
        const baseClipSpd = currentWeaponId === 'axe' || currentWeaponId === 'boss_hammer' ? 1.25 : 1.65;
        animCtrl.triggerOneShot(
          '1H_Melee_Attack_Slice_Horizontal',
          computeSyncedClipSpeed('1H_Melee_Attack_Slice_Horizontal', baseClipSpd, attackDuration)
        );
        return;
      }
      const clip =
        currentWeaponId === 'flail'
          ? '2H_Melee_Attack_Spin'
          : currentWeaponId === 'cleaver'
            ? '2H_Melee_Attack_Slice'
            : '1H_Melee_Attack_Slice_Horizontal';
      animCtrl.triggerOneShot(clip, computeSyncedClipSpeed(clip, 1.85, attackDuration));
    } else {
      staffCastPulse = 1.0;
      const baseSpd = isTripoMage ? 1.72 : 1.9;
      animCtrl.triggerOneShot('Spellcast_Shoot', computeSyncedClipSpeed('Spellcast_Shoot', baseSpd, attackDuration));
    }
  }

  function flashHit() {
    flashTimer = 0.12;
    for (const item of instanceMats) {
      if (item.mat.emissive && !item.hasEyeMap && item.baseEmissiveInt < 2.0) {
        item.mat.emissive.setHex(0xff3b30);
        item.mat.emissiveIntensity = 0.85;
      }
    }
  }

  const _wEuler = new THREE.Euler(0, 0, 0, 'XYZ');
  const _wQuat = new THREE.Quaternion();

  function applyWarriorWeaponAnimOverlay(safeDt, isMoving, elapsedTime) {
    if (safeClass !== 'warrior' || !modelInstance) return;
    if (warriorAttackTimer > 0) {
      warriorAttackTimer = Math.max(0, warriorAttackTimer - safeDt);
    }
    const wId = currentWeaponId || 'club';
    const isSpear = wId === 'spear';
    const isAxe = wId === 'axe';
    const isHammer = wId === 'boss_hammer';
    const isZwei = wId === 'zweihander';
    const isTwoHand = isSpear || isZwei || isAxe || isHammer;

    // Reset lunge displacement smoothly when idle/running
    let lungeZ = 0;

    // Two-handed guard & heavy run posture for Spear / Zweihander / Axe / Hammer
    if (isTwoHand) {
      const sway = isMoving ? Math.sin(elapsedTime * 9.5) * 0.08 : Math.sin(elapsedTime * 2.2) * 0.025;
      if (upperArmL) {
        _wEuler.set(0.28 + sway, 0.24, -0.42);
        _wQuat.setFromEuler(_wEuler);
        upperArmL.quaternion.multiply(_wQuat);
      }
      if (lowerArmL) {
        _wEuler.set(-0.36, 0.34, 0.22);
        _wQuat.setFromEuler(_wEuler);
        lowerArmL.quaternion.multiply(_wQuat);
      }
      if (isSpear && upperArmR && warriorAttackTimer <= 0) {
        // Carry spear angled forward at the ready
        _wEuler.set(-0.22 + sway * 0.5, -0.18, 0.28);
        _wQuat.setFromEuler(_wEuler);
        upperArmR.quaternion.multiply(_wQuat);
      } else if ((isAxe || isHammer || isZwei) && isMoving && upperArmR && warriorAttackTimer <= 0) {
        // Heavy rested grip while charging in
        _wEuler.set(0.14 + sway, 0.16, 0.18);
        _wQuat.setFromEuler(_wEuler);
        upperArmR.quaternion.multiply(_wQuat);
      }
    }

    if (warriorAttackTimer > 0 && warriorAttackDur > 0) {
      const u = Math.max(0, Math.min(1, 1 - warriorAttackTimer / warriorAttackDur));
      if (isSpear) {
        // Sharp forward spear thrust lunge!
        const thrust = u < 0.38 ? u / 0.38 : Math.max(0, 1 - (u - 0.38) / 0.62);
        const sharp = Math.sin(thrust * Math.PI * 0.5);
        lungeZ = sharp * 0.28;
        if (chestBone) {
          _wEuler.set(sharp * 0.24, -sharp * 0.28, 0);
          _wQuat.setFromEuler(_wEuler);
          chestBone.quaternion.multiply(_wQuat);
        }
        if (upperArmR) {
          _wEuler.set(-sharp * 0.72, -sharp * 0.48, 0.55 * sharp);
          _wQuat.setFromEuler(_wEuler);
          upperArmR.quaternion.multiply(_wQuat);
        }
        if (lowerArmR) {
          _wEuler.set(0, -0.35 * sharp, -0.45 * sharp);
          _wQuat.setFromEuler(_wEuler);
          lowerArmR.quaternion.multiply(_wQuat);
        }
      } else if (isAxe) {
        // Wide sweeping left-right splash chop!
        const sweep = Math.sin(u * Math.PI);
        if (chestBone) {
          _wEuler.set(0.18 * sweep, Math.cos(u * Math.PI) * 0.42, 0.12 * sweep);
          _wQuat.setFromEuler(_wEuler);
          chestBone.quaternion.multiply(_wQuat);
        }
        if (upperArmR) {
          _wEuler.set(0.15 * sweep, Math.cos(u * Math.PI) * 0.55, -0.35 * sweep);
          _wQuat.setFromEuler(_wEuler);
          upperArmR.quaternion.multiply(_wQuat);
        }
      } else {
        // Sword ('club'), Zweihander & Hammer: diagonal TOP-DOWN overhead cleave (сверху вниз / наискось вниз)!
        const wind = u < 0.28 ? u / 0.28 : 0;
        const chop = u >= 0.28 ? Math.sin(Math.min(1, (u - 0.28) / 0.52) * Math.PI * 0.5) : 0;
        const release = u > 0.80 ? 1 - (u - 0.80) / 0.20 : 1;
        const heaviness = isHammer ? 1.32 : isZwei ? 1.18 : 1.0;
        const pitchDelta = (-0.82 * wind + 1.15 * chop) * heaviness * release;
        const rollDelta = (0.35 * wind - 0.62 * chop) * release;
        if (chestBone) {
          _wEuler.set(0.28 * chop * release - 0.14 * wind, -0.22 * chop * release, rollDelta * 0.35);
          _wQuat.setFromEuler(_wEuler);
          chestBone.quaternion.multiply(_wQuat);
        }
        if (upperArmR) {
          _wEuler.set(pitchDelta, -0.25 * chop * release, rollDelta);
          _wQuat.setFromEuler(_wEuler);
          upperArmR.quaternion.multiply(_wQuat);
        }
        if (lowerArmR) {
          _wEuler.set(0.25 * chop * release, 0, -0.32 * wind + 0.24 * chop * release);
          _wQuat.setFromEuler(_wEuler);
          lowerArmR.quaternion.multiply(_wQuat);
        }
      }
    }

    modelInstance.position.z = lungeZ;
  }

  function applyGunslingerWeaponAnimOverlay(safeDt, isMoving, elapsedTime) {
    if (safeClass !== 'gunslinger' || !hasBakedGunslingerClips || !modelInstance) return;
    if (gunKickTimer > 0) {
      gunKickTimer = Math.max(0, gunKickTimer - safeDt);
    }
    const wId = currentWeaponId || 'usp_pistol';
    const isOneHandPistol = wId === 'usp_pistol' || wId === 'colt';

    if (isOneHandPistol) {
      // Relax left arm out of the baked two-handed shotgun forend hold into a balanced 1-handed pistol stance!
      const walkSwing = isMoving ? Math.sin(elapsedTime * 11.2) * 0.24 : Math.sin(elapsedTime * 2.1) * 0.04;
      if (mx.LeftArm?.node) {
        _wEuler.set(0.55 + walkSwing, -0.22, -0.68);
        _wQuat.setFromEuler(_wEuler);
        mx.LeftArm.node.quaternion.multiply(_wQuat);
      }
      if (mx.LeftForeArm?.node) {
        _wEuler.set(-0.35, 0.20, 0.28);
        _wQuat.setFromEuler(_wEuler);
        mx.LeftForeArm.node.quaternion.multiply(_wQuat);
      }
      if (mx.RightArm?.node) {
        const kickLift = gunKickTimer > 0 ? Math.sin((gunKickTimer / 0.22) * Math.PI) * (wId === 'colt' ? 0.32 : 0.16) : 0;
        _wEuler.set(-0.14 - kickLift, 0.10, 0.08);
        _wQuat.setFromEuler(_wEuler);
        mx.RightArm.node.quaternion.multiply(_wQuat);
      }
    }

    if (mountedWeaponObj?.userData?.basePos && mountedWeaponObj?.userData?.baseQuat) {
      const kick = gunKickTimer > 0 ? Math.sin((gunKickTimer / 0.22) * Math.PI) : 0;
      const recoilStrength = wId === 'colt' ? 0.045 : wId === 'ak47' ? 0.032 : wId === 'smg' ? 0.020 : 0.025;
      mountedWeaponObj.position.copy(mountedWeaponObj.userData.basePos);
      mountedWeaponObj.position.z -= kick * recoilStrength;
      mountedWeaponObj.position.y += kick * recoilStrength * 0.45;
      _wEuler.set(-kick * (isOneHandPistol ? 0.22 : 0.08), 0, 0);
      _wQuat.setFromEuler(_wEuler);
      mountedWeaponObj.quaternion.copy(mountedWeaponObj.userData.baseQuat).multiply(_wQuat);
    }
  }

  function update(dt, isMoving = false, speedRatio = 1, elapsedTime = 0) {
    const safeDt = Math.min(Math.max(dt || 0.016, 0), 0.1);
    if (animCtrl) {
      if (isMoving) {
        const runClip = isBeast && asset?.clips?.has('Running_B') ? 'Running_B' : 'Running_A';
        animCtrl.setBaseState(runClip, Math.max(0.95, Math.min(2.15, speedRatio * 1.32)));
      } else {
        animCtrl.setBaseState('Idle', 1.0);
      }
      animCtrl.mixer.update(safeDt);
    }

    applyWarriorWeaponAnimOverlay(safeDt, isMoving, elapsedTime);
    applyGunslingerWeaponAnimOverlay(safeDt, isMoving, elapsedTime);

    if (staffCastPulse > 0) {
      staffCastPulse = Math.max(0, staffCastPulse - safeDt * 5.2);
    }
    if (embeddedStaffVfx) {
      embeddedStaffVfx.updateVfx(elapsedTime, staffCastPulse);
    }

    // Two-handed shotgun carry pose, crisp recoil kick, pump rack & tactical chibi walk!
    if (safeClass === 'gunslinger' && gunCarryPivot) {
      const beastScale = isBeast ? 1.78 : 1.0;
      if (gunKickTimer > 0) {
        gunKickTimer = Math.max(0, gunKickTimer - safeDt);
      }
      if (aimHoldTimer > 0) {
        aimHoldTimer = Math.max(0, aimHoldTimer - safeDt);
      }
      if (pumpCycleTimer > 0) {
        pumpCycleTimer = Math.max(0, pumpCycleTimer - safeDt);
      }

      const targetMove = isMoving ? 1 : 0;
      moveBlend += (targetMove - moveBlend) * Math.min(1, safeDt * 11.5);
      if (moveBlend > 0.01) {
        const clampedSpd = Math.max(0.75, Math.min(1.65, speedRatio || 1));
        walkPhase += safeDt * 9.4 * clampedSpd;
      } else if (!isMoving) {
        walkPhase = 0;
      }

      const targetAim = aimHoldTimer > 0 ? 1 : 0;
      aimYawBlend += (targetAim - aimYawBlend) * Math.min(1, safeDt * 16);

      const targetReload = isReloadingState ? 1 : 0;
      reloadBlend += (targetReload - reloadBlend) * Math.min(1, safeDt * 12);

      // Punchy shotgun recoil spring curve (rapid kickback + smooth return)
      const kickRatio = gunKickTimer > 0 ? gunKickTimer / 0.26 : 0;
      const kickCurve = Math.pow(kickRatio, 0.65) * Math.sin(kickRatio * Math.PI * 0.92) * 1.28;

      // Pump-action rack window right after peak recoil (0.04..0.22s remaining)
      let pumpFrac = 0;
      if (pumpCycleTimer > 0 && pumpCycleTimer < 0.20) {
        pumpFrac = Math.sin((pumpCycleTimer / 0.20) * Math.PI);
      }

      const reloadBob = reloadBlend > 0.01 ? Math.sin(elapsedTime * 15.5) * reloadBlend : 0;

      if (isTripoGunslinger) {
        positionTripoGunPivot(elapsedTime, kickCurve, pumpFrac, reloadBob, beastScale);
        applyTripoGunslingerPose(elapsedTime, kickCurve, pumpFrac);
      } else {
        const strideBobY = isMoving ? Math.abs(Math.sin(elapsedTime * 11.5)) * 0.022 : Math.sin(elapsedTime * 2.6) * 0.008;

        gunCarryPivot.scale.setScalar(beastScale);
        gunCarryPivot.position.set(
          GUN_PIVOT_BASE_X * beastScale,
          (GUN_PIVOT_BASE_Y + strideBobY + reloadBob * 0.024) * beastScale,
          (GUN_PIVOT_BASE_Z - kickCurve * 0.18 - reloadBlend * 0.04) * beastScale
        );
        gunCarryPivot.rotation.x = -kickCurve * 0.32 + reloadBlend * 0.25 + reloadBob * 0.075;
        gunCarryPivot.rotation.y = reloadBlend * -0.10;
        gunCarryPivot.rotation.z = reloadBlend * 0.45;

        if (chestBone && kickCurve > 0.01) {
          _recoilPitchQuat.setFromAxisAngle(_xAxis, -kickCurve * 0.14);
          chestBone.quaternion.multiply(_recoilPitchQuat);
        }
        applyGunslingerArmPose();

        const forend = mountedWeaponObj?.userData?.pumpForend;
        if (forend) {
          forend.position.z = (forend.userData.baseZ || 0.39) - pumpFrac * 0.09;
        }
        const gatCluster = mountedWeaponObj?.userData?.gatlingCluster;
        if (gatCluster && gunKickTimer > 0) {
          gatCluster.rotation.z += safeDt * 18;
        }
      }
    }

    if (beastRing.visible) {
      beastRing.rotation.z = elapsedTime * 2.5;
      const pulse = 1 + Math.sin(elapsedTime * 7) * 0.08;
      beastRing.scale.set(pulse, pulse, 1);
    }

    if (flashTimer > 0) {
      flashTimer = Math.max(0, flashTimer - safeDt);
      if (flashTimer <= 0) setBeastMode(isBeast);
    }
  }

  root.userData.setWeapon = setWeapon;
  root.userData.setElement = setElement;
  root.userData.setBeastMode = setBeastMode;
  root.userData.setReloading = setReloading;
  root.userData.playAttackAnim = playAttackAnim;
  root.userData.flashHit = flashHit;
  root.userData.update = update;

  return {
    root,
    setWeapon,
    setElement,
    setBeastMode,
    setReloading,
    playAttackAnim,
    flashHit,
    update
  };
}

// ============================================================================
// 2. COMPANION FACTORY (Friendly Mini Skeleton Squire)
// ============================================================================
export function createCompanionMesh() {
  const root = new THREE.Group();
  const asset = gltfCache.get('skel_minion');
  let animCtrl = null;

  if (asset) {
    const inst = cloneSkinned(asset.scene);
    inst.scale.setScalar(0.62);
    inst.traverse((n) => {
      if (n.isMesh && /Eyes/i.test(n.name)) {
        n.material = new THREE.MeshStandardMaterial({
          color: 0x67e8f9,
          emissive: 0x06b6d4,
          emissiveIntensity: 2.2
        });
      }
    });
    root.add(inst);
    animCtrl = createAnimController(inst, asset.clips, 'Idle', 'Running_A');
  }

  return {
    root,
    playAttackAnim() {
      animCtrl?.triggerOneShot('1H_Melee_Attack_Chop', 1.9);
    },
    update(dt, isMoving = false) {
      const safeDt = Math.min(Math.max(dt || 0.016, 0), 0.1);
      if (animCtrl) {
        animCtrl.setBaseState(isMoving ? 'Running_A' : 'Idle', isMoving ? 1.25 : 1.0);
        animCtrl.mixer.update(safeDt);
      }
    }
  };
}

// ============================================================================
// 3. ENEMY SPECIALISTS & 5 MILESTONE ACT BOSSES FACTORY (Matches ad09b7c9.jpg!)
// ============================================================================

function createGlowingEyePair(eyeHex, spreadX = 0.155, posY = 0.41, posZ = 0.44, scaleX = 1.28, scaleY = 0.78) {
  const grp = new THREE.Group();
  const eyeMat = getMat(`en_eye_${eyeHex}`, () =>
    new THREE.MeshStandardMaterial({
      color: eyeHex,
      emissive: eyeHex,
      emissiveIntensity: 2.75,
      roughness: 0.14
    })
  );
  const eyeGeo = getGeo('en_eye_sphere', () => new THREE.SphereGeometry(0.060, 8, 8));
  for (const sx of [-spreadX, spreadX]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.scale.set(scaleX, scaleY, 0.65);
    eye.position.set(sx, posY, posZ);
    eye.rotation.z = sx < 0 ? 0.18 : -0.18;
    grp.add(eye);
  }
  return grp;
}

function createBatWings(boneHex = 0x4b4e57, membraneHex = 0x373940, wingSpan = 1.0, magmaGlow = false) {
  const grp = new THREE.Group();
  const boneMat = getMat(`bw_bone_${boneHex}`, () =>
    new THREE.MeshStandardMaterial({ color: boneHex, roughness: 0.58, metalness: 0.24 })
  );
  const memMat = getMat(`bw_mem_${membraneHex}_${magmaGlow ? 1 : 0}`, () =>
    new THREE.MeshStandardMaterial({
      color: membraneHex,
      emissive: magmaGlow ? 0xea580c : 0x000000,
      emissiveIntensity: magmaGlow ? 1.15 : 0,
      roughness: 0.52,
      metalness: 0.08,
      side: THREE.DoubleSide
    })
  );

  const wingShape = getGeo('bw_web_geo', () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0.05);
    s.lineTo(0.55, 0.48);
    s.lineTo(1.08, 0.24);
    s.quadraticCurveTo(0.84, -0.08, 0.74, -0.44);
    s.quadraticCurveTo(0.50, -0.18, 0.36, -0.48);
    s.quadraticCurveTo(0.18, -0.22, 0.02, -0.32);
    s.closePath();
    return new THREE.ShapeGeometry(s, 6);
  });
  const sparGeo = getGeo('bw_spar', () => {
    const cg = new THREE.CylinderGeometry(0.028, 0.042, 0.68, 7);
    cg.translate(0, 0.34, 0);
    return cg;
  });
  const clawGeo = getGeo('bw_claw', () => new THREE.ConeGeometry(0.042, 0.15, 5));

  const wingPivots = [];
  for (const side of [-1, 1]) {
    const wPivot = new THREE.Group();
    wPivot.position.set(side * 0.16, 0.32, -0.22);

    const innerArm = new THREE.Mesh(sparGeo, boneMat);
    innerArm.rotation.z = -side * 0.88;
    innerArm.position.set(0, 0.04, 0);

    const outerArm = new THREE.Mesh(sparGeo, boneMat);
    outerArm.scale.set(0.85, 0.92, 0.85);
    outerArm.position.set(side * 0.52, 0.46, -0.02);
    outerArm.rotation.z = -side * 1.92;

    const thumbClaw = new THREE.Mesh(clawGeo, boneMat);
    thumbClaw.position.set(side * 0.54, 0.54, 0.02);
    thumbClaw.rotation.z = -side * 0.35;

    const web = new THREE.Mesh(wingShape, memMat);
    web.scale.set(side, 1, 1);
    web.position.set(0, 0.02, -0.02);

    wPivot.add(innerArm, outerArm, thumbClaw, web);
    wPivot.scale.setScalar(wingSpan);
    wPivot.rotation.y = -side * 0.36;
    grp.add(wPivot);
    wingPivots.push({ pivot: wPivot, side });
  }
  grp.userData.wingPivots = wingPivots;
  return grp;
}

function createChibiMonsterHead({
  skinHex = 0x5c8a32,
  eyeHex = 0xff4500,
  ears = 'pointed', // 'pointed' | 'wolf' | 'ogre' | 'none'
  horns = 'none',   // 'none' | 'imp' | 'gargoyle' | 'demon_magma'
  tusks = false,
  wolfSnout = false,
  goblinNose = false
} = {}) {
  const grp = new THREE.Group();
  const skinMat = getMat(`cmh_skin_${skinHex}`, () =>
    new THREE.MeshStandardMaterial({ color: skinHex, roughness: 0.68, metalness: 0.08 })
  );
  const darkMouthMat = getMat('cmh_mouth_dark', () =>
    new THREE.MeshStandardMaterial({ color: 0x140d12, roughness: 0.85 })
  );
  const fangMat = getMat('cmh_fang_ivory', () =>
    new THREE.MeshStandardMaterial({ color: 0xf5efe0, roughness: 0.38, metalness: 0.06 })
  );

  const cranium = new THREE.Mesh(
    getGeo('cmh_cranium', () => new THREE.SphereGeometry(0.43, 14, 12)),
    skinMat
  );
  cranium.scale.set(1.04, 0.98, 0.98);
  cranium.position.set(0, 0.42, 0.02);

  const jaw = new THREE.Mesh(
    getGeo('cmh_jaw', () => new THREE.BoxGeometry(0.56, 0.28, 0.48)),
    skinMat
  );
  jaw.position.set(0, 0.20, 0.10);

  const brow = new THREE.Mesh(
    getGeo('cmh_brow', () => new THREE.BoxGeometry(0.58, 0.11, 0.24)),
    skinMat
  );
  brow.position.set(0, 0.50, 0.34);
  brow.rotation.x = 0.18;

  const mouth = new THREE.Mesh(
    getGeo('cmh_mouth_box', () => new THREE.BoxGeometry(0.36, 0.10, 0.10)),
    darkMouthMat
  );
  mouth.position.set(0, 0.21, 0.33);

  grp.add(cranium, jaw, brow, mouth);
  grp.add(createGlowingEyePair(eyeHex, 0.155, 0.41, 0.41, 1.32, 0.76));

  if (goblinNose) {
    const nose = new THREE.Mesh(
      getGeo('cmh_gob_nose', () => {
        const cg = new THREE.ConeGeometry(0.085, 0.24, 6);
        cg.rotateX(Math.PI * 0.56);
        return cg;
      }),
      skinMat
    );
    nose.position.set(0, 0.35, 0.47);
    grp.add(nose);
  }

  if (wolfSnout) {
    const snout = new THREE.Mesh(
      getGeo('cmh_wolf_snout', () => new THREE.BoxGeometry(0.36, 0.24, 0.38)),
      skinMat
    );
    snout.position.set(0, 0.28, 0.42);
    const noseTip = new THREE.Mesh(
      getGeo('cmh_wolf_nose', () => new THREE.SphereGeometry(0.075, 8, 8)),
      darkMouthMat
    );
    noseTip.position.set(0, 0.36, 0.60);
    grp.add(snout, noseTip);
    for (const sx of [-0.11, 0.11]) {
      const wf = new THREE.Mesh(
        getGeo('cmh_wolf_fang', () => new THREE.ConeGeometry(0.036, 0.12, 5)),
        fangMat
      );
      wf.rotation.x = Math.PI;
      wf.position.set(sx, 0.18, 0.54);
      grp.add(wf);
    }
    // Shaggy cheek fur tufts
    const tuftGeo = getGeo('cmh_wolf_tuft', () => new THREE.ConeGeometry(0.14, 0.34, 5));
    for (const sx of [-1, 1]) {
      const tuft = new THREE.Mesh(tuftGeo, skinMat);
      tuft.position.set(sx * 0.46, 0.30, 0.08);
      tuft.rotation.z = -sx * 1.25;
      grp.add(tuft);
    }
  } else if (tusks) {
    const tuskGeo = getGeo('cmh_tusk', () => new THREE.ConeGeometry(0.052, 0.20, 6));
    for (const sx of [-0.15, 0.15]) {
      const t = new THREE.Mesh(tuskGeo, fangMat);
      t.position.set(sx, 0.26, 0.38);
      t.rotation.x = 0.24;
      t.rotation.z = sx < 0 ? 0.15 : -0.15;
      grp.add(t);
    }
  } else {
    const fangGeo = getGeo('cmh_tiny_fang', () => new THREE.ConeGeometry(0.032, 0.09, 5));
    for (const sx of [-0.11, 0.11]) {
      const f = new THREE.Mesh(fangGeo, fangMat);
      f.rotation.x = Math.PI;
      f.position.set(sx, 0.23, 0.37);
      grp.add(f);
    }
  }

  if (ears === 'pointed') {
    const earGeo = getGeo('cmh_ear_long', () => new THREE.ConeGeometry(0.12, 0.48, 5));
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(earGeo, skinMat);
      ear.position.set(sx * 0.55, 0.42, 0.02);
      ear.rotation.z = -sx * 1.28;
      ear.rotation.y = -sx * 0.22;
      grp.add(ear);
    }
  } else if (ears === 'wolf') {
    const wEarGeo = getGeo('cmh_ear_wolf', () => new THREE.ConeGeometry(0.14, 0.42, 5));
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(wEarGeo, skinMat);
      ear.position.set(sx * 0.28, 0.88, -0.02);
      ear.rotation.z = -sx * 0.24;
      grp.add(ear);
    }
  } else if (ears === 'ogre') {
    const oEarGeo = getGeo('cmh_ear_ogre', () => new THREE.SphereGeometry(0.11, 8, 8));
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(oEarGeo, skinMat);
      ear.scale.set(0.65, 1.1, 0.85);
      ear.position.set(sx * 0.45, 0.42, 0.0);
      grp.add(ear);
    }
  }

  if (horns === 'imp' || horns === 'gargoyle') {
    const isStone = horns === 'gargoyle';
    const hMat = getMat(isStone ? 'cmh_stone_horn' : 'cmh_imp_horn', () =>
      new THREE.MeshStandardMaterial({
        color: isStone ? 0x373a42 : 0x450a0a,
        roughness: 0.48,
        metalness: 0.22
      })
    );
    for (const sx of [-1, 1]) {
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(sx * 0.24, 0.72, 0.08),
        new THREE.Vector3(sx * 0.46, 0.94, 0.02),
        new THREE.Vector3(sx * 0.36, 1.18, -0.10)
      );
      const hGeo = getGeo(`cmh_small_horn_${sx}`, () => new THREE.TubeGeometry(curve, 8, 0.062, 7, false));
      const tip = new THREE.Mesh(getGeo('cmh_small_horn_tip', () => new THREE.ConeGeometry(0.06, 0.16, 6)), hMat);
      tip.position.set(sx * 0.35, 1.24, -0.12);
      tip.rotation.x = -0.35;
      grp.add(new THREE.Mesh(hGeo, hMat), tip);
    }
  } else if (horns === 'demon_magma') {
    // Sweeping dark-obsidian bull/demon horns with blazing molten orange-yellow tips (matches Act I Boss in ad09b7c9.jpg!)
    const obsMat = getMat('demon_obs_horn', () =>
      new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.42, metalness: 0.35 })
    );
    const magmaTipMat = getMat('demon_magma_tip', () =>
      new THREE.MeshStandardMaterial({
        color: 0xfde047,
        emissive: 0xff5500,
        emissiveIntensity: 2.4,
        roughness: 0.20
      })
    );
    for (const sx of [-1, 1]) {
      const baseCurve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(sx * 0.28, 0.68, 0.04),
        new THREE.Vector3(sx * 0.74, 0.76, 0.08),
        new THREE.Vector3(sx * 0.68, 1.14, 0.12)
      );
      const hBase = new THREE.Mesh(
        getGeo(`demon_horn_base_${sx}`, () => new THREE.TubeGeometry(baseCurve, 10, 0.098, 8, false)),
        obsMat
      );
      const tipCone = new THREE.Mesh(
        getGeo('demon_horn_glow_tip', () => new THREE.ConeGeometry(0.095, 0.42, 8)),
        magmaTipMat
      );
      tipCone.position.set(sx * 0.62, 1.32, 0.13);
      tipCone.rotation.z = sx * 0.28;
      grp.add(hBase, tipCone);
    }
  }

  return grp;
}

function createCthulhuHeadAndTentacles() {
  const grp = new THREE.Group();
  const abyssSkinMat = getMat('cth_skin', () =>
    new THREE.MeshStandardMaterial({ color: 0x1f4e5f, roughness: 0.52, metalness: 0.12 })
  );
  const darkCrestMat = getMat('cth_crest', () =>
    new THREE.MeshStandardMaterial({ color: 0x133340, roughness: 0.58, metalness: 0.18 })
  );
  const runeMat = getMat('cth_cyan_rune', () =>
    new THREE.MeshStandardMaterial({
      color: 0xa5f3fc,
      emissive: 0x06b6d4,
      emissiveIntensity: 2.6,
      roughness: 0.15
    })
  );

  // Tall bulbous cephalopod cranium dome
  const dome = new THREE.Mesh(
    getGeo('cth_dome', () => new THREE.SphereGeometry(0.50, 16, 14)),
    abyssSkinMat
  );
  dome.scale.set(1.02, 1.32, 1.14);
  dome.position.set(0, 0.62, -0.04);

  const brow = new THREE.Mesh(
    getGeo('cth_brow', () => new THREE.BoxGeometry(0.62, 0.13, 0.28)),
    darkCrestMat
  );
  brow.position.set(0, 0.48, 0.36);
  brow.rotation.x = 0.22;

  // Forehead glowing cyan elder rune (matches ad09b7c9.jpg #3!)
  const runeV = new THREE.Mesh(getGeo('cth_rune_v', () => new THREE.BoxGeometry(0.042, 0.24, 0.04)), runeMat);
  runeV.position.set(-0.03, 0.72, 0.46);
  const runeDiag1 = new THREE.Mesh(getGeo('cth_rune_d', () => new THREE.BoxGeometry(0.14, 0.038, 0.04)), runeMat);
  runeDiag1.position.set(0.03, 0.78, 0.46);
  runeDiag1.rotation.z = -0.52;
  const runeDiag2 = new THREE.Mesh(getGeo('cth_rune_d', () => new THREE.BoxGeometry(0.14, 0.038, 0.04)), runeMat);
  runeDiag2.position.set(0.03, 0.66, 0.46);
  runeDiag2.rotation.z = -0.62;

  grp.add(dome, brow, runeV, runeDiag1, runeDiag2);
  grp.add(createGlowingEyePair(0xff6a00, 0.17, 0.40, 0.42, 1.35, 0.78));

  // 5 Sculpted Curling Face Tentacles hanging from face over chest!
  const tentacles = [];
  for (let i = 0; i < 5; i++) {
    const frac = (i - 2) / 2; // -1 .. +1
    const ox = frac * 0.24;
    const oz = 0.38 - Math.abs(frac) * 0.08;
    const tPivot = new THREE.Group();
    tPivot.position.set(ox, 0.28, oz);

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(ox * 0.35, -0.22, 0.10),
      new THREE.Vector3(ox * 0.65, -0.48, 0.04),
      new THREE.Vector3(ox * 0.95 + (i % 2 === 0 ? 0.08 : -0.08), -0.64, 0.16)
    ]);
    const tGeo = getGeo(`cth_face_tent_${i}`, () => new THREE.TubeGeometry(curve, 12, 0.068, 7, false));
    const tMesh = new THREE.Mesh(tGeo, abyssSkinMat);
    const tipCone = new THREE.Mesh(getGeo('cth_tent_tip', () => new THREE.ConeGeometry(0.064, 0.16, 6)), darkCrestMat);
    const endPt = curve.getPoint(1);
    tipCone.position.copy(endPt);
    tipCone.rotation.x = Math.PI * 0.65;
    tPivot.add(tMesh, tipCone);
    grp.add(tPivot);
    tentacles.push({ pivot: tPivot, phase: i * 1.15 });
  }
  grp.userData.tentacles = tentacles;
  return grp;
}

function createCthulhuArmorAndBaseTentacles() {
  const chestProps = new THREE.Group();
  const baseProps = new THREE.Group();
  const slateMat = getMat('cth_armor_slate', () =>
    new THREE.MeshStandardMaterial({ color: 0x2a3444, metalness: 0.72, roughness: 0.36 })
  );
  const hornMat = getMat('cth_pauldron_horn', () =>
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.42, metalness: 0.2 })
  );
  const runeMat = getMat('cth_cyan_rune', () =>
    new THREE.MeshStandardMaterial({ color: 0xa5f3fc, emissive: 0x06b6d4, emissiveIntensity: 2.6, roughness: 0.15 })
  );
  const tentMat = getMat('cth_skin', () =>
    new THREE.MeshStandardMaterial({ color: 0x1f4e5f, roughness: 0.52, metalness: 0.12 })
  );

  for (const sx of [-1, 1]) {
    const pauldron = new THREE.Mesh(
      getGeo('cth_pauldron', () => new THREE.SphereGeometry(0.28, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.58)),
      slateMat
    );
    pauldron.position.set(sx * 0.44, 0.36, 0.02);
    pauldron.rotation.z = -sx * 0.42;
    const spike = new THREE.Mesh(getGeo('cth_p_spike', () => new THREE.ConeGeometry(0.068, 0.26, 6)), hornMat);
    spike.position.set(sx * 0.56, 0.54, 0.04);
    spike.rotation.z = -sx * 0.32;
    const runeStrip = new THREE.Mesh(getGeo('cth_p_rune', () => new THREE.BoxGeometry(0.14, 0.036, 0.04)), runeMat);
    runeStrip.position.set(sx * 0.46, 0.38, 0.25);
    chestProps.add(pauldron, spike, runeStrip);
  }
  const beltRune = new THREE.Mesh(getGeo('cth_belt_gem', () => new THREE.OctahedronGeometry(0.11, 0)), runeMat);
  beltRune.scale.set(0.85, 1.35, 0.45);
  beltRune.position.set(0, -0.05, 0.26);
  chestProps.add(beltRune);

  const baseTentacles = [];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.4;
    const piv = new THREE.Group();
    piv.rotation.y = a;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.18, 0.22),
      new THREE.Vector3(0.08, 0.09, 0.58),
      new THREE.Vector3(-0.08, 0.14, 0.92),
      new THREE.Vector3(0.04, 0.34, 1.04)
    ]);
    const tg = getGeo('cth_base_tent', () => new THREE.TubeGeometry(curve, 12, 0.095, 7, false));
    piv.add(new THREE.Mesh(tg, tentMat));
    baseProps.add(piv);
    baseTentacles.push({ pivot: piv, baseY: a, phase: k * 1.05 });
  }
  baseProps.userData.baseTentacles = baseTentacles;
  return { chestProps, baseProps };
}

function createAshenDragonHead() {
  const grp = new THREE.Group();
  const obsMat = getMat('drg_obsidian', () =>
    new THREE.MeshStandardMaterial({ color: 0x1c191e, roughness: 0.46, metalness: 0.34 })
  );
  const lavaMawMat = getMat('drg_lava_maw', () =>
    new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xff5500,
      emissiveIntensity: 2.8,
      roughness: 0.15
    })
  );
  const hornGlowMat = getMat('drg_horn_glow', () =>
    new THREE.MeshStandardMaterial({
      color: 0xfdba74,
      emissive: 0xea580c,
      emissiveIntensity: 2.0,
      roughness: 0.24
    })
  );

  // Sculpted dragon skull & upper snout
  const skull = new THREE.Mesh(getGeo('drg_skull', () => new THREE.BoxGeometry(0.62, 0.46, 0.58)), obsMat);
  skull.position.set(0, 0.48, 0.02);
  const snout = new THREE.Mesh(getGeo('drg_snout', () => new THREE.BoxGeometry(0.44, 0.24, 0.48)), obsMat);
  snout.position.set(0, 0.44, 0.42);
  snout.rotation.x = 0.12;

  // Wide-open lower jaw + glowing molten lava throat interior!
  const lowerJaw = new THREE.Mesh(getGeo('drg_jaw_low', () => new THREE.BoxGeometry(0.40, 0.16, 0.46)), obsMat);
  lowerJaw.position.set(0, 0.18, 0.38);
  lowerJaw.rotation.x = 0.36;

  const lavaCore = new THREE.Mesh(getGeo('drg_maw_fire', () => new THREE.SphereGeometry(0.21, 10, 10)), lavaMawMat);
  lavaCore.scale.set(0.92, 0.85, 1.25);
  lavaCore.position.set(0, 0.30, 0.36);

  grp.add(skull, snout, lowerJaw, lavaCore);
  grp.add(createGlowingEyePair(0xff7a00, 0.20, 0.52, 0.34, 1.42, 0.70));

  // Jagged dragon fangs framing the molten maw
  const toothGeo = getGeo('drg_tooth', () => new THREE.ConeGeometry(0.038, 0.12, 5));
  for (const sx of [-0.15, -0.06, 0.06, 0.15]) {
    const upT = new THREE.Mesh(toothGeo, obsMat);
    upT.rotation.x = Math.PI;
    upT.position.set(sx, 0.33, 0.56);
    const dnT = new THREE.Mesh(toothGeo, obsMat);
    dnT.position.set(sx, 0.22, 0.53);
    dnT.rotation.x = 0.32;
    grp.add(upT, dnT);
  }

  // 4 Swept-back horned dragon crests with glowing magma tips
  for (const sx of [-1, 1]) {
    const mainHorn = new THREE.Mesh(
      getGeo('drg_main_horn', () => new THREE.ConeGeometry(0.095, 0.62, 7)),
      obsMat
    );
    mainHorn.position.set(sx * 0.28, 0.84, -0.14);
    mainHorn.rotation.x = -0.58;
    mainHorn.rotation.z = -sx * 0.34;

    const hornTip = new THREE.Mesh(
      getGeo('drg_horn_tip', () => new THREE.ConeGeometry(0.065, 0.28, 6)),
      hornGlowMat
    );
    hornTip.position.set(sx * 0.36, 1.06, -0.28);
    hornTip.rotation.x = -0.58;
    hornTip.rotation.z = -sx * 0.34;

    const cheekFin = new THREE.Mesh(
      getGeo('drg_cheek_fin', () => new THREE.ConeGeometry(0.065, 0.34, 5)),
      hornGlowMat
    );
    cheekFin.position.set(sx * 0.38, 0.44, -0.06);
    cheekFin.rotation.z = -sx * 1.15;
    cheekFin.rotation.y = -sx * 0.45;
    grp.add(mainHorn, hornTip, cheekFin);
  }

  return grp;
}

function createDragonTailWithFlame() {
  const piv = new THREE.Group();
  const obsMat = getMat('drg_obsidian', () =>
    new THREE.MeshStandardMaterial({ color: 0x1c191e, roughness: 0.46, metalness: 0.34 })
  );
  const flameOuterMat = getMat('drg_tail_flame_out', () =>
    new THREE.MeshStandardMaterial({
      color: 0xff6a00,
      emissive: 0xff4500,
      emissiveIntensity: 2.5,
      roughness: 0.18
    })
  );
  const flameCoreMat = getMat('drg_tail_flame_in', () =>
    new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfacc15,
      emissiveIntensity: 2.8,
      roughness: 0.12
    })
  );

  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.05, -0.20),
    new THREE.Vector3(0.18, -0.18, -0.62),
    new THREE.Vector3(0.46, -0.12, -0.92),
    new THREE.Vector3(0.62, 0.24, -0.98)
  ]);
  const tailMesh = new THREE.Mesh(
    getGeo('drg_tail_tube', () => new THREE.TubeGeometry(curve, 14, 0.115, 8, false)),
    obsMat
  );
  const flamePlume = new THREE.Mesh(
    getGeo('drg_tail_plume', () => new THREE.ConeGeometry(0.18, 0.48, 7)),
    flameOuterMat
  );
  flamePlume.position.set(0.64, 0.44, -0.98);
  const flameInner = new THREE.Mesh(
    getGeo('drg_tail_plume_in', () => new THREE.ConeGeometry(0.10, 0.32, 6)),
    flameCoreMat
  );
  flameInner.position.set(0.64, 0.40, -0.96);
  piv.add(tailMesh, flamePlume, flameInner);
  return piv;
}

function createSpikedPauldronsAndMoltenCore(withMoltenCore = true) {
  const grp = new THREE.Group();
  const darkIron = getMat('sp_dark_iron', () =>
    new THREE.MeshStandardMaterial({ color: 0x2d292e, metalness: 0.78, roughness: 0.34 })
  );
  const boneSpikeMat = getMat('sp_bone_spike', () =>
    new THREE.MeshStandardMaterial({ color: 0xd6cbb8, roughness: 0.45, metalness: 0.12 })
  );
  for (const sx of [-1, 1]) {
    const pad = new THREE.Mesh(
      getGeo('sp_pad_dome', () => new THREE.SphereGeometry(0.28, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.56)),
      darkIron
    );
    pad.position.set(sx * 0.45, 0.36, 0.02);
    pad.rotation.z = -sx * 0.45;
    const sp1 = new THREE.Mesh(getGeo('sp_cone_a', () => new THREE.ConeGeometry(0.065, 0.26, 6)), boneSpikeMat);
    sp1.position.set(sx * 0.54, 0.56, 0.02);
    sp1.rotation.z = -sx * 0.35;
    const sp2 = new THREE.Mesh(getGeo('sp_cone_b', () => new THREE.ConeGeometry(0.052, 0.20, 6)), boneSpikeMat);
    sp2.position.set(sx * 0.64, 0.42, 0.04);
    sp2.rotation.z = -sx * 0.85;
    grp.add(pad, sp1, sp2);
  }

  if (withMoltenCore) {
    const magmaMat = getMat('molten_fissure_mat', () =>
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xff5500,
        emissiveIntensity: 2.75,
        roughness: 0.16
      })
    );
    const fissureV = new THREE.Mesh(
      getGeo('molten_fissure_v', () => new THREE.OctahedronGeometry(0.15, 0)),
      magmaMat
    );
    fissureV.scale.set(0.62, 1.85, 0.45);
    fissureV.position.set(0, 0.18, 0.24);
    grp.add(fissureV);
    const ribGeo = getGeo('molten_fissure_rib', () => new THREE.BoxGeometry(0.22, 0.032, 0.04));
    for (let r = -1; r <= 1; r++) {
      for (const sx of [-1, 1]) {
        const vein = new THREE.Mesh(ribGeo, magmaMat);
        vein.position.set(sx * 0.12, 0.18 + r * 0.08, 0.23);
        vein.rotation.z = -sx * 0.28;
        grp.add(vein);
      }
    }
  }
  return grp;
}

function createArchlichDarkCrown() {
  const grp = new THREE.Group();
  const darkCrownMat = getMat('lich_dark_iron', () =>
    new THREE.MeshStandardMaterial({ color: 0x261d34, metalness: 0.82, roughness: 0.28 })
  );
  const violetGemMat = getMat('lich_violet_gem', () =>
    new THREE.MeshStandardMaterial({
      color: 0xf5d0fe,
      emissive: 0xa855f7,
      emissiveIntensity: 2.6,
      roughness: 0.15
    })
  );
  const circlet = new THREE.Mesh(
    getGeo('lich_crown_band', () => new THREE.CylinderGeometry(0.45, 0.41, 0.20, 14)),
    darkCrownMat
  );
  circlet.position.y = 0.78;
  grp.add(circlet);

  const tallSp = getGeo('lich_sp_tall', () => new THREE.ConeGeometry(0.09, 0.56, 4));
  const midSp = getGeo('lich_sp_mid', () => new THREE.ConeGeometry(0.068, 0.34, 4));
  const gemGeo = getGeo('lich_gem_oct', () => new THREE.OctahedronGeometry(0.075, 0));

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const isFront = i === 0;
    const isTall = i % 2 === 0;
    const sp = new THREE.Mesh(isTall ? tallSp : midSp, darkCrownMat);
    sp.position.set(Math.sin(a) * 0.41, 0.96 + (isTall ? 0.16 : 0.04) + (isFront ? 0.12 : 0), Math.cos(a) * 0.41);
    if (isFront) sp.scale.set(1.28, 1.32, 1.28);
    sp.rotation.y = a;
    grp.add(sp);
    if (isTall) {
      const gm = new THREE.Mesh(gemGeo, violetGemMat);
      gm.scale.set(0.8, 1.35, 0.6);
      gm.position.set(Math.sin(a) * 0.44, 0.84, Math.cos(a) * 0.44);
      grp.add(gm);
    }
  }
  return grp;
}

function createArchlichCollar() {
  const grp = new THREE.Group();
  const robeMat = getMat('lich_collar_robe', () =>
    new THREE.MeshStandardMaterial({ color: 0x4c1d95, roughness: 0.58, metalness: 0.15, side: THREE.DoubleSide })
  );
  const trimMat = getMat('lich_dark_iron', () =>
    new THREE.MeshStandardMaterial({ color: 0x261d34, metalness: 0.82, roughness: 0.28 })
  );
  const gemMat = getMat('lich_violet_gem', () =>
    new THREE.MeshStandardMaterial({ color: 0xf5d0fe, emissive: 0xa855f7, emissiveIntensity: 2.6, roughness: 0.15 })
  );
  const collarCone = new THREE.Mesh(
    getGeo('lich_high_collar', () => new THREE.CylinderGeometry(0.58, 0.34, 0.38, 12, 1, true, Math.PI * 0.55, Math.PI * 0.9)),
    robeMat
  );
  collarCone.position.set(0, 0.46, -0.04);
  grp.add(collarCone);

  for (const sx of [-1, 1]) {
    const wingPad = new THREE.Mesh(getGeo('lich_sh_pad', () => new THREE.ConeGeometry(0.24, 0.48, 5)), trimMat);
    wingPad.position.set(sx * 0.48, 0.42, 0.02);
    wingPad.rotation.z = -sx * 1.18;
    const clasp = new THREE.Mesh(getGeo('lich_clasp_gem', () => new THREE.SphereGeometry(0.085, 8, 8)), gemMat);
    clasp.position.set(sx * 0.24, 0.32, 0.22);
    grp.add(wingPad, clasp);
  }
  return grp;
}

function createHandSpellOrb(coreHex = 0xf5d0fe, glowHex = 0xa855f7) {
  const grp = new THREE.Group();
  const coreMat = getMat(`orb_core_${coreHex}_${glowHex}`, () =>
    new THREE.MeshStandardMaterial({
      color: coreHex,
      emissive: glowHex,
      emissiveIntensity: 2.8,
      roughness: 0.12
    })
  );
  const auraMat = getMat(`orb_aura_${glowHex}`, () =>
    new THREE.MeshBasicMaterial({
      color: glowHex,
      transparent: true,
      opacity: 0.52,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    })
  );
  const core = new THREE.Mesh(getGeo('hand_orb_core', () => new THREE.SphereGeometry(0.15, 12, 12)), coreMat);
  const flame = new THREE.Mesh(getGeo('hand_orb_flame', () => new THREE.ConeGeometry(0.16, 0.38, 7)), auraMat);
  flame.position.y = 0.14;
  grp.add(core, flame);
  grp.position.set(0, 0.16, 0.14);
  return grp;
}

function createMoltenRibcageAndSkullPads() {
  const grp = new THREE.Group();
  const coreMat = getMat('ember_skel_core', () =>
    new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xff5a00,
      emissiveIntensity: 2.9,
      roughness: 0.15
    })
  );
  const boneMat = getMat('ember_skel_pad_bone', () =>
    new THREE.MeshStandardMaterial({ color: 0xe7dfd3, roughness: 0.52, metalness: 0.08 })
  );
  const heart = new THREE.Mesh(
    getGeo('ember_rib_heart', () => new THREE.SphereGeometry(0.18, 10, 10)),
    coreMat
  );
  heart.scale.set(0.95, 1.25, 0.78);
  heart.position.set(0, 0.19, 0.10);
  grp.add(heart);

  // Twin bone skull pauldrons on shoulders (matches ad09b7c9.jpg!)
  const skullPadGeo = getGeo('ember_skull_pad', () => new THREE.SphereGeometry(0.19, 10, 10));
  for (const sx of [-1, 1]) {
    const sk = new THREE.Mesh(skullPadGeo, boneMat);
    sk.scale.set(1.0, 1.08, 0.92);
    sk.position.set(sx * 0.41, 0.34, 0.02);
    grp.add(sk);
  }
  grp.userData.heart = heart;
  return grp;
}

function createCultistHoodAndSkullClasp() {
  const headGrp = new THREE.Group();
  const chestGrp = new THREE.Group();
  const hoodMat = getMat('cult_purple_hood', () =>
    new THREE.MeshStandardMaterial({ color: 0x4c1d95, roughness: 0.68, metalness: 0.08 })
  );
  const goldTrim = getMat('cult_gold_trim', () =>
    new THREE.MeshStandardMaterial({ color: 0xd99b26, metalness: 0.82, roughness: 0.28 })
  );
  const darkVoid = getMat('cult_hood_void', () =>
    new THREE.MeshBasicMaterial({ color: 0x090514 })
  );
  const boneMat = getMat('ember_skel_pad_bone', () =>
    new THREE.MeshStandardMaterial({ color: 0xe7dfd3, roughness: 0.52, metalness: 0.08 })
  );

  const cowl = new THREE.Mesh(
    getGeo('cult_cowl_dome', () => new THREE.SphereGeometry(0.49, 12, 10)),
    hoodMat
  );
  cowl.scale.set(1.04, 1.08, 1.08);
  cowl.position.set(0, 0.48, -0.02);

  const peak = new THREE.Mesh(
    getGeo('cult_cowl_peak', () => new THREE.ConeGeometry(0.32, 0.52, 8)),
    hoodMat
  );
  peak.position.set(0, 0.92, -0.10);
  peak.rotation.x = -0.32;

  const rim = new THREE.Mesh(
    getGeo('cult_cowl_rim', () => new THREE.TorusGeometry(0.38, 0.045, 7, 16)),
    goldTrim
  );
  rim.position.set(0, 0.44, 0.26);

  const shadowFace = new THREE.Mesh(
    getGeo('cult_void_face', () => new THREE.SphereGeometry(0.35, 10, 10)),
    darkVoid
  );
  shadowFace.position.set(0, 0.44, 0.16);

  headGrp.add(cowl, peak, rim, shadowFace);
  headGrp.add(createGlowingEyePair(0xd946ef, 0.145, 0.44, 0.48, 1.35, 0.72));

  const skullClasp = new THREE.Mesh(
    getGeo('cult_skull_clasp', () => new THREE.SphereGeometry(0.12, 8, 8)),
    boneMat
  );
  skullClasp.position.set(0, 0.34, 0.24);
  chestGrp.add(skullClasp);
  return { headGrp, chestGrp };
}

function createMummyHeadAndCollar() {
  const headGrp = new THREE.Group();
  const chestGrp = new THREE.Group();
  const linenMat = getMat('mum_linen', () =>
    new THREE.MeshStandardMaterial({ color: 0xd9c79e, roughness: 0.85, metalness: 0.04 })
  );
  const darkSlit = getMat('cult_hood_void', () => new THREE.MeshBasicMaterial({ color: 0x0b131e }));
  const goldMat = getMat('mum_pharaoh_gold', () =>
    new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.86, roughness: 0.22 })
  );
  const turqMat = getMat('mum_pharaoh_turq', () =>
    new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0891b2, emissiveIntensity: 0.85, roughness: 0.25 })
  );

  const wrapSkull = new THREE.Mesh(
    getGeo('mum_wrap_dome', () => new THREE.SphereGeometry(0.45, 12, 10)),
    linenMat
  );
  wrapSkull.position.set(0, 0.44, 0.02);
  const bandTop = new THREE.Mesh(
    getGeo('mum_band_top', () => new THREE.CylinderGeometry(0.45, 0.46, 0.16, 12)),
    linenMat
  );
  bandTop.position.set(0, 0.60, 0.02);
  bandTop.rotation.z = 0.08;
  const bandLow = new THREE.Mesh(
    getGeo('mum_band_low', () => new THREE.CylinderGeometry(0.44, 0.42, 0.18, 12)),
    linenMat
  );
  bandLow.position.set(0, 0.24, 0.04);
  bandLow.rotation.z = -0.06;
  const eyeBand = new THREE.Mesh(
    getGeo('mum_eye_slit', () => new THREE.BoxGeometry(0.56, 0.14, 0.28)),
    darkSlit
  );
  eyeBand.position.set(0, 0.42, 0.30);

  headGrp.add(wrapSkull, bandTop, bandLow, eyeBand);
  headGrp.add(createGlowingEyePair(0x22d3ee, 0.15, 0.42, 0.46, 1.38, 0.72));

  // Broad Golden & Turquoise Pharaoh Collar
  const collarGold = new THREE.Mesh(
    getGeo('mum_collar_disc', () => new THREE.CylinderGeometry(0.46, 0.56, 0.10, 14)),
    goldMat
  );
  collarGold.position.set(0, 0.36, 0.02);
  const collarTurq = new THREE.Mesh(
    getGeo('mum_collar_ring', () => {
      const tg = new THREE.TorusGeometry(0.49, 0.045, 6, 16);
      tg.rotateX(Math.PI * 0.5);
      return tg;
    }),
    turqMat
  );
  collarTurq.position.set(0, 0.35, 0.03);
  chestGrp.add(collarGold, collarTurq);
  return { headGrp, chestGrp };
}

function createVampireHeadAndCape() {
  const headGrp = new THREE.Group();
  const chestGrp = new THREE.Group();
  const paleMat = getMat('vamp_pale_skin', () =>
    new THREE.MeshStandardMaterial({ color: 0xd8d8e2, roughness: 0.55, metalness: 0.05 })
  );
  const hairMat = getMat('vamp_black_hair', () =>
    new THREE.MeshStandardMaterial({ color: 0x111116, roughness: 0.42, metalness: 0.18 })
  );
  const crimsonMat = getMat('vamp_crimson_cloth', () =>
    new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.58, metalness: 0.08, side: THREE.DoubleSide })
  );

  const headSphere = new THREE.Mesh(
    getGeo('cmh_cranium', () => new THREE.SphereGeometry(0.43, 14, 12)),
    paleMat
  );
  headSphere.position.set(0, 0.42, 0.02);

  // Slicked-back black hair dome + widow's peak on forehead
  const hairDome = new THREE.Mesh(
    getGeo('vamp_hair_dome', () => new THREE.SphereGeometry(0.455, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.56)),
    hairMat
  );
  hairDome.position.set(0, 0.46, -0.02);
  hairDome.rotation.x = -0.22;
  const widowPeak = new THREE.Mesh(
    getGeo('vamp_widow_peak', () => new THREE.ConeGeometry(0.11, 0.20, 4)),
    hairMat
  );
  widowPeak.rotation.x = Math.PI;
  widowPeak.position.set(0, 0.62, 0.39);

  const earGeo = getGeo('vamp_ear', () => new THREE.ConeGeometry(0.09, 0.30, 5));
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(earGeo, paleMat);
    ear.position.set(sx * 0.46, 0.43, 0.02);
    ear.rotation.z = -sx * 1.15;
    headGrp.add(ear);
  }

  headGrp.add(headSphere, hairDome, widowPeak);
  headGrp.add(createGlowingEyePair(0xff1e1e, 0.15, 0.41, 0.44, 1.32, 0.72));

  // Upstanding Crimson Vampire Collar + Crimson Waistcoat
  const highCollar = new THREE.Mesh(
    getGeo('vamp_collar', () => new THREE.CylinderGeometry(0.52, 0.32, 0.36, 12, 1, true, Math.PI * 0.52, Math.PI * 0.96)),
    crimsonMat
  );
  highCollar.position.set(0, 0.46, -0.05);
  const vest = new THREE.Mesh(
    getGeo('vamp_vest', () => new THREE.BoxGeometry(0.36, 0.36, 0.08)),
    crimsonMat
  );
  vest.position.set(0, 0.18, 0.21);
  chestGrp.add(highCollar, vest);
  return { headGrp, chestGrp };
}

function createIronTowerShield() {
  const grp = new THREE.Group();
  const plateMat = getMat('ts_rusted_plate', () =>
    new THREE.MeshStandardMaterial({ color: 0x4b423b, metalness: 0.72, roughness: 0.42 })
  );
  const rimMat = getMat('ts_rusted_rim', () =>
    new THREE.MeshStandardMaterial({ color: 0x78716c, metalness: 0.80, roughness: 0.32 })
  );
  const mainPlate = new THREE.Mesh(getGeo('ts_body', () => new THREE.BoxGeometry(0.64, 0.86, 0.075)), plateMat);
  const borderV = new THREE.Mesh(getGeo('ts_border_v', () => new THREE.BoxGeometry(0.70, 0.90, 0.045)), rimMat);
  borderV.position.z = -0.015;
  const boss = new THREE.Mesh(getGeo('skel_buckler_boss', () => new THREE.SphereGeometry(0.11, 8, 8)), rimMat);
  boss.position.set(0, 0.06, 0.055);
  grp.add(mainPlate, borderV, boss);
  grp.position.set(0.08, 0.04, 0.16);
  grp.rotation.y = 0.18;
  return grp;
}

function makeEnemyWeaponProp(kind) {
  const g = new THREE.Group();
  const darkWoodMat = getMat('ew_wood', () => new THREE.MeshStandardMaterial({ color: 0x452b1a, roughness: 0.78, metalness: 0.08 }));
  const darkIronMat = getMat('ew_dark_iron', () => new THREE.MeshStandardMaterial({ color: 0x333842, metalness: 0.80, roughness: 0.32 }));
  const stoneMat = getMat('ew_stone', () => new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.72, metalness: 0.18 }));
  const steelMat = getMat('ew_steel', () => new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.82, roughness: 0.26 }));
  const goldMat = getMat('ew_gold', () => new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.88, roughness: 0.20 }));
  const boneMat = getMat('ew_bone', () => new THREE.MeshStandardMaterial({ color: 0xe2dacb, roughness: 0.50, metalness: 0.08 }));

  if (kind === 'goblin_stone_axe') {
    const shaft = new THREE.Mesh(getGeo('ga_shaft', () => new THREE.CylinderGeometry(0.042, 0.048, 0.92, 7)), darkWoodMat);
    shaft.position.y = 0.34;
    const headStone = new THREE.Mesh(getGeo('ga_stone', () => new THREE.BoxGeometry(0.42, 0.26, 0.11)), stoneMat);
    headStone.position.set(0.10, 0.68, 0);
    const edge = new THREE.Mesh(getGeo('ga_edge', () => new THREE.BoxGeometry(0.12, 0.32, 0.06)), steelMat);
    edge.position.set(0.28, 0.68, 0);
    const wrap = new THREE.Mesh(getGeo('ga_wrap', () => new THREE.BoxGeometry(0.15, 0.14, 0.14)), darkWoodMat);
    wrap.position.set(0, 0.68, 0);
    g.add(shaft, headStone, edge, wrap);
    g.rotation.y = Math.PI * 0.5;
    return g;
  }

  if (kind === 'mummy_crescent_staff') {
    const pole = new THREE.Mesh(getGeo('mc_pole', () => new THREE.CylinderGeometry(0.040, 0.048, 1.68, 8)), goldMat);
    pole.position.y = 0.58;
    const collar = new THREE.Mesh(getGeo('mc_collar', () => new THREE.CylinderGeometry(0.09, 0.06, 0.14, 8)), goldMat);
    collar.position.y = 1.38;
    const crescent = new THREE.Mesh(
      getGeo('mc_crescent', () => new THREE.TorusGeometry(0.23, 0.052, 8, 18, Math.PI * 1.42)),
      goldMat
    );
    crescent.position.set(0.04, 1.62, 0);
    crescent.rotation.z = 0.42;
    g.add(pole, collar, crescent);
    return g;
  }

  if (kind === 'cultist_skull_staff' || kind === 'archlich_violet_staff') {
    const isBoss = kind === 'archlich_violet_staff';
    const poleH = isBoss ? 1.98 : 1.62;
    const pole = new THREE.Mesh(
      getGeo(isBoss ? 'cs_pole_boss' : 'cs_pole', () => new THREE.CylinderGeometry(0.042, 0.054, poleH, 8)),
      isBoss ? darkIronMat : darkWoodMat
    );
    pole.position.y = poleH * 0.36;

    const skull = new THREE.Mesh(getGeo('ns_skull', () => new THREE.SphereGeometry(0.15, 10, 10)), boneMat);
    skull.scale.set(0.96, 1.12, 0.96);
    skull.position.y = poleH * 0.80;

    const violetMat = getMat('cs_violet_flame', () =>
      new THREE.MeshStandardMaterial({
        color: 0xf5d0fe,
        emissive: 0xa855f7,
        emissiveIntensity: 2.5,
        roughness: 0.14
      })
    );
    const orb = new THREE.Mesh(
      getGeo(isBoss ? 'cs_orb_boss' : 'cs_orb', () => new THREE.SphereGeometry(isBoss ? 0.21 : 0.14, 10, 10)),
      violetMat
    );
    orb.position.y = poleH * 0.80 + (isBoss ? 0.30 : 0.20);
    const flameTip = new THREE.Mesh(
      getGeo('cs_flame_cone', () => new THREE.ConeGeometry(isBoss ? 0.20 : 0.12, isBoss ? 0.42 : 0.26, 7)),
      violetMat
    );
    flameTip.position.y = orb.position.y + (isBoss ? 0.20 : 0.12);
    g.add(pole, skull, orb, flameTip);
    if (isBoss) {
      for (const sx of [-1, 1]) {
        const prong = new THREE.Mesh(getGeo('cs_prong', () => new THREE.ConeGeometry(0.055, 0.46, 5)), darkIronMat);
        prong.position.set(sx * 0.22, orb.position.y + 0.02, 0);
        prong.rotation.z = -sx * 0.28;
        g.add(prong);
      }
    }
    return g;
  }

  if (kind === 'ogre_colossal_warhammer') {
    // Act IV Boss «Огр-Костолом» Colossal Forged Iron Warhammer (matches ad09b7c9.jpg #4!)
    const shaft = new THREE.Mesh(
      getGeo('og_wh_shaft', () => new THREE.CylinderGeometry(0.056, 0.064, 1.85, 8)),
      darkWoodMat
    );
    shaft.position.y = 0.68;
    const gripBand = new THREE.Mesh(
      getGeo('og_wh_collar', () => new THREE.CylinderGeometry(0.10, 0.09, 0.20, 8)),
      darkIronMat
    );
    gripBand.position.y = 1.32;
    const headBlock = new THREE.Mesh(
      getGeo('og_wh_head', () => new THREE.BoxGeometry(0.78, 0.44, 0.42)),
      darkIronMat
    );
    headBlock.position.y = 1.56;
    const steelFaces = new THREE.Mesh(
      getGeo('og_wh_faces', () => new THREE.BoxGeometry(0.84, 0.36, 0.36)),
      steelMat
    );
    steelFaces.position.y = 1.56;
    const midStrap = new THREE.Mesh(
      getGeo('og_wh_strap', () => new THREE.BoxGeometry(0.24, 0.48, 0.46)),
      steelMat
    );
    midStrap.position.y = 1.56;
    g.add(shaft, gripBand, headBlock, steelFaces, midStrap);
    g.rotation.y = Math.PI * 0.5;
    return g;
  }

  if (kind === 'demon_magma_greatsword') {
    // Act I Boss «Демон Преисподней» Blazing Magma Greatsword (matches ad09b7c9.jpg #1!)
    const hilt = new THREE.Mesh(
      getGeo('mg_hilt', () => new THREE.CylinderGeometry(0.055, 0.062, 0.48, 8)),
      darkIronMat
    );
    hilt.position.y = 0.05;
    const guard = new THREE.Mesh(
      getGeo('mg_guard', () => new THREE.BoxGeometry(0.68, 0.13, 0.16)),
      darkIronMat
    );
    guard.position.y = 0.28;
    const skullGuard = new THREE.Mesh(getGeo('ns_skull', () => new THREE.SphereGeometry(0.14, 9, 9)), boneMat);
    skullGuard.position.set(0, 0.29, 0.06);

    const obsidianCore = new THREE.Mesh(
      getGeo('mg_core_blade', () => new THREE.BoxGeometry(0.22, 1.54, 0.075)),
      getMat('mg_obs_mat', () =>
        new THREE.MeshStandardMaterial({ color: 0x290909, emissive: 0x9a3412, emissiveIntensity: 0.75, metalness: 0.72, roughness: 0.3 })
      )
    );
    obsidianCore.position.y = 1.10;

    const magmaEdgeMat = getMat('mg_magma_edge', () =>
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xff4500,
        emissiveIntensity: 2.6,
        roughness: 0.16
      })
    );
    const flameBlade = new THREE.Mesh(
      getGeo('mg_flame_blade', () => new THREE.BoxGeometry(0.38, 1.50, 0.044)),
      magmaEdgeMat
    );
    flameBlade.position.y = 1.10;
    const flameTip = new THREE.Mesh(
      getGeo('mg_flame_tip', () => {
        const cg = new THREE.ConeGeometry(0.22, 0.42, 4);
        cg.rotateY(Math.PI / 4);
        return cg;
      }),
      magmaEdgeMat
    );
    flameTip.scale.set(1, 1, 0.32);
    flameTip.position.y = 2.04;

    g.add(hilt, guard, skullGuard, obsidianCore, flameBlade, flameTip);
    g.rotation.x = 0.22;
    g.rotation.y = Math.PI * 0.5;
    return g;
  }

  // Default 'bone_sword' / 'broadsword'
  const isBroad = kind === 'broadsword';
  const bladeLen = isBroad ? 0.98 : 0.86;
  const bladeW = isBroad ? 0.16 : 0.12;
  const grip = new THREE.Mesh(getGeo('ew_sw_grip', () => new THREE.CylinderGeometry(0.038, 0.042, 0.26, 8)), darkWoodMat);
  const cross = new THREE.Mesh(getGeo('ew_sw_cross', () => new THREE.BoxGeometry(isBroad ? 0.30 : 0.24, 0.06, 0.09)), darkIronMat);
  cross.position.y = 0.14;
  const blade = new THREE.Mesh(
    getGeo(`eblade_v3_${kind}`, () => new THREE.BoxGeometry(bladeW, bladeLen, 0.040)),
    isBroad ? steelMat : boneMat
  );
  blade.position.y = bladeLen * 0.5 + 0.17;
  g.add(grip, cross, blade);
  g.rotation.x = 0.25;
  g.rotation.y = Math.PI * 0.5;
  return g;
}

// ============================================================================
// Custom Multi-Part Animated 3D Creature Rigs (Spider, Slime, Ghost, Wisp, Mimic, Treant)
// ============================================================================
function buildProceduralMonsterRig(rigType, scale = 1.0, flashSlots = []) {
  const grp = new THREE.Group();
  grp.scale.setScalar(scale);

  const regMesh = (mesh, skipFlash = false) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (!skipFlash && mesh.material) {
      flashSlots.push({ mesh, origMat: mesh.material });
    }
    return mesh;
  };

  let attackTimer = 0;

  if (rigType === 'dark_spider') {
    const bodyGrp = new THREE.Group();
    bodyGrp.position.y = 0.42;
    grp.add(bodyGrp);

    const chitinMat = getMat('spid_chitin', () =>
      new THREE.MeshStandardMaterial({ color: 0x1c1e26, roughness: 0.46, metalness: 0.26 })
    );
    const legMat = getMat('spid_leg', () =>
      new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.42, metalness: 0.30 })
    );
    const redEyeMat = getMat('spid_red_eye', () =>
      new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff0000, emissiveIntensity: 3.0, roughness: 0.12 })
    );

    const abdomen = regMesh(new THREE.Mesh(getGeo('spid_abd', () => new THREE.SphereGeometry(0.46, 14, 12)), chitinMat));
    abdomen.scale.set(1.06, 0.88, 1.24);
    abdomen.position.set(0, 0.10, -0.34);

    const head = regMesh(new THREE.Mesh(getGeo('spid_head', () => new THREE.SphereGeometry(0.32, 12, 10)), chitinMat));
    head.scale.set(1.05, 0.85, 1.02);
    head.position.set(0, 0.0, 0.24);
    bodyGrp.add(abdomen, head);

    // Cluster of 6 glowing crimson spider eyes!
    const mainEyeGeo = getGeo('spid_eye_lg', () => new THREE.SphereGeometry(0.056, 8, 8));
    const subEyeGeo = getGeo('spid_eye_sm', () => new THREE.SphereGeometry(0.036, 7, 7));
    const eyeSpecs = [
      [-0.10, 0.04, 0.52, mainEyeGeo],
      [0.10, 0.04, 0.52, mainEyeGeo],
      [-0.20, 0.07, 0.46, subEyeGeo],
      [0.20, 0.07, 0.46, subEyeGeo],
      [-0.06, 0.13, 0.49, subEyeGeo],
      [0.06, 0.13, 0.49, subEyeGeo]
    ];
    for (const [ex, ey, ez, eg] of eyeSpecs) {
      const em = regMesh(new THREE.Mesh(eg, redEyeMat), true);
      em.position.set(ex, ey, ez);
      bodyGrp.add(em);
    }

    // 2 Snapping Front Fangs (Chelicerae)
    const fangGeo = getGeo('spid_fang', () => new THREE.ConeGeometry(0.048, 0.22, 6));
    const fangs = [];
    for (const sx of [-1, 1]) {
      const f = regMesh(new THREE.Mesh(fangGeo, legMat));
      f.position.set(sx * 0.12, -0.10, 0.52);
      f.rotation.x = Math.PI * 0.78;
      f.rotation.z = sx * 0.25;
      bodyGrp.add(f);
      fangs.push({ mesh: f, sx });
    }

    // 8 Articulated 2-Segment Spider Legs
    const femurGeo = getGeo('spid_femur', () => {
      const cg = new THREE.CylinderGeometry(0.042, 0.052, 0.56, 7);
      cg.translate(0, 0.28, 0);
      return cg;
    });
    const tibiaGeo = getGeo('spid_tibia', () => {
      const cg = new THREE.ConeGeometry(0.044, 0.68, 7);
      cg.rotateX(Math.PI);
      cg.translate(0, -0.34, 0);
      return cg;
    });
    const legs = [];
    const legZ = [0.24, 0.07, -0.10, -0.27];
    const legYaw = [0.58, 0.18, -0.22, -0.62];
    for (let li = 0; li < 4; li++) {
      for (const sx of [-1, 1]) {
        const hip = new THREE.Group();
        hip.position.set(sx * 0.24, -0.02, legZ[li]);
        hip.rotation.y = sx * legYaw[li];

        const femur = regMesh(new THREE.Mesh(femurGeo, legMat));
        femur.rotation.z = -sx * 0.96;

        const knee = new THREE.Group();
        knee.position.set(sx * 0.46, 0.31, 0);
        const tibia = regMesh(new THREE.Mesh(tibiaGeo, legMat));
        tibia.rotation.z = -sx * 0.32;
        knee.add(tibia);

        hip.add(femur, knee);
        bodyGrp.add(hip);
        legs.push({ hip, baseYaw: sx * legYaw[li], sx, phase: (li % 2 === 0 ? 0 : Math.PI) + (sx < 0 ? Math.PI : 0) });
      }
    }

    return {
      root: grp,
      triggerAttack() { attackTimer = 0.26; },
      update(dt, t, isDying) {
        if (isDying) return;
        if (attackTimer > 0) attackTimer = Math.max(0, attackTimer - dt);
        const atkSnap = attackTimer > 0 ? Math.sin((attackTimer / 0.26) * Math.PI) : 0;
        bodyGrp.position.y = 0.42 + Math.sin(t * 16) * 0.03 + atkSnap * 0.12;
        for (let i = 0; i < legs.length; i++) {
          const lg = legs[i];
          const cyc = Math.sin(t * 17.0 + lg.phase);
          lg.hip.rotation.y = lg.baseYaw + cyc * 0.26;
          lg.hip.rotation.z = lg.sx * Math.max(0, cyc) * 0.18;
        }
        for (const fg of fangs) {
          fg.mesh.rotation.z = fg.sx * (0.25 - atkSnap * 0.55);
        }
      }
    };
  }

  if (rigType === 'toxic_slime') {
    const slimeMat = getMat('slime_purple', () =>
      new THREE.MeshStandardMaterial({ color: 0x3b1d5e, roughness: 0.16, metalness: 0.12 })
    );
    const acidGlowMat = getMat('slime_acid_glow', () =>
      new THREE.MeshStandardMaterial({ color: 0x86efac, emissive: 0x22c55e, emissiveIntensity: 3.0, roughness: 0.12 })
    );
    const cavityMat = getMat('slime_cavity', () =>
      new THREE.MeshStandardMaterial({ color: 0x150826, roughness: 0.8 })
    );
    const boneMat = getMat('ew_bone', () =>
      new THREE.MeshStandardMaterial({ color: 0xe2dacb, roughness: 0.5, metalness: 0.08 })
    );

    const jelly = new THREE.Group();
    grp.add(jelly);

    const puddle = regMesh(new THREE.Mesh(getGeo('slime_puddle', () => new THREE.CylinderGeometry(0.62, 0.78, 0.22, 16)), slimeMat));
    puddle.position.y = 0.11;
    const dome = regMesh(new THREE.Mesh(getGeo('slime_dome', () => new THREE.SphereGeometry(0.58, 16, 14)), slimeMat));
    dome.scale.set(1.02, 1.18, 0.98);
    dome.position.y = 0.56;
    jelly.add(puddle, dome);

    // Glossy ooze blisters around base
    const blisterGeo = getGeo('slime_blister', () => new THREE.SphereGeometry(0.18, 10, 10));
    for (let b = 0; b < 6; b++) {
      const a = (b / 6) * Math.PI * 2 + 0.3;
      const bl = regMesh(new THREE.Mesh(blisterGeo, slimeMat));
      bl.position.set(Math.cos(a) * 0.56, 0.18 + (b % 2) * 0.12, Math.sin(a) * 0.54);
      jelly.add(bl);
    }

    // Protruding pale bones sticking out of the ooze (matches ad09b7c9.jpg!)
    const topBone = regMesh(new THREE.Mesh(getGeo('slime_femur', () => new THREE.CylinderGeometry(0.045, 0.05, 0.42, 7)), boneMat));
    topBone.position.set(-0.22, 1.14, -0.04);
    topBone.rotation.z = 0.45;
    const sideBone = regMesh(new THREE.Mesh(getGeo('slime_rib', () => new THREE.ConeGeometry(0.055, 0.28, 6)), boneMat));
    sideBone.position.set(0.46, 0.62, 0.12);
    sideBone.rotation.z = -0.85;
    jelly.add(topBone, sideBone);

    // Glowing Toxic-Green Eyes & Jagged Acid Maw
    for (const sx of [-0.18, 0.18]) {
      const eye = regMesh(new THREE.Mesh(getGeo('slime_eye', () => new THREE.SphereGeometry(0.085, 8, 8)), acidGlowMat), true);
      eye.scale.set(1.25, 0.82, 0.65);
      eye.position.set(sx, 0.78, 0.51);
      eye.rotation.z = sx < 0 ? -0.25 : 0.25;
      jelly.add(eye);
    }
    const mawBack = regMesh(new THREE.Mesh(getGeo('slime_maw_back', () => new THREE.SphereGeometry(0.24, 10, 8)), cavityMat));
    mawBack.scale.set(1.25, 0.82, 0.45);
    mawBack.position.set(0, 0.48, 0.49);
    const mawGlow = regMesh(new THREE.Mesh(getGeo('slime_maw_glow', () => new THREE.SphereGeometry(0.20, 10, 8)), acidGlowMat), true);
    mawGlow.scale.set(1.20, 0.74, 0.42);
    mawGlow.position.set(0, 0.48, 0.51);
    jelly.add(mawBack, mawGlow);

    return {
      root: grp,
      triggerAttack() { attackTimer = 0.28; },
      update(dt, t, isDying) {
        if (isDying) return;
        if (attackTimer > 0) attackTimer = Math.max(0, attackTimer - dt);
        const sq = Math.sin(t * 9.5) * 0.11 + (attackTimer > 0 ? 0.18 : 0);
        jelly.scale.set(1 - sq * 0.55, 1 + sq, 1 - sq * 0.55);
      }
    };
  }

  if (rigType === 'phantom_ghost') {
    const floatGrp = new THREE.Group();
    floatGrp.position.y = 0.26;
    grp.add(floatGrp);

    const sheetMat = getMat('ghost_sheet', () =>
      new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        emissive: 0x64748b,
        emissiveIntensity: 0.36,
        roughness: 0.38,
        metalness: 0.04,
        side: THREE.DoubleSide
      })
    );
    const hollowMat = getMat('ghost_hollow', () => new THREE.MeshBasicMaterial({ color: 0x09090d }));
    const pupilMat = getMat('ghost_pupil', () =>
      new THREE.MeshStandardMaterial({ color: 0xffb703, emissive: 0xff6a00, emissiveIntensity: 2.9, roughness: 0.12 })
    );

    const ghostBodyGeo = getGeo('ghost_draped_sheet', () => {
      const g = new THREE.CylinderGeometry(0.36, 0.64, 1.08, 24, 10, true);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const vy = pos.getY(i); // -0.54 .. +0.54
        const vx = pos.getX(i);
        const vz = pos.getZ(i);
        const ang = Math.atan2(vz, vx);
        const bottomFactor = Math.max(0, (0.20 - vy) / 0.74);
        const ruffle = Math.sin(ang * 7) * 0.08 * bottomFactor;
        const scallopY = Math.cos(ang * 7) * 0.065 * bottomFactor;
        pos.setX(i, vx * (1 + ruffle));
        pos.setZ(i, vz * (1 + ruffle));
        pos.setY(i, vy + scallopY + 0.54);
      }
      g.computeVertexNormals();
      return g;
    });

    const sheet = regMesh(new THREE.Mesh(ghostBodyGeo, sheetMat));
    const headDome = regMesh(new THREE.Mesh(getGeo('ghost_head_cap', () => new THREE.SphereGeometry(0.365, 16, 12)), sheetMat));
    headDome.position.y = 1.06;
    floatGrp.add(sheet, headDome);

    // 2 Draped Ghost Arms
    const armGeo = getGeo('ghost_arm', () => new THREE.ConeGeometry(0.15, 0.44, 8));
    const arms = [];
    for (const sx of [-1, 1]) {
      const arm = regMesh(new THREE.Mesh(armGeo, sheetMat));
      arm.position.set(sx * 0.46, 0.72, 0.06);
      arm.rotation.z = sx * 2.15;
      arm.rotation.x = 0.25;
      floatGrp.add(arm);
      arms.push({ mesh: arm, sx });
    }

    // Dark oval eye sockets + glowing orange pupils + wailing open mouth (matches ad09b7c9.jpg!)
    for (const sx of [-0.14, 0.14]) {
      const sock = new THREE.Mesh(getGeo('ghost_sock', () => new THREE.SphereGeometry(0.085, 9, 9)), hollowMat);
      sock.scale.set(0.85, 1.35, 0.45);
      sock.position.set(sx, 0.98, 0.35);
      const pup = regMesh(new THREE.Mesh(getGeo('ghost_pup', () => new THREE.SphereGeometry(0.052, 8, 8)), pupilMat), true);
      pup.position.set(sx, 0.96, 0.38);
      floatGrp.add(sock, pup);
    }
    const wailMouth = new THREE.Mesh(getGeo('ghost_wail', () => new THREE.SphereGeometry(0.095, 9, 9)), hollowMat);
    wailMouth.scale.set(0.78, 1.48, 0.45);
    wailMouth.position.set(0, 0.72, 0.42);
    floatGrp.add(wailMouth);

    return {
      root: grp,
      triggerAttack() { attackTimer = 0.25; },
      update(dt, t, isDying) {
        if (isDying) return;
        if (attackTimer > 0) attackTimer = Math.max(0, attackTimer - dt);
        floatGrp.position.y = 0.24 + Math.sin(t * 4.4) * 0.10;
        floatGrp.rotation.z = Math.sin(t * 2.8) * 0.06;
        for (const a of arms) {
          a.mesh.rotation.z = a.sx * (2.15 + Math.sin(t * 5.2) * 0.16 - (attackTimer > 0 ? 0.45 : 0));
        }
      }
    };
  }

  if (rigType === 'vampire_bat') {
    const batGrp = new THREE.Group();
    batGrp.position.y = 1.05;
    grp.add(batGrp);

    const furMat = getMat('vbat_fur', () =>
      new THREE.MeshStandardMaterial({ color: 0x1e1429, roughness: 0.78, metalness: 0.12 })
    );
    const wingMat = getMat('vbat_wing', () =>
      new THREE.MeshStandardMaterial({ color: 0x4c1028, emissive: 0x881337, emissiveIntensity: 0.25, roughness: 0.55, side: THREE.DoubleSide })
    );
    const fangMat = getMat('vbat_fang', () =>
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 })
    );

    const torso = regMesh(new THREE.Mesh(getGeo('vbat_body', () => new THREE.SphereGeometry(0.24, 12, 10)), furMat));
    torso.scale.set(0.95, 0.9, 1.35);
    const head = regMesh(new THREE.Mesh(getGeo('vbat_head', () => new THREE.SphereGeometry(0.18, 12, 10)), furMat));
    head.position.set(0, 0.08, 0.24);
    const earGeo = getGeo('vbat_ear', () => new THREE.ConeGeometry(0.06, 0.18, 5));
    const earL = regMesh(new THREE.Mesh(earGeo, furMat));
    earL.position.set(-0.09, 0.24, 0.22);
    earL.rotation.z = 0.28;
    const earR = regMesh(new THREE.Mesh(earGeo, furMat));
    earR.position.set(0.09, 0.24, 0.22);
    earR.rotation.z = -0.28;

    const fangGeo = getGeo('vbat_f', () => new THREE.ConeGeometry(0.022, 0.075, 4));
    const fL = regMesh(new THREE.Mesh(fangGeo, fangMat));
    fL.rotation.x = Math.PI;
    fL.position.set(-0.045, -0.02, 0.40);
    const fR = regMesh(new THREE.Mesh(fangGeo, fangMat));
    fR.rotation.x = Math.PI;
    fR.position.set(0.045, -0.02, 0.40);

    head.add(createGlowingEyePair(0xff1e1e, 0.07, 0.04, 0.16, 0.65, 0.42));
    batGrp.add(torso, head, earL, earR, fL, fR);

    const wingGeo = getGeo('vbat_wing_geo', () => {
      const sh = new THREE.Shape();
      sh.moveTo(0, 0);
      sh.lineTo(0.42, 0.14);
      sh.lineTo(0.68, -0.02);
      sh.lineTo(0.46, -0.18);
      sh.lineTo(0.24, -0.12);
      sh.lineTo(0, -0.18);
      sh.closePath();
      return new THREE.ShapeGeometry(sh);
    });
    const wingLPiv = new THREE.Group();
    wingLPiv.position.set(-0.14, 0.06, 0.05);
    const wingL = regMesh(new THREE.Mesh(wingGeo, wingMat));
    wingL.rotation.x = -Math.PI * 0.5;
    wingL.scale.x = -1;
    wingLPiv.add(wingL);

    const wingRPiv = new THREE.Group();
    wingRPiv.position.set(0.14, 0.06, 0.05);
    const wingR = regMesh(new THREE.Mesh(wingGeo, wingMat));
    wingR.rotation.x = -Math.PI * 0.5;
    wingRPiv.add(wingR);

    batGrp.add(wingLPiv, wingRPiv);

    return {
      root: grp,
      triggerAttack() { attackTimer = 0.25; },
      update(dt, t, isDying) {
        if (isDying) return;
        if (attackTimer > 0) attackTimer = Math.max(0, attackTimer - dt);
        const flap = Math.sin(t * 25.0 + (grp.id || 0));
        batGrp.position.y = 1.05 + flap * 0.11 + (attackTimer > 0 ? 0.16 : 0);
        wingLPiv.rotation.z = flap * 0.85;
        wingRPiv.rotation.z = -flap * 0.85;
        batGrp.rotation.x = 0.22 + (attackTimer > 0 ? 0.35 : 0);
      }
    };
  }

  if (rigType === 'shadow_wisp') {
    const floatGrp = new THREE.Group();
    floatGrp.position.y = 0.28;
    grp.add(floatGrp);

    const shadowMat = getMat('wisp_pitch_black', () =>
      new THREE.MeshStandardMaterial({ color: 0x09090f, roughness: 0.90, metalness: 0.05 })
    );
    const eyeMat = getMat('wisp_blaze_eye', () =>
      new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xff6a00, emissiveIntensity: 3.2, roughness: 0.10 })
    );

    const head = regMesh(new THREE.Mesh(getGeo('wisp_head', () => new THREE.SphereGeometry(0.40, 14, 12)), shadowMat));
    head.position.y = 0.88;
    const torso = regMesh(new THREE.Mesh(getGeo('wisp_torso', () => new THREE.ConeGeometry(0.32, 0.82, 12)), shadowMat));
    torso.rotation.x = Math.PI;
    torso.position.y = 0.46;
    const tailTip = regMesh(new THREE.Mesh(getGeo('wisp_tail', () => new THREE.ConeGeometry(0.15, 0.42, 8)), shadowMat));
    tailTip.rotation.x = Math.PI;
    tailTip.position.set(0.08, 0.14, -0.08);
    tailTip.rotation.z = 0.35;
    floatGrp.add(head, torso, tailTip);

    // Crown of 5 pitch-black shadow flame tongues on head
    const flames = [];
    const flameGeo = getGeo('wisp_crown_flame', () => new THREE.ConeGeometry(0.13, 0.46, 6));
    for (let i = 0; i < 5; i++) {
      const f = regMesh(new THREE.Mesh(flameGeo, shadowMat));
      const frac = (i - 2) * 0.14;
      f.position.set(frac, 1.28 + (i === 2 ? 0.10 : 0), (i % 2 === 0 ? -0.04 : 0.04));
      f.rotation.z = -frac * 1.4;
      floatGrp.add(f);
      flames.push({ mesh: f, phase: i * 1.3 });
    }

    // 2 Shadow Arms
    const armGeo = getGeo('wisp_arm', () => new THREE.ConeGeometry(0.10, 0.42, 6));
    for (const sx of [-1, 1]) {
      const arm = regMesh(new THREE.Mesh(armGeo, shadowMat));
      arm.position.set(sx * 0.38, 0.62, 0.08);
      arm.rotation.z = sx * 2.25;
      floatGrp.add(arm);
    }

    // 2 Large Slanted Blazing Orange Eyes
    for (const sx of [-0.15, 0.15]) {
      const eye = regMesh(new THREE.Mesh(getGeo('wisp_eye', () => new THREE.SphereGeometry(0.088, 9, 9)), eyeMat), true);
      eye.scale.set(1.38, 0.78, 0.55);
      eye.position.set(sx, 0.86, 0.36);
      eye.rotation.z = sx < 0 ? -0.28 : 0.28;
      floatGrp.add(eye);
    }

    return {
      root: grp,
      triggerAttack() { attackTimer = 0.24; },
      update(dt, t, isDying) {
        if (isDying) return;
        if (attackTimer > 0) attackTimer = Math.max(0, attackTimer - dt);
        floatGrp.position.y = 0.26 + Math.sin(t * 5.2) * 0.11;
        tailTip.rotation.z = 0.32 + Math.sin(t * 7.5) * 0.22;
        for (const fl of flames) {
          fl.mesh.scale.y = 0.88 + Math.sin(t * 11.0 + fl.phase) * 0.20;
        }
      }
    };
  }

  if (rigType === 'mimic_chest') {
    const hopGrp = new THREE.Group();
    grp.add(hopGrp);

    const woodMat = getMat('mim_wood', () =>
      new THREE.MeshStandardMaterial({ color: 0x5c361c, roughness: 0.72, metalness: 0.10 })
    );
    const goldMat = getMat('mim_brass', () =>
      new THREE.MeshStandardMaterial({ color: 0xd99b26, metalness: 0.82, roughness: 0.26 })
    );
    const mawMat = getMat('mim_maw_dark', () =>
      new THREE.MeshStandardMaterial({ color: 0x1e0b24, roughness: 0.85 })
    );
    const tongueMat = getMat('mim_purple_tongue', () =>
      new THREE.MeshStandardMaterial({ color: 0x9333ea, roughness: 0.24, metalness: 0.08 })
    );
    const fangMat = getMat('cmh_fang_ivory', () =>
      new THREE.MeshStandardMaterial({ color: 0xf5efe0, roughness: 0.38, metalness: 0.06 })
    );

    // Lower Chest Box + Gold Trim + Maw Cavity
    const baseBox = regMesh(new THREE.Mesh(getGeo('mim_base', () => new THREE.BoxGeometry(0.96, 0.52, 0.74)), woodMat));
    baseBox.position.y = 0.26;
    const baseRim = regMesh(new THREE.Mesh(getGeo('mim_base_rim', () => new THREE.BoxGeometry(1.02, 0.10, 0.80)), goldMat));
    baseRim.position.y = 0.48;
    const mawCavity = new THREE.Mesh(getGeo('mim_cavity', () => new THREE.BoxGeometry(0.84, 0.12, 0.62)), mawMat);
    mawCavity.position.y = 0.50;
    const lockPlate = regMesh(new THREE.Mesh(getGeo('mim_lock', () => new THREE.BoxGeometry(0.18, 0.20, 0.06)), goldMat));
    lockPlate.position.set(0, 0.40, 0.40);
    hopGrp.add(baseBox, baseRim, mawCavity, lockPlate);

    // Lower Row of Sharp Ivory Fangs
    const fangGeo = getGeo('mim_fang', () => new THREE.ConeGeometry(0.048, 0.18, 5));
    for (let i = 0; i < 6; i++) {
      const fx = -0.35 + (i / 5) * 0.70;
      const lf = regMesh(new THREE.Mesh(fangGeo, fangMat));
      lf.position.set(fx, 0.58, 0.32);
      hopGrp.add(lf);
    }

    // Curling Glossy Purple Tongue
    const tonguePivot = new THREE.Group();
    tonguePivot.position.set(0, 0.48, 0.10);
    const tCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.06, 0.08, 0.28),
      new THREE.Vector3(0.14, -0.06, 0.54),
      new THREE.Vector3(0.08, -0.22, 0.62)
    ]);
    const tongueMesh = regMesh(
      new THREE.Mesh(getGeo('mim_tongue_tube', () => new THREE.TubeGeometry(tCurve, 12, 0.095, 8, false)), tongueMat)
    );
    tonguePivot.add(tongueMesh);
    hopGrp.add(tonguePivot);

    // Hinged Upper Treasure Lid + Upper Row of Fangs + Glowing Eyes
    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, 0.52, -0.35);
    const lidVault = regMesh(
      new THREE.Mesh(
        getGeo('mim_lid_vault', () => {
          const cg = new THREE.CylinderGeometry(0.37, 0.37, 0.96, 12, 1, false, 0, Math.PI);
          cg.rotateZ(Math.PI * 0.5);
          return cg;
        }),
        woodMat
      )
    );
    lidVault.position.set(0, 0.02, 0.35);
    const lidRim = regMesh(new THREE.Mesh(getGeo('mim_base_rim', () => new THREE.BoxGeometry(1.02, 0.10, 0.80)), goldMat));
    lidRim.position.set(0, 0.02, 0.35);
    lidPivot.add(lidVault, lidRim);

    for (let i = 0; i < 6; i++) {
      const fx = -0.35 + (i / 5) * 0.70;
      const uf = regMesh(new THREE.Mesh(fangGeo, fangMat));
      uf.rotation.x = Math.PI;
      uf.position.set(fx, -0.08, 0.67);
      lidPivot.add(uf);
    }
    lidPivot.add(createGlowingEyePair(0xff7a00, 0.22, 0.18, 0.70, 1.25, 0.70));
    lidPivot.rotation.x = -0.68;
    hopGrp.add(lidPivot);

    return {
      root: grp,
      triggerAttack() { attackTimer = 0.28; },
      update(dt, t, isDying) {
        if (isDying) return;
        if (attackTimer > 0) attackTimer = Math.max(0, attackTimer - dt);
        const hop = Math.abs(Math.sin(t * 8.5));
        hopGrp.position.y = hop * 0.16;
        const chomp = attackTimer > 0 ? Math.sin((attackTimer / 0.28) * Math.PI) * 0.52 : hop * 0.26;
        lidPivot.rotation.x = -0.78 + chomp;
        tonguePivot.rotation.y = Math.sin(t * 7.0) * 0.26;
      }
    };
  }

  // Default procedural rig: 'corrupted_treant' (Гнилой древень — Twisted dead tree with blazing orange jack-o'-lantern face!)
  const swayGrp = new THREE.Group();
  grp.add(swayGrp);

  const barkMat = getMat('treant_bark', () =>
    new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 0.88, metalness: 0.04 })
  );
  const darkHollowMat = getMat('treant_hollow', () =>
    new THREE.MeshStandardMaterial({ color: 0x1a0d06, roughness: 0.9 })
  );
  const fireFaceMat = getMat('treant_fire_face', () =>
    new THREE.MeshStandardMaterial({ color: 0xfde047, emissive: 0xff6a00, emissiveIntensity: 3.0, roughness: 0.14 })
  );

  // Fluted gnarled tree trunk
  const trunkGeo = getGeo('treant_trunk', () => {
    const cg = new THREE.CylinderGeometry(0.42, 0.64, 1.48, 12, 6);
    const pos = cg.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const a = Math.atan2(vz, vx);
      const flute = 1 + Math.sin(a * 5 + vy * 1.8) * 0.10;
      pos.setX(i, vx * flute);
      pos.setZ(i, vz * flute);
      pos.setY(i, vy + 0.74);
    }
    cg.computeVertexNormals();
    return cg;
  });
  const trunk = regMesh(new THREE.Mesh(trunkGeo, barkMat));
  swayGrp.add(trunk);

  // 5 Sprawling Root-Feet
  const rootGeo = getGeo('treant_root', () => new THREE.ConeGeometry(0.16, 0.56, 6));
  for (let r = 0; r < 5; r++) {
    const a = (r / 5) * Math.PI * 2 + 0.3;
    const rf = regMesh(new THREE.Mesh(rootGeo, barkMat));
    rf.position.set(Math.cos(a) * 0.56, 0.14, Math.sin(a) * 0.56);
    rf.rotation.z = -Math.cos(a) * 1.15;
    rf.rotation.x = Math.sin(a) * 1.15;
    swayGrp.add(rf);
  }

  // Crown of 6 Gnarled Dead Branches
  for (let b = 0; b < 6; b++) {
    const a = (b / 6) * Math.PI * 2 + 0.25;
    const bCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 0.26, 1.38, Math.sin(a) * 0.26),
      new THREE.Vector3(Math.cos(a) * 0.54, 1.78, Math.sin(a) * 0.54),
      new THREE.Vector3(Math.cos(a + 0.3) * 0.72, 2.12 + (b % 2) * 0.16, Math.sin(a + 0.3) * 0.72)
    ]);
    const bMesh = regMesh(
      new THREE.Mesh(getGeo(`treant_bough_${b}`, () => new THREE.TubeGeometry(bCurve, 8, 0.072, 6, false)), barkMat)
    );
    swayGrp.add(bMesh);
  }

  // 2 Swinging Clawed Branch Arms
  const branchArms = [];
  const armGeo = getGeo('treant_arm', () => {
    const cg = new THREE.CylinderGeometry(0.08, 0.12, 0.78, 6);
    cg.translate(0, -0.34, 0);
    return cg;
  });
  for (const sx of [-1, 1]) {
    const armPiv = new THREE.Group();
    armPiv.position.set(sx * 0.50, 1.16, 0.06);
    const arm = regMesh(new THREE.Mesh(armGeo, barkMat));
    arm.rotation.z = sx * 0.42;
    armPiv.add(arm);
    swayGrp.add(armPiv);
    branchArms.push({ piv: armPiv, sx });
  }

  // Blazing Orange Jack-o'-Lantern Eyes & Jagged Grin on Trunk!
  const faceBack = new THREE.Mesh(getGeo('treant_face_back', () => new THREE.BoxGeometry(0.56, 0.46, 0.14)), darkHollowMat);
  faceBack.position.set(0, 0.88, 0.42);
  swayGrp.add(faceBack);

  const triEyeGeo = getGeo('treant_tri_eye', () => new THREE.ConeGeometry(0.105, 0.18, 4));
  for (const sx of [-0.16, 0.16]) {
    const eye = regMesh(new THREE.Mesh(triEyeGeo, fireFaceMat), true);
    eye.scale.set(1.25, 0.85, 0.5);
    eye.position.set(sx, 1.00, 0.49);
    eye.rotation.z = sx < 0 ? -0.35 : 0.35;
    swayGrp.add(eye);
  }
  const grinGeo = getGeo('treant_grin_seg', () => new THREE.OctahedronGeometry(0.078, 0));
  for (let m = -2; m <= 2; m++) {
    const seg = regMesh(new THREE.Mesh(grinGeo, fireFaceMat), true);
    seg.scale.set(1.1, 1.25, 0.45);
    seg.position.set(m * 0.088, 0.74 + Math.abs(m) * 0.025, 0.50);
    swayGrp.add(seg);
  }

  return {
    root: grp,
    triggerAttack() { attackTimer = 0.32; },
    update(dt, t, isDying) {
      if (isDying) return;
      if (attackTimer > 0) attackTimer = Math.max(0, attackTimer - dt);
      const atkSwing = attackTimer > 0 ? Math.sin((attackTimer / 0.32) * Math.PI) * 1.1 : 0;
      swayGrp.rotation.z = Math.sin(t * 4.8) * 0.055;
      swayGrp.position.y = Math.abs(Math.sin(t * 4.8)) * 0.04;
      for (const ba of branchArms) {
        ba.piv.rotation.x = Math.sin(t * 4.8 + (ba.sx < 0 ? 0 : Math.PI)) * 0.35 - atkSwing;
      }
    }
  };
}

const ENEMY_TYPE_ALIASES = {
  skeleton: 'ember_skeleton',
  hound: 'goblin',
  archer: 'vampire_lord',
  shieldbearer: 'cursed_footman',
  bomber: 'toxic_slime',
  necromancer: 'mummy',
  cultist: 'dark_cultist',
  brute: 'iron_knight',
  reaper: 'boss_cthulhu'
};

const ENEMY_MODEL_CFG = {
  // === 16 Regular & Specialist Dark-Fantasy Monsters ===
  ember_skeleton: {
    key: 'skel_minion',
    scale: 0.90,
    moveClip: 'Walking_D_Skeletons',
    atkClip: '1H_Melee_Attack_Slice_Horizontal',
    weapon: 'bone_sword',
    tint: 0xe7dfd3,
    tintLerp: 0.38,
    eye: 0xff6a00
  },
  goblin: {
    key: 'barbarian',
    scale: 0.80,
    moveClip: 'Running_B',
    atkClip: '1H_Melee_Attack_Chop',
    weapon: 'goblin_stone_axe',
    tint: 0x5c8a32,
    tintLerp: 0.72,
    eye: 0xff4500,
    moveSpeedAnim: 1.38
  },
  werewolf: {
    key: 'barbarian',
    scale: 0.95,
    moveClip: 'Running_B',
    atkClip: 'Dualwield_Melee_Attack_Slice',
    weapon: null,
    tint: 0x2b2930,
    tintLerp: 0.84,
    eye: 0xff6a00,
    moveSpeedAnim: 1.44
  },
  cursed_footman: {
    key: 'skel_warrior',
    scale: 1.00,
    moveClip: 'Walking_B',
    atkClip: '1H_Melee_Attack_Slice_Horizontal',
    weapon: 'broadsword',
    tint: 0x5c6842,
    tintLerp: 0.50,
    eye: 0xf59e0b
  },
  plague_zombie: {
    key: 'zombie_tripo',
    scale: 2.02,
    moveClip: 'Strut_Walking',
    atkClip: 'Strut_Walking',
    weapon: null,
    tint: null,
    eye: null
  },
  iron_knight: {
    key: 'knight',
    scale: 1.26,
    moveClip: 'Walking_B',
    atkClip: '2H_Melee_Attack_Chop',
    weapon: null, // Uses built-in 2H_Sword!
    tint: 0x523c2b,
    tintLerp: 0.66,
    eye: 0xff6a00
  },
  dark_cultist: {
    key: 'skel_mage',
    scale: 0.92,
    moveClip: 'Walking_A',
    atkClip: 'Spellcast_Shoot',
    weapon: 'cultist_skull_staff',
    tint: 0x4c1d95,
    tintLerp: 0.72,
    eye: 0xd946ef
  },
  mummy: {
    key: 'skel_mage',
    scale: 0.94,
    moveClip: 'Walking_A',
    atkClip: 'Spellcast_Raise',
    weapon: 'mummy_crescent_staff',
    tint: 0xd9c79e,
    tintLerp: 0.78,
    eye: 0x22d3ee
  },
  dark_spider: {
    key: 'spider_tripo',
    scale: 1.75,
    moveClip: 'Scuttle_Walk',
    idleClip: 'Idle',
    atkClip: 'Bite_Lunge',
    weapon: null,
    tint: null,
    eye: null,
    moveSpeedAnim: 1.45
  },
  succubus: {
    key: 'succubus_tripo',
    scale: 2.02,
    moveClip: 'Walking',
    idleClip: 'Idle',
    atkClip: 'Cast_Attack',
    weapon: null,
    tint: null,
    eye: null,
    moveSpeedAnim: 1.12
  },
  toxic_slime: {
    proceduralRig: 'toxic_slime',
    scale: 0.92
  },
  gargoyle: {
    key: 'barbarian',
    scale: 0.88,
    moveClip: 'Running_A',
    atkClip: 'Dualwield_Melee_Attack_Chop',
    weapon: null,
    tint: 0x575a64,
    tintLerp: 0.84,
    eye: 0xef4444,
    moveSpeedAnim: 1.24
  },
  hell_imp: {
    key: 'barbarian',
    scale: 0.76,
    moveClip: 'Running_B',
    atkClip: 'Dualwield_Melee_Attack_Slice',
    weapon: null,
    tint: 0xb91c1c,
    tintLerp: 0.78,
    eye: 0xff5500,
    moveSpeedAnim: 1.42
  },
  phantom_ghost: {
    proceduralRig: 'phantom_ghost',
    scale: 0.96
  },
  vampire_lord: {
    key: 'dracula_tripo',
    scale: 2.08,
    moveClip: 'Walking',
    idleClip: 'Idle',
    atkClip: 'Cloak_Slash',
    weapon: null,
    tint: null,
    eye: null
  },
  vampire_bat: {
    proceduralRig: 'vampire_bat',
    scale: 0.92
  },
  mimic_chest: {
    key: 'mimic_tripo',
    scale: 1.92,
    moveClip: 'Hop_Chomp',
    idleClip: 'Hop_Chomp',
    atkClip: 'Hop_Chomp',
    weapon: null,
    tint: null,
    eye: null
  },
  corrupted_treant: {
    key: 'tree_tripo',
    scale: 2.12,
    moveClip: 'Hop_Forward',
    atkClip: 'Hop_Forward',
    weapon: null,
    tint: null,
    eye: null
  },
  shadow_wisp: {
    proceduralRig: 'shadow_wisp',
    scale: 0.94
  },

  // === 5 Distinct Milestone Act Bosses (Matches Top Row of ad09b7c9.jpg!) ===
  boss_butcher: {
    key: 'barbarian',
    scale: 1.72,
    moveClip: 'Running_B',
    atkClip: '2H_Melee_Attack_Slice',
    weapon: 'demon_magma_greatsword',
    tint: 0x262022,
    tintLerp: 0.80,
    baseEmissive: 0x9a3412,
    baseEmissiveInt: 0.22,
    eye: 0xff5500,
    isBossVisual: true
  },
  boss_archlich: {
    key: 'lich_tripo',
    scale: 2.65,
    moveClip: 'Running_A',
    idleClip: 'Idle',
    atkClip: 'Spellcast_Shoot',
    weapon: null,
    tint: null,
    eye: null,
    isBossVisual: true,
    moveSpeedAnim: 1.05
  },
  boss_cthulhu: {
    key: 'barbarian',
    scale: 1.92,
    moveClip: 'Walking_B',
    atkClip: 'Spellcast_Shoot',
    weapon: null,
    tint: 0x1b4552,
    tintLerp: 0.82,
    eye: 0xff6a00,
    isBossVisual: true
  },
  boss_troll: {
    key: 'troll_tripo',
    scale: 2.85,
    moveClip: 'Walking',
    idleClip: 'Idle',
    atkClip: 'Heavy_Cleave',
    weapon: null,
    tint: null,
    eye: null,
    isBossVisual: true,
    moveSpeedAnim: 1.08
  },
  boss_warden: {
    key: 'troll_tripo',
    scale: 2.85,
    moveClip: 'Walking',
    idleClip: 'Idle',
    atkClip: 'Heavy_Cleave',
    weapon: null,
    tint: null,
    eye: null,
    isBossVisual: true,
    moveSpeedAnim: 1.08
  },
  boss_ashlord: {
    key: 'barbarian',
    scale: 2.28,
    moveClip: 'Walking_B',
    atkClip: 'Dualwield_Melee_Attack_Chop',
    weapon: null,
    tint: 0x1c191e,
    tintLerp: 0.86,
    baseEmissive: 0xd9480f,
    baseEmissiveInt: 0.28,
    eye: 0xff7a00,
    isBossVisual: true
  }
};

const enemyMeshPool = new Map();

export function createEnemyMesh(typeId = 'ember_skeleton', eliteVariant = null, customScaleMult = 1.0) {
  if (typeId && typeof typeId === 'object') {
    const opts = typeId;
    eliteVariant = opts.eliteVariant ?? opts.eliteType ?? opts.variant ?? null;
    customScaleMult = opts.customScaleMult ?? opts.scaleMult ?? 1.0;
    typeId = opts.typeId || opts.type || opts.enemyType || opts.id || 'ember_skeleton';
  }

  const canonicalType = ENEMY_TYPE_ALIASES[typeId] || typeId;
  const cfg = ENEMY_MODEL_CFG[canonicalType] || ENEMY_MODEL_CFG.ember_skeleton;
  const rawMult = Number(customScaleMult);
  const validMult = Number.isFinite(rawMult) && rawMult > 0 ? rawMult : 1.0;
  const effectiveScaleMult =
    eliteVariant === 'miniboss' && Math.abs(validMult - 1.0) < 0.001 ? 0.72 : validMult;

  const canPool = eliteVariant !== 'warden' && !cfg.isBossVisual;
  const poolKey = `${canonicalType}|${eliteVariant || 'std'}|${effectiveScaleMult.toFixed(2)}`;
  if (canPool) {
    const bucket = enemyMeshPool.get(poolKey);
    if (bucket && bucket.length > 0) {
      const reused = bucket.pop();
      reused._markActive();
      return reused;
    }
  }

  const root = new THREE.Group();
  let animCtrl = null;
  let procRig = null;
  const instanceMats = [];
  const flashMeshSlots = [];
  const hitFlashMat = getMat('enemy_shared_hit_flash', () =>
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.9,
      roughness: 0.3
    })
  );
  let flashTimer = 0;
  let spawnedInst = null;

  let wingGroup = null;
  let dragonTail = null;
  let cthulhuHead = null;
  let cthulhuBase = null;
  let emberCoreGrp = null;
  let archlichOrbit = null;
  const archlichCrystals = [];
  let stage1BreakNode = null;
  let stage2BreakNode = null;

  if (cfg.proceduralRig) {
    procRig = buildProceduralMonsterRig(cfg.proceduralRig, cfg.scale * effectiveScaleMult, flashMeshSlots);
    spawnedInst = procRig.root;
    root.add(procRig.root);
  } else {
    const asset = gltfCache.get(cfg.key);
    if (asset) {
      const inst = cloneSkinned(asset.scene);
      spawnedInst = inst;
      inst.scale.setScalar(cfg.scale * effectiveScaleMult);
      root.add(inst);

      let handR = null;
      let handL = null;
      let headBone = null;
      let chestBone = null;
      let foundEyeMesh = false;

      const isTripoEnemy = /_tripo$/i.test(cfg.key || '');
      const usesCustomHead =
        !isTripoEnemy && (
        canonicalType === 'goblin' ||
        canonicalType === 'werewolf' ||
        canonicalType === 'gargoyle' ||
        canonicalType === 'hell_imp' ||
        canonicalType === 'vampire_lord' ||
        canonicalType === 'boss_butcher' ||
        canonicalType === 'boss_cthulhu' ||
        canonicalType === 'boss_warden' ||
        canonicalType === 'boss_ashlord');

      inst.traverse((n) => {
        const nm = n.name || '';
        if (/^handslot\.?r$/i.test(nm) || (!handR && /^hand\.?r$/i.test(nm))) handR = n;
        if (/^handslot\.?l$/i.test(nm) || (!handL && /^hand\.?l$/i.test(nm))) handL = n;
        if (/^head$/i.test(nm)) headBone = n;
        if (/^chest$/i.test(nm)) chestBone = n;

        if (!cfg.isBossVisual) {
          if (nm === 'Skeleton_Warrior_Helmet' || nm === 'Knight_Helmet') {
            stage2BreakNode = n;
          }
          if (canonicalType === 'iron_knight' && nm === 'Knight_Cape') {
            stage1BreakNode = n;
          }
        }

        // Hide unwanted built-in KayKit props so each archetype silhouette matches ad09b7c9.jpg!
        if (nm === 'Mug' || nm === 'Spellbook' || nm === 'Spellbook_open' || nm === '1H_Wand') {
          n.visible = false;
        }
        if (usesCustomHead && /^(Barbarian_Head|Barbarian_Hat|Mage_Head|Mage_Hat)$/i.test(nm)) {
          n.visible = false;
        }
        if (canonicalType === 'ember_skeleton' && nm === 'Skeleton_Minion_Cloak') {
          n.visible = false;
        }
        if ((canonicalType === 'dark_cultist' || canonicalType === 'mummy' || canonicalType === 'boss_archlich') && nm === 'Skeleton_Mage_Hat') {
          n.visible = false;
        }
        if (canonicalType === 'vampire_lord' && nm === '2H_Staff') {
          n.visible = false;
        }
        if (cfg.key === 'barbarian') {
          if (nm === '2H_Axe' || nm === 'Barbarian_Round_Shield' || nm === '1H_Axe' || nm === '1H_Axe_Offhand' || nm === 'Barbarian_Hat') {
            n.visible = false;
          }
          if (
            (canonicalType === 'gargoyle' ||
              canonicalType === 'hell_imp' ||
              canonicalType === 'werewolf' ||
              canonicalType === 'boss_ashlord' ||
              canonicalType === 'boss_cthulhu' ||
              canonicalType === 'boss_warden') &&
            nm === 'Barbarian_Cape'
          ) {
            n.visible = false;
          }
        }
        if (canonicalType === 'iron_knight') {
          if (
            nm === '1H_Sword' ||
            nm === '1H_Sword_Offhand' ||
            nm === 'Round_Shield' ||
            nm === 'Badge_Shield' ||
            nm === 'Rectangle_Shield' ||
            nm === 'Spike_Shield'
          ) {
            n.visible = false;
          }
        }

        if (n.isMesh && n.material) {
          if (/Eyes/i.test(nm)) {
            foundEyeMesh = true;
            n.material = getMat(`eye_mat_${cfg.eye}_${cfg.isBossVisual ? 'b' : 'n'}`, () =>
              new THREE.MeshStandardMaterial({
                color: cfg.eye,
                emissive: cfg.eye,
                emissiveIntensity: cfg.isBossVisual ? 2.7 : 2.2,
                roughness: 0.15
              })
            );
            return;
          }
          const needsUniqueInstanceMat = canonicalType === 'boss_ashlord' || canonicalType === 'boss_butcher';
          const isVampireCape = canonicalType === 'vampire_lord' && nm === 'Mage_Cape';
          const mapOneMat = (srcMat) => {
            let baseEm = cfg.baseEmissive || 0x000000;
            let baseEmInt = cfg.baseEmissiveInt || 0;
            if (eliteVariant === 'purple' || eliteVariant === 'blue') {
              baseEm = eliteVariant === 'purple' ? 0x6b21a8 : 0x0369a1;
              baseEmInt = Math.max(baseEmInt, 0.28);
            }
            const buildTinted = () => {
              const m = srcMat.clone();
              if (m.color) {
                if (isVampireCape) {
                  m.color.setHex(0x991b1b);
                } else if (cfg.tint !== null && cfg.tint !== undefined) {
                  m.color.lerp(new THREE.Color(cfg.tint), cfg.tintLerp ?? 0.55);
                }
              }
              if (m.emissive && baseEmInt > 0) {
                m.emissive.setHex(baseEm);
                m.emissiveIntensity = baseEmInt;
              }
              return m;
            };
            if (needsUniqueInstanceMat) {
              const uniqueMat = buildTinted();
              instanceMats.push({ mat: uniqueMat, baseEmissive: baseEm, baseEmissiveInt: baseEmInt, owned: true });
              return uniqueMat;
            }
            return getMat(`enemy_tint_v3_${canonicalType}_${isVampireCape ? 'cape' : 'b'}_${eliteVariant || 'std'}_${srcMat.uuid}`, buildTinted);
          };
          const mapped = Array.isArray(n.material) ? n.material.map(mapOneMat) : mapOneMat(n.material);
          n.material = mapped;
          if (!needsUniqueInstanceMat && n.visible) {
            flashMeshSlots.push({ mesh: n, origMat: mapped });
          }
        }
      });

      if (!foundEyeMesh && !usesCustomHead && headBone && cfg.eye) {
        const visorForward = cfg.key === 'knight';
        headBone.add(createGlowingEyePair(cfg.eye, 0.155, visorForward ? 0.38 : 0.40, visorForward ? 0.52 : 0.45));
      }

      if (handR && cfg.weapon) {
        handR.add(makeEnemyWeaponProp(cfg.weapon));
      }

      // === Archetype & Act Boss Signature 3D Sculpted Attachments ===
      if (canonicalType === 'ember_skeleton') {
        if (chestBone) {
          emberCoreGrp = createMoltenRibcageAndSkullPads();
          chestBone.add(emberCoreGrp);
        }
      } else if (canonicalType === 'goblin' && headBone) {
        headBone.add(createChibiMonsterHead({
          skinHex: 0x659a38,
          eyeHex: 0xff4500,
          ears: 'pointed',
          goblinNose: true
        }));
      } else if (canonicalType === 'werewolf') {
        if (headBone) {
          headBone.add(createChibiMonsterHead({
            skinHex: 0x2f2d36,
            eyeHex: 0xff6a00,
            ears: 'wolf',
            wolfSnout: true
          }));
        }
        if (chestBone) {
          const tail = new THREE.Mesh(
            getGeo('wolf_tail', () => new THREE.ConeGeometry(0.14, 0.54, 7)),
            getMat('wolf_tail_mat', () => new THREE.MeshStandardMaterial({ color: 0x26252c, roughness: 0.8 }))
          );
          tail.position.set(0, -0.05, -0.34);
          tail.rotation.x = -0.95;
          chestBone.add(tail);
        }
      } else if (canonicalType === 'cursed_footman' && handL) {
        const shield = createIronTowerShield();
        handL.add(shield);
        stage1BreakNode = shield;
      } else if (canonicalType === 'iron_knight' && chestBone) {
        chestBone.add(createSpikedPauldronsAndMoltenCore(false));
      } else if (canonicalType === 'dark_cultist') {
        const { headGrp, chestGrp } = createCultistHoodAndSkullClasp();
        if (headBone) headBone.add(headGrp);
        if (chestBone) chestBone.add(chestGrp);
        if (handL) handL.add(createHandSpellOrb(0xf5d0fe, 0xa855f7));
      } else if (canonicalType === 'mummy') {
        const { headGrp, chestGrp } = createMummyHeadAndCollar();
        if (headBone) headBone.add(headGrp);
        if (chestBone) chestBone.add(chestGrp);
      } else if (canonicalType === 'gargoyle') {
        if (headBone) {
          headBone.add(createChibiMonsterHead({
            skinHex: 0x575a64,
            eyeHex: 0xff1e1e,
            ears: 'pointed',
            horns: 'gargoyle'
          }));
        }
        if (chestBone) {
          wingGroup = createBatWings(0x4b4e57, 0x3b3e47, 0.96, false);
          chestBone.add(wingGroup);
        }
      } else if (canonicalType === 'hell_imp') {
        if (headBone) {
          headBone.add(createChibiMonsterHead({
            skinHex: 0xc82222,
            eyeHex: 0xff6a00,
            ears: 'pointed',
            horns: 'imp'
          }));
        }
        if (chestBone) {
          wingGroup = createBatWings(0x7f1d1d, 0x991b1b, 0.88, false);
          chestBone.add(wingGroup);
        }
      } else if (canonicalType === 'vampire_lord') {
        const { headGrp, chestGrp } = createVampireHeadAndCape();
        if (headBone) headBone.add(headGrp);
        if (chestBone) chestBone.add(chestGrp);
        if (handR) handR.add(createHandSpellOrb(0xfecdd3, 0xe11d48));
      } else if (canonicalType === 'boss_butcher') {
        // Act I Boss: Демон Преисподней
        if (headBone) {
          headBone.add(createChibiMonsterHead({
            skinHex: 0x332b2e,
            eyeHex: 0xff5500,
            ears: 'pointed',
            horns: 'demon_magma',
            tusks: true
          }));
        }
        if (chestBone) {
          chestBone.add(createSpikedPauldronsAndMoltenCore(true));
        }
      } else if (canonicalType === 'boss_archlich') {
        // Act II / Stage 10 Boss: Король-Лич Тёмного Пламени
        if (!isTripoEnemy) {
          if (headBone) headBone.add(createArchlichDarkCrown());
          if (chestBone) chestBone.add(createArchlichCollar());
          if (handL) handL.add(createHandSpellOrb(0xf5d0fe, 0xa855f7));
        }

        archlichOrbit = new THREE.Group();
        archlichOrbit.position.y = (isTripoEnemy ? 1.55 : 1.28) * effectiveScaleMult;
        const crystalGeo = getGeo('lich_orbit_crystal', () => new THREE.OctahedronGeometry(0.18, 0));
        const crystalMat = getMat('lich_orbit_violet_mat', () =>
          new THREE.MeshStandardMaterial({
            color: 0xf5d0fe,
            emissive: 0xa855f7,
            emissiveIntensity: 2.4,
            roughness: 0.15
          })
        );
        const orbitR = 1.15 * effectiveScaleMult;
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          const shard = new THREE.Mesh(crystalGeo, crystalMat);
          shard.scale.set(0.82 * effectiveScaleMult, 1.42 * effectiveScaleMult, 0.82 * effectiveScaleMult);
          shard.position.set(Math.cos(a) * orbitR, 0, Math.sin(a) * orbitR);
          archlichOrbit.add(shard);
          archlichCrystals.push(shard);
        }
        root.add(archlichOrbit);
      } else if (canonicalType === 'boss_cthulhu') {
        // Act III Boss: Вестник Бездны
        if (headBone) {
          cthulhuHead = createCthulhuHeadAndTentacles();
          headBone.add(cthulhuHead);
        }
        const { chestProps, baseProps } = createCthulhuArmorAndBaseTentacles();
        if (chestBone) chestBone.add(chestProps);
        baseProps.scale.setScalar(cfg.scale * effectiveScaleMult);
        cthulhuBase = baseProps;
        root.add(baseProps);
        if (handL) handL.add(createHandSpellOrb(0x090d16, 0x06b6d4));
      } else if (canonicalType === 'boss_warden' || canonicalType === 'boss_troll') {
        // Act IV / Stage 10 Co-Boss: Тролль-Костолом с боевым молотом
        if (!isTripoEnemy) {
          if (headBone) {
            headBone.add(createChibiMonsterHead({
              skinHex: 0xa87654,
              eyeHex: 0xff6a00,
              ears: 'ogre',
              tusks: true
            }));
          }
          if (chestBone) {
            chestBone.add(createSpikedPauldronsAndMoltenCore(false));
          }
        }
      } else if (canonicalType === 'boss_ashlord') {
        // Act V Boss: Пепельный Дракон
        if (headBone) {
          headBone.add(createAshenDragonHead());
        }
        if (chestBone) {
          wingGroup = createBatWings(0x18151a, 0x7c2d12, 1.42, true);
          dragonTail = createDragonTailWithFlame();
          chestBone.add(wingGroup, dragonTail, createSpikedPauldronsAndMoltenCore(true));
        }
      }

      animCtrl = createAnimController(inst, asset.clips, 'Idle', cfg.moveClip);
      if (canonicalType === 'corrupted_treant' || canonicalType === 'mimic_chest') {
        animCtrl.syncPhase(cfg.moveClip, 0);
      } else {
        animCtrl.mixer.update(Math.random() * 1.2);
      }
    }
  }

  // Clean Artistic Elite Indicator (ZERO flat red circles on Bosses; delicate feathered sigil + floating 3D crystal crest on Elites!)
  let halo = null;
  let innerBossHalo = null;
  let eliteCrest = null;
  const eliteCrestBaseY = (cfg.scale || 0.9) * effectiveScaleMult * 2.18;

  if (!cfg.isBossVisual && (eliteVariant === 'purple' || eliteVariant === 'blue' || eliteVariant === 'warden')) {
    const crestColor =
      eliteVariant === 'purple' ? 0xc084fc : eliteVariant === 'warden' ? 0xfbbf24 : 0x38bdf8;
    const glowColor =
      eliteVariant === 'purple' ? 0x9333ea : eliteVariant === 'warden' ? 0xd97706 : 0x0284c7;

    const sigilTex = getMat('elite_feathered_sigil_tex', () => {
      const sz = 192;
      const cv = document.createElement('canvas');
      cv.width = sz;
      cv.height = sz;
      const c2 = cv.getContext('2d');
      const mid = sz * 0.5;
      const rg = c2.createRadialGradient(mid, mid, sz * 0.08, mid, mid, mid * 0.94);
      rg.addColorStop(0.0, 'rgba(255,255,255,0.10)');
      rg.addColorStop(0.62, 'rgba(255,255,255,0.28)');
      rg.addColorStop(0.80, 'rgba(255,255,255,0.55)');
      rg.addColorStop(0.92, 'rgba(255,255,255,0.12)');
      rg.addColorStop(1.0, 'rgba(255,255,255,0.0)');
      c2.fillStyle = rg;
      c2.fillRect(0, 0, sz, sz);

      c2.strokeStyle = 'rgba(255,255,255,0.72)';
      c2.lineWidth = 2.2;
      c2.beginPath();
      c2.arc(mid, mid, mid * 0.74, 0, Math.PI * 2);
      c2.stroke();

      c2.setLineDash([7, 9]);
      c2.lineWidth = 1.5;
      c2.beginPath();
      c2.arc(mid, mid, mid * 0.58, 0, Math.PI * 2);
      c2.stroke();
      c2.setLineDash([]);

      for (let k = 0; k < 4; k++) {
        const ka = (k / 4) * Math.PI * 2;
        const px = mid + Math.cos(ka) * mid * 0.74;
        const py = mid + Math.sin(ka) * mid * 0.74;
        c2.fillStyle = 'rgba(255,255,255,0.92)';
        c2.beginPath();
        c2.arc(px, py, 3.6, 0, Math.PI * 2);
        c2.fill();
      }
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    });

    halo = new THREE.Mesh(
      getGeo('elite_sigil_plane', () => {
        const pg = new THREE.PlaneGeometry(1.62, 1.62);
        pg.rotateX(-Math.PI / 2);
        return pg;
      }),
      getMat(`elite_sigil_mat_${crestColor}`, () =>
        new THREE.MeshBasicMaterial({
          map: sigilTex,
          color: crestColor,
          transparent: true,
          opacity: 0.44,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false
        })
      )
    );
    halo.position.y = 0.032;
    halo.scale.setScalar(effectiveScaleMult);
    root.add(halo);

    eliteCrest = new THREE.Group();
    const gemMesh = new THREE.Mesh(
      getGeo('elite_crest_gem', () => new THREE.OctahedronGeometry(0.135, 0)),
      getMat(`elite_crest_mat_${crestColor}`, () =>
        new THREE.MeshStandardMaterial({
          color: crestColor,
          emissive: glowColor,
          emissiveIntensity: 2.1,
          roughness: 0.15,
          metalness: 0.35
        })
      )
    );
    gemMesh.scale.set(0.82, 1.48, 0.82);
    const orbitBand = new THREE.Mesh(
      getGeo('elite_crest_ring', () => {
        const tg = new THREE.TorusGeometry(0.19, 0.018, 6, 16);
        tg.rotateX(Math.PI * 0.5);
        return tg;
      }),
      getMat(`elite_crest_band_${crestColor}`, () =>
        new THREE.MeshBasicMaterial({
          color: crestColor,
          transparent: true,
          opacity: 0.78,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false
        })
      )
    );
    eliteCrest.add(gemMesh, orbitBand);
    eliteCrest.position.set(0, eliteCrestBaseY, 0);
    root.add(eliteCrest);
  }

  let inPool = false;
  let isDying = false;
  let proceduralFall = false;
  let hitJoltTimer = 0;
  let baseClipOverride = null;

  const handle = {
    root,
    setClipOverride(clipName = null) {
      baseClipOverride = typeof clipName === 'string' && clipName ? clipName : null;
    },
    _markActive() {
      baseClipOverride = null;
      inPool = false;
      isDying = false;
      proceduralFall = false;
      hitJoltTimer = 0;
      flashTimer = 0;
      root.visible = true;
      root.position.y = 0;
      root.scale.set(1, 1, 1);
      root.rotation.set(0, 0, 0);
      if (spawnedInst) {
        spawnedInst.rotation.set(0, 0, 0);
        spawnedInst.position.set(0, 0, 0);
      }
      if (stage1BreakNode) stage1BreakNode.visible = true;
      if (stage2BreakNode) stage2BreakNode.visible = true;
      if (halo) halo.visible = true;
      if (innerBossHalo) innerBossHalo.visible = true;
      if (eliteCrest) eliteCrest.visible = true;
      animCtrl?.resetAlive?.();
      for (let i = 0; i < flashMeshSlots.length; i++) {
        flashMeshSlots[i].mesh.material = flashMeshSlots[i].origMat;
      }
    },
    setDamageStage(stage) {
      if (stage >= 1 && stage1BreakNode && stage1BreakNode.visible) {
        stage1BreakNode.visible = false;
        return 'shield';
      }
      if (stage >= 2 && stage2BreakNode && stage2BreakNode.visible) {
        stage2BreakNode.visible = false;
        return 'helmet';
      }
      return null;
    },
    playHitFlinch() {
      if (isDying) return;
      hitJoltTimer = 0.12;
      animCtrl?.triggerHit?.(1.9);
    },
    playDeathCollapse() {
      if (isDying) return;
      isDying = true;
      hitJoltTimer = 0;
      if (halo) halo.visible = false;
      if (innerBossHalo) innerBossHalo.visible = false;
      if (eliteCrest) eliteCrest.visible = false;
      const hasClip = animCtrl?.triggerDeath?.(1.52);
      proceduralFall = !hasClip;
    },
    updateDying(dt, sinkRatio = 0) {
      const safeDt = Math.min(Math.max(dt || 0.016, 0), 0.1);
      if (animCtrl) {
        animCtrl.mixer.update(safeDt);
      }
      if (proceduralFall && spawnedInst) {
        spawnedInst.rotation.x = Math.max(-Math.PI * 0.48, spawnedInst.rotation.x - safeDt * 4.2);
      }
      if (sinkRatio > 0) {
        root.position.y = -sinkRatio * 0.45;
      }
      if (flashTimer > 0) {
        flashTimer = Math.max(0, flashTimer - safeDt);
        if (flashTimer <= 0) {
          for (let i = 0; i < flashMeshSlots.length; i++) {
            flashMeshSlots[i].mesh.material = flashMeshSlots[i].origMat;
          }
        }
      }
    },
    playAttackAnim(overrideClip = null) {
      if (isDying) return;
      procRig?.triggerAttack?.();
      const targetClip = typeof overrideClip === 'string' && overrideClip ? overrideClip : cfg.atkClip;
      if (animCtrl && targetClip) {
        animCtrl.triggerOneShot(targetClip, cfg.isBossVisual ? 1.42 : 1.55);
      }
    },
    flashHit() {
      flashTimer = 0.10;
      for (let i = 0; i < flashMeshSlots.length; i++) {
        flashMeshSlots[i].mesh.material = hitFlashMat;
      }
      for (const item of instanceMats) {
        if (item.mat.emissive) {
          item.mat.emissive.setHex(0xffffff);
          item.mat.emissiveIntensity = 0.85;
        }
      }
    },
    dispose() {
      if (inPool) return;
      flashTimer = 0;
      for (let i = 0; i < flashMeshSlots.length; i++) {
        flashMeshSlots[i].mesh.material = flashMeshSlots[i].origMat;
      }
      if (canPool) {
        let bucket = enemyMeshPool.get(poolKey);
        if (!bucket) {
          bucket = [];
          enemyMeshPool.set(poolKey, bucket);
        }
        if (bucket.length < 18) {
          inPool = true;
          root.visible = false;
          bucket.push(handle);
          return;
        }
      }
      if (animCtrl?.mixer && spawnedInst) {
        animCtrl.mixer.stopAllAction();
        animCtrl.mixer.uncacheRoot(spawnedInst);
      }
      if (spawnedInst && !procRig) {
        spawnedInst.traverse((n) => {
          if (n.isSkinnedMesh && n.skeleton) {
            n.skeleton.dispose();
          }
        });
      }
      for (const item of instanceMats) {
        if (item.owned && item.mat?.dispose) item.mat.dispose();
      }
      instanceMats.length = 0;
      flashMeshSlots.length = 0;
    },
    syncCyclePhase(phase01) {
      if (animCtrl && !isDying && typeof animCtrl.syncPhase === 'function') {
        animCtrl.syncPhase(cfg.moveClip, phase01);
      }
    },
    update(dt, arg2, arg3) {
      const safeDt = Math.min(Math.max(dt || 0.016, 0), 0.1);
      const isMoving = typeof arg2 === 'boolean' ? arg2 : true;
      const elapsedTime = typeof arg2 === 'boolean' ? (arg3 || 0) : (arg2 || 0);
      if (animCtrl && !isDying && canonicalType !== 'corrupted_treant' && canonicalType !== 'mimic_chest') {
        const baseClip = baseClipOverride || (isMoving ? cfg.moveClip : (cfg.idleClip || cfg.moveClip));
        animCtrl.setBaseState(baseClip, baseClipOverride ? 1.35 : isMoving ? (cfg.moveSpeedAnim || 1.1) : 1.0);
        animCtrl.mixer.update(safeDt);
      }
      if (procRig) {
        procRig.update(safeDt, elapsedTime, isDying);
      }

      if (hitJoltTimer > 0 && spawnedInst && !isDying) {
        hitJoltTimer = Math.max(0, hitJoltTimer - safeDt);
        spawnedInst.rotation.x = -Math.sin((hitJoltTimer / 0.12) * Math.PI) * 0.24;
      } else if (spawnedInst && !isDying && spawnedInst.rotation.x !== 0) {
        spawnedInst.rotation.x = 0;
      }

      if (wingGroup?.userData?.wingPivots && !isDying) {
        const flapSpeed = canonicalType === 'boss_ashlord' ? 5.6 : 9.2;
        const flapAmp = canonicalType === 'boss_ashlord' ? 0.36 : 0.42;
        const flap = Math.sin(elapsedTime * flapSpeed) * flapAmp;
        for (const wp of wingGroup.userData.wingPivots) {
          wp.pivot.rotation.y = -wp.side * (0.38 + flap);
        }
      }
      if (dragonTail && !isDying) {
        dragonTail.rotation.y = Math.sin(elapsedTime * 4.4) * 0.24;
      }
      if (emberCoreGrp?.userData?.heart && !isDying) {
        const p = 1 + Math.sin(elapsedTime * 7.5) * 0.10;
        emberCoreGrp.userData.heart.scale.set(0.95 * p, 1.25 * p, 0.78 * p);
      }
      if (cthulhuHead?.userData?.tentacles && !isDying) {
        for (const tt of cthulhuHead.userData.tentacles) {
          tt.pivot.rotation.x = Math.sin(elapsedTime * 4.8 + tt.phase) * 0.16;
          tt.pivot.rotation.z = Math.cos(elapsedTime * 3.9 + tt.phase) * 0.12;
        }
      }
      if (cthulhuBase?.userData?.baseTentacles && !isDying) {
        for (const bt of cthulhuBase.userData.baseTentacles) {
          bt.pivot.rotation.y = bt.baseY + Math.sin(elapsedTime * 3.6 + bt.phase) * 0.18;
        }
      }
      if (canonicalType === 'boss_archlich' && archlichOrbit) {
        archlichOrbit.rotation.y = elapsedTime * 1.95;
        for (let i = 0; i < archlichCrystals.length; i++) {
          const c = archlichCrystals[i];
          c.position.y = Math.sin(elapsedTime * 4.2 + i * 1.57) * 0.14 * effectiveScaleMult;
          c.rotation.y = elapsedTime * 3.2 + i;
        }
      } else if ((canonicalType === 'boss_ashlord' || canonicalType === 'boss_butcher') && flashTimer <= 0) {
        const magmaPulse = 0.28 + Math.sin(elapsedTime * 5.5) * 0.14;
        for (const item of instanceMats) {
          if (item.mat.emissive) {
            item.mat.emissiveIntensity = magmaPulse;
          }
        }
      }

      if (halo) {
        halo.rotation.y = elapsedTime * 0.95;
      }
      if (eliteCrest && !isDying) {
        eliteCrest.rotation.y = elapsedTime * 2.4;
        eliteCrest.position.y = eliteCrestBaseY + Math.sin(elapsedTime * 3.8) * 0.07;
      }

      if (flashTimer > 0) {
        flashTimer = Math.max(0, flashTimer - safeDt);
        if (flashTimer <= 0) {
          for (let i = 0; i < flashMeshSlots.length; i++) {
            flashMeshSlots[i].mesh.material = flashMeshSlots[i].origMat;
          }
          for (const item of instanceMats) {
            if (item.mat.emissive) {
              item.mat.emissive.setHex(item.baseEmissive);
              item.mat.emissiveIntensity = item.baseEmissiveInt;
            }
          }
        }
      }
    }
  };
  return handle;
}

// ============================================================================
// 4. PICKUPS, SUPPLY CRATES & RELIC WEAPON CHESTS
// ============================================================================
export function createPickupMesh(pickupType = 'xp') {
  const root = new THREE.Group();
  const visualPivot = new THREE.Group();
  root.add(visualPivot);

  let floatingPart = null;
  let beaconPart = null;
  const damageMats = [];
  let shrinkRatio = 1.0;
  let damageGlow = 0.0;

  if (pickupType === 'xp') {
    floatingPart = new THREE.Mesh(
      getGeo('pk_xp', () => new THREE.OctahedronGeometry(0.28, 0)),
      new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x06b6d4, emissiveIntensity: 0.9, roughness: 0.2 })
    );
    floatingPart.position.y = 0.45;
    visualPivot.add(floatingPart);
  } else if (pickupType === 'gold') {
    floatingPart = new THREE.Mesh(
      getGeo('pk_gold', () => new THREE.CylinderGeometry(0.24, 0.24, 0.1, 14)),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xca8a04, emissiveIntensity: 0.5, metalness: 0.8, roughness: 0.25 })
    );
    floatingPart.rotation.x = Math.PI * 0.32;
    floatingPart.position.y = 0.36;
    visualPivot.add(floatingPart);
  } else if (pickupType === 'heart') {
    floatingPart = new THREE.Mesh(
      getGeo('pk_heart', () => new THREE.DodecahedronGeometry(0.3, 0)),
      new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0xe11d48, emissiveIntensity: 0.85, roughness: 0.25 })
    );
    floatingPart.position.y = 0.46;
    visualPivot.add(floatingPart);
  } else if (pickupType === 'clover') {
    const grp = new THREE.Group();
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, emissive: 0x16a34a, emissiveIntensity: 0.9, roughness: 0.25 });
    for (let i = 0; i < 4; i++) {
      const leaf = new THREE.Mesh(getGeo('pk_leaf', () => new THREE.SphereGeometry(0.15, 8, 8)), leafMat);
      const a = (i / 4) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 0.14, 0, Math.sin(a) * 0.14);
      grp.add(leaf);
    }
    grp.position.y = 0.5;
    floatingPart = grp;
    visualPivot.add(grp);
  } else if (pickupType === 'supply_crate' || pickupType === 'companion_crate' || pickupType === 'mimic_disguise') {
    const isComp = pickupType === 'companion_crate';
    const chestAsset = gltfCache.get('chest_disguise_tripo') || gltfCache.get(isComp ? 'chest_gold' : 'chest');
    const isTripoChest = !!gltfCache.get('chest_disguise_tripo');
    if (chestAsset?.scene) {
      const cloned = chestAsset.scene.clone(true);
      cloned.scale.setScalar(isTripoChest ? 1.85 : 0.85);
      cloned.traverse((n) => {
        if (n.isMesh && n.material) {
          const cloneOne = (m) => {
            const c = m.clone();
            if (isComp && c.color) c.color.lerp(new THREE.Color(0xa855f7), 0.35);
            damageMats.push(c);
            return c;
          };
          n.material = Array.isArray(n.material) ? n.material.map(cloneOne) : cloneOne(n.material);
          n.castShadow = true;
          n.receiveShadow = true;
        }
      });
      visualPivot.add(cloned);
    } else {
      const crateMat = new THREE.MeshStandardMaterial({
        color: isComp ? 0x6d28d9 : 0x92400e,
        roughness: 0.65,
        metalness: 0.2
      });
      const trimMat = new THREE.MeshStandardMaterial({
        color: isComp ? 0xfacc15 : 0x52525b,
        metalness: 0.75,
        roughness: 0.35
      });
      damageMats.push(crateMat, trimMat);
      const box = new THREE.Mesh(getGeo('crate_box', () => new THREE.BoxGeometry(0.86, 0.82, 0.86)), crateMat);
      box.position.y = 0.41;
      box.castShadow = true;
      const band = new THREE.Mesh(getGeo('crate_band', () => new THREE.BoxGeometry(0.92, 0.18, 0.92)), trimMat);
      band.position.y = 0.44;
      visualPivot.add(box, band);
    }
  } else if (pickupType === 'relic_weapon_crate') {
    const goldChestAsset = gltfCache.get('chest_disguise_tripo') || gltfCache.get('chest_gold');
    const isTripoGold = !!gltfCache.get('chest_disguise_tripo');
    if (goldChestAsset?.scene) {
      const cloned = goldChestAsset.scene.clone(true);
      cloned.scale.setScalar(isTripoGold ? 2.15 : 1.05);
      cloned.traverse((n) => {
        if (n.isMesh) {
          if (isTripoGold && n.material) {
            const warmGold = (m) => {
              const c = m.clone();
              if (c.color) c.color.lerp(new THREE.Color(0xfbbf24), 0.24);
              return c;
            };
            n.material = Array.isArray(n.material) ? n.material.map(warmGold) : warmGold(n.material);
          }
          n.castShadow = true;
          n.receiveShadow = true;
        }
      });
      visualPivot.add(cloned);
    } else {
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x272038, metalness: 0.5, roughness: 0.4 });
      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xd97706,
        emissiveIntensity: 0.55,
        metalness: 0.85,
        roughness: 0.2
      });
      const chest = new THREE.Mesh(getGeo('relic_chest', () => new THREE.BoxGeometry(1.25, 0.82, 0.92)), baseMat);
      chest.position.y = 0.41;
      chest.castShadow = true;
      visualPivot.add(chest);
    }

    beaconPart = new THREE.Mesh(
      getGeo('relic_beam', () => new THREE.CylinderGeometry(0.32, 0.58, 7.5, 16, 1, true)),
      new THREE.MeshBasicMaterial({
        color: 0xfde047,
        transparent: true,
        opacity: 0.24,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    beaconPart.position.y = 3.8;
    root.add(beaconPart);

    floatingPart = new THREE.Mesh(
      getGeo('relic_star', () => new THREE.OctahedronGeometry(0.34, 0)),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xf59e0b, emissiveIntensity: 1.4 })
    );
    floatingPart.position.y = 1.85;
    root.add(floatingPart);
  }

  return {
    root,
    setShrinkRatio(r) {
      shrinkRatio = Math.max(0.45, Math.min(1.0, Number(r) || 1.0));
      visualPivot.scale.setScalar(shrinkRatio);
    },
    setDamageGlow(r) {
      damageGlow = Math.max(0, Math.min(1, Number(r) || 0));
      for (const m of damageMats) {
        m.emissive.setHex(damageGlow > 0.02 ? 0xef4444 : 0x000000);
        m.emissiveIntensity = damageGlow * 1.3;
      }
    },
    update(dt, elapsedTime = 0) {
      if (floatingPart) floatingPart.rotation.y = elapsedTime * 2.4;
      if (beaconPart) {
        const s = 0.88 + Math.sin(elapsedTime * 4.2) * 0.14;
        beaconPart.scale.set(s, 1, s);
      }
      if (damageGlow > 0.05) {
        visualPivot.position.x = Math.sin(elapsedTime * 55) * damageGlow * 0.06;
      } else {
        visualPivot.position.x = 0;
      }
    }
  };
}
