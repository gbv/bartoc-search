// Generic runtime loader for /data/*.json label maps.

let BASE = "/data"
const cache = Object.create(null)     // name -> object (labels)
const inflight = Object.create(null)  // name -> Promise

export function configureLabelsBase(base) {
  BASE = base || BASE 
}

/** Ensure a label map is loaded once per page load. */
export function ensureLabels(name, url) {
  if (cache[name]) {
    return Promise.resolve(cache[name])
  }

  // SSR: don't fetch; leave empty object (caller can still read it safely)
  if (typeof window === "undefined") {
    cache[name] = {}
    return Promise.resolve(cache[name])
  }

  if (!inflight[name]) {
    const href = url || `${BASE}/${name}.json`
    inflight[name] = fetch(href, { cache: "no-cache" }) // ETag revalidate is cheap
      .then(r => (r.ok ? r.json() : {}))
      .then(json => (cache[name] = json || {}))
      .catch(() => (cache[name] = {}))
      .finally(() => {
        delete inflight[name] 
      })
  }
  return inflight[name]
}
