import fs from "fs";
import readline from "readline";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const NDJSON_FILE_PATH = join(__dirname, "../../../data/ddc100.concepts.ndjson");
const JSON_FILE_PATH = join(__dirname, "../../../data/ddc-labels.json");



/**
 * Represents a JSKOS subject entry.
 */
export interface JskosSubject {
  uri:      string;
  notation?: string[];
  inScheme?: { uri: string }[];
}

/**
 * Options to control how DDC notations are extracted.
 */
export interface ExtractDdcOptions {
  /**
   * If true, returns only single-digit "root" classes (0–9), deduped.
   * Otherwise returns all notations.
   * @default false
   */
  rootLevel?: boolean;
}

/**
 * Dewey Decimal Classification base scheme URI.
 */
export const DDC_SCHEME = "http://dewey.info/class/";

/**
 * Extract Dewey Decimal notations from an array of JSKOS subjects.
 *
 * @param subjects - Array of JSKOS subject objects.
 * @param options.rootLevel - If true, only single-digit root classes are returned.
 * @returns Array of notation strings. If rootLevel is true, these are deduped single digits.
 *
 * @example
 * const subjects = [
 *   { uri: "http://dewey.info/class/7/e23/", notation: ["7"] },
 *   { uri: "http://dewey.info/class/700/e23/", notation: ["700"] },
 *   { uri: "http://eurovoc.europa.eu/1367", notation: ["1367"] },
 * ];
 *
 * extractDdc(subjects);
 * // -> ["7", "700"]
 *
 * extractDdc(subjects, { rootLevel: true });
 * // -> ["7"]
 */

export function extractDdc(
  subjects: JskosSubject[] | undefined,
  options: ExtractDdcOptions = {}
): string[] {
  const { rootLevel = false } = options;
  if (!Array.isArray(subjects)) return [];

  // Filter to only Dewey subjects and flatten their notations
  let notations = subjects
    .filter(
      (s): s is JskosSubject =>
        typeof s.uri === "string" && s.uri.startsWith(DDC_SCHEME)
    )
    .flatMap((s) => s.notation ?? []);

  if (rootLevel) {
    // Map to first digit, keep only 0-9, dedupe
    const rootSet = new Set<string>();
    for (const n of notations) {
      const digit = String(n).charAt(0);
      if (/^[0-9]$/.test(digit)) {
        rootSet.add(digit);
      }
    }
    notations = Array.from(rootSet);
  }

  return notations;
}

/** The shape of code→labels map */
export interface DdcLabelsMap {
  [code: string]: string
}

let cache: DdcLabelsMap | null = null;


/**
 * Load (and cache) DDC labels from an NDJSON dump.
 * @param ndjsonPath - Path to NDJSON file.
 */
export async function getDdcLabels(
  ndjsonPath: string = path.resolve(NDJSON_FILE_PATH)
): Promise<DdcLabelsMap> {
  if (cache) return cache;

  const map: DdcLabelsMap = {};
  const fileStream = fs.createReadStream(ndjsonPath, { encoding: "utf8" });

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line);
      // pick the primary notation code
      const code = Array.isArray(rec.notation) ? rec.notation[0] : undefined;
      const labels = rec.prefLabel["en"];
      if (typeof code === "string" && labels && typeof labels === "string") {
        map[code] = labels;
      }
    } catch (e) {
      console.log(e);
    }
  }

  cache = map;


  fs.writeFileSync(JSON_FILE_PATH, JSON.stringify(map, null, 2), "utf8");
  console.log(`✅ Wrote ${Object.keys(map).length} DDC labels to ${JSON_FILE_PATH}`);

  return map;
}


