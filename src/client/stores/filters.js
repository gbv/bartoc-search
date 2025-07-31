// store about filters
import { reactive } from "vue"

export const state = reactive({
  activeFilters: {},
  filtersRequested: {}, 
  openGroups: {},
})


// replace the entire filter map
export function setFilters(filters) {
  // clear out old keys
  Object.keys(state.activeFilters).forEach(k => {
    delete state.activeFilters[k] 
  })
  // assign new ones
  Object.entries(filters).forEach(([k, vals]) => {
    state.activeFilters[k] = Array.isArray(vals) ? [...vals] : []
  })
}

// update only one field
export function updateFilter(field, values) {
  state.activeFilters[field] = Array.isArray(values) ? [...values] : []
}

// remove all filters
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

/** 
 * When the user does a new search (or sort), you want
 * to treat *all* facets as “not yet requested.” 
 */
export function resetFiltersRequested() {
  Object.keys(state.filtersRequested).forEach(k => {
    delete state.filtersRequested[k]
  })
}

/**
 * Toggle a group open/closed
 */
export function toggleGroup(field) {
  state.openGroups[field] = !state.openGroups[field]
}

/**
 * Explicitly set a group open or closed
 */
export function setGroupOpen(field, isOpen) {
  state.openGroups[field] = isOpen
}

/**
 * Collapse all groups (e.g. on a new search or sort)
 */
export function resetOpenGroups() {
  Object.keys(state.openGroups).forEach(f => {
    delete state.openGroups[f]
  })
}


