// Renewal Reminder — browser API client.
// The browser only talks to our own server function (/api/send_reminder).
// It never sees the email service's key and can't choose the recipient: it sends its
// sign-in token, and the server emails the address that token belongs to.
(function () {
  const TIMEOUT = 15000;

  // opts.due = a real reminder (saved on/after its reminder day): the server sends it at most once a day.
  async function sendReminder(r, opts) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    const reminder = { id: /^[A-Za-z0-9_-]{1,80}$/.test(r.id || '') ? r.id : undefined, name: r.name, date: r.date, amount: Number(r.amount) || 0, cycle: r.cycle, daysLeft: window.RR.daysUntil(r.date) };
    const token = window.RRCloud && window.RRCloud.enabled ? await window.RRCloud.idToken() : null;
    if (!token) throw new Error('Log in with Google or your email account to get reminder emails.');
    let res;
    try {
      res = await fetch('/api/send_reminder', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ reminder, ...(opts && opts.due ? { due: true } : {}) }), signal: ctrl.signal });
    } catch (e) {
      throw new Error(e.name === 'AbortError' ? 'The server took too long to answer. Try again.' : 'No connection to the server. Check your internet and try again.');
    } finally { clearTimeout(timer); }

    let data = {};
    try { data = await res.json(); } catch (e) { /* static host with no API: not JSON */ }
    if (res.ok && data.ok) return data;
    if ([404, 405, 501].includes(res.status) && !data.error) throw new Error('Email needs the server. Open the deployed site or run “python3 dev_server.py”.');
    const err = new Error(data.error || `Something went wrong (${res.status}). Try again.`); err.code = data.code; throw err;
  }

  window.RRApi = { sendReminder };
})();
