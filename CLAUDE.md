# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

fcManager is a local web app for running a fantacalcio (Italian fantasy football) auction. There is no build step, no bundler, no framework, and no test suite: vanilla HTML/CSS/JS in the browser, plus a small Express server.

## Commands

- `npm install`: install the only dependency, Express 5.
- `node server.js`: serve the app at http://localhost:3000.

There is no lint or test setup. `npm test` is the npm placeholder that just exits 1. The `main` field in `package.json` (`new-auction.js`) is stale. The entry point is `server.js`.

To check a change, run the server and use the pages in a browser. Frontend files are served statically, so a browser reload picks up edits. Server changes need a restart.

## Architecture

### Server (`server.js`)

`express.static(__dirname)` serves the whole repo root. On top of that, a JSON file store in `auctions_saved/` (gitignored, created at startup) exposes:

- `GET /api/auctions`: list saved auctions, newest first (`id`, `leagueName`, `ruleset`, `modifiedAt`).
- `GET /api/auctions/:id`: the full auction JSON.
- `POST /api/auctions`: create an auction. The id is `YYYY-MM-DD_HH-MM-SS-<leagueName>` and is also the filename.
- `PUT /api/auctions/:id`: overwrite the whole auction. The client always sends the full object.

Every `:id` route rejects ids containing `/`, `\` or `..` before they reach `path.join`. Keep that guard on any new route that takes an id.

### Pages and flow

1. `index.html` + `script.js` (home page):
   - Lists saved auctions.
   - Holds the new-auction form: league name, ruleset (`mantra` or `classic`), credits, optional max-buyable cap (Mantra only), and team names. The **first team name is the user's own team** (`userTeam`).
   - Parses the players `.xlsx` in the browser with SheetJS (loaded from a CDN).
2. On create or continue, the auction object is put into `sessionStorage['fcmAuction']` and the browser goes to `auction.html` (mantra) or `coming_soon.html` (classic). The classic auction page has been retired, so only Mantra works.
3. `auction.html` + `auction.js` (the live auction) reads the auction back from `sessionStorage`, not from the server. Each change calls `persist()`, which writes to `sessionStorage` and then `PUT`s the whole object to the server.

### Players spreadsheet import

`parsePlayers` in `script.js` reads the sheet named **`Tutti`**. It finds the header row as the first row that contains both `Id` and `Nome`, then matches columns by header name, ignoring case:

- Required: `Id`, `RM` (roles, `;`-separated), `Nome`, `Squadra`, `Qt.A M`, `Qt.I M`, `Diff.M`, `FVM M`.
- Optional scouting columns, English or Italian header: `Starter`/`Titolarità`, `Injury`/`Infortunio` (1–3), `Tier`, `GK hierarchy`/`Gerarchia portiere`, `Penalty`/`Rigorista`, `Max price`/`Prezzo massimo`, `Ballot`/`Ballottaggio`, `Target`, `Notes`/`Note`.

A missing optional column becomes `''`. `auction.js` shows or hides the related table columns depending on whether any player has data for them. The source file is built by following `asset/players excel/info scraper.md`: the fantacalcio.it download goes in `asset/players excel/raw data/` (gitignored), and the filled file is written to `asset/players excel/`. Old versions are in `asset/players excel/_old/`. The app never reads this folder: the file is uploaded through the browser form.

To add a new spreadsheet column, change `parsePlayers` in `script.js` and the rendering in `auction.js`. Auctions created before the change do not have the new field, so treat it as optional.

### Auction state model

The saved file has a single source of truth: each player carries `soldTo` (team name) and `price`. Team credits and rosters are **not stored**. `hydrateTeams()` rebuilds them on load, starting from `initialCredits` and replaying every sale. `auction.log` holds the sales log. It is optional because older files lack it. A team is "out" when it has less than 1 credit left, or when its roster is full while the cap is on.

Mantra role order for sorting is `ROLE_ORDER` in `auction.js` (`Por, Dd, Dc, Ds, B, E, M, C, W, T, A, Pc`).

### Styling

- Bootstrap 5.3 comes from a CDN. `auction.html` also loads the Bootstrap Icons font (`<i class="bi bi-...">`), but most icons in `auction.js` are inlined as SVG strings.
- `theme.css` holds the shared brand tokens (`--fcm-orange`) and the `.btn-orange` primary button. Link it on every page, before the page's own CSS.
- Each page has its own stylesheet (`index.css`, `auction.css`).
- Tooltips: both pages turn every `title` (and `data-bs-title`) into a Bootstrap tooltip with the `note-tooltip` class (style in `theme.css`), delegated from `document.body`. For a tooltip, just set `title`.

## Conventions

- Commit and push straight to `main`. Do not use feature branches.
- Commit messages follow conventional-commit prefixes (`feat:`, `chore:`, `refactor:`).
- Escape any text that goes into `innerHTML` with the page's `esc()` helper.
- CSS: style with IDs or classes, but give every styled element a camelCase `id`. The user refers to elements by ID when inspecting the page in the browser. An ID must be unique, so an element that repeats (generated rows, badges, cards) gets a suffix built from its data, e.g. `playerRow-<playerId>` or `teamCard-<index>`. This applies to new elements only. Do not add IDs to existing elements unless asked.
