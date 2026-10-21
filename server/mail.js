// Comic-style, fully localised e-mails (login code, payment code, GST tax invoice / receipt, creator welcome).
// Texts come from the SAME language files as the website: ../client/src/i18n/<lang>.json
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../client/src/i18n');
export const LANG_CODES = ['en', 'ta', 'ko', 'ja', 'zh', 'ru', 'fr', 'ml', 'te', 'hi', 'es', 'nl', 'de', 'si', 'ur', 'ar', 'tcy', 'mr'];
const RTL = ['ar', 'ur'];
const LOCALE = { en: 'en-IN', ta: 'ta-IN', ko: 'ko-KR', ja: 'ja-JP', zh: 'zh-CN', ru: 'ru-RU', fr: 'fr-FR', ml: 'ml-IN', te: 'te-IN', hi: 'hi-IN', es: 'es-ES', nl: 'nl-NL', de: 'de-DE', si: 'si-LK', ur: 'ur-IN', ar: 'ar', tcy: 'kn-IN', mr: 'mr-IN' };
const cache = {};
const pack = l => cache[l] ??= (() => { try { return JSON.parse(fs.readFileSync(path.join(DIR, l + '.json'), 'utf8')); } catch { return {}; } })();
export const safeLang = l => (LANG_CODES.includes(l) ? l : 'en');
export const tr = lang => (k, v = {}) => { let s = pack(lang)[k] ?? pack('en')[k] ?? k; for (const x in v) s = s.replaceAll(`{${x}}`, v[x]); return s; };

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const money = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const when = (d, lang) => { const o = { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }; try { return new Date(d).toLocaleString(`${LOCALE[lang] || 'en-IN'}-u-nu-latn`, o) + ' IST'; } catch { return new Date(d).toLocaleString('en-IN', o) + ' IST'; } };
const FONT = "'Comic Sans MS','Segoe UI','Noto Sans','Noto Sans Arabic','Noto Sans Kannada','Nirmala UI',Arial,sans-serif";

const page = (bg, inner, lang, doc = false) => `<!doctype html><html lang="${lang}" dir="${RTL.includes(lang) ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Squad Round Games</title></head><body style="margin:0;background:#fefae8;font-family:${FONT};color:#111;">
<div style="max-width:${doc ? 680 : 560}px;margin:0 auto;padding:${doc ? 16 : 24}px;"><div style="background:${bg};border:4px solid #111;box-shadow:8px 8px 0 #111;padding:20px;border-radius:12px;">${inner}</div></div></body></html>`;
const h1 = t => `<h1 style="font-family:Impact,'Arial Black',sans-serif;font-style:italic;margin:0 0 8px;">${esc(t)}</h1>`;
const btn = (href, label, bg, fg) => `<p><a href="${esc(href)}" style="background:${bg};color:${fg};padding:10px 18px;border:3px solid #111;text-decoration:none;font-weight:bold;display:inline-block;">${esc(label)}</a></p>`;
const small = t => `<p style="font-size:12px;color:#555;">${t}</p>`;
const codeBox = (code, bg, size = 42) => `<p dir="ltr" style="font-family:Impact,'Arial Black',monospace;font-size:${size}px;letter-spacing:8px;background:${bg};border:3px solid #111;padding:10px 16px;text-align:center;color:#111;">${esc(code)}</p>`;

export const otpMail = (code, lang = 'en') => {
  const t = tr(lang = safeLang(lang));
  return {
    subject: t('m.otp.subject'),
    text: `SQUAD ROUND GAMES\n\n${t('m.otp.intro')} ${code}\n\n${t('m.otp.note')}\n`,
    html: page('#ffd900', `${h1('SQUAD ROUND GAMES')}<p>${esc(t('m.otp.intro'))}</p>${codeBox(code, '#fff')}<p style="font-size:13px;color:#333;">${esc(t('m.otp.note'))}</p>`, lang),
  };
};

export const payCodeMail = (code, p, lang = 'en') => {
  const t = tr(lang = safeLang(lang));
  return {
    subject: t('m.pay.subject', { game: p.gameName }),
    text: `SQUAD ROUND GAMES — ${t('pay.test')}\n\n${t('pay.game')}: ${p.gameName}\n${t('m.pay.amount')}: ${money(p.amountPaid)} (${t('price.gst_included')})\n\n${code}\n\n${t('m.pay.note')}\n`,
    html: page('#2b80d9', `${h1(t('m.pay.title'))}<p style="color:#fff;">${esc(t('pay.game'))}: <b>${esc(p.gameName)}</b><br>${esc(t('m.pay.amount'))}: <b>${money(p.amountPaid)}</b> <small>(${esc(t('price.gst_included'))})</small></p>${codeBox(code, '#ffd900')}<p style="font-size:13px;color:#fff;">${esc(t('m.pay.note'))}</p>`, lang),
  };
};

/* ---------- GST tax invoice (used in the e-mail body AND as the attached, printable file) ---------- */
export const invoiceNumber = p => p.invoiceNo || '—';
function invoiceTable(p, lang) {
  const t = tr(lang), td = 'padding:6px 8px;border-bottom:2px solid #111;', tdr = td + 'text-align:end;', red = 'color:#d92b2b;';
  const row = (label, val, st = '') => `<tr><td style="${td}${st}">${esc(label)}</td><td style="${tdr}${st}" dir="ltr">${val}</td></tr>`;
  const head = `<tr style="background:#111;color:#ffd900;"><td style="padding:6px 8px;">${esc(t('inv.desc'))}</td><td style="padding:6px 8px;text-align:end;">${esc(t('inv.amount'))}</td></tr>`;
  const disc = label => row(label, '-' + money(p.discount), red);
  const total = `<tr style="background:#ffd900;"><td style="padding:8px;font-weight:bold;">${esc(t('inv.total'))}</td><td style="padding:8px;text-align:end;font-weight:bold;" dir="ltr">${money(p.amountPaid)}</td></tr>`;
  const wrap = rows => `<table role="presentation" style="width:100%;border-collapse:collapse;border:3px solid #111;background:#fff;font-size:14px;">${head}${rows}${total}</table>`;
  if (p.gstMode === 'excl') {            // price before GST: gross - discount = taxable, then CGST + SGST
    return wrap(row(t('inv.gross'), money(p.priceExcl))
      + (p.discount > 0 ? disc(p.promoCode ? t('inv.disc', { c: p.promoCode }) : `${t('pay.discount')} (${p.discountPct}%)`) : '')
      + row(t('inv.taxable'), money(p.taxable))
      + row(t('inv.cgst', { r: p.cgstRate }), money(p.cgst)) + row(t('inv.sgst', { r: p.sgstRate }), money(p.sgst))
      + row(t('inv.gst_total', { r: p.gstRate }), money(p.gstAmount))
      + (p.txnCharge ? row(t('inv.fee', { p: p.txnPct }), money(p.txnCharge)) : ''));
  }
  const list = p.listPrice, excl = p.priceExcl ?? Math.round(list / 1.18 * 100) / 100, gst = p.gstAmount ?? Math.round((list - excl) * 100) / 100;   // older orders: price was GST-inclusive
  return wrap(row(t('inv.excl'), money(excl)) + row(t('inv.gst', { r: p.gstRate ?? 18 }), money(gst)) + row(t('inv.incl'), money(list))
    + (p.txnCharge ? row(t('inv.fee', { p: p.txnPct }), money(p.txnCharge)) : '') + disc(p.promoCode ? t('inv.disc', { c: p.promoCode }) : t('pay.discount')));
}
function invoiceBody(p, biz, lang) {
  const t = tr(lang), b = biz || {}, line = (k, v) => v ? `<div><b>${esc(t(k))}:</b> <bdi>${esc(v)}</bdi></div>` : '';
  return `<p style="font-size:13px;margin:0 0 6px;">${esc(t('inv.official'))}</p>
<div style="font-size:13px;line-height:1.5;background:#fff;border:3px solid #111;padding:8px 10px;margin:8px 0;">
${line('inv.no', p.invoiceNo)}${line('inv.purchase_id', '#SR-' + p._id.slice(0, 8).toUpperCase())}${line('orders.date', when(p.paidAt, lang))}
<div dir="ltr" style="display:inline-block;background:#111;color:#ffd900;padding:3px 8px;margin:4px 0;font-family:'Courier New',monospace;font-weight:bold;">GSTIN: ${esc(p.gstin || '—')}</div>
${line('inv.supplier', [b.name, b.address].filter(Boolean).join(' — '))}${line('inv.state', [b.state, b.stateCode && `(${b.stateCode})`].filter(Boolean).join(' '))}${line('inv.sac', b.sac)}${line('inv.phone', b.phone)}</div>
<div style="font-size:13px;line-height:1.5;background:#fff;border:3px solid #111;padding:8px 10px;margin:8px 0;">
${line('inv.buyer', p.billing?.name)}${line('inv.cust_phone', p.billing?.phone)}${line('inv.address', p.billing?.address)}${line('inv.email', p.email)}</div>
<p style="margin:8px 0;"><b>${esc(t('inv.item'))}:</b> ${esc(p.gameName)}<br><span style="font-size:12px;">${esc(t('inv.license'))}</span></p>
${invoiceTable(p, lang)}
<p>${esc(t('m.inv.method'))}: <b><bdi>${esc([p.payThrough, p.paymentMethod].filter(Boolean).join(' · '))}</bdi></b><br>${esc(t('m.inv.paidon'))}: <b><bdi>${esc(when(p.paidAt, lang))}</bdi></b></p>`;
}

const textRows = (p, t) => p.gstMode === 'excl'
  ? `${t('inv.gross')}: ${money(p.priceExcl)}\n${p.discount > 0 ? `${p.promoCode ? t('inv.disc', { c: p.promoCode }) : t('pay.discount')}: -${money(p.discount)}\n` : ''}${t('inv.taxable')}: ${money(p.taxable)}\n${t('inv.cgst', { r: p.cgstRate })}: ${money(p.cgst)}\n${t('inv.sgst', { r: p.sgstRate })}: ${money(p.sgst)}\n${t('inv.gst_total', { r: p.gstRate })}: ${money(p.gstAmount)}\n${p.txnCharge ? `${t('inv.fee', { p: p.txnPct })}: ${money(p.txnCharge)}\n` : ''}${t('inv.total')}: ${money(p.amountPaid)}\n`
  : `${t('inv.excl')}: ${money(p.priceExcl ?? p.listPrice)}\n${t('inv.gst', { r: p.gstRate ?? 18 })}: ${money(p.gstAmount ?? 0)}\n${t('inv.incl')}: ${money(p.listPrice)}\n${p.txnCharge ? `${t('inv.fee', { p: p.txnPct })}: ${money(p.txnCharge)}\n` : ''}${p.promoCode ? t('inv.disc', { c: p.promoCode }) : t('pay.discount')}: -${money(p.discount)}\n${t('inv.total')}: ${money(p.amountPaid)}\n`;
export const receiptMail = (p, link, biz, lang = 'en') => {
  const t = tr(lang = safeLang(lang)), b = biz || {}, no = p.invoiceNo || '#SR-' + p._id.slice(0, 8).toUpperCase();
  const sup = b.email || 'squadroundcontact@gmail.com';
  const foot = `${small(`<b>${esc(t('m.inv.policy'))}</b>`)}${small(esc(t('m.inv.support', { e: sup })))}${small(esc(t('inv.computer')))}`;
  const html = page('#fefae8', `${h1(t('m.inv.title'))}${invoiceBody(p, b, lang)}${link ? btn(link, t('m.inv.dl'), '#2ecc71', '#111') : ''}${small(esc(t('m.inv.attach')))}${foot}`, lang);
  const attach = page('#fefae8', `${h1(b.name || 'SQUAD ROUND GAMES')}${invoiceBody(p, b, lang)}${foot}`, lang, true);
  const row = (k, v) => v ? `${t(k)}: ${v}\n` : '';
  const text = `${t('m.inv.title')} — SQUAD ROUND GAMES\n${t('inv.official')}\n\n${row('inv.no', p.invoiceNo)}${row('inv.purchase_id', '#SR-' + p._id.slice(0, 8).toUpperCase())}GSTIN: ${p.gstin || '—'}\n${row('inv.supplier', [b.name, b.address].filter(Boolean).join(' — '))}${row('inv.sac', b.sac)}${row('inv.buyer', p.billing?.name)}${row('inv.cust_phone', p.billing?.phone)}${row('inv.address', p.billing?.address)}${row('inv.email', p.email)}${t('inv.item')}: ${p.gameName}\n${textRows(p, t)}${t('m.inv.method')}: ${[p.payThrough, p.paymentMethod].filter(Boolean).join(' · ')}\n${t('m.inv.paidon')}: ${when(p.paidAt, lang)}\n\n${link ? link + '\n\n' : ''}${t('m.inv.policy')}\n${t('m.inv.support', { e: sup })}\n${t('inv.computer')}\n`;
  return { subject: t('m.inv.subject', { no, game: p.gameName }), text, html,
    attachments: [{ filename: `Invoice-${no.replace(/[^A-Za-z0-9-]+/g, '-')}.html`, content: attach, contentType: 'text/html; charset=utf-8' }] };
};

export const welcomeMail = (code, pct, shareLink, gameName, dashLink, lang = 'en') => {
  const t = tr(lang = safeLang(lang));
  return {
    subject: t('m.welcome.subject'),
    text: `SQUAD ROUND GAMES — ${t('m.welcome.title')}\n\n${t('m.welcome.intro')} ${code}\n${t('m.welcome.share')} ${shareLink}\n${t('m.welcome.off', { p: pct })}\n\n${t('m.welcome.line', { c: code, p: pct, g: gameName })}\n${dashLink}\n${t('m.welcome.privacy')}\n`,
    html: page('#fefae8', `${h1(t('m.welcome.title'))}<p>${esc(t('m.welcome.intro'))}</p>${codeBox(code, '#ffd900', 36)}<p>${esc(t('m.welcome.share'))} <b dir="ltr">${esc(shareLink)}</b></p><p>${esc(t('m.welcome.off', { p: pct }))}</p>${btn(dashLink, t('m.welcome.dash'), '#2b80d9', '#fff')}${small(esc(t('m.welcome.line', { c: code, p: pct, g: gameName })))}${small(esc(t('m.welcome.privacy')))}`, lang),
  };
};

// New game update: patch notes mailed to everyone who bought (English for now; admin writes the notes)
export const updateMail = (u, link, lang = 'en') => {
  const notes = String(u.notes).split(/\n{2,}/).map(x => `<p style="margin:6px 0;">${esc(x).replace(/\n/g, '<br>')}</p>`).join('');
  return {
    subject: `${u.gameName || 'Squad Round Games'} — update ${u.version}`,
    text: `SQUAD ROUND GAMES\n\n${u.gameName || ''} update ${u.version}${u.title ? ' — ' + u.title : ''}\n\n${u.notes}\n\n${link}\n`,
    html: page('#fefae8', `${h1(`UPDATE ${u.version}`)}${u.title ? `<p><b>${esc(u.title)}</b></p>` : ''}${notes}${btn(link, 'OPEN THE SITE & DOWNLOAD', '#2ecc71', '#111')}${small('You get this because you bought the game.')}`, lang),
  };
};
