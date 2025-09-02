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