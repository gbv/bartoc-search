// src/utils/sortDefaults.js
import { DEFAULT_SORT, DEFAULT_ORDER } from "../constants/sort.js"

/**
 * Normalize sort/order params:
 * - default sort => "relevance"
 * - default order => "desc" for relevance, otherwise "asc"
 *
 */
export function normalizeSort(input = {}) {
  const sort = input.sort || DEFAULT_SORT
  const order = input.order || (sort === "relevance" ? DEFAULT_ORDER : "asc")
  return { sort, order }
}
