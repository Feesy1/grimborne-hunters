// Grimborne Hunters — Boss Intro Dialogue 30-FPS Speech Lip-Sync Data (7-Clip Dark English Master)
// Auto-generated from mastered boss_intro_vo_01..07.mp3 (300-3200 Hz speech RMS,
// smoothed attack/release articulation, quantized 0..100). Zero dependencies, zero GC.

export const BOSS_VO_COUNT = 7;
export const BOSS_LIPSYNC_FPS = 30;

export const BOSS_VO_DURATIONS_SEC = Object.freeze({
  1: 1.886, // 1886 ms — [chuckle] Another one, eh?
  2: 3.876, // 3876 ms — So eager to test the limits of my hospitality.
  3: 5.194, // 5194 ms — You'll find, dear guest, that time here moves... differently.
  4: 6.214, // 6214 ms — [scoff/chuckle] Oh, don't look so surprised. Many have come before you, full of bravado.
  5: 6.011, // 6011 ms — They learn, eventually, the true meaning of patience... and silence.
  6: 5.023, // 5023 ms — Now, if you'll excuse me, I have other... arrangements to attend to.
  7: 1.293 // 1293 ms — Enjoy your stay.
});

export const BOSS_VO_DURATIONS_MS = Object.freeze({
  1: 1886,
  2: 3876,
  3: 5194,
  4: 6214,
  5: 6011,
  6: 5023,
  7: 1293
});

// Quantized 30-FPS mouth-open curves (integers 0..100 -> divided by 100.0 in sampler)
export const BOSS_LIPSYNC_CURVES = Object.freeze({
  1: Object.freeze([0,2,2,30,33,23,16,10,6,35,49,35,20,11,6,3,0,0,0,33,61,75,62,55,50,47,81,94,98,100,69,67,92,90,88,81,72,67,62,55,41,29,25,25,22,33,49,43,36,29,33,24,14,8,4,0,0,0]),
  2: Object.freeze([0,1,13,21,28,29,28,74,93,98,99,96,87,64,46,30,17,9,7,53,86,96,96,99,94,62,45,43,59,54,47,45,42,25,29,45,62,41,26,26,38,55,84,76,56,42,30,17,9,41,75,69,73,71,69,65,89,97,74,54,45,39,30,18,12,19,23,42,49,35,20,28,49,87,94,98,95,76,64,53,50,73,53,39,31,18,10,35,72,48,29,28,26,42,63,69,61,43,36,29,16,15,17,15,17,17,18,20,20,17,11,6,4,0,0,0,0,0]),
  3: Object.freeze([0,16,49,72,90,92,87,66,47,33,23,55,88,97,99,100,89,75,59,43,30,21,15,10,8,7,12,13,7,4,9,40,60,55,47,39,30,19,11,14,17,19,22,22,23,24,20,18,17,18,15,9,11,15,14,13,9,5,3,0,0,0,48,81,57,37,22,19,28,46,67,91,98,99,96,83,79,79,65,46,41,61,88,90,88,87,86,74,63,54,50,68,80,90,97,97,95,85,72,51,36,26,23,21,20,19,18,16,14,9,5,3,0,0,0,0,0,0,0,0,0,0,0,0,1,26,57,62,43,29,17,16,21,24,18,14,8,4,11,10,12,17,20,18,16,14,19,17,13,8,5,3,0,0,0,0,0]),
  4: Object.freeze([0,0,3,2,2,23,20,11,6,3,0,0,0,0,0,0,0,0,0,0,0,30,71,91,89,95,99,100,90,73,52,35,51,87,97,99,90,60,41,38,47,86,74,49,39,33,28,26,55,73,87,68,48,35,33,56,37,25,17,16,17,24,47,53,60,59,54,47,41,32,27,21,14,12,12,7,6,6,3,0,0,0,0,0,0,0,0,0,8,23,38,78,93,93,80,77,88,85,82,79,61,47,67,67,48,30,18,23,60,89,88,67,53,38,66,83,64,42,27,21,56,86,85,95,84,71,60,47,35,27,24,21,18,15,13,14,9,5,3,2,3,4,7,23,65,91,98,92,80,66,54,49,55,45,30,17,10,12,32,47,49,34,21,25,49,62,68,63,56,41,26,21,20,18,19,18,17,15,15,13,11,6,4,0,0,0,0,0]),
  5: Object.freeze([0,3,25,81,95,99,97,87,84,95,99,100,100,100,100,90,88,84,67,56,52,50,48,44,34,26,21,15,9,5,3,21,54,48,37,69,82,76,59,43,35,40,44,36,34,29,26,26,25,32,36,31,28,26,22,18,11,6,4,0,0,0,0,0,52,64,44,26,26,39,43,45,43,53,74,77,83,84,71,59,46,36,28,25,26,25,24,21,21,20,20,23,28,34,47,38,24,14,8,4,0,13,12,23,60,56,40,37,48,63,56,41,30,18,12,7,5,15,21,22,22,19,13,7,4,0,0,0,0,0,0,0,0,0,0,0,0,0,42,62,70,56,40,33,25,21,21,22,23,25,24,22,21,32,44,63,66,56,43,31,24,23,20,13,8,5,3,7,16,18,19,19,18,16,11,6,3,0,0,0,0,0]),
  6: Object.freeze([0,22,68,82,85,77,63,51,38,32,31,27,24,18,11,6,4,0,0,0,0,18,22,12,12,49,87,94,81,78,56,47,40,34,29,22,40,70,75,78,74,59,41,31,26,31,32,45,64,64,65,56,43,39,33,26,21,16,18,51,79,81,71,61,63,79,87,64,44,52,65,91,98,75,56,80,95,99,100,89,82,72,57,42,30,22,13,7,4,0,0,0,0,0,0,52,72,68,49,45,86,84,75,67,54,45,33,38,35,21,15,17,16,10,6,4,8,15,14,8,18,21,38,45,45,27,16,17,23,38,44,32,22,13,8,6,18,15,16,15,13,12,8,7,5,3,0,0,0,0,0,0]),
  7: Object.freeze([0,21,49,53,59,45,44,60,90,97,96,89,86,82,83,79,58,41,32,25,15,12,26,29,28,25,19,15,11,11,11,7,4,0,0,0,0,0,0,0])
});

export function getBossVoDurationSec(cueIndex) {
  const idx = cueIndex | 0;
  return BOSS_VO_DURATIONS_SEC[idx] || 0;
}

/**
 * Sample smooth [0..1] mouth-open factor for Boss jaw lip-sync.
 * Zero allocations, NaN-safe, linearly interpolated at 30 FPS.
 */
export function sampleBossMouthOpen(cueIndex, localTimeSec) {
  const idx = cueIndex | 0;
  const curve = BOSS_LIPSYNC_CURVES[idx];
  if (!curve || !Number.isFinite(localTimeSec) || localTimeSec < 0) return 0;
  const dur = BOSS_VO_DURATIONS_SEC[idx];
  if (dur > 0 && localTimeSec >= dur) return 0;
  const pos = localTimeSec * BOSS_LIPSYNC_FPS;
  const i0 = pos | 0;
  const last = curve.length - 1;
  if (i0 >= last) return 0;
  const frac = pos - i0;
  const v0 = curve[i0];
  const v1 = curve[i0 + 1];
  const v = (v0 + (v1 - v0) * frac) * 0.01;
  return v <= 0 ? 0 : (v >= 1 ? 1 : v);
}
