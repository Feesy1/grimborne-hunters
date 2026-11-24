// Abandoned Knight Rift — Hero Combat Audio Module
// Studio 44.1 kHz / 48 kHz WAV sample playback (?v=20261124z99) with cinematic gain (0.80–1.0),
// razor-crisp sample-accurate attack, ±4% micro-pitch jitter, stone early-reflection send,
// ElevenLabs parry steel ring support, armored roll slot, and Web Audio fallbacks.

export const SOULS_HERO_AUDIO_VERSION = '20261124z99';
const SAMPLE_VER = SOULS_HERO_AUDIO_VERSION;

export const HERO_SAMPLE_MANIFEST = Object.freeze([
  ['boss_flesh_slash', `./assets/audio/souls_boss_flesh_slash.wav?v=${SAMPLE_VER}`],
  ['hit_unarmored', `./assets/audio/souls_hit_unarmored.wav?v=${SAMPLE_VER}`],
  ['hit_armor_1', `./assets/audio/souls_hero_hit_armor_1.wav?v=${SAMPLE_VER}`],
  ['hit_armor_2', `./assets/audio/souls_hero_hit_armor_2.wav?v=${SAMPLE_VER}`],
  ['shield_block_mob', `./assets/audio/souls_shield_block_mob.wav?v=${SAMPLE_VER}`],
  ['shield_block_boss', `./assets/audio/souls_shield_block_boss.wav?v=${SAMPLE_VER}`],
  ['boss_hit_hero_armor', `./assets/audio/souls_boss_hit_hero_armor.wav?v=${SAMPLE_VER}`],
  ['swing_1', `./assets/audio/souls_hero_swing_1.wav?v=${SAMPLE_VER}`],
  ['swing_2', `./assets/audio/souls_hero_swing_2.wav?v=${SAMPLE_VER}`],
  ['swing_3', `./assets/audio/souls_hero_swing_3.wav?v=${SAMPLE_VER}`],
  ['swing_heavy', `./assets/audio/souls_hero_swing_heavy.wav?v=${SAMPLE_VER}`],
  ['hit_flesh_1', `./assets/audio/souls_hero_hit_flesh_1.wav?v=${SAMPLE_VER}`],
  ['hit_flesh_2', `./assets/audio/souls_hero_hit_flesh_2.wav?v=${SAMPLE_VER}`],
  ['block_1', `./assets/audio/souls_hero_block_1.wav?v=${SAMPLE_VER}`],
  ['block_2', `./assets/audio/souls_hero_block_2.wav?v=${SAMPLE_VER}`],
  ['parry', `./assets/audio/souls_hero_parry.wav?v=${SAMPLE_VER}`],
  ['parry_steel_ring', `./assets/audio/souls_parry_steel_ring.wav?v=${SAMPLE_VER}`],
  ['partial_parry', `./assets/audio/souls_hero_partial_parry.wav?v=${SAMPLE_VER}`],
  ['guard_counter', `./assets/audio/souls_hero_guard_counter.wav?v=${SAMPLE_VER}`],
  ['guard_break', `./assets/audio/souls_hero_guard_break.wav?v=${SAMPLE_VER}`],
  ['riposte', `./assets/audio/souls_hero_riposte.wav?v=${SAMPLE_VER}`],
  ['flask', `./assets/audio/souls_hero_flask.wav?v=${SAMPLE_VER}`],
  ['roll', `./assets/audio/souls_hero_roll.wav?v=${SAMPLE_VER}`],
  ['roll_stone_1', `./assets/audio/souls_env_roll_stone_1.wav?v=${SAMPLE_VER}`],
  ['roll_stone_2', `./assets/audio/souls_env_roll_stone_2.wav?v=${SAMPLE_VER}`]
]);

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

export function createSoulsHeroAudio({
  getCtx = () => null,
  getSfxDest = () => null,
  getStoneReverbDest = () => null
} = {}) {
  const sampleBuffers = new Map();
  const pendingLoads = new Map();
  const missingKeys = new Set();
  const lastVariantIdx = Object.create(null);
  const lastTriggerAt = Object.create(null);
  let fallbackNoiseBuf = null;
  let fallbackNoiseCtx = null;

  function jitterRate(base = 1.0, spread = 0.04) {
    const delta = (Math.random() * 2 - 1) * spread;
    return Math.max(0.5, Math.min(2.0, base * (1 + delta)));
  }

  function pickVariant(groupKey, keys) {
    if (keys.length <= 1) return keys[0];
    const prev = lastVariantIdx[groupKey];
    let idx = Math.floor(Math.random() * keys.length);
    if (idx === prev) {
      idx = (idx + 1) % keys.length;
    }
    lastVariantIdx[groupKey] = idx;
    return keys[idx];
  }

  function canTrigger(tag, minIntervalMs) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const prev = lastTriggerAt[tag];
    if (prev !== undefined && now - prev < minIntervalMs) return false;
    lastTriggerAt[tag] = now;
    return true;
  }

  function resolveAudioEnv() {
    const ctx = typeof getCtx === 'function' ? getCtx() : null;
    if (!ctx || ctx.state === 'closed') return null;
    const sfxDest = typeof getSfxDest === 'function' ? getSfxDest() : null;
    const dest = sfxDest || ctx.destination;
    if (!dest) return null;
    const reverbDest = typeof getStoneReverbDest === 'function' ? getStoneReverbDest() : null;
    return { ctx, dest, reverbDest };
  }

  let preloadPromise = null;
  function preload(audioCtx) {
    if (preloadPromise) return preloadPromise;
    const ctx = audioCtx || (typeof getCtx === 'function' ? getCtx() : null);
    if (!ctx || typeof fetch === 'undefined') return Promise.resolve([]);

    // Staggered decode (2 concurrent) so first click / chapter entry never stalls main thread!
    let nextIdx = 0;
    const loadOne = (key, url) => {
      if (sampleBuffers.has(key) || missingKeys.has(key)) return Promise.resolve(null);
      if (pendingLoads.has(key)) return pendingLoads.get(key);
      const p = fetch(url)
        .then((res) => {
          if (res.status === 404) {
            missingKeys.add(key);
            return Promise.reject(new Error('HTTP 404'));
          }
          return res.ok ? res.arrayBuffer() : Promise.reject(new Error(`HTTP ${res.status}`));
        })
        .then((ab) => decodeAudioBuffer(ctx, ab))
        .then((buf) => {
          sampleBuffers.set(key, buf);
          pendingLoads.delete(key);
          return buf;
        })
        .catch(() => {
          pendingLoads.delete(key);
          return null;
        });
      pendingLoads.set(key, p);
      return p;
    };
    const worker = async () => {
      while (nextIdx < HERO_SAMPLE_MANIFEST.length) {
        const [key, url] = HERO_SAMPLE_MANIFEST[nextIdx++];
        await loadOne(key, url);
      }
    };
    preloadPromise = Promise.all([worker(), worker()]).then(() => []);
    return preloadPromise;
  }

  function playSample(key, {
    gain = 0.86,
    rate = 1.0,
    reverbSend = 0.20,
    lowShelfDb = 0,
    highShelfDb = 0,
    offsetSec = 0
  } = {}) {
    const env = resolveAudioEnv();
    if (!env) return false;
    const { ctx, dest, reverbDest } = env;

    const buf = sampleBuffers.get(key);
    if (!buf) {
      if (!missingKeys.has(key)) preload(ctx);
      return false;
    }

    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.setValueAtTime(Math.max(0.5, Math.min(2.0, rate)), t0);

    const nodes = [src];
    let tail = src;

    if (lowShelfDb !== 0) {
      const ls = ctx.createBiquadFilter();
      ls.type = 'lowshelf';
      ls.frequency.setValueAtTime(160, t0);
      ls.gain.setValueAtTime(lowShelfDb, t0);
      tail.connect(ls);
      tail = ls;
      nodes.push(ls);
    }

    if (highShelfDb !== 0) {
      const hs = ctx.createBiquadFilter();
      hs.type = 'highshelf';
      hs.frequency.setValueAtTime(2400, t0);
      hs.gain.setValueAtTime(highShelfDb, t0);
      tail.connect(hs);
      tail = hs;
      nodes.push(hs);
    }

    // Crisp sample-accurate instant attack at full cinematic gain (0.80–1.0)
    const clampedGain = Math.max(0.001, Math.min(1.0, gain));
    const dryGain = ctx.createGain();
    dryGain.gain.setValueAtTime(clampedGain, t0);
    tail.connect(dryGain);
    dryGain.connect(dest);
    nodes.push(dryGain);

    if (reverbDest && reverbSend > 0.001) {
      const wetGain = ctx.createGain();
      wetGain.gain.setValueAtTime(Math.min(0.45, clampedGain * reverbSend), t0);
      tail.connect(wetGain);
      wetGain.connect(reverbDest);
      nodes.push(wetGain);
    }

    src.onended = () => {
      for (let i = 0; i < nodes.length; i++) {
        try { nodes[i].disconnect(); } catch {}
      }
    };
    const safeOffset = offsetSec > 0 && buf.duration > offsetSec + 0.02 ? offsetSec : 0;
    src.start(t0, safeOffset);
    return true;
  }

  // -------------------------------------------------------------------------
  // Lightweight Web Audio Fallback Primitives (used only while WAVs load)
  // -------------------------------------------------------------------------

  function getNoiseBuffer(ctx) {
    if (fallbackNoiseBuf && fallbackNoiseCtx === ctx) return fallbackNoiseBuf;
    const length = Math.floor(ctx.sampleRate * 0.65);
    const buf = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    fallbackNoiseBuf = buf;
    fallbackNoiseCtx = ctx;
    return buf;
  }

  function connectOut(ctx, node, dest, reverbDest, reverbSend) {
    node.connect(dest);
    if (reverbDest && reverbSend > 0.001) {
      const send = ctx.createGain();
      send.gain.setValueAtTime(Math.min(0.42, reverbSend), ctx.currentTime);
      node.connect(send);
      send.connect(reverbDest);
      return send;
    }
    return null;
  }

  function fbTone(env, {
    type = 'sine',
    f0 = 220,
    f1 = 110,
    dur = 0.16,
    gain = 0.24,
    attack = 0.002,
    delay = 0,
    reverbSend = 0.16
  }) {
    const { ctx, dest, reverbDest } = env;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(25, f0), t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(25, f1), t0 + Math.max(0.015, dur));

    const g = ctx.createGain();
    const attSec = Math.max(0.001, attack);
    const endT = t0 + Math.max(dur, attSec + 0.01);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(Math.min(0.55, gain), t0 + attSec);
    g.gain.exponentialRampToValueAtTime(0.0001, endT);

    osc.connect(g);
    const send = connectOut(ctx, g, dest, reverbDest, reverbSend);
    osc.onended = () => {
      try { osc.disconnect(); } catch {}
      try { g.disconnect(); } catch {}
      if (send) { try { send.disconnect(); } catch {} }
    };
    osc.start(t0);
    osc.stop(endT + 0.02);
  }

  function fbNoise(env, {
    filterType = 'bandpass',
    f0 = 1400,
    f1 = 500,
    q = 2.0,
    dur = 0.16,
    gain = 0.26,
    attack = 0.003,
    delay = 0,
    reverbSend = 0.14
  }) {
    const { ctx, dest, reverbDest } = env;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = getNoiseBuffer(ctx);

    const flt = ctx.createBiquadFilter();
    flt.type = filterType;
    flt.Q.setValueAtTime(q, t0);
    flt.frequency.setValueAtTime(Math.max(60, f0), t0);
    flt.frequency.exponentialRampToValueAtTime(Math.max(60, f1), t0 + Math.max(0.02, dur));

    const g = ctx.createGain();
    const attSec = Math.max(0.001, attack);
    const endT = t0 + Math.max(dur, attSec + 0.01);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(Math.min(0.55, gain), t0 + attSec);
    g.gain.exponentialRampToValueAtTime(0.0001, endT);

    src.connect(flt);
    flt.connect(g);
    const send = connectOut(ctx, g, dest, reverbDest, reverbSend);
    src.onended = () => {
      try { src.disconnect(); } catch {}
      try { flt.disconnect(); } catch {}
      try { g.disconnect(); } catch {}
      if (send) { try { send.disconnect(); } catch {} }
    };
    src.start(t0);
    src.stop(endT + 0.02);
  }

  // -------------------------------------------------------------------------
  // Public Hero Combat Audio API (Cinematic Gain 0.80–1.0 + Crisp Attack)
  // -------------------------------------------------------------------------

  function playSwordSwing(comboStep = 1, isHeavy = false) {
    if (!canTrigger('hero_swing', 35)) return;
    const step = ((Math.max(1, Math.round(Number(comboStep) || 1)) - 1) % 3) + 1;
    const key = isHeavy ? 'swing_heavy' : `swing_${step}`;
    const rate = jitterRate(1.0, 0.04);

    // Soft, clean aerodynamic air-cutting whoosh (gain ~0.36..0.48, ZERO metal clang or thud)
    if (playSample(key, {
      gain: isHeavy ? 0.46 : step === 3 ? 0.40 : 0.36,
      rate,
      reverbSend: isHeavy ? 0.14 : 0.10,
      lowShelfDb: 0,
      highShelfDb: -1.5
    })) {
      return;
    }

    const env = resolveAudioEnv();
    if (!env) return;
    if (isHeavy) {
      fbNoise(env, { f0: 190 * rate, f1: 620 * rate, q: 1.15, dur: 0.16, gain: 0.20, attack: 0.036, reverbSend: 0.12 });
      fbNoise(env, { f0: 620 * rate, f1: 180 * rate, q: 1.05, dur: 0.24, gain: 0.18, attack: 0.018, delay: 0.09, reverbSend: 0.12 });
    } else {
      const pitchMul = step === 2 ? 1.10 : step === 3 ? 0.90 : 1.0;
      fbNoise(env, { f0: 280 * pitchMul * rate, f1: 860 * pitchMul * rate, q: 1.25, dur: 0.10, gain: 0.16, attack: 0.020, reverbSend: 0.10 });
      fbNoise(env, { f0: 860 * pitchMul * rate, f1: 260 * pitchMul * rate, q: 1.15, dur: 0.15, gain: 0.14, attack: 0.012, delay: 0.06, reverbSend: 0.10 });
    }
  }

  function playHeavyThrust() {
    playSwordSwing(3, true);
  }

  function playSwordHit({ targetKind = null, armored = false, isHeavy = false, isCounter = false } = {}) {
    if (!canTrigger('hero_hit', 22)) return;
    const resolvedKind = targetKind || (armored ? 'armored_knight' : 'unarmored');

    if (resolvedKind === 'boss_flesh') {
      // Mastered loud, visceral wet blade-slicing-flesh-and-cloth impact on Boss (ZERO metal clang, un-muffled 0.95..1.03x!)
      const rate = (isHeavy ? 0.95 : 0.97) + Math.random() * 0.06;
      const sampleOpts = {
        gain: 1.0,
        rate,
        reverbSend: isHeavy ? 0.24 : 0.20,
        lowShelfDb: isHeavy ? 2.8 : 1.8,
        highShelfDb: isCounter ? 2.8 : 2.4
      };
      if (playSample('boss_flesh_slash', sampleOpts) || playSample('hit_unarmored', sampleOpts)) {
        return;
      }
      const env = resolveAudioEnv();
      if (!env) return;
      fbTone(env, { type: 'sine', f0: 158 * rate, f1: 44 * rate, dur: 0.14, gain: 0.42, attack: 0.001, reverbSend: 0.20 });
      fbNoise(env, { f0: 2750 * rate, f1: 620 * rate, q: 1.35, dur: 0.16, gain: 0.44, attack: 0.001, reverbSend: 0.20 });
      return;
    }

    if (resolvedKind === 'armored_knight') {
      // Crisp ringing metallic armor hit — strictly for armored swordsman/spearman bodies (rate ~0.94..1.00)
      const key = pickVariant('hit_armor', ['hit_armor_1', 'hit_armor_2']);
      const rate = isCounter
        ? 1.00 + Math.random() * 0.03
        : (isHeavy ? 0.94 : 0.96) + Math.random() * 0.04;
      const gain = Math.min(0.98, 0.92 + (isHeavy ? 0.04 : 0) + (isCounter ? 0.02 : 0));

      if (playSample(key, {
        gain,
        rate,
        reverbSend: 0.28,
        lowShelfDb: isHeavy ? 2.2 : 0.8,
        highShelfDb: isCounter ? 2.8 : 2.0
      })) {
        return;
      }

      const env = resolveAudioEnv();
      if (!env) return;
      fbNoise(env, { filterType: 'highpass', f0: 2900 * rate, f1: 1850 * rate, q: 1.4, dur: 0.042, gain: 0.30, attack: 0.001, reverbSend: 0.24 });
      fbTone(env, { type: 'triangle', f0: 610 * rate, f1: 580 * rate, dur: 0.18, gain: 0.26, attack: 0.001, reverbSend: 0.26 });
      fbTone(env, { type: 'sine', f0: 1420 * rate, f1: 1380 * rate, dur: 0.14, gain: 0.19, attack: 0.001, reverbSend: 0.26 });
      return;
    }

    // 'unarmored' (Archer / cloth / unarmored enemies) -> mastered souls_hit_unarmored.wav
    const rate = (isHeavy ? 0.97 : 0.99) + Math.random() * 0.05;
    const gain = Math.min(0.96, 0.90 + (isHeavy ? 0.04 : 0) + (isCounter ? 0.02 : 0));
    if (playSample('hit_unarmored', {
      gain,
      rate,
      reverbSend: isHeavy ? 0.20 : 0.16,
      lowShelfDb: isHeavy ? 2.0 : 0.8,
      highShelfDb: isCounter ? 2.0 : 1.2
    })) {
      return;
    }

    const legacyFleshKey = pickVariant('hit_flesh', ['hit_flesh_1', 'hit_flesh_2']);
    if (playSample(legacyFleshKey, {
      gain,
      rate,
      reverbSend: 0.16,
      lowShelfDb: isHeavy ? 2.0 : 0.8
    })) {
      return;
    }

    const env = resolveAudioEnv();
    if (!env) return;
    fbTone(env, { type: 'sine', f0: (isHeavy ? 155 : 180) * rate, f1: 48 * rate, dur: 0.11, gain: isHeavy ? 0.36 : 0.30, attack: 0.001, reverbSend: 0.16 });
    fbNoise(env, { f0: 2150 * rate, f1: 460 * rate, q: 1.5, dur: 0.12, gain: 0.34, attack: 0.001, reverbSend: 0.16 });
  }

  function playEnemyShieldHit(opts = {}) {
    if (!canTrigger('enemy_shield_hit', 32)) return;
    const isHeavy = typeof opts === 'boolean' ? opts : Boolean(opts && (opts.heavy || opts.isHeavy));
    // Dedicated ringing iron-shield clang (block_1 / block_2, centroid ~5.5kHz, rate 1.02..1.07 — sharper & higher than body armor!)
    const key = pickVariant('enemy_shield_hit', ['block_1', 'block_2']);
    const rate = (isHeavy ? 1.02 : 1.035) + Math.random() * 0.035;
    const gain = isHeavy ? 0.95 : 0.89;

    if (playSample(key, {
      gain,
      rate,
      reverbSend: isHeavy ? 0.28 : 0.22,
      lowShelfDb: isHeavy ? 1.2 : 0.4,
      highShelfDb: 2.2
    })) {
      return;
    }

    const env = resolveAudioEnv();
    if (!env) return;
    fbNoise(env, { filterType: 'bandpass', f0: 3850 * rate, f1: 1950 * rate, q: 2.5, dur: 0.055, gain: 0.30, attack: 0.001, reverbSend: 0.22 });
    fbTone(env, { type: 'triangle', f0: 785 * rate, f1: 758 * rate, dur: 0.19, gain: 0.25, attack: 0.001, reverbSend: 0.24 });
    fbTone(env, { type: 'sine', f0: 1750 * rate, f1: 1705 * rate, dur: 0.15, gain: 0.18, attack: 0.001, reverbSend: 0.24 });
  }

  function playShieldBlock({ isBoss = false, heavy = false } = {}) {
    if (!canTrigger('hero_block', 35)) return;

    if (isBoss) {
      // Boss warhammer slamming onto Hero's wooden shield (souls_shield_block_boss.wav)
      const rate = jitterRate(heavy ? 0.96 : 1.0, 0.03);
      if (playSample('shield_block_boss', {
        gain: heavy ? 0.98 : 0.95,
        rate,
        reverbSend: 0.28,
        lowShelfDb: heavy ? 2.6 : 1.8,
        highShelfDb: 0.4
      })) {
        return;
      }
      const env = resolveAudioEnv();
      if (!env) return;
      // Heavy wooden oak shield slam fallback (ZERO metallic bell partials!)
      fbTone(env, { type: 'sine', f0: 132 * rate, f1: 42 * rate, dur: 0.18, gain: 0.42, attack: 0.001, reverbSend: 0.24 });
      fbTone(env, { type: 'triangle', f0: 245 * rate, f1: 138 * rate, dur: 0.09, gain: 0.28, attack: 0.001, reverbSend: 0.20 });
      fbNoise(env, { f0: 1380 * rate, f1: 460 * rate, q: 1.5, dur: 0.11, gain: 0.34, attack: 0.001, reverbSend: 0.20 });
      return;
    }

    // Regular enemy hitting Hero's wooden shield (souls_shield_block_mob.wav)
    const rate = jitterRate(heavy ? 0.95 : 1.0, 0.04);
    if (playSample('shield_block_mob', {
      gain: heavy ? 0.92 : 0.88,
      rate,
      reverbSend: heavy ? 0.22 : 0.16,
      lowShelfDb: heavy ? 1.8 : 0.8,
      highShelfDb: 0.5
    })) {
      return;
    }

    const env = resolveAudioEnv();
    if (!env) return;
    // Crisp solid wooden shield thud fallback (ZERO metallic bell partials!)
    fbTone(env, { type: 'sine', f0: 162 * rate, f1: 54 * rate, dur: 0.12, gain: heavy ? 0.36 : 0.30, attack: 0.001, reverbSend: 0.16 });
    fbTone(env, { type: 'triangle', f0: 280 * rate, f1: 158 * rate, dur: 0.075, gain: 0.22, attack: 0.001, reverbSend: 0.16 });
    fbNoise(env, { f0: 1580 * rate, f1: 580 * rate, q: 1.6, dur: 0.075, gain: 0.26, attack: 0.001, reverbSend: 0.14 });
  }

  function playHeroArmorHit({ isHeavy = false } = {}) {
    if (!canTrigger('hero_armor_hit', 40)) return;
    // Regular enemy weapon striking Hero's bare steel-plate armor (unblocked):
    // crisp, expressive ringing steel-on-plate clang (hit_armor_1/2, rate 0.92..0.97, +2.2 dB highShelf)
    // layered with a tight forged-steel transient so it unmistakably reads as plate armor!
    const key = pickVariant('hero_armor_hit', ['hit_armor_1', 'hit_armor_2']);
    const rate = (isHeavy ? 0.92 : 0.94) + Math.random() * 0.03;
    const env = resolveAudioEnv();

    if (playSample(key, {
      gain: isHeavy ? 0.96 : 0.90,
      rate,
      reverbSend: isHeavy ? 0.28 : 0.24,
      lowShelfDb: isHeavy ? 2.2 : 1.0,
      highShelfDb: 2.2
    })) {
      if (env) {
        fbNoise(env, {
          filterType: 'bandpass',
          f0: 4250 * rate,
          f1: 2350 * rate,
          q: 2.8,
          dur: 0.038,
          gain: isHeavy ? 0.15 : 0.12,
          attack: 0.001,
          reverbSend: 0.20
        });
        fbTone(env, {
          type: 'sine',
          f0: 1290 * rate,
          f1: 1255 * rate,
          dur: isHeavy ? 0.15 : 0.12,
          gain: isHeavy ? 0.08 : 0.065,
          attack: 0.001,
          reverbSend: 0.22
        });
      }
      return;
    }

    if (!env) return;
    fbNoise(env, { filterType: 'highpass', f0: 3100 * rate, f1: 1950 * rate, q: 1.6, dur: 0.045, gain: 0.30, attack: 0.001, reverbSend: 0.24 });
    fbTone(env, { type: 'triangle', f0: 635 * rate, f1: 608 * rate, dur: 0.19, gain: 0.26, attack: 0.001, reverbSend: 0.26 });
    fbTone(env, { type: 'sine', f0: 1460 * rate, f1: 1420 * rate, dur: 0.15, gain: 0.20, attack: 0.001, reverbSend: 0.26 });
    fbTone(env, { type: 'sine', f0: 2780 * rate, f1: 2710 * rate, dur: 0.11, gain: 0.11, attack: 0.001, reverbSend: 0.24 });
  }

  function playBossHitHeroArmor({ isHeavy = true } = {}) {
    if (!canTrigger('hero_hit_by_boss', 45)) return;
    const rate = jitterRate(1.0, 0.03);
    if (playSample('boss_hit_hero_armor', {
      gain: isHeavy ? 0.98 : 0.95,
      rate,
      reverbSend: 0.28,
      lowShelfDb: isHeavy ? 2.4 : 1.6,
      highShelfDb: 1.8
    })) {
      return;
    }

    const env = resolveAudioEnv();
    if (!env) return;
    fbTone(env, { type: 'sine', f0: 142 * rate, f1: 32 * rate, dur: 0.24, gain: 0.42, attack: 0.001, reverbSend: 0.24 });
    fbNoise(env, { filterType: 'highpass', f0: 2800 * rate, f1: 1650 * rate, q: 1.5, dur: 0.055, gain: 0.30, attack: 0.001, reverbSend: 0.24 });
    fbTone(env, { type: 'triangle', f0: 560 * rate, f1: 535 * rate, dur: 0.20, gain: 0.24, attack: 0.001, reverbSend: 0.24 });
    fbTone(env, { type: 'sine', f0: 1320 * rate, f1: 1280 * rate, dur: 0.16, gain: 0.16, attack: 0.001, reverbSend: 0.24 });
  }

  function playParrySuccess() {
    if (!canTrigger('hero_parry', 60)) return;
    const rate = jitterRate(1.0, 0.04);
    const env = resolveAudioEnv();

    // Primary studio ElevenLabs dramatic steel ring (souls_parry_steel_ring.wav),
    // reinforced by a clean phase-coherent FromSoft sub-bass drop (<135 Hz) for huge chest punch.
    const playedSteelRing = playSample('parry_steel_ring', {
      gain: 0.98,
      rate,
      reverbSend: 0.36,
      highShelfDb: 1.2
    });
    if (playedSteelRing) {
      if (env) {
        fbTone(env, { type: 'sine', f0: 132 * rate, f1: 42 * rate, dur: 0.24, gain: 0.32, attack: 0.002, reverbSend: 0.22 });
      }
      return;
    }

    // Fallback to dedicated souls_hero_parry.wav if steel ring is still loading
    if (playSample('parry', {
      gain: 0.96,
      rate,
      reverbSend: 0.34,
      lowShelfDb: 1.5
    })) {
      return;
    }

    if (!env) return;
    // Full Web Audio fallback: steel deflect + FromSoft sub-bass drop + deep D3 bell + high chime
    fbNoise(env, { filterType: 'bandpass', f0: 3400 * rate, f1: 1200 * rate, q: 3.0, dur: 0.06, gain: 0.32, attack: 0.001, reverbSend: 0.28 });
    fbTone(env, { type: 'sine', f0: 138 * rate, f1: 44 * rate, dur: 0.24, gain: 0.38, attack: 0.002, reverbSend: 0.24 });
    fbTone(env, { type: 'triangle', f0: 146.8 * rate, f1: 146.0 * rate, dur: 0.56, gain: 0.28, attack: 0.004, delay: 0.004, reverbSend: 0.34 });
    fbTone(env, { type: 'sine', f0: 587.3 * rate, f1: 585.0 * rate, dur: 0.42, gain: 0.16, attack: 0.005, delay: 0.008, reverbSend: 0.34 });
    fbTone(env, { type: 'sine', f0: 1174.7 * rate, f1: 1170.0 * rate, dur: 0.34, gain: 0.12, attack: 0.005, delay: 0.010, reverbSend: 0.34 });
  }

  function playPartialParry() {
    if (!canTrigger('hero_partial_parry', 45)) return;
    const rate = jitterRate(1.0, 0.04);

    if (playSample('partial_parry', {
      gain: 0.82,
      rate,
      reverbSend: 0.20,
      highShelfDb: 1.0
    })) {
      return;
    }

    const env = resolveAudioEnv();
    if (!env) return;
    fbNoise(env, { f0: 3600 * rate, f1: 1100 * rate, q: 4.2, dur: 0.16, gain: 0.28, attack: 0.002, reverbSend: 0.18 });
    fbTone(env, { type: 'sawtooth', f0: 490 * rate, f1: 310 * rate, dur: 0.12, gain: 0.16, attack: 0.002, reverbSend: 0.16 });
  }

  function playGuardCounterCue() {
    if (!canTrigger('hero_guard_counter', 55)) return;
    const rate = jitterRate(1.0, 0.04);

    if (playSample('guard_counter', {
      gain: 0.92,
      rate,
      reverbSend: 0.32,
      highShelfDb: 1.5
    })) {
      return;
    }

    const env = resolveAudioEnv();
    if (!env) return;
    fbNoise(env, { f0: 1300 * rate, f1: 3800 * rate, q: 4.5, dur: 0.07, gain: 0.22, attack: 0.003, reverbSend: 0.24 });
    fbTone(env, { type: 'sine', f0: 587.33 * rate, f1: 586.0 * rate, dur: 0.36, gain: 0.24, attack: 0.003, delay: 0.01, reverbSend: 0.30 });
    fbTone(env, { type: 'sine', f0: 880.0 * rate, f1: 878.0 * rate, dur: 0.34, gain: 0.20, attack: 0.003, delay: 0.012, reverbSend: 0.30 });
    fbTone(env, { type: 'sine', f0: 1760.0 * rate, f1: 1756.0 * rate, dur: 0.28, gain: 0.14, attack: 0.004, delay: 0.014, reverbSend: 0.30 });
  }

  function playGuardBreak() {
    if (!canTrigger('hero_guard_break', 80)) return;
    const rate = jitterRate(1.0, 0.04);

    if (playSample('guard_break', {
      gain: 0.96,
      rate,
      reverbSend: 0.30,
      lowShelfDb: 2.0
    })) {
      return;
    }

    const env = resolveAudioEnv();
    if (!env) return;
    fbNoise(env, { f0: 2400 * rate, f1: 680 * rate, q: 1.8, dur: 0.12, gain: 0.32, attack: 0.001, reverbSend: 0.22 });
    fbTone(env, { type: 'sine', f0: 120 * rate, f1: 38 * rate, dur: 0.26, gain: 0.36, attack: 0.002, reverbSend: 0.22 });
    fbTone(env, { type: 'sawtooth', f0: 260 * rate, f1: 185 * rate, dur: 0.24, gain: 0.16, attack: 0.003, delay: 0.01, reverbSend: 0.26 });
  }

  function playRiposteImpact() {
    if (!canTrigger('hero_riposte', 80)) return;
    const rate = jitterRate(1.0, 0.04);

    if (playSample('riposte', {
      gain: 1.0,
      rate,
      reverbSend: 0.34,
      lowShelfDb: 2.5
    })) {
      return;
    }

    const env = resolveAudioEnv();
    if (!env) return;
    fbNoise(env, { f0: 2200 * rate, f1: 420 * rate, q: 1.8, dur: 0.14, gain: 0.34, attack: 0.001, reverbSend: 0.24 });
    fbTone(env, { type: 'sine', f0: 190 * rate, f1: 58 * rate, dur: 0.10, gain: 0.30, attack: 0.001, reverbSend: 0.18 });
    fbTone(env, { type: 'sine', f0: 112 * rate, f1: 34 * rate, dur: 0.36, gain: 0.42, attack: 0.003, delay: 0.062, reverbSend: 0.28 });
    fbTone(env, { type: 'triangle', f0: 440 * rate, f1: 432 * rate, dur: 0.30, gain: 0.15, attack: 0.004, delay: 0.068, reverbSend: 0.30 });
  }

  function playFlaskDrink() {
    if (!canTrigger('hero_flask', 120)) return;
    const rate = jitterRate(1.0, 0.04);

    if (playSample('flask', {
      gain: 0.88,
      rate,
      reverbSend: 0.22,
      highShelfDb: 1.0
    })) {
      return;
    }

    const env = resolveAudioEnv();
    if (!env) return;
    fbNoise(env, { f0: 420 * rate, f1: 980 * rate, q: 3.5, dur: 0.16, gain: 0.22, attack: 0.025, reverbSend: 0.16 });
    fbTone(env, { type: 'sine', f0: 587.33 * rate, f1: 590.0 * rate, dur: 0.42, gain: 0.18, attack: 0.05, delay: 0.05, reverbSend: 0.24 });
    fbTone(env, { type: 'sine', f0: 783.99 * rate, f1: 786.0 * rate, dur: 0.40, gain: 0.18, attack: 0.055, delay: 0.065, reverbSend: 0.24 });
    fbTone(env, { type: 'sine', f0: 1174.66 * rate, f1: 1178.0 * rate, dur: 0.36, gain: 0.14, attack: 0.06, delay: 0.08, reverbSend: 0.24 });
  }

  function playHeroRoll({ heavy = false } = {}) {
    if (!canTrigger('hero_roll', 90)) return;
    const rate = jitterRate(heavy ? 0.94 : 1.0, 0.04);

    // Primary ElevenLabs armored knight roll slot (souls_hero_roll.wav)
    if (playSample('roll', {
      gain: heavy ? 0.94 : 0.88,
      rate,
      reverbSend: 0.22,
      lowShelfDb: heavy ? 2.0 : 0.8
    })) {
      return;
    }

    // Seamless fallback to studio stone roll variants if souls_hero_roll.wav is absent/loading
    const stoneKey = pickVariant('roll_stone', ['roll_stone_1', 'roll_stone_2']);
    if (playSample(stoneKey, {
      gain: heavy ? 0.90 : 0.84,
      rate,
      reverbSend: 0.22,
      lowShelfDb: heavy ? 1.5 : 0.5
    })) {
      return;
    }

    const env = resolveAudioEnv();
    if (!env) return;
    fbNoise(env, { f0: 680 * rate, f1: 260 * rate, q: 1.4, dur: 0.18, gain: 0.24, attack: 0.012, reverbSend: 0.18 });
    fbTone(env, { type: 'sine', f0: 125 * rate, f1: 52 * rate, dur: 0.12, gain: 0.26, attack: 0.004, delay: 0.09, reverbSend: 0.20 });
    fbNoise(env, { f0: 2600 * rate, f1: 1100 * rate, q: 2.4, dur: 0.09, gain: 0.16, attack: 0.003, delay: 0.11, reverbSend: 0.18 });
  }

  return {
    preload,
    playSwordSwing,
    playHeavyThrust,
    playSwordHit,
    playEnemyShieldHit,
    playShieldBlock,
    playHeroArmorHit,
    playBossHitHeroArmor,
    playParrySuccess,
    playPartialParry,
    playGuardCounterCue,
    playGuardBreak,
    playRiposteImpact,
    playFlaskDrink,
    playHeroRoll,
    playRoll: playHeroRoll
  };
}
