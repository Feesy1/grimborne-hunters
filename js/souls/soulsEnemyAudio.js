// Abandoned Knight Rift — Boss (Troll) & Corridor Enemies Audio Controller (Pass 1 AAA Cinema Upgrade)
// Multi-tier ElevenLabs + 44.1 kHz WAV playback with cinema stereo widening, chest-weight sub-bass
// reinforcement, presence EQ to cut through orchestral boss music, transparent soft-limiter,
// optional music ducking hook, anti-spam protection, and zero-dependency Web Audio fallbacks.

const ASSET_VER = '20261124z97';

export const SOULS_ENEMY_AUDIO_MANIFEST = Object.freeze({
  // New Pass-1 ElevenLabs / Studio Boss & Heavy Mob Assets (highest priority)
  boss_roar_z83: `./assets/audio/souls_boss_roar_z83.wav?v=${ASSET_VER}`,
  boss_roar_el: `./assets/audio/boss_roar_el.mp3?v=${ASSET_VER}`,
  boss_cutscene_roar: `./assets/audio/souls_boss_cutscene_roar.wav?v=${ASSET_VER}`,
  boss_leap_el: `./assets/audio/boss_leap_el.mp3?v=${ASSET_VER}`,
  boss_footstep_1: `./assets/audio/boss_footstep_1.wav?v=${ASSET_VER}`,
  boss_footstep_2: `./assets/audio/boss_footstep_2.wav?v=${ASSET_VER}`,
  boss_footstep_3: `./assets/audio/boss_footstep_3.wav?v=${ASSET_VER}`,
  boss_footstep_4: `./assets/audio/boss_footstep_4.wav?v=${ASSET_VER}`,
  boss_hammer_ground_el: `./assets/audio/boss_hammer_ground_el.mp3?v=${ASSET_VER}`,
  boss_hammer_hit_el: `./assets/audio/boss_hammer_hit_el.mp3?v=${ASSET_VER}`,
  mob_heavy_whoosh: `./assets/audio/souls_mob_heavy_whoosh.wav?v=${ASSET_VER}`,

  // Universal Mob Voice, Death Wail, 3 Grunt Variations & Armored Footsteps
  mob_death_wail_el: `./assets/audio/mob_death_wail_el.mp3?v=${ASSET_VER}`,
  mob_footstep_1: `./assets/audio/mob_footstep_1.wav?v=${ASSET_VER}`,
  mob_footstep_2: `./assets/audio/mob_footstep_2.wav?v=${ASSET_VER}`,
  mob_footstep_3: `./assets/audio/mob_footstep_3.wav?v=${ASSET_VER}`,
  mob_footstep_4: `./assets/audio/mob_footstep_4.wav?v=${ASSET_VER}`,
  mob_attack_grunt_1: `./assets/audio/mob_attack_grunt_1.mp3?v=${ASSET_VER}`,
  mob_attack_grunt_2: `./assets/audio/mob_attack_grunt_2.mp3?v=${ASSET_VER}`,
  mob_attack_grunt_3: `./assets/audio/mob_attack_grunt_3.mp3?v=${ASSET_VER}`,
  mob_attack_grunt_el: `./assets/audio/mob_attack_grunt_el.mp3?v=${ASSET_VER}`,
  mob_hurt_grunt_el: `./assets/audio/mob_hurt_grunt_el.mp3?v=${ASSET_VER}`,

  // Core 44.1 kHz Studio Boss & Corridor Enemy WAVs (active + guaranteed fallbacks)
  boss_step_1: `./assets/audio/souls_boss_step_1.wav?v=${ASSET_VER}`,
  boss_step_2: `./assets/audio/souls_boss_step_2.wav?v=${ASSET_VER}`,
  boss_hammer_whoosh_1: `./assets/audio/souls_boss_hammer_whoosh_1.wav?v=${ASSET_VER}`,
  boss_hammer_whoosh_2: `./assets/audio/souls_boss_hammer_whoosh_2.wav?v=${ASSET_VER}`,
  boss_hammer_slam: `./assets/audio/souls_boss_hammer_slam.wav?v=${ASSET_VER}`,
  boss_roar: `./assets/audio/souls_boss_roar.wav?v=${ASSET_VER}`,
  boss_stance_break: `./assets/audio/souls_boss_stance_break.wav?v=${ASSET_VER}`,
  boss_recoil: `./assets/audio/souls_boss_recoil.wav?v=${ASSET_VER}`,
  mob_knight_swing: `./assets/audio/souls_mob_knight_swing.wav?v=${ASSET_VER}`,
  mob_bow_draw: `./assets/audio/souls_mob_bow_draw.wav?v=${ASSET_VER}`,
  mob_arrow_whoosh: `./assets/audio/souls_mob_arrow_whoosh.wav?v=${ASSET_VER}`
});

const EL_FOOTSTEP_KEYS = ['boss_footstep_1', 'boss_footstep_2', 'boss_footstep_3', 'boss_footstep_4'];
const FALLBACK_FOOTSTEP_KEYS = ['boss_step_1', 'boss_step_2'];
const MOB_FOOTSTEP_KEYS = ['mob_footstep_1', 'mob_footstep_2', 'mob_footstep_3', 'mob_footstep_4'];
const MOB_ATTACK_GRUNT_KEYS = ['mob_attack_grunt_1', 'mob_attack_grunt_2', 'mob_attack_grunt_3'];
const MISSING_RETRY_MS = 15000;

export const MOB_AUDIO_ANTISPAM = Object.freeze({
  attackGruntGlobalMs: 2400,
  attackGruntPerMobMs: 4200,
  attackGruntNormalChance: 0.0,
  attackGruntHeavyChance: 0.32,
  footstepGlobalMs: 480,
  footstepMaxDistNorm: 0.75, // < 12 m under combat.js 16 m normalization
  hurtGlobalMs: 420
});

// Universal timbre profiles for all current & future enemy archetypes
export const MOB_VOICE_PROFILES = Object.freeze({
  iron_knight: Object.freeze({
    id: 'iron_knight',
    pitch: 0.86,
    stepPitch: 0.88,
    stepGain: 0.38,
    deathGain: 0.90,
    gruntGain: 0.76,
    hurtGain: 0.70,
    armorClatter: 1.0,
    lpScale: 0.88,
    isRanged: false
  }),
  cursed_footman: Object.freeze({
    id: 'cursed_footman',
    pitch: 1.00,
    stepPitch: 1.00,
    stepGain: 0.33,
    deathGain: 0.84,
    gruntGain: 0.70,
    hurtGain: 0.66,
    armorClatter: 0.78,
    lpScale: 1.00,
    isRanged: false
  }),
  bone_archer: Object.freeze({
    id: 'bone_archer',
    pitch: 1.18,
    stepPitch: 1.16,
    stepGain: 0.26,
    deathGain: 0.80,
    gruntGain: 0.62,
    hurtGain: 0.62,
    armorClatter: 0.45,
    lpScale: 1.14,
    isRanged: true
  }),
  ember_skeleton: Object.freeze({
    id: 'ember_skeleton',
    pitch: 1.12,
    stepPitch: 1.10,
    stepGain: 0.30,
    deathGain: 0.82,
    gruntGain: 0.66,
    hurtGain: 0.64,
    armorClatter: 0.62,
    lpScale: 1.08,
    isRanged: false
  }),
  default: Object.freeze({
    id: 'default',
    pitch: 0.98,
    stepPitch: 1.00,
    stepGain: 0.32,
    deathGain: 0.84,
    gruntGain: 0.70,
    hurtGain: 0.66,
    armorClatter: 0.72,
    lpScale: 1.00,
    isRanged: false
  })
});

function resolveMobInput(enemyTypeOrObj, explicitActorId = null) {
  let typeStr = enemyTypeOrObj;
  let actorId = explicitActorId;
  if (enemyTypeOrObj && typeof enemyTypeOrObj === 'object') {
    typeStr = enemyTypeOrObj.type || enemyTypeOrObj.enemyType || enemyTypeOrObj.id || 'default';
    if (actorId == null) {
      actorId = enemyTypeOrObj.uid ?? enemyTypeOrObj.id ?? null;
    }
  }
  const profile = resolveMobProfile(typeStr);
  return { profile, actorId };
}

function resolveInstancePitchScale(actorId) {
  if (actorId == null) return 1.0;
  const str = String(actorId);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  // Deterministic +-6% individual timbre offset per mob instance
  return clamp(1.0 + ((((hash >>> 0) % 13) - 6) * 0.01), 0.94, 1.06);
}

function resolveMobProfile(enemyType) {
  if (!enemyType || typeof enemyType !== 'string') return MOB_VOICE_PROFILES.default;
  const key = enemyType.trim().toLowerCase();
  if (MOB_VOICE_PROFILES[key]) return MOB_VOICE_PROFILES[key];

  // Semantic archetype matching for future/aliased enemy names
  if (key.includes('executioner') || key.includes('knight') || key.includes('paladin') || key.includes('heavy') || key.includes('brute')) {
    return MOB_VOICE_PROFILES.iron_knight;
  }
  if (key.includes('archer') || key.includes('acolyte') || key.includes('lich') || key.includes('mage') || key.includes('ranger')) {
    return MOB_VOICE_PROFILES.bone_archer;
  }
  if (key.includes('ember') || key.includes('skeleton') || key.includes('bone') || key.includes('undead') || key.includes('shade')) {
    return MOB_VOICE_PROFILES.ember_skeleton;
  }
  if (key.includes('footman') || key.includes('vanguard') || key.includes('guard') || key.includes('warden') || key.includes('soldier')) {
    return MOB_VOICE_PROFILES.cursed_footman;
  }

  // Deterministic subtle voice-timbre variation for any brand-new future enemyType
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }
  const offset = (((hash >>> 0) % 11) - 5) * 0.014; // -0.07 .. +0.07
  return {
    ...MOB_VOICE_PROFILES.default,
    id: key,
    pitch: clamp(0.98 + offset, 0.84, 1.18),
    stepPitch: clamp(1.00 + offset * 0.8, 0.88, 1.14)
  };
}

function clamp(v, lo, hi) {
  const n = Number(v);
  if (!Number.isFinite(n)) return lo;
  return n < lo ? lo : n > hi ? hi : n;
}

function nowMs() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function randRange(lo, hi) {
  return lo + Math.random() * (hi - lo);
}

function safeDisconnect(nodes) {
  for (let i = 0; i < nodes.length; i++) {
    try {
      nodes[i].disconnect();
    } catch {}
  }
}

function createSoftLimitCurve(samples = 1024) {
  const curve = new Float32Array(samples);
  const drive = 1.32;
  const invTanhDrive = 1.0 / Math.tanh(drive);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / (samples - 1) - 1;
    // Linear transparency below ~0.65, smooth cinema saturation ceiling at 0.97
    curve[i] = Math.tanh(x * drive) * invTanhDrive * 0.97;
  }
  return curve;
}

export function createSoulsEnemyAudio({
  getCtx = () => null,
  getSfxDest = () => null,
  getStoneReverbDest = () => null,
  duckMusic = null
} = {}) {
  const sampleBuffers = new Map();
  const sampleState = new Map(); // key -> 'loading' | 'ready' | 'missing'
  const sampleMissingAt = new Map();
  const lastTriggerAt = Object.create(null);

  let stepCycleIdx = 0;
  let mobStepCycleIdx = 0;
  let whooshCycleIdx = 0;
  let lastAttackGruntKey = null;
  let activeVoices = 0;
  let activeBossRoar = null;
  let fallbackNoiseCtx = null;
  let fallbackNoiseBuf = null;

  // Per-AudioContext cinema master strip (presence + sub warmth + stereo spread + soft-limiter)
  let busCtx = null;
  let busDest = null;
  let busNodes = [];
  let bossCinemaIn = null;
  let bossStereoWideIn = null;

  const MAX_CONCURRENT_VOICES = 18;

  function resolveAudioContext(explicitCtx = null) {
    if (explicitCtx) return explicitCtx;
    if (typeof getCtx === 'function') {
      try {
        return getCtx();
      } catch {
        return null;
      }
    }
    return null;
  }

  function resolveSfxDest(ctx) {
    if (typeof getSfxDest === 'function') {
      try {
        const d = getSfxDest();
        if (d) return d;
      } catch {}
    }
    return ctx ? ctx.destination : null;
  }

  function resolveReverbDest() {
    if (typeof getStoneReverbDest === 'function') {
      try {
        return getStoneReverbDest() || null;
      } catch {}
    }
    return null;
  }

  function triggerMusicDuck(db = -4.0, attackSec = 0.08, releaseSec = 0.52) {
    if (typeof duckMusic === 'function') {
      try {
        duckMusic(db, attackSec, releaseSec);
      } catch {}
    }
  }

  function ensureCinemaBus(ctx, dest) {
    if (!ctx || !dest) return null;
    if (bossCinemaIn && busCtx === ctx && busDest === dest) {
      return { direct: bossCinemaIn, wide: bossStereoWideIn || bossCinemaIn };
    }

    safeDisconnect(busNodes);
    busNodes = [];
    busCtx = ctx;
    busDest = dest;

    const t0 = ctx.currentTime || 0;
    const input = ctx.createGain();
    input.gain.setValueAtTime(1.0, t0);
    busNodes.push(input);

    let chain = input;

    // Warm chest-weight low-shelf so boss attacks cut cleanly over orchestral tracks
    if (typeof ctx.createBiquadFilter === 'function') {
      const lowShelf = ctx.createBiquadFilter();
      lowShelf.type = 'lowshelf';
      lowShelf.frequency.setValueAtTime(118, t0);
      lowShelf.gain.setValueAtTime(3.2, t0);
      chain.connect(lowShelf);
      chain = lowShelf;
      busNodes.push(lowShelf);

      // Mid-high presence lift (1.55 kHz) keeps hammer cracks, roars & steel crisp in combat
      const presence = ctx.createBiquadFilter();
      presence.type = 'peaking';
      presence.frequency.setValueAtTime(1550, t0);
      presence.Q.setValueAtTime(0.85, t0);
      presence.gain.setValueAtTime(2.6, t0);
      chain.connect(presence);
      chain = presence;
      busNodes.push(presence);
    }

    // Transparent soft-clip limiter so hot cinema gains (0.85..1.05) stay massive with 0 harsh clipping
    let limiterOut = chain;
    if (typeof ctx.createWaveShaper === 'function') {
      const shaper = ctx.createWaveShaper();
      shaper.curve = createSoftLimitCurve(1024);
      shaper.oversample = '2x';
      chain.connect(shaper);
      limiterOut = shaper;
      busNodes.push(shaper);
    }

    const outGain = ctx.createGain();
    outGain.gain.setValueAtTime(1.04, t0);
    limiterOut.connect(outGain);
    outGain.connect(dest);
    busNodes.push(outGain);

    bossCinemaIn = input;

    // Wide stereo Haas/mid-high spreader (keeps <240 Hz sub rock-solid mono in center,
    // spreads roar / air whoosh / stone shards / bell overtones wide across L/R!)
    let wideIn = input;
    if (
      typeof ctx.createChannelMerger === 'function' &&
      typeof ctx.createDelay === 'function' &&
      typeof ctx.createBiquadFilter === 'function'
    ) {
      try {
        const wIn = ctx.createGain();
        wIn.gain.setValueAtTime(1.0, t0);

        // Center dry anchor
        wIn.connect(input);

        // Stereo-only high-passed Haas side width (+10.5 ms right, +16.5 ms left inverted)
        const sideHp = ctx.createBiquadFilter();
        sideHp.type = 'highpass';
        sideHp.frequency.setValueAtTime(250, t0);
        sideHp.Q.setValueAtTime(0.7, t0);

        const delayL = ctx.createDelay(0.05);
        delayL.delayTime.setValueAtTime(0.0085, t0);
        const delayR = ctx.createDelay(0.05);
        delayR.delayTime.setValueAtTime(0.0155, t0);

        const gainL = ctx.createGain();
        gainL.gain.setValueAtTime(0.32, t0);
        const gainR = ctx.createGain();
        gainR.gain.setValueAtTime(-0.32, t0);

        const merger = ctx.createChannelMerger(2);
        wIn.connect(sideHp);
        sideHp.connect(delayL);
        sideHp.connect(delayR);
        delayL.connect(gainL);
        delayR.connect(gainR);
        gainL.connect(merger, 0, 0);
        gainR.connect(merger, 0, 1);
        merger.connect(input);

        busNodes.push(wIn, sideHp, delayL, delayR, gainL, gainR, merger);
        wideIn = wIn;
      } catch {
        wideIn = input;
      }
    }

    bossStereoWideIn = wideIn;
    return { direct: bossCinemaIn, wide: bossStereoWideIn };
  }

  function canTrigger(tag, minIntervalMs) {
    const t = nowMs();
    const prev = lastTriggerAt[tag];
    if (prev !== undefined && t - prev < minIntervalMs) return false;
    lastTriggerAt[tag] = t;
    return true;
  }

  function canTriggerPair(tagA, minMsA, tagB, minMsB) {
    const t = nowMs();
    const prevA = lastTriggerAt[tagA];
    const prevB = lastTriggerAt[tagB];
    if (prevA !== undefined && t - prevA < minMsA) return false;
    if (prevB !== undefined && t - prevB < minMsB) return false;
    lastTriggerAt[tagA] = t;
    lastTriggerAt[tagB] = t;
    return true;
  }

  function pickNonRepeatingGruntKey() {
    const ready = [];
    for (let i = 0; i < MOB_ATTACK_GRUNT_KEYS.length; i++) {
      const k = MOB_ATTACK_GRUNT_KEYS[i];
      if (sampleBuffers.get(k)) ready.push(k);
    }
    if (ready.length > 0) {
      let pool = ready;
      if (ready.length >= 2 && lastAttackGruntKey) {
        const filtered = ready.filter((k) => k !== lastAttackGruntKey);
        if (filtered.length > 0) pool = filtered;
      }
      const chosen = pool[Math.floor(Math.random() * pool.length)];
      lastAttackGruntKey = chosen;
      return chosen;
    }
    if (sampleBuffers.get('mob_attack_grunt_el')) {
      lastAttackGruntKey = 'mob_attack_grunt_el';
      return 'mob_attack_grunt_el';
    }
    return null;
  }

  function getPolyphonyScale(priority = false) {
    if (!priority && activeVoices >= MAX_CONCURRENT_VOICES) return 0;
    if (priority) {
      // Major Boss attacks MUST stay loud & commanding even during hectic multi-enemy clashes
      if (activeVoices <= 3) return 1.0;
      return Math.max(0.84, 1.0 / Math.pow(activeVoices - 2, 0.16));
    }
    if (activeVoices <= 3) return 1.0;
    return Math.max(0.58, 1.0 / Math.sqrt(activeVoices - 2));
  }

  function trackVoiceStart(durationSec) {
    activeVoices += 1;
    const ms = Math.max(80, Math.ceil((durationSec + 0.06) * 1000));
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      activeVoices = Math.max(0, activeVoices - 1);
    };
    if (typeof setTimeout === 'function') {
      setTimeout(release, ms);
    }
    return release;
  }

  function getFallbackNoiseBuffer(ctx) {
    if (fallbackNoiseBuf && fallbackNoiseCtx === ctx) return fallbackNoiseBuf;
    const len = Math.max(1024, Math.floor(ctx.sampleRate * 1.4));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    fallbackNoiseCtx = ctx;
    fallbackNoiseBuf = buf;
    return buf;
  }

  function preloadKey(ctx, key, url) {
    const state = sampleState.get(key);
    if (state === 'ready' || state === 'loading') return;
    if (state === 'missing') {
      const missedAt = sampleMissingAt.get(key) || 0;
      if (nowMs() - missedAt < MISSING_RETRY_MS) return;
    }

    sampleState.set(key, 'loading');
    fetch(url)
      .then((res) => (res && res.ok ? res.arrayBuffer() : Promise.reject(new Error('HTTP'))))
      .then((ab) => ctx.decodeAudioData(ab))
      .then((decoded) => {
        sampleBuffers.set(key, decoded);
        sampleState.set(key, 'ready');
        sampleMissingAt.delete(key);
      })
      .catch(() => {
        sampleBuffers.delete(key);
        sampleState.set(key, 'missing');
        sampleMissingAt.set(key, nowMs());
      });
  }

  let preloadStarted = false;
  const _manifestEntries = Object.entries(SOULS_ENEMY_AUDIO_MANIFEST);
  function preload(audioCtx) {
    if (preloadStarted) return;
    const ctx = resolveAudioContext(audioCtx);
    if (!ctx || typeof fetch === 'undefined') return;
    preloadStarted = true;

    // Stagger 32 enemy WAV fetches/decodes (2 at a time) so entering Souls never spikes CPU!
    let idx = 0;
    const pump = () => {
      if (idx >= _manifestEntries.length) return;
      const [key, url] = _manifestEntries[idx++];
      preloadKey(ctx, key, url);
      if (idx < _manifestEntries.length) {
        setTimeout(pump, 24);
      }
    };
    pump();
    setTimeout(pump, 12);
  }

  function pickFirstReadyKey(keys) {
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (sampleBuffers.get(k)) return k;
    }
    return null;
  }

  function pickReadyFromCycle(keys, cycleIdx) {
    const ready = [];
    for (let i = 0; i < keys.length; i++) {
      if (sampleBuffers.get(keys[i])) ready.push(keys[i]);
    }
    if (ready.length === 0) return null;
    return ready[cycleIdx % ready.length];
  }

  function addSubReinforcement(ctx, targetBus, {
    startHz = 88,
    endHz = 36,
    durationSec = 0.28,
    gain = 0.24
  } = {}) {
    if (!ctx || !targetBus || gain <= 0.01) return;
    try {
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(clamp(startHz, 35, 160), t0);
      osc.frequency.exponentialRampToValueAtTime(clamp(endHz, 24, 90), t0 + durationSec * 0.72);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(clamp(gain, 0.01, 0.42), t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec);

      osc.connect(g);
      g.connect(targetBus);
      osc.onended = () => safeDisconnect([osc, g]);
      osc.start(t0);
      osc.stop(t0 + durationSec + 0.02);
    } catch {}
  }

  function playBufferedSample(key, {
    gain = 0.90,
    rate = 1.0,
    lpFreq = 0,
    hpFreq = 0,
    lowShelfDb = 0,
    presenceDb = 0,
    reverbSend = 0.24,
    priority = false,
    stereoWide = true,
    pan = 0,
    subBoost = null,
    onVoiceCreated = null
  } = {}) {
    const ctx = resolveAudioContext();
    const rawDest = resolveSfxDest(ctx);
    if (!ctx || !rawDest) return false;

    const buf = sampleBuffers.get(key);
    if (!buf) {
      preload(ctx);
      return false;
    }

    const polyScale = getPolyphonyScale(priority);
    if (polyScale <= 0) return true;

    const cinemaBus = ensureCinemaBus(ctx, rawDest);
    const targetBus = cinemaBus
      ? (stereoWide ? cinemaBus.wide : cinemaBus.direct)
      : rawDest;

    const t0 = ctx.currentTime;
    const safeRate = clamp(rate, 0.55, 1.65);
    const maxGain = priority ? 1.15 : 1.02;
    const safeGain = clamp(gain * polyScale, 0.001, maxGain);

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.setValueAtTime(safeRate, t0);

    let tail = src;
    const nodes = [src];

    if (hpFreq > 0) {
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(clamp(hpFreq, 20, 12000), t0);
      hp.Q.setValueAtTime(0.72, t0);
      tail.connect(hp);
      tail = hp;
      nodes.push(hp);
    }

    if (lowShelfDb !== 0) {
      const ls = ctx.createBiquadFilter();
      ls.type = 'lowshelf';
      ls.frequency.setValueAtTime(135, t0);
      ls.gain.setValueAtTime(clamp(lowShelfDb, -12, 8), t0);
      tail.connect(ls);
      tail = ls;
      nodes.push(ls);
    }

    if (presenceDb !== 0) {
      const pk = ctx.createBiquadFilter();
      pk.type = 'peaking';
      pk.frequency.setValueAtTime(1750, t0);
      pk.Q.setValueAtTime(0.95, t0);
      pk.gain.setValueAtTime(clamp(presenceDb, -8, 7), t0);
      tail.connect(pk);
      tail = pk;
      nodes.push(pk);
    }

    if (lpFreq > 0) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(clamp(lpFreq, 240, 18000), t0);
      lp.Q.setValueAtTime(0.72, t0);
      tail.connect(lp);
      tail = lp;
      nodes.push(lp);
    }

    if (pan !== 0 && typeof ctx.createStereoPanner === 'function') {
      try {
        const panner = ctx.createStereoPanner();
        panner.pan.setValueAtTime(clamp(pan, -0.45, 0.45), t0);
        tail.connect(panner);
        tail = panner;
        nodes.push(panner);
      } catch {}
    }

    const g = ctx.createGain();
    g.gain.setValueAtTime(safeGain, t0);
    tail.connect(g);
    g.connect(targetBus);
    nodes.push(g);

    const reverbDest = resolveReverbDest();
    if (reverbDest && reverbSend > 0.005) {
      const revGain = ctx.createGain();
      revGain.gain.setValueAtTime(clamp(reverbSend, 0.001, 0.65), t0);
      g.connect(revGain);
      revGain.connect(reverbDest);
      nodes.push(revGain);
    }

    if (subBoost && cinemaBus) {
      addSubReinforcement(ctx, cinemaBus.direct, {
        ...subBoost,
        gain: (subBoost.gain || 0.22) * polyScale
      });
    }

    const releaseVoice = trackVoiceStart(buf.duration / safeRate);
    let voiceMeta = null;
    if (typeof onVoiceCreated === 'function') {
      voiceMeta = {
        ctx,
        src,
        gainNode: g,
        initialGain: safeGain,
        releaseVoice,
        nodes,
        cleanupTimer: null
      };
      onVoiceCreated(voiceMeta);
    }
    src.onended = () => {
      if (voiceMeta && voiceMeta.cleanupTimer) {
        clearTimeout(voiceMeta.cleanupTimer);
        voiceMeta.cleanupTimer = null;
      }
      if (voiceMeta && activeBossRoar && activeBossRoar.src === src) {
        activeBossRoar = null;
      }
      releaseVoice();
      safeDisconnect(nodes);
    };
    src.start(t0);
    return true;
  }

  function playFirstAvailable(keys, opts) {
    const ctx = resolveAudioContext();
    if (ctx) preload(ctx);
    const readyKey = pickFirstReadyKey(keys);
    if (!readyKey) return false;
    return playBufferedSample(readyKey, opts);
  }

  // -------------------------------------------------------------------------
  // Procedural Web Audio Cinema Fallbacks (when audio files are still loading)
  // -------------------------------------------------------------------------

  function resolveFallbackTarget(ctx, stereoWide = true) {
    const rawDest = resolveSfxDest(ctx);
    if (!rawDest) return null;
    const bus = ensureCinemaBus(ctx, rawDest);
    return bus ? (stereoWide ? bus.wide : bus.direct) : rawDest;
  }

  function fallbackBossFootstep(distanceNorm) {
    const ctx = resolveAudioContext();
    const dest = resolveFallbackTarget(ctx, false);
    if (!ctx || !dest) return;
    const poly = getPolyphonyScale(false);
    if (poly <= 0) return;

    const t0 = ctx.currentTime;
    const atten = 1.0 - 0.56 * distanceNorm;
    const peak = clamp(0.84 * atten * poly, 0.14, 0.96);
    const lpCut = 4800 * Math.pow(0.24, distanceNorm);
    const nodes = [];

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(86, t0);
    osc.frequency.exponentialRampToValueAtTime(42, t0 + 0.16);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(clamp(lpCut, 600, 5600), t0);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.007);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.30);

    osc.connect(lp);
    lp.connect(g);
    g.connect(dest);
    nodes.push(osc, lp, g);

    const nSrc = ctx.createBufferSource();
    nSrc.buffer = getFallbackNoiseBuffer(ctx);
    const nBp = ctx.createBiquadFilter();
    nBp.type = 'bandpass';
    nBp.frequency.setValueAtTime(clamp(1350 * (1 - 0.45 * distanceNorm), 420, 1750), t0);
    nBp.Q.setValueAtTime(1.0, t0);
    const nG = ctx.createGain();
    nG.gain.setValueAtTime(peak * 0.34, t0);
    nG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.11);
    nSrc.connect(nBp);
    nBp.connect(nG);
    nG.connect(dest);
    nodes.push(nSrc, nBp, nG);

    const release = trackVoiceStart(0.32);
    osc.onended = () => {
      release();
      safeDisconnect(nodes);
    };
    osc.start(t0);
    osc.stop(t0 + 0.32);
    nSrc.start(t0);
    nSrc.stop(t0 + 0.12);
  }

  function fallbackBossLeap() {
    const ctx = resolveAudioContext();
    const dest = resolveFallbackTarget(ctx, true);
    if (!ctx || !dest) return;
    const poly = getPolyphonyScale(true);
    if (poly <= 0) return;

    const t0 = ctx.currentTime;
    const peak = clamp(0.86 * poly, 0.20, 1.0);
    const nodes = [];

    // Ground push-off stomp
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(104, t0);
    osc.frequency.exponentialRampToValueAtTime(40, t0 + 0.18);
    const oG = ctx.createGain();
    oG.gain.setValueAtTime(0.0001, t0);
    oG.gain.linearRampToValueAtTime(peak * 0.85, t0 + 0.008);
    oG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.24);
    osc.connect(oG);
    oG.connect(dest);
    nodes.push(osc, oG);

    // Rising colossal air-surge whoosh
    const nSrc = ctx.createBufferSource();
    nSrc.buffer = getFallbackNoiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(1.15, t0);
    bp.frequency.setValueAtTime(110, t0);
    bp.frequency.exponentialRampToValueAtTime(620, t0 + 0.22);
    bp.frequency.exponentialRampToValueAtTime(160, t0 + 0.56);

    const nG = ctx.createGain();
    nG.gain.setValueAtTime(0.0001, t0);
    nG.gain.linearRampToValueAtTime(peak * 0.72, t0 + 0.16);
    nG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.58);
    nSrc.connect(bp);
    bp.connect(nG);
    nG.connect(dest);
    nodes.push(nSrc, bp, nG);

    const release = trackVoiceStart(0.60);
    nSrc.onended = () => {
      release();
      safeDisconnect(nodes);
    };
    osc.start(t0);
    osc.stop(t0 + 0.26);
    nSrc.start(t0);
    nSrc.stop(t0 + 0.60);
  }

  function fallbackBossHammerWhoosh(heavy) {
    const ctx = resolveAudioContext();
    const dest = resolveFallbackTarget(ctx, true);
    if (!ctx || !dest) return;
    const poly = getPolyphonyScale(heavy);
    if (poly <= 0) return;

    const t0 = ctx.currentTime;
    const dur = heavy ? 0.46 : 0.36;
    const peak = clamp((heavy ? 0.50 : 0.40) * poly, 0.08, 0.58);
    const nodes = [];

    const nSrc = ctx.createBufferSource();
    nSrc.buffer = getFallbackNoiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(1.05, t0);
    bp.frequency.setValueAtTime(heavy ? 105 : 140, t0);
    bp.frequency.exponentialRampToValueAtTime(heavy ? 430 : 580, t0 + dur * 0.38);
    bp.frequency.exponentialRampToValueAtTime(115, t0 + dur);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(heavy ? 1550 : 1850, t0);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + dur * 0.36);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    nSrc.connect(bp);
    bp.connect(lp);
    lp.connect(g);
    g.connect(dest);
    nodes.push(nSrc, bp, lp, g);

    const release = trackVoiceStart(dur);
    nSrc.onended = () => {
      release();
      safeDisconnect(nodes);
    };
    nSrc.start(t0);
    nSrc.stop(t0 + dur + 0.02);
  }

  function fallbackBossHammerGround(intensity) {
    const ctx = resolveAudioContext();
    const dest = resolveFallbackTarget(ctx, true);
    if (!ctx || !dest) return;
    const poly = getPolyphonyScale(true);
    if (poly <= 0) return;

    const t0 = ctx.currentTime;
    const peak = clamp(0.94 * intensity * poly, 0.24, 1.05);
    const nodes = [];

    // Seismic ground impact sub-drop
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(106, t0);
    osc.frequency.exponentialRampToValueAtTime(32, t0 + 0.38);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.72);

    osc.connect(g);
    g.connect(dest);
    nodes.push(osc, g);

    // Granite shatter + debris crack
    const nSrc = ctx.createBufferSource();
    nSrc.buffer = getFallbackNoiseBuffer(ctx);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3600, t0);
    lp.frequency.exponentialRampToValueAtTime(320, t0 + 0.48);
    const nG = ctx.createGain();
    nG.gain.setValueAtTime(peak * 0.72, t0);
    nG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.54);
    nSrc.connect(lp);
    lp.connect(nG);
    nG.connect(dest);
    nodes.push(nSrc, lp, nG);

    const rev = resolveReverbDest();
    if (rev) {
      const rG = ctx.createGain();
      rG.gain.setValueAtTime(0.38, t0);
      nG.connect(rG);
      rG.connect(rev);
      nodes.push(rG);
    }

    const release = trackVoiceStart(0.74);
    osc.onended = () => {
      release();
      safeDisconnect(nodes);
    };
    osc.start(t0);
    osc.stop(t0 + 0.74);
    nSrc.start(t0);
    nSrc.stop(t0 + 0.56);
  }

  function fallbackBossHammerHit(intensity) {
    const ctx = resolveAudioContext();
    const dest = resolveFallbackTarget(ctx, true);
    if (!ctx || !dest) return;
    const poly = getPolyphonyScale(true);
    if (poly <= 0) return;

    const t0 = ctx.currentTime;
    const peak = clamp(0.95 * intensity * poly, 0.25, 1.05);
    const nodes = [];

    // Crushing blunt chest-punch sub
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(145, t0);
    osc.frequency.exponentialRampToValueAtTime(38, t0 + 0.22);
    const oG = ctx.createGain();
    oG.gain.setValueAtTime(0.0001, t0);
    oG.gain.linearRampToValueAtTime(peak, t0 + 0.004);
    oG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.34);
    osc.connect(oG);
    oG.connect(dest);
    nodes.push(osc, oG);

    // Metallic armor-crunch shock
    const nSrc = ctx.createBufferSource();
    nSrc.buffer = getFallbackNoiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1450, t0);
    bp.Q.setValueAtTime(0.85, t0);
    const nG = ctx.createGain();
    nG.gain.setValueAtTime(peak * 0.76, t0);
    nG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
    nSrc.connect(bp);
    bp.connect(nG);
    nG.connect(dest);
    nodes.push(nSrc, bp, nG);

    const release = trackVoiceStart(0.36);
    osc.onended = () => {
      release();
      safeDisconnect(nodes);
    };
    osc.start(t0);
    osc.stop(t0 + 0.36);
    nSrc.start(t0);
    nSrc.stop(t0 + 0.18);
  }

  function fallbackBossRoar() {
    const ctx = resolveAudioContext();
    const dest = resolveFallbackTarget(ctx, true);
    if (!ctx || !dest) return;
    const poly = getPolyphonyScale(true);
    if (poly <= 0) return;

    const t0 = ctx.currentTime;
    const dur = 1.65;
    const peak = clamp(0.88 * poly, 0.24, 0.96);
    const nodes = [];

    const roarOut = ctx.createGain();
    roarOut.gain.setValueAtTime(1.0, t0);
    roarOut.connect(dest);
    nodes.push(roarOut);

    // 1. Deep chest sub-body (58 -> 36 Hz sine, zero sawtooth buzz)
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(58, t0);
    sub.frequency.linearRampToValueAtTime(66, t0 + 0.24);
    sub.frequency.exponentialRampToValueAtTime(36, t0 + dur);
    const subG = ctx.createGain();
    subG.gain.setValueAtTime(0.0001, t0);
    subG.gain.linearRampToValueAtTime(peak * 0.62, t0 + 0.12);
    subG.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    sub.connect(subG);
    subG.connect(roarOut);
    nodes.push(sub, subG);

    // 2. Organic helm-chest vocal breath formants (zero sawtooth buzz!)
    const throat = ctx.createOscillator();
    throat.type = 'triangle';
    throat.frequency.setValueAtTime(84, t0);
    throat.frequency.linearRampToValueAtTime(98, t0 + 0.28);
    throat.frequency.exponentialRampToValueAtTime(58, t0 + dur);

    const nSrc = ctx.createBufferSource();
    nSrc.buffer = getFallbackNoiseBuffer(ctx);
    nSrc.loop = true;

    const f1 = ctx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.frequency.setValueAtTime(185, t0);
    f1.frequency.linearRampToValueAtTime(280, t0 + 0.32);
    f1.frequency.linearRampToValueAtTime(155, t0 + dur);
    f1.Q.setValueAtTime(1.9, t0);

    const f2 = ctx.createBiquadFilter();
    f2.type = 'bandpass';
    f2.frequency.setValueAtTime(440, t0);
    f2.frequency.linearRampToValueAtTime(620, t0 + 0.30);
    f2.frequency.linearRampToValueAtTime(320, t0 + dur);
    f2.Q.setValueAtTime(2.1, t0);

    const helmLp = ctx.createBiquadFilter();
    helmLp.type = 'lowpass';
    helmLp.frequency.setValueAtTime(920, t0);

    const mix = ctx.createGain();
    mix.gain.setValueAtTime(0.0001, t0);
    mix.gain.linearRampToValueAtTime(peak * 0.80, t0 + 0.14);
    mix.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    throat.connect(f1);
    nSrc.connect(f1);
    nSrc.connect(f2);
    f1.connect(helmLp);
    f2.connect(helmLp);
    helmLp.connect(mix);
    mix.connect(roarOut);
    nodes.push(throat, nSrc, f1, f2, helmLp, mix);

    const rev = resolveReverbDest();
    if (rev) {
      const rG = ctx.createGain();
      rG.gain.setValueAtTime(0.42, t0);
      roarOut.connect(rG);
      rG.connect(rev);
      nodes.push(rG);
    }

    const release = trackVoiceStart(dur);
    const handle = {
      ctx,
      src: nSrc,
      gainNode: roarOut,
      initialGain: 1.0,
      stopped: false,
      stop(fadeSec = 0.16) {
        if (handle.stopped) return;
        handle.stopped = true;
        const fadeDur = clamp(Number(fadeSec) || 0.16, 0.015, 1.5);
        try {
          const now = ctx.currentTime;
          const curVal = Math.max(0.0001, roarOut.gain.value || 1.0);
          roarOut.gain.cancelScheduledValues(now);
          roarOut.gain.setValueAtTime(curVal, now);
          roarOut.gain.exponentialRampToValueAtTime(0.0001, now + fadeDur);
          sub.stop(now + fadeDur + 0.02);
          throat.stop(now + fadeDur + 0.02);
          nSrc.stop(now + fadeDur + 0.02);
        } catch {}
      }
    };
    activeBossRoar = handle;

    throat.onended = () => {
      if (activeBossRoar === handle) activeBossRoar = null;
      release();
      safeDisconnect(nodes);
    };
    sub.start(t0);
    sub.stop(t0 + dur + 0.02);
    throat.start(t0);
    throat.stop(t0 + dur + 0.02);
    nSrc.start(t0);
    nSrc.stop(t0 + dur + 0.02);
  }

  function fallbackStanceBreak() {
    const ctx = resolveAudioContext();
    const dest = resolveFallbackTarget(ctx, true);
    if (!ctx || !dest) return;
    const poly = getPolyphonyScale(true);
    if (poly <= 0) return;

    const t0 = ctx.currentTime;
    const peak = clamp(0.92 * poly, 0.22, 1.02);
    const nodes = [];

    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(114, t0);
    sub.frequency.exponentialRampToValueAtTime(40, t0 + 0.26);
    const subG = ctx.createGain();
    subG.gain.setValueAtTime(0.0001, t0);
    subG.gain.linearRampToValueAtTime(peak, t0 + 0.005);
    subG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.52);
    sub.connect(subG);
    subG.connect(dest);
    nodes.push(sub, subG);

    const nSrc = ctx.createBufferSource();
    nSrc.buffer = getFallbackNoiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2250, t0);
    bp.Q.setValueAtTime(1.0, t0);
    const nG = ctx.createGain();
    nG.gain.setValueAtTime(peak * 0.52, t0);
    nG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
    nSrc.connect(bp);
    bp.connect(nG);
    nG.connect(dest);
    nodes.push(nSrc, bp, nG);

    const bellBus = ctx.createGain();
    bellBus.gain.setValueAtTime(0.0001, t0);
    bellBus.gain.linearRampToValueAtTime(peak * 0.48, t0 + 0.014);
    bellBus.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.85);
    bellBus.connect(dest);
    nodes.push(bellBus);

    const bellFreqs = [146.83, 220.0, 293.66, 349.23];
    let lastOsc = null;
    for (let i = 0; i < bellFreqs.length; i++) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(bellFreqs[i], t0);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.38 / (1 + i * 0.28), t0);
      o.connect(og);
      og.connect(bellBus);
      o.start(t0);
      o.stop(t0 + 0.86);
      nodes.push(o, og);
      lastOsc = o;
    }

    const rev = resolveReverbDest();
    if (rev) {
      const rG = ctx.createGain();
      rG.gain.setValueAtTime(0.42, t0);
      bellBus.connect(rG);
      rG.connect(rev);
      nodes.push(rG);
    }

    const release = trackVoiceStart(0.88);
    if (lastOsc) {
      lastOsc.onended = () => {
        release();
        safeDisconnect(nodes);
      };
    }
    sub.start(t0);
    sub.stop(t0 + 0.54);
    nSrc.start(t0);
    nSrc.stop(t0 + 0.14);
  }

  function fallbackBossRecoil() {
    const ctx = resolveAudioContext();
    const dest = resolveFallbackTarget(ctx, false);
    if (!ctx || !dest) return;
    const poly = getPolyphonyScale(false);
    if (poly <= 0) return;

    const t0 = ctx.currentTime;
    const peak = clamp(0.76 * poly, 0.12, 0.90);
    const nodes = [];

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(106, t0);
    osc.frequency.exponentialRampToValueAtTime(44, t0 + 0.26);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(480, t0);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);

    osc.connect(lp);
    lp.connect(g);
    g.connect(dest);
    nodes.push(osc, lp, g);

    const release = trackVoiceStart(0.36);
    osc.onended = () => {
      release();
      safeDisconnect(nodes);
    };
    osc.start(t0);
    osc.stop(t0 + 0.36);
  }

  function fallbackMobKnightSwing(heavy = false) {
    const ctx = resolveAudioContext();
    const dest = resolveFallbackTarget(ctx, heavy);
    if (!ctx || !dest) return;
    const poly = getPolyphonyScale(false);
    if (poly <= 0) return;

    const t0 = ctx.currentTime;
    const dur = heavy ? 0.36 : 0.24;
    const peak = clamp((heavy ? 0.38 : 0.28) * poly, 0.05, 0.44);
    const nodes = [];

    // Pure aerodynamic low-mid air displacement WHOOSH (ZERO metallic clang on misses!)
    const nSrc = ctx.createBufferSource();
    nSrc.buffer = getFallbackNoiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(heavy ? 1.05 : 1.15, t0);
    bp.frequency.setValueAtTime(heavy ? 155 : 220, t0);
    bp.frequency.exponentialRampToValueAtTime(heavy ? 500 : 680, t0 + dur * 0.36);
    bp.frequency.exponentialRampToValueAtTime(heavy ? 165 : 230, t0 + dur);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(heavy ? 1100 : 1380, t0);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + dur * 0.30);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    nSrc.connect(bp);
    bp.connect(lp);
    lp.connect(g);
    g.connect(dest);
    nodes.push(nSrc, bp, lp, g);

    const release = trackVoiceStart(dur);
    nSrc.onended = () => {
      release();
      safeDisconnect(nodes);
    };
    nSrc.start(t0);
    nSrc.stop(t0 + dur + 0.02);
  }

  function fallbackMobBowDraw() {
    const ctx = resolveAudioContext();
    const dest = resolveFallbackTarget(ctx, false);
    if (!ctx || !dest) return;
    const poly = getPolyphonyScale(false);
    if (poly <= 0) return;

    const t0 = ctx.currentTime;
    const peak = clamp(0.46 * poly, 0.06, 0.68);
    const nodes = [];

    const nSrc = ctx.createBufferSource();
    nSrc.buffer = getFallbackNoiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(3.0, t0);
    bp.frequency.setValueAtTime(680, t0);
    bp.frequency.exponentialRampToValueAtTime(1920, t0 + 0.26);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.14);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.29);

    nSrc.connect(bp);
    bp.connect(g);
    g.connect(dest);
    nodes.push(nSrc, bp, g);

    const release = trackVoiceStart(0.30);
    nSrc.onended = () => {
      release();
      safeDisconnect(nodes);
    };
    nSrc.start(t0);
    nSrc.stop(t0 + 0.30);
  }

  function fallbackMobArrowWhoosh() {
    const ctx = resolveAudioContext();
    const dest = resolveFallbackTarget(ctx, false);
    if (!ctx || !dest) return;
    const poly = getPolyphonyScale(false);
    if (poly <= 0) return;

    const t0 = ctx.currentTime;
    const peak = clamp(0.56 * poly, 0.08, 0.78);
    const nodes = [];

    const nSrc = ctx.createBufferSource();
    nSrc.buffer = getFallbackNoiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(2.0, t0);
    bp.frequency.setValueAtTime(1600, t0);
    bp.frequency.exponentialRampToValueAtTime(3500, t0 + 0.055);
    bp.frequency.exponentialRampToValueAtTime(1100, t0 + 0.22);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.035);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.23);

    nSrc.connect(bp);
    bp.connect(g);
    g.connect(dest);
    nodes.push(nSrc, bp, g);

    const release = trackVoiceStart(0.24);
    nSrc.onended = () => {
      release();
      safeDisconnect(nodes);
    };
    nSrc.start(t0);
    nSrc.stop(t0 + 0.24);
  }

  // -------------------------------------------------------------------------
  // Universal Mob Foley & Procedural Voice Fallbacks (All Existing + Future Mobs)
  // -------------------------------------------------------------------------

  function playArmorCollapseLayer(profile, distanceNorm) {
    const ctx = resolveAudioContext();
    const dest = resolveFallbackTarget(ctx, true);
    if (!ctx || !dest) return;
    const poly = getPolyphonyScale(false);
    if (poly <= 0) return;

    const d = clamp(distanceNorm, 0, 1);
    const atten = Math.pow(1 - 0.72 * d, 1.15);
    const clatterWeight = clamp(profile.armorClatter ?? 0.72, 0.25, 1.0);
    const peak = clamp(0.46 * atten * clatterWeight * poly, 0.05, 0.56);
    const lpCut = clamp(5200 * Math.pow(0.22, d) * (profile.lpScale || 1.0), 650, 7200);
    const t0 = ctx.currentTime + 0.11; // Slightly delayed after initial death wail
    const nodes = [];

    // 1. Body collapse thud on stone floor
    const thud = ctx.createOscillator();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(102 * (profile.stepPitch || 1.0), t0);
    thud.frequency.exponentialRampToValueAtTime(42, t0 + 0.14);
    const thudG = ctx.createGain();
    thudG.gain.setValueAtTime(0.0001, t0);
    thudG.gain.linearRampToValueAtTime(peak * 0.92, t0 + 0.012);
    thudG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
    thud.connect(thudG);
    thudG.connect(dest);
    nodes.push(thud, thudG);

    // 2. Staggered metallic armor / dry bone clatter bounces on cathedral stone
    const bounces = [0.02, 0.12, 0.24];
    const baseMetals = profile.isRanged
      ? [980, 1620, 2480] // Brittle bone & bow clatter
      : [640, 1180, 1940]; // Heavy forged plate clatter
    let lastNoise = null;
    for (let i = 0; i < bounces.length; i++) {
      const tb = t0 + bounces[i];
      const nSrc = ctx.createBufferSource();
      nSrc.buffer = getFallbackNoiseBuffer(ctx);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(clamp(baseMetals[i] * (profile.stepPitch || 1.0), 400, lpCut), tb);
      bp.Q.setValueAtTime(profile.isRanged ? 2.4 : 3.2, tb);

      const nG = ctx.createGain();
      const bAmp = peak * (0.68 / (1 + i * 0.55));
      nG.gain.setValueAtTime(0.0001, tb);
      nG.gain.linearRampToValueAtTime(bAmp, tb + 0.008);
      nG.gain.exponentialRampToValueAtTime(0.0001, tb + 0.13);

      nSrc.connect(bp);
      bp.connect(nG);
      nG.connect(dest);
      nSrc.start(tb);
      nSrc.stop(tb + 0.15);
      nodes.push(nSrc, bp, nG);
      lastNoise = nSrc;
    }

    const rev = resolveReverbDest();
    if (rev) {
      const rG = ctx.createGain();
      rG.gain.setValueAtTime(clamp(0.24 * atten, 0.05, 0.28), t0);
      thudG.connect(rG);
      rG.connect(rev);
      nodes.push(rG);
    }

    const release = trackVoiceStart(0.55);
    if (lastNoise) {
      lastNoise.onended = () => {
        release();
        safeDisconnect(nodes);
      };
    }
    thud.start(t0);
    thud.stop(t0 + 0.24);
  }

  function fallbackMobDeath(profile, distanceNorm) {
    const ctx = resolveAudioContext();
    const dest = resolveFallbackTarget(ctx, true);
    if (!ctx || !dest) return;
    const poly = getPolyphonyScale(true);
    if (poly <= 0) return;

    const d = clamp(distanceNorm, 0, 1);
    const atten = Math.pow(1 - 0.70 * d, 1.1);
    const pitch = profile.pitch || 1.0;
    const peak = clamp((profile.deathGain || 0.84) * 0.78 * atten * poly, 0.10, 0.90);
    const t0 = ctx.currentTime;
    const dur = 0.72;
    const nodes = [];

    // Descending guttural last-breath death wail / rasp
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(148 * pitch, t0);
    osc.frequency.exponentialRampToValueAtTime(74 * pitch, t0 + 0.36);
    osc.frequency.exponentialRampToValueAtTime(48 * pitch, t0 + dur);

    const nSrc = ctx.createBufferSource();
    nSrc.buffer = getFallbackNoiseBuffer(ctx);

    const f1 = ctx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.frequency.setValueAtTime(440 * pitch, t0);
    f1.frequency.exponentialRampToValueAtTime(240 * pitch, t0 + dur);
    f1.Q.setValueAtTime(2.6, t0);

    const f2 = ctx.createBiquadFilter();
    f2.type = 'bandpass';
    f2.frequency.setValueAtTime(1120 * pitch, t0);
    f2.frequency.exponentialRampToValueAtTime(520 * pitch, t0 + dur);
    f2.Q.setValueAtTime(3.0, t0);

    const mix = ctx.createGain();
    mix.gain.setValueAtTime(0.0001, t0);
    mix.gain.linearRampToValueAtTime(peak, t0 + 0.055);
    mix.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(f1);
    nSrc.connect(f1);
    nSrc.connect(f2);
    f1.connect(mix);
    f2.connect(mix);
    mix.connect(dest);
    nodes.push(osc, nSrc, f1, f2, mix);

    const rev = resolveReverbDest();
    if (rev) {
      const rG = ctx.createGain();
      rG.gain.setValueAtTime(clamp(0.32 * atten, 0.08, 0.36), t0);
      mix.connect(rG);
      rG.connect(rev);
      nodes.push(rG);
    }

    const release = trackVoiceStart(dur);
    osc.onended = () => {
      release();
      safeDisconnect(nodes);
    };
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
    nSrc.start(t0);
    nSrc.stop(t0 + dur + 0.02);

    playArmorCollapseLayer(profile, d);
  }

  function fallbackMobFootstep(profile, distanceNorm) {
    const ctx = resolveAudioContext();
    const dest = resolveFallbackTarget(ctx, false);
    if (!ctx || !dest) return;
    const poly = getPolyphonyScale(false);
    if (poly <= 0) return;

    const d = clamp(distanceNorm, 0, 1);
    const atten = Math.pow(1 - 0.80 * d, 1.25);
    const stepPitch = profile.stepPitch || 1.0;
    const peak = clamp((profile.stepGain || 0.46) * atten * poly, 0.03, 0.56);
    const lpCut = clamp(4800 * Math.pow(0.18, d) * (profile.lpScale || 1.0), 560, 6200);
    const t0 = ctx.currentTime;
    const nodes = [];

    // Hard stone sole strike
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(118 * stepPitch, t0);
    osc.frequency.exponentialRampToValueAtTime(54 * stepPitch, t0 + 0.055);
    const oG = ctx.createGain();
    oG.gain.setValueAtTime(0.0001, t0);
    oG.gain.linearRampToValueAtTime(peak * 0.72, t0 + 0.004);
    oG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.085);
    osc.connect(oG);
    oG.connect(dest);
    nodes.push(osc, oG);

    // Armored greave / stone scuff transient
    const nSrc = ctx.createBufferSource();
    nSrc.buffer = getFallbackNoiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(clamp(1650 * stepPitch, 480, lpCut), t0);
    bp.Q.setValueAtTime(1.4, t0);
    const nG = ctx.createGain();
    nG.gain.setValueAtTime(peak * 0.48, t0);
    nG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.065);
    nSrc.connect(bp);
    bp.connect(nG);
    nG.connect(dest);
    nodes.push(nSrc, bp, nG);

    const release = trackVoiceStart(0.11);
    osc.onended = () => {
      release();
      safeDisconnect(nodes);
    };
    osc.start(t0);
    osc.stop(t0 + 0.095);
    nSrc.start(t0);
    nSrc.stop(t0 + 0.075);
  }

  function fallbackMobAttackGrunt(profile, heavy, distanceNorm) {
    const ctx = resolveAudioContext();
    const dest = resolveFallbackTarget(ctx, heavy);
    if (!ctx || !dest) return;
    const poly = getPolyphonyScale(false);
    if (poly <= 0) return;

    const d = clamp(distanceNorm, 0, 1);
    const atten = Math.pow(1 - 0.72 * d, 1.15);
    const pitch = (profile.pitch || 1.0) * (heavy ? 0.90 : 1.0);
    const peak = clamp((profile.gruntGain || 0.72) * (heavy ? 0.84 : 0.66) * atten * poly, 0.06, 0.78);
    const t0 = ctx.currentTime;
    const dur = heavy ? 0.34 : 0.22;
    const nodes = [];

    // Muffled helmet battle-growl
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(118 * pitch, t0);
    osc.frequency.linearRampToValueAtTime(142 * pitch, t0 + dur * 0.32);
    osc.frequency.exponentialRampToValueAtTime(76 * pitch, t0 + dur);

    const nSrc = ctx.createBufferSource();
    nSrc.buffer = getFallbackNoiseBuffer(ctx);

    const f1 = ctx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.frequency.setValueAtTime(360 * pitch, t0);
    f1.Q.setValueAtTime(2.6, t0);

    const f2 = ctx.createBiquadFilter();
    f2.type = 'bandpass';
    f2.frequency.setValueAtTime(880 * pitch, t0);
    f2.Q.setValueAtTime(3.0, t0);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.032);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(f1);
    nSrc.connect(f1);
    nSrc.connect(f2);
    f1.connect(g);
    f2.connect(g);
    g.connect(dest);
    nodes.push(osc, nSrc, f1, f2, g);

    const release = trackVoiceStart(dur);
    osc.onended = () => {
      release();
      safeDisconnect(nodes);
    };
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
    nSrc.start(t0);
    nSrc.stop(t0 + dur + 0.02);
  }

  function fallbackMobHurt(profile, distanceNorm) {
    const ctx = resolveAudioContext();
    const dest = resolveFallbackTarget(ctx, false);
    if (!ctx || !dest) return;
    const poly = getPolyphonyScale(false);
    if (poly <= 0) return;

    const d = clamp(distanceNorm, 0, 1);
    const atten = Math.pow(1 - 0.72 * d, 1.15);
    const pitch = profile.pitch || 1.0;
    const peak = clamp((profile.hurtGain || 0.68) * 0.78 * atten * poly, 0.06, 0.74);
    const t0 = ctx.currentTime;
    const dur = 0.21;
    const nodes = [];

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140 * pitch, t0);
    osc.frequency.exponentialRampToValueAtTime(66 * pitch, t0 + dur);

    const nSrc = ctx.createBufferSource();
    nSrc.buffer = getFallbackNoiseBuffer(ctx);

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(520 * pitch, t0);
    bp.Q.setValueAtTime(2.2, t0);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.014);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(bp);
    nSrc.connect(bp);
    bp.connect(g);
    g.connect(dest);
    nodes.push(osc, nSrc, bp, g);

    const release = trackVoiceStart(dur);
    osc.onended = () => {
      release();
      safeDisconnect(nodes);
    };
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
    nSrc.start(t0);
    nSrc.stop(t0 + dur + 0.02);
  }

  function playMobAggroLayer(profile, distanceNorm) {
    const ctx = resolveAudioContext();
    const dest = resolveFallbackTarget(ctx, false);
    if (!ctx || !dest) return;
    const poly = getPolyphonyScale(false);
    if (poly <= 0) return;

    const d = clamp(distanceNorm, 0, 1);
    const atten = Math.pow(1 - 0.70 * d, 1.15);
    const pitch = profile.pitch || 1.0;
    const peak = clamp(0.50 * atten * poly, 0.06, 0.58);
    const t0 = ctx.currentTime;
    const nodes = [];

    // 1. Sinister muffled-helm intake / hiss
    const nSrc = ctx.createBufferSource();
    nSrc.buffer = getFallbackNoiseBuffer(ctx);
    const breathBp = ctx.createBiquadFilter();
    breathBp.type = 'bandpass';
    breathBp.frequency.setValueAtTime(420 * pitch, t0);
    breathBp.frequency.linearRampToValueAtTime(740 * pitch, t0 + 0.16);
    breathBp.Q.setValueAtTime(2.6, t0);
    const breathG = ctx.createGain();
    breathG.gain.setValueAtTime(0.0001, t0);
    breathG.gain.linearRampToValueAtTime(peak * 0.72, t0 + 0.065);
    breathG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.24);
    nSrc.connect(breathBp);
    breathBp.connect(breathG);
    breathG.connect(dest);
    nodes.push(nSrc, breathBp, breathG);

    // 2. Cold forged blade-draw ring (or dry bone-bow nock for ranged)
    const ringFreqs = profile.isRanged ? [940, 1680] : [1780, 2640, 3820];
    let lastOsc = null;
    for (let i = 0; i < ringFreqs.length; i++) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      const f0 = ringFreqs[i] * (0.94 + 0.06 * pitch);
      o.frequency.setValueAtTime(f0, t0 + 0.04);
      o.frequency.exponentialRampToValueAtTime(f0 * 1.04, t0 + 0.24);
      const oG = ctx.createGain();
      oG.gain.setValueAtTime(0.0001, t0 + 0.04);
      oG.gain.linearRampToValueAtTime(peak * (0.28 / (1 + i * 0.45)), t0 + 0.065);
      oG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.34);
      o.connect(oG);
      oG.connect(dest);
      o.start(t0 + 0.04);
      o.stop(t0 + 0.36);
      nodes.push(o, oG);
      lastOsc = o;
    }

    const rev = resolveReverbDest();
    if (rev) {
      const rG = ctx.createGain();
      rG.gain.setValueAtTime(clamp(0.24 * atten, 0.05, 0.28), t0);
      breathG.connect(rG);
      rG.connect(rev);
      nodes.push(rG);
    }

    const release = trackVoiceStart(0.38);
    if (lastOsc) {
      lastOsc.onended = () => {
        release();
        safeDisconnect(nodes);
      };
    }
    nSrc.start(t0);
    nSrc.stop(t0 + 0.26);
  }

  // -------------------------------------------------------------------------
  // Public API (Cinema-Level Boss + Universal Corridor Enemy Audio)
  // -------------------------------------------------------------------------

  function playBossHammerGroundInternal(intensity = 1.0) {
    if (!canTrigger('boss_hammer_ground', 140)) return false;
    const inten = clamp(intensity, 0.45, 1.35);
    const gain = clamp(0.96 * Math.pow(inten, 0.65), 0.72, 1.08);
    const rate = clamp(1.02 - 0.06 * inten + randRange(-0.02, 0.02), 0.86, 1.07);
    triggerMusicDuck(-4.2, 0.05, 0.58);
    const played = playFirstAvailable(['boss_hammer_ground_el', 'boss_hammer_slam'], {
      gain,
      rate,
      lowShelfDb: 3.5,
      presenceDb: 2.8,
      reverbSend: clamp(0.32 * inten, 0.22, 0.44),
      priority: true,
      stereoWide: true,
      pan: randRange(-0.07, 0.07),
      subBoost: {
        startHz: 94,
        endHz: 34,
        durationSec: 0.34,
        gain: clamp(0.28 * inten, 0.16, 0.36)
      }
    });
    if (!played) fallbackBossHammerGround(inten);
    return true;
  }

  function playMobHeavyWhooshInternal(distanceNorm = 0, pitchScale = 1.0) {
    if (!canTrigger('mob_heavy_whoosh', 120)) return false;
    const d = clamp(distanceNorm, 0, 1);
    const atten = Math.pow(1 - 0.68 * d, 1.1);
    // Pure heavy air displacement only — soft aerodynamic whoosh, ZERO metal clang or thud!
    const played = playBufferedSample('mob_heavy_whoosh', {
      gain: clamp(0.42 * atten, 0.08, 0.46),
      rate: clamp(randRange(0.94, 1.04) * pitchScale, 0.72, 1.24),
      lpFreq: clamp(1850 * Math.pow(0.28, d), 580, 1850),
      lowShelfDb: 0.6,
      presenceDb: -2.5,
      reverbSend: 0.14 + 0.08 * d,
      stereoWide: false,
      pan: randRange(-0.12, 0.12)
    });
    if (!played) fallbackMobKnightSwing(true);
    return true;
  }

  function stopBossRoarInternal(fadeSec = 0.16) {
    if (!activeBossRoar) return false;
    const handle = activeBossRoar;
    activeBossRoar = null;
    if (typeof handle.stop === 'function') {
      handle.stop(fadeSec);
      return true;
    }
    return false;
  }

  return {
    preload,

    playBossFootstep(distanceNorm = 0) {
      if (!canTrigger('boss_step', 140)) return false;
      const d = clamp(distanceNorm, 0, 1);
      // Cinema weight even at mid/far distance so the giant's stride is always felt
      const gain = clamp(0.94 * Math.pow(1 - 0.56 * d, 1.05), 0.36, 0.98);
      const lpFreq = 8400 * Math.pow(0.145, d); // ~8400 Hz close -> ~1218 Hz far
      const ctx = resolveAudioContext();
      if (ctx) preload(ctx);

      const cycle = stepCycleIdx++;
      const key =
        pickReadyFromCycle(EL_FOOTSTEP_KEYS, cycle) ||
        pickReadyFromCycle(FALLBACK_FOOTSTEP_KEYS, cycle);

      const played = key
        ? playBufferedSample(key, {
            gain,
            rate: randRange(0.95, 1.05),
            lpFreq,
            lowShelfDb: 3.0,
            presenceDb: 1.5,
            reverbSend: 0.18 + 0.24 * d,
            priority: true,
            stereoWide: false,
            pan: cycle % 2 === 0 ? -0.09 : 0.09,
            subBoost: {
              startHz: 82,
              endHz: 42,
              durationSec: 0.22,
              gain: clamp(0.20 * (1 - 0.5 * d), 0.08, 0.22)
            }
          })
        : false;
      if (!played) fallbackBossFootstep(d);
      return true;
    },

    playBossLeap() {
      if (!canTrigger('boss_leap', 260)) return false;
      triggerMusicDuck(-3.5, 0.06, 0.55);
      const hasEl = Boolean(sampleBuffers.get('boss_leap_el'));
      const played = playFirstAvailable(['boss_leap_el', 'boss_hammer_whoosh_2', 'boss_hammer_whoosh_1'], {
        gain: hasEl ? 0.98 : 0.92,
        rate: hasEl ? randRange(0.97, 1.03) : randRange(0.76, 0.84),
        lowShelfDb: 3.8,
        presenceDb: 2.2,
        reverbSend: 0.34,
        priority: true,
        stereoWide: true,
        subBoost: {
          startHz: 98,
          endHz: 38,
          durationSec: 0.28,
          gain: 0.24
        }
      });
      if (!played) fallbackBossLeap();
      return true;
    },

    playBossHammerWhoosh(heavy = false) {
      if (!canTrigger('boss_whoosh', 120)) return false;
      const isHeavy = Boolean(heavy);
      const key = whooshCycleIdx++ % 2 === 0 ? 'boss_hammer_whoosh_1' : 'boss_hammer_whoosh_2';
      // Pure colossal aerodynamic air displacement (ZERO sub-drop impact thud or metal presence!)
      const played = playBufferedSample(key, {
        gain: isHeavy ? 0.62 : 0.50,
        rate: isHeavy ? randRange(0.86, 0.94) : randRange(0.96, 1.05),
        lpFreq: isHeavy ? 1650 : 1950,
        lowShelfDb: isHeavy ? 1.8 : 1.0,
        presenceDb: -1.5,
        reverbSend: isHeavy ? 0.22 : 0.16,
        priority: true,
        stereoWide: true,
        pan: whooshCycleIdx % 2 === 0 ? -0.12 : 0.12,
        subBoost: null
      });
      if (!played) fallbackBossHammerWhoosh(isHeavy);
      return true;
    },

    playBossHammerGround(intensity = 1.0) {
      return playBossHammerGroundInternal(intensity);
    },

    playBossHammerSlam(intensity = 1.0) {
      return playBossHammerGroundInternal(intensity);
    },

    playBossHammerHit(intensity = 1.0) {
      if (!canTrigger('boss_hammer_hit', 120)) return false;
      const inten = clamp(intensity, 0.5, 1.35);
      const hasEl = Boolean(sampleBuffers.get('boss_hammer_hit_el'));
      triggerMusicDuck(-4.5, 0.04, 0.50);
      const played = playFirstAvailable(['boss_hammer_hit_el', 'boss_hammer_slam'], {
        gain: clamp((hasEl ? 1.02 : 0.96) * Math.pow(inten, 0.55), 0.78, 1.08),
        rate: hasEl ? randRange(0.96, 1.05) : randRange(1.06, 1.14),
        lowShelfDb: 3.6,
        presenceDb: 3.4,
        reverbSend: 0.28,
        priority: true,
        stereoWide: true,
        subBoost: {
          startHz: 112,
          endHz: 36,
          durationSec: 0.26,
          gain: clamp(0.28 * inten, 0.18, 0.36)
        }
      });
      if (!played) fallbackBossHammerHit(inten);
      return true;
    },

    playBossRoar() {
      if (!canTrigger('boss_roar', 420)) return false;
      stopBossRoarInternal(0.05);
      triggerMusicDuck(-5.2, 0.06, 1.15);

      // Deep, monstrous, organic Titan bellow (~1.85s souls_boss_roar_z83.wav at natural 1.0x pitch).
      // Play ONLY the sample; invoke fallbackBossRoar() strictly if the sample is not loaded yet!
      const played = playFirstAvailable(['boss_roar_z83', 'boss_roar'], {
        gain: 0.96,
        rate: randRange(0.97, 1.03),
        lpFreq: 4200,
        lowShelfDb: 2.5,
        presenceDb: 1.2,
        reverbSend: 0.38,
        priority: true,
        stereoWide: true,
        onVoiceCreated(voice) {
          let stopped = false;
          activeBossRoar = {
            ctx: voice.ctx,
            src: voice.src,
            gainNode: voice.gainNode,
            stop(fadeSec = 0.16) {
              if (stopped) return;
              stopped = true;
              const fadeDur = clamp(Number(fadeSec) || 0.16, 0.015, 1.5);
              try {
                const now = voice.ctx.currentTime;
                const gParam = voice.gainNode.gain;
                const curVal = Math.max(0.0001, gParam.value || voice.initialGain || 0.90);
                gParam.cancelScheduledValues(now);
                gParam.setValueAtTime(curVal, now);
                gParam.exponentialRampToValueAtTime(0.0001, now + fadeDur);
                voice.src.stop(now + fadeDur + 0.018);
              } catch {}
              if (typeof setTimeout === 'function') {
                voice.cleanupTimer = setTimeout(() => {
                  voice.cleanupTimer = null;
                  voice.releaseVoice();
                  safeDisconnect(voice.nodes);
                }, Math.ceil((fadeDur + 0.08) * 1000));
              }
            }
          };
        }
      });
      if (!played) fallbackBossRoar();
      return true;
    },

    stopBossRoar(fadeSec = 0.16) {
      return stopBossRoarInternal(fadeSec);
    },

    playStanceBreak() {
      if (!canTrigger('boss_stance_break', 380)) return false;
      triggerMusicDuck(-5.5, 0.05, 0.85);
      const played = playBufferedSample('boss_stance_break', {
        gain: 1.02,
        rate: randRange(0.985, 1.015),
        lowShelfDb: 2.8,
        presenceDb: 2.4,
        reverbSend: 0.42,
        priority: true,
        stereoWide: true,
        subBoost: {
          startHz: 108,
          endHz: 38,
          durationSec: 0.34,
          gain: 0.22
        }
      });
      if (!played) fallbackStanceBreak();
      return true;
    },

    playBossRecoil() {
      if (!canTrigger('boss_recoil', 170)) return false;
      const played = playBufferedSample('boss_recoil', {
        gain: 0.90,
        rate: randRange(0.95, 1.05),
        lowShelfDb: 2.5,
        presenceDb: 1.8,
        reverbSend: 0.24,
        priority: true,
        stereoWide: true
      });
      if (!played) fallbackBossRecoil();
      return true;
    },

    playMobKnightSwing(heavy = false) {
      if (heavy) return playMobHeavyWhooshInternal();
      if (!canTrigger('mob_knight_swing', 115)) return false;
      // Soft aerodynamic air-cutting whoosh (ZERO metallic clang on empty swings!)
      const played = playBufferedSample('mob_heavy_whoosh', {
        gain: 0.32,
        rate: randRange(1.26, 1.38),
        lpFreq: 1950,
        lowShelfDb: 0,
        presenceDb: -2.2,
        reverbSend: 0.12,
        stereoWide: false,
        pan: randRange(-0.12, 0.12)
      });
      if (!played) fallbackMobKnightSwing(false);
      return true;
    },

    playMobHeavyWhoosh() {
      return playMobHeavyWhooshInternal();
    },

    playMobBowDraw() {
      if (!canTrigger('mob_bow_draw', 130)) return false;
      const played = playBufferedSample('mob_bow_draw', {
        gain: 0.72,
        rate: randRange(0.95, 1.06),
        presenceDb: 1.8,
        reverbSend: 0.16,
        stereoWide: false,
        pan: randRange(-0.14, 0.14)
      });
      if (!played) fallbackMobBowDraw();
      return true;
    },

    playMobArrowWhoosh() {
      if (!canTrigger('mob_arrow_whoosh', 90)) return false;
      const played = playBufferedSample('mob_arrow_whoosh', {
        gain: 0.76,
        rate: randRange(0.94, 1.09),
        presenceDb: 1.8,
        reverbSend: 0.14,
        stereoWide: false,
        pan: randRange(-0.16, 0.16)
      });
      if (!played) fallbackMobArrowWhoosh();
      return true;
    },

    // -----------------------------------------------------------------------
    // Universal Enemy Mob Audio (Works for All Existing & Future enemyType)
    // -----------------------------------------------------------------------

    playMobDeath(enemyType = 'default', distanceNorm = 0) {
      if (!canTrigger('mob_death', 110)) return false;
      const profile = resolveMobProfile(enemyType);
      const d = clamp(distanceNorm, 0, 1);
      const atten = Math.pow(1 - 0.68 * d, 1.1);
      const gain = clamp(profile.deathGain * atten, 0.18, 0.94);
      const lpFreq = d > 0.05 ? clamp(7200 * Math.pow(0.18, d) * profile.lpScale, 750, 8800) : 0;

      const played = playFirstAvailable(['mob_death_wail_el'], {
        gain,
        rate: clamp(profile.pitch * randRange(0.96, 1.04), 0.74, 1.32),
        lpFreq,
        lowShelfDb: profile.pitch < 0.92 ? 2.8 : 1.0,
        presenceDb: 2.2,
        reverbSend: clamp(0.26 + 0.16 * d, 0.20, 0.42),
        priority: true,
        stereoWide: true,
        pan: randRange(-0.16, 0.16)
      });

      if (played) {
        // Layer falling armor plate / bone collapse onto stone floor right behind death wail
        playArmorCollapseLayer(profile, d);
      } else {
        fallbackMobDeath(profile, d);
      }
      return true;
    },

    playMobFootstep(enemyType = 'default', distanceNorm = 0, actorId = null) {
      if (activeVoices >= 12) return false;
      const d = clamp(distanceNorm, 0, 1);
      // Hard distance cutoff: only nearby mobs (< 12 m at 16 m norm) produce footsteps
      if (d >= MOB_AUDIO_ANTISPAM.footstepMaxDistNorm) return false;
      // Strict global anti-spam cooldown (>= 480 ms) so corridor squads never clatter
      if (!canTrigger('mob_step_global', MOB_AUDIO_ANTISPAM.footstepGlobalMs)) return false;

      const { profile, actorId: resolvedId } = resolveMobInput(enemyType, actorId);
      const dLocal = clamp(d / MOB_AUDIO_ANTISPAM.footstepMaxDistNorm, 0, 1);
      const instPitch = resolveInstancePitchScale(resolvedId);
      // Soft atmospheric presence (0.26..0.38 close -> 0.05 near 12 m cutoff)
      const atten = Math.pow(1 - 0.84 * dLocal, 1.25);
      const gain = clamp(profile.stepGain * atten, 0.04, 0.38);
      const lpFreq = clamp(5200 * Math.pow(0.18, dLocal) * profile.lpScale, 720, 6200);

      const ctx = resolveAudioContext();
      if (ctx) preload(ctx);

      const cycle = mobStepCycleIdx++;
      const key = pickReadyFromCycle(MOB_FOOTSTEP_KEYS, cycle);
      const played = key
        ? playBufferedSample(key, {
            gain,
            rate: clamp(profile.stepPitch * instPitch * randRange(0.95, 1.05), 0.76, 1.32),
            lpFreq,
            lowShelfDb: profile.pitch < 0.92 ? 1.5 : 0,
            reverbSend: 0.12 + 0.18 * dLocal,
            priority: false,
            stereoWide: false,
            pan: randRange(-0.22, 0.22)
          })
        : false;
      if (!played) fallbackMobFootstep(profile, dLocal);
      return true;
    },

    playMobAttackGrunt(enemyType = 'default', heavy = false, distanceNorm = 0, actorId = null) {
      const { profile, actorId: resolvedId } = resolveMobInput(enemyType, actorId);
      const isHeavy = Boolean(heavy);
      const d = clamp(distanceNorm, 0, 1);
      const atten = Math.pow(1 - 0.68 * d, 1.15);
      const lpFreq = d > 0.05 ? clamp(5200 * Math.pow(0.20, d) * profile.lpScale, 700, 6200) : 4800;
      const instPitch = resolveInstancePitchScale(resolvedId);

      // Strict anti-spam vocal grunt gating ONLY (zero premature swing sound during windup!):
      //   - 0% on normal attacks, 32% on heavy attacks (no constant screaming on every swing!)
      //   - Global >= 2400 ms, Per-mob >= 4200 ms
      let vocalPlayed = false;
      const chance = isHeavy ? MOB_AUDIO_ANTISPAM.attackGruntHeavyChance : MOB_AUDIO_ANTISPAM.attackGruntNormalChance;
      const passChance = Math.random() < chance;
      if (d < 0.85 && passChance) {
        const mobKey = `mob_attack_grunt_mob_${resolvedId != null ? resolvedId : profile.id}`;
        if (
          canTriggerPair(
            'mob_attack_grunt_global',
            MOB_AUDIO_ANTISPAM.attackGruntGlobalMs,
            mobKey,
            MOB_AUDIO_ANTISPAM.attackGruntPerMobMs
          )
        ) {
          const ctx = resolveAudioContext();
          if (ctx) preload(ctx);

          const gain = clamp(profile.gruntGain * 0.62 * atten, 0.10, 0.54);
          const rate = clamp(
            profile.pitch * instPitch * (isHeavy ? 0.90 : 0.96) * randRange(0.95, 1.05),
            0.72,
            1.28
          );
          const gruntKey = pickNonRepeatingGruntKey();
          const ok = gruntKey
            ? playBufferedSample(gruntKey, {
                gain,
                rate,
                lpFreq,
                lowShelfDb: 1.5,
                presenceDb: 0.8,
                reverbSend: 0.20 + 0.12 * d,
                stereoWide: false,
                pan: randRange(-0.16, 0.16)
              })
            : false;
          if (!ok) fallbackMobAttackGrunt(profile, isHeavy, d);
          vocalPlayed = true;
        }
      }

      return vocalPlayed;
    },

    playMobHurt(enemyType = 'default', distanceNorm = 0, actorId = null) {
      const d = clamp(distanceNorm, 0, 1);
      if (d >= 0.95) return false;
      // Strict anti-spam cooldown (>= 420 ms) so rapid multi-hit combos never spam hurt groans
      if (!canTrigger('mob_hurt', MOB_AUDIO_ANTISPAM.hurtGlobalMs)) return false;

      const { profile, actorId: resolvedId } = resolveMobInput(enemyType, actorId);
      const instPitch = resolveInstancePitchScale(resolvedId);
      const atten = Math.pow(1 - 0.70 * d, 1.15);
      const gain = clamp(profile.hurtGain * atten, 0.14, 0.78);
      const lpFreq = d > 0.05 ? clamp(6800 * Math.pow(0.19, d) * profile.lpScale, 750, 8200) : 0;

      const played = playFirstAvailable(['mob_hurt_grunt_el'], {
        gain,
        rate: clamp(profile.pitch * instPitch * randRange(0.95, 1.06), 0.76, 1.34),
        lpFreq,
        presenceDb: 1.8,
        reverbSend: 0.16 + 0.10 * d,
        stereoWide: false,
        pan: randRange(-0.16, 0.16)
      });
      if (!played) fallbackMobHurt(profile, d);
      return true;
    },

    playMobAggro(enemyType = 'default', distanceNorm = 0, actorId = null) {
      if (!canTrigger('mob_aggro', 420)) return false;
      const { profile, actorId: resolvedId } = resolveMobInput(enemyType, actorId);
      const instPitch = resolveInstancePitchScale(resolvedId);
      const d = clamp(distanceNorm, 0, 1);
      const atten = Math.pow(1 - 0.68 * d, 1.1);

      const ctx = resolveAudioContext();
      if (ctx) preload(ctx);
      const gruntKey = pickNonRepeatingGruntKey();
      if (gruntKey) {
        playBufferedSample(gruntKey, {
          gain: clamp(0.44 * atten, 0.10, 0.52),
          rate: clamp(profile.pitch * instPitch * 0.88 * randRange(0.96, 1.04), 0.72, 1.24),
          lpFreq: clamp(2200 * profile.lpScale, 900, 3200),
          reverbSend: 0.24,
          stereoWide: false,
          pan: randRange(-0.18, 0.18)
        });
      }
      playMobAggroLayer(profile, d);
      return true;
    },

    dispose() {
      stopBossRoarInternal(0.02);
      safeDisconnect(busNodes);
      busNodes = [];
      busCtx = null;
      busDest = null;
      bossCinemaIn = null;
      bossStereoWideIn = null;
      sampleBuffers.clear();
      sampleState.clear();
      sampleMissingAt.clear();
      fallbackNoiseCtx = null;
      fallbackNoiseBuf = null;
    }
  };
}
