// Yandex Games SDK v2 wrapper with full moderation compliance & seamless local fallback
// Storage key: 'grimborne_save_v1'

const STORAGE_KEY = 'grimborne_save_v1';

function safeReadLocal() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function safeWriteLocal(data) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

function mergeSavePayloads(localData, cloudData) {
  if (!localData && !cloudData) return {};
  if (!localData) return { ...cloudData };
  if (!cloudData) return { ...localData };

  const localTs = Number(localData.updatedAt || 0);
  const cloudTs = Number(cloudData.updatedAt || 0);
  const primary = cloudTs > localTs ? cloudData : localData;
  const secondary = cloudTs > localTs ? localData : cloudData;

  const merged = {
    ...secondary,
    ...primary
  };

  // Preserve union of unlocked weapons as object map { [weaponId]: true } (or array if both arrays)
  if (Array.isArray(localData.unlockedWeapons) && Array.isArray(cloudData.unlockedWeapons)) {
    merged.unlockedWeapons = Array.from(new Set([...localData.unlockedWeapons, ...cloudData.unlockedWeapons]));
  } else if (localData.unlockedWeapons || cloudData.unlockedWeapons) {
    const map = {};
    const absorb = (src) => {
      if (!src) return;
      if (Array.isArray(src)) {
        for (const id of src) map[id] = true;
      } else if (typeof src === 'object') {
        for (const k of Object.keys(src)) {
          if (src[k]) map[k] = true;
        }
      }
    };
    absorb(secondary.unlockedWeapons);
    absorb(primary.unlockedWeapons);
    merged.unlockedWeapons = map;
  }

  if (localData.weaponShopLevels || cloudData.weaponShopLevels) {
    merged.weaponShopLevels = { ...(secondary.weaponShopLevels || {}), ...(primary.weaponShopLevels || {}) };
    for (const k of Object.keys(merged.weaponShopLevels)) {
      merged.weaponShopLevels[k] = Math.max(
        Number(localData.weaponShopLevels?.[k] || 1),
        Number(cloudData.weaponShopLevels?.[k] || 1)
      );
    }
  }

  if (localData.heroUpgrades || cloudData.heroUpgrades) {
    merged.heroUpgrades = { ...(secondary.heroUpgrades || {}), ...(primary.heroUpgrades || {}) };
    for (const k of Object.keys(merged.heroUpgrades)) {
      merged.heroUpgrades[k] = Math.max(
        Number(localData.heroUpgrades?.[k] || 0),
        Number(cloudData.heroUpgrades?.[k] || 0)
      );
    }
  }

  if (typeof localData.maxUnlockedLevel === 'number' || typeof cloudData.maxUnlockedLevel === 'number') {
    merged.maxUnlockedLevel = Math.max(
      Number(localData.maxUnlockedLevel || 1),
      Number(cloudData.maxUnlockedLevel || 1)
    );
  }
  if (typeof localData.unlockedLevel === 'number' || typeof cloudData.unlockedLevel === 'number') {
    merged.unlockedLevel = Math.max(
      Number(localData.unlockedLevel || 1),
      Number(cloudData.unlockedLevel || 1)
    );
  }

  return merged;
}

function installModerationGuards() {
  if (window.__grimborneGuardsInstalled) return;
  window.__grimborneGuardsInstalled = true;

  // 1. Prevent context menu
  window.addEventListener(
    'contextmenu',
    (e) => {
      e.preventDefault();
    },
    { passive: false }
  );

  // 2. Prevent text selection drag
  window.addEventListener(' dragstart'.trim(), (e) => {
    e.preventDefault();
  });
  document.addEventListener('selectstart', (e) => {
    const tag = e.target && e.target.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
      e.preventDefault();
    }
  });

  // 3. Prevent browser ctrl+wheel zoom & iOS gesture zoom
  window.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey) e.preventDefault();
    },
    { passive: false }
  );
  window.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
  window.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });

  // 4. Prevent multi-finger pinch-zoom while allowing natural single-finger touch scroll across UI screens
  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    },
    { passive: false }
  );
}

function showDevRewardToast(durationMs = 600) {
  return new Promise((resolve) => {
    const toast = document.createElement('div');
    toast.setAttribute('role', 'status');
    toast.style.cssText = [
      'position:fixed',
      'top:22px',
      'left:50%',
      'transform:translateX(-50%)',
      'z-index:99999',
      'padding:12px 22px',
      'background:linear-gradient(180deg,#1c1726 0%,#0e0b14 100%)',
      'border:1.5px solid #e5b85c',
      'border-radius:10px',
      'box-shadow:0 10px 32px rgba(0,0,0,0.8),0 0 20px rgba(229,184,92,0.35)',
      'color:#f8edd2',
      'font-family:Georgia,"Times New Roman",serif',
      'font-size:15px',
      'font-weight:700',
      'letter-spacing:0.03em',
      'pointer-events:none',
      'text-align:center',
      'white-space:nowrap'
    ].join(';');
    toast.textContent = '🎬 Тест Rewarded-рекламы Яндекс Игр';
    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
      resolve(true);
    }, durationMs);
  });
}

async function tryObtainYaGames() {
  if (typeof window === 'undefined') return null;
  if (window.YaGames && typeof window.YaGames.init === 'function') {
    return window.YaGames;
  }

  // If offline/local or script already errored, skip waiting immediately
  const host = (window.location && window.location.hostname) || '';
  const isLocal =
    !host ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.startsWith('192.168.') ||
    window.location.protocol === 'file:';

  if (isLocal || window.__yaSdkUnavailable) {
    return null;
  }

  // On hosted environments where async SDK tag may finish moments later, wait briefly (max 450ms)
  return new Promise((resolve) => {
    const deadline = performance.now() + 450;
    const poll = () => {
      if (window.YaGames && typeof window.YaGames.init === 'function') {
        resolve(window.YaGames);
        return;
      }
      if (window.__yaSdkUnavailable || performance.now() >= deadline) {
        resolve(null);
        return;
      }
      setTimeout(poll, 30);
    };
    poll();
  });
}

export async function initYandexSdk({ onPauseAudio, onResumeAudio } = {}) {
  installModerationGuards();

  let ysdk = null;
  let player = null;
  let readyMarked = false;
  let gameplayActive = false;

  // Coordinated audio pause state across tab visibility + fullscreen/rewarded ads
  let isPageHidden = typeof document !== 'undefined' ? document.hidden : false;
  let isAdShowing = false;
  let audioPausedBySdk = false;

  const syncAudioPauseState = () => {
    const shouldPause = isPageHidden || isAdShowing;
    if (shouldPause && !audioPausedBySdk) {
      audioPausedBySdk = true;
      try {
        onPauseAudio?.();
      } catch {
        // Ignore callback error
      }
    } else if (!shouldPause && audioPausedBySdk) {
      audioPausedBySdk = false;
      try {
        onResumeAudio?.();
      } catch {
        // Ignore callback error
      }
    }
  };

  document.addEventListener('visibilitychange', () => {
    isPageHidden = document.hidden;
    syncAudioPauseState();
  });

  window.addEventListener('blur', () => {
    isPageHidden = true;
    syncAudioPauseState();
  });

  window.addEventListener('focus', () => {
    isPageHidden = document.hidden;
    syncAudioPauseState();
  });

  window.addEventListener('pagehide', () => {
    isPageHidden = true;
    syncAudioPauseState();
  });

  window.addEventListener('pageshow', () => {
    isPageHidden = document.hidden;
    syncAudioPauseState();
  });

  // Attempt Yandex Games SDK init with timeout guard so hangs are impossible
  const yaGamesGlobal = await tryObtainYaGames();
  if (yaGamesGlobal) {
    try {
      ysdk = await Promise.race([
        yaGamesGlobal.init(),
        new Promise((resolve) => setTimeout(() => resolve(null), 2500))
      ]);
      if (ysdk && typeof ysdk.getPlayer === 'function') {
        try {
          player = await Promise.race([
            ysdk.getPlayer({ scopes: false }),
            new Promise((resolve) => setTimeout(() => resolve(null), 1500))
          ]);
        } catch {
          player = null;
        }
      }
    } catch {
      ysdk = null;
      player = null;
    }
  }

  // Wire Yandex SDK pause/resume events if supported by platform container
  try {
    ysdk?.on?.('game_api_pause', () => {
      isPageHidden = true;
      syncAudioPauseState();
    });
    ysdk?.on?.('game_api_resume', () => {
      isPageHidden = document.hidden;
      syncAudioPauseState();
    });
  } catch {
    // Optional SDK event hook
  }

  let pendingCloudSaveTimer = null;
  let latestSavePayload = null;

  const GameplayAPI = {
    start() {
      if (gameplayActive) return;
      gameplayActive = true;
      try {
        ysdk?.features?.GameplayAPI?.start?.();
      } catch {
        // Ignore
      }
    },
    stop() {
      if (!gameplayActive) return;
      gameplayActive = false;
      try {
        ysdk?.features?.GameplayAPI?.stop?.();
      } catch {
        // Ignore
      }
    }
  };

  return {
    isYandex: Boolean(ysdk),
    ysdk,

    markGameReady() {
      if (readyMarked) return;
      readyMarked = true;
      try {
        ysdk?.features?.LoadingAPI?.ready?.();
      } catch {
        // Ignore
      }
    },

    GameplayAPI,
    startGameplay: () => GameplayAPI.start(),
    stopGameplay: () => GameplayAPI.stop(),

    async loadData(defaultData = null) {
      const localData = safeReadLocal();
      let cloudData = null;

      if (player && typeof player.getData === 'function') {
        try {
          const res = await Promise.race([
            player.getData(),
            new Promise((resolve) => setTimeout(() => resolve(null), 1500))
          ]);
          if (res && typeof res === 'object' && Object.keys(res).length > 0) {
            cloudData = res;
          }
        } catch {
          cloudData = null;
        }
      }

      const merged = mergeSavePayloads(localData, cloudData);
      const finalData = defaultData
        ? { ...defaultData, ...merged }
        : merged;

      if (Object.keys(merged).length > 0) {
        safeWriteLocal(finalData);
      }

      return finalData;
    },

    async saveData(obj) {
      if (!obj || typeof obj !== 'object') return false;
      const payload = {
        ...obj,
        updatedAt: Date.now()
      };
      safeWriteLocal(payload);
      latestSavePayload = payload;

      if (player && typeof player.setData === 'function') {
        if (pendingCloudSaveTimer) clearTimeout(pendingCloudSaveTimer);
        pendingCloudSaveTimer = setTimeout(async () => {
          pendingCloudSaveTimer = null;
          try {
            await player.setData(latestSavePayload, true);
          } catch {
            // Silent fallback: localStorage already has latest data
          }
        }, 250);
      }

      return true;
    },

    showInterstitial() {
      if (!ysdk?.adv?.showFullscreenAdv) {
        return Promise.resolve(false);
      }

      const wasGameplayActive = gameplayActive;
      if (wasGameplayActive) GameplayAPI.stop();
      isAdShowing = true;
      syncAudioPauseState();

      return new Promise((resolve) => {
        let settled = false;
        const finish = (shown) => {
          if (settled) return;
          settled = true;
          isAdShowing = false;
          syncAudioPauseState();
          if (wasGameplayActive) GameplayAPI.start();
          resolve(shown);
        };

        const safetyTimer = setTimeout(() => finish(false), 8000);

        try {
          ysdk.adv.showFullscreenAdv({
            callbacks: {
              onOpen: () => {
                clearTimeout(safetyTimer);
                isAdShowing = true;
                syncAudioPauseState();
              },
              onClose: (wasShown) => {
                clearTimeout(safetyTimer);
                finish(Boolean(wasShown));
              },
              onError: () => {
                clearTimeout(safetyTimer);
                finish(false);
              },
              onOffline: () => {
                clearTimeout(safetyTimer);
                finish(false);
              }
            }
          });
        } catch {
          clearTimeout(safetyTimer);
          finish(false);
        }
      });
    },

    async showRewarded(rewardTag = 'reward') {
      const wasGameplayActive = gameplayActive;
      if (wasGameplayActive) GameplayAPI.stop();
      isAdShowing = true;
      syncAudioPauseState();

      // Local dev fallback: clean 0.6s toast + grant reward for testing Revive, x2 Gold & +80 Gold
      if (!ysdk?.adv?.showRewardedVideo) {
        await showDevRewardToast(600);
        isAdShowing = false;
        syncAudioPauseState();
        if (wasGameplayActive) GameplayAPI.start();
        return true;
      }

      return new Promise((resolve) => {
        let rewarded = false;
        let settled = false;

        const finish = () => {
          if (settled) return;
          settled = true;
          isAdShowing = false;
          syncAudioPauseState();
          if (wasGameplayActive) GameplayAPI.start();
          resolve(rewarded);
        };

        try {
          ysdk.adv.showRewardedVideo({
            callbacks: {
              onOpen: () => {
                isAdShowing = true;
                syncAudioPauseState();
              },
              onRewarded: () => {
                rewarded = true;
              },
              onClose: () => {
                finish();
              },
              onError: () => {
                finish();
              }
            }
          });
        } catch {
          finish();
        }
      });
    },

    getLang() {
      const lang = ysdk?.environment?.i18n?.lang;
      return lang === 'en' ? 'en' : 'ru';
    }
  };
}
