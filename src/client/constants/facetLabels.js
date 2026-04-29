// Generic runtime loader for /data/*.json label maps.

let BASE = "/data"

// Resolved label maps.
// Example: cache["ddc_root_ss"] = { "3": "Social sciences" }
const cache = Object.create(null)

// This prevents multiple parallel fetches for the same label map.
const inflight = Object.create(null)

export function configureLabelsBase(base) {
  if (base) {
    BASE = base
  }
}

/**
 * Fetch one label map from JSON.
 * 
 */
async function fetchLabels(href) {
  try {
    const response = await fetch(href, { cache: "no-cache" })

    if (!response.ok) {
      return {}
    }

    return (await response.json()) || {}
  } catch {
    return {}
  }
}

/**
 * Ensure a label map is loaded once per page load.
 */
export function ensureLabels(name, url) {
  if (cache[name]) {
    return Promise.resolve(cache[name])
  }

  // SSR: no browser fetch is available/needed.
  // Keep a safe empty map so UI code can still access labels.
  if (typeof window === "undefined") {
    cache[name] = {}
    return Promise.resolve(cache[name])
  }

  const href = url || `${BASE}/${name}.json`

  // If a request for this label map is already running,
  // return the same Promise instead of starting another fetch.
  inflight[name] ??= fetchLabels(href)
    .then(labels => {
      cache[name] = labels
      return labels
    })
    .finally(() => {
      // Once resolved/rejected, future calls should use cache[name]
      // or start a new request if cache was empty.
      delete inflight[name]
    })

  return inflight[name]
}