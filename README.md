# Renewal Reminder

A browser app that helps you decide about subscriptions and other renewals **before** you're charged: keep it, cancel it, or decide later with a reason, and get reminded again.

Coursework prototype. Reminders are demo data stored in your browser; the **email reminder** is real and goes through an API.

## How it's built

| Part | What it is |
|---|---|
| `index.html`, `app.js`, `styles.css`, `data.js` | The app: React 18 + htm, no build step |
| `api.js` | Browser API client: calls our own server function only |
| `api/send_reminder.py` | Serverless function (Vercel, Python) that sends the email through [Resend](https://resend.com) |
| `dev_server.py` | Local server: the app plus the same function, reading secrets from `.env.local` |

```
Browser ──POST /api/send_reminder──▶ our function ──(RESEND_API_KEY)──▶ Resend ──▶ inbox
          (name, date, amount)        validates, builds email
```

## Run locally

1. Copy `.env.example` to `.env.local` and fill in `RESEND_API_KEY` and `REMINDER_TO_EMAIL`.
2. Run `python3 dev_server.py` and open http://localhost:5173
3. Open any reminder → **Send test email**.

Without `.env.local` the app still works; the button explains that email isn't set up.

## Deploy (Vercel)

1. Push this folder to a GitHub repository.
2. In Vercel: **Add New → Project**, import the repository (no build settings needed).
3. **Settings → Environment Variables**: add `RESEND_API_KEY`, `REMINDER_TO_EMAIL` (and optionally `ALLOWED_ORIGIN` = your site URL). Redeploy.

## Security: how the key is protected

- **The key lives only in environment variables**: `.env.local` on my computer and Vercel's encrypted settings online. It is not in any code file.
- **It never reaches GitHub**: `.gitignore` excludes `.env`, `.env.local` and `.env.*.local`. The repository only has `.env.example` with empty values, so others know which variables to set.
- **It never reaches the browser**: only the server function reads `RESEND_API_KEY`. The browser calls `/api/send_reminder`, and you won't find the key in the page source, `app.js` or network requests.
- **The endpoint can't be used for spam**: the recipient is fixed on the server (`REMINDER_TO_EMAIL`); the browser can't choose who gets the email.
- **Input is checked**: name length, date format, amount range and request size are validated; text is HTML-escaped before it goes into the email.
- **Abuse is slowed down**: 5 emails per 10 minutes per IP, and optionally only requests from my own site (`ALLOWED_ORIGIN`).
- **Errors don't leak details**: the email service's error replies are logged on the server; the browser gets a short message.
- **If a key ever leaks**: revoke it in Resend, create a new one, and update it in Vercel.

Known limits: the rate limit is kept in one server instance's memory, so it's best-effort; reminders themselves are still stored in the browser, not in a database.
