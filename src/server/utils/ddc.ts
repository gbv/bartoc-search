import { JskosSubject } from "../types/jskos";

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


// Match DDC URIs like:
//   https://dewey.info/class/3/e23/
//   http://dewey.info/class/32.1/e23/
// Capture group 1 = the notation part ("3", "300", "32.1", ...)
// ^https?://dewey\.info/class/([0-9]+(?:\.[0-9]+)?)/e\d+/?$
//  └─ allow http/https     └─ path  └─ digits, optional ".digits"  └─ "e" + version  └─ optional trailing slash
export const DDC_URI_RE = /^https?:\/\/dewey\.info\/class\/([0-9]+(?:\.[0-9]+)?)\/e\d+\/?$/i;

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

/**
 * Extract the DDC *root* class (a single digit "0"–"9") from a dewey.info class URI.
 *
 * Examples:
 *  - "https://dewey.info/class/3/e23/"     -> "3"
 *  - "https://dewey.info/class/300/e23/"   -> "3"
 *  - "https://dewey.info/class/32.1/e23/"  -> "3"
 *  - "https://example.org/foo"             -> null
 */
export const toDdcRoot = (uri: string): string | null => {
  const m = DDC_URI_RE.exec(uri);
  if (!m) return null;
  const notation = m[1];               // e.g., "3", "300", "32.1"
  const head = notation.split(".")[0]; // take part before decimal, e.g., "3" or "300"
  return head[0] ?? null;              // first digit = DDC root ("3" for all above)
};
