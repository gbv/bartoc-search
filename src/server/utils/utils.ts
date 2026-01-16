import { promises as fsPromises } from "fs";
import * as path from "path";
import {GroupEntry, GroupResult, Distributions, Subject } from "../types/jskos";
import { DynamicOut, PerLangOut, FamilyKey, AggOut, UriOut, DistributionsOut, SolrDocument } from "../types/solr";
import _ from "lodash";
import {NO_VALUE} from "../conf/conf";
import config from "../conf/conf";
import fs from "node:fs/promises";

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
 * Split a value (string or array) into a flat list of tokens using one or more delimiters.
 *
 * - Accepts strings like "en,it|de" or arrays like ["en,it", "de|fr"].
 * - Supports multiple delimiters via `delims` (default: pipes and commas).
 * - Trims whitespace, removes empty tokens, and ignores non-string inputs.
 * - Drops any trailing delimiters (e.g., "en,it,|" → "en,it").
 */
export function splitMulti(v: unknown, delims = /[|,]/): string[] {
  // If it's an array, recursively split each element and flatten the result.
  if (Array.isArray(v)) return v.flatMap(x => splitMulti(x, delims));

  // Non-string inputs yield no tokens.
  if (typeof v !== "string") return [];

  return v
    // Remove any trailing delimiters like "..." or "...||" to avoid empty tokens at the end.
    .replace(/[|,]+$/, "")
    // Split by the provided delimiters (pipe and/or comma by default).
    .split(delims)
    // Trim each token and drop blanks that may result from consecutive delimiters.
    .map(s => s.trim())
    .filter(Boolean);
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
  
  let fullPath: string;

  if (path.isAbsolute(filePath)) {
    fullPath = filePath;
  } else {
    if (filePath.startsWith("usr/src/app/")) {
      fullPath = "/" + filePath;
    } else {
      fullPath = path.join(process.cwd(), filePath);
    }
  }

  try {
    const data = await fsPromises.readFile(fullPath, "utf8");
    return JSON.parse(data) as T;
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(
        `Invalid JSON in file ${fullPath}: ${err.message}`
      );
    }
    throw err;
  }
}

function isErrnoException(e: unknown): e is NodeJS.ErrnoException {
  return e instanceof Error && "code" in e;
}

export async function loadJSONFileSafe<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    if (!raw.trim()) {
      config.warn?.(`⚠️ Empty JSON file: ${filePath} -> using fallback`);
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch (e: unknown) {
    const code = isErrnoException(e) ? e.code : undefined;
    const message = e instanceof Error ? e.message : String(e);

    if (code === "ENOENT") {
      config.warn?.(`⚠️ Missing ${filePath} -> using fallback`);
      return fallback;
    }

    config.warn?.(`⚠️ Failed to load/parse ${filePath} -> using fallback: ${message}`);
    return fallback;
  }
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


// Minimal JSKOS agent shape used by both contributor and creator
type PrefLabelMap = Record<string, string[] | string>;

// An Agent can be a contributor or a creator or whatever has a similar JSKOS structure to those properties
type Agent = { uri?: string; prefLabel?: PrefLabelMap };

/**
 * Emit URIs + per-language labels + aggregate for a list of agents.
 * Overwrites existing values in `out`.
 */
export function applyAgents<F extends string, A extends string, U extends string>(
  agents: Agent[] | undefined,
  out: (DynamicOut<F, A> & UriOut<U>),
  family: F,
  aggregateField: A,
  uriField: U
): void {
  const list = agents ?? [];
  if (!list.length) return;

  // 1) URIs (trim + dedupe)
  const uris = Array.from(new Set(list.map(a => trimSafe(a.uri)).filter(nonempty)));
  if (uris.length) {
    // Narrow to `UriOut<U>` for this write to avoid `never` from the intersection
    const outUris: UriOut<U> = out;
    outUris[uriField] = uris;
  }

  // 2) Build language map from all prefLabels
  const langMap: Record<string, string[]> = {};
  for (const a of list) {
    if (!a.prefLabel) continue;
    for (const [lang, vals] of Object.entries(a.prefLabel)) {
      const arr = (Array.isArray(vals) ? vals : [vals])
        .map(trimSafe)
        .filter(nonempty);
      if (arr.length) langMap[lang] = (langMap[lang] ?? []).concat(arr);
    }
  }

  // 3) Emit <family>_<lang> + aggregate (overwrite)
  if (Object.keys(langMap).length) {
    applyLangMap(langMap, out, family, aggregateField);
  }
}

export function applyDistributions(
  src: { distributions?: Distributions[] },
  out: DistributionsOut
): void {
  const list = src.distributions ?? [];
  if (!list.length) return;

  const downloads = uniq(
    list.map(d => trimSafe(d.download)).filter(nonempty)
  );
  if (downloads.length) out.distributions_download_ss = downloads;

  const formats = uniq(
    list.map(d => trimSafe(d.format)).filter(nonempty)
  );
  if (formats.length) out.distributions_format_ss = formats;

  const mimes = uniq(
    list.map(d => trimSafe(d.mimetype).toLowerCase())
        .filter(nonempty)
  );
  if (mimes.length) out.distributions_mimetype_ss = mimes;
}

// Output typing for prefLabel fields
type PrefOut = DynamicOut<"pref_label","pref_labels_ss">;

/** Emit prefLabel_<lang> (dynamic) + pref_labels_ss (aggregate). */
export function applyPrefLabel(
  src: { prefLabel?: Record<string, string> },
  out: PrefOut
): void {
  const map = src.prefLabel ?? {};
  const langMap: Record<string, string[]> = {};

  for (const [lang, val] of Object.entries(map)) {
    const s = trimSafe(val);
    if (s) (langMap[lang] ??= []).push(s);
  }

  if (Object.keys(langMap).length) {
    applyLangMap(langMap, out, "pref_label", "pref_labels_ss");
  }
}

type PublisherOut =
  DynamicOut<"publisher","publisher_labels_ss"> &
  UriOut<"publisher_uri_ss">;

export function applyPublishers(
  src: { publisher?: { uri?: string; prefLabel?: Record<string, string[] | string> }[] },
  out: PublisherOut
) {
  applyAgents(
    src.publisher,
    out,
    "publisher",       
    "publisher_labels_ss",   
    "publisher_uri_ss"
  );
}

type SubjectOf = { url?: string };
type SubjectOfOut = {
  subject_of_url_ss?: string[];
  subject_of_host_ss?: string[];
};


export function applySubjectOf(
  src: { subjectOf?: SubjectOf[] },
  out: SubjectOfOut
): void {
  const list = src.subjectOf ?? [];
  if (!list.length) return;

  const urls = uniq(
    list.map(x => trimSafe(x.url))
        .filter(u => /^https?:\/\//i.test(u)) // keep http(s) only
  );
  if (urls.length) out.subject_of_url_ss = urls;

  const hosts = uniq(
    urls.map(u => {
      try { 
        return new URL(u).hostname.toLowerCase(); 
      } catch { 
        return ""; 
      }}).filter(nonempty)
  );
  if (hosts.length) out.subject_of_host_ss = hosts;
}

type SubjectOut = DynamicOut<"subject_label","subject_labels_ss"> & Partial<SolrDocument> ;

export function applySubject(
  src: { subject?: Subject[] },
  out: SubjectOut
): void {
  const list = src.subject ?? [];
  if (!list.length) return;

  const uris: string[] = [];
  const notations: string[] = [];
  const schemes: string[] = [];
  const broaderUris: string[] = [];
  const broaderNotations: string[] = [];
  const topConceptOf: string[] = [];
  const types: string[] = [];
  const contexts: string[] = [];
  const labelMap: Record<string, string[]> = {}; // lang -> labels

  for (const s of list) {
    // URIs & notations
    const u = trimSafe(s.uri); if (u) uris.push(u);
    (s.notation ?? []).forEach(n => { const v = trimSafe(n); if (v) notations.push(v); });

    // Labels (collect all langs; if only 'en' exists, that's fine)
    for (const [lang, val] of Object.entries(s.prefLabel ?? {})) {
      const arr = Array.isArray(val) ? val : [val];
      const cleaned = arr.map(trimSafe).filter(nonempty);
      if (cleaned.length) labelMap[lang] = (labelMap[lang] ?? []).concat(cleaned);
    }

    // inScheme URIs
    (s.inScheme ?? []).forEach(r => {
      const v = trimSafe(r.uri); if (v) schemes.push(v);
    });

    // broader URIs & notations (immediate)
    (s.broader ?? []).forEach(b => {
      const bu = trimSafe(b.uri); if (bu) broaderUris.push(bu);
      (b.notation ?? []).forEach(n => { const v = trimSafe(n); if (v) broaderNotations.push(v); });
    });

    // topConceptOf URIs
    (s.topConceptOf ?? []).forEach(r => {
      const v = trimSafe(r.uri); if (v) topConceptOf.push(v);
    });

    // RDF types
    (s.type ?? []).forEach(t => { const v = trimSafe(t); if (v) types.push(v); });

    // @context (optional; store-only)
    const ctx = s["@context"];
    if (typeof ctx === "string") {
      const v = trimSafe(ctx); if (v) contexts.push(v);
    } else if (Array.isArray(ctx)) {
      ctx.map(trimSafe).filter(nonempty).forEach(v => contexts.push(v));
    }
  }

  // Write fields (deduped)
  if (uris.length)               out.subject_uri = uniq(uris);
  if (notations.length)          out.subject_notation = uniq(notations);
  if (schemes.length)            out.subject_scheme = uniq(schemes);
  if (broaderUris.length)        out.subject_broader_uri_ss = uniq(broaderUris);
  if (broaderNotations.length)   out.subject_broader_notation_ss = uniq(broaderNotations);
  if (topConceptOf.length)       out.subject_topconceptof_ss = uniq(topConceptOf);
  if (types.length)              out.subject_type_ss = uniq(types);
  if (contexts.length)           out.subject_context_ss = uniq(contexts);

  // Labels: subject_label_<lang> + subject_labels_ss
  if (Object.keys(labelMap).length) {
    applyLangMap(labelMap, out, "subject_label", "subject_labels_ss");
  }
}

// Configure once (put the preferred order here)
const TITLE_LANG_PRIORITY = ["en", "und", "de", "it", "fr", "es"];

/** Choose a single, stable sort title. */
export function pickTitleSort(prefLabel?: Record<string, string>, altLabel?: Record<string, string[]>) {
  // 1) Try priority languages
  if (prefLabel) {
    for (const lang of TITLE_LANG_PRIORITY) {
      const v = prefLabel[lang]?.trim();
      if (v) return { value: v, lang };
    }
    // 2) Otherwise: first available language in deterministic order
    for (const lang of Object.keys(prefLabel).sort()) {
      const v = prefLabel[lang]?.trim();
      if (v) return { value: v, lang };
    }
  }

  // 3) Fallback to any altLabel value if present
  if (altLabel) {
    // deterministic: sort language keys so order is stable
    for (const lang of Object.keys(altLabel).sort()) {
      const v = altLabel[lang]?.find(s => !!s?.trim())?.trim();
      if (v) return { value: v, lang: lang as string };
    }
  }

  // 4) Last resort handled by caller (e.g., URI)
  return undefined;
}



