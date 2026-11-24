# Renewal Reminder — Deployment & Operations Guide

Everything a developer needs to run, deploy, verify and hand over this app — and an honest list of what is still needed before it is a real production product.

- **Live:** https://renewduck.vercel.app (old address `renewal-reminder-one.vercel.app` redirects here)
- **Code:** https://github.com/dashaloook/renewal-reminder
- **Stack:** static front end (React 18 UMD + htm, no build step) · Python serverless functions on Vercel · Firebase Auth + Firestore · Brevo (email) · Web Push (VAPID)

---

## 1. Architecture

```
 Browser (index.html, app.js, …)                       Vercel (renewduck.vercel.app)
 ─────────────────────────────────                     ─────────────────────────────────────────────
 React UI ──── Firebase Auth (Google / email) ───────▶ /__/auth/*  → proxied to Firebase (own sign-in domain)
     │         Firestore: users/{uid} (rules)
     │
     ├── POST /api/send_reminder  (Firebase ID token) ─▶ api/send_reminder.py ──▶ Brevo API ──▶ user's inbox
     │                                                    checks token with Google, sends to the
     │                                                    user's own confirmed address only
     │
     └── sw.js (service worker) ◀── Web Push ◀──────── api/daily_reminders.py  (Vercel Cron, 06:00 UTC)
                                                          reads every user doc with a service account,
                                                          emails "Email" reminders, pushes "Browser" ones
```

| File | Role |
|---|---|
| `index.html` | Loads everything. Script/style URLs carry `?v=<timestamp>` for cache-busting — **bump it on every release** (see §6). |
| `app.js` | The whole UI (React + htm). Routing by hash (`#/dashboard`, `#/reminders`, `#/new`, `#/edit/<id>`, `#/login`, `#/signup`, `#/reset`). |
| `data.js` | Date helpers, demo seed data, analytics, `rollForward`. |
| `cloud.js` | Firebase: sign-in (Google, email), password reset, account deletion, load/save `users/{uid}`, push subscriptions. |
| `api.js` | Browser client for `/api/send_reminder`. |
| `push.js`, `sw.js` | Notification permission, push subscription, service worker that shows pushes and handles clicks. |
| `firebase-config.js` | Public Firebase web config (not a secret). `authDomain` = our domain. |
| `firestore.rules` | Database security rules — **must be published in the Firebase console** after any change. |
| `api/send_reminder.py` | `POST /api/send_reminder` — test email for the signed-in user. Also hosts shared email code. |
| `api/daily_reminders.py` | `GET /api/daily_reminders` — the daily job (Vercel Cron). |
| `vercel.json` | Cron schedule + `/__/auth` proxy rewrites. |
| `requirements.txt` | Python deps for the functions (`google-auth`, `requests`, `pywebpush`). |
| `manifest.webmanifest`, `icons/`, `favicon.ico` | App icon / installable web app. |
| `dev_server.py` | Local server: static files + the same API, reads `.env.local`. Not deployed. |
| `tests/test_api.py` | Server tests (stdlib only). |

---

## 2. Services & accounts

| Service | Used for | Plan | Notes |
|---|---|---|---|
| **GitHub** `dashaloook/renewal-reminder` | Code; every push to `main` deploys | Free | Public repo — never commit secrets. |
| **Vercel** project `renewal-reminder` | Hosting, functions, cron, env vars | Hobby (free) | Domains: `renewduck.vercel.app` (prod), old one redirects. |
| **Firebase** project `renewal-reminder-33e59` | Auth (Google + Email/Password), Firestore (`europe-central2`, Warsaw) | Spark (free) | Authorized domains: `localhost`, `renewduck.vercel.app`, `renewal-reminder-one.vercel.app`. |
| **Google Cloud** (same project) | OAuth client for Google sign-in | — | Redirect URIs include `https://renewduck.vercel.app/__/auth/handler`. |
| **Brevo** | Transactional email (API) | Free (300 emails/day) | Verified sender (a Gmail address). API key "Renewal Reminder 2", restricted to Transactional email. |

Transfer of ownership = invite the new owner to each service (Vercel team member, Firebase project Owner, GitHub collaborator/transfer, Brevo user) **before** removing the old owner.

---

## 3. Environment variables (Vercel → Settings → Environment Variables)

All are type **Secret** (write-only). Locally, the same names go in `.env.local` (git-ignored). Template: `.env.example`.

| Name | Required | What / how to get it | Rotate when |
|---|---|---|---|
| `BREVO_API_KEY` | yes | Brevo → SMTP & API → API keys → Generate. Restricted: *Transactional email = All* only. | Leaked, staff change, yearly. Keys also expire after 1 year / 90 days unused. |
| `BREVO_SENDER` | yes | An address verified in Brevo → Senders. | Changing sender/domain. |
| `FIREBASE_SERVICE_ACCOUNT` | yes (daily job) | Firebase → Project settings → Service accounts → Generate new private key. Paste the **whole JSON**. Delete the downloaded file afterwards. | Leaked, staff change. Revoke old key in Google Cloud → IAM → Service accounts → Keys. |
| `CRON_SECRET` | yes (daily job) | Any long random string (`python3 -c "import secrets;print(secrets.token_urlsafe(32))"`). Vercel Cron sends it automatically. | Leaked. |
| `VAPID_PRIVATE_KEY` | yes (push) | Generate a P-256 key pair (see §5.7). Public half goes into `push.js`. | Only if leaked — rotating forces every user to re-enable notifications. |
| `VAPID_SUBJECT` | optional | `mailto:` or `https:` contact for push services. Default: the site URL. | — |
| `GMAIL_USER` + `GMAIL_APP_PASSWORD` | optional | Send through Gmail SMTP instead of Brevo (takes priority if set). | — |
| `ALLOWED_ORIGIN` | optional | `https://renewduck.vercel.app` — rejects email-API calls from other sites. | — |
| `APP_URL` | optional | Base URL used in email links. Default `https://renewduck.vercel.app`. | Domain change. |
| `FIREBASE_API_KEY` | optional | Overrides the public web key used to verify sign-in tokens. | — |

**Changing a variable does nothing until the next deployment** — redeploy (push a commit, or Vercel → Deployments → Redeploy).

---

## 4. Run locally

```bash
cp .env.example .env.local        # fill in values you need (email works only with BREVO_* or GMAIL_*)
python3 dev_server.py 5174        # http://localhost:5174
python3 -m unittest discover -s tests -v
```
- No build step, no Node required. Python 3.9+.
- `localhost` is an authorized Firebase domain, so Google/email sign-in work locally.
- The daily job needs `pip install -r requirements.txt` only when actually sending push locally.

---

## 5. Deploy from scratch (new environment)

1. **GitHub** — fork/transfer the repo.
2. **Firebase** — create a project → Authentication → enable **Google** and **Email/Password** → Firestore in the region closest to users (we use `europe-central2`) → publish `firestore.rules` (Firestore → Rules → paste → Publish) → copy the web config into `firebase-config.js`.
3. **Vercel** — *Add New → Project* → import the repo → no build settings. Add the env vars from §3. Add your domain under Settings → Domains.
4. **Own sign-in domain** — in `firebase-config.js` set `authDomain` to your domain; keep the `/__/auth` rewrites in `vercel.json` pointing to `<project>.firebaseapp.com`; in **Google Cloud → APIs & Services → Credentials → Web client** add `https://<domain>` (JS origin) and `https://<domain>/__/auth/handler` (redirect URI). Changes take up to ~5 minutes; until then sign-in shows `redirect_uri_mismatch`.
5. **Firebase authorized domains** — Authentication → Settings → Authorized domains → add your domain.
6. **Brevo** — create account → Senders → verify sender → API key (§3).
7. **Push (VAPID)** — generate a key pair:
   ```bash
   pip install cryptography
   python3 -c "from cryptography.hazmat.primitives.asymmetric import ec;from cryptography.hazmat.primitives import serialization as s;import base64;k=ec.generate_private_key(ec.SECP256R1());b=lambda x:base64.urlsafe_b64encode(x).rstrip(b'=').decode();print('PRIVATE',b(k.private_numbers().private_value.to_bytes(32,'big')));print('PUBLIC',b(k.public_key().public_bytes(s.Encoding.X962,s.PublicFormat.UncompressedPoint)))"
   ```
   Private → `VAPID_PRIVATE_KEY` (Vercel). Public → `VAPID_PUBLIC_KEY` constant in `push.js`.
8. **Cron** — `vercel.json` already schedules `/api/daily_reminders` at `0 6 * * *` (06:00 UTC ≈ 08:00 Kyiv). Check it appears in Vercel → Settings → Cron Jobs.
9. Push to `main` → Vercel deploys → run the smoke test (§7).

---

## 6. Release process

1. Make the change; run `python3 -m unittest discover -s tests -v`.
2. **Bump the cache-busting version** in `index.html` (all `?v=` values), otherwise browsers keep old JS/CSS:
   ```bash
   V=$(date +%Y%m%d%H%M) && sed -i '' -E "s#\?v=[0-9]+#?v=$V#g" index.html
   ```
3. If `firestore.rules` changed → publish them in the Firebase console **before** deploying code that depends on them.
4. Commit & push to `main` → Vercel builds automatically (~30 s). Check the commit status: `gh api repos/<owner>/renewal-reminder/commits/<sha>/status --jq .state`.
5. Run the smoke test (§7).
6. **Rollback:** Vercel → Deployments → pick the previous good deployment → *Promote to Production* (instant). Then revert the commit in git.

---

## 7. Smoke test after every deploy (5 minutes)

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://renewduck.vercel.app/                         # 200
curl -s -w '\n' https://renewduck.vercel.app/api/daily_reminders                                  # 401 "Only the scheduled job…"
curl -s -w '\n' -X POST https://renewduck.vercel.app/api/send_reminder -H 'Content-Type: application/json' -d '{}'   # 400
curl -s -w '\n' -H "Authorization: Bearer $CRON_SECRET" 'https://renewduck.vercel.app/api/daily_reminders?dry=1'   # 200 + counts, sends nothing
```
In the browser: demo works · Google sign-in shows `renewduck.vercel.app` · a reminder saves and reloads from the cloud · **Send test email** arrives · **Send test notification** shows.

Daily-job switches (need `CRON_SECRET`): `?dry=1` (report only) · `?only=email` / `?only=push` (run one kind).

---

## 8. Security model (what protects what)

- **Secrets** only in Vercel env vars / `.env.local`; `.gitignore` and `.vercelignore` keep `.env*` out of GitHub and the public site.
- **Firebase web config is public by design.** Protection = Firestore rules (each user can read/write/delete only `users/{own uid}`, fields whitelisted, sizes capped) + authorized domains.
- **Email API** sends only to the caller's own confirmed address (ID token verified with Google), validates and HTML-escapes input, rate-limits 5 per 10 min per user, never returns provider errors to the browser.
- **Daily job** runs only with `CRON_SECRET`; uses a service account read-only; never takes recipients from the database.
- **Account deletion** re-authenticates (Google popup or password), deletes the Firestore doc, then the login.
- **Logs** never contain email addresses or secrets.

---

## 9. Before this is a real product — gaps & recommendations

Ordered by importance. ✅ = done, ⚠️ = needed for real users.

### Email deliverability
- ⚠️ **Own domain + domain authentication.** Today the sender is a Gmail address sent through Brevo, so Gmail can't verify it and often files reminders in Spam. Buy a domain, add it in Brevo → *Senders, domains* and publish **SPF, DKIM and DMARC** records (Google requires SPF *or* DKIM for all senders, and all three for bulk senders; DMARC minimum `p=none`). Then set `BREVO_SENDER=reminders@yourdomain`.
- ⚠️ **Volume:** Brevo Free = **300 emails/day** (no rollover) and adds Brevo branding. Upgrade before you have ~250 daily reminders.
- ✅ Reply-To, plain-text part, `List-Unsubscribe` (mailto). For marketing mail Gmail expects **one-click HTTPS unsubscribe** (RFC 8058); reminders are transactional and exempt, but an in-app "stop emails" link is still good practice.
- Keep user-reported spam under **0.3%** (Google Postmaster Tools).

### Firebase / Google Cloud
- ⚠️ **Separate dev and prod projects** (Firebase launch checklist). Today one project serves both.
- ⚠️ **App Check** (reCAPTCHA Enterprise for web) with enforcement for Firestore and Auth.
- ⚠️ **Restrict the browser API key** in Google Cloud → Credentials (HTTP referrers = your domains; APIs = Identity Toolkit, Firestore, Token Service).
- ⚠️ **Backups:** scheduled backups and point-in-time recovery require the **Blaze** plan (daily/weekly, up to 14 weeks; PITR 7 days). Test a restore.
- ⚠️ **Rules tests** with the Firebase Emulator Suite in CI.
- Email enumeration protection: keep enabled (Auth → Settings).

### Vercel / platform
- ⚠️ **Cron precision on Hobby:** once a day, may run anywhere within the hour (±59 min). Vercel is moving Cron Jobs to "Schedules" — re-check limits. Pro for tighter timing.
- ⚠️ **Function time limit 300 s (Hobby).** The daily job processes users sequentially — at a few thousand users, batch it (paginate users, queue sends) or move to a worker.
- ⚠️ **Security headers** (`vercel.json` → `headers`): `Content-Security-Policy` (scripts from self, unpkg/jsdelivr CDNs, gstatic for Firebase; connect to Firebase/Google APIs), `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `frame-ancestors 'none'`.
- ⚠️ **Pin/self-host front-end libraries** (React, htm from CDNs) or add Subresource Integrity hashes.
- Rate limiting is **in-memory per function instance** (best effort) — use a shared store (e.g. Upstash Redis / Vercel KV) for real abuse protection.
- Turn on 2FA for every owner account (Vercel shows a banner).

### Push notifications
- ✅ VAPID, per-account opt-in, per-device subscriptions (max 5), click opens the reminder, Chrome action buttons.
- ⚠️ **iPhone/iPad:** web push works only for a site **added to the Home Screen** (iOS 16.4+), and permission must be asked from a tap. Add an "Add to Home Screen" guide for iOS users.
- ⚠️ Remove expired subscriptions (push service returns **404/410**) — the job currently only counts them (`push_failed`); it has read-only DB access.
- Safari on Mac shows the site's favicon (cached) instead of the notification icon.

### Legal & privacy (EU data, users in Ukraine/EU)
- ⚠️ **Privacy policy** and **terms** pages (GDPR: what is stored — name, email, reminders, notes, push endpoints; where — Firebase `europe-central2`, Vercel, Brevo; how long; how to delete).
- ✅ Account deletion in-app. ⚠️ Add **data export** (GDPR access/portability).
- ⚠️ Processor agreements (DPA) with Google/Firebase, Vercel, Brevo.
- Cookie banner not needed today (no analytics/ads; Firebase uses storage strictly for sign-in) — required if analytics are added.

### Product / code quality
- ⚠️ **Time zone:** the job uses `Europe/Kyiv` for everyone; store each user's time zone.
- ⚠️ **Currency** fixed to EUR; **language** English only (consider Ukrainian).
- ⚠️ No front-end build/tests: add a bundler (Vite) and E2E tests (Playwright) for sign-up, add reminder, decide, undo, delete account.
- ⚠️ Monitoring: Vercel runtime logs are short-lived — add error tracking (e.g. Sentry) and an uptime check, plus an alert when the daily job reports `failed > 0`.
- `?v=` cache-busting is manual — a build step would hash file names automatically.
- Remove the unused `Icon/note` component from the Figma library if not needed.

---

## 10. QA checklist (manual regression)

**Accounts**
- [ ] Demo: "Try the demo" → onboarding → sample data; no Delete account in menu.
- [ ] Google sign-in (window shows `renewduck.vercel.app`) → data persists after reload and on another device.
- [ ] Create account (2 steps): validation, password rules checklist, duplicate email, confirmation email arrives.
- [ ] Log in with wrong password → clear error; Forgot password → reset email arrives.
- [ ] Delete account: wrong password keeps account; correct → login gone, data gone.

**Reminders**
- [ ] Add: hints only in special states; duplicate warning; past date warning; note saved.
- [ ] Added window shows channel message (email address / browser) and note.
- [ ] List: Name / Category, note (2 lines), status + postponed reason, centred date; text selectable; click opens details.
- [ ] Keep it / I cancelled it / Delete → Undo restores and reopens details when acted from there.
- [ ] Decide later: reason, follow-up date, appears in Unfinished; "N need a decision" opens Unfinished tab.

**Email**
- [ ] Send test email → arrives; subject "Reminder: … renews …"; button opens that reminder.
- [ ] Saving an Email reminder on/after its reminder day sends immediately; daily job does not send it again that day.
- [ ] Unconfirmed email account → "Confirm your email first".

**Notifications**
- [ ] New account: Allow notifications shown even if browser allowed before; after allow → "You're all set".
- [ ] Blocked site → explanation, no button.
- [ ] Test notification shows; click opens the reminder; Chrome shows Keep it / Decide later.

**Layout & accessibility**
- [ ] 1440px, ~1100px and 375px widths; no horizontal scroll; services dropdown scroll doesn't move the page.
- [ ] Keyboard only: Tab through forms, Esc closes menus/dialogs, focus visible.
- [ ] Safari, Chrome, Firefox (desktop); Safari iOS; Chrome Android.

---

## 11. Incident playbook

- **A secret leaked** → create a new one at the provider → update the Vercel env var → redeploy → verify (smoke test) → delete/revoke the old one. (Done once for `BREVO_API_KEY` on 24 Nov 2026.)
- **Sign-in broken after a domain change** (`redirect_uri_mismatch`) → temporarily set `authDomain` back to `<project>.firebaseapp.com`, redeploy, then fix the Google Cloud redirect URI and wait ~5 min.
- **Emails not arriving** → Brevo → Transactional → Logs (Sent/Delivered/Blocked) · Vercel → Logs, search `[send_reminder]` / `[daily]` / `[mail]` · check daily quota (300).
- **Daily job failed** → run `?dry=1` with `CRON_SECRET` to see counts; check `FIREBASE_SERVICE_ACCOUNT` and `BREVO_*`.

---

## Sources

- Firebase launch checklist — https://firebase.google.com/support/guides/launch-checklist
- Firebase security checklist — https://firebase.google.com/support/guides/security-checklist
- Firestore backups & PITR — https://firebase.google.com/docs/firestore/backups · https://firebase.google.com/docs/firestore/disaster-recovery
- Vercel production checklist — https://vercel.com/docs/production-checklist
- Vercel cron usage & limits — https://vercel.com/docs/cron-jobs/usage-and-pricing · https://vercel.com/docs/schedules/limits
- Vercel Hobby plan & function limits — https://vercel.com/docs/plans/hobby · https://vercel.com/docs/functions/limitations
- Google email sender guidelines (SPF/DKIM/DMARC, unsubscribe, 0.3% spam) — https://support.google.com/a/answer/81126 · https://support.google.com/a/answer/14229414
- Brevo free plan limits — https://help.brevo.com/hc/en-us/articles/208580669
- Apple: web push in web apps & browsers — https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers
- WebKit: Web Push for Web Apps on iOS and iPadOS — https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- OWASP Secure Headers Project — https://owasp.org/www-project-secure-headers/
