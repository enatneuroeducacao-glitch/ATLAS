import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { searchLocalKnowledge } from "../lib/knowledge/local-search";

let root = "";
afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
  root = "";
});

describe("searchLocalKnowledge", () => {
  it("finds relevant text and returns a relative source path", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "atlas-knowledge-"));
    await writeFile(path.join(root, "guia.md"), "O protocolo ENAT prioriza percepção de risco no trânsito.");
    const hits = await searchLocalKnowledge("percepção de risco", root);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].source).toBe("guia.md");
    expect(hits[0].excerpt).toContain("percepção de risco");
  });

  it("does not return excluded .env files or excluded directories", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "atlas-knowledge-"));
    await mkdir(path.join(root, "node_modules"), { recursive: true });
    await writeFile(path.join(root, ".env.local"), "frase-super-secreta-xyz");
    await writeFile(path.join(root, "node_modules", "hidden.md"), "frase-super-secreta-xyz");
    await writeFile(path.join(root, "publico.md"), "documentação pública de exemplo");
    const hits = await searchLocalKnowledge("frase-super-secreta-xyz", root);
    expect(hits).toHaveLength(0);
  });

  it("returns no results for a missing directory or blank query", async () => {
    expect(await searchLocalKnowledge("qualquer coisa", path.join(os.tmpdir(), "atlas-nao-existe"))).toEqual([]);
    root = await mkdtemp(path.join(os.tmpdir(), "atlas-knowledge-"));
    expect(await searchLocalKnowledge("   ", root)).toEqual([]);
  });

  it("skips files larger than the configured limit", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "atlas-knowledge-"));
    await writeFile(path.join(root, "grande.md"), "termoalvo ".repeat(60000));
    expect(await searchLocalKnowledge("termoalvo", root)).toEqual([]);
  });
});
