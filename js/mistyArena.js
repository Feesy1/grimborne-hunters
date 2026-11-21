// Clean standalone Misty Forest arena scene (chapters 6+):
// Reference-matched gothic graveyard courtyard with painted cobblestone plate,
// 3D perimeter/interior props, glowing purple runic portal, blazing campfire,
// warm flickering lanterns, outer gnarled dead trees, and rolling violet mist.
// Strictly lazy-loaded via ensureLoaded() on first entry into 'misty_forest'.
import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { DRACOLoader } from '../vendor/DRACOLoader.js';
import { createBloomHaloTexture } from './world/textures.js?v=20261121z68';

const sharedDracoLoader = new DRACOLoader();
sharedDracoLoader.setDecoderPath('./vendor/draco/');

// Visual themes for chapters 6–15 (Misty Forest — exact reference look),
// 16–20 (Frost Ruins — icy turquoise mist, frost-lit portal & glacial floor),
// and 21–25 (Ash Citadel — charred volcanic floor, crimson-fiery mist & hellfire portal).
const BIOME_THEMES = {
  misty_forest: {
    plateColor: 0xf4eeff,
    plateEmissive: 0x2c2242,
    plateEmissiveIntensity: 0.55,
    mistPerimeter: [0xc048ff, 0xa335eb, 0x8b2fc9],
    mistPortal: 0xd946ef,
    mistInterior: 0xb43ff5,
    portalRune: 0xf5d0fe,
    portalHalo: 0xa855f7,
    portalBloom: 0xc084fc,
    portalBloomOpacity: 0.42,
    portalFloor: 0xc026d3,
    portalSpark: 0xe879f9,
    portalLight: 0xb84dff,
    treeColor: 0x4a3d63,
    bushColor: 0x8e2444,
    bushEmissive: 0x260814,
    bushEmissiveIntensity: 0.45,
    slimeColor: 0xffffff,
    slimeOpacity: 0.72,
    lanternCore: 0xfff3b0,
    lanternHalo: 0xff8c24,
    lanternBloom: 0xff9b38,
    lanternBloomOpacity: 0.34,
    lanternLight: 0xff9b38
  },
  frost_ruins: {
    plateColor: 0xd6f3ff,
    plateEmissive: 0x16384d,
    plateEmissiveIntensity: 0.58,
    mistPerimeter: [0x38e8ff, 0x22c8e8, 0x1aa6d6],
    mistPortal: 0x67f2ff,
    mistInterior: 0x38bdf8,
    portalRune: 0xe0fbff,
    portalHalo: 0x22d3ee,
    portalBloom: 0x67f2ff,
    portalBloomOpacity: 0.56,
    portalFloor: 0x06b6d4,
    portalSpark: 0xa5f3fc,
    portalLight: 0x38e4ff,
    treeColor: 0x4c718a,
    bushColor: 0x3b7a94,
    bushEmissive: 0x0d2c3d,
    bushEmissiveIntensity: 0.50,
    slimeColor: 0x67e8f9,
    slimeOpacity: 0.55,
    lanternCore: 0xe0f7ff,
    lanternHalo: 0x38bdf8,
    lanternBloom: 0x7dd3fc,
    lanternBloomOpacity: 0.40,
    lanternLight: 0x7dd3fc
  },
  ash_citadel: {
    plateColor: 0xc9b4b0,
    plateEmissive: 0x3d120e,
    plateEmissiveIntensity: 0.54,
    mistPerimeter: [0xff4518, 0xdc2626, 0x991b1b],
    mistPortal: 0xff5a1f,
    mistInterior: 0xe11d48,
    portalRune: 0xffedd5,
    portalHalo: 0xff4500,
    portalBloom: 0xff5a1f,
    portalBloomOpacity: 0.58,
    portalFloor: 0xdc2626,
    portalSpark: 0xfb923c,
    portalLight: 0xff3b14,
    treeColor: 0x382324,
    bushColor: 0xb91c1c,
    bushEmissive: 0x5c1008,
    bushEmissiveIntensity: 0.72,
    slimeColor: 0xff5a12,
    slimeOpacity: 0.85,
    lanternCore: 0xfef08a,
    lanternHalo: 0xff4500,
    lanternBloom: 0xff6b1a,
    lanternBloomOpacity: 0.42,
    lanternLight: 0xff5a1f
  }
};

const ARENA_HALF = 23;
const LAYOUT_KEY = 'grimborne_arena_layout_v2';

// Reference-matched arena layout in group-local coordinates:
// With PLATE_YAW = PI/4 and standard combat camera orbitYaw = PI/4:
//   -X = left, +X = right, -Z = top, +Z = bottom, (0, 0) = wide-open hero plaza.
// Excludes zombies and treasure chests (spawned dynamically by combat.js).
const DEFAULT_LAYOUT = [
  // --- Top center: main gate arch, flanking warm lanterns & side walls -------
  { key: 'arch',       x: 0.0,   z: -19.2, rot: 0.0 },
  { key: 'lantern',    x: -3.4,  z: -17.7, rot: 0.25,  scale: 0.92 },
  { key: 'lantern',    x: 3.4,   z: -17.7, rot: 2.89,  scale: 0.92 },
  { key: 'wallFence',  x: -7.4,  z: -18.0, rot: 0.28 },
  { key: 'ruin',       x: -11.6, z: -16.2, rot: 0.58 },
  { key: 'wallFence',  x: 7.4,   z: -18.0, rot: -0.28 },
  { key: 'ruin',       x: 11.4,  z: -16.4, rot: -0.56 },

  // --- Top-right corner: glowing purple runic portal on steps & right wall ---
  { key: 'portal',     x: 14.8,  z: -12.6, rot: -0.78 },
  { key: 'barrel',     x: 11.3,  z: -14.6, rot: 0.0 },
  { key: 'wall',       x: 18.2,  z: -8.4,  rot: -1.18 },
  { key: 'ironWall',   x: 19.2,  z: -4.0,  rot: -1.48 },
  { key: 'archBroken', x: 18.8,  z: 1.4,   rot: -1.52 },
  { key: 'wallFence',  x: 17.8,  z: 7.2,   rot: -1.92 },
  { key: 'lantern',    x: 15.4,  z: 9.0,   rot: -2.25, scale: 0.92 },
  { key: 'ironWall',   x: 14.4,  z: 13.0,  rot: -2.36 },
  { key: 'wallFence',  x: 10.4,  z: 16.8,  rot: -2.72 },

  // --- Top-left arch & left camp: red tent, blazing campfire & wooden crates -
  { key: 'archBroken', x: -14.6, z: -13.2, rot: 0.78 },
  { key: 'lantern',    x: -12.8, z: -11.2, rot: 0.65,  scale: 0.92 },
  { key: 'wallFence',  x: -18.6, z: -8.4,  rot: 1.24 },
  { key: 'tent',       x: -15.8, z: -4.2,  rot: 1.12 },
  { key: 'campfire',   x: -12.4, z: -2.2,  rot: 0.0 },
  { key: 'wallFence',  x: -19.4, z: -0.4,  rot: 1.57 },
  { key: 'crate',      x: -16.4, z: 1.9,   rot: 0.35,  scale: 0.95 },
  { key: 'crate',      x: -15.5, z: 4.2,   rot: -0.45, scale: 0.9 },
  { key: 'ironWall',   x: -18.6, z: 6.0,   rot: 1.86 },
  { key: 'lantern',    x: -16.0, z: 7.6,   rot: 0.2,   scale: 0.92 },

  // --- Bottom-left arch & south entrance gate with stone piers & fences ------
  { key: 'wall',       x: -16.2, z: 10.6,  rot: 2.16 },
  { key: 'archBroken', x: -12.6, z: 14.2,  rot: 2.38 },
  { key: 'lantern',    x: -9.8,  z: 15.0,  rot: -0.45, scale: 0.92 },
  { key: 'ironWall',   x: -6.6,  z: 18.2,  rot: 2.96 },
  { key: 'column',     x: -3.1,  z: 18.2,  rot: 0.0,   scale: 0.95 },
  { key: 'lantern',    x: -2.4,  z: 16.9,  rot: 0.4,   scale: 0.92 },
  { key: 'column',     x: 3.1,   z: 18.2,  rot: 0.0,   scale: 0.95 },
  { key: 'lantern',    x: 2.4,   z: 16.9,  rot: 2.74,  scale: 0.92 },
  { key: 'ironWall',   x: 6.6,   z: 18.2,  rot: -2.96 },

  // --- Interior landmarks (wide-open central battle plaza around 0,0) --------
  // Upper-left of center: ruined archway + stone marker
  { key: 'archBroken', x: -5.4,  z: -4.8,  rot: -0.28, scale: 0.82 },
  { key: 'rubble',     x: -7.4,  z: -3.8,  rot: 0.4,   scale: 0.9 },
  // Upper-right of center: fluted column + gravestone marker
  { key: 'column',     x: 5.8,   z: -4.8,  rot: 0.1,   scale: 0.95 },
  { key: 'rubble',     x: 4.6,   z: -3.5,  rot: -0.35, scale: 0.85 },
  // Lower-right of center: carved coffin + tall column
  { key: 'coffin',     x: 4.8,   z: 6.2,   rot: -0.52 },
  { key: 'column',     x: 7.4,   z: 4.2,   rot: 0.2,   scale: 0.95 },
  // Lower-left of center: broken column + iron fence + stone + barrel pair
  { key: 'column',     x: -9.6,  z: 2.2,   rot: 0.0,   scale: 0.88 },
  { key: 'fence',      x: -11.6, z: 3.2,   rot: 0.22,  scale: 0.85 },
  { key: 'rubble',     x: -8.2,  z: 4.7,   rot: 0.25,  scale: 0.85 },
  { key: 'barrel',     x: -6.9,  z: 5.6,   rot: 0.0 },
  { key: 'barrel',     x: -5.9,  z: 5.1,   rot: 0.4,   scale: 0.92 }
];

const PLATE_YAW = Math.PI / 4;
const COS_PLATE = Math.cos(PLATE_YAW);
const SIN_PLATE = Math.sin(PLATE_YAW);
const MODEL_DIR = './assets/env/misty_graveyard/';
const MODEL_FILES = {
  arch: 'gen_arch.glb',
  archBroken: 'gen_arch_broken.glb',
  portal: 'gen_portal.glb',
  tent: 'gen_tent.glb',
  campfire: 'gen_campfire.glb',
  coffin: 'gen_coffin.glb',
  column: 'gen_column.glb',
  ruin: 'gen_ruin.glb',
  wall: 'gen_wall.glb',
  wallFence: 'gen_wall_fence.glb',
  ironWall: 'gen_iron_wall.glb',
  fence: 'gen_fence.glb',
  lantern: 'gen_lantern.glb',
  crate: 'gen_crate.glb',
  barrel: 'gen_barrel.glb',
  rubble: 'gen_rubble.glb'
};
const TARGET_HEIGHTS = {
  arch: 6.0,
  archBroken: 4.1,
  portal: 4.2,
  tent: 2.6,
  campfire: 0.72,
  coffin: 1.2,
  column: 3.2,
  ruin: 3.0,
  wall: 3.0,
  wallFence: 1.5,
  ironWall: 1.9,
  fence: 1.85,
  lantern: 3.4,
  crate: 1.2,
  barrel: 1.1,
  rubble: 1.35
};

// Lightweight outer-framing assets (already shipped in assets/env/, ~80 KB total)
// loaded lazily alongside mistyArena props for the gnarled outer forest & top banners.
const FRAMING_FILES = {
  treeLarge: './assets/env/tree_dead_large_decorated.gltf',
  treeMed: './assets/env/tree_dead_medium.gltf',
  bannerRed: './assets/env/banner_patternA_red.gltf.glb?v=20261120z34'
};

// Local-space circular collider footprints matched to each GLB's waist-height bounds.
// Using overlapping circles along each elongated prop's local X axis keeps colliders
// exact under arbitrary prop rotations + PLATE_YAW (45 deg) without diagonal AABB bloat.
const PROP_COLLIDER_SHAPES = {
  arch: [
    { lx: -2.45, lz: 0, r: 1.1 },
    { lx: 2.45, lz: 0, r: 1.1 }
  ],
  archBroken: [
    { lx: -1.4, lz: 0, r: 0.62 },
    { lx: 1.25, lz: 0, r: 0.62 }
  ],
  portal: [
    { lx: -1.75, lz: 0.1, r: 1.05 },
    { lx: 0, lz: -0.35, r: 1.25 },
    { lx: 1.75, lz: 0.1, r: 1.05 }
  ],
  wallFence: [
    { lx: -3.05, lz: 0, r: 0.72 },
    { lx: -1.83, lz: 0, r: 0.72 },
    { lx: -0.61, lz: 0, r: 0.72 },
    { lx: 0.61, lz: 0, r: 0.72 },
    { lx: 1.83, lz: 0, r: 0.72 },
    { lx: 3.05, lz: 0, r: 0.72 }
  ],
  ironWall: [
    { lx: -1.9, lz: 0, r: 0.72 },
    { lx: -0.95, lz: 0, r: 0.72 },
    { lx: 0, lz: 0, r: 0.72 },
    { lx: 0.95, lz: 0, r: 0.72 },
    { lx: 1.9, lz: 0, r: 0.72 }
  ],
  fence: [
    { lx: -1.18, lz: 0, r: 0.48 },
    { lx: 0, lz: 0, r: 0.48 },
    { lx: 1.18, lz: 0, r: 0.48 }
  ],
  wall: [
    { lx: -0.82, lz: 0, r: 0.62 },
    { lx: 0, lz: 0, r: 0.62 },
    { lx: 0.82, lz: 0, r: 0.62 }
  ],
  ruin: [
    { lx: -0.82, lz: 0, r: 0.62 },
    { lx: 0, lz: 0, r: 0.62 },
    { lx: 0.82, lz: 0, r: 0.62 }
  ],
  tent: [
    { lx: -0.38, lz: 0, r: 1.32 },
    { lx: 0.32, lz: 0, r: 1.32 }
  ],
  coffin: [
    { lx: -0.68, lz: 0, r: 0.76 },
    { lx: 0.68, lz: 0, r: 0.76 }
  ],
  crate: [
    { lx: -0.28, lz: 0, r: 0.72 },
    { lx: 0.64, lz: 0, r: 0.72 }
  ],
  column: [{ lx: 0, lz: 0, r: 0.62 }],
  barrel: [{ lx: 0, lz: 0, r: 0.45 }],
  lantern: [{ lx: -0.3, lz: 0, r: 0.38 }],
  campfire: [{ lx: 0, lz: 0, r: 0.85 }],
  rubble: [{ lx: 0, lz: 0, r: 0.38 }]
};
const PASSABLE_PROP_KEYS = new Set(['moss', 'grass', 'bones', 'slime', 'path', 'bush']);

function readLayoutItems() {
  let items = null;
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (raw) items = JSON.parse(raw);
  } catch {}
  return Array.isArray(items) ? items : DEFAULT_LAYOUT;
}

// ============================================================================
// Procedural Textures (created lazily inside ensureLoaded(), ZERO boot cost!)
// ============================================================================
function createMistyCloudTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const lobes = [
    [0.50, 0.50, 0.46, 0.54],
    [0.34, 0.46, 0.35, 0.42],
    [0.66, 0.54, 0.36, 0.42],
    [0.46, 0.34, 0.31, 0.34],
    [0.55, 0.66, 0.33, 0.34],
    [0.31, 0.61, 0.25, 0.26],
    [0.69, 0.38, 0.25, 0.26]
  ];
  for (const [ux, uy, ur, alpha] of lobes) {
    const lx = ux * size;
    const ly = uy * size;
    const lr = ur * size;
    const g = ctx.createRadialGradient(lx, ly, 2, lx, ly, lr);
    g.addColorStop(0.0, `rgba(255, 255, 255, ${alpha})`);
    g.addColorStop(0.45, `rgba(255, 255, 255, ${(alpha * 0.56).toFixed(3)})`);
    g.addColorStop(0.78, `rgba(255, 255, 255, ${(alpha * 0.16).toFixed(3)})`);
    g.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSoftRadialTexture() {
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

function createPortalRuneTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size * 0.5;
  const cy = size * 0.5;

  // Soft violet-magenta radial energy backdrop
  const bg = ctx.createRadialGradient(cx, cy, 4, cx, cy, size * 0.49);
  bg.addColorStop(0.0, 'rgba(250, 232, 255, 0.92)');
  bg.addColorStop(0.22, 'rgba(217, 70, 239, 0.72)');
  bg.addColorStop(0.55, 'rgba(147, 51, 234, 0.42)');
  bg.addColorStop(0.84, 'rgba(107, 33, 168, 0.14)');
  bg.addColorStop(1.0, 'rgba(88, 28, 135, 0.0)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  ctx.save();
  ctx.shadowColor = '#e879f9';
  ctx.shadowBlur = 12;

  // Outer arcane rune ring
  ctx.strokeStyle = 'rgba(245, 208, 254, 0.96)';
  ctx.lineWidth = 4.2;
  ctx.beginPath();
  ctx.arc(cx, cy, 98, 0, Math.PI * 2);
  ctx.stroke();

  // Inner concentric rings
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = 'rgba(232, 121, 249, 0.92)';
  ctx.beginPath();
  ctx.arc(cx, cy, 78, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 3.0;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.beginPath();
  ctx.arc(cx, cy, 42, 0, Math.PI * 2);
  ctx.stroke();

  // Vertical & horizontal mystic crosshairs extending past outer ring (matches reference sigil!)
  ctx.lineWidth = 3.6;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 114);
  ctx.lineTo(cx, cy + 114);
  ctx.moveTo(cx - 108, cy);
  ctx.lineTo(cx + 108, cy);
  ctx.stroke();

  // Inscribed diamond & diagonal arcane rays
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 78);
  ctx.lineTo(cx + 78, cy);
  ctx.lineTo(cx, cy + 78);
  ctx.lineTo(cx - 78, cy);
  ctx.closePath();
  ctx.stroke();

  // 12 radial rune ticks between rings
  ctx.lineWidth = 2.4;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.15;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 80, cy + Math.sin(a) * 80);
    ctx.lineTo(cx + Math.cos(a) * 96, cy + Math.sin(a) * 96);
    ctx.stroke();
  }

  // Central glowing white-violet eye/orb
  const core = ctx.createRadialGradient(cx, cy, 1, cx, cy, 24);
  core.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  core.addColorStop(0.45, 'rgba(240, 171, 252, 0.85)');
  core.addColorStop(1.0, 'rgba(192, 132, 252, 0.0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSlimeSpotTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const c = size * 0.5;
  const g = ctx.createRadialGradient(c, c, 2, c, c, c);
  g.addColorStop(0.0, 'rgba(175, 255, 76, 0.72)');
  g.addColorStop(0.38, 'rgba(132, 214, 48, 0.44)');
  g.addColorStop(0.74, 'rgba(92, 168, 36, 0.16)');
  g.addColorStop(1.0, 'rgba(72, 138, 28, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createMistyArena({ isMobile = false, lowSpec = false } = {}) {
  const group = new THREE.Group();
  group.visible = false;
  group.rotation.y = PLATE_YAW;

  // Non-editable visual layers (outer trees, banners, crimson foliage, mist, portal/fire/lantern VFX).
  const framingGroup = new THREE.Group();
  framingGroup.userData.isArenaVisualOnly = true;
  group.add(framingGroup);

  const mistGroup = new THREE.Group();
  mistGroup.userData.isArenaVisualOnly = true;
  group.add(mistGroup);

  const effectsGroup = new THREE.Group();
  effectsGroup.userData.isArenaVisualOnly = true;
  group.add(effectsGroup);

  const templates = new Map();
  const framingTemplates = new Map();
  const props = [];
  let loadPromise = null;
  let loaded = false;
  let hasPlacedLayout = false;
  let lowSpecMode = Boolean(lowSpec);
  const getBloomScale = () => (lowSpecMode ? 0.55 : isMobile ? 0.78 : 1.0);

  // Lazily created shared VFX resources (only initialized inside ensureLoaded)
  let vfxAssets = null;
  let currentTheme = 'misty_forest';
  let plateMat = null;
  let slimeMat = null;
  const treeMaterials = [];
  const mistPatches = [];
  const animatedPortals = [];
  const animatedFires = [];
  const animatedLanterns = [];

  function applyBiomeTheme() {
    const th = BIOME_THEMES[currentTheme] || BIOME_THEMES.misty_forest;
    const bloomScale = getBloomScale();
    if (plateMat) {
      plateMat.color.setHex(th.plateColor);
      plateMat.emissive.setHex(th.plateEmissive);
      plateMat.emissiveIntensity = th.plateEmissiveIntensity;
      plateMat.needsUpdate = true;
    }
    if (slimeMat) {
      slimeMat.color.setHex(th.slimeColor);
      slimeMat.opacity = th.slimeOpacity;
    }
    for (let i = 0; i < treeMaterials.length; i++) {
      const m = treeMaterials[i];
      if (m?.color) m.color.setHex(th.treeColor);
    }
    if (vfxAssets) {
      vfxAssets.portalRuneMat.color.setHex(th.portalRune);
      vfxAssets.portalHaloMat.color.setHex(th.portalHalo);
      vfxAssets.portalBloomMat.color.setHex(th.portalBloom || th.portalHalo);
      vfxAssets.portalBloomMat.opacity = (th.portalBloomOpacity ?? 0.42) * bloomScale;
      vfxAssets.portalFloorMat.color.setHex(th.portalFloor);
      vfxAssets.portalSparkMat.color.setHex(th.portalSpark);
      vfxAssets.fireBloomMat.opacity = 0.42 * bloomScale;
      vfxAssets.crimsonBushMat.color.setHex(th.bushColor);
      vfxAssets.crimsonBushMat.emissive.setHex(th.bushEmissive);
      vfxAssets.crimsonBushMat.emissiveIntensity = th.bushEmissiveIntensity;
      vfxAssets.lanternCoreMat.color.setHex(th.lanternCore);
      vfxAssets.lanternHaloMat.color.setHex(th.lanternHalo);
      vfxAssets.lanternBloomMat.color.setHex(th.lanternBloom || th.lanternHalo);
      vfxAssets.lanternBloomMat.opacity = (th.lanternBloomOpacity ?? 0.34) * bloomScale;
    }
    for (let i = 0; i < mistPatches.length; i++) {
      const mp = mistPatches[i];
      if (mp.zone === 'portal') {
        mp.mat.color.setHex(th.mistPortal);
      } else if (mp.zone === 'interior') {
        mp.mat.color.setHex(th.mistInterior);
      } else {
        mp.mat.color.setHex(th.mistPerimeter[mp.variant % th.mistPerimeter.length]);
      }
    }
    for (let i = 0; i < animatedPortals.length; i++) {
      animatedPortals[i].light?.color?.setHex(th.portalLight);
    }
    for (let i = 0; i < animatedLanterns.length; i++) {
      animatedLanterns[i].light?.color?.setHex(th.lanternLight);
      if (animatedLanterns[i].bloom) {
        animatedLanterns[i].bloom.visible = !lowSpecMode;
      }
    }
  }

  function setBiomeTheme(biome = 'misty_forest') {
    currentTheme = BIOME_THEMES[biome] ? biome : 'misty_forest';
    applyBiomeTheme();
  }

  function setLowSpecMode(enabled = false) {
    const next = Boolean(enabled);
    if (next === lowSpecMode) return;
    lowSpecMode = next;
    applyBiomeTheme();
  }

  function ensureVfxAssets() {
    if (vfxAssets) return vfxAssets;
    const mistTex = createMistyCloudTexture();
    const glowTex = createSoftRadialTexture();
    const bloomTex = createBloomHaloTexture();
    const portalRuneTex = createPortalRuneTexture();
    const slimeTex = createSlimeSpotTexture();

    vfxAssets = {
      mistTex,
      glowTex,
      bloomTex,
      portalRuneTex,
      slimeTex,
      unitPlaneGeo: new THREE.PlaneGeometry(1, 1),
      portalDiscGeo: new THREE.PlaneGeometry(2.35, 2.35),
      portalHaloGeo: new THREE.PlaneGeometry(3.05, 3.05),
      portalFloorGeo: new THREE.PlaneGeometry(4.4, 4.4),
      flameOuterGeo: new THREE.ConeGeometry(0.36, 0.98, 8),
      flameInnerGeo: new THREE.ConeGeometry(0.20, 0.66, 8),
      portalRuneMat: new THREE.MeshBasicMaterial({
        map: portalRuneTex,
        color: 0xf5d0fe,
        transparent: true,
        opacity: 0.96,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false
      }),
      portalHaloMat: new THREE.MeshBasicMaterial({
        map: glowTex,
        color: 0xa855f7,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false
      }),
      portalBloomMat: new THREE.SpriteMaterial({
        map: bloomTex,
        color: 0xc084fc,
        transparent: true,
        opacity: 0.42 * getBloomScale(),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      }),
      portalFloorMat: new THREE.MeshBasicMaterial({
        map: glowTex,
        color: 0xc026d3,
        transparent: true,
        opacity: 0.56,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      }),
      portalSparkMat: new THREE.PointsMaterial({
        map: glowTex,
        color: 0xe879f9,
        size: 0.16,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      }),
      fireOuterMat: new THREE.MeshBasicMaterial({
        color: 0xff6b1a,
        transparent: true,
        opacity: 0.88,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      }),
      fireInnerMat: new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.96,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      }),
      fireGlowMat: new THREE.SpriteMaterial({
        map: glowTex,
        color: 0xff922b,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      }),
      fireBloomMat: new THREE.SpriteMaterial({
        map: bloomTex,
        color: 0xff7b1c,
        transparent: true,
        opacity: 0.42 * getBloomScale(),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      }),
      fireFloorMat: new THREE.MeshBasicMaterial({
        map: glowTex,
        color: 0xff7b22,
        transparent: true,
        opacity: 0.48,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      }),
      fireSparkMat: new THREE.PointsMaterial({
        map: glowTex,
        color: 0xffb347,
        size: 0.13,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      }),
      lanternCoreMat: new THREE.SpriteMaterial({
        map: glowTex,
        color: 0xfff3b0,
        transparent: true,
        opacity: 0.94,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      }),
      lanternHaloMat: new THREE.SpriteMaterial({
        map: glowTex,
        color: 0xff8c24,
        transparent: true,
        opacity: 0.62,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      }),
      lanternBloomMat: new THREE.SpriteMaterial({
        map: bloomTex,
        color: 0xff9b38,
        transparent: true,
        opacity: 0.34 * getBloomScale(),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      }),
      crimsonBushGeo: new THREE.IcosahedronGeometry(0.32, 0),
      crimsonBushMat: new THREE.MeshStandardMaterial({
        color: 0x8e2444,
        emissive: 0x260814,
        emissiveIntensity: 0.45,
        roughness: 0.88,
        metalness: 0.04
      })
    };
    return vfxAssets;
  }

  function clearEffects() {
    for (let i = 0; i < animatedPortals.length; i++) {
      animatedPortals[i].sparkGeo?.dispose();
    }
    for (let i = 0; i < animatedFires.length; i++) {
      animatedFires[i].sparkGeo?.dispose();
    }
    animatedPortals.length = 0;
    animatedFires.length = 0;
    animatedLanterns.length = 0;
    while (effectsGroup.children.length > 0) {
      effectsGroup.remove(effectsGroup.children[effectsGroup.children.length - 1]);
    }
  }

  // Rebuilds dynamic glowing portal vortex, blazing campfire flames/sparks, and
  // warm lantern glows/PointLights matched 1-to-1 to the current placed props.
  function syncPropEffects() {
    if (!vfxAssets) return;
    clearEffects();
    const A = vfxAssets;
    const maxLanternLights = isMobile ? 4 : 6;
    let lanternLightCount = 0;

    for (let i = 0; i < props.length; i++) {
      const p = props[i];
      const key = p.userData.arenaKey;
      const px = p.position.x;
      const pz = p.position.z;
      const rot = p.rotation.y || 0;
      const sc = p.userData.arenaScale || 1;

      if (key === 'portal') {
        const wrap = new THREE.Group();
        wrap.position.set(px, 0, pz);
        wrap.rotation.y = rot;
        wrap.scale.setScalar(sc);

        // Glowing purple arcane sigil inside the portal arch opening
        const runeMesh = new THREE.Mesh(A.portalDiscGeo, A.portalRuneMat);
        runeMesh.position.set(0, 2.08, 0.30);
        runeMesh.renderOrder = 6;

        const haloMesh = new THREE.Mesh(A.portalHaloGeo, A.portalHaloMat);
        haloMesh.position.set(0, 2.08, 0.24);
        haloMesh.renderOrder = 5;

        // Lightweight additive pseudo-bloom aura around the runic portal arch
        const bloomSprite = new THREE.Sprite(A.portalBloomMat);
        bloomSprite.position.set(0, 2.12, 0.52);
        bloomSprite.scale.set(6.8, 6.8, 1);
        bloomSprite.renderOrder = 4;

        // Luminous magenta-violet light pool across the curved stone dais & foot of steps
        const floorPool = new THREE.Mesh(A.portalFloorGeo, A.portalFloorMat);
        floorPool.rotation.x = -Math.PI / 2;
        floorPool.position.set(0, 0.64, 0.78);
        floorPool.scale.setScalar(0.68);
        floorPool.renderOrder = 4;

        const stepGlowPool = new THREE.Mesh(A.portalFloorGeo, A.portalFloorMat);
        stepGlowPool.rotation.x = -Math.PI / 2;
        stepGlowPool.position.set(0, 0.04, 2.05);
        stepGlowPool.scale.setScalar(1.08);
        stepGlowPool.renderOrder = 3;

        // Rising portal sparks (adaptive count for mobile)
        const sparkCount = isMobile ? 12 : 20;
        const sparkPos = new Float32Array(sparkCount * 3);
        const sparkSeeds = new Float32Array(sparkCount * 3);
        for (let k = 0; k < sparkCount; k++) {
          const ang = (k / sparkCount) * Math.PI * 2;
          const r = 0.25 + (k % 5) * 0.22;
          sparkPos[k * 3] = Math.cos(ang) * r;
          sparkPos[k * 3 + 1] = 0.7 + (k / sparkCount) * 2.5;
          sparkPos[k * 3 + 2] = 0.28 + Math.sin(ang) * 0.45;
          sparkSeeds[k * 3] = 0.45 + (k % 4) * 0.18;
          sparkSeeds[k * 3 + 1] = ang;
          sparkSeeds[k * 3 + 2] = r;
        }
        const sparkGeo = new THREE.BufferGeometry();
        sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
        const sparks = new THREE.Points(sparkGeo, A.portalSparkMat);
        sparks.renderOrder = 7;

        // Vibrant pulsing PointLight casting glow onto steps & nearby walls
        const light = new THREE.PointLight(0xb84dff, 4.6, 18, 1.35);
        light.position.set(0, 2.35, 1.35);

        wrap.add(stepGlowPool, floorPool, bloomSprite, haloMesh, runeMesh, sparks, light);
        effectsGroup.add(wrap);
        animatedPortals.push({
          runeMesh,
          haloMesh,
          bloomSprite,
          floorPool,
          sparkGeo,
          sparkSeeds,
          sparkCount,
          light,
          baseIntensity: 4.6,
          phase: i * 1.13
        });
      } else if (key === 'campfire') {
        const wrap = new THREE.Group();
        wrap.position.set(px, 0, pz);
        wrap.scale.setScalar(sc);

        const outerFlame = new THREE.Mesh(A.flameOuterGeo, A.fireOuterMat);
        outerFlame.position.y = 0.56;
        const innerFlame = new THREE.Mesh(A.flameInnerGeo, A.fireInnerMat);
        innerFlame.position.y = 0.44;
        const glowSprite = new THREE.Sprite(A.fireGlowMat);
        glowSprite.position.y = 0.72;
        glowSprite.scale.set(2.4, 2.4, 1);

        const bloomSprite = new THREE.Sprite(A.fireBloomMat);
        bloomSprite.position.y = 0.85;
        bloomSprite.scale.set(4.8, 4.8, 1);
        bloomSprite.renderOrder = 4;

        const floorPool = new THREE.Mesh(A.unitPlaneGeo, A.fireFloorMat);
        floorPool.rotation.x = -Math.PI / 2;
        floorPool.scale.set(5.2, 5.2, 1);
        floorPool.position.y = 0.04;

        // Rising campfire sparks
        const sparkCount = isMobile ? 10 : 16;
        const sparkPos = new Float32Array(sparkCount * 3);
        const sparkSeeds = new Float32Array(sparkCount * 3);
        for (let k = 0; k < sparkCount; k++) {
          const ang = k * 2.1;
          const r = 0.12 + (k % 4) * 0.12;
          sparkPos[k * 3] = Math.cos(ang) * r;
          sparkPos[k * 3 + 1] = 0.25 + (k / sparkCount) * 2.1;
          sparkPos[k * 3 + 2] = Math.sin(ang) * r;
          sparkSeeds[k * 3] = 0.75 + (k % 5) * 0.22;
          sparkSeeds[k * 3 + 1] = ang;
          sparkSeeds[k * 3 + 2] = 0.18 + (k % 3) * 0.10;
        }
        const sparkGeo = new THREE.BufferGeometry();
        sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
        const sparks = new THREE.Points(sparkGeo, A.fireSparkMat);
        sparks.renderOrder = 6;

        const light = new THREE.PointLight(0xff7b24, 4.4, 17, 1.35);
        light.position.set(0, 1.65, 0);

        wrap.add(floorPool, bloomSprite, outerFlame, innerFlame, glowSprite, sparks, light);
        effectsGroup.add(wrap);
        animatedFires.push({
          outerFlame,
          innerFlame,
          glowSprite,
          bloomSprite,
          sparkGeo,
          sparkSeeds,
          sparkCount,
          light,
          baseIntensity: 4.4,
          phase: i * 0.87
        });
      } else if (key === 'lantern') {
        // Position flame inside the hanging lantern head (measured from gen_lantern.glb)
        const headRatio = (TARGET_HEIGHTS.lantern / 3.2) * sc;
        const hx = 0.50 * headRatio;
        const hy = 2.26 * headRatio;
        const hz = -0.13 * headRatio;
        const cr = Math.cos(rot);
        const sr = Math.sin(rot);
        const lx = px + (hx * cr + hz * sr);
        const lz = pz + (-hx * sr + hz * cr);

        const core = new THREE.Sprite(A.lanternCoreMat);
        core.position.set(lx, hy, lz);
        core.scale.set(0.68 * sc, 0.78 * sc, 1);
        core.renderOrder = 6;

        const halo = new THREE.Sprite(A.lanternHaloMat);
        halo.position.set(lx, hy, lz);
        halo.scale.set(2.15 * sc, 2.15 * sc, 1);
        halo.renderOrder = 5;

        const bloom = new THREE.Sprite(A.lanternBloomMat);
        bloom.position.set(lx, hy, lz);
        bloom.scale.set(4.1 * sc, 4.1 * sc, 1);
        bloom.renderOrder = 4;
        bloom.visible = !lowSpecMode;

        effectsGroup.add(bloom, halo, core);

        let light = null;
        if (lanternLightCount < maxLanternLights) {
          lanternLightCount++;
          light = new THREE.PointLight(0xff9b38, 2.65, 13.0, 1.4);
          light.position.set(lx, hy + 0.15, lz);
          effectsGroup.add(light);
        }
        animatedLanterns.push({
          core,
          halo,
          bloom,
          light,
          baseCoreScale: 0.68 * sc,
          baseHaloScale: 2.15 * sc,
          baseBloomScale: 4.1 * sc,
          baseIntensity: 2.65,
          phase: i * 1.37
        });
      }
    }
    applyBiomeTheme();
  }

  // Builds the outer gnarled dead trees, crimson top banners, crimson foliage accents,
  // flat ground slime spots, and lush animated purple-violet perimeter & portal mist.
  function buildAtmosphereAndFraming() {
    const A = ensureVfxAssets();

    // 1. Two crimson skull banners flanking the top main gate arch (exact reference detail!)
    const bannerTpl = framingTemplates.get('bannerRed');
    if (bannerTpl) {
      for (const bx of [-4.25, 4.25]) {
        const b = bannerTpl.clone(true);
        b.position.set(bx, 0, -18.55);
        b.rotation.y = 0;
        b.scale.setScalar(1.38);
        framingGroup.add(b);
      }
    }

    // 2. Outer gnarled dead trees framing all four sides in the purple twilight mist
    const treeLargeTpl = framingTemplates.get('treeLarge');
    const treeMedTpl = framingTemplates.get('treeMed');
    const outerTrees = [
      // Prominent corner giant gnarled trees matching reference silhouette
      { big: true,  x: -20.2, z: -15.6, rot: 0.45,  s: 2.15 }, // NW over tent & arch
      { big: true,  x: 20.6,  z: -15.4, rot: -0.52, s: 2.05 }, // NE behind portal
      { big: true,  x: -21.2, z: 13.6,  rot: 0.95,  s: 1.95 }, // SW left foreground
      { big: true,  x: 18.2,  z: 17.6,  rot: -1.15, s: 2.05 }, // SE right foreground
      // Outer perimeter forest ring
      { big: false, x: -11.4, z: -22.8, rot: 0.25,  s: 1.55 },
      { big: false, x: 10.6,  z: -22.6, rot: -0.38, s: 1.50 },
      { big: true,  x: -24.2, z: -3.2,  rot: 1.45,  s: 1.80 },
      { big: false, x: -23.0, z: 6.4,   rot: 2.10,  s: 1.45 },
      { big: true,  x: 23.6,  z: -4.2,  rot: -1.35, s: 1.75 },
      { big: false, x: 23.2,  z: 7.4,   rot: -2.05, s: 1.55 },
      { big: false, x: -12.6, z: 21.8,  rot: 2.65,  s: 1.45 },
      { big: false, x: 11.4,  z: 21.8,  rot: -2.45, s: 1.50 },
      { big: false, x: -4.2,  z: -23.6, rot: 0.15,  s: 1.40 },
      { big: false, x: 4.8,   z: -23.4, rot: -0.25, s: 1.38 }
    ];
    for (const sp of outerTrees) {
      const tpl = (sp.big ? treeLargeTpl : treeMedTpl) || treeLargeTpl || treeMedTpl;
      if (!tpl) continue;
      const inst = tpl.clone(true);
      inst.position.set(sp.x, 0, sp.z);
      inst.rotation.y = sp.rot;
      inst.scale.setScalar(sp.s);
      framingGroup.add(inst);
    }

    // 3. Signature crimson autumn foliage/berry bushes tucked near landmarks & walls
    const bushSpots = [
      [-4.2, -17.3, 1.05], [4.2, -17.3, 1.05], [16.2, -9.2, 1.15],
      [6.4, 5.2, 1.12], [8.2, 4.6, 0.95], [-6.6, -5.2, 0.90],
      [-10.4, 14.2, 1.15], [15.4, 10.6, 1.05], [-17.4, 8.6, 1.0],
      [16.8, -1.6, 1.05], [-13.6, -11.8, 0.95], [13.2, 14.8, 1.0]
    ];
    for (let i = 0; i < bushSpots.length; i++) {
      const [bx, bz, bs] = bushSpots[i];
      const bush = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const lobe = new THREE.Mesh(A.crimsonBushGeo, A.crimsonBushMat);
        lobe.position.set((k - 1.5) * 0.22, 0.22 + (k % 2) * 0.11, k % 2 ? 0.14 : -0.12);
        lobe.scale.setScalar(0.85 + (k % 3) * 0.18);
        bush.add(lobe);
      }
      bush.position.set(bx, 0, bz);
      bush.rotation.y = i * 1.1;
      bush.scale.setScalar(bs);
      framingGroup.add(bush);
    }

    // 4. Two subtle glowing green moss/slime spots on the cobblestones (matching reference!)
    slimeMat = new THREE.MeshBasicMaterial({
      map: A.slimeTex,
      color: 0xffffff,
      transparent: true,
      opacity: 0.72,
      depthWrite: false
    });
    for (const [sx, sz, ss] of [[-4.4, 8.8, 2.5], [10.4, 2.6, 2.4]]) {
      const spot = new THREE.Mesh(A.unitPlaneGeo, slimeMat);
      spot.rotation.x = -Math.PI / 2;
      spot.position.set(sx, 0.024, sz);
      spot.scale.set(ss, ss * 0.82, 1);
      spot.renderOrder = 2;
      framingGroup.add(spot);
    }

    // 5. Lush animated violet-purple low-lying mist around perimeter, portal & ruins
    const mistSpecs = [];
    // 22 overlapping perimeter mist banks ringing the walls & gnarled trees
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      const dist = 19.4 + (i % 3) * 1.9;
      mistSpecs.push({
        x: Math.cos(a) * dist,
        z: Math.sin(a) * dist,
        y: 0.18 + (i % 3) * 0.09,
        scale: 10.5 + (i % 4) * 2.4,
        color: i % 3 === 0 ? 0xc048ff : i % 3 === 1 ? 0xa335eb : 0x8b2fc9,
        zone: 'perimeter',
        variant: i % 3,
        opacity: 0.24 + (i % 3) * 0.055,
        speed: 0.14 + (i % 5) * 0.03,
        phase: i * 0.71
      });
    }
    // 4 vibrant magenta-violet mist pools swirling around the glowing portal steps
    for (const [mx, mz, ms, op, ph] of [
      [13.4, -11.4, 7.6, 0.34, 0.4],
      [16.2, -13.6, 8.8, 0.38, 1.9],
      [11.6, -14.2, 6.8, 0.30, 3.2],
      [16.8, -9.8,  7.2, 0.32, 4.7]
    ]) {
      mistSpecs.push({
        x: mx, z: mz, y: 0.24, scale: ms, color: 0xd946ef, zone: 'portal', variant: 0, opacity: op, speed: 0.22, phase: ph
      });
    }
    // 6 delicate interior mist wisps hugging the lower-left/lower-right ruins (center stays crisp!)
    for (const [mx, mz, ms, op, ph] of [
      [-9.2,  4.4,  6.4, 0.24, 0.9],
      [-11.8, 12.2, 7.8, 0.28, 2.1],
      [13.4,  7.2,  7.4, 0.26, 3.5],
      [6.4,   15.8, 8.2, 0.28, 4.8],
      [-5.6,  16.2, 8.0, 0.28, 5.5],
      [-14.8, -11.8,7.4, 0.26, 1.4]
    ]) {
      mistSpecs.push({
        x: mx, z: mz, y: 0.19, scale: ms, color: 0xb43ff5, zone: 'interior', variant: 0, opacity: op, speed: 0.16, phase: ph
      });
    }

    for (let i = 0; i < mistSpecs.length; i++) {
      const sp = mistSpecs[i];
      const mat = new THREE.MeshBasicMaterial({
        map: A.mistTex,
        color: sp.color,
        transparent: true,
        opacity: sp.opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(A.unitPlaneGeo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = sp.phase;
      mesh.scale.setScalar(sp.scale);
      mesh.position.set(sp.x, sp.y, sp.z);
      mesh.renderOrder = 3;
      mistGroup.add(mesh);
      mistPatches.push({
        mesh,
        mat,
        zone: sp.zone,
        variant: sp.variant,
        baseX: sp.x,
        baseZ: sp.z,
        speed: sp.speed,
        phase: sp.phase,
        baseOpacity: sp.opacity,
        spinDir: i % 2 === 0 ? 1 : -1
      });
    }
  }

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
    inst.userData.arenaScale = scale;
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
    return props.map((p) => {
      const item = {
        key: p.userData.arenaKey,
        x: +p.position.x.toFixed(2),
        z: +p.position.z.toFixed(2),
        rot: +p.rotation.y.toFixed(2)
      };
      const sc = p.userData.arenaScale;
      if (sc && Math.abs(sc - 1) > 0.005) item.scale = +sc.toFixed(2);
      return item;
    });
  }

  function saveLayout() {
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(snapshot())); } catch {}
  }

  function loadLayout() {
    const items = readLayoutItems();
    for (const p of [...props]) removeProp(p);
    let placed = 0;
    for (const it of items) {
      if (spawnProp(it.key, it.x, it.z, it.rot || 0, it.scale || 1)) placed++;
    }
    hasPlacedLayout = true;
    syncPropEffects();
    return placed;
  }

  function getColliders() {
    const source = hasPlacedLayout
      ? props.map((p) => ({
          key: p.userData.arenaKey,
          x: p.position.x,
          z: p.position.z,
          rot: p.rotation.y || 0,
          scale: p.userData.arenaScale || 1
        }))
      : readLayoutItems().map((it) => ({
          key: it.key,
          x: Number(it.x) || 0,
          z: Number(it.z) || 0,
          rot: Number(it.rot) || 0,
          scale: Number(it.scale) || 1
        }));

    const out = [];
    for (let i = 0; i < source.length; i++) {
      const it = source[i];
      if (!it || !it.key || PASSABLE_PROP_KEYS.has(it.key)) continue;
      const shapes = PROP_COLLIDER_SHAPES[it.key];
      if (!shapes || shapes.length === 0) continue;
      const cr = Math.cos(it.rot);
      const sr = Math.sin(it.rot);
      const sc = it.scale || 1;
      for (let j = 0; j < shapes.length; j++) {
        const sh = shapes[j];
        const gx = it.x + (sh.lx * cr + sh.lz * sr) * sc;
        const gz = it.z + (-sh.lx * sr + sh.lz * cr) * sc;
        const wx = gx * COS_PLATE + gz * SIN_PLATE;
        const wz = -gx * SIN_PLATE + gz * COS_PLATE;
        out.push({
          x: +wx.toFixed(3),
          z: +wz.toFixed(3),
          radius: +(sh.r * sc).toFixed(3)
        });
      }
    }
    return out;
  }

  function update(dt = 0.016, t = 0) {
    if (!loaded || !group.visible) return;

    // 1. Gently rolling violet perimeter & portal mist
    for (let i = 0; i < mistPatches.length; i++) {
      const mp = mistPatches[i];
      mp.mesh.position.x = mp.baseX + Math.sin(t * mp.speed + mp.phase) * 1.15;
      mp.mesh.position.z = mp.baseZ + Math.cos(t * mp.speed * 0.84 + mp.phase) * 0.95;
      mp.mesh.rotation.z += dt * 0.035 * mp.spinDir;
      mp.mat.opacity = mp.baseOpacity * (0.82 + 0.18 * Math.sin(t * 1.15 + mp.phase));
    }

    // 2. Glowing runic portal animation & biome-specific shimmer (purple / frost / molten ash)
    const isFrostTheme = currentTheme === 'frost_ruins';
    const isAshTheme = currentTheme === 'ash_citadel';
    const bloomScale = getBloomScale();
    const themeDef = BIOME_THEMES[currentTheme] || BIOME_THEMES.misty_forest;
    for (let i = 0; i < animatedPortals.length; i++) {
      const pt = animatedPortals[i];
      const pulse = isFrostTheme
        ? 0.86 + Math.sin(t * 4.2 + pt.phase) * 0.10 + Math.sin(t * 13.5 + pt.phase * 2.3) * 0.08
        : isAshTheme
          ? 0.84 + Math.sin(t * 6.5 + pt.phase) * 0.14 + Math.sin(t * 16.0 + pt.phase * 1.7) * 0.08
          : 0.88 + Math.sin(t * 3.4 + pt.phase) * 0.12 + Math.sin(t * 7.2 + pt.phase) * 0.05;
      pt.runeMesh.rotation.z = t * (isFrostTheme ? 0.28 : isAshTheme ? 0.58 : 0.42);
      const sc = 0.96 + Math.sin(t * 2.8 + pt.phase) * 0.04;
      pt.runeMesh.scale.setScalar(sc);
      pt.haloMesh.scale.setScalar(0.92 + Math.sin(t * 2.2 + pt.phase) * 0.08);
      if (pt.bloomSprite) {
        const bloomBreath = isFrostTheme
          ? 6.9 + Math.sin(t * 3.6 + pt.phase) * 0.55 + Math.sin(t * 11.4 + pt.phase) * 0.22
          : isAshTheme
            ? 7.4 + Math.sin(t * 5.2 + pt.phase) * 0.72
            : 6.6 + Math.sin(t * 2.4 + pt.phase) * 0.42;
        pt.bloomSprite.scale.set(bloomBreath, bloomBreath, 1);
      }
      if (vfxAssets?.portalBloomMat) {
        const shimmer = isFrostTheme
          ? 0.84 + 0.22 * Math.abs(Math.sin(t * 6.4 + pt.phase))
          : isAshTheme
            ? 0.88 + 0.18 * Math.sin(t * 8.2 + pt.phase)
            : 0.92 + 0.08 * Math.sin(t * 2.6 + pt.phase);
        vfxAssets.portalBloomMat.opacity = (themeDef.portalBloomOpacity ?? 0.42) * bloomScale * shimmer;
      }
      pt.floorPool.scale.setScalar(0.66 + Math.sin(t * 2.5 + pt.phase) * 0.05);
      pt.light.intensity = pt.baseIntensity * pulse;

      const arr = pt.sparkGeo.attributes.position.array;
      const spdMult = isAshTheme ? 1.45 : isFrostTheme ? 0.78 : 1.0;
      const swirlMult = isFrostTheme ? 1.35 : isAshTheme ? 0.65 : 0.9;
      for (let k = 0; k < pt.sparkCount; k++) {
        const idx = k * 3;
        const spd = pt.sparkSeeds[idx] * spdMult;
        const ang = pt.sparkSeeds[idx + 1] + t * swirlMult;
        const rad = pt.sparkSeeds[idx + 2];
        arr[idx + 1] += spd * dt;
        arr[idx] = Math.cos(ang) * rad;
        arr[idx + 2] = 0.30 + Math.sin(ang) * 0.38;
        if (arr[idx + 1] > 3.5) {
          arr[idx + 1] = 0.65;
        }
      }
      pt.sparkGeo.attributes.position.needsUpdate = true;
    }

    // 3. Blazing campfire flame flicker & rising warm sparks
    for (let i = 0; i < animatedFires.length; i++) {
      const cf = animatedFires[i];
      const fl = 0.86 + Math.sin(t * 11.2 + cf.phase) * 0.09 + Math.sin(t * 24.5 + cf.phase * 1.9) * 0.06;
      cf.outerFlame.scale.set(0.94 + (fl - 0.86) * 0.6, fl * 1.08, 0.94 + (fl - 0.86) * 0.6);
      cf.outerFlame.rotation.y += dt * 2.2;
      cf.innerFlame.scale.set(1, 0.92 + Math.sin(t * 17.5 + cf.phase) * 0.14, 1);
      cf.glowSprite.scale.set(2.3 * fl, 2.3 * fl, 1);
      if (cf.bloomSprite) {
        const bs = 4.65 * fl;
        cf.bloomSprite.scale.set(bs, bs, 1);
      }
      cf.light.intensity = cf.baseIntensity * fl;

      const arr = cf.sparkGeo.attributes.position.array;
      for (let k = 0; k < cf.sparkCount; k++) {
        const idx = k * 3;
        const spd = cf.sparkSeeds[idx];
        const ph = cf.sparkSeeds[idx + 1];
        const drift = cf.sparkSeeds[idx + 2];
        arr[idx + 1] += spd * dt;
        arr[idx] += Math.sin(t * 3.4 + ph) * drift * dt;
        arr[idx + 2] += Math.cos(t * 2.9 + ph) * drift * dt;
        if (arr[idx + 1] > 2.45) {
          arr[idx] = Math.cos(ph + t) * 0.24;
          arr[idx + 1] = 0.22;
          arr[idx + 2] = Math.sin(ph + t) * 0.24;
        }
      }
      cf.sparkGeo.attributes.position.needsUpdate = true;
    }

    // 4. Warm flickering lantern flames, soft pseudo-bloom & entrance lights
    for (let i = 0; i < animatedLanterns.length; i++) {
      const ln = animatedLanterns[i];
      const fl = 0.88 + Math.sin(t * 9.8 + ln.phase) * 0.08 + Math.sin(t * 21.4 + ln.phase * 1.7) * 0.05;
      ln.core.scale.set(ln.baseCoreScale * fl, ln.baseCoreScale * 1.15 * fl, 1);
      ln.halo.scale.set(ln.baseHaloScale * fl, ln.baseHaloScale * fl, 1);
      if (ln.bloom && ln.bloom.visible) {
        const bs = ln.baseBloomScale * (0.94 + (fl - 0.88) * 0.65);
        ln.bloom.scale.set(bs, bs, 1);
      }
      if (ln.light) ln.light.intensity = ln.baseIntensity * fl;
    }
  }

  // Lazy loader: downloads arena_plate.png, gen_*.glb and outer framing trees ONLY on chapter 6+.
  function ensureLoaded() {
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
      ensureVfxAssets();

      const platePromise = new Promise((resolve) => {
        new THREE.TextureLoader().load(
          MODEL_DIR + 'arena_plate.png',
          (t) => {
            t.colorSpace = THREE.SRGBColorSpace;
            t.anisotropy = 8;
            t.wrapS = THREE.RepeatWrapping;
            t.wrapT = THREE.RepeatWrapping;
            t.repeat.set(6, 6);
            // Bright, legible flagstones extending cleanly under outer trees/mist (retinted per act biome)
            plateMat = new THREE.MeshStandardMaterial({
              map: t,
              color: 0xf4eeff,
              emissive: 0x2c2242,
              emissiveMap: t,
              emissiveIntensity: 0.55,
              roughness: 0.86,
              metalness: 0.0
            });
            const plate = new THREE.Mesh(
              new THREE.PlaneGeometry(ARENA_HALF * 2 + 12, ARENA_HALF * 2 + 12),
              plateMat
            );
            plate.rotation.x = -Math.PI / 2;
            plate.position.y = 0.01;
            plate.receiveShadow = true;
            plate.userData.isArenaVisualOnly = true;
            group.add(plate);
            applyBiomeTheme();
            resolve(t);
          },
          undefined,
          () => resolve(null)
        );
      });

      const loader = new GLTFLoader();
      loader.setDRACOLoader(sharedDracoLoader);
      const propEntries = Object.entries(MODEL_FILES).map(([key, file]) => ({
        kind: 'prop',
        key,
        url: MODEL_DIR + file + '?v=20261120z34'
      }));
      const framingEntries = Object.entries(FRAMING_FILES).map(([key, url]) => ({
        kind: 'framing',
        key,
        url
      }));
      const allEntries = [...propEntries, ...framingEntries];

      let idx = 0;
      const workerCount = Math.min(4, allEntries.length);
      const modelsPromise = Promise.all(
        Array.from({ length: workerCount }, async () => {
          while (idx < allEntries.length) {
            const entry = allEntries[idx++];
            await new Promise((resolve) => {
              loader.load(
                entry.url,
                (gltf) => {
                  const root = gltf.scene;
                  if (entry.kind === 'prop') {
                    const box = new THREE.Box3().setFromObject(root);
                    const h = box.getSize(new THREE.Vector3()).y || 1;
                    const s = (TARGET_HEIGHTS[entry.key] || 2) / h;
                    root.scale.setScalar(s);
                    const box2 = new THREE.Box3().setFromObject(root);
                    root.position.y -= box2.min.y;
                    root.traverse((n) => {
                      if (!n.isMesh) return;
                      n.castShadow = !isMobile;
                      n.receiveShadow = true;
                    });
                    templates.set(entry.key, root);
                  } else {
                    if (entry.key === 'treeLarge' || entry.key === 'treeMed') {
                      root.traverse((n) => {
                        if (!n.isMesh || !n.material) return;
                        n.castShadow = false;
                        n.receiveShadow = false;
                        const cloned = Array.isArray(n.material)
                          ? n.material.map((m) => m.clone())
                          : n.material.clone();
                        n.material = cloned;
                        const list = Array.isArray(cloned) ? cloned : [cloned];
                        for (const m of list) {
                          if (m.color) {
                            m.color.setHex(0x4a3d63);
                            treeMaterials.push(m);
                          }
                        }
                      });
                    }
                    framingTemplates.set(entry.key, root);
                  }
                  resolve();
                },
                undefined,
                () => resolve()
              );
            });
          }
        })
      );

      await Promise.all([platePromise, modelsPromise]);
      buildAtmosphereAndFraming();
      loadLayout();
      applyBiomeTheme();
      loaded = true;
    })();
    return loadPromise;
  }

  return {
    group,
    get ready() {
      return loadPromise || Promise.resolve();
    },
    ensureLoaded,
    isLoaded: () => loaded,
    getColliders,
    setBiomeTheme,
    setLowSpecMode,
    syncEffects: syncPropEffects,
    update,
    spawn: spawnProp,
    remove: removeProp,
    clear: () => {
      for (const p of [...props]) removeProp(p);
      hasPlacedLayout = true;
      syncPropEffects();
    },
    list: snapshot,
    saveLayout,
    loadLayout,
    templateKeys: () => Object.keys(MODEL_FILES)
  };
}
