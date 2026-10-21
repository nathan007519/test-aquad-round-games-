// Comic sound effects synthesised with the Web Audio API (no audio files needed).
localStorage.removeItem('srg_muted');   // sound is always on by default (the header mute button is gone)
let ctx = null, muted = false, lastHover = 0;
const AC = window.AudioContext || window.webkitAudioContext;
const get = () => { if (!AC) return null; ctx ||= new AC(); if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx; };
function tone(freq, to, dur, type = 'square', vol = 0.06) {
  const c = get(); if (!c || muted || c.state !== 'running') return;
  const o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
  o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, freq, vol = 0.05, type = 'bandpass') {      // short filtered noise burst = the "tick" of a key / mouse switch
  const c = get(); if (!c || muted || c.state !== 'running') return;
  const n = Math.ceil(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = buf; f.type = type; f.frequency.value = freq; g.gain.value = vol; src.connect(f).connect(g).connect(c.destination); src.start();
}
export const sfx = {
  // keyboard typing: letters tick with a slightly different pitch per key, space is a low thock, Enter adds a bell, Backspace is softer
  key: ch => { const p = ((ch?.charCodeAt?.(0) || 97) % 13); noise(0.03, 2600 + p * 180, 0.07); tone(320 + p * 34, 200 + p * 20, 0.035, 'triangle', 0.035); },
  space: () => { noise(0.05, 700, 0.09, 'lowpass'); tone(150, 70, 0.07, 'sine', 0.08); },
  enter: () => { noise(0.04, 1800, 0.08); tone(220, 110, 0.06, 'square', 0.04); setTimeout(() => tone(1320, 1320, 0.1, 'sine', 0.035), 45); },
  back: () => { noise(0.025, 1500, 0.05); tone(480, 300, 0.035, 'triangle', 0.03); },
  // mouse: sharp switch click on press, softer release
  mouseDown: () => { noise(0.02, 3800, 0.09); tone(1900, 900, 0.025, 'square', 0.04); },
  mouseUp: () => { noise(0.012, 2400, 0.04); tone(1200, 700, 0.015, 'square', 0.02); },
  hover: () => tone(900, 1400, 0.05, 'triangle', 0.035),
  click: () => { tone(260, 90, 0.12, 'square', 0.07); tone(700, 300, 0.06, 'sawtooth', 0.03); },
  ok: () => { tone(520, 520, 0.09, 'square'); setTimeout(() => tone(780, 780, 0.14, 'square'), 90); },
  no: () => tone(220, 110, 0.25, 'sawtooth', 0.06),
};
export const isMuted = () => muted;
export const setMuted = m => { muted = m; localStorage.setItem('srg_muted', m ? '1' : '0'); if (!m) { get(); sfx.ok(); } };
const SEL = 'button,a[href],.btn,.bt,input[type=checkbox],input[type=range],select,label.switch,.lang-panel button,img[style*="cursor"],.marquee img,.pics img';
const NO_TEXT = /^(checkbox|radio|range|file|button|submit|reset|color|image)$/;
const isTyping = t => !!t && (t.isContentEditable || (t.matches?.('textarea,input') && !NO_TEXT.test(t.type || '')));
let lastKey = 0;
export function initSound() {
  const hit = e => e.target.closest?.(SEL);
  const wake = () => get();
  addEventListener('pointerdown', wake, { once: true }); addEventListener('keydown', wake, { once: true });
  document.addEventListener('mouseover', e => {                      // hover
    const el = hit(e); if (!el || el.disabled || el.contains(e.relatedTarget)) return;
    const n = performance.now(); if (n - lastHover < 40) return; lastHover = n; sfx.hover();
  });
  /* MOUSE: every mouse (or touch/pen) press plays the click-switch sound, release plays a softer one. */
  document.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return; sfx.mouseDown(); }, true);
  document.addEventListener('pointerup', e => { if (e.pointerType === 'mouse') sfx.mouseUp(); }, true);
  /* KEYBOARD: typing in any text field plays key sounds; Enter/Space on a focused button or link also sounds like a key press. */
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta' || e.key === 'CapsLock') return;
    const now = performance.now(); if (now - lastKey < 18) return; lastKey = now;
    const t = e.target;
    if (isTyping(t)) {
      if (e.key === ' ') sfx.space(); else if (e.key === 'Enter') sfx.enter(); else if (e.key === 'Backspace' || e.key === 'Delete') sfx.back(); else if (e.key.length === 1) sfx.key(e.key);
    } else if ((e.key === 'Enter' || e.key === ' ') && t.closest?.('button,a[href],[role=button],[role=slider],label.switch,.btn,.bt')) sfx.enter();
  }, true);
}
