// Grimborne Hunters — Nocturnal Gorge Atmosphere, Sky Dome, Obsidian River, Valley Mist & Campfire VFX
// Visual Cohesion Overhaul (z103) — Pure Vanilla ES Module (Three.js r160, ZERO external deps, ZERO per-frame GC).
//
// Exports:
//   1. createGorgeSkyMaterial(THREE, uTimeUniform, lowSpecMode = false)
//   2. createGorgeRiverMaterial(THREE, uTimeUniform, uBonfireLitUniform, lowSpecMode = false)
//   3. createValleyMistRig(THREE, { parentGroup, uTimeUniform, mistSpriteTex, isMobile, lowSpecMode, trackGeo, trackMat })
//   4. createCampfireVfxRig(THREE, { parentGroup, uTimeUniform, mistSpriteTex, isMobile, lowSpecMode, trackGeo, trackMat })

const CANONICAL_MOON_DIR_GLSL = 'normalize(vec3(0.240, 0.315, 0.918))';
const SCENE_FOG_HEX = 0x132032;

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstepJS(edge0, edge1, x) {
  const d = edge1 - edge0;
  if (Math.abs(d) < 1e-6) return x >= edge1 ? 1.0 : 0.0;
  const t = clamp01((x - edge0) / d);
  return t * t * (3.0 - 2.0 * t);
}

function makeRng(seedInit) {
  let s = seedInit >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Analytical road elevation approximation matching soulsGorgeTopology.js northRise (zero external import)
function approxGorgeRoadY(z) {
  return (
    smoothstepJS(3.2, 32.0, z) * 0.56 +
    smoothstepJS(32.0, 57.0, z) * 0.28 +
    smoothstepJS(57.0, 93.0, z) * 0.62 +
    smoothstepJS(94.5, 102.2, z) * 1.19
  );
}

// Tiny 2x2 white fallback texture so WebGL2 samplers never bind null when mistSpriteTex is omitted
function createWhiteFallbackTex(THREE) {
  const data = new Uint8Array([
    255, 255, 255, 255,
    255, 255, 255, 255,
    255, 255, 255, 255,
    255, 255, 255, 255
  ]);
  const tex = new THREE.DataTexture(data, 2, 2, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

// ============================================================================
// 1. Nocturnal Stormy Twilight Sky Material (Full Cratered Moon + Backlit Storm Clouds + Stars)
// ============================================================================
export function createGorgeSkyMaterial(THREE, uTimeUniform, lowSpecMode = false) {
  const sharedTime = uTimeUniform || { value: 0.0 };
  const uniforms = {
    uTime: sharedTime,
    uLowSpec: { value: lowSpecMode ? 1.0 : 0.0 },
    uFogColor: { value: new THREE.Color(SCENE_FOG_HEX) }
  };

  return new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
    fog: false,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uLowSpec;
      uniform vec3 uFogColor;
      varying vec3 vDir;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
          mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      float fbm3(vec2 p) {
        return vnoise(p) * 0.55
             + vnoise(p * 2.12 + vec2(7.4, 3.9)) * 0.29
             + vnoise(p * 4.35 - vec2(5.1, 8.2)) * 0.16;
      }

      float fbm4(vec2 p) {
        float a = vnoise(p) * 0.48;
        float b = vnoise(p * 2.08 + vec2(6.3, 4.1)) * 0.28;
        float c = vnoise(p * 4.25 - vec2(5.2, 7.8)) * 0.15;
        float d = vnoise(p * 8.40 + vec2(3.1, -6.4)) * 0.09;
        return a + b + c + d;
      }

      // Procedural lunar impact crater relief: shaded basin + bright crater rim + directional solar edge
      float lunarCrater(vec2 p, vec2 center, float rad, vec2 lightDir2) {
        vec2 q = (p - center) / rad;
        float dist = length(q);
        if (dist > 1.35) return 0.0;
        float bowl = -smoothstep(0.95, 0.18, dist) * 0.34;
        float rim = exp(-pow((dist - 0.93) * 5.0, 2.0)) * 0.26;
        float sideLight = dot(normalize(q + vec2(1e-4)), lightDir2);
        float relief = sideLight * smoothstep(1.18, 0.52, dist) * smoothstep(0.14, 0.72, dist) * 0.24;
        return bowl + rim + relief;
      }

      void main() {
        vec3 d = normalize(vDir);
        float elev = clamp(d.y, -0.45, 1.0);

        // Calibrated linear nocturnal palette matching frame_00 & frame_07:
        //   Zenith:  #040914 (deep midnight-indigo)
        //   Mid-sky: #0c182c (moody storm slate)
        //   Horizon: #1a2c44 (cool misty blue-slate valley horizon)
        //   Fog:     #132032 (seamless scene horizon blend)
        vec3 zenithCol  = vec3(0.0016, 0.0036, 0.0094);
        vec3 midSkyCol  = vec3(0.0048, 0.0112, 0.0285);
        vec3 horizonCol = vec3(0.0124, 0.0278, 0.0615);
        vec3 abyssCol   = vec3(0.0024, 0.0054, 0.0126);

        vec3 skyBand = mix(
          mix(horizonCol, midSkyCol, smoothstep(0.02, 0.34, elev)),
          zenithCol,
          pow(smoothstep(0.22, 0.96, elev), 0.82)
        );
        // Smooth skirt directly into scene fog (#132032) right along the valley floor horizon
        float fogSkirt = 1.0 - smoothstep(-0.02, 0.075, elev);
        vec3 col = elev < -0.02
          ? mix(uFogColor, abyssCol, clamp((-elev - 0.02) * 4.5, 0.0, 1.0))
          : mix(skyBand, uFogColor, fogSkirt * 0.72);

        // Canonical Full Moon direction upper-left above valley peaks
        vec3 moonDir = ${CANONICAL_MOON_DIR_GLSL};
        vec3 mRight = normalize(cross(vec3(0.0, 1.0, 0.0), moonDir));
        vec3 mUp = cross(moonDir, mRight);
        float mDot = dot(d, moonDir);
        float mPos = max(mDot, 0.0);

        // Soft valley horizon moonlight mist glow behind the distant peaks on the moon side
        vec2 horizDir = normalize(vec2(d.x, d.z) + vec2(1e-5));
        vec2 moonHoriz = normalize(vec2(moonDir.x, moonDir.z));
        float azimMoon = pow(max(dot(horizDir, moonHoriz), 0.0), 2.8);
        float valleyGlowBand = smoothstep(-0.03, 0.06, elev) * (1.0 - smoothstep(0.09, 0.38, elev));
        col += vec3(0.018, 0.032, 0.058) * azimMoon * valleyGlowBand;

        // Tasteful two-tier silver-blue lunar corona (crisp compact aura, zero blown-out white glare)
        float coronaTight = pow(mPos, 48.0);
        float coronaWide  = pow(mPos, 7.5);
        float coronaMicro = pow(mPos, 280.0);
        col += vec3(0.11, 0.18, 0.32) * coronaWide * 0.42;
        col += vec3(0.32, 0.45, 0.68) * coronaTight * 0.46;
        col += vec3(0.68, 0.78, 0.96) * coronaMicro * 0.22;

        // Crisp compact cratered Full Moon disc
        float discEdge0 = 0.9978;
        float discEdge1 = 0.9983;
        float disc = smoothstep(discEdge0, discEdge1, mDot);
        if (disc > 0.001) {
          float angularR = sqrt(max(1e-5, 1.0 - discEdge0 * discEdge0));
          vec2 mUv = vec2(dot(d, mRight), dot(d, mUp)) / angularR;
          float mr = length(mUv);

          // Delicate lunar maria seas + crater topology
          float mariaBroad = fbm3(mUv * 1.90 + vec2(1.35, 2.25));
          float mariaFine  = fbm3(mUv * 5.10 - vec2(0.85, 1.55));
          float seaMask = smoothstep(0.36, 0.72, mariaBroad * 0.70 + mariaFine * 0.30);

          vec2 sun2 = normalize(vec2(-0.58, 0.81));
          float craters = 0.0;
          craters += lunarCrater(mUv, vec2(-0.24,  0.22), 0.34, sun2);
          craters += lunarCrater(mUv, vec2( 0.31,  0.13), 0.27, sun2);
          craters += lunarCrater(mUv, vec2(-0.09, -0.33), 0.23, sun2);
          craters += lunarCrater(mUv, vec2( 0.20, -0.45), 0.15, sun2);
          craters += lunarCrater(mUv, vec2(-0.45, -0.07), 0.19, sun2);
          craters += lunarCrater(mUv, vec2( 0.06,  0.47), 0.16, sun2);
          craters += lunarCrater(mUv, vec2(-0.34, -0.38), 0.12, sun2);

          float sphereZ = sqrt(max(0.0, 1.0 - min(mr * mr, 0.999)));
          float limbShade = 0.72 + 0.28 * pow(sphereZ, 0.44);
          vec3 mareCol = vec3(0.46, 0.54, 0.67);
          vec3 highlandCol = vec3(1.12, 1.15, 1.22);
          float surfaceTone = clamp(seaMask * 0.84 + craters * 0.78 + (mariaFine - 0.5) * 0.16 + 0.14, 0.0, 1.0);
          vec3 moonCol = mix(mareCol, highlandCol, surfaceTone) * limbShade;
          moonCol += vec3(0.14, 0.22, 0.36) * pow(1.0 - sphereZ, 2.2);
          col = mix(col, moonCol, disc);
        }

        // Voluminous dark storm clouds with directional silver-blue moonlight lining on moon-facing rims
        float cloudCover = 0.0;
        if (elev > 0.002) {
          vec2 cUv = d.xz / (elev + 0.20);
          vec2 wind1 = vec2(uTime * 0.0075, -uTime * 0.0038);
          vec2 wind2 = vec2(-uTime * 0.0110, uTime * 0.0052);

          float cloudRaw;
          float cloudTowardMoon;
          vec2 moonStep = normalize(moonDir.xz - d.xz * 0.35 + vec2(1e-4)) * 0.22;

          if (uLowSpec < 0.5) {
            float warp = fbm3(cUv * 0.34 + wind1 * 0.7);
            vec2 wUv = cUv * 0.52 + vec2(warp * 0.55, -warp * 0.38);
            cloudRaw = fbm4(wUv + wind1) * 0.68 + fbm3(cUv * 1.48 + wind2) * 0.32;
            cloudTowardMoon = fbm3(wUv + moonStep * 0.52 + wind1) * 0.68
                            + fbm3((cUv + moonStep) * 1.48 + wind2) * 0.32;
          } else {
            cloudRaw = vnoise(cUv * 0.48 + wind1) * 0.64 + vnoise(cUv * 1.35 + wind2) * 0.36;
            cloudTowardMoon = vnoise((cUv + moonStep) * 0.48 + wind1) * 0.64
                            + vnoise((cUv + moonStep) * 1.35 + wind2) * 0.36;
          }

          float elevFade = smoothstep(0.002, 0.10, elev) * (1.0 - smoothstep(0.68, 0.96, elev));
          float density = smoothstep(0.37, 0.79, cloudRaw) * elevFade;
          cloudCover = density;

          // Cloud edge facing the moon catches crisp silver-blue rim scattering
          float edgeBand = smoothstep(0.34, 0.52, cloudRaw) * (1.0 - smoothstep(0.56, 0.80, cloudRaw));
          float facingDiff = clamp((cloudRaw - cloudTowardMoon) * 3.4, 0.0, 1.0);
          float moonScatter = pow(mPos, 3.8) * 0.90 + pow(mPos, 18.0) * 1.10;
          float silverRim = clamp((edgeBand * 1.15 + facingDiff * 0.95) * (0.28 + moonScatter * 1.45), 0.0, 1.0);

          vec3 cloudShadow = vec3(0.006, 0.011, 0.024);
          vec3 cloudBody   = vec3(0.024, 0.042, 0.076);
          vec3 cloudSilver = vec3(0.26, 0.38, 0.56);
          vec3 cloudBright = vec3(0.54, 0.68, 0.88);

          vec3 cloudCol = mix(cloudShadow, cloudBody, smoothstep(0.36, 0.72, cloudRaw));
          cloudCol = mix(cloudCol, cloudSilver, silverRim * 0.82);
          cloudCol += cloudBright * pow(silverRim, 2.2) * pow(mPos, 6.0) * 0.55;
          // Gently blend lower cloud skirts into misty valley horizon
          cloudCol = mix(uFogColor * 1.25, cloudCol, smoothstep(0.01, 0.14, elev));

          // Keep the Full Moon cleanly readable even as thin wisps drift past
          float cloudAlpha = density * mix(0.84, 0.12, disc);
          col = mix(col, cloudCol, cloudAlpha);
        }

        // Subtle crisp starfield peeking through clear high sky above horizon clouds
        if (elev > 0.09) {
          float clearMask = clamp(1.0 - cloudCover * 0.90, 0.05, 1.0);
          float starFade = smoothstep(0.09, 0.34, elev) * (1.0 - disc) * clamp(1.0 - coronaTight * 1.8, 0.08, 1.0) * clearMask;
          vec2 sg1 = d.xz / (elev + 0.34) * 36.0;
          vec2 cell1 = floor(sg1);
          vec2 frac1 = fract(sg1) - 0.5;
          float h1 = hash21(cell1);
          if (h1 > 0.968) {
            vec2 off1 = vec2(hash21(cell1 + 17.3) - 0.5, hash21(cell1 + 41.9) - 0.5) * 0.58;
            float sd1 = length(frac1 - off1);
            float tw1 = 0.65 + 0.35 * sin(uTime * (1.2 + h1 * 3.2) + h1 * 62.8);
            float st1 = smoothstep(0.11, 0.012, sd1) * tw1;
            vec3 stCol = mix(vec3(0.68, 0.80, 1.0), vec3(0.98, 0.92, 0.80), step(0.990, h1));
            col += stCol * st1 * starFade * 0.68;
          }
          if (uLowSpec < 0.5) {
            vec2 sg2 = d.xz / (elev + 0.28) * 64.0 + vec2(11.3, 27.1);
            vec2 cell2 = floor(sg2);
            vec2 frac2 = fract(sg2) - 0.5;
            float h2 = hash21(cell2);
            if (h2 > 0.982) {
              vec2 off2 = vec2(hash21(cell2 + 31.7) - 0.5, hash21(cell2 + 9.4) - 0.5) * 0.52;
              float sd2 = length(frac2 - off2);
              float tw2 = 0.70 + 0.30 * cos(uTime * (1.8 + h2 * 2.5) + h2 * 48.0);
              float st2 = smoothstep(0.09, 0.01, sd2) * tw2;
              col += vec3(0.62, 0.74, 0.95) * st2 * starFade * 0.38;
            }
          }
        }

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });
}

// ============================================================================
// 2. Deep Obsidian-Navy Glassy Moonlit River Material (Drop-In Compatible w/ soulsExteriorShore.js)
// ============================================================================
export function createGorgeRiverMaterial(THREE, uTimeUniform, uBonfireLitUniform, lowSpecMode = false) {
  const sharedTime = uTimeUniform || { value: 0.0 };
  const sharedBonfireLit = uBonfireLitUniform || { value: 0.0 };

  const uniforms = {
    uTime: sharedTime,
    uBonfireLit: sharedBonfireLit,
    uLowSpec: { value: lowSpecMode ? 1.0 : 0.0 },
    uFogColor: { value: new THREE.Color(SCENE_FOG_HEX) }
  };

  return new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying float vWave;
      void main() {
        vUv = uv;
        vec3 p = position;
        float t = uTime * 2.15;
        float edge = sin(clamp(uv.x, 0.0, 1.0) * 3.14159265);
        float w = (sin(uv.y * 5.2 - t * 2.1 + uv.x * 4.2) * 0.024
                +  cos(uv.y * 8.8 - t * 2.9 - uv.x * 7.0) * 0.013) * edge;
        // Outfall waterfall plunge pool surge near (0.3, -10.5)
        float poolD = length(p.xz - vec2(0.3, -10.5));
        float poolSurge = exp(-poolD * poolD * 0.055) * sin(t * 4.4 - poolD * 2.5) * 0.058;
        p.y += w + poolSurge;
        vWave = w + poolSurge;
        vec4 localPos = vec4(p, 1.0);
        #ifdef USE_INSTANCING
          localPos = instanceMatrix * localPos;
        #endif
        vec4 wp = modelMatrix * localPos;
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uBonfireLit;
      uniform float uLowSpec;
      uniform vec3 uFogColor;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying float vWave;

      float hash21(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 34.53);
        return fract(p.x * p.y);
      }

      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
          mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      float fbm2(vec2 p) {
        return vnoise(p) * 0.65 + vnoise(p * 2.18 + vec2(9.3, 14.7)) * 0.35;
      }

      float fbm3(vec2 p) {
        return vnoise(p) * 0.54
             + vnoise(p * 2.15 + vec2(9.3, 14.7)) * 0.30
             + vnoise(p * 4.42 - vec2(6.2, 11.4)) * 0.16;
      }

      // Evaluate organic multi-octave river surface wavelet height (horizontally elongated ripples flowing +Z)
      float sampleWaveHeight(vec2 wp, float t, float lowSpec) {
        vec2 uvA = vec2(wp.x * 0.52, wp.y * 0.92 - t * 1.05);
        vec2 uvB = vec2(wp.x * 1.18 + 3.7, wp.y * 2.18 - t * 1.72);
        vec2 uvC = vec2(wp.x * 2.45 - 2.1, wp.y * 4.35 - t * 2.38);
        float a = lowSpec < 0.5 ? fbm3(uvA) : fbm2(uvA);
        float b = lowSpec < 0.5 ? fbm3(uvB + vec2(a * 0.42, -t * 0.22)) : fbm2(uvB);
        float c = vnoise(uvC + vec2(b * 0.38, -a * 0.25));
        float swell = sin(wp.y * 1.35 - t * 1.65 + wp.x * 0.45) * 0.08;
        return a * 0.46 + b * 0.36 + c * 0.18 + swell;
      }

      vec3 evalWarmFireRefl(vec3 firePos, vec3 wp, vec3 N, vec3 V, float fl, float strength) {
        vec3 L = firePos - wp;
        float d = length(L);
        float atten = exp(-d * 0.105) / (1.0 + d * d * 0.012);
        vec3 H = normalize(normalize(L) + V);
        float ndh = max(dot(N, H), 0.0);
        float sharp = pow(ndh, 46.0) * 1.45;
        float soft  = pow(ndh, 14.0) * 0.24;
        return vec3(1.52, 0.62, 0.14) * (sharp + soft) * atten * fl * strength;
      }

      void main() {
        float t = uTime * 0.92;
        vec2 wp = vWorldPos.xz;
        float camDist = length(cameraPosition - vWorldPos);

        // Multi-octave wavelet height and analytical gradient normal
        float h0 = sampleWaveHeight(wp, t, uLowSpec);
        float eps = mix(0.09, 0.22, smoothstep(18.0, 95.0, camDist));
        float hX = sampleWaveHeight(wp + vec2(eps, 0.0), t, 1.0);
        float hZ = sampleWaveHeight(wp + vec2(0.0, eps), t, 1.0);

        // Slightly soften distant micro-normals to prevent shimmering noise in far canyon
        float normScale = mix(1.0, 0.58, smoothstep(28.0, 115.0, camDist));
        vec3 N = normalize(vec3((h0 - hX) * 1.42 * normScale, 1.0, (h0 - hZ) * 1.85 * normScale));
        vec3 V = normalize(cameraPosition - vWorldPos);
        float ndotv = max(dot(N, V), 0.0);
        float fres = pow(1.0 - ndotv, 4.2);

        // Deep obsidian-navy glassy core (#030811) -> shallow slate sheen (#0a1728)
        vec3 deepCore    = vec3(0.0010, 0.0025, 0.0058);
        vec3 shallowCol  = vec3(0.0034, 0.0092, 0.0225);
        vec3 darkSkyRefl = vec3(0.018, 0.034, 0.064);

        float shoreEdge = min(vUv.x, 1.0 - vUv.x);
        float shallowMask = 1.0 - smoothstep(0.03, 0.28, shoreEdge);
        vec3 col = mix(deepCore, shallowCol, clamp(smoothstep(0.28, 0.80, h0) * 0.58 + shallowMask * 0.42, 0.0, 1.0));
        // Subtle dark wet stone absorption very close to the shoreline
        col *= mix(0.68, 1.0, smoothstep(0.015, 0.14, shoreEdge));
        col = mix(col, darkSkyRefl, fres * 0.46);

        // Rich silvery-white broken moonlight reflection band aligned with canonical moon direction
        vec3 moonDir = ${CANONICAL_MOON_DIR_GLSL};
        vec3 Hm = normalize(moonDir + V);
        float ndh = max(dot(N, Hm), 0.0);

        // High-frequency capillary breakup keeps bright silver ribbons broken across dark mirror troughs
        float capMask = smoothstep(0.42, 0.80, vnoise(vec2(wp.x * 2.2, wp.y * 4.0 - t * 2.15) + vec2(h0 * 1.4)));
        float moonGlint  = pow(ndh, 195.0) * 2.85 * (0.45 + 0.55 * capMask);
        float moonRibbon = pow(ndh, 54.0) * 0.44 * smoothstep(0.46, 0.84, h0 * 0.62 + capMask * 0.38);
        float moonSheen  = pow(ndh, 15.0) * 0.068 * (0.55 + 0.45 * fres);
        float distSpecFade = 1.0 - smoothstep(75.0, 152.0, camDist) * 0.65;

        col += vec3(0.86, 0.92, 1.04) * moonGlint * distSpecFade;
        col += vec3(0.56, 0.68, 0.88) * moonRibbon * distSpecFade;
        col += vec3(0.24, 0.34, 0.52) * moonSheen * distSpecFade;

        // Gentle warm orange reflections near Shore Bonfire & Gorge Campfires
        float flick = 0.88 + 0.12 * sin(uTime * 7.4 + wp.x * 0.8 + wp.y * 0.5);
        if (uBonfireLit > 0.01) {
          col += evalWarmFireRefl(vec3(0.0, 1.45, 2.0), vWorldPos, N, V, flick, 1.10 * uBonfireLit);
          col += evalWarmFireRefl(vec3(-2.2, 1.55, 15.0), vWorldPos, N, V, flick, 1.05 * uBonfireLit);
        }
        col += evalWarmFireRefl(vec3(-3.3, 1.65, 41.5), vWorldPos, N, V, flick, 0.95);
        col += evalWarmFireRefl(vec3(-2.9, 1.75, 69.5), vWorldPos, N, V, flick, 0.95);
        col += evalWarmFireRefl(vec3(-3.8, 1.95, 95.0), vWorldPos, N, V, flick, 0.95);
        col += evalWarmFireRefl(vec3(5.10, 6.20, 82.0), vWorldPos, N, V, flick, 0.65);

        // Subtle dark shoreline ripple edge + waterfall plunge pool froth
        float poolD = length(wp - vec2(0.3, -10.8));
        float poolFoam = exp(-poolD * poolD * 0.115) * smoothstep(0.42, 0.80, h0) * 0.65;
        float lapWave = sin(uTime * 2.05 + wp.y * 0.72) * 0.005;
        float bankBand = 1.0 - smoothstep(0.010, 0.042 + lapWave, shoreEdge);
        float bankRipple = bankBand * smoothstep(0.54, 0.86, h0 * 0.65 + capMask * 0.35) * 0.24;
        float foam = clamp(poolFoam + bankRipple, 0.0, 0.62);
        col = mix(col, vec3(0.34, 0.46, 0.64), foam * 0.48);

        // Smooth distance mist blending into scene fog (#132032) so far river vanishes softly into the canyon
        float distMist = smoothstep(32.0, 148.0, camDist);
        float zHorizonMist = smoothstep(104.0, 156.0, vWorldPos.z);
        float totalMist = clamp(distMist * distMist * 0.90 + zHorizonMist * 0.48, 0.0, 0.96);
        col = mix(col, uFogColor, totalMist);

        // Smooth shoreline alpha + far-end vanish
        float edgeAlpha = smoothstep(0.010, 0.088, shoreEdge);
        float farFade = 1.0 - smoothstep(144.0, 158.0, vWorldPos.z);
        float alpha = clamp(edgeAlpha * farFade * (0.94 + foam * 0.06), 0.0, 0.97);
        if (alpha < 0.008) discard;

        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });
}

// ============================================================================
// 3. Layered Nocturnal Blue-Slate Valley Mist Rig (3 Cohesive Atmospheric Layers)
// ============================================================================
export function createValleyMistRig(THREE, opts = {}) {
  const {
    parentGroup = null,
    uTimeUniform = null,
    mistSpriteTex = null,
    isMobile = false,
    lowSpecMode = false,
    trackGeo = (g) => g,
    trackMat = (m) => m,
    evalGroundY = null
  } = opts;

  const group = new THREE.Group();
  group.name = 'GorgeValleyMistRig';
  if (parentGroup) parentGroup.add(group);

  const ownedGeos = [];
  const ownedMats = [];
  const ownedTex = [];

  const regGeo = (g) => {
    ownedGeos.push(g);
    return typeof trackGeo === 'function' ? trackGeo(g) : g;
  };
  const regMat = (m) => {
    ownedMats.push(m);
    return typeof trackMat === 'function' ? trackMat(m) : m;
  };

  const sharedTime = uTimeUniform || { value: 0.0 };
  const camPosUniform = { value: new THREE.Vector3(0, 2, 0) };
  const lowSpecUniform = { value: lowSpecMode ? 1.0 : 0.0 };

  let resolvedMistTex = mistSpriteTex;
  if (!resolvedMistTex) {
    resolvedMistTex = createWhiteFallbackTex(THREE);
    ownedTex.push(resolvedMistTex);
  }
  const hasMistTexVal = mistSpriteTex ? 1.0 : 0.0;

  // Helper to merge segmented PlaneGeometries with per-plane vec4 metadata attribute into 1 draw call
  function buildMergedMistPlanes(specs, attrName) {
    let totalVerts = 0;
    let totalIdx = 0;
    const geos = [];
    for (let i = 0; i < specs.length; i++) {
      const sp = specs[i];
      const g = new THREE.PlaneGeometry(sp.w, sp.h, sp.segX || 1, sp.segY || 1);
      if (sp.rx) g.rotateX(sp.rx);
      if (sp.ry) g.rotateY(sp.ry);
      if (sp.rz) g.rotateZ(sp.rz);
      g.translate(sp.x, sp.y, sp.z);
      totalVerts += g.attributes.position.count;
      totalIdx += g.index ? g.index.count : g.attributes.position.count;
      geos.push(g);
    }

    const posArr = new Float32Array(totalVerts * 3);
    const uvArr = new Float32Array(totalVerts * 2);
    const metaArr = new Float32Array(totalVerts * 4);
    const idxArr = new Uint32Array(totalIdx);

    let vOff = 0;
    let iOff = 0;
    for (let i = 0; i < geos.length; i++) {
      const g = geos[i];
      const sp = specs[i];
      const pAttr = g.attributes.position;
      const uAttr = g.attributes.uv;
      const count = pAttr.count;

      for (let v = 0; v < count; v++) {
        const vi = vOff + v;
        posArr[vi * 3]     = pAttr.getX(v);
        posArr[vi * 3 + 1] = pAttr.getY(v);
        posArr[vi * 3 + 2] = pAttr.getZ(v);
        uvArr[vi * 2]      = uAttr.getX(v);
        uvArr[vi * 2 + 1]  = uAttr.getY(v);
        metaArr[vi * 4]     = sp.meta[0];
        metaArr[vi * 4 + 1] = sp.meta[1];
        metaArr[vi * 4 + 2] = sp.meta[2];
        metaArr[vi * 4 + 3] = sp.meta[3];
      }

      if (g.index) {
        const gIdx = g.index.array;
        for (let k = 0; k < gIdx.length; k++) {
          idxArr[iOff++] = gIdx[k] + vOff;
        }
      } else {
        for (let k = 0; k < count; k++) {
          idxArr[iOff++] = k + vOff;
        }
      }
      vOff += count;
      g.dispose();
    }

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    merged.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
    merged.setAttribute(attrName, new THREE.BufferAttribute(metaArr, 4));
    merged.setIndex(new THREE.BufferAttribute(idxArr, 1));
    return regGeo(merged);
  }

  // --------------------------------------------------------------------------
  // Layer A: Low River Mist Sheets (8..12 drifting undulating sheets over river x=4..24, z=10..140, y=0.12..0.52)
  // --------------------------------------------------------------------------
  const riverSheetSpecsAll = [
    { x: 10.6, y: 0.16, z:  12.0, w: 15.0, h: 16.0, rx: -Math.PI * 0.5, ry:  0.14, segX: 4, segY: 4, meta: [0.11, 0.14, 0.85, 0.16] },
    { x: 11.4, y: 0.22, z:  24.0, w: 16.5, h: 17.5, rx: -Math.PI * 0.5, ry: -0.18, segX: 4, segY: 4, meta: [1.37, 0.15, 0.95, 0.22] },
    { x: 12.2, y: 0.18, z:  36.0, w: 17.0, h: 18.0, rx: -Math.PI * 0.5, ry:  0.10, segX: 4, segY: 4, meta: [2.63, 0.16, 0.80, 0.18] },
    { x: 13.8, y: 0.28, z:  48.0, w: 18.5, h: 19.0, rx: -Math.PI * 0.5, ry: -0.12, segX: 4, segY: 4, meta: [3.89, 0.17, 1.05, 0.28] },
    { x: 11.8, y: 0.24, z:  60.0, w: 18.0, h: 19.5, rx: -Math.PI * 0.5, ry:  0.20, segX: 4, segY: 4, meta: [5.15, 0.16, 0.90, 0.24] },
    { x: 10.4, y: 0.32, z:  72.0, w: 18.5, h: 20.0, rx: -Math.PI * 0.5, ry: -0.15, segX: 4, segY: 4, meta: [6.41, 0.17, 0.88, 0.32] },
    { x: 11.2, y: 0.30, z:  84.0, w: 19.0, h: 21.0, rx: -Math.PI * 0.5, ry:  0.08, segX: 4, segY: 4, meta: [7.67, 0.18, 1.00, 0.30] },
    { x: 13.2, y: 0.38, z:  96.0, w: 20.0, h: 21.5, rx: -Math.PI * 0.5, ry: -0.22, segX: 4, segY: 4, meta: [8.93, 0.18, 0.92, 0.38] },
    { x: 15.6, y: 0.40, z: 108.0, w: 21.0, h: 22.0, rx: -Math.PI * 0.5, ry:  0.16, segX: 4, segY: 4, meta: [10.19, 0.19, 0.86, 0.40] },
    { x: 16.8, y: 0.44, z: 120.0, w: 22.0, h: 23.0, rx: -Math.PI * 0.5, ry: -0.10, segX: 4, segY: 4, meta: [11.45, 0.19, 0.98, 0.44] },
    { x: 15.2, y: 0.48, z: 130.0, w: 23.0, h: 24.0, rx: -Math.PI * 0.5, ry:  0.12, segX: 4, segY: 4, meta: [12.71, 0.20, 0.82, 0.48] },
    { x: 14.0, y: 0.52, z: 139.0, w: 24.0, h: 24.0, rx: -Math.PI * 0.5, ry: -0.06, segX: 4, segY: 4, meta: [13.97, 0.20, 0.90, 0.52] }
  ];
  const riverSheetSpecs = (isMobile || lowSpecMode)
    ? [
        riverSheetSpecsAll[0],
        riverSheetSpecsAll[2],
        riverSheetSpecsAll[4],
        riverSheetSpecsAll[5],
        riverSheetSpecsAll[7],
        riverSheetSpecsAll[9],
        riverSheetSpecsAll[10],
        riverSheetSpecsAll[11]
      ]
    : riverSheetSpecsAll;

  const riverMistGeo = buildMergedMistPlanes(riverSheetSpecs, 'aMistMeta');
  const riverMistMat = regMat(new THREE.ShaderMaterial({
    uniforms: {
      uTime: sharedTime,
      uCamPos: camPosUniform,
      uLowSpec: lowSpecUniform
    },
    transparent: true,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
    vertexShader: `
      attribute vec4 aMistMeta;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec4 vMeta;
      void main() {
        vUv = uv;
        vMeta = aMistMeta;
        vec3 p = position;
        vec2 edgeD = uv * 2.0 - 1.0;
        float centerW = clamp(1.0 - dot(edgeD, edgeD), 0.0, 1.0);
        float driftPhase = uTime * 0.45 * aMistMeta.z + aMistMeta.x;
        p.y += (sin(p.x * 0.26 + driftPhase) * 0.065 + cos(p.z * 0.20 - driftPhase * 0.82) * 0.055) * centerW;
        vec4 localPos = vec4(p, 1.0);
        #ifdef USE_INSTANCING
          localPos = instanceMatrix * localPos;
        #endif
        vec4 wp = modelMatrix * localPos;
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uCamPos;
      uniform float uLowSpec;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec4 vMeta;

      float hash21(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 34.53);
        return fract(p.x * p.y);
      }

      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
          mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      float fbmMist(vec2 p, float lowSpec) {
        float n = vnoise(p) * 0.56 + vnoise(p * 2.15 + vec2(5.2, 11.4)) * 0.30;
        if (lowSpec < 0.5) {
          n += vnoise(p * 4.35 - vec2(8.1, 3.7)) * 0.14;
        }
        return n;
      }

      void main() {
        vec2 d = vUv * 2.0 - 1.0;
        float r2 = dot(d, d);
        if (r2 >= 0.98) discard;
        // Soft smooth elliptical falloff guarantees ZERO hard quad borders
        float radial = pow(clamp(1.0 - smoothstep(0.10, 0.98, sqrt(r2)), 0.0, 1.0), 1.45);

        float spd = vMeta.z;
        float seed = vMeta.x;
        vec2 flow1 = vWorldPos.xz * 0.13 + vec2(sin(uTime * 0.09 + seed) * 0.35, -uTime * 0.11 * spd);
        vec2 flow2 = vWorldPos.xz * 0.27 + vec2(-uTime * 0.06 * spd, -uTime * 0.16 * spd + seed);
        float w1 = fbmMist(flow1, uLowSpec);
        float w2 = fbmMist(flow2 + vec2(w1 * 0.65, -w1 * 0.42), uLowSpec);
        float wisp = smoothstep(0.26, 0.84, w1 * 0.55 + w2 * 0.45);

        // Gentle fade right at camera near zone so mist never clips abruptly
        float camDist = length(vWorldPos - uCamPos);
        float nearFade = smoothstep(3.2, 10.5, camDist);

        // Cool blue-slate moonlight tint centered on #5c789a (linear ~0.107, 0.188, 0.323)
        vec3 shadowMist = vec3(0.052, 0.088, 0.155);
        vec3 moonMist   = vec3(0.118, 0.194, 0.328);
        vec3 col = mix(shadowMist, moonMist, wisp);

        float alpha = radial * wisp * vMeta.y * nearFade;
        if (alpha < 0.004) discard;

        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  }));
  const riverMistMesh = new THREE.Mesh(riverMistGeo, riverMistMat);
  riverMistMesh.name = 'ValleyMistLayerA_RiverSheets';
  riverMistMesh.renderOrder = 2;
  riverMistMesh.frustumCulled = false;
  group.add(riverMistMesh);

  // --------------------------------------------------------------------------
  // Layer B: 7 Layered Gorge Atmospheric Depth Curtains (z = 48, 63, 78, 94, 112, 130, 150)
  //          Smoothly fade to 0 alpha when camera approaches within 14..28m!
  // --------------------------------------------------------------------------
  const curtainSpecs = [
    { x: 3.0, y:  6.2, z:  48.0, w: 52.0, h: 16.0, meta: [0.41, 0.165, 0.00, 0.72] },
    { x: 3.2, y:  7.2, z:  63.0, w: 56.0, h: 18.0, meta: [1.93, 0.195, 0.16, 0.80] },
    { x: 3.6, y:  7.8, z:  78.0, w: 60.0, h: 19.5, meta: [3.47, 0.215, 0.33, 0.85] },
    { x: 4.4, y:  8.6, z:  94.0, w: 64.0, h: 21.0, meta: [5.02, 0.235, 0.50, 0.90] },
    { x: 5.2, y:  9.6, z: 112.0, w: 68.0, h: 23.0, meta: [6.58, 0.255, 0.66, 0.95] },
    { x: 6.0, y: 10.2, z: 130.0, w: 72.0, h: 24.5, meta: [8.14, 0.270, 0.83, 1.00] },
    { x: 7.5, y: 11.2, z: 150.0, w: 76.0, h: 26.0, meta: [9.71, 0.285, 1.00, 1.08] }
  ];

  const curtainGeo = buildMergedMistPlanes(curtainSpecs, 'aCurtainMeta');
  const curtainMat = regMat(new THREE.ShaderMaterial({
    uniforms: {
      uTime: sharedTime,
      uCamPos: camPosUniform,
      uLowSpec: lowSpecUniform,
      uFogColor: { value: new THREE.Color(SCENE_FOG_HEX) }
    },
    transparent: true,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
    vertexShader: `
      attribute vec4 aCurtainMeta;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec4 vMeta;
      void main() {
        vUv = uv;
        vMeta = aCurtainMeta;
        vec4 localPos = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          localPos = instanceMatrix * localPos;
        #endif
        vec4 wp = modelMatrix * localPos;
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uCamPos;
      uniform float uLowSpec;
      uniform vec3 uFogColor;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec4 vMeta;

      float hash21(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 34.53);
        return fract(p.x * p.y);
      }

      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
          mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      float fbmCurtain(vec2 p, float lowSpec) {
        float n = vnoise(p) * 0.56 + vnoise(p * 2.05 + vec2(4.1, 7.9)) * 0.30;
        if (lowSpec < 0.5) {
          n += vnoise(p * 4.20 - vec2(6.5, 2.8)) * 0.14;
        }
        return n;
      }

      void main() {
        // Smooth camera-approach fade: 0.0 alpha within 14m, full atmospheric depth past 28m
        float zDist = abs(vWorldPos.z - uCamPos.z);
        float camFade = smoothstep(14.0, 28.0, zDist);
        if (camFade < 0.004) discard;

        // Soft top, bottom, and lateral feathering -> zero rectangular edges
        float sideFade = smoothstep(0.0, 0.25, vUv.x) * (1.0 - smoothstep(0.75, 1.0, vUv.x));
        float botFade  = smoothstep(0.0, 0.09, vUv.y);
        float topFade  = pow(1.0 - smoothstep(0.16, 0.96, vUv.y), 1.35);
        float env = sideFade * botFade * topFade;
        if (env < 0.004) discard;

        float seed = vMeta.x;
        float drift = uTime * 0.042 * vMeta.w;
        vec2 mUv1 = vec2(vUv.x * 3.8 + drift + seed, vUv.y * 2.2 - drift * 0.25);
        vec2 mUv2 = vec2(vUv.x * 7.6 - drift * 0.72 + seed * 1.7, vUv.y * 4.4 + drift * 0.30);
        float n1 = fbmCurtain(mUv1, uLowSpec);
        float n2 = fbmCurtain(mUv2 + vec2(n1 * 0.55, 0.0), uLowSpec);
        float veil = mix(0.46, 1.0, smoothstep(0.22, 0.84, n1 * 0.62 + n2 * 0.38));

        // Layered luminous moonlit blue-slate canyon mist (matches frame_00 & frame_07 valley haze!)
        float moonSide = smoothstep(-0.35, 0.75, (vWorldPos.x - 1.0) * 0.045);
        float depthRank = vMeta.z;
        vec3 deepSlate = mix(uFogColor * 1.35, vec3(0.085, 0.138, 0.228), 0.60);
        vec3 moonSlate = vec3(0.165, 0.245, 0.382);
        vec3 col = mix(deepSlate, moonSlate, clamp(moonSide * 0.55 + depthRank * 0.28 + (1.0 - vUv.y) * 0.18, 0.0, 1.0));

        float alpha = env * veil * vMeta.y * camFade;
        if (alpha < 0.004) discard;

        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  }));
  const curtainMesh = new THREE.Mesh(curtainGeo, curtainMat);
  curtainMesh.name = 'ValleyMistLayerB_DepthCurtains';
  curtainMesh.renderOrder = 3;
  curtainMesh.frustumCulled = false;
  group.add(curtainMesh);

  // --------------------------------------------------------------------------
  // Layer C: Subtle Road Ground Mist Drift (4..6 low ground-hugging wisps across road & tree roots, z = 34..92)
  // --------------------------------------------------------------------------
  const sampleRoadY = typeof evalGroundY === 'function' ? evalGroundY : (_x, z) => approxGorgeRoadY(z);
  const roadWispRaw = [
    { x: -2.4, yOff: 0.16, z: 36.5, w:  8.5, h:  8.0, ry:  0.22, seed: 0.7, alpha: 0.095, spd: 0.78 },
    { x:  0.8, yOff: 0.12, z: 46.5, w:  9.5, h:  8.5, ry: -0.30, seed: 2.1, alpha: 0.085, spd: 0.85 },
    { x: -0.9, yOff: 0.24, z: 57.0, w: 10.0, h:  9.0, ry:  0.14, seed: 3.9, alpha: 0.100, spd: 0.72 },
    { x: -1.8, yOff: 0.18, z: 68.5, w:  9.5, h:  9.0, ry: -0.18, seed: 5.4, alpha: 0.092, spd: 0.88 },
    { x: -0.4, yOff: 0.30, z: 80.5, w: 10.5, h:  9.5, ry:  0.26, seed: 7.2, alpha: 0.105, spd: 0.80 },
    { x: -1.6, yOff: 0.34, z: 90.5, w: 10.0, h:  9.0, ry: -0.12, seed: 8.8, alpha: 0.095, spd: 0.75 }
  ];
  const roadWispActive = (isMobile || lowSpecMode)
    ? [roadWispRaw[0], roadWispRaw[2], roadWispRaw[3], roadWispRaw[5]]
    : roadWispRaw;

  const roadWispSpecs = roadWispActive.map((rw) => ({
    x: rw.x,
    y: sampleRoadY(rw.x, rw.z) + rw.yOff,
    z: rw.z,
    w: rw.w,
    h: rw.h,
    rx: -Math.PI * 0.5,
    ry: rw.ry,
    segX: 2,
    segY: 2,
    meta: [rw.seed, rw.alpha, rw.spd, rw.yOff]
  }));

  const roadMistGeo = buildMergedMistPlanes(roadWispSpecs, 'aWispMeta');
  const roadMistMat = regMat(new THREE.ShaderMaterial({
    uniforms: {
      uTime: sharedTime,
      uCamPos: camPosUniform,
      uMistTex: { value: resolvedMistTex },
      uHasTex: { value: hasMistTexVal }
    },
    transparent: true,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
    vertexShader: `
      attribute vec4 aWispMeta;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec4 vMeta;
      void main() {
        vUv = uv;
        vMeta = aWispMeta;
        vec3 p = position;
        float ph = uTime * 0.42 * aWispMeta.z + aWispMeta.x;
        p.x += sin(ph) * 0.55;
        p.y += sin(ph * 1.25 + p.z * 0.3) * 0.04;
        vec4 localPos = vec4(p, 1.0);
        #ifdef USE_INSTANCING
          localPos = instanceMatrix * localPos;
        #endif
        vec4 wp = modelMatrix * localPos;
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uCamPos;
      uniform sampler2D uMistTex;
      uniform float uHasTex;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec4 vMeta;

      float hash21(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 34.53);
        return fract(p.x * p.y);
      }

      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
          mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      void main() {
        vec2 d = vUv * 2.0 - 1.0;
        float r = length(d);
        if (r >= 0.98) discard;
        float radial = pow(clamp(1.0 - smoothstep(0.12, 0.98, r), 0.0, 1.0), 1.55);

        float seed = vMeta.x;
        float spd = vMeta.z;
        float n1 = vnoise(vUv * 3.4 + vec2(uTime * 0.07 * spd + seed, -uTime * 0.05 * spd));
        float n2 = vnoise(vUv * 6.8 - vec2(uTime * 0.09 * spd, uTime * 0.06 * spd + seed));
        float wisp = smoothstep(0.28, 0.84, n1 * 0.62 + n2 * 0.38);

        float texMask = mix(1.0, texture2D(uMistTex, vUv).a, uHasTex * 0.55);
        float camDist = length(vWorldPos - uCamPos);
        float nearFade = smoothstep(2.2, 6.0, camDist);

        vec3 col = mix(vec3(0.060, 0.098, 0.168), vec3(0.105, 0.172, 0.285), wisp);
        float alpha = radial * wisp * texMask * vMeta.y * nearFade;
        if (alpha < 0.004) discard;

        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  }));
  const roadMistMesh = new THREE.Mesh(roadMistGeo, roadMistMat);
  roadMistMesh.name = 'ValleyMistLayerC_RoadWisps';
  roadMistMesh.renderOrder = 2;
  roadMistMesh.frustumCulled = false;
  group.add(roadMistMesh);

  function update(elapsed, cameraPos) {
    if (Number.isFinite(elapsed)) {
      sharedTime.value = elapsed;
    }
    if (cameraPos && Number.isFinite(cameraPos.x) && Number.isFinite(cameraPos.y) && Number.isFinite(cameraPos.z)) {
      camPosUniform.value.set(cameraPos.x, cameraPos.y, cameraPos.z);
    }
  }

  function setLowSpec(flag) {
    const low = Boolean(flag);
    lowSpecUniform.value = low ? 1.0 : 0.0;
    roadMistMesh.visible = !low;
  }

  function dispose() {
    for (let i = 0; i < ownedGeos.length; i++) ownedGeos[i]?.dispose?.();
    for (let i = 0; i < ownedMats.length; i++) ownedMats[i]?.dispose?.();
    for (let i = 0; i < ownedTex.length; i++) ownedTex[i]?.dispose?.();
    ownedGeos.length = 0;
    ownedMats.length = 0;
    ownedTex.length = 0;
    if (group.parent) group.parent.remove(group);
  }

  return {
    group,
    update,
    setLowSpec,
    dispose
  };
}

// ============================================================================
// 4. Reusable Dark Souls / Frame-00 Fiery Smoky Campfire VFX Rig
// ============================================================================
export function createCampfireVfxRig(THREE, opts = {}) {
  const {
    parentGroup = null,
    uTimeUniform = null,
    mistSpriteTex = null,
    isMobile = false,
    lowSpecMode = false,
    trackGeo = (g) => g,
    trackMat = (m) => m
  } = opts;

  const group = new THREE.Group();
  group.name = 'GorgeCampfireVfxRig';
  if (parentGroup) parentGroup.add(group);

  const ownedGeos = [];
  const ownedMats = [];
  const ownedTex = [];

  const regGeo = (g) => {
    ownedGeos.push(g);
    return typeof trackGeo === 'function' ? trackGeo(g) : g;
  };
  const regMat = (m) => {
    ownedMats.push(m);
    return typeof trackMat === 'function' ? trackMat(m) : m;
  };

  const sharedTime = uTimeUniform || { value: 0.0 };
  const lowSpecUniform = { value: lowSpecMode ? 1.0 : 0.0 };

  let resolvedMistTex = mistSpriteTex;
  if (!resolvedMistTex) {
    resolvedMistTex = createWhiteFallbackTex(THREE);
    ownedTex.push(resolvedMistTex);
  }
  const hasMistTexVal = mistSpriteTex ? 1.0 : 0.0;

  // --------------------------------------------------------------------------
  // Shared Unit Geometries (Reused across every campfire added to the rig -> Minimal VRAM!)
  // --------------------------------------------------------------------------

  // (a) Displaced 3D Ember Mound (r = 0.44, h = 0.14, lumpy charred coal topology)
  function buildEmberMoundGeo() {
    const radialSegs = isMobile ? 14 : 20;
    const rings = isMobile ? 4 : 6;
    const radius = 0.44;
    const height = 0.14;
    const vertCount = 1 + rings * radialSegs;
    const pos = new Float32Array(vertCount * 3);
    const uv = new Float32Array(vertCount * 2);
    const radialAttr = new Float32Array(vertCount);
    const indices = [];

    // Center vertex
    pos[0] = 0.0;
    pos[1] = height;
    pos[2] = 0.0;
    uv[0] = 0.5;
    uv[1] = 0.5;
    radialAttr[0] = 0.0;

    let vi = 1;
    for (let r = 1; r <= rings; r++) {
      const rf = r / rings;
      const dome = Math.cos(rf * Math.PI * 0.5);
      for (let s = 0; s < radialSegs; s++) {
        const ang = (s / radialSegs) * Math.PI * 2.0;
        const cs = Math.cos(ang);
        const sn = Math.sin(ang);
        // Organic charred coal lump displacement (zero smooth plastic dome)
        const lump =
          Math.sin(ang * 5.0 + rf * 6.0) * 0.018 +
          Math.cos(ang * 9.0 - rf * 4.5) * 0.012 +
          Math.sin(ang * 13.0 + rf * 9.0) * 0.006;
        const radJitter = 1.0 + Math.sin(ang * 4.0 + 0.8) * 0.055 + Math.cos(ang * 7.0) * 0.035;
        const rr = radius * rf * radJitter;
        const y = rf >= 0.999 ? -0.022 : Math.max(-0.015, height * Math.pow(dome, 0.82) + lump * (1.0 - rf * 0.72));

        pos[vi * 3]     = cs * rr;
        pos[vi * 3 + 1] = y;
        pos[vi * 3 + 2] = sn * rr;
        uv[vi * 2]      = 0.5 + cs * rf * 0.5;
        uv[vi * 2 + 1]  = 0.5 + sn * rf * 0.5;
        radialAttr[vi]  = rf;
        vi++;
      }
    }

    // Center fan
    for (let s = 0; s < radialSegs; s++) {
      const nextS = (s + 1) % radialSegs;
      indices.push(0, 1 + nextS, 1 + s);
    }
    // Outer rings
    for (let r = 0; r < rings - 1; r++) {
      const ringA = 1 + r * radialSegs;
      const ringB = 1 + (r + 1) * radialSegs;
      for (let s = 0; s < radialSegs; s++) {
        const nextS = (s + 1) % radialSegs;
        const a0 = ringA + s;
        const a1 = ringA + nextS;
        const b0 = ringB + s;
        const b1 = ringB + nextS;
        indices.push(a0, a1, b1, a0, b1, b0);
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('aRadial', new THREE.BufferAttribute(radialAttr, 1));
    g.setIndex(indices);
    g.computeVertexNormals();
    return regGeo(g);
  }

  // (b) Crossed Curved Multi-Layered Flame Shells (4 outer curved cards + 2 inner bright core cards)
  function buildFlameShellsGeo() {
    const specs = [
      { w: 0.74, h: 1.24, ry: 0.00, ox:  0.00, oz:  0.00, bow: 0.13, phase: 0.00, core: 0.0 },
      { w: 0.70, h: 1.18, ry: 0.79, ox:  0.03, oz: -0.02, bow: 0.12, phase: 1.45, core: 0.0 },
      { w: 0.72, h: 1.22, ry: 1.57, ox: -0.03, oz:  0.03, bow: 0.13, phase: 2.90, core: 0.0 },
      { w: 0.68, h: 1.12, ry: 2.36, ox:  0.02, oz:  0.04, bow: 0.11, phase: 4.35, core: 0.0 },
      // Inner luminous golden-white flame core shells
      { w: 0.42, h: 0.78, ry: 0.40, ox:  0.00, oz:  0.00, bow: 0.07, phase: 5.50, core: 1.0 },
      { w: 0.40, h: 0.74, ry: 1.97, ox:  0.00, oz:  0.00, bow: 0.07, phase: 6.75, core: 1.0 }
    ];

    const segX = 4;
    const segY = isMobile ? 7 : 10;
    const vertsPerCard = (segX + 1) * (segY + 1);
    const trisPerCard = segX * segY * 6;
    const posArr = new Float32Array(specs.length * vertsPerCard * 3);
    const uvArr = new Float32Array(specs.length * vertsPerCard * 2);
    const cardAttr = new Float32Array(specs.length * vertsPerCard * 2); // x: cardPhase, y: isInnerCore
    const idxArr = new Uint32Array(specs.length * trisPerCard);

    let vOff = 0;
    let iOff = 0;
    for (let k = 0; k < specs.length; k++) {
      const sp = specs[k];
      const plane = new THREE.PlaneGeometry(sp.w, sp.h, segX, segY);
      const pAttr = plane.attributes.position;
      const uAttr = plane.attributes.uv;

      // Taper upward and curve outward into an organic teardrop flame shell
      for (let vi = 0; vi < pAttr.count; vi++) {
        const lx = pAttr.getX(vi);
        const ly = pAttr.getY(vi) + sp.h * 0.5; // pivot at flame base y = 0
        const hFrac = clamp01(ly / sp.h);
        const nx = lx / Math.max(0.001, sp.w * 0.5);
        const taper = 1.0 - smoothstepJS(0.18, 1.0, hFrac) * 0.52;
        const bulge = Math.sin(hFrac * Math.PI) * (1.0 - nx * nx) * sp.bow;
        pAttr.setXYZ(vi, lx * taper, ly, bulge);
      }
      plane.rotateY(sp.ry);
      plane.translate(sp.ox, 0.06, sp.oz);

      for (let vi = 0; vi < pAttr.count; vi++) {
        const dst = vOff + vi;
        posArr[dst * 3]     = pAttr.getX(vi);
        posArr[dst * 3 + 1] = pAttr.getY(vi);
        posArr[dst * 3 + 2] = pAttr.getZ(vi);
        uvArr[dst * 2]      = uAttr.getX(vi);
        uvArr[dst * 2 + 1]  = uAttr.getY(vi);
        cardAttr[dst * 2]     = sp.phase;
        cardAttr[dst * 2 + 1] = sp.core;
      }

      const gIdx = plane.index.array;
      for (let j = 0; j < gIdx.length; j++) {
        idxArr[iOff++] = gIdx[j] + vOff;
      }
      vOff += pAttr.count;
      plane.dispose();
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
    g.setAttribute('aCardMeta', new THREE.BufferAttribute(cardAttr, 2));
    g.setIndex(new THREE.BufferAttribute(idxArr, 1));
    return regGeo(g);
  }

  // (b2) Soft Flame Glow Aura Billboard Quad
  function buildFlameAuraGeo() {
    return regGeo(new THREE.PlaneGeometry(1.75, 1.55, 1, 1));
  }

  // (c) Prominent Billowing Rising Smoke Plume (12 GPU-billboarded puffs desktop / 6 mobile or lowSpec)
  function buildSmokePlumeGeo() {
    const puffCount = (isMobile || lowSpecMode) ? 6 : 12;
    const rng = makeRng(441907);
    const pos = new Float32Array(puffCount * 4 * 3);
    const uv = new Float32Array(puffCount * 4 * 2);
    const corner = new Float32Array(puffCount * 4 * 2);
    const seed = new Float32Array(puffCount * 4 * 4); // x: phase0, y: riseSpeed, z: sizeMul, w: rotDir
    const indices = new Uint16Array(puffCount * 6);

    const corners = [
      [-0.5, -0.5, 0, 0],
      [ 0.5, -0.5, 1, 0],
      [ 0.5,  0.5, 1, 1],
      [-0.5,  0.5, 0, 1]
    ];

    for (let i = 0; i < puffCount; i++) {
      // Evenly stratified base phases + small organic jitter -> continuous unbroken billowing column
      const p0 = (i / puffCount) + (rng() - 0.5) * (0.38 / puffCount);
      const speed = 0.165 + rng() * 0.055;
      const sizeMul = 0.84 + rng() * 0.42;
      const rotDir = (i % 2 === 0 ? 1.0 : -1.0) * (0.45 + rng() * 0.55);

      const baseV = i * 4;
      for (let c = 0; c < 4; c++) {
        const vi = baseV + c;
        pos[vi * 3]     = 0.0;
        pos[vi * 3 + 1] = 0.0;
        pos[vi * 3 + 2] = 0.0;
        uv[vi * 2]      = corners[c][2];
        uv[vi * 2 + 1]  = corners[c][3];
        corner[vi * 2]     = corners[c][0];
        corner[vi * 2 + 1] = corners[c][1];
        seed[vi * 4]     = p0 < 0 ? p0 + 1.0 : p0;
        seed[vi * 4 + 1] = speed;
        seed[vi * 4 + 2] = sizeMul;
        seed[vi * 4 + 3] = rotDir;
      }

      const baseI = i * 6;
      indices[baseI]     = baseV;
      indices[baseI + 1] = baseV + 1;
      indices[baseI + 2] = baseV + 2;
      indices[baseI + 3] = baseV;
      indices[baseI + 4] = baseV + 2;
      indices[baseI + 5] = baseV + 3;
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('aQuadCorner', new THREE.BufferAttribute(corner, 2));
    g.setAttribute('aPuffSeed', new THREE.BufferAttribute(seed, 4));
    g.setIndex(new THREE.BufferAttribute(indices, 1));
    // Generous bounding sphere so frustum culling never clips the rising smoke plume
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0.4, 2.4, 0.0), 4.5);
    return regGeo(g);
  }

  // (d) Rising Glowing Embers / Fire Sparks GPU Points
  function buildSparksGeo() {
    const count = (isMobile || lowSpecMode) ? 14 : 28;
    const rng = makeRng(991231);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count * 4); // x: phase0, y: speed, z: spiralRad, w: sizeMul
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = 0.0;
      pos[i * 3 + 1] = 0.0;
      pos[i * 3 + 2] = 0.0;
      seed[i * 4]     = rng();
      seed[i * 4 + 1] = 0.24 + rng() * 0.26;
      seed[i * 4 + 2] = 0.14 + rng() * 0.36;
      seed[i * 4 + 3] = 0.72 + rng() * 0.85;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSparkSeed', new THREE.BufferAttribute(seed, 4));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0.35, 2.2, 0.0), 3.8);
    return regGeo(g);
  }

  // (e) Ground Bounce Pool Disc
  function buildGroundPoolGeo() {
    const g = new THREE.CircleGeometry(2.85, isMobile ? 18 : 26);
    g.rotateX(-Math.PI * 0.5);
    return regGeo(g);
  }

  const sharedEmberGeo = buildEmberMoundGeo();
  const sharedFlameGeo = buildFlameShellsGeo();
  const sharedAuraGeo = buildFlameAuraGeo();
  const sharedSmokeGeo = buildSmokePlumeGeo();
  const sharedSparksGeo = buildSparksGeo();
  const sharedGroundPoolGeo = buildGroundPoolGeo();

  const campfires = [];

  // --------------------------------------------------------------------------
  // Factory: addCampfire(x, y, z, opts = {})
  // --------------------------------------------------------------------------
  function addCampfire(x, y, z, cfOpts = {}) {
    const {
      scale = 1.0,
      litUniform = { value: 1.0 },
      phase = 0.0,
      addPointLight = true,
      lightIntensity = 5.2,
      lightDistance = 17.0
    } = cfOpts;

    const cfRoot = new THREE.Group();
    cfRoot.name = `CampfireVfx_${campfires.length}`;
    cfRoot.position.set(x, y, z);
    group.add(cfRoot);

    const phaseUniform = { value: phase };
    const scaleUniform = { value: scale };

    // a) Glowing 3D Red-Orange Ember Mound (molten orange-red cracks beneath dark charred charcoal crust)
    const emberMat = regMat(new THREE.ShaderMaterial({
      uniforms: {
        uTime: sharedTime,
        uLit: litUniform,
        uPhase: phaseUniform
      },
      transparent: false,
      depthWrite: true,
      fog: false,
      vertexShader: `
        attribute float aRadial;
        varying vec2 vUv;
        varying float vRadial;
        varying vec3 vNormalW;
        void main() {
          vUv = uv;
          vRadial = aRadial;
          vNormalW = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uLit;
        uniform float uPhase;
        varying vec2 vUv;
        varying float vRadial;
        varying vec3 vNormalW;

        vec2 hash22(vec2 p) {
          p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
          return fract(sin(p) * 43758.5453);
        }

        // Cellular Voronoi distance to edge -> realistic cracked glowing charcoal chunks!
        vec2 coalVoronoi(vec2 p) {
          vec2 n = floor(p);
          vec2 f = fract(p);
          float d1 = 8.0;
          float d2 = 8.0;
          float cellId = 0.0;
          for (int j = -1; j <= 1; j++) {
            for (int i = -1; i <= 1; i++) {
              vec2 g = vec2(float(i), float(j));
              vec2 o = hash22(n + g);
              vec2 r = g + o - f;
              float d = dot(r, r);
              if (d < d1) {
                d2 = d1;
                d1 = d;
                cellId = o.x;
              } else if (d < d2) {
                d2 = d;
              }
            }
          }
          float edge = sqrt(d2) - sqrt(d1);
          return vec2(edge, cellId);
        }

        void main() {
          vec2 p = vUv * 8.5 + vec2(uPhase * 0.7, -uPhase * 0.4);
          vec2 v1 = coalVoronoi(p);
          vec2 v2 = coalVoronoi(p * 1.9 + vec2(3.1, 5.7));

          // Molten cracks between dark charred coal chunks
          float crackPrimary = 1.0 - smoothstep(0.02, 0.24, v1.x);
          float crackFine    = 1.0 - smoothstep(0.015, 0.16, v2.x);
          float crackMask    = clamp(crackPrimary * 0.85 + crackFine * 0.45, 0.0, 1.0);

          // Radial hearth core intensity (hottest under logs, cooling to soot at outer stone ring)
          float coreMask = 1.0 - smoothstep(0.18, 0.96, vRadial);
          float pulse = 0.76
                      + 0.16 * sin(uTime * 4.2 + v1.y * 12.0 + uPhase)
                      + 0.08 * cos(uTime * 9.1 - v2.y * 15.0 + uPhase * 1.4);

          float heat = clamp((crackMask * 0.86 + 0.16 * (1.0 - v1.x)) * coreMask * pulse * uLit, 0.0, 1.0);
          float hotCore = pow(clamp(crackMask * (1.0 - smoothstep(0.0, 0.62, vRadial)) * pulse * uLit, 0.0, 1.0), 1.45);

          // Charred dark charcoal crust with faint nocturnal moon rim
          vec3 moonL = ${CANONICAL_MOON_DIR_GLSL};
          float moonRim = max(dot(normalize(vNormalW), moonL), 0.0);
          vec3 charcoalCol = vec3(0.010, 0.011, 0.014) + vec3(0.016, 0.022, 0.032) * moonRim;

          // Molten orange-red (#ff2800 .. #ff8a20) pulsing fire veins
          vec3 emberRed    = vec3(1.15, 0.035, 0.004);
          vec3 emberOrange = vec3(2.15, 0.46, 0.035);
          vec3 emberGold   = vec3(2.85, 1.18, 0.18);

          vec3 glowCol = mix(emberRed, emberOrange, smoothstep(0.18, 0.68, heat));
          glowCol = mix(glowCol, emberGold, smoothstep(0.45, 0.95, hotCore));

          vec3 col = mix(charcoalCol, glowCol, smoothstep(0.06, 0.58, heat));
          // Ashy soot rim smoothly grounds mound into stone hearth
          col = mix(vec3(0.014, 0.015, 0.018), col, 1.0 - smoothstep(0.84, 1.0, vRadial));

          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `
    }));
    const emberMesh = new THREE.Mesh(sharedEmberGeo, emberMat);
    emberMesh.scale.setScalar(scale);
    emberMesh.position.y = 0.01 * scale;
    emberMesh.renderOrder = 1;
    cfRoot.add(emberMesh);

    // b) Rich Multi-Layered Organic Flame (crossed curved flame shells + inner core)
    const flameMat = regMat(new THREE.ShaderMaterial({
      uniforms: {
        uTime: sharedTime,
        uLit: litUniform,
        uPhase: phaseUniform,
        uLowSpec: lowSpecUniform
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      fog: false,
      vertexShader: `
        attribute vec2 aCardMeta;
        uniform float uTime;
        uniform float uLit;
        uniform float uPhase;
        varying vec2 vUv;
        varying vec2 vCardMeta;
        void main() {
          vUv = uv;
          vCardMeta = aCardMeta;
          vec3 p = position;
          float h = clamp(uv.y, 0.0, 1.0);
          float ph = aCardMeta.x + uPhase;
          float litScale = 0.12 + 0.88 * clamp(uLit, 0.0, 1.0);
          // Turbulent organic sway + slight breeze lean (+X toward river matching smoke column)
          float swayX = (sin(uTime * 6.4 - h * 5.8 + ph) * 0.14 + sin(uTime * 11.8 - h * 9.4 + ph * 1.6) * 0.05) * h * h
                      + 0.085 * h * h;
          float swayZ = (cos(uTime * 5.6 - h * 5.2 - ph) * 0.12 + cos(uTime * 10.2 - h * 8.6 + ph) * 0.045) * h * h;
          float stretch = 0.94 + 0.10 * sin(uTime * 8.8 + ph);
          p.x += swayX;
          p.z += swayZ;
          p.y *= litScale * stretch;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uLit;
        uniform float uPhase;
        uniform float uLowSpec;
        varying vec2 vUv;
        varying vec2 vCardMeta;

        float hash21(vec2 p) {
          p = fract(p * vec2(127.1, 311.7));
          p += dot(p, p + 34.53);
          return fract(p.x * p.y);
        }

        float vnoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
            mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }

        void main() {
          if (uLit < 0.015) discard;
          float seed = vCardMeta.x + uPhase;
          float isCore = vCardMeta.y;
          float cx = abs(vUv.x - 0.5) * 2.0;

          // Multi-octave upward-licking turbulent flame noise
          float t = uTime;
          float n1 = vnoise(vec2(vUv.x * 3.8 + seed, vUv.y * 3.4 - t * 4.2));
          float n2 = vnoise(vec2(vUv.x * 8.4 - seed * 1.3, vUv.y * 7.2 - t * 7.4));
          float n3 = uLowSpec < 0.5 ? vnoise(vec2(vUv.x * 15.0 + seed * 0.7, vUv.y * 12.5 - t * 10.6)) : 0.5;
          float turb = n1 * 0.48 + n2 * 0.34 + n3 * 0.18;

          // Organic separated licking flame tongues (zero hard cone/triangle silhouette)
          float widthTaper = mix(0.92, 1.28, vUv.y);
          float tongueShape = turb + (1.0 - vUv.y) * 0.46 - cx * cx * widthTaper;
          float tongueMask = smoothstep(0.24, 0.78, tongueShape);
          float baseSoft = smoothstep(0.0, 0.12, vUv.y);
          float tipBreak = 1.0 - smoothstep(0.30, 0.98, vUv.y + (0.50 - turb) * 0.68);
          float mask = tongueMask * baseSoft * tipBreak;
          if (mask < 0.015) discard;

          // Physical blackbody ramp: bright gold-white core -> rich amber-orange body -> deep fiery red tips
          float coreFactor = (1.0 - smoothstep(0.0, 0.52, vUv.y)) * (1.0 - smoothstep(0.0, 0.65, cx));
          float heat = clamp(mask * (1.04 - vUv.y * 0.82) + (turb - 0.48) * 0.28 + coreFactor * 0.28 + isCore * 0.26, 0.0, 1.0);

          vec3 redTip     = vec3(1.25, 0.14, 0.012);
          vec3 amberBody  = vec3(2.35, 0.76, 0.085);
          vec3 goldCore   = vec3(3.25, 2.15, 0.78);

          vec3 col = mix(redTip, amberBody, smoothstep(0.08, 0.52, heat));
          col = mix(col, goldCore, smoothstep(0.56, 0.94, heat));

          float alpha = mask * mix(0.68, 0.88, isCore) * clamp(uLit, 0.0, 1.0);
          gl_FragColor = vec4(col, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `
    }));
    const flameMesh = new THREE.Mesh(sharedFlameGeo, flameMat);
    flameMesh.scale.set(scale * 1.32, scale * 1.56, scale * 1.32);
    flameMesh.position.y = 0.08 * scale;
    flameMesh.renderOrder = 5;
    cfRoot.add(flameMesh);

    // b2) Soft Volumetric Warm Fire Aura Halo around the flame core
    const auraMat = regMat(new THREE.ShaderMaterial({
      uniforms: {
        uTime: sharedTime,
        uLit: litUniform,
        uPhase: phaseUniform,
        uScale: scaleUniform
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      vertexShader: `
        uniform float uScale;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec4 mv = modelViewMatrix * vec4(0.0, 0.52 * uScale, 0.0, 1.0);
          mv.xy += position.xy * uScale;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uLit;
        uniform float uPhase;
        varying vec2 vUv;
        void main() {
          if (uLit < 0.015) discard;
          float d = length(vUv * 2.0 - 1.0);
          if (d >= 1.0) discard;
          float flick = 0.86 + 0.14 * sin(uTime * 8.2 + uPhase) * cos(uTime * 5.4 - uPhase * 0.7);
          float glow = exp(-d * d * 4.4) * (1.0 - smoothstep(0.58, 1.0, d));
          vec3 col = mix(vec3(0.95, 0.24, 0.03), vec3(1.38, 0.66, 0.16), exp(-d * d * 5.5));
          gl_FragColor = vec4(col * flick, glow * 0.30 * clamp(uLit, 0.0, 1.0));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `
    }));
    const auraMesh = new THREE.Mesh(sharedAuraGeo, auraMat);
    auraMesh.renderOrder = 4;
    cfRoot.add(auraMesh);

    // c) Prominent Billowing Rising Smoke Plume (warm fire under-lighting y < 1.9 fading into moonlit slate-grey!)
    const smokeMat = regMat(new THREE.ShaderMaterial({
      uniforms: {
        uTime: sharedTime,
        uLit: litUniform,
        uPhase: phaseUniform,
        uScale: scaleUniform,
        uMistTex: { value: resolvedMistTex },
        uHasTex: { value: hasMistTexVal }
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      fog: false,
      vertexShader: `
        attribute vec2 aQuadCorner;
        attribute vec4 aPuffSeed;
        uniform float uTime;
        uniform float uScale;
        uniform float uPhase;
        varying vec2 vUv;
        varying float vCyc;
        varying float vLocalY;
        varying float vSeed;
        void main() {
          vUv = uv;
          float cyc = fract(aPuffSeed.x + uTime * aPuffSeed.y + uPhase * 0.13);
          vCyc = cyc;
          vSeed = aPuffSeed.x;

          // Continuous rise from y + 0.35 to y + 4.4 * scale with gentle wind drift (+0.55 toward +X river) & swirl
          float riseY = (0.35 + cyc * 4.05) * uScale;
          vLocalY = riseY;
          float swirlAng = aPuffSeed.x * 6.28318 + uTime * 0.95 * aPuffSeed.w + cyc * 3.1;
          float swirlRad = (0.08 + cyc * 0.34) * uScale;
          float windX = (0.55 * pow(cyc, 1.25) + sin(uTime * 0.65 + aPuffSeed.x * 9.0) * 0.12 * cyc) * uScale;
          vec3 center = vec3(
            windX + cos(swirlAng) * swirlRad,
            riseY,
            sin(swirlAng) * swirlRad * 0.85
          );

          // Expanding billowing puff size + gentle spin (prominent roadside smoke column matching frame_00!)
          float puffSize = mix(0.76, 2.20, pow(cyc, 0.72)) * aPuffSeed.z * uScale;
          float rot = aPuffSeed.x * 6.28318 + uTime * 0.38 * aPuffSeed.w + cyc * 1.4;
          float cr = cos(rot);
          float sr = sin(rot);
          vec2 rotCorner = vec2(
            aQuadCorner.x * cr - aQuadCorner.y * sr,
            aQuadCorner.x * sr + aQuadCorner.y * cr
          );

          vec4 mvCenter = modelViewMatrix * vec4(center, 1.0);
          mvCenter.xy += rotCorner * puffSize;
          gl_Position = projectionMatrix * mvCenter;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uLit;
        uniform float uPhase;
        uniform float uScale;
        uniform sampler2D uMistTex;
        uniform float uHasTex;
        varying vec2 vUv;
        varying float vCyc;
        varying float vLocalY;
        varying float vSeed;

        float hash21(vec2 p) {
          p = fract(p * vec2(127.1, 311.7));
          p += dot(p, p + 34.53);
          return fract(p.x * p.y);
        }

        float vnoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
            mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }

        void main() {
          if (uLit < 0.015) discard;
          vec2 d = vUv * 2.0 - 1.0;
          float r = length(d);
          if (r >= 0.98) discard;

          // Billowing internal cloud structure
          float n1 = vnoise(vUv * 3.2 + vec2(vSeed * 11.0, -uTime * 0.35));
          float n2 = vnoise(vUv * 6.4 - vec2(uTime * 0.28, vSeed * 7.0));
          float billow = smoothstep(0.20, 0.85, n1 * 0.62 + n2 * 0.38);

          float radial = pow(clamp(1.0 - smoothstep(0.08, 0.96, r), 0.0, 1.0), 1.35);
          float spriteA = mix(1.0, texture2D(uMistTex, vUv).a, uHasTex * 0.65);

          // Lifecycle envelope: smooth birth above flames, prominent billowing mid-column, soft upper fade
          float life = smoothstep(0.0, 0.14, vCyc) * (1.0 - smoothstep(0.52, 1.0, vCyc));
          float alpha = radial * spriteA * (0.48 + 0.52 * billow) * life * 0.62 * clamp(uLit, 0.0, 1.0);
          if (alpha < 0.005) discard;

          // Warm orange fire under-lighting (strong for y < 2.2 * scale, stronger on underside of each puff!)
          float fireProx = 1.0 - smoothstep(0.35 * uScale, 2.35 * uScale, vLocalY);
          float underside = clamp(1.0 - vUv.y * 1.08 + 0.25, 0.0, 1.0);
          float flick = 0.88 + 0.12 * sin(uTime * 7.8 + uPhase + vSeed * 6.0);
          float warmMask = clamp(fireProx * (0.52 + 0.48 * underside), 0.0, 1.0);

          // Moonlit slate-grey smoke higher up matching nocturnal sky & frame_00 roadside plume
          vec3 darkSmoke   = vec3(0.065, 0.092, 0.138);
          vec3 moonSmoke   = vec3(0.165, 0.228, 0.335);
          vec3 fireLitLow  = vec3(1.18, 0.46, 0.105) * flick;
          vec3 fireCoreLow = vec3(1.75, 0.78, 0.20) * flick;

          vec3 upperCol = mix(darkSmoke, moonSmoke, clamp(vUv.y * 0.55 + billow * 0.45, 0.0, 1.0));
          vec3 warmCol = mix(fireLitLow, fireCoreLow, clamp(fireProx * underside * billow, 0.0, 1.0));
          vec3 col = mix(upperCol, warmCol, warmMask * 0.88);

          gl_FragColor = vec4(col, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `
    }));
    const smokeMesh = new THREE.Mesh(sharedSmokeGeo, smokeMat);
    smokeMesh.renderOrder = 3;
    smokeMesh.frustumCulled = false;
    cfRoot.add(smokeMesh);

    // d) Rising Embers / Fire Sparks (lightweight GPU-animated THREE.Points)
    const sparksMat = regMat(new THREE.ShaderMaterial({
      uniforms: {
        uTime: sharedTime,
        uLit: litUniform,
        uPhase: phaseUniform,
        uScale: scaleUniform
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      vertexShader: `
        attribute vec4 aSparkSeed;
        uniform float uTime;
        uniform float uScale;
        uniform float uPhase;
        varying float vCyc;
        varying float vTwinkle;
        void main() {
          float cyc = fract(aSparkSeed.x + uTime * aSparkSeed.y + uPhase * 0.19);
          vCyc = cyc;
          float ang = aSparkSeed.x * 6.28318 + uTime * (1.8 + aSparkSeed.y * 2.4) + cyc * 4.5;
          float rad = aSparkSeed.z * (0.45 + cyc * 1.45) * uScale;
          float windX = 0.52 * pow(cyc, 1.3) * uScale;
          vec3 p = vec3(
            windX + cos(ang) * rad,
            (0.24 + cyc * 3.85) * uScale,
            sin(ang) * rad
          );
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float sz = (28.0 + 18.0 * aSparkSeed.w) * uScale * (1.0 - cyc * 0.45);
          gl_PointSize = clamp(sz / max(1.0, -mv.z), 2.0, 11.0);
          vTwinkle = 0.65 + 0.35 * sin(uTime * 14.0 + aSparkSeed.x * 45.0);
        }
      `,
      fragmentShader: `
        uniform float uLit;
        varying float vCyc;
        varying float vTwinkle;
        void main() {
          if (uLit < 0.015) discard;
          vec2 d = gl_PointCoord * 2.0 - 1.0;
          float r2 = dot(d, d);
          if (r2 >= 1.0) discard;
          float core = exp(-r2 * 5.8) * (1.0 - smoothstep(0.55, 1.0, sqrt(r2)));
          float life = smoothstep(0.0, 0.12, vCyc) * (1.0 - smoothstep(0.65, 1.0, vCyc));
          vec3 hotCol = mix(vec3(2.5, 1.42, 0.42), vec3(1.85, 0.34, 0.04), smoothstep(0.15, 0.85, vCyc));
          float alpha = core * life * vTwinkle * clamp(uLit, 0.0, 1.0);
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(hotCol, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `
    }));
    const sparksPoints = new THREE.Points(sharedSparksGeo, sparksMat);
    sparksPoints.renderOrder = 6;
    sparksPoints.frustumCulled = false;
    cfRoot.add(sparksPoints);

    // e1) Subtle Additive Warm Firelight Ground Bounce Pool Disc
    const groundPoolMat = regMat(new THREE.ShaderMaterial({
      uniforms: {
        uTime: sharedTime,
        uLit: litUniform,
        uPhase: phaseUniform
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      fog: false,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uLit;
        uniform float uPhase;
        varying vec2 vUv;
        void main() {
          if (uLit < 0.015) discard;
          vec2 p = vUv * 2.0 - 1.0;
          float r2 = dot(p, p);
          if (r2 >= 1.0) discard;
          float r = sqrt(r2);
          float flick = 0.88 + 0.08 * sin(uTime * 7.6 + uPhase) + 0.04 * cos(uTime * 14.2 - uPhase * 1.3);
          float wave = 0.92 + 0.08 * sin(r * 9.0 - uTime * 4.5 + uPhase);
          float falloff = exp(-r2 * 3.8) * (1.0 - smoothstep(0.58, 1.0, r));
          vec3 warmCol = mix(vec3(0.92, 0.28, 0.04), vec3(1.38, 0.62, 0.14), exp(-r2 * 4.5));
          float alpha = falloff * wave * 0.34 * clamp(uLit, 0.0, 1.0);
          if (alpha < 0.005) discard;
          gl_FragColor = vec4(warmCol * flick, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `
    }));
    const groundPool = new THREE.Mesh(sharedGroundPoolGeo, groundPoolMat);
    groundPool.scale.setScalar(scale);
    groundPool.position.y = 0.025;
    groundPool.renderOrder = 2;
    cfRoot.add(groundPool);

    // e2) Flickering Warm Amber PointLight (#ff7d2c)
    let pointLight = null;
    const baseLightX = 0.0;
    const baseLightY = 0.95 * scale;
    const baseLightZ = 0.0;
    if (addPointLight) {
      pointLight = new THREE.PointLight(0xff7d2c, lightIntensity, lightDistance, 1.65);
      pointLight.castShadow = false;
      pointLight.position.set(baseLightX, baseLightY, baseLightZ);
      cfRoot.add(pointLight);
    }

    const entry = {
      root: cfRoot,
      emberMesh,
      flameMesh,
      auraMesh,
      smokeMesh,
      sparksPoints,
      groundPool,
      pointLight,
      litUniform,
      phase,
      scale,
      lightIntensity,
      baseLightX,
      baseLightY,
      baseLightZ
    };
    campfires.push(entry);

    return {
      root: cfRoot,
      pointLight,
      litUniform,
      setLit(v) {
        litUniform.value = clamp01(Number(v) || 0);
      }
    };
  }

  function update(elapsed) {
    const t = Number.isFinite(elapsed) ? elapsed : sharedTime.value;
    if (Number.isFinite(elapsed)) {
      sharedTime.value = t;
    }

    for (let i = 0; i < campfires.length; i++) {
      const cf = campfires[i];
      const lit = clamp01(cf.litUniform ? cf.litUniform.value : 1.0);
      const active = lit > 0.005;

      cf.flameMesh.visible = active;
      cf.auraMesh.visible = active;
      cf.smokeMesh.visible = active;
      cf.sparksPoints.visible = active;
      cf.groundPool.visible = active;

      if (cf.pointLight) {
        if (!active) {
          cf.pointLight.intensity = 0.0;
          cf.pointLight.visible = false;
        } else {
          cf.pointLight.visible = true;
          const p = cf.phase;
          const flick =
            0.86 +
            0.09 * Math.sin(t * 7.8 + p) +
            0.05 * Math.cos(t * 14.3 - p * 1.37) +
            0.03 * Math.sin(t * 23.1 + p * 2.1);
          cf.pointLight.intensity = cf.lightIntensity * lit * flick;
          cf.pointLight.position.set(
            cf.baseLightX + Math.sin(t * 6.1 + p) * 0.042 * cf.scale,
            cf.baseLightY + Math.cos(t * 8.4 - p) * 0.032 * cf.scale,
            cf.baseLightZ + Math.sin(t * 5.3 + p * 1.7) * 0.042 * cf.scale
          );
        }
      }
    }
  }

  function setLowSpec(flag) {
    lowSpecUniform.value = flag ? 1.0 : 0.0;
  }

  function dispose() {
    for (let i = 0; i < campfires.length; i++) {
      const cf = campfires[i];
      if (cf.pointLight && cf.pointLight.parent) {
        cf.pointLight.parent.remove(cf.pointLight);
      }
    }
    campfires.length = 0;
    for (let i = 0; i < ownedGeos.length; i++) ownedGeos[i]?.dispose?.();
    for (let i = 0; i < ownedMats.length; i++) ownedMats[i]?.dispose?.();
    for (let i = 0; i < ownedTex.length; i++) ownedTex[i]?.dispose?.();
    ownedGeos.length = 0;
    ownedMats.length = 0;
    ownedTex.length = 0;
    if (group.parent) group.parent.remove(group);
  }

  return {
    group,
    addCampfire,
    update,
    setLowSpec,
    dispose
  };
}
