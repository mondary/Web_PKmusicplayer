# PK Music Player (V2)

![Project icon](icon.png)

[🇬🇧 EN](README_en.md) · [🇫🇷 FR](README.md)

✨ Vanilla web music player driven by Markdown playlists, with **Playlists** + **Artists → Albums → Tracks** browsing, and automatic recovery of YouTube links when tracks disappear.

## ✅ Features
- Import `.md` playlists (multiple files) + export active playlist to `.md`
- Browse by **Playlists** or **Artists → Albums → Tracks** (library built from all playlists)
- Playback via YouTube IFrame Player (URL or `videoId`)
- 🔁 Auto‑resolve missing links via YouTube Data API (when a key is provided)
- CLI helpers: `.txt` → `.md` conversion, folder sync, optional `yt-dlp` auto-linking

## 🧠 Usage
1) Start any static server:

```bash
python3 -m http.server 5173
```

2) Open:
- `http://localhost:5173/`

3) Load playlists:
- `Import MD` (your `.md` files)
- or `Load demo` (reads `playlists/index.json`)

## 🧾 Playlist format (Markdown)
Recommended: table + optional frontmatter.

```md
---
title: 2027
year: 2027
id: my-2027
---

| # | artist | title | album | year | youtube |
| -: | - | - | - | -: | - |
| 1 | Artist | Title | Album | 2027 | https://www.youtube.com/watch?v=VIDEOID |
```

Alternative (simple): bullet lines.

```md
- Daft Punk — One More Time | album: Discovery | year: 2000 | yt: https://youtu.be/FGBhQbmPwH8
```

## ⚙️ Settings
### YouTube key (recommended)
Two options:
- UI: `Options` → paste into **YouTube Data API → API KEY**
- File: edit `secrets/config.json` (`youtubeApiKey`) then reload the page

What it enables:
- If a track has no YouTube link, the player can **search** (YouTube Data API) and **store** the found URL in local state.

## 🔁 Recovery / auto-resolve
- Without a key: `Find` → open YouTube search → paste URL → `Use this link`
- With a key: click a “Missing link” track → auto-resolve (1st result) → playback

## 🧰 Scripts
### Sync a folder (Desktop dump) → `playlists/`
Browsers cannot read `/Users/...` directly.

```bash
node scripts/sync-playlists.mjs "/Users/clm/Desktop/drive-download-20260427T093453Z-3-001"
```

Then `Load demo`.

### Auto‑fill with `yt-dlp` (optional, no API key)
Fills missing links locally (batch).

```bash
brew install yt-dlp
node scripts/resolve-youtube.mjs playlists 50
```

Second arg = max links to fill (rate-limit friendly).

## 🧾 Changelog
- 2026-04-27: V2 UI + artists/albums browsing + options drawer + YouTube auto-resolve (key)

## 🔗 Links
- FR README: README.md

