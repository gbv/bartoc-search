// src/utils/nkosService.ts
import path from "path";
import { fileURLToPath } from "url";
import readAndValidateNdjson from "../utils/loadNdJson";
import { ConceptZodType, conceptZodSchema } from "../validation/concept";
import { NkosNotInitializedError } from "../errors/errors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to NDJSON source file
const NKOS_FILE = path.join(
  __dirname,
  "../../../data/nkostype.concepts.ndjson",
);
let cache: ConceptZodType[] | null = null;

/**
 * Loads and caches NKOS concepts.
 * Subsequent calls return the in‐memory array.
 */
export async function loadNkosConcepts(): Promise<ConceptZodType[]> {
  if (!cache) {
    cache = await readAndValidateNdjson(NKOS_FILE, conceptZodSchema);
  }
  return cache;
}

/**
 * Returns the already‐loaded concepts
 */
export function getNkosConcepts(): ConceptZodType[] {
  if (!cache) {
    throw new NkosNotInitializedError();
  }
  return cache;
}
