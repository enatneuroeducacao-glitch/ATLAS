import "server-only";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const ALLOWED_EXTENSIONS = new Set([
  ".md", ".mdx", ".txt", ".json", ".ts", ".tsx", ".js", ".jsx",
  ".mjs", ".cjs", ".py", ".sql", ".prisma", ".html", ".css", ".scss",
  ".yml", ".yaml", ".toml", ".xml", ".csv",
]);
const EXCLUDED_DIRS = new Set([
  ".git", "node_modules", ".next", "dist", "build", "coverage",
  ".venv", "venv", "__pycache__", ".cache", "vendor",
]);
const EXCLUDED_FILES = new Set([
  ".env", ".env.local", ".env.production", "id_rsa", "id_ed25519",
]);
const SECRET_NAME = /(secret|credential|password|token|private[-_]?key|\.pem$|\.p12$|\.pfx$)/i;
const MAX_FILES = 5000;
const MAX_FILE_BYTES = 512 * 1024;
const MAX_RESULTS = 8;

export type KnowledgeHit = {
  source: string;
  excerpt: string;
  score: number;
};

function isExcluded(name: string): boolean {
  return EXCLUDED_DIRS.has(name) || EXCLUDED_FILES.has(name) ||
    name.startsWith(".env.") || SECRET_NAME.test(name);
}

function termsOf(query: string): string[] {
  return [...new Set(query.toLocaleLowerCase("pt-BR")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .match(/[a-z0-9_./-]{2,}/g) ?? [])].slice(0, 20);
}

function normalize(value: string): string {
  return value.toLocaleLowerCase("pt-BR")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

async function collectFiles(root: string): Promise<string[]> {
  const found: string[] = [];
  const pending = [root];
  while (pending.length && found.length < MAX_FILES) {
    const current = pending.pop()!;
    let entries;
    try { entries = await readdir(current, { withFileTypes: true }); }
    catch { continue; }
    for (const entry of entries) {
      if (isExcluded(entry.name)) continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(absolute);
      else if (entry.isFile() && ALLOWED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        found.push(absolute);
        if (found.length >= MAX_FILES) break;
      }
    }
  }
  return found;
}

export async function searchLocalKnowledge(query: string, root = process.env.ATLAS_KNOWLEDGE_DIR): Promise<KnowledgeHit[]> {
  const terms = termsOf(query);
  if (!terms.length || !root) return [];
  const safeRoot = path.resolve(root);
  try {
    const info = await stat(safeRoot);
    if (!info.isDirectory()) return [];
  } catch { return []; }

  const files = await collectFiles(safeRoot);
  const hits: KnowledgeHit[] = [];
  for (const file of files) {
    try {
      const info = await stat(file);
      if (info.size > MAX_FILE_BYTES) continue;
      const text = await readFile(file, "utf8");
      if (!text.trim() || text.includes("\u0000")) continue;
      const normalized = normalize(text);
      let score = 0;
      for (const term of terms) {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const matches = normalized.match(new RegExp(escaped, "g"))?.length ?? 0;
        score += Math.min(matches, 8) * (term.length >= 6 ? 2 : 1);
      }
      if (!score) continue;
      const firstTerm = terms.find(term => normalized.includes(term))!;
      const position = normalized.indexOf(firstTerm);
      const start = Math.max(0, position - 280);
      const originalStart = Math.min(start, text.length);
      const excerpt = text.slice(originalStart, originalStart + 900).trim();
      hits.push({
        source: path.relative(safeRoot, file).split(path.sep).join("/"),
        excerpt,
        score,
      });
    } catch { /* Ignore unreadable or changing files. */ }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS);
}
