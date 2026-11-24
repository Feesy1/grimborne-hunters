// Grimborne Hunters — Stylized-Realistic Gorge Terrain & Moss-Coated Stone Shader Suite (z103)
// Pure Vanilla ES Module (Three.js r160, zero external dependencies, zero per-frame GC allocations).
//
// Visual direction:
//   - Brooding dark wet charcoal-slate nocturnal stonework sculpted by silver moonlight & warm amber campfires
//   - Dual-scale rotated anti-tiling world-space cobble, moss, and basalt rock sampling (zero Voronoi grid tiling)
//   - Slope- & elevation-aware natural transition from cobbled road -> mossy shoulder -> wet basalt river silt
//   - Organic pre-tonemapping HDR rain puddles (flat pockets only, strictly above waterline, zero white clipping)
//   - Unified world-space upward-facing velvety forest moss, grounded contact AO, waterline wetness & moonlit rim
//     for all sculpted Blender GLB meshes and procedural masonry (full InstancedMesh USE_INSTANCING support).
//
// Exports:
//   - createStylizedGorgeTerrainMaterial(THREE, opts)
//   - createMossCoatedStoneMaterial(THREE, pbrTex, opts = {})

const WATERLINE_Y_DEFAULT = -0.10;

// Shared deterministic GLSL 2D/3D non-sinusoidal value noise helpers (zero mobile precision banding)
const GLSL_NOISE_HELPERS = `
float sgHash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float sgVnoise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = sgHash21(i);
  float b = sgHash21(i + vec2(1.0, 0.0));
  float c = sgHash21(i + vec2(0.0, 1.0));
  float d = sgHash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float sgFbm2(vec2 p) {
  float v = sgVnoise2(p) * 0.64;
  v += sgVnoise2(p * 2.13 + vec2(7.1, -3.4)) * 0.36;
  return v;
}

float sgHash31(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

float sgVnoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = sgHash31(i);
  float n100 = sgHash31(i + vec3(1.0, 0.0, 0.0));
  float n010 = sgHash31(i + vec3(0.0, 1.0, 0.0));
  float n110 = sgHash31(i + vec3(1.0, 1.0, 0.0));
  float n001 = sgHash31(i + vec3(0.0, 0.0, 1.0));
  float n101 = sgHash31(i + vec3(1.0, 0.0, 1.0));
  float n011 = sgHash31(i + vec3(0.0, 1.0, 1.0));
  float n111 = sgHash31(i + vec3(1.0, 1.0, 1.0));
  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);
  float nxy0 = mix(nx00, nx10, f.y);
  float nxy1 = mix(nx01, nx11, f.y);
  return mix(nxy0, nxy1, f.z);
}
`;

function isUniformObject(v) {
  return Boolean(v && typeof v === 'object' && Object.prototype.hasOwnProperty.call(v, 'value'));
}

function resolveUniform(primary, secondary, fallbackValue) {
  if (isUniformObject(primary)) return primary;
  if (isUniformObject(secondary)) return secondary;
  if (Number.isFinite(primary)) return { value: primary };
  if (Number.isFinite(secondary)) return { value: secondary };
  return { value: fallbackValue };
}

function resolveNormalScaleVec2(THREE, val, fallback) {
  if (val && typeof val === 'object' && Number.isFinite(val.x) && Number.isFinite(val.y)) {
    return new THREE.Vector2(val.x, val.y);
  }
  const s = Number.isFinite(val) ? val : fallback;
  return new THREE.Vector2(s, s);
}

// ============================================================================
// 1. Stylized-Realistic Gorge Terrain Material (Dual-Scale Anti-Tiling + Riverbank + HDR Puddles)
// ============================================================================
// Supports BOTH:
//   createStylizedGorgeTerrainMaterial(THREE, { cobbleMap, cobbleNormal, cobbleRough, mossMap, mossNormal, rockMap, rockNormal, uTime, uBonfireLit, lowSpecMode, trackMat, ... })
//   createStylizedGorgeTerrainMaterial(THREE, gorgePbrTex, { uTimeUniform, uBonfireLit, lowSpecMode, trackMat, ... })
export function createStylizedGorgeTerrainMaterial(THREE, optsOrPbrTex = {}, maybeOpts = null) {
  const looksLikePbrBundle = Boolean(
    optsOrPbrTex &&
    typeof optsOrPbrTex === 'object' &&
    (optsOrPbrTex.cobble || optsOrPbrTex.mossEarth || optsOrPbrTex.cliffRock) &&
    !optsOrPbrTex.cobbleMap &&
    !optsOrPbrTex.mossMap &&
    !optsOrPbrTex.rockMap
  );

  const pbrTex = looksLikePbrBundle ? optsOrPbrTex : (optsOrPbrTex?.pbrTex || null);
  const opts = looksLikePbrBundle ? (maybeOpts || {}) : (optsOrPbrTex || {});

  const lowSpecMode = Boolean(opts.lowSpecMode);
  const trackMat = typeof opts.trackMat === 'function' ? opts.trackMat : (m) => m;
  const regNormalMat = typeof opts.regNormalMat === 'function' ? opts.regNormalMat : null;

  const cobbleMap = opts.cobbleMap ?? opts.map ?? pbrTex?.cobble?.albedo ?? null;
  const cobbleNormal = opts.cobbleNormal ?? opts.normalMap ?? pbrTex?.cobble?.normal ?? null;
  const cobbleRough = opts.cobbleRough ?? opts.cobbleOrm ?? opts.roughnessMap ?? pbrTex?.cobble?.orm ?? null;
  const mossMap = opts.mossMap ?? opts.mossAlbedo ?? pbrTex?.mossEarth?.albedo ?? null;
  const mossNormal = opts.mossNormal ?? pbrTex?.mossEarth?.normal ?? null;
  const rockMap = opts.rockMap ?? opts.cliffMap ?? opts.cliffAlbedo ?? pbrTex?.cliffRock?.albedo ?? null;
  const rockNormal = opts.rockNormal ?? opts.cliffNormal ?? pbrTex?.cliffRock?.normal ?? null;

  const uTimeRef = resolveUniform(opts.uTime, opts.uTimeUniform, 0.0);
  const uBonfireLitRef = resolveUniform(opts.uBonfireLit, opts.uBonfireLitGorge, 0.0);
  const uPuddleCoverageRef = resolveUniform(opts.uPuddleCoverage, null, 1.0);
  const uWaterlineYRef = resolveUniform(opts.uWaterlineY, null, WATERLINE_Y_DEFAULT);

  const hasMossMap = Boolean(mossMap);
  const hasRockMap = Boolean(rockMap);
  const hasMossNormal = Boolean(mossNormal);
  const hasRockNormal = Boolean(rockNormal);

  const mat = new THREE.MeshStandardMaterial({
    map: cobbleMap,
    normalMap: lowSpecMode ? null : cobbleNormal,
    normalScale: resolveNormalScaleVec2(THREE, opts.normalScale, 1.08),
    roughnessMap: cobbleRough,
    aoMap: null, // Dual-scale ORM AO is sampled directly in world space to avoid repeating single-scale AO grids
    vertexColors: true,
    color: opts.color !== undefined ? opts.color : 0xffffff,
    roughness: Number.isFinite(opts.roughness) ? opts.roughness : 0.86,
    metalness: Number.isFinite(opts.metalness) ? opts.metalness : 0.04,
    envMapIntensity: Number.isFinite(opts.envMapIntensity) ? opts.envMapIntensity : 0.55
  });

  const terrainUniforms = {
    uTime: uTimeRef,
    uTimeGorge: uTimeRef,
    uBonfireLit: uBonfireLitRef,
    uBonfireLitGorge: uBonfireLitRef,
    uMossAlbedo: { value: mossMap },
    uRockAlbedo: { value: rockMap },
    uMossNormal: { value: mossNormal },
    uRockNormal: { value: rockNormal },
    uPuddleCoverage: uPuddleCoverageRef,
    uWaterlineY: uWaterlineYRef
  };

  const fullTexSignature = hasMossMap && hasRockMap && hasMossNormal && hasRockNormal;
  const cacheKey = !lowSpecMode && fullTexSignature
    ? 'gorge-stylized-terrain-v103'
    : `gorge-stylized-terrain-v103-${lowSpecMode ? 'low' : 'hq'}-${hasMossMap ? 1 : 0}${hasRockMap ? 1 : 0}${hasMossNormal ? 1 : 0}${hasRockNormal ? 1 : 0}`;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = terrainUniforms.uTime;
    shader.uniforms.uBonfireLit = terrainUniforms.uBonfireLit;
    shader.uniforms.uPuddleCoverage = terrainUniforms.uPuddleCoverage;
    shader.uniforms.uWaterlineY = terrainUniforms.uWaterlineY;
    if (hasMossMap) shader.uniforms.uMossAlbedo = terrainUniforms.uMossAlbedo;
    if (hasRockMap) shader.uniforms.uRockAlbedo = terrainUniforms.uRockAlbedo;
    if (hasMossNormal) shader.uniforms.uMossNormal = terrainUniforms.uMossNormal;
    if (hasRockNormal) shader.uniforms.uRockNormal = terrainUniforms.uRockNormal;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec4 aTerrainMix;
        varying vec3 vTerrainWorldPos;
        varying vec3 vTerrainWorldNorm;
        varying vec4 vTerrainMix;`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        {
          vec4 sgWp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            sgWp = instanceMatrix * sgWp;
          #endif
          sgWp = modelMatrix * sgWp;
          vTerrainWorldPos = sgWp.xyz;

          vec3 sgWn = objectNormal;
          #ifdef USE_INSTANCING
            sgWn = mat3(instanceMatrix) * sgWn;
          #endif
          vTerrainWorldNorm = normalize(mat3(modelMatrix) * sgWn);
          vTerrainMix = aTerrainMix;
        }`
      );

    const mossAlbedoDecl = hasMossMap ? 'uniform sampler2D uMossAlbedo;' : '';
    const rockAlbedoDecl = hasRockMap ? 'uniform sampler2D uRockAlbedo;' : '';
    const mossNormDecl = hasMossNormal ? 'uniform sampler2D uMossNormal;' : '';
    const rockNormDecl = hasRockNormal ? 'uniform sampler2D uRockNormal;' : '';

    const mossAlbedoSampleGlsl = hasMossMap
      ? `
        vec3 mS1 = texture2D(uMossAlbedo, wp * 0.29 + vec2(0.11, -0.17)).rgb;
        vec3 mS2 = texture2D(uMossAlbedo, wpRot * 0.173 + vec2(0.53, 0.29)).rgb;
        vec3 mossCol = mix(mS1, mS2, smoothstep(0.25, 0.75, sgVnoise2(wp * 0.19 - vec2(3.1, 1.7))));
        // Deep velvety Nordic forest moss + damp dark loam pockets (counteracts blue moonlight so moss stays true green, never teal!)
        mossCol = mossCol * vec3(1.22, 1.48, 0.72);
        vec3 loamCol = vec3(0.044, 0.038, 0.030);
        mossCol = mix(loamCol, mossCol, smoothstep(0.20, 0.72, tMacroNoise));
      `
      : `
        vec3 mossCol = mix(vec3(0.068, 0.125, 0.045), vec3(0.125, 0.210, 0.068), tMacroNoise);
      `;

    const rockAlbedoSampleGlsl = hasRockMap
      ? `
        // Dual-scale XZ gravel/pebbles + vertical triplanar projection so steep slopes NEVER stretch!
        vec3 rXz1 = texture2D(uRockAlbedo, wp * 0.44 + vec2(0.23, 0.14)).rgb;
        vec3 rXz2 = texture2D(uRockAlbedo, wpRot * 0.263 + vec2(0.61, -0.37)).rgb;
        vec3 rFlat = mix(rXz1, rXz2, tTileNoise);
        vec2 rVertUv = vec2((vTerrainWorldPos.z * 0.28 + vTerrainWorldPos.x * 0.18), vTerrainWorldPos.y * 0.36);
        vec3 rVert = texture2D(uRockAlbedo, rVertUv).rgb;
        vec3 rockRaw = mix(rFlat, rVert, smoothstep(0.22, 0.68, tSlope));
        float rLum = dot(rockRaw, vec3(0.299, 0.587, 0.114));
        // Neutralize pale blue cast into brooding dark wet basalt gravel & river silt
        vec3 rockSlate = mix(vec3(rLum), rockRaw, 0.38);
        vec3 bankGravelCol = rockSlate * vec3(0.50, 0.52, 0.55);
        vec3 cliffBasaltCol = rockSlate * vec3(0.76, 0.78, 0.82);
      `
      : `
        vec3 bankGravelCol = vec3(0.055, 0.060, 0.068) * (0.78 + 0.44 * tMacroNoise);
        vec3 cliffBasaltCol = vec3(0.088, 0.095, 0.108) * (0.78 + 0.44 * tMacroNoise);
      `;

    const mossNormBlendGlsl = hasMossNormal
      ? `
        vec3 nMoss = texture2D(uMossNormal, tWpXZ * 0.29 + vec2(0.11, -0.17)).xyz * 2.0 - 1.0;
        nMoss.xy *= 0.62;
        mapN = normalize(mix(mapN, nMoss, tMossW * 0.86));
      `
      : `
        mapN = normalize(mix(mapN, vec3(0.0, 0.0, 1.0), tMossW * 0.68));
      `;

    const rockNormBlendGlsl = hasRockNormal
      ? `
        vec3 nRock1 = texture2D(uRockNormal, tWpXZ * 0.44 + vec2(0.23, 0.14)).xyz * 2.0 - 1.0;
        vec3 nRockV = texture2D(uRockNormal, vec2(vTerrainWorldPos.z * 0.28 + vTerrainWorldPos.x * 0.18, vTerrainWorldPos.y * 0.36)).xyz * 2.0 - 1.0;
        vec3 nRock = normalize(mix(nRock1, nRockV, smoothstep(0.22, 0.68, tSlope)));
        float rockNormW = clamp(max(tBankW, tCliffW), 0.0, 1.0);
        mapN = normalize(mix(mapN, nRock, rockNormW * 0.88));
      `
      : `
        float rockNormW = clamp(max(tBankW, tCliffW), 0.0, 1.0);
        mapN = normalize(mix(mapN, vec3(0.0, 0.0, 1.0), rockNormW * 0.55));
      `;

    const puddleNoiseGlsl = lowSpecMode
      ? `
        float n1 = sgVnoise2(wp * 0.38 + vec2(3.7, 1.9));
        float n2 = sgVnoise2(wp * 0.96 - vec2(5.1, 2.4));
        float raw = n1 * 0.64 + n2 * 0.36;
      `
      : `
        float n1 = sgVnoise2(wp * 0.36 + vec2(3.7, 1.9));
        float n2 = sgVnoise2(wp * 0.88 - vec2(5.1, 2.4));
        float n3 = sgVnoise2(wp * 1.95 + vec2(1.4, -3.2));
        float raw = n1 * 0.52 + n2 * 0.33 + n3 * 0.15;
      `;

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uBonfireLit;
        uniform float uPuddleCoverage;
        uniform float uWaterlineY;
        ${mossAlbedoDecl}
        ${rockAlbedoDecl}
        ${mossNormDecl}
        ${rockNormDecl}
        varying vec3 vTerrainWorldPos;
        varying vec3 vTerrainWorldNorm;
        varying vec4 vTerrainMix;

        ${GLSL_NOISE_HELPERS}

        // Exact 37-degree rotation helpers for irrational dual-scale anti-tiling (WebGL1 + WebGL2 safe)
        vec2 sgRot37(vec2 p) {
          return vec2(p.x * 0.7986355 - p.y * 0.6018150, p.x * 0.6018150 + p.y * 0.7986355);
        }
        vec2 sgRot37Inv(vec2 p) {
          return vec2(p.x * 0.7986355 + p.y * 0.6018150, -p.x * 0.6018150 + p.y * 0.7986355);
        }

        vec2 sgEvalPuddle(vec2 wp, float wy, float ny, float roadW, float wetW, float seamDip) {
          // Strictly above waterline (NEVER applied underwater!) and strictly on flat pockets
          float aboveWater = smoothstep(0.06, 0.36, wy);
          float flatOk = smoothstep(0.87, 0.97, ny);
          ${puddleNoiseGlsl}
          // Subtle hollow preference along worn stone crevices so puddles feel physically settled
          float pocket = raw + seamDip * 0.08;
          float roadFocus = clamp(roadW * 0.92 + wetW * 0.22, 0.0, 1.0) * uPuddleCoverage;
          float core = smoothstep(0.56, 0.70, pocket) * roadFocus * aboveWater * flatOk;
          float halo = smoothstep(0.46, 0.64, pocket) * roadFocus * aboveWater * flatOk;
          return vec2(core, halo);
        }`
      )
      .replace(
        '#include <map_fragment>',
        `
        // Top-level shared terrain masks computed once per fragment and reused across color, roughness, normal & HDR reflection
        vec2 tWpXZ = vTerrainWorldPos.xz;
        vec2 tUvC1 = tWpXZ * 0.23;
        vec2 tUvC2 = sgRot37(tWpXZ) * 0.137 + vec2(0.37, 0.61);
        float tTileNoise = sgVnoise2(tWpXZ * 0.16 + vec2(4.3, -2.7)) * 0.68 + sgVnoise2(tWpXZ * 0.35 - vec2(1.9, 6.2)) * 0.32;
        float tMacroNoise = sgFbm2(tWpXZ * 0.065 + vec2(-2.4, 5.1));
        float tDetailNoise = sgVnoise2(tWpXZ * 0.58 + vec2(1.7, -4.3));
        vec3 tWorldN = normalize(vTerrainWorldNorm);
        float tSlope = length(tWorldN.xz);
        float tCobbleW2 = tTileNoise;
        float tCobbleSeam = 0.0;
        float tCobbleAo = 1.0;
        float tMossW = 0.0;
        float tBankW = 0.0;
        float tCliffW = 0.0;
        float tWaterlineWet = 0.0;
        float tPuddleCore = 0.0;
        float tPuddleHalo = 0.0;

        {
          vec2 wp = tWpXZ;
          vec2 wpRot = sgRot37(wp);

          // 1) Dual-Scale Rotated Anti-Tiling Cobblestones (s1 = 0.23, s2 = 0.137 rotated 37 deg)
          vec3 cobbleCol = vec3(0.11, 0.118, 0.128);
          #ifdef USE_MAP
            vec3 c1 = texture2D(map, tUvC1).rgb;
            vec3 c2 = texture2D(map, tUvC2).rgb;
            float h1 = dot(c1, vec3(0.30, 0.59, 0.11));
            float h2 = dot(c2, vec3(0.30, 0.59, 0.11));
            // Height-biased blend destroys Voronoi grid tiling while keeping stone edges crisp
            tCobbleW2 = smoothstep(0.18, 0.82, tTileNoise + (h2 - h1) * 0.38);
            cobbleCol = mix(c1, c2, tCobbleW2);
          #endif

          #ifdef USE_ROUGHNESSMAP
            vec4 orm1 = texture2D(roughnessMap, tUvC1);
            vec4 orm2 = texture2D(roughnessMap, tUvC2);
            tCobbleAo = mix(orm1.r, orm2.r, tCobbleW2);
          #endif

          // Calibrate cobble stone into brooding wet dark charcoal-slate (kill bright pale blue & lime cracks)
          float cLum = dot(cobbleCol, vec3(0.299, 0.587, 0.114));
          tCobbleSeam = 1.0 - smoothstep(0.03, 0.14, cLum);
          float limeExcess = clamp(cobbleCol.g - max(cobbleCol.r, cobbleCol.b), 0.0, 1.0);
          cobbleCol.g -= limeExcess * 0.42;
          float cLumClean = dot(cobbleCol, vec3(0.299, 0.587, 0.114));
          vec3 slateCobble = mix(vec3(cLumClean), cobbleCol, 0.40);
          cobbleCol = slateCobble * vec3(0.76, 0.78, 0.76);
          // Apply crisp dual-scale crevice AO on cobblestones
          cobbleCol *= mix(0.66, 1.04, tCobbleAo);

          // 2) Dual-Scale Damp Velvety Forest Moss + Dark Loam for Road Shoulders
          ${mossAlbedoSampleGlsl}

          // 3) Slope-Aware Wet River Silt, Pebbles & Basalt Gravel + Steep Cliff Rock
          ${rockAlbedoSampleGlsl}

          // Compute organic slope- & elevation-aware transition weights:
          //   - Road core: damp dark charcoal cobbles
          //   - Road shoulder: velvety moss + dark loam
          //   - Sloped riverbank (slope > 0.18 or y < 0.55, biased toward +X river side): dark wet silt & basalt pebbles
          //   - Steep upper cliffs (y > 1.35 & steep): stratified dark basalt
          float bankJitter = (tDetailNoise - 0.5) * 0.16;
          float riverSideBias = smoothstep(1.5, 3.4, vTerrainWorldPos.x + (tDetailNoise - 0.5) * 1.45);
          float lowRiverElev = 1.0 - smoothstep(0.14, 0.58, vTerrainWorldPos.y + bankJitter);
          float bankSlopeZone = smoothstep(0.16, 0.40, tSlope + bankJitter * 0.5) * (1.0 - smoothstep(1.25, 2.55, vTerrainWorldPos.y));
          tBankW = clamp(max(lowRiverElev, bankSlopeZone * (0.42 + 0.58 * riverSideBias)) * (0.62 + 0.38 * vTerrainMix.w), 0.0, 1.0);
          // Protect flat elevated road core while letting riverbank silt own every sloped drop toward the river
          float roadFlatProtect = vTerrainMix.x * smoothstep(0.42, 0.72, vTerrainWorldPos.y) * (1.0 - smoothstep(0.14, 0.28, tSlope));
          tBankW *= (1.0 - roadFlatProtect * 0.88);

          tCliffW = clamp(vTerrainMix.z + smoothstep(0.42, 0.70, tSlope) * smoothstep(1.15, 2.35, vTerrainWorldPos.y) * 0.90, 0.0, 1.0);

          float shoulderCreep = (1.0 - smoothstep(0.32, 0.82, vTerrainMix.x + (tDetailNoise - 0.5) * 0.24)) * smoothstep(0.35, 0.85, vTerrainWorldPos.y);
          tMossW = clamp((vTerrainMix.y * 0.90 + shoulderCreep * 0.42) * (1.0 - tBankW * 0.85) * (1.0 - tCliffW * 0.82), 0.0, 1.0);

          // Blend layers smoothly: cobbles -> mossy shoulder -> wet riverbank silt/gravel -> steep basalt cliff
          vec3 terrainCol = mix(cobbleCol, mossCol, tMossW * 0.90);

          // Organic wet dark silt & mud mottling on riverbank pebbles
          vec3 wetSiltCol = mix(vec3(0.022, 0.025, 0.029), bankGravelCol, smoothstep(0.24, 0.78, tDetailNoise));
          terrainCol = mix(terrainCol, wetSiltCol, tBankW * 0.94);
          terrainCol = mix(terrainCol, cliffBasaltCol, tCliffW * 0.92);

          // Waterline wet darkening near river margin (y < 0.42)
          tWaterlineWet = 1.0 - smoothstep(uWaterlineY - 0.04, 0.42, vTerrainWorldPos.y + (tDetailNoise - 0.5) * 0.10);
          terrainCol *= mix(1.0, 0.48, tWaterlineWet * (0.65 + 0.35 * tBankW));

          // Grounded macro world-space patina (+/- 13% weathered value & mineral shift across 150m gorge)
          float patinaVal = 0.87 + tMacroNoise * 0.26;
          vec3 patinaHue = mix(vec3(0.95, 0.97, 1.03), vec3(1.04, 1.00, 0.94), sgVnoise2(wp * 0.045 + vec2(8.2, -6.1)));
          terrainCol *= patinaVal * patinaHue;

          // Organic rain puddles on flat road pockets (never underwater!)
          vec2 pud = sgEvalPuddle(wp, vTerrainWorldPos.y, tWorldN.y, vTerrainMix.x * (1.0 - tBankW * 0.75), vTerrainMix.w, tCobbleSeam);
          tPuddleCore = pud.x;
          tPuddleHalo = pud.y;
          // Damp stone darkening halo + deep dark wet stone beneath standing water
          terrainCol *= mix(1.0, 0.62, tPuddleHalo * 0.62);
          terrainCol *= mix(1.0, 0.42, tPuddleCore * 0.85);

          diffuseColor.rgb = diffuse * terrainCol;
        }`
      )
      .replace(
        '#include <color_fragment>',
        `#if defined( USE_COLOR_ALPHA )
          {
            vec3 vc = vColor.rgb;
            float vWarm = smoothstep(0.0, 0.22, vc.r - vc.b);
            float vGreen = smoothstep(0.0, 0.12, vc.g - vc.b);
            float vLum = dot(vc, vec3(0.30, 0.59, 0.11));
            // Neutralize excessive cool baby-blue vertex tint while preserving 100% of warm baked campfire pools!
            vec3 vcNeutral = mix(vec3(vLum * 0.96, vLum * 1.00, vLum * 1.06), vc, max(vWarm, vGreen * 0.72));
            vec3 vcBalanced = clamp(vcNeutral * 1.38 + vec3(0.09), vec3(0.20), vec3(0.58));
            vec3 vcFire = vc * vec3(1.18, 1.06, 0.92);
            diffuseColor.rgb *= mix(vcBalanced, vcFire, vWarm);
            diffuseColor.a *= vColor.a;
          }
        #elif defined( USE_COLOR )
          {
            vec3 vc = vColor;
            float vWarm = smoothstep(0.0, 0.22, vc.r - vc.b);
            float vGreen = smoothstep(0.0, 0.12, vc.g - vc.b);
            float vLum = dot(vc, vec3(0.30, 0.59, 0.11));
            vec3 vcNeutral = mix(vec3(vLum * 0.96, vLum * 1.00, vLum * 1.06), vc, max(vWarm, vGreen * 0.72));
            vec3 vcBalanced = clamp(vcNeutral * 1.38 + vec3(0.09), vec3(0.20), vec3(0.58));
            vec3 vcFire = vc * vec3(1.18, 1.06, 0.92);
            diffuseColor.rgb *= mix(vcBalanced, vcFire, vWarm);
          }
        #endif`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `float roughnessFactor = roughness;
        #ifdef USE_ROUGHNESSMAP
          {
            float r1 = texture2D(roughnessMap, tUvC1).g;
            float r2 = texture2D(roughnessMap, tUvC2).g;
            roughnessFactor *= mix(r1, r2, tCobbleW2);
          }
        #endif
        // Macro patina roughness variation
        roughnessFactor = clamp(roughnessFactor + (tMacroNoise - 0.5) * 0.14, 0.14, 0.98);
        // Velvety matte moss shoulders
        roughnessFactor = mix(roughnessFactor, 0.93, tMossW * 0.82);
        // Damp basalt gravel & glossy wet sheen along waterline (y < 0.42) — controlled roughness so it NEVER looks like white ice!
        float bankAboveSub = smoothstep(uWaterlineY - 0.08, uWaterlineY + 0.05, vTerrainWorldPos.y);
        roughnessFactor = mix(roughnessFactor, 0.80, tBankW * (1.0 - tWaterlineWet) * 0.65);
        roughnessFactor = mix(roughnessFactor, 0.34, tWaterlineWet * bankAboveSub * 0.72);
        // Damp puddle fringe + dark wet standing rain puddles (0.20..0.28 avoids direct dirLight whiteout sheet!)
        roughnessFactor = mix(roughnessFactor, 0.44, tPuddleHalo * (1.0 - tPuddleCore) * 0.68);
        roughnessFactor = mix(roughnessFactor, mix(0.28, 0.20, tPuddleCore), tPuddleCore * 0.88);`
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#ifdef USE_NORMALMAP_OBJECTSPACE
          normal = texture2D(normalMap, vNormalMapUv).xyz * 2.0 - 1.0;
          #ifdef FLIP_SIDED
            normal = - normal;
          #endif
          #ifdef DOUBLE_SIDED
            normal = normal * faceDirection;
          #endif
          normal = normalize(normalMatrix * normal);
        #elif defined( USE_NORMALMAP_TANGENTSPACE )
          {
            // Dual-scale rotated cobble normal with exact counter-rotation on 37-deg layer
            vec3 nC1 = texture2D(normalMap, tUvC1).xyz * 2.0 - 1.0;
            vec3 nC2 = texture2D(normalMap, tUvC2).xyz * 2.0 - 1.0;
            nC2.xy = sgRot37Inv(nC2.xy);
            vec3 mapN = normalize(mix(nC1, nC2, tCobbleW2));
            ${mossNormBlendGlsl}
            ${rockNormBlendGlsl}
            mapN.xy *= normalScale;
            normal = normalize(tbn * mapN);
          }
        #elif defined( USE_BUMPMAP )
          normal = perturbNormalArb(- vViewPosition, normal, dHdxy_fwd(), faceDirection);
        #endif
        // Flatten puddle normals toward horizontal mirror plane with fine wind ripples
        if (tPuddleCore > 0.04) {
          vec3 flatViewN = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
          float ripA = sin(vTerrainWorldPos.x * 9.2 + uTime * 2.1) * cos(vTerrainWorldPos.z * 8.4 - uTime * 1.7) * 0.013;
          float ripB = sin(vTerrainWorldPos.z * 13.5 + vTerrainWorldPos.x * 6.0 - uTime * 2.6) * 0.008;
          normal = normalize(mix(normal, normalize(flatViewN + vec3(ripA, 0.0, ripB)), tPuddleCore * 0.92));
        }`
      )
      .replace(
        '#include <tonemapping_fragment>',
        `{
          // Pre-Tonemapping HDR Wet Puddle & Waterline Pebble Reflections (smooth ACES Filmic rolloff, ZERO clipping!)
          float waterBankSheen = tWaterlineWet * smoothstep(uWaterlineY - 0.06, uWaterlineY + 0.06, vTerrainWorldPos.y) * (1.0 - tPuddleCore) * 0.34;
          float totalWetRefl = max(tPuddleCore, waterBankSheen);
          if (totalWetRefl > 0.02) {
            vec3 Vw = normalize(cameraPosition - vTerrainWorldPos);
            vec3 moonDir = normalize(vec3(0.240, 0.315, 0.918));

            if (tPuddleCore > 0.02) {
              float ripX = sin(vTerrainWorldPos.x * 10.8 + vTerrainWorldPos.z * 4.8 + uTime * 2.3) * 0.022;
              float ripZ = cos(vTerrainWorldPos.z * 10.2 - vTerrainWorldPos.x * 4.2 - uTime * 1.9) * 0.022;
              vec3 Nw = normalize(vec3(ripX, 1.0, ripZ));
              float ndv = max(dot(Nw, Vw), 0.0);
              float fres = 0.03 + 0.97 * pow(max(1.0 - ndv, 0.0001), 3.8);

              // Silver-blue moonlit sky & crisp moonlight glint in damp cobble puddles (dark obsidian mirror, ZERO icy glare!)
              vec3 Hm = normalize(moonDir + Vw);
              float moonSpec = pow(max(dot(Nw, Hm), 0.0), 125.0) * 0.36 + pow(max(dot(Nw, Hm), 0.0), 30.0) * 0.04;
              vec3 reflCol = vec3(0.024, 0.044, 0.082) * (0.20 + fres * 0.56)
                           + vec3(0.66, 0.78, 0.96) * moonSpec;

              // Warm flickering amber campfire, brazier & lantern reflections in puddles
              float flk = 0.88 + 0.12 * sin(uTime * 8.8 + vTerrainWorldPos.x * 2.9 + vTerrainWorldPos.z * 1.4);
              float warmAccum = 0.0;

              // Shore Bonfire (dynamic via uBonfireLit)
              if (uBonfireLit > 0.01) {
                vec3 dB = vec3(-2.20, 1.45, 15.00) - vTerrainWorldPos;
                float lenB = length(dB);
                vec3 hB = normalize(dB / max(lenB, 0.001) + Vw);
                warmAccum += (pow(max(dot(Nw, hB), 0.0), 32.0) * 1.40 + pow(max(dot(Nw, hB), 0.0), 10.0) * 0.22)
                           * exp(-lenB * 0.155) * uBonfireLit * flk;
              }

              // Zone 0 Gate Braziers
              {
                vec3 dG1 = vec3(-3.55, 2.25, 29.30) - vTerrainWorldPos;
                float lenG1 = length(dG1);
                vec3 hG1 = normalize(dG1 / max(lenG1, 0.001) + Vw);
                warmAccum += pow(max(dot(Nw, hG1), 0.0), 28.0) * 0.85 * exp(-lenG1 * 0.18) * flk;

                vec3 dG2 = vec3(3.55, 2.25, 29.30) - vTerrainWorldPos;
                float lenG2 = length(dG2);
                vec3 hG2 = normalize(dG2 / max(lenG2, 0.001) + Vw);
                warmAccum += pow(max(dot(Nw, hG2), 0.0), 28.0) * 0.85 * exp(-lenG2 * 0.18) * flk;
              }

              // Zone 1 Campfire 1, Zone 2 Campfire 2, Zone 3 Watchtower Hearth
              {
                vec3 d1 = vec3(-2.95, 1.45, 45.20) - vTerrainWorldPos;
                float l1 = length(d1);
                vec3 h1 = normalize(d1 / max(l1, 0.001) + Vw);
                warmAccum += (pow(max(dot(Nw, h1), 0.0), 34.0) * 1.55 + pow(max(dot(Nw, h1), 0.0), 10.0) * 0.26) * exp(-l1 * 0.148) * flk;

                vec3 d2 = vec3(-3.55, 1.85, 71.20) - vTerrainWorldPos;
                float l2 = length(d2);
                vec3 h2 = normalize(d2 / max(l2, 0.001) + Vw);
                warmAccum += (pow(max(dot(Nw, h2), 0.0), 34.0) * 1.55 + pow(max(dot(Nw, h2), 0.0), 10.0) * 0.26) * exp(-l2 * 0.148) * flk;

                vec3 d3 = vec3(0.65, 3.85, 111.20) - vTerrainWorldPos;
                float l3 = length(d3);
                vec3 h3 = normalize(d3 / max(l3, 0.001) + Vw);
                warmAccum += (pow(max(dot(Nw, h3), 0.0), 30.0) * 1.40 + pow(max(dot(Nw, h3), 0.0), 10.0) * 0.22) * exp(-l3 * 0.15) * flk;
              }

              // Archway & Lantern Road hanging lanterns
              {
                vec3 dLA = vec3(-2.55, 4.10, 55.10) - vTerrainWorldPos;
                float lLA = length(dLA);
                warmAccum += pow(max(dot(Nw, normalize(dLA / max(lLA, 0.001) + Vw)), 0.0), 28.0) * exp(-lLA * 0.185) * 0.90;

                vec3 dL1 = vec3(-3.20, 4.10, 66.20) - vTerrainWorldPos;
                float lL1 = length(dL1);
                warmAccum += pow(max(dot(Nw, normalize(dL1 / max(lL1, 0.001) + Vw)), 0.0), 28.0) * exp(-lL1 * 0.185) * 0.90;

                vec3 dL2 = vec3(-3.25, 4.25, 75.40) - vTerrainWorldPos;
                float lL2 = length(dL2);
                warmAccum += pow(max(dot(Nw, normalize(dL2 / max(lL2, 0.001) + Vw)), 0.0), 28.0) * exp(-lL2 * 0.185) * 0.90;

                vec3 dL3 = vec3(-2.05, 4.40, 84.20) - vTerrainWorldPos;
                float lL3 = length(dL3);
                warmAccum += pow(max(dot(Nw, normalize(dL3 / max(lL3, 0.001) + Vw)), 0.0), 28.0) * exp(-lL3 * 0.185) * 0.90;
              }

              reflCol += vec3(1.52, 0.70, 0.19) * warmAccum;
              gl_FragColor.rgb += reflCol * tPuddleCore * (0.46 + 0.54 * fres);
            }

            // Subtle glossy wet pebble & silt sheen right along the river waterline (y < 0.42)
            if (waterBankSheen > 0.02) {
              vec3 Nbank = tWorldN;
              vec3 Hb = normalize(moonDir + Vw);
              float bSpec = pow(max(dot(Nbank, Hb), 0.0), 36.0) * 0.45 + pow(max(dot(Nbank, Hb), 0.0), 12.0) * 0.10;
              float bFres = pow(max(1.0 - max(dot(Nbank, Vw), 0.0), 0.0001), 3.4);
              gl_FragColor.rgb += (vec3(0.54, 0.68, 0.90) * bSpec + vec3(0.038, 0.064, 0.110) * bFres) * waterBankSheen;
            }
          }
        }
        #include <tonemapping_fragment>`
      );
  };

  mat.customProgramCacheKey = () => cacheKey;
  mat.userData.gorgeUniforms = terrainUniforms;
  mat.userData.terrainUniforms = terrainUniforms;

  const tracked = trackMat(mat);
  if (regNormalMat && cobbleNormal) {
    regNormalMat(tracked, cobbleNormal);
  }
  return tracked;
}

// ============================================================================
// 2. Moss-Coated Stone / Cliff / Boulder / Timber / Bark / Gate Material
//    (Full InstancedMesh USE_INSTANCING support + Upward Velvety Moss + Contact AO + Moonlit Rim)
// ============================================================================
const MOSS_STONE_KIND_PRESETS = Object.freeze({
  ruin: Object.freeze({
    texKey: 'ruinStone',
    color: 0xffffff,
    roughness: 0.86,
    metalness: 0.03,
    normalScale: 0.92,
    aoMapIntensity: 0.68,
    mossAmount: 0.58,
    groundAO: 0.28,
    rimStrength: 0.16,
    stoneDesat: 0.24,
    albedoScale: 1.06,
    wetStrength: 0.64,
    waterlineRough: 0.34,
    envMapIntensity: 0.48
  }),
  cliff: Object.freeze({
    texKey: 'cliffRock',
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0.02,
    normalScale: 1.00,
    aoMapIntensity: 0.70,
    mossAmount: 0.72,
    groundAO: 0.30,
    rimStrength: 0.14,
    stoneDesat: 0.22,
    albedoScale: 1.14,
    wetStrength: 0.68,
    waterlineRough: 0.34,
    envMapIntensity: 0.46
  }),
  boulder: Object.freeze({
    texKey: 'cliffRock',
    color: 0xffffff,
    roughness: 0.74,
    metalness: 0.04,
    normalScale: 0.92,
    aoMapIntensity: 0.66,
    mossAmount: 0.66,
    groundAO: 0.30,
    rimStrength: 0.16,
    stoneDesat: 0.22,
    albedoScale: 1.02,
    wetStrength: 0.78,
    waterlineRough: 0.28,
    envMapIntensity: 0.54
  }),
  deck: Object.freeze({
    texKey: 'cobble',
    color: 0xffffff,
    roughness: 0.82,
    metalness: 0.04,
    normalScale: 0.88,
    aoMapIntensity: 0.66,
    mossAmount: 0.14,
    groundAO: 0.22,
    rimStrength: 0.12,
    stoneDesat: 0.20,
    albedoScale: 1.08,
    wetStrength: 0.62,
    waterlineRough: 0.30,
    envMapIntensity: 0.48
  }),
  timber: Object.freeze({
    texKey: 'woodTimber',
    color: 0xffffff,
    roughness: 0.86,
    metalness: 0.02,
    normalScale: 0.88,
    aoMapIntensity: 0.62,
    mossAmount: 0.0,
    groundAO: 0.24,
    rimStrength: 0.12,
    stoneDesat: 0.06,
    albedoScale: 1.12,
    wetStrength: 0.50,
    waterlineRough: 0.40,
    envMapIntensity: 0.44
  }),
  bark: Object.freeze({
    texKey: 'bark',
    color: 0xffffff,
    roughness: 0.90,
    metalness: 0.02,
    normalScale: 1.05,
    aoMapIntensity: 0.62,
    mossAmount: 0.22,
    groundAO: 0.28,
    rimStrength: 0.18,
    stoneDesat: 0.08,
    albedoScale: 1.24,
    wetStrength: 0.56,
    waterlineRough: 0.38,
    envMapIntensity: 0.44
  }),
  zone0_gate: Object.freeze({
    texKey: 'ruinStone',
    color: 0xffffff,
    roughness: 0.84,
    metalness: 0.04,
    normalScale: 0.94,
    aoMapIntensity: 0.68,
    mossAmount: 0.50,
    groundAO: 0.28,
    rimStrength: 0.16,
    stoneDesat: 0.22,
    albedoScale: 1.04,
    wetStrength: 0.68,
    waterlineRough: 0.32,
    envMapIntensity: 0.48
  })
});

export function createMossCoatedStoneMaterial(THREE, pbrTex, opts = {}) {
  const rawKind = typeof opts.kind === 'string' ? opts.kind : 'ruin';
  const kind = Object.prototype.hasOwnProperty.call(MOSS_STONE_KIND_PRESETS, rawKind) ? rawKind : 'ruin';
  const preset = MOSS_STONE_KIND_PRESETS[kind];
  const lowSpecMode = Boolean(opts.lowSpecMode);
  const trackMat = typeof opts.trackMat === 'function' ? opts.trackMat : (m) => m;
  const regNormalMat = typeof opts.regNormalMat === 'function' ? opts.regNormalMat : null;

  const texPack = pbrTex && pbrTex[preset.texKey] ? pbrTex[preset.texKey] : null;
  const resolvedMap = Object.prototype.hasOwnProperty.call(opts, 'map')
    ? opts.map
    : (texPack?.albedo ?? null);
  const resolvedNormalMap = Object.prototype.hasOwnProperty.call(opts, 'normalMap')
    ? opts.normalMap
    : (texPack?.normal ?? null);
  const resolvedRoughMap = Object.prototype.hasOwnProperty.call(opts, 'roughnessMap')
    ? opts.roughnessMap
    : (texPack?.orm ?? null);
  const resolvedAoMap = Object.prototype.hasOwnProperty.call(opts, 'aoMap')
    ? opts.aoMap
    : resolvedRoughMap;

  const colorVal = opts.color !== undefined ? opts.color : preset.color;
  const roughnessVal = Number.isFinite(opts.roughness) ? opts.roughness : preset.roughness;
  const metalnessVal = Number.isFinite(opts.metalness) ? opts.metalness : preset.metalness;
  const normalScaleVec = resolveNormalScaleVec2(THREE, opts.normalScale, preset.normalScale);
  const repeatX = Number.isFinite(opts.repeatX) && opts.repeatX > 0 ? opts.repeatX : 1.0;
  const repeatY = Number.isFinite(opts.repeatY) && opts.repeatY > 0 ? opts.repeatY : 1.0;

  const mossAmountVal = Number.isFinite(opts.mossAmount) ? opts.mossAmount : preset.mossAmount;
  const groundAOVal = Number.isFinite(opts.groundAO) ? opts.groundAO : preset.groundAO;
  const rimStrengthVal = Number.isFinite(opts.rimStrength) ? opts.rimStrength : preset.rimStrength;
  const vertexColorsVal = opts.vertexColors !== undefined ? Boolean(opts.vertexColors) : true;
  const envMapIntensityVal = Number.isFinite(opts.envMapIntensity) ? opts.envMapIntensity : preset.envMapIntensity;

  const mat = new THREE.MeshStandardMaterial({
    map: resolvedMap,
    normalMap: lowSpecMode ? null : resolvedNormalMap,
    normalScale: normalScaleVec,
    roughnessMap: resolvedRoughMap,
    aoMap: resolvedAoMap,
    aoMapIntensity: Number.isFinite(opts.aoMapIntensity) ? opts.aoMapIntensity : preset.aoMapIntensity,
    vertexColors: vertexColorsVal,
    color: colorVal,
    roughness: roughnessVal,
    metalness: metalnessVal,
    envMapIntensity: envMapIntensityVal,
    side: opts.side !== undefined ? opts.side : THREE.FrontSide
  });

  const mossStoneUniforms = {
    uUvRepeat: { value: new THREE.Vector2(repeatX, repeatY) },
    uMossAmount: { value: mossAmountVal },
    uGroundAO: { value: groundAOVal },
    uRimStrength: { value: rimStrengthVal },
    uStoneDesat: { value: preset.stoneDesat },
    uAlbedoScale: { value: preset.albedoScale },
    uWetStrength: { value: preset.wetStrength },
    uWaterlineRough: { value: preset.waterlineRough },
    uWaterlineY: { value: WATERLINE_Y_DEFAULT }
  };

  const cacheKey = `gorge-moss-stone-v103-${kind}-${lowSpecMode ? 'low' : 'hq'}`;

  const mossNoiseGlsl = lowSpecMode
    ? `
      float mMacro = sgVnoise3(vMossWorldPos * 0.36 + vec3(2.3, 0.7, -1.9));
      float mFine = mMacro;
      float patinaN = sgVnoise3(vMossWorldPos * 0.19 - vec3(1.4, 0.5, 3.1));
    `
    : `
      float mMacro = sgVnoise3(vMossWorldPos * 0.38 + vec3(2.3, 0.7, -1.9));
      float mFine = sgVnoise3(vMossWorldPos * 1.55 - vec3(4.1, 1.3, 3.2));
      float patinaN = sgVnoise3(vMossWorldPos * 0.18 - vec3(1.4, 0.5, 3.1)) * 0.65
                    + sgVnoise3(vMossWorldPos * 0.47 + vec3(5.2, -2.1, 0.8)) * 0.35;
    `;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uUvRepeat = mossStoneUniforms.uUvRepeat;
    shader.uniforms.uMossAmount = mossStoneUniforms.uMossAmount;
    shader.uniforms.uGroundAO = mossStoneUniforms.uGroundAO;
    shader.uniforms.uRimStrength = mossStoneUniforms.uRimStrength;
    shader.uniforms.uStoneDesat = mossStoneUniforms.uStoneDesat;
    shader.uniforms.uAlbedoScale = mossStoneUniforms.uAlbedoScale;
    shader.uniforms.uWetStrength = mossStoneUniforms.uWetStrength;
    shader.uniforms.uWaterlineRough = mossStoneUniforms.uWaterlineRough;
    shader.uniforms.uWaterlineY = mossStoneUniforms.uWaterlineY;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec2 uUvRepeat;
        varying vec3 vMossWorldPos;
        varying vec3 vMossWorldNorm;
        varying float vMossLocalY;`
      )
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
        #ifdef USE_MAP
          vMapUv *= uUvRepeat;
        #endif
        #ifdef USE_AOMAP
          vAoMapUv *= uUvRepeat;
        #endif
        #ifdef USE_NORMALMAP
          vNormalMapUv *= uUvRepeat;
        #endif
        #ifdef USE_ROUGHNESSMAP
          vRoughnessMapUv *= uUvRepeat;
        #endif`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        {
          // Explicit InstancedMesh-safe world position & world normal (independent of USE_ENVMAP!)
          vec4 wp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            wp = instanceMatrix * wp;
          #endif
          wp = modelMatrix * wp;
          vMossWorldPos = wp.xyz;

          vec3 wn = objectNormal;
          #ifdef USE_INSTANCING
            wn = mat3(instanceMatrix) * wn;
          #endif
          vMossWorldNorm = normalize(mat3(modelMatrix) * wn);
          vMossLocalY = transformed.y;
        }`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uMossAmount;
        uniform float uGroundAO;
        uniform float uRimStrength;
        uniform float uStoneDesat;
        uniform float uAlbedoScale;
        uniform float uWetStrength;
        uniform float uWaterlineRough;
        uniform float uWaterlineY;
        varying vec3 vMossWorldPos;
        varying vec3 vMossWorldNorm;
        varying float vMossLocalY;

        ${GLSL_NOISE_HELPERS}`
      )
      .replace(
        '#include <color_fragment>',
        `
        // Top-level per-fragment stone/moss/wetness state reused in roughness & pre-tonemap rim/specular
        float msMossMask = 0.0;
        float msWaterWet = 0.0;
        float msPatinaN = 0.5;
        vec3 msWorldN = normalize(vMossWorldNorm);

        {
          ${mossNoiseGlsl}
          msPatinaN = patinaN;

          // 1) Brooding Dark Charcoal-Slate Calibration (tames bright pale-blue stone maps to match hero & ref frames)
          if (uStoneDesat > 0.01) {
            float sLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(sLum), uStoneDesat);
          }
          diffuseColor.rgb *= uAlbedoScale;

          // 2) Macro World Stone Patina (+/- 12% weathered stone color variation breaking up uniform walls/cliffs)
          float patinaMod = 0.88 + patinaN * 0.24;
          vec3 mineralTint = mix(vec3(0.95, 0.97, 1.03), vec3(1.04, 1.00, 0.94), mMacro);
          diffuseColor.rgb *= patinaMod * mineralTint;

          // 3) World-Space Upward-Facing Velvety Forest Moss (unified living overgrown world!)
          if (uMossAmount > 0.005) {
            float mossNoise = (mMacro * 0.62 + mFine * 0.38) * 2.0 - 1.0;
            // Suppress moss below river waterline so submerged river boulders stay dark wet basalt
            float aboveWaterMoss = smoothstep(uWaterlineY + 0.04, 0.26, vMossWorldPos.y + mossNoise * 0.08);
            msMossMask = clamp(smoothstep(0.46, 0.82, msWorldN.y + mossNoise * 0.24) * uMossAmount * aboveWaterMoss, 0.0, 0.96);

            vec3 mossDeep = vec3(0.098, 0.180, 0.068);
            vec3 mossLush = vec3(0.172, 0.275, 0.095);
            vec3 mossCol = mix(mossDeep, mossLush, clamp(mMacro * 0.65 + mFine * 0.35, 0.0, 1.0));
            // Subtle dark moisture-wick ring along moss fringe
            float mossFringe = smoothstep(0.02, 0.26, msMossMask) * (1.0 - msMossMask);
            diffuseColor.rgb *= mix(1.0, 0.78, mossFringe);
            diffuseColor.rgb = mix(diffuseColor.rgb, mossCol, clamp(msMossMask * 0.96, 0.0, 0.96));
          }

          // 4) Grounded Base Contact AO (y < 0.75 + local foot seam) & Wet Waterline Darkening (y < 0.45)
          float worldGroundAO = 1.0 - smoothstep(uWaterlineY, 0.75, vMossWorldPos.y);
          float localFootAO = (1.0 - smoothstep(-0.06, 0.56, vMossLocalY)) * step(-0.42, vMossLocalY) * 0.58;
          float contactAO = clamp(max(worldGroundAO, localFootAO), 0.0, 1.0) * uGroundAO;
          diffuseColor.rgb *= (1.0 - contactAO * 0.66);

          msWaterWet = 1.0 - smoothstep(uWaterlineY - 0.04, 0.45, vMossWorldPos.y + (mFine - 0.5) * 0.10);
          diffuseColor.rgb *= mix(1.0, 0.50, msWaterWet * uWetStrength);
        }

        // Apply vertex colors (preserving Blender-baked crevice AO while moderating cold blue procedural box tint)
        #if defined( USE_COLOR_ALPHA )
          {
            vec3 vc = vColor.rgb;
            float vLum = dot(vc, vec3(0.30, 0.59, 0.11));
            float blueSpike = smoothstep(0.06, 0.22, vc.b - vc.r);
            vec3 vcClean = mix(vc, vec3(vLum * 0.96, vLum * 1.00, vLum * 1.06), blueSpike * uStoneDesat);
            diffuseColor.rgb *= vcClean;
            diffuseColor.a *= vColor.a;
          }
        #elif defined( USE_COLOR )
          {
            vec3 vc = vColor;
            float vLum = dot(vc, vec3(0.30, 0.59, 0.11));
            float blueSpike = smoothstep(0.06, 0.22, vc.b - vc.r);
            vec3 vcClean = mix(vc, vec3(vLum * 0.96, vLum * 1.00, vLum * 1.06), blueSpike * uStoneDesat);
            diffuseColor.rgb *= vcClean;
          }
        #endif`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        // Subtle macro weathered roughness variation
        roughnessFactor = clamp(roughnessFactor + (msPatinaN - 0.5) * 0.12, 0.12, 0.98);
        // Velvety matte moss tops raise roughness toward 0.90
        roughnessFactor = mix(roughnessFactor, 0.90, msMossMask * 0.88);
        // Glossy wet stone sheen near river waterline (y < 0.45)
        roughnessFactor = mix(roughnessFactor, uWaterlineRough, msWaterWet * (1.0 - msMossMask) * uWetStrength * 0.85);`
      )
      .replace(
        '#include <tonemapping_fragment>',
        `{
          // Pre-Tonemapping Hero-Cohesive Stylized Moonlit Rim + Wet Waterline Specular Glints (ACES Filmic safe!)
          vec3 Vw = normalize(cameraPosition - vMossWorldPos);
          vec3 moonDir = normalize(vec3(0.240, 0.315, 0.918));
          float ndv = max(dot(msWorldN, Vw), 0.0);

          if (uRimStrength > 0.001) {
            float rimFres = pow(max(1.0 - ndv, 0.0001), 3.2);
            float upBias = smoothstep(-0.22, 0.65, msWorldN.y);
            float moonBias = smoothstep(-0.35, 0.72, dot(msWorldN, moonDir));
            float rimMask = rimFres * (0.26 + 0.42 * upBias + 0.32 * moonBias) * uRimStrength;
            // Softer velvet grazing sheen on moss, crisp sculpted silver-slate rim on rock/ruin silhouettes
            rimMask *= mix(1.0, 0.58, msMossMask);
            vec3 rimCol = mix(vec3(0.38, 0.50, 0.72), vec3(0.24, 0.38, 0.28), msMossMask * 0.45);
            gl_FragColor.rgb += rimCol * rimMask;
          }

          if (msWaterWet > 0.04 && uWetStrength > 0.05) {
            float aboveBed = smoothstep(uWaterlineY - 0.12, uWaterlineY + 0.04, vMossWorldPos.y);
            vec3 Hm = normalize(moonDir + Vw);
            float wetSpec = pow(max(dot(msWorldN, Hm), 0.0), 46.0) * 0.44 + pow(max(dot(msWorldN, Hm), 0.0), 14.0) * 0.08;
            float wetFres = pow(max(1.0 - ndv, 0.0001), 3.6);
            gl_FragColor.rgb += (vec3(0.56, 0.70, 0.92) * wetSpec + vec3(0.045, 0.075, 0.130) * wetFres)
                              * msWaterWet * aboveBed * (1.0 - msMossMask) * uWetStrength * 0.62;
          }
        }
        #include <tonemapping_fragment>`
      );
  };

  mat.customProgramCacheKey = () => cacheKey;
  mat.userData.mossStoneUniforms = mossStoneUniforms;
  mat.userData.mossStoneKind = kind;

  const tracked = trackMat(mat);
  if (regNormalMat && resolvedNormalMap) {
    regNormalMat(tracked, resolvedNormalMap);
  }
  return tracked;
}
