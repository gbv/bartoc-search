// --- Small helpers for legacy → filter rewriting ---
import LICENSE_GROUPS from "../../../data/license-groups.json"


/**
 * Split a legacy multi-value param like "it,en" or "a|b,c"
 * into a clean array of strings.
 */
export function splitMultiParam(raw) {
  if (!raw) {
    return []
  }
  const s = Array.isArray(raw) ? raw.join(",") : String(raw)
  return s
    .split(/[|,]/)
    .map(v => v.trim())
    .filter(Boolean)
}

/**
 * Parse existing ?filter=params into a map:
 *   { language: ["en","it"], ddc: ["3"], ... }
 */
export function parseFilterMap(rawFilter) {
  const map = /** @type {Record<string, string[]>} */ ({})
  if (!rawFilter) {
    return map
  }

  const list = Array.isArray(rawFilter) ? rawFilter : [rawFilter]

  for (const entry of list) {
    if (!entry) {
      continue
    }
    const idx = entry.indexOf(":")
    if (idx <= 0) {
      continue
    }

    const key = entry.slice(0, idx).trim()
    const valuesPart = entry.slice(idx + 1)
    const values =
      valuesPart.trim() === ""
        ? []
        : valuesPart.split(",").map(v => v.trim()).filter(Boolean)

    if (!map[key]) {
      map[key] = []
    }
    for (const v of values) {
      if (!map[key].includes(v)) {
        map[key].push(v)
      }
    }
  }
  return map
}

/**
 * Turn a map {key: ["v1","v2"], ...} back into
 * an array of "key:v1,v2" filter strings.
 */
export function serializeFilterMap(map) {
  const result = []
  for (const [key, vals] of Object.entries(map)) {
    if (!vals || !vals.length) {
      continue
    }
    result.push(`${key}:${vals.join(",")}`)
  }
  return result
}

/**
 * From legacy ?subject=..., extract DDC notations.
 * Example:
 *   subject=http://dewey.info/class/943/e23/
 *   → ["943"]
 *
 *   subject=http://dewey.info/class/2/e23/
 *   → ["2"]
 */
export function extractDdcFromSubject(rawSubject) {
  const values = splitMultiParam(rawSubject)
  const out = []
  for (const value of values) {
    const m = /dewey\.info\/class\/([^/]+)\//.exec(String(value))
    const notation = m ? m[1] : String(value)
    if (notation && !out.includes(notation)) {
      out.push(notation)
    }
  }
  return out
}


const LICENSE_URI_TO_GROUP = new Map()

for (const group of LICENSE_GROUPS) {
  for (const uri of group.uris || []) {
    if (uri) {
      LICENSE_URI_TO_GROUP.set(uri, group.label)
    }
  }
}

export function mapLicenseUrisToGroups(uris = []) {
  const out = new Set()
  for (const u of uris) {
    const label = LICENSE_URI_TO_GROUP.get(u)
    if (label) {
      out.add(label)
    }
  }
  return [...out]
}
