// Elden Ring-accurate Stamina Economy & 1-Slot Smart Input Buffer
// Pure Vanilla ES Module (zero external dependencies) for PC & Mobile Touch (Yandex Games).

export const SOULS_STAMINA_CFG = Object.freeze({
  MAX_STAMINA: 100,
  BASE_REGEN_PER_SEC: 45.0,
  BLOCK_REGEN_MULT: 0.20, // -80% while holding shield -> 9.0/s
  REGEN_DELAY_NORMAL: 0.48,
  REGEN_DELAY_EXHAUSTED: 0.95, // Triggered when stamina drops <= 0 (debt/exhaustion)
  MIN_NEGATIVE_DEBT: -25.0,
  COSTS: Object.freeze({
    roll: 14,
    r1: 12,
    r1Finisher: 16,
    r2: 20,
    chargedR2: 28,
    rollingR1: 14,
    guardCounter: 18,
    sprintInCombatPerSec: 12,
    sprintOutOfCombatPerSec: 0,
    parryMiss: 10
  })
});

export const SOULS_BUFFER_CFG = Object.freeze({
  TTL_DESKTOP_SEC: 0.440,
  TTL_MOBILE_SEC: 0.480,
  TTL_MOBILE_ATTACK_SEC: 0.680,
  PRIORITY: Object.freeze({
    roll: 4,
    parry: 4,
    heavy: 3,
    attack: 2,
    flask: 1
  })
});

const EPSILON = 1e-9;

function sanitizePositive(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function sanitizeDt(dt) {
  const n = Number(dt);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function isMobileTouchSource(inputSource) {
  if (typeof inputSource !== 'string') return false;
  const s = inputSource.toLowerCase();
  return s === 'touch' || s === 'mobile' || s === 'mobile_touch' || s.includes('touch') || s.includes('mobile');
}

function matchesAllowedActions(allowedActionsSet, action) {
  if (!allowedActionsSet) return false;
  if (allowedActionsSet instanceof Set) return allowedActionsSet.has(action);
  if (Array.isArray(allowedActionsSet)) return allowedActionsSet.includes(action);
  if (typeof allowedActionsSet === 'string') return allowedActionsSet === action;
  if (typeof allowedActionsSet === 'object') return Boolean(allowedActionsSet[action]);
  return false;
}

/**
 * Elden Ring Stamina Controller:
 * - Any stamina > 0 (while not exhaustedLocked) allows spending into negative debt down to MIN_NEGATIVE_DEBT (-25).
 * - Crossing <= 0 sets exhaustedLock = true and extends regen delay to REGEN_DELAY_EXHAUSTED (0.95s).
 * - Out-of-combat sprint costs 0 stamina/s; in-combat sprint drains 12/s and breaks on <= 0.
 * - Blocking cuts stamina regen by 80% (BLOCK_REGEN_MULT = 0.20 -> 9.0/s).
 * - Active actions (isBusyAction) and in-combat sprinting pause regen and delay countdown (DisableStaminaRecovery).
 *
 * @param {number} [initialMax=100]
 */
export function createSoulsStaminaController(initialMax = SOULS_STAMINA_CFG.MAX_STAMINA) {
  let maxStamina = sanitizePositive(initialMax, SOULS_STAMINA_CFG.MAX_STAMINA);
  let stamina = maxStamina;
  let regenDelay = 0;
  let exhaustedLock = false;

  function canSpend() {
    return stamina > 0 && !exhaustedLock;
  }

  function spend(cost, { allowDebt = true, delayOverride = null, force = false } = {}) {
    const amount = Number(cost);
    if (!Number.isFinite(amount) || amount <= 0) {
      return true;
    }
    if (!force && !canSpend()) {
      return false;
    }

    const floor = allowDebt ? SOULS_STAMINA_CFG.MIN_NEGATIVE_DEBT : 0;
    stamina = Math.max(floor, stamina - amount);

    if (stamina <= 0) {
      exhaustedLock = true;
      regenDelay = Math.max(regenDelay, SOULS_STAMINA_CFG.REGEN_DELAY_EXHAUSTED);
    } else {
      const delay = (delayOverride !== null && delayOverride !== undefined)
        ? Math.max(0, Number(delayOverride) || 0)
        : SOULS_STAMINA_CFG.REGEN_DELAY_NORMAL;
      regenDelay = Math.max(regenDelay, delay);
    }

    return true;
  }

  function drainSprint(dt, { inCombat = false } = {}) {
    const safeDt = sanitizeDt(dt);

    // Elden Ring rule: infinite sprint outside combat (0 stamina/sec).
    if (!inCombat) {
      return true;
    }

    if (exhaustedLock || stamina <= 0) {
      return false;
    }

    if (safeDt === 0) {
      return true;
    }

    const drain = SOULS_STAMINA_CFG.COSTS.sprintInCombatPerSec * safeDt;
    stamina -= drain;

    if (stamina <= 0) {
      stamina = 0;
      exhaustedLock = true;
      regenDelay = Math.max(regenDelay, SOULS_STAMINA_CFG.REGEN_DELAY_EXHAUSTED);
      return false;
    }

    regenDelay = Math.max(regenDelay, SOULS_STAMINA_CFG.REGEN_DELAY_NORMAL);
    return true;
  }

  function tick(dt, { isBlocking = false, isBusyAction = false, isSprintingInCombat = false } = {}) {
    const safeDt = sanitizeDt(dt);
    if (safeDt === 0) {
      return getDisplayStamina();
    }

    // DisableStaminaRecovery during active attacks/rolls or in-combat sprinting.
    if (isBusyAction || isSprintingInCombat) {
      return getDisplayStamina();
    }

    let remainingDt = safeDt;
    if (regenDelay > 0) {
      if (remainingDt >= regenDelay) {
        remainingDt -= regenDelay;
        regenDelay = 0;
      } else {
        regenDelay -= remainingDt;
        if (regenDelay <= EPSILON) regenDelay = 0;
        return getDisplayStamina();
      }
    }

    if (remainingDt > 0 && stamina < maxStamina) {
      const mult = isBlocking ? SOULS_STAMINA_CFG.BLOCK_REGEN_MULT : 1.0;
      const rate = SOULS_STAMINA_CFG.BASE_REGEN_PER_SEC * mult;
      stamina = Math.min(maxStamina, stamina + rate * remainingDt);

      if (exhaustedLock && stamina > 0) {
        exhaustedLock = false;
      }
    }

    return getDisplayStamina();
  }

  function getDisplayStamina() {
    return Math.max(0, stamina);
  }

  function getRawStamina() {
    return stamina;
  }

  function getMaxStamina() {
    return maxStamina;
  }

  function getRegenDelay() {
    return regenDelay;
  }

  function isExhausted() {
    return exhaustedLock;
  }

  function reset(max = maxStamina) {
    maxStamina = sanitizePositive(max, maxStamina);
    stamina = maxStamina;
    regenDelay = 0;
    exhaustedLock = false;
  }

  return {
    canSpend,
    spend,
    drainSprint,
    tick,
    getDisplayStamina,
    getRawStamina,
    getMaxStamina,
    getRegenDelay,
    isExhausted,
    reset
  };
}

/**
 * 1-Slot Smart Action Input Buffer (eliminates Elden Ring's delayed panic-roll bug):
 * - TTL: 0.200s on PC (mouse_kb/gamepad), 0.240s on Mobile Touch.
 * - Priority: roll(4) = parry(4) > heavy(3) > attack(2) > flask(1); equal priority uses last-press-wins.
 * - clearOnHitstun() immediately wipes queued input on hitstun / microStun / guardBreak.
 */
export function createSoulsActionBuffer() {
  let slot = null;

  function purgeIfExpired(nowSec) {
    if (slot !== null && Number.isFinite(nowSec) && nowSec > slot.expiresAt) {
      slot = null;
    }
  }

  function push(action, nowSec, { inputSource = 'mouse_kb', payload = null } = {}) {
    if (typeof action !== 'string' || action.length === 0) {
      return false;
    }
    const t = Number(nowSec);
    if (!Number.isFinite(t)) {
      return false;
    }

    purgeIfExpired(t);

    const priority = Object.prototype.hasOwnProperty.call(SOULS_BUFFER_CFG.PRIORITY, action)
      ? SOULS_BUFFER_CFG.PRIORITY[action]
      : 0;

    if (slot !== null && priority < slot.priority) {
      return false;
    }

    const ttl = isMobileTouchSource(inputSource)
      ? (action === 'attack' ? SOULS_BUFFER_CFG.TTL_MOBILE_ATTACK_SEC : SOULS_BUFFER_CFG.TTL_MOBILE_SEC)
      : SOULS_BUFFER_CFG.TTL_DESKTOP_SEC;

    slot = Object.freeze({
      action,
      priority,
      inputSource,
      payload,
      createdAt: t,
      expiresAt: t + ttl,
      ttl
    });

    return true;
  }

  function peek(nowSec) {
    purgeIfExpired(Number(nowSec));
    return slot;
  }

  function consume(allowedActionsSet, nowSec) {
    purgeIfExpired(Number(nowSec));
    if (slot === null) {
      return null;
    }
    if (!matchesAllowedActions(allowedActionsSet, slot.action)) {
      return null;
    }
    const consumed = slot;
    slot = null;
    return consumed;
  }

  function clearOnHitstun() {
    const hadBuffered = slot !== null;
    slot = null;
    return hadBuffered;
  }

  function clear() {
    slot = null;
  }

  return {
    push,
    peek,
    consume,
    clearOnHitstun,
    clear
  };
}
