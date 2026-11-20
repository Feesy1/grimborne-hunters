// Dynamic Soundtrack Manager for Grimborne Hunters (Abandoned Knight Rift)
// Clean Vanilla ES Module: seamless Web Audio looping, 1.8s crossfades,
// combat ducking (parry / stance break / boss roar), and Yandex Games ad/visibility suspend compliance.

export const SOULS_MUSIC_VERSION = '20261120z61';
export const SOULS_MUSIC_SLOTS = Object.freeze([
  'hub',
  'rift_explore',
  'boss_phase1',
  'boss_phase2',
  'off'
]);
export const SOULS_MUSIC_DEFAULT_CROSSFADE_SEC = 1.8;

const VALID_SLOTS = new Set(SOULS_MUSIC_SLOTS);
const PLAYABLE_SLOTS = new Set(['hub', 'rift_explore', 'boss_phase1', 'boss_phase2']);

const DEFAULT_TRACK_URLS = Object.freeze({
  hub: '',
  rift_explore: '',
  boss_phase1: '',
  boss_phase2: ''
});

function safeGet(fn) {
  if (typeof fn !== 'function') return null;
  try {
    return fn() || null;
  } catch {
    return null;
  }
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function dbToLinear(db) {
  return Math.pow(10, clamp(Number(db) || 0, -48, 0) / 20);
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

function normalizeSlot(slot) {
  const s = String(slot || 'off').trim().toLowerCase();
  return VALID_SLOTS.has(s) ? s : 'off';
}

export function createSoulsMusicManager({
  getCtx,
  getMusicDest,
  tracks = null,
  crossfadeSec = SOULS_MUSIC_DEFAULT_CROSSFADE_SEC,
  initialVolume = 0.72
} = {}) {
  const trackUrls = Object.assign(Object.create(null), DEFAULT_TRACK_URLS);
  if (tracks && typeof tracks === 'object') {
    for (const slot of PLAYABLE_SLOTS) {
      if (typeof tracks[slot] === 'string' && tracks[slot].trim()) {
        trackUrls[slot] = tracks[slot].trim();
      }
    }
  }

  // Decoded AudioBuffer cache keyed by resolved URL (invalidated if AudioContext changes)
  let bufferCtxRef = null;
  const buffersByUrl = new Map();     // url -> AudioBuffer
  const pendingByUrl = new Map();     // url -> Promise<AudioBuffer|null>

  // Shared Web Audio bus: voiceGain -> duckGain -> busGain -> musicDest
  let busCtxRef = null;
  let busDestRef = null;
  let duckGain = null;
  let busGain = null;

  // Ducking envelope state
  let duckReleaseTimer = null;
  let duckDepthLinear = 1.0;
  let duckHoldUntilSec = 0;

  // Manager playback state
  let currentSlot = 'off';
  let volume = clamp(Number.isFinite(Number(initialVolume)) ? Number(initialVolume) : 0.72, 0, 1);
  let muted = false;
  let suspended = false;
  let disposed = false;
  let defaultCrossfade = Math.max(0.05, Number(crossfadeSec) || SOULS_MUSIC_DEFAULT_CROSSFADE_SEC);

  // Active and fading voices
  // Voice shape: { slot, url, buffer, source, gain, startedAtCtx, offsetAtStart, loopStart, loopEnd, stopTimer, stopped }
  let activeVoice = null;
  const fadingVoices = new Set();

  // Suspended playback position memory so tab hide / Yandex ad resumes seamlessly
  let pausedSlot = null;
  let pausedOffsetSec = 0;

  // Monotonic token to ignore stale async decodes when slot changes rapidly
  let transitionToken = 0;

  function ensureBus(ctx) {
    if (!ctx || disposed) return null;
    const dest = safeGet(getMusicDest) || ctx.destination;
    if (!dest) return null;

    if (busCtxRef !== ctx) {
      teardownBus();
      busCtxRef = ctx;
      busDestRef = dest;

      duckGain = ctx.createGain();
      duckGain.gain.setValueAtTime(1.0, ctx.currentTime);

      busGain = ctx.createGain();
      busGain.gain.setValueAtTime(computeBusTargetGain(), ctx.currentTime);

      duckGain.connect(busGain);
      busGain.connect(dest);
      return duckGain;
    }

    if (busDestRef !== dest && busGain) {
      try { busGain.disconnect(); } catch {}
      try { busGain.connect(dest); } catch {}
      busDestRef = dest;
    }

    return duckGain;
  }

  function teardownBus() {
    if (duckReleaseTimer !== null) {
      clearTimeout(duckReleaseTimer);
      duckReleaseTimer = null;
    }
    try { duckGain?.disconnect(); } catch {}
    try { busGain?.disconnect(); } catch {}
    duckGain = null;
    busGain = null;
    busCtxRef = null;
    busDestRef = null;
    duckDepthLinear = 1.0;
    duckHoldUntilSec = 0;
  }

  function computeBusTargetGain() {
    if (disposed || muted || suspended) return 0.0;
    return clamp(volume, 0, 1);
  }

  function syncBusGain(rampSec = 0.08) {
    const ctx = safeGet(getCtx);
    if (!ctx || !busGain || busCtxRef !== ctx) return;
    const now = ctx.currentTime;
    const target = computeBusTargetGain();
    try {
      busGain.gain.cancelScheduledValues(now);
      const currentVal = Number.isFinite(busGain.gain.value) ? busGain.gain.value : target;
      busGain.gain.setValueAtTime(currentVal, now);
      if (rampSec > 0.005) {
        busGain.gain.linearRampToValueAtTime(target, now + rampSec);
      } else {
        busGain.gain.setValueAtTime(target, now);
      }
    } catch {
      try { busGain.gain.value = target; } catch {}
    }
  }

  function getVoicePositionSec(voice, ctx) {
    if (!voice || !voice.buffer || !ctx) return 0;
    const dur = voice.buffer.duration;
    if (!Number.isFinite(dur) || dur <= 0.01) return 0;
    const elapsed = Math.max(0, ctx.currentTime - voice.startedAtCtx);
    const rawPos = (voice.offsetAtStart || 0) + elapsed;
    const loopEnd = voice.loopEnd > 0 ? voice.loopEnd : dur;
    const loopStart = clamp(voice.loopStart || 0, 0, Math.max(0, loopEnd - 0.01));
    if (rawPos < loopEnd) return rawPos;
    const loopSpan = Math.max(0.01, loopEnd - loopStart);
    return loopStart + ((rawPos - loopStart) % loopSpan);
  }

  function destroyVoice(voice) {
    if (!voice || voice.stopped) return;
    voice.stopped = true;
    if (voice.stopTimer !== null) {
      clearTimeout(voice.stopTimer);
      voice.stopTimer = null;
    }
    fadingVoices.delete(voice);
    if (activeVoice === voice) {
      activeVoice = null;
    }
    try { voice.source.onended = null; } catch {}
    try { voice.source.stop(); } catch {}
    try { voice.source.disconnect(); } catch {}
    try { voice.gain.disconnect(); } catch {}
  }

  function fadeOutVoice(voice, fadeSec) {
    if (!voice || voice.stopped) return;
    const ctx = safeGet(getCtx);
    const dur = Math.max(0.02, Number(fadeSec) || 0.05);

    if (activeVoice === voice) {
      activeVoice = null;
    }
    fadingVoices.add(voice);

    if (!ctx || busCtxRef !== ctx) {
      destroyVoice(voice);
      return;
    }

    const now = ctx.currentTime;
    try {
      voice.gain.gain.cancelScheduledValues(now);
      const cur = Number.isFinite(voice.gain.gain.value) ? voice.gain.gain.value : 0;
      voice.gain.gain.setValueAtTime(Math.max(0, cur), now);
      voice.gain.gain.linearRampToValueAtTime(0.0, now + dur);
    } catch {
      destroyVoice(voice);
      return;
    }

    if (voice.stopTimer !== null) {
      clearTimeout(voice.stopTimer);
    }
    voice.stopTimer = setTimeout(() => {
      destroyVoice(voice);
    }, Math.ceil((dur + 0.08) * 1000));
  }

  function startVoice(slot, url, buffer, {
    fadeInSec = defaultCrossfade,
    offsetSec = 0,
    loopStart = 0,
    loopEnd = 0
  } = {}) {
    const ctx = safeGet(getCtx);
    if (!ctx || !buffer || disposed) return null;
    const dest = ensureBus(ctx);
    if (!dest) return null;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const safeDur = Math.max(0.01, buffer.duration || 0.01);
    const safeLoopEnd = loopEnd > 0 && loopEnd <= safeDur ? loopEnd : safeDur;
    const safeLoopStart = clamp(loopStart || 0, 0, Math.max(0, safeLoopEnd - 0.01));
    if (safeLoopStart > 0 || safeLoopEnd < safeDur) {
      src.loopStart = safeLoopStart;
      src.loopEnd = safeLoopEnd;
    }

    const gainNode = ctx.createGain();
    const now = ctx.currentTime;
    const durFade = Math.max(0.0, Number(fadeInSec) || 0);
    if (durFade > 0.01) {
      gainNode.gain.setValueAtTime(0.0, now);
      gainNode.gain.linearRampToValueAtTime(1.0, now + durFade);
    } else {
      gainNode.gain.setValueAtTime(1.0, now);
    }

    src.connect(gainNode);
    gainNode.connect(dest);

    const safeOffset = ((Number(offsetSec) || 0) % safeDur + safeDur) % safeDur;
    const voice = {
      slot,
      url,
      buffer,
      source: src,
      gain: gainNode,
      startedAtCtx: now,
      offsetAtStart: safeOffset,
      loopStart: safeLoopStart,
      loopEnd: safeLoopEnd,
      stopTimer: null,
      stopped: false
    };

    src.onended = () => {
      if (!voice.stopped) {
        destroyVoice(voice);
      }
    };

    try {
      src.start(now, safeOffset);
    } catch {
      destroyVoice(voice);
      return null;
    }

    activeVoice = voice;
    syncBusGain(0.04);
    return voice;
  }

  function loadBufferForUrl(url, audioCtxOverride = null) {
    if (!url || disposed || typeof fetch === 'undefined') {
      return Promise.resolve(null);
    }
    const ctx = audioCtxOverride || safeGet(getCtx);
    if (!ctx) return Promise.resolve(null);

    if (bufferCtxRef !== ctx) {
      buffersByUrl.clear();
      pendingByUrl.clear();
      bufferCtxRef = ctx;
    }

    const cached = buffersByUrl.get(url);
    if (cached) return Promise.resolve(cached);

    const inflight = pendingByUrl.get(url);
    if (inflight) return inflight;

    const promise = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} loading music track ${url}`);
        return res.arrayBuffer();
      })
      .then((ab) => {
        if (disposed || bufferCtxRef !== ctx) return null;
        return decodeAudioBuffer(ctx, ab);
      })
      .then((decoded) => {
        pendingByUrl.delete(url);
        if (decoded && !disposed && bufferCtxRef === ctx) {
          buffersByUrl.set(url, decoded);
          return decoded;
        }
        return null;
      })
      .catch(() => {
        pendingByUrl.delete(url);
        return null;
      });

    pendingByUrl.set(url, promise);
    return promise;
  }

  async function setSlot(slot, {
    crossfadeSec: fadeOverride,
    restart = false,
    offsetSec = 0
  } = {}) {
    if (disposed) return false;
    const nextSlot = normalizeSlot(slot);
    const fadeSec = Number.isFinite(Number(fadeOverride))
      ? Math.max(0.05, Number(fadeOverride))
      : defaultCrossfade;

    const prevSlot = currentSlot;
    currentSlot = nextSlot;
    const token = ++transitionToken;

    if (nextSlot === 'off') {
      pausedSlot = null;
      pausedOffsetSec = 0;
      if (activeVoice) fadeOutVoice(activeVoice, Math.min(fadeSec, 1.2));
      return true;
    }

    // If suspended or muted, record intent so resume/unmute starts this slot
    if (suspended) {
      if (activeVoice) fadeOutVoice(activeVoice, 0.12);
      pausedSlot = nextSlot;
      pausedOffsetSec = Math.max(0, Number(offsetSec) || 0);
      return true;
    }

    const url = trackUrls[nextSlot];
    if (!url) {
      if (activeVoice) fadeOutVoice(activeVoice, Math.min(fadeSec, 0.8));
      return false;
    }

    // Already playing this exact slot & track?
    if (
      !restart &&
      activeVoice &&
      !activeVoice.stopped &&
      activeVoice.slot === nextSlot &&
      activeVoice.url === url
    ) {
      syncBusGain(0.12);
      return true;
    }

    const ctx = safeGet(getCtx);
    if (!ctx) {
      // Context not created yet; keep currentSlot so unlock()/resume() can start it
      pausedSlot = nextSlot;
      pausedOffsetSec = Math.max(0, Number(offsetSec) || 0);
      return false;
    }

    const buffer = await loadBufferForUrl(url, ctx);
    // Abort if another transition happened, manager disposed, or suspended while fetching
    if (disposed || token !== transitionToken || currentSlot !== nextSlot) {
      return false;
    }
    if (!buffer) {
      if (activeVoice && prevSlot !== nextSlot) {
        fadeOutVoice(activeVoice, Math.min(fadeSec, 0.8));
      }
      return false;
    }
    if (suspended) {
      pausedSlot = nextSlot;
      pausedOffsetSec = Math.max(0, Number(offsetSec) || 0);
      return true;
    }

    const outgoing = activeVoice;
    const incomingFade = outgoing ? fadeSec : Math.min(fadeSec, 1.2);
    const resumeOffset = (pausedSlot === nextSlot && offsetSec === 0) ? pausedOffsetSec : offsetSec;
    pausedSlot = null;
    pausedOffsetSec = 0;

    if (outgoing) {
      fadeOutVoice(outgoing, fadeSec);
    }

    startVoice(nextSlot, url, buffer, {
      fadeInSec: incomingFade,
      offsetSec: resumeOffset
    });
    return true;
  }

  /**
   * Combat Ducking: smoothly attenuates music during high-impact Souls cues
   * (parry clang, stance break, boss phase roar, riposte).
   */
  function duck(db = -5, holdSec = 0.45, releaseSec = 0.65) {
    if (disposed) return;
    const ctx = safeGet(getCtx);
    if (!ctx) return;
    const dest = ensureBus(ctx);
    if (!dest || !duckGain) return;

    const targetLinear = dbToLinear(db);
    const hold = clamp(Number(holdSec) || 0.45, 0.05, 5.0);
    const release = clamp(Number(releaseSec) || 0.65, 0.08, 5.0);
    const attack = 0.045;
    const now = ctx.currentTime;

    // If already ducked deeper, preserve deeper attenuation until hold expires
    const effectiveLinear = now < duckHoldUntilSec
      ? Math.min(duckDepthLinear, targetLinear)
      : targetLinear;
    const holdEnd = Math.max(duckHoldUntilSec, now + attack + hold);

    duckDepthLinear = effectiveLinear;
    duckHoldUntilSec = holdEnd;

    if (duckReleaseTimer !== null) {
      clearTimeout(duckReleaseTimer);
      duckReleaseTimer = null;
    }

    try {
      duckGain.gain.cancelScheduledValues(now);
      const cur = Number.isFinite(duckGain.gain.value) ? duckGain.gain.value : 1.0;
      duckGain.gain.setValueAtTime(clamp(cur, 0.001, 1.0), now);
      duckGain.gain.linearRampToValueAtTime(effectiveLinear, now + attack);
      duckGain.gain.setValueAtTime(effectiveLinear, holdEnd);
      duckGain.gain.linearRampToValueAtTime(1.0, holdEnd + release);
    } catch {
      try { duckGain.gain.value = 1.0; } catch {}
    }

    const totalMs = Math.ceil(((holdEnd + release) - now) * 1000) + 40;
    duckReleaseTimer = setTimeout(() => {
      duckReleaseTimer = null;
      duckDepthLinear = 1.0;
      duckHoldUntilSec = 0;
    }, Math.max(50, totalMs));
  }

  function setVolume(val) {
    const num = Number(val);
    if (!Number.isFinite(num)) return volume;
    volume = clamp(num, 0, 1);
    syncBusGain(0.08);
    return volume;
  }

  function getVolume() {
    return volume;
  }

  function setMuted(bool) {
    const nextMuted = Boolean(bool);
    if (muted === nextMuted) return muted;
    muted = nextMuted;
    syncBusGain(0.08);
    return muted;
  }

  function isMuted() {
    return muted;
  }

  function setSuspended(bool) {
    const nextSuspended = Boolean(bool);
    if (suspended === nextSuspended) return suspended;
    suspended = nextSuspended;

    const ctx = safeGet(getCtx);
    if (suspended) {
      // Capture exact playback position before smoothly pausing for tab hide / Yandex ad
      if (activeVoice && !activeVoice.stopped) {
        pausedSlot = activeVoice.slot;
        pausedOffsetSec = getVoicePositionSec(activeVoice, ctx);
        fadeOutVoice(activeVoice, 0.08);
      } else if (PLAYABLE_SLOTS.has(currentSlot)) {
        pausedSlot = currentSlot;
      }
      for (const v of Array.from(fadingVoices)) {
        fadeOutVoice(v, 0.06);
      }
      syncBusGain(0.06);
    } else {
      syncBusGain(0.18);
      if (PLAYABLE_SLOTS.has(currentSlot)) {
        const resumeAt = pausedSlot === currentSlot ? pausedOffsetSec : 0;
        setSlot(currentSlot, { crossfadeSec: 0.45, restart: true, offsetSec: resumeAt });
      }
    }
    return suspended;
  }

  function isSuspended() {
    return suspended;
  }

  function setTrackUrl(slot, url) {
    const s = normalizeSlot(slot);
    if (!PLAYABLE_SLOTS.has(s)) return false;
    trackUrls[s] = typeof url === 'string' ? url.trim() : '';
    return true;
  }

  function setTracks(map) {
    if (!map || typeof map !== 'object') return;
    for (const slot of PLAYABLE_SLOTS) {
      if (typeof map[slot] === 'string') {
        trackUrls[slot] = map[slot].trim();
      }
    }
  }

  function getTrackUrls() {
    return {
      hub: trackUrls.hub,
      rift_explore: trackUrls.rift_explore,
      boss_phase1: trackUrls.boss_phase1,
      boss_phase2: trackUrls.boss_phase2
    };
  }

  async function loadFromManifest(manifestUrl, selectionBySlot = null) {
    if (!manifestUrl || typeof fetch === 'undefined') return false;
    try {
      const res = await fetch(manifestUrl);
      if (!res.ok) return false;
      const data = await res.json();
      const items = Array.isArray(data) ? data : (Array.isArray(data?.tracks) ? data.tracks : []);
      for (const slot of PLAYABLE_SLOTS) {
        const wantedId = selectionBySlot && selectionBySlot[slot];
        let match = null;
        if (wantedId) {
          match = items.find((item) => item && item.id === wantedId && item.file);
        }
        if (!match) {
          match = items.find((item) => item && item.slot === slot && item.file);
        }
        if (match && typeof match.file === 'string') {
          trackUrls[slot] = match.file;
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  function preload(slotOrCtx = null) {
    if (disposed) return Promise.resolve([]);
    let targetSlots = Array.from(PLAYABLE_SLOTS);
    let ctxOverride = null;

    if (typeof slotOrCtx === 'string') {
      const s = normalizeSlot(slotOrCtx);
      targetSlots = PLAYABLE_SLOTS.has(s) ? [s] : [];
    } else if (slotOrCtx && typeof slotOrCtx.decodeAudioData === 'function') {
      ctxOverride = slotOrCtx;
    }

    const jobs = [];
    for (const s of targetSlots) {
      const url = trackUrls[s];
      if (url) {
        jobs.push(loadBufferForUrl(url, ctxOverride));
      }
    }
    return Promise.all(jobs);
  }

  function unlock() {
    const ctx = safeGet(getCtx);
    if (!ctx || disposed) return;
    ensureBus(ctx);
    syncBusGain(0.08);
    if (!suspended && PLAYABLE_SLOTS.has(currentSlot) && (!activeVoice || activeVoice.stopped)) {
      const resumeAt = pausedSlot === currentSlot ? pausedOffsetSec : 0;
      setSlot(currentSlot, { crossfadeSec: 0.8, restart: true, offsetSec: resumeAt });
    }
  }

  function stop(fadeOutSec = 0.6) {
    return setSlot('off', { crossfadeSec: fadeOutSec });
  }

  function getSlot() {
    return currentSlot;
  }

  function getState() {
    return {
      slot: currentSlot,
      activeTrackUrl: activeVoice && !activeVoice.stopped ? activeVoice.url : null,
      volume,
      muted,
      suspended,
      crossfadeSec: defaultCrossfade,
      cachedTracks: buffersByUrl.size,
      isPlaying: Boolean(activeVoice && !activeVoice.stopped && !suspended && !muted)
    };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    transitionToken++;
    if (activeVoice) destroyVoice(activeVoice);
    for (const v of Array.from(fadingVoices)) {
      destroyVoice(v);
    }
    teardownBus();
    buffersByUrl.clear();
    pendingByUrl.clear();
    bufferCtxRef = null;
  }

  return {
    setSlot,
    play: setSlot,
    stop,
    duck,
    setVolume,
    getVolume,
    setMuted,
    isMuted,
    setSuspended,
    isSuspended,
    setTrackUrl,
    setTracks,
    getTrackUrls,
    loadFromManifest,
    preload,
    unlock,
    getSlot,
    getState,
    dispose
  };
}
