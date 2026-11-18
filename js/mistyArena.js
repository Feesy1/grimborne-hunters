// Clean standalone arena scene: a painted ground plate with real 3D props
// placed on top. Used for chapters 6+ instead of the old courtyard.
import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';

const ARENA_HALF = 23;
const LAYOUT_KEY = 'grimborne_arena_layout_v1';

// Default arena layout — the map the user built in the in-game editor.
// Stored here (and duplicated in layout.json) so it ships with the game and
// doesn't depend on a particular browser's localStorage.
const DEFAULT_LAYOUT = [
  { key: 'arch', x: 0.1, z: -19.53, rot: 0 },
  { key: 'arch', x: 0.36, z: 19.86, rot: -3.14 },
  { key: 'wallFence', x: -6.49, z: 20, rot: 0 },
  { key: 'wallFence', x: 7.51, z: 19.91, rot: 0 },
  { key: 'ironWall', x: -11.99, z: 19.85, rot: 0 },
  { key: 'wallFence', x: -17.35, z: 20.01, rot: 0 },
  { key: 'wallFence', x: -20.85, z: 16.64, rot: -1.57 },
  { key: 'ironWall', x: -20.71, z: 11.08, rot: -1.57 },
  { key: 'ironWall', x: 12.95, z: 19.72, rot: 0 },
  { key: 'wallFence', x: 18.33, z: 19.87, rot: 0 },
  { key: 'wallFence', x: 20.86, z: 16.62, rot: -1.57 },
  { key: 'ironWall', x: 20.99, z: 11.28, rot: -1.57 },
  { key: 'wallFence', x: -20.86, z: 5.62, rot: -1.57 },
  { key: 'archBroken', x: -20.69, z: 0.25, rot: -4.71 },
  { key: 'wallFence', x: -20.9, z: -5.19, rot: -1.57 },
  { key: 'wallFence', x: -7.08, z: -19.43, rot: 0 },
  { key: 'wallFence', x: 6.76, z: -19.48, rot: 0 },
  { key: 'ironWall', x: 12.18, z: -19.41, rot: 0 },
  { key: 'wallFence', x: 17.67, z: -19.47, rot: 0 },
  { key: 'wallFence', x: 20.86, z: -16.02, rot: -1.57 },
  { key: 'ironWall', x: -12.5, z: -19.42, rot: 0 },
  { key: 'wallFence', x: -17.89, z: -19.53, rot: 0 },
  { key: 'wallFence', x: -20.95, z: -16.11, rot: -1.57 },
  { key: 'ironWall', x: -20.73, z: -10.69, rot: -1.57 },
  { key: 'ironWall', x: 20.76, z: -10.58, rot: -1.57 },
  { key: 'wallFence', x: 20.81, z: -5.15, rot: -1.57 },
  { key: 'archBroken', x: 20.74, z: 0.4, rot: -1.57 },
  { key: 'wallFence', x: 21.09, z: 5.91, rot: -1.57 },
  { key: 'tent', x: 18.45, z: 16.87, rot: -2.4 },
  { key: 'barrel', x: 19.27, z: 13.36, rot: 0 },
  { key: 'barrel', x: 19.41, z: 12.32, rot: 0 },
  { key: 'campfire', x: 14.58, z: 16.79, rot: 0 },
  { key: 'barrel', x: 17.26, z: 18.65, rot: 0 },
  { key: 'lantern', x: 15.95, z: 18.01, rot: -4.8 },
  { key: 'lantern', x: 19.52, z: 14.43, rot: -4.64 },
  { key: 'crate', x: 17.25, z: 12.58, rot: -3.2 },
  { key: 'campfire', x: 9.55, z: -11, rot: 0 },
  { key: 'ironWall', x: -7.63, z: -7.5, rot: 0.64 },
  { key: 'column', x: -9.21, z: -6.31, rot: 0 },
  { key: 'coffin', x: -9.79, z: 4.7, rot: -4.16 },
  { key: 'lantern', x: -8.98, z: 7, rot: 0.64 },
  { key: 'crate', x: -6.84, z: 6.11, rot: 0 },
  { key: 'barrel', x: -10.38, z: 1.28, rot: 0 },
  { key: 'barrel', x: 8.4, z: 8.56, rot: 0 },
  { key: 'barrel', x: 11.76, z: -4.27, rot: 0 },
  { key: 'barrel', x: 11.1, z: -5.1, rot: 0 },
  { key: 'barrel', x: 4.8, z: -15.4, rot: 0 },
  { key: 'barrel', x: 2.02, z: -5.94, rot: 0 },
  { key: 'crate', x: 10.49, z: -3.83, rot: -1.12 },
  { key: 'lantern', x: 12.96, z: -4.99, rot: -2.56 },
  { key: 'ironWall', x: -7.37, z: -10.19, rot: -0.8 },
  { key: 'column', x: -8.74, z: -11.66, rot: 0 },
  { key: 'lantern', x: -4.9, z: -12.99, rot: 0 },
  { key: 'barrel', x: -18.31, z: 16.86, rot: 0 },
  { key: 'crate', x: -16.71, z: 15.45, rot: 0.8 },
  { key: 'coffin', x: 12.39, z: 2.3, rot: -2.08 }
];
const PLATE_YAW = Math.PI / 4;
const MODEL_DIR = './assets/env/misty_graveyard/';
const MODEL_FILES = {
  arch: 'gen_arch.glb',
  archBroken: 'gen_arch_broken.glb',
  tent: 'gen_tent.glb',
  campfire: 'gen_campfire.glb',
  coffin: 'gen_coffin.glb',
  column: 'gen_column.glb',
  ruin: 'gen_ruin.glb',
  wall: 'gen_wall.glb',
  wallFence: 'gen_wall_fence.glb',
  ironWall: 'gen_iron_wall.glb',
  lantern: 'gen_lantern.glb',
  crate: 'gen_crate.glb',
  barrel: 'gen_barrel.glb'
};
const TARGET_HEIGHTS = {
  arch: 6.0, archBroken: 4.1, tent: 2.6,
  campfire: 0.7, coffin: 1.2, column: 3.2, ruin: 3.0,
  wall: 3.0, wallFence: 1.5, ironWall: 1.9, lantern: 3.6, crate: 1.2, barrel: 1.1
};

export function createMistyArena() {
  const group = new THREE.Group();
  group.visible = false;
  group.rotation.y = PLATE_YAW;

  // The image already contains the fence, torches, trees and fog around the
  // edge, so we only add the interactive/central props on top of it.
  const px = (u) => ((u - 50) / 50) * (ARENA_HALF - 4);
  const pz = (v) => ((v - 50) / 50) * (ARENA_HALF - 4);

  const templates = new Map();
  const props = [];

  function spawnProp(key, x = 0, z = 0, rot = 0, scale = 1) {
    const tpl = templates.get(key);
    if (!tpl) return null;
    const inst = tpl.clone(true);
    const base = tpl.scale.x || 1;
    const baseY = tpl.position.y || 0;
    inst.position.set(x, baseY * scale, z);
    inst.rotation.y = rot;
    inst.scale.setScalar(base * scale);
    if (key === 'wallFence') { inst.scale.x *= 1.5; inst.scale.z *= 1.5; }
    else if (key === 'ironWall') { inst.scale.x *= 1.8; inst.scale.z *= 1.8; }
    inst.userData.arenaKey = key;
    group.add(inst);
    props.push(inst);
    return inst;
  }

  function removeProp(obj) {
    const i = props.indexOf(obj);
    if (i >= 0) props.splice(i, 1);
    if (obj.parent) obj.parent.remove(obj);
  }

  function snapshot() {
    return props.map((p) => ({
      key: p.userData.arenaKey,
      x: +p.position.x.toFixed(2),
      z: +p.position.z.toFixed(2),
      rot: +p.rotation.y.toFixed(2)
    }));
  }

  function saveLayout() {
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(snapshot())); } catch {}
  }

  function loadLayout() {
    let items = null;
    try {
      const raw = localStorage.getItem(LAYOUT_KEY);
      if (raw) items = JSON.parse(raw);
    } catch {}
    // Fall back to the shipped default layout when there is no saved layout.
    if (!items || !Array.isArray(items)) items = DEFAULT_LAYOUT;
    for (const p of [...props]) removeProp(p);
    let placed = 0;
    for (const it of items) {
      if (spawnProp(it.key, it.x, it.z, it.rot || 0, 1)) placed++;
    }
    return placed;
  }

  const ready = (async () => {
    // --- Painted ground plate ------------------------------------------------
    const plateTex = await new Promise((resolve) => {
      new THREE.TextureLoader().load(
        MODEL_DIR + 'arena_plate.png',
        (t) => {
          t.colorSpace = THREE.SRGBColorSpace;
          t.anisotropy = 8;
          t.wrapS = THREE.RepeatWrapping;
          t.wrapT = THREE.RepeatWrapping;
          t.repeat.set(7, 7);
          resolve(t);
        },
        undefined,
        () => resolve(null)
      );
    });
    if (plateTex) {
      const plate = new THREE.Mesh(
        new THREE.PlaneGeometry(ARENA_HALF * 2, ARENA_HALF * 2),
        new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.92, metalness: 0.0 })
      );
      plate.rotation.x = -Math.PI / 2;
      plate.position.y = 0.01;
      plate.receiveShadow = true;
      group.add(plate);
    }

    // --- 3D props from the generated models ---------------------------------
    const loader = new GLTFLoader();
    await Promise.all(Object.entries(MODEL_FILES).map(([key, file]) =>
      new Promise((resolve) => {
        loader.load(MODEL_DIR + file, (gltf) => {
          const root = gltf.scene;
          const box = new THREE.Box3().setFromObject(root);
          const h = box.getSize(new THREE.Vector3()).y || 1;
          const s = (TARGET_HEIGHTS[key] || 2) / h;
          root.scale.setScalar(s);
          const box2 = new THREE.Box3().setFromObject(root);
          root.position.y -= box2.min.y;
          templates.set(key, root);
          resolve();
        }, undefined, () => resolve());
      })
    ));

    // Restore the editor layout saved by the previous session, if any.
    loadLayout();

    function placeAt(key, x, z, rot = 0, scale = 1) {
      spawnProp(key, x, z, rot, scale);
    }

    function place(key, u, v, rot = 0, scale = 1) {
      placeAt(key, px(u), pz(v), rot, scale);
    }

    // Default props are disabled — the arena starts completely empty (only
    // the floor texture remains). Add models from the in-game editor.
    if (false) {
    // Interior layout: small arches, portal, camp, cover and landmarks.
    for (const [u, v, r] of [[23, 20, -0.26], [85, 20, 0], [24, 72, 0.26], [91, 49, -0.26]]) {
      place('archBroken', u, v, r, 1.0);
    }
    place('tent', 12, 34, 0.15, 1.0);
    for (const [u, v] of [[17, 39], [70, 45], [35, 75]]) {
      place('campfire', u, v, 0, 1.0);
    }
    for (const [u, v] of [[28, 43], [64, 44], [62, 28], [42, 76]]) {
      place('column', u, v, 0, 1.0);
    }
    // Lantern posts scattered around the open fighting space.
    for (const [u, v] of [[12, 54], [45, 15], [55, 15], [28, 34], [87, 27], [35, 80], [70, 70], [18, 67]]) {
      place('lantern', u, v, 0, 1.0);
    }
    place('ruin', 55, 20, 0.4, 1.0);
    place('wall', 20, 25, 0.2, 1.0);
    place('wall', 76, 60, -0.5, 1.0);


    // Perimeter: mostly broken stone wall, occasionally an iron-topped wall,
    // and exactly four big banner arches at north/south/east/west. The arches
    // face outward (rotated 180°) relative to the rest of the fence.
    const segments = 40;
    const rim = ARENA_HALF - 1.4;
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const x = Math.cos(a) * rim;
      const z = Math.sin(a) * rim;
      const rot = -a + Math.PI / 2;
      if (i % 10 === 0) {
        placeAt('arch', x, z, rot + Math.PI, 1.0);
      } else if (i % 7 === 0) {
        placeAt('ironWall', x, z, rot, 1.0);
      } else {
        placeAt('wallFence', x, z, rot, 1.0);
      }
    }

    // --- Centre composition (matches the reference screenshot) -------------
    // Ruined arch upper-left, column cluster upper-right, low fence and
    // barrels on the left, coffin with red plants lower-right, small arch
    // lower-left. The middle stays open for the hero and combat.
    placeAt('archBroken', -6.0, -5.5, 0.45, 0.85);
    placeAt('column', 5.5, -6.0, 0, 0.9);
    placeAt('column', 7.5, -3.5, 0.2, 0.7);
    placeAt('crate', 12.0, -9.0, -0.3, 0.9);
    placeAt('wall', -9.5, 0.5, Math.PI / 2, 0.65);
    placeAt('column', -11.0, 0.0, 0, 0.85);
    placeAt('barrel', -8.0, 3.2, 0, 0.9);
    placeAt('barrel', -9.2, 4.4, 0.2, 0.8);
    placeAt('coffin', 6.8, 6.5, 0.25, 1.0);
    placeAt('column', 9.8, 4.5, 0, 0.85);
    placeAt('archBroken', -8.5, 8.5, -0.3, 0.75);
    placeAt('lantern', -5.5, 5.5, 0, 0.8);

    // A few warm point lights for the fire pits (kept low for mobile FPS).
    for (const [u, v] of [[17, 39], [70, 45]]) {
      const light = new THREE.PointLight(0xff8a3d, 2.4, 15, 1.45);
      light.position.set(px(u), 1.2, pz(v));
      group.add(light);
    }
    }
  })();

  return {
    group,
    ready,
    spawn: spawnProp,
    remove: removeProp,
    clear: () => { for (const p of [...props]) removeProp(p); },
    list: snapshot,
    saveLayout,
    loadLayout,
    templateKeys: () => Object.keys(MODEL_FILES)
  };
}
