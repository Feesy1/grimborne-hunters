// Minimal DOM & Formatting Utilities for Souls UI

export const RANK_ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export function formatTimeMMSS(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== '') node.textContent = text;
  return node;
}

export function hexNumToCss(num, fallback = '#e2be72') {
  if (typeof num === 'string') return num;
  if (typeof num !== 'number' || Number.isNaN(num)) return fallback;
  return `#${Math.max(0, Math.min(0xffffff, Math.round(num))).toString(16).padStart(6, '0')}`;
}

export function isWeaponHighlightChoice(choice) {
  return Boolean(choice && (choice.isWeaponChoice || choice.kind === 'weapon_unlock' || choice.kind === 'weapon_upgrade'));
}
