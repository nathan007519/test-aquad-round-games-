import React, { createContext, useContext } from 'react';
import { sliderTrail, sliderBurst, isLowPower } from './fx.js';

export const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);
export const inr = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(+n) ? 0 : 2, maximumFractionDigits: 2 });
// Same maths as the server's bill(): price is BEFORE GST -> minus discount -> taxable -> CGST 9% + SGST 9% -> total
const r2c = n => Math.round(n * 100) / 100;
export const calcBill = (price, pct = 0, txnPct = 0) => { const gross = r2c(price), discount = r2c(gross * pct / 100), taxable = r2c(gross - discount), gst = r2c(taxable * 0.18), cgst = r2c(gst / 2);
  return { gross, discount, taxable, gst, cgst, sgst: r2c(gst - cgst), total: r2c(taxable + gst + (taxable + gst) * txnPct / 100) }; };
export const dt = x => (x ? new Date(x).toLocaleString() : '—');
export const ytId = s => (String(s).match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/) || (/^[\w-]{11}$/.test(s) ? [0, s] : []))[1];
// {game} / {next} tokens inside editable text
export const fill = (s, c) => String(s ?? '').replaceAll('{game}', c?.gameName || '').replaceAll('{next}', c?.nextGame || '');
export const SOCIAL = [['youtube', 'YouTube'], ['instagram', 'Instagram'], ['facebook', 'Facebook'], ['x', 'X'], ['discord', 'Discord']];
export const L = (o, lang) => (o && (o[lang] || o.en)) || '';

const KIT = { '': 1, red: 15, blue: 4 };
const ALLOW = [1, 4, 9, 10, 15];   // site-wide: only these five Comic UI Kit button styles are used            // default style per colour; pass kit={n} (1-15) for a specific Comic UI Kit button
const HOPPABLE = /^[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Common}]+$/u;
function Letters({ text }) {                          // letters hop on hover — only for scripts where one character = one glyph; Indic/Arabic text must stay whole or its joined shapes break
  if (!HOPPABLE.test(text) || (!/\s/.test(text) && text.length > 14)) return text;
  let j = 0;
  return text.split(' ').map((w, wi, a) => <React.Fragment key={wi}><span className="kw" aria-hidden="true">{[...w].map(c => <span className="lt" key={j} style={{ '--j': j++ }}>{c}</span>)}</span>{wi < a.length - 1 && ' '}</React.Fragment>);
}
export const Btn = ({ color = '', kit, tip, children, className = '', ...p }) => {
  const n0 = kit ?? KIT[color] ?? 1, n = Math.min(15, Math.max(1, n0)), str = typeof children === 'string';
  return <button type="button" aria-label={str ? children : undefined} {...p} className={`bt b${n} ${className}`} data-t={tip || 'BOOM!'}>{str ? <Letters text={children} /> : children}</button>;
};
/* Comic UI Kit text box — kit = 1..15 (see .tb .t1–.t15 in styles.css) */
export const Field = ({ kit = 1, className = '', ...p }) => <input {...p} className={`input ${kit ? `tb t${kit}` : ''} ${className}`} />;   // kit 0 = plain (inside .f forms)
export const Area = ({ kit = 1, className = '', ...p }) => <textarea {...p} className={`input ${kit ? `tb t${kit}` : ''} ${className}`} />;

/* OS picker used on the download box */
export const OS_LIST = [['windows', 'Windows', '🪟'], ['linux', 'Linux', '🐧'], ['macos', 'macOS', '🍎'], ['android', 'Android', '🤖']];
export const guessOs = () => { const u = (navigator.userAgent || '').toLowerCase(); return /android/.test(u) ? 'android' : /mac|iphone|ipad/.test(u) ? 'macos' : /linux|x11/.test(u) ? 'linux' : 'windows'; };
export const OsSelect = ({ value, onChange, available = [], id = 'os', kit = 1, soon = 'coming soon' }) => (
  <select id={id} className={`input tb t${kit}`} value={value} onChange={e => onChange(e.target.value)}>
    {OS_LIST.map(([k, n, ic]) => <option key={k} value={k} disabled={!available.includes(k)}>{ic} {n}{available.includes(k) ? '' : ` — ${soon}`}</option>)}
  </select>
);
export const fmtIST = x => { if (!x) return '—'; const d = new Date(x), M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(d).reduce((a, q) => ({ ...a, [q.type]: q.value }), {});
  return `${p.day}-${M[+p.month - 1]}-${p.year} ${p.hour}:${p.minute}:${p.second} IST`; };
export const GstPin = ({ gstin, label = 'GST PIN', bare }) => (gstin ? <span className="gst-pin" tabIndex={0} data-tip={label}>{!bare && <b>{label}: </b>}{gstin}</span> : null);

/* Uiverse "comic brutal" button */
export const ComicButton = ({ children, small, type = 'button', className = '', ...p }) => (
  <button type={type} className={`comic-brutal-button ${small ? 'cb-small' : ''} ${className}`} {...p}>
    <span className="button-shadow" /><span className="button-frame" />
    <span className="button-inner"><span className="halftone-overlay" /><span className="ink-splatter" /><span className="button-text">{children}</span></span>
  </button>
);

/* Uiverse doodle button (letters bounce on hover) */
export const Doodle = ({ label, type = 'button', ...p }) => (
  <button type={type} className="dd" {...p}>
    <span className="dd-bg" /><span className="dd-shine" /><span className="dd-glow" /><span className="dd-wave" /><span className="dd-circuit" /><span className="dd-outline" />
    <span className="dd-glyphs"><span className="dd-text">{[...label].map((c, i) => <span key={i} style={{ '--i': i }}>{c === ' ' ? '\u00a0' : c}</span>)}</span><span className="dd-i1" /><span className="dd-i2" /></span>
  </button>
);

/* Uiverse comic radio group with sliding glider */
export const GliderRadio = ({ name, options, value, onChange, ariaLabel }) => (
  <div className="comic-radio-group" role="radiogroup" aria-label={ariaLabel} style={{ '--n': options.length }}>
    {options.map(([v, label], i) => (
      <React.Fragment key={v}>
        <input type="radio" id={`${name}-${i}`} name={name} checked={value === v} onChange={() => onChange(v)} />
        <label htmlFor={`${name}-${i}`}>{label}</label>
      </React.Fragment>
    ))}
    <span className="comic-glider" data-i={Math.max(0, options.findIndex(o => o[0] === value))} style={{ '--i': Math.max(0, options.findIndex(o => o[0] === value)) }} />
  </div>
);

/* Uiverse comic card */
export const ComicCard = ({ avatar, title, handle, image, caption, children, style, className = '' }) => (
  <article className={`comic-card ${className}`} style={style}>
    {(title || handle) && <header className="card-header"><div className="card-avatar">{avatar}</div><div className="card-user-info"><h3 className="card-username">{title}</h3>{handle && <p className="card-handle">{handle}</p>}</div></header>}
    <div className="card-content">{image && <div className="card-image-container"><img src={image} alt="" loading="lazy" /></div>}{caption && <p className="card-caption">{caption}</p>}{children}</div>
  </article>
);

export const Count = ({ n }) => { n = Number.isFinite(+n) ? +n : 0; return <span className="count" style={{ '--to': n }}><span className="sr">{n.toLocaleString()}</span></span>; };
export const Stars = ({ value, onChange, size = '' }) => (
  <span className={`stars ${size}`} role={onChange ? 'radiogroup' : 'img'} aria-label={`${value} / 5`}>
    {[1, 2, 3, 4, 5].map(i => onChange
      ? <button type="button" key={i} className={i <= value ? 'on' : ''} style={{ '--i': i }} aria-label={`${i}`} onClick={() => onChange(i)}>★</button>
      : <i key={i} className={i <= Math.round(value) ? 'on' : ''} style={{ '--i': i }}>★</i>)}
  </span>
);
export const avg = a => (a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : 0);
export const Bar = ({ pct }) => <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100"><i style={{ width: pct + '%' }} /><span>{pct}%</span></div>;

/* Download meter: 7-digit counter + goal bar + milestone burst */
export function Meter() {
  const { content, t } = useApp(); const d = content?.downloads || 0, g = content?.goal || 200000, pct = Math.min(100, Math.round(d / g * 1000) / 10);
  const ms = [100, 75, 50, 25].find(m => pct >= m);
  return (<div className="meter">
    <h3>{t('meter.heading')} <small>— {t('meter.goal')} {g.toLocaleString('en-IN')}</small></h3>
    <div className="digits" aria-live="polite" aria-label={d.toLocaleString()}>{String(d).padStart(7, '0').split('').map((c, i) => <span key={i + c} className="digit" style={{ '--d': i }}>{c}</span>)}</div>
    <Bar pct={pct} />
    <p className="goal"><b>{d.toLocaleString('en-IN')} / {g.toLocaleString('en-IN')}</b> {t('meter.downloads')} — {pct}% {t('meter.done')}</p>
    {ms && <span className="burst-badge">🎉 {t('meter.milestone', { m: ms })}</span>}
  </div>);
}

/* Comic UI Kit slider #2 (rocket thumb) — drag (mouse / touch / pen) or arrow, Home, End, PageUp, PageDown keys.
   While dragging, particles stream out behind the thumb (canvas, no React state per particle); releasing fires a small burst. */
export function Slide({ value, onChange, step = 5, label }) {
  const ref = React.useRef(null), down = React.useRef(false), last = React.useRef(null), [dn, setDn] = React.useState(false), v = Math.max(0, Math.min(100, +value || 0));
  const thumbAt = pct => { const r = ref.current.getBoundingClientRect(); return { x: r.left + pct / 100 * r.width, y: r.top + r.height / 2, w: r.width }; };
  const emit = (pct, now) => {                            // trail between the previous thumb spot and the new one
    const t = thumbAt(pct), prev = last.current;
    if (prev && Math.abs(t.x - prev.x) > .5) {
      const dt = Math.max(8, now - prev.t), vx = (t.x - prev.x) / dt;
      if (now - prev.emit >= (isLowPower() ? 48 : 24)) { for (const f of [.5, 1]) sliderTrail(prev.x + (t.x - prev.x) * f, t.y, vx, 0); last.current = { x: t.x, t: now, emit: now }; }
    } else if (!prev) last.current = { x: t.x, t: now, emit: now };
  };
  const set = x => {
    const r = ref.current.getBoundingClientRect(), p = Math.max(0, Math.min(100, (x - r.left) / r.width * 100)), snapped = Math.round(p / step) * step;
    emit(snapped, performance.now()); onChange(snapped);
  };
  const release = () => {
    if (!down.current) return; down.current = false; setDn(false);
    const t = thumbAt(v); sliderBurst(t.x, t.y); last.current = null;
    ref.current.querySelector('.th')?.animate?.([{ scale: '1.25' }, { scale: '.86', offset: .4 }, { scale: '1.08', offset: .7 }, { scale: '1' }], { duration: 320, easing: 'ease-out' });
  };
  const key = e => {
    const d = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step, PageUp: step * 4, PageDown: -step * 4 }[e.key];
    const n = e.key === 'Home' ? 0 : e.key === 'End' ? 100 : d != null ? Math.max(0, Math.min(100, v + d)) : null;
    if (n == null) return; e.preventDefault();
    if (n !== v) { const a = thumbAt(v), b = thumbAt(n); sliderTrail(b.x, b.y, (b.x - a.x) / 16, 0); onChange(n); }
  };
  return (<div ref={ref} className={`sl s2 ${dn ? 'dn' : ''}`} role="slider" tabIndex={0} aria-label={label} aria-valuemin="0" aria-valuemax="100" aria-valuenow={v} style={{ '--v': v }}
    onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); down.current = true; last.current = null; setDn(true); set(e.clientX); }} onPointerMove={e => down.current && set(e.clientX)}
    onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release} onKeyDown={key}>
    <i className="tr" aria-hidden="true" /><i className="fl" aria-hidden="true" /><b className="th" aria-hidden="true" /></div>);
}

/* Heading whose words pop in one after another (spring overshoot). Words only — never letters — so Tamil / Hindi / Arabic shaping stays intact. */
export function ComicText({ as: Tag = 'h1', children, className = '', ...p }) {
  if (typeof children !== 'string' || !children.trim()) return <Tag className={className} {...p}>{children}</Tag>;
  const words = children.trim().split(/\s+/);
  return (<Tag key={children} className={`ct ${className}`} data-ct="" {...p}>{words.map((w, i) => <React.Fragment key={i}><span className="ct-w" style={{ '--w': i }}>{w}</span>{i < words.length - 1 && ' '}</React.Fragment>)}</Tag>);
}

/* Starburst badge (SVG): <ComicBurst color="var(--red)">404</ComicBurst> */
const BURST_PTS = Array.from({ length: 24 }, (_, i) => { const a = Math.PI * i / 12, r = i % 2 ? 31 : 49; return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`; }).join(' ');
export const ComicBurst = ({ children, color = 'var(--yellow)', className = '' }) => (
  <span className={`cburst ${className}`}><svg viewBox="-52 -52 104 104" aria-hidden="true" focusable="false"><polygon points={BURST_PTS} fill={color} /></svg><b>{children}</b></span>
);

/* Comic loading indicator: bouncing dots + the translated "loading" word */
export const Loading = ({ text }) => (<p className="comic-loading" role="status"><span className="dots" aria-hidden="true"><i /><i /><i /></span><span>{text}</span></p>);
