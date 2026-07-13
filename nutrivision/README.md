# NutriVision — Working App

This turns your Stitch UI mockup into a **real, working app** — not just static
screens. Everything below actually functions:

- **Scan** — opens your phone/laptop camera, captures a real photo, then lets
  you log the meal (name, meal type, calories, protein/carbs/fat, note).
- **Gallery/Upload** — pick a real photo from your device and log a meal.
- **Journal** — every entry you save is stored on your device (localStorage)
  and shown grouped by day, with a running 7-day tally. You can delete entries.
- **Home** — calorie ring, protein/fat rings, and meal-split totals all
  compute live from what you've actually logged today, against an editable
  daily goal (tap the gear icon top-right).
- **Planning** — add planned meals for any date, check them off (which also
  logs them to your journal), delete plans.

There's no real food-recognition AI wired in (that needs a paid vision API and
a backend) — each "scan" gives you an editable quick-estimate you confirm or
correct, so the numbers you keep are always ones you approved.

## How to run it right now
Just open `index.html` in a browser — double-click it, or:
```
cd nutrivision
python3 -m http.server 8080
# then visit http://localhost:8080 on your phone or computer
```
The camera (`getUserMedia`) only works over `https://` or `localhost` — opening
the file directly (`file://`) will show the camera as unavailable, but Gallery
upload always works. If you host it (see below), the camera scan will also work.

## Installing it like an app (no APK needed)
This is a PWA (Progressive Web App) — a real install, with its own icon and
no browser bar:
1. Host the folder somewhere with HTTPS (see options below), or serve it on
   your phone's own network via the command above.
2. Open the URL in Chrome on Android.
3. Tap the menu (⋮) → **"Add to Home screen" / "Install app"**.
4. It installs with the NutriVision icon and opens full-screen like a native app.

Free hosting options for a static folder like this: **Netlify Drop**
(netlify.com/drop — drag the folder in, get a URL instantly), **Vercel**, or
**GitHub Pages**.

## About the ".apk" you asked for
I want to be upfront: I can't compile an installable `.apk` file inside this
environment — that needs the Android SDK and Gradle build tools, which aren't
available here (and can't be installed given this sandbox's network access).
So rather than hand you a broken or fake file, here's the real path:

1. Host this folder on HTTPS (Netlify Drop is the fastest — literally drag and
   drop, ~30 seconds).
2. Go to **pwabuilder.com**, paste your hosted URL.
3. PWABuilder packages your PWA into a real, signed `.apk` (or `.aab` for the
   Play Store) that you can download and install directly on any Android
   phone — no coding required.

That's a standard, well-known route for turning a PWA into a genuine Android
app, and it'll produce a proper working APK from the app you have here.

## Files
- `index.html` — app shell + all 5 screens
- `app.js` — all state, routing, and screen logic
- `styles.css` — the vintage "Modern Heritage" look from your design system
- `manifest.json` / `sw.js` — makes it installable and works offline
- `icons/` — app icons generated from your logo
