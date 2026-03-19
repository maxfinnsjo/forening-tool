# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**Forenings Tool** is a zero-dependency, browser-based SPA for managing Swedish associations (föreningar). It runs entirely client-side with no build step — open `index.html` directly in a browser.

## Running

No build or install step. Open `index.html` in a browser. For a local dev server:

```bash
python3 -m http.server 8000
# or
npx serve .
```

No package.json, no npm, no tests, no linter configuration.

## Architecture

The app is split into three JS modules loaded via `<script>` tags in `index.html`:

- **`storage.js`** — LocalStorage read/write with optional AES-GCM encryption (PBKDF2 key derivation, 100k iterations). Exports `saveData()`, `loadData()`, `clearData()`, `isStorageEncrypted()`, `deriveKey()`.
- **`templates.js`** — Data model construction (`createAssociationTemplate()`), bylaws text generation (`generateBylaws()`), and static public site HTML generation (`generatePublicSite()`).
- **`app.js`** (~1200 lines) — All application state, hash-based routing (`#home`, `#create`, `#dashboard/:id`, `#settings`), event handlers, and UI rendering.

`index.html` defines all UI structure (modals, views, forms). `styles.css` uses CSS custom properties for light/dark theming.

## LocalStorage Keys

- `forening_data` — Main data store (JSON, optionally AES-GCM encrypted)
- `forening_sec_meta` — `"active"` if encryption is enabled
- `theme` — `"light"` or `"dark"`
- `checkpoint_${id}` — SessionStorage; change-detection snapshots per association
- `vault_unlocked` — SessionStorage; temporary vault session flag

## Data Model

Each association has: `id`, `name`, `type`, `purpose`, `contact`, `links`, `badge`, `members[]`, `board{}`, `meetings[]`, `ideas[]`, `customStadgar`, `vault[]`. Members have a `role` field: `"member"`, `"chair"`, `"treasurer"`, `"secretary"`, `"auditor"`, or `"substitute"`.

## Security Notes

- Password is kept only in the in-memory `sessionPassword` variable, never persisted.
- All user content is passed through `escapeHTML()` before rendering to prevent XSS.
- Vault records use per-record random salts and IVs.
