import LOOKUP_ENTRIES from "../../../data/lookup_entries.json"

/**
 * Finds the ConceptScheme `uri` corresponding to a given identifier or namespace.
 *
 * @param {string} input - An identifier or namespace URI.
 * @returns {string|null} - The corresponding ConceptScheme URI, or null if not found.
 */
export function getURIperIdentifierOrNamespace(input) {
  if (!input || typeof input !== "string") {
    return null
  }

  const value = input.trim()

  for (const entry of LOOKUP_ENTRIES) {
    if (entry.uri === value) {
      return entry.uri
    }

    if (entry.namespace && entry.namespace === value) {
      return entry.uri
    }

    if (Array.isArray(entry.identifier) && entry.identifier.includes(value)) {
      return entry.uri
    }
  }

  return null
}
