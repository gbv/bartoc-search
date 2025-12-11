/**
 * SearchView
 *
 * Responsibilities:
 * - Parse query parameters from the URL (search, sort, filter, pagination).
 * - Normalize *legacy* BARTOC parameters (languages, subject, ...) to the new
 *   repeatable ?filter=key:values syntax used by the API and the Vue store.
 * - Keep the URL and the internal filter store in sync.
 * - Orchestrate data fetching (`/api/search`) and pass results + facets down
 *   into SearchResults and SearchSidebar components.
 */
<template>
  <NavBreadcrumb
    :summary="summary" />

  <section class="search-view__wrapper">
    <SearchBar
      class="search-bar__area"
      :search-on-mounted="true"
      @lookup-uri="onInspect"
      @search="onSearch" />
    <SearchControls
      class="search-controls__area"
      :model-value="sortKey"
      :lookup-uri="lookupUri"
      @sort="onSort"
      @remove-badge="onRemoveFilter"
      @clear-filters="onClearFilters" />
    <div class="search-results__area">
      <SearchResults
        v-if="loading || results.numFound > 0"
        :results="results"
        :loading="loading"
        :error-message="errorMessage"
        :sort="sortBy"
        @load-more="loadMore" />
      <NoResults
        v-else
        :search="route.query.search || ''"
        :active-filters="activeFilters"
        @clear-filters="onClearFilters" />
    </div>
    <aside class="search-sidebar__area">
      <SearchSidebar
        v-if="results.numFound > 0"
        :facets="results.facets || {}"
        :loading="loading"
        @update-filters="onFilterChange" />
    </aside>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from "vue"
import { useRouter, useRoute } from "vue-router"
import SearchBar from "../components/SearchBar.vue"
import NavBreadcrumb from "../components/NavBreadcrumb.vue"
import SearchControls from "../components/SearchControls.vue"
import SearchResults from "../components/SearchResults.vue"
import SearchSidebar from "../components/SearchSidebar.vue"
import NoResults from "../components/NoResults.vue"
import _ from "lodash"
import { state, setFilters, resetFiltersRequested, 
  clearFilters, resetOpenGroups, requestBucketFor, 
  buildRepeatableFiltersFromState, filtersToRepeatableForUrl, 
  setFiltersFromRepeatable, openGroupsForActiveFilters, clearAllBuckets } from "../stores/filters.js"
import { parseFilterMap, serializeFilterMap, splitMultiParam, extractDdcFromSubject, mapLicenseUrisToGroups } from "../utils/legacy.js"
import { normalizeSort } from "../utils/sortDefaults.js"


// Router hooks
const router = useRouter()
const route = useRoute()

// Pagination settings
const pageSize = 10
// drive everything off this `limit`
const limit = ref(Number(route.query.limit) || pageSize)
const activeFilters = state.activeFilters

// results & state
const results = ref({ docs: [], numFound: 0 })
const loading = ref(true)
const errorMessage = ref(null)
const sortBy = ref()
const lookupUri = ref()
const booted = ref(false) // useful for ignoring first search event from SearchBar

// Computed summary for breadcrumb data
const summary = computed(() => ({
  from: 1,
  to: results.value.docs.length,
  total: results.value.numFound,
}))

// derive the select-option key from the route
const sortKey = computed(() => {
  const { sort, order } = normalizeSort(route.query)
  // relevance is a special one–word case
  if (sort === "relevance") {
    return "relevance"
  }
  
  return `${sort} ${String(order).toLowerCase()}`
})

async function fetchResults(query, opts = {}) {
  const mode = opts.mode || "results" // "results" | "facets"
  const isResultsMode = mode === "results"
  const isAppendMode  = mode === "append"

  const oldLen = isAppendMode ? results.value.docs.length : 0


  if (isResultsMode) {
    loading.value = true
  }

  errorMessage.value = null

  try {
    
    const { filter, ...rest } = query || {}
    const { sort, order } = normalizeSort(rest)
    const base = { ...rest, sort, order }

    // Normalize `filter` from query into an array for the API
    const apiFilterList = Array.isArray(filter)
      ? filter
      : filter
        ? [filter]
        : []

    // Build SHORT filters for the URL from the current store ---
    // This should only contain filters with values, e.g. "language:it,en"
    const urlFiltersFromStore = filtersToRepeatableForUrl()

    // Fallback: if the store is still empty (e.g. first load after legacy mapping),
    // derive filters from the query, but strip any empty "key:" entries.
    const fallbackFromQuery = apiFilterList.filter(f => {
      const idx = f.indexOf(":")
      if (idx <= 0) {
        return false
      }
      const valuePart = f.slice(idx + 1).trim()
      return valuePart.length > 0 // keep only filters with values
    })


    const effectiveUrlFilters =
      urlFiltersFromStore.length > 0 ? urlFiltersFromStore : fallbackFromQuery

    // 2) update the address bar (SHORT)
    const urlQuery = {
      ...base,
      limit: String(limit.value),
      ...(effectiveUrlFilters.length ? { filter: effectiveUrlFilters } : {}),
    }

    router.replace({ name: route.name, query: urlQuery })

    // 3) build API params (repeatable)
    const params = new URLSearchParams()
    Object.entries(base).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        params.set(k, String(v))
      }
    })
    params.set("start", "0")
    params.set("rows", String(limit.value))

    // For the actual API call, use the same effective filters
    apiFilterList.forEach(f => params.append("filter", f))

    // 4) fetch
    const res = await fetch(`${import.meta.env.BASE_URL}api/search?${params}`)

    if (!res.ok) {
      throw new Error(`Status ${res.status}`)
    }

    const data = (await res.json()) || {}

    const response = data.response 
    // Ensure docs is always an array of objects
    const docs = Array.isArray(response?.docs)
      ? response.docs.filter(doc => doc && typeof doc === "object")
      : []

    const numFound = response?.numFound || 0
    const facets = data?.facets || {}
    
    if (isResultsMode) {
      results.value.docs      = docs
      results.value.numFound  = numFound
    }  else if (isAppendMode) {
      // append soltanto i nuovi record
      const newDocs = docs.slice(oldLen)
      results.value.docs.push(...newDocs)
      results.value.numFound = numFound
    }

    results.value.facets = facets


  } catch (error) {
    errorMessage.value = `Search failed: ${error.message}`
  } finally {
    if (isResultsMode) { 
      loading.value = false
    }
  }

}

// Run search from the bar; preserve current URL's sort/order and ignore the very first auto-fire
function onSearch(query) {
  if (!booted.value) {
    return
  }
  limit.value = pageSize
  resetFiltersRequested()
  clearFilters()
  resetOpenGroups()
  
  const base = { ...route.query }

  // deleteing previous filters & pagination
  delete base.filter
  delete base.start
  delete base.rows

  const newQuery = {
    ...base,
    search: query?.search ?? base.search ?? "",
    limit: String(limit.value)  }
  fetchResults(newQuery)

}

function onSort({ sort, order }, opts = {}) {
  sortBy.value = sort

  const filterParams = buildRepeatableFiltersFromState(opts)

  // merge sort/order into whatever the user is currently searching for
  const baseQuery = { ...route.query }
  const newQuery = {
    ...baseQuery,
    sort,
    order,
    ...(filterParams.length ? { filter: filterParams } : {}),
  }

  router.push({ name: "search", query: newQuery })
  fetchResults(newQuery)
}

// Load more results by increasing visible results
function loadMore(opts = {}) {

  let newLimit = limit.value += pageSize

  if (results.value.numFound < newLimit) {
    newLimit = results.value.numFound
  }

  const filterParams = buildRepeatableFiltersFromState(opts)

  const baseQuery = { ...route.query }
  const newQuery = {
    ...baseQuery,
    limit: newLimit,
    ...(filterParams.length ? { filter: filterParams } : {}),
  }

  router.push({ name: "search", query: newQuery })
  fetchResults(newQuery, { mode: "append" })
}


// Accepts:
// - filters: { internalField: ["v1","v2"], ... }  (values update)
// - opts.bucketFor: "language" | "languages_ss"   (request full bucket)
function onFilterChange(filters, opts = {}) {
  limit.value = pageSize

  // 1) update selected values
  setFilters({ ...activeFilters, ...filters })

  // 2) if this call is a "bucket open" for a facet, remember it
  if (opts.bucketFor) {
    requestBucketFor(opts.bucketFor)
  }

  const isBucketOnly = opts.bucketFor && (!filters || Object.keys(filters).length === 0)

  // 3) build final repeatable params from *both* selected values + bucket facets
  const filterParams = buildRepeatableFiltersFromState(opts)


  // update URL + fetch
  const base = { ...route.query }
  delete base.filter
  delete base.start
  delete base.rows

  const newQuery = {
    ...base,
    limit: String(pageSize),
    ...(filterParams.length ? { filter: filterParams } : {}),
  }

  if (isBucketOnly) {
    fetchResults(newQuery, { mode: "facets" })
  } else {
    fetchResults(newQuery, { mode: "results" })
  }

}

// Clear only filters (keep current search/sort/order)
function onClearFilters() {
  clearFilters()          // no active filters
  clearAllBuckets()       // no pending "bucket-only" request
  resetFiltersRequested() // with this facets will reload fully
  resetOpenGroups()       // close all the groups in the sidebar


  // reset pagination to first page
  limit.value = pageSize

  const base = { ...route.query }

  // deleteing previous filters & pagination
  delete base.filter
  delete base.start
  delete base.rows

  const newQuery = {
    ...base,
    search: base.search ?? "",
    limit: String(pageSize)  }

  router.push({ name: "search", query: newQuery })

  fetchResults(newQuery)

}

function onRemoveFilter({ field, value }) {
  const next = { ...state.activeFilters }
  next[field] = (next[field] || []).filter(v => v !== value)
  if (!next[field].length) {
    delete next[field]
  }
  setFilters(next)

  const filterParams = buildRepeatableFiltersFromState()

  // reset pagination to first page
  limit.value = pageSize

  // update URL + fetch
  const base = { ...route.query }
  delete base.filter
  delete base.start
  delete base.rows

  const newQuery = {
    ...base,
    limit: String(pageSize),
    ...(filterParams.length ? { filter: filterParams } : {}),
  }

  fetchResults(newQuery)
}

function onInspect(raw) {
  lookupUri.value = !_.isEmpty(raw) ? raw : undefined
}


/**
 * Take the current route, return a normalized query object:
 *  - All legacy params turned into "filter=..." entries
 *  - URL updated via history.replaceState()
 */
const normalizeLegacyQueryFromRoute = (route, router) => {
  const q = { ...route.query }

  // Start from existing filters
  const filterMap = parseFilterMap(q.filter)

  let touched = false

  // --- languages => filter=language:it,en ---
  if (q.languages) {
    const langs = splitMultiParam(q.languages)
    if (langs.length) {
      filterMap.language = Array.from(new Set([...(filterMap.language ?? []), ...langs]))
      touched = true
    }
    delete q.languages
  }

  // --- country => filter=country:Italy,Germany ---
  if (q.country) {
    const countries = splitMultiParam(q.country)
    if (countries.length) {
      filterMap.country = Array.from(new Set([...(filterMap.country ?? []), ...countries]))
      touched = true
    }
    delete q.country
  }

  // --- type => filter=type:<URI(s)> ---
  if (q.type) {
    const types = splitMultiParam(q.type)
    if (types.length) {
      filterMap.type = Array.from(new Set([...(filterMap.type ?? []), ...types]))
      touched = true
    }
    delete q.type
  }

  // --- access => filter=access:<URI(s)> ---
  if (q.access) {
    const accessVals = splitMultiParam(q.access)
    if (accessVals.length) {
      filterMap.access = Array.from(new Set([...(filterMap.access ?? []), ...accessVals]))
      touched = true
    }
    delete q.access
  }

  // --- partOf => filter=in:<URI(s)> ---
  if (q.partOf) {
    const partOfVals = splitMultiParam(q.partOf)
    if (partOfVals.length) {
      filterMap.in = Array.from(new Set([...(filterMap.in ?? []), ...partOfVals]))
      touched = true
    }
    delete q.partOf
  }

  // --- subject (DDC URIs) => filter=ddc:<notations> ---
  if (q.subject) {
    const ddcs = extractDdcFromSubject(q.subject)
    if (ddcs.length) {
      filterMap.ddc = Array.from(new Set([...(filterMap.ddc ?? []), ...ddcs]))
      touched = true
    }
    delete q.subject
  }

  // --- license (URIs) => filter=license:<group labels> ---
  // Example:
  //   ?license=http://creativecommons.org/licenses/by/4.0/,http://www.apache.org/licenses/LICENSE-2.0
  // → ?filter=license:CC BY,Apache 2.0
  if (q.license) {
    const uris = splitMultiParam(q.license)
    const groups = mapLicenseUrisToGroups(uris)

    if (groups.length) {
      filterMap.license = Array.from(
        new Set([...(filterMap.license ?? []), ...groups]),
      )
      touched = true
    }

    delete q.license
  }

  // 2) Re-serialize filter map
  const newFilter = serializeFilterMap(filterMap)
  if (newFilter.length) {
    q.filter = newFilter.length === 1 ? newFilter[0] : newFilter
  } else {
    delete q.filter
  }

  // 3) If we changed something, update the URL *without* navigation
  if (touched && typeof window !== "undefined") {
    const resolved = router.resolve({ name: route.name || "search", query: q })
    window.history.replaceState(window.history.state, "", resolved.href)
  }

  return q
}

// On mount, set filters from URL and do initial search
onMounted(() => {
  // Normalize legacy query params (?languages=..., ?subject=..., etc.)
  //    into the  repeatable ?filter=... syntax.
  //    This runs once on the client so that:
  //    - the URL in the address bar is "clean"
  //    - the rest of the app only deals with `filter=...`
  const normalized = normalizeLegacyQueryFromRoute(route, router) ?? { ...route.query }

  // Initialise filter store from normalized ?filter=... params
  setFiltersFromRepeatable(normalized.filter)
  openGroupsForActiveFilters() // auto–open facet groups that have selections

  // Initialise pagination limit from URL or fall back to default page size
  limit.value = Number(normalized.limit) || pageSize

  // Fetch initial results based on the normalized query
  fetchResults({ ...normalized })

  // After the first auto-run from SearchBar, ignore extra initial “search” events
  booted.value = true

})

</script>

<style scoped>
.search-view__wrapper  {
  display: grid;
  width: 100%;
  max-width: 1320px;
  grid-template-columns: minmax(0, 3fr) 400px;
  grid-template-areas:
    "search-bar search-bar"
    "search-controls search-controls"
    "results sidebar";
  column-gap: 30px;
  margin: 0 auto;
  align-items: start;
}

.search-bar__area { grid-area: search-bar; }
.search-results__area    { grid-area: results; }
.search-controls__area   { grid-area: search-controls; }
.search-sidebar__area    { 
  grid-area: sidebar; 
  min-width: 320px;
}

</style>



