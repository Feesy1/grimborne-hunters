// True-3D Dark-Fantasy Courtyard Arena (KayKit Dungeon & Halloween GLB/GLTF Architecture)
// + High-Craft Tracer Streaks, Muzzle Starbursts, Arcane Comet Projectiles & Pooled Voxel VFX

import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { ARENA_HALF_SIZE } from './config.js?v=20261116f';

// ============================================================================
// Procedural Textures: Gothic Slate Cobblestone Floor & Soft Radial Glow Sprite
// ============================================================================
function createCourtyardStoneTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Deep twilight mortar base
  ctx.fillStyle = '#181626';
  ctx.fillRect(0, 0, size, size);

  let seed = 4242;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Organic coursed ashlar / cobblestone pavers
  const rows = 8;
  const rowH = size / rows;
  for (let r = 0; r < rows; r++) {
    const cols = r % 2 === 0 ? 6 : 7;
    const colW = size / cols;
    const offset = (r % 2) * (colW * 0.45);
    for (let c = -1; c <= cols; c++) {
      const x = c * colW + offset + 3;
      const y = r * rowH + 3;
      const w = colW - 6;
      const h = rowH - 6;

      const lum = 36 + Math.floor(rand() * 14);
      const red = lum + 2;
      const grn = lum;
      const blu = lum + 14;

      ctx.fillStyle = `rgb(${red}, ${grn}, ${blu})`;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 7);
      ctx.fill();

      // Top-left moonlit bevel highlight
      ctx.strokeStyle = 'rgba(185, 196, 235, 0.16)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 5, y + h - 4);
      ctx.lineTo(x + 2, y + 2);
      ctx.lineTo(x + w - 4, y + 2);
      ctx.stroke();

      // Subtle mossy/ash variation patch
      if (rand() < 0.35) {
        ctx.fillStyle = 'rgba(91, 68, 128, 0.14)';
        ctx.beginPath();
        ctx.arc(x + w * rand(), y + h * rand(), 10 + rand() * 14, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(11, 11);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function createSoftGlowTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
  g.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  g.addColorStop(0.28, 'rgba(255, 255, 255, 0.72)');
  g.addColorStop(0.65, 'rgba(255, 255, 255, 0.18)');
  g.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createArcaneCircleTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;

  ctx.strokeStyle = 'rgba(192, 132, 252, 0.85)';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 112, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 94, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 48, 0, Math.PI * 2);
  ctx.stroke();

  // 8-point mystic star spokes
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 48, cy + Math.sin(a) * 48);
    ctx.lineTo(cx + Math.cos(a) * 94, cy + Math.sin(a) * 94);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ============================================================================
// Tapered 3D Crescent Slash Geometry Cache
// ============================================================================
const slashGeoCache = new Map();
function getSlashCrescentGeo(arcAngle = Math.PI * 0.8) {
  const clampedArc = Math.max(0.4, Math.min(Math.PI * 1.95, arcAngle || Math.PI * 0.8));
  const key = clampedArc.toFixed(2);
  if (slashGeoCache.has(key)) return slashGeoCache.get(key);

  const segs = 32;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const a = (u - 0.5) * clampedArc;
    const taper = Math.sin(u * Math.PI);
    const rOut = 1.0;
    const rIn = 1.0 - 0.42 * Math.pow(taper, 0.72);
    const lift = 0.06 * taper;

    positions.push(Math.sin(a) * rIn, -lift * 0.5, Math.cos(a) * rIn);
    uvs.push(u, 0);
    positions.push(Math.sin(a) * rOut, lift, Math.cos(a) * rOut);
    uvs.push(u, 1);

    if (i < segs) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2);
      indices.push(base + 1, base + 3, base + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  slashGeoCache.set(key, geo);
  return geo;
}

// ============================================================================
// Main 3D Arena World Factory
// ============================================================================
export function createArenaWorld(canvas) {
  const maxDpr = 2;

  const renderer = new THREE.WebGLRenderer({
    canvas: canvas || undefined,
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.48;

  const scene = new THREE.Scene();

  const PALETTE_NORMAL = {
    bg: new THREE.Color(0x181a2c),
    fog: new THREE.Color(0x181a2c),
    hemiSky: new THREE.Color(0x9cb2ff),
    hemiGround: new THREE.Color(0x3d324f),
    dir: new THREE.Color(0xdbe6ff),
    plazaRune: new THREE.Color(0xa855f7)
  };
  const PALETTE_BOSS = {
    bg: new THREE.Color(0x281320),
    fog: new THREE.Color(0x281320),
    hemiSky: new THREE.Color(0xff758f),
    hemiGround: new THREE.Color(0x472135),
    dir: new THREE.Color(0xffd6e0),
    plazaRune: new THREE.Color(0xf43f5e)
  };

  scene.background = PALETTE_NORMAL.bg.clone();
  scene.fog = new THREE.Fog(PALETTE_NORMAL.fog.clone(), 48, 112);

  const COMBAT_CAM_OFFSET = new THREE.Vector3(0, 20.5, 15.5);
  const HUB_CAM_POS = new THREE.Vector3(0, 2.45, 4.9);
  const HUB_LOOK_TARGET = new THREE.Vector3(0, 1.15, 0);

  const camera = new THREE.PerspectiveCamera(
    44,
    Math.max(window.innerWidth, 1) / Math.max(window.innerHeight, 1),
    0.4,
    180
  );
  camera.position.copy(COMBAT_CAM_OFFSET);
  camera.lookAt(0, 0.5, 0);

  // ==========================================================================
  // Crisp Moonlit Dark-Fantasy Lighting Rig
  // ==========================================================================
  const hemiLight = new THREE.HemisphereLight(
    PALETTE_NORMAL.hemiSky.getHex(),
    PALETTE_NORMAL.hemiGround.getHex(),
    1.52
  );
  scene.add(hemiLight);

  const ambientLight = new THREE.AmbientLight(0x63709e, 0.68);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(PALETTE_NORMAL.dir.getHex(), 2.45);
  dirLight.position.set(14, 28, 16);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.near = 4;
  dirLight.shadow.camera.far = 75;
  const shadowExtent = 28;
  dirLight.shadow.camera.left = -shadowExtent;
  dirLight.shadow.camera.right = shadowExtent;
  dirLight.shadow.camera.top = shadowExtent;
  dirLight.shadow.camera.bottom = -shadowExtent;
  dirLight.shadow.bias = -0.0004;
  scene.add(dirLight);
  scene.add(dirLight.target);

  const heroAuraLight = new THREE.PointLight(0xffe2b0, 1.85, 16.5, 1.35);
  heroAuraLight.position.set(0, 3.2, 0);
  scene.add(heroAuraLight);

  // Hub Showcase Spotlight & Rim
  const hubKeySpotLight = new THREE.SpotLight(0xfff0d4, 3.5, 16, Math.PI * 0.3, 0.65, 1.1);
  hubKeySpotLight.position.set(2.1, 3.9, 4.5);
  hubKeySpotLight.target.position.set(0, 1.15, 0);
  hubKeySpotLight.visible = false;
  scene.add(hubKeySpotLight);
  scene.add(hubKeySpotLight.target);

  const hubRimLight = new THREE.PointLight(0xa5b4fc, 2.4, 11, 1.2);
  hubRimLight.position.set(-2.4, 2.9, -2.3);
  hubRimLight.visible = false;
  scene.add(hubRimLight);

  // ==========================================================================
  // True-3D Courtyard Ground & Etched Arcane Rune Circles (Zero 2D stretch!)
  // ==========================================================================
  const arenaGroup = new THREE.Group();
  scene.add(arenaGroup);

  const B = ARENA_HALF_SIZE; // 27
  const arenaSpan = B * 2;
  const cobbleTex = createCourtyardStoneTexture();
  const softGlowTex = createSoftGlowTexture();
  const arcaneCircleTex = createArcaneCircleTexture();

  const outerGround = new THREE.Mesh(
    new THREE.PlaneGeometry(210, 210),
    new THREE.MeshStandardMaterial({ color: 0x161728, roughness: 0.95, metalness: 0.05 })
  );
  outerGround.rotation.x = -Math.PI / 2;
  outerGround.position.y = -0.06;
  outerGround.receiveShadow = true;
  arenaGroup.add(outerGround);

  const groundMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(arenaSpan + 6, arenaSpan + 6),
    new THREE.MeshStandardMaterial({
      map: cobbleTex,
      color: 0xd8dff2,
      roughness: 0.80,
      metalness: 0.08
    })
  );
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.receiveShadow = true;
  arenaGroup.add(groundMesh);

  // Etched glowing purple mystic circles on the 3D courtyard flagstones
  const plazaRuneMat = new THREE.MeshBasicMaterial({
    map: arcaneCircleTex,
    color: 0xc084fc,
    transparent: true,
    opacity: 0.52,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const runeSpots = [
    { x: 0, z: 0, s: 6.4 },
    { x: -15, z: -4, s: 4.8 },
    { x: 15, z: -9, s: 4.8 },
    { x: -12, z: 14, s: 4.6 }
  ];
  for (const rs of runeSpots) {
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(rs.s, rs.s), plazaRuneMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(rs.x, 0.02, rs.z);
    arenaGroup.add(disc);
  }

  // Hub Showcase Raised Stone Pedestal (visible ONLY in 'hub' mode)
  const hubBackdropGroup = new THREE.Group();
  hubBackdropGroup.visible = false;
  scene.add(hubBackdropGroup);

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x555e75, roughness: 0.74, metalness: 0.14 });
  const darkStoneMat = new THREE.MeshStandardMaterial({ color: 0x363d52, roughness: 0.80, metalness: 0.15 });
  const hubPedestalRim = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.45, 0.14, 36), darkStoneMat);
  hubPedestalRim.position.y = 0.02;
  hubPedestalRim.receiveShadow = true;
  const hubPedestalTop = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.1, 0.16, 36), stoneMat);
  hubPedestalTop.position.y = 0.04;
  hubPedestalTop.receiveShadow = true;
  hubBackdropGroup.add(hubPedestalRim, hubPedestalTop);

  // ==========================================================================
  // Dynamic Flickering Campfire & Torch/Altar PointLights
  // ==========================================================================
  const lanterns = [];

  function addFlickerLight(x, y, z, colorHex, intensity, distance, phase = 0, withFireCone = false) {
    const pl = new THREE.PointLight(colorHex, intensity, distance, 1.45);
    pl.position.set(x, y, z);
    arenaGroup.add(pl);

    let flameGrp = null;
    if (withFireCone) {
      flameGrp = new THREE.Group();
      flameGrp.position.set(x, 0.12, z);
      // 3D campfire logs + glowing layered flame cones
      const logMat = new THREE.MeshStandardMaterial({ color: 0x3b2416, roughness: 0.9 });
      for (let i = 0; i < 3; i++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.10, 0.95, 7), logMat);
        log.rotation.z = Math.PI / 2;
        log.rotation.y = (i / 3) * Math.PI;
        log.position.y = 0.08;
        flameGrp.add(log);
      }
      const outerFlame = new THREE.Mesh(
        new THREE.ConeGeometry(0.34, 0.85, 8),
        new THREE.MeshBasicMaterial({
          color: 0xf97316,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      outerFlame.position.y = 0.42;
      const innerFlame = new THREE.Mesh(
        new THREE.ConeGeometry(0.19, 0.58, 8),
        new THREE.MeshBasicMaterial({
          color: 0xfef08a,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      innerFlame.position.y = 0.34;
      const glowSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: softGlowTex,
          color: 0xff8c24,
          transparent: true,
          opacity: 0.65,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      glowSprite.scale.set(2.2, 2.2, 1);
      glowSprite.position.y = 0.48;
      flameGrp.add(outerFlame, innerFlame, glowSprite);
      arenaGroup.add(flameGrp);
    }

    lanterns.push({
      pointLight: pl,
      flameGrp,
      baseIntensity: intensity,
      phase
    });
  }

  // Interior Landmark Colliders (well-spaced, leaving central spawn (0,0) wide open!)
  const obstacles = [
    { x: -11.5, z: -9.0, radius: 2.35 }, // 1. Ruined Purple-Rune Altar Shrine
    { x: 13.0,  z: -6.5, radius: 2.25 }, // 2. Gnarled Dead Lantern Tree & Ribcage
    { x: -14.5, z: 5.5,  radius: 2.05 }, // 3. Campfire Cauldron & Pillars
    { x: 1.5,   z: -15.5,radius: 1.95 }, // 4. North Skull Candle Shrine
    { x: -6.5,  z: 12.5, radius: 1.85 }, // 5. South-West Coffin & Pillar Ruin
    { x: 9.5,   z: 11.5, radius: 1.85 }, // 6. South-East Rune Pillar Grave
    { x: 17.5,  z: 6.0,  radius: 1.90 }  // 7. East Ribcage & Stacked Crates
  ];

  addFlickerLight(-14.5, 2.4, 5.5, 0xff8c24, 3.2, 18, 0.5, true);    // Campfire with real 3D logs & flames!
  addFlickerLight(-11.5, 2.8, -9.0, 0xa855f7, 2.8, 17, 1.7, false);  // Purple Rune Altar glow
  addFlickerLight(13.0, 3.0, -6.5, 0xff9f38, 2.5, 16, 2.9, false);   // Dead Lantern Tree warm glow
  addFlickerLight(-22.0, 3.6, -22.0, 0xff8520, 2.6, 20, 4.1, false); // NW Crypt Mausoleum torches
  addFlickerLight(22.0, 3.2, -22.0, 0xff9838, 2.2, 18, 5.2, false);  // NE Corner shrine glow
  addFlickerLight(20.0, 2.8, 19.0, 0xa855f7, 2.4, 17, 3.6, false);   // SE Arcane portal glow

  // ==========================================================================
  // Load & Assemble Genuine 3D KayKit Environment Models (Zero 2D distortion!)
  // ==========================================================================
  const envPaths = {
    crypt: './assets/env/crypt.gltf',
    arch: './assets/env/arch.gltf',
    arch_gate: './assets/env/arch_gate.gltf',
    shrine: './assets/env/shrine.gltf',
    shrine_candles: './assets/env/shrine_candles.gltf',
    pillar: './assets/env/pillar.gltf',
    tree_dead_large: './assets/env/tree_dead_large_decorated.gltf',
    tree_dead_med: './assets/env/tree_dead_medium.gltf',
    pine_large: './assets/env/tree_pine_orange_large.gltf',
    pine_med: './assets/env/tree_pine_orange_medium.gltf',
    ribcage: './assets/env/ribcage.gltf',
    fence: './assets/env/fence.gltf',
    fence_broken: './assets/env/fence_broken.gltf',
    fence_pillar: './assets/env/fence_pillar.gltf',
    post_lantern: './assets/env/post_lantern.gltf',
    post_skull: './assets/env/post_skull.gltf',
    lantern_standing: './assets/env/lantern_standing.gltf',
    candle_triple: './assets/env/candle_triple.gltf',
    skull_candle: './assets/env/skull_candle.gltf',
    gravestone: './assets/env/gravestone.gltf',
    coffin: './assets/env/coffin_decorated.gltf',
    banner_red: './assets/env/banner_patternA_red.gltf.glb',
    barrels: './assets/env/barrel_small_stack.gltf.glb',
    crates: './assets/env/crates_stacked.gltf.glb'
  };

  const ready = (async () => {
    const loader = new GLTFLoader();
    const templates = new Map();

    await Promise.all(
      Object.entries(envPaths).map(
        ([key, url]) =>
          new Promise((resolve) => {
            loader.load(
              url,
              (gltf) => {
                const isOuterOrTiny =
                  key === 'pine_large' ||
                  key === 'pine_med' ||
                  key === 'candle_triple' ||
                  key === 'skull_candle' ||
                  key === 'fence' ||
                  key === 'fence_broken';
                gltf.scene.traverse((n) => {
                  if (n.isMesh) {
                    n.castShadow = !isOuterOrTiny;
                    n.receiveShadow = key !== 'pine_large' && key !== 'pine_med';
                    if ((key === 'pine_large' || key === 'pine_med') && n.geometry) {
                      // Bake frosted dark-fantasy evergreen + snow-dusted upper needles!
                      const pos = n.geometry.attributes.position;
                      const nrm = n.geometry.attributes.normal;
                      const colors = new Float32Array(pos.count * 3);
                      const bark = new THREE.Color(0x382722);
                      const pine = new THREE.Color(0x284052);
                      const snow = new THREE.Color(0x9fb5d6);
                      const cTmp = new THREE.Color();
                      for (let i = 0; i < pos.count; i++) {
                        const py = pos.getY(i);
                        const ny = nrm ? nrm.getY(i) : 0;
                        if (py < 1.25) {
                          cTmp.copy(bark);
                        } else if (ny > 0.42) {
                          cTmp.copy(pine).lerp(snow, Math.min(1, (ny - 0.42) * 1.45));
                        } else {
                          cTmp.copy(pine);
                        }
                        colors[i * 3] = cTmp.r;
                        colors[i * 3 + 1] = cTmp.g;
                        colors[i * 3 + 2] = cTmp.b;
                      }
                      n.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
                      n.material = new THREE.MeshStandardMaterial({
                        vertexColors: true,
                        roughness: 0.85,
                        metalness: 0.05
                      });
                    } else if (n.material && key !== 'banner_red') {
                      // Moody twilight slate stone tint so KayKit props match the dark courtyard
                      const cloned = Array.isArray(n.material)
                        ? n.material.map((m) => m.clone())
                        : n.material.clone();
                      n.material = cloned;
                      const list = Array.isArray(cloned) ? cloned : [cloned];
                      for (const m of list) {
                        if (m.color) m.color.setHex(0x8c96b2);
                      }
                    }
                  }
                });
                templates.set(key, gltf.scene);
                resolve();
              },
              undefined,
              () => resolve()
            );
          })
      )
    );

    function placeProp(key, x, y, z, rotY = 0, scale = 1.0, parent = arenaGroup) {
      const tpl = templates.get(key);
      if (!tpl) return null;
      const inst = tpl.clone(true);
      inst.position.set(x, y, z);
      inst.rotation.y = rotY;
      inst.scale.setScalar(scale);
      parent.add(inst);
      inst.updateMatrixWorld(true);
      return inst;
    }

    // 1. Perimeter 3D Iron Fences, Stone Fence Pillars, Gothic Gates & Crimson Banners
    const fenceStep = 4.5;
    for (let v = -B; v <= B; v += fenceStep) {
      const isGateSlot = Math.abs(v) < 2.3;
      if (isGateSlot) {
        placeProp('arch_gate', 0, 0, -B, 0, 1.35);
        placeProp('banner_red', -2.6, 0, -B + 0.4, 0, 1.15);
        placeProp('banner_red', 2.6, 0, -B + 0.4, 0, 1.15);

        placeProp('arch', 0, 0, B, Math.PI, 1.35);
        placeProp('arch', -B, 0, 0, Math.PI / 2, 1.35);
        placeProp('arch', B, 0, 0, -Math.PI / 2, 1.35);
      } else {
        const fKeyN = Math.abs(v) % 9 < 4.5 ? 'fence' : 'fence_broken';
        placeProp(fKeyN, v, 0, -B, 0, 1.12);
        placeProp('fence_pillar', v + fenceStep * 0.5, 0, -B, 0, 1.15);

        const fKeyS = Math.abs(v + 3) % 9 < 4.5 ? 'fence' : 'fence_broken';
        placeProp(fKeyS, v, 0, B, Math.PI, 1.12);
        placeProp('fence_pillar', v + fenceStep * 0.5, 0, B, 0, 1.15);

        placeProp(fKeyN, -B, 0, v, Math.PI / 2, 1.12);
        placeProp(fKeyS, B, 0, v, -Math.PI / 2, 1.12);
      }
    }

    // 2. Outer 3D Landmarks & Frosted Pine Forest Ring (matching user's map silhouette in real 3D!)
    // Grand Crypt Mausoleum in North-West corner
    placeProp('crypt', -21.5, 0, -31.5, 0.35, 1.55);
    placeProp('banner_red', -17.2, 0, -28.0, 0.25, 1.25);
    placeProp('banner_red', -25.2, 0, -27.2, 0.42, 1.25);
    placeProp('post_lantern', -18.5, 0, -26.2, 0.2, 1.2);

    // North-East Ruined Sanctuary
    placeProp('arch', 20.5, 0, -30.5, -0.35, 1.45);
    placeProp('shrine_candles', 22.5, 0, -29.0, -0.4, 1.35);
    placeProp('banner_red', 17.5, 0, -27.5, -0.3, 1.2);

    // Dense 3D Frosted Pine Trees framing all 4 outer sides
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const dist = B + 4.2 + (i % 3) * 2.8;
      const tx = Math.cos(a) * dist;
      const tz = Math.sin(a) * dist;
      // Leave sightline clear right over the NW crypt entrance
      if (tx < -15 && tz < -25) continue;
      const pKey = i % 2 === 0 ? 'pine_large' : 'pine_med';
      placeProp(pKey, tx, 0, tz, i * 1.1, 1.25 + (i % 3) * 0.18);
    }

    // 3. The 7 Interior 3D Courtyard Landmarks (matching `obstacles` 1-to-1!)
    // Landmark 1 (-11.5, -9.0): Ruined Purple-Rune Altar Shrine
    placeProp('shrine_candles', -11.5, 0, -9.0, 0.5, 1.35);
    placeProp('pillar', -13.0, 0, -9.6, 0.2, 1.15);
    placeProp('pillar', -10.1, 0, -10.1, 1.4, 0.95);
    placeProp('candle_triple', -10.5, 0, -7.8, 0, 1.2);

    // Landmark 2 (13.0, -6.5): Gnarled Dead Lantern Tree & Giant Ribcage
    placeProp('tree_dead_large', 13.0, 0, -6.5, -0.4, 1.35);
    placeProp('lantern_standing', 11.4, 0, -5.6, 0.3, 1.15);
    placeProp('ribcage', 11.2, 0, -7.8, 0.65, 1.15);

    // Landmark 3 (-14.5, 5.5): Campfire Shrine (around our 3D flickering fire at -14.5, 5.5!)
    placeProp('pillar', -16.1, 0, 4.9, 0.3, 1.1);
    placeProp('barrels', -15.8, 0, 6.7, 0.9, 1.1);
    placeProp('post_lantern', -13.1, 0, 4.5, -0.4, 1.1);

    // Landmark 4 (1.5, -15.5): North Skull Candle Shrine
    placeProp('shrine', 1.5, 0, -15.5, 0.05, 1.28);
    placeProp('skull_candle', 0.4, 0, -14.6, 0.3, 1.25);
    placeProp('gravestone', 2.7, 0, -15.2, -0.25, 1.15);

    // Landmark 5 (-6.5, 12.5): South-West Coffin & Pillar Ruin
    placeProp('coffin', -6.5, 0, 12.5, 0.45, 1.2);
    placeProp('pillar', -7.7, 0, 12.0, 0.1, 1.0);
    placeProp('candle_triple', -5.4, 0, 11.8, 0, 1.15);

    // Landmark 6 (9.5, 11.5): South-East Rune Pillar Grave
    placeProp('pillar', 9.5, 0, 11.5, -0.4, 1.22);
    placeProp('gravestone', 10.7, 0, 11.1, -0.2, 1.2);
    placeProp('skull_candle', 8.6, 0, 10.8, 0.5, 1.2);

    // Landmark 7 (17.5, 6.0): East Ribcage & Stacked Crates
    placeProp('ribcage', 17.5, 0, 6.0, -0.6, 1.25);
    placeProp('crates', 18.7, 0, 5.2, 0.4, 1.1);
    placeProp('post_skull', 16.4, 0, 6.8, -0.3, 1.15);

    // 4. Glowing 3D Arcane Purple Crystal Clusters & Warm Candle Flames (like reference map!)
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      emissive: 0x9333ea,
      emissiveIntensity: 1.45,
      roughness: 0.18,
      metalness: 0.25
    });
    const crystalGeo = new THREE.ConeGeometry(0.24, 1.05, 5);
    crystalGeo.translate(0, 0.5, 0);

    function addCrystalCluster(cx, cz, scale = 1.0) {
      const grp = new THREE.Group();
      grp.position.set(cx, 0, cz);
      const specs = [
        { dx: 0, dz: 0, rx: 0.08, rz: -0.06, s: 1.15 },
        { dx: -0.26, dz: 0.18, rx: -0.28, rz: 0.32, s: 0.78 },
        { dx: 0.28, dz: 0.14, rx: 0.24, rz: -0.35, s: 0.84 },
        { dx: 0.06, dz: -0.26, rx: -0.32, rz: -0.15, s: 0.68 }
      ];
      for (const sp of specs) {
        const shard = new THREE.Mesh(crystalGeo, crystalMat);
        shard.position.set(sp.dx, -0.05, sp.dz);
        shard.rotation.set(sp.rx, 0, sp.rz);
        shard.scale.setScalar(sp.s * scale);
        shard.castShadow = true;
        grp.add(shard);
      }
      arenaGroup.add(grp);
    }

    addCrystalCluster(-9.6, -9.8, 0.95);
    addCrystalCluster(19.5, -16.5, 1.25);
    addCrystalCluster(-21.0, 18.5, 1.2);
    addCrystalCluster(21.5, 16.5, 1.25);
    addCrystalCluster(4.2, -23.5, 1.15);

    const candleFlameMat = new THREE.SpriteMaterial({
      map: softGlowTex,
      color: 0xffa028,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    });
    const candleGlowCoords = [
      [-11.5, 1.45, -9.0],
      [-10.5, 0.68, -7.8],
      [0.4, 0.78, -14.6],
      [-5.4, 0.65, 11.8],
      [8.6, 0.75, 10.8]
    ];
    for (const [fx, fy, fz] of candleGlowCoords) {
      const sp = new THREE.Sprite(candleFlameMat);
      sp.position.set(fx, fy, fz);
      sp.scale.set(0.65, 0.75, 1);
      arenaGroup.add(sp);
    }

    // Hub Stage Flanking Props (visible in Hub showcase behind pedestal)
    placeProp('arch', 0, 0, -6.2, 0, 1.45, hubBackdropGroup);
    placeProp('banner_red', -3.1, 0, -4.5, 0.35, 1.2, hubBackdropGroup);
    placeProp('banner_red', 3.1, 0, -4.5, -0.35, 1.2, hubBackdropGroup);
    placeProp('lantern_standing', -2.35, 0, -1.5, 0.3, 1.1, hubBackdropGroup);
    placeProp('lantern_standing', 2.35, 0, -1.5, -0.3, 1.1, hubBackdropGroup);
  })();

  // Ambient floating spirit motes
  const moteCount = 90;
  const motePositions = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i++) {
    motePositions[i * 3] = (Math.random() - 0.5) * (arenaSpan - 4);
    motePositions[i * 3 + 1] = 0.5 + Math.random() * 4.5;
    motePositions[i * 3 + 2] = (Math.random() - 0.5) * (arenaSpan - 4);
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const moteMat = new THREE.PointsMaterial({
    color: 0xc084fc,
    size: 0.20,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const motesPoints = new THREE.Points(moteGeo, moteMat);
  scene.add(motesPoints);

  // ==========================================================================
  // Pooled 3D Voxel Particle System (Single InstancedMesh Draw Call)
  // ==========================================================================
  const MAX_PARTICLES = 720;
  const partGeo = new THREE.OctahedronGeometry(0.62, 0);
  const partMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const particleMesh = new THREE.InstancedMesh(partGeo, partMat, MAX_PARTICLES);
  particleMesh.frustumCulled = false;
  particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  const tmpColor = new THREE.Color();
  for (let i = 0; i < MAX_PARTICLES; i++) {
    particleMesh.setMatrixAt(i, zeroMatrix);
    particleMesh.setColorAt(i, tmpColor.setHex(0xffffff));
  }
  particleMesh.instanceMatrix.needsUpdate = true;
  if (particleMesh.instanceColor) particleMesh.instanceColor.needsUpdate = true;
  scene.add(particleMesh);

  const particles = new Array(MAX_PARTICLES);
  for (let i = 0; i < MAX_PARTICLES; i++) {
    particles[i] = {
      active: false,
      x: 0, y: 0, z: 0,
      vx: 0, vy: 0, vz: 0,
      rx: 0, ry: 0, rz: 0,
      vrx: 0, vry: 0,
      size: 0.16,
      age: 0,
      life: 0.42,
      gravity: 12
    };
  }
  let particleCursor = 0;
  const pDummy = new THREE.Object3D();

  function spawnParticles({
    x = 0,
    y = 0.8,
    z = 0,
    color = 0xffffff,
    count = 8,
    speed = 6,
    size = 0.16,
    life = 0.42,
    gravity = 12
  } = {}) {
    const n = Math.max(1, Math.min(80, Math.floor(count)));
    tmpColor.set(color);

    for (let k = 0; k < n; k++) {
      const idx = particleCursor;
      particleCursor = (particleCursor + 1) % MAX_PARTICLES;
      const p = particles[idx];

      const theta = Math.random() * Math.PI * 2;
      const horiz = (0.35 + Math.random() * 0.75) * speed;
      p.active = true;
      p.x = x + (Math.random() - 0.5) * 0.22;
      p.y = Math.max(0.12, y + (Math.random() - 0.5) * 0.20);
      p.z = z + (Math.random() - 0.5) * 0.22;
      p.vx = Math.cos(theta) * horiz;
      p.vz = Math.sin(theta) * horiz;
      p.vy = (0.35 + Math.random() * 0.75) * speed * (gravity > 0 ? 0.72 : 0.22);
      p.rx = Math.random() * Math.PI;
      p.ry = Math.random() * Math.PI;
      p.rz = Math.random() * Math.PI;
      p.vrx = (Math.random() - 0.5) * 15;
      p.vry = (Math.random() - 0.5) * 15;
      p.size = size * (0.75 + Math.random() * 0.45);
      p.age = 0;
      p.life = life * (0.8 + Math.random() * 0.4);
      p.gravity = gravity;

      const lumShift = (Math.random() - 0.5) * 0.14;
      const c = tmpColor.clone().offsetHSL(0, 0, lumShift);
      particleMesh.setColorAt(idx, c);
    }
    if (particleMesh.instanceColor) particleMesh.instanceColor.needsUpdate = true;
  }

  // ==========================================================================
  // High-Craft Muzzle Flashes, Slash Arcs, Shockwaves & Sleek Projectiles
  // ==========================================================================
  const activeSlashArcs = [];
  const activeShockwaves = [];
  const activeDangerZones = [];
  const activeMuzzleFlashes = [];
  const activeProjectiles = new Set();

  const muzzleConeGeo = (() => {
    const g = new THREE.ConeGeometry(0.18, 0.85, 6);
    g.rotateX(Math.PI / 2);
    g.translate(0, 0, 0.42);
    return g;
  })();

  // Pooled VFX (Muzzle Flashes, Shockwaves & Danger Zones — ZERO mid-combat Material allocate/dispose stutters!)
  const freeMuzzleFlashes = [];
  const freeShockwaves = [];

  function spawnMuzzleFlash({ x = 0, y = 0.82, z = 0, angle = 0, color = 0xfbbf24, scale = 1.0 } = {}) {
    const vividColor = new THREE.Color(color).offsetHSL(0, 0.16, -0.06);
    let mf = freeMuzzleFlashes.pop();
    if (!mf) {
      const group = new THREE.Group();
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0xfff8dc,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        toneMapped: false
      });
      const outerMat = new THREE.MeshBasicMaterial({
        color: vividColor,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      });
      const mainJet = new THREE.Mesh(muzzleConeGeo, outerMat);
      const coreJet = new THREE.Mesh(muzzleConeGeo, coreMat);
      coreJet.scale.set(0.42, 0.42, 0.58);
      const sideJetL = new THREE.Mesh(muzzleConeGeo, outerMat);
      sideJetL.scale.set(0.5, 0.5, 0.48);
      sideJetL.rotation.y = 0.52;
      const sideJetR = new THREE.Mesh(muzzleConeGeo, outerMat);
      sideJetR.scale.set(0.5, 0.5, 0.48);
      sideJetR.rotation.y = -0.52;
      const spriteMat = new THREE.SpriteMaterial({
        map: softGlowTex,
        color: vividColor,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      });
      const flashSprite = new THREE.Sprite(spriteMat);
      flashSprite.scale.set(1.25, 1.25, 1);
      group.add(mainJet, coreJet, sideJetL, sideJetR, flashSprite);
      scene.add(group);
      mf = { group, coreMat, outerMat, spriteMat, baseScale: scale, age: 0, duration: 0.075 };
    } else {
      mf.outerMat.color.copy(vividColor);
      mf.spriteMat.color.copy(vividColor);
      mf.coreMat.opacity = 0.9;
      mf.outerMat.opacity = 0.85;
      mf.spriteMat.opacity = 0.72;
      mf.group.visible = true;
    }
    mf.group.position.set(x, y, z);
    mf.group.rotation.y = angle;
    mf.group.scale.setScalar(scale);
    mf.baseScale = scale;
    mf.age = 0;
    mf.duration = 0.075;
    activeMuzzleFlashes.push(mf);
  }

  function spawnSlashArc({
    x = 0,
    z = 0,
    angle = 0,
    radius = 3.8,
    arcAngle = Math.PI * 0.8,
    color = 0xfbbf24
  } = {}) {
    const geo = getSlashCrescentGeo(arcAngle);
    const group = new THREE.Group();
    group.position.set(x, 0.82, z);
    group.rotation.y = angle;

    const mainMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const edgeMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const mainMesh = new THREE.Mesh(geo, mainMat);
    const edgeMesh = new THREE.Mesh(geo, edgeMat);
    edgeMesh.scale.set(1.03, 1.15, 1.03);
    edgeMesh.position.y = 0.02;

    group.add(mainMesh, edgeMesh);
    const startRadius = radius * 0.82;
    group.scale.set(startRadius, 1, startRadius);
    scene.add(group);

    activeSlashArcs.push({
      group,
      mainMat,
      edgeMat,
      radius,
      age: 0,
      duration: 0.19
    });
  }

  const unitShockRingGeo = (() => {
    const g = new THREE.RingGeometry(0.82, 1.0, 36);
    g.rotateX(-Math.PI / 2);
    return g;
  })();
  const unitShockDiscGeo = (() => {
    const g = new THREE.CircleGeometry(0.96, 32);
    g.rotateX(-Math.PI / 2);
    return g;
  })();

  function spawnShockwaveRing({
    x = 0,
    z = 0,
    radius = 3.5,
    color = 0xc084fc,
    duration = 0.34
  } = {}) {
    let sw = freeShockwaves.pop();
    if (!sw) {
      const group = new THREE.Group();
      const ringMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const fillMat = new THREE.MeshBasicMaterial({
        map: arcaneCircleTex,
        color,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const ringMesh = new THREE.Mesh(unitShockRingGeo, ringMat);
      const fillMesh = new THREE.Mesh(unitShockDiscGeo, fillMat);
      fillMesh.position.y = -0.01;
      group.add(ringMesh, fillMesh);
      scene.add(group);
      sw = { group, ringMat, fillMat, radius: 1, age: 0, duration: 0.34 };
    } else {
      sw.ringMat.color.setHex(color);
      sw.fillMat.color.setHex(color);
      sw.ringMat.opacity = 0.95;
      sw.fillMat.opacity = 0.42;
      sw.group.visible = true;
    }
    sw.group.position.set(x, 0.07, z);
    const initR = Math.max(0.2, radius * 0.18);
    sw.group.scale.set(initR, 1, initR);
    sw.radius = Math.max(0.5, radius);
    sw.age = 0;
    sw.duration = Math.max(0.1, duration);
    activeShockwaves.push(sw);
  }

  const dangerBorderGeo = (() => {
    const g = new THREE.RingGeometry(0.92, 1.0, 40);
    g.rotateX(-Math.PI / 2);
    return g;
  })();
  const dangerFillGeo = (() => {
    const g = new THREE.CircleGeometry(0.98, 36);
    g.rotateX(-Math.PI / 2);
    return g;
  })();

  function spawnDangerZone({
    x = 0,
    z = 0,
    radius = 3.5,
    duration = 1.1,
    color = 0xef4444
  } = {}) {
    const group = new THREE.Group();
    group.position.set(x, 0.045, z);

    const borderMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const fillMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const borderMesh = new THREE.Mesh(dangerBorderGeo, borderMat);
    borderMesh.scale.set(radius, 1, radius);

    const fillMesh = new THREE.Mesh(dangerFillGeo, fillMat);
    fillMesh.position.y = -0.005;
    fillMesh.scale.set(0.05, 1, 0.05);

    group.add(borderMesh, fillMesh);
    scene.add(group);

    const entry = {
      group,
      borderMat,
      fillMat,
      fillMesh,
      radius,
      age: 0,
      duration: Math.max(0.15, duration)
    };
    activeDangerZones.push(entry);

    return {
      cancel() {
        entry.age = entry.duration + 1;
      }
    };
  }

  // Sleek Projectile Geometries (Oriented so +Z is forward flight direction!)
  // 1) Supersonic Bullet Dart + Long Tapered Tracer Wake (NO round balls!)
  const bulletCoreGeo = (() => {
    const g = new THREE.ConeGeometry(0.055, 0.48, 6);
    g.rotateX(Math.PI / 2);
    return g;
  })();
  const bulletTailGeo = (() => {
    const g = new THREE.ConeGeometry(0.11, 2.15, 6, 1, true);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -1.05);
    return g;
  })();

  // 1b) Compact Blazing Hot-Brass / Tungsten Buckshot Pellet + 0.85m Smoky-Amber Fiery Wake
  const buckshotCoreGeo = (() => {
    const g = new THREE.ConeGeometry(0.062, 0.28, 6);
    g.rotateX(Math.PI / 2);
    return g;
  })();
  const buckshotSparkGeo = (() => {
    const g = new THREE.OctahedronGeometry(0.052, 0);
    g.scale(0.85, 0.85, 1.45);
    return g;
  })();
  const buckshotWakeGeo = (() => {
    const g = new THREE.ConeGeometry(0.088, 0.85, 6, 1, true);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -0.42);
    return g;
  })();

  // 2) Arcane / Elemental Sculpted 3D Geometries (Fire Tongues, Water Orb, Lightning Zig-Zag, Air Cyclone)
  const spellCrystalGeo = new THREE.OctahedronGeometry(0.18, 0);
  const fireHeartGeo = new THREE.SphereGeometry(0.165, 10, 10);
  const fireTongueGeo = (() => {
    const g = new THREE.ConeGeometry(0.145, 0.92, 6, 1, true);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -0.34);
    return g;
  })();
  const waterOrbGeo = (() => {
    const g = new THREE.SphereGeometry(0.19, 12, 12);
    g.scale(0.92, 0.92, 1.28);
    return g;
  })();
  const lightningZigGeo = (() => {
    const g = new THREE.OctahedronGeometry(0.085, 0);
    g.scale(0.45, 0.45, 4.8);
    return g;
  })();
  const airCutterGeo = getSlashCrescentGeo(Math.PI * 0.92);
  const spellTailGeo = (() => {
    const g = new THREE.ConeGeometry(0.22, 1.55, 8, 1, true);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -0.78);
    return g;
  })();
  const spellOrbitRingGeo = new THREE.TorusGeometry(0.26, 0.025, 6, 18);

  // Pooled 3D Chain-Lightning Arcs between enemies!
  const activeLightningArcs = [];
  const freeLightningArcs = [];
  const unitBoltSegGeo = (() => {
    const g = new THREE.BoxGeometry(0.055, 0.055, 1.0);
    g.translate(0, 0, 0.5);
    return g;
  })();

  function spawnLightningArc({ x1 = 0, z1 = 0, x2 = 1, z2 = 1, color = 0x38bdf8 } = {}) {
    let arc = freeLightningArcs.pop();
    if (!arc) {
      const group = new THREE.Group();
      const outerMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      });
      const innerMat = new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.98,
        depthWrite: false,
        toneMapped: false
      });
      const segs = [];
      for (let i = 0; i < 3; i++) {
        const sGrp = new THREE.Group();
        const outer = new THREE.Mesh(unitBoltSegGeo, outerMat);
        outer.scale.set(1.6, 1.6, 1);
        const inner = new THREE.Mesh(unitBoltSegGeo, innerMat);
        sGrp.add(outer, inner);
        group.add(sGrp);
        segs.push(sGrp);
      }
      scene.add(group);
      arc = { group, segs, outerMat, innerMat, age: 0, duration: 0.14 };
    } else {
      arc.outerMat.color.setHex(color);
      arc.outerMat.opacity = 0.95;
      arc.innerMat.opacity = 0.98;
      arc.group.visible = true;
    }

    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.max(0.2, Math.hypot(dx, dz));
    const perpX = -dz / len;
    const perpZ = dx / len;
    const j1 = (Math.random() - 0.5) * Math.min(0.85, len * 0.22);
    const j2 = (Math.random() - 0.5) * Math.min(0.85, len * 0.22);
    const pts = [
      { x: x1, z: z1 },
      { x: x1 + dx * 0.33 + perpX * j1, z: z1 + dz * 0.33 + perpZ * j1 },
      { x: x1 + dx * 0.67 + perpX * j2, z: z1 + dz * 0.67 + perpZ * j2 },
      { x: x2, z: z2 }
    ];
    for (let i = 0; i < 3; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const sdx = b.x - a.x;
      const sdz = b.z - a.z;
      const slen = Math.max(0.05, Math.hypot(sdx, sdz));
      const sg = arc.segs[i];
      sg.position.set(a.x, 0.82, a.z);
      sg.rotation.y = Math.atan2(sdx, sdz);
      sg.scale.set(1, 1, slen);
    }
    arc.age = 0;
    arc.duration = 0.14;
    activeLightningArcs.push(arc);
  }

  // 3) Enemy Cultist Jagged Shadow Spear (Needle diamond + dark tail)
  const enemySpearGeo = (() => {
    const g = new THREE.OctahedronGeometry(0.13, 0);
    g.scale(0.75, 0.75, 2.6);
    return g;
  })();
  const enemyTailGeo = (() => {
    const g = new THREE.ConeGeometry(0.12, 1.15, 6, 1, true);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -0.58);
    return g;
  })();

  const projWhiteCoreMat = new THREE.MeshBasicMaterial({ color: 0xfffbeb, toneMapped: false });
  const projDarkCoreMat = new THREE.MeshBasicMaterial({ color: 0x3b0764, toneMapped: false });

  const projMatCache = new Map();
  function getProjMatBundle(keyTag, color, isBuckshot, isBullet) {
    const cacheKey = `${keyTag}_${color}_${isBuckshot ? 1 : 0}_${isBullet ? 1 : 0}`;
    let matSet = projMatCache.get(cacheKey);
    if (!matSet) {
      const fallbackBulletHue = (isBullet || isBuckshot) && color === 0xe2e8f0 ? 0xfbbf24 : color;
      const baseHue = new THREE.Color(fallbackBulletHue);
      if (isBuckshot && keyTag !== 'gatling') {
        baseHue.lerp(new THREE.Color(0xf59e0b), 0.25);
      }
      const richColor = baseHue.clone().offsetHSL(0, 0.2, -0.08);
      const brightCoreColor = baseHue.clone().lerp(new THREE.Color(0xffffff), isBuckshot ? 0.52 : 0.42);
      matSet = {
        richHex: richColor.getHex(),
        solidCoreMat: new THREE.MeshBasicMaterial({
          color: brightCoreColor,
          toneMapped: false
        }),
        glowMat: new THREE.MeshBasicMaterial({
          color: richColor,
          transparent: true,
          opacity: isBuckshot ? 0.78 : isBullet ? 0.82 : 0.66,
          depthWrite: false,
          side: THREE.DoubleSide,
          toneMapped: false
        }),
        haloSpriteMat: new THREE.SpriteMaterial({
          map: softGlowTex,
          color: richColor,
          transparent: true,
          opacity: isBuckshot ? 0.44 : 0.55,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false
        })
      };
      projMatCache.set(cacheKey, matSet);
    }
    return matSet;
  }

  function createProjectileVisual(type = 'ranged', color = 0xfbbf24, radius = 0.16) {
    const mesh = new THREE.Group();
    // Guard against legacy callers passing ~1.0 scale instead of ~0.16 radius
    const rawR = Number(radius) || 0.16;
    const scaleMult = rawR > 0.45 ? rawR * 0.85 : Math.max(0.75, rawR / 0.16);

    const isBuckshot =
      type === 'buckshot' ||
      type === 'pellet' ||
      type === 'pistol' ||
      type === 'blunderbuss' ||
      type === 'gatling';

    const isBullet =
      !isBuckshot &&
      (type === 'ranged' ||
        type === 'bullet' ||
        type === 'bolt');

    const isEnemyProj = type === 'enemy' || type === 'enemy_bolt';

    const matSet = getProjMatBundle(type, color, isBuckshot, isBullet);
    const { richHex, solidCoreMat, glowMat, haloSpriteMat } = matSet;
    const haloSprite = new THREE.Sprite(haloSpriteMat);

    let spinCore = null;
    let orbitRingA = null;
    let orbitRingB = null;

    if (isBuckshot) {
      const pelletCore = new THREE.Mesh(buckshotCoreGeo, solidCoreMat);
      const leadSpark = new THREE.Mesh(buckshotSparkGeo, projWhiteCoreMat);
      leadSpark.position.z = 0.05;
      const wake = new THREE.Mesh(buckshotWakeGeo, glowMat);
      haloSprite.scale.set(0.38, 0.38, 1);
      mesh.add(pelletCore, leadSpark, wake, haloSprite);
      mesh.scale.setScalar(scaleMult * 0.78);
    } else if (isBullet) {
      const dart = new THREE.Mesh(bulletCoreGeo, projWhiteCoreMat);
      dart.scale.set(0.7, 0.7, 1.0);
      const tail = new THREE.Mesh(bulletTailGeo, glowMat);
      haloSprite.scale.set(0.52, 0.52, 1);
      mesh.add(dart, tail, haloSprite);
      mesh.scale.setScalar(scaleMult);
    } else if (isEnemyProj) {
      const spear = new THREE.Mesh(enemySpearGeo, solidCoreMat);
      const outerSpear = new THREE.Mesh(enemySpearGeo, glowMat);
      outerSpear.scale.setScalar(1.35);
      const tail = new THREE.Mesh(enemyTailGeo, glowMat);
      haloSprite.scale.set(0.68, 0.68, 1);
      spinCore = spear;
      mesh.add(spear, outerSpear, tail, haloSprite);
      mesh.scale.setScalar(scaleMult);
    } else if (type === 'magic_fire') {
      // 🔥 LIVING ROARING FIREBALL: Incandescent heart + 3 swirling jagged flame tongues + fiery wake!
      const fireOuterMat = getProjMatBundle('mfire_out', 0xff3d00, false, false).glowMat;
      const fireMidMat = getProjMatBundle('mfire_mid', 0xff9100, false, false).solidCoreMat;
      const heart = new THREE.Mesh(fireHeartGeo, projWhiteCoreMat);
      const midShell = new THREE.Mesh(fireHeartGeo, fireMidMat);
      midShell.scale.set(1.26, 1.26, 1.55);

      const flameWhirl = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const tongue = new THREE.Mesh(fireTongueGeo, i === 0 ? fireMidMat : fireOuterMat);
        const ang = (i / 3) * Math.PI * 2;
        tongue.position.set(Math.cos(ang) * 0.08, Math.sin(ang) * 0.08, 0.08);
        tongue.rotation.z = ang;
        tongue.scale.set(1.15, 1.15, 1.05 + i * 0.22);
        flameWhirl.add(tongue);
      }
      const wake = new THREE.Mesh(spellTailGeo, fireOuterMat);
      wake.scale.set(1.15, 1.15, 1.12);
      haloSprite.material = getProjMatBundle('mfire_out', 0xff5722, false, false).haloSpriteMat;
      haloSprite.scale.set(1.15, 1.15, 1);
      orbitRingA = flameWhirl;
      spinCore = midShell;
      mesh.add(heart, midShell, flameWhirl, wake, haloSprite);
      mesh.scale.setScalar(scaleMult * 1.08);
    } else if (type === 'magic_water') {
      // 💧 CRESTING TIDAL ORB: Glossy sapphire-aqua teardrop + 2 swirling foamy water rings + stream!
      const aquaCoreMat = getProjMatBundle('mwat_core', 0x38bdf8, false, false).solidCoreMat;
      const deepSeaMat = getProjMatBundle('mwat_deep', 0x0284c7, false, false).glowMat;
      const dropCore = new THREE.Mesh(waterOrbGeo, projWhiteCoreMat);
      dropCore.scale.setScalar(0.58);
      const waterBody = new THREE.Mesh(waterOrbGeo, aquaCoreMat);
      orbitRingA = new THREE.Mesh(spellOrbitRingGeo, projWhiteCoreMat);
      orbitRingA.scale.set(1.08, 1.08, 1.08);
      orbitRingB = new THREE.Mesh(spellOrbitRingGeo, deepSeaMat);
      orbitRingB.rotation.x = Math.PI * 0.45;
      orbitRingB.scale.set(1.25, 1.25, 1.25);
      const stream = new THREE.Mesh(spellTailGeo, deepSeaMat);
      stream.scale.set(0.95, 0.95, 0.95);
      haloSprite.material = getProjMatBundle('mwat_deep', 0x0ea5e9, false, false).haloSpriteMat;
      haloSprite.scale.set(1.05, 1.05, 1);
      spinCore = waterBody;
      mesh.add(dropCore, waterBody, orbitRingA, orbitRingB, stream, haloSprite);
      mesh.scale.setScalar(scaleMult * 1.06);
    } else if (type === 'magic_lightning') {
      // ⚡ CRACKLING BALL LIGHTNING & ZIG-ZAG SPEAR: Plasma core + 3 criss-crossing electric bolts!
      const elecCyanMat = getProjMatBundle('mlight_cy', 0x38bdf8, false, false).glowMat;
      const elecGoldMat = getProjMatBundle('mlight_gd', 0xfef08a, false, false).solidCoreMat;
      const plasmaCore = new THREE.Mesh(spellCrystalGeo, projWhiteCoreMat);
      plasmaCore.scale.set(0.68, 0.68, 1.35);

      const arcsCluster = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const bolt = new THREE.Mesh(lightningZigGeo, i === 0 ? elecGoldMat : elecCyanMat);
        bolt.rotation.z = (i / 3) * Math.PI;
        bolt.rotation.x = (i - 1) * 0.28;
        bolt.rotation.y = (1 - i) * 0.24;
        arcsCluster.add(bolt);
      }
      orbitRingA = arcsCluster;
      spinCore = plasmaCore;
      haloSprite.material = getProjMatBundle('mlight_cy', 0x38bdf8, false, false).haloSpriteMat;
      haloSprite.scale.set(1.12, 1.12, 1);
      mesh.add(plasmaCore, arcsCluster, haloSprite);
      mesh.scale.setScalar(scaleMult * 1.1);
    } else if (type === 'magic_air') {
      // 🌪️ RAZOR WIND CUTTER & CYCLONE VORTEX: Swept crescent wind-blade + 3 stacked spinning tornado rings!
      const windMintMat = getProjMatBundle('mair_mint', 0x5eead4, false, false).glowMat;
      const windWhiteMat = getProjMatBundle('mair_wht', 0xf8fafc, false, false).solidCoreMat;
      const cutter = new THREE.Mesh(airCutterGeo, windWhiteMat);
      cutter.scale.set(0.46, 1.0, 0.46);

      const cyclone = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(spellOrbitRingGeo, i === 1 ? windWhiteMat : windMintMat);
        ring.rotation.x = Math.PI * 0.5;
        const rScale = 0.62 + i * 0.34;
        ring.scale.set(rScale, rScale, 1);
        ring.position.y = (i - 1) * 0.11;
        ring.position.z = -i * 0.14;
        cyclone.add(ring);
      }
      const slipstream = new THREE.Mesh(spellTailGeo, windMintMat);
      slipstream.scale.set(0.85, 0.85, 0.85);
      orbitRingB = cyclone;
      spinCore = cutter;
      haloSprite.material = getProjMatBundle('mair_mint', 0x5eead4, false, false).haloSpriteMat;
      haloSprite.scale.set(1.0, 1.0, 1);
      mesh.add(cutter, cyclone, slipstream, haloSprite);
      mesh.scale.setScalar(scaleMult * 1.08);
    } else {
      // Fallback Mage Spell Comet
      const isVoid = type === 'void_orb';
      const core = new THREE.Mesh(spellCrystalGeo, isVoid ? projDarkCoreMat : solidCoreMat);
      const innerSpark = new THREE.Mesh(spellCrystalGeo, projWhiteCoreMat);
      innerSpark.scale.setScalar(0.52);
      const tail = new THREE.Mesh(spellTailGeo, glowMat);
      orbitRingA = new THREE.Mesh(spellOrbitRingGeo, solidCoreMat);
      orbitRingB = new THREE.Mesh(spellOrbitRingGeo, glowMat);
      orbitRingB.rotation.x = Math.PI * 0.5;
      haloSprite.scale.set(0.95, 0.95, 1);
      spinCore = core;
      mesh.add(core, innerSpark, tail, orbitRingA, orbitRingB, haloSprite);
      mesh.scale.setScalar(scaleMult);
    }

    scene.add(mesh);

    let disposed = false;
    const handle = {
      mesh,
      visualKind: type,
      spinCore,
      orbitRingA,
      orbitRingB,
      prevX: null,
      prevZ: null,
      trailAccum: 0,
      isMagic: !isBullet && !isBuckshot && !isEnemyProj,
      color: richHex,
      dispose() {
        if (disposed) return;
        disposed = true;
        if (mesh.parent) mesh.parent.remove(mesh);
        activeProjectiles.delete(handle);
      }
    };
    activeProjectiles.add(handle);
    return handle;
  }

  // ==========================================================================
  // Camera Mode ('hub' Showcase vs 'combat' Isometric), Follow, Shake & Aim
  // ==========================================================================
  let cameraMode = 'combat';
  let targetX = 0;
  let targetZ = 0;
  let hasFollowedOnce = false;
  let shakeIntensity = 0;
  let shakeTime = 0;
  let bossModeActive = false;
  let internalTime = 0;
  const hubCamGoal = new THREE.Vector3();

  function applyHubCameraPose(dt, snapNow = false) {
    const aspect = camera.aspect || 1;
    const isPortrait = aspect < 0.92;
    const targetFov = isPortrait ? 52 : 44;
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov = targetFov;
      camera.updateProjectionMatrix();
    }
    const camZ = isPortrait ? 6.15 : HUB_CAM_POS.z;
    const camY = isPortrait ? 2.32 : HUB_CAM_POS.y;
    const lookY = isPortrait ? 0.36 : HUB_LOOK_TARGET.y;

    const swayX = Math.sin(internalTime * 0.42) * 0.14;
    const swayY = Math.sin(internalTime * 0.68) * 0.03;
    const swayZ = Math.cos(internalTime * 0.42) * 0.06;
    hubCamGoal.set(HUB_CAM_POS.x + swayX, camY + swayY, camZ + swayZ);

    if (snapNow || !dt || dt <= 0) {
      camera.position.copy(hubCamGoal);
    } else {
      const lerpFactor = 1 - Math.exp(-7.5 * Math.min(dt, 0.1));
      camera.position.lerp(hubCamGoal, lerpFactor);
    }
    camera.lookAt(0, lookY, 0);

    heroAuraLight.position.set(0, 2.85, 1.4);
    dirLight.position.set(8, 16, 12);
    dirLight.target.position.set(0, 0.8, 0);
    dirLight.target.updateMatrixWorld();
  }

  function setCameraMode(mode = 'combat') {
    const nextMode = mode === 'hub' ? 'hub' : 'combat';
    const changed = cameraMode !== nextMode;
    cameraMode = nextMode;

    if (cameraMode === 'hub') {
      hubKeySpotLight.visible = true;
      hubRimLight.visible = true;
      hubBackdropGroup.visible = true;
      scene.fog.near = 16;
      scene.fog.far = 56;
      targetX = 0;
      targetZ = 0;
      applyHubCameraPose(0.016, changed || !hasFollowedOnce);
      hasFollowedOnce = true;
    } else {
      hubKeySpotLight.visible = false;
      hubRimLight.visible = false;
      hubBackdropGroup.visible = false;
      scene.fog.near = 48;
      scene.fog.far = 112;
      hasFollowedOnce = false;
      const aspect = camera.aspect || 1;
      camera.fov = aspect < 1.0 ? Math.min(64, 44 + (1.0 - aspect) * 34) : 44;
      camera.updateProjectionMatrix();
      const mult = aspect < 0.92 ? 1.15 : 1;
      camera.position.set(
        targetX + COMBAT_CAM_OFFSET.x * mult,
        COMBAT_CAM_OFFSET.y * mult,
        targetZ + COMBAT_CAM_OFFSET.z * mult
      );
      camera.lookAt(targetX, 0.5, targetZ);
      heroAuraLight.position.set(targetX, 3.2, targetZ);
    }
  }

  function followTarget(x = 0, z = 0, dt = 0.016) {
    if (cameraMode === 'hub') {
      applyHubCameraPose(dt, false);
      return;
    }

    if (!hasFollowedOnce || !dt || dt <= 0) {
      targetX = x;
      targetZ = z;
      hasFollowedOnce = true;
    } else {
      const factor = 1 - Math.exp(-11 * Math.min(dt, 0.1));
      targetX += (x - targetX) * factor;
      targetZ += (z - targetZ) * factor;
    }

    let sx = 0, sy = 0, sz = 0;
    if (shakeIntensity > 0.002) {
      sx = (Math.sin(shakeTime * 47) + (Math.random() - 0.5) * 0.8) * shakeIntensity * 0.55;
      sy = Math.cos(shakeTime * 53) * shakeIntensity * 0.28;
      sz = (Math.cos(shakeTime * 41) + (Math.random() - 0.5) * 0.8) * shakeIntensity * 0.55;
    }

    camera.position.set(
      targetX + COMBAT_CAM_OFFSET.x * (camera.aspect < 0.92 ? 1.15 : 1) + sx,
      COMBAT_CAM_OFFSET.y * (camera.aspect < 0.92 ? 1.15 : 1) + sy,
      targetZ + COMBAT_CAM_OFFSET.z * (camera.aspect < 0.92 ? 1.15 : 1) + sz
    );
    camera.lookAt(targetX + sx * 0.35, 0.5, targetZ + sz * 0.35);

    heroAuraLight.position.set(targetX, 3.2, targetZ);

    const snap = 0.5;
    const lx = Math.round(targetX / snap) * snap;
    const lz = Math.round(targetZ / snap) * snap;
    dirLight.position.set(lx + 14, 28, lz + 16);
    dirLight.target.position.set(lx, 0, lz);
    dirLight.target.updateMatrixWorld();
  }

  function addScreenShake(amount = 0.3) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    shakeIntensity = Math.min(1.6, shakeIntensity + amount);
  }

  function setBossAtmosphere(active) {
    bossModeActive = Boolean(active);
  }

  const raycaster = new THREE.Raycaster();
  const ndcMouse = new THREE.Vector2();
  const aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.7);
  const aimHit = new THREE.Vector3();

  function getAimPointOnGround(clientX, clientY) {
    const vp = window.__getGameViewportSize?.();
    const mapped = window.__toGameCoords ? window.__toGameCoords(clientX, clientY) : { x: clientX, y: clientY };
    const w = Math.max(vp?.w || window.innerWidth, 1);
    const h = Math.max(vp?.h || window.innerHeight, 1);

    ndcMouse.x = (mapped.x / w) * 2 - 1;
    ndcMouse.y = -(mapped.y / h) * 2 + 1;

    raycaster.setFromCamera(ndcMouse, camera);
    const hit = raycaster.ray.intersectPlane(aimPlane, aimHit);
    return hit ? { x: aimHit.x, z: aimHit.z } : { x: targetX, z: targetZ };
  }

  // ==========================================================================
  // Frame Update, Resize, Render & VFX Reset
  // ==========================================================================
  function update(dt = 0.016, elapsedTime) {
    const safeDt = Math.min(Math.max(dt || 0.016, 0), 0.1);
    internalTime += safeDt;
    const t = Number.isFinite(elapsedTime) ? elapsedTime : internalTime;

    if (cameraMode === 'hub') {
      applyHubCameraPose(safeDt, false);
    }

    if (shakeIntensity > 0) {
      shakeTime += safeDt;
      shakeIntensity = Math.max(0, shakeIntensity - safeDt * 3.4);
    }

    const pal = bossModeActive ? PALETTE_BOSS : PALETTE_NORMAL;
    const atmLerp = Math.min(1, safeDt * 2.4);
    scene.background.lerp(pal.bg, atmLerp);
    scene.fog.color.lerp(pal.fog, atmLerp);
    hemiLight.color.lerp(pal.hemiSky, atmLerp);
    hemiLight.groundColor.lerp(pal.hemiGround, atmLerp);
    dirLight.color.lerp(pal.dir, atmLerp);
    plazaRuneMat.color.lerp(pal.plazaRune, atmLerp);
    moteMat.color.lerp(pal.plazaRune, atmLerp);

    plazaRuneMat.opacity = 0.44 + Math.sin(t * 2.5) * 0.12;
    motesPoints.position.y = Math.sin(t * 0.9) * 0.28;
    motesPoints.rotation.y = t * 0.03;

    // Flickering fires & rune lights
    for (let i = 0; i < lanterns.length; i++) {
      const l = lanterns[i];
      const flicker = 0.88 + Math.sin(t * 9.5 + l.phase) * 0.08 + Math.sin(t * 23.0 + l.phase * 2.1) * 0.05;
      if (l.pointLight) l.pointLight.intensity = l.baseIntensity * flicker;
      if (l.flameGrp) {
        l.flameGrp.children.forEach((ch, idx) => {
          if (idx >= 3) ch.scale.y = flicker;
        });
      }
    }

    // Animate active projectiles (spin arcane crystals, align tracer tails to velocity & emit comet sparks!)
    for (const proj of activeProjectiles) {
      const m = proj.mesh;
      if (proj.prevX !== null) {
        const dx = m.position.x - proj.prevX;
        const dz = m.position.z - proj.prevZ;
        if (dx * dx + dz * dz > 0.00005) {
          m.rotation.y = Math.atan2(dx, dz);
        }
      }
      proj.prevX = m.position.x;
      proj.prevZ = m.position.z;

      if (proj.spinCore) {
        if (proj.visualKind !== 'magic_air') {
          proj.spinCore.rotation.z += safeDt * 14;
          proj.spinCore.rotation.x += safeDt * 9;
        }
      }
      if (proj.orbitRingA) {
        if (proj.visualKind === 'magic_fire') {
          proj.orbitRingA.rotation.z += safeDt * 18;
        } else if (proj.visualKind === 'magic_lightning') {
          proj.orbitRingA.rotation.z += safeDt * 34;
          proj.orbitRingA.rotation.x = Math.sin(t * 45) * 0.35;
        } else {
          proj.orbitRingA.rotation.x += safeDt * 12;
          proj.orbitRingA.rotation.y += safeDt * 8;
        }
      }
      if (proj.orbitRingB) {
        if (proj.visualKind === 'magic_air') {
          proj.orbitRingB.rotation.y += safeDt * 24;
        } else {
          proj.orbitRingB.rotation.z -= safeDt * 13;
        }
      }
      if (proj.isMagic) {
        proj.trailAccum += safeDt;
        if (proj.trailAccum >= 0.026) {
          proj.trailAccum = 0;
          spawnParticles({
            x: m.position.x,
            y: m.position.y,
            z: m.position.z,
            color: proj.color,
            count: 2,
            speed: 1.8,
            size: 0.11,
            life: 0.24,
            gravity: -1.5
          });
        }
      }
    }

    // Update Muzzle Flashes
    for (let i = activeMuzzleFlashes.length - 1; i >= 0; i--) {
      const mf = activeMuzzleFlashes[i];
      mf.age += safeDt;
      if (mf.age >= mf.duration) {
        mf.group.visible = false;
        activeMuzzleFlashes.splice(i, 1);
        freeMuzzleFlashes.push(mf);
        continue;
      }
      const p = 1 - mf.age / mf.duration;
      mf.coreMat.opacity = p;
      mf.outerMat.opacity = p * 0.9;
      mf.spriteMat.opacity = p * 0.85;
      mf.group.scale.setScalar(mf.baseScale * (0.75 + p * 0.45));
    }

    // Update Pooled Instanced Particles
    let anyParticleChanged = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = particles[i];
      if (!p.active) continue;
      anyParticleChanged = true;

      p.age += safeDt;
      if (p.age >= p.life) {
        p.active = false;
        particleMesh.setMatrixAt(i, zeroMatrix);
        continue;
      }

      p.vy -= p.gravity * safeDt;
      p.x += p.vx * safeDt;
      p.y += p.vy * safeDt;
      p.z += p.vz * safeDt;

      const floorY = p.size * 0.5;
      if (p.gravity > 0 && p.y < floorY) {
        p.y = floorY;
        p.vy = Math.abs(p.vy) * 0.34;
        p.vx *= 0.72;
        p.vz *= 0.72;
      }

      p.rx += p.vrx * safeDt;
      p.ry += p.vry * safeDt;

      const lifeLeft = 1 - p.age / p.life;
      const scaleFactor = lifeLeft < 0.4 ? lifeLeft / 0.4 : 1.0;
      const s = p.size * scaleFactor;

      pDummy.position.set(p.x, p.y, p.z);
      pDummy.rotation.set(p.rx, p.ry, p.rz);
      pDummy.scale.set(s, s, s);
      pDummy.updateMatrix();
      particleMesh.setMatrixAt(i, pDummy.matrix);
    }
    if (anyParticleChanged) {
      particleMesh.instanceMatrix.needsUpdate = true;
    }

    // Update Slash Arcs
    for (let i = activeSlashArcs.length - 1; i >= 0; i--) {
      const sa = activeSlashArcs[i];
      sa.age += safeDt;
      if (sa.age >= sa.duration) {
        scene.remove(sa.group);
        sa.mainMat.dispose();
        sa.edgeMat.dispose();
        activeSlashArcs.splice(i, 1);
        continue;
      }
      const p = sa.age / sa.duration;
      const expand = sa.radius * (0.82 + 0.24 * (1 - (1 - p) * (1 - p)));
      sa.group.scale.set(expand, 1, expand);
      sa.mainMat.opacity = (1 - p) * 0.92;
      sa.edgeMat.opacity = (1 - p) * (1 - p) * 0.85;
    }

    // Update Shockwave Rings
    for (let i = activeShockwaves.length - 1; i >= 0; i--) {
      const sw = activeShockwaves[i];
      sw.age += safeDt;
      if (sw.age >= sw.duration) {
        sw.group.visible = false;
        activeShockwaves.splice(i, 1);
        freeShockwaves.push(sw);
        continue;
      }
      const p = sw.age / sw.duration;
      const easeOut = 1 - (1 - p) * (1 - p);
      const curR = sw.radius * (0.18 + 0.82 * easeOut);
      sw.group.scale.set(curR, 1, curR);
      sw.ringMat.opacity = (1 - p) * 0.95;
      sw.fillMat.opacity = (1 - p) * 0.42;
    }

    // Update 3D Chain-Lightning Arcs
    for (let i = activeLightningArcs.length - 1; i >= 0; i--) {
      const la = activeLightningArcs[i];
      la.age += safeDt;
      if (la.age >= la.duration) {
        la.group.visible = false;
        activeLightningArcs.splice(i, 1);
        freeLightningArcs.push(la);
        continue;
      }
      const p = 1 - la.age / la.duration;
      la.outerMat.opacity = p * 0.95;
      la.innerMat.opacity = p;
    }

    // Update Boss Danger Zones
    for (let i = activeDangerZones.length - 1; i >= 0; i--) {
      const dz = activeDangerZones[i];
      dz.age += safeDt;
      if (dz.age >= dz.duration) {
        scene.remove(dz.group);
        dz.borderMat.dispose();
        dz.fillMat.dispose();
        activeDangerZones.splice(i, 1);
        continue;
      }
      const p = Math.min(1, dz.age / dz.duration);
      const fillR = dz.radius * Math.max(0.05, p);
      dz.fillMesh.scale.set(fillR, 1, fillR);
      dz.fillMat.opacity = p > 0.75 ? 0.55 + Math.sin(t * 36) * 0.35 : 0.20 + p * 0.28;
      dz.borderMat.opacity = 0.72 + Math.sin(t * 16) * 0.22;
    }
  }

  function render() {
    renderer.render(scene, camera);
  }

  function resize() {
    const vp = window.__getGameViewportSize?.();
    const vv = window.visualViewport;
    const w = Math.max(Math.round(vp?.w || vv?.width || document.documentElement.clientWidth || window.innerWidth), 1);
    const h = Math.max(Math.round(vp?.h || vv?.height || document.documentElement.clientHeight || window.innerHeight), 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    renderer.setSize(w, h, true);
    const aspect = w / h;
    camera.aspect = aspect;
    if (cameraMode === 'hub') {
      camera.fov = aspect < 0.92 ? 52 : 44;
    } else {
      camera.fov = aspect < 1.0 ? Math.min(64, 44 + (1.0 - aspect) * 34) : 44;
    }
    camera.updateProjectionMatrix();
  }

  function resetVfx() {
    shakeIntensity = 0;
    bossModeActive = false;
    scene.background.copy(PALETTE_NORMAL.bg);
    scene.fog.color.copy(PALETTE_NORMAL.fog);
    hemiLight.color.copy(PALETTE_NORMAL.hemiSky);
    hemiLight.groundColor.copy(PALETTE_NORMAL.hemiGround);
    dirLight.color.copy(PALETTE_NORMAL.dir);
    plazaRuneMat.color.copy(PALETTE_NORMAL.plazaRune);

    for (let i = 0; i < MAX_PARTICLES; i++) {
      particles[i].active = false;
      particleMesh.setMatrixAt(i, zeroMatrix);
    }
    particleMesh.instanceMatrix.needsUpdate = true;

    while (activeMuzzleFlashes.length > 0) {
      const mf = activeMuzzleFlashes.pop();
      mf.group.visible = false;
      freeMuzzleFlashes.push(mf);
    }
    while (activeSlashArcs.length > 0) {
      const sa = activeSlashArcs.pop();
      scene.remove(sa.group);
      sa.mainMat.dispose();
      sa.edgeMat.dispose();
    }
    while (activeShockwaves.length > 0) {
      const sw = activeShockwaves.pop();
      sw.group.visible = false;
      freeShockwaves.push(sw);
    }
    while (activeLightningArcs.length > 0) {
      const la = activeLightningArcs.pop();
      la.group.visible = false;
      freeLightningArcs.push(la);
    }
    while (activeDangerZones.length > 0) {
      const dz = activeDangerZones.pop();
      scene.remove(dz.group);
      dz.borderMat.dispose();
      dz.fillMat.dispose();
    }
    for (const proj of Array.from(activeProjectiles)) {
      proj.dispose();
    }
    activeProjectiles.clear();
  }

  return {
    ready,
    scene,
    camera,
    renderer,
    obstacles,
    followTarget,
    setCameraMode,
    addScreenShake,
    spawnParticles,
    spawnMuzzleFlash,
    spawnSlashArc,
    spawnShockwaveRing,
    spawnLightningArc,
    spawnDangerZone,
    createProjectileVisual,
    setBossAtmosphere,
    getAimPointOnGround,
    update,
    render,
    resize,
    resetVfx
  };
}
