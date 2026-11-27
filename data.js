// Renewal Reminder — single mock-data module (demo only, no backend)
// All dates are computed relative to "today" so the prototype never goes stale.
(function () {
  const DAY = 864e5;
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const addMonths = (d, n, keepDay) => {
    const x = new Date(d); const day = keepDay || x.getDate(); x.setDate(1); x.setMonth(x.getMonth() + n);
    const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate(); x.setDate(Math.min(day, last)); return x;
  };
  const daysUntil = (s) => Math.round((parse(s) - today()) / DAY);
  const off = (n) => iso(addDays(today(), n));

  const USER = { name: 'Alex Koval', first: 'Alex', email: 'alex@example.com', initials: 'AK' };

  const CATEGORIES = [
    { id: 'subscription', label: 'Subscriptions', one: 'Subscription' },
    { id: 'payment', label: 'Payments', one: 'Payment' },
    { id: 'document', label: 'Documents', one: 'Document' },
    { id: 'insurance', label: 'Insurance', one: 'Insurance' },
    { id: 'household', label: 'Household', one: 'Household' },
  ];
  const CYCLES = [
    { id: 'weekly', label: 'Weekly', per: 'week' },
    { id: 'monthly', label: 'Monthly', per: 'month' },
    { id: 'yearly', label: 'Yearly', per: 'year' },
    { id: 'one-time', label: 'One-time', per: '' },
  ];
  const REASONS = ['No access to account', 'Need to compare prices', 'Need to discuss with someone', 'Other'];
  const TONES = ['rose', 'sky', 'lavender', 'yellow', 'peach'];

  // Services people in Ukraine and elsewhere actually pay for (Disney+ and the Amazon Prime membership
  // aren't offered in Ukraine). prices = typical list prices; only the one in `base` (USD, or UAH for Ukrainian services) is used, the rest come from today's exchange rate.
  // group = how the onboarding list is organised; the first 6 are the Quick start chips.

  // ---------- exchange rates ----------
  // RATES[c] = how many hryvnias 1 unit of c is worth. Official National Bank of Ukraine rate
  // (updated daily, no key needed); open.er-api.com as a backup; the values below if both are offline.
  // Kept for 12 hours in this browser. When rates arrive, 'rr-rates' is sent so the screen redraws.
  const RATES = { USD: 45.02, EUR: 49.35, UAH: 1, date: '2026-11-30', src: 'built-in' };
  const RATE_KEY = 'rr-rates';
  const setRates = (r) => { Object.assign(RATES, r); try { window.dispatchEvent(new Event('rr-rates')); } catch (e) {} };
  const ok = (n) => typeof n === 'number' && n > 0 && isFinite(n);
  (async function loadRates() {
    try { const c = JSON.parse(localStorage.getItem(RATE_KEY) || 'null'); if (c && Date.now() - c.at < 12 * 3600e3 && ok(c.USD) && ok(c.EUR)) { setRates(c); return; } } catch (e) {}
    const save = (r) => { setRates(r); try { localStorage.setItem(RATE_KEY, JSON.stringify({ ...r, at: Date.now() })); } catch (e) {} };
    try {
      const list = await (await fetch('https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json')).json();
      const get = (cc) => (list.find((x) => x.cc === cc) || {}).rate;
      if (ok(get('USD')) && ok(get('EUR'))) { const [dd, mm, yy] = String(list[0].exchangedate || '').split('.'); return save({ USD: get('USD'), EUR: get('EUR'), date: yy ? `${yy}-${mm}-${dd}` : RATES.date, src: 'NBU' }); }
    } catch (e) {}
    try {
      const j = await (await fetch('https://open.er-api.com/v6/latest/USD')).json();
      if (ok(j.rates.UAH) && ok(j.rates.EUR)) return save({ USD: j.rates.UAH, EUR: j.rates.UAH / j.rates.EUR, date: new Date(j.time_last_update_unix * 1000).toISOString().slice(0, 10), src: 'open.er-api.com' });
    } catch (e) {}
  })();
  // Converts an amount between USD / EUR / UAH at today's rate, rounded to cents.
  const convert = (n, from, to) => {
    n = Number(n) || 0; if (!n || from === to || !RATES[from] || !RATES[to]) return n;
    return Math.round((n * RATES[from]) / RATES[to] * 100) / 100;
  };

  // Each reminder has its own currency (r.currency); totals are shown in the main currency
  // (the profile's), converted at today's rate. Old reminders without one are in the main currency.
  let MAIN = 'USD';
  const setMain = (c) => { MAIN = c; };
  const curOf = (r) => r.currency || MAIN;
  const inMain = (r) => convert(r.amount, curOf(r), MAIN);

  const P = (usd, eur, uah) => ({ USD: usd, EUR: eur, UAH: uah });
  const TEMPLATES = [
    { name: 'Netflix', group: 'Video & music', url: 'https://www.netflix.com/cancelplan', category: 'subscription', cycle: 'monthly', tone: 'rose', prices: P(17.99, 13.99, 279) },
    { name: 'YouTube Premium', group: 'Video & music', url: 'https://www.youtube.com/paid_memberships', category: 'subscription', cycle: 'monthly', tone: 'rose', prices: P(13.99, 12.99, 99) },
    { name: 'Spotify', group: 'Video & music', url: 'https://www.spotify.com/account/subscription/', category: 'subscription', cycle: 'monthly', tone: 'yellow', prices: P(11.99, 10.99, 169) },
    { name: 'ChatGPT Plus', group: 'AI', url: 'https://help.openai.com/en/articles/7232927', category: 'subscription', cycle: 'monthly', tone: 'sky', prices: P(20, 23, 849) },
    { name: 'Telegram Premium', group: 'Social', url: 'https://telegram.org/faq_premium', category: 'subscription', cycle: 'monthly', tone: 'sky', prices: P(4.99, 4.99, 209) },
    { name: 'iCloud+', group: 'Cloud & tools', url: 'https://support.apple.com/HT207594', category: 'subscription', cycle: 'monthly', tone: 'sky', prices: P(2.99, 2.99, 109) },
    { name: 'Megogo', base: 'UAH', group: 'Video & music', url: 'https://megogo.net/ua/subscriptions', category: 'subscription', cycle: 'monthly', tone: 'lavender', prices: P(2.99, 2.99, 99) },
    { name: 'Kyivstar TV', base: 'UAH', group: 'Video & music', url: 'https://tv.kyivstar.ua', category: 'subscription', cycle: 'monthly', tone: 'sky', prices: P(2.49, 2.29, 99) },
    { name: 'Sweet.tv', base: 'UAH', group: 'Video & music', url: 'https://sweet.tv', category: 'subscription', cycle: 'monthly', tone: 'peach', prices: P(1.49, 1.39, 49) },
    { name: 'Prime Video', group: 'Video & music', url: 'https://www.primevideo.com/settings', category: 'subscription', cycle: 'monthly', tone: 'sky', prices: P(8.99, 4.99, 215) },
    { name: 'Claude', group: 'AI', url: 'https://claude.ai/settings/billing', category: 'subscription', cycle: 'monthly', tone: 'peach', prices: P(20, 18, 829) },
    { name: 'Meta Verified', group: 'Social', url: 'https://accountscenter.meta.com/meta_verified', category: 'subscription', cycle: 'monthly', tone: 'sky', prices: P(14.99, 13.99, 619) },
    { name: 'X Premium', group: 'Social', url: 'https://x.com/settings/manage_subscriptions', category: 'subscription', cycle: 'monthly', tone: 'lavender', prices: P(8, 8, 339) },
    { name: 'Snapchat+', group: 'Social', url: 'https://accounts.snapchat.com', category: 'subscription', cycle: 'monthly', tone: 'yellow', prices: P(3.99, 3.99, 169) },
    { name: 'Google One', group: 'Cloud & tools', url: 'https://one.google.com/settings', category: 'subscription', cycle: 'monthly', tone: 'sky', prices: P(1.99, 1.99, 79) },
    { name: 'Adobe Creative Cloud', group: 'Cloud & tools', url: 'https://account.adobe.com/plans', category: 'subscription', cycle: 'monthly', tone: 'peach', prices: P(19.99, 11.99, 829) },
    { name: 'Gym membership', category: 'payment', cycle: 'monthly', tone: 'yellow', prices: P(40, 29, 900) },
    { name: 'Home internet', category: 'payment', cycle: 'monthly', tone: 'sky', prices: P(50, 25, 250) },
    { name: 'Car liability insurance', category: 'insurance', cycle: 'yearly', tone: 'lavender', prices: P(1200, 186, 1800) },
    { name: 'Tax return', category: 'document', cycle: 'yearly', tone: 'yellow', prices: P(0, 0, 0) },
  ];
  // Price of a template in the account's currency (US dollars by default).
  // Each service has one real list price in its own currency (base: USD, or UAH for Ukrainian services); other currencies are converted at today's rate.
  const priceOf = (t, cur) => { if (!t || !t.prices) return (t && t.amount) || 0; const b = t.base || 'USD'; return convert(t.prices[b], b, cur || 'USD'); };

  // offset = days from today to next charge / expiry
  const RAW = [
    ['netflix', 'Netflix', 'subscription', 15.49, 'monthly', 6, 'rose', { status: 'unfinished', reason: 'No access to account', follow: 3, note: 'Shared account — ask Sam for the password.' }],
    ['spotify', 'Spotify Family', 'subscription', 17.99, 'monthly', 12, 'yellow'],
    ['icloud', 'iCloud+', 'subscription', 2.99, 'monthly', 9, 'sky'],
    ['adobe', 'Adobe Creative Cloud', 'subscription', 24.19, 'monthly', 3, 'peach', { status: 'unfinished', reason: 'Need to compare prices', follow: 1, note: 'Check Affinity or the Photography plan.' }],
    ['youtube', 'YouTube Premium', 'subscription', 11.99, 'monthly', 15, 'rose'],
    ['chatgpt', 'ChatGPT Plus', 'subscription', 20, 'monthly', 22, 'sky'],
    ['internet', 'Home internet', 'payment', 14, 'monthly', 1, 'sky'],
    ['gym', 'Gym membership', 'payment', 29, 'monthly', 26, 'yellow'],
    ['taxes', 'Tax return', 'document', 0, 'yearly', 142, 'yellow', { remind: 30, note: 'Yearly filing deadline. Collect receipts and statements first.' }],
    ['licence', 'Driver’s licence', 'document', 0, 'one-time', 61, 'lavender', { remind: 30 }],
    ['car', 'Car liability insurance', 'insurance', 186, 'yearly', 19, 'lavender', { remind: 14 }],
    ['health', 'Health insurance', 'insurance', 312, 'yearly', 98, 'rose', { remind: 14 }],
    ['inspection', 'Vehicle inspection', 'household', 45, 'one-time', 40, 'peach'],
    ['filter', 'Water filter replacement', 'household', 18, 'one-time', 33, 'sky', { remind: 3 }],
  ];

  function seedReminders() {
    return RAW.map(([id, name, category, amount, cycle, offset, tone, extra = {}]) => {
      const created = off(-(30 + (offset % 20)));
      const remind = extra.remind || 7;
      const history = [{ type: 'created', date: created, text: 'Created' }];
      const r = {
        id, name, category, amount, cycle, date: off(offset), remind, channel: 'browser',
        link: (TEMPLATES.find((t) => t.name === name) || {}).url || '', note: extra.note || '', status: extra.status || 'active', reason: extra.reason || '',
        followUp: extra.follow != null ? off(extra.follow) : '', tone, history,
      };
      if (r.status === 'unfinished') {
        history.push({ type: 'reminded', date: off(offset - remind), text: `Reminder sent (${remind} days before)` });
        history.push({ type: 'postponed', date: off(offset - remind), text: `Postponed because: ${r.reason}` });
      }
      return r;
    });
  }

  // ---------- analytics (all derived from the reminder list) ----------
  const step = (d, cycle, anchorDay) => cycle === 'weekly' ? addDays(d, 7) : cycle === 'monthly' ? addMonths(d, 1, anchorDay) : cycle === 'yearly' ? addMonths(d, 12, anchorDay) : null;
  function occurrences(r, from, to) {
    const out = []; if (!r.amount || r.status === 'cancelled') return out;
    let d = parse(r.date); const anchor = d.getDate(); let guard = 0;
    while (d <= to && guard++ < 600) { if (d >= from) out.push(new Date(d)); const n = step(d, r.cycle, anchor); if (!n) break; d = n; }
    return out;
  }
  const isActive = (r) => r.status !== 'cancelled';
  // own = in the reminder's own currency; otherwise in the main currency.
  const monthlyEq = (r, own) => { if (!isActive(r)) return 0; const a = own ? Number(r.amount) || 0 : inMain(r); return r.cycle === 'weekly' ? a * 52 / 12 : r.cycle === 'monthly' ? a : r.cycle === 'yearly' ? a / 12 : 0; };
  const yearly = (r) => {
    if (!isActive(r)) return 0;
    if (r.cycle === 'one-time') { const n = daysUntil(r.date); return n >= 0 && n <= 365 ? inMain(r) : 0; }
    return monthlyEq(r) * 12;
  };
  function analytics(list) {
    const t = today();
    const month = list.reduce((s, r) => s + monthlyEq(r), 0);
    const year = list.reduce((s, r) => s + yearly(r), 0);
    const next30 = list.flatMap((r) => occurrences(r, t, addDays(t, 30)).map((d) => ({ r, d })));
    const byCat = CATEGORIES.map((c) => ({ ...c, value: list.filter((r) => r.category === c.id).reduce((s, r) => s + yearly(r), 0) }));
    const months = [];
    for (let i = 0; i < 6; i++) {
      const start = i === 0 ? t : new Date(t.getFullYear(), t.getMonth() + i, 1);
      const end = new Date(t.getFullYear(), t.getMonth() + i + 1, 0);
      const value = list.reduce((s, r) => s + occurrences(r, start, end).length * inMain(r), 0);
      months.push({ label: start.toLocaleDateString('en-GB', { month: 'short' }), long: start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), start: iso(start), value });
    }
    return { month, year, next30Count: next30.length, next30Sum: next30.reduce((s, x) => s + inMain(x.r), 0), byCat, months };
  }

  // roll recurring dates forward if the stored demo is older than today
  function rollForward(list) {
    return list.map((r) => {
      if (r.cycle === 'one-time' || r.status === 'cancelled') return r;
      let d = parse(r.date); const anchor = d.getDate(); let g = 0;
      while (d < today() && g++ < 200) d = step(d, r.cycle, anchor);
      return { ...r, date: iso(d) };
    });
  }

  window.RR = { DAY, today, iso, parse, addDays, addMonths, daysUntil, off, USER, CATEGORIES, CYCLES, REASONS, TONES, TEMPLATES, priceOf, RATES, convert, setMain, curOf, inMain, seedReminders, occurrences, analytics, monthlyEq, yearly, isActive, rollForward, SEED_STATS: { onTime: 7, total: 8 } };
})();
