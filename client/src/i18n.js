import en from './i18n/en.json'; import ta from './i18n/ta.json'; import hi from './i18n/hi.json';
import ml from './i18n/ml.json'; import te from './i18n/te.json'; import mr from './i18n/mr.json';
import zh from './i18n/zh.json'; import ko from './i18n/ko.json'; import ru from './i18n/ru.json';
import de from './i18n/de.json'; import fr from './i18n/fr.json'; import ja from './i18n/ja.json';
import si from './i18n/si.json'; import nl from './i18n/nl.json'; import es from './i18n/es.json';
import ur from './i18n/ur.json'; import ar from './i18n/ar.json'; import tcy from './i18n/tcy.json';

// Every language has its own complete file in ./i18n/ (the server reads the same files for e-mails and invoices).
export const LANGS = { en: 'English', ta: 'தமிழ்', ko: '한국어', ja: '日本語', zh: '中文', ru: 'Русский', fr: 'Français', ml: 'മലയാളം', te: 'తెలుగు', hi: 'हिन्दी', es: 'Español', nl: 'Nederlands', de: 'Deutsch', si: 'සිංහල', ur: 'اردو', ar: 'العربية', tcy: 'ತುಳು', mr: 'मराठी' };
export const RTL = ['ar', 'ur'];
export const LATIN = ['en', 'de', 'fr', 'nl', 'es'];
const packs = { en, ta, hi, ml, te, mr, zh, ko, ru, de, fr, ja, si, nl, es, ur, ar, tcy };

// Safety net only: a missing key falls back to English, then to the key itself.
export const makeT = lang => (k, vars = {}) => {
  let s = packs[lang]?.[k] ?? packs.en[k] ?? k;
  for (const v in vars) s = s.replaceAll(`{${v}}`, vars[v]);
  return s;
};
