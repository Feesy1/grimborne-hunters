// Procedural Web Audio API Dark-Fantasy Synthesizer
// Zero external audio assets — instant startup, crisp dynamics, full suspend/mute compliance.

export function createAudioEngine() {
  let ctx = null;
  let masterGain = null;
  let compressor = null;
  let whiteNoiseBuffer = null;
  let brownNoiseBuffer = null;
  let distortionCurve = null;

  let muted = false;
  let userVolume = 0.5;
  try {
    const savedVol = localStorage.getItem('grimborne_volume');
    if (savedVol !== null && Number.isFinite(Number(savedVol))) {
      userVolume = Math.max(0, Math.min(1, Number(savedVol)));
    }
    const savedMute = localStorage.getItem('grimborne_muted');
    if (savedMute === '1') muted = true;
  } catch {}
  let suspendedBySystem = false;
  let unlocked = false;

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
      masterGain.gain.setValueAtTime(muted || suspendedBySystem ? 0.0001 : Math.max(0.0001, userVolume * 0.72), ctx.currentTime);

      compressor.connect(masterGain);
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
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function syncGain() {
    if (!ctx || !masterGain) return;
    const target = muted || suspendedBySystem ? 0.0001 : Math.max(0.0001, userVolume * 0.72);
    const t = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(t);
    masterGain.gain.setTargetAtTime(target, t, 0.018);
  }

  function unlock() {
    const audio = ensureContext();
    if (!audio) return;
    if (audio.state === 'suspended' && !suspendedBySystem) {
      audio.resume().catch(() => {});
    }
    unlocked = true;
  }

  // Unlock AudioContext on first user gesture
  if (typeof window !== 'undefined') {
    const onFirstGesture = () => {
      unlock();
      if (ctx && ctx.state === 'running') {
        window.removeEventListener('pointerdown', onFirstGesture, true);
        window.removeEventListener('keydown', onFirstGesture, true);
        window.removeEventListener('touchstart', onFirstGesture, true);
      }
    };
    window.addEventListener('pointerdown', onFirstGesture, { capture: true, passive: true });
    window.addEventListener('keydown', onFirstGesture, { capture: true, passive: true });
    window.addEventListener('touchstart', onFirstGesture, { capture: true, passive: true });
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

    playMeleeSwing(heavy = false) {
      if (!readyToPlay() || !canTrigger('melee', 45)) return;
      const isHeavy = Boolean(heavy && heavy !== 'club');
      const jitter = 0.94 + Math.random() * 0.12;

      // Air blade whoosh
      playFilteredNoise({
        brown: false,
        filterType: 'bandpass',
        freqStart: (isHeavy ? 680 : 960) * jitter,
        freqEnd: (isHeavy ? 150 : 230) * jitter,
        q: isHeavy ? 1.8 : 1.4,
        duration: isHeavy ? 0.24 : 0.16,
        gainPeak: isHeavy ? 0.34 : 0.26,
        attack: 0.014
      });

      // Meaty low impact thud
      playTone({
        type: 'triangle',
        freqStart: (isHeavy ? 148 : 185) * jitter,
        freqEnd: isHeavy ? 36 : 48,
        startTime: 0.025,
        duration: isHeavy ? 0.21 : 0.14,
        gainPeak: isHeavy ? 0.42 : 0.30,
        attack: 0.005
      });

      if (isHeavy) {
        // Subtle iron cleave ring for Cleaver / Maul
        playTone({
          type: 'sawtooth',
          freqStart: 310 * jitter,
          freqEnd: 110,
          startTime: 0.03,
          duration: 0.16,
          gainPeak: 0.12,
          attack: 0.004
        });
      }
    },

    playGunshot(weaponId = 'pistol') {
      const minGap = weaponId === 'gatling' ? 35 : 48;
      if (!readyToPlay() || !canTrigger('gun', minGap)) return;
      const jitter = 0.95 + Math.random() * 0.10;

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

      // Default / 'pistol' («Охотничье ружьё»): heavy chest-thumping pump shotgun + two-click pump rack!
      playTone({
        type: 'sine',
        freqStart: 135 * jitter,
        freqEnd: 28,
        duration: 0.26,
        gainPeak: 0.52,
        attack: 0.002
      });
      playDistortedThump({
        type: 'triangle',
        freqStart: 124 * jitter,
        freqEnd: 28,
        duration: 0.20,
        gainPeak: 0.35,
        attack: 0.002,
        filterFreq: 500
      });
      playFilteredNoise({
        brown: true,
        filterType: 'lowpass',
        freqStart: 2150,
        freqEnd: 220,
        q: 0.95,
        duration: 0.25,
        gainPeak: 0.45,
        attack: 0.002
      });
      playFilteredNoise({
        brown: false,
        filterType: 'bandpass',
        freqStart: 3500 * jitter,
        freqEnd: 740,
        q: 1.15,
        duration: 0.115,
        gainPeak: 0.29,
        attack: 0.0015
      });
      playTone({
        type: 'square',
        freqStart: 1700 * jitter,
        freqEnd: 560,
        duration: 0.022,
        gainPeak: 0.09,
        attack: 0.001
      });

      // Crisp two-click mechanical pump-action rack (chk-chk at +0.22s and +0.31s)
      playFilteredNoise({
        brown: false,
        filterType: 'bandpass',
        freqStart: 2450 * jitter,
        freqEnd: 1350 * jitter,
        q: 2.6,
        startTime: 0.22,
        duration: 0.055,
        gainPeak: 0.15,
        attack: 0.003
      });
      playTone({
        type: 'triangle',
        freqStart: 1480 * jitter,
        freqEnd: 780,
        startTime: 0.22,
        duration: 0.032,
        gainPeak: 0.11,
        attack: 0.0015
      });

      playFilteredNoise({
        brown: false,
        filterType: 'bandpass',
        freqStart: 1650 * jitter,
        freqEnd: 2900 * jitter,
        q: 2.8,
        startTime: 0.31,
        duration: 0.058,
        gainPeak: 0.17,
        attack: 0.003
      });
      playTone({
        type: 'triangle',
        freqStart: 1940 * jitter,
        freqEnd: 1080,
        startTime: 0.31,
        duration: 0.036,
        gainPeak: 0.13,
        attack: 0.0015
      });
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
        // 💧 WATER: Flowing liquid wave splash + bubbling water droplets!
        playFilteredNoise({
          brown: false,
          filterType: 'bandpass',
          freqStart: 320 * jitter,
          freqEnd: 1580 * jitter,
          q: 3.4,
          duration: 0.25,
          gainPeak: 0.42,
          attack: 0.016
        });
        playFilteredNoise({
          brown: true,
          filterType: 'lowpass',
          freqStart: 880 * jitter,
          freqEnd: 290,
          q: 2.2,
          startTime: 0.03,
          duration: 0.22,
          gainPeak: 0.28,
          attack: 0.012
        });
        // Two crisp water-bubble pops
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

    playHit() {
      if (!readyToPlay() || !canTrigger('hit', 30)) return;
      const jitter = 0.9 + Math.random() * 0.2;
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
      const jitter = 0.96 + Math.random() * 0.08;
      // Inharmonic forged-steel shield clang partials
      const partials = [560, 845, 1315, 2040];
      const gains = [0.22, 0.18, 0.14, 0.09];
      for (let i = 0; i < partials.length; i++) {
        playTone({
          type: i % 2 === 0 ? 'triangle' : 'sine',
          freqStart: partials[i] * jitter,
          freqEnd: partials[i] * jitter * 0.97,
          duration: 0.24 - i * 0.03,
          gainPeak: gains[i],
          attack: 0.0015
        });
      }
      playFilteredNoise({
        brown: false,
        filterType: 'highpass',
        freqStart: 3200,
        freqEnd: 1800,
        q: 2.0,
        duration: 0.05,
        gainPeak: 0.16,
        attack: 0.001
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

      // Default: 'gold' / 'coin' crisp metallic chime
      if (!canTrigger('pickup_gold', 35)) return;
      playTone({
        type: 'sine',
        freqStart: 987.77, // B5
        freqEnd: 987.77,
        duration: 0.09,
        gainPeak: 0.18,
        attack: 0.002
      });
      playTone({
        type: 'sine',
        freqStart: 1318.51, // E6
        freqEnd: 1318.51,
        startTime: 0.055,
        duration: 0.18,
        gainPeak: 0.20,
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

    setVolume(val) {
      const num = Number(val);
      if (Number.isFinite(num)) {
        userVolume = Math.max(0, Math.min(1, num));
        if (userVolume > 0 && muted) {
          muted = false;
        }
        try {
          localStorage.setItem('grimborne_volume', String(userVolume));
          localStorage.setItem('grimborne_muted', muted ? '1' : '0');
        } catch {}
        syncGain();
      }
      return userVolume;
    },

    getVolume() {
      return userVolume;
    },

    setMuted(bool) {
      muted = Boolean(bool);
      try {
        localStorage.setItem('grimborne_muted', muted ? '1' : '0');
      } catch {}
      syncGain();
      return muted;
    },

    toggleMute() {
      muted = !muted;
      try {
        localStorage.setItem('grimborne_muted', muted ? '1' : '0');
      } catch {}
      syncGain();
      return muted;
    },

    isMuted() {
      return muted;
    },

    suspend() {
      suspendedBySystem = true;
      syncGain();
      if (ctx && ctx.state === 'running') {
        ctx.suspend().catch(() => {});
      }
    },

    resume() {
      suspendedBySystem = false;
      syncGain();
      if (ctx && ctx.state === 'suspended' && unlocked) {
        ctx.resume().catch(() => {});
      }
    }
  };
}
