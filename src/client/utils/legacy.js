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
  return splitSubjectParam(rawSubject).ddc
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

// TODO: This is a bit hacky
// This should be replaced in #126 with a more robust general solution
const DDC_URI_PATTERN = /^https?:\/\/dewey\.info\/class\/([^/]+)\//i
const HTTP_URI_PATTERN = /^https?:\/\//i

const pushUnique = (array, value) => {
  if (value && !array.includes(value)) {
    array.push(value)
  }
}

/**
 * Split legacy `subject` query values into DDC roots and arbitrary subject URIs.
 *
 * DDC URIs are mapped to their root class because the current DDC facet works
 * on top-level classes, e.g. `http://dewey.info/class/577/e23/` becomes `5`.
 *
 * Non-DDC HTTP URIs are kept as subject URIs so they can be searched in the
 * `subject_uri` Solr field.
 */
export function splitSubjectParam(rawSubject) {
  const ddc = []
  const subjectUris = []

  for (const value of splitMultiParam(rawSubject)) {
    const uri = String(value).trim()
    const ddcMatch = DDC_URI_PATTERN.exec(uri)

    if (ddcMatch) {
      pushUnique(ddc, ddcMatch[1]?.slice(0, 1))
    } else if (HTTP_URI_PATTERN.test(uri)) {
      pushUnique(subjectUris, uri)
    }
  }

  return { ddc, subjectUris }
}