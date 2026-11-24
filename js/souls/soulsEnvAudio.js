// Dedicated Environment & Surface Audio Engine for Abandoned Knight Rift
// Studio 44.1 kHz 16-bit WAV samples + acoustic procedural fallbacks during decode.
// Strictly isolated from PvE biomes; zero external dependencies (Vanilla ES Module).

export const SOULS_ENV_AUDIO_VERSION = '20261124z92';

const BASE_AUDIO_PATH = './assets/audio';

export const SOULS_ENV_SAMPLE_MANIFEST = Object.freeze([
  ['step_stone_1', `${BASE_AUDIO_PATH}/souls_env_step_stone_1.wav?v=${SOULS_ENV_AUDIO_VERSION}`],
  ['step_stone_2', `${BASE_AUDIO_PATH}/souls_env_step_stone_2.wav?v=${SOULS_ENV_AUDIO_VERSION}`],
  ['step_stone_3', `${BASE_AUDIO_PATH}/souls_env_step_stone_3.wav?v=${SOULS_ENV_AUDIO_VERSION}`],
  ['step_stone_4', `${BASE_AUDIO_PATH}/souls_env_step_stone_4.wav?v=${SOULS_ENV_AUDIO_VERSION}`],
  ['step_stone_5', `${BASE_AUDIO_PATH}/souls_env_step_stone_5.wav?v=${SOULS_ENV_AUDIO_VERSION}`],
  ['step_stone_6', `${BASE_AUDIO_PATH}/souls_env_step_stone_6.wav?v=${SOULS_ENV_AUDIO_VERSION}`],
  ['step_bridge_1', `${BASE_AUDIO_PATH}/souls_env_step_bridge_1.wav?v=${SOULS_ENV_AUDIO_VERSION}`],
  ['step_bridge_2', `${BASE_AUDIO_PATH}/souls_env_step_bridge_2.wav?v=${SOULS_ENV_AUDIO_VERSION}`],
  ['step_bridge_3', `${BASE_AUDIO_PATH}/souls_env_step_bridge_3.wav?v=${SOULS_ENV_AUDIO_VERSION}`],
  ['step_bridge_4', `${BASE_AUDIO_PATH}/souls_env_step_bridge_4.wav?v=${SOULS_ENV_AUDIO_VERSION}`],
  ['roll_stone_1', `${BASE_AUDIO_PATH}/souls_env_roll_stone_1.wav?v=${SOULS_ENV_AUDIO_VERSION}`],
  ['roll_stone_2', `${BASE_AUDIO_PATH}/souls_env_roll_stone_2.wav?v=${SOULS_ENV_AUDIO_VERSION}`],
  ['turn_scrape_1', `${BASE_AUDIO_PATH}/souls_env_turn_scrape_1.wav?v=${SOULS_ENV_AUDIO_VERSION}`],
  ['turn_scrape_2', `${BASE_AUDIO_PATH}/souls_env_turn_scrape_2.wav?v=${SOULS_ENV_AUDIO_VERSION}`],
  ['bonfire_crackle', `${BASE_AUDIO_PATH}/souls_env_bonfire_crackle.wav?v=${SOULS_ENV_AUDIO_VERSION}`],
  ['fog_gate', `${BASE_AUDIO_PATH}/souls_env_fog_gate.wav?v=${SOULS_ENV_AUDIO_VERSION}`],
  ['cathedral_drone', `${BASE_AUDIO_PATH}/souls_env_cathedral_drone.wav?v=${SOULS_ENV_AUDIO_VERSION}`],
  ['door_open', `${BASE_AUDIO_PATH}/souls_env_door_open.wav?v=${SOULS_ENV_AUDIO_VERSION}`],
  ['door_close', `${BASE_AUDIO_PATH}/souls_env_door_close.wav?v=${SOULS_ENV_AUDIO_VERSION}`]
]);

const STONE_SURFACES = new Set(['stone_courtyard', 'stone_bridge', 'cathedral_stone']);

function safeGet(fn) {
  if (typeof fn !== 'function') return null;
  try {
    return fn() || null;
  } catch {
    return null;
  }
}

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function decodeAudioBuffer(audioCtx, arrayBuffer) {
  return new Promise((resolve, reject) => {
    try {
      const result = audioCtx.decodeAudioData(
        arrayBuffer,
        (decoded) => resolve(decoded),
        (err) => reject(err || new Error('decodeAudioData failed'))
      );
      if (result && typeof result.then === 'function') {
        result.then(resolve, reject);
      }
    } catch (err) {
      reject(err);
    }
  });
}

export function createSoulsEnvAudio({
  getCtx,
  getSfxDest,
  getMusicDest,
  getStoneReverbDest
} = {}) {
  const buffers = new Map();       // key -> AudioBuffer
  const pendingLoads = new Map();  // key -> Promise<AudioBuffer|null>
  const lastChoice = Object.create(null);
  const lastTriggerMs = Object.create(null);

  let fallbackNoiseCtx = null;
  let fallbackWhiteNoise = null;

  // Ambient loop state (strictly active inside Abandoned Knight Rift)
  let ambientActive = false;
  let bonfireLevel = 0;

  let droneNode = null;
  let droneGain = null;
  let droneStopTimer = null;
  let droneDestRef = null;

  let bonfireNode = null;
  let bonfireGain = null;
  let bonfireReflSend = null;
  let bonfireStopTimer = null;
  let bonfireDestRef = null;

  function canFire(tag, minIntervalMs) {
    const t = nowMs();
    const prev = lastTriggerMs[tag];
    if (prev !== undefined && t - prev < minIntervalMs) return false;
    lastTriggerMs[tag] = t;
    return true;
  }

  function pickNonRepeating(slot, candidates) {
    if (candidates.length <= 1) return candidates[0];
    const prev = lastChoice[slot];
    let choice = candidates[Math.floor(Math.random() * candidates.length)];
    if (choice === prev) {
      const idx = (candidates.indexOf(prev) + 1 + Math.floor(Math.random() * (candidates.length - 1))) % candidates.length;
      choice = candidates[idx];
    }
    lastChoice[slot] = choice;
    return choice;
  }

  function ensureFallbackNoise(ctx) {
    if (fallbackWhiteNoise && fallbackNoiseCtx === ctx) return fallbackWhiteNoise;
    try {
      const len = Math.max(4096, Math.floor(ctx.sampleRate * 0.6));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      fallbackWhiteNoise = buf;
      fallbackNoiseCtx = ctx;
      return buf;
    } catch {
      return null;
    }
  }

  function getReflAmount(surface, base = 0.46) {
    if (surface === 'cathedral_stone') return base * 1.52;
    if (surface === 'stone_bridge') return base * 1.22;
    return base;
  }

  function playLoadedBuffer(ctx, buf, {
    dest,
    reverbDest = null,
    gainPeak = 0.50,
    rate = 1.0,
    reverbSend = 0.0,
    highShelfDb = 0,
    highShelfFreq = 3800
  }) {
    if (!ctx || !buf || !dest) return false;
    const t0 = ctx.currentTime;
    const nodes = [];

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.setValueAtTime(rate, t0);
    nodes.push(src);

    let chain = src;
    if (highShelfDb !== 0) {
      const hs = ctx.createBiquadFilter();
      hs.type = 'highshelf';
      hs.frequency.setValueAtTime(highShelfFreq, t0);
      hs.gain.setValueAtTime(highShelfDb, t0);
      chain.connect(hs);
      chain = hs;
      nodes.push(hs);
    }

    const dryGain = ctx.createGain();
    dryGain.gain.setValueAtTime(gainPeak, t0);
    chain.connect(dryGain);
    dryGain.connect(dest);
    nodes.push(dryGain);

    if (reverbDest && reverbSend > 0.001) {
      const wetGain = ctx.createGain();
      wetGain.gain.setValueAtTime(gainPeak * reverbSend, t0);
      chain.connect(wetGain);
      wetGain.connect(reverbDest);
      nodes.push(wetGain);
    }

    src.onended = () => {
      for (let i = 0; i < nodes.length; i++) {
        try { nodes[i].disconnect(); } catch {}
      }
    };

    try {
      src.start(t0);
      return true;
    } catch {
      for (let i = 0; i < nodes.length; i++) {
        try { nodes[i].disconnect(); } catch {}
      }
      return false;
    }
  }

  // =========================================================================
  // Procedural Acoustic Fallbacks (active only while WAVs are still decoding)
  // =========================================================================

  function playProceduralStoneFootstep(ctx, sfxDest, reverbDest, {
    classId = 'warrior',
    stepParity = 0,
    isSprinting = false,
    surface = 'stone_courtyard'
  }) {
    const t0 = ctx.currentTime;
    const isWarrior = classId === 'warrior';
    const isMage = classId === 'mage';
    const parity = Math.abs(stepParity | 0) % 2;
    const footTilt = parity === 0 ? 0.97 : 1.03;
    const pitchJit = 0.96 + Math.random() * 0.08;
    const classWeight = isWarrior ? 1.0 : isMage ? 0.72 : 0.86;
    const level = classWeight * (isSprinting ? 1.18 : 1.0) * (0.93 + Math.random() * 0.14);

    const bus = ctx.createGain();
    bus.gain.setValueAtTime(1.0, t0);
    bus.connect(sfxDest);

    let wet = null;
    if (reverbDest) {
      wet = ctx.createGain();
      wet.gain.setValueAtTime(getReflAmount(surface, 0.55), t0);
      bus.connect(wet);
      wet.connect(reverbDest);
    }

    // Layer 1: Rigid Stone Heel Clack (1-2 ms attack, 14-20 ms decay, zero dirt crunch)
    const noiseBuf = ensureFallbackNoise(ctx);
    if (noiseBuf) {
      const nSrc = ctx.createBufferSource();
      nSrc.buffer = noiseBuf;
      nSrc.loop = true;

      const bpMid = ctx.createBiquadFilter();
      bpMid.type = 'bandpass';
      bpMid.frequency.setValueAtTime((1240 + Math.random() * 340) * footTilt * pitchJit, t0);
      bpMid.Q.setValueAtTime(3.2, t0);

      const bpHi = ctx.createBiquadFilter();
      bpHi.type = 'bandpass';
      bpHi.frequency.setValueAtTime((2850 + Math.random() * 850) * footTilt, t0);
      bpHi.Q.setValueAtTime(2.7, t0);

      const gMid = ctx.createGain();
      const gHi = ctx.createGain();
      const clackDur = 0.017 + Math.random() * 0.005;
      gMid.gain.setValueAtTime(0.0001, t0);
      gMid.gain.linearRampToValueAtTime(0.28 * level, t0 + 0.0012);
      gMid.gain.exponentialRampToValueAtTime(0.0001, t0 + clackDur);

      gHi.gain.setValueAtTime(0.0001, t0);
      gHi.gain.linearRampToValueAtTime(0.18 * level, t0 + 0.0010);
      gHi.gain.exponentialRampToValueAtTime(0.0001, t0 + clackDur * 0.85);

      nSrc.connect(bpMid);
      bpMid.connect(gMid);
      gMid.connect(bus);

      nSrc.connect(bpHi);
      bpHi.connect(gHi);
      gHi.connect(bus);

      nSrc.onended = () => {
        try { nSrc.disconnect(); } catch {}
        try { bpMid.disconnect(); } catch {}
        try { bpHi.disconnect(); } catch {}
        try { gMid.disconnect(); } catch {}
        try { gHi.disconnect(); } catch {}
      };
      nSrc.start(t0, Math.random() * 0.4, clackDur + 0.012);
      nSrc.stop(t0 + clackDur + 0.015);
    }

    // Layer 2: Dense Slab Thud (128 -> 58 Hz)
    const thudOsc = ctx.createOscillator();
    const thudG = ctx.createGain();
    const thudDur = 0.032;
    thudOsc.type = 'sine';
    thudOsc.frequency.setValueAtTime(128 * footTilt * pitchJit, t0);
    thudOsc.frequency.exponentialRampToValueAtTime(58 * footTilt, t0 + thudDur);
    thudG.gain.setValueAtTime(0.0001, t0);
    thudG.gain.linearRampToValueAtTime(0.20 * level, t0 + 0.0015);
    thudG.gain.exponentialRampToValueAtTime(0.0001, t0 + thudDur);
    thudOsc.connect(thudG);
    thudG.connect(bus);
    thudOsc.onended = () => {
      try { thudOsc.disconnect(); } catch {}
      try { thudG.disconnect(); } catch {}
    };
    thudOsc.start(t0);
    thudOsc.stop(t0 + thudDur + 0.01);

    // Layer 2B: Hollow stone bridge arch resonance (215-255 Hz)
    if (surface === 'stone_bridge') {
      const archOsc = ctx.createOscillator();
      const archG = ctx.createGain();
      const archDur = 0.052;
      archOsc.type = 'triangle';
      archOsc.frequency.setValueAtTime((224 + Math.random() * 24) * footTilt, t0 + 0.0015);
      archOsc.frequency.exponentialRampToValueAtTime(212 * footTilt, t0 + archDur);
      archG.gain.setValueAtTime(0.0001, t0 + 0.0015);
      archG.gain.linearRampToValueAtTime(0.075 * level, t0 + 0.004);
      archG.gain.exponentialRampToValueAtTime(0.0001, t0 + archDur);
      archOsc.connect(archG);
      archG.connect(bus);
      archOsc.onended = () => {
        try { archOsc.disconnect(); } catch {}
        try { archG.disconnect(); } catch {}
      };
      archOsc.start(t0 + 0.0015);
      archOsc.stop(t0 + archDur + 0.01);
    }

    // Layer 3: Subtle plate sabaton metallic ring (4-8 kHz)
    if (isWarrior) {
      const clinkT = t0 + 0.004;
      const o1 = ctx.createOscillator();
      const g1 = ctx.createGain();
      const f1 = (4500 + Math.random() * 1400) * footTilt;
      o1.type = 'sine';
      o1.frequency.setValueAtTime(f1, clinkT);
      o1.frequency.exponentialRampToValueAtTime(f1 * 0.975, clinkT + 0.028);
      g1.gain.setValueAtTime(0.0001, clinkT);
      g1.gain.linearRampToValueAtTime(0.045 * level, clinkT + 0.001);
      g1.gain.exponentialRampToValueAtTime(0.0001, clinkT + 0.028);
      o1.connect(g1);
      g1.connect(bus);
      o1.onended = () => {
        try { o1.disconnect(); } catch {}
        try { g1.disconnect(); } catch {}
      };
      o1.start(clinkT);
      o1.stop(clinkT + 0.035);
    }

    setTimeout(() => {
      try { bus.disconnect(); } catch {}
      if (wet) {
        try { wet.disconnect(); } catch {}
      }
    }, 110);
    return true;
  }

  function playProceduralRollStone(ctx, sfxDest, reverbDest, surface) {
    const t0 = ctx.currentTime;
    const noiseBuf = ensureFallbackNoise(ctx);
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(1.0, t0);
    bus.connect(sfxDest);
    let wet = null;
    if (reverbDest) {
      wet = ctx.createGain();
      wet.gain.setValueAtTime(getReflAmount(surface, 0.45), t0);
      bus.connect(wet);
      wet.connect(reverbDest);
    }

    // Cloak whoosh
    if (noiseBuf) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(980, t0);
      bp.frequency.exponentialRampToValueAtTime(260, t0 + 0.24);
      bp.Q.setValueAtTime(1.4, t0);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.22, t0 + 0.045);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
      src.connect(bp);
      bp.connect(g);
      g.connect(bus);
      src.onended = () => {
        try { src.disconnect(); } catch {}
        try { bp.disconnect(); } catch {}
        try { g.disconnect(); } catch {}
      };
      src.start(t0, Math.random() * 0.3, 0.30);
      src.stop(t0 + 0.31);
    }

    // Dull pauldron stone contact at +0.13s + boot plant at +0.36s
    const impacts = [
      { at: 0.13, f0: 142, f1: 46, dur: 0.09, amp: 0.26 },
      { at: 0.36, f0: 130, f1: 58, dur: 0.04, amp: 0.22 }
    ];
    for (let i = 0; i < impacts.length; i++) {
      const imp = impacts[i];
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(imp.f0, t0 + imp.at);
      o.frequency.exponentialRampToValueAtTime(imp.f1, t0 + imp.at + imp.dur);
      g.gain.setValueAtTime(0.0001, t0 + imp.at);
      g.gain.linearRampToValueAtTime(imp.amp, t0 + imp.at + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + imp.at + imp.dur);
      o.connect(g);
      g.connect(bus);
      o.onended = () => {
        try { o.disconnect(); } catch {}
        try { g.disconnect(); } catch {}
      };
      o.start(t0 + imp.at);
      o.stop(t0 + imp.at + imp.dur + 0.015);
    }

    setTimeout(() => {
      try { bus.disconnect(); } catch {}
      if (wet) {
        try { wet.disconnect(); } catch {}
      }
    }, 520);
    return true;
  }

  function playProceduralTurnScrape(ctx, sfxDest, reverbDest, surface) {
    const t0 = ctx.currentTime;
    const noiseBuf = ensureFallbackNoise(ctx);
    if (!noiseBuf) return false;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2800, t0);
    bp.frequency.exponentialRampToValueAtTime(1450, t0 + 0.22);
    bp.Q.setValueAtTime(3.2, t0);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.22, t0 + 0.018);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.23);

    src.connect(bp);
    bp.connect(g);
    g.connect(sfxDest);

    let wet = null;
    if (reverbDest) {
      wet = ctx.createGain();
      wet.gain.setValueAtTime(getReflAmount(surface, 0.42), t0);
      g.connect(wet);
      wet.connect(reverbDest);
    }

    src.onended = () => {
      try { src.disconnect(); } catch {}
      try { bp.disconnect(); } catch {}
      try { g.disconnect(); } catch {}
      if (wet) {
        try { wet.disconnect(); } catch {}
      }
    };
    src.start(t0, Math.random() * 0.3, 0.25);
    src.stop(t0 + 0.26);
    return true;
  }

  function playProceduralFogGate(ctx, sfxDest, reverbDest) {
    const t0 = ctx.currentTime;
    const dur = 1.05;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(1.0, t0);
    bus.connect(sfxDest);
    let wet = null;
    if (reverbDest) {
      wet = ctx.createGain();
      wet.gain.setValueAtTime(0.75, t0);
      bus.connect(wet);
      wet.connect(reverbDest);
    }

    const sub = ctx.createOscillator();
    const subG = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(58, t0);
    sub.frequency.exponentialRampToValueAtTime(44, t0 + dur);
    subG.gain.setValueAtTime(0.0001, t0);
    subG.gain.linearRampToValueAtTime(0.26, t0 + 0.18);
    subG.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    sub.connect(subG);
    subG.connect(bus);
    sub.onended = () => {
      try { sub.disconnect(); } catch {}
      try { subG.disconnect(); } catch {}
    };
    sub.start(t0);
    sub.stop(t0 + dur + 0.02);

    const noiseBuf = ensureFallbackNoise(ctx);
    if (noiseBuf) {
      const nSrc = ctx.createBufferSource();
      nSrc.buffer = noiseBuf;
      nSrc.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(240, t0);
      bp.frequency.exponentialRampToValueAtTime(1350, t0 + 0.34);
      bp.frequency.exponentialRampToValueAtTime(220, t0 + dur);
      bp.Q.setValueAtTime(2.0, t0);
      const nG = ctx.createGain();
      nG.gain.setValueAtTime(0.0001, t0);
      nG.gain.linearRampToValueAtTime(0.22, t0 + 0.24);
      nG.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      nSrc.connect(bp);
      bp.connect(nG);
      nG.connect(bus);
      nSrc.onended = () => {
        try { nSrc.disconnect(); } catch {}
        try { bp.disconnect(); } catch {}
        try { nG.disconnect(); } catch {}
      };
      nSrc.start(t0, Math.random() * 0.2, dur + 0.02);
      nSrc.stop(t0 + dur + 0.03);
    }

    setTimeout(() => {
      try { bus.disconnect(); } catch {}
      if (wet) {
        try { wet.disconnect(); } catch {}
      }
    }, 1150);
    return true;
  }

  function playProceduralCastleDoorOpen(ctx, sfxDest, reverbDest) {
    const t0 = ctx.currentTime;
    const dur = 1.75;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(1.0, t0);
    bus.connect(sfxDest);
    let wet = null;
    if (reverbDest) {
      wet = ctx.createGain();
      wet.gain.setValueAtTime(0.68, t0);
      bus.connect(wet);
      wet.connect(reverbDest);
    }

    // Iron unlatch clank at t=0.02s
    const bolt = ctx.createOscillator();
    const boltG = ctx.createGain();
    bolt.type = 'triangle';
    bolt.frequency.setValueAtTime(175, t0 + 0.015);
    bolt.frequency.exponentialRampToValueAtTime(64, t0 + 0.085);
    boltG.gain.setValueAtTime(0.0001, t0 + 0.015);
    boltG.gain.linearRampToValueAtTime(0.28, t0 + 0.02);
    boltG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.095);
    bolt.connect(boltG);
    boltG.connect(bus);
    bolt.onended = () => {
      try { bolt.disconnect(); } catch {}
      try { boltG.disconnect(); } catch {}
    };
    bolt.start(t0 + 0.015);
    bolt.stop(t0 + 0.11);

    // Stone shudder + heavy oak swing groan
    const groan = ctx.createOscillator();
    const groanLp = ctx.createBiquadFilter();
    const groanG = ctx.createGain();
    groan.type = 'sawtooth';
    groan.frequency.setValueAtTime(72, t0 + 0.08);
    groan.frequency.linearRampToValueAtTime(138, t0 + 0.65);
    groan.frequency.exponentialRampToValueAtTime(52, t0 + dur);
    groanLp.type = 'lowpass';
    groanLp.frequency.setValueAtTime(420, t0 + 0.08);
    groanLp.Q.setValueAtTime(3.2, t0 + 0.08);
    groanG.gain.setValueAtTime(0.0001, t0 + 0.08);
    groanG.gain.linearRampToValueAtTime(0.20, t0 + 0.36);
    groanG.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    groan.connect(groanLp);
    groanLp.connect(groanG);
    groanG.connect(bus);
    groan.onended = () => {
      try { groan.disconnect(); } catch {}
      try { groanLp.disconnect(); } catch {}
      try { groanG.disconnect(); } catch {}
    };
    groan.start(t0 + 0.08);
    groan.stop(t0 + dur + 0.03);

    const noiseBuf = ensureFallbackNoise(ctx);
    if (noiseBuf) {
      const nSrc = ctx.createBufferSource();
      nSrc.buffer = noiseBuf;
      nSrc.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'bandpass';
      lp.frequency.setValueAtTime(190, t0 + 0.06);
      lp.frequency.linearRampToValueAtTime(520, t0 + 0.85);
      lp.frequency.exponentialRampToValueAtTime(150, t0 + dur);
      lp.Q.setValueAtTime(1.8, t0 + 0.06);
      const nG = ctx.createGain();
      nG.gain.setValueAtTime(0.0001, t0 + 0.06);
      nG.gain.linearRampToValueAtTime(0.24, t0 + 0.40);
      nG.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      nSrc.connect(lp);
      lp.connect(nG);
      nG.connect(bus);
      nSrc.onended = () => {
        try { nSrc.disconnect(); } catch {}
        try { lp.disconnect(); } catch {}
        try { nG.disconnect(); } catch {}
      };
      nSrc.start(t0 + 0.06, Math.random() * 0.2, dur);
      nSrc.stop(t0 + dur + 0.04);
    }

    setTimeout(() => {
      try { bus.disconnect(); } catch {}
      if (wet) {
        try { wet.disconnect(); } catch {}
      }
    }, 1900);
    return true;
  }

  function playProceduralCastleDoorClose(ctx, sfxDest, reverbDest) {
    const t0 = ctx.currentTime;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(1.0, t0);
    bus.connect(sfxDest);
    let wet = null;
    if (reverbDest) {
      wet = ctx.createGain();
      wet.gain.setValueAtTime(0.75, t0);
      bus.connect(wet);
      wet.connect(reverbDest);
    }

    // Cavernous twin-gate sub slam at t=0.12s
    const slamT = t0 + 0.12;
    const sub = ctx.createOscillator();
    const subG = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(102, slamT);
    sub.frequency.exponentialRampToValueAtTime(34, slamT + 0.42);
    subG.gain.setValueAtTime(0.0001, slamT);
    subG.gain.linearRampToValueAtTime(0.42, slamT + 0.004);
    subG.gain.exponentialRampToValueAtTime(0.0001, slamT + 0.46);
    sub.connect(subG);
    subG.connect(bus);
    sub.onended = () => {
      try { sub.disconnect(); } catch {}
      try { subG.disconnect(); } catch {}
    };
    sub.start(slamT);
    sub.stop(slamT + 0.48);

    const noiseBuf = ensureFallbackNoise(ctx);
    if (noiseBuf) {
      const nSrc = ctx.createBufferSource();
      nSrc.buffer = noiseBuf;
      nSrc.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1400, slamT);
      lp.frequency.exponentialRampToValueAtTime(180, slamT + 0.38);
      const nG = ctx.createGain();
      nG.gain.setValueAtTime(0.0001, slamT);
      nG.gain.linearRampToValueAtTime(0.32, slamT + 0.005);
      nG.gain.exponentialRampToValueAtTime(0.0001, slamT + 0.42);
      nSrc.connect(lp);
      lp.connect(nG);
      nG.connect(bus);
      nSrc.onended = () => {
        try { nSrc.disconnect(); } catch {}
        try { lp.disconnect(); } catch {}
        try { nG.disconnect(); } catch {}
      };
      nSrc.start(slamT, Math.random() * 0.2, 0.45);
      nSrc.stop(slamT + 0.47);
    }

    setTimeout(() => {
      try { bus.disconnect(); } catch {}
      if (wet) {
        try { wet.disconnect(); } catch {}
      }
    }, 900);
    return true;
  }

  // =========================================================================
  // Seamless Ambient Loop Management (Cathedral Drone + Bonfire Crackle)
  // =========================================================================

  function teardownDrone() {
    if (droneStopTimer !== null) {
      clearTimeout(droneStopTimer);
      droneStopTimer = null;
    }
    if (droneNode) {
      try { droneNode.stop(); } catch {}
      try { droneNode.disconnect(); } catch {}
      droneNode = null;
    }
    if (droneGain) {
      try { droneGain.disconnect(); } catch {}
      droneGain = null;
    }
    droneDestRef = null;
  }

  function teardownBonfire() {
    if (bonfireStopTimer !== null) {
      clearTimeout(bonfireStopTimer);
      bonfireStopTimer = null;
    }
    if (bonfireNode) {
      try { bonfireNode.stop(); } catch {}
      try { bonfireNode.disconnect(); } catch {}
      bonfireNode = null;
    }
    if (bonfireGain) {
      try { bonfireGain.disconnect(); } catch {}
      bonfireGain = null;
    }
    if (bonfireReflSend) {
      try { bonfireReflSend.disconnect(); } catch {}
      bonfireReflSend = null;
    }
    bonfireDestRef = null;
  }

  function syncAmbientLoops() {
    const ctx = safeGet(getCtx);
    if (!ctx) {
      if (!ambientActive) {
        teardownDrone();
        teardownBonfire();
      }
      return;
    }

    const t = ctx.currentTime;
    const musicDest = safeGet(getMusicDest);
    const sfxDest = safeGet(getSfxDest);
    const reverbDest = safeGet(getStoneReverbDest);

    // 1. Cathedral Drone (routes to musicDest when present, else restrained on sfxDest)
    const targetDroneDest = musicDest || sfxDest;
    const wantDrone = ambientActive && Boolean(targetDroneDest);
    const droneBuf = buffers.get('cathedral_drone');

    if (wantDrone) {
      if (droneStopTimer !== null) {
        clearTimeout(droneStopTimer);
        droneStopTimer = null;
      }
      if (droneNode && droneDestRef !== targetDroneDest) {
        teardownDrone();
      }
      if (!droneNode && droneBuf) {
        try {
          const src = ctx.createBufferSource();
          src.buffer = droneBuf;
          src.loop = true;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          src.connect(g);
          g.connect(targetDroneDest);
          src.start(t);
          droneNode = src;
          droneGain = g;
          droneDestRef = targetDroneDest;
        } catch {
          teardownDrone();
        }
      }
      if (droneGain) {
        const droneTarget = musicDest ? 0.28 : 0.11;
        droneGain.gain.cancelScheduledValues(t);
        droneGain.gain.setTargetAtTime(droneTarget, t, 0.42);
      }
    } else if (droneGain) {
      droneGain.gain.cancelScheduledValues(t);
      droneGain.gain.setTargetAtTime(0.0001, t, 0.26);
      if (droneStopTimer === null) {
        droneStopTimer = setTimeout(() => {
          droneStopTimer = null;
          if (!ambientActive) teardownDrone();
        }, 1050);
      }
    }

    // 2. Warm Bonfire Crackle (routes to sfxDest so 2-8 kHz ember snaps stay crystal clear)
    const targetBonfireDest = sfxDest || musicDest;
    const wantBonfire = ambientActive && bonfireLevel > 0.01 && Boolean(targetBonfireDest);
    const bonfireBuf = buffers.get('bonfire_crackle');

    if (wantBonfire) {
      if (bonfireStopTimer !== null) {
        clearTimeout(bonfireStopTimer);
        bonfireStopTimer = null;
      }
      if (bonfireNode && bonfireDestRef !== targetBonfireDest) {
        teardownBonfire();
      }
      if (!bonfireNode && bonfireBuf) {
        try {
          const src = ctx.createBufferSource();
          src.buffer = bonfireBuf;
          src.loop = true;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          src.connect(g);
          g.connect(targetBonfireDest);
          if (reverbDest) {
            const refl = ctx.createGain();
            refl.gain.setValueAtTime(0.26, t);
            g.connect(refl);
            refl.connect(reverbDest);
            bonfireReflSend = refl;
          }
          src.start(t);
          bonfireNode = src;
          bonfireGain = g;
          bonfireDestRef = targetBonfireDest;
        } catch {
          teardownBonfire();
        }
      }
      if (bonfireGain) {
        const bonfireTarget = Math.max(0.0001, 0.22 * bonfireLevel);
        bonfireGain.gain.cancelScheduledValues(t);
        bonfireGain.gain.setTargetAtTime(bonfireTarget, t, 0.28);
      }
    } else if (bonfireGain) {
      bonfireGain.gain.cancelScheduledValues(t);
      bonfireGain.gain.setTargetAtTime(0.0001, t, 0.24);
      if (bonfireStopTimer === null) {
        bonfireStopTimer = setTimeout(() => {
          bonfireStopTimer = null;
          if (!ambientActive || bonfireLevel <= 0.01) teardownBonfire();
        }, 950);
      }
    }
  }

  // =========================================================================
  // Public API
  // =========================================================================

  let envPreloadPromise = null;
  function preload(audioCtx) {
    if (envPreloadPromise) return envPreloadPromise;
    const ctx = audioCtx || safeGet(getCtx);
    if (!ctx || typeof fetch !== 'function') {
      return Promise.resolve(false);
    }

    let nextIdx = 0;
    const loadOne = (key, url) => {
      if (buffers.has(key)) return Promise.resolve(buffers.get(key));
      if (pendingLoads.has(key)) return pendingLoads.get(key);
      const p = fetch(url)
        .then((res) => (res && res.ok ? res.arrayBuffer() : Promise.reject(new Error(`HTTP ${res ? res.status : 0}`))))
        .then((ab) => decodeAudioBuffer(ctx, ab))
        .then((decoded) => {
          if (decoded) {
            buffers.set(key, decoded);
            if (ambientActive && (key === 'cathedral_drone' || key === 'bonfire_crackle')) {
              syncAmbientLoops();
            }
          }
          return decoded || null;
        })
        .catch(() => null)
        .finally(() => {
          pendingLoads.delete(key);
        });
      pendingLoads.set(key, p);
      return p;
    };
    const worker = async () => {
      while (nextIdx < SOULS_ENV_SAMPLE_MANIFEST.length) {
        const [key, url] = SOULS_ENV_SAMPLE_MANIFEST[nextIdx++];
        await loadOne(key, url);
      }
    };
    envPreloadPromise = Promise.all([worker(), worker()]).then(() => buffers.size > 0);
    return envPreloadPromise;
  }

  function playStoneFootstep({
    classId = 'warrior',
    stepParity = 0,
    isSprinting = false,
    surface = 'stone_courtyard'
  } = {}) {
    if (!STONE_SURFACES.has(surface)) return false;
    const ctx = safeGet(getCtx);
    const sfxDest = safeGet(getSfxDest);
    if (!ctx || !sfxDest) return false;

    const minStepIntervalMs = isSprinting ? 215 : 285;
    if (!canFire('stone_step', minStepIntervalMs)) return false;

    const reverbDest = safeGet(getStoneReverbDest);
    const parity = Math.abs(stepParity | 0) % 2; // 0 = left (odd files), 1 = right (even files)
    const isBridge = surface === 'stone_bridge';
    const isWarrior = classId === 'warrior';
    const isMage = classId === 'mage';

    const pool = isBridge ? 'step_bridge' : 'step_stone';
    const indices = isBridge
      ? (parity === 0 ? [1, 3] : [2, 4])
      : (parity === 0 ? [1, 3, 5] : [2, 4, 6]);
    const idx = pickNonRepeating(`${pool}_${parity}`, indices);
    const key = `${pool}_${idx}`;
    const buf = buffers.get(key);

    if (!buf) {
      preload(ctx);
      return playProceduralStoneFootstep(ctx, sfxDest, reverbDest, {
        classId,
        stepParity: parity,
        isSprinting,
        surface
      });
    }

    const classWeight = isWarrior ? 1.0 : isMage ? 0.72 : 0.85;
    const sprintMult = isSprinting ? 1.18 : 1.0;
    const gainJit = 0.93 + Math.random() * 0.14;
    const gainPeak = 0.42 * classWeight * sprintMult * gainJit;

    const footTilt = parity === 0 ? 0.985 : 1.015;
    const rate = footTilt * (isSprinting ? 1.03 : 1.0) * (0.97 + Math.random() * 0.06);
    const highShelfDb = isWarrior ? 0 : isMage ? -3.0 : -1.5;

    return playLoadedBuffer(ctx, buf, {
      dest: sfxDest,
      reverbDest,
      gainPeak,
      rate,
      reverbSend: getReflAmount(surface, 0.46),
      highShelfDb,
      highShelfFreq: 3800
    });
  }

  function playRollStone({ surface = 'stone_courtyard' } = {}) {
    const ctx = safeGet(getCtx);
    const sfxDest = safeGet(getSfxDest);
    if (!ctx || !sfxDest) return false;
    if (!canFire('roll_stone', 180)) return false;

    const reverbDest = safeGet(getStoneReverbDest);
    const idx = pickNonRepeating('roll_stone', [1, 2]);
    const buf = buffers.get(`roll_stone_${idx}`);

    if (!buf) {
      preload(ctx);
      return playProceduralRollStone(ctx, sfxDest, reverbDest, surface);
    }

    return playLoadedBuffer(ctx, buf, {
      dest: sfxDest,
      reverbDest,
      gainPeak: 0.56 * (0.95 + Math.random() * 0.10),
      rate: 0.96 + Math.random() * 0.08,
      reverbSend: getReflAmount(surface, 0.46)
    });
  }

  function playTurnScrape({ surface = 'stone_courtyard' } = {}) {
    const ctx = safeGet(getCtx);
    const sfxDest = safeGet(getSfxDest);
    if (!ctx || !sfxDest) return false;
    if (!canFire('turn_scrape', 160)) return false;

    const reverbDest = safeGet(getStoneReverbDest);
    const idx = pickNonRepeating('turn_scrape', [1, 2]);
    const buf = buffers.get(`turn_scrape_${idx}`);

    if (!buf) {
      preload(ctx);
      return playProceduralTurnScrape(ctx, sfxDest, reverbDest, surface);
    }

    return playLoadedBuffer(ctx, buf, {
      dest: sfxDest,
      reverbDest,
      gainPeak: 0.44 * (0.94 + Math.random() * 0.12),
      rate: 0.96 + Math.random() * 0.08,
      reverbSend: getReflAmount(surface, 0.42)
    });
  }

  function playFogGate() {
    const ctx = safeGet(getCtx);
    const sfxDest = safeGet(getSfxDest);
    if (!ctx || !sfxDest) return false;
    if (!canFire('fog_gate', 420)) return false;

    const reverbDest = safeGet(getStoneReverbDest);
    const buf = buffers.get('fog_gate');

    if (!buf) {
      preload(ctx);
      return playProceduralFogGate(ctx, sfxDest, reverbDest);
    }

    return playLoadedBuffer(ctx, buf, {
      dest: sfxDest,
      reverbDest,
      gainPeak: 0.62,
      rate: 0.98 + Math.random() * 0.04,
      reverbSend: 0.78
    });
  }

  function playCastleDoorOpen() {
    const ctx = safeGet(getCtx);
    const sfxDest = safeGet(getSfxDest);
    if (!ctx || !sfxDest) return false;
    if (!canFire('door_open', 600)) return false;

    const reverbDest = safeGet(getStoneReverbDest);
    const buf = buffers.get('door_open');

    if (!buf) {
      preload(ctx);
      return playProceduralCastleDoorOpen(ctx, sfxDest, reverbDest);
    }

    return playLoadedBuffer(ctx, buf, {
      dest: sfxDest,
      reverbDest,
      gainPeak: 0.72,
      rate: 0.99 + Math.random() * 0.02,
      reverbSend: 0.65
    });
  }

  function playCastleDoorClose() {
    const ctx = safeGet(getCtx);
    const sfxDest = safeGet(getSfxDest);
    if (!ctx || !sfxDest) return false;
    if (!canFire('door_close', 350)) return false;

    const reverbDest = safeGet(getStoneReverbDest);
    const buf = buffers.get('door_close');

    if (!buf) {
      preload(ctx);
      return playProceduralCastleDoorClose(ctx, sfxDest, reverbDest);
    }

    return playLoadedBuffer(ctx, buf, {
      dest: sfxDest,
      reverbDest,
      gainPeak: 0.76,
      rate: 0.98 + Math.random() * 0.04,
      reverbSend: 0.72
    });
  }

  function setAmbientActive(active, { nearBonfire = false, bonfireProximity = null } = {}) {
    ambientActive = Boolean(active);
    if (!ambientActive) {
      bonfireLevel = 0;
    } else if (typeof bonfireProximity === 'number' && Number.isFinite(bonfireProximity)) {
      bonfireLevel = clamp(bonfireProximity, 0, 1);
    } else if (typeof nearBonfire === 'number' && Number.isFinite(nearBonfire)) {
      bonfireLevel = clamp(nearBonfire, 0, 1);
    } else {
      bonfireLevel = nearBonfire ? 1.0 : 0.0;
    }

    if (ambientActive) {
      const ctx = safeGet(getCtx);
      if (ctx && (!buffers.has('cathedral_drone') || !buffers.has('bonfire_crackle'))) {
        preload(ctx);
      }
    }
    syncAmbientLoops();
  }

  function dispose() {
    ambientActive = false;
    bonfireLevel = 0;
    teardownDrone();
    teardownBonfire();
    buffers.clear();
    pendingLoads.clear();
    fallbackWhiteNoise = null;
    fallbackNoiseCtx = null;
  }

  return {
    preload,
    playStoneFootstep,
    playRollStone,
    playTurnScrape,
    playFogGate,
    playCastleDoorOpen,
    playCastleDoorClose,
    setAmbientActive,
    dispose,
    getLoadedCount() {
      return buffers.size;
    },
    isAmbientActive() {
      return ambientActive;
    }
  };
}
