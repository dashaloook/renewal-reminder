"""POST /api/send_reminder — sends one renewal reminder email through Resend.

Runs as a Vercel Python serverless function, and locally through dev_server.py.

Security model
- The Resend key is read from the RESEND_API_KEY environment variable on the
  server. It is never sent to the browser and never written in the code.
- The recipient is fixed on the server (REMINDER_TO_EMAIL). The browser can't
  choose who gets the email, so the endpoint can't be used to spam strangers.
- Input is validated and HTML-escaped before it goes into the email.
- A small per-IP rate limit slows down abuse (best effort: it lives in one
  server instance's memory).
- Errors from Resend are logged on the server; the browser only gets a short,
  safe message.
"""

from http.server import BaseHTTPRequestHandler
import html
import json
import os
import re
import time
import urllib.error
import urllib.request

RESEND_URL = "https://api.resend.com/emails"
MAX_BODY = 4096
RATE_LIMIT = 5          # emails
RATE_WINDOW = 60 * 10   # per 10 minutes, per IP
_hits = {}

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
CYCLES = {"weekly": "week", "monthly": "month", "yearly": "year", "one-time": ""}


def _rate_limited(ip, now=None):
    now = now or time.time()
    recent = [t for t in _hits.get(ip, []) if now - t < RATE_WINDOW]
    if len(recent) >= RATE_LIMIT:
        _hits[ip] = recent
        return True
    recent.append(now)
    _hits[ip] = recent
    return False


def _validate(data):
    """Return (clean_reminder, None) or (None, error_message)."""
    if not isinstance(data, dict):
        return None, "Send a JSON object."
    r = data.get("reminder")
    if not isinstance(r, dict):
        return None, "Missing reminder."
    name = r.get("name")
    if not isinstance(name, str) or not name.strip() or len(name) > 80:
        return None, "Name must be 1–80 characters."
    date = r.get("date")
    if not isinstance(date, str) or not DATE_RE.match(date):
        return None, "Date must look like 2026-11-30."
    amount = r.get("amount", 0)
    if isinstance(amount, bool) or not isinstance(amount, (int, float)) or not (0 <= amount <= 100000):
        return None, "Amount must be a number between 0 and 100000."
    cycle = r.get("cycle", "monthly")
    if cycle not in CYCLES:
        return None, "Unknown billing cycle."
    days = r.get("daysLeft")
    if days is not None and (isinstance(days, bool) or not isinstance(days, int) or abs(days) > 3660):
        return None, "daysLeft must be a whole number."
    return {"name": name.strip(), "date": date, "amount": float(amount), "cycle": cycle, "daysLeft": days}, None


def _when(days):
    if days is None:
        return ""
    if days == 0:
        return "today"
    if days == 1:
        return "tomorrow"
    if days > 1:
        return f"in {days} days"
    return f"{-days} days ago"


def build_email(r):
    name = html.escape(r["name"])
    when = _when(r["daysLeft"])
    per = CYCLES[r["cycle"]]
    price = f"€{r['amount']:.2f}" + (f" / {per}" if per and r["amount"] else "")
    subject = f"{r['name']} renews {when or 'on ' + r['date']}"[:120]
    text = (f"{r['name']} renews {when + ' ' if when else ''}on {r['date']}."
            + (f" Amount: {price}." if r["amount"] else "")
            + "\n\nKeep it, cancel it on the service's site, or decide later in Renewal Reminder."
            + "\n\nThis is a demo reminder sent from the Renewal Reminder coursework prototype.")
    body = f"""<div style="font-family:Arial,sans-serif;max-width:480px;color:#14142B">
<h2 style="margin:0 0 8px">{name} renews {html.escape(when) if when else 'soon'}</h2>
<p style="margin:0 0 4px">Charge date: <b>{html.escape(r['date'])}</b></p>
{f'<p style="margin:0 0 16px">Amount: <b>{html.escape(price)}</b></p>' if r['amount'] else ''}
<p style="margin:0 0 16px">Keep it, cancel it on the service’s site, or decide later — before the charge goes through.</p>
<p style="margin:0;color:#6E7191;font-size:12px">Demo reminder from the Renewal Reminder coursework prototype.</p></div>"""
    return subject, text, body


def _send(api_key, sender, to, subject, text, body):
    payload = json.dumps({"from": sender, "to": [to], "subject": subject, "text": text, "html": body}).encode()
    req = urllib.request.Request(RESEND_URL, data=payload, method="POST", headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": "renewal-reminder/1.0",
    })
    with urllib.request.urlopen(req, timeout=10) as res:
        return json.loads(res.read() or b"{}")


def process(method, headers, raw_body, ip, env=None, sender_fn=None):
    """Pure request logic: returns (status, json_dict). Used by Vercel and dev_server.py."""
    env = os.environ if env is None else env
    send = sender_fn or _send
    if method == "OPTIONS":
        return 204, {}
    if method != "POST":
        return 405, {"error": "Use POST."}

    allowed = env.get("ALLOWED_ORIGIN", "").strip()
    origin = headers.get("Origin") or headers.get("origin") or ""
    if allowed and origin and origin != allowed:
        return 403, {"error": "This origin is not allowed."}

    if len(raw_body or b"") > MAX_BODY:
        return 413, {"error": "Request is too large."}
    try:
        data = json.loads(raw_body or b"")
    except (ValueError, UnicodeDecodeError):
        return 400, {"error": "Send valid JSON."}
    reminder, err = _validate(data)
    if err:
        return 400, {"error": err}

    api_key = env.get("RESEND_API_KEY", "").strip()
    to = env.get("REMINDER_TO_EMAIL", "").strip()
    if not api_key or not to:
        return 503, {"error": "Email isn’t set up on the server yet.", "code": "not_configured"}

    if _rate_limited(ip or "unknown"):
        return 429, {"error": "Too many test emails. Try again in a few minutes."}

    sender = env.get("RESEND_FROM", "").strip() or "Renewal Reminder <onboarding@resend.dev>"
    subject, text, body = build_email(reminder)
    try:
        result = send(api_key, sender, to, subject, text, body)
    except urllib.error.HTTPError as e:
        detail = e.read()[:500].decode("utf-8", "replace")
        print(f"[send_reminder] Resend HTTP {e.code}: {detail}")  # server log only
        if "api key" in detail.lower():
            return 502, {"error": "The email service rejected the server’s API key. Check RESEND_API_KEY in Vercel."}
        if e.code in (401, 403):
            return 502, {"error": "The email service rejected the server’s key or recipient."}
        return 502, {"error": "The email service couldn’t send this email."}
    except Exception as e:  # network errors, timeouts
        print(f"[send_reminder] send failed: {e!r}")
        return 502, {"error": "Couldn’t reach the email service. Try again."}
    return 200, {"ok": True, "id": result.get("id")}


class handler(BaseHTTPRequestHandler):
    """Vercel entry point."""

    def _run(self):
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(min(length, MAX_BODY + 1)) if length else b""
        ip = (self.headers.get("x-forwarded-for") or self.client_address[0] or "").split(",")[0].strip()
        status, out = process(self.command, self.headers, raw, ip)
        body = b"" if status == 204 else json.dumps(out).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    do_POST = _run
    do_GET = _run
    do_OPTIONS = _run
