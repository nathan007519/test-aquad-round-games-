import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { MongoClient } from 'mongodb';
import { otpMail, payCodeMail, receiptMail, welcomeMail, updateMail, safeLang } from './mail.js';

if (fs.existsSync('.env')) for (const l of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}
const { GMAIL_USER = 'squadroundgames@gmail.com', GMAIL_APP_PASSWORD, SECRET = 'dev-secret', CLIENT_ORIGIN = 'http://localhost:5173', PORT = 4000,
  YT_API_KEY, PAYMENT_WEBHOOK_SECRET, MONGODB_URI = 'mongodb://127.0.0.1:27017/squadround' } = process.env;
// TEST DEMO payments: the buyer "pays" by entering a code we e-mail them. Set DEMO_PAYMENTS=false to switch the demo off (then only the webhook / admin "Paid" button can complete an order).
const DEMO = process.env.DEMO_PAYMENTS !== 'false';
const ADMIN = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();

/* ================= MongoDB =================
   collections: users, codes, purchases, reviews, tickets, kv (settings, media, about, progress, videos, terms) */
const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
try { await client.connect(); } catch (e) { console.error('\n✗ Cannot connect to MongoDB at', MONGODB_URI, '\n ', e.message, '\n  Install MongoDB Community (or use a free MongoDB Atlas URI) and set MONGODB_URI in server/.env\n'); process.exit(1); }
const mdb = client.db(), C = n => mdb.collection(n);
await Promise.all([C('purchases').createIndex({ email: 1, createdAt: -1 }), C('purchases').createIndex({ status: 1 }), C('purchases').createIndex({ invoiceNo: 1 }, { unique: true, sparse: true }), C('users').createIndex({ promo: 1 })]);
fs.mkdirSync('uploads', { recursive: true });

const defaults = {
  settings: { gameName: 'Afraid in Basement', nextGame: 'The Last Sentinel', gstin: '658787857687', txnPct: 0,
    bizName: 'Squad Round Games', bizAddress: 'South Street, Sri Sainagar, Pappakudi, Ariyalur, Tamil Nadu - 612903', bizState: 'Tamil Nadu', bizStateCode: '33', bizPhone: '+91 6381120305', sac: '998439', supportEmail: 'squadroundcontact@gmail.com', invPrefix: 'SRG',
    goal: 200000, baseDownloads: 0, price: 550, refPct: 10,   // seller details above are shown on every GST invoice — fill them in the Admin panel
    social: { youtube: 'https://www.youtube.com', instagram: 'https://www.instagram.com', facebook: 'https://www.facebook.com', x: 'https://x.com', discord: 'https://discord.com' } },
  media: { poster: '/images/poster.svg', gallery: ['poster', 'shot1', 'shot2', 'shot3', 'shot4', 'shot5'].map(n => `/images/${n}.svg`), aboutImages: [], aboutPhotos: [], aboutLayout: 'right' },
  game: {
    short: { en: 'A horror game from Squad Round Games, built in Unreal Engine 5.' },
    long: { en: '{game} is a horror game from Squad Round Games, built in Unreal Engine 5.\n\nThis description is fully editable from the Admin panel, per language, without redeploying.' },
    details: [{ k: 'Developer', v: 'Squad Round Games' }, { k: 'Genre', v: 'Horror' }, { k: 'Engine', v: 'Unreal Engine 5' }, { k: 'Delivery', v: 'Digital download once payment is confirmed' }, { k: 'Returns', v: 'No returns — limited exceptions within 7 days via Support' }],
  },
  aboutSections: [
    { id: 'who', title: { en: 'Who we are' }, body: { en: 'Squad Round Games is an independent studio building photoreal horror games in Unreal Engine 5. This is our home on the web — built by hand, powered by real players.' } },
    { id: 'now', title: { en: 'Our current game' }, body: { en: '{game} is our current release. Every download pushes the meter you see on this page — real numbers, no theatre.' } },
    { id: 'next', title: { en: 'What is next' }, body: { en: 'Our next game, {next}, is already in development. The Next Game page shows exactly where it stands, updated live from our roadmap.' } },
    { id: 'goal', title: { en: 'Our challenge' }, body: { en: 'Our goal: 2,00,000 downloads. The meter counts only server-verified purchases. When we hit milestones, expect fireworks.' } },
  ],
  videos: [], terms: fs.readFileSync(new URL('./terms.default.txt', import.meta.url), 'utf8'),
  privacy: `PRIVACY NOTICE

1. Data we process: your email address (your login identifier), language and sound preferences, purchase records (order ID, amounts, payment method, status), the reviews you publish, and support messages you send.

2. Payments are processed by our payment provider. We store only order references, amounts, the payment method you chose and the result (completed, failed or cancelled).

3. We do not sell your data. Creators whose promo codes you use can only see aggregate counts — never your identity.

4. Retention: account data is kept while your account is active. You may request deletion through the Support page.

5. Cookies and storage: only essential items — your login session, language, sound and cookie-notice choices.

6. Contact: squadroundgames@gmail.com`,
  refund: `NO RETURNS & EXCEPTIONS

All sales of {game} are final. As a digital product, the game cannot be "returned".

Limited exceptions (report within 7 days via the Support page):
- a duplicate charge for the same order;
- payment captured but the game was not delivered to your account;
- a technical fault in the product that we cannot fix.

Approved exceptions result in a reversal: download access is revoked and the purchase is marked reversed in your order history.`,
  progress: [
    ['Phase 1: Pre-Production', ['Game Design Document (GDD)', 'Concept Art & World-Building', 'Narrative & Scriptwriting', 'Prototyping']],
    ['Phase 2: Production', ['Engine & Programming', 'Asset Creation (3D Art & Animation)', 'Audio Design & Music', 'Level Design']],
    ['Phase 3: Post-Production', ['Quality Assurance (QA)', 'Optimization', 'Localization', 'Marketing & Gold Status']],
    ['Phase 4: Post-Launch Support', ['Day-One Patches', 'DLC & Updates']],
  ].map(([phase, tasks]) => ({ phase, tasks: tasks.map(name => ({ name, pct: 0 })) })),
};
const getKV = async k => { const d = await C('kv').findOne({ _id: k }); const v = d?.v; return v === undefined ? defaults[k] : (k === 'settings' || k === 'media') ? { ...defaults[k], ...v, ...(k === 'settings' ? { social: { ...defaults.settings.social, ...v.social } } : {}) } : v; };
const setKV = (k, v) => C('kv').updateOne({ _id: k }, { $set: { v } }, { upsert: true });

/* ================= mail ================= */
// pooled + kept-alive SMTP connection: the TLS handshake happens once at start-up, so each login/payment e-mail leaves in well under a second
const mailer = GMAIL_APP_PASSWORD ? nodemailer.createTransport({ service: 'gmail', pool: true, maxConnections: 3, maxMessages: 200, auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD } }) : null;
mailer?.verify().then(() => console.log('Mail: SMTP connection ready'), e => console.error('Mail: SMTP warm-up failed —', e.message));
const sendMail = async (to, { subject, text, html, attachments }) => {
  if (!mailer) throw new Error('GMAIL_APP_PASSWORD is not set in server/.env');
  await mailer.sendMail({ from: `"Squad Round Games" <${GMAIL_USER}>`, to, subject, text, html, attachments });
};
const langOf = req => safeLang(req.headers['x-lang'] || req.body?.lang);
const trySend = (to, m) => sendMail(to, m).catch(e => console.error('MAIL FAIL', to, e.message));

/* ================= helpers ================= */
const sign = p => { const b = Buffer.from(JSON.stringify(p)).toString('base64url'); return b + '.' + crypto.createHmac('sha256', SECRET).update(b).digest('base64url'); };
const verify = t => { try { const [b, s] = (t || '').split('.'); if (crypto.createHmac('sha256', SECRET).update(b).digest('base64url') !== s) return null; const p = JSON.parse(Buffer.from(b, 'base64url')); return p.exp > Date.now() ? p : null; } catch { return null; } };
const validEmail = e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
const newCode = async () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c; do { c = 'SRG-' + Array.from({ length: 6 }, () => A[crypto.randomInt(A.length)]).join(''); } while (await C('codes').findOne({ _id: c })); return c; };
const approved = async e => e === ADMIN || !!(await C('users').findOne({ _id: e, approved: true }));
const stats = async () => { const s = await getKV('settings'); return { downloads: (Number(s.baseDownloads) || 0) + await C('purchases').countDocuments({ status: 'completed' }), goal: Number(s.goal) || 200000 }; };
const round2 = n => Math.round(n * 100) / 100;
const METHODS = ['TEST DEMO', 'UPI', 'Card', 'Net Banking'];   // TEST DEMO = e-mailed code; the rest can be set by a payment webhook
const OS = { windows: 'Windows', linux: 'Linux', macos: 'macOS', android: 'Android' };
const DL_DIR = path.resolve('downloads');
const dlFile = os => (OS[os] && fs.existsSync(DL_DIR) ? fs.readdirSync(DL_DIR).find(f => f.toLowerCase().startsWith(os + '.')) : null) || null;
const slug = x => String(x).replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') || 'game';
const w = fn => (req, res) => fn(req, res).catch(e => { console.error(e); res.status(500).json({ error: 'server' }); });

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN })); app.use(express.json({ limit: '8mb', verify: (req, _res, buf) => { req.rawBody = buf; } })); app.use('/uploads', express.static('uploads'));
app.use((req, _res, next) => { const p = verify((req.headers.authorization || '').replace('Bearer ', '')); req.user = p ? { email: p.email, admin: p.email === ADMIN } : null; next(); });
const need = admin => (req, res, next) => (!req.user ? res.status(401).json({ error: 'login' }) : admin && !req.user.admin ? res.status(403).json({ error: 'admin only' }) : next());

/* ================= OTP (30 s lock after a wrong code) ================= */
const otps = new Map(), locks = new Map();
const hh = (c, e) => crypto.createHmac('sha256', SECRET).update(e + c).digest('hex');
const lockLeft = e => Math.max(0, Math.ceil(((locks.get(e) || 0) - Date.now()) / 1000));
app.post('/api/otp/request', w(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!validEmail(email)) return res.status(400).json({ error: 'invalid_email' });
  if (lockLeft(email)) return res.status(429).json({ error: 'wait', retry: lockLeft(email) });
  const prev = otps.get(email);
  if (prev && Date.now() - prev.at < 30000) return res.status(429).json({ error: 'cooldown', retry: Math.ceil((30000 - (Date.now() - prev.at)) / 1000) });
  const code = String(crypto.randomInt(0, 10_000_000)).padStart(7, '0');
  if (!mailer && process.env.LOCAL_TEST_MODE === 'true') console.log(`\n>>> LOCAL TEST LOGIN CODE for ${email}:  ${code}   (valid 2 min)\n`);   // no Gmail password set: show the code here instead
  else try { await sendMail(email, otpMail(code, langOf(req))); }
  catch (e) { console.error('MAIL FAIL', e.message); return res.status(502).json({ error: 'mail_failed', detail: e.message }); }
  otps.set(email, { hash: hh(code, email), exp: Date.now() + 120000, tries: 0, at: Date.now() });
  res.json({ ok: true });
}));
app.post('/api/otp/verify', w(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase(), code = String(req.body.code || '').trim();
  if (lockLeft(email)) return res.status(429).json({ error: 'wait', retry: lockLeft(email) });
  const o = otps.get(email);
  if (!o || o.exp < Date.now()) return res.status(400).json({ error: 'expired' });
  if (hh(code, email) !== o.hash) { locks.set(email, Date.now() + 30000); if (++o.tries >= 5) otps.delete(email); return res.status(400).json({ error: 'invalid', retry: 30 }); }
  otps.delete(email); locks.delete(email);
  await C('users').updateOne({ _id: email }, { $set: { last: Date.now(), lang: langOf(req) }, $inc: { logins: 1 }, $setOnInsert: { email, at: Date.now(), approved: false, promo: null } }, { upsert: true });
  res.json({ token: sign({ email, exp: Date.now() + 7 * 864e5 }), user: { email, admin: email === ADMIN, referral: await approved(email) } });
}));
app.get('/api/me', need(), w(async (req, res) => res.json({ ...req.user, referral: await approved(req.user.email) })));

/* ================= public ================= */
app.get('/api/public', w(async (_req, res) => { const [s, m] = await Promise.all([getKV('settings'), getKV('media')]); res.json({ gameName: s.gameName, poster: m.poster, price: s.price, gstin: s.gstin, demo: DEMO }); }));
app.get('/api/legal/:slug', w(async (req, res) => { const k = { terms: 'terms', privacy: 'privacy', refund: 'refund' }[req.params.slug]; if (!k) return res.status(404).json({ error: 'nope' }); res.json({ text: await getKV(k) }); }));
app.get('/api/content', need(), w(async (_req, res) => {
  const [s, media, game, aboutSections, progress, terms, rs] = await Promise.all([getKV('settings'), getKV('media'), getKV('game'), getKV('aboutSections'), getKV('progress'), getKV('terms'), C('reviews').find({ ok: true }).toArray()]);
  res.json({ gameName: s.gameName, nextGame: s.nextGame, price: s.price, gstin: s.gstin, txnPct: s.txnPct || 0, game, aboutSections, progress, media, social: s.social, terms, ...await stats(),
    reviewCount: rs.length, rating: rs.length ? Math.round(rs.reduce((a, r) => a + r.rating, 0) / rs.length * 10) / 10 : 0 });
}));
app.get('/api/stats', need(), w(async (_req, res) => res.json(await stats())));
app.post('/api/promo', need(), w(async (req, res) => {
  const c = await C('codes').findOne({ _id: String(req.body.code || '').trim().toUpperCase() });
  c?.active ? res.json({ pct: c.pct }) : res.status(404).json({ error: 'bad_code' });
}));
/* Reviews are validated, stored and moderated here. One review per account (editing replaces it);
   "verified" is computed from completed purchases in the database, never trusted from the browser. */
const mask = e => { const n = e.split('@')[0]; return n.slice(0, 3) + '***'; };
const lastReview = new Map();
app.get('/api/reviews', need(), w(async (req, res) => {
  const page = Math.max(0, +req.query.page || 0), per = 20;
  const [list, total, mine] = await Promise.all([C('reviews').find({ ok: true }).sort({ at: -1 }).skip(page * per).limit(per).toArray(), C('reviews').countDocuments({ ok: true }), C('reviews').findOne({ _id: req.user.email })]);
  res.json({ total, items: list.map(r => ({ name: r.name, rating: r.rating, text: r.text, at: r.at, verified: !!r.verified })),
    mine: mine && { rating: mine.rating, text: mine.text, visible: mine.ok } });
}));
app.post('/api/reviews', need(), w(async (req, res) => {
  const e = req.user.email, text = String(req.body.text || '').replace(/[\u0000-\u0008\u000B-\u001F]/g, '').trim(), rating = Number(req.body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'bad_rating' });
  if (text.length < 10 || text.length > 600) return res.status(400).json({ error: 'bad_length' });
  if (Date.now() - (lastReview.get(e) || 0) < 10000) return res.status(429).json({ error: 'slow_down' });
  lastReview.set(e, Date.now());
  const verified = !!(await C('purchases').findOne({ email: e, status: 'completed' }));
  const old = await C('reviews').findOne({ _id: e });
  await C('reviews').updateOne({ _id: e }, { $set: { email: e, name: mask(e), text, rating, verified, at: Date.now(), ok: old ? old.ok : true } }, { upsert: true });
  res.json({ ok: true, verified });
}));
app.delete('/api/reviews/mine', need(), w(async (req, res) => { await C('reviews').deleteOne({ _id: req.user.email }); res.json({ ok: true }); }));
app.post('/api/support', w(async (req, res) => {
  const { email, message } = req.body; if (!validEmail(email) || !String(message || '').trim()) return res.status(400).json({ error: 'invalid' });
  await C('tickets').insertOne({ email, message: String(message).slice(0, 3000), at: Date.now() });
  trySend(GMAIL_USER, { subject: `Support: ${email}`, text: `${email}\n\n${message}` }); res.json({ ok: true });
}));
let yt = { at: 0, items: [] };
app.get('/api/gameplay', need(), w(async (_req, res) => {
  const [s, videos] = await Promise.all([getKV('settings'), getKV('videos')]);
  if (YT_API_KEY && Date.now() - yt.at > 6 * 3600e3) try {
    const j = await (await fetch('https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=12&q=' + encodeURIComponent(`"${s.gameName}" gameplay`) + '&key=' + YT_API_KEY)).json();
    yt = { at: Date.now(), items: (j.items || []).map(i => ({ id: i.id.videoId, title: i.snippet.title, channel: i.snippet.channelTitle })) };
  } catch (e) { console.error('YT', e.message); }
  const seen = new Set(); res.json([...videos, ...yt.items].filter(v => v.id && !seen.has(v.id) && seen.add(v.id)));
}));

/* ================= purchases =================
   Each order is one document in `purchases`. Counters (downloads, promo use) change ONLY on pending -> completed.
   TEST DEMO flow: create order -> a 6-digit code is e-mailed -> buyer types it -> order completes -> purchase mail (with GST pin) is sent. */
const payCodes = new Map();                                   // orderId -> { hash, exp, tries, at }
const ph = (c, id) => crypto.createHmac('sha256', SECRET).update('pay' + id + c).digest('hex');
async function sendPayCode(p, lang) {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  if (!mailer && process.env.LOCAL_TEST_MODE === 'true') console.log(`\n>>> LOCAL TEST PAYMENT CODE for ${p.email} (order ${p._id.slice(0, 8)}):  ${code}   (valid 10 min)\n`);
  else await sendMail(p.email, payCodeMail(code, p, lang || p.lang));
  payCodes.set(p._id, { hash: ph(code, p._id), exp: Date.now() + 600000, tries: 0, at: Date.now() });
}
// ONE place that does the maths. The game price is BEFORE GST:
//   gross -> minus discount -> taxable value -> + GST 18% (CGST 9% + SGST 9%) -> + optional transaction charge -> total payable
// e.g. 550 with 10% off: 550 - 55 = 495 taxable; CGST 44.55 + SGST 44.55 = 89.10 GST; total 584.10
function bill(price, pct, txnPct) {
  const gross = round2(price), discount = round2(gross * pct / 100), taxable = round2(gross - discount), gst = round2(taxable * 0.18);
  const cgst = round2(gst / 2), sgst = round2(gst - cgst), charge = round2((taxable + gst) * txnPct / 100);
  return { gstMode: 'excl', listPrice: gross, priceExcl: gross, discountPct: pct, discount, taxable, gstRate: 18, cgstRate: 9, sgstRate: 9, gstAmount: gst, cgst, sgst, txnPct, txnCharge: charge, amountPaid: round2(taxable + gst + charge) };
}
const PAY_THROUGH = ['UPI', 'Card', 'Net Banking'];
const cleanBilling = b => {
  const name = String(b?.name || '').replace(/\s+/g, ' ').trim(), phone = String(b?.phone || '').replace(/[^\d+]/g, ''), address = String(b?.address || '').replace(/[\u0000-\u0008\u000B-\u001F]/g, '').trim();
  if (name.length < 2 || name.length > 80 || !/^\+?\d{7,15}$/.test(phone) || address.length < 10 || address.length > 300) return null;
  return { name, phone, address };
};
const promoPct = async (codeIn, email) => {          // -> { pct, promoCode } or null when the code is not usable
  if (!codeIn) return { pct: 0, promoCode: null };
  const c = await C('codes').findOne({ _id: codeIn }); if (!c?.active || c.owner === email) return null;
  return { pct: c.pct, promoCode: codeIn };
};
const bizOf = s => ({ name: s.bizName, address: s.bizAddress, state: s.bizState, stateCode: s.bizStateCode, sac: s.sac, email: s.supportEmail, phone: s.bizPhone });
/* Bill preview for the checkout pop-up: same maths as the real order, nothing is stored or e-mailed */
app.post('/api/quote', need(), w(async (req, res) => {
  const s = await getKV('settings'), pr = await promoPct(String(req.body.code || '').trim().toUpperCase(), req.user.email);
  if (!pr) return res.status(400).json({ error: 'bad_code' });
  res.json({ ...bill(s.price, pr.pct, s.txnPct || 0), promoCode: pr.promoCode, gstin: s.gstin, gameName: s.gameName, biz: bizOf(s), email: req.user.email });
}));
app.post('/api/orders', need(), w(async (req, res) => {
  if (!DEMO) return res.status(503).json({ error: 'payments_off' });
  const billing = cleanBilling(req.body.billing), payThrough = String(req.body.payThrough || '');
  if (!billing) return res.status(400).json({ error: 'bad_billing' });
  if (!PAY_THROUGH.includes(payThrough)) return res.status(400).json({ error: 'bad_method' });
  const s = await getKV('settings'), pr = await promoPct(String(req.body.code || '').trim().toUpperCase(), req.user.email);
  if (!pr) return res.status(400).json({ error: 'bad_code' });
  const p = { _id: crypto.randomUUID(), email: req.user.email, gameName: s.gameName, ...bill(s.price, pr.pct, s.txnPct || 0), gstin: s.gstin, billing, payThrough,
    paymentMethod: 'TEST DEMO', lang: langOf(req), promoCode: pr.promoCode, status: 'pending', failReason: null, createdAt: Date.now(), paidAt: null, failedAt: null };
  await C('purchases').insertOne(p);
  try { await sendPayCode(p, p.lang); }
  catch (e) { console.error('MAIL FAIL', e.message); await settle(p._id, 'failed', { reason: 'Could not e-mail the payment code' }); return res.status(502).json({ error: 'mail_failed' }); }
  res.json({ ok: true, id: p._id, amount: p.amountPaid, email: p.email });
}));
app.post('/api/orders/:id/code', need(), w(async (req, res) => {        // resend the payment code (30 s cooldown)
  const p = await C('purchases').findOne({ _id: req.params.id, email: req.user.email, status: 'pending' }); if (!p) return res.status(404).json({ error: 'nope' });
  const o = payCodes.get(p._id); if (o && Date.now() - o.at < 30000) return res.status(429).json({ error: 'cooldown', retry: Math.ceil((30000 - (Date.now() - o.at)) / 1000) });
  try { await sendPayCode(p, langOf(req)); } catch (e) { console.error('MAIL FAIL', e.message); return res.status(502).json({ error: 'mail_failed' }); }
  res.json({ ok: true });
}));
app.post('/api/orders/:id/confirm', need(), w(async (req, res) => {       // verifies the e-mailed code, then completes the order
  const p = await C('purchases').findOne({ _id: req.params.id, email: req.user.email }); if (!p) return res.status(404).json({ error: 'nope' });
  if (p.status === 'completed') return res.json({ ok: true, already: true });
  if (p.status !== 'pending') return res.status(409).json({ error: 'not_pending' });
  const o = payCodes.get(p._id), code = String(req.body.code || '').trim();
  if (!o || o.exp < Date.now()) return res.status(400).json({ error: 'expired' });
  if (ph(code, p._id) !== o.hash) { if (++o.tries >= 5) payCodes.delete(p._id); return res.status(400).json({ error: 'invalid' }); }
  payCodes.delete(p._id);
  (await settle(p._id, 'completed', { method: 'TEST DEMO' })) ? res.json({ ok: true }) : res.status(409).json({ error: 'not_pending' });
}));

/* Bill e-mail: sent once at payment. If Gmail fails, retry (10 s, 1 min, 5 min, 30 min) and keep the result on the purchase.
   Unsent bills are also retried when the server starts, so a crash or Gmail outage never loses one. */
const RETRY_MS = [0, 10e3, 60e3, 300e3, 1800e3];
async function sendReceipt(id, attempt = 0) {
  try {
    const p = await C('purchases').findOne({ _id: id });
    if (!p || p.status !== 'completed' || p.receiptSent === true) return;
    const done = await ensureInvoice(p);
    await sendMail(done.email, receiptMail(done, `${CLIENT_ORIGIN}/#order/${done._id}`, done.biz, done.lang));
    await C('purchases').updateOne({ _id: id }, { $set: { receiptSent: true, receiptSentAt: Date.now(), receiptError: null }, $inc: { receiptTries: 1 } });
  } catch (e) {
    console.error('BILL MAIL FAIL', id, `(attempt ${attempt + 1}/${RETRY_MS.length})`, e.message);
    await C('purchases').updateOne({ _id: id }, { $set: { receiptError: String(e.message).slice(0, 200) }, $inc: { receiptTries: 1 } }).catch(() => {});
    if (attempt + 1 < RETRY_MS.length) setTimeout(() => sendReceipt(id, attempt + 1), RETRY_MS[attempt + 1]).unref?.();
  }
}
const retryUnsentReceipts = async () => { for (const p of await C('purchases').find({ status: 'completed', receiptSent: false }).toArray()) sendReceipt(p._id); };
async function settle(id, status, { reason, method, from = ['pending'] } = {}) {
  if (!['completed', 'failed', 'cancelled'].includes(status)) return null;
  const set = { status, ...(method && METHODS.includes(method) ? { paymentMethod: method } : {}) };
  if (status === 'completed') { set.paidAt = Date.now(); set.failReason = null; set.failedAt = null; } else { set.failedAt = Date.now(); set.failReason = String(reason || (status === 'failed' ? 'Payment failed' : 'Cancelled by customer')).slice(0, 200); }
  const p = await C('purchases').findOneAndUpdate({ _id: id, status: { $in: from } }, { $set: set }, { returnDocument: 'after' });   // atomic: a purchase can only be settled once
  if (!p) return null;
  if (status === 'completed') {
    if (p.promoCode) await C('codes').updateOne({ _id: p.promoCode }, { $inc: { uses: 1 } });          // the only place a counter goes up
    const done = await ensureInvoice(p);                                                              // sequential GST invoice number + frozen business details
    await C('purchases').updateOne({ _id: done._id }, { $set: { receiptSent: false, receiptTries: 0 } });   // bill e-mail is owed until a send succeeds
    sendReceipt(done._id);                                                                                // fire-and-forget, retries on failure
    return done;
  }
  return p;
}
/* GST invoice numbering: one gap-free counter per Indian financial year (1 Apr – 31 Mar), e.g. SRG/26-27/000001 (max 16 characters, as the GST rules require).
   The seller details are copied onto the purchase at that moment, so changing the Admin settings later never rewrites an invoice already issued. */
const fyOf = ms => { const d = new Date(ms + 19800000), y = d.getUTCFullYear() + (d.getUTCMonth() >= 3 ? 0 : -1); return `${String(y).slice(2)}-${String(y + 1).slice(2)}`; };
async function ensureInvoice(p) {
  if (p.invoiceNo && p.biz) return p;
  const s = await getKV('settings'), fy = fyOf(p.paidAt || Date.now());
  const biz = p.biz || bizOf(s);
  let invoiceNo = p.invoiceNo;
  if (!invoiceNo) { const c = await C('counters').findOneAndUpdate({ _id: 'inv-' + fy }, { $inc: { n: 1 } }, { upsert: true, returnDocument: 'after' }); invoiceNo = `${s.invPrefix || 'SRG'}/${fy}/${String(c.n).padStart(6, '0')}`; }
  const r = await C('purchases').findOneAndUpdate({ _id: p._id, ...(p.invoiceNo ? {} : { invoiceNo: { $exists: false } }) }, { $set: { invoiceNo, biz, invoiceFy: fy } }, { returnDocument: 'after' });
  return r || await C('purchases').findOne({ _id: p._id });
}
app.get('/api/my/orders', need(), w(async (req, res) => res.json(await C('purchases').find({ email: req.user.email }).sort({ createdAt: -1 }).limit(20).toArray())));
/* Has this user bought the game? (any completed order) -> Home shows Download instead of Buy Now */
app.get('/api/my/purchase', need(), w(async (req, res) => {
  const p = await C('purchases').find({ email: req.user.email, status: 'completed' }).sort({ paidAt: -1 }).limit(1).next();
  res.json(p ? { purchased: true, orderId: p._id, downloadOs: Object.keys(OS).filter(dlFile) } : { purchased: false });
}));
app.get('/api/orders/:id', need(), w(async (req, res) => {
  const p = await C('purchases').findOne({ _id: req.params.id, email: req.user.email }); if (!p) return res.status(404).json({ error: 'nope' });
  const st = await getKV('settings'); if (p.status === 'completed') Object.assign(p, await ensureInvoice(p));
  res.json({ ...p, gstin: p.gstin || st.gstin, downloadOs: p.status === 'completed' ? Object.keys(OS).filter(dlFile) : [] });
}));
/* Download = verify the payment again, then hand out a 2-minute signed link. The browser then GETs that link and the file starts. */
app.post('/api/orders/:id/download', need(), w(async (req, res) => {
  const os = String(req.body.os || '').toLowerCase(), p = await C('purchases').findOne({ _id: req.params.id, email: req.user.email });
  if (!p) return res.status(404).json({ error: 'nope' });
  if (p.status !== 'completed') return res.status(402).json({ error: 'not_paid' });
  if (!OS[os] || !dlFile(os)) return res.status(404).json({ error: 'no_build' });
  res.json({ ok: true, url: '/api/dl/' + sign({ dl: 1, id: p._id, os, exp: Date.now() + 120000 }) });
}));
app.get('/api/dl/:token', w(async (req, res) => {
  const t = verify(req.params.token); if (!t?.dl) return res.status(403).send('Link expired — go back and press Download again.');
  const p = await C('purchases').findOne({ _id: t.id, status: 'completed' }), f = dlFile(t.os); if (!p || !f) return res.status(404).send('Not found');
  await C('purchases').updateOne({ _id: p._id }, { $inc: { downloads: 1 }, $set: { lastDownloadOs: t.os, lastDownloadAt: Date.now() } });
  const ext = path.extname(f), test = /^\.(png|jpe?g|webp|gif|svg)$/i.test(ext) ? '-TEST' : '';
  res.download(path.join(DL_DIR, f), `${slug(p.gameName)}-${OS[t.os]}${test}${ext}`);
}));
app.post('/api/orders/:id/cancel', need(), w(async (req, res) => {
  const own = await C('purchases').findOne({ _id: req.params.id, email: req.user.email });
  own && await settle(own._id, 'cancelled') ? res.json({ ok: true }) : res.status(409).json({ error: 'not_pending' });
}));
app.post('/api/payments/confirm', w(async (req, res) => {          // payment gateway webhook
  if (!PAYMENT_WEBHOOK_SECRET || req.headers['x-webhook-secret'] !== PAYMENT_WEBHOOK_SECRET) return res.status(403).json({ error: 'forbidden' });
  (await settle(req.body.orderId, req.body.status, { reason: req.body.reason, method: req.body.paymentMethod })) ? res.json({ ok: true }) : res.status(409).json({ error: 'not_pending' });
}));

/* ================= referral (approved users only) ================= */
app.get('/api/referral', need(), w(async (req, res) => {
  const e = req.user.email;
  if (!await approved(e)) return res.status(403).json({ error: 'not_allowed' });
  const u = await C('users').findOne({ _id: e }), c = u?.promo && await C('codes').findOne({ _id: u.promo });
  if (!c) return res.json({ code: null });
  const since = d => Date.now() - d * 864e5, cnt = d => C('purchases').countDocuments({ promoCode: c._id, status: 'completed', paidAt: { $gte: d } });
  const sod = new Date(); sod.setHours(0, 0, 0, 0);
  res.json({ code: c._id, pct: c.pct, uses: c.uses, today: await cnt(sod.getTime()), week: await cnt(since(7)), month: await cnt(since(30)), link: `${CLIENT_ORIGIN}/?code=${c._id}` });   // counts only — buyer identities are never shared
}));

/* ================= admin ================= */
const A = need(true);
app.get('/api/admin', A, w(async (_req, res) => {
  const [users, codes, purchases, reviews, tickets, settings, media, videos, terms, privacy, refund, game, aboutSections] = await Promise.all([
    C('users').find().sort({ at: -1 }).toArray(), C('codes').find().toArray(), C('purchases').find().sort({ createdAt: -1 }).limit(500).toArray(),
    C('reviews').find().sort({ at: -1 }).toArray(), C('tickets').find().sort({ at: -1 }).limit(200).toArray(), getKV('settings'), getKV('media'), getKV('videos'), getKV('terms'), getKV('privacy'), getKV('refund'), getKV('game'), getKV('aboutSections')]);
  const cm = Object.fromEntries(codes.map(c => [c._id, c]));
  res.json({ users: users.map(u => ({ ...u, code: u.promo, uses: cm[u.promo]?.uses || 0 })), codes: codes.map(c => ({ ...c, code: c._id })),
    purchases: purchases.map(p => ({ ...p, id: p._id })), reviews: reviews.map(r => ({ ...r, id: r._id, _id: undefined })), tickets, videos, settings, media, legal: { terms, privacy, refund }, game, aboutSections, ...await stats() });
}));
app.put('/api/admin/users/:email/approve', A, w(async (req, res) => {
  const email = req.params.email.toLowerCase(), u = await C('users').findOne({ _id: email }); if (!u) return res.status(404).json({ error: 'no_user' });
  const on = !!req.body.approved; let promo = u.promo, fresh = false;
  if (on && !promo) { const s = await getKV('settings'); promo = await newCode(); fresh = true; await C('codes').insertOne({ _id: promo, owner: email, pct: s.refPct, uses: 0, active: true, at: Date.now() }); }
  await C('users').updateOne({ _id: email }, { $set: { approved: on, promo } });
  if (promo) await C('codes').updateOne({ _id: promo }, { $set: { active: on } });       // stays linked to the user, switched off if access is removed
  if (fresh) { const s = await getKV('settings'); trySend(email, welcomeMail(promo, s.refPct, `${CLIENT_ORIGIN}/?code=${promo}`, s.gameName, `${CLIENT_ORIGIN}/#referral`, u.lang)); }
  res.json({ ok: true });
}));
app.post('/api/admin/codes', A, w(async (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase(), pct = +req.body.pct;
  if (!/^[A-Z0-9-]{3,20}$/.test(code) || !(pct > 0 && pct <= 100) || await C('codes').findOne({ _id: code })) return res.status(400).json({ error: 'invalid_or_exists' });
  await C('codes').insertOne({ _id: code, owner: null, pct, uses: 0, active: true, at: Date.now() }); res.json({ ok: true });
}));
/* ================= game updates (admin posts, buyers see them + optional e-mail) ================= */
app.get('/api/updates', need(), w(async (_req, res) => res.json(await C('updates').find({}).sort({ createdAt: -1 }).limit(100).toArray().then(a => a.map(u => ({ id: u._id, version: u.version, title: u.title, notes: u.notes, at: u.createdAt, emailed: u.emailed || 0 }))))));
app.post('/api/admin/updates', A, w(async (req, res) => {
  const version = String(req.body.version || '').trim().slice(0, 30), title = String(req.body.title || '').trim().slice(0, 120), notes = String(req.body.notes || '').trim().slice(0, 8000);
  if (!version || !notes) return res.status(400).json({ error: 'version and notes required' });
  const st = await getKV('settings'), u = { _id: crypto.randomUUID(), version, title, notes, gameName: st.gameName, createdAt: Date.now(), emailed: 0 };
  await C('updates').insertOne(u);
  if (req.body.notify) {
    const buyers = (await C('purchases').distinct('email', { status: 'completed' })).filter(validEmail);   // only people who really bought
    res.json({ ok: true, id: u._id, emailing: buyers.length });
    let n = 0; for (const e of buyers) { try { await sendMail(e, updateMail(u, `${CLIENT_ORIGIN}/#updates`, 'en')); n++; } catch (err) { console.error('UPDATE MAIL FAIL', e, err.message); } await new Promise(r => setTimeout(r, 400)); }
    await C('updates').updateOne({ _id: u._id }, { $set: { emailed: n } });
  } else res.json({ ok: true, id: u._id, emailing: 0 });
}));
app.delete('/api/admin/updates/:id', A, w(async (req, res) => { await C('updates').deleteOne({ _id: req.params.id }); res.json({ ok: true }); }));
app.post('/api/admin/purchases/:id/resend-bill', A, w(async (req, res) => { const r = await C('purchases').updateOne({ _id: req.params.id, status: 'completed' }, { $set: { receiptSent: false } }); if (!r.matchedCount) return res.status(404).json({ error: 'nope' }); sendReceipt(req.params.id); res.json({ ok: true }); }));
app.put('/api/admin/purchases/:id', A, w(async (req, res) => (await settle(req.params.id, req.body.status, { reason: req.body.reason })) ? res.json({ ok: true }) : res.status(409).json({ error: 'not_pending' })));
app.put('/api/admin/settings', A, w(async (req, res) => {
  const s = req.body, o = await getKV('settings');
  for (const k of ['goal', 'baseDownloads', 'price', 'refPct']) if (Number.isFinite(+s[k]) && +s[k] >= 0 && s[k] !== '') o[k] = +s[k];
  for (const k of ['gameName', 'nextGame']) if (typeof s[k] === 'string' && s[k].trim()) o[k] = s[k].trim().slice(0, 80);
  if (typeof s.gstin === 'string' && /^[A-Za-z0-9-]{3,20}$/.test(s.gstin.trim())) o.gstin = s.gstin.trim().toUpperCase();
  for (const [k, max] of [['bizName', 80], ['bizAddress', 200], ['bizState', 40], ['bizStateCode', 2], ['bizPhone', 20], ['sac', 8]]) if (typeof s[k] === 'string') o[k] = s[k].trim().slice(0, max);
  if (typeof s.supportEmail === 'string' && validEmail(s.supportEmail.trim())) o.supportEmail = s.supportEmail.trim();
  if (typeof s.invPrefix === 'string' && /^[A-Za-z0-9]{1,4}$/.test(s.invPrefix.trim())) o.invPrefix = s.invPrefix.trim().toUpperCase();
  if (Number.isFinite(+s.txnPct) && +s.txnPct >= 0 && +s.txnPct <= 20 && s.txnPct !== '') o.txnPct = +s.txnPct;
  if (s.social) for (const k of Object.keys(o.social)) if (typeof s.social[k] === 'string' && /^https?:\/\//.test(s.social[k])) o.social[k] = s.social[k];
  await setKV('settings', o); res.json({ ok: true });
}));
app.put('/api/admin/media', A, w(async (req, res) => {
  const m = req.body, o = await getKV('media'), okSrc = x => typeof x === 'string' && /^(\/uploads\/|\/images\/)[\w./-]+$/.test(x);
  if (okSrc(m.poster)) o.poster = m.poster;
  if (Array.isArray(m.gallery)) o.gallery = m.gallery.filter(okSrc);
  if (Array.isArray(m.aboutImages)) o.aboutImages = m.aboutImages.filter(okSrc);
  if (Array.isArray(m.aboutPhotos)) o.aboutPhotos = m.aboutPhotos.filter(x => x && okSrc(x.src) && ['founder', 'gst', 'studio'].includes(x.kind)).slice(0, 12).map(x => ({ src: x.src, kind: x.kind, caption: String(x.caption || '').slice(0, 160) }));
  if (['left', 'right', 'top', 'grid'].includes(m.aboutLayout)) o.aboutLayout = m.aboutLayout;
  await setKV('media', o); res.json({ ok: true });
}));
app.post('/api/admin/upload', A, w(async (req, res) => {
  const m = /^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/.exec(String(req.body.data || ''));
  if (!m) return res.status(400).json({ error: 'png_jpg_webp_gif_only' });
  const buf = Buffer.from(m[2], 'base64'); if (buf.length > 5 * 1024 * 1024) return res.status(413).json({ error: 'too_big' });
  const name = crypto.randomUUID() + '.' + m[1].replace('jpeg', 'jpg'); fs.writeFileSync(path.join('uploads', name), buf); res.json({ src: '/uploads/' + name });
}));
app.put('/api/admin/legal/:slug', A, w(async (req, res) => { const k = ['terms', 'privacy', 'refund'].includes(req.params.slug) && req.params.slug; if (!k || typeof req.body.text !== 'string' || !req.body.text.trim()) return res.status(400).json({ error: 'invalid' }); await setKV(k, req.body.text); res.json({ ok: true }); }));
app.put('/api/admin/game', A, w(async (req, res) => { const g = req.body, ok = o => o && typeof o === 'object' && Object.values(o).every(v => typeof v === 'string'); if (!ok(g.short) || !ok(g.long) || !Array.isArray(g.details)) return res.status(400).json({ error: 'invalid' }); await setKV('game', { short: g.short, long: g.long, details: g.details.filter(d => d.k && d.v).map(d => ({ k: String(d.k).slice(0, 40), v: String(d.v).slice(0, 200) })) }); res.json({ ok: true }); }));
app.put('/api/admin/about', A, w(async (req, res) => { if (!Array.isArray(req.body.sections)) return res.status(400).json({ error: 'invalid' }); await setKV('aboutSections', req.body.sections.map((x, i) => ({ id: String(x.id || i), title: x.title || {}, body: x.body || {} }))); res.json({ ok: true }); }));
app.put('/api/admin/progress', A, w(async (req, res) => { if (Array.isArray(req.body.progress)) await setKV('progress', req.body.progress); res.json({ ok: true }); }));
app.put('/api/admin/videos', A, w(async (req, res) => { await setKV('videos', (req.body.videos || []).filter(v => v.id)); res.json({ ok: true }); }));
app.delete('/api/admin/reviews/:id', A, w(async (req, res) => { await C('reviews').deleteOne({ _id: req.params.id }); res.json({ ok: true }); }));
app.put('/api/admin/reviews/:id', A, w(async (req, res) => { await C('reviews').updateOne({ _id: req.params.id }, { $set: { ok: !!req.body.ok } }); res.json({ ok: true }); }));

retryUnsentReceipts().catch(e => console.error('receipt sweep', e.message));
app.listen(PORT, () => console.log(`SRG server on :${PORT} | MongoDB connected | mail ${mailer ? 'READY from ' + GMAIL_USER : 'NOT configured (set GMAIL_APP_PASSWORD)'} | payments: ${DEMO ? 'TEST DEMO (e-mailed code) — do not put real game builds in server/downloads while this is on' : 'demo OFF'}`));
