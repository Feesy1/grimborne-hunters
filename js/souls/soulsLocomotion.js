// Elden Ring-Accurate Root Motion Roll, Accelerated Combat Step-In & Alive Stance Locomotion
// Pure, zero-dependency ES module for Abandoned Knight Rift (Stage 1 modularization).
// Deterministic across 30 FPS mobile (Yandex Games) and 60/144 FPS desktop sub-steps.

export const SOULS_ROLL_CFG = Object.freeze({
  duration: 0.56,
  iframesPc: 0.38,
  iframesTouch: 0.41,
  targetDist: 3.42,
  rollingAttackCancelU: 0.80,
  staminaCost: 14
});

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep01(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function smootherstep01(t) {
  const x = clamp(t, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/**
 * Returns the platform-appropriate invulnerability window (seconds) for a Souls roll.
 * @param {'mouse_kb'|'touch'} [inputSource='mouse_kb']
 * @returns {number}
 */
export function getSoulsRollIframes(inputSource = 'mouse_kb') {
  return inputSource === 'touch' ? SOULS_ROLL_CFG.iframesTouch : SOULS_ROLL_CFG.iframesPc;
}

// Raw unscaled 3-phase Elden Ring Medium Roll Root Motion speed profile (m/s):
//   Phase 1 [0.00 .. 0.25]: explosive shoulder-dive launch (~8.55 -> 7.45 m/s)
//   Phase 2 [0.25 .. 0.65]: smooth momentum roll-through  (7.45 -> 5.45 m/s)
//   Phase 3 [0.65 .. 1.00]: grounded foot-plant braking   (5.45 -> 1.40 m/s)
// Exact analytical integral of sampleRawRollSpeed over [0, 1]:
//   Phase 1: 0.25 * (7.95 + 0.42 * 2 / Math.PI) = 2.054341
//   Phase 2: 0.40 * 6.45                        = 2.580000
//   Phase 3: 0.35 * (5.45 - 4.05 / 2.32)        = 1.296513
//   Total raw integral                          = 5.930854
// Scaled so integral_0^1 sampleSoulsRollSpeed(u) du * 0.56 === 3.4200 m.
const RAW_ROLL_INTEGRAL =
  0.25 * (7.95 + (0.42 * 2) / Math.PI) +
  0.40 * 6.45 +
  0.35 * (5.45 - 4.05 / 2.32);
const ROLL_SPEED_CALIBRATION = SOULS_ROLL_CFG.targetDist / (SOULS_ROLL_CFG.duration * RAW_ROLL_INTEGRAL);

function sampleRawRollSpeed(u) {
  const x = clamp(u, 0, 1);
  if (x <= 0.25) {
    // Explosive launch peaking near u=0.07, easing smoothly into mid-roll tuck at u=0.25
    const t = x / 0.25;
    const peakBoost = Math.sin(t * Math.PI) * 0.42;
    return 8.45 + (7.45 - 8.45) * smoothstep01(t) + peakBoost;
  }
  if (x <= 0.65) {
    // Steady rolling glide across shoulder/back (0.25 -> 0.65)
    const t = (x - 0.25) / 0.40;
    return 7.45 + (5.45 - 7.45) * smoothstep01(t);
  }
  // Grounded boot-plant deceleration (0.65 -> 1.00) with firm catch around u=0.80
  const t = (x - 0.65) / 0.35;
  const brakeCurve = Math.pow(t, 1.32);
  return 5.45 + (1.40 - 5.45) * brakeCurve;
}

/**
 * Exact Elden Ring Medium Roll Root Motion velocity curve (m/s) at normalized roll progress u in [0, 1].
 * Integrating over SOULS_ROLL_CFG.duration (0.56 s) yields ~3.42 m (~3.40 m).
 *
 * @param {number} u Normalized roll progress [0..1]
 * @returns {number} Instantaneous horizontal roll speed (m/s)
 */
export function sampleSoulsRollSpeed(u) {
  if (!Number.isFinite(u)) return 0;
  return sampleRawRollSpeed(u) * ROLL_SPEED_CALIBRATION;
}

/**
 * Frame-rate-independent roll displacement (meters) across [uPrev, uNext] using Simpson's rule.
 * Guarantees identical ~3.42 m roll distance at 30 FPS, 60 FPS, and 144 FPS.
 *
 * @param {number} uPrev Previous normalized roll progress [0..1]
 * @param {number} uNext Next normalized roll progress [0..1]
 * @param {number} [duration=SOULS_ROLL_CFG.duration] Total roll duration (seconds)
 * @returns {number} Horizontal displacement for this step (meters)
 */
export function sampleSoulsRollStepDist(uPrev, uNext, duration = SOULS_ROLL_CFG.duration) {
  if (!Number.isFinite(uPrev) || !Number.isFinite(uNext) || !Number.isFinite(duration) || duration <= 0) {
    return 0;
  }
  const a = clamp(uPrev, 0, 1);
  const b = clamp(uNext, 0, 1);
  if (b <= a) return 0;
  const mid = 0.5 * (a + b);
  const avgSpeed = (sampleSoulsRollSpeed(a) + 4 * sampleSoulsRollSpeed(mid) + sampleSoulsRollSpeed(b)) / 6;
  return avgSpeed * (b - a) * duration;
}

/**
 * Cumulative normalized progress [0..1] for an accelerated Elden Ring combat step-in lunge.
 * Coils with minimal drift during early windup (0..0.30), explodes forward during the
 * windup->strike commitment window (0.30..0.80), and brakes cleanly into a planted lead boot (0.80..1.00).
 *
 * @param {number} u Normalized lunge progress [0..1]
 * @returns {number} Cumulative normalized distance fraction [0..1]
 */
export function evalAttackLungeProgress(u) {
  const x = clamp(Number.isFinite(u) ? u : 0, 0, 1);
  // Quadratic forward-skewed warp shifts peak impulse from u=0.50 to u≈0.64 (windup->active snap)
  const warped = x * (0.42 + 0.58 * x);
  return smootherstep01(warped);
}

/**
 * Computes the incremental forward lunge distance (meters) between uPrev and uNext along the
 * accelerated combat step-in S-curve. Telescoping sum across arbitrary dt steps === totalDist.
 *
 * @param {number} uPrev Previous normalized progress [0..1]
 * @param {number} uNext Next normalized progress [0..1]
 * @param {number} totalDist Total step-in distance (meters)
 * @returns {number} Forward displacement for this frame/sub-step (meters)
 */
export function sampleAttackLungeStep(uPrev, uNext, totalDist) {
  if (
    !Number.isFinite(uPrev) ||
    !Number.isFinite(uNext) ||
    !Number.isFinite(totalDist) ||
    totalDist <= 0
  ) {
    return 0;
  }
  const a = clamp(uPrev, 0, 1);
  const b = clamp(uNext, 0, 1);
  if (b <= a) return 0;
  return totalDist * (evalAttackLungeProgress(b) - evalAttackLungeProgress(a));
}

/**
 * Pure, smooth micro-motion generator for Elden Ring-style living character presence in neutral,
 * guard, landing settle, and combat footwork (never a rigid wooden statue, never jittery).
 *
 * Units:
 *  - breathBobY         : vertical micro-offset in meters ([-0.045 .. +0.010])
 *  - weightShiftX       : lateral weight-transfer offset in meters ([-0.032 .. +0.024])
 *  - torsoLeanZ         : forward(+)/backward(-) pitch lean in radians ([-0.16 .. +0.16])
 *  - shieldGuardTilt    : defensive guard cant/roll in radians ([-0.03 .. +0.30])
 *  - turnFootPivotPulse : normalized [0..1] micro foot-pivot / landing catch pulse
 *
 * @param {number} timeSec Monotonic elapsed time in seconds
 * @param {object} [opts]
 * @param {boolean} [opts.isBlocking=false]
 * @param {boolean} [opts.inCombat=false]
 * @param {number} [opts.moveSpeed=0] Current horizontal ground speed (m/s)
 * @param {number} [opts.justLandedTimer=0] Remaining roll/jump landing settle timer (s, ~0.24 -> 0)
 * @param {number} [opts.recoilAmount=0] Impact/block recoil intensity [0..1]
 * @param {number} [opts.turnRate=0] Optional live yaw turn rate (rad/s)
 * @param {boolean} [opts.isTurning180=false] Optional active Turn_180 flag
 * @param {object} [opts.out=null] Optional target object to write in-place (zero allocation)
 * @returns {{ breathBobY: number, weightShiftX: number, torsoLeanZ: number, shieldGuardTilt: number, turnFootPivotPulse: number }}
 */
export function computeAliveStanceVisual(timeSec, opts = {}) {
  const t = Number.isFinite(timeSec) ? timeSec : 0;
  const isBlocking = Boolean(opts?.isBlocking);
  const inCombat = Boolean(opts?.inCombat);
  const moveSpeed = Math.max(0, Number(opts?.moveSpeed) || 0);
  const justLandedTimer = Math.max(0, Number(opts?.justLandedTimer) || 0);
  const recoil = clamp(Number(opts?.recoilAmount) || 0, 0, 1);
  const turnRate = Number(opts?.turnRate) || 0;
  const isTurning180 = Boolean(opts?.isTurning180);

  const speedNorm = clamp(moveSpeed / 4.2, 0, 1.45);
  // Smoothly yield neutral weight-shift to Running_A when actually moving
  const idleWeight = 1 - smoothstep01((speedNorm - 0.08) / 0.48);

  // Two-harmonic organic breathing (slightly faster & deeper under combat adrenaline)
  const breathFreq = inCombat ? 2.85 : 1.75;
  const breathWave = Math.sin(t * breathFreq) * 0.72 + Math.sin(t * breathFreq * 2.0 - 0.85) * 0.28;

  // Slow asymmetric lateral weight shift from lead foot to rear foot
  const shiftFreq = inCombat ? 1.35 : 0.82;
  const shiftWave = Math.sin(t * shiftFreq) * 0.78 + Math.sin(t * shiftFreq * 0.53 + 1.15) * 0.22;

  // Damped knee-absorb settle dip right after a roll or drop landing (0.24s -> 0)
  let landEnv = 0;
  if (justLandedTimer > 0) {
    const landDur = 0.24;
    const landProg = clamp(1 - justLandedTimer / landDur, 0, 1);
    landEnv = Math.sin(landProg * Math.PI) * Math.exp(-1.6 * landProg);
  }

  // 1. Vertical breath & grounded landing knee-absorb (meters)
  const breathAmp = (inCombat ? 0.008 : 0.005) * (isBlocking ? 0.45 : 1.0) * (0.35 + 0.65 * idleWeight);
  const breathBobY = breathWave * breathAmp - landEnv * 0.036 - recoil * 0.016;

  // 2. Lateral weight transfer across boots in neutral & braced guard stance (meters)
  const shiftAmp = (inCombat ? 0.022 : 0.012) * (isBlocking ? 0.42 : 1.0) * idleWeight;
  const blockBraceX = isBlocking ? -0.014 : 0;
  const weightShiftX = shiftWave * shiftAmp + blockBraceX;

  // 3. Forward/backward torso pitch lean (radians; + = forward readiness/sprint, - = impact recoil)
  const baseReadinessLean = inCombat ? 0.032 : 0.010;
  const moveLean = 0.048 * Math.min(1.3, speedNorm);
  const blockLean = isBlocking ? 0.055 : 0;
  const landLean = landEnv * 0.068;
  const breathLean = breathWave * 0.008 * idleWeight;
  const recoilKickback = -recoil * 0.145;
  const torsoLeanZ = clamp(
    baseReadinessLean + moveLean + blockLean + landLean + breathLean + recoilKickback,
    -0.16,
    0.18
  );

  // 4. Defensive shield-shoulder tilt / guard brace cant (radians)
  let shieldGuardTilt;
  if (isBlocking) {
    const braceTension = Math.sin(t * 7.2) * 0.005;
    shieldGuardTilt = 0.135 + braceTension + recoil * 0.155;
  } else if (inCombat) {
    shieldGuardTilt = 0.038 + shiftWave * 0.016 * idleWeight + recoil * 0.085;
  } else {
    shieldGuardTilt = shiftWave * 0.010 * idleWeight + recoil * 0.060;
  }

  // 5. Subtle foot-pivot & boot-catch pulse (0..1)
  const turnPulse = isTurning180 ? 1.0 : clamp(Math.abs(turnRate) / 4.5, 0, 1);
  const weightPeakPulse = inCombat && idleWeight > 0.25
    ? Math.pow(Math.abs(Math.cos(t * shiftFreq)), 8) * 0.32 * idleWeight
    : 0;
  const landPivotPulse = landEnv * 0.78;
  const turnFootPivotPulse = clamp(Math.max(turnPulse, landPivotPulse, weightPeakPulse), 0, 1);

  const out = opts?.out && typeof opts.out === 'object' ? opts.out : {};
  out.breathBobY = breathBobY;
  out.weightShiftX = weightShiftX;
  out.torsoLeanZ = torsoLeanZ;
  out.shieldGuardTilt = shieldGuardTilt;
  out.turnFootPivotPulse = turnFootPivotPulse;
  return out;
}

/**
 * Optional lightweight stateful smoother around computeAliveStanceVisual so discrete toggles
 * (entering/leaving shield block, combat engagement, recoil bursts) blend organically with zero snaps.
 */
export function createAliveStanceSmoother() {
  const raw = {
    breathBobY: 0,
    weightShiftX: 0,
    torsoLeanZ: 0,
    shieldGuardTilt: 0,
    turnFootPivotPulse: 0
  };
  const smoothed = {
    breathBobY: 0,
    weightShiftX: 0,
    torsoLeanZ: 0,
    shieldGuardTilt: 0,
    turnFootPivotPulse: 0
  };
  let initialized = false;

  function step(dt, timeSec, opts = {}) {
    const safeDt = clamp(Number.isFinite(dt) ? dt : 0.016, 0, 0.1);
    computeAliveStanceVisual(timeSec, { ...opts, out: raw });
    if (!initialized || safeDt <= 0) {
      initialized = true;
      smoothed.breathBobY = raw.breathBobY;
      smoothed.weightShiftX = raw.weightShiftX;
      smoothed.torsoLeanZ = raw.torsoLeanZ;
      smoothed.shieldGuardTilt = raw.shieldGuardTilt;
      smoothed.turnFootPivotPulse = raw.turnFootPivotPulse;
      return smoothed;
    }
    const alphaSlow = 1 - Math.exp(-safeDt * 11.0);
    const alphaFast = 1 - Math.exp(-safeDt * 20.0);
    smoothed.breathBobY += (raw.breathBobY - smoothed.breathBobY) * alphaFast;
    smoothed.weightShiftX += (raw.weightShiftX - smoothed.weightShiftX) * alphaSlow;
    smoothed.torsoLeanZ += (raw.torsoLeanZ - smoothed.torsoLeanZ) * alphaFast;
    smoothed.shieldGuardTilt += (raw.shieldGuardTilt - smoothed.shieldGuardTilt) * alphaFast;
    smoothed.turnFootPivotPulse += (raw.turnFootPivotPulse - smoothed.turnFootPivotPulse) * alphaFast;
    return smoothed;
  }

  function reset() {
    initialized = false;
    smoothed.breathBobY = 0;
    smoothed.weightShiftX = 0;
    smoothed.torsoLeanZ = 0;
    smoothed.shieldGuardTilt = 0;
    smoothed.turnFootPivotPulse = 0;
  }

  return { step, reset, state: smoothed };
}
