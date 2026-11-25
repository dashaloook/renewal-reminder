"""Server tests for Renewal Reminder — run with:  python3 -m unittest discover -s tests -v

Uses only the standard library. Nothing real is sent: email, Google sign-in checks,
the database and push are all replaced with fakes.
"""
import datetime as dt
import io
import json
import os
import sys
import unittest
import urllib.error

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))
import send_reminder as s  # noqa: E402
import daily_reminders as d  # noqa: E402

BODY = json.dumps({"reminder": {"id": "netflix", "name": "Netflix", "date": "2026-11-30", "amount": 15.49, "cycle": "monthly", "daysLeft": 6}}).encode()
USER = {"localId": "u1", "email": "user@example.com", "emailVerified": True}
BREVO = {"BREVO_API_KEY": "test-key", "BREVO_SENDER": "sender@example.com"}


def post(env=None, headers=None, body=BODY, lookup=lambda k, t: USER, sender=None, ip="1.1.1.1"):
    s._hits.clear()
    sent = []
    fake = sender or (lambda *a: sent.append(a) or {"id": "m1"})
    status, out = s.process("POST", headers if headers is not None else {"Authorization": "Bearer token"}, body, ip,
                            env=BREVO if env is None else env, sender_fn=fake, lookup_fn=lookup)
    return status, out, sent


class SendReminderTests(unittest.TestCase):
    def test_sends_to_the_signed_in_users_own_address(self):
        status, out, sent = post()
        self.assertEqual(status, 200)
        self.assertEqual(out["to"], "user@example.com")
        self.assertEqual(sent[0][2], "user@example.com")

    def test_requires_sign_in(self):
        self.assertEqual(post(headers={})[0], 401)

    def test_rejects_expired_or_forged_token(self):
        self.assertEqual(post(lookup=lambda k, t: None)[0], 401)

    def test_requires_confirmed_email(self):
        status, out, _ = post(lookup=lambda k, t: dict(USER, emailVerified=False))
        self.assertEqual((status, out.get("code")), (403, "unverified"))

    def test_not_configured_without_email_service(self):
        self.assertEqual(post(env={})[1].get("code"), "not_configured")

    def test_input_validation(self):
        bad = [{"reminder": {"name": "", "date": "2026-11-30"}},
               {"reminder": {"name": "X", "date": "30/11/2026"}},
               {"reminder": {"name": "X", "date": "2026-11-30", "amount": -1}},
               {"reminder": {"name": "X", "date": "2026-11-30", "cycle": "daily"}},
               {"reminder": {"id": "bad id<script>", "name": "X", "date": "2026-11-30"}}]
        for b in bad:
            self.assertEqual(post(body=json.dumps(b).encode())[0], 400, b)

    def test_rejects_large_body_and_wrong_method(self):
        self.assertEqual(post(body=b"x" * 5000)[0], 413)
        self.assertEqual(s.process("GET", {}, b"", "1", env=BREVO)[0], 405)

    def test_rate_limit_per_user(self):
        s._hits.clear()
        codes = [s.process("POST", {"Authorization": "Bearer t"}, BODY, "1", env=BREVO,
                           sender_fn=lambda *a: {}, lookup_fn=lambda k, t: USER)[0] for _ in range(6)]
        self.assertEqual(codes[:5], [200] * 5)
        self.assertEqual(codes[5], 429)

    def test_email_service_errors_are_safe(self):
        def fail(*a):
            raise urllib.error.HTTPError("https://api.brevo.com/v3/smtp/email", 401, "", {}, io.BytesIO(b'{"message":"Key not found"}'))
        status, out, _ = post(sender=fail)
        self.assertEqual(status, 502)
        self.assertNotIn("Key not found", out["error"])  # raw provider errors stay in the server log

    def test_channel_choice(self):
        self.assertEqual(s.mail_channel(BREVO)[3], "brevo")
        self.assertEqual(s.mail_channel({**BREVO, "GMAIL_USER": "a@b.c", "GMAIL_APP_PASSWORD": "x"})[3], "gmail")
        self.assertIsNone(s.mail_channel({}))


class EmailContentTests(unittest.TestCase):
    def test_subject_text_and_link(self):
        subject, text, html = s.build_email({"id": "netflix", "name": "Netflix", "date": "2026-11-30", "amount": 15.49, "cycle": "monthly", "daysLeft": 6})
        self.assertEqual(subject, "Reminder: Netflix renews in 6 days (30 Nov 2026)")
        self.assertIn("?open=netflix&act=open", text)
        self.assertIn("&amp;act=open", html)
        self.assertNotIn("demo", text.lower())

    def test_html_is_escaped(self):
        _, _, html = s.build_email({"name": "<script>x</script>", "date": "2026-11-30", "amount": 0, "cycle": "monthly", "daysLeft": 1})
        self.assertNotIn("<script>", html)


def R(**k):
    return {"id": "x", "name": "N", "date": "2026-12-01", "cycle": "monthly", "remind": 7, "channel": "email", "status": "active", "amount": 5, **k}


class DailyJobTests(unittest.TestCase):
    T = dt.date(2026, 11, 24)

    def test_due_rules(self):
        self.assertTrue(d.due_today(R(), self.T)[0])                                   # exactly 7 days before
        self.assertFalse(d.due_today(R(date="2026-11-30"), self.T)[0])                 # 6 days before
        self.assertFalse(d.due_today(R(status="cancelled"), self.T)[0])
        self.assertTrue(d.due_today(R(date="2026-11-24", remind=0), self.T)[0])         # on the day
        self.assertTrue(d.due_today(R(date="2026-10-01"), self.T)[0])                   # monthly rolls forward
        self.assertTrue(d.due_today(R(date="2025-12-01", cycle="yearly"), self.T)[0])   # yearly rolls forward
        self.assertTrue(d.due_today(R(date="2026-12-20", status="unfinished", followUp="2026-11-24"), self.T)[0])
        self.assertFalse(d.due_today(R(date="nope"), self.T)[0])

    def run_job(self, users, **kw):
        sent, pushed = [], []
        env = {**BREVO, "FIREBASE_SERVICE_ACCOUNT": "{}", "VAPID_PRIVATE_KEY": "k"}
        status, out = d.run(env=env, today=self.T, load_fn=lambda: users, lookup_fn=lambda ids: {"a": "a@x", "b": "b@x"},
                            send_fn=lambda *a: sent.append(a[2]), push_fn=lambda sub, p, k, subj: pushed.append(sub["endpoint"]), **kw)
        return out, sent, pushed

    def test_email_and_push_split(self):
        sub = {"endpoint": "https://push/1", "keys": {"p256dh": "a", "auth": "b"}}
        out, sent, pushed = self.run_job([("a", [R(id="e"), R(id="b", channel="browser")], [sub]), ("b", [R(channel="browser")], [])])
        self.assertEqual((out["sent"], out["push_sent"], out["push_no_device"]), (1, 1, 1))
        self.assertEqual(sent, ["a@x"])
        self.assertEqual(pushed, ["https://push/1"])

    def test_skips_reminders_already_emailed_today(self):
        out, sent, _ = self.run_job([("a", [R(id="1", emailedOn="2026-11-24"), R(id="2")], [])])
        self.assertEqual(out["sent"], 1)

    def test_dry_run_and_only(self):
        out, sent, _ = self.run_job([("a", [R()], [])], dry=True)
        self.assertEqual((out["would_send"], sent), (1, []))
        out, sent, _ = self.run_job([("a", [R()], [])], only="push")
        self.assertEqual(sent, [])

    def test_job_requires_secret(self):
        self.assertFalse(d.authorized({}, {"CRON_SECRET": "s"}))
        self.assertFalse(d.authorized({"Authorization": "Bearer "}, {}))
        self.assertTrue(d.authorized({"Authorization": "Bearer s"}, {"CRON_SECRET": "s"}))

    def test_notification_copy(self):
        self.assertEqual(d.notif_copy({"name": "Disney+", "amount": 9.99, "cycle": "monthly"}, 0),
                         ("Disney+ renews today", "Still worth €9.99 a month? Decide before you’re charged."))
        self.assertEqual(d.notif_copy({"name": "Passport", "category": "document"}, 30)[0], "Passport expires in 30 days")
        self.assertEqual(d.notif_copy({"name": "Netflix"}, 3, follow_up=True)[0], "Time to decide on Netflix")

    def test_merge_old_and_new_formats(self):
        profiles = {"a": {"reminders": [R(id="old"), R(id="both", name="Old name")], "push": ["p"]}, "c": {}}
        docs = [("a", R(id="both", name="New name")), ("b", R(id="only-new"))]
        merged = {uid: (sorted(r["id"] for r in rs), {r["id"]: r["name"] for r in rs}, push) for uid, rs, push in d.merge_users(profiles, docs)}
        self.assertEqual(merged["a"][0], ["both", "old"])
        self.assertEqual(merged["a"][1]["both"], "New name")      # per-reminder record wins
        self.assertEqual(merged["a"][2], ["p"])
        self.assertEqual(merged["b"][0], ["only-new"])             # reminders without a profile doc still count
        self.assertEqual(merged["c"][0], [])

    def test_load_users_pages_through_reminder_records(self):
        root = "projects/p/databases/(default)/documents"
        def doc(uid, rid):
            return {"document": {"name": f"{root}/users/{uid}/reminders/{rid}", "fields": {"id": {"stringValue": rid}, "name": {"stringValue": rid}}}}
        pages = [[doc("u1", f"r{i:03d}") for i in range(500)], [doc("u2", "x")]]
        calls = []
        def fake_call(url, token, body=None):
            calls.append(body)
            if body is None:
                return {"documents": [{"name": f"{root}/users/u1", "fields": {"push": {"arrayValue": {}}}}]}
            return pages[len([c for c in calls if c]) - 1]
        real, d._call = d._call, fake_call
        try:
            users = dict((u, rs) for u, rs, _ in d.load_users({"project_id": "p"}, "t"))
        finally:
            d._call = real
        self.assertEqual(len(users["u1"]), 500)
        self.assertEqual([r["id"] for r in users["u2"]], ["x"])
        self.assertIn("startAt", [c for c in calls if c][1]["structuredQuery"])   # 2nd page continues after the 1st

    def test_firestore_value_decoding(self):
        v = {"mapValue": {"fields": {"a": {"integerValue": "7"}, "b": {"arrayValue": {"values": [{"stringValue": "x"}]}}}}}
        self.assertEqual(d.decode(v), {"a": 7, "b": ["x"]})


class FakeLedger:
    """In-memory stand-in for the Firestore `sent` records (create-if-absent is atomic, like Firestore)."""
    def __init__(self, broken=False):
        self.keys, self.broken = set(), broken

    def claim(self, key, info):
        if self.broken:
            raise OSError("database unavailable")
        if key in self.keys:
            return False
        self.keys.add(key)
        return True

    def release(self, key):
        self.keys.discard(key)

    def exists(self, key):
        return key in self.keys


class NoDuplicateTests(unittest.TestCase):
    T = dt.date(2026, 11, 24)
    ENV = {**BREVO, "FIREBASE_SERVICE_ACCOUNT": "{}", "VAPID_PRIVATE_KEY": "k"}

    def job(self, ledger, users, send=None, push=None, **kw):
        sent, pushed = [], []
        status, out = d.run(env=self.ENV, today=self.T, load_fn=lambda: users, lookup_fn=lambda ids: {"a": "a@x"},
                            send_fn=send or (lambda *a: sent.append(a[2])), push_fn=push or (lambda sub, *a: pushed.append(sub["endpoint"])),
                            ledger=ledger, **kw)
        return out, sent, pushed

    def test_running_the_job_twice_sends_once(self):
        ledger, users = FakeLedger(), [("a", [R(id="e")], [])]
        first, sent1, _ = self.job(ledger, users)
        second, sent2, _ = self.job(ledger, users)
        self.assertEqual((first["sent"], len(sent1)), (1, 1))
        self.assertEqual((second["sent"], second["already_sent"], sent2), (0, 1, []))

    def test_failed_send_is_retried_next_run(self):
        ledger, users = FakeLedger(), [("a", [R(id="e")], [])]
        def boom(*a):
            raise OSError("smtp down")
        out, _, _ = self.job(ledger, users, send=boom)
        self.assertEqual(out["failed"], 1)
        out, sent, _ = self.job(ledger, users)
        self.assertEqual((out["sent"], sent), (1, ["a@x"]))

    def test_push_once_and_retry_when_no_device_got_it(self):
        sub = {"endpoint": "https://push/1", "keys": {"p256dh": "a", "auth": "b"}}
        ledger, users = FakeLedger(), [("a", [R(id="p", channel="browser")], [sub])]
        def fail(*a):
            raise OSError("gone")
        out, _, _ = self.job(ledger, users, push=fail)
        self.assertEqual(out["push_failed"], 1)
        out, _, pushed = self.job(ledger, users)
        self.assertEqual(pushed, ["https://push/1"])
        out, _, pushed = self.job(ledger, users)
        self.assertEqual((pushed, out["already_sent"]), ([], 1))

    def test_dry_run_reports_already_sent_and_claims_nothing(self):
        ledger, users = FakeLedger(), [("a", [R(id="e")], [])]
        out, _, _ = self.job(ledger, users, dry=True)
        self.assertEqual((out.get("would_send"), ledger.keys), (1, set()))
        self.job(ledger, users)
        out, _, _ = self.job(ledger, users, dry=True)
        self.assertEqual((out["already_sent"], out.get("would_send")), (1, None))

    def test_records_unavailable_means_no_send(self):
        out, sent, _ = self.job(FakeLedger(broken=True), [("a", [R(id="e")], [])])
        self.assertEqual((out["failed"], sent), (1, []))


class SaveEmailNoDuplicateTests(unittest.TestCase):
    DUE = json.dumps({"due": True, "reminder": {"id": "netflix", "name": "Netflix", "date": "2026-11-30", "amount": 1, "cycle": "monthly", "daysLeft": 0}}).encode()

    def call(self, ledger, body=None, sender=None):
        s._hits.clear()
        sent = []
        status, out = s.process("POST", {"Authorization": "Bearer t"}, body or self.DUE, "1", env=BREVO,
                                sender_fn=sender or (lambda *a: sent.append(a[2]) or {"id": "m"}), lookup_fn=lambda k, t: USER, ledger=ledger)
        return status, out, sent

    def test_saving_twice_emails_once(self):
        ledger = FakeLedger()
        self.assertEqual(self.call(ledger)[2], ["user@example.com"])
        status, out, sent = self.call(ledger)
        self.assertEqual((status, out.get("already"), sent), (200, True, []))

    def test_job_and_save_share_the_same_record(self):
        ledger = FakeLedger()
        ledger.claim(s.sent_key("u1", "netflix", s.today_kyiv().isoformat(), "email"), {})
        self.assertEqual(self.call(ledger)[1].get("already"), True)

    def test_failed_send_releases_the_record(self):
        ledger = FakeLedger()
        def boom(*a):
            raise OSError("down")
        self.assertEqual(self.call(ledger, sender=boom)[0], 502)
        self.assertEqual(ledger.keys, set())

    def test_test_emails_are_not_limited(self):
        ledger, test = FakeLedger(), json.dumps({"reminder": {"id": "netflix", "name": "Netflix", "date": "2026-11-30"}}).encode()
        self.assertEqual(len(self.call(ledger, test)[2]) + len(self.call(ledger, test)[2]), 2)
        self.assertEqual(ledger.keys, set())

    def test_due_must_be_boolean(self):
        bad = json.dumps({"due": "yes", "reminder": {"name": "N", "date": "2026-11-30"}}).encode()
        self.assertEqual(self.call(FakeLedger(), bad)[0], 400)


if __name__ == "__main__":
    unittest.main()
