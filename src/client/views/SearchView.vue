/** * SearchView * * Responsibilities: * - Parse query parameters from the URL (search, sort,
filter, pagination). * - Normalize *legacy* BARTOC parameters (languages, subject, ...) to the new *
repeatable ?filter=key:values syntax used by the API and the Vue store. * - Keep the URL and the
internal filter store in sync. * - Orchestrate data fetching (`/api/search`) and pass results +
facets down * into SearchResults and SearchSidebar components. */
<template>
  <section class="search-view__wrapper app-container">
    <SearchBar
      class="search-bar__area"
      :search-on-mounted="true"
      @lookup-uri="onInspect"
      @search="onSearch" />
    <SearchControls
      class="search-controls__area"
      :lookup-uri="lookupUri"
      @remove-badge="onRemoveFilter"
      @clear-filters="onClearFilters" />
    <div class="search-results__area">
      <template v-if="loading || results.numFound > 0">
        <SearchResultActions
          v-if="showResultActions"
          :summary="summary"
          :can-load-more="canLoadMore"
          :download-url="downloadUrl"
          :sort-key="sortKey"
          @load-more="loadMore"
          @sort="onSort"
          @show-all="showAll" />
        <SearchResults
          :results="results"
          :loading="loading"
          :error-message="errorMessage"
          :sort="sortBy" />
        <SearchResultActions
          v-if="showResultActions"
          :summary="summary"
          :can-load-more="canLoadMore"
          :download-url="downloadUrl"
          :sort-key="sortKey"
          :show-sort="false"
          @load-more="loadMore"
          @sort="onSort"
          @show-all="showAll" />
      </template>
      <NoResults
        v-else
        :search="route.query.search || ''"
        :active-filters="activeFilters"
        @clear-search="onClearSearch"
        @clear-filters="onClearFilters" />
    </div>
    <aside class="search-sidebar__area noprint">
      <SearchSidebar
        v-if="results.numFound > 0 || openModalField"
        :facets="results.facets || {}"
        :loading="loading"
        @modal-toggle="openModalField = $event"
        @update-filters="onFilterChange" />
    </aside>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue"
import { useRouter, useRoute } from "vue-router"
import SearchBar from "../components/SearchBar.vue"
import SearchControls from "../components/SearchControls.vue"
import SearchResultActions from "../components/SearchResultActions.vue"
import SearchResults from "../components/SearchResults.vue"
import SearchSidebar from "../components/SearchSidebar.vue"
import NoResults from "../components/NoResults.vue"
import _ from "lodash"
import {
  state,
  setFilters,
  resetFiltersRequested,
  clearFilters,
  resetOpenGroups,
  requestBucketFor,
  buildRepeatableFiltersFromState,
  filtersToRepeatableForUrl,
  clearAllBuckets,
} from "../stores/filters.js"
import {
  normalizeLegacyQueryFromRoute,
} from "../utils/legacy.js"
import { normalizeSort } from "../utils/sortDefaults.js"
import {
  buildQueryWithFilters,
  buildQueryWithoutSearch,
  buildSearchBarQuery,
} from "../utils/searchQuery.js"
import { appendQueryToParams } from "../utils/utils.js"
import { SEARCH_MODE, NAVIGATION } from "../constants/search.js"
import { fetchSearchResults } from "../utils/searchApi.js"
import { useSearchNavigation } from "../composables/useSearchNavigation.js"
import { useSearchRouteState } from "../composables/useSearchRouteState.js"

// Router hooks
const router = useRouter()
const route = useRoute()
const {
  updateSearchRoute,
  isInternalRouteChange,
} = useSearchNavigation({ router, route })

// Pagination settings
const pageSize = 10
// drive everything off this `limit`
const limit = ref(Number(route.query.limit) || pageSize)
const activeFilters = state.activeFilters

// results & state
const results = ref({ docs: [], numFound: 0 })
const openModalField = ref(null)
const loading = ref(true)
const errorMessage = ref(null)
const sortBy = ref()
const lookupUri = ref()
const booted = ref(false) // useful for ignoring first search event from SearchBar
const {
  syncSearchStateFromRoute,
} = useSearchRouteState({ route, limit, sortBy, pageSize })


// download URL for current search (used by SearchControls)
const downloadUrl = computed(() => {
  const params = appendQueryToParams(new URLSearchParams(), route.query)
  const base = import.meta.env.BASE_URL || "/"
  const normalizedBase = base.endsWith("/") ? base : `${base}/`

  params.set("format", "jskos")

  return `${normalizedBase}api/search?${params.toString()}`
})

// Computed summary for result actions
const summary = computed(() => ({
  from: 1,
  to: results.value.docs.length,
  total: results.value.numFound,
}))

const showResultActions = computed(() =>
  !loading.value && !errorMessage.value && results.value.docs.length > 0,
)

const canLoadMore = computed(() =>
  results.value.docs.length < results.value.numFound,
)

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
  const mode = opts.mode || SEARCH_MODE.RESULTS
  const navigation = opts.navigation || NAVIGATION.REPLACE
  const isResultsMode = mode === SEARCH_MODE.RESULTS
  const isAppendMode = mode === SEARCH_MODE.APPEND

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
    const apiFilterList = Array.isArray(filter) ? filter : filter ? [filter] : []

    // Build SHORT filters for the URL from the current store ---
    // This should only contain filters with values, e.g. "language:it,en"
    const urlFiltersFromStore = filtersToRepeatableForUrl()

    // Fallback: if the store is still empty (e.g. first load after legacy mapping),
    // derive filters from the query, but strip any empty "key:" entries.
    const fallbackFromQuery = apiFilterList.filter((f) => {
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

    // Real search-state changes push history; result expansion replaces it.
    // Back/Forward uses "none" because the route has already changed.
    await updateSearchRoute(urlQuery, navigation)

    const { docs, numFound, facets } = await fetchSearchResults({
      baseQuery: base,
      filters: apiFilterList,
      limit: limit.value,
      baseUrl: import.meta.env.BASE_URL,
    })

    if (isResultsMode) {
      results.value.docs = docs
      results.value.numFound = numFound
    } else if (isAppendMode) {
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

// Run search from the bar; preserve current URL's sort/order and active filters.
function onSearch(query) {
  if (!booted.value) {
    return
  }
  limit.value = pageSize
  resetFiltersRequested()
  clearAllBuckets()

  const filterParams = buildRepeatableFiltersFromState()
  const newQuery = buildSearchBarQuery(route.query, query, filterParams, limit.value)

  fetchResults(newQuery, { navigation: NAVIGATION.PUSH })
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

  fetchResults(newQuery, { navigation: NAVIGATION.PUSH })
}

// Load more results by increasing visible results
function loadMore(opts = {}) {
  let newLimit = (limit.value += pageSize)

  if (results.value.numFound < newLimit) {
    newLimit = results.value.numFound
    limit.value = newLimit
  }

  const filterParams = buildRepeatableFiltersFromState(opts)

  const baseQuery = { ...route.query }
  const newQuery = {
    ...baseQuery,
    limit: newLimit,
    ...(filterParams.length ? { filter: filterParams } : {}),
  }

  fetchResults(newQuery, { mode: SEARCH_MODE.APPEND, navigation: NAVIGATION.REPLACE })
}

function showAll(opts = {}) {
  const total = results.value.numFound

  if (!total || results.value.docs.length >= total) {
    return
  }

  limit.value = total

  const filterParams = buildRepeatableFiltersFromState(opts)

  const baseQuery = { ...route.query }
  const newQuery = {
    ...baseQuery,
    limit: String(total),
    ...(filterParams.length ? { filter: filterParams } : {}),
  }

  fetchResults(newQuery, { mode: SEARCH_MODE.RESULTS, navigation: NAVIGATION.REPLACE })
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
  const newQuery = buildQueryWithFilters(route.query, filterParams, pageSize)

  if (isBucketOnly) {
    fetchResults(newQuery, { mode: SEARCH_MODE.FACETS, navigation: NAVIGATION.REPLACE })
  } else {
    fetchResults(newQuery, { mode: SEARCH_MODE.RESULTS, navigation: NAVIGATION.PUSH })
  }
}

// Clear only filters (keep current search/sort/order)
function onClearFilters() {
  clearFilters() // no active filters
  clearAllBuckets() // no pending "bucket-only" request
  resetFiltersRequested() // with this facets will reload fully
  resetOpenGroups() // close all the groups in the sidebar

  // reset pagination to first page
  limit.value = pageSize

  const base = { ...route.query }
  delete base.filter
  delete base.start

  const newQuery = {
    ...base,
    search: base.search ?? "",
    limit: String(pageSize),
  }

  fetchResults(newQuery, { navigation: NAVIGATION.PUSH })
}

// Clear only the search term (keep current filters/sort/order)
function onClearSearch() {
  limit.value = pageSize
  lookupUri.value = undefined

  const filterParams = buildRepeatableFiltersFromState()

  const base = buildQueryWithoutSearch(route.query)
  const newQuery = buildQueryWithFilters(base, filterParams, pageSize)

  fetchResults(newQuery, { navigation: NAVIGATION.PUSH })
}

function onRemoveFilter({ field, value }) {
  const next = { ...state.activeFilters }
  next[field] = (next[field] || []).filter((v) => v !== value)
  if (!next[field].length) {
    delete next[field]
  }
  setFilters(next)

  const filterParams = buildRepeatableFiltersFromState()

  // reset pagination to first page
  limit.value = pageSize

  // update URL + fetch

  const newQuery = buildQueryWithFilters(route.query, filterParams, pageSize)

  fetchResults(newQuery, { navigation: NAVIGATION.PUSH })
}

function onInspect(raw) {
  lookupUri.value = !_.isEmpty(raw) ? raw : undefined
}

// Browser Back/Forward changes the route outside fetchResults.
// Re-read the URL and fetch without pushing/replacing another entry.
watch(
  () => route.fullPath,
  () => {
    if (!booted.value || isInternalRouteChange()) {
      return
    }

    syncSearchStateFromRoute(route.query)
    fetchResults({ ...route.query }, { navigation: NAVIGATION.NONE })
  },
  { flush: "sync" },
)

// On mount, set filters from URL and do initial search
onMounted(async () => {
  // Normalize legacy query params (?languages=..., ?subject=..., etc.)
  //    into the  repeatable ?filter=... syntax.
  //    This runs once on the client so that:
  //    - the URL in the address bar is "clean"
  //    - the rest of the app only deals with `filter=...`
  const normalized = await normalizeLegacyQueryFromRoute(route, router) ?? { ...route.query }

  syncSearchStateFromRoute(normalized)

  // Fetch initial results based on the normalized query
  fetchResults({ ...normalized }, { navigation: NAVIGATION.REPLACE })

  // After the first auto-run from SearchBar, ignore extra initial “search” events
  booted.value = true
})
</script>

<style scoped>
.search-view__wrapper {
  display: grid;
  width: 100%;
  max-width: 1320px;
  grid-template-columns: minmax(0, 3fr) 400px;
  grid-template-areas:
    'search-bar search-bar'
    'search-controls search-controls'
    'results sidebar';
  column-gap: 30px;
  margin: 0 auto;
  align-items: start;
}

.search-bar__area {
  grid-area: search-bar;
  justify-self: center;
}
.search-results__area {
  grid-area: results;
}
.search-controls__area {
  grid-area: search-controls;
}
.search-sidebar__area {
  grid-area: sidebar;
  min-width: 320px;
}
</style>
