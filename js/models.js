// Authentic KayKit CC0 Rigged & Animated GLB Character + Enemy System (Three.js r160)
// Heroes match the user's Undead Dark-Fantasy Trio reference:
//   - Gunslinger (Стрелок): Hooded Skeleton with blazing orange eyes, red scarf, backpack & blunderbuss/shotgun
//   - Warrior (Воин): Horned-Helmet Armored Skeleton with blazing orange eyes, red cloak, broadsword & skull shield
//   - Mage (Маг): Wizard-Hat Robed Skeleton with blazing orange eyes, purple crystal staff & glowing potion flask

import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { clone as cloneSkinned } from '../vendor/SkeletonUtils.js';
import { WEAPONS } from './config.js?v=20261116j';

const MODEL_PATHS = {
  barbarian: './assets/models/Barbarian.glb',
  knight: './assets/models/Knight.glb',
  rogue: './assets/models/Rogue_Hooded.glb',
  mage: './assets/models/Mage.glb',
  skel_minion: './assets/models/Skeleton_Minion.glb',
  skel_rogue: './assets/models/Skeleton_Rogue.glb',
  skel_mage: './assets/models/Skeleton_Mage.glb',
  skel_warrior: './assets/models/Skeleton_Warrior.glb',
  strelok_ai: './assets/models/Strelok_AI.glb',
  chest: './assets/env/chest.glb',
  chest_gold: './assets/env/chest_gold.glb'
};

const gltfCache = new Map();
let preloadPromise = null;

export function preloadModels() {
  if (preloadPromise) return preloadPromise;
  const loader = new GLTFLoader();

  const entries = Object.entries(MODEL_PATHS);
  preloadPromise = Promise.all(
    entries.map(
      ([key, url]) =>
        new Promise((resolve) => {
          loader.load(
            url,
            (gltf) => {
              const clipMap = new Map();
              for (const clip of gltf.animations || []) {
                clipMap.set(clip.name, clip);
              }
              gltf.scene.traverse((node) => {
                if (node.isMesh) {
                  node.castShadow = true;
                  node.receiveShadow = true;
                  node.frustumCulled = false;
                }
              });
              gltfCache.set(key, { scene: gltf.scene, clips: clipMap });
              resolve();
            },
            undefined,
            (err) => {
              console.warn(`[models] Failed to load ${url}:`, err);
              resolve();
            }
          );
        })
    )
  );

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

  // === WARRIOR WEAPONS (Broadsword -> Inquisitor Cleaver -> Cinderstorm Greatsword) ===
  if (weaponId === 'club' || weaponId === 'cleaver' || weaponId === 'flail') {
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

  // === GUNSLINGER DARK-FANTASY SHOTGUNS ===
  // Centered cleanly on gunCarryPivot: stock near (0, -0.02, -0.18), barrel forward to z = +0.78!
  if (weaponId === 'pistol' || weaponId === 'blunderbuss' || weaponId === 'gatling') {
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

  // === MAGE WEAPONS (Elemental Crystal Staff matching active Element!) ===
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

  setBaseState(idleClipName, 1.0);
  mixer.update(0.016);

  return { mixer, setBaseState, triggerOneShot, triggerHit, triggerDeath, resetAlive };
}

// ============================================================================
// 1. HERO FACTORY — Exact Undead Chibi Skeleton Trio matching User Reference!
//    - gunslinger -> Skeleton_Rogue.glb (Hood + Red Scarf + Backpack + Two-Handed Forward Shotgun + Recoil/Reload!)
//    - warrior    -> Skeleton_Warrior.glb (Horned Iron Helm + Red Scarf + Sword & Skull Shield + Orange Eyes)
//    - mage       -> Skeleton_Mage.glb (Pointed Wizard Hat + Purple Robes + Crystal Staff & Potion + Orange Eyes)
// ============================================================================
const CLASS_SKELETON_ASSET = {
  warrior: 'skel_warrior',
  gunslinger: 'strelok_ai',
  mage: 'skel_mage'
};

const HERO_BASE_SCALE = 0.90;
const STRELOK_AI_BASE_SCALE = 1.35;
const GUN_PIVOT_BASE_X = 0.06;
const GUN_PIVOT_BASE_Y = 0.70;
const GUN_PIVOT_BASE_Z = 0.24;

export function createHeroMesh(classId = 'warrior', weaponId = null, mageElement = 'fire') {
  if (classId && typeof classId === 'object') {
    const opts = classId;
    weaponId = opts.weaponId ?? null;
    mageElement = opts.mageElement ?? 'fire';
    classId = opts.classId || 'warrior';
  }
  const safeClass = CLASS_SKELETON_ASSET[classId] ? classId : 'warrior';
  const isCustomStrelok = safeClass === 'gunslinger' && gltfCache.has('strelok_ai');
  const assetKey = isCustomStrelok
    ? 'strelok_ai'
    : safeClass === 'gunslinger'
      ? 'skel_rogue'
      : CLASS_SKELETON_ASSET[safeClass];
  const asset = gltfCache.get(assetKey);
  const heroBaseScale = isCustomStrelok ? STRELOK_AI_BASE_SCALE : HERO_BASE_SCALE;

  const root = new THREE.Group();
  let currentWeaponId =
    weaponId || (safeClass === 'warrior' ? 'club' : safeClass === 'gunslinger' ? 'pistol' : 'spark_staff');
  let currentMageElement = mageElement || 'fire';
  let isBeast = false;
  let flashTimer = 0;

  // Gunslinger two-handed carry pivot, recoil kick & reload tilt state
  let gunCarryPivot = null;
  let gunKickTimer = 0;
  let aimHoldTimer = 0;
  let aimYawBlend = 0;
  let pumpCycleTimer = 0;
  let isReloadingState = false;
  let reloadBlend = 0;

  let modelInstance = null;
  let animCtrl = null;
  const instanceMats = [];
  const aiGunMatEntries = [];
  let handR = null;
  let handL = null;
  let chestBone = null;
  let upperArmR = null;
  let lowerArmR = null;
  let upperArmL = null;
  let lowerArmL = null;
  let mountedWeaponObj = null;

  if (safeClass === 'gunslinger' && !isCustomStrelok) {
    gunCarryPivot = new THREE.Group();
    gunCarryPivot.position.set(GUN_PIVOT_BASE_X, GUN_PIVOT_BASE_Y, GUN_PIVOT_BASE_Z);
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
    root.add(modelInstance);

    let headBone = null;

    modelInstance.traverse((node) => {
      const nm = node.name || '';
      if (/^handslot\.?r$/i.test(nm) || (!handR && /^hand\.?r$/i.test(nm))) handR = node;
      if (/^handslot\.?l$/i.test(nm) || (!handL && /^hand\.?l$/i.test(nm))) handL = node;
      if (/^chest$/i.test(nm)) chestBone = node;
      if (/^head$/i.test(nm)) headBone = node;
      if (/^upperarm\.?r$/i.test(nm)) upperArmR = node;
      if (/^lowerarm\.?r$/i.test(nm)) lowerArmR = node;
      if (/^upperarm\.?l$/i.test(nm)) upperArmL = node;
      if (/^lowerarm\.?l$/i.test(nm)) lowerArmL = node;

      if (node.isMesh && node.material) {
        const isEyeMesh = /Eyes/i.test(node.name);
        const isAiGunMesh = isCustomStrelok && /Strelok_Gun/i.test(node.name);
        const isCloakOrScarf = /Cloak|Cape/i.test(node.name);
        const isRogueHood = /Skeleton_Rogue_Hood/i.test(node.name);
        const isMageHatOrRobe = /Skeleton_Mage_(Hat|Body)/i.test(node.name);

        if (isEyeMesh) {
          if (isCustomStrelok) {
            const eyeMat = node.material.clone();
            if (eyeMat.emissive) eyeMat.emissive.setHex(0xffffff);
            eyeMat.emissiveIntensity = 2.6;
            eyeMat.roughness = 0.2;
            node.material = eyeMat;
            instanceMats.push({ mat: eyeMat, baseEmissive: 0xffffff, baseEmissiveInt: 2.6 });
            return;
          }
          const eyeMat = new THREE.MeshStandardMaterial({
            color: 0xffc13b,
            emissive: 0xff6a00,
            emissiveIntensity: 2.6,
            roughness: 0.15
          });
          node.material = eyeMat;
          instanceMats.push({ mat: eyeMat, baseEmissive: 0xff6a00, baseEmissiveInt: 2.6 });
          return;
        }

        const cloned = Array.isArray(node.material)
          ? node.material.map((m) => m.clone())
          : node.material.clone();
        node.material = cloned;
        const list = Array.isArray(cloned) ? cloned : [cloned];

        for (const m of list) {
          if (!isCustomStrelok) {
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
            baseEmissiveInt: m.emissiveIntensity || 0
          };
          instanceMats.push(entry);
          if (isAiGunMesh) {
            aiGunMatEntries.push(entry);
          }
        }
      }
    });

    if (headBone && !isCustomStrelok) {
      headBone.scale.setScalar(1.14);
    }

    if (safeClass === 'warrior') {
      if (handL) {
        handL.add(createSkullShield(false));
      }
    } else if (safeClass === 'gunslinger' && !isCustomStrelok) {
      if (chestBone) {
        const pack = createBackpackWithBedroll();
        pack.position.set(0, 0.22, -0.26);
        chestBone.add(pack);
      }
    } else if (safeClass === 'mage') {
      if (handL) {
        handL.add(createMagePotionFlask());
      }
    }

    const moveClipName = isCustomStrelok ? 'Walk' : 'Running_A';
    animCtrl = createAnimController(modelInstance, asset.clips, 'Idle', moveClipName);
  }

  function applyGunslingerArmPose() {
    if (safeClass !== 'gunslinger' || isCustomStrelok) return;
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
    if (isCustomStrelok) {
      const gunHex =
        currentWeaponId === 'gatling'
          ? 0x0284c7
          : currentWeaponId === 'blunderbuss'
            ? 0xea580c
            : 0x000000;
      const gunInt =
        currentWeaponId === 'gatling'
          ? 0.36
          : currentWeaponId === 'blunderbuss'
            ? 0.28
            : 0.0;
      for (const entry of aiGunMatEntries) {
        entry.baseEmissive = gunHex;
        entry.baseEmissiveInt = gunInt;
        if (!isBeast && flashTimer <= 0 && entry.mat.emissive) {
          entry.mat.emissive.setHex(gunHex);
          entry.mat.emissiveIntensity = gunInt;
        }
      }
      return;
    }
    if (mountedWeaponObj && mountedWeaponObj.parent) {
      mountedWeaponObj.parent.remove(mountedWeaponObj);
    }
    mountedWeaponObj = createHeroWeaponMesh(currentWeaponId, safeClass === 'mage' ? currentMageElement : null);
    if (safeClass === 'gunslinger' && gunCarryPivot) {
      gunCarryPivot.add(mountedWeaponObj);
    } else if (handR) {
      handR.add(mountedWeaponObj);
    }
  }

  function setElement(newElement) {
    if (!newElement || newElement === currentMageElement) return;
    currentMageElement = newElement;
    if (safeClass === 'mage') {
      setWeapon(currentWeaponId, currentMageElement);
    }
  }

  setWeapon(currentWeaponId);
  applyGunslingerArmPose();

  function setBeastMode(enabled) {
    isBeast = Boolean(enabled);
    beastRing.visible = isBeast;
    const beastScale = isBeast ? 1.78 : 1.0;
    if (modelInstance) {
      modelInstance.scale.setScalar(heroBaseScale * beastScale);
    }
    if (gunCarryPivot) {
      gunCarryPivot.scale.setScalar(beastScale);
      gunCarryPivot.position.set(
        GUN_PIVOT_BASE_X * beastScale,
        GUN_PIVOT_BASE_Y * beastScale,
        GUN_PIVOT_BASE_Z * beastScale
      );
    }
    const beastGlow = safeClass === 'warrior' ? 0xd9480f : safeClass === 'gunslinger' ? 0x2563eb : 0x9333ea;
    for (const item of instanceMats) {
      if (item.mat.emissive && item.baseEmissiveInt < 2.0) {
        item.mat.emissive.setHex(isBeast ? beastGlow : item.baseEmissive);
        item.mat.emissiveIntensity = isBeast ? 0.55 : item.baseEmissiveInt;
      }
    }
  }

  function setReloading(reloadingBool) {
    isReloadingState = Boolean(reloadingBool);
  }

  function playAttackAnim() {
    if (isCustomStrelok) {
      gunKickTimer = 0.24;
      aimHoldTimer = 0.55;
      animCtrl?.triggerOneShot('Shoot', 1.65);
      return;
    }
    if (safeClass === 'gunslinger') {
      gunKickTimer = 0.22;
      pumpCycleTimer = currentWeaponId === 'pistol' ? 0.36 : 0;
      return;
    }
    if (!animCtrl) return;
    if (safeClass === 'warrior') {
      const clip =
        currentWeaponId === 'flail'
          ? '2H_Melee_Attack_Spin'
          : currentWeaponId === 'cleaver'
            ? '2H_Melee_Attack_Slice'
            : '1H_Melee_Attack_Slice_Horizontal';
      animCtrl.triggerOneShot(clip, 1.85);
    } else {
      animCtrl.triggerOneShot('Spellcast_Shoot', 1.9);
    }
  }

  function flashHit() {
    flashTimer = 0.12;
    for (const item of instanceMats) {
      if (item.mat.emissive && item.baseEmissiveInt < 2.0) {
        item.mat.emissive.setHex(0xff3b30);
        item.mat.emissiveIntensity = 0.85;
      }
    }
  }

  function update(dt, isMoving = false, speedRatio = 1, elapsedTime = 0) {
    const safeDt = Math.min(Math.max(dt || 0.016, 0), 0.1);
    if (animCtrl) {
      if (isMoving) {
        if (isCustomStrelok) {
          animCtrl.setBaseState('Walk', Math.max(1.05, Math.min(2.2, speedRatio * 1.55)));
        } else {
          animCtrl.setBaseState(isBeast ? 'Running_B' : 'Running_A', Math.max(0.85, Math.min(1.8, speedRatio * 1.18)));
        }
      } else {
        animCtrl.setBaseState('Idle', 1.0);
      }
      animCtrl.mixer.update(safeDt);
    }

    if (isCustomStrelok && modelInstance) {
      if (gunKickTimer > 0) gunKickTimer = Math.max(0, gunKickTimer - safeDt);
      if (aimHoldTimer > 0) aimHoldTimer = Math.max(0, aimHoldTimer - safeDt);
      const targetReload = isReloadingState ? 1 : 0;
      reloadBlend += (targetReload - reloadBlend) * Math.min(1, safeDt * 12);
      const targetAim = aimHoldTimer > 0 ? 1 : 0;
      aimYawBlend += (targetAim - aimYawBlend) * Math.min(1, safeDt * 16);

      const kickRatio = gunKickTimer > 0 ? gunKickTimer / 0.24 : 0;
      const kickCurve = Math.sin(kickRatio * Math.PI * 0.88) * kickRatio;
      const reloadBob = reloadBlend > 0.01 ? Math.sin(elapsedTime * 15.0) * reloadBlend : 0;

      // Turn barrel along +Z firing line when shooting, relax to iconic 3/4 carry otherwise
      modelInstance.rotation.y = -0.68 * aimYawBlend + reloadBlend * 0.18;
      modelInstance.rotation.x = -kickCurve * 0.12 + reloadBlend * 0.14 + reloadBob * 0.05;
      modelInstance.position.z = -kickCurve * 0.14;
    }

    // Two-handed shotgun carry pose, crisp recoil kick, pump rack & reload tilt!
    if (safeClass === 'gunslinger' && gunCarryPivot) {
      const beastScale = isBeast ? 1.78 : 1.0;
      if (gunKickTimer > 0) {
        gunKickTimer = Math.max(0, gunKickTimer - safeDt);
      }
      if (pumpCycleTimer > 0) {
        pumpCycleTimer = Math.max(0, pumpCycleTimer - safeDt);
      }

      const targetReload = isReloadingState ? 1 : 0;
      reloadBlend += (targetReload - reloadBlend) * Math.min(1, safeDt * 12);

      // Smooth spring curve for recoil (peaks rapidly, eases cleanly back to 0)
      const kickRatio = gunKickTimer > 0 ? gunKickTimer / 0.22 : 0;
      const kickCurve = Math.sin(kickRatio * Math.PI * 0.88) * kickRatio * 1.18;

      const strideBobY = isMoving ? Math.abs(Math.sin(elapsedTime * 11.5)) * 0.022 : Math.sin(elapsedTime * 2.6) * 0.008;
      const reloadBob = reloadBlend > 0.01 ? Math.sin(elapsedTime * 16.0) * reloadBlend : 0;

      gunCarryPivot.scale.setScalar(beastScale);
      gunCarryPivot.position.set(
        GUN_PIVOT_BASE_X * beastScale,
        (GUN_PIVOT_BASE_Y + strideBobY + reloadBob * 0.024) * beastScale,
        (GUN_PIVOT_BASE_Z - kickCurve * 0.18 - reloadBlend * 0.04) * beastScale
      );
      gunCarryPivot.rotation.x = -kickCurve * 0.32 + reloadBlend * 0.25 + reloadBob * 0.075;
      gunCarryPivot.rotation.y = reloadBlend * -0.10;
      gunCarryPivot.rotation.z = reloadBlend * 0.45;

      // Subtle upper-torso recoil rock + forward two-handed grip on stock & forend
      if (chestBone && kickCurve > 0.01) {
        _recoilPitchQuat.setFromAxisAngle(_xAxis, -kickCurve * 0.14);
        chestBone.quaternion.multiply(_recoilPitchQuat);
      }
      applyGunslingerArmPose();

      // Mechanical pump forend slide on «Охотничье ружьё» & barrel cluster spin on «Шквал»
      const forend = mountedWeaponObj?.userData?.pumpForend;
      if (forend) {
        let pumpOffset = 0;
        if (pumpCycleTimer > 0 && pumpCycleTimer < 0.18) {
          pumpOffset = -Math.sin((pumpCycleTimer / 0.18) * Math.PI) * 0.09;
        }
        forend.position.z = (forend.userData.baseZ || 0.39) + pumpOffset;
      }
      const gatCluster = mountedWeaponObj?.userData?.gatlingCluster;
      if (gatCluster && gunKickTimer > 0) {
        gatCluster.rotation.z += safeDt * 18;
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
// 3. ENEMY SPECIALISTS & 5 MILESTONE ACT BOSSES FACTORY
// ============================================================================

const BOMBER_UPPER_ARM_L_Q = new THREE.Quaternion(-0.136, -0.396, -0.900, 0.123).normalize();
const BOMBER_LOWER_ARM_L_Q = new THREE.Quaternion(0, 0, -0.450, 0.893).normalize();
const BOMBER_UPPER_ARM_R_Q = new THREE.Quaternion(-0.136, 0.396, 0.900, 0.123).normalize();
const BOMBER_LOWER_ARM_R_Q = new THREE.Quaternion(0, 0, 0.450, 0.893).normalize();

function createHumanoidGlowingEyes(eyeHex, visorForward = false) {
  const grp = new THREE.Group();
  const eyeMat = getMat(`hum_eye_${eyeHex}`, () =>
    new THREE.MeshStandardMaterial({
      color: eyeHex,
      emissive: eyeHex,
      emissiveIntensity: 2.5,
      roughness: 0.15
    })
  );
  const eyeGeo = getGeo('hum_eye_sphere', () => new THREE.SphereGeometry(0.058, 8, 8));
  const zPos = visorForward ? 0.52 : 0.45;
  const yPos = visorForward ? 0.38 : 0.40;
  for (const sx of [-0.155, 0.155]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.scale.set(1.25, 0.78, 0.65);
    eye.position.set(sx, yPos, zPos);
    grp.add(eye);
  }
  return grp;
}

function createEnemyCrossbow() {
  const grp = new THREE.Group();
  const woodMat = getMat('cb_wood', () => new THREE.MeshStandardMaterial({ color: 0x4a2e1b, roughness: 0.74, metalness: 0.1 }));
  const steelMat = getMat('cb_steel', () => new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.82, roughness: 0.28 }));
  const stringMat = getMat('cb_string', () => new THREE.MeshBasicMaterial({ color: 0xcbd5e1 }));
  const boltMat = getMat('cb_bolt_cyan', () =>
    new THREE.MeshStandardMaterial({ color: 0xa5f3fc, emissive: 0x06b6d4, emissiveIntensity: 1.9, roughness: 0.2 })
  );

  // Stock / tiller pointing along +Z
  const tiller = new THREE.Mesh(getGeo('cb_tiller', () => new THREE.BoxGeometry(0.095, 0.11, 0.62)), woodMat);
  tiller.position.set(0, 0, 0.12);

  // Curved twin steel bow limbs at front (+Z)
  const limbGeo = getGeo('cb_limb', () => new THREE.BoxGeometry(0.40, 0.045, 0.065));
  const limbL = new THREE.Mesh(limbGeo, steelMat);
  limbL.position.set(0.20, 0.02, 0.36);
  limbL.rotation.y = 0.28;
  const limbR = new THREE.Mesh(limbGeo, steelMat);
  limbR.position.set(-0.20, 0.02, 0.36);
  limbR.rotation.y = -0.28;

  // Drawn bowstrings meeting at trigger lock
  const strGeo = getGeo('cb_str', () => {
    const cg = new THREE.CylinderGeometry(0.008, 0.008, 0.44, 6);
    cg.rotateZ(Math.PI / 2);
    return cg;
  });
  const strL = new THREE.Mesh(strGeo, stringMat);
  strL.position.set(0.19, 0.035, 0.17);
  strL.rotation.y = 0.62;
  const strR = new THREE.Mesh(strGeo, stringMat);
  strR.position.set(-0.19, 0.035, 0.17);
  strR.rotation.y = -0.62;

  // Glowing cyan bone bolt ready on the rail
  const boltShaft = new THREE.Mesh(
    getGeo('cb_bolt_shaft', () => {
      const cg = new THREE.CylinderGeometry(0.018, 0.018, 0.48, 6);
      cg.rotateX(Math.PI / 2);
      return cg;
    }),
    boltMat
  );
  boltShaft.position.set(0, 0.068, 0.28);
  const boltHead = new THREE.Mesh(
    getGeo('cb_bolt_tip', () => {
      const cg = new THREE.ConeGeometry(0.048, 0.14, 4);
      cg.rotateX(Math.PI / 2);
      return cg;
    }),
    boltMat
  );
  boltHead.position.set(0, 0.068, 0.56);

  grp.add(tiller, limbL, limbR, strL, strR, boltShaft, boltHead);
  return grp;
}

function createIronTowerShield() {
  const grp = new THREE.Group();
  const plateMat = getMat('ts_plate', () =>
    new THREE.MeshStandardMaterial({ color: 0x1e3a5f, metalness: 0.78, roughness: 0.30 })
  );
  const rimMat = getMat('ts_rim', () =>
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.86, roughness: 0.24 })
  );
  const runeMat = getMat('ts_rune', () =>
    new THREE.MeshStandardMaterial({ color: 0x93c5fd, emissive: 0x3b82f6, emissiveIntensity: 1.5, roughness: 0.2 })
  );

  // Heavy iron tower shield body + top/bottom beveled trim + ice-blue boss emblem
  const mainPlate = new THREE.Mesh(
    getGeo('ts_body', () => new THREE.BoxGeometry(0.68, 0.94, 0.075)),
    plateMat
  );
  const borderV = new THREE.Mesh(
    getGeo('ts_border_v', () => new THREE.BoxGeometry(0.74, 0.98, 0.045)),
    rimMat
  );
  borderV.position.z = -0.015;
  const crossV = new THREE.Mesh(
    getGeo('ts_cross_v', () => new THREE.BoxGeometry(0.08, 0.86, 0.09)),
    rimMat
  );
  crossV.position.z = 0.01;
  const crossH = new THREE.Mesh(
    getGeo('ts_cross_h', () => new THREE.BoxGeometry(0.62, 0.08, 0.09)),
    rimMat
  );
  crossH.position.set(0, 0.10, 0.01);
  const centerGem = new THREE.Mesh(
    getGeo('ts_gem', () => new THREE.OctahedronGeometry(0.13, 0)),
    runeMat
  );
  centerGem.scale.set(1, 1.35, 0.55);
  centerGem.position.set(0, 0.10, 0.055);

  grp.add(mainPlate, borderV, crossV, crossH, centerGem);
  grp.position.set(0.08, 0.04, 0.16);
  grp.rotation.y = 0.18;
  return grp;
}

function createVolatilePowderBarrel() {
  const grp = new THREE.Group();
  const charredWoodMat = getMat('pb_wood', () =>
    new THREE.MeshStandardMaterial({ color: 0x3b2316, roughness: 0.82, metalness: 0.08 })
  );
  const hoopMat = getMat('pb_hoop', () =>
    new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.82, roughness: 0.34 })
  );
  const glowRuneMat = new THREE.MeshStandardMaterial({
    color: 0xfdba74,
    emissive: 0xf97316,
    emissiveIntensity: 2.1,
    roughness: 0.2
  });
  const sparkMat = getMat('pb_spark', () =>
    new THREE.MeshBasicMaterial({ color: 0xfef08a, toneMapped: false })
  );

  const keg = new THREE.Mesh(
    getGeo('pb_keg', () => {
      const cg = new THREE.CylinderGeometry(0.23, 0.23, 0.48, 12);
      cg.rotateZ(Math.PI / 2);
      return cg;
    }),
    charredWoodMat
  );

  const hoopGeo = getGeo('pb_hoop_geo', () => {
    const tg = new THREE.TorusGeometry(0.235, 0.022, 6, 16);
    tg.rotateY(Math.PI / 2);
    return tg;
  });
  const hoopL = new THREE.Mesh(hoopGeo, hoopMat);
  hoopL.position.x = -0.15;
  const hoopR = new THREE.Mesh(hoopGeo, hoopMat);
  hoopR.position.x = 0.15;

  // Glowing volatile powder seams & hazard core
  const seamBand = new THREE.Mesh(
    getGeo('pb_seam', () => {
      const tg = new THREE.TorusGeometry(0.238, 0.020, 6, 16);
      tg.rotateY(Math.PI / 2);
      return tg;
    }),
    glowRuneMat
  );
  const frontRune = new THREE.Mesh(
    getGeo('pb_rune_oct', () => new THREE.OctahedronGeometry(0.11, 0)),
    glowRuneMat
  );
  frontRune.scale.set(1.1, 1.1, 0.45);
  frontRune.position.set(0, 0.02, 0.23);

  // Lit fuse + bright spark on top
  const fuse = new THREE.Mesh(
    getGeo('pb_fuse', () => new THREE.CylinderGeometry(0.018, 0.022, 0.16, 6)),
    hoopMat
  );
  fuse.position.set(0, 0.28, 0.04);
  fuse.rotation.z = -0.28;

  const spark = new THREE.Mesh(
    getGeo('pb_spark_oct', () => new THREE.OctahedronGeometry(0.075, 0)),
    sparkMat
  );
  spark.position.set(0.03, 0.37, 0.04);

  grp.add(keg, hoopL, hoopR, seamBand, frontRune, fuse, spark);
  grp.userData.glowRuneMat = glowRuneMat;
  grp.userData.spark = spark;
  return grp;
}

function createButcherHornedHelm() {
  const grp = new THREE.Group();
  const helmMat = getMat('butcher_helm_iron', () =>
    new THREE.MeshStandardMaterial({ color: 0x3f1515, metalness: 0.78, roughness: 0.32 })
  );
  const band = new THREE.Mesh(
    getGeo('butcher_helm_band', () => new THREE.CylinderGeometry(0.46, 0.48, 0.22, 14)),
    helmMat
  );
  band.position.y = 0.74;
  const hornL = createCurvedHorn(1, true);
  hornL.position.y = 0.66;
  const hornR = createCurvedHorn(-1, true);
  hornR.position.y = 0.66;
  grp.add(band, hornL, hornR);
  return grp;
}

function createRustedPotHelm() {
  const grp = new THREE.Group();
  const ironMat = getMat('skel_pothelm_iron', () =>
    new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.72, roughness: 0.38 })
  );
  const brassMat = getMat('skel_pothelm_brass', () =>
    new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.68, roughness: 0.42 })
  );
  const dome = new THREE.Mesh(
    getGeo('skel_pothelm_dome', () => new THREE.SphereGeometry(0.41, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52)),
    ironMat
  );
  dome.position.y = 0.64;
  const brim = new THREE.Mesh(
    getGeo('skel_pothelm_brim', () => new THREE.CylinderGeometry(0.43, 0.52, 0.08, 14)),
    ironMat
  );
  brim.position.y = 0.64;
  const band = new THREE.Mesh(
    getGeo('skel_pothelm_band', () => new THREE.CylinderGeometry(0.42, 0.43, 0.06, 12)),
    brassMat
  );
  band.position.y = 0.68;
  grp.add(dome, brim, band);
  return grp;
}

function createRustedBuckler() {
  const grp = new THREE.Group();
  const woodMat = getMat('skel_buckler_wood', () =>
    new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.82, metalness: 0.08 })
  );
  const rimMat = getMat('skel_buckler_rim', () =>
    new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.75, roughness: 0.36 })
  );
  const disc = new THREE.Mesh(
    getGeo('skel_buckler_disc', () => {
      const cg = new THREE.CylinderGeometry(0.32, 0.32, 0.06, 12);
      cg.rotateX(Math.PI / 2);
      return cg;
    }),
    woodMat
  );
  const boss = new THREE.Mesh(
    getGeo('skel_buckler_boss', () => new THREE.SphereGeometry(0.10, 8, 8)),
    rimMat
  );
  boss.position.z = 0.04;
  const rim = new THREE.Mesh(
    getGeo('skel_buckler_torus', () => new THREE.TorusGeometry(0.32, 0.036, 6, 14)),
    rimMat
  );
  grp.add(disc, boss, rim);
  grp.position.set(0.06, 0.04, 0.11);
  grp.rotation.y = 0.25;
  return grp;
}

function createAshlordCrown() {
  const grp = new THREE.Group();
  const crownGoldMat = getMat('ash_crown_gold', () =>
    new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xd97706,
      emissiveIntensity: 0.75,
      metalness: 0.88,
      roughness: 0.18
    })
  );
  const rubyMat = getMat('ash_crown_ruby', () =>
    new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xff3b00,
      emissiveIntensity: 2.4,
      roughness: 0.15
    })
  );

  // Forged golden circlet seated cleanly atop Skeleton_Warrior skull (y_local ~ 0.82)
  const circlet = new THREE.Mesh(
    getGeo('ash_crown_band', () => new THREE.CylinderGeometry(0.44, 0.40, 0.18, 16)),
    crownGoldMat
  );
  circlet.position.y = 0.84;

  const tallSpikeGeo = getGeo('ash_spike_tall', () => new THREE.ConeGeometry(0.085, 0.46, 4));
  const midSpikeGeo = getGeo('ash_spike_mid', () => new THREE.ConeGeometry(0.068, 0.30, 4));
  const gemGeo = getGeo('ash_crown_gem', () => new THREE.OctahedronGeometry(0.065, 0));

  const spikeCount = 8;
  for (let i = 0; i < spikeCount; i++) {
    const a = (i / spikeCount) * Math.PI * 2;
    const isTall = i % 2 === 0;
    const isFrontKingPeak = i === 0;
    const spike = new THREE.Mesh(isTall ? tallSpikeGeo : midSpikeGeo, crownGoldMat);
    const r = 0.40;
    spike.position.set(
      Math.sin(a) * r,
      0.93 + (isTall ? 0.20 : 0.12) + (isFrontKingPeak ? 0.08 : 0),
      Math.cos(a) * r
    );
    if (isFrontKingPeak) spike.scale.set(1.25, 1.28, 1.25);
    spike.rotation.y = a;
    // Slight outward regal flare
    spike.rotation.x = Math.cos(a) * 0.12;
    spike.rotation.z = -Math.sin(a) * 0.12;
    grp.add(spike);

    if (isTall) {
      const gem = new THREE.Mesh(gemGeo, rubyMat);
      gem.position.set(Math.sin(a) * 0.435, 0.85, Math.cos(a) * 0.435);
      grp.add(gem);
    }
  }

  return grp;
}

function createAshlordMagmaArmorCracks() {
  const grp = new THREE.Group();
  const magmaMat = getMat('ash_magma_veins', () =>
    new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xff4500,
      emissiveIntensity: 2.3,
      roughness: 0.18
    })
  );
  const coreHeart = new THREE.Mesh(
    getGeo('ash_chest_core', () => new THREE.OctahedronGeometry(0.14, 0)),
    magmaMat
  );
  coreHeart.scale.set(1.1, 1.35, 0.55);
  coreHeart.position.set(0, 0.20, 0.23);

  const ribGeo = getGeo('ash_magma_rib', () => new THREE.BoxGeometry(0.24, 0.032, 0.04));
  for (let r = -1; r <= 1; r++) {
    for (const side of [-1, 1]) {
      const vein = new THREE.Mesh(ribGeo, magmaMat);
      vein.position.set(side * 0.14, 0.20 + r * 0.075, 0.21);
      vein.rotation.z = side * -0.28;
      vein.rotation.y = side * -0.25;
      grp.add(vein);
    }
  }
  grp.add(coreHeart);
  return grp;
}

function makeEnemyWeaponProp(kind) {
  const g = new THREE.Group();
  const darkWoodMat = getMat('ew_wood', () => new THREE.MeshStandardMaterial({ color: 0x3b2416, roughness: 0.75, metalness: 0.1 }));
  const darkIronMat = getMat('ew_dark_iron', () => new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.78, roughness: 0.32 }));
  const rustedMat = getMat('ew_rusted', () => new THREE.MeshStandardMaterial({ color: 0x785a46, metalness: 0.62, roughness: 0.55 }));
  const steelMat = getMat('ew_steel', () => new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.82, roughness: 0.26 }));
  const goldMat = getMat('ew_gold', () => new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.86, roughness: 0.22 }));
  const boneMat = getMat('ew_bone', () => new THREE.MeshStandardMaterial({ color: 0xd6cfc2, roughness: 0.5, metalness: 0.1 }));

  if (kind === 'scythe') {
    const pole = new THREE.Mesh(
      getGeo('scythe_pole', () => new THREE.CylinderGeometry(0.045, 0.055, 2.5, 8)),
      getMat('scythe_pole_mat', () => new THREE.MeshStandardMaterial({ color: 0x1e1b2e, roughness: 0.6, metalness: 0.3 }))
    );
    pole.position.y = 0.75;
    g.add(pole);

    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(0.85, 0.22, 1.55, -0.32);
    shape.quadraticCurveTo(0.82, -0.05, 0, -0.22);
    shape.closePath();
    const bladeGeo = getGeo('scythe_blade', () =>
      new THREE.ExtrudeGeometry(shape, {
        depth: 0.04,
        bevelEnabled: true,
        bevelThickness: 0.018,
        bevelSize: 0.018,
        bevelSegments: 2
      })
    );
    const bladeMat = getMat('scythe_blade_mat', () =>
      new THREE.MeshStandardMaterial({
        color: 0xa5f3fc,
        emissive: 0x06b6d4,
        emissiveIntensity: 1.55,
        metalness: 0.65,
        roughness: 0.2
      })
    );
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.set(0, 1.88, -0.02);
    blade.rotation.y = Math.PI * 0.5;
    g.add(blade);
    return g;
  }

  if (kind === 'butcher_cleaver') {
    // Giant Blood-Soaked Butcher Cleaver
    const handle = new THREE.Mesh(
      getGeo('bc_handle', () => new THREE.CylinderGeometry(0.048, 0.055, 0.42, 8)),
      darkWoodMat
    );
    handle.position.y = 0.06;
    const guard = new THREE.Mesh(
      getGeo('bc_guard', () => new THREE.BoxGeometry(0.32, 0.08, 0.12)),
      darkIronMat
    );
    guard.position.y = 0.26;
    const cleaverMat = getMat('bc_blade_mat', () =>
      new THREE.MeshStandardMaterial({
        color: 0xd1d5db,
        emissive: 0x991b1b,
        emissiveIntensity: 0.55,
        metalness: 0.80,
        roughness: 0.26
      })
    );
    const bloodEdgeMat = getMat('bc_blood_edge', () =>
      new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xdc2626,
        emissiveIntensity: 1.35,
        roughness: 0.25
      })
    );
    const blade = new THREE.Mesh(
      getGeo('bc_blade', () => new THREE.BoxGeometry(0.36, 1.06, 0.055)),
      cleaverMat
    );
    blade.position.set(0.06, 0.82, 0);
    const bloodEdge = new THREE.Mesh(
      getGeo('bc_edge', () => new THREE.BoxGeometry(0.08, 1.08, 0.062)),
      bloodEdgeMat
    );
    bloodEdge.position.set(0.21, 0.82, 0);
    g.add(handle, guard, blade, bloodEdge);
    g.rotation.y = Math.PI * 0.5;
    return g;
  }

  if (kind === 'warden_hammer') {
    // Royal Cobalt-Gold Inquisitor Warhammer / Greatsword-Maul
    const shaft = new THREE.Mesh(
      getGeo('wh_shaft', () => new THREE.CylinderGeometry(0.046, 0.054, 1.68, 8)),
      darkIronMat
    );
    shaft.position.y = 0.62;
    const collar = new THREE.Mesh(
      getGeo('wh_collar', () => new THREE.CylinderGeometry(0.095, 0.08, 0.18, 8)),
      goldMat
    );
    collar.position.y = 1.25;
    const headBlock = new THREE.Mesh(
      getGeo('wh_head', () => new THREE.BoxGeometry(0.64, 0.34, 0.32)),
      getMat('wh_cobalt_mat', () =>
        new THREE.MeshStandardMaterial({
          color: 0x1e3a8a,
          emissive: 0x2563eb,
          emissiveIntensity: 0.65,
          metalness: 0.85,
          roughness: 0.22
        })
      )
    );
    headBlock.position.y = 1.44;
    const goldBand = new THREE.Mesh(
      getGeo('wh_gold_band', () => new THREE.BoxGeometry(0.68, 0.11, 0.35)),
      goldMat
    );
    goldBand.position.y = 1.44;
    const topSpike = new THREE.Mesh(
      getGeo('wh_spike', () => new THREE.ConeGeometry(0.085, 0.34, 6)),
      goldMat
    );
    topSpike.position.y = 1.76;
    g.add(shaft, collar, headBlock, goldBand, topSpike);
    g.rotation.y = Math.PI * 0.5;
    return g;
  }

  if (kind === 'necro_staff' || kind === 'archlich_staff') {
    const isBoss = kind === 'archlich_staff';
    const poleH = isBoss ? 1.95 : 1.62;
    const pole = new THREE.Mesh(
      getGeo(isBoss ? 'ns_pole_boss' : 'ns_pole', () => new THREE.CylinderGeometry(0.042, 0.052, poleH, 8)),
      darkWoodMat
    );
    pole.position.y = poleH * 0.36;

    const skull = new THREE.Mesh(
      getGeo('ns_skull', () => new THREE.SphereGeometry(0.14, 10, 10)),
      boneMat
    );
    skull.scale.set(0.95, 1.12, 0.95);
    skull.position.y = poleH * 0.82;

    const emeraldMat = getMat('ns_emerald_glow', () =>
      new THREE.MeshStandardMaterial({
        color: 0x6ee7b7,
        emissive: 0x10b981,
        emissiveIntensity: 2.1,
        roughness: 0.15
      })
    );
    const orb = new THREE.Mesh(
      getGeo(isBoss ? 'ns_orb_boss' : 'ns_orb', () => new THREE.OctahedronGeometry(isBoss ? 0.24 : 0.17, 0)),
      emeraldMat
    );
    orb.scale.set(0.88, 1.45, 0.88);
    orb.position.y = poleH * 0.82 + (isBoss ? 0.32 : 0.24);

    g.add(pole, skull, orb);
    if (isBoss) {
      const ring = new THREE.Mesh(
        getGeo('ns_lich_ring', () => new THREE.TorusGeometry(0.28, 0.025, 6, 18)),
        emeraldMat
      );
      ring.position.y = orb.position.y;
      g.add(ring);
    }
    return g;
  }

  if (kind === 'molten_greatsword') {
    // Act V Ultra-Boss «Владыка Вечного Пепла» Giant Molten Flaming Greatsword
    const hilt = new THREE.Mesh(
      getGeo('mg_hilt', () => new THREE.CylinderGeometry(0.055, 0.062, 0.48, 8)),
      darkIronMat
    );
    hilt.position.y = 0.05;
    const pommel = new THREE.Mesh(
      getGeo('mg_pommel', () => new THREE.OctahedronGeometry(0.10, 0)),
      goldMat
    );
    pommel.position.y = -0.20;

    const guard = new THREE.Mesh(
      getGeo('mg_guard', () => new THREE.BoxGeometry(0.66, 0.11, 0.16)),
      goldMat
    );
    guard.position.y = 0.28;

    const obsidianCore = new THREE.Mesh(
      getGeo('mg_core_blade', () => new THREE.BoxGeometry(0.22, 1.56, 0.075)),
      getMat('mg_obs_mat', () =>
        new THREE.MeshStandardMaterial({ color: 0x290909, emissive: 0x7c2d12, emissiveIntensity: 0.6, metalness: 0.75, roughness: 0.3 })
      )
    );
    obsidianCore.position.y = 1.10;

    const magmaEdgeMat = getMat('mg_magma_edge', () =>
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xff4500,
        emissiveIntensity: 2.35,
        roughness: 0.18
      })
    );
    const flameBlade = new THREE.Mesh(
      getGeo('mg_flame_blade', () => new THREE.BoxGeometry(0.36, 1.52, 0.042)),
      magmaEdgeMat
    );
    flameBlade.position.y = 1.10;

    const flameTip = new THREE.Mesh(
      getGeo('mg_flame_tip', () => {
        const cg = new THREE.ConeGeometry(0.20, 0.40, 4);
        cg.rotateY(Math.PI / 4);
        return cg;
      }),
      magmaEdgeMat
    );
    flameTip.scale.set(1, 1, 0.32);
    flameTip.position.y = 2.04;

    g.add(hilt, pommel, guard, obsidianCore, flameBlade, flameTip);
    g.rotation.x = 0.22;
    g.rotation.y = Math.PI * 0.5;
    return g;
  }

  // Default 'rusted_sword' / 'broadsword'
  const isBroad = kind === 'broadsword';
  const bladeLen = isBroad ? 1.02 : 0.86;
  const bladeW = isBroad ? 0.16 : 0.11;
  const grip = new THREE.Mesh(
    getGeo('ew_sw_grip', () => new THREE.CylinderGeometry(0.038, 0.042, 0.26, 8)),
    darkWoodMat
  );
  const cross = new THREE.Mesh(
    getGeo('ew_sw_cross', () => new THREE.BoxGeometry(isBroad ? 0.30 : 0.22, 0.06, 0.09)),
    darkIronMat
  );
  cross.position.y = 0.14;
  const blade = new THREE.Mesh(
    getGeo(`eblade_v2_${kind}`, () => new THREE.BoxGeometry(bladeW, bladeLen, 0.038)),
    isBroad ? steelMat : rustedMat
  );
  blade.position.y = bladeLen * 0.5 + 0.17;
  g.add(grip, cross, blade);
  g.rotation.x = 0.25;
  g.rotation.y = Math.PI * 0.5;
  return g;
}

const ENEMY_MODEL_CFG = {
  // === 8 Regular & Specialist Villains ===
  skeleton: {
    key: 'skel_minion',
    scale: 0.88,
    moveClip: 'Walking_D_Skeletons',
    atkClip: '1H_Melee_Attack_Slice_Horizontal',
    weapon: 'rusted_sword',
    tint: 0x3f6212,
    tintLerp: 0.44,
    eye: 0x84cc16
  },
  hound: {
    key: 'barbarian',
    scale: 0.82,
    moveClip: 'Running_B',
    atkClip: 'Dualwield_Melee_Attack_Slice',
    weapon: null, // Uses built-in dual 1H_Axe & 1H_Axe_Offhand!
    tint: 0x7f1d1d,
    tintLerp: 0.58,
    eye: 0xef4444,
    moveSpeedAnim: 1.38
  },
  archer: {
    key: 'skel_rogue',
    scale: 0.86,
    moveClip: 'Walking_A',
    atkClip: '2H_Ranged_Shoot',
    weapon: null, // Custom forward 3D Crossbow at chest!
    tint: 0x164e63,
    tintLerp: 0.64,
    eye: 0x22d3ee
  },
  shieldbearer: {
    key: 'skel_warrior',
    scale: 1.02,
    moveClip: 'Walking_B',
    atkClip: '1H_Melee_Attack_Slice_Horizontal',
    weapon: 'broadsword',
    tint: 0x1e3a5f,
    tintLerp: 0.62,
    eye: 0x60a5fa
  },
  bomber: {
    key: 'skel_minion',
    scale: 0.86,
    moveClip: 'Running_A',
    atkClip: 'Dualwield_Melee_Attack_Chop',
    weapon: null, // Pulsing volatile gunpowder barrel carried in front of chest!
    tint: 0x292524,
    tintLerp: 0.72,
    eye: 0xf97316,
    moveSpeedAnim: 1.32
  },
  necromancer: {
    key: 'skel_mage',
    scale: 0.94,
    moveClip: 'Walking_A',
    atkClip: 'Spellcast_Raise',
    weapon: 'necro_staff',
    tint: 0x064e3b,
    tintLerp: 0.70,
    eye: 0x10b981
  },
  cultist: {
    key: 'mage',
    scale: 0.90,
    moveClip: 'Walking_A',
    atkClip: 'Spellcast_Shoot',
    weapon: null, // Uses built-in 2H_Staff!
    tint: 0x3b0764,
    tintLerp: 0.62,
    eye: 0xc084fc
  },
  brute: {
    key: 'knight',
    scale: 1.28,
    moveClip: 'Walking_B',
    atkClip: '2H_Melee_Attack_Chop',
    weapon: null, // Uses built-in 2H_Sword!
    tint: 0x1e293b,
    tintLerp: 0.66,
    eye: 0xef4444
  },

  // === 5 Distinct Milestone Act Bosses ===
  boss_butcher: {
    key: 'barbarian',
    scale: 1.68,
    moveClip: 'Running_B',
    atkClip: 'Dualwield_Melee_Attack_Chop',
    weapon: 'butcher_cleaver',
    offhandWeapon: 'butcher_cleaver',
    tint: 0x7f1d1d,
    tintLerp: 0.66,
    eye: 0xef4444,
    isBossVisual: true,
    bossRingColor: 0xdc2626,
    bossRingScale: 1.75
  },
  boss_warden: {
    key: 'knight',
    scale: 1.82,
    moveClip: 'Walking_B',
    atkClip: '2H_Melee_Attack_Chop',
    weapon: 'warden_hammer',
    tint: 0x1e3a8a,
    tintLerp: 0.68,
    eye: 0x60a5fa,
    isBossVisual: true,
    bossRingColor: 0x2563eb,
    bossInnerRingColor: 0xfbbf24,
    bossRingScale: 1.85
  },
  boss_archlich: {
    key: 'skel_mage',
    scale: 1.88,
    moveClip: 'Walking_A',
    atkClip: 'Spellcast_Raise',
    weapon: 'archlich_staff',
    tint: 0x065f46,
    tintLerp: 0.72,
    eye: 0x34d399,
    isBossVisual: true,
    bossRingColor: 0x10b981,
    bossRingScale: 1.90
  },
  reaper: {
    key: 'skel_warrior',
    scale: 2.02,
    moveClip: 'Walking_A',
    atkClip: '2H_Melee_Attack_Slice',
    weapon: 'scythe',
    tint: 0x090d16,
    tintLerp: 0.80,
    eye: 0x22d3ee,
    isBossVisual: true,
    bossRingColor: 0x06b6d4,
    bossRingScale: 2.00
  },
  boss_ashlord: {
    key: 'skel_warrior',
    scale: 2.38,
    moveClip: 'Walking_B',
    atkClip: '2H_Melee_Attack_Slice',
    weapon: 'molten_greatsword',
    tint: 0x450a0a,
    tintLerp: 0.76,
    baseEmissive: 0xd9480f,
    baseEmissiveInt: 0.42,
    eye: 0xfbbf24,
    isBossVisual: true,
    bossRingColor: 0xef4444,
    bossInnerRingColor: 0xfbbf24,
    bossRingScale: 2.35
  }
};

const enemyMeshPool = new Map();

export function createEnemyMesh(typeId = 'skeleton', eliteVariant = null, customScaleMult = 1.0) {
  if (typeId && typeof typeId === 'object') {
    const opts = typeId;
    eliteVariant = opts.eliteVariant ?? opts.eliteType ?? opts.variant ?? null;
    customScaleMult = opts.customScaleMult ?? opts.scaleMult ?? 1.0;
    typeId = opts.typeId || opts.type || opts.enemyType || opts.id || 'skeleton';
  }

  const cfg = ENEMY_MODEL_CFG[typeId] || ENEMY_MODEL_CFG.skeleton;
  const rawMult = Number(customScaleMult);
  const validMult = Number.isFinite(rawMult) && rawMult > 0 ? rawMult : 1.0;
  const effectiveScaleMult =
    eliteVariant === 'miniboss' && Math.abs(validMult - 1.0) < 0.001 ? 0.72 : validMult;

  const canPool = eliteVariant !== 'warden' && !cfg.isBossVisual;
  const poolKey = `${typeId}|${eliteVariant || 'std'}|${effectiveScaleMult.toFixed(2)}`;
  if (canPool) {
    const bucket = enemyMeshPool.get(poolKey);
    if (bucket && bucket.length > 0) {
      const reused = bucket.pop();
      reused._markActive();
      return reused;
    }
  }

  const asset = gltfCache.get(cfg.key);
  const root = new THREE.Group();

  let animCtrl = null;
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

  let upperArmL = null;
  let lowerArmL = null;
  let upperArmR = null;
  let lowerArmR = null;
  let bomberBarrel = null;
  let archlichOrbit = null;
  const archlichCrystals = [];
  let stage1BreakNode = null; // ≤ 66% HP: Shield / Buckler / Offhand / Cloak detaches!
  let stage2BreakNode = null; // ≤ 33% HP: Helmet / Pot-Helm / Hood / Hat pops off!

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

    inst.traverse((n) => {
      const nm = n.name || '';
      if (/^handslot\.?r$/i.test(nm) || (!handR && /^hand\.?r$/i.test(nm))) handR = n;
      if (/^handslot\.?l$/i.test(nm) || (!handL && /^hand\.?l$/i.test(nm))) handL = n;
      if (/^head$/i.test(nm)) headBone = n;
      if (/^chest$/i.test(nm)) chestBone = n;
      if (/^upperarm\.?l$/i.test(nm)) upperArmL = n;
      if (/^lowerarm\.?l$/i.test(nm)) lowerArmL = n;
      if (/^upperarm\.?r$/i.test(nm)) upperArmR = n;
      if (/^lowerarm\.?r$/i.test(nm)) lowerArmR = n;

      // Capture detachable Stage 1 (Cloak / Offhand) & Stage 2 (Helmet / Hat / Hood) meshes on non-bosses!
      if (!cfg.isBossVisual) {
        if (
          nm === 'Skeleton_Warrior_Helmet' ||
          nm === 'Barbarian_Hat' ||
          nm === 'Skeleton_Rogue_Hood' ||
          nm === 'Skeleton_Mage_Hat' ||
          nm === 'Mage_Hat' ||
          nm === 'Knight_Helmet'
        ) {
          stage2BreakNode = n;
        }
        if (
          (typeId === 'hound' && nm === '1H_Axe_Offhand') ||
          (typeId === 'archer' && nm === 'Skeleton_Rogue_Cape') ||
          (typeId === 'cultist' && nm === 'Mage_Cape') ||
          (typeId === 'brute' && nm === 'Knight_Cape')
        ) {
          stage1BreakNode = n;
        }
      }

      // Clean up extra built-in KayKit props per villain/boss archetype
      if (nm === 'Mug' || nm === 'Spellbook_open' || nm === '1H_Wand') {
        n.visible = false;
      }
      if (typeId === 'hound') {
        // Keep 1H_Axe & 1H_Axe_Offhand visible!
        if (nm === '2H_Axe' || nm === 'Barbarian_Round_Shield') n.visible = false;
      } else if (typeId === 'boss_butcher') {
        if (nm === '2H_Axe' || nm === 'Barbarian_Round_Shield' || nm === '1H_Axe' || nm === '1H_Axe_Offhand' || nm === 'Barbarian_Hat') {
          n.visible = false;
        }
      } else if (typeId === 'brute') {
        // Keep 2H_Sword visible!
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
      } else if (typeId === 'boss_warden') {
        // Keep Spike_Shield visible in left hand + custom giant Inquisitor Warhammer in handR!
        if (
          nm === '1H_Sword' ||
          nm === '1H_Sword_Offhand' ||
          nm === '2H_Sword' ||
          nm === 'Round_Shield' ||
          nm === 'Badge_Shield' ||
          nm === 'Rectangle_Shield'
        ) {
          n.visible = false;
        }
      } else if (typeId === 'boss_ashlord') {
        // Hide standard horned helmet so the Golden Jagged King's Crown commands the silhouette!
        if (/Skeleton_Warrior_Helmet/i.test(nm)) {
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
              emissiveIntensity: cfg.isBossVisual ? 2.6 : 2.1,
              roughness: 0.15
            })
          );
          return;
        }
        const needsUniqueInstanceMat = typeId === 'boss_ashlord';
        const mapOneMat = (srcMat) => {
          let baseEm = cfg.baseEmissive || 0x000000;
          let baseEmInt = cfg.baseEmissiveInt || 0;
          if (eliteVariant === 'purple' || eliteVariant === 'blue') {
            baseEm = eliteVariant === 'purple' ? 0x6b21a8 : 0x0369a1;
            baseEmInt = Math.max(baseEmInt, 0.28);
          }
          const buildTinted = () => {
            const m = srcMat.clone();
            if (m.color && cfg.tint !== null) {
              m.color.lerp(new THREE.Color(cfg.tint), cfg.tintLerp ?? 0.55);
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
          return getMat(`enemy_tint_${typeId}_${eliteVariant || 'std'}_${srcMat.uuid}`, buildTinted);
        };
        const mapped = Array.isArray(n.material) ? n.material.map(mapOneMat) : mapOneMat(n.material);
        n.material = mapped;
        if (!needsUniqueInstanceMat) {
          flashMeshSlots.push({ mesh: n, origMat: mapped });
        }
      }
    });

    // Humanoid KayKit rigs (Barbarian, Knight, Mage) lack a separate Eyes mesh — add glowing eyes on head!
    if (!foundEyeMesh && headBone && cfg.eye) {
      const visorForward = cfg.key === 'knight';
      headBone.add(createHumanoidGlowingEyes(cfg.eye, visorForward));
    }

    // Primary & Off-hand Weapons
    if (handR && cfg.weapon) {
      handR.add(makeEnemyWeaponProp(cfg.weapon));
    }
    if (handL && cfg.offhandWeapon) {
      handL.add(makeEnemyWeaponProp(cfg.offhandWeapon));
    }

    // Archetype & Boss Signature Equipment
    if (typeId === 'skeleton') {
      if (handL) {
        const buckler = createRustedBuckler();
        handL.add(buckler);
        stage1BreakNode = buckler;
      }
      if (headBone) {
        const potHelm = createRustedPotHelm();
        headBone.add(potHelm);
        stage2BreakNode = potHelm;
      }
    } else if (typeId === 'archer') {
      const crossbow = createEnemyCrossbow();
      crossbow.position.set(0, 0.72 * effectiveScaleMult, 0.25 * effectiveScaleMult);
      crossbow.scale.setScalar(effectiveScaleMult);
      root.add(crossbow);
    } else if (typeId === 'shieldbearer' && handL) {
      const towerShield = createIronTowerShield();
      handL.add(towerShield);
      stage1BreakNode = towerShield;
    } else if (typeId === 'bomber') {
      bomberBarrel = createVolatilePowderBarrel();
      bomberBarrel.position.set(0, 0.78 * effectiveScaleMult, 0.30 * effectiveScaleMult);
      bomberBarrel.scale.setScalar(effectiveScaleMult);
      root.add(bomberBarrel);
    } else if (typeId === 'boss_butcher' && headBone) {
      headBone.add(createButcherHornedHelm());
    } else if (typeId === 'boss_archlich') {
      archlichOrbit = new THREE.Group();
      archlichOrbit.position.y = 1.28 * effectiveScaleMult;
      const crystalGeo = getGeo('lich_orbit_crystal', () => new THREE.OctahedronGeometry(0.20, 0));
      const crystalMat = getMat('lich_orbit_mat', () =>
        new THREE.MeshStandardMaterial({
          color: 0x6ee7b7,
          emissive: 0x10b981,
          emissiveIntensity: 2.3,
          roughness: 0.15
        })
      );
      const orbitR = 1.18 * effectiveScaleMult;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const shard = new THREE.Mesh(crystalGeo, crystalMat);
        shard.scale.set(0.85 * effectiveScaleMult, 1.45 * effectiveScaleMult, 0.85 * effectiveScaleMult);
        shard.position.set(Math.cos(a) * orbitR, 0, Math.sin(a) * orbitR);
        archlichOrbit.add(shard);
        archlichCrystals.push(shard);
      }
      root.add(archlichOrbit);
    } else if (typeId === 'boss_ashlord') {
      if (headBone) {
        headBone.add(createAshlordCrown());
      }
      if (chestBone) {
        chestBone.add(createAshlordMagmaArmorCracks());
      }
      if (handL) {
        handL.add(createSkullShield(true));
      }
    }

    animCtrl = createAnimController(inst, asset.clips, 'Idle', cfg.moveClip);
    animCtrl.mixer.update(Math.random() * 1.2);
  }

  // Clean Artistic Elite Indicator (ZERO flat red circles on Bosses; delicate feathered sigil + floating 3D crystal crest on Elites!)
  let halo = null;
  let innerBossHalo = null; // Kept null: Bosses stand cleanly on cobblestones without plastic rings!
  let eliteCrest = null;
  const eliteCrestBaseY = (cfg.scale || 0.9) * effectiveScaleMult * 2.18;

  if (!cfg.isBossVisual && (eliteVariant === 'purple' || eliteVariant === 'blue' || eliteVariant === 'warden')) {
    const crestColor =
      eliteVariant === 'purple' ? 0xc084fc : eliteVariant === 'warden' ? 0xfbbf24 : 0x38bdf8;
    const glowColor =
      eliteVariant === 'purple' ? 0x9333ea : eliteVariant === 'warden' ? 0xd97706 : 0x0284c7;

    // 1. Delicate feathered radial rune aura underfoot (soft additive glow, zero hard edges!)
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

    // 2. Crisp floating 3D Diamond Soul-Crest above Elite's head so player immediately reads Elite status!
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

  const handle = {
    root,
    _markActive() {
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
    playAttackAnim() {
      if (isDying) return;
      animCtrl?.triggerOneShot(cfg.atkClip, cfg.isBossVisual ? 1.42 : 1.65);
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
      if (spawnedInst) {
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
    update(dt, arg2, arg3) {
      const safeDt = Math.min(Math.max(dt || 0.016, 0), 0.1);
      const elapsedTime = typeof arg2 === 'boolean' ? (arg3 || 0) : (arg2 || 0);
      if (animCtrl && !isDying) {
        animCtrl.setBaseState(cfg.moveClip, cfg.moveSpeedAnim || 1.1);
        animCtrl.mixer.update(safeDt);
      }
      if (hitJoltTimer > 0 && spawnedInst && !isDying) {
        hitJoltTimer = Math.max(0, hitJoltTimer - safeDt);
        spawnedInst.rotation.x = -Math.sin((hitJoltTimer / 0.12) * Math.PI) * 0.24;
      } else if (spawnedInst && !isDying && spawnedInst.rotation.x !== 0) {
        spawnedInst.rotation.x = 0;
      }

      // Forward arm overrides for Crossbow Archer & Barrel-Carrying Bomber
      if (typeId === 'archer') {
        if (upperArmL) upperArmL.quaternion.slerp(GUN_UPPER_ARM_L_Q, 0.86);
        if (lowerArmL) lowerArmL.quaternion.slerp(GUN_LOWER_ARM_L_Q, 0.86);
        if (upperArmR) upperArmR.quaternion.slerp(GUN_UPPER_ARM_R_Q, 0.86);
        if (lowerArmR) lowerArmR.quaternion.slerp(GUN_LOWER_ARM_R_Q, 0.86);
      } else if (typeId === 'bomber') {
        if (upperArmL) upperArmL.quaternion.slerp(BOMBER_UPPER_ARM_L_Q, 0.88);
        if (lowerArmL) lowerArmL.quaternion.slerp(BOMBER_LOWER_ARM_L_Q, 0.88);
        if (upperArmR) upperArmR.quaternion.slerp(BOMBER_UPPER_ARM_R_Q, 0.88);
        if (lowerArmR) lowerArmR.quaternion.slerp(BOMBER_LOWER_ARM_R_Q, 0.88);
        if (bomberBarrel) {
          const pulse = 1 + Math.sin(elapsedTime * 12.0) * 0.10;
          bomberBarrel.scale.setScalar(effectiveScaleMult * pulse);
          if (bomberBarrel.userData.glowRuneMat) {
            bomberBarrel.userData.glowRuneMat.emissiveIntensity = 1.9 + Math.sin(elapsedTime * 16.0) * 0.75;
          }
          if (bomberBarrel.userData.spark) {
            bomberBarrel.userData.spark.rotation.y = elapsedTime * 14.0;
          }
        }
      } else if (typeId === 'boss_archlich' && archlichOrbit) {
        archlichOrbit.rotation.y = elapsedTime * 1.95;
        for (let i = 0; i < archlichCrystals.length; i++) {
          const c = archlichCrystals[i];
          c.position.y = Math.sin(elapsedTime * 4.2 + i * 1.57) * 0.14 * effectiveScaleMult;
          c.rotation.y = elapsedTime * 3.2 + i;
        }
      } else if (typeId === 'boss_ashlord' && flashTimer <= 0) {
        const magmaPulse = 0.36 + Math.sin(elapsedTime * 5.5) * 0.16;
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
  } else if (pickupType === 'supply_crate' || pickupType === 'companion_crate') {
    const isComp = pickupType === 'companion_crate';
    const chestAsset = gltfCache.get(isComp ? 'chest_gold' : 'chest');
    if (chestAsset?.scene) {
      const cloned = chestAsset.scene.clone(true);
      cloned.scale.setScalar(0.85);
      cloned.traverse((n) => {
        if (n.isMesh && n.material) {
          n.material = n.material.clone();
          if (isComp) n.material.color.lerp(new THREE.Color(0xa855f7), 0.35);
          damageMats.push(n.material);
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
    const goldChestAsset = gltfCache.get('chest_gold');
    if (goldChestAsset?.scene) {
      const cloned = goldChestAsset.scene.clone(true);
      cloned.scale.setScalar(1.05);
      cloned.traverse((n) => {
        if (n.isMesh) {
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
