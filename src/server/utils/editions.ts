import type { ConceptSchemeDocument } from "../types/jskos";
import { isBartocUri, normalizeUri } from "./uri";

/**
 * Returns the canonical URI of an edition's direct main record.
 *
 * JSKOS allows multiple `versionOf` references, but the BARTOC edition model
 * supports exactly one canonical BARTOC record that is different from the
 * edition itself. This checks only the relation shape; it does not verify that
 * the referenced main record exists.
 */
export function getDirectVersionOfUri(
  record: Partial<ConceptSchemeDocument>,
): string | undefined {
  const references = record.versionOf;
  if (!Array.isArray(references) || references.length !== 1) {
    return undefined;
  }

  const targetUri = normalizeUri(references[0]?.uri);
  const recordUri = normalizeUri(record.uri);

  if (!isBartocUri(targetUri) || targetUri === recordUri) {
    return undefined;
  }

  return targetUri;
}
