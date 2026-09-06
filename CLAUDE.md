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

There are no other lint/build/test commands — don't invent `npm run` scripts; none exist.

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
- **`index-קובץ-בודד-לחירום.html`** — emergency single-file build containing everything inline. Not used in normal operation; exists so the app can be opened locally without a server if Netlify/the split build is unavailable.
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

No CI/CD. Deploy is manual: drag the project folder onto Netlify's Deploys tab (same URL persists). After any deploy, run the in-app self-test (🩺). Rollback is Netlify → Deploys → pick a previous deploy → Publish deploy.
