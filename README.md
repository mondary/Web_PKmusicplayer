# PK Music Player (V2)

![Project icon](icon.png)

[🇫🇷 FR](README.md) · [🇬🇧 EN](README_en.md)

✨ Lecteur musique web (vanilla) piloté par playlists Markdown, avec navigation **Playlists** + **Artistes → Albums → Titres**, et récupération automatique des liens YouTube quand une musique “disparaît”.

## ✅ Fonctionnalités
- Import de playlists `.md` (plusieurs fichiers) + export de la playlist active en `.md`
- Navigation **Playlists** ou **Artistes → Albums → Titres** (bibliothèque générée depuis toutes les playlists)
- Lecture via YouTube IFrame Player (URL ou `videoId`)
- 🔁 Auto‑résolution d’un lien manquant via YouTube Data API (si clé fournie)
- Outils CLI: conversion `.txt` → `.md`, sync d’un dossier, remplissage automatique de liens via `yt-dlp` (optionnel)

## 🧠 Utilisation
1) Lancer un serveur statique:

```bash
python3 -m http.server 5173
```

2) Ouvrir:
- `http://localhost:5173/`

3) Charger tes playlists:
- `Import MD` (fichiers `.md`)
- ou `Load demo` (lit `playlists/index.json`)

## 🧾 Format playlist (Markdown)
Recommandé: table + frontmatter optionnel.

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

Alternative (simple): lignes en liste.

```md
- Daft Punk — One More Time | album: Discovery | year: 2000 | yt: https://youtu.be/FGBhQbmPwH8
```

## ⚙️ Réglages
### Clé YouTube (recommandé)
Deux options:
- UI: `Options` → colle la clé dans **YouTube Data API → API KEY**
- Fichier: édite `secrets/config.json` (`youtubeApiKey`) puis recharge la page

Ce que ça débloque:
- Si une track n’a pas de lien YouTube, le player peut **chercher** automatiquement (YouTube Data API) et **stocker** l’URL trouvée dans l’état local.

## 🔁 Récupération / auto‑résolution
- Sans clé: `Find` → ouvre la recherche YouTube → colle l’URL → `Use this link`
- Avec clé: clique une track “Missing link” → résolution auto (1er résultat) → lecture

## 🧰 Scripts
### Sync d’un dossier (Desktop dump) → `playlists/`
Le navigateur ne peut pas lire `/Users/...` directement.

```bash
node scripts/sync-playlists.mjs "/Users/clm/Desktop/drive-download-20260427T093453Z-3-001"
```

Puis `Load demo`.

### Auto‑fill via `yt-dlp` (optionnel, sans API key)
Remplit les liens manquants en local (par lot).

```bash
brew install yt-dlp
node scripts/resolve-youtube.mjs playlists 50
```

Le 2e argument = nombre max de liens à remplir (friendly rate‑limit).

## 🧾 Changelog
- 2026-04-27: V2 UI + navigation artistes/albums + options drawer + auto‑résolution YouTube (clé)

## 🔗 Liens
- EN README: README_en.md
