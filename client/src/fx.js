// Site-wide Comic UI Kit effects. The engine itself lives in kitfx.js (canvas particles, word popups, per-component motion,
// typing shakes). This file wires it to the site: persisted motion switch, theme, palette, and a fallback for non-kit controls.
import { initKitFx } from './kitfx.js';
import { initPopFx } from './popfx.js';

const OS_RM = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
localStorage.removeItem('srg_motion');
let ON = true;   // always on by default; only a visitor's own OS "reduce motion" setting turns it off
let kit = null;

export const isMotionOn = () => ON;
export function setMotion(v) { ON = !!v; localStorage.setItem('srg_motion', ON ? '1' : '0'); kit?.setMotion(ON); }
export const getTheme = () => (kit ? kit.getTheme() : localStorage.getItem('srg_theme') === 'dark' ? 'dark' : 'light');
export const toggleTheme = () => kit?.toggleTheme();
export const randomizePalette = () => kit?.randomizePalette();
export const classicPalette = () => kit?.classicPalette();
export const comicWord = (...a) => kit?.comicWord(...a);
// slider particles (used by <Slide/> in shared.jsx)
export const sliderTrail = (...a) => kit?.sliderTrail(...a);
export const sliderBurst = (...a) => kit?.sliderBurst(...a);
export const isLowPower = () => !!kit?.LOW;

let started = false;
export function initFx() {
  if (started) return; started = true;
  kit = initKitFx(); kit.setMotion(ON);
  // Controls that are not Comic UI Kit buttons (.btn, doodle, brutal buttons) still get the click burst.
  const SEL = '.comic-brutal-button,.dd,.btn:not(.comic-unit)';
  document.addEventListener('click', e => {
    if (!ON) return;
    const b = e.target.closest?.(SEL); if (!b || b.disabled) return;
    const r = b.getBoundingClientRect(), x = e.detail ? e.clientX : r.left + r.width / 2, y = e.detail ? e.clientY : r.top + r.height / 2;
    kit.spawn(x, y, kit.BUTTON_FX[0]); kit.comicWord(x, y);
  });
  // Plain text fields outside any kit component still shake and tick when typed in.
  document.addEventListener('input', e => {
    const el = e.target; if (!ON || !el.matches?.('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]),textarea') || el.closest('.comic-unit')) return;
    kit.shake(el);
    const r = el.getBoundingClientRect(); kit.spawn(r.left + Math.min(r.width - 10, 14 + el.value.length * 8), r.top + r.height / 2, kit.BUTTON_FX[0], 1);
  });
  // Checkboxes and switches: a small success burst (and a ZAP! on switches).
  const CHECK_FX = { n: 10, sh: ['star', 'dia'], s: 4.5, up: 1, g: .2, dc: .05, col: ['#ffd400', '#3ddc84', '#fff'], r: 3, rr: 3, spawn: 'check-burst' };
  document.addEventListener('change', e => {
    const el = e.target; if (!ON || !el.matches?.('input[type=checkbox]')) return;
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, isSwitch = !!el.closest('.switch');
    if (el.checked) { kit.spawn(x, y, CHECK_FX); kit.impactRing(x, y, 46); }
    if (isSwitch) kit.comicWord(x, y - 10, 'ZAP!');
  });
  // The visitor's OS "reduce motion" setting is honoured live, not just at load.
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', e => { ON = !e.matches; kit.setMotion(ON); });
  initPopFx(() => ON);
}
