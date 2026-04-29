/**
 * Append a Vue Router query object to URLSearchParams.
 *
 * Vue Router query values can be:
 * - a string
 * - an array of strings
 * - null / undefined
 *
 * Empty values are skipped
 *
 * @param {URLSearchParams} params
 * @param {Record<string, unknown>} query
 * @returns {URLSearchParams}
 */
export function appendQueryToParams(params, query = {}) {
  for (const [key, value] of Object.entries(query || {})) {
    const values = Array.isArray(value) ? value : [value]

    values
      .filter((v) => v !== undefined && v !== null && v !== "")
      .forEach((v) => params.append(key, String(v)))
  }

  return params
}