// Grimborne Hunters — Dark Souls / Bloodborne Interconnected Riverside Gorge Location
// «Тракт Древней Арки • Фонарная Набережная • Разрушенная Башня Перевала» (z = +31 .. +132m)
// Pure Vanilla ES Module (Three.js r160, ZERO external assets, ZERO extra PointLights, 60+ FPS, 0 VRAM leaks).
//
// Designed directly from the reference location walkthrough:
//   - Zone 1 (z = 31..59):  Damp mossy cobblestone riverside road, rushing moonlit river on left (+X),
//                           sheer basalt cliffs on right (-X), scattered broken planks, gnarled roots tree,
//                           blazing wayside campfire w/ fallen mossy log & wooden crates, twin ruined
//                           cylindrical stone columns on square pedestals, and the iconic OPEN ivy-draped
//                           ruined stone archway at z = 55.5 w/ hanging warm lantern & bare dead tree.
//   - Zone 2 (z = 59..97):  Curving lantern-lit riverside road w/ row of 4 tall timber gallows-style
//                           lantern posts, second wayside campfire & column w/ tattered crimson war banner,
//                           mossy shoreline boulders & forested pine ridge across the river.
//   - Zone 3 (z = 97..124): Curated Dark Souls / Bloodborne cliffside Ruined Watchtower Bastion Courtyard
//                           w/ stepped stone ascent, crumbling crenellated battlements, river-gorge overlook
//                           terrace, right-side cliffside crypt nook, watchtower hearth & diegetic collapsed
//                           portcullis bridge overlooking a dramatic misty alpine-gothic mountain range.

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(edge0, edge1, x) {
  const denom = edge1 - edge0;
  if (Math.abs(denom) < 1e-6) return x >= edge1 ? 1.0 : 0.0;
  const t = clamp01((x - edge0) / denom);
  return t * t * (3.0 - 2.0 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function makeRng(seedInit) {
  let seed = seedInit >>> 0;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// ============================================================================
// Shared Gorge Road Static Anchors & Colliders (Single Source of Truth)
// ============================================================================
export const GORGE_ROAD_ANCHORS = Object.freeze({
  archway1Pos: Object.freeze({ x: -0.6, z: 55.5 }),
  camp1Pos: Object.freeze({ x: -2.95, z: 45.2 }),
  camp2Pos: Object.freeze({ x: -3.55, z: 71.2 }),
  watchtowerHearthPos: Object.freeze({ x: 0.65, z: 111.2 }),
  watchtowerLorePos: Object.freeze({ x: -6.4, z: 111.0 }),
  bastionCenterPos: Object.freeze({ x: 0.6, z: 111.0 }),
  portcullisPos: Object.freeze({ x: 0.8, z: 121.0 })
});

// Exact 1:1 colliders for every solid architectural pier, column, campfire, tree trunk & boulder in Zones 1–3
export const GORGE_STATIC_COLLIDERS = Object.freeze([
  // Zone 1: Gnarled root tree, campfire, fallen log & twin ruined columns
  { x: -6.15, z: 39.10, r: 1.05 }, // Ancient gnarled roots dead tree
  { x: -2.95, z: 45.20, r: 1.05 }, // Zone 1 Wayside Campfire ring
  { x: -4.65, z: 46.35, r: 0.92 }, // Fallen mossy trunk beside camp 1
  { x: -5.75, z: 46.10, r: 0.88 }, // Tall ruined cylindrical column #1
  { x: -6.10, z: 49.45, r: 0.85 }, // Shorter ruined cylindrical column #2
  // Zone 1: Open Ivy-Draped Ruined Stone Archway (z = 55.5 — 4.7m clear road opening!)
  { x:  2.45, z: 55.50, r: 1.25 }, // Left (river-side) archway pier
  { x:  4.05, z: 55.20, r: 1.35 }, // Left ivy wing wall & riverside mossy boulder
  { x: -3.65, z: 55.50, r: 1.25 }, // Right (cliff-side) archway pier
  { x: -5.35, z: 54.55, r: 0.95 }, // Bare twisted dead tree beside right pier
  // Zone 2: Timber gallows lantern posts (right road edge) + Campfire 2 + Column ruin
  { x: -4.05, z: 66.20, r: 0.42 }, // Timber Lantern Post #1
  { x: -3.55, z: 71.20, r: 1.05 }, // Zone 2 Wayside Campfire ring
  { x: -5.65, z: 71.60, r: 0.95 }, // Fallen mossy hollow log #2
  { x: -6.45, z: 73.10, r: 0.92 }, // Weathered round column + crimson banner ruin
  { x: -4.15, z: 75.40, r: 0.42 }, // Timber Lantern Post #2
  { x: -2.65, z: 84.20, r: 0.42 }, // Timber Lantern Post #3
  { x: -1.15, z: 92.80, r: 0.42 }, // Timber Lantern Post #4
  // Zone 2/3 Bend: Chokepoint rocky promontory & watchtower gatehouse piers
  { x:  5.40, z: 88.60, r: 1.45 }, // River bend crag boulder
  { x:  5.25, z: 99.20, r: 1.35 }, // Bastion entry left pier
  { x: -2.95, z: 99.20, r: 1.35 }, // Bastion entry right pier
  // Zone 3: Watchtower Bastion Courtyard landmarks & cliffside crypt nook piers
  { x:  0.65, z: 111.20, r: 1.08 }, // Watchtower Sanctuary Bonfire Hearth
  { x: -6.40, z: 111.00, r: 0.72 }, // Crypt Nook Lore Waystone
  { x: -3.20, z: 106.20, r: 1.05 }, // Crypt entrance south pillar
  { x: -3.20, z: 115.60, r: 1.05 }, // Crypt entrance north pillar
  { x:  6.45, z: 107.40, r: 1.15 }, // Watchtower ruined turret base (river overlook)
  { x:  6.30, z: 115.80, r: 1.15 }, // North-left bastion turret pier
  { x: -2.45, z: 120.40, r: 1.35 }, // Portcullis right gatehouse pylon
  { x:  4.05, z: 120.40, r: 1.35 }  // Portcullis left gatehouse pylon
]);

// All 3D fire hearths along the Gorge Road (fed into burningGroundLight + 3D spatial audio!)
export const GORGE_FIRE_SOURCES = Object.freeze([
  { id: 'gorge_camp_1', x: -2.95, z: 45.20, weight: 0.96, radius: 17.0, lightIntensity: 9.2, alwaysLit: true },
  { id: 'gorge_camp_2', x: -3.55, z: 71.20, weight: 0.94, radius: 17.0, lightIntensity: 9.0, alwaysLit: true },
  { id: 'gorge_watchtower_hearth', x: 0.65, z: 111.20, weight: 1.00, radius: 18.0, lightIntensity: 9.8, alwaysLit: true }
]);

// Procedural PBR 1: Damp Mossy Medieval Cobblestone Road (cool weathered dark-slate stones + wet crevices + olive moss)
function buildMossyCobblePbr(THREE, size, anisotropy, helpers) {
  const { createCanvas2D, createFallbackTex, finalizeCanvasTex, buildSobelNormalTex, buildOrmTex, makeNoiseSampler, trackTex } = helpers;
  const c = createCanvas2D(size, size);
  const hc = createCanvas2D(size, size);
  if (!c || !hc) {
    return {
      albedo: trackTex(createFallbackTex(THREE, 62, 70, 82, 255, true)),
      normal: trackTex(createFallbackTex(THREE, 128, 128, 255, 255, false)),
      orm: trackTex(createFallbackTex(THREE, 200, 175, 175, 255, false))
    };
  }
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const hctx = hc.getContext('2d', { willReadFrequently: true });
  const rng = makeRng(441907);
  const sc = size / 512;

  // Deep damp mud & dark slate grout bed
  ctx.fillStyle = '#141920';
  ctx.fillRect(0, 0, size, size);
  hctx.fillStyle = '#121212';
  hctx.fillRect(0, 0, size, size);

  const rows = 10;
  const rowH = size / rows;
  const drawWrapped = (fn, x, y, r) => {
    const ox0 = x + r > size ? -size : 0;
    const ox1 = x - r < 0 ? size : 0;
    const oy0 = y + r > size ? -size : 0;
    const oy1 = y - r < 0 ? size : 0;
    for (let ox = ox0; ox <= ox1; ox += size) {
      for (let oy = oy0; oy <= oy1; oy += size) {
        ctx.save();
        hctx.save();
        ctx.translate(ox, oy);
        hctx.translate(ox, oy);
        fn();
        ctx.restore();
        hctx.restore();
      }
    }
  };

  // Irregular hand-laid medieval flagstone cobbles (varied widths, rounded corners, mossy seams!)
  for (let r = 0; r < rows; r++) {
    const cols = 6 + (r % 3);
    const colW = size / cols;
    const xOff = (r * 0.37 % 1.0) * colW;
    for (let k = 0; k < cols; k++) {
      const cx = (k * colW + xOff + (rng() - 0.5) * colW * 0.16) % size;
      const cy = (r + 0.5) * rowH + (rng() - 0.5) * rowH * 0.14;
      const bw = colW * (0.76 + rng() * 0.16);
      const bh = rowH * (0.72 + rng() * 0.18);
      const rot = (rng() - 0.5) * 0.14;
      const tone = 68 + Math.floor(rng() * 44);
      const cool = tone + 8 + Math.floor(rng() * 14);
      const isMossy = rng() < 0.24;
      const rr = isMossy ? clamp(tone - 8, 28, 128) : tone;
      const gg = isMossy ? clamp(tone + 14, 34, 140) : tone + 4;
      const bb = isMossy ? clamp(tone - 4, 28, 130) : cool;
      const hv = Math.round(156 + rng() * 88);

      drawWrapped(() => {
        ctx.translate(cx, cy);
        ctx.rotate(rot);
        hctx.translate(cx, cy);
        hctx.rotate(rot);

        const rx = bw * 0.5;
        const ry = bh * 0.5;
        const rad = Math.min(rx, ry) * 0.32;
        const drawRoundStone = (gCtx) => {
          gCtx.beginPath();
          gCtx.moveTo(-rx + rad, -ry);
          gCtx.lineTo(rx - rad, -ry);
          gCtx.quadraticCurveTo(rx, -ry, rx, -ry + rad);
          gCtx.lineTo(rx, ry - rad);
          gCtx.quadraticCurveTo(rx, ry, rx - rad, ry);
          gCtx.lineTo(-rx + rad, ry);
          gCtx.quadraticCurveTo(-rx, ry, -rx, ry - rad);
          gCtx.lineTo(-rx, -ry + rad);
          gCtx.quadraticCurveTo(-rx, -ry, -rx + rad, -ry);
          gCtx.closePath();
        };

        const grd = ctx.createLinearGradient(-rx, -ry, rx, ry);
        grd.addColorStop(0, `rgb(${clamp(rr + 18, 0, 255)},${clamp(gg + 18, 0, 255)},${clamp(bb + 20, 0, 255)})`);
        grd.addColorStop(0.55, `rgb(${rr},${gg},${bb})`);
        grd.addColorStop(1, `rgb(${clamp(rr - 18, 10, 255)},${clamp(gg - 18, 10, 255)},${clamp(bb - 14, 14, 255)})`);
        drawRoundStone(ctx);
        ctx.fillStyle = grd;
        ctx.fill();
        ctx.strokeStyle = 'rgba(6,9,13,0.72)';
        ctx.lineWidth = 2.0 * sc;
        ctx.stroke();

        // Subtle green moss tuck in grout corner
        if (rng() < 0.42) {
          ctx.fillStyle = 'rgba(42, 68, 38, 0.42)';
          ctx.fillRect(-rx, -ry, bw * (0.35 + rng() * 0.3), bh * 0.24);
        }

        const hg = hctx.createRadialGradient(0, 0, Math.min(rx, ry) * 0.15, 0, 0, Math.max(rx, ry) * 1.05);
        hg.addColorStop(0, `rgb(${hv},${hv},${hv})`);
        hg.addColorStop(0.74, `rgb(${Math.round(hv * 0.78)},${Math.round(hv * 0.78)},${Math.round(hv * 0.78)})`);
        hg.addColorStop(1, 'rgb(20,20,20)');
        drawRoundStone(hctx);
        hctx.fillStyle = hg;
        hctx.fill();
      }, cx, cy, Math.max(bw, bh) * 0.7 + 4 * sc);
    }
  }

  const aImg = ctx.getImageData(0, 0, size, size);
  const aPix = aImg.data;
  const hPix = hctx.getImageData(0, 0, size, size).data;
  const total = size * size;
  const heightF = new Float32Array(total);
  const roughF = new Float32Array(total);
  const aoF = new Float32Array(total);
  const nDamp = makeNoiseSampler(16, 4491);
  const nFine = makeNoiseSampler(64, 4492);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const row = y * size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = row + x;
      const p4 = idx * 4;
      const bh = hPix[p4] * (1 / 255);
      const damp = nDamp(u * 2, v * 2);
      const fine = nFine(u * 5, v * 5);
      heightF[idx] = clamp01(bh * 0.76 + fine * 0.24);
      aoF[idx] = clamp01(0.32 + bh * 0.68);
      // Damp glistening sheen in worn stone depressions & crevices (0.42..0.82) -> catches firelight & moonlight!
      const wetPatch = smoothstep(0.45, 0.78, damp);
      roughF[idx] = clamp01(lerp(0.84, 0.44, wetPatch * 0.68) - (1.0 - bh) * 0.10);
      const mod = 0.84 + fine * 0.28;
      aPix[p4]     = clamp(aPix[p4] * mod, 0, 255) | 0;
      aPix[p4 + 1] = clamp(aPix[p4 + 1] * mod, 0, 255) | 0;
      aPix[p4 + 2] = clamp(aPix[p4 + 2] * mod * 1.04, 0, 255) | 0;
    }
  }
  ctx.putImageData(aImg, 0, 0);

  const albedo = trackTex(finalizeCanvasTex(THREE, c, { isColor: true, repeat: true, anisotropy }));
  const normal = trackTex(buildSobelNormalTex(THREE, heightF, size, size, 1.65, anisotropy, true));
  const orm = trackTex(buildOrmTex(THREE, aoF, roughF, size, size, anisotropy, true));
  hc.width = 1;
  hc.height = 1;
  return { albedo, normal, orm };
}

// Procedural PBR 2: Weathered Cool-Slate Ruined Masonry (NO bright white grid mortar — authentic Dark Souls stone!)
function buildRuinedSlateStonePbr(THREE, size, anisotropy, helpers) {
  const { createCanvas2D, createFallbackTex, finalizeCanvasTex, buildSobelNormalTex, buildOrmTex, makeNoiseSampler, trackTex } = helpers;
  const c = createCanvas2D(size, size);
  const hc = createCanvas2D(size, size);
  if (!c || !hc) {
    return {
      albedo: trackTex(createFallbackTex(THREE, 72, 78, 88, 255, true)),
      normal: trackTex(createFallbackTex(THREE, 128, 128, 255, 255, false)),
      orm: trackTex(createFallbackTex(THREE, 200, 195, 195, 255, false))
    };
  }
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const hctx = hc.getContext('2d', { willReadFrequently: true });
  const rng = makeRng(728311);
  const sc = size / 512;

  ctx.fillStyle = '#181d24';
  ctx.fillRect(0, 0, size, size);
  hctx.fillStyle = '#141414';
  hctx.fillRect(0, 0, size, size);

  const rows = 9;
  const rowH = size / rows;
  for (let r = 0; r < rows; r++) {
    const cols = 3 + (r % 2) + (r % 3 === 0 ? 1 : 0);
    const colW = size / cols;
    const xOff = ((r * 0.43) % 1.0) * colW;
    for (let k = -1; k <= cols; k++) {
      const bx = k * colW + xOff + 2.5 * sc;
      const by = r * rowH + 2.5 * sc;
      const bw = colW - 5.0 * sc;
      const bh = rowH - 5.0 * sc;
      const base = 74 + Math.floor(rng() * 34);
      const blu = base + 8 + Math.floor(rng() * 10);
      const hv = Math.round(145 + rng() * 92);

      const g = ctx.createLinearGradient(bx, by, bx, by + bh);
      g.addColorStop(0, `rgb(${base + 12},${base + 14},${blu + 14})`);
      g.addColorStop(0.55, `rgb(${base},${base + 3},${blu})`);
      g.addColorStop(1, `rgb(${Math.max(26, base - 16)},${Math.max(28, base - 14)},${Math.max(32, blu - 12)})`);
      ctx.fillStyle = g;
      ctx.fillRect(bx, by, bw, bh);

      // Aged green moss clinging along top mortar joints
      if (rng() < 0.48) {
        ctx.fillStyle = 'rgba(38, 62, 36, 0.38)';
        ctx.fillRect(bx, by, bw, bh * (0.16 + rng() * 0.26));
      }

      // Vertical rainwater weathering streaks
      if (rng() < 0.36) {
        const sx = bx + bw * (0.12 + rng() * 0.72);
        ctx.fillStyle = 'rgba(10, 14, 20, 0.30)';
        ctx.fillRect(sx, by, (3 + rng() * 6) * sc, bh);
      }

      // Fine hairline crack
      ctx.strokeStyle = 'rgba(8,10,14,0.68)';
      ctx.lineWidth = (1.2 + rng() * 1.1) * sc;
      ctx.beginPath();
      const fx = bx + bw * (0.2 + rng() * 0.6);
      ctx.moveTo(fx, by);
      ctx.lineTo(fx + (rng() - 0.5) * 14 * sc, by + bh * 0.52);
      ctx.lineTo(fx + (rng() - 0.5) * 18 * sc, by + bh);
      ctx.stroke();

      hctx.fillStyle = `rgb(${hv},${hv},${hv})`;
      hctx.fillRect(bx + 1.5 * sc, by + 1.5 * sc, Math.max(2, bw - 3 * sc), Math.max(2, bh - 3 * sc));
    }
  }

  const aImg = ctx.getImageData(0, 0, size, size);
  const aPix = aImg.data;
  const hPix = hctx.getImageData(0, 0, size, size).data;
  const total = size * size;
  const heightF = new Float32Array(total);
  const roughF = new Float32Array(total);
  const aoF = new Float32Array(total);
  const nBroad = makeNoiseSampler(16, 7281);
  const nFine = makeNoiseSampler(64, 7282);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const row = y * size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = row + x;
      const p4 = idx * 4;
      const bh = hPix[p4] * (1 / 255);
      const nb = nBroad(u * 2, v * 2);
      const nf = nFine(u * 5, v * 5);
      heightF[idx] = clamp01(bh * 0.72 + nb * 0.16 + nf * 0.12);
      aoF[idx] = clamp01(0.38 + bh * 0.62);
      roughF[idx] = clamp01(0.74 + (1.0 - nb) * 0.18);
      const mod = 0.82 + nb * 0.22 + nf * 0.16;
      aPix[p4]     = clamp(aPix[p4] * mod, 0, 255) | 0;
      aPix[p4 + 1] = clamp(aPix[p4 + 1] * mod, 0, 255) | 0;
      aPix[p4 + 2] = clamp(aPix[p4 + 2] * mod, 0, 255) | 0;
    }
  }
  ctx.putImageData(aImg, 0, 0);

  const albedo = trackTex(finalizeCanvasTex(THREE, c, { isColor: true, repeat: true, anisotropy }));
  const normal = trackTex(buildSobelNormalTex(THREE, heightF, size, size, 1.45, anisotropy, true));
  const orm = trackTex(buildOrmTex(THREE, aoF, roughF, size, size, anisotropy, true));
  hc.width = 1;
  hc.height = 1;
  return { albedo, normal, orm };
}

// ============================================================================
// Main Factory: createSoulsGorgeRoad(THREE, ctx)
// ============================================================================
export function createSoulsGorgeRoad(THREE, ctx) {
  const {
    parentGroup,
    isMobile,
    lowSpecMode,
    anisotropy,
    WATER_LEVEL,
    evalGroundY,
    getPathCenterX,
    getRiverCenterX,
    getRiverHalfWidth,
    trackGeo,
    trackMat,
    trackTex,
    regNormalMat,
    xformGeo,
    tintGeo,
    mergeNonIndexedGeos,
    buildSculptedRockGeo,
    buildCraggyCliffMassGeo,
    buildCurvedReedBladeGeo,
    createFlameAssemblyMesh,
    addWarmGroundPool,
    alwaysOneUniform,
    uTimeUniform,
    mistSpriteTex,
    extBasaltMat,
    deadTreeMat,
    warmOakMat,
    rustedGrateMat,
    carpetTex,
    barrelBaseGeo,
    crateBaseGeo,
    destructibleProps,
    pbrHelpers
  } = ctx;

  const rng = makeRng(20261125);
  const gorgeGroup = new THREE.Group();
  gorgeGroup.name = 'SoulsGorgeRoadGroup';
  parentGroup.add(gorgeGroup);

  const texRes = isMobile ? 128 : 256;
  const cobblePbr = buildMossyCobblePbr(THREE, texRes, anisotropy, pbrHelpers);
  const ruinStonePbr = buildRuinedSlateStonePbr(THREE, texRes, anisotropy, pbrHelpers);

  const cobbleRoadMat = regNormalMat(
    trackMat(new THREE.MeshStandardMaterial({
      map: cobblePbr.albedo,
      normalMap: lowSpecMode ? null : cobblePbr.normal,
      normalScale: new THREE.Vector2(1.05, 1.05),
      roughnessMap: cobblePbr.orm,
      aoMap: cobblePbr.orm,
      aoMapIntensity: 0.72,
      vertexColors: true,
      color: 0xc2d0e4,
      roughness: 0.78,
      metalness: 0.08
    })),
    cobblePbr.normal
  );

  const ruinStoneMat = regNormalMat(
    trackMat(new THREE.MeshStandardMaterial({
      map: ruinStonePbr.albedo,
      normalMap: lowSpecMode ? null : ruinStonePbr.normal,
      normalScale: new THREE.Vector2(0.95, 0.95),
      roughnessMap: ruinStonePbr.orm,
      aoMap: ruinStonePbr.orm,
      aoMapIntensity: 0.76,
      vertexColors: true,
      color: 0xcad6ea,
      roughness: 0.86,
      metalness: 0.05
    })),
    ruinStonePbr.normal
  );

  const ivyFoliageMat = trackMat(new THREE.MeshStandardMaterial({
    vertexColors: true,
    color: 0x9cb8a2,
    roughness: 0.90,
    metalness: 0.02,
    side: THREE.DoubleSide
  }));

  // Batched geometry buckets (keeps draw calls super lean -> 120–220 FPS!)
  const stoneParts = [];
  const basaltParts = [];
  const woodParts = [];
  const barkParts = [];
  const ironParts = [];
  const foliageParts = [];
  const lanternGlowParts = [];
  const lanternHalos = [];
  const bannerClothParts = [];
  const campSparkPos = [];
  const campSparkSeed = [];

  // --------------------------------------------------------------------------
  // 1. CONTINUOUS DAMP MOSSY COBBLESTONE RIVERSIDE ROAD RIBBON (z = 29 .. 120m)
  //    Terrain-conforming ribbon w/ feathered organic mossy shoulders +
  //    subtle warm amber firelight/lantern pools on the damp flagstones!
  // --------------------------------------------------------------------------
  const bakedRoadWarmPools = [
    { x: -2.95, z: 45.20, r: 5.6, w: 0.42 }, // Zone 1 Campfire
    { x: -2.40, z: 54.80, r: 4.0, w: 0.34 }, // Ivy Archway hanging lantern
    { x: -3.25, z: 66.20, r: 4.2, w: 0.34 }, // Timber Lantern #1
    { x: -3.55, z: 71.20, r: 5.8, w: 0.42 }, // Zone 2 Campfire
    { x: -3.35, z: 75.40, r: 4.2, w: 0.34 }, // Timber Lantern #2
    { x: -1.85, z: 84.20, r: 4.2, w: 0.32 }, // Timber Lantern #3
    { x: -0.35, z: 92.80, r: 4.2, w: 0.32 }, // Timber Lantern #4
    { x:  0.65, z: 111.20, r: 6.4, w: 0.44 } // Zone 3 Watchtower Hearth
  ];

  function buildCobbleRoadRibbonGeo() {
    const zMin = 29.0;
    const zMax = 121.0;
    const zSteps = isMobile ? 76 : 132;
    const xSteps = isMobile ? 8 : 12;
    const pos = new Float32Array((zSteps + 1) * (xSteps + 1) * 3);
    const uv = new Float32Array((zSteps + 1) * (xSteps + 1) * 2);
    const cols = new Float32Array((zSteps + 1) * (xSteps + 1) * 3);
    const indices = [];

    const cCenter = new THREE.Color(0x98a6bc);
    const cEdge = new THREE.Color(0x475a4e);
    const cWarm = new THREE.Color(0xdc7a26);
    const cTmp = new THREE.Color();

    for (let iz = 0; iz <= zSteps; iz++) {
      const v = iz / zSteps;
      const z = lerp(zMin, zMax, v);
      const pathX = getPathCenterX(z);
      // Road widens gracefully into the Watchtower Bastion Courtyard at z = 102..119!
      const courtT = smoothstep(99.5, 104.5, z) * (1.0 - smoothstep(118.5, 121.5, z));
      const halfW = lerp(2.85, 5.5, courtT) + Math.sin(z * 0.21) * 0.24;
      for (let ix = 0; ix <= xSteps; ix++) {
        const u = ix / xSteps;
        const nx = u * 2.0 - 1.0; // -1 (right cliff edge) .. +1 (left river edge)
        const edgeJitter = (Math.sin(z * 0.95 + nx * 3.1) * 0.28 + Math.cos(z * 1.7 - nx * 2.2) * 0.14) * Math.abs(nx);
        const wx = pathX + nx * halfW + edgeJitter;
        // Feathered edge tuck smoothly beneath surrounding coastal gravel so there is ZERO straight ribbon seam!
        const edgeSink = smoothstep(0.62, 1.0, Math.abs(nx)) * 0.14;
        const gy = evalGroundY(wx, z);
        const wy = gy + 0.042 - edgeSink;

        const vi = iz * (xSteps + 1) + ix;
        pos[vi * 3]     = wx;
        pos[vi * 3 + 1] = wy;
        pos[vi * 3 + 2] = z;
        uv[vi * 2]     = wx * 0.34;
        uv[vi * 2 + 1] = z * 0.34;

        const edgeBlend = smoothstep(0.62, 1.0, Math.abs(nx));
        cTmp.copy(cCenter).lerp(cEdge, edgeBlend * 0.72);
        // Subtle mossy mottled variation along road stones
        const mossWave = 0.5 + 0.5 * Math.sin(wx * 0.65 + z * 0.43) * Math.cos(z * 0.51 - wx * 0.37);
        if (mossWave > 0.62) {
          cTmp.lerp(cEdge, (mossWave - 0.62) * 0.65);
        }
        let wSum = 0;
        for (let pi = 0; pi < bakedRoadWarmPools.length; pi++) {
          const bp = bakedRoadWarmPools[pi];
          const d = Math.hypot(wx - bp.x, z - bp.z);
          if (d < bp.r) {
            const f = 1.0 - d / bp.r;
            wSum += f * f * bp.w;
          }
        }
        if (wSum > 0.005) {
          cTmp.lerp(cWarm, Math.min(0.82, wSum));
        }
        cols[vi * 3]     = cTmp.r;
        cols[vi * 3 + 1] = cTmp.g;
        cols[vi * 3 + 2] = cTmp.b;
      }
    }
    for (let iz = 0; iz < zSteps; iz++) {
      for (let ix = 0; ix < xSteps; ix++) {
        const a = iz * (xSteps + 1) + ix;
        const b = (iz + 1) * (xSteps + 1) + ix;
        const d = iz * (xSteps + 1) + (ix + 1);
        const e = (iz + 1) * (xSteps + 1) + (ix + 1);
        indices.push(a, b, e, a, e, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }

  const cobbleRoadMesh = new THREE.Mesh(trackGeo(buildCobbleRoadRibbonGeo()), cobbleRoadMat);
  cobbleRoadMesh.receiveShadow = true;
  gorgeGroup.add(cobbleRoadMesh);

  // Tactile raised relief cobble slabs & mossy edge kerbstones along the road (gives real 3D silhouette!)
  for (let pz = 33.5; pz <= 98.0; pz += 2.3) {
    const px = getPathCenterX(pz);
    for (let k = 0; k < 2; k++) {
      const sx = px + (k === 0 ? -1.15 : 1.05) + (rng() - 0.5) * 0.7;
      const sz = pz + (rng() - 0.5) * 0.7;
      const gy = evalGroundY(sx, sz);
      const sw = 0.65 + rng() * 0.55;
      const sd = 0.52 + rng() * 0.42;
      const slab = new THREE.BoxGeometry(sw, 0.10, sd);
      xformGeo(slab, sx, gy + 0.015, sz, (rng() - 0.5) * 0.04, (rng() - 0.5) * 0.45, (rng() - 0.5) * 0.04);
      stoneParts.push(tintGeo(THREE, slab, rng() < 0.35 ? 0x6f8472 : 0x8e9cb2, 0x3b4454));
    }
  }

  // --------------------------------------------------------------------------
  // Reusable Architectural Builders (Timber Gallows Lantern, Campfire, Column, Gnarled Tree, Pine)
  // --------------------------------------------------------------------------
  function addTimberGallowsLantern(lx, lz, { postH = 3.55, armDirX = 1.0, armDirZ = 0.0, lean = 0.04, poolR = 4.6, poolStr = 0.48 } = {}) {
    const gy = evalGroundY(lx, lz);
    const yaw = Math.atan2(armDirX, armDirZ);
    const dx = Math.sin(yaw);
    const dz = Math.cos(yaw);
    // Stone base footing
    stoneParts.push(tintGeo(THREE, xformGeo(new THREE.CylinderGeometry(0.20, 0.28, 0.24, 6), lx, gy + 0.10, lz), 0x7b889c, 0x333b4a));
    // Heavy square weathered timber post (matches video gallows-style wooden lamp posts!)
    woodParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(0.17, postH, 0.17), lx, gy + postH * 0.5, lz, lean * 0.5, yaw, -lean * 0.5), 0x8a6d50, 0x34261c));
    // Top overhanging wooden arm & diagonal wooden brace strut!
    const topY = gy + postH - 0.18;
    const armLen = 1.08;
    woodParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(0.12, 0.13, armLen), lx + dx * (armLen * 0.44), topY, lz + dz * (armLen * 0.44), 0, yaw, 0), 0x8f7154, 0x38291e));
    // 45-deg diagonal support strut under bracket
    woodParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(0.09, 0.09, 0.82), lx + dx * 0.34, topY - 0.34, lz + dz * 0.34, -0.78, yaw, 0), 0x7d6248, 0x2f2218));
    // Hanging iron hook & forged cage lantern
    const lampX = lx + dx * (armLen * 0.82);
    const lampY = topY - 0.44;
    const lampZ = lz + dz * (armLen * 0.82);
    ironParts.push(xformGeo(new THREE.CylinderGeometry(0.018, 0.018, 0.24, 5), lampX, topY - 0.14, lampZ));
    ironParts.push(xformGeo(new THREE.ConeGeometry(0.18, 0.16, 4), lampX, lampY + 0.22, lampZ, 0, Math.PI * 0.25, 0));
    ironParts.push(xformGeo(new THREE.CylinderGeometry(0.15, 0.11, 0.06, 4), lampX, lampY - 0.16, lampZ, 0, Math.PI * 0.25, 0));
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI * 0.25;
      ironParts.push(xformGeo(new THREE.CylinderGeometry(0.013, 0.013, 0.34, 4), lampX + Math.cos(a) * 0.12, lampY + 0.03, lampZ + Math.sin(a) * 0.12));
    }
    lanternGlowParts.push(xformGeo(new THREE.CylinderGeometry(0.105, 0.088, 0.28, 6), lampX, lampY + 0.03, lampZ));
    lanternHalos.push({ x: lampX, y: lampY + 0.03, z: lampZ, size: 1.85 });
    addWarmGroundPool(lampX, lampZ, poolR, [1.12, 0.56, 0.14], poolStr, alwaysOneUniform, lx * 0.7 + lz * 0.5);
  }

  function addHangingWallLantern(lampX, lampY, lampZ, armFromX, armFromZ, poolR = 4.4, poolStr = 0.46) {
    const dx = lampX - armFromX;
    const dz = lampZ - armFromZ;
    const len = Math.hypot(dx, dz);
    const yaw = Math.atan2(dx, dz);
    woodParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(0.11, 0.11, len + 0.22), (lampX + armFromX) * 0.5, lampY + 0.42, (lampZ + armFromZ) * 0.5, 0, yaw, 0), 0x8a6d50, 0x35261c));
    woodParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(0.08, 0.08, len * 0.9), (lampX + armFromX) * 0.5, lampY + 0.16, (lampZ + armFromZ) * 0.5, -0.68, yaw, 0), 0x7b6047, 0x2e2118));
    ironParts.push(xformGeo(new THREE.CylinderGeometry(0.016, 0.016, 0.20, 5), lampX, lampY + 0.30, lampZ));
    ironParts.push(xformGeo(new THREE.ConeGeometry(0.18, 0.16, 4), lampX, lampY + 0.18, lampZ, 0, Math.PI * 0.25, 0));
    ironParts.push(xformGeo(new THREE.CylinderGeometry(0.14, 0.10, 0.06, 4), lampX, lampY - 0.18, lampZ, 0, Math.PI * 0.25, 0));
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI * 0.25;
      ironParts.push(xformGeo(new THREE.CylinderGeometry(0.013, 0.013, 0.34, 4), lampX + Math.cos(a) * 0.11, lampY, lampZ + Math.sin(a) * 0.11));
    }
    lanternGlowParts.push(xformGeo(new THREE.CylinderGeometry(0.10, 0.084, 0.26, 6), lampX, lampY, lampZ));
    lanternHalos.push({ x: lampX, y: lampY, z: lampZ, size: 1.85 });
    addWarmGroundPool(lampX, lampZ, poolR, [1.14, 0.56, 0.14], poolStr, alwaysOneUniform, lampX + lampZ * 0.6);
  }

  function addWaysideCampfire(cx, cz, { scale = 1.0, flameH = 1.72, poolR = 6.2 } = {}) {
    const gy = evalGroundY(cx, cz);
    // Hearth ring of 14 rounded mossy/soot-stained stones (exact look from video frame_00 & frame_05!)
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + (rng() - 0.5) * 0.12;
      const rr = (0.78 + (i % 2) * 0.09) * scale;
      const st = buildSculptedRockGeo(THREE, (0.21 + (i % 3) * 0.035) * scale, 1400 + i + Math.floor(cz * 7), 0.66, 1);
      xformGeo(st, cx + Math.cos(a) * rr, gy + 0.10 * scale, cz + Math.sin(a) * rr, 0, a, 0);
      basaltParts.push(tintGeo(THREE, st, 0x707a8a, 0x262b36));
    }
    // Teepee-stacked split firewood logs converging over glowing coals!
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.22;
      const logLen = (0.98 + (i % 3) * 0.14) * scale;
      const log = new THREE.CylinderGeometry(0.048 * scale, 0.072 * scale, logLen, 6);
      const tilt = 0.58 + (i % 2) * 0.12;
      xformGeo(
        log,
        cx + Math.cos(a) * 0.24 * scale,
        gy + 0.34 * scale,
        cz + Math.sin(a) * 0.24 * scale,
        Math.sin(a) * tilt,
        a,
        -Math.cos(a) * tilt
      );
      woodParts.push(tintGeo(THREE, log, 0x5c4230, 0x1d130e));
    }
    // Procedural Charred Ash & Glowing Molten Ember Coal Bed (ZERO flat orange circle!)
    const coalMat = trackMat(new THREE.ShaderMaterial({
      uniforms: { uTime: uTimeUniform },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        float hash21(vec2 p) {
          p = fract(p * vec2(127.1, 311.7));
          p += dot(p, p + 34.53);
          return fract(p.x * p.y);
        }
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p);
          if (r > 1.0) discard;
          float cell = hash21(floor(vUv * 16.0));
          float fine = hash21(floor(vUv * 34.0));
          float pulse = 0.72 + 0.28 * sin(uTime * 5.8 + cell * 14.0);
          float radial = 1.0 - smoothstep(0.15, 0.96, r);
          float cracks = smoothstep(0.35, 0.88, cell * 0.65 + fine * 0.35);
          vec3 ashCol = vec3(0.05, 0.03, 0.025);
          vec3 emberCol = mix(vec3(0.85, 0.16, 0.02), vec3(2.15, 0.78, 0.14), cracks * pulse);
          float hotMask = radial * (0.28 + 0.72 * cracks) * (1.0 - smoothstep(0.45, 0.92, r));
          vec3 col = mix(ashCol, emberCol, clamp(hotMask * 1.25, 0.0, 1.0));
          gl_FragColor = vec4(col, radial * 0.96);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      depthWrite: false
    }));
    const coalDisc = new THREE.Mesh(trackGeo(new THREE.CircleGeometry(0.74 * scale, 18)), coalMat);
    coalDisc.rotation.x = -Math.PI * 0.5;
    coalDisc.position.set(cx, gy + 0.09, cz);
    gorgeGroup.add(coalDisc);

    // Volumetric multi-tongue Souls fire assembly + smooth warm amber ground pool + rising sparks
    const flame = createFlameAssemblyMesh(1.12 * scale, flameH * scale, alwaysOneUniform);
    flame.position.set(cx, gy + 0.14, cz);
    gorgeGroup.add(flame);

    addWarmGroundPool(cx, cz, poolR, [1.08, 0.42, 0.08], 0.44, alwaysOneUniform, cx * 1.1 + cz * 0.4);

    const sparkCnt = isMobile ? 16 : 30;
    for (let si = 0; si < sparkCnt; si++) {
      campSparkPos.push(cx, gy + 0.32, cz);
      campSparkSeed.push(rng(), 0.55 + rng() * 0.9, 0.12 + rng() * 0.42);
    }
  }

  function addRuinedColumn(cx, cz, height, { radius = 0.52, hasCapital = true, leanX = 0, leanZ = 0 } = {}) {
    const gy = evalGroundY(cx, cz);
    // Stepped square plinth pedestal
    stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(radius * 2.95, 0.42, radius * 2.95), cx, gy + 0.18, cz), 0x8692a6, 0x353c4c));
    stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(radius * 2.45, 0.34, radius * 2.45), cx, gy + 0.54, cz), 0x8c99ae, 0x3a4254));
    // Molded torus base collar
    stoneParts.push(tintGeo(THREE, xformGeo(new THREE.CylinderGeometry(radius * 1.12, radius * 1.24, 0.26, 12), cx, gy + 0.80, cz), 0x909db2, 0x3e4658));
    // Multi-drum weathered cylindrical column shaft (stacked stone drums w/ slight aged misalignment!)
    const drumCount = Math.max(3, Math.round(height / 1.15));
    const drumH = (height - 0.85) / drumCount;
    for (let d = 0; d < drumCount; d++) {
      const f = d / Math.max(1, drumCount - 1);
      const rTop = radius * (1.0 - f * 0.08);
      const rBot = radius * (1.03 - f * 0.07);
      const dx = leanX * f + (d % 2 === 0 ? 0.018 : -0.015);
      const dz = leanZ * f + (d % 3 === 0 ? -0.015 : 0.012);
      const yDrum = gy + 0.92 + (d + 0.5) * drumH;
      stoneParts.push(tintGeo(
        THREE,
        xformGeo(new THREE.CylinderGeometry(rTop, rBot, drumH * 0.96, 12), cx + dx, yDrum, cz + dz, leanZ * 0.05, d * 0.55, -leanX * 0.05),
        d % 2 === 0 ? 0x8e9bb0 : 0x8290a4,
        0x3a4252
      ));
    }
    if (hasCapital) {
      const capY = gy + height + 0.12;
      stoneParts.push(tintGeo(THREE, xformGeo(new THREE.CylinderGeometry(radius * 1.32, radius * 0.96, 0.36, 12), cx + leanX, capY, cz + leanZ), 0x94a2b8, 0x414a5c));
      stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(radius * 2.85, 0.32, radius * 2.85), cx + leanX, capY + 0.32, cz + leanZ), 0x9aa8bf, 0x454f62));
    } else {
      // Jagged broken fracture crown on top of shorter column
      const topY = gy + height + 0.05;
      stoneParts.push(tintGeo(THREE, xformGeo(new THREE.CylinderGeometry(radius * 0.78, radius * 0.94, 0.32, 9), cx + leanX + 0.06, topY, cz + leanZ - 0.04, 0.16, 0.4, -0.18), 0x8896ac, 0x3b4354));
    }
  }

  function addGnarledRootTree(tx, tz, { height = 6.2, leanX = 0.22, leanZ = -0.08, yaw = 0.4, sprawlingRoots = 7, rootSpread = 3.4 } = {}) {
    const gy = evalGroundY(tx, tz);
    // Thick twisting lower & upper bare trunk
    barkParts.push(tintGeo(THREE, xformGeo(new THREE.CylinderGeometry(0.32, 0.62, height * 0.52, 8), tx, gy + height * 0.23, tz, leanZ, yaw, -leanX), 0x4c423a, 0x1c1714));
    const midX = tx + Math.sin(leanX) * height * 0.42;
    const midY = gy + height * 0.48;
    const midZ = tz + Math.sin(leanZ) * height * 0.42;
    barkParts.push(tintGeo(THREE, xformGeo(new THREE.CylinderGeometry(0.11, 0.33, height * 0.52, 7), midX, midY + height * 0.22, midZ, leanZ * 1.35, yaw + 0.4, -leanX * 1.25), 0x564c44, 0x221d1a));

    // Sprawling sinuous 3D roots crawling out across the mossy cobbles & gripping the cliff!
    for (let r = 0; r < sprawlingRoots; r++) {
      const ra = yaw + (r / sprawlingRoots) * Math.PI * 2 + (rng() - 0.5) * 0.28;
      // Bias extra roots crawling outward toward the road (+X) for dramatic silhouette!
      const isRoadSide = Math.cos(ra) > -0.15;
      const segs = 3;
      let px = tx + Math.cos(ra) * 0.34;
      let pz = tz + Math.sin(ra) * 0.34;
      let py = gy + 0.52;
      const totalReach = rootSpread * (isRoadSide ? (0.85 + rng() * 0.45) : (0.55 + rng() * 0.35));
      for (let s = 0; s < segs; s++) {
        const f0 = s / segs;
        const f1 = (s + 1) / segs;
        const segAng = ra + Math.sin(s * 2.1 + r * 1.7) * 0.34;
        const stepL = totalReach / segs;
        const nx = px + Math.cos(segAng) * stepL;
        const nz = pz + Math.sin(segAng) * stepL;
        const ngy = evalGroundY(nx, nz);
        const ny = lerp(gy + 0.52, ngy + 0.04, Math.pow(f1, 0.72));
        const dx = nx - px;
        const dy = ny - py;
        const dz = nz - pz;
        const segLen = Math.hypot(dx, dy, dz) + 0.08;
        const rootGeo = new THREE.CylinderGeometry(lerp(0.14, 0.032, f1), lerp(0.19, 0.052, f0), segLen, 6);
        const q = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(dx, dy, dz).normalize()
        );
        rootGeo.applyQuaternion(q);
        rootGeo.translate((px + nx) * 0.5, (py + ny) * 0.5, (pz + nz) * 0.5);
        barkParts.push(tintGeo(THREE, rootGeo, 0x52483e, 0x1d1916));
        px = nx; py = ny; pz = nz;
      }
    }

    // Crooked bare skeletal branches clawing up into the nocturnal sky
    for (let b = 0; b < 6; b++) {
      const ba = yaw + b * 1.18 + 0.25;
      const by = midY + (b - 1.2) * height * 0.11;
      const blen = 1.45 + (b % 3) * 0.65;
      const br = new THREE.CylinderGeometry(0.032, 0.11, blen, 5);
      xformGeo(br, midX + Math.cos(ba) * blen * 0.42, by + 0.28, midZ + Math.sin(ba) * blen * 0.42, Math.sin(ba) * 1.05, ba, Math.cos(ba) * 1.05);
      barkParts.push(tintGeo(THREE, br, 0x584f4a, 0x221d1a));
    }
  }

  function addNordicPine(tx, tz, h = 8.4, leanX = 0.08, leanZ = 0.04, ry = 0) {
    const gy = evalGroundY(tx, tz) - 0.35;
    barkParts.push(tintGeo(THREE, xformGeo(new THREE.CylinderGeometry(0.12, 0.34, h * 0.85, 6), tx, gy + h * 0.40, tz, leanZ, ry, -leanX), 0x3b3332, 0x151215));
    const tiers = [
      { yF: 0.32, boughs: 7, len: h * 0.32, w: 0.86, droop: 0.46, tc: 0x1b3329, bc: 0x09130f },
      { yF: 0.48, boughs: 7, len: h * 0.27, w: 0.74, droop: 0.42, tc: 0x203b2f, bc: 0x0b1712 },
      { yF: 0.64, boughs: 6, len: h * 0.21, w: 0.60, droop: 0.36, tc: 0x264437, bc: 0x0e1c16 },
      { yF: 0.79, boughs: 5, len: h * 0.15, w: 0.45, droop: 0.28, tc: 0x2d4e40, bc: 0x12231c }
    ];
    for (let ti = 0; ti < tiers.length; ti++) {
      const td = tiers[ti];
      const ox = tx + Math.sin(leanX) * h * td.yF * 0.6;
      const oy = gy + h * td.yF;
      const oz = tz + Math.sin(leanZ) * h * td.yF * 0.6;
      for (let bi = 0; bi < td.boughs; bi++) {
        const ang = ry + ti * 0.7 + (bi / td.boughs) * Math.PI * 2;
        const bough = new THREE.ConeGeometry(td.w, td.len, 5, 1);
        bough.scale(1.0, 1.0, 0.36);
        bough.rotateX(Math.PI * 0.5 + td.droop);
        bough.rotateY(ang);
        bough.translate(ox + Math.sin(ang) * td.len * 0.46, oy - Math.sin(td.droop) * td.len * 0.26, oz + Math.cos(ang) * td.len * 0.46);
        foliageParts.push(tintGeo(THREE, bough, td.tc, td.bc));
      }
    }
    const crown = new THREE.ConeGeometry(0.55, h * 0.24, 5);
    xformGeo(crown, tx + Math.sin(leanX) * h * 0.55, gy + h * 0.94, tz + Math.sin(leanZ) * h * 0.55, leanZ * 0.5, ry, -leanX * 0.5);
    foliageParts.push(tintGeo(THREE, crown, 0x2f5244, 0x101e18));
  }

  function addBrokenPlanksCluster(cx, cz, count = 6) {
    for (let i = 0; i < count; i++) {
      const ox = cx + (rng() - 0.5) * 2.2;
      const oz = cz + (rng() - 0.5) * 2.4;
      const gy = evalGroundY(ox, oz);
      const pLen = 1.15 + rng() * 1.10;
      const pW = 0.16 + rng() * 0.08;
      const plank = new THREE.BoxGeometry(pW, 0.045, pLen);
      const tilt = i === 0 ? 0.09 : (rng() - 0.5) * 0.05;
      xformGeo(plank, ox, gy + 0.055 + (i === 0 ? 0.03 : 0), oz, tilt, rng() * Math.PI, (rng() - 0.5) * 0.05);
      woodParts.push(tintGeo(THREE, plank, 0x7b634b, 0x33261d));
    }
  }

  function addFallenMossyLog(cx, cz, len = 3.2, yaw = 0.22, rad = 0.34) {
    const gy = evalGroundY(cx, cz);
    const log = new THREE.CylinderGeometry(rad * 0.84, rad * 1.06, len, 9);
    xformGeo(log, cx, gy + rad * 0.68, cz, Math.PI * 0.5 + 0.05, yaw, 0.04);
    barkParts.push(tintGeo(THREE, log, 0x62503e, 0x241c15));
    // Moss clumps perched atop the weathered fallen log
    for (let m = 0; m < 4; m++) {
      const f = (m / 3 - 0.5) * len * 0.65;
      const mx = cx + Math.sin(yaw) * f;
      const mz = cz + Math.cos(yaw) * f;
      const tuft = buildSculptedRockGeo(THREE, rad * 0.62, 1600 + m + Math.floor(cz), 0.38, 1);
      xformGeo(tuft, mx, gy + rad * 1.24, mz, 0, m * 1.3, 0);
      foliageParts.push(tintGeo(THREE, tuft, 0x3f6137, 0x1a2c18));
    }
  }

  function addHangingIvyPatch(ix, iy, iz, width, dropH, faceYaw = 0, strands = 10) {
    const cosY = Math.cos(faceYaw);
    const sinY = Math.sin(faceYaw);
    for (let s = 0; s < strands; s++) {
      const f = (s / Math.max(1, strands - 1) - 0.5) * width;
      const sDrop = dropH * (0.55 + rng() * 0.55);
      const leafSteps = Math.max(4, Math.round(sDrop / 0.36));
      for (let l = 0; l < leafSteps; l++) {
        const lf = l / leafSteps;
        const lx = ix + cosY * (f + Math.sin(l * 1.4 + s) * 0.12) + sinY * 0.14;
        const ly = iy - lf * sDrop;
        const lz = iz - sinY * (f + Math.sin(l * 1.4 + s) * 0.12) + cosY * 0.14;
        const leaf = new THREE.DodecahedronGeometry(0.18 + rng() * 0.13, 0);
        leaf.scale(1.15, 0.85, 0.52);
        xformGeo(leaf, lx, ly, lz, rng() * 1.5, faceYaw + (rng() - 0.5) * 0.8, rng() * 1.5);
        foliageParts.push(tintGeo(THREE, leaf, 0x355832, 0x152716));
      }
    }
  }

  function addDestructibleProp(x, z, kind = 'crate', rotY = null) {
    const gy = evalGroundY(x, z);
    const mesh = new THREE.Mesh(kind === 'barrel' ? barrelBaseGeo : crateBaseGeo, warmOakMat);
    mesh.position.set(x, gy - 0.01, z);
    mesh.rotation.y = rotY !== null ? rotY : (rng() * 6.28);
    mesh.receiveShadow = true;
    gorgeGroup.add(mesh);
    destructibleProps.push({ x, y: gy, z, r: 0.52, broken: false, mesh });
  }

  // --------------------------------------------------------------------------
  // 2. ZONE 1 (z = 31..59): «Тракт Древней Арки» — EXACT COPY OF VIDEO PART 1!
  // --------------------------------------------------------------------------
  // Scattered broken wooden planks across foreground cobbles (frame_00 & frame_02!)
  addBrokenPlanksCluster(-1.85, 38.6, 7);
  addBrokenPlanksCluster(-2.25, 42.4, 5);

  // Massive ancient gnarled dead tree on foreground-right with sprawling roots gripping the stones (frame_00!)
  addGnarledRootTree(-6.15, 39.10, { height: 7.4, leanX: 0.24, leanZ: -0.10, yaw: 0.35, sprawlingRoots: 7, rootSpread: 2.65 });

  // Blazing Wayside Campfire beside road (frame_00, frame_02, frame_03!)
  addWaysideCampfire(GORGE_ROAD_ANCHORS.camp1Pos.x, GORGE_ROAD_ANCHORS.camp1Pos.z, { scale: 1.0, flameH: 1.78, poolR: 6.4 });

  // Fallen mossy tree log, wooden crates, rubble & TWO iconic ruined cylindrical columns behind campfire (frame_00 & frame_02!)
  addFallenMossyLog(-4.65, 46.35, 3.25, 0.34, 0.34);
  addRuinedColumn(-5.75, 46.10, 4.95, { radius: 0.50, hasCapital: true, leanX: 0.04, leanZ: -0.02 });
  addRuinedColumn(-6.10, 49.45, 3.75, { radius: 0.47, hasCapital: false, leanX: -0.05, leanZ: 0.03 });

  // Crumbling stepped stone low wall & masonry rubble between the twin columns (frame_00!)
  {
    const wy = evalGroundY(-5.85, 47.75);
    stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(1.15, 1.55, 2.35), -5.85, wy + 0.72, 47.75, 0, 0.08, 0), 0x8290a6, 0x333c4c));
    stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(1.05, 0.92, 1.40), -5.35, wy + 0.42, 47.35, 0, 0.14, 0), 0x8997ad, 0x384152));
    for (let rb = 0; rb < 9; rb++) {
      const rx = -4.55 - rng() * 2.4;
      const rz = 45.2 + rng() * 5.2;
      const rgy = evalGroundY(rx, rz);
      const blk = new THREE.BoxGeometry(0.42 + rng() * 0.34, 0.28 + rng() * 0.22, 0.38 + rng() * 0.28);
      xformGeo(blk, rx, rgy + 0.13, rz, (rng() - 0.5) * 0.45, rng() * 3.14, (rng() - 0.5) * 0.4);
      stoneParts.push(tintGeo(THREE, blk, 0x7c8aa0, 0x303848));
    }
  }

  // Interactive smashable wooden crates & barrel right beside Zone 1 camp & archway!
  addDestructibleProp(-3.85, 44.10, 'crate', 0.35);
  addDestructibleProp(-3.65, 46.85, 'crate', 1.12);
  addDestructibleProp(-4.25, 51.80, 'barrel', 0.40);
  addDestructibleProp(-4.85, 52.55, 'crate', 0.85);

  // HERO LANDMARK 1 (z = 55.5): OPEN IVY-DRAPED RUINED STONE ARCHWAY (EXACT COPY OF frame_00..frame_03!)
  {
    const az = 55.5;
    const midX = -0.60;
    const leftPierX = 2.45;  // +X = river side (screen left!)
    const rightPierX = -3.65; // -X = cliff side (screen right!)
    const halfSpan = (leftPierX - rightPierX) * 0.5; // 3.05m -> ~4.8m clear opening!
    const gyL = evalGroundY(leftPierX, az);
    const gyR = evalGroundY(rightPierX, az);
    const baseY = Math.max(gyL, gyR);

    // Left (river-side) pier + stepped crumbling ruined wing wall extending out toward the river!
    stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(1.48, 0.55, 1.68), leftPierX, gyL + 0.22, az), 0x808ea4, 0x323a4a));
    stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(1.24, 4.15, 1.38), leftPierX, gyL + 2.35, az), 0x7b899f, 0x2f3746));
    stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(1.42, 0.32, 1.56), leftPierX, gyL + 4.46, az), 0x8e9cb2, 0x3b4456));
    // Crumbling wing wall on left (+X) stepping down cleanly toward the riverbank (matches frame_02 & frame_03!)
    stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(1.85, 3.65, 1.18), leftPierX + 1.45, gyL + 1.75, az - 0.08), 0x76859b, 0x2c3442));
    stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(1.25, 2.55, 1.10), leftPierX + 2.82, gyL + 1.22, az - 0.16), 0x718096, 0x29303e));
    // Jagged broken top merlon masonry blocks on left wall
    stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(0.78, 0.72, 1.05), leftPierX + 1.10, gyL + 3.85, az - 0.06), 0x8493aa, 0x363f50));
    stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(0.66, 0.58, 0.96), leftPierX + 3.15, gyL + 2.68, az - 0.18), 0x7f8ea4, 0x323b4c));
    // Lush dark-green hanging ivy draped down the left wall & arch shoulder (frame_02 & frame_03!)
    addHangingIvyPatch(leftPierX + 0.75, gyL + 3.95, az - 0.68, 2.25, 2.75, 0, 12);
    addHangingIvyPatch(leftPierX + 0.55, gyL + 3.85, az + 0.68, 1.95, 2.45, Math.PI, 9);

    // Right (cliff-side) pier + thick weathered buttress wall tying seamlessly into the right cliff!
    stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(1.56, 0.55, 1.72), rightPierX, gyR + 0.22, az), 0x8290a6, 0x333b4b));
    stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(1.36, 4.35, 1.46), rightPierX, gyR + 2.45, az), 0x7e8ca2, 0x313949));
    stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(1.54, 0.34, 1.64), rightPierX, gyR + 4.58, az), 0x909eb4, 0x3c4557));
    // Stepped masonry shoulder connecting right pier into the basalt cliff face
    stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(3.25, 3.85, 1.32), rightPierX - 2.10, gyR + 1.85, az + 0.12), 0x748298, 0x2b3240));
    stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(1.40, 0.95, 1.24), rightPierX - 0.92, gyR + 4.10, az + 0.08), 0x8493a8, 0x363e4f));

    // Semicircular Weathered Romanesque/Gothic Stone Arch Ring (OPEN, COMPLETE & WEATHERED like frame_02 & frame_03!)
    const archSegs = 14;
    for (let i = 0; i < archSegs; i++) {
      const a0 = (i / archSegs) * Math.PI;
      const a1 = ((i + 1) / archSegs) * Math.PI;
      const x0 = midX - Math.cos(a0) * halfSpan;
      const y0 = baseY + 4.35 + Math.sin(a0) * (halfSpan * 0.96);
      const x1 = midX - Math.cos(a1) * halfSpan;
      const y1 = baseY + 4.35 + Math.sin(a1) * (halfSpan * 0.96);
      const len = Math.hypot(x1 - x0, y1 - y0) + 0.14;
      const ang = Math.atan2(y1 - y0, x1 - x0);
      const thick = 0.62 + (i % 2) * 0.08;
      stoneParts.push(tintGeo(
        THREE,
        xformGeo(new THREE.BoxGeometry(len, thick, 1.22), (x0 + x1) * 0.5, (y0 + y1) * 0.5, az, 0, 0, ang),
        i % 3 === 0 ? 0x74887c : 0x8b99af,
        0x394254
      ));
    }
    // Hanging warm iron lantern mounted on wooden gallows bracket right inside the right pier (frame_03!)
    addHangingWallLantern(rightPierX + 1.05, gyR + 2.95, az - 0.62, rightPierX + 0.35, az - 0.62, 4.6, 0.50);

    // Stark bare dead twisted tree with clawing roots hugging the right pier flank (frame_02 & frame_03!)
    addGnarledRootTree(-5.35, 54.55, { height: 5.9, leanX: 0.14, leanZ: 0.06, yaw: 1.85, sprawlingRoots: 6, rootSpread: 2.35 });
  }

  // --------------------------------------------------------------------------
  // 3. ZONE 2 (z = 59..97): «Фонарная Набережная» — EXACT COPY OF VIDEO PART 2 (frame_05 & frame_07)!
  // --------------------------------------------------------------------------
  // Foreground broken wooden planks & sprawling cliff root tree right past the archway (frame_05!)
  addBrokenPlanksCluster(-1.95, 63.4, 7);
  addGnarledRootTree(-6.85, 64.2, { height: 6.4, leanX: 0.28, leanZ: 0.05, yaw: 0.55, sprawlingRoots: 6, rootSpread: 2.55 });

  // ICONIC ROW OF 4 TALL WOODEN GALLOWS-STYLE LANTERN POSTS curving down the right side of the road!
  // (1:1 visual rhythm from frame_05_t10.0s.jpg & frame_07_t14.8s.jpg!)
  addTimberGallowsLantern(-4.05, 66.20, { postH: 3.65, armDirX:  0.96, armDirZ:  0.22, lean:  0.03, poolR: 4.8, poolStr: 0.50 });
  addTimberGallowsLantern(-4.15, 75.40, { postH: 3.60, armDirX:  0.98, armDirZ:  0.14, lean: -0.03, poolR: 4.8, poolStr: 0.50 });
  addTimberGallowsLantern(-2.65, 84.20, { postH: 3.55, armDirX:  0.96, armDirZ: -0.18, lean:  0.04, poolR: 4.8, poolStr: 0.48 });
  addTimberGallowsLantern(-1.15, 92.80, { postH: 3.55, armDirX:  0.92, armDirZ: -0.26, lean: -0.03, poolR: 4.8, poolStr: 0.48 });

  // Second Roadside Campfire («Привал Фонарного Тракта») + crates + fallen mossy log + stone column + TALL CRIMSON BANNER (frame_05!)
  addWaysideCampfire(GORGE_ROAD_ANCHORS.camp2Pos.x, GORGE_ROAD_ANCHORS.camp2Pos.z, { scale: 0.96, flameH: 1.65, poolR: 6.2 });
  addFallenMossyLog(-5.65, 71.60, 3.15, -0.18, 0.34);
  addRuinedColumn(-6.45, 73.10, 4.15, { radius: 0.48, hasCapital: false, leanX: 0.03, leanZ: 0.02 });
  {
    const rwy = evalGroundY(-6.15, 70.35);
    stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(1.15, 1.75, 2.05), -6.15, rwy + 0.85, 70.35, 0, -0.12, 0), 0x808ea4, 0x323b4a));
    stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(0.95, 1.05, 1.35), -5.45, rwy + 0.52, 70.05, 0, -0.06, 0), 0x8795ac, 0x364050));
    // Tall weathered vertical war-banner pole w/ tattered crimson pennant high beside the column (frame_05 right!)
    const bgy = evalGroundY(-6.30, 71.40);
    woodParts.push(tintGeo(THREE, xformGeo(new THREE.CylinderGeometry(0.045, 0.060, 5.4, 6), -6.30, bgy + 2.65, 71.40, 0.03, 0, 0.04), 0x5c4738, 0x241c17));
    woodParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(0.95, 0.07, 0.07), -5.90, bgy + 5.10, 71.40), 0x5c4738, 0x241c17));
    const cloth = new THREE.PlaneGeometry(0.84, 2.65, 4, 8);
    xformGeo(cloth, -5.88, bgy + 3.72, 71.40, 0, 0.35, 0);
    bannerClothParts.push(cloth);
  }
  addDestructibleProp(-4.55, 72.45, 'crate', 0.25);
  addDestructibleProp(-4.80, 73.35, 'barrel', 0.95);
  addDestructibleProp(-4.35, 76.60, 'crate', 0.55);
  addDestructibleProp(-3.55, 81.80, 'barrel', 1.40);
  addDestructibleProp(-2.95, 82.55, 'crate', 0.18);

  // --------------------------------------------------------------------------
  // 4. ZONE 3 (z = 97..124): «Разрушенная Башня Перевала» — Dark Souls / Bloodborne
  //    Cliffside Ruined Watchtower Bastion Courtyard, Overlook Terrace & Crypt Nook!
  //    (The iconic ruined gothic fortress silhouette seen ahead in frame_05 & frame_07 — 100% EXPLORABLE!)
  // --------------------------------------------------------------------------
  {
    const entryZ = 99.2;
    const eGyL = evalGroundY(5.25, entryZ);
    const eGyR = evalGroundY(-2.95, entryZ);
    const eTop = Math.max(eGyL, eGyR);

    // Bastion Entry Gatehouse Piers & Broken Archway (chokepoint framing the ruined courtyard!)
    for (const [px, gy, isLeft] of [[5.25, eGyL, true], [-2.95, eGyR, false]]) {
      stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(2.15, 0.65, 2.25), px, gy + 0.25, entryZ), 0x8290a6, 0x313949));
      stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(1.75, 5.65, 1.85), px, gy + 3.15, entryZ), 0x7b89a0, 0x2d3544));
      stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(2.05, 0.42, 2.15), px, gy + 6.02, entryZ), 0x8e9cb4, 0x3b4456));
      // Tall broken watchtower bastion wall rising on the left (+X, river-facing silhouette visible from z=60!)
      if (isLeft) {
        stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(2.10, 4.2, 2.15), px + 0.45, gy + 7.85, entryZ + 0.45), 0x8493aa, 0x363f51));
        stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(0.95, 1.45, 0.95), px + 0.95, gy + 10.45, entryZ - 0.15), 0x8d9cb4, 0x3c465a));
        stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(0.88, 1.15, 0.92), px - 0.15, gy + 10.20, entryZ + 0.95), 0x8897af, 0x394255));
        addHangingIvyPatch(px - 0.2, gy + 5.4, entryZ - 1.02, 1.9, 3.2, 0, 10);
      } else {
        // Wing masonry tying right gate pier into cliff
        stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(4.2, 4.6, 1.55), px - 2.6, gy + 2.2, entryZ + 0.2), 0x748298, 0x2a3240));
      }
    }
    // Weathered broken arch stubs spanning top of bastion entry
    for (let i = 0; i < 10; i++) {
      if (i === 4 || i === 5) continue; // dramatic broken roof gap letting moonlight pour onto the steps!
      const a0 = (i / 10) * Math.PI;
      const a1 = ((i + 1) / 10) * Math.PI;
      const midX = 1.15;
      const rSpan = 4.10;
      const x0 = midX - Math.cos(a0) * rSpan;
      const y0 = eTop + 5.75 + Math.sin(a0) * 3.1;
      const x1 = midX - Math.cos(a1) * rSpan;
      const y1 = eTop + 5.75 + Math.sin(a1) * 3.1;
      const len = Math.hypot(x1 - x0, y1 - y0) + 0.16;
      const ang = Math.atan2(y1 - y0, x1 - x0);
      stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(len, 0.68, 1.55), (x0 + x1) * 0.5, (y0 + y1) * 0.5, entryZ, 0, 0, ang), 0x8b99b0, 0x394254));
    }
    // Warm hanging bastion gateway lantern
    addHangingWallLantern(-1.72, eGyR + 3.25, entryZ - 0.72, -2.55, entryZ - 0.72, 4.8, 0.52);

    // Stepped ancient stone causeway risers ascending into the courtyard (z = 95.5 .. 103.0)
    for (let s = 0; s < 7; s++) {
      const sz = 95.8 + s * 1.05;
      const sx = getPathCenterX(sz);
      const sgy = evalGroundY(sx, sz);
      stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(5.2 + s * 0.18, 0.22, 0.92), sx, sgy - 0.02, sz), 0x8695ab, 0x363f50));
    }

    // River-Overlook Battlement Parapet & Ruined Watchtower Drum along left (+X) side of courtyard (z = 101..120)!
    const courtY = evalGroundY(0.8, 111.0);
    // Retaining fortress cliff foundation wall dropping straight down into the river gorge
    stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(1.55, 5.2, 20.5), 6.85, courtY - 2.0, 110.5), 0x67758a, 0x222936));
    // Low crenellated overlook parapet wall (player can gaze over the parapet back down the moonlit river!)
    for (let mz = 102.0; mz <= 118.5; mz += 2.6) {
      if (Math.abs(mz - 110.5) < 1.5) continue; // Dramatic crumbled viewing breach overlooking river!
      stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(0.95, 1.15, 1.45), 6.55, courtY + 0.55, mz), 0x8796ad, 0x384153));
    }
    // Two Half-Ruined Octagonal Bastion Turrets anchoring the cliffside fortress silhouette (w/ stone string-courses!)
    for (const [tx, tz, th] of [[6.75, 107.4, 7.6], [6.60, 115.8, 9.4]]) {
      stoneParts.push(tintGeo(THREE, xformGeo(new THREE.CylinderGeometry(1.42, 1.68, th, 8), tx, courtY + th * 0.5 - 0.8, tz, 0, Math.PI / 8, 0), 0x8e9eb8, 0x3b455a));
      // Molded gothic horizontal stone string-course rings so turrets read crisply in moonlight!
      stoneParts.push(tintGeo(THREE, xformGeo(new THREE.CylinderGeometry(1.68, 1.72, 0.34, 8), tx, courtY + 1.85, tz, 0, Math.PI / 8, 0), 0x9aaac4, 0x455068));
      stoneParts.push(tintGeo(THREE, xformGeo(new THREE.CylinderGeometry(1.60, 1.64, 0.34, 8), tx, courtY + 4.35, tz, 0, Math.PI / 8, 0), 0x9aaac4, 0x455068));
      stoneParts.push(tintGeo(THREE, xformGeo(new THREE.CylinderGeometry(1.66, 1.48, 0.45, 8), tx, courtY + th - 0.85, tz, 0, Math.PI / 8, 0), 0xa0b0ca, 0x4a556e));
      for (let k = 0; k < 5; k++) {
        if (k === 2) continue;
        const ma = (k / 5) * Math.PI * 2 + 0.4;
        stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(0.62, 0.95, 0.52), tx + Math.cos(ma) * 1.35, courtY + th - 0.25, tz + Math.sin(ma) * 1.35, 0, ma, 0), 0xa2b2cc, 0x4c5872));
      }
    }

    // Right-Side Cliffside Crypt / Alcove Exploration Pocket (Dark Souls side-nook at x = -8.2..-3.0, z = 106..116!)
    // Framed by twin stone arch piers + vaulted stone lintel + carved lore waystone + smashable barrels!
    for (const czP of [106.2, 115.6]) {
      const py = evalGroundY(-3.2, czP);
      stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(1.42, 4.4, 1.42), -3.2, py + 2.15, czP), 0x7e8ca2, 0x303848));
      stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(1.66, 0.36, 1.66), -3.2, py + 4.42, czP), 0x909eb6, 0x3d4659));
    }
    stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(1.55, 0.85, 11.2), -3.2, courtY + 4.82, 110.9), 0x8290a8, 0x343d4e));
    // Rear crypt retaining stone wall & glowing runic lore monument at (-6.4, 111.0)
    stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(1.4, 5.2, 10.6), -8.6, courtY + 2.5, 110.9), 0x6c7a90, 0x272e3c));
    const lx = GORGE_ROAD_ANCHORS.watchtowerLorePos.x;
    const lz = GORGE_ROAD_ANCHORS.watchtowerLorePos.z;
    const lgy = evalGroundY(lx, lz);
    stoneParts.push(tintGeo(THREE, xformGeo(new THREE.CylinderGeometry(0.72, 0.88, 0.28, 8), lx, lgy + 0.14, lz), 0x8998b2, 0x394256));
    stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(0.46, 2.25, 0.84), lx, lgy + 1.28, lz), 0x95a4be, 0x414b62));
    stoneParts.push(tintGeo(THREE, xformGeo(new THREE.ConeGeometry(0.54, 0.64, 4), lx, lgy + 2.70, lz, 0, Math.PI * 0.25, 0), 0x9faec8, 0x48536b));
    addWarmGroundPool(lx, lz, 2.5, [0.42, 0.72, 1.22], 0.26, alwaysOneUniform, 8.2);
    addHangingWallLantern(-3.95, courtY + 3.15, 107.6, -3.25, 106.7, 4.2, 0.44);

    // Watchtower Sanctuary Hearth Bonfire at center of ruined courtyard!
    addWaysideCampfire(GORGE_ROAD_ANCHORS.watchtowerHearthPos.x, GORGE_ROAD_ANCHORS.watchtowerHearthPos.z, { scale: 1.08, flameH: 1.88, poolR: 7.4 });

    // Diegetic North Boundary at z = 120.4: Monumental Ruined Gatehouse w/ Closed Wrought-Iron Portcullis
    // overlooking the misty jagged mountain chasm (NO glowing fog veil — pure Dark Souls world architecture!)
    const pZ = 120.4;
    const pGy = evalGroundY(0.8, pZ);
    for (const px of [-2.45, 4.05]) {
      stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(2.35, 7.6, 2.35), px, pGy + 3.65, pZ), 0x7c8aa2, 0x2c3444));
      stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(2.65, 0.46, 2.65), px, pGy + 7.55, pZ), 0x8e9cb4, 0x3b4458));
      stoneParts.push(tintGeo(THREE, xformGeo(new THREE.ConeGeometry(1.45, 3.4, 4), px, pGy + 9.45, pZ, 0, Math.PI * 0.25, 0), 0x8d9cb6, 0x3c465a));
    }
    stoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(8.8, 1.85, 2.15), 0.8, pGy + 6.95, pZ), 0x8290a8, 0x323b4c));
    // Heavy forged-iron portcullis grille bars (clean visual closure — you see the misty mountain peaks right THROUGH the iron bars!)
    for (let bi = -3; bi <= 3; bi++) {
      ironParts.push(xformGeo(new THREE.CylinderGeometry(0.065, 0.072, 6.2, 6), 0.8 + bi * 0.72, pGy + 3.1, pZ));
    }
    for (let hi = 0; hi < 4; hi++) {
      ironParts.push(xformGeo(new THREE.BoxGeometry(5.1, 0.14, 0.16), 0.8, pGy + 1.1 + hi * 1.45, pZ));
    }
    // Twin courtyard timber lanterns + smashable barrels/crates in bastion & crypt nook
    addTimberGallowsLantern(4.85, 112.2, { postH: 3.45, armDirX: -0.95, armDirZ: 0.15, poolR: 4.5, poolStr: 0.46 });
    addDestructibleProp(-5.65, 108.4, 'barrel', 0.4);
    addDestructibleProp(-6.15, 109.2, 'crate', 1.1);
    addDestructibleProp(-5.75, 113.4, 'crate', 0.2);
    addDestructibleProp(-5.25, 114.2, 'barrel', 2.0);
    addDestructibleProp(4.55, 104.2, 'barrel', 0.7);
    addDestructibleProp(4.95, 105.0, 'crate', 1.5);
  }

  // --------------------------------------------------------------------------
  // 5. TOWERING DARK SOULS / BLOODBORNE CORRIDOR CLIFF WALLS, RIVER BOULDERS & PINE FOREST!
  //    Closes right side (-X) completely like an ancient mountain gorge & frames the far left
  //    riverbank (+X) with steep forested crags — ZERO open-world emptiness!
  // --------------------------------------------------------------------------
  const rockDetail = isMobile ? 2 : 3;
  const gorgeCliffSpecs = [
    // RIGHT CLIFF WALL (-X side, stepped cleanly back at x = -15.6..-18.2 so gnarled tree, twin columns & crimson banner stand 100% clear!)
    { x: -16.2, y: -1.0, z:  38.5, rx:  7.8, ry: 13.6, rz:  7.8, seed: 2101, flatTop: false },
    { x: -16.8, y: -0.8, z:  47.8, rx:  8.0, ry: 15.2, rz:  8.4, seed: 2102, flatTop: false },
    { x: -16.4, y: -0.8, z:  57.5, rx:  8.0, ry: 15.6, rz:  8.4, seed: 2103, flatTop: false },
    { x: -17.4, y: -0.6, z:  67.5, rx:  8.2, ry: 16.4, rz:  8.8, seed: 2104, flatTop: false },
    { x: -17.0, y: -0.6, z:  77.8, rx:  8.2, ry: 17.2, rz:  8.8, seed: 2105, flatTop: false },
    { x: -15.2, y: -0.4, z:  88.2, rx:  8.4, ry: 17.6, rz:  8.8, seed: 2106, flatTop: false },
    { x: -14.2, y: -0.2, z:  97.8, rx:  8.2, ry: 16.4, rz:  8.6, seed: 2107, flatTop: false },
    { x: -18.2, y:  0.4, z: 110.5, rx:  9.0, ry: 18.8, rz: 12.2, seed: 2108, flatTop: false },
    { x: -13.6, y:  0.6, z: 123.0, rx:  9.4, ry: 18.0, rz:  9.4, seed: 2109, flatTop: false },
    // Lower foreground mossy rock shelves framing cliff base behind columns & lanterns (never clipping props!)
    { x: -10.8, y: -0.3, z:  42.5, rx:  3.4, ry:  4.6, rz:  4.0, seed: 2110, flatTop: true },
    { x: -10.8, y: -0.2, z:  52.2, rx:  3.5, ry:  5.2, rz:  3.8, seed: 2111, flatTop: true },
    { x: -11.4, y: -0.1, z:  62.2, rx:  3.8, ry:  5.6, rz:  4.2, seed: 2112, flatTop: true },
    { x: -10.6, y:  0.1, z:  79.5, rx:  3.6, ry:  6.0, rz:  4.4, seed: 2113, flatTop: true },
    { x:  -9.0, y:  0.3, z:  88.8, rx:  3.5, ry:  6.2, rz:  4.2, seed: 2114, flatTop: true },

    // FAR LEFT RIVERBANK CLIFFS (+X across the moonlit river — readable slate-grey forested canyon shore!)
    { x:  25.2, y: -1.4, z:  38.5, rx:  8.8, ry: 11.4, rz:  8.8, seed: 2120, flatTop: true },
    { x:  24.2, y: -1.4, z:  49.5, rx:  8.6, ry: 12.4, rz:  9.2, seed: 2121, flatTop: true },
    { x:  24.0, y: -1.4, z:  61.5, rx:  8.8, ry: 13.6, rz:  9.4, seed: 2122, flatTop: true },
    { x:  23.4, y: -1.4, z:  74.0, rx:  9.0, ry: 14.2, rz:  9.8, seed: 2123, flatTop: true },
    { x:  25.8, y: -1.4, z:  87.5, rx:  9.6, ry: 14.8, rz: 10.2, seed: 2124, flatTop: true },
    { x:  29.2, y: -1.2, z: 102.0, rx: 10.8, ry: 15.8, rz: 11.2, seed: 2125, flatTop: false },
    { x:  29.8, y: -1.2, z: 118.0, rx: 11.4, ry: 16.6, rz: 11.8, seed: 2126, flatTop: false },
    { x:  26.2, y: -1.2, z: 134.0, rx: 12.2, ry: 18.4, rz: 12.0, seed: 2127, flatTop: false }
  ];
  for (let i = 0; i < gorgeCliffSpecs.length; i++) {
    const c = gorgeCliffSpecs[i];
    const g = buildCraggyCliffMassGeo(THREE, c.rx, c.ry, c.rz, c.seed, rockDetail, {
      flatTop: c.flatTop,
      topHex: 0xa6bad8,
      midHex: 0x627490,
      botHex: 0x333f54,
      mossHex: 0x527a4c
    });
    xformGeo(g, c.x, c.y, c.z, 0, rng() * 6.28, 0);
    basaltParts.push(g);
  }

  // Wet Smooth River Boulders, Moss-Capped Bank Rocks & Rapids Stones (iconic foreground/midground framing from video!)
  const riverBoulderSpecs = [
    // Shoreline mossy rocks along left cobble edge (z = 34..96)
    { x:  3.65, z: 36.4, r: 0.92, sy: 0.56, mossy: true },
    { x:  3.45, z: 41.2, r: 0.78, sy: 0.48, mossy: true },
    { x:  3.25, z: 46.8, r: 1.12, sy: 0.54, mossy: true },
    { x:  3.55, z: 51.4, r: 1.28, sy: 0.60, mossy: true },
    { x:  4.05, z: 55.2, r: 1.42, sy: 0.66, mossy: true }, // Mossy boulder directly left of ivy archway!
    { x:  2.75, z: 61.5, r: 0.88, sy: 0.52, mossy: true },
    { x:  2.25, z: 67.2, r: 0.95, sy: 0.54, mossy: true },
    { x:  2.40, z: 73.8, r: 1.05, sy: 0.52, mossy: true },
    { x:  3.55, z: 80.5, r: 1.18, sy: 0.58, mossy: true },
    { x:  5.40, z: 88.6, r: 1.62, sy: 0.72, mossy: true }, // River bend promontory rock (collider!)
    { x:  6.15, z: 94.2, r: 1.38, sy: 0.68, mossy: true },
    // Mid-stream rushing rapids boulders catching silver moonlight glints!
    { x:  6.40, z: 39.0, r: 0.85, sy: 0.44, mossy: false },
    { x:  8.90, z: 44.5, r: 1.15, sy: 0.48, mossy: false },
    { x:  6.85, z: 49.2, r: 0.76, sy: 0.42, mossy: false },
    { x:  8.15, z: 58.6, r: 1.24, sy: 0.52, mossy: false },
    { x:  5.60, z: 65.4, r: 0.82, sy: 0.44, mossy: false },
    { x:  9.40, z: 71.0, r: 1.32, sy: 0.50, mossy: false },
    { x:  6.45, z: 77.6, r: 0.90, sy: 0.46, mossy: false },
    { x: 10.60, z: 85.2, r: 1.45, sy: 0.56, mossy: false },
    { x: 11.80, z: 96.8, r: 1.55, sy: 0.58, mossy: false },
    { x: 13.40, z: 110.5, r: 1.68, sy: 0.62, mossy: false },
    // Far-shore wet boulders beneath pine cliffs (+X)
    { x: 15.2, z: 42.0, r: 1.65, sy: 0.64, mossy: true },
    { x: 14.8, z: 54.0, r: 1.78, sy: 0.68, mossy: true },
    { x: 14.6, z: 68.5, r: 1.72, sy: 0.66, mossy: true },
    { x: 16.4, z: 82.0, r: 1.85, sy: 0.70, mossy: true },
    { x: 19.2, z: 98.0, r: 2.05, sy: 0.74, mossy: true },
    // Foreground right-edge mossy boulders
    { x: -4.8, z: 36.2, r: 0.82, sy: 0.56, mossy: true },
    { x: -5.4, z: 60.4, r: 0.95, sy: 0.58, mossy: true },
    { x: -5.1, z: 80.2, r: 0.92, sy: 0.56, mossy: true }
  ];
  for (let i = 0; i < riverBoulderSpecs.length; i++) {
    const b = riverBoulderSpecs[i];
    const gy = b.mossy ? evalGroundY(b.x, b.z) : Math.max(WATER_LEVEL - 0.16, evalGroundY(b.x, b.z));
    const g = buildSculptedRockGeo(THREE, b.r, 2400 + i, b.sy, isMobile ? 1 : 2);
    xformGeo(g, b.x, gy + b.r * b.sy * 0.28, b.z, 0, rng() * 6.28, 0);
    basaltParts.push(tintGeo(THREE, g, b.mossy ? 0x566c55 : 0x546276, 0x1c222e));
  }

  // Dark Conifer Pine Silhouettes crowning BOTH the far-left forested ridge (+X) & right cliff rim (-X)!
  const gorgePines = [
    // Far left riverbank pine forest (+X, exact look of left horizon in frame_00..frame_07!)
    [16.8, 36.0, 10.2, -0.06, 0.04], [19.4, 42.5, 11.5, -0.08, -0.03], [16.2, 48.0, 9.6, -0.05, 0.05],
    [18.8, 55.0, 11.0, -0.07, 0.02], [16.6, 62.5, 10.4, -0.06, -0.04], [19.5, 70.0, 11.8, -0.08, 0.03],
    [17.8, 78.5, 10.6, -0.05, 0.04], [21.0, 87.0, 11.4, -0.07, -0.02], [23.5, 97.0, 12.2, -0.06, 0.03],
    [24.2, 110.0, 12.0, -0.06, 0.02], [22.8, 124.0, 11.6, -0.05, -0.03],
    // Right cliff ridge pine silhouettes (-X, crowning the high basalt wall like frame_07 top-right!)
    [-12.2, 42.0, 9.2, 0.08, 0.03], [-13.4, 52.5, 9.8, 0.09, -0.04], [-13.0, 63.0, 10.4, 0.08, 0.03],
    [-12.6, 74.5, 10.8, 0.07, -0.03], [-10.8, 84.5, 10.2, 0.08, 0.04], [-9.8, 93.5, 9.6, 0.07, 0.02],
    [-13.5, 105.0, 11.0, 0.06, -0.03], [-12.5, 118.5, 10.6, 0.07, 0.02]
  ];
  for (let i = 0; i < gorgePines.length; i++) {
    const [px, pz, ph, lx, lz] = gorgePines[i];
    addNordicPine(px, pz, ph, lx, lz, i * 1.37);
  }

  // Shoreline dark-green reeds & fern clusters framing cobbles and rocks
  const gorgeReedClusters = [
    [3.1, 35.2], [3.3, 39.8], [2.8, 44.0], [2.9, 49.4], [3.1, 53.6],
    [2.5, 58.8], [1.9, 64.5], [1.6, 69.4], [2.1, 75.8], [3.1, 82.4],
    [4.4, 90.8], [-3.8, 37.0], [-4.2, 51.0], [-4.4, 62.5], [-4.5, 77.2], [-2.8, 88.0]
  ];
  for (let ci = 0; ci < gorgeReedClusters.length; ci++) {
    const [rx, rz] = gorgeReedClusters[ci];
    const rgy = evalGroundY(rx, rz);
    const cnt = isMobile ? 6 : 10;
    for (let bi = 0; bi < cnt; bi++) {
      const a = (bi / cnt) * Math.PI * 2 + rng() * 0.5;
      const ox = rx + Math.cos(a) * (0.1 + rng() * 0.45);
      const oz = rz + Math.sin(a) * (0.1 + rng() * 0.45);
      const blade = buildCurvedReedBladeGeo(0.065 + rng() * 0.04, 0.45 + rng() * 0.55, 0.36 + rng() * 0.35, a);
      blade.translate(ox, Math.max(WATER_LEVEL + 0.02, rgy) - 0.03, oz);
      foliageParts.push(tintGeo(THREE, blade, 0x2c4a31, 0x101c13));
    }
  }

  // --------------------------------------------------------------------------
  // 6. MAJESTIC LAYERED MISTY ALPINE-GOTHIC MOUNTAIN PEAKS & GORGE HORIZON!
  //    Custom atmospheric valley-mist shader (`fog: false`) producing the EXACT
  //    towering misty jagged peaks under the full moon from frame_00..frame_07!
  // --------------------------------------------------------------------------
  function buildDistantMountainRangeGeo() {
    const mParts = [];
    // Broad, craggy alpine-gothic mountain ridges framing the misty gorge horizon (sculpted carefully so
    // the Giant Cratered Full Moon at upper-left shines 100% UNOBSTRUCTED above the misty peaks — exact match to reference video!)
    const peakSpecs = [
      // Mid-far rugged canyon flanks framing the river gorge vanishing point
      { x:  44, z: 146, rx: 24, ry: 22, rz: 19, seed: 3101 },
      { x:  18, z: 162, rx: 22, ry: 24, rz: 18, seed: 3102 }, // Craggy gorge peak left of center (sits cleanly BELOW Full Moon!)
      { x: -16, z: 154, rx: 22, ry: 29, rz: 18, seed: 3103 }, // Taller gothic alpine peak right of center (frame_00 & frame_05!)
      { x: -42, z: 142, rx: 25, ry: 28, rz: 19, seed: 3104 },
      // Deep horizon misty mountain range dissolving into blue-slate moonlight clouds
      { x:  72, z: 184, rx: 36, ry: 30, rz: 28, seed: 3105 },
      { x:  36, z: 204, rx: 34, ry: 28, rz: 26, seed: 3106 }, // Lower saddle under Full Moon so moon disc & halo shine clear!
      { x:  -2, z: 214, rx: 38, ry: 38, rz: 28, seed: 3107 },
      { x: -34, z: 198, rx: 36, ry: 36, rz: 26, seed: 3108 },
      { x: -70, z: 176, rx: 36, ry: 34, rz: 26, seed: 3109 },
      // Far left mountain ridge extending back along the distant forested riverbank (+X)
      { x:  60, z:  95, rx: 28, ry: 26, rz: 28, seed: 3110 },
      { x:  66, z:  48, rx: 30, ry: 24, rz: 30, seed: 3111 },
      // Far right towering mountain wall backing the right gorge cliffs (-X)
      { x: -54, z:  85, rx: 28, ry: 30, rz: 28, seed: 3112 },
      { x: -56, z:  35, rx: 28, ry: 26, rz: 26, seed: 3113 }
    ];
    for (let i = 0; i < peakSpecs.length; i++) {
      const pk = peakSpecs[i];
      const g = buildCraggyCliffMassGeo(THREE, pk.rx, pk.ry, pk.rz, pk.seed, isMobile ? 2 : 3, {
        flatTop: false,
        topHex: 0x5c7296,
        midHex: 0x2b3952,
        botHex: 0x101828,
        noMoss: true
      });
      // Natural broad craggy alpine ridge taper (ZERO skinny low-poly needles!)
      const pos = g.attributes.position;
      for (let vi = 0; vi < pos.count; vi++) {
        const y = pos.getY(vi);
        const hT = clamp01(y / Math.max(1.0, pk.ry));
        const pinch = lerp(1.08, 0.62, hT * hT);
        pos.setX(vi, pos.getX(vi) * pinch);
        pos.setZ(vi, pos.getZ(vi) * pinch);
      }
      g.computeVertexNormals();
      xformGeo(g, pk.x, -4.5, pk.z, 0, i * 0.9, 0);
      mParts.push(g);
    }
    return mergeNonIndexedGeos(THREE, mParts, { boxUvTile: 0, withColor: true });
  }

  const distantMountainMat = trackMat(new THREE.ShaderMaterial({
    uniforms: { uTime: uTimeUniform },
    vertexShader: `
      attribute vec3 color;
      varying vec3 vNormalW;
      varying vec3 vWorldPos;
      varying vec3 vCol;
      void main() {
        vCol = color;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vNormalW;
      varying vec3 vWorldPos;
      varying vec3 vCol;
      void main() {
        vec3 N = normalize(vNormalW);
        vec3 V = normalize(cameraPosition - vWorldPos);
        // Forward-left full moon direction matching extSkyMat!
        vec3 moonL = normalize(vec3(0.315, 0.250, 0.916));
        float dist = length(cameraPosition - vWorldPos);

        float ndl = max(0.0, dot(N, moonL) * 0.55 + 0.45);
        float rim = pow(1.0 - max(dot(N, V), 0.0), 2.4);
        vec3 rockCol = vCol * (0.34 + 0.72 * ndl);
        // Cold silver-blue moonlight grazing the jagged upper mountain ridges
        rockCol += vec3(0.18, 0.28, 0.46) * rim * smoothstep(8.0, 42.0, vWorldPos.y);

        // Layered atmospheric blue-slate valley mist clinging to the lower gorge & softening far peaks!
        float valleyMist = (1.0 - smoothstep(2.0, 28.0, vWorldPos.y)) * 0.72;
        float depthFade = smoothstep(72.0, 225.0, dist) * 0.68;
        float mistAmt = clamp(valleyMist + depthFade * (1.0 - valleyMist * 0.45), 0.0, 0.88);
        vec3 mistCol = mix(vec3(0.085, 0.132, 0.215), vec3(0.19, 0.28, 0.42), smoothstep(8.0, 40.0, vWorldPos.y) * 0.5 + 0.25);
        vec3 col = mix(rockCol, mistCol, mistAmt);

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.FrontSide,
    fog: false
  }));
  const distantMountainsMesh = new THREE.Mesh(trackGeo(buildDistantMountainRangeGeo()), distantMountainMat);
  distantMountainsMesh.frustumCulled = false;
  gorgeGroup.add(distantMountainsMesh);

  // --------------------------------------------------------------------------
  // 7. MERGE STATIC GORGE GEOMETRY INTO LEAN BATCHED MESHES + LANTERN HALOS + SPARKS!
  // --------------------------------------------------------------------------
  if (stoneParts.length > 0) {
    const stoneMesh = new THREE.Mesh(trackGeo(mergeNonIndexedGeos(THREE, stoneParts, { boxUvTile: 2.3, withColor: true })), ruinStoneMat);
    stoneMesh.receiveShadow = true;
    gorgeGroup.add(stoneMesh);
  }
  if (basaltParts.length > 0) {
    const basaltMesh = new THREE.Mesh(trackGeo(mergeNonIndexedGeos(THREE, basaltParts, { boxUvTile: 4.4, withColor: true })), extBasaltMat);
    basaltMesh.receiveShadow = true;
    gorgeGroup.add(basaltMesh);
  }
  if (woodParts.length > 0) {
    const woodMesh = new THREE.Mesh(trackGeo(mergeNonIndexedGeos(THREE, woodParts, { boxUvTile: 1.5, withColor: true })), warmOakMat);
    woodMesh.receiveShadow = true;
    gorgeGroup.add(woodMesh);
  }
  if (barkParts.length > 0) {
    const barkMesh = new THREE.Mesh(trackGeo(mergeNonIndexedGeos(THREE, barkParts, { boxUvTile: 1.6, withColor: true })), deadTreeMat);
    barkMesh.receiveShadow = true;
    gorgeGroup.add(barkMesh);
  }
  if (ironParts.length > 0) {
    const ironMesh = new THREE.Mesh(trackGeo(mergeNonIndexedGeos(THREE, ironParts, { boxUvTile: 1.2 })), rustedGrateMat);
    gorgeGroup.add(ironMesh);
  }
  if (foliageParts.length > 0) {
    const folMesh = new THREE.Mesh(trackGeo(mergeNonIndexedGeos(THREE, foliageParts, { withColor: true })), ivyFoliageMat);
    gorgeGroup.add(folMesh);
  }
  if (lanternGlowParts.length > 0) {
    const glowMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xffc15c }));
    gorgeGroup.add(new THREE.Mesh(trackGeo(mergeNonIndexedGeos(THREE, lanternGlowParts)), glowMat));
  }
  if (lanternHalos.length > 0) {
    const haloMat = trackMat(new THREE.ShaderMaterial({
      uniforms: { uTime: uTimeUniform },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          mv.xy += position.xy;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          float d = length(vUv * 2.0 - 1.0);
          if (d > 1.0) discard;
          float flick = 0.90 + 0.10 * sin(uTime * 5.6);
          float g = exp(-d * d * 4.5) * (1.0 - smoothstep(0.65, 1.0, d));
          vec3 col = mix(vec3(1.05, 0.44, 0.09), vec3(1.58, 1.02, 0.46), exp(-d * d * 7.2));
          gl_FragColor = vec4(col * flick, g * 0.66);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    }));
    for (let hi = 0; hi < lanternHalos.length; hi++) {
      const h = lanternHalos[hi];
      const hm = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(h.size, h.size)), haloMat);
      hm.position.set(h.x, h.y, h.z);
      hm.renderOrder = 4;
      gorgeGroup.add(hm);
    }
  }
  if (bannerClothParts.length > 0) {
    const bannerMat = trackMat(new THREE.ShaderMaterial({
      uniforms: { uTime: uTimeUniform, uMap: { value: carpetTex } },
      vertexShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 p = position;
          float droop = 1.0 - uv.y;
          p.z += sin(uTime * 3.1 + uv.y * 5.2 + uv.x * 3.0) * 0.14 * droop;
          p.x += cos(uTime * 2.4 - uv.y * 4.0) * 0.06 * droop;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        varying vec2 vUv;
        void main() {
          float tear = 0.16 * sin(vUv.x * 18.0) + 0.09 * cos(vUv.x * 29.0);
          if (vUv.y < 0.15 + tear) discard;
          vec3 c = texture2D(uMap, vUv).rgb * 0.72;
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      side: THREE.DoubleSide
    }));
    gorgeGroup.add(new THREE.Mesh(trackGeo(mergeNonIndexedGeos(THREE, bannerClothParts)), bannerMat));
  }

  // Rising campfire sparks & gentle smoke plumes over ALL Gorge Road campfires!
  if (campSparkPos.length > 0) {
    const spGeo = trackGeo(new THREE.BufferGeometry());
    spGeo.setAttribute('position', new THREE.Float32BufferAttribute(campSparkPos, 3));
    spGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(campSparkSeed, 3));
    const spMat = trackMat(new THREE.ShaderMaterial({
      uniforms: { uTime: uTimeUniform, uTex: { value: mistSpriteTex } },
      vertexShader: `
        attribute vec3 aSeed;
        uniform float uTime;
        varying float vAlpha;
        varying float vSmoke;
        void main() {
          float isSmoke = step(0.76, aSeed.x);
          float speed = mix(0.40, 0.19, isSmoke);
          float cyc = fract(aSeed.x + uTime * speed * aSeed.y);
          float ang = aSeed.x * 6.283 + uTime * mix(2.0, 0.75, isSmoke) + cyc * 3.2;
          float rad = aSeed.z * (0.35 + cyc * mix(1.25, 1.9, isSmoke));
          vec3 p = position + vec3(cos(ang) * rad, cyc * mix(3.4, 4.4, isSmoke), sin(ang) * rad);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float sz = mix(54.0, 260.0, isSmoke);
          gl_PointSize = clamp(sz / max(1.0, -mv.z), mix(2.5, 14.0, isSmoke), mix(15.0, 96.0, isSmoke));
          vAlpha = sin(cyc * 3.14159) * mix(0.92, 0.24, isSmoke);
          vSmoke = isSmoke;
        }
      `,
      fragmentShader: `
        uniform sampler2D uTex;
        varying float vAlpha;
        varying float vSmoke;
        void main() {
          vec4 t = texture2D(uTex, gl_PointCoord);
          float a = t.a * vAlpha;
          if (a < 0.008) discard;
          vec3 sparkCol = vec3(2.3, 0.94, 0.24);
          vec3 smokeCol = vec3(0.45, 0.34, 0.28);
          gl_FragColor = vec4(mix(sparkCol, smokeCol, vSmoke), a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    }));
    const spPts = new THREE.Points(spGeo, spMat);
    spPts.renderOrder = 5;
    gorgeGroup.add(spPts);
  }

  return {
    gorgeGroup,
    anchors: GORGE_ROAD_ANCHORS,
    fireSources: GORGE_FIRE_SOURCES
  };
}
