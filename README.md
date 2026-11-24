# Renewal Reminder

**Live:** https://renewal-reminder-one.vercel.app · **Code:** https://github.com/dashaloook/renewal-reminder

A browser app that helps you decide about subscriptions and other renewals before you're charged: keep it, cancel it, or decide later with a reason, and get reminded again.

Coursework prototype. Reminders are stored in your browser (`localStorage`); there is no database. The **email reminder** is real: it goes through our own serverless API to the email service [Resend](https://resend.com).

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
| `api/send_reminder.py` | Serverless function (Vercel, Python) that checks the request and sends the email through Resend |
| `dev_server.py` | Local server: the app plus the same function, with secrets from `.env.local` |
| `duck-wave.png`, `duck-empty.png` | Mascot illustrations |

No build step.

```
Browser ──POST /api/send_reminder──▶ our function ──(RESEND_API_KEY)──▶ Resend ──▶ the user's own inbox
  (reminder + Google sign-in token)    checks the token with Google,
                                       takes the email from it, builds email
```

## Automatic reminder emails

Every morning at 08:00 Kyiv time (06:00 UTC) **Vercel Cron** runs `api/daily_reminders.py` (schedule in `vercel.json`). It:

1. reads every user's reminders from Firestore,
2. picks the ones set to **Remind me … by Email** that are due today: exactly *N days before* the charge date (as chosen in the form), or a postponed reminder whose follow-up date is today; cancelled ones are skipped, monthly/yearly dates roll forward like in the app,
3. sends each one to that user's **own confirmed address** from Firebase Authentication, through Resend.

Security: only Vercel can start the job (it sends `CRON_SECRET`; other requests get 401). The job reads the database with a Firebase service-account key stored only in Vercel (`FIREBASE_SERVICE_ACCOUNT`, Secret), never in the code, GitHub or the browser. It only reads, never writes, and never takes the recipient from the database (users could edit that). Errors are logged without email addresses.

**Which service sends the email:** if `GMAIL_USER` and `GMAIL_APP_PASSWORD` are set in Vercel, emails go out through Gmail (SMTP with a Google App Password, not the real Gmail password). Gmail delivers to **every user's own address**, free, up to about 500 emails a day, so different people each get their own reminders. Otherwise the server falls back to Resend, whose free plan only reaches the Resend account owner until a domain is verified.

## Run locally

1. Copy `.env.example` to `.env.local` and fill in `RESEND_API_KEY`.
2. Run `python3 dev_server.py` and open http://localhost:5173

Without `.env.local` everything works except email: the button explains that email isn't set up. For testing, `?state=empty|loading|error` in the URL forces a state.

## Deploy (Vercel)

Import the repository in Vercel (**Add New → Project**), no build settings needed. Every push to `main` redeploys.

In **Settings → Environment Variables** add `RESEND_API_KEY` as **Secret** (optionally `ALLOWED_ORIGIN` = the site URL), then redeploy.

## Security: how the key is protected

- **The key lives only in environment variables**: `.env.local` on my computer and Vercel's encrypted Secret variables online. It is not in any code file.
- **It never reaches GitHub**: `.gitignore` excludes `.env`, `.env.local` and `.env.*.local`. The repository only has `.env.example` with empty values, so others know which variables to set.
- **It never reaches the browser**: only the server function reads `RESEND_API_KEY`. The browser calls `/api/send_reminder`; the key isn't in the page source, `app.js` or network requests.
- **Each person gets only their own emails**: the email button exists only for real accounts (Google or email). The browser sends its Firebase sign-in token; the server asks Google who it belongs to and sends to that confirmed address (email accounts must open the confirmation link first). The browser can't choose the recipient, so the endpoint can't be used to email strangers, and one user never receives another user's reminders. Demo accounts don't get emails.
- **Free-plan limit**: with Resend only, the free test sender (`onboarding@resend.dev`) only delivers to the Resend account owner; sending through Gmail (`GMAIL_USER` + `GMAIL_APP_PASSWORD`) removes this. To email every user, verify a domain in Resend and set `RESEND_FROM` (e.g. `Renewal Reminder <hi@yourdomain.com>`). Until then, other users see a clear message instead of an email.
- **Input is checked**: name length, date format, amount range and request size are validated; text is HTML-escaped before it goes into the email.
- **Abuse is slowed down**: 5 emails per 10 minutes per user, and optionally only requests from my own site (`ALLOWED_ORIGIN`).
- **Errors don't leak details**: the email service's error replies are logged on the server; the browser gets a short message.
- **Private files aren't served**: `.vercelignore` keeps `dev_server.py` and env files off the public site.
- **If a key ever leaks**: revoke it in Resend, create a new one, and update it in Vercel.

### Accounts and the database (Firebase)

- **Real sign-in** (Google, or email + password) goes through Firebase Authentication. The app never sees the Google password, and email passwords are stored by Firebase (hashed), never in our code or database. New passwords need at least 8 characters with an uppercase letter, a lowercase letter and a number (checked in the app); Firebase slows down repeated wrong attempts.
- **The Firebase config is public on purpose.** Unlike the Resend key, it isn't a secret: it only names the project. Security comes from two other places:
  - **Database rules** (`firestore.rules`, published in Firebase): a signed-in user can read and write only `users/{their own id}`; everyone else is refused. Checked: an anonymous read or write gets `permission-denied`.
  - **Authorized domains**: sign-in only works on `localhost` and the live Vercel site.
- **Logging out** removes the user's reminders from the browser, so the next person on the same computer can't see them.
- Data is stored in Firestore in Warsaw (`europe-central2`), the closest Google location to Ukraine.

Known limits: the rate limit is kept in one server instance's memory, so it's best-effort; demo reminders are stored only in the browser.
