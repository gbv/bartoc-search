import { DdcConcept, DdcExpansion, LangMap } from "./types";


/**
 * Small helper to:
 * - drop null/undefined/empty values
 * - deduplicate while preserving order
 */
const uniq = <T,>(a: T[]) =>
  Array.from(new Set(a.filter((v): v is T => v != null))) as T[];

/**
 * Turn a LangMap (e.g. { en: "Canada", de: "Kanada" }) into an ordered list
 * of labels. Prefering English first (if present) and then all other languages.
 *
 * Example:
 *  labelsOf({ en: "Literature", de: "Literatur" })
 *    → ["Literature", "Literatur"]
 */
function labelsOf(map?: LangMap): string[] {
  if (!map) return [];
  const labels: string[] = [];
  if (map.en) labels.push(map.en);
  for (const [lang, value] of Object.entries(map)) {
    if (lang === "en" || !value) continue;
    labels.push(value);
  }
  return labels;
}

/**
 * Fallback parser that extracts a 1–3 digit notation from a DDC URI
 * if no explicit `notation` is present.
 *
 * Examples:
 *  numericFromUri("http://dewey.info/class/440/e23/")   → "440"
 *  numericFromUri("http://dewey.info/class/9/e23/")     → "9"
 *  numericFromUri("http://dewey.info/class/2--71/e23/") → null
 *
 * We intentionally ignore table notation like "2--71" here because
 * the table entries are typically accessed via `memberSet`.
 */
function numericFromUri(uri: string): string | null {
  const m = uri.match(/\/class\/(\d{1,3})(?:[/.]|$)/);
  return m ? m[1] : null;
}

/**
 * Expand a single DDC concept (DdcConcept) into:
 *
 * - roots:     top-level notations (e.g. "4" for languages, "8" for literature)
 * - ancestors: intermediate notations (excluding roots and the main class),
 *              e.g. "44", "45", "84"...
 * - exact:     main class notations, e.g. "440", "305", "971"
 * 
 * - labels:
 *   - rank1: labels of the main concept itself
 *   - rank2: labels of the immediate ancestor and all memberSet components
 *   - rank3: labels of the root ancestor (most general class)
 */
export function expandDdcConcept(c: DdcConcept): DdcExpansion {
  const roots: string[] = [];
  const ancestors: string[] = [];
  const exact: string[] = [];

  // Exact notation of the main class:
  // Prefer c.notation[0]. If missing, fall back to parsing the URI
  const mainNotation =
    (c.notation && c.notation[0]) ?? numericFromUri(c.uri) ?? undefined;
  if (mainNotation) {
    exact.push(mainNotation);
  }

  // Ancestors and roots from the JSKOS hierarchy.
  const ancestorNotations: string[] = [];

  if (c.ancestors && c.ancestors.length) {
    for (const a of c.ancestors) {
      const n =
        (a.notation && a.notation[0]) ?? 
        // Some precomputed files may not store notation in ancestors.
        // As a fallback, try to parse it from the URI.
        numericFromUri(a.uri) ?? undefined;
      if (n) ancestorNotations.push(n);
    }

    if (ancestorNotations.length) {
      const rootNotation = ancestorNotations[ancestorNotations.length - 1];
      roots.push(rootNotation);
      // All but the last ancestor are considered "intermediate" ancestors.
      ancestors.push(...ancestorNotations.slice(0, -1));
    }
  } else if (mainNotation) {
    /**
    * Fallback when no ancestors are available in the file:
     *
     * We approximate the hierarchy purely from the digits:
     *
     *   mainNotation = "440"
     *     → root     = "4"
     *     → ancestor = "44"
     *
     * This is only used if the DDC snapshot does not include explicit ancestors.
     */
    const digits = mainNotation.replace(/\D/g, "");
    if (digits.length) {
      roots.push(digits[0]); // 440 → root "4"
      if (digits.length >= 2) {
        ancestors.push(digits.slice(0, 2)); // "44"
      }
    }
  }

  // Rank 1 labels: main concept label in (en, then others).
  const rank1 = uniq(labelsOf(c.prefLabel));

  //  Rank 2 labels:
  //  Combine:
  //  - the immediate ancestor (first in the ancestors array),
  //  - all memberSet labels (e.g. components from tables).
  const rank2Parts: string[] = [];
  if (c.ancestors && c.ancestors[0]) {
    rank2Parts.push(...labelsOf(c.ancestors[0].prefLabel));
  }
  for (const m of c.memberSet ?? []) {
    rank2Parts.push(...labelsOf(m.prefLabel));
  }
  const rank2 = uniq(rank2Parts);

  // Rank 3 labels:
  // The label of the root ancestor, i.e. the last element in `ancestors`.
  const rank3Parts: string[] = [];
  if (c.ancestors && c.ancestors.length) {
    const rootRef = c.ancestors[c.ancestors.length - 1];
    rank3Parts.push(...labelsOf(rootRef.prefLabel));
  }
  const rank3 = uniq(rank3Parts);

  return {
    roots: uniq(roots),
    ancestors: uniq(ancestors),
    exact: uniq(exact),
    labels: { rank1, rank2, rank3 },
  };
}
