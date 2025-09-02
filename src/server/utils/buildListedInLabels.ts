// src/server/utils/buildListedIn.ts
import fs from "node:fs/promises";
import path from "node:path";
import { LangMap } from "../types/jskos";


// API endpoints sometimes include extra dates
interface RegistryAPI {
  type: string;     // e.g. "http://bartoc.org/api-type/jskos"
  url: string;      // endpoint URL
  startDate?: string;
  endDate?: string;
}

// Some fields use JSKOS-like refs
type SubjectRef = { uri: string } | string;

export interface RegistryEntry {
  uri: string;                         // repeated self-URI
  url?: string;

  prefLabel?: LangMap; // { en: "Title", de?: "…" }
  altLabel?: LangMap; // { en: ["A", "B"] }
  definition?: LangMap; // { en: ["…", "…"] }

  identifier?: string[]; // URIs/IDs
  subject?: SubjectRef[]; // [{ uri: "…" }] or ["…"]
  type?: string[]; // RDF types as URIs

  API?: RegistryAPI[]; // API descriptors
  startDate?: string; // year or ISO date
  endDate?: string;

  "@context"?: unknown; // JSON-LD context if present

  // Forward-compatibility for occasional extra fields
  [prop: string]: unknown;
}

// The file you showed is a map from registry URI -> entry
export type RegistryIndex = Record<string, RegistryEntry>;


export async function loadRegistryIndex(filePath: string): Promise<RegistryIndex> {
  const text = await fs.readFile(filePath, "utf8");
  const data = JSON.parse(text);
  if (!data || typeof data !== "object") {
    throw new Error("Invalid registry index JSON");
  }
  return data as RegistryIndex;
}


/**
 * Build ${outDir}/listedIn.json as { [partOf.uri]: "Label" }.
 * Label priority:
 *   1) prefLabel of the record with uri === partOf.uri
 *   2) inline label inside partOf object (prefLabel/label/name) if present
 *   3) fallback derived from the URI
 */
export async function buildListedInLabels(
  snapshotPath: string,
  outDir: string
): Promise<number> {
  // ensure paths
  await fs.mkdir(outDir, { recursive: true });
  const finalPath = path.join(outDir, "listed_in.json");
  const tmpPath = finalPath + ".tmp";

  // load the registries index (object keyed by registry URI)
  const registryIdx = await loadRegistryIndex(snapshotPath);

  // compose mapping { uri -> label }
  const out: Record<string, string[]> = {};
  for (const [uri, entry] of Object.entries(registryIdx)) {
    out[uri] = entry.prefLabel?.en ?? [];
  }

  // atomic write
  await fs.writeFile(tmpPath, JSON.stringify(out, null, 2), "utf8");
  await fs.rename(tmpPath, finalPath);

  return Object.keys(out).length;
}

