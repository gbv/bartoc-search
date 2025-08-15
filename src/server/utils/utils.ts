import { promises as fsPromises } from "fs";
import * as path from "path";
import { GroupEntry, GroupResult } from "../types/jskos";
import { DynamicOut, PerLangOut, FamilyKey, AggOut } from "../types/solr";
import _ from "lodash";
import {NO_VALUE} from "../conf/conf";

export type JSONObject =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JSONObject }
  | JSONObject[];



/** Convert bytes → megabytes with one decimal place */
export function formatBytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Format an ISO timestamp into a human-friendly string.
 * @param iso  e.g. "2020-08-21T20:13:10.540Z"
 * @returns    e.g. "Aug 21, 2020 8:13 PM UTC"
 */
export function formatTimestamp(iso: string | number | undefined): string {
  if (iso) {
    const date = new Date(iso);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
      hour12: true,
    }).format(date);
  }
  return "";
}
/**
 * Resolves after the given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Convert Solr’s flat facet_fields object
 * into a map of arrays of { value, count }.
 */
export function parseFacetFields(
  facetFields: Record<string, Array<string|number>> | undefined
): Record<string, { value: string; count: number }[]> {
  if (!facetFields) return {};

  const out: Record<string, { value: string; count: number }[]> = {};
  for (const [fieldName, rawArr] of Object.entries(facetFields)) {
    const buckets: { value: string; count: number }[] = [];
    for (let i = 0; i < rawArr.length; i += 2) {
      let value = rawArr[i]   as string;
      const count = rawArr[i+1] as number;
      if (count > 0) {
        if (value === null) {
          value = NO_VALUE;
        }
        buckets.push({ value, count });
      }
    }
    out[fieldName] = buckets;
  }
  // drop “Concept Scheme” from the KOS type facet
  if (out.type_uri) {
    out.type_uri = out.type_uri.filter(f => f.value !== "http://www.w3.org/2004/02/skos/core#ConceptScheme");
  }
  
  return out;
}

/**
 * Asynchronously read & parse any JSON file.
 * @param filePath Relative or absolute path to a .json file
 * @returns The parsed JSON object of type T (default unknown)
 */
export async function loadJSONFile<T = unknown>(
  filePath: string
): Promise<T> {
  const fullPath = path.join(process.cwd(), filePath);
  const data = await fsPromises.readFile(fullPath, "utf8");
  // JSON.parse returns unknown, which we then assert to T
  return JSON.parse(data) as T;
  
}

/**
 * Find the group for a given URI. Used for license URIs, formats, etc.
 * @param uri The URI to be mapped
 * @param jsonGroups The array of GroupEntry objects to search in
 * @returns An object with `key` and `label`
 */
export function mapUriToGroups(uri: string, jsonGroups: GroupEntry[]): GroupResult {
  const entry = _.find(jsonGroups, (item) => _.includes(item.uris, uri));
  if (entry) {
    return { key: entry.key, label: entry.label };
  }
  return { key: "unknown", label: "Other / Unspecified" };
}



type SolrField = Record<string, unknown>;

/**
 * Extracts groups from a document and maps them to the target field.
 * @param doc The document to extract groups from
 * @param sourceField The field in the document containing URIs
 * @param targetField The field to store the mapped group labels
 * @param groups The array of GroupEntry objects to map against
 * @param mapFn Function to map URIs to group labels
 */
export function extractGroups(
  doc: SolrField,
  sourceField: string,
  targetField: string,
  groups: GroupEntry[],
  mapFn: (uri: string, groups: GroupEntry[]) => GroupResult
) {
  
  const values: string[] = Array.isArray(doc[sourceField]) ? doc[sourceField] as string[] : [];
  const grouped = values.map((u) => ({
      uri: u,
      ...mapFn(u, groups)
    }));

  doc[targetField] = grouped.map((g) => g.label);

}

// Helpers
/** Trims a value if it’s a string; returns "" for non-strings. */
export const trimSafe = (s: unknown): string => (typeof s === "string" ? s.trim() : "");

/** True if the string is non-empty. */
export const nonempty = (s: string) => s.length > 0;

/** Returns a new array with duplicates removed, preserving order. */
export const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));


/**
 * Emits per-language dynamic fields (<family>_<lang>) and a language-agnostic
 * aggregate field. Overwrites existing values in `out`.
 *
 * Input:
 *  - `langMap`: Record<string, string[]> (e.g., altLabel by language)
 *  - `out`:     target object to mutate (e.g., your Solr doc)
 *  - `family`:  dynamic family prefix (e.g., "altLabel")
 *  - `aggregateField`: aggregate field name (e.g., "alt_labels_ss")
 * 
 */
export function applyLangMap<F extends string, A extends string>(
  langMap: Record<string, string[]>,
  out: DynamicOut<F, A>,
  family: F,
  aggregateField: A
): void {
  const perLang: PerLangOut<F> = {};
  const aggregate: string[] = [];

  for (const [lang, values] of Object.entries(langMap)) {
    // Clean and validate the values for this language
    const cleaned = values.map(trimSafe).filter(nonempty);
    if (!cleaned.length) continue;

    // Field name for this language
    const key = `${family}_${lang}` as FamilyKey<F>;

    // Overwrite per-language field with de-duplicated values
    perLang[key] = uniq(cleaned);

     // Collect into aggregate. i.e. alt_labels_ss
    aggregate.push(...cleaned);
  }

  Object.assign(out, perLang);
  
  // Overwrite aggregate field (de-duplicated)
  if (aggregate.length) {
    (out as AggOut<A>)[aggregateField] = uniq(aggregate); // overwrite aggregate
  }

}
