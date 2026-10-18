// Appearance: Auto (follow the device), Light or Dark. Kept on this device only
// (localStorage 'imss-appearance'); Auto removes data-theme so the
// prefers-color-scheme rules in GLOBAL_STYLES decide.
import { createElement as h, useState } from 'react';

const KEY = 'imss-appearance';
export const APPEARANCES = [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']];

export function getAppearance() {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'auto'; } catch (e) { return 'auto'; }
}
export function applyAppearance(v = getAppearance()) {
  const root = document.documentElement;
  if (v === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', v);
}
export function setAppearance(v) {
  try { if (v === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, v); } catch (e) { /* private mode: this visit only */ }
  applyAppearance(v);
}

// Three-way switch: Auto · Light · Dark.
export function AppearancePicker({ style }) {
  const [v, setV] = useState(getAppearance);
  return h('div', { role: 'radiogroup', 'aria-label': 'Appearance', style: { display: 'inline-flex', padding: 3, borderRadius: 980, background: 'var(--fill)', gap: 2, ...style } },
    APPEARANCES.map(([id, label]) => h('button', {
      key: id, type: 'button', role: 'radio', 'aria-checked': v === id,
      onClick: () => { setAppearance(id); setV(id); },
      style: { minHeight: 36, padding: '6px 14px', borderRadius: 980, fontSize: 14, fontWeight: 600, border: 0,
        background: v === id ? 'var(--panel)' : 'transparent', color: v === id ? 'var(--text)' : 'var(--text-2)',
        boxShadow: v === id ? '0 1px 3px rgba(0,0,0,.15)' : 'none', cursor: 'pointer' },
    }, label)));
}
