// Grimborne Hunters — AAA Cinematic Escape Cutscene VFX & 3-Point Light Rig
// Pure Vanilla ES Module (Three.js r160, ZERO external imports, zero-GC pooled particles, 60+ FPS, 0 VRAM leaks).
//
// Exports:
//   - SOULS_ESCAPE_VFX_VERSION
//   - createSoulsEscapeVfx(THREE, opts = {})
//
// Subsystems:
//   1. 3-Point Cinema Light Rig (`cutsceneLightRig`, toggled via `setActive(active)`):
//        - `throneRimLight`   : Warm amber-crimson Back/Rim PointLight sculpting Judge of Ruins & Hero in Throne Hall
//        - `impactFlashLight` : Dynamic high-intensity Flash PointLight (peaks up to 9..10.5 for ~0.22s on impacts)
//        - `lunarRimLight`    : Cold silver-blue / aqua-teal Lunar Rim PointLight in Shaft, Underground River & Shore
//   2. Zero-GC Pooled GPU Particle & 3D Debris Systems (0 draw calls when idle):
//        - Pool A: Velocity-stretched additive Spark & Molten Ember streaks (1 DC InstancedBufferGeometry)
//        - Pool B: Volumetric turbulent Dust, Ash-Smoke & Water-Spray Foam plumes (1 DC InstancedBufferGeometry)
//        - Pool C: 3D Tumbling Faceted Limestone Chunks + Rusted Iron Bar Shards (2 InstancedMeshes)
//        - Pool D: Expanding Custom-GLSL Shockwave Light Rings (4 pooled meshes)
//        - Pool E: 55 Translucent Fresnel-Optic 3D Underwater Bubbles (1 InstancedMesh)

export const SOULS_ESCAPE_VFX_VERSION = '20261124z92';

// ============================================================================
// Pure Zero-GC Math Helpers & Deterministic PRNG
// ============================================================================

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function clamp01(v) {
  return v <= 0 ? 0 : v >= 1 ? 1 : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function finiteOr(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function detectMobileDevice() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPhone|iPod|iPad|Android/i.test(ua)) return true;
  if (typeof window !== 'undefined') {
    const touch = navigator.maxTouchPoints || 0;
    const minDim = Math.min(window.innerWidth || 1280, window.innerHeight || 720);
    if (touch > 1 && minDim <= 1024) return true;
  }
  return false;
}

function readPos3(src, out) {
  if (!src) return false;
  if (Array.isArray(src)) {
    const x = Number(src[0]);
    const y = Number(src[1]);
    const z = Number(src[2]);
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
      out.x = x;
      out.y = y;
      out.z = z;
      return true;
    }
    return false;
  }
  const x = Number(src.x);
  const y = Number(src.y);
  const z = Number(src.z);
  if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
    out.x = x;
    out.y = y;
    out.z = z;
    return true;
  }
  return false;
}

// ============================================================================
// Custom GLSL Shaders (WebGL2 / ANGLE D3D11 / Mobile mediump-safe, 0 loops)
// ============================================================================

// Pool A: Velocity-Stretched Sparks & Molten Embers (AdditiveBlending)
const SPARK_VERT_SHADER = /* glsl */ `
attribute vec3 aPos;
attribute vec3 aVel;
attribute vec4 aColorLife; // rgb = linear color, a = normalized life left [0..1]
attribute vec4 aParams;    // x = baseWidth, y = stretchMul, z = kind (0=parry,1=ember,2=rust,3=shaft), w = seed

varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
varying float vKind;
varying float vSeed;

uniform float uTime;
uniform float uPixelScale;

void main() {
  vUv = uv;
  float lifeLeft = aColorLife.a;
  if ( lifeLeft <= 0.001 ) {
    vAlpha = 0.0;
    vColor = vec3( 0.0 );
    vKind = 0.0;
    vSeed = 0.0;
    gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );
    return;
  }

  vec4 mvCenter = modelViewMatrix * vec4( aPos, 1.0 );
  vec3 mvVel = ( modelViewMatrix * vec4( aVel, 0.0 ) ).xyz;
  vec2 screenVel = mvVel.xy;
  float speed2D = length( screenVel );

  vec2 dir = speed2D > 0.015 ? ( screenVel / speed2D ) : vec2( 0.0, 1.0 );
  vec2 perp = vec2( -dir.y, dir.x );

  float baseW = aParams.x * uPixelScale;
  float stretch = aParams.y;
  float kind = aParams.z;
  float seed = aParams.w;

  // Embers stay slightly rounder & flicker; sparks & shaft streaks elongate cleanly along velocity!
  float lenFactor = kind > 0.5 && kind < 1.5
    ? clamp( 1.15 + speed2D * 0.22 * stretch, 1.1, 3.2 )
    : clamp( 1.65 + speed2D * 0.42 * stretch, 1.65, 9.5 );

  // Smooth shrink near end of life without popping
  float tailScale = smoothstep( 0.0, 0.24, lifeLeft );
  float w = baseW * ( 0.48 + 0.52 * tailScale );
  float h = baseW * lenFactor * ( 0.45 + 0.55 * tailScale );

  vec2 offset = perp * ( position.x * w ) + dir * ( position.y * h );
  mvCenter.xy += offset;

  float flicker = 0.82 + 0.18 * sin( uTime * ( 18.0 + seed * 14.0 ) + seed * 53.0 );
  vColor = aColorLife.rgb;
  vAlpha = clamp( tailScale * flicker, 0.0, 1.0 );
  vKind = kind;
  vSeed = seed;

  gl_Position = projectionMatrix * mvCenter;
}
`;

const SPARK_FRAG_SHADER = /* glsl */ `
varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
varying float vKind;
varying float vSeed;

void main() {
  if ( vAlpha <= 0.002 ) discard;

  vec2 p = vUv * 2.0 - 1.0;
  // Slightly tapered comet/teardrop profile along streak axis (p.y > 0 = head, p.y < 0 = tail)
  float xScaled = p.x / mix( 0.72, 1.0, clamp( p.y * 0.5 + 0.5, 0.0, 1.0 ) );
  float d2 = xScaled * xScaled * 2.4 + p.y * p.y;
  if ( d2 >= 1.25 ) discard;

  float core = exp( -d2 * 5.2 );
  float halo = pow( max( 1.0 - sqrt( clamp( d2 * 0.82, 0.0, 1.0 ) ), 0.0 ), 2.2 );

  // White-hot incandescent filament core blending into rich linear spark/ember color
  vec3 hotCore = vKind < 0.5
    ? vec3( 1.0, 0.98, 0.90 )
    : ( vKind < 1.5 ? vec3( 1.0, 0.84, 0.44 ) : vec3( 1.0, 0.92, 0.68 ) );

  vec3 col = mix( vColor, hotCore, clamp( core * 0.88, 0.0, 1.0 ) );
  float energy = ( core * 1.95 + halo * 0.68 ) * vAlpha;
  gl_FragColor = vec4( col * energy, clamp( energy * 0.75, 0.0, 1.0 ) );
}
`;

// Pool B: Volumetric Dust Clouds, Molten-Underlit Debris Smoke & Water Spray Foam (NormalBlending)
const CLOUD_VERT_SHADER = /* glsl */ `
attribute vec3 aPos;
attribute vec4 aColorAlpha; // rgb = color, a = current opacity
attribute vec4 aParams;     // x = scale, y = rotRad, z = kind (0=dust,1=collapseSmoke,2=waterSpray,3=shaftDust), w = seed

varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
varying float vKind;
varying float vSeed;

uniform float uPixelScale;

void main() {
  vUv = uv;
  float alpha = aColorAlpha.a;
  if ( alpha <= 0.002 ) {
    vAlpha = 0.0;
    vColor = vec3( 0.0 );
    vKind = 0.0;
    vSeed = 0.0;
    gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );
    return;
  }

  vec4 mvCenter = modelViewMatrix * vec4( aPos, 1.0 );
  float sz = aParams.x * uPixelScale;
  float rot = aParams.y;
  float kind = aParams.z;

  float cs = cos( rot );
  float sn = sin( rot );
  // Shaft falling dust wisps stretch vertically along fall axis for dramatic motion speed
  float aspectY = kind > 2.5 ? 2.85 : 1.0;
  vec2 lp = vec2( position.x * sz, position.y * sz * aspectY );
  vec2 rp = vec2( lp.x * cs - lp.y * sn, lp.x * sn + lp.y * cs );
  mvCenter.xy += rp;

  vColor = aColorAlpha.rgb;
  vAlpha = alpha;
  vKind = kind;
  vSeed = aParams.w;

  gl_Position = projectionMatrix * mvCenter;
}
`;

const CLOUD_FRAG_SHADER = /* glsl */ `
varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
varying float vKind;
varying float vSeed;

void main() {
  if ( vAlpha <= 0.002 ) discard;

  vec2 p = vUv * 2.0 - 1.0;
  float r = length( p );
  if ( r >= 1.0 ) discard;

  float ang = atan( p.y, p.x );
  // Multi-lobe organic cloud / foam silhouette (0 loops -> zero ANGLE warnings)
  float lobe = 0.78
    + 0.13 * sin( ang * 3.0 + vSeed * 6.2831853 )
    + 0.09 * cos( ang * 5.0 - vSeed * 11.41 )
    + 0.05 * sin( ang * 7.0 + vSeed * 17.83 );

  float radial = clamp( r / max( lobe, 0.35 ), 0.0, 1.0 );
  float mask = pow( max( 1.0 - radial, 0.0 ), vKind > 1.5 && vKind < 2.5 ? 1.55 : 1.85 );
  if ( mask <= 0.012 ) discard;

  vec3 col = vColor;

  if ( vKind < 0.5 ) {
    // Stone dust puff: subtle directional top-light gradient
    float topGrad = 0.84 + 0.24 * clamp( p.y * 0.5 + 0.5, 0.0, 1.0 );
    col *= topGrad;
  } else if ( vKind < 1.5 ) {
    // Floor collapse dense ash/smoke cloud: molten fiery crimson-amber bounce under-glow!
    float underGlow = clamp( ( -p.y * 0.65 + 0.45 ) * ( 1.0 - radial * 0.65 ), 0.0, 1.0 );
    vec3 emberBounce = vec3( 0.96, 0.28, 0.05 );
    col = mix( col * 0.72, emberBounce, underGlow * 0.55 );
  } else if ( vKind < 2.5 ) {
    // Water splash fountain spray & frothy mist: bright crisp moonlit core + airy cyan edge
    float sprayCore = exp( -radial * radial * 3.4 );
    col = mix( col, vec3( 0.96, 0.99, 1.0 ), sprayCore * 0.65 );
  } else {
    // Shaft high-speed falling dust wisp
    col *= 0.88 + 0.18 * ( 1.0 - radial );
  }

  float outAlpha = clamp( mask * vAlpha, 0.0, 0.92 );
  gl_FragColor = vec4( col, outAlpha );
}
`;

// Pool D: Expanding Luminous Shockwave Ring (AdditiveBlending)
const RING_VERT_SHADER = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`;

const RING_FRAG_SHADER = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uCoreColor;
uniform float uProgress;
uniform float uOpacity;
uniform float uSeed;

varying vec2 vUv;

void main() {
  if ( uOpacity <= 0.002 ) discard;

  vec2 p = vUv * 2.0 - 1.0;
  float r = length( p );
  if ( r >= 1.0 ) discard;

  float ang = atan( p.y, p.x );
  float shimmer = 0.0065 * sin( ang * 11.0 + uSeed * 6.28318 ) + 0.004 * cos( ang * 19.0 - uProgress * 12.0 );
  float ringPos = 0.86 + shimmer;
  float prog = clamp( uProgress, 0.0, 1.0 );
  float width = mix( 0.062, 0.020, prog );

  float dist = abs( r - ringPos );
  // Razor-crisp bright shockwave crest + delicate inner pressure trail + soft outer bloom halo
  float sharpCrest = exp( -( dist * dist ) / max( width * width * 0.22, 0.00018 ) );
  float softHalo   = exp( -( dist * dist ) / max( width * width * 3.8, 0.0024 ) ) * 0.34;
  float innerWake  = smoothstep( ringPos - 0.24, ringPos, r ) * ( 1.0 - smoothstep( ringPos, ringPos + 0.025, r ) ) * 0.22;
  float edgeFade   = smoothstep( 1.0, 0.93, r );

  float mask = ( sharpCrest + softHalo + innerWake ) * edgeFade;
  if ( mask <= 0.006 ) discard;

  vec3 col = mix( uColor, uCoreColor, clamp( sharpCrest * 0.90, 0.0, 1.0 ) );
  float finalAlpha = clamp( mask * uOpacity, 0.0, 1.0 );
  gl_FragColor = vec4( col * ( finalAlpha * 1.18 ), finalAlpha );
}
`;

// Pool E: Translucent Fresnel-Optic 3D Underwater Bubbles (InstancedMesh ShaderMaterial)
const BUBBLE_VERT_SHADER = /* glsl */ `
varying vec3 vNormalView;
varying vec3 vViewDir;

void main() {
  vec4 mvPos = modelViewMatrix * instanceMatrix * vec4( position, 1.0 );
  mat3 nMat = mat3( modelViewMatrix ) * mat3( instanceMatrix );
  vNormalView = normalize( nMat * normal );
  vViewDir = normalize( -mvPos.xyz );
  gl_Position = projectionMatrix * mvPos;
}
`;

const BUBBLE_FRAG_SHADER = /* glsl */ `
uniform float uMasterAlpha;
uniform vec3 uRimColor;
uniform vec3 uSpecColor;

varying vec3 vNormalView;
varying vec3 vViewDir;

void main() {
  if ( uMasterAlpha <= 0.003 ) discard;

  vec3 N = normalize( vNormalView );
  vec3 V = normalize( vViewDir );
  float ndv = clamp( abs( dot( N, V ) ), 0.0, 1.0 );
  float fresnel = pow( 1.0 - ndv, 2.35 );

  // Crisp top-left moonlit overhead highlight inside the underwater shaft
  vec3 L = normalize( vec3( 0.28, 0.86, 0.42 ) );
  vec3 H = normalize( L + V );
  float spec = pow( max( dot( N, H ), 0.0 ), 34.0 );

  // Secondary lower caustic bounce
  vec3 L2 = normalize( vec3( -0.45, -0.55, 0.65 ) );
  float caustic = pow( max( dot( N, L2 ), 0.0 ), 6.0 ) * 0.25;

  vec3 col = uRimColor * ( 0.35 + fresnel * 1.15 + caustic ) + uSpecColor * ( spec * 1.45 );
  float alpha = clamp( ( 0.11 + fresnel * 0.68 + spec * 0.65 ) * uMasterAlpha, 0.0, 0.90 );
  gl_FragColor = vec4( col, alpha );
}
`;

// ============================================================================
// Procedural Geometry Builders (Stone Chunk + Sheared Iron Bar Shard)
// ============================================================================

function buildJaggedStoneChunkGeometry(THREE) {
  const geo = new THREE.IcosahedronGeometry(0.155, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // Deterministic rough basalt/limestone fracture facets
    const h = Math.sin(x * 37.1 + y * 53.7 + z * 29.3);
    const k = 0.78 + 0.36 * (0.5 + 0.5 * h);
    pos.setXYZ(i, x * k * 1.18, y * k * 0.78, z * k * 1.05);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildRustedIronShardGeometry(THREE) {
  // Sheared forged iron grate bar segment with bent & jagged fractured ends
  const geo = new THREE.BoxGeometry(0.068, 0.54, 0.068, 1, 3, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const bend = y * y * 0.38;
    const taper = y > 0.18 ? 0.52 : (y < -0.18 ? 0.66 : 1.0);
    pos.setXYZ(i, x * taper + bend, y, z * taper + bend * 0.35);
  }
  geo.computeVertexNormals();
  return geo;
}

// ============================================================================
// Main Factory: createSoulsEscapeVfx(THREE, opts = {})
// ============================================================================

export function createSoulsEscapeVfx(THREE, opts = {}) {
  if (!THREE || typeof THREE.Group !== 'function') {
    throw new Error('createSoulsEscapeVfx requires a valid Three.js namespace');
  }

  const isMobile = opts?.isMobile !== undefined ? Boolean(opts.isMobile) : detectMobileDevice();
  let lowSpec = Boolean(opts?.lowSpec);
  const parentObj = opts?.scene || opts?.parent || null;

  // Deterministic zero-GC PRNG
  let rngState = 0xC1AE5A92 >>> 0;
  function nextRand() {
    rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0;
    return rngState / 4294967296;
  }
  function randRange(lo, hi) {
    return lo + (hi - lo) * nextRand();
  }

  // Root Scene Graph
  const rootGroup = new THREE.Group();
  rootGroup.name = 'SoulsEscapeVfxRoot';

  const cutsceneLightRig = new THREE.Group();
  cutsceneLightRig.name = 'SoulsEscapeCutsceneLightRig';
  rootGroup.add(cutsceneLightRig);

  const vfxGroup = new THREE.Group();
  vfxGroup.name = 'SoulsEscapeVfxParticles';
  rootGroup.add(vfxGroup);

  if (parentObj && typeof parentObj.add === 'function') {
    parentObj.add(rootGroup);
  }

  // ==========================================================================
  // 1. 3-Point Cinema Light Rig (`cutsceneLightRig`)
  // ==========================================================================
  const throneRimLight = new THREE.PointLight(0xff6b26, 0, 26.0, 1.32);
  throneRimLight.name = 'SoulsEscapeThroneRimLight';
  throneRimLight.castShadow = false;
  throneRimLight.position.set(0, 3.6, -49.0);
  cutsceneLightRig.add(throneRimLight);

  const impactFlashLight = new THREE.PointLight(0xfff0c4, 0, 24.0, 1.28);
  impactFlashLight.name = 'SoulsEscapeImpactFlashLight';
  impactFlashLight.castShadow = false;
  impactFlashLight.position.set(0, 1.4, -45.0);
  cutsceneLightRig.add(impactFlashLight);

  const lunarRimLight = new THREE.PointLight(0x8ecaff, 0, 24.0, 1.28);
  lunarRimLight.name = 'SoulsEscapeLunarRimLight';
  lunarRimLight.castShadow = false;
  lunarRimLight.position.set(0, 2.4, 2.0);
  cutsceneLightRig.add(lunarRimLight);

  // Expose named refs on rig group for easy inspection
  cutsceneLightRig.throneRimLight = throneRimLight;
  cutsceneLightRig.impactFlashLight = impactFlashLight;
  cutsceneLightRig.lunarRimLight = lunarRimLight;

  let rigActive = Boolean(opts?.active);
  cutsceneLightRig.visible = rigActive;
  cutsceneLightRig.userData.active = rigActive;

  // Dynamic Impact Flash Envelope State (zero GC)
  let flashTimer = 0.0;
  let flashDuration = 0.22;
  let flashPeak = 9.0;
  const flashPos = { x: 0, y: 1.4, z: -45 };
  const _colA = new THREE.Color();
  const _colB = new THREE.Color();

  function triggerImpactFlash(x, y, z, colorHex = 0xfff0c4, peakIntensity = 9.0, durationSec = 0.22, distance = 24.0) {
    flashPos.x = finiteOr(x, 0);
    flashPos.y = finiteOr(y, 1.2);
    flashPos.z = finiteOr(z, 0);
    flashPeak = clamp(finiteOr(peakIntensity, 9.0), 0.5, 14.0);
    flashDuration = clamp(finiteOr(durationSec, 0.22), 0.08, 1.2);
    flashTimer = flashDuration;
    impactFlashLight.color.setHex(colorHex);
    impactFlashLight.distance = clamp(finiteOr(distance, 24.0), 8.0, 38.0);
    impactFlashLight.position.set(flashPos.x, flashPos.y, flashPos.z);
    if (rigActive) {
      impactFlashLight.intensity = flashPeak;
    }
  }

  // ==========================================================================
  // 2. Pool A — Velocity-Stretched Additive Sparks & Molten Embers (1 DC)
  // ==========================================================================
  const MAX_SPARKS = isMobile ? 280 : 512;

  const sparkGeo = new THREE.InstancedBufferGeometry();
  const quadVerts = new Float32Array([
    -0.5, -0.5, 0.0,
     0.5, -0.5, 0.0,
     0.5,  0.5, 0.0,
    -0.5,  0.5, 0.0
  ]);
  const quadUvs = new Float32Array([
    0.0, 0.0,
    1.0, 0.0,
    1.0, 1.0,
    0.0, 1.0
  ]);
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(quadVerts, 3));
  sparkGeo.setAttribute('uv', new THREE.BufferAttribute(quadUvs, 2));
  sparkGeo.setIndex([0, 1, 2, 0, 2, 3]);

  // GPU per-instance attributes
  const spPosArr = new Float32Array(MAX_SPARKS * 3);
  const spVelArr = new Float32Array(MAX_SPARKS * 3);
  const spColLifeArr = new Float32Array(MAX_SPARKS * 4);
  const spParamArr = new Float32Array(MAX_SPARKS * 4);

  // CPU simulation state (flat SoA typed arrays -> 0 GC!)
  const spAge = new Float32Array(MAX_SPARKS);
  const spLife = new Float32Array(MAX_SPARKS);
  const spGrav = new Float32Array(MAX_SPARKS);
  const spDrag = new Float32Array(MAX_SPARKS);
  const spFloorY = new Float32Array(MAX_SPARKS);
  const spBounce = new Float32Array(MAX_SPARKS);
  const spBaseR = new Float32Array(MAX_SPARKS);
  const spBaseG = new Float32Array(MAX_SPARKS);
  const spBaseB = new Float32Array(MAX_SPARKS);
  const spEndR = new Float32Array(MAX_SPARKS);
  const spEndG = new Float32Array(MAX_SPARKS);
  const spEndB = new Float32Array(MAX_SPARKS);
  let sparkCount = 0;

  const spPosAttr = new THREE.InstancedBufferAttribute(spPosArr, 3);
  const spVelAttr = new THREE.InstancedBufferAttribute(spVelArr, 3);
  const spColLifeAttr = new THREE.InstancedBufferAttribute(spColLifeArr, 4);
  const spParamAttr = new THREE.InstancedBufferAttribute(spParamArr, 4);
  spPosAttr.setUsage(THREE.DynamicDrawUsage);
  spVelAttr.setUsage(THREE.DynamicDrawUsage);
  spColLifeAttr.setUsage(THREE.DynamicDrawUsage);
  spParamAttr.setUsage(THREE.DynamicDrawUsage);

  sparkGeo.setAttribute('aPos', spPosAttr);
  sparkGeo.setAttribute('aVel', spVelAttr);
  sparkGeo.setAttribute('aColorLife', spColLifeAttr);
  sparkGeo.setAttribute('aParams', spParamAttr);
  sparkGeo.instanceCount = 0;

  const sparkUniforms = {
    uTime: { value: 0.0 },
    uPixelScale: { value: lowSpec ? 0.92 : 1.0 }
  };

  const sparkMat = new THREE.ShaderMaterial({
    uniforms: sparkUniforms,
    vertexShader: SPARK_VERT_SHADER,
    fragmentShader: SPARK_FRAG_SHADER,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });

  const sparkMesh = new THREE.Mesh(sparkGeo, sparkMat);
  sparkMesh.name = 'SoulsEscapeSparkPool';
  sparkMesh.frustumCulled = false;
  sparkMesh.castShadow = false;
  sparkMesh.receiveShadow = false;
  sparkMesh.renderOrder = 15;
  sparkMesh.visible = false;
  vfxGroup.add(sparkMesh);

  function spawnSpark(
    x, y, z, vx, vy, vz,
    life, width, stretch, kind,
    r0, g0, b0, r1, g1, b1,
    grav, drag, floorY, bounce
  ) {
    const cap = lowSpec ? Math.min(MAX_SPARKS, 200) : MAX_SPARKS;
    let idx = sparkCount;
    if (idx >= cap) {
      // Overwrite oldest slot (lowest remaining life ratio) for seamless burst priority
      let oldestIdx = 0;
      let minRem = 999;
      for (let i = 0; i < cap; i++) {
        const rem = (spLife[i] - spAge[i]) / (spLife[i] || 1);
        if (rem < minRem) {
          minRem = rem;
          oldestIdx = i;
        }
      }
      idx = oldestIdx;
    } else {
      sparkCount++;
    }

    const i3 = idx * 3;
    const i4 = idx * 4;
    spPosArr[i3] = x;
    spPosArr[i3 + 1] = y;
    spPosArr[i3 + 2] = z;

    spVelArr[i3] = vx;
    spVelArr[i3 + 1] = vy;
    spVelArr[i3 + 2] = vz;

    spColLifeArr[i4] = r0;
    spColLifeArr[i4 + 1] = g0;
    spColLifeArr[i4 + 2] = b0;
    spColLifeArr[i4 + 3] = 1.0;

    spParamArr[i4] = width;
    spParamArr[i4 + 1] = stretch;
    spParamArr[i4 + 2] = kind;
    spParamArr[i4 + 3] = nextRand();

    spAge[idx] = 0.0;
    spLife[idx] = life;
    spGrav[idx] = grav;
    spDrag[idx] = drag;
    spFloorY[idx] = floorY;
    spBounce[idx] = bounce;
    spBaseR[idx] = r0;
    spBaseG[idx] = g0;
    spBaseB[idx] = b0;
    spEndR[idx] = r1;
    spEndG[idx] = g1;
    spEndB[idx] = b1;
  }

  function swapRemoveSpark(i) {
    const last = sparkCount - 1;
    if (i !== last) {
      const i3 = i * 3;
      const l3 = last * 3;
      spPosArr[i3] = spPosArr[l3];
      spPosArr[i3 + 1] = spPosArr[l3 + 1];
      spPosArr[i3 + 2] = spPosArr[l3 + 2];
      spVelArr[i3] = spVelArr[l3];
      spVelArr[i3 + 1] = spVelArr[l3 + 1];
      spVelArr[i3 + 2] = spVelArr[l3 + 2];

      const i4 = i * 4;
      const l4 = last * 4;
      spColLifeArr[i4] = spColLifeArr[l4];
      spColLifeArr[i4 + 1] = spColLifeArr[l4 + 1];
      spColLifeArr[i4 + 2] = spColLifeArr[l4 + 2];
      spColLifeArr[i4 + 3] = spColLifeArr[l4 + 3];
      spParamArr[i4] = spParamArr[l4];
      spParamArr[i4 + 1] = spParamArr[l4 + 1];
      spParamArr[i4 + 2] = spParamArr[l4 + 2];
      spParamArr[i4 + 3] = spParamArr[l4 + 3];

      spAge[i] = spAge[last];
      spLife[i] = spLife[last];
      spGrav[i] = spGrav[last];
      spDrag[i] = spDrag[last];
      spFloorY[i] = spFloorY[last];
      spBounce[i] = spBounce[last];
      spBaseR[i] = spBaseR[last];
      spBaseG[i] = spBaseG[last];
      spBaseB[i] = spBaseB[last];
      spEndR[i] = spEndR[last];
      spEndG[i] = spEndG[last];
      spEndB[i] = spEndB[last];
    }
    sparkCount--;
  }

  // ==========================================================================
  // 3. Pool B — Volumetric Dust, Collapse Smoke & Water Splash Foam (1 DC)
  // ==========================================================================
  const MAX_CLOUDS = isMobile ? 220 : 384;

  const cloudGeo = new THREE.InstancedBufferGeometry();
  cloudGeo.setAttribute('position', new THREE.BufferAttribute(quadVerts, 3));
  cloudGeo.setAttribute('uv', new THREE.BufferAttribute(quadUvs, 2));
  cloudGeo.setIndex([0, 1, 2, 0, 2, 3]);

  const clPosArr = new Float32Array(MAX_CLOUDS * 3);
  const clColAlphaArr = new Float32Array(MAX_CLOUDS * 4);
  const clParamArr = new Float32Array(MAX_CLOUDS * 4);

  const clVx = new Float32Array(MAX_CLOUDS);
  const clVy = new Float32Array(MAX_CLOUDS);
  const clVz = new Float32Array(MAX_CLOUDS);
  const clAge = new Float32Array(MAX_CLOUDS);
  const clLife = new Float32Array(MAX_CLOUDS);
  const clGrav = new Float32Array(MAX_CLOUDS);
  const clDrag = new Float32Array(MAX_CLOUDS);
  const clSize0 = new Float32Array(MAX_CLOUDS);
  const clSize1 = new Float32Array(MAX_CLOUDS);
  const clPeakAlpha = new Float32Array(MAX_CLOUDS);
  const clSpin = new Float32Array(MAX_CLOUDS);
  let cloudCount = 0;

  const clPosAttr = new THREE.InstancedBufferAttribute(clPosArr, 3);
  const clColAlphaAttr = new THREE.InstancedBufferAttribute(clColAlphaArr, 4);
  const clParamAttr = new THREE.InstancedBufferAttribute(clParamArr, 4);
  clPosAttr.setUsage(THREE.DynamicDrawUsage);
  clColAlphaAttr.setUsage(THREE.DynamicDrawUsage);
  clParamAttr.setUsage(THREE.DynamicDrawUsage);

  cloudGeo.setAttribute('aPos', clPosAttr);
  cloudGeo.setAttribute('aColorAlpha', clColAlphaAttr);
  cloudGeo.setAttribute('aParams', clParamAttr);
  cloudGeo.instanceCount = 0;

  const cloudUniforms = {
    uPixelScale: { value: lowSpec ? 0.92 : 1.0 }
  };

  const cloudMat = new THREE.ShaderMaterial({
    uniforms: cloudUniforms,
    vertexShader: CLOUD_VERT_SHADER,
    fragmentShader: CLOUD_FRAG_SHADER,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    toneMapped: true
  });

  const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
  cloudMesh.name = 'SoulsEscapeCloudPool';
  cloudMesh.frustumCulled = false;
  cloudMesh.castShadow = false;
  cloudMesh.receiveShadow = false;
  cloudMesh.renderOrder = 13;
  cloudMesh.visible = false;
  vfxGroup.add(cloudMesh);

  function spawnCloud(
    x, y, z, vx, vy, vz,
    life, size0, size1, peakAlpha,
    r, g, b, kind, grav, drag, spin
  ) {
    const cap = lowSpec ? Math.min(MAX_CLOUDS, 160) : MAX_CLOUDS;
    let idx = cloudCount;
    if (idx >= cap) {
      let oldestIdx = 0;
      let minRem = 999;
      for (let i = 0; i < cap; i++) {
        const rem = (clLife[i] - clAge[i]) / (clLife[i] || 1);
        if (rem < minRem) {
          minRem = rem;
          oldestIdx = i;
        }
      }
      idx = oldestIdx;
    } else {
      cloudCount++;
    }

    const i3 = idx * 3;
    const i4 = idx * 4;
    clPosArr[i3] = x;
    clPosArr[i3 + 1] = y;
    clPosArr[i3 + 2] = z;

    clColAlphaArr[i4] = r;
    clColAlphaArr[i4 + 1] = g;
    clColAlphaArr[i4 + 2] = b;
    clColAlphaArr[i4 + 3] = peakAlpha * 0.45;

    clParamArr[i4] = size0;
    clParamArr[i4 + 1] = nextRand() * Math.PI * 2.0;
    clParamArr[i4 + 2] = kind;
    clParamArr[i4 + 3] = nextRand();

    clVx[idx] = vx;
    clVy[idx] = vy;
    clVz[idx] = vz;
    clAge[idx] = 0.0;
    clLife[idx] = life;
    clGrav[idx] = grav;
    clDrag[idx] = drag;
    clSize0[idx] = size0;
    clSize1[idx] = size1;
    clPeakAlpha[idx] = peakAlpha;
    clSpin[idx] = spin;
  }

  function swapRemoveCloud(i) {
    const last = cloudCount - 1;
    if (i !== last) {
      const i3 = i * 3;
      const l3 = last * 3;
      clPosArr[i3] = clPosArr[l3];
      clPosArr[i3 + 1] = clPosArr[l3 + 1];
      clPosArr[i3 + 2] = clPosArr[l3 + 2];

      const i4 = i * 4;
      const l4 = last * 4;
      clColAlphaArr[i4] = clColAlphaArr[l4];
      clColAlphaArr[i4 + 1] = clColAlphaArr[l4 + 1];
      clColAlphaArr[i4 + 2] = clColAlphaArr[l4 + 2];
      clColAlphaArr[i4 + 3] = clColAlphaArr[l4 + 3];
      clParamArr[i4] = clParamArr[l4];
      clParamArr[i4 + 1] = clParamArr[l4 + 1];
      clParamArr[i4 + 2] = clParamArr[l4 + 2];
      clParamArr[i4 + 3] = clParamArr[l4 + 3];

      clVx[i] = clVx[last];
      clVy[i] = clVy[last];
      clVz[i] = clVz[last];
      clAge[i] = clAge[last];
      clLife[i] = clLife[last];
      clGrav[i] = clGrav[last];
      clDrag[i] = clDrag[last];
      clSize0[i] = clSize0[last];
      clSize1[i] = clSize1[last];
      clPeakAlpha[i] = clPeakAlpha[last];
      clSpin[i] = clSpin[last];
    }
    cloudCount--;
  }

  // ==========================================================================
  // 4. Pool C — 3D Tumbling Stone Chunks & Rusted Iron Bar Debris (2 DCs)
  // ==========================================================================
  const MAX_STONE_DEBRIS = isMobile ? 48 : 72;
  const stoneGeo = buildJaggedStoneChunkGeometry(THREE);
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x57524c,
    roughness: 0.91,
    metalness: 0.06,
    flatShading: true
  });
  const stoneMesh = new THREE.InstancedMesh(stoneGeo, stoneMat, MAX_STONE_DEBRIS);
  stoneMesh.name = 'SoulsEscapeStoneDebrisPool';
  stoneMesh.frustumCulled = false;
  stoneMesh.castShadow = false;
  stoneMesh.receiveShadow = false;
  stoneMesh.count = 0;
  stoneMesh.visible = false;
  vfxGroup.add(stoneMesh);

  const stX = new Float32Array(MAX_STONE_DEBRIS);
  const stY = new Float32Array(MAX_STONE_DEBRIS);
  const stZ = new Float32Array(MAX_STONE_DEBRIS);
  const stVx = new Float32Array(MAX_STONE_DEBRIS);
  const stVy = new Float32Array(MAX_STONE_DEBRIS);
  const stVz = new Float32Array(MAX_STONE_DEBRIS);
  const stRx = new Float32Array(MAX_STONE_DEBRIS);
  const stRy = new Float32Array(MAX_STONE_DEBRIS);
  const stRz = new Float32Array(MAX_STONE_DEBRIS);
  const stWrx = new Float32Array(MAX_STONE_DEBRIS);
  const stWry = new Float32Array(MAX_STONE_DEBRIS);
  const stWrz = new Float32Array(MAX_STONE_DEBRIS);
  const stSx = new Float32Array(MAX_STONE_DEBRIS);
  const stSy = new Float32Array(MAX_STONE_DEBRIS);
  const stSz = new Float32Array(MAX_STONE_DEBRIS);
  const stAge = new Float32Array(MAX_STONE_DEBRIS);
  const stLife = new Float32Array(MAX_STONE_DEBRIS);
  const stGrav = new Float32Array(MAX_STONE_DEBRIS);
  const stFloorY = new Float32Array(MAX_STONE_DEBRIS);
  let stoneCount = 0;

  const MAX_METAL_DEBRIS = isMobile ? 20 : 32;
  const metalGeo = buildRustedIronShardGeometry(THREE);
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x613a27,
    roughness: 0.56,
    metalness: 0.78,
    emissive: 0x1a0902,
    emissiveIntensity: 0.25
  });
  const metalMesh = new THREE.InstancedMesh(metalGeo, metalMat, MAX_METAL_DEBRIS);
  metalMesh.name = 'SoulsEscapeMetalDebrisPool';
  metalMesh.frustumCulled = false;
  metalMesh.castShadow = false;
  metalMesh.receiveShadow = false;
  metalMesh.count = 0;
  metalMesh.visible = false;
  vfxGroup.add(metalMesh);

  const mtX = new Float32Array(MAX_METAL_DEBRIS);
  const mtY = new Float32Array(MAX_METAL_DEBRIS);
  const mtZ = new Float32Array(MAX_METAL_DEBRIS);
  const mtVx = new Float32Array(MAX_METAL_DEBRIS);
  const mtVy = new Float32Array(MAX_METAL_DEBRIS);
  const mtVz = new Float32Array(MAX_METAL_DEBRIS);
  const mtRx = new Float32Array(MAX_METAL_DEBRIS);
  const mtRy = new Float32Array(MAX_METAL_DEBRIS);
  const mtRz = new Float32Array(MAX_METAL_DEBRIS);
  const mtWrx = new Float32Array(MAX_METAL_DEBRIS);
  const mtWry = new Float32Array(MAX_METAL_DEBRIS);
  const mtWrz = new Float32Array(MAX_METAL_DEBRIS);
  const mtSx = new Float32Array(MAX_METAL_DEBRIS);
  const mtSy = new Float32Array(MAX_METAL_DEBRIS);
  const mtSz = new Float32Array(MAX_METAL_DEBRIS);
  const mtAge = new Float32Array(MAX_METAL_DEBRIS);
  const mtLife = new Float32Array(MAX_METAL_DEBRIS);
  const mtGrav = new Float32Array(MAX_METAL_DEBRIS);
  let metalCount = 0;

  function spawnStoneDebris(x, y, z, vx, vy, vz, sx, sy, sz, life, grav, floorY) {
    let idx = stoneCount;
    if (idx >= MAX_STONE_DEBRIS) {
      idx = Math.floor(nextRand() * MAX_STONE_DEBRIS);
    } else {
      stoneCount++;
    }
    stX[idx] = x; stY[idx] = y; stZ[idx] = z;
    stVx[idx] = vx; stVy[idx] = vy; stVz[idx] = vz;
    stRx[idx] = randRange(0, 6.28); stRy[idx] = randRange(0, 6.28); stRz[idx] = randRange(0, 6.28);
    stWrx[idx] = randRange(-10, 10); stWry[idx] = randRange(-10, 10); stWrz[idx] = randRange(-10, 10);
    stSx[idx] = sx; stSy[idx] = sy; stSz[idx] = sz;
    stAge[idx] = 0.0; stLife[idx] = life; stGrav[idx] = grav; stFloorY[idx] = floorY;
  }

  function swapRemoveStone(i) {
    const last = stoneCount - 1;
    if (i !== last) {
      stX[i] = stX[last]; stY[i] = stY[last]; stZ[i] = stZ[last];
      stVx[i] = stVx[last]; stVy[i] = stVy[last]; stVz[i] = stVz[last];
      stRx[i] = stRx[last]; stRy[i] = stRy[last]; stRz[i] = stRz[last];
      stWrx[i] = stWrx[last]; stWry[i] = stWry[last]; stWrz[i] = stWrz[last];
      stSx[i] = stSx[last]; stSy[i] = stSy[last]; stSz[i] = stSz[last];
      stAge[i] = stAge[last]; stLife[i] = stLife[last]; stGrav[i] = stGrav[last]; stFloorY[i] = stFloorY[last];
    }
    stoneCount--;
  }

  function spawnMetalDebris(x, y, z, vx, vy, vz, sx, sy, sz, life, grav) {
    let idx = metalCount;
    if (idx >= MAX_METAL_DEBRIS) {
      idx = Math.floor(nextRand() * MAX_METAL_DEBRIS);
    } else {
      metalCount++;
    }
    mtX[idx] = x; mtY[idx] = y; mtZ[idx] = z;
    mtVx[idx] = vx; mtVy[idx] = vy; mtVz[idx] = vz;
    mtRx[idx] = randRange(0, 6.28); mtRy[idx] = randRange(0, 6.28); mtRz[idx] = randRange(0, 6.28);
    mtWrx[idx] = randRange(-13, 13); mtWry[idx] = randRange(-13, 13); mtWrz[idx] = randRange(-13, 13);
    mtSx[idx] = sx; mtSy[idx] = sy; mtSz[idx] = sz;
    mtAge[idx] = 0.0; mtLife[idx] = life; mtGrav[idx] = grav;
  }

  function swapRemoveMetal(i) {
    const last = metalCount - 1;
    if (i !== last) {
      mtX[i] = mtX[last]; mtY[i] = mtY[last]; mtZ[i] = mtZ[last];
      mtVx[i] = mtVx[last]; mtVy[i] = mtVy[last]; mtVz[i] = mtVz[last];
      mtRx[i] = mtRx[last]; mtRy[i] = mtRy[last]; mtRz[i] = mtRz[last];
      mtWrx[i] = mtWrx[last]; mtWry[i] = mtWry[last]; mtWrz[i] = mtWrz[last];
      mtSx[i] = mtSx[last]; mtSy[i] = mtSy[last]; mtSz[i] = mtSz[last];
      mtAge[i] = mtAge[last]; mtLife[i] = mtLife[last]; mtGrav[i] = mtGrav[last];
    }
    metalCount--;
  }

  // ==========================================================================
  // 5. Pool D — Expanding Luminous 3D Shockwave Rings (4 Pooled Meshes)
  // ==========================================================================
  const MAX_RINGS = 4;
  const ringGeo = new THREE.PlaneGeometry(2.0, 2.0, 1, 1);
  const ringSlots = new Array(MAX_RINGS);
  let ringCursor = 0;

  for (let i = 0; i < MAX_RINGS; i++) {
    const uniforms = {
      uColor: { value: new THREE.Color(0xffbe42) },
      uCoreColor: { value: new THREE.Color(0xffffff) },
      uProgress: { value: 0.0 },
      uOpacity: { value: 0.0 },
      uSeed: { value: i * 1.37 }
    };
    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: RING_VERT_SHADER,
      fragmentShader: RING_FRAG_SHADER,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    });
    const mesh = new THREE.Mesh(ringGeo, mat);
    mesh.name = `SoulsEscapeShockwaveRing_${i}`;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.renderOrder = 16;
    mesh.visible = false;
    vfxGroup.add(mesh);

    ringSlots[i] = {
      mesh,
      mat,
      uniforms,
      active: false,
      age: 0.0,
      life: 0.35,
      r0: 0.2,
      r1: 2.5,
      peakOpacity: 0.9,
      billboard: false
    };
  }

  function spawnShockwaveRing(x, y, z, r0, r1, life, colorHex, coreHex, peakOpacity, rotX, rotY, billboard) {
    const slot = ringSlots[ringCursor];
    ringCursor = (ringCursor + 1) % MAX_RINGS;
    slot.active = true;
    slot.age = 0.0;
    slot.life = life;
    slot.r0 = r0;
    slot.r1 = r1;
    slot.peakOpacity = peakOpacity;
    slot.billboard = Boolean(billboard);

    slot.uniforms.uColor.value.setHex(colorHex);
    slot.uniforms.uCoreColor.value.setHex(coreHex);
    slot.uniforms.uProgress.value = 0.0;
    slot.uniforms.uOpacity.value = peakOpacity;
    slot.uniforms.uSeed.value = nextRand() * 10.0;

    slot.mesh.position.set(x, y, z);
    slot.mesh.rotation.set(rotX, rotY, 0);
    slot.mesh.scale.set(r0, r0, r0);
    slot.mesh.visible = true;
  }

  // ==========================================================================
  // 6. Pool E — Translucent Fresnel 3D Underwater Bubbles (55 Active Stream!)
  // ==========================================================================
  const BUBBLE_COUNT = 55;
  const bubbleGeo = new THREE.SphereGeometry(0.052, 10, 8);
  const bubbleUniforms = {
    uMasterAlpha: { value: 0.0 },
    uRimColor: { value: new THREE.Color(0x9be9ff) },
    uSpecColor: { value: new THREE.Color(0xffffff) }
  };
  const bubbleMat = new THREE.ShaderMaterial({
    uniforms: bubbleUniforms,
    vertexShader: BUBBLE_VERT_SHADER,
    fragmentShader: BUBBLE_FRAG_SHADER,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    toneMapped: false
  });
  const bubbleMesh = new THREE.InstancedMesh(bubbleGeo, bubbleMat, BUBBLE_COUNT);
  bubbleMesh.name = 'SoulsEscapeUnderwaterBubbles';
  bubbleMesh.frustumCulled = false;
  bubbleMesh.castShadow = false;
  bubbleMesh.receiveShadow = false;
  bubbleMesh.renderOrder = 16;
  bubbleMesh.count = BUBBLE_COUNT;
  bubbleMesh.visible = false;
  vfxGroup.add(bubbleMesh);

  // Per-bubble local offsets & dynamics around camera anchor (zero GC)
  const bubOx = new Float32Array(BUBBLE_COUNT);
  const bubOy = new Float32Array(BUBBLE_COUNT);
  const bubOz = new Float32Array(BUBBLE_COUNT);
  const bubScale = new Float32Array(BUBBLE_COUNT);
  const bubRise = new Float32Array(BUBBLE_COUNT);
  const bubRush = new Float32Array(BUBBLE_COUNT);
  const bubPhase = new Float32Array(BUBBLE_COUNT);
  const bubWobble = new Float32Array(BUBBLE_COUNT);

  function seedBubble(i, spreadZ) {
    const ang = nextRand() * Math.PI * 2.0;
    const rad = 0.36 + Math.pow(nextRand(), 0.72) * 2.85;
    bubOx[i] = Math.cos(ang) * rad;
    bubOy[i] = randRange(-1.75, 1.55);
    bubOz[i] = spreadZ ? randRange(-1.8, 5.4) : randRange(2.4, 5.6);
    bubScale[i] = randRange(0.42, 1.85);
    bubRise[i] = randRange(0.75, 2.35);
    bubRush[i] = randRange(4.8, 9.6);
    bubPhase[i] = nextRand() * Math.PI * 2.0;
    bubWobble[i] = randRange(0.06, 0.22);
  }
  for (let i = 0; i < BUBBLE_COUNT; i++) {
    seedBubble(i, true);
  }

  let bubblesActive = false;
  let bubbleFade01 = 0.0;
  const bubbleAnchor = { x: 0, y: -0.35, z: 10.0 };
  let bubbleAnchorSet = false;

  // Continuous Shaft Falling Debris Stream State
  let fallingDebrisActive = false;
  const debrisAnchor = { x: 0, y: 12.0, z: 0.0 };
  let debrisAnchorSet = false;
  let debrisEmitAccum = 0.0;

  // Reusable Scratch Objects (Strictly 0 per-frame allocations!)
  const _tmpPos = new THREE.Vector3();
  const _tmpQuat = new THREE.Quaternion();
  const _tmpScale = new THREE.Vector3();
  const _tmpEuler = new THREE.Euler();
  const _tmpMat4 = new THREE.Matrix4();
  const _tmpCamPos = new THREE.Vector3();
  const _tmpLookPos = new THREE.Vector3();

  let internalElapsed = 0.0;
  let disposed = false;

  // ==========================================================================
  // Public Burst Emitters (Exact Contract)
  // ==========================================================================

  /**
   * 1) emitParrySparks(x, y, z, intensity = 1.0)
   * 48 incandescent white-gold velocity-stretched sparks + expanding clash shockwave ring + Impact Flash Light!
   */
  function emitParrySparks(x, y, z, intensity = 1.0) {
    if (disposed) return 0;
    const cx = finiteOr(x, 0);
    const cy = finiteOr(y, 1.35);
    const cz = finiteOr(z, 0);
    const scale = clamp(finiteOr(intensity, 1.0), 0.35, 1.8);

    const count = lowSpec ? 32 : 48;
    for (let i = 0; i < count; i++) {
      // Spherical burst biased slightly outward & upward for heroic blade-clash fan
      const theta = nextRand() * Math.PI * 2.0;
      const phi = Math.acos(randRange(-0.45, 0.96));
      const sinP = Math.sin(phi);
      const dirX = Math.cos(theta) * sinP;
      const dirY = Math.cos(phi) * 0.85 + 0.25;
      const dirZ = Math.sin(theta) * sinP;

      const speed = randRange(5.2, 14.5) * (0.78 + 0.26 * scale);
      const life = randRange(0.28, 0.78);
      const width = randRange(0.042, 0.082) * (0.85 + 0.18 * scale);
      const stretch = randRange(1.45, 2.65);

      // Start slightly offset along direction so even frame +1 is wide & readable
      const startOff = randRange(0.04, 0.16);
      const hotMix = nextRand();
      const r0 = 1.0;
      const g0 = lerp(0.84, 0.98, hotMix);
      const b0 = lerp(0.45, 0.88, hotMix);

      spawnSpark(
        cx + dirX * startOff,
        cy + dirY * startOff,
        cz + dirZ * startOff,
        dirX * speed,
        dirY * speed,
        dirZ * speed,
        life, width, stretch, 0.0,
        r0, g0, b0,
        1.0, 0.36, 0.04,
        -15.0, 1.45, 0.03, 0.45
      );
    }

    // Crisp luminous white-gold clash shockwave ring (billboards cleanly toward camera)
    spawnShockwaveRing(
      cx, cy, cz,
      0.18, 2.05 * (0.82 + 0.24 * scale),
      0.26,
      0xffbe42, 0xfff8dc,
      clamp(0.58 * scale, 0.32, 0.72),
      0.0, 0.0,
      true
    );

    // Dynamic Impact Flash Light spike (peaks to intensity = 9.0 for 0.22s!)
    triggerImpactFlash(cx, cy, cz, 0xfff0c4, clamp(9.0 * scale, 5.5, 11.5), 0.22, 22.0);
    return count;
  }

  /**
   * 2) emitDustImpact(x, y, z, scale = 1.0)
   * Billowing cathedral stone dust cloud on hero knockdown & frightened armor scoot scrapes.
   */
  function emitDustImpact(x, y, z, scale = 1.0) {
    if (disposed) return 0;
    const cx = finiteOr(x, 0);
    const cy = finiteOr(y, 0.08);
    const cz = finiteOr(z, 0);
    const sc = clamp(finiteOr(scale, 1.0), 0.3, 2.2);

    const puffCount = Math.max(8, Math.round((lowSpec ? 14 : 22) * Math.min(1.4, 0.72 + 0.35 * sc)));
    for (let i = 0; i < puffCount; i++) {
      const ang = nextRand() * Math.PI * 2.0;
      const rad = randRange(0.08, 0.55) * sc;
      const spd = randRange(0.95, 3.25) * sc;
      const vy = randRange(0.32, 1.45) * Math.sqrt(sc);
      const life = randRange(0.55, 1.28);
      const s0 = randRange(0.28, 0.52) * sc;
      const s1 = randRange(0.95, 1.75) * sc;
      const tone = randRange(0.46, 0.64);

      spawnCloud(
        cx + Math.cos(ang) * rad,
        cy + randRange(0.04, 0.22) * sc,
        cz + Math.sin(ang) * rad,
        Math.cos(ang) * spd,
        vy,
        Math.sin(ang) * spd,
        life, s0, s1,
        clamp(randRange(0.32, 0.52) * Math.min(1.25, 0.8 + sc * 0.25), 0.2, 0.68),
        tone * 1.04, tone * 0.99, tone * 0.93,
        0.0, -0.45, 2.65, randRange(-1.4, 1.4)
      );
    }

    // Small kicking stone grit chips on heavy knockdown impacts (scale >= 0.75)
    if (sc >= 0.75) {
      const gritCount = lowSpec ? 3 : 6;
      for (let i = 0; i < gritCount; i++) {
        const ang = nextRand() * Math.PI * 2.0;
        const spd = randRange(1.6, 3.8) * sc;
        const ch = randRange(0.22, 0.42) * sc;
        spawnStoneDebris(
          cx + Math.cos(ang) * 0.25 * sc,
          cy + 0.10,
          cz + Math.sin(ang) * 0.25 * sc,
          Math.cos(ang) * spd,
          randRange(1.8, 3.8) * sc,
          Math.sin(ang) * spd,
          ch, ch * 0.72, ch * 0.9,
          randRange(0.65, 1.15), -14.0, 0.04
        );
      }
    }

    return puffCount;
  }

  /**
   * 3) emitFloorCollapseBurst(x, y, z)
   * Colossal Throne Hall floor collapse explosion:
   *   - 65 incandescent molten embers/coals
   *   - 35 tumbling 3D fractured cathedral stone chunks
   *   - 24 dense ash/dust clouds with molten crimson under-glow
   *   - Massive crimson shockwave ring + seismic Impact Flash Light!
   */
  function emitFloorCollapseBurst(x, y, z) {
    if (disposed) return 0;
    const cx = finiteOr(x, 0);
    const cy = finiteOr(y, 0.15);
    const cz = finiteOr(z, -45.0);

    // 1. 65 incandescent molten embers & fiery smash sparks
    const emberCount = lowSpec ? 42 : 65;
    for (let i = 0; i < emberCount; i++) {
      const ang = nextRand() * Math.PI * 2.0;
      const ringR = randRange(0.15, 1.85);
      const outSpd = randRange(2.4, 9.8);
      const upSpd = randRange(3.2, 11.4);
      const isFastSpark = i < 22;
      const life = isFastSpark ? randRange(0.48, 1.05) : randRange(1.05, 2.25);
      const width = isFastSpark ? randRange(0.062, 0.112) : randRange(0.095, 0.185);
      const stretch = isFastSpark ? randRange(1.75, 3.0) : randRange(1.0, 1.65);
      const kind = isFastSpark ? 0.0 : 1.0;

      spawnSpark(
        cx + Math.cos(ang) * ringR,
        cy + randRange(0.08, 0.65),
        cz + Math.sin(ang) * ringR,
        Math.cos(ang) * outSpd,
        upSpd,
        Math.sin(ang) * outSpd,
        life, width, stretch, kind,
        1.0, isFastSpark ? 0.82 : 0.62, isFastSpark ? 0.34 : 0.12,
        0.78, 0.12, 0.01,
        isFastSpark ? -12.5 : -2.6,
        isFastSpark ? 1.15 : 1.75,
        -12.0, 0.0
      );
    }

    // 2. 35 3D fractured cathedral limestone chunks erupting upward & tumbling into the chasm
    const rockCount = lowSpec ? 22 : 35;
    for (let i = 0; i < rockCount; i++) {
      const ang = nextRand() * Math.PI * 2.0;
      const rad = randRange(0.18, 2.05);
      const outSpd = randRange(1.8, 7.6);
      const upSpd = randRange(4.2, 10.6);
      const baseSz = randRange(0.62, 1.75);
      // Outer chunks bounce on solid Throne Hall rim; inner chunks plunge straight into the abyss!
      const floorLimit = rad > 1.35 ? 0.06 : -14.0;
      spawnStoneDebris(
        cx + Math.cos(ang) * rad,
        cy + randRange(0.08, 0.45),
        cz + Math.sin(ang) * rad,
        Math.cos(ang) * outSpd,
        upSpd,
        Math.sin(ang) * outSpd,
        baseSz * randRange(0.85, 1.25),
        baseSz * randRange(0.55, 0.95),
        baseSz * randRange(0.85, 1.22),
        randRange(1.45, 2.55),
        -16.5,
        floorLimit
      );
    }

    // 3. 24 dense heavy dust & debris clouds with molten crimson under-lighting
    const smokeCount = lowSpec ? 16 : 24;
    for (let i = 0; i < smokeCount; i++) {
      const ang = (i / smokeCount) * Math.PI * 2.0 + randRange(-0.18, 0.18);
      const rad = randRange(0.35, 1.95);
      const outSpd = randRange(2.2, 6.2);
      const upSpd = randRange(1.6, 4.8);
      const tone = randRange(0.40, 0.56);
      spawnCloud(
        cx + Math.cos(ang) * rad,
        cy + randRange(0.16, 0.65),
        cz + Math.sin(ang) * rad,
        Math.cos(ang) * outSpd,
        upSpd,
        Math.sin(ang) * outSpd,
        randRange(1.15, 2.25),
        randRange(0.95, 1.65),
        randRange(2.75, 4.40),
        randRange(0.62, 0.84),
        tone * 1.06, tone * 0.97, tone * 0.90,
        1.0, -0.55, 2.1, randRange(-1.6, 1.6)
      );
    }

    // 4. Crisp Twin Crimson Seismic Shockwave Rings
    spawnShockwaveRing(
      cx, cy + 0.14, cz,
      0.55, 7.6,
      0.62,
      0xd92608, 0xffc052,
      0.72,
      -Math.PI * 0.5, 0.0,
      false
    );
    spawnShockwaveRing(
      cx, cy + 0.24, cz,
      0.30, 4.4,
      0.40,
      0xff5c14, 0xffe8aa,
      0.60,
      -Math.PI * 0.5, 0.0,
      false
    );

    // 5. Seismic crimson-amber Impact Flash Light spike
    triggerImpactFlash(cx, cy + 0.95, cz, 0xff5a18, 10.5, 0.42, 30.0);
    return emberCount + rockCount + smokeCount;
  }

  /**
   * 4) emitWaterSplash(x, y, z, scale = 1.0)
   * Dramatic 70-particle white water spray fountain & frothy mist plume + moonlit ripple ring!
   */
  function emitWaterSplash(x, y, z, scale = 1.0) {
    if (disposed) return 0;
    const cx = finiteOr(x, 0);
    const cy = finiteOr(y, 0.05);
    const cz = finiteOr(z, 0);
    const sc = clamp(finiteOr(scale, 1.0), 0.4, 2.2);

    // 46 high-arc ballistic water spray plumes + 24 misty surface foam clouds = 70 particles!
    const dropletCount = lowSpec ? 30 : 46;
    const mistCount = lowSpec ? 16 : 24;

    for (let i = 0; i < dropletCount; i++) {
      const ang = nextRand() * Math.PI * 2.0;
      const rad = randRange(0.08, 0.72) * sc;
      const outSpd = randRange(1.2, 5.4) * sc;
      const upSpd = randRange(4.4, 11.2) * Math.sqrt(sc);
      const bright = randRange(0.80, 0.96);

      spawnCloud(
        cx + Math.cos(ang) * rad,
        cy + randRange(0.05, 0.42) * sc,
        cz + Math.sin(ang) * rad,
        Math.cos(ang) * outSpd,
        upSpd,
        Math.sin(ang) * outSpd,
        randRange(0.55, 1.25),
        randRange(0.18, 0.40) * sc,
        randRange(0.55, 1.15) * sc,
        randRange(0.54, 0.80),
        bright * 0.90, bright * 0.97, bright,
        2.0, -13.8, 0.95, randRange(-2.5, 2.5)
      );
    }

    for (let i = 0; i < mistCount; i++) {
      const ang = nextRand() * Math.PI * 2.0;
      const rad = randRange(0.28, 1.25) * sc;
      const outSpd = randRange(1.8, 4.6) * sc;
      const upSpd = randRange(1.2, 3.6) * Math.sqrt(sc);
      const bright = randRange(0.74, 0.90);

      spawnCloud(
        cx + Math.cos(ang) * rad,
        cy + randRange(0.08, 0.45) * sc,
        cz + Math.sin(ang) * rad,
        Math.cos(ang) * outSpd,
        upSpd,
        Math.sin(ang) * outSpd,
        randRange(0.85, 1.70),
        randRange(0.45, 0.85) * sc,
        randRange(1.45, 2.75) * sc,
        randRange(0.32, 0.54),
        bright * 0.84, bright * 0.95, bright,
        2.0, -1.6, 2.35, randRange(-1.2, 1.2)
      );
    }

    // Moonlit frothy surface shockwave ripple ring
    spawnShockwaveRing(
      cx, cy + 0.08, cz,
      0.38 * sc, 4.4 * sc,
      0.52,
      0x7dd8f8, 0xf2fbff,
      0.82,
      -Math.PI * 0.5, 0.0,
      false
    );

    // Subtle cold lunar spray glint flash if no stronger flash is running
    if (flashTimer <= 0.02) {
      triggerImpactFlash(cx, cy + 1.1, cz, 0x9be8ff, clamp(4.8 * sc, 2.5, 7.2), 0.26, 20.0);
    }
    return dropletCount + mistCount;
  }

  /**
   * 5) emitGrateBreakBurst(x, y, z)
   * Explosive rusted spillway iron grate breach:
   *   - 40 fiery orange rusted-iron sparks
   *   - 50 explosive white-cyan water spray & mist plumes
   *   - 8 flying 3D twisted iron bar debris chunks
   *   - Shockwave ring + bright iron-breach Impact Flash Light!
   */
  function emitGrateBreakBurst(x, y, z) {
    if (disposed) return 0;
    const cx = finiteOr(x, 0);
    const cy = finiteOr(y, 0.85);
    const cz = finiteOr(z, 26.0);

    // 1. 40 fiery orange rusted-iron shear sparks blasting forward (+Z) and radially out
    const sparkBurstCount = lowSpec ? 26 : 40;
    for (let i = 0; i < sparkBurstCount; i++) {
      const ang = nextRand() * Math.PI * 2.0;
      const radSpd = randRange(2.4, 8.8);
      const fwdSpd = randRange(4.0, 12.6);
      const life = randRange(0.30, 0.82);

      spawnSpark(
        cx + Math.cos(ang) * randRange(0.12, 0.95),
        cy + Math.sin(ang) * randRange(0.12, 0.78),
        cz + randRange(-0.15, 0.35),
        Math.cos(ang) * radSpd,
        Math.sin(ang) * radSpd * 0.75 + randRange(1.4, 4.8),
        fwdSpd,
        life, randRange(0.050, 0.095), randRange(1.65, 2.85), 2.0,
        1.0, randRange(0.66, 0.86), randRange(0.18, 0.36),
        0.90, 0.24, 0.02,
        -13.5, 1.15, -0.25, 0.35
      );
    }

    // 2. 50 explosive rushing water splashes & billowing foam plumes bursting through the grate
    const splashCount = lowSpec ? 32 : 50;
    for (let i = 0; i < splashCount; i++) {
      const isDroplet = i < Math.round(splashCount * 0.64);
      const ang = nextRand() * Math.PI * 2.0;
      const radSpd = isDroplet ? randRange(1.8, 6.2) : randRange(1.6, 4.6);
      const fwdSpd = isDroplet ? randRange(5.2, 12.2) : randRange(3.2, 7.6);
      const bright = randRange(0.84, 0.99);

      spawnCloud(
        cx + Math.cos(ang) * randRange(0.15, 1.15),
        cy + randRange(-0.25, 0.95),
        cz + randRange(-0.2, 0.45),
        Math.cos(ang) * radSpd,
        isDroplet ? randRange(2.4, 8.2) : randRange(1.0, 3.6),
        fwdSpd,
        isDroplet ? randRange(0.55, 1.18) : randRange(0.80, 1.55),
        isDroplet ? randRange(0.28, 0.56) : randRange(0.56, 1.02),
        isDroplet ? randRange(0.85, 1.55) : randRange(1.75, 2.95),
        isDroplet ? randRange(0.62, 0.86) : randRange(0.38, 0.60),
        bright * 0.90, bright * 0.97, bright,
        2.0, isDroplet ? -12.5 : -2.2, isDroplet ? 0.95 : 1.9, randRange(-2.4, 2.4)
      );
    }

    // 3. 8 flying 3D twisted rusted-iron grate debris bars launching cleanly outward (+Z)
    const metalChunkCount = 8;
    for (let i = 0; i < metalChunkCount; i++) {
      const fanAngle = lerp(-0.95, 0.95, (i + 0.5) / metalChunkCount) + randRange(-0.12, 0.12);
      const speed = randRange(7.8, 13.4);
      const vx = Math.sin(fanAngle) * speed * 0.68;
      const vy = randRange(3.2, 7.6);
      const vz = Math.cos(fanAngle) * speed;
      const lenScale = randRange(0.95, 1.85);

      spawnMetalDebris(
        cx + lerp(-1.15, 1.15, i / (metalChunkCount - 1)),
        cy + randRange(-0.25, 0.65),
        cz + 0.15,
        vx, vy, vz,
        randRange(0.85, 1.35), lenScale, randRange(0.85, 1.35),
        randRange(1.45, 2.25),
        -15.2
      );
    }

    // 4. Crisp horizontal river-level shockwave ring + orange spark Impact Flash Light (zero floor clipping!)
    spawnShockwaveRing(
      cx, Math.max(0.12, cy - 0.55), cz + 0.35,
      0.35, 3.8,
      0.38,
      0xff9838, 0xfff5d6,
      0.56,
      -Math.PI * 0.5, 0.0,
      false
    );

    triggerImpactFlash(cx, cy + 0.25, cz + 0.35, 0xff9e3c, 9.0, 0.24, 24.0);
    return sparkBurstCount + splashCount + metalChunkCount;
  }

  // ==========================================================================
  // Continuous Streams: Underwater Bubbles & Shaft Falling Debris
  // ==========================================================================

  /**
   * 6) setUnderwaterBubbles(active, camPos)
   * Controls the lively stream of 55 translucent 3D Fresnel bubbles rushing past the camera.
   */
  function setUnderwaterBubbles(active, camPos = null) {
    if (disposed) return false;
    const want = Boolean(active);
    if (camPos && readPos3(camPos, bubbleAnchor)) {
      bubbleAnchorSet = true;
    }
    if (want && !bubblesActive) {
      // Freshly re-scatter around current camera position so frame 1 is immediately rich!
      for (let i = 0; i < BUBBLE_COUNT; i++) {
        seedBubble(i, true);
      }
      bubbleFade01 = Math.max(bubbleFade01, 0.35);
    }
    bubblesActive = want;
    return bubblesActive;
  }

  /**
   * 7) setFallingDebrisStream(active, heroPos)
   * Controls whistling stone debris, dust wisps & sparks rushing past hero/camera during shaft plunge.
   */
  function setFallingDebrisStream(active, heroPos = null) {
    if (disposed) return false;
    const want = Boolean(active);
    if (heroPos && readPos3(heroPos, debrisAnchor)) {
      debrisAnchorSet = true;
    }
    if (want && !fallingDebrisActive) {
      // Seed an immediate initial wave of falling shaft debris & dust streaks for instant visual richness!
      debrisEmitAccum = 0.0;
      const hx = debrisAnchor.x;
      const hy = debrisAnchor.y;
      const hz = debrisAnchor.z;
      const initClouds = lowSpec ? 8 : 14;
      for (let i = 0; i < initClouds; i++) {
        const ang = nextRand() * Math.PI * 2.0;
        const rad = randRange(0.75, 3.6);
        const tone = randRange(0.36, 0.56);
        spawnCloud(
          hx + Math.cos(ang) * rad,
          hy + randRange(-5.5, 4.5),
          hz + Math.sin(ang) * rad,
          randRange(-0.6, 0.6),
          randRange(6.5, 13.5),
          randRange(-0.6, 0.6),
          randRange(0.45, 0.95),
          randRange(0.24, 0.48),
          randRange(0.55, 0.98),
          randRange(0.22, 0.42),
          tone, tone * 0.97, tone * 0.94,
          3.0, 0.0, 0.35, randRange(-0.4, 0.4)
        );
      }
      const initRocks = lowSpec ? 5 : 9;
      for (let i = 0; i < initRocks; i++) {
        const ang = nextRand() * Math.PI * 2.0;
        const rad = randRange(0.85, 3.4);
        const sc = randRange(0.42, 1.05);
        spawnStoneDebris(
          hx + Math.cos(ang) * rad,
          hy + randRange(-5.0, 4.2),
          hz + Math.sin(ang) * rad,
          randRange(-0.9, 0.9),
          randRange(4.0, 10.5),
          randRange(-0.9, 0.9),
          sc, sc * 0.78, sc * 0.95,
          randRange(0.75, 1.45), 1.5, -100.0
        );
      }
      const initEmbers = lowSpec ? 4 : 8;
      for (let i = 0; i < initEmbers; i++) {
        const ang = nextRand() * Math.PI * 2.0;
        const rad = randRange(0.55, 3.2);
        spawnSpark(
          hx + Math.cos(ang) * rad,
          hy + randRange(-4.5, 4.0),
          hz + Math.sin(ang) * rad,
          randRange(-0.7, 0.7),
          randRange(8.5, 16.5),
          randRange(-0.7, 0.7),
          randRange(0.45, 0.92),
          randRange(0.036, 0.068),
          randRange(1.6, 2.8),
          3.0,
          1.0, 0.64, 0.20,
          0.85, 0.16, 0.02,
          0.0, 0.18, -100.0, 0.0
        );
      }
    }
    fallingDebrisActive = want;
    return fallingDebrisActive;
  }

  // ==========================================================================
  // 3-Point Cinema Light Rig Controls & Per-Frame State Sync
  // ==========================================================================

  function setActive(active) {
    if (disposed) return false;
    rigActive = Boolean(active);
    cutsceneLightRig.visible = rigActive;
    cutsceneLightRig.userData.active = rigActive;
    if (!rigActive) {
      throneRimLight.intensity = 0;
      impactFlashLight.intensity = 0;
      lunarRimLight.intensity = 0;
      flashTimer = 0;
      bubblesActive = false;
      fallingDebrisActive = false;
    }
    return rigActive;
  }

  function updateCinemaLights(dt, elapsed, state) {
    if (!rigActive) {
      throneRimLight.intensity = 0;
      impactFlashLight.intensity = 0;
      lunarRimLight.intensity = 0;
      return;
    }

    const stage = state?.stageMode || 'castle';
    const hasCam = state && readPos3(state.camPos, _tmpCamPos);
    const hasLook = state && readPos3(state.camLook, _tmpLookPos);

    // 1) Throne Hall Warm Amber-Crimson Rim/Back Light (Acts 1-3)
    if (stage === 'castle') {
      const bossVis = state?.bossVisible !== false;
      const bx = finiteOr(state?.bossX, 0);
      const by = finiteOr(state?.bossY, 0);
      const bz = finiteOr(state?.bossZ, -47.2);
      const hx = finiteOr(state?.heroX, 0);
      const hz = finiteOr(state?.heroZ, -44.2);

      const subjX = bossVis ? bx : hx;
      const subjY = bossVis ? by : finiteOr(state?.heroY, 0);
      const subjZ = bossVis ? bz : hz;

      // View-aware back/rim offset so the warm contour always hugs boss helmet/cloak & hero!
      let dirX = 0;
      let dirZ = -1;
      if (hasCam) {
        const dx = subjX - _tmpCamPos.x;
        const dz = subjZ - _tmpCamPos.z;
        const dLen = Math.hypot(dx, dz);
        if (dLen > 0.05) {
          dirX = dx / dLen;
          dirZ = dz / dLen;
        }
      }
      const sideX = -dirZ;
      const sideZ = dirX;

      const isAbyssUpShot = hasCam && _tmpCamPos.y < -2.0;
      if (isAbyssUpShot) {
        // Iconic Act 3 Shot 10 looking UP out of the abyss: hot crimson rim right at chasm lip behind boss!
        const holeX = finiteOr(state?.floorHoleX, subjX);
        const holeZ = finiteOr(state?.floorHoleZ, subjZ);
        throneRimLight.position.set(holeX + 0.35, 1.45, holeZ - 1.25);
        throneRimLight.color.setHex(0xff4c18);
        const flicker = 0.92 + 0.08 * Math.sin(elapsed * 9.3) + 0.04 * Math.cos(elapsed * 17.1);
        throneRimLight.intensity = 7.4 * flicker;
        throneRimLight.distance = 28.0;
      } else {
        const enraged = Boolean(state?.bossEnragedFire);
        const rimX = subjX + dirX * 3.15 + sideX * 1.45;
        const rimY = subjY + (enraged ? 3.85 : 3.35);
        const rimZ = subjZ + dirZ * 3.15 + sideZ * 1.45;
        throneRimLight.position.set(rimX, rimY, rimZ);

        // Shift amber-gold -> glowing molten crimson when Judge of Ruins ignites his warhammer!
        _colA.setHex(0xff742c);
        _colB.setHex(0xff3810);
        throneRimLight.color.copy(enraged ? _colB : _colA);

        const flicker = 0.93 + 0.07 * Math.sin(elapsed * 7.8) + 0.04 * Math.sin(elapsed * 15.4 + 1.2);
        const targetInt = (enraged ? 7.2 : 5.4) * flicker;
        throneRimLight.intensity = targetInt;
        throneRimLight.distance = 26.0;
      }
    } else {
      throneRimLight.intensity = Math.max(0, throneRimLight.intensity - dt * 24.0);
    }

    // 2) Cold Lunar Rim Light (Act 4 Shaft/River & Act 5 Exterior Shore)
    if (stage === 'shaft_river' || stage === 'exterior_shore') {
      const hx = finiteOr(state?.heroX, 0);
      const hy = finiteOr(state?.heroY, 0);
      const hz = finiteOr(state?.heroZ, 2.5);
      const uw = clamp01(finiteOr(state?.underwater01, 0));

      let dirX = 0;
      let dirZ = -1;
      if (hasCam) {
        const dx = hx - _tmpCamPos.x;
        const dz = hz - _tmpCamPos.z;
        const dLen = Math.hypot(dx, dz);
        if (dLen > 0.05) {
          dirX = dx / dLen;
          dirZ = dz / dLen;
        }
      }
      const sideX = -dirZ;
      const sideZ = dirX;

      if (stage === 'shaft_river') {
        const nearGrate = clamp01((hz - 14.0) / 14.0);
        lunarRimLight.position.set(
          hx + dirX * 2.2 + sideX * 1.25,
          hy + (uw > 0.15 ? 1.55 : 2.35),
          hz + dirZ * 2.2 + sideZ * 1.25 + nearGrate * 1.4
        );
        // Shift cold silver moonlight -> eerie turquoise underwater rim when submerged
        _colA.setHex(0x8ecaff);
        _colB.setHex(0x46c8dc);
        lunarRimLight.color.copy(_colA).lerp(_colB, uw);
        const pulse = 0.95 + 0.05 * Math.sin(elapsed * 4.4);
        lunarRimLight.intensity = lerp(4.8, 6.6, nearGrate) * pulse;
        lunarRimLight.distance = 24.0;
      } else {
        // Exterior Shore: crisp cold silver-blue moonlight outlining wet armor against the dark cliff & river!
        lunarRimLight.position.set(
          hx + dirX * 2.65 + sideX * 1.55,
          hy + 2.55,
          hz + dirZ * 2.65 + sideZ * 1.55
        );
        lunarRimLight.color.setHex(0x98ceff);
        lunarRimLight.intensity = 5.0;
        lunarRimLight.distance = 24.0;
      }
    } else {
      lunarRimLight.intensity = Math.max(0, lunarRimLight.intensity - dt * 24.0);
    }

    // 3) Dynamic Impact Flash Light (explicit bursts + state.impactFlash01 seek fallback)
    let flashInt = 0.0;
    if (flashTimer > 0.0) {
      flashTimer = Math.max(0.0, flashTimer - dt);
      const u = flashDuration > 0 ? clamp01(flashTimer / flashDuration) : 0;
      // Hold full peak for the opening ~25ms (1-2 frames) then crisp quadratic decay to 0
      const effU = u > 0.88 ? 1.0 : (u / 0.88);
      flashInt = flashPeak * (effU * effU);
      impactFlashLight.position.set(flashPos.x, flashPos.y, flashPos.z);
    }

    const stateFlash = clamp01(finiteOr(state?.impactFlash01, 0));
    if (stateFlash > 0.01) {
      const seekFlashInt = stateFlash * 9.0;
      if (seekFlashInt > flashInt) {
        flashInt = seekFlashInt;
        if (stage === 'castle' && Number(state?.act) === 3) {
          impactFlashLight.color.setHex(0xff5c18);
          impactFlashLight.position.set(
            finiteOr(state?.floorHoleX, 0),
            0.95,
            finiteOr(state?.floorHoleZ, -45.0)
          );
        } else if (stage === 'shaft_river') {
          impactFlashLight.color.setHex(state?.grateBroken ? 0xff9e3c : 0x9be8ff);
          impactFlashLight.position.set(
            finiteOr(state?.heroX, 0),
            finiteOr(state?.heroY, 0.7) + 0.5,
            finiteOr(state?.heroZ, 12.0) + 0.6
          );
        } else {
          impactFlashLight.color.setHex(0xfff0c4);
          const hx = finiteOr(state?.heroX, 0);
          const hz = finiteOr(state?.heroZ, -44.0);
          const bx = finiteOr(state?.bossX, hx);
          const bz = finiteOr(state?.bossZ, hz - 2.0);
          impactFlashLight.position.set((hx + bx) * 0.5, 1.38, (hz + bz) * 0.5);
        }
      }
    }

    impactFlashLight.intensity = flashInt;

    // Avoid unused warning while keeping lookup ready for future look-tracking
    if (!hasLook && hasCam) {
      _tmpLookPos.copy(_tmpCamPos);
    }
  }

  // ==========================================================================
  // Main Per-Frame Zero-GC Update Loop
  // ==========================================================================

  function update(dt, elapsed = null, state = null) {
    if (disposed) return;

    const safeDt = clamp(finiteOr(dt, 0.016), 0.0, 0.1);
    const slowMo = state && Number.isFinite(Number(state.slowMoFactor))
      ? clamp(Number(state.slowMoFactor), 0.15, 1.25)
      : 1.0;
    // Particles gracefully obey slow-mo time dilation while lights/timers remain crisp
    const simDt = safeDt * lerp(slowMo, 1.0, 0.25);

    if (elapsed !== null && elapsed !== undefined && Number.isFinite(Number(elapsed))) {
      internalElapsed = Number(elapsed);
    } else {
      internalElapsed += safeDt;
    }

    sparkUniforms.uTime.value = internalElapsed;

    // 1. Update 3-Point Cinema Light Rig
    updateCinemaLights(safeDt, internalElapsed, state);

    // 2. Continuous Shaft Falling Debris Stream (spawns whistling rocks, dust wisps & falling embers)
    if (fallingDebrisActive) {
      if (state && Number.isFinite(Number(state.heroX)) && Number.isFinite(Number(state.heroY)) && Number.isFinite(Number(state.heroZ))) {
        debrisAnchor.x = Number(state.heroX);
        debrisAnchor.y = Number(state.heroY);
        debrisAnchor.z = Number(state.heroZ);
        debrisAnchorSet = true;
      }
      if (debrisAnchorSet) {
        debrisEmitAccum += safeDt;
        const interval = lowSpec ? 0.075 : 0.042;
        while (debrisEmitAccum >= interval) {
          debrisEmitAccum -= interval;
          const hx = debrisAnchor.x;
          const hy = debrisAnchor.y;
          const hz = debrisAnchor.z;

          // Whistling upward-streaking dust wisps around the plunging hero
          const ang = nextRand() * Math.PI * 2.0;
          const rad = randRange(0.70, 3.85);
          const tone = randRange(0.36, 0.56);
          spawnCloud(
            hx + Math.cos(ang) * rad,
            hy - randRange(2.5, 6.2),
            hz + Math.sin(ang) * rad,
            randRange(-0.55, 0.55),
            randRange(8.5, 16.5),
            randRange(-0.55, 0.55),
            randRange(0.45, 0.85),
            randRange(0.24, 0.46),
            randRange(0.54, 0.96),
            randRange(0.22, 0.40),
            tone, tone * 0.96, tone * 0.92,
            3.0, 0.0, 0.25, randRange(-0.35, 0.35)
          );

          // Falling crimson embers torn down from the breached Throne Hall above
          if (nextRand() < 0.72) {
            const eAng = nextRand() * Math.PI * 2.0;
            const eRad = randRange(0.55, 3.2);
            spawnSpark(
              hx + Math.cos(eAng) * eRad,
              hy - randRange(2.2, 5.5),
              hz + Math.sin(eAng) * eRad,
              randRange(-0.8, 0.8),
              randRange(9.5, 17.5),
              randRange(-0.8, 0.8),
              randRange(0.42, 0.88),
              randRange(0.036, 0.068),
              randRange(1.6, 2.8),
              3.0,
              1.0, 0.64, 0.20,
              0.85, 0.16, 0.02,
              0.0, 0.18, -100.0, 0.0
            );
          }

          // Tumbling shaft rock shards rushing upward past camera
          if (nextRand() < (lowSpec ? 0.28 : 0.48)) {
            const rAng = nextRand() * Math.PI * 2.0;
            const rRad = randRange(0.95, 3.6);
            const sc = randRange(0.38, 1.02);
            spawnStoneDebris(
              hx + Math.cos(rAng) * rRad,
              hy - randRange(3.2, 6.5),
              hz + Math.sin(rAng) * rRad,
              randRange(-0.9, 0.9),
              randRange(6.5, 13.8),
              randRange(-0.9, 0.9),
              sc, sc * 0.76, sc * 0.94,
              randRange(0.75, 1.35),
              1.2, -100.0
            );
          }
        }
      }
    }

    // 3. Update Pool A — Sparks & Molten Embers
    if (sparkCount > 0) {
      let i = 0;
      while (i < sparkCount) {
        const age = spAge[i] + simDt;
        const life = spLife[i];
        if (age >= life) {
          swapRemoveSpark(i);
          continue;
        }
        spAge[i] = age;
        const u = age / life;
        const rem = 1.0 - u;

        const i3 = i * 3;
        const i4 = i * 4;
        const dragMul = Math.max(0.0, 1.0 - spDrag[i] * simDt);
        let vx = spVelArr[i3] * dragMul;
        let vy = (spVelArr[i3 + 1] + spGrav[i] * simDt) * dragMul;
        let vz = spVelArr[i3 + 2] * dragMul;

        // Gentle buoyant curl turbulence for molten embers (kind === 1)
        const kind = spParamArr[i4 + 2];
        if (kind > 0.5 && kind < 1.5) {
          const seed = spParamArr[i4 + 3];
          vx += Math.sin(internalElapsed * 5.2 + seed * 19.0) * 1.45 * simDt;
          vz += Math.cos(internalElapsed * 4.6 + seed * 23.0) * 1.45 * simDt;
        }

        let px = spPosArr[i3] + vx * simDt;
        let py = spPosArr[i3 + 1] + vy * simDt;
        let pz = spPosArr[i3 + 2] + vz * simDt;

        const flY = spFloorY[i];
        if (py < flY && vy < 0 && spBounce[i] > 0) {
          py = flY;
          vy = -vy * spBounce[i];
          vx *= 0.74;
          vz *= 0.74;
        }

        spPosArr[i3] = px;
        spPosArr[i3 + 1] = py;
        spPosArr[i3 + 2] = pz;
        spVelArr[i3] = vx;
        spVelArr[i3 + 1] = vy;
        spVelArr[i3 + 2] = vz;

        spColLifeArr[i4] = lerp(spBaseR[i], spEndR[i], u);
        spColLifeArr[i4 + 1] = lerp(spBaseG[i], spEndG[i], u);
        spColLifeArr[i4 + 2] = lerp(spBaseB[i], spEndB[i], u);
        spColLifeArr[i4 + 3] = rem;
        i++;
      }

      if (sparkCount > 0) {
        spPosAttr.needsUpdate = true;
        spVelAttr.needsUpdate = true;
        spColLifeAttr.needsUpdate = true;
        spParamAttr.needsUpdate = true;
        sparkGeo.instanceCount = sparkCount;
        sparkMesh.visible = true;
      } else {
        sparkGeo.instanceCount = 0;
        sparkMesh.visible = false;
      }
    } else if (sparkMesh.visible) {
      sparkGeo.instanceCount = 0;
      sparkMesh.visible = false;
    }

    // 4. Update Pool B — Dust, Debris Smoke & Water Splash Foam
    if (cloudCount > 0) {
      let i = 0;
      while (i < cloudCount) {
        const age = clAge[i] + simDt;
        const life = clLife[i];
        if (age >= life) {
          swapRemoveCloud(i);
          continue;
        }
        clAge[i] = age;
        const u = age / life;

        const dragMul = Math.max(0.0, 1.0 - clDrag[i] * simDt);
        const vx = clVx[i] * dragMul;
        const vy = (clVy[i] + clGrav[i] * simDt) * dragMul;
        const vz = clVz[i] * dragMul;
        clVx[i] = vx;
        clVy[i] = vy;
        clVz[i] = vz;

        const i3 = i * 3;
        const i4 = i * 4;
        clPosArr[i3] += vx * simDt;
        clPosArr[i3 + 1] += vy * simDt;
        clPosArr[i3 + 2] += vz * simDt;

        // Fast pop-in, smooth soft dissipate-out
        const fadeIn = u < 0.14 ? (u / 0.14) : 1.0;
        const fadeOut = 1.0 - u * u;
        clColAlphaArr[i4 + 3] = clPeakAlpha[i] * fadeIn * fadeOut;

        // Smooth ease-out expansion + gentle spin
        const grow = 1.0 - (1.0 - u) * (1.0 - u);
        clParamArr[i4] = lerp(clSize0[i], clSize1[i], grow);
        clParamArr[i4 + 1] += clSpin[i] * simDt;
        i++;
      }

      if (cloudCount > 0) {
        clPosAttr.needsUpdate = true;
        clColAlphaAttr.needsUpdate = true;
        clParamAttr.needsUpdate = true;
        cloudGeo.instanceCount = cloudCount;
        cloudMesh.visible = true;
      } else {
        cloudGeo.instanceCount = 0;
        cloudMesh.visible = false;
      }
    } else if (cloudMesh.visible) {
      cloudGeo.instanceCount = 0;
      cloudMesh.visible = false;
    }

    // 5. Update Pool C1 — 3D Jagged Stone Debris
    if (stoneCount > 0) {
      let i = 0;
      while (i < stoneCount) {
        const age = stAge[i] + simDt;
        const life = stLife[i];
        if (age >= life) {
          swapRemoveStone(i);
          continue;
        }
        stAge[i] = age;
        stVy[i] += stGrav[i] * simDt;
        stX[i] += stVx[i] * simDt;
        stY[i] += stVy[i] * simDt;
        stZ[i] += stVz[i] * simDt;

        if (stY[i] < stFloorY[i] && stVy[i] < 0) {
          stY[i] = stFloorY[i];
          stVy[i] = -stVy[i] * 0.34;
          stVx[i] *= 0.68;
          stVz[i] *= 0.68;
          stWrx[i] *= 0.65;
          stWry[i] *= 0.65;
          stWrz[i] *= 0.65;
        }

        stRx[i] += stWrx[i] * simDt;
        stRy[i] += stWry[i] * simDt;
        stRz[i] += stWrz[i] * simDt;

        const u = age / life;
        const shrink = u > 0.72 ? clamp01(1.0 - (u - 0.72) / 0.28) : 1.0;

        _tmpPos.set(stX[i], stY[i], stZ[i]);
        _tmpEuler.set(stRx[i], stRy[i], stRz[i]);
        _tmpQuat.setFromEuler(_tmpEuler);
        _tmpScale.set(stSx[i] * shrink, stSy[i] * shrink, stSz[i] * shrink);
        _tmpMat4.compose(_tmpPos, _tmpQuat, _tmpScale);
        stoneMesh.setMatrixAt(i, _tmpMat4);
        i++;
      }

      if (stoneCount > 0) {
        stoneMesh.count = stoneCount;
        stoneMesh.instanceMatrix.needsUpdate = true;
        stoneMesh.visible = true;
      } else {
        stoneMesh.count = 0;
        stoneMesh.visible = false;
      }
    } else if (stoneMesh.visible) {
      stoneMesh.count = 0;
      stoneMesh.visible = false;
    }

    // 6. Update Pool C2 — 3D Twisted Iron Grate Debris Shards
    if (metalCount > 0) {
      let i = 0;
      while (i < metalCount) {
        const age = mtAge[i] + simDt;
        const life = mtLife[i];
        if (age >= life) {
          swapRemoveMetal(i);
          continue;
        }
        mtAge[i] = age;
        mtVy[i] += mtGrav[i] * simDt;
        mtX[i] += mtVx[i] * simDt;
        mtY[i] += mtVy[i] * simDt;
        mtZ[i] += mtVz[i] * simDt;

        mtRx[i] += mtWrx[i] * simDt;
        mtRy[i] += mtWry[i] * simDt;
        mtRz[i] += mtWrz[i] * simDt;

        const u = age / life;
        const shrink = u > 0.74 ? clamp01(1.0 - (u - 0.74) / 0.26) : 1.0;

        _tmpPos.set(mtX[i], mtY[i], mtZ[i]);
        _tmpEuler.set(mtRx[i], mtRy[i], mtRz[i]);
        _tmpQuat.setFromEuler(_tmpEuler);
        _tmpScale.set(mtSx[i] * shrink, mtSy[i] * shrink, mtSz[i] * shrink);
        _tmpMat4.compose(_tmpPos, _tmpQuat, _tmpScale);
        metalMesh.setMatrixAt(i, _tmpMat4);
        i++;
      }

      if (metalCount > 0) {
        metalMesh.count = metalCount;
        metalMesh.instanceMatrix.needsUpdate = true;
        metalMesh.visible = true;
      } else {
        metalMesh.count = 0;
        metalMesh.visible = false;
      }
    } else if (metalMesh.visible) {
      metalMesh.count = 0;
      metalMesh.visible = false;
    }

    // 7. Update Pool D — Expanding Luminous Shockwave Rings
    const hasCamForBillboard = state && readPos3(state.camPos, _tmpCamPos);
    for (let i = 0; i < MAX_RINGS; i++) {
      const slot = ringSlots[i];
      if (!slot.active) continue;
      slot.age += simDt;
      if (slot.age >= slot.life) {
        slot.active = false;
        slot.mesh.visible = false;
        slot.uniforms.uOpacity.value = 0.0;
        continue;
      }
      const u = clamp01(slot.age / slot.life);
      const easeOut = 1.0 - (1.0 - u) * (1.0 - u) * (1.0 - u);
      const rad = lerp(slot.r0, slot.r1, easeOut);
      slot.mesh.scale.set(rad, rad, rad);
      if (slot.billboard && hasCamForBillboard) {
        slot.mesh.lookAt(_tmpCamPos);
      }
      slot.uniforms.uProgress.value = u;
      slot.uniforms.uOpacity.value = slot.peakOpacity * (1.0 - u) * (1.0 - u * 0.35);
    }

    // 8. Update Pool E — Translucent 3D Underwater Bubbles (55 active streaming past camera!)
    const targetBubFade = bubblesActive ? 1.0 : 0.0;
    if (bubblesActive && state && state.camPos && !bubbleAnchorSet) {
      if (readPos3(state.camPos, bubbleAnchor)) bubbleAnchorSet = true;
    } else if (bubblesActive && state && state.camPos) {
      // Continuously track live camera position when state is passed
      readPos3(state.camPos, bubbleAnchor);
      bubbleAnchorSet = true;
    }

    if (targetBubFade > bubbleFade01) {
      bubbleFade01 = Math.min(1.0, bubbleFade01 + safeDt * 6.5);
    } else if (targetBubFade < bubbleFade01) {
      bubbleFade01 = Math.max(0.0, bubbleFade01 - safeDt * 4.2);
    }

    if (bubbleFade01 > 0.004) {
      bubbleUniforms.uMasterAlpha.value = bubbleFade01;
      const ax = bubbleAnchor.x;
      const ay = bubbleAnchor.y;
      const az = bubbleAnchor.z;
      _tmpQuat.identity();

      for (let i = 0; i < BUBBLE_COUNT; i++) {
        bubOy[i] += bubRise[i] * simDt;
        bubOz[i] -= bubRush[i] * simDt;

        // Recycle seamlessly in the camera rush tunnel
        if (bubOz[i] < -2.2 || bubOy[i] > 2.2) {
          seedBubble(i, false);
        }

        const wobX = Math.sin(internalElapsed * 5.6 + bubPhase[i]) * bubWobble[i];
        const wobY = Math.cos(internalElapsed * 4.3 + bubPhase[i] * 1.3) * (bubWobble[i] * 0.45);
        const s = bubScale[i];

        _tmpPos.set(ax + bubOx[i] + wobX, ay + bubOy[i] + wobY, az + bubOz[i]);
        // Slight vertical buoyancy squash/stretch on rising bubbles
        _tmpScale.set(s * 0.94, s * 1.08, s * 0.94);
        _tmpMat4.compose(_tmpPos, _tmpQuat, _tmpScale);
        bubbleMesh.setMatrixAt(i, _tmpMat4);
      }

      bubbleMesh.count = lowSpec ? 34 : BUBBLE_COUNT;
      bubbleMesh.instanceMatrix.needsUpdate = true;
      bubbleMesh.visible = true;
    } else if (bubbleMesh.visible) {
      bubbleUniforms.uMasterAlpha.value = 0.0;
      bubbleMesh.visible = false;
    }
  }

  // ==========================================================================
  // Lifecycle Controls: setLowSpec, reset, getStats, dispose
  // ==========================================================================

  function setLowSpec(enabled) {
    lowSpec = Boolean(enabled);
    const px = lowSpec ? 0.92 : 1.0;
    sparkUniforms.uPixelScale.value = px;
    cloudUniforms.uPixelScale.value = px;
  }

  function reset() {
    if (disposed) return;
    sparkCount = 0;
    sparkGeo.instanceCount = 0;
    sparkMesh.visible = false;

    cloudCount = 0;
    cloudGeo.instanceCount = 0;
    cloudMesh.visible = false;

    stoneCount = 0;
    stoneMesh.count = 0;
    stoneMesh.visible = false;

    metalCount = 0;
    metalMesh.count = 0;
    metalMesh.visible = false;

    for (let i = 0; i < MAX_RINGS; i++) {
      ringSlots[i].active = false;
      ringSlots[i].age = 0.0;
      ringSlots[i].mesh.visible = false;
      ringSlots[i].uniforms.uOpacity.value = 0.0;
    }

    bubblesActive = false;
    bubbleFade01 = 0.0;
    bubbleUniforms.uMasterAlpha.value = 0.0;
    bubbleMesh.visible = false;
    bubbleAnchorSet = false;

    fallingDebrisActive = false;
    debrisAnchorSet = false;
    debrisEmitAccum = 0.0;

    flashTimer = 0.0;
    impactFlashLight.intensity = 0.0;
    if (!rigActive) {
      throneRimLight.intensity = 0.0;
      lunarRimLight.intensity = 0.0;
    }
  }

  function getStats() {
    let activeRings = 0;
    for (let i = 0; i < MAX_RINGS; i++) {
      if (ringSlots[i].active) activeRings++;
    }
    const drawCalls =
      (sparkMesh.visible ? 1 : 0) +
      (cloudMesh.visible ? 1 : 0) +
      (stoneMesh.visible ? 1 : 0) +
      (metalMesh.visible ? 1 : 0) +
      (bubbleMesh.visible ? 1 : 0) +
      activeRings;

    return {
      activeSparks: sparkCount,
      activeClouds: cloudCount,
      activeStoneDebris: stoneCount,
      activeMetalDebris: metalCount,
      activeBubbles: bubbleMesh.visible ? bubbleMesh.count : 0,
      activeRings,
      drawCalls,
      lightsActive: rigActive,
      throneRimIntensity: throneRimLight.intensity,
      impactLightIntensity: impactFlashLight.intensity,
      lunarRimIntensity: lunarRimLight.intensity,
      disposed
    };
  }

  function dispose() {
    if (disposed) return;
    reset();
    setActive(false);
    disposed = true;

    if (rootGroup.parent) {
      rootGroup.parent.remove(rootGroup);
    }

    sparkGeo.dispose();
    sparkMat.dispose();
    cloudGeo.dispose();
    cloudMat.dispose();
    stoneGeo.dispose();
    stoneMat.dispose();
    metalGeo.dispose();
    metalMat.dispose();
    ringGeo.dispose();
    for (let i = 0; i < MAX_RINGS; i++) {
      ringSlots[i].mat.dispose();
    }
    bubbleGeo.dispose();
    bubbleMat.dispose();
  }

  return {
    version: SOULS_ESCAPE_VFX_VERSION,
    rootGroup,
    cutsceneLightRig,
    vfxGroup,

    // Named cinema lights for direct inspection if needed
    throneRimLight,
    impactFlashLight,
    lunarRimLight,

    // Light rig & quality toggles
    setActive,
    isActive: () => rigActive,
    setLowSpec,
    setLowSpecMode: setLowSpec,

    // Pooled cinematic burst emitters
    emitParrySparks,
    emitDustImpact,
    emitFloorCollapseBurst,
    emitWaterSplash,
    emitGrateBreakBurst,
    triggerImpactFlash,

    // Continuous scene-driven particle streams
    setUnderwaterBubbles,
    setFallingDebrisStream,

    // Frame update & lifecycle
    update,
    reset,
    getStats,
    dispose
  };
}
