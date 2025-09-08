// store about filters
import { reactive } from "vue"

/**
 * Public <-> Internal mapping
 * Keep activeFilters in INTERNAL (Solr) field names.
 */
export const INTERNAL_TO_PUBLIC = {
  type_uri: "type",
  ddc_root_ss: "ddc",
  languages_ss: "language",
  listed_in_ss: "in",
  api_type_ss: "api",
  access_type_ss: "access",
  license_group_ss: "license",
  format_group_ss: "format",
  address_country_s: "country",
  publisher_labels_ss: "publisher",
}


export const PUBLIC_TO_INTERNAL = Object.fromEntries(
  Object.entries(INTERNAL_TO_PUBLIC).map(([internal, pub]) => [pub, internal]),
)

export const state = reactive({
  activeFilters: {},     // internal -> string[]
  filtersRequested: {},  // filters flagging
  openGroups: {},        // UI state
  bucketFacets: {},      // <-- internal -> true (request full bucket)
})

// ---------- internal helpers ----------

/**
 * Normalize array-ish values to unique, trimmed strings.
 */
function normalizeValues(values) {
  const arr = Array.isArray(values) ? values : []
  return Array.from(new Set(arr.map(v => String(v).trim()).filter(Boolean)))
}

/**
 * Flatten current (or given) internal activeFilters into repeatable filter= strings.
 * - Values containing commas are skipped (format doesn't support them).
 * - The special no-value token "-" is treated as a normal value.
 * - Optionally include *empty* filters (e.g. "language:") for facets where
 *   we want the server to return the *entire bucket*.
 *
 * @param {Record<string,string[]>} filters   internal -> values (defaults to store)
 * @param {Object} options
 * @param {string[]} [options.includeEmptyFor]  list of facet keys (public or internal)
 *                                             for which to emit an empty filter (`key:`)
 * @returns {string[]} e.g. ["language:en,de", "api:-"] or ["language:"]
 */
export function filtersToRepeatable(filters = state.activeFilters, options = {}) {
  const parts = []
  const includeEmptyFor = new Set(
    (options.includeEmptyFor || []).map(k => PUBLIC_TO_INTERNAL?.[k] || k), // accept public or internal
  )


  // Emit filters for fields present in `filters`
  for (const [internal, valuesRaw] of Object.entries(filters || {})) {
    const publicKey = INTERNAL_TO_PUBLIC[internal]
    if (!publicKey) {
      continue
    }

    const values = normalizeValues(valuesRaw).filter(v => !v.includes(","))

    if (values.length > 0) {
      parts.push(`${publicKey}:${values.join(",")}`)
    } else if (includeEmptyFor.has(internal)) {
      // explicit request for full bucket of this facet
      parts.push(`${publicKey}:`)
      includeEmptyFor.delete(internal) // handled
    }
  }



  // Also allow requesting buckets for facets not yet present in `filters`
  for (const internal of includeEmptyFor) {
    const publicKey = INTERNAL_TO_PUBLIC[internal]
    if (publicKey) {
      parts.push(`${publicKey}:`)
    }
  }

  return parts
}

export function buildRepeatableFiltersFromState(extra = {}) {
  // collect all facets that should return full buckets
  const include = new Set(
    Object.entries(state.bucketFacets)
      .filter(([, on]) => on)
      .map(([internal]) => internal),
  )
  if (extra.bucketFor) {
    include.add(PUBLIC_TO_INTERNAL[extra.bucketFor] || extra.bucketFor)
  }

  return filtersToRepeatable(state.activeFilters, { includeEmptyFor: Array.from(include) })
}


// Short URL: only facets with values (and "-" if used). NO empties.
export function filtersToRepeatableForUrl(filters = state.activeFilters) {
  const parts = []
  for (const [internal, valuesRaw] of Object.entries(filters || {})) {
    const publicKey = INTERNAL_TO_PUBLIC[internal]
    if (!publicKey) {
      continue
    }
    const values = normalizeValues(valuesRaw).filter(v => !v.includes(","))
    if (values.length > 0) {
      parts.push(`${publicKey}:${values.join(",")}`)
    }
  }
  return parts
}


// --- small local helpers
function splitCsv(s) {
  return String(s).split(",").map(t => t.trim()).filter(Boolean)
}

/**
 * Hydrate store from repeatable ?filter=... in the URL.
 * - Accepts a string, an array of strings, or undefined (from vue-router).
 * - Keeps "-" values (no-value bucket).
 * - Skips entries with nothing after ":" by default (i.e., "facet:"), since
 *   don't put full-bucket requests in the URL.
 *
 * Usage (in SearchView onMounted):
 *   setFiltersFromRepeatable(route.query.filter)
 *
 * @param {string|string[]|undefined} input
 * @param {Object} [opts]
 * @param {boolean} [opts.keepEmpty=false]  If true, include empty arrays for "facet:".
 */
export function setFiltersFromRepeatable(input, { keepEmpty = false } = {}) {
  const out = {}
  const arr = Array.isArray(input) ? input : (input ? [input] : [])

  for (const item of arr) {
    const s = String(item)
    const idx = s.indexOf(":")
    if (idx <= 0) {
      continue
    }

    const publicKey = s.slice(0, idx).trim()
    const internal = PUBLIC_TO_INTERNAL[publicKey] || publicKey
    if (!internal) {
      continue
    }

    const tail = s.slice(idx + 1)
    if (tail === "" && !keepEmpty) {
      continue
    }  // ignore "facet:" in URL

    const valsRaw = tail === "" ? [] : splitCsv(tail)
    // Keep "-" values; skip values containing commas (unsupported)
    const vals = Array.from(new Set(valsRaw.filter(v => v && !v.includes(","))))

    if (vals.length > 0 || keepEmpty) {
      out[internal] = vals  // if keepEmpty=true and empty, store []
    }
  }

  setFilters(out)
}


///--------------- mutators ------------------

// mark/unmark full-bucket requests (accept public or internal keys)

export function requestBucketFor(key) {
  const internal = PUBLIC_TO_INTERNAL[key] || key
  state.bucketFacets[internal] = true
}

export function clearBucketFor(key) {
  const internal = PUBLIC_TO_INTERNAL[key] || key
  delete state.bucketFacets[internal]
}

export function clearAllBuckets() {
  Object.keys(state.bucketFacets).forEach(k => delete state.bucketFacets[k])
}

// set/clear active filters (internal keys)
export function setFilters(filters) {
  // clear out old keys
  Object.keys(state.activeFilters).forEach(k => {
    delete state.activeFilters[k]
  })
  // assign new ones (normalize)
  Object.entries(filters || {}).forEach(([k, vals]) => {
    state.activeFilters[k] = normalizeValues(vals)
  })
}

export function updateFilter(field, values) {
  state.activeFilters[field] = normalizeValues(values)
}

// handy toggle (optional, but useful in UIs)
export function toggleFilterValue(field, value) {
  const v = String(value)
  const cur = new Set(state.activeFilters[field] || [])
  if (cur.has(v)) {
    cur.delete(v)
  } else {
    cur.add(v)
  }
  state.activeFilters[field] = Array.from(cur)
}

export function clearFilters() {
  Object.keys(state.activeFilters).forEach(k => {
    delete state.activeFilters[k]
  })
}

/**
 * Call this the *first* time start loading buckets for `field`.
 * Subsequent calls are no-ops.
 */
export function markFilterRequested(field) {
  if (!state.filtersRequested[field]) {
    state.filtersRequested[field] = true
  }
}

/** Treat *all* facets as “not yet requested.” */
export function resetFiltersRequested() {
  Object.keys(state.filtersRequested).forEach(k => {
    delete state.filtersRequested[k]
  })
}

/** Toggle a group open/closed */
export function toggleGroup(field) {
  state.openGroups[field] = !state.openGroups[field]
}

/** Explicitly set a group open or closed */
export function setGroupOpen(field, isOpen) {
  state.openGroups[field] = isOpen
}

/** Collapse all groups (e.g. on a new search or sort) */
export function resetOpenGroups() {
  Object.keys(state.openGroups).forEach(f => {
    delete state.openGroups[f]
  })
}

// Return internal facet keys that currently have values (incl. "-")
export function getActiveFacetInternals() {
  return Object.entries(state.activeFilters)
    .filter(([, vals]) => Array.isArray(vals) && vals.length > 0)
    .map(([k]) => k)
}

// Open those groups in the sidebar
export function openGroupsForActiveFilters() {
  getActiveFacetInternals().forEach((internal) => setGroupOpen(internal, true))
}
