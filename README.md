# Training Log

A personal gym-logging PWA. One user, no database: every set you log is appended
as a row to the **Log** tab of the Google Sheet, which stays the source of truth
for everything else that reads it from Drive. Built for one-handed phone use
between sets — big buttons, pre-filled weights from last session, automatic rest
timer, and an offline queue so a dead gym connection never eats a set.

Stack: Next.js (App Router) + TypeScript + Tailwind CSS, deployed on Vercel.
Node 24 (`.nvmrc` is set; `nvm use` picks it up).

---

## How it works (the short tour)

- **The sheet is the backend.** Server-side route handlers talk to Google Sheets
  with a service account. The app only ever *appends* rows to the Log tab —
  it never edits or deletes existing rows and never touches other tabs.
- **`lib/exercises.ts` is the program.** Every exercise's default sets, rep
  range, bodyweight flag, rest seconds and unilateral flag live in that one typed
  constant. Edit it there; the whole UI follows. An exercise can also list
  `aliases` — old hand-written spellings in the sheet (e.g. "push up on knee")
  — so pre-fill and history pick up rows logged before the app existed. Name
  matching is case-insensitive; new rows always write the canonical name.
- **Pre-fill:** opening an exercise loads its most recent row (including
  overflow sets parsed back out of Notes) and pre-fills every set's kg/reps.
  You mostly just tap ✓ and occasionally nudge a stepper.
- **Saving is optimistic:** the entry goes into a localStorage outbox first,
  then syncs to `/api/log`. If the request fails or you're offline, it stays
  queued, retries automatically (reconnect, app focus, backoff timer), and a
  small amber "1 unsynced" badge shows until it lands. Retries ask the server
  to skip the append if an identical row already made it (so a lost response
  can't create a duplicate row).
- **Auth:** one shared password (`APP_PASSWORD`), checked server-side; a signed
  cookie keeps you logged in for a year per device. Changing the password logs
  every device out.

### How rows are written (the data contract)

Columns, starting at row 4 of the **Log** tab:

```
Date (yyyy-mm-dd) | Day | Exercise | Set1 kg | Set1 reps | Set2 kg | Set2 reps | Set3 kg | Set3 reps | Reps in reserve | Notes
```

- One row per exercise per session, appended only.
- Bodyweight work writes kg as `0`. Blank kg/reps cells mean "set not done".
- "Reps in reserve" holds the effort word: `easy` / `ok` / `hard`.
- Sets beyond 3 overflow into Notes as `S4: 20x8` (or `S4: 0x12 (L)` for one
  side of a unilateral exercise). Your typed note follows after the overflow,
  separated by `; `.
- **Unilateral exercises** count sets per side (left's 4th set is `S4 … (L)`):
  - Left and right did the same set → the kg/reps columns hold it once, like a
    hand-written log.
  - Sides differed on set n ≤ 3 → columns hold the **left** values and Notes
    records the right side, e.g. `S2: 10x8 (R)`.
  - Only one side did set n ≤ 3 → columns hold that side and Notes marks it,
    e.g. `S3: (L only)`.
  The app parses all of these back, so an asymmetric session pre-fills
  correctly next time.
- Values are written with `USER_ENTERED`, i.e. exactly as if typed into the
  sheet: numbers become real numbers, the ISO date becomes a real date cell.

---

## 1. Google service account setup (one-time)

The app authenticates to Google Sheets as a "service account" — a robot Google
identity with its own email address and key, so no OAuth screens are involved.

1. Go to [console.cloud.google.com](https://console.cloud.google.com), create a
   project (any name, e.g. `training-log`).
2. **Enable the Sheets API:** APIs & Services → Library → search
   "Google Sheets API" → Enable.
3. **Create the service account:** IAM & Admin → Service Accounts →
   Create Service Account. Name it (e.g. `training-log`), skip the optional
   role/access screens — it needs no project roles.
4. **Create a key:** open the new service account → Keys → Add Key →
   Create new key → **JSON**. A `.json` file downloads. Treat it like a
   password.
5. From that JSON file you need two values:
   - `client_email` → goes into `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → goes into `GOOGLE_PRIVATE_KEY` (paste the whole thing,
     `-----BEGIN PRIVATE KEY-----` to the end; the literal `\n` sequences in
     the JSON are fine — the app converts them).
6. **⚠️ The step everyone forgets — share the sheet:** open the spreadsheet in
   Google Sheets → Share → add the service account's email address
   (`...@...iam.gserviceaccount.com`) as **Editor**. Without this the API
   returns "The caller does not have permission" and nothing can be written.

The spreadsheet ID is already in `.env.example`
(`1woDU57iY2WQCdWbnFihPlKrCTYoHIPdQs2mOBfvubvc` — the long token from the
sheet's URL).

## 2. Run locally

```bash
nvm use            # Node 24
npm install
cp .env.example .env.local   # then fill in the four values
npm run dev
```

Open http://localhost:3000, enter your `APP_PASSWORD`. With placeholder Google
credentials the UI still works fully — saves just stay queued in the outbox
(same as being offline), which is handy for poking at the UI without touching
the real sheet.

## 3. Deploy to Vercel

1. Push this folder to a Git repo (GitHub is simplest) and import it in Vercel,
   or run `npx vercel` from the folder. Framework preset: Next.js — no special
   build settings needed.
2. **Node version:** already handled — `package.json` has
   `"engines": { "node": "24.x" }`, which tells Vercel to build and run on
   Node 24 (it overrides the dropdown in project settings).
3. **Environment variables** (Project → Settings → Environment Variables, add
   to Production and Preview):

   | Name | Value |
   |------|-------|
   | `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` from the key JSON |
   | `GOOGLE_PRIVATE_KEY` | `private_key` from the key JSON — paste the whole PEM. Multiline paste or single line with `\n`, both work |
   | `SHEET_ID` | `1woDU57iY2WQCdWbnFihPlKrCTYoHIPdQs2mOBfvubvc` |
   | `APP_PASSWORD` | your shared password |

4. Deploy. First load asks for the password once per device.

## 4. Install it on your phone

- **iPhone:** open the deployed URL in Safari → log in → Share →
  **Add to Home Screen**. Opens full-screen, portrait, dark status bar.
- **Android:** open in Chrome → log in → the "Install app" prompt (or ⋮ →
  Add to Home screen).

Notes for gym reality:
- The rest timer keeps correct time even if the screen was off (it counts from
  a timestamp, not a ticking loop), and the app holds a screen wake lock while
  a timer runs so the phone doesn't sleep mid-rest.
- Sound + vibration fire at zero if the app is on screen. If the phone is
  locked, mobile browsers don't allow background audio — the bar shows **GO**
  when you come back. (iOS also has no vibration API; Android vibrates.)
- Offline: the app shell opens from cache, history shows the last fetched
  data with an "Offline" note, and saves queue in the outbox until signal
  returns. Nothing you tapped ✓ on is ever lost.

## Day-to-day use

1. Tap an exercise tile. Every set is pre-filled from last time
   ("Last time: 34.3 kg — 10/10/10 (hard) · 3d ago" at the top).
2. Adjust with the steppers if needed (hold to auto-repeat; long-press the
   number to type on a keyboard). Tap ✓ when the set's done — the rest timer
   starts by itself (+30s if you need it).
3. Unilateral moves show L/R sets; `+ set L` / `+ set R` for extra single-side
   sets.
4. Pick easy / ok / hard (required), add a note if you like, hit save. One row
   is appended to the sheet.
5. History tab: last 5 sessions per exercise + a top-set trend sparkline
   (top reps for bodyweight moves).

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "The caller does not have permission" (403) | The sheet isn't shared with the service-account email as Editor — step 6 above. |
| `error:1E08010C … DECODER routines` or `invalid_grant` | `GOOGLE_PRIVATE_KEY` got mangled. Re-paste the full `private_key` value from the JSON; keep the BEGIN/END lines. |
| "Unable to parse range: 'Log'!A4:K" | The tab isn't named exactly `Log`. |
| Badge shows "N unsynced" and won't clear | Tap it to see the last error (also retries). Usually offline or a credentials problem on Vercel. Queued rows survive app restarts. |
| An exercise shows "no history" despite old rows in the sheet | The sheet spells its name differently. Add that spelling to the exercise's `aliases` in `lib/exercises.ts`. |
| Changed `lib/exercises.ts` but the phone shows old config | It's baked into the build — redeploy, then reopen the app (navigations are network-first, so the new version loads on next open). |
| Icons look different after editing the generator | Rerun `node scripts/generate-icons.mjs`, redeploy, and re-add to home screen (phones cache the old icon). |

## Project layout

```
lib/exercises.ts        the program: names, sets×reps, bodyweight, rest, unilateral
lib/rowcodec.ts         entry ⇄ sheet-row encoding (the data contract lives here)
lib/sheets.ts           googleapis client — read Log!A4:K, append one row
lib/outbox.ts           localStorage queue + retry/dedupe sync
lib/auth.ts             HMAC cookie session helpers
app/api/log             POST: validate + append one row
app/api/history         GET: last 5 parsed entries per exercise (feeds pre-fill too)
app/api/auth            POST login / DELETE logout
app/page.tsx            session screen (exercise grid)
app/history/page.tsx    read-only history + sparklines
components/             LoggingCard, SetRow, Stepper, TimerBar, …
public/sw.js            app-shell service worker (offline)
scripts/generate-icons.mjs  regenerates public/icons/*.png
```
