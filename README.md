# Squad Round Games — React edition

```
server/   Express API (OTP mail via Gmail, admin, referral access, YouTube gameplay)
client/   React + Vite comic-style site (18 languages: English, தமிழ், 한국어, 日本語, 中文, Русский, Français, മലയാളം, తెలుగు, हिन्दी, Español, Nederlands, Deutsch, සිංහල, اردو, العربية, ತುಳು, मराठी)
```

## Run (Windows: just double-click start.bat)
```bash
cd server && cp .env.example .env     # fill GMAIL_APP_PASSWORD + ADMIN_EMAIL
npm install && npm start              # http://localhost:4000
cd ../client && npm install && npm run dev   # http://localhost:5173
```

## OTP mail (squadroundgames@gmail.com)
The old project used `MAIL_BACKEND=console`, which only printed codes to the log. Now:
1. Sign in to squadroundgames@gmail.com → Security → turn on 2-Step Verification.
2. Google Account → Security → **App passwords** → create one → paste into `GMAIL_APP_PASSWORD`.
3. Set `ADMIN_EMAIL` to the address that should be admin (log in with it via OTP).

## Admin panel (log in as ADMIN_EMAIL → Admin tab)
Edit About (per language) · set progress sliders for every Next-Game task · choose who can see Referral/Share ·
add YouTube gameplay links · promo codes · approve reviews.

## YouTube gameplay tab
Add links in Admin, and/or set `YT_API_KEY` (YouTube Data API v3) to auto-fetch "Afraid in Basement" gameplay.

## What the database stores (MongoDB, database `squadround`)
users (every login email) · referral approvals · unique promo code per approved user · code usage counters · purchases (pending/completed/failed/cancelled) · reviews+stars · support tickets.
Counters (downloads, promo use) are computed/updated only when a purchase becomes **completed** — by the payment webhook
`POST /api/payments/confirm` (header `x-webhook-secret`, body `{orderId,status}`) or by the admin pressing "Paid".
`purchases` holds one document per order: customer email, purchase ID, game name, list price, discount, amount paid, payment method, promo code, status (pending/completed/failed/cancelled), failure reason, created/paid/failed timestamps.
Set `MONGODB_URI` in `server/.env` (local MongoDB Community, or a free MongoDB Atlas link). Old `data.json` data is not imported.
Emails use the comic layouts (login code, receipt, creator welcome). Game name, next game, download link and Terms are editable in Admin.
Uploads (poster, gallery, about images) are saved in `server/uploads/`.

## Pages (all visible only after OTP login, except Terms/Privacy/Refund)
Landing+login · Home (price ₹550 incl. tax, downloads meter, details cards, gallery strip) · Description · Gameplay (YouTube) · Gallery · Reviews (stars, verified-buyer badge, backend-moderated) ·
About (admin-editable sections, images, layout) · Support (socials, goal meter, tickets) · Next Game (phase progress) · Referral (approved users) · Order status (KAPOW/SPLAT) · Admin.
Payment is the test-demo pop-up after pressing BUY NOW.

## Button motion (Comic UI Kit)
All buttons use the 15 animated Comic UI Kit styles (`.bt .b1–.b15` in styles.css). Letters hop on hover, and every click fires a particle burst, a POW!/BAM! word and a spring pop (`client/src/fx.js`). Motion switches off automatically for visitors who enabled "reduce motion" in their system.
In code: `<Btn kit={n}>label</Btn>`, n = 1–15 (1 lift, 2 wobble, 3 slide-fill, 4 jelly, 5 star spin, 6 speech bubble, 7 dots, 8 zig-zag, 9 invert, 10 stripes, 11 stretch, 12 flip-reveal, 13 glitch, 14 pulse ring, 15 rocket).

## Test-demo payment + download (no payment gateway)
1. Buyer ticks Terms → BUY NOW → **SEND CODE TO MY EMAIL** (6-digit code, valid 10 min, 5 tries).
2. Buyer enters the code → order becomes `completed` → the **purchase mail** (breakdown + GST PIN + link) is sent → the order page shows your invoice and the **DOWNLOAD** box.
3. Download box: pick **Windows / Linux / macOS / Android** → *VERIFY & DOWNLOAD* → server re-checks the payment, issues a 2-minute signed link, file starts.
- Build files live in `server/downloads/` named `windows.*`, `linux.*`, `macos.*`, `android.*`. Right now they are **test images** (`.png`). Replace them with real builds when you go live, and set `DEMO_PAYMENTS=false`.
- **GST PIN**: Admin → *Goal, price & social links* → *GST PIN* (default `658787857687`). It shows in the footer (hover = shadow), the pay pop-up, the invoice and the purchase mail.
- **Transaction charge %** (same admin box) is `0` by default so the price stays ₹550 all-in; set 3 to match the sample invoice.
- Dev without Gmail: set `LOCAL_TEST_MODE=true` and codes print in the server window.
- Old YouPI-PG setup and `PAYMENT_TESTING.md` are removed.

## Comic UI Kit on the whole site (client/src/kitfx.js + fx.js + sound.js)
- Every `Btn` (b1–b15), `.f` form, `.tb` text box and search box is auto-registered (MutationObserver) with its own hover / press / focus motion, click or submit particle burst + POW!-style word, and typing shake with key-tick particles at the caret; finishing a word floats it above the field.
- Header controls: ✨ Motion ON/OFF (stops animations, particles and popups, saved), 🌙/☀️ Theme, 🎨 randomize palette (Shift+click = classic). The palette drives the site's own colour variables.
- Sound (🔊 button mutes everything): keyboard typing in any text field plays key sounds (letters, space, Enter, Backspace); mouse presses play a click on press and release; Enter/Space on a focused button sounds like a key press.

## Home: Buy vs Download
- Logged-in user with a **completed** order → Home shows **⬇ DOWNLOAD** + a ▾ dropdown (Windows, Linux, macOS, Android). Picking an OS verifies the payment again and downloads that build (`GET /api/my/purchase`, then `POST /api/orders/:id/download`).
- No purchase, or only failed / cancelled / pending orders → Home shows the price, promo code, terms and **BUY NOW**.
- Test builds: `server/downloads/{windows,linux,macos,android}.jpg` are sample pictures (OpenCV sample images from GitHub). Replace each with the real build (any extension, file must start with the OS name) and the same button serves it.


## Languages, e-mails & GST invoice (added)
- Every language has ONE complete file: `client/src/i18n/<code>.json`. The website AND the server (login code, payment code,
  GST invoice, creator welcome mails) read the same files, so a fix in one place fixes both.
  To add a language: copy `en.json`, translate it, add the code to `LANGS` in `client/src/i18n.js` and `LANG_CODES` in `server/mail.js`.
- Arabic and Urdu switch the whole page to right-to-left automatically.
- Tulu (ತುಳು) is written in Kannada script. It is a best-effort translation — please have a native speaker review it.
- The language the visitor has selected is sent with every request (`X-Lang`), stored on the order, and used for that order's e-mails.
- After a verified payment the buyer gets a GST tax invoice by e-mail (in the buyer's language) with the invoice also attached as a printable file.
  Invoice numbers are sequential per Indian financial year, e.g. `SRG/26-27/000001` (change the prefix in Admin).
  Fill in the seller details in **Admin → Goal, price & social links**: GSTIN, legal name, address, state + state code, SAC, support e-mail.
  The seller details are frozen onto each invoice when it is issued.
- Legal pages (Terms / Privacy / No-returns) and the Admin panel stay in English.


## Premium comic pass (added)
- **Click**: every button click spawns canvas particles, a randomized BANG!/POW!/BOOM!/ZAP!/CLICK!/WHAM! sticker on a hand-cut starburst, and an impact ring near the pointer (`kitfx.js` → `comicWord`, `impactRing`). Max 5 stickers / 6 rings alive; all removed when finished.
- **Typing**: a 140 ms horizontal nudge of the field itself + border flash on every keystroke (`shake` in `kitfx.js`); cancels the previous nudge so fast typing retriggers cleanly.
- **Text pop**: `<ComicText>` (shared.jsx) pops page titles word by word with an animated underline stroke; `popfx.js` pops headings/labels when they scroll into view (WAAPI, React DOM untouched, paragraphs never split).
- **Sliders**: `<Slide>` (shared.jsx) streams particles behind the thumb while dragging (speed-aware), bursts + bounces on release; mouse, touch, pen, arrows, Home/End/PageUp/PageDown.
- **Extras**: checkbox success burst, switch ZAP!, angled footer divider, clipped page-wipe transition, speech-bubble toasts/callouts, comic tooltips (`data-tip`), `<Loading>`, `<ComicBurst>`, empty/error states.
- Phones / weak CPUs get half the particles; `prefers-reduced-motion` (live) turns every effect off and content shows instantly.
