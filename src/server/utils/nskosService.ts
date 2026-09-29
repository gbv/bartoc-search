import fs from "node:fs/promises";
import path from "path";
import config from "../conf/conf";
import { NkosNotInitializedError } from "../errors/errors";

type JskosConcept = {
  uri?: string;
  prefLabel?: Record<string, string>;
  [key: string]: unknown;
};

const NKOS_TYPES_ARTIFACT = path.join(
  process.cwd(),
  config.DATA_DIR,
  "artifacts",
  "current",
  "nkos-type-definitions.json",
);

const NKOS_TYPES_META = path.join(
  process.cwd(),
  config.DATA_DIR,
  "artifacts",
  "nkosTypes.last.json",
);

let cache: JskosConcept[] | null = null;

/**
 * Reads and parses a JSON file from disk.
 *
 * The return type stays unknown so callers must validate or normalize the
 * payload before using it as NKOS concept data.
 */
async function loadJson(filePath: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

/**
 * Loads the NKOS type snapshot referenced by the metadata file.
 *
 * This is the fallback path when the current artifact file is unavailable.
 */
async function loadNkosTypesSnapshot(): Promise<unknown> {
  const meta = await loadJson(NKOS_TYPES_META) as { snapshotPath?: string };
  if (!meta.snapshotPath) {
    throw new Error("NKOS type snapshot metadata has no snapshotPath");
  }
  return loadJson(meta.snapshotPath);
}

/**
 * Normalizes raw NKOS data into concept objects without validating them.
 *
 * The source can be either an array of concepts or an object keyed by URI.
 * Entries are retained as received instead of being validated or filtered.
 */
function asConcepts(data: unknown): JskosConcept[] {
  const values = Array.isArray(data)
    ? data
    : Object.entries(data as Record<string, unknown>).map(([uri, concept]) => ({
      uri,
      ...(concept as Record<string, unknown>),
    }));

  return values as JskosConcept[];
}

/**
 * Loads NKOS concepts into the in-memory cache.
 *
 * It first tries the current artifact file, then falls back to the latest
 * snapshot referenced by metadata. If both reads fail, it keeps the application
 * running with an empty cache and logs a warning.
 *
 * Subsequent calls return the cached array without reading from disk again.
 */
export async function loadNkosConcepts(): Promise<JskosConcept[]> {
  if (!cache) {
    try {
      cache = asConcepts(await loadJson(NKOS_TYPES_ARTIFACT));
    } catch {
      try {
        cache = asConcepts(await loadNkosTypesSnapshot());
      } catch (error) {
        config.warn?.(
          `Could not load NKOS type concepts: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        cache = [];
      }
    }
  }
  return cache;
}

/**
 * Returns the NKOS concepts already loaded into memory.
 *
 * This function intentionally does not read files or initialize the cache.
 * Call loadNkosConcepts() first during application startup; otherwise this
 * throws so callers do not silently continue without NKOS enrichment data.
 */
export function getNkosConcepts(): JskosConcept[] {
  if (!cache) {
    throw new NkosNotInitializedError();
  }
  return cache;
}
