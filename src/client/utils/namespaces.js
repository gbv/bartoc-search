let _entriesPromise = null

async function loadLookupEntries() {
  if (_entriesPromise) {
    return _entriesPromise
  }
  _entriesPromise = fetch("/data/lookup_entries.json", { cache: "force-cache" })
    .then((r) => {
      if (!r.ok) {
        throw new Error("Failed to fetch /data/lookup_entries.json")
      }
      return r.json()
    })
    .catch((e) => {
      console.warn(e)
      return [] // fail-soft
    })

  return _entriesPromise
}


/**
 * Finds the ConceptScheme `uri` corresponding to a given identifier or namespace.
 * @param {string} input
 * @returns {Promise<string|null>}
 */
export async function getURIperIdentifierOrNamespace(input) {
  if (!input || typeof input !== "string") {
    return null
  }
  const value = input.trim()

  const LOOKUP_ENTRIES = await loadLookupEntries()

  for (const entry of LOOKUP_ENTRIES) {
    if (entry?.uri === value) {
      return entry.uri
    }
    if (entry?.namespace && entry.namespace === value) {
      return entry.uri
    }
    if (Array.isArray(entry?.identifier) && entry.identifier.includes(value)) {
      return entry.uri
    }
  }
  return null
}