// Seamless ambient video backdrop.
//
// The original clip keeps its exact content and playback speed. Instead of
// jumping back to frame 0 with `loop`, two copies of the same video are
// stacked. A few hundred milliseconds before the active copy ends, the second
// one starts from the beginning and the two layers cross-fade. To the eye the
// scene simply keeps moving — there is no visible restart.
//
// Usage:
//   const loop = attachSeamlessLoop(videoEl, { fadeSec: 1.2 });
//   loop.play();   // resume without rewinding
//   loop.pause();  // freeze both layers, keep currentTime
//   loop.destroy();

const DEFAULT_FADE_SEC = 1.2;

export function attachSeamlessLoop(primary, options = {}) {
  if (!primary || !primary.parentNode) return null;

  const fadeSec = Math.max(0.25, Number(options.fadeSec) || DEFAULT_FADE_SEC);
  const parent = primary.parentNode;

  // --- Build the second layer as an exact twin of the first one -----------
  const secondary = document.createElement('video');
  for (const attr of primary.attributes) {
    const name = attr.name;
    if (name === 'id' || name === 'loop' || name === 'autoplay' || name === 'style') continue;
    secondary.setAttribute(name, attr.value);
  }
  secondary.removeAttribute('id');
  secondary.className = `${primary.className} seamless-video-layer`.trim();
  primary.classList.add('seamless-video-layer');

  primary.loop = false;
  secondary.loop = false;
  primary.muted = true;
  secondary.muted = true;
  primary.playsInline = true;
  secondary.playsInline = true;
  primary.autoplay = false;
  secondary.autoplay = false;
  secondary.preload = 'auto';

  const transitionCss = `opacity ${fadeSec}s linear`;
  secondary.style.opacity = '0';
  primary.style.opacity = '1';
  primary.style.transition = transitionCss;
  secondary.style.transition = transitionCss;

  // The incoming layer is inserted after the active one, so during the fade it
  // paints on top. Vignettes/pins appended later by the caller still stay above.
  parent.insertBefore(secondary, primary.nextSibling);

  let active = primary;
  let standby = secondary;
  let playing = false;
  let rafId = 0;
  let swapTimer = 0;
  let crossfading = false;
  let retryArmed = false;

  function layerDuration(video) {
    const d = Number(video && video.duration);
    return Number.isFinite(d) && d > 0 ? d : 0;
  }

  function getDuration() {
    return layerDuration(active) || layerDuration(standby);
  }

  function finishSwap() {
    if (!crossfading) return;
    crossfading = false;
    clearTimeout(swapTimer);
    swapTimer = 0;

    const outgoing = active;
    active = standby;
    standby = outgoing;

    // The fade has already finished, so snap both layers to their final
    // opacity with transitions disabled. Otherwise the outgoing copy can stay
    // half-visible for a moment and ghost over the incoming frame.
    outgoing.style.transition = 'none';
    active.style.transition = 'none';
    outgoing.style.opacity = '0';
    active.style.opacity = '1';
    void outgoing.offsetWidth; // flush, then restore the cross-fade transition
    outgoing.style.transition = transitionCss;
    active.style.transition = transitionCss;

    outgoing.pause();
    try { outgoing.currentTime = 0; } catch {}
  }

  function beginCrossfade() {
    if (crossfading) return;
    const duration = getDuration();
    if (!duration) return;

    crossfading = true;
    try { standby.currentTime = 0; } catch {}

    const started = standby.play();
    if (started && typeof started.catch === 'function') started.catch(() => {});

    // Force a style flush so the browser animates 0 -> 1 instead of snapping.
    void standby.offsetWidth;
    standby.style.opacity = '1';
    active.style.opacity = '0';

    swapTimer = setTimeout(finishSwap, fadeSec * 1000 + 80);
  }

  function tick() {
    if (!playing) return;

    const duration = getDuration();
    // Start slightly early so the fade is completely over before the clip's
    // `ended` event can fire — no race, no half-finished cross-fade.
    if (!crossfading && duration && active.currentTime >= duration - fadeSec - 0.2) {
      beginCrossfade();
    }
    // Safety net: if the browser hit the end early, do not leave a black frame.
    if (crossfading && active.ended) finishSwap();

    rafId = requestAnimationFrame(tick);
  }

  function onEnded(event) {
    if (!playing) return;
    if (event.target === active && !crossfading) beginCrossfade();
    else if (event.target === active && crossfading) finishSwap();
  }

  primary.addEventListener('ended', onEnded);
  secondary.addEventListener('ended', onEnded);

  function play() {
    if (playing) return;
    playing = true;

    const started = active.play();
    if (started && typeof started.catch === 'function') {
      started.catch(() => {
        // Some browsers still require a gesture before allowing playback.
        if (playing && !retryArmed) {
          retryArmed = true;
          const retry = () => {
            retryArmed = false;
            if (playing) {
              const retryPlay = active.play();
              if (retryPlay && retryPlay.catch) retryPlay.catch(() => {});
            }
          };
          document.addEventListener('pointerdown', retry, { once: true, passive: true });
        }
      });
    }

    if (!rafId) rafId = requestAnimationFrame(tick);
  }

  function pause() {
    if (!playing) return;
    if (crossfading) finishSwap();
    playing = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    active.pause();
    standby.pause();
  }

  function destroy() {
    pause();
    clearTimeout(swapTimer);
    primary.removeEventListener('ended', onEnded);
    secondary.removeEventListener('ended', onEnded);
    primary.classList.remove('seamless-video-layer');
    primary.style.transition = '';
    primary.style.opacity = '';
    if (secondary.parentNode) secondary.parentNode.removeChild(secondary);
  }

  return { play, pause, destroy, get active() { return active; } };
}
