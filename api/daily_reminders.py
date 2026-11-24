"""GET /api/daily_reminders — the daily job that sends automatic reminders.

Vercel Cron calls it once a day (see vercel.json). For every user it reads their
reminders from Firestore and emails the ones that are due today:
- "by Email" reminders get an email; "Browser" reminders get a push notification
  on every device where the user turned notifications on,
- it isn't cancelled,
- today is exactly `remind` days before the charge date (0 = on the day),
  or it was postponed ("Decide later") and today is its follow-up date.

Security model
- Only Vercel Cron can run it: Vercel sends `Authorization: Bearer <CRON_SECRET>`,
  and the job refuses every request without that secret.
- It reads the database with a Firebase service-account key kept in the
  FIREBASE_SERVICE_ACCOUNT environment variable (Vercel Secret). The key never
  reaches the browser or GitHub. It bypasses the database rules, so it only
  ever reads; it never writes.
- The recipient is the user's own confirmed address from Firebase Authentication,
  never an address stored in the database (users could edit that).
- Push notifications are signed with VAPID_PRIVATE_KEY (Vercel Secret); the
  matching public key is in push.js. Subscriptions live in each user's own document.
- `?dry=1` reports what would be sent without sending anything.
"""

from http.server import BaseHTTPRequestHandler
import calendar
import datetime as dt
import json
import os
import sys
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from send_reminder import build_email, mail_channel, friendly_send_error  # noqa: E402  (shared email code)

TZ = "Europe/Kyiv"
SCOPES = ["https://www.googleapis.com/auth/datastore", "https://www.googleapis.com/auth/identitytoolkit",
          "https://www.googleapis.com/auth/cloud-platform"]


# ---------- dates (same rules as data.js) ----------

def today_local(now=None):
    from zoneinfo import ZoneInfo
    return (now or dt.datetime.now(ZoneInfo(TZ))).date()


def _add_months(d, n, anchor):
    m = d.month - 1 + n
    y, m = d.year + m // 12, m % 12 + 1
    return dt.date(y, m, min(anchor, calendar.monthrange(y, m)[1]))


def next_date(r, today):
    """The next charge date, rolling recurring reminders forward like the app does."""
    d = dt.date.fromisoformat(r["date"])
    if r.get("cycle") == "one-time":
        return d
    anchor, guard = d.day, 0
    while d < today and guard < 400:
        guard += 1
        d = d + dt.timedelta(days=7) if r["cycle"] == "weekly" else _add_months(d, 12 if r["cycle"] == "yearly" else 1, anchor)
    return d


def due_today(r, today):
    """Returns (is_due, charge_date, days_left)."""
    try:
        if r.get("status") == "cancelled" or not r.get("name") or not r.get("date"):
            return False, None, None
        d = next_date(r, today)
        days = (d - today).days
        remind = int(r.get("remind", 7) or 0)
        follow = r.get("status") == "unfinished" and r.get("followUp") == today.isoformat()
        return (days >= 0 and days == remind) or follow, d, days
    except (ValueError, TypeError, KeyError):
        return False, None, None


# ---------- Firestore REST values -> Python ----------

def decode(v):
    if "mapValue" in v:
        return {k: decode(x) for k, x in v["mapValue"].get("fields", {}).items()}
    if "arrayValue" in v:
        return [decode(x) for x in v["arrayValue"].get("values", [])]
    for k in ("stringValue", "booleanValue", "timestampValue"):
        if k in v:
            return v[k]
    if "integerValue" in v:
        return int(v["integerValue"])
    if "doubleValue" in v:
        return float(v["doubleValue"])
    return None


# ---------- Google APIs ----------

def _token(sa):
    from google.oauth2 import service_account
    import google.auth.transport.requests
    creds = service_account.Credentials.from_service_account_info(sa, scopes=SCOPES)
    creds.refresh(google.auth.transport.requests.Request())
    return creds.token


def _call(url, token, body=None):
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None,
                                 method="POST" if body is not None else "GET",
                                 headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as res:
        return json.loads(res.read() or b"{}")


def load_users(sa, token):
    """[(uid, reminders, push_subscriptions)] for every user document."""
    base = f"https://firestore.googleapis.com/v1/projects/{sa['project_id']}/databases/(default)/documents/users?pageSize=300"
    out, page = [], ""
    while True:
        data = _call(base + (f"&pageToken={urllib.parse.quote(page)}" if page else ""), token)
        for doc in data.get("documents", []):
            fields = {k: decode(v) for k, v in doc.get("fields", {}).items()}
            out.append((doc["name"].rsplit("/", 1)[-1], fields.get("reminders") or [], fields.get("push") or []))
        page = data.get("nextPageToken")
        if not page:
            return out


def lookup_emails(sa, token, uids):
    """{uid: email} for users with a confirmed email address."""
    found = {}
    for i in range(0, len(uids), 100):
        data = _call(f"https://identitytoolkit.googleapis.com/v1/projects/{sa['project_id']}/accounts:lookup", token, {"localId": uids[i:i + 100]})
        for u in data.get("users", []):
            if u.get("email") and u.get("emailVerified"):
                found[u["localId"]] = u["email"]
    return found


def send_push(sub, payload, private_key, subject):
    from pywebpush import webpush
    webpush(subscription_info=sub, data=json.dumps(payload), vapid_private_key=private_key,
            vapid_claims={"sub": subject}, timeout=10, ttl=24 * 3600)


# ---------- the job ----------

def run(env=None, dry=False, today=None, load_fn=None, lookup_fn=None, send_fn=None, push_fn=None):
    """Pure job logic: returns (status, summary). Injectable for tests."""
    env = os.environ if env is None else env
    channel = mail_channel(env)
    raw = env.get("FIREBASE_SERVICE_ACCOUNT", "").strip()
    if not raw or not channel:
        return 503, {"error": "Not set up: add FIREBASE_SERVICE_ACCOUNT and an email service (BREVO_API_KEY + BREVO_SENDER) in Vercel."}
    try:
        sa = json.loads(raw)
    except ValueError:
        return 503, {"error": "FIREBASE_SERVICE_ACCOUNT isn’t valid JSON. Paste the whole key file."}
    today = today or today_local()
    try:
        token = None if load_fn else _token(sa)
        users = (load_fn or (lambda: load_users(sa, token)))()
    except Exception as e:
        print(f"[daily] couldn't read the database: {e!r}")
        return 502, {"error": "Couldn’t read the database. Check FIREBASE_SERVICE_ACCOUNT."}

    users = [u if len(u) == 3 else (u[0], u[1], []) for u in users]
    due = [(uid, r, d, n, subs) for uid, rs, subs in users for r in rs if isinstance(r, dict) for ok, d, n in [due_today(r, today)] if ok]
    due_mail = [x for x in due if x[1].get("channel") == "email"]
    due_push = [x for x in due if x[1].get("channel") != "email"]
    emails = (lookup_fn or (lambda ids: lookup_emails(sa, token, ids)))(sorted({u for u, *_ in due_mail})) if due_mail else {}
    send, secret, sender, service = channel
    send = send_fn or send
    summary = {"service": service, "date": today.isoformat(), "users": len(users), "due": len(due_mail), "sent": 0,
               "skipped_unconfirmed": 0, "failed": 0, "dry": dry,
               "push_due": len(due_push), "push_sent": 0, "push_failed": 0, "push_no_device": 0}
    for uid, r, d, n, _ in due_mail:
        to = emails.get(uid)
        if not to:
            summary["skipped_unconfirmed"] += 1
            continue
        if dry:
            summary["would_send"] = summary.get("would_send", 0) + 1
            continue
        amount = r.get("amount") or 0
        subject, text, body = build_email({"name": str(r["name"])[:80], "date": d.isoformat(), "amount": float(amount) if isinstance(amount, (int, float)) else 0.0,
                                           "cycle": r.get("cycle") if r.get("cycle") in ("weekly", "monthly", "yearly", "one-time") else "monthly", "daysLeft": n})
        try:
            send(secret, sender, to, subject, text, body)
            summary["sent"] += 1
        except Exception as e:
            print(f"[daily] send failed for user {uid[:6]}…")  # no email address in logs
            friendly_send_error(e)
            summary["failed"] += 1

    vapid = env.get("VAPID_PRIVATE_KEY", "").strip()
    push = push_fn or send_push
    for uid, r, d, n, subs in due_push:
        subs = [x for x in subs if isinstance(x, dict) and x.get("endpoint") and isinstance(x.get("keys"), dict)]
        if not subs or not vapid:
            summary["push_no_device"] += 1
            continue
        when = "today" if n == 0 else "tomorrow" if n == 1 else f"in {n} days"
        payload = {"title": f"{str(r['name'])[:80]} renews {when}", "body": f"Charge date: {d.strftime('%d %b')}. Keep it, cancel it, or decide later.",
                   "tag": f"rr-{r.get('id', '')}-{today.isoformat()}", "url": "/#/dashboard"}
        for sub in subs:
            if dry:
                summary["would_push"] = summary.get("would_push", 0) + 1
                continue
            try:
                push({"endpoint": sub["endpoint"], "keys": sub["keys"]}, payload, vapid, env.get("VAPID_SUBJECT", "").strip() or "https://renewal-reminder-one.vercel.app")
                summary["push_sent"] += 1
            except Exception as e:
                code = getattr(getattr(e, "response", None), "status_code", None)
                print(f"[daily] push failed for user {uid[:6]}…: {code or type(e).__name__}")  # 404/410 = device unsubscribed
                summary["push_failed"] += 1
    print(f"[daily] {summary}")
    return 200, summary


def authorized(headers, env=None):
    env = os.environ if env is None else env
    secret = env.get("CRON_SECRET", "").strip()
    got = headers.get("Authorization") or headers.get("authorization") or ""
    return bool(secret) and got == f"Bearer {secret}"


class handler(BaseHTTPRequestHandler):
    """Vercel entry point (Vercel Cron sends a GET with the CRON_SECRET)."""

    def do_GET(self):
        if not authorized(self.headers):
            status, out = 401, {"error": "Only the scheduled job can run this."}
        else:
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            status, out = run(dry=q.get("dry") == ["1"])
        body = json.dumps(out).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)
