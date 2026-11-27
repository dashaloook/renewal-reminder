"""POST /api/send_reminder — sends one renewal reminder email through Brevo (or Gmail).

Runs as a Vercel Python serverless function, and locally through dev_server.py.

Security model
- Emails go out through Brevo (BREVO_API_KEY + BREVO_SENDER), or through Gmail
  (GMAIL_USER + GMAIL_APP_PASSWORD) if those are set. The secrets are read from
  environment variables on the server. It is never sent to the browser and never written in the code.
- The email goes to the signed-in person's own, confirmed address (Google or
  email account). The browser
  sends its Firebase sign-in token; the server checks it with Google and reads
  the email from it. The browser can't choose the recipient, so nobody can use
  the endpoint to email someone else, and one user never gets another's emails.
- Input is validated and HTML-escaped before it goes into the email.
- A small per-IP rate limit slows down abuse (best effort: it lives in one
  server instance's memory).
- Errors from the email service are logged on the server; the browser only gets a short,
  safe message.
"""

from http.server import BaseHTTPRequestHandler
import html
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request

LOOKUP_URL = "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key="
# Public Firebase web key (same as firebase-config.js; not a secret). Override with FIREBASE_API_KEY.
DEFAULT_FIREBASE_KEY = "AIzaSyA7XpUu145kJ_gs5LUi0ShqhU06FzuwJss"
MAX_BODY = 4096
RATE_LIMIT = 5          # emails
RATE_WINDOW = 60 * 10   # per 10 minutes, per IP
_hits = {}

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,80}$")  # reminder ids are short tokens; nothing else goes into the link
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


CURRENCIES = {"USD": "$", "EUR": "€", "UAH": "₴"}


def money_str(amount, currency=None):
    """$12.99 / €12.99 / ₴199.00 — the account's currency, US dollars by default."""
    return f"{CURRENCIES.get(currency or 'USD', '$')}{amount:,.2f}"


def _validate(data):
    """Return (clean_reminder, None) or (None, error_message)."""
    if not isinstance(data, dict):
        return None, "Send a JSON object."
    if "due" in data and not isinstance(data["due"], bool):
        return None, "due must be true or false."
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
    rid = r.get("id")
    if rid is not None and (not isinstance(rid, str) or not ID_RE.match(rid)):
        return None, "Unknown reminder id."
    currency = r.get("currency", "USD")
    if currency not in CURRENCIES:
        return None, "Unknown currency."
    lang = r.get("lang", "en")
    if lang not in LANGS:
        return None, "Unknown language."
    return {"name": name.strip(), "date": date, "amount": float(amount), "cycle": cycle, "daysLeft": days, "id": rid,
            "currency": currency, "lang": lang}, None


LANGS = ("uk", "en")


def uk_plural(n, one, few, many):
    """Ukrainian plural: 1 день, 2 дні, 5 днів (11–14 → днів)."""
    n = abs(int(n)) % 100
    if 10 < n < 20:
        return many
    d = n % 10
    return one if d == 1 else few if 2 <= d <= 4 else many


def uk_days(n):
    return f"{n} {uk_plural(n, 'день', 'дні', 'днів')}"


def _when(days, lang="en"):
    if days is None:
        return ""
    if lang == "uk":
        if days == 0:
            return "сьогодні"
        if days == 1:
            return "завтра"
        return f"через {uk_days(days)}" if days > 1 else f"{uk_days(-days)} тому"
    if days == 0:
        return "today"
    if days == 1:
        return "tomorrow"
    if days > 1:
        return f"in {days} days"
    return f"{-days} days ago"


APP_URL = os.environ.get("APP_URL", "https://renewduck.vercel.app")


UK_MONTHS = ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"]


def _nice_date(iso, lang="en"):
    try:
        y, m, d = (int(x) for x in iso.split("-"))
        if lang == "uk":
            return f"{d} {UK_MONTHS[m - 1]} {y}"
        return f"{d} {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1]} {y}"
    except Exception:
        return iso


def reminder_link(r):
    """Opens the app on this reminder's details (after sign-in if needed)."""
    rid = r.get("id")
    return f"{APP_URL}/?open={rid}&act=open#/dashboard" if rid and ID_RE.match(str(rid)) else f"{APP_URL}/#/dashboard"


UK_PER = {"weekly": "тиж.", "monthly": "міс.", "yearly": "рік", "one-time": ""}


def build_email(r):
    """A plain, personal-looking email: spam filters dislike robotic subjects,
    'demo' wording, missing text versions and no way to stop the emails.
    In Ukrainian when the person uses the app in Ukrainian (r["lang"])."""
    lang = r.get("lang", "en")
    name = html.escape(r["name"])
    when = _when(r["daysLeft"], lang)
    per = (UK_PER if lang == "uk" else CYCLES).get(r["cycle"], "")
    price = money_str(r["amount"], r.get("currency")) + (f" / {per}" if per and r["amount"] else "")
    day = _nice_date(r["date"], lang)
    link = reminder_link(r)
    if lang == "uk":
        w = {"hi": "Привіт!", "subject": f"Нагадування: {r['name']} — списання {when or 'скоро'} ({day})",
             "head": f"{name}: списання {html.escape(when) if when else 'скоро'}", "head_t": f"{r['name']}: списання {when + ' — ' if when else ''}{day}.",
             "date": "Дата списання", "amount": "Сума",
             "decide": "Виріши до списання: залишити, скасувати на сайті сервісу чи відкласти рішення. Гроші люблять лік 😉",
             "open_t": "Відкрити нагадування", "button": "Відкрити Renewal Reminder",
             "why": "Ти отримуєш цей лист, бо налаштував(-ла) нагадування на email у Renewal Reminder. Щоб вимкнути, відкрий нагадування і обери канал «Браузер» або видали його."}
    else:
        w = {"hi": "Hi,", "subject": f"Reminder: {r['name']} renews {when or 'soon'} ({day})",
             "head": f"{name} renews {html.escape(when) if when else 'soon'}", "head_t": f"{r['name']} renews {when + ' ' if when else ''}on {day}.",
             "date": "Charge date", "amount": "Amount",
             "decide": "Decide before the charge: keep it, cancel it on the service’s website, or postpone the decision.",
             "open_t": "Open this reminder", "button": "Open Renewal Reminder",
             "why": "You get this email because you set an email reminder for this renewal in Renewal Reminder. To stop it, open the reminder and switch it to Browser, or delete it."}
    # The charge date in the subject keeps different reminders apart in Gmail.
    subject = w["subject"][:120]
    text = (f"{w['hi']}\n\n{w['head_t']}"
            + (f" {w['amount']}: {price}." if r["amount"] else "")
            + f"\n\n{w['decide']}"
            + f"\n\n{w['open_t']}: {link}"
            + f"\n\n{w['why']}")
    body = f"""<!doctype html><html lang="{lang}"><body style="margin:0;padding:24px;background:#F6F5FB">
<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;color:#14142B">
<p style="margin:0 0 12px;font-size:15px">{w['hi']}</p>
<h2 style="margin:0 0 12px;font-size:20px">{w['head']}</h2>
<p style="margin:0 0 4px;font-size:15px">{w['date']}: <b>{html.escape(day)}</b></p>
{f'<p style="margin:0 0 16px;font-size:15px">{w["amount"]}: <b>{html.escape(price)}</b></p>' if r['amount'] else ''}
<p style="margin:0 0 20px;font-size:15px">{w['decide']}</p>
<p style="margin:0 0 24px"><a href="{html.escape(link)}" style="background:#16132B;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-size:14px;display:inline-block">{w['button']}</a></p>
<p style="margin:0;color:#6E7191;font-size:12px;line-height:1.5">{w['why']}</p>
</div></body></html>"""
    return subject, text, body


def _send_gmail(app_password, sender, to, subject, text, body):
    """Send through Gmail (SMTP) with a Google App Password. Reaches any address."""
    import smtplib
    from email.message import EmailMessage
    from email.utils import parseaddr
    user = parseaddr(sender)[1]
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = sender, to, subject
    msg.set_content(text)
    msg.add_alternative(body, subtype="html")
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=15) as smtp:
        smtp.login(user, app_password)
        smtp.send_message(msg)
    return {"id": None}


BREVO_URL = "https://api.brevo.com/v3/smtp/email"


def _send_brevo(api_key, sender, to, subject, text, body):
    """Send through Brevo's free plan (300/day). Reaches any address; the sender must be verified in Brevo."""
    from email.utils import parseaddr
    name, addr = parseaddr(sender)
    payload = json.dumps({"sender": {"name": name or "Renewal Reminder", "email": addr}, "to": [{"email": to}],
                          "replyTo": {"email": addr, "name": name or "Renewal Reminder"},
                          "subject": subject, "textContent": text, "htmlContent": body,
                          # Tells Gmail how to stop the emails; missing unsubscribe info is a spam signal.
                          "headers": {"List-Unsubscribe": f"<mailto:{addr}?subject=Stop%20Renewal%20Reminder%20emails>"}}).encode()
    req = urllib.request.Request(BREVO_URL, data=payload, method="POST", headers={
        "api-key": api_key, "Content-Type": "application/json", "Accept": "application/json", "User-Agent": "renewal-reminder/1.0"})
    with urllib.request.urlopen(req, timeout=10) as res:
        return {"id": json.loads(res.read() or b"{}").get("messageId")}


def mail_channel(env):
    """Which email service to use: Gmail if its secrets are set, else Brevo.
    Returns (send_fn, secret, sender, name) or None if neither is set up."""
    g_user = env.get("GMAIL_USER", "").strip()
    g_pass = env.get("GMAIL_APP_PASSWORD", "").replace(" ", "").strip()
    if g_user and g_pass:
        return _send_gmail, g_pass, f"Renewal Reminder <{g_user}>", "gmail"
    b_key, b_from = env.get("BREVO_API_KEY", "").strip(), env.get("BREVO_SENDER", "").strip()
    if b_key and b_from:
        return _send_brevo, b_key, f"Renewal Reminder <{b_from}>", "brevo"
    return None


def friendly_send_error(e):
    """Server-log the real error; return a short, safe message for the browser."""
    import smtplib
    if isinstance(e, smtplib.SMTPAuthenticationError):
        print(f"[mail] Gmail login failed: {e.smtp_code}")
        return "Gmail rejected the server’s app password. Check GMAIL_USER and GMAIL_APP_PASSWORD in Vercel.", None
    if isinstance(e, smtplib.SMTPRecipientsRefused):
        print("[mail] Gmail refused the recipient")
        return "Gmail couldn’t deliver to this address.", None
    if isinstance(e, urllib.error.HTTPError):
        detail = e.read()[:500].decode("utf-8", "replace")
        print(f"[mail] Brevo HTTP {e.code}: {detail}")
        if "sender" in detail.lower() and ("valid" in detail.lower() or "verif" in detail.lower()):
            return "The email service doesn’t accept the sender yet. Confirm BREVO_SENDER in Brevo → Senders.", None
        if "not yet activated" in detail.lower() or "account" in detail.lower() and "activ" in detail.lower():
            return "The Brevo account isn’t activated for sending yet. Check Brevo for an activation message.", None
        if "api key" in detail.lower() or "key not found" in detail.lower() or e.code == 401:
            return "The email service rejected the server’s API key. Check the key in Vercel.", None
        return "The email service couldn’t send this email.", None
    print(f"[mail] send failed: {e!r}")
    return "Couldn’t reach the email service. Try again.", None


# ---------- "Already sent" records (no duplicates) ----------
# Before a real reminder email or push goes out, the server creates sent/{uid}__{reminderId}__{date}__{kind}
# in one atomic step ("create only if it doesn't exist"). If the record already exists, someone already
# sent it today, so we skip. If sending fails, the record is removed so a later run can retry.
# Only the server (service account) can touch `sent` — the database rules close it to browsers.

def sent_key(uid, reminder_id, day, kind):
    return f"{uid}__{reminder_id}__{day}__{kind}"[:1400]


def service_token(sa, scopes=("https://www.googleapis.com/auth/datastore",)):
    from google.oauth2 import service_account
    import google.auth.transport.requests
    creds = service_account.Credentials.from_service_account_info(sa, scopes=list(scopes))
    creds.refresh(google.auth.transport.requests.Request())
    return creds.token


class SentLedger:
    def __init__(self, project_id, token):
        self.base = f"https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents/sent"
        self.token = token

    def _req(self, url, method="GET", body=None):
        req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None,
                                     headers={"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=15) as res:
            return res.status

    def claim(self, key, info):
        """True if this call created the record (we may send); False if it already existed (skip)."""
        import datetime as _dt
        now = _dt.datetime.now(_dt.timezone.utc)
        ts = lambda t: t.strftime("%Y-%m-%dT%H:%M:%SZ")
        fields = {k: {"stringValue": str(v)} for k, v in info.items()}
        fields["at"] = {"timestampValue": ts(now)}
        fields["expireAt"] = {"timestampValue": ts(now + _dt.timedelta(days=45))}  # for an optional Firestore TTL policy
        try:
            self._req(f"{self.base}?documentId={urllib.parse.quote(key, safe='')}", "POST", {"fields": fields})
            return True
        except urllib.error.HTTPError as e:
            if e.code == 409:  # ALREADY_EXISTS
                return False
            raise

    def release(self, key):
        try:
            self._req(f"{self.base}/{urllib.parse.quote(key, safe='')}", "DELETE")
        except urllib.error.HTTPError as e:
            if e.code != 404:
                raise

    def exists(self, key):
        try:
            return self._req(f"{self.base}/{urllib.parse.quote(key, safe='')}") == 200
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return False
            raise


def today_kyiv():
    from zoneinfo import ZoneInfo
    import datetime as _dt
    return _dt.datetime.now(ZoneInfo("Europe/Kyiv")).date()


def _lookup(firebase_key, id_token):
    """Ask Google who this sign-in token belongs to. Returns the user dict or None."""
    payload = json.dumps({"idToken": id_token}).encode()
    req = urllib.request.Request(LOOKUP_URL + firebase_key, data=payload, method="POST",
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            users = json.loads(res.read() or b"{}").get("users") or []
    except urllib.error.HTTPError:
        return None  # expired, forged or from another project
    return users[0] if users else None


def process(method, headers, raw_body, ip, env=None, sender_fn=None, lookup_fn=None, ledger=None):
    """Pure request logic: returns (status, json_dict). Used by Vercel and dev_server.py."""
    env = os.environ if env is None else env
    lookup = lookup_fn or _lookup
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

    auth = headers.get("Authorization") or headers.get("authorization") or ""
    id_token = auth[7:].strip() if auth.startswith("Bearer ") else ""
    if not id_token or len(id_token) > 4096:
        return 401, {"error": "Log in with Google or your email account to get reminder emails.", "code": "signin_required"}

    channel = mail_channel(env)
    if not channel:
        return 503, {"error": "Email isn’t set up on the server yet.", "code": "not_configured"}

    try:
        user = lookup(env.get("FIREBASE_API_KEY", "").strip() or DEFAULT_FIREBASE_KEY, id_token)
    except Exception as e:
        print(f"[send_reminder] sign-in check failed: {e!r}")
        return 502, {"error": "Couldn’t check your sign-in. Try again."}
    if not user:
        return 401, {"error": "Your sign-in has expired. Sign out and sign in again.", "code": "signin_required"}
    to = (user.get("email") or "").strip()
    if not to or not user.get("emailVerified"):
        return 403, {"error": "Confirm your email first: open the link we sent you when you created the account, then try again.", "code": "unverified"}

    if _rate_limited(user.get("localId") or ip or "unknown"):
        return 429, {"error": "Too many test emails. Try again in a few minutes."}

    send, secret, sender, _ = channel
    send = sender_fn or send
    # A real reminder (saved on/after its reminder day), not a test: send it at most once per day,
    # shared with the daily job through the "already sent" records.
    key = None
    if data.get("due") is True and reminder.get("id"):
        try:
            if ledger is None:
                raw = env.get("FIREBASE_SERVICE_ACCOUNT", "").strip()
                if raw:
                    sa = json.loads(raw)
                    ledger = SentLedger(sa["project_id"], service_token(sa))
            if ledger:
                key = sent_key(user.get("localId") or "", reminder["id"], today_kyiv().isoformat(), "email")
                if not ledger.claim(key, {"uid": user.get("localId") or "", "reminderId": reminder["id"], "date": today_kyiv().isoformat(), "kind": "email", "by": "save"}):
                    return 200, {"ok": True, "already": True, "to": to}
        except Exception as e:  # records unavailable: still send (better a rare duplicate than a missed reminder)
            print(f"[send_reminder] sent-records check failed: {e!r}")
            key = None
    subject, text, body = build_email(reminder)
    try:
        result = send(secret, sender, to, subject, text, body) or {}
    except Exception as e:
        if key and ledger:
            try:
                ledger.release(key)
            except Exception:
                pass
        msg, code = friendly_send_error(e)
        return 502, {"error": msg, **({"code": code} if code else {})}
    return 200, {"ok": True, "id": result.get("id"), "to": to}


class handler(BaseHTTPRequestHandler):
    """Vercel entry point."""

    def _run(self):
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(min(length, MAX_BODY + 1)) if length else b""
        ip = (self.headers.get("x-forwarded-for") or self.client_address[0] or "").split(",")[0].strip()
        status, out = process(self.command, self.headers, raw, ip)
        print(f"[send_reminder] {self.command} -> {status} {out.get('code') or out.get('error') or 'ok'}")  # no email address in logs
        body = b"" if status == 204 else json.dumps(out).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    do_POST = _run
    do_GET = _run
    do_OPTIONS = _run
