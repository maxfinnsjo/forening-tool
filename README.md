# Forening Tool — v2.0

A zero-dependency, browser-based SPA for managing Swedish associations (föreningar). Runs entirely client-side — no build step, no backend, no install.

Open `forening-tool/index.html` directly in a browser.

---

## Features

- **Multi-association management** — create and manage any number of associations
- **Member register** — full member records with roles (chair, treasurer, secretary, auditor, substitute)
- **Meeting protocols** — agenda, decisions, voting records with timestamps
- **Bylaws (Stadgar)** — auto-generated from template, fully editable and downloadable
- **Ideas & motions board** — track future changes and proposals
- **Secure Vault** — AES-GCM encrypted archive for sensitive protocols (founding member lists, bylaws snapshots)
- **Database encryption** — optional PBKDF2/AES-GCM encryption of all LocalStorage data
- **Change detection** — session checkpoints with diff tracking across browser tabs
- **Public site generator** — exports a standalone `index.html` info page (no private data)
- **GitHub Pages publishing** — connect a GitHub repo per association and publish directly from the app using a PAT

---

## Running

No install needed. Open directly:

```
forening-tool/index.html
```

Or serve locally:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/forening-tool/
```

---

## Architecture

```
forening-tool/
├── index.html     — UI structure, all views and modals
├── app.js         — State, routing (#home, #create, #dashboard/:id, #settings), event handlers
├── github.js      — GitHub REST API wrappers (PAT-authenticated)
├── storage.js     — LocalStorage read/write with optional AES-GCM encryption
├── templates.js   — Data model, bylaws generator, public site generator, README/snapshot generators
└── styles.css     — CSS custom properties, light/dark theme
```

No framework. No bundler. No package.json.

---

## GitHub Pages Publishing

1. Go to **Settings** → enter a GitHub Personal Access Token (PAT) with `repo` scope
2. Open an association dashboard → **Setup Repo** → create or connect a GitHub repository
3. **Publish to Pages** → select files → preview → confirm

Published files:
- `index.html` — public-facing info site (name, purpose, contact, links, badge)
- `README.md` — repo overview with board roles and member count
- `data.json` — structured metadata snapshot

Member lists, meetings, and vault records are **never published**.

---

## Data Model

```json
{
  "id": "...",
  "name": "My Association",
  "type": "ideell",
  "purpose": "...",
  "contact": "...",
  "links": [],
  "badge": "........",
  "created": "ISO8601",
  "lastModified": "ISO8601",
  "members": [{ "id": "...", "firstName": "", "lastName": "", "role": "chair|treasurer|secretary|auditor|substitute|member", ... }],
  "board": { "chair": "", "treasurer": "", "secretary": "" },
  "meetings": [{ "id": "...", "title": "", "date": "", "agenda": [], "decisions": [], "votes": [] }],
  "ideas": [],
  "vault": [],
  "github": { "owner": "", "repo": "", "branch": "main" }
}
```

### LocalStorage keys

| Key | Contents |
|-----|----------|
| `forening_data` | Main data store (JSON, optionally AES-GCM encrypted) |
| `forening_sec_meta` | `"active"` if encryption is enabled |
| `theme` | `"light"` or `"dark"` |
| `checkpoint_${id}` | SessionStorage — change-detection baseline per association |
| `vault_unlocked` | SessionStorage — temporary unlock flag |

---

## Security

- Encryption password kept only in memory (`sessionPassword`), never persisted
- All user content rendered via `escapeHTML()` — no XSS vectors
- GitHub PAT kept only in memory (`sessionGitHubToken`), cleared on page reload
- Vault records use per-record random salts and IVs

---

## Design Goals

- Zero dependencies
- Static hosting compatible
- Human-readable data
- Simple, auditable architecture
