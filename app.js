/* Renewal Reminder — interactive prototype (demo data only). React 18 + htm, no build step. */
const { useState, useEffect, useRef, useMemo, useCallback } = React;
const html = htm.bind(React.createElement);
const R = window.RR;

// ---------- helpers ----------
const money = (n) => '€' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const remindTxt = (n) => (n === 0 ? 'on the day' : `${n} ${n === 1 ? 'day' : 'days'} before`);
const fmt = (s, opts = { day: 'numeric', month: 'long' }) => R.parse(s).toLocaleDateString('en-GB', opts);
const rel = (n) => n < -1 ? `${-n} days ago` : n === -1 ? 'Yesterday' : n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `In ${n} days`;
const tone = (n) => n <= 2 ? 'red' : n <= 7 ? 'amber' : 'neutral';
const cat = (id) => R.CATEGORIES.find((c) => c.id === id) || R.CATEGORIES[0];
const cyc = (id) => R.CYCLES.find((c) => c.id === id) || R.CYCLES[1];
let QS = new URLSearchParams(location.search).get('state'); // empty | loading | error (also switchable from the profile menu)
const DEMO_USER = { ...window.RR.USER };
const LS_KEY = 'renewal-reminder-demo-v1';
// Older saved demos have no links yet: fill them in from the service templates (by name) once.
const load = () => { try { const s = JSON.parse(localStorage.getItem(LS_KEY)); if (!(s && Array.isArray(s.reminders))) return null; s.reminders = s.reminders.map((r) => (r.link === undefined ? { ...r, link: (R.TEMPLATES.find((t) => t.name === r.name) || {}).url || '' } : r)); return s; } catch (e) { return null; } };
const save = (s) => { try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch (e) { /* storage unavailable: keep in memory */ } };
const freshState = () => ({ reminders: R.seedReminders(), notif: false, bannerDismissed: false, stats: { ...R.SEED_STATS }, onboarded: false, authed: false, account: 'demo', user: null, loadFail: false });
const uid = () => Math.random().toString(36).slice(2, 9);
const amountLine = (r) => r.amount ? `${money(r.amount)}${cyc(r.cycle).per ? ' / ' + cyc(r.cycle).per : ''}` : 'No cost';

// ---------- icons (Lucide paths) ----------
const P = {
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>', search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  'bell-off': '<path d="M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5"/><path d="M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .3-1.7"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/><path d="m2 2 20 20"/>',
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  list: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>', check: '<path d="M20 6 9 17l-5-5"/>', x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>', 'panel-close': '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="m16 15-3-3 3-3"/>', 'panel-open': '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="m14 9 3 3-3 3"/>', 'chevron-left': '<path d="m15 18-6-6 6-6"/>', 'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  hourglass: '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22"/><path d="M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>', 'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>', mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  reset: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  pencil: '<path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/><path d="m15 5 4 4"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  'circle-check': '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  range: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M3 10h18"/><path d="M8 2v4"/><path d="M17 14h-6"/><path d="M13 18H7"/>',
};
const Icon = ({ n, c = '', label, style }) => html`<svg class=${'icon ' + c} style=${style} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden=${label ? undefined : 'true'} role=${label ? 'img' : undefined} aria-label=${label} dangerouslySetInnerHTML=${{ __html: P[n] || '' }}></svg>`;

const Demo = () => html`<span class="demo-tag" role="note" title="Demo mode: all data is for demonstration" aria-label="Demo mode: all data is for demonstration">Demo</span>`;
const ServiceLink = ({ r }) => r.link
  ? html`<a class="link" href=${r.link} target="_blank" rel="noopener noreferrer" aria-label=${`Cancel on ${hostOf(r.link)} (opens in a new tab)`}>Cancel on ${hostOf(r.link)}<${Icon} n="external" c="xs" /></a>`
  : html`<a class="link" href=${'#/edit/' + r.id}>Add a cancel link<${Icon} n="plus" c="xs" /></a>`;
const Logo = ({ r, size = '' }) => html`<span class=${`logo ${size} tone-${r.tone || 'lavender'}`} aria-hidden="true">${(r.name || '?').trim().charAt(0).toUpperCase()}</span>`;
const UrgBadge = ({ r }) => { const n = R.daysUntil(r.date); const t = r.status === 'cancelled' ? 'neutral' : tone(n);
  return html`<span class=${'badge t-' + t}><${Icon} n=${t === 'red' ? 'alert' : 'clock'} />${r.category === 'document' && n >= 0 ? (n === 0 ? 'Expires today' : rel(n)) : rel(n)}</span>`; };
const StatusBadge = ({ r }) => {
  const m = { active: ['neutral', 'Active', null], unfinished: ['brand', 'Unfinished decision', 'hourglass'], kept: ['green', 'Kept', 'check'], cancelled: ['neutral', 'Cancelled', 'x'] }[r.status];
  return html`<span class=${'badge t-' + m[0]}>${m[2] && html`<${Icon} n=${m[2]} />`}${m[1]}</span>`;
};
const Btn = ({ v = 'primary', sm, icon, iconR, children, loading, full, ...p }) => html`<button type="button" ...${p} class=${`btn ${v} ${sm ? 'sm' : ''} ${full ? 'full' : ''} ${p.class || ''}`} disabled=${loading || p.disabled} aria-busy=${loading ? 'true' : undefined}>${loading ? html`<span class="spinner" aria-hidden="true"></span>` : icon && html`<${Icon} n=${icon} c=${sm ? 's' : ''} />`}${children}${iconR && !loading && html`<${Icon} n=${iconR} c=${sm ? 's' : ''} />`}</button>`;
const Skel = ({ w = '100%', h = 16, style = {} }) => html`<div class="skel" style=${{ width: w, height: h, ...style }} aria-hidden="true"></div>`;

// focus management + Esc for overlays
function useOverlay(onClose) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    const el = ref.current; const f = el && el.querySelector('[data-autofocus], button, input, [tabindex]'); f && f.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab' && el) { const els = [...el.querySelectorAll('button:not([disabled]), input, textarea, select, a[href], [tabindex]:not([tabindex="-1"])')]; if (!els.length) return; const first = els[0], last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }
    };
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('keydown', onKey, true); prev && prev.focus && prev.focus(); };
  }, []);
  return ref;
}
function useCompact() { const [c, setC] = useState(() => innerHeight < 860); useEffect(() => { const f = () => setC(innerHeight < 860); addEventListener('resize', f); return () => removeEventListener('resize', f); }, []); return c; }
function useLoading(key) { const [l, setL] = useState(true); useEffect(() => { setL(true); if (QS === 'loading') return; const t = setTimeout(() => setL(false), 600 + Math.random() * 300); return () => clearTimeout(t); }, [key]); return l; }

// ---------- routing ----------
const getRoute = () => (location.hash.replace(/^#\/?/, '') || '').split('/');
function useRoute() { const [r, setR] = useState(getRoute()); useEffect(() => { const f = () => { setR(getRoute()); window.scrollTo(0, 0); }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []); return r; }
// Links: accept "netflix.com/cancelplan" or a full URL; only http(s) with a real host is allowed.
const normUrl = (v) => { v = (v || '').trim(); if (!v) return ''; if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) v = 'https://' + v; try { const u = new URL(v); return (/^https?:$/.test(u.protocol) && u.hostname.includes('.')) ? u.href : null; } catch (e) { return null; } };
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
const go = (p) => { location.hash = '#/' + p; };

// =====================================================================
function App() {
  const [state, setState] = useState(() => { const s = load(); return s ? { ...s, reminders: R.rollForward(s.reminders) } : freshState(); });
  const [toast, setToast] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const [later, setLater] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [added, setAdded] = useState(null); // { id, date, phase: 'popup' | 'new' } — the reminder that was just created
  const [, bump] = useState(0);
  const route = useRoute();
  useEffect(() => { save(state); }, [state]);
  // Demo state switcher (same as ?state=loading|empty|error in the URL, but available from the profile menu)
  const setDemo = (s) => {
    QS = s || null;
    try { const u = new URL(location.href); if (s) u.searchParams.set('state', s); else u.searchParams.delete('state'); history.replaceState(null, '', u.toString()); } catch (e) { /* ok */ }
    setDrawer(null); setLater(null); setConfirm(null); bump((n) => n + 1);
  };
  useEffect(() => { if (route[0] !== 'reminders') setAdded(null); }, [route[0]]);

  Object.assign(R.USER, state.user || DEMO_USER);
  const reminders = QS === 'empty' ? [] : state.reminders;
  const view = { ...state, reminders };
  const update = (fn) => setState((s) => ({ ...s, ...fn(s) }));

  const showToast = (title, desc, undoSnapshot) => {
    const id = uid(); setToast({ id, title, desc, undo: undoSnapshot });
    setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), 6000);
  };
  const undo = () => { if (toast && toast.undo) { setState((s) => ({ ...s, ...toast.undo })); setToast(null); } };

  const decide = (id, status) => {
    const snap = { reminders: state.reminders, stats: state.stats };
    const r = state.reminders.find((x) => x.id === id);
    const onTime = R.daysUntil(r.date) >= 0;
    update((s) => ({
      reminders: s.reminders.map((x) => x.id !== id ? x : { ...x, status, reason: '', followUp: '', history: [...x.history, { type: status, date: R.iso(R.today()), text: status === 'cancelled' ? 'Decided: I cancelled it' : 'Decided: Keep it' }] }),
      stats: { onTime: s.stats.onTime + (onTime ? 1 : 0), total: s.stats.total + 1 },
    }));
    showToast(`${r.name}: ${status === 'cancelled' ? 'marked as cancelled' : 'kept'}`, 'Totals updated. You can undo for 6 seconds.', snap);
  };
  const postpone = (id, reason, note, followUp, silent) => {
    const r = state.reminders.find((x) => x.id === id);
    update((s) => ({ reminders: s.reminders.map((x) => x.id !== id ? x : { ...x, status: 'unfinished', reason, followUp, note: note || x.note, history: [...x.history, { type: 'postponed', date: R.iso(R.today()), text: `Postponed because: ${reason}` }] }) }));
    showToast(silent ? `${r.name} saved as “Decide later”` : `${r.name}: we’ll remind you on ${fmt(followUp)}`, silent ? 'It stays in Unfinished decisions so it won’t get lost.' : `Reason saved: ${reason}.`, null);
  };
  const remove = (id) => {
    const snap = { reminders: state.reminders };
    const r = state.reminders.find((x) => x.id === id);
    update((s) => ({ reminders: s.reminders.filter((x) => x.id !== id) })); setDrawer(null);
    showToast(`${r.name} reminder deleted`, 'Your subscription itself was not changed.', snap);
  };
  const upsert = (rec) => update((s) => {
    const exists = s.reminders.some((x) => x.id === rec.id);
    return { reminders: exists ? s.reminders.map((x) => (x.id === rec.id ? { ...x, ...rec, history: [...x.history, { type: 'edited', date: R.iso(R.today()), text: 'Edited' }] } : x)) : [...s.reminders, rec] };
  });
  const reset = () => { const f = freshState(); setState({ ...f, onboarded: true, authed: true }); setDrawer(null); if (QS) setDemo(null); showToast('Demo reset', 'All demo data is back to the start.', null); go('dashboard'); };
  // Sign in: the demo account (alex@example.com / "Try the demo") has sample data; any other email is a brand-new, empty account.
  // `offline@example.com` simulates a failed first load (Try again recovers).
  const signIn = (account, email) => {
    setState((s) => {
      const isNew = account === 'new';
      // Returning to the same non-demo account: keep its data and don't show onboarding again. The demo account replays it every time.
      if (s.account === account && (!isNew || (s.user && s.user.email.toLowerCase() === (email || '').toLowerCase()))) return { ...s, authed: true, onboarded: isNew ? s.onboarded : false, loadFail: /^offline@/i.test(email || '') };
      const local = (email || 'you').split('@')[0].replace(/[._-]+/g, ' ').trim() || 'you';
      const name = local.replace(/\b\w/g, (c) => c.toUpperCase());
      const user = isNew ? { name, first: name.split(' ')[0], email, initials: name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() } : null;
      // A different account always starts from its own data: demo = sample data, new = nothing at all.
      return { ...freshState(), notif: s.notif, bannerDismissed: false, account, user, authed: true, onboarded: false, loadFail: /^offline@/i.test(email || ''),
        ...(isNew ? { reminders: [], stats: { onTime: 0, total: 0 } } : {}) };
    });
    const returning = account === 'new' && state.account === 'new' && state.onboarded && state.user && state.user.email.toLowerCase() === (email || '').toLowerCase();
    go(returning ? 'dashboard' : 'onboarding');
  };
  const logout = () => { update(() => ({ authed: false })); go('login'); };

  const ctx = { state: view, update, decide, postpone, remove, upsert, openDrawer: setDrawer, openLater: setLater, showToast, reset, logout, signIn, confirm: setConfirm, added, setAdded, demo: QS, setDemo };

  // route guard
  let [page, param] = route;
  // Every fresh load of the prototype starts at log in → onboarding (demo data is kept).
  if (!page) page = 'login';
  if (['onboarding', 'dashboard', 'reminders', 'new', 'edit'].includes(page) && !state.authed) page = 'login';

  let body;
  if (page === 'onboarding') body = html`<${Onboarding} ctx=${ctx} />`;
  else if (page === 'login') body = html`<${Login} ctx=${ctx} />`;
  else body = html`<${Shell} ctx=${ctx} page=${page}>
      ${page === 'dashboard' && html`<${Dashboard} ctx=${ctx} key=${'d' + QS} />`}
      ${page === 'reminders' && html`<${ListScreen} ctx=${ctx} key=${'l' + QS} />`}
      ${(page === 'new' || page === 'edit') && html`<${CreateForm} ctx=${ctx} editId=${page === 'edit' ? param : null} key=${page + (param || '') + QS} />`}
    <//>`;

  const dr = drawer && state.reminders.find((x) => x.id === drawer);
  const lt = later && state.reminders.find((x) => x.id === later);
  const ad = added && added.phase === 'popup' && page === 'reminders' && state.reminders.find((x) => x.id === added.id);
  return html`${body}
    ${ad && html`<${AddedDialog} r=${ad} ctx=${ctx} />`}
    ${dr && html`<${Drawer} r=${dr} ctx=${ctx} onClose=${() => setDrawer(null)} />`}
    ${lt && html`<${DecideLater} r=${lt} ctx=${ctx} onClose=${() => setLater(null)} />`}
    ${confirm && html`<${Confirm} ...${confirm} onClose=${() => setConfirm(null)} />`}
    <div aria-live="polite" class="sr-only">${toast ? toast.title : ''}</div>
    ${toast && html`<div class="toast" role="status"><${Icon} n="circle-check" /><div class="grow"><div style=${{ fontWeight: 600 }}>${toast.title}</div><div class="small" style=${{ color: 'var(--accent-text)' }}>${toast.desc}</div></div>
      ${toast.undo && html`<button class="undo" onClick=${undo}><${Icon} n="undo" c="s" />Undo</button>`}
      <button class="undo" aria-label="Dismiss notification" onClick=${() => setToast(null)}><${Icon} n="x" c="s" /></button>
      ${toast.undo && html`<span class="bar"><i key=${toast.id}></i></span>`}</div>`}`;
}

// ---------- Shell ----------
const SIDE_KEY = 'rr-sidebar-collapsed';
function Shell({ ctx, page, children }) {
  const [menu, setMenu] = useState(false);
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(SIDE_KEY) === '1'; } catch (e) { return false; } });
  const toggleSide = () => setCollapsed((c) => { try { localStorage.setItem(SIDE_KEY, c ? '0' : '1'); } catch (e) { /* per-viewer convenience only */ } setMenu(false); return !c; });
  const active = page === 'dashboard' ? 'dashboard' : 'reminders';
  useEffect(() => { if (!menu) return; const k = (e) => e.key === 'Escape' && setMenu(false); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [menu]);
  const Menu = () => html`<div class="menu" role="menu" style=${{ minWidth: 200 }}>
    <button role="menuitem" onClick=${() => { setMenu(false); ctx.logout(); }}><${Icon} n="logout" c="s" />Log out</button></div>`;
  return html`<div class="app">
    <aside class=${'sidebar' + (collapsed ? ' collapsed' : '')} aria-label="Main navigation">
      <div class="side-head"><div class="brand"><span class="brand-mark"><${Icon} n="bell" c="s" /></span><span class="lbl col brand-txt"><span>Renewal Reminder</span><${Demo} /></span></div>
        <button class="side-toggle" aria-label=${collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title=${collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded=${!collapsed} aria-controls="side-nav" onClick=${toggleSide}><${Icon} n=${collapsed ? 'panel-open' : 'panel-close'} /></button></div>
      <nav class="nav" id="side-nav"><a href="#/dashboard" title=${collapsed ? 'Dashboard' : undefined} aria-current=${active === 'dashboard' ? 'page' : undefined}><${Icon} n="dashboard" /><span class="lbl">Dashboard</span></a><a href="#/reminders" title=${collapsed ? 'My reminders' : undefined} aria-current=${active === 'reminders' ? 'page' : undefined}><${Icon} n="list" /><span class="lbl">My reminders</span></a></nav>
      <div class="profile">${menu && html`<${Menu} />`}<button class="profile-btn" aria-label=${collapsed ? `${R.USER.name}, account menu` : undefined} title=${collapsed ? R.USER.name : undefined} aria-haspopup="menu" aria-expanded=${menu} onClick=${() => setMenu(!menu)}><span class="avatar">${R.USER.initials}</span><span class="grow col lbl"><b style=${{ fontWeight: 600 }}>${R.USER.name}</b><span class="small c3">${R.USER.email}</span></span><span class="lbl row"><${Icon} n="chevron-down" c="s" /></span></button></div>
    </aside>
    <main class="main" id="main">
      <div class="topbar no-desk">
        <div class="mobile-top"><div class="brand" style=${{ padding: 0 }}><span class="brand-mark" style=${{ width: 28, height: 28 }}><${Icon} n="bell" c="s" /></span>Renewal Reminder<${Demo} /></div></div>
      </div>
      <div class="content">${children}</div>
    </main>
    ${page !== 'new' && page !== 'edit' && html`<button class="fab" aria-label="Add reminder" onClick=${() => go('new')}><${Icon} n="plus" /></button>`}
    <nav class="bottom-bar" aria-label="Main navigation">
      <a href="#/dashboard" aria-current=${active === 'dashboard' && page !== 'new' ? 'page' : undefined}><${Icon} n="dashboard" />Dashboard</a>
      <a href="#/reminders" aria-current=${active === 'reminders' && page !== 'new' ? 'page' : undefined}><${Icon} n="list" />My reminders</a>
      <div style=${{ position: 'relative' }}>${menu && html`<div style=${{ position: 'absolute', bottom: 64, right: 0, width: 220 }}><${Menu} /></div>`}<button aria-haspopup="menu" aria-expanded=${menu} onClick=${() => setMenu(!menu)}><${Icon} n="user" />Profile</button></div>
    </nav>
  </div>`;
}

// Empty state (Figma S2): mascot, message, primary action, popular templates that pre-fill the form
function EmptyState({ title = 'No reminders yet' }) {
  const pop = ['Netflix', 'Spotify Family', 'iCloud+'];
  const start = (n) => { try { if (n) sessionStorage.setItem('rr-tpl', n); } catch (e) { /* ok */ } go('new'); };
  return html`<div class="card empty empty-hero"><img class="mascot-empty" src="duck-empty.png" width="160" height="160" alt="" /><h2 class="h2">${title}</h2><p class="c2" style=${{ maxWidth: 440, margin: 0 }}>Add a subscription, payment, document or insurance. We’ll remind you before it renews and help you decide.</p><${Btn} icon="plus" onClick=${() => start()}>Add your first reminder<//>
    <div class="row wrap" style=${{ justifyContent: 'center', gap: 8 }} role="group" aria-label="Popular services"><span class="small c3">Popular:</span>${pop.map((n) => html`<button type="button" class="chip" onClick=${() => start(n)}>${n}</button>`)}</div></div>`;
}

// ---------- Onboarding (v2: 3 steps, skippable) ----------
const ONB_SERVICES = ['Netflix', 'Spotify Family', 'ChatGPT Plus', 'iCloud+'];
function Onboarding({ ctx }) {
  const [step, setStep] = useState(1);
  const [reason, setReason] = useState('No access to account'); const [posted, setPosted] = useState(false);
  const [sel, setSel] = useState(ctx.state.account === 'new' ? [] : ['Netflix', 'Spotify Family', 'ChatGPT Plus']);
  const [why, setWhy] = useState(false); const [other, setOther] = useState(false); const [busy, setBusy] = useState(false);
  const services = ONB_SERVICES.map((n) => R.TEMPLATES.find((t) => t.name === n));
  const chosen = services.filter((s) => sel.includes(s.name)); const monthly = chosen.reduce((a, s) => a + s.amount, 0);
  const leave = () => { ctx.update(() => ({ onboarded: true })); go('dashboard'); };
  const finish = () => {
    if (!chosen.length) { leave(); return; }
    setBusy(true);
    setTimeout(() => {
      const have = ctx.state.reminders.map((r) => r.name);
      const fresh = chosen.filter((s) => !have.includes(s.name));
      ctx.update((s) => ({ onboarded: true, reminders: [...s.reminders, ...fresh.map((t, i) => ({ id: 'ob-' + uid(), name: t.name, category: t.category, amount: t.amount, cycle: t.cycle, date: R.off(5 + i * 4), remind: 7, channel: 'browser', note: '', status: 'active', reason: '', followUp: '', tone: t.tone, history: [{ type: 'created', date: R.iso(R.today()), text: 'Added during setup' }] }))] }));
      ctx.showToast(fresh.length ? `${fresh.length} service${fresh.length > 1 ? 's' : ''} added to your list` : 'Your services are already in the list', fresh.length ? 'Check the charge dates in My reminders — prices and dates are estimates.' : 'Demo data already includes them.', null);
      go('dashboard');
    }, 600);
  };
  const headRef = useRef(null);
  useEffect(() => { headRef.current && headRef.current.focus(); }, [step]);
  const bar = html`<div class="onb-prog" role="progressbar" aria-valuemin="1" aria-valuemax="3" aria-valuenow=${step} aria-label=${`Step ${step} of 3`}><span class="small c3">${step} / 3</span><span class="segs" aria-hidden="true">${[1, 2, 3].map((i) => html`<i class=${i <= step ? 'on' : ''}></i>`)}</span></div>`;
  const timeline = [['Today', 'Netflix renews in 7 days. We let you know.', 'bell', 'brand'], ['Tomorrow', 'Not now? Postpone with a reason.', 'hourglass', 'amber'], ['In 5 days', 'We remind you, with your note.', 'reset', 'brand'], ['In 7 days · charge date', 'You’ve decided. No surprise.', 'circle-check', 'green']];
  return html`<div class="onb">
    <div class="onb-top"><div class="brand" style=${{ padding: 0 }}><span class="brand-mark"><${Icon} n="bell" c="s" /></span>Renewal Reminder<${Demo} /></div><${Btn} v="ghost" sm onClick=${leave}>${step === 3 ? 'I’ll add later' : 'Skip'}<//></div>
    <section class="onb-card wide" aria-labelledby="onb-h">
      ${bar}
      <div class="onb-cols">
        <div class="col gap16 onb-copy">
          ${step === 1 && html`<h1 class="h1 big" id="onb-h" tabindex="-1" ref=${headRef}>Decide before you’re charged.</h1><p class="body-l c2" style=${{ margin: 0 }}>We warn you a week early, and keep your decision open if you need more time.</p>`}
          ${step === 2 && html`<h1 class="h1 big" id="onb-h" tabindex="-1" ref=${headRef}>Can’t decide now?<br />Postpone it.</h1><p class="body-l c2" style=${{ margin: 0 }}>Say why and when. We hold it for you and remind you before the charge date.</p>`}
          ${step === 3 && html`<h1 class="h1 big" id="onb-h" tabindex="-1" ref=${headRef}>Which of these<br />do you pay for?</h1><p class="body-l c2" style=${{ margin: 0 }}>Pick your services. We’ll total them and add them to your list.</p>
            <p class="row c2" style=${{ margin: 0, alignItems: 'flex-start' }}><${Icon} n="shield" c="s" style=${{ color: 'var(--success)', marginTop: 2 }} /><span>We never connect to your bank. You decide what to add, and only that is stored. <button type="button" class="link" aria-expanded=${why} onClick=${() => setWhy(!why)}>How we use your data</button></span></p>
            ${why && html`<div class="small c2" role="note" style=${{ padding: '10px 12px', background: 'var(--subtle)', borderRadius: 8 }}>We store only the reminders you create: name, amount, date and your notes. No bank access, no email scanning, no selling data. In this prototype everything stays in your browser.</div>`}`}
        </div>
        <div class="onb-panel">
          ${step === 1 && html`<div class="card pad24 col gap16" style=${{ boxShadow: 'var(--shadow-s)' }}>
            <div class="row gap12"><span class="logo tone-rose">N</span><b class="h3 grow">Netflix · €15.49</b><span class="badge t-neutral">Example</span></div>
            <ol class="tl" aria-label="How a renewal goes with Renewal Reminder">${timeline.map(([d, t, ic, tn]) => html`<li><span class=${'dot t-' + tn}><${Icon} n=${ic} c="s" /></span><div><b>${d}</b><div class="c2">${t}</div></div></li>`)}</ol></div>`}
          ${step === 2 && html`<div class="col gap16">
            <div class="card pad24 col gap16" style=${{ boxShadow: 'var(--shadow-s)', border: '2px solid var(--brand-subtle)' }}>
              <div class="row"><b class="h3 grow" id="why-l">Why are you postponing?</b><span class="badge t-brand">Try it</span></div>
              <div class="row wrap" role="radiogroup" aria-labelledby="why-l">${R.REASONS.map((x) => html`<button type="button" class="chip" role="radio" aria-checked=${reason === x} onClick=${() => { setReason(x); setPosted(false); }}>${reason === x && html`<${Icon} n="check" c="s" />`}${x}</button>`)}</div>
              <div class="row" style=${{ padding: '10px 12px', background: 'var(--subtle)', borderRadius: 8, flexWrap: 'wrap' }}><${Icon} n="clock" c="s cb" /><span class="grow">Remind me tomorrow, 9:00</span><span class="badge t-amber"><${Icon} n="lock" />Latest: day before charge</span></div>
              <${Btn} icon="hourglass" full disabled=${posted} onClick=${() => setPosted(true)}>${posted ? 'Postponed' : 'Postpone'}<//>
            </div>
            <div class="small c3 row" style=${{ justifyContent: 'center' }}><${Icon} n="chevron-down" c="s" />Then it waits here</div>
            <div class="card pad20 col gap12" aria-live="polite" style=${{ border: posted ? '2px solid var(--brand-subtle)' : '1px dashed var(--border)', opacity: posted ? 1 : .6, background: posted ? 'var(--surface)' : 'transparent' }}>
              <div class="row cb"><${Icon} n="hourglass" c="s" /><b style=${{ color: 'var(--text)' }}>Unfinished decisions</b></div>
              ${posted ? html`<div class="row gap12"><span class="logo sm tone-rose">N</span><div class="col"><b>Netflix · €15.49</b><span class="small c3">${reason} · reminder tomorrow, 9:00</span></div></div>` : html`<span class="small c3">Press “Postpone” to see Netflix land here.</span>`}
            </div></div>`}
          ${step === 3 && html`<div class="card pad24 col gap16" style=${{ boxShadow: 'var(--shadow-s)' }}>
            <div class="row"><b class="h3 grow" id="svc-l">Your services</b><span class="small c3" aria-live="polite">${sel.length} selected</span></div>
            <div class="row wrap" role="group" aria-labelledby="svc-l">${services.map((s) => { const on = sel.includes(s.name); return html`<button type="button" class="chip" aria-pressed=${on} onClick=${() => setSel(on ? sel.filter((x) => x !== s.name) : [...sel, s.name])}>${on && html`<${Icon} n="check" c="s" />`}${s.name} · ${money(s.amount)}</button>`; })}
              <button type="button" class="chip dashed" aria-expanded=${other} onClick=${() => setOther(!other)}><${Icon} n="plus" c="xs" />Other service</button></div>
            ${other && html`<span class="msg hint" role="status"><${Icon} n="info" c="xs" />Any other service can be added in “My reminders” after setup.</span>`}
            <span class="small c3">Prices are estimates. You can edit them later.</span>
            <div class="totals" aria-live="polite"><div><div class="c2">Per month</div><div class="v">${money(monthly)}</div></div><div style=${{ background: 'var(--brand-subtle)' }}><div class="c2">Per year</div><div class="v cb">${money(monthly * 12)}</div></div></div>
            <div class="c2" aria-live="polite">${sel.length ? `≈ ${money(monthly * 12)} a year across ${sel.length} service${sel.length > 1 ? 's' : ''}` : 'Tap a service above to see what it costs you per year.'}</div></div>`}
        </div>
      </div>
      <div class="row onb-footer" style=${{ justifyContent: 'space-between' }}>
        ${step > 1 ? html`<${Btn} v="ghost" icon="chevron-left" onClick=${() => setStep(step - 1)}>Back<//>` : html`<span></span>`}
        ${step < 3 ? html`<${Btn} iconR="arrow-right" onClick=${() => setStep(step + 1)}>Next<//>` : html`<${Btn} iconR="arrow-right" loading=${busy} onClick=${finish}>${sel.length ? `Add ${sel.length} service${sel.length > 1 ? 's' : ''}` : 'Continue without adding'}<//>`}
      </div>
    </section>
  </div>`;
}

// ---------- Login ----------
function Login({ ctx }) {
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [show, setShow] = useState(false);
  const [err, setErr] = useState({}); const [loading, setLoading] = useState(null); const [forgot, setForgot] = useState(false);
  const enter = (which) => { setLoading(which); setTimeout(() => (which === 'google' ? ctx.signIn('new', 'olena.shevchenko@gmail.com') : ctx.signIn('demo')), 800); };
  const submit = (e) => {
    e.preventDefault(); const er = {};
    if (!email.trim()) er.email = 'Enter your email so we can find your reminders.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) er.email = 'This doesn’t look like an email yet. Try the format name@example.com.';
    if (!pw) er.pw = 'Enter your password. In this demo any password works.';
    setErr(er); if (Object.keys(er).length) { document.getElementById(er.email ? 'email' : 'pw').focus(); return; }
    setLoading('login'); setTimeout(() => {
      if (pw === 'wrong') { setLoading(null); setErr({ pw: 'That password doesn’t match. Check Caps Lock and try again, or use “Forgot password?”. Your email is kept.' }); document.getElementById('pw').focus(); return; }
      ctx.signIn(email.trim().toLowerCase() === 'alex@example.com' || /^offline@/i.test(email.trim()) ? 'demo' : 'new', email.trim());
    }, 800);
  };
  return html`<div class="login">
    <div class="login-form">
      <div class="row" style=${{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}><div class="brand" style=${{ padding: 0 }}><span class="brand-mark"><${Icon} n="bell" c="s" /></span>Renewal Reminder<${Demo} /></div></div>
      <form onSubmit=${submit} noValidate aria-labelledby="login-h">
        <h1 class="h1" id="login-h" style=${{ textAlign: 'center' }}>Log in</h1>
        <${Btn} full iconR="arrow-right" loading=${loading === 'demo'} onClick=${() => enter('demo')}>Try the demo without signing up<//>
        <div class="divider">or log in with email</div>
        <div class="field"><label for="email">Email</label><input id="email" class=${'input' + (err.email ? ' err' : '')} type="email" autocomplete="email" value=${email} onInput=${(e) => setEmail(e.target.value)} aria-invalid=${!!err.email} aria-describedby=${err.email ? 'email-err' : undefined} placeholder="alex@example.com" />
          ${err.email && html`<span class="msg err" id="email-err"><${Icon} n="info" c="xs" />${err.email}</span>`}</div>
        <div class="field"><div class="row" style=${{ justifyContent: 'space-between' }}><label for="pw">Password</label><button type="button" class="link" onClick=${() => setForgot(true)}>Forgot password?</button></div>
          <div class="input-wrap"><input id="pw" class=${'input' + (err.pw ? ' err' : '')} type=${show ? 'text' : 'password'} autocomplete="current-password" value=${pw} onInput=${(e) => setPw(e.target.value)} aria-invalid=${!!err.pw} aria-describedby=${err.pw ? 'pw-err' : undefined} />
            <button type="button" class="btn ghost sm trail" aria-pressed=${show} onClick=${() => setShow(!show)}><${Icon} n="eye" c="s" />${show ? 'Hide' : 'Show'}</button></div>
          ${err.pw ? html`<span class="msg err" id="pw-err"><${Icon} n="info" c="xs" />${err.pw}</span>` : null}
          ${forgot && html`<span class="msg hint" role="status"><${Icon} n="info" c="xs" />In the real app we’d email you a reset link. Here, any password works.</span>`}</div>
        <button type="submit" class="btn secondary full" disabled=${!!loading} aria-busy=${loading === 'login'}>${loading === 'login' ? html`<span class="spinner"></span>Logging in…` : 'Log in'}</button>
        <${Btn} v="secondary" full loading=${loading === 'google'} onClick=${() => enter('google')}><span aria-hidden="true" style=${{ fontWeight: 700 }}>G</span> Continue with Google<//>
      </form>
    </div>
    <aside class="login-side" aria-label="Why Renewal Reminder">
      <img class="mascot" src="duck-wave.png" width="240" height="240" alt="" />
      <div class="card pad24 col gap12" style=${{ width: '100%', boxShadow: 'var(--shadow-m)', border: 0 }}>
        <div class="row" style=${{ justifyContent: 'space-between' }}><span class="small c3">${R.today().toLocaleDateString('en-GB', { month: 'long' })} so far</span><span class="badge t-brand">Demo data</span></div>
        <div class="row gap12"><span class="logo" style=${{ background: 'var(--success-subtle)', color: 'var(--success)' }}><${Icon} n="circle-check" /></span><b class="h3">No unwanted charges this month</b></div>
        <p class="c2" style=${{ margin: 0 }}>7 of 8 renewals were decided before the charge date. Every “keep” and “cancel” was a choice, not an accident.</p>
      </div>
    </aside>
  </div>`;
}

// ---------- Dashboard ----------
function Dashboard({ ctx }) {
  const { state } = ctx; const loading = useLoading('dash');
  const [chartErr, setChartErr] = useState((QS === 'error' || ctx.state.loadFail || !navigator.onLine)); const [retrying, setRetrying] = useState(false);
  const list = state.reminders;
  const a = useMemo(() => R.analytics(list), [list]);
  const unfinished = list.filter((r) => r.status === 'unfinished').sort((x, y) => x.date.localeCompare(y.date));
  const upcoming = list.filter((r) => r.status !== 'cancelled' && R.daysUntil(r.date) >= 0).sort((x, y) => x.date.localeCompare(y.date));
  const next = upcoming[0];
  const hour = new Date().getHours(); const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const dateStr = R.today().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  if (loading) return html`<div class="col gap16" aria-busy="true"><div class="row c2"><span class="spinner"></span>Loading your reminders…</div><${Skel} w="320px" h=${32} /><div class="hero"><${Skel} w="220px" h=${24} /><div class="ucards">${[0, 1].map(() => html`<div class="ucard"><${Skel} w="60%" /><${Skel} h=${48} /><${Skel} w="70%" h=${32} /></div>`)}</div></div><div class="kpis">${[0, 1, 2, 3].map(() => html`<div class="card kpi"><${Skel} w="50%" h=${12} /><${Skel} w="70%" h=${28} style=${{ marginTop: 8 }} /></div>`)}</div></div>`;
  if (!list.length) return html`<div class="col gap4"><h1 class="h1">Welcome, ${R.USER.first}</h1><p class="body-l c2" style=${{ margin: 0 }}>Let’s add the first thing you don’t want to renew by accident.</p></div><${EmptyState} />`;
  return html`
    <div class="page-head"><div class="col gap4"><h1 class="h1">${greet}, ${R.USER.first}</h1><p class="body-l c2" style=${{ margin: 0 }}>${dateStr} · ${unfinished.length ? `${unfinished.length} decision${unfinished.length > 1 ? 's are' : ' is'} waiting for you` : 'nothing is waiting for you'}</p></div><${Btn} sm icon="plus" class="ph-add" onClick=${() => go('new')}>Add reminder<//></div>
    ${!state.notif && !state.bannerDismissed && html`<div class="banner" role="region" aria-label="Notifications are off"><span class="ic"><${Icon} n="bell-off" /></span><div class="grow"><b>Turn on notifications so you don’t miss a renewal</b><div class="c2">Browser notifications are off. We only notify you about reminders you set.</div></div>
      <${Btn} sm onClick=${() => { ctx.update(() => ({ notif: true })); ctx.showToast('Notifications are on', 'Simulated in this demo — no real notifications are sent.', null); }}>Turn on<//><${Btn} v="ghost" sm onClick=${() => ctx.update(() => ({ bannerDismissed: true }))}>Dismiss<//></div>`}
    <section class="hero" aria-labelledby="ud-h">
      <div class="row gap12"><h2 class="h2" id="ud-h">Unfinished decisions</h2>${unfinished.length > 0 && html`<span class="badge t-brand"><${Icon} n="hourglass" />${unfinished.length} waiting</span>`}<span class="grow"></span><a class="link" href="#/reminders?f=unfinished" onClick=${(e) => { e.preventDefault(); sessionStorage.setItem('rr-filter', 'unfinished'); go('reminders'); }}>View all</a></div>
      ${unfinished.length ? html`<p class="c2" style=${{ margin: 0 }}>You postponed these. They’ll keep coming back until you decide — no pressure, just no surprises.</p>
        <div class="ucards">${unfinished.map((r) => html`<${UnfinishedCard} r=${r} ctx=${ctx} key=${r.id} />`)}</div>`
        : html`<div class="row gap16" style=${{ padding: 20, background: 'var(--success-subtle)', borderRadius: 12 }}><${Icon} n="circle-check" c="" style=${{ color: 'var(--success)' }} /><div><b>All decided.${next ? ` Next renewal ${R.daysUntil(next.date) === 0 ? 'today' : R.daysUntil(next.date) === 1 ? 'tomorrow' : `in ${R.daysUntil(next.date)} days`}.` : ''}</b><div class="c2">Nothing is waiting for you. We’ll bring the next one here when it’s due.</div></div></div>`}
    </section>
    <section class="kpis" aria-label="Key numbers">
      ${[['This month', money(a.month), 'Monthly equivalent of active items'], ['Per year (projection)', money(a.year), 'Incl. one-time costs in the next 12 months'], ['Next 30 days', `${a.next30Count} charge${a.next30Count === 1 ? '' : 's'}`, `${money(a.next30Sum)} in total`], ['Decided on time', state.stats.total ? `${state.stats.onTime} of ${state.stats.total}` : '—', state.stats.total ? 'Decisions made before the charge date' : 'Fills in after your first decision']].map(([l, v, c]) => html`<div class="card kpi"><div class="c2">${l}</div><div class="v">${v}</div><div class="small c3">${c}</div></div>`)}
    </section>
    <section class="charts">
      <div class="card pad24 col gap16"><div><h2 class="h3">Spend by category</h2><span class="small c3">Projected per year</span></div><${CatBars} data=${a.byCat} /></div>
      <div class="card pad24 col gap16"><div><h2 class="h3">Charges over the next 6 months</h2><span class="small c3">Total per month, from today</span></div>
        ${chartErr ? html`<div class="empty" style=${{ background: 'var(--subtle)', borderRadius: 12, padding: 32 }}><span class="ic t-amber"><${Icon} n="alert" /></span><b>We couldn’t load this chart</b><span class="c2">Your reminders are safe. Check your connection and try again.</span><${Btn} v="secondary" sm icon="refresh" loading=${retrying} onClick=${() => { setRetrying(true); setTimeout(() => { setRetrying(false); if (navigator.onLine) { QS = QS === 'error' ? null : QS; ctx.update(() => ({ loadFail: false })); setChartErr(false); } }, 700); }}>Try again<//></div>` : html`<${MonthBars} data=${a.months} />`}
      </div>
    </section>
    <section class="card list-card" aria-labelledby="up-h"><div class="row" style=${{ justifyContent: 'space-between', padding: 20 }}><h2 class="h2" id="up-h">Upcoming</h2><a class="link" href="#/reminders">See all reminders</a></div>
      ${upcoming.slice(0, 5).map((r) => html`<${Row} r=${r} ctx=${ctx} key=${r.id} />`)}</section>`;
}
function UnfinishedCard({ r, ctx }) {
  const n = R.daysUntil(r.date);
  return html`<article class="ucard" aria-label=${r.name}>
    <div class="row gap12"><${Logo} r=${r} /><div class="grow"><b class="h3" style=${{ display: 'block' }}>${r.name}</b><span class="c2">${amountLine(r)} · renews ${fmt(r.date)}</span></div><${UrgBadge} r=${r} /></div>
    <div class="reason"><span class="cb"><${Icon} n="hourglass" /></span><div class="grow"><div style=${{ fontWeight: 500 }}>Postponed: ${r.reason || 'Not decided yet'}</div><div class="small c3">${r.followUp ? `We’ll remind you again ${R.daysUntil(r.followUp) === 1 ? 'tomorrow, ' : 'on '}${fmt(r.followUp)}` : 'No follow-up set yet'}${r.note ? ` · “${r.note}”` : ''}</div></div></div>
    <div class="row wrap"><${Btn} v="secondary" sm onClick=${() => ctx.openDrawer(r.id)}>Open<//><${Btn} v="secondary" sm onClick=${() => ctx.decide(r.id, 'cancelled')}>I cancelled it<//><${Btn} sm onClick=${() => ctx.decide(r.id, 'kept')}>Keep it<//></div>
    <${ServiceLink} r=${r} />
  </article>`;
}
function CatBars({ data }) {
  const max = Math.max(...data.map((d) => d.value), 1); const total = data.reduce((s, d) => s + d.value, 0); const top = [...data].sort((a, b) => b.value - a.value)[0];
  const desc = data.map((d) => `${d.label} ${d.value ? money(d.value) : 'no cost'}`).join(', ');
  return html`<div class="col gap12" role="img" aria-label=${`Bar chart, spend per year by category: ${desc}.`}>
    ${data.map((d) => html`<div class="row gap12" key=${d.id}><span class="c2" style=${{ width: 100 }}>${d.label}</span><svg class="grow" height="12" aria-hidden="true"><rect width="100%" height="12" rx="6" fill="var(--subtle)" /><rect width=${`${Math.max(d.value / max * 100, d.value ? 2 : 1.5)}%`} height="12" rx="6" fill=${d.value ? 'var(--brand)' : 'var(--muted)'} /></svg><b style=${{ width: 84, textAlign: 'right' }}>${d.value ? money(d.value) : 'No cost'}</b></div>`)}
    <span class="small c3">${total ? `${top.label} are the biggest share: ${Math.round(top.value / total * 100)}% of your yearly total.` : 'No costs yet.'}</span></div>`;
}
function MonthBars({ data }) {
  const max = Math.max(...data.map((d) => d.value), 1); const W = 420, H = 190, bw = 40, gap = (W - bw * data.length) / (data.length - 1);
  const peak = [...data].sort((a, b) => b.value - a.value).slice(0, 2).map((d) => d.long.split(' ')[0]);
  return html`<div><svg viewBox=${`0 0 ${W} ${H}`} width="100%" role="img" aria-label=${'Bar chart, charges per month: ' + data.map((d) => `${d.long} ${money(d.value)}`).join(', ')}>
    ${data.map((d, i) => { const h = Math.max(d.value / max * 130, 3); const x = i * (bw + gap); const isPeak = peak.includes(d.long.split(' ')[0]);
      return html`<g key=${i}><text x=${x + bw / 2} y=${H - 26 - h - 6} text-anchor="middle" font-size="11" fill="var(--text)">${money(d.value)}</text><rect x=${x} y=${H - 26 - h} width=${bw} height=${h} rx="6" fill=${isPeak ? 'var(--brand)' : 'var(--lavender)'} /><text x=${x + bw / 2} y=${H - 8} text-anchor="middle" font-size="12" fill="var(--text-2)">${d.label}</text></g>`; })}
  </svg><span class="small c3">Peaks in ${peak.join(' and ')}.</span>
  <table class="sr-only"><caption>Charges per month</caption><tbody>${data.map((d) => html`<tr><th>${d.long}</th><td>${money(d.value)}</td></tr>`)}</tbody></table></div>`;
}
function Row({ r, ctx, isNew }) {
  return html`<button class=${'rrow' + (isNew ? ' is-new' : '')} onClick=${() => ctx.openDrawer(r.id)} aria-label=${`${isNew ? 'New reminder, ' : ''}${r.name}, ${amountLine(r)}, ${fmt(r.date)}, ${rel(R.daysUntil(r.date))}, ${r.status === 'unfinished' ? 'unfinished decision: ' + r.reason : r.status}`}>
    <${Logo} r=${r} /><span class="nm grow col" style=${{ gap: 2 }}><b class="h3" style=${{ fontSize: 16 }}>${r.name}</b><span class="c2">${cat(r.category).one}</span>${r.status === 'unfinished' && html`<span class="small cb row gap4"><${Icon} n="hourglass" c="xs" />Postponed: ${r.reason}</span>`}${(isNew || r.status === 'kept' || r.status === 'cancelled') && html`<span class="st-inline">${isNew ? html`<span class="badge t-brand">New</span>` : html`<${StatusBadge} r=${r} />`}</span>`}</span>
    <span class="amt"><b class="h3" style=${{ fontSize: 16, display: 'block' }}>${r.amount ? money(r.amount) : '—'}</b><span class="small c3">${r.category === 'document' ? 'Expires' : cyc(r.cycle).label}</span><span class="mob-badge"><${UrgBadge} r=${r} /></span></span>
    <span class="when"><span class="date">${fmt(r.date)}</span><${UrgBadge} r=${r} /></span><span class="st">${isNew ? html`<span class="badge t-brand">New</span>` : html`<${StatusBadge} r=${r} />`}</span><span class="chev c3"><${Icon} n="chevron-right" /></span>
  </button>`;
}

// ---------- Drawer ----------
function Drawer({ r, ctx, onClose }) {
  const ref = useOverlay(onClose); const n = R.daysUntil(r.date);
  const [mail, setMail] = useState({ s: 'idle', msg: '' });
  const sendTest = async () => {
    setMail({ s: 'sending', msg: '' });
    try { await window.RRApi.sendReminder(r); setMail({ s: 'sent', msg: 'Sent. Check your inbox (and spam).' }); ctx.showToast(`Test email sent for ${r.name}`, 'It went to the address set on the server.', null); }
    catch (e) { setMail({ s: 'error', msg: e.message }); }
  };
  return html`<div class="scrim" onClick=${onClose}></div>
  <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="dr-h" ref=${ref}>
    <div class="row gap12" style=${{ padding: 24, borderBottom: '1px solid var(--muted)' }}><${Logo} r=${r} size="lg" /><div class="grow"><h2 class="h2" id="dr-h">${r.name}</h2><span class="c2">${cat(r.category).one} · ${cyc(r.cycle).label}</span></div><button class="icon-btn" aria-label="Close details" onClick=${onClose} data-autofocus><${Icon} n="x" c="s" /></button></div>
    <div class="drawer-body">
      <div class="row wrap"><${UrgBadge} r=${r} /><${StatusBadge} r=${r} /></div>
      ${r.status === 'unfinished' && html`<div class="reason"><span class="cb"><${Icon} n="hourglass" /></span><div><b>Postponed because: ${r.reason}</b><div class="small c2">${r.followUp ? `Follow-up on ${fmt(r.followUp)}.` : ''}${r.note ? ` Your note: “${r.note}”` : ''}</div></div></div>`}
      ${r.status !== 'cancelled' ? html`<div class="col gap12"><b>What did you decide?</b>
        <div class="row"><${Btn} icon="check" full onClick=${() => { ctx.decide(r.id, 'kept'); onClose(); }}>Keep it<//><${Btn} v="secondary" icon="x" full onClick=${() => { ctx.decide(r.id, 'cancelled'); onClose(); }}>I cancelled it<//></div>
        <${Btn} v="ghost" icon="hourglass" full onClick=${() => { onClose(); ctx.openLater(r.id); }}>Decide later<//>
        <${ServiceLink} r=${r} />
        <span class="small c3">${r.link ? `Opens ${hostOf(r.link)} in a new tab. ` : ''}Renewal Reminder never cancels anything for you — you do it on the service, then tell us here.</span></div>`
      : html`<div class="reason"><${Icon} n="x" /><div><b>You cancelled this.</b><div class="small c2">It no longer counts in your totals.</div></div></div>`}
      <dl class="card facts" style=${{ margin: 0 }}>
        <div><dt>Amount</dt><dd>${amountLine(r)}</dd></div>${r.amount > 0 && r.cycle !== 'one-time' && html`<div><dt>Per year</dt><dd>${money(R.monthlyEq({ ...r, status: 'active' }) * 12)}</dd></div>`}
        <div><dt>${r.category === 'document' ? 'Expires' : 'Next charge'}</dt><dd>${fmt(r.date, { day: 'numeric', month: 'long', year: 'numeric' })} (${rel(n).toLowerCase()})</dd></div>
        <div><dt>Remind me</dt><dd>${remindTxt(r.remind)} · ${r.channel === 'email' ? 'Email' : 'Browser'}</dd></div>
        <div><dt>Note</dt><dd>${r.note || '—'}</dd></div></dl>
      ${r.status !== 'cancelled' && html`<div class="col" style=${{ gap: 8 }}><b>Email reminder</b>
        <span class="small c2">Send yourself the email you’d get before ${r.name} renews.</span>
        <div><${Btn} v="secondary" sm icon="mail" loading=${mail.s === 'sending'} onClick=${sendTest}>${mail.s === 'sending' ? 'Sending…' : 'Send test email'}<//></div>
        <span aria-live="polite">${mail.s === 'sent' ? html`<span class="msg ok"><${Icon} n="circle-check" c="xs" />${mail.msg}</span>` : mail.s === 'error' ? html`<span class="msg err" role="alert"><${Icon} n="info" c="xs" />${mail.msg}</span>` : ''}</span></div>`}
      <div class="col gap12"><b>History</b>${[...r.history].reverse().map((h) => html`<div class="row gap12"><span class="logo sm" style=${{ background: 'var(--subtle)', color: 'var(--text-2)' }}><${Icon} n=${{ created: 'plus', reminded: 'bell', postponed: 'hourglass', cancelled: 'x', kept: 'check', edited: 'pencil' }[h.type] || 'info'} c="xs" /></span><div><div>${h.text}</div><div class="small c3">${fmt(h.date)}</div></div></div>`)}</div>
    </div>
    <div class="row" style=${{ padding: 24, borderTop: '1px solid var(--muted)', justifyContent: 'space-between' }}>
      <${Btn} v="secondary" sm icon="pencil" onClick=${() => { onClose(); go('edit/' + r.id); }}>Edit<//>
      <${Btn} v="ghost" sm icon="trash" onClick=${() => ctx.confirm({ title: `Delete the ${r.name} reminder?`, body: `This removes the reminder, its note and history from Renewal Reminder. It doesn’t cancel your ${r.name} subscription.`, tip: 'Stopped paying? Use “I cancelled it” instead — it keeps the history.', ok: 'Delete reminder', danger: true, onOk: () => ctx.remove(r.id) })}>Delete<//>
    </div>
  </aside>`;
}


// ---------- "Added" popup over the calendar (after Save reminder) ----------
function AddedDialog({ r, ctx }) {
  const toList = () => ctx.setAdded({ ...ctx.added, phase: 'new' });
  const another = () => { ctx.setAdded(null); go('new'); };
  const ref = useOverlay(toList);
  const rd = R.iso(R.addDays(R.parse(r.date), -r.remind)); const remindOn = R.daysUntil(rd) < 0 ? R.iso(R.today()) : rd;
  const total = R.analytics(ctx.state.reminders).month;
  return html`<div class="scrim" onClick=${toList}></div>
  <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="ad-h" ref=${ref} style=${{ width: 520, alignItems: 'center', textAlign: 'center' }}>
    <span class="logo lg" style=${{ background: 'var(--success-subtle)', color: 'var(--success)' }}><${Icon} n="circle-check" /></span>
    <h2 class="h2" id="ad-h">Added. We’ll remind you on ${fmt(remindOn)}</h2>
    <div class="row gap12" style=${{ padding: 16, background: 'var(--subtle)', borderRadius: 12, width: '100%', textAlign: 'left' }}><${Logo} r=${r} /><div><b>${r.name} · ${amountLine(r)}</b><div class="small c3">${r.category === 'document' ? 'Expires' : 'Renews'} ${fmt(r.date)} · reminder ${remindTxt(r.remind)}, ${r.channel === 'email' ? 'by email' : 'in the browser'}</div></div></div>
    <p class="c2" style=${{ margin: 0 }}>It’s already on your dashboard and in your list.${total ? ` Your monthly total is now ${money(total)}.` : ''}</p>
    <div class="row wrap" style=${{ justifyContent: 'center' }}><${Btn} v="secondary" icon="plus" onClick=${another}>Add another<//><${Btn} iconR="arrow-right" data-autofocus onClick=${toList}>Go to my list<//></div>
  </div>`;
}

// ---------- Decide later ----------
function DecideLater({ r, ctx, onClose }) {
  // If the charge is today or already past, the deadline becomes the next renewal (recurring) or none (one-time).
  const n0 = R.daysUntil(r.date); const passed = n0 < 1;
  const nextCharge = (() => {
    if (!passed) return r.date;
    if (r.cycle === 'one-time') return null;
    let d = R.parse(r.date); const a = d.getDate(); let g = 0;
    while (R.daysUntil(R.iso(d)) < 1 && g++ < 400) d = r.cycle === 'weekly' ? R.addDays(d, 7) : R.addMonths(d, r.cycle === 'yearly' ? 12 : 1, a);
    return R.iso(d);
  })();
  const charge = nextCharge || R.iso(R.addDays(R.today(), 30)); const n = R.daysUntil(charge);
  const [reason, setReason] = useState(r.reason || ''); const [note, setNote] = useState(r.note || '');
  const opts = [['Tomorrow', 1], ['In 3 days', 3], ...(nextCharge ? [[passed ? 'The day before the next charge' : 'The day before the charge', n - 1]] : []), ['Next week', 7]].map(([l, d]) => ({ l, d, date: R.iso(R.addDays(R.today(), d)), ok: d >= 1 && d <= n }));
  const [pick, setPick] = useState((opts.find((o) => o.ok) || {}).date || ''); const [custom, setCustom] = useState(''); const [why, setWhy] = useState(''); const [err, setErr] = useState('');
  const saved = useRef(false);
  const close = () => { if (!saved.current) { const fu = R.iso(R.addDays(R.today(), Math.max(0, Math.min(1, n)))); ctx.postpone(r.id, reason || r.reason || 'Not decided yet', note, r.followUp || fu, true); } onClose(); };
  const ref = useOverlay(close);
  const submit = () => {
    const fu = custom || pick; if (!fu) { setWhy('Choose when we should remind you.'); return; }
    if (R.daysUntil(fu) > n) { setWhy(`Pick a date on or before ${fmt(charge)} — after that, ${r.name} renews before you decide.`); return; }
    saved.current = true; ctx.postpone(r.id, reason || 'Not decided yet', note, fu); onClose();
  };
  return html`<div class="scrim" onClick=${close}></div>
  <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dl-h" ref=${ref}>
    <div class="row gap12"><div class="grow"><h2 class="h2" id="dl-h">Decide later</h2><span class="c2">${r.name} · ${r.amount ? money(r.amount) + ' · ' : ''}renews ${fmt(r.date)} (${rel(n0).toLowerCase()})</span>${passed && html`<span class="msg warn" style=${{ display: 'flex', marginTop: 6 }}><${Icon} n="info" c="xs" />${n0 === 0 ? 'This charge is today' : 'This charge date has passed'}, so it may already have gone through. ${nextCharge ? `Pick a reminder before the next one on ${fmt(nextCharge)}.` : 'Pick when to remind you.'}</span>`}</div><button class="icon-btn" aria-label="Close. The item stays in Unfinished decisions." onClick=${close}><${Icon} n="x" c="s" /></button></div>
    <div class="col gap12" role="radiogroup" aria-labelledby="dl-r"><b id="dl-r">What’s stopping you right now? <span class="c3" style=${{ fontWeight: 400 }}>(optional)</span></b><div class="row wrap">${R.REASONS.map((x) => html`<button class="chip" role="radio" aria-checked=${reason === x} data-autofocus=${x === R.REASONS[0] ? true : undefined} onClick=${() => { setReason(x); setErr(''); }}>${reason === x && html`<${Icon} n="check" c="s" />`}${x}</button>`)}</div>
      ${err && html`<span class="msg err"><${Icon} n="info" c="xs" />${err}</span>`}
      <label class="sr-only" for="dl-note">Note</label><input id="dl-note" class="input" placeholder=${reason === 'Other' ? 'What’s stopping you? (optional)' : 'Note for future you, e.g. “Ask Sam for the password” (optional)'} value=${note} onInput=${(e) => setNote(e.target.value)} /></div>
    <div class="col" style=${{ gap: 8 }} role="radiogroup" aria-labelledby="dl-f"><b id="dl-f">Remind me again</b>
      ${opts.map((o) => html`<button class="radio" role="radio" aria-checked=${!custom && pick === o.date && o.ok} aria-disabled=${!o.ok} onClick=${() => { if (!o.ok) { setWhy(o.d < 1 ? 'That’s today — pick a later time.' : `Not later than ${fmt(charge)}: after that, ${r.name} renews before you decide.`); return; } setPick(o.date); setCustom(''); setWhy(''); }}>
        <span class="dot"></span><span class="grow"><span style=${{ display: 'block', fontWeight: 500 }}>${o.l}</span><span class="small c3">${o.d >= 1 ? fmt(o.date) + ', 9:00' : 'Not available'}${!o.ok && o.d >= 1 ? ' — after the charge' : ''}</span></span>${!o.ok && html`<${Icon} n="lock" c="s" />`}</button>`)}
      <div class="row gap12"><label for="dl-date" class="c2" style=${{ whiteSpace: 'nowrap' }}>Or pick a date</label><${DateField} id="dl-date" height=${40} min=${R.iso(R.addDays(R.today(), 1))} max=${charge} value=${custom} placeholder="Choose a date" onChange=${(v) => { setCustom(v); setWhy(v && R.daysUntil(v) > n ? `Pick a date on or before ${fmt(charge)} — after that, ${r.name} renews before you decide.` : ''); }} /></div>
      ${why && html`<span class="msg warn" role="alert"><${Icon} n="info" c="xs" />${why}</span>`}</div>
    <div class="col gap12"><span class="small c3">Closing keeps ${r.name} in Unfinished decisions.</span><div class="row" style=${{ justifyContent: 'flex-end' }}><${Btn} v="ghost" onClick=${close}>Close<//><${Btn} icon="clock" onClick=${submit}>Save and remind me<//></div></div>
  </div>`;
}
function Confirm({ title, body, tip, ok, danger, onOk, onClose }) {
  const ref = useOverlay(onClose);
  return html`<div class="scrim" style=${{ zIndex: 58 }} onClick=${onClose}></div><div class="dialog" style=${{ width: 480, zIndex: 61 }} role="alertdialog" aria-modal="true" aria-labelledby="cf-h" aria-describedby="cf-b" ref=${ref}>
    <h2 class="h2" id="cf-h">${title}</h2><p class="c2" id="cf-b" style=${{ margin: 0 }}>${body}</p>${tip && html`<div class="row small c2" style=${{ padding: '8px 12px', background: 'var(--subtle)', borderRadius: 8 }}><${Icon} n="info" c="s" />${tip}</div>`}
    <div class="row" style=${{ justifyContent: 'flex-end' }}><${Btn} v="secondary" data-autofocus onClick=${onClose}>${danger ? 'Keep reminder' : 'Cancel'}<//><${Btn} v=${danger ? 'danger' : 'primary'} icon=${danger ? 'trash' : undefined} onClick=${() => { onOk(); onClose(); }}>${ok}<//></div></div>`;
}

// ---------- Create / edit ----------
// ---------- DateField: custom date picker in the app's style (replaces the native <input type="date">) ----------
const WEEK_S = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
function DateField({ id, value, onChange, min, max, className = '', height, describedBy, invalid, placeholder = 'Select a date' }) {
  const [open, setOpen] = useState(false); const [up, setUp] = useState(false);
  const base = value ? R.parse(value) : R.today();
  const [month, setMonth] = useState(new Date(base.getFullYear(), base.getMonth(), 1));
  const [focus, setFocus] = useState(value || R.iso(R.today()));
  const wrap = useRef(null); const gridRef = useRef(null);
  const todayIso = R.iso(R.today());
  const ok = (iso) => (!min || iso >= min) && (!max || iso <= max);
  const openIt = () => {
    const b = value ? R.parse(value) : R.today(); setMonth(new Date(b.getFullYear(), b.getMonth(), 1)); setFocus(value || (ok(todayIso) ? todayIso : (min || max || todayIso)));
    try { const r = wrap.current.getBoundingClientRect(); setUp(window.innerHeight - r.bottom < 380 && r.top > 380); } catch (e) { /* ok */ }
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return;
    const out = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', out); return () => document.removeEventListener('mousedown', out);
  }, [open]);
  useEffect(() => { if (open && gridRef.current) { const el = gridRef.current.querySelector(`[data-d="${focus}"]`); if (el) el.focus({ preventScroll: true }); } }, [open, focus, month]);
  const first = new Date(month.getFullYear(), month.getMonth(), 1); const lead = (first.getDay() + 6) % 7;
  const start = R.addDays(first, -lead);
  const cells = [...Array(42)].map((_, i) => R.addDays(start, i));
  const pick = (iso) => { if (!ok(iso)) return; onChange(iso); setOpen(false); setTimeout(() => { const t = document.getElementById(id); if (t) t.focus(); }, 0); };
  const go2 = (iso) => { const d = R.parse(iso); setFocus(iso); if (d.getMonth() !== month.getMonth() || d.getFullYear() !== month.getFullYear()) setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); };
  const onKey = (e) => {
    const d = R.parse(focus); let n = null;
    if (e.key === 'ArrowLeft') n = R.addDays(d, -1); else if (e.key === 'ArrowRight') n = R.addDays(d, 1); else if (e.key === 'ArrowUp') n = R.addDays(d, -7); else if (e.key === 'ArrowDown') n = R.addDays(d, 7);
    else if (e.key === 'PageUp') n = R.addMonths(d, -1); else if (e.key === 'PageDown') n = R.addMonths(d, 1);
    else if (e.key === 'Home') n = R.addDays(d, -((d.getDay() + 6) % 7)); else if (e.key === 'End') n = R.addDays(d, 6 - ((d.getDay() + 6) % 7));
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); const t = document.getElementById(id); if (t) t.focus(); return; }
    else if (e.key === 'Tab') { setOpen(false); return; }
    if (n) { e.preventDefault(); go2(R.iso(n)); }
  };
  const shift = (k) => setMonth(new Date(month.getFullYear(), month.getMonth() + k, 1));
  const label = month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  return html`<div class="datefield" ref=${wrap}>
    <button type="button" id=${id} class=${'input datebtn ' + className + (open ? ' open' : '')} style=${height ? { height } : undefined} aria-haspopup="dialog" aria-expanded=${open} aria-invalid=${invalid ? 'true' : undefined} aria-describedby=${describedBy} onClick=${() => (open ? setOpen(false) : openIt())} onKeyDown=${(e) => { if ((e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') && !open) { e.preventDefault(); openIt(); } }}>
      <span class=${'grow' + (value ? '' : ' c3')}>${value ? fmt(value, { day: 'numeric', month: 'long', year: 'numeric' }) : placeholder}</span><${Icon} n="calendar" c="s" /></button>
    ${open && html`<div class=${'dp' + (up ? ' up' : '')} role="dialog" aria-label=${'Choose a date, ' + label} onKeyDown=${onKey}>
      <div class="dp-head"><button type="button" class="icon-btn" aria-label="Previous month" onClick=${() => shift(-1)}><${Icon} n="chevron-left" /></button><b class="dp-title" aria-live="polite">${label}</b><button type="button" class="icon-btn" aria-label="Next month" onClick=${() => shift(1)}><${Icon} n="chevron-right" /></button></div>
      <div class="dp-grid" role="grid" aria-label=${label} ref=${gridRef}>
        ${WEEK_S.map((w) => html`<span class="dp-wd" aria-hidden="true" key=${w}>${w}</span>`)}
        ${cells.map((d) => { const iso = R.iso(d); const out = d.getMonth() !== month.getMonth(); const dis = !ok(iso);
          return html`<button type="button" key=${iso} data-d=${iso} role="gridcell" class=${'dp-day' + (out ? ' out' : '') + (iso === value ? ' sel' : '') + (iso === todayIso ? ' today' : '')} disabled=${dis} tabindex=${iso === focus ? 0 : -1} aria-selected=${iso === value} aria-current=${iso === todayIso ? 'date' : undefined} aria-label=${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + (iso === todayIso ? ', today' : '')} onClick=${() => pick(iso)}>${d.getDate()}</button>`; })}
      </div>
      <div class="dp-foot"><button type="button" class="link" disabled=${!ok(todayIso)} onClick=${() => pick(todayIso)}>Today</button><span class="small c3">Arrow keys · Esc closes</span></div>
    </div>`}
  </div>`;
}

function CreateForm({ ctx, editId }) {
  const editing = editId && ctx.state.reminders.find((r) => r.id === editId);
  const blank = { name: '', category: 'subscription', amount: '', cycle: 'monthly', date: '', remind: 7, channel: 'browser', note: '', link: '', tone: 'lavender' };
  const [f, setF] = useState(editing ? { ...editing, amount: editing.amount ? String(editing.amount) : '' } : blank);
  const [dirty, setDirty] = useState(false); const [errors, setErrors] = useState({}); const [saving, setSaving] = useState(false); const [done, setDone] = useState(null);
  const [q, setQ] = useState(''); const [open, setOpen] = useState(false); const [hi, setHi] = useState(0); const [tpl, setTpl] = useState(null);
  const loading = useLoading('form');
  const REMIND_OPTS = [1, 3, 7, 14, 30];
  const [pref, setPref] = useState(editing ? editing.remind : 7); // the lead time the person actually asked for
  const leadDays = (date) => (date ? R.daysUntil(date) : null);
  // A reminder can't fire in the past: only offer lead times that fit before the charge, and fall back to the largest that fits.
  const fitRemind = (p, date) => { const l = leadDays(date); if (l === null) return p; if (l < 1) return 0; const ok = REMIND_OPTS.filter((o) => o <= Math.min(p, l)); return ok.length ? ok[ok.length - 1] : 1; };
  const set = (k, v) => {
    setF((x) => (k === 'date' ? { ...x, date: v, remind: fitRemind(pref, v) } : { ...x, [k]: v })); setDirty(true); if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const rank = (n, k) => { n = n.toLowerCase(); if (n.startsWith(k)) return 0; if (n.split(/[\s+]+/).some((w) => w.startsWith(k))) return 1; return n.includes(k) ? 2 : 9; };
  const results = q.trim() ? R.TEMPLATES.map((t) => [t, rank(t.name, q.trim().toLowerCase())]).filter(([, r]) => r < 9).sort((a, b) => a[1] - b[1]).map(([t]) => t) : R.TEMPLATES.filter((t) => t.category === 'subscription').slice(0, 8);
  useEffect(() => { try { const n = loading ? null : sessionStorage.getItem('rr-tpl'); if (n && !editId) { sessionStorage.removeItem('rr-tpl'); const t = R.TEMPLATES.find((x) => x.name === n); if (t) applyTpl(t); } } catch (e) { /* ok */ } }, [loading]);
  const applyTpl = (t) => { setF((x) => ({ ...x, link: t.url || x.link || '', name: t.name, category: t.category, amount: t.amount ? String(t.amount) : '', cycle: t.cycle, tone: t.tone })); setTpl(t.name); setQ(''); setOpen(false); setDirty(true); setErrors({}); setTimeout(() => { const el = document.getElementById(f.date ? 'f-amount' : 'f-date'); if (el) el.focus(); }, 0); };
  const manual = () => { setF((x) => ({ ...blank, name: q.trim() })); setTpl(null); setOpen(false); setQ(''); setTimeout(() => document.getElementById('f-name').focus(), 0); };
  const cancel = useCallback(() => { const leave = () => go(editing ? 'reminders' : 'dashboard'); if (dirty && !done) ctx.confirm({ title: 'Discard this reminder?', body: 'You’ve started filling it in. If you leave now, these changes won’t be saved.', ok: 'Discard', onOk: leave }); else leave(); }, [dirty, done]);
  useEffect(() => { const h = () => cancel(); addEventListener('rr-cancel', h); return () => removeEventListener('rr-cancel', h); }, [cancel]);
  const amountNum = parseFloat(String(f.amount).replace(',', '.'));
  const amountBad = f.category !== 'document' && f.amount !== '' && (!/^\s*\d+([.,]\d{1,2})?\s*$/.test(String(f.amount)));
  const past = f.date && R.daysUntil(f.date) < 0;
  const remindDate = f.date ? R.iso(R.addDays(R.parse(f.date), -f.remind)) : '';
  const submit = (e) => {
    e && e.preventDefault(); const er = {};
    if (!f.name.trim()) er.name = 'Add a name so you know what this is, e.g. “Disney+”.';
    if (!f.date) er.date = 'Add the next charge or expiry date — we remind you before it.';
    if (amountBad) er.amount = 'Use numbers only, like 9.99.';
    const linkOk = normUrl(f.link); if (linkOk === null) er.link = 'This doesn’t look like a web address. Try netflix.com/cancelplan or paste the full link.';
    setErrors(er); if (Object.keys(er).length) { document.getElementById(er.name ? 'f-name' : er.amount ? 'f-amount' : er.date ? 'f-date' : 'f-link').focus(); return; }
    setSaving(true);
    setTimeout(() => {
      const rec = { ...f, link: normUrl(f.link) || '', id: editing ? editing.id : uid(), name: f.name.trim(), amount: f.category === 'document' ? 0 : (isNaN(amountNum) ? 0 : amountNum), cycle: f.category === 'document' ? 'one-time' : f.cycle,
        status: editing ? editing.status : 'active', reason: editing ? editing.reason : '', followUp: editing ? editing.followUp : '', history: editing ? editing.history : [{ type: 'created', date: R.iso(R.today()), text: 'Created' }] };
      ctx.upsert(rec); setSaving(false); setDirty(false);
      if (editing) { try { sessionStorage.setItem('rr-focus', rec.date); } catch (e) { /* ok */ } ctx.showToast(`${rec.name} saved`, 'Your changes are on the dashboard and in your list.', null); go('reminders'); }
      else { ctx.setAdded({ id: rec.id, date: rec.date, phase: 'popup' }); go('reminders'); }
    }, 800);
  };
  if (loading) return html`<div class="col gap16" aria-busy="true"><${Skel} w="280px" h=${32} /><div class="form-layout"><div class="card pad24 col gap16">${[0, 1, 2, 3, 4].map(() => html`<${Skel} h=${48} />`)}</div><div class="card pad24"><${Skel} h=${120} /></div></div></div>`;
  if (done) {
    const rd = R.iso(R.addDays(R.parse(done.date), -done.remind));
    return html`<div class="card col gap16" style=${{ maxWidth: 560, margin: '40px auto', padding: 40, alignItems: 'center', textAlign: 'center', boxShadow: 'var(--shadow-m)', border: 0 }} role="status">
      <span class="logo lg" style=${{ background: 'var(--success-subtle)', color: 'var(--success)' }}><${Icon} n="circle-check" /></span>
      <h1 class="h2">${editing ? 'Saved.' : 'Added.'} We’ll remind you on ${fmt(R.daysUntil(rd) < 0 ? R.iso(R.today()) : rd)}</h1>
      <div class="row gap12" style=${{ padding: 16, background: 'var(--subtle)', borderRadius: 12, width: '100%', textAlign: 'left' }}><${Logo} r=${done} /><div><b>${done.name} · ${amountLine(done)}</b><div class="small c3">${done.category === 'document' ? 'Expires' : 'Renews'} ${fmt(done.date)} · reminder ${remindTxt(done.remind)}, ${done.channel === 'email' ? 'by email' : 'in the browser'}</div></div></div>
      <p class="c2" style=${{ margin: 0 }}>It’s already on your dashboard and in your list.</p>
      <div class="row wrap" style=${{ justifyContent: 'center' }}><${Btn} v="secondary" icon="plus" onClick=${() => { setDone(null); setF(blank); setTpl(null); go('new'); }}>Add another<//><${Btn} iconR="arrow-right" data-autofocus onClick=${() => { try { sessionStorage.setItem('rr-focus', done.date); } catch (e) { /* ok */ } go('reminders'); }}>Go to my list<//></div></div>`;
  }
  const isDoc = f.category === 'document';
  return html`<div class="col gap4"><span class="small c3">My reminders › ${editing ? 'Edit' : 'New'}</span><div class="page-head"><h1 class="h1">${editing ? `Edit ${editing.name}` : 'Add a reminder'}</h1><${Btn} v="ghost" sm icon="x" class="ph-add" onClick=${cancel}>Cancel<//></div><p class="body-l c2" style=${{ margin: 0 }}>Pick a service to prefill, or enter it yourself. Takes about 30 seconds.</p></div>
  <form class="form-layout" onSubmit=${submit} noValidate>
    <div class="card col gap24" style=${{ padding: 32, borderRadius: 16 }}>
      ${!editing && html`<div class="col gap12"><h2 class="h3">Quick start</h2>
        <div style=${{ position: 'relative' }}><label for="tpl" class="sr-only">Search service templates</label>
          <div class="input-wrap"><input id="tpl" class="input" style=${{ paddingLeft: 44 }} role="combobox" aria-expanded=${open} aria-controls="tpl-list" aria-autocomplete="list" autocomplete="off" placeholder="Search services, e.g. Netflix, Spotify, iCloud" value=${q}
            onInput=${(e) => { setQ(e.target.value); setOpen(true); setHi(0); }} onFocus=${() => setOpen(true)} onClick=${() => setOpen(true)} onBlur=${() => setTimeout(() => setOpen(false), 150)}
            onKeyDown=${(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi(Math.min(hi + 1, results.length)); } else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(Math.max(hi - 1, 0)); } else if (e.key === 'Enter') { e.preventDefault(); hi < results.length ? applyTpl(results[hi]) : manual(); } else if (e.key === 'Escape') { setOpen(false); } }} />
            <span style=${{ position: 'absolute', left: 14, top: 14 }} class="c3"><${Icon} n="search" /></span></div>
          ${open && html`<div class="listbox" id="tpl-list" role="listbox" aria-label=${q.trim() ? 'Matching services' : 'Popular subscriptions'}><div class="lb-h" aria-hidden="true">${q.trim() ? (results.length ? 'Results' : 'No matching service') : 'Popular subscriptions'}</div>${results.map((t, i) => html`<div class="option" role="option" aria-selected=${i === hi} onMouseDown=${(e) => { e.preventDefault(); applyTpl(t); }}><${Logo} r=${t} size="sm" /><span class="grow"><b>${q.trim() && t.name.toLowerCase().startsWith(q.trim().toLowerCase()) ? html`<span class="hl">${t.name.slice(0, q.trim().length)}</span>${t.name.slice(q.trim().length)}` : t.name}</b><span class="small c3" style=${{ display: 'block' }}>${cat(t.category).one}${t.amount ? ` · ${money(t.amount)} / ${cyc(t.cycle).per}` : ''}</span></span></div>`)}
            <div class="option" role="option" aria-selected=${hi === results.length} onMouseDown=${(e) => { e.preventDefault(); manual(); }}><span class="logo sm" style=${{ background: 'var(--subtle)' }}><${Icon} n="pencil" c="xs" /></span><b>${q.trim() ? `Enter “${q.trim()}” manually` : 'Enter manually'}</b></div></div>`}
        </div>
        <div class="row wrap">${R.TEMPLATES.slice(0, 6).map((t) => html`<button type="button" class="chip" aria-pressed=${tpl === t.name} onClick=${() => applyTpl(t)}>${tpl === t.name && html`<${Icon} n="check" c="s" />`}${t.name}</button>`)}<button type="button" class="chip dashed" onClick=${manual}><${Icon} n="pencil" c="xs" />Enter manually</button></div>
        ${tpl && html`<div class="row small" style=${{ padding: '8px 12px', background: 'var(--brand-subtle)', color: 'var(--brand)', borderRadius: 8 }}><${Icon} n="info" c="s" />Prefilled from the ${tpl} template. Check the amount — prices vary by plan.</div>`}
        ${ctx.state.reminders.some((r) => tpl && r.name === tpl && r.status !== 'cancelled') && html`<span class="msg warn"><${Icon} n="info" c="xs" />You already track ${tpl}. You can still add it again, e.g. for a second account.</span>`}
        <hr style=${{ border: 0, borderTop: '1px solid var(--muted)', margin: 0 }} /></div>`}
      <div class="grid2">
        <div class="field"><label for="f-name">Name <span aria-hidden="true">*</span></label><input id="f-name" class=${'input' + (errors.name ? ' err' : '')} value=${f.name} required aria-invalid=${!!errors.name} aria-describedby=${errors.name ? 'e-name' : undefined} onInput=${(e) => set('name', e.target.value)} />${errors.name && html`<span class="msg err" id="e-name"><${Icon} n="info" c="xs" />${errors.name}</span>`}</div>
        <div class="field"><label for="f-cat">Category</label><select id="f-cat" class="input" value=${f.category} onChange=${(e) => set('category', e.target.value)}>${R.CATEGORIES.map((c) => html`<option value=${c.id}>${c.one}</option>`)}</select></div>
      </div>
      ${!isDoc && html`<div class="field"><label for="f-amount">Amount</label><div class="input-wrap"><span style=${{ position: 'absolute', left: 16, top: 13 }} class="c2 body-l">€</span><input id="f-amount" inputmode="decimal" class=${'input' + (errors.amount || amountBad ? ' err' : '')} style=${{ paddingLeft: 32 }} placeholder="0.00" value=${f.amount} aria-invalid=${!!(errors.amount || amountBad)} aria-describedby="e-amount" onInput=${(e) => set('amount', e.target.value)} /></div>
        ${errors.amount || amountBad ? html`<span class="msg err" id="e-amount"><${Icon} n="info" c="xs" />Use numbers only, like 9.99.</span>` : html`<span class="msg hint" id="e-amount">Optional. Hidden for documents.</span>`}</div>
      <div class="field"><span class="flabel" id="cy-l">Billing cycle</span><div class="seg" role="radiogroup" aria-labelledby="cy-l">${R.CYCLES.map((c) => html`<button type="button" role="radio" aria-checked=${f.cycle === c.id} onClick=${() => set('cycle', c.id)}>${c.label}</button>`)}</div></div>`}
      <div class="field"><label for="f-date">${isDoc ? 'Expiry date' : 'Next charge date'} <span aria-hidden="true">*</span></label><${DateField} id="f-date" className=${errors.date ? 'err' : past ? 'warn' : ''} value=${f.date} invalid=${!!errors.date} describedBy="e-date" onChange=${(v) => set('date', v)} />
        ${errors.date ? html`<span class="msg err" id="e-date"><${Icon} n="info" c="xs" />${errors.date}</span>` : past ? html`<span class="msg warn" id="e-date"><${Icon} n="alert" c="xs" />This date is in the past. You can still save — just check it’s right.</span>` : null}</div>
      <div class="field"><span class="flabel" id="rm-l">Remind me (days before)</span><div class="row wrap" role="radiogroup" aria-labelledby="rm-l">${((leadDays(f.date) !== null && leadDays(f.date) < 1) ? [0, ...REMIND_OPTS] : REMIND_OPTS).map((d) => { const lead = leadDays(f.date); const off = d > 0 && lead !== null && lead < d; return html`<button type="button" class="chip" role="radio" aria-checked=${f.remind === d} disabled=${off} title=${off ? `Your charge is ${lead < 1 ? 'today or past' : 'in ' + lead + (lead === 1 ? ' day' : ' days')} — too late for ${d} days before` : undefined} onClick=${() => { if (d === 0) return; setPref(d); set('remind', d); }}>${f.remind === d && html`<${Icon} n="check" c="s" />`}${d === 0 ? 'On the day' : `${d} ${d === 1 ? 'day' : 'days'}`}</button>`; })}</div>
        ${(() => { const lead = leadDays(f.date);
          if (lead !== null && lead < 1) return html`<span class="msg hint"><${Icon} n="info" c="xs" />${lead === 0 ? 'The charge is today' : 'This date has passed'} — we’ll remind you today.</span>`;
          if (lead !== null && f.remind < pref) return html`<span class="msg hint"><${Icon} n="info" c="xs" />Your charge is in ${lead} ${lead === 1 ? 'day' : 'days'}, so we’ll remind you ${f.remind} ${f.remind === 1 ? 'day' : 'days'} before. Pick a later date to get ${pref} days.</span>`;
          if (lead !== null && lead < 7) return html`<span class="msg hint"><${Icon} n="info" c="xs" />Charge is soon — ${f.remind} ${f.remind === 1 ? 'day' : 'days'} before is the longest lead time that fits.</span>`;
          return html`<span class="msg hint"><${Icon} n="info" c="xs" />7 days recommended: enough time to regain access or compare prices.</span>`; })()}</div>
      <div class="field"><span class="flabel" id="ch-l">Channel</span><div class="seg" role="radiogroup" aria-labelledby="ch-l">${[['browser', 'Browser'], ['email', 'Email']].map(([id, l]) => html`<button type="button" role="radio" aria-checked=${f.channel === id} onClick=${() => set('channel', id)}>${l}</button>`)}</div></div>
      <div class="field"><label for="f-link">Link to cancel or manage (optional)</label><input id="f-link" class=${'input' + (errors.link ? ' err' : '')} inputmode="url" autocomplete="off" placeholder="e.g. netflix.com/cancelplan" value=${f.link || ''} aria-invalid=${!!errors.link} aria-describedby="e-link" onInput=${(e) => set('link', e.target.value)} />
        ${errors.link ? html`<span class="msg err" id="e-link"><${Icon} n="info" c="xs" />${errors.link}</span>` : html`<span class="msg hint" id="e-link"><${Icon} n="info" c="xs" />${f.link && normUrl(f.link) ? `We’ll show “Cancel on ${hostOf(normUrl(f.link))}” on this reminder. We never cancel for you.` : 'Paste the page where you cancel or manage it. We’ll show it as a shortcut when you decide.'}</span>`}</div>
      <div class="field"><label for="f-note">Note (optional)</label><textarea id="f-note" class="input" placeholder="e.g. Family plan, shared with Sam" value=${f.note} onInput=${(e) => set('note', e.target.value)}></textarea></div>
      <div class="row" style=${{ justifyContent: 'flex-end' }}><${Btn} v="ghost" onClick=${cancel}>Cancel<//><button type="submit" class="btn primary" disabled=${saving} aria-busy=${saving}>${saving ? html`<span class="spinner"></span>Saving…` : html`<${Icon} n="check" />${editing ? 'Save changes' : 'Save reminder'}`}</button></div>
    </div>
    <aside class="preview" aria-label="Preview">
      <div class="card pad24 col gap16" style=${{ border: '2px solid var(--brand-subtle)', borderRadius: 16 }} aria-live="polite">
        <span class="row small cb"><${Icon} n="eye" c="s" />Preview · updates as you type</span>
        <div class="row gap12"><${Logo} r=${{ ...f, name: f.name || '?' }} /><div><b class="h3">${f.name || 'Your reminder'}</b><div class="small c3">${cat(f.category).one}${isDoc ? '' : ' · ' + cyc(f.cycle).label}</div></div></div>
        <p class="body-l" style=${{ margin: 0 }}>${f.name && f.date ? (isDoc ? `${f.name} expires on ${fmt(f.date)}. ` : `${f.name} renews on ${fmt(f.date)}${f.amount && !amountBad ? `, ${money(amountNum)}` : ''}. `) + `We’ll remind you on ${fmt(remindDate)}.` : 'Add a name and date to see your reminder here.'}</p>
        ${f.date && html`<div class="col gap12">${[['circle-check', 'Reminder set', 'Today'], ['bell', `We remind you (${f.channel === 'email' ? 'email' : 'browser'})`, fmt(remindDate)], ['calendar', `${f.name || 'It'} ${isDoc ? 'expires' : 'renews'}${f.amount && !isDoc && !amountBad ? ' · ' + money(amountNum) : ''}`, fmt(f.date)]].map(([ic, l, d]) => html`<div class="row gap12"><span class="cb"><${Icon} n=${ic} c="s" /></span><div><div>${l}</div><div class="small c3">${d}</div></div></div>`)}</div>`}
      </div>
      ${!ctx.state.notif && html`<div class="card pad20 col gap12"><b class="row"><span class="cb"><${Icon} n="bell" c="s" /></span>Remind you ${remindTxt(f.remind)}${f.name ? ` ${f.name} renews` : ''}?</b><span class="small c2">Browser notifications are off. You can still save without them — we’ll show it on your dashboard.</span>
        <div class="row"><${Btn} v="secondary" sm onClick=${() => { ctx.update(() => ({ notif: true })); ctx.showToast('Notifications are on', 'Simulated in this demo.', null); }}>Allow notifications<//><${Btn} v="ghost" sm onClick=${() => ctx.update(() => ({ bannerDismissed: true, notif: false }))}>Not now<//></div></div>`}
    </aside>
  </form>`;
}

// ---------- All reminders ----------
// ---------- My reminders: month calendar with day details below ----------
// One-time items, documents and cancelled items appear once on their date; recurring ones on every charge.
const occOf = (r, from, to) => {
  if (r.status === 'cancelled' || !r.amount || r.cycle === 'one-time') { const d = R.parse(r.date); return d >= from && d <= to ? [d] : []; }
  return R.occurrences(r, from, to);
};
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const monthName = (d) => d.toLocaleDateString('en-GB', { month: 'long' });
const firstOf = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const take = (k) => { try { const v = sessionStorage.getItem(k); sessionStorage.removeItem(k); return v; } catch (e) { return null; } };

function ListScreen({ ctx }) {
  const loading = useLoading('list'); const compact = useCompact(); const maxChips = compact ? 1 : 2;
  const [init] = useState(() => ({ filter: take('rr-filter'), focus: take('rr-focus') }));
  const todayIso = R.iso(R.today());
  const [q, setQ] = useState(''); const [catF, setCatF] = useState('all'); const [status, setStatus] = useState(init.filter || 'all'); const [sort, setSort] = useState('date'); const [view, setView] = useState('calendar');
  // Default selection: the focused item's date, else the next day that has something due (so details aren't empty), else today.
  const [sel, setSel] = useState(() => {
    if (init.focus) return init.focus;
    const t = R.today(); const end = new Date(t.getFullYear(), t.getMonth() + 1, 0);
    const first = ctx.state.reminders.filter((r) => r.status !== 'cancelled' && (init.filter !== 'unfinished' || r.status === 'unfinished')).flatMap((r) => occOf(r, t, end)).sort((x, y) => x - y)[0];
    return first ? R.iso(first) : todayIso;
  });
  const [month, setMonth] = useState(() => firstOf(R.parse(init.focus || todayIso)));
  const [err, setErr] = useState((QS === 'error' || ctx.state.loadFail || !navigator.onLine)); const [retry, setRetry] = useState(false);
  const all = ctx.state.reminders;
  const counts = { unfinished: all.filter((r) => r.status === 'unfinished').length, next30: all.filter((r) => r.status !== 'cancelled' && R.daysUntil(r.date) >= 0 && R.daysUntil(r.date) <= 30).length, cancelled: all.filter((r) => r.status === 'cancelled').length };
  let items = all.filter((r) => (catF === 'all' || r.category === catF) && (!q.trim() || (r.name + ' ' + r.note).toLowerCase().includes(q.trim().toLowerCase())) &&
    (status === 'all' || (status === 'unfinished' && r.status === 'unfinished') || (status === 'cancelled' && r.status === 'cancelled') || (status === 'next30' && r.status !== 'cancelled' && R.daysUntil(r.date) >= 0 && R.daysUntil(r.date) <= 30)));
  items = [...items].sort((a, b) => sort === 'amount' ? b.amount - a.amount : sort === 'name' ? a.name.localeCompare(b.name) : a.date.localeCompare(b.date));
  const groups = sort !== 'date' ? [['All results', items]] : [['This week', items.filter((r) => R.daysUntil(r.date) <= 7)], ['This month', items.filter((r) => R.daysUntil(r.date) > 7 && R.daysUntil(r.date) <= 30)], ['Later', items.filter((r) => R.daysUntil(r.date) > 30)]].filter((g) => g[1].length);
  const resetF = () => { setQ(''); setCatF('all'); setStatus('all'); };

  // calendar maths
  const mEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const lead = (month.getDay() + 6) % 7; const gStart = R.addDays(month, -lead);
  const weeks = Math.ceil((lead + mEnd.getDate()) / 7); const gEnd = R.addDays(gStart, weeks * 7 - 1);
  const occ = items.flatMap((r) => occOf(r, gStart, gEnd).map((d) => ({ r, iso: R.iso(d) })));
  const byDay = {}; occ.forEach((o) => { (byDay[o.iso] = byDay[o.iso] || []).push(o); });
  const mKey = R.iso(month).slice(0, 7);
  const inMonth = occ.filter((o) => o.iso.slice(0, 7) === mKey).sort((a, b) => a.iso.localeCompare(b.iso) || a.r.name.localeCompare(b.r.name));
  const live = (list) => list.filter((o) => o.r.status !== 'cancelled'); // cancelled items stay visible but aren't "due"
  const monthDue = live(inMonth); const monthSum = monthDue.reduce((s, o) => s + o.r.amount, 0);
  const dayItems = byDay[sel] || []; const rest = inMonth.filter((o) => o.iso !== sel);
  const nextAfter = (iso) => { const from = R.addDays(R.parse(iso), 1); const to = R.addMonths(from, 13); return items.flatMap((r) => occOf(r, from, to).map((d) => ({ r, iso: R.iso(d) }))).sort((a, b) => a.iso.localeCompare(b.iso))[0]; };
  const focusDay = (iso) => setTimeout(() => { const el = document.querySelector(`[data-day="${iso}"]`); if (el) el.focus(); }, 0);
  const pick = (iso, focus) => { const d = R.parse(iso); setSel(iso); if (R.iso(firstOf(d)) !== R.iso(month)) setMonth(firstOf(d)); if (focus) focusDay(iso); };
  const shiftMonth = (n, focus) => { const m = new Date(month.getFullYear(), month.getMonth() + n, 1); const iso = R.iso(m).slice(0, 7) === todayIso.slice(0, 7) ? todayIso : R.iso(m); setMonth(m); setSel(iso); if (focus) focusDay(iso); };
  const onKey = (e) => {
    if (e.key === 'PageUp' || e.key === 'PageDown') { e.preventDefault(); shiftMonth(e.key === 'PageUp' ? -1 : 1, true); return; }
    const n = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key]; if (n == null) return;
    e.preventDefault(); pick(R.iso(R.addDays(R.parse(sel), n)), true);
  };
  const newId = ctx.added && ctx.added.phase === 'new' ? ctx.added.id : null; const newDate = newId ? ctx.added.date : null;
  useEffect(() => { if (!newId) return; setQ(''); setCatF('all'); setStatus('all'); setView('calendar'); pick(newDate, false); }, [newId]);
  const atToday = sel === todayIso && R.iso(month).slice(0, 7) === todayIso.slice(0, 7);
  const sumLine = (list) => { const s = live(list).reduce((a, o) => a + o.r.amount, 0); return s ? ' · ' + money(s) : ''; };
  const dueLine = (list) => { const n = live(list).length; const c = list.length - n; return [n ? `${n} due${sumLine(list)}` : '', c ? `${c} cancelled` : ''].filter(Boolean).join(' · ') || 'Nothing due'; };

  const header = html`<div class="page-head"><div class="row gap12 wrap" style=${{ alignItems: 'baseline' }}><h1 class="h1">My reminders</h1><div class="row c2">${all.length} reminder${all.length === 1 ? '' : 's'}${counts.unfinished > 0 && html` · <span class="badge t-brand"><${Icon} n="hourglass" />${counts.unfinished} need${counts.unfinished === 1 ? 's' : ''} a decision</span>`}</div></div><${Btn} sm icon="plus" class="ph-add" onClick=${() => go('new')}>Add reminder<//></div>`;
  if (loading) return html`${header}<div class="card pad20"><${Skel} h=${40} /></div><div class="card pad20 col gap12" aria-busy="true"><${Skel} w="200px" h=${28} /><div class="cal-grid">${[...Array(35)].map(() => html`<${Skel} h=${72} style=${{ borderRadius: 8 }} />`)}</div></div>`;
  if (err) return html`${header}<div class="card empty"><span class="ic t-amber"><${Icon} n="alert" /></span><h2 class="h2">We couldn’t load your reminders</h2><p class="c2" style=${{ margin: 0 }}>Your data is safe. Check your connection and try again.</p><${Btn} v="secondary" icon="refresh" loading=${retry} onClick=${() => { setRetry(true); setTimeout(() => { setRetry(false); if (navigator.onLine) { QS = QS === 'error' ? null : QS; ctx.update(() => ({ loadFail: false })); setErr(false); } }, 700); }}>Try again<//></div>`;
  if (!all.length) return html`${header}<${EmptyState} />`;

  const cells = [...Array(weeks * 7)].map((_, i) => {
    const d = R.addDays(gStart, i); const iso = R.iso(d); const list = byDay[iso] || [];
    const out = iso.slice(0, 7) !== mKey; const past = iso < todayIso; const isToday = iso === todayIso; const n = R.daysUntil(iso); const isNewDay = newDate === iso && list.some((o) => o.r.id === newId);
    const label = `${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}${isToday ? ', today' : ''}: ${list.length ? list.length + ' due — ' + list.map((o) => `${o.r.name}${o.r.amount ? ' ' + money(o.r.amount) : ''}${o.r.id === newId ? ', new' : ''}${o.r.status === 'unfinished' ? ', unfinished decision' : o.r.status === 'cancelled' ? ', cancelled' : ''}`).join('; ') : 'nothing due'}`;
    const urgent = n >= 0 && n <= 2;
    return html`<button type="button" key=${iso} data-day=${iso} class=${'cal-day' + (out ? ' out' : '') + (past ? ' past' : '') + (isToday ? ' today' : '') + (iso === sel ? ' sel' : '') + (list.length ? ' has' : '')} tabindex=${iso === sel ? 0 : -1} aria-pressed=${iso === sel} aria-label=${label} onClick=${() => pick(iso)}>
      <span class="cal-top" aria-hidden="true"><span class="cal-num">${d.getDate()}</span>${isNewDay ? html`<span class="cal-tag new">New</span>` : isToday ? html`<span class="cal-tag">Today</span>` : n === 1 ? html`<span class="cal-tag soft">Tomorrow</span>` : ''}</span>
      <span class="cal-chips" aria-hidden="true">${list.slice(0, maxChips).map((o) => html`<span class=${'cal-chip tone-' + (o.r.tone || 'lavender') + (o.r.status === 'cancelled' ? ' off' : '')} key=${o.r.id}>${o.r.status === 'unfinished' ? html`<${Icon} n="hourglass" c="xs" />` : urgent && o.r.status !== 'cancelled' ? html`<${Icon} n="alert" c="xs" />` : ''}<span class="t">${o.r.name}</span></span>`)}${list.length > maxChips && html`<span class="cal-more">+${list.length - maxChips} more</span>`}</span>
      ${list.length > 0 && html`<span class="cal-dots" aria-hidden="true">${list.slice(0, 3).map((o) => html`<i class=${'tone-' + (o.r.tone || 'lavender')} key=${o.r.id}></i>`)}${list.length > 3 && html`<b>+${list.length - 3}</b>`}</span>`}
    </button>`;
  });
  const nx = !dayItems.length && nextAfter(sel); const nxMonth = !rest.length && nextAfter(R.iso(mEnd));
  const selD = R.parse(sel);

  const calendar = html`<section class="card cal" aria-labelledby="cal-h">
      <div class="cal-head">
        <div class="row" style=${{ gap: 8 }}><button class="icon-btn" aria-label="Previous month" onClick=${() => shiftMonth(-1)}><${Icon} n="chevron-left" /></button><h2 class="h2 cal-title" id="cal-h" aria-live="polite">${month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h2><button class="icon-btn" aria-label="Next month" onClick=${() => shiftMonth(1)}><${Icon} n="chevron-right" /></button>${!atToday && html`<${Btn} v="ghost" sm onClick=${() => pick(todayIso)}>Today<//>`}</div>
        <span class="c2">${monthDue.length ? `${monthDue.length} due in ${monthName(month)}${monthSum ? ' · ' + money(monthSum) : ''}` : `Nothing due in ${monthName(month)}`}</span>
      </div>
      <div class="cal-grid" role="group" aria-label=${`${month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}. Use arrow keys to move between days, Page Up and Page Down to change month.`} onKeyDown=${onKey}>
        ${WEEK.map((w) => html`<span class="cal-wd" aria-hidden="true" key=${w}>${w}</span>`)}${cells}
      </div>
      <p class="small c3 cal-hint">Arrow keys move between days · Page Up / Page Down change month · Enter opens a reminder below</p>
    </section>
    <section class="card list-card" aria-labelledby="day-h">
      <div class="group-h"><span id="day-h">${selD.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}${sel === todayIso ? ' · Today' : ''}</span><span class="c3" style=${{ fontWeight: 400 }}>${dueLine(dayItems)}</span></div>
      ${dayItems.length ? dayItems.map((o) => html`<${Row} r=${{ ...o.r, date: o.iso }} ctx=${ctx} isNew=${o.r.id === newId} key=${o.r.id + o.iso} />`)
      : html`<div class="day-empty"><span class="c2">Nothing is due on this day.</span>${nx && html`<button class="link" onClick=${() => pick(nx.iso, true)}>Next: ${nx.r.name} · ${fmt(nx.iso)}<${Icon} n="arrow-right" c="xs" /></button>`}</div>`}
    </section>
    <section class="card list-card" aria-labelledby="rest-h">
      <div class="group-h"><span id="rest-h">${dayItems.length || inMonth.length ? 'Also in ' : 'In '}${monthName(month)}</span><span class="c3" style=${{ fontWeight: 400 }}>${dueLine(rest)}</span></div>
      ${rest.length ? rest.map((o) => html`<${Row} r=${{ ...o.r, date: o.iso }} ctx=${ctx} isNew=${o.r.id === newId} key=${o.r.id + o.iso} />`)
      : html`<div class="day-empty"><span class="c2">Nothing else is due in ${monthName(month)}.</span>${nxMonth && html`<button class="link" onClick=${() => pick(nxMonth.iso, true)}>Next: ${nxMonth.r.name} · ${fmt(nxMonth.iso, { day: 'numeric', month: 'long', year: 'numeric' })}<${Icon} n="arrow-right" c="xs" /></button>`}</div>`}
    </section>`;

  return html`${header}
    <div class="card col filters-card" role="search">
      <div class="row gap12 filters-row">
        <div class="grow" style=${{ position: 'relative' }}><label for="ls" class="sr-only">Search reminders</label><input id="ls" class="input" style=${{ height: 44, paddingLeft: 42 }} placeholder="Search by name or note" value=${q} onInput=${(e) => setQ(e.target.value)} /><span class="c3" style=${{ position: 'absolute', left: 13, top: 12 }}><${Icon} n="search" /></span></div>
        <div class="seg scroll-x" role="radiogroup" aria-label="Status">${[['all', 'All'], ['unfinished', `Unfinished · ${counts.unfinished}`], ['next30', `Next 30 days · ${counts.next30}`], ['cancelled', `Cancelled · ${counts.cancelled}`]].map(([id, l]) => html`<button role="radio" aria-checked=${status === id} onClick=${() => setStatus(id)} style=${{ whiteSpace: 'nowrap' }}>${l}</button>`)}</div>
        ${view === 'list' && html`<label class="row c2" style=${{ gap: 6 }}><span class="small">Sort</span><select class="input" style=${{ height: 44, width: 'auto' }} value=${sort} onChange=${(e) => setSort(e.target.value)}><option value="date">Date</option><option value="amount">Amount</option><option value="name">Name</option></select></label>`}
        ${all.length > 0 && html`<div class="seg view-seg" role="radiogroup" aria-label="View">${[['calendar', 'Calendar view', 'calendar'], ['list', 'List view', 'list']].map(([id, l, ic]) => html`<button role="radio" aria-checked=${view === id} aria-label=${l} title=${l} onClick=${() => setView(id)}><${Icon} n=${ic} c="s" /></button>`)}</div>`}
      </div>
      <div class="row scroll-x" role="group" aria-label="Category">${[['all', 'All categories'], ...R.CATEGORIES.map((c) => [c.id, `${c.label} · ${all.filter((r) => r.category === c.id).length}`])].map(([id, l]) => html`<button class="chip" aria-pressed=${catF === id} onClick=${() => setCatF(id)}>${catF === id && html`<${Icon} n="check" c="s" />`}${l}</button>`)}</div>
    </div>
    ${!items.length ? html`<div class="card empty"><span class="ic t-neutral"><${Icon} n="search" /></span><h2 class="h2">Nothing found</h2><p class="c2" style=${{ margin: 0 }}>${q ? `No reminders match “${q}”. ` : 'No reminders match these filters. '}Try another name, or reset filters.</p><${Btn} v="secondary" icon="reset" onClick=${resetF}>Reset filters<//></div>`
    : view === 'calendar' ? calendar
    : groups.map(([g, rs]) => html`<section class="card list-card" aria-label=${g} key=${g}><div class="group-h">${g}<span class="c3" style=${{ fontWeight: 400 }}>${rs.length}</span></div>${rs.map((r) => html`<${Row} r=${r} ctx=${ctx} key=${r.id} />`)}</section>`)}`;
}

ReactDOM.createRoot(document.getElementById('root')).render(html`<${App} />`);
