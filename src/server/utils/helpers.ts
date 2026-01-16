import fs from "node:fs/promises";


/** Utility: measure how long an async function takes and log the result */
export async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  const res = await fn();
  const ms = Date.now() - t0;
  console.log(`${label}: ${ms} ms`);
  return res;
}

/** Normalize unknown | T | T[] into a T[] safely */
export const toArr = <T,>(x: T | T[] | undefined | null): T[] =>
    x == null ? [] : Array.isArray(x) ? x : [x];

export const asArr = (x: unknown) => (x == null ? [] : Array.isArray(x) ? x : [x]);

export const normalize = (u: string) => u.trim().replace(/\/+$/, ""); // drop trailing slash

// language preference for labels
export const KEEP_LANGS = (process.env.KEEP_LANGS ?? "en,de")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);


/** Keep only http/https identifiers and deduplicate them */
export const filterHttp = (ids: string[]) =>
  Array.from(new Set(ids.filter((u) => /^https?:\/\//i.test(u))));

export function sanitizeETagHeader(raw: unknown): string {
  // Convert to string and normalize
  let etag = String(raw ?? "");

  // Turn weak validator prefix W/"foo" into a safe W-foo
  etag = etag.replace(/^W\/"?/i, "W-"); // case-insensitive, removes W/" or W/
  // Drop any remaining quotes
  etag = etag.replace(/"/g, "");
  // Keep only filename-safe chars (letters, digits, dot, underscore, dash)
  etag = etag.replace(/[^A-Za-z0-9._-]+/g, "-");
  // Collapse multiple dashes and trim
  etag = etag.replace(/-+/g, "-").replace(/^-|-$/g, "");
  return etag || "noetag";
}

export async function fileSize(p: string) {
  try { return (await fs.stat(p)).size; } catch { return null; }
}

// Lightweight helpers to compose a robust Lucene query string from a
// “normal” user input plus an optional trigram (char n-gram) fallback.

/**
 * Treat these tokens as “advanced” so we skip the trigram fallback for them.
 *
 * Explanation:
 * - The first character class matches Lucene special characters that often
 *   indicate the user is crafting an advanced query:
 *     + - ! ( ) { } [ ] ^ " ~ * ? : \ 
 * - The non-capturing group matches boolean operators as standalone words:
 *     AND | OR | NOT   (case-insensitive)
 *
 * If the input contains any of the above, we don’t add trigram fields.
 */
const ADVANCED_CHARS = /[+\-!(){}[\]^"~*?:\\]|(?:\bAND\b|\bOR\b|\bNOT\b)/i;


/**
 * Decide whether a user query is “simple” (benefits from trigram fallback)
 * or “advanced” (should be left as-is).
 *
 * Rules:
 * - < 3 characters → false (too short to benefit from trigrams)
 * - contains advanced chars/boolean ops → false
 * - otherwise → true
 *
 * Examples:
 *   isSimpleUserQuery("clasification")  -> true
 *   isSimpleUserQuery("title:film")     -> false  (contains ':')
 *   isSimpleUserQuery("\"film noir\"")  -> false  (contains quotes)
 *   isSimpleUserQuery("A")              -> false  (too short)
 */
function isSimpleUserQuery(q: string): boolean {
  const s = (q ?? "").trim();
  if (s.length < 3) return false;               // too short to benefit
  if (ADVANCED_CHARS.test(s)) return false;     // contains Lucene ops/specials
  return true;
}

/**
 * Escape just backslashes and double quotes for the string that will live
 * inside a quoted Solr local-param value, e.g.:
 *   escapeForLocalParamValue('He said "hi"') -> He said \"hi\"
 */
function escapeForLocalParamValue(s: string): string {
  return s.replace(/([\\"])/g, "\\$1");
}

/**
 * Builds a final Lucene query by OR-ing a typo-tolerant trigram fallback
 * onto an existing base query.
 *
 * Behavior
 * - Always keep `baseLucene` unchanged (exact matches rank highest).
 * - If `userQuery` is simple (no quotes/operators, length ≥ 3), add:
 *     title_trigram:<q>^0.6
 *   and, unless `baseField` is title-only, also:
 *     allfields_trigram:<q>^0.25
 * - Returns `{ q, defType: "lucene" }`.
 *
 * Inputs
 * - userQuery: raw user text (lightly escaped for local params)
 * - baseField: field used by the base query (e.g., "allfields", "title_search")
 * - baseLucene: string from `LuceneQuery.fromText(...).toString()`
 * - includeAllfieldsTrigrams: toggles `allfields_trigram` (default: true)
 *
 * Example
 * buildLuceneWithTrigrams({
 *   userQuery: "Clasification",
 *   baseField: "allfields",
 *   baseLucene: '(allfields:("Clasification"^3 OR "Clasification"))'
 * })
 * // → '(allfields:(...)) OR (_query_:"{!field f=title_trigram}Clasification"^0.6
 * //     OR _query_:"{!field f=allfields_trigram}Clasification"^0.25)'
 */
export function buildLuceneWithTrigrams(opts: {
  userQuery: string;
  baseField: string;                 // e.g., "allfields"
  baseLucene: string;                // stringified LuceneQuery
  includeAllfieldsTrigrams?: boolean; // default true
}): { q: string; defType: "lucene" } {
  const {
    userQuery,
    baseField,
    baseLucene,
    includeAllfieldsTrigrams = true,
  } = opts;

  const simple = isSimpleUserQuery(userQuery);
  const parts: string[] = [];

  // Always keep base query intact (exact/phrase matches get priority).
  parts.push(`(${baseLucene})`);

  // Add safe trigram fallback for simple queries
  if (simple) {
    const val = escapeForLocalParamValue((userQuery ?? "").trim());

    const trigramBits: string[] = [];
     // Prefer the title trigram a bit so title matches float higher.
    trigramBits.push(`_query_:"{!field f=title_trigram}${val}"^0.6`);

    // Only add allfields_trigram when the base field isn’t title-only.
    // (Heuristic: treat fields starting with "title" as title-only.)
    const wantTitleOnly = /^title(_search|_.*)?$/i.test(baseField);
    if (!wantTitleOnly && includeAllfieldsTrigrams) {
      trigramBits.push(`_query_:"{!field f=allfields_trigram}${val}"^0.25`);
    }
    
    // OR the trigram clause with the base query.
    parts.push(`(${trigramBits.join(" OR ")})`);
  }

  return { q: parts.join(" OR "), defType: "lucene" };
}
