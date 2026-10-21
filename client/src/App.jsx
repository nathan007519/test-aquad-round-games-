import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { api, getToken, setToken } from './api.js';
import { LANGS, RTL, LATIN, makeT } from './i18n.js';
import { initSound } from './sound.js';
import { initFx } from './fx.js';
import { Ctx, useApp, Btn, Field, Area, Slide, Count, Stars, GliderRadio, GstPin, ComicText, Loading, ytId, dt, avg, SOCIAL } from './shared.jsx';
import { Gate, Updates, Home, Order, Description, Gameplay, Gallery, Reviews, About, Support, Next, Referral, Legal, NotFound, Cookie } from './pages.jsx';

function useHash() {
  const [h, setH] = useState(location.hash.slice(1) || 'home');
  useEffect(() => { const f = () => { setH(location.hash.slice(1) || 'home'); window.scrollTo(0, 0); }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return h;
}

function Header({ page }) {
  const { t, lang, setLang, user, logout } = useApp();
  const [menu, setMenu] = useState(false), [langOpen, setLangOpen] = useState(false);
  const links = user ? [['home', 'nav.home'], ['description', 'nav.description'], ['gameplay', 'nav.gameplay'], ['gallery', 'nav.gallery'], ['reviews', 'nav.reviews'], ['about', 'nav.about'], ['support', 'nav.support'], ['next', 'nav.next_game'], ['updates', 'nav.updates']] : [];
  if (user?.referral) links.push(['referral', 'nav.referral']);
  if (user?.admin) links.push(['admin', 'nav.admin']);
  return (
    <header className="top">
      <a className="logo" href="#home"><img src="/images/logo.svg" alt="" width="32" height="32" /><span>SQUAD ROUND</span></a>
      {user && <Btn className="burger" aria-label={t('nav.menu')} aria-expanded={menu} onClick={() => setMenu(m => !m)}>☰</Btn>}
      <nav className={`links ${menu ? 'open' : ''}`}>{links.map(([id, k]) => <a key={id} href={`#${id}`} className={page === id ? 'active' : ''} onClick={() => setMenu(false)}>{t(k)}</a>)}{user && <a href="#home" className="out-mob" onClick={e => { e.preventDefault(); setMenu(false); logout(); }}>⎋ {t('nav.logout')}</a>}</nav>
      <div className="tools">
        <div className="rel"><Btn kit={10} className="lang-btn" onClick={() => setLangOpen(o => !o)} aria-haspopup="true" aria-expanded={langOpen}>🌐 {lang.toUpperCase()}</Btn>
          {langOpen && <div className="lang-panel">{Object.entries(LANGS).map(([c, n]) => <button type="button" key={c} lang={c} className={c === lang ? 'cur' : ''} onClick={() => { setLang(c); setLangOpen(false); }}>{n}</button>)}</div>}</div>
        {user && <Btn kit={13} className="out-desk" onClick={logout}>{t('nav.logout')}</Btn>}
      </div>
    </header>
  );
}

function Footer() {
  const { t, content, pub } = useApp();
  return (<footer className="foot"><p>© Squad Round Games. {t('footer.rights')}</p>{(content?.gstin || pub?.gstin) && <p><GstPin gstin={content?.gstin || pub.gstin} /></p>}<p>{t('footer.disclaimer')}</p>
    <p><a href="#terms">{t('footer.legal_terms')}</a> · <a href="#privacy">{t('footer.legal_privacy')}</a> · <a href="#refund">{t('footer.legal_refund')}</a></p>
    {content?.social && <p className="soc-links">{Object.entries(content.social).map(([k, u]) => <a key={k} href={u} target="_blank" rel="noopener noreferrer">{k === 'x' ? 'X' : k[0].toUpperCase() + k.slice(1)}</a>)}</p>}</footer>);
}

/* ---------- admin dashboard ---------- */
const fileToData = f => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(f); });

function GameEditor({ initial, lang, onSave }) {
  const [g, setG] = useState(() => structuredClone(initial));
  const set = (f, v) => setG(x => ({ ...x, [f]: { ...x[f], [lang]: v } }));
  const det = (i, f, v) => setG(x => ({ ...x, details: x.details.map((d, j) => (j === i ? { ...d, [f]: v } : d)) }));
  return (<div className="panel"><h3>Game description ({lang}) — you can use {'{game}'} and {'{next}'}</h3>
    <label>Short line (Home)<Area kit={3} rows="2" value={g.short[lang] ?? ''} onChange={e => set('short', e.target.value)} /></label>
    <label>Full description (blank line = new paragraph)<Area kit={1} rows="8" value={g.long[lang] ?? ''} onChange={e => set('long', e.target.value)} /></label>
    <small>Empty text falls back to English.</small><h4>Details cards</h4>
    {g.details.map((d, i) => <div className="row nowrap" key={i}><Field kit={1} value={d.k} placeholder="Label" onChange={e => det(i, 'k', e.target.value)} /><Field kit={3} value={d.v} placeholder="Value" onChange={e => det(i, 'v', e.target.value)} /><Btn onClick={() => setG(x => ({ ...x, details: x.details.filter((_, j) => j !== i) }))}>✕</Btn></div>)}
    <div className="row"><Btn onClick={() => setG(x => ({ ...x, details: [...x.details, { k: '', v: '' }] }))}>＋ Detail</Btn><Btn color="red" onClick={() => onSave(g)}>Save</Btn></div></div>);
}
function SectionsEditor({ initial, lang, onSave }) {
  const [s, setS] = useState(() => structuredClone(initial));
  const up = (i, f, v) => setS(a => a.map((x, j) => (j === i ? { ...x, [f]: { ...x[f], [lang]: v } } : x)));
  const mv = (i, d) => setS(a => { const b = [...a], k = i + d; if (k < 0 || k >= b.length) return a; [b[i], b[k]] = [b[k], b[i]]; return b; });
  return (<div className="panel"><h3>About sections ({lang}) — {'{game}'} and {'{next}'} work here too</h3>
    {s.map((x, i) => <div className="sec" key={x.id}><Field kit={3} value={x.title[lang] ?? ''} placeholder="Title" onChange={e => up(i, 'title', e.target.value)} />
      <Area kit={3} rows="4" value={x.body[lang] ?? ''} onChange={e => up(i, 'body', e.target.value)} />
      <div className="row"><Btn onClick={() => mv(i, -1)}>↑</Btn><Btn onClick={() => mv(i, 1)}>↓</Btn><Btn onClick={() => setS(a => a.filter((_, j) => j !== i))}>✕</Btn></div></div>)}
    <div className="row"><Btn onClick={() => setS(a => [...a, { id: String(Date.now()), title: { en: '' }, body: { en: '' } }])}>＋ Section</Btn><Btn color="red" onClick={() => onSave(s)}>Save</Btn></div></div>);
}
function LegalEditor({ slug, initial, onSave }) {
  const [v, setV] = useState(initial || ''); const left = (v.match(/\[ADMIN:[^\]]*\]/g) || []).length;
  return (<div className="panel"><h3>{slug === 'terms' ? 'Terms & Conditions' : slug === 'privacy' ? 'Privacy notice' : 'No returns & exceptions'} — {'{game}'} = game name</h3>
    {left > 0 && <p className="alert">⚠ {left} part(s) still say [ADMIN: …] — edit before launch.</p>}
    <Area kit={1} rows="10" value={v} onChange={e => setV(e.target.value)} /><Btn color="red" onClick={() => onSave(v)}>Save</Btn></div>);
}

/* GSTIN + seller details: the GSTIN typed here is printed on the site footer, checkout bill preview, the invoice and the purchase mail */
const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/;
function GstinPanel({ set, setSet, onSave }) {
  const g = String(set.gstin || '').trim().toUpperCase(), ok = GSTIN_RE.test(g);
  return (<div className="panel"><h3>GSTIN &amp; seller details (printed on every bill)</h3>
    <label>GSTIN — 15 characters<Field kit={5} maxLength={15} placeholder="e.g. 33AAAAA0000A1Z5" value={set.gstin ?? ''} onChange={e => setSet({ ...set, gstin: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} /></label>
    <p className={ok ? 'badge green' : 'small'}>{ok ? `✓ Valid GSTIN format · state code ${g.slice(0, 2)}` : g ? '⚠ This does not look like a 15-character GSTIN (2 digits + PAN + entity + Z + check). You can still save it for testing.' : 'Enter your 15-character GSTIN.'}</p>
    <div className="form2">{[['bizName', 'Seller / trade name'], ['bizAddress', 'Seller address'], ['bizState', 'State (e.g. Tamil Nadu)'], ['bizStateCode', 'GST state code (e.g. 33)'], ['bizPhone', 'Seller phone']].map(([k, l]) => <label key={k}>{l}<Field kit={3} value={set[k] ?? ''} onChange={e => setSet({ ...set, [k]: e.target.value })} /></label>)}</div>
    <Btn color="red" onClick={onSave}>Save GSTIN</Btn></div>);
}

/* About page photos: you, your GST form, your studio */
const PHOTO_KINDS = [['founder', '🧑 Photo of yourself'], ['gst', '📄 GST registration form / certificate'], ['studio', '🎮 Studio environment']];
function AboutPhotos({ list, upload, onSave }) {
  const [items, setItems] = useState(list);
  useEffect(() => { setItems(list); }, [list]);
  const cap = (src, v) => setItems(a => a.map(x => (x.src === src ? { ...x, caption: v } : x)));
  return (<div className="panel"><h3>About page photos</h3><small>Shown on the About page. Images only (PNG / JPG / WEBP / GIF, up to 5 MB) — for a PDF GST form, upload a screenshot or scan of it.</small>
    {PHOTO_KINDS.map(([kind, label]) => <div key={kind}><h4>{label}</h4>
      <div className="thumbs">{items.filter(x => x.kind === kind).map(x => <figure key={x.src}><img src={x.src} alt="" /><Btn onClick={() => setItems(a => a.filter(y => y.src !== x.src))}>✕</Btn>
        <Field kit={3} placeholder="Caption (optional)" maxLength={160} value={x.caption} onChange={e => cap(x.src, e.target.value)} /></figure>)}
        <label className="bt b4 add">＋<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={async e => { const src = await upload(e.target.files[0]); e.target.value = ''; if (src) setItems(a => [...a, { src, kind, caption: '' }]); }} /></label></div></div>)}
    <Btn color="red" onClick={() => onSave(items)}>Save About photos</Btn></div>);
}

function UpdatesAdmin() {
  const { toast } = useApp(); const [list, setList] = useState([]), [f, setF] = useState({ version: '', title: '', notes: '', notify: false }), [busy, setBusy] = useState(false);
  const load = useCallback(() => api('/api/updates').then(r => r.ok && setList(r.data)), []);
  useEffect(() => { load(); }, [load]);
  const publish = async () => {
    if (!f.version.trim() || !f.notes.trim()) return toast('Version and notes are required');
    if (f.notify && !window.confirm('E-mail these notes to every buyer now?')) return;
    setBusy(true); const r = await api('/api/admin/updates', { method: 'POST', body: f }); setBusy(false);
    if (!r.ok) return toast(r.data?.error || 'Error');
    toast(r.data.emailing ? `Published — e-mailing ${r.data.emailing} buyer(s)` : 'Update published'); setF({ version: '', title: '', notes: '', notify: false }); load();
  };
  return (<div className="panel"><h3>Game updates</h3>
    <div className="form2"><label>Version<Field kit={1} placeholder="e.g. 1.0.1" value={f.version} onChange={e => setF({ ...f, version: e.target.value })} /></label>
      <label>Title (optional)<Field kit={3} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></label></div>
    <label>What's new (blank line = new paragraph)<Area kit={3} rows="6" value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></label>
    <label className="row"><input type="checkbox" checked={f.notify} onChange={e => setF({ ...f, notify: e.target.checked })} /> E-mail this update to everyone who bought</label>
    <div className="row"><Btn color="red" disabled={busy} onClick={publish}>{busy ? '…' : 'Publish update'}</Btn></div>
    <small>New builds: replace the files in <code>server/downloads/</code> (windows.*, linux.*, macos.*, android.*) — buyers always download the current file.</small>
    {list.map(u => <div className="row nowrap" key={u.id}><span className="grow"><b>v{u.version}</b> {u.title} <small>{dt(u.at)}{u.emailed ? ` · mailed to ${u.emailed}` : ''}</small></span>
      <Btn onClick={() => window.confirm('Delete this update?') && api(`/api/admin/updates/${u.id}`, { method: 'DELETE' }).then(load)}>🗑</Btn></div>)}</div>);
}

/* ---------- admin dashboard ---------- */
function Admin() {
  const { toast, content, reloadContent, user } = useApp();
  const t = useMemo(() => makeT('en'), []);                      // admin screen is always English
  const [lang, setLang] = useState('en');                          // language of the texts being edited (About / description) — English by default
  const [uq, setUq] = useState(''), [adm, setAdm] = useState(null), [game, setGame] = useState(null), [sections, setSections] = useState([]), [prog, setProg] = useState([]), [vids, setVids] = useState(''), [set, setSet] = useState(null), [nc, setNc] = useState({ code: '', pct: '' });
  const load = useCallback(async () => {
    const r = await api('/api/admin'); if (!r.ok) return;
    const arr = x => (Array.isArray(x) ? x : []), d = r.data;     // older database records may be missing fields — fill the gaps so the page never crashes
    const fix = {
      ...d, users: arr(d.users).map(u => ({ ...u, email: String(u.email ?? u._id ?? '') })), codes: arr(d.codes), reviews: arr(d.reviews), tickets: arr(d.tickets), videos: arr(d.videos),
      purchases: arr(d.purchases).map(p => ({ ...p, id: String(p.id ?? p._id ?? ''), status: p.status || 'pending' })),
      game: { short: {}, long: {}, ...d.game, details: arr(d.game?.details) },
      aboutSections: arr(d.aboutSections).map((x, i) => ({ ...x, id: x.id ?? 's' + i, title: typeof x.title === 'object' && x.title ? x.title : { en: x.title || '' }, body: typeof x.body === 'object' && x.body ? x.body : { en: x.body || '' } })),
      media: { poster: '', aboutLayout: 'right', ...d.media, gallery: arr(d.media?.gallery), aboutImages: arr(d.media?.aboutImages), aboutPhotos: arr(d.media?.aboutPhotos) },
      settings: { ...d.settings, social: { ...d.settings?.social } }, legal: { terms: '', privacy: '', refund: '', ...d.legal },
    };
    setAdm(fix); setGame(g => g || structuredClone(fix.game)); setSections(s => s.length ? s : structuredClone(fix.aboutSections)); setSet(s => s || structuredClone(fix.settings));
    setVids(fix.videos.map(v => `${v.id} ${v.title || ''}`).join('\n'));
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (content) setProg((Array.isArray(content.progress) ? content.progress : []).map(ph => ({ ...ph, tasks: Array.isArray(ph.tasks) ? ph.tasks : [] }))); }, [content]);
  if (!user?.admin) return <div className="panel">403</div>;
  const call = async (url, method, body, after) => { const r = await api(url, { method, body }); toast(r.ok ? t('about.saved') : t('error.generic')); if (r.ok) { await load(); reloadContent(); after?.(); } return r; };
  const upload = async f => { if (!f) return null; const r = await api('/api/admin/upload', { method: 'POST', body: { data: await fileToData(f) } }); if (!r.ok) { toast(r.data.error || t('error.generic')); return null; } return r.data.src; };
  const media = adm?.media; const setMedia = patch => call('/api/admin/media', 'PUT', patch);
  const setPct = (pi, ti, v) => setProg(p => p.map((ph, i) => i !== pi ? ph : { ...ph, tasks: ph.tasks.map((x, j) => j === ti ? { ...x, pct: +v } : x) }));
  const ImgList = ({ list, onChange }) => (<div className="thumbs">{list.map(s => <figure key={s}><img src={s} alt="" /><Btn onClick={() => onChange(list.filter(x => x !== s))}>✕</Btn></figure>)}
    <label className="bt b4 add">＋<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={async e => { const src = await upload(e.target.files[0]); e.target.value = ''; if (src) onChange([...list, src]); }} /></label></div>);
  return (<><ComicText>{t('nav.admin')}</ComicText>
    <div className="panel"><label>Language of the texts you edit below (About, description): <select className="input" value={lang} onChange={e => setLang(e.target.value)}>{Object.entries(LANGS).map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select></label></div>
    {adm && <div className="panel stat-row"><div><b className="big"><Count n={adm.downloads} /></b><small>downloads</small></div><div><b className="big"><Count n={adm.users.length} /></b><small>users</small></div>
      <div><b className="big"><Count n={adm.users.filter(u => u.approved).length} /></b><small>approved</small></div><div><b className="big"><Count n={adm.purchases.filter(p => p.status === 'pending').length} /></b><small>pending orders</small></div></div>}

    {set && <GstinPanel set={set} setSet={setSet} onSave={() => call('/api/admin/settings', 'PUT', set)} />}

    <div className="panel scroll"><h3>Users &amp; referral approval</h3>
      <div className="row nowrap search"><Field kit={1} type="search" placeholder="🔍 Search email…" aria-label="Search users by email" value={uq} onChange={e => setUq(e.target.value)} />{uq && <Btn onClick={() => setUq('')}>✕</Btn>}</div>
      {adm && <p className="small">{adm.users.filter(u => u.email.toLowerCase().includes(uq.trim().toLowerCase())).length} / {adm.users.length}</p>}
      <table><thead><tr><th>Email</th><th>Joined</th><th>Last login</th><th>Referral</th><th>Promo code</th><th>Used</th></tr></thead>
        <tbody>{adm?.users.filter(u => u.email.toLowerCase().includes(uq.trim().toLowerCase())).map(u => <tr key={u.email}><td>{u.email}</td><td>{dt(u.at)}</td><td>{dt(u.last)}</td>
          <td><label className="switch"><input type="checkbox" checked={!!u.approved} onChange={e => call(`/api/admin/users/${encodeURIComponent(u.email)}/approve`, 'PUT', { approved: e.target.checked })} /><span /></label></td>
          <td><code>{u.code || '—'}</code></td><td>{u.uses}</td></tr>)}{adm && !adm.users.some(u => u.email.toLowerCase().includes(uq.trim().toLowerCase())) && <tr><td colSpan="6">No user matches “{uq}”.</td></tr>}</tbody></table></div>

    <div className="panel scroll"><h3>Promo codes</h3>
      <div className="row nowrap"><Field kit={5} placeholder="CODE" value={nc.code} onChange={e => setNc({ ...nc, code: e.target.value.toUpperCase() })} /><Field kit={5} placeholder="%" inputMode="numeric" value={nc.pct} onChange={e => setNc({ ...nc, pct: e.target.value })} />
        <Btn color="red" onClick={() => call('/api/admin/codes', 'POST', { code: nc.code, pct: +nc.pct }, () => setNc({ code: '', pct: '' }))}>＋</Btn></div>
      <table><thead><tr><th>Code</th><th>Owner</th><th>%</th><th>Used</th><th>Active</th></tr></thead>
        <tbody>{adm?.codes.map(c => <tr key={c.code}><td><code>{c.code}</code></td><td>{c.owner || '(general)'}</td><td>{c.pct}</td><td>{c.uses}</td><td>{c.active ? '✓' : '✗'}</td></tr>)}</tbody></table></div>

    <div className="panel scroll"><h3>Purchases (MongoDB)</h3>
      <table><thead><tr><th>Date &amp; time</th><th>Purchase ID</th><th>Customer</th><th>Game</th><th>Total</th><th>Discount</th><th>Paid</th><th>Method</th><th>Code</th><th>Downloads</th><th>Status</th><th /></tr></thead>
        <tbody>{adm?.purchases.map(p => <tr key={p.id}><td>{dt(p.paidAt || p.failedAt || p.createdAt)}</td><td><code>{p.id.slice(0, 8)}</code></td><td>{p.billing?.name ? <b>{p.billing.name}</b> : null}{p.billing?.phone ? <small><br />{p.billing.phone}</small> : null}<small><br />{p.email}</small></td><td>{p.gameName}</td><td>{p.listPrice}</td><td>{p.discount}</td><td>{p.amountPaid}</td><td>{p.payThrough ? `${p.payThrough} · ` : ''}{p.paymentMethod}</td><td>{p.promoCode || '—'}</td><td>{p.downloads || 0}{p.lastDownloadOs ? <small><br />{p.lastDownloadOs}</small> : ''}</td>
          <td><span className={`badge st-${p.status}`}>{p.status.toUpperCase()}</span>{p.failReason && <small><br />{p.failReason}</small>}{p.flag && <small><br />⚠ {p.flag}</small>}</td>
          <td>{p.status === 'completed' && <div><small>{p.receiptSent ? '✉ bill sent' : `✉ not sent${p.receiptError ? ': ' + p.receiptError : ' yet'}`}</small><br /><Btn onClick={() => call(`/api/admin/purchases/${p.id}/resend-bill`, 'POST')}>Resend bill</Btn></div>}{p.status === 'pending' && <div className="row nowrap">{['completed', 'failed', 'cancelled'].map(x => <Btn key={x} onClick={() => call(`/api/admin/purchases/${p.id}`, 'PUT', { status: x, reason: x === 'failed' ? (window.prompt('Reason for failure (optional)') || undefined) : undefined })}>{x === 'completed' ? '✓ Paid' : x === 'failed' ? 'Fail' : 'Cancel'}</Btn>)}</div>}</td></tr>)}</tbody></table>
      <p><small>Referral, promo and download counters go up only when an order becomes “completed”. Failed orders are kept here marked FAILED.</small></p></div>

    {set && <div className="panel"><h3>Goal, price &amp; social links</h3><div className="form2">
      {[['goal', 'Download goal'], ['baseDownloads', 'Downloads before this system'], ['price', 'Game price BEFORE GST (₹) — 18% GST is added at checkout'], ['refPct', 'Referral discount %'], ['txnPct', 'Transaction charge % (0 = none)']].map(([k, l]) => <label key={k}>{l}<Field kit={5} inputMode="decimal" value={set[k]} onChange={e => setSet({ ...set, [k]: e.target.value })} /></label>)}
      {[['gameName', 'Game name (shown everywhere)'], ['nextGame', 'Next game name'], ['sac', 'Invoice: SAC code (default 998439 — confirm with your CA)'], ['supportEmail', 'Invoice: support e-mail'], ['invPrefix', 'Invoice number prefix (1–4 letters/digits, e.g. SRG → SRG/26-27/000001)']].map(([k, l]) => <label key={k}>{l}<Field kit={3} value={set[k] ?? ''} onChange={e => setSet({ ...set, [k]: e.target.value })} /></label>)}
      {SOCIAL.map(([k, n]) => <label key={k}>{n} URL<Field kit={1} value={set.social[k]} onChange={e => setSet({ ...set, social: { ...set.social, [k]: e.target.value } })} /></label>)}</div>
      <Btn color="red" onClick={() => call('/api/admin/settings', 'PUT', set)}>{t('cta.save')}</Btn></div>}

    {media && <div className="panel"><h3>Poster</h3><img className="poster-prev" src={media.poster} alt="" />
      <label className="bt b10">Change poster<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={async e => { const s = await upload(e.target.files[0]); e.target.value = ''; if (s) setMedia({ poster: s }); }} /></label>
      <h3>Gallery</h3><ImgList list={media.gallery} onChange={g => setMedia({ gallery: g })} />
      <h3>About images &amp; layout</h3><ImgList list={media.aboutImages} onChange={g => setMedia({ aboutImages: g })} />
      <GliderRadio name="lay" options={[['right', 'RIGHT'], ['left', 'LEFT'], ['top', 'TOP'], ['grid', 'GRID']]} value={media.aboutLayout} onChange={v => setMedia({ aboutLayout: v })} ariaLabel="About layout" /></div>}

    {media && <AboutPhotos list={media.aboutPhotos} upload={upload} onSave={items => setMedia({ aboutPhotos: items })} />}
    <UpdatesAdmin />
    {adm && <GameEditor initial={adm.game} lang={lang} onSave={g => call('/api/admin/game', 'PUT', g)} />}
    {adm && <SectionsEditor initial={adm.aboutSections} lang={lang} onSave={s => call('/api/admin/about', 'PUT', { sections: s })} />}
    {adm && ['terms', 'privacy', 'refund'].map(k => <LegalEditor key={k} slug={k} initial={adm.legal[k]} onSave={v => call(`/api/admin/legal/${k}`, 'PUT', { text: v })} />)}
    <div className="panel"><h3>{content?.nextGame}</h3>{prog.map((p, pi) => <div key={p.phase}><b>{p.phase}</b>{p.tasks.map((x, ti) => <div className="slide" key={x.name}><span>{x.name}</span>
      <Slide label={x.name} value={x.pct} onChange={v => setPct(pi, ti, v)} /><em>{x.pct}%</em></div>)}</div>)}
      <Btn color="red" onClick={() => call('/api/admin/progress', 'PUT', { progress: prog })}>{t('cta.save')}</Btn></div>
    <div className="panel"><h3>{t('nav.gameplay')} — YouTube link + optional title per line</h3><Area kit={3} rows="5" value={vids} onChange={e => setVids(e.target.value)} />
      <Btn color="red" onClick={() => call('/api/admin/videos', 'PUT', { videos: vids.split('\n').map(l => { const [u, ...r] = l.trim().split(/\s+/); return { id: ytId(u), title: r.join(' ') }; }).filter(v => v.id) })}>{t('cta.save')}</Btn></div>
    <div className="panel"><h3>{t('nav.reviews')}</h3>{adm?.reviews.map(r => <div className="row nowrap" key={r.id}><span className="grow"><Stars value={r.rating || 0} /> <b>{r.email}</b>{r.verified ? ' ✔' : ''}: {r.text}</span>
      <Btn color={r.ok ? 'blue' : 'red'} onClick={() => call(`/api/admin/reviews/${r.id}`, 'PUT', { ok: !r.ok })}>{r.ok ? 'Hide' : 'Show'}</Btn><Btn onClick={() => window.confirm('Delete this review?') && call(`/api/admin/reviews/${r.id}`, 'DELETE')}>🗑</Btn></div>)}</div>
    <div className="panel"><h3>{t('support.title')}</h3>{adm?.tickets.slice().reverse().map((k, i) => <p key={i}><b>{k.email}</b> <small>{dt(k.at)}</small><br />{k.message}</p>)}</div>
  </>);
}


/* ---------- error box: a crash on one page shows its message instead of a blank screen ---------- */
class Boundary extends React.Component {
  state = { e: null };
  static getDerivedStateFromError(e) { return { e }; }
  render() { return this.state.e ? <div className="panel"><h3>Something went wrong on this page</h3><p>Reload the page. If it keeps happening, send this text to the developer:</p><pre style={{ whiteSpace: 'pre-wrap', overflowX: 'auto' }}>{String(this.state.e?.stack || this.state.e).slice(0, 1500)}</pre></div> : this.props.children; }
}

/* ---------- app shell ---------- */
const PUBLIC_PAGES = ['terms', 'privacy', 'refund'];
export default function App() {
  const [lang, setLangState] = useState(() => { const s = localStorage.getItem('srg_lang'); return s && LANGS[s] ? s : 'en'; }), [user, setUser] = useState(null), [content, setContent] = useState(null), [pub, setPub] = useState(null);
  const [ready, setReady] = useState(!getToken()), [toasts, setToasts] = useState([]), page = useHash();
  const t = useMemo(() => makeT(lang), [lang]);
  const setLang = l => { setLangState(l); localStorage.setItem('srg_lang', l); };
  useEffect(() => { initSound(); initFx(); }, []);
  useEffect(() => { const h = document.documentElement; h.lang = lang; h.dir = RTL.includes(lang) ? 'rtl' : 'ltr'; h.dataset.latin = LATIN.includes(lang) ? '1' : '0'; }, [lang]);
  const toast = useCallback(m => { const id = Math.random(); setToasts(x => [...x, { id, m }]); setTimeout(() => setToasts(x => x.filter(y => y.id !== id)), 4500); }, []);
  const reloadContent = useCallback(() => api('/api/content').then(r => r.ok && setContent(r.data)), []);
  useEffect(() => {
    api('/api/public').then(r => r.ok && setPub(r.data));
    const q = new URLSearchParams(location.search), pc = q.get('code'); if (pc) localStorage.setItem('srg_code', pc.toUpperCase());
    if (getToken()) api('/api/me').then(r => { if (r.ok) setUser(r.data); else setToken(''); setReady(true); });
  }, []);
  useEffect(() => { if (user) reloadContent(); else setContent(null); }, [user, reloadContent]);
  useEffect(() => { if (!user) return; const id = setInterval(() => api('/api/stats').then(r => r.ok && setContent(c => (c ? { ...c, ...r.data } : c))), 15000); return () => clearInterval(id); }, [user]);
  const logout = () => { setToken(''); setUser(null); location.hash = 'home'; };
  const ctx = { t, lang, setLang, user, setUser, logout, toast, content, reloadContent, pub };
  const [root, arg] = page.split('/');
  const PAGES = { home: Home, description: Description, gameplay: Gameplay, gallery: Gallery, reviews: Reviews, about: About, support: Support, next: Next, referral: Referral, updates: Updates, admin: Admin };
  let body;
  if (PUBLIC_PAGES.includes(root)) body = <Legal slug={root} />;
  else if (!ready) body = <Loading text={t('common.loading')} />;
  else if (!user) body = <Gate />;
  else if (!content) body = <Loading text={t('common.loading')} />;
  else if (root === 'order' && arg) body = <Order id={arg} />;
  else { const P = PAGES[root]; body = P ? <P /> : <NotFound />; }
  return (
    <Ctx.Provider value={ctx}>
      <Header page={root} />
      <main className="wrap" key={root}><Boundary key={root + (arg || '')}>{body}</Boundary></main>
      <Footer /><Cookie />
      <div className="toasts" role="status">{toasts.map(x => <div key={x.id} className="toast">{x.m}</div>)}</div>
    </Ctx.Provider>
  );
}
