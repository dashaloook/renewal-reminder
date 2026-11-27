// Renewal Reminder — languages (Ukrainian by default, English as an option).
//
// How it works
// - The app's text is written in English. Every element goes through one function (RRI18n.h, used by
//   `html` in app.js), which swaps each piece of text and each aria-label / title / placeholder / alt
//   for its Ukrainian version from UK below (exact match), or from PATTERNS (text with numbers,
//   names or dates inside). Brand names (Netflix, Spotify…) and what people typed stay as they are.
// - The choice is kept in this browser ('rr-lang') and, for accounts, in the profile (`lang`), so
//   reminder emails come in the same language.
// - Text with no translation shows in English and is listed in window.RR_MISSES (for checking).
(function () {
  const LANGS = [['uk', 'Українська', 'УКР'], ['en', 'English', 'ENG']];
  let LANG = 'uk';
  try { const s = localStorage.getItem('rr-lang'); if (s === 'en' || s === 'uk') LANG = s; } catch (e) { /* private mode */ }

  const lang = () => LANG;
  const locale = () => (LANG === 'uk' ? 'uk-UA' : 'en-GB');
  // Dates in the chosen language. Ukrainian: no trailing "р.", and the weekday in its plain form
  // (Intl gives "пʼятницю, 27 листопада"; we show "пʼятниця, 27 листопада").
  const WDN = { 'середу': 'середа', 'пʼятницю': 'пʼятниця', "п'ятницю": "п'ятниця", 'суботу': 'субота', 'неділю': 'неділя' };
  const date = (d, opts) => {
    let s = d.toLocaleDateString(locale(), opts);
    if (LANG === 'uk') s = s.replace(/ р\.$/, '').replace(/ р\.(?=[ ,])/g, '').replace(/^(середу|пʼятницю|п'ятницю|суботу|неділю)/, (m) => WDN[m]);
    return s;
  };
  const setLang = (l) => {
    if (l !== 'uk' && l !== 'en') return;
    LANG = l; cache.clear();
    try { localStorage.setItem('rr-lang', l); } catch (e) { /* ok */ }
    try { document.documentElement.lang = l; } catch (e) { /* ok */ }
  };

  // Ukrainian plural: 1 нагадування, 2 нагадування, 5 нагадувань; 21 день, 22 дні, 25 днів.
  const plural = (n, one, few, many) => {
    n = Math.abs(Number(n)) % 100; const d = n % 10;
    if (n > 10 && n < 20) return many;
    if (d === 1) return one;
    if (d >= 2 && d <= 4) return few;
    return many;
  };
  const W = {
    reminder: ['нагадування', 'нагадування', 'нагадувань'],
    day: ['день', 'дні', 'днів'],
    decision: ['рішення', 'рішення', 'рішень'],
    result: ['результат', 'результати', 'результатів'],
    renewal: ['продовження', 'продовження', 'продовжень'],
    item: ['пункт', 'пункти', 'пунктів'],
    charge: ['списання', 'списання', 'списань'],
    service: ['сервіс', 'сервіси', 'сервісів'],
  };
  const pl = (n, w) => `${n} ${plural(n, ...W[w])}`;

  const UK = {};      // filled in i18n-uk.js: English text → Ukrainian text
  const PATTERNS = []; // [regex, (match) => Ukrainian], for text with numbers / names / dates

  const misses = new Set(); window.RR_MISSES = misses;
  const cache = new Map();
  const ASCII_WORD = /[A-Za-z]{2}/;
  const CYR = /[\u0400-\u04FF]/;

  // Translates one piece of text. Leading/trailing spaces are kept, so pieces still join up.
  function t(s) {
    if (LANG === 'en' || typeof s !== 'string' || !ASCII_WORD.test(s)) return s;
    const hit = cache.get(s); if (hit !== undefined) return hit;
    const m = s.match(/^(\s*)([\s\S]*?)(\s*)$/); const core = m[2];
    let out = Object.prototype.hasOwnProperty.call(UK, core) ? UK[core] : null;
    if (out === null) {
      for (const [re, fn] of PATTERNS) { const x = core.match(re); if (x) { out = typeof fn === 'function' ? fn(x) : fn; break; } }
    }
    // No match and already Ukrainian (a date or a brand name inside): keep it, nothing to report.
    if (out === null) { if (!CYR.test(core)) misses.add(core); out = core; }
    const res = m[1] + out + m[3];
    if (cache.size > 3000) cache.clear();
    cache.set(s, res); return res;
  }

  const PROPS = ['aria-label', 'title', 'placeholder', 'alt', 'aria-roledescription'];
  const NO_TEXT = { textarea: 1, input: 1, style: 1, script: 1 };
  const tr = (c) => (typeof c === 'string' ? t(c) : Array.isArray(c) ? c.map(tr) : c);

  // Used by htm instead of React.createElement. this[0] = 3 turns off htm's caching of
  // unchanging parts, so a language switch redraws everything.
  function h(type, props, ...children) {
    this[0] = 3;
    if (LANG !== 'en') {
      if (props) {
        let p = null;
        for (const k of PROPS) if (typeof props[k] === 'string' && ASCII_WORD.test(props[k])) { p = p || { ...props }; p[k] = t(props[k]); }
        if (p) props = p;
      }
      if (!(typeof type === 'string' && NO_TEXT[type])) children = children.map(tr);
    }
    return React.createElement(type, props, ...children);
  }

  try { document.documentElement.lang = LANG; } catch (e) { /* ok */ }
  document.addEventListener('DOMContentLoaded', () => { const a = document.querySelector('a.skip'); if (a && LANG === 'uk') a.textContent = 'Перейти до вмісту'; });
  window.RRI18n = { LANGS, lang, locale, date, setLang, t, h, UK, PATTERNS, plural, pl, W };
})();
