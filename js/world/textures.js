// Procedural 3D Arena Textures & Tapered Slash Geometry Cache
// Extracted from js/world.js (Wave 1 modular split).

import * as THREE from '../../vendor/three.module.js';

// ============================================================================
// Procedural Textures: Gothic Slate Cobblestone Floor & Soft Radial Glow Sprite
// ============================================================================
export function createCourtyardStoneTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Deep earthy twilight mortar base
  ctx.fillStyle = '#1b1826';
  ctx.fillRect(0, 0, size, size);

  let seed = 4242;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Helper to draw seamlessly tiled shapes across canvas wrap boundaries
  const drawWrapped = (fn) => {
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        ctx.save();
        ctx.translate(ox, oy);
        fn();
        ctx.restore();
      }
    }
  };

  // Subtle gritty mortar variation so joints feel like packed earth & ash
  for (let i = 0; i < 420; i++) {
    const gx = rand() * size;
    const gy = rand() * size;
    const gr = 1 + rand() * 2.6;
    const gv = 24 + Math.floor(rand() * 22);
    ctx.fillStyle = `rgba(${gv + 6}, ${gv + 3}, ${gv + 10}, 0.45)`;
    ctx.beginPath();
    ctx.arc(gx, gy, gr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Organic coursed ashlar / hand-hewn gothic flagstones with natural hue variety
  const stoneTones = [
    [68, 72, 92],   // moonlit cool slate
    [82, 78, 92],   // weathered warm granite
    [64, 62, 84],   // muted twilight indigo-stone
    [88, 82, 86],   // pale limestone accent
    [56, 58, 74],   // deep charcoal paver
    [76, 72, 82]    // warm ash-grey flagstone
  ];

  const rows = 7;
  const rowH = size / rows;
  for (let r = 0; r < rows; r++) {
    const cols = r % 2 === 0 ? 5 : 6;
    const colW = size / cols;
    const offset = (r % 2) * (colW * 0.47);
    for (let c = -1; c <= cols + 1; c++) {
      const x = c * colW + offset + 3.5;
      const y = r * rowH + 3.5;
      const w = colW - 7;
      const h = rowH - 7;

      const tone = stoneTones[Math.floor(rand() * stoneTones.length)];
      const shift = Math.floor((rand() - 0.5) * 18);
      const red = Math.max(32, Math.min(135, tone[0] + shift));
      const grn = Math.max(30, Math.min(130, tone[1] + shift));
      const blu = Math.max(40, Math.min(148, tone[2] + shift));

      // Slightly irregular hand-carved flagstone polygon
      const j = () => (rand() - 0.5) * 3.8;
      const x0 = x + 3 + j(), y0 = y + 3 + j();
      const x1 = x + w - 3 + j(), y1 = y + 2 + j();
      const x2 = x + w - 2 + j(), y2 = y + h - 3 + j();
      const x3 = x + 2 + j(), y3 = y + h - 2 + j();

      const grad = ctx.createLinearGradient(x0, y0, x2, y2);
      grad.addColorStop(0, `rgb(${Math.min(255, red + 12)}, ${Math.min(255, grn + 11)}, ${Math.min(255, blu + 14)})`);
      grad.addColorStop(1, `rgb(${Math.max(18, red - 12)}, ${Math.max(16, grn - 12)}, ${Math.max(22, blu - 10)})`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.closePath();
      ctx.fill();

      // Grounded bottom-right shadow & top-left moonlit bevel highlight
      ctx.strokeStyle = 'rgba(12, 10, 20, 0.58)';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(204, 214, 246, 0.22)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(x3, y3);
      ctx.lineTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();

      // Natural stone grain / pitting speckles
      for (let s = 0; s < 5; s++) {
        const sx = x + 6 + rand() * Math.max(4, w - 12);
        const sy = y + 6 + rand() * Math.max(4, h - 12);
        ctx.fillStyle = rand() > 0.5 ? 'rgba(220, 224, 242, 0.08)' : 'rgba(18, 15, 28, 0.16)';
        ctx.beginPath();
        ctx.arc(sx, sy, 1.2 + rand() * 3.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Hairline weathered cracks on ~38% of stones
      if (rand() < 0.38) {
        ctx.strokeStyle = 'rgba(18, 14, 28, 0.45)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        let cx = x + w * (0.2 + rand() * 0.55);
        let cy = y + 3;
        ctx.moveTo(cx, cy);
        for (let k = 0; k < 3; k++) {
          cx += (rand() - 0.5) * 16;
          cy += h * 0.28;
          ctx.lineTo(cx, cy);
        }
        ctx.stroke();
      }

      // Subtle warm/violet mineral wash on occasional stones
      if (rand() < 0.32) {
        ctx.fillStyle = rand() < 0.5 ? 'rgba(110, 86, 68, 0.14)' : 'rgba(104, 82, 142, 0.14)';
        ctx.beginPath();
        ctx.ellipse(x + w * rand(), y + h * rand(), 9 + rand() * 14, 6 + rand() * 10, rand() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Seamless soft earth / packed-soil patches breaking up the grid rhythm
  for (let i = 0; i < 11; i++) {
    const px = rand() * size;
    const py = rand() * size;
    const pr = 26 + rand() * 44;
    const alpha = 0.22 + rand() * 0.16;
    drawWrapped(() => {
      const g = ctx.createRadialGradient(px, py, 3, px, py, pr);
      g.addColorStop(0.0, `rgba(62, 50, 40, ${alpha.toFixed(2)})`);
      g.addColorStop(0.58, `rgba(48, 40, 36, ${(alpha * 0.55).toFixed(2)})`);
      g.addColorStop(1.0, 'rgba(42, 36, 36, 0.0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Seamless mossy tufts creeping along cobblestone joints & stone edges
  for (let i = 0; i < 14; i++) {
    const mx = rand() * size;
    const my = rand() * size;
    const mr = 14 + rand() * 28;
    const alpha = 0.24 + rand() * 0.20;
    const bright = rand() > 0.45;
    drawWrapped(() => {
      const g = ctx.createRadialGradient(mx, my, 2, mx, my, mr);
      g.addColorStop(0.0, bright ? `rgba(98, 122, 66, ${alpha.toFixed(2)})` : `rgba(74, 98, 54, ${alpha.toFixed(2)})`);
      g.addColorStop(0.6, `rgba(62, 82, 46, ${(alpha * 0.45).toFixed(2)})`);
      g.addColorStop(1.0, 'rgba(54, 72, 42, 0.0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Scattered fallen autumn leaves (russet, ochre, deep crimson) resting on the pavers
  const leafColors = [
    'rgba(168, 72, 34, 0.68)',
    'rgba(196, 114, 38, 0.62)',
    'rgba(142, 42, 56, 0.66)',
    'rgba(128, 62, 36, 0.58)'
  ];
  for (let i = 0; i < 46; i++) {
    const lx = rand() * size;
    const ly = rand() * size;
    const rx = 2.6 + rand() * 3.4;
    const ry = 1.4 + rand() * 1.9;
    const ang = rand() * Math.PI * 2;
    const col = leafColors[Math.floor(rand() * leafColors.length)];
    drawWrapped(() => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(lx, ly, rx, ry, ang, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(7.5, 7.5);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function createHubMistTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const lobes = [
    [0.50, 0.50, 0.47, 0.48],
    [0.35, 0.45, 0.35, 0.36],
    [0.65, 0.53, 0.36, 0.35],
    [0.45, 0.35, 0.31, 0.28],
    [0.55, 0.65, 0.33, 0.28],
    [0.32, 0.60, 0.26, 0.22],
    [0.68, 0.38, 0.26, 0.22]
  ];
  for (const [ux, uy, ur, alpha] of lobes) {
    const lx = ux * size;
    const ly = uy * size;
    const lr = ur * size;
    const g = ctx.createRadialGradient(lx, ly, 1, lx, ly, lr);
    g.addColorStop(0.0, `rgba(255, 255, 255, ${alpha})`);
    g.addColorStop(0.45, `rgba(255, 255, 255, ${(alpha * 0.55).toFixed(3)})`);
    g.addColorStop(0.78, `rgba(255, 255, 255, ${(alpha * 0.16).toFixed(3)})`);
    g.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSoftGlowTexture() {
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

// Wide, smooth exponential radial falloff for lightweight additive pseudo-bloom halos
// (no post-processing render-target pass required — keeps full MSAA and 60 FPS on mobile).
export function createBloomHaloTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const c = size / 2;
  const g = ctx.createRadialGradient(c, c, 0.5, c, c, c);
  g.addColorStop(0.0, 'rgba(255, 255, 255, 0.96)');
  g.addColorStop(0.14, 'rgba(255, 255, 255, 0.74)');
  g.addColorStop(0.32, 'rgba(255, 255, 255, 0.36)');
  g.addColorStop(0.56, 'rgba(255, 255, 255, 0.12)');
  g.addColorStop(0.80, 'rgba(255, 255, 255, 0.025)');
  g.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Soft crystalline 6-point ice flake sprite for Frost Ruins (chapters 16–20)
export function createSnowflakeTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const c = size / 2;

  const halo = ctx.createRadialGradient(c, c, 1, c, c, c * 0.92);
  halo.addColorStop(0.0, 'rgba(255, 255, 255, 0.92)');
  halo.addColorStop(0.35, 'rgba(220, 246, 255, 0.48)');
  halo.addColorStop(0.72, 'rgba(186, 230, 253, 0.12)');
  halo.addColorStop(1.0, 'rgba(186, 230, 253, 0.0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, size, size);

  ctx.save();
  ctx.translate(c, c);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
  ctx.lineCap = 'round';
  ctx.lineWidth = 2.1;
  for (let i = 0; i < 6; i++) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -c * 0.68);
    ctx.moveTo(0, -c * 0.36);
    ctx.lineTo(-c * 0.16, -c * 0.50);
    ctx.moveTo(0, -c * 0.36);
    ctx.lineTo(c * 0.16, -c * 0.50);
    ctx.stroke();
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Glowing volcanic ember / hot ash fleck sprite for Ash Citadel (chapters 21–25)
export function createAshEmberTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const c = size / 2;

  const outer = ctx.createRadialGradient(c, c, 1, c, c, c * 0.94);
  outer.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  outer.addColorStop(0.22, 'rgba(255, 232, 180, 0.86)');
  outer.addColorStop(0.48, 'rgba(255, 160, 80, 0.36)');
  outer.addColorStop(0.78, 'rgba(220, 70, 30, 0.08)');
  outer.addColorStop(1.0, 'rgba(180, 40, 20, 0.0)');
  ctx.fillStyle = outer;
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.beginPath();
  ctx.ellipse(c, c, c * 0.18, c * 0.28, 0.35, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createHubContactAoTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const c = size / 2;
  const g = ctx.createRadialGradient(c, c, 2, c, c, c);
  g.addColorStop(0.0, 'rgba(14, 8, 28, 0.96)');
  g.addColorStop(0.28, 'rgba(18, 10, 34, 0.72)');
  g.addColorStop(0.56, 'rgba(20, 12, 36, 0.28)');
  g.addColorStop(0.82, 'rgba(20, 12, 36, 0.05)');
  g.addColorStop(1.0, 'rgba(20, 12, 36, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createArcaneCircleTexture() {
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
export function getSlashCrescentGeo(arcAngle = Math.PI * 0.8, thickness = 0.42) {
  const clampedArc = Math.max(0.4, Math.min(Math.PI * 1.95, arcAngle || Math.PI * 0.8));
  const clampedThick = Math.max(0.05, Math.min(0.65, thickness));
  const key = `${clampedArc.toFixed(2)}_${clampedThick.toFixed(2)}`;
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
    const rIn = 1.0 - clampedThick * Math.pow(taper, 0.72);
    const lift = 0.04 * taper;

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
