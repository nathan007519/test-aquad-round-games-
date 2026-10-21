import React, { useEffect, useState, useCallback, useRef } from 'react';
import { api, setToken } from './api.js';
import { LANGS } from './i18n.js';
import { sfx } from './sound.js';
import { useApp, Btn, Field, Area, ComicButton, ComicCard, ComicText, ComicBurst, Loading, Count, Stars, Bar, Meter, OsSelect, OS_LIST, GstPin, guessOs, fmtIST, avg, inr, dt, fill, L, SOCIAL, calcBill } from './shared.jsx';

const PIC = ['poster', 'shot1', 'shot2', 'shot3', 'shot4', 'shot5'].map(n => `/images/${n}.svg`);

/* ---------- landing + login (the site is only visible after login) ---------- */
export function Gate() {
  const { t, setUser, toast, pub, lang } = useApp();
  const [email, setEmail] = useState(''), [code, setCode] = useState(''), [sent, setSent] = useState(false), [sending, setSending] = useState(false), [busy, setBusy] = useState(false), [wait, setWait] = useState(0), [lock, setLock] = useState(0);
  useEffect(() => { if (wait <= 0) return; const id = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(id); }, [wait]);
  useEffect(() => { if (lock <= 0) return; const id = setTimeout(() => setLock(lock - 1), 1000); return () => clearTimeout(id); }, [lock]);
  const send = async () => {
    // Show the code box straight away (the e-mail takes a couple of seconds to leave the server); undo it only if sending fails.
    const first = !sent; setBusy(true); setSending(true); if (first) { setSent(true); setCode(''); }
    const r = await api('/api/otp/request', { method: 'POST', body: { email, lang } }); setBusy(false); setSending(false);
    if (r.ok) { setCode(''); setWait(30); toast(t('login.sent')); return; }
    if (first) setSent(false);
    if (r.data.error === 'wait') setLock(r.data.retry); else if (r.data.error === 'cooldown') setWait(r.data.retry);
    else toast(r.data.error === 'invalid_email' ? t('form.required') : t('login.fail'));
  };
  const verify = async () => {
    setBusy(true); const r = await api('/api/otp/verify', { method: 'POST', body: { email, code } }); setBusy(false);
    if (!r.ok) { if (r.data.retry) { setLock(r.data.retry); setCode(''); return; } return toast(t(r.data.error === 'expired' ? 'otp.expired' : 'otp.invalid')); }
    setToken(r.data.token); setUser(r.data.user); toast(t('otp.success'));
  };
  const blocked = lock > 0, game = pub?.gameName || '';
  return (
    <section className="landing">
      <div className="rise">
        <p className="narr">{t('landing.tag')}</p>
        <ComicText className="giant title">{game}</ComicText>
        <p className="speed panel">{t('notice.no_returns')}{pub?.price ? ` · ${inr(pub.price)} ${t('price.plus_gst')}` : ''}</p>
        <form className="f f1 pop login-card" onSubmit={e => { e.preventDefault(); if (busy || blocked) return; if (sent) { if (code.length === 7) verify(); } else if (email) send(); }}>
          <h4>{t('otp.title')}</h4><p>{t('otp.desc')}</p>
          {blocked && <p className="alert shake" role="alert">⏳ {t('otp.wait30', { s: lock })}</p>}
          <Field kit={0} type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} disabled={sent} autoComplete="email" aria-label="Email" />
          {!sent ? <Btn kit={1} type="submit" disabled={busy || !email || blocked}>{t('cta.send')}</Btn> : (<>
            {sending && <p className="sending" role="status">⏳ {t('login.sending')}</p>}
            <Field kit={0} className="code-in" inputMode="numeric" maxLength={7} placeholder={t('otp.enter')} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} disabled={blocked} aria-label={t('otp.enter')} />
            <div className="row"><Btn kit={15} type="submit" disabled={busy || sending || code.length !== 7 || blocked}>{t('otp.verify')}</Btn>
              <Btn kit={4} onClick={send} disabled={wait > 0 || blocked || busy || sending}>{wait > 0 ? t('otp.resend_in', { s: wait }) : t('cta.resend')}</Btn></div></>)}
        </form>
      </div>
      <div className="poster-wrap"><img className="poster" src={pub?.poster || '/images/poster.svg'} alt={game} /></div>
    </section>
  );
}

/* ---------- terms pop-up ---------- */
function closePage() { sfx.no(); window.close(); setTimeout(() => location.replace('about:blank'), 150); }
export function TermsModal({ text, onOk }) {
  const { t, content } = useApp(); const box = useRef(null), [end, setEnd] = useState(false);
  const check = useCallback(() => { const b = box.current; if (b && b.scrollTop + b.clientHeight >= b.scrollHeight - 8) setEnd(true); }, []);
  useEffect(() => { check(); }, [check, text]);
  const blocks = fill(text, content).split(/\n{2,}/);
  return (
    <div className="modal"><div className="panel modal-box terms pop" role="dialog" aria-modal="true" aria-label="Terms and Conditions">
      <div className="terms-body" ref={box} onScroll={check} tabIndex={0}>{blocks.map((b, i) => /^\d+\. /.test(b) ? <h3 key={i}>{b}</h3> : i === 0 ? <h2 key={i}>{b}</h2> : <p key={i}>{b}</p>)}</div>
      {!end && <p className="hint">⬇ {t('terms.scroll')}</p>}
      <div className="row"><ComicButton small disabled={!end} onClick={() => { sfx.ok(); onOk(); }}>{t('terms.ok')}</ComicButton><Btn kit={9} onClick={closePage}>{t('terms.no')}</Btn></div>
    </div></div>
  );
}

/* ---------- enter the e-mailed payment code (used in the pay pop-up AND on a pending order page) ---------- */
function ConfirmCode({ id, email, onDone, onCancel }) {
  const { t, toast } = useApp(); const [pin, setPin] = useState(''), [busy, setBusy] = useState(false), [wait, setWait] = useState(30);
  useEffect(() => { if (wait <= 0) return; const x = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(x); }, [wait]);
  const verify = async () => {
    setBusy(true); const r = await api(`/api/orders/${id}/confirm`, { method: 'POST', body: { code: pin } }); setBusy(false);
    if (r.ok) { sfx.ok(); toast(t('pay.verified')); return onDone(); }
    setPin(''); toast(t(r.data.error === 'expired' ? 'pay.code_expired' : r.data.error === 'invalid' ? 'pay.code_bad' : 'error.generic'));
  };
  const resend = async () => { const r = await api(`/api/orders/${id}/code`, { method: 'POST' }); if (r.ok) { setWait(30); toast(t('login.sent')); } else if (r.data.retry) setWait(r.data.retry); else toast(t('pay.mail_fail')); };
  return (<>
    <p>{email ? t('pay.code_sent', { e: email }) : t('order.enter_code')}</p>
    <Field kit={15} className="code-in" inputMode="numeric" maxLength={6} placeholder="••••••" aria-label={t('pay.code_ph')} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} autoFocus />
    <div className="row"><Btn kit={15} disabled={busy || pin.length !== 6} onClick={verify}>{busy ? t('common.loading') : t('pay.verify_pay')}</Btn>
      <Btn kit={3} disabled={wait > 0 || busy} onClick={resend}>{wait > 0 ? t('pay.resend_in', { s: wait }) : t('pay.resend')}</Btn>
      {onCancel && <Btn kit={9} onClick={onCancel}>{t('cta.close')}</Btn>}</div>
  </>);
}

/* ---------- bill rows (price BEFORE GST): used by the checkout preview AND the final invoice ---------- */
const money = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function BillRows({ b, totalKey = 'inv.total' }) {
  const { t } = useApp();
  return (<div className="inv-table inv-comic">
    <div className="inv-row head"><span>{t('inv.desc')}</span><span>{t('inv.amount')}</span></div>
    <div className="inv-row"><span>{t('inv.gross')}</span><span className="num">{money(b.priceExcl)}</span></div>
    {b.discount > 0 && <div className="inv-row disc"><span>{b.promoCode ? t('inv.disc', { c: b.promoCode }) : t('pay.discount')} ({b.discountPct}%)</span><span className="num">-{money(b.discount)}</span></div>}
    <div className="inv-row"><span>{t('inv.taxable')}</span><span className="num">{money(b.taxable)}</span></div>
    <div className="inv-row"><span>{t('inv.cgst', { r: b.cgstRate })}<span className="taxchip">GST</span></span><span className="num">+ {money(b.cgst)}</span></div>
    <div className="inv-row"><span>{t('inv.sgst', { r: b.sgstRate })}<span className="taxchip">GST</span></span><span className="num">+ {money(b.sgst)}</span></div>
    <div className="inv-row incl"><span>{t('inv.gst_total', { r: b.gstRate })}</span><span className="num">+ {money(b.gstAmount)}</span></div>
    {b.txnCharge > 0 && <div className="inv-row"><span>{t('inv.fee', { p: b.txnPct })}</span><span className="num">{money(b.txnCharge)}</span></div>}
    <div className="inv-row total"><span>{t(totalKey)}</span><span className="num">{money(b.amountPaid)}</span></div>
  </div>);
}

/* ---------- TEST DEMO checkout pop-up: 1 billing details -> 2 bill preview -> 3 e-mailed code -> paid.
   The tax invoice itself is e-mailed by the server only after the code is verified. ---------- */
const PAY_THROUGH = ['UPI', 'Card', 'Net Banking'];
function PayModal({ code, onClose }) {
  const { t, toast, pub, lang } = useApp();
  const [step, setStep] = useState('form'), [f, setF] = useState({ name: '', phone: '', address: '', through: 'UPI' }), [q, setQ] = useState(null), [order, setOrder] = useState(null), [busy, setBusy] = useState(false);
  const set = k => e => setF(x => ({ ...x, [k]: e.target.value }));
  const okForm = f.name.trim().length >= 2 && /^\+?\d{7,15}$/.test(f.phone.replace(/[^\d+]/g, '')) && f.address.trim().length >= 10;
  const preview = async () => {
    if (!okForm) return toast(t('pay.bad_billing'));
    setBusy(true); const r = await api('/api/quote', { method: 'POST', body: { code: code || undefined } }); setBusy(false);
    if (!r.ok) return toast(t(r.data.error === 'bad_code' ? 'code.bad' : 'error.generic'));
    setQ(r.data); setStep('bill');
  };
  const send = async () => {
    setBusy(true); const r = await api('/api/orders', { method: 'POST', body: { code: code || undefined, lang, payThrough: f.through, billing: { name: f.name, phone: f.phone, address: f.address } } }); setBusy(false);
    if (!r.ok) return toast(t(r.data.error === 'bad_code' ? 'code.bad' : r.data.error === 'bad_billing' ? 'pay.bad_billing' : r.data.error === 'mail_failed' ? 'pay.mail_fail' : r.data.error === 'payments_off' ? 'pay.off' : 'error.generic'));
    setOrder(r.data); setStep('code'); toast(t('login.sent'));
  };
  const steps = [['form', 'pay.s_details'], ['bill', 'pay.s_bill'], ['code', 'pay.s_code']];
  return (
    <div className="modal" onClick={onClose}><div className="panel modal-box pay pop" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
      <h2>{t('pay.demo_title')} <span className="demo-flag">{t('pay.test')}</span></h2>
      <p className="small">{t('pay.demo')}</p>
      <div className="pay-steps" aria-hidden="true">{steps.map(([k, l]) => <span key={k} className={step === k ? 'on' : ''}>{t(l)}</span>)}</div>
      {step === 'form' && <form className="bill-form" onSubmit={e => { e.preventDefault(); preview(); }}>
        <h3>{t('pay.billing_title')}</h3>
        <label>{t('pay.name')}<Field kit={1} autoComplete="name" maxLength={80} value={f.name} onChange={set('name')} /></label>
        <label>{t('pay.phone')}<Field kit={3} type="tel" inputMode="tel" autoComplete="tel" maxLength={16} placeholder="+91 98765 43210" value={f.phone} onChange={set('phone')} /></label>
        <label>{t('pay.address')}<Area kit={3} rows="3" autoComplete="street-address" maxLength={300} value={f.address} onChange={set('address')} /></label>
        <label>{t('pay.through')}<select className="input tb t1" value={f.through} onChange={set('through')}>{PAY_THROUGH.map(m => <option key={m} value={m}>{m}</option>)}</select></label>
        <div className="row"><Btn kit={15} type="submit" disabled={busy}>{busy ? t('common.loading') : t('pay.see_bill')}</Btn><Btn kit={9} onClick={onClose}>{t('cta.close')}</Btn></div>
      </form>}
      {step === 'bill' && q && <>
        <div className="bill-prev inv-box-sm"><span className="demo-flag">{t('pay.preview')}</span>
          <p className="inv-comic"><b>{q.biz?.name}</b>{q.biz?.address ? <><br /><small>{q.biz.address}</small></> : null}{q.gstin && <><br /><GstPin gstin={q.gstin} /></>}</p>
          <p className="inv-comic"><b>{t('inv.buyer')}:</b> {f.name}<br />{f.phone}<br /><small>{f.address}</small><br /><b>{t('inv.paythrough')}:</b> {f.through} <small>({t('pay.test')})</small></p>
          <p className="inv-comic"><b>{t('inv.item')}:</b> {q.gameName}</p>
          <BillRows b={q} totalKey="inv.payable" /></div>
        <p className="small">{t('pay.preview_note')}</p>
        <div className="row"><Btn kit={15} disabled={busy} onClick={send}>{busy ? t('common.loading') : t('pay.confirm')}</Btn><Btn kit={4} disabled={busy} onClick={() => setStep('form')}>{t('pay.back')}</Btn></div>
      </>}
      {step === 'code' && order && <ConfirmCode id={order.id} email={order.email} onDone={() => { location.hash = `order/${order.id}`; onClose(); }} onCancel={onClose} />}
      <p className="small">{t('notice.no_returns')}</p>
    </div></div>
  );
}

export function MyOrders({ refreshKey }) {
  const { user, t } = useApp(); const [list, setList] = useState([]);
  useEffect(() => { if (user) api('/api/my/orders').then(r => r.ok && setList(r.data)); }, [user, refreshKey]);
  if (!list.length) return null;
  return (<div className="panel scroll"><h3>{t('orders.title')}</h3>
    <table><thead><tr><th>{t('orders.date')}</th><th>ID</th><th>{t('orders.paid')}</th><th>{t('orders.status')}</th></tr></thead>
      <tbody>{list.map(o => <tr key={o._id}><td>{dt(o.paidAt || o.failedAt || o.createdAt)}</td><td><a href={`#order/${o._id}`}><code>{o._id.slice(0, 8)}</code></a></td>
        <td>{inr(o.amountPaid)}<br /><small>{o.paymentMethod}{o.discount ? ` · −${inr(o.discount)}` : ''}</small></td>
        <td><span className={`badge st-${o.status}`}>{t(ST_LABEL[o.status] || 'ord.pending').toUpperCase()}</span>{o.failReason && <small><br />{o.failReason}</small>}</td></tr>)}</tbody></table></div>);
}

/* ---------- Download button + OS dropdown (shown on Home once the game is bought) ---------- */
function DownloadMenu({ orderId, avail }) {
  const { t } = useApp(); const [open, setOpen] = useState(false), [busy, setBusy] = useState(''), [msg, setMsg] = useState(null), ref = useRef(null);
  useEffect(() => { const h = e => { if (!ref.current?.contains(e.target)) setOpen(false); }; const k = e => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', h); document.addEventListener('keydown', k); return () => { document.removeEventListener('pointerdown', h); document.removeEventListener('keydown', k); }; }, []);
  const get = async os => {
    setOpen(false); setBusy(os); setMsg({ ok: true, text: t('dl.verifying') });
    const r = await api(`/api/orders/${orderId}/download`, { method: 'POST', body: { os } }); setBusy('');
    if (!r.ok) return setMsg({ ok: false, text: t(r.data.error === 'no_build' ? 'dl.nobuild' : r.data.error === 'not_paid' ? 'dl.notpaid' : 'error.generic') });
    setMsg({ ok: true, text: t('dl.start'), go: true }); sfx.ok();
    const a = document.createElement('a'); a.href = r.data.url; a.download = ''; document.body.append(a); a.click(); a.remove();
  };
  const first = avail.includes(guessOs()) ? guessOs() : avail[0];
  return (<div className="dl-split" ref={ref}>
    <p className="badge green">{t('dl.owned')}</p>
    <div className="dl-anchor">
      <div className="row nowrap">
        <Btn kit={15} disabled={!!busy || !first} onClick={() => get(first)}>⬇ {t('dl.main')}</Btn>
        <Btn kit={4} aria-haspopup="menu" aria-expanded={open} aria-label={t('dl.os')} title={t('dl.os')} onClick={() => setOpen(o => !o)}>▾</Btn>
      </div>
      {open && <ul className="dl-menu" role="menu" aria-label={t('dl.os')}>
        {OS_LIST.map(([k, n, ic]) => <li key={k} role="none"><button type="button" role="menuitem" disabled={!avail.includes(k)} onClick={() => get(k)}>{ic} {n}{avail.includes(k) ? '' : ` — ${t('dl.soon')}`}</button></li>)}
      </ul>}
    </div>
    {msg && <p className={`dl-msg ${msg.ok ? '' : 'err'}`} role="status">{msg.text}</p>}{msg?.go && <div className="dl-prog" key={Date.now()}><i /></div>}
  </div>);
}

/* ---------- home ---------- */
export function Home() {
  const { t, user, toast, content, lang } = useApp();
  const [code, setCode] = useState(localStorage.getItem('srg_code') || ''), [pct, setPct] = useState(0), [terms, setTerms] = useState(false), [showTerms, setShowTerms] = useState(false), [pay, setPay] = useState(false), [own, setOwn] = useState(null);
  useEffect(() => { if (!user) return setOwn(null); api('/api/my/purchase').then(r => setOwn(r.ok && r.data.purchased ? r.data : null)); }, [user, pay]);
  const game = content?.gameName || '', price = content?.price ?? 0, g = content?.game, gal = content?.media?.gallery || PIC;
  const apply = async () => { const r = await api('/api/promo', { method: 'POST', body: { code } }); if (r.ok) { setPct(r.data.pct); toast(t('code.ok', { p: r.data.pct })); } else { setPct(0); toast(t('code.bad')); } };
  const buy = () => { if (!terms) return toast(t('accept')); setPay(true); };
  const share = async () => {
    const r = await api('/api/referral'); if (!r.ok || !r.data.link) return toast(t('error.generic'));
    if (navigator.share) try { await navigator.share({ url: r.data.link }); } catch { /* cancelled */ } else { await navigator.clipboard.writeText(r.data.link); toast(t('ref.copied')); }
  };
  const bl = calcBill(price, pct, content?.txnPct || 0);
  return (
    <section className="hero">
      <div className="rise">
        <p className="narr">{t('game.now')}</p>
        <ComicText className="title">{game}</ComicText>
        <p className="lead">{fill(L(g?.short, lang), content)}</p>
        <p className="dl"><span className="burst">💥</span> <b><Count n={content?.downloads || 0} /></b> <span>{t('meter.downloads')}</span> {content?.rating > 0 && <><Stars value={content.rating} /> <small>{content.rating} ({content.reviewCount})</small></>}</p>
        <Meter />
        {own ? <div className="panel dl-panel"><DownloadMenu orderId={own.orderId} avail={own.downloadOs || []} /></div> : (
        <div className="panel">
          <div className="row price-row"><div><h2 className="price">{pct > 0 && <s>{inr(price)}</s>} {inr(bl.taxable)} <small>{t('price.plus_gst')}</small></h2>
            <p className="small">{t('inv.cgst', { r: 9 })} {inr(bl.cgst)} · {t('inv.sgst', { r: 9 })} {inr(bl.sgst)} · {t('inv.gst_total', { r: 18 })} {inr(bl.gst)}</p>
            <span className="badge green">{t('price.total_with_gst')}: {inr(bl.total)}</span> <span className="badge red">{t('notice.no_returns')}</span></div></div>
          <label className="lbl" htmlFor="code">{t('code.label')}</label>
          <div className="row nowrap"><Field kit={5} id="code" placeholder={t('code.placeholder')} value={code} onChange={e => setCode(e.target.value.toUpperCase())} /><Btn kit={12} tip="GO!" onClick={apply} disabled={!code}>{t('cta.apply')}</Btn></div>
          {pct > 0 && <p className="badge green">-{pct}%</p>}
          <label className="check"><input type="checkbox" checked={terms} onChange={e => (e.target.checked ? setShowTerms(true) : setTerms(false))} /> <span>{t('terms.required')} <a href="#terms" target="_blank" rel="noreferrer">{t('footer.legal_terms')}</a></span></label>
          <div className="row"><ComicButton onClick={buy}>{t('cta.buy_now')}</ComicButton>{user?.referral && <Btn kit={4} onClick={share}>{t('cta.share')}</Btn>}</div>
        </div>
        )}
        <MyOrders refreshKey={pay} />
      </div>
      <div>
        <div className="poster-wrap"><img className="poster" src={content?.media?.poster || '/images/poster.svg'} alt={game} /></div>
        <div className="grid pics mini">{gal.slice(0, 4).map((s, i) => <img key={s + i} style={{ '--d': i }} src={s} alt="" loading="lazy" />)}</div>
        <a href="#gallery" className="more">{t('nav.gallery')} →</a>
      </div>
      <div className="full"><h2>{t('home.details')}</h2>
        <div className="cards">
          {[...(g?.details || []), { k: t('pay.list'), v: `${inr(price)} ${t('price.plus_gst')}` }].map((d, i) => <ComicCard key={d.k} style={{ '--d': i }} title={d.k} avatar={<span>{(d.k || '?')[0]}</span>} caption={d.v} />)}
        </div>
        <p><a href="#description" className="bt b10">{t('nav.description')} →</a></p>
      </div>
      <div className="full"><h2>{t('home.contact')}</h2>
        <div className="cards">
          <ComicCard title={t('home.contact_general')} avatar={<span>✉</span>}><p><a href="mailto:squadroundgamescontact@gmail.com" dir="ltr">squadroundgamescontact@gmail.com</a></p></ComicCard>
          <ComicCard title={t('home.contact_refund')} avatar={<span>₹</span>}><p><a href="mailto:squadroundgamesrefund@gmail.com?subject=Refund%20request" dir="ltr">squadroundgamesrefund@gmail.com</a></p></ComicCard>
        </div>
      </div>
      {showTerms && <TermsModal text={content?.terms} onOk={() => { setTerms(true); setShowTerms(false); }} />}
      {pay && <PayModal code={pct ? code.trim() : ''} onClose={() => setPay(false)} />}
    </section>
  );
}

/* ---------- order = your Squad Round invoice design + download box after a successful payment ---------- */
const r2 = n => Math.round(n * 100) / 100;
const STAMP = { completed: ['ok', '✅'], failed: ['failed', '❌'], cancelled: ['cancelled', '🚫'], pending: ['pending', '⏳'] };
const ST_LABEL = { completed: 'orders.paid', failed: 'ord.failed', cancelled: 'ord.cancelled', pending: 'ord.pending' };

function DownloadBox({ o }) {
  const { t } = useApp(); const avail = o.downloadOs || [], [os, setOs] = useState(() => { const g = guessOs(); return avail.includes(g) || !avail.length ? g : avail[0]; }), [busy, setBusy] = useState(false), [msg, setMsg] = useState(null);
  const go = async () => {
    setBusy(true); setMsg({ ok: true, text: t('dl.verifying') });
    const r = await api(`/api/orders/${o._id}/download`, { method: 'POST', body: { os } }); setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: t(r.data.error === 'no_build' ? 'dl.nobuild' : r.data.error === 'not_paid' ? 'dl.notpaid' : 'error.generic') });
    setMsg({ ok: true, text: t('dl.start'), go: true }); sfx.ok();
    const a = document.createElement('a'); a.href = r.data.url; a.download = ''; document.body.append(a); a.click(); a.remove();   // same-origin signed link, the server sends it as an attachment
  };
  return (<div className="dlbox no-print"><h3>⬇ {t('dl.title')}</h3>
    <label htmlFor="os">{t('dl.os')}</label><OsSelect id="os" value={os} onChange={setOs} available={avail} soon={t('dl.soon')} />
    <div className="row"><Btn kit={15} disabled={busy || !avail.includes(os)} onClick={go}>{t('dl.btn')}</Btn></div>
    {msg && <p className={`dl-msg ${msg.ok ? '' : 'err'}`} role="status">{msg.text}</p>}{msg?.go && <div className="dl-prog" key={Date.now()}><i /></div>}
  </div>);
}

export function Order({ id }) {
  const { t, toast, user } = useApp(); const [o, setO] = useState(null), [miss, setMiss] = useState(false), [glitch, setGlitch] = useState(false);
  const load = useCallback(async () => { const r = await api(`/api/orders/${id}`); if (!r.ok) return setMiss(true); setO(r.data); return r.data; }, [id]);
  useEffect(() => { load(); }, [load]);
  const refresh = () => { setGlitch(true); setTimeout(() => { setGlitch(false); load().then(() => toast('⚡ ' + t('about.saved'))); }, 500); };
  if (miss) return <div className="panel">{t('order.missing')}</div>;
  if (!o) return <Loading text={t('common.loading')} />;
  const [cls, icon] = STAMP[o.status] || STAMP.pending, label = t(ST_LABEL[o.status] || ST_LABEL.pending), msg = t(`st.${o.status in STAMP ? o.status : 'pending'}`);
  const list = o.listPrice, excl = o.priceExcl ?? r2(list / 1.18), gst = o.gstAmount ?? r2(list - excl), tp = o.txnPct ?? 0, charge = o.txnCharge ?? 0, biz = o.biz || {};
  const cancel = async () => { const r = await api(`/api/orders/${o._id}/cancel`, { method: 'POST' }); if (r.ok) load(); else toast(t('error.generic')); };
  return (<div className="inv-wrap">
    <div className="no-print inv-tools inv-box">
      <div className="inv-bangers">⚡ {t('inv.panel')} ⚡</div>
      <div className="row"><Btn kit={11} className={glitch ? 'glitch-anim' : ''} onClick={refresh}>🔄 {t('inv.refresh')}</Btn><Btn kit={1} onClick={() => window.print()}>🖨️ {t('inv.print')}</Btn></div>
    </div>
    <div className={`inv-card inv-box ${glitch ? 'glitch-anim' : ''}`}>
      <div className="hazard-bg top" />
      <div className={`inv-stamp ${cls}`}><div>{label.toUpperCase()}</div></div>
      <div className="inv-head">
        <div><h1 className="inv-bangers">{biz.name || 'SQUAD ROUND GAMES'}</h1><p className="inv-comic inv-sub">{t('inv.official')}</p></div>
        <div className="inv-mono inv-meta inv-box-sm">
          {o.invoiceNo && <p><strong>{t('inv.no')}:</strong> <bdi>{o.invoiceNo}</bdi></p>}
          <p><strong>{t('inv.purchase_id')}:</strong> <bdi>#SR-{o._id.slice(0, 8).toUpperCase()}</bdi></p>
          <p><strong>GSTIN:</strong> <GstPin gstin={o.gstin} bare /></p>
          <p><strong>{t('orders.date')}:</strong> <bdi>{fmtIST(o.paidAt || o.failedAt || o.createdAt)}</bdi></p>
        </div>
      </div>
      <div className="inv-game inv-box-sm inv-seller inv-comic">
        <p><b>{t('inv.supplier')}:</b> {biz.name || 'Squad Round Games'}{biz.address ? ` — ${biz.address}` : ''}</p>
        {biz.state && <p><b>{t('inv.state')}:</b> {biz.state}{biz.stateCode ? ` (${biz.stateCode})` : ''}</p>}
        {biz.sac && <p><b>{t('inv.sac')}:</b> <bdi>{biz.sac}</bdi></p>}
        {biz.phone && <p><b>{t('inv.phone')}:</b> <bdi>{biz.phone}</bdi></p>}
      </div>
      <div className="inv-game inv-box-sm inv-seller inv-comic">
        {o.billing?.name && <p><b>{t('inv.buyer')}:</b> {o.billing.name}</p>}
        {o.billing?.phone && <p><b>{t('inv.cust_phone')}:</b> <bdi>{o.billing.phone}</bdi></p>}
        {o.billing?.address && <p><b>{t('inv.address')}:</b> {o.billing.address}</p>}
        {o.email && <p><b>{t('inv.email')}:</b> <bdi>{o.email}</bdi></p>}
        {o.payThrough && <p><b>{t('inv.paythrough')}:</b> {o.payThrough} <small>({o.paymentMethod})</small></p>}
      </div>
      <div className="inv-game inv-box-sm">
        <div className="tag inv-bangers">🎯 {t('inv.item')}</div>
        <h2 className="inv-bangers">{o.gameName}</h2>
        <p className="inv-comic">{t('inv.license')}</p>
      </div>
      <div className="inv-fin">
        <h3 className="inv-bangers">💰 {t('inv.fin')}</h3>
        {o.gstMode === 'excl' ? <BillRows b={o} /> : (
        <div className="inv-table inv-comic">
          <div className="inv-row head"><span>{t('inv.desc')}</span><span>{t('inv.amount')}</span></div>
          <div className="inv-row"><span>{t('inv.excl')}</span><span className="num">{money(excl)}</span></div>
          <div className="inv-row"><span>{t('inv.gst', { r: o.gstRate ?? 18 })}<span className="taxchip">GST</span></span><span className="num">{money(gst)}</span></div>
          <div className="inv-row incl"><span>{t('inv.incl')}</span><span className="num">{money(list)}</span></div>
          <div className="inv-row"><span>{t('inv.fee', { p: tp })}</span><span className="num">{money(charge)}</span></div>
          <div className="inv-row disc"><span>{o.promoCode ? t('inv.disc', { c: o.promoCode }) : t('pay.discount')}</span><span className="num">-{money(o.discount)}</span></div>
          <div className="inv-row total"><span>{t('inv.total')}</span><span className="num">{money(o.amountPaid)}</span></div>
        </div>)}
      </div>
      <div className={`inv-status inv-box-sm ${cls}`}>
        <div><p className="inv-bangers">{t('inv.status')}:</p><p className="inv-comic">{msg}{o.failReason ? ` (${o.failReason})` : ''}</p></div>
        <div>{icon} {label}</div>
      </div>
      <div className="inv-foot inv-comic">
        <div><span>{t('inv.help')}</span><br /><a href={`mailto:${biz.email || 'squadroundcontact@gmail.com'}`}>{biz.email || 'squadroundcontact@gmail.com'}</a></div>
        <div className="inv-nr inv-box-sm">💥 {t('inv.nr')} 💥</div>
      </div>
      <p className="small inv-comic">{t('inv.computer')}</p>
      <div className="hazard-bg bot" />
    </div>
    {o.status === 'completed' && <DownloadBox o={o} />}
    {o.status === 'pending' && user && <div className="dlbox no-print"><h3>🔑 {t('pay.verify_pay')}</h3><ConfirmCode id={o._id} onDone={load} /><div className="row"><Btn kit={9} onClick={cancel}>{t('order.cancel')}</Btn></div></div>}
    <p className="small no-print">{t('footer.disclaimer')} — <a href="#refund">{t('footer.legal_refund')}</a> · <a href="#home">{t('nav.home')} →</a></p>
  </div>);
}

/* ---------- content pages ---------- */
export function Description() {
  const { t, content, lang } = useApp();
  return (<><p className="narr">{t('nav.description')}</p><ComicText>{content?.gameName}</ComicText>
    <article className="panel desc">{fill(L(content?.game?.long, lang), content).split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</article>
    <div className="cards">{(content?.game?.details || []).map((d, i) => <ComicCard key={d.k} style={{ '--d': i }} title={d.k} avatar={<span>{d.k[0]}</span>} caption={d.v} />)}</div>
    <p><a href="#home" className="bt b1">← {t('nav.home')}</a></p></>);
}

export function Gameplay() {
  const { t, content } = useApp(); const [v, setV] = useState(null);
  useEffect(() => { api('/api/gameplay').then(r => setV(r.ok ? r.data : [])); }, []);
  return (<><ComicText>{t('gameplay.title', { game: content?.gameName })}</ComicText>
    {v && !v.length && <div className="panel empty">{t('gameplay.empty')}</div>}
    <div className="grid vids">{(v || []).map(x => (<figure className="panel vid" key={x.id}>
      <iframe src={`https://www.youtube-nocookie.com/embed/${x.id}`} title={x.title || x.id} loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
      <figcaption><b>{x.title}</b>{x.channel && <small> — {x.channel}</small>}</figcaption></figure>))}</div></>);
}

export function Gallery() {
  const { t, content } = useApp(); const [big, setBig] = useState(null); const imgs = content?.media?.gallery?.length ? content.media.gallery : PIC;
  const row = rev => <div className={`marquee ${rev ? 'rev' : ''}`}><div className="track">{[...imgs, ...imgs].map((s, i) => <img key={i} src={s} alt="" loading="lazy" onClick={() => setBig(s)} />)}</div></div>;
  return (<><p className="narr">{t('nav.gallery')}</p>
    <div className="desk-only">{row(false)}{row(true)}</div>
    <div className="grid pics mob-only">{imgs.map((s, i) => <img key={s + i} style={{ '--d': i }} src={s} alt="" loading="lazy" onClick={() => setBig(s)} />)}</div>
    {big && <div className="modal" onClick={() => setBig(null)}><img className="lightbox pop" src={big} alt="" /><Btn className="x" onClick={() => setBig(null)}>{t('gal.close')}</Btn></div>}</>);
}

export function Reviews() {
  const { t, toast, content, reloadContent } = useApp(); const [data, setData] = useState({ items: [], total: 0, mine: null }), [text, setText] = useState(''), [rating, setRating] = useState(0), [page, setPage] = useState(0);
  const load = useCallback(async (p = 0) => { const r = await api(`/api/reviews?page=${p}`); if (!r.ok) return; setData(d => ({ ...r.data, items: p ? [...d.items, ...r.data.items] : r.data.items })); setPage(p); if (!p && r.data.mine) { setText(x => x || r.data.mine.text); setRating(x => x || r.data.mine.rating); } }, []);
  useEffect(() => { load(0); }, [load]);
  const submit = async () => {
    const r = await api('/api/reviews', { method: 'POST', body: { text, rating } });
    if (r.ok) { toast(r.data.verified ? t('review.thanks_v') : t('review.thanks')); load(0); reloadContent(); }
    else toast(t({ bad_length: 'review.short', slow_down: 'review.slow' }[r.data.error] || 'error.generic'));
  };
  const del = async () => { await api('/api/reviews/mine', { method: 'DELETE' }); setText(''); setRating(0); load(0); reloadContent(); };
  return (<><ComicText>{t('review.title')}</ComicText>
    {content?.rating > 0 && <div className="panel avg"><b className="big">{content.rating}</b> <Stars value={content.rating} size="lg" /> <span>({content.reviewCount})</span></div>}
    <form className="f f2 wide" onSubmit={e => { e.preventDefault(); if (text.trim().length >= 10 && rating) submit(); }}><h4>{data.mine ? t('review.edit') : t('review.write')}</h4><Stars value={rating} onChange={setRating} size="lg" />
      <Area kit={0} rows="3" maxLength="600" placeholder={t('review.placeholder')} value={text} onChange={e => setText(e.target.value)} />
      <small>{text.length}/600 · {t('review.min')}</small>
      <div className="row"><Btn kit={1} type="submit" disabled={text.trim().length < 10 || !rating}>{t('cta.send')}</Btn>{data.mine && <Btn kit={9} onClick={del}>{t('review.delete')}</Btn>}</div>
      {data.mine && !data.mine.visible && <p className="alert">{t('review.hidden')}</p>}</form>
    {!data.items.length ? <p className="panel empty">{t('review.none')}</p> : <div className="cards">{data.items.map((r, i) => <ComicCard key={i} style={{ '--d': i % 6 }} avatar={<span>{r.name[0].toUpperCase()}</span>} title={r.name} handle={`${r.verified ? '✔ ' + t('review.verified') + ' · ' : ''}${new Date(r.at).toLocaleDateString()}`} caption={r.text}><Stars value={r.rating} /></ComicCard>)}</div>}
    {data.items.length < data.total && <Btn kit={7} onClick={() => load(page + 1)}>{t('review.more')}</Btn>}</>);
}

export function About() {
  const { t, lang, content } = useApp(); const m = content?.media || {}, imgs = m.aboutImages || [], photos = m.aboutPhotos || [];
  return (<><p className="narr">{t('nav.about')}</p><ComicText>SQUAD ROUND GAMES</ComicText><Meter />
    <div className={`about ${m.aboutLayout || 'right'}`}>
      <div className="cards">{(content?.aboutSections || []).map((s, i) => <ComicCard key={s.id} style={{ '--d': i }} title={fill(L(s.title, lang), content)} avatar={<span>{i + 1}</span>}>{fill(L(s.body, lang), content).split(/\n{2,}/).map((p, j) => <p key={j} className="card-caption">{p}</p>)}</ComicCard>)}</div>
      {imgs.length > 0 && <div className="about-imgs">{imgs.map((s, i) => <img key={s} style={{ '--d': i }} src={s} alt="" loading="lazy" />)}</div>}
    </div>
    {photos.length > 0 && <div className="about-photos"><div className="cards">{photos.map((p, i) => <ComicCard key={p.src} style={{ '--d': i }} title={t(`about.photo.${p.kind}`)} avatar={<span>{{ founder: '🧑', gst: '📄', studio: '🎮' }[p.kind]}</span>}>
      <a href={p.src} target="_blank" rel="noopener noreferrer"><img className="ph-img" src={p.src} alt={p.caption || t(`about.photo.${p.kind}`)} loading="lazy" /></a>{p.caption && <p className="card-caption">{p.caption}</p>}</ComicCard>)}</div></div>}</>);
}

export function Updates() {
  const { t, content } = useApp(); const [list, setList] = useState(null);
  useEffect(() => { api('/api/updates').then(r => setList(r.ok ? r.data : [])); }, []);
  return (<><p className="narr">{t('nav.updates')}</p><ComicText>{t('nav.updates')}</ComicText>
    {list === null ? <p>{t('common.loading')}</p> : list.length === 0 ? <p>{content?.gameName || ''} — no updates yet.</p>
      : <div className="cards">{list.map((u, i) => <ComicCard key={u.id} style={{ '--d': i }} title={`v${u.version}${u.title ? ' — ' + u.title : ''}`} avatar={<span>{list.length - i}</span>}>
        <small>{new Date(u.at).toLocaleDateString()}</small>{u.notes.split(/\n{2,}/).map((x, j) => <p key={j}>{x}</p>)}</ComicCard>)}</div>}</>);
}

export function Support() {
  const { t, toast, user, content } = useApp(); const [order, setOrder] = useState(''), [msg, setMsg] = useState('');
  const send = async () => { const r = await api('/api/support', { method: 'POST', body: { email: user.email, message: (order ? `[Order ${order}] ` : '') + msg } }); if (r.ok) { setMsg(''); setOrder(''); toast(t('support.thanks')); } else toast(t('error.generic')); };
  return (<><p className="narr">{t('support.title')}</p><ComicText>{t('support.title')}</ComicText>
    <div className="panel kapow"><h2>{t('support.buy')}</h2></div>
    <div className="cards">{SOCIAL.map(([k, n], i) => <ComicCard key={k} style={{ '--d': i }} title={n} avatar={<span>{n[0]}</span>}><a className={`bt b9 soc ${k}`} href={content?.social?.[k] || '#'} target="_blank" rel="noopener noreferrer">{t('cta.enter')} →</a></ComicCard>)}</div>
    <div className="panel"><h3>{t('support.goal')}</h3><Meter /></div>
    <form className="f f9 narrow-f" onSubmit={e => { e.preventDefault(); if (msg.trim().length >= 10) send(); }}><h4>🎫 {t('support.ticket')}</h4>
      <label htmlFor="t-order">{t('support.order')}</label><Field kit={0} id="t-order" value={order} onChange={e => setOrder(e.target.value)} />
      <label htmlFor="t-msg">{t('support.msg')}</label><Area kit={0} id="t-msg" rows="5" minLength="10" value={msg} onChange={e => setMsg(e.target.value)} />
      <Btn kit={10} type="submit" disabled={msg.trim().length < 10}>{t('cta.send')}</Btn></form>
    <div className="panel narrow"><b>{t('footer.legal_refund')}:</b> {t('notice.no_returns')} <a href="#refund">{t('footer.legal_refund')} →</a></div></>);
}

export function Next() {
  const { t, content } = useApp(); const ph = content?.progress || [];
  const all = avg(ph.flatMap(p => p.tasks.map(x => x.pct)));
  const st = p => (p >= 100 ? ['done', 'green'] : p > 0 ? ['in_progress', 'blue'] : ['planned', '']);
  return (<><p className="narr">{t('next.sub')}</p><ComicText>{content?.nextGame}</ComicText>
    <div className="panel"><b>{t('next.overall')}</b><Bar pct={all} /></div>
    {ph.map((p, i) => { const pc = avg(p.tasks.map(x => x.pct)), [s, c] = st(pc); return (<div className="panel rise" style={{ '--d': i }} key={p.phase}>
      <h3>{p.phase} <span className={`badge ${c}`}>{t(`status.${s}`)}</span></h3><Bar pct={pc} />
      <ul className="tasks">{p.tasks.map(x => <li key={x.name}><span>{x.name}</span><Bar pct={x.pct} /></li>)}</ul></div>); })}</>);
}

export function Referral() {
  const { t, user, toast } = useApp(); const [d, setD] = useState(null), [denied, setDenied] = useState(false);
  useEffect(() => { if (user) api('/api/referral').then(r => (r.ok ? setD(r.data) : setDenied(true))); }, [user]);
  if (!user?.referral || denied) return <div className="panel">{t('ref.private')}</div>;
  return (<><p className="narr">{t('nav.referral')}</p><ComicText>{t('aff.title')}</ComicText>{d && (d.code ? <>
    <div className="panel pop"><b>{t('ref.code')}</b><div className="codebox">{d.code}</div><p>{t('ref.viewers', { p: d.pct })}</p>
      <Field readOnly value={d.link} onFocus={e => e.target.select()} aria-label="link" />
      <ComicButton small onClick={() => navigator.clipboard.writeText(d.link).then(() => toast(t('ref.copied')))}>{t('cta.share')}</ComicButton></div>
    <div className="panel stat-row">{[['aff.total', d.uses], ['aff.today', d.today], ['aff.week', d.week], ['aff.month', d.month]].map(([k, n]) => <div key={k}><b className="big"><Count n={n} /></b><small>{t(k)}</small></div>)}</div>
    <p className="small">{t('aff.private')}</p></> : <div className="panel">{t('ref.private')}</div>)}</>);
}

export function Legal({ slug }) {
  const { t, content } = useApp(); const [txt, setTxt] = useState(null);
  useEffect(() => { api(`/api/legal/${slug}`).then(r => setTxt(r.ok ? r.data.text : '')); }, [slug]);
  const game = content?.gameName || '';
  return (<><p className="narr">{t(`footer.legal_${slug === 'terms' ? 'terms' : slug === 'privacy' ? 'privacy' : 'refund'}`)}</p>
    <article className="panel desc">{txt === null ? t('common.loading') : txt.replaceAll('{game}', game).split(/\n{2,}/).map((p, i) => /^\d+\. /.test(p) ? <h3 key={i}>{p}</h3> : <p key={i} style={{ whiteSpace: 'pre-line' }}>{p}</p>)}</article>
    <a href="#home" className="bt b1">← {t('nav.home')}</a></>);
}

export const NotFound = () => { const { t } = useApp(); return <div className="panel center"><ComicBurst color="var(--red)" className="big-burst">404</ComicBurst><p>{t('notfound')}</p><a className="bt b4" href="#home">{t('nav.home')}</a></div>; };

export function Cookie() {
  const { t } = useApp(); const [ok, setOk] = useState(localStorage.getItem('srg_cookie') === '1');
  if (ok) return null;
  return <div className="cookie panel"><span>{t('cookies.msg')}</span> <Btn kit={6} onClick={() => { localStorage.setItem('srg_cookie', '1'); setOk(true); }}>{t('cookies.accept')}</Btn></div>;
}
export { LANGS };
