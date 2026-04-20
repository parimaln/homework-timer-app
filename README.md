# homework-timer-app

A plain HTML + JavaScript homework timer designed for GitHub Pages.

## Features
- Dark minimal responsive UI
- Editable app type title (e.g. Homework, Office Work, House Chores) persisted across refreshes
- Total time + reminder interval inputs
- Optional task name input persisted with timer state
- Live countdown with elapsed/remaining status
- Pause/resume control with optional timed break support
- Break length validation (max 10 minutes and never longer than remaining time)
- Timer state persisted in `localStorage` and restored on refresh
- Service worker powered background reminders/completion notifications when supported; after tab close, delivery is best-effort and browser-dependent rather than guaranteed
- Floating bottom-right subscribe/unsubscribe alerts button for notification opt-in/out (mobile-friendly)
- iOS web push follows Apple requirements (iOS 16.4+, HTTPS, and Add to Home Screen)
- On desktop, notification permission is requested on page load instead of waiting for timer start
- If a notification is shown, clicking it focuses an existing timer tab or opens the app
- Desktop notifications + audible chime on reminders and completion while app is open
- Reminder/completion notifications can include the current task name
- Timer state auto-cleared from `localStorage` when finished

## Run locally
Serve the folder as static files (required — desktop notifications and the Web Audio API need a secure context and will not work when `index.html` is opened directly from the filesystem via `file://`):

```bash
python3 -m http.server 4173
```

Then open `http://127.0.0.1:4173`.

## Deploy on GitHub Pages
1. Push this repository to GitHub.
2. In **Settings → Pages**, choose **Deploy from a branch**.
3. Select your default branch and root (`/`) folder.
4. Save — GitHub Pages will publish `index.html`.
