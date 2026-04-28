import { promises as fs } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function hasCmd(cmd) {
  const r = spawnSync("bash", ["-lc", `command -v ${cmd}`], { encoding: "utf8" });
  return r.status === 0 && r.stdout.trim().length > 0;
}

const ytCmd = hasCmd("yt-dlp") ? "yt-dlp" : hasCmd("youtube-dl") ? "youtube-dl" : null;
if (!ytCmd) {
  console.error("Missing dependency: yt-dlp (recommended) or youtube-dl.");
  console.error('Install (macOS): brew install yt-dlp');
  process.exit(2);
}

const dir = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(process.cwd(), "playlists");
const limit = Number(process.argv[3] ?? "999999");

function parseLineAsRow(line) {
  const cols = line
    .trim()
    .split("|")
    .slice(1, -1)
    .map((c) => c.trim().replace(/\\\|/g, "|"));
  if (cols.length < 6) return null;
  return cols;
}

function parsePlaylistMd(md) {
  const text = md.replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  const headerIdx = lines.findIndex((l) => l.toLowerCase().includes("| artist |") && l.trim().startsWith("|"));
  if (headerIdx === -1) return null;
  const sepIdx = headerIdx + 1;
  if (!lines[sepIdx]?.trim().startsWith("|")) return null;
  const rows = [];
  for (let i = sepIdx + 1; i < lines.length; i++) {
    const l = lines[i];
    if (!l.trim().startsWith("|")) break;
    const cols = parseLineAsRow(l);
    if (!cols) continue;
    rows.push({ lineIndex: i, cols });
  }
  return { lines, rows };
}

function mdEscape(s) {
  return String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

function buildQuery(cols) {
  const artist = cols[1] || "";
  const title = cols[2] || "";
  const album = cols[3] || "";
  return [artist, title, album].filter(Boolean).join(" ").trim();
}

function resolveFirstVideoId(query) {
  const q = query.replace(/"/g, "").trim();
  if (!q) return null;
  const arg = `ytsearch1:${q}`;
  const r = spawnSync(ytCmd, ["--quiet", "--no-warnings", "--get-id", arg], { encoding: "utf8" });
  if (r.status !== 0) return null;
  const id = (r.stdout || "").trim().split("\n")[0]?.trim();
  if (!id) return null;
  if (!/^[a-zA-Z0-9_-]{6,}$/.test(id)) return null;
  return id;
}

async function main() {
  const ents = await fs.readdir(dir, { withFileTypes: true });
  const files = ents
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".md"))
    .map((e) => path.join(dir, e.name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  let changedFiles = 0;
  let filled = 0;
  let scanned = 0;

  for (const file of files) {
    const md = await fs.readFile(file, "utf8");
    const parsed = parsePlaylistMd(md);
    if (!parsed) continue;
    const { lines, rows } = parsed;
    let changed = false;
    for (const r of rows) {
      if (filled >= limit) break;
      scanned++;
      const youtube = r.cols[5] || "";
      if (youtube.trim()) continue;
      const q = buildQuery(r.cols);
      const id = resolveFirstVideoId(q);
      if (!id) continue;
      r.cols[5] = `https://www.youtube.com/watch?v=${id}`;
      const out = `| ${r.cols.map(mdEscape).join(" | ")} |`;
      lines[r.lineIndex] = out;
      changed = true;
      filled++;
      console.log(`${path.basename(file)}: linked: ${q} -> ${id}`);
    }
    if (changed) {
      const out = lines.join("\n");
      await fs.writeFile(file, out, "utf8");
      changedFiles++;
    }
    if (filled >= limit) break;
  }

  console.log(`Done. scanned=${scanned} filled=${filled} files_changed=${changedFiles}`);
}

await main();

