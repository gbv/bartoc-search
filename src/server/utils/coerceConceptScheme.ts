import type { ConceptSchemeDocument } from "../types/jskos";

const DEFAULT_CONTEXT = "https://gbv.github.io/jskos/context.json";
const DEFAULT_TYPES = ["http://www.w3.org/2004/02/skos/core#ConceptScheme"];

function isObj(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}
function isStr(x: unknown): x is string {
  return typeof x === "string";
}
function isRecordOfStrings(x: unknown): x is Record<string, string> {
  if (!isObj(x)) return false;
  return Object.values(x).every(v => typeof v === "string");
}
function asStringArray(x: unknown): string[] | undefined {
  if (!Array.isArray(x)) return undefined;
  const out = x.filter(isStr);
  return out.length ? out : undefined;
}

export function coerceConceptSchemeDocument(input: unknown): ConceptSchemeDocument | null {
  if (!isObj(input)) return null;

  const uri =
    (isStr(input.uri) && input.uri) ||
    (isStr(input._id) && input._id) ||
    undefined;

  if (!uri) return null;

  const created = isStr(input.created) ? input.created : new Date().toISOString();
  const modified = isStr(input.modified) ? input.modified : created;

  const ctx = isStr(input["@context"]) ? input["@context"] : DEFAULT_CONTEXT;

  const prefLabel =
    isRecordOfStrings(input.prefLabel) ? input.prefLabel : { und: uri };

  const type = asStringArray(input.type) ?? DEFAULT_TYPES;

  // Keep EVERYTHING else, but guarantee the required fields exist
  // Cast is safe because we just enforced the required ones.
  return {
    ...(input as Record<string, unknown>),
    "@context": ctx,
    uri,
    created,
    modified,
    prefLabel,
    type,
  } as unknown as ConceptSchemeDocument;
}
