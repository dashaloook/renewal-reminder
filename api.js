// Renewal Reminder — browser API client.
// The browser only talks to our own server function (/api/send_reminder).
// It never sees the email service's key and can't choose the recipient.
(function () {
  const TIMEOUT = 15000;

  async function sendReminder(r) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    const reminder = { name: r.name, date: r.date, amount: Number(r.amount) || 0, cycle: r.cycle, daysLeft: window.RR.daysUntil(r.date) };
    let res;
    try {
      res = await fetch('/api/send_reminder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reminder }), signal: ctrl.signal });
    } catch (e) {
      throw new Error(e.name === 'AbortError' ? 'The server took too long to answer. Try again.' : 'No connection to the server. Check your internet and try again.');
    } finally { clearTimeout(timer); }

    let data = {};
    try { data = await res.json(); } catch (e) { /* static host with no API: not JSON */ }
    if (res.ok && data.ok) return data;
    if ([404, 405, 501].includes(res.status) && !data.error) throw new Error('Email needs the server. Open the deployed site or run “python3 dev_server.py”.');
    throw new Error(data.error || `Something went wrong (${res.status}). Try again.`);
  }

  window.RRApi = { sendReminder };
})();
