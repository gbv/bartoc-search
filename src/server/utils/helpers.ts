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

// Tuning knobs for the fuzzy fallback. Keep them together so changing the
// recall/noise balance does not require spelunking through query strings.
// A long query needs more gram overlap; the catch-all field needs a stricter
// threshold than titles even for one word.
const SINGLE_WORD_TITLE_MM = "50%";
const SINGLE_WORD_ALLFIELDS_MM = "75%";
const MULTI_WORD_MM = "90%";
const TITLE_TRIGRAM_BOOST = 0.6;
const ALLFIELDS_TRIGRAM_BOOST = 0.25;
const EXACT_ABBREVIATION_BOOST = 12;

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

// Abbreviation boosts should affect the global search only. Field-specific
// searches such as title_search or subject_notation must keep their scope.
function wantsGlobalSearch(baseField: string): boolean {
  return /^allfields$/i.test((baseField ?? "").trim());
}

// Build a Solr local-param field query and reuse the existing escaping rules
// for values embedded inside the quoted query string.
function exactFieldQuery(field: string, value: string, boost: number): string {
  return `_query_:"{!field f=${field}}${escapeForLocalParamValue(value)}"^${boost}`;
}

/**
 * Convert user text into the same kind of 3-character slices that Solr stores
 * in the trigram fields.
 *
 * Important for issue #127:
 * - Sending the whole word to the trigram field let Solr's analyzer split it
 *   internally, but `mm=50%` could still behave too loosely for nonsense input.
 * - Sending explicit grams gives eDisMax a real list of required-overlap terms.
 *
 * Example:
 *   "Austrailan" -> "aus ust str tra rai ail ila lan"
 */
function buildTrigramQueryText(value: string): string {
  // Match the Solr field analyzer: fold accents, lowercase, and split on
  // non-letter/non-number boundaries so punctuation does not create grams.
  const folded = (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  // De-duplicate grams to avoid accidentally overweighting repeated character
  // sequences such as "aaaaa" -> "aaa aaa aaa".
  const grams = new Set<string>();

  for (const token of folded.split(/[^\p{L}\p{N}]+/u)) {
    // Array.from keeps Unicode code points together better than string indexing.
    const chars = Array.from(token);
    for (let i = 0; i <= chars.length - 3; i += 1) {
      grams.add(chars.slice(i, i + 3).join(""));
    }
  }

  return [...grams].join(" ");
}

// Use eDisMax for trigram fallback so we can require a meaningful overlap
// between generated trigrams instead of matching one noisy 3-character slice.
function trigramFieldQuery(field: string, value: string, boost: number, minimumMatch: string): string | null {
  const queryText = buildTrigramQueryText(value);
  // Values shorter than 3 characters produce no grams, so they should not add
  // an empty fallback clause.
  if (!queryText) return null;
  return `_query_:"{!edismax qf=${field} mm=${minimumMatch}}${escapeForLocalParamValue(queryText)}"^${boost}`;
}

/**
 * Builds a final Lucene query by OR-ing a typo-tolerant trigram fallback
 * onto an existing base query.
 *
 * Behavior
 * - Always keep `baseLucene` unchanged (exact matches rank highest).
 * - For global searches, boost exact matches in compact identifier-like
 *   fields such as `notation_ss`, `alt_labels_ss`, and `bartoc_id_s`.
 * - For global simple queries (no quotes/operators, length ≥ 3), add generated
 *   3-character grams to:
 *     title_trigram:<grams>^0.6
 *   and:
 *     allfields_trigram:<grams>^0.25
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
 * // → '(allfields:(...)) OR (_query_:"{!edismax qf=title_trigram mm=50%}cla las ..."^0.6
 * //     OR _query_:"{!edismax qf=allfields_trigram mm=75%}cla las ..."^0.25)'
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

  const value = (userQuery ?? "").trim();
  const multiWord = value.split(/[^\p{L}\p{N}]+/u).filter(Boolean).length > 1;

  // This is the core safety gate:
  // - global search may use typo-tolerant fallback;
  // - field-specific search stays strict;
  // - advanced Lucene-like syntax is left untouched.
  const useGlobalFallback = isSimpleUserQuery(value) && wantsGlobalSearch(baseField);

  if (!useGlobalFallback) {
    // Returning the base query unchanged keeps field-specific and advanced
    // searches predictable, and avoids decorative parentheses in tests/logs.
    return { q: baseLucene, defType: "lucene" };
  }

  // Always keep base query intact (exact/phrase matches get priority).
  const parts: string[] = [`(${baseLucene})`];

  // Short labels, notations, and ids often act as direct lookup keys.
  // Give exact matches there enough weight to beat incidental text matches.
  parts.push(`(${[
    exactFieldQuery("notation_ss", value, EXACT_ABBREVIATION_BOOST),
    exactFieldQuery("alt_labels_ss", value, EXACT_ABBREVIATION_BOOST),
    exactFieldQuery("bartoc_id_s", value, EXACT_ABBREVIATION_BOOST),
  ].join(" OR ")})`);

  const trigramBits: string[] = [];
  // Prefer the title trigram a bit so title matches float higher than a fuzzy
  // match buried somewhere else in the copied allfields text.
  const titleTrigram = trigramFieldQuery(
    "title_trigram", value, TITLE_TRIGRAM_BOOST,
    multiWord ? MULTI_WORD_MM : SINGLE_WORD_TITLE_MM,
  );
  if (titleTrigram) trigramBits.push(titleTrigram);

  // allfields_trigram is useful for recall, but low-boosted because it can
  // match many copied fields and should not outrank cleaner title matches.
  if (includeAllfieldsTrigrams) {
    const allfieldsTrigram = trigramFieldQuery(
      "allfields_trigram", value, ALLFIELDS_TRIGRAM_BOOST,
      multiWord ? MULTI_WORD_MM : SINGLE_WORD_ALLFIELDS_MM,
    );
    if (allfieldsTrigram) trigramBits.push(allfieldsTrigram);
  }

  if (trigramBits.length) {
    parts.push(`(${trigramBits.join(" OR ")})`);
  }

  return { q: parts.join(" OR "), defType: "lucene" };
}
