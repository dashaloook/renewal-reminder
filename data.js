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

  const TEMPLATES = [
    { name: 'Netflix', url: 'https://www.netflix.com/cancelplan', category: 'subscription', amount: 15.49, cycle: 'monthly', tone: 'rose' },
    { name: 'Spotify Family', url: 'https://www.spotify.com/account/subscription/', category: 'subscription', amount: 17.99, cycle: 'monthly', tone: 'yellow' },
    { name: 'Disney+', url: 'https://www.disneyplus.com/account', category: 'subscription', amount: 9.99, cycle: 'monthly', tone: 'lavender' },
    { name: 'iCloud+', url: 'https://support.apple.com/HT207594', category: 'subscription', amount: 2.99, cycle: 'monthly', tone: 'sky' },
    { name: 'YouTube Premium', url: 'https://www.youtube.com/paid_memberships', category: 'subscription', amount: 11.99, cycle: 'monthly', tone: 'rose' },
    { name: 'ChatGPT Plus', url: 'https://help.openai.com/en/articles/7232927', category: 'subscription', amount: 20, cycle: 'monthly', tone: 'sky' },
    { name: 'Claude', url: 'https://claude.ai/settings/billing', category: 'subscription', amount: 18, cycle: 'monthly', tone: 'peach' },
    { name: 'Adobe Creative Cloud', url: 'https://account.adobe.com/plans', category: 'subscription', amount: 24.19, cycle: 'monthly', tone: 'peach' },
    { name: 'Amazon Prime', url: 'https://www.amazon.com/gp/primecentral', category: 'subscription', amount: 8.99, cycle: 'monthly', tone: 'yellow' },
    { name: 'Gym membership', category: 'payment', amount: 29, cycle: 'monthly', tone: 'yellow' },
    { name: 'Home internet', category: 'payment', amount: 14, cycle: 'monthly', tone: 'sky' },
    { name: 'Car liability insurance', category: 'insurance', amount: 186, cycle: 'yearly', tone: 'lavender' },
    { name: 'Passport', category: 'document', amount: 0, cycle: 'one-time', tone: 'yellow' },
  ];

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
    ['passport', 'Passport', 'document', 0, 'one-time', 142, 'yellow', { remind: 30 }],
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
  const monthlyEq = (r) => !isActive(r) ? 0 : r.cycle === 'weekly' ? r.amount * 52 / 12 : r.cycle === 'monthly' ? r.amount : r.cycle === 'yearly' ? r.amount / 12 : 0;
  const yearly = (r) => {
    if (!isActive(r)) return 0;
    if (r.cycle === 'one-time') { const n = daysUntil(r.date); return n >= 0 && n <= 365 ? r.amount : 0; }
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
      const value = list.reduce((s, r) => s + occurrences(r, start, end).length * r.amount, 0);
      months.push({ label: start.toLocaleDateString('en-GB', { month: 'short' }), long: start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), start: iso(start), value });
    }
    return { month, year, next30Count: next30.length, next30Sum: next30.reduce((s, x) => s + x.r.amount, 0), byCat, months };
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

  window.RR = { DAY, today, iso, parse, addDays, addMonths, daysUntil, off, USER, CATEGORIES, CYCLES, REASONS, TONES, TEMPLATES, seedReminders, occurrences, analytics, monthlyEq, yearly, isActive, rollForward, SEED_STATS: { onTime: 7, total: 8 } };
})();
