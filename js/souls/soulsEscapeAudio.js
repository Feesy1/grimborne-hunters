// Grimborne Hunters — Judge of Ruins Escape Cutscene & Exterior Shore Audio Engine
// Pure Vanilla ES Module (Web Audio API, zero external dependencies, zero GC in hot paths).
//
// Exports:
//   - BOSS_ESCAPE_VO_COUNT, BOSS_ESCAPE_LIPSYNC_FPS
//   - BOSS_ESCAPE_VO_DURATIONS_SEC, BOSS_ESCAPE_VO_DURATIONS_MS
//   - BOSS_ESCAPE_VO_LINES, BOSS_ESCAPE_LIPSYNC_CURVES
//   - getEscapeBossVoDurationSec(cueIndex)
//   - sampleEscapeBossMouthOpen(cueIndex, localTimeSec)
//   - createSoulsEscapeAudio(getCtx, getMasterGain, getSfxVolume, assetVer)
//
// Voiceover lip-sync curves auto-extracted from mastered boss_escape_vo_01..04.mp3
// (300-3200 Hz speech RMS, smoothed attack/release articulation, quantized 0..100).

export const SOULS_ESCAPE_AUDIO_VERSION = '20261124z91';
export const BOSS_ESCAPE_VO_COUNT = 4;
export const BOSS_ESCAPE_LIPSYNC_FPS = 30;

const BASE_AUDIO_PATH = './assets/audio';
const INV_2_POW_31 = 2 / 4294967296;

export const BOSS_ESCAPE_VO_DURATIONS_SEC = Object.freeze({
  1: 3.087, // 3087 ms — Heh... Did you truly think... that was the end?
  2: 2.648, // 2648 ms — Brave. Almost... touching.
  3: 4.147, // 4147 ms — Yet you never learned the rules of my house. Guests do not leave...
  4: 1.661  // 1661 ms — ...they go down below.
});

export const BOSS_ESCAPE_VO_DURATIONS_MS = Object.freeze({
  1: 3087,
  2: 2648,
  3: 4147,
  4: 1661
});

export const BOSS_ESCAPE_VO_LINES = Object.freeze([
  Object.freeze({
    index: 1,
    key: 'boss_escape_vo_01',
    file: 'boss_escape_vo_01.mp3',
    durationSec: 3.087,
    textEn: 'Heh... Did you truly think... that was the end?'
  }),
  Object.freeze({
    index: 2,
    key: 'boss_escape_vo_02',
    file: 'boss_escape_vo_02.mp3',
    durationSec: 2.648,
    textEn: 'Brave. Almost... touching.'
  }),
  Object.freeze({
    index: 3,
    key: 'boss_escape_vo_03',
    file: 'boss_escape_vo_03.mp3',
    durationSec: 4.147,
    textEn: 'Yet you never learned the rules of my house. Guests do not leave...'
  }),
  Object.freeze({
    index: 4,
    key: 'boss_escape_vo_04',
    file: 'boss_escape_vo_04.mp3',
    durationSec: 1.661,
    textEn: '...they go down below.'
  })
]);

// Quantized 30-FPS mouth-open curves (integers 0..100 -> divided by 100.0 in sampler)
export const BOSS_ESCAPE_LIPSYNC_CURVES = Object.freeze({
  1: Object.freeze([
    18, 34, 33, 40, 61, 56, 41, 29, 20, 13, 8, 5, 3, 0, 0, 0,
    25, 69, 81, 65, 65, 82, 82, 72, 49, 66, 86, 84, 81, 93, 95, 89,
    81, 81, 73, 59, 42, 32, 26, 70, 77, 66, 56, 48, 37, 35, 29, 20,
    16, 12, 10, 6, 4, 3, 63, 88, 97, 100, 93, 74, 84, 84, 71, 55,
    42, 58, 61, 66, 89, 97, 93, 86, 77, 63, 51, 47, 45, 40, 33, 31,
    24, 18, 13, 12, 9, 7, 4, 3, 0, 0, 0, 0, 0, 0
  ]),
  2: Object.freeze([
    19, 45, 79, 95, 100, 99, 92, 84, 74, 61, 49, 38, 29, 23, 18, 17,
    16, 15, 12, 8, 5, 3, 0, 0, 0, 0, 64, 89, 89, 79, 72, 60,
    53, 62, 62, 56, 49, 40, 35, 36, 39, 33, 28, 22, 16, 10, 6, 4,
    2, 0, 0, 0, 17, 28, 49, 84, 96, 71, 53, 61, 76, 68, 62, 57,
    41, 29, 21, 15, 10, 8, 5, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0
  ]),
  3: Object.freeze([
    0, 31, 74, 93, 80, 69, 62, 61, 69, 70, 66, 74, 85, 93, 81, 79,
    94, 100, 86, 73, 87, 96, 91, 85, 73, 62, 53, 74, 78, 65, 47, 46,
    71, 81, 78, 68, 55, 44, 38, 33, 27, 31, 54, 50, 35, 29, 37, 68,
    77, 81, 80, 72, 65, 63, 62, 77, 94, 97, 91, 78, 61, 48, 40, 36,
    34, 31, 25, 19, 14, 10, 7, 5, 3, 0, 37, 80, 95, 98, 83, 69,
    53, 40, 35, 37, 36, 27, 20, 38, 62, 60, 57, 53, 51, 57, 71, 85,
    77, 61, 54, 50, 64, 89, 86, 74, 62, 51, 42, 35, 29, 23, 19, 19,
    18, 11, 7, 6, 3, 2, 0, 0, 0, 0, 0, 0, 0, 0
  ]),
  4: Object.freeze([
    7, 51, 79, 85, 76, 55, 53, 86, 97, 100, 97, 91, 67, 49, 45, 75,
    93, 97, 95, 93, 88, 72, 59, 46, 52, 85, 86, 73, 65, 79, 88, 88,
    83, 74, 65, 54, 41, 30, 23, 17, 14, 11, 10, 8, 6, 4, 2, 0,
    0, 0, 0
  ])
});

export function getEscapeBossVoDurationSec(cueIndex) {
  const idx = cueIndex | 0;
  return BOSS_ESCAPE_VO_DURATIONS_SEC[idx] || 0;
}

/**
 * Sample smooth [0..1] mouth-open factor for Judge of Ruins escape dialogue lip-sync.
 * Zero allocations, NaN-safe, linearly interpolated at 30 FPS.
 */
export function sampleEscapeBossMouthOpen(cueIndex, localTimeSec) {
  const idx = cueIndex | 0;
  const curve = BOSS_ESCAPE_LIPSYNC_CURVES[idx];
  if (!curve || !Number.isFinite(localTimeSec) || localTimeSec < 0) return 0;
  const dur = BOSS_ESCAPE_VO_DURATIONS_SEC[idx];
  if (dur > 0 && localTimeSec >= dur) return 0;
  const pos = localTimeSec * BOSS_ESCAPE_LIPSYNC_FPS;
  const i0 = pos | 0;
  const last = curve.length - 1;
  if (i0 >= last) return 0;
  const frac = pos - i0;
  const v0 = curve[i0];
  const v1 = curve[i0 + 1];
  const v = (v0 + (v1 - v0) * frac) * 0.01;
  return v <= 0 ? 0 : (v >= 1 ? 1 : v);
}

// ============================================================================
// Safe Math & Web Audio Utilities
// ============================================================================

function clamp(v, lo, hi) {
  const n = Number(v);
  if (!Number.isFinite(n)) return lo;
  return n < lo ? lo : n > hi ? hi : n;
}

function clampFreq(ctx, hz) {
  const nyq = Math.max(8000, ((ctx && ctx.sampleRate) || 44100) * 0.45);
  return clamp(hz, 20, nyq);
}

function nowMs() {
  return (typeof performance !== 'undefined' && typeof performance.now === 'function')
    ? performance.now()
    : Date.now();
}

function safeDisconnect(node) {
  if (!node) return;
  try { node.disconnect(); } catch {}
}

function safeDisconnectList(list) {
  if (!list) return;
  for (let i = 0; i < list.length; i++) {
    try { list[i].disconnect(); } catch {}
  }
}

function safeStop(node) {
  if (!node) return;
  try { node.stop(); } catch {}
}

function createStereoPannerSafe(ctx, pan = 0) {
  if (ctx && typeof ctx.createStereoPanner === 'function') {
    try {
      const p = ctx.createStereoPanner();
      p.pan.setValueAtTime(clamp(pan, -1, 1), ctx.currentTime);
      return p;
    } catch {}
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(1.0, ctx.currentTime);
  return g;
}

function decodeAudioBuffer(audioCtx, arrayBuffer) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const onOk = (decoded) => {
      if (settled) return;
      settled = true;
      resolve(decoded);
    };
    const onErr = (err) => {
      if (settled) return;
      settled = true;
      reject(err || new Error('decodeAudioData failed'));
    };
    try {
      const res = audioCtx.decodeAudioData(arrayBuffer, onOk, onErr);
      if (res && typeof res.then === 'function') {
        res.then(onOk, onErr);
      }
    } catch (err) {
      onErr(err);
    }
  });
}

// ============================================================================
// Reusable Procedural Audio Buffers (Zero Per-Trigger Allocation)
// ============================================================================

function buildSoftLimiterCurve(samples = 1024) {
  const curve = new Float32Array(samples);
  const knee = 0.72;
  const ceiling = 0.96;
  const span = ceiling - knee;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / (samples - 1) - 1;
    const ax = Math.abs(x);
    if (ax <= knee) {
      curve[i] = x;
    } else {
      const shaped = knee + span * Math.tanh((ax - knee) / span);
      curve[i] = x < 0 ? -shaped : shaped;
    }
  }
  return curve;
}

/**
 * Generates a realistic non-ringing stereo Gothic Limestone Cathedral IR (~2.1s).
 */
function buildCathedralIR(ctx, durationSec = 2.15) {
  const sr = Math.max(22050, Math.min(96000, ctx.sampleRate || 44100));
  const length = Math.max(4096, Math.floor(sr * durationSec));
  const ir = ctx.createBuffer(2, length, sr);
  let seed = 0xE5CA9E11 >>> 0;

  const earlyTaps = [
    [0.017, 0.38, 0.19],
    [0.028, 0.18, 0.36],
    [0.043, 0.30, 0.15],
    [0.061, 0.14, 0.27],
    [0.084, 0.23, 0.13],
    [0.112, 0.12, 0.20],
    [0.149, 0.16, 0.10]
  ];

  const preDelay = Math.floor(sr * 0.018);
  const fadeIn = Math.max(1, Math.floor(sr * 0.048));
  const invFadeIn = 1.0 / fadeIn;
  const tailFade = Math.min(length, Math.floor(sr * 0.12));
  const invTailFade = tailFade > 0 ? 1.0 / tailFade : 1.0;
  const decay1 = Math.exp(-2.35 / sr);
  const decay2 = Math.exp(-1.12 / sr);
  const lpSlope = 0.20 / (Math.max(0.1, durationSec) * sr);

  for (let ch = 0; ch < 2; ch++) {
    const out = ir.getChannelData(ch);

    for (let i = 0; i < earlyTaps.length; i++) {
      const tap = earlyTaps[i];
      const idx = Math.floor(tap[0] * sr);
      const amp = ch === 0 ? tap[1] : tap[2];
      const sign = ((i + ch) % 2 === 0) ? 1 : -1;
      if (idx > 1 && idx + 2 < length) {
        out[idx - 1] += sign * amp * 0.24;
        out[idx] += sign * amp * 0.52;
        out[idx + 1] += sign * amp * 0.24;
      }
    }

    let lp1 = 0;
    let lp2 = 0;
    let hp = 0;
    let prevIn = 0;
    let env1 = 0.70;
    let env2 = 0.30;
    let lpCoeff = 0.33;

    for (let i = preDelay; i < length; i++) {
      const rel = i - preDelay;
      const ramp = rel < fadeIn ? rel * invFadeIn : 1.0;
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const w = seed * INV_2_POW_31 - 1.0;

      const c = lpCoeff < 0.055 ? 0.055 : lpCoeff;
      lp1 += c * (w - lp1);
      lp2 += (c * 0.80) * (lp1 - lp2);
      hp = 0.993 * (hp + lp2 - prevIn);
      prevIn = lp2;

      out[i] += hp * (env1 + env2) * ramp * 0.26;
      env1 *= decay1;
      env2 *= decay2;
      lpCoeff -= lpSlope;
    }

    const fadeStart = length - tailFade;
    for (let k = 0; k < tailFade; k++) {
      const m = 1.0 - k * invTailFade;
      out[fadeStart + k] *= m * m;
    }
  }
  return ir;
}

/**
 * Seamless 4.2s stereo warm pink+brown noise loop (equal-power crossfade wrap).
 * Drives chasm wind, underwater torrent, stone collapse rumble, river & night cliff wind.
 */
function buildSeamlessWarmNoise(ctx, durationSec = 4.2) {
  const sr = Math.max(22050, Math.min(96000, ctx.sampleRate || 44100));
  const length = Math.max(8192, Math.floor(sr * durationSec));
  const xfade = Math.max(64, Math.min(Math.floor(sr * 0.40), Math.floor(length * 0.18)));
  const buf = ctx.createBuffer(2, length, sr);
  let seed = 0x540AE801 >>> 0;
  const dA = (Math.PI * 0.5) / xfade;
  const cosD = Math.cos(dA);
  const sinD = Math.sin(dA);
  const invBrown = 1.0 / 1.028;

  for (let ch = 0; ch < 2; ch++) {
    const out = buf.getChannelData(ch);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let brown = 0;

    for (let i = 0; i < length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const w = seed * INV_2_POW_31 - 1.0;
      b0 = 0.99765 * b0 + w * 0.0990460;
      b1 = 0.96300 * b1 + w * 0.2965164;
      b2 = 0.57000 * b2 + w * 1.0526913;
      const pink = (b0 + b1 + b2 + w * 0.1848) * 0.14;
      brown = (brown + 0.028 * w) * invBrown;
      const s = pink * 0.58 + brown * 1.78;
      out[i] = s < -0.95 ? -0.95 : s > 0.95 ? 0.95 : s;
    }

    let fIn = 0.0;
    let fOut = 1.0;
    for (let i = 0; i < xfade; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const w = seed * INV_2_POW_31 - 1.0;
      b0 = 0.99765 * b0 + w * 0.0990460;
      b1 = 0.96300 * b1 + w * 0.2965164;
      b2 = 0.57000 * b2 + w * 1.0526913;
      const pink = (b0 + b1 + b2 + w * 0.1848) * 0.14;
      brown = (brown + 0.028 * w) * invBrown;
      const tail = pink * 0.58 + brown * 1.78;
      const clampedTail = tail < -0.95 ? -0.95 : tail > 0.95 ? 0.95 : tail;
      out[i] = out[i] * fIn + clampedTail * fOut;
      const nIn = fIn * cosD + fOut * sinD;
      const nOut = fOut * cosD - fIn * sinD;
      fIn = nIn;
      fOut = nOut;
    }
  }
  return buf;
}

/**
 * Seamless 1.6s stereo broadband crisp noise buffer for transient steel sparks,
 * armor scrapes, limestone fractures, splash spray & waterfall foam.
 */
function buildSeamlessCrispNoise(ctx, durationSec = 1.6) {
  const sr = Math.max(22050, Math.min(96000, ctx.sampleRate || 44100));
  const length = Math.max(4096, Math.floor(sr * durationSec));
  const xfade = Math.min(512, Math.floor(length * 0.1));
  const buf = ctx.createBuffer(2, length, sr);
  let seed = 0x7A91C305 >>> 0;

  for (let ch = 0; ch < 2; ch++) {
    const out = buf.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      out[i] = (seed * INV_2_POW_31 - 1.0) * 0.88;
    }
    for (let k = 0; k < xfade; k++) {
      const a = (k / xfade) * (Math.PI * 0.5);
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const tail = (seed * INV_2_POW_31 - 1.0) * 0.88;
      out[k] = out[k] * Math.sin(a) + tail * Math.cos(a);
    }
  }
  return buf;
}

// ============================================================================
// Main Factory: createSoulsEscapeAudio(getCtx, getMasterGain, getSfxVolume, assetVer)
// ============================================================================

export function createSoulsEscapeAudio(getCtxArg, getMasterGainArg, getSfxVolumeArg, assetVerArg) {
  // Accept both positional `(getCtx, getMasterGain, getSfxVolume, assetVer)` and options-object style
  let getCtxFn = null;
  let getMasterGainFn = null;
  let getSfxVolumeFn = null;
  let getVoiceVolumeFn = null;
  let getExternalReverbFn = null;
  let duckMusicFn = null;
  let assetVer = SOULS_ESCAPE_AUDIO_VERSION;

  if (getCtxArg && typeof getCtxArg === 'object' && typeof getCtxArg !== 'function') {
    const o = getCtxArg;
    getCtxFn = typeof o.getCtx === 'function' ? o.getCtx : null;
    getMasterGainFn = typeof o.getMasterGain === 'function'
      ? o.getMasterGain
      : (typeof o.getSfxDest === 'function' ? o.getSfxDest : null);
    getSfxVolumeFn = typeof o.getSfxVolume === 'function' ? o.getSfxVolume : null;
    getVoiceVolumeFn = typeof o.getVoiceVolume === 'function' ? o.getVoiceVolume : null;
    getExternalReverbFn = typeof o.getStoneReverbDest === 'function' ? o.getStoneReverbDest : null;
    duckMusicFn = typeof o.duckMusic === 'function' ? o.duckMusic : null;
    if (o.assetVer !== undefined) assetVer = String(o.assetVer);
    else if (o.version !== undefined) assetVer = String(o.version);
  } else {
    getCtxFn = typeof getCtxArg === 'function' ? getCtxArg : null;
    getMasterGainFn = typeof getMasterGainArg === 'function' ? getMasterGainArg : null;
    getSfxVolumeFn = typeof getSfxVolumeArg === 'function' ? getSfxVolumeArg : null;
    if (assetVerArg !== undefined && assetVerArg !== null && String(assetVerArg).length > 0) {
      assetVer = String(assetVerArg);
    }
  }

  const verQuery = assetVer ? `?v=${encodeURIComponent(assetVer)}` : '';
  const voUrls = new Map();
  for (let i = 0; i < BOSS_ESCAPE_VO_LINES.length; i++) {
    const line = BOSS_ESCAPE_VO_LINES[i];
    voUrls.set(line.index, `${BASE_AUDIO_PATH}/${line.file}${verQuery}`);
  }

  // Decoded AudioBuffer cache & load state
  const voBuffers = new Map();
  const pendingVoLoads = new Map();
  let preloadStarted = false;
  let preloadPromise = null;

  // Graph & reusable buffer cache (per AudioContext)
  let disposed = false;
  let muted = false;
  let voiceVolumeScale = 1.05;

  let busCtx = null;
  let busDest = null;
  let busNodes = [];
  let escapeOutGain = null;
  let sfxBus = null;
  let voiceBus = null;
  let reverbSendBus = null;
  let cathedralIRBuf = null;
  let warmNoiseBuf = null;
  let crispNoiseBuf = null;

  // Active voice line tracking (zero overlap)
  let activeVoice = null;
  const fadingVoices = new Set();
  let voicePlayToken = 0;

  // Continuous stateful loops
  let chasmWindState = null;       // { ctx, masterGain, nodes, stopTimer, active }
  let shoreAmbientState = null;    // { ctx, masterGain, nodes, stopTimer, active }

  // Active timers & one-shot cleanup tracking
  const activeTimers = new Set();
  const activeOneShotStops = new Set();

  function trackTimer(fn, delayMs) {
    const tid = setTimeout(() => {
      activeTimers.delete(tid);
      if (!disposed) fn();
    }, Math.max(0, delayMs));
    activeTimers.add(tid);
    return tid;
  }

  function clearTrackedTimer(tid) {
    if (tid === null || tid === undefined) return;
    clearTimeout(tid);
    activeTimers.delete(tid);
  }

  function resolveCtx(explicitCtx = null) {
    if (disposed) return null;
    const c = explicitCtx || (getCtxFn ? safeCall(getCtxFn) : null);
    if (!c || c.state === 'closed' || typeof c.createGain !== 'function') return null;
    return c;
  }

  function safeCall(fn) {
    try { return fn(); } catch { return null; }
  }

  function resolveMasterDest(ctx) {
    if (!ctx) return null;
    const d = getMasterGainFn ? safeCall(getMasterGainFn) : null;
    return d || ctx.destination || null;
  }

  function readSfxVol() {
    if (muted) return 0;
    if (!getSfxVolumeFn) return 1.0;
    const v = safeCall(getSfxVolumeFn);
    if (v === null || v === undefined) return 1.0;
    return clamp(Number(v), 0, 1.5);
  }

  function readVoiceVol() {
    if (muted) return 0;
    if (getVoiceVolumeFn) {
      const vv = safeCall(getVoiceVolumeFn);
      if (Number.isFinite(Number(vv))) return clamp(Number(vv) * voiceVolumeScale, 0, 1.6);
    }
    const sv = readSfxVol();
    if (sv <= 0.001) return 0;
    // Keep Boss voice clear and commanding even when user sets moderate SFX slider
    return clamp(Math.max(sv * 1.12, 0.72 * Math.sqrt(sv)) * voiceVolumeScale, 0, 1.5);
  }

  function ensureGraph(explicitCtx = null) {
    const ctx = resolveCtx(explicitCtx);
    const dest = resolveMasterDest(ctx);
    if (!ctx || !dest) return null;

    if (busCtx === ctx && busDest === dest && sfxBus && voiceBus) {
      // Refresh live SFX / Voice bus levels without allocating anything
      const t = ctx.currentTime;
      sfxBus.gain.setTargetAtTime(readSfxVol(), t, 0.02);
      voiceBus.gain.setTargetAtTime(readVoiceVol(), t, 0.02);
      return ctx;
    }

    safeDisconnectList(busNodes);
    busNodes = [];
    busCtx = ctx;
    busDest = dest;

    const t0 = ctx.currentTime;

    // Build reusable buffers once per AudioContext
    if (!cathedralIRBuf || cathedralIRBuf.sampleRate !== ctx.sampleRate) {
      cathedralIRBuf = buildCathedralIR(ctx, 2.15);
    }
    if (!warmNoiseBuf || warmNoiseBuf.sampleRate !== ctx.sampleRate) {
      warmNoiseBuf = buildSeamlessWarmNoise(ctx, 4.2);
    }
    if (!crispNoiseBuf || crispNoiseBuf.sampleRate !== ctx.sampleRate) {
      crispNoiseBuf = buildSeamlessCrispNoise(ctx, 1.6);
    }

    // Master soft-ceiling output strip -> masterDest (ZERO harsh digital clipping!)
    const limiterIn = ctx.createGain();
    limiterIn.gain.setValueAtTime(1.0, t0);
    busNodes.push(limiterIn);

    let outChain = limiterIn;
    if (typeof ctx.createWaveShaper === 'function') {
      try {
        const shaper = ctx.createWaveShaper();
        shaper.curve = buildSoftLimiterCurve(1024);
        shaper.oversample = '2x';
        outChain.connect(shaper);
        outChain = shaper;
        busNodes.push(shaper);
      } catch {}
    }

    escapeOutGain = ctx.createGain();
    escapeOutGain.gain.setValueAtTime(1.0, t0);
    outChain.connect(escapeOutGain);
    escapeOutGain.connect(dest);
    busNodes.push(escapeOutGain);

    // SFX Sub-Bus
    sfxBus = ctx.createGain();
    sfxBus.gain.setValueAtTime(readSfxVol(), t0);
    sfxBus.connect(limiterIn);
    busNodes.push(sfxBus);

    // Dedicated Boss Voice Bus (velvet warmth + crisp consonant presence)
    voiceBus = ctx.createGain();
    voiceBus.gain.setValueAtTime(readVoiceVol(), t0);
    let voiceChain = voiceBus;
    if (typeof ctx.createBiquadFilter === 'function') {
      const vLow = ctx.createBiquadFilter();
      vLow.type = 'lowshelf';
      vLow.frequency.setValueAtTime(135, t0);
      vLow.gain.setValueAtTime(1.6, t0);

      const vPres = ctx.createBiquadFilter();
      vPres.type = 'peaking';
      vPres.frequency.setValueAtTime(2150, t0);
      vPres.Q.setValueAtTime(0.95, t0);
      vPres.gain.setValueAtTime(1.4, t0);

      voiceChain.connect(vLow);
      vLow.connect(vPres);
      voiceChain = vPres;
      busNodes.push(vLow, vPres);
    }
    voiceChain.connect(limiterIn);
    busNodes.push(voiceBus);

    // Shared Gothic Cathedral Stereo Reverb Send Bus
    reverbSendBus = ctx.createGain();
    reverbSendBus.gain.setValueAtTime(1.0, t0);
    busNodes.push(reverbSendBus);

    const revHp = ctx.createBiquadFilter();
    revHp.type = 'highpass';
    revHp.frequency.setValueAtTime(110, t0);
    const revLp = ctx.createBiquadFilter();
    revLp.type = 'lowpass';
    revLp.frequency.setValueAtTime(2800, t0);
    const revWet = ctx.createGain();
    revWet.gain.setValueAtTime(0.42, t0);

    reverbSendBus.connect(revHp);
    revHp.connect(revLp);
    busNodes.push(revHp, revLp, revWet);

    let usedConvolver = false;
    if (typeof ctx.createConvolver === 'function' && cathedralIRBuf) {
      try {
        const conv = ctx.createConvolver();
        conv.normalize = true;
        conv.buffer = cathedralIRBuf;
        revLp.connect(conv);
        conv.connect(revWet);
        busNodes.push(conv);
        usedConvolver = true;
      } catch {}
    }
    if (!usedConvolver) {
      // Safe stereo delay-network fallback
      const d1 = ctx.createDelay(0.4);
      const d2 = ctx.createDelay(0.4);
      const fb = ctx.createGain();
      d1.delayTime.setValueAtTime(0.067, t0);
      d2.delayTime.setValueAtTime(0.139, t0);
      fb.gain.setValueAtTime(0.38, t0);
      revLp.connect(d1);
      revLp.connect(d2);
      d1.connect(revWet);
      d2.connect(revWet);
      d2.connect(fb);
      fb.connect(d1);
      busNodes.push(d1, d2, fb);
    }
    revWet.connect(limiterIn);

    return ctx;
  }

  function registerOneShotCleanup(stopFn, durationSec) {
    activeOneShotStops.add(stopFn);
    const tid = trackTimer(() => {
      activeOneShotStops.delete(stopFn);
    }, Math.ceil((durationSec + 0.25) * 1000));
    return () => {
      clearTrackedTimer(tid);
      activeOneShotStops.delete(stopFn);
    };
  }

  function sendToCathedral(ctx, sourceNode, amount, nodesOut) {
    if (!reverbSendBus || amount <= 0.005) return;
    const g = ctx.createGain();
    g.gain.setValueAtTime(clamp(amount, 0.001, 1.0), ctx.currentTime);
    sourceNode.connect(g);
    g.connect(reverbSendBus);
    if (nodesOut) nodesOut.push(g);

    // Optional external shared stone early-reflection send if supplied
    if (getExternalReverbFn) {
      const ext = safeCall(getExternalReverbFn);
      if (ext) {
        try {
          const eg = ctx.createGain();
          eg.gain.setValueAtTime(clamp(amount * 0.45, 0.001, 0.5), ctx.currentTime);
          sourceNode.connect(eg);
          eg.connect(ext);
          if (nodesOut) nodesOut.push(eg);
        } catch {}
      }
    }
  }

  // ==========================================================================
  // 1. Preload & Boss Escape Voiceover Playback (boss_escape_vo_01..04.mp3)
  // ==========================================================================

  function loadVoiceCue(cueIndex, explicitCtx = null) {
    const idx = cueIndex | 0;
    const url = voUrls.get(idx);
    if (!url) return Promise.resolve(null);
    if (voBuffers.has(idx)) return Promise.resolve(voBuffers.get(idx));
    if (pendingVoLoads.has(idx)) return pendingVoLoads.get(idx);

    const ctx = resolveCtx(explicitCtx);
    if (!ctx || typeof fetch === 'undefined') return Promise.resolve(null);

    const p = fetch(url)
      .then((res) => (res && res.ok ? res.arrayBuffer() : Promise.reject(new Error(`HTTP ${res ? res.status : 0}`))))
      .then((ab) => decodeAudioBuffer(ctx, ab))
      .then((decoded) => {
        if (!disposed) voBuffers.set(idx, decoded);
        pendingVoLoads.delete(idx);
        return decoded;
      })
      .catch(() => {
        pendingVoLoads.delete(idx);
        return null;
      });
    pendingVoLoads.set(idx, p);
    return p;
  }

  function preload(explicitCtx = null) {
    const ctx = ensureGraph(explicitCtx);
    if (!ctx || typeof fetch === 'undefined') return Promise.resolve([]);
    if (preloadStarted && preloadPromise) return preloadPromise;
    preloadStarted = true;

    const loads = [];
    for (let i = 1; i <= BOSS_ESCAPE_VO_COUNT; i++) {
      loads.push(loadVoiceCue(i, ctx));
    }
    preloadPromise = Promise.all(loads);
    return preloadPromise;
  }

  function destroyVoiceEntry(entry) {
    if (!entry) return;
    entry.stopped = true;
    if (entry.fadeTimer !== null) {
      clearTrackedTimer(entry.fadeTimer);
      entry.fadeTimer = null;
    }
    if (activeVoice === entry) activeVoice = null;
    fadingVoices.delete(entry);
    try { if (entry.source) entry.source.onended = null; } catch {}
    safeStop(entry.source);
    safeDisconnectList(entry.nodes);
    entry.source = null;
    entry.gain = null;
  }

  function fadeOutVoiceEntry(entry, fadeSec = 0.04) {
    if (!entry || entry.stopped) return;
    entry.stopped = true;
    if (activeVoice === entry) activeVoice = null;
    fadingVoices.add(entry);

    const ctx = entry.ctx;
    const safeFade = clamp(fadeSec, 0, 2.0);
    if (!ctx || !entry.gain || safeFade <= 0.005 || ctx.state === 'closed') {
      destroyVoiceEntry(entry);
      return;
    }

    const t = ctx.currentTime;
    try {
      entry.gain.gain.cancelScheduledValues(t);
      const cur = Number.isFinite(entry.gain.gain.value) ? entry.gain.gain.value : 1.0;
      entry.gain.gain.setValueAtTime(Math.max(0.0001, cur), t);
      entry.gain.gain.linearRampToValueAtTime(0.0001, t + safeFade);
    } catch {
      destroyVoiceEntry(entry);
      return;
    }

    if (entry.fadeTimer !== null) clearTrackedTimer(entry.fadeTimer);
    entry.fadeTimer = trackTimer(() => {
      entry.fadeTimer = null;
      destroyVoiceEntry(entry);
    }, Math.ceil((safeFade + 0.035) * 1000));
  }

  function startDecodedVoice(ctx, cueIndex, buffer, opts = {}) {
    if (disposed || !ctx || !voiceBus || !buffer) return false;
    const t0 = ctx.currentTime;
    const gainScale = clamp(opts.gain !== undefined ? opts.gain : 1.0, 0.05, 1.6);
    const offsetSec = clamp(opts.offsetSec || 0, 0, Math.max(0, buffer.duration - 0.02));
    const revSendAmt = clamp(opts.reverbSend !== undefined ? opts.reverbSend : 0.22, 0, 0.75);

    try {
      const src = ctx.createBufferSource();
      src.buffer = buffer;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(gainScale, t0 + 0.005);

      const nodes = [src, g];
      src.connect(g);
      g.connect(voiceBus);

      // Subtle live cathedral send complementing the mastered hall space
      sendToCathedral(ctx, g, revSendAmt, nodes);

      const entry = {
        cueIndex,
        ctx,
        source: src,
        gain: g,
        nodes,
        stopped: false,
        fadeTimer: null
      };

      const onEndedCb = typeof opts.onEnded === 'function' ? opts.onEnded : null;
      src.onended = () => {
        const wasActive = activeVoice === entry && !entry.stopped;
        destroyVoiceEntry(entry);
        if (wasActive && onEndedCb) {
          try { onEndedCb(cueIndex); } catch {}
        }
      };

      src.start(t0, offsetSec);
      activeVoice = entry;

      const duckFn = typeof opts.duckMusic === 'function' ? opts.duckMusic : duckMusicFn;
      if (typeof duckFn === 'function') {
        try {
          duckFn(-8.5, clamp(buffer.duration - offsetSec, 0.25, 4.5), 0.85);
        } catch {}
      }
      return true;
    } catch {
      return false;
    }
  }

  function playEscapeVoiceLine(cueIndex, opts = {}) {
    if (disposed) return false;
    const idx = cueIndex | 0;
    if (idx < 1 || idx > BOSS_ESCAPE_VO_COUNT) return false;

    const ctx = ensureGraph();
    if (!ctx) return false;
    if (!preloadStarted) preload(ctx);

    // Cleanly stop any previously playing escape voice line (zero overlap)
    if (activeVoice && !activeVoice.stopped) {
      fadeOutVoiceEntry(activeVoice, 0.035);
    }

    const token = ++voicePlayToken;
    const buf = voBuffers.get(idx);
    if (buf) {
      return startDecodedVoice(ctx, idx, buf, opts);
    }

    // On-demand decode fallback if triggered before preload finished
    const reqMs = nowMs();
    loadVoiceCue(idx, ctx).then((decoded) => {
      if (!decoded || disposed || token !== voicePlayToken) return;
      const delaySec = (nowMs() - reqMs) * 0.001;
      const syncOffset = (delaySec > 0.16 && delaySec < decoded.duration * 0.45)
        ? (Number(opts.offsetSec) || 0) + delaySec
        : (Number(opts.offsetSec) || 0);
      const liveCtx = ensureGraph();
      if (liveCtx) {
        startDecodedVoice(liveCtx, idx, decoded, { ...opts, offsetSec: syncOffset });
      }
    });
    return true;
  }

  function stopEscapeVoice(fadeSec = 0.12) {
    voicePlayToken++;
    let stopped = false;
    if (activeVoice && !activeVoice.stopped) {
      fadeOutVoiceEntry(activeVoice, fadeSec);
      stopped = true;
    }
    for (const v of Array.from(fadingVoices)) {
      if (fadeSec <= 0.005) destroyVoiceEntry(v);
    }
    return stopped;
  }

  // ==========================================================================
  // 2. Procedural AAA Web Audio SFX (Pure Web Audio, Zero External Assets)
  // ==========================================================================

  /**
   * 1) playSwordParryClash(intensity = 1.0)
   * Ringing forged-steel blade clash against heavy warhammer iron shaft + blade grind scrape.
   */
  function playSwordParryClash(intensity = 1.0) {
    const ctx = ensureGraph();
    if (!ctx || readSfxVol() <= 0.001) return false;

    const scale = clamp(intensity, 0.25, 1.6);
    const t0 = ctx.currentTime;
    const pitchJitter = 0.96 + Math.random() * 0.08;
    const nodes = [];
    const stops = [];

    const out = ctx.createGain();
    out.gain.setValueAtTime(0.88 * scale, t0);
    out.connect(sfxBus);
    sendToCathedral(ctx, out, 0.34, nodes);
    nodes.push(out);

    // Layer A: Razor-sharp steel impact spark crack (2.2-6.5 kHz burst, 32ms)
    const sparkSrc = ctx.createBufferSource();
    sparkSrc.buffer = crispNoiseBuf;
    const sparkBp = ctx.createBiquadFilter();
    sparkBp.type = 'bandpass';
    sparkBp.frequency.setValueAtTime(clampFreq(ctx, 3850 * pitchJitter), t0);
    sparkBp.Q.setValueAtTime(1.1, t0);
    const sparkG = ctx.createGain();
    sparkG.gain.setValueAtTime(0.0001, t0);
    sparkG.gain.linearRampToValueAtTime(0.72, t0 + 0.002);
    sparkG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.048);
    sparkSrc.connect(sparkBp);
    sparkBp.connect(sparkG);
    sparkG.connect(out);
    sparkSrc.start(t0, Math.random() * 0.5, 0.06);
    nodes.push(sparkSrc, sparkBp, sparkG);
    stops.push(sparkSrc);

    // Layer B: Heavy iron warhammer shaft impact body (240 Hz + 435 Hz)
    const shaftFreqs = [235, 428, 695];
    for (let i = 0; i < shaftFreqs.length; i++) {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'triangle' : 'sawtooth';
      const f0 = clampFreq(ctx, shaftFreqs[i] * pitchJitter);
      osc.frequency.setValueAtTime(f0 * 1.14, t0);
      osc.frequency.exponentialRampToValueAtTime(f0, t0 + 0.022);

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(f0 * 1.2, t0);
      bp.Q.setValueAtTime(3.6, t0);

      const g = ctx.createGain();
      const pk = (i === 0 ? 0.42 : 0.22) * (1 - i * 0.14);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(pk, t0 + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16 + i * 0.04);

      osc.connect(bp);
      bp.connect(g);
      g.connect(out);
      osc.start(t0);
      osc.stop(t0 + 0.28);
      nodes.push(osc, bp, g);
      stops.push(osc);
    }

    // Layer C: 5 inharmonic forged-steel longsword modal resonances (ringing shimmer!)
    const bladeModes = [
      { f: 912,  g: 0.24, d: 0.72, pan: -0.22 },
      { f: 1685, g: 0.22, d: 0.64, pan:  0.25 },
      { f: 2470, g: 0.18, d: 0.52, pan: -0.18 },
      { f: 3640, g: 0.13, d: 0.40, pan:  0.30 },
      { f: 5180, g: 0.08, d: 0.26, pan: -0.10 }
    ];
    for (let i = 0; i < bladeModes.length; i++) {
      const m = bladeModes[i];
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const baseF = clampFreq(ctx, m.f * pitchJitter);
      osc.frequency.setValueAtTime(baseF * 1.035, t0);
      osc.frequency.exponentialRampToValueAtTime(baseF, t0 + 0.035);

      const pan = createStereoPannerSafe(ctx, m.pan);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(m.g, t0 + 0.0025);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + m.d);

      osc.connect(g);
      g.connect(pan);
      pan.connect(out);
      osc.start(t0);
      osc.stop(t0 + m.d + 0.03);
      nodes.push(osc, g, pan);
      stops.push(osc);
    }

    // Layer D: Steel-on-steel sliding parry grind / rasp (0.02..0.28s)
    const scrapeSrc = ctx.createBufferSource();
    scrapeSrc.buffer = crispNoiseBuf;
    const scrapeBp = ctx.createBiquadFilter();
    scrapeBp.type = 'bandpass';
    scrapeBp.Q.setValueAtTime(6.5, t0);
    scrapeBp.frequency.setValueAtTime(clampFreq(ctx, 1950 * pitchJitter), t0 + 0.015);
    scrapeBp.frequency.exponentialRampToValueAtTime(clampFreq(ctx, 4150 * pitchJitter), t0 + 0.11);
    scrapeBp.frequency.exponentialRampToValueAtTime(clampFreq(ctx, 2550 * pitchJitter), t0 + 0.27);
    const scrapeG = ctx.createGain();
    scrapeG.gain.setValueAtTime(0.0001, t0);
    scrapeG.gain.linearRampToValueAtTime(0.32, t0 + 0.035);
    scrapeG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.29);
    scrapeSrc.connect(scrapeBp);
    scrapeBp.connect(scrapeG);
    scrapeG.connect(out);
    scrapeSrc.start(t0 + 0.01, Math.random() * 0.4, 0.30);
    nodes.push(scrapeSrc, scrapeBp, scrapeG);
    stops.push(scrapeSrc);

    const stopFn = () => {
      for (let i = 0; i < stops.length; i++) safeStop(stops[i]);
      safeDisconnectList(nodes);
    };
    const unregister = registerOneShotCleanup(stopFn, 0.85);
    trackTimer(() => {
      unregister();
      safeDisconnectList(nodes);
    }, 900);
    return true;
  }

  /**
   * 2) playSwordDisarmClatter()
   * Wrenching disarm knock + flying sword spin + multi-bounce stone clatter & sliding steel rasp.
   */
  function playSwordDisarmClatter() {
    const ctx = ensureGraph();
    if (!ctx || readSfxVol() <= 0.001) return false;

    const t0 = ctx.currentTime;
    const nodes = [];
    const stops = [];

    const out = ctx.createGain();
    out.gain.setValueAtTime(0.90, t0);
    out.connect(sfxBus);
    sendToCathedral(ctx, out, 0.38, nodes);
    nodes.push(out);

    // 1. Initial wrenching disarm knock at t = 0.00s (iron punch + sword whip)
    const knockOsc = ctx.createOscillator();
    knockOsc.type = 'triangle';
    knockOsc.frequency.setValueAtTime(165, t0);
    knockOsc.frequency.exponentialRampToValueAtTime(58, t0 + 0.14);
    const knockG = ctx.createGain();
    knockG.gain.setValueAtTime(0.0001, t0);
    knockG.gain.linearRampToValueAtTime(0.58, t0 + 0.004);
    knockG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.17);
    knockOsc.connect(knockG);
    knockG.connect(out);
    knockOsc.start(t0);
    knockOsc.stop(t0 + 0.19);
    nodes.push(knockOsc, knockG);
    stops.push(knockOsc);

    // Spinning blade air whoosh while flying across the hall (0.04..0.32s)
    const spinSrc = ctx.createBufferSource();
    spinSrc.buffer = warmNoiseBuf;
    const spinBp = ctx.createBiquadFilter();
    spinBp.type = 'bandpass';
    spinBp.Q.setValueAtTime(2.6, t0);
    spinBp.frequency.setValueAtTime(720, t0 + 0.04);
    spinBp.frequency.exponentialRampToValueAtTime(1450, t0 + 0.16);
    spinBp.frequency.exponentialRampToValueAtTime(620, t0 + 0.31);
    const spinG = ctx.createGain();
    spinG.gain.setValueAtTime(0.0001, t0 + 0.03);
    spinG.gain.linearRampToValueAtTime(0.26, t0 + 0.12);
    spinG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.34);
    spinSrc.connect(spinBp);
    spinBp.connect(spinG);
    spinG.connect(out);
    spinSrc.start(t0 + 0.03, 0.2, 0.33);
    nodes.push(spinSrc, spinBp, spinG);
    stops.push(spinSrc);

    // 2. Staggered stone-floor steel blade bounces (primary slam, secondary rattle, micro tip-taps)
    const bounces = [
      { at: 0.00, gain: 0.56, pitch: 0.94, dur: 0.42, pan: -0.05 },
      { at: 0.34, gain: 0.72, pitch: 1.00, dur: 0.55, pan:  0.22 },
      { at: 0.58, gain: 0.44, pitch: 1.13, dur: 0.38, pan:  0.34 },
      { at: 0.79, gain: 0.26, pitch: 1.22, dur: 0.28, pan:  0.42 },
      { at: 0.98, gain: 0.15, pitch: 1.29, dur: 0.20, pan:  0.46 }
    ];
    const partials = [1080, 2190, 3490, 4880];

    for (let b = 0; b < bounces.length; b++) {
      const ev = bounces[b];
      const tb = t0 + ev.at;
      const pan = createStereoPannerSafe(ctx, ev.pan);
      pan.connect(out);
      nodes.push(pan);

      // Stone impact thwack
      const sSrc = ctx.createBufferSource();
      sSrc.buffer = crispNoiseBuf;
      const sBp = ctx.createBiquadFilter();
      sBp.type = 'bandpass';
      sBp.frequency.setValueAtTime(clampFreq(ctx, 1150 * ev.pitch), tb);
      sBp.Q.setValueAtTime(1.8, tb);
      const sG = ctx.createGain();
      sG.gain.setValueAtTime(0.0001, tb);
      sG.gain.linearRampToValueAtTime(ev.gain * 0.48, tb + 0.002);
      sG.gain.exponentialRampToValueAtTime(0.0001, tb + 0.045);
      sSrc.connect(sBp);
      sBp.connect(sG);
      sG.connect(pan);
      sSrc.start(tb, (b * 0.19) % 0.8, 0.06);
      nodes.push(sSrc, sBp, sG);
      stops.push(sSrc);

      // Ringing blade harmonics
      for (let p = 0; p < partials.length; p++) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(clampFreq(ctx, partials[p] * ev.pitch), tb);
        const og = ctx.createGain();
        const pk = ev.gain * (0.24 / (1 + p * 0.65));
        og.gain.setValueAtTime(0.0001, tb);
        og.gain.linearRampToValueAtTime(pk, tb + 0.002);
        og.gain.exponentialRampToValueAtTime(0.0001, tb + ev.dur * (1 - p * 0.14));
        osc.connect(og);
        og.connect(pan);
        osc.start(tb);
        osc.stop(tb + ev.dur + 0.03);
        nodes.push(osc, og);
        stops.push(osc);
      }
    }

    // 3. Sliding steel blade across stone flagstones (0.62..1.32s)
    const slideSrc = ctx.createBufferSource();
    slideSrc.buffer = crispNoiseBuf;
    const slideBp = ctx.createBiquadFilter();
    slideBp.type = 'bandpass';
    slideBp.Q.setValueAtTime(5.2, t0 + 0.60);
    slideBp.frequency.setValueAtTime(3400, t0 + 0.60);
    slideBp.frequency.exponentialRampToValueAtTime(1550, t0 + 1.28);
    const slidePan = createStereoPannerSafe(ctx, 0.36);
    const slideG = ctx.createGain();
    slideG.gain.setValueAtTime(0.0001, t0 + 0.60);
    slideG.gain.linearRampToValueAtTime(0.24, t0 + 0.68);
    slideG.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.32);
    slideSrc.connect(slideBp);
    slideBp.connect(slideG);
    slideG.connect(slidePan);
    slidePan.connect(out);
    slideSrc.start(t0 + 0.60, 0.35, 0.74);
    nodes.push(slideSrc, slideBp, slideG, slidePan);
    stops.push(slideSrc);

    const stopFn = () => {
      for (let i = 0; i < stops.length; i++) safeStop(stops[i]);
      safeDisconnectList(nodes);
    };
    const unregister = registerOneShotCleanup(stopFn, 1.45);
    trackTimer(() => {
      unregister();
      safeDisconnectList(nodes);
    }, 1500);
    return true;
  }

  /**
   * 3) playHeroKnockdownThud()
   * Heavy armored fall onto stone flagstones: deep chest impact + steel breastplate clank + rattle.
   */
  function playHeroKnockdownThud() {
    const ctx = ensureGraph();
    if (!ctx || readSfxVol() <= 0.001) return false;

    const t0 = ctx.currentTime;
    const nodes = [];
    const stops = [];

    const out = ctx.createGain();
    out.gain.setValueAtTime(0.92, t0);
    out.connect(sfxBus);
    sendToCathedral(ctx, out, 0.32, nodes);
    nodes.push(out);

    // Sub-bass stone body impact (96 -> 33 Hz)
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(98, t0);
    sub.frequency.exponentialRampToValueAtTime(33, t0 + 0.24);
    const subG = ctx.createGain();
    subG.gain.setValueAtTime(0.0001, t0);
    subG.gain.linearRampToValueAtTime(0.84, t0 + 0.006);
    subG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
    sub.connect(subG);
    subG.connect(out);
    sub.start(t0);
    sub.stop(t0 + 0.35);
    nodes.push(sub, subG);
    stops.push(sub);

    // Dull plate-on-stone body thump noise (120..620 Hz)
    const thudSrc = ctx.createBufferSource();
    thudSrc.buffer = warmNoiseBuf;
    const thudLp = ctx.createBiquadFilter();
    thudLp.type = 'lowpass';
    thudLp.frequency.setValueAtTime(680, t0);
    thudLp.frequency.exponentialRampToValueAtTime(180, t0 + 0.22);
    const thudG = ctx.createGain();
    thudG.gain.setValueAtTime(0.0001, t0);
    thudG.gain.linearRampToValueAtTime(0.76, t0 + 0.005);
    thudG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.26);
    thudSrc.connect(thudLp);
    thudLp.connect(thudG);
    thudG.connect(out);
    thudSrc.start(t0, Math.random() * 1.5, 0.28);
    nodes.push(thudSrc, thudLp, thudG);
    stops.push(thudSrc);

    // Heavy cuirass / greaves damped steel clank
    const plateModes = [390, 685, 1140];
    for (let i = 0; i < plateModes.length; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(plateModes[i], t0);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(plateModes[i], t0);
      bp.Q.setValueAtTime(3.2, t0);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.28 / (1 + i * 0.5), t0 + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
      osc.connect(bp);
      bp.connect(g);
      g.connect(out);
      osc.start(t0);
      osc.stop(t0 + 0.17);
      nodes.push(osc, bp, g);
      stops.push(osc);
    }

    // Secondary pauldron / chainmail settle rattles (0.13s and 0.25s)
    const settles = [
      { at: 0.13, f: 2850, g: 0.26, d: 0.11 },
      { at: 0.25, f: 3420, g: 0.17, d: 0.09 }
    ];
    for (let i = 0; i < settles.length; i++) {
      const ev = settles[i];
      const rSrc = ctx.createBufferSource();
      rSrc.buffer = crispNoiseBuf;
      const rBp = ctx.createBiquadFilter();
      rBp.type = 'bandpass';
      rBp.frequency.setValueAtTime(ev.f, t0 + ev.at);
      rBp.Q.setValueAtTime(4.2, t0 + ev.at);
      const rG = ctx.createGain();
      rG.gain.setValueAtTime(0.0001, t0 + ev.at);
      rG.gain.linearRampToValueAtTime(ev.g, t0 + ev.at + 0.005);
      rG.gain.exponentialRampToValueAtTime(0.0001, t0 + ev.at + ev.d);
      rSrc.connect(rBp);
      rBp.connect(rG);
      rG.connect(out);
      rSrc.start(t0 + ev.at, i * 0.3, ev.d + 0.02);
      nodes.push(rSrc, rBp, rG);
      stops.push(rSrc);
    }

    const stopFn = () => {
      for (let i = 0; i < stops.length; i++) safeStop(stops[i]);
      safeDisconnectList(nodes);
    };
    const unregister = registerOneShotCleanup(stopFn, 0.55);
    trackTimer(() => {
      unregister();
      safeDisconnectList(nodes);
    }, 600);
    return true;
  }

  /**
   * 4) playArmorScootScrape()
   * Gritty plate-armor & leather scrape across limestone flagstones during frightened backward scoot.
   */
  function playArmorScootScrape() {
    const ctx = ensureGraph();
    if (!ctx || readSfxVol() <= 0.001) return false;

    const t0 = ctx.currentTime;
    const jit = 0.90 + Math.random() * 0.20;
    const panVal = (Math.random() - 0.5) * 0.26;
    const nodes = [];
    const stops = [];

    const out = ctx.createGain();
    out.gain.setValueAtTime(0.95, t0);
    const pan = createStereoPannerSafe(ctx, panVal);
    out.connect(pan);
    pan.connect(sfxBus);
    sendToCathedral(ctx, out, 0.24, nodes);
    nodes.push(out, pan);

    // Layer A: Coarse limestone friction drag (520 -> 360 Hz)
    const gritSrc = ctx.createBufferSource();
    gritSrc.buffer = warmNoiseBuf;
    const gritBp = ctx.createBiquadFilter();
    gritBp.type = 'bandpass';
    gritBp.Q.setValueAtTime(2.0, t0);
    gritBp.frequency.setValueAtTime(clampFreq(ctx, 560 * jit), t0);
    gritBp.frequency.exponentialRampToValueAtTime(clampFreq(ctx, 350 * jit), t0 + 0.30);
    const gritG = ctx.createGain();
    gritG.gain.setValueAtTime(0.0001, t0);
    gritG.gain.linearRampToValueAtTime(0.58, t0 + 0.055);
    gritG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.34);
    gritSrc.connect(gritBp);
    gritBp.connect(gritG);
    gritG.connect(out);
    gritSrc.start(t0, Math.random() * 2.5, 0.36);
    nodes.push(gritSrc, gritBp, gritG);
    stops.push(gritSrc);

    // Layer B: Greaves/gauntlet steel-on-stone high scrape (2100 -> 1480 Hz)
    const metalSrc = ctx.createBufferSource();
    metalSrc.buffer = crispNoiseBuf;
    const metalBp = ctx.createBiquadFilter();
    metalBp.type = 'bandpass';
    metalBp.Q.setValueAtTime(5.4, t0);
    metalBp.frequency.setValueAtTime(clampFreq(ctx, 2150 * jit), t0);
    metalBp.frequency.exponentialRampToValueAtTime(clampFreq(ctx, 1480 * jit), t0 + 0.26);
    const metalG = ctx.createGain();
    metalG.gain.setValueAtTime(0.0001, t0);
    metalG.gain.linearRampToValueAtTime(0.28, t0 + 0.045);
    metalG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.29);
    metalSrc.connect(metalBp);
    metalBp.connect(metalG);
    metalG.connect(out);
    metalSrc.start(t0, Math.random() * 0.9, 0.31);
    nodes.push(metalSrc, metalBp, metalG);
    stops.push(metalSrc);

    // Layer C: Two subtle articulated armor-plate joint clinks
    const clinks = [
      { at: 0.04, f: 960 * jit,  g: 0.14 },
      { at: 0.16, f: 1580 * jit, g: 0.10 }
    ];
    for (let i = 0; i < clinks.length; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(clampFreq(ctx, clinks[i].f), t0 + clinks[i].at);
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0.0001, t0 + clinks[i].at);
      cg.gain.linearRampToValueAtTime(clinks[i].g, t0 + clinks[i].at + 0.003);
      cg.gain.exponentialRampToValueAtTime(0.0001, t0 + clinks[i].at + 0.065);
      osc.connect(cg);
      cg.connect(out);
      osc.start(t0 + clinks[i].at);
      osc.stop(t0 + clinks[i].at + 0.08);
      nodes.push(osc, cg);
      stops.push(osc);
    }

    const stopFn = () => {
      for (let i = 0; i < stops.length; i++) safeStop(stops[i]);
      safeDisconnectList(nodes);
    };
    const unregister = registerOneShotCleanup(stopFn, 0.45);
    trackTimer(() => {
      unregister();
      safeDisconnectList(nodes);
    }, 500);
    return true;
  }

  /**
   * 5) playSlowMoPulse()
   * Deep cinematic sub-bass "time-dilation whoosh" & vacuum suction dive.
   */
  function playSlowMoPulse() {
    const ctx = ensureGraph();
    if (!ctx || readSfxVol() <= 0.001) return false;

    const t0 = ctx.currentTime;
    const nodes = [];
    const stops = [];

    const out = ctx.createGain();
    out.gain.setValueAtTime(0.90, t0);
    out.connect(sfxBus);
    sendToCathedral(ctx, out, 0.44, nodes);
    nodes.push(out);

    // Layer A: Massive pitch-diving sub-bass sine (116 -> 28 Hz over 0.92s)
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(116, t0);
    sub.frequency.exponentialRampToValueAtTime(42, t0 + 0.36);
    sub.frequency.exponentialRampToValueAtTime(28, t0 + 0.96);
    const subG = ctx.createGain();
    subG.gain.setValueAtTime(0.0001, t0);
    subG.gain.linearRampToValueAtTime(0.82, t0 + 0.055);
    subG.gain.linearRampToValueAtTime(0.54, t0 + 0.55);
    subG.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.05);
    sub.connect(subG);
    subG.connect(out);
    sub.start(t0);
    sub.stop(t0 + 1.08);
    nodes.push(sub, subG);
    stops.push(sub);

    // Layer B: Dark fifth-harmonic pressure swell (174 -> 42 Hz, warm triangle)
    const fifth = ctx.createOscillator();
    fifth.type = 'triangle';
    fifth.frequency.setValueAtTime(174, t0);
    fifth.frequency.exponentialRampToValueAtTime(42, t0 + 0.92);
    const fifthLp = ctx.createBiquadFilter();
    fifthLp.type = 'lowpass';
    fifthLp.frequency.setValueAtTime(340, t0);
    fifthLp.frequency.exponentialRampToValueAtTime(95, t0 + 0.88);
    const fifthG = ctx.createGain();
    fifthG.gain.setValueAtTime(0.0001, t0);
    fifthG.gain.linearRampToValueAtTime(0.36, t0 + 0.08);
    fifthG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.95);
    fifth.connect(fifthLp);
    fifthLp.connect(fifthG);
    fifthG.connect(out);
    fifth.start(t0);
    fifth.stop(t0 + 0.98);
    nodes.push(fifth, fifthLp, fifthG);
    stops.push(fifth);

    // Layer C: Time-dilation air-suction whoosh (sweeping resonant bandpass noise)
    const airSrc = ctx.createBufferSource();
    airSrc.buffer = warmNoiseBuf;
    const airLp = ctx.createBiquadFilter();
    airLp.type = 'lowpass';
    airLp.Q.setValueAtTime(2.8, t0);
    airLp.frequency.setValueAtTime(220, t0);
    airLp.frequency.exponentialRampToValueAtTime(980, t0 + 0.24);
    airLp.frequency.exponentialRampToValueAtTime(125, t0 + 0.94);
    const airG = ctx.createGain();
    airG.gain.setValueAtTime(0.0001, t0);
    airG.gain.linearRampToValueAtTime(0.52, t0 + 0.20);
    airG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.98);
    airSrc.connect(airLp);
    airLp.connect(airG);
    airG.connect(out);
    airSrc.start(t0, 0.5, 1.02);
    nodes.push(airSrc, airLp, airG);
    stops.push(airSrc);

    // Layer D: Descending icy time-stretch metallic shimmer
    const shimSrc = ctx.createBufferSource();
    shimSrc.buffer = crispNoiseBuf;
    const shimBp = ctx.createBiquadFilter();
    shimBp.type = 'bandpass';
    shimBp.Q.setValueAtTime(8.0, t0);
    shimBp.frequency.setValueAtTime(2900, t0);
    shimBp.frequency.exponentialRampToValueAtTime(640, t0 + 0.85);
    const shimG = ctx.createGain();
    shimG.gain.setValueAtTime(0.0001, t0);
    shimG.gain.linearRampToValueAtTime(0.16, t0 + 0.09);
    shimG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.88);
    shimSrc.connect(shimBp);
    shimBp.connect(shimG);
    shimG.connect(out);
    shimSrc.start(t0, 0.1, 0.92);
    nodes.push(shimSrc, shimBp, shimG);
    stops.push(shimSrc);

    const stopFn = () => {
      for (let i = 0; i < stops.length; i++) safeStop(stops[i]);
      safeDisconnectList(nodes);
    };
    const unregister = registerOneShotCleanup(stopFn, 1.15);
    trackTimer(() => {
      unregister();
      safeDisconnectList(nodes);
    }, 1220);
    return true;
  }

  /**
   * 6) playFloorCollapseSmash()
   * Colossal Titan warhammer ground strike + cracking limestone slabs + cascading abyss collapse.
   */
  function playFloorCollapseSmash() {
    const ctx = ensureGraph();
    if (!ctx || readSfxVol() <= 0.001) return false;

    const t0 = ctx.currentTime;
    const nodes = [];
    const stops = [];

    const out = ctx.createGain();
    out.gain.setValueAtTime(0.98, t0);
    out.connect(sfxBus);
    sendToCathedral(ctx, out, 0.55, nodes);
    nodes.push(out);

    // Layer A: Tectonic Warhammer sub-shockwave (142 -> 25 Hz)
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(142, t0);
    sub.frequency.exponentialRampToValueAtTime(46, t0 + 0.16);
    sub.frequency.exponentialRampToValueAtTime(25, t0 + 0.85);
    const subG = ctx.createGain();
    subG.gain.setValueAtTime(0.0001, t0);
    subG.gain.linearRampToValueAtTime(0.95, t0 + 0.004);
    subG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.96);
    sub.connect(subG);
    subG.connect(out);
    sub.start(t0);
    sub.stop(t0 + 1.0);
    nodes.push(sub, subG);
    stops.push(sub);

    // Layer B: Heavy forged iron hammer blast transient
    const blastSrc = ctx.createBufferSource();
    blastSrc.buffer = crispNoiseBuf;
    const blastLp = ctx.createBiquadFilter();
    blastLp.type = 'lowpass';
    blastLp.frequency.setValueAtTime(5200, t0);
    blastLp.frequency.exponentialRampToValueAtTime(420, t0 + 0.34);
    const blastG = ctx.createGain();
    blastG.gain.setValueAtTime(0.0001, t0);
    blastG.gain.linearRampToValueAtTime(0.88, t0 + 0.002);
    blastG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.38);
    blastSrc.connect(blastLp);
    blastLp.connect(blastG);
    blastG.connect(out);
    blastSrc.start(t0, 0, 0.42);
    nodes.push(blastSrc, blastLp, blastG);
    stops.push(blastSrc);

    // Layer C: 6 staggered violent limestone slab fractures (0.04..0.68s)
    const cracks = [
      { at: 0.04, f: 1680, q: 2.2, g: 0.62, d: 0.14, pan: -0.35 },
      { at: 0.12, f: 2450, q: 2.8, g: 0.54, d: 0.12, pan:  0.38 },
      { at: 0.21, f: 1120, q: 1.9, g: 0.66, d: 0.18, pan: -0.18 },
      { at: 0.33, f: 1940, q: 2.5, g: 0.52, d: 0.16, pan:  0.46 },
      { at: 0.47, f: 980,  q: 1.7, g: 0.58, d: 0.22, pan: -0.44 },
      { at: 0.64, f: 1420, q: 2.4, g: 0.46, d: 0.19, pan:  0.22 }
    ];
    for (let i = 0; i < cracks.length; i++) {
      const c = cracks[i];
      const tc = t0 + c.at;
      const cSrc = ctx.createBufferSource();
      cSrc.buffer = crispNoiseBuf;
      const cBp = ctx.createBiquadFilter();
      cBp.type = 'bandpass';
      cBp.frequency.setValueAtTime(c.f, tc);
      cBp.frequency.exponentialRampToValueAtTime(c.f * 0.48, tc + c.d);
      cBp.Q.setValueAtTime(c.q, tc);
      const cPan = createStereoPannerSafe(ctx, c.pan);
      const cG = ctx.createGain();
      cG.gain.setValueAtTime(0.0001, tc);
      cG.gain.linearRampToValueAtTime(c.g, tc + 0.004);
      cG.gain.exponentialRampToValueAtTime(0.0001, tc + c.d);
      cSrc.connect(cBp);
      cBp.connect(cG);
      cG.connect(cPan);
      cPan.connect(out);
      cSrc.start(tc, (i * 0.23) % 1.0, c.d + 0.03);
      nodes.push(cSrc, cBp, cG, cPan);
      stops.push(cSrc);
    }

    // Layer D: Massive rolling abyssal floor collapse & cascading boulders (0.16..2.45s)
    const rumbleSrc = ctx.createBufferSource();
    rumbleSrc.buffer = warmNoiseBuf;
    rumbleSrc.loop = true;
    const rumbleLp = ctx.createBiquadFilter();
    rumbleLp.type = 'lowpass';
    rumbleLp.Q.setValueAtTime(1.1, t0 + 0.16);
    rumbleLp.frequency.setValueAtTime(520, t0 + 0.16);
    rumbleLp.frequency.exponentialRampToValueAtTime(240, t0 + 1.15);
    rumbleLp.frequency.exponentialRampToValueAtTime(95, t0 + 2.45);
    const rumbleG = ctx.createGain();
    rumbleG.gain.setValueAtTime(0.0001, t0 + 0.14);
    rumbleG.gain.linearRampToValueAtTime(0.86, t0 + 0.34);
    rumbleG.gain.linearRampToValueAtTime(0.56, t0 + 1.25);
    rumbleG.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.55);
    rumbleSrc.connect(rumbleLp);
    rumbleLp.connect(rumbleG);
    rumbleG.connect(out);
    rumbleSrc.start(t0 + 0.14, 0.6);
    rumbleSrc.stop(t0 + 2.60);
    nodes.push(rumbleSrc, rumbleLp, rumbleG);
    stops.push(rumbleSrc);

    // Secondary tumbling stone debris clatters dropping down into the shaft (0.75..2.05s)
    const debris = [0.78, 0.96, 1.18, 1.42, 1.70, 1.96];
    for (let i = 0; i < debris.length; i++) {
      const td = t0 + debris[i];
      const depthFade = 1.0 - i * 0.13;
      const dSrc = ctx.createBufferSource();
      dSrc.buffer = crispNoiseBuf;
      const dBp = ctx.createBiquadFilter();
      dBp.type = 'bandpass';
      dBp.frequency.setValueAtTime(clampFreq(ctx, (1350 - i * 145)), td);
      dBp.Q.setValueAtTime(1.6, td);
      const dPan = createStereoPannerSafe(ctx, (i % 2 === 0 ? -0.52 : 0.52) * depthFade);
      const dG = ctx.createGain();
      dG.gain.setValueAtTime(0.0001, td);
      dG.gain.linearRampToValueAtTime(0.32 * depthFade, td + 0.008);
      dG.gain.exponentialRampToValueAtTime(0.0001, td + 0.22);
      dSrc.connect(dBp);
      dBp.connect(dG);
      dG.connect(dPan);
      dPan.connect(out);
      dSrc.start(td, (i * 0.27) % 1.0, 0.25);
      nodes.push(dSrc, dBp, dG, dPan);
      stops.push(dSrc);
    }

    const stopFn = () => {
      for (let i = 0; i < stops.length; i++) safeStop(stops[i]);
      safeDisconnectList(nodes);
    };
    const unregister = registerOneShotCleanup(stopFn, 2.7);
    trackTimer(() => {
      unregister();
      safeDisconnectList(nodes);
    }, 2800);
    return true;
  }

  /**
   * 7) playChasmWindFall(active)
   * Continuous rushing vertical-shaft fall wind & helmet whistle (stateful start/stop).
   */
  function stopChasmWindInternal(fadeSec = 0.42) {
    if (!chasmWindState) return;
    const st = chasmWindState;
    chasmWindState = null;
    st.active = false;
    if (st.stopTimer !== null) {
      clearTrackedTimer(st.stopTimer);
      st.stopTimer = null;
    }

    const ctx = st.ctx;
    const safeFade = clamp(fadeSec, 0.02, 2.0);
    if (ctx && st.masterGain && ctx.state !== 'closed') {
      const t = ctx.currentTime;
      try {
        st.masterGain.gain.cancelScheduledValues(t);
        const cur = Number.isFinite(st.masterGain.gain.value) ? st.masterGain.gain.value : 0.01;
        st.masterGain.gain.setValueAtTime(Math.max(0.0001, cur), t);
        st.masterGain.gain.linearRampToValueAtTime(0.0001, t + safeFade);
      } catch {}
    }

    trackTimer(() => {
      for (let i = 0; i < st.stops.length; i++) safeStop(st.stops[i]);
      safeDisconnectList(st.nodes);
    }, Math.ceil((safeFade + 0.05) * 1000));
  }

  function playChasmWindFall(active) {
    const wantActive = Boolean(active);
    if (!wantActive) {
      stopChasmWindInternal(0.42);
      return true;
    }
    if (chasmWindState && chasmWindState.active) return true;

    const ctx = ensureGraph();
    if (!ctx || readSfxVol() <= 0.001) return false;

    const t0 = ctx.currentTime;
    const nodes = [];
    const stops = [];

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, t0);
    master.gain.linearRampToValueAtTime(0.74, t0 + 0.38);
    master.connect(sfxBus);
    sendToCathedral(ctx, master, 0.25, nodes);
    nodes.push(master);

    // Layer 1: Deep vertical shaft air rush (130..420 Hz modulated bandpass)
    const rushSrc = ctx.createBufferSource();
    rushSrc.buffer = warmNoiseBuf;
    rushSrc.loop = true;
    const rushBp = ctx.createBiquadFilter();
    rushBp.type = 'bandpass';
    rushBp.frequency.setValueAtTime(250, t0);
    rushBp.Q.setValueAtTime(0.95, t0);

    const rushLfo = ctx.createOscillator();
    rushLfo.type = 'sine';
    rushLfo.frequency.setValueAtTime(0.68, t0);
    const rushLfoDepth = ctx.createGain();
    rushLfoDepth.gain.setValueAtTime(115, t0);
    rushLfo.connect(rushLfoDepth);
    rushLfoDepth.connect(rushBp.frequency);

    const rushG = ctx.createGain();
    rushG.gain.setValueAtTime(0.85, t0);
    rushSrc.connect(rushBp);
    rushBp.connect(rushG);
    rushG.connect(master);
    rushSrc.start(t0, 0.1);
    rushLfo.start(t0);
    nodes.push(rushSrc, rushBp, rushLfo, rushLfoDepth, rushG);
    stops.push(rushSrc, rushLfo);

    // Layer 2: Howling chasm helmet wind whistle (580..1080 Hz narrow bandpass)
    const howlSrc = ctx.createBufferSource();
    howlSrc.buffer = warmNoiseBuf;
    howlSrc.loop = true;
    const howlBp = ctx.createBiquadFilter();
    howlBp.type = 'bandpass';
    howlBp.frequency.setValueAtTime(760, t0);
    howlBp.Q.setValueAtTime(4.8, t0);

    const howlLfo = ctx.createOscillator();
    howlLfo.type = 'sine';
    howlLfo.frequency.setValueAtTime(0.41, t0);
    const howlLfoDepth = ctx.createGain();
    howlLfoDepth.gain.setValueAtTime(240, t0);
    howlLfo.connect(howlLfoDepth);
    howlLfoDepth.connect(howlBp.frequency);

    const howlG = ctx.createGain();
    howlG.gain.setValueAtTime(0.32, t0);
    howlSrc.connect(howlBp);
    howlBp.connect(howlG);
    howlG.connect(master);
    howlSrc.start(t0, 1.7);
    howlLfo.start(t0);
    nodes.push(howlSrc, howlBp, howlLfo, howlLfoDepth, howlG);
    stops.push(howlSrc, howlLfo);

    // Layer 3: High-velocity air hiss rushing past ears (1600..4400 Hz)
    const hissSrc = ctx.createBufferSource();
    hissSrc.buffer = crispNoiseBuf;
    hissSrc.loop = true;
    const hissBp = ctx.createBiquadFilter();
    hissBp.type = 'bandpass';
    hissBp.frequency.setValueAtTime(2600, t0);
    hissBp.Q.setValueAtTime(0.75, t0);
    const hissG = ctx.createGain();
    hissG.gain.setValueAtTime(0.18, t0);
    hissSrc.connect(hissBp);
    hissBp.connect(hissG);
    hissG.connect(master);
    hissSrc.start(t0, 0.3);
    nodes.push(hissSrc, hissBp, hissG);
    stops.push(hissSrc);

    chasmWindState = {
      ctx,
      masterGain: master,
      nodes,
      stops,
      stopTimer: null,
      active: true
    };
    return true;
  }

  /**
   * 8) playRiverSplashUnderwater()
   * Huge armored plunge into the underground black river + instant low-pass submerged rumble + rising bubbles!
   */
  function playRiverSplashUnderwater() {
    const ctx = ensureGraph();
    if (!ctx || readSfxVol() <= 0.001) return false;

    const t0 = ctx.currentTime;
    const nodes = [];
    const stops = [];

    const out = ctx.createGain();
    out.gain.setValueAtTime(0.94, t0);
    out.connect(sfxBus);
    sendToCathedral(ctx, out, 0.26, nodes);
    nodes.push(out);

    // Layer A: Heavy water-displacement plunge cavity thump (118 -> 34 Hz)
    const plunge = ctx.createOscillator();
    plunge.type = 'sine';
    plunge.frequency.setValueAtTime(118, t0);
    plunge.frequency.exponentialRampToValueAtTime(34, t0 + 0.28);
    const plungeG = ctx.createGain();
    plungeG.gain.setValueAtTime(0.0001, t0);
    plungeG.gain.linearRampToValueAtTime(0.78, t0 + 0.008);
    plungeG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.36);
    plunge.connect(plungeG);
    plungeG.connect(out);
    plunge.start(t0);
    plunge.stop(t0 + 0.39);
    nodes.push(plunge, plungeG);
    stops.push(plunge);

    // Layer B: Violent surface splash burst that rapidly dives underwater (LPF 6400 -> 280 Hz!)
    const splashSrc = ctx.createBufferSource();
    splashSrc.buffer = crispNoiseBuf;
    const splashLp = ctx.createBiquadFilter();
    splashLp.type = 'lowpass';
    splashLp.Q.setValueAtTime(1.1, t0);
    splashLp.frequency.setValueAtTime(6400, t0);
    splashLp.frequency.exponentialRampToValueAtTime(1800, t0 + 0.14);
    splashLp.frequency.exponentialRampToValueAtTime(260, t0 + 0.42);
    const splashG = ctx.createGain();
    splashG.gain.setValueAtTime(0.0001, t0);
    splashG.gain.linearRampToValueAtTime(0.86, t0 + 0.015);
    splashG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.56);
    splashSrc.connect(splashLp);
    splashLp.connect(splashG);
    splashG.connect(out);
    splashSrc.start(t0, 0.05, 0.60);
    nodes.push(splashSrc, splashLp, splashG);
    stops.push(splashSrc);

    // Layer C: Instant submerged muffled underwater river roar (0.10..2.55s, low-passed 260 Hz!)
    const underSrc = ctx.createBufferSource();
    underSrc.buffer = warmNoiseBuf;
    underSrc.loop = true;
    const underLp = ctx.createBiquadFilter();
    underLp.type = 'lowpass';
    underLp.Q.setValueAtTime(2.0, t0 + 0.10);
    underLp.frequency.setValueAtTime(340, t0 + 0.10);
    underLp.frequency.exponentialRampToValueAtTime(220, t0 + 0.65);
    underLp.frequency.linearRampToValueAtTime(310, t0 + 1.80);
    underLp.frequency.exponentialRampToValueAtTime(760, t0 + 2.45); // surfacing toward outlet!

    const underLfo = ctx.createOscillator();
    underLfo.type = 'sine';
    underLfo.frequency.setValueAtTime(1.45, t0 + 0.10);
    const underLfoG = ctx.createGain();
    underLfoG.gain.setValueAtTime(65, t0 + 0.10);
    underLfo.connect(underLfoG);
    underLfoG.connect(underLp.frequency);

    const underG = ctx.createGain();
    underG.gain.setValueAtTime(0.0001, t0 + 0.08);
    underG.gain.linearRampToValueAtTime(0.76, t0 + 0.24);
    underG.gain.linearRampToValueAtTime(0.62, t0 + 2.05);
    underG.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.60);
    underSrc.connect(underLp);
    underLp.connect(underG);
    underG.connect(out);
    underSrc.start(t0 + 0.08, 0.4);
    underSrc.stop(t0 + 2.65);
    underLfo.start(t0 + 0.08);
    underLfo.stop(t0 + 2.65);
    nodes.push(underSrc, underLp, underLfo, underLfoG, underG);
    stops.push(underSrc, underLfo);

    // Layer D: 14 organic submerged rising water bubbles (warm low-passed pitch chirps)
    const bubbleBus = ctx.createBiquadFilter();
    bubbleBus.type = 'lowpass';
    bubbleBus.frequency.setValueAtTime(1250, t0);
    bubbleBus.connect(out);
    nodes.push(bubbleBus);

    const bubbleSpec = [
      [0.18, 280, 0.055, -0.35, 0.24],
      [0.26, 410, 0.045,  0.42, 0.21],
      [0.35, 320, 0.062, -0.18, 0.26],
      [0.44, 520, 0.042,  0.28, 0.19],
      [0.56, 260, 0.068, -0.48, 0.25],
      [0.69, 465, 0.048,  0.15, 0.20],
      [0.84, 355, 0.058,  0.52, 0.22],
      [1.01, 590, 0.040, -0.26, 0.18],
      [1.18, 310, 0.064,  0.34, 0.23],
      [1.37, 495, 0.046, -0.42, 0.19],
      [1.56, 380, 0.052,  0.20, 0.20],
      [1.76, 620, 0.038, -0.14, 0.16],
      [1.96, 340, 0.056,  0.40, 0.18],
      [2.16, 480, 0.044, -0.30, 0.15]
    ];
    for (let i = 0; i < bubbleSpec.length; i++) {
      const [at, f0, dur, panVal, amp] = bubbleSpec[i];
      const tb = t0 + at;
      const bOsc = ctx.createOscillator();
      bOsc.type = 'sine';
      bOsc.frequency.setValueAtTime(f0, tb);
      bOsc.frequency.exponentialRampToValueAtTime(clampFreq(ctx, f0 * 2.18), tb + dur);
      const bPan = createStereoPannerSafe(ctx, panVal);
      const bG = ctx.createGain();
      bG.gain.setValueAtTime(0.0001, tb);
      bG.gain.linearRampToValueAtTime(amp, tb + dur * 0.28);
      bG.gain.exponentialRampToValueAtTime(0.0001, tb + dur);
      bOsc.connect(bG);
      bG.connect(bPan);
      bPan.connect(bubbleBus);
      bOsc.start(tb);
      bOsc.stop(tb + dur + 0.02);
      nodes.push(bOsc, bG, bPan);
      stops.push(bOsc);
    }

    const stopFn = () => {
      for (let i = 0; i < stops.length; i++) safeStop(stops[i]);
      safeDisconnectList(nodes);
    };
    const unregister = registerOneShotCleanup(stopFn, 2.75);
    trackTimer(() => {
      unregister();
      safeDisconnectList(nodes);
    }, 2850);
    return true;
  }

  /**
   * 9) playIronGrateBreak()
   * Rusted spillway iron grate straining, snapping apart with metallic clangs + bursting water surge!
   */
  function playIronGrateBreak() {
    const ctx = ensureGraph();
    if (!ctx || readSfxVol() <= 0.001) return false;

    const t0 = ctx.currentTime;
    const nodes = [];
    const stops = [];

    const out = ctx.createGain();
    out.gain.setValueAtTime(1.18, t0);
    out.connect(sfxBus);
    sendToCathedral(ctx, out, 0.40, nodes);
    nodes.push(out);

    // Layer A: Rusted iron strain screech / wrenching groan (0.00..0.18s)
    const groan = ctx.createOscillator();
    groan.type = 'sawtooth';
    groan.frequency.setValueAtTime(295, t0);
    groan.frequency.exponentialRampToValueAtTime(585, t0 + 0.09);
    groan.frequency.exponentialRampToValueAtTime(215, t0 + 0.19);
    const groanBp = ctx.createBiquadFilter();
    groanBp.type = 'bandpass';
    groanBp.frequency.setValueAtTime(920, t0);
    groanBp.Q.setValueAtTime(5.5, t0);
    const groanG = ctx.createGain();
    groanG.gain.setValueAtTime(0.0001, t0);
    groanG.gain.linearRampToValueAtTime(0.36, t0 + 0.025);
    groanG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.21);
    groan.connect(groanBp);
    groanBp.connect(groanG);
    groanG.connect(out);
    groan.start(t0);
    groan.stop(t0 + 0.23);
    nodes.push(groan, groanBp, groanG);
    stops.push(groan);

    // Layer B: Heavy rusted iron bar fracture snaps (0.05s, 0.12s, 0.22s)
    const snaps = [
      { at: 0.05, base: 310, hi: 1460, g: 0.68, pan: -0.28 },
      { at: 0.12, base: 265, hi: 1920, g: 0.60, pan:  0.34 },
      { at: 0.23, base: 390, hi: 2480, g: 0.42, pan: -0.14 }
    ];
    for (let i = 0; i < snaps.length; i++) {
      const s = snaps[i];
      const ts = t0 + s.at;
      const pan = createStereoPannerSafe(ctx, s.pan);
      pan.connect(out);
      nodes.push(pan);

      // Sharp iron shear crack
      const cSrc = ctx.createBufferSource();
      cSrc.buffer = crispNoiseBuf;
      const cBp = ctx.createBiquadFilter();
      cBp.type = 'bandpass';
      cBp.frequency.setValueAtTime(s.hi * 1.4, ts);
      cBp.Q.setValueAtTime(1.6, ts);
      const cG = ctx.createGain();
      cG.gain.setValueAtTime(0.0001, ts);
      cG.gain.linearRampToValueAtTime(s.g * 0.72, ts + 0.002);
      cG.gain.exponentialRampToValueAtTime(0.0001, ts + 0.075);
      cSrc.connect(cBp);
      cBp.connect(cG);
      cG.connect(pan);
      cSrc.start(ts, i * 0.22, 0.09);
      nodes.push(cSrc, cBp, cG);
      stops.push(cSrc);

      // Hollow iron-bar clang partials
      const barFreqs = [s.base, s.base * 1.84, s.hi, s.hi * 1.63];
      for (let m = 0; m < barFreqs.length; m++) {
        const osc = ctx.createOscillator();
        osc.type = m < 2 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(clampFreq(ctx, barFreqs[m]), ts);
        const og = ctx.createGain();
        og.gain.setValueAtTime(0.0001, ts);
        og.gain.linearRampToValueAtTime(s.g * (0.28 / (1 + m * 0.55)), ts + 0.003);
        og.gain.exponentialRampToValueAtTime(0.0001, ts + 0.34 - m * 0.04);
        osc.connect(og);
        og.connect(pan);
        osc.start(ts);
        osc.stop(ts + 0.38);
        nodes.push(osc, og);
        stops.push(osc);
      }
    }

    // Layer C: Breached spillway water surge rushing out into the night air (0.10..1.05s)
    const surgeSrc = ctx.createBufferSource();
    surgeSrc.buffer = crispNoiseBuf;
    const surgeBp = ctx.createBiquadFilter();
    surgeBp.type = 'bandpass';
    surgeBp.Q.setValueAtTime(0.85, t0 + 0.10);
    surgeBp.frequency.setValueAtTime(620, t0 + 0.10);
    surgeBp.frequency.exponentialRampToValueAtTime(2400, t0 + 0.32);
    surgeBp.frequency.exponentialRampToValueAtTime(840, t0 + 1.00);
    const surgeG = ctx.createGain();
    surgeG.gain.setValueAtTime(0.0001, t0 + 0.10);
    surgeG.gain.linearRampToValueAtTime(0.56, t0 + 0.24);
    surgeG.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.05);
    surgeSrc.connect(surgeBp);
    surgeBp.connect(surgeG);
    surgeG.connect(out);
    surgeSrc.start(t0 + 0.10, 0.25, 0.98);
    nodes.push(surgeSrc, surgeBp, surgeG);
    stops.push(surgeSrc);

    const stopFn = () => {
      for (let i = 0; i < stops.length; i++) safeStop(stops[i]);
      safeDisconnectList(nodes);
    };
    const unregister = registerOneShotCleanup(stopFn, 1.15);
    trackTimer(() => {
      unregister();
      safeDisconnectList(nodes);
    }, 1220);
    return true;
  }

  /**
   * 10) playSwordPickupChime()
   * Noble dark-fantasy forged-steel blade draw & solemn crystalline Oath-Blade chime on the shore.
   */
  function playSwordPickupChime() {
    const ctx = ensureGraph();
    if (!ctx || readSfxVol() <= 0.001) return false;

    const t0 = ctx.currentTime;
    const nodes = [];
    const stops = [];

    const out = ctx.createGain();
    out.gain.setValueAtTime(1.15, t0);
    out.connect(sfxBus);
    sendToCathedral(ctx, out, 0.56, nodes);
    nodes.push(out);

    // Layer A: Subtle wet-gravel pull & forged steel gleam (0.00..0.18s)
    const drawSrc = ctx.createBufferSource();
    drawSrc.buffer = crispNoiseBuf;
    const drawBp = ctx.createBiquadFilter();
    drawBp.type = 'bandpass';
    drawBp.Q.setValueAtTime(3.6, t0);
    drawBp.frequency.setValueAtTime(1450, t0);
    drawBp.frequency.exponentialRampToValueAtTime(3850, t0 + 0.14);
    const drawG = ctx.createGain();
    drawG.gain.setValueAtTime(0.0001, t0);
    drawG.gain.linearRampToValueAtTime(0.24, t0 + 0.025);
    drawG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.19);
    drawSrc.connect(drawBp);
    drawBp.connect(drawG);
    drawG.connect(out);
    drawSrc.start(t0, 0.15, 0.21);
    nodes.push(drawSrc, drawBp, drawG);
    stops.push(drawSrc);

    // Layer B: Crisp blade-ring ping (1320 Hz + 2648 Hz)
    const ringFreqs = [1318.5, 2637.0, 3955.0];
    for (let i = 0; i < ringFreqs.length; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(clampFreq(ctx, ringFreqs[i]), t0 + 0.015);
      const rg = ctx.createGain();
      rg.gain.setValueAtTime(0.0001, t0 + 0.015);
      rg.gain.linearRampToValueAtTime(0.18 / (1 + i * 0.7), t0 + 0.022);
      rg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.75 - i * 0.14);
      osc.connect(rg);
      rg.connect(out);
      osc.start(t0 + 0.015);
      osc.stop(t0 + 0.80);
      nodes.push(osc, rg);
      stops.push(osc);
    }

    // Layer C: Solemn heroic Oath chord bloom (D4 - A4 - E5 - F#5 - A5, staggered ethereal entry)
    const chordFilter = ctx.createBiquadFilter();
    chordFilter.type = 'lowpass';
    chordFilter.frequency.setValueAtTime(4200, t0 + 0.04);
    chordFilter.frequency.exponentialRampToValueAtTime(1400, t0 + 2.15);
    chordFilter.connect(out);
    nodes.push(chordFilter);

    const chordNotes = [
      { f: 293.66, at: 0.03, g: 0.22, d: 2.15, pan: -0.24 }, // D4
      { f: 440.00, at: 0.06, g: 0.20, d: 2.05, pan:  0.22 }, // A4
      { f: 659.25, at: 0.10, g: 0.15, d: 1.90, pan: -0.34 }, // E5
      { f: 739.99, at: 0.14, g: 0.13, d: 1.80, pan:  0.34 }, // F#5
      { f: 880.00, at: 0.18, g: 0.10, d: 1.65, pan:  0.00 }  // A5
    ];
    for (let i = 0; i < chordNotes.length; i++) {
      const n = chordNotes[i];
      const tn = t0 + n.at;
      const pan = createStereoPannerSafe(ctx, n.pan);
      pan.connect(chordFilter);
      nodes.push(pan);

      // Soft detuned pair for warm cathedral choir-bell shimmer
      for (let d = 0; d < 2; d++) {
        const osc = ctx.createOscillator();
        osc.type = d === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(n.f * (d === 0 ? 0.9985 : 1.0018), tn);
        const ng = ctx.createGain();
        const peak = n.g * (d === 0 ? 0.68 : 0.32);
        ng.gain.setValueAtTime(0.0001, tn);
        ng.gain.linearRampToValueAtTime(peak, tn + 0.045);
        ng.gain.exponentialRampToValueAtTime(0.0001, tn + n.d);
        osc.connect(ng);
        ng.connect(pan);
        osc.start(tn);
        osc.stop(tn + n.d + 0.04);
        nodes.push(osc, ng);
        stops.push(osc);
      }
    }

    const stopFn = () => {
      for (let i = 0; i < stops.length; i++) safeStop(stops[i]);
      safeDisconnectList(nodes);
    };
    const unregister = registerOneShotCleanup(stopFn, 2.35);
    trackTimer(() => {
      unregister();
      safeDisconnectList(nodes);
    }, 2450);
    return true;
  }

  /**
   * 11) setExteriorShoreAmbient(active)
   * Continuous nocturnal exterior shore soundscape:
   *   - Flowing black underground river & spillway rapids (dual stereo LFO-modulated water bands)
   *   - Cold night cliff wind (slow non-repeating irrational LFO draft resonance)
   *   - Distant low foreboding Ash Castle sub-drone (46.25 / 69.30 / 92.50 Hz)
   */
  function stopShoreAmbientInternal(fadeSec = 0.85) {
    if (!shoreAmbientState) return;
    const st = shoreAmbientState;
    shoreAmbientState = null;
    st.active = false;
    if (st.stopTimer !== null) {
      clearTrackedTimer(st.stopTimer);
      st.stopTimer = null;
    }

    const ctx = st.ctx;
    const safeFade = clamp(fadeSec, 0.02, 3.0);
    if (ctx && st.masterGain && ctx.state !== 'closed') {
      const t = ctx.currentTime;
      try {
        st.masterGain.gain.cancelScheduledValues(t);
        const cur = Number.isFinite(st.masterGain.gain.value) ? st.masterGain.gain.value : 0.01;
        st.masterGain.gain.setValueAtTime(Math.max(0.0001, cur), t);
        st.masterGain.gain.linearRampToValueAtTime(0.0001, t + safeFade);
      } catch {}
    }

    trackTimer(() => {
      for (let i = 0; i < st.stops.length; i++) safeStop(st.stops[i]);
      safeDisconnectList(st.nodes);
    }, Math.ceil((safeFade + 0.06) * 1000));
  }

  function setExteriorShoreAmbient(active) {
    const wantActive = Boolean(active);
    if (!wantActive) {
      stopShoreAmbientInternal(0.85);
      return true;
    }
    if (shoreAmbientState && shoreAmbientState.active) return true;

    const ctx = ensureGraph();
    if (!ctx) return false;

    const t0 = ctx.currentTime;
    const nodes = [];
    const stops = [];

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, t0);
    master.gain.linearRampToValueAtTime(0.46, t0 + 1.25);
    master.connect(sfxBus);
    nodes.push(master);

    // ------------------------------------------------------------------
    // Layer 1: Flowing Black River & Spillway Rapids (gentle stereo wash)
    // ------------------------------------------------------------------
    const riverBodySrc = ctx.createBufferSource();
    riverBodySrc.buffer = warmNoiseBuf;
    riverBodySrc.loop = true;
    const riverBodyBp = ctx.createBiquadFilter();
    riverBodyBp.type = 'bandpass';
    riverBodyBp.frequency.setValueAtTime(390, t0);
    riverBodyBp.Q.setValueAtTime(0.68, t0);
    const riverBodyLfo = ctx.createOscillator();
    riverBodyLfo.type = 'sine';
    riverBodyLfo.frequency.setValueAtTime(0.16, t0);
    const riverBodyDepth = ctx.createGain();
    riverBodyDepth.gain.setValueAtTime(85, t0);
    riverBodyLfo.connect(riverBodyDepth);
    riverBodyDepth.connect(riverBodyBp.frequency);
    const riverBodyPan = createStereoPannerSafe(ctx, 0.18);
    const riverBodyG = ctx.createGain();
    riverBodyG.gain.setValueAtTime(0.42, t0);
    riverBodySrc.connect(riverBodyBp);
    riverBodyBp.connect(riverBodyG);
    riverBodyG.connect(riverBodyPan);
    riverBodyPan.connect(master);
    riverBodySrc.start(t0, 0.0);
    riverBodyLfo.start(t0);
    nodes.push(riverBodySrc, riverBodyBp, riverBodyLfo, riverBodyDepth, riverBodyPan, riverBodyG);
    stops.push(riverBodySrc, riverBodyLfo);

    // Soft river foam / pebble-shore lapping spray (1100..2600 Hz)
    const spraySrc = ctx.createBufferSource();
    spraySrc.buffer = crispNoiseBuf;
    spraySrc.loop = true;
    const sprayBp = ctx.createBiquadFilter();
    sprayBp.type = 'bandpass';
    sprayBp.frequency.setValueAtTime(1650, t0);
    sprayBp.Q.setValueAtTime(0.85, t0);
    const sprayG = ctx.createGain();
    sprayG.gain.setValueAtTime(0.085, t0);
    const sprayLfo = ctx.createOscillator();
    sprayLfo.type = 'sine';
    sprayLfo.frequency.setValueAtTime(0.27, t0);
    const sprayLfoDepth = ctx.createGain();
    sprayLfoDepth.gain.setValueAtTime(0.028, t0);
    sprayLfo.connect(sprayLfoDepth);
    sprayLfoDepth.connect(sprayG.gain);
    const sprayPan = createStereoPannerSafe(ctx, 0.26);
    spraySrc.connect(sprayBp);
    sprayBp.connect(sprayG);
    sprayG.connect(sprayPan);
    sprayPan.connect(master);
    spraySrc.start(t0, 0.4);
    sprayLfo.start(t0);
    nodes.push(spraySrc, sprayBp, sprayG, sprayLfo, sprayLfoDepth, sprayPan);
    stops.push(spraySrc, sprayLfo);

    // ------------------------------------------------------------------
    // Layer 2: Cold Nocturnal Cliff Wind (slow irrational-period gusts)
    // ------------------------------------------------------------------
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = warmNoiseBuf;
    windSrc.loop = true;
    const windBp = ctx.createBiquadFilter();
    windBp.type = 'bandpass';
    windBp.frequency.setValueAtTime(420, t0);
    windBp.Q.setValueAtTime(3.4, t0);
    const windLfo = ctx.createOscillator();
    windLfo.type = 'sine';
    windLfo.frequency.setValueAtTime(0.093, t0);
    const windLfoDepth = ctx.createGain();
    windLfoDepth.gain.setValueAtTime(175, t0);
    windLfo.connect(windLfoDepth);
    windLfoDepth.connect(windBp.frequency);
    const windG = ctx.createGain();
    windG.gain.setValueAtTime(0.24, t0);
    const windGainLfo = ctx.createOscillator();
    windGainLfo.type = 'sine';
    windGainLfo.frequency.setValueAtTime(0.141, t0);
    const windGainDepth = ctx.createGain();
    windGainDepth.gain.setValueAtTime(0.09, t0);
    windGainLfo.connect(windGainDepth);
    windGainDepth.connect(windG.gain);
    const windPan = createStereoPannerSafe(ctx, -0.22);
    windSrc.connect(windBp);
    windBp.connect(windG);
    windG.connect(windPan);
    windPan.connect(master);
    windSrc.start(t0, 1.9);
    windLfo.start(t0);
    windGainLfo.start(t0);
    nodes.push(windSrc, windBp, windLfo, windLfoDepth, windG, windGainLfo, windGainDepth, windPan);
    stops.push(windSrc, windLfo, windGainLfo);

    // ------------------------------------------------------------------
    // Layer 3: Distant Foreboding Ash Castle Sub-Drone (F#1 + C#2 + F#2)
    // ------------------------------------------------------------------
    const droneLp = ctx.createBiquadFilter();
    droneLp.type = 'lowpass';
    droneLp.frequency.setValueAtTime(165, t0);
    droneLp.Q.setValueAtTime(0.7, t0);
    const droneG = ctx.createGain();
    droneG.gain.setValueAtTime(0.16, t0);
    const droneBreathLfo = ctx.createOscillator();
    droneBreathLfo.type = 'sine';
    droneBreathLfo.frequency.setValueAtTime(0.071, t0);
    const droneBreathDepth = ctx.createGain();
    droneBreathDepth.gain.setValueAtTime(0.045, t0);
    droneBreathLfo.connect(droneBreathDepth);
    droneBreathDepth.connect(droneG.gain);
    droneLp.connect(droneG);
    droneG.connect(master);
    droneBreathLfo.start(t0);
    nodes.push(droneLp, droneG, droneBreathLfo, droneBreathDepth);
    stops.push(droneBreathLfo);

    const droneTones = [
      { f: 46.25, type: 'sine',     g: 0.62 }, // F#1 deep cliff bass
      { f: 69.30, type: 'triangle', g: 0.24 }, // C#2 fifth shadow
      { f: 92.50, type: 'sine',     g: 0.16 }  // F#2 distant fortress hum
    ];
    for (let i = 0; i < droneTones.length; i++) {
      const dt = droneTones[i];
      const osc = ctx.createOscillator();
      osc.type = dt.type;
      osc.frequency.setValueAtTime(dt.f, t0);
      const tg = ctx.createGain();
      tg.gain.setValueAtTime(dt.g, t0);
      osc.connect(tg);
      tg.connect(droneLp);
      osc.start(t0);
      nodes.push(osc, tg);
      stops.push(osc);
    }

    shoreAmbientState = {
      ctx,
      masterGain: master,
      nodes,
      stops,
      stopTimer: null,
      active: true
    };
    return true;
  }

  // ==========================================================================
  // 3. Global Stop, Mute, Volume & Lifecycle Cleanup
  // ==========================================================================

  function stopAll(fadeSec = 0.2) {
    const safeFade = clamp(fadeSec, 0.02, 2.5);
    stopEscapeVoice(safeFade);
    stopChasmWindInternal(safeFade);
    stopShoreAmbientInternal(safeFade);

    if (safeFade <= 0.05) {
      for (const stopFn of Array.from(activeOneShotStops)) {
        try { stopFn(); } catch {}
      }
      activeOneShotStops.clear();
    }
    return true;
  }

  function setMuted(isMuted) {
    muted = Boolean(isMuted);
    if (busCtx && busCtx.state !== 'closed' && sfxBus && voiceBus) {
      const t = busCtx.currentTime;
      sfxBus.gain.setTargetAtTime(readSfxVol(), t, 0.02);
      voiceBus.gain.setTargetAtTime(readVoiceVol(), t, 0.02);
    }
    return muted;
  }

  function setVoiceVolume(val) {
    const num = Number(val);
    if (Number.isFinite(num)) {
      voiceVolumeScale = clamp(num, 0, 1.6);
      if (busCtx && busCtx.state !== 'closed' && voiceBus) {
        voiceBus.gain.setTargetAtTime(readVoiceVol(), busCtx.currentTime, 0.02);
      }
    }
    return voiceVolumeScale;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    stopAll(0.01);
    for (const tid of Array.from(activeTimers)) {
      clearTimeout(tid);
    }
    activeTimers.clear();
    for (const stopFn of Array.from(activeOneShotStops)) {
      try { stopFn(); } catch {}
    }
    activeOneShotStops.clear();
    safeDisconnectList(busNodes);
    busNodes = [];
    voBuffers.clear();
    pendingVoLoads.clear();
    busCtx = null;
    busDest = null;
    sfxBus = null;
    voiceBus = null;
    reverbSendBus = null;
    escapeOutGain = null;
  }

  return {
    preload,
    playEscapeVoiceLine,
    stopEscapeVoice,
    stopAll,

    // Procedural AAA Escape Cutscene & Exterior Shore SFX
    playSwordParryClash,
    playSwordDisarmClatter,
    playHeroKnockdownThud,
    playArmorScootScrape,
    playSlowMoPulse,
    playFloorCollapseSmash,
    playChasmWindFall,
    playRiverSplashUnderwater,
    playIronGrateBreak,
    playSwordPickupChime,
    setExteriorShoreAmbient,

    // Controls & state inspection
    setMuted,
    setVoiceVolume,
    isVoicePlaying: () => Boolean(activeVoice && !activeVoice.stopped),
    isChasmWindActive: () => Boolean(chasmWindState && chasmWindState.active),
    isExteriorShoreAmbientActive: () => Boolean(shoreAmbientState && shoreAmbientState.active),
    dispose
  };
}
