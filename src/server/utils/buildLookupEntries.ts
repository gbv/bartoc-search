import fs from "node:fs/promises";
import path from "node:path";
import { createWriteStream, createReadStream } from "node:fs";
import * as readline from "node:readline";
import { once } from "node:events";
import { ConceptSchemeDocument } from "../types/jskos";
import { KEEP_LANGS } from "./helpers";

/** Minimal subset of the JSKOS record we need here */
interface LookupEntry {
  uri: string;
  identifier?: (string | null)[];
  namespace?: string;
  prefLabel?: Record<string, string>;
}

/**
 * Build (streaming) lookup_entries.json from the snapshot:
 * - Writes a JSON array incrementally (no buffering of the entire file).
 * - Each entry: { uri, identifier[], prefLabel{...}, namespace? }.
 */
export async function buildLookupEntries(
  snapshotPath: string,
  outDir: string
): Promise<void> {
  await fs.mkdir(outDir, { recursive: true });

  const outPath = path.join(outDir, "lookup_entries.json");
  const ws = createWriteStream(outPath, { encoding: "utf8" });

  // Start JSON array
  ws.write("[\n");
  let first = true;

  // NDJSON line-by-line streaming
  const rl = readline.createInterface({
    input: createReadStream(snapshotPath),
    crlfDelay: Infinity,
  });

  console.log("snapshotPath =>", snapshotPath);


  for await (const line of rl) {
    const t = line.trim();
    if (!t) continue;

    let jskosRecord: ConceptSchemeDocument;
    try {
      jskosRecord = JSON.parse(t);
    } catch {
      // Malformed line: skip
      continue;
    }

    const uri = jskosRecord.uri;
    if (!uri) continue;

    const lookupEntry: LookupEntry = {
      uri,
      identifier: jskosRecord.identifier,
      prefLabel: pickLabels(jskosRecord.prefLabel, KEEP_LANGS),
      namespace: jskosRecord.namespace
    };

    const json = JSON.stringify(lookupEntry);
    ws.write(first ? `  ${json}` : `,\n  ${json}`);
    first = false;
  }

  // Close JSON array
  ws.write("\n]\n");
  ws.end();
  await once(ws, "finish");
}

/**
 * Keep only selected languages in prefLabel (e.g., en,de),
 * and if none of them exist, fall back to the first available label.
 */
function pickLabels(
  all?: Record<string, string>,
  keep: string[] = KEEP_LANGS
): Record<string, string> {
  if (!all) return {};
  const out: Record<string, string> = {};
  for (const l of keep) if (all[l]) out[l] = all[l]!;
  if (!Object.keys(out).length) {
    const [k] = Object.keys(all);
    if (k) out[k] = all[k]!;
  }
  return out;
}

