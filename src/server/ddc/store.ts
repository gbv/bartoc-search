import fs from "node:fs";
import path from "node:path";
import { loadJSONFile } from "../utils/utils";
import { DdcConcept, DdcRef, LangMap } from "./types";
import { DdcLastMeta } from "./types";



/**
 * Raw representation of a DDC concept as stored in the precomputed snapshot.
 *
 * This is close to the original JSKOS data generated from BARTOC DDC:
 *  - `notation`, `prefLabel` and `broader` come directly from JSKOS.
 *  - `memberSet` contains URIs of related components (e.g. table numbers).
 *
 * Transform this raw structure into our internal DdcConcept below.
 */
interface RawDdcConcept {
  uri: string;
  notation?: string[];
  prefLabel?: LangMap;
  broader?: { uri: string; notation?: string[] }[];
  memberSet?: { uri: string }[];
}

/**
 * DdcStore keeps all DDC concepts in memory, enriched with:
 *  - expanded ancestor chains (as DdcRef[] with prefLabel),
 *  - memberSet concepts with labels.
 *
 * It is designed to be loaded once during application startup and then used
 * for fast lookups by DdcEnricher.expandUris().
 */
export class DdcStore {
  private byUri = new Map<string, DdcConcept>();

  /**
   * Load DDC concepts from a JSON file and build a DdcStore.
   *
   * The file can be:
   *  - explicitly configured via $DDC_CONCEPTS_FILE, or
   *  - discovered via "data/artifacts/ddcConcepts.last.json"
   *    which is written by the updateFromBartoc snapshot job.
   *
   * The JSON is expected to be an array of RawDdcConcept.
  */
  static async fromjson(): Promise<DdcStore> {
    const store = new DdcStore();
    const filePath = await this.resolveDdcFile();

    console.log(`📂 Loading DDC concepts from ${filePath}...`);

    const rawData = await loadJSONFile<RawDdcConcept[]>(filePath);

    const rawByUri = new Map<string, RawDdcConcept>();
    for (const c of rawData) {
      rawByUri.set(c.uri, c);
    }

    /**
     * turn a RawDdcConcept into a DdcRef (uri + prefLabel).
     * We only copy the fields needed by DdcExpansion (labels and uri).
     */
    const makeRef = (c: RawDdcConcept | undefined): DdcRef | undefined => {
      if (!c) return undefined;
      return {
        uri: c.uri,
        prefLabel: c.prefLabel,
      };
    };

    /** 
    build the full ancestor chain starting from `start`.
     *
     * We repeatedly follow `broader[0]`:
     *   971 → 97 → 9 → (no broader) → stop
     *
     * The result is an array of DdcRef in top-down order:
     *   [
     *     { uri: ".../97/e23/", prefLabel: { en: "History of North America" } },
     *     { uri: ".../9/e23/",  prefLabel: { en: "History & geography" } }
     *   ]
     */
    const buildAncestors = (start: RawDdcConcept): DdcRef[] => {
      const result: DdcRef[] = [];
      const seen = new Set<string>();
      let current: RawDdcConcept | undefined = start;

      while (current?.broader && current.broader[0]) {
        const bUri = current.broader[0].uri;
        if (!bUri || seen.has(bUri)) break;
        seen.add(bUri);

        const b = rawByUri.get(bUri);
        if (!b) break;

        const ref = makeRef(b);
        if (ref) result.push(ref);

        current = b;
      }

      return result;
    };

    // Build enriched DdcConcept objects and store them in `byUri`.
    for (const raw of rawData) {
      const ancestors = buildAncestors(raw);

      /**
       * Memberset: resolve each referenced URI to a RawDdcConcept and
       * keep its prefLabel so that expandDdcConcept can provide labels
       * at rank2.
       *
       * Example from DDC:
       *   971 ("Canada") → memberSet:
       *     - 9     ("History & geography")
       *     - 2--71 ("Canada")
       */
      const memberSet: DdcRef[] =
        raw.memberSet
          ?.map(m => makeRef(rawByUri.get(m.uri)))
          .filter((x): x is DdcRef => !!x) ?? [];

      const concept: DdcConcept = {
        uri: raw.uri,
        notation: raw.notation,
        prefLabel: raw.prefLabel,
        ancestors,
        memberSet,
      };

      store.byUri.set(concept.uri, concept);
    }

    return store;
  }

  /**
   * Resolve the path to the DDC concepts file.
   */
  static async resolveDdcFile(): Promise<string> {
    // Explicit override via environment:
    //    useful for local debugging or custom snapshot locations.
    if (process.env.DDC_CONCEPTS_FILE) {
      return process.env.DDC_CONCEPTS_FILE;
    }

    // Normal path: read snapshot metadata written by updateFromBartoc.
    const DATA_DIR = process.env.DATA_DIR ?? "data";
    const metaPath = path.join(DATA_DIR, "artifacts", "ddcConcepts.last.json");

    const raw = await fs.promises.readFile(metaPath, "utf8").catch(err => {
      throw new Error(
        `Cannot load DDC meta at ${metaPath}: ${String(err)}`
      );
    });

    let meta: DdcLastMeta;
    try {
      meta = JSON.parse(raw) as DdcLastMeta;
    } catch (err) {
      throw new Error(
        `Invalid JSON in DDC meta file ${metaPath}: ${String(err)}`
      );
    }

    if (!meta.snapshotPath) {
      throw new Error(
        `Missing snapshotPath in DDC meta file ${metaPath}`
      );
    }

  return meta.snapshotPath;
}

  get(uri: string): DdcConcept | undefined {
    return this.byUri.get(uri);
  }
}
