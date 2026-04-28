import { promises as fs } from "node:fs";
import path from "node:path";

const srcDir = process.argv[2];
if (!srcDir) {
  console.error("Usage: node scripts/sync-playlists.mjs <source_dir>");
  process.exit(1);
}

const root = process.cwd();
const dstDir = path.join(root, "playlists");

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function listPlaylistFiles(dir) {
  const out = [];
  async function walk(d) {
    const ents = await fs.readdir(d, { withFileTypes: true });
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.isFile()) {
        const n = e.name.toLowerCase();
        if (n.endsWith(".md") || n.endsWith(".txt")) out.push(p);
      }
    }
  }
  await walk(dir);
  out.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return out;
}

async function copyFile(from, to) {
  await fs.copyFile(from, to);
}

function mdEscape(s) {
  return String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

function parseYearFromName(name) {
  const m = name.match(/(19|20)\d{2}/);
  return m ? Number(m[0]) : null;
}

function parseTxtLine(line) {
  const t = line.trim();
  if (!t) return null;
  const cleaned = t.replace(/^\d+\s*-\s*/, "");
  if (!cleaned) return null;
  if (/^\[(deleted|private)\s+video\]$/i.test(cleaned)) {
    return { artist: "", title: cleaned, album: "", year: null, youtube: "" };
  }
  const parts = cleaned.split(" - ");
  if (parts.length >= 2) {
    const artist = parts.shift().trim();
    const title = parts.join(" - ").trim();
    return { artist, title, album: "", year: null, youtube: "" };
  }
  return { artist: "", title: cleaned, album: "", year: null, youtube: "" };
}

function txtToPlaylistMd(txt, filename) {
  const base = path.basename(filename);
  const year = parseYearFromName(base);
  const title = year ? String(year) : base.replace(/\.(txt|md)$/i, "");
  const id = `import-${title}`.replace(/[^\w.-]+/g, "_");
  const tracks = txt
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map(parseTxtLine)
    .filter(Boolean);

  const lines = [];
  lines.push("---");
  lines.push(`title: ${title}`);
  if (year) lines.push(`year: ${year}`);
  lines.push(`id: ${id}`);
  lines.push("---");
  lines.push("");
  lines.push("| # | artist | title | album | year | youtube |");
  lines.push("| -: | - | - | - | -: | - |");
  tracks.forEach((t, idx) => {
    lines.push(
      `| ${idx + 1} | ${mdEscape(t.artist)} | ${mdEscape(t.title)} | ${mdEscape(
        t.album
      )} | ${t.year ?? ""} | ${mdEscape(t.youtube)} |`
    );
  });
  lines.push("");
  return lines.join("\n");
}

await ensureDir(dstDir);
const filePaths = await listPlaylistFiles(srcDir);
if (!filePaths.length) {
  console.error(`No .md/.txt files found in: ${srcDir}`);
  process.exit(2);
}

const names = [];
for (const p of filePaths) {
  const ext = path.extname(p).toLowerCase();
  const base = path.basename(p, ext);
  const safeBase = base.replace(/[^\w.\-]+/g, "_").slice(0, 120);
  let final = `${safeBase}.md`;
  let i = 1;
  while (names.includes(final)) {
    final = `${safeBase}_${i}.md`;
    i++;
  }
  names.push(final);
  if (ext === ".md") {
    await copyFile(p, path.join(dstDir, final));
  } else if (ext === ".txt") {
    const txt = await fs.readFile(p, "utf8");
    const md = txtToPlaylistMd(txt, path.basename(p));
    await fs.writeFile(path.join(dstDir, final), md, "utf8");
  }
}

const index = { files: names };
await fs.writeFile(path.join(dstDir, "index.json"), JSON.stringify(index, null, 2) + "\n", "utf8");
console.log(`Synced ${names.length} playlist(s) -> playlists/`);
