// Procedural Web Audio API Dark-Fantasy Synthesizer + Abandoned Knight Rift Studio Audio Router
// Instant startup, crisp dynamics, full suspend/mute compliance.

import { createSoulsEnvAudio } from './souls/soulsEnvAudio.js?v=20261121z68';
import { createSoulsHeroAudio } from './souls/soulsHeroAudio.js?v=20261121z68';
import { createSoulsEnemyAudio } from './souls/soulsEnemyAudio.js?v=20261121z68';
import { createSoulsMusicManager } from './souls/soulsMusicManager.js?v=20261121z68';
import { createSoulsSpatialAudio } from './souls/soulsSpatialAudio.js?v=20261121z68';

export function createAudioEngine() {
  let ctx = null;
  let masterGain = null;
  let sfxGain = null;
  let musicGain = null;
  let musicFilter = null;
  let compressor = null;
  let stoneReflIn = null;
  let whiteNoiseBuffer = null;
  let brownNoiseBuffer = null;
  const externalSampleBuffers = new Map();
  let uspShotCycleIdx = 0;
  let coinPitchStreak = 0;
  let lastCoinAt = 0;
  const lastFootstepChoice = Object.create(null);

  function preloadExternalSamples(audioCtx) {
    if (!audioCtx || typeof fetch === 'undefined') return;
    const stepVer = '20261121z68';
    const files = [
      ['usp_1', './assets/audio/usp_shot_1.wav?v=20261117z25'],
      ['usp_2', './assets/audio/usp_shot_2.wav?v=20261117z25'],
      ['usp_3', './assets/audio/usp_shot_3.wav?v=20261117z25'],
      ['map_open', './assets/audio/map_open.wav?v=20261117z25'],
      ['portal_enter', './assets/audio/portal_enter.wav?v=20261117z25'],
      ['step_warrior_1', `./assets/audio/step_warrior_1.wav?v=${stepVer}`],
      ['step_warrior_2', `./assets/audio/step_warrior_2.wav?v=${stepVer}`],
      ['step_warrior_3', `./assets/audio/step_warrior_3.wav?v=${stepVer}`],
      ['step_warrior_4', `./assets/audio/step_warrior_4.wav?v=${stepVer}`],
      ['step_warrior_5', `./assets/audio/step_warrior_5.wav?v=${stepVer}`],
      ['step_warrior_6', `./assets/audio/step_warrior_6.wav?v=${stepVer}`],
      ['step_gunslinger_1', `./assets/audio/step_gunslinger_1.wav?v=${stepVer}`],
      ['step_gunslinger_2', `./assets/audio/step_gunslinger_2.wav?v=${stepVer}`],
      ['step_gunslinger_3', `./assets/audio/step_gunslinger_3.wav?v=${stepVer}`],
      ['step_gunslinger_4', `./assets/audio/step_gunslinger_4.wav?v=${stepVer}`],
      ['step_mage_1', `./assets/audio/step_mage_1.wav?v=${stepVer}`],
      ['step_mage_2', `./assets/audio/step_mage_2.wav?v=${stepVer}`],
      ['step_mage_3', `./assets/audio/step_mage_3.wav?v=${stepVer}`],
      ['step_mage_4', `./assets/audio/step_mage_4.wav?v=${stepVer}`]
    ];
    for (const [key, url] of files) {
      if (externalSampleBuffers.has(key)) continue;
      externalSampleBuffers.set(key, null);
      fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
        .then((ab) => audioCtx.decodeAudioData(ab))
        .then((buf) => {
          externalSampleBuffers.set(key, buf);
        })
        .catch(() => {
          externalSampleBuffers.delete(key);
        });
    }
  }

  function playSampleBuffer(key, gainPeak = 0.65, rate = 1.0) {
    const dest = compressor || sfxGain;
    if (!ctx || !dest) return false;
    const buf = externalSampleBuffers.get(key);
    if (!buf) {
      preloadExternalSamples(ctx);
      return false;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = gainPeak;
    src.connect(g);
    g.connect(dest);
    src.onended = () => {
      try { src.disconnect(); } catch {}
      try { g.disconnect(); } catch {}
    };
    src.start(0);
    return true;
  }

  function playFootstepSample(key, {
    gainPeak = 0.38,
    rate = 1.0,
    lowShelfDb = 0,
    highShelfDb = 0,
    lpFreq = 0
  } = {}) {
    if (!ctx || !compressor) return false;
    const buf = externalSampleBuffers.get(key);
    if (!buf) {
      preloadExternalSamples(ctx);
      return false;
    }
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.setValueAtTime(rate, t0);

    let tail = src;
    const nodes = [src];
    if (lowShelfDb !== 0) {
      const ls = ctx.createBiquadFilter();
      ls.type = 'lowshelf';
      ls.frequency.setValueAtTime(135, t0);
      ls.gain.setValueAtTime(lowShelfDb, t0);
      tail.connect(ls);
      tail = ls;
      nodes.push(ls);
    }
    if (highShelfDb !== 0) {
      const hs = ctx.createBiquadFilter();
      hs.type = 'highshelf';
      hs.frequency.setValueAtTime(1850, t0);
      hs.gain.setValueAtTime(highShelfDb, t0);
      tail.connect(hs);
      tail = hs;
      nodes.push(hs);
    }
    if (lpFreq > 0) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(lpFreq, t0);
      lp.Q.setValueAtTime(0.7, t0);
      tail.connect(lp);
      tail = lp;
      nodes.push(lp);
    }

    const g = ctx.createGain();
    g.gain.setValueAtTime(gainPeak, t0);
    tail.connect(g);
    g.connect(compressor);
    nodes.push(g);

    src.onended = () => {
      for (let i = 0; i < nodes.length; i++) {
        try { nodes[i].disconnect(); } catch {}
      }
    };
    src.start(t0);
    return true;
  }
  let distortionCurve = null;

  let muted = false;
  let userVolume = 0.72;
  let sfxVolume = 0.75;
  let musicVolume = 0.38;
  try {
    const savedVol = localStorage.getItem('grimborne_volume');
    if (savedVol !== null && Number.isFinite(Number(savedVol))) {
      userVolume = Math.max(0, Math.min(1, Number(savedVol)));
    }
    const savedSfx = localStorage.getItem('grimborne_sfx_volume');
    if (savedSfx !== null && Number.isFinite(Number(savedSfx))) {
      sfxVolume = Math.max(0, Math.min(1, Number(savedSfx)));
    } else if (savedVol !== null && Number.isFinite(Number(savedVol))) {
      sfxVolume = userVolume;
    }
    const savedMusic = localStorage.getItem('grimborne_music_volume');
    if (savedMusic !== null && Number.isFinite(Number(savedMusic))) {
      musicVolume = Math.max(0, Math.min(1, Number(savedMusic)));
    }
    const savedMute = localStorage.getItem('grimborne_muted');
    if (savedMute === '1') muted = true;
  } catch {}
  let suspendedBySystem = false;
  let unlocked = false;
  let musicMode = 'hub'; // 'hub' | 'combat' | 'boss' | 'off'
  let musicStep = 0;
  let musicTimerId = null;
  let nextNoteTime = 0;

  const lastTriggerAt = Object.create(null);

  function canTrigger(tag, minIntervalMs) {
    const now = performance.now();
    const prev = lastTriggerAt[tag] || 0;
    if (now - prev < minIntervalMs) return false;
    lastTriggerAt[tag] = now;
    return true;
  }

  function makeDistortionCurve(amount = 36) {
    const samples = 512;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  function getOrCreateStoneReverbSend() {
    if (!ctx || !compressor) return null;
    if (stoneReflIn) return stoneReflIn;

    // Shared early-reflection bus for Souls stone footsteps & cathedral cues
    // Tap 1: 28 ms @ -14 dB (~0.200), Tap 2: 64 ms @ -20 dB (~0.100), LP 2400 Hz
    stoneReflIn = ctx.createGain();
    stoneReflIn.gain.setValueAtTime(1.0, ctx.currentTime);
    const stoneReflLp = ctx.createBiquadFilter();
    stoneReflLp.type = 'lowpass';
    stoneReflLp.frequency.setValueAtTime(2400, ctx.currentTime);
    stoneReflLp.Q.setValueAtTime(0.75, ctx.currentTime);

    const reflDelay1 = ctx.createDelay(0.12);
    reflDelay1.delayTime.setValueAtTime(0.028, ctx.currentTime);
    const reflGain1 = ctx.createGain();
    reflGain1.gain.setValueAtTime(0.20, ctx.currentTime); // -14 dB

    const reflDelay2 = ctx.createDelay(0.12);
    reflDelay2.delayTime.setValueAtTime(0.064, ctx.currentTime);
    const reflGain2 = ctx.createGain();
    reflGain2.gain.setValueAtTime(0.10, ctx.currentTime); // -20 dB

    stoneReflIn.connect(reflDelay1);
    reflDelay1.connect(reflGain1);
    reflGain1.connect(stoneReflLp);

    stoneReflIn.connect(reflDelay2);
    reflDelay2.connect(reflGain2);
    reflGain2.connect(stoneReflLp);

    stoneReflLp.connect(compressor);
    return stoneReflIn;
  }

  // Dedicated Abandoned Knight Rift 44.1 kHz studio audio sub-engines
  const soulsEnv = createSoulsEnvAudio({
    getCtx: () => ctx,
    getSfxDest: () => compressor || sfxGain,
    getMusicDest: () => musicFilter || musicGain || compressor,
    getStoneReverbDest: () => getOrCreateStoneReverbSend()
  });
  const soulsHero = createSoulsHeroAudio({
    getCtx: () => ctx,
    getSfxDest: () => compressor || sfxGain,
    getStoneReverbDest: () => getOrCreateStoneReverbSend()
  });
  const soulsEnemy = createSoulsEnemyAudio({
    getCtx: () => ctx,
    getSfxDest: () => compressor || sfxGain,
    getStoneReverbDest: () => getOrCreateStoneReverbSend(),
    duckMusic: (db, a, r) => soulsMusic?.duck?.(db, a, r)
  });
  const soulsSpatial = createSoulsSpatialAudio({
    getCtx: () => ctx,
    getMasterGain: () => masterGain || sfxGain || compressor,
    duckMusic: (db, holdSec, relSec) => soulsMusic?.duck?.(db, holdSec, relSec)
  });
  soulsSpatial.setMuted(muted);
  soulsSpatial.setVolume(Math.max(0, Math.min(1, sfxVolume * 0.92)));

  // Dedicated studio soundtracks for Abandoned Knight Rift:
  // - rift_explore: Elden Castle Drone (Bonfire / Castle Corridor / East Alcove)
  // - boss_phase1/boss_phase2: unified Epic Boss Battle (God of War Style)
  // Routed directly to masterGain (bypassing retro 980Hz musicFilter lowpass!) with own musicVolume scaling
  const SOULS_EXPLORE_TRACK_URL = './assets/audio/music_rift_explore.mp3?v=20261121z68';
  const SOULS_BOSS_TRACK_URL = './assets/audio/music_boss_rift.mp3?v=20261121z68';
  let soulsAmbientActive = false;
  const soulsMusic = createSoulsMusicManager({
    getCtx: () => ctx,
    getMusicDest: () => masterGain || musicGain,
    tracks: {
      rift_explore: SOULS_EXPLORE_TRACK_URL,
      boss_phase1: SOULS_BOSS_TRACK_URL,
      boss_phase2: SOULS_BOSS_TRACK_URL
    },
    crossfadeSec: 1.2,
    initialVolume: Math.max(0, Math.min(1, musicVolume * 0.82))
  });
  soulsMusic.setMuted(muted);

  function isSoulsMusicActive() {
    return Boolean(soulsAmbientActive && (musicMode === 'combat' || musicMode === 'boss'));
  }

  function syncSoulsBossMusic() {
    const targetSlot = !soulsAmbientActive
      ? 'off'
      : musicMode === 'boss'
        ? 'boss_phase1'
        : musicMode === 'combat'
          ? 'rift_explore'
          : 'off';

    if (targetSlot !== 'off') {
      // Silence old procedural synth drone so studio Rift explore / Boss tracks play cleanly
      stopMusicLoop();
      soulsMusic.setVolume(Math.max(0, Math.min(1, musicVolume * 0.82)));
      soulsMusic.setMuted(muted || musicVolume <= 0.001);
      soulsMusic.setSuspended(suspendedBySystem);
      if (!muted && !suspendedBySystem && musicVolume > 0.001) {
        if (ctx) {
          try { soulsMusic.preload(ctx); } catch {}
        }
        soulsMusic.setSlot(targetSlot, { crossfadeSec: 1.2 });
      }
    } else if (soulsMusic.getSlot() !== 'off') {
      soulsMusic.stop(0.8);
    }
  }

  function preloadSoulsAudio(audioCtx) {
    if (!audioCtx) return;
    try { soulsEnv.preload?.(audioCtx); } catch {}
    try { soulsHero.preload?.(audioCtx); } catch {}
    try { soulsEnemy.preload?.(audioCtx); } catch {}
    try {
      soulsSpatial.attachContext?.(audioCtx, masterGain || sfxGain || compressor);
      soulsSpatial.preload?.(audioCtx);
    } catch {}
    if (soulsAmbientActive) {
      try { soulsMusic.preload?.(audioCtx); } catch {}
    }
  }

  function ensureContext() {
    if (ctx) return ctx;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    try {
      ctx = new AudioCtx();
      compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-14, ctx.currentTime);
      compressor.knee.setValueAtTime(18, ctx.currentTime);
      compressor.ratio.setValueAtTime(6, ctx.currentTime);
      compressor.attack.setValueAtTime(0.003, ctx.currentTime);
      compressor.release.setValueAtTime(0.16, ctx.currentTime);

      masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(muted || suspendedBySystem ? 0.0001 : 0.92, ctx.currentTime);

      sfxGain = ctx.createGain();
      sfxGain.gain.setValueAtTime(Math.max(0.0001, sfxVolume * 0.85), ctx.currentTime);

      musicFilter = ctx.createBiquadFilter();
      musicFilter.type = 'lowpass';
      musicFilter.frequency.setValueAtTime(
        musicMode === 'hub' ? 540 : musicMode === 'boss' ? 980 : 780,
        ctx.currentTime
      );
      musicFilter.Q.setValueAtTime(0.95, ctx.currentTime);

      musicGain = ctx.createGain();
      musicGain.gain.setValueAtTime(
        muted || suspendedBySystem || musicMode === 'off' ? 0.0001 : Math.max(0.0001, musicVolume * 0.36),
        ctx.currentTime
      );

      compressor.connect(sfxGain);
      sfxGain.connect(masterGain);
      getOrCreateStoneReverbSend();
      musicFilter.connect(musicGain);
      musicGain.connect(masterGain);
      masterGain.connect(ctx.destination);

      // Reusable 1.2s white & brown noise buffers (zero runtime buffer allocations)
      const length = Math.floor(ctx.sampleRate * 1.2);
      whiteNoiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
      brownNoiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const wData = whiteNoiseBuffer.getChannelData(0);
      const bData = brownNoiseBuffer.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        wData[i] = white;
        lastOut = (lastOut + 0.035 * white) / 1.035;
        bData[i] = Math.max(-1, Math.min(1, lastOut * 3.1));
      }

      distortionCurve = makeDistortionCurve(42);
      preloadExternalSamples(ctx);
      preloadSoulsAudio(ctx);
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function syncGain() {
    if (!ctx || !masterGain) return;
    const t = ctx.currentTime;
    const targetMaster = muted || suspendedBySystem ? 0.0001 : 0.92;
    masterGain.gain.cancelScheduledValues(t);
    masterGain.gain.setTargetAtTime(targetMaster, t, 0.018);

    if (sfxGain) {
      const targetSfx = muted || suspendedBySystem ? 0.0001 : Math.max(0.0001, sfxVolume * 0.85);
      sfxGain.gain.cancelScheduledValues(t);
      sfxGain.gain.setTargetAtTime(targetSfx, t, 0.018);
    }
    if (musicGain) {
      const modeMult = musicMode === 'off' ? 0 : musicMode === 'hub' ? 0.34 : musicMode === 'boss' ? 0.42 : 0.36;
      const targetMusic = muted || suspendedBySystem || musicVolume <= 0.001 ? 0.0001 : Math.max(0.0001, musicVolume * modeMult);
      musicGain.gain.cancelScheduledValues(t);
      musicGain.gain.setTargetAtTime(targetMusic, t, 0.05);
    }
    if (musicFilter) {
      const targetCutoff = musicMode === 'hub' ? 540 : musicMode === 'boss' ? 980 : 780;
      musicFilter.frequency.setTargetAtTime(targetCutoff, t, 0.08);
    }
  }

  // =========================================================================
  // Procedural Dark-Fantasy Hub & Restrained Combat/Boss Ambient Sequencer
  // =========================================================================
  const HUB_DARK_PULSE = [
    82.41, 0, 0, 0, 0, 0, 98.00, 0,
    110.00, 0, 0, 0, 98.00, 0, 87.31, 0,
    82.41, 0, 0, 0, 0, 0, 123.47, 0,
    110.00, 0, 98.00, 0, 92.50, 0, 87.31, 0
  ];
  // Restrained dark D-minor / Phrygian sub-bass drone for arena combat (zero harsh distortion!)
  const COMBAT_DARK_DRONE = [
    73.42, 0, 0, 0, 0, 0, 0, 0,
    77.78, 0, 0, 0, 0, 0, 0, 0,
    55.00, 0, 0, 0, 0, 0, 0, 0,
    87.31, 0, 0, 0, 82.41, 0, 0, 0
  ];
  // Deeper ominous C-Phrygian ritual drone for boss fights
  const BOSS_DARK_DRONE = [
    65.41, 0, 0, 0, 0, 0, 0, 0,
    69.30, 0, 0, 0, 0, 0, 0, 0,
    49.00, 0, 0, 0, 0, 0, 0, 0,
    51.91, 0, 0, 0, 61.74, 0, 0, 0
  ];

  function scheduleMusicNote(stepIdx, t) {
    if (!ctx || !musicFilter || muted || suspendedBySystem || musicMode === 'off' || musicVolume <= 0.001) {
      return;
    }

    const step = stepIdx % 32;

    if (musicMode === 'hub') {
      const freq = HUB_DARK_PULSE[step];
      if (freq > 0) {
        const dur = 0.34;
        const osc = ctx.createOscillator();
        const sub = ctx.createOscillator();
        const g = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        sub.type = 'sine';
        sub.frequency.setValueAtTime(freq * 0.5, t);

        const amp = 0.12;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(amp, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        osc.connect(g);
        sub.connect(g);
        g.connect(musicFilter);
        osc.onended = () => {
          try { osc.disconnect(); } catch {}
          try { sub.disconnect(); } catch {}
          try { g.disconnect(); } catch {}
        };

        osc.start(t);
        sub.start(t);
        osc.stop(t + dur + 0.015);
        sub.stop(t + dur + 0.015);
      }
      return;
    }

    // Restrained dark-fantasy combat & boss ambient (warm low drone + muted frame-drum pulse)
    const isBoss = musicMode === 'boss';
    const droneTable = isBoss ? BOSS_DARK_DRONE : COMBAT_DARK_DRONE;
    const droneFreq = droneTable[step];

    if (droneFreq > 0) {
      const dur = isBoss ? 0.92 : 0.86;
      const sub = ctx.createOscillator();
      const pad = ctx.createOscillator();
      const g = ctx.createGain();

      sub.type = 'sine';
      sub.frequency.setValueAtTime(droneFreq, t);
      pad.type = 'triangle';
      pad.frequency.setValueAtTime(droneFreq * 1.5, t); // Soft fifth overtone

      const peak = isBoss ? 0.11 : 0.092;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.055);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      const padGain = ctx.createGain();
      padGain.gain.setValueAtTime(0.32, t);

      sub.connect(g);
      pad.connect(padGain);
      padGain.connect(g);
      g.connect(musicFilter);
      sub.onended = () => {
        try { sub.disconnect(); } catch {}
        try { pad.disconnect(); } catch {}
        try { padGain.disconnect(); } catch {}
        try { g.disconnect(); } catch {}
      };

      sub.start(t);
      pad.start(t);
      sub.stop(t + dur + 0.02);
      pad.stop(t + dur + 0.02);
    }

    // Muffled war-drum / heartbeat low tom on soft rhythmic grid
    const subStep = step % 8;
    const isMainBeat = subStep === 0;
    const isOffBeat = isBoss ? (subStep === 3 || subStep === 6) : subStep === 4;
    if (isMainBeat || isOffBeat) {
      const drumDur = isMainBeat ? 0.22 : 0.14;
      const drumOsc = ctx.createOscillator();
      const drumGain = ctx.createGain();
      drumOsc.type = 'sine';
      const startHz = isMainBeat ? (isBoss ? 86 : 78) : (isBoss ? 68 : 64);
      const endHz = isMainBeat ? 36 : 38;
      drumOsc.frequency.setValueAtTime(startHz, t);
      drumOsc.frequency.exponentialRampToValueAtTime(endHz, t + drumDur);

      const drumAmp = isMainBeat ? (isBoss ? 0.13 : 0.105) : (isBoss ? 0.075 : 0.058);
      drumGain.gain.setValueAtTime(0.0001, t);
      drumGain.gain.linearRampToValueAtTime(drumAmp, t + 0.008);
      drumGain.gain.exponentialRampToValueAtTime(0.0001, t + drumDur);

      drumOsc.connect(drumGain);
      drumGain.connect(musicFilter);
      drumOsc.onended = () => {
        try { drumOsc.disconnect(); } catch {}
        try { drumGain.disconnect(); } catch {}
      };
      drumOsc.start(t);
      drumOsc.stop(t + drumDur + 0.015);
    }

    // Subtle muffled brush/shaker texture on weak subdivisions
    if (step % 4 === 2 && brownNoiseBuffer) {
      const nSrc = ctx.createBufferSource();
      nSrc.buffer = brownNoiseBuffer;
      const nLp = ctx.createBiquadFilter();
      nLp.type = 'bandpass';
      nLp.frequency.setValueAtTime(isBoss ? 520 : 440, t);
      nLp.Q.setValueAtTime(1.4, t);
      const nGain = ctx.createGain();
      const nDur = 0.065;
      nGain.gain.setValueAtTime(0.0001, t);
      nGain.gain.linearRampToValueAtTime(isBoss ? 0.026 : 0.020, t + 0.006);
      nGain.gain.exponentialRampToValueAtTime(0.0001, t + nDur);

      nSrc.connect(nLp);
      nLp.connect(nGain);
      nGain.connect(musicFilter);
      nSrc.onended = () => {
        try { nSrc.disconnect(); } catch {}
        try { nLp.disconnect(); } catch {}
        try { nGain.disconnect(); } catch {}
      };
      nSrc.start(t, Math.random() * 0.5, nDur + 0.01);
    }

    // Whisper-soft eerie dark bell overtone on bar downbeats during boss encounters
    if (isBoss && (step === 0 || step === 16)) {
      const bellOsc = ctx.createOscillator();
      const bellGain = ctx.createGain();
      bellOsc.type = 'sine';
      const bellHz = step === 0 ? 261.63 : 277.18;
      bellOsc.frequency.setValueAtTime(bellHz, t);
      bellGain.gain.setValueAtTime(0.0001, t);
      bellGain.gain.linearRampToValueAtTime(0.024, t + 0.02);
      bellGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.72);
      bellOsc.connect(bellGain);
      bellGain.connect(musicFilter);
      bellOsc.onended = () => {
        try { bellOsc.disconnect(); } catch {}
        try { bellGain.disconnect(); } catch {}
      };
      bellOsc.start(t);
      bellOsc.stop(t + 0.75);
    }
  }

  function stopMusicLoop() {
    if (musicTimerId !== null) {
      clearInterval(musicTimerId);
      musicTimerId = null;
    }
  }

  function startMusicLoop() {
    if (isSoulsMusicActive()) {
      stopMusicLoop();
      return;
    }
    if (musicMode === 'off' || muted || suspendedBySystem || musicVolume <= 0.001) {
      stopMusicLoop();
      return;
    }
    if (musicTimerId !== null) return;
    if (!ctx) return;
    nextNoteTime = Math.max(ctx.currentTime + 0.04, nextNoteTime || ctx.currentTime + 0.04);
    musicTimerId = setInterval(() => {
      if (isSoulsMusicActive() || musicMode === 'off' || muted || suspendedBySystem || musicVolume <= 0.001) {
        stopMusicLoop();
        return;
      }
      if (!ctx || ctx.state !== 'running') {
        if (ctx) nextNoteTime = ctx.currentTime + 0.05;
        return;
      }
      const bpm = musicMode === 'boss' ? 114 : musicMode === 'combat' ? 104 : 96;
      const stepSec = 60 / bpm / 4;
      const horizon = ctx.currentTime + 0.18;
      if (nextNoteTime < ctx.currentTime - 0.10) {
        nextNoteTime = ctx.currentTime + 0.03;
      }
      let scheduled = 0;
      while (nextNoteTime < horizon && scheduled < 6) {
        scheduleMusicNote(musicStep, nextNoteTime);
        musicStep = (musicStep + 1) % 32;
        nextNoteTime += stepSec;
        scheduled += 1;
      }
    }, 36);
  }

  function unlock() {
    const audio = ensureContext();
    if (!audio) return;
    if (audio.state === 'suspended' && !suspendedBySystem) {
      audio.resume().catch(() => {});
    }
    unlocked = true;
    preloadExternalSamples(audio);
    preloadSoulsAudio(audio);
    soulsMusic.unlock();
    syncSoulsBossMusic();
    startMusicLoop();
  }

  // Unlock / recover AudioContext on user gesture (crucial on iOS & macOS Safari after suspend!)
  if (typeof window !== 'undefined') {
    const ensureGestureResume = () => {
      if (!unlocked) {
        unlock();
      } else if (ctx && ctx.state === 'suspended' && !suspendedBySystem) {
        ctx.resume().then(() => startMusicLoop()).catch(() => {});
      }
    };
    window.addEventListener('pointerdown', ensureGestureResume, { capture: true, passive: true });
    window.addEventListener('keydown', ensureGestureResume, { capture: true, passive: true });
    window.addEventListener('touchstart', ensureGestureResume, { capture: true, passive: true });
  }

  function readyToPlay() {
    if (muted || suspendedBySystem) return false;
    const audio = ensureContext();
    if (!audio) return false;
    if (audio.state === 'suspended') {
      audio.resume().catch(() => {});
      if (!unlocked) return false;
    }
    return true;
  }

  function createNoiseSource(brown = false) {
    const src = ctx.createBufferSource();
    src.buffer = brown ? brownNoiseBuffer : whiteNoiseBuffer;
    src.loop = true;
    const randomOffset = Math.random() * 0.6;
    return { src, randomOffset };
  }

  function playTone({
    type = 'sine',
    freqStart = 440,
    freqEnd = null,
    startTime = 0,
    duration = 0.15,
    gainPeak = 0.25,
    attack = 0.005,
    detune = 0
  }) {
    const t0 = ctx.currentTime + startTime;
    const tEnd = t0 + duration;

    const osc = ctx.createOscillator();
    const g = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(18, freqStart), t0);
    if (detune) osc.detune.setValueAtTime(detune, t0);
    if (freqEnd !== null && freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(18, freqEnd), tEnd);
    }

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gainPeak, t0 + Math.min(attack, duration * 0.4));
    g.gain.exponentialRampToValueAtTime(0.0001, tEnd);

    osc.connect(g);
    g.connect(compressor);

    osc.start(t0);
    osc.stop(tEnd + 0.01);
  }

  function playFilteredNoise({
    brown = false,
    filterType = 'bandpass',
    freqStart = 1000,
    freqEnd = 300,
    q = 1.4,
    startTime = 0,
    duration = 0.14,
    gainPeak = 0.25,
    attack = 0.004
  }) {
    const t0 = ctx.currentTime + startTime;
    const tEnd = t0 + duration;
    const { src, randomOffset } = createNoiseSource(brown);

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.Q.setValueAtTime(q, t0);
    filter.frequency.setValueAtTime(Math.max(30, freqStart), t0);
    if (freqEnd && freqEnd !== freqStart) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), tEnd);
    }

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gainPeak, t0 + Math.min(attack, duration * 0.35));
    g.gain.exponentialRampToValueAtTime(0.0001, tEnd);

    src.connect(filter);
    filter.connect(g);
    g.connect(compressor);

    src.start(t0, randomOffset, duration + 0.02);
    src.stop(tEnd + 0.02);
  }

  function playDistortedThump({
    type = 'triangle',
    freqStart = 128,
    freqEnd = 28,
    startTime = 0,
    duration = 0.20,
    gainPeak = 0.34,
    attack = 0.002,
    filterFreq = 520
  }) {
    const t0 = ctx.currentTime + startTime;
    const tEnd = t0 + duration;

    const osc = ctx.createOscillator();
    const shaper = ctx.createWaveShaper();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(18, freqStart), t0);
    if (freqEnd !== null && freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(18, freqEnd), tEnd);
    }

    shaper.curve = distortionCurve;
    shaper.oversample = '2x';

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(90, filterFreq * 0.32), tEnd);
    filter.Q.setValueAtTime(1.4, t0);

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gainPeak, t0 + Math.min(attack, duration * 0.35));
    g.gain.exponentialRampToValueAtTime(0.0001, tEnd);

    osc.connect(shaper);
    shaper.connect(filter);
    filter.connect(g);
    g.connect(compressor);

    osc.start(t0);
    osc.stop(tEnd + 0.015);
  }

  return {
    unlock,

    playMeleeSwing(weaponOrHeavy = 'club', isCrit = false) {
      if (!readyToPlay() || !canTrigger('melee', 42)) return;
      const weaponId = typeof weaponOrHeavy === 'string' ? weaponOrHeavy : weaponOrHeavy ? 'axe' : 'club';
      const jitter = 0.94 + Math.random() * 0.12;

      if (weaponId === 'spear') {
        // Fast aerodynamic spear lunge tear + crisp wooden shaft snap
        playFilteredNoise({
          brown: false,
          filterType: 'bandpass',
          freqStart: 1580 * jitter,
          freqEnd: 410 * jitter,
          q: 2.2,
          duration: 0.13,
          gainPeak: 0.30,
          attack: 0.008
        });
        playTone({
          type: 'triangle',
          freqStart: 320 * jitter,
          freqEnd: 92,
          startTime: 0.01,
          duration: 0.11,
          gainPeak: 0.24,
          attack: 0.003
        });
        playTone({
          type: 'sine',
          freqStart: 1320 * jitter,
          freqEnd: 640,
          startTime: 0.02,
          duration: 0.08,
          gainPeak: isCrit ? 0.14 : 0.09,
          attack: 0.002
        });
        return;
      }

      if (weaponId === 'zweihander') {
        // Massive heavy two-handed greatsword air cleave + resonant steel ring
        playFilteredNoise({
          brown: false,
          filterType: 'bandpass',
          freqStart: 620 * jitter,
          freqEnd: 118 * jitter,
          q: 1.75,
          duration: 0.29,
          gainPeak: 0.38,
          attack: 0.018
        });
        playDistortedThump({
          type: 'triangle',
          freqStart: 158 * jitter,
          freqEnd: 32,
          startTime: 0.03,
          duration: 0.25,
          gainPeak: 0.36,
          attack: 0.006,
          filterFreq: 480
        });
        playTone({
          type: 'sawtooth',
          freqStart: 270 * jitter,
          freqEnd: 98,
          startTime: 0.035,
          duration: 0.19,
          gainPeak: 0.15,
          attack: 0.004
        });
        return;
      }

      if (weaponId === 'axe' || weaponId === 'cleaver') {
        // Brutal heavy double-blade axe cleave + iron chop
        playFilteredNoise({
          brown: true,
          filterType: 'lowpass',
          freqStart: 920 * jitter,
          freqEnd: 140 * jitter,
          q: 1.3,
          duration: 0.25,
          gainPeak: 0.42,
          attack: 0.012
        });
        playFilteredNoise({
          brown: false,
          filterType: 'bandpass',
          freqStart: 1150 * jitter,
          freqEnd: 260,
          q: 1.5,
          duration: 0.17,
          gainPeak: 0.26,
          attack: 0.010
        });
        playDistortedThump({
          type: 'sawtooth',
          freqStart: 185 * jitter,
          freqEnd: 38,
          startTime: 0.02,
          duration: 0.20,
          gainPeak: 0.34,
          attack: 0.004,
          filterFreq: 540
        });
        return;
      }

      if (weaponId === 'boss_hammer' || weaponId === 'flail') {
        // Seismic warhammer wind roar + deep stone/anvil impact boom
        playFilteredNoise({
          brown: true,
          filterType: 'lowpass',
          freqStart: 540 * jitter,
          freqEnd: 85 * jitter,
          q: 1.1,
          duration: 0.32,
          gainPeak: 0.46,
          attack: 0.018
        });
        playDistortedThump({
          type: 'sine',
          freqStart: 132 * jitter,
          freqEnd: 24,
          startTime: 0.04,
          duration: 0.32,
          gainPeak: 0.50,
          attack: 0.004,
          filterFreq: 380
        });
        playTone({
          type: 'triangle',
          freqStart: 420 * jitter,
          freqEnd: 165,
          startTime: 0.045,
          duration: 0.18,
          gainPeak: 0.16,
          attack: 0.002
        });
        return;
      }

      // Default / 'club' (Рыцарский меч): agile broadsword cut + steel flash
      playFilteredNoise({
        brown: false,
        filterType: 'bandpass',
        freqStart: (isCrit ? 1160 : 980) * jitter,
        freqEnd: 230 * jitter,
        q: 1.5,
        duration: 0.15,
        gainPeak: 0.27,
        attack: 0.010
      });
      playTone({
        type: 'triangle',
        freqStart: 195 * jitter,
        freqEnd: 52,
        startTime: 0.02,
        duration: 0.13,
        gainPeak: 0.26,
        attack: 0.004
      });
      playTone({
        type: 'sine',
        freqStart: 690 * jitter,
        freqEnd: 290,
        startTime: 0.015,
        duration: 0.09,
        gainPeak: isCrit ? 0.14 : 0.08,
        attack: 0.002
      });
    },

    playGunshot(weaponId = 'usp_pistol') {
      const minGap = weaponId === 'smg' ? 24 : weaponId === 'ak47' ? 35 : weaponId === 'usp_pistol' ? 42 : 52;
      if (!readyToPlay() || !canTrigger('gun', minGap)) return;
      const jitter = 0.95 + Math.random() * 0.10;

      if (weaponId === 'usp_pistol') {
        // Play genuine recorded CC0 .45/9mm Tactical USP gunshot sample (cycling 3 variations + brass shell tink!)
        preloadExternalSamples(ctx);
        const sampleKey = `usp_${(uspShotCycleIdx++ % 3) + 1}`;
        const playedReal = playSampleBuffer(sampleKey, 0.72, 0.96 + Math.random() * 0.08);
        if (playedReal) {
          // Subtle brass casing clink on cobblestone 120ms later
          playTone({
            type: 'sine',
            freqStart: 3150 * jitter,
            freqEnd: 2680,
            startTime: 0.11,
            duration: 0.026,
            gainPeak: 0.045,
            attack: 0.001
          });
          return;
        }
        // Fallback if sample is still decoding on very first shot
        playTone({
          type: 'triangle',
          freqStart: 220 * jitter,
          freqEnd: 54,
          duration: 0.095,
          gainPeak: 0.34,
          attack: 0.001
        });
        playFilteredNoise({
          brown: false,
          filterType: 'bandpass',
          freqStart: 3600 * jitter,
          freqEnd: 1150,
          q: 1.4,
          duration: 0.075,
          gainPeak: 0.34,
          attack: 0.001
        });
        playFilteredNoise({
          brown: false,
          filterType: 'highpass',
          freqStart: 4200 * jitter,
          freqEnd: 1900,
          q: 1.6,
          startTime: 0.002,
          duration: 0.032,
          gainPeak: 0.22,
          attack: 0.001
        });
        playTone({
          type: 'sine',
          freqStart: 2950 * jitter,
          freqEnd: 2450,
          startTime: 0.045,
          duration: 0.028,
          gainPeak: 0.06,
          attack: 0.001
        });
        return;
      }

      if (weaponId === 'colt') {
        // Heavy .44 Magnum Colt Revolver thunder-crack + resonant brass cylinder ring!
        playTone({
          type: 'triangle',
          freqStart: 2600 * jitter,
          freqEnd: 1120,
          duration: 0.015,
          gainPeak: 0.14,
          attack: 0.001
        });
        playDistortedThump({
          type: 'sawtooth',
          freqStart: 215 * jitter,
          freqEnd: 38,
          startTime: 0.004,
          duration: 0.19,
          gainPeak: 0.44,
          attack: 0.0015,
          filterFreq: 880
        });
        playFilteredNoise({
          brown: false,
          filterType: 'highpass',
          freqStart: 3400 * jitter,
          freqEnd: 1200,
          q: 1.2,
          startTime: 0.004,
          duration: 0.14,
          gainPeak: 0.36,
          attack: 0.001
        });
        playFilteredNoise({
          brown: true,
          filterType: 'bandpass',
          freqStart: 1250 * jitter,
          freqEnd: 320,
          q: 1.0,
          startTime: 0.01,
          duration: 0.22,
          gainPeak: 0.30,
          attack: 0.002
        });
        return;
      }

      if (weaponId === 'smg') {
        // Rapid crisp 9mm SMG chatter + light high-speed bolt tick
        playTone({
          type: 'square',
          freqStart: 270 * jitter,
          freqEnd: 74,
          duration: 0.062,
          gainPeak: 0.20,
          attack: 0.001
        });
        playFilteredNoise({
          brown: false,
          filterType: 'bandpass',
          freqStart: 3200 * jitter,
          freqEnd: 1050,
          q: 1.35,
          duration: 0.055,
          gainPeak: 0.27,
          attack: 0.001
        });
        playTone({
          type: 'triangle',
          freqStart: 2150 * jitter,
          freqEnd: 1450,
          startTime: 0.022,
          duration: 0.020,
          gainPeak: 0.055,
          attack: 0.001
        });
        return;
      }

      if (weaponId === 'ak47') {
        // Punchy 7.62x39 Kalashnikov bark + steel gas-piston carrier slam
        playDistortedThump({
          type: 'sawtooth',
          freqStart: 192 * jitter,
          freqEnd: 42,
          duration: 0.135,
          gainPeak: 0.38,
          attack: 0.001,
          filterFreq: 980
        });
        playFilteredNoise({
          brown: false,
          filterType: 'bandpass',
          freqStart: 2800 * jitter,
          freqEnd: 680,
          q: 1.15,
          duration: 0.11,
          gainPeak: 0.34,
          attack: 0.001
        });
        playFilteredNoise({
          brown: false,
          filterType: 'highpass',
          freqStart: 3600 * jitter,
          freqEnd: 1650,
          q: 1.5,
          duration: 0.04,
          gainPeak: 0.20,
          attack: 0.001
        });
        playTone({
          type: 'triangle',
          freqStart: 1680 * jitter,
          freqEnd: 920,
          startTime: 0.036,
          duration: 0.028,
          gainPeak: 0.085,
          attack: 0.001
        });
        return;
      }

      if (weaponId === 'blunderbuss') {
        // Massive twin-barrel black-powder cannon boom
        playTone({
          type: 'sine',
          freqStart: 145 * jitter,
          freqEnd: 26,
          duration: 0.33,
          gainPeak: 0.58,
          attack: 0.002
        });
        playDistortedThump({
          type: 'triangle',
          freqStart: 132 * jitter,
          freqEnd: 28,
          duration: 0.24,
          gainPeak: 0.40,
          attack: 0.002,
          filterFreq: 560
        });
        playFilteredNoise({
          brown: true,
          filterType: 'lowpass',
          freqStart: 2350,
          freqEnd: 210,
          q: 0.95,
          duration: 0.32,
          gainPeak: 0.50,
          attack: 0.002
        });
        playFilteredNoise({
          brown: false,
          filterType: 'bandpass',
          freqStart: 3400 * jitter,
          freqEnd: 720,
          q: 1.1,
          duration: 0.13,
          gainPeak: 0.30,
          attack: 0.0015
        });
        playFilteredNoise({
          brown: false,
          filterType: 'highpass',
          freqStart: 2700,
          freqEnd: 1400,
          q: 1.4,
          duration: 0.036,
          gainPeak: 0.20,
          attack: 0.001
        });
        return;
      }

      if (weaponId === 'gatling') {
        // Heavy drum-fed auto-shotgun chest thud + gunpowder roar + drum index clack
        playTone({
          type: 'sine',
          freqStart: 135 * jitter,
          freqEnd: 29,
          duration: 0.20,
          gainPeak: 0.46,
          attack: 0.002
        });
        playDistortedThump({
          type: 'triangle',
          freqStart: 125 * jitter,
          freqEnd: 30,
          duration: 0.16,
          gainPeak: 0.30,
          attack: 0.002,
          filterFreq: 520
        });
        playFilteredNoise({
          brown: true,
          filterType: 'lowpass',
          freqStart: 1950,
          freqEnd: 240,
          q: 0.9,
          duration: 0.19,
          gainPeak: 0.38,
          attack: 0.002
        });
        playFilteredNoise({
          brown: false,
          filterType: 'bandpass',
          freqStart: 3300 * jitter,
          freqEnd: 820,
          q: 1.25,
          duration: 0.095,
          gainPeak: 0.26,
          attack: 0.0015
        });
        // Revolving drum ratchet click
        playTone({
          type: 'triangle',
          freqStart: 1950 * jitter,
          freqEnd: 920 * jitter,
          startTime: 0.105,
          duration: 0.036,
          gainPeak: 0.09,
          attack: 0.0015
        });
        return;
      }

      // Default / 'pistol' («Охотничье ружьё»): Video-matched heavy 12-gauge blast + crisp trigger click + steel pump rack!
      // 1. Crisp metallic trigger/hammer pre-snap
      playTone({
        type: 'triangle',
        freqStart: 2450 * jitter,
        freqEnd: 980,
        duration: 0.018,
        gainPeak: 0.14,
        attack: 0.001
      });
      // 2. Massive sub-chest cannon thump + waveshaped low-mid punch
      playTone({
        type: 'sine',
        freqStart: 156 * jitter,
        freqEnd: 27,
        startTime: 0.006,
        duration: 0.30,
        gainPeak: 0.60,
        attack: 0.002
      });
      playDistortedThump({
        type: 'triangle',
        freqStart: 142 * jitter,
        freqEnd: 28,
        startTime: 0.006,
        duration: 0.23,
        gainPeak: 0.42,
        attack: 0.0015,
        filterFreq: 620
      });
      // 3. Sharp supersonic muzzle crack + warm gunpowder echo tail
      playFilteredNoise({
        brown: false,
        filterType: 'highpass',
        freqStart: 2900 * jitter,
        freqEnd: 1350,
        q: 1.35,
        startTime: 0.005,
        duration: 0.045,
        gainPeak: 0.28,
        attack: 0.001
      });
      playFilteredNoise({
        brown: false,
        filterType: 'bandpass',
        freqStart: 3650 * jitter,
        freqEnd: 680,
        q: 1.10,
        startTime: 0.006,
        duration: 0.135,
        gainPeak: 0.34,
        attack: 0.0015
      });
      playFilteredNoise({
        brown: true,
        filterType: 'lowpass',
        freqStart: 2450,
        freqEnd: 195,
        q: 0.92,
        startTime: 0.008,
        duration: 0.34,
        gainPeak: 0.50,
        attack: 0.002
      });

      // 4. Crisp two-click mechanical pump-action rack (chk-clack at +0.20s and +0.29s)
      playFilteredNoise({
        brown: false,
        filterType: 'bandpass',
        freqStart: 2550 * jitter,
        freqEnd: 1380 * jitter,
        q: 2.7,
        startTime: 0.20,
        duration: 0.052,
        gainPeak: 0.17,
        attack: 0.0025
      });
      playTone({
        type: 'triangle',
        freqStart: 1540 * jitter,
        freqEnd: 790,
        startTime: 0.20,
        duration: 0.032,
        gainPeak: 0.12,
        attack: 0.0015
      });

      playFilteredNoise({
        brown: false,
        filterType: 'bandpass',
        freqStart: 1720 * jitter,
        freqEnd: 3050 * jitter,
        q: 2.8,
        startTime: 0.29,
        duration: 0.056,
        gainPeak: 0.19,
        attack: 0.0025
      });
      playTone({
        type: 'triangle',
        freqStart: 2020 * jitter,
        freqEnd: 1120,
        startTime: 0.29,
        duration: 0.036,
        gainPeak: 0.14,
        attack: 0.0015
      });
    },

    playFootstep(classId = 'gunslinger', stepParity = 0, isSprinting = false, surface = 'dirt') {
      const minStepMs = isSprinting ? 160 : 180;
      if (!readyToPlay() || !canTrigger('footstep', minStepMs)) return;

      // Dedicated Abandoned Knight Rift 44.1 kHz studio stone/bridge footsteps + plate clink
      // (zero earthen step_warrior_1..6.wav samples and zero dry gravel kick!)
      if (surface === 'stone_courtyard' || surface === 'stone_bridge' || surface === 'cathedral_stone') {
        preloadSoulsAudio(ctx);
        soulsEnv.playStoneFootstep({ classId, stepParity, isSprinting, surface });
        return;
      }

      preloadExternalSamples(ctx);

      const isWarrior = classId === 'warrior';
      const isMage = classId === 'mage';
      const pool = isWarrior ? 'warrior' : isMage ? 'mage' : 'gunslinger';
      const parity = Math.abs(stepParity | 0) % 2; // 0 = left foot, 1 = right foot

      // Odd indices (1,3,5) are recorded Left-foot steps; even indices (2,4,6) are Right-foot steps
      const candidates = isWarrior
        ? (parity === 0 ? [1, 3, 5] : [2, 4, 6])
        : (parity === 0 ? [1, 3] : [2, 4]);

      const choiceSlot = `${pool}_${parity}`;
      const prevChoice = lastFootstepChoice[choiceSlot];
      const fresh = candidates.length > 1 ? candidates.filter((n) => n !== prevChoice) : candidates;
      const pickedNum = fresh[Math.floor(Math.random() * fresh.length)];
      lastFootstepChoice[choiceSlot] = pickedNum;

      // Pick decoded sample for this foot, or any decoded sample in the class pool before falling back
      let sampleKey = `step_${pool}_${pickedNum}`;
      if (!externalSampleBuffers.get(sampleKey)) {
        const totalVariants = isWarrior ? 6 : 4;
        for (let i = 1; i <= totalVariants; i++) {
          const altKey = `step_${pool}_${i}`;
          if (externalSampleBuffers.get(altKey)) {
            sampleKey = altKey;
            break;
          }
        }
      }

      const footTilt = parity === 0 ? 0.978 : 1.018;
      const rateJitter = 0.96 + Math.random() * 0.08;
      const gainJitter = 0.93 + Math.random() * 0.14;
      const sprintRate = isSprinting ? (isWarrior ? 1.09 : 1.08) : 1.0;
      const baseGain = isWarrior
        ? (isSprinting ? 0.54 : 0.38)
        : isMage
          ? (isSprinting ? 0.38 : 0.27)
          : (isSprinting ? 0.46 : 0.33);

      const playedSample = playFootstepSample(sampleKey, {
        gainPeak: baseGain * gainJitter,
        rate: footTilt * sprintRate * rateJitter,
        lowShelfDb: isSprinting ? (isWarrior ? 3.5 : isMage ? 1.4 : 2.2) : 0,
        highShelfDb: isSprinting ? (isWarrior ? 4.0 : isMage ? 2.4 : 3.2) : (Math.random() * 1.4 - 0.7),
        lpFreq: isMage ? (isSprinting ? 3100 : 2500) : 0
      });

      if (playedSample) {
        if (isWarrior && isSprinting) {
          // Subtle dry gravel kick / push-off grit on heavy sprint stride (pure filtered noise, zero tonal sweep)
          playFilteredNoise({
            brown: false,
            filterType: 'bandpass',
            freqStart: (1720 + Math.random() * 340) * footTilt,
            freqEnd: 1180 * footTilt,
            q: 1.5,
            startTime: 0.030 + Math.random() * 0.012,
            duration: 0.044,
            gainPeak: 0.052 * gainJitter,
            attack: 0.004
          });
        } else if (isMage) {
          // Whisper-quiet misty cloak / damp earth air shimmer (pure softly filtered noise, zero oscillator)
          playFilteredNoise({
            brown: false,
            filterType: 'bandpass',
            freqStart: (2350 + Math.random() * 320) * footTilt,
            freqEnd: 1580 * footTilt,
            q: 2.1,
            startTime: 0.014,
            duration: isSprinting ? 0.052 : 0.068,
            gainPeak: (isSprinting ? 0.028 : 0.020) * gainJitter,
            attack: 0.010
          });
        }
        return;
      }

      // Instant dry multi-grain foley fallback (while WAVs finish initial decode):
      // Strictly filtered brown/white noise — ZERO pitched sine/triangle rubbery sweeps!
      const sprintBoost = isSprinting ? 1.34 : 1.0;
      const toeOffset = (isSprinting ? 0.030 : 0.042) + Math.random() * 0.010;
      const fJitter = footTilt * rateJitter;

      // Phase 1: Dry low-passed boot-heel mass impact on stone/earth
      playFilteredNoise({
        brown: true,
        filterType: 'lowpass',
        freqStart: (isWarrior ? 215 : isMage ? 240 : 255) * fJitter,
        freqEnd: (isWarrior ? 92 : 125) * fJitter,
        q: 0.85,
        startTime: 0,
        duration: isWarrior ? 0.048 : 0.038,
        gainPeak: (isWarrior ? 0.34 : isMage ? 0.18 : 0.25) * sprintBoost * gainJitter,
        attack: isMage ? 0.006 : 0.002
      });

      // Phase 1b: Cobblestone sole contact transient
      playFilteredNoise({
        brown: false,
        filterType: 'bandpass',
        freqStart: (isWarrior ? 760 : isMage ? 640 : 940) * fJitter,
        freqEnd: (isWarrior ? 420 : 520) * fJitter,
        q: 1.35,
        startTime: 0.002,
        duration: 0.026,
        gainPeak: (isWarrior ? 0.16 : isMage ? 0.08 : 0.14) * sprintBoost * gainJitter,
        attack: 0.002
      });

      // Phase 2: Delayed toe-off & graveyard gravel/earth grit scrape
      playFilteredNoise({
        brown: false,
        filterType: 'bandpass',
        freqStart: (isWarrior ? 1680 : isMage ? 1420 : 1960) * fJitter * (isSprinting ? 1.18 : 1.0),
        freqEnd: (isWarrior ? 980 : 880) * fJitter,
        q: 1.55,
        startTime: toeOffset,
        duration: isSprinting ? 0.048 : 0.062,
        gainPeak: (isWarrior ? 0.14 : isMage ? 0.085 : 0.115) * sprintBoost * gainJitter,
        attack: 0.005
      });

      // Micro gravel crackle grain + subtle warrior leather/plate weight rustle
      if (isWarrior) {
        playFilteredNoise({
          brown: false,
          filterType: 'bandpass',
          freqStart: 2250 * fJitter,
          freqEnd: 1380 * fJitter,
          q: 2.1,
          startTime: toeOffset + 0.012,
          duration: 0.028,
          gainPeak: 0.065 * sprintBoost * gainJitter,
          attack: 0.003
        });
      }
    },

    playReloadShell() {
      if (!readyToPlay() || !canTrigger('reload_shell', 55)) return;
      const jitter = 0.96 + Math.random() * 0.08;
      // Crisp brass-shell insertion friction slide + lifter spring click (chk-tink)
      playFilteredNoise({
        brown: false,
        filterType: 'bandpass',
        freqStart: 1850 * jitter,
        freqEnd: 2650 * jitter,
        q: 2.8,
        duration: 0.048,
        gainPeak: 0.16,
        attack: 0.002
      });
      playTone({
        type: 'sine',
        freqStart: 215 * jitter,
        freqEnd: 92,
        duration: 0.045,
        gainPeak: 0.14,
        attack: 0.002
      });
      playTone({
        type: 'sine',
        freqStart: 2480 * jitter,
        freqEnd: 2220 * jitter,
        startTime: 0.036,
        duration: 0.065,
        gainPeak: 0.13,
        attack: 0.0015
      });
      playTone({
        type: 'triangle',
        freqStart: 3720 * jitter,
        freqEnd: 3280 * jitter,
        startTime: 0.036,
        duration: 0.045,
        gainPeak: 0.065,
        attack: 0.0015
      });
    },

    playReloadReady() {
      if (!readyToPlay() || !canTrigger('reload_ready', 80)) return;
      const jitter = 0.97 + Math.random() * 0.06;
      // Satisfying metallic shotgun pump back + bolt lock slam when reload finishes
      playFilteredNoise({
        brown: false,
        filterType: 'bandpass',
        freqStart: 2250 * jitter,
        freqEnd: 1320 * jitter,
        q: 2.5,
        duration: 0.065,
        gainPeak: 0.19,
        attack: 0.003
      });
      playTone({
        type: 'triangle',
        freqStart: 1380 * jitter,
        freqEnd: 740,
        duration: 0.04,
        gainPeak: 0.14,
        attack: 0.0015
      });

      // Forward chamber slam & steel lock clack
      playTone({
        type: 'triangle',
        freqStart: 265 * jitter,
        freqEnd: 86,
        startTime: 0.095,
        duration: 0.075,
        gainPeak: 0.24,
        attack: 0.002
      });
      playFilteredNoise({
        brown: false,
        filterType: 'bandpass',
        freqStart: 1750 * jitter,
        freqEnd: 3200 * jitter,
        q: 2.6,
        startTime: 0.095,
        duration: 0.065,
        gainPeak: 0.22,
        attack: 0.002
      });
      playTone({
        type: 'sine',
        freqStart: 2150 * jitter,
        freqEnd: 1680 * jitter,
        startTime: 0.10,
        duration: 0.085,
        gainPeak: 0.15,
        attack: 0.0015
      });
    },

    playMagicCast(styleOrWeaponId = 'fire') {
      if (!readyToPlay() || !canTrigger('magic', 42)) return;
      const jitter = 0.94 + Math.random() * 0.12;

      if (styleOrWeaponId === 'water') {
        // 💧 WATER: Video-matched pressurized hydro-jet surge + rushing wave whoosh + bubbling orb droplets!
        playTone({
          type: 'sine',
          freqStart: 165 * jitter,
          freqEnd: 52,
          duration: 0.24,
          gainPeak: 0.34,
          attack: 0.006
        });
        playFilteredNoise({
          brown: true,
          filterType: 'lowpass',
          freqStart: 1450 * jitter,
          freqEnd: 320,
          q: 1.6,
          duration: 0.30,
          gainPeak: 0.44,
          attack: 0.008
        });
        playFilteredNoise({
          brown: false,
          filterType: 'bandpass',
          freqStart: 420 * jitter,
          freqEnd: 2150 * jitter,
          q: 2.6,
          startTime: 0.012,
          duration: 0.26,
          gainPeak: 0.42,
          attack: 0.012
        });
        // Crisp water-spray hiss & bubble pops
        playFilteredNoise({
          brown: false,
          filterType: 'highpass',
          freqStart: 2400 * jitter,
          freqEnd: 1200,
          q: 1.2,
          startTime: 0.02,
          duration: 0.16,
          gainPeak: 0.18,
          attack: 0.005
        });
        playTone({
          type: 'sine',
          freqStart: 540 * jitter,
          freqEnd: 1080 * jitter,
          startTime: 0.018,
          duration: 0.055,
          gainPeak: 0.16,
          attack: 0.004
        });
        playTone({
          type: 'sine',
          freqStart: 760 * jitter,
          freqEnd: 1380 * jitter,
          startTime: 0.068,
          duration: 0.05,
          gainPeak: 0.13,
          attack: 0.004
        });
        return;
      }

      if (styleOrWeaponId === 'lightning') {
        // ⚡ LIGHTNING: Sharp high-voltage Tesla arc snap + triple electric crackle!
        playFilteredNoise({
          brown: false,
          filterType: 'highpass',
          freqStart: 4200 * jitter,
          freqEnd: 2200,
          q: 1.8,
          duration: 0.05,
          gainPeak: 0.44,
          attack: 0.001
        });
        playFilteredNoise({
          brown: false,
          filterType: 'bandpass',
          freqStart: 3100 * jitter,
          freqEnd: 5200 * jitter,
          q: 4.0,
          startTime: 0.026,
          duration: 0.045,
          gainPeak: 0.34,
          attack: 0.001
        });
        playFilteredNoise({
          brown: false,
          filterType: 'bandpass',
          freqStart: 4600 * jitter,
          freqEnd: 2600 * jitter,
          q: 3.6,
          startTime: 0.058,
          duration: 0.042,
          gainPeak: 0.26,
          attack: 0.001
        });
        playDistortedThump({
          type: 'sawtooth',
          freqStart: 245 * jitter,
          freqEnd: 92,
          duration: 0.11,
          gainPeak: 0.22,
          attack: 0.001,
          filterFreq: 1650
        });
        return;
      }

      if (styleOrWeaponId === 'air') {
        // 🌪️ AIR: Pure rushing wind gust + whistling vortex (ZERO bass thud — unmistakably rushing air!)
        playFilteredNoise({
          brown: false,
          filterType: 'bandpass',
          freqStart: 520 * jitter,
          freqEnd: 1850 * jitter,
          q: 2.6,
          duration: 0.28,
          gainPeak: 0.42,
          attack: 0.032
        });
        playFilteredNoise({
          brown: false,
          filterType: 'bandpass',
          freqStart: 1950 * jitter,
          freqEnd: 680 * jitter,
          q: 4.8,
          startTime: 0.055,
          duration: 0.25,
          gainPeak: 0.34,
          attack: 0.025
        });
        // Subtle whistling wind harmonic
        playFilteredNoise({
          brown: false,
          filterType: 'bandpass',
          freqStart: 1250 * jitter,
          freqEnd: 2650 * jitter,
          q: 8.5,
          startTime: 0.015,
          duration: 0.22,
          gainPeak: 0.22,
          attack: 0.028
        });
        return;
      }

      if (styleOrWeaponId === 'void_orb') {
        // Deep void gravitational pulse + dark wind
        playTone({
          type: 'sawtooth',
          freqStart: 128 * jitter,
          freqEnd: 36,
          duration: 0.30,
          gainPeak: 0.32,
          attack: 0.008
        });
        playFilteredNoise({
          brown: true,
          filterType: 'bandpass',
          freqStart: 760,
          freqEnd: 180,
          q: 2.8,
          duration: 0.26,
          gainPeak: 0.26,
          attack: 0.01
        });
        return;
      }

      // 🔥 FIRE (Default): Deep roaring flamethrower ignition whoosh + crackling embers!
      playTone({
        type: 'sine',
        freqStart: 92 * jitter,
        freqEnd: 32,
        duration: 0.25,
        gainPeak: 0.36,
        attack: 0.005
      });
      playFilteredNoise({
        brown: true,
        filterType: 'lowpass',
        freqStart: 920 * jitter,
        freqEnd: 260,
        q: 1.6,
        duration: 0.29,
        gainPeak: 0.50,
        attack: 0.014
      });
      playFilteredNoise({
        brown: false,
        filterType: 'bandpass',
        freqStart: 320 * jitter,
        freqEnd: 780 * jitter,
        q: 1.8,
        startTime: 0.02,
        duration: 0.22,
        gainPeak: 0.28,
        attack: 0.012
      });
    },

    playElementImpact(elemId = 'fire') {
      if (!readyToPlay() || !canTrigger(`el_imp_${elemId}`, 45)) return;
      const jitter = 0.92 + Math.random() * 0.16;

      if (elemId === 'water_prison_open') {
        // Rising swirling water sphere dome levitation!
        playFilteredNoise({
          brown: false,
          filterType: 'bandpass',
          freqStart: 280,
          freqEnd: 1450,
          q: 3.8,
          duration: 0.42,
          gainPeak: 0.46,
          attack: 0.02
        });
        playTone({
          type: 'sine',
          freqStart: 240,
          freqEnd: 520,
          duration: 0.38,
          gainPeak: 0.24,
          attack: 0.02
        });
        return;
      }

      if (elemId === 'water_prison_slam') {
        // Massive crashing tidal slam (x3 damage drop!)
        playTone({
          type: 'sine',
          freqStart: 135,
          freqEnd: 28,
          duration: 0.42,
          gainPeak: 0.56,
          attack: 0.003
        });
        playFilteredNoise({
          brown: false,
          filterType: 'bandpass',
          freqStart: 1650,
          freqEnd: 360,
          q: 1.5,
          duration: 0.36,
          gainPeak: 0.52,
          attack: 0.003
        });
        return;
      }

      if (elemId === 'air') {
        playFilteredNoise({
          brown: false,
          filterType: 'bandpass',
          freqStart: 1850 * jitter,
          freqEnd: 520,
          q: 3.2,
          duration: 0.22,
          gainPeak: 0.32,
          attack: 0.012
        });
        return;
      }

      if (elemId === 'water') {
        playFilteredNoise({
          brown: false,
          filterType: 'bandpass',
          freqStart: 1420 * jitter,
          freqEnd: 420,
          q: 2.6,
          duration: 0.18,
          gainPeak: 0.30,
          attack: 0.005
        });
        playTone({
          type: 'sine',
          freqStart: 620 * jitter,
          freqEnd: 980 * jitter,
          duration: 0.05,
          gainPeak: 0.14,
          attack: 0.003
        });
        return;
      }

      if (elemId === 'lightning') {
        playFilteredNoise({
          brown: false,
          filterType: 'highpass',
          freqStart: 3600 * jitter,
          freqEnd: 1900,
          q: 2.2,
          duration: 0.075,
          gainPeak: 0.34,
          attack: 0.001
        });
        return;
      }

      // Fire impact burst
      playTone({
        type: 'sine',
        freqStart: 118 * jitter,
        freqEnd: 40,
        duration: 0.16,
        gainPeak: 0.30,
        attack: 0.003
      });
      playFilteredNoise({
        brown: true,
        filterType: 'lowpass',
        freqStart: 1100 * jitter,
        freqEnd: 280,
        q: 1.4,
        duration: 0.18,
        gainPeak: 0.34,
        attack: 0.004
      });
    },

    playArmorBreak(kind = 'helmet') {
      if (!readyToPlay() || !canTrigger(`brk_${kind}`, 45)) return;
      const jitter = 0.94 + Math.random() * 0.12;
      if (kind === 'bones') {
        // Dry rattling bone clatter on cobblestones
        for (let b = 0; b < 3; b++) {
          playTone({
            type: 'triangle',
            freqStart: (820 + b * 240) * jitter,
            freqEnd: (380 + b * 90) * jitter,
            startTime: b * 0.038,
            duration: 0.045,
            gainPeak: 0.18 - b * 0.03,
            attack: 0.001
          });
        }
        return;
      }
      if (kind === 'shield') {
        // Heavy shield crack + metallic clank
        playTone({
          type: 'triangle',
          freqStart: 340 * jitter,
          freqEnd: 115,
          duration: 0.14,
          gainPeak: 0.32,
          attack: 0.002
        });
        playFilteredNoise({
          brown: false,
          filterType: 'bandpass',
          freqStart: 1900 * jitter,
          freqEnd: 680,
          q: 2.2,
          duration: 0.11,
          gainPeak: 0.26,
          attack: 0.002
        });
        return;
      }
      // Helmet flying off — crisp iron pot-helm ping!
      playTone({
        type: 'sine',
        freqStart: 1180 * jitter,
        freqEnd: 1090 * jitter,
        duration: 0.19,
        gainPeak: 0.24,
        attack: 0.0015
      });
      playTone({
        type: 'triangle',
        freqStart: 1760 * jitter,
        freqEnd: 1620 * jitter,
        duration: 0.13,
        gainPeak: 0.16,
        attack: 0.0015
      });
    },

    playDash() {
      if (!readyToPlay() || !canTrigger('dash', 90)) return;
      const jitter = 0.94 + Math.random() * 0.12;
      // Crisp aerodynamic wind-cut whoosh
      playFilteredNoise({
        brown: false,
        filterType: 'bandpass',
        freqStart: 1950 * jitter,
        freqEnd: 380 * jitter,
        q: 1.85,
        duration: 0.17,
        gainPeak: 0.30,
        attack: 0.008
      });
      // Soft air rush tail
      playFilteredNoise({
        brown: true,
        filterType: 'lowpass',
        freqStart: 680 * jitter,
        freqEnd: 150,
        q: 0.9,
        startTime: 0.015,
        duration: 0.19,
        gainPeak: 0.22,
        attack: 0.012
      });
      // Quick kinetic impulse pitch drop
      playTone({
        type: 'sine',
        freqStart: 240 * jitter,
        freqEnd: 78,
        duration: 0.11,
        gainPeak: 0.16,
        attack: 0.004
      });
    },

    playHit(weaponId = null) {
      if (!readyToPlay() || !canTrigger('hit', 30)) return;
      const jitter = 0.92 + Math.random() * 0.16;
      const wId = typeof weaponId === 'string' ? weaponId : '';

      if (wId === 'club') {
        // Starter Sword: crisp steel cut + clean flesh/bone thump + subtle edge ring
        playTone({
          type: 'triangle',
          freqStart: 245 * jitter,
          freqEnd: 84,
          duration: 0.075,
          gainPeak: 0.24,
          attack: 0.0018
        });
        playFilteredNoise({
          brown: false,
          filterType: 'bandpass',
          freqStart: 2150 * jitter,
          freqEnd: 680,
          q: 1.9,
          duration: 0.06,
          gainPeak: 0.20,
          attack: 0.0015
        });
        playTone({
          type: 'sine',
          freqStart: 1080 * jitter,
          freqEnd: 940 * jitter,
          duration: 0.07,
          gainPeak: 0.075,
          attack: 0.0015
        });
        return;
      }

      if (wId === 'spear') {
        // Battle Spear: tight piercing thrust snap + sharp metallic point puncture
        playTone({
          type: 'triangle',
          freqStart: 320 * jitter,
          freqEnd: 118,
          duration: 0.062,
          gainPeak: 0.22,
          attack: 0.0012
        });
        playFilteredNoise({
          brown: false,
          filterType: 'bandpass',
          freqStart: 2750 * jitter,
          freqEnd: 860,
          q: 2.3,
          duration: 0.055,
          gainPeak: 0.22,
          attack: 0.0012
        });
        playTone({
          type: 'sine',
          freqStart: 1560 * jitter,
          freqEnd: 1120,
          duration: 0.055,
          gainPeak: 0.09,
          attack: 0.001
        });
        return;
      }

      if (wId === 'zweihander') {
        // Greatsword: weighty deep cleave crunch + broad resonant steel ring
        playDistortedThump({
          type: 'triangle',
          freqStart: 162 * jitter,
          freqEnd: 42,
          duration: 0.135,
          gainPeak: 0.30,
          attack: 0.002,
          filterFreq: 620
        });
        playFilteredNoise({
          brown: false,
          filterType: 'bandpass',
          freqStart: 1420 * jitter,
          freqEnd: 360,
          q: 1.5,
          duration: 0.095,
          gainPeak: 0.22,
          attack: 0.002
        });
        playTone({
          type: 'triangle',
          freqStart: 860 * jitter,
          freqEnd: 790 * jitter,
          duration: 0.14,
          gainPeak: 0.11,
          attack: 0.002
        });
        return;
      }

      if (wId === 'axe' || wId === 'cleaver') {
        // Battle Axe: brutal heavy iron chop + coarse bone/wood bite
        playDistortedThump({
          type: 'sawtooth',
          freqStart: 178 * jitter,
          freqEnd: 46,
          duration: 0.125,
          gainPeak: 0.32,
          attack: 0.0018,
          filterFreq: 560
        });
        playFilteredNoise({
          brown: true,
          filterType: 'lowpass',
          freqStart: 1120 * jitter,
          freqEnd: 240,
          q: 1.25,
          duration: 0.10,
          gainPeak: 0.26,
          attack: 0.002
        });
        playFilteredNoise({
          brown: false,
          filterType: 'bandpass',
          freqStart: 1680 * jitter,
          freqEnd: 420,
          q: 1.4,
          duration: 0.075,
          gainPeak: 0.18,
          attack: 0.0018
        });
        return;
      }

      if (wId === 'boss_hammer' || wId === 'flail') {
        // Bonecrusher Hammer: seismic sub-bass crush + iron anvil ring
        playDistortedThump({
          type: 'sine',
          freqStart: 122 * jitter,
          freqEnd: 28,
          duration: 0.19,
          gainPeak: 0.40,
          attack: 0.002,
          filterFreq: 420
        });
        playFilteredNoise({
          brown: true,
          filterType: 'lowpass',
          freqStart: 920 * jitter,
          freqEnd: 160,
          q: 1.1,
          duration: 0.14,
          gainPeak: 0.28,
          attack: 0.002
        });
        playTone({
          type: 'triangle',
          freqStart: 620 * jitter,
          freqEnd: 560 * jitter,
          duration: 0.16,
          gainPeak: 0.13,
          attack: 0.0015
        });
        playTone({
          type: 'sine',
          freqStart: 940 * jitter,
          freqEnd: 880 * jitter,
          duration: 0.12,
          gainPeak: 0.08,
          attack: 0.0015
        });
        return;
      }

      playTone({
        type: 'triangle',
        freqStart: 210 * jitter,
        freqEnd: 72,
        duration: 0.085,
        gainPeak: 0.24,
        attack: 0.002
      });
      playFilteredNoise({
        brown: false,
        filterType: 'bandpass',
        freqStart: 1500 * jitter,
        freqEnd: 520,
        q: 1.7,
        duration: 0.065,
        gainPeak: 0.18,
        attack: 0.002
      });
    },

    playCritStrike() {
      if (!readyToPlay() || !canTrigger('crit_strike', 65)) return;
      const jitter = 0.95 + Math.random() * 0.10;
      // 1. Brutal sub-chest cleaver crunch
      playDistortedThump({
        type: 'sawtooth',
        freqStart: 165 * jitter,
        freqEnd: 32,
        duration: 0.22,
        gainPeak: 0.44,
        attack: 0.0015,
        filterFreq: 780
      });
      // 2. Wet crimson blood-and-bone splatter tear
      playFilteredNoise({
        brown: false,
        filterType: 'bandpass',
        freqStart: 2650 * jitter,
        freqEnd: 460,
        q: 1.35,
        startTime: 0.008,
        duration: 0.19,
        gainPeak: 0.34,
        attack: 0.002
      });
      playFilteredNoise({
        brown: true,
        filterType: 'lowpass',
        freqStart: 1450,
        freqEnd: 240,
        q: 1.2,
        startTime: 0.02,
        duration: 0.20,
        gainPeak: 0.30,
        attack: 0.003
      });
      // 3. Razor execution steel harmonic ring!
      playTone({
        type: 'triangle',
        freqStart: 1180 * jitter,
        freqEnd: 1090 * jitter,
        startTime: 0.004,
        duration: 0.24,
        gainPeak: 0.18,
        attack: 0.0015
      });
      playTone({
        type: 'sine',
        freqStart: 2360 * jitter,
        freqEnd: 1980 * jitter,
        startTime: 0.006,
        duration: 0.17,
        gainPeak: 0.12,
        attack: 0.0015
      });
    },

    playBlock() {
      if (!readyToPlay() || !canTrigger('block', 45)) return;
      const jitter = 0.95 + Math.random() * 0.10;
      // Solid forged-iron shield body thud
      playTone({
        type: 'triangle',
        freqStart: 220 * jitter,
        freqEnd: 82,
        duration: 0.095,
        gainPeak: 0.28,
        attack: 0.0012
      });
      // Enhanced resonant forged-steel shield clang partials
      const partials = [490, 742, 1185, 1890, 2740];
      const gains = [0.26, 0.22, 0.17, 0.12, 0.08];
      for (let i = 0; i < partials.length; i++) {
        playTone({
          type: i % 2 === 0 ? 'triangle' : 'sine',
          freqStart: partials[i] * jitter,
          freqEnd: partials[i] * jitter * 0.965,
          duration: 0.29 - i * 0.032,
          gainPeak: gains[i],
          attack: 0.0012
        });
      }
      playFilteredNoise({
        brown: false,
        filterType: 'bandpass',
        freqStart: 3600 * jitter,
        freqEnd: 1450,
        q: 1.9,
        duration: 0.07,
        gainPeak: 0.22,
        attack: 0.001
      });
    },

    // =========================================================================
    // Abandoned Knight Rift — Routed 44.1 kHz Studio Souls Audio API
    // =========================================================================

    updateSoulsSpatial(listenerX = 0, listenerZ = 0, listenerYaw = 0, isInSouls = false, bossAwakened = false, dt = 0.016) {
      if (!isInSouls) {
        try { soulsSpatial.update?.(listenerX, listenerZ, listenerYaw, false, false, dt); } catch {}
        return;
      }
      if (muted || suspendedBySystem || !ctx || !unlocked) return;
      try {
        soulsSpatial.attachContext?.(ctx, masterGain || sfxGain || compressor);
        soulsSpatial.update?.(listenerX, listenerZ, listenerYaw, true, Boolean(bossAwakened), dt);
      } catch {}
    },

    playCinematicBossDoorSequence(opts = {}) {
      if (!readyToPlay()) return false;
      preloadSoulsAudio(ctx);
      try {
        soulsSpatial.attachContext?.(ctx, masterGain || sfxGain || compressor);
        soulsMusic.duck(-2.8, 0.25, 1.2);
        return Boolean(soulsSpatial.playCinematicBossDoorSequence?.(opts));
      } catch {
        return false;
      }
    },

    stopCinematicBossDoorSequence(fadeSec = 0.08) {
      try {
        return Boolean(soulsSpatial.stopCinematicSequence?.(fadeSec));
      } catch {
        return false;
      }
    },

    playBossIntroVoiceLine(cueIndex, opts = {}) {
      if (!readyToPlay()) return false;
      preloadSoulsAudio(ctx);
      try {
        soulsSpatial.attachContext?.(ctx, masterGain || sfxGain || compressor);
        return Boolean(soulsSpatial?.playBossIntroVoiceLine?.(cueIndex, opts));
      } catch {
        return false;
      }
    },

    playBossArmorShift(intensity = 1.0) {
      if (!readyToPlay()) return false;
      preloadSoulsAudio(ctx);
      try {
        soulsSpatial.attachContext?.(ctx, masterGain || sfxGain || compressor);
        return Boolean(soulsSpatial?.playBossArmorShift?.(intensity));
      } catch {
        return false;
      }
    },

    stopBossIntroVoice(fadeSec = 0.08) {
      try {
        return Boolean(soulsSpatial?.stopBossIntroVoice?.(fadeSec));
      } catch {
        return false;
      }
    },

    playHeroRoll(heavy = false) {
      if (!readyToPlay()) return;
      preloadSoulsAudio(ctx);
      const isHeavy = typeof heavy === 'object' && heavy !== null ? Boolean(heavy.heavy) : Boolean(heavy);
      if (typeof soulsHero.playHeroRoll === 'function') {
        soulsHero.playHeroRoll({ heavy: isHeavy });
        return;
      }
      soulsEnv.playRollStone({ surface: 'stone_courtyard' });
    },

    playRollStone(optsOrHeavy = {}) {
      if (!readyToPlay()) return;
      preloadSoulsAudio(ctx);
      const isHeavy = typeof optsOrHeavy === 'boolean'
        ? optsOrHeavy
        : Boolean(optsOrHeavy && optsOrHeavy.heavy);
      if (typeof soulsHero.playHeroRoll === 'function') {
        soulsHero.playHeroRoll({ heavy: isHeavy });
        return;
      }
      soulsEnv.playRollStone(typeof optsOrHeavy === 'object' && optsOrHeavy !== null ? optsOrHeavy : {});
    },

    playTurnScrape(opts = {}) {
      if (!readyToPlay()) return;
      preloadSoulsAudio(ctx);
      soulsEnv.playTurnScrape(opts);
    },

    playFogGate() {
      if (!readyToPlay()) return;
      preloadSoulsAudio(ctx);
      soulsEnv.playFogGate();
    },

    playCastleDoorOpen() {
      if (!readyToPlay()) return;
      preloadSoulsAudio(ctx);
      soulsMusic.duck(-3.8, 0.10, 1.4);
      try {
        soulsSpatial.attachContext?.(ctx, masterGain || sfxGain || compressor);
        if (soulsSpatial.triggerCinematicStage?.('open')) return;
      } catch {}
      soulsEnv.playCastleDoorOpen?.();
    },

    playCastleDoorClose() {
      if (!readyToPlay()) return;
      preloadSoulsAudio(ctx);
      soulsMusic.duck(-3.5, 0.06, 0.9);
      try {
        soulsSpatial.attachContext?.(ctx, masterGain || sfxGain || compressor);
        if (soulsSpatial.triggerCinematicStage?.('close')) return;
      } catch {}
      soulsEnv.playCastleDoorClose?.();
    },

    setSoulsAmbientActive(active, opts = {}) {
      soulsAmbientActive = Boolean(active);
      if (!soulsAmbientActive || muted || suspendedBySystem) {
        soulsEnv.setAmbientActive(false);
        try {
          soulsSpatial.update?.(0, 0, 0, false, false, 0.016);
          if (!soulsAmbientActive) soulsSpatial.stopCinematicSequence?.(0.08);
        } catch {}
        syncSoulsBossMusic();
        return;
      }
      if (!readyToPlay()) {
        soulsEnv.setAmbientActive(false);
        syncSoulsBossMusic();
        return;
      }
      preloadSoulsAudio(ctx);
      soulsEnv.setAmbientActive(true, opts);
      syncSoulsBossMusic();
    },

    setAmbientActive(active, opts = {}) {
      this.setSoulsAmbientActive(active, opts);
    },

    preloadSoulsAudio() {
      if (ctx) preloadSoulsAudio(ctx);
    },

    playSwordSwing(comboStep = 1, isHeavy = false) {
      if (!readyToPlay()) return;
      preloadSoulsAudio(ctx);
      soulsHero.playSwordSwing(comboStep, isHeavy);
    },

    playHeavyThrust(charged = false) {
      if (!readyToPlay()) return;
      preloadSoulsAudio(ctx);
      if (typeof soulsHero.playHeavyThrust === 'function') {
        soulsHero.playHeavyThrust(charged);
      } else {
        soulsHero.playSwordSwing(3, true);
      }
    },

    playSwordHit(opts = {}) {
      if (!readyToPlay()) return;
      preloadSoulsAudio(ctx);
      soulsHero.playSwordHit(opts);
    },

    playShieldBlock(opts) {
      if (!readyToPlay()) return;
      if (opts !== undefined || soulsEnv.isAmbientActive?.()) {
        preloadSoulsAudio(ctx);
        soulsHero.playShieldBlock(opts && typeof opts === 'object' ? opts : {});
        return;
      }
      this.playBlock();
    },

    playParrySuccess() {
      if (!readyToPlay()) return;
      preloadSoulsAudio(ctx);
      soulsMusic.duck(-4.5, 0.35, 0.55);
      soulsHero.playParrySuccess();
    },

    playPartialParry() {
      if (!readyToPlay()) return;
      preloadSoulsAudio(ctx);
      soulsHero.playPartialParry();
    },

    playGuardCounterCue() {
      if (!readyToPlay()) return;
      preloadSoulsAudio(ctx);
      soulsHero.playGuardCounterCue();
    },

    playGuardBreak() {
      if (!readyToPlay()) return;
      preloadSoulsAudio(ctx);
      soulsHero.playGuardBreak();
    },

    playRiposteImpact() {
      if (!readyToPlay()) return;
      preloadSoulsAudio(ctx);
      soulsHero.playRiposteImpact();
    },

    playFlaskDrink() {
      if (!readyToPlay()) return;
      preloadSoulsAudio(ctx);
      soulsHero.playFlaskDrink();
    },

    playBossFootstep(distNorm = 0) {
      if (!readyToPlay()) return;
      preloadSoulsAudio(ctx);
      soulsEnemy.playBossFootstep(distNorm);
    },

    playBossLeap() {
      if (!readyToPlay()) return;
      preloadSoulsAudio(ctx);
      soulsEnemy.playBossLeap?.();
    },

    playBossHammerWhoosh(heavy = false) {
      if (!readyToPlay()) return;
      preloadSoulsAudio(ctx);
      soulsEnemy.playBossHammerWhoosh(heavy);
    },

    playBossHammerGround(intensity = 1.0) {
      if (!readyToPlay()) return;
      preloadSoulsAudio(ctx);
      if (typeof soulsEnemy.playBossHammerGround === 'function') {
        soulsEnemy.playBossHammerGround(intensity);
      } else {
        soulsEnemy.playBossHammerSlam(intensity);
      }
    },

    playBossHammerHit(intensity = 1.0) {
      if (!readyToPlay()) return;
      preloadSoulsAudio(ctx);
      if (typeof soulsEnemy.playBossHammerHit === 'function') {
        soulsEnemy.playBossHammerHit(intensity);
      } else {
        soulsEnemy.playBossHammerSlam(intensity);
      }
    },

    playBossHammerSlam(intensity = 1.0) {
      if (!readyToPlay()) return;
      preloadSoulsAudio(ctx);
      soulsEnemy.playBossHammerSlam(intensity);
    },

    playBossRoar() {
      if (!readyToPlay()) return;
      preloadSoulsAudio(ctx);
      soulsEnemy.playBossRoar();
    },

    playStanceBreak() {
      if (!readyToPlay()) return;
      preloadSoulsAudio(ctx);
      soulsEnemy.playStanceBreak();
    },

    playBossRecoil() {
      if (!readyToPlay()) return;
      preloadSoulsAudio(ctx);
      soulsEnemy.playBossRecoil();
    },

    playMobKnightSwing(heavy = false) {
      if (!readyToPlay()) return;
      preloadSoulsAudio(ctx);
      soulsEnemy.playMobKnightSwing(heavy);
    },

    playMobHeavyWhoosh() {
      if (!readyToPlay()) return;
      preloadSoulsAudio(ctx);
      soulsEnemy.playMobHeavyWhoosh?.();
    },

    playMobBowDraw() {
      if (!readyToPlay()) return;
      preloadSoulsAudio(ctx);
      soulsEnemy.playMobBowDraw();
    },

    playMobArrowWhoosh() {
      if (!readyToPlay()) return;
      preloadSoulsAudio(ctx);
      soulsEnemy.playMobArrowWhoosh();
    },

    playMobDeath(enemyType = 'default', distNorm = 0) {
      if (!readyToPlay()) return;
      preloadSoulsAudio(ctx);
      soulsEnemy.playMobDeath?.(enemyType, distNorm);
    },

    playMobFootstep(enemyType = 'default', distNorm = 0) {
      if (!readyToPlay()) return;
      preloadSoulsAudio(ctx);
      soulsEnemy.playMobFootstep?.(enemyType, distNorm);
    },

    playMobAttackGrunt(enemyType = 'default', heavy = false, distNorm = 0) {
      if (!readyToPlay()) return;
      preloadSoulsAudio(ctx);
      soulsEnemy.playMobAttackGrunt?.(enemyType, heavy, distNorm);
    },

    playMobHurt(enemyType = 'default', distNorm = 0) {
      if (!readyToPlay()) return;
      preloadSoulsAudio(ctx);
      soulsEnemy.playMobHurt?.(enemyType, distNorm);
    },

    playMobAggro(enemyType = 'default', distNorm = 0) {
      if (!readyToPlay()) return;
      preloadSoulsAudio(ctx);
      soulsEnemy.playMobAggro?.(enemyType, distNorm);
    },

    playBeastReady() {
      if (!readyToPlay() || !canTrigger('beast_ready', 160)) return;
      // Resonant dark-fantasy golden warhorn + harmonic ready chord
      playTone({
        type: 'triangle',
        freqStart: 220,
        freqEnd: 293.66,
        duration: 0.24,
        gainPeak: 0.20,
        attack: 0.015
      });
      const notes = [440, 587.33, 880];
      notes.forEach((f, idx) => {
        playTone({
          type: 'sine',
          freqStart: f,
          freqEnd: f * 1.01,
          startTime: idx * 0.055,
          duration: 0.34,
          gainPeak: 0.14 - idx * 0.02,
          attack: 0.008
        });
      });
    },

    playExplosion() {
      if (!readyToPlay() || !canTrigger('explosion', 70)) return;
      // Heavy sub-bass blast + thunderous debris rumble
      playTone({
        type: 'sine',
        freqStart: 130,
        freqEnd: 24,
        duration: 0.56,
        gainPeak: 0.58,
        attack: 0.004
      });
      playTone({
        type: 'sawtooth',
        freqStart: 88,
        freqEnd: 28,
        duration: 0.36,
        gainPeak: 0.24,
        attack: 0.005
      });
      playFilteredNoise({
        brown: true,
        filterType: 'lowpass',
        freqStart: 1900,
        freqEnd: 140,
        q: 0.85,
        duration: 0.58,
        gainPeak: 0.50,
        attack: 0.004
      });
      playFilteredNoise({
        brown: false,
        filterType: 'bandpass',
        freqStart: 2400,
        freqEnd: 420,
        q: 1.1,
        startTime: 0.02,
        duration: 0.30,
        gainPeak: 0.22,
        attack: 0.004
      });
    },

    playPickup(type = 'gold') {
      if (!readyToPlay()) return;
      const kind = String(type || 'gold').toLowerCase();

      if (kind === 'soul' || kind === 'xp') {
        if (!canTrigger('pickup_soul', 38)) return;
        const pitch = 520 + Math.random() * 90;
        playTone({
          type: 'sine',
          freqStart: pitch,
          freqEnd: pitch * 1.45,
          duration: 0.12,
          gainPeak: 0.11,
          attack: 0.008
        });
        return;
      }

      if (kind === 'heart' || kind === 'hp' || kind === 'heal') {
        if (!canTrigger('pickup_heart', 60)) return;
        // Restorative pulse + warm major triad
        playTone({ type: 'sine', freqStart: 110, freqEnd: 62, duration: 0.14, gainPeak: 0.28, attack: 0.005 });
        playTone({ type: 'triangle', freqStart: 523.25, freqEnd: 523.25, startTime: 0.03, duration: 0.16, gainPeak: 0.18 });
        playTone({ type: 'triangle', freqStart: 659.25, freqEnd: 659.25, startTime: 0.10, duration: 0.22, gainPeak: 0.20 });
        return;
      }

      if (kind === 'clover' || kind === 'seal' || kind === 'beast_seal' || kind === 'companion' || kind === 'crate') {
        if (!canTrigger('pickup_clover', 60)) return;
        const notes = [587.33, 739.99, 880.0, 1174.66]; // D5 - F#5 - A5 - D6
        notes.forEach((f, idx) => {
          playTone({
            type: 'triangle',
            freqStart: f,
            freqEnd: f * 1.01,
            startTime: idx * 0.045,
            duration: 0.22,
            gainPeak: 0.20,
            attack: 0.004
          });
        });
        return;
      }

      // Default: 'gold' / 'coin' crisp metallic chime with rising pitch on rapid pickup streaks
      if (!canTrigger('pickup_gold', 50)) return;
      const now = performance.now();
      if (now - lastCoinAt <= 950) {
        coinPitchStreak = Math.min(10, coinPitchStreak + 1);
      } else {
        coinPitchStreak = 0;
      }
      lastCoinAt = now;
      const pitchMult = Math.pow(1.059463, coinPitchStreak);
      playTone({
        type: 'sine',
        freqStart: 987.77 * pitchMult, // B5 climbing smoothly per streak step
        freqEnd: 987.77 * pitchMult,
        duration: 0.085,
        gainPeak: 0.15,
        attack: 0.002
      });
      playTone({
        type: 'sine',
        freqStart: 1318.51 * pitchMult, // E6 climbing smoothly per streak step
        freqEnd: 1318.51 * pitchMult,
        startTime: 0.05,
        duration: 0.16,
        gainPeak: 0.17,
        attack: 0.002
      });
    },

    playLevelUp() {
      if (!readyToPlay()) return;
      // Soft, warm mystical harp/chime whisper (gentle sine arpeggio, zero harsh sawtooth or piercing highs)
      const notes = [293.66, 369.99, 440.0, 587.33]; // D4 - F#4 - A4 - D5
      notes.forEach((freq, i) => {
        playTone({
          type: 'sine',
          freqStart: freq,
          freqEnd: freq * 1.002,
          startTime: i * 0.065,
          duration: 0.46 - i * 0.04,
          gainPeak: 0.068,
          attack: 0.032
        });
      });
      // Soft warm sub-cushion
      playTone({
        type: 'sine',
        freqStart: 146.83,
        freqEnd: 146.83,
        startTime: 0,
        duration: 0.52,
        gainPeak: 0.06,
        attack: 0.04
      });
    },

    playWeaponUnlock() {
      if (!readyToPlay()) return;
      // Warm golden chest fanfare (smooth sine/triangle notes at comfortable volume)
      playTone({
        type: 'sine',
        freqStart: 130,
        freqEnd: 52,
        duration: 0.32,
        gainPeak: 0.20,
        attack: 0.01
      });
      const fanfare = [293.66, 369.99, 440.0, 587.33, 659.25, 739.99];
      fanfare.forEach((freq, idx) => {
        const isFinal = idx === fanfare.length - 1;
        playTone({
          type: 'sine',
          freqStart: freq,
          freqEnd: freq,
          startTime: idx * 0.075,
          duration: isFinal ? 0.65 : 0.26,
          gainPeak: isFinal ? 0.11 : 0.085,
          attack: 0.02
        });
      });
    },

    playBeastRoar() {
      if (!readyToPlay()) return;
      const t0 = ctx.currentTime;
      const dur = 0.78;

      // Distorted sub-growl oscillator through WaveShaper
      const osc = ctx.createOscillator();
      const shaper = ctx.createWaveShaper();
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(86, t0);
      osc.frequency.linearRampToValueAtTime(138, t0 + 0.16);
      osc.frequency.exponentialRampToValueAtTime(44, t0 + dur);

      shaper.curve = distortionCurve;
      shaper.oversample = '2x';

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(620, t0);
      filter.frequency.linearRampToValueAtTime(1250, t0 + 0.2);
      filter.frequency.exponentialRampToValueAtTime(240, t0 + dur);
      filter.Q.setValueAtTime(3.2, t0);

      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.40, t0 + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      osc.connect(shaper);
      shaper.connect(filter);
      filter.connect(g);
      g.connect(compressor);

      osc.start(t0);
      osc.stop(t0 + dur + 0.02);

      // Breath roar noise layer
      playFilteredNoise({
        brown: true,
        filterType: 'bandpass',
        freqStart: 420,
        freqEnd: 170,
        q: 1.5,
        duration: 0.72,
        gainPeak: 0.38,
        attack: 0.04
      });
    },

    playBossSpawn() {
      if (!readyToPlay()) return;
      // Ominous gothic church bell toll (two solemn strikes + sub-crypt rumble)
      const baseFreq = 146.83; // D3
      const bellRatios = [0.5, 1.0, 1.183, 1.506, 2.0, 2.514, 3.011];
      const bellGains = [0.28, 0.32, 0.20, 0.16, 0.15, 0.09, 0.07];

      const strikeBell = (offsetSec, scaleGain) => {
        bellRatios.forEach((ratio, idx) => {
          playTone({
            type: 'sine',
            freqStart: baseFreq * ratio,
            freqEnd: baseFreq * ratio * 0.996,
            startTime: offsetSec,
            duration: (2.1 - idx * 0.18) * (offsetSec > 0 ? 0.85 : 1),
            gainPeak: bellGains[idx] * scaleGain,
            attack: 0.004
          });
        });
        // Clapper metallic strike
        playFilteredNoise({
          brown: false,
          filterType: 'bandpass',
          freqStart: 1950,
          freqEnd: 620,
          q: 2.4,
          startTime: offsetSec,
          duration: 0.09,
          gainPeak: 0.16 * scaleGain,
          attack: 0.002
        });
      };

      strikeBell(0, 1.0);
      strikeBell(1.05, 0.68);
    },

    setMusicMode(mode = 'hub') {
      const next = mode === 'combat' || mode === 'boss' || mode === 'off' ? mode : 'hub';
      if (next === musicMode) {
        if (next === 'hub' || next === 'off') {
          soulsAmbientActive = false;
          soulsEnv.setAmbientActive(false);
          try {
            soulsSpatial.update?.(0, 0, 0, false, false, 0.016);
            soulsSpatial.stopCinematicSequence?.(0.08);
          } catch {}
        }
        syncSoulsBossMusic();
        return;
      }
      musicMode = next;
      musicStep = 0;
      if (ctx) {
        preloadExternalSamples(ctx);
        nextNoteTime = ctx.currentTime + 0.05;
      }
      syncGain();
      if (next === 'hub' || next === 'off') {
        soulsAmbientActive = false;
        soulsEnv.setAmbientActive(false);
        try {
          soulsSpatial.update?.(0, 0, 0, false, false, 0.016);
          soulsSpatial.stopCinematicSequence?.(0.08);
        } catch {}
      }
      syncSoulsBossMusic();
      if (next !== 'off' && !isSoulsMusicActive()) startMusicLoop();
      else stopMusicLoop();
    },

    stopMusic() {
      stopMusicLoop();
      soulsAmbientActive = false;
      soulsEnv.setAmbientActive(false);
      try {
        soulsSpatial.update?.(0, 0, 0, false, false, 0.016);
        soulsSpatial.stopCinematicSequence?.(0.08);
      } catch {}
      soulsMusic.stop(0.5);
    },

    playMapOpenSfx() {
      if (!readyToPlay()) return;
      preloadExternalSamples(ctx);
      playSampleBuffer('map_open', 0.48, 1.0);
    },

    playPortalEnterSfx() {
      if (!readyToPlay()) return;
      preloadExternalSamples(ctx);
      playSampleBuffer('portal_enter', 0.54, 1.0);
    },

    getMusicMode() {
      return musicMode;
    },

    setMusicVolume(val) {
      const num = Number(val);
      if (Number.isFinite(num)) {
        musicVolume = Math.max(0, Math.min(1, num));
        try {
          localStorage.setItem('grimborne_music_volume', String(musicVolume));
        } catch {}
        syncGain();
        soulsMusic.setVolume(Math.max(0, Math.min(1, musicVolume * 0.82)));
        syncSoulsBossMusic();
        if (musicVolume > 0.001) startMusicLoop();
        else stopMusicLoop();
      }
      return musicVolume;
    },

    getMusicVolume() {
      return musicVolume;
    },

    setSfxVolume(val) {
      const num = Number(val);
      if (Number.isFinite(num)) {
        sfxVolume = Math.max(0, Math.min(1, num));
        userVolume = sfxVolume;
        if (sfxVolume > 0 && muted) {
          muted = false;
          soulsMusic.setMuted(false);
          soulsSpatial.setMuted(false);
        }
        soulsSpatial.setVolume(Math.max(0, Math.min(1, sfxVolume * 0.92)));
        try {
          localStorage.setItem('grimborne_sfx_volume', String(sfxVolume));
          localStorage.setItem('grimborne_volume', String(sfxVolume));
          localStorage.setItem('grimborne_muted', muted ? '1' : '0');
        } catch {}
        syncGain();
      }
      return sfxVolume;
    },

    getSfxVolume() {
      return sfxVolume;
    },

    setVolume(val) {
      const num = Number(val);
      if (Number.isFinite(num)) {
        userVolume = Math.max(0, Math.min(1, num));
        sfxVolume = userVolume;
        if (userVolume > 0 && muted) {
          muted = false;
          soulsMusic.setMuted(false);
          soulsSpatial.setMuted(false);
        }
        soulsSpatial.setVolume(Math.max(0, Math.min(1, sfxVolume * 0.92)));
        try {
          localStorage.setItem('grimborne_volume', String(userVolume));
          localStorage.setItem('grimborne_sfx_volume', String(sfxVolume));
          localStorage.setItem('grimborne_muted', muted ? '1' : '0');
        } catch {}
        syncGain();
      }
      return userVolume;
    },

    getVolume() {
      return sfxVolume;
    },

    setMuted(bool) {
      muted = Boolean(bool);
      try {
        localStorage.setItem('grimborne_muted', muted ? '1' : '0');
      } catch {}
      syncGain();
      soulsMusic.setMuted(muted);
      soulsSpatial.setMuted(muted);
      if (muted) {
        stopMusicLoop();
        soulsEnv.setAmbientActive(false);
      } else {
        syncSoulsBossMusic();
        startMusicLoop();
      }
      return muted;
    },

    toggleMute() {
      muted = !muted;
      try {
        localStorage.setItem('grimborne_muted', muted ? '1' : '0');
      } catch {}
      syncGain();
      soulsMusic.setMuted(muted);
      soulsSpatial.setMuted(muted);
      if (muted) {
        stopMusicLoop();
        soulsEnv.setAmbientActive(false);
      } else {
        syncSoulsBossMusic();
        startMusicLoop();
      }
      return muted;
    },

    isMuted() {
      return muted;
    },

    suspend() {
      suspendedBySystem = true;
      stopMusicLoop();
      soulsEnv.setAmbientActive(false);
      soulsMusic.setSuspended(true);
      try { soulsSpatial.suspend?.(); } catch {}
      syncGain();
      if (ctx && ctx.state === 'running') {
        ctx.suspend().catch(() => {});
      }
    },

    resume() {
      suspendedBySystem = false;
      syncGain();
      soulsMusic.setSuspended(false);
      try { soulsSpatial.resume?.(); } catch {}
      if (ctx && ctx.state === 'suspended' && unlocked) {
        ctx.resume().then(() => {
          syncSoulsBossMusic();
          startMusicLoop();
        }).catch(() => {});
      } else {
        syncSoulsBossMusic();
        startMusicLoop();
      }
    }
  };
}
