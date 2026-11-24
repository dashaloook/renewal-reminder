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
| **Try the demo** or `alex@example.com` | Sample data; onboarding every time |
| Any other email, or **Continue with Google** (simulated) | Empty account: no reminders or stats until you add them. Onboarding only on the first login |

Any password works. Use the password `wrong` to see the login error state.

## How it's built

| File | What it is |
|---|---|
| `index.html` | Entry page; loads React 18, htm (from unpkg), the API client and the app |
| `app.js` | The app: screens, routing (`#/dashboard`, `#/reminders`, `#/new`, `#/edit/:id`), state |
| `data.js` | Popular services (with links) and demo data |
| `styles.css` | Styles |
| `api.js` | Browser API client: calls only our own function `/api/send_reminder` |
| `api/send_reminder.py` | Serverless function (Vercel, Python) that checks the request and sends the email through Resend |
| `dev_server.py` | Local server: the app plus the same function, with secrets from `.env.local` |
| `duck-wave.png`, `duck-empty.png` | Mascot illustrations |

No build step.

```
Browser ──POST /api/send_reminder──▶ our function ──(RESEND_API_KEY)──▶ Resend ──▶ inbox
          (name, date, amount)        validates, builds email
```

## Run locally

1. Copy `.env.example` to `.env.local` and fill in `RESEND_API_KEY` and `REMINDER_TO_EMAIL`.
2. Run `python3 dev_server.py` and open http://localhost:5173

Without `.env.local` everything works except email: the button explains that email isn't set up. For testing, `?state=empty|loading|error` in the URL forces a state.

## Deploy (Vercel)

Import the repository in Vercel (**Add New → Project**), no build settings needed. Every push to `main` redeploys.

In **Settings → Environment Variables** add `RESEND_API_KEY` and `REMINDER_TO_EMAIL` as **Secret** (optionally `ALLOWED_ORIGIN` = the site URL), then redeploy.

## Security: how the key is protected

- **The key lives only in environment variables**: `.env.local` on my computer and Vercel's encrypted Secret variables online. It is not in any code file.
- **It never reaches GitHub**: `.gitignore` excludes `.env`, `.env.local` and `.env.*.local`. The repository only has `.env.example` with empty values, so others know which variables to set.
- **It never reaches the browser**: only the server function reads `RESEND_API_KEY`. The browser calls `/api/send_reminder`; the key isn't in the page source, `app.js` or network requests.
- **The endpoint can't be used for spam**: the recipient is fixed on the server (`REMINDER_TO_EMAIL`); the browser can't choose who gets the email.
- **Input is checked**: name length, date format, amount range and request size are validated; text is HTML-escaped before it goes into the email.
- **Abuse is slowed down**: 5 emails per 10 minutes per IP, and optionally only requests from my own site (`ALLOWED_ORIGIN`).
- **Errors don't leak details**: the email service's error replies are logged on the server; the browser gets a short message.
- **Private files aren't served**: `.vercelignore` keeps `dev_server.py` and env files off the public site.
- **If a key ever leaks**: revoke it in Resend, create a new one, and update it in Vercel.

Known limits: the rate limit is kept in one server instance's memory, so it's best-effort; reminders are stored in the browser, not in a database.
