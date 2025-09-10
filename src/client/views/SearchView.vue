<template>
  <NavBreadcrumb
    v-if="summary.total > 0"
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
      @sort="onSort" />
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
  setFiltersFromRepeatable, openGroupsForActiveFilters } from "../stores/filters.js"

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
  const s = route.query.sort || "relevance"
  // relevance is a special one–word case
  if (s === "relevance") {
    return "relevance"
  }
  const o = (route.query.order || "asc").toLowerCase()
  return `${s} ${o}`
})

async function fetchResults(query) {
  loading.value = true
  errorMessage.value = null

  try {
    
    // 1) derive short URL filters from store (values only; no empties)
    const urlFilters = filtersToRepeatableForUrl()

    const { filter, ...rest } = query || {}
    const base = { ...rest }

    // 2) update the address bar (SHORT)
    const urlQuery = {
      ...base,
      limit: String(limit.value),
      ...(urlFilters.length ? { filter: urlFilters } : {}),
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

    // Prefer filters provided by caller (may include empties),
    // else fall back to SHORT ones (no empties).
    const apiFilterList = Array.isArray(filter) ? filter : filter ? [filter] : urlFilters
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
    
    // After (only update docs & numFound, and merge facets):
    results.value.docs      = docs
    results.value.numFound  = numFound
    results.value.facets = facets

  } catch (error) {
    errorMessage.value = `Search failed: ${error.message}`
  } finally {
    loading.value = false
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
  fetchResults(newQuery)
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

  // 3) build final repeatable params from *both* selected values + bucket facets
  const filterParams = buildRepeatableFiltersFromState(opts)


  // 4) update URL + fetch
  const base = { ...route.query }
  const newQuery = {
    ...base,
    limit: String(pageSize),
    ...(filterParams.length ? { filter: filterParams } : {}),
  }

  fetchResults(newQuery)
}

// Clear only filters (keep current search/sort/order)
function onClearFilters() {
  clearFilters()
  const base = { ...route.query }

  // deleteing previous filters & pagination
  delete base.filter
  delete base.start
  delete base.rows

  const newQuery = {
    ...base,
    search: base.search ?? "",
    limit: String(limit.value)  }

  router.push({ name: "search", query: newQuery })

  fetchResults(newQuery)

}

function onInspect(raw) {
  lookupUri.value = !_.isEmpty(raw) ? raw : undefined
}

// On mount, set filters from URL and do initial search
onMounted(() => {
  // filters from repeatable ?filter=... in the URL
  setFiltersFromRepeatable(route.query.filter)
  openGroupsForActiveFilters() // auto-open groups with selected values
  // limit from URL
  limit.value = Number(route.query.limit) || pageSize
  // 3) initial fetch with URL as-is
  fetchResults({ ...route.query })
  booted.value = true
})

</script>

<style scoped>
.search-view__wrapper  {
  display: grid;
  grid-column-gap: 30px;
  grid-template-areas: "search-bar search-bar" 
  "search-controls search-controls"
  "results sidebar";
  margin: 0 auto;
}

.search-bar__area { grid-area: search-bar; }
.search-results__area    { grid-area: results; }
.search-controls__area   { grid-area: search-controls; }
.search-sidebar__area    { grid-area: sidebar; }

</style>



