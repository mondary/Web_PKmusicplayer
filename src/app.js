// moved from /app.js (root) to /src/app.js
// NOTE: internal fetches use absolute paths (/) so this file can live under /src.

const STORE_KEY = "pkmp.v1";

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function toast(title, sub = "", type = "good") {
  const host = document.getElementById("toasts");
  const el = document.createElement("div");
  el.className = `toast toast--${type === "bad" ? "bad" : "good"}`;
  el.innerHTML = `<div class="toast__title"></div><div class="toast__sub"></div>`;
  el.querySelector(".toast__title").textContent = title;
  el.querySelector(".toast__sub").textContent = sub;
  host.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function formatTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function parseYouTubeId(url) {
  if (!url) return null;
  const s = String(url).trim();
  const m1 = s.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
  if (m1) return m1[1];
  const m2 = s.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
  if (m2) return m2[1];
  const m3 = s.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/);
  if (m3) return m3[1];
  const m4 = s.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/);
  if (m4) return m4[1];
  if (/^[a-zA-Z0-9_-]{6,}$/.test(s)) return s;
  return null;
}

function trackLabel(t) {
  const a = t.artist?.trim() || "Unknown artist";
  const ti = t.title?.trim() || "Unknown title";
  return `${a} — ${ti}`;
}

function mdEscape(s) {
  return String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

function serializePlaylistToMd(pl) {
  const lines = [];
  lines.push("---");
  lines.push(`title: ${pl.title ?? ""}`);
  if (pl.year != null) lines.push(`year: ${pl.year}`);
  lines.push(`id: ${pl.id}`);
  lines.push("---");
  lines.push("");
  lines.push("| # | artist | title | album | year | youtube |");
  lines.push("| -: | - | - | - | -: | - |");
  pl.tracks.forEach((t, idx) => {
    lines.push(
      `| ${idx + 1} | ${mdEscape(t.artist)} | ${mdEscape(t.title)} | ${mdEscape(
        t.album
      )} | ${t.year ?? ""} | ${mdEscape(t.youtube ?? "")} |`
    );
  });
  lines.push("");
  return lines.join("\n");
}

function parseFrontmatter(md) {
  const text = md.replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) return { meta: {}, body: text };
  const end = text.indexOf("\n---\n", 4);
  if (end === -1) return { meta: {}, body: text };
  const fm = text.slice(4, end).trim();
  const body = text.slice(end + 5);
  const meta = {};
  for (const line of fm.split("\n")) {
    const i = line.indexOf(":");
    if (i === -1) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (!k) continue;
    meta[k] = v;
  }
  return { meta, body };
}

function parseMdTable(mdBody) {
  const text = mdBody.replace(/\r\n/g, "\n");
  const lines = text.split("\n").map((l) => l.trim());
  const headerIdx = lines.findIndex((l) =>
    l.toLowerCase().startsWith("|") && l.toLowerCase().includes("| artist |")
  );
  if (headerIdx === -1) return null;
  const sepIdx = headerIdx + 1;
  if (!lines[sepIdx] || !lines[sepIdx].startsWith("|")) return null;
  const out = [];
  for (let i = sepIdx + 1; i < lines.length; i++) {
    const l = lines[i];
    if (!l.startsWith("|")) break;
    const cols = l
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim().replace(/\\\|/g, "|"));
    if (cols.length < 6) continue;
    const maybeIdx = Number(cols[0]);
    const artist = cols[1] || "";
    const title = cols[2] || "";
    const album = cols[3] || "";
    const year = cols[4] ? Number(cols[4]) : null;
    const youtube = cols[5] || "";
    if (!artist && !title && !youtube) continue;
    out.push({
      id: uid(),
      idx: Number.isFinite(maybeIdx) ? maybeIdx : out.length + 1,
      artist,
      title,
      album,
      year: Number.isFinite(year) ? year : null,
      youtube: youtube || null,
      status: "unknown",
    });
  }
  return out;
}

function parseMdKeyLines(mdBody) {
  const lines = mdBody.replace(/\r\n/g, "\n").split("\n");
  const tracks = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith("-")) continue;
    const payload = line.replace(/^-+\s*/, "");
    if (!payload) continue;
    const parts = payload.split("|").map((p) => p.trim());
    const base = parts.shift() ?? "";

    const t = {
      id: uid(),
      artist: "",
      title: "",
      album: "",
      year: null,
      youtube: null,
      status: "unknown",
    };

    const dash = base.split("—").length > 1 ? "—" : "-";
    const [a, b] = base.split(dash).map((s) => s.trim());
    if (b != null) {
      t.artist = a ?? "";
      t.title = b ?? "";
    } else {
      t.title = base;
    }

    for (const p of parts) {
      const i = p.indexOf(":");
      if (i === -1) continue;
      const k = p.slice(0, i).trim().toLowerCase();
      const v = p.slice(i + 1).trim();
      if (k === "artist") t.artist = v;
      else if (k === "title") t.title = v;
      else if (k === "album") t.album = v;
      else if (k === "year") {
        const n = Number(v);
        t.year = Number.isFinite(n) ? n : null;
      } else if (k === "yt" || k === "youtube" || k === "url") t.youtube = v;
    }
    tracks.push(t);
  }
  return tracks.length ? tracks : null;
}

function parsePlaylistMd(md, filename = "playlist.md") {
  const { meta, body } = parseFrontmatter(md);
  const title =
    meta.title ||
    filename.replace(/\.md$/i, "").replace(/[_-]+/g, " ").trim();
  const year = meta.year ? Number(meta.year) : null;
  const id = meta.id || uid();

  let tracks = parseMdTable(body);
  if (!tracks) tracks = parseMdKeyLines(body);
  if (!tracks) tracks = [];
  tracks.forEach((t, i) => {
    t.idx = i + 1;
    t.youtubeId = parseYouTubeId(t.youtube);
  });
  return {
    id,
    title,
    year: Number.isFinite(year) ? year : null,
    filename,
    tracks,
    updatedAt: Date.now(),
  };
}

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw)
      return {
        playlists: [],
        activePlaylistId: null,
        activeTrackId: null,
        ytApiKey: "",
      };
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") throw new Error("bad store");
    data.playlists ??= [];
    return data;
  } catch {
    return { playlists: [], activePlaylistId: null, activeTrackId: null, ytApiKey: "" };
  }
}

function saveStore() {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

let store = loadStore();

const els = {
  playlistList: document.getElementById("playlistList"),
  artistList: document.getElementById("artistList"),
  albumList: document.getElementById("albumList"),
  tabPlaylists: document.getElementById("tabPlaylists"),
  tabArtists: document.getElementById("tabArtists"),
  playlistPane: document.getElementById("playlistPane"),
  artistPane: document.getElementById("artistPane"),
  trackRows: document.getElementById("trackRows"),
  activePlaylistTitle: document.getElementById("activePlaylistTitle"),
  activePlaylistMeta: document.getElementById("activePlaylistMeta"),
  trackFilter: document.getElementById("trackFilter"),
  btnImport: document.getElementById("btnImport"),
  btnExport: document.getElementById("btnExport"),
  btnLoadDemo: document.getElementById("btnLoadDemo"),
  btnOptions: document.getElementById("btnOptions"),
  fileInput: document.getElementById("fileInput"),
  nowTitle: document.getElementById("nowTitle"),
  nowSub: document.getElementById("nowSub"),
  btnPrev: document.getElementById("btnPrev"),
  btnPlayPause: document.getElementById("btnPlayPause"),
  playPauseGlyph: document.getElementById("playPauseGlyph"),
  btnNext: document.getElementById("btnNext"),
  progressBar: document.getElementById("progressBar"),
  progressFill: document.getElementById("progressFill"),
  timeCur: document.getElementById("timeCur"),
  timeDur: document.getElementById("timeDur"),
  btnFind: document.getElementById("btnFind"),
  btnCopy: document.getElementById("btnCopy"),
  vol: document.getElementById("vol"),
  drawer: document.getElementById("drawer"),
  btnDrawerClose: document.getElementById("btnDrawerClose"),
  optYtKey: document.getElementById("optYtKey"),
  optJamendo: document.getElementById("optJamendo"),
  optSoundcloud: document.getElementById("optSoundcloud"),
  dlgSearch: document.getElementById("dlgSearch"),
  searchHint: document.getElementById("searchHint"),
  btnOpenSearch: document.getElementById("btnOpenSearch"),
  pasteUrl: document.getElementById("pasteUrl"),
  btnApplyLink: document.getElementById("btnApplyLink"),
  btnClearLink: document.getElementById("btnClearLink"),
};

els.vol.value = String(store.volume ?? 70);
store.apis ??= { youtubeKey: "", jamendoClientId: "", soundcloudClientId: "" };
store.nav ??= { mode: "playlists", artist: null, album: null };
if (els.optYtKey) els.optYtKey.value = store.apis.youtubeKey ?? "";
if (els.optJamendo) els.optJamendo.value = store.apis.jamendoClientId ?? "";
if (els.optSoundcloud) els.optSoundcloud.value = store.apis.soundcloudClientId ?? "";

function setNavMode(mode) {
  store.nav.mode = mode;
  saveStore();
  render();
}
els.tabPlaylists?.addEventListener("click", () => setNavMode("playlists"));
els.tabArtists?.addEventListener("click", () => setNavMode("artists"));

async function loadSecretsConfig() {
  try {
    const res = await fetch("/secrets/config.json", { cache: "no-store" });
    if (!res.ok) return;
    const cfg = await res.json();
    const yt = String(cfg?.youtubeApiKey ?? "").trim();
    const jam = String(cfg?.jamendoClientId ?? "").trim();
    const sc = String(cfg?.soundcloudClientId ?? "").trim();
    if (yt) store.apis.youtubeKey = yt;
    if (jam) store.apis.jamendoClientId = jam;
    if (sc) store.apis.soundcloudClientId = sc;
    saveStore();
    if (els.optYtKey) els.optYtKey.value = store.apis.youtubeKey ?? "";
    if (els.optJamendo) els.optJamendo.value = store.apis.jamendoClientId ?? "";
    if (els.optSoundcloud) els.optSoundcloud.value = store.apis.soundcloudClientId ?? "";
  } catch {
    // ignore
  }
}

function openDrawer() {
  if (!els.drawer) return;
  lastFocus = document.activeElement;
  els.drawer.setAttribute("aria-hidden", "false");
  els.drawer.removeAttribute("inert");
  document.body.style.overflow = "hidden";
  setTimeout(() => els.btnDrawerClose?.focus(), 0);
}
function closeDrawer() {
  if (!els.drawer) return;
  els.drawer.setAttribute("aria-hidden", "true");
  els.drawer.setAttribute("inert", "");
  document.body.style.overflow = "";
  setTimeout(() => (els.btnOptions ?? lastFocus)?.focus?.(), 0);
}
let lastFocus = null;

els.btnOptions?.addEventListener("click", () => openDrawer());
els.btnDrawerClose?.addEventListener("click", () => closeDrawer());
els.drawer?.addEventListener("click", (ev) => {
  if (ev.target === els.drawer) closeDrawer();
});
window.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && els.drawer?.getAttribute("aria-hidden") === "false") closeDrawer();
});

function setApiField(key, val) {
  store.apis ??= {};
  store.apis[key] = String(val ?? "").trim();
  saveStore();
}
els.optYtKey?.addEventListener("input", () => setApiField("youtubeKey", els.optYtKey.value));
els.optJamendo?.addEventListener("input", () => setApiField("jamendoClientId", els.optJamendo.value));
els.optSoundcloud?.addEventListener("input", () => setApiField("soundcloudClientId", els.optSoundcloud.value));

function getActivePlaylist() {
  return store.playlists.find((p) => p.id === store.activePlaylistId) || null;
}

function findTrackRefById(trackId) {
  if (!trackId) return null;
  for (const pl of store.playlists) {
    const t = (pl.tracks ?? []).find((x) => x.id === trackId);
    if (t) return { playlist: pl, track: t };
  }
  return null;
}

function getActiveTrack() {
  const ref = findTrackRefById(store.activeTrackId);
  return ref?.track ?? null;
}

function setActivePlaylist(id) {
  store.activePlaylistId = id;
  const pl = getActivePlaylist();
  store.activeTrackId = pl?.tracks[0]?.id ?? null;
  saveStore();
  render();
  if (pl?.tracks[0]) cueTrack(pl.tracks[0], { autoplay: false });
}

function normKey(s) {
  return String(s ?? "").trim().toLowerCase();
}

function buildLibrary() {
  const tracks = [];
  for (const pl of store.playlists) {
    for (const t of pl.tracks ?? []) {
      tracks.push({ ...t, __playlistId: pl.id, __playlistTitle: pl.title, __playlistYear: pl.year });
    }
  }
  const byArtist = new Map();
  for (const t of tracks) {
    const artistName = String(t.artist ?? "").trim() || "Unknown artist";
    const artistKey = normKey(artistName) || "unknown-artist";
    const albumName = String(t.album ?? "").trim() || "(no album)";
    const albumKey = normKey(albumName) || "no-album";
    let artist = byArtist.get(artistKey);
    if (!artist) {
      artist = { key: artistKey, name: artistName, albums: new Map(), count: 0 };
      byArtist.set(artistKey, artist);
    }
    artist.count++;
    let album = artist.albums.get(albumKey);
    if (!album) {
      album = { key: albumKey, name: albumName, tracks: [] };
      artist.albums.set(albumKey, album);
    }
    album.tracks.push(t);
  }
  const artists = [...byArtist.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  for (const a of artists) {
    a.albumList = [...a.albums.values()].sort((x, y) => x.name.localeCompare(y.name, undefined, { sensitivity: "base" }));
  }
  return { artists };
}

function setActiveArtist(artistKey) {
  store.nav.artist = artistKey;
  store.nav.album = null;
  saveStore();
  render();
}

function setActiveAlbum(albumKey) {
  store.nav.album = albumKey;
  saveStore();
  render();
}

function buildYouTubeQuery(t) {
  const parts = [t.artist, t.title, t.album].map((s) => String(s ?? "").trim()).filter(Boolean);
  return parts.join(" ").trim();
}

async function resolveYouTubeLink(trackId) {
  const key = String(store.apis?.youtubeKey ?? "").trim();
  if (!key) return { ok: false, reason: "missing_key" };
  const ref = findTrackRefById(trackId);
  if (!ref) return { ok: false, reason: "missing_track" };
  const { playlist, track } = ref;
  if (track._resolveTried && !track.youtube) return { ok: false, reason: "already_tried" };
  track._resolveTried = true;
  saveStore();

  const q = buildYouTubeQuery(track);
  if (!q) return { ok: false, reason: "missing_metadata" };

  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("type", "video");
    url.searchParams.set("maxResults", "1");
    url.searchParams.set("q", q);
    url.searchParams.set("key", key);
    const res = await fetch(url.toString());
    if (!res.ok) return { ok: false, reason: `http_${res.status}` };
    const data = await res.json();
    const vid = data?.items?.[0]?.id?.videoId;
    if (!vid) return { ok: false, reason: "no_results" };

    track.youtube = `https://www.youtube.com/watch?v=${vid}`;
    track.youtubeId = vid;
    track.status = "unknown";
    playlist.updatedAt = Date.now();
    saveStore();
    return { ok: true, videoId: vid };
  } catch (e) {
    return { ok: false, reason: String(e?.message ?? e) };
  }
}

function setActiveTrack(id, opts = { autoplay: true }) {
  store.activeTrackId = id;
  saveStore();
  render();
  const t = getActiveTrack();
  if (!t) return;
  t.youtubeId = parseYouTubeId(t.youtube);
  if (!t.youtubeId) {
    t.status = "missing";
    saveStore();
    render();
    if (opts.autoplay) {
      resolveYouTubeLink(id).then((r) => {
        if (!r.ok) {
          if (r.reason !== "missing_key") toast("Missing YouTube link", r.reason, "bad");
          render();
          return;
        }
        const t2 = getActiveTrack();
        if (t2?.id === id) cueTrack(t2, { autoplay: true });
        render();
      });
    }
    return;
  }
  cueTrack(t, opts);
}

function matchesFilter(t, q) {
  if (!q) return true;
  const hay = `${t.artist ?? ""} ${t.title ?? ""} ${t.album ?? ""} ${t.year ?? ""}`.toLowerCase();
  return hay.includes(q.toLowerCase());
}

function renderStatusTag(t) {
  if (t.status === "ok") return `<span class="tag tag--good">OK</span>`;
  if (t.status === "bad") return `<span class="tag tag--bad">Unavailable</span>`;
  if (t.status === "missing") return `<span class="tag tag--bad">Missing link</span>`;
  return `<span class="tag">—</span>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
}

function render() {
  const pl = getActivePlaylist();
  els.btnExport.disabled = store.playlists.length === 0;
  els.btnFind.disabled = !getActiveTrack();
  els.btnCopy.disabled = !getActiveTrack();

  const mode = store.nav?.mode === "artists" ? "artists" : "playlists";
  els.tabPlaylists?.setAttribute("aria-selected", mode === "playlists" ? "true" : "false");
  els.tabArtists?.setAttribute("aria-selected", mode === "artists" ? "true" : "false");
  if (els.playlistPane) els.playlistPane.hidden = mode !== "playlists";
  if (els.artistPane) els.artistPane.hidden = mode !== "artists";

  if (els.playlistList) {
    els.playlistList.innerHTML = "";
    const ordered = [...store.playlists].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
    for (const p of ordered) {
      const pill = document.createElement("div");
      pill.className = "pill" + (p.id === store.activePlaylistId ? " pill--active" : "");
      pill.setAttribute("role", "listitem");
      const name = document.createElement("div");
      name.className = "pill__name";
      name.textContent = p.title || "Untitled";
      const meta = document.createElement("div");
      meta.className = "pill__meta";
      meta.textContent = `${p.tracks.length} tracks${p.year ? ` · ${p.year}` : ""}`;
      pill.append(name, meta);
      pill.addEventListener("click", () => setActivePlaylist(p.id));
      els.playlistList.appendChild(pill);
    }
  }

  const lib = buildLibrary();
  if (els.artistList && els.albumList) {
    els.artistList.innerHTML = "";
    els.albumList.innerHTML = "";

    const activeArtistKey = store.nav.artist ?? lib.artists[0]?.key ?? null;
    if (activeArtistKey && store.nav.artist !== activeArtistKey) {
      store.nav.artist = activeArtistKey;
      saveStore();
    }

    for (const a of lib.artists) {
      const pill = document.createElement("div");
      pill.className = "pill" + (a.key === store.nav.artist ? " pill--active" : "");
      pill.setAttribute("role", "listitem");
      const name = document.createElement("div");
      name.className = "pill__name";
      name.textContent = a.name;
      const meta = document.createElement("div");
      meta.className = "pill__meta";
      meta.textContent = `${a.count}`;
      pill.append(name, meta);
      pill.addEventListener("click", () => setActiveArtist(a.key));
      els.artistList.appendChild(pill);
    }

    const activeArtist = lib.artists.find((a) => a.key === store.nav.artist) || null;
    const albums = activeArtist?.albumList ?? [];
    const activeAlbumKey = store.nav.album ?? albums[0]?.key ?? null;
    if (activeAlbumKey && store.nav.album !== activeAlbumKey) {
      store.nav.album = activeAlbumKey;
      saveStore();
    }
    for (const al of albums) {
      const pill = document.createElement("div");
      pill.className = "pill" + (al.key === store.nav.album ? " pill--active" : "");
      pill.setAttribute("role", "listitem");
      const name = document.createElement("div");
      name.className = "pill__name";
      name.textContent = al.name;
      const meta = document.createElement("div");
      meta.className = "pill__meta";
      meta.textContent = `${al.tracks.length}`;
      pill.append(name, meta);
      pill.addEventListener("click", () => setActiveAlbum(al.key));
      els.albumList.appendChild(pill);
    }
  }

  const mode2 = store.nav?.mode === "artists" ? "artists" : "playlists";
  if (mode2 === "playlists") {
    if (!pl) {
      els.activePlaylistTitle.textContent = "No playlist loaded";
      els.activePlaylistMeta.textContent = "Import one or more .md playlists.";
    } else {
      els.activePlaylistTitle.textContent = pl.title;
      els.activePlaylistMeta.textContent = `${pl.tracks.length} tracks${pl.year ? ` · ${pl.year}` : ""} · ${pl.filename || "—"}`;
    }
  } else {
    const lib2 = buildLibrary();
    const a = lib2.artists.find((x) => x.key === store.nav.artist) || null;
    const al = a?.albumList?.find((x) => x.key === store.nav.album) || null;
    els.activePlaylistTitle.textContent = a?.name || "Unknown artist";
    els.activePlaylistMeta.textContent = al ? `${al.name} · ${al.tracks.length} tracks` : "Select an album.";
  }

  els.trackRows.innerHTML = "";
  const q = els.trackFilter.value.trim();
  let tracks = [];
  if (mode2 === "playlists") {
    if (!pl) return;
    tracks = (pl.tracks ?? []).filter((t) => matchesFilter(t, q));
  } else {
    const lib3 = buildLibrary();
    const a = lib3.artists.find((x) => x.key === store.nav.artist) || null;
    const al = a?.albumList?.find((x) => x.key === store.nav.album) || null;
    tracks = (al?.tracks ?? []).map((t, idx) => ({ ...t, idx: idx + 1 })).filter((t) => matchesFilter(t, q));
    if (!tracks.length) return;
    if (!store.activeTrackId) {
      store.activeTrackId = tracks[0].id;
      saveStore();
    }
  }

  for (const t of tracks) {
    const row = document.createElement("div");
    row.className = "row" + (t.id === store.activeTrackId ? " row--active" : "");
    row.innerHTML = `
      <div class="row__idx">${t.idx}</div>
      <div>${t.artist ? `<span class="row__title">${escapeHtml(t.artist)}</span>` : `<span class="meta">—</span>`}</div>
      <div>${t.title ? `<span class="row__title">${escapeHtml(t.title)}</span>` : `<span class="meta">—</span>`}</div>
      <div>${t.album ? escapeHtml(t.album) : `<span class="meta">—</span>`}</div>
      <div>${t.year ?? `<span class="meta">—</span>`}</div>
      <div>${renderStatusTag(t)}</div>
    `;
    row.addEventListener("click", () => setActiveTrack(t.id, { autoplay: true }));
    els.trackRows.appendChild(row);
  }

  const at = getActiveTrack();
  if (!at) {
    els.nowTitle.textContent = "—";
    els.nowSub.textContent = "—";
  } else {
    els.nowTitle.textContent = at.title || "Unknown title";
    els.nowSub.textContent = `${at.artist || "Unknown artist"}${at.album ? ` · ${at.album}` : ""}${at.year ? ` · ${at.year}` : ""}`;
  }
}

// import/export
els.btnImport.addEventListener("click", () => els.fileInput.click());
els.fileInput.addEventListener("change", async () => {
  const files = [...(els.fileInput.files ?? [])];
  if (!files.length) return;
  const imported = [];
  for (const f of files) {
    const text = await f.text();
    imported.push(parsePlaylistMd(text, f.name));
  }
  for (const p of imported) {
    const idx = store.playlists.findIndex((x) => x.id === p.id);
    if (idx !== -1) store.playlists[idx] = p;
    else store.playlists.push(p);
  }
  if (!store.activePlaylistId && store.playlists[0]) store.activePlaylistId = store.playlists[0].id;
  const pl = getActivePlaylist();
  if (pl && !store.activeTrackId) store.activeTrackId = pl.tracks[0]?.id ?? null;
  saveStore();
  render();
  toast("Imported playlists", `${imported.length} file(s)`, "good");
  els.fileInput.value = "";
});

els.btnExport.addEventListener("click", () => {
  if (!store.playlists.length) return;
  const pl = getActivePlaylist();
  if (!pl) return;
  const md = serializePlaylistToMd(pl);
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  const safe = (pl.title || "playlist").replace(/[^\w.-]+/g, "_");
  a.download = `${safe}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast("Exported", `${a.download}`, "good");
});

els.btnLoadDemo.addEventListener("click", async () => {
  try {
    const res = await fetch("/playlists/index.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const idx = await res.json();
    if (!Array.isArray(idx?.files) || idx.files.length === 0) throw new Error("No demo files");
    const imported = [];
    for (const file of idx.files) {
      const r = await fetch(`/playlists/${file}`, { cache: "no-store" });
      if (!r.ok) continue;
      const text = await r.text();
      imported.push(parsePlaylistMd(text, file));
    }
    if (!imported.length) throw new Error("No demo imported");
    for (const p of imported) store.playlists.push(p);
    store.activePlaylistId = imported[0].id;
    store.activeTrackId = imported[0].tracks[0]?.id ?? null;
    saveStore();
    render();
    toast("Demo loaded", `${imported.length} playlist(s)`, "good");
  } catch (e) {
    toast("Demo load failed", String(e?.message ?? e), "bad");
  }
});

// youtube player
let ytPlayer = null;
let tickTimer = null;

function initYouTube() {
  if (ytPlayer || !window.YT?.Player) return;
  const host = document.getElementById("ytPlayerHost");
  ytPlayer = new YT.Player(host, {
    width: 2,
    height: 2,
    videoId: "",
    playerVars: { autoplay: 0, controls: 0, modestbranding: 1, rel: 0 },
    events: {
      onReady: () => {
        startTick();
        setVolume(store.volume ?? 70);
        const t = getActiveTrack();
        if (t) cueTrack(t, { autoplay: false });
      },
      onStateChange: (ev) => {
        const st = ev.data;
        if (st === YT.PlayerState.PLAYING) els.playPauseGlyph.textContent = "Pause";
        else if (st === YT.PlayerState.PAUSED || st === YT.PlayerState.ENDED) {
          els.playPauseGlyph.textContent = "Play";
          if (st === YT.PlayerState.ENDED) next();
        }
      },
      onError: () => {
        const t = getActiveTrack();
        if (!t) return;
        t.status = "bad";
        saveStore();
        render();
        toast("Video unavailable", trackLabel(t), "bad");
      },
    },
  });
}

window.onYouTubeIframeAPIReady = () => initYouTube();
initYouTube();

function cueTrack(t, { autoplay }) {
  if (!ytPlayer) return;
  t.youtubeId = parseYouTubeId(t.youtube);
  if (!t.youtubeId) {
    t.status = "missing";
    saveStore();
    render();
    return;
  }
  t.status = "unknown";
  saveStore();
  render();
  try {
    ytPlayer.cueVideoById(t.youtubeId);
    if (autoplay) ytPlayer.playVideo();
  } catch (e) {
    toast("Player error", String(e?.message ?? e), "bad");
  }
}

function startTick() {
  if (tickTimer) return;
  tickTimer = setInterval(() => {
    if (!ytPlayer || typeof ytPlayer.getCurrentTime !== "function") return;
    const cur = ytPlayer.getCurrentTime?.() ?? 0;
    const dur = ytPlayer.getDuration?.() ?? 0;
    const pct = dur > 0 ? Math.min(100, Math.max(0, (cur / dur) * 100)) : 0;
    els.progressFill.style.width = `${pct}%`;
    els.timeCur.textContent = formatTime(cur);
    els.timeDur.textContent = formatTime(dur);
  }, 250);
}

function setVolume(v) {
  const vol = Math.max(0, Math.min(100, Number(v)));
  store.volume = vol;
  saveStore();
  try {
    ytPlayer?.setVolume?.(vol);
  } catch {}
}

els.btnPlayPause.addEventListener("click", () => {
  if (!ytPlayer) return;
  const t = getActiveTrack();
  if (!t?.youtubeId) {
    const key = String(store.apis?.youtubeKey ?? "").trim();
    if (!key) {
      toast("Missing YouTube link", "Add YouTube API key in Options or use Find", "bad");
      return;
    }
    toast("Resolving…", buildYouTubeQuery(t) || "search", "good");
    resolveYouTubeLink(t.id).then((r) => {
      if (!r.ok) {
        toast("Resolve failed", r.reason, "bad");
        render();
        return;
      }
      const t2 = getActiveTrack();
      if (t2?.id === t.id) cueTrack(t2, { autoplay: true });
      render();
    });
    return;
  }
  const st = ytPlayer.getPlayerState?.();
  if (st === YT.PlayerState.PLAYING) ytPlayer.pauseVideo();
  else ytPlayer.playVideo();
});

els.vol.addEventListener("input", () => setVolume(els.vol.value));
els.btnPrev.addEventListener("click", () => prev());
els.btnNext.addEventListener("click", () => next());

els.progressBar.addEventListener("click", (ev) => {
  if (!ytPlayer) return;
  const dur = ytPlayer.getDuration?.() ?? 0;
  if (!Number.isFinite(dur) || dur <= 0) return;
  const r = els.progressBar.getBoundingClientRect();
  const x = Math.min(r.width, Math.max(0, ev.clientX - r.left));
  const pct = r.width > 0 ? x / r.width : 0;
  const sec = dur * pct;
  try {
    ytPlayer.seekTo?.(sec, true);
  } catch {}
});

function prev() {
  const pl = getActivePlaylist();
  const t = getActiveTrack();
  if (!pl || !t) return;
  const idx = pl.tracks.findIndex((x) => x.id === t.id);
  const nextIdx = idx <= 0 ? pl.tracks.length - 1 : idx - 1;
  setActiveTrack(pl.tracks[nextIdx].id, { autoplay: true });
}

function next() {
  const pl = getActivePlaylist();
  const t = getActiveTrack();
  if (!pl || !t) return;
  const idx = pl.tracks.findIndex((x) => x.id === t.id);
  const nextIdx = idx >= pl.tracks.length - 1 ? 0 : idx + 1;
  setActiveTrack(pl.tracks[nextIdx].id, { autoplay: true });
}

els.trackFilter.addEventListener("input", () => render());

els.btnCopy.addEventListener("click", async () => {
  const t = getActiveTrack();
  if (!t?.youtube) return;
  try {
    await navigator.clipboard.writeText(String(t.youtube));
    toast("Copied", "YouTube link in clipboard", "good");
  } catch {
    toast("Copy failed", "Browser blocked clipboard", "bad");
  }
});

els.btnFind.addEventListener("click", async () => {
  const t = getActiveTrack();
  if (!t) return;
  const q = buildYouTubeQuery(t);
  if (!q) {
    toast("Missing metadata", "Need artist/title for search", "bad");
    return;
  }
  els.searchHint.textContent = `Search: ${q}`;
  els.pasteUrl.value = t.youtube ?? "";
  els.dlgSearch.showModal();
});

els.btnOpenSearch.addEventListener("click", () => {
  const t = getActiveTrack();
  if (!t) return;
  const q = buildYouTubeQuery(t);
  const url = new URL("https://www.youtube.com/results");
  url.searchParams.set("search_query", q);
  window.open(url.toString(), "_blank", "noopener,noreferrer");
});

els.btnApplyLink.addEventListener("click", () => {
  const tRef = findTrackRefById(store.activeTrackId);
  if (!tRef) return;
  const { playlist, track } = tRef;
  const val = els.pasteUrl.value.trim();
  const id = parseYouTubeId(val);
  if (!id) {
    toast("Bad YouTube link", "Paste watch URL, youtu.be URL, shorts URL, or video id", "bad");
    return;
  }
  const newUrl = val.startsWith("http") ? val : `https://www.youtube.com/watch?v=${id}`;
  track.youtube = newUrl;
  track.youtubeId = id;
  track.status = "unknown";
  playlist.updatedAt = Date.now();
  saveStore();
  render();
  cueTrack(track, { autoplay: true });
  toast("Link set", trackLabel(track), "good");
  els.dlgSearch.close();
});

els.btnClearLink.addEventListener("click", () => {
  const tRef = findTrackRefById(store.activeTrackId);
  if (!tRef) return;
  const { playlist, track } = tRef;
  track.youtube = null;
  track.youtubeId = null;
  track.status = "missing";
  playlist.updatedAt = Date.now();
  saveStore();
  render();
  toast("Cleared", trackLabel(track), "good");
});

// init
if (!store.activePlaylistId && store.playlists[0]) store.activePlaylistId = store.playlists[0].id;
const pl0 = getActivePlaylist();
if (pl0 && !store.activeTrackId) store.activeTrackId = pl0.tracks[0]?.id ?? null;
saveStore();
loadSecretsConfig();
render();

