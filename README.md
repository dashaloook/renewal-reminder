# Renewal Reminder

**Live:** https://renewduck.vercel.app · **Code:** https://github.com/dashaloook/renewal-reminder

> Deploying, operating or taking over this app? Start with **[DEPLOY.md](DEPLOY.md)** — setup from scratch, environment variables, release & rollback, smoke tests, security model, QA checklist and what's still needed for production.

A browser app that helps you decide about subscriptions and other renewals before you're charged: keep it, cancel it, or decide later with a reason, and get reminded again.

Coursework prototype. Reminders are stored in your browser (`localStorage`); there is no database. The **email reminder** is real: it goes through our own serverless API to the email service [Brevo](https://www.brevo.com).

## Features

- **Dashboard** with upcoming charges, monthly spend and **Unfinished decisions** (renewals you postponed with a reason).
- **Reminders list** with filters and list/calendar views.
- **Add / edit a reminder**: search popular services as you type (e.g. `S` → Spotify), each with a real service link; custom date picker; "Remind me" options that adapt to the date (options that don't fit are disabled, "On the day" when the charge is today).
- **Decide later** with a reason and a new reminder date.
- **Email reminder (API)**: open a reminder → **Send test email** sends you the reminder email for real.
- Empty, loading and error states.

## Accounts

| How you sign in | What you get |
|---|---|
| **Continue with Google** (main way, real) | Your own account: reminders are saved in the cloud (Firestore) and follow you to any device. Onboarding only on the first login |
| **Create account** (real), in two steps | 1) **Continue with Google**, or enter name and email and press **Continue**. 2) **Create your password** for that email: a live checklist shows the rules (8+ characters, an uppercase letter, a lowercase letter, a number); **Not you?** goes back. Firebase then emails a link to confirm the address (needed for reminder emails) |
| **Log in** with email and password (real) | Opens your saved account. A wrong password shows “Email or password is wrong” |
| **Forgot password?** | Firebase emails a link to choose a new password. The screen never says whether an account exists, so nobody can check other people's emails |
| **Try the demo without signing up** | Sample data stored only in this browser; onboarding every time (unchanged) |

**Log out** signs you out of a real account and removes its reminders from that browser.

**Delete account** (profile menu, real accounts only) permanently removes the account. A confirm window lists what goes (reminders with notes and history, reminder emails and notifications, the login) and reminds you that subscriptions themselves aren't cancelled. To make sure it's really the owner, Google accounts choose their Google account again and email accounts enter their password. The app then deletes the user's database document (allowed by the rules only for the signed-in owner) and finally the login itself. A wrong password or a closed Google window deletes nothing.

## How it's built

| File | What it is |
|---|---|
| `index.html` | Entry page; loads React 18, htm (from unpkg), the API client and the app |
| `app.js` | The app: screens, routing (`#/dashboard`, `#/reminders`, `#/new`, `#/edit/:id`), state |
| `data.js` | Popular services (with links) and demo data |
| `styles.css` | Styles |
| `firebase-config.js` | Firebase project settings (public by design, not a secret) |
| `cloud.js` | Google and email sign-in, password reset, and saving each user's reminders in Firestore |
| `firestore.rules` | Database rules: each user can only read and write their own data |
| `api.js` | Browser API client: calls only our own function `/api/send_reminder` |
| `api/send_reminder.py` | Serverless function (Vercel, Python) that checks the request and sends the email through Brevo |
| `dev_server.py` | Local server: the app plus the same function, with secrets from `.env.local` |
| `duck-wave.png`, `duck-empty.png` | Mascot illustrations |
| `icons/`, `favicon.ico`, `manifest.webmanifest` | App icon (the duck on lavender) for the browser tab, notifications and Add to Dock / Home Screen |

No build step.

```
Browser ──POST /api/send_reminder──▶ our function ──(BREVO_API_KEY)──▶ Brevo ──▶ the user's own inbox
  (reminder + Google sign-in token)    checks the token with Google,
                                       takes the email from it, builds email
```

## Automatic reminder emails

Every morning at 08:00 Kyiv time (06:00 UTC) **Vercel Cron** runs `api/daily_reminders.py` (schedule in `vercel.json`). It:

1. reads every user's reminders from Firestore,
2. picks the ones set to **Remind me … by Email** that are due today: exactly *N days before* the charge date (as chosen in the form), or a postponed reminder whose follow-up date is today; cancelled ones are skipped, monthly/yearly dates roll forward like in the app,
3. sends each one to that user's **own confirmed address** from Firebase Authentication, through Brevo.

Each reminder is emailed or pushed **at most once per day**: before sending, the server atomically creates a `sent` record (only the server can access these). A second or overlapping job run, or the email-on-save, finds it and skips.

If you save a reminder set to **Email** on or after its reminder day (after the 08:00 run), the app sends it right away and marks it (`emailedOn`), so the job doesn't send it twice that day. The **Open this reminder** button in every email links to `/?open=<id>&act=open`, which opens that reminder's details (after sign-in if needed).

Security: only Vercel can start the job (it sends `CRON_SECRET`; other requests get 401). The job reads the database with a Firebase service-account key stored only in Vercel (`FIREBASE_SERVICE_ACCOUNT`, Secret), never in the code, GitHub or the browser. It only reads, never writes, and never takes the recipient from the database (users could edit that). Errors are logged without email addresses.

**Which service sends the email:** [Brevo](https://www.brevo.com) (`BREVO_API_KEY` + `BREVO_SENDER`). Its free plan sends 300 emails a day to **every user's own address** without owning a domain; the sender address only has to be confirmed in Brevo. Optionally Gmail can send instead (`GMAIL_USER` + a Google App Password in `GMAIL_APP_PASSWORD`).

*Why not Resend:* the first version used Resend. Its free plan only delivers to the Resend account owner unless you verify your own domain, so other users never got their emails. I moved to Brevo, which only needed a new send function on the server; the app itself didn't change.

## Browser notifications (push)

**Turn on notifications** (dashboard banner, the form, or a reminder's details) asks the browser for permission, registers a service worker (`sw.js`) and creates a push subscription (`push.js`). For real accounts the subscription is saved in the user's own Firestore document (`push`, at most 5 devices).

- **On the reminder day** the daily job sends a push to each of the user's devices for reminders set to **Browser**. The browser shows it even when the app is closed; clicking it opens the dashboard.
- **While the app is open** it also shows today's browser reminders itself (once a day per reminder), which is how demo accounts get them.
- **Send test notification** in a reminder's details shows one immediately.
- **Acting on a notification:** clicking it opens the app on that reminder, with **Keep it / I cancelled it / Decide later**. Chrome and Edge also show two buttons inside the notification: **Keep it** (marks it kept, with Undo) and **Decide later** (opens the postpone dialog). Safari on Mac doesn't support buttons in website notifications, so there you click the notification. "I cancelled it" always happens in the app, because you first cancel on the service's own site.

Security: pushes are signed with a VAPID key pair. The public key is in `push.js` (public by design); the private key is only in Vercel (`VAPID_PRIVATE_KEY`, Secret) and `.env.local`. The database rules only let a user write their own `push` list.

## Success messages

After saving a reminder, the confirmation says exactly where it will go: *"We'll email **you@gmail.com** on 1 Dec"*, or *"This browser will show a notification on 1 Dec"*. If that can't work yet (demo account for email, notifications off), it says so and offers the fix.

## Why emails can land in Spam

Brevo sends "on behalf of" a `@gmail.com` address from its own servers, so Gmail can't confirm the email really came from Gmail and treats it with suspicion. The emails are written to avoid other spam signals: a personal greeting, no "demo" wording, a plain-text version, a reply-to address, an unsubscribe header and a clear "why you get this" line. Marking one email **Not spam** teaches Gmail. The full fix is sending from your own domain with DKIM/DMARC set up in Brevo.

## Run locally

1. Copy `.env.example` to `.env.local` and fill in `BREVO_API_KEY` and `BREVO_SENDER`.
2. Run `python3 dev_server.py` and open http://localhost:5173

Without `.env.local` everything works except email: the button explains that email isn't set up. For testing, `?state=empty|loading|error` in the URL forces a state.

## Deploy (Vercel)

Import the repository in Vercel (**Add New → Project**), no build settings needed. Every push to `main` redeploys.

In **Settings → Environment Variables** add `BREVO_API_KEY` and `BREVO_SENDER` as **Secret** (optionally `ALLOWED_ORIGIN` = the site URL), then redeploy.

## Security: how the key is protected

- **The key lives only in environment variables**: `.env.local` on my computer and Vercel's encrypted Secret variables online. It is not in any code file.
- **It never reaches GitHub**: `.gitignore` excludes `.env`, `.env.local` and `.env.*.local`. The repository only has `.env.example` with empty values, so others know which variables to set.
- **It never reaches the browser**: only the server functions read `BREVO_API_KEY`. The browser calls `/api/send_reminder`; the key isn't in the page source, `app.js` or network requests.
- **Each person gets only their own emails**: the email button exists only for real accounts (Google or email). The browser sends its Firebase sign-in token; the server asks Google who it belongs to and sends to that confirmed address (email accounts must open the confirmation link first). The browser can't choose the recipient, so the endpoint can't be used to email strangers, and one user never receives another user's reminders. Demo accounts don't get emails.
- **Input is checked**: name length, date format, amount range and request size are validated; text is HTML-escaped before it goes into the email.
- **Abuse is slowed down**: 5 emails per 10 minutes per user, and optionally only requests from my own site (`ALLOWED_ORIGIN`).
- **Errors don't leak details**: the email service's error replies are logged on the server; the browser gets a short message.
- **Private files aren't served**: `.vercelignore` keeps `dev_server.py` and env files off the public site.
- **If a key ever leaks**: revoke it in Brevo, create a new one, and update it in Vercel.

### Accounts and the database (Firebase)

- **Real sign-in** (Google, or email + password) goes through Firebase Authentication. The app never sees the Google password, and email passwords are stored by Firebase (hashed), never in our code or database. New passwords need at least 8 characters with an uppercase letter, a lowercase letter and a number (checked in the app); Firebase slows down repeated wrong attempts.
- **The Firebase config is public on purpose.** Unlike the Brevo key, it isn't a secret: it only names the project. Security comes from two other places:
  - **Database rules** (`firestore.rules`, published in Firebase): a signed-in user can read and write only `users/{their own id}` and the reminder records under it; every reminder record is checked (owner, allowed fields, sizes). Everyone else is refused.
- **One record per reminder** (`users/{uid}/reminders/{id}`): each device writes only the reminders it changed and deletes only the ones removed on it, so two devices never overwrite each other's edits; changes from other devices appear live. Accounts saved in the old all-in-one format are moved automatically on their next login.
  - **Authorized domains**: sign-in only works on `localhost` and the live Vercel site.
  - **Own sign-in address**: Google's sign-in window shows `renewduck.vercel.app`, not Firebase's default address. `vercel.json` passes `/__/auth/*` through to Firebase, and that address is registered as a redirect URI for the Google OAuth client.
- **Logging out** removes the user's reminders from the browser, so the next person on the same computer can't see them.
- Data is stored in Firestore in Warsaw (`europe-central2`), the closest Google location to Ukraine.

Known limits: the rate limit is kept in one server instance's memory, so it's best-effort; demo reminders are stored only in the browser.
