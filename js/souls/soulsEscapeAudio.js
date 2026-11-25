// Grimborne Hunters — Judge of Ruins Escape Cutscene Voiceover & River/Wind Ambient Engine
// Pure Vanilla ES Module (Web Audio API, ZERO oscillators, ZERO CPU convolvers, ZERO GC in hot paths).
//
// All combat impacts, sword clashes, blocks, armor scrapes, boss footsteps & hammer slams are routed
// through the game's real native WAV/MP3 audio subsystems in `js/audio.js`.
// This module handles ONLY:
//   1. Authentic ElevenLabs `speech boss v2` voiceover (`boss_escape_vo_01..03.mp3` — same voice as Cutscene #1)
//      + exact 30-FPS lip-sync curves (`BOSS_ESCAPE_VO_DURATIONS_SEC`, `sampleEscapeBossMouthOpen`)
//   2. Lightweight filtered-noise environmental beds (chasm fall wind, river plunge, exterior shore river/waterfall).

export const SOULS_ESCAPE_AUDIO_VERSION = '20261125z106';
export const BOSS_ESCAPE_VO_COUNT = 3;
export const BOSS_ESCAPE_LIPSYNC_FPS = 30;

const BASE_AUDIO_PATH = './assets/audio';
const INV_2_POW_31 = 2 / 4294967296;

export const BOSS_ESCAPE_VO_DURATIONS_SEC = Object.freeze({
  1: 1.935, // 1935 ms — [chuckle] Leaving so soon, guest?
  2: 2.760, // 2760 ms — [scoff] Oh, don't look so surprised.
  3: 1.075  // 1075 ms — Down below you go.
});

export const BOSS_ESCAPE_VO_DURATIONS_MS = Object.freeze({
  1: 1935,
  2: 2760,
  3: 1075
});

export const BOSS_ESCAPE_VO_LINES = Object.freeze([
  Object.freeze({
    index: 1,
    key: 'boss_escape_vo_01',
    file: 'boss_escape_vo_01.mp3',
    durationSec: 1.935,
    textEn: '[chuckle] Leaving so soon, guest?'
  }),
  Object.freeze({
    index: 2,
    key: 'boss_escape_vo_02',
    file: 'boss_escape_vo_02.mp3',
    durationSec: 2.760,
    textEn: "[scoff] Oh, don't look so surprised."
  }),
  Object.freeze({
    index: 3,
    key: 'boss_escape_vo_03',
    file: 'boss_escape_vo_03.mp3',
    durationSec: 1.075,
    textEn: 'Down below you go.'
  })
]);

// Quantized 30-FPS mouth-open curves auto-extracted from mastered speech boss v2 MP3s (0..100)
export const BOSS_ESCAPE_LIPSYNC_CURVES = Object.freeze({
  1: Object.freeze([
    0, 0, 20, 35, 33, 23, 16, 9, 29, 50, 49, 33, 19, 11, 6, 4,
    2, 1, 1, 0, 6, 36, 80, 98, 96, 88, 100, 90, 62, 42, 29, 44,
    68, 75, 66, 48, 33, 30, 58, 71, 63, 56, 51, 45, 40, 72, 95, 89,
    74, 53, 34, 23, 13, 11, 6, 4, 2, 1, 1
  ]),
  2: Object.freeze([
    0, 0, 0, 0, 9, 13, 10, 6, 3, 2, 1, 1, 0, 0, 0, 0,
    0, 0, 0, 0, 14, 44, 70, 78, 81, 94, 99, 100, 81, 59, 39, 36,
    61, 85, 94, 90, 76, 49, 36, 33, 59, 70, 54, 37, 28, 22, 18, 31,
    51, 68, 66, 50, 34, 26, 34, 36, 24, 14, 11, 10, 12, 26, 37, 43,
    46, 43, 37, 31, 26, 20, 16, 12, 7, 4, 2, 1, 1, 0, 0, 0,
    0, 0, 0
  ]),
  3: Object.freeze([
    0, 0, 10, 45, 83, 96, 85, 65, 44, 54, 78, 82, 86, 98, 100, 89,
    72, 65, 58, 44, 59, 85, 93, 92, 87, 71, 47, 27, 16, 9, 5, 3,
    2
  ])
});

export function getEscapeBossVoDurationSec(cueIndex) {
  const idx = cueIndex | 0;
  return BOSS_ESCAPE_VO_DURATIONS_SEC[idx] || 0;
}

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
  const v = (curve[i0] + (curve[i0 + 1] - curve[i0]) * frac) * 0.01;
  return v <= 0 ? 0 : (v >= 1 ? 1 : v);
}

function clamp(v, lo, hi) {
  const n = Number(v);
  if (!Number.isFinite(n)) return lo;
  return n < lo ? lo : n > hi ? hi : n;
}

function safeDisconnect(node) {
  if (!node) return;
  try { node.disconnect(); } catch {}
}

function safeStop(node) {
  if (!node) return;
  try { node.stop(); } catch {}
}

function decodeAudioBuffer(audioCtx, arrayBuffer) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const onOk = (decoded) => { if (!settled) { settled = true; resolve(decoded); } };
    const onErr = (err) => { if (!settled) { settled = true; reject(err || new Error('decodeAudioData failed')); } };
    try {
      const res = audioCtx.decodeAudioData(arrayBuffer, onOk, onErr);
      if (res && typeof res.then === 'function') res.then(onOk, onErr);
    } catch (err) {
      onErr(err);
    }
  });
}

// Fast 1.5s pink-ish stereo noise buffer (~0.4 ms CPU, zero convolvers!)
function buildPinkNoiseBuffer(ctx, durationSec = 1.6) {
  const sr = Math.max(22050, Math.min(48000, ctx.sampleRate || 44100));
  const length = Math.max(4096, Math.floor(sr * durationSec));
  const buf = ctx.createBuffer(2, length, sr);
  let seed = 0x51A9F321 >>> 0;
  for (let ch = 0; ch < 2; ch++) {
    const out = buf.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const w = seed * INV_2_POW_31 - 1.0;
      b0 = 0.997 * b0 + w * 0.029;
      b1 = 0.985 * b1 + w * 0.032;
      b2 = 0.950 * b2 + w * 0.048;
      out[i] = clamp((b0 + b1 + b2 + w * 0.14) * 1.15, -0.95, 0.95);
    }
  }
  return buf;
}

export function createSoulsEscapeAudio(getCtxOrOpts, getMasterGainArg, getSfxVolumeArg, assetVerArg) {
  const opts = (getCtxOrOpts && typeof getCtxOrOpts === 'object')
    ? getCtxOrOpts
    : {
        getCtx: getCtxOrOpts,
        getMasterGain: getMasterGainArg,
        getSfxVolume: getSfxVolumeArg,
        assetVer: assetVerArg
      };

  const getCtx = typeof opts.getCtx === 'function' ? opts.getCtx : () => null;
  const getMasterGain = typeof opts.getMasterGain === 'function' ? opts.getMasterGain : () => null;
  const getSfxVolume = typeof opts.getSfxVolume === 'function' ? opts.getSfxVolume : () => 0.72;
  const getVoiceVolume = typeof opts.getVoiceVolume === 'function' ? opts.getVoiceVolume : () => 1.0;
  const duckMusic = typeof opts.duckMusic === 'function' ? opts.duckMusic : null;
  const assetVer = String(opts.assetVer || SOULS_ESCAPE_AUDIO_VERSION);

  let boundCtx = null;
  let boundDest = null;
  let voiceBus = null;
  let envBus = null;
  let noiseBuf = null;
  let isMuted = false;
  let voiceVolumeMul = 1.08;
  let disposed = false;

  const voBuffers = new Map();
  const voLoading = new Map();
  let shoreWindBuf = null;
  let shoreWindLoading = null;
  let shoreFireBuf = null;
  let shoreFireLoading = null;
  let shoreAmbientWanted = false;
  let lastShoreFireOpts = null;
  let lastShoreFireGain = 0;
  let activeVo = null;
  let chasmWindHandle = null;
  let shoreAmbientHandle = null;
  let shoreFireHandle = null;
  const _shoreFireXs = new Float32Array(3);
  const _shoreFireZs = new Float32Array(3);
  const _shoreFireWs = new Float32Array(3);
  const activeOneShots = new Set();

  function computeVoiceGain() {
    if (isMuted) return 0.0001;
    return clamp(clamp(getVoiceVolume(), 0, 1.8) * voiceVolumeMul, 0.0001, 1.65);
  }

  function computeEnvGain() {
    if (isMuted) return 0.0001;
    return clamp(clamp(getSfxVolume(), 0, 1.2) * 0.75, 0.0001, 1.0);
  }

  function ensureGraph(ctxOverride = null) {
    if (disposed) return null;
    const ctx = ctxOverride || getCtx();
    if (!ctx) return null;
    const dest = getMasterGain() || ctx.destination;
    if (!dest) return null;

    if (boundCtx !== ctx || boundDest !== dest || !voiceBus || !envBus) {
      safeDisconnect(voiceBus);
      safeDisconnect(envBus);
      boundCtx = ctx;
      boundDest = dest;
      const now = ctx.currentTime;

      voiceBus = ctx.createGain();
      voiceBus.gain.setValueAtTime(computeVoiceGain(), now);
      voiceBus.connect(dest);

      envBus = ctx.createGain();
      envBus.gain.setValueAtTime(computeEnvGain(), now);
      envBus.connect(dest);

      noiseBuf = buildPinkNoiseBuffer(ctx, 1.6);
    }
    return ctx;
  }

  function fetchVoCue(ctx, cueIndex) {
    const idx = cueIndex | 0;
    if (idx < 1 || idx > BOSS_ESCAPE_VO_COUNT) return Promise.resolve(null);
    if (voBuffers.has(idx)) return Promise.resolve(voBuffers.get(idx));
    if (voLoading.has(idx)) return voLoading.get(idx);
    const line = BOSS_ESCAPE_VO_LINES[idx - 1];
    if (!line || typeof fetch !== 'function') return Promise.resolve(null);
    const url = `${BASE_AUDIO_PATH}/${line.file}?v=${encodeURIComponent(assetVer)}`;
    const p = fetch(url)
      .then((res) => (res && res.ok ? res.arrayBuffer() : null))
      .then((ab) => (ab && !disposed ? decodeAudioBuffer(ctx, ab) : null))
      .then((buf) => {
        voLoading.delete(idx);
        if (buf && !disposed) voBuffers.set(idx, buf);
        return buf || null;
      })
      .catch(() => {
        voLoading.delete(idx);
        return null;
      });
    voLoading.set(idx, p);
    return p;
  }

  function fetchShoreWindBuf(ctx) {
    if (shoreWindBuf) return Promise.resolve(shoreWindBuf);
    if (shoreWindLoading) return shoreWindLoading;
    if (!ctx || typeof fetch !== 'function') return Promise.resolve(null);
    const url = `${BASE_AUDIO_PATH}/souls_shore_wind_ambient.mp3?v=${encodeURIComponent(assetVer)}`;
    const p = fetch(url)
      .then((res) => (res && res.ok ? res.arrayBuffer() : null))
      .then((ab) => (ab && !disposed ? decodeAudioBuffer(ctx, ab) : null))
      .then((buf) => {
        shoreWindLoading = null;
        if (buf && !disposed) {
          shoreWindBuf = buf;
          // Start silky studio nocturnal wind loop the instant decode finishes (ZERO pink-noise fallback!)
          if (shoreAmbientWanted && !isMuted && !shoreAmbientHandle) {
            startShoreWindHandle(ctx, true);
          }
        }
        return buf || null;
      })
      .catch(() => {
        shoreWindLoading = null;
        return null;
      });
    shoreWindLoading = p;
    return p;
  }

  function fetchShoreFireBuf(ctx) {
    if (shoreFireBuf) return Promise.resolve(shoreFireBuf);
    if (shoreFireLoading) return shoreFireLoading;
    if (!ctx || typeof fetch !== 'function') return Promise.resolve(null);
    // Exact same warm, natural 6.0s crackling fire loop as the Castle (`soulsSpatialAudio.js`)!
    const url = `${BASE_AUDIO_PATH}/souls_env_fire_crackle.wav?v=${encodeURIComponent(assetVer)}`;
    const p = fetch(url)
      .then((res) => (res && res.ok ? res.arrayBuffer() : null))
      .then((ab) => (ab && !disposed ? decodeAudioBuffer(ctx, ab) : null))
      .then((buf) => {
        shoreFireLoading = null;
        if (buf && !disposed) {
          shoreFireBuf = buf;
          if (shoreAmbientWanted && !isMuted && !shoreFireHandle) {
            startShoreFireHandle(ctx);
            if (lastShoreFireOpts) updateShoreFireParams(ctx, lastShoreFireOpts);
          }
        }
        return buf || null;
      })
      .catch(() => {
        shoreFireLoading = null;
        return null;
      });
    shoreFireLoading = p;
    return p;
  }

  function preload(ctxOverride = null) {
    const ctx = ensureGraph(ctxOverride);
    if (!ctx) return;
    for (let i = 1; i <= BOSS_ESCAPE_VO_COUNT; i++) {
      fetchVoCue(ctx, i);
    }
    fetchShoreWindBuf(ctx);
    fetchShoreFireBuf(ctx);
  }

  function stopEscapeVoice(fadeSec = 0.08) {
    const cur = activeVo;
    activeVo = null;
    if (!cur) return false;
    const ctx = boundCtx || getCtx();
    const fade = clamp(fadeSec, 0.01, 0.5);
    if (ctx && cur.gain) {
      const now = ctx.currentTime;
      try {
        cur.gain.gain.cancelScheduledValues(now);
        cur.gain.gain.setValueAtTime(Math.max(0.0001, cur.gain.gain.value || 0.0001), now);
        cur.gain.gain.exponentialRampToValueAtTime(0.0001, now + fade);
      } catch {}
      setTimeout(() => {
        safeStop(cur.src);
        safeDisconnect(cur.src);
        safeDisconnect(cur.gain);
      }, Math.ceil(fade * 1000) + 30);
    } else {
      safeStop(cur.src);
      safeDisconnect(cur.src);
      safeDisconnect(cur.gain);
    }
    return true;
  }

  function playDecodedVo(ctx, idx, buffer, optsPlay) {
    if (disposed || !ctx || !buffer || !voiceBus) return false;
    stopEscapeVoice(0.04);
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    const vol = clamp(optsPlay?.volume ?? 1.0, 0.1, 1.5);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.015);
    gain.connect(voiceBus);

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(gain);
    const handle = { idx, src, gain };
    activeVo = handle;
    src.onended = () => {
      if (activeVo === handle) activeVo = null;
      safeDisconnect(src);
      safeDisconnect(gain);
    };
    try { src.start(now); } catch { return false; }

    const holdSec = Math.max(0.4, buffer.duration || getEscapeBossVoDurationSec(idx));
    if (duckMusic) {
      try { duckMusic(-9.0, holdSec, 0.85); } catch {}
    }
    return true;
  }

  function playEscapeVoiceLine(cueIndex, playOpts = {}) {
    const idx = cueIndex | 0;
    if (idx < 1 || idx > BOSS_ESCAPE_VO_COUNT || isMuted) return false;
    const ctx = ensureGraph();
    if (!ctx) return false;
    voiceBus.gain.setValueAtTime(computeVoiceGain(), ctx.currentTime);
    const cached = voBuffers.get(idx);
    if (cached) return playDecodedVo(ctx, idx, cached, playOpts);
    fetchVoCue(ctx, idx).then((buf) => {
      if (buf && !disposed && !isMuted) playDecodedVo(ctx, idx, buf, playOpts);
    });
    return true;
  }

  function playChasmWindFall(active) {
    const want = Boolean(active);
    if (!want) {
      const h = chasmWindHandle;
      chasmWindHandle = null;
      if (!h) return;
      const ctx = boundCtx || getCtx();
      if (ctx && h.gain) {
        const now = ctx.currentTime;
        try {
          h.gain.gain.cancelScheduledValues(now);
          h.gain.gain.setValueAtTime(Math.max(0.0001, h.gain.gain.value || 0.0001), now);
          h.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
        } catch {}
        setTimeout(() => {
          safeStop(h.src);
          safeDisconnect(h.src);
          safeDisconnect(h.bp);
          safeDisconnect(h.gain);
        }, 290);
      } else {
        safeStop(h.src);
        safeDisconnect(h.src);
        safeDisconnect(h.bp);
        safeDisconnect(h.gain);
      }
      return;
    }
    if (chasmWindHandle || isMuted) return;
    const ctx = ensureGraph();
    if (!ctx || !noiseBuf || !envBus) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(340, now);
    bp.frequency.exponentialRampToValueAtTime(640, now + 1.8);
    bp.Q.setValueAtTime(0.95, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.42, now + 0.35);
    src.connect(bp);
    bp.connect(gain);
    gain.connect(envBus);
    src.start(now);
    chasmWindHandle = { src, bp, gain };
  }

  function playRiverSplashUnderwater() {
    if (isMuted) return;
    const ctx = ensureGraph();
    if (!ctx || !noiseBuf || !envBus) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2800, now);
    lp.frequency.exponentialRampToValueAtTime(240, now + 0.35);
    lp.frequency.setValueAtTime(240, now + 1.15);
    lp.frequency.exponentialRampToValueAtTime(1600, now + 1.85);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.62, now + 0.03);
    gain.gain.linearRampToValueAtTime(0.32, now + 0.45);
    gain.gain.linearRampToValueAtTime(0.44, now + 1.55);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.45);
    src.connect(lp);
    lp.connect(gain);
    gain.connect(envBus);
    src.start(now);
    src.stop(now + 2.5);
    const h = { src, nodes: [src, lp, gain] };
    activeOneShots.add(h);
    src.onended = () => {
      activeOneShots.delete(h);
      for (const n of h.nodes) safeDisconnect(n);
    };
  }

  function playWaterSprayBurst(intensity = 0.7) {
    if (isMuted) return;
    const ctx = ensureGraph();
    if (!ctx || !noiseBuf || !envBus) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1400, now);
    bp.frequency.exponentialRampToValueAtTime(480, now + 0.55);
    bp.Q.setValueAtTime(0.8, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(clamp(0.42 * intensity, 0.08, 0.65), now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);
    src.connect(bp);
    bp.connect(gain);
    gain.connect(envBus);
    src.start(now);
    src.stop(now + 0.65);
    const h = { src, nodes: [src, bp, gain] };
    activeOneShots.add(h);
    src.onended = () => {
      activeOneShots.delete(h);
      for (const n of h.nodes) safeDisconnect(n);
    };
  }

  function stopShoreHandle(fadeSec = 0.35) {
    const h = shoreAmbientHandle;
    shoreAmbientHandle = null;
    if (!h) return;
    const ctx = boundCtx || getCtx();
    const fade = clamp(fadeSec, 0.04, 0.8);
    if (ctx && h.gain) {
      const now = ctx.currentTime;
      try {
        h.gain.gain.cancelScheduledValues(now);
        h.gain.gain.setValueAtTime(Math.max(0.0001, h.gain.gain.value || 0.0001), now);
        h.gain.gain.exponentialRampToValueAtTime(0.0001, now + fade);
      } catch {}
      setTimeout(() => {
        safeStop(h.src);
        safeDisconnect(h.src);
        safeDisconnect(h.lp);
        safeDisconnect(h.hp);
        safeDisconnect(h.gain);
      }, Math.ceil(fade * 1000) + 40);
    } else {
      safeStop(h.src);
      safeDisconnect(h.src);
      safeDisconnect(h.lp);
      safeDisconnect(h.hp);
      safeDisconnect(h.gain);
    }
  }

  function stopShoreFireHandle(fadeSec = 0.35) {
    const h = shoreFireHandle;
    shoreFireHandle = null;
    lastShoreFireGain = 0;
    if (!h) return;
    const ctx = boundCtx || getCtx();
    const fade = clamp(fadeSec, 0.04, 0.8);
    if (ctx && h.gain) {
      const now = ctx.currentTime;
      try {
        h.gain.gain.cancelScheduledValues(now);
        h.gain.gain.setValueAtTime(Math.max(0.0001, h.gain.gain.value || 0.0001), now);
        h.gain.gain.exponentialRampToValueAtTime(0.0001, now + fade);
      } catch {}
      setTimeout(() => {
        safeStop(h.src);
        safeDisconnect(h.src);
        safeDisconnect(h.lpf);
        safeDisconnect(h.panner);
        safeDisconnect(h.gain);
      }, Math.ceil(fade * 1000) + 40);
    } else {
      safeStop(h.src);
      safeDisconnect(h.src);
      safeDisconnect(h.lpf);
      safeDisconnect(h.panner);
      safeDisconnect(h.gain);
    }
  }

  function startShoreFireHandle(ctx) {
    if (!ctx || !envBus || shoreFireHandle || !shoreFireBuf) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = shoreFireBuf;
    src.loop = true;

    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.setValueAtTime(2800, now);
    lpf.Q.setValueAtTime(0.65, now);

    let panner = null;
    if (typeof ctx.createStereoPanner === 'function') {
      try {
        panner = ctx.createStereoPanner();
        panner.pan.setValueAtTime(0, now);
      } catch {
        panner = null;
      }
    }

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    lastShoreFireGain = 0;

    src.connect(lpf);
    if (panner) {
      lpf.connect(panner);
      panner.connect(gain);
    } else {
      lpf.connect(gain);
    }
    gain.connect(envBus);
    src.start(now);
    shoreFireHandle = {
      src,
      lpf,
      panner,
      gain,
      lastGain: 0.0001,
      lastCutoff: 2800,
      lastPan: 0
    };
  }

  function updateShoreFireParams(ctx, opts = null) {
    const h = shoreFireHandle;
    if (!ctx || !h || !h.gain || !h.lpf) return;

    const bonfireLit = Boolean(opts && opts.bonfireLit);
    const hasCoords = Boolean(
      opts &&
      Number.isFinite(Number(opts.listenerX)) &&
      Number.isFinite(Number(opts.listenerZ))
    );

    // Strictly 3D object-bound spatial fire (identical acoustic model to Castle `soulsSpatialAudio.js` —
    // NOT a constant background bed! Silent far away, smoothly fading in with stereo direction &
    // air-absorption LPF as you approach the lit Shore Bonfire or Twin Gate Braziers).
    let bestAtten = 0;
    let secondaryEnergy = 0;
    let bestDist = Infinity;
    let pan = 0;
    if (hasCoords) {
      const lx = Number(opts.listenerX);
      const ly = Number.isFinite(Number(opts.listenerY)) ? Number(opts.listenerY) : 0;
      const lz = Number(opts.listenerZ);
      const yaw = Number.isFinite(Number(opts.listenerYaw)) ? Number(opts.listenerYaw) : 0;
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const rightX = cosY;
      const rightZ = -sinY;

      const bfX = Number.isFinite(Number(opts.bonfireX)) ? Number(opts.bonfireX) : -2.2;
      const bfZ = Number.isFinite(Number(opts.bonfireZ)) ? Number(opts.bonfireZ) : 15.0;

      // All physical 3D hearth objects across Shore + Extended Gorge Road (dynamic list if provided, clean 3-hearth fallback!)
      const customSources = Array.isArray(opts.fireSources) && opts.fireSources.length > 0 ? opts.fireSources : null;
      const srcCount = customSources ? customSources.length : 3;
      if (!customSources) {
        _shoreFireXs[0] = bfX;   _shoreFireZs[0] = bfZ;  _shoreFireWs[0] = bonfireLit ? 1.0 : 0.24;
        _shoreFireXs[1] = -3.55; _shoreFireZs[1] = 29.3; _shoreFireWs[1] = 0.82;
        _shoreFireXs[2] = 3.55;  _shoreFireZs[2] = 29.3; _shoreFireWs[2] = 0.82;
      }

      let weightedPan = 0;
      let sumW = 0;
      for (let i = 0; i < srcCount; i++) {
        let fx, fy, fz, fw, refDist, maxDist;
        if (customSources) {
          const fs = customSources[i];
          fx = Number(fs.x) || 0;
          fy = Number.isFinite(Number(fs.y)) ? Number(fs.y) : ly;
          fz = Number(fs.z) || 0;
          fw = Number.isFinite(Number(fs.weight)) ? Number(fs.weight) : 0.9;
          refDist = fs.isBonfire ? 1.8 : 1.6;
          maxDist = Number.isFinite(Number(fs.radius)) ? Number(fs.radius) : 16.5;
        } else {
          fx = _shoreFireXs[i];
          fy = ly;
          fz = _shoreFireZs[i];
          fw = _shoreFireWs[i];
          refDist = i === 0 ? 1.8 : 1.5;
          maxDist = i === 0 ? (bonfireLit ? 17.5 : 4.8) : 14.0;
        }
        const dx = fx - lx;
        const dy = (fy - (ly + 1.2)) * 1.15;
        const dz = fz - lz;
        const dSq = dx * dx + dy * dy + dz * dz;
        if (dSq >= maxDist * maxDist) continue;
        const d = Math.sqrt(dSq);
        const horizD = Math.hypot(dx, dz);
        const norm = clamp((d - refDist) / Math.max(0.5, maxDist - refDist), 0, 1);
        // Smooth zero-slope perceptual rolloff (same curve as Castle `soulsSpatialAudio.js`, zero abrupt step!)
        const atten = Math.pow(1.0 - norm, 2.15) * fw;
        if (atten <= 0.0005) continue;
        if (atten > bestAtten) {
          secondaryEnergy += bestAtten * 0.22;
          bestAtten = atten;
          bestDist = d;
        } else {
          secondaryEnergy += atten * 0.22;
        }
        if (horizD > 0.08) {
          const projR = (dx * rightX + dz * rightZ) / horizD;
          const nearScale = horizD < 1.35 ? clamp(horizD / 1.35, 0.14, 1.0) : 1.0;
          const srcPan = clamp(projR * 0.82 * nearScale, -0.88, 0.88);
          const pw = atten * atten;
          weightedPan += srcPan * pw;
          sumW += pw;
        }
      }
      if (sumW > 1e-6) pan = clamp(weightedPan / sumW, -0.88, 0.88);
    } else if (opts && Number.isFinite(Number(opts.bonfireProximity))) {
      bestAtten = Math.pow(clamp(Number(opts.bonfireProximity), 0, 1), 1.6);
      bestDist = 1.8 + (1.0 - bestAtten) * 14.0;
    }

    const totalPresence = clamp(bestAtten + Math.min(0.22, secondaryEnergy), 0, 1.15);
    // Restrained, cozy campfire ceiling (0.0001 silent far -> 0.24 right beside lit bonfire; NEVER a loud blast!)
    const targetGain = totalPresence > 0.003
      ? clamp(totalPresence * 0.235, 0.0001, 0.26)
      : 0.0001;
    // Distance air-absorption filter: warm 1.7 kHz distant -> crisp gentle 6.8 kHz up close (matching Castle!)
    const proxNorm = bestDist < Infinity ? clamp((bestDist - 1.5) / 14.0, 0, 1) : 1.0;
    const targetCutoff = 6800 - proxNorm * 5100;

    const now = ctx.currentTime;
    if (Math.abs(targetGain - h.lastGain) > 0.0012) {
      h.gain.gain.setTargetAtTime(targetGain, now, 0.22);
      h.lastGain = targetGain;
    }
    lastShoreFireGain = targetGain > 0.0005 ? targetGain : 0;

    if (Math.abs(targetCutoff - h.lastCutoff) > 28) {
      h.lpf.frequency.setTargetAtTime(targetCutoff, now, 0.20);
      h.lastCutoff = targetCutoff;
    }
    if (h.panner && h.panner.pan && Math.abs(pan - h.lastPan) > 0.006) {
      h.panner.pan.setTargetAtTime(pan, now, 0.10);
      h.lastPan = pan;
    }
  }

  function startShoreWindHandle(ctx, useRealSample) {
    if (!ctx || !envBus || shoreAmbientHandle) return;
    if (!useRealSample || !shoreWindBuf) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = shoreWindBuf;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.46, now + 1.15);
    src.connect(gain);
    gain.connect(envBus);
    src.start(now);
    shoreAmbientHandle = { src, hp: null, lp: null, gain, isRealWind: true };
  }

  function setExteriorShoreAmbient(active, opts = null) {
    const want = Boolean(active);
    shoreAmbientWanted = want;
    if (!want || isMuted) {
      lastShoreFireOpts = null;
      stopShoreHandle(0.35);
      stopShoreFireHandle(0.35);
      return;
    }
    if (opts && typeof opts === 'object') {
      lastShoreFireOpts = opts;
    }
    const ctx = ensureGraph();
    if (!ctx || !envBus) return;
    if (!shoreAmbientHandle) {
      if (shoreWindBuf) {
        startShoreWindHandle(ctx, true);
      } else if (!shoreWindLoading) {
        fetchShoreWindBuf(ctx);
      }
    }
    if (!shoreFireHandle) {
      if (shoreFireBuf) {
        startShoreFireHandle(ctx);
      } else if (!shoreFireLoading) {
        fetchShoreFireBuf(ctx);
      }
    }
    if (shoreFireHandle) {
      updateShoreFireParams(ctx, lastShoreFireOpts);
    }
  }

  function stopAll(fadeSec = 0.16) {
    stopEscapeVoice(fadeSec);
    playChasmWindFall(false);
    setExteriorShoreAmbient(false);
    for (const h of activeOneShots) {
      safeStop(h.src);
      for (const n of h.nodes) safeDisconnect(n);
    }
    activeOneShots.clear();
  }

  function setMuted(mutedFlag) {
    isMuted = Boolean(mutedFlag);
    const ctx = boundCtx || getCtx();
    if (ctx) {
      const now = ctx.currentTime;
      if (voiceBus) voiceBus.gain.setValueAtTime(computeVoiceGain(), now);
      if (envBus) envBus.gain.setValueAtTime(computeEnvGain(), now);
    }
    if (isMuted) stopAll(0.06);
  }

  function setVoiceVolume(v) {
    voiceVolumeMul = clamp(v, 0, 1.8);
    const ctx = boundCtx || getCtx();
    if (ctx && voiceBus) voiceBus.gain.setValueAtTime(computeVoiceGain(), ctx.currentTime);
  }

  function dispose() {
    disposed = true;
    shoreAmbientWanted = false;
    stopAll(0.02);
    safeDisconnect(voiceBus);
    safeDisconnect(envBus);
    voiceBus = null;
    envBus = null;
    noiseBuf = null;
    shoreWindBuf = null;
    shoreWindLoading = null;
    shoreFireBuf = null;
    shoreFireLoading = null;
    lastShoreFireOpts = null;
    voBuffers.clear();
    voLoading.clear();
  }

  return {
    preload,
    playEscapeVoiceLine,
    stopEscapeVoice,
    stopAll,
    playChasmWindFall,
    playRiverSplashUnderwater,
    playWaterSprayBurst,
    setExteriorShoreAmbient,
    setMuted,
    setVoiceVolume,
    isChasmWindActive: () => Boolean(chasmWindHandle),
    isExteriorShoreAmbientActive: () => Boolean(shoreAmbientHandle),
    isShoreWindSampleLoaded: () => Boolean(shoreWindBuf),
    isUsingShoreWindSample: () => Boolean(shoreAmbientHandle?.isRealWind),
    isShoreFireLoaded: () => Boolean(shoreFireBuf),
    isShoreFireActive: () => Boolean(shoreFireHandle),
    getShoreFireTargetGain: () => lastShoreFireGain,
    dispose
  };
}
