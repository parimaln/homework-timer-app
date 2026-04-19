# homework-timer-app

A plain HTML + JavaScript homework timer designed for GitHub Pages.

## Features
- Dark minimal responsive UI
- Total time + reminder interval inputs
- Live countdown with elapsed/remaining status
- Timer state persisted in `localStorage` and restored on refresh
- Desktop notifications + audible chime on reminders and completion
- Timer state auto-cleared from `localStorage` when finished

## Run locally
Open `index.html` directly, or serve the folder as static files:

```bash
python3 -m http.server 4173
```

Then open `http://127.0.0.1:4173`.

## Deploy on GitHub Pages
1. Push this repository to GitHub.
2. In **Settings → Pages**, choose **Deploy from a branch**.
3. Select your default branch and root (`/`) folder.
4. Save — GitHub Pages will publish `index.html`.
