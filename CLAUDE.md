# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page PWA for warehouse/distribution management for a winery ("יקב טורא" / Mountain Wine Estate). No build step, no package manager, no test framework — it's plain HTML/CSS/JS served statically. `index.html` is the shell (~24KB); all logic lives in numbered modules under `assets/js/`.

## Running / testing changes

There is no dev server, bundler, or CLI test suite in this repo. To verify a change:

1. Serve the directory over HTTP (e.g. `python3 -m http.server` from the repo root) and open `index.html` in a browser — some features (camera/barcode scanning, cloud sync) only work over `http(s)`, not `file://`.
2. In the running app, go to **⚙ הגדרות → הגדרות מתקדמות → 🩺 הרץ בדיקה** (or call `selfTest()` / `openDiagnostics()` in the browser console). This runs the in-app self-test that checks for missing/overwritten critical functions, calculation regressions (boxes/pallets), date logic, barcode catalog loading, etc.
3. `dataAudit()` (also shown in the same diagnostics screen) checks data integrity (duplicate slots, out-of-bounds locations, missing categories, etc.) — separate from `selfTest()`, which checks code/system health.
4. Always run `selfTest()` in the browser after any change and confirm it's clean before considering work done — the boot sequence (`assets/js/99-boot.js`) also runs it automatically ~2.5s after page load and toasts a warning if anything fails.
5. **`tests.html`** — a standalone regression suite (open it the same way as `index.html`, over `http(s)`). Loads the real modules in the real order against an isolated, in-memory `localStorage` shim (never touches real app data, even opened in the same browser profile), then runs scenario-level checks — including the exact live incidents this project has already hit once (LionWheel lines with "מבצע"/"X+Y" patterns getting dropped, `דולצ'טו` apostrophe variants, a missing `inv_log` table blocking login, deduct/return round-trips, box/pallet math). Extend it whenever a bug like that is found and fixed — that's the whole point: a regression test lets the next person past the fix know they broke it. Renders a pass/fail list `selfTest()`-style in the page itself.

There are no lint/build commands — don't invent `npm run` scripts; none exist. `build-emergency.js` (below) is the one exception: a plain Node script, no npm install needed.

## Architecture

```
[Browser: index.html]  ←→  [Supabase: DB + auth]
        ↑
   [Netlify: static hosting]
```

- **`index.html`** — UI shell only. Scripts load in numeric order from `assets/js/`; **load order matters** and is meaningful (state/constants first, boot logic last).
- **`assets/js/01-core.js`** — constants, `state`, lazy-lib loader (`needLib`), box/pallet calculations, sanitization helpers.
- **`assets/js/02-dashboard.js` … `24-invlog.js`** — one module per screen/topic (dashboard, map, location, inventory, settings, labels, CSV, barcodes, cloud backups, diagnostics, autosave, LionWheel import, Supabase sync, row sync, board, tasks, picking, supply, deduct, inventory transaction log).
- **`assets/js/99-boot.js`** — runs last: scroll-position preservation across full-screen re-renders, Escape-key handling, initial state sanitation, nav build, and the automatic `selfTest()` call.
- **New module convention**: add it before `99-boot.js` in both `index.html`'s `<script>` list and the file numbering. Keep changes scoped to one module at a time — duplicate function names across modules (one silently overwriting another) is the main foot-gun; `selfTest()`'s "critical functions" check exists specifically to catch that.
- **Lazy-loaded libraries** (`assets/lib/`): `xlsx.js`, `jsqr.js`, `html2canvas.js`, `zxing.js` (~690KB total) are only fetched on demand via `needLib()` in `01-core.js`, not on initial page load (~440KB instead of ~1.1MB).
- **`index-קובץ-בודד-לחירום.html`** — emergency single-file build containing everything inline (app.css, all 26 modules, and the lazy libs eagerly, since there's no server to fetch them from). Not used in normal operation; exists so the app can be opened locally (`file://`, no server, no internet) if Netlify/Supabase are unavailable. **Regenerate it with `node build-emergency.js`** (plain Node, no dependencies) any time `index.html`, `assets/app.css`, or any `assets/js/*.js`/`assets/lib/*.js` changes — don't hand-edit it. The filename itself once got mojibake-corrupted in a past commit (a real incident, not hypothetical) — if `ls`/`git status` ever shows garbled box-drawing characters instead of this Hebrew name again, that's the same failure mode; fix the filename, don't just re-save content under the broken name.
- **`Code.gs`** — legacy Google Apps Script for an optional Google Sheets sync path (older/manual backup mechanism, separate from the Supabase cloud sync).
- **`views.sql`** — run once against Supabase to create SQL views (`v_inventory`, `v_shipments`, `v_labels`, `v_stock_summary`) over the JSON `data` columns, for querying/reporting.

## Data model

Cloud tables (Supabase): `businesses`, `memberships`, `inventory`, `shipments`, `labels`, `inv_log`, `app_state`, `backups`. Every row carries `business_id`; RLS policies enforce that one business can't see another's data — isolation is enforced in the database itself. Actual data is stored as JSON in a `data` column (hence `views.sql` for flat querying).

`inv_log` is the append-only inventory transaction log (see `assets/js/24-invlog.js`) — every quantity (`units`) change on a "מיקום במחסן" entry is recorded with before/after/reason via `logInv()`. It row-syncs like `inventory`/`shipments`/`labels` (see `SB_TABLES` in `18-rowsync.js`). Run `inv_log_setup.sql` once in Supabase's SQL Editor to create the table (and its `v_inv_log` view) before the log will sync to the cloud — until then it still works, but local-only per device.

**Working modes**: if the user is logged in, data lives in Supabase (cloud); if not, the app works local-only via `localStorage` (key defined as `KEY` in `01-core.js`), optionally with the legacy Google Sheets sync as a backup path.

**Core principle**: the "מיקום במחסן" (warehouse location) screen is the source of truth; every other screen (dashboard, inventory summary, map, shipments) is derived from it.

**Calculation rules** (see `derive()`, `bpb()`, `bpp()` in `01-core.js`):
- Units → boxes: per category, and separately for labeled vs. unlabeled stock. Default 12/box; MP and Victory: 12 unlabeled / 6 labeled.
- LionWheel import: non-wine/oil products (empty bottles, boxes, corks) count 1 per unit.
- Boxes → pallets: per category, default 75 boxes/pallet (`DEFAULT_BPP`).
- One location slot = at most one pallet.

**Barcodes**: `assets/data/products.js` holds the product catalog (name, barcode, and for wine also category/vintage/type). Barcodes are auto-matched to inventory entries by category+vintage+type combination. Items with no catalog match stay barcode-less. To update the catalog, edit the file and re-upload (no separate build step).

## Security notes already in place

- All HTML-inserted text goes through `esc()` (`01-core.js`) at render time.
- User-entered text fields (see `USER_TEXT_FIELDS` in `01-core.js`) are stripped of `<`/`>` via `sanitizeText()`/`sanitizeDeep()`/`sanitizeState()` at the storage layer, called on boot and after data import.
- The Supabase `service_role` secret key must never enter the app or be committed — only the public `publishable` key belongs in the code.

## Workflow expectations

- Commit after every change that works — don't batch unrelated changes into one commit, and don't leave a working state uncommitted.
- Before declaring a task finished, verify it in the browser and run `selfTest()` (see above) — passing this check is a precondition for saying "done", not an optional extra step.

**חוק ברזל: תבצע שינויים ובדיקות אך ורק מקומית. לעולם אל תבצע git push ל-GitHub ללא אישור מפורש ממני.**

## Deployment

No CI/CD. Deploy is manual: drag the project folder onto Netlify's Deploys tab (same URL persists) — or, if Netlify is connected to a branch, push to that branch. After any deploy, run the in-app self-test (🩺). Rollback is Netlify → Deploys → pick a previous deploy → Publish deploy.

**`sw.js` is a stale-while-revalidate service worker (installed PWA).** Every request returns the cached copy immediately (if any) *and* always re-fetches from the network in the background to refresh that cache entry for next time — so a code change self-heals on the next reload without anyone needing to remember a version bump. (This replaced a cache-first strategy that caused two real incidents in one evening: a fix would be live on Netlify but invisible to users because the old `sw.js` never re-fetched anything. If you ever see "I deployed but nothing changed," check `sw.js`'s strategy hasn't regressed back to cache-first before chasing anything else.) The `CACHE` constant still exists and still gets bumped when the *list* of precached `ASSETS` itself changes (a new file added/removed) — bump it in the same commit as that kind of change; you no longer need to bump it just because a file's contents changed.

## Notable non-obvious behavior (each added after a real bug)

- **`assets/js/16-lionwheel.js`'s `nonProductLine()`**: a line that merely *contains* "מבצע" (promo) or an "N+M" bundle pattern (e.g. `11+1`) is normally filtered out as a non-product administrative line — **unless** it carries a full 13-digit catalog barcode, in which case it's treated as a real product regardless of that wording. Both the keyword check and the barcode-override matter here; a partial fix that only special-cased "מבצע" without the bare `N+M` pattern is exactly the bug that made it to production once (`tests.html` now covers it).
- **`assets/js/18-rowsync.js`'s `_invLogMissing`**: `inv_log` is the one Supabase table that's optional (only exists after `inv_log_setup.sql` runs). A missing-table error there must never propagate out of `sbPull()`/`sbPushChanged()` — it once bubbled all the way to the login screen and blocked every user from logging in. `sbFetchTableSafe()` is the guard; don't call `sbFetchTable('inv_log')` directly.
- **`sbFriendlyError()`** (`18-rowsync.js`) — translates raw Supabase/network error text before it reaches a user-facing `toast()`/message element. Route new Supabase error displays through it rather than `e.message` directly.
- **`state.pickingProgress`** (checked-off items in the ⁠📋 דף ליקוט screen, `21-picking.js`) is merged, not overwritten, on pull (`sbPull()` in `17-supabase.js`) — a picker's phone and someone watching from the office can both be marking items at once, and a plain overwrite would silently un-check real progress.
- **Dark mode** (`assets/app.css`, bottom) follows `prefers-color-scheme` only — there's no in-app toggle. It redefines the shared `--paper`/`--cream`/`--ink`/`--line`/`--muted` tokens plus the recurring hardcoded backgrounds; it deliberately does **not** touch warehouse-map/category/capsule colors (those encode meaning, not theme) or the print-only documents (labels, דף ליקוט print view — always render on white regardless of the viewer's theme, since they're printed).
