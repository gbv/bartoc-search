import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockConfig = vi.hoisted(() => ({ DATA_DIR: "", warn: vi.fn() }));

vi.mock("../../server/conf/conf", () => ({ default: mockConfig }));

describe("loadNkosConcepts with an absolute DATA_DIR", () => {
  beforeEach(async () => {
    mockConfig.DATA_DIR = await fs.mkdtemp(path.join(os.tmpdir(), "bartoc-nkos-"));
    mockConfig.warn.mockClear();
    vi.resetModules();
  });

  afterEach(async () => {
    await fs.rm(mockConfig.DATA_DIR, { recursive: true, force: true });
  });

  it("loads the current NKOS artifact", async () => {
    const artifact = path.join(mockConfig.DATA_DIR, "artifacts", "current", "nkos-type-definitions.json");
    const concepts = [{ uri: "https://example.org/type", prefLabel: { en: "Thesaurus" } }];
    await fs.mkdir(path.dirname(artifact), { recursive: true });
    await fs.writeFile(artifact, JSON.stringify({
      "https://example.org/type": { prefLabel: { en: "Thesaurus" } },
    }));

    const { loadNkosConcepts, getNkosConcepts } = await import("../../server/utils/nskosService");
    expect(await loadNkosConcepts()).toEqual(concepts);
    expect(getNkosConcepts()).toEqual(concepts);
    expect(mockConfig.warn).not.toHaveBeenCalled();
  });

  it("loads the NKOS snapshot when the current artifact is missing", async () => {
    const meta = path.join(mockConfig.DATA_DIR, "artifacts", "nkosTypes.last.json");
    const snapshot = path.join(mockConfig.DATA_DIR, "snapshots", "nkosTypes.json");
    const concepts = [{ uri: "https://example.org/type", prefLabel: { en: "Thesaurus" } }];
    await fs.mkdir(path.dirname(meta), { recursive: true });
    await fs.mkdir(path.dirname(snapshot), { recursive: true });
    await fs.writeFile(meta, JSON.stringify({ snapshotPath: snapshot }));
    await fs.writeFile(snapshot, JSON.stringify(concepts));

    const { loadNkosConcepts } = await import("../../server/utils/nskosService");
    expect(await loadNkosConcepts()).toEqual(concepts);
    expect(mockConfig.warn).not.toHaveBeenCalled();
  });
});
