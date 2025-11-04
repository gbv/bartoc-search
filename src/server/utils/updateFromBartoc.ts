import axios from "axios";
import { createWriteStream, existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { once } from "node:events";
import { createHash } from "node:crypto";
import { timed, sanitizeETagHeader } from "./helpers";
import { pathToFileURL } from "node:url";
import { buildLookupEntries } from "./buildLookupEntries";
import { buildAccessType } from "./buildAccessType";
import { buildDDCLabels } from "./buildDDCLabels";
import { buildListedInLabels } from "./buildListedInLabels";
import { buildBartocApiLabels } from "./buildBartocApiLabels";
import { KEEP_LANGS } from "./helpers";
import { runJskosEnrich } from "./runJskosEnrich";
import { spawn } from "node:child_process";


/** Base configuration with sensible defaults */
const DATA_DIR = process.env.DATA_DIR ?? "data";
export const ART_DIR = path.join(DATA_DIR, "artifacts");
const META_PATH = path.join(ART_DIR, "vocs.last.json"); // metadata persisted between runs
const ENRICH_OUT_NAME = "vocs.enriched.ndjson";

type Source = {
  key: "vocs" | "registries" | "apiTypes" | "accessTypes" | "ddcConcepts";
  url: string;
  kind: "ndjson" | "json";
  snapDir: string;
  metaPath: string;
  ext: ".ndjson" | ".json";
};

const SOURCES: Record<Source["key"], Source> = {
  vocs: {
    key: "vocs",
    url: process.env.BARTOC_NDJSON_URL ?? "https://bartoc.org/data/dumps/latest.ndjson",
    kind: "ndjson",
    snapDir: path.join(DATA_DIR, "snapshots", "vocs"),
    metaPath: path.join(DATA_DIR, "artifacts", "vocs.last.json"),
    ext: ".ndjson",
  },
  registries: {
    key: "registries",
    url: "https://bartoc.org/registries?format=jskos",
    kind: "json",
    snapDir: path.join(DATA_DIR, "snapshots", "registries"),
    metaPath: path.join(DATA_DIR, "artifacts", "registries.last.json"),
    ext: ".json",
  },
  apiTypes: {
    key: "apiTypes",
    url: "https://bartoc.org/api/voc/top?uri=http://bartoc.org/en/node/20002",
    kind: "json",
    snapDir: path.join(DATA_DIR, "snapshots", "apiTypes"),
    metaPath: path.join(DATA_DIR, "artifacts", "apiTypes.last.json"),
    ext: ".json",
  },
  accessTypes: {
    key: "accessTypes",
    url: "https://bartoc.org/api/voc/top?uri=http://bartoc.org/en/node/20001",
    kind: "json",
    snapDir: path.join(DATA_DIR, "snapshots", "accessTypes"),
    metaPath: path.join(DATA_DIR, "artifacts", "accessTypes.last.json"),
    ext: ".json",
  },
  ddcConcepts: {
    key: "ddcConcepts",
    url: "https://bartoc.org/api/voc/concepts?uri=http://bartoc.org/en/node/241&limit=1500",
    kind: "json",
    snapDir: path.join(DATA_DIR, "snapshots", "ddcConcepts"),
    metaPath: path.join(DATA_DIR, "artifacts", "ddcConcepts.last.json"),
    ext: ".json",
  }
};

/** Metadata persisted to support conditional requests on the next run */
interface LastMeta {
  etag: string;
  lastModified: string;
  snapshotPath: string;
  sha256?: string
}


type SnapshotChoice = {
  path: string;
  source: "enriched" | "raw";
  meta?: LastMeta; // only for raw fallback
};

type FetchResult = {
  meta: LastMeta; 
  notModified: boolean; // true when server returned 304 and we reused the old file
};

type EnrichMeta = {
  used: boolean;
  source: "new" | "prev" | "raw";
  file?: string;
  sha256?: string;
  count?: number;
};


/**
 * Download NDJSON snapshot from BARTOC using conditional GET.
 * - If 304 (Not Modified) and the previous file still exists, reuse it.
 * - Otherwise write a new versioned snapshot (date + etag + sha suffix).
 */
async function fetchSnapshotFor(src: Source): Promise<FetchResult> {
  await fs.mkdir(src.snapDir, { recursive: true });
  await fs.mkdir(path.dirname(src.metaPath), { recursive: true });

  const last = await readLastMeta(src.metaPath);

  const res = await axios.get(src.url, {
    responseType: "stream",
    validateStatus: (s) => s < 400 || s === 304,
    headers: {
      ...(last.etag ? { "If-None-Match": last.etag } : {}),
      ...(last.lastModified ? { "If-Modified-Since": last.lastModified } : {}),
      "User-Agent": "bartoc-search-updater/1.0",
      Connection: "close",
    },
  });

  if (res.status === 304 && last.snapshotPath && existsSync(last.snapshotPath)) {
    console.log(`➡️  ${src.key}: 304 Not Modified — reusing ${path.basename(last.snapshotPath)}`);
    return { meta: last, notModified: true };
  }

  const rawEtag = res.headers.etag || "";
  const safeEtag = sanitizeETagHeader(rawEtag);
  const lastModified = res.headers["last-modified"] || "";

  const tmp = path.join(src.snapDir, `tmp-${Date.now()}${src.ext}`);
  const ws = createWriteStream(tmp);
  const hash = createHash("sha256");

  res.data.on("data", (chunk: Buffer) => hash.update(chunk));
  res.data.pipe(ws);
  await once(ws, "finish");

  const sha12 = hash.digest("hex").slice(0, 12);
  const dateIso = new Date().toISOString().slice(0, 10);
  const base = `${dateIso}_${safeEtag}_${sha12}${src.ext}`;
  const finalPath = path.join(src.snapDir, base);
  
  await fs.rename(tmp, finalPath);
  const meta: LastMeta = { etag: rawEtag, lastModified, snapshotPath: finalPath };
  await fs.writeFile(src.metaPath, JSON.stringify(meta, null, 2));
  console.log(`${src.key}: downloaded → ${path.basename(finalPath)}`);
  return { meta, notModified: false };
}


/** Read the last saved META or return an empty default object */
async function readLastMeta(metaPath: string): Promise<LastMeta> {
  try { return JSON.parse(await fs.readFile(metaPath, "utf8")); }
  catch { return { etag: "", lastModified: "", snapshotPath: "" }; }
}

/**
 * Publish versioned artifacts to CURRENT atomically:
 * - Write into a temporary directory.
 * - Rename to `current` (atomic on the same filesystem).
 */
async function publishCurrent(tempDir: string): Promise<void> {
  const CURRENT_DIR = path.join(DATA_DIR, "artifacts", "current");

  // Remove previous CURRENT (idempotent and keeps the state clean)
  await fs.rm(CURRENT_DIR, { recursive: true, force: true });

  // Atomic rename of temp dir into current
  await fs.rename(tempDir, CURRENT_DIR);

  console.log("✅ Artifacts published to", CURRENT_DIR);
}

/** Resolve the best available VOCS input for indexing */
async function resolveVocsInput(): Promise<SnapshotChoice | null> {
  const CURRENT_DIR = path.join(DATA_DIR, "artifacts", "current");
  const enrichedPath = path.join(CURRENT_DIR, "vocs.enriched.ndjson");

  // 1) enriched file published by the Producer
  try {
    await fs.access(enrichedPath);
    return { path: enrichedPath, source: "enriched" };
  } catch { /* no enriched file */ }

  // 2) fallback to last raw snapshot tracked in vocs.last.json
  try {
    const meta = JSON.parse(await fs.readFile(META_PATH, "utf8")) as LastMeta;
    if (meta.snapshotPath && existsSync(meta.snapshotPath)) {
      return { path: meta.snapshotPath, source: "raw", meta };
    }
  } catch { /* no meta or unreadable */ }

  // 3) nothing usable
  return null;
}


// Resolve a snapshot path to use for indexing: prefer local, else (optionally) download
export async function ensureSnapshotForIndexing(): Promise<string> {
  const resolved = await resolveVocsInput();

  if (!resolved) {
    throw new Error("No vocs input found (neither enriched nor raw snapshot).");
  }
  return resolved.path;
  
}

// helper to trigger reindexing via existing script
async function runReindexOnce(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    // "npm run reindex" -> tsx ./src/server/solr/index-once.ts
    const p = spawn("npm", ["run", "reindex"], { stdio: "inherit" });
    p.on("error", reject);
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`reindex exit ${code}`))));
  });
}

async function pathExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}

/**
 * Decide which NDJSON to feed into builders:
 * - Re-enrich if vocs changed OR no enriched file exists (or FORCE_ENRICH=1).
 * - Else reuse the previously published enriched file (copy into tempDir).
 * - If enrichment fails, fall back to raw snapshot.
 */
export async function selectVocsInput({
  vocsSnapshotPath,
  tempDir,
  notModifiedVocs,
  schemesFile = "config/enrich.schemes.json",
  properties = ["subject"],
}: {
  vocsSnapshotPath: string;
  tempDir: string;
  notModifiedVocs: boolean;
  schemesFile?: string;
  properties?: string[];
}): Promise<{ path: string; meta: EnrichMeta }> { 

  const currentEnriched = path.join(ART_DIR, "current", ENRICH_OUT_NAME);
  const mustEnrich = !notModifiedVocs || !(await pathExists(currentEnriched));

  if (mustEnrich) {
    try {
      const { outfile, sha256, count } = await runJskosEnrich(
        vocsSnapshotPath,
        tempDir,
        ENRICH_OUT_NAME,
        { properties, schemesFile, quiet: true }
      );
      console.log(`jskos-enrich: ${path.basename(outfile)} (${count} records)`);
      return { path: outfile, meta: { used: true, source: "new", file: path.basename(outfile), sha256, count } };
    } catch (e) {
      console.warn("jskos-enrich failed — using raw snapshot:", (e as Error).message);
      return { path: vocsSnapshotPath, meta: { used: false, source: "raw" } };
    }
  }

  // Reuse previously published enriched file
  try {
    const reused = path.join(tempDir, ENRICH_OUT_NAME);
    await fs.copyFile(currentEnriched, reused);
    console.log("♻️  Reused previous vocs.enriched.ndjson from artifacts/current");
    return { path: reused, meta: { used: true, source: "prev", file: ENRICH_OUT_NAME } };
  } catch {
    console.log("ℹ️  No previous enriched file — using raw snapshot");
    return { path: vocsSnapshotPath, meta: { used: false, source: "raw" } };
  }

}

/**
 * Main:
 *  1) Fetch snapshot (conditional with ETag/Last-Modified).
 *  2) Build artifacts into a versioned temporary directory.
 *  3) (Optional) Run Solr indexing.
 *  4) Write artifacts.meta.json.
 *  5) Atomically publish to artifacts/current.
 */
async function main(): Promise<void> {

  // fetch both sources (independently tracked)
  const [{ meta: vocsMeta, notModified: notModifiedVocs }, 
    { meta: regMeta, notModified: notModifiedRegs },
    { meta: apiTypesMeta, notModified: notModifiedApitypes}, 
    { meta: accessTypesMeta, notModified: notModifiedAccesstypes},
    { meta: ddcConceptsMeta, notModified: notModifiedDdcConcepts}, ] = await Promise.all([
    timed("Fetching vocs", () => fetchSnapshotFor(SOURCES.vocs)),
    timed("Fetching registries", () => fetchSnapshotFor(SOURCES.registries)),
    timed("Fetching api types", () => fetchSnapshotFor(SOURCES.apiTypes)),
    timed("Fetching access types", () => fetchSnapshotFor(SOURCES.accessTypes)),
    timed("Fetching DDC 100 Concepts", () => fetchSnapshotFor(SOURCES.ddcConcepts)),
  ]);

  const parts: string[] = [];
  if (vocsMeta?.snapshotPath) parts.push(
    path.basename(vocsMeta.snapshotPath, 
    path.extname(vocsMeta.snapshotPath)));
  if (regMeta?.snapshotPath) parts.push(
    path.basename(regMeta.snapshotPath, 
    path.extname(regMeta.snapshotPath)));
  if (apiTypesMeta?.snapshotPath) parts.push(
    path.basename(apiTypesMeta.snapshotPath, 
    path.extname(apiTypesMeta.snapshotPath)));
  if (accessTypesMeta?.snapshotPath) parts.push(
    path.basename(accessTypesMeta.snapshotPath, 
    path.extname(accessTypesMeta.snapshotPath)));
  if (ddcConceptsMeta?.snapshotPath) parts.push(
    path.basename(ddcConceptsMeta.snapshotPath, 
    path.extname(ddcConceptsMeta.snapshotPath)));

  const versionName = parts.join("__") // e.g. 2025-08-28_W-7779d9__2025-08-28_regX
    .replace(/[^A-Za-z0-9._-]+/g, "-") // sanitize
    .slice(0, 120);// keep it short-ish

  const versionDir = path.join(ART_DIR, versionName);
  const tempDir    = `${versionDir}__tmp`;
  await fs.mkdir(tempDir, { recursive: true });
  console.log(`▶️  Building artifacts in temporary dir: ${tempDir}`);
	// let vocsPathForBuilders = vocsMeta.snapshotPath; // default = raw snapshot
	
  const { path: vocsPathForBuilders, meta: enrichMeta } = await selectVocsInput({
    vocsSnapshotPath: vocsMeta.snapshotPath,
    tempDir,
    notModifiedVocs,
    schemesFile: process.env.ENRICH_SCHEMES || "config/enrich.schemes.json",
    properties: ["subject"],
  });

  // Build lookup_entries.json in streaming mode
  await timed("Build lookup_entries.json", () =>
    // buildLookupEntries(vocsMeta.snapshotPath, tempDir)
		buildLookupEntries(vocsPathForBuilders, tempDir)
  );

  // Build access_type.json in streaming mode
  await timed("Build access_type.json", () =>
    buildAccessType(accessTypesMeta.snapshotPath, tempDir)
  );

  // Build ddc-labels.json in streaming mode
  await timed("Build ddc-labels.json", () =>
    buildDDCLabels(ddcConceptsMeta.snapshotPath, tempDir)
  );

  // Build listed_in.json labels in streaming mode
   await timed("Build listed_in.json", () =>
    buildListedInLabels(regMeta.snapshotPath, tempDir)
  );

  // Build listed_in.json labels in streaming mode
   await timed("Build bartoc-api-types-labels.json", () =>
    buildBartocApiLabels(apiTypesMeta.snapshotPath, tempDir)
  );

  // EARLY EXIT: snapshot unchanged and artifacts already published → do nothing
  if (notModifiedVocs) {
    console.log("Vocs Snapshot unchanged — nothing to do.");
  }

  if (notModifiedRegs) {
    console.log("Registries Snapshot unchanged — nothing to do.");  
  }

  if (notModifiedApitypes) {
    console.log("Api types Snapshot unchanged — nothing to do.");  
  }

  if (notModifiedAccesstypes) {
    console.log("Access types Snapshot unchanged — nothing to do.");
  }

  if (notModifiedDdcConcepts) {
    console.log("DDC 100 concepts Snapshot unchanged — nothing to do.");
  }

	const files: string[] = [
    "lookup_entries.json",
    "access_type.json",
    "ddc-labels.json",
    "listed_in.json",
    "bartoc-api-types-labels.json",
  ];

	// If enrichment succeeded, record the enriched file in the manifest list
	if (enrichMeta.used && enrichMeta.file) {
		files.unshift(enrichMeta.file); // put it first for visibility
	}
	
  // Write artifact metadata (useful for healthchecks and debugging)
  const artifactsMeta = {
    generatedAt: new Date().toISOString(),
    keepLangs: KEEP_LANGS,
    sources: {
      vocs: { url: SOURCES.vocs.url, ...vocsMeta },
      registries: { url: SOURCES.registries.url, ...regMeta },
    },
		enriched: enrichMeta,      // <— new: records whether enriched file was used
    files, 
  };
  
	await fs.writeFile(path.join(tempDir, "artifacts.meta.json"), JSON.stringify(artifactsMeta, null, 2), "utf8");

  // 5) Atomic publish
  await publishCurrent(tempDir);

  // Reindex after update
	try {
		console.log("▶️  Reindex after update…");
		await runReindexOnce();
		console.log("✅ Reindex completed.");
	} catch (e) {
		console.error("❌ Reindex failed:", (e as Error).message);
	}

}

function isDirectExec(metaUrl: string): boolean {
  const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
  return metaUrl === entry;
}

export { main as runUpdateOnce };

if (isDirectExec(import.meta.url)) {
  // Only runs when invoked like: `tsx src/server/utils/updateFromBartoc.ts`
  // Will NOT run when the module is imported
  main().catch((e) => {
    console.error("❌ updateFromBartoc failed:", e);
    process.exit(1);
  });
}