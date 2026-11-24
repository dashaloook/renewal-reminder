# Renewal Reminder

**Live:** https://renewal-reminder-one.vercel.app · **Code:** https://github.com/dashaloook/renewal-reminder

A browser app that helps you decide about subscriptions and other renewals before you're charged: keep it, cancel it, or decide later with a reason, and get reminded again.

Coursework prototype. All data is stored in your browser (`localStorage`); there is no server or database.

## Features

- **Dashboard** with upcoming charges, monthly spend and **Unfinished decisions** (renewals you postponed with a reason).
- **Reminders list** with filters and list/calendar views.
- **Add / edit a reminder**: search popular services as you type (e.g. `S` → Spotify), each with a real service link; custom date picker; "Remind me" options that adapt to the date (options that don't fit are disabled, "On the day" when the charge is today).
- **Decide later** with a reason and a new reminder date.
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
| `index.html` | Entry page; loads React 18, htm (from unpkg) and the app |
| `app.js` | The app: screens, routing (`#/dashboard`, `#/reminders`, `#/new`, `#/edit/:id`), state |
| `data.js` | Popular services (with links) and demo data |
| `styles.css` | Styles |
| `duck-wave.png`, `duck-empty.png` | Mascot illustrations |

No build step.

## Run locally

```
python3 -m http.server 8000
```

Open http://localhost:8000. For testing, `?state=empty|loading|error` in the URL forces a state.

## Deploy (Vercel)

Import the repository in Vercel (**Add New → Project**), no build settings needed. Every push to `main` redeploys.

## Legacy files

`api.js`, `api/send_reminder.py`, `dev_server.py` and `.env.example` belong to an earlier version with a "Send test email" feature (Resend). The current app doesn't load them.
